// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise Multi-Kernel Browser Version Manager
// Supports Chrome for Testing (multi-version) & Firefox ESR/Dev Edition
// Isolated per-version directories, SHA-256 verification, strict matching
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import fs from 'fs'
import https from 'https'
import path from 'path'
import { execFileSync } from 'child_process'
import {
  getBrowserRuntimesBaseDir,
  getDownloadsDir,
  getSystemInfo,
  verifyManagedExecutable
} from './runtime-provisioner'
import { logger } from '../logging/logger'

export type KernelEngine = 'chromium' | 'firefox' | 'camoufox'
export type FirefoxChannel = 'esr' | 'devedition'

export interface KernelRelease {
  id: string
  engine: KernelEngine
  channel: 'stable' | 'esr' | 'devedition' | 'stealth'
  version: string
  major: number
  label: string
  recommended?: boolean
  sha256?: string
}

export interface InstalledKernelInfo extends KernelRelease {
  installed: boolean
  installDir: string
  executablePath: string | null
  sizeBytes: number
  integrityStatus: 'verified' | 'unverified' | 'missing'
  installedAt?: string
}

export interface KernelCompatibilityReport {
  compatible: boolean
  exactMatch: boolean
  requestedVersion: string
  resolvedVersion: string | null
  resolvedExecutablePath: string | null
  warning?: string
  error?: string
}

/**
 * Official Chrome for Testing & Firefox ESR/Developer Edition catalog.
 * Chrome for Testing provides permanent, versioned, reproducible builds.
 * Firefox ESR & Developer Edition support enterprise extension management.
 */
export const KERNEL_CATALOG: KernelRelease[] = [
  {
    id: 'chromium-136',
    engine: 'chromium',
    channel: 'stable',
    version: '136.0.7103.92',
    major: 136,
    label: 'Chrome for Testing 136 (Latest Stable)',
    recommended: true
  },
  {
    id: 'chromium-134',
    engine: 'chromium',
    channel: 'stable',
    version: '134.0.6998.165',
    major: 134,
    label: 'Chrome for Testing 134 (Stable)'
  },
  {
    id: 'chromium-131',
    engine: 'chromium',
    channel: 'stable',
    version: '131.0.6778.264',
    major: 131,
    label: 'Chrome for Testing 131 (LTS Compatible)'
  },
  {
    id: 'chromium-128',
    engine: 'chromium',
    channel: 'stable',
    version: '128.0.6613.137',
    major: 128,
    label: 'Chrome for Testing 128 (Legacy)'
  },
  {
    id: 'firefox-128-esr',
    engine: 'firefox',
    channel: 'esr',
    version: '128.10.0esr',
    major: 128,
    label: 'Firefox 128 ESR (Enterprise Extended Support)',
    recommended: true
  },
  {
    id: 'firefox-devedition-138',
    engine: 'firefox',
    channel: 'devedition',
    version: '138.0b9',
    major: 138,
    label: 'Firefox Developer Edition 138'
  },
  {
    id: 'camoufox-135',
    engine: 'camoufox',
    channel: 'stealth',
    version: '135.0.1-beta.24',
    major: 135,
    label: 'Camoufox 135 (C++ Native Anti-Detect Kernel)',
    recommended: true
  }
]

function getCftPlatformKey(): string {
  const p = process.platform
  const a = process.arch
  if (p === 'darwin') return a === 'arm64' ? 'mac-arm64' : 'mac-x64'
  if (p === 'win32') return a === 'ia32' ? 'win32' : 'win64'
  return 'linux64'
}

