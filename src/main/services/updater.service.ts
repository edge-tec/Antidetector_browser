// ──────────────────────────────────────────────
// AntiProfiles — Real-Time Software Update & Release Management Service
// ──────────────────────────────────────────────

import { BrowserWindow, app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import crypto from 'crypto'
import { URL } from 'url'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'

export interface SoftwareVersionRecord {
  id: string
  version: string
  release_title: string
  release_notes: string
  status: 'draft' | 'published' | 'disabled'
  min_supported_version: string
  force_update: number
  
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
  
  published_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PlatformPackageInfo {
  platformKey: 'windows-x64' | 'macos-arm64' | 'macos-x64' | 'linux-x64'
  platformLabel: string
  downloadUrl: string
  fileSize: number
  sha256: string
  filename: string
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
   * Determine client platform key and label
   */
  public detectClientPlatform(): { key: PlatformPackageInfo['platformKey']; label: string } {
    const p = process.platform
    const arch = process.arch

    if (p === 'win32') {
      return { key: 'windows-x64', label: 'Windows (64-bit)' }
    } else if (p === 'darwin') {
      if (arch === 'arm64') {
        return { key: 'macos-arm64', label: 'macOS Apple Silicon (M1-M4)' }
      }
      return { key: 'macos-x64', label: 'macOS Intel (64-bit)' }
    } else {
      return { key: 'linux-x64', label: 'Linux (64-bit)' }
    }
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
    const rows = db.prepare('SELECT * FROM software_versions ORDER BY created_at DESC').all() as SoftwareVersionRecord[]
    return rows
  }

  /**
   * Get single version by ID
   */
  public getVersionById(id: string): SoftwareVersionRecord | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM software_versions WHERE id = ?').get(id) as SoftwareVersionRecord | undefined
    return row || null
  }

  /**
   * Get latest published software release
   */
  public getLatestPublishedVersion(): SoftwareVersionRecord | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT * FROM software_versions
      WHERE status = 'published'
      ORDER BY published_at DESC, created_at DESC
      LIMIT 1
    `).get() as SoftwareVersionRecord | undefined

    return row || null
  }

  /**
   * Check if an update is available against current version
   */
  public checkForUpdate(currentVer?: string): {
    hasUpdate: boolean
    currentVersion: string
    latestVersion?: SoftwareVersionRecord
    packageInfo?: PlatformPackageInfo
    forceUpdate?: boolean
  } {
    const current = currentVer || this.currentAppVersion
    const latest = this.getLatestPublishedVersion()

    if (!latest) {
      return { hasUpdate: false, currentVersion: current }
    }

    const isNewer = compareSemver(latest.version, current) > 0
    const packageInfo = this.getPackageInfoForPlatform(latest)
    const isForce = Boolean(latest.force_update) || compareSemver(latest.min_supported_version || '1.0.0', current) > 0

    return {
      hasUpdate: isNewer,
      currentVersion: current,
      latestVersion: latest,
      packageInfo,
      forceUpdate: isForce
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
    const releaseTitle = data.release_title || `AntiProfiles v${version} Release`
    const releaseNotes = data.release_notes || 'Performance enhancements, security updates, and bug fixes.'
    const status = data.status || 'draft'
    const minSupported = data.min_supported_version || '1.0.0'
    const forceUpdate = data.force_update ? 1 : 0

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
        id, version, release_title, release_notes, status, min_supported_version, force_update,
        win_download_url, win_file_size, win_sha256,
        mac_intel_download_url, mac_intel_file_size, mac_intel_sha256,
        mac_arm_download_url, mac_arm_file_size, mac_arm_sha256,
        linux_download_url, linux_file_size, linux_sha256,
        published_at, created_by, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
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
        published_at = excluded.published_at,
        updated_at = datetime('now')
    `).run(
      id, version, releaseTitle, releaseNotes, status, minSupported, forceUpdate,
      winUrl, winSize, winSha,
      macIntelUrl, macIntelSize, macIntelSha,
      macArmUrl, macArmSize, macArmSha,
      linuxUrl, linuxSize, linuxSha,
      publishedAt, adminUser
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
   * Admin: Disable a published version
   */
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

  /**
   * Admin: Delete a version record
   */
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
    const payload = {
      version: release.version,
      releaseTitle: release.release_title,
      releaseNotes: release.release_notes,
      publishedAt: release.published_at,
      forceUpdate: Boolean(release.force_update),
      minSupportedVersion: release.min_supported_version,
      packageInfo,
      timestamp: Date.now()
    }

    // 1. Broadcast to all open Electron Windows
    try {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('ui:software-update-available', payload)
        }
      })
      logger.info('updater', `[UpdaterService] Sent real-time update notification to ${windows.length} client window(s).`)
    } catch (err: any) {
      logger.warn('updater', `[UpdaterService] Failed to broadcast IPC to windows: ${err.message}`)
    }
  }

  /**
   * Download the update package with progress and SHA-256 integrity verification
   */
  public async downloadUpdatePackage(
    urlStr: string,
    expectedSha256?: string,
    onProgress?: (progress: { percent: number; transferred: number; total: number; speed: number }) => void
  ): Promise<{ success: boolean; filePath?: string; error?: string; sha256Verified?: boolean }> {
    if (!urlStr || !urlStr.startsWith('http')) {
      return { success: false, error: 'Invalid or missing package download URL.' }
    }

    const tempDir = app ? app.getPath('temp') : '/tmp'
    const parsedUrl = new URL(urlStr)
    const baseName = path.basename(parsedUrl.pathname) || `AntiProfiles-update-${Date.now()}`
    const destPath = path.join(tempDir, baseName)

    return new Promise((resolve) => {
      const protocol = parsedUrl.protocol === 'https:' ? https : http
      let startTime = Date.now()
      let lastProgressTime = Date.now()

      const req = protocol.get(urlStr, (res) => {
        // Handle Redirects
        if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          this.downloadUpdatePackage(res.headers.location, expectedSha256, onProgress).then(resolve)
          return
        }

        if (res.statusCode !== 200) {
          resolve({ success: false, error: `Server returned HTTP status ${res.statusCode}` })
          return
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let downloadedBytes = 0
        const hash = crypto.createHash('sha256')
        const fileStream = fs.createWriteStream(destPath)

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length
          hash.update(chunk)
          fileStream.write(chunk)

          const now = Date.now()
          if (now - lastProgressTime > 150 && onProgress) {
            lastProgressTime = now
            const elapsedSec = (now - startTime) / 1000 || 0.1
            const speed = downloadedBytes / elapsedSec
            const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 50

            onProgress({
              percent,
              transferred: downloadedBytes,
              total: totalBytes,
              speed
            })
          }
        })

        res.on('end', () => {
          fileStream.end(() => {
            const calculatedSha256 = hash.digest('hex').toLowerCase()
            let verified = true

            if (expectedSha256 && expectedSha256.trim()) {
              const expected = expectedSha256.trim().toLowerCase()
              if (calculatedSha256 !== expected) {
                logger.error('updater', `[UpdaterService] SHA-256 verification failed! Expected: ${expected}, Got: ${calculatedSha256}`)
                try { fs.unlinkSync(destPath) } catch {}
                resolve({
                  success: false,
                  error: 'Package integrity verification failed! Checksum mismatch detected.',
                  sha256Verified: false
                })
                return
              }
              logger.info('updater', `[UpdaterService] ✓ SHA-256 checksum verified: ${calculatedSha256}`)
            }

            if (onProgress) {
              onProgress({
                percent: 100,
                transferred: downloadedBytes,
                total: downloadedBytes,
                speed: 0
              })
            }

            resolve({
              success: true,
              filePath: destPath,
              sha256Verified: verified
            })
          })
        })

        res.on('error', (err) => {
          fileStream.close()
          try { fs.unlinkSync(destPath) } catch {}
          resolve({ success: false, error: `Download failed: ${err.message}` })
        })
      })

      req.on('error', (err) => {
        resolve({ success: false, error: `Network error: ${err.message}` })
      })

      req.setTimeout(60000, () => {
        req.destroy()
        resolve({ success: false, error: 'Connection timed out while downloading update package.' })
      })
    })
  }

  /**
   * Safely launch / install the downloaded update package without touching profile data
   */
  public async installUpdate(filePath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'Update installer file does not exist.' }
    }

    try {
      logger.info('updater', `[UpdaterService] Launching software installer: ${filePath}`)

      if (process.platform === 'darwin') {
        // macOS: open .dmg file
        await shell.openPath(filePath)
        return { success: true, message: 'Opened macOS installer package. Please drag AntiProfiles to Applications to complete the update.' }
      } else if (process.platform === 'win32') {
        // Windows: execute installer
        await shell.openPath(filePath)
        return { success: true, message: 'Launching Windows installer. The application will close to apply updates.' }
      } else {
        // Linux: open AppImage
        fs.chmodSync(filePath, '755')
        await shell.openPath(filePath)
        return { success: true, message: 'Launching Linux AppImage.' }
      }
    } catch (err: any) {
      logger.error('updater', `[UpdaterService] Failed to execute installer: ${err.message}`)
      return { success: false, error: err.message }
    }
  }
}

export const updaterService = UpdaterService.getInstance()
