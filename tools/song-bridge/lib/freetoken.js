'use strict';

/**
 * FreeToken 推理服务封装
 * -----------------------------------------------------------------------------
 * 负责 Qwen3.8-27B-NVFP4 的按需启动、健康探测、空闲卸载和流式对话。
 *
 * 本机 RTX 5090 是 sm_120 架构，torch._scaled_mm 的 rowwise scaling 不被支持，
 * 直接启动会在 CUDA graph 捕获阶段抛
 *   "Rowwise scaling is not currently supported on your device"
 * 必须带 FREETOKEN_FORCE_E4M3_EMU=1 走 triton 模拟路径（见 config.freetoken.env）。
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sleep, ensureDir, fetchRaw } = require('./util');

class FreeToken {
  constructor(config, log = console.log) {
    this.cfg = config.freetoken;
    this.log = log;
    this.child = null;
    this.booting = null;
    this.stopping = null;
  }

  isRunning() {
    return !!(this.child && this.child.exitCode === null && !this.child.killed);
  }

  /** 端口上有人在服务（可能是我们自己起的，也可能是 FreeToken Desktop GUI 起的） */
  async isServing() {
    if (this.isRunning()) return true;
    const p = await this.probe();
    return !!p.up;
  }

  /** 只探测端口，不管是谁起的（用户可能用 FreeToken Desktop 手动启动过） */
  async probe() {
    try {
      const res = await fetchRaw(`${this.cfg.baseUrl}/health`, { timeoutMs: 3000 });
      const json = await res.json();
      return { up: true, status: json.status, phase: json.phase, model: json.model };
    } catch (_) {
      return { up: false };
    }
  }

  async ready() {
    const p = await this.probe();
    return p.up && p.status === 'ok';
  }

  /**
   * 确保服务可用；没起就拉起并等待 ready
   * @param {(msg: string) => void} onProgress
   */
  async ensureReady(onProgress = () => {}) {
    if (await this.ready()) return;

    // 别人已经起了一个（比如 Desktop GUI），那就等着它好
    const p = await this.probe();
    if (p.up && !this.isRunning()) {
      onProgress('检测到已存在的 FreeToken 服务，等待就绪…');
      await this._waitReady(onProgress);
      return;
    }

    if (this.booting) return this.booting;

    this.booting = this._start(onProgress).finally(() => {
      this.booting = null;
    });
    return this.booting;
  }

  async _start(onProgress) {
    const cfg = this.cfg;
    if (!fs.existsSync(cfg.ftExe)) {
      throw new Error(`找不到 FreeToken 可执行文件：${cfg.ftExe}`);
    }
    if (!fs.existsSync(cfg.modelPath)) {
      throw new Error(`找不到模型目录：${cfg.modelPath}`);
    }

    ensureDir(this.cfg.logFile ? path.dirname(this.cfg.logFile) : path.join(__dirname, '..', 'logs'));

    // 关键：切断 WorkBuddy 注入的 PYTHONPATH，否则 triton 编译后清理临时目录会
    // 被 sitecustomize 劫持的 os.removedirs 拦下，抛 safe-delete 异常。
    const env = { ...process.env };
    delete env.PYTHONPATH;
    Object.assign(env, cfg.env || {});

    const args = [
      'serve',
      '--model-path', cfg.modelPath,
      '--host', cfg.host,
      '--port', String(cfg.port),
      '--memory-ratio', String(cfg.memoryRatio),
      '--max-running-requests', String(cfg.maxRunningRequests),
      '--served-model-name', cfg.servedModelName,
      '--tool-call-parser', 'qwen3_coder',
      '--reasoning-parser', 'qwen3',
      '--cors-origins', '*'
    ];

    this.log(`[freetoken] 启动：${cfg.ftExe} ${args.join(' ')}`);
    onProgress('正在加载 27B 模型到显存（首次约 40-60 秒）…');

    const child = spawn(cfg.ftExe, args, {
      env,
      cwd: path.dirname(cfg.ftExe),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false
    });
    this.child = child;

    const logStream = fs.createWriteStream(
      this.cfg.logFile || path.join(__dirname, '..', 'logs', `freetoken-${cfg.port}.log`),
      { flags: 'a' }
    );
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('exit', (code, signal) => {
      this.log(`[freetoken] 进程退出 code=${code} signal=${signal}`);
      logStream.end();
      this.child = null;
    });
    child.on('error', (err) => {
      this.log(`[freetoken] 进程错误：${err.message}`);
      this.child = null;
    });

    await this._waitReady(onProgress);
  }

  async _waitReady(onProgress) {
    const deadline = Date.now() + (this.cfg.bootTimeoutMs || 300000);
    let lastPhase = '';
    while (Date.now() < deadline) {
      const p = await this.probe();
      if (p.up && p.status === 'ok') {
        onProgress('模型已就绪');
        return;
      }
      if (p.up && p.phase && p.phase !== lastPhase) {
        lastPhase = p.phase;
        onProgress(`模型加载中（${p.phase}）…`);
      }
      await sleep(1500);
    }
    throw new Error('FreeToken 启动超时，请检查 logs/freetoken-*.log');
  }

  /** 停掉服务，把显存还回去（自己起的杀树，别人起的按端口找） */
  async stop() {
    if (this.stopping) return this.stopping;
    this.stopping = (async () => {
      let pid = null;

      if (this.child && this.child.exitCode === null) {
        pid = this.child.pid;
        this.child.kill();
      } else {
        const p = await this.probe();
        if (!p.up) return;
        pid = await findPidListeningOn(this.cfg.port);
        // 只杀确认是 FreeToken 的进程，避免误伤占用同端口的其他程序
        if (pid && !(await isFreeTokenProcess(pid))) {
          this.log(`[freetoken] 端口 ${this.cfg.port} 被非 FreeToken 进程占用（pid=${pid}），跳过卸载`);
          return;
        }
      }

      if (!pid) return;
      this.log(`[freetoken] 停止服务 pid=${pid}`);
      // ft serve 会 fork 出 scheduler / tokenizer 子进程，Windows 上必须杀整棵树
      await taskkillTree(pid);

      // 等端口彻底释放
      for (let i = 0; i < 60; i++) {
        const p = await this.probe();
        if (!p.up) break;
        await sleep(500);
      }
      this.child = null;
    })().finally(() => {
      this.stopping = null;
    });
    return this.stopping;
  }

  /**
   * 流式对话。onDelta 会收到 {type:'reasoning'|'content', text}
   */
  async chat({ messages, maxTokens = 2048, temperature, topP, reasoningEffort, onDelta, signal }) {
    const s = this.cfg.sampling || {};
    const body = {
      model: this.cfg.model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature: temperature ?? s.temperature ?? 0.85,
      top_p: topP ?? s.top_p ?? 0.95
    };
    if (reasoningEffort ?? s.reasoningEffort) {
      body.reasoning_effort = reasoningEffort ?? s.reasoningEffort;
    }

    const res = await fetchRaw(`${this.cfg.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 0
    });

    const { parseSse } = require('./util');
    let content = '';
    let reasoning = '';
    let finishReason = null;

    for await (const evt of parseSse(res.body)) {
      const d = evt.data;
      if (d && d.done) break;
      const choice = d && d.choices && d.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        onDelta?.({ type: 'reasoning', text: delta.reasoning_content });
      }
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        onDelta?.({ type: 'content', text: delta.content });
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    return { content, reasoning, finishReason };
  }
}

function run(cmd, args) {
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    const p = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', () => resolve({ code: -1, out: '', err }));
    p.on('exit', (code) => resolve({ code, out, err }));
  });
}

function taskkillTree(pid) {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const p = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    p.on('exit', resolve);
    p.on('error', resolve);
  });
}

/** 找出监听某个 TCP 端口的进程 PID */
async function findPidListeningOn(port) {
  const { out } = await run('netstat', ['-ano', '-p', 'TCP']);
  for (const line of out.split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const [proto, localAddr, , state, pid] = cols;
    if (proto !== 'TCP') continue;
    if (state && !/LISTENING/i.test(state)) continue;
    const m = /:(\d+)$/.exec(localAddr || '');
    if (!m || Number(m[1]) !== Number(port)) continue;
    const n = Number(pid);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** 确认某个 PID 是不是 FreeToken 相关进程 */
async function isFreeTokenProcess(pid) {
  const { out } = await run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`
  ]);
  const cmd = (out || '').toLowerCase();
  if (!cmd) return false;
  return cmd.includes('freetoken') || cmd.includes('ft.exe');
}

module.exports = { FreeToken };
