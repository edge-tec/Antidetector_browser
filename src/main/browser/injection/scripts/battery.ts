// ──────────────────────────────────────────────────────────────────
// ProfileVault — Battery Injection Script Builder
// Overrides navigator.getBattery() API
// ──────────────────────────────────────────────────────────────────

import { BatteryFingerprint } from '../../../fingerprint/types'

export function buildBatteryScript(battery: BatteryFingerprint): string {
  if (!battery.enabled) {
    return `
// ═══ Battery API Disabled ═══
(function() {
  if (navigator.getBattery) {
    navigator.getBattery = undefined;
    try {
      Object.defineProperty(Navigator.prototype, 'getBattery', {
        get: () => undefined,
        configurable: true
      });
    } catch(e) {}
  }
})();`
  }

  return `
// ═══ Battery Override ═══
(function() {
  const batteryInfo = {
    charging: ${battery.charging},
    chargingTime: ${battery.chargingTime === Infinity ? 'Infinity' : battery.chargingTime},
    dischargingTime: ${battery.dischargingTime === Infinity ? 'Infinity' : battery.dischargingTime},
    level: ${battery.level},
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; },
    onchargingchange: null,
    onchargingtimechange: null,
    ondischargingtimechange: null,
    onlevelchange: null
  };

  if (navigator.getBattery) {
    Object.defineProperty(Navigator.prototype, 'getBattery', {
      value: function() { return Promise.resolve(batteryInfo); },
      configurable: true,
      writable: true
    });
  }
})();`
}
