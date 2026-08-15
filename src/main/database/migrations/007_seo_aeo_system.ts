// ──────────────────────────────────────────────
// ProfileVault — Migration 007: Google SEO + AI Search Optimization (AEO/GEO) System
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 7
export const name = '007_seo_aeo_system'

export function up(db: Database.Database): void {
  // 1. Global SEO Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS seo_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Seed default global SEO & AEO settings if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM seo_settings').get() as any)?.c || 0
  if (count === 0) {
    const defaultSettings: Record<string, string> = {
      seo_enabled: '1',
      schema_enabled: '1',
      sitemap_enabled: '1',
      robots_enabled: '1',
      og_enabled: '1',
      ai_aeo_enabled: '1',
      internal_links_enabled: '1',
      seo_audit_enabled: '1',
      content_assistant_enabled: '1',
      site_name: 'ProfileVault',
      site_description: 'Professional Multi-Account Anti-Detect Browser with Isolated Profiles, Fingerprint Spoofing & Residential Proxy Support.',
      site_url: 'https://profilevault.local',
      default_og_image: 'https://profilevault.local/og-cover.png',
      twitter_handle: '@ProfileVaultApp',
      robots_content: "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://profilevault.local/sitemap.xml",
      entity_brand_name: 'ProfileVault Software Inc.',
      entity_logo: 'https://profilevault.local/logo.png',
      entity_email: 'support@profilevault.local',
      entity_phone: '+1 (800) 555-0199',
      entity_same_as: '["https://x.com/ProfileVaultApp", "https://github.com/edge-tec/Antidetector_browser"]'
    }

    const stmt = db.prepare('INSERT OR REPLACE INTO seo_settings (key, value) VALUES (?, ?)')
    for (const [k, v] of Object.entries(defaultSettings)) {
      stmt.run(k, v)
    }
  }

  // 2. Page SEO & AEO Metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_seo (
      id                  TEXT PRIMARY KEY,
      page_path           TEXT NOT NULL UNIQUE,
      page_type           TEXT NOT NULL DEFAULT 'webpage',
      title               TEXT NOT NULL,
      description         TEXT NOT NULL,
      keywords            TEXT,
      canonical_url       TEXT,
      robots              TEXT DEFAULT 'index, follow',
      og_title            TEXT,
      og_description      TEXT,
      og_image            TEXT,
      twitter_card        TEXT DEFAULT 'summary_large_image',
      twitter_title       TEXT,
      twitter_description TEXT,
      schema_type         TEXT DEFAULT 'SoftwareApplication',
      primary_keyword     TEXT,
      ai_quick_answer     TEXT,
      structured_data_json TEXT,
      updated_at          TEXT DEFAULT (datetime('now'))
    )
  `)

  // Seed default homepage SEO entry if empty
  db.prepare(`
    INSERT OR IGNORE INTO page_seo (
      id, page_path, page_type, title, description, keywords, canonical_url, robots,
      og_title, og_description, og_image, schema_type, primary_keyword, ai_quick_answer
    ) VALUES (
      'page_home', '/', 'homepage',
      'ProfileVault — Anti-Detect Browser & Multi-Account Management Tool',
      'Manage thousands of social media, e-commerce, and ads accounts seamlessly with 100% isolated browser profiles, fingerprint spoofing, and residential proxies.',
      'anti detect browser, multi account browser, browser profile isolation, fingerprint spoofing, proxy manager',
      'https://profilevault.local/',
      'index, follow',
      'ProfileVault — Anti-Detect Browser & Profile Isolation',
      'Professional anti-detect browser for managing isolated web profiles without bans.',
      'https://profilevault.local/og-cover.png',
      'SoftwareApplication',
      'anti detect browser',
      'ProfileVault is a software platform designed for privacy, browser profile isolation, and multi-account management. It allows users to run separate Chromium instances with unique canvas, WebGL, WebRTC, and proxy configurations.'
    )
  `).run()

  // 3. Keywords Management
  db.exec(`
    CREATE TABLE IF NOT EXISTS seo_keywords (
      id              TEXT PRIMARY KEY,
      keyword         TEXT NOT NULL,
      keyword_type    TEXT DEFAULT 'primary',
      search_intent   TEXT DEFAULT 'commercial',
      target_url      TEXT NOT NULL,
      country         TEXT DEFAULT 'US',
      language        TEXT DEFAULT 'en',
      status          TEXT DEFAULT 'active',
      ranking_position INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS seo_keywords_new (
        id              TEXT PRIMARY KEY,
        keyword         TEXT NOT NULL,
        keyword_type    TEXT DEFAULT 'primary',
        search_intent   TEXT DEFAULT 'commercial',
        target_url      TEXT NOT NULL,
        country         TEXT DEFAULT 'US',
        language        TEXT DEFAULT 'en',
        status          TEXT DEFAULT 'active',
        ranking_position INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO seo_keywords_new SELECT * FROM seo_keywords;
      DROP TABLE seo_keywords;
      ALTER TABLE seo_keywords_new RENAME TO seo_keywords;
    `)
  } catch {}

  // 4. Redirects Management (301 / 302)
  db.exec(`
    CREATE TABLE IF NOT EXISTS seo_redirects (
      id          TEXT PRIMARY KEY,
      source_path TEXT NOT NULL UNIQUE,
      target_path TEXT NOT NULL,
      status_code INTEGER DEFAULT 301,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `)

  // 5. 404 Error Log Tracker
  db.exec(`
    CREATE TABLE IF NOT EXISTS seo_404_logs (
      id           TEXT PRIMARY KEY,
      request_path TEXT NOT NULL,
      referrer     TEXT,
      user_agent   TEXT,
      hit_count    INTEGER DEFAULT 1,
      last_seen_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // 6. Automated Internal Link Recommendations
  db.exec(`
    CREATE TABLE IF NOT EXISTS seo_internal_links (
      id           TEXT PRIMARY KEY,
      source_page  TEXT NOT NULL,
      target_page  TEXT NOT NULL,
      anchor_text  TEXT NOT NULL,
      status       TEXT DEFAULT 'suggested',
      created_at   TEXT DEFAULT (datetime('now'))
    )
  `)

  // 7. Site Audit History Reports
  db.exec(`
    CREATE TABLE IF NOT EXISTS seo_audit_reports (
      id             TEXT PRIMARY KEY,
      score          INTEGER NOT NULL,
      critical_count INTEGER NOT NULL,
      warning_count  INTEGER NOT NULL,
      passed_count   INTEGER NOT NULL,
      audit_json     TEXT NOT NULL,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `)
}
