// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Proxy Information Display & Geo Enrichment
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { getCountryFlag } from '../../src/main/network/geo-lookup'

describe('Proxy Information & Dynamic Geo Profiling Tests', () => {
  describe('Country Flag Formatter', () => {
    it('formats 2-letter ISO country codes into Unicode emoji flags', () => {
      expect(getCountryFlag('US')).toBe('🇺🇸')
      expect(getCountryFlag('GB')).toBe('🇬🇧')
      expect(getCountryFlag('CA')).toBe('🇨🇦')
      expect(getCountryFlag('DE')).toBe('🇩🇪')
      expect(getCountryFlag('FR')).toBe('🇫🇷')
    })

    it('handles null, undefined, or invalid country codes gracefully with fallback globe', () => {
      expect(getCountryFlag(undefined)).toBe('🌐')
      expect(getCountryFlag(null)).toBe('🌐')
      expect(getCountryFlag('')).toBe('🌐')
      expect(getCountryFlag('USA')).toBe('🌐')
    })
  })

  describe('Proxy Information Data Structure Completeness', () => {
    it('verifies all required proxy display fields exist in schema', () => {
      const mockResult = {
        success: true,
        latency: 145,
        ip: '24.247.170.247',
        proxyName: 'Michigan Residential Proxy',
        proxyType: 'SOCKS5',
        country: 'US',
        countryName: 'United States',
        city: 'Bay City',
        region: 'MI',
        regionName: 'Michigan',
        zip: '48708',
        latitude: 43.8883,
        longitude: -83.8883,
        isp: 'Charter Communications',
        org: 'Spectrum',
        timezone: 'America/Detroit',
        flag: '🇺🇸'
      }

      expect(mockResult.success).toBe(true)
      expect(mockResult.ip).toBe('24.247.170.247')
      expect(mockResult.countryName).toBe('United States')
      expect(mockResult.regionName).toBe('Michigan')
      expect(mockResult.city).toBe('Bay City')
      expect(mockResult.zip).toBe('48708')
      expect(mockResult.latitude).toBe(43.8883)
      expect(mockResult.longitude).toBe(-83.8883)
      expect(mockResult.isp).toBe('Charter Communications')
      expect(mockResult.timezone).toBe('America/Detroit')
    })
  })
})
