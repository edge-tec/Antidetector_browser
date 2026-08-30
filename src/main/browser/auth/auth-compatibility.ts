/**
 * AntiProfiles v3 — Centralized Authentication Compatibility & Device Profile Safety Engine
 * 
 * Standards-compliant compatibility engine ensuring:
 * 1. Zero-interference on protected authentication domains (Google, X, Microsoft, Apple, etc.)
 * 2. Clean separation between Physical Runtime, Device Presentation, and Persistent Authentication Session
 * 3. Safe OS/Device switching with structured session compatibility checks
 * 4. Transparent reporting of unsupported native mobile capabilities
 * 5. Structured, granular authentication diagnostic states
 */

export const AUTH_PROTECTED_ORIGINS = [
  'x.com',
  'twitter.com',
  'api.x.com',
  'accounts.google.com',
  'myaccount.google.com',
  'mail.google.com',
  'oauth2.googleapis.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'github.com',
  'appleid.apple.com',
  'login.microsoftonline.com',
  'account.microsoft.com',
  'amazon.com',
  'discord.com'
] as const

export type AuthStatusCategory =
  | 'AUTH_SUCCESS'
  | 'AUTH_CHALLENGE'
  | 'AUTH_REAUTH_REQUIRED'
  | 'SERVER_RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'PROXY_ERROR'
  | 'RUNTIME_INCOMPATIBILITY'
  | 'STORAGE_ERROR'
  | 'WEBAUTHN_UNAVAILABLE'
  | 'UNKNOWN_AUTH_ERROR'

export type CompatibilityRating =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_REAUTH'
  | 'INCOMPATIBLE_RUNTIME'

export interface CompatibilityReport {
  rating: CompatibilityRating
  source: string
  target: string
  preservesStorage: boolean
  requiresReauth: boolean
  unsupportedCapabilities: string[]
  reason: string
}

export class AuthCompatibilityEngine {
  /**
   * Deterministically verifies whether a URL or Host is a protected authentication origin.
   * Protects against look-alike / phishing subdomains (e.g. fake-x.com, x.com.attacker.com).
   */
  public static isProtectedAuthOrigin(rawUrlOrHost: string): boolean {
    if (!rawUrlOrHost || typeof rawUrlOrHost !== 'string') {
      return false
    }

    try {
      let host = ''
      let path = ''

      if (rawUrlOrHost.startsWith('http://') || rawUrlOrHost.startsWith('https://')) {
        const parsed = new URL(rawUrlOrHost)
        host = parsed.hostname.toLowerCase()
        path = parsed.pathname.toLowerCase()
      } else {
        const parts = rawUrlOrHost.toLowerCase().split('/')
        host = parts[0].split(':')[0]
        path = parts.slice(1).join('/')
      }

      // Check against protected origin root and strict subdomains
      for (const origin of AUTH_PROTECTED_ORIGINS) {
        if (host === origin || host.endsWith('.' + origin)) {
          return true
        }
      }

      // Standard identity / auth paths on trusted host categories
      const isTrustedHost = (
        host === 'google.com' || host.endsWith('.google.com') ||
        host === 'apple.com' || host.endsWith('.apple.com') ||
        host === 'microsoft.com' || host.endsWith('.microsoft.com')
      )

      if (isTrustedHost) {
        if (
          path.includes('/login') ||
          path.includes('/signin') ||
          path.includes('/oauth') ||
          path.includes('/i/flow/') ||
          path.includes('/v3/signin') ||
          path.includes('/servicelogin') ||
          path.includes('/challenge') ||
          path.includes('/identifier')
        ) {
          return true
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Evaluates compatibility when switching between OS and Device profiles.
   * Ensures storage is preserved and reports any required reauth or unsupported capabilities.
   */
  public static checkCompatibility(
    sourceOs: string,
    targetOs: string,
    sourceDeviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    targetDeviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
  ): CompatibilityReport {
    const sOs = (sourceOs || 'macOS').toLowerCase()
    const tOs = (targetOs || 'macOS').toLowerCase()
    const unsupported: string[] = []

    const isTargetMobile = targetDeviceType === 'mobile' || tOs.includes('ios') || tOs.includes('android')
    const isSourceMobile = sourceDeviceType === 'mobile' || sOs.includes('ios') || sOs.includes('android')

    if (tOs.includes('ios')) {
      unsupported.push('Native iOS WebKit Engine (Running on Chromium Runtime)')
      unsupported.push('Apple Secure Enclave Hardware Passkey Attestation')
      unsupported.push('iOS System Keychain Direct Sync')
    }

    if (tOs.includes('android')) {
      unsupported.push('Native Android SafetyNet/Play Integrity Hardware API')
      unsupported.push('Android Google Play Services FIDO2 Authenticator')
    }

    // Identical OS and device type
    if (sOs === tOs && sourceDeviceType === targetDeviceType) {
      return {
        rating: 'COMPATIBLE',
        source: `${sourceOs} (${sourceDeviceType})`,
        target: `${targetOs} (${targetDeviceType})`,
        preservesStorage: true,
        requiresReauth: false,
        unsupportedCapabilities: unsupported,
        reason: 'Identical platform and presentation profile. Storage and sessions 100% preserved.'
      }
    }

    // Desktop to Desktop OS switch (e.g. macOS <-> Windows 11 <-> Linux)
    if (!isSourceMobile && !isTargetMobile) {
      return {
        rating: 'COMPATIBLE',
        source: `${sourceOs} (${sourceDeviceType})`,
        target: `${targetOs} (${targetDeviceType})`,
        preservesStorage: true,
        requiresReauth: false,
        unsupportedCapabilities: [],
        reason: 'Desktop-to-desktop presentation update. Storage databases, cookies, and tokens preserved.'
      }
    }

    // Desktop to Mobile / Mobile to Desktop transition
    // Websites may challenge or require reauth on device profile transition (e.g., mobile web vs desktop web)
    return {
      rating: 'COMPATIBLE_WITH_REAUTH',
      source: `${sourceOs} (${sourceDeviceType})`,
      target: `${targetOs} (${targetDeviceType})`,
      preservesStorage: true,
      requiresReauth: true,
      unsupportedCapabilities: unsupported,
      reason: 'Device presentation changed between desktop and mobile. Storage is retained, but the website may issue a standard authentication challenge.'
    }
  }

  /**
   * Validates internal consistency of device metrics to prevent anomalous fingerprint combinations.
   */
  public static validateDeviceProfileMetrics(profile: {
    osType: string
    deviceType?: string
    userAgent?: string
    touchSupport?: boolean
    maxTouchPoints?: number
    hardwareConcurrency?: number
  }): { isValid: boolean; anomalies: string[] } {
    const anomalies: string[] = []
    const os = (profile.osType || '').toLowerCase()
    const isMobile = profile.deviceType === 'mobile' || os.includes('ios') || os.includes('android')

    if (isMobile) {
      if (profile.maxTouchPoints === 0 && profile.touchSupport === false) {
        anomalies.push('Mobile device profile has 0 touch points configured.')
      }
    } else {
      if (os.includes('macos') && profile.maxTouchPoints && profile.maxTouchPoints > 5) {
        anomalies.push('Standard macOS desktop profile configured with high touch point count.')
      }
    }

    return {
      isValid: anomalies.length === 0,
      anomalies
    }
  }
}
