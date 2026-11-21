// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Bulk Proxy Importer & Live IP Fraud Score Checker
// Supports BrightData, IPRoyal, Smartproxy, Webshare, Oxylabs, SOAX,
// and standard protocol://user:pass@host:port & host:port:user:pass.
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import { ProxyRepository } from '../database/repositories/proxy.repo'
import type { ProxyType } from '../database/models'

export interface ParsedProxyEntry {
  name: string
  type: ProxyType
  host: string
  port: number
  username: string
  password: string
}

export interface BulkProxyParseResult {
  parsed: ParsedProxyEntry[]
  invalidLines: string[]
  duplicatesRemoved: number
}

export interface IpFraudScoreResult {
  query: string
  ip: string
  country: string
  countryCode: string
  region: string
  city: string
  isp: string
  asn: string
  timezone: string
  latitude: number
  longitude: number
  isProxy: boolean
  isHosting: boolean
  isMobile: boolean
  fraudScore: number
  riskLevel: 'clean' | 'low' | 'medium' | 'high'
  category: string
  latencyMs: number
}

const VALID_PROTOCOLS: ProxyType[] = ['http', 'https', 'socks4', 'socks5']

/**
 * Parse multi-line bulk proxy lists in any major commercial provider format.
 */
export function parseBulkProxies(rawText: string, defaultType: ProxyType = 'socks5'): BulkProxyParseResult {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  const parsed: ParsedProxyEntry[] = []
  const invalidLines: string[] = []
  const seen = new Set<string>()
  let duplicatesRemoved = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let type: ProxyType = VALID_PROTOCOLS.includes(defaultType) ? defaultType : 'socks5'
    let host = ''
    let port = 0
    let username = ''
    let password = ''

    try {
      // Format 1: protocol://[user:pass@]host:port
      if (/^(https?|socks4|socks5):\/\//i.test(line)) {
        const u = new URL(line)
        const proto = u.protocol.replace(':', '').toLowerCase() as ProxyType
        if (VALID_PROTOCOLS.includes(proto)) type = proto
        host = u.hostname
        port = Number(u.port)
        username = decodeURIComponent(u.username || '')
        password = decodeURIComponent(u.password || '')
      } else if (line.includes('@')) {
        // Format 2: user:pass@host:port
        const [creds, hostPort] = line.split('@', 2)
        const colonIdx = creds.indexOf(':')
        if (colonIdx !== -1) {
          username = creds.slice(0, colonIdx)
          password = creds.slice(colonIdx + 1)
        } else {
          username = creds
        }
        const [h, p] = hostPort.split(':')
        host = h
        port = Number(p)
      } else {
        // Format 3: host:port OR host:port:user:pass
        const parts = line.split(':')
        if (parts.length === 2) {
          host = parts[0]
          port = Number(parts[1])
        } else if (parts.length >= 4) {
          host = parts[0]
          port = Number(parts[1])
          username = parts[2]
          password = parts.slice(3).join(':')
        } else {
          invalidLines.push(line)
          continue
        }
      }

      if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
        invalidLines.push(line)
        continue
      }

      const dedupeKey = `${type}://${username}@${host.toLowerCase()}:${port}`
      if (seen.has(dedupeKey)) {
        duplicatesRemoved++
        continue
      }
      seen.add(dedupeKey)

      parsed.push({
        name: `${type.toUpperCase()} ${host}:${port}`,
        type,
        host,
        port,
        username,
        password
      })
    } catch {
      invalidLines.push(line)
    }
  }

  return { parsed, invalidLines, duplicatesRemoved }
}

/**
 * Import bulk proxies directly into the SQLite ProxyRepository.
 */
export function importBulkProxies(rawText: string, defaultType: ProxyType = 'socks5') {
  const { parsed, invalidLines, duplicatesRemoved } = parseBulkProxies(rawText, defaultType)
  const repo = new ProxyRepository()
  const created: any[] = []
  const errors: string[] = []

  for (const item of parsed) {
    try {
      const saved = repo.create({
        name: item.name,
        type: item.type,
        host: item.host,
        port: item.port,
        username: item.username,
        password: item.password
      })
      created.push(saved)
    } catch (err: any) {
      errors.push(`${item.host}:${item.port} — ${err.message}`)
    }
  }

  return {
    importedCount: created.length,
    invalidCount: invalidLines.length,
    duplicatesRemoved,
    errors,
    proxies: created
  }
}

/**
 * Live IP Fraud / Risk Score & Residential vs Datacenter Classification.
 */
export async function checkIpFraudScore(ipOrHost: string): Promise<IpFraudScoreResult> {
  const target = String(ipOrHost || '').trim()
  if (!target) throw new Error('IP address or proxy hostname is required')

  const start = Date.now()
  const fields = 'status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,mobile,timezone,lat,lon,query'
  const url = `http://ip-api.com/json/${encodeURIComponent(target)}?fields=${fields}`

  const data: any = await new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 10000 }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new Error('Invalid JSON from IP intelligence provider'))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('IP intelligence lookup timed out'))
    })
  })

  const latencyMs = Date.now() - start
  if (data.status !== 'success') {
    throw new Error(data.message || `Could not resolve IP intelligence for "${target}"`)
  }

  const isProxy = Boolean(data.proxy)
  const isHosting = Boolean(data.hosting)
  const isMobile = Boolean(data.mobile)

  let fraudScore = 5
  let category = 'Clean Residential ISP'
  if (isMobile) {
    fraudScore = 2
    category = 'Clean Mobile 4G/5G Carrier'
  }
  if (isHosting) {
    fraudScore += 45
    category = 'Datacenter / Cloud Hosting'
  }
  if (isProxy) {
    fraudScore += 40
    category = isHosting ? 'Flagged Datacenter Proxy/VPN' : 'Flagged Proxy / VPN'
  }
  fraudScore = Math.min(100, fraudScore)

  const riskLevel: IpFraudScoreResult['riskLevel'] =
    fraudScore <= 15 ? 'clean' : fraudScore <= 35 ? 'low' : fraudScore <= 65 ? 'medium' : 'high'

  return {
    query: target,
    ip: data.query || target,
    country: data.country || '',
    countryCode: data.countryCode || '',
    region: data.regionName || '',
    city: data.city || '',
    isp: data.isp || data.org || '',
    asn: data.as || '',
    timezone: data.timezone || '',
    latitude: Number(data.lat || 0),
    longitude: Number(data.lon || 0),
    isProxy,
    isHosting,
    isMobile,
    fraudScore,
    riskLevel,
    category,
    latencyMs
  }
}
