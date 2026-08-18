// ──────────────────────────────────────────────
// AntiProfiles — Migration 008: Software Version Management & In-App Auto-Updates
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 8
export const name = '008_software_version_management'

export function up(db: Database.Database): void {
  // 1. Software Versions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS software_versions (
      id                      TEXT PRIMARY KEY,
      version                 TEXT NOT NULL UNIQUE,
      release_title           TEXT NOT NULL,
      release_notes           TEXT NOT NULL,
      status                  TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'disabled'
      min_supported_version   TEXT DEFAULT '1.0.0',
      force_update            INTEGER DEFAULT 0,
      
      win_download_url        TEXT,
      win_file_size           INTEGER DEFAULT 0,
      win_sha256              TEXT,
      
      mac_intel_download_url  TEXT,
      mac_intel_file_size     INTEGER DEFAULT 0,
      mac_intel_sha256        TEXT,
      
      mac_arm_download_url    TEXT,
      mac_arm_file_size       INTEGER DEFAULT 0,
      mac_arm_sha256          TEXT,
      
      linux_download_url      TEXT,
      linux_file_size         INTEGER DEFAULT 0,
      linux_sha256            TEXT,
      
      published_at            TEXT DEFAULT NULL,
      created_by              TEXT DEFAULT 'admin',
      created_at              TEXT DEFAULT (datetime('now')),
      updated_at              TEXT DEFAULT (datetime('now'))
    );
  `)

  // 2. Client Update State Tracking Table (tracks dismissed/installed updates per user)
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_update_states (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      version_id       TEXT NOT NULL REFERENCES software_versions(id) ON DELETE CASCADE,
      last_notified_at TEXT DEFAULT (datetime('now')),
      dismissed_at     TEXT DEFAULT NULL,
      installed_at     TEXT DEFAULT NULL,
      created_at       TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, version_id)
    );
  `)

  // 3. Seed initial stable version v1.0.0
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM software_versions WHERE version = ?').get('1.0.0') as { count: number }
  if (checkStmt.count === 0) {
    db.prepare(`
      INSERT INTO software_versions (
        id, version, release_title, release_notes, status, min_supported_version, force_update,
        win_download_url, win_file_size, win_sha256,
        mac_intel_download_url, mac_intel_file_size, mac_intel_sha256,
        mac_arm_download_url, mac_arm_file_size, mac_arm_sha256,
        linux_download_url, linux_file_size, linux_sha256,
        published_at
      ) VALUES (
        'ver_1_0_0',
        '1.0.0',
        'AntiProfiles v1.0.0 — Production Release',
        '• Multi-Profile Sandbox Isolation with Zero Canvas/WebGL Leakage\n• Real-Time Fingerprint Spoofing (AudioContext, WebRTC, MediaDevices, Screen)\n• Native SOCKS5/HTTP Proxy Server Bridge\n• Live Support Real-Time Messaging & Multi-Device Licensing',
        'published',
        '1.0.0',
        0,
        'https://releases.antiprofiles.com/AntiProfiles-Windows-x64.exe',
        85400000,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'https://releases.antiprofiles.com/AntiProfiles-macOS-Intel-x64.dmg',
        92100000,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'https://releases.antiprofiles.com/AntiProfiles-macOS-Apple-Silicon-arm64.dmg',
        89600000,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'https://releases.antiprofiles.com/AntiProfiles-Linux-x86_64.AppImage',
        81200000,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        datetime('now')
      )
    `).run()
  }
}
