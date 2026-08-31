import { describe, it, expect, beforeEach } from 'vitest'
import { XAuthFlowEngine } from '../../src/main/browser/auth/x-auth-flow-engine'

describe('X.com Production Lock & Comprehensive No-Regression Test Suite', () => {
  const profileId = 'x-prod-lock-' + Date.now()

  beforeEach(() => {
    XAuthFlowEngine.reset()
  })

  // ── 1. Authentication & Single-Flight Lock ──
  describe('1. Authentication Triggers & Single-Flight Lock', () => {
    it('Single login click acquires lock and initializes single active transaction', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      expect(init.success).toBe(true)
      expect(init.loginAttemptId).toBeTruthy()

      const tx = XAuthFlowEngine.getTransactionState(init.loginAttemptId!)
      expect(tx?.inProgress).toBe(true)
      expect(tx?.requestSequence).toBe(1)
      expect(tx?.retryCount).toBe(0)
    })

    it('Rapid repeated clicks (Click #2, #3, #4) are blocked by single-flight lock', () => {
      const init1 = XAuthFlowEngine.initiateLogin({ profileId })
      expect(init1.success).toBe(true)

      const init2 = XAuthFlowEngine.initiateLogin({ profileId })
      const init3 = XAuthFlowEngine.initiateLogin({ profileId })
      const init4 = XAuthFlowEngine.initiateLogin({ profileId })

      expect(init2.success).toBe(false)
      expect(init3.success).toBe(false)
      expect(init4.success).toBe(false)
      expect(init2.errorCode).toBe('LOGIN_INIT_FAILED')
    })
  })

  // ── 2. Authorization Request & PKCE ──
  describe('2. Authorization Request & PKCE S256 Parameters', () => {
    it('Generates RFC 7636 PKCE S256 parameters and unique state', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      const url = new URL(init.authUrl!)

      expect(url.hostname).toBe('x.com')
      expect(url.pathname).toBe('/i/oauth2/authorize')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('state')).toBeTruthy()
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
    })
  })

  // ── 3. Provider-Side HTTP 429 & Terminal State ──
  describe('3. HTTP 429 Provider Cooldown & Zero-Retry Terminal State', () => {
    it('Strictly transitions to PROVIDER_TEMPORARY_LOGIN_RESTRICTION with zero retries and blocked session', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      const evalRes = XAuthFlowEngine.evaluateXResponse({
        loginAttemptId: init.loginAttemptId!,
        statusCode: 429,
        responseBody: "We've temporarily limited your login. Please try again later."
      })

      expect(evalRes.outcome).toBe('PROVIDER_TEMPORARY_LOGIN_RESTRICTION')
      expect(evalRes.errorCode).toBe('PROVIDER_TEMPORARY_LOGIN_RESTRICTION')
      expect(evalRes.guidance).toContain('temporarily restricted')

      const tx = XAuthFlowEngine.getTransactionState(init.loginAttemptId!)
      expect(tx?.authorizationState).toBe('terminated')
      expect(tx?.pendingCallback).toBe('none')
      expect(tx?.pendingCodeExchange).toBe('none')
      expect(tx?.sessionCreation).toBe('blocked')
      expect(tx?.automaticRetry).toBe(false)
      expect(tx?.retryCount).toBe(0)
      expect(tx?.inProgress).toBe(false)
    })
  })

  // ── 4. Callback Security & Duplicate Protection ──
  describe('4. Callback Security, State Validation & Duplicate Protection', () => {
    it('Rejects invalid or mismatched state parameter without creating session', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      const res = XAuthFlowEngine.processCallback({
        loginAttemptId: init.loginAttemptId!,
        code: 'valid_code',
        state: 'MISMATCHED_STATE'
      })

      expect(res.success).toBe(false)
      expect(res.errorCode).toBe('STATE_VALIDATION_FAILED')
      expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()
    })

    it('Rejects duplicate callback replay safely', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      const url = new URL(init.authUrl!)
      const state = url.searchParams.get('state')!

      const first = XAuthFlowEngine.processCallback({
        loginAttemptId: init.loginAttemptId!,
        code: 'code_once',
        state
      })
      expect(first.success).toBe(true)

      const duplicate = XAuthFlowEngine.processCallback({
        loginAttemptId: init.loginAttemptId!,
        code: 'code_once',
        state
      })
      expect(duplicate.success).toBe(false)
      expect(duplicate.errorCode).toBe('STATE_VALIDATION_FAILED')
    })
  })

  // ── 5. Session Lifecycle & Logout ──
  describe('5. Session Lifecycle, Verification & Clean Logout', () => {
    it('Creates valid session on successful callback and completely invalidates on logout', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      const url = new URL(init.authUrl!)
      const state = url.searchParams.get('state')!

      XAuthFlowEngine.processCallback({
        loginAttemptId: init.loginAttemptId!,
        code: 'valid_code',
        state
      })

      const session = XAuthFlowEngine.getSession(profileId)
      expect(session).toBeDefined()
      expect(session?.isValid).toBe(true)

      // Logout
      XAuthFlowEngine.logout(profileId)
      expect(XAuthFlowEngine.getSession(profileId)).toBeUndefined()
    })
  })

  // ── 6. Safe Diagnostics & Zero Credential Leaks ──
  describe('6. Safe Telemetry & Zero Credential Leaks', () => {
    it('Ensures diagnostic logs never leak passwords, cookies, access tokens or PKCE verifiers', () => {
      const init = XAuthFlowEngine.initiateLogin({ profileId })
      XAuthFlowEngine.evaluateXResponse({
        loginAttemptId: init.loginAttemptId!,
        statusCode: 429,
        responseBody: "We've temporarily limited your login."
      })

      const logs = XAuthFlowEngine.getAttemptLogs(init.loginAttemptId!)
      const raw = JSON.stringify(logs)

      expect(raw).not.toContain('codeVerifier')
      expect(raw).not.toContain('auth_token')
      expect(raw).not.toContain('password')
      expect(raw).not.toContain('client_secret')
    })
  })
})
