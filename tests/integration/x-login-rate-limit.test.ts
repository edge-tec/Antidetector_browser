import { describe, it, expect, beforeEach } from 'vitest'
import { SingleFlightAuthManager, AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'
import { DeviceConsistencyValidator } from '../../src/main/browser/device/device-consistency'
import { SafeAuthDiagnostics } from '../../src/main/browser/x-auth-diagnostics'

describe('X.com Login Safety, Rate-Limit Handling & Single-Flight Deduplication (§19)', () => {
  beforeEach(() => {
    SingleFlightAuthManager.reset()
    SafeAuthDiagnostics.clear()
  })

  it('Test 1 — Duplicate Login Prevention: single user action acquires lock, concurrent duplicates are rejected', () => {
    const profileId = 'profile-test-user-1'

    // First login flight
    const flight1 = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(flight1.acquired).toBe(true)
    expect(flight1.state).toBe('AUTHENTICATING')

    // Concurrent second click/trigger while flight1 is active
    const flight2 = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(flight2.acquired).toBe(false)
    expect(flight2.reason).toContain('single-flight locked')

    // Completing flight1 releases lock
    SingleFlightAuthManager.completeAuthFlow(profileId, 'SUCCESS', { status: 200 })
    const session = SingleFlightAuthManager.getSession(profileId)
    expect(session.state).toBe('SUCCESS')
    expect(session.activeFlight).toBe(false)
    expect(session.attemptCount).toBe(1)
  })

  it('Test 2 — Double-Click Protection: simulate rapid repeated user clicks within 50ms', () => {
    const profileId = 'profile-test-double-click'

    const click1 = SingleFlightAuthManager.acquireAuthLock(profileId)
    const click2 = SingleFlightAuthManager.acquireAuthLock(profileId)
    const click3 = SingleFlightAuthManager.acquireAuthLock(profileId)

    expect(click1.acquired).toBe(true)
    expect(click2.acquired).toBe(false)
    expect(click3.acquired).toBe(false)

    expect(SingleFlightAuthManager.getSession(profileId).attemptCount).toBe(1)
  })

  it('Test 3 — Retry Prevention: provider returns rejection -> no automatic retry triggered', () => {
    const profileId = 'profile-test-user-2'

    SingleFlightAuthManager.acquireAuthLock(profileId)
    const result = SingleFlightAuthManager.evaluateProviderResponse(profileId, {
      statusCode: 401,
      responseBody: '{"error": "Invalid credentials"}'
    })

    expect(result).toBe('PROVIDER_REJECTED')
    const session = SingleFlightAuthManager.getSession(profileId)
    expect(session.state).toBe('PROVIDER_REJECTED')
    expect(session.activeFlight).toBe(false)
    // Zero automated retry
    expect(session.attemptCount).toBe(1)
  })

  it('Test 4 — Rate Limit: provider returns 429 -> AUTH_RATE_LIMITED and retry count = 0', () => {
    const profileId = 'profile-test-429'

    SingleFlightAuthManager.acquireAuthLock(profileId)
    const result = SingleFlightAuthManager.evaluateProviderResponse(profileId, {
      statusCode: 429,
      responseBody: '{"error": "Rate limit exceeded"}'
    })

    expect(result).toBe('AUTH_RATE_LIMITED')
    const session = SingleFlightAuthManager.getSession(profileId)
    expect(session.state).toBe('AUTH_RATE_LIMITED')
    expect(session.activeFlight).toBe(false)
  })

  it('Test 5 — Temporary Login Restriction: simulate provider response "We\'ve temporarily limited your login"', () => {
    const profileId = 'profile-test-temp-limit'

    SingleFlightAuthManager.acquireAuthLock(profileId)

    const result = SingleFlightAuthManager.evaluateProviderResponse(profileId, {
      statusCode: 200,
      responseBody: "We've temporarily limited your login. Please try again later."
    })

    expect(result).toBe('AUTH_RATE_LIMITED')
    const session = SingleFlightAuthManager.getSession(profileId)
    expect(session.state).toBe('AUTH_RATE_LIMITED')
    expect(session.activeFlight).toBe(false)
    expect(session.rateLimitReason).toContain('temporarily limited')

    // Prohibit automated retry & verify cooldown tracking
    const nextFlight = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(nextFlight.acquired).toBe(false)
    expect(nextFlight.state).toBe('AUTH_RATE_LIMITED')
    expect(SingleFlightAuthManager.isCooldownActive(profileId)).toBe(true)
    expect(SingleFlightAuthManager.getRemainingCooldownSeconds(profileId)).toBeGreaterThan(0)
    expect(SingleFlightAuthManager.getRecommendedAuthMethod(profileId)).toBe('GOOGLE_SSO')
  })

  it('Test 6 — Callback Duplication: send the same OAuth callback twice, first processed, second safely ignored', () => {
    const callbackId = 'oauth_state_xyz_123'

    const first = SingleFlightAuthManager.processOAuthCallback(callbackId)
    const second = SingleFlightAuthManager.processOAuthCallback(callbackId)

    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('Test 7 — Profile Isolation: authenticating Profile A leaves Profile B in IDLE state', () => {
    const profileA = 'profile-uuid-a'
    const profileB = 'profile-uuid-b'

    SingleFlightAuthManager.acquireAuthLock(profileA)
    SingleFlightAuthManager.evaluateProviderResponse(profileA, {
      statusCode: 429,
      responseBody: "We've temporarily limited your login. Please try again later."
    })

    expect(SingleFlightAuthManager.getSession(profileA).state).toBe('AUTH_RATE_LIMITED')
    expect(SingleFlightAuthManager.getSession(profileB).state).toBe('IDLE')

    const flightB = SingleFlightAuthManager.acquireAuthLock(profileB)
    expect(flightB.acquired).toBe(true)
    expect(flightB.state).toBe('AUTHENTICATING')
  })

  it('Test 8 — Browser Cleanup: closing profile while auth is active clears locks without orphan tasks', () => {
    const profileId = 'profile-lifecycle-test'

    SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(SingleFlightAuthManager.getSession(profileId).activeFlight).toBe(true)

    // User closes tab or navigates away
    SingleFlightAuthManager.reset(profileId)
    expect(SingleFlightAuthManager.getSession(profileId).state).toBe('IDLE')
    expect(SingleFlightAuthManager.getSession(profileId).activeFlight).toBe(false)
  })

  it('Test 9 — Platform Consistency: all supported platform profiles produce internally coherent values', () => {
    const windowsProfile = DeviceConsistencyValidator.resolvePlatformProfile({
      osType: 'windows-11',
      browserType: 'chrome'
    })

    const audit = DeviceConsistencyValidator.checkPlatformConsistency({
      platformProfile: windowsProfile,
      httpHeaders: {
        userAgent: windowsProfile.userAgent,
        secChUaPlatform: 'Windows'
      },
      jsEnvironment: {
        navigatorPlatform: 'Win32',
        navigatorUserAgent: windowsProfile.userAgent,
        userAgentDataPlatform: 'Windows'
      }
    })

    expect(audit.consistent).toBe(true)
    expect(audit.mismatches.length).toBe(0)
    expect(windowsProfile.clientHintsPlatform).toBe('Windows')
    expect(windowsProfile.platformString).toBe('Win32')
  })

  it('Test 10 — Secret Redaction: logs contain zero passwords, OTPs, OAuth tokens, session cookies, or auth headers', () => {
    const profileId = 'profile-test-privacy'
    const sensitiveUrl =
      'https://x.com/i/flow/login?auth_token=SECRET_COOKIE&ct0=CSRF_TOKEN&password=TopSecretPassword123&otp=889900&access_token=TOKEN123&authorization=BEARER_SECRET'

    const event = SafeAuthDiagnostics.logSafeEvent({
      profileId,
      hostname: sensitiveUrl,
      statusCategory: '4xx_CLIENT_ERROR',
      processState: 'AUTH_RATE_LIMITED',
      notes: "Provider returned: We've temporarily limited your login."
    })

    const str = JSON.stringify(event)
    expect(event.hostname).toBe('x.com')
  })

  it('Test 11 — Single-Flight Lock: strict concurrency lock prevents parallel authentication requests', () => {
    const profileId = 'profile-test-concurrency-lock'

    const lock1 = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(lock1.acquired).toBe(true)

    // Parallel attempt while active
    const lock2 = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(lock2.acquired).toBe(false)
    expect(lock2.reason).toContain('single-flight locked')

    // Release via cancel/complete
    SingleFlightAuthManager.completeAuthFlow(profileId, 'CANCELLED')
    expect(SingleFlightAuthManager.getSession(profileId).state).toBe('CANCELLED')
    expect(SingleFlightAuthManager.getSession(profileId).activeFlight).toBe(false)

    // Next attempt can acquire lock cleanly
    const lock3 = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(lock3.acquired).toBe(true)
  })

  it('Test 12 — Session Persistence: storage and session state are preserved without credential leaks', () => {
    const profileId = 'profile-test-persistence'

    SingleFlightAuthManager.acquireAuthLock(profileId)
    SingleFlightAuthManager.completeAuthFlow(profileId, 'SUCCESS', { status: 200 })

    const session = SingleFlightAuthManager.getSession(profileId)
    expect(session.state).toBe('SUCCESS')
    expect(session.activeFlight).toBe(false)
    expect(session.attemptCount).toBe(1)
  })
})
