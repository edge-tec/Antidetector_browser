// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Unit Tests: Google OAuth 2.0 PKCE & Loopback Standards
// Tests RFC 7636 (PKCE) and RFC 8252 (OAuth 2.0 for Native Apps)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { generatePKCE, generateOAuthState } from '../../src/main/security/google-oauth-loopback'

describe('Google OAuth 2.0 PKCE & Loopback Standards (RFC 8252 / RFC 7636)', () => {
  describe('1. PKCE Generator (RFC 7636)', () => {
    it('generates high-entropy code_verifier and correct SHA-256 code_challenge', () => {
      const { verifier, challenge } = generatePKCE()

      expect(verifier).toBeDefined()
      expect(challenge).toBeDefined()

      // Verifier should be valid base64url string with minimum length (>= 43 chars)
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)

      // Challenge must match SHA-256(verifier) in base64url
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url')

      expect(challenge).toBe(expectedChallenge)
    })

    it('generates unique verifier and challenge on subsequent calls', () => {
      const pair1 = generatePKCE()
      const pair2 = generatePKCE()

      expect(pair1.verifier).not.toBe(pair2.verifier)
      expect(pair1.challenge).not.toBe(pair2.challenge)
    })
  })

  describe('2. OAuth State Parameter (CSRF Protection)', () => {
    it('generates cryptographically secure state tokens', () => {
      const state1 = generateOAuthState()
      const state2 = generateOAuthState()

      expect(state1).toBeDefined()
      expect(state1.length).toBeGreaterThanOrEqual(32)
      expect(state1).not.toBe(state2)
    })
  })
})
