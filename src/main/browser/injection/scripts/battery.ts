// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Battery Injection Script Builder
// Preserves BatteryManager prototype when available
// ──────────────────────────────────────────────────────────────────

import { BatteryFingerprint } from '../../../fingerprint/types'

export function buildBatteryScript(battery: BatteryFingerprint): string {
  if (!battery?.enabled) {
    return '// Battery API: Disabled'
  }

  return `
// ═══ Battery Override ═══
(function() {
  'use strict';
  if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
    const origGetBattery = navigator.getBattery;
    navigator.getBattery = function() {
      return origGetBattery.apply(this, arguments).then(function(batteryManager) {
        if (batteryManager) {
          try {
            Object.defineProperties(batteryManager, {
              charging: { get: function() { return ${battery.charging}; }, configurable: true },
              level: { get: function() { return ${battery.level}; }, configurable: true },
              chargingTime: { get: function() { return ${battery.chargingTime === Infinity ? 'Infinity' : battery.chargingTime}; }, configurable: true },
              dischargingTime: { get: function() { return ${battery.dischargingTime === Infinity ? 'Infinity' : battery.dischargingTime}; }, configurable: true }
            });
          } catch(e) {}
        }
        return batteryManager;
      });
    };
  }
})();`
}