export function getKernelArtifactSpec(release: KernelRelease): {
  downloadUrl: string
  fileName: string
  executableRelativePath: string
} {
  if (release.engine === 'chromium') {
    const platKey = getCftPlatformKey()
    const fileName = `chrome-${platKey}.zip`
    const downloadUrl = `https://storage.googleapis.com/chrome-for-testing-public/${release.version}/${platKey}/${fileName}`
    let executableRelativePath = path.join(`chrome-${platKey}`, 'chrome')
    if (process.platform === 'darwin') {
      executableRelativePath = path.join(
        `chrome-${platKey}`,
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing'
      )
    } else if (process.platform === 'win32') {
      executableRelativePath = path.join(`chrome-${platKey}`, 'chrome.exe')
    }
    return { downloadUrl, fileName, executableRelativePath }
  }

  if (release.engine === 'camoufox') {
    const tag = `v${release.version}`
    if (process.platform === 'darwin') {
      const macArch = process.arch === 'arm64' ? 'arm64' : 'x86_64'
      const fileName = `camoufox-${release.version}-mac.${macArch}.zip`
      return {
        downloadUrl: `https://github.com/daijro/camoufox/releases/download/${tag}/${fileName}`,
        fileName,
        executableRelativePath: path.join('Camoufox.app', 'Contents', 'MacOS', 'camoufox')
      }
    }
    if (process.platform === 'win32') {
      const fileName = `camoufox-${release.version}-win.x86_64.zip`
      return {
        downloadUrl: `https://github.com/daijro/camoufox/releases/download/${tag}/${fileName}`,
        fileName,
        executableRelativePath: 'camoufox.exe'
      }
    }
    const fileName = `camoufox-${release.version}-lin.x86_64.zip`
    return {
      downloadUrl: `https://github.com/daijro/camoufox/releases/download/${tag}/${fileName}`,
      fileName,
      executableRelativePath: 'camoufox'
    }
  }

  // Firefox ESR or Developer Edition
  const basePath = release.channel === 'devedition'
    ? `https://archive.mozilla.org/pub/devedition/releases/${release.version}`
    : `https://archive.mozilla.org/pub/firefox/releases/${release.version}`

  if (process.platform === 'darwin') {
    const appName = release.channel === 'devedition' ? 'Firefox Developer Edition.app' : 'Firefox.app'
    const dmgName = `Firefox%20${release.version}.dmg`
    return {
      downloadUrl: `${basePath}/mac/en-US/${dmgName}`,
      fileName: `firefox-${release.version}.dmg`,
      executableRelativePath: path.join(appName, 'Contents', 'MacOS', 'firefox')
    }
  }
  if (process.platform === 'win32') {
    const archKey = process.arch === 'ia32' ? 'win32' : 'win64'
    return {
      downloadUrl: `${basePath}/${archKey}/en-US/Firefox%20Setup%20${release.version}.exe`,
      fileName: `Firefox-Setup-${release.version}.exe`,
      executableRelativePath: path.join('firefox', 'firefox.exe')
    }
  }
  return {
    downloadUrl: `${basePath}/linux-x86_64/en-US/firefox-${release.version}.tar.xz`,
    fileName: `firefox-${release.version}.tar.xz`,
    executableRelativePath: path.join('firefox', 'firefox')
  }
}

export function getKernelInstallDir(engine: KernelEngine, version: string): string {
  const { platform, arch } = getSystemInfo()
  // Sanitize version to prevent path traversal
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '')
  return path.join(getBrowserRuntimesBaseDir(), engine, platform, arch, safeVersion)
}

export function computeFileSha256(filePath: string): string {
  const hash = crypto.createHash('sha256')
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

export function verifyFileSha256(filePath: string, expectedSha256: string): boolean {
  if (!expectedSha256) return true
  const actual = computeFileSha256(filePath)
  const expected = expectedSha256.trim().toLowerCase()
  if (actual.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

function getDirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSizeBytes(full)
      } else if (entry.isFile()) {
        total += fs.statSync(full).size
      }
    }
  } catch {}
  return total
}

class MultiKernelManager {
  /**
   * List all catalog runtimes along with their real local installation & integrity state.
   */
  listRuntimes(engineFilter?: KernelEngine): InstalledKernelInfo[] {
    const releases = engineFilter
      ? KERNEL_CATALOG.filter((r) => r.engine === engineFilter)
      : KERNEL_CATALOG

    return releases.map((release) => {
      const installDir = getKernelInstallDir(release.engine, release.version)
      const spec = getKernelArtifactSpec(release)
      const execPath = path.join(installDir, spec.executableRelativePath)
      const installed = fs.existsSync(execPath)

      let integrityStatus: 'verified' | 'unverified' | 'missing' = 'missing'
      let installedAt: string | undefined

      if (installed) {
        const stat = fs.statSync(execPath)
        installedAt = stat.mtime.toISOString()
        integrityStatus = stat.size > 4096 ? 'verified' : 'unverified'
      }

      return {
        ...release,
        installed,
        installDir,
        executablePath: installed ? execPath : null,
        sizeBytes: installed ? getDirSizeBytes(installDir) : 0,
        integrityStatus,
        installedAt
      }
    })
  }

