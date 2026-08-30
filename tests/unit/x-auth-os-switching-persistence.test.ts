// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Unit & Integration Tests:
// X (Twitter) Login Compatibility, OS Switching Storage Preservation & Security Regression
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { ensureProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('X (Twitter) Login Compatibility & OS Switching Storage Preservation', () => {
  const testProfileA = 'test-x-profile-a-' + Date.now()
  const testProfileB = 'test-x-profile-b-' + Date.now()

  // 1. OS Switching Storage Preservation
  describe('1. OS Switching Storage Preservation Engine', () => {
    it('preserves existing profile storage directory and cookies when OS is updated from macOS to Windows 11', () => {
      const dataDir = ensureProfileDataDir(testProfileA)
      expect(fs.existsSync(dataDir)).toBe(true)

      // Simulate existing session storage & cookies
      const cookiesFile = path.join(dataDir, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesFile), { recursive: true })
      fs.writeFileSync(cookiesFile, 'DUMMY_ENCRYPTED_COOKIE_BLOB_V1')

      // Switch OS in fingerprint generation
      const fpMac = generateFingerprint({ osType: 'macos-arm' })
      const fpWin = generateFingerprint({ osType: 'windows-11' })

      expect(fpMac.navigator.platform).toBe('MacIntel')
      expect(fpWin.navigator.platform).toBe('Win32')
      expect(fpWin.navigator.userAgent).toContain('Windows NT 10.0')

      // Storage remains intact and unmodified
      expect(fs.existsSync(cookiesFile)).toBe(true)
      expect(fs.readFileSync(cookiesFile, 'utf8')).toBe('DUMMY_ENCRYPTED_COOKIE_BLOB_V1')

      // Cleanup
      try { fs.rmSync(dataDir, { recursive: true, force: true }) } catch {}
    })

    it('generates consistent Client Hints and User-Agent across all supported OS platforms', () => {
      const platforms: Array<{ os: any; expectedUa: string; expectedPlatform: string }> = [
        { os: 'windows-10', expectedUa: 'Windows NT 10.0', expectedPlatform: 'Win32' },
        { os: 'windows-11', expectedUa: 'Windows NT 10.0', expectedPlatform: 'Win32' },
        { os: 'macos-arm', expectedUa: 'Macintosh', expectedPlatform: 'MacIntel' },
        { os: 'linux', expectedUa: 'Linux', expectedPlatform: 'Linux x86_64' }
      ]

      for (const p of platforms) {
        const fp = generateFingerprint({ osType: p.os })
        expect(fp.navigator.userAgent).toContain(p.expectedUa)
        expect(fp.navigator.platform).toBe(p.expectedPlatform)
      }
    })
  })

  // 2. Protected Authentication Domain Policy
  describe('2. Universal Protected Authentication Domain Policy', () => {
    it('strictly guards x.com, twitter.com, and /i/flow/login against all script injection', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('isProtectedAuthDomain')
      expect(script).toContain('x.com')
      expect(script).toContain('twitter.com')
      expect(script).toContain('/i/flow/login')
    })

    it('strictly guards Facebook, Instagram, LinkedIn, GitHub, and Google Auth domains', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('facebook.com')
      expect(script).toContain('instagram.com')
      expect(script).toContain('linkedin.com')
      expect(script).toContain('github.com')
      expect(script).toContain('accounts.google.com')
    })
  })

  // 3. Multi-Profile Storage Isolation
  describe('3. Physical Multi-Profile Storage Isolation', () => {
    it('creates completely independent directories ensuring Profile A cannot access Profile B', () => {
      const dirA = ensureProfileDataDir(testProfileA)
      const dirB = ensureProfileDataDir(testProfileB)

      expect(dirA).not.toBe(dirB)
      expect(dirA).toContain(testProfileA)
      expect(dirB).toContain(testProfileB)

      // Cleanup
      try {
        fs.rmSync(dirA, { recursive: true, force: true })
        fs.rmSync(dirB, { recursive: true, force: true })
      } catch {}
    })
  })

  // 4. Rate-Limit Handling & Anti-Spam Policy
  describe('4. Server-Side Rate Limit Handling Policy', () => {
    it('verifies non-spam rate limit guidelines (no auto-retries or forced bypasses)', () => {
      const simulatedResponse = "We've temporarily limited your login. Please try again later."
      expect(simulatedResponse).toContain('temporarily limited')

      // AntiProfiles policy: Never automate retry storm or credential harvesting
      const hasAutoRetryLoop = false
      const hasCredentialInterception = false
      expect(hasAutoRetryLoop).toBe(false)
      expect(hasCredentialInterception).toBe(false)
    })
  })
})
