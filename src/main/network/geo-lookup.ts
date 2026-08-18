// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — IP Geo-Lookup Module
// Resolves location, timezone, ISP, ASN, ZIP, and coordinates for proxy IPs
// ──────────────────────────────────────────────────────────────────

import http from 'http'
import https from 'https'
import { logger } from '../logging/logger'

export interface GeoLocationResult {
  ip: string
  country: string           // ISO 2-letter, e.g. "US"
  countryName: string       // e.g. "United States"
  city: string              // e.g. "Bay City"
  region: string            // e.g. "MI"
  regionName: string        // e.g. "Michigan"
  zip: string               // e.g. "48708"
  timezone: string          // e.g. "America/Detroit"
  isp: string               // e.g. "Charter Communications"
  org: string               // e.g. "Spectrum"
  asn: string               // e.g. "AS7922"
  latitude: number
  longitude: number
  flag?: string
}

// In-memory LRU-like cache for IP lookup results
const geoCache = new Map<string, { data: GeoLocationResult; timestamp: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function getCountryFlag(countryCode: string | undefined | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  } catch {
    return '🌐'
  }
}

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
    // 1. Primary: ip-api.com
    let data = await fetchFromIpApi(ipOrHost)

    // 2. Fallback: ipwho.is if ip-api fails
    if (!data) {
      data = await fetchFromIpWhoIs(ipOrHost)
    }

    if (data) {
      data.flag = getCountryFlag(data.country)
      geoCache.set(ipOrHost, { data, timestamp: Date.now() })
      logger.info('proxy', `Geo lookup succeeded for ${ipOrHost}: ${data.countryName} / ${data.regionName} / ${data.city} (ZIP: ${data.zip})`)
      return data
    }
  } catch (err: any) {
    logger.warn('proxy', `Geo lookup failed for ${ipOrHost}: ${err.message}`)
  }

  return null
}

function fetchFromIpApi(ip: string): Promise<GeoLocationResult | null> {
  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`

    const req = http.get(url, { timeout: 6000 }, (res) => {
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
              regionName: json.regionName || json.region || '',
              zip: json.zip || '',
              timezone: json.timezone || '',
              isp: json.isp || '',
              org: json.org || '',
              asn: json.as || '',
              latitude: typeof json.lat === 'number' ? json.lat : 0,
              longitude: typeof json.lon === 'number' ? json.lon : 0
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

function fetchFromIpWhoIs(ip: string): Promise<GeoLocationResult | null> {
  return new Promise((resolve) => {
    const url = `https://ipwho.is/${encodeURIComponent(ip)}`

    const req = https.get(url, { timeout: 6000 }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          if (json.success) {
            resolve({
              ip: json.ip || ip,
              country: json.country_code || '',
              countryName: json.country || '',
              city: json.city || '',
              region: json.region_code || '',
              regionName: json.region || '',
              zip: json.postal || '',
              timezone: json.timezone?.id || '',
              isp: json.connection?.isp || '',
              org: json.connection?.org || '',
              asn: json.connection?.asn ? `AS${json.connection.asn}` : '',
              latitude: typeof json.latitude === 'number' ? json.latitude : 0,
              longitude: typeof json.longitude === 'number' ? json.longitude : 0
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
