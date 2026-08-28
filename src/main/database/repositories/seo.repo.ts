// ──────────────────────────────────────────────
// AntiProfiles — SEO & AEO Repository (SQLite)
// ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../connection'

export interface PageSeoRecord {
  id: string
  page_path: string
  page_type: string
  title: string
  description: string
  keywords?: string
  canonical_url?: string
  robots?: string
  og_title?: string
  og_description?: string
  og_image?: string
  twitter_card?: string
  twitter_title?: string
  twitter_description?: string
  schema_type?: string
  primary_keyword?: string
  ai_quick_answer?: string
  structured_data_json?: string
  updated_at?: string
}

export interface SeoKeywordRecord {
  id: string
  keyword: string
  keyword_type: string
  search_intent: string
  target_url: string
  country: string
  language: string
  status: string
  ranking_position: number
  created_at?: string
}

export interface SeoRedirectRecord {
  id: string
  source_path: string
  target_path: string
  status_code: number
  created_at?: string
}

export interface Seo404Record {
  id: string
  request_path: string
  referrer?: string
  user_agent?: string
  hit_count: number
  last_seen_at?: string
}

export const DEFAULT_HIGH_VOLUME_SEO_KEYWORDS = [
  // 1. Affiliate & Marketing Keywords
  { keyword: 'multi-account management', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'affiliate marketing browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'cpa marketing browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'social media account manager', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'facebook multi account browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'tiktok multi account browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'instagram multi account browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'ads account browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'browser for media buying', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'e-commerce browser profiles', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'amazon seller browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'dropshipping browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'agency browser profiles', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },

  // 2. Fingerprint & Privacy Keywords
  { keyword: 'canvas fingerprint protection', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'webgl fingerprint spoofing', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'audio fingerprint protection', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'user agent spoofing', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'timezone spoofing', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'font fingerprint protection', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'screen resolution spoofing', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'device fingerprint masking', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'ip and fingerprint isolation', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'cookie isolation browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'local storage isolation', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'webrtc leak protection', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'dns leak protection', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },

  // 3. Proxy & Network Keywords
  { keyword: 'residential proxy browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'socks5 proxy browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'http proxy browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'mobile proxy browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'proxy profile management', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'rotating proxy browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'proxy fingerprint browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'browser with proxy support', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },

  // 4. Competitor Search Keywords (Alternative Search Queries)
  { keyword: 'gologin alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'multilogin alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'adspower alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'dolphin anty alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'incogniton alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'vmlogin alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'kameleo alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'hidemyacc alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'octo browser alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },
  { keyword: 'morelogin alternative', keyword_type: 'competitor', search_intent: 'commercial', target_url: '/' },

  // 5. Windows / macOS / Linux Keywords
  { keyword: 'anti detect browser windows', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'anti detect browser mac', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'anti detect browser linux', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'apple silicon anti detect browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'intel mac anti detect browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'cross platform antidetect browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },

  // 6. Best SEO Tags & Priority Keywords for AntiProfiles
  { keyword: 'antidetect browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'anti detect browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'browser fingerprint', keyword_type: 'primary', search_intent: 'informational', target_url: '/' },
  { keyword: 'fingerprint browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'multi account browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'browser profiles', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'privacy browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'anonymous browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'cpa marketing', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'affiliate marketing', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'media buying', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'proxy browser', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'socks5 proxy', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'residential proxy', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'facebook accounts', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'tiktok accounts', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'instagram accounts', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'browser security', keyword_type: 'secondary', search_intent: 'informational', target_url: '/' },
  { keyword: 'antiprofiles browser', keyword_type: 'brand', search_intent: 'navigational', target_url: '/' },
  { keyword: 'browser identity manager', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'isolated browser profiles', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'browser automation', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' },
  { keyword: 'google ads browser', keyword_type: 'secondary', search_intent: 'commercial', target_url: '/' }
]

export class SeoRepository {
  // ── Global Settings ──
  getSettings(): Record<string, string> {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM seo_settings').all() as Array<{ key: string; value: string }>
    const result: Record<string, string> = {}
    for (const r of rows) {
      result[r.key] = r.value
    }
    return result
  }

  saveSettings(settings: Record<string, string>): void {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO seo_settings (key, value) VALUES (?, ?)')
    const transaction = db.transaction((data: Record<string, string>) => {
      for (const [k, v] of Object.entries(data)) {
        stmt.run(k, String(v))
      }
    })
    transaction(settings)
  }

  // ── Page SEO Records ──
  getAllPageSeo(): PageSeoRecord[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM page_seo ORDER BY page_path ASC').all() as PageSeoRecord[]
  }

  getPageSeoByPath(path: string): PageSeoRecord | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM page_seo WHERE page_path = ?').get(path) as PageSeoRecord | undefined
    return row || null
  }

  savePageSeo(page: Partial<PageSeoRecord>): PageSeoRecord {
    const db = getDatabase()
    const id = page.id || `page_${uuidv4().substring(0, 8)}`
    const now = new Date().toISOString()
    const existing = page.page_path ? this.getPageSeoByPath(page.page_path) : null

    const targetId = existing?.id || id

    db.prepare(`
      INSERT INTO page_seo (
        id, page_path, page_type, title, description, keywords, canonical_url, robots,
        og_title, og_description, og_image, twitter_card, twitter_title, twitter_description,
        schema_type, primary_keyword, ai_quick_answer, structured_data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(page_path) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        keywords = excluded.keywords,
        canonical_url = excluded.canonical_url,
        robots = excluded.robots,
        og_title = excluded.og_title,
        og_description = excluded.og_description,
        og_image = excluded.og_image,
        twitter_card = excluded.twitter_card,
        twitter_title = excluded.twitter_title,
        twitter_description = excluded.twitter_description,
        schema_type = excluded.schema_type,
        primary_keyword = excluded.primary_keyword,
        ai_quick_answer = excluded.ai_quick_answer,
        structured_data_json = excluded.structured_data_json,
        updated_at = excluded.updated_at
    `).run(
      targetId,
      page.page_path || '/',
      page.page_type || 'webpage',
      page.title || 'AntiProfiles',
      page.description || '',
      page.keywords || '',
      page.canonical_url || '',
      page.robots || 'index, follow',
      page.og_title || page.title || '',
      page.og_description || page.description || '',
      page.og_image || '',
      page.twitter_card || 'summary_large_image',
      page.twitter_title || page.og_title || page.title || '',
      page.twitter_description || page.og_description || page.description || '',
      page.schema_type || 'SoftwareApplication',
      page.primary_keyword || '',
      page.ai_quick_answer || '',
      page.structured_data_json || '',
      now
    )

    return this.getPageSeoByPath(page.page_path || '/')!
  }

  deletePageSeo(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM page_seo WHERE id = ?').run(id)
  }

  // ── Keywords Management ──
  getKeywords(): SeoKeywordRecord[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM seo_keywords ORDER BY created_at DESC').all() as SeoKeywordRecord[]
    if (!rows || rows.length === 0) {
      this.seedDefaultKeywords()
      return db.prepare('SELECT * FROM seo_keywords ORDER BY created_at DESC').all() as SeoKeywordRecord[]
    }
    return rows
  }

  seedDefaultKeywords(): number {
    const db = getDatabase()
    const now = new Date().toISOString()
    let count = 0
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO seo_keywords (id, keyword, keyword_type, search_intent, target_url, country, language, status, ranking_position, created_at)
      VALUES (?, ?, ?, ?, ?, 'US', 'en', 'active', 0, ?)
    `)

    for (let i = 0; i < DEFAULT_HIGH_VOLUME_SEO_KEYWORDS.length; i++) {
      const kw = DEFAULT_HIGH_VOLUME_SEO_KEYWORDS[i]
      const id = `kw_seed_${i + 1}_${kw.keyword.replace(/[^a-z0-9]/g, '_').substring(0, 16)}`
      try {
        insertStmt.run(id, kw.keyword.trim().toLowerCase(), kw.keyword_type, kw.search_intent, kw.target_url, now)
        count++
      } catch {}
    }
    return count
  }

  saveKeyword(kw: Partial<SeoKeywordRecord>): SeoKeywordRecord {
    const db = getDatabase()
    const id = kw.id || `kw_${uuidv4().substring(0, 8)}`
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO seo_keywords (
        id, keyword, keyword_type, search_intent, target_url, country, language, status, ranking_position, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        keyword = excluded.keyword,
        keyword_type = excluded.keyword_type,
        search_intent = excluded.search_intent,
        target_url = excluded.target_url,
        country = excluded.country,
        language = excluded.language,
        status = excluded.status,
        ranking_position = excluded.ranking_position
    `).run(
      id,
      kw.keyword!.trim().toLowerCase(),
      kw.keyword_type || 'primary',
      kw.search_intent || 'commercial',
      kw.target_url || '/',
      kw.country || 'US',
      kw.language || 'en',
      kw.status || 'active',
      kw.ranking_position || 0,
      now
    )

    return db.prepare('SELECT * FROM seo_keywords WHERE id = ?').get(id) as SeoKeywordRecord
  }

  deleteKeyword(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM seo_keywords WHERE id = ?').run(id)
  }

  // Check for keyword cannibalization (multiple pages/keywords targeting the same primary keyword across different URLs)
  findCannibalizationWarnings(): Array<{ keyword: string; urls: string[] }> {
    const urlMap = new Map<string, Set<string>>()

    // Check page_seo primary_keyword
    const pages = this.getAllPageSeo()
    for (const p of pages) {
      if (p.primary_keyword && p.primary_keyword.trim()) {
        const norm = p.primary_keyword.toLowerCase().trim()
        if (!urlMap.has(norm)) urlMap.set(norm, new Set())
        urlMap.get(norm)!.add(p.page_path)
      }
    }

    // Check keywords table
    const keywords = this.getKeywords()
    for (const k of keywords) {
      if (k.keyword && k.target_url) {
        const norm = k.keyword.toLowerCase().trim()
        if (!urlMap.has(norm)) urlMap.set(norm, new Set())
        urlMap.get(norm)!.add(k.target_url)
      }
    }

    const warnings: Array<{ keyword: string; urls: string[] }> = []
    for (const [kw, urls] of urlMap.entries()) {
      if (urls.size > 1) {
        warnings.push({ keyword: kw, urls: Array.from(urls) })
      }
    }
    return warnings
  }

  // ── Redirects Management ──
  getRedirects(): SeoRedirectRecord[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM seo_redirects ORDER BY created_at DESC').all() as SeoRedirectRecord[]
  }

  saveRedirect(r: Partial<SeoRedirectRecord>): SeoRedirectRecord {
    const db = getDatabase()
    const id = r.id || `red_${uuidv4().substring(0, 8)}`
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO seo_redirects (id, source_path, target_path, status_code, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_path) DO UPDATE SET
        target_path = excluded.target_path,
        status_code = excluded.status_code
    `).run(id, r.source_path, r.target_path, r.status_code || 301, now)

    return db.prepare('SELECT * FROM seo_redirects WHERE id = ?').get(id) as SeoRedirectRecord
  }

  deleteRedirect(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM seo_redirects WHERE id = ?').run(id)
  }

  // ── 404 Logs ──
  get404Logs(): Seo404Record[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM seo_404_logs ORDER BY hit_count DESC LIMIT 50').all() as Seo404Record[]
  }

  log404(path: string, referrer?: string, userAgent?: string): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    const existing = db.prepare('SELECT * FROM seo_404_logs WHERE request_path = ?').get(path) as Seo404Record | undefined

    if (existing) {
      db.prepare('UPDATE seo_404_logs SET hit_count = hit_count + 1, last_seen_at = ? WHERE id = ?')
        .run(now, existing.id)
    } else {
      const id = `err404_${uuidv4().substring(0, 8)}`
      db.prepare('INSERT INTO seo_404_logs (id, request_path, referrer, user_agent, hit_count, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)')
        .run(id, path, referrer || '', userAgent || '', now)
    }
  }

  // ── Audit History ──
  saveAuditReport(score: number, critical: number, warning: number, passed: number, auditJson: any): any {
    const db = getDatabase()
    const id = `audit_${uuidv4().substring(0, 8)}`
    const now = new Date().toISOString()
    const jsonStr = JSON.stringify(auditJson)

    db.prepare('INSERT INTO seo_audit_reports (id, score, critical_count, warning_count, passed_count, audit_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, score, critical, warning, passed, jsonStr, now)

    return { id, score, critical, warning, passed, auditJson, created_at: now }
  }

  getLatestAuditReport(): any | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM seo_audit_reports ORDER BY created_at DESC LIMIT 1').get() as any
    if (!row) return null
    try {
      return { ...row, audit_json: JSON.parse(row.audit_json) }
    } catch {
      return row
    }
  }
}

export const seoRepo = new SeoRepository()
