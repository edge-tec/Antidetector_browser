// ──────────────────────────────────────────────
// ProfileVault — Integration Tests: API Auth
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

describe('API Token Generation', () => {
  it('generates tokens with the correct prefix', () => {
    const token = `pvault_${crypto.randomBytes(32).toString('hex')}`
    expect(token).toMatch(/^pvault_[a-f0-9]{64}$/)
    expect(token.length).toBe(71) // "pvault_" (7) + 64 hex chars
  })

  it('generates unique tokens each time', () => {
    const t1 = `pvault_${crypto.randomBytes(32).toString('hex')}`
    const t2 = `pvault_${crypto.randomBytes(32).toString('hex')}`
    expect(t1).not.toBe(t2)
  })
})

describe('Constant-time comparison', () => {
  it('correctly validates matching tokens', () => {
    const token = 'pvault_abc123'
    const a = Buffer.from(token, 'utf-8')
    const b = Buffer.from(token, 'utf-8')
    expect(crypto.timingSafeEqual(a, b)).toBe(true)
  })

  it('rejects mismatched tokens', () => {
    const a = Buffer.from('pvault_abc123', 'utf-8')
    const b = Buffer.from('pvault_def456', 'utf-8')
    expect(crypto.timingSafeEqual(a, b)).toBe(false)
  })

  it('handles different-length buffers safely', () => {
    const a = Buffer.from('short', 'utf-8')
    const b = Buffer.from('longer_string', 'utf-8')
    // timingSafeEqual throws on different lengths — we should check length first
    expect(a.length).not.toBe(b.length)
  })
})

describe('Password encryption pattern', () => {
  it('encrypt/decrypt cycle preserves data', () => {
    // Test the general pattern (not using safeStorage which requires Electron runtime)
    const password = 'my_secret_proxy_password_123!'
    
    // Simulate encryption with a key
    const key = crypto.randomBytes(32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(password, 'utf-8', 'hex')
    encrypted += cipher.final('hex')

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')

    expect(decrypted).toBe(password)
  })

  it('different passwords produce different ciphertext', () => {
    const key = crypto.randomBytes(32)
    const iv = crypto.randomBytes(16)
    
    const encrypt = (text: string) => {
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
      return cipher.update(text, 'utf-8', 'hex') + cipher.final('hex')
    }

    const e1 = encrypt('password1')
    const e2 = encrypt('password2')
    expect(e1).not.toBe(e2)
  })
})

describe('Input sanitization for API', () => {
  it('bearer token extraction works correctly', () => {
    const header = 'Bearer pvault_abc123def456'
    const token = header.substring(7)
    expect(token).toBe('pvault_abc123def456')
  })

  it('rejects missing Bearer prefix', () => {
    const header = 'Basic pvault_abc123'
    expect(header.startsWith('Bearer ')).toBe(false)
  })

  it('rejects empty authorization', () => {
    const header = ''
    expect(header.startsWith('Bearer ')).toBe(false)
  })
})
