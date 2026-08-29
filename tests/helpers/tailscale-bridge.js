/**
 * tailscale-bridge — 单元测试用的「Tailscale 连通性 + 歌曲触发」helper
 * -----------------------------------------------------------------------------
 * 目的：让 E2E 不再悄悄退化成「浏览器内兜底生成」。
 * 之前的测试只检查页面不报错，song-bridge 一旦连不上，前端会静默走
 * createMockSong() 兜底，测试照样绿 —— 这就是为什么「看起来通过，其实没生成歌」。
 *
 * 这里提供三件事：
 *   1. resolveTailscaleBase()   自动解析本机 Tailscale 地址并挑出真正连通的 base URL
 *   2. probeHealth()            对某个 base 做 /api/health 探测（含 ComfyUI 是否在线）
 *   3. triggerSong()            走 SSE 调 /api/song，逐事件回调，用于预热缓存
 *
 * 地址解析优先级：
 *   环境变量 SONG_BRIDGE_TS_URL  >  `tailscale ip -4` 的 100.x 地址  >  MagicDNS 域名  >  (可选) localhost
 * 只有 100.x / *.ts.net 才算 Tailscale 通道；localhost 仅在 allowLocalhost 时作为最后退路，
 * 且会被标记为 kind='localhost'，调用方可以据此决定是失败还是跳过。
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const DEFAULT_PORT = 8787;

function execQuiet(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_) {
    return null;
  }
}

/**
 * 从本机 tailscale CLI 读取身份信息
 * @returns {{ip: string|null, dnsName: string|null, backendState: string|null}}
 */
export function tailscaleIdentity() {
  const out = {
    ip: execQuiet('tailscale', ['ip', '-4']) || null,
    dnsName: null,
    backendState: null
  };
  if (out.ip && !/^100\./.test(out.ip)) out.ip = null;

  const json = execQuiet('tailscale', ['status', '--json']);
  if (json) {
    try {
      const s = JSON.parse(json);
      out.backendState = s.BackendState || null;
      const self = s.Self || (s.Self === undefined ? null : s.Self);
      const dns = self && self.DNSName ? String(self.DNSName).replace(/\.$/, '') : null;
      if (dns) out.dnsName = dns;
      const ips = (s.TailscaleIPs || (self && self.TailscaleIPs) || []).filter((x) => /^100\./.test(x));
      if (!out.ip && ips.length) out.ip = ips[0];
    } catch (_) {
      /* 解析失败就只用 ip -4 的结果 */
    }
  }
  return out;
}

export function isTailscaleBase(base) {
  try {
    const h = new URL(base).hostname;
    return /^100\./.test(h) || h.endsWith('.ts.net') || h.includes('.tailscale.');
  } catch (_) {
    return false;
  }
}

/**
 * 候选 base URL 列表（Tailscale 通道排前面）
 * @param {{allowLocalhost?: boolean, port?: number}} opts
 * @returns {string[]}
 */
export function candidateBases({ allowLocalhost = false, port = DEFAULT_PORT } = {}) {
  const list = [];
  const push = (u) => {
    if (u && !list.includes(u)) list.push(u);
  };

  if (process.env.SONG_BRIDGE_TS_URL) push(process.env.SONG_BRIDGE_TS_URL.replace(/\/+$/, ''));

  const id = tailscaleIdentity();
  if (id.ip) push(`http://${id.ip}:${port}`);
  if (id.dnsName) push(`http://${id.dnsName}:${port}`);

  if (allowLocalhost) {
    push(`http://127.0.0.1:${port}`);
    push(`http://localhost:${port}`);
  }
  return list;
}

/**
 * 探测某个 base 的 /api/health
 * @returns {Promise<{ok: boolean, data?: object, error?: string, ms: number}>}
 */
