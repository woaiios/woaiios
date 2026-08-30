import { describe, it, expect } from 'vitest';
import {
  getSongBridgeBase,
  getTranslateEndpoint,
  resolveTranslateEndpoint,
  isTailscaleHost,
  isPublicHost,
  PROD_TAILSCALE_BASE
} from '../serverConfig';

const loc = (hostname: string, protocol = 'http:') => ({ hostname, protocol });

describe('isTailscaleHost', () => {
  it('matches MagicDNS and IP forms', () => {
    expect(isTailscaleHost('pc-20260820eaeq.tailfbac23.ts.net')).toBe(true);
    expect(isTailscaleHost('100.82.15.39')).toBe(true);
    expect(isTailscaleHost('node.example.tailscale.internal')).toBe(true);
  });

  it('rejects non-Tailscale hosts', () => {
    expect(isTailscaleHost('localhost')).toBe(false);
    expect(isTailscaleHost('woaiios.github.io')).toBe(false);
    expect(isTailscaleHost('192.168.1.10')).toBe(false);
  });
});

describe('isPublicHost', () => {
  it('matches dotted public domains', () => {
    expect(isPublicHost('woaiios.github.io')).toBe(true);
    expect(isPublicHost('words.example.com')).toBe(true);
  });

  it('rejects Tailscale and bare hosts', () => {
    expect(isPublicHost('pc-20260820eaeq.tailfbac23.ts.net')).toBe(false);
    expect(isPublicHost('100.82.15.39')).toBe(false);
    expect(isPublicHost('localhost')).toBe(false);
  });
});

describe('getSongBridgeBase', () => {
  it('Tailscale host → same host + page protocol :8787', () => {
    expect(getSongBridgeBase(loc('100.82.15.39'))).toBe('http://100.82.15.39:8787');
    expect(getSongBridgeBase(loc('pc-20260820eaeq.tailfbac23.ts.net', 'https:'))).toBe(
      'https://pc-20260820eaeq.tailfbac23.ts.net:8787'
    );
  });

  it('public host → production Tailscale MagicDNS (https)', () => {
    expect(getSongBridgeBase(loc('woaiios.github.io', 'https:'))).toBe(PROD_TAILSCALE_BASE);
    expect(getSongBridgeBase(loc('words.example.com'))).toBe(PROD_TAILSCALE_BASE);
  });

  it('local dev host → http://{host}:8787', () => {
    expect(getSongBridgeBase(loc('localhost'))).toBe('http://localhost:8787');
    expect(getSongBridgeBase(loc('127.0.0.1'))).toBe('http://127.0.0.1:8787');
  });

  it('no hostname → localhost fallback', () => {
    expect(getSongBridgeBase(loc(''))).toBe('http://localhost:8787');
  });
});

describe('getTranslateEndpoint / resolveTranslateEndpoint', () => {
  it('appends /api/translate to the bridge base', () => {
    expect(getTranslateEndpoint(loc('100.82.15.39'))).toBe('http://100.82.15.39:8787/api/translate');
    expect(getTranslateEndpoint(loc('woaiios.github.io', 'https:'))).toBe(
      `${PROD_TAILSCALE_BASE}/api/translate`
    );
  });

  it('resolve returns null for local dev (legacy fallback semantics)', () => {
    expect(resolveTranslateEndpoint(loc('localhost'))).toBeNull();
    expect(resolveTranslateEndpoint(loc('woaiios.github.io', 'https:'))).toBe(
      `${PROD_TAILSCALE_BASE}/api/translate`
    );
  });
});
