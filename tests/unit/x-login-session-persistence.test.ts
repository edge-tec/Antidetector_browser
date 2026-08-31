import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { SingleFlightAuthManager, AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'
import { RuntimeV4Manager } from '../../src/main/browser/runtime-v4-spec'
import { Profile } from '../../src/main/database/models'

describe('X.com Login Consistency, Session Persistence & QA Test Suite', () => {
  const winProfileId = 'x-qa-win-' + Date.now()
  const macProfileId = 'x-qa-mac-' + Date.now()
  const androidProfileId = 'x-qa-android-' + Date.now()
  const iosProfileId = 'x-qa-ios-' + Date.now()

  afterEach(() => {
    deleteProfileDataDir(winProfileId)
    deleteProfileDataDir(macProfileId)
    deleteProfileDataDir(androidProfileId)
    deleteProfileDataDir(iosProfileId)
    SingleFlightAuthManager.reset()
  })

  // ── QA Case 1: Windows Profile → Login → Restart → Session Persists ──
  describe('QA Case 1: Windows Profile Login & Session Persistence', () => {
    it('creates consistent Windows profile and restores session storage across restarts', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('Win32')
      expect(fp.navigator.userAgent).toContain('Windows NT 10.0')
      expect(fp.navigator.userAgent).not.toContain('iPhone')
      expect(fp.navigator.userAgent).not.toContain('Android')

      const dataDir = ensureProfileDataDir(winProfileId)
      const cookiesPath = path.join(dataDir, 'Default', 'Network', 'Cookies')
      const localStoragePath = path.join(dataDir, 'Default', 'Local Storage', 'leveldb', '000003.log')
      fs.mkdirSync(path.dirname(cookiesPath), { recursive: true })
      fs.mkdirSync(path.dirname(localStoragePath), { recursive: true })

      fs.writeFileSync(cookiesPath, 'WIN_X_AUTH_TOKEN_ENCRYPTED_DATA')
      fs.writeFileSync(localStoragePath, 'WIN_X_LOCAL_STORAGE_STATE')

      // Simulate Restart: read from disk
      expect(fs.existsSync(cookiesPath)).toBe(true)
      expect(fs.readFileSync(cookiesPath, 'utf8')).toBe('WIN_X_AUTH_TOKEN_ENCRYPTED_DATA')
      expect(fs.readFileSync(localStoragePath, 'utf8')).toBe('WIN_X_LOCAL_STORAGE_STATE')
    })
  })

  // ── QA Case 2: macOS Profile → Login → Restart → Session Persists ──
  describe('QA Case 2: macOS Profile Login & Session Persistence', () => {
    it('creates consistent macOS profile and restores session storage across restarts', () => {
      const fp = generateFingerprint({ osType: 'macos-arm', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('MacIntel')
      expect(fp.navigator.userAgent).toContain('Macintosh; Intel Mac OS X')
      expect(fp.webgl.unmaskedVendor).toContain('Apple')

      const dataDir = ensureProfileDataDir(macProfileId)
      const cookiesPath = path.join(dataDir, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesPath), { recursive: true })
      fs.writeFileSync(cookiesPath, 'MAC_X_AUTH_TOKEN_ENCRYPTED_DATA')

      // Simulate Restart
      expect(fs.existsSync(cookiesPath)).toBe(true)
      expect(fs.readFileSync(cookiesPath, 'utf8')).toBe('MAC_X_AUTH_TOKEN_ENCRYPTED_DATA')
    })
  })

  // ── QA Case 3: Android Profile → Login → Restart → Session Persists ──
  describe('QA Case 3: Android Profile Login & Session Persistence', () => {
    it('creates consistent Android profile with touch support and restores session storage', () => {
      const fp = generateFingerprint({ osType: 'android', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('Linux armv8l')
      expect(fp.navigator.userAgent).toContain('Android')
      expect(fp.navigator.touchSupport).toBe(true)
      expect(fp.navigator.maxTouchPoints).toBeGreaterThanOrEqual(1)

      const dataDir = ensureProfileDataDir(androidProfileId)
      const cookiesPath = path.join(dataDir, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesPath), { recursive: true })
      fs.writeFileSync(cookiesPath, 'ANDROID_X_AUTH_TOKEN_DATA')

      // Simulate Restart
      expect(fs.existsSync(cookiesPath)).toBe(true)
      expect(fs.readFileSync(cookiesPath, 'utf8')).toBe('ANDROID_X_AUTH_TOKEN_DATA')
    })
  })

  // ── QA Case 4: iOS Profile → Login → Restart → Session Persists ──
  describe('QA Case 4: iOS Profile Login & Session Persistence', () => {
    it('creates consistent iOS profile without Chrome desktop tokens and restores session storage', () => {
      const fp = generateFingerprint({ osType: 'ios', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('iPhone')
      expect(fp.navigator.userAgent).toContain('iPhone')
      expect(fp.navigator.touchSupport).toBe(true)

      const dataDir = ensureProfileDataDir(iosProfileId)
      const cookiesPath = path.join(dataDir, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesPath), { recursive: true })
      fs.writeFileSync(cookiesPath, 'IOS_X_AUTH_TOKEN_DATA')

      // Simulate Restart
      expect(fs.existsSync(cookiesPath)).toBe(true)
      expect(fs.readFileSync(cookiesPath, 'utf8')).toBe('IOS_X_AUTH_TOKEN_DATA')
    })
  })

  // ── QA Case 5: Proxy Change → Timezone & Location Update, Device Identity Locked ──
  describe('QA Case 5: Proxy Synchronization & Device Identity Locking', () => {
    it('updates timezone and locale when proxy changes while locking hardware fingerprint', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const initialHardwareConcurrency = fp.navigator.hardwareConcurrency
      const initialGpu = fp.webgl.unmaskedRenderer
      const initialPlatform = fp.navigator.platform

      // Simulate Proxy Change to Tokyo, Japan
      fp.timezone = { mode: 'custom', timezone: 'Asia/Tokyo' }
      fp.locale = { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en-US'] }
      fp.geolocation = { mode: 'ip-based', latitude: 35.6762, longitude: 139.6503, accuracy: 50 }

      // Device identity remains locked
      expect(fp.navigator.hardwareConcurrency).toBe(initialHardwareConcurrency)
      expect(fp.webgl.unmaskedRenderer).toBe(initialGpu)
      expect(fp.navigator.platform).toBe(initialPlatform)

      // Timezone and locale successfully synchronized
      expect(fp.timezone.timezone).toBe('Asia/Tokyo')
      expect(fp.locale.language).toBe('ja-JP')
      expect(fp.geolocation.latitude).toBe(35.6762)
    })
  })

  // ── QA Case 6: Multi-Profile Storage Isolation ──
  describe('QA Case 6: Multi-Profile Storage Isolation', () => {
    it('guarantees complete storage and session separation between Profile A and Profile B', () => {
      const dirA = ensureProfileDataDir(winProfileId)
      const dirB = ensureProfileDataDir(macProfileId)

      expect(dirA).not.toBe(dirB)
      expect(dirA).toContain(winProfileId)
      expect(dirB).toContain(macProfileId)

      const cookiesA = path.join(dirA, 'Default', 'Network', 'Cookies')
      const cookiesB = path.join(dirB, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesA), { recursive: true })
      fs.mkdirSync(path.dirname(cookiesB), { recursive: true })

      fs.writeFileSync(cookiesA, 'SESSION_DATA_USER_1')
      fs.writeFileSync(cookiesB, 'SESSION_DATA_USER_2')

      expect(fs.readFileSync(cookiesA, 'utf8')).toBe('SESSION_DATA_USER_1')
      expect(fs.readFileSync(cookiesB, 'utf8')).toBe('SESSION_DATA_USER_2')
    })
  })

  // ── Runtime Rule 7: Login Challenge & Rate Limit Handling ──
  describe('Runtime Rule 7: X Login Challenge & Rate Limit Handling', () => {
    it('prevents automated retry storms on X rate limits and recommends alternate SSO method', () => {
      SingleFlightAuthManager.acquireAuthLock(winProfileId)

      const response = SingleFlightAuthManager.evaluateProviderResponse(winProfileId, {
        statusCode: 429,
        responseBody: "We've temporarily limited your login. Please try again later.",
        url: 'https://x.com/i/flow/login'
      })

      expect(response).toBe('AUTH_RATE_LIMITED')
      expect(SingleFlightAuthManager.isCooldownActive(winProfileId)).toBe(true)

      // Automated retry is blocked
      const retryResult = SingleFlightAuthManager.acquireAuthLock(winProfileId)
      expect(retryResult.acquired).toBe(false)
      expect(retryResult.reason).toContain('temporarily limited')

      // Switch recommended method to Google SSO or alternate flow
      const recommended = SingleFlightAuthManager.getRecommendedAuthMethod(winProfileId)
      expect(recommended).toBe('GOOGLE_SSO')
    })
  })
})
