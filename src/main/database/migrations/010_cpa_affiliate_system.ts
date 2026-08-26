// ──────────────────────────────────────────────
// AntiProfiles — Migration 010: CPA Affiliate Tracking, Offers, Postback & Withdrawal System
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 10
export const name = '010_cpa_affiliate_system'

export function up(db: Database.Database): void {
  // 1. Add affiliate specific columns to users if missing
  try {
    db.exec("ALTER TABLE users ADD COLUMN affiliate_id TEXT UNIQUE;")
  } catch {}

  try {
    db.exec("ALTER TABLE users ADD COLUMN affiliate_status TEXT DEFAULT 'active';") // 'active', 'suspended', 'disabled'
  } catch {}

  // 2. Affiliate Offers / Campaigns Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_offers (
      id                 TEXT PRIMARY KEY,
      title              TEXT NOT NULL,
      description        TEXT,
      target_url         TEXT NOT NULL,
      payout_type        TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
      commission_rate    REAL NOT NULL DEFAULT 10.0,
      fixed_payout_usd   REAL NOT NULL DEFAULT 0.0,
      currency           TEXT NOT NULL DEFAULT 'USD',
      status             TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'archived'
      total_clicks       INTEGER NOT NULL DEFAULT 0,
      total_conversions  INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_offers_status ON affiliate_offers(status);
  `)

  // Seed default CPA offers if empty
  const existingOffers = db.prepare('SELECT COUNT(*) as count FROM affiliate_offers').get() as { count: number }
  if (existingOffers.count === 0) {
    db.prepare(`
      INSERT INTO affiliate_offers (id, title, description, target_url, payout_type, commission_rate, fixed_payout_usd, status)
      VALUES
        ('offer_main_saas', 'AntiProfiles Pro & Team Subscription', 'Lifetime recurring CPA commission on all plan upgrades', 'https://antiprofiles.com/pricing', 'percentage', 15.0, 0.0, 'active'),
        ('offer_starter_pack', 'AntiProfiles Starter License', 'Fixed $10 payout per first-time starter license purchase', 'https://antiprofiles.com/register', 'fixed', 0.0, 10.0, 'active'),
        ('offer_enterprise_leads', 'AntiProfiles Enterprise Custom Trial', 'High-ticket enterprise trial onboarding commission', 'https://antiprofiles.com/contact', 'percentage', 20.0, 0.0, 'active')
    `).run()
  }

  // 3. Affiliate Tracking Links Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_tracking_links (
      id                 TEXT PRIMARY KEY,
      affiliate_id       TEXT NOT NULL,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id           TEXT NOT NULL REFERENCES affiliate_offers(id) ON DELETE CASCADE,
      tracking_url       TEXT NOT NULL,
      custom_params      TEXT, -- JSON metadata
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_links_user ON affiliate_tracking_links(user_id);
    CREATE INDEX IF NOT EXISTS idx_aff_links_offer ON affiliate_tracking_links(offer_id);
    CREATE INDEX IF NOT EXISTS idx_aff_links_aff ON affiliate_tracking_links(affiliate_id);
  `)

  // 4. Affiliate Clicks Table (Immutable Click Stream)
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      click_id           TEXT PRIMARY KEY,
      affiliate_id       TEXT NOT NULL,
      offer_id           TEXT NOT NULL,
      tracking_link_id   TEXT,
      ip_address         TEXT,
      user_agent         TEXT,
      referrer           TEXT,
      landing_url        TEXT NOT NULL,
      sub_id1            TEXT,
      sub_id2            TEXT,
      sub_id3            TEXT,
      sub_id4            TEXT,
      sub_id5            TEXT,
      converted          INTEGER NOT NULL DEFAULT 0,
      conversion_id      TEXT,
      conversion_at      TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_clicks_aff ON affiliate_clicks(affiliate_id);
    CREATE INDEX IF NOT EXISTS idx_aff_clicks_offer ON affiliate_clicks(offer_id);
    CREATE INDEX IF NOT EXISTS idx_aff_clicks_converted ON affiliate_clicks(converted);
    CREATE INDEX IF NOT EXISTS idx_aff_clicks_created ON affiliate_clicks(created_at);
  `)

  // 5. Affiliate Conversions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_conversions (
      conversion_id      TEXT PRIMARY KEY,
      click_id           TEXT NOT NULL UNIQUE,
      affiliate_id       TEXT NOT NULL,
      offer_id           TEXT NOT NULL,
      user_id            TEXT,
      order_amount       REAL NOT NULL DEFAULT 0.0,
      payout_amount      REAL NOT NULL DEFAULT 0.0,
      currency           TEXT NOT NULL DEFAULT 'USD',
      status             TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      idempotency_key    TEXT UNIQUE,
      meta_json          TEXT,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_conv_click ON affiliate_conversions(click_id);
    CREATE INDEX IF NOT EXISTS idx_aff_conv_aff ON affiliate_conversions(affiliate_id);
    CREATE INDEX IF NOT EXISTS idx_aff_conv_status ON affiliate_conversions(status);
  `)

  // 6. Affiliate Postback Configurations Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_postback_configs (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      affiliate_id       TEXT NOT NULL UNIQUE,
      postback_url       TEXT NOT NULL,
      http_method        TEXT NOT NULL DEFAULT 'GET', -- 'GET' or 'POST'
      is_active          INTEGER NOT NULL DEFAULT 1,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_pbcfg_user ON affiliate_postback_configs(user_id);
  `)

  // 7. Affiliate Postbacks Delivery Log Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_postbacks (
      id                 TEXT PRIMARY KEY,
      conversion_id      TEXT NOT NULL REFERENCES affiliate_conversions(conversion_id) ON DELETE CASCADE,
      click_id           TEXT NOT NULL,
      affiliate_id       TEXT NOT NULL,
      url                TEXT NOT NULL,
      http_method        TEXT NOT NULL DEFAULT 'GET',
      http_status        INTEGER,
      response_body      TEXT,
      attempt_count      INTEGER NOT NULL DEFAULT 1,
      status             TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'confirmed', 'failed', 'retrying'
      error_message      TEXT,
      last_attempt_at    TEXT DEFAULT (datetime('now')),
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_pb_conv ON affiliate_postbacks(conversion_id);
    CREATE INDEX IF NOT EXISTS idx_aff_pb_status ON affiliate_postbacks(status);
    CREATE INDEX IF NOT EXISTS idx_aff_pb_aff ON affiliate_postbacks(affiliate_id);
  `)

  // 8. Affiliate Audit Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_audit_logs (
      id                 TEXT PRIMARY KEY,
      action             TEXT NOT NULL, -- e.g. 'withdrawal_approved', 'withdrawal_paid', 'affiliate_suspended', 'postback_retried'
      performed_by       TEXT NOT NULL, -- admin user id or 'system'
      target_id          TEXT NOT NULL, -- withdrawal_id, affiliate_id, etc.
      details            TEXT NOT NULL, -- JSON string or description
      ip_address         TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_audit_target ON affiliate_audit_logs(target_id);
    CREATE INDEX IF NOT EXISTS idx_aff_audit_action ON affiliate_audit_logs(action);
  `)

  // 9. Backfill affiliate_id for all users if not set
  try {
    const allUsers = db.prepare("SELECT id, referral_code, affiliate_id FROM users").all() as { id: string; referral_code?: string; affiliate_id?: string }[]
    for (const u of allUsers) {
      if (!u.affiliate_id) {
        const affId = 'AFF-' + (u.referral_code ? u.referral_code.replace(/^REF_/, '') : u.id.slice(0, 6).toUpperCase())
        db.prepare('UPDATE users SET affiliate_id = ? WHERE id = ?').run(affId, u.id)
      }
    }
  } catch {}
}
