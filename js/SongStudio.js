/**
 * SongStudio — 本地歌曲生成客户端
 * -----------------------------------------------------------------------------
 * 与本机 ai-hub 统一服务（song-bridge，端口 8787）通信：
 *   地址自动探测——Tailscale 域名/IP 时走同主机 8787，否则随页面主机名 :8787。
 *   原文即歌词 → ComfyUI(MiniMax Music 3) 作曲 → 缓存 + 流式播放
 *
 * 经过 song-bridge 单端口对外，避免浏览器直连 ComfyUI 的 CORS 问题。
 * 生成过程通过 SSE 流式回传：歌词边写边显示，作曲阶段回传进度。
 */

const DEFAULT_STYLE = 'acoustic folk pop';
const DEFAULT_DURATION_SEC = 60;

const PROD_TAILSCALE_BASE = 'https://pc-20260820eaeq.tailfbac23.ts.net:8787';

function defaultBase() {
  try {
    const h = window.location.hostname;
    if (h && h.endsWith('github.io')) return PROD_TAILSCALE_BASE;
    if (h) return `http://${h}:8787`;
  } catch {}
  return 'http://localhost:8787';
}

function isTailscaleHost(host) {
  return host.endsWith('.ts.net') || /^100\.\d/.test(host) || host.includes('.tailscale.') || host.endsWith('.tail5b6e1.ts.net') || host.endsWith('.tailfbac23.ts.net');
}

function tailscaleBase() {
  try {
    const h = window.location.hostname;
    if (h && h.endsWith('github.io')) return PROD_TAILSCALE_BASE;
    if (isTailscaleHost(h)) {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      // 统一服务与网页同主机同协议，避免 iPad 上 loopback 指向本机
      return `${proto}//${h}:8787`;
    }
  } catch {}
  return null;
}

export class SongStudio {
    constructor() {
        this._abort = null;
        this._lastHealth = null;
        this._lastHealthAt = 0;
    }

    get baseUrl() {
        return tailscaleBase() || defaultBase();
    }

    /**
     * 健康检查（5 秒内不重复请求）
     * @param {boolean} force
     */
    async health(force = false) {
        const now = Date.now();
        if (!force && this._lastHealth && now - this._lastHealthAt < 5000) {
            return this._lastHealth;
        }
        try {
            const res = await fetch(`${this.baseUrl}/api/health`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this._lastHealth = { ok: true, ...data };
        } catch (error) {
            this._lastHealth = { ok: false, error: error.message };
        }
        this._lastHealthAt = now;
        return this._lastHealth;
    }

    audioUrl(id) {
        return `${this.baseUrl}/api/audio/${encodeURIComponent(id)}`;
    }

    async list() {
        try {
            const res = await fetch(`${this.baseUrl}/api/songs`, { cache: 'no-store' });
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data.songs) ? data.songs : [];
        } catch (_) {
            return [];
        }
    }

    async remove(id) {
        try {
            const res = await fetch(`${this.baseUrl}/api/songs/${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            return res.ok;
        } catch (_) {
            return false;
        }
    }

    /**
     * 生成歌曲（SSE 流式）
     * @param {object} params
     * @param {string[]} params.words
     * @param {string} params.sentence
     * @param {string} params.style
     * @param {number} params.durationSec
     * @param {boolean} params.regenerate
     * @param {object} handlers {onStage, onCaption, onLyrics, onNotes, onProgress, onDone, onError}
     * @returns {Promise<object|null>}
     */
    async generate(params, handlers = {}) {
        const controller = new AbortController();
        this._abort = controller;

        const body = {
            words: params.words || [],
            sentence: params.sentence || '',
            style: params.style || DEFAULT_STYLE,
            durationSec: Number(params.durationSec) || DEFAULT_DURATION_SEC,
            regenerate: !!params.regenerate
        };

        let result = null;
        try {
            const res = await fetch(`${this.baseUrl}/api/song`, {
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

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let idx;
                while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const block = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    this._handleBlock(block, handlers, (r) => (result = r));
                }
            }
            if (buffer.trim()) {
                this._handleBlock(buffer.trim(), handlers, (r) => (result = r));
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                handlers.onError?.({ message: '已取消生成', aborted: true });
                return null;
            }
            handlers.onError?.({ message: error.message || '连接本地歌曲服务失败' });
            return null;
        } finally {
            this._abort = null;
        }

        return result;
    }

    cancel() {
        this._abort?.abort();
        this._abort = null;
    }

    _handleBlock(block, handlers, setResult) {
        if (!block || block.startsWith(':')) return;
        let event = 'message';
        const dataLines = [];
        for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) return;

        let data;
        try {
            data = JSON.parse(dataLines.join('\n'));
        } catch (_) {
            return;
        }

        switch (event) {
            case 'stage':
                handlers.onStage?.(data);
                break;
            case 'caption':
                handlers.onCaption?.(data.text);
                break;
            case 'lyrics':
                handlers.onLyrics?.(data.text);
                break;
            case 'notes':
                handlers.onNotes?.(data.text);
                break;
            case 'lyrics_done':
                handlers.onLyricsDone?.(data);
                break;
            case 'progress':
                handlers.onProgress?.(data);
                break;
            case 'done':
                setResult(data.song);
                handlers.onDone?.(data.song, !!data.cached);
                break;
            case 'error':
                handlers.onError?.(data);
                break;
            default:
                break;
        }
    }

    /**
     * 从句子里挑出"值得唱"的词：去掉停用词与过短词，保留较长的实词
     * @param {string} sentence
     * @param {string[]} extra 额外候选（例如页面上高亮的生词）
     * @param {number} max
     */
    static pickWords(sentence = '', extra = [], max = 4) {
        const STOP = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'by',
            'for', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this',
            'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your',
            'his', 'her', 'their', 'our', 'not', 'no', 'do', 'does', 'did', 'have', 'has',
            'had', 'will', 'would', 'can', 'could', 'should', 'from', 'as', 'so', 'than',
            'then', 'there', 'here', 'what', 'when', 'where', 'who', 'how', 'why', 'about',
            'into', 'over', 'under', 'again', 'very', 'just', 'also', 'more', 'most', 'some'
        ]);

        const seen = new Set();
        const out = [];
        const push = (w) => {
            const lower = String(w).toLowerCase();
            if (!lower || seen.has(lower)) return;
            if (lower.length < 4 || STOP.has(lower)) return;
            if (!/^[a-z]+$/i.test(lower)) return;
            seen.add(lower);
            out.push(lower);
        };

        // 页面高亮的生词优先
        (extra || []).forEach(push);
        // 句子里剩下的长词按长度降序补位
        String(sentence)
            .replace(/[^A-Za-z'\s-]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)
            .forEach(push);

        return out.slice(0, max);
    }
}

export default SongStudio;
