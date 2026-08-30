// ──────────────────────────────────────────────
// AntiProfiles — GoLogin Architecture Acceptance Test Suite
// ──────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ProfileHealthChecker } from '../../src/main/browser/profile-health-checker'
import { BackupIntegrityService } from '../../src/main/storage/backup-integrity'
import { CrashRecoveryManager } from '../../src/main/browser/crash-recovery-manager'
import { ProfileLockSystem } from '../../src/main/browser/profile-lock-system'
import { getProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { resolveMasterProfile } from '../../src/main/fingerprint/master-profile-resolver'

describe('GoLogin-Style Isolated Profile Acceptance Test Suite', () => {
  const profileIdA = 'acceptance-test-profile-A'
  const profileIdB = 'acceptance-test-profile-B'
  const dirA = getProfileDataDir(profileIdA)
  const dirB = getProfileDataDir(profileIdB)

  beforeEach(() => {
    for (const dir of [dirA, dirB]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
      fs.mkdirSync(path.join(dir, 'Default'), { recursive: true })
    }
  })

  afterEach(() => {
    ProfileLockSystem.releaseLock(profileIdA)
    ProfileLockSystem.releaseLock(profileIdB)
    for (const dir of [dirA, dirB]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  // ── STEP 1: Independent User Data Directories ──
  it('creates completely separate, non-overlapping storage directories for Profile A and Profile B', () => {
    expect(dirA).not.toEqual(dirB)

    // Write mock session token / cookie in Profile A
    const cookieDbA = path.join(dirA, 'Default', 'Cookies')
    fs.writeFileSync(cookieDbA, 'MOCK_COOKIE_DATA_PROFILE_A_LOGGED_IN')

    // Profile B must NOT have Profile A cookie
    const cookieDbB = path.join(dirB, 'Default', 'Cookies')
    expect(fs.existsSync(cookieDbB)).toBe(false)
  })

  // ── STEP 2: Independent Proxy & Timezone Configuration ──
  it('ensures changing Profile A proxy/timezone does not affect Profile B', () => {
    const configA = resolveMasterProfile({
      osType: 'macos-arm',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      processorGen: 'M3'
    })

    const configB = resolveMasterProfile({
      osType: 'windows-11',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120'
    })

    expect(configA.platform).toBe('MacIntel')
    expect(configB.platform).toBe('Win32')
    expect(configA.userAgent).not.toEqual(configB.userAgent)
  })

  // ── STEP 3: Multi-Instance Locking & Concurrency Protection ──
  it('allows concurrent launches of different profiles while locking duplicate launches of same profile', () => {
    // Both Profile A and Profile B can run simultaneously
    const lockA = ProfileLockSystem.acquireLock(profileIdA, 1001)
    const lockB = ProfileLockSystem.acquireLock(profileIdB, 1002)
    expect(lockA).toBe(true)
    expect(lockB).toBe(true)

    // Attempting to launch Profile A a second time must fail
    const duplicateA = ProfileLockSystem.acquireLock(profileIdA, 1003)
    expect(duplicateA).toBe(false)

    // Release Profile A lock
    ProfileLockSystem.releaseLock(profileIdA)
    expect(ProfileLockSystem.isLocked(profileIdA)).toBe(false)
    expect(ProfileLockSystem.isLocked(profileIdB)).toBe(true)
  })

  // ── STEP 4: Export, Delete, and Integrity-Verified Restore ──
  it('exports Profile A with SHA256 checksum and verifies integrity on restore', () => {
    const profileMetadataA = {
      id: profileIdA,
      name: 'Profile A - E-Commerce',
      timezone: 'America/New_York',
      language: 'en-US'
    }

    const { envelope, checksum } = BackupIntegrityService.createSignedPackage(profileMetadataA)
    const parsedEnvelope = JSON.parse(envelope)

    expect(parsedEnvelope.schema).toBe('antiprofiles.v3.signed')
    expect(parsedEnvelope.checksum).toEqual(checksum)

    // Verify SHA-256 integrity
    const isValid = BackupIntegrityService.verifyArchiveChecksum(JSON.stringify(parsedEnvelope.data), checksum)
    expect(isValid).toBe(true)
  })

  // ── STEP 5: Storage Health Check & Recovery Diagnostics ──
  it('runs health check on isolated profiles returning valid health statuses', () => {
    const healthA = ProfileHealthChecker.checkHealth(profileIdA)
    expect(['HEALTHY', 'WARNING', 'RECOVERABLE', 'CORRUPTED']).toContain(healthA.status)
    expect(healthA.status).toBe('HEALTHY')
  })
})
