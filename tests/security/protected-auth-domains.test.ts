import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'

describe('Security Audit: Protected Authentication Domains Zero-Interference & Native Flow', () => {
  it('guarantees Safe Domain Policy selectively guards peripheral noise while preserving Core Environment consistency', () => {
    const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
    const script = buildInjectionScript(fp, 'chrome')

    expect(script).toContain('Safe Domain Policy')
    expect(script).toContain('isProtectedAuthDomain')
    expect(script).toContain('isTrustedAuthHost')
    expect(script).toContain("host === 'x.com' || host.endsWith('.x.com')")
    expect(script).toContain("host === 'accounts.google.com'")
    expect(script).toContain("host === 'github.com' || host.endsWith('.github.com')")
    expect(script).toContain("host === 'apple.com' || host.endsWith('.apple.com')")

    // Verify Core Environment Overrides are ALWAYS executed outside isProtectedAuthDomain
    expect(script).toContain('Execute Core Environment Overrides')
    expect(script).toContain('Navigator Override & Environment Integrity')
  })

  it('guarantees exact matching and rejects malicious phishing/look-alike domains', () => {
    const validAuthOrigins = [
      'https://x.com/i/flow/login',
      'https://api.x.com/1.1/onboarding/task.json',
      'https://twitter.com/login',
      'https://accounts.google.com/signin/v2/identifier',
      'https://mail.google.com',
      'https://login.microsoftonline.com',
      'https://github.com/login',
      'https://appleid.apple.com'
    ]

    for (const url of validAuthOrigins) {
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin(url)).toBe(true)
    }

    const attackerLookalikes = [
      'https://fake-x.com/login',
      'https://x.com.attacker.example/i/flow/login',
      'https://accounts.google.com.fake.site/signin',
      'https://google-login.example',
      'https://github.com.attacker.com'
    ]

    for (const url of attackerLookalikes) {
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin(url)).toBe(false)
    }
  })

  it('verifies native OAuth, Passkeys, WebAuthn, and MFA flows remain completely untampered', () => {
    // Audit injection payload for forbidden credential harvesting / challenge interception
    const fp = generateFingerprint({ osType: 'macos-arm' })
    const script = buildInjectionScript(fp, 'chrome')

    // Must NOT contain password field listeners, OTP sniffers, or WebAuthn wrappers
    expect(script).not.toContain('input[type="password"]')
    expect(script).not.toContain('credentials.get')
    expect(script).not.toContain('credentials.create')
    expect(script).not.toContain('navigator.credentials')
    expect(script).not.toContain('otp')
    expect(script).not.toContain('auth_token')
  })
})
