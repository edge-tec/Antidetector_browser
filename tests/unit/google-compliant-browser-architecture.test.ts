import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { ProfileHealthChecker } from '../../src/main/browser/profile-health-checker'
import { ChromiumVersionManager } from '../../src/main/browser/chromium-version-manager'
import { BackupIntegrityService } from '../../src/main/storage/backup-integrity'
import { CrashRecoveryManager } from '../../src/main/browser/crash-recovery-manager'
import { ProfileLockSystem } from '../../src/main/browser/profile-lock-system'
import { ensureProfileDataDir, deleteProfileDataDir, getProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('Google-Compliant Chromium Browser Architecture (AntiProfiles v3)', () => {
  const profileIdA = 'google-compliant-prof-a-' + Date.now()
  const profileIdB = 'google-compliant-prof-b-' + Date.now()

  afterEach(() => {
    ProfileLockSystem.releaseLock(profileIdA)
    ProfileLockSystem.releaseLock(profileIdB)
    deleteProfileDataDir(profileIdA)
    deleteProfileDataDir(profileIdB)
  })

  // 1. Google Supported Browser & Integrity Requirements
  describe('Google Compliance & Safe Domain Security', () => {
    it('generates injection script with Universal Automation Shield eliminating navigator.webdriver', () => {
      const fp = generateFingerprint({ osType: 'windows-10', browserType: 'chrome' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('Universal Automation Shield')
      expect(script).toContain('delete proto.webdriver')
      expect(script).toContain("get: function() { return false; }")
    })

    it('enforces Safe Domain Policy protecting Google Auth, Gmail, and OAuth from script tampering', () => {
      const fp = generateFingerprint({ osType: 'windows-10', browserType: 'chrome' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).toContain('Safe Domain Policy')
      expect(script).toContain('accounts.google.com')
      expect(script).toContain('mail.google.com')
      expect(script).toContain('/v3/signin')
      expect(script).toContain('isProtectedAuthDomain')
    })

    it('does not contain unsupported command line flags or automation bypass flags', () => {
      const fp = generateFingerprint({ osType: 'windows-10', browserType: 'chrome' })
      const script = buildInjectionScript(fp, 'chrome')

      expect(script).not.toContain('--disable-blink-features=AutomationControlled')
    })
  })

  // 2. Profile Storage Isolation Engine
  describe('Physical Profile Storage Isolation', () => {
    it('creates completely isolated Chromium user-data directories for Profile A and Profile B', () => {
      const dirA = ensureProfileDataDir(profileIdA)
      const dirB = ensureProfileDataDir(profileIdB)

      expect(dirA).not.toBe(dirB)
      expect(fs.existsSync(dirA)).toBe(true)
      expect(fs.existsSync(dirB)).toBe(true)

      const defaultA = path.join(dirA, 'Default')
      const defaultB = path.join(dirB, 'Default')
      fs.mkdirSync(defaultA, { recursive: true })
      fs.mkdirSync(defaultB, { recursive: true })

      fs.writeFileSync(path.join(defaultA, 'Cookies'), 'SESSION_PROFILE_A_COOKIE_DATA')
      fs.writeFileSync(path.join(defaultB, 'Cookies'), 'SESSION_PROFILE_B_COOKIE_DATA')

      expect(fs.readFileSync(path.join(defaultA, 'Cookies'), 'utf8')).toBe('SESSION_PROFILE_A_COOKIE_DATA')
      expect(fs.readFileSync(path.join(defaultB, 'Cookies'), 'utf8')).toBe('SESSION_PROFILE_B_COOKIE_DATA')
    })
  })

  // 3. Multi-Instance Single Lock & Crash Recovery
  describe('Profile Process Locking & Crash Recovery', () => {
    it('prevents multiple processes from corrupting the same profile with ProfileLockSystem', () => {
      const lock1 = ProfileLockSystem.acquireLock(profileIdA, 12345)
      expect(lock1).toBe(true)

      const lock2 = ProfileLockSystem.acquireLock(profileIdA, 67890)
      expect(lock2).toBe(false)

      ProfileLockSystem.releaseLock(profileIdA)
    })

    it('creates and restores session snapshots with CrashRecoveryManager', () => {
      const activeTabs = ['https://accounts.google.com', 'https://mail.google.com']
      CrashRecoveryManager.saveSnapshot(profileIdA, activeTabs, false)

      const recovery = CrashRecoveryManager.checkCrashRecovery(profileIdA)
      expect(recovery.crashed).toBe(true)
      expect(recovery.restoreUrls).toEqual(activeTabs)

      CrashRecoveryManager.markCleanExit(profileIdA)
      const cleanRecovery = CrashRecoveryManager.checkCrashRecovery(profileIdA)
      expect(cleanRecovery.crashed).toBe(false)
    })
  })

  // 4. Backup & Export Integrity
  describe('Profile Import/Export Cryptographic Integrity', () => {
    it('computes and verifies SHA-256 checksums to ensure profile backup integrity', () => {
      const profileData = {
        name: 'Secure Google Profile',
        browserVersion: '131.0.0.0',
        timezone: 'America/New_York'
      }

      const { checksum } = BackupIntegrityService.createSignedPackage(profileData)
      expect(checksum).toBeDefined()
      expect(checksum.length).toBe(64) // SHA-256 hex length

      const isValid = BackupIntegrityService.verifyArchiveChecksum(JSON.stringify(profileData), checksum)
      expect(isValid).toBe(true)

      const isInvalid = BackupIntegrityService.verifyArchiveChecksum(JSON.stringify(profileData) + 'tampered', checksum)
      expect(isInvalid).toBe(false)
    })
  })

  // 5. Chromium Engine & Platform Compatibility
  describe('Chromium Version Management & Platform Diagnostics', () => {
    it('validates Chromium version compatibility against stable baselines', () => {
      const validation = ChromiumVersionManager.validateVersionCompatibility(128, 128)
      expect(validation.compatible).toBe(true)

      const oldValidation = ChromiumVersionManager.validateVersionCompatibility(95)
      expect(oldValidation.compatible).toBe(false)
    })
  })
})
