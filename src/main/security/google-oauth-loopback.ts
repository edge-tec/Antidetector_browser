// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google OAuth 2.0 PKCE Loopback Authentication Module
// Implements RFC 8252 (OAuth 2.0 for Native Apps) using the System Browser.
// Compliant with Google Identity Services & Embedded WebView Disallowance Policy.
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import crypto from 'crypto'
import { shell } from 'electron'
import { logger } from '../logging/logger'

export interface PKCEPair {
  verifier: string
  challenge: string
}

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret?: string
  scopes?: string[]
  redirectPath?: string
  timeoutMs?: number
}

export interface OAuthAuthResult {
  success: boolean
  code?: string
  state?: string
  codeVerifier?: string
  error?: string
}

/**
 * Generate a cryptographically secure PKCE Code Verifier and Code Challenge (S256).
 * Conforms to RFC 7636.
 */
export function generatePKCE(): PKCEPair {
  // 1. Generate 32-96 bytes of random entropy (base64url encoded)
  const verifier = crypto.randomBytes(32).toString('base64url')
  
  // 2. SHA-256 hash of verifier
  const hash = crypto.createHash('sha256').update(verifier).digest()
  
  // 3. Base64URL encode the hash
  const challenge = hash.toString('base64url')

  return { verifier, challenge }
}

/**
 * Generate a cryptographically random state parameter for CSRF mitigation.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString('hex')
}

/**
 * Execute a standard RFC 8252 OAuth 2.0 PKCE flow using the System Browser
 * and a temporary local HTTP loopback server (127.0.0.1).
 */
export async function startGoogleSystemBrowserOAuth(
  config: GoogleOAuthConfig
): Promise<OAuthAuthResult> {
  const {
    clientId,
    scopes = ['openid', 'email', 'profile'],
    redirectPath = '/oauth2callback',
    timeoutMs = 180000 // 3 minutes timeout
  } = config

  if (!clientId) {
    return { success: false, error: 'Google Client ID is required for OAuth 2.0' }
  }

  const pkce = generatePKCE()
  const expectedState = generateOAuthState()

  return new Promise((resolve) => {
    let server: http.Server | null = null
    let timeoutTimer: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (server) {
        server.close()
        server = null
      }
    }

    // Set timeout to abort hanging loopback servers
    timeoutTimer = setTimeout(() => {
      cleanup()
      resolve({ success: false, error: 'Google OAuth authentication timed out.' })
    }, timeoutMs)

    server = http.createServer(async (req, res) => {
      try {
        const reqUrl = req.url || ''
        const urlObj = new URL(reqUrl, `http://127.0.0.1`)

        if (urlObj.pathname === redirectPath) {
          const authCode = urlObj.searchParams.get('code')
          const returnedState = urlObj.searchParams.get('state')
          const authError = urlObj.searchParams.get('error')

          // 1. Verify State Parameter to prevent CSRF
          if (!returnedState || returnedState !== expectedState) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <html>
                <body style="font-family:system-ui;text-align:center;padding:50px;background:#1e1e2e;color:#fff;">
                  <h2 style="color:#f38ba8;">Authentication Error</h2>
                  <p>State parameter validation failed (CSRF check). Please try again.</p>
                </body>
              </html>
            `)
            cleanup()
            resolve({ success: false, error: 'Invalid state parameter returned by OAuth provider.' })
            return
          }

          // 2. Handle provider errors
          if (authError) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <html>
                <body style="font-family:system-ui;text-align:center;padding:50px;background:#1e1e2e;color:#fff;">
                  <h2 style="color:#f38ba8;">Sign-in Cancelled</h2>
                  <p>${authError}</p>
                </body>
              </html>
            `)
            cleanup()
            resolve({ success: false, error: `Google OAuth Error: ${authError}` })
            return
          }

          // 3. Successful Authorization Code Capture
          if (authCode) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <html>
                <body style="font-family:system-ui;text-align:center;padding:50px;background:#181825;color:#cdd6f4;">
                  <h2 style="color:#a6e3a1;">✓ Authentication Successful</h2>
                  <p>You have signed in successfully with Google. You can close this tab and return to AntiProfiles.</p>
                </body>
              </html>
            `)
            cleanup()
            resolve({
              success: true,
              code: authCode,
              state: returnedState,
              codeVerifier: pkce.verifier
            })
            return
          }
        }

        // Unhandled path
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      } catch (err: any) {
        cleanup()
        resolve({ success: false, error: `Loopback handler error: ${err.message}` })
      }
    })

    // Listen on random available ephemeral port on 127.0.0.1
    server.listen(0, '127.0.0.1', async () => {
      const address = server?.address()
      if (!address || typeof address === 'string') {
        cleanup()
        resolve({ success: false, error: 'Failed to bind loopback HTTP server' })
        return
      }

      const port = address.port
      const redirectUri = `http://127.0.0.1:${port}${redirectPath}`

      // Build standard Google OAuth 2.0 Authorization Endpoint URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scopes.join(' '))
      authUrl.searchParams.set('code_challenge', pkce.challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('state', expectedState)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')

      logger.info('auth', `[GoogleOAuth] Opening System Default Browser for RFC 8252 OAuth with redirect: ${redirectUri}`)

      // Open in user's default secure desktop browser
      try {
        await shell.openExternal(authUrl.toString())
      } catch (shellErr: any) {
        cleanup()
        resolve({ success: false, error: `Could not launch system browser: ${shellErr.message}` })
      }
    })

    server.on('error', (err: any) => {
      cleanup()
      resolve({ success: false, error: `Loopback server error: ${err.message}` })
    })
  })
}
