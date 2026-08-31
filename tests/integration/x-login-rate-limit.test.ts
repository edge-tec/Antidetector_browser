import { describe, it, expect, beforeEach } from 'vitest'
import { SingleFlightAuthManager, AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'
import { DeviceConsistencyValidator } from '../../src/main/browser/device/device-consistency'
import { SafeAuthDiagnostics } from '../../src/main/browser/x-auth-diagnostics'

describe('X.com Login Safety, Rate-Limit Handling & Single-Flight Deduplication (§17)', () => {
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

  it('Test 2 — Retry Prevention: provider rejection transitions to terminal state without auto-retrying', () => {
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
    // No second attempt was triggered automatically
    expect(session.attemptCount).toBe(1)
  })

  it('Test 3 — Rate-Limited State: provider "temporarily limited your login" transitions to AUTH_RATE_LIMITED and blocks automated retries', () => {
    const profileId = 'profile-test-user-3'

    SingleFlightAuthManager.acquireAuthLock(profileId)

    // Simulate X.com rate limit response
    const result = SingleFlightAuthManager.evaluateProviderResponse(profileId, {
      statusCode: 429,
      responseBody: "We've temporarily limited your login. Please try again later."
    })

    expect(result).toBe('AUTH_RATE_LIMITED')
    const session = SingleFlightAuthManager.getSession(profileId)
    expect(session.state).toBe('AUTH_RATE_LIMITED')
    expect(session.activeFlight).toBe(false)
    expect(session.rateLimitReason).toContain('temporarily limited')

    // Attempting another automated login flight is strictly prohibited
    const nextFlight = SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(nextFlight.acquired).toBe(false)
    expect(nextFlight.state).toBe('AUTH_RATE_LIMITED')
    expect(nextFlight.reason).toContain('Automated retries are prohibited')
  })

  it('Test 4 — Credential Privacy: passwords, OTPs, and auth cookies are completely redacted from diagnostic logs', () => {
    const profileId = 'profile-test-privacy'
    const sensitiveUrl =
      'https://x.com/i/flow/login?auth_token=SECRET_COOKIE&ct0=CSRF_TOKEN&password=TopSecretPassword123&otp=889900'

    const event = SafeAuthDiagnostics.logSafeEvent({
      profileId,
      hostname: sensitiveUrl,
      statusCategory: '4xx_CLIENT_ERROR',
      processState: 'AUTH_RATE_LIMITED',
      notes: "Provider returned: We've temporarily limited your login."
    })

    const str = JSON.stringify(event)
    expect(str).not.toContain('SECRET_COOKIE')
    expect(str).not.toContain('CSRF_TOKEN')
    expect(str).not.toContain('TopSecretPassword123')
    expect(str).not.toContain('889900')
    expect(event.hostname).toBe('x.com')
  })

  it('Test 5 — Platform Consistency: HTTP platform matches Client Hints and JavaScript platform', () => {
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

  it('Test 6 — Profile Isolation: Profile A and Profile B have independent authentication session states', () => {
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

  it('Test 7 — Browser Lifecycle: resetting or closing profile clears flight lock cleanly without orphaned locks', () => {
    const profileId = 'profile-lifecycle-test'

    SingleFlightAuthManager.acquireAuthLock(profileId)
    expect(SingleFlightAuthManager.getSession(profileId).activeFlight).toBe(true)

    // User closes tab or navigates away
    SingleFlightAuthManager.reset(profileId)
    expect(SingleFlightAuthManager.getSession(profileId).state).toBe('IDLE')
    expect(SingleFlightAuthManager.getSession(profileId).activeFlight).toBe(false)
  })
})
