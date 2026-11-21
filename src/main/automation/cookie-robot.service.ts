// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Cookie Robot (Automated Profile Warm-Up Bot)
// Visits organic websites inside a profile's browser session with
// human-like scrolling, random dwell times, and safe link browsing
// to build authentic cookies & browsing history before ad/account use.
// ──────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase as getDb } from '../database/connection'
import { processTracker } from '../browser/process-tracker'
import { profileManager } from '../browser/profile-manager'
import { logger } from '../logging/logger'

export interface CookieRobotPreset {
  id: string
  name: string
  description: string
  urls: string[]
}

export interface CookieRobotOptions {
  profileId: string
  urls: string[]
  dwellMinMs?: number
  dwellMaxMs?: number
  scrollSteps?: number
  closeAfterRun?: boolean
}

export interface CookieRobotRunRecord {
  id: string
  profileId: string
  status: 'running' | 'completed' | 'failed'
  urlsTotal: number
  urlsVisited: number
  cookiesGained: number
  errorMessage: string
  startedAt: string
  completedAt: string | null
}

export const COOKIE_ROBOT_PRESETS: CookieRobotPreset[] = [
  {
    id: 'general-warmup',
    name: 'General Organic Warm-Up',
    description: 'High-trust global news, wiki, and utility sites for natural cookie history.',
    urls: [
      'https://www.wikipedia.org',
      'https://www.bbc.com',
      'https://www.imdb.com',
      'https://www.weather.com',
      'https://www.nytimes.com'
    ]
  },
  {
    id: 'ecommerce-warmup',
    name: 'E-Commerce & Shopping Warm-Up',
    description: 'Builds shopping & retail ad-network cookies for e-commerce accounts.',
    urls: [
      'https://www.amazon.com',
      'https://www.ebay.com',
      'https://www.etsy.com',
      'https://www.walmart.com',
      'https://www.bestbuy.com'
    ]
  },
  {
    id: 'tech-social-warmup',
    name: 'Tech & Social Discovery',
    description: 'Developer, tech news, and content discovery cookies.',
    urls: [
      'https://github.com',
      'https://stackoverflow.com',
      'https://www.reddit.com',
      'https://www.medium.com',
      'https://news.ycombinator.com'
    ]
  }
]

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function sanitizeUrls(urls: string[]): string[] {
  const out: string[] = []
  for (const raw of urls) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) continue
    try {
      const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      const parsed = new URL(normalized)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        out.push(parsed.toString())
      }
    } catch {
      // skip invalid URLs
    }
  }
  return Array.from(new Set(out)).slice(0, 30)
}

export function getCookieRobotRuns(profileId?: string): CookieRobotRunRecord[] {
  const db = getDb()
  const rows = profileId
    ? (db.prepare('SELECT * FROM cookie_robot_runs WHERE profile_id = ? ORDER BY started_at DESC LIMIT 30').all(profileId) as any[])
    : (db.prepare('SELECT * FROM cookie_robot_runs ORDER BY started_at DESC LIMIT 50').all() as any[])

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    status: r.status,
    urlsTotal: r.urls_total,
    urlsVisited: r.urls_visited,
    cookiesGained: r.cookies_gained,
    errorMessage: r.error_message || '',
    startedAt: r.started_at,
    completedAt: r.completed_at || null
  }))
}

export async function runCookieRobot(options: CookieRobotOptions): Promise<CookieRobotRunRecord> {
  const db = getDb()
  const urls = sanitizeUrls(options.urls)
  if (!options.profileId) throw new Error('profileId is required')
  if (urls.length === 0) throw new Error('At least one valid http/https URL is required')

  const dwellMin = Math.max(1200, Math.min(options.dwellMinMs ?? 2500, 15000))
  const dwellMax = Math.max(dwellMin + 500, Math.min(options.dwellMaxMs ?? 5500, 25000))
  const scrollSteps = Math.max(1, Math.min(options.scrollSteps ?? 3, 10))

  const runId = `crobot_${uuidv4().slice(0, 12)}`
  const startedAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO cookie_robot_runs (id, profile_id, status, urls_total, urls_visited, cookies_gained, started_at)
    VALUES (?, ?, 'running', ?, 0, 0, ?)
  `).run(runId, options.profileId, urls.length, startedAt)

  let launchedByRobot = false
  let urlsVisited = 0
  let cookiesBefore = 0
  let cookiesAfter = 0

  try {
    let tracked = processTracker.get(options.profileId)
    if (!tracked?.browser || !tracked.browser.connected) {
      await profileManager.startProfile(options.profileId)
      launchedByRobot = true
      tracked = processTracker.get(options.profileId)
    }

    if (!tracked?.browser || !tracked.browser.connected) {
      throw new Error('Could not attach Puppeteer CDP session for Cookie Robot')
    }

    const page = await tracked.browser.newPage()
    try {
      const initialCookies = await page.cookies()
      cookiesBefore = initialCookies.length
    } catch {}

    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 22000 })
        urlsVisited++
        db.prepare('UPDATE cookie_robot_runs SET urls_visited = ? WHERE id = ?').run(urlsVisited, runId)

        // Human-like reading & scrolling
        for (let step = 0; step < scrollSteps; step++) {
          const deltaY = randomBetween(220, 620)
          await page.evaluate((dy) => {
            window.scrollBy({ top: dy, behavior: 'smooth' })
          }, deltaY).catch(() => {})
          await sleep(randomBetween(Math.floor(dwellMin / scrollSteps), Math.floor(dwellMax / scrollSteps)))
        }
      } catch (navErr: any) {
        logger.warn('automation', `[CookieRobot] Skipped ${url}: ${navErr.message}`)
      }
    }

    try {
      const finalCookies = await page.cookies()
      cookiesAfter = finalCookies.length
    } catch {}

    await page.close().catch(() => {})
    if (launchedByRobot && options.closeAfterRun !== false) {
      await profileManager.stopProfile(options.profileId).catch(() => {})
    }

    const gained = Math.max(0, cookiesAfter - cookiesBefore)
    const completedAt = new Date().toISOString()
    db.prepare(`
      UPDATE cookie_robot_runs
      SET status = 'completed', urls_visited = ?, cookies_gained = ?, completed_at = ?
      WHERE id = ?
    `).run(urlsVisited, gained, completedAt, runId)

    logger.info('automation', `[CookieRobot] Completed run ${runId} for profile ${options.profileId}: ${urlsVisited}/${urls.length} sites, +${gained} cookies`)
    return getCookieRobotRuns(options.profileId).find((r) => r.id === runId)!
  } catch (err: any) {
    const completedAt = new Date().toISOString()
    db.prepare(`
      UPDATE cookie_robot_runs
      SET status = 'failed', urls_visited = ?, error_message = ?, completed_at = ?
      WHERE id = ?
    `).run(urlsVisited, err.message || 'Cookie Robot failed', completedAt, runId)
    if (launchedByRobot && options.closeAfterRun !== false) {
      await profileManager.stopProfile(options.profileId).catch(() => {})
    }
    throw err
  }
}
