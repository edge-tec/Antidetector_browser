// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Web Worker, SharedWorker & OffscreenCanvas Consistency
// Ensures DedicatedWorkerGlobalScope, SharedWorkerGlobalScope, and
// OffscreenCanvas report 100% identical Navigator, Hardware, Platform,
// Languages, and WebGL parameters as the main document thread.
// Defeats CreepJS / Pixelscan / Cloudflare Worker-vs-Window diff checks.
// ──────────────────────────────────────────────────────────────────

import { NavigatorFingerprint, WebGLFingerprint } from '../../../fingerprint/types'

export function buildWorkerConsistencyScript(
  nav?: NavigatorFingerprint,
  webgl?: WebGLFingerprint
): string {
  const unmaskedVendor = webgl?.unmaskedVendor || 'Google Inc. (NVIDIA)'
  const unmaskedRenderer = webgl?.unmaskedRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  const ua = nav?.userAgent || ''
  const platform = nav?.platform || 'Win32'
  const cores = Number(nav?.hardwareConcurrency || 8)
  const memory = Number(nav?.deviceMemory || 8)
  const languages = Array.isArray(nav?.languages) && nav!.languages.length > 0 ? nav!.languages : ['en-US', 'en']
  const language = languages[0] || 'en-US'

  const workerBootstrapPayload = `(function() {
  try {
    var navProto = (typeof WorkerNavigator !== 'undefined' && WorkerNavigator.prototype) || (typeof navigator !== 'undefined' && Object.getPrototypeOf(navigator));
    if (navProto) {
      var def = function(prop, val) {
        try {
          Object.defineProperty(navProto, prop, {
            get: function() { return val; },
            enumerable: true,
            configurable: true
          });
        } catch(e) {}
      };
      if (${JSON.stringify(ua)}) def('userAgent', ${JSON.stringify(ua)});
      def('platform', ${JSON.stringify(platform)});
      def('hardwareConcurrency', ${cores});
      def('deviceMemory', ${memory});
      def('language', ${JSON.stringify(language)});
      def('languages', Object.freeze(${JSON.stringify(languages)}));
      def('webdriver', false);
    }
    if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype && OffscreenCanvas.prototype.getContext) {
      var origGetCtx = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = function(type, attrs) {
        var ctx = origGetCtx.apply(this, arguments);
        if (ctx && (type === 'webgl' || type === 'webgl2') && typeof ctx.getParameter === 'function') {
          var origGetParam = ctx.getParameter.bind(ctx);
          ctx.getParameter = function(p) {
            if (p === 0x9245 || p === 37445) return ${JSON.stringify(unmaskedVendor)};
            if (p === 0x9246 || p === 37446) return ${JSON.stringify(unmaskedRenderer)};
            return origGetParam(p);
          };
        }
        return ctx;
      };
    }
  } catch(e) {}
})();`

  return `
// ═══ OffscreenCanvas & Worker WebGL Consistency ═══
(function() {
  'use strict';
  const cloak = window.__cloakFunction || function(f) { return f; };

  // 1. Main-thread & Worker-thread OffscreenCanvas WebGL Vendor/Renderer override
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

  // 2. Intercept classic Dedicated Worker & SharedWorker creation to prepend WorkerNavigator overrides
  try {
    const workerPreamble = ${JSON.stringify(workerBootstrapPayload)};
    if (typeof window !== 'undefined' && typeof window.Worker === 'function') {
      const OrigWorker = window.Worker;
      const PatchedWorker = cloak(function Worker(scriptURL, options) {
        if (!(this instanceof PatchedWorker)) {
          return new PatchedWorker(scriptURL, options);
        }
        try {
          const isModule = options && options.type === 'module';
          const urlStr = String(scriptURL || '');
          if (!isModule && (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('/'))) {
            const absUrl = new URL(urlStr, window.location.href).href;
            const wrappedBlob = new Blob([workerPreamble + '\\nimportScripts(' + JSON.stringify(absUrl) + ');'], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(wrappedBlob);
            return new OrigWorker(blobUrl, options);
          }
        } catch (err) {}
        return new OrigWorker(scriptURL, options);
      }, 'Worker');
      PatchedWorker.prototype = OrigWorker.prototype;
      Object.setPrototypeOf(PatchedWorker, OrigWorker);
      window.Worker = PatchedWorker;
    }
  } catch (e) {}
})();`
}
