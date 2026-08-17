// ──────────────────────────────────────────────
// AntiProfiles — Automation API Server
// ──────────────────────────────────────────────

import express from 'express'
import type { Server } from 'http'
import { validateApiToken, getOrCreateApiToken } from '../security/api-auth'
import { profileRepo } from '../database/repositories/profile.repo'
import { profileManager } from '../browser/profile-manager'
import { processTracker } from '../browser/process-tracker'
import { logger } from '../logging/logger'

let server: Server | null = null

/**
 * Auth middleware — requires Bearer token.
 */
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
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
      res.json({ success: true, pid: result.pid, wsEndpoint: result.wsEndpoint })
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
