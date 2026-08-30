// ──────────────────────────────────────────────
// AntiProfiles — Chromium Version Manager
// ──────────────────────────────────────────────

import { execSync } from 'child_process'
import fs from 'fs'
import { logger } from '../logging/logger'
import { getChromiumVersion } from './chromium-resolver'

export interface ChromiumVersionInfo {
  version: string
  major: number
  isStable: boolean
  isSupported: boolean
  executablePath: string
  engine: 'Chromium' | 'Google Chrome' | 'Brave' | 'Edge' | 'Custom'
}

export class ChromiumVersionManager {
  private static readonly MIN_SUPPORTED_MAJOR = 110
  private static readonly RECOMMENDED_STABLE_MAJOR = 128

  /**
   * Verify and analyze the Chromium binary version.
   */
  public static async analyzeBinary(executablePath: string): Promise<ChromiumVersionInfo> {
    if (!executablePath || !fs.existsSync(executablePath)) {
      return {
        version: '0.0.0.0',
        major: 0,
        isStable: false,
        isSupported: false,
        executablePath: '',
        engine: 'Custom'
      }
    }

    let versionStr = 'Unknown'
    try {
      versionStr = await getChromiumVersion(executablePath)
    } catch {
      try {
        const raw = execSync(`"${executablePath}" --version`, { encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
        const match = raw.match(/[\d.]+/)
        if (match) versionStr = match[0]
      } catch {}
    }

    const majorMatch = versionStr.match(/^(\d+)/)
    const major = majorMatch ? parseInt(majorMatch[1], 10) : 0
    const isSupported = major >= this.MIN_SUPPORTED_MAJOR

    const lowerPath = executablePath.toLowerCase()
    let engine: ChromiumVersionInfo['engine'] = 'Chromium'
    if (lowerPath.includes('chrome')) engine = 'Google Chrome'
    else if (lowerPath.includes('brave')) engine = 'Brave'
    else if (lowerPath.includes('edge') || lowerPath.includes('msedge')) engine = 'Edge'

    return {
      version: versionStr,
      major,
      isStable: major >= this.RECOMMENDED_STABLE_MAJOR,
      isSupported,
      executablePath,
      engine
    }
  }

  /**
   * Ensure consistent Chromium major version across all running profiles.
   */
  public static validateVersionCompatibility(detectedMajor: number, profileMajorConfig?: number): { compatible: boolean; warning?: string } {
    if (detectedMajor < this.MIN_SUPPORTED_MAJOR) {
      return {
        compatible: false,
        warning: `Detected Chromium major version ${detectedMajor} is below minimum supported baseline (${this.MIN_SUPPORTED_MAJOR}).`
      }
    }

    if (profileMajorConfig && Math.abs(detectedMajor - profileMajorConfig) > 6) {
      return {
        compatible: true,
        warning: `Profile was created for Chromium v${profileMajorConfig}, but runtime is v${detectedMajor}. Minor User-Agent adjustments may apply.`
      }
    }

    return { compatible: true }
  }
}
