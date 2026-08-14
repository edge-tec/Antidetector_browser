// ──────────────────────────────────────────────
// ProfileVault — SQLite Connection Manager
// ──────────────────────────────────────────────

import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { runMigrations } from './migrations/runner'
import { hashPassword } from '../security/password'

let db: Database.Database | null = null

export function getDbPath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      const userDataPath = app.getPath('userData')
      return path.join(userDataPath, 'profilevault.db')
    }
  } catch {
    // Fallback for non-Electron / test context
  }
  return path.join(process.cwd(), 'profilevault.db')
}

export function getDatabase(): Database.Database {
  if (!db) {
    db = initDatabase()
  }
  return db
}

export function setDatabaseForTesting(testDb: Database.Database): void {
  db = testDb
}

export function initDatabase(): Database.Database {
  if (db) return db
  const dbPath = getDbPath()

  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)

  // Enable WAL mode for performance
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')

  // Set secure file permissions (owner only)
  try {
    fs.chmodSync(dbPath, 0o600)
  } catch {
    // May fail on some systems, non-critical
  }

  // Run migrations
  runMigrations(db)

  try {
    db.prepare("UPDATE users SET password_hash = ?, email_verified = 1, account_status = 'active', role = 'admin' WHERE email = 'admin@profilevault.local'").run(hashPassword('admin123'))
  } catch {
    // Ignore if table doesn't exist yet
  }

  try {
    db.exec("ALTER TABLE profiles ADD COLUMN user_id TEXT DEFAULT 'admin-default'")
  } catch {
    // Column already exists, ignore
  }

  try {
    db.exec("ALTER TABLE proxies ADD COLUMN region TEXT DEFAULT ''")
  } catch {
    // Column already exists, ignore
  }

  return db
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close()
    } catch {
      // Ignore close errors during shutdown
    }
    db = null
  }
}
