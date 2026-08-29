'use strict';

/**
 * ComfyUI 侧冒烟测试
 * 用极小参数（默认 8 秒 / 6 步）跑一遍 MiniMax Music 3 工作流，
 * 验证 API 图格式、节点连线、音频回传链路是否通畅，避免每次都用真实长任务试错。
 *
 * 用法：node scripts/smoke-comfyui.js [seconds] [steps]
 */

const path = require('path');
const { config } = require('../config');
const { ComfyUI } = require('../lib/comfyui');
const { FreeToken } = require('../lib/freetoken');
const { GpuScheduler } = require('../lib/gpu-scheduler');

const seconds = Number(process.argv[2] || 8);
const steps = Number(process.argv[3] || 6);

const comfyui = new ComfyUI(config, console.log);
const freetoken = new FreeToken(config, console.log);
const scheduler = new GpuScheduler({
  freetoken,
  comfyui,
  lmstudio: { async loadedModels() { return []; }, async unloadAll() { return []; } },
  config
});

const CAPTION = `Global Metadata: Lo-fi acoustic pop, around 90 BPM, warm and unhurried. Intimate and gently hopeful from start to finish. Soft close-mic bedroom production with light tape hiss and a narrow, centered soundstage.
Vocal Details: A single warm female lead vocal, soft breathy low register, close and unhurried phrasing, barely-there double-tracked harmonies in the chorus, short room reverb and no pitch correction.
Arrangement: Intro picks out a finger-picked nylon guitar motif alone. Verse adds a soft upright bass and brushed shaker. Chorus widens with light strumming and a wordless harmony, keeping the dynamic lift modest. Outro strips back to the guitar motif and lets the tape hiss close the track.`;

const LYRICS = `[Intro]
Mmm...

[Verse]
A quiet word, a quiet sound

[Chorus]
Hold it close and say it loud

[Outro]
Mmm...`;

(async () => {
  console.log(`=== smoke: ${seconds}s / ${steps} steps ===`);

  console.log('\n[1/4] 检查显存');
  console.log('  可用显存:', (await comfyui.vramFreeGiB())?.toFixed(2), 'GiB');

  console.log('\n[2/4] 释放 GPU（卸载 FreeToken + ComfyUI 模型）');
  await scheduler.run('comfyui', async () => {
    console.log('  清场完成，可用显存:', (await comfyui.vramFreeGiB())?.toFixed(2), 'GiB');
  });

  console.log('\n[3/4] 提交任务');
  const t0 = Date.now();
  const graph = comfyui.buildGraph({
    caption: CAPTION,
    lyrics: LYRICS,
    seed: 42,
    durationSec: seconds,
    filenamePrefix: 'songbridge/_smoke'
  });
  graph[7].inputs.steps = steps; // 冒烟测试只跑几步

  const out = await scheduler.run('comfyui', async () => {
    let last = '';
    return comfyui.run(graph, (p) => {
      const label = p.max > 0 ? `${p.phase} ${p.value}/${p.max}` : p.phase;
      if (label !== last) {
        last = label;
        process.stdout.write(`\r  ${label}                    `);
      }
    });
  });
  console.log(`\n  完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log('\n[4/4] 取回音频');
  const buf = await comfyui.view(out.filename, out.subfolder, out.type);
  const target = path.join(config.audioDir, '_smoke.mp3');
  require('fs').writeFileSync(target, buf);
  console.log(`  ${out.filename} -> ${target} (${(buf.length / 1024).toFixed(1)} KB)`);

  console.log('\n✅ ComfyUI 链路正常');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ 失败：', err.message);
  process.exit(1);
});
