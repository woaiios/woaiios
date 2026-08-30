#!/usr/bin/env node
/**
 * comfyui manage — ComfyUI 后端生命周期管理（按需启动，用完即关）
 * -----------------------------------------------------------------------------
 * ComfyUI 十分耗费 CPU 内存与 GPU 显存，平时不启动。
 *   - ensure：未运行时直接拉起 standalone 后端（venv python + main.py，约 20-40s 就绪），
 *     不走 Electron 桌面应用（它需要人工点启动按钮，无法自动化）
 *   - stop：  杀掉监听 8188 的后端进程（无论谁启动的），释放 CPU/GPU 内存
 *   - status：查看当前是否在线
 *
 * 用法：
 *   node tools/comfyui/manage.js status | ensure | stop
 *
 * 供 tests/song-tailscale.spec.js 的 beforeAll/afterAll 调用。
 */

import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMFY_PORT = 8188;
const COMFY_HOST = '127.0.0.1';
const INSTALL_DIR = process.env.COMFY_INSTALL_DIR || 'C:\\Users\\Administrator\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Installs\\ComfyUI';
const VENV_PYTHON = path.join(INSTALL_DIR, 'ComfyUI', '.venv', 'Scripts', 'python.exe');
const MAIN_PY = path.join(INSTALL_DIR, 'ComfyUI', 'main.py');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BACKEND_LOG = path.join(REPO_ROOT, 'tools', 'song-bridge', 'logs', 'comfyui-backend.log');

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

/** 找到监听指定端口的进程 PID（netstat -ano） */
export function pidListeningOn(port) {
    try {
        const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
        const re = new RegExp(`^\\S+\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'im');
        for (const line of out.split('\n')) {
            if (!line.includes(`:${port} `)) continue;
            const m = re.exec(line);
            if (m) return Number(m[1]);
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * 确保 ComfyUI 后端在运行：未启动则直接拉起 standalone 后端并等待就绪。
 * @returns {Promise<{wasUp: boolean, startedByUs: boolean}>}
 */
export async function ensureComfyUI({ waitMs = 150000 } = {}) {
    const wasUp = await isComfyUp();
    if (wasUp) return { wasUp: true, startedByUs: false };

    if (!fs.existsSync(VENV_PYTHON) || !fs.existsSync(MAIN_PY)) {
        throw new Error(`找不到 ComfyUI standalone 环境：${INSTALL_DIR}（请先安装 ComfyUI Desktop）`);
    }

    console.log('[comfyui] 未运行，直接启动 standalone 后端…');
    const t0 = Date.now();
    fs.mkdirSync(path.dirname(BACKEND_LOG), { recursive: true });
    const out = fs.openSync(BACKEND_LOG, 'a');
    const child = spawn(
        VENV_PYTHON,
        [MAIN_PY, '--enable-manager', '--port', String(COMFY_PORT)],
        { cwd: path.join(INSTALL_DIR, 'ComfyUI'), detached: true, windowsHide: true, stdio: ['ignore', out, out] }
    );
    child.unref();

    while (Date.now() - t0 < waitMs) {
        await sleep(2000);
        if (await isComfyUp()) {
            console.log(`[comfyui] 已就绪（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
            return { wasUp: false, startedByUs: true };
        }
        // 进程提前退出 = 启动失败，立即报错而不是傻等
        if (child.exitCode !== null) {
            const tail = fs.existsSync(BACKEND_LOG) ? fs.readFileSync(BACKEND_LOG, 'utf8').slice(-500) : '';
            throw new Error(`ComfyUI 后端启动即退出（code=${child.exitCode}）：${tail}`);
        }
    }
    throw new Error(`ComfyUI 后端在 ${waitMs}ms 内未就绪（端口 ${COMFY_PORT} 无响应），日志：${BACKEND_LOG}`);
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
 * 停止 ComfyUI 后端（杀监听 8188 的进程树，无论谁启动的），释放 CPU 内存与 GPU 显存。
 * @returns {Promise<{wasUp: boolean, portFreed: boolean}>}
 */
export async function stopComfyUI({ waitMs = 20000 } = {}) {
    const wasUp = await isComfyUp();
    const before = gpuMemoryUsedMiB();

    if (!wasUp) {
        console.log('[comfyui] 未在运行，无需停止');
        return { wasUp: false, portFreed: true };
    }

    const pid = pidListeningOn(COMFY_PORT);
    if (pid) {
        try {
            execFileSync('taskkill', ['/F', '/PID', String(pid), '/T'], {
                stdio: 'ignore',
                windowsHide: true,
                timeout: 15000
            });
            console.log(`[comfyui] 已终止后端进程（pid=${pid}）`);
        } catch (err) {
            console.log(`[comfyui] 终止后端失败：${err.message}`);
        }
    } else {
        console.log('[comfyui] 未找到监听 8188 的进程');
    }
    // 顺带关掉 Electron 外壳（如果开着），避免残留窗口
    try {
        execFileSync('taskkill', ['/F', '/IM', 'Comfy Desktop.exe', '/T'], {
            stdio: 'ignore',
            windowsHide: true,
            timeout: 15000
        });
    } catch { /* 本来就没开 */ }

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
