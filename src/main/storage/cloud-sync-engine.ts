// ──────────────────────────────────────────────────────────────────
// AntiProfiles — E2E Encrypted Cloud Profile Sync Engine
// Client-side AES-256-GCM + scrypt key derivation + SHA-256 integrity
// Supports S3 / Cloudflare R2 provider interface & local encrypted vault
// Encryption keys are NEVER stored alongside encrypted archives
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import { getProfileDataDir } from '../browser/chromium-resolver'
import { getBaseUserDataDir } from '../browser/runtime-provisioner'
import { createS3ProviderFromEnv } from './s3-r2-provider'
import { logger } from '../logging/logger'

export interface CloudStorageProvider {
  name: string
  uploadObject(key: string, data: Buffer): Promise<void>
  downloadObject(key: string): Promise<Buffer>
  deleteObject(key: string): Promise<void>
}

export interface EncryptedArchiveMetadata {
  id: string
  profileId: string
  versionNum: number
  provider: string
  remoteKey: string
  sha256: string
  sizeBytes: number
  ivHex: string
  saltHex: string
  authTagHex: string
  createdBy: string
  createdAt: string
}

/**
 * Local encrypted vault provider (used when S3/R2 env credentials are not configured).
 * External S3/R2 adapters implement the exact same CloudStorageProvider interface.
 */
class LocalVaultStorageProvider implements CloudStorageProvider {
  name = 'local-vault'

  private getBaseDir(): string {
    const dir = path.join(getBaseUserDataDir(), 'encrypted-cloud-vault')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  private resolveSafePath(key: string): string {
    const safeName = key.replace(/[^a-zA-Z0-9._-]/g, '_')
    return path.join(this.getBaseDir(), safeName)
  }

  async uploadObject(key: string, data: Buffer): Promise<void> {
    fs.writeFileSync(this.resolveSafePath(key), data)
  }

  async downloadObject(key: string): Promise<Buffer> {
    const p = this.resolveSafePath(key)
    if (!fs.existsSync(p)) throw new Error(`Encrypted backup object not found: ${key}`)
    return fs.readFileSync(p)
  }

  async deleteObject(key: string): Promise<void> {
    const p = this.resolveSafePath(key)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

/**
 * Derive a 256-bit key from user passphrase + random 256-bit salt using scrypt.
 */
export function deriveSyncKey(passphrase: string, salt: Buffer): Buffer {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Sync encryption passphrase must be at least 8 characters.')
  }
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 })
}

/**
 * Encrypt a plaintext buffer using AES-256-GCM with AAD binding (profileId + version).
 */
export function encryptProfilePayload(
  plaintext: Buffer,
  passphrase: string,
  aadContext: string
): { ciphertext: Buffer; ivHex: string; saltHex: string; authTagHex: string; sha256: string } {
  const salt = crypto.randomBytes(32)
  const iv = crypto.randomBytes(12)
  const key = deriveSyncKey(passphrase, salt)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aadContext, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  const sha256 = crypto.createHash('sha256').update(ciphertext).digest('hex')

  return {
    ciphertext,
    ivHex: iv.toString('hex'),
    saltHex: salt.toString('hex'),
    authTagHex: authTag.toString('hex'),
    sha256
  }
}

/**
 * Verify SHA-256 integrity and decrypt an AES-256-GCM profile archive.
 */
export function decryptProfilePayload(
  ciphertext: Buffer,
  passphrase: string,
  meta: { ivHex: string; saltHex: string; authTagHex: string; sha256: string },
  aadContext: string
): Buffer {
  const actualHash = crypto.createHash('sha256').update(ciphertext).digest('hex')
  if (actualHash !== meta.sha256) {
    throw new Error('Integrity verification failed: encrypted archive SHA-256 mismatch.')
  }

  const salt = Buffer.from(meta.saltHex, 'hex')
  const iv = Buffer.from(meta.ivHex, 'hex')
  const authTag = Buffer.from(meta.authTagHex, 'hex')
  const key = deriveSyncKey(passphrase, salt)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aadContext, 'utf8'))
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/**
 * Collect persistent profile data files (cookies, bookmarks, preferences, managed-cookies,
 * Chromium Network/Cookies SQLite, Local Storage LevelDB, and Firefox cookies/webappsstore)
 * into a compressed JSON bundle for deterministic E2E encrypted sync.
 */
function serializeProfileSnapshot(profileId: string): Buffer {
  const dataDir = getProfileDataDir(profileId)
  const files: Record<string, string> = {}
  const targetRelPaths = [
    'managed-cookies.json',
    'metadata.json',
    'settings.json',
    path.join('Default', 'Bookmarks'),
    path.join('Default', 'Preferences'),
    path.join('Default', 'Cookies'),
    path.join('Default', 'Network', 'Cookies'),
    path.join('Default', 'Extension State', 'CURRENT'),
    'user.js',
    'prefs.js',
    'cookies.sqlite',
    'webappsstore.sqlite',
    'permissions.sqlite',
    'xulstore.json'
  ]

  for (const rel of targetRelPaths) {
    const full = path.join(dataDir, rel)
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        const stat = fs.statSync(full)
        // Cap individual SQLite file at 15MB to keep encrypted snapshots fast
        if (stat.size <= 15 * 1024 * 1024) {
          files[rel] = fs.readFileSync(full).toString('base64')
        }
      }
    } catch {}
  }

  // Also include Chromium Local Storage LevelDB entries (< 5MB total)
  const localStorageDir = path.join(dataDir, 'Default', 'Local Storage', 'leveldb')
  try {
    if (fs.existsSync(localStorageDir) && fs.statSync(localStorageDir).isDirectory()) {
      for (const entry of fs.readdirSync(localStorageDir)) {
        if (entry === 'LOCK') continue
        const fullEntry = path.join(localStorageDir, entry)
        const stat = fs.statSync(fullEntry)
        if (stat.isFile() && stat.size <= 2 * 1024 * 1024) {
          const relKey = path.join('Default', 'Local Storage', 'leveldb', entry)
          files[relKey] = fs.readFileSync(fullEntry).toString('base64')
        }
      }
    }
  } catch {}

  return zlib.gzipSync(Buffer.from(JSON.stringify({ profileId, capturedAt: new Date().toISOString(), files }), 'utf8'))
}

