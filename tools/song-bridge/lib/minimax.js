'use strict';

/**
 * MiniMax Music 3 直连作曲（不经过 ComfyUI 服务器）
 * -----------------------------------------------------------------------------
 * 每个任务 spawn 一个独立 Python 进程跑 minimax/compose.py，
 * 进程退出即释放全部 CPU/GPU 内存 —— 无需服务器生命周期管理。
 * stdout 的 "[progress] 阶段\t值\t总量" 行实时转发为进度回调。
 *
 * 显存协调：本机还有一个常驻的本地大模型（Unsloth Studio llama-server，占 ~19GB）。
 * 作曲前通过 studio API 自动卸载它并等显存腾出，任务结束后自动加载回来，
 * 用户无需手动停服（见 minimax/unsloth_ctl.py）。
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { nvidiaFreeVramGiB, sleep } = require('./util');

/** ComfyUI Desktop standalone 环境里的 venv python（含 torch） */
const VENV_PYTHON =
  process.env.COMFY_VENV_PYTHON ||
  'C:\\Users\\Administrator\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Installs\\ComfyUI\\ComfyUI\\.venv\\Scripts\\python.exe';

const COMPOSE_PY = path.join(__dirname, '..', 'minimax', 'compose.py');

/** Unsloth Studio 的 venv python（跑 unsloth_ctl.py 用） */
const UNSLOTH_PY =
  process.env.UNSLOTH_STUDIO_PYTHON ||
  'C:\\Users\\Administrator\\.unsloth\\studio\\unsloth_studio\\Scripts\\python.exe';
/** 本机自管理脚本（卸载/加载常驻本地模型）——刻意放在仓库外，属个人环境配置 */
const UNSLOTH_CTL =
  process.env.UNSLOTH_CTL_SCRIPT ||
  'C:\\Users\\Administrator\\.woaiios\\unsloth_ctl.py';

/** MiniMax Music 3 权重（与 compose.py 默认值一致） */
const MODELS_DIR =
  process.env.COMFY_MODELS_DIR ||
  'C:\\Users\\Administrator\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Shared\\models';
const MODEL_FILES = [
  path.join(MODELS_DIR, 'diffusion_models', 'minimax_music3_dit_fp16.safetensors'),
  path.join(MODELS_DIR, 'text_encoders', 'minimax_music3_text_encoder_pruned_int8_convrot.safetensors'),
  path.join(MODELS_DIR, 'vae', 'minimax_music3_dav.safetensors')
];

/** 直连作曲的就绪状态：venv python + compose.py + 三个权重是否齐全 */
function readiness() {
  const missing = [];
  if (!fs.existsSync(VENV_PYTHON)) missing.push('venv python');
  if (!fs.existsSync(COMPOSE_PY)) missing.push('compose.py');
  for (const f of MODEL_FILES) if (!fs.existsSync(f)) missing.push(f);
  return { ok: missing.length === 0, missing };
}

/** 跑一次 unsloth_ctl.py，解析其 JSON 输出 */
function ctl(log, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(UNSLOTH_PY, ['-X', 'utf8', UNSLOTH_CTL, ...args], { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d.toString('utf8')));
    child.stderr.on('data', (d) => (err += d.toString('utf8')));
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, json: null, err: 'unsloth studio 不可用' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let json = null;
      for (const line of out.split('\n')) {
        const t = line.trim();
        if (t.startsWith('{')) {
          try { json = JSON.parse(t); } catch (_) {}
        }
      }
      if (code !== 0) log(`[minimax] unsloth ctl ${args[0]} 失败：${err.slice(-300)}`.trim());
      resolve({ code, json, err });
    });
  });
}

const CHECK_MD = path.join(__dirname, '..', '..', '..', '.song-check.md');
const BRIDGE_LOG = path.join(__dirname, '..', '..', '..', '.song-bridge.log');

class MiniMax {
  constructor({ log = console.log } = {}) {
    this.log = log;
  }

