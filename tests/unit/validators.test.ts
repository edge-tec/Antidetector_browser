// ──────────────────────────────────────────────
// ProfileVault — Unit Tests: Validators
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  validateProfileName,
  validateId,
  sanitizePath,
  validatePathWithinBase,
  validatePort,
  validateTimezone,
  validateUserAgent,
  validateScreenDimension
} from '../../src/main/security/validators'

describe('validateProfileName', () => {
  it('accepts valid names', () => {
    expect(validateProfileName('Test Profile')).toBe('Test Profile')
    expect(validateProfileName('  Trimmed  ')).toBe('Trimmed')
  })

  it('rejects empty names', () => {
    expect(() => validateProfileName('')).toThrow()
    expect(() => validateProfileName('   ')).toThrow()
    expect(() => validateProfileName(null)).toThrow()
    expect(() => validateProfileName(undefined)).toThrow()
  })

  it('rejects names exceeding 200 characters', () => {
    expect(() => validateProfileName('a'.repeat(201))).toThrow()
  })
})

describe('validateId', () => {
  it('accepts valid UUIDs', () => {
    expect(validateId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('rejects invalid IDs', () => {
    expect(() => validateId('not-a-uuid')).toThrow()
    expect(() => validateId('')).toThrow()
    expect(() => validateId(123)).toThrow()
  })
})

describe('sanitizePath', () => {
  it('removes path traversal sequences', () => {
    expect(sanitizePath('profile-1')).toBe('profile-1')
    expect(sanitizePath('../../../etc/passwd')).toBe('etcpasswd')
  })

  it('removes path separators', () => {
    expect(sanitizePath('test/path')).toBe('testpath')
    expect(sanitizePath('test\\path')).toBe('testpath')
  })

  it('rejects empty results', () => {
    expect(() => sanitizePath('../../../')).toThrow()
  })
})

describe('validatePathWithinBase', () => {
  it('accepts paths within base', () => {
    expect(validatePathWithinBase('/base/dir/file.txt', '/base/dir')).toBe('/base/dir/file.txt')
  })

  it('rejects paths escaping base', () => {
    expect(() => validatePathWithinBase('/base/dir/../../etc/passwd', '/base/dir')).toThrow()
  })
})

describe('validatePort', () => {
  it('accepts valid ports', () => {
    expect(validatePort(8080)).toBe(8080)
    expect(validatePort(0)).toBe(0)
    expect(validatePort(65535)).toBe(65535)
    expect(validatePort('443')).toBe(443)
  })

  it('rejects invalid ports', () => {
    expect(() => validatePort(-1)).toThrow()
    expect(() => validatePort(70000)).toThrow()
    expect(() => validatePort('abc')).toThrow()
  })
})

describe('validateTimezone', () => {
  it('accepts valid timezones', () => {
    expect(validateTimezone('America/New_York')).toBe('America/New_York')
    expect(validateTimezone('Europe/London')).toBe('Europe/London')
  })

  it('rejects invalid timezones', () => {
    expect(() => validateTimezone('Fake/Timezone')).toThrow()
  })

  it('returns default for non-string input', () => {
    expect(validateTimezone(null)).toBe('America/New_York')
  })
})

describe('validateUserAgent', () => {
  it('accepts valid user agents', () => {
    expect(validateUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
  })

  it('rejects user agents exceeding 500 characters', () => {
    expect(() => validateUserAgent('a'.repeat(501))).toThrow()
  })

  it('strips control characters', () => {
    expect(validateUserAgent('test\x00\x01agent')).toBe('testagent')
  })
})

describe('validateScreenDimension', () => {
  it('accepts valid dimensions', () => {
    expect(validateScreenDimension(1920, 'width')).toBe(1920)
    expect(validateScreenDimension(320, 'width')).toBe(320)
    expect(validateScreenDimension(7680, 'width')).toBe(7680)
  })

  it('rejects invalid dimensions', () => {
    expect(() => validateScreenDimension(100, 'width')).toThrow()
    expect(() => validateScreenDimension(10000, 'width')).toThrow()
  })
})
