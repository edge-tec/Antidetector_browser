import { describe, it, expect } from 'vitest'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'

describe('Universal Cross-Platform Authentication Compatibility Engine', () => {
  it('identifies all standard protected authentication origins and subdomains', () => {
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com/i/flow/login')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://api.x.com/oauth/authenticate')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://twitter.com/login')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://accounts.google.com/v3/signin')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://mail.google.com')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://appleid.apple.com/auth/authorize')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://login.microsoftonline.com/common/oauth2')).toBe(true)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://github.com/login')).toBe(true)
  })

  it('rejects malicious phishing look-alike domains without false positives', () => {
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com.attacker.example/login')).toBe(false)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://fake-x.com/login')).toBe(false)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://twitter.com.phishing.io')).toBe(false)
    expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://accounts.google.com.fake.site')).toBe(false)
  })

  it('evaluates Desktop-to-Desktop OS switching as fully COMPATIBLE with storage preservation', () => {
    const report = AuthCompatibilityEngine.checkCompatibility('macOS-AppleSilicon', 'windows-11', 'desktop', 'desktop')
    expect(report.rating).toBe('COMPATIBLE')
    expect(report.preservesStorage).toBe(true)
    expect(report.requiresReauth).toBe(false)
  })

  it('evaluates Desktop-to-Mobile OS transition as COMPATIBLE_WITH_REAUTH and reports native hardware gaps', () => {
    const report = AuthCompatibilityEngine.checkCompatibility('macOS', 'iOS', 'desktop', 'mobile')
    expect(report.rating).toBe('COMPATIBLE_WITH_REAUTH')
    expect(report.preservesStorage).toBe(true)
    expect(report.requiresReauth).toBe(true)
    expect(report.unsupportedCapabilities.length).toBeGreaterThan(0)
    expect(report.unsupportedCapabilities).toContain('Apple Secure Enclave Hardware Passkey Attestation')
  })
})
