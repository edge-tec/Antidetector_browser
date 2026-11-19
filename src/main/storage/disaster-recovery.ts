// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Disaster Recovery & Database Backup/Restore Utility
// Atomic SHA-256 verified SQLite database backup and recovery
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export interface DatabaseBackupReceipt {
  backupPath: string
  sha256: string
  sizeBytes: number
  createdAt: string
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

/**
 * Create a SHA-256 verified backup copy of a SQLite database file.
 */
export function backupDatabaseFile(sourceDbPath: string, backupDir: string): DatabaseBackupReceipt {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`Source database file not found: ${sourceDbPath}`)
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `antiprofiles-db-${stamp}.sqlite.bak`)
  fs.copyFileSync(sourceDbPath, backupPath)
  const sha256 = sha256File(backupPath)
  const sizeBytes = fs.statSync(backupPath).size

  return {
    backupPath,
    sha256,
    sizeBytes,
    createdAt: new Date().toISOString()
  }
}

/**
 * Verify SHA-256 checksum of a database backup and atomically restore it to targetDbPath.
 * Rejects tampered or corrupted backup files before touching targetDbPath.
 */
export function verifyAndRestoreDatabaseFile(
  backupPath: string,
  expectedSha256: string,
  targetDbPath: string
): { restored: boolean; sizeBytes: number } {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`)
  }
  const actualHash = sha256File(backupPath)
  if (actualHash !== expectedSha256.trim().toLowerCase()) {
    throw new Error('Disaster recovery rejected: backup SHA-256 checksum mismatch (possible corruption or tampering).')
  }

  const tempRestore = `${targetDbPath}.restoring-${Date.now()}`
  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true })
  fs.copyFileSync(backupPath, tempRestore)
  fs.renameSync(tempRestore, targetDbPath)

  return {
    restored: true,
    sizeBytes: fs.statSync(targetDbPath).size
  }
}
