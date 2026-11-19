import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { validateProductionEnvironment } from '../../src/main/security/production-config-validator'
import { backupDatabaseFile, verifyAndRestoreDatabaseFile } from '../../src/main/storage/disaster-recovery'

describe('Phase P8 — Production Config Validator & Disaster Recovery Verification', () => {
  it('accurately identifies missing external credentials without ever exposing secret values', () => {
    const emptyReport = validateProductionEnvironment({})
    expect(emptyReport.allCommercialGatesReady).toBe(false)
    expect(emptyReport.cloudReady).toBe(false)
    expect(emptyReport.macosSigningReady).toBe(false)
    expect(emptyReport.windowsSigningReady).toBe(false)
    expect(emptyReport.updaterReady).toBe(true)
    expect(emptyReport.missingRequired).toContain('ANTIPROFILES_S3_ENDPOINT')
    expect(emptyReport.missingRequired).toContain('CSC_LINK')
    expect(emptyReport.missingRequired).toContain('WIN_CSC_LINK')

    const fullEnv = {
      ANTIPROFILES_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      ANTIPROFILES_S3_BUCKET: 'prod-bucket',
      ANTIPROFILES_S3_ACCESS_KEY: 'SUPER_SECRET_AK',
      ANTIPROFILES_S3_SECRET_KEY: 'SUPER_SECRET_SK',
      CSC_LINK: 'base64-cert',
      CSC_KEY_PASSWORD: 'SUPER_SECRET_CERT_PASS',
      APPLE_ID: 'dev@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'SUPER_SECRET_APP_PASS',
      APPLE_TEAM_ID: 'ABC1234567',
      WIN_CSC_LINK: 'base64-win-cert',
      WIN_CSC_KEY_PASSWORD: 'SUPER_SECRET_WIN_PASS'
    }
    const readyReport = validateProductionEnvironment(fullEnv)
    expect(readyReport.allCommercialGatesReady).toBe(true)
    expect(readyReport.missingRequired).toHaveLength(0)

    // Ensure zero secret values appear in serialized report
    const serialized = JSON.stringify(readyReport)
    expect(serialized).not.toContain('SUPER_SECRET_AK')
    expect(serialized).not.toContain('SUPER_SECRET_SK')
    expect(serialized).not.toContain('SUPER_SECRET_CERT_PASS')
    expect(serialized).not.toContain('SUPER_SECRET_APP_PASS')
    expect(serialized).not.toContain('SUPER_SECRET_WIN_PASS')
  })

  it('backs up, detects tampering, and atomically restores a disposable database file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-p8-dr-'))
    try {
      const sourceDb = path.join(tmpDir, 'live.sqlite')
      const backupDir = path.join(tmpDir, 'backups')
      const restoredDb = path.join(tmpDir, 'restored.sqlite')
      const originalData = Buffer.from('SQLite format 3\0antiprofiles-recovery-test-payload')
      fs.writeFileSync(sourceDb, originalData)

      const receipt = backupDatabaseFile(sourceDb, backupDir)
      expect(receipt.sha256).toHaveLength(64)
      expect(receipt.sizeBytes).toBe(originalData.length)

      // Clean restore succeeds
      const res = verifyAndRestoreDatabaseFile(receipt.backupPath, receipt.sha256, restoredDb)
      expect(res.restored).toBe(true)
      expect(fs.readFileSync(restoredDb).equals(originalData)).toBe(true)

      // Tampered backup must be rejected before overwriting target
      fs.appendFileSync(receipt.backupPath, 'CORRUPT')
      expect(() => verifyAndRestoreDatabaseFile(receipt.backupPath, receipt.sha256, restoredDb)).toThrow(/SHA-256 checksum mismatch/i)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
