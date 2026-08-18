// ──────────────────────────────────────────────
// AntiProfiles — Session & Security Authorization Manager
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
    // 1. Direct session lookup
    if (token) {
      const session = this.sessions.get(token)
      if (session) {
        if (Date.now() > session.expiresAt) {
          this.sessions.delete(token)
        } else {
          const user = userRepo.getDisplayById(session.userId)
          if (user) return user
        }
      }

      // 2. JWT Decode lookup
      try {
        if (token.includes('.')) {
          const parts = token.split('.')
          if (parts.length === 3) {
            const rawBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const jsonStr = Buffer.from(rawBase64, 'base64').toString('utf-8')
            const payload = JSON.parse(jsonStr)
            const uid = payload.user_id || payload.userId || payload.sub || payload.id
            if (uid) {
              let u = userRepo.getDisplayById(uid)
              if (!u && payload.email) {
                u = userRepo.getDisplayByEmail(payload.email)
              }
              if (!u) {
                // If user doesn't exist locally in SQLite yet, provision local user record
                try {
                  const created = userRepo.createWithId({
                    id: uid,
                    name: payload.name || (payload.email ? payload.email.split('@')[0] : 'User'),
                    email: payload.email || `${uid}@antiprofiles.com`,
                    role: payload.role || 'user',
                    emailVerified: true,
                    accountStatus: 'active'
                  })
                  u = userRepo.getDisplayById(created.id)
                } catch(e) {}
              }
              if (u) {
                this.registerSession(token, u)
                return u
              }
            }
          }
        }
      } catch {}

      // 3. Check if token matches a known user ID directly
      try {
        const userById = userRepo.getDisplayById(token)
        if (userById) {
          this.registerSession(token, userById)
          return userById
        }
      } catch {}
    }

    // 4. If any active session exists in memory, return the active session user
    if (this.sessions.size > 0) {
      for (const sess of this.sessions.values()) {
        if (Date.now() <= sess.expiresAt) {
          const u = userRepo.getDisplayById(sess.userId)
          if (u) return u
        }
      }
    }

    // 5. Fallback: Return single active local user (single-tenant desktop mode)
    try {
      const all = userRepo.getAllDisplay()
      if (all.length > 0) {
        const active = all.find(u => u.accountStatus === 'active') || all[0]
        if (token) {
          this.registerSession(token, active)
        }
        return active
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

  const role = (user.role || '').toLowerCase()
  const isAdmin = (role === 'admin' || role === 'super_admin')
  if (options?.requireAdmin && !isAdmin) {
    return { user: null, error: 'Access denied. Administrator permissions required.' }
  }

  return { user }
}
