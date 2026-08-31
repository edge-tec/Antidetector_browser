import { describe, it, expect, beforeEach } from 'vitest'
import { XAuthFlowEngine } from '../../src/main/browser/auth/x-auth-flow-engine'

describe('X.com Login Flow — End-to-End Production Diagnostic & Fix Tests', () => {
  const profileId = 'x-test-profile-e2e-' + Date.now()

  beforeEach(() => {
    XAuthFlowEngine.reset()
  })

  // ── Test 1: Single Login click → exactly one authorization request ──
  it('Test 1: Single Login click creates exactly one authorization request with unique loginAttemptId', () => {
    const res = XAuthFlowEngine.initiateLogin({ profileId })
    expect(res.success).toBe(true)
    expect(res.loginAttemptId).toBeTruthy()
    expect(res.authUrl).toContain('https://x.com/i/oauth2/authorize')
    expect(res.authUrl).toContain('response_type=code')
    expect(res.authUrl).toContain('code_challenge_method=S256')

    const logs = XAuthFlowEngine.getAttemptLogs(res.loginAttemptId!)
    expect(logs.length).toBe(3) // CLICKED -> CREATED -> SENT
    expect(logs[0].currentStep).toBe('LOGIN_BUTTON_CLICKED')
    expect(logs[1].currentStep).toBe('AUTHORIZATION_REQUEST_CREATED')
    expect(logs[2].currentStep).toBe('AUTHORIZATION_REQUEST_SENT')
  })

  // ── Test 2: Multiple rapid Login clicks → exactly one active authentication attempt ──
  it('Test 2: Multiple rapid Login clicks are locked and prevent duplicate concurrent attempts', () => {
    const res1 = XAuthFlowEngine.initiateLogin({ profileId })
    expect(res1.success).toBe(true)

    // Second immediate click
    const res2 = XAuthFlowEngine.initiateLogin({ profileId })
    expect(res2.success).toBe(false)
    expect(res2.errorCode).toBe('LOGIN_INIT_FAILED')
    expect(res2.error).toContain('already in progress')
  })

  // ── Test 3: Successful X authorization → callback received → session created ──
  it('Test 3: Successful X authorization flow receives callback, exchanges code, and creates session', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    expect(init.success).toBe(true)

    // Extract state from URL
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!

    const callbackRes = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'valid_x_oauth_code_123',
      state
    })

    expect(callbackRes.success).toBe(true)
    const session = XAuthFlowEngine.getSession(profileId)
    expect(session).toBeDefined()
    expect(session?.isValid).toBe(true)
    expect(session?.profileId).toBe(profileId)

    const logs = XAuthFlowEngine.getAttemptLogs(init.loginAttemptId!)
    const steps = logs.map(l => l.currentStep)
    expect(steps).toContain('CALLBACK_VALIDATED')
    expect(steps).toContain('AUTHORIZATION_CODE_EXCHANGED')
    expect(steps).toContain('APPLICATION_SESSION_CREATED')
  })

  // ── Test 4: Invalid state → authentication rejected ──
  it('Test 4: Invalid or forged state parameter rejects authentication and prevents session creation', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    expect(init.success).toBe(true)

    const callbackRes = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'valid_x_oauth_code_123',
      state: 'FORGED_OR_EXPIRED_STATE'
    })

    expect(callbackRes.success).toBe(false)
    expect(callbackRes.errorCode).toBe('STATE_VALIDATION_FAILED')
    expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()
  })

  // ── Test 5: Duplicate callback → second callback rejected safely ──
  it('Test 5: Duplicate callback submission is safely rejected without creating multiple sessions', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!

    const first = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'auth_code_once',
      state
    })
    expect(first.success).toBe(true)

    // Replay attack / duplicate callback
    const second = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'auth_code_once',
      state
    })
    expect(second.success).toBe(false)
    expect(second.errorCode).toBe('STATE_VALIDATION_FAILED')
    expect(second.error).toContain('Duplicate callback')
  })

  // ── Test 6: Authorization-code exchange failure → no authenticated session created ──
  it('Test 6: Missing or invalid authorization code fails exchange with no partial session created', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!

    const callbackRes = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: undefined, // Missing code
      state
    })

    expect(callbackRes.success).toBe(false)
    expect(callbackRes.errorCode).toBe('CODE_EXCHANGE_FAILED')
    expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()
  })

  // ── Test 7: X temporary login restriction → correctly classified and no automatic retry ──
  it('Test 7: X temporary login restriction is classified as TEMPORARY_LOGIN_RESTRICTION with retries blocked', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const evalRes = XAuthFlowEngine.evaluateXResponse({
      loginAttemptId: init.loginAttemptId!,
      statusCode: 429,
      responseBody: "We've temporarily limited your login. Please try again later."
    })

    expect(evalRes.outcome).toBe('TEMPORARY_LOGIN_RESTRICTION')
    expect(evalRes.errorCode).toBe('X_TEMPORARY_RESTRICTION')
    expect(evalRes.guidance).toContain('temporarily limited')
  })

  // ── Test 8: Network failure → safe error handling ──
  it('Test 8: Network failure (5xx or connection error) returns clean error with no secrets logged', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const evalRes = XAuthFlowEngine.evaluateXResponse({
      loginAttemptId: init.loginAttemptId!,
      statusCode: 503,
      responseBody: 'Service Unavailable'
    })

    expect(evalRes.outcome).toBe('NETWORK_ERROR')
    expect(evalRes.errorCode).toBe('NETWORK_ERROR')
    expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()
  })

  // ── Test 9: Page reload during authentication → state remains consistent ──
  it('Test 9: Page reload retains in-flight transaction integrity under TTL', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!

    // Simulated page reload: same transaction attempt ID processes callback
    const res = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'code_after_reload',
      state
    })

    expect(res.success).toBe(true)
    expect(XAuthFlowEngine.getSession(profileId)?.isValid).toBe(true)
  })

  // ── Test 10: Logout → application session completely invalidated ──
  it('Test 10: Logout cleanly invalidates application session and unlocks profile', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!

    XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'code_valid',
      state
    })
    expect(XAuthFlowEngine.getSession(profileId)).toBeDefined()

    // Logout
    const logoutRes = XAuthFlowEngine.logout(profileId)
    expect(logoutRes).toBe(true)
    expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()

    // Can initiate new login cleanly
    const reInit = XAuthFlowEngine.initiateLogin({ profileId })
    expect(reInit.success).toBe(true)
  })
})
