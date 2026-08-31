// ──────────────────────────────────────────────────────────────────
// AntiProfiles Browser Runtime v4.0 Enterprise Edition
// Production Specification & Runtime Engine
// Supported Platforms: macOS Intel, macOS Apple Silicon (M1-M4), Windows 10/11, Android, iOS
// Target Browser Engines: Chromium (Blink), WebKit (iOS)
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { Fingerprint, OSType, BrowserType } from '../fingerprint/types'
import { logger } from '../logging/logger'

export type RuntimeEngineType = 'Chromium' | 'WebKit' | 'Gecko'

export interface ProfilePermissionsConfig {
  camera?: 'allow' | 'block' | 'ask'
  microphone?: 'allow' | 'block' | 'ask'
  notifications?: 'allow' | 'block' | 'ask'
  clipboard?: 'allow' | 'block' | 'ask'
  geolocation?: 'allow' | 'block' | 'ask'
}

export interface RuntimeV4Config {
  profileId: string
  osType: OSType
  browserEngine: RuntimeEngineType
  browserVersion: string
  cpuArchitecture: 'x64' | 'arm64' | 'arm'
  hardwareConcurrency: number
  deviceMemory: number
  screenResolution: { width: number; height: number; colorDepth: number; dpr: number }
  storageIsolation: {
    userDataDir: string
    cookiesPersisted: boolean
    indexedDbPersisted: boolean
    localStoragePersisted: boolean
    cachePersisted: boolean
    serviceWorkersPersisted: boolean
  }
  networkSecurity: {
    minTlsVersion: 'TLSv1.2' | 'TLSv1.3'
    preferTls13: boolean
    http2Enabled: boolean
    http3Enabled: boolean
    hstsEnabled: boolean
    alpnEnabled: boolean
    noCertInterception: boolean
  }
  permissions: ProfilePermissionsConfig
}

export class RuntimeV4Manager {
  private static permissionStore: Map<string, ProfilePermissionsConfig> = new Map()

  /**
   * SECTION 2: Validates strict internal consistency of a profile according to its OS family.
   */
  public static validateV4Consistency(profile: {
    osType: OSType
    platform?: string
    userAgent?: string
    browserType?: BrowserType
    hardwareConcurrency?: number
    deviceMemory?: number
    maxTouchPoints?: number
    touchSupport?: boolean
  }): { isValid: boolean; violations: string[] } {
    const violations: string[] = []
    const os = (profile.osType || 'windows-10').toLowerCase()
    const ua = profile.userAgent || ''
    const platform = profile.platform || ''

    if (os.includes('win')) {
      if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('Android')) {
        violations.push('Windows profile contains mobile User-Agent tokens.')
      }
      if (platform === 'iPhone' || platform === 'Linux armv8l' || platform === 'MacIntel') {
        violations.push(`Windows profile contains invalid platform identifier: ${platform}`)
      }
    } else if (os.includes('mac')) {
      if (ua.includes('Windows NT') || ua.includes('Android')) {
        violations.push('macOS profile contains Windows or Android User-Agent tokens.')
      }
      if (platform !== 'MacIntel' && platform !== 'Macintosh') {
        violations.push(`macOS profile contains invalid platform identifier: ${platform}`)
      }
    } else if (os.includes('ios')) {
      if (ua.includes('Windows NT') || ua.includes('Linux x86_64')) {
        violations.push('iOS profile contains Desktop OS User-Agent tokens.')
      }
      if (platform !== 'iPhone' && platform !== 'iPad') {
        violations.push(`iOS profile contains non-iOS platform identifier: ${platform}`)
      }
      if (profile.touchSupport === false || profile.maxTouchPoints === 0) {
        violations.push('iOS profile must have touch support enabled with at least 1 touch point.')
      }
    } else if (os.includes('android')) {
      if (ua.includes('Windows NT') || ua.includes('Macintosh')) {
        violations.push('Android profile contains Desktop OS User-Agent tokens.')
      }
      if (platform !== 'Linux armv8l' && platform !== 'Linux aarch64') {
        violations.push(`Android profile contains non-Android platform identifier: ${platform}`)
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    }
  }

  /**
   * SECTION 9: Permissions Engine - Persists permissions per profile
   */
  public static setProfilePermissions(profileId: string, perms: ProfilePermissionsConfig): void {
    this.permissionStore.set(profileId, perms)
  }

  public static getProfilePermissions(profileId: string): ProfilePermissionsConfig {
    return this.permissionStore.get(profileId) || {
      camera: 'ask',
      microphone: 'ask',
      notifications: 'ask',
      clipboard: 'ask',
      geolocation: 'ask'
    }
  }

  /**
   * SECTION 4 & 5: Verifies storage directory isolation and persistence
   */
  public static verifyStorageIsolation(profileId: string, dataDir: string): boolean {
    if (!dataDir || !fs.existsSync(dataDir)) return false
    const normalized = path.resolve(dataDir)
    return normalized.includes(profileId)
  }

  /**
   * SECTION 15 & 16: Privacy & Sanitization Engine - Strips all secrets
   */
  public static sanitizeDiagnosticLog(rawUrlOrMsg: string): string {
    if (!rawUrlOrMsg || typeof rawUrlOrMsg !== 'string') return ''
    try {
      if (rawUrlOrMsg.startsWith('http://') || rawUrlOrMsg.startsWith('https://')) {
        const url = new URL(rawUrlOrMsg)
        return `${url.protocol}//${url.hostname}${url.pathname}`
      }
    } catch {}
    return rawUrlOrMsg.replace(/(auth_token|session|token|password|secret|key|otp)=[^&]+/gi, '$1=[REDACTED]')
  }
}
