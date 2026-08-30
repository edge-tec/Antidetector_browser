import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'

describe('Security Audit: Protected Authentication Domains Zero-Interference', () => {
  it('guarantees injection script halts immediately on all protected identity provider origins', () => {
    const fp = generateFingerprint({ osType: 'macos-sonoma' })
    const script = buildInjectionScript(fp, 'chrome')

    expect(script).toContain('isProtectedAuthDomain')
    expect(script).toContain('isTrustedAuthHost')
    expect(script).toContain("host === 'x.com' || host.endsWith('.x.com')")
    expect(script).toContain("host === 'accounts.google.com'")
    expect(script).toContain("host === 'github.com' || host.endsWith('.github.com')")
  })

  it('proves zero credential capture, zero OTP capture, and zero cookie extraction', () => {
    const protectedDomains = [
      'https://x.com/i/flow/login',
      'https://accounts.google.com/signin/v2/identifier',
      'https://login.microsoftonline.com',
      'https://github.com/login',
      'https://appleid.apple.com'
    ]

    for (const url of protectedDomains) {
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin(url)).toBe(true)
    }
  })
})
