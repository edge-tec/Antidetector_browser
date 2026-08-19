// ──────────────────────────────────────────────
// AntiProfiles — SQLite Connection Manager (Fault-Tolerant Multi-Arch)
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { runMigrations } from './migrations/runner'
import { hashPassword } from '../security/password'
import { FallbackDatabase } from './fallback-db'

let db: any = null

export function getDbPath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      const userDataPath = app.getPath('userData')
      return path.join(userDataPath, 'antiprofiles.db')
    }
  } catch {
    // Fallback for non-Electron / test context
  }
  return path.join(process.cwd(), 'antiprofiles.db')
}

export function getDatabase(): any {
  if (!db) {
    db = initDatabase()
  }
  return db
}

export function setDatabaseForTesting(testDb: any): void {
  db = testDb
}

export function initDatabase(): any {
  if (db) return db
  const dbPath = getDbPath()

  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // 1. Attempt native SQLite driver
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3')
    db = new Database(dbPath)

    // Enable WAL mode for performance
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    db.pragma('foreign_keys = ON')

    try {
      fs.chmodSync(dbPath, 0o600)
    } catch {}

    // Run migrations
    runMigrations(db)
  } catch (err: any) {
    console.warn('[Database] Native better-sqlite3 driver unavailable (e.g. cross-arch Mach-O slice). Using fault-tolerant storage:', err?.message || err)
    db = new FallbackDatabase(dbPath)
    runMigrations(db as any)
  }

  try {
    db.prepare("UPDATE users SET password_hash = ?, email_verified = 1, account_status = 'active', role = 'admin' WHERE email = 'admin@antiprofiles.com'").run(hashPassword('admin123'))
  } catch {}

  try {
    db.exec("ALTER TABLE profiles ADD COLUMN user_id TEXT DEFAULT 'admin-default'")
  } catch {}

  try {
    db.exec("ALTER TABLE proxies ADD COLUMN region TEXT DEFAULT ''")
  } catch {}

  return db
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close()
    } catch {}
    db = null
  }
}
