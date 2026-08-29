// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google OAuth 2.0 PKCE Loopback Authentication Module
// Implements RFC 8252 (OAuth 2.0 for Native Apps) using the System Browser.
// Configured with Google Cloud Desktop OAuth Client ID & Secret.
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import crypto from 'crypto'
import https from 'https'
import { shell } from 'electron'
import { logger } from '../logging/logger'

export const getGoogleClientId = (): string => {
  return process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || ''
}

export const getGoogleClientSecret = (): string => {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
}

export interface PKCEPair {
  verifier: string
  challenge: string
}

export interface GoogleOAuthConfig {
  clientId?: string
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
  redirectUri?: string
  tokens?: {
    accessToken?: string
    refreshToken?: string
    idToken?: string
    expiresIn?: number
  }
  userProfile?: {
    id: string
    email: string
    name: string
    picture?: string
    verifiedEmail?: boolean
  }
  error?: string
}

/**
 * Generate a cryptographically secure PKCE Code Verifier and Code Challenge (S256).
 * Conforms to RFC 7636.
 */
export function generatePKCE(): PKCEPair {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const hash = crypto.createHash('sha256').update(verifier).digest()
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
 * Exchange Authorization Code and PKCE Verifier for Google Access/ID Tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string = getGoogleClientId(),
  clientSecret: string = getGoogleClientSecret()
): Promise<{ success: boolean; tokens?: any; userProfile?: any; error?: string }> {
  return new Promise((resolve) => {
    const postData = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    }).toString()

    const req = https.request(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', async () => {
          try {
            const data = JSON.parse(body)
            if (data.error) {
              resolve({ success: false, error: data.error_description || data.error })
              return
            }

            const tokens = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              idToken: data.id_token,
              expiresIn: data.expires_in
            }

            // Fetch User Profile with Access Token
            if (tokens.accessToken) {
              try {
                const profile = await fetchGoogleUserProfile(tokens.accessToken)
                resolve({ success: true, tokens, userProfile: profile })
                return
              } catch {}
            }

            resolve({ success: true, tokens })
          } catch (e: any) {
            resolve({ success: false, error: `Failed to parse token response: ${e.message}` })
          }
        })
      }
    )

    req.on('error', (err) => {
      resolve({ success: false, error: `Token exchange request failed: ${err.message}` })
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Fetch Google User Info using the Access Token.
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => (body += chunk))
          res.on('end', () => {
            try {
              const data = JSON.parse(body)
              resolve({
                id: data.sub,
                email: data.email,
                name: data.name,
                picture: data.picture,
                verifiedEmail: data.email_verified
              })
            } catch (err) {
              reject(err)
            }
          })
        }
      )
      .on('error', reject)
  })
}

/**
 * Execute a standard RFC 8252 OAuth 2.0 PKCE flow using the System Browser
 * and a temporary local HTTP loopback server (127.0.0.1).
 */
export async function startGoogleSystemBrowserOAuth(
  config: GoogleOAuthConfig = {}
): Promise<OAuthAuthResult> {
  const {
    clientId = getGoogleClientId(),
    clientSecret = getGoogleClientSecret(),
    scopes = ['openid', 'email', 'profile'],
    redirectPath = '/oauth2callback',
    timeoutMs = 180000 // 3 minutes timeout
  } = config

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
                <body style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:50px;background:#1e1e2e;color:#fff;">
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
                <body style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:50px;background:#1e1e2e;color:#fff;">
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
            const serverPort = (server?.address() as any)?.port
            const redirectUri = `http://127.0.0.1:${serverPort}${redirectPath}`

            // Exchange token immediately if clientSecret is available
            let tokens: any = undefined
            let userProfile: any = undefined

            if (clientSecret) {
              try {
                const exchangeRes = await exchangeCodeForTokens(
                  authCode,
                  pkce.verifier,
                  redirectUri,
                  clientId,
                  clientSecret
                )
                if (exchangeRes.success) {
                  tokens = exchangeRes.tokens
                  userProfile = exchangeRes.userProfile
                }
              } catch {}
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <html>
                <body style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:50px;background:#181825;color:#cdd6f4;">
                  <div style="max-width:480px;margin:0 auto;background:#1e1e2e;padding:30px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
                    <h2 style="color:#a6e3a1;margin-bottom:12px;">✓ Authentication Successful</h2>
                    <p style="color:#a6adc8;font-size:15px;line-height:1.6;">
                      You have signed in successfully with Google.<br/>
                      You can close this window and return to <strong>AntiProfiles</strong>.
                    </p>
                  </div>
                </body>
              </html>
            `)
            cleanup()
            resolve({
              success: true,
              code: authCode,
              state: returnedState,
              codeVerifier: pkce.verifier,
              redirectUri,
              tokens,
              userProfile
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
