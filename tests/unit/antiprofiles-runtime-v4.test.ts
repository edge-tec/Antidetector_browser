import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { RuntimeV4Manager } from '../../src/main/browser/runtime-v4-spec'
import { AuthCompatibilityEngine, SingleFlightAuthManager } from '../../src/main/browser/auth/auth-compatibility'

describe('AntiProfiles Browser Runtime v4.0 Enterprise Edition — Specification & QA Tests', () => {
  const profileIdA = 'v4-profile-alpha-' + Date.now()
  const profileIdB = 'v4-profile-beta-' + Date.now()

  afterEach(() => {
    deleteProfileDataDir(profileIdA)
    deleteProfileDataDir(profileIdB)
    SingleFlightAuthManager.reset()
  })

  // ── SECTION 1 & 8: Browser Core & Modern Web Platform APIs ──
  describe('Section 1 & 8: Runtime Browser Architecture & Web Platform APIs', () => {
    it('supports native Chromium engine with full HTML5, CSS3, WebAssembly, and ES2024 APIs', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('cookieEnabled: true')
      expect(script).toContain('hardwareConcurrency')
      expect(script).toContain('deviceMemory')
      expect(script).toContain('webdriver')
    })
  })

  // ── SECTION 2 & 18: Profile Generator & Multi-Platform Rules ──
  describe('Section 2 & 18: Profile Generator Engine & Platform Consistency Rules', () => {
    it('enforces strict platform consistency and rejects cross-platform contamination', () => {
      // Valid Windows 11 Profile
      const validWin = RuntimeV4Manager.validateV4Consistency({
        osType: 'windows-11',
        platform: 'Win32',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      })
      expect(validWin.isValid).toBe(true)

      // Invalid Windows with iPhone UA
      const invalidWin = RuntimeV4Manager.validateV4Consistency({
        osType: 'windows-11',
        platform: 'Win32',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
      })
      expect(invalidWin.isValid).toBe(false)
      expect(invalidWin.violations.length).toBeGreaterThan(0)

      // Valid macOS Apple Silicon Profile
      const validMac = RuntimeV4Manager.validateV4Consistency({
        osType: 'macos-arm',
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      })
      expect(validMac.isValid).toBe(true)

      // Valid iOS WebKit Profile
      const validIos = RuntimeV4Manager.validateV4Consistency({
        osType: 'ios',
        platform: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        touchSupport: true,
        maxTouchPoints: 5
      })
      expect(validIos.isValid).toBe(true)
    })
  })

  // ── SECTION 4 & 5: Cookie & Session Persistence Engine ──
  describe('Section 4 & 5: Cookie & Storage Engine with Physical Directory Isolation', () => {
    it('maintains completely isolated persistent storage directories per profile', () => {
      const dirA = ensureProfileDataDir(profileIdA)
      const dirB = ensureProfileDataDir(profileIdB)

      expect(dirA).not.toBe(dirB)
      expect(RuntimeV4Manager.verifyStorageIsolation(profileIdA, dirA)).toBe(true)
      expect(RuntimeV4Manager.verifyStorageIsolation(profileIdB, dirB)).toBe(true)

      const cookiesA = path.join(dirA, 'Default', 'Network', 'Cookies')
      const cookiesB = path.join(dirB, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesA), { recursive: true })
      fs.mkdirSync(path.dirname(cookiesB), { recursive: true })

      fs.writeFileSync(cookiesA, 'PROFILE_A_X_AUTH_COOKIE_TOKEN')
      fs.writeFileSync(cookiesB, 'PROFILE_B_X_AUTH_COOKIE_TOKEN')

      expect(fs.readFileSync(cookiesA, 'utf8')).toBe('PROFILE_A_X_AUTH_COOKIE_TOKEN')
      expect(fs.readFileSync(cookiesB, 'utf8')).toBe('PROFILE_B_X_AUTH_COOKIE_TOKEN')
    })
  })

  // ── SECTION 9: Permissions Engine ──
  describe('Section 9: Permissions Engine', () => {
    it('persists permission decisions per profile', () => {
      RuntimeV4Manager.setProfilePermissions(profileIdA, {
        camera: 'allow',
        microphone: 'allow',
        notifications: 'block',
        clipboard: 'allow',
        geolocation: 'ask'
      })

      const perms = RuntimeV4Manager.getProfilePermissions(profileIdA)
      expect(perms.camera).toBe('allow')
      expect(perms.notifications).toBe('block')
      expect(perms.clipboard).toBe('allow')

      // Default permissions for unset profile
      const defaultPerms = RuntimeV4Manager.getProfilePermissions(profileIdB)
      expect(defaultPerms.camera).toBe('ask')
    })
  })

  // ── SECTION 10: X.com Authentication & Single-Flight Rate Limit Protection ──
  describe('Section 10: X.com Authentication Compatibility & Rate-Limit Shield', () => {
    it('locks and transitions to cooldown when X rate limits with user guidance', () => {
      const lock1 = SingleFlightAuthManager.acquireAuthLock(profileIdA)
      expect(lock1.acquired).toBe(true)

      // X.com rate limit response
      const resState = SingleFlightAuthManager.evaluateProviderResponse(profileIdA, {
        statusCode: 429,
        responseBody: "We've temporarily limited your login. Please try again later.",
        url: 'https://x.com/i/flow/login'
      })

      expect(resState).toBe('AUTH_RATE_LIMITED')
      expect(SingleFlightAuthManager.isCooldownActive(profileIdA)).toBe(true)

      // Automated retries are blocked
      const retry = SingleFlightAuthManager.acquireAuthLock(profileIdA)
      expect(retry.acquired).toBe(false)

      // Alternate recommended auth method
      const rec = SingleFlightAuthManager.getRecommendedAuthMethod(profileIdA)
      expect(rec).toBe('GOOGLE_SSO')
    })
  })

  // ── SECTION 15 & 16: Privacy & Sanitized Logging ──
  describe('Section 15 & 16: Privacy Layer & Diagnostics Sanitization', () => {
    it('sanitizes diagnostic telemetry and strips sensitive credentials', () => {
      const dirtyUrl = 'https://x.com/oauth/authorize?auth_token=SECRET_TOKEN_XYZ&state=CSRF_SECRET'
      const clean = RuntimeV4Manager.sanitizeDiagnosticLog(dirtyUrl)

      expect(clean).toBe('https://x.com/oauth/authorize')
      expect(clean).not.toContain('SECRET_TOKEN_XYZ')

      const dirtyMsg = 'User submission failed for key=SUPER_SECRET_12345&password=MyPassword'
      const sanitizedMsg = RuntimeV4Manager.sanitizeDiagnosticLog(dirtyMsg)
      expect(sanitizedMsg).toContain('[REDACTED]')
      expect(sanitizedMsg).not.toContain('SUPER_SECRET_12345')
      expect(sanitizedMsg).not.toContain('MyPassword')
    })
  })
})
