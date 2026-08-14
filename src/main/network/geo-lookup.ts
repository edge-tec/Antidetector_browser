// ──────────────────────────────────────────────────────────────────
// ProfileVault v2 — IP Geo-Lookup Module
// Resolves location, timezone, ISP, ASN, and coordinates for proxy IPs
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import https from 'https'
import { logger } from '../logging/logger'

export interface GeoLocationResult {
  ip: string
  country: string           // ISO 2-letter, e.g. "US"
  countryName: string       // e.g. "United States"
  city: string              // e.g. "New York"
  region: string            // e.g. "NY"
  timezone: string          // e.g. "America/New_York"
  isp: string               // e.g. "Comcast Cable"
  asn: string               // e.g. "AS7922"
  latitude: number
  longitude: number
}

// In-memory LRU-like cache for IP lookup results
const geoCache = new Map<string, { data: GeoLocationResult; timestamp: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch geo location info for a given IP or proxy host.
 */
export async function lookupGeoIP(ipOrHost: string): Promise<GeoLocationResult | null> {
  if (!ipOrHost || ipOrHost === 'localhost' || ipOrHost === '127.0.0.1') {
    return null
  }

  // Check cache first
  const cached = geoCache.get(ipOrHost)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  try {
    const data = await fetchFromIpApi(ipOrHost)
    if (data) {
      geoCache.set(ipOrHost, { data, timestamp: Date.now() })
      logger.info('proxy', `Geo lookup succeeded for ${ipOrHost}: ${data.country} / ${data.city}`)
      return data
    }
  } catch (err: any) {
    logger.warn('proxy', `Geo lookup failed for ${ipOrHost}: ${err.message}`)
  }

  return null
}

function fetchFromIpApi(ip: string): Promise<GeoLocationResult | null> {
  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,as,query`

    const req = http.get(url, { timeout: 5000 }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          if (json.status === 'success') {
            resolve({
              ip: json.query || ip,
              country: json.countryCode || '',
              countryName: json.country || '',
              city: json.city || '',
              region: json.region || '',
              timezone: json.timezone || '',
              isp: json.isp || '',
              asn: json.as || '',
              latitude: json.lat || 0,
              longitude: json.lon || 0
            })
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

/**
 * Clear the geo-lookup cache.
 */
export function clearGeoCache(): void {
  geoCache.clear()
}
