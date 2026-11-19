// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Centralized Extension Management Center
// Secure ZIP/CRX ingestion, manifest & path-traversal validation,
// permission risk warnings, profile & group assignment
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import { getBaseUserDataDir } from './runtime-provisioner'
import { logger } from '../logging/logger'

export interface ManagedExtension {
  id: string
  name: string
  version: string
  manifestVersion: number
  description: string
  storagePath: string
  permissions: string[]
  riskWarnings: string[]
  sha256: string
  enabled: boolean
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

const HIGH_RISK_PERMISSIONS = new Set([
  '<all_urls>',
  'cookies',
  'webRequest',
  'webRequestBlocking',
  'debugger',
  'nativeMessaging',
  'proxy',
  'privacy',
  'management',
  'history'
])

const MAX_PACKAGE_BYTES = 100 * 1024 * 1024 // 100 MB safety ceiling

export function getExtensionsBaseDir(): string {
  const dir = path.join(getBaseUserDataDir(), 'managed-extensions')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Strip CRX2 or CRX3 header bytes to extract the embedded ZIP payload.
 */
export function stripCrxHeader(buf: Buffer): Buffer {
  // Check magic "Cr24"
  if (buf.length < 16 || buf.toString('ascii', 0, 4) !== 'Cr24') {
    return buf
  }
  const version = buf.readUInt32LE(4)
  if (version === 2) {
    const pubKeyLen = buf.readUInt32LE(8)
    const sigLen = buf.readUInt32LE(12)
    return buf.subarray(16 + pubKeyLen + sigLen)
  }
  if (version === 3) {
    const headerSize = buf.readUInt32LE(8)
    return buf.subarray(12 + headerSize)
  }
  throw new Error(`Unsupported CRX format version: ${version}`)
}

/**
 * Pre-validate ZIP entry paths BEFORE extraction to block Zip-Slip attacks.
 */
export function assertSafeZipEntryList(entries: string[]): void {
  for (const raw of entries) {
    const entry = raw.trim()
    if (!entry) continue
    if (
      entry.startsWith('/') ||
      entry.startsWith('\\') ||
      /^[a-zA-Z]:/.test(entry) ||
      entry.split(/[\\/]/).includes('..')
    ) {
      throw new Error(`Security rejection: unsafe archive entry path "${entry}" (Zip-Slip protection)`)
    }
  }
}

/**
 * Verify that every file inside an extracted directory resolves strictly within rootDir
 * (prevents Zip-Slip / symlink traversal attacks).
 */
export function assertSafeDirectoryTree(rootDir: string): void {
  const canonicalRoot = fs.realpathSync(rootDir)
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const stat = fs.lstatSync(full)
      if (stat.isSymbolicLink()) {
        throw new Error(`Security rejection: symlinks are not allowed inside extension packages (${entry.name})`)
      }
      const resolved = path.resolve(full)
      if (!resolved.startsWith(canonicalRoot + path.sep) && resolved !== canonicalRoot) {
        throw new Error(`Security rejection: path traversal detected (${entry.name})`)
      }
      if (stat.isDirectory()) walk(full)
    }
  }
  walk(canonicalRoot)
}

/**
 * Validate manifest.json structure and compute permission risk warnings.
 */
export function validateExtensionManifest(extDir: string): {
  name: string
  version: string
  manifestVersion: number
  description: string
  permissions: string[]
  riskWarnings: string[]
} {
  const manifestPath = path.join(extDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Invalid extension package: manifest.json not found at root.')
  }
  let manifest: any
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err: any) {
    throw new Error(`Invalid manifest.json syntax: ${err.message}`)
  }

  const mv = Number(manifest.manifest_version)
  if (mv !== 2 && mv !== 3) {
    throw new Error(`Unsupported manifest_version: ${manifest.manifest_version}. Only MV2 and MV3 are supported.`)
  }
  if (!manifest.name || !manifest.version) {
    throw new Error('Invalid manifest.json: missing required "name" or "version" field.')
  }

  const perms: string[] = [
    ...(Array.isArray(manifest.permissions) ? manifest.permissions : []),
    ...(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [])
  ].map(String)

  const riskWarnings: string[] = []
  for (const p of perms) {
    if (HIGH_RISK_PERMISSIONS.has(p) || p.includes('*://*/*')) {
      riskWarnings.push(`Requests sensitive permission: ${p}`)
    }
  }

  return {
    name: String(manifest.name),
    version: String(manifest.version),
    manifestVersion: mv,
    description: String(manifest.description || ''),
    permissions: perms,
    riskWarnings
  }
}

