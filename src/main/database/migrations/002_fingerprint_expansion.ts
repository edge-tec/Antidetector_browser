// ──────────────────────────────────────────────
// AntiProfiles — Migration 002: Fingerprint Expansion
// Expands schema for full anti-detect browser support
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 2
export const name = '002_fingerprint_expansion'

export function up(db: Database.Database): void {
  db.exec(`
    -- ═══════════════════════════════════════════
    -- Expand profiles table with fingerprint JSON
    -- ═══════════════════════════════════════════
    ALTER TABLE profiles ADD COLUMN os_type TEXT DEFAULT 'windows-10';
    ALTER TABLE profiles ADD COLUMN fingerprint TEXT DEFAULT '{}';
    ALTER TABLE profiles ADD COLUMN folder TEXT DEFAULT '';
    ALTER TABLE profiles ADD COLUMN profile_locked INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN lock_device_id TEXT;
    ALTER TABLE profiles ADD COLUMN consistency_score REAL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN fingerprint_seed TEXT DEFAULT '';
    ALTER TABLE profiles ADD COLUMN start_url TEXT DEFAULT '';
    ALTER TABLE profiles ADD COLUMN launch_args TEXT DEFAULT '[]';
    ALTER TABLE profiles ADD COLUMN save_history INTEGER DEFAULT 1;
    ALTER TABLE profiles ADD COLUMN save_passwords INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN google_services INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN system_extensions INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN custom_dns TEXT DEFAULT '';
    ALTER TABLE profiles ADD COLUMN last_modified TEXT;

    -- ═══════════════════════════════════════════
    -- Expand proxies table with geo metadata
    -- ═══════════════════════════════════════════
    ALTER TABLE proxies ADD COLUMN protocol TEXT DEFAULT 'http';
    ALTER TABLE proxies ADD COLUMN country TEXT DEFAULT '';
    ALTER TABLE proxies ADD COLUMN region TEXT DEFAULT '';
    ALTER TABLE proxies ADD COLUMN city TEXT DEFAULT '';
    ALTER TABLE proxies ADD COLUMN isp TEXT DEFAULT '';
    ALTER TABLE proxies ADD COLUMN asn TEXT DEFAULT '';
    ALTER TABLE proxies ADD COLUMN latency_ms INTEGER;
    ALTER TABLE proxies ADD COLUMN pool_id TEXT;
    ALTER TABLE proxies ADD COLUMN rotation_url TEXT DEFAULT '';

    -- ═══════════════════════════════════════════
    -- Profile templates
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      os_type     TEXT NOT NULL,
      description TEXT DEFAULT '',
      fingerprint TEXT NOT NULL DEFAULT '{}',
      is_builtin  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════
    -- Profile extensions
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS extensions (
      id           TEXT PRIMARY KEY,
      profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      extension_id TEXT NOT NULL,
      name         TEXT NOT NULL,
      version      TEXT DEFAULT '',
      enabled      INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_extensions_profile ON extensions(profile_id);

    -- ═══════════════════════════════════════════
    -- Profile bookmarks
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS bookmarks (
      id         TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      url        TEXT NOT NULL,
      folder     TEXT DEFAULT '',
      position   INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_profile ON bookmarks(profile_id);

    -- ═══════════════════════════════════════════
    -- Proxy pools for rotation
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS proxy_pools (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      rotation    TEXT DEFAULT 'round-robin',
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════
    -- New indexes
    -- ═══════════════════════════════════════════
    CREATE INDEX IF NOT EXISTS idx_profiles_os_type ON profiles(os_type);
    CREATE INDEX IF NOT EXISTS idx_profiles_folder ON profiles(folder);
    CREATE INDEX IF NOT EXISTS idx_profiles_consistency ON profiles(consistency_score);
    CREATE INDEX IF NOT EXISTS idx_proxies_country ON proxies(country);
    CREATE INDEX IF NOT EXISTS idx_proxies_pool ON proxies(pool_id);
  `)
}
