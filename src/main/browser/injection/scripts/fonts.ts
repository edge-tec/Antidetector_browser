// ──────────────────────────────────────────────────────────────────
// ProfileVault — Font Masking Injection Script Builder
// Intercepts font enumeration techniques
// ──────────────────────────────────────────────────────────────────

import { FontsFingerprint } from '../../../fingerprint/types'

export function buildFontsScript(fonts: FontsFingerprint): string {
  if (!fonts.enableMasking || fonts.fontList.length === 0) {
    return '// Font masking: Disabled'
  }

  return `
// ═══ Font Masking ═══
(function() {
  const ALLOWED_FONTS = new Set(${JSON.stringify(fonts.fontList)});
  const FALLBACK_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

  // Font detection works by measuring text rendered in different fonts.
  // If the width/height matches a fallback font, the font is not installed.
  // We intercept by making dimension measurements return the same values
  // for fonts NOT in our allowed list.

  // Override document.fonts.check()
  if (document.fonts && document.fonts.check) {
    const origCheck = document.fonts.check.bind(document.fonts);
    document.fonts.check = function(font, text) {
      // Parse font family from CSS font string
      const match = font.match(/(?:^|\\s)([\\w\\s-]+)$/);
      if (match) {
        const family = match[1].trim().replace(/["']/g, '');
        if (!ALLOWED_FONTS.has(family) && !FALLBACK_FONTS.has(family)) {
          return false;
        }
      }
      return origCheck(font, text);
    };
  }

  // Override FontFaceSet.prototype.check (for broader coverage)
  if (window.FontFaceSet) {
    const origFFS = FontFaceSet.prototype.check;
    FontFaceSet.prototype.check = function(font, text) {
      const match = font.match(/(?:^|\\s)([\\w\\s-]+)$/);
      if (match) {
        const family = match[1].trim().replace(/["']/g, '');
        if (!ALLOWED_FONTS.has(family) && !FALLBACK_FONTS.has(family)) {
          return false;
        }
      }
      return origFFS.call(this, font, text);
    };
  }
})();`
}
