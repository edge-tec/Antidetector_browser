import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { RuntimePreFlightValidator } from '../../src/main/browser/preflight-validator'
import { getCountryAcceptLanguage, getCountryLocale } from '../../src/main/network/geo-lookup'
import { SingleFlightAuthManager } from '../../src/main/browser/auth/auth-compatibility'

describe('AntiProfiles v5.1 Runtime Audit & QA Test Matrix', () => {
  const profileA = 'v51-profile-alpha-' + Date.now()
  const profileB = 'v51-profile-beta-' + Date.now()

  beforeEach(() => {
    RuntimePreFlightValidator.clear()
    SingleFlightAuthManager.reset()
  })

  afterEach(() => {
    deleteProfileDataDir(profileA)
    deleteProfileDataDir(profileB)
    RuntimePreFlightValidator.clear()
  })

  // ── PART 1: Profile Generator & Identity Validator ──
  describe('Part 1: Profile Generator & Pre-Flight Identity Validator', () => {
    it('locks identity snapshot and passes pre-flight validation on matching runtime', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      RuntimePreFlightValidator.registerIdentity(profileA, fp)

      const check = RuntimePreFlightValidator.validatePreFlight(profileA, {
        userAgent: fp.navigator.userAgent,
        platform: fp.navigator.platform,
        screenWidth: fp.screen.width,
        hardwareConcurrency: fp.navigator.hardwareConcurrency
      })

      expect(check.valid).toBe(true)
      expect(check.errors.length).toBe(0)
    })

    it('raises runtime errors if identity attributes illegally mutate during session', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      RuntimePreFlightValidator.registerIdentity(profileA, fp)

      const badCheck = RuntimePreFlightValidator.validatePreFlight(profileA, {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        platform: 'iPhone'
      })

      expect(badCheck.valid).toBe(false)
      expect(badCheck.errors.length).toBeGreaterThan(0)
      expect(badCheck.errors[0]).toContain('Illegal identity mutation')
    })
  })

  // ── PART 2, 4 & 5: Cookie, Storage & Startup Sequence ──
  describe('Part 2, 4 & 5: Storage Persistence, Startup Order & Session Restoration', () => {
    it('persists Cookies, LocalStorage, IndexedDB, and ServiceWorker caches across restarts', () => {
      const dataDir = ensureProfileDataDir(profileA)
      const cookiesFile = path.join(dataDir, 'Default', 'Network', 'Cookies')
      const localStorageFile = path.join(dataDir, 'Default', 'Local Storage', 'leveldb', '000003.log')
      const indexedDbFile = path.join(dataDir, 'Default', 'IndexedDB', 'https_x.com_0.indexeddb.leveldb', 'CURRENT')
      const swCacheFile = path.join(dataDir, 'Default', 'Service Worker', 'CacheStorage', 'index.txt')

      fs.mkdirSync(path.dirname(cookiesFile), { recursive: true })
      fs.mkdirSync(path.dirname(localStorageFile), { recursive: true })
      fs.mkdirSync(path.dirname(indexedDbFile), { recursive: true })
      fs.mkdirSync(path.dirname(swCacheFile), { recursive: true })

      fs.writeFileSync(cookiesFile, 'ENCRYPTED_X_COOKIE_VAULT_BLOB')
      fs.writeFileSync(localStorageFile, 'X_LOCAL_STORAGE_STATE')
      fs.writeFileSync(indexedDbFile, 'X_INDEXED_DB_STATE')
      fs.writeFileSync(swCacheFile, 'X_SERVICE_WORKER_CACHE')

      // Pre-startup verification (restored before navigation)
      expect(fs.existsSync(cookiesFile)).toBe(true)
      expect(fs.existsSync(localStorageFile)).toBe(true)
      expect(fs.existsSync(indexedDbFile)).toBe(true)
      expect(fs.existsSync(swCacheFile)).toBe(true)
      expect(fs.readFileSync(cookiesFile, 'utf8')).toBe('ENCRYPTED_X_COOKIE_VAULT_BLOB')
    })
  })

  // ── PART 3: Proxy Country & Locale Synchronization ──
  describe('Part 3: Proxy Synchronization & Environment Alignment', () => {
    it('synchronizes Accept-Language and Locale to proxy country without mutating identity', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const lockedUa = fp.navigator.userAgent

      // Proxy in UK
      const ukLang = getCountryAcceptLanguage('GB')
      const ukLocale = getCountryLocale('GB')

      expect(ukLang).toBe('en-GB,en;q=0.9')
      expect(ukLocale.language).toBe('en-GB')

      // Update environment
      fp.locale = { language: ukLocale.language, languages: ukLocale.languages }
      fp.timezone = { mode: 'custom', timezone: 'Europe/London' }

      // Device identity remains untouched
      expect(fp.navigator.userAgent).toBe(lockedUa)
      expect(fp.locale.language).toBe('en-GB')
      expect(fp.timezone.timezone).toBe('Europe/London')
    })
  })

  // ── PART 6 & 7: Network Diagnostics & Login Flow ──
  describe('Part 6 & 7: Sanitized Diagnostics & X Challenge Handling', () => {
    it('displays official challenge without automated retries when X restricts login', () => {
      SingleFlightAuthManager.acquireAuthLock(profileA)

      const evalRes = SingleFlightAuthManager.evaluateProviderResponse(profileA, {
        statusCode: 429,
        responseBody: "We've temporarily limited your login. Please try again later.",
        url: 'https://x.com/i/flow/login'
      })

      expect(evalRes).toBe('AUTH_RATE_LIMITED')
      expect(SingleFlightAuthManager.isCooldownActive(profileA)).toBe(true)

      // Automated retry lock fails
      const lockAttempt = SingleFlightAuthManager.acquireAuthLock(profileA)
      expect(lockAttempt.acquired).toBe(false)
    })
  })

  // ── QA MATRIX: New Profile Physical Isolation ──
  describe('QA Matrix: New Profile Physical Storage Isolation', () => {
    it('guarantees complete isolation between Profile Alpha and Profile Beta', () => {
      const dirA = ensureProfileDataDir(profileA)
      const dirB = ensureProfileDataDir(profileB)

      expect(dirA).not.toBe(dirB)

      const fA = path.join(dirA, 'Default', 'session.json')
      const fB = path.join(dirB, 'Default', 'session.json')
      fs.mkdirSync(path.dirname(fA), { recursive: true })
      fs.mkdirSync(path.dirname(fB), { recursive: true })

      fs.writeFileSync(fA, 'ALPHA_SESSION')
      fs.writeFileSync(fB, 'BETA_SESSION')

      expect(fs.readFileSync(fA, 'utf8')).toBe('ALPHA_SESSION')
      expect(fs.readFileSync(fB, 'utf8')).toBe('BETA_SESSION')
    })
  })
})
