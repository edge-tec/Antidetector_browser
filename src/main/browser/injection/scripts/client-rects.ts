// ──────────────────────────────────────────────────────────────────
// AntiProfiles — ClientRects Injection Script Builder
// Adds deterministic noise to getBoundingClientRect / getClientRects safely
// ──────────────────────────────────────────────────────────────────

import { ClientRectsFingerprint } from '../../../fingerprint/types'

export function buildClientRectsScript(cr: ClientRectsFingerprint): string {
  const safeMode = cr?.mode || 'off'
  const safeSeed = cr?.noiseSeed || 9999

  if (safeMode === 'off') {
    return '// ClientRects: OFF (no override)'
  }

  return `
// ═══ ClientRects Noise (Seed: ${safeSeed}) ═══
(function() {
  const SEED = ${safeSeed};

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(SEED);

  function addRectNoise(rect) {
    const noise = (rng() - 0.5) * 0.01; // Very subtle noise
    return new DOMRect(
      rect.x + noise,
      rect.y + noise,
      rect.width + noise,
      rect.height + noise
    );
  }

  // Override getBoundingClientRect
  const origGetBCR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function() {
    const rect = origGetBCR.call(this);
    if (!this || this.tagName === 'HTML' || this.tagName === 'BODY' || this === document.documentElement || this === document.body) {
      return rect;
    }
    return addRectNoise(rect);
  };

  // Override getClientRects
  const origGetCR = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function() {
    const rects = origGetCR.call(this);
    const result = [];
    for (let i = 0; i < rects.length; i++) {
      result.push(addRectNoise(rects[i]));
    }
    // Return a DOMRectList-like object
    Object.defineProperty(result, 'item', { value: function(i) { return result[i]; } });
    return result;
  };

  // Override Range.getBoundingClientRect and getClientRects
  if (window.Range) {
    const origRangeBCR = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function() {
      const rect = origRangeBCR.call(this);
      return addRectNoise(rect);
    };

    const origRangeCR = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function() {
      const rects = origRangeCR.call(this);
      const result = [];
      for (let i = 0; i < rects.length; i++) {
        result.push(addRectNoise(rects[i]));
      }
      Object.defineProperty(result, 'item', { value: function(i) { return result[i]; } });
      return result;
    };
  }
})();`
}
