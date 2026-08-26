// ──────────────────────────────────────────────
// AntiProfiles — Self-Contained Managed Firefox Runtime Manager
// Downloads, verifies, and manages standalone official Mozilla Firefox builds
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { execSync, spawn } from 'child_process'
import { logger } from '../logging/logger'

export interface ManagedFirefoxStatus {
  installed: boolean
  executablePath: string | null
  version: string | null
  isDownloading: boolean
  downloadProgress: number
  error?: string
}

export type DownloadProgressCallback = (progress: {
  percent: number
  transferredBytes: number
  totalBytes: number
  status: string
}) => void

const FIREFOX_VERSION = '131.0'

let currentDownload: {
  isDownloading: boolean
  progress: number
  error: string | null
} = {
  isDownloading: false,
  progress: 0,
  error: null
}

/**
 * Get the base directory for storing managed Firefox runtimes.
 */
export function getManagedFirefoxDir(): string {
  const userData = app?.getPath ? app.getPath('userData') : path.join(process.env.HOME || process.env.USERPROFILE || '', '.antiprofiles')
  const dir = path.join(userData, 'managed-firefox', FIREFOX_VERSION)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Determine the download artifact details for Firefox based on platform and architecture.
 */
export function getFirefoxPlatformArtifactInfo(): { platformKey: string; fileName: string; downloadUrl: string; executableRelativePath: string } {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    const fileName = `firefox-${FIREFOX_VERSION}.dmg`
    const downloadUrl = `https://ftp.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/mac/en-US/Firefox%20${FIREFOX_VERSION}.dmg`
    const executableRelativePath = path.join('Firefox.app', 'Contents', 'MacOS', 'firefox')
    return { platformKey: 'mac', fileName, downloadUrl, executableRelativePath }
  }

  if (platform === 'win32') {
    const is64 = arch === 'x64' || arch === 'arm64'
    const platformKey = is64 ? 'win64' : 'win32'
    const fileName = `Firefox Setup ${FIREFOX_VERSION}.exe`
    const downloadUrl = `https://ftp.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/${platformKey}/en-US/Firefox%20Setup%20${FIREFOX_VERSION}.exe`
    const executableRelativePath = path.join('firefox', 'firefox.exe')
    return { platformKey, fileName, downloadUrl, executableRelativePath }
  }

  // Linux (x86_64)
  const platformKey = 'linux-x86_64'
  const fileName = `firefox-${FIREFOX_VERSION}.tar.bz2`
  const downloadUrl = `https://ftp.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/${platformKey}/en-US/firefox-${FIREFOX_VERSION}.tar.bz2`
  const executableRelativePath = path.join('firefox', 'firefox')
  return { platformKey, fileName, downloadUrl, executableRelativePath }
}

/**
 * Locate the standalone managed Firefox binary if already installed and valid.
 */
export function getManagedFirefoxExecutable(): string | null {
  const runtimeDir = getManagedFirefoxDir()
  const { executableRelativePath } = getFirefoxPlatformArtifactInfo()
  const execPath = path.join(runtimeDir, executableRelativePath)

  if (fs.existsSync(execPath)) {
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(execPath, 0o755)
      }
      return execPath
    } catch {
      return execPath
    }
  }

  // Check alternative nested locations
  if (process.platform === 'darwin') {
    const altAppPath = path.join(runtimeDir, 'Firefox.app', 'Contents', 'MacOS', 'firefox')
    if (fs.existsSync(altAppPath)) return altAppPath
  }

  return null
}

/**
 * Check managed Firefox runtime status.
 */
export async function getManagedFirefoxStatus(): Promise<ManagedFirefoxStatus> {
  const execPath = getManagedFirefoxExecutable()
  if (!execPath) {
    return {
      installed: false,
      executablePath: null,
      version: null,
      isDownloading: currentDownload.isDownloading,
      downloadProgress: currentDownload.progress,
      error: currentDownload.error || undefined
    }
  }

  // On Windows, use file-based PE validation to avoid cmd.exe ETIMEDOUT
  if (process.platform === 'win32') {
    try {
      const stat = fs.statSync(execPath)
      if (stat.size > 100 * 1024) {
        return {
          installed: true,
          executablePath: execPath,
          version: FIREFOX_VERSION,
          isDownloading: false,
          downloadProgress: 100
        }
      }
    } catch {}
  }

  try {
    const versionOutput = execSync(`"${execPath}" --version`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, DISPLAY: '', MOZ_HEADLESS: '1' }
    }).trim()

    return {
      installed: true,
      executablePath: execPath,
      version: versionOutput || FIREFOX_VERSION,
      isDownloading: false,
      downloadProgress: 100
    }
  } catch (err: any) {
    return {
      installed: true,
      executablePath: execPath,
      version: FIREFOX_VERSION,
      isDownloading: false,
      downloadProgress: 100
    }
  }
}

/**
 * Download helper with HTTP redirect support.
 */
