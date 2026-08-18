// ──────────────────────────────────────────────
// AntiProfiles — Cross-Platform Chromium Resolver & Diagnostics
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { logger } from '../logging/logger'

export interface BrowserInfo {
  name: string
  engine: string
  path: string
  version: string
  isDefault?: boolean
}

export interface BrowserTestResult {
  valid: boolean
  exists: boolean
  isExecutable: boolean
  version: string
  engine: string
  path: string
  error?: string
}

export interface BrowserDiagnosticResult {
  engine: { status: 'pass' | 'fail' | 'warn'; detail: string }
  executablePath: { status: 'pass' | 'fail' | 'warn'; path: string; detail: string }
  executableExists: { status: 'pass' | 'fail' | 'warn'; detail: string }
  versionDetection: { status: 'pass' | 'fail' | 'warn'; version: string; detail: string }
  profileDirectory: { status: 'pass' | 'fail' | 'warn'; path: string; detail: string }
  processLaunch: { status: 'pass' | 'fail' | 'warn'; detail: string }
}

const COMMON_CHROME_PATHS_MAC = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  path.join(process.env.HOME || '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  path.join(process.env.HOME || '', 'Applications/Chromium.app/Contents/MacOS/Chromium')
]

const COMMON_FIREFOX_PATHS_MAC = [
  '/Applications/Firefox.app/Contents/MacOS/firefox',
  '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
  '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
  '/Applications/Firefox ESR.app/Contents/MacOS/firefox',
  path.join(process.env.HOME || '', 'Applications/Firefox.app/Contents/MacOS/firefox'),
  path.join(process.env.HOME || '', 'Applications/Firefox Developer Edition.app/Contents/MacOS/firefox')
]

const COMMON_CHROME_PATHS_LINUX = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/bin/brave-browser',
  '/usr/bin/microsoft-edge-stable',
  '/usr/bin/microsoft-edge'
]

const COMMON_FIREFOX_PATHS_LINUX = [
  '/usr/bin/firefox',
  '/usr/bin/firefox-esr',
  '/usr/bin/firefox-developer-edition',
  '/usr/bin/firefox-trunk',
  '/usr/local/bin/firefox',
  '/snap/bin/firefox',
  '/var/lib/flatpak/exports/bin/org.mozilla.firefox'
]

function getWindowsCandidatePaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA || ''
  const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
  const programW6432 = process.env.ProgramW6432 || ''
  const systemDrive = process.env.SystemDrive || 'C:'

  const candidates: string[] = []

  // 1. Google Chrome (Standard & User installs)
  if (localAppData) candidates.push(path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  if (programFiles) candidates.push(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  if (programFilesX86) candidates.push(path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  if (programW6432) candidates.push(path.join(programW6432, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  candidates.push(`${systemDrive}\\Program Files\\Google\\Chrome\\Application\\chrome.exe`)
  candidates.push(`${systemDrive}\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`)

  // 2. Chromium
  if (localAppData) candidates.push(path.join(localAppData, 'Chromium', 'Application', 'chrome.exe'))
  if (programFiles) candidates.push(path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'))
  if (programFilesX86) candidates.push(path.join(programFilesX86, 'Chromium', 'Application', 'chrome.exe'))

  // 3. Chrome Canary / SxS
  if (localAppData) candidates.push(path.join(localAppData, 'Google', 'Chrome SxS', 'Application', 'chrome.exe'))

  // 4. Microsoft Edge (Chromium engine)
  if (programFiles) candidates.push(path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  if (programFilesX86) candidates.push(path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  if (localAppData) candidates.push(path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))

  // 5. Brave Browser (Chromium engine)
  if (programFiles) candidates.push(path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'))
  if (programFilesX86) candidates.push(path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'))
  if (localAppData) candidates.push(path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'))

  return Array.from(new Set(candidates.filter(Boolean)))
}

function getWindowsFirefoxCandidatePaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA || ''
  const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
  const programW6432 = process.env.ProgramW6432 || ''
  const systemDrive = process.env.SystemDrive || 'C:'

  const candidates: string[] = []

  if (programFiles) candidates.push(path.join(programFiles, 'Mozilla Firefox', 'firefox.exe'))
  if (programFilesX86) candidates.push(path.join(programFilesX86, 'Mozilla Firefox', 'firefox.exe'))
  if (programW6432) candidates.push(path.join(programW6432, 'Mozilla Firefox', 'firefox.exe'))
  if (localAppData) candidates.push(path.join(localAppData, 'Mozilla Firefox', 'firefox.exe'))
  if (localAppData) candidates.push(path.join(localAppData, 'Programs', 'Mozilla Firefox', 'firefox.exe'))
  candidates.push(`${systemDrive}\\Program Files\\Mozilla Firefox\\firefox.exe`)
  candidates.push(`${systemDrive}\\Program Files (x86)\\Mozilla Firefox\\firefox.exe`)

  return Array.from(new Set(candidates.filter(Boolean)))
}

function queryWindowsRegistry(regCmd: string): string | null {
  try {
    const output = execSync(regCmd, { encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
    const match = output.match(/REG_SZ\s+([^\r\n]+)/i)
    if (match && match[1]) {
      let cleaned = match[1].trim()
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1)
      }
      if (fs.existsSync(cleaned)) return cleaned
    }
  } catch {}
  return null
}

/**
 * Find a usable Mozilla Firefox binary on the system (Windows, macOS, Linux).
 */
export async function findFirefoxPath(customPath?: string): Promise<string | null> {
  // 1. Custom path
  if (customPath && customPath.trim().length > 0) {
    const cleaned = customPath.trim().replace(/^"|"$/g, '')
    if (fs.existsSync(cleaned)) {
      logger.info('browser', `[BrowserDetection] Using custom Firefox path: ${cleaned}`)
      return cleaned
    }
    logger.warn('browser', `[BrowserDetection] Custom Firefox path not found: ${cleaned}`)
  }

  // 2. Check Self-Contained Managed Firefox Runtime (Top Priority)
  const managedFf = getManagedFirefoxExecutable()
  if (managedFf && fs.existsSync(managedFf)) {
    logger.info('browser', `[BrowserDetection] Using standalone Managed Firefox runtime: ${managedFf}`)
    return managedFf
  }

  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  // 2. Windows resolution
  if (isWindows) {
    logger.info('browser', '[BrowserDetection] Scanning Windows Firefox installation paths...')
    for (const candidate of getWindowsFirefoxCandidatePaths()) {
      if (fs.existsSync(candidate)) {
        logger.info('browser', `[BrowserDetection] Found Firefox executable at: ${candidate}`)
        return candidate
      }
    }

    const regQueries = [
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\firefox.exe" /ve',
      'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\firefox.exe" /ve',
      'reg query "HKLM\\SOFTWARE\\Clients\\StartMenuInternet\\FIREFOX.EXE\\shell\\open\\command" /ve'
    ]

    for (const q of regQueries) {
      const regPath = queryWindowsRegistry(q)
      if (regPath && fs.existsSync(regPath)) {
        logger.info('browser', `[BrowserDetection] Found Firefox via Registry: ${regPath}`)
        return regPath
      }
    }

    try {
      const whereResult = execSync('where firefox.exe', { encoding: 'utf-8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const lines = whereResult.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        if (fs.existsSync(line)) {
          logger.info('browser', `[BrowserDetection] Found Firefox via where.exe: ${line}`)
          return line
        }
      }
    } catch {}
  }

  // 3. macOS resolution
  if (isMac) {
    logger.info('browser', '[BrowserDetection] Scanning macOS Applications for Firefox...')
    for (const ffPath of COMMON_FIREFOX_PATHS_MAC) {
      if (fs.existsSync(ffPath)) {
        logger.info('browser', `[BrowserDetection] Found Firefox at: ${ffPath}`)
        return ffPath
      }
    }
  }

  // 4. Linux resolution
  if (!isWindows && !isMac) {
    logger.info('browser', '[BrowserDetection] Scanning Linux paths for Firefox...')
    for (const ffPath of COMMON_FIREFOX_PATHS_LINUX) {
      if (fs.existsSync(ffPath)) {
        logger.info('browser', `[BrowserDetection] Found Firefox at: ${ffPath}`)
        return ffPath
      }
    }
  }

  // 5. POSIX which fallback
  if (!isWindows) {
    try {
      const result = execSync('which firefox || which firefox-esr || which firefox-developer-edition', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
      if (result && fs.existsSync(result)) {
        logger.info('browser', `[BrowserDetection] Found Firefox via PATH: ${result}`)
        return result
      }
    } catch {}
  }

  logger.warn('browser', '[BrowserDetection] No Mozilla Firefox binary found on system.')
  return null
}

/**
 * Find executable matching the requested browser type ('chrome' or 'firefox').
 */
export async function findBrowserExecutable(browserType: 'chrome' | 'firefox' = 'chrome', customPath?: string): Promise<string | null> {
  if (browserType === 'firefox') {
    return findFirefoxPath(customPath)
  }
  return findChromiumPath(customPath)
}

import { getManagedChromiumExecutable } from './chromium-downloader'
import { getManagedFirefoxExecutable } from './firefox-downloader'

/**
 * Find a usable Chromium/Chrome binary on the system (Windows, macOS, Linux).
 */
export async function findChromiumPath(customPath?: string): Promise<string | null> {
  // 1. Check custom path from settings
  if (customPath && customPath.trim().length > 0) {
    const cleaned = customPath.trim().replace(/^"|"$/g, '')
    if (fs.existsSync(cleaned)) {
      logger.info('browser', `[BrowserDetection] Using custom Chromium path: ${cleaned}`)
      return cleaned
    }
    logger.warn('browser', `[BrowserDetection] Custom Chromium path not found: ${cleaned}`)
  }

  // 2. Check Self-Contained Managed Chromium Runtime (Top Priority)
  const managedExec = getManagedChromiumExecutable()
  if (managedExec && fs.existsSync(managedExec)) {
    logger.info('browser', `[BrowserDetection] Using standalone Managed Chromium runtime: ${managedExec}`)
    return managedExec
  }

  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  // 2. Windows-Specific Multi-Strategy Resolution
  if (isWindows) {
    logger.info('browser', '[BrowserDetection] Scanning Windows Chrome/Chromium installation paths...')
    const windowsCandidates = getWindowsCandidatePaths()
    for (const candidate of windowsCandidates) {
      if (fs.existsSync(candidate)) {
        logger.info('browser', `[BrowserDetection] Found Chrome executable at: ${candidate}`)
        return candidate
      }
    }

    // Check Windows Registry App Paths
    logger.info('browser', '[BrowserDetection] Checking Windows Registry for Chrome...')
    const regQueries = [
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
      'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
      'reg query "HKLM\\SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command" /ve',
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe" /ve'
    ]

    for (const q of regQueries) {
      const regPath = queryWindowsRegistry(q)
      if (regPath && fs.existsSync(regPath)) {
        logger.info('browser', `[BrowserDetection] Found browser via Registry: ${regPath}`)
        return regPath
      }
    }

    // Try `where.exe` command on Windows
    try {
      const whereResult = execSync('where chrome.exe || where msedge.exe || where brave.exe', {
        encoding: 'utf-8',
        timeout: 4000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
      const lines = whereResult.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        if (fs.existsSync(line)) {
          logger.info('browser', `[BrowserDetection] Found browser via where.exe: ${line}`)
          return line
        }
      }
    } catch {}
  }

  // 3. macOS-Specific Candidate Paths
  if (isMac) {
    logger.info('browser', '[BrowserDetection] Scanning macOS Applications for Chrome/Chromium...')
    for (const chromePath of COMMON_CHROME_PATHS_MAC) {
      if (fs.existsSync(chromePath)) {
        logger.info('browser', `[BrowserDetection] Found Chrome at: ${chromePath}`)
        return chromePath
      }
    }
  }

  // 4. Linux-Specific Candidate Paths
  if (!isWindows && !isMac) {
    logger.info('browser', '[BrowserDetection] Scanning Linux paths for Chrome/Chromium...')
    for (const chromePath of COMMON_CHROME_PATHS_LINUX) {
      if (fs.existsSync(chromePath)) {
        logger.info('browser', `[BrowserDetection] Found Chrome at: ${chromePath}`)
        return chromePath
      }
    }
  }

  // 5. General POSIX `which` command fallback
  if (!isWindows) {
    try {
      const result = execSync('which google-chrome || which google-chrome-stable || which chromium || which chromium-browser || which brave-browser', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
      if (result && fs.existsSync(result)) {
        logger.info('browser', `[BrowserDetection] Found Chrome via PATH: ${result}`)
        return result
      }
    } catch {}
  }

  logger.warn('browser', '[BrowserDetection] No Chrome/Chromium binary found on system.')
  return null
}

/**
 * Detect all installed Chromium & Firefox browsers on the system.
 */
export async function detectAllBrowsers(): Promise<BrowserInfo[]> {
  const found: BrowserInfo[] = []
  const checked = new Set<string>()

  const checkAndAdd = (execPath: string, defaultName?: string) => {
    const cleaned = execPath.trim().replace(/^"|"$/g, '')
    if (!cleaned || checked.has(cleaned.toLowerCase()) || !fs.existsSync(cleaned)) return
    checked.add(cleaned.toLowerCase())

    const lower = cleaned.toLowerCase()
    let name = defaultName || 'Chromium'
    let engine = 'Chromium'

    if (lower.includes('firefox')) {
      if (lower.includes('developer')) name = 'Mozilla Firefox Developer Edition'
      else if (lower.includes('nightly')) name = 'Mozilla Firefox Nightly'
      else if (lower.includes('esr')) name = 'Mozilla Firefox ESR'
      else name = 'Mozilla Firefox'
      engine = 'Gecko / Firefox Quantum'
    } else if (lower.includes('chrome')) {
      name = lower.includes('canary') || lower.includes('sxs') ? 'Google Chrome Canary' : 'Google Chrome'
      engine = 'Google Chrome'
    } else if (lower.includes('msedge') || lower.includes('edge')) {
      name = 'Microsoft Edge'
      engine = 'Microsoft Edge'
    } else if (lower.includes('brave')) {
      name = 'Brave Browser'
      engine = 'Brave'
    }

    try {
      const versionOutput = execSync(`"${cleaned}" --version`, { encoding: 'utf-8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const match = versionOutput.match(/[\d.]+/)
      const version = match ? match[0] : 'Installed'
      found.push({ name, engine, path: cleaned, version })
    } catch {
      found.push({ name, engine, path: cleaned, version: 'Detected' })
    }
  }

  if (process.platform === 'win32') {
    for (const c of getWindowsCandidatePaths()) checkAndAdd(c)
    for (const c of getWindowsFirefoxCandidatePaths()) checkAndAdd(c)
  } else if (process.platform === 'darwin') {
    for (const c of COMMON_CHROME_PATHS_MAC) checkAndAdd(c)
    for (const c of COMMON_FIREFOX_PATHS_MAC) checkAndAdd(c)
  } else {
    for (const c of COMMON_CHROME_PATHS_LINUX) checkAndAdd(c)
    for (const c of COMMON_FIREFOX_PATHS_LINUX) checkAndAdd(c)
  }

  return found
}

/**
 * Test a browser executable path for validity, readability, and launchability.
 */
export async function testBrowserExecutable(executablePath: string): Promise<BrowserTestResult> {
  const cleaned = (executablePath || '').trim().replace(/^"|"$/g, '')

  if (!cleaned) {
    return {
      valid: false,
      exists: false,
      isExecutable: false,
      version: 'None',
      engine: 'Unknown',
      path: '',
      error: 'No browser executable path provided.'
    }
  }

  if (!fs.existsSync(cleaned)) {
    return {
      valid: false,
      exists: false,
      isExecutable: false,
      version: 'None',
      engine: 'Unknown',
      path: cleaned,
      error: `Executable file does not exist at: ${cleaned}`
    }
  }

  try {
    fs.accessSync(cleaned, fs.constants.X_OK || fs.constants.R_OK)
  } catch (err: any) {
    return {
      valid: false,
      exists: true,
      isExecutable: false,
      version: 'None',
      engine: 'Unknown',
      path: cleaned,
      error: `Permission error: file is not executable (${err.message})`
    }
  }

  try {
    const versionOutput = execSync(`"${cleaned}" --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()

    const match = versionOutput.match(/[\d.]+/)
    const version = match ? match[0] : versionOutput || 'Unknown'

    const lower = cleaned.toLowerCase()
    let engine = 'Chromium'
    if (lower.includes('firefox')) engine = 'Gecko / Firefox Quantum'
    else if (lower.includes('chrome')) engine = 'Google Chrome'
    else if (lower.includes('msedge') || lower.includes('edge')) engine = 'Microsoft Edge'
    else if (lower.includes('brave')) engine = 'Brave'

    return {
      valid: true,
      exists: true,
      isExecutable: true,
      version,
      engine,
      path: cleaned
    }
  } catch (err: any) {
    return {
      valid: false,
      exists: true,
      isExecutable: true,
      version: 'Error',
      engine: 'Unknown',
      path: cleaned,
      error: `Failed to query browser version: ${err.message}`
    }
  }
}

/**
 * Run a full 6-layer diagnostic on the browser subsystem.
 */
export async function runBrowserDiagnostics(customPath?: string): Promise<BrowserDiagnosticResult> {
  const currentPath = await findChromiumPath(customPath)

  let engineStatus: 'pass' | 'fail' | 'warn' = 'fail'
  let engineDetail = 'No Chromium engine detected on system.'
  let execExistsStatus: 'pass' | 'fail' | 'warn' = 'fail'
  let execExistsDetail = 'File does not exist.'
  let versionStatus: 'pass' | 'fail' | 'warn' = 'fail'
  let versionString = 'Unknown'
  let versionDetail = 'Could not read version.'
  let processStatus: 'pass' | 'fail' | 'warn' = 'fail'
  let processDetail = 'Cannot test process launch without valid executable.'

  if (currentPath && fs.existsSync(currentPath)) {
    execExistsStatus = 'pass'
    execExistsDetail = `Found at ${currentPath}`

    const testRes = await testBrowserExecutable(currentPath)
    if (testRes.valid) {
      engineStatus = 'pass'
      engineDetail = `${testRes.engine} engine verified.`
      versionStatus = 'pass'
      versionString = testRes.version
      versionDetail = `Version ${testRes.version} responsive.`
      processStatus = 'pass'
      processDetail = 'Process launch execution permission verified.'
    } else {
      engineStatus = 'warn'
      engineDetail = `Executable found but failed test: ${testRes.error}`
      versionDetail = testRes.error || 'Version query failed.'
    }
  }

  let profileDirStatus: 'pass' | 'fail' | 'warn' = 'pass'
  let profileDirPath = ''
  let profileDirDetail = 'Profile directory accessible.'
  try {
    profileDirPath = getProfileDataDir('diagnostic-test')
    ensureProfileDataDir('diagnostic-test')
    deleteProfileDataDir('diagnostic-test')
  } catch (e: any) {
    profileDirStatus = 'fail'
    profileDirDetail = `Cannot write profile data: ${e.message}`
  }

  return {
    engine: { status: engineStatus, detail: engineDetail },
    executablePath: {
      status: currentPath ? 'pass' : 'fail',
      path: currentPath || 'Not configured',
      detail: currentPath ? `Configured path: ${currentPath}` : 'Please use Auto-Detect or Browse to select Chrome.'
    },
    executableExists: { status: execExistsStatus, detail: execExistsDetail },
    versionDetection: { status: versionStatus, version: versionString, detail: versionDetail },
    profileDirectory: { status: profileDirStatus, path: profileDirPath, detail: profileDirDetail },
    processLaunch: { status: processStatus, detail: processDetail }
  }
}

/**
 * Get the Chromium version string from the binary.
 */
export async function getChromiumVersion(executablePath: string): Promise<string> {
  const res = await testBrowserExecutable(executablePath)
  return res.version
}

/**
 * Get the profile data directory for a given profile ID.
 */
export function getProfileDataDir(profileId: string): string {
  let userDataPath: string
  try {
    userDataPath = app.getPath('userData')
  } catch {
    userDataPath = path.join(process.cwd(), 'userData')
  }
  return path.join(userDataPath, 'profiles', profileId, 'browser-data')
}

/**
 * Get the dedicated Firefox profile data directory for a given profile ID.
 */
export function getFirefoxProfileDataDir(profileId: string): string {
  let userDataPath: string
  try {
    userDataPath = app.getPath('userData')
  } catch {
    userDataPath = path.join(process.cwd(), 'userData')
  }
  return path.join(userDataPath, 'profiles', profileId, 'firefox-profile')
}

/**
 * Create the profile data directory if it doesn't exist.
 */
export function ensureProfileDataDir(profileId: string): string {
  const dir = getProfileDataDir(profileId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Create the dedicated Firefox profile data directory if it doesn't exist.
 */
export function ensureFirefoxProfileDataDir(profileId: string): string {
  const dir = getFirefoxProfileDataDir(profileId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Delete the profile data directory.
 */
export function deleteProfileDataDir(profileId: string): void {
  const dir = getProfileDataDir(profileId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  const ffDir = getFirefoxProfileDataDir(profileId)
  if (fs.existsSync(ffDir)) {
    fs.rmSync(ffDir, { recursive: true, force: true })
  }
}

/**
 * Get the size of a profile's browser data directory in bytes.
 */
export function getProfileDataSize(profileId: string): number {
  const dir = getProfileDataDir(profileId)
  if (!fs.existsSync(dir)) return 0

  let totalSize = 0
  function walkDir(dirPath: string): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isFile()) {
          totalSize += fs.statSync(fullPath).size
        } else if (entry.isDirectory()) {
          walkDir(fullPath)
        }
      }
    } catch {
      // Permission errors, etc.
    }
  }
  walkDir(dir)
  return totalSize
}
