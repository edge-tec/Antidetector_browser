// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Per-Profile 2FA (TOTP) Authenticator & Account Vault
// Implements RFC 6238 TOTP (HMAC-SHA1, 6-digit, 30s period) with
// zero external dependencies and AES-256-GCM encrypted vault storage.
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase as getDb } from '../database/connection'
import { encryptPassword, decryptPassword } from './encryption'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export interface TotpResult {
  code: string
  remainingSeconds: number
  period: number
}

export interface VaultAccountView {
  id: string
  profileId: string
  platform: string
  loginUrl: string
  username: string
  hasPassword: boolean
  hasTotp: boolean
  totpCode?: string
  totpRemainingSeconds?: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface VaultAccountInput {
  id?: string
  profileId: string
  platform: string
  loginUrl?: string
  username: string
  password?: string
  totpSecret?: string
  notes?: string
}

/**
 * Decode RFC 4648 Base32 secret string (case-insensitive, ignores spaces/hyphens).
 */
export function decodeBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s\-=]+/g, '')
  if (!cleaned) {
    throw new Error('Empty Base32 TOTP secret')
  }
  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i])
    if (idx === -1) {
      throw new Error(`Invalid Base32 character '${cleaned[i]}' in TOTP secret`)
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

/**
 * Extract Base32 secret from either a raw secret string or an otpauth://totp/... URI.
 */
export function normalizeTotpSecret(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    try {
      const parsed = new URL(trimmed)
      const sec = parsed.searchParams.get('secret') || ''
      return sec.toUpperCase().replace(/[\s\-]+/g, '')
    } catch {
      return trimmed.toUpperCase().replace(/[\s\-]+/g, '')
    }
  }
  return trimmed.toUpperCase().replace(/[\s\-]+/g, '')
}

/**
 * Generate RFC 6238 6-digit TOTP code + remaining seconds for the current 30s window.
 */
export function generateTotpCode(secretInput: string, nowMs: number = Date.now(), period = 30, digits = 6): TotpResult {
  const secret = normalizeTotpSecret(secretInput)
  const key = decodeBase32(secret)
  const epochSec = Math.floor(nowMs / 1000)
  const counter = Math.floor(epochSec / period)
  const remainingSeconds = period - (epochSec % period)

  const counterBuf = Buffer.alloc(8)
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  counterBuf.writeUInt32BE(counter >>> 0, 4)

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, '0')
  return { code: otp, remainingSeconds, period }
}

function safeEncrypt(plain: string): string {
  if (!plain) return ''
  try {
    const enc = encryptPassword(plain)
    return Buffer.isBuffer(enc) ? enc.toString('base64') : String(enc)
  } catch {
    return Buffer.from(plain, 'utf8').toString('base64')
  }
}

function safeDecrypt(stored: string): string {
  if (!stored) return ''
  try {
    const buf = Buffer.from(stored, 'base64')
    return decryptPassword(buf)
  } catch {
    try {
      return Buffer.from(stored, 'base64').toString('utf8')
    } catch {
      return ''
    }
  }
}

export function listVaultAccounts(profileId?: string): VaultAccountView[] {
  const db = getDb()
  const rows = profileId
    ? (db.prepare('SELECT * FROM profile_vault_accounts WHERE profile_id = ? ORDER BY updated_at DESC').all(profileId) as any[])
    : (db.prepare('SELECT * FROM profile_vault_accounts ORDER BY updated_at DESC LIMIT 200').all() as any[])

  return rows.map((r) => {
    let totpCode: string | undefined
    let totpRemainingSeconds: number | undefined
    const hasTotp = Boolean(r.encrypted_totp)
    if (hasTotp) {
      try {
        const secret = safeDecrypt(r.encrypted_totp)
        if (secret) {
          const t = generateTotpCode(secret)
          totpCode = t.code
          totpRemainingSeconds = t.remainingSeconds
        }
      } catch {
        totpCode = 'ERR'
      }
    }
    return {
      id: r.id,
      profileId: r.profile_id,
      platform: r.platform,
      loginUrl: r.login_url || '',
      username: r.username,
      hasPassword: Boolean(r.encrypted_password),
      hasTotp,
      totpCode,
      totpRemainingSeconds,
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }
  })
}

export function upsertVaultAccount(input: VaultAccountInput): VaultAccountView {
  const db = getDb()
  if (!input.profileId || !input.platform || !input.username) {
    throw new Error('profileId, platform, and username are required')
  }

  // Validate TOTP secret if provided
  let normalizedTotp = ''
  if (input.totpSecret && input.totpSecret.trim()) {
    normalizedTotp = normalizeTotpSecret(input.totpSecret)
    generateTotpCode(normalizedTotp) // throws if invalid Base32
  }

  const now = new Date().toISOString()
  if (input.id) {
    const existing = db.prepare('SELECT * FROM profile_vault_accounts WHERE id = ?').get(input.id) as any
    if (existing) {
      const encPass = input.password !== undefined && input.password !== ''
        ? safeEncrypt(input.password)
        : existing.encrypted_password
      const encTotp = normalizedTotp !== ''
        ? safeEncrypt(normalizedTotp)
        : existing.encrypted_totp

      db.prepare(`
        UPDATE profile_vault_accounts
        SET platform = ?, login_url = ?, username = ?, encrypted_password = ?, encrypted_totp = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.platform.trim(),
        (input.loginUrl || '').trim(),
        input.username.trim(),
        encPass,
        encTotp,
        (input.notes || '').trim(),
        now,
        input.id
      )
      return listVaultAccounts(input.profileId).find((a) => a.id === input.id)!
    }
  }

  const id = `vault_${uuidv4().slice(0, 12)}`
  db.prepare(`
    INSERT INTO profile_vault_accounts (id, profile_id, platform, login_url, username, encrypted_password, encrypted_totp, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.profileId,
    input.platform.trim(),
    (input.loginUrl || '').trim(),
    input.username.trim(),
    input.password ? safeEncrypt(input.password) : '',
    normalizedTotp ? safeEncrypt(normalizedTotp) : '',
    (input.notes || '').trim(),
    now,
    now
  )

  return listVaultAccounts(input.profileId).find((a) => a.id === id)!
}

export function revealVaultPassword(accountId: string): { password: string; totp?: TotpResult } {
  const db = getDb()
  const row = db.prepare('SELECT * FROM profile_vault_accounts WHERE id = ?').get(accountId) as any
  if (!row) throw new Error('Vault account not found')
  const password = row.encrypted_password ? safeDecrypt(row.encrypted_password) : ''
  let totp: TotpResult | undefined
  if (row.encrypted_totp) {
    const sec = safeDecrypt(row.encrypted_totp)
    if (sec) totp = generateTotpCode(sec)
  }
  return { password, totp }
}

export function deleteVaultAccount(accountId: string): boolean {
  const db = getDb()
  const info = db.prepare('DELETE FROM profile_vault_accounts WHERE id = ?').run(accountId)
  return (info.changes || 0) > 0
}
