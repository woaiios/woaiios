/**
 * song-tailscale.spec.js — 走 Tailscale 通道的歌曲生成验收
 * -----------------------------------------------------------------------------
 * 为什么要单独加这一份测试：
 *   e2e-photosynthesis.spec.js 只断言「页面不报错、歌词非空、状态有字」，
 *   而 SongStudioPanel 在 song-bridge 连不上时会静默走 createMockSong() 兜底，
 *   页面上照样有歌词、有播放器 —— 测试全绿，但其实一首歌都没生成。
 *
 * 这份测试把门禁收紧到「必须真的产出音频」：
 *   ① Tailscale 连通性硬门禁：Tailscale 必须 Running，且 100.x / *.ts.net 上的
 *      song-bridge /api/health 必须 ok，ComfyUI 必须在线，显存必须够；
 *   ② 用 Tailscale URL 直接 POST /api/song，校验返回的音频 > 60 秒；
 *   ③ 浏览器里把 songBridgeUrl 指向 Tailscale URL，要求 /api/song、/api/audio/*
 *      确实打在这个地址上（不是 127.0.0.1），播放器里是真实 <audio>，
 *      且时长 > 60 秒、不是浏览器内兜底。
 *
 * 关于缓存：默认会先删掉这首歌的缓存条目，强制走一次真实作曲
 * （实测 ComfyUI MiniMax Music 3 出 120s 约 100 秒），这样才卡得住退路。
 * 想跑快一点就设 SONG_TS_ALLOW_CACHE=1，允许命中缓存秒回。
 *
 * 曲风确定性：面板用 Math.random 随机选曲风，测试期间把 Math.random 固定为 0，
 * 命中 STYLE_PRESETS[0] = 'acoustic folk pop'，缓存 key 才可预测、可清理。
 */

import { test, expect } from '@playwright/test';
import {
  resolveBridgeBase,
  triggerSong,
  probeMp3Duration,
  purgeCachedSong,
  isTailscaleBase,
  tailscaleIdentity
} from './helpers/tailscale-bridge.js';

const PASSAGE = `Photosynthesis is a vital process that occurs in plants, algae, and some bacteria, allowing them to convert light energy into chemical energy. This process is essential for the survival of these organisms and for the production of oxygen, which is crucial for life on Earth. Photosynthesis primarily takes place in the chloroplasts of plant cells, where chlorophyll absorbs sunlight and initiates the conversion of carbon dioxide and water into glucose and oxygen.Photosynthesis is not only important for plants but also has significant implications for climate change. Plants absorb carbon dioxide, a major greenhouse gas, during photosynthesis.
This helps mitigate the effects of global warming by reducing the concentration of carbon dioxide in the atmosphere.`;

/** Math.random 固定为 0 时面板选中的曲风（STYLE_PRESETS[0]） */
const STYLE = 'acoustic folk pop';
/** Passsage 763 字符 → autoDuration() 落进 120s 档 */
const DURATION_SEC = 120;
/** 验收线：歌曲必须超过 60 秒 */
const MIN_DURATION_SEC = 60;
/** 真实作曲最长等待 */
const COMPOSE_TIMEOUT_MS = 15 * 60 * 1000;
/** SONG_TS_ALLOW_CACHE=1 时跳过清缓存，允许命中缓存秒回 */
const ALLOW_CACHE = process.env.SONG_TS_ALLOW_CACHE === '1';

const SONG_PARAMS = { words: [], sentence: PASSAGE, style: STYLE, durationSec: DURATION_SEC };

let bridge = null;

async function getBridge() {
  if (bridge) return bridge;
  console.log('— Tailscale 候选地址探测 —');
  bridge = await resolveBridgeBase({ allowLocalhost: false, log: (s) => console.log(s) });
  return bridge;
}

/**
 * 等 Service Worker 首次接管完成。
 * sw.js 走的是 skipWaiting + clients.claim，页面会在 SW 从「未受控」变「受控」的瞬间
 * 自己 reload 一次（控制台会打 "Service Worker controller changed, reloading page..."）。
 * 如果在这之前去点弹窗里的按钮，元素会被这次重载 detach，Playwright 报
 * "element is not stable / was detached from the DOM"。旧测试因为要先等数据库
 * 加载几十秒，天然躲过了这个窗口；本用例一上来就开弹窗，必须显式等。
 */
async function waitForSwSettled(page) {
  await page.waitForLoadState('load').catch(() => {});
  const navP = page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => null);
  let controlled = null;
  try {
    controlled = await page.evaluate(() => !!navigator.serviceWorker?.controller);
  } catch {
    controlled = false; // 求值过程中正好被重载打断，说明重载确实要发生
  }
  if (controlled === false) {
    await navP;
    console.log('Service Worker 已接管，页面自动重载完成');
  }
  await page.waitForTimeout(1200);
}

