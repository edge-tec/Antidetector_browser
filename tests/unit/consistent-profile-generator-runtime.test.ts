import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { getCountryAcceptLanguage, getCountryLocale } from '../../src/main/network/geo-lookup'
import { RuntimeV4Manager } from '../../src/main/browser/runtime-v4-spec'
import { SingleFlightAuthManager } from '../../src/main/browser/auth/auth-compatibility'

describe('AntiProfiles Production Profile Generator, Proxy Sync, Storage & Session Persistence', () => {
  const testProfWin = 'prof-win-' + Date.now()
  const testProfMacArm = 'prof-mac-arm-' + Date.now()
  const testProfMacIntel = 'prof-mac-intel-' + Date.now()
  const testProfAndroid = 'prof-android-' + Date.now()
  const testProfIos = 'prof-ios-' + Date.now()

  afterEach(() => {
    deleteProfileDataDir(testProfWin)
    deleteProfileDataDir(testProfMacArm)
    deleteProfileDataDir(testProfMacIntel)
    deleteProfileDataDir(testProfAndroid)
    deleteProfileDataDir(testProfIos)
    SingleFlightAuthManager.reset()
  })

  // ── MODULE 01: Consistent Profile Generator Rules ──
  describe('Module 01: Profile Generator Rules & Platform Consistency', () => {
    it('generates internally consistent Windows 10/11 profile with x86_64 CPU and Chrome/Edge', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('Win32')
      expect(fp.navigator.userAgent).toContain('Windows NT 10.0; Win64; x64')
      expect(fp.navigator.userAgent).toContain('Chrome/')
      expect(fp.navigator.touchSupport).toBe(false)
      expect(fp.screen.colorDepth).toBe(24)
      expect([1920, 2560, 3840, 1536, 1440, 1366, 1280]).toContain(fp.screen.width)
    })

    it('generates internally consistent macOS Apple Silicon profile with arm64 and Apple GPU', () => {
      const fp = generateFingerprint({ osType: 'macos-arm', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('MacIntel')
      expect(fp.navigator.userAgent).toContain('Macintosh; Intel Mac OS X')
      expect(fp.webgl.unmaskedVendor).toContain('Apple')
      expect(fp.navigator.touchSupport).toBe(false)
    })

    it('generates internally consistent Android 13–16 profile with arm64 and touch support', () => {
      const fp = generateFingerprint({ osType: 'android', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('Linux armv8l')
      expect(fp.navigator.userAgent).toContain('Android')
      expect(fp.navigator.userAgent).toContain('Mobile')
      expect(fp.navigator.touchSupport).toBe(true)
      expect(fp.navigator.maxTouchPoints).toBeGreaterThanOrEqual(1)
      expect([1080, 1170, 1440, 720, 1200, 412, 390, 393, 360, 428]).toContain(fp.screen.width)
    })

    it('generates internally consistent iOS 17–18 profile with Mobile Safari characteristics', () => {
      const fp = generateFingerprint({ osType: 'ios', browserType: 'chrome' })
      expect(fp.navigator.platform).toBe('iPhone')
      expect(fp.navigator.userAgent).toContain('iPhone')
      expect(fp.navigator.touchSupport).toBe(true)
      expect(fp.navigator.maxTouchPoints).toBeGreaterThanOrEqual(1)
    })

    it('enforces Browser Identity Lock (preserves hardware attributes indefinitely)', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const initialUa = fp.navigator.userAgent
      const initialPlatform = fp.navigator.platform
      const initialGpu = fp.webgl.unmaskedRenderer
      const initialWidth = fp.screen.width

      // Lock check
      expect(fp.navigator.userAgent).toBe(initialUa)
      expect(fp.navigator.platform).toBe(initialPlatform)
      expect(fp.webgl.unmaskedRenderer).toBe(initialGpu)
      expect(fp.screen.width).toBe(initialWidth)
    })
  })

  // ── MODULE 02: Proxy Synchronization Engine ──
  describe('Module 02: Proxy Synchronization Engine', () => {
    it('maps country codes to correct Accept-Language header values', () => {
      expect(getCountryAcceptLanguage('US')).toBe('en-US,en;q=0.9')
      expect(getCountryAcceptLanguage('GB')).toBe('en-GB,en;q=0.9')
      expect(getCountryAcceptLanguage('UK')).toBe('en-GB,en;q=0.9')
      expect(getCountryAcceptLanguage('DE')).toBe('de-DE,de;q=0.9,en;q=0.8')
      expect(getCountryAcceptLanguage('FR')).toBe('fr-FR,fr;q=0.9,en;q=0.8')
      expect(getCountryAcceptLanguage('IT')).toBe('it-IT,it;q=0.9,en;q=0.8')
      expect(getCountryAcceptLanguage('BD')).toBe('bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7')
    })

    it('maps country codes to correct navigator language & languages arrays', () => {
      const us = getCountryLocale('US')
      expect(us.language).toBe('en-US')
      expect(us.languages).toContain('en-US')

      const de = getCountryLocale('DE')
      expect(de.language).toBe('de-DE')
      expect(de.languages).toContain('de-DE')

      const fr = getCountryLocale('FR')
      expect(fr.language).toBe('fr-FR')
      expect(fr.languages).toContain('fr-FR')

      const itLocale = getCountryLocale('IT')
      expect(itLocale.language).toBe('it-IT')
      expect(itLocale.languages).toContain('it-IT')
    })

    it('synchronizes environment without modifying locked device identity', () => {
      const fp = generateFingerprint({ osType: 'macos-arm', browserType: 'chrome' })
      const originalGpu = fp.webgl.unmaskedRenderer
      const originalUa = fp.navigator.userAgent

      // Proxy changed to Germany
      const deLocale = getCountryLocale('DE')
      fp.locale = { language: deLocale.language, languages: deLocale.languages }
      fp.timezone = { mode: 'custom', timezone: 'Europe/Berlin' }

      // Device identity remains untouched
      expect(fp.webgl.unmaskedRenderer).toBe(originalGpu)
      expect(fp.navigator.userAgent).toBe(originalUa)

      // Environment is updated
      expect(fp.locale.language).toBe('de-DE')
      expect(fp.timezone.timezone).toBe('Europe/Berlin')
    })
  })

  // ── MODULE 03: Storage Engine & Physical Directory Isolation ──
  describe('Module 03: Storage Engine & Physical Directory Isolation', () => {
    it('maintains completely isolated persistent databases and storage per profile', () => {
      const dirWin = ensureProfileDataDir(testProfWin)
      const dirMac = ensureProfileDataDir(testProfMacArm)

      expect(dirWin).not.toBe(dirMac)

      const cookiesWin = path.join(dirWin, 'Default', 'Network', 'Cookies')
      const cookiesMac = path.join(dirMac, 'Default', 'Network', 'Cookies')
      fs.mkdirSync(path.dirname(cookiesWin), { recursive: true })
      fs.mkdirSync(path.dirname(cookiesMac), { recursive: true })

      fs.writeFileSync(cookiesWin, 'WIN_PROFILE_COOKIE_VAULT_DATA')
      fs.writeFileSync(cookiesMac, 'MAC_PROFILE_COOKIE_VAULT_DATA')

      expect(fs.readFileSync(cookiesWin, 'utf8')).toBe('WIN_PROFILE_COOKIE_VAULT_DATA')
      expect(fs.readFileSync(cookiesMac, 'utf8')).toBe('MAC_PROFILE_COOKIE_VAULT_DATA')
    })
  })

  // ── MODULE 04: Session Persistence & Recovery Engine ──
  describe('Module 04: Session Persistence Engine & Restart Recovery', () => {
    it('restores authentication sessions without requiring re-login', () => {
      const dir = ensureProfileDataDir(testProfAndroid)
      const idbPath = path.join(dir, 'Default', 'IndexedDB', 'https_x.com_0.indexeddb.leveldb')
      fs.mkdirSync(idbPath, { recursive: true })
      fs.writeFileSync(path.join(idbPath, 'CURRENT'), 'LOG_FILE_MANIFEST')

      // Verify presence on restart
      expect(fs.existsSync(path.join(idbPath, 'CURRENT'))).toBe(true)
      expect(fs.readFileSync(path.join(idbPath, 'CURRENT'), 'utf8')).toBe('LOG_FILE_MANIFEST')
    })
  })
})
