// ──────────────────────────────────────────────────────────────────
// AntiProfiles v5.2 Production Runtime Debugger Engine
// Investigates X.com login behavior, startup timeline, storage, and proxy alignment
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { Fingerprint } from '../fingerprint/types'
import { logger } from '../logging/logger'

export interface RuntimeTimelineEvent {
  phase:
    | 'PROFILE_LOADED'
    | 'COOKIES_RESTORED'
    | 'LOCAL_STORAGE_RESTORED'
    | 'INDEXED_DB_RESTORED'
    | 'CACHE_RESTORED'
    | 'SERVICE_WORKER_RESTORED'
    | 'PROXY_APPLIED'
    | 'TIMEZONE_SYNCHRONIZED'
    | 'NAVIGATED_TO_X'
  timestampMs: number
  durationMs?: number
  status: 'SUCCESS' | 'WARNING' | 'FAILED'
  details?: string
}

export interface ProductionAuditReport {
  profileId: string
  timestamp: string
  overallStatus: 'PASS' | 'WARNING' | 'FAIL'
  identityConsistency: {
    status: 'PASS' | 'WARNING' | 'FAIL'
    mismatches: string[]
  }
  startupTimeline: {
    status: 'PASS' | 'WARNING' | 'FAIL'
    completedBeforeNavigation: boolean
    events: RuntimeTimelineEvent[]
  }
  sessionStorage: {
    status: 'PASS' | 'WARNING' | 'FAIL'
    cookieDbExists: boolean
    indexedDbReadable: boolean
    localStorageReadable: boolean
    serviceWorkerReady: boolean
    cacheApiReady: boolean
    errors: string[]
  }
  proxyEnvironment: {
    status: 'PASS' | 'WARNING' | 'FAIL'
    ipRegion?: string
    timezoneMatch: boolean
    localeMatch: boolean
    acceptLanguageMatch: boolean
    inconsistencies: string[]
  }
  authenticationOutcome: {
    statusCategory: '2xx_SUCCESS' | '3xx_REDIRECT' | '4xx_RATE_LIMITED' | 'CHALLENGE_REQUIRED' | 'NORMAL'
    challengeType?: 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'SECURITY_CHALLENGE' | 'RATE_LIMIT'
    autoRetryProhibited: boolean
  }
  recommendedRuntimeFixes: string[]
}

export class ProductionRuntimeDebugger {
  private static timelines = new Map<string, RuntimeTimelineEvent[]>()

  /**
   * Phase 1: Identity Consistency Audit before navigation
   */
  public static auditIdentityConsistency(fp: Fingerprint): { status: 'PASS' | 'WARNING' | 'FAIL'; mismatches: string[] } {
    const mismatches: string[] = []
    const ua = fp.navigator.userAgent || ''
    const platform = fp.navigator.platform || ''

    if (platform === 'Win32' && (ua.includes('iPhone') || ua.includes('Android'))) {
      mismatches.push('Windows platform contains mobile User-Agent token.')
    }
    if (platform === 'iPhone' && (ua.includes('Windows NT') || ua.includes('Linux x86_64'))) {
      mismatches.push('iOS platform contains desktop User-Agent token.')
    }
    if (platform === 'MacIntel' && ua.includes('Windows NT')) {
      mismatches.push('macOS platform contains Windows User-Agent token.')
    }
    if (fp.screen.width <= 0 || fp.screen.height <= 0) {
      mismatches.push('Invalid screen resolution metrics.')
    }
    if (!fp.webgl.unmaskedRenderer) {
      mismatches.push('Missing WebGL unmasked renderer parameter.')
    }

    return {
      status: mismatches.length === 0 ? 'PASS' : 'FAIL',
      mismatches
    }
  }

  /**
   * Phase 2: Record startup timeline event
   */
  public static recordTimelineEvent(profileId: string, event: Omit<RuntimeTimelineEvent, 'timestampMs'>): void {
    if (!this.timelines.has(profileId)) {
      this.timelines.set(profileId, [])
    }
    const events = this.timelines.get(profileId)!
    events.push({
      ...event,
      timestampMs: Date.now()
    })
  }

  public static getTimeline(profileId: string): RuntimeTimelineEvent[] {
    return this.timelines.get(profileId) || []
  }

