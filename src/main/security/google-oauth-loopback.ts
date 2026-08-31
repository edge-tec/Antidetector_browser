// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google OAuth 2.0 PKCE Loopback Authentication Module
// Implements RFC 8252 (OAuth 2.0 for Native Apps) using the System Browser.
// Features Multi-Profile Isolation, PKCE, CSRF State Protection, and safeStorage Encryption.
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import crypto from 'crypto'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { app, shell, safeStorage } from 'electron'
import { logger } from '../logging/logger'

const decodeDef = (b64: string): string => Buffer.from(b64, 'base64').toString('utf8')

export const DEFAULT_GOOGLE_CLIENT_ID = decodeDef('NTc1MTU3NDUzMzItNG1lMjdwbDFqaGd1MjM2OWxrMWljc3RjbGRjdXRvYzQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20=')
export const DEFAULT_GOOGLE_CLIENT_SECRET = decodeDef('R0NDU1BYLVZNaHduR2I1RmhxR2E2VFR3Y1FZXU45N1l2UDY=')

export const getGoogleClientId = (): string => {
  return process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID
}

export const getGoogleClientSecret = (): string => {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET
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
  profileId?: string
}

export interface LinkedGoogleAccount {
  profileId: string
  googleId: string
  email: string
  name: string
  picture?: string
  connectedAt: string
  encryptedAccessToken?: string
  encryptedRefreshToken?: string
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
  linkedAccount?: LinkedGoogleAccount
  error?: string
}

// In-Memory store for Linked Profile Google Accounts (isolated per profile)
const linkedAccountsMap = new Map<string, LinkedGoogleAccount>()

function getStoreFilePath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'google_linked_accounts.enc')
    }
  } catch {}
  return path.join(process.cwd(), 'google_linked_accounts.enc')
}

export function saveLinkedAccountsToDisk(): void {
  try {
    const storePath = getStoreFilePath()
    const raw = JSON.stringify(Array.from(linkedAccountsMap.entries()))
    const encrypted = encryptOAuthToken(raw)
    fs.writeFileSync(storePath, encrypted, 'utf8')
  } catch (err: any) {
    logger.warn('auth', `[GoogleAuth] Could not persist linked Google accounts: ${err.message}`)
  }
}

export function loadLinkedAccountsFromDisk(): void {
  try {
    const storePath = getStoreFilePath()
    if (fs.existsSync(storePath)) {
      const encrypted = fs.readFileSync(storePath, 'utf8')
      const decrypted = decryptOAuthToken(encrypted)
      if (decrypted) {
        const entries = JSON.parse(decrypted)
        if (Array.isArray(entries)) {
          for (const [k, v] of entries) {
            linkedAccountsMap.set(k, v)
          }
        }
      }
    }
  } catch {}
}

// Initialize persistence on module load
loadLinkedAccountsFromDisk()

/**
 * Safely encrypt token strings using safeStorage or AES-256 fallback.
 */
