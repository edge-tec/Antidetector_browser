// ──────────────────────────────────────────────
// AntiProfiles — Automation API Server
// ──────────────────────────────────────────────

import express from 'express'
import type { Server } from 'http'
import { validateApiToken, getOrCreateApiToken } from '../security/api-auth'
import { profileRepo } from '../database/repositories/profile.repo'
import { subscriptionRepo } from '../database/repositories/subscription.repo'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { profileManager } from '../browser/profile-manager'
import { processTracker } from '../browser/process-tracker'
import { logger } from '../logging/logger'

let server: Server | null = null

// In-memory rate limiting state per minute
const rateLimitState = {
  count: 0,
  resetTime: 0
}

/**
 * Auth & DNS Rebinding protection middleware.
 * Verifies Host header is strictly localhost/127.0.0.1, requires valid Bearer token,
 * and enforces Plan Tier API permissions and Rate Limits.
 */
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // DNS Rebinding Protection: Verify Host header
  const host = req.headers.host || ''
  const hostname = host.split(':')[0]
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '::1') {
    logger.warn('api', `DNS rebinding or unauthorized Host header detected: ${host}`)
    res.status(403).json({ error: 'Access denied. Invalid Host header.' })
    return
  }

  // Loopback IP Protection
  const remoteIp = req.socket.remoteAddress || ''
  if (!remoteIp.includes('127.0.0.1') && !remoteIp.includes('::1') && !remoteIp.includes('::ffff:127.0.0.1')) {
    logger.warn('api', `Non-loopback API connection rejected: ${remoteIp}`)
    res.status(403).json({ error: 'Access denied. Only loopback connections permitted.' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Use Bearer token.' })
    return
  }

  const token = authHeader.substring(7)
  if (!validateApiToken(token)) {
    logger.warn('api', `Unauthorized API access attempt from ${req.ip}`)
    res.status(403).json({ error: 'Invalid API token.' })
    return
  }

  // ── Plan Permission Check: Enforce Tiered API Access ──
  const license = subscriptionRepo.getActiveUserLicense()
  const apiAccess = license?.features?.api_access || 'none'
  const isApiAllowed = license?.features?.has_api || false

  if (!isApiAllowed || apiAccess === 'none') {
    logger.warn('api', `API access attempt rejected on plan "${license?.plan?.name || 'Free'}"`)
    res.status(403).json({
      success: false,
      error: 'Automation API is not included in the Free plan. Upgrade to Starter ($19/mo) or higher to unlock API automation.',
      lockedFeature: 'api_access',
      minPlan: 'Starter ($19/mo)',
      upgradeUrl: '#pricing'
    })
    return
  }

  // ── Rate Limiting (Starter: 60/min, Pro: 300/min, Business: Unlimited) ──
  const now = Date.now()
  const windowMs = 60 * 1000
  if (!rateLimitState.resetTime || now > rateLimitState.resetTime) {
    rateLimitState.count = 0
    rateLimitState.resetTime = now + windowMs
  }
  rateLimitState.count++

  const maxReqPerMin = apiAccess === 'basic' ? 60 : apiAccess === 'full' ? 300 : 100000
  if (rateLimitState.count > maxReqPerMin) {
    res.status(429).json({
      success: false,
      error: `API rate limit exceeded (${maxReqPerMin} req/min on ${license?.plan?.name || 'Starter'} plan). Upgrade to Professional or Business for higher limits.`,
      minPlan: 'Professional ($49/mo)'
    })
    return
  }

  next()
}

/**
 * Start the automation API server.
 */
export function startApiServer(port: number = 37100): void {
  if (server) {
    logger.warn('api', 'API server is already running')
    return
  }

  const app = express()
  app.use(express.json())
  app.use(authMiddleware)

  // ── Health Check ──
  app.get('/api/v1/status', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      runningProfiles: processTracker.getRunningCount()
    })
  })

  // ── List Profiles ──
  app.get('/api/v1/profiles', (req, res) => {
    try {
      const search = req.query.search as string | undefined
      const profiles = profileRepo.getAll(search)
      res.json({ profiles })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Get Profile ──
  app.get('/api/v1/profiles/:id', (req, res) => {
    try {
      const profile = profileRepo.getById(req.params.id)
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      res.json({ profile })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Create Profile ──
  app.post('/api/v1/profiles', (req, res) => {
    try {
      if (!req.body.name) {
        res.status(400).json({ error: 'Profile name is required' })
        return
      }

      // Quota check
      const license = subscriptionRepo.getActiveUserLicense()
      const maxAllowed = license?.limits?.profiles || 3
      const currentCount = profileRepo.getAll().length
      if (currentCount >= maxAllowed) {
        res.status(403).json({
          error: `Profile limit reached (${currentCount}/${maxAllowed}). Upgrade your plan to create more profiles.`,
          minPlan: 'Starter / Professional',
          upgradeUrl: '#pricing'
        })
        return
      }

      // Proxy check
      if (req.body.proxyId) {
        const proxy = proxyRepo.getById(req.body.proxyId)
        if (proxy && proxy.type !== 'direct') {
          const reqType = proxy.type.toLowerCase()
          if (license?.features?.allowed_proxy_types && !license.features.allowed_proxy_types.includes(reqType)) {
            res.status(403).json({
              error: `Proxy type "${reqType.toUpperCase()}" requires Starter plan ($19/mo) or higher. Your Free plan includes Basic HTTP proxy support only.`,
              minPlan: 'Starter ($19/mo)',
              upgradeUrl: '#pricing'
            })
            return
          }
        }
      }

      const profile = profileManager.createProfile(req.body)
      logger.info('api', `Profile created via API: "${profile.name}"`)
      res.status(201).json({ profile })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Update Profile ──
  app.put('/api/v1/profiles/:id', (req, res) => {
    try {
      const profile = profileRepo.update(req.params.id, req.body)
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      res.json({ profile })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Delete Profile ──
  app.delete('/api/v1/profiles/:id', async (req, res) => {
    try {
      await profileManager.deleteProfile(req.params.id)
      logger.info('api', `Profile deleted via API: ${req.params.id}`)
      res.json({ success: true })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Start Profile ──
  app.post('/api/v1/profiles/:id/start', async (req, res) => {
    try {
      const result = await profileManager.startProfile(req.params.id)
      logger.info('api', `Profile started via API: ${req.params.id}`)

      const license = subscriptionRepo.getActiveUserLicense()
      const hasDriverApi = license?.features?.has_driver_api ?? true

      res.json({
        success: true,
        pid: result.pid,
        ...(hasDriverApi
          ? { wsEndpoint: result.wsEndpoint }
          : {
              driverNotice: 'Driver API (CDP wsEndpoint for Puppeteer/Selenium) requires Professional plan ($49/mo) or higher.'
            })
      })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Stop Profile ──
  app.post('/api/v1/profiles/:id/stop', async (req, res) => {
    try {
      await profileManager.stopProfile(req.params.id)
      logger.info('api', `Profile stopped via API: ${req.params.id}`)
      res.json({ success: true })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Profile Status ──
  app.get('/api/v1/profiles/:id/status', (req, res) => {
    try {
      const profile = profileRepo.getById(req.params.id)
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      const processInfo = processTracker.getInfo(req.params.id)
      res.json({
        profileId: profile.id,
        status: profile.status,
        isRunning: processTracker.isRunning(req.params.id),
        ...(processInfo ? {
          pid: processInfo.pid,
          wsEndpoint: processInfo.wsEndpoint,
          startedAt: processInfo.startedAt.toISOString()
        } : {})
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('api', `Unhandled API error: ${err.message}`)
    res.status(500).json({ error: 'Internal server error' })
  })

  // Bind to localhost only
  server = app.listen(port, '127.0.0.1', () => {
    logger.info('api', `Automation API started on http://127.0.0.1:${port}`)
  })

  server.on('error', (err: Error) => {
    logger.error('api', `API server error: ${err.message}`)
    server = null
  })
}

/**
 * Stop the automation API server.
 */
export function stopApiServer(): void {
  if (server) {
    server.close()
    server = null
    logger.info('api', 'Automation API stopped')
  }
}

/**
 * Check if the API server is running.
 */
export function isApiRunning(): boolean {
  return server !== null
}

/**
 * Get the API token (for display in UI).
 */
export function getApiToken(): string {
  return getOrCreateApiToken()
}
