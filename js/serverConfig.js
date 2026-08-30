/**
 * serverConfig — 浏览器侧统一服务地址
 * -----------------------------------------------------------------------------
 * 单一真相源：所有前端对 song-bridge / translate 的地址探测都走这里，
 * 改域名 / 换部署时只改此文件。
 *
 * 规则：
 *  - Tailscale 域名/IP ( *.ts.net / 100.x / *.tailscale. ) → 同主机同协议 :8787(http)/:8788(https tailnet-only)
 *  - 其他公网域名 ( github.io / 自定义域名 ) → 回退到生产 Tailscale MagicDNS https://host:8788 (tailnet-only)
 *  - 本地开发 ( localhost / 127.0.0.1 / 无 hostname ) → http://{hostname}:8787
 */

export const PROD_TAILSCALE_HOST = 'pc-20260820eaeq.tailfbac23.ts.net';
// 私有链路：tailnet 内 http://<host>:8787 直连；
// GitHub Pages(https) 用 https://<host>:8788 — 由 `tailscale serve --https=8788` 在本机做 TLS 终结转发到 127.0.0.1:8787
// （tailnet-only，不走 funnel，公网不可达，仅 tailnet 成员可用）。
export const SONG_BRIDGE_PORT = 8787;
export const SONG_BRIDGE_HTTPS_PORT = 8788;
export const PROD_TAILSCALE_BASE = `https://${PROD_TAILSCALE_HOST}:${SONG_BRIDGE_HTTPS_PORT}`;

export function isTailscaleHost(host = '') {
  return (
    host.endsWith('.ts.net') ||
    /^100\.\d/.test(host) ||
    host.includes('.tailscale.') ||
    host.endsWith('.tail5b6e1.ts.net') ||
    host.endsWith('.tailfbac23.ts.net')
  );
}

export function isPublicHost(host = '') {
  return host.endsWith('github.io') || (!isTailscaleHost(host) && host.includes('.'));
}

function currentHost() {
  try {
    return window.location.hostname || '';
  } catch {
    return '';
  }
}

function currentProto() {
  try {
    return window.location.protocol === 'https:' ? 'https:' : 'http:';
  } catch {
    return 'http:';
  }
}

export function getSongBridgeBase() {
  const h = currentHost();
  if (isTailscaleHost(h)) {
    const port = currentProto() === 'https:' ? SONG_BRIDGE_HTTPS_PORT : SONG_BRIDGE_PORT;
    return `${currentProto()}//${h}:${port}`;
  }
  if (isPublicHost(h)) return PROD_TAILSCALE_BASE;
  if (h) return `http://${h}:${SONG_BRIDGE_PORT}`;
  return `http://localhost:${SONG_BRIDGE_PORT}`;
}

export function getTranslateEndpoint() {
  return `${getSongBridgeBase()}/api/translate`;
}

// 兼容旧调用：LLMSenseSelector.resolveEndpoint 语义
export function resolveTranslateEndpoint() {
  // 保持与旧 resolveEndpoint 一致：Tailscale/公网 才返回，否则 null 让调用方回退
  const h = currentHost();
  if (isTailscaleHost(h) || isPublicHost(h)) return getTranslateEndpoint();
  return null;
}
