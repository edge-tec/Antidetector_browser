// ──────────────────────────────────────────────
// AntiProfiles — API Token Authentication
// ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { getDatabase } from '../database/connection'

/**
 * Generate a secure API token.
 */
export function generateApiToken(): string {
  return `pvault_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Get the current API token, or create one if it doesn't exist.
 */
export function getOrCreateApiToken(): string {
  const db = getDatabase()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'apiToken'").get() as { value: string } | undefined

  if (row) return row.value

  const token = generateApiToken()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apiToken', ?)").run(token)
  return token
}

/**
 * Rotate the API token (invalidate old, create new).
 */
export function rotateApiToken(): string {
  const db = getDatabase()
  const token = generateApiToken()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apiToken', ?)").run(token)
  return token
}

/**
 * Validate a token against the stored token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateApiToken(token: string): boolean {
  const db = getDatabase()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'apiToken'").get() as { value: string } | undefined

  if (!row) return false

  const expected = Buffer.from(row.value, 'utf-8')
  const received = Buffer.from(token, 'utf-8')

  if (expected.length !== received.length) return false

  return crypto.timingSafeEqual(expected, received)
}
