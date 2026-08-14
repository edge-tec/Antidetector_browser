// ──────────────────────────────────────────────────────────────────
// ProfileVault — WebGL Injection Script Builder
// Intercepts WebGL API calls to spoof GPU identity
// ──────────────────────────────────────────────────────────────────

import { WebGLFingerprint } from '../../../fingerprint/types'

export function buildWebGLScript(webgl: WebGLFingerprint): string {
  if (!webgl.enabled) {
    return `
// ═══ WebGL Disabled ═══
(function() {
  HTMLCanvasElement.prototype.getContext = (function(origFn) {
    return function(type) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return origFn.apply(this, arguments);
    };
  })(HTMLCanvasElement.prototype.getContext);
})();`
  }

  return `
// ═══ WebGL Override ═══
(function() {
  const UNMASKED_VENDOR = ${JSON.stringify(webgl.unmaskedVendor)};
  const UNMASKED_RENDERER = ${JSON.stringify(webgl.unmaskedRenderer)};
  const MAX_TEXTURE_SIZE = ${webgl.maxTextureSize};
  const MAX_VIEWPORT_DIMS = new Int32Array([${webgl.maxViewportDims[0]}, ${webgl.maxViewportDims[1]}]);
  const MAX_RENDERBUFFER = ${webgl.maxRenderbufferSize};
  const EXTENSIONS = ${JSON.stringify(webgl.extensions)};

  function patchContext(proto) {
    // Override getParameter
    const origGetParam = proto.getParameter;
    proto.getParameter = function(param) {
      // UNMASKED_VENDOR_WEBGL (0x9245)
      if (param === 0x9245 || param === 37445) return UNMASKED_VENDOR;
      // UNMASKED_RENDERER_WEBGL (0x9246)
      if (param === 0x9246 || param === 37446) return UNMASKED_RENDERER;
      // MAX_TEXTURE_SIZE
      if (param === 0x0D33 || param === 3379) return MAX_TEXTURE_SIZE;
      // MAX_VIEWPORT_DIMS
      if (param === 0x0D3A || param === 3386) return MAX_VIEWPORT_DIMS;
      // MAX_RENDERBUFFER_SIZE
      if (param === 0x84E8 || param === 34024) return MAX_RENDERBUFFER;
      // RENDERER
      if (param === 0x1F01 || param === 7937) return ${JSON.stringify(webgl.renderer)};
      // VENDOR
      if (param === 0x1F00 || param === 7936) return ${JSON.stringify(webgl.vendor)};
      // SHADING_LANGUAGE_VERSION
      if (param === 0x8B8C || param === 35724) return ${JSON.stringify(webgl.shadingLanguageVersion)};
      return origGetParam.call(this, param);
    };

    // Override getSupportedExtensions
    const origGetExt = proto.getSupportedExtensions;
    proto.getSupportedExtensions = function() {
      return [...EXTENSIONS];
    };

    // Override getExtension to only return extensions in our list
    const origGetExtension = proto.getExtension;
    proto.getExtension = function(name) {
      if (!EXTENSIONS.includes(name)) return null;
      // For debug_renderer_info, return a mock object
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_VENDOR_WEBGL: 0x9245,
          UNMASKED_RENDERER_WEBGL: 0x9246
        };
      }
      return origGetExtension.call(this, name);
    };
  }

  // Patch WebGLRenderingContext
  if (window.WebGLRenderingContext) {
    patchContext(WebGLRenderingContext.prototype);
  }
  // Patch WebGL2RenderingContext
  if (window.WebGL2RenderingContext) {
    patchContext(WebGL2RenderingContext.prototype);
  }
})();`
}
