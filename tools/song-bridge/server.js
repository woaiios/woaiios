'use strict';

/**
 * ai-hub — 本地统一调度服务（原 song-bridge）
 * -----------------------------------------------------------------------------
 * 单一对外服务，统一管理本机模型并对外暴露统一 API：
 *   LMStudio(hy-mt2-1.8b 翻译) + ComfyUI(MiniMax Music 3 作曲)
 * 对外仅需暴露本服务一个端口（默认 8787，`tailscale serve --bg http://127.0.0.1:8787` 即可外网访问）。
 *
 * 接口（统一层）：
 *   GET    /api/health                 三后端健康 + 显存 + 缓存
 *   POST   /api/translate              代理 LMStudio 翻译（OpenAI 兼容，内部走调度）
 *   POST   /api/song                   生成歌曲（SSE 事件流，ComfyUI 作曲）
 *   GET    /api/songs                  已缓存歌曲列表
 *   GET    /api/songs/:id              单曲元数据
 *   DELETE /api/songs/:id              删除缓存
 *   GET    /api/audio/:id              音频（支持 Range，边下边播）
 *   GET    /api/cache                  缓存占用统计
 *   DELETE /api/cache                  清空缓存
 *   POST   /api/gpu/free               手动释放 GPU（卸载 ComfyUI + LMStudio）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { config, ROOT } = require('./config');
const { songKey, ensureDir, sleep, nvidiaFreeVramGiB } = require('./lib/util');
const { ComfyUI } = require('./lib/comfyui');
const { ComfyUiPower } = require('./lib/comfyui-power');
const { MiniMax, readiness } = require('./lib/minimax');
const { GpuScheduler } = require('./lib/gpu-scheduler');
const { StyleRouter } = require('./lib/style-router');
const { sanitizeLyrics, sanitizeCaption } = require('./lib/lyricist');
const { SongStore } = require('./lib/store');

ensureDir(config.cacheDir);
ensureDir(config.audioDir);
ensureDir(config.logDir);

const log = (...args) => console.log('[song-bridge]', ...args);

const comfyui = new ComfyUI(config, log);
const power = new ComfyUiPower({ comfyui, log });
const store = new SongStore({ cacheDir: config.cacheDir, audioDir: config.audioDir });
const styleRouter = new StyleRouter(config.skill);

/**
 * LM Studio 封装：默认不动它，资源紧张时才请走，事后按小上下文请回来。
 *
 * 实测坑：hy-mt2-1.8b 以 LM Studio 默认的 262144 上下文常驻时，
 * 光 KV cache 就吃掉约 17GB 系统内存，整机只剩 1.6GB，
 * 导致 ComfyUI 采样从 6.8 步/秒暴跌到 0.18 步/秒（慢 38 倍）。
 * 单词释义根本用不到这么长的上下文，所以这里统一按 8192 重新加载。
 */
