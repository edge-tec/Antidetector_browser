// ──────────────────────────────────────────────
// AntiProfiles — Profile Health & Storage Corruption Checker
// ──────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { getProfileDataDir } from './chromium-resolver'
import { logger } from '../logging/logger'

export interface StorageHealthIssue {
  type: 'CORRUPTED_JSON' | 'ZERO_BYTE_DB' | 'ORPHANED_LOCK' | 'CORRUPTED_BOOKMARKS' | 'INVALID_DIR'
  severity: 'warning' | 'critical'
  filePath: string
  message: string
  repaired: boolean
}

export interface ProfileHealthReport {
  profileId: string
  status: 'HEALTHY' | 'WARNING' | 'CORRUPTED' | 'RECOVERABLE'
  issues: StorageHealthIssue[]
  checkedAt: number
  totalFiles: number
  totalBytes: number
}

export class ProfileHealthChecker {
  /**
   * Scan profile storage for corrupted database files, zero-byte journals,
   * stale singleton locks, and invalid preferences JSON.
   */
  public static checkHealth(profileId: string): ProfileHealthReport {
    const profileDir = getProfileDataDir(profileId)
    const issues: StorageHealthIssue[] = []
    let totalFiles = 0
    let totalBytes = 0

    if (!fs.existsSync(profileDir)) {
      return {
        profileId,
        status: 'HEALTHY',
        issues: [],
        checkedAt: Date.now(),
        totalFiles: 0,
        totalBytes: 0
      }
    }

    try {
      // 1. Check Root Lock Files
      const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'parent.lock', '.parentlock', '.antiprofile.lock']
      for (const lock of lockFiles) {
        const lockPath = path.join(profileDir, lock)
        if (fs.existsSync(lockPath)) {
          issues.push({
            type: 'ORPHANED_LOCK',
            severity: 'warning',
            filePath: lockPath,
            message: `Stale lock file detected: ${lock}`,
            repaired: false
          })
        }
      }

      // 2. Check Default Directory files
      const defaultDir = path.join(profileDir, 'Default')
      if (fs.existsSync(defaultDir)) {
        const checkDbFiles = [
          'Cookies', 'Cookies-journal', 'History', 'History-journal',
          'Web Data', 'Web Data-journal', 'Login Data', 'Login Data-journal',
          'Shortcuts', 'Shortcuts-journal', 'Top Sites', 'Top Sites-journal'
        ]

        for (const dbName of checkDbFiles) {
          const target = path.join(defaultDir, dbName)
          if (fs.existsSync(target)) {
            const stat = fs.statSync(target)
            totalFiles++
            totalBytes += stat.size

            if (stat.size === 0 && (dbName.endsWith('-journal') || dbName.endsWith('-wal') || dbName.endsWith('-shm'))) {
              issues.push({
                type: 'ZERO_BYTE_DB',
                severity: 'warning',
                filePath: target,
                message: `Orphaned zero-byte lock journal: ${dbName}`,
                repaired: false
              })
            }
          }
        }

        // 3. Check Preferences JSON validity
        const prefsPath = path.join(defaultDir, 'Preferences')
        if (fs.existsSync(prefsPath)) {
          const stat = fs.statSync(prefsPath)
          totalFiles++
          totalBytes += stat.size

          if (stat.size === 0) {
            issues.push({
              type: 'CORRUPTED_JSON',
              severity: 'critical',
              filePath: prefsPath,
              message: 'Zero-byte corrupted Preferences file detected.',
              repaired: false
            })
          } else {
            try {
              const raw = fs.readFileSync(prefsPath, 'utf8')
              JSON.parse(raw)
            } catch (err: any) {
              issues.push({
                type: 'CORRUPTED_JSON',
                severity: 'critical',
                filePath: prefsPath,
                message: `Malformed Preferences JSON syntax: ${err.message}`,
                repaired: false
              })
            }
          }
        }

        // 4. Check Bookmarks Checksum Integrity
        const bookmarksPath = path.join(defaultDir, 'Bookmarks')
        if (fs.existsSync(bookmarksPath)) {
          try {
            const rawBm = fs.readFileSync(bookmarksPath, 'utf8')
            if (rawBm.includes('"00000000000000000000000000000000"') || rawBm.trim() === '') {
              issues.push({
                type: 'CORRUPTED_BOOKMARKS',
                severity: 'warning',
                filePath: bookmarksPath,
                message: 'Corrupted Bookmarks file with zero-checksum detected.',
                repaired: false
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      logger.warn('browser', `[HealthChecker] Profile ${profileId} scan error: ${err.message}`)
    }

    const hasCritical = issues.some(i => i.severity === 'critical')
    let status: ProfileHealthReport['status'] = 'HEALTHY'
    if (hasCritical) {
      status = 'RECOVERABLE'
    } else if (issues.length > 0) {
      status = 'WARNING'
    }

    return {
      profileId,
      status,
      issues,
      checkedAt: Date.now(),
      totalFiles,
      totalBytes
    }
  }

  /**
   * Auto-repair corrupted temporary lock files, zero-byte journals, and malformed files.
   */
  public static autoRepair(profileId: string): { success: boolean; repairedCount: number } {
    const report = this.checkHealth(profileId)
    let repairedCount = 0

    for (const issue of report.issues) {
      try {
        if (issue.type === 'ORPHANED_LOCK' || issue.type === 'ZERO_BYTE_DB' || issue.type === 'CORRUPTED_BOOKMARKS') {
          if (fs.existsSync(issue.filePath)) {
            fs.rmSync(issue.filePath, { force: true, recursive: true })
            issue.repaired = true
            repairedCount++
          }
        } else if (issue.type === 'CORRUPTED_JSON') {
          // Recreate clean default JSON container
          fs.writeFileSync(issue.filePath, JSON.stringify({ profile: { name: 'Profile' } }, null, 2), 'utf8')
          issue.repaired = true
          repairedCount++
        }
      } catch (err: any) {
        logger.error('browser', `[HealthChecker] Repair failed for ${issue.filePath}: ${err.message}`)
      }
    }

    logger.info('browser', `[HealthChecker] Profile ${profileId} auto-repair completed: ${repairedCount} items fixed.`)
    return { success: true, repairedCount }
  }
}
