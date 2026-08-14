// ──────────────────────────────────────────────
// ProfileVault — Migration 005: Subscriptions, Licensing & Desktop App Config
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 5
export const name = '005_subscriptions_and_licenses'

export function up(db: Database.Database): void {
  // 1. Subscriptions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan_id            TEXT NOT NULL REFERENCES pricing_plans(id),
      status             TEXT NOT NULL DEFAULT 'active', -- active, trial, past_due, expired, cancelled, suspended, pending
      starts_at          TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at         TEXT NOT NULL DEFAULT (datetime('now', '+30 days')),
      grace_period_days  INTEGER DEFAULT 3,
      auto_renew         INTEGER DEFAULT 1,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );
  `)

  // 2. Desktop Installations Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS desktop_installations (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      installation_id  TEXT NOT NULL UNIQUE,
      platform         TEXT NOT NULL, -- windows, macos, linux
      device_name      TEXT NOT NULL,
      app_version      TEXT NOT NULL,
      last_seen_at     TEXT DEFAULT (datetime('now')),
      revoked_at       TEXT DEFAULT NULL,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );
  `)

  // 3. License Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_sessions (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      installation_id   TEXT NOT NULL REFERENCES desktop_installations(installation_id) ON DELETE CASCADE,
      token_hash        TEXT NOT NULL,
      expires_at        TEXT NOT NULL,
      last_validated_at TEXT DEFAULT (datetime('now')),
      revoked_at        TEXT DEFAULT NULL,
      created_at        TEXT DEFAULT (datetime('now'))
    );
  `)

  // 4. Desktop App Global Configuration Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS desktop_app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Default Desktop App & Release Configuration Seed
  const defaultAppConfig = [
    ['win_download_url', 'https://releases.profilevault.local/ProfileVault-Windows-x64.exe'],
    ['win_app_version', '1.0.0'],
    ['win_enabled', 'true'],
    ['mac_intel_download_url', 'https://releases.profilevault.local/ProfileVault-macOS-Intel-x64.dmg'],
    ['mac_intel_app_version', '1.0.0'],
    ['mac_intel_enabled', 'true'],
    ['mac_arm_download_url', 'https://releases.profilevault.local/ProfileVault-macOS-Apple-Silicon-arm64.dmg'],
    ['mac_arm_app_version', '1.0.0'],
    ['mac_arm_enabled', 'true'],
    ['release_notes', 'Initial stable release with multi-profile isolation, proxy bridge, and team controls.'],
    ['min_supported_version', '1.0.0'],
    ['force_update', 'false'],
    ['license_check_interval_hours', '24'],
    ['offline_allowance_hours', '72'],
    ['max_devices_limit', '2'],
    ['maintenance_mode', 'false'],
    ['download_button_text', 'Download Desktop Application']
  ]

  const insertConfig = db.prepare('INSERT OR IGNORE INTO desktop_app_config (key, value) VALUES (?, ?)')
  defaultAppConfig.forEach(([k, v]) => insertConfig.run(k, v))

  // Seed default free/pro subscriptions for existing users
  const existingUsers = db.prepare('SELECT id, role FROM users').all() as { id: string; role: string }[]
  const insertSub = db.prepare(`
    INSERT OR IGNORE INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days)
    VALUES (?, ?, ?, 'active', datetime('now'), datetime('now', '+1 year'), 3)
  `)

  existingUsers.forEach((u) => {
    const subId = `sub_${u.id}`
    const planId = u.role === 'admin' ? 'plan_pro' : 'plan_starter'
    insertSub.run(subId, u.id, planId)
  })
}
