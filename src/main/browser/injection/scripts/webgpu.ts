// ──────────────────────────────────────────────────────────────────
// AntiProfiles — WebGPU Capability Consistency Script Builder
// Aligns navigator.gpu adapter info with the profile's GPU & OS
// without exposing real host hardware information
// ──────────────────────────────────────────────────────────────────

import { WebGLFingerprint, NavigatorFingerprint } from '../../../fingerprint/types'

export function buildWebGPUScript(
  webgl?: WebGLFingerprint,
  nav?: NavigatorFingerprint,
  browserType: 'chrome' | 'firefox' = 'chrome'
): string {
  const isFirefox = browserType === 'firefox' || !!(nav?.userAgent && nav.userAgent.includes('Firefox'))
  const isIos = nav?.platform === 'iPhone' || !!(nav?.userAgent && nav.userAgent.includes('iPhone'))
  const renderer = webgl?.unmaskedRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  const vendor = webgl?.unmaskedVendor || 'Google Inc. (NVIDIA)'

  // Derive consistent GPU vendor / architecture from profile renderer string
  const lowerRenderer = renderer.toLowerCase()
  let gpuVendor = 'nvidia'
  let gpuArch = 'ada-lovelace'
  let gpuDevice = renderer

  if (lowerRenderer.includes('adreno')) {
    gpuVendor = 'qualcomm'
    gpuArch = 'adreno-7xx'
  } else if (lowerRenderer.includes('mali')) {
    gpuVendor = 'arm'
    gpuArch = 'valhall'
  } else if (lowerRenderer.includes('apple')) {
    gpuVendor = 'apple'
    gpuArch = 'metal-3'
  } else if (lowerRenderer.includes('intel')) {
    gpuVendor = 'intel'
    gpuArch = 'gen-12'
  } else if (lowerRenderer.includes('amd') || lowerRenderer.includes('radeon')) {
    gpuVendor = 'amd'
    gpuArch = 'rdna-3'
  }

  // Firefox & iOS Safari generally do not expose stable WebGPU by default
  if (isFirefox || isIos) {
    return `
// ═══ WebGPU Compatibility (Non-Blink) ═══
(function() {
  'use strict';
  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      Object.defineProperty(Navigator.prototype, 'gpu', {
        get: function() { return undefined; },
        configurable: true
      });
    }
  } catch (e) {}
})();`
  }

  return `
// ═══ WebGPU Adapter Info Consistency ═══
(function() {
  'use strict';
  const cloak = window.__cloakFunction || function(f) { return f; };
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') {
      return;
    }

    const profileInfo = Object.freeze({
      vendor: ${JSON.stringify(gpuVendor)},
      architecture: ${JSON.stringify(gpuArch)},
      device: ${JSON.stringify(gpuDevice)},
      description: ${JSON.stringify(vendor + ' — ' + renderer)}
    });

    const origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = cloak(async function(options) {
      const adapter = await origRequestAdapter(options);
      if (!adapter) return adapter;
      try {
        Object.defineProperty(adapter, 'info', {
          get: function() { return profileInfo; },
          configurable: true
        });
        if (typeof adapter.requestAdapterInfo === 'function') {
          adapter.requestAdapterInfo = cloak(async function() {
            return profileInfo;
          }, 'requestAdapterInfo');
        }
      } catch (e) {}
      return adapter;
    }, 'requestAdapter');
  } catch (e) {}
})();`
}
