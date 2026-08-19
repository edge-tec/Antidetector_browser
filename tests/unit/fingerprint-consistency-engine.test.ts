// ──────────────────────────────────────────────────────────────────
// Fingerprint Consistency Engine Test Suite
// Verifies internal coherence, contradiction detection, auto-recalculation,
// and engine-specific browser injection across all OSes and engines.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { generateFingerprint, recalculateDependentFields, getBuiltinTemplates } from '../../src/main/fingerprint/generator'
import { validateConsistency, detectContradictions } from '../../src/main/fingerprint/consistency'
import { buildNavigatorScript } from '../../src/main/browser/injection/scripts/navigator'
import { buildUserAgentMetadata } from '../../src/main/browser/injection/injector'
import { OSType } from '../../src/main/fingerprint/types'

describe('Fingerprint Consistency Engine & Rules Layer', () => {

  describe('1. Canonical Generated Profiles & Builtin Templates', () => {
    const testCases: Array<{ osType: OSType; browserType: 'chrome' | 'firefox'; browserVer: string }> = [
      { osType: 'windows-11', browserType: 'chrome', browserVer: '131.0.6778.86' },
      { osType: 'windows-10', browserType: 'firefox', browserVer: '129.0' },
      { osType: 'macos-arm', browserType: 'chrome', browserVer: '131.0.6778.86' },
      { osType: 'macos-intel', browserType: 'firefox', browserVer: '129.0' },
      { osType: 'linux', browserType: 'chrome', browserVer: '131.0.6778.86' },
      { osType: 'linux', browserType: 'firefox', browserVer: '129.0' },
      { osType: 'ios', browserType: 'chrome', browserVer: '131.0.6778.86' },
      { osType: 'ios', browserType: 'firefox', browserVer: '129.0' },
      { osType: 'android', browserType: 'chrome', browserVer: '131.0.6778.86' },
      { osType: 'android', browserType: 'firefox', browserVer: '129.0' }
    ]

    testCases.forEach(({ osType, browserType, browserVer }) => {
      it(`should generate 100% consistent profile for ${osType} with ${browserType}`, () => {
        const fp = generateFingerprint({
          osType,
          browserType,
          browserVersion: browserVer,
          seed: `test-${osType}-${browserType}`
        })

        const result = validateConsistency(fp, osType, browserType, browserVer)
        const contradictions = detectContradictions(fp, osType, browserType, browserVer)

        expect(contradictions).toHaveLength(0)
        expect(result.failures).toBe(0)
        expect(result.score).toBe(100)
      })
    })

    it('should validate all builtin templates as 100% coherent', () => {
      const templates = getBuiltinTemplates()
      expect(templates.length).toBeGreaterThanOrEqual(6)

      for (const tpl of templates) {
        const result = validateConsistency(tpl.fingerprint, tpl.osType, tpl.browserType, tpl.browserVersion)
        expect(result.failures).toBe(0)
        expect(result.contradictions).toHaveLength(0)
        expect(result.score).toBe(100)
      }
    })
  })

  describe('2. Contradiction Detection Rules', () => {
    it('detects contradiction when iPhone profile has desktop resolution and 1x DPR', () => {
      const badFp = generateFingerprint({ osType: 'ios', browserType: 'chrome' })
      badFp.screen.width = 1920
      badFp.screen.height = 1080
      badFp.screen.devicePixelRatio = 1.0

      const result = validateConsistency(badFp, 'ios', 'chrome')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('DPR') || c.includes('resolution') || c.includes('iPhone'))).toBe(true)
      expect(result.score).toBeLessThan(100)
    })

    it('detects contradiction when iOS profile has Firefox desktop UA or desktop platform', () => {
      const badFp = generateFingerprint({ osType: 'ios', browserType: 'firefox' })
      badFp.navigator.platform = 'Win32'
      badFp.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0'

      const result = validateConsistency(badFp, 'ios', 'firefox')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('Platform') || c.includes('User-Agent'))).toBe(true)
    })

    it('detects contradiction when Linux profile has Direct3D GPU or Win32 platform', () => {
      const badFp = generateFingerprint({ osType: 'linux', browserType: 'chrome' })
      badFp.navigator.platform = 'Win32'
      badFp.webgl.unmaskedRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)'

      const result = validateConsistency(badFp, 'linux', 'chrome')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('Direct3D') || c.includes('Win32') || c.includes('GPU'))).toBe(true)
    })

    it('detects contradiction when Windows profile has Apple Metal GPU', () => {
      const badFp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      badFp.webgl.unmaskedRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)'

      const result = validateConsistency(badFp, 'windows-11', 'chrome')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('Apple') || c.includes('Metal') || c.includes('GPU'))).toBe(true)
    })

    it('detects contradiction when Firefox profile has Google Inc. vendor or Chromium Client Hints', () => {
      const badFp = generateFingerprint({ osType: 'windows-10', browserType: 'firefox' })
      badFp.navigator.vendor = 'Google Inc.'

      const result = validateConsistency(badFp, 'windows-10', 'firefox')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('vendor') || c.includes('Firefox'))).toBe(true)
    })

    it('detects contradiction when mobile profile lacks touch support', () => {
      const badFp = generateFingerprint({ osType: 'android', browserType: 'chrome' })
      badFp.navigator.touchSupport = false
      badFp.navigator.maxTouchPoints = 0

      const result = validateConsistency(badFp, 'android', 'chrome')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('Touch') || c.includes('touch'))).toBe(true)
    })

    it('detects contradiction when iPhone profile has excessive desktop CPU cores or RAM', () => {
      const badFp = generateFingerprint({ osType: 'ios', browserType: 'chrome' })
      badFp.navigator.hardwareConcurrency = 32
      badFp.navigator.deviceMemory = 64

      const result = validateConsistency(badFp, 'ios', 'chrome')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.contradictions.some(c => c.includes('CPU') || c.includes('RAM') || c.includes('Memory'))).toBe(true)
    })
  })

  describe('3. Automatic Recalculation Engine', () => {
    it('automatically converts broken/contradictory profile into a 100% consistent profile', () => {
      // Contradictory raw profile: iOS selected, but contaminated with Windows UA, 1920x1080 screen, Win32 platform, NVIDIA GPU, 32 cores
      const contaminatedFp: any = {
        osType: 'ios',
        navigator: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
          platform: 'Win32',
          vendor: 'Google Inc.',
          hardwareConcurrency: 32,
          deviceMemory: 64,
          touchSupport: false,
          maxTouchPoints: 0
        },
        screen: {
          width: 1920,
          height: 1080,
          devicePixelRatio: 1.0
        },
        webgl: {
          unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
        }
      }

      // Execute recalculation
      const cleanFp = recalculateDependentFields(contaminatedFp, {
        osType: 'ios',
        browserType: 'chrome',
        browserVersion: '131.0.6778.86',
        deviceModelId: 'iphone-15-pro'
      })

      // Check recalculated fields
      expect(cleanFp.navigator.platform).toBe('iPhone')
      expect(cleanFp.navigator.userAgent).toContain('iPhone')
      expect(cleanFp.navigator.userAgent).toContain('CriOS/131.0.6778.86')
      expect(cleanFp.navigator.touchSupport).toBe(true)
      expect(cleanFp.navigator.maxTouchPoints).toBe(5)
      expect(cleanFp.navigator.hardwareConcurrency).toBeLessThanOrEqual(8)
      expect(cleanFp.screen.devicePixelRatio).toBeGreaterThanOrEqual(2)
      expect(cleanFp.screen.width).toBeLessThan(1000)
      expect(cleanFp.webgl.unmaskedRenderer).toContain('Apple')

      // Validate that the recalculated profile passes all consistency checks with score 100%
      const result = validateConsistency(cleanFp, 'ios', 'chrome', '131.0.6778.86')
      expect(result.failures).toBe(0)
      expect(result.contradictions).toHaveLength(0)
      expect(result.score).toBe(100)
    })

    it('correctly adapts properties when switching browser engine between Chrome and Firefox', () => {
      const winChrome = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      expect(winChrome.navigator.vendor).toBe('Google Inc.')
      expect(winChrome.navigator.userAgent).toContain('Chrome/')

      const winFirefox = recalculateDependentFields(winChrome, {
        osType: 'windows-11',
        browserType: 'firefox',
        browserVersion: '129.0'
      })

      expect(winFirefox.navigator.vendor).toBe('')
      expect(winFirefox.navigator.userAgent).toContain('Firefox/129.0')
      expect(winFirefox.navigator.userAgent).toContain('Gecko/20100101')
      expect(winFirefox.browser.type).toBe('firefox')

      const result = validateConsistency(winFirefox, 'windows-11', 'firefox', '129.0')
      expect(result.failures).toBe(0)
      expect(result.score).toBe(100)
    })
  })

  describe('4. Browser Injection & Runtime Scripts Fidelity', () => {
    it('omits window.chrome and Client Hints in Firefox navigator injection script', () => {
      const fp = generateFingerprint({ osType: 'windows-10', browserType: 'firefox', browserVersion: '129.0' })
      const script = buildNavigatorScript(fp.navigator, 'firefox')

      expect(script).toContain('delete window.chrome')
      expect(script).not.toContain('window.chrome.app =')
      expect(script).not.toContain('userAgentDataObj')
    })

    it('includes window.chrome and userAgentData in Chromium navigator injection script', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome', browserVersion: '131.0.0.0' })
      const script = buildNavigatorScript(fp.navigator, 'chrome')

      expect(script).toContain('window.chrome = {}')
      expect(script).toContain('window.chrome.app =')
      expect(script).toContain('userAgentData')
      expect(script).toContain('Google Chrome')
    })

    it('builds coherent User-Agent Client Hints metadata', () => {
      const iosFp = generateFingerprint({ osType: 'ios', browserType: 'chrome' })
      const iosMeta = buildUserAgentMetadata(iosFp)
      expect(iosMeta.platform).toBe('iOS')
      expect(iosMeta.mobile).toBe(true)
      expect(iosMeta.architecture).toBe('arm')

      const winFp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const winMeta = buildUserAgentMetadata(winFp)
      expect(winMeta.platform).toBe('Windows')
      expect(winMeta.mobile).toBe(false)
      expect(winMeta.architecture).toBe('x86')
    })
  })

})
