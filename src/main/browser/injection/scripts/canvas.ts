// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Canvas Injection Script Builder
// Safe, deterministic noise without breaking WebGL or canvas exports
// ──────────────────────────────────────────────────────────────────

import { CanvasFingerprint } from '../../../fingerprint/types'

export function buildCanvasScript(canvas: CanvasFingerprint): string {
  if (canvas.mode === 'off') {
    return '// Canvas protection: OFF'
  }

  if (canvas.mode === 'block') {
    return `
// ═══ Canvas Block ═══
(function() {
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    return 'data:image/png;base64,';
  };

  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback) {
    if (typeof callback === 'function') {
      callback(new Blob([], { type: 'image/png' }));
    }
  };
})();`
  }

  // Noise mode — deterministic per-profile seed
  return `
// ═══ Canvas Noise (Seed: ${canvas.noiseSeed}) ═══
(function() {
  'use strict';
  const SEED = ${canvas.noiseSeed};

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(SEED);

  function addNoise(data) {
    if (!data || data.length === 0) return data;
    const step = Math.max(1, Math.floor(data.length / 400));
    for (let i = 0; i < data.length; i += step * 4) {
      const noise = Math.floor(rng() * 3) - 1; // -1, 0, or 1
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
    }
    return data;
  }

  // Override CanvasRenderingContext2D.prototype.getImageData safely
  if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype.getImageData) {
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
      const imageData = origGetImageData.apply(this, arguments);
      // Only apply noise on large standard canvases (>32x32) to protect cryptographic attestation canvases
      if (sw > 32 && sh > 32 && imageData && imageData.data && imageData.data.length > 4096) {
        addNoise(imageData.data);
      }
      return imageData;
    };
  }
})();`
}
