import { describe, it, expect } from 'vitest'
import { validateConsistency, detectContradictions } from '../../src/main/fingerprint/consistency'
import { resolveMasterProfile } from '../../src/main/fingerprint/master-profile-resolver'
import { ProfileAutoRepairEngine } from '../../src/main/fingerprint/auto-repair'
import { recalculateDependentFields } from '../../src/main/fingerprint/generator'

describe('Profile Configuration Consistency System', () => {
  describe('1. macOS Apple Silicon (Mac ARM) + Firefox 129.0 + Apple M4', () => {
    it('generates a 100% consistent profile with genuine Firefox UA and Apple Silicon hardware', () => {
      const resolved = resolveMasterProfile({
        osType: 'macos-arm',
        browserType: 'firefox',
        browserVersion: '129.0',
        processorGen: 'M4'
      })

      // 1. User-Agent checks
      expect(resolved.userAgent).toContain('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0')
      expect(resolved.userAgent).not.toContain('AppleWebKit')
      expect(resolved.userAgent).not.toContain('Chrome')
      expect(resolved.userAgent).not.toContain('Safari')

      // 2. Engine properties
      expect(resolved.vendor).toBe('')
      expect(resolved.fingerprint.navigator.productSub).toBe('20100101')

      // 3. Hardware & Platform
      expect(resolved.platform).toBe('MacIntel')
      expect(resolved.devicePixelRatio).toBe(2)
      expect(resolved.unmaskedRenderer).toContain('Apple M4')
      expect(resolved.unmaskedVendor).toBe('Google Inc. (Apple)')

      // 4. Validation
      const validation = validateConsistency(resolved.fingerprint, 'macos-arm', 'firefox', '129.0')
      expect(validation.status).toBe('pass')
      expect(validation.score).toBe(100)
      expect(validation.failures).toBe(0)
      expect(validation.contradictions).toHaveLength(0)
    })
  })

  describe('2. macOS Apple Silicon (Mac ARM) + Chromium', () => {
    it('generates a 100% consistent Chromium profile on Apple Silicon', () => {
      const resolved = resolveMasterProfile({
        osType: 'macos-arm',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120',
        processorGen: 'M4'
      })

      expect(resolved.userAgent).toContain('AppleWebKit/537.36')
      expect(resolved.userAgent).toContain('Chrome/128.0.6613.120')
      expect(resolved.vendor).toBe('Google Inc.')
      expect(resolved.fingerprint.navigator.productSub).toBe('20030107')

      const validation = validateConsistency(resolved.fingerprint, 'macos-arm', 'chrome', '128.0.6613.120')
      expect(validation.status).toBe('pass')
      expect(validation.score).toBe(100)
      expect(validation.failures).toBe(0)
    })
  })

  describe('3. macOS Intel + Firefox', () => {
    it('generates a 100% consistent Intel Mac Firefox profile', () => {
      const resolved = resolveMasterProfile({
        osType: 'macos-intel',
        browserType: 'firefox',
        browserVersion: '129.0'
      })

      expect(resolved.userAgent).toContain('Firefox/129.0')
      expect(resolved.userAgent).not.toContain('AppleWebKit')
      expect(resolved.unmaskedRenderer).toContain('Iris')
      expect(resolved.vendor).toBe('')

      const validation = validateConsistency(resolved.fingerprint, 'macos-intel', 'firefox', '129.0')
      expect(validation.status).toBe('pass')
      expect(validation.score).toBe(100)
      expect(validation.failures).toBe(0)
    })
  })

  describe('4. Windows 11 + Firefox', () => {
    it('generates a 100% consistent Windows 11 Firefox profile', () => {
      const resolved = resolveMasterProfile({
        osType: 'windows-11',
        browserType: 'firefox',
        browserVersion: '129.0'
      })

      expect(resolved.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0')
      expect(resolved.platform).toBe('Win32')
      expect(resolved.vendor).toBe('')

      const validation = validateConsistency(resolved.fingerprint, 'windows-11', 'firefox', '129.0')
      expect(validation.status).toBe('pass')
      expect(validation.score).toBe(100)
      expect(validation.failures).toBe(0)
    })
  })

  describe('5. Windows 11 + Chromium', () => {
    it('generates a 100% consistent Windows 11 Chromium profile', () => {
      const resolved = resolveMasterProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      expect(resolved.userAgent).toContain('Windows NT 10.0; Win64; x64')
      expect(resolved.userAgent).toContain('Chrome/128.0.6613.120')
      expect(resolved.platform).toBe('Win32')
      expect(resolved.vendor).toBe('Google Inc.')

      const validation = validateConsistency(resolved.fingerprint, 'windows-11', 'chrome', '128.0.6613.120')
      expect(validation.status).toBe('pass')
      expect(validation.score).toBe(100)
      expect(validation.failures).toBe(0)
    })
  })

  describe('6. Linux + Firefox & Chromium', () => {
    it('generates 100% consistent Linux profiles for both Firefox and Chromium', () => {
      const ffResolved = resolveMasterProfile({
        osType: 'linux',
        browserType: 'firefox',
        browserVersion: '129.0'
      })
      expect(ffResolved.userAgent).toBe('Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0')
      const ffVal = validateConsistency(ffResolved.fingerprint, 'linux', 'firefox', '129.0')
      expect(ffVal.status).toBe('pass')
      expect(ffVal.score).toBe(100)

      const crResolved = resolveMasterProfile({
        osType: 'linux',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })
      expect(crResolved.userAgent).toContain('X11; Linux x86_64')
      expect(crResolved.userAgent).toContain('Chrome/128.0.6613.120')
      const crVal = validateConsistency(crResolved.fingerprint, 'linux', 'chrome', '128.0.6613.120')
      expect(crVal.status).toBe('pass')
      expect(crVal.score).toBe(100)
    })
  })

  describe('7. Auto-Fix Coherence & Self-Healing Engine', () => {
    it('successfully detects corrupt hybrid states and heals them to 100% pass', () => {
      // Create a corrupted profile state matching the user's issue:
      // OS: Mac ARM, Processor: M4, Browser: Firefox 129
      // BUT with a Chrome User-Agent and Google Inc vendor!
      const corruptFp: any = {
        seed: 'corrupt-test',
        osType: 'macos-arm',
        browser: {
          name: 'Firefox',
          type: 'firefox',
          version: '129.0'
        },
        navigator: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          browserVersion: '129.0',
          platform: 'MacIntel',
          vendor: 'Google Inc.',
          productSub: '20030107',
          hardwareConcurrency: 4,
          deviceMemory: 4
        },
        webgl: {
          enabled: true,
          gpuVendor: 'Intel',
          gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
          unmaskedVendor: 'Google Inc. (Intel)',
          unmaskedRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)'
        }
      }

      // Initial validation must fail and detect contradictions
      const initialVal = validateConsistency(corruptFp, 'macos-arm', 'firefox', '129.0')
      expect(initialVal.status).toBe('fail')
      expect(initialVal.score).toBeLessThanOrEqual(50)
      expect(initialVal.contradictions.length).toBeGreaterThan(0)
      expect(initialVal.contradictions.some(c => c.includes('User-Agent is not Firefox') || c.includes('non-Gecko tokens'))).toBe(true)

      // Execute Auto-Repair
      const repairResult = ProfileAutoRepairEngine.repair(
        {
          osType: 'macos-arm',
          browserType: 'firefox',
          browserVersion: '129.0',
          processorGen: 'M4'
        },
        corruptFp
      )

      expect(repairResult.success).toBe(true)
      expect(repairResult.repairedCount).toBeGreaterThan(0)

      // Repaired fingerprint must achieve 100% Pass
      const repairedFp = repairResult.repairedFingerprint
      expect(repairedFp.navigator.userAgent).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0')
      expect(repairedFp.navigator.vendor).toBe('')
      expect(repairedFp.navigator.productSub).toBe('20100101')
      expect(repairedFp.webgl.unmaskedRenderer).toContain('Apple M4')

      const finalVal = validateConsistency(repairedFp, 'macos-arm', 'firefox', '129.0')
      expect(finalVal.status).toBe('pass')
      expect(finalVal.score).toBe(100)
      expect(finalVal.failures).toBe(0)
      expect(finalVal.contradictions).toHaveLength(0)
    })
  })
})
