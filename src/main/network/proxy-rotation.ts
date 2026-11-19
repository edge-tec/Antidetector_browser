// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Advanced Proxy Rotation & Failover Manager
// Supports rotation URL triggers, manual rotation, backup failover,
// and rotation history auditing without logging proxy credentials
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import https from 'https'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { logger } from '../logging/logger'

export interface ProxyRotationResult {
  proxyId: string
  success: boolean
  statusCode?: number
  message: string
  rotatedAt: string
}

export class ProxyRotationManager {
  static configureProxyEnterprise(
    proxyId: string,
    config: { rotationUrl?: string; failoverProxyId?: string | null; proxyGroup?: string }
  ): boolean {
    const db = getDatabase()
    const sets: string[] = []
    const params: any[] = []

    if (config.rotationUrl !== undefined) {
      sets.push('rotation_url = ?')
      params.push(config.rotationUrl.trim())
    }
    if (config.failoverProxyId !== undefined) {
      sets.push('failover_proxy_id = ?')
      params.push(config.failoverProxyId || null)
    }
    if (config.proxyGroup !== undefined) {
      sets.push('proxy_group = ?')
      params.push(config.proxyGroup.trim())
    }
    if (sets.length === 0) return false

    params.push(proxyId)
    const res = db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return res.changes > 0
  }

  /**
   * Trigger a mobile/4G proxy IP rotation via its configured rotation URL.
   */
  static async rotateProxy(proxyId: string): Promise<ProxyRotationResult> {
    const db = getDatabase()
    const row = db.prepare('SELECT id, rotation_url, public_ip FROM proxies WHERE id = ?').get(proxyId) as any
    if (!row) throw new Error(`Proxy not found: ${proxyId}`)
    if (!row.rotation_url) {
      throw new Error('No rotation URL configured for this proxy.')
    }

    const rotatedAt = new Date().toISOString()
    const urlStr = String(row.rotation_url)
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      throw new Error('Rotation URL must use http:// or https:// protocol.')
    }

    try {
      const statusCode = await new Promise<number>((resolve, reject) => {
        const client = urlStr.startsWith('https://') ? https : http
        const req = client.get(urlStr, { timeout: 15000 }, (res) => {
          res.resume()
          resolve(res.statusCode || 0)
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Rotation request timed out')) })
      })

      const success = statusCode >= 200 && statusCode < 400
      const msg = success ? `Rotation triggered successfully (HTTP ${statusCode})` : `Rotation endpoint returned HTTP ${statusCode}`

      db.prepare('UPDATE proxies SET last_rotated_at = ? WHERE id = ?').run(rotatedAt, proxyId)
      db.prepare(`
        INSERT INTO proxy_rotation_history (id, proxy_id, old_ip, new_ip, success, message, rotated_at)
        VALUES (?, ?, ?, '', ?, ?, ?)
      `).run(uuidv4(), proxyId, row.public_ip || '', success ? 1 : 0, msg, rotatedAt)

      logger.info('proxy', `[ProxyRotation] Proxy ${proxyId}: ${msg}`)
      return { proxyId, success, statusCode, message: msg, rotatedAt }
    } catch (err: any) {
      const msg = `Rotation failed: ${err.message}`
      db.prepare(`
        INSERT INTO proxy_rotation_history (id, proxy_id, old_ip, new_ip, success, message, rotated_at)
        VALUES (?, ?, ?, '', 0, ?, ?)
      `).run(uuidv4(), proxyId, row.public_ip || '', msg, rotatedAt)
      return { proxyId, success: false, message: msg, rotatedAt }
    }
  }

  /**
   * Resolve a healthy backup failover proxy if the primary proxy is dead/unreachable.
   */
  static getFailoverProxy(primaryProxyId: string) {
    const db = getDatabase()
    const row = db.prepare('SELECT failover_proxy_id FROM proxies WHERE id = ?').get(primaryProxyId) as { failover_proxy_id: string | null } | undefined
    if (!row?.failover_proxy_id) return null
    return proxyRepo.getById(row.failover_proxy_id)
  }

  static getRotationHistory(proxyId: string, limit = 25): any[] {
    const db = getDatabase()
    return db
      .prepare('SELECT id, proxy_id, old_ip, new_ip, success, message, rotated_at FROM proxy_rotation_history WHERE proxy_id = ? ORDER BY rotated_at DESC LIMIT ?')
      .all(proxyId, limit)
  }
}
