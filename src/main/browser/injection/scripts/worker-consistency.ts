// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Web Worker & OffscreenCanvas Compatibility Script
// Ensures OffscreenCanvas and Worker APIs remain consistent with
// profile hardware and navigator settings
// ──────────────────────────────────────────────────────────────────

import { NavigatorFingerprint, WebGLFingerprint } from '../../../fingerprint/types'

export function buildWorkerConsistencyScript(
  nav?: NavigatorFingerprint,
  webgl?: WebGLFingerprint
): string {
  const unmaskedVendor = webgl?.unmaskedVendor || 'Google Inc. (NVIDIA)'
  const unmaskedRenderer = webgl?.unmaskedRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'

  return `
// ═══ OffscreenCanvas & Worker WebGL Consistency ═══
(function() {
  'use strict';
  const cloak = window.__cloakFunction || function(f) { return f; };
  try {
    if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype && OffscreenCanvas.prototype.getContext) {
      const origOffscreenGetContext = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = cloak(function(contextType, attrs) {
        const ctx = origOffscreenGetContext.apply(this, arguments);
        if (ctx && (contextType === 'webgl' || contextType === 'webgl2') && typeof ctx.getParameter === 'function') {
          const origGetParam = ctx.getParameter.bind(ctx);
          ctx.getParameter = cloak(function(param) {
            if (param === 0x9245 || param === 37445) return ${JSON.stringify(unmaskedVendor)};
            if (param === 0x9246 || param === 37446) return ${JSON.stringify(unmaskedRenderer)};
            return origGetParam(param);
          }, 'getParameter');
        }
        return ctx;
      }, 'getContext');
    }
  } catch (e) {}
})();`
}
