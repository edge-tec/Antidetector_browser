// ──────────────────────────────────────────────
// ProfileVault — Proxy Repository
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
    const id = uuidv4()
    let encryptedPwd: Buffer | null = null

    if (input.password) {
      encryptedPwd = encryptPassword(input.password)
    }

    db.prepare(`
      INSERT INTO proxies (id, name, type, host, port, username, encrypted_password, country, region, city, isp, asn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.asn ?? ''
    )

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

    if (sets.length === 0) return proxyToDisplay(existing)

    params.push(id)
    db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getDisplayById(id)
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
    db.prepare('UPDATE proxies SET test_status = ?, last_tested = datetime(\'now\') WHERE id = ?')
      .run(status, id)
  }

  getDecryptedPassword(id: string): string | null {
    const proxy = this.getById(id)
    if (!proxy || !proxy.encryptedPassword) return null
    return decryptPassword(proxy.encryptedPassword)
  }
}

export const proxyRepo = new ProxyRepository()
