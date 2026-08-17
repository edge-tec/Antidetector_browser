// ──────────────────────────────────────────────
// AntiProfiles — Input Validators & Sanitizers
// ──────────────────────────────────────────────

import path from 'path'

/**
 * Validate a profile name.
 */
export function validateProfileName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Profile name is required and must be a non-empty string.')
  }
  if (name.length > 200) {
    throw new Error('Profile name must not exceed 200 characters.')
  }
  return name.trim()
}

/**
 * Validate a UUID.
 */
export function validateId(id: unknown): string {
  if (typeof id !== 'string') {
    throw new Error('ID must be a string.')
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    throw new Error('Invalid ID format.')
  }
  return id
}

/**
 * Prevent path traversal attacks.
 * Ensures a path component doesn't escape the base directory.
 */
export function sanitizePath(component: string): string {
  // Remove path separators and traversal sequences
  const sanitized = component
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    .replace(/[\x00-\x1f]/g, '') // Remove control characters
  
  if (sanitized.length === 0) {
    throw new Error('Invalid path component.')
  }
  return sanitized
}

/**
 * Validate that a resolved path stays within a base directory.
 */
export function validatePathWithinBase(filePath: string, baseDir: string): string {
  const resolved = path.resolve(filePath)
  const resolvedBase = path.resolve(baseDir)
  
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error('Path traversal detected: path escapes the allowed directory.')
  }
  return resolved
}

/**
 * Sanitize browser launch arguments to prevent injection.
 */
export function sanitizeBrowserArg(arg: string): string {
  // Only allow safe characters in browser arguments
  if (!/^[a-zA-Z0-9\-_.=:\/,@%]+$/.test(arg)) {
    throw new Error(`Unsafe browser argument detected: ${arg.substring(0, 50)}`)
  }
  return arg
}

/**
 * Validate proxy host (IP or hostname).
 */
export function validateProxyHost(host: unknown): string {
  if (typeof host !== 'string') {
    throw new Error('Proxy host must be a string.')
  }
  const trimmed = host.trim()
  if (trimmed.length === 0) return ''
  
  // Basic hostname/IP validation
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-_.]*[a-zA-Z0-9])?$/
  if (!hostnameRegex.test(trimmed) && !isValidIP(trimmed)) {
    throw new Error('Invalid proxy host format.')
  }
  return trimmed
}

/**
 * Validate proxy port number.
 */
export function validatePort(port: unknown): number {
  const num = typeof port === 'string' ? parseInt(port, 10) : port
  if (typeof num !== 'number' || isNaN(num) || num < 0 || num > 65535) {
    throw new Error('Port must be a number between 0 and 65535.')
  }
  return num
}

/**
 * Validate a timezone string.
 */
export function validateTimezone(tz: unknown): string {
  if (typeof tz !== 'string') return 'America/New_York'
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return tz
  } catch {
    throw new Error(`Invalid timezone: ${tz}`)
  }
}

/**
 * Validate user-agent string (basic safety check).
 */
export function validateUserAgent(ua: unknown): string {
  if (typeof ua !== 'string') return ''
  if (ua.length > 500) {
    throw new Error('User-agent string must not exceed 500 characters.')
  }
  // Remove control characters
  return ua.replace(/[\x00-\x1f]/g, '')
}

/**
 * Validate screen dimensions.
 */
export function validateScreenDimension(dim: unknown, label: string): number {
  const num = typeof dim === 'string' ? parseInt(dim, 10) : dim
  if (typeof num !== 'number' || isNaN(num) || num < 320 || num > 7680) {
    throw new Error(`${label} must be between 320 and 7680.`)
  }
  return num
}

function isValidIP(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4.test(ip)) {
    return ip.split('.').every((part) => {
      const n = parseInt(part, 10)
      return n >= 0 && n <= 255
    })
  }
  // Basic IPv6 check
  return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')
}
