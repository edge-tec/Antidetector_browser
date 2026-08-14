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

  createSession(user: UserDisplay): string {
    const token = crypto.randomBytes(32).toString('hex')
    const now = Date.now()
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000 // 7 days

    this.sessions.set(token, {
      token,
      userId: user.id,
      createdAt: now,
      expiresAt
    })

    // Update last login timestamp in DB
    userRepo.update(user.id, { lastLoginAt: new Date().toISOString() })
    return token
  }

  getSessionUser(token: string | undefined | null): UserDisplay | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token)
      return null
    }

    const user = userRepo.getDisplayById(session.userId)
    if (!user) {
      this.sessions.delete(token)
      return null
    }

    return user
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

  if (options?.requireAdmin && user.role !== 'admin') {
    return { user: null, error: 'Access denied. Administrator permissions required.' }
  }

  return { user }
}
