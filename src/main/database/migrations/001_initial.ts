// ──────────────────────────────────────────────
// AntiProfiles — Initial Database Migration
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 1
export const name = '001_initial_schema'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      color         TEXT DEFAULT '#6366F1',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proxies (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      type                TEXT NOT NULL DEFAULT 'direct',
      host                TEXT DEFAULT '',
      port                INTEGER DEFAULT 0,
      username            TEXT DEFAULT '',
      encrypted_password  BLOB,
      last_tested         TEXT,
      test_status         TEXT DEFAULT 'untested',
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      group_id          TEXT REFERENCES groups(id) ON DELETE SET NULL,
      notes             TEXT DEFAULT '',
      color             TEXT DEFAULT '#6366F1',
      icon              TEXT DEFAULT 'globe',
      browser_version   TEXT DEFAULT 'latest',
      user_agent        TEXT DEFAULT '',
      language          TEXT DEFAULT 'en-US',
      timezone          TEXT DEFAULT 'America/New_York',
      screen_width      INTEGER DEFAULT 1920,
      screen_height     INTEGER DEFAULT 1080,
      webrtc_mode       TEXT DEFAULT 'default',
      canvas_mode       TEXT DEFAULT 'default',
      webgl_mode        TEXT DEFAULT 'default',
      hw_concurrency    INTEGER DEFAULT 0,
      device_memory     INTEGER DEFAULT 0,
      hw_acceleration   INTEGER DEFAULT 1,
      proxy_id          TEXT REFERENCES proxies(id) ON DELETE SET NULL,
      tags              TEXT DEFAULT '[]',
      status            TEXT DEFAULT 'stopped',
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now')),
      last_used_at      TEXT,
      pid               INTEGER
    );

    CREATE TABLE IF NOT EXISTS logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      level       TEXT NOT NULL,
      category    TEXT NOT NULL,
      message     TEXT NOT NULL,
      details     TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON profiles(group_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
    CREATE INDEX IF NOT EXISTS idx_profiles_last_used ON profiles(last_used_at);
    CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);

    -- Default settings
    INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('chromiumPath', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('autoDownloadChromium', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('apiEnabled', 'false');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('apiPort', '37100');
  `)
}
