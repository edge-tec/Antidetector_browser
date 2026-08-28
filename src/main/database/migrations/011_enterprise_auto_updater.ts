// ──────────────────────────────────────────────
// AntiProfiles — Migration 011: Enterprise Auto-Update Settings & Channels
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 11
export const name = '011_enterprise_auto_updater'

export function up(db: Database.Database): void {
  // 1. Add extra fields to software_versions if missing
  try { db.exec("ALTER TABLE software_versions ADD COLUMN build TEXT DEFAULT '1'") } catch {}
  try { db.exec("ALTER TABLE software_versions ADD COLUMN channel TEXT DEFAULT 'stable'") } catch {}
  try { db.exec("ALTER TABLE software_versions ADD COLUMN download_count INTEGER DEFAULT 0") } catch {}
  try { db.exec("ALTER TABLE software_versions ADD COLUMN signature TEXT DEFAULT ''") } catch {}

  // 2. Client Auto-Update Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS software_update_settings (
      id                      TEXT PRIMARY KEY DEFAULT 'default',
      channel                 TEXT NOT NULL DEFAULT 'stable', -- 'stable', 'beta', 'alpha', 'internal'
      auto_download           INTEGER NOT NULL DEFAULT 1,
      auto_install            INTEGER NOT NULL DEFAULT 0,
      notify_only             INTEGER NOT NULL DEFAULT 0,
      check_frequency_hours   INTEGER NOT NULL DEFAULT 6,
      last_checked_at         TEXT DEFAULT NULL,
      download_dir            TEXT DEFAULT '',
      updated_at              TEXT DEFAULT (datetime('now'))
    );
  `)

  // 3. Client Update Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS software_update_logs (
      id              TEXT PRIMARY KEY,
      user_id         TEXT DEFAULT '',
      from_version    TEXT NOT NULL,
      to_version      TEXT NOT NULL,
      os              TEXT NOT NULL,
      architecture    TEXT NOT NULL,
      channel         TEXT NOT NULL DEFAULT 'stable',
      status          TEXT NOT NULL, -- 'checking', 'download_started', 'download_completed', 'install_success', 'install_failed', 'rollback_success'
      error_message   TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `)

  // 4. Seed default settings
  db.exec(`
    INSERT OR IGNORE INTO software_update_settings (
      id, channel, auto_download, auto_install, notify_only, check_frequency_hours, last_checked_at
    ) VALUES (
      'default', 'stable', 1, 0, 0, 6, datetime('now')
    );
  `)
}
