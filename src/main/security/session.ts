// ──────────────────────────────────────────────
// ProfileVault — Session & Security Authorization Manager
// ──────────────────────────────────────────────

import crypto from 'crypto'
import { User, UserDisplay } from '../database/models'
import { userRepo } from '../database/repositories/user.repo'

export interface UserSession {
  token: string
  userId: string
  createdAt: number
  expiresAt: number
}

class SessionManager {
  private sessions = new Map<string, UserSession>()
  private rateLimits = new Map<string, { count: number; firstAttempt: number }>()

  createSession(user: UserDisplay, customToken?: string): string {
    const token = customToken || crypto.randomBytes(32).toString('hex')
    const now = Date.now()
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000 // 7 days

    this.sessions.set(token, {
      token,
      userId: user.id,
      createdAt: now,
      expiresAt
    })

    // Update last login timestamp in DB
    try {
      userRepo.update(user.id, { lastLoginAt: new Date().toISOString() })
    } catch {}
    return token
  }

  registerSession(token: string, user: UserDisplay): void {
    if (!token || !user) return
    const now = Date.now()
    this.sessions.set(token, {
      token,
      userId: user.id,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000
    })
  }

  getSessionUser(token: string | undefined | null): UserDisplay | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (session) {
      if (Date.now() > session.expiresAt) {
        this.sessions.delete(token)
        return null
      }
      const user = userRepo.getDisplayById(session.userId)
      if (user) return user
    }

    // Fallback: If token is a JWT from Central Backend, decode userId
    try {
      if (token.includes('.')) {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
          const uid = payload.sub || payload.userId || payload.id
          if (uid) {
            let u = userRepo.getDisplayById(uid)
            if (!u && payload.email) {
              u = userRepo.getDisplayByEmail(payload.email)
            }
            if (u) {
              this.registerSession(token, u)
              return u
            }
          }
        }
      }
    } catch {}

    // Fallback: Check if there is only 1 active local user (single-tenant desktop mode)
    try {
      const all = userRepo.getAllDisplay()
      if (all.length === 1) {
        this.registerSession(token, all[0])
        return all[0]
      }
    } catch {}

    return null
  }

  destroySession(token: string): boolean {
    return this.sessions.delete(token)
  }

  destroyUserSessions(userId: string): void {
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.userId === userId) {
        this.sessions.delete(token)
      }
    }
  }

  /**
   * Rate limiting helper (e.g. 5 login/registration attempts per 60s per key).
   */
  checkRateLimit(key: string, maxAttempts = 10, windowMs = 60000): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = this.rateLimits.get(key)

    if (!entry || (now - entry.firstAttempt) > windowMs) {
      this.rateLimits.set(key, { count: 1, firstAttempt: now })
      return { allowed: true, remaining: maxAttempts - 1 }
    }

    if (entry.count >= maxAttempts) {
      return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: maxAttempts - entry.count }
  }
}

export const sessionManager = new SessionManager()

/**
 * Server-side authorization check:
 * Returns authenticated user if active & verified (or allows pending for verify-only actions).
 */
export function authorizeUser(token: string | undefined | null, options?: { allowUnverified?: boolean; requireAdmin?: boolean }): { user: UserDisplay | null; error?: string } {
  const user = sessionManager.getSessionUser(token)
  if (!user) {
    return { user: null, error: 'Authentication required. Please log in.' }
  }

  if (user.accountStatus === 'suspended') {
    return { user: null, error: 'Your account has been suspended. Please contact support.' }
  }

  if (!options?.allowUnverified && !user.emailVerified) {
    return { user: null, error: 'Email verification required before accessing browser profiles.' }
  }

  const role = (user.role || '').toLowerCase()
  const isAdmin = (role === 'admin' || role === 'super_admin')
  if (options?.requireAdmin && !isAdmin) {
    return { user: null, error: 'Access denied. Administrator permissions required.' }
  }

  return { user }
}
