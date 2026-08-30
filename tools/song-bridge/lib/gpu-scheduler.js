'use strict';

/**
 * GPU 调度器
 * -----------------------------------------------------------------------------
 * 这台机器只有一张 RTX 5090（32GB），两个"吃显存"的角色抢同一块卡：
 *
 *   comfyui    MiniMax Music 3    text encoder 9.2G + DiT 4.9G + VAE 0.2G ≈ 15G
 *   lmstudio   hy-mt2-1.8b        常驻的单词翻译模型 ≈ 2G
 *
 * 翻译模型很小，默认保留，只有在显存确实不够时才临时卸载（LM Studio 会在下次翻译请求时自动重载）。
 *
 * 设计要点：
 * - 单把互斥锁 + FIFO 队列，同一时刻只有一个重任务在跑；
 * - LM Studio 只有在可用显存低于阈值时才动，避免无谓打断翻译功能。
 */

const os = require('os');
const { sleep } = require('./util');

const freeRamGiB = () => os.freemem() / 1024 ** 3;

class GpuScheduler {
  /**
   * @param {object} opts
   * @param {object} opts.comfyui    需要有 freeMemory() / isBusy() / vramFreeGiB()
   * @param {object} opts.lmstudio   需要有 unload() / loadedModels()
   * @param {object} opts.config
   */
  constructor({ comfyui, lmstudio, config }) {
    this.comfyui = comfyui;
    this.lmstudio = lmstudio;
    this.config = config;

    this._chain = Promise.resolve();
    this._holder = null;
    this._queued = 0;
    this._idleTimer = null;
    this._lastActivity = Date.now();
  }

  get state() {
    return {
      holder: this._holder,
      queued: this._queued,
      lastActivity: this._lastActivity
    };
  }

  /**
   * 以 owner 身份独占 GPU 执行任务
   * @param {'comfyui'} owner
   * @param {(ctx: {log: (msg: string) => void}) => Promise<any>} fn
   */
  run(owner, fn) {
    const job = this._chain.then(
      () => this._execute(owner, fn),
      () => this._execute(owner, fn)
    );
    // 链上的 rejection 已经被消费，这里接住避免 unhandled rejection
    this._chain = job.then(
      () => undefined,
      () => undefined
    );
    return job;
  }

  async _execute(owner, fn) {
    this._queued = Math.max(0, this._queued - 1);
    let log = () => {};
    try {
      await this._evict(owner, (m) => log(m));
      this._holder = owner;
      log = (m) => this._emit(owner, m);
      const result = await fn({ log });
      this._touchIdle();
      return result;
    } finally {
      this._holder = null;
      this._touchIdle();
    }
  }

  _emit(owner, msg) {
    if (typeof msg === 'string' && msg) {
      console.log(`[gpu:${owner}] ${msg}`);
    }
  }

  /** 抢锁前把资源腾出来 */
  async _evict(owner, log) {
    log = log || (() => {});
    const cf = this.comfyui;
    const lm = this.lmstudio;

    // 资源紧张时才动 LM Studio 的翻译模型
    if (lm && this.config.lmstudio?.evictWhenTight) {
      try {
        const need = 17;
        const vram = await cf.vramFreeGiB();
        const ram = freeRamGiB();
        const tightVram = vram !== null && vram < Math.min(need, this.config.lmstudio.tightVramGiB);
        const tightRam = ram < (this.config.lmstudio.minFreeRamGiB || 8);

        if (tightVram || tightRam) {
          log(
            `资源紧张（显存 ${vram === null ? '?' : vram.toFixed(1)} GiB / 内存 ${ram.toFixed(1)} GiB），` +
              `临时卸载 LM Studio 翻译模型…`
          );
          await lm.unloadAll();
          await sleep(1500);
        }
      } catch (err) {
        log(`检查/卸载 LM Studio 失败（忽略）：${err.message}`);
      }
    }
  }

  /**
   * 空闲回收：轻回收（默认 3 分钟）— ComfyUI 卸载模型、翻译模型按小上下文补回来。
   */
  _touchIdle() {
    this._lastActivity = Date.now();

    if (this._lightTimer) clearTimeout(this._lightTimer);

    const lightTtl = this.config.idle?.lightTtlMs ?? 3 * 60 * 1000;

    this._lightTimer = setTimeout(async () => {
      if (this._holder) return;
      console.log('[gpu] 空闲，轻回收：释放 ComfyUI 模型 + 恢复翻译模型');
      try {
        await this.onIdleLight?.();
      } catch (err) {
        console.warn('[gpu] 轻回收失败：', err.message);
      }
    }, lightTtl);
    this._lightTimer.unref?.();
  }
}

module.exports = { GpuScheduler };
