// ──────────────────────────────────────────────
// ProfileVault — Password Hashing & Verification
// ──────────────────────────────────────────────

import crypto from 'crypto'

/**
 * Hash password using Node's crypto.scryptSync (salt + key derivation).
 * Returns string formatted as "salt:hash".
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verify plaintext password against stored "salt:hash".
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64)
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey)
  } catch {
    return false
  }
}