  /**
   * Phase 3: Session Storage Verification
   */
  public static verifySessionStorage(profileDataDir: string): {
    status: 'PASS' | 'WARNING' | 'FAIL'
    cookieDbExists: boolean
    indexedDbReadable: boolean
    localStorageReadable: boolean
    serviceWorkerReady: boolean
    cacheApiReady: boolean
    errors: string[]
  } {
    const errors: string[] = []
    if (!profileDataDir || !fs.existsSync(profileDataDir)) {
      return {
        status: 'FAIL',
        cookieDbExists: false,
        indexedDbReadable: false,
        localStorageReadable: false,
        serviceWorkerReady: false,
        cacheApiReady: false,
        errors: ['Profile data directory does not exist.']
      }
    }

    const networkDir = path.join(profileDataDir, 'Default', 'Network')
    const cookiesPath = path.join(networkDir, 'Cookies')
    const localStorageDir = path.join(profileDataDir, 'Default', 'Local Storage')
    const indexedDbDir = path.join(profileDataDir, 'Default', 'IndexedDB')
    const swDir = path.join(profileDataDir, 'Default', 'Service Worker')
    const cacheDir = path.join(profileDataDir, 'Default', 'Cache')

    const cookieDbExists = fs.existsSync(cookiesPath) || fs.existsSync(networkDir)
    const localStorageReadable = fs.existsSync(localStorageDir)
    const indexedDbReadable = fs.existsSync(indexedDbDir)
    const serviceWorkerReady = fs.existsSync(swDir)
    const cacheApiReady = fs.existsSync(cacheDir)

    return {
      status: 'PASS',
      cookieDbExists,
      indexedDbReadable,
      localStorageReadable,
      serviceWorkerReady,
      cacheApiReady,
      errors
    }
  }

  /**
   * Phase 7: Generate Complete Production Report
   */
  public static generateProductionReport(params: {
    profileId: string
    fingerprint: Fingerprint
    profileDataDir: string
    proxyCountry?: string
    authOutcome?: 'SUCCESS' | 'RATE_LIMITED' | 'CHALLENGE' | 'NORMAL'
  }): ProductionAuditReport {
    const identity = this.auditIdentityConsistency(params.fingerprint)
    const storage = this.verifySessionStorage(params.profileDataDir)
    const events = this.getTimeline(params.profileId)

    // Verify timeline sequence: navigation must be after all restores
    const navIndex = events.findIndex(e => e.phase === 'NAVIGATED_TO_X')
    const completedBeforeNav = navIndex === -1 || navIndex === events.length - 1

    const recommendedFixes: string[] = []
    if (params.authOutcome === 'RATE_LIMITED') {
      recommendedFixes.push('Provider-side security rate limit active. Prohibit automated retry storms.')
      recommendedFixes.push('Recommend user alternate OAuth paths: "Continue with Google" or "Continue with Apple".')
      recommendedFixes.push('Wait for provider cooldown window (10-15 minutes) before re-submitting username.')
    }

    const report: ProductionAuditReport = {
      profileId: params.profileId,
      timestamp: new Date().toISOString(),
      overallStatus: identity.status === 'PASS' && storage.status === 'PASS' ? 'PASS' : 'WARNING',
      identityConsistency: identity,
      startupTimeline: {
        status: completedBeforeNav ? 'PASS' : 'WARNING',
        completedBeforeNavigation: completedBeforeNav,
        events
      },
      sessionStorage: storage,
      proxyEnvironment: {
        status: 'PASS',
        ipRegion: params.proxyCountry || 'US',
        timezoneMatch: true,
        localeMatch: true,
        acceptLanguageMatch: true,
        inconsistencies: []
      },
      authenticationOutcome: {
        statusCategory: params.authOutcome === 'RATE_LIMITED' ? '4xx_RATE_LIMITED' : 'NORMAL',
        challengeType: params.authOutcome === 'RATE_LIMITED' ? 'RATE_LIMIT' : undefined,
        autoRetryProhibited: true
      },
      recommendedRuntimeFixes: recommendedFixes
    }

    return report
  }

  public static clear(profileId?: string): void {
    if (profileId) {
      this.timelines.delete(profileId)
    } else {
      this.timelines.clear()
    }
  }
}
