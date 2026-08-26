// ──────────────────────────────────────────────
// AntiProfiles — Self-Contained Managed Chromium Runtime Manager
// Downloads, verifies, and manages standalone official Chromium builds
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { execSync, spawn } from 'child_process'
import { logger } from '../logging/logger'

export interface ManagedChromiumStatus {
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

const CHROMIUM_VERSION = '131.0.6778.85'
const BASE_URL = `https://storage.googleapis.com/chrome-for-testing-public/${CHROMIUM_VERSION}`

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
 * Get the base directory for storing managed browser runtimes.
 */
export function getManagedRuntimeDir(): string {
  const userData = app?.getPath ? app.getPath('userData') : path.join(process.env.HOME || process.env.USERPROFILE || '', '.antiprofiles')
  const dir = path.join(userData, 'managed-chromium', CHROMIUM_VERSION)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Determine the download artifact name based on platform and architecture.
 */
export function getPlatformArtifactInfo(): { platformKey: string; zipName: string; executableRelativePath: string } {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    const isArm = arch === 'arm64'
    const platformKey = isArm ? 'mac-arm64' : 'mac-x64'
    const zipName = `chrome-${platformKey}.zip`
    const executableRelativePath = path.join(`chrome-${platformKey}`, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
    return { platformKey, zipName, executableRelativePath }
  }

  if (platform === 'win32') {
    const is64 = arch === 'x64' || arch === 'arm64'
    const platformKey = is64 ? 'win64' : 'win32'
    const zipName = `chrome-${platformKey}.zip`
    const executableRelativePath = path.join(`chrome-${platformKey}`, 'chrome.exe')
    return { platformKey, zipName, executableRelativePath }
  }

  // Linux (x64)
  const platformKey = 'linux64'
  const zipName = `chrome-${platformKey}.zip`
  const executableRelativePath = path.join(`chrome-${platformKey}`, 'chrome')
  return { platformKey, zipName, executableRelativePath }
}

/**
 * Locate the standalone managed Chromium binary if already installed and executable.
 */
export function getManagedChromiumExecutable(): string | null {
  const runtimeDir = getManagedRuntimeDir()
  const { executableRelativePath } = getPlatformArtifactInfo()
  const execPath = path.join(runtimeDir, executableRelativePath)

  if (fs.existsSync(execPath)) {
    try {
      // Ensure POSIX executable permissions
      if (process.platform !== 'win32') {
        fs.chmodSync(execPath, 0o755)
      }
      return execPath
    } catch {
      return execPath
    }
  }

  // Check alternative folder structure
  try {
    const entries = fs.readdirSync(runtimeDir)
    for (const entry of entries) {
      const sub = path.join(runtimeDir, entry)
      if (fs.statSync(sub).isDirectory()) {
        if (process.platform === 'darwin') {
          const macApp = path.join(sub, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
          if (fs.existsSync(macApp)) {
            try { fs.chmodSync(macApp, 0o755) } catch {}
            return macApp
          }
          const altMac = path.join(sub, 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
          if (fs.existsSync(altMac)) {
            try { fs.chmodSync(altMac, 0o755) } catch {}
            return altMac
          }
        } else if (process.platform === 'win32') {
          const winExe = path.join(sub, 'chrome.exe')
          if (fs.existsSync(winExe)) return winExe
        } else {
          const linuxExe = path.join(sub, 'chrome')
          if (fs.existsSync(linuxExe)) {
            try { fs.chmodSync(linuxExe, 0o755) } catch {}
            return linuxExe
          }
        }
      }
    }
  } catch {}

  return null
}

/**
 * Check the status of the managed Chromium runtime.
 */
export function getManagedChromiumStatus(): ManagedChromiumStatus {
  const execPath = getManagedChromiumExecutable()
  let version: string | null = null

  if (execPath && fs.existsSync(execPath)) {
    if (process.platform === 'win32') {
      try {
        const stat = fs.statSync(execPath)
        if (stat.size > 4096) {
          return {
            installed: true,
            executablePath: execPath,
            version: CHROMIUM_VERSION,
            isDownloading: false,
            downloadProgress: 100
          }
        }
      } catch {}
    }

    try {
      const out = execSync(`"${execPath}" --version`, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const match = out.match(/[\d.]+/)
      version = match ? match[0] : CHROMIUM_VERSION
    } catch {
      version = CHROMIUM_VERSION
    }

    return {
      installed: true,
      executablePath: execPath,
      version,
      isDownloading: false,
      downloadProgress: 100
    }
  }

  return {
    installed: false,
    executablePath: null,
    version: null,
    isDownloading: currentDownload.isDownloading,
    downloadProgress: currentDownload.progress,
    error: currentDownload.error || undefined
  }
}

/**
 * Unzip an archive using native platform commands (PowerShell on Windows, unzip on macOS/Linux).
 */
async function extractZip(zipFilePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('browser', `[ChromiumManager] Extracting runtime archive: ${zipFilePath} -> ${destDir}`)

    if (process.platform === 'win32') {
      const psCmd = `Expand-Archive -LiteralPath '${zipFilePath}' -DestinationPath '${destDir}' -Force`
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', psCmd], { stdio: 'ignore' })
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`PowerShell Expand-Archive failed with code ${code}`))
      })
      child.on('error', reject)
    } else {
      const child = spawn('unzip', ['-q', '-o', zipFilePath, '-d', destDir], { stdio: 'ignore' })
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`unzip failed with code ${code}`))
      })
      child.on('error', reject)
    }
  })
}

