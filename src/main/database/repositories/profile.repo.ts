// ──────────────────────────────────────────────
// AntiProfiles — Profile Repository
// ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../connection'
import {
  Profile,
  ProfileCreateInput,
  ProfileUpdateInput,
  ProfileRow,
  profileFromRow,
  DashboardStats
} from '../models'
import { generateFingerprint } from '../../fingerprint/generator'
import { validateConsistency } from '../../fingerprint/consistency'

export class ProfileRepository {
  getAll(userId?: string, search?: string, groupId?: string, status?: string): Profile[] {
    const db = getDatabase()
    let query = 'SELECT * FROM profiles WHERE 1=1'
    const params: any[] = []

    if (userId) {
      query += ' AND user_id = ?'
      params.push(userId)
    }
    if (search) {
      query += ' AND (name LIKE ? OR notes LIKE ? OR tags LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }
    if (groupId) {
      query += ' AND group_id = ?'
      params.push(groupId)
    }
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY updated_at DESC'

    const rows = db.prepare(query).all(...params) as ProfileRow[]
    return rows.map(profileFromRow)
  }

  getById(id: string): Profile | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined
    return row ? profileFromRow(row) : null
  }

  verifyOwnership(profileId: string, userId: string, isAdmin = false): boolean {
    if (isAdmin) return true
    const profile = this.getById(profileId)
    if (!profile) return false
    return profile.userId === userId
  }

