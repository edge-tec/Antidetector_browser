// ──────────────────────────────────────────────
// AntiProfiles — Multi-Instance Profile Lock System
// ──────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { getProfileDataDir } from './chromium-resolver'
import { logger } from '../logging/logger'

export interface LockStatus {
  isLocked: boolean
  pid?: number
  lockedAt?: number
  ownerHost?: string
}

export class ProfileLockSystem {
  private static inMemoryLocks: Set<string> = new Set()

  private static getLockFilePath(profileId: string): string {
    const profileDir = getProfileDataDir(profileId)
    return path.join(profileDir, '.antiprofile.lock')
  }

  /**
   * Acquire exclusive lock before launching a browser instance.
   * Returns true if lock acquired successfully, false if profile is already running.
   */
  public static acquireLock(profileId: string, pid: number): boolean {
    if (this.inMemoryLocks.has(profileId)) {
      return false
    }

    const lockFile = this.getLockFilePath(profileId)
    const dir = path.dirname(lockFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    if (fs.existsSync(lockFile)) {
      try {
        const raw = fs.readFileSync(lockFile, 'utf8')
        const lockInfo: LockStatus = JSON.parse(raw)
        
        // Verify if PID is still alive on system
        if (lockInfo.pid && this.isPidAlive(lockInfo.pid)) {
          logger.warn('browser', `[ProfileLock] Profile ${profileId} is already locked by PID ${lockInfo.pid}`)
          return false
        }
      } catch {
        // Corrupted lock file, override
      }
    }

    try {
      const lockData: LockStatus = {
        isLocked: true,
        pid,
        lockedAt: Date.now(),
        ownerHost: process.env.HOSTNAME || 'localhost'
      }
      fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2), 'utf8')
      this.inMemoryLocks.add(profileId)
      return true
    } catch (err: any) {
      logger.error('browser', `[ProfileLock] Failed to write lock for ${profileId}: ${err.message}`)
      return false
    }
  }

  /**
   * Release lock upon profile closure.
   */
  public static releaseLock(profileId: string): void {
    this.inMemoryLocks.delete(profileId)
    const lockFile = this.getLockFilePath(profileId)
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile)
      }
    } catch (err: any) {
      logger.warn('browser', `[ProfileLock] Failed to remove lock file for ${profileId}: ${err.message}`)
    }
  }

  /**
   * Check if profile is currently locked.
   */
  public static isLocked(profileId: string): boolean {
    if (this.inMemoryLocks.has(profileId)) return true

    const lockFile = this.getLockFilePath(profileId)
    if (fs.existsSync(lockFile)) {
      try {
        const raw = fs.readFileSync(lockFile, 'utf8')
        const lockInfo: LockStatus = JSON.parse(raw)
        if (lockInfo.pid && this.isPidAlive(lockInfo.pid)) {
          return true
        }
      } catch {}
    }
    return false
  }

  /**
   * Cross-platform check if PID is running.
   */
  private static isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
}
