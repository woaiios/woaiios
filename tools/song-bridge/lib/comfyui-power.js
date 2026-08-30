'use strict';

/**
 * ComfyUI 电源管理 —— 按需启动，用完即停
 * -----------------------------------------------------------------------------
 * ComfyUI 十分耗费 CPU 内存与 GPU 显存，平时不运行。
 *   - ensureUp()：作曲前调用；未运行时直接拉起 standalone 后端（venv python + main.py），
 *     不走 Electron 桌面应用（它需要人工点启动按钮，无法自动化）
 *   - begin()/end()：跟踪进行中的作曲任务；全部结束后延迟 graceMs 自动关机
 *   - stop()：杀掉监听 8188 的后端进程（无论谁启动的），释放 CPU/GPU 内存
 *
 * 用户点「生成歌曲」与 E2E/门禁测试走同一条路径（都经 song-bridge /api/song），
 * 因此两边的资源回收行为一致：用完就停。
 */

const { spawn, execFileSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { sleep } = require('./util');

/** ComfyUI Desktop 的 standalone 安装目录（含 venv 与 ComfyUI 源码） */
const INSTALL_DIR =
  process.env.COMFY_INSTALL_DIR ||
  'C:\\Users\\Administrator\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Installs\\ComfyUI';
const VENV_PYTHON = path.join(INSTALL_DIR, 'ComfyUI', '.venv', 'Scripts', 'python.exe');
const MAIN_PY = path.join(INSTALL_DIR, 'ComfyUI', 'main.py');
const BACKEND_LOG = path.join(__dirname, '..', 'logs', 'comfyui-backend.log');
const PORT = 8188;

function isPortListening(port, host = '127.0.0.1', timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok) => {
      try { sock.destroy(); } catch (_) {}
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
    sock.connect(port, host);
  });
}

/** 找到监听指定端口的进程 PID（netstat -ano） */
function pidListeningOn(port) {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    const re = new RegExp(`^\\S+\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'im');
    for (const line of out.split('\n')) {
      if (!line.includes(`:${port} `)) continue;
      const m = re.exec(line);
      if (m) return Number(m[1]);
    }
  } catch (_) {}
  return null;
}

class ComfyUiPower {
  /**
   * @param {object} opts
   * @param {object} opts.comfyui  ComfyUI 客户端（需 probe()）
   * @param {(msg: string) => void} [opts.log]
   * @param {number} [opts.graceMs] 全部任务结束后多久关机（默认 60s，给连续生成留窗口）
   */
  constructor({ comfyui, log = console.log, graceMs = 60000 }) {
    this.comfyui = comfyui;
    this.log = log;
    this.graceMs = graceMs;
    this._active = 0;
    this._stopTimer = null;
    this._child = null;
  }

  /**
   * 确保 ComfyUI 后端在运行；未运行则直接拉起（venv python main.py，约 20-40s 就绪）。
   * @returns {Promise<boolean>} 是否由本次调用启动
   */
  async ensureUp({ waitMs = 150000 } = {}) {
    if (await this.comfyui.probe()) return false;

    if (!fs.existsSync(VENV_PYTHON) || !fs.existsSync(MAIN_PY)) {
      throw new Error(`找不到 ComfyUI standalone 环境：${INSTALL_DIR}（请先安装 ComfyUI Desktop）`);
    }

    this.log('[power] ComfyUI 未运行，直接启动 standalone 后端…');
    const t0 = Date.now();
    try {
      fs.mkdirSync(path.dirname(BACKEND_LOG), { recursive: true });
      const out = fs.openSync(BACKEND_LOG, 'a');
      this._child = spawn(
        VENV_PYTHON,
        [MAIN_PY, '--enable-manager', '--port', String(PORT)],
        {
          cwd: path.join(INSTALL_DIR, 'ComfyUI'),
          detached: true,
          windowsHide: true,
          stdio: ['ignore', out, out]
        }
      );
      this._child.unref();
    } catch (err) {
      throw new Error(`无法启动 ComfyUI 后端：${err.message}`);
    }

    while (Date.now() - t0 < waitMs) {
      await sleep(2000);
      if (await this.comfyui.probe()) {
        this.log(`[power] ComfyUI 已就绪（耗时 ${Math.round((Date.now() - t0) / 1000)}s）`);
        return true;
      }
      // 进程提前退出 = 启动失败，立即报错而不是傻等
      if (this._child && this._child.exitCode !== null) {
        const tail = fs.existsSync(BACKEND_LOG) ? fs.readFileSync(BACKEND_LOG, 'utf8').slice(-500) : '';
        throw new Error(`ComfyUI 后端启动即退出（code=${this._child.exitCode}）：${tail}`);
      }
    }
    throw new Error(`ComfyUI 后端在 ${waitMs}ms 内未就绪（端口 ${PORT} 无响应），日志：${BACKEND_LOG}`);
  }

  /** 一个作曲任务开始（取消待执行的关机） */
  begin() {
    this._active += 1;
    if (this._stopTimer) {
      clearTimeout(this._stopTimer);
      this._stopTimer = null;
      this.log('[power] 新任务到来，取消自动关机');
    }
  }

  /** 一个作曲任务结束；全部结束后延迟 graceMs 关机 */
  end() {
    this._active = Math.max(0, this._active - 1);
    if (this._active > 0) return;
    if (this._stopTimer) clearTimeout(this._stopTimer);
    this.log(`[power] 任务全部结束，${Math.round(this.graceMs / 1000)}s 后自动关闭 ComfyUI 释放内存`);
    this._stopTimer = setTimeout(() => {
      this._stopTimer = null;
      this.stop();
    }, this.graceMs);
    this._stopTimer.unref?.();
  }

  /** 关闭 ComfyUI 后端（杀监听 8188 的进程树），释放 CPU/GPU 内存 */
  stop() {
    if (this._stopTimer) {
      clearTimeout(this._stopTimer);
      this._stopTimer = null;
    }
    const pid = pidListeningOn(PORT);
    if (!pid) {
      this.log('[power] ComfyUI 未在运行，无需停止');
      return;
    }
    try {
      execFileSync('taskkill', ['/F', '/PID', String(pid), '/T'], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 15000
      });
      this.log(`[power] ComfyUI 后端已关闭（pid=${pid}，CPU/GPU 内存已释放）`);
    } catch (err) {
      this.log(`[power] 关闭 ComfyUI 失败：${err.message}`);
    }
    this._child = null;
  }
}

module.exports = { ComfyUiPower, VENV_PYTHON, MAIN_PY };
