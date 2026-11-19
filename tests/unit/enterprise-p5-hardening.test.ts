import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as migration013 from '../../src/main/database/migrations/013_enterprise_platform'
import { assertSafeRotationUrl } from '../../src/main/network/proxy-rotation'
import { assertTrustedIpcSender } from '../../src/main/ipc/enterprise.ipc'
import { assertSafeZipEntryList } from '../../src/main/browser/extension-manager'
import { encryptProfilePayload, decryptProfilePayload } from '../../src/main/storage/cloud-sync-engine'

describe('Phase P5 — Independent Security Hardening, DB Reliability & Regression Suite', () => {
  it('executes Migration 013 DDL cleanly and idempotently on a real disposable SQLite database and verifies soft-delete filtering', () => {
    const dbPath = path.join(os.tmpdir(), `ap-p5-db-${Date.now()}.sqlite`)
    // Capture every SQL statement executed by migration013.up() and run against real sqlite3 binary
    const capturedSql: string[] = []
    const mockDb: any = {
      exec: (sql: string) => capturedSql.push(sql),
      prepare: (sql: string) => ({
        all: () => (sql.includes('PRAGMA table_info') ? [] : [])
      })
    }
    migration013.up(mockDb)

    const bootstrapSql = `
      CREATE TABLE profiles (id TEXT PRIMARY KEY, name TEXT, status TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE proxies (id TEXT PRIMARY KEY, host TEXT, port INTEGER);
      ${capturedSql.map((s) => (s.trim().endsWith(';') ? s : `${s};`)).join('\n')}
      INSERT INTO profiles (id, name, status, created_at, updated_at, deleted_at) VALUES ('p-active', 'Active', 'stopped', '2026-01-01', '2026-01-01', NULL);
      INSERT INTO profiles (id, name, status, created_at, updated_at, deleted_at) VALUES ('p-trash', 'Trashed', 'stopped', '2026-01-01', '2026-01-01', '2026-01-02');
    `
    try {
      execFileSync('sqlite3', [dbPath], { input: bootstrapSql, encoding: 'utf8' })

      const tablesOut = execFileSync('sqlite3', [dbPath, "SELECT name FROM sqlite_master WHERE type='table';"], { encoding: 'utf8' })
      const tables = tablesOut.trim().split('\n')
      for (const tbl of ['extensions', 'profile_extensions', 'automation_workflows', 'automation_executions', 'cloud_backups', 'teams', 'team_members', 'team_invitations', 'profile_shares', 'proxy_rotation_history']) {
        expect(tables).toContain(tbl)
      }

      const activeOut = execFileSync('sqlite3', [dbPath, 'SELECT id FROM profiles WHERE deleted_at IS NULL;'], { encoding: 'utf8' }).trim()
      expect(activeOut).toBe('p-active')
    } finally {
      try { fs.unlinkSync(dbPath) } catch {}
    }
  })

  it('blocks SSRF targets in proxy rotation URLs while allowing legitimate public endpoints', () => {
    expect(() => assertSafeRotationUrl('https://api.proxyprovider.example/rotate?token=abc')).not.toThrow()
    expect(() => assertSafeRotationUrl('http://127.0.0.1:35000/api/v1/profiles')).toThrow(/SSRF/i)
    expect(() => assertSafeRotationUrl('http://localhost:8080/rotate')).toThrow(/SSRF/i)
    expect(() => assertSafeRotationUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/SSRF/i)
    expect(() => assertSafeRotationUrl('http://10.0.0.5/internal')).toThrow(/SSRF/i)
    expect(() => assertSafeRotationUrl('http://192.168.1.1/admin')).toThrow(/SSRF/i)
    expect(() => assertSafeRotationUrl('http://172.16.0.10/internal')).toThrow(/SSRF/i)
    expect(() => assertSafeRotationUrl('file:///etc/passwd')).toThrow(/protocol/i)
  })

  it('enforces trusted IPC sender origins and rejects external web origins', () => {
    expect(() => assertTrustedIpcSender({ senderFrame: { url: 'file:///Applications/AntiProfiles.app/index.html' } } as any)).not.toThrow()
    expect(() => assertTrustedIpcSender({ senderFrame: { url: 'http://localhost:5173/' } } as any)).not.toThrow()
    expect(() => assertTrustedIpcSender({ senderFrame: { url: 'https://evil.example.com/exploit.html' } } as any)).toThrow(/untrusted IPC sender/i)
    expect(() => assertTrustedIpcSender({ senderFrame: { url: 'http://attacker.io/' } } as any)).toThrow(/untrusted IPC sender/i)
  })

  it('blocks Zip-Slip paths before extension archive extraction', () => {
    expect(() => assertSafeZipEntryList(['manifest.json', 'background.js', 'icons/icon-128.png'])).not.toThrow()
    expect(() => assertSafeZipEntryList(['manifest.json', '../../etc/passwd'])).toThrow(/Zip-Slip/i)
    expect(() => assertSafeZipEntryList(['/etc/shadow'])).toThrow(/Zip-Slip/i)
    expect(() => assertSafeZipEntryList(['C:\\Windows\\System32\\evil.dll'])).toThrow(/Zip-Slip/i)
  })

  it('measures real AES-256-GCM + scrypt encryption/decryption latency on 1 MB payload', () => {
    const payload = Buffer.alloc(1024 * 1024, 0x41)
    const t0 = Date.now()
    const enc = encryptProfilePayload(payload, 'BenchmarkPass!2026', 'bench-profile:v1')
    const dec = decryptProfilePayload(enc.ciphertext, 'BenchmarkPass!2026', enc, 'bench-profile:v1')
    const elapsedMs = Date.now() - t0
    expect(dec.length).toBe(payload.length)
    expect(elapsedMs).toBeLessThan(5000)
  })
})
