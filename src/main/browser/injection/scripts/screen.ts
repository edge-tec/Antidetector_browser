// ──────────────────────────────────────────────────────────────────
// ProfileVault — Screen Injection Script Builder
// Overrides window.screen.* and viewport properties
// ──────────────────────────────────────────────────────────────────

import { ScreenFingerprint } from '../../../fingerprint/types'

export function buildScreenScript(screen: ScreenFingerprint): string {
  return `
// ═══ Screen & Display Override ═══
(function() {
  const screenOverrides = {
    width: ${screen.width},
    height: ${screen.height},
    availWidth: ${screen.availWidth},
    availHeight: ${screen.availHeight},
    colorDepth: ${screen.colorDepth},
    pixelDepth: ${screen.pixelDepth}
  };

  for (const [key, value] of Object.entries(screenOverrides)) {
    try {
      Object.defineProperty(Screen.prototype, key, {
        get: function() { return value; },
        configurable: true
      });
    } catch(e) {}
  }

  // Device pixel ratio
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      get: function() { return ${screen.devicePixelRatio}; },
      configurable: true
    });
  } catch(e) {}

  // Screen orientation
  try {
    if (screen.orientation) {
      Object.defineProperty(screen.orientation, 'type', {
        get: function() { return ${JSON.stringify(screen.orientation)}; },
        configurable: true
      });
      Object.defineProperty(screen.orientation, 'angle', {
        get: function() { return ${screen.orientationAngle}; },
        configurable: true
      });
    }
  } catch(e) {}

})();`
}
