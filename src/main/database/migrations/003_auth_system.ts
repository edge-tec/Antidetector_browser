// ──────────────────────────────────────────────
// ProfileVault — Authentication & User System Migration
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

import { hashPassword } from '../../security/password'

export const id = 3
export const name = '003_auth_system'

export function up(db: Database.Database): void {
  db.exec(`
    -- ═══════════════════════════════════════════
    -- Users Table
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT,
      role            TEXT NOT NULL DEFAULT 'user',
      email_verified  INTEGER NOT NULL DEFAULT 0,
      account_status  TEXT NOT NULL DEFAULT 'pending',
      google_id       TEXT UNIQUE,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      last_login_at   TEXT
    );

    -- ═══════════════════════════════════════════
    -- Email Verification Tokens Table
    -- ═══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      used_at     TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for authentication lookups
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
    CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON email_verification_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_hash ON email_verification_tokens(token_hash);
  `)

  // Safely add user_id column to profiles table if not existing
  try {
    db.exec("ALTER TABLE profiles ADD COLUMN user_id TEXT DEFAULT 'admin-default' REFERENCES users(id) ON DELETE CASCADE;")
  } catch {
    // Column already exists
  }

  // Create default Admin account if no users exist
  const defaultAdminHash = hashPassword('admin123')

  const adminUser = db.prepare("SELECT id FROM users WHERE email = 'admin@profilevault.local'").get()
  if (!adminUser) {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, email_verified, account_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      'admin-default',
      'System Admin',
      'admin@profilevault.local',
      defaultAdminHash,
      'admin',
      1, // Verified
      'active'
    )
  } else {
    // Ensure default admin password hash and verified status
    db.prepare("UPDATE users SET password_hash = ?, email_verified = 1, account_status = 'active', role = 'admin' WHERE email = 'admin@profilevault.local'").run(defaultAdminHash)
  }

  // Ensure all profiles are linked to an active user ID
  db.exec("UPDATE profiles SET user_id = 'admin-default' WHERE user_id IS NULL OR user_id = '';")
  db.exec("CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);")
}
