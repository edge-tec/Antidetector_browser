// ──────────────────────────────────────────────────────────────────
// ProfileVault — Network Information Injection Script Builder
// Overrides navigator.connection properties
// ──────────────────────────────────────────────────────────────────

import { NetworkInfoFingerprint } from '../../../fingerprint/types'

export function buildNetworkInfoScript(net: NetworkInfoFingerprint): string {
  return `
// ═══ Network Information Override ═══
(function() {
  const netInfo = {
    effectiveType: ${JSON.stringify(net.effectiveType)},
    downlink: ${net.downlink},
    rtt: ${net.rtt},
    saveData: ${net.saveData},
    type: ${JSON.stringify(net.type)},
    onchange: null,
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; }
  };

  try {
    Object.defineProperty(Navigator.prototype, 'connection', {
      get: function() { return netInfo; },
      configurable: true
    });
  } catch(e) {}

  // Also override mozConnection and webkitConnection
  try {
    Object.defineProperty(Navigator.prototype, 'mozConnection', {
      get: function() { return netInfo; },
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, 'webkitConnection', {
      get: function() { return netInfo; },
      configurable: true
    });
  } catch(e) {}
})();`
}
