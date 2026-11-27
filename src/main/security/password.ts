// ──────────────────────────────────────────────
// AntiProfiles — Password Hashing & Verification
// ──────────────────────────────────────────────

import crypto from 'crypto'

export const DEFAULT_ADMIN_EMAIL = 'admin@antiprofiles.com'
export const DEFAULT_ADMIN_PASSWORD_HASH =
  '74865f19d6cacf33bf194b14e9716b44:d1e39ce4686a032c21734500a5d08166ca59e6a41141f06f2640e2d5bc4dab21bf86bd06bf1b124277802936de5412abde5d815f91389e5cc4c7c0a6c92cb3a3'

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
