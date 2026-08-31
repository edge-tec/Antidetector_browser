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
        host === 'x.com' || host.endsWith('.x.com') ||
        host === 'twitter.com' || host.endsWith('.twitter.com') ||
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
          path.includes('/i/flow/login') ||
          path.includes('/i/flow/signup') ||
          path.includes('/account/access') ||
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

/**
 * Deterministic Authentication State Machine
 */
export type AuthFlowState =
  | 'IDLE'
  | 'AUTHENTICATING'
  | 'SUCCESS'
  | 'PROVIDER_REJECTED'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_PROVIDER_INCOMPATIBLE'
  | 'REAUTH_REQUIRED'
  | 'NETWORK_ERROR'
  | 'CANCELLED'

export interface AuthSessionState {
  profileId: string
  state: AuthFlowState
  activeFlight: boolean
  attemptCount: number
  lastAttemptTimestamp: number
  rateLimitReason?: string
  guidanceMessage?: string
  cooldownExpiresAt?: number
  lastProviderStatus?: number | string
}

/**
 * Single-Flight Authentication Manager
 * Guarantees:
 * 1. Single-flight authentication (deduplication of rapid/duplicate login submissions)
 * 2. Strict no-automatic-retry policy on provider rate limits or rejections
 * 3. Smart cooldown management and countdown calculation
 * 4. Deterministic state transitions (IDLE -> AUTHENTICATING -> SUCCESS | RATE_LIMITED | INCOMPATIBLE | REJECTED)
 * 5. Zero credential/token harvesting
 */
export class SingleFlightAuthManager {
  private static sessions: Map<string, AuthSessionState> = new Map()
  private static processedOAuthCallbacks: Set<string> = new Set()

  public static processOAuthCallback(callbackId: string): boolean {
    if (this.processedOAuthCallbacks.has(callbackId)) {
      return false // Duplicate callback safely ignored
    }
    this.processedOAuthCallbacks.add(callbackId)
    return true
  }

  public static getSession(profileId: string): AuthSessionState {
    if (!this.sessions.has(profileId)) {
      this.sessions.set(profileId, {
        profileId,
        state: 'IDLE',
        activeFlight: false,
        attemptCount: 0,
        lastAttemptTimestamp: 0
      })
    }
    const session = this.sessions.get(profileId)!
    // Auto-clear cooldown if expiration timestamp has passed
    if (session.state === 'AUTH_RATE_LIMITED' && session.cooldownExpiresAt && Date.now() >= session.cooldownExpiresAt) {
      session.state = 'IDLE'
      session.cooldownExpiresAt = undefined
      session.rateLimitReason = undefined
    }
    return session
  }

  public static isCooldownActive(profileId: string): boolean {
    const session = this.getSession(profileId)
    return session.state === 'AUTH_RATE_LIMITED' && !!session.cooldownExpiresAt && Date.now() < session.cooldownExpiresAt
  }

  public static getRemainingCooldownSeconds(profileId: string): number {
    const session = this.getSession(profileId)
    if (!session.cooldownExpiresAt || Date.now() >= session.cooldownExpiresAt) return 0
    return Math.max(0, Math.ceil((session.cooldownExpiresAt - Date.now()) / 1000))
  }

  public static getRecommendedAuthMethod(profileId: string): 'GOOGLE_SSO' | 'EMAIL' | 'PHONE' | 'USERNAME' {
    const session = this.getSession(profileId)
    if (session.state === 'AUTH_RATE_LIMITED') {
      return 'GOOGLE_SSO' // Switch priority to SSO or alternate credential
    }
    return 'USERNAME'
  }