test.describe('歌曲生成 · Tailscale 通道', () => {
  test('① Tailscale 连通性检查：song-bridge 必须经 100.x / *.ts.net 可达', async () => {
    test.setTimeout(60000);

    const id = tailscaleIdentity();
    console.log('Tailscale 身份：', JSON.stringify(id));
    expect(id.backendState, 'Tailscale 未处于 Running 状态').toBe('Running');
    expect(id.ip || id.dnsName, '拿不到 Tailscale IP / MagicDNS 域名').toBeTruthy();

    const { base, kind, health } = await getBridge();
    expect(kind, `连上的不是 Tailscale 通道：${base}`).toBe('tailscale');
    expect(isTailscaleBase(base), `地址不是 Tailscale 网段：${base}`).toBe(true);

    console.log('health：', JSON.stringify(health));
    expect(health.comfyui?.up, 'ComfyUI(MiniMax Music 3) 未在线，无法产出真实音频').toBe(true);
    expect(health.gpu?.vramFreeGiB ?? 0, '可用显存不足，作曲会失败').toBeGreaterThan(5);
  });

  test('② 经 Tailscale URL 直接触发 /api/song，音频时长 > 60 秒', async () => {
    test.setTimeout(COMPOSE_TIMEOUT_MS);
    const { base } = await getBridge();

    console.log(`— POST ${base}/api/song（${STYLE} · ${DURATION_SEC}s）—`);
    const t0 = Date.now();
    const r = await triggerSong({
      base,
      ...SONG_PARAMS,
      timeoutMs: COMPOSE_TIMEOUT_MS,
      onEvent: ({ event, data }) => {
        if (event === 'stage') console.log('   [stage]', data.stage, data.message);
      }
    });
    console.log(`生成完成：cached=${r.cached} 用时 ${((Date.now() - t0) / 1000).toFixed(1)}s id=${r.song.id} bytes=${r.song.bytes}`);

    expect(r.song.durationSec).toBe(DURATION_SEC);
    expect(r.song.bytes, '音频字节数异常，可能是兜底占位').toBeGreaterThan(1024 * 100);

    const probe = await probeMp3Duration(`${base}${r.song.audioUrl}`);
    console.log('MP3 头信息：', JSON.stringify(probe));
    expect(probe.durationSec, `音频时长 ${probe.durationSec}s 未超过 ${MIN_DURATION_SEC}s`).toBeGreaterThan(MIN_DURATION_SEC);
  });

  test('③ 浏览器经 Tailscale URL 触发生成，播放器为真实音频且 > 60 秒', async ({ page }) => {
    test.setTimeout(COMPOSE_TIMEOUT_MS + 5 * 60 * 1000);
    const { base } = await getBridge();

    // ---- A. 清掉这首歌的缓存，强制真实作曲，避免缓存掩盖断掉的服务 ----
    if (ALLOW_CACHE) {
      console.log('SONG_TS_ALLOW_CACHE=1，跳过清缓存');
    } else {
      const purged = await purgeCachedSong(base, SONG_PARAMS);
      console.log('已清缓存条目：', JSON.stringify(purged));
    }

    // ---- B. 错误收集 + 请求去向收集 ----
    const pageErrors = [];
    const consoleErrors = [];
    const apiHits = { song: [], audio: [], health: [] };
    const IGNORE = ['tailfbac23', 'lm-studio', '127.0.0.1:1234', 'Worker error'];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
      console.log('[pageerror]', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const t = msg.text();
      if (IGNORE.some((k) => t.includes(k))) {
        console.log('[console error - ignored]', t);
        return;
      }
      consoleErrors.push(t);
      console.log('[console error]', t);
    });
    page.on('request', (req) => {
      let p;
      try {
        p = new URL(req.url()).pathname;
      } catch {
        return;
      }
      if (p === '/api/song') apiHits.song.push(req.url());
      else if (p.startsWith('/api/audio/')) apiHits.audio.push(req.url());
      else if (p === '/api/health') apiHits.health.push(req.url());
    });

    // ---- C. 打开页面，等 SW 接管 + 数据库加载遮罩消失 ----
    await page.goto('/woaiios/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForSwSettled(page);
    await expect(page.locator('#dbLoadingOverlay'))
      .toBeHidden({ timeout: 120000 })
      .catch(() => console.log('dbOverlay 仍未隐藏，继续（歌曲链路不依赖它）'));

    // ---- D. 把歌曲服务地址指向 Tailscale URL ----
    await page.fill('#textInput', PASSAGE);
    const applied = await page.evaluate(async (url) => {
      const w = window.wordDiscoverer;
      if (!w?.settingsManager) return { ok: false, reason: 'wordDiscoverer.settingsManager 不存在' };
      await w.settingsManager.waitForInit();
      await w.settingsManager.setSetting('songBridgeUrl', url);
      await w.settingsManager.setSetting('songEnabled', true);
      return { ok: true, current: w.settingsManager.getSetting('songBridgeUrl') };
    }, base);
    console.log('songBridgeUrl 设置结果：', JSON.stringify(applied));
    expect(applied.ok).toBe(true);
    expect(applied.current).toBe(base);

    // ---- E. 打开 Pronunciation → 钉死曲风 → 触发生成 ----
    await page.locator('#pronunciationBtn').click();
    const pronModal = page.locator('#pronunciationModal');
    await expect(pronModal).toHaveClass(/show/, { timeout: 10000 });
    await expect(pronModal.locator('#songStudio')).toBeVisible();

    await page.evaluate(() => {
      window.__origRandom = Math.random;
      Math.random = () => 0; // → STYLE_PRESETS[0]
    });

    const genBtn = pronModal.locator('#songGenerateBtn');
    await expect(genBtn).toBeEnabled();
    const tClick = Date.now();
    await genBtn.click();

    // ---- F. 等真实播放器出现（浏览器兜底只有文案、没有 <audio>）----
    const audio = pronModal.locator('#songPlayers audio');
    await expect(audio).toHaveCount(1, { timeout: COMPOSE_TIMEOUT_MS });
    console.log(`播放器出现，耗时 ${((Date.now() - tClick) / 1000).toFixed(1)}s`);

    await page.evaluate(() => {
      if (window.__origRandom) Math.random = window.__origRandom;
    });

    const statusText = (await pronModal.locator('#songStatusText').textContent())?.trim() || '';
    const playersText = (await pronModal.locator('#songPlayers').textContent())?.trim() || '';
    console.log('状态：', statusText);
    console.log('播放器文本：', playersText.slice(0, 200));

    expect(statusText, '状态里出现「未连接」').not.toContain('未连接');
    expect(statusText, '状态里出现「兜底」').not.toContain('兜底');
    expect(playersText, '落到了浏览器内兜底生成（没有真实音频）').not.toContain('浏览器内生成');
    expect(playersText, '落到了浏览器内兜底生成').not.toContain('本地服务未连接');

    // ---- G. 请求确实走了 Tailscale URL ----
    console.log('API 去向：', JSON.stringify({
      song: apiHits.song,
      audio: apiHits.audio,
      health: apiHits.health.slice(0, 3)
    }));
    expect(apiHits.song.length, '没有发出 /api/song 请求').toBeGreaterThan(0);
    expect(apiHits.audio.length, '没有发出 /api/audio 请求').toBeGreaterThan(0);
    for (const u of [...apiHits.song, ...apiHits.audio, ...apiHits.health]) {
      expect(u.startsWith(base), `请求没走 Tailscale URL：${u}`).toBe(true);
    }

    // ---- H. 验收：音频时长 > 60 秒 ----
    const info = await page.evaluate(async (timeoutMs) => {
      const a = document.querySelector('#songPlayers audio');
      if (!a) return { error: 'no audio element' };
      if (!(a.duration > 0) || !Number.isFinite(a.duration)) {
        await new Promise((resolve) => {
          const done = () => {
            a.removeEventListener('loadedmetadata', done);
            a.removeEventListener('durationchange', done);
            a.removeEventListener('error', done);
            clearTimeout(timer);
            resolve();
          };
          a.addEventListener('loadedmetadata', done);
          a.addEventListener('durationchange', done);
          a.addEventListener('error', done);
          const timer = setTimeout(done, timeoutMs);
        });
      }
      return {
        src: a.currentSrc || a.src,
        duration: a.duration,
        readyState: a.readyState,
        errorCode: a.error ? a.error.code : null
      };
    }, 90000);

    console.log('音频元素：', JSON.stringify(info));
    expect(info.errorCode, `音频加载失败 code=${info.errorCode}`).toBeNull();
    expect(info.src.startsWith(base), `音频 src 没走 Tailscale URL：${info.src}`).toBe(true);
    expect(Number.isFinite(info.duration), `拿不到音频时长（readyState=${info.readyState}）`).toBe(true);
    expect(info.duration, `歌曲时长 ${info.duration}s 未超过 ${MIN_DURATION_SEC}s`).toBeGreaterThan(MIN_DURATION_SEC);

    // 播放器标注的时长应与请求档位一致
    expect(playersText).toContain(`${DURATION_SEC}s`);

    // ---- I. 无脚本错误 ----
    expect(pageErrors, `pageerror: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `console error: ${JSON.stringify(consoleErrors)}`).toEqual([]);

    await page.screenshot({ path: 'test-results/song-tailscale-pass.png', fullPage: true });
  });
});
