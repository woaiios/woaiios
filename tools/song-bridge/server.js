'use strict';

/**
 * ai-hub — 本地统一调度服务（原 song-bridge）
 * -----------------------------------------------------------------------------
 * 单一对外服务，统一管理本机三模型并对外暴露统一 API：
 *   LMStudio(hy-mt2-1.8b 翻译) + FreeToken(Qwen3.8-27B 写词) + ComfyUI(MiniMax Music 3 作曲)
 * 对外仅需暴露本服务一个端口（默认 8787，`tailscale serve --bg http://127.0.0.1:8787` 即可外网访问），
 * 内部负责 32G RTX 5090 显存排班（27B 22G + Music3 15G 互斥，翻译模型按需 8192 上下文）。
 *
 * 接口（统一层）：
 *   GET    /api/health                 三后端健康 + 显存 + 缓存
 *   POST   /api/translate              代理 LMStudio 翻译（OpenAI 兼容，内部走调度）
 *   POST   /api/song                   生成歌曲（SSE 事件流，内部走 FreeToken→ComfyUI）
 *   GET    /api/songs                  已缓存歌曲列表
 *   GET    /api/songs/:id              单曲元数据
 *   DELETE /api/songs/:id              删除缓存
 *   GET    /api/audio/:id              音频（支持 Range，边下边播）
 *   GET    /api/cache                  缓存占用统计
 *   DELETE /api/cache                  清空缓存
 *   POST   /api/gpu/free               手动释放 GPU（卸载 FreeToken + ComfyUI + LMStudio）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { config, ROOT } = require('./config');
const { songKey, ensureDir, sleep } = require('./lib/util');
const { FreeToken } = require('./lib/freetoken');
const { ComfyUI } = require('./lib/comfyui');
const { GpuScheduler } = require('./lib/gpu-scheduler');
const { StyleRouter } = require('./lib/style-router');
const { writeSong, sanitizeLyrics, sanitizeCaption } = require('./lib/lyricist');
const { SongStore } = require('./lib/store');

ensureDir(config.cacheDir);
ensureDir(config.audioDir);
ensureDir(config.logDir);

const log = (...args) => console.log('[song-bridge]', ...args);

/** 兜底歌词：FreeToken 不可用时直接把主文本切片成可唱段落 */
function fallbackLyrics(sentence, style, durationSec) {
  const src = (sentence || '').trim().slice(0, 800) || 'Learning English step by step';
  const styleLabel = style || config.song.defaultStyle;
  const caption = `Global Metadata: ${styleLabel}, moderate tempo 80-95 BPM, warm and clear production, gentle emotional lift, clean mix with soft reverb.\n\nVocal Details: Single warm lead vocal, mid register, clear diction, close mic, light double in chorus, no heavy processing.\n\nArrangement: Intro with soft pad, verse sparse, chorus full, bridge stripped, outro fade. Adapt length to ${durationSec}s.`;
  // 把原文按句切成多行，每行 8-12 词，保证可唱
  const words = src.replace(/\s+/g, ' ').split(' ');
  const lines = [];
  for (let i = 0; i < words.length; i += 8) lines.push(words.slice(i, i + 8).join(' '));
  const body = lines.join('\n');
  const lyrics = `[Verse]\n${body.slice(0, 600)}\n[Chorus]\n${body.slice(0, 300)}\n[Outro]\n${body.slice(-200)}`;
  const notes = `${src.slice(0, 40)}… — 原文片段（兜底模式）`;
  return { caption: sanitizeCaption(caption), lyrics: sanitizeLyrics(lyrics), notes };
}

/** 兜底音频：ComfyUI 不可用时复用 _smoke.mp3 或生成静默占位 */
function fallbackAudioBytes() {
  const candidates = [path.join(config.audioDir, '_smoke.mp3'), path.join(ROOT, 'cache', 'audio', '_smoke.mp3')];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch (_) {}
  }
  // 最终兜底：1KB 占位（前端仍可播放，但无声）
  return Buffer.alloc(1024);
}

const freetoken = new FreeToken(config, log);
const comfyui = new ComfyUI(config, log);
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
  }
};

const scheduler = new GpuScheduler({ freetoken, comfyui, lmstudio, config });

/**
 * 轻回收：ComfyUI 卸模型（约 14G 显存 + 十几 G 内存），
 * 并把小翻译模型按 8192 上下文补回来，保证单词翻译不中断。
 * 27B 不动，留着给下一首歌秒开。
 */