export class ExtensionManager {
  /**
   * Ingest a local ZIP or CRX extension package with full security validation.
   */
  static uploadExtensionPackage(packagePath: string, uploadedBy = 'admin'): ManagedExtension {
    if (!packagePath || !fs.existsSync(packagePath)) {
      throw new Error(`Extension package not found: ${packagePath}`)
    }
    const stat = fs.statSync(packagePath)
    if (stat.size > MAX_PACKAGE_BYTES) {
      throw new Error(`Extension package exceeds 100 MB safety limit (${Math.round(stat.size / 1048576)} MB).`)
    }

    const rawBuf = fs.readFileSync(packagePath)
    const sha256 = crypto.createHash('sha256').update(rawBuf).digest('hex')
    const extId = uuidv4()
    const targetDir = path.join(getExtensionsBaseDir(), extId)
    fs.mkdirSync(targetDir, { recursive: true })

    const tempZip = path.join(getExtensionsBaseDir(), `_tmp_${extId}.zip`)
    try {
      const zipBuf = packagePath.toLowerCase().endsWith('.crx') ? stripCrxHeader(rawBuf) : rawBuf
      fs.writeFileSync(tempZip, zipBuf)

      // Pre-inspect archive entries BEFORE extracting to block Zip-Slip
      const listing = process.platform === 'win32'
        ? execFileSync('tar', ['-tf', tempZip], { encoding: 'utf8', timeout: 30000 })
        : execFileSync('unzip', ['-Z1', tempZip], { encoding: 'utf8', timeout: 30000 })
      assertSafeZipEntryList(listing.split(/\r?\n/))

      if (process.platform === 'win32') {
        execFileSync('tar', ['-xf', tempZip, '-C', targetDir], { timeout: 60000 })
      } else {
        execFileSync('unzip', ['-q', '-o', tempZip, '-d', targetDir], { timeout: 60000 })
      }

      assertSafeDirectoryTree(targetDir)

      // Handle single nested directory inside ZIP
      let manifestDir = targetDir
      if (!fs.existsSync(path.join(targetDir, 'manifest.json'))) {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('__MACOSX'))
        if (entries.length === 1 && fs.existsSync(path.join(targetDir, entries[0].name, 'manifest.json'))) {
          manifestDir = path.join(targetDir, entries[0].name)
        }
      }

      const meta = validateExtensionManifest(manifestDir)
      const now = new Date().toISOString()

      const db = getDatabase()
      db.prepare(`
        INSERT INTO extensions (id, name, version, manifest_version, description, storage_path, permissions_json, risk_warnings, sha256, enabled, uploaded_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        extId,
        meta.name,
        meta.version,
        meta.manifestVersion,
        meta.description,
        manifestDir,
        JSON.stringify(meta.permissions),
        JSON.stringify(meta.riskWarnings),
        sha256,
        uploadedBy,
        now,
        now
      )

      logger.info('browser', `[ExtensionCenter] Installed extension "${meta.name}" v${meta.version} (MV${meta.manifestVersion})`)
      return {
        id: extId,
        ...meta,
        storagePath: manifestDir,
        sha256,
        enabled: true,
        uploadedBy,
        createdAt: now,
        updatedAt: now
      }
    } catch (err) {
      try { fs.rmSync(targetDir, { recursive: true, force: true }) } catch {}
      throw err
    } finally {
      try { fs.unlinkSync(tempZip) } catch {}
    }
  }

  /**
   * Register an already-unpacked extension directory (validates manifest & path safety).
   */
  static registerUnpackedExtension(sourceDir: string, uploadedBy = 'admin'): ManagedExtension {
    assertSafeDirectoryTree(sourceDir)
    const meta = validateExtensionManifest(sourceDir)
    const extId = uuidv4()
    const targetDir = path.join(getExtensionsBaseDir(), extId)
    fs.cpSync(sourceDir, targetDir, { recursive: true })
    const now = new Date().toISOString()
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(targetDir, 'manifest.json'))).digest('hex')

    const db = getDatabase()
    db.prepare(`
      INSERT INTO extensions (id, name, version, manifest_version, description, storage_path, permissions_json, risk_warnings, sha256, enabled, uploaded_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      extId, meta.name, meta.version, meta.manifestVersion, meta.description,
      targetDir, JSON.stringify(meta.permissions), JSON.stringify(meta.riskWarnings),
      sha256, uploadedBy, now, now
    )

    return {
      id: extId,
      ...meta,
      storagePath: targetDir,
      sha256,
      enabled: true,
      uploadedBy,
      createdAt: now,
      updatedAt: now
    }
  }

  static listExtensions(search?: string): ManagedExtension[] {
    const db = getDatabase()
    const rows = (search
      ? db.prepare('SELECT * FROM extensions WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC').all(`%${search}%`, `%${search}%`)
      : db.prepare('SELECT * FROM extensions ORDER BY created_at DESC').all()
    ) as any[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      version: r.version,
      manifestVersion: r.manifest_version,
      description: r.description || '',
      storagePath: r.storage_path,
      permissions: JSON.parse(r.permissions_json || '[]'),
      riskWarnings: JSON.parse(r.risk_warnings || '[]'),
      sha256: r.sha256 || '',
      enabled: !!r.enabled,
      uploadedBy: r.uploaded_by || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  }

  static setExtensionEnabled(extensionId: string, enabled: boolean): boolean {
    const db = getDatabase()
    const res = db.prepare('UPDATE extensions SET enabled = ?, updated_at = ? WHERE id = ?').run(enabled ? 1 : 0, new Date().toISOString(), extensionId)
    return res.changes > 0
  }

  static removeExtension(extensionId: string): boolean {
    const db = getDatabase()
    const row = db.prepare('SELECT storage_path FROM extensions WHERE id = ?').get(extensionId) as { storage_path: string } | undefined
    if (!row) return false
    db.prepare('DELETE FROM profile_extensions WHERE extension_id = ?').run(extensionId)
    db.prepare('DELETE FROM extensions WHERE id = ?').run(extensionId)
    try {
      const base = getExtensionsBaseDir()
      if (row.storage_path && path.resolve(row.storage_path).startsWith(path.resolve(base))) {
        fs.rmSync(row.storage_path, { recursive: true, force: true })
      }
    } catch {}
    return true
  }

  static assignToProfile(extensionId: string, profileId: string): void {
    const db = getDatabase()
    const existing = db.prepare('SELECT id FROM profile_extensions WHERE extension_id = ? AND profile_id = ?').get(extensionId, profileId)
    if (!existing) {
      db.prepare('INSERT INTO profile_extensions (id, profile_id, group_id, extension_id, enabled, installed_at) VALUES (?, ?, NULL, ?, 1, ?)').run(
        uuidv4(), profileId, extensionId, new Date().toISOString()
      )
    }
  }

  static assignToGroup(extensionId: string, groupId: string): void {
    const db = getDatabase()
    const existing = db.prepare('SELECT id FROM profile_extensions WHERE extension_id = ? AND group_id = ?').get(extensionId, groupId)
    if (!existing) {
      db.prepare('INSERT INTO profile_extensions (id, profile_id, group_id, extension_id, enabled, installed_at) VALUES (?, NULL, ?, ?, 1, ?)').run(
        uuidv4(), groupId, extensionId, new Date().toISOString()
      )
    }
  }

  /**
   * Resolve all active unpacked extension directories assigned to a profile or its group.
   */
  static getActiveExtensionPathsForProfile(profileId: string, groupId?: string | null): string[] {
    try {
      const db = getDatabase()
      const rows = (groupId
        ? db.prepare(`
            SELECT DISTINCT e.storage_path
            FROM extensions e
            INNER JOIN profile_extensions pe ON pe.extension_id = e.id
            WHERE e.enabled = 1 AND pe.enabled = 1 AND (pe.profile_id = ? OR pe.group_id = ?)
          `).all(profileId, groupId)
        : db.prepare(`
            SELECT DISTINCT e.storage_path
            FROM extensions e
            INNER JOIN profile_extensions pe ON pe.extension_id = e.id
            WHERE e.enabled = 1 AND pe.enabled = 1 AND pe.profile_id = ?
          `).all(profileId)
      ) as Array<{ storage_path: string }>

      return rows
        .map((r) => r.storage_path)
        .filter((p) => p && fs.existsSync(path.join(p, 'manifest.json')))
    } catch {
      return []
    }
  }
}
