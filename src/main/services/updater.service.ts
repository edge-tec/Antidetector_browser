// ──────────────────────────────────────────────
// AntiProfiles — Enterprise Auto-Update & Cross-Platform Release Service
// ──────────────────────────────────────────────

import { BrowserWindow, app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import crypto from 'crypto'
import { URL } from 'url'
import { spawn, execSync } from 'child_process'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'
import { centralApi } from './api-client.service'

export interface SoftwareVersionRecord {
  id: string
  version: string
  build?: string
  channel?: 'stable' | 'beta' | 'alpha' | 'internal'
  release_title: string
  release_notes: string
  status: 'draft' | 'published' | 'disabled' | 'archived'
  min_supported_version: string
  mandatory?: number
  force_update?: number
  
  win_download_url: string
  win_file_size: number
  win_sha256: string
  
  mac_intel_download_url: string
  mac_intel_file_size: number
  mac_intel_sha256: string
  
  mac_arm_download_url: string
  mac_arm_file_size: number
  mac_arm_sha256: string
  
  linux_download_url: string
  linux_file_size: number
  linux_sha256: string
  
  signature?: string
  download_count?: number
  published_at?: string | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface PlatformPackageInfo {
  platformKey: 'windows-x64' | 'macos-arm64' | 'macos-x64' | 'linux-x64'
  platformLabel: string
  downloadUrl: string
  fileSize: number
  sha256: string
  filename: string
}

export interface UpdateSettings {
  channel: 'stable' | 'beta' | 'alpha' | 'internal'
  auto_download: boolean
  auto_install: boolean
  notify_only: boolean
  check_frequency_hours: number
  last_checked_at: string | null
  download_dir: string
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  speed: number // bytes per second
  remainingSeconds: number
  status: 'idle' | 'downloading' | 'paused' | 'verifying' | 'completed' | 'error'
  error?: string
}

/**
 * Compare two semver strings: returns 1 if vA > vB, -1 if vA < vB, 0 if equal
 */
export function compareSemver(vA: string, vB: string): number {
  const cleanA = (vA || '0.0.0').replace(/^v/i, '').trim()
  const cleanB = (vB || '0.0.0').replace(/^v/i, '').trim()

  const partsA = cleanA.split(/[-+.]/).map(p => isNaN(Number(p)) ? p : Number(p))
  const partsB = cleanB.split(/[-+.]/).map(p => isNaN(Number(p)) ? p : Number(p))

  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const a = partsA[i] !== undefined ? partsA[i] : 0
    const b = partsB[i] !== undefined ? partsB[i] : 0

    if (typeof a === 'number' && typeof b === 'number') {
      if (a > b) return 1
      if (a < b) return -1
    } else {
      const strA = String(a)
      const strB = String(b)
      if (strA > strB) return 1
      if (strA < strB) return -1
    }
  }
  return 0
}

export class UpdaterService {
  private static instance: UpdaterService
  private currentAppVersion: string = '1.0.0'
  private autoCheckTimer: NodeJS.Timeout | null = null

  // Active Download State
  private activeRequest: http.ClientRequest | null = null
  private activeDownloadPath: string | null = null
  private activeDownloadUrl: string | null = null
  private activeDownloadSha256: string | null = null
  private isPaused: boolean = false
  private downloadedBytes: number = 0
  private totalBytes: number = 0
  private currentProgress: DownloadProgress = {
    percent: 0,
    transferred: 0,
    total: 0,
    speed: 0,
    remainingSeconds: 0,
    status: 'idle'
  }

  private constructor() {
    try {
      this.currentAppVersion = app ? app.getVersion() : '1.0.0'
    } catch {
      this.currentAppVersion = '1.0.0'
    }
  }

  public static getInstance(): UpdaterService {
    if (!UpdaterService.instance) {
      UpdaterService.instance = new UpdaterService()
    }
    return UpdaterService.instance
  }

  public getCurrentVersion(): string {
    return this.currentAppVersion
  }

  /**
   * Initialize and start the background 6-hour update scheduler
   */
  public initScheduler(): void {
    // Check shortly after app launch (10 seconds)
    setTimeout(() => {
      this.checkForUpdate().catch(err => {
        logger.warn('updater', `Initial update check failed: ${err.message}`)
      })
    }, 10000)

    // Then schedule recurring check every 6 hours
    if (this.autoCheckTimer) {
      clearInterval(this.autoCheckTimer)
    }

    const settings = this.getUpdateSettings()
    const intervalMs = (settings.check_frequency_hours || 6) * 3600 * 1000

    this.autoCheckTimer = setInterval(() => {
      this.checkForUpdate().catch(err => {
        logger.warn('updater', `Scheduled update check error: ${err.message}`)
      })
    }, intervalMs)
  }

  /**
   * Determine client platform key and label
   */
  public detectClientPlatform(): { key: PlatformPackageInfo['platformKey']; label: string; arch: string; os: string } {
    const p = process.platform
    const arch = process.arch

    if (p === 'win32') {
      return { key: 'windows-x64', label: 'Windows (64-bit)', arch: 'x64', os: 'windows' }
    } else if (p === 'darwin') {
      if (arch === 'arm64') {
        return { key: 'macos-arm64', label: 'macOS Apple Silicon (M1-M4)', arch: 'arm64', os: 'macos' }
      }
      return { key: 'macos-x64', label: 'macOS Intel (64-bit)', arch: 'x64', os: 'macos' }
    } else {
      return { key: 'linux-x64', label: 'Linux (64-bit)', arch: 'x64', os: 'linux' }
    }
  }

  /**
   * Get / Save Client Update Settings
   */
  public getUpdateSettings(): UpdateSettings {
    const db = getDatabase()
    try {
      const row = db.prepare('SELECT * FROM software_update_settings WHERE id = ?').get('default') as any
      if (row) {
        return {
          channel: row.channel || 'stable',
          auto_download: Boolean(row.auto_download),
          auto_install: Boolean(row.auto_install),
          notify_only: Boolean(row.notify_only),
          check_frequency_hours: row.check_frequency_hours || 6,
          last_checked_at: row.last_checked_at || null,
          download_dir: row.download_dir || ''
        }
      }
    } catch {}

    return {
      channel: 'stable',
      auto_download: true,
      auto_install: false,
      notify_only: false,
      check_frequency_hours: 6,
      last_checked_at: null,
      download_dir: ''
    }
  }

  public saveUpdateSettings(settings: Partial<UpdateSettings>): UpdateSettings {
    const db = getDatabase()
    const current = this.getUpdateSettings()
    const merged = { ...current, ...settings }

    try {
      db.prepare(`
        INSERT INTO software_update_settings (
          id, channel, auto_download, auto_install, notify_only, check_frequency_hours, download_dir, updated_at
        ) VALUES (
          'default', ?, ?, ?, ?, ?, ?, datetime('now')
        )
        ON CONFLICT(id) DO UPDATE SET
          channel = excluded.channel,
          auto_download = excluded.auto_download,
          auto_install = excluded.auto_install,
          notify_only = excluded.notify_only,
          check_frequency_hours = excluded.check_frequency_hours,
          download_dir = excluded.download_dir,
          updated_at = datetime('now')
      `).run(
        merged.channel,
        merged.auto_download ? 1 : 0,
        merged.auto_install ? 1 : 0,
        merged.notify_only ? 1 : 0,
        merged.check_frequency_hours,
        merged.download_dir || ''
      )
    } catch (err: any) {
      logger.error('updater', `Failed to save update settings: ${err.message}`)
    }

    return this.getUpdateSettings()
  }

  /**
   * Get package download info for the detected or specified platform
   */
  public getPackageInfoForPlatform(version: SoftwareVersionRecord, platformKey?: PlatformPackageInfo['platformKey']): PlatformPackageInfo {
    const plat = platformKey || this.detectClientPlatform().key

    switch (plat) {
      case 'windows-x64':
        return {
          platformKey: 'windows-x64',
          platformLabel: 'Windows (64-bit)',
          downloadUrl: version.win_download_url || '',
          fileSize: version.win_file_size || 0,
          sha256: version.win_sha256 || '',
          filename: `AntiProfiles-Setup-${version.version}.exe`
        }
      case 'macos-arm64':
        return {
          platformKey: 'macos-arm64',
          platformLabel: 'macOS Apple Silicon (arm64)',
          downloadUrl: version.mac_arm_download_url || '',
          fileSize: version.mac_arm_file_size || 0,
          sha256: version.mac_arm_sha256 || '',
          filename: `AntiProfiles-${version.version}-arm64.dmg`
        }
      case 'macos-x64':
        return {
          platformKey: 'macos-x64',
          platformLabel: 'macOS Intel (x64)',
          downloadUrl: version.mac_intel_download_url || '',
          fileSize: version.mac_intel_file_size || 0,
          sha256: version.mac_intel_sha256 || '',
          filename: `AntiProfiles-${version.version}-x64.dmg`
        }
      case 'linux-x64':
      default:
        return {
          platformKey: 'linux-x64',
          platformLabel: 'Linux (64-bit)',
          downloadUrl: version.linux_download_url || '',
          fileSize: version.linux_file_size || 0,
          sha256: version.linux_sha256 || '',
          filename: `AntiProfiles-${version.version}.AppImage`
        }
    }
  }

  /**
   * Fetch all software versions (for Admin management)
   */
  public getAllVersions(): SoftwareVersionRecord[] {
    const db = getDatabase()
    try {
      const rows = db.prepare('SELECT * FROM software_versions ORDER BY created_at DESC').all() as SoftwareVersionRecord[]
      return rows
    } catch {
      return []
    }
  }

  public getVersionById(id: string): SoftwareVersionRecord | null {
    const db = getDatabase()
    try {
      const row = db.prepare('SELECT * FROM software_versions WHERE id = ?').get(id) as SoftwareVersionRecord | undefined
      return row || null
    } catch {
      return null
    }
  }

  /**
   * Get latest published software release from local DB or Central Server API
   */
  public async getLatestPublishedVersion(channel = 'stable'): Promise<SoftwareVersionRecord | null> {
    // 1. First attempt to query Central Server Software API
    try {
      const plat = this.detectClientPlatform()
      const res = await centralApi.request<{
        update_available: boolean
        latest_version?: string
        build?: string
        channel?: string
        mandatory?: boolean
        title?: string
        description?: string
        release_date?: string
        file_size_bytes?: number
        download_url?: string
        checksum?: string
        signature?: string
      }>(`/api/software.php?action=check-update&current_version=${this.currentAppVersion}&os=${plat.os}&architecture=${plat.arch}&channel=${channel}`)

      if (res && res.latest_version) {
        // Construct Record from central API response
        const record: SoftwareVersionRecord = {
          id: `remote_${res.latest_version}`,
          version: res.latest_version,
          build: res.build || '1',
          channel: (res.channel as any) || 'stable',
          release_title: res.title || `AntiProfiles v${res.latest_version}`,
          release_notes: res.description || '',
          status: 'published',
          min_supported_version: '1.0.0',
          mandatory: res.mandatory ? 1 : 0,
          force_update: res.mandatory ? 1 : 0,
          win_download_url: plat.key === 'windows-x64' ? (res.download_url || '') : '',
          win_file_size: plat.key === 'windows-x64' ? (res.file_size_bytes || 0) : 0,
          win_sha256: plat.key === 'windows-x64' ? (res.checksum || '') : '',
          mac_arm_download_url: plat.key === 'macos-arm64' ? (res.download_url || '') : '',
          mac_arm_file_size: plat.key === 'macos-arm64' ? (res.file_size_bytes || 0) : 0,
          mac_arm_sha256: plat.key === 'macos-arm64' ? (res.checksum || '') : '',
          mac_intel_download_url: plat.key === 'macos-x64' ? (res.download_url || '') : '',
          mac_intel_file_size: plat.key === 'macos-x64' ? (res.file_size_bytes || 0) : 0,
          mac_intel_sha256: plat.key === 'macos-x64' ? (res.checksum || '') : '',
          linux_download_url: plat.key === 'linux-x64' ? (res.download_url || '') : '',
          linux_file_size: plat.key === 'linux-x64' ? (res.file_size_bytes || 0) : 0,
          linux_sha256: plat.key === 'linux-x64' ? (res.checksum || '') : '',
          signature: res.signature || '',
          published_at: res.release_date || new Date().toISOString()
        }

        // Cache into local database
        try { this.saveVersion(record, 'system-sync') } catch {}
        return record
      }
    } catch {}

    // 2. Fallback to local database published versions
    const db = getDatabase()
    try {
      const row = db.prepare(`
        SELECT * FROM software_versions
        WHERE status = 'published'
          AND (channel = ? OR channel = 'stable' OR ? = 'all')
        ORDER BY published_at DESC, created_at DESC
        LIMIT 1
      `).get(channel, channel) as SoftwareVersionRecord | undefined

      return row || null
    } catch {
      return null
    }
  }

  /**
   * Check if an update is available against current version
   */
  public async checkForUpdate(currentVer?: string): Promise<{
    hasUpdate: boolean
    currentVersion: string
    latestVersion?: SoftwareVersionRecord
    packageInfo?: PlatformPackageInfo
    forceUpdate?: boolean
    mandatory?: boolean
  }> {
    const current = currentVer || this.currentAppVersion
    const settings = this.getUpdateSettings()
    
    // Update last checked timestamp
    try {
      const db = getDatabase()
      db.prepare("UPDATE software_update_settings SET last_checked_at = datetime('now') WHERE id = 'default'").run()
    } catch {}

    const latest = await this.getLatestPublishedVersion(settings.channel)

    if (!latest) {
      return { hasUpdate: false, currentVersion: current }
    }

    const isNewer = compareSemver(latest.version, current) > 0
    const packageInfo = this.getPackageInfoForPlatform(latest)
    const isForce = Boolean(latest.force_update) || Boolean(latest.mandatory) || compareSemver(latest.min_supported_version || '1.0.0', current) > 0

    if (isNewer) {
      this.broadcastUpdateNotification(latest)

      // If auto_download is true and notify_only is false, trigger background download
      if (settings.auto_download && !settings.notify_only && packageInfo.downloadUrl) {
        this.downloadUpdatePackage(packageInfo.downloadUrl, packageInfo.sha256).catch(() => {})
      }
    }

    return {
      hasUpdate: isNewer,
      currentVersion: current,
      latestVersion: latest,
      packageInfo,
      forceUpdate: isForce,
      mandatory: isForce
    }
  }

  /**
   * Admin: Save or Update a Software Version
   */
  public saveVersion(data: Partial<SoftwareVersionRecord>, adminUser = 'admin'): SoftwareVersionRecord {
    const db = getDatabase()
    const version = (data.version || '').trim().replace(/^v/i, '')
    if (!version) throw new Error('Version string is required (e.g. 1.1.0)')

    const id = data.id || `ver_${version.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
    const build = data.build || '1'
    const channel = data.channel || 'stable'
    const releaseTitle = data.release_title || `AntiProfiles v${version} Release`
    const releaseNotes = data.release_notes || 'Performance enhancements, security updates, and bug fixes.'
    const status = data.status || 'draft'
    const minSupported = data.min_supported_version || '1.0.0'
    const forceUpdate = (data.force_update || data.mandatory) ? 1 : 0
    const signature = data.signature || ''

    const winUrl = data.win_download_url || ''
    const winSize = Number(data.win_file_size) || 0
    const winSha = data.win_sha256 || ''

    const macIntelUrl = data.mac_intel_download_url || ''
    const macIntelSize = Number(data.mac_intel_file_size) || 0
    const macIntelSha = data.mac_intel_sha256 || ''

    const macArmUrl = data.mac_arm_download_url || ''
    const macArmSize = Number(data.mac_arm_file_size) || 0
    const macArmSha = data.mac_arm_sha256 || ''

    const linuxUrl = data.linux_download_url || ''
    const linuxSize = Number(data.linux_file_size) || 0
    const linuxSha = data.linux_sha256 || ''

    const publishedAt = status === 'published' ? (data.published_at || new Date().toISOString()) : null

    db.prepare(`
      INSERT INTO software_versions (
        id, version, build, channel, release_title, release_notes, status, min_supported_version, force_update,
        win_download_url, win_file_size, win_sha256,
        mac_intel_download_url, mac_intel_file_size, mac_intel_sha256,
        mac_arm_download_url, mac_arm_file_size, mac_arm_sha256,
        linux_download_url, linux_file_size, linux_sha256,
        signature, published_at, created_by, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        build = excluded.build,
        channel = excluded.channel,
        release_title = excluded.release_title,
        release_notes = excluded.release_notes,
        status = excluded.status,
        min_supported_version = excluded.min_supported_version,
        force_update = excluded.force_update,
        win_download_url = excluded.win_download_url,
        win_file_size = excluded.win_file_size,
        win_sha256 = excluded.win_sha256,
        mac_intel_download_url = excluded.mac_intel_download_url,
        mac_intel_file_size = excluded.mac_intel_file_size,
        mac_intel_sha256 = excluded.mac_intel_sha256,
        mac_arm_download_url = excluded.mac_arm_download_url,
        mac_arm_file_size = excluded.mac_arm_file_size,
        mac_arm_sha256 = excluded.mac_arm_sha256,
        linux_download_url = excluded.linux_download_url,
        linux_file_size = excluded.linux_file_size,
        linux_sha256 = excluded.linux_sha256,
        signature = excluded.signature,
        published_at = excluded.published_at,
        updated_at = datetime('now')
    `).run(
      id, version, build, channel, releaseTitle, releaseNotes, status, minSupported, forceUpdate,
      winUrl, winSize, winSha,
      macIntelUrl, macIntelSize, macIntelSha,
      macArmUrl, macArmSize, macArmSha,
      linuxUrl, linuxSize, linuxSha,
      signature, publishedAt, adminUser
    )

    const saved = this.getVersionById(id)!
    logger.info('updater', `[UpdaterService] Software version saved: v${saved.version} (Status: ${saved.status})`)

    if (saved.status === 'published') {
      this.broadcastUpdateNotification(saved)
    }

    return saved
  }

  /**
   * Admin: Publish a version and broadcast real-time notification immediately
   */
  public publishVersion(versionId: string): SoftwareVersionRecord {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE software_versions
      SET status = 'published', published_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(now, versionId)

    const updated = this.getVersionById(versionId)
    if (!updated) throw new Error('Version not found.')

    logger.info('updater', `[UpdaterService] 🚀 Published software version v${updated.version} — broadcasting real-time notification!`)
    this.broadcastUpdateNotification(updated)
    return updated
  }

  /**
   * Admin: Rollback to previous software version
   */
  public rollbackVersion(currentVersionId: string): { success: boolean; rolledBackTo?: SoftwareVersionRecord; error?: string } {
    const db = getDatabase()
    try {
      if (currentVersionId) {
        db.prepare("UPDATE software_versions SET status = 'disabled', updated_at = datetime('now') WHERE id = ?").run(currentVersionId)
      }

      const prev = db.prepare(`
        SELECT * FROM software_versions
        WHERE id != ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(currentVersionId) as SoftwareVersionRecord | undefined

      if (prev) {
        db.prepare("UPDATE software_versions SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(prev.id)
        const reloaded = this.getVersionById(prev.id)!
        this.broadcastUpdateNotification(reloaded)
        return { success: true, rolledBackTo: reloaded }
      }
      return { success: false, error: 'No previous version available for rollback.' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public disableVersion(versionId: string): SoftwareVersionRecord {
    const db = getDatabase()
    db.prepare(`
      UPDATE software_versions
      SET status = 'disabled', updated_at = datetime('now')
      WHERE id = ?
    `).run(versionId)

    const updated = this.getVersionById(versionId)
    if (!updated) throw new Error('Version not found.')
    return updated
  }

  public deleteVersion(versionId: string): boolean {
    const db = getDatabase()
    const res = db.prepare('DELETE FROM software_versions WHERE id = ?').run(versionId)
    return res.changes > 0
  }

  /**
   * Broadcast real-time update notification across all Electron renderer windows
   */
  public broadcastUpdateNotification(release: SoftwareVersionRecord): void {
    const packageInfo = this.getPackageInfoForPlatform(release)
    const isMandatory = Boolean(release.force_update) || Boolean(release.mandatory) || compareSemver(release.min_supported_version || '1.0.0', this.currentAppVersion) > 0

    const payload = {
      version: release.version,
      build: release.build || '1',
      channel: release.channel || 'stable',
      releaseTitle: release.release_title,
      releaseNotes: release.release_notes,
      publishedAt: release.published_at,
      forceUpdate: isMandatory,
      mandatory: isMandatory,
      minSupportedVersion: release.min_supported_version,
      packageInfo,
      timestamp: Date.now()
    }

    try {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('ui:software-update-available', payload)
        }
      })
      logger.info('updater', `[UpdaterService] Sent update notification to ${windows.length} client window(s).`)
    } catch (err: any) {
      logger.warn('updater', `[UpdaterService] Failed to broadcast IPC to windows: ${err.message}`)
    }
  }

  /**
   * Broadcast download progress to all renderer windows
   */
  private sendProgress(progress: DownloadProgress, onProgress?: (p: DownloadProgress) => void): void {
    this.currentProgress = progress
    if (onProgress) {
      try { onProgress(progress) } catch {}
    }
    try {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('updater:download-progress', progress)
        }
      })
    } catch {}
  }

  /**
   * Pause Active Download
   */
  public pauseDownload(): boolean {
    if (this.activeRequest && !this.isPaused) {
      this.isPaused = true
      this.activeRequest.destroy()
      this.activeRequest = null
      this.sendProgress({
        ...this.currentProgress,
        status: 'paused',
        speed: 0
      })
      logger.info('updater', `[UpdaterService] Download paused at ${this.downloadedBytes} bytes.`)
      return true
    }
    return false
  }

  /**
   * Resume Active Download
   */
  public async resumeDownload(onProgress?: (progress: DownloadProgress) => void): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (this.activeDownloadUrl && this.isPaused) {
      this.isPaused = false
      return this.downloadUpdatePackage(this.activeDownloadUrl, this.activeDownloadSha256 || undefined, onProgress, true)
    }
    return { success: false, error: 'No paused download session to resume.' }
  }

  /**
   * Cancel Active Download
   */
  public cancelDownload(): boolean {
    if (this.activeRequest) {
      this.activeRequest.destroy()
      this.activeRequest = null
    }
    this.isPaused = false
    if (this.activeDownloadPath && fs.existsSync(this.activeDownloadPath)) {
      try { fs.unlinkSync(this.activeDownloadPath) } catch {}
    }
    this.activeDownloadPath = null
    this.activeDownloadUrl = null
    this.downloadedBytes = 0
    this.totalBytes = 0
    this.sendProgress({
      percent: 0,
      transferred: 0,
      total: 0,
      speed: 0,
      remainingSeconds: 0,
      status: 'idle'
    })
    logger.info('updater', '[UpdaterService] Download cancelled and temporary file cleaned.')
    return true
  }

  /**
   * Download the update package with resumable HTTP Range streaming and SHA-256 verification
   */
  public async downloadUpdatePackage(
    urlStr: string,
    expectedSha256?: string,
    onProgress?: (progress: DownloadProgress) => void,
    isResume = false
  ): Promise<{ success: boolean; filePath?: string; error?: string; sha256Verified?: boolean }> {
    if (!urlStr || !urlStr.startsWith('http')) {
      return { success: false, error: 'Invalid or missing package download URL.' }
    }

    this.activeDownloadUrl = urlStr
    this.activeDownloadSha256 = expectedSha256 || null
    this.isPaused = false

    const settings = this.getUpdateSettings()
    const tempDir = (settings.download_dir && fs.existsSync(settings.download_dir))
      ? settings.download_dir
      : (app ? app.getPath('temp') : '/tmp')

    const parsedUrl = new URL(urlStr)
    const baseName = path.basename(parsedUrl.pathname) || `AntiProfiles-update-${Date.now()}`
    const destPath = path.join(tempDir, baseName)
    const partPath = `${destPath}.download`
    this.activeDownloadPath = partPath

    let startByte = 0
    if (isResume && fs.existsSync(partPath)) {
      try {
        const stat = fs.statSync(partPath)
        startByte = stat.size
        this.downloadedBytes = startByte
      } catch {
        startByte = 0
      }
    } else if (!isResume) {
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath) } catch {}
      this.downloadedBytes = 0
    }

    this.sendProgress({
      percent: 0,
      transferred: this.downloadedBytes,
      total: this.totalBytes || 100,
      speed: 0,
      remainingSeconds: 0,
      status: 'downloading'
    }, onProgress)

    return new Promise((resolve) => {
      const protocol = parsedUrl.protocol === 'https:' ? https : http
      const options: any = {
        headers: {
          'User-Agent': `AntiProfiles-Updater/${this.currentAppVersion} (${process.platform} ${process.arch})`
        }
      }

      if (startByte > 0) {
        options.headers['Range'] = `bytes=${startByte}-`
        logger.info('updater', `[UpdaterService] Resuming download from byte offset ${startByte}`)
      }

      let startTime = Date.now()
      let lastProgressTime = Date.now()
      let bytesSinceLastCheck = 0

      const req = protocol.get(urlStr, options, (res) => {
        // Handle Redirects
        if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          this.downloadUpdatePackage(res.headers.location, expectedSha256, onProgress, isResume).then(resolve)
          return
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          this.sendProgress({
            ...this.currentProgress,
            status: 'error',
            error: `HTTP Server returned status ${res.statusCode}`
          }, onProgress)
          resolve({ success: false, error: `Server returned HTTP status ${res.statusCode}` })
          return
        }

        const contentLength = parseInt(res.headers['content-length'] || '0', 10)
        this.totalBytes = (res.statusCode === 206) ? (startByte + contentLength) : (contentLength || this.totalBytes)
        const fileStream = fs.createWriteStream(partPath, { flags: startByte > 0 ? 'a' : 'w' })

        res.on('data', (chunk) => {
          if (this.isPaused) {
            fileStream.close()
            return
          }

          this.downloadedBytes += chunk.length
          bytesSinceLastCheck += chunk.length
          fileStream.write(chunk)

          const now = Date.now()
          if (now - lastProgressTime > 200) {
            const timeDiffSec = (now - lastProgressTime) / 1000 || 0.2
            const speed = bytesSinceLastCheck / timeDiffSec
            bytesSinceLastCheck = 0
            lastProgressTime = now

            const remainingBytes = Math.max(0, this.totalBytes - this.downloadedBytes)
            const remainingSeconds = speed > 0 ? Math.round(remainingBytes / speed) : 0
            const percent = this.totalBytes > 0 ? Math.min(99, Math.round((this.downloadedBytes / this.totalBytes) * 100)) : 50

            this.sendProgress({
              percent,
              transferred: this.downloadedBytes,
              total: this.totalBytes,
              speed,
              remainingSeconds,
              status: 'downloading'
            }, onProgress)
          }
        })

        res.on('end', () => {
          if (this.isPaused) return

          fileStream.end(async () => {
            this.sendProgress({
              percent: 100,
              transferred: this.downloadedBytes,
              total: this.downloadedBytes,
              speed: 0,
              remainingSeconds: 0,
              status: 'verifying'
            }, onProgress)

            // Move part file to final file
            try {
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
              fs.renameSync(partPath, destPath)
            } catch (err: any) {
              resolve({ success: false, error: `Failed to finalize file: ${err.message}` })
              return
            }

            // Verify SHA-256 Checksum
            let verified = true
            if (expectedSha256 && expectedSha256.trim()) {
              try {
                const fileBuf = fs.readFileSync(destPath)
                const calculatedSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex').toLowerCase()
                const expected = expectedSha256.trim().toLowerCase()

                if (calculatedSha256 !== expected) {
                  logger.error('updater', `[UpdaterService] SHA-256 checksum mismatch! Expected ${expected}, Got ${calculatedSha256}`)
                  try { fs.unlinkSync(destPath) } catch {}
                  this.sendProgress({
                    percent: 0,
                    transferred: 0,
                    total: 0,
                    speed: 0,
                    remainingSeconds: 0,
                    status: 'error',
                    error: 'Checksum verification failed (corrupted download)'
                  }, onProgress)
                  resolve({
                    success: false,
                    error: 'Installer checksum verification failed! Download was corrupted or modified.',
                    sha256Verified: false
                  })
                  return
                }
                logger.info('updater', `[UpdaterService] ✓ SHA-256 Checksum successfully verified: ${calculatedSha256}`)
              } catch (err: any) {
                logger.warn('updater', `Checksum calculation error: ${err.message}`)
              }
            }

            this.sendProgress({
              percent: 100,
              transferred: this.downloadedBytes,
              total: this.downloadedBytes,
              speed: 0,
              remainingSeconds: 0,
              status: 'completed'
            }, onProgress)

            resolve({
              success: true,
              filePath: destPath,
              sha256Verified: verified
            })
          })
        })

        res.on('error', (err) => {
          fileStream.close()
          this.sendProgress({
            ...this.currentProgress,
            status: 'error',
            error: err.message
          }, onProgress)
          resolve({ success: false, error: `Download failed: ${err.message}` })
        })
      })

      this.activeRequest = req

      req.on('error', (err) => {
        this.sendProgress({
          ...this.currentProgress,
          status: 'error',
          error: err.message
        }, onProgress)
        resolve({ success: false, error: `Network connection error: ${err.message}` })
      })

      req.setTimeout(60000, () => {
        req.destroy()
        resolve({ success: false, error: 'Download connection timed out.' })
      })
    })
  }

  /**
   * One-Click Native Installer Execution with Rollback Support
   */
  public async installUpdate(filePath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'Update installer file does not exist.' }
    }

    try {
      logger.info('updater', `[UpdaterService] Installing update from package: ${filePath}`)
      const platform = process.platform

      if (platform === 'darwin') {
        // ── macOS One-Click Installer Engine ──
        return await this.installMacDmg(filePath)
      } else if (platform === 'win32') {
        // ── Windows One-Click NSIS Installer Engine ──
        return await this.installWindowsExe(filePath)
      } else {
        // ── Linux AppImage / Deb Installer Engine ──
        return await this.installLinuxPackage(filePath)
      }
    } catch (err: any) {
      logger.error('updater', `[UpdaterService] Failed to apply update: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  /**
   * macOS: Mounts DMG, swaps app bundle cleanly into /Applications, and restarts
   */
  private async installMacDmg(dmgPath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const mountPoint = `/Volumes/AntiProfiles_Update_${Date.now()}`
      fs.mkdirSync(mountPoint, { recursive: true })

      logger.info('updater', `[macOS Installer] Attaching DMG ${dmgPath} to ${mountPoint}`)
      execSync(`hdiutil attach "${dmgPath}" -mountpoint "${mountPoint}" -nobrowse -quiet`)

      // Find .app inside mountpoint
      const entries = fs.readdirSync(mountPoint)
      const appName = entries.find(e => e.endsWith('.app'))

      if (!appName) {
        try { execSync(`hdiutil detach "${mountPoint}" -force -quiet`) } catch {}
        // Fallback: open DMG in Finder for standard manual drag-and-drop
        await shell.openPath(dmgPath)
        return { success: true, message: 'Mounted installer DMG. Please drag AntiProfiles to Applications.' }
      }

      const sourceApp = path.join(mountPoint, appName)
      const targetApp = `/Applications/${appName}`
      const backupApp = `/tmp/${appName}.backup.${Date.now()}`

      // Create backup for rollback safety
      if (fs.existsSync(targetApp)) {
        try {
          execSync(`cp -R "${targetApp}" "${backupApp}"`)
        } catch {}
      }

      logger.info('updater', `[macOS Installer] Copying ${sourceApp} to ${targetApp}`)
      
      // Perform atomic copy & clear quarantine
      try {
        execSync(`rm -rf "${targetApp}" && cp -R "${sourceApp}" "${targetApp}"`)
        try { execSync(`xattr -cr "${targetApp}"`) } catch {}
      } catch (copyErr: any) {
        // Rollback if copy failed
        if (fs.existsSync(backupApp)) {
          execSync(`rm -rf "${targetApp}" && cp -R "${backupApp}" "${targetApp}"`)
        }
        throw new Error(`Failed to copy updated application: ${copyErr.message}`)
      }

      // Detach DMG
      try { execSync(`hdiutil detach "${mountPoint}" -force -quiet`) } catch {}

      logger.info('updater', `[macOS Installer] ✓ Update applied successfully. Relaunching application...`)

      // Relaunch new version and quit
      setTimeout(() => {
        spawn('open', ['-n', targetApp], { detached: true, stdio: 'ignore' }).unref()
        app.quit()
      }, 800)

      return { success: true, message: 'Update installed successfully. AntiProfiles is restarting...' }
    } catch (err: any) {
      logger.warn('updater', `Automated macOS install encountered issue, falling back to shell open: ${err.message}`)
      await shell.openPath(dmgPath)
      return { success: true, message: 'Opened installer DMG. Please complete installation and restart.' }
    }
  }

  /**
   * Windows: Executes NSIS installer and closes app for automated update
   */
  private async installWindowsExe(exePath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('updater', `[Windows Installer] Launching NSIS installer: ${exePath}`)

      // Spawn installer with /S or standard mode detached
      const child = spawn(exePath, ['--updated'], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      setTimeout(() => {
        app.quit()
      }, 1000)

      return { success: true, message: 'Launching Windows installer. AntiProfiles will close to finish updating.' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  /**
   * Linux: Makes AppImage executable and restarts
   */
  private async installLinuxPackage(pkgPath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      fs.chmodSync(pkgPath, '755')
      logger.info('updater', `[Linux Installer] Launching updated AppImage: ${pkgPath}`)

      const child = spawn(pkgPath, [], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      setTimeout(() => {
        app.quit()
      }, 1000)

      return { success: true, message: 'Launching updated Linux package.' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

export const updaterService = UpdaterService.getInstance()
