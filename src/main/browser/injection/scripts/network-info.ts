// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Network Information Injection Script Builder
// Preserves NetworkInformation prototype and overrides network parameters
// ──────────────────────────────────────────────────────────────────

import { NetworkInfoFingerprint } from '../../../fingerprint/types'

export function buildNetworkInfoScript(net: NetworkInfoFingerprint): string {
  return `
// ═══ Network Information Override ═══
(function() {
  'use strict';
  if (typeof navigator !== 'undefined' && navigator.connection) {
    try {
      const netConn = navigator.connection;
      if (typeof NetworkInformation !== 'undefined' && NetworkInformation.prototype) {
        Object.defineProperties(NetworkInformation.prototype, {
          effectiveType: { get: function() { return ${JSON.stringify(net.effectiveType)}; }, configurable: true },
          rtt: { get: function() { return ${net.rtt}; }, configurable: true },
          downlink: { get: function() { return ${net.downlink}; }, configurable: true },
          saveData: { get: function() { return ${net.saveData}; }, configurable: true }
        });
      } else {
        Object.defineProperties(netConn, {
          effectiveType: { get: function() { return ${JSON.stringify(net.effectiveType)}; }, configurable: true },
          rtt: { get: function() { return ${net.rtt}; }, configurable: true },
          downlink: { get: function() { return ${net.downlink}; }, configurable: true },
          saveData: { get: function() { return ${net.saveData}; }, configurable: true }
        });
      }
    } catch(e) {}
  }
})();`
}
