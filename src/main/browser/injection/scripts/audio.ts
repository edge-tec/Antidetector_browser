// ──────────────────────────────────────────────────────────────────
// ProfileVault — AudioContext Injection Script Builder
// Adds deterministic noise to AudioContext fingerprinting methods safely
// ──────────────────────────────────────────────────────────────────

import { AudioFingerprint } from '../../../fingerprint/types'

export function buildAudioScript(audio: AudioFingerprint): string {
  const safeMode = audio?.mode || 'noise'
  const safeSeed = audio?.noiseSeed || 54321
  const safeSampleRate = audio?.sampleRate || 44100

  if (safeMode === 'off') {
    return `
// ═══ AudioContext Disabled ═══
(function() {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  window.OfflineAudioContext = undefined;
  window.webkitOfflineAudioContext = undefined;
})();`
  }

  if (safeMode === 'default') {
    return '// AudioContext: Default (no override)'
  }

  return `
// ═══ AudioContext Noise (Seed: ${safeSeed}) ═══
(function() {
  const SEED = ${safeSeed};
  const SAMPLE_RATE = ${safeSampleRate};

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(SEED);

  // Override AudioContext.sampleRate
  if (window.AudioContext) {
    const OrigAudioContext = window.AudioContext;
    window.AudioContext = function() {
      const ctx = new OrigAudioContext(...arguments);
      try {
        Object.defineProperty(ctx, 'sampleRate', {
          get: () => SAMPLE_RATE,
          configurable: true
        });
      } catch(e) {}
      return ctx;
    };
    window.AudioContext.prototype = OrigAudioContext.prototype;
  }

  // Override AnalyserNode frequency data
  if (window.AnalyserNode) {
    const origGetFloat = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function(array) {
      origGetFloat.call(this, array);
      for (let i = 0; i < array.length; i += 10) {
        array[i] += (rng() - 0.5) * 0.001;
      }
    };

    const origGetByte = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function(array) {
      origGetByte.call(this, array);
      for (let i = 0; i < array.length; i += 10) {
        const noise = Math.floor(rng() * 3) - 1;
        array[i] = Math.max(0, Math.min(255, array[i] + noise));
      }
    };
  }

  // Override AudioBuffer.getChannelData
  if (window.AudioBuffer) {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function(channel) {
      const data = origGetChannelData.call(this, channel);
      for (let i = 0; i < data.length; i += 100) {
        data[i] += (rng() - 0.5) * 0.0001;
      }
      return data;
    };
  }
})();`
}
