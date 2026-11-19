// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise Cookie & Session Management Center
// View, search, filter, import (JSON/Netscape), export, delete,
// clear, and backup profile cookies via CDP or persistent storage
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { processTracker } from './process-tracker'
import { getProfileDataDir } from './chromium-resolver'
import { logger } from '../logging/logger'

export interface ManagedCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

function getCookieStorePath(profileId: string): string {
  const dataDir = getProfileDataDir(profileId)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'managed-cookies.json')
}

/**
 * Parse cookies from either JSON array format or Netscape cookies.txt format.
 */
export function parseCookiePayload(raw: string): ManagedCookie[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.cookies) ? parsed.cookies : [parsed])
    return list
      .filter((c: any) => c && c.name && c.domain)
      .map((c: any) => ({
        name: String(c.name),
        value: String(c.value ?? ''),
        domain: String(c.domain),
        path: String(c.path || '/'),
        expires: typeof c.expirationDate === 'number' ? c.expirationDate : (typeof c.expires === 'number' ? c.expires : undefined),
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None' ? c.sameSite : 'Lax'
      }))
  }

  // Netscape tab-delimited format
  const cookies: ManagedCookie[] = []
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#')) continue
    const parts = l.split('\t')
    if (parts.length >= 7) {
      const expiresNum = Number(parts[4])
      cookies.push({
        domain: parts[0],
        path: parts[2] || '/',
        secure: parts[3].toUpperCase() === 'TRUE',
        expires: Number.isFinite(expiresNum) && expiresNum > 0 ? expiresNum : undefined,
        name: parts[5],
        value: parts[6]
      })
    }
  }
  return cookies
}

export class CookieManager {
  /**
   * Read cookies for a profile (live via CDP if running, otherwise from managed store).
   */
  static async getCookies(profileId: string, domainFilter?: string): Promise<ManagedCookie[]> {
    let cookies: ManagedCookie[] = []
    const tracked = processTracker.get(profileId)

    if (tracked?.browser && tracked.browser.connected) {
      try {
        const pages = await tracked.browser.pages()
        const page = pages[0]
        if (page) {
          const client = await page.target().createCDPSession()
          const res: any = await client.send('Network.getAllCookies')
          cookies = (res.cookies || []).map((c: any) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            expires: c.expires > 0 ? c.expires : undefined,
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: c.sameSite
          }))
          await client.detach().catch(() => {})
        }
      } catch (err: any) {
        logger.warn('browser', `[CookieManager] Live CDP cookie read failed for ${profileId}: ${err.message}`)
      }
    }

    if (cookies.length === 0) {
      const storePath = getCookieStorePath(profileId)
      if (fs.existsSync(storePath)) {
        try {
          cookies = JSON.parse(fs.readFileSync(storePath, 'utf8'))
        } catch {}
      }
    }

    if (domainFilter) {
      const q = domainFilter.toLowerCase()
      cookies = cookies.filter((c) => c.domain.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    }

    return cookies
  }

  /**
   * Import cookies (JSON or Netscape format) into a profile (live CDP + persistent store).
   */
  static async importCookies(profileId: string, rawPayload: string): Promise<{ imported: number }> {
    const incoming = parseCookiePayload(rawPayload)
    if (incoming.length === 0) return { imported: 0 }

    const existing = await this.getCookies(profileId)
    const map = new Map<string, ManagedCookie>()
    for (const c of existing) map.set(`${c.domain}|${c.path}|${c.name}`, c)
    for (const c of incoming) map.set(`${c.domain}|${c.path}|${c.name}`, c)

    const merged = Array.from(map.values())
    fs.writeFileSync(getCookieStorePath(profileId), JSON.stringify(merged, null, 2), 'utf8')

    // Push into live browser if running
    const tracked = processTracker.get(profileId)
    if (tracked?.browser && tracked.browser.connected) {
      try {
        const pages = await tracked.browser.pages()
        const page = pages[0]
        if (page) {
          const client = await page.target().createCDPSession()
          await client.send('Network.setCookies', { cookies: incoming as any })
          await client.detach().catch(() => {})
        }
      } catch (err: any) {
        logger.warn('browser', `[CookieManager] Live CDP cookie import warning: ${err.message}`)
      }
    }

    logger.info('browser', `[CookieManager] Imported ${incoming.length} cookies into profile ${profileId}`)
    return { imported: incoming.length }
  }

  /**
   * Export cookies as JSON string.
   */
  static async exportCookies(profileId: string, domainFilter?: string): Promise<string> {
    const cookies = await this.getCookies(profileId, domainFilter)
    return JSON.stringify(cookies, null, 2)
  }

  /**
   * Delete a specific cookie by name & domain.
   */
  static async deleteCookie(profileId: string, name: string, domain: string): Promise<boolean> {
    const storePath = getCookieStorePath(profileId)
    let removed = false
    if (fs.existsSync(storePath)) {
      const list = JSON.parse(fs.readFileSync(storePath, 'utf8')) as ManagedCookie[]
      const filtered = list.filter((c) => !(c.name === name && c.domain === domain))
      removed = filtered.length < list.length
      fs.writeFileSync(storePath, JSON.stringify(filtered, null, 2), 'utf8')
    }

    const tracked = processTracker.get(profileId)
    if (tracked?.browser && tracked.browser.connected) {
      try {
        const pages = await tracked.browser.pages()
        if (pages[0]) {
          const client = await pages[0].target().createCDPSession()
          await client.send('Network.deleteCookies', { name, domain })
          await client.detach().catch(() => {})
          removed = true
        }
      } catch {}
    }

    return removed
  }

  /**
   * Clear all cookies for a profile.
   */
  static async clearCookies(profileId: string): Promise<void> {
    const storePath = getCookieStorePath(profileId)
    fs.writeFileSync(storePath, '[]', 'utf8')

    const tracked = processTracker.get(profileId)
    if (tracked?.browser && tracked.browser.connected) {
      try {
        const pages = await tracked.browser.pages()
        if (pages[0]) {
          const client = await pages[0].target().createCDPSession()
          await client.send('Network.clearBrowserCookies')
          await client.detach().catch(() => {})
        }
      } catch {}
    }
    logger.info('browser', `[CookieManager] Cleared all cookies for profile ${profileId}`)
  }
}
