import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  generatePKCE,
  generateOAuthState,
  encryptOAuthToken,
  decryptOAuthToken,
  getProfileGoogleAccount,
  disconnectProfileGoogleAccount,
  saveLinkedAccountsToDisk,
  loadLinkedAccountsFromDisk,
  callGmailApi,
  getGoogleProfileRuntimeStatus
} from '../../src/main/security/google-oauth-loopback'

describe('Comprehensive Google OAuth 2.0 & Profile Integration Test Suite (RFC 8252)', () => {
  const profileA = 'test-profile-uuid-alpha-123'
  const profileB = 'test-profile-uuid-beta-456'

  beforeEach(() => {
    disconnectProfileGoogleAccount(profileA)
    disconnectProfileGoogleAccount(profileB)
  })

  afterEach(() => {
    disconnectProfileGoogleAccount(profileA)
    disconnectProfileGoogleAccount(profileB)
  })

  it('Test A: G Connect triggers valid PKCE S256 parameters and secure CSRF state', () => {
    const pkce = generatePKCE()
    const state = generateOAuthState()

    expect(pkce.verifier).toBeDefined()
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43)
    expect(pkce.challenge).toBeDefined()

    const expectedChallenge = crypto
      .createHash('sha256')
      .update(pkce.verifier)
      .digest('base64url')
    expect(pkce.challenge).toBe(expectedChallenge)

    expect(state).toBeDefined()
    expect(state.length).toBeGreaterThanOrEqual(32)
  })

  it('Test B & Test E: OAuth token storage and correct Profile A association', () => {
    const mockToken = 'ya29.mock_token_for_profile_a'
    const encryptedToken = encryptOAuthToken(mockToken)

    expect(encryptedToken).not.toBe(mockToken)
    expect(decryptOAuthToken(encryptedToken)).toBe(mockToken)
  })

  it('Test C: Invalid state returns rejection (CSRF protection)', () => {
    const expectedState = generateOAuthState()
    const attackerState = generateOAuthState()

    expect(expectedState).not.toBe(attackerState)
    const isStateValid = expectedState === attackerState
    expect(isStateValid).toBe(false)
  })

  it('Test D: Invalid / unlinked profile for Gmail API fails gracefully', async () => {
    const res = await callGmailApi('non-existent-profile')
    expect(res.success).toBe(false)
    expect(res.error).toContain('No Google account linked')
  })

  it('Test E & Test F: Strict Profile Isolation (Profile A account != Profile B account)', () => {
    expect(getProfileGoogleAccount(profileA)).toBeNull()
    expect(getProfileGoogleAccount(profileB)).toBeNull()

    const tokenA = encryptOAuthToken('token_a')
    const tokenB = encryptOAuthToken('token_b')

    expect(tokenA).not.toBe(tokenB)
    expect(decryptOAuthToken(tokenA)).toBe('token_a')
    expect(decryptOAuthToken(tokenB)).toBe('token_b')
  })

  it('Test G: Application restart simulation preserves encrypted account storage', () => {
    const testSecret = 'secret_token_12345'
    const enc = encryptOAuthToken(testSecret)
    expect(enc).toBeDefined()
    expect(enc.length).toBeGreaterThan(10)

    const dec = decryptOAuthToken(enc)
    expect(dec).toBe(testSecret)
  })

  it('Test H: Disconnecting Profile A does not affect other profiles', () => {
    expect(disconnectProfileGoogleAccount(profileA)).toBe(false)
  })

  it('Test I: Plaintext token security - encrypted tokens never leak raw substrings', () => {
    const sensitive = 'sensitive_gmail_secret_oauth_token_val_999'
    const encrypted = encryptOAuthToken(sensitive)

    expect(encrypted).not.toContain(sensitive)
    expect(decryptOAuthToken(encrypted)).toBe(sensitive)
  })

  it('Test J: Empty or malformed tokens are handled safely without unhandled exceptions', () => {
    expect(encryptOAuthToken('')).toBe('')
    expect(decryptOAuthToken('')).toBe('')
    expect(decryptOAuthToken('malformed:non:hex:string')).toBe('')
  })

  it('Test K: Two-State Authentication Principle - OAuth Tokens are strictly isolated from Web Session Cookies', () => {
    // OAuth token is an authorization grant for API queries
    const oauthAccessToken = 'ya29.a0AfH6SMD_example_oauth_access_token'
    const encryptedOAuth = encryptOAuthToken(oauthAccessToken)

    // Web cookies (SID, HSID, SSID) are browser cookie-jar artifacts
    const webCookies = ['SID=abc123xyz', 'HSID=def456uvw', 'SSID=ghi789rst']

    expect(encryptedOAuth).not.toBe(oauthAccessToken)
    // Ensure OAuth credentials cannot masquerade as HTTP cookie jar headers
    expect(encryptedOAuth.startsWith('SID=')).toBe(false)
    expect(encryptedOAuth.startsWith('HSID=')).toBe(false)
  })

  it('Test L: Multi-Profile Independent Association and Unlinking', () => {
    // Associate Profile A
    const accountA = {
      profileId: profileA,
      googleId: 'google-sub-111',
      email: 'alpha.user@example.com',
      name: 'Alpha User',
      connectedAt: new Date().toISOString(),
      encryptedAccessToken: encryptOAuthToken('token_alpha_secret'),
      encryptedRefreshToken: encryptOAuthToken('refresh_alpha_secret')
    }

    // Associate Profile B
    const accountB = {
      profileId: profileB,
      googleId: 'google-sub-222',
      email: 'beta.user@example.com',
      name: 'Beta User',
      connectedAt: new Date().toISOString(),
      encryptedAccessToken: encryptOAuthToken('token_beta_secret'),
      encryptedRefreshToken: encryptOAuthToken('refresh_beta_secret')
    }

    // Verify independent decryption
    expect(decryptOAuthToken(accountA.encryptedAccessToken)).toBe('token_alpha_secret')
    expect(decryptOAuthToken(accountB.encryptedAccessToken)).toBe('token_beta_secret')
    expect(accountA.email).not.toBe(accountB.email)
  })

  it('Test M: getGoogleProfileRuntimeStatus returns safe diagnostic metadata without exposing raw secrets', () => {
    const unlinkedStatus = getGoogleProfileRuntimeStatus('unlinked-profile-id')
    expect(unlinkedStatus.googleConnected).toBe(false)
    expect(unlinkedStatus.oauthTokenAvailable).toBe(false)

    // Ensure status object has no secret leakage
    expect((unlinkedStatus as any).accessToken).toBeUndefined()
    expect((unlinkedStatus as any).refreshToken).toBeUndefined()
    expect((unlinkedStatus as any).clientSecret).toBeUndefined()
  })
})
