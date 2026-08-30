// ──────────────────────────────────────────────
// AntiProfiles — Crash Recovery Manager
// ──────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { getProfileDataDir } from './chromium-resolver'
import { logger } from '../logging/logger'

export interface SessionSnapshot {
  profileId: string
  lastActiveUrls: string[]
  closedCleanly: boolean
  timestamp: number
  windowBounds?: {
    width: number
    height: number
  }
}

export class CrashRecoveryManager {
  private static getRecoveryFilePath(profileId: string): string {
    const profileDir = getProfileDataDir(profileId)
    return path.join(profileDir, 'session_recovery.json')
  }

  /**
   * Save session state snapshot during runtime or page navigations.
   */
  public static saveSnapshot(profileId: string, urls: string[], closedCleanly = false): void {
    try {
      const recoveryPath = this.getRecoveryFilePath(profileId)
      const dir = path.dirname(recoveryPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const snapshot: SessionSnapshot = {
        profileId,
        lastActiveUrls: urls.filter(u => u && !u.startsWith('chrome://') && !u.startsWith('about:')),
        closedCleanly,
        timestamp: Date.now()
      }

      fs.writeFileSync(recoveryPath, JSON.stringify(snapshot, null, 2), 'utf8')
    } catch (err: any) {
      logger.warn('browser', `[CrashRecovery] Failed to save recovery snapshot for ${profileId}: ${err.message}`)
    }
  }

  /**
   * Mark session as cleanly closed when user deliberately stops profile.
   */
  public static markCleanExit(profileId: string): void {
    try {
      const recoveryPath = this.getRecoveryFilePath(profileId)
      if (fs.existsSync(recoveryPath)) {
        const raw = fs.readFileSync(recoveryPath, 'utf8')
        const snapshot: SessionSnapshot = JSON.parse(raw)
        snapshot.closedCleanly = true
        fs.writeFileSync(recoveryPath, JSON.stringify(snapshot, null, 2), 'utf8')
      }
    } catch {}
  }

  /**
   * Check if profile suffered an unexpected crash and returns last active URLs.
   */
  public static checkCrashRecovery(profileId: string): { crashed: boolean; restoreUrls: string[] } {
    try {
      const recoveryPath = this.getRecoveryFilePath(profileId)
      if (!fs.existsSync(recoveryPath)) {
        return { crashed: false, restoreUrls: [] }
      }

      const raw = fs.readFileSync(recoveryPath, 'utf8')
      const snapshot: SessionSnapshot = JSON.parse(raw)

      if (!snapshot.closedCleanly && snapshot.lastActiveUrls && snapshot.lastActiveUrls.length > 0) {
        logger.info('browser', `[CrashRecovery] Detected unexpected termination for ${profileId}. Recoverable tabs: ${snapshot.lastActiveUrls.length}`)
        return { crashed: true, restoreUrls: snapshot.lastActiveUrls }
      }
    } catch {}

    return { crashed: false, restoreUrls: [] }
  }
}
