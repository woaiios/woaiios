import { describe, it, expect, vi } from 'vitest';
import { SongBridgeClient } from '../songBridge';

/** 构造返回指定 SSE 文本的 fake fetch */
function sseFetch(sseText: string, init?: { ok?: boolean; status?: number }) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sseText));
      controller.close();
    }
  });
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    body: stream,
    text: async () => sseText,
    json: async () => JSON.parse(sseText)
  })) as unknown as typeof fetch;
}

const base = 'http://test:8787';
const client = (fetchImpl?: typeof fetch) => new SongBridgeClient(() => base, fetchImpl);

describe('SongBridgeClient.health', () => {
  it('caches for 5s and honors force', async () => {
    const f = sseFetch(JSON.stringify({ ok: true }));
    const c = client(f);
    const a = await c.health();
    const b = await c.health();
    expect(a).toMatchObject({ ok: true });
    expect(b).toBe(a); // 命中缓存
    expect(f).toHaveBeenCalledTimes(1);
    await c.health(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('returns {ok:false,error} on network failure', async () => {
    const f = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const h = await client(f).health();
    expect(h).toMatchObject({ ok: false, error: 'ECONNREFUSED' });
  });
});

describe('SongBridgeClient.generate (SSE)', () => {
  it('parses stage/lyrics/done events in order', async () => {
    const sse =
      'event: stage\ndata: {"stage":"music","message":"sampling"}\n\n' +
      'event: lyrics\ndata: {"text":"la la la"}\n\n' +
      'event: done\ndata: {"song":{"id":"abc123","cached":false},"cached":false}\n\n';
    const c = client(sseFetch(sse));
    const stages: string[] = [];
    let lyrics = '';
    let done: unknown = null;
    const result = await c.generate(
      { words: [], sentence: 'hello world', style: 'pop', durationSec: 5 },
      {
        onStage: (s) => stages.push(s.stage),
        onLyrics: (t) => (lyrics += t),
        onDone: (song) => (done = song)
      }
    );
    expect(stages).toEqual(['music']);
    expect(lyrics).toBe('la la la');
    expect(done).toMatchObject({ id: 'abc123' });
    expect(result).toMatchObject({ id: 'abc123', cached: false });
  });

  it('posts JSON body with defaults filled in', async () => {
    const f = sseFetch('event: done\ndata: {"song":{"id":"x"}}\n\n');
    await client(f).generate({ words: ['go'], sentence: 's' });
    const call = (f as unknown as { mock: { calls: Array<Array<unknown>> } }).mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe(`${base}/api/song`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ words: ['go'], sentence: 's', style: 'acoustic folk pop', durationSec: 60, regenerate: false });
  });

  it('emits onError and returns null on server error event', async () => {
    const sse = 'event: error\ndata: {"message":"ComfyUI 离线"}\n\n';
    let err: unknown = null;
    const result = await client(sseFetch(sse)).generate(
      { words: [], sentence: 's', style: 'pop', durationSec: 5 },
      { onError: (e) => (err = e) }
    );
    expect(err).toMatchObject({ message: 'ComfyUI 离线' });
    expect(result).toBeNull();
  });

  it('emits onError with server text on non-ok response', async () => {
    const f = sseFetch('boom', { ok: false, status: 500 });
    let err: unknown = null;
    const result = await client(f).generate(
      { words: [], sentence: 's', style: 'pop', durationSec: 5 },
      { onError: (e) => (err = e) }
    );
    expect(err).toMatchObject({ message: 'boom' });
    expect(result).toBeNull();
  });

  it('abort → onError aborted=true, returns null', async () => {
    // 永不结束的响应体；read() 挂起直到 signal abort（模拟真实 fetch 行为）
    const f = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => ({
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              read: () =>
                new Promise((_resolve, reject) => {
                  init?.signal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('Aborted', 'AbortError')),
                    { once: true }
                  );
                })
            };
          }
        },
        text: async () => ''
      })
    ) as unknown as typeof fetch;
    const c = client(f);
    let err: { message?: string; aborted?: boolean } | null = null;
    const p = c.generate(
      { words: [], sentence: 's', style: 'pop', durationSec: 5 },
      { onError: (e) => (err = e) }
    );
    await new Promise((r) => setTimeout(r, 10));
    c.cancel();
    const result = await p;
    expect(err).toMatchObject({ message: '已取消生成', aborted: true });
    expect(result).toBeNull();
  });

  it('splits SSE blocks on double newline across chunk boundaries', async () => {
    // 一个事件被拆成两个 chunk 送达
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('event: done\nda'));
        controller.enqueue(enc.encode('ta: {"song":{"id":"split"}}\n\n'));
        controller.close();
      }
    });
    const f = vi.fn(async () => ({ ok: true, status: 200, body: stream, text: async () => '' })) as unknown as typeof fetch;
    const result = await client(f).generate({ words: [], sentence: 's', style: 'pop', durationSec: 5 });
    expect(result).toMatchObject({ id: 'split' });
  });
});

describe('SongBridgeClient list/remove/audioUrl', () => {
  it('audioUrl encodes the id', () => {
    expect(client().audioUrl('a b/c')).toBe(`${base}/api/audio/a%20b%2Fc`);
  });

  it('list returns [] on failure, songs array on success', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ songs: [{ id: '1' }] }) })) as unknown as typeof fetch;
    expect(await client(ok).list()).toEqual([{ id: '1' }]);
    const bad = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await client(bad).list()).toEqual([]);
  });

  it('remove reports success/failure', async () => {
    const ok = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    const bad = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await client(ok).remove('1')).toBe(true);
    expect(await client(bad).remove('1')).toBe(false);
  });
});
