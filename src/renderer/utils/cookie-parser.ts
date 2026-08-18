// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Cookie Parser & Validator
// Supports JSON (EditThisCookie, Cookie-Editor, Puppeteer, DevTools)
// and Netscape HTTP Cookie File format (cURL, wget)
// ──────────────────────────────────────────────────────────────────

export interface CookieItem {
  name: string
  value: string
  domain: string
  path?: string
  expires?: number
  expirationDate?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'unspecified' | 'no_restriction'
  session?: boolean
  hostOnly?: boolean
}

/**
 * Parse raw cookie string from JSON or Netscape format.
 */
export function parseCookies(rawText: string): { success: boolean; cookies: CookieItem[]; error?: string } {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return { success: true, cookies: [] }
  }

  // 1. Try JSON Array parsing
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      const validCookies: CookieItem[] = []

      for (const item of list) {
        if (!item || typeof item !== 'object') continue

        const name = String(item.name || item.key || item.name_ || '').trim()
        const value = String(item.value !== undefined ? item.value : (item.val || '')).trim()
        let domain = String(item.domain || item.host || item.domain_ || '').trim()

        if (!name) continue

        // Normalize domain
        if (domain.startsWith('http://') || domain.startsWith('https://')) {
          try {
            domain = new URL(domain).hostname
          } catch {}
        }

        const exp = item.expirationDate || item.expires || item.expiry || item.expires_at || undefined

        validCookies.push({
          name,
          value,
          domain: domain || 'localhost',
          path: item.path || '/',
          expires: typeof exp === 'number' ? Math.floor(exp) : undefined,
          expirationDate: typeof exp === 'number' ? Math.floor(exp) : undefined,
          httpOnly: Boolean(item.httpOnly ?? item.httponly ?? item.hostOnly ?? false),
          secure: Boolean(item.secure ?? false),
          sameSite: normalizeSameSite(item.sameSite || item.samesite),
          session: Boolean(item.session ?? (!exp))
        })
      }

      if (validCookies.length > 0) {
        return { success: true, cookies: validCookies }
      }
    } catch {
      // Not valid JSON, continue to Netscape parser
    }
  }

  // 2. Try Netscape / cURL HTTP Cookie File Format
  const lines = trimmed.split(/\r?\n/)
  const netscapeCookies: CookieItem[] = []

  for (const line of lines) {
    const l = line.trim()
    if (!l || l.startsWith('#') && !l.startsWith('#HttpOnly_')) continue

    let isHttpOnly = false
    let cleanLine = l
    if (cleanLine.startsWith('#HttpOnly_')) {
      isHttpOnly = true
      cleanLine = cleanLine.replace('#HttpOnly_', '')
    }

    const parts = cleanLine.split(/\t+|\s{2,}/)
    if (parts.length >= 7) {
      const domain = parts[0].trim()
      const path = parts[2].trim() || '/'
      const secure = parts[3].trim().toUpperCase() === 'TRUE'
      const expTimestamp = parseInt(parts[4].trim(), 10)
      const name = parts[5].trim()
      const value = parts.slice(6).join(' ').trim()

      if (name) {
        netscapeCookies.push({
          name,
          value,
          domain,
          path,
          secure,
          httpOnly: isHttpOnly,
          expires: isNaN(expTimestamp) ? undefined : expTimestamp,
          expirationDate: isNaN(expTimestamp) ? undefined : expTimestamp,
          session: isNaN(expTimestamp) || expTimestamp <= 0
        })
      }
    }
  }

  if (netscapeCookies.length > 0) {
    return { success: true, cookies: netscapeCookies }
  }

  // 3. Fallback: Parse Name=Value lines (Simple Key-Value format)
  const simpleCookies: CookieItem[] = []
  for (const line of lines) {
    const l = line.trim()
    if (!l || l.startsWith('#')) continue
    const eqIdx = l.indexOf('=')
    if (eqIdx > 0) {
      const name = l.substring(0, eqIdx).trim()
      let rest = l.substring(eqIdx + 1).trim()
      let value = rest
      let domain = 'localhost'
      let path = '/'

      // If line has attributes separated by semicolon
      if (rest.includes(';')) {
        const segs = rest.split(';').map(s => s.trim())
        value = segs[0]
        for (let i = 1; i < segs.length; i++) {
          const [k, v] = segs[i].split('=').map(s => s.trim())
          if (k?.toLowerCase() === 'domain' && v) domain = v
          if (k?.toLowerCase() === 'path' && v) path = v
        }
      }

      if (name && value !== undefined) {
        simpleCookies.push({
          name,
          value,
          domain,
          path,
          session: true
        })
      }
    }
  }

  if (simpleCookies.length > 0) {
    return { success: true, cookies: simpleCookies }
  }

  return {
    success: false,
    cookies: [],
    error: 'Could not recognize cookie format. Please paste a valid JSON array or Netscape cookie format.'
  }
}

function normalizeSameSite(val: any): 'Strict' | 'Lax' | 'None' | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase()
  if (s === 'strict') return 'Strict'
  if (s === 'lax') return 'Lax'
  if (s === 'none' || s === 'no_restriction') return 'None'
  return undefined
}
