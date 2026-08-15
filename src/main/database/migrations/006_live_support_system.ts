// ──────────────────────────────────────────────
// ProfileVault — Migration 006: Live Support Messaging System
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 6
export const name = '006_live_support_system'

export function up(db: Database.Database): void {
  // 1. Support Conversations Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_conversations (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_agent_id  TEXT DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      status             TEXT NOT NULL DEFAULT 'open', -- open, pending, waiting_user, waiting_support, closed
      priority           TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
      subject            TEXT NOT NULL DEFAULT 'Support Request',
      last_message_at    TEXT DEFAULT (datetime('now')),
      closed_at          TEXT DEFAULT NULL,
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    );
  `)

  // 2. Support Messages Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id               TEXT PRIMARY KEY,
      conversation_id  TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      sender_id        TEXT NOT NULL,
      sender_type      TEXT NOT NULL, -- user, agent, system
      message          TEXT NOT NULL,
      message_type     TEXT NOT NULL DEFAULT 'text', -- text, attachment, system_event
      attachment_path  TEXT DEFAULT NULL,
      attachment_name  TEXT DEFAULT NULL,
      attachment_size  INTEGER DEFAULT NULL,
      attachment_mime  TEXT DEFAULT NULL,
      is_read          INTEGER NOT NULL DEFAULT 0,
      read_at          TEXT DEFAULT NULL,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `)

  // 3. Support Internal Notes Table (Staff Only)
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_internal_notes (
      id               TEXT PRIMARY KEY,
      conversation_id  TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      agent_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_name       TEXT NOT NULL,
      note             TEXT NOT NULL,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `)

  // 4. Support System Configuration Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const defaultSupportSettings = [
    ['support_enabled', 'true'],
    ['support_available', 'true'],
    ['business_hours', 'Mon-Fri 09:00 - 18:00 UTC'],
    ['welcome_message', 'Hello! How can our support team assist you today?'],
    ['offline_message', 'Our support team is currently offline. Please leave a message and we will respond shortly.'],
    ['auto_reply_enabled', 'true'],
    ['auto_reply_message', 'Thanks for contacting ProfileVault support! An agent has been notified and will reply shortly.'],
    ['max_attachment_size_mb', '10'],
    ['allowed_file_types', 'jpg,jpeg,png,gif,webp,pdf,txt,zip'],
    ['notification_sound_enabled', 'true'],
    ['max_open_conversations_per_user', '3'],
    ['rate_limit_messages_per_min', '15']
  ]

  const insertSetting = db.prepare('INSERT OR IGNORE INTO support_settings (key, value) VALUES (?, ?)')
  defaultSupportSettings.forEach(([k, v]) => insertSetting.run(k, v))
}
