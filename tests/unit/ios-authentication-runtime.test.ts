import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import {
  IosAuthRuntimeEngine,
  IOS_OAUTH_CONFIG
} from '../../src/main/browser/auth/ios-auth-runtime'
import { generateGenuineIosSafariUserAgent, getIosDeviceById } from '../../src/main/fingerprint/ios-devices'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { Fingerprint } from '../../src/main/fingerprint/types'

describe('AntiProfiles iOS Authentication Runtime (Google OAuth 2.0 Compliant)', () => {
  const profileId = 'test-ios-profile-' + Date.now()

  afterEach(() => {
    IosAuthRuntimeEngine.clearKeychainTokens(profileId)
  })

  // ── 1. Google OAuth 2.0 PKCE & Nonce Security (RFC 7636) ──
  describe('1. Google OAuth 2.0 PKCE & Cryptographic Nonce Security', () => {
    it('generates 64-byte high-entropy code_verifier and S256 code_challenge', () => {
      const pkce = IosAuthRuntimeEngine.generateIosPKCE()

      expect(pkce.codeVerifier).toBeDefined()
      expect(pkce.codeChallenge).toBeDefined()
      expect(pkce.state).toBeDefined()
      expect(pkce.nonce).toBeDefined()

      // Verifier must be 64-byte Base64URL string (length ~86)
      expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(64)
      expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)

      // Challenge must strictly match SHA-256(verifier) in base64url
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(pkce.codeVerifier)
        .digest('base64url')
      expect(pkce.codeChallenge).toBe(expectedChallenge)

      // State and Nonce must be at least 32 bytes hex (64 chars)
      expect(pkce.state.length).toBeGreaterThanOrEqual(64)
      expect(pkce.nonce.length).toBeGreaterThanOrEqual(64)
      expect(pkce.state).not.toBe(pkce.nonce)
    })

    it('builds Google authorization URL with all mandatory parameters', () => {
      const pkce = IosAuthRuntimeEngine.generateIosPKCE()
      const redirectUri = IOS_OAUTH_CONFIG.UNIVERSAL_LINK_CALLBACK
      const authUrlStr = IosAuthRuntimeEngine.buildAuthorizationUrl(pkce, redirectUri, 'test-client-id')

      const authUrl = new URL(authUrlStr)
      expect(authUrl.origin + authUrl.pathname).toBe(IOS_OAUTH_CONFIG.AUTH_ENDPOINT)
      expect(authUrl.searchParams.get('client_id')).toBe('test-client-id')
      expect(authUrl.searchParams.get('redirect_uri')).toBe(IOS_OAUTH_CONFIG.UNIVERSAL_LINK_CALLBACK)
      expect(authUrl.searchParams.get('response_type')).toBe('code')
      expect(authUrl.searchParams.get('code_challenge')).toBe(pkce.codeChallenge)
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
      expect(authUrl.searchParams.get('state')).toBe(pkce.state)
      expect(authUrl.searchParams.get('nonce')).toBe(pkce.nonce)
      expect(authUrl.searchParams.get('prompt')).toBe('select_account')
      expect(authUrl.searchParams.get('access_type')).toBe('offline')

      // Scopes must include openid, email, profile
      const scopes = authUrl.searchParams.get('scope')?.split(' ') || []
      expect(scopes).toContain('openid')
      expect(scopes).toContain('email')
      expect(scopes).toContain('profile')
    })
  })

  // ── 2. Redirect URI Resolution (Universal Link & Custom Scheme) ──
  describe('2. Redirect URI Resolution', () => {
    it('supports Universal Link as preferred redirect URI', () => {
      const uri = IosAuthRuntimeEngine.resolveRedirectUri('universal_link')
      expect(uri).toBe('https://app.antiprofiles.com/oauth/google/callback')
    })

    it('supports Custom URL Scheme redirect URI', () => {
      const uri = IosAuthRuntimeEngine.resolveRedirectUri('custom_scheme')
      expect(uri).toBe('antiprofiles://oauth/google')
    })

    it('supports Loopback redirect URI with dynamic port', () => {
      const uri = IosAuthRuntimeEngine.resolveRedirectUri('loopback', 8945)
      expect(uri).toBe('http://127.0.0.1:8945/oauth2callback')
    })
  })

  // ── 3. Runtime & Forbidden Environment Detection ──
  describe('3. Runtime & Forbidden Environment Detection Engine', () => {
    it('detects and flags WKWebView as forbidden embedded environment', () => {
      const check = IosAuthRuntimeEngine.detectForbiddenEnvironment({ isWKWebView: true })
      expect(check.isForbidden).toBe(true)
      expect(check.reason).toBe('WKWebView')
    })

    it('detects and flags UIWebView as forbidden embedded environment', () => {
      const check = IosAuthRuntimeEngine.detectForbiddenEnvironment({ isUIWebView: true })
      expect(check.isForbidden).toBe(true)
      expect(check.reason).toBe('UIWebView')
    })

    it('detects and flags Headless Runtime as forbidden environment', () => {
      const check = IosAuthRuntimeEngine.detectForbiddenEnvironment({ isHeadless: true })
      expect(check.isForbidden).toBe(true)
      expect(check.reason).toBe('HeadlessRuntime')
    })

    it('detects and flags Automation WebView as forbidden environment', () => {
      const check = IosAuthRuntimeEngine.detectForbiddenEnvironment({ hasWebdriver: true })
      expect(check.isForbidden).toBe(true)
      expect(check.reason).toBe('AutomationWebView')
    })

    it('passes genuine Safari session context', () => {
      const check = IosAuthRuntimeEngine.detectForbiddenEnvironment({})
      expect(check.isForbidden).toBe(false)
    })
  })

  // ── 4. Destination Host Interception Engine ──
  describe('4. Destination Host Interception Engine', () => {
    it('intercepts accounts.google.com and subdomains for secure session exit', () => {
      expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://accounts.google.com/signin/v2/identifier')).toBe(true)
      expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://oauth.google.com/auth')).toBe(true)
      expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://myaccount.google.com')).toBe(true)
      expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://mail.google.com/mail/')).toBe(false) // regular mail UI
      expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://google.com/signin')).toBe(true)
      expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://example.com')).toBe(false)
    })
  })

  // ── 5. Fingerprint Freezing & Context Preservation ──
  describe('5. Fingerprint Freezing & Context Preservation', () => {
    it('freezes profile fingerprint during active authentication session', () => {
      const fp = generateFingerprint({ osType: 'ios', browserType: 'chrome' })
      const frozen = IosAuthRuntimeEngine.freezeFingerprint(profileId, fp)

      expect(frozen).toBeDefined()
      expect(Object.isFrozen(frozen)).toBe(true)
      expect(frozen?.navigator.platform).toBe(fp.navigator.platform)
      expect(frozen?.screen.width).toBe(fp.screen.width)
      expect(frozen?.timezone.timezone).toBe(fp.timezone.timezone)
    })
  })

  // ── 6. Apple Keychain Token Vault & Zero-Logging ──
  describe('6. Apple Keychain Token Vault & Zero-Logging Storage', () => {
    it('stores encrypted tokens in Apple Keychain with accessibility class', () => {
      const plainAccess = 'ya29.a0AfH6SMD-ios-access-token-keychain-test'
      const plainRefresh = '1//0gJios-refresh-token-keychain-test'
      const plainId = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9.eyJzdWIiOiIxMjM0NTY3OCJ9.sample'

      const entry = IosAuthRuntimeEngine.storeTokensInKeychain(profileId, {
        accessToken: plainAccess,
        refreshToken: plainRefresh,
        idToken: plainId,
        expiresIn: 3600
      })

      expect(entry.accessibilityClass).toBe('kSecAttrAccessibleAfterFirstUnlock')
      expect(entry.keychainAccessGroup).toBe('com.antiprofiles.keychain.oauth')
      expect(entry.encryptedAccessToken).not.toBe(plainAccess)
      expect(entry.encryptedAccessToken).not.toContain(plainAccess)

      // Retrieval from Keychain
      const retrieved = IosAuthRuntimeEngine.getTokensFromKeychain(profileId)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.accessToken).toBe(plainAccess)
      expect(retrieved?.refreshToken).toBe(plainRefresh)
      expect(retrieved?.idToken).toBe(plainId)
      expect(retrieved?.isExpired).toBe(false)
    })

    it('clears keychain tokens on profile disconnect', () => {
      IosAuthRuntimeEngine.storeTokensInKeychain(profileId, {
        accessToken: 'sample-access',
        expiresIn: 3600
      })

      expect(IosAuthRuntimeEngine.getTokensFromKeychain(profileId)).not.toBeNull()
      const cleared = IosAuthRuntimeEngine.clearKeychainTokens(profileId)
      expect(cleared).toBe(true)
      expect(IosAuthRuntimeEngine.getTokensFromKeychain(profileId)).toBeNull()
    })
  })

  // ── 7. Error Recovery for "This browser or app may not be secure" ──
  describe('7. Error Recovery Engine', () => {
    it('recovers from Google security rejection and targets ASWebAuthenticationSession', () => {
      const recovery = IosAuthRuntimeEngine.handleSecurityErrorRecovery(profileId)

      expect(recovery.recovered).toBe(true)
      expect(recovery.targetSession).toBe('ASWebAuthenticationSession')
      expect(recovery.guidanceMessage).toBe('Continue securely with Safari authentication.')
    })
  })

  // ── 8. Genuine Safari User-Agent & Platform Fidelity ──
  describe('8. Genuine Safari User-Agent & Platform Fidelity', () => {
    it('generates genuine Mobile Safari user agent without fake Chrome tokens', () => {
      const device = getIosDeviceById('iphone-16-pro')
      expect(device).not.toBeNull()
      if (!device) return

      const safariUA = generateGenuineIosSafariUserAgent(device)
      expect(safariUA).toContain('iPhone')
      expect(safariUA).toContain('AppleWebKit/605.1.15')
      expect(safariUA).toContain('Version/18.0')
      expect(safariUA).toContain('Safari/604.1')
      expect(safariUA).not.toContain('Chrome')
      expect(safariUA).not.toContain('CriOS')
      expect(safariUA).not.toContain('Headless')
    })
  })
})
