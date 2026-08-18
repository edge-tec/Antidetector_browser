// ──────────────────────────────────────────────────────────────────
// AntiProfiles — ClientRects Injection Script Builder
// Adds deterministic noise to getBoundingClientRect safely without breaking DOMRectList
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
  'use strict';
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
    if (!rect) return rect;
    const noise = (rng() - 0.5) * 0.001;
    return new DOMRect(
      rect.x + noise,
      rect.y + noise,
      rect.width + noise,
      rect.height + noise
    );
  }

  if (typeof Element !== 'undefined' && Element.prototype.getBoundingClientRect) {
    const origGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = origGetBCR.call(this);
      if (!this || this.tagName === 'HTML' || this.tagName === 'BODY' || this === document.documentElement || this === document.body) {
        return rect;
      }
      return addRectNoise(rect);
    };
  }
})();`
}
