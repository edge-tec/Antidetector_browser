// ──────────────────────────────────────────────
// ProfileVault — Chromium Resolver
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { logger } from '../logging/logger'

const COMMON_CHROME_PATHS_MAC = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  path.join(process.env.HOME || '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
]

/**
 * Find a usable Chromium/Chrome binary on the system.
 */
export async function findChromiumPath(customPath?: string): Promise<string | null> {
  // 1. Check custom path from settings
  if (customPath && customPath.trim().length > 0) {
    if (fs.existsSync(customPath)) {
      logger.info('browser', `Using custom Chromium path: ${customPath}`)
      return customPath
    }
    logger.warn('browser', `Custom Chromium path not found: ${customPath}`)
  }

  // 2. Check common macOS installation paths
  for (const chromePath of COMMON_CHROME_PATHS_MAC) {
    if (fs.existsSync(chromePath)) {
      logger.info('browser', `Found Chrome at: ${chromePath}`)
      return chromePath
    }
  }

  // 3. Try `which` command
  try {
    const result = execSync('which google-chrome || which chromium', {
      encoding: 'utf-8',
      timeout: 5000
    }).trim()
    if (result && fs.existsSync(result)) {
      logger.info('browser', `Found Chrome via PATH: ${result}`)
      return result
    }
  } catch {
    // Not found in PATH
  }

  logger.warn('browser', 'No Chrome/Chromium binary found on system')
  return null
}

/**
 * Get the Chromium version string from the binary.
 */
export async function getChromiumVersion(executablePath: string): Promise<string> {
  try {
    const result = execSync(`"${executablePath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000
    }).trim()
    // e.g. "Google Chrome 120.0.6099.109" or "Chromium 120.0.6099.109"
    const match = result.match(/[\d.]+/)
    return match ? match[0] : 'unknown'
  } catch {
    return 'unknown'
  }
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
 * Delete the profile data directory.
 */
export function deleteProfileDataDir(profileId: string): void {
  const dir = getProfileDataDir(profileId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
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