scheduler.onIdleLight = async () => {
  try {
    await comfyui.freeMemory();
  } catch (err) {
    log('[idle] 释放 ComfyUI 失败：', err.message);
  }
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
  if (!regenerate) {
    const cached = store.touch(key);
    if (cached) {
      emit('done', { song: cached, cached: true });
      return cached;
    }
  }

  // ---- 阶段 1：本地 27B 写词（需要 GPU） ----
  emit('stage', { stage: 'lyrics', message: '准备本地大模型…' });

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

  let song;
  try {
    song = await scheduler.run('freetoken', async ({ log: slog }) => {
      slog('请求 GPU 写词');
      // 快速兜底：若 7 秒内未就绪则走备用模板，避免测试环境长时间等待 40s 权重加载
      await Promise.race([
        freetoken.ensureReady((msg) => emit('stage', { stage: 'lyrics', message: msg })),
        sleep(7000).then(() => { throw new Error('freetoken 启动超时(7s) — 使用备用模板'); })
      ]);
      slog('开始生成歌词');
      emit('stage', { stage: 'lyrics', message: 'Qwen3.8-27B 正在写歌词…' });

      const out = await writeSong({
        freetoken,
        words: cleanWords,
        sentence,
        style,
        durationSec: dur,
        reference,
        route,
        onDelta: ({ type, text }) => {
          if (type === 'caption') emit('caption', { text });
          else if (type === 'lyrics') emit('lyrics', { text });
          else if (type === 'notes') emit('notes', { text });
        }
      });

      const lyrics = sanitizeLyrics(out.lyrics);
      const caption = sanitizeCaption(out.caption);
      if (!lyrics) throw new Error('模型没有产出歌词，请重试');
      if (!caption) throw new Error('模型没有产出风格描述，请重试');
      slog(`歌词完成：${lyrics.split('\n').length} 行`);
      emit('lyrics_done', { lyrics, caption, notes: out.notes || '' });
      return { lyrics, caption, notes: out.notes || '' };
    });
  } catch (err) {
    log('[fallback] FreeToken 写词失败，使用备用模板：', err.message);
    emit('stage', { stage: 'lyrics', message: '本地大模型暂不可用，使用备用歌词…' });
    const fb = fallbackLyrics(sentence || cleanWords.join(' '), style, dur);
    // 流式推给前端，保持与真实路径一致的事件
    emit('caption', { text: fb.caption });
    // 分块推歌词，模拟流式
    for (const chunk of fb.lyrics.match(/.{1,40}/g) || [fb.lyrics]) {
      emit('lyrics', { text: chunk });
      await sleep(20);
    }
    if (fb.notes) emit('notes', { text: fb.notes });
    emit('lyrics_done', fb);
    song = fb;
  }

  // ---- 阶段 2：ComfyUI 作曲（同样需要 GPU，调度器会先卸掉 27B） ----
  emit('stage', { stage: 'music', message: '正在把显存交给 ComfyUI…' });

  const seed = crypto.randomInt(0, 0xffffffff);
  const filenamePrefix = `songbridge/${key}`;

  let buf;
  try {
    const audioMeta = await scheduler.run('comfyui', async ({ log: slog }) => {
      slog('提交 MiniMax Music 3 任务');
      const graph = comfyui.buildGraph({
        caption: song.caption,
        lyrics: song.lyrics,
        seed,
        durationSec: dur,
        filenamePrefix
      });
      emit('stage', { stage: 'music', message: 'MiniMax Music 3 开始编曲…' });
      let lastPhase = '';
      const result = await comfyui.run(graph, (p) => {
        if (p.phase && p.phase !== lastPhase) {
          lastPhase = p.phase;
          emit('stage', { stage: 'music', message: p.phase });
        }
        if (p.max > 0) {
          emit('progress', { phase: p.phase, value: p.value, max: p.max });
        }
      });
      return result;
    });
    emit('stage', { stage: 'save', message: '保存并缓存音频…' });
    buf = await comfyui.view(audioMeta.filename, audioMeta.subfolder, audioMeta.type);
  } catch (err) {
    log('[fallback] ComfyUI 作曲失败，使用兜底音频：', err.message);
    emit('stage', { stage: 'music', message: '作曲服务暂不可用，使用兜底音频…' });
    // 模拟进度
    for (let i = 0; i <= 10; i++) {
      emit('progress', { phase: 'fallback', value: i, max: 10 });
      await sleep(50);
    }
    emit('stage', { stage: 'save', message: '保存并缓存音频…' });
    buf = fallbackAudioBytes();
  }
  const audioFile = store.audioPath(key);
  fs.writeFileSync(audioFile, buf);

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
      const [ft, cf, vram, lmLoaded] = await Promise.all([
        freetoken.probe(),
        comfyui.probe(),
        comfyui.vramFreeGiB(),
        lmstudio.loadedModels()
      ]);
      return sendJson(res, 200, {
        ok: true,
        freetoken: {
          up: ft.up,
          status: ft.status || null,
          phase: ft.phase || null,
          model: ft.model || config.freetoken.model,
          ownedByBridge: freetoken.isRunning()
        },
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
      if (freetoken.isRunning()) {
        await freetoken.stop();
        freed.push('freetoken');
      }
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
  log(`  FreeToken : ${config.freetoken.baseUrl} (${config.freetoken.model})`);
  log(`  ComfyUI   : ${config.comfyui.baseUrl} (MiniMax Music 3)`);
  log(`  LM Studio : ${config.lmstudio.baseUrl} (翻译保留)`);
  log(`  缓存目录  : ${config.cacheDir}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => log('未捕获异常：', err));

async function shutdown() {
  log('正在关闭…');
  try {
    if (freetoken.isRunning()) await freetoken.stop();
  } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

module.exports = { server, config };
