/**
 * serverConfig — 浏览器侧统一服务地址（单一真相源）
 * -----------------------------------------------------------------------------
 * 所有前端对 song-bridge / translate 的地址探测都走这里，
 * 改域名 / 换部署时只改此文件。
 *
 * 规则：
 *  - Tailscale 域名/IP ( *.ts.net / 100.x / *.tailscale. ) → 同主机同协议 :8787(http)/:8788(https tailnet-only)
 *  - 其他公网域名 ( github.io / 自定义域名 ) → 回退到生产 Tailscale MagicDNS https://host:8788 (tailnet-only)
 *  - 本地开发 ( localhost / 127.0.0.1 / 无 hostname ) → http://{hostname}:8787
 *
 * 可测试性：所有函数接受可选的 `loc`（ServerLocation），默认读取 window.location。
 */

export interface ServerLocation {
  hostname: string;
  protocol: string;
}

/** 生产 Tailscale MagicDNS 主机。
 *  私有链路：tailnet 内用 http://<host>:8787 直连；
 *  GitHub Pages(https) 用 https://<host>:8788 — 由 `tailscale serve --https=8788` 在本机做 TLS 终结并转发到 127.0.0.1:8787
 *  （tailnet-only，不走 funnel，公网不可达，仅 tailnet 成员可用，避免公网暴露风险）。 */
export const PROD_TAILSCALE_HOST = 'pc-20260820eaeq.tailfbac23.ts.net';
export const SONG_BRIDGE_PORT = 8787;
export const SONG_BRIDGE_HTTPS_PORT = 8788;
export const PROD_TAILSCALE_BASE = `https://${PROD_TAILSCALE_HOST}:${SONG_BRIDGE_HTTPS_PORT}`;

function currentLoc(): ServerLocation {
  try {
    return { hostname: window.location.hostname, protocol: window.location.protocol };
  } catch {
    return { hostname: '', protocol: 'http:' };
  }
}

/** Tailscale 主机：MagicDNS (*.ts.net)、100.x IP、*.tailscale. */
export function isTailscaleHost(host: string): boolean {
  return (
    host.endsWith('.ts.net') ||
    /^100\.\d/.test(host) ||
    host.includes('.tailscale.') ||
    host.endsWith('.tail5b6e1.ts.net') ||
    host.endsWith('.tailfbac23.ts.net')
  );
}

/** 本地开发主机（loopback），必须直连本机而非生产后端 */
export function isLocalDevHost(host: string): boolean {
  return host === 'localhost' || host.startsWith('127.') || host === '::1' || host === '[::1]';
}

/** 公网部署主机（github.io / 任意带点的非 Tailscale、非 loopback 域名） */
export function isPublicHost(host: string): boolean {
  return host.includes('.') && !isTailscaleHost(host) && !isLocalDevHost(host);
}

/** song-bridge 根地址（含端口，无路径） */
export function getSongBridgeBase(loc?: ServerLocation): string {
  const { hostname, protocol } = loc ?? currentLoc();
  if (isTailscaleHost(hostname)) {
    // tailnet 内：https 页走 8788 (tailscale https)，http 页走 8787 (tcp/直接)
    const port = protocol === 'https:' ? SONG_BRIDGE_HTTPS_PORT : SONG_BRIDGE_PORT;
    return `${protocol}//${hostname}:${port}`;
  }
  if (isPublicHost(hostname)) return PROD_TAILSCALE_BASE;
  if (hostname) return `http://${hostname}:${SONG_BRIDGE_PORT}`;
  return `http://localhost:${SONG_BRIDGE_PORT}`;
}

/** LLM 翻译端点（song-bridge 统一代理） */
export function getTranslateEndpoint(loc?: ServerLocation): string {
  return `${getSongBridgeBase(loc)}/api/translate`;
}

/**
 * 兼容旧 LLMSenseSelector.resolveEndpoint 语义：
 * Tailscale / 公网主机返回端点，否则返回 null 让调用方回退到内置默认。
 */
export function resolveTranslateEndpoint(loc?: ServerLocation): string | null {
  const { hostname } = loc ?? currentLoc();
  if (isTailscaleHost(hostname) || isPublicHost(hostname)) return getTranslateEndpoint(loc);
  return null;
}