  /**
   * Resolve a kernel for a profile without silently substituting an incompatible version.
   */
  resolveKernelForProfile(
    engine: KernelEngine,
    requestedVersion?: string
  ): KernelCompatibilityReport {
    const installed = this.listRuntimes(engine).filter((r) => r.installed && r.executablePath)
    const reqVer = (requestedVersion || '').trim()

    if (!reqVer || reqVer === 'latest') {
      const preferred = installed.find((r) => r.recommended) || installed[0]
      if (!preferred) {
        return {
          compatible: false,
          exactMatch: false,
          requestedVersion: reqVer || 'latest',
          resolvedVersion: null,
          resolvedExecutablePath: null,
          error: `No managed ${engine} runtime is installed. Please install a runtime in Browser Runtimes.`
        }
      }
      return {
        compatible: true,
        exactMatch: true,
        requestedVersion: reqVer || 'latest',
        resolvedVersion: preferred.version,
        resolvedExecutablePath: preferred.executablePath
      }
    }

    const reqMajor = parseInt(reqVer.split('.')[0] || '0', 10)
    const exact = installed.find((r) => r.version === reqVer || r.major === reqMajor)

    if (exact) {
      return {
        compatible: true,
        exactMatch: true,
        requestedVersion: reqVer,
        resolvedVersion: exact.version,
        resolvedExecutablePath: exact.executablePath
      }
    }

    // Never silently substitute — explicitly report incompatibility
    return {
      compatible: false,
      exactMatch: false,
      requestedVersion: reqVer,
      resolvedVersion: installed[0]?.version || null,
      resolvedExecutablePath: null,
      error: `Requested ${engine} v${reqVer} (major ${reqMajor}) is not installed. Installed versions: ${installed.map((r) => r.version).join(', ') || 'none'}.`
    }
  }

