// ──────────────────────────────────────────────
// AntiProfiles — Central Real-Time Synchronization Engine (Cross-Platform)
// ──────────────────────────────────────────────

import { BrowserWindow, app } from 'electron'
import http from 'http'
import https from 'https'
import { URL } from 'url'
import { logger } from '../logging/logger'
import { processTracker } from '../browser/process-tracker'

export type SyncConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'syncing' | 'error'

export interface AuthoritativeUserState {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
  authVersion: number
  accountStatus: string
  isAuthorized: boolean
  subscription?: any
  limits?: Record<string, any>
  lastSyncAt: string
}

class RealtimeSyncService {
  private sessionToken: string | null = null
  private serverUrl: string = 'https://antiprofiles.com'
  private status: SyncConnectionStatus = 'disconnected'
  private activeRequest: http.ClientRequest | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private lastEventId: string | null = null
  private lastSyncTime: number = 0
  private lastAuthVersion: number = 1
  private cachedState: AuthoritativeUserState | null = null
  private isShuttingDown = false

  constructor() {
    // Monitor system sleep / resume
    try {
      const { powerMonitor } = require('electron')
      if (powerMonitor) {
        powerMonitor.on('resume', () => {
          logger.info('sync', '[SyncService] System resumed from sleep, refreshing connection & state...')
          this.reconnect(true)
        })
      }
    } catch {}
  }

  /**
   * Set Central Server URL (defaults to production aaPanel URL).
   */
  public setServerUrl(url: string): void {
    this.serverUrl = url.replace(/\/+$/, '')
  }

  public getServerUrl(): string {
    return this.serverUrl
  }

  /**
   * Start Real-Time Sync with User Session Token.
   */
  public async startSync(token: string): Promise<void> {
    if (!token) return
    this.sessionToken = token
    this.reconnectAttempts = 0
    this.isShuttingDown = false

    logger.info('sync', '[SyncService] Starting real-time synchronization with central server...')
    this.setStatus('connecting')

    // Initial authoritative synchronization
    const authState = await this.resyncAuthoritativeState()
    if (!authState && (this.status === 'error' || this.status === 'disconnected')) {
      logger.info('sync', '[SyncService] Central server unreachable or local offline session. Running in offline mode.')
      this.setStatus('disconnected')
      return
    }

    // Establish persistent SSE event stream
    this.connectStream()
  }

