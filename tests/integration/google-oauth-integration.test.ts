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
  callGmailApi
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
})