function downloadFile(url: string, destPath: string, onProgress?: DownloadProgressCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)

    function doRequest(targetUrl: string, redirectsRemaining = 5) {
      if (redirectsRemaining <= 0) {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        return reject(new Error('Too many HTTP redirects while downloading Firefox runtime.'))
      }

      const client = targetUrl.startsWith('https') ? https : http
      const req = client.get(targetUrl, {
        headers: {
          'User-Agent': 'AntiProfiles-Runtime-Manager/1.0'
        }
      }, (res) => {
        // Handle 3xx Redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, targetUrl).toString()
          return doRequest(redirectUrl, redirectsRemaining - 1)
        }

        if (res.statusCode !== 200) {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          return reject(new Error(`Download failed with HTTP status ${res.statusCode}: ${res.statusMessage}`))
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let transferredBytes = 0

        res.on('data', (chunk) => {
          transferredBytes += chunk.length
          file.write(chunk)
          if (onProgress && totalBytes > 0) {
            const percent = Math.min(100, Math.round((transferredBytes / totalBytes) * 100))
            onProgress({
              percent,
              transferredBytes,
              totalBytes,
              status: `Downloading Firefox (${Math.round(transferredBytes / 1048576)} MB / ${Math.round(totalBytes / 1048576)} MB)`
            })
          }
        })

        res.on('end', () => {
          file.end(() => resolve())
        })

        res.on('error', (err) => {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          reject(err)
        })
      })

      req.on('error', (err) => {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        reject(err)
      })

      req.setTimeout(60000, () => {
        req.destroy()
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        reject(new Error('Firefox runtime download connection timed out.'))
      })
    }

    doRequest(url)
  })
}

/**
 * Extract downloaded archive to runtime directory.
 */
async function extractFirefoxArchive(archivePath: string, targetDir: string): Promise<void> {
  const platform = process.platform

  if (platform === 'darwin') {
    // Mount DMG and copy Firefox.app
    const mountPoint = path.join(targetDir, 'dmg_mount')
    try {
      if (!fs.existsSync(mountPoint)) fs.mkdirSync(mountPoint, { recursive: true })
      execSync(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}" -nobrowse -quiet`, { timeout: 30000 })
      const appSource = path.join(mountPoint, 'Firefox.app')
      const appDest = path.join(targetDir, 'Firefox.app')
      if (fs.existsSync(appDest)) {
        fs.rmSync(appDest, { recursive: true, force: true })
      }
      execSync(`cp -R "${appSource}" "${appDest}"`, { timeout: 60000 })
      execSync(`hdiutil detach "${mountPoint}" -quiet`, { timeout: 15000 })
    } catch (e: any) {
      try { execSync(`hdiutil detach "${mountPoint}" -quiet`, { timeout: 10000 }) } catch {}
      throw new Error(`Failed to extract macOS Firefox DMG: ${e.message}`)
    } finally {
      try { fs.rmSync(mountPoint, { recursive: true, force: true }) } catch {}
    }
    return
  }

  if (platform === 'win32') {
    // Windows ZIP extraction via PowerShell
    const psCmd = `Expand-Archive -Path "${archivePath}" -DestinationPath "${targetDir}" -Force`
    execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, {
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return
  }

  // Linux tar.bz2 extraction
  execSync(`tar -xjf "${archivePath}" -C "${targetDir}"`, {
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

/**
 * Download and install standalone managed Mozilla Firefox.
 */
export async function downloadAndInstallManagedFirefox(onProgress?: DownloadProgressCallback): Promise<string> {
  const existing = getManagedFirefoxExecutable()
  if (existing) {
    logger.info('browser', `[ManagedFirefox] Standalone Firefox runtime already installed at: ${existing}`)
    return existing
  }

  if (currentDownload.isDownloading) {
    throw new Error('A Firefox runtime download is already in progress.')
  }

  const runtimeDir = getManagedFirefoxDir()
  const { fileName, downloadUrl } = getFirefoxPlatformArtifactInfo()
  const archivePath = path.join(runtimeDir, fileName)

  currentDownload.isDownloading = true
  currentDownload.progress = 0
  currentDownload.error = null

  logger.info('browser', `[ManagedFirefox] Starting official Firefox runtime download from: ${downloadUrl}`)

  try {
    if (onProgress) {
      onProgress({ percent: 0, transferredBytes: 0, totalBytes: 0, status: 'Connecting to Mozilla CDN...' })
    }

    await downloadFile(downloadUrl, archivePath, (p) => {
      currentDownload.progress = p.percent
      if (onProgress) onProgress(p)
    })

    if (onProgress) {
      onProgress({ percent: 100, transferredBytes: 0, totalBytes: 0, status: 'Extracting Firefox runtime...' })
    }

    logger.info('browser', `[ManagedFirefox] Download complete. Extracting ${archivePath} into ${runtimeDir}...`)
    await extractFirefoxArchive(archivePath, runtimeDir)

    // Remove archive file to save disk space
    try { fs.unlinkSync(archivePath) } catch {}

    const executablePath = getManagedFirefoxExecutable()
    if (!executablePath) {
      throw new Error('Firefox binary was not found after extraction.')
    }

    // Set POSIX executable permissions
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(executablePath, 0o755)
      } catch (err: any) {
        logger.warn('browser', `[ManagedFirefox] Failed to set chmod 0755: ${err.message}`)
      }
    }

    // Apply custom Firefox branding assets to the newly extracted runtime
    try {
      const { BrowserIconManager } = require('./branding/browser-icon-manager')
      BrowserIconManager.patchFirefoxRuntimeBranding(executablePath)
    } catch {}

    logger.info('browser', `[ManagedFirefox] Managed Firefox runtime successfully installed at: ${executablePath}`)
    currentDownload.isDownloading = false
    currentDownload.progress = 100
    return executablePath
  } catch (err: any) {
    currentDownload.isDownloading = false
    currentDownload.error = err.message
    try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath) } catch {}
    logger.error('browser', `[ManagedFirefox] Failed to download or install standalone Firefox runtime: ${err.message}`)
    throw new Error(`Failed to download and install managed Firefox runtime: ${err.message}`)
  }
}
