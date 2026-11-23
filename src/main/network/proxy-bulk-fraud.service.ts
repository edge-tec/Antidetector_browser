// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Bulk Proxy Importer & Live IP Fraud Score Checker
// Supports BrightData, IPRoyal, Smartproxy, Webshare, Oxylabs, SOAX,
// and standard protocol://user:pass@host:port & host:port:user:pass.
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import https from 'https'
import { ProxyRepository } from '../database/repositories/proxy.repo'
import { startProxyBridge, stopProxyBridge } from './proxy-bridge'
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
 * Resolve the real exit IP through an active proxy (supports rotating residential gateways
 * like brd.superproxy.io, gate.smartproxy.com, geo.iproyal.com, or any proxyId).
 */
export async function resolveProxyExitIp(proxyId: string): Promise<{ exitIp: string; latencyMs: number }> {
  const proxy = ProxyRepository.findById(proxyId)
  if (!proxy) throw new Error(`Proxy not found: ${proxyId}`)
  const start = Date.now()
  const bridgeProfileKey = `fraud_probe_${proxyId}`
  const localBridgeUrl = await startProxyBridge(bridgeProfileKey, proxy)
  const bridgePort = Number(localBridgeUrl.split(':').pop())

  try {
    const exitIp = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: bridgePort,
          method: 'GET',
          path: 'http://ip-api.com/json/?fields=status,query',
          headers: { Host: 'ip-api.com', 'User-Agent': 'AntiProfiles-ProxyProbe/2.0' },
          timeout: 12000
        },
        (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              if (parsed?.query) resolve(String(parsed.query))
              else reject(new Error('Proxy did not return a valid exit IP'))
            } catch {
              reject(new Error('Invalid response through proxy tunnel'))
            }
          })
        }
      )
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Proxy tunnel probe timed out'))
      })
      req.end()
    })
    return { exitIp, latencyMs: Date.now() - start }
  } finally {
    stopProxyBridge(bridgeProfileKey)
  }
}

/**
 * Live IP Fraud / Risk Score & Residential vs Datacenter Classification.
 * Accepts either an IP address, hostname, or a saved Proxy ID ( automatically resolves exit IP through tunnel).
 */
export async function checkIpFraudScore(ipOrHostOrProxyId: string): Promise<IpFraudScoreResult> {
  let target = String(ipOrHostOrProxyId || '').trim()
  if (!target) throw new Error('IP address, proxy hostname, or proxy ID is required')

  let tunnelLatencyMs = 0
  // If user passed a saved proxyId or rotating gateway host that matches a stored proxy, resolve real exit IP
  try {
    const repo = new ProxyRepository()
    const allProxies = repo.getAll()
    const matchedProxy = allProxies.find((p) => p.id === target || `${p.host}:${p.port}` === target)
    if (matchedProxy) {
      const probe = await resolveProxyExitIp(matchedProxy.id)
      target = probe.exitIp
      tunnelLatencyMs = probe.latencyMs
    }
  } catch {}

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
    req.on('error', async () => {
      // HTTPS fallback via ipwho.is if plain HTTP port 80 is filtered by ISP
      try {
        const fallbackData = await new Promise<any>((resFallback, rejFallback) => {
          https.get(`https://ipwho.is/${encodeURIComponent(target)}`, { timeout: 10000 }, (r2) => {
            let b2 = ''
            r2.on('data', (c) => (b2 += c))
            r2.on('end', () => {
              try {
                const j = JSON.parse(b2)
                resFallback({
                  status: j.success !== false ? 'success' : 'fail',
                  query: j.ip || target,
                  country: j.country,
                  countryCode: j.country_code,
                  regionName: j.region,
                  city: j.city,
                  isp: j.connection?.isp || j.connection?.org || '',
                  as: j.connection?.asn ? `AS${j.connection.asn}` : '',
                  timezone: j.timezone?.id || '',
                  lat: j.latitude,
                  lon: j.longitude,
                  proxy: Boolean(j.security?.proxy || j.security?.vpn || j.security?.tor),
                  hosting: Boolean(j.security?.hosting),
                  mobile: false
                })
              } catch (e) {
                rejFallback(e)
              }
            })
          }).on('error', rejFallback)
        })
        resolve(fallbackData)
      } catch (e2) {
        reject(e2)
      }
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('IP intelligence lookup timed out'))
    })
  })

  const latencyMs = tunnelLatencyMs || (Date.now() - start)
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
