// ──────────────────────────────────────────────
// AntiProfiles — Native Browser Runtime Provisioner & Download Manager
// Fully independent standalone Chromium & Firefox runtime lifecycle manager
// ──────────────────────────────────────────────

import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { execSync, spawn } from 'child_process'
import { logger } from '../logging/logger'

export type BrowserEngine = 'chromium' | 'firefox'

export interface ProvisioningStatus {
  profileId?: string
  engine: BrowserEngine
  step: 'checking' | 'downloading' | 'verifying' | 'extracting' | 'ready' | 'error'
  percent: number
  downloadedBytes: number
  totalBytes: number
  speedBytesPerSec: number
  speedFormatted: string
  etaSeconds: number
  message: string
  error?: string
}

export interface RuntimeDetails {
  engine: BrowserEngine
  name: string
  version: string
  platform: string
  arch: string
  installed: boolean
  executablePath: string | null
  installDir: string
  integrityStatus: 'verified' | 'unverified' | 'missing'
  isDownloading: boolean
  downloadProgress: number
}

const CHROMIUM_VERSION = '131.0-official'
const FIREFOX_VERSION = '131.0'

const activeDownloads: Map<BrowserEngine, {
  abortController: AbortController | null
  isDownloading: boolean
  progress: number
  lastStatus: ProvisioningStatus | null
}> = new Map()

/**
 * Send live provisioning status to all active Electron renderer windows.
 */
export function emitProvisioningStatus(status: ProvisioningStatus): void {
  try {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('runtime:provisioning-progress', status)
      }
    }
  } catch (err: any) {
    logger.warn('browser', `[RuntimeProvisioner] Failed to emit status to renderer: ${err.message}`)
  }
}

/**
 * Get normalized platform and architecture strings.
 */
export function getSystemInfo(): { platform: string; arch: string; osKey: string } {
  const p = process.platform
  const a = process.arch

  let platform = 'linux'
  if (p === 'darwin') platform = 'macos'
  else if (p === 'win32') platform = 'windows'

  const arch = a === 'arm64' ? 'arm64' : (a === 'ia32' ? 'x86' : 'x64')
  const osKey = `${platform}-${arch}`

  return { platform, arch, osKey }
}

/**
 * Base directory for all AntiProfiles application data.
 */
export function getBaseUserDataDir(): string {
  return app?.getPath
    ? app.getPath('userData')
    : path.join(process.env.HOME || process.env.USERPROFILE || '', '.antiprofiles')
}

/**
 * Get the dedicated browser-runtimes base directory.
 */
