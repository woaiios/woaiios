'use strict';

/**
 * ComfyUI 客户端（MiniMax Music 3 作曲）
 * -----------------------------------------------------------------------------
 * 提交 API 格式的 workflow，通过 WebSocket 监听执行进度，完成后把音频拉回本地缓存。
 */

const crypto = require('crypto');
const fs = require('fs');
const { fetchJson, fetchRaw, sleep } = require('./util');

class ComfyUI {
  constructor(config, log = console.log) {
    this.cfg = config.comfyui;
    this.log = log;
  }

  async systemStats() {
    return fetchJson(`${this.cfg.baseUrl}/system_stats`, { timeoutMs: 10000 });
  }

  async probe() {
    try {
      await this.systemStats();
      return true;
    } catch (_) {
      return false;
    }
  }

  /** 可用显存（GiB），取 torch 视角；失败返回 null */
  async vramFreeGiB() {
    try {
      const s = await this.systemStats();
      const dev = (s.devices || [])[0];
      if (dev && typeof dev.vram_free === 'number') return dev.vram_free / 1024 ** 3;
      return null;
    } catch (_) {
      return null;
    }
  }

  async queue() {
    return fetchJson(`${this.cfg.baseUrl}/queue`, { timeoutMs: 10000 });
  }

  async isBusy() {
    try {
      const q = await this.queue();
      return (q.queue_running || []).length > 0 || (q.queue_pending || []).length > 0;
    } catch (_) {
      return false;
    }
  }

