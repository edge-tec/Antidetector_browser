// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Trash & Recycle Bin Manager (30-Day Soft Delete)
// Preserves deleted profiles for recovery with full audit logging
// ──────────────────────────────────────────────────────────────────

import { getDatabase } from '../database/connection'
import { deleteProfileDataDir } from './chromium-resolver'
import { processTracker } from './process-tracker'
import { logger } from '../logging/logger'

export interface TrashedProfile {
  id: string
  name: string
  osType: string
  groupId: string | null
  deletedAt: string
  deletedBy: string
  daysRemaining: number
}

const RETENTION_DAYS = 30

export class TrashManager {
  /**
   * Soft-delete a profile by moving it to Trash (30-day retention).
   */
  static async moveToTrash(profileId: string, deletedBy = 'system'): Promise<boolean> {
    if (processTracker.isRunning(profileId)) {
      await processTracker.stop(profileId)
    }
    const db = getDatabase()
    const now = new Date().toISOString()
    const result = db
      .prepare("UPDATE profiles SET deleted_at = ?, deleted_by = ?, status = 'stopped', updated_at = ? WHERE id = ? AND deleted_at IS NULL")
      .run(now, deletedBy, now, profileId)

    if (result.changes > 0) {
      logger.info('profile', `[Trash] Moved profile ${profileId} to Trash by ${deletedBy}`)
      return true
    }
    return false
  }

  /**
   * List all profiles currently in Trash with remaining retention days.
   */
  static listTrash(userId?: string): TrashedProfile[] {
    const db = getDatabase()
    const rows = (userId
      ? db.prepare('SELECT id, name, os_type, group_id, deleted_at, deleted_by FROM profiles WHERE deleted_at IS NOT NULL AND user_id = ? ORDER BY deleted_at DESC').all(userId)
      : db.prepare('SELECT id, name, os_type, group_id, deleted_at, deleted_by FROM profiles WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()
    ) as any[]

    const nowMs = Date.now()
    return rows.map((r) => {
      const deletedMs = new Date(r.deleted_at).getTime()
      const elapsedDays = Math.floor((nowMs - deletedMs) / (1000 * 60 * 60 * 24))
      return {
        id: r.id,
        name: r.name,
        osType: r.os_type || 'windows-10',
        groupId: r.group_id || null,
        deletedAt: r.deleted_at,
        deletedBy: r.deleted_by || 'unknown',
        daysRemaining: Math.max(0, RETENTION_DAYS - elapsedDays)
      }
    })
  }

  /**
   * Restore a single profile from Trash.
   */
  static restoreProfile(profileId: string): boolean {
    const db = getDatabase()
    const now = new Date().toISOString()
    const res = db
      .prepare('UPDATE profiles SET deleted_at = NULL, deleted_by = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL')
      .run(now, profileId)

    if (res.changes > 0) {
      logger.info('profile', `[Trash] Restored profile ${profileId} from Trash`)
      return true
    }
    return false
  }

  /**
   * Bulk restore multiple profiles from Trash.
   */
  static bulkRestore(profileIds: string[]): { restored: number } {
    let restored = 0
    for (const id of profileIds) {
      if (this.restoreProfile(id)) restored++
    }
    return { restored }
  }

  /**
   * Permanently delete a profile from Trash (DB record + disk data dir).
   */
  static async permanentDelete(profileId: string): Promise<boolean> {
    if (processTracker.isRunning(profileId)) {
      await processTracker.stop(profileId)
    }
    const db = getDatabase()
    const res = db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId)
    deleteProfileDataDir(profileId)
    if (res.changes > 0) {
      logger.info('profile', `[Trash] Permanently deleted profile ${profileId}`)
      return true
    }
    return false
  }

  /**
   * Permanently purge all profiles whose 30-day retention has expired.
   */
  static async purgeExpired(): Promise<{ purged: number }> {
    const expired = this.listTrash().filter((p) => p.daysRemaining <= 0)
    let purged = 0
    for (const item of expired) {
      if (await this.permanentDelete(item.id)) purged++
    }
    return { purged }
  }
}
