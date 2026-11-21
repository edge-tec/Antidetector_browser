// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Migration 015: Ultra-Pro Anti-Detect Suite
// Adds Per-Profile 2FA TOTP Account Vault, Cookie Robot History,
// and Fingerprint Stealth Audit Reports.
// ──────────────────────────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 15
export const name = '015_ultra_pro_features'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_vault_accounts (
      id                 TEXT PRIMARY KEY,
      profile_id         TEXT NOT NULL,
      platform           TEXT NOT NULL,
      login_url          TEXT DEFAULT '',
      username           TEXT NOT NULL,
      encrypted_password TEXT DEFAULT '',
      encrypted_totp     TEXT DEFAULT '',
      notes              TEXT DEFAULT '',
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_vault_profile ON profile_vault_accounts(profile_id);

    CREATE TABLE IF NOT EXISTS cookie_robot_runs (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'running',
      urls_total      INTEGER NOT NULL DEFAULT 0,
      urls_visited    INTEGER NOT NULL DEFAULT 0,
      cookies_gained  INTEGER NOT NULL DEFAULT 0,
      error_message   TEXT DEFAULT '',
      started_at      TEXT DEFAULT (datetime('now')),
      completed_at    TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cookie_robot_profile ON cookie_robot_runs(profile_id);

    CREATE TABLE IF NOT EXISTS profile_stealth_audits (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL,
      score           INTEGER NOT NULL DEFAULT 0,
      grade           TEXT NOT NULL DEFAULT 'C',
      checks_json     TEXT NOT NULL DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stealth_audit_profile ON profile_stealth_audits(profile_id);
  `)
}