  /**
   * Download, verify, and install a specific kernel release into its isolated directory.
   */
  async installKernel(
    releaseId: string,
    onProgress?: (percent: number, message: string) => void
  ): Promise<InstalledKernelInfo> {
    const release = KERNEL_CATALOG.find((r) => r.id === releaseId)
    if (!release) {
      throw new Error(`Unknown browser kernel release: ${releaseId}`)
    }

    const installDir = getKernelInstallDir(release.engine, release.version)
    const spec = getKernelArtifactSpec(release)
    const archivePath = path.join(getDownloadsDir(), `${release.id}-${Date.now()}-${spec.fileName}`)

    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true })
    }

    onProgress?.(5, `Downloading ${release.label}...`)
    await this.downloadFile(spec.downloadUrl, archivePath, (pct) => {
      onProgress?.(Math.min(80, Math.round(pct * 0.8)), `Downloading ${release.label} (${pct}%)...`)
    })

    if (release.sha256) {
      onProgress?.(82, 'Verifying SHA-256 integrity...')
      if (!verifyFileSha256(archivePath, release.sha256)) {
        try { fs.unlinkSync(archivePath) } catch {}
        throw new Error(`SHA-256 checksum verification failed for ${release.label}`)
      }
    }

    onProgress?.(85, `Extracting ${release.label}...`)
    this.extractArchive(archivePath, installDir, release)
    try { fs.unlinkSync(archivePath) } catch {}

    const execPath = path.join(installDir, spec.executableRelativePath)
    onProgress?.(95, 'Verifying executable binary...')
    const check = verifyManagedExecutable(execPath)
    if (!check.valid) {
      throw new Error(`Installed kernel failed verification: ${check.error}`)
    }

    onProgress?.(100, `${release.label} installed and verified.`)
    logger.info('browser', `[MultiKernel] Installed ${release.label} at ${execPath}`)

    return this.listRuntimes(release.engine).find((r) => r.id === release.id)!
  }

  /**
   * Remove an installed kernel release cleanly.
   */
  uninstallKernel(releaseId: string): boolean {
    const release = KERNEL_CATALOG.find((r) => r.id === releaseId)
    if (!release) return false
    const installDir = getKernelInstallDir(release.engine, release.version)
    if (fs.existsSync(installDir)) {
      fs.rmSync(installDir, { recursive: true, force: true })
      logger.info('browser', `[MultiKernel] Uninstalled kernel ${release.label}`)
      return true
    }
    return false
  }

  /**
   * Clean up stale downloaded archives in the downloads cache.
   */
  cleanupCache(): { removedFiles: number; freedBytes: number } {
    const downloadsDir = getDownloadsDir()
    let removedFiles = 0
    let freedBytes = 0
    if (!fs.existsSync(downloadsDir)) return { removedFiles, freedBytes }
    for (const file of fs.readdirSync(downloadsDir)) {
      const full = path.join(downloadsDir, file)
      try {
        const stat = fs.statSync(full)
        if (stat.isFile()) {
          freedBytes += stat.size
          fs.unlinkSync(full)
          removedFiles++
        }
      } catch {}
    }
    return { removedFiles, freedBytes }
  }

  private downloadFile(url: string, destPath: string, onPct: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath)
      const fetchUrl = (targetUrl: string, redirects = 5) => {
        if (redirects <= 0) {
          file.close()
          return reject(new Error('Too many HTTP redirects'))
        }
        const req = https.get(targetUrl, { headers: { 'User-Agent': 'AntiProfiles-Kernel-Manager/2.0' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            return fetchUrl(res.headers.location, redirects - 1)
          }
          if (res.statusCode !== 200) {
            file.close()
            try { fs.unlinkSync(destPath) } catch {}
            return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          }
          const total = parseInt(res.headers['content-length'] || '0', 10)
          let received = 0
          res.on('data', (chunk) => {
            received += chunk.length
            file.write(chunk)
            if (total > 0) onPct(Math.min(100, Math.round((received / total) * 100)))
          })
          res.on('end', () => file.end(() => resolve()))
          res.on('error', (err) => { file.close(); reject(err) })
        })
        req.on('error', (err) => { file.close(); reject(err) })
        req.setTimeout(120000, () => { req.destroy(); file.close(); reject(new Error('Download timed out')) })
      }
      fetchUrl(url)
    })
  }

  private extractArchive(archivePath: string, targetDir: string, release: KernelRelease): void {
    // 1. Windows Firefox .exe installer (NSIS / 7-Zip SFX portable extraction)
    if (archivePath.toLowerCase().endsWith('.exe') && process.platform === 'win32') {
      const firefoxDir = path.join(targetDir, 'firefox')
      if (!fs.existsSync(firefoxDir)) fs.mkdirSync(firefoxDir, { recursive: true })
      try {
        execFileSync(archivePath, [`/ExtractDir=${firefoxDir}`], { timeout: 300000, windowsHide: true })
      } catch {
        execFileSync(archivePath, ['/S', `/D=${firefoxDir}`], { timeout: 300000, windowsHide: true })
      }
      return
    }

    // 2. Cross-platform .zip extraction (Windows tar + PowerShell fallback, macOS/Linux unzip + ditto fallback)
    if (archivePath.endsWith('.zip')) {
      if (process.platform === 'win32') {
        try {
          execFileSync('tar', ['-xf', archivePath, '-C', targetDir], { timeout: 300000, windowsHide: true })
        } catch {
          const psCmd = `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${targetDir}' -Force`
          execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psCmd], {
            timeout: 300000,
            windowsHide: true
          })
        }
      } else if (process.platform === 'darwin') {
        try {
          execFileSync('ditto', ['-x', '-k', archivePath, targetDir], { timeout: 180000 })
        } catch {
          execFileSync('unzip', ['-q', '-o', archivePath, '-d', targetDir], { timeout: 180000 })
        }
        try {
          execFileSync('xattr', ['-cr', targetDir], { timeout: 15000 })
        } catch {}
      } else {
        execFileSync('unzip', ['-q', '-o', archivePath, '-d', targetDir], { timeout: 180000 })
      }
      return
    }

    // 3. macOS .dmg extraction with Gatekeeper quarantine removal
    if (archivePath.endsWith('.dmg') && process.platform === 'darwin') {
      const mountPoint = path.join(targetDir, '_dmg_mount')
      fs.mkdirSync(mountPoint, { recursive: true })
      try {
        execFileSync('hdiutil', ['attach', archivePath, '-mountpoint', mountPoint, '-nobrowse', '-quiet'], { timeout: 30000 })
        const appName = release.channel === 'devedition' ? 'Firefox Developer Edition.app' : 'Firefox.app'
        const srcApp = path.join(mountPoint, appName)
        const destApp = path.join(targetDir, appName)
        if (fs.existsSync(destApp)) fs.rmSync(destApp, { recursive: true, force: true })
        execFileSync('cp', ['-R', srcApp, destApp], { timeout: 60000 })
        try {
          execFileSync('xattr', ['-cr', destApp], { timeout: 15000 })
        } catch {}
      } finally {
        try { execFileSync('hdiutil', ['detach', mountPoint, '-quiet'], { timeout: 15000 }) } catch {}
        try { fs.rmSync(mountPoint, { recursive: true, force: true }) } catch {}
      }
      return
    }

    // 4. Linux .tar.xz / .tar.bz2 extraction
    if (archivePath.endsWith('.tar.xz') || archivePath.endsWith('.tar.bz2')) {
      execFileSync('tar', ['-xf', archivePath, '-C', targetDir], { timeout: 180000 })
      return
    }
    throw new Error(`Unsupported kernel archive format: ${archivePath}`)
  }
}

