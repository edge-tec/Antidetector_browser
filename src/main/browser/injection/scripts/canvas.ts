// ──────────────────────────────────────────────────────────────────
// ProfileVault — Canvas Injection Script Builder
// Adds deterministic noise or blocks canvas fingerprinting
// Uses per-profile seed for stable, reproducible noise
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
    callback(new Blob([], { type: 'image/png' }));
  };

  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
    return new ImageData(sw, sh);
  };
})();`
  }

  // Noise mode — deterministic per-profile seed
  return `
// ═══ Canvas Noise (Seed: ${canvas.noiseSeed}) ═══
(function() {
  const SEED = ${canvas.noiseSeed};

  // Simple seeded PRNG (mulberry32)
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(SEED);

  // Add subtle noise to pixel data
  function addNoise(data) {
    // Only modify a small subset of pixels for subtlety
    const step = Math.max(1, Math.floor(data.length / 400));
    for (let i = 0; i < data.length; i += step * 4) {
      // Modify just the least significant bits
      const noise = Math.floor(rng() * 3) - 1; // -1, 0, or 1
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
    }
    return data;
  }

  // Override toDataURL
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    const ctx = this.getContext('2d');
    if (ctx) {
      try {
        const imageData = CanvasRenderingContext2D.prototype.getImageData.call(ctx, 0, 0, this.width, this.height);
        addNoise(imageData.data);
        ctx.putImageData(imageData, 0, 0);
      } catch(e) {}
    }
    return origToDataURL.apply(this, arguments);
  };

  // Override toBlob
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback) {
    const ctx = this.getContext('2d');
    if (ctx) {
      try {
        const imageData = CanvasRenderingContext2D.prototype.getImageData.call(ctx, 0, 0, this.width, this.height);
        addNoise(imageData.data);
        ctx.putImageData(imageData, 0, 0);
      } catch(e) {}
    }
    return origToBlob.apply(this, arguments);
  };

  // Override getImageData to add noise
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function() {
    const imageData = origGetImageData.apply(this, arguments);
    addNoise(imageData.data);
    return imageData;
  };
})();`
}
