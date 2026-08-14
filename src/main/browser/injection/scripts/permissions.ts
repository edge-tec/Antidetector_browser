// ──────────────────────────────────────────────────────────────────
// ProfileVault — Permissions Injection Script Builder
// Overrides navigator.permissions.query()
// ──────────────────────────────────────────────────────────────────

import { PermissionsFingerprint, PermissionState } from '../../../fingerprint/types'

export function buildPermissionsScript(perms: PermissionsFingerprint): string {
  const permMap: Record<string, PermissionState> = {
    camera: perms.camera,
    microphone: perms.microphone,
    geolocation: perms.geolocation,
    notifications: perms.notifications,
    'clipboard-read': perms.clipboard,
    'clipboard-write': perms.clipboard,
    midi: perms.midi,
    accelerometer: perms.sensors,
    gyroscope: perms.sensors,
    magnetometer: perms.sensors,
    usb: perms.usb,
    bluetooth: perms.bluetooth,
    'background-sync': perms.backgroundSync,
    'persistent-storage': perms.persistentStorage
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
