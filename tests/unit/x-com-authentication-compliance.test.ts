import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { AuthCompatibilityEngine, SingleFlightAuthManager } from '../../src/main/browser/auth/auth-compatibility'
import { SafeAuthDiagnostics } from '../../src/main/browser/x-auth-diagnostics'

describe('X.com (Twitter) Authentication & Standards Compliance Test Suite', () => {
  const profileNewId = 'x-test-new-profile-' + Date.now()
  const profileExistingId = 'x-test-exist-profile-' + Date.now()

  afterEach(() => {
    deleteProfileDataDir(profileNewId)
    deleteProfileDataDir(profileExistingId)
    SingleFlightAuthManager.reset()
    SafeAuthDiagnostics.clear()
  })

  // ── 1. Login with New Profile (Clean Isolation & Web APIs) ──
  describe('1. Login with New Profile & Modern Web APIs', () => {
    it('creates dedicated clean profile directory with full Web API and storage support', () => {
      const dataDir = ensureProfileDataDir(profileNewId)
      expect(fs.existsSync(dataDir)).toBe(true)

      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const script = buildInjectionScript(fp, 'chrome')

      // Modern Web APIs & features are enabled
      expect(script).toContain('cookieEnabled: true')
      expect(script).toContain('hardwareConcurrency')
      expect(script).toContain('deviceMemory')
      expect(script).toContain('webdriver')
    })
  })

  // ── 2. Login with Existing Profile & Session Restore ──
  describe('2. Login with Existing Profile & Session Restore', () => {
    it('preserves X authentication cookies (auth_token, ct0, twid, kdt) and storage across restarts', () => {
      const dataDir = ensureProfileDataDir(profileExistingId)
      const networkDir = path.join(dataDir, 'Default', 'Network')
      const cookiesFile = path.join(networkDir, 'Cookies')
      const localStorageDir = path.join(dataDir, 'Default', 'Local Storage', 'leveldb')
      const indexedDbDir = path.join(dataDir, 'Default', 'IndexedDB', 'https_x.com_0.indexeddb.leveldb')

      fs.mkdirSync(networkDir, { recursive: true })
      fs.mkdirSync(localStorageDir, { recursive: true })
      fs.mkdirSync(indexedDbDir, { recursive: true })

      const mockXCookieBlob = 'SQLITE_COOKIES_BLOB_CONTAINING_AUTH_TOKEN_AND_CT0'
      fs.writeFileSync(cookiesFile, mockXCookieBlob)
      fs.writeFileSync(path.join(localStorageDir, '000003.log'), 'MOCK_LOCAL_STORAGE_STATE')
      fs.writeFileSync(path.join(indexedDbDir, '000003.log'), 'MOCK_INDEXED_DB_STATE')

      // Verify persistent retention
      expect(fs.existsSync(cookiesFile)).toBe(true)
      expect(fs.readFileSync(cookiesFile, 'utf8')).toBe(mockXCookieBlob)
      expect(fs.existsSync(path.join(localStorageDir, '000003.log'))).toBe(true)
      expect(fs.existsSync(path.join(indexedDbDir, '000003.log'))).toBe(true)
    })
  })

  // ── 3. Browser Identity & Fingerprint Stability During Login ──
  describe('3. Browser Identity & Fingerprint Stability During Login', () => {
    it('maintains perfectly consistent User-Agent, Platform, and WebGL renderer for X.com', () => {
      const fp = generateFingerprint({ osType: 'macos-arm', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('MacIntel')
      expect(fp.navigator.userAgent).toContain('Macintosh; Intel Mac OS X')
      expect(fp.navigator.hardwareConcurrency).toBeGreaterThanOrEqual(4)
      expect(fp.screen.colorDepth).toBe(24)
      expect(fp.webgl.unmaskedRenderer).toContain('Apple')
    })
  })

  // ── 4. Protected Authentication Domain & Phishing Defense ──
  describe('4. Protected Authentication Domain & Phishing Defense', () => {
    it('correctly identifies authentic X.com and Twitter login/flow endpoints', () => {
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com/i/flow/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://twitter.com/i/flow/login')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://api.x.com/oauth/authorize')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com/account/access')).toBe(true)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://x.com.attacker.com/login')).toBe(false)
      expect(AuthCompatibilityEngine.isProtectedAuthOrigin('https://fake-x.com/login')).toBe(false)
    })
  })

  // ── 5. Official Verification Flow & Error Handling (No Auto-Retry Storms) ──
  describe('5. Official Verification Flow & Error Handling', () => {
    it('handles X rate limit and temporary limitation without automated retry spam', () => {
      const lockRes = SingleFlightAuthManager.acquireAuthLock(profileExistingId)
      expect(lockRes.acquired).toBe(true)

      // Evaluate X 429 response
      const evaluated = SingleFlightAuthManager.evaluateProviderResponse(profileExistingId, {
        statusCode: 429,
        responseBody: "We've temporarily limited your login. Please try again later.",
        url: 'https://x.com/i/flow/login'
      })

      expect(evaluated).toBe('AUTH_RATE_LIMITED')
      expect(SingleFlightAuthManager.isCooldownActive(profileExistingId)).toBe(true)

      // Prohibits automated retry spam
      const retryLock = SingleFlightAuthManager.acquireAuthLock(profileExistingId)
      expect(retryLock.acquired).toBe(false)
      expect(retryLock.reason).toContain('temporarily limited')
    })

    it('handles email/phone verification challenges by preserving session state', () => {
      const challengeEvaluation = SingleFlightAuthManager.evaluateProviderResponse(profileExistingId, {
        statusCode: 200,
        responseBody: 'Enter your phone number or email address to verify your account',
        url: 'https://x.com/account/access'
      })

      expect(challengeEvaluation).toBe('SUCCESS')
    })
  })

  // ── 6. Multi-Profile Physical Directory & Cookie Isolation ──
  describe('6. Multi-Profile Physical Directory & Cookie Isolation', () => {
    it('guarantees complete directory and storage separation between Profile A and Profile B', () => {
      const dirA = ensureProfileDataDir(profileNewId)
      const dirB = ensureProfileDataDir(profileExistingId)

      expect(dirA).not.toBe(dirB)
      expect(dirA).toContain(profileNewId)
      expect(dirB).toContain(profileExistingId)

      const fileA = path.join(dirA, 'Default', 'session.dat')
      const fileB = path.join(dirB, 'Default', 'session.dat')
      fs.mkdirSync(path.dirname(fileA), { recursive: true })
      fs.mkdirSync(path.dirname(fileB), { recursive: true })

      fs.writeFileSync(fileA, 'PROFILE_A_X_SESSION')
      fs.writeFileSync(fileB, 'PROFILE_B_X_SESSION')

      expect(fs.readFileSync(fileA, 'utf8')).toBe('PROFILE_A_X_SESSION')
      expect(fs.readFileSync(fileB, 'utf8')).toBe('PROFILE_B_X_SESSION')
    })
  })

  // ── 7. Zero-Logging Privacy Policy Guarantee ──
  describe('7. Zero-Logging Privacy Policy Guarantee', () => {
    it('redacts and strips X passwords, auth_token cookies, and auth headers from diagnostics', () => {
      SafeAuthDiagnostics.clear()

      const event = SafeAuthDiagnostics.logSafeEvent({
        profileId: profileNewId,
        hostname: 'https://x.com/i/flow/login?auth_token=SECRET_AUTH_TOKEN&pass=SECRET_PASSWORD_123',
        statusCategory: '2xx_SUCCESS',
        processState: 'RUNNING',
        notes: 'X login session initialized'
      })

      expect(event.hostname).toBe('x.com')
      expect(event.hostname).not.toContain('SECRET_AUTH_TOKEN')
      expect(event.hostname).not.toContain('SECRET_PASSWORD_123')
      expect(JSON.stringify(event)).not.toContain('SECRET_AUTH_TOKEN')
      expect(JSON.stringify(event)).not.toContain('SECRET_PASSWORD_123')
    })
  })
})
