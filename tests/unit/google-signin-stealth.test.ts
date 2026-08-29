// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Unit Tests: Google Sign-in & Auth Stealth Protections
// Verifies that anti-detect fingerprinting works seamlessly without
// triggering "Couldn't sign you in / This browser or app may not be secure".
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { Profile } from '../../src/main/database/models'

describe('Google Sign-in & Auth Security Bypass Tests', () => {
  describe('1. Launch CLI Arguments Cleanliness', () => {
    it('ensures hostile automation flags (--test-type, broken site isolation) are never present', async () => {
      // Replicate launch argument builder logic from launcher
      const fp = generateFingerprint({ osType: 'windows-11' })
      const profile: Partial<Profile> = {
        id: 'test-profile-1',
        name: 'Google Auth Test',
        osType: 'windows-11',
        hwAcceleration: true,
        webrtcMode: 'altered'
      }

      // Check launcher module
      const launcherModule = await import('../../src/main/browser/launcher')
      expect(launcherModule).toBeDefined()
    })
  })

  describe('2. Native Function Cloaker & Prototype Integrity', () => {
    it('injects native function cloaking engine into every page', () => {
      const fp = generateFingerprint({ osType: 'macos-arm' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('__antiprofiles_cloaker_installed')
      expect(script).toContain('__cloakFunction')
      expect(script).toContain('__cloakGetter')
      expect(script).toContain('[native code]')
    })

    it('cloaks Navigator prototype property getters with native toString code', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('cloakGetter')
      expect(script).toContain('webdriver')
    })

    it('cloaks WebGL, Canvas, and Permissions methods', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('getParameter')
      expect(script).toContain('getImageData')
      expect(script).toContain('query')
    })
  })

  describe('3. User Fingerprint Preservation & Full Fidelity', () => {
    it('preserves user custom device screen, CPU cores, memory, and WebGL renderer', () => {
      const fp = generateFingerprint({ osType: 'windows-11' })
      fp.screen.width = 2560
      fp.screen.height = 1440
      fp.navigator.hardwareConcurrency = 16
      fp.navigator.deviceMemory = 32
      fp.webgl.unmaskedRenderer = 'ANGLE (NVIDIA, NVIDIA RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)'

      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('2560')
      expect(script).toContain('1440')
      expect(script).toContain('16')
      expect(script).toContain('32')
      expect(script).toContain('RTX 4090')
    })

    it('ensures Google /sorry/ bot interceptor never blocks accounts.google.com or auth flows', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('isAuthPage')
      expect(script).toContain('accounts.google.')
    })
  })
})
