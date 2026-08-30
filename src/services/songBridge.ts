/**
 * services/songBridge — song-bridge 统一服务客户端（SSE 流式生成）
 * -----------------------------------------------------------------------------
 * 网络与地址经构造函数注入（getBase / fetchImpl），便于单测。
 * SSE 事件：stage / caption / lyrics / notes / lyrics_done / progress / done / error
 */

import { getSongBridgeBase } from './serverConfig';

export const DEFAULT_STYLE = 'acoustic folk pop';
export const DEFAULT_DURATION_SEC = 60;

export interface SongParams {
  words?: string[];
  sentence?: string;
  style?: string;
  durationSec?: number;
  regenerate?: boolean;
}

export interface StageInfo {
  stage: string;
  message?: string;
}

export interface SongResult {
  id: string;
  cached?: boolean;
  [key: string]: unknown;
}

export interface HealthInfo {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface SongHandlers {
  onStage?: (info: StageInfo) => void;
  onCaption?: (text: string) => void;
  onLyrics?: (text: string) => void;
  onNotes?: (text: string) => void;
  onLyricsDone?: (data: unknown) => void;
  onProgress?: (data: unknown) => void;
  onDone?: (song: SongResult, cached: boolean) => void;
  onError?: (error: { message: string; aborted?: boolean }) => void;
}

type FetchLike = typeof fetch;

export class SongBridgeClient {
  private _abort: AbortController | null = null;
  private _lastHealth: HealthInfo | null = null;
  private _lastHealthAt = 0;

  constructor(
    private readonly getBase: () => string = getSongBridgeBase,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  get baseUrl(): string {
    return this.getBase();
  }

  /** 健康检查（5 秒内不重复请求） */
  async health(force = false): Promise<HealthInfo> {
    const now = Date.now();
    if (!force && this._lastHealth && now - this._lastHealthAt < 5000) {
      return this._lastHealth;
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      this._lastHealth = { ok: true, ...data };
    } catch (error) {
      this._lastHealth = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    this._lastHealthAt = now;
    return this._lastHealth;
  }

  audioUrl(id: string): string {
    return `${this.baseUrl}/api/audio/${encodeURIComponent(id)}`;
  }

  async list(): Promise<Array<Record<string, unknown>>> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/songs`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = (await res.json()) as { songs?: Array<Record<string, unknown>> };
      return Array.isArray(data.songs) ? data.songs : [];
    } catch {
      return [];
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/songs/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** 生成歌曲（SSE 流式）；失败/取消返回 null。
   *  移动端长连接易断：若流在未收到 done 前中断，自动改用轮询 /api/songs/:id 从缓存取回结果。 */
  async generate(params: SongParams, handlers: SongHandlers = {}): Promise<SongResult | null> {
    const controller = new AbortController();
    this._abort = controller;

    const body = {
      words: params.words ?? [],
      sentence: params.sentence ?? '',
      style: params.style ?? DEFAULT_STYLE,
      durationSec: Number(params.durationSec) || DEFAULT_DURATION_SEC,
      regenerate: !!params.regenerate
    };

    let result: SongResult | null = null;
    let jobId: string | null = null;
    let finished = false;
    const setResult = (r: SongResult) => (result = r);
    const setJobId = (id: string) => (jobId = id);
    const finish = (song: SongResult, cached: boolean) => {
      if (finished) return;
      finished = true;
      setResult(song);
      handlers.onDone?.(song, cached);
    };

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `服务返回 ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          this.handleBlock(block, handlers, setResult, setJobId, finish);
        }
      }
      if (buffer.trim()) {
        this.handleBlock(buffer.trim(), handlers, setResult, setJobId, finish);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        handlers.onError?.({ message: '已取消生成', aborted: true });
        return null;
      }
      // 流中断（移动端长连接被挂起/重置）：若已知 jobId，轮询缓存取回结果
      if (jobId) {
        const polled = await this.pollForSong(jobId, handlers, controller.signal, finish);
        if (polled) return polled;
      }
      handlers.onError?.({ message: error instanceof Error ? error.message : '连接本地歌曲服务失败' });
      return null;
    } finally {
      this._abort = null;
    }

    // 流正常结束但未收到 done（服务器提前关流而歌曲仍在生成）：改轮询
    if (!finished && jobId) {
      const polled = await this.pollForSong(jobId, handlers, controller.signal, finish);
      if (polled) return polled;
    }

    return result;
  }

  /** 断流后备：轮询 /api/songs/:id，直到歌曲就绪（200）或超时/取消。
   *  生成中的歌曲在服务端仍会继续跑并写入缓存，所以轮询最终能取回。 */
  private async pollForSong(
    jobId: string,
    handlers: SongHandlers,
    signal: AbortSignal,
    finish: (song: SongResult, cached: boolean) => void
  ): Promise<SongResult | null> {
    const maxMs = 10 * 60 * 1000;
    const interval = 2000;
    const deadline = Date.now() + maxMs;
    handlers.onStage?.({ stage: 'music', message: '连接中断，正在从缓存取回结果…' });
    while (Date.now() < deadline) {
      if (signal.aborted) return null;
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/api/songs/${encodeURIComponent(jobId)}`, {
          cache: 'no-store',
          signal
        });
        if (res.status === 200) {
          const data = (await res.json()) as { song?: SongResult };
          if (data.song && data.song.id) {
            finish(data.song, false);
            return data.song;
          }
        }
        // 404 = 仍在生成；其他状态也按"未完成"重试
      } catch (err) {
        if (signal.aborted) return null;
        // 网络抖动：继续重试
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    return null;
  }

  cancel(): void {
    this._abort?.abort();
    this._abort = null;
  }

  private handleBlock(
    block: string,
    handlers: SongHandlers,
    setResult: (song: SongResult) => void,
    setJobId?: (id: string) => void,
    finish?: (song: SongResult, cached: boolean) => void
  ): void {
    if (!block || block.startsWith(':')) return;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;

    let data: unknown;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    switch (event) {
      case 'stage':
        handlers.onStage?.(data as StageInfo);
        break;
      case 'caption':
        handlers.onCaption?.((data as { text: string }).text);
        break;
      case 'lyrics':
        handlers.onLyrics?.((data as { text: string }).text);
        break;
      case 'notes':
        handlers.onNotes?.((data as { text: string }).text);
        break;
      case 'lyrics_done':
        handlers.onLyricsDone?.(data);
        break;
      case 'progress':
        handlers.onProgress?.(data);
        break;
      case 'job': {
        const id = (data as { id?: string }).id;
        if (id) setJobId?.(id);
        break;
      }
      case 'done': {
        const payload = data as { song: SongResult; cached?: boolean };
        if (finish) finish(payload.song, !!payload.cached);
        else {
          setResult(payload.song);
          handlers.onDone?.(payload.song, !!payload.cached);
        }
        break;
      }
      case 'error':
        handlers.onError?.({ message: (data as { message?: string }).message ?? '生成失败' });
        break;
      default:
        break;
    }
  }
}

export default SongBridgeClient;