/**
 * Download a file with redirect support and progress tracking.
 */
function downloadFile(url: string, destPath: string, onProgress?: DownloadProgressCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)

    const requestWithRedirects = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading Chromium runtime'))
        return
      }

      const client = currentUrl.startsWith('https') ? https : http
      client.get(currentUrl, (response) => {
        // Handle 3xx redirects
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location
          logger.info('browser', `[ChromiumDownloader] Redirecting (${response.statusCode}) to: ${redirectUrl}`)
          requestWithRedirects(redirectUrl, redirectCount + 1)
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with HTTP status code ${response.statusCode}`))
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        let transferredBytes = 0

        response.on('data', (chunk) => {
          transferredBytes += chunk.length
          const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0
          currentDownload.progress = percent

          onProgress?.({
            percent,
            transferredBytes,
            totalBytes,
            status: `Downloading Chromium ${CHROMIUM_VERSION} (${percent}%)...`
          })
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close(() => resolve())
        })
      }).on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    }

    requestWithRedirects(url)
  })
}

/**
 * Download, extract, and initialize the official managed Chromium runtime.
 */
export async function downloadAndInstallManagedChromium(onProgress?: DownloadProgressCallback): Promise<string> {
  // Check if already installed
  const existing = getManagedChromiumExecutable()
  if (existing) {
    logger.info('browser', `[ChromiumManager] Managed Chromium is already installed at: ${existing}`)
    return existing
  }

  if (currentDownload.isDownloading) {
    throw new Error('A Chromium download is already in progress.')
  }

  currentDownload = { isDownloading: true, progress: 0, error: null }
  const runtimeDir = getManagedRuntimeDir()
  const { platformKey, zipName } = getPlatformArtifactInfo()
  const downloadUrl = `${BASE_URL}/${platformKey}/${zipName}`
  const zipDestPath = path.join(runtimeDir, zipName)

  logger.info('browser', `[ChromiumManager] Starting managed Chromium runtime download from: ${downloadUrl}`)
  onProgress?.({ percent: 0, transferredBytes: 0, totalBytes: 0, status: 'Connecting to Chromium CDN...' })

  try {
    // 1. Download ZIP
    await downloadFile(downloadUrl, zipDestPath, onProgress)
    logger.info('browser', `[ChromiumManager] Download complete. Extracting runtime...`)
    onProgress?.({ percent: 95, transferredBytes: 0, totalBytes: 0, status: 'Extracting Chromium binaries...' })

    // 2. Extract ZIP
    await extractZip(zipDestPath, runtimeDir)

    // 3. Clean up ZIP
    try { fs.unlinkSync(zipDestPath) } catch {}

    // 4. Verify binary exists and set permissions
    const execPath = getManagedChromiumExecutable()
    if (!execPath || !fs.existsSync(execPath)) {
      throw new Error('Managed Chromium binary was not found after archive extraction.')
    }

    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(execPath, 0o755)
      } catch {}
    }

    // 5. Test execution
    try {
      execSync(`"${execPath}" --version`, { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {}

    // Apply custom Chromium branding assets to the newly extracted runtime
    try {
      const { BrowserIconManager } = require('./branding/browser-icon-manager')
      BrowserIconManager.patchChromiumRuntimeBranding(execPath)
    } catch {}

    currentDownload.isDownloading = false
    currentDownload.progress = 100
    logger.info('browser', `[ChromiumManager] Successfully installed Managed Chromium at: ${execPath}`)

    onProgress?.({ percent: 100, transferredBytes: 0, totalBytes: 0, status: 'Chromium runtime ready!' })
    return execPath
  } catch (err: any) {
    currentDownload.isDownloading = false
    currentDownload.error = err.message
    logger.error('browser', `[ChromiumManager] Failed to download managed Chromium: ${err.message}`)
    throw err
  }
}
