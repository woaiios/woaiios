#!/usr/bin/env node
/**
 * comfyui manage — ComfyUI Desktop 生命周期管理（按需启动，用完即关）
 * -----------------------------------------------------------------------------
 * ComfyUI 十分耗费 CPU 内存与 GPU 显存，平时不启动。
 *   - ensure：未运行时自动拉起 ComfyUI Desktop 并等待 8188 就绪
 *   - stop：  杀掉所有 ComfyUI Desktop 进程，释放 CPU/GPU 内存
 *   - status：查看当前是否在线
 *
 * 用法：
 *   node tools/comfyui/manage.js status | ensure | stop
 *
 * 供 tests/song-tailscale.spec.js 的 beforeAll/afterAll 调用（SONG_TESTS=1 时）。
 */

import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';

const COMFY_PORT = 8188;
const COMFY_HOST = '127.0.0.1';
const EXE = process.env.COMFY_DESKTOP_EXE || 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Comfy Desktop\\Comfy Desktop.exe';

/** TCP 探测端口是否在监听 */
export function isPortListening(port, host = COMFY_HOST, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const sock = new net.Socket();
        const done = (ok) => {
            try { sock.destroy(); } catch { /* ignore */ }
            resolve(ok);
        };
        sock.setTimeout(timeoutMs);
        sock.once('connect', () => done(true));
        sock.once('timeout', () => done(false));
        sock.once('error', () => done(false));
        sock.connect(port, host);
    });
}

/** ComfyUI HTTP 健康探测（/system_stats 返回 JSON） */
export async function isComfyUp(timeoutMs = 3000) {
    if (!(await isPortListening(COMFY_PORT))) return false;
    try {
        const res = await fetch(`http://${COMFY_HOST}:${COMFY_PORT}/system_stats`, {
            signal: AbortSignal.timeout(timeoutMs)
        });
        return res.ok;
    } catch {
        return false;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 确保 ComfyUI Desktop 在运行：未启动则拉起并等待就绪。
 * @returns {Promise<{wasUp: boolean, startedByUs: boolean}>}
 */
export async function ensureComfyUI({ waitMs = 120000 } = {}) {
    const wasUp = await isComfyUp();
    if (wasUp) return { wasUp: true, startedByUs: false };

    console.log(`[comfyui] 未运行，启动 ${EXE} ...`);
    const child = spawn(EXE, [], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();

    const t0 = Date.now();
    while (Date.now() - t0 < waitMs) {
        await sleep(2000);
        if (await isComfyUp()) {
            console.log(`[comfyui] 已就绪（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
            return { wasUp: false, startedByUs: true };
        }
    }
    throw new Error(`ComfyUI Desktop 在 ${waitMs}ms 内未就绪（端口 ${COMFY_PORT} 无响应）`);
}

/** nvidia-smi 查询显存占用（不可用时返回 null） */
export function gpuMemoryUsedMiB() {
    try {
        const out = execFileSync('nvidia-smi', [
            '--query-gpu=memory.used',
            '--format=csv,noheader,nounits'
        ], { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
        return Number(out.split('\n')[0]) || null;
    } catch {
        return null;
    }
}

/**
 * 停止所有 ComfyUI Desktop 进程，释放 CPU 内存与 GPU 显存。
 * @returns {Promise<{wasUp: boolean, portFreed: boolean}>}
 */
export async function stopComfyUI({ waitMs = 20000 } = {}) {
    const wasUp = await isComfyUp();
    const before = gpuMemoryUsedMiB();

    try {
        execFileSync('taskkill', ['/F', '/IM', 'Comfy Desktop.exe', '/T'], {
            stdio: 'ignore',
            windowsHide: true,
            timeout: 15000
        });
        console.log('[comfyui] 已发送终止信号（Comfy Desktop.exe 全部进程树）');
    } catch (err) {
        // taskkill 找不到进程时返回非零 —— 说明本来就没在跑
        if (!wasUp) {
            console.log('[comfyui] 未在运行，无需停止');
            return { wasUp: false, portFreed: true };
        }
        throw err;
    }

    const t0 = Date.now();
    let portFreed = false;
    while (Date.now() - t0 < waitMs) {
        await sleep(1500);
        if (!(await isPortListening(COMFY_PORT))) {
            portFreed = true;
            break;
        }
    }

    const after = gpuMemoryUsedMiB();
    console.log(
        `[comfyui] 停止完成：端口释放=${portFreed}` +
        (before != null && after != null ? `，显存 ${before}→${after} MiB` : '')
    );
    return { wasUp, portFreed };
}

// ---- CLI 入口 ----
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
    const cmd = process.argv[2] || 'status';
    (async () => {
        if (cmd === 'status') {
            const up = await isComfyUp();
            console.log(up ? `🟢 ComfyUI 在线（${COMFY_HOST}:${COMFY_PORT}）` : '⚪ ComfyUI 未运行');
            process.exit(0);
        } else if (cmd === 'ensure') {
            const r = await ensureComfyUI();
            console.log(r.startedByUs ? '✅ 已自动启动并就绪' : '✅ 原本就在运行');
            process.exit(0);
        } else if (cmd === 'stop') {
            const r = await stopComfyUI();
            process.exit(r.portFreed ? 0 : 1);
        } else {
            console.log('用法: node tools/comfyui/manage.js status|ensure|stop');
            process.exit(2);
        }
    })().catch((err) => {
        console.error('❌', err.message || err);
        process.exit(1);
    });
}
