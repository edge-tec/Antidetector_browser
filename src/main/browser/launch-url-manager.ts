// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Global Launch URL & Start Page Management Service
// Enforces and auto-enrolls admin-configured launch URLs across all users & devices
// ──────────────────────────────────────────────────────────────────

import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'
import { centralApi } from '../services/api-client.service'

export interface GlobalLaunchUrlConfig {
  url: string
  enabled: boolean
  mode: 'enroll_all' | 'force' | 'default'
  lockOverride: boolean
  additionalTabs: string[]
}

export class LaunchUrlManager {
  /**
   * Get the current global launch URL configuration from settings/desktop_app_config
   */
  getConfig(): GlobalLaunchUrlConfig {
    try {
      const db = getDatabase()
      const rows = db.prepare(`
        SELECT key, value FROM desktop_app_config 
        WHERE key LIKE 'global_launch_url%'
      `).all() as { key: string; value: string }[]

      const map: Record<string, string> = {}
      rows.forEach(r => { map[r.key] = r.value })

      // Fallback to settings table if not in desktop_app_config
      if (!map['global_launch_url']) {
        const settingRows = db.prepare(`
          SELECT key, value FROM settings 
          WHERE key LIKE 'global_launch_url%'
        `).all() as { key: string; value: string }[]
        settingRows.forEach(r => { map[r.key] = r.value })
      }

      const rawTabs = map['global_launch_url_additional_tabs'] || ''
      const additionalTabs = rawTabs
        .split('\n')
        .map(t => t.trim())
        .filter(Boolean)

      return {
        url: map['global_launch_url'] || '',
        enabled: map['global_launch_url_enabled'] === 'true',
        mode: (map['global_launch_url_mode'] as any) || 'enroll_all',
        lockOverride: map['global_launch_url_lock_override'] === 'true',
        additionalTabs
      }
    } catch (err: any) {
      logger.warn('system', `Could not read global launch URL config: ${err.message}`)
      return {
        url: '',
        enabled: false,
        mode: 'enroll_all',
        lockOverride: false,
        additionalTabs: []
      }
    }
  }

  /**
   * Save global launch URL configuration and optionally enroll all profiles
   */
  saveConfig(
    config: Partial<GlobalLaunchUrlConfig> & { enrollNow?: boolean },
    adminEmail?: string
  ): { success: boolean; config: GlobalLaunchUrlConfig; enrolledCount: number } {
    const db = getDatabase()
    const current = this.getConfig()

    const updated: GlobalLaunchUrlConfig = {
      url: (config.url !== undefined ? config.url : current.url).trim(),
      enabled: config.enabled !== undefined ? !!config.enabled : current.enabled,
      mode: config.mode || current.mode || 'enroll_all',
      lockOverride: config.lockOverride !== undefined ? !!config.lockOverride : current.lockOverride,
      additionalTabs: config.additionalTabs !== undefined ? config.additionalTabs : current.additionalTabs
    }

    // Save to desktop_app_config table
    const stmt = db.prepare('INSERT OR REPLACE INTO desktop_app_config (key, value) VALUES (?, ?)')
    stmt.run('global_launch_url', updated.url)
    stmt.run('global_launch_url_enabled', updated.enabled ? 'true' : 'false')
    stmt.run('global_launch_url_mode', updated.mode)
    stmt.run('global_launch_url_lock_override', updated.lockOverride ? 'true' : 'false')
    stmt.run('global_launch_url_additional_tabs', updated.additionalTabs.join('\n'))

    // Also mirror to settings table for fast access
    const setStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    setStmt.run('global_launch_url', updated.url)
    setStmt.run('global_launch_url_enabled', updated.enabled ? 'true' : 'false')
    setStmt.run('global_launch_url_mode', updated.mode)
    setStmt.run('global_launch_url_lock_override', updated.lockOverride ? 'true' : 'false')

    let enrolledCount = 0

    // If enabled and mode is enroll_all (or explicitly requested to enroll now), update all existing profiles
    if (updated.enabled && (updated.mode === 'enroll_all' || config.enrollNow) && updated.url) {
      enrolledCount = this.enrollAllProfiles(updated.url)
    }

    logger.info(
      'admin',
      `[GlobalLaunchUrl] Admin "${adminEmail || 'system'}" saved global launch URL: "${updated.url}" (Mode: ${updated.mode}, Enabled: ${updated.enabled}). Enrolled profiles: ${enrolledCount}`
    )

    // Sync to Central MySQL Server asynchronously
    centralApi.adminSaveGlobalLaunchUrlConfig({
      url: updated.url,
      enabled: updated.enabled,
      mode: updated.mode,
      lockOverride: updated.lockOverride,
      additionalTabs: updated.additionalTabs,
      enrollNow: config.enrollNow || updated.mode === 'enroll_all'
    }).catch(err => {
      logger.warn('admin', `Central sync for global launch URL failed: ${err.message}`)
    })

    return {
      success: true,
      config: updated,
      enrolledCount
    }
  }

  /**
   * Enrolls all existing profiles with the specified start URL
   */
  enrollAllProfiles(url: string): number {
    try {
      const db = getDatabase()
      const result = db.prepare('UPDATE profiles SET start_url = ?').run(url)
      logger.info('profile', `[GlobalLaunchUrl] ✓ Enrolled ${result.changes} profiles with start URL: "${url}"`)
      return result.changes
    } catch (err: any) {
      logger.error('profile', `[GlobalLaunchUrl] Failed to enroll profiles: ${err.message}`)
      return 0
    }
  }

  /**
   * Sync remote launch URL config (received from central server or license heartbeat)
   */
  syncRemoteConfig(remoteConfig: Partial<GlobalLaunchUrlConfig>): void {
    if (!remoteConfig || !remoteConfig.url) return
    const current = this.getConfig()

    // If remote has changes, update local config
    if (
      remoteConfig.url !== current.url ||
      remoteConfig.enabled !== current.enabled ||
      remoteConfig.mode !== current.mode ||
      remoteConfig.lockOverride !== current.lockOverride
    ) {
      this.saveConfig({
        ...remoteConfig,
        enrollNow: remoteConfig.mode === 'enroll_all'
      }, 'central-server-sync')
    }
  }
}

export const launchUrlManager = new LaunchUrlManager()
export function getGlobalLaunchUrlConfig(): GlobalLaunchUrlConfig {
  return launchUrlManager.getConfig()
}
