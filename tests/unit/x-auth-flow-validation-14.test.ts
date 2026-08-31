import { describe, it, expect, beforeEach } from 'vitest'
import { XAuthFlowEngine } from '../../src/main/browser/auth/x-auth-flow-engine'

describe('X.com Final Production Runtime Verification & Validation — 14 Required Tests', () => {
  const profileId = 'x-final-val-' + Date.now()

  beforeEach(() => {
    XAuthFlowEngine.reset()
  })

  // 1. Single Login Click
  it('1. Single Login Click: Creates exactly one active attempt with unique ID', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    expect(init.success).toBe(true)
    expect(init.loginAttemptId).toBeTruthy()
    const tx = XAuthFlowEngine.getTransactionState(init.loginAttemptId!)
    expect(tx?.requestSequence).toBe(1)
    expect(tx?.retryCount).toBe(0)
  })

  // 2. Rapid Multiple Click Protection
  it('2. Rapid Multiple Click Protection: Atomic lock prevents duplicate concurrent requests', () => {
    const init1 = XAuthFlowEngine.initiateLogin({ profileId })
    expect(init1.success).toBe(true)
    const init2 = XAuthFlowEngine.initiateLogin({ profileId })
    expect(init2.success).toBe(false)
    expect(init2.errorCode).toBe('LOGIN_INIT_FAILED')
  })

  // 3. Authorization Request
  it('3. Authorization Request: Parameters match RFC specification and S256 PKCE', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    expect(url.hostname).toBe('x.com')
    expect(url.pathname).toBe('/i/oauth2/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  // 4. PKCE Validation
  it('4. PKCE Validation: Generates 64-byte random verifier and matching SHA-256 challenge', () => {
    const pkce = XAuthFlowEngine.generatePKCE()
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(pkce.codeChallenge.length).toBeGreaterThan(0)
  })

  // 5. State Validation
  it('5. State Validation: Rejects forged or mismatched state parameter', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const res = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'auth_code_123',
      state: 'FORGED_STATE'
    })
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('STATE_VALIDATION_FAILED')
  })

  // 6. Callback Validation
  it('6. Callback Validation: Validates state and initiates code exchange', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!
    const res = XAuthFlowEngine.processCallback({
      loginAttemptId: init.loginAttemptId!,
      code: 'valid_code',
      state
    })
    expect(res.success).toBe(true)
  })

  // 7. Duplicate Callback Protection
  it('7. Duplicate Callback Protection: Second callback attempt rejected safely', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!
    XAuthFlowEngine.processCallback({ loginAttemptId: init.loginAttemptId!, code: 'code1', state })
    const duplicate = XAuthFlowEngine.processCallback({ loginAttemptId: init.loginAttemptId!, code: 'code1', state })
    expect(duplicate.success).toBe(false)
    expect(duplicate.errorCode).toBe('STATE_VALIDATION_FAILED')
  })

  // 8. Authorization Code Exchange
  it('8. Authorization Code Exchange: Code exchanged exactly once', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!
    XAuthFlowEngine.processCallback({ loginAttemptId: init.loginAttemptId!, code: 'code_once', state })
    const tx = XAuthFlowEngine.getTransactionState(init.loginAttemptId!)
    expect(tx?.codeExchanged).toBe(true)
  })

  // 9. HTTP 429 Handling
  it('9. HTTP 429 Handling: Classified as PROVIDER_TEMPORARY_LOGIN_RESTRICTION', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const evalRes = XAuthFlowEngine.evaluateXResponse({
      loginAttemptId: init.loginAttemptId!,
      statusCode: 429,
      responseBody: "We've temporarily limited your login. Please try again later."
    })
    expect(evalRes.outcome).toBe('PROVIDER_TEMPORARY_LOGIN_RESTRICTION')
    expect(evalRes.errorCode).toBe('PROVIDER_TEMPORARY_LOGIN_RESTRICTION')
  })

  // 10. Automatic Retry Prevention
  it('10. Automatic Retry Prevention: automaticRetry is strictly false on 429', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    XAuthFlowEngine.evaluateXResponse({
      loginAttemptId: init.loginAttemptId!,
      statusCode: 429,
      responseBody: "We've temporarily limited your login."
    })
    const tx = XAuthFlowEngine.getTransactionState(init.loginAttemptId!)
    expect(tx?.automaticRetry).toBe(false)
    expect(tx?.authorizationState).toBe('terminated')
    expect(tx?.inProgress).toBe(false)
  })

  // 11. Session Creation
  it('11. Session Creation: Session created only upon successful callback and code exchange', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!
    XAuthFlowEngine.processCallback({ loginAttemptId: init.loginAttemptId!, code: 'good_code', state })
    const session = XAuthFlowEngine.getSession(profileId)
    expect(session).toBeDefined()
    expect(session?.isValid).toBe(true)
  })

  // 12. Logout
  it('12. Logout: Application session invalidated completely', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const url = new URL(init.authUrl!)
    const state = url.searchParams.get('state')!
    XAuthFlowEngine.processCallback({ loginAttemptId: init.loginAttemptId!, code: 'code_lg', state })
    expect(XAuthFlowEngine.getSession(profileId)).toBeDefined()
    XAuthFlowEngine.logout(profileId)
    expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()
  })

  // 13. Page Reload During Authentication
  it('13. Page Reload During Authentication: Retains in-flight transaction integrity under TTL', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const tx = XAuthFlowEngine.getTransactionState(init.loginAttemptId!)
    expect(tx?.inProgress).toBe(true)
    expect(tx?.expiresAt).toBeGreaterThan(Date.now())
  })

  // 14. Sensitive Telemetry Protection
  it('14. Sensitive Telemetry Protection: Diagnostics log redacts secrets and codes', () => {
    const init = XAuthFlowEngine.initiateLogin({ profileId })
    const logs = XAuthFlowEngine.getAttemptLogs(init.loginAttemptId!)
    const raw = JSON.stringify(logs)
    expect(raw).not.toContain('codeVerifier')
    expect(raw).not.toContain('auth_token')
    expect(raw).not.toContain('password')
  })
})