  create(input: ProfileCreateInput, userId?: string): Profile {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()
    const targetUserId = userId || (input as any).userId || 'admin-default'

    const osType = (input.osType as any) || 'windows-10'

    // Generate fingerprint if not supplied
    let fingerprint = input.fingerprint
    if (!fingerprint || Object.keys(fingerprint).length === 0) {
      fingerprint = generateFingerprint({
        osType,
        browserType: (input.browserType as any) || 'chrome',
        browserVersion: input.browserVersion
      })
    }

    // Strictly sync explicit creation inputs into the fingerprint object
    if (fingerprint && fingerprint.navigator) {
      if (input.hwConcurrency !== undefined) fingerprint.navigator.hardwareConcurrency = input.hwConcurrency
      if (input.deviceMemory !== undefined) fingerprint.navigator.deviceMemory = input.deviceMemory
      if (input.userAgent !== undefined) fingerprint.navigator.userAgent = input.userAgent
    }
    if (fingerprint && fingerprint.screen) {
      if (input.screenWidth !== undefined) fingerprint.screen.width = input.screenWidth
      if (input.screenHeight !== undefined) fingerprint.screen.height = input.screenHeight
    }
    if (fingerprint && fingerprint.locale) {
      if (input.language !== undefined) fingerprint.locale.language = input.language
    }
    if (fingerprint && fingerprint.timezone) {
      if (input.timezone !== undefined) fingerprint.timezone.timezone = input.timezone
    }

    const consistencyResult = validateConsistency(fingerprint, osType)
    const fpJson = JSON.stringify(fingerprint)

    db.prepare(`
      INSERT INTO profiles (
        id, user_id, name, group_id, notes, color, icon, browser_version, user_agent,
        language, timezone, screen_width, screen_height, webrtc_mode, canvas_mode, webgl_mode,
        hw_concurrency, device_memory, hw_acceleration, proxy_id, tags, status, created_at, updated_at,
        os_type, fingerprint, folder, profile_locked, consistency_score, fingerprint_seed,
        start_url, launch_args, save_history, save_passwords, google_services, system_extensions, custom_dns
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      targetUserId,
      input.name,
      input.groupId ?? null,
      input.notes ?? '',
      input.color ?? '#6366F1',
      input.icon ?? 'globe',
      input.browserVersion ?? fingerprint.navigator?.browserVersion ?? 'latest',
      input.userAgent ?? fingerprint.navigator?.userAgent ?? '',
      input.language ?? fingerprint.locale?.language ?? 'en-US',
      input.timezone ?? fingerprint.timezone?.timezone ?? 'America/New_York',
      input.screenWidth ?? fingerprint.screen?.width ?? 1920,
      input.screenHeight ?? fingerprint.screen?.height ?? 1080,
      input.webrtcMode ?? fingerprint.webrtc?.mode ?? 'default',
      input.canvasMode ?? fingerprint.canvas?.mode ?? 'noise',
      input.webglMode ?? 'default',
      input.hwConcurrency ?? fingerprint.navigator?.hardwareConcurrency ?? 8,
      input.deviceMemory ?? fingerprint.navigator?.deviceMemory ?? 8,
      input.hwAcceleration !== false ? 1 : 0,
      input.proxyId ?? null,
      JSON.stringify(input.tags ?? []),
      'stopped',
      now,
      now,
      osType,
      fpJson,
      input.folder ?? '',
      0,
      consistencyResult.score,
      fingerprint.seed || '',
      input.startUrl ?? '',
      JSON.stringify(input.launchArgs ?? []),
      input.saveHistory !== false ? 1 : 0,
      input.savePasswords ? 1 : 0,
      input.googleServices ? 1 : 0,
      input.systemExtensions ? 1 : 0,
      input.customDns ?? ''
    )

    return this.getById(id)!
  }

  update(id: string, input: ProfileUpdateInput): Profile | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const sets: string[] = []
    const params: any[] = []

    const fieldMap: Record<string, string> = {
      name: 'name',
      groupId: 'group_id',
      notes: 'notes',
      color: 'color',
      icon: 'icon',
      browserVersion: 'browser_version',
      userAgent: 'user_agent',
      language: 'language',
      timezone: 'timezone',
      screenWidth: 'screen_width',
      screenHeight: 'screen_height',
      webrtcMode: 'webrtc_mode',
      canvasMode: 'canvas_mode',
      webglMode: 'webgl_mode',
      hwConcurrency: 'hw_concurrency',
      deviceMemory: 'device_memory',
      proxyId: 'proxy_id',
      status: 'status',
      lastUsedAt: 'last_used_at',
      pid: 'pid',
      osType: 'os_type',
      folder: 'folder',
      startUrl: 'start_url',
      customDns: 'custom_dns'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in input) {
        sets.push(`${column} = ?`)
        params.push((input as any)[key] ?? null)
      }
    }

    if ('fingerprint' in input && input.fingerprint) {
      sets.push('fingerprint = ?')
      params.push(JSON.stringify(input.fingerprint))
      // Recalculate consistency score
      const os = (input.osType || existing.osType) as any
      const score = validateConsistency(input.fingerprint, os).score
      sets.push('consistency_score = ?')
      params.push(score)
    }

    if ('launchArgs' in input) {
      sets.push('launch_args = ?')
      params.push(JSON.stringify(input.launchArgs ?? []))
    }

    if ('hwAcceleration' in input) {
      sets.push('hw_acceleration = ?')
      params.push(input.hwAcceleration ? 1 : 0)
    }
    if ('saveHistory' in input) {
      sets.push('save_history = ?')
      params.push(input.saveHistory ? 1 : 0)
    }
    if ('savePasswords' in input) {
      sets.push('save_passwords = ?')
      params.push(input.savePasswords ? 1 : 0)
    }
    if ('googleServices' in input) {
      sets.push('google_services = ?')
      params.push(input.googleServices ? 1 : 0)
    }
    if ('systemExtensions' in input) {
      sets.push('system_extensions = ?')
      params.push(input.systemExtensions ? 1 : 0)
    }
    if ('profileLocked' in input) {
      sets.push('profile_locked = ?')
      params.push(input.profileLocked ? 1 : 0)
    }
    if ('lockDeviceId' in input) {
      sets.push('lock_device_id = ?')
      params.push(input.lockDeviceId ?? null)
    }

    if ('tags' in input) {
      sets.push('tags = ?')
      params.push(JSON.stringify(input.tags ?? []))
    }

    if (sets.length === 0) return existing

    const now = new Date().toISOString()
    sets.push('updated_at = ?')
    params.push(now)
    sets.push('last_modified = ?')
    params.push(now)
    params.push(id)

    db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(id)
    return result.changes > 0
  }

  duplicate(id: string): Profile | null {
    const original = this.getById(id)
    if (!original) return null

    // Deep clone the original fingerprint preserving 100% of hardware, browser, OS, GPU, and screen config
    let newFp: any = null
    if (original.fingerprint) {
      try {
        newFp = JSON.parse(JSON.stringify(original.fingerprint))
        newFp.seed = uuidv4()
        if (newFp.canvas) newFp.canvas.noiseSeed = Math.floor(Math.random() * 1000000)
        if (newFp.audio) newFp.audio.noiseSeed = Math.floor(Math.random() * 1000000)
        if (newFp.clientRects) newFp.clientRects.noiseSeed = Math.floor(Math.random() * 1000000)
      } catch {}
    }

    if (!newFp) {
      newFp = generateFingerprint({
        osType: original.osType as any,
        browserType: (original as any).browserType || (original.fingerprint?.browser?.type as any) || 'chrome',
        browserVersion: original.browserVersion || original.fingerprint?.browser?.version
      })
    }

    return this.create({
      name: `${original.name} (Copy)`,
      groupId: original.groupId,
      notes: original.notes,
      color: original.color,
      icon: original.icon,
      browserVersion: original.browserVersion,
      userAgent: original.userAgent,
      language: original.language,
      timezone: original.timezone,
      screenWidth: original.screenWidth,
      screenHeight: original.screenHeight,
      webrtcMode: original.webrtcMode,
      canvasMode: original.canvasMode,
      webglMode: original.webglMode,
      hwConcurrency: original.hwConcurrency,
      deviceMemory: original.deviceMemory,
      hwAcceleration: original.hwAcceleration,
      proxyId: original.proxyId,
      tags: [...original.tags],
      osType: original.osType,
      fingerprint: newFp,
      folder: original.folder,
      startUrl: original.startUrl,
      launchArgs: [...original.launchArgs],
      saveHistory: original.saveHistory,
      savePasswords: original.savePasswords,
      googleServices: original.googleServices,
      systemExtensions: original.systemExtensions,
      customDns: original.customDns
    })
  }

  getStats(): DashboardStats {
    const db = getDatabase()
    const total = (db.prepare('SELECT COUNT(*) as count FROM profiles').get() as any).count
    const running = (db.prepare("SELECT COUNT(*) as count FROM profiles WHERE status = 'running'").get() as any).count
    const stopped = total - running
    const totalProxies = (db.prepare('SELECT COUNT(*) as count FROM proxies').get() as any).count
    const totalGroups = (db.prepare('SELECT COUNT(*) as count FROM groups').get() as any).count

    const recentRows = db
      .prepare('SELECT * FROM profiles ORDER BY last_used_at DESC NULLS LAST LIMIT 5')
      .all() as ProfileRow[]

    return {
      totalProfiles: total,
      runningProfiles: running,
      stoppedProfiles: stopped,
      totalProxies,
      totalGroups,
      recentProfiles: recentRows.map(profileFromRow)
    }
  }

  setStatus(id: string, status: string, pid: number | null = null): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare('UPDATE profiles SET status = ?, pid = ?, updated_at = ?, last_used_at = ? WHERE id = ?')
      .run(status, pid, now, now, id)
  }

  getRunning(): Profile[] {
    const db = getDatabase()
    const rows = db.prepare("SELECT * FROM profiles WHERE status = 'running'").all() as ProfileRow[]
    return rows.map(profileFromRow)
  }

  getByProxyId(proxyId: string): Profile[] {
    if (!proxyId) return []
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM profiles WHERE proxy_id = ?').all(proxyId) as ProfileRow[]
    return rows.map(profileFromRow)
  }

  resetAllStatuses(): void {
    const db = getDatabase()
    db.prepare("UPDATE profiles SET status = 'stopped', pid = NULL WHERE status = 'running'").run()
  }
}

export const profileRepo = new ProfileRepository()
