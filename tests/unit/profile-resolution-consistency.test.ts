import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalProfile,
  resolveUserAgent,
  resolvePlatform
} from '../../src/main/fingerprint/resolvers'
import { recalculateDependentFields } from '../../src/main/fingerprint/generator'
import { validateConsistency, detectContradictions } from '../../src/main/fingerprint/consistency'
import { createDefaultFingerprint, Fingerprint } from '../../src/main/fingerprint/types'

describe('Profile Resolution & Consistency Engine', () => {
  describe('Exact Screenshot Scenario Regression Test', () => {
    it('should cleanly resolve Mac ARM + Google Chrome 128.0.6613.120 without Firefox or Intel contradictions', () => {
      const resolved = resolveCanonicalProfile({
        osType: 'macos-arm',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      // 1. Browser & Engine validation
      expect(resolved.browser.type).toBe('chrome')
      expect(resolved.browser.name).toBe('Chrome')
      expect(resolved.browser.version).toBe('128.0.6613.120')

      // 2. Navigator validation
      expect(resolved.navigator.browserVersion).toBe('128.0.6613.120')
      expect(resolved.navigator.chromiumVersion).toBe('128')
      expect(resolved.navigator.vendor).toBe('Google Inc.')
      expect(resolved.navigator.platform).toBe('MacIntel')

      // 3. User-Agent string validation: Must be Chrome, NO Firefox tokens
      const ua = resolved.navigator.userAgent
      expect(ua).toContain('Chrome/128.0.6613.120')
      expect(ua).toContain('Macintosh')
      expect(ua).not.toContain('Firefox')
      expect(ua).not.toContain('rv:129')
      expect(ua).not.toContain('Gecko/20100101')
      expect(ua).not.toContain('FxiOS')

      // 4. GPU / WebGL validation for Mac ARM
      expect(resolved.webgl.gpuVendor).toBe('Apple')
      expect(resolved.webgl.unmaskedVendor).toContain('Apple')
      expect(resolved.webgl.unmaskedRenderer).toContain('Apple')

      // 5. Full consistency validation
      const consistency = validateConsistency(resolved, 'macos-arm', 'chrome', '128.0.6613.120')
      expect(consistency.status).toBe('pass')
      expect(consistency.failures).toBe(0)
      expect(consistency.contradictions).toHaveLength(0)
      expect(consistency.score).toBeGreaterThanOrEqual(90)
    })
  })

  describe('Cross-Browser Switching State Invalidation', () => {
    it('should completely purge Firefox tokens when switching an existing Firefox profile to Chrome', () => {
      // Create existing Firefox profile
      const firefoxFp = resolveCanonicalProfile({
        osType: 'macos-arm',
        browserType: 'firefox',
        browserVersion: '129.0'
      })
      expect(firefoxFp.navigator.userAgent).toContain('Firefox/129.0')
      expect(firefoxFp.navigator.vendor).toBe('')

      // Switch to Chrome 128
      const switchedToChrome = recalculateDependentFields(firefoxFp, {
        osType: 'macos-arm',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      expect(switchedToChrome.browser.type).toBe('chrome')
      expect(switchedToChrome.browser.version).toBe('128.0.6613.120')
      expect(switchedToChrome.navigator.browserVersion).toBe('128.0.6613.120')
      expect(switchedToChrome.navigator.vendor).toBe('Google Inc.')

      const chromeUa = switchedToChrome.navigator.userAgent
      expect(chromeUa).toContain('Chrome/128.0.6613.120')
      expect(chromeUa).not.toContain('Firefox')
      expect(chromeUa).not.toContain('rv:')
      expect(chromeUa).not.toContain('Gecko/20100101')

      const validation = validateConsistency(switchedToChrome, 'macos-arm', 'chrome', '128.0.6613.120')
      expect(validation.status).toBe('pass')
      expect(validation.failures).toBe(0)
    })

    it('should completely purge Chrome tokens when switching an existing Chrome profile to Firefox', () => {
      // Create existing Chrome profile
      const chromeFp = resolveCanonicalProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })
      expect(chromeFp.navigator.userAgent).toContain('Chrome/128.0.6613.120')
      expect(chromeFp.navigator.vendor).toBe('Google Inc.')

      // Switch to Firefox 129.0
      const switchedToFirefox = recalculateDependentFields(chromeFp, {
        osType: 'windows-11',
        browserType: 'firefox',
        browserVersion: '129.0'
      })

      expect(switchedToFirefox.browser.type).toBe('firefox')
      expect(switchedToFirefox.browser.version).toBe('129.0')
      expect(switchedToFirefox.navigator.browserVersion).toBe('129.0')
      expect(switchedToFirefox.navigator.vendor).toBe('')

      const firefoxUa = switchedToFirefox.navigator.userAgent
      expect(firefoxUa).toContain('Firefox/129.0')
      expect(firefoxUa).toContain('rv:129.0')
      expect(firefoxUa).not.toContain('Chrome')
      expect(firefoxUa).not.toContain('Safari')

      const validation = validateConsistency(switchedToFirefox, 'windows-11', 'firefox', '129.0')
      expect(validation.status).toBe('pass')
      expect(validation.failures).toBe(0)
    })
  })

  describe('OS Switching Invalidation', () => {
    it('should adapt GPU, Platform, and User-Agent when switching from Mac ARM to Windows 11', () => {
      const macFp = resolveCanonicalProfile({
        osType: 'macos-arm',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      const winFp = recalculateDependentFields(macFp, {
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      expect(winFp.navigator.platform).toBe('Win32')
      expect(winFp.navigator.userAgent).toContain('Windows NT 10.0')
      expect(winFp.navigator.userAgent).not.toContain('Macintosh')
      expect(winFp.webgl.gpuVendor).not.toBe('Apple')
      expect(winFp.webgl.unmaskedVendor).not.toContain('Apple')

      const validation = validateConsistency(winFp, 'windows-11', 'chrome', '128.0.6613.120')
      expect(validation.status).toBe('pass')
      expect(validation.failures).toBe(0)
    })
  })

  describe('Consistency Scoring & Contradiction Failure Guard', () => {
    it('must FAIL consistency check and cap score when a Chrome profile is infected with a Firefox UA', () => {
      const corruptFp = resolveCanonicalProfile({
        osType: 'macos-arm',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      // Forcefully corrupt UA with Firefox
      corruptFp.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0'

      const result = validateConsistency(corruptFp, 'macos-arm', 'chrome', '128.0.6613.120')

      // Must be FAIL, score <= 50 (never 91% or Pass)
      expect(result.status).toBe('fail')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.score).toBeLessThanOrEqual(50)
      expect(result.contradictions.some(c => c.includes('Contradiction: Profile is configured as Google Chrome'))).toBe(true)
    })

    it('must FAIL consistency check when OS is Windows but platform is iPhone', () => {
      const corruptFp = resolveCanonicalProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      corruptFp.navigator.platform = 'iPhone'

      const result = validateConsistency(corruptFp, 'windows-11', 'chrome', '128.0.6613.120')
      expect(result.status).toBe('fail')
      expect(result.failures).toBeGreaterThan(0)
      expect(result.score).toBeLessThanOrEqual(50)
    })
  })
})
