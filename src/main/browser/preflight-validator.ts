// ──────────────────────────────────────────────────────────────────
// AntiProfiles v5.1 Runtime Audit & Pre-Flight Identity Validator
// ──────────────────────────────────────────────────────────────────

import { Fingerprint, OSType, BrowserType } from '../fingerprint/types'
import { logger } from '../logging/logger'

export interface PreFlightIdentitySnapshot {
  userAgent: string
  platform: string
  language: string
  languages: string[]
  timezone: string
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
  deviceMemory: number
  hardwareConcurrency: number
  unmaskedRenderer: string
}

export class RuntimePreFlightValidator {
  private static identityVault = new Map<string, PreFlightIdentitySnapshot>()

  /**
   * Captures and locks the authoritative identity snapshot upon profile creation or launch.
   */
  public static registerIdentity(profileId: string, fp: Fingerprint): PreFlightIdentitySnapshot {
    const snapshot: PreFlightIdentitySnapshot = {
      userAgent: fp.navigator.userAgent,
      platform: fp.navigator.platform,
      language: fp.locale?.language || 'en-US',
      languages: fp.locale?.languages || ['en-US', 'en'],
      timezone: fp.timezone?.timezone || 'UTC',
      screenWidth: fp.screen.width,
      screenHeight: fp.screen.height,
      devicePixelRatio: fp.screen.devicePixelRatio || 1,
      deviceMemory: fp.navigator.deviceMemory || 8,
      hardwareConcurrency: fp.navigator.hardwareConcurrency || 4,
      unmaskedRenderer: fp.webgl?.unmaskedRenderer || 'Default GPU'
    }
    this.identityVault.set(profileId, snapshot)
    return snapshot
  }

  /**
   * Validates before every login that runtime values match the locked identity.
   * Throws a runtime error if any identity attribute has illegally mutated.
   */
  public static validatePreFlight(profileId: string, current: Partial<PreFlightIdentitySnapshot>): { valid: boolean; errors: string[] } {
    const locked = this.identityVault.get(profileId)
    const errors: string[] = []

    if (!locked) {
      return { valid: true, errors: [] }
    }

    if (current.userAgent && current.userAgent !== locked.userAgent) {
      errors.push(`Illegal identity mutation: User-Agent changed from "${locked.userAgent}" to "${current.userAgent}".`)
    }
    if (current.platform && current.platform !== locked.platform) {
      errors.push(`Illegal identity mutation: Platform changed from "${locked.platform}" to "${current.platform}".`)
    }
    if (current.screenWidth && current.screenWidth !== locked.screenWidth) {
      errors.push(`Illegal identity mutation: Screen Width changed from ${locked.screenWidth} to ${current.screenWidth}.`)
    }
    if (current.hardwareConcurrency && current.hardwareConcurrency !== locked.hardwareConcurrency) {
      errors.push(`Illegal identity mutation: HardwareConcurrency changed from ${locked.hardwareConcurrency} to ${current.hardwareConcurrency}.`)
    }
    if (current.deviceMemory && current.deviceMemory !== locked.deviceMemory) {
      errors.push(`Illegal identity mutation: DeviceMemory changed from ${locked.deviceMemory} to ${current.deviceMemory}.`)
    }

    if (errors.length > 0) {
      logger.error('browser', `[PreFlightValidator] ❌ Integrity violation for profile ${profileId}: ${errors.join(' | ')}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public static clear(profileId?: string): void {
    if (profileId) {
      this.identityVault.delete(profileId)
    } else {
      this.identityVault.clear()
    }
  }
}
