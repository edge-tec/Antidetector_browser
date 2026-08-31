import { describe, it, expect } from 'vitest'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'
import { DeviceConsistencyValidator } from '../../src/main/browser/device/device-consistency'

describe('Universal Cross-Platform Authentication Compatibility & Runtime Consistency', () => {
  describe('1. Protected Authentication Origins & Phishing Rejection', () => {
    it('identifies all standard protected authentication origins and subdomains with exact matching', () => {
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com/i/flow/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://api.x.com/oauth/authenticate')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://twitter.com/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://accounts.google.com/v3/signin')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://mail.google.com')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://appleid.apple.com/auth/authorize')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://login.microsoftonline.com/common/oauth2')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://github.com/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://facebook.com/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://instagram.com/accounts/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://linkedin.com/checkpoint/rp/request-password-reset')).toBe(true)
    })

    it('rejects malicious phishing look-alike domains without false positives', () => {
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://fake-x.com/login')).toBe(false)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com.attacker.example/login')).toBe(false)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://accounts.google.com.attacker.example/signin')).toBe(false)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://google-login.example/auth')).toBe(false)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://twitter.com.phishing.io')).toBe(false)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://github.com.fake.site')).toBe(false)
    })
  })

  describe('2. Cross-Platform Compatibility Matrix (Specification §12)', () => {
    it('evaluates macOS ARM64 -> macOS Desktop as COMPATIBLE', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('macOS-ARM64', 'macOS', 'desktop', 'desktop')
      expect(res.rating).toBe('COMPATIBLE')
      expect(res.preservesStorage).toBe(true)
      expect(res.requiresReauth).toBe(false)
    })

    it('evaluates macOS x64 -> macOS Desktop as COMPATIBLE', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('macOS-x64', 'macOS', 'desktop', 'desktop')
      expect(res.rating).toBe('COMPATIBLE')
      expect(res.preservesStorage).toBe(true)
    })

    it('evaluates Windows x64 -> Windows Desktop as COMPATIBLE', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('windows-11', 'windows-10', 'desktop', 'desktop')
      expect(res.rating).toBe('COMPATIBLE')
      expect(res.preservesStorage).toBe(true)
    })

    it('evaluates Linux x64 -> Linux Desktop as COMPATIBLE', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('linux', 'linux', 'desktop', 'desktop')
      expect(res.rating).toBe('COMPATIBLE')
      expect(res.preservesStorage).toBe(true)
    })

    it('evaluates macOS -> Windows Presentation as COMPATIBLE desktop switch', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('macOS-AppleSilicon', 'windows-11', 'desktop', 'desktop')
      expect(res.rating).toBe('COMPATIBLE')
      expect(res.preservesStorage).toBe(true)
      expect(res.requiresReauth).toBe(false)
    })

    it('evaluates macOS -> Linux Presentation as COMPATIBLE desktop switch', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('macOS', 'linux', 'desktop', 'desktop')
      expect(res.rating).toBe('COMPATIBLE')
      expect(res.preservesStorage).toBe(true)
    })

    it('evaluates Desktop -> Android Presentation as COMPATIBLE_WITH_REAUTH with explicit hardware gaps', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('macOS', 'android', 'desktop', 'mobile')
      expect(res.rating).toBe('COMPATIBLE_WITH_REAUTH')
      expect(res.preservesStorage).toBe(true)
      expect(res.requiresReauth).toBe(true)
      expect(res.unsupportedCapabilities).toContain('Native Android SafetyNet/Play Integrity Hardware API')
    })

    it('evaluates Desktop -> iOS Presentation as COMPATIBLE_WITH_REAUTH with explicit hardware gaps', () => {
      const res = AuthCompatibilityEngine.checkCompatibility('windows-11', 'ios', 'desktop', 'mobile')
      expect(res.rating).toBe('COMPATIBLE_WITH_REAUTH')
      expect(res.preservesStorage).toBe(true)
      expect(res.requiresReauth).toBe(true)
      expect(res.unsupportedCapabilities).toContain('Apple Secure Enclave Hardware Passkey Attestation')
      expect(res.unsupportedCapabilities).toContain('Native iOS WebKit Engine (Running on Chromium Runtime)')
    })
  })

  describe('3. Original X.com Failure Reproduction & Fix Verification (§14)', () => {
    it('accurately detects the original buggy state as INCONSISTENT (FAIL)', () => {
      // Buggy scenario:
      // Physical Runtime: macOS
      // Selected Presentation: Windows
      // HTTP User-Agent: Windows
      // Sec-CH-UA-Platform: Windows
      // navigator.platform: MacIntel (unmasked host leaked)
      // navigator.userAgentData.platform: macOS (unmasked host leaked)
      const winProfile = DeviceConsistencyValidator.resolvePlatformProfile({
        osType: 'windows-10',
        browserType: 'chrome'
      })

      const buggyAudit = DeviceConsistencyValidator.checkPlatformConsistency({
        platformProfile: winProfile,
        httpHeaders: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          secChUaPlatform: '"Windows"'
        },
        jsEnvironment: {
          navigatorPlatform: 'MacIntel', // Leaked host
          navigatorUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
          userAgentDataPlatform: 'macOS' // Leaked host
        }
      })

      expect(buggyAudit.consistent).toBe(false)
      expect(buggyAudit.mismatches.length).toBeGreaterThan(0)
      expect(buggyAudit.diagnosticReport).toContain('[Consistency: FAIL]')
      expect(buggyAudit.diagnosticReport).toContain('CRITICAL MISMATCH')
    })

    it('validates the fixed AntiProfiles configuration as 100% CONSISTENT (PASS)', () => {
      // Fixed scenario:
      // Authoritative Platform Profile: Windows
      // HTTP User-Agent: Windows
      // Sec-CH-UA-Platform: Windows
      // navigator.platform: Win32
      // navigator.userAgentData.platform: Windows
      const winProfile = DeviceConsistencyValidator.resolvePlatformProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '131.0.0.0'
      })

      const fixedAudit = DeviceConsistencyValidator.checkPlatformConsistency({
        platformProfile: winProfile,
        httpHeaders: {
          userAgent: winProfile.userAgent,
          secChUaPlatform: `"${winProfile.clientHintsPlatform}"`
        },
        jsEnvironment: {
          navigatorPlatform: winProfile.platformString,
          navigatorUserAgent: winProfile.userAgent,
          userAgentDataPlatform: winProfile.clientHintsPlatform,
          userAgentDataMobile: winProfile.mobile
        }
      })

      expect(fixedAudit.consistent).toBe(true)
      expect(fixedAudit.mismatches.length).toBe(0)
      expect(fixedAudit.diagnosticReport).toContain('[Consistency: PASS]')
      expect(fixedAudit.presentation.platformString).toBe('Win32')
      expect(fixedAudit.presentation.clientHintsPlatform).toBe('Windows')
    })
  })
})
