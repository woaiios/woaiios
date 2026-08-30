/**
 * serverConfig — 浏览器侧统一服务地址
 * -----------------------------------------------------------------------------
 * 单一真相源：所有前端对 song-bridge / translate 的地址探测都走这里，
 * 改域名 / 换部署时只改此文件。
 *
 * 规则：
 *  - Tailscale 域名/IP ( *.ts.net / 100.x / *.tailscale. ) → 同主机同协议 :8787
 *  - 其他公网域名 ( github.io / 自定义域名 ) → 回退到生产 Tailscale MagicDNS
 *  - 本地开发 ( localhost / 127.0.0.1 / 无 hostname ) → http://{hostname}:8787
 */

export const PROD_TAILSCALE_HOST = 'pc-20260820eaeq.tailfbac23.ts.net';
export const PROD_TAILSCALE_BASE = `https://${PROD_TAILSCALE_HOST}:8787`;

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
  if (isTailscaleHost(h)) return `${currentProto()}//${h}:8787`;
  if (isPublicHost(h)) return PROD_TAILSCALE_BASE;
  if (h) return `http://${h}:8787`;
  return 'http://localhost:8787';
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
