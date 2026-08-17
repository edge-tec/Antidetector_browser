// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Permissions Injection Script Builder
// Overrides navigator.permissions.query() safely
// ──────────────────────────────────────────────────────────────────

import { PermissionsFingerprint, PermissionState } from '../../../fingerprint/types'

export function buildPermissionsScript(perms: PermissionsFingerprint): string {
  const safePerms = perms || {
    camera: 'prompt',
    microphone: 'prompt',
    geolocation: 'prompt',
    notifications: 'prompt',
    clipboard: 'prompt'
  }

  const permMap: Record<string, PermissionState> = {
    camera: safePerms.camera || 'prompt',
    microphone: safePerms.microphone || 'prompt',
    geolocation: safePerms.geolocation || 'prompt',
    notifications: safePerms.notifications || 'prompt',
    'clipboard-read': safePerms.clipboard || 'prompt',
    'clipboard-write': safePerms.clipboard || 'prompt',
    midi: safePerms.midi || 'prompt',
    accelerometer: safePerms.sensors || 'prompt',
    gyroscope: safePerms.sensors || 'prompt',
    magnetometer: safePerms.sensors || 'prompt',
    usb: safePerms.usb || 'prompt',
    bluetooth: safePerms.bluetooth || 'prompt',
    'background-sync': safePerms.backgroundSync || 'prompt',
    'persistent-storage': safePerms.persistentStorage || 'prompt'
  }

  return `
// ═══ Permissions Override ═══
(function() {
  const PERM_MAP = ${JSON.stringify(permMap)};

  if (navigator.permissions && navigator.permissions.query) {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(desc) {
      const name = desc && desc.name;
      if (name && PERM_MAP[name]) {
        return Promise.resolve({
          state: PERM_MAP[name],
          status: PERM_MAP[name],
          name: name,
          onchange: null,
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return true; }
        });
      }
      return origQuery(desc);
    };
  }
})();`
}
