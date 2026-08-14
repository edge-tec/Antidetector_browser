// ──────────────────────────────────────────────
// ProfileVault — Email Verification Token Repository
// ──────────────────────────────────────────────

import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../connection'
import { EmailVerificationToken, EmailVerificationTokenRow } from '../models'

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export class TokenRepository {
  createToken(userId: string, plainToken: string, ttlHours = 24): EmailVerificationToken {
    const db = getDatabase()
    const id = uuidv4()
    const tokenHash = hashToken(plainToken)

    const expiresAtDate = new Date()
    expiresAtDate.setHours(expiresAtDate.getHours() + ttlHours)
    const expiresAt = expiresAtDate.toISOString()

    // Invalidate prior unused tokens for this user
    this.invalidateUserTokens(userId)

    db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, userId, tokenHash, expiresAt)

    return {
      id,
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString()
    }
  }

  findValidToken(plainToken: string): { token: EmailVerificationToken; valid: boolean; reason?: string } | null {
    const db = getDatabase()
    const tokenHash = hashToken(plainToken)
    const row = db.prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ?').get(tokenHash) as EmailVerificationTokenRow | undefined

    if (!row) return null

    const token: EmailVerificationToken = {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at
    }

    if (token.usedAt) {
      return { token, valid: false, reason: 'This verification link has already been used.' }
    }

    if (new Date(token.expiresAt).getTime() < Date.now()) {
      return { token, valid: false, reason: 'This verification link has expired.' }
    }

    return { token, valid: true }
  }

  markUsed(tokenId: string): boolean {
    const db = getDatabase()
    const result = db.prepare(`
      UPDATE email_verification_tokens
      SET used_at = datetime('now')
      WHERE id = ? AND used_at IS NULL
    `).run(tokenId)
    return result.changes > 0
  }

  invalidateUserTokens(userId: string): void {
    const db = getDatabase()
    db.prepare(`
      UPDATE email_verification_tokens
      SET used_at = datetime('now')
      WHERE user_id = ? AND used_at IS NULL
    `).run(userId)
  }
}

export const tokenRepo = new TokenRepository()
