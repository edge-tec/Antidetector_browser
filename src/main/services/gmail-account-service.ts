// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Gmail Account & Automation Service Boundary (RFC 8252 Compliant)
// Exposes a decoupled, production-grade Gmail API service boundary
// separating browser profile emulation from backend email automation.
// ──────────────────────────────────────────────────────────────────

import https from 'https'
import { logger } from '../logging/logger'
import {
  getProfileGoogleAccount,
  disconnectProfileGoogleAccount,
  getGoogleClientId,
  getGoogleClientSecret,
  encryptOAuthToken,
  decryptOAuthToken,
  saveLinkedAccountsToDisk,
  LinkedGoogleAccount
} from '../security/google-oauth-loopback'

export interface GmailMessageSummary {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  historyId?: string
  internalDate?: string
}

export interface GmailSendMessagePayload {
  to: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  threadId?: string
}

export class GmailAccountService {
  /**
   * Get connected Google/Gmail account for a profile.
   */
  public static getAccount(profileId: string): LinkedGoogleAccount | null {
    return getProfileGoogleAccount(profileId)
  }

  /**
   * Checks whether a profile has a valid, authorized Gmail account.
   */
  public static isAccountConnected(profileId: string): boolean {
    const account = this.getAccount(profileId)
    return !!(account && account.encryptedAccessToken)
  }

  /**
   * Refreshes the OAuth access token for a connected Gmail account using its refresh token.
   */
  public static async refreshAuthorization(profileId: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    const account = this.getAccount(profileId)
    if (!account || !account.encryptedRefreshToken) {
      return { success: false, error: 'No refresh token available for profile.' }
    }

    const refreshToken = decryptOAuthToken(account.encryptedRefreshToken)
    if (!refreshToken) {
      return { success: false, error: 'Failed to decrypt refresh token.' }
    }

    return new Promise((resolve) => {
      const postData = new URLSearchParams({
        client_id: getGoogleClientId(),
        client_secret: getGoogleClientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }).toString()

      const req = https.request(
        {
          hostname: 'oauth2.googleapis.com',
          path: '/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              if (parsed.access_token) {
                account.encryptedAccessToken = encryptOAuthToken(parsed.access_token)
                account.expiresAt = Date.now() + (parsed.expires_in || 3600) * 1000
                account.updatedAt = new Date().toISOString()
                saveLinkedAccountsToDisk()
                logger.info('auth', `[GmailAccountService] Refreshed OAuth token for profile: ${profileId.substring(0, 8)}...`)
                resolve({ success: true, accessToken: parsed.access_token })
              } else {
                resolve({ success: false, error: parsed.error_description || 'Token refresh failed.' })
              }
            } catch (err: any) {
              resolve({ success: false, error: err.message })
            }
          })
        }
      )

      req.on('error', (err) => resolve({ success: false, error: err.message }))
      req.write(postData)
      req.end()
    })
  }

  /**
   * Helper: Get a valid, non-expired access token for API operations.
   */
  private static async getValidAccessToken(profileId: string): Promise<string | null> {
    const account = this.getAccount(profileId)
    if (!account) return null

    // If expired or about to expire in next 60s, refresh
    if (Date.now() >= (account.expiresAt - 60000)) {
      const refreshRes = await this.refreshAuthorization(profileId)
      if (refreshRes.success && refreshRes.accessToken) {
        return refreshRes.accessToken
      }
    }

    return decryptOAuthToken(account.encryptedAccessToken)
  }

  /**
   * Lists messages in the connected Gmail mailbox.
   */
  public static async listMessages(
    profileId: string,
    options: { maxResults?: number; query?: string } = {}
  ): Promise<{ success: boolean; messages?: GmailMessageSummary[]; error?: string }> {
    const token = await this.getValidAccessToken(profileId)
    if (!token) {
      return { success: false, error: 'Unauthorized: No active Google account linked.' }
    }

    return new Promise((resolve) => {
      const queryParams = new URLSearchParams()
      if (options.maxResults) queryParams.set('maxResults', String(options.maxResults))
      if (options.query) queryParams.set('q', options.query)

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : ''

      const req = https.request(
        {
          hostname: 'gmail.googleapis.com',
          path: `/gmail/v1/users/me/messages${qs}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              if (res.statusCode && res.statusCode < 300) {
                resolve({ success: true, messages: parsed.messages || [] })
              } else {
                resolve({ success: false, error: parsed.error?.message || 'Failed to list messages.' })
              }
            } catch (err: any) {
              resolve({ success: false, error: err.message })
            }
          })
        }
      )

      req.on('error', (err) => resolve({ success: false, error: err.message }))
      req.end()
    })
  }

  /**
   * Retrieves a single message by ID.
   */
  public static async getMessage(profileId: string, messageId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const token = await this.getValidAccessToken(profileId)
    if (!token) {
      return { success: false, error: 'Unauthorized: No active Google account linked.' }
    }

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'gmail.googleapis.com',
          path: `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              if (res.statusCode && res.statusCode < 300) {
                resolve({ success: true, data: parsed })
              } else {
                resolve({ success: false, error: parsed.error?.message || 'Failed to fetch message.' })
              }
            } catch (err: any) {
              resolve({ success: false, error: err.message })
            }
          })
        }
      )

      req.on('error', (err) => resolve({ success: false, error: err.message }))
      req.end()
    })
  }

  /**
   * Sends an email via Gmail API using RFC 2822 formatting.
   */
  public static async sendMessage(
    profileId: string,
    payload: GmailSendMessagePayload
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = await this.getValidAccessToken(profileId)
    if (!token) {
      return { success: false, error: 'Unauthorized: No active Google account linked.' }
    }

    const utf8Subject = `=?utf-8?B?${Buffer.from(payload.subject).toString('base64')}?=`
    const messageParts = [
      `To: ${payload.to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      payload.bodyText || payload.bodyHtml || ''
    ]
    const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64url')

    return new Promise((resolve) => {
      const postBody = JSON.stringify({
        raw: rawMessage,
        ...(payload.threadId ? { threadId: payload.threadId } : {})
      })

      const req = https.request(
        {
          hostname: 'gmail.googleapis.com',
          path: '/gmail/v1/users/me/messages/send',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postBody)
          }
        },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              if (res.statusCode && res.statusCode < 300) {
                resolve({ success: true, messageId: parsed.id })
              } else {
                resolve({ success: false, error: parsed.error?.message || 'Failed to send message.' })
              }
            } catch (err: any) {
              resolve({ success: false, error: err.message })
            }
          })
        }
      )

      req.on('error', (err) => resolve({ success: false, error: err.message }))
      req.write(postBody)
      req.end()
    })
  }

  /**
   * Disconnects / Unlinks a Gmail account for a profile.
   */
  public static disconnectAccount(profileId: string): boolean {
    return disconnectProfileGoogleAccount(profileId)
  }
}