  /**
   * 跑一次完整作曲（阻塞直到进程退出）
   * @param {object} opts
   * @param {string} opts.caption      风格/描述
   * @param {string} [opts.lyrics]     歌词
   * @param {number} opts.seed
   * @param {number} opts.durationSec  目标时长（秒），模型可提前结束
   * @param {string} opts.outPath      输出 mp3 绝对路径
   * @param {object} [opts.params]     steps/cfg/arCfg/topK/sampler/scheduler 覆盖
   * @param {(p: {phase: string, value: number, max: number}) => void} [onProgress]
   * @returns {Promise<{mp3: string}>}
   */
  compose(
    { caption, lyrics = '', seed, durationSec, outPath, params = {} },
    onProgress = () => {}
  ) {
    return new Promise(async (resolve, reject) => {
      // ---- 0. 让出显存：卸载常驻的本地大模型（如有）----
      let savedModel = null;
      if (!fs.existsSync(UNSLOTH_CTL)) {
        this.log('[minimax] 未找到自管理脚本（UNSLOTH_CTL_SCRIPT），跳过显存协调');
      } else {
        try {
          const st = await ctl(this.log, ['status'], 15000);
          if (st.code === 0 && st.json && st.json.model_identifier) {
            savedModel = st.json;
            this.log(`[minimax] 卸载本地模型让出显存：${st.json.active_model}`);
            onProgress({ phase: '释放本地模型', value: 1, max: 2 });
            await ctl(this.log, ['unload', st.json.model_identifier], 300000);
            const t0 = Date.now();
            while (Date.now() - t0 < 180000) {
              const free = nvidiaFreeVramGiB();
              if (free != null && free >= 16) break;
              await sleep(2000);
            }
            this.log(`[minimax] 显存已腾出（空闲 ${nvidiaFreeVramGiB()?.toFixed(1) ?? '?'} GiB）`);
          }
        } catch (e) {
          this.log(`[minimax] 显存协调失败（继续尝试）：${e.message}`);
        }
      }

      const args = [
        COMPOSE_PY,
        '--caption',
        caption,
        '--lyrics',
        lyrics,
        '--seed',
        String(seed),
        '--duration',
        String(durationSec),
        '--out',
        outPath
      ];
      if (params.steps) args.push('--steps', String(params.steps));
      if (params.cfg) args.push('--cfg', String(params.cfg));
      if (params.arCfg) args.push('--ar-cfg', String(params.arCfg));
      if (params.topK) args.push('--top-k', String(params.topK));
      if (params.sampler) args.push('--sampler', params.sampler);
      if (params.scheduler) args.push('--scheduler', params.scheduler);

      this.log(`[minimax] 启动作曲进程（seed=${seed}，目标 ${durationSec}s）`);
      // stderr 走文件而非管道：服务端快速运行（73 it/s）时 stderr 就是写文件的；
      // 管道若被 Node 事件循环的瞬时卡顿堵住，Python 会阻塞在写入上，AR 整体变慢。
      const errFile = path.join(__dirname, '..', 'logs', 'compose-stderr.log');
      fs.mkdirSync(path.dirname(errFile), { recursive: true });
      const errFd = fs.openSync(errFile, 'a');
      const child = spawn(VENV_PYTHON, ['-u', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', errFd] });

      let stdoutBuf = '';
      let settled = false;

      const stderrTail = () => {
        try {
          const buf = fs.readFileSync(errFile);
          return buf.slice(-500).toString('utf8');
        } catch (_) {
          return '';
        }
      };

      const finish = async (err, val) => {
        if (settled) return;
        settled = true;
        // ---- 恢复本地模型（无论成败，用户还要继续对话）----
        if (savedModel) {
          onProgress({ phase: '恢复本地模型', value: 2, max: 2 });
          this.log(`[minimax] 恢复本地模型：${savedModel.active_model}`);
          const ld = await ctl(
            this.log,
            ['load', savedModel.model_identifier, ...(savedModel.gguf_variant ? [savedModel.gguf_variant] : [])],
            900000
          );
          if (ld.code === 0) {
            this.log('[minimax] 本地模型已恢复');
          } else {
            this.log('[minimax] ⚠️ 本地模型恢复失败，需要手动重启 Unsloth/会话！');
          }
        }
        if (err) reject(err);
        else {
          // 自检不阻塞任务返回：歌曲已落盘，诊断异步追加到 .song-check.md
          this.selfCheck({ mp3: val.mp3, durationSec }).catch((e) => this.log(`[minimax] 自检异常：${e.message}`));
          resolve(val);
        }
      };

      child.stdout.on('data', (d) => {
        stdoutBuf += d.toString('utf8');
        let idx;
        while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
          const line = stdoutBuf.slice(0, idx).trim();
          stdoutBuf = stdoutBuf.slice(idx + 1);
          if (!line) continue;
          if (line.startsWith('[progress] ')) {
            const parts = line.slice(10).split('\t');
            onProgress({
              phase: parts[0],
              value: Number(parts[1]) || 0,
              max: Number(parts[2]) || 0
            });
          } else if (line.startsWith('[error]')) {
            this.log(line);
          } else {
            this.log(line.replace(/^\[compose\]\s*/, ''));
          }
        }
      });

      child.on('error', (e) => finish(e));
      child.on('close', (code) => {
        try { fs.closeSync(errFd); } catch (_) {}
        if (code === 0 && fs.existsSync(outPath)) {
          finish(null, { mp3: outPath, bytes: fs.statSync(outPath).size });
        } else {
          finish(
            new Error(
              `作曲进程退出 code=${code}：${stderrTail()} ${stdoutBuf.slice(-200)}`.trim()
            )
          );
        }
      });
    });
  }

  /**
   * 歌曲落盘后自检：从 bridge 日志提取本次运行的 AR 计时/分发探针数据，
   * 追加到 .song-check.md；发现异常（AR 速度低于 ~55 it/s）时调用本地模型
   * （studio /v1 API + agent key）做根因诊断并一并写入。
   */
  async selfCheck({ mp3, durationSec }) {
    let txt = '';
    try {
      txt = fs.readFileSync(BRIDGE_LOG, 'utf8');
    } catch (_) {}
    const pick = (re) => {
      const m = [...txt.matchAll(re)];
      return m.length ? m[m.length - 1][0].trim() : '';
    };
    const arLine = pick(/\[AR计时\].*/);
    const dispBench = pick(/\[分发\] 微基准.*/);
    const benchLine = pick(/微基准.*稳态均值.*/);
    const modeLine = pick(/^.*模式：highvram=.*/m);
    const backendsLine = pick(/kitchen backends:.*/);
    const vramLine = pick(/显存：已用.*/);

    const msTok = (arLine.match(/墙钟 (\d+) ms\/token/) || [])[1];
    const itS = msTok ? Math.round(1000 / Number(msTok)) : null;

    const anomalies = [];
    if (itS == null) anomalies.push('未取到 AR 计时数据');
    else if (itS < 55) anomalies.push(`AR 速度 ${itS} it/s（目标 ~73，墙钟 ${msTok} ms/token）`);

    const facts = [
      `## 自检 @ ${new Date().toISOString()}`,
      `歌曲：${path.basename(mp3)}（目标 ${durationSec}s）`,
      `AR 速度：${itS ?? '?'} it/s`,
      arLine && `计时行：${arLine}`,
      dispBench && dispBench,
      benchLine && benchLine,
      modeLine && modeLine,
      backendsLine && backendsLine,
      vramLine && vramLine
    ]
      .filter(Boolean)
      .join('\n');

    let report = facts;
    if (anomalies.length) {
      report += `\n\n异常：${anomalies.join('；')}\n（诊断由用户触发对话时进行，不自动调用模型）\n`;
    } else {
      report += '\n无异常\n';
    }
    fs.appendFileSync(CHECK_MD, report + '\n');
    this.log(
      anomalies.length
        ? `[minimax] 自检发现异常，详见 .song-check.md：${anomalies.join('；')}`
        : '[minimax] 自检通过（AR 速度正常）'
    );
  }
}

module.exports = { MiniMax, VENV_PYTHON, COMPOSE_PY, MODEL_FILES, readiness };
