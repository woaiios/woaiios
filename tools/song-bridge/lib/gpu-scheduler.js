'use strict';

/**
 * GPU 调度器
 * -----------------------------------------------------------------------------
 * 这台机器只有一张 RTX 5090（32GB），三个"吃显存"的角色抢同一块卡：
 *
 *   freetoken  Qwen3.8-27B-NVFP4  权重 18.8G + KV 2.7G  ≈ 22G
 *   comfyui    MiniMax Music 3    text encoder 9.2G + DiT 4.9G + VAE 0.2G ≈ 15G
 *   lmstudio   hy-mt2-1.8b        常驻的单词翻译模型 ≈ 2G
 *
 * 前两个加起来 37G > 32G，所以它们必须严格串行；翻译模型很小，默认保留，
 * 只有在显存确实不够时才临时卸载（LM Studio 会在下次翻译请求时自动重载）。
 *
 * 设计要点：
 * - 单把互斥锁 + FIFO 队列，同一时刻只有一个重任务在跑；
 * - 抢锁前先"清场"：卸掉另一个重角色的显存；
 * - FreeToken 有空闲 TTL，短时间内再来一首歌不用重新加载 18.8G 权重；
 * - LM Studio 只有在可用显存低于阈值时才动，避免无谓打断翻译功能。
 */

const os = require('os');
const { sleep } = require('./util');

const freeRamGiB = () => os.freemem() / 1024 ** 3;

class GpuScheduler {
  /**
   * @param {object} opts
   * @param {object} opts.freetoken  需要有 isRunning() / ensureReady() / stop()
   * @param {object} opts.comfyui    需要有 freeMemory() / isBusy() / vramFreeGiB()
   * @param {object} opts.lmstudio   需要有 unload() / loadedModels()
   * @param {object} opts.config
   */
  constructor({ freetoken, comfyui, lmstudio, config }) {
    this.freetoken = freetoken;
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
      freetokenRunning: this.freetoken ? this.freetoken.isRunning() : false,
      lastActivity: this._lastActivity
    };
  }

  /**
   * 以 owner 身份独占 GPU 执行任务
   * @param {'freetoken'|'comfyui'} owner
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

  /** 抢锁前把"别人"的显存腾出来 */
  async _evict(owner, log) {
    log = log || (() => {});
    const ft = this.freetoken;
    const cf = this.comfyui;
    const lm = this.lmstudio;

    if (owner === 'comfyui' && ft) {
      if (await ft.isServing()) {
        log('FreeToken 仍占着显存，先卸载 27B 模型…');
        await ft.stop();
        await sleep(2000); // 等 WDDM 把显存真正归还
      }
    }

    if (owner === 'freetoken' && cf) {
      try {
        if (await cf.isBusy()) {
          log('ComfyUI 队列里还有任务，等待其结束…');
          await cf.waitIdle(120000);
        }
        log('请求 ComfyUI 释放已加载模型…');
        await cf.freeMemory();
        await sleep(1000);
      } catch (err) {
        log(`ComfyUI 释放显存失败（继续尝试启动）：${err.message}`);
      }
    }

    // 资源紧张时才动 LM Studio 的翻译模型
    if (lm && this.config.lmstudio?.evictWhenTight) {
      try {
        const need = owner === 'freetoken' ? 24 : 17;
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
   * 两档空闲回收：
   *   轻回收（默认 3 分钟）— ComfyUI 卸载模型、翻译模型按小上下文补回来。
   *     ComfyUI 重新加载只要十几秒，早点还显存/内存很划算。
   *   深回收（默认 15 分钟）— 连 27B 一起卸掉。它加载一次要 60 秒，
   *     给一个更长的宽限期，避免下一首歌又要干等。
   */
  _touchIdle() {
    this._lastActivity = Date.now();

    if (this._lightTimer) clearTimeout(this._lightTimer);
    if (this._deepTimer) clearTimeout(this._deepTimer);

    const lightTtl = this.config.idle?.lightTtlMs ?? 3 * 60 * 1000;
    const deepTtl = this.config.freetoken?.idleTtlMs ?? 15 * 60 * 1000;

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

    if (!this.freetoken) return;
    this._deepTimer = setTimeout(async () => {
      if (this._holder) return;
      if (!(await this.freetoken.isServing())) return;
      console.log('[gpu] 长时间空闲，卸载 27B 模型释放显存');
      try {
        await this.freetoken.stop();
      } catch (err) {
        console.warn('[gpu] 卸载 FreeToken 失败：', err.message);
      }
    }, deepTtl);
    this._deepTimer.unref?.();
  }
}

module.exports = { GpuScheduler };