export function getBrowserRuntimesBaseDir(): string {
  const dir = path.join(getBaseUserDataDir(), 'browser-runtimes')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Get the dedicated downloads directory for temporary runtime packages.
 */
export function getDownloadsDir(): string {
  const dir = path.join(getBaseUserDataDir(), 'downloads')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Get target installation directory for specific browser engine.
 */
export function getEngineInstallDir(engine: BrowserEngine): string {
  const { platform, arch } = getSystemInfo()
  const version = engine === 'chromium' ? CHROMIUM_VERSION : FIREFOX_VERSION
  const dir = path.join(getBrowserRuntimesBaseDir(), engine, platform, arch, version)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Determine official download URL and executable relative path for Chromium.
 */
export function getChromiumArtifactInfo(): { downloadUrl: string; fileName: string; executableRelativePath: string } {
  const p = process.platform
  const isArm = process.arch === 'arm64'

  if (p === 'darwin') {
    const bucket = isArm ? 'Mac_Arm' : 'Mac'
    const fileName = 'chrome-mac.zip'
    const downloadUrl = `https://commondatastorage.googleapis.com/chromium-browser-snapshots/${bucket}/1681655/${fileName}`
    const executableRelativePath = path.join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
    return { downloadUrl, fileName, executableRelativePath }
  }

  if (p === 'win32') {
    const is64 = process.arch === 'x64' || isArm
    const bucket = is64 ? 'Win_x64' : 'Win'
    const fileName = is64 ? 'chrome-win.zip' : 'chrome-win32.zip'
    const downloadUrl = `https://commondatastorage.googleapis.com/chromium-browser-snapshots/${bucket}/1681542/${fileName}`
    const executableRelativePath = path.join(is64 ? 'chrome-win' : 'chrome-win32', 'chrome.exe')
    return { downloadUrl, fileName, executableRelativePath }
  }

  // Linux (x64)
  const fileName = 'chrome-linux.zip'
  const downloadUrl = `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/1681646/${fileName}`
  const executableRelativePath = path.join('chrome-linux', 'chrome')
  return { downloadUrl, fileName, executableRelativePath }
}

/**
 * Determine official download URL and executable relative path for Firefox.
 */
export function getFirefoxArtifactInfo(): { downloadUrl: string; fileName: string; executableRelativePath: string } {
  const p = process.platform
  const isArm = process.arch === 'arm64'

  let fileName = `firefox-${FIREFOX_VERSION}.tar.bz2`
  let downloadUrl = `https://ftp.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/linux-x86_64/en-US/firefox-${FIREFOX_VERSION}.tar.bz2`
  let executableRelativePath = path.join('firefox', 'firefox')

  if (p === 'darwin') {
    fileName = `firefox-${FIREFOX_VERSION}.dmg`
    downloadUrl = `https://ftp.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/mac/en-US/Firefox%20${FIREFOX_VERSION}.dmg`
    executableRelativePath = path.join('Firefox.app', 'Contents', 'MacOS', 'firefox')
  } else if (p === 'win32') {
    const is64 = process.arch === 'x64' || isArm
    const platformKey = is64 ? 'win64' : 'win32'
    fileName = `firefox-${FIREFOX_VERSION}-${platformKey}.zip`
    downloadUrl = `https://ftp.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/${platformKey}/en-US/firefox-${FIREFOX_VERSION}.zip`
    executableRelativePath = path.join('firefox', 'firefox.exe')
  }

  return { downloadUrl, fileName, executableRelativePath }
}

/**
 * Find the managed executable path for a given browser engine if already installed.
 */
export function findManagedExecutable(engine: BrowserEngine): string | null {
  const installDir = getEngineInstallDir(engine)

  if (engine === 'chromium') {
    const { executableRelativePath } = getChromiumArtifactInfo()
    const primaryPath = path.join(installDir, executableRelativePath)
    if (fs.existsSync(primaryPath)) {
      ensureExecutablePermission(primaryPath)
      return primaryPath
    }

    // Search direct subdirectories for pure Chromium
    try {
      const entries = fs.readdirSync(installDir)
      for (const entry of entries) {
        const sub = path.join(installDir, entry)
        if (fs.statSync(sub).isDirectory()) {
          if (process.platform === 'darwin') {
            const macApp = path.join(sub, 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
            if (fs.existsSync(macApp)) {
              ensureExecutablePermission(macApp)
              return macApp
            }
          } else if (process.platform === 'win32') {
            const winExe = path.join(sub, 'chrome.exe')
            if (fs.existsSync(winExe)) return winExe
          } else {
            const linuxExe = path.join(sub, 'chrome')
            if (fs.existsSync(linuxExe)) {
              ensureExecutablePermission(linuxExe)
              return linuxExe
            }
          }
        }
      }
    } catch {}
  } else {
    // Firefox
    const { executableRelativePath } = getFirefoxArtifactInfo()
    const primaryPath = path.join(installDir, executableRelativePath)
    if (fs.existsSync(primaryPath)) {
      ensureExecutablePermission(primaryPath)
      return primaryPath
    }

    // Check legacy managed directory for backward compatibility
    const legacyDir = path.join(getBaseUserDataDir(), 'managed-firefox', FIREFOX_VERSION)
    const legacyPath = path.join(legacyDir, executableRelativePath)
    if (fs.existsSync(legacyPath)) {
      ensureExecutablePermission(legacyPath)
      return legacyPath
    }

    // Direct app check on macOS
    if (process.platform === 'darwin') {
      const macApp = path.join(installDir, 'Firefox.app', 'Contents', 'MacOS', 'firefox')
      if (fs.existsSync(macApp)) {
        ensureExecutablePermission(macApp)
        return macApp
      }
    }
  }

  return null
}

function ensureExecutablePermission(filePath: string): void {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o755)
    } catch {}
  }
}

/**
 * Verify integrity and runnable state of a managed browser binary.
 */
export function verifyManagedExecutable(executablePath: string): { valid: boolean; version: string; error?: string } {
  if (!executablePath || !fs.existsSync(executablePath)) {
    return { valid: false, version: '', error: 'Executable file does not exist.' }
  }

  try {
    ensureExecutablePermission(executablePath)
    const output = execSync(`"${executablePath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()

    return { valid: true, version: output || 'OK' }
  } catch (err: any) {
    return { valid: false, version: '', error: `Integrity check failed: ${err.message}` }
  }
}

/**
 * Helper to download file with redirect handling and speed/progress computation.
 */
function downloadArchiveWithProgress(
  url: string,
  destPath: string,
  onProgress: (info: { transferredBytes: number; totalBytes: number; percent: number; speedBytesPerSec: number; etaSeconds: number }) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    let startTime = Date.now()
    let lastTime = startTime
    let lastBytes = 0
    let currentSpeed = 0

    function requestUrl(targetUrl: string, redirectsRemaining = 5) {
      if (signal?.aborted) {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        return reject(new Error('Download cancelled by user.'))
      }

      if (redirectsRemaining <= 0) {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        return reject(new Error('Too many HTTP redirects.'))
      }

      const client = targetUrl.startsWith('https') ? https : http
      const req = client.get(targetUrl, {
        headers: { 'User-Agent': 'AntiProfiles-Runtime-Manager/2.0' }
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, targetUrl).toString()
          return requestUrl(redirectUrl, redirectsRemaining - 1)
        }

        if (res.statusCode !== 200) {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          return reject(new Error(`Download failed with HTTP status ${res.statusCode}: ${res.statusMessage}`))
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let transferredBytes = 0

        res.on('data', (chunk) => {
          if (signal?.aborted) {
            req.destroy()
            file.close()
            try { fs.unlinkSync(destPath) } catch {}
            return reject(new Error('Download cancelled by user.'))
          }

          transferredBytes += chunk.length
          file.write(chunk)

          const now = Date.now()
          const elapsedSec = (now - lastTime) / 1000
          if (elapsedSec >= 0.5 || transferredBytes === totalBytes) {
            const bytesSinceLast = transferredBytes - lastBytes
            currentSpeed = bytesSinceLast / (elapsedSec || 1)
            lastTime = now
            lastBytes = transferredBytes

            const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0
            const remainingBytes = Math.max(0, totalBytes - transferredBytes)
            const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0

            onProgress({
              transferredBytes,
              totalBytes,
              percent,
              speedBytesPerSec: currentSpeed,
              etaSeconds
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

      req.setTimeout(120000, () => {
        req.destroy()
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        reject(new Error('Connection timed out while downloading runtime package.'))
      })
    }

    requestUrl(url)
  })
}

/**
 * Format bytes into human readable MB/s.
 */
function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s'
  const mb = bytesPerSec / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`
  const kb = bytesPerSec / 1024
  return `${kb.toFixed(0)} KB/s`
}

/**
 * Extract downloaded archive safely into target installation directory.
 */
async function extractPackage(archivePath: string, targetDir: string, isFirefoxDmg: boolean): Promise<void> {
  const p = process.platform

  if (isFirefoxDmg && p === 'darwin') {
    const mountPoint = path.join(targetDir, 'dmg_temp_mount')
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
      throw new Error(`Failed to extract macOS DMG: ${e.message}`)
    } finally {
      try { fs.rmSync(mountPoint, { recursive: true, force: true }) } catch {}
    }
    return
  }

  if (archivePath.endsWith('.zip')) {
    if (p === 'win32') {
      const psCmd = `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${targetDir}' -Force`
      execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, { timeout: 180000 })
      return
    } else {
      execSync(`unzip -q -o "${archivePath}" -d "${targetDir}"`, { timeout: 180000 })
      return
    }
  }

  if (archivePath.endsWith('.tar.bz2')) {
    execSync(`tar -xjf "${archivePath}" -C "${targetDir}"`, { timeout: 180000 })
    return
  }

  throw new Error(`Unsupported archive format: ${archivePath}`)
}

/**
 * Main entry point: Automatically provision, download, verify and return the managed runtime executable.
 */
export async function ensureBrowserRuntime(engine: BrowserEngine, profileId?: string): Promise<string> {
  const engineName = engine === 'chromium' ? 'Google Chromium' : 'Mozilla Firefox'
  logger.info('browser', `[RuntimeProvisioner] Ensuring managed ${engineName} runtime for profile: ${profileId || 'global'}`)

  // 1. Check if already installed and verified
  const existingExec = findManagedExecutable(engine)
  if (existingExec) {
    const check = verifyManagedExecutable(existingExec)
    if (check.valid) {
      logger.info('browser', `[RuntimeProvisioner] Standalone managed ${engineName} runtime is valid: ${existingExec}`)
      emitProvisioningStatus({
        profileId,
        engine,
        step: 'ready',
        percent: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        speedFormatted: '0 MB/s',
        etaSeconds: 0,
        message: `${engineName} runtime is ready.`
      })
      return existingExec
    } else {
      logger.warn('browser', `[RuntimeProvisioner] Existing ${engineName} failed verification: ${check.error}. Reinstalling...`)
    }
  }

  // 2. Prepare for clean download & provisioning
  const abortCtrl = new AbortController()
  activeDownloads.set(engine, {
    abortController: abortCtrl,
    isDownloading: true,
    progress: 0,
    lastStatus: null
  })

  const downloadsDir = getDownloadsDir()
  const installDir = getEngineInstallDir(engine)
  const isChromium = engine === 'chromium'
  const artifactInfo = isChromium ? getChromiumArtifactInfo() : getFirefoxArtifactInfo()
  const archivePath = path.join(downloadsDir, `${engine}-${Date.now()}-${artifactInfo.fileName}`)

  emitProvisioningStatus({
    profileId,
    engine,
    step: 'checking',
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    speedFormatted: '0 MB/s',
    etaSeconds: 0,
    message: `Connecting to official ${engineName} repository...`
  })

  try {
    // 3. Download Archive with Live Progress
    logger.info('browser', `[RuntimeProvisioner] Downloading ${engineName} from: ${artifactInfo.downloadUrl}`)
    await downloadArchiveWithProgress(
      artifactInfo.downloadUrl,
      archivePath,
      (prog) => {
        const speedStr = formatSpeed(prog.speedBytesPerSec)
        const status: ProvisioningStatus = {
          profileId,
          engine,
          step: 'downloading',
          percent: prog.percent,
          downloadedBytes: prog.transferredBytes,
          totalBytes: prog.totalBytes,
          speedBytesPerSec: prog.speedBytesPerSec,
          speedFormatted: speedStr,
          etaSeconds: prog.etaSeconds,
          message: `Downloading ${engineName} (${Math.round(prog.transferredBytes / 1048576)} MB / ${Math.round(prog.totalBytes / 1048576)} MB) • ${speedStr}`
        }
        activeDownloads.get(engine)!.progress = prog.percent
        activeDownloads.get(engine)!.lastStatus = status
        emitProvisioningStatus(status)
      },
      abortCtrl.signal
    )

    // 4. Extract Package
    emitProvisioningStatus({
      profileId,
      engine,
      step: 'extracting',
      percent: 95,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      speedFormatted: '0 MB/s',
      etaSeconds: 0,
      message: `Extracting ${engineName} binaries...`
    })
    logger.info('browser', `[RuntimeProvisioner] Extracting archive ${archivePath} into ${installDir}...`)
    await extractPackage(archivePath, installDir, !isChromium && process.platform === 'darwin')

    // Clean up archive
    try { fs.unlinkSync(archivePath) } catch {}

    // 5. Verify Executable
    emitProvisioningStatus({
      profileId,
      engine,
      step: 'verifying',
      percent: 98,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      speedFormatted: '0 MB/s',
      etaSeconds: 0,
      message: `Verifying ${engineName} package integrity...`
    })

    const finalExec = findManagedExecutable(engine)
    if (!finalExec) {
      throw new Error(`Managed ${engineName} executable was not found after extraction.`)
    }

    const verification = verifyManagedExecutable(finalExec)
    if (!verification.valid) {
      throw new Error(`Verification failed for ${engineName}: ${verification.error}`)
    }

    if (engine === 'firefox') {
      try {
        const { BrowserIconManager } = require('./branding/browser-icon-manager')
        BrowserIconManager.patchFirefoxRuntimeBranding(finalExec)
      } catch {}
    }

    logger.info('browser', `[RuntimeProvisioner] Successfully installed and verified ${engineName} at: ${finalExec}`)
    emitProvisioningStatus({
      profileId,
      engine,
      step: 'ready',
      percent: 100,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      speedFormatted: '0 MB/s',
      etaSeconds: 0,
      message: `${engineName} runtime installed and ready!`
    })

    return finalExec
  } catch (err: any) {
    logger.error('browser', `[RuntimeProvisioner] Failed to provision ${engineName}: ${err.message}`)
    try { fs.unlinkSync(archivePath) } catch {}
    emitProvisioningStatus({
      profileId,
      engine,
      step: 'error',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      speedFormatted: '0 MB/s',
      etaSeconds: 0,
      message: `Failed to install ${engineName}: ${err.message}`,
      error: err.message
    })
    throw err
  } finally {
    activeDownloads.delete(engine)
  }
}

/**
 * Get comprehensive status for all browser runtimes.
 */
export function getRuntimeDetails(engine: BrowserEngine): RuntimeDetails {
  const { platform, arch } = getSystemInfo()
  const version = engine === 'chromium' ? CHROMIUM_VERSION : FIREFOX_VERSION
  const name = engine === 'chromium' ? 'Google Chromium' : 'Mozilla Firefox'
  const installDir = getEngineInstallDir(engine)
  const execPath = findManagedExecutable(engine)
  const active = activeDownloads.get(engine)

  let integrityStatus: 'verified' | 'unverified' | 'missing' = 'missing'
  let installed = false

  if (execPath) {
    installed = true
    const check = verifyManagedExecutable(execPath)
    integrityStatus = check.valid ? 'verified' : 'unverified'
  }

  return {
    engine,
    name,
    version,
    platform,
    arch,
    installed,
    executablePath: execPath,
    installDir,
    integrityStatus,
    isDownloading: !!active?.isDownloading,
    downloadProgress: active?.progress || 0
  }
}