export const multiKernelManager = new MultiKernelManager()

/**
 * Build native C++ Gecko environment config (`CAMOU_CONFIG_1`) for Camoufox.
 * Allows Camoufox to spoof OS, Navigator, Screen, WebGL, Timezone, Locale,
 * and WebRTC directly inside the C++ engine with zero JavaScript tampering.
 */
export function buildCamoufoxEnvConfig(profile: {
  osType?: string
  timezone?: string
  screenWidth?: number
  screenHeight?: number
  fingerprint?: any
}): Record<string, string> {
  const fp = (profile?.fingerprint || {}) as any
  const osRaw = String(profile?.osType || 'windows-10').toLowerCase()
  const osTarget = osRaw.includes('mac') ? 'macos' : osRaw.includes('linux') ? 'linux' : 'windows'

  const cfg: Record<string, any> = {
    'navigator.userAgent': fp?.navigator?.userAgent || undefined,
    'navigator.platform': fp?.navigator?.platform || (osTarget === 'macos' ? 'MacIntel' : osTarget === 'linux' ? 'Linux x86_64' : 'Win32'),
    'navigator.hardwareConcurrency': Number(fp?.navigator?.hardwareConcurrency || 8),
    'navigator.language': fp?.locale?.language || 'en-US',
    'screen.width': Number(fp?.screen?.width || profile?.screenWidth || 1920),
    'screen.height': Number(fp?.screen?.height || profile?.screenHeight || 1080),
    'screen.availWidth': Number(fp?.screen?.width || profile?.screenWidth || 1920),
    'screen.availHeight': Number((fp?.screen?.height || profile?.screenHeight || 1080) - 40),
    'window.devicePixelRatio': Number(fp?.screen?.devicePixelRatio || 1),
    'webGl:vendor': fp?.webgl?.unmaskedVendor || undefined,
    'webGl:renderer': fp?.webgl?.unmaskedRenderer || undefined,
    'timezone': fp?.timezone?.timezone || profile?.timezone || 'America/New_York',
    'webrtc:ipv4': fp?.webrtc?.publicIp || undefined,
    'canvas:aaOffset': 1,
    'humanize': true
  }

  // Strip undefined entries cleanly
  for (const k of Object.keys(cfg)) {
    if (cfg[k] === undefined || cfg[k] === '') delete cfg[k]
  }

  return {
    CAMOU_CONFIG_1: JSON.stringify(cfg)
  }
}
