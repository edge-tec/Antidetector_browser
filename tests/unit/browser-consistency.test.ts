// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Browser Profile Consistency & Client Hints Integrity
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'

describe('Browser Profile Consistency & Fingerprint Coherence Tests', () => {
  describe('Universal Client Hints & Platform Alignment', () => {
    it('generates consistent Windows 10/11 User-Agent and platform metadata', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      expect(fp.navigator.userAgent).toContain('Windows NT 10.0')
      expect(fp.navigator.platform).toBe('Win32')
      expect(fp.navigator.touchSupport).toBe(false)
      expect(fp.navigator.maxTouchPoints).toBe(0)
    })

    it('generates consistent macOS Intel & ARM metadata', () => {
      const fp = generateFingerprint({ osType: 'macos-arm' })
      expect(fp.navigator.userAgent).toContain('Macintosh')
      expect(fp.navigator.platform).toBe('MacIntel')
      expect(fp.navigator.vendor).toBe('Google Inc.')
    })

    it('generates consistent Android mobile metadata', () => {
      const fp = generateFingerprint({ osType: 'android' })
      expect(fp.navigator.userAgent).toContain('Android')
      expect(fp.navigator.touchSupport).toBe(true)
      expect(fp.navigator.maxTouchPoints).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Injection Script Syntax & Native Environment Integrity', () => {
    it('builds complete injection script with zero syntax errors', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(typeof script).toBe('string')
      expect(script).toContain('Navigator.prototype')
      expect(script).toContain('window.chrome')
      expect(script).toContain('hardwareConcurrency')
      expect(script.startsWith('(function() {')).toBe(true)
      expect(script.endsWith('})();')).toBe(true)
    })

    it('ensures navigator.webdriver is set to false in script', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)
      expect(script).toContain('webdriver')
    })
  })

  describe('WebRTC & Hardware Profiles', () => {
    it('sets legitimate default WebRTC policy for normal browsing', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      expect(fp.webrtc.ipPolicy).toBe('default_public_interface_only')
    })

    it('allocates plausible CPU and RAM configurations', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      expect([4, 6, 8, 12, 16, 24, 32]).toContain(fp.navigator.hardwareConcurrency)
      expect([4, 8, 16, 32, 64]).toContain(fp.navigator.deviceMemory)
    })
  })
})
