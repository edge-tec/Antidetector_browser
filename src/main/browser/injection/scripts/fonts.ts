// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Font Masking Injection Script Builder
// Preserves website webfonts and standards-compliant font checking
// ──────────────────────────────────────────────────────────────────

import { FontsFingerprint } from '../../../fingerprint/types'

export function buildFontsScript(fonts: FontsFingerprint): string {
  if (!fonts?.enableMasking || !fonts.fontList || fonts.fontList.length === 0) {
    return '// Font masking: Disabled'
  }

  return `
// ═══ Font Masking ═══
(function() {
  'use strict';
  // Allow site font checking to work naturally without breaking webfonts
  if (typeof document !== 'undefined' && document.fonts && document.fonts.check) {
    const origCheck = document.fonts.check;
    document.fonts.check = function(font, text) {
      try {
        return origCheck.apply(this, arguments);
      } catch(e) {
        return true;
      }
    };
  }
})();`
}
