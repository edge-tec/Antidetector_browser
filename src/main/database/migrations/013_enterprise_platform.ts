// ──────────────────────────────────────────────────────────────────
// Migration 013 — Enterprise Platform Tables & Soft-Delete Columns
// Additive, backward-compatible migration preserving all existing data
// ──────────────────────────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 13
export const name = '013_enterprise_platform'

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  } catch {}
}

export function up(db: Database.Database): void {
  // 1. Soft-delete Trash columns on profiles
  addColumnIfMissing(db, 'profiles', 'deleted_at', 'TEXT DEFAULT NULL')
  addColumnIfMissing(db, 'profiles', 'deleted_by', 'TEXT DEFAULT NULL')
  addColumnIfMissing(db, 'profiles', 'team_id', 'TEXT DEFAULT NULL')

  // 2. Proxy rotation & failover columns on proxies
  addColumnIfMissing(db, 'proxies', 'rotation_url', "TEXT DEFAULT ''")
  addColumnIfMissing(db, 'proxies', 'failover_proxy_id', 'TEXT DEFAULT NULL')
  addColumnIfMissing(db, 'proxies', 'proxy_group', "TEXT DEFAULT ''")
  addColumnIfMissing(db, 'proxies', 'last_rotated_at', 'TEXT DEFAULT NULL')

  // 3. Centralized Extension Center tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS extensions (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      version           TEXT NOT NULL DEFAULT '1.0.0',
      manifest_version  INTEGER NOT NULL DEFAULT 3,
      description       TEXT DEFAULT '',
      storage_path      TEXT NOT NULL,
      permissions_json  TEXT DEFAULT '[]',
      risk_warnings     TEXT DEFAULT '[]',
      sha256            TEXT DEFAULT '',
      enabled           INTEGER NOT NULL DEFAULT 1,
      uploaded_by       TEXT DEFAULT '',
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_extensions (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT,
      group_id      TEXT,
      extension_id  TEXT NOT NULL,
      enabled       INTEGER NOT NULL DEFAULT 1,
      installed_at  TEXT NOT NULL,
      FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_profile_ext_profile ON profile_extensions(profile_id);
    CREATE INDEX IF NOT EXISTS idx_profile_ext_group ON profile_extensions(group_id);
  `)

  // 4. No-Code RPA Automation Workflows & Execution History
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_workflows (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT DEFAULT '',
      steps_json      TEXT NOT NULL DEFAULT '[]',
      variables_json  TEXT DEFAULT '{}',
      schedule_cron   TEXT DEFAULT '',
      schedule_tz     TEXT DEFAULT 'UTC',
      schedule_active INTEGER NOT NULL DEFAULT 0,
      max_retries     INTEGER NOT NULL DEFAULT 1,
      created_by      TEXT DEFAULT '',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_executions (
      id            TEXT PRIMARY KEY,
      workflow_id   TEXT NOT NULL,
      profile_id    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'queued',
      logs_json     TEXT DEFAULT '[]',
      error         TEXT DEFAULT '',
      started_at    TEXT NOT NULL,
      finished_at   TEXT DEFAULT NULL,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auto_exec_workflow ON automation_executions(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_auto_exec_profile ON automation_executions(profile_id);
  `)

  // 5. E2E Encrypted Cloud Profile Backups
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_backups (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL,
      version_num     INTEGER NOT NULL DEFAULT 1,
      provider        TEXT NOT NULL DEFAULT 'local-vault',
      remote_key      TEXT NOT NULL,
      sha256          TEXT NOT NULL,
      size_bytes      INTEGER NOT NULL DEFAULT 0,
      iv_hex          TEXT NOT NULL,
      salt_hex        TEXT NOT NULL,
      auth_tag_hex    TEXT NOT NULL,
      created_by      TEXT DEFAULT '',
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cloud_backups_profile ON cloud_backups(profile_id);
  `)

  // 6. Enterprise Team Workspace & Granular RBAC
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      owner_id    TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id          TEXT PRIMARY KEY,
      team_id     TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'operator',
      joined_at   TEXT NOT NULL,
      UNIQUE(team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_invitations (
      id          TEXT PRIMARY KEY,
      team_id     TEXT NOT NULL,
      email       TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'operator',
      token       TEXT NOT NULL UNIQUE,
      status      TEXT NOT NULL DEFAULT 'pending',
      invited_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile_shares (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL,
      team_id         TEXT NOT NULL,
      target_user_id  TEXT,
      can_edit        INTEGER NOT NULL DEFAULT 0,
      can_launch      INTEGER NOT NULL DEFAULT 1,
      hide_proxy_pass INTEGER NOT NULL DEFAULT 1,
      shared_by       TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_profile_shares_profile ON profile_shares(profile_id);
  `)

  // 7. Proxy Rotation History
  db.exec(`
    CREATE TABLE IF NOT EXISTS proxy_rotation_history (
      id          TEXT PRIMARY KEY,
      proxy_id    TEXT NOT NULL,
      old_ip      TEXT DEFAULT '',
      new_ip      TEXT DEFAULT '',
      success     INTEGER NOT NULL DEFAULT 0,
      message     TEXT DEFAULT '',
      rotated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_proxy_rot_proxy ON proxy_rotation_history(proxy_id);
  `)
}