  async waitIdle(timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await this.isBusy())) return true;
      await sleep(1000);
    }
    return !(await this.isBusy());
  }

  /** 让 ComfyUI 卸载模型并释放显存 */
  async freeMemory() {
    await fetchJson(`${this.cfg.baseUrl}/free`, {
      method: 'POST',
      body: { unload_models: true, free_memory: true },
      timeoutMs: 30000
    });
  }

  /**
   * 构造 MiniMax Music 3 的 API 格式工作流
   * 结构照抄 ComfyUI 官方模板 audio_minimax_music_3.json 的子图
   */
  buildGraph({ caption, lyrics, seed, durationSec, filenamePrefix }) {
    const c = this.cfg;
    const decodeNode = c.tiledDecode
      ? { class_type: 'VAEDecodeAudioTiled', inputs: { samples: ['7', 0], vae: ['3', 0], tile_size: 512, overlap: 64 } }
      : { class_type: 'VAEDecodeAudio', inputs: { samples: ['7', 0], vae: ['3', 0] } };

    return {
      1: {
        class_type: 'UNETLoader',
        inputs: { unet_name: c.dit, weight_dtype: 'default' }
      },
      2: {
        class_type: 'CLIPLoader',
        inputs: { clip_name: c.clip, type: 'minimax', device: 'default' }
      },
      3: {
        class_type: 'VAELoader',
        inputs: { vae_name: c.vae }
      },
      4: {
        class_type: 'MiniMaxMusic3TextEncode',
        inputs: {
          clip: ['2', 0],
          caption,
          lyrics,
          seed,
          max_duration: durationSec,
          cfg_scale: c.cfg,
          top_k: 50
        }
      },
      5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
      6: {
        class_type: 'EmptyMiniMaxMusic3LatentAudio',
        inputs: { seconds: ['4', 1], batch_size: 1 }
      },
      7: {
        class_type: 'KSampler',
        inputs: {
          model: ['1', 0],
          seed,
          steps: c.steps,
          cfg: c.cfg,
          sampler_name: c.sampler,
          scheduler: c.scheduler,
          positive: ['4', 0],
          negative: ['5', 0],
          latent_image: ['6', 0],
          denoise: 1.0
        }
      },
      8: decodeNode,
      9: {
        class_type: 'SaveAudioMP3',
        inputs: { audio: ['8', 0], filename_prefix: filenamePrefix, quality: 'V0' }
      }
    };
  }

  async submit(graph, clientId) {
    return fetchJson(`${this.cfg.baseUrl}/prompt`, {
      method: 'POST',
      body: { prompt: graph, client_id: clientId },
      timeoutMs: 30000
    });
  }

  /** 取回输出文件字节 */
  async view(filename, subfolder, type = 'output') {
    const url =
      `${this.cfg.baseUrl}/view?filename=${encodeURIComponent(filename)}` +
      `&subfolder=${encodeURIComponent(subfolder || '')}&type=${encodeURIComponent(type)}`;
    const res = await fetchRaw(url, { timeoutMs: 120000 });
    return Buffer.from(await res.arrayBuffer());
  }

  async history(promptId) {
    return fetchJson(`${this.cfg.baseUrl}/history/${promptId}`, { timeoutMs: 15000 });
  }

  /**
   * 提交并等待完成
   * @param {object} graph
   * @param {(p: {phase: string, value: number, max: number, node?: string}) => void} onProgress
   * @returns {Promise<{filename: string, subfolder: string, type: string}>}
   */
  async run(graph, onProgress = () => {}) {
    const clientId = crypto.randomUUID();
    const submitted = await this.submit(graph, clientId);
    const promptId = submitted.prompt_id;
    if (!promptId) throw new Error('ComfyUI 未返回 prompt_id：' + JSON.stringify(submitted).slice(0, 300));
    this.log(`[comfyui] 任务已提交 prompt_id=${promptId}`);

    return this.waitFor(promptId, clientId, onProgress);
  }

  async waitFor(promptId, clientId, onProgress) {
    const wsUrl = `${this.cfg.baseUrl.replace(/^http/, 'ws')}/ws?clientId=${encodeURIComponent(clientId)}`;
    let ws = null;
    try {
      ws = await this._openWs(wsUrl);
      return await this._waitViaWs(ws, promptId, onProgress);
    } catch (err) {
      this.log(`[comfyui] WebSocket 不可用（${err.message}），回退到 history 轮询`);
      return this._waitViaPolling(promptId, onProgress);
    } finally {
      try {
        ws?.close();
      } catch (_) {}
    }
  }

  _openWs(url) {
    return new Promise((resolve, reject) => {
      let socket;
      try {
        socket = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }
      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch (_) {}
        reject(new Error('WebSocket 连接超时'));
      }, 10000);
      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('WebSocket 连接失败'));
      });
    });
  }

  _waitViaWs(ws, promptId, onProgress) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + (this.cfg.jobTimeoutMs || 900000);
      let settled = false;
      let sawAnyMessage = false;

      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearInterval(heartbeat);
        fn(arg);
      };

      ws.addEventListener('message', (ev) => {
        let msg;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
        } catch (_) {
          return;
        }
        sawAnyMessage = true;
        const data = msg.data || {};

        if (msg.type === 'progress') {
          onProgress({
            phase: 'sampling',
            value: data.value || 0,
            max: data.max || 0,
            node: data.node
          });
          return;
        }

        if (msg.type === 'executing') {
          if (data.prompt_id && data.prompt_id !== promptId) return;
          if (data.node) {
            const label = NODE_LABELS[data.node] || `节点 ${data.node}`;
            onProgress({ phase: label, value: 0, max: 0, node: data.node });
          } else {
            // node 为 null 表示整个 prompt 执行结束
            finish(resolve);
          }
          return;
        }

        if (msg.type === 'executed') {
          if (data.prompt_id && data.prompt_id !== promptId) return;
          const out = data.output && data.output.audio;
          if (Array.isArray(out) && out.length) {
            finish(resolve, {
              filename: out[0].filename,
              subfolder: out[0].subfolder || '',
              type: out[0].type || 'output'
            });
          }
          return;
        }

        if (msg.type === 'execution_error') {
          const errMsg =
            data.exception_message || data.error || JSON.stringify(data).slice(0, 500);
          finish(reject, new Error(`ComfyUI 执行失败：${errMsg}`));
          return;
        }

        if (msg.type === 'execution_interrupted') {
          finish(reject, new Error('ComfyUI 任务被中断'));
        }
      });

      ws.addEventListener('error', () => {
        if (!settled) finish(reject, new Error('WebSocket 连接中断'));
      });
      ws.addEventListener('close', () => {
        if (!settled) finish(reject, new Error('WebSocket 提前关闭'));
      });

      // 兜底：WebSocket 一直没任何消息时切到轮询
      const heartbeat = setInterval(() => {
        if (Date.now() > deadline) {
          finish(reject, new Error('ComfyUI 任务超时'));
          return;
        }
        if (!sawAnyMessage) {
          finish(reject, new Error('WebSocket 无响应'));
        }
      }, 15000);
    });
  }

  async _waitViaPolling(promptId, onProgress) {
    const deadline = Date.now() + (this.cfg.jobTimeoutMs || 900000);
    let lastPhase = '';
    while (Date.now() < deadline) {
      const hist = await this.history(promptId).catch(() => null);
      const entry = hist && hist[promptId];
      if (entry) {
        const status = entry.status || {};
        if (status.completed) {
          const outputs = entry.outputs || {};
          for (const node of Object.values(outputs)) {
            if (Array.isArray(node.audio) && node.audio.length) {
              return {
                filename: node.audio[0].filename,
                subfolder: node.audio[0].subfolder || '',
                type: node.audio[0].type || 'output'
              };
            }
          }
          throw new Error('ComfyUI 已完成但没有音频输出');
        }
        if (status.status_str && status.status_str !== lastPhase) {
          lastPhase = status.status_str;
          onProgress({ phase: status.status_str, value: 0, max: 0 });
        }
      }
      await sleep(2000);
    }
    throw new Error('等待 ComfyUI 任务超时');
  }
}

const NODE_LABELS = {
  1: '加载扩散模型',
  2: '加载文本编码器',
  3: '加载音频 VAE',
  4: '编码歌词与风格',
  5: '准备负向条件',
  6: '创建空音频潜变量',
  7: '采样生成',
  8: 'VAE 解码',
  9: '导出 MP3'
};

module.exports = { ComfyUI };
