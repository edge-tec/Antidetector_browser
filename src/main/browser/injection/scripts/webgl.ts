// ──────────────────────────────────────────────────────────────────
// AntiProfiles — WebGL Injection Script Builder
// Safely overrides WebGL vendor and renderer without breaking WebGL API
// ──────────────────────────────────────────────────────────────────

import { WebGLFingerprint } from '../../../fingerprint/types'

export function buildWebGLScript(webgl: WebGLFingerprint): string {
  const safeWebgl = {
    enabled: webgl?.enabled !== false,
    unmaskedVendor: webgl?.unmaskedVendor || 'Google Inc. (NVIDIA)',
    unmaskedRenderer: webgl?.unmaskedRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    vendor: webgl?.vendor || 'WebKit',
    renderer: webgl?.renderer || 'WebKit WebGL',
    shadingLanguageVersion: webgl?.shadingLanguageVersion || 'WebGL GLSL ES 1.0 (OpenGL ES 2.0 Chromium)'
  }

  if (!safeWebgl.enabled) {
    return `
// ═══ WebGL Disabled ═══
(function() {
  if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.getContext) {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return origGetContext.apply(this, arguments);
    };
  }
})();`
  }

  const isMobileGpu = /adreno|mali|powervr|apple gpu/i.test(safeWebgl.unmaskedRenderer)
  const maxTextureSize = isMobileGpu ? 8192 : 16384
  const maxRenderbufferSize = isMobileGpu ? 8192 : 16384
  const maxVertexAttribs = 16
  const maxCombinedTexUnits = isMobileGpu ? 32 : 64

  return `
// ═══ WebGL & WebGL2 Capability Override ═══
(function() {
  'use strict';
  const cloak = window.__cloakFunction || function(f) { return f; };
  const UNMASKED_VENDOR = ${JSON.stringify(safeWebgl.unmaskedVendor)};
  const UNMASKED_RENDERER = ${JSON.stringify(safeWebgl.unmaskedRenderer)};
  const SHADING_LANG = ${JSON.stringify(safeWebgl.shadingLanguageVersion)};

  function patchContext(proto) {
    if (!proto || !proto.getParameter) return;
    const origGetParam = proto.getParameter;

    proto.getParameter = cloak(function(param) {
      // UNMASKED_VENDOR_WEBGL (0x9245)
      if (param === 0x9245 || param === 37445) return UNMASKED_VENDOR;
      // UNMASKED_RENDERER_WEBGL (0x9246)
      if (param === 0x9246 || param === 37446) return UNMASKED_RENDERER;
      // VENDOR
      if (param === 0x1F00 || param === 7936) return ${JSON.stringify(safeWebgl.vendor)};
      // RENDERER
      if (param === 0x1F01 || param === 7937) return ${JSON.stringify(safeWebgl.renderer)};
      // SHADING_LANGUAGE_VERSION
      if (param === 0x8B8C || param === 35724) return SHADING_LANG;
      // MAX_TEXTURE_SIZE (0x0D33)
      if (param === 0x0D33 || param === 3379) return ${maxTextureSize};
      // MAX_RENDERBUFFER_SIZE (0x84E8)
      if (param === 0x84E8 || param === 34024) return ${maxRenderbufferSize};
      // MAX_VERTEX_ATTRIBS (0x8869)
      if (param === 0x8869 || param === 34921) return ${maxVertexAttribs};
      // MAX_COMBINED_TEXTURE_IMAGE_UNITS (0x8B4D)
      if (param === 0x8B4D || param === 35661) return ${maxCombinedTexUnits};

      return origGetParam.apply(this, arguments);
    }, 'getParameter');
  }

  if (typeof WebGLRenderingContext !== 'undefined') {
    patchContext(WebGLRenderingContext.prototype);
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    patchContext(WebGL2RenderingContext.prototype);
  }
})();`
}
