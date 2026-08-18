// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: X (Twitter) Login & Browser Standards Compatibility
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'

describe('X (Twitter) & Standards-Compliant Browser Compatibility Tests', () => {
  describe('1. Navigator Environment & Plugins Support', () => {
    it('generates standard desktop plugins and mimeTypes in injection script', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('PluginArray')
      expect(script).toContain('MimeTypeArray')
      expect(script).toContain('PDF Viewer')
      expect(script).toContain('Chrome PDF Viewer')
      expect(script).toContain('application/pdf')
    })

    it('ensures standard window.chrome environment is initialized', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('window.chrome')
      expect(script).toContain('loadTimes')
      expect(script).toContain('csi')
      expect(script).toContain('runtime')
      expect(script).toContain('app')
    })

    it('ensures navigator.webdriver is cleanly false', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('get webdriver')
      expect(script).toContain('return false')
    })
  })

  describe('2. WebGL & Typography (Fonts) Integrity', () => {
    it('does not corrupt WebGLDebugRendererInfo prototype or getExtension', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('UNMASKED_VENDOR_WEBGL')
      expect(script).toContain('UNMASKED_RENDERER_WEBGL')
      expect(script).not.toContain('UNMASKED_VENDOR_WEBGL: 0x9245')
    })

    it('does not block site webfonts (like TwitterChirp)', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('document.fonts.check')
    })
  })

  describe('3. Native Function Masking & DOM Fidelity', () => {
    it('includes native toString fidelity helper in script', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('[native code]')
      expect(script).toContain('Function.prototype.toString')
    })
  })

  describe('4. Client Hints & Network Information', () => {
    it('includes authentic userAgentData getHighEntropyValues', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('getHighEntropyValues')
      expect(script).toContain('brands')
      expect(script).toContain('fullVersionList')
    })

    it('preserves NetworkInformation prototype safely', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('NetworkInformation')
    })
  })
})