  /**
   * Attempts to acquire an exclusive single-flight lock for authentication.
   * Returns true if lock acquired, false if a flight is already in progress or if rate-limited.
   */
  public static acquireAuthLock(profileId: string): { acquired: boolean; state: AuthFlowState; reason?: string } {
    const session = this.getSession(profileId)

    if (session.activeFlight) {
      return {
        acquired: false,
        state: session.state,
        reason: 'Authentication flow already active (single-flight locked).'
      }
    }

    if (session.state === 'AUTH_RATE_LIMITED') {
      const remaining = this.getRemainingCooldownSeconds(profileId)
      const min = Math.floor(remaining / 60)
      const sec = remaining % 60
      const timeStr = remaining > 0 ? ` (Remaining Cooldown: ${min}m ${sec}s)` : ''
      return {
        acquired: false,
        state: 'AUTH_RATE_LIMITED',
        reason: `Authentication is temporarily limited by provider.${timeStr} Automated retries are prohibited.`
      }
    }

    if (session.state === 'AUTH_PROVIDER_INCOMPATIBLE') {
      return {
        acquired: false,
        state: 'AUTH_PROVIDER_INCOMPATIBLE',
        reason: session.guidanceMessage || 'Provider presentation is incompatible in current desktop runtime.'
      }
    }

    session.activeFlight = true
    session.state = 'AUTHENTICATING'
    session.attemptCount += 1
    session.lastAttemptTimestamp = Date.now()

    return {
      acquired: true,
      state: 'AUTHENTICATING'
    }
  }

  /**
   * Releases the active authentication lock and transitions to the final state.
   * Prohibits automatic retry triggering.
   */
  public static completeAuthFlow(
    profileId: string,
    resultState: AuthFlowState,
    details?: { status?: number | string; reason?: string; guidance?: string; cooldownDurationMs?: number }
  ): AuthSessionState {
    const session = this.getSession(profileId)
    session.activeFlight = false
    session.state = resultState
    if (details?.status !== undefined) session.lastProviderStatus = details.status
    if (details?.reason !== undefined) session.rateLimitReason = details.reason
    if (details?.guidance !== undefined) session.guidanceMessage = details.guidance
    if (resultState === 'AUTH_RATE_LIMITED') {
      const duration = details?.cooldownDurationMs || 15 * 60 * 1000 // Default 15-minute cooldown
      session.cooldownExpiresAt = Date.now() + duration
    } else {
      session.cooldownExpiresAt = undefined
    }
    return session
  }

  /**
   * Evaluates server-side response body/status and maps to standard state without retrying.
   */
  public static evaluateProviderResponse(
    profileId: string,
    response: { statusCode?: number; responseBody?: string; url?: string }
  ): AuthFlowState {
    const body = (response.responseBody || '').toLowerCase()
    const url = (response.url || '').toLowerCase()
    const status = response.statusCode || 200

    // 1. Google "This browser or app may not be secure" (support.google.com/accounts/answer/7675428)
    if (
      url.includes('signin/rejected') ||
      body.includes('may not be secure') ||
      body.includes("couldn't sign you in") ||
      (body.includes('different browser') && body.includes('supported browser'))
    ) {
      this.completeAuthFlow(profileId, 'AUTH_PROVIDER_INCOMPATIBLE', {
        status,
        reason: "Google rejected embedded browser authentication (Google Security Policy: Sign in with a supported browser).",
        guidance: "Continue securely with Safari authentication."
      })
      return 'AUTH_PROVIDER_INCOMPATIBLE'
    }

    // 2. X.com "We've temporarily limited your login" / 429 Rate Limit
    if (
      status === 429 ||
      body.includes('temporarily limited') ||
      body.includes('try again later') ||
      body.includes('rate limit') ||
      body.includes('too many requests')
    ) {
      this.completeAuthFlow(profileId, 'AUTH_RATE_LIMITED', {
        status,
        reason: "X.com has temporarily limited this login attempt (provider-side security cooldown).",
        guidance: "X.com temporarily restricted this login attempt. AntiProfiles has stopped automated retries. Please wait until the provider cooldown expires."
      })
      return 'AUTH_RATE_LIMITED'
    }

    if (status === 401 || status === 403 || body.includes('incorrect password') || body.includes('invalid credentials')) {
      this.completeAuthFlow(profileId, 'PROVIDER_REJECTED', { status })
      return 'PROVIDER_REJECTED'
    }

    if (status >= 200 && status < 300) {
      this.completeAuthFlow(profileId, 'SUCCESS', { status })
      return 'SUCCESS'
    }

    this.completeAuthFlow(profileId, 'REAUTH_REQUIRED', { status })
    return 'REAUTH_REQUIRED'
  }

  /**
   * Resets session state upon manual user action or explicit navigation away.
   */
  public static reset(profileId?: string): void {
    if (profileId) {
      this.sessions.delete(profileId)
    } else {
      this.sessions.clear()
    }
  }
}