  /**
   * Stop Real-Time Sync (e.g. on user logout).
   */
  public stopSync(): void {
    this.isShuttingDown = true
    this.sessionToken = null
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.activeRequest) {
      this.activeRequest.destroy()
      this.activeRequest = null
    }
    this.setStatus('disconnected')
    this.cachedState = null
    logger.info('sync', '[SyncService] Synchronization stopped.')
  }

  /**
   * Get Current Status & Authoritative Cache.
   */
  public getStatus(): {
    status: SyncConnectionStatus
    serverUrl: string
    lastSyncTime: string
    authVersion: number
    cachedState: AuthoritativeUserState | null
  } {
    return {
      status: this.status,
      serverUrl: this.serverUrl,
      lastSyncTime: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : 'Never',
      authVersion: this.lastAuthVersion,
      cachedState: this.cachedState
    }
  }

  /**
   * Check if user currently has a specific granular permission.
   */
  public hasPermission(permission: string): boolean {
    if (!this.cachedState) return false
    const perms = this.cachedState.permissions || []
    if (perms.includes('*')) return true
    if (perms.includes(permission)) return true

    const parts = permission.split('.')
    if (parts.length === 2 && perms.includes(`${parts[0]}.*`)) {
      return true
    }
    return false
  }

  /**
   * Fetch authoritative user and authorization state from Central Backend.
   */
  public async resyncAuthoritativeState(): Promise<AuthoritativeUserState | null> {
    if (!this.sessionToken) return null

    this.setStatus('syncing')
    try {
      const url = `${this.serverUrl}/api/auth/authorization`
      const data = await this.httpGetJson(url, this.sessionToken)

      if (data && data.success && data.user) {
        const u = data.user
        const auth = data.authorization || {}

        this.lastAuthVersion = (auth.authVersion || u.authVersion || 1)
        this.lastSyncTime = Date.now()

        const newState: AuthoritativeUserState = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: auth.role || u.role || 'user',
          permissions: auth.permissions || u.permissions || [],
          authVersion: this.lastAuthVersion,
          accountStatus: auth.accountStatus || u.accountStatus || 'active',
          isAuthorized: auth.isAuthorized !== false && u.accountStatus === 'active',
          subscription: data.license?.plan || null,
          limits: data.license?.limits || {},
          lastSyncAt: new Date().toISOString()
        }

        this.cachedState = newState

        // Check if account was suspended or disabled
        if (!newState.isAuthorized || newState.accountStatus === 'suspended' || newState.accountStatus === 'disabled') {
          logger.warn('sync', `[SyncService] User ${u.email} account is ${newState.accountStatus}. Revoking access immediately.`)
          await this.handleSessionRevoked('Account has been suspended or disabled by administrator.')
          return null
        }

        logger.info('sync', `[SyncService] Authoritative state synced: Role=${newState.role}, Version=${newState.authVersion}, Perms=${newState.permissions.length}`)
        this.broadcastToAllWindows('auth:state-updated', newState)
        this.setStatus('connected')
        return newState
      } else if (data && data.sessionRevoked) {
        await this.handleSessionRevoked(data.error || 'Session revoked by administrator.')
        return null
      } else {
        throw new Error(data?.error || 'Failed to fetch authoritative authorization state.')
      }
    } catch (err: any) {
      logger.warn('sync', `[SyncService] Authoritative sync failed: ${err.message}`)
      if (this.status !== 'disconnected') {
        this.setStatus('disconnected')
      }
      return null
    }
  }

  /**
   * Connect to Server-Sent Events (SSE) Stream.
   */
  private connectStream(): void {
    if (this.isShuttingDown || !this.sessionToken) return

    if (this.activeRequest) {
      this.activeRequest.destroy()
      this.activeRequest = null
    }

    try {
      const streamUrl = new URL(`${this.serverUrl}/api/events/stream`)
      streamUrl.searchParams.set('token', this.sessionToken)
      streamUrl.searchParams.set('client', 'desktop')
      streamUrl.searchParams.set('platform', process.platform)
      if (this.lastEventId) {
        streamUrl.searchParams.set('last_event_id', this.lastEventId)
      }

      const isHttps = streamUrl.protocol === 'https:'
      const client = isHttps ? https : http

      const options: https.RequestOptions = {
        hostname: streamUrl.hostname,
        port: streamUrl.port || (isHttps ? 443 : 80),
        path: streamUrl.pathname + streamUrl.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'User-Agent': `AntiProfiles-Desktop/${app.getVersion()} (${process.platform})`
        },
        timeout: 0 // Keep-alive stream
      }

      const req = client.request(options, (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          logger.warn('sync', `[SyncService] Central stream unauthorized (${res.statusCode}) - operating in offline/standalone mode.`)
          this.setStatus('disconnected')
          return
        }

        if (res.statusCode !== 200) {
          logger.warn('sync', `[SyncService] SSE stream HTTP status ${res.statusCode}`)
          this.scheduleReconnect(false, false)
          return
        }

        this.setStatus('connected')
        this.reconnectAttempts = 0
        logger.info('sync', '[SyncService] Connected to Central Real-Time Event Stream.')

        let buffer = ''

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8')
          const lines = buffer.split(/\r?\n\r?\n/)
          buffer = lines.pop() || '' // Keep trailing incomplete block in buffer

          for (const block of lines) {
            this.parseSseBlock(block.trim())
          }
        })

        res.on('end', () => {
          logger.info('sync', '[SyncService] SSE connection ended by server, renewing stream cycle...')
          this.scheduleReconnect(false, true)
        })

        res.on('error', (err) => {
          logger.warn('sync', `[SyncService] SSE connection error: ${err.message}`)
          this.scheduleReconnect(false, false)
        })
      })

      req.on('error', (err) => {
        logger.warn('sync', `[SyncService] SSE request error: ${err.message}`)
        this.scheduleReconnect(false, false)
      })

      this.activeRequest = req
      req.end()
    } catch (err: any) {
      logger.error('sync', `[SyncService] Failed to initiate stream: ${err.message}`)
      this.scheduleReconnect()
    }
  }

  /**
   * Parse incoming SSE block (event, data, id).
   */
  private async parseSseBlock(block: string): Promise<void> {
    if (!block) return

    const lines = block.split(/\r?\n/)
    let eventType = 'message'
    let dataStr = ''
    let eventId: string | null = null

    for (const line of lines) {
      if (line.startsWith(':')) {
        // Comment / Ping
        continue
      }
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataStr = line.slice(5).trim()
      } else if (line.startsWith('id:')) {
        eventId = line.slice(3).trim()
      }
    }

    if (eventId) {
      this.lastEventId = eventId
    }

    if (!dataStr && eventType === 'message') return

    let parsedPayload: any = {}
    try {
      parsedPayload = JSON.parse(dataStr)
    } catch {
      parsedPayload = { raw: dataStr }
    }

    logger.info('sync', `[SyncEvent] Received real-time event: "${eventType}" (ID: ${eventId || 'none'})`)

    // Handle Standard Synchronized Events
    switch (eventType) {
      case 'user.role.updated':
      case 'user.permissions.updated':
      case 'user.updated':
        logger.info('sync', `[SyncEvent] Administrative update received (${eventType}), resyncing state...`)
        await this.resyncAuthoritativeState()
        break

      case 'session.revoked':
      case 'user.status.updated':
        if (parsedPayload.status === 'suspended' || parsedPayload.status === 'disabled' || eventType === 'session.revoked') {
          logger.warn('sync', `[SyncEvent] Critical account update: ${parsedPayload.reason || 'Revoked'}`)
          await this.handleSessionRevoked(parsedPayload.reason || 'Your account access has been revoked or restricted by an administrator.')
        } else {
          await this.resyncAuthoritativeState()
        }
        break

      case 'subscription.updated':
      case 'subscription.expired':
      case 'device.limit.updated':
      case 'license.updated':
      case 'payment.completed':
        logger.info('sync', `[SyncEvent] Subscription/Payment update (${eventType}), refreshing license & feature quotas...`)
        if (eventType === 'payment.completed' && parsedPayload) {
          try {
            const { affiliateService } = require('./affiliate.service')
            affiliateService.processPaymentCommission({
              userId: parsedPayload.user_id || parsedPayload.userId,
              amount: parseFloat(parsedPayload.amount || '0'),
              paymentId: parsedPayload.payment_id || parsedPayload.transaction_id || parsedPayload.id,
              planName: parsedPayload.plan_name || parsedPayload.plan_id
            })
          } catch (e: any) {
            logger.warn('sync', `Failed to process affiliate commission on payment: ${e.message}`)
          }
        }
        await this.resyncAuthoritativeState()
        this.broadcastToAllWindows('payment:completed', parsedPayload)
        this.broadcastToAllWindows('sync:realtime-event', { eventType, payload: parsedPayload, eventId })
        break

      case 'reconnect':
        logger.info('sync', '[SyncEvent] Server requested reconnect cycle.')
        this.reconnect(false)
        break

      case 'connected':
        this.setStatus('connected')
        if (parsedPayload.authVersion && parsedPayload.authVersion > this.lastAuthVersion) {
          await this.resyncAuthoritativeState()
        }
        break;

      case 'profile.created':
      case 'profile.updated':
      case 'profile.deleted':
      case 'profile.started':
      case 'profile.stopped':
      case 'profile.status.changed':
        logger.info('sync', `[SyncEvent] Profile event received (${eventType}), notifying renderers...`)
        this.broadcastToAllWindows('profiles:status-changed', parsedPayload)
        this.broadcastToAllWindows('sync:realtime-event', { eventType, payload: parsedPayload, eventId })
        break

      case 'app.update.published':
      case 'app.release.published':
      case 'software.update.available':
        logger.info('sync', `[SyncEvent] 🚀 Real-Time Software Update Published Event received! Version: ${parsedPayload.version || 'unknown'}`)
        try {
          if (parsedPayload && parsedPayload.version) {
            const { updaterService } = require('./updater.service')
            updaterService.saveVersion({
              version: parsedPayload.version,
              release_title: parsedPayload.release_title || parsedPayload.title || `AntiProfiles v${parsedPayload.version}`,
              release_notes: parsedPayload.release_notes || parsedPayload.notes || 'Performance enhancements and bug fixes.',
              status: 'published',
              min_supported_version: parsedPayload.min_supported_version || '1.0.0',
              force_update: parsedPayload.force_update ? 1 : 0,
              win_download_url: parsedPayload.win_download_url,
              win_file_size: parsedPayload.win_file_size,
              win_sha256: parsedPayload.win_sha256,
              mac_intel_download_url: parsedPayload.mac_intel_download_url,
              mac_intel_file_size: parsedPayload.mac_intel_file_size,
              mac_intel_sha256: parsedPayload.mac_intel_sha256,
              mac_arm_download_url: parsedPayload.mac_arm_download_url,
              mac_arm_file_size: parsedPayload.mac_arm_file_size,
              mac_arm_sha256: parsedPayload.mac_arm_sha256,
              linux_download_url: parsedPayload.linux_download_url,
              linux_file_size: parsedPayload.linux_file_size,
              linux_sha256: parsedPayload.linux_sha256,
              published_at: parsedPayload.published_at || new Date().toISOString()
            }, 'remote_admin')
          }
        } catch (e: any) {
          logger.warn('sync', `Failed to sync remote software release: ${e.message}`)
        }
        this.broadcastToAllWindows('ui:software-update-available', parsedPayload)
        this.broadcastToAllWindows('sync:realtime-event', { eventType, payload: parsedPayload, eventId })
        break

      case 'error':
        logger.warn('sync', `[SyncEvent] Received error from stream: ${parsedPayload?.error || dataStr}`)
        if (parsedPayload?.error?.includes('token') || parsedPayload?.error?.includes('expired') || parsedPayload?.error?.includes('required')) {
          logger.info('sync', '[SyncService] Local or unverified session token. Operating in offline mode.')
          this.setStatus('disconnected')
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
          return
        }
        break

      default:
        // Broadcast generic event to all renderers
        this.broadcastToAllWindows('sync:realtime-event', { eventType, payload: parsedPayload, eventId })
        break
    }
  }

  /**
   * Schedule automatic reconnection with exponential backoff.
   */
  private scheduleReconnect(forceResync = false, isCleanCycle = false): void {
    if (this.isShuttingDown || !this.sessionToken) return

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)

    // Clean cycle (e.g. server ended 45s loop) - reconnect smoothly without error state
    if (isCleanCycle && this.status === 'connected') {
      this.reconnectAttempts = 0
      this.reconnectTimer = setTimeout(() => {
        if (this.isShuttingDown || !this.sessionToken) return
        this.connectStream()
      }, 500)
      return
    }

    this.reconnectAttempts++

    // After 3 failed attempts, back off gracefully to Offline state
    // Prevents endless "Reconnecting..." spinner and UI annoyance
    if (this.reconnectAttempts > 3) {
      logger.info('sync', '[SyncService] Central connection unavailable after retries. Operating in offline mode.')
      this.setStatus('disconnected')
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts = 0
        this.connectStream()
      }, 30000) // quiet background retry after 30s
      return
    }

    const delay = Math.min(1000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 4)), 6000)

    // Only broadcast 'reconnecting' status if persistent (>1 failed attempt)
    if (this.reconnectAttempts > 1) {
      this.setStatus('reconnecting')
    }

    this.reconnectTimer = setTimeout(async () => {
      if (this.isShuttingDown || !this.sessionToken) return
      logger.info('sync', `[SyncService] Reconnecting SSE stream (Attempt #${this.reconnectAttempts})...`)
      if (forceResync) {
        await this.resyncAuthoritativeState()
      }
      this.connectStream()
    }, delay)
  }

  /**
   * Reconnect immediately.
   */
  public async reconnect(forceResync = true): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectAttempts = 0
    if (forceResync) {
      await this.resyncAuthoritativeState()
    }
    this.connectStream()
  }

  /**
   * Handle Session Revocation (Lock desktop app, stop browser instances, return to login).
   */
  private async handleSessionRevoked(reason: string): Promise<void> {
    logger.warn('sync', `[SyncService] Revoking session: ${reason}`)

    // 1. Gracefully stop all active running profiles
    try {
      await processTracker.stopAll()
    } catch (e: any) {
      logger.error('sync', `Failed to stop running profiles: ${e.message}`)
    }

    // 2. Stop sync connection
    this.stopSync()

    // 3. Broadcast to UI to navigate to LoginPage
    this.broadcastToAllWindows('auth:session-revoked', { reason })
  }

  /**
   * Helper to set and broadcast connection status.
   */
  private setStatus(newStatus: SyncConnectionStatus): void {
    this.status = newStatus
    this.broadcastToAllWindows('sync:status-changed', {
      status: this.status,
      serverUrl: this.serverUrl,
      lastSyncTime: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : 'Never',
      authVersion: this.lastAuthVersion
    })
  }

  /**
   * Broadcast message to all active Electron Renderer windows.
   */
  private broadcastToAllWindows(channel: string, payload: any): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed() && win.webContents) {
        win.webContents.send(channel, payload)
      }
    }
  }

  /**
   * Internal HTTP GET JSON helper with Bearer authentication.
   */
  private httpGetJson(urlString: string, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlString)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': `AntiProfiles-Desktop/${app.getVersion()} (${process.platform})`
          },
          timeout: 10000
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              resolve(parsed)
            } catch (err) {
              reject(new Error(`Invalid JSON response: ${data.slice(0, 100)}`))
            }
          })
        }
      )

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Connection timed out'))
      })
      req.end()
    })
  }
}

export const syncService = new RealtimeSyncService()
