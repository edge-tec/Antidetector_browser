// ──────────────────────────────────────────────────────────────────
// AntiProfiles — AudioContext Injection Script Builder
// Safely adds deterministic noise while preserving class prototypes
// ──────────────────────────────────────────────────────────────────

import { AudioFingerprint } from '../../../fingerprint/types'

export function buildAudioScript(audio: AudioFingerprint): string {
  const safeMode = audio?.mode || 'noise'
  const safeSeed = audio?.noiseSeed || 54321

  if (safeMode === 'off') {
    return '// AudioContext: OFF (no override)'
  }

  if (safeMode === 'default') {
    return '// AudioContext: Default (no override)'
  }

  return `
// ═══ AudioContext Noise (Seed: ${safeSeed}) ═══
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

  // Override AnalyserNode frequency data safely
  if (typeof AnalyserNode !== 'undefined' && AnalyserNode.prototype) {
    const origGetFloat = AnalyserNode.prototype.getFloatFrequencyData;
    if (origGetFloat) {
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloat.call(this, array);
        if (array && array.length > 0) {
          for (let i = 0; i < array.length; i += 10) {
            array[i] += (rng() - 0.5) * 0.001;
          }
        }
      };
    }

    const origGetByte = AnalyserNode.prototype.getByteFrequencyData;
    if (origGetByte) {
      AnalyserNode.prototype.getByteFrequencyData = function(array) {
        origGetByte.call(this, array);
        if (array && array.length > 0) {
          for (let i = 0; i < array.length; i += 10) {
            const noise = Math.floor(rng() * 3) - 1;
            array[i] = Math.max(0, Math.min(255, array[i] + noise));
          }
        }
      };
    }
  }

  // Override AudioBuffer.getChannelData safely
  if (typeof AudioBuffer !== 'undefined' && AudioBuffer.prototype && AudioBuffer.prototype.getChannelData) {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function(channel) {
      const data = origGetChannelData.call(this, channel);
      // Only apply subtle noise on large standard audio buffers (>2048 samples)
      if (data && data.length > 2048) {
        for (let i = 0; i < data.length; i += 100) {
          data[i] += (rng() - 0.5) * 0.00001;
        }
      }
      return data;
    };
  }
})();`
}
