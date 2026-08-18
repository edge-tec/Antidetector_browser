// ──────────────────────────────────────────────
// AntiProfiles — Migration 009: Referral & Affiliate Commission System
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 9
export const name = '009_referral_affiliate_system'

export function up(db: Database.Database): void {
  // 1. Add referral columns to users table if not exists
  try {
    db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;")
  } catch {}

  try {
    db.exec("ALTER TABLE users ADD COLUMN referred_by TEXT REFERENCES users(id) ON DELETE SET NULL;")
  } catch {}

  // 2. Affiliate Global Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT DEFAULT (datetime('now'))
    );
  `)

  // Seed default settings
  const seedDefaults: Record<string, string> = {
    commission_rate_percent: '10.0',
    holding_period_days: '7',
    min_withdrawal_usd: '20.0',
    enabled_payout_methods: JSON.stringify(['crypto', 'wise', 'payoneer', 'apple_bank']),
    attribution_model: 'first_click',
    self_referral_allowed: '0',
    system_domain: 'https://antiprofiles.com'
  }

  for (const [k, v] of Object.entries(seedDefaults)) {
    db.prepare('INSERT OR IGNORE INTO affiliate_settings (key, value) VALUES (?, ?)').run(k, v)
  }

  // 3. Affiliate Commissions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id                 TEXT PRIMARY KEY,
      referrer_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_id         TEXT,
      order_amount       REAL NOT NULL,
      commission_rate    REAL NOT NULL,
      commission_amount  REAL NOT NULL,
      status             TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'available', 'withdrawn', 'rejected', 'reversed'
      available_at       TEXT,
      reversal_reason    TEXT,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_comm_referrer ON affiliate_commissions(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_aff_comm_referred ON affiliate_commissions(referred_user_id);
    CREATE INDEX IF NOT EXISTS idx_aff_comm_payment ON affiliate_commissions(payment_id);
    CREATE INDEX IF NOT EXISTS idx_aff_comm_status ON affiliate_commissions(status);
  `)

  // 4. Affiliate Withdrawals Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount             REAL NOT NULL,
      payout_method      TEXT NOT NULL, -- 'crypto', 'wise', 'payoneer', 'apple_bank'
      payout_details     TEXT NOT NULL, -- JSON string with wallet/email/etc
      status             TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
      admin_notes        TEXT,
      payout_reference   TEXT, -- Blockchain tx hash, Wise transfer ID, etc.
      requested_at       TEXT DEFAULT (datetime('now')),
      processed_at       TEXT DEFAULT NULL,
      paid_at            TEXT DEFAULT NULL,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_with_user ON affiliate_withdrawals(user_id);
    CREATE INDEX IF NOT EXISTS idx_aff_with_status ON affiliate_withdrawals(status);
  `)

  // 5. Affiliate Ledger (Immutable transaction history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_ledger (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type               TEXT NOT NULL, -- 'commission_credit', 'withdrawal_debit', 'withdrawal_refund', 'admin_adjustment', 'commission_reversal'
      amount             REAL NOT NULL,
      balance_after      REAL NOT NULL,
      reference_id       TEXT, -- commission_id or withdrawal_id
      description        TEXT NOT NULL,
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_aff_ledger_user ON affiliate_ledger(user_id);
  `)

  // 6. Generate referral codes for existing users if missing
  try {
    const usersWithoutCode = db.prepare("SELECT id, name FROM users WHERE referral_code IS NULL OR referral_code = ''").all() as { id: string; name: string }[]
    for (const u of usersWithoutCode) {
      const code = 'REF_' + u.id.slice(0, 4).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
      db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, u.id)
    }
  } catch {}
}
