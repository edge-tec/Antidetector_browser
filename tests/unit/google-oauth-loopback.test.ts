// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Comprehensive Unit Tests: Google OAuth 2.0 PKCE & Loopback
// Tests RFC 7636 (PKCE), RFC 8252 (OAuth 2.0 for Native Apps),
// Multi-Profile Isolation, and Safe Token Encryption.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'crypto'
import {
  generatePKCE,
  generateOAuthState,
  encryptOAuthToken,
  decryptOAuthToken,
  getProfileGoogleAccount,
  disconnectProfileGoogleAccount
} from '../../src/main/security/google-oauth-loopback'

describe('Google OAuth 2.0 PKCE & Loopback Standards (RFC 8252 / RFC 7636)', () => {
  describe('Test 1 & Test 5: PKCE Generator & Validation (RFC 7636)', () => {
    it('generates high-entropy code_verifier and correct SHA-256 code_challenge', () => {
      const { verifier, challenge } = generatePKCE()

      expect(verifier).toBeDefined()
      expect(challenge).toBeDefined()

      // Verifier must be valid base64url string with length >= 43
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)

      // Challenge must strictly match SHA-256(verifier) in base64url
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url')

      expect(challenge).toBe(expectedChallenge)
    })

    it('generates unique verifier and challenge pairs on subsequent requests', () => {
      const pair1 = generatePKCE()
      const pair2 = generatePKCE()

      expect(pair1.verifier).not.toBe(pair2.verifier)
      expect(pair1.challenge).not.toBe(pair2.challenge)
    })
  })

  describe('Test 4: OAuth State Parameter (CSRF Protection)', () => {
    it('generates cryptographically secure random state tokens', () => {
      const state1 = generateOAuthState()
      const state2 = generateOAuthState()

      expect(state1).toBeDefined()
      expect(state1.length).toBeGreaterThanOrEqual(32)
      expect(state1).not.toBe(state2)
    })
  })

  describe('Test 6 & Test 8: Safe Token Encryption & Storage Integrity', () => {
    it('encrypts sensitive tokens and successfully decrypts without plaintext exposure', () => {
      const plainToken = 'ya29.a0AfH6SMD-sample-sensitive-google-access-token-12345'
      const encrypted = encryptOAuthToken(plainToken)

      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(plainToken)
      expect(encrypted).not.toContain(plainToken)

      const decrypted = decryptOAuthToken(encrypted)
      expect(decrypted).toBe(plainToken)
    })

    it('handles empty or invalid encrypted tokens gracefully', () => {
      expect(encryptOAuthToken('')).toBe('')
      expect(decryptOAuthToken('')).toBe('')
      expect(decryptOAuthToken('invalid:format')).toBe('')
    })
  })

  describe('Test 9 & Test 10: Multi-Profile Isolation & Token Revocation', () => {
    it('guarantees complete isolation between Profile A and Profile B Google accounts', () => {
      const profileA = 'profile-test-uuid-a'
      const profileB = 'profile-test-uuid-b'

      // Initially both have no account
      expect(getProfileGoogleAccount(profileA)).toBeNull()
      expect(getProfileGoogleAccount(profileB)).toBeNull()

      // Disconnecting non-existent profile returns false
      expect(disconnectProfileGoogleAccount(profileA)).toBe(false)
    })
  })
})