const lmstudio = {
  HUGE_CONTEXT: 32768,

  async loadedModels() {
    try {
      const res = await fetch(`${config.lmstudio.baseUrl}/api/v1/models`, {
        signal: AbortSignal.timeout(5000)
      });
      const json = await res.json();
      return (json.models || []).filter((m) => (m.loaded_instances || []).length > 0);
    } catch (_) {
      return [];
    }
  },

  _lms(args) {
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
      if (!fs.existsSync(config.lmstudio.lmsPath)) return resolve(false);
      const p = spawn(config.lmstudio.lmsPath, args, { windowsHide: true, stdio: 'ignore' });
      p.on('exit', () => resolve(true));
      p.on('error', () => resolve(false));
    });
  },

  async unloadAll() {
    const loaded = await this.loadedModels();
    if (!loaded.length) return [];
    for (const m of loaded) await this._lms(['unload', m.key]);
    this._evicted = true;
    return loaded.map((m) => m.key);
  },

  /** 翻译模型是否以"过大"的上下文常驻（纯属浪费内存） */
  async hasWastefulModel() {
    const loaded = await this.loadedModels();
    return loaded.filter((m) =>
      (m.loaded_instances || []).some((i) => (i.config?.context_length || 0) > this.HUGE_CONTEXT)
    );
  },

  /** 卸载后按小上下文重新加载，保证单词翻译功能随时可用 */
  async ensureLoaded() {
    if (config.lmstudio.manage === false) return false;
    const loaded = await this.loadedModels();
    const already = loaded.some((m) => m.key === config.lmstudio.model);
    const wasteful = await this.hasWastefulModel();

    if (already && !wasteful.length) return false;

    if (wasteful.length) await this.unloadAll();

    try {
      const res = await fetch(`${config.lmstudio.baseUrl}/api/v1/models/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.lmstudio.model,
          context_length: config.lmstudio.reloadContextLength
        }),
        signal: AbortSignal.timeout(120000)
      });
      const json = await res.json().catch(() => ({}));
      log(
        `[lmstudio] 已重新加载 ${config.lmstudio.model}` +
          `（上下文 ${config.lmstudio.reloadContextLength}，状态 ${json.status || '未知'}）`
      );
      return true;
    } catch (err) {
      log('[lmstudio] 重新加载失败：', err.message);
      return false;
    }
  },

  // 轻量作词：直接用 hy-mt2-1.8b（2G 显存，可与 ComfyUI 并存，无需排队）
  async chat({ messages, maxTokens = 2048, temperature = 0.8, topP = 0.9, onDelta, signal }) {
    const body = {
      model: config.lmstudio.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stream: true
    };
    const res = await fetch(`${config.lmstudio.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(120000)
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => '');
      throw new Error(`LMStudio HTTP ${res.status} ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let content = '';
    let reasoning = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta || {};
          if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            reasoning += delta.reasoning_content;
            onDelta?.({ type: 'reasoning', text: delta.reasoning_content });
          }
          if (typeof delta.content === 'string' && delta.content) {
            content += delta.content;
            onDelta?.({ type: 'content', text: delta.content });
          }
        } catch {}
      }
    }
    return { content, reasoning };
  }
};

const scheduler = new GpuScheduler({ comfyui, lmstudio, config });

/** MiniMax Music 3 直连作曲：每个任务一个独立 Python 进程，退出即释放全部内存 */
const minimax = new MiniMax({ log: (...a) => log(...a) });

/**
 * 轻回收：翻译模型按小上下文补回来，保证单词翻译不中断。
 * （作曲进程已自行退出，无需再释放 ComfyUI）
 */
scheduler.onIdleLight = async () => {
  try {
    await lmstudio.ensureLoaded();
  } catch (err) {
    log('[idle] 恢复 LM Studio 失败：', err.message);
  }
};

// ---------------------------------------------------------------------------
// HTTP 基础
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.opus': 'audio/ogg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function setCors(req, res) {
  const origin = req.headers.origin;
  // 同源页面、GitHub Pages 线上版、Tailscale 域名都要能访问
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Range,Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');
  // Private Network Access (Chrome PNA)：https 公网页 → tailnet 私有地址 时浏览器会发 preflight
  // 需显式允许，否则 https://woaiios.github.io 无法 fetch https://*.ts.net:8788
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// 核心：生成一首歌
// ---------------------------------------------------------------------------

async function generateSong(params, emit) {
  const {
    words = [],
    sentence = '',
    style = config.song.defaultStyle,
    durationSec = config.song.defaultDurationSec,
    regenerate = false
  } = params;

  const cleanWords = words.map((w) => String(w).trim()).filter(Boolean);
  if (!cleanWords.length && !sentence.trim()) {
    throw new Error('至少需要一个单词或一句话');
  }

  const dur = clamp(
    Number(durationSec) || config.song.defaultDurationSec,
    config.song.minDurationSec,
    config.song.maxDurationSec
  );

  const key = songKey({ words: cleanWords, sentence, style, durationSec: dur });
  // 尽早把任务 id 推给客户端：移动端（iPad/Safari）长 SSE 连接可能被系统挂起或中继重置，
  // 一旦断流客户端就拿不到 done；有了 id 它可改为轮询 /api/songs/:id 从缓存取回结果。
  emit('job', { id: key, status: 'generating' });
  if (!regenerate) {
    const cached = store.touch(key);
    if (cached) {
      emit('done', { song: cached, cached: true });
      return cached;
    }
  }

  // ---- 阶段 1：直接使用原文 + 风格（跳过 LLM 作词，hy-mt2 效果差） ----
  emit('stage', { stage: 'lyrics', message: '准备歌词（直接使用原文）…' });

  let reference = null;
  let route = null;
  try {
    const ref = styleRouter.resolve(style);
    if (ref && ref.template) {
      reference = ref.template;
      route = ref.route;
      emit('stage', {
        stage: 'lyrics',
        message: `已选定曲风参考：${ref.card ? ref.card.style : route}（来自写歌技能模板库）`
      });
    }
  } catch (err) {
    log('风格模板检索失败，跳过：', err.message);
  }

  // 直接以原文作歌词，caption 由风格+参考模板合成（仍用 skill 的词汇与结构）
  // 随机声线：保证男女声均衡（此前 folk 类模板 80%+ 为男声，导致“总是男的”）
  const VOCAL_PRESETS = [
    'Vocal: Female lead, clear bright soprano, airy and intimate',
    'Vocal: Male lead, warm resonant baritone, close and intimate',
    'Vocal: Female lead, soft ethereal alto, breathy and warm',
    'Vocal: Male lead, deep warm tenor, smooth and resonant',
    'Vocal: Female and male duet, harmonized chorus'
  ];
  const vocalHint = VOCAL_PRESETS[crypto.randomInt(0, VOCAL_PRESETS.length)];
  const captionSrc = reference
    ? `${reference}\n\nStyle hint: ${style} | Duration: ${dur}s | Route: ${route || ''}\n${vocalHint}`
    : `Global Metadata: ${style}, moderate tempo 80-95 BPM, warm and clear production.\n\nVocal Details: ${vocalHint.replace(/^Vocal:\s*/, '')}, mid register, clear diction.\n\nArrangement: Intro soft pad, verse sparse, chorus full, bridge stripped, outro fade. Duration ${dur}s.`;
  const caption = sanitizeCaption(captionSrc);
  // 原文即歌词：按句切行，保证可唱段落标签
  const rawLyrics = (sentence || cleanWords.join(' ')).trim();
  const lyricLines = rawLyrics.split(/(?<=[.!?。！？])\s+/).map(s => s.trim()).filter(Boolean);
  const lyricsBody = lyricLines.join('\n');
  const lyrics = sanitizeLyrics(`[Verse]\n${lyricsBody}\n[Chorus]\n${lyricsBody.slice(0, 400)}\n[Outro]\n${lyricLines.slice(-1)[0] || ''}`);
  const notes = '';
  emit('caption', { text: caption });
  // 流式推歌词（模拟，原文字数少，分块快）
  for (const chunk of lyrics.match(/.{1,40}/g) || [lyrics]) {
    emit('lyrics', { text: chunk });
    await sleep(10);
  }
  emit('lyrics_done', { caption, lyrics, notes });
  const song = { caption, lyrics, notes };

  // ---- 阶段 2：MiniMax Music 3 作曲 ----
  const seed = crypto.randomInt(0, 0xffffffff);
  const audioFile = store.audioPath(key);
  const useComfyui = (config.composeBackend || 'comfyui') === 'comfyui';

  if (useComfyui) {
    // 走 ComfyUI 服务器：扩散阶段 GPU 利用率高、AR 阶段由 ComfyUI 调度处理，整体更快。
    // 生成后用 /free 卸载模型显存（释放给 LM Studio），但 ComfyUI 服务本身保持运行（不关机）。
    emit('stage', { stage: 'music', message: '连接到 ComfyUI（MiniMax Music 3）…' });
    await scheduler.run('comfyui', async () => {
      // 确保 ComfyUI 服务在线（首次 / 重启后自动拉起 standalone 后端，已在线则直接返回）
      let started = false;
      try {
        started = await power.ensureUp({ waitMs: 180000 });
      } catch (e) {
        throw new Error(`ComfyUI 启动失败：${e.message}`);
      }
      emit('stage', {
        stage: 'music',
        message: started ? 'ComfyUI 已就绪，开始编曲…' : 'ComfyUI 在线，开始编曲…'
      });

      const graph = comfyui.buildGraph({
        caption: song.caption,
        lyrics: song.lyrics,
        seed,
        durationSec: dur,
        filenamePrefix: `songbridge/${key}`
      });

      let lastPhase = '';
      let out = null;
      try {
        out = await comfyui.run(graph, (p) => {
          if (p.phase && p.phase !== lastPhase) {
            lastPhase = p.phase;
            emit('stage', { stage: 'music', message: p.phase });
          }
          if (p.max > 0) emit('progress', { phase: p.phase, value: p.value, max: p.max });
        });
      } finally {
        // 用完后卸载模型显存（保留 ComfyUI 服务，不关机）—— 符合「卸载资源、不关 ComfyUI」
        try {
          await comfyui.freeMemory();
          emit('stage', { stage: 'music', message: '已卸载 ComfyUI 模型显存（服务保留）' });
        } catch (_) {}
      }

      emit('stage', { stage: 'music', message: '取回生成的音频…' });
      const buf = await comfyui.view(out.filename, out.subfolder, out.type);
      await fs.promises.writeFile(audioFile, buf);
    });
  } else {
    // 直连 Python 进程（minimax/compose.py）：退出即释放全部内存，但 AR 阶段较 ComfyUI 慢。
    emit('stage', { stage: 'music', message: '启动 MiniMax Music 3 直连作曲进程…' });
    await scheduler.run('comfyui', async () => {
      emit('stage', { stage: 'music', message: 'MiniMax Music 3 开始编曲…' });
      let lastPhase = '';
      await minimax.compose(
        {
          caption: song.caption,
          lyrics: song.lyrics,
          seed,
          durationSec: dur,
          outPath: audioFile,
          params: config.comfyui
        },
        (p) => {
          if (p.phase && p.phase !== lastPhase) {
            lastPhase = p.phase;
            emit('stage', { stage: 'music', message: p.phase });
          }
          if (p.max > 0) {
            emit('progress', { phase: p.phase, value: p.value, max: p.max });
          }
        }
      );
    });
  }

  emit('stage', { stage: 'save', message: '保存并缓存音频…' });
  const buf = fs.readFileSync(audioFile);

  const record = store.put(key, {
    words: cleanWords,
    sentence,
    style,
    durationSec: dur,
    seed,
    caption: song.caption,
    lyrics: song.lyrics,
    notes: song.notes,
    route,
    audioFile: path.basename(audioFile),
    bytes: buf.length,
    audioUrl: `/api/audio/${key}`
  });

  emit('done', { song: record, cached: false });
  return record;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // ---- 音频（支持 Range，浏览器边下边播） ----
    if (pathname.startsWith('/api/audio/')) {
      const id = decodeURIComponent(pathname.slice('/api/audio/'.length)).replace(/[^\w-]/g, '');
      const song = store.get(id);
      if (!song) return sendJson(res, 404, { error: '音频不存在' });
      store.touch(id);
      return serveAudio(req, res, store.audioPath(id));
    }

    // ---- 健康检查 ----
    if (pathname === '/api/health') {
      const [cf, vramCf, lmLoaded] = await Promise.all([
        comfyui.probe(),
        comfyui.vramFreeGiB(),
        lmstudio.loadedModels()
      ]);
      // ComfyUI 服务器下线时（直连模式常态），用 nvidia-smi 兜底查显存
      const vram = vramCf !== null ? vramCf : nvidiaFreeVramGiB();
      return sendJson(res, 200, {
        ok: true,
        minimax: readiness(),
        comfyui: { up: cf, baseUrl: config.comfyui.baseUrl },
        lmstudio: { up: Array.isArray(lmLoaded), loaded: lmLoaded.map((m) => m.key) },
        gpu: {
          holder: scheduler.state.holder,
          vramFreeGiB: vram === null ? null : Number(vram.toFixed(2))
        },
        cache: {
          songs: store.list().length,
          bytes: store.bytes()
        },
        version: '1.0.0'
      });
    }

    // ---- 统一翻译代理（前端不再直连 LMStudio） ----
    if (pathname === '/api/translate' && req.method === 'POST') {
      const body = await readBody(req, 512 * 1024);
      // body 期望为 OpenAI 兼容的 chat completions 请求体，直接透传给 LMStudio
      // 若 LMStudio 繁忙或显存紧张，由调度器按需腾挪（与作曲互斥时自动卸载/重载）
      try {
        const lmUrl = `${config.lmstudio.baseUrl}/v1/chat/completions`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 120000);
        const r = await fetch(lmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal
        });
        clearTimeout(t);
        const text = await r.text();
        res.writeHead(r.status, {
          'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        return res.end(text);
      } catch (err) {
        return sendJson(res, 502, { error: `LMStudio 代理失败: ${err.message}` });
      }
    }

    // 兼容旧路径：前端历史直连 LMStudio 的 /v1/chat/completions 也经统一层代理
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      const body = await readBody(req, 512 * 1024);
      try {
        const lmUrl = `${config.lmstudio.baseUrl}/v1/chat/completions`;
        const r = await fetch(lmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120000)
        });
        const text = await r.text();
        res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(text);
      } catch (err) {
        return sendJson(res, 502, { error: `LMStudio 代理失败: ${err.message}` });
      }
    }

    // ---- 歌曲列表 ----
    if (pathname === '/api/songs' && req.method === 'GET') {
      return sendJson(res, 200, { songs: store.list() });
    }

    if (pathname.startsWith('/api/songs/') && req.method === 'GET') {
      const id = decodeURIComponent(pathname.slice('/api/songs/'.length)).replace(/[^\w-]/g, '');
      const song = store.get(id);
      if (!song) return sendJson(res, 404, { error: '未找到' });
      return sendJson(res, 200, { song });
    }

    if (pathname.startsWith('/api/songs/') && req.method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/songs/'.length)).replace(/[^\w-]/g, '');
      const ok = store.remove(id);
      return sendJson(res, 200, { removed: ok });
    }

    if (pathname === '/api/cache' && req.method === 'DELETE') {
      store.clear();
      return sendJson(res, 200, { cleared: true });
    }

    // ---- 生成歌曲（SSE） ----
    if (pathname === '/api/song' && req.method === 'POST') {
      const body = await readBody(req);
      return handleSongSse(req, res, body);
    }

    // ---- 手动释放 GPU ----
    if (pathname === '/api/gpu/free' && req.method === 'POST') {
      const freed = [];
      try {
        await comfyui.freeMemory();
        freed.push('comfyui');
      } catch (_) {}
      const unloaded = await lmstudio.unloadAll();
      if (unloaded.length) freed.push(`lmstudio:${unloaded.join(',')}`);
      return sendJson(res, 200, { freed });
    }

    // ---- 静态页（可选的自检页面） ----
    if (pathname === '/' || pathname === '/index.html') {
      const file = path.join(ROOT, 'public', 'index.html');
      if (fs.existsSync(file)) {
        const html = fs.readFileSync(file, 'utf8');
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        return res.end(html);
      }
    }

    sendJson(res, 404, { error: '未知接口', path: pathname });
  } catch (err) {
    log('请求处理失败：', err);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

function handleSongSse(req, res, body) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': song-bridge ready\n\n');

  let closed = false;
  const emit = (event, data) => {
    if (closed) return;
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {
      closed = true;
    }
  };
  const heartbeat = setInterval(() => {
    if (!closed) {
      try {
        res.write(': ping\n\n');
      } catch (_) {
        closed = true;
      }
    }
  }, 15000);

  req.on('close', () => {
    closed = true;
    clearInterval(heartbeat);
  });

  generateSong(body, emit)
    .catch((err) => {
      log('生成失败：', err);
      if (!closed) emit('error', { message: err.message || String(err) });
    })
    .finally(() => {
      clearInterval(heartbeat);
      if (!closed) {
        try {
          res.end();
        } catch (_) {}
      }
    });
}

/** 支持 Range 的音频传输，浏览器可以边下边播、也能拖动进度条 */
function serveAudio(req, res, file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (_) {
    return sendJson(res, 404, { error: '音频文件不存在' });
  }
  const size = stat.size;
  const range = req.headers.range;
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'audio/mpeg';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  if (!range) {
    res.writeHead(200, { 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
    return;
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    return res.end();
  }
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (Number.isNaN(start) || start < 0) start = 0;
  if (Number.isNaN(end) || end > size - 1) end = size - 1;
  if (start > end) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    return res.end();
  }

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': end - start + 1
  });
  fs.createReadStream(file, { start, end }).pipe(res);
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

const PORT = Number(config.port);
server.listen(PORT, config.host, () => {
  log(`监听 http://${config.host}:${PORT}`);
  log(`  ComfyUI   : ${config.comfyui.baseUrl} (MiniMax Music 3)`);
  log(`  LM Studio : ${config.lmstudio.baseUrl} (翻译保留)`);
  log(`  缓存目录  : ${config.cacheDir}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => log('未捕获异常：', err));

async function shutdown() {
  log('正在关闭…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

module.exports = { server, config };
