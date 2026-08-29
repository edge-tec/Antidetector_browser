// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Permissions Injection Script Builder
// Overrides navigator.permissions.query() while preserving PermissionStatus prototype
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
  'use strict';
  const cloak = window.__cloakFunction || function(f) { return f; };
  const PERM_MAP = ${JSON.stringify(permMap)};

  if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
    const origQuery = navigator.permissions.query;
    navigator.permissions.query = cloak(function(desc) {
      return origQuery.apply(this, arguments).then(function(permStatus) {
        const name = desc && desc.name;
        if (name && PERM_MAP[name] && permStatus) {
          try {
            if (typeof PermissionStatus !== 'undefined' && PermissionStatus.prototype) {
              const origGetter = Object.getOwnPropertyDescriptor(PermissionStatus.prototype, 'state')?.get;
              // Return status transparently
            }
          } catch(e) {}
        }
        return permStatus;
      });
    }, 'query');
  }
})();`
}
