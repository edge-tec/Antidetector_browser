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

// ── Comprehensive Offline Geo & Timezone Dictionary for Major Cities & States ──
const KNOWN_GEO_DICT: Record<string, { lat: number; lon: number; tz: number | string; regionName?: string; country?: string }> = {
  // US Major Cities
  'new york': { lat: 40.7128, lon: -74.0060, tz: 'America/New_York', regionName: 'New York', country: 'US' },
  'nyc': { lat: 40.7128, lon: -74.0060, tz: 'America/New_York', regionName: 'New York', country: 'US' },
  'los angeles': { lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles', regionName: 'California', country: 'US' },
  'san francisco': { lat: 37.7749, lon: -122.4194, tz: 'America/Los_Angeles', regionName: 'California', country: 'US' },
  'san jose': { lat: 37.3382, lon: -121.8863, tz: 'America/Los_Angeles', regionName: 'California', country: 'US' },
  'san diego': { lat: 32.7157, lon: -117.1611, tz: 'America/Los_Angeles', regionName: 'California', country: 'US' },
  'sacramento': { lat: 38.5816, lon: -121.4944, tz: 'America/Los_Angeles', regionName: 'California', country: 'US' },
  'chicago': { lat: 41.8781, lon: -87.6298, tz: 'America/Chicago', regionName: 'Illinois', country: 'US' },
  'houston': { lat: 29.7604, lon: -95.3698, tz: 'America/Chicago', regionName: 'Texas', country: 'US' },
  'dallas': { lat: 32.7767, lon: -96.7970, tz: 'America/Chicago', regionName: 'Texas', country: 'US' },
  'austin': { lat: 30.2672, lon: -97.7431, tz: 'America/Chicago', regionName: 'Texas', country: 'US' },
  'san antonio': { lat: 29.4241, lon: -98.4936, tz: 'America/Chicago', regionName: 'Texas', country: 'US' },
  'miami': { lat: 25.7617, lon: -80.1918, tz: 'America/New_York', regionName: 'Florida', country: 'US' },
  'orlando': { lat: 28.5383, lon: -81.3792, tz: 'America/New_York', regionName: 'Florida', country: 'US' },
  'tampa': { lat: 27.9506, lon: -82.4572, tz: 'America/New_York', regionName: 'Florida', country: 'US' },
  'jacksonville': { lat: 30.3322, lon: -81.6557, tz: 'America/New_York', regionName: 'Florida', country: 'US' },
  'seattle': { lat: 47.6062, lon: -122.3321, tz: 'America/Los_Angeles', regionName: 'Washington', country: 'US' },
  'denver': { lat: 39.7392, lon: -104.9903, tz: 'America/Denver', regionName: 'Colorado', country: 'US' },
  'phoenix': { lat: 33.4484, lon: -112.0740, tz: 'America/Phoenix', regionName: 'Arizona', country: 'US' },
  'atlanta': { lat: 33.7490, lon: -84.3880, tz: 'America/New_York', regionName: 'Georgia', country: 'US' },
  'boston': { lat: 42.3601, lon: -71.0589, tz: 'America/New_York', regionName: 'Massachusetts', country: 'US' },
  'philadelphia': { lat: 39.9526, lon: -75.1652, tz: 'America/New_York', regionName: 'Pennsylvania', country: 'US' },
  'detroit': { lat: 42.3314, lon: -83.0458, tz: 'America/Detroit', regionName: 'Michigan', country: 'US' },
  'las vegas': { lat: 36.1699, lon: -115.1398, tz: 'America/Los_Angeles', regionName: 'Nevada', country: 'US' },
  'portland': { lat: 45.5152, lon: -122.6784, tz: 'America/Los_Angeles', regionName: 'Oregon', country: 'US' },
  'minneapolis': { lat: 44.9778, lon: -93.2650, tz: 'America/Chicago', regionName: 'Minnesota', country: 'US' },
  'st. louis': { lat: 38.6270, lon: -90.1994, tz: 'America/Chicago', regionName: 'Missouri', country: 'US' },
  'kansas city': { lat: 39.0997, lon: -94.5786, tz: 'America/Chicago', regionName: 'Missouri', country: 'US' },
  'charlotte': { lat: 35.2271, lon: -80.8431, tz: 'America/New_York', regionName: 'North Carolina', country: 'US' },
  'raleigh': { lat: 35.7796, lon: -78.6382, tz: 'America/New_York', regionName: 'North Carolina', country: 'US' },
  'nashville': { lat: 36.1627, lon: -86.7816, tz: 'America/Chicago', regionName: 'Tennessee', country: 'US' },
  'indianapolis': { lat: 39.7684, lon: -86.1581, tz: 'America/Indiana/Indianapolis', regionName: 'Indiana', country: 'US' },
  'columbus': { lat: 39.9612, lon: -82.9988, tz: 'America/New_York', regionName: 'Ohio', country: 'US' },
  'cleveland': { lat: 41.4993, lon: -81.6944, tz: 'America/New_York', regionName: 'Ohio', country: 'US' },
  'salt lake city': { lat: 40.7608, lon: -111.8910, tz: 'America/Denver', regionName: 'Utah', country: 'US' },
  'washington': { lat: 38.9072, lon: -77.0369, tz: 'America/New_York', regionName: 'District of Columbia', country: 'US' },
  'honolulu': { lat: 21.3069, lon: -157.8583, tz: 'Pacific/Honolulu', regionName: 'Hawaii', country: 'US' },
  'anchorage': { lat: 61.2181, lon: -149.9003, tz: 'America/Anchorage', regionName: 'Alaska', country: 'US' },

  // International Major Cities
  'london': { lat: 51.5074, lon: -0.1278, tz: 'Europe/London', regionName: 'England', country: 'GB' },
  'manchester': { lat: 53.4808, lon: -2.2426, tz: 'Europe/London', regionName: 'England', country: 'GB' },
  'birmingham': { lat: 52.4862, lon: -1.8904, tz: 'Europe/London', regionName: 'England', country: 'GB' },
  'toronto': { lat: 43.6532, lon: -79.3832, tz: 'America/Toronto', regionName: 'Ontario', country: 'CA' },
  'montreal': { lat: 45.5017, lon: -73.5673, tz: 'America/Toronto', regionName: 'Quebec', country: 'CA' },
  'vancouver': { lat: 49.2827, lon: -123.1207, tz: 'America/Vancouver', regionName: 'British Columbia', country: 'CA' },
  'calgary': { lat: 51.0447, lon: -114.0719, tz: 'America/Edmonton', regionName: 'Alberta', country: 'CA' },
  'berlin': { lat: 52.5200, lon: 13.4050, tz: 'Europe/Berlin', regionName: 'Berlin', country: 'DE' },
  'frankfurt': { lat: 50.1109, lon: 8.6821, tz: 'Europe/Berlin', regionName: 'Hesse', country: 'DE' },
  'munich': { lat: 48.1351, lon: 11.5820, tz: 'Europe/Berlin', regionName: 'Bavaria', country: 'DE' },
  'paris': { lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris', regionName: 'Île-de-France', country: 'FR' },
  'amsterdam': { lat: 52.3676, lon: 4.9041, tz: 'Europe/Amsterdam', regionName: 'North Holland', country: 'NL' },
  'sydney': { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney', regionName: 'New South Wales', country: 'AU' },
  'melbourne': { lat: -37.8136, lon: 144.9631, tz: 'Australia/Melbourne', regionName: 'Victoria', country: 'AU' },
  'brisbane': { lat: -27.4698, lon: 153.0251, tz: 'Australia/Brisbane', regionName: 'Queensland', country: 'AU' },
  'tokyo': { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo', regionName: 'Tokyo', country: 'JP' },
  'singapore': { lat: 1.3521, lon: 103.8198, tz: 'Asia/Singapore', regionName: 'Singapore', country: 'SG' },
  'hong kong': { lat: 22.3193, lon: 114.1694, tz: 'Asia/Hong_Kong', regionName: 'Hong Kong', country: 'HK' },
  'seoul': { lat: 37.5665, lon: 126.9780, tz: 'Asia/Seoul', regionName: 'Seoul', country: 'KR' },
  'mumbai': { lat: 19.0760, lon: 72.8777, tz: 'Asia/Kolkata', regionName: 'Maharashtra', country: 'IN' },
  'delhi': { lat: 28.7041, lon: 77.1025, tz: 'Asia/Kolkata', regionName: 'Delhi', country: 'IN' },
  'bangalore': { lat: 12.9716, lon: 77.5946, tz: 'Asia/Kolkata', regionName: 'Karnataka', country: 'IN' },
  'sao paulo': { lat: -23.5505, lon: -46.6333, tz: 'America/Sao_Paulo', regionName: 'São Paulo', country: 'BR' },
  'dubai': { lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai', regionName: 'Dubai', country: 'AE' }
}

// US States Fallback
const US_STATE_TZ: Record<string, { tz: string; lat: number; lon: number; name: string }> = {
  'al': { tz: 'America/Chicago', lat: 32.3182, lon: -86.9023, name: 'Alabama' },
  'ak': { tz: 'America/Anchorage', lat: 64.2008, lon: -149.4937, name: 'Alaska' },
  'az': { tz: 'America/Phoenix', lat: 34.0489, lon: -111.0937, name: 'Arizona' },
  'ar': { tz: 'America/Chicago', lat: 35.2010, lon: -91.8318, name: 'Arkansas' },
  'ca': { tz: 'America/Los_Angeles', lat: 36.7783, lon: -119.4179, name: 'California' },
  'co': { tz: 'America/Denver', lat: 39.5501, lon: -105.7821, name: 'Colorado' },
  'ct': { tz: 'America/New_York', lat: 41.6032, lon: -73.0877, name: 'Connecticut' },
  'de': { tz: 'America/New_York', lat: 38.9108, lon: -75.5277, name: 'Delaware' },
  'fl': { tz: 'America/New_York', lat: 27.6648, lon: -81.5158, name: 'Florida' },
  'ga': { tz: 'America/New_York', lat: 32.1656, lon: -82.9001, name: 'Georgia' },
  'hi': { tz: 'Pacific/Honolulu', lat: 19.8968, lon: -155.5828, name: 'Hawaii' },
  'id': { tz: 'America/Boise', lat: 44.0682, lon: -114.7420, name: 'Idaho' },
  'il': { tz: 'America/Chicago', lat: 40.6331, lon: -89.3985, name: 'Illinois' },
  'in': { tz: 'America/Indiana/Indianapolis', lat: 40.2672, lon: -86.1349, name: 'Indiana' },
  'ia': { tz: 'America/Chicago', lat: 41.8780, lon: -93.0977, name: 'Iowa' },
  'ks': { tz: 'America/Chicago', lat: 39.0119, lon: -98.4842, name: 'Kansas' },
  'ky': { tz: 'America/New_York', lat: 37.8393, lon: -84.2700, name: 'Kentucky' },
  'la': { tz: 'America/Chicago', lat: 30.9843, lon: -91.9623, name: 'Louisiana' },
  'me': { tz: 'America/New_York', lat: 45.2538, lon: -69.4455, name: 'Maine' },
  'md': { tz: 'America/New_York', lat: 39.0458, lon: -76.6413, name: 'Maryland' },
  'ma': { tz: 'America/New_York', lat: 42.4072, lon: -71.3824, name: 'Massachusetts' },
  'mi': { tz: 'America/Detroit', lat: 44.3148, lon: -85.6024, name: 'Michigan' },
  'mn': { tz: 'America/Chicago', lat: 46.7296, lon: -94.6859, name: 'Minnesota' },
  'ms': { tz: 'America/Chicago', lat: 32.3547, lon: -89.3985, name: 'Mississippi' },
  'mo': { tz: 'America/Chicago', lat: 37.9643, lon: -91.8318, name: 'Missouri' },
  'mt': { tz: 'America/Denver', lat: 46.8797, lon: -110.3626, name: 'Montana' },
  'ne': { tz: 'America/Chicago', lat: 41.4925, lon: -99.9018, name: 'Nebraska' },
  'nv': { tz: 'America/Los_Angeles', lat: 38.8026, lon: -116.4194, name: 'Nevada' },
  'nh': { tz: 'America/New_York', lat: 43.1939, lon: -71.5724, name: 'New Hampshire' },
  'nj': { tz: 'America/New_York', lat: 40.0583, lon: -74.4057, name: 'New Jersey' },
  'nm': { tz: 'America/Denver', lat: 34.5199, lon: -105.8701, name: 'New Mexico' },
  'ny': { tz: 'America/New_York', lat: 43.2994, lon: -74.2179, name: 'New York' },
  'nc': { tz: 'America/New_York', lat: 35.7596, lon: -79.0193, name: 'North Carolina' },
  'nd': { tz: 'America/Chicago', lat: 47.5515, lon: -101.0020, name: 'North Dakota' },
  'oh': { tz: 'America/New_York', lat: 40.4173, lon: -82.9071, name: 'Ohio' },
  'ok': { tz: 'America/Chicago', lat: 35.0078, lon: -97.0929, name: 'Oklahoma' },
  'or': { tz: 'America/Los_Angeles', lat: 43.8041, lon: -120.5542, name: 'Oregon' },
  'pa': { tz: 'America/New_York', lat: 41.2033, lon: -77.1945, name: 'Pennsylvania' },
  'ri': { tz: 'America/New_York', lat: 41.5801, lon: -71.4774, name: 'Rhode Island' },
  'sc': { tz: 'America/New_York', lat: 33.8361, lon: -81.1637, name: 'South Carolina' },
  'sd': { tz: 'America/Chicago', lat: 43.9695, lon: -99.9018, name: 'South Dakota' },
  'tn': { tz: 'America/Chicago', lat: 35.5175, lon: -86.5804, name: 'Tennessee' },
  'tx': { tz: 'America/Chicago', lat: 31.9686, lon: -99.9018, name: 'Texas' },
  'ut': { tz: 'America/Denver', lat: 39.3210, lon: -111.0937, name: 'Utah' },
  'vt': { tz: 'America/New_York', lat: 44.5588, lon: -72.5778, name: 'Vermont' },
  'va': { tz: 'America/New_York', lat: 37.4316, lon: -78.6569, name: 'Virginia' },
  'wa': { tz: 'America/Los_Angeles', lat: 47.7511, lon: -120.7401, name: 'Washington' },
  'wv': { tz: 'America/New_York', lat: 38.5976, lon: -80.4549, name: 'West Virginia' },
  'wi': { tz: 'America/Chicago', lat: 43.7844, lon: -88.7879, name: 'Wisconsin' },
  'wy': { tz: 'America/Denver', lat: 43.0759, lon: -107.2903, name: 'Wyoming' }
}

/**
 * Resolves location, coordinates, and timezone from City, State/Region, and Country.
 */
export function resolveLocationGeo(country?: string, region?: string, city?: string): {
  country: string
  countryName: string
  region: string
  regionName: string
  city: string
  timezone: string
  latitude: number
  longitude: number
} {
  const normCity = (city || '').trim().toLowerCase()
  const normRegion = (region || '').trim().toLowerCase()
  const normCountry = (country || 'US').trim().toUpperCase()

  let lat = 40.7128
  let lon = -74.0060
  let tz = 'America/New_York'
  let regionName = region || ''
  let countryName = normCountry === 'US' ? 'United States' : normCountry === 'GB' ? 'United Kingdom' : normCountry === 'CA' ? 'Canada' : normCountry === 'DE' ? 'Germany' : normCountry

  // 1. Direct city lookup
  if (normCity && KNOWN_GEO_DICT[normCity]) {
    const d = KNOWN_GEO_DICT[normCity]
    lat = d.lat
    lon = d.lon
    tz = String(d.tz)
    if (d.regionName) regionName = d.regionName
    if (d.country) countryName = d.country === 'US' ? 'United States' : d.country
    return {
      country: d.country || normCountry,
      countryName,
      region: region || normRegion.toUpperCase(),
      regionName,
      city: city || normCity,
      timezone: tz,
      latitude: lat,
      longitude: lon
    }
  }

  // 2. US State lookup
  if (normRegion && US_STATE_TZ[normRegion]) {
    const s = US_STATE_TZ[normRegion]
    lat = s.lat
    lon = s.lon
    tz = s.tz
    regionName = s.name
    return {
      country: 'US',
      countryName: 'United States',
      region: normRegion.toUpperCase(),
      regionName,
      city: city || s.name,
      timezone: tz,
      latitude: lat,
      longitude: lon
    }
  }

  // 3. Search city by partial match
  for (const [k, d] of Object.entries(KNOWN_GEO_DICT)) {
    if (normCity && normCity.includes(k)) {
      lat = d.lat
      lon = d.lon
      tz = String(d.tz)
      if (d.regionName) regionName = d.regionName
      return {
        country: d.country || normCountry,
        countryName,
        region: region || normRegion.toUpperCase(),
        regionName,
        city: city || normCity,
        timezone: tz,
        latitude: lat,
        longitude: lon
      }
    }
  }

  return {
    country: normCountry || 'US',
    countryName,
    region: region || '',
    regionName,
    city: city || '',
    timezone: tz,
    latitude: lat,
    longitude: lon
  }
}

/**
 * Invalidate cached geo-lookup data for a given IP or all.
 */
export function invalidateGeoCache(ipOrHost?: string): void {
  if (ipOrHost) {
    geoCache.delete(ipOrHost)
    logger.info('proxy', `[GeoCache] Invalidated cache for host: ${ipOrHost}`)
  } else {
    geoCache.clear()
    logger.info('proxy', '[GeoCache] Cleared all in-memory geo cache')
  }
}

/**
 * Fetch geo location info for a given IP or proxy host.
 * If explicit overrides (e.g. city/state/timezone/coords configured by admin) are supplied,
 * they are merged and given top priority over stale third-party IP lookups.
 */
export async function lookupGeoIP(
  ipOrHost: string,
  explicitGeo?: {
    country?: string
    region?: string
    city?: string
    isp?: string
    asn?: string
    timezone?: string
    latitude?: number
    longitude?: number
    publicIp?: string
  }
): Promise<GeoLocationResult | null> {
  if (!ipOrHost || ipOrHost === 'localhost' || ipOrHost === '127.0.0.1') {
    if (explicitGeo && (explicitGeo.city || explicitGeo.region || explicitGeo.country)) {
      const resolved = resolveLocationGeo(explicitGeo.country, explicitGeo.region, explicitGeo.city)
      return {
        ip: ipOrHost,
        country: explicitGeo.country || resolved.country,
        countryName: resolved.countryName,
        city: explicitGeo.city || resolved.city,
        region: explicitGeo.region || resolved.region,
        regionName: resolved.regionName,
        zip: '',
        timezone: explicitGeo.timezone || resolved.timezone,
        isp: explicitGeo.isp || 'Local Proxy',
        org: explicitGeo.isp || 'Local Proxy',
        asn: explicitGeo.asn || '',
        latitude: typeof explicitGeo.latitude === 'number' ? explicitGeo.latitude : resolved.latitude,
        longitude: typeof explicitGeo.longitude === 'number' ? explicitGeo.longitude : resolved.longitude,
        flag: getCountryFlag(explicitGeo.country || resolved.country)
      }
    }
    return null
  }

  // If explicit admin geo overrides are given, resolve and prioritize them!
  if (explicitGeo && (explicitGeo.city || explicitGeo.region || explicitGeo.country || explicitGeo.timezone || explicitGeo.latitude !== undefined)) {
    const resolved = resolveLocationGeo(explicitGeo.country, explicitGeo.region, explicitGeo.city)
    const result: GeoLocationResult = {
      ip: explicitGeo.publicIp || ipOrHost,
      country: (explicitGeo.country || resolved.country).toUpperCase(),
      countryName: resolved.countryName,
      city: explicitGeo.city || resolved.city,
      region: explicitGeo.region || resolved.region,
      regionName: resolved.regionName,
      zip: '',
      timezone: explicitGeo.timezone || resolved.timezone,
      isp: explicitGeo.isp || 'Configured Proxy',
      org: explicitGeo.isp || 'Configured Proxy',
      asn: explicitGeo.asn || '',
      latitude: typeof explicitGeo.latitude === 'number' && !isNaN(explicitGeo.latitude) ? explicitGeo.latitude : resolved.latitude,
      longitude: typeof explicitGeo.longitude === 'number' && !isNaN(explicitGeo.longitude) ? explicitGeo.longitude : resolved.longitude,
      flag: getCountryFlag(explicitGeo.country || resolved.country)
    }
    geoCache.set(ipOrHost, { data: result, timestamp: Date.now() })
    return result
  }

  // Check cache
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