function restoreProfileSnapshot(profileId: string, compressed: Buffer): number {
  const raw = zlib.gunzipSync(compressed).toString('utf8')
  const parsed = JSON.parse(raw) as { files: Record<string, string> }
  const dataDir = getProfileDataDir(profileId)
  const canonicalDataDir = path.resolve(dataDir)
  let restoredCount = 0

  for (const [rel, b64] of Object.entries(parsed.files || {})) {
    const target = path.resolve(canonicalDataDir, rel)
    if (!target.startsWith(canonicalDataDir + path.sep)) {
      throw new Error(`Security rejection: unsafe restore path "${rel}"`)
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, Buffer.from(b64, 'base64'))
    restoredCount++
  }

  return restoredCount
}

class CloudSyncEngine {
  private provider: CloudStorageProvider = createS3ProviderFromEnv() || new LocalVaultStorageProvider()

  setProvider(provider: CloudStorageProvider): void {
    this.provider = provider
  }

  getProviderStatus(): { provider: string; s3Configured: boolean } {
    return {
      provider: this.provider.name,
      s3Configured: !!(process.env.ANTIPROFILES_S3_ENDPOINT && process.env.ANTIPROFILES_S3_BUCKET && process.env.ANTIPROFILES_S3_ACCESS_KEY)
    }
  }

  async backupProfile(profileId: string, passphrase: string, createdBy = 'user'): Promise<EncryptedArchiveMetadata> {
    const db = getDatabase()
    const last = db
      .prepare('SELECT MAX(version_num) as maxVer FROM cloud_backups WHERE profile_id = ?')
      .get(profileId) as { maxVer: number | null }
    const versionNum = (last?.maxVer || 0) + 1

    const compressed = serializeProfileSnapshot(profileId)
    const aad = `${profileId}:v${versionNum}`
    const encrypted = encryptProfilePayload(compressed, passphrase, aad)

    const id = uuidv4()
    const remoteKey = `${profileId}_v${versionNum}_${id.slice(0, 8)}.apenc`
    await this.provider.uploadObject(remoteKey, encrypted.ciphertext)

    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO cloud_backups (id, profile_id, version_num, provider, remote_key, sha256, size_bytes, iv_hex, salt_hex, auth_tag_hex, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, profileId, versionNum, this.provider.name, remoteKey,
      encrypted.sha256, encrypted.ciphertext.length,
      encrypted.ivHex, encrypted.saltHex, encrypted.authTagHex,
      createdBy, now
    )

    logger.info('sync', `[CloudSync] Created E2E encrypted backup v${versionNum} for profile ${profileId} (${encrypted.ciphertext.length} bytes)`)
    return {
      id,
      profileId,
      versionNum,
      provider: this.provider.name,
      remoteKey,
      sha256: encrypted.sha256,
      sizeBytes: encrypted.ciphertext.length,
      ivHex: encrypted.ivHex,
      saltHex: encrypted.saltHex,
      authTagHex: encrypted.authTagHex,
      createdBy,
      createdAt: now
    }
  }

  listBackups(profileId: string): EncryptedArchiveMetadata[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM cloud_backups WHERE profile_id = ? ORDER BY version_num DESC')
      .all(profileId) as any[]

    return rows.map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      versionNum: r.version_num,
      provider: r.provider,
      remoteKey: r.remote_key,
      sha256: r.sha256,
      sizeBytes: r.size_bytes,
      ivHex: r.iv_hex,
      saltHex: r.salt_hex,
      authTagHex: r.auth_tag_hex,
      createdBy: r.created_by,
      createdAt: r.created_at
    }))
  }

  async restoreBackup(backupId: string, passphrase: string): Promise<{ restoredFiles: number; profileId: string; versionNum: number }> {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM cloud_backups WHERE id = ?').get(backupId) as any
    if (!row) throw new Error(`Backup not found: ${backupId}`)

    const ciphertext = await this.provider.downloadObject(row.remote_key)
    const aad = `${row.profile_id}:v${row.version_num}`
    const compressed = decryptProfilePayload(
      ciphertext,
      passphrase,
      {
        ivHex: row.iv_hex,
        saltHex: row.salt_hex,
        authTagHex: row.auth_tag_hex,
        sha256: row.sha256
      },
      aad
    )

    const restoredFiles = restoreProfileSnapshot(row.profile_id, compressed)
    logger.info('sync', `[CloudSync] Restored backup v${row.version_num} (${restoredFiles} files) for profile ${row.profile_id}`)
    return { restoredFiles, profileId: row.profile_id, versionNum: row.version_num }
  }
}

export const cloudSyncEngine = new CloudSyncEngine()
