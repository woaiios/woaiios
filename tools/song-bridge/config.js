'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = __dirname;

/** 允许用同目录下的 config.local.json 覆盖任意字段（该文件不进版本库） */
function loadLocalOverrides(base) {
  const p = path.join(ROOT, 'config.local.json');
  if (!fs.existsSync(p)) return base;
  try {
    const local = JSON.parse(fs.readFileSync(p, 'utf8'));
    return deepMerge(base, local);
  } catch (err) {
    console.warn('[config] config.local.json 解析失败，忽略：', err.message);
    return base;
  }
}

function deepMerge(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null
      ? deepMerge(out[k], v)
      : v;
  }
  return out;
}

const defaults = {
  host: '0.0.0.0', // 监听所有网卡，Tailscale 100.x / MagicDNS 才能连上；本机仍可用 127.0.0.1
  port: 8787,

  cacheDir: path.join(ROOT, 'cache'),
  audioDir: path.join(ROOT, 'cache', 'audio'),
  logDir: path.join(ROOT, 'logs'),

  // --- FreeToken：本地大模型推理服务，负责写歌词 ---
  freetoken: {
    enabled: true,
    ftHome: 'C:/Users/Administrator/AppData/Local/FreeToken',
    ftExe: 'C:/Users/Administrator/AppData/Local/FreeToken/venv/Scripts/ft.exe',
    modelPath: 'D:/Users/a/ai_models/Qwen3.8-27B-NVFP4',
    baseUrl: 'http://127.0.0.1:1919',
    model: 'Qwen3.8-27B-NVFP4',
    host: '127.0.0.1',
    port: 1919,
    memoryRatio: 0.85,
    maxRunningRequests: 4,
    servedModelName: 'Qwen3.8-27B-NVFP4',
    /** 启动后等待 ready 的超时（加载 18.8G 权重 + CUDA graph 约 40~60s） */
    bootTimeoutMs: 300000,
    /** 空闲多久后自动卸载 27B，把显存还给 ComfyUI（27B 重新加载要 60s，宽限给久一点） */
    idleTtlMs: 15 * 60 * 1000,
    /** RTX 5090 = sm_120，torch._scaled_mm 不支持 rowwise scaling，必须走模拟路径 */
    env: {
      FREETOKEN_FORCE_E4M3_EMU: '1',
      TRITON_CACHE_DIR: 'C:/Users/Administrator/AppData/Local/Temp/triton-e4m3emu',
      CC: 'C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/cl.exe'
    },
    sampling: {
      temperature: 0.85,
      top_p: 0.95,
      reasoningEffort: 'medium'
    }
  },

  // --- ComfyUI：MiniMax Music 3 作曲 ---
  comfyui: {
    baseUrl: 'http://127.0.0.1:8188',
    dit: 'minimax_music3_dit_fp16.safetensors',
    clip: 'minimax_music3_text_encoder_pruned_int8_convrot.safetensors',
    vae: 'minimax_music3_dav.safetensors',
    steps: 30,
    cfg: 1.7,
    sampler: 'euler',
    scheduler: 'simple',
    /** 长歌 / 显存紧张时开 tiled decode */
    tiledDecode: false,
    /** 提交任务后最长等待时间 */
    jobTimeoutMs: 900000
  },

  // --- LM Studio：保留给单词翻译，只在资源紧张时才动它 ---
  lmstudio: {
    baseUrl: 'http://127.0.0.1:1234',
    model: 'hy-mt2-1.8b',
    lmsPath: 'C:/Users/Administrator/.lmstudio/bin/lms.exe',
    /** 显存或内存不够时才卸载翻译模型（LM Studio 会在下次翻译时自动重载） */
    evictWhenTight: true,
    /** 低于这个可用显存(GiB)就视为紧张 */
    tightVramGiB: 14,
    /** 低于这个可用内存(GiB)就必须先腾地方。
     *  实测：hy-mt2-1.8b 以 262144 上下文常驻时会吃掉约 17GB 系统内存，
     *  整机只剩 1.6GB，ComfyUI 采样从 6.8 步/秒掉到 0.18 步/秒（慢 38 倍）。 */
    minFreeRamGiB: 8,
    /** 卸载后重新以这个上下文长度加载（单词释义用不到 26 万上下文） */
    reloadContextLength: 8192,
    /** 是否允许本服务调整 LM Studio 的加载参数 */
    manage: true
  },

  /** 空闲回收节奏 */
  idle: {
    /** 轻回收：只让 ComfyUI 卸模型 + 恢复翻译模型（ComfyUI 重载只要十几秒） */
    lightTtlMs: 3 * 60 * 1000
  },

  song: {
    /** 默认歌曲时长（秒）。学习用的小曲子，60s 左右够用也最快 */
    defaultDurationSec: 60,
    minDurationSec: 20,
    maxDurationSec: 300,
    defaultStyle: 'acoustic folk pop'
  },

  skill: {
    /** WorkBuddy 的 music-caption-rewriter 技能目录，用于检索风格参考模板 */
    dir: 'C:/Users/Administrator/.workbuddy/skills/music-caption-rewriter',
    enabled: true
  }
};

const config = loadLocalOverrides(defaults);

// 环境变量快捷覆盖
if (process.env.SONG_BRIDGE_PORT) config.port = Number(process.env.SONG_BRIDGE_PORT);
if (process.env.FREETOKEN_URL) config.freetoken.baseUrl = process.env.FREETOKEN_URL;
if (process.env.COMFYUI_URL) config.comfyui.baseUrl = process.env.COMFYUI_URL;

module.exports = { config, ROOT };
