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

  /** 生成歌曲（SSE 流式）；失败/取消返回 null */
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
          this.handleBlock(block, handlers, (r) => (result = r));
        }
      }
      if (buffer.trim()) {
        this.handleBlock(buffer.trim(), handlers, (r) => (result = r));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        handlers.onError?.({ message: '已取消生成', aborted: true });
        return null;
      }
      handlers.onError?.({ message: error instanceof Error ? error.message : '连接本地歌曲服务失败' });
      return null;
    } finally {
      this._abort = null;
    }

    return result;
  }

  cancel(): void {
    this._abort?.abort();
    this._abort = null;
  }

  private handleBlock(block: string, handlers: SongHandlers, setResult: (song: SongResult) => void): void {
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
      case 'done': {
        const payload = data as { song: SongResult; cached?: boolean };
        setResult(payload.song);
        handlers.onDone?.(payload.song, !!payload.cached);
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
