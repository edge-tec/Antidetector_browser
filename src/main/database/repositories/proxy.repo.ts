// ──────────────────────────────────────────────
// AntiProfiles — Proxy Repository
// ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../connection'
import {
  Proxy,
  ProxyCreateInput,
  ProxyUpdateInput,
  ProxyRow,
  ProxyDisplay,
  proxyFromRow,
  proxyToDisplay
} from '../models'
import { encryptPassword, decryptPassword } from '../../security/encryption'

export class ProxyRepository {
  getAll(): ProxyDisplay[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM proxies ORDER BY created_at DESC').all() as ProxyRow[]
    return rows.map(proxyFromRow).map(proxyToDisplay)
  }

  getById(id: string): Proxy | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM proxies WHERE id = ?').get(id) as ProxyRow | undefined
    return row ? proxyFromRow(row) : null
  }

  getDisplayById(id: string): ProxyDisplay | null {
    const proxy = this.getById(id)
    return proxy ? proxyToDisplay(proxy) : null
  }

  create(input: ProxyCreateInput): ProxyDisplay {
    const db = getDatabase()
    const id = (input as any).id || uuidv4()
    let encryptedPwd: Buffer | null = null

    if (input.password) {
      encryptedPwd = encryptPassword(input.password)
    }

    const runInsert = () => {
      db.prepare(`
        INSERT INTO proxies (id, name, type, host, port, username, encrypted_password, country, region, city, isp, asn, timezone, latitude, longitude, public_ip, proxy_version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        id,
        input.name,
        input.type,
        input.host ?? '',
        input.port ?? 0,
        input.username ?? '',
        encryptedPwd,
        input.country ?? '',
        input.region ?? '',
        input.city ?? '',
        input.isp ?? '',
        input.asn ?? '',
        input.timezone ?? '',
        typeof input.latitude === 'number' ? input.latitude : null,
        typeof input.longitude === 'number' ? input.longitude : null,
        input.publicIp ?? '',
        input.proxyVersion ?? 1
      )
    }

    try {
      runInsert()
    } catch (insertErr: any) {
      if (insertErr?.message?.includes('no column named') || insertErr?.message?.includes('has no column')) {
        const repairCols = [
          "ALTER TABLE proxies ADD COLUMN country TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN region TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN city TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN isp TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN asn TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN timezone TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN latitude REAL DEFAULT NULL",
          "ALTER TABLE proxies ADD COLUMN longitude REAL DEFAULT NULL",
          "ALTER TABLE proxies ADD COLUMN public_ip TEXT DEFAULT ''",
          "ALTER TABLE proxies ADD COLUMN proxy_version INTEGER DEFAULT 1",
          "ALTER TABLE proxies ADD COLUMN updated_at TEXT"
        ]
        for (const sql of repairCols) {
          try { db.exec(sql) } catch {}
        }
        runInsert()
      } else {
        throw insertErr
      }
    }

    return this.getDisplayById(id)!
  }

  update(id: string, input: ProxyUpdateInput): ProxyDisplay | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const sets: string[] = []
    const params: any[] = []

    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
    if (input.type !== undefined) { sets.push('type = ?'); params.push(input.type) }
    if (input.host !== undefined) { sets.push('host = ?'); params.push(input.host) }
    if (input.port !== undefined) { sets.push('port = ?'); params.push(input.port) }
    if (input.username !== undefined) { sets.push('username = ?'); params.push(input.username) }
    if (input.password !== undefined) {
      sets.push('encrypted_password = ?')
      params.push(input.password ? encryptPassword(input.password) : null)
    }
    if (input.country !== undefined) { sets.push('country = ?'); params.push(input.country) }
    if (input.region !== undefined) { sets.push('region = ?'); params.push(input.region) }
    if (input.city !== undefined) { sets.push('city = ?'); params.push(input.city) }
    if (input.isp !== undefined) { sets.push('isp = ?'); params.push(input.isp) }
    if (input.asn !== undefined) { sets.push('asn = ?'); params.push(input.asn) }
    if (input.timezone !== undefined) { sets.push('timezone = ?'); params.push(input.timezone) }
    if (input.latitude !== undefined) { sets.push('latitude = ?'); params.push(input.latitude) }
    if (input.longitude !== undefined) { sets.push('longitude = ?'); params.push(input.longitude) }
    if (input.publicIp !== undefined) { sets.push('public_ip = ?'); params.push(input.publicIp) }

    // Always bump version and updated_at
    const newVersion = (existing.proxyVersion || 1) + 1
    const now = new Date().toISOString()
    sets.push('proxy_version = ?')
    params.push(newVersion)
    sets.push('updated_at = ?')
    params.push(now)

    params.push(id)
    try {
      db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    } catch (updateErr: any) {
      if (updateErr?.message?.includes('no column named') || updateErr?.message?.includes('has no column')) {
        try { db.exec('ALTER TABLE proxies ADD COLUMN updated_at TEXT') } catch {}
        try { db.exec('ALTER TABLE proxies ADD COLUMN proxy_version INTEGER DEFAULT 1') } catch {}
        db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...params)
      } else {
        throw updateErr
      }
    }
    return this.getDisplayById(id)
  }

  upsertFromRemote(remoteProxy: any): ProxyDisplay | null {
    if (!remoteProxy || !remoteProxy.id) return null
    const existing = this.getById(remoteProxy.id)
    if (!existing) {
      return this.create({
        ...remoteProxy,
        id: remoteProxy.id,
        proxyVersion: remoteProxy.proxy_version || remoteProxy.proxyVersion || 1,
        publicIp: remoteProxy.public_ip || remoteProxy.publicIp || ''
      })
    }

    const db = getDatabase()
    const sets: string[] = []
    const params: any[] = []

    if (remoteProxy.name !== undefined) { sets.push('name = ?'); params.push(remoteProxy.name) }
    if (remoteProxy.type !== undefined) { sets.push('type = ?'); params.push(remoteProxy.type) }
    if (remoteProxy.host !== undefined) { sets.push('host = ?'); params.push(remoteProxy.host) }
    if (remoteProxy.port !== undefined) { sets.push('port = ?'); params.push(remoteProxy.port) }
    if (remoteProxy.username !== undefined) { sets.push('username = ?'); params.push(remoteProxy.username) }
    if (remoteProxy.password !== undefined && remoteProxy.password !== '') {
      sets.push('encrypted_password = ?')
      params.push(encryptPassword(remoteProxy.password))
    }
    if (remoteProxy.country !== undefined) { sets.push('country = ?'); params.push(remoteProxy.country) }
    if (remoteProxy.region !== undefined) { sets.push('region = ?'); params.push(remoteProxy.region) }
    if (remoteProxy.city !== undefined) { sets.push('city = ?'); params.push(remoteProxy.city) }
    if (remoteProxy.isp !== undefined) { sets.push('isp = ?'); params.push(remoteProxy.isp) }
    if (remoteProxy.asn !== undefined) { sets.push('asn = ?'); params.push(remoteProxy.asn) }
    if (remoteProxy.timezone !== undefined) { sets.push('timezone = ?'); params.push(remoteProxy.timezone) }
    if (remoteProxy.latitude !== undefined) { sets.push('latitude = ?'); params.push(remoteProxy.latitude) }
    if (remoteProxy.longitude !== undefined) { sets.push('longitude = ?'); params.push(remoteProxy.longitude) }
    if (remoteProxy.public_ip !== undefined || remoteProxy.publicIp !== undefined) {
      sets.push('public_ip = ?')
      params.push(remoteProxy.public_ip ?? remoteProxy.publicIp ?? '')
    }
    if (remoteProxy.proxy_version !== undefined || remoteProxy.proxyVersion !== undefined) {
      sets.push('proxy_version = ?')
      params.push(remoteProxy.proxy_version ?? remoteProxy.proxyVersion)
    }
    if (remoteProxy.updated_at || remoteProxy.updatedAt) {
      sets.push('updated_at = ?')
      params.push(remoteProxy.updated_at ?? remoteProxy.updatedAt)
    } else {
      sets.push("updated_at = datetime('now')")
    }

    if (sets.length > 0) {
      params.push(remoteProxy.id)
      db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    }

    return this.getDisplayById(remoteProxy.id)
  }

  getByHost(host: string): Proxy | null {
    if (!host) return null
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM proxies WHERE host = ? ORDER BY created_at DESC LIMIT 1').get(host) as ProxyRow | undefined
    return row ? proxyFromRow(row) : null
  }

  updateGeoLocation(id: string, geo: { country?: string; region?: string; city?: string; isp?: string; asn?: string; timezone?: string; latitude?: number; longitude?: number; publicIp?: string }): ProxyDisplay | null {
    return this.update(id, {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      isp: geo.isp,
      asn: geo.asn,
      timezone: geo.timezone,
      latitude: geo.latitude,
      longitude: geo.longitude,
      publicIp: geo.publicIp
    })
  }

  delete(id: string): boolean {
    const db = getDatabase()
    // Unlink profiles using this proxy
    db.prepare('UPDATE profiles SET proxy_id = NULL WHERE proxy_id = ?').run(id)
    const result = db.prepare('DELETE FROM proxies WHERE id = ?').run(id)
    return result.changes > 0
  }

  updateTestStatus(id: string, status: string): void {
    const db = getDatabase()
    db.prepare("UPDATE proxies SET test_status = ?, last_tested = datetime('now') WHERE id = ?")
      .run(status, id)
  }

  getDecryptedPassword(id: string): string | null {
    const proxy = this.getById(id)
    if (!proxy || !proxy.encryptedPassword) return null
    return decryptPassword(proxy.encryptedPassword)
  }
}

export const proxyRepo = new ProxyRepository()
