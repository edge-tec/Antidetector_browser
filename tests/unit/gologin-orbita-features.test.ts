// ──────────────────────────────────────────────
// AntiProfiles — GoLogin / Orbita Core Features Test Suite
// ──────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ProfileHealthChecker } from '../../src/main/browser/profile-health-checker'
import { ChromiumVersionManager } from '../../src/main/browser/chromium-version-manager'
import { BackupIntegrityService } from '../../src/main/storage/backup-integrity'
import { CrashRecoveryManager } from '../../src/main/browser/crash-recovery-manager'
import { ProfileLockSystem } from '../../src/main/browser/profile-lock-system'
import { getProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('GoLogin / Orbita Production Features Suite', () => {
  const testProfileId = 'test-gologin-profile-001'
  const profileDir = getProfileDataDir(testProfileId)

  beforeEach(() => {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
    fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
  })

  afterEach(() => {
    ProfileLockSystem.releaseLock(testProfileId)
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
  })

  // ── TEST 1: Profile Storage Health Check & Auto Repair ──
  it('detects and repairs corrupted preferences and stale lock files', () => {
    const staleLockPath = path.join(profileDir, 'SingletonLock')
    fs.writeFileSync(staleLockPath, '12345')

    const zeroByteJournal = path.join(profileDir, 'Default', 'Cookies-journal')
    fs.writeFileSync(zeroByteJournal, '')

    const report = ProfileHealthChecker.checkHealth(testProfileId)
    expect(report.issues.length).toBeGreaterThanOrEqual(2)
    expect(report.status).toBe('warning')

    const repairRes = ProfileHealthChecker.autoRepair(testProfileId)
    expect(repairRes.success).toBe(true)
    expect(repairRes.repairedCount).toBeGreaterThanOrEqual(2)
    expect(fs.existsSync(staleLockPath)).toBe(false)
    expect(fs.existsSync(zeroByteJournal)).toBe(false)
  })

  // ── TEST 2: Chromium Version Compatibility Manager ──
  it('validates Chromium version stability thresholds', () => {
    const v128 = ChromiumVersionManager.validateVersionCompatibility(128, 128)
    expect(v128.compatible).toBe(true)

    const v100 = ChromiumVersionManager.validateVersionCompatibility(100)
    expect(v100.compatible).toBe(false)
    expect(v100.warning).toContain('minimum supported baseline')
  })

  // ── TEST 3: Profile Backup Integrity (SHA256 Checksum) ──
  it('generates and verifies tamper-proof SHA-256 archive checksums', () => {
    const sampleProfile = {
      name: 'E-Commerce Store Manager',
      browserVersion: '128.0.0.0',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      timezone: 'America/New_York'
    }

    const { envelope, checksum } = BackupIntegrityService.createSignedPackage(sampleProfile)
    expect(checksum).toHaveLength(64) // 64 hex characters (256 bits)

    const isValid = BackupIntegrityService.verifyArchiveChecksum(JSON.stringify(sampleProfile), checksum)
    expect(isValid).toBe(true)

    const tamperedProfile = { ...sampleProfile, timezone: 'Europe/London' }
    const isTamperedValid = BackupIntegrityService.verifyArchiveChecksum(JSON.stringify(tamperedProfile), checksum)
    expect(isTamperedValid).toBe(false)
  })

  // ── TEST 4: Crash Recovery Manager ──
  it('records session snapshots and flags crash recovery state on unexpected exit', () => {
    const activeTabs = ['https://accounts.google.com', 'https://mail.google.com']
    CrashRecoveryManager.saveSnapshot(testProfileId, activeTabs, false)

    const recovery = CrashRecoveryManager.checkCrashRecovery(testProfileId)
    expect(recovery.crashed).toBe(true)
    expect(recovery.restoreUrls).toEqual(activeTabs)

    CrashRecoveryManager.markCleanExit(testProfileId)
    const cleanRecovery = CrashRecoveryManager.checkCrashRecovery(testProfileId)
    expect(cleanRecovery.crashed).toBe(false)
  })

  // ── TEST 5: Profile Lock System (Multi-Instance Concurrency Guard) ──
  it('enforces single-instance concurrency lock preventing duplicate profile launches', () => {
    const lockAcquired = ProfileLockSystem.acquireLock(testProfileId, process.pid)
    expect(lockAcquired).toBe(true)
    expect(ProfileLockSystem.isLocked(testProfileId)).toBe(true)

    // Second launch attempt must be rejected
    const secondAttempt = ProfileLockSystem.acquireLock(testProfileId, process.pid + 1)
    expect(secondAttempt).toBe(false)

    ProfileLockSystem.releaseLock(testProfileId)
    expect(ProfileLockSystem.isLocked(testProfileId)).toBe(false)
  })
})
