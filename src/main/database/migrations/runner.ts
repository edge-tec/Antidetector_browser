// ──────────────────────────────────────────────
// AntiProfiles — Migration Runner
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'
import * as migration001 from './001_initial'
import * as migration002 from './002_fingerprint_expansion'
import * as migration003 from './003_auth_system'
import * as migration004 from './004_landing_cms'
import * as migration005 from './005_subscriptions_and_licenses'
import * as migration006 from './006_live_support_system'
import * as migration007 from './007_seo_aeo_system'
import * as migration008 from './008_software_version_management'
import * as migration009 from './009_referral_affiliate_system'
import * as migration010 from './010_cpa_affiliate_system'
import * as migration011 from './011_enterprise_auto_updater'

interface Migration {
  id: number
  name: string
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  { id: migration001.id, name: migration001.name, up: migration001.up },
  { id: migration002.id, name: migration002.name, up: migration002.up },
  { id: migration003.id, name: migration003.name, up: migration003.up },
  { id: migration004.id, name: migration004.name, up: migration004.up },
  { id: migration005.id, name: migration005.name, up: migration005.up },
  { id: migration006.id, name: migration006.name, up: migration006.up },
  { id: migration007.id, name: migration007.name, up: migration007.up },
  { id: migration008.id, name: migration008.name, up: migration008.up },
  { id: migration009.id, name: migration009.name, up: migration009.up },
  { id: migration010.id, name: migration010.name, up: migration010.up },
  { id: migration011.id, name: migration011.name, up: migration011.up }
]

export function runMigrations(db: Database.Database): void {
  // Ensure migrations table exists (bootstrap)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Guarantee all essential table schemas exist (users, subscriptions, landing_cms, etc.)
  for (const migration of migrations) {
    try {
      migration.up(db)
    } catch {
      // Table or index already exists, safe to continue
    }
  }

  const applied = db
    .prepare('SELECT id FROM migrations')
    .all()
    .map((row: any) => row.id)

  const pending = migrations.filter((m) => !applied.includes(m.id))

  for (const migration of pending) {
    try {
      db.prepare('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)').run(
        migration.id,
        migration.name
      )
    } catch {}
  }
}
