// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Screen Injection Script Builder
// Overrides window.screen.* and viewport properties safely
// ──────────────────────────────────────────────────────────────────

import { ScreenFingerprint } from '../../../fingerprint/types'

export function buildScreenScript(screen: ScreenFingerprint): string {
  const safe = {
    width: screen?.width || 1920,
    height: screen?.height || 1080,
    availWidth: screen?.availWidth || screen?.width || 1920,
    availHeight: screen?.availHeight || (screen?.height ? screen.height - 40 : 1040),
    colorDepth: screen?.colorDepth || 24,
    pixelDepth: screen?.pixelDepth || 24,
    devicePixelRatio: screen?.devicePixelRatio || 1,
    orientation: screen?.orientation || 'landscape-primary',
    orientationAngle: screen?.orientationAngle ?? 0
  }

  return `
// ═══ Screen & Display Override ═══
(function() {
  const screenOverrides = {
    width: ${safe.width},
    height: ${safe.height},
    availWidth: ${safe.availWidth},
    availHeight: ${safe.availHeight},
    colorDepth: ${safe.colorDepth},
    pixelDepth: ${safe.pixelDepth}
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
      get: function() { return ${safe.devicePixelRatio}; },
      configurable: true
    });
  } catch(e) {}

  // Screen orientation
  try {
    if (window.screen && window.screen.orientation) {
      Object.defineProperty(window.screen.orientation, 'type', {
        get: function() { return ${JSON.stringify(safe.orientation)}; },
        configurable: true
      });
      Object.defineProperty(window.screen.orientation, 'angle', {
        get: function() { return ${safe.orientationAngle}; },
        configurable: true
      });
    }
  } catch(e) {}

  // Spoof outerWidth/outerHeight to match screen dimensions
  try {
    Object.defineProperty(window, 'outerWidth', {
      get: function() { return ${safe.width}; },
      configurable: true
    });
    Object.defineProperty(window, 'outerHeight', {
      get: function() { return ${safe.height}; },
      configurable: true
    });
  } catch(e) {}

})();`
}