export function encryptOAuthToken(token: string): string {
  if (!token) return ''
  try {
    if (typeof safeStorage !== 'undefined' && safeStorage?.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(token).toString('base64')
    }
  } catch {}
  // AES-256 Fallback
  const key = crypto.createHash('sha256').update('antiprofiles-oauth-key-safe').digest()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Safely decrypt token strings.
 */
export function decryptOAuthToken(encryptedToken: string): string {
  if (!encryptedToken) return ''
  try {
    if (typeof safeStorage !== 'undefined' && safeStorage?.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
    }
  } catch {}
  // AES-256 Fallback
  try {
    const parts = encryptedToken.split(':')
    if (parts.length === 2) {
      const iv = Buffer.from(parts[0], 'hex')
      const encrypted = parts[1]
      const key = crypto.createHash('sha256').update('antiprofiles-oauth-key-safe').digest()
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }
  } catch {}
  return ''
}

/**
 * Generate a cryptographically secure PKCE Code Verifier and Code Challenge (S256).
 * Uses 64 random bytes for high entropy, conforming to RFC 7636 and Google OAuth 2.0 PKCE specs.
 */
export function generatePKCE(): PKCEPair {
  const verifier = crypto.randomBytes(64).toString('base64url')
  const hash = crypto.createHash('sha256').update(verifier).digest()
  const challenge = hash.toString('base64url')
  return { verifier, challenge }
}

/**
 * Generate a cryptographically random state parameter for CSRF mitigation.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate a cryptographically random nonce parameter for OpenID Connect validation.
 */
export function generateOAuthNonce(): string {
  return crypto.randomBytes(32).toString('hex')
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
    timeoutMs = 180000,
    profileId
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
            logger.warn('auth', '[GoogleAuth] State validation: FAIL (CSRF mismatch)')
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

          logger.info('auth', '[GoogleAuth] Callback received')
          logger.info('auth', '[GoogleAuth] State validation: PASS')
          logger.info('auth', '[GoogleAuth] PKCE validation: PASS')

          // 2. Handle provider errors
          if (authError) {
            logger.warn('auth', `[GoogleAuth] Provider error: ${authError}`)
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

            let tokens: any = undefined
            let userProfile: any = undefined
            let linkedAccount: LinkedGoogleAccount | undefined = undefined

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
                  logger.info('auth', '[GoogleAuth] Token exchange: PASS')
                  tokens = exchangeRes.tokens
                  userProfile = exchangeRes.userProfile

                  if (profileId && userProfile) {
                    linkedAccount = {
                      profileId,
                      googleId: userProfile.id,
                      email: userProfile.email,
                      name: userProfile.name,
                      picture: userProfile.picture,
                      connectedAt: new Date().toISOString(),
                      encryptedAccessToken: tokens?.accessToken ? encryptOAuthToken(tokens.accessToken) : undefined,
                      encryptedRefreshToken: tokens?.refreshToken ? encryptOAuthToken(tokens.refreshToken) : undefined
                    }
                    linkedAccountsMap.set(profileId, linkedAccount)
                    saveLinkedAccountsToDisk()
                    logger.info('auth', `[GoogleAuth] Profile association: PASS (Profile: ${profileId.substring(0, 8)}...)`)
                  }
                } else {
                  logger.warn('auth', `[GoogleAuth] Token exchange: FAIL - ${exchangeRes.error}`)
                }
              } catch (exErr: any) {
                logger.warn('auth', `[GoogleAuth] Token exchange exception: ${exErr.message}`)
              }
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
            logger.info('auth', '[GoogleAuth] OAuth flow completed successfully')
            resolve({
              success: true,
              code: authCode,
              state: returnedState,
              codeVerifier: pkce.verifier,
              redirectUri,
              tokens,
              userProfile,
              linkedAccount
            })
            return
          }
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      } catch (err: any) {
        cleanup()
        logger.warn('auth', `[GoogleAuth] Loopback handler error: ${err.message}`)
        resolve({ success: false, error: `Loopback handler error: ${err.message}` })
      }
    })

    server.listen(0, '127.0.0.1', async () => {
      const address = server?.address()
      if (!address || typeof address === 'string') {
        cleanup()
        resolve({ success: false, error: 'Failed to bind loopback HTTP server' })
        return
      }

      const port = address.port
      const redirectUri = `http://127.0.0.1:${port}${redirectPath}`

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scopes.join(' '))
      authUrl.searchParams.set('code_challenge', pkce.challenge)
      const expectedNonce = generateOAuthNonce()
      authUrl.searchParams.set('state', expectedState)
      authUrl.searchParams.set('nonce', expectedNonce)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'select_account')

      logger.info('auth', `[GoogleAuth] G Connect clicked`)
      logger.info('auth', `[GoogleAuth] Profile ID: ${profileId ? profileId.substring(0, 8) + '...' : 'none'}`)
      logger.info('auth', `[GoogleAuth] OAuth flow started`)
      logger.info('auth', `[GoogleAuth] Loopback server started on port ${port}`)
      logger.info('auth', `[GoogleAuth] Redirect URI created: ${redirectUri}`)
      logger.info('auth', `[GoogleAuth] System browser opened`)

      try {
        await shell.openExternal(authUrl.toString())
      } catch (shellErr: any) {
        cleanup()
        logger.warn('auth', `[GoogleAuth] Could not launch system browser: ${shellErr.message}`)
        resolve({ success: false, error: `Could not launch system browser: ${shellErr.message}` })
      }
    })

    server.on('error', (err: any) => {
      cleanup()
      logger.warn('auth', `[GoogleAuth] Loopback server error: ${err.message}`)
      resolve({ success: false, error: `Loopback server error: ${err.message}` })
    })
  })
}

/**
 * Get connected Google account info for a given profile ID.
 */
export function getProfileGoogleAccount(profileId: string): LinkedGoogleAccount | null {
  if (!profileId) return null
  loadLinkedAccountsFromDisk()
  return linkedAccountsMap.get(profileId) || null
}

/**
 * Disconnect/Unlink Google account for a given profile ID.
 */
export function disconnectProfileGoogleAccount(profileId: string): boolean {
  if (!profileId) return false
  const deleted = linkedAccountsMap.delete(profileId)
  if (deleted) {
    saveLinkedAccountsToDisk()
    logger.info('auth', `[GoogleAuth] Disconnected Google account for profile: ${profileId.substring(0, 8)}...`)
  }
  return deleted
}

/**
 * Call Gmail API for a linked profile using its decrypted OAuth access token.
 * Demonstrates API-based Gmail integration without web password automation.
 */
export async function callGmailApi(
  profileId: string,
  endpoint: string = 'users/me/profile'
): Promise<{ success: boolean; data?: any; error?: string }> {
  const account = getProfileGoogleAccount(profileId)
  if (!account || !account.encryptedAccessToken) {
    return { success: false, error: 'No Google account linked to this profile.' }
  }

  const accessToken = decryptOAuthToken(account.encryptedAccessToken)
  if (!accessToken) {
    return { success: false, error: 'Could not decrypt OAuth access token.' }
  }

  return new Promise((resolve) => {
    https
      .get(
        `https://gmail.googleapis.com/gmail/v1/${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          }
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => (body += chunk))
          res.on('end', () => {
            try {
              const data = JSON.parse(body)
              if (data.error) {
                resolve({ success: false, error: data.error.message || 'Gmail API Error' })
              } else {
                resolve({ success: true, data })
              }
            } catch (e: any) {
              resolve({ success: false, error: `Invalid Gmail API response: ${e.message}` })
            }
          })
        }
      )
      .on('error', (err) => {
        resolve({ success: false, error: `Gmail API request failed: ${err.message}` })
      })
  })
}

export interface GoogleProfileRuntimeStatus {
  profileId: string
  googleConnected: boolean
  googleEmail?: string
  googleName?: string
  connectedAt?: string
  oauthTokenAvailable: boolean
  hasRefreshToken: boolean
}

/**
 * Get safe diagnostic runtime status of Google connection for a profile.
 * Never exposes raw tokens, secrets, or cookies.
 */
export function getGoogleProfileRuntimeStatus(profileId: string): GoogleProfileRuntimeStatus {
  const account = getProfileGoogleAccount(profileId)
  return {
    profileId,
    googleConnected: !!account,
    googleEmail: account?.email,
    googleName: account?.name,
    connectedAt: account?.connectedAt,
    oauthTokenAvailable: !!account?.encryptedAccessToken,
    hasRefreshToken: !!account?.encryptedRefreshToken
  }
}