export async function probeHealth(base, timeoutMs = 8000) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/health`, { cache: 'no-store', signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, data, ms: Date.now() - t0 };
    return { ok: !!(data && data.ok), data, ms: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? `超时 ${timeoutMs}ms` : err.message,
      ms: Date.now() - t0
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 挑出第一个真正连通的 base。
 * @param {{allowLocalhost?: boolean, timeoutMs?: number, log?: (s:string)=>void}} opts
 * @returns {Promise<{base: string, kind: 'tailscale'|'localhost', health: object, tried: Array<{base:string,ok:boolean,error?:string,ms:number}>}>}
 * @throws 全部不通时抛错，错误信息里带上每个候选的失败原因
 */
export async function resolveBridgeBase({ allowLocalhost = false, timeoutMs = 8000, log = () => {} } = {}) {
  const bases = candidateBases({ allowLocalhost });
  if (!bases.length) {
    throw new Error('没有任何候选 base URL：Tailscale 未运行，且未设置 SONG_BRIDGE_TS_URL');
  }

  const tried = [];
  for (const base of bases) {
    const r = await probeHealth(base, timeoutMs);
    tried.push({ base, ok: r.ok, error: r.error, ms: r.ms });
    log(`  · ${r.ok ? '✅' : '❌'} ${base} ${r.ok ? `(${r.ms}ms)` : `— ${r.error}`}`);
    if (r.ok) {
      return { base, kind: isTailscaleBase(base) ? 'tailscale' : 'localhost', health: r.data, tried };
    }
  }

  throw new Error(
    '所有候选地址都不通，song-bridge 未对外可达：\n' +
      tried.map((t) => `  - ${t.base}: ${t.error || '未知错误'}`).join('\n') +
      '\n请确认 `node tools/song-bridge/server.js` 已启动，且 Tailscale 处于 Running 状态。'
  );
}

/**
 * 走 SSE 触发 /api/song，逐个事件回调。
 * 用于测试前置的缓存预热：命中缓存时秒回，未命中则等真实作曲（最长 15 分钟）。
 *
 * @returns {Promise<{song: object, cached: boolean, ms: number, events: Array<{event:string,data:object}>}>}
 */
export async function triggerSong({
  base,
  words = [],
  sentence = '',
  style = 'acoustic folk pop',
  durationSec = 60,
  onEvent = () => {},
  timeoutMs = 15 * 60 * 1000
}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/api/song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words, sentence, style, durationSec, regenerate: false }),
      signal: ctrl.signal
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`POST /api/song 失败：HTTP ${res.status} ${text.slice(0, 300)}`);
    }

    const events = [];
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let song = null;
    let cached = false;

    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        events.push(parsed);
        onEvent(parsed);
        if (parsed.event === 'done') {
          song = parsed.data.song;
          cached = !!parsed.data.cached;
        }
        if (parsed.event === 'error') {
          throw new Error(`生成失败：${parsed.data.message || JSON.stringify(parsed.data)}`);
        }
      }
      if (song) break;
    }

    if (!song) throw new Error('SSE 流结束但未收到 done 事件');
    return { song, cached, ms: Date.now() - t0, events };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 与服务端 lib/util.js 的 songKey 保持一致，用来精确定位缓存条目
 * @returns {string}
 */
export function songKeyOf({ words = [], sentence = '', style = '', durationSec = '' }) {
  const norm = (Array.isArray(words) ? words : [])
    .map((w) => String(w).trim().toLowerCase())
    .filter(Boolean)
    .sort();
  const base = [
    norm.join(','),
    String(sentence || '').trim().toLowerCase().slice(0, 200),
    String(style || '').trim().toLowerCase(),
    String(durationSec || '')
  ].join('|');
  return crypto.createHash('sha1').update(base).digest('hex').slice(0, 20);
}

/**
 * 删掉指定参数的缓存歌曲，强制下一次请求真实作曲。
 * @returns {Promise<{removed: string[], id: string}>}
 */
export async function purgeCachedSong(base, params) {
  const id = songKeyOf(params);
  const res = await fetch(`${base}/api/songs/${id}`, { method: 'DELETE' });
  const json = await res.json().catch(() => ({}));
  return { removed: json.removed ? [id] : [], id };
}

function parseSseBlock(block) {
  if (!block || block.startsWith(':')) return null;
  let event = 'message';
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch (_) {
    return null;
  }
}

/**
 * 读音频的前若干字节，估算 MP3 时长（浏览器 duration 拿不到时的兜底校验）。
 * 只处理最常见的 CBR/带 Xing 头的 MP3，够用即可。
 * @returns {Promise<{durationSec: number|null, bitrateKbps: number|null, sampleRate: number|null}>}
 */
export async function probeMp3Duration(url, bytesToRead = 64 * 1024) {
  const BITRATES_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const SAMPLE_RATES = [44100, 48000, 32000];
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${bytesToRead - 1}` } });
    const total = Number(res.headers.get('content-range')?.split('/')[1] || res.headers.get('content-length') || 0);
    const buf = Buffer.from(await res.arrayBuffer());

    let i = 0;
    if (buf.slice(0, 3).toString('latin1') === 'ID3') {
      const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
      i = 10 + size;
    }
    // 找帧同步字
    for (; i < buf.length - 4; i++) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) break;
    }
    if (i >= buf.length - 4) return { durationSec: null, bitrateKbps: null, sampleRate: null };

    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    const b3 = buf[i + 3];
    const versionBits = (b1 >> 3) & 0x03; // 11 = MPEG1
    const layerBits = (b1 >> 1) & 0x03; // 01 = Layer III
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    const channelMode = (b3 >> 6) & 0x03; // 11 = 单声道
    if (versionBits !== 3 || layerBits !== 1 || !bitrateIndex || bitrateIndex === 15) {
      return { durationSec: null, bitrateKbps: null, sampleRate: null };
    }

    const bitrateKbps = BITRATES_V1L3[bitrateIndex];
    const sampleRate = SAMPLE_RATES[sampleRateIndex];
    // Xing/Info 头：给出总帧数，可精确算时长
    const xingOff = i + 4 + (channelMode === 3 ? 17 : 32); // 单声道 side info 17 字节，其余 32 字节
    const tag = buf.slice(xingOff, xingOff + 4).toString('latin1');
    if (tag === 'Xing' || tag === 'Info') {
      const flags = readUInt32BE(buf, xingOff + 4);
      if (flags & 0x1) {
        const frames = readUInt32BE(buf, xingOff + 8);
        const samplesPerFrame = 1152; // MPEG1 Layer III
        const durationSec = (frames * samplesPerFrame) / sampleRate;
        // 用文件总长反推实际码率，比帧头里的标称值更可信
        const effectiveKbps = total && durationSec ? Math.round((total * 8) / durationSec / 1000) : bitrateKbps;
        return { durationSec, bitrateKbps: effectiveKbps, sampleRate, frames };
      }
    }
    if (total && bitrateKbps) {
      return { durationSec: ((total - i) * 8) / (bitrateKbps * 1000), bitrateKbps, sampleRate };
    }
    return { durationSec: null, bitrateKbps, sampleRate };
  } catch (_) {
    return { durationSec: null, bitrateKbps: null, sampleRate: null };
  }
}

function readUInt32BE(buf, off) {
  return (
    ((buf[off] & 0xff) << 24) | ((buf[off + 1] & 0xff) << 16) | ((buf[off + 2] & 0xff) << 8) | (buf[off + 3] & 0xff)
  );
}
