import { describe, it, expect, beforeEach } from 'vitest'
import { resolveLocationGeo, invalidateGeoCache, lookupGeoIP } from '../../src/main/network/geo-lookup'
import { proxyRepo } from '../../src/main/database/repositories/proxy.repo'
import { profileRepo } from '../../src/main/database/repositories/profile.repo'
import { proxySyncService } from '../../src/main/services/proxy-sync.service'
import { closeDatabase, initDatabase } from '../../src/main/database/connection'

describe('HTTP Proxy IP Auto Reload & Location Sync (AntiProfiles)', () => {
  beforeEach(() => {
    closeDatabase()
    initDatabase(':memory:')
  })

  it('resolves authoritative coordinates and timezone for known cities and states', () => {
    const la = resolveLocationGeo('US', 'CA', 'Los Angeles')
    expect(la.timezone).toBe('America/Los_Angeles')
    expect(la.latitude).toBeCloseTo(34.0522, 2)
    expect(la.longitude).toBeCloseTo(-118.2437, 2)

    const chicago = resolveLocationGeo('US', 'IL', 'Chicago')
    expect(chicago.timezone).toBe('America/Chicago')
    expect(chicago.latitude).toBeCloseTo(41.8781, 2)
    expect(chicago.longitude).toBeCloseTo(-87.6298, 2)

    const ny = resolveLocationGeo('US', 'NY', 'New York')
    expect(ny.timezone).toBe('America/New_York')
    expect(ny.latitude).toBeCloseTo(40.7128, 2)

    const london = resolveLocationGeo('GB', 'England', 'London')
    expect(london.timezone).toBe('Europe/London')
    expect(london.latitude).toBeCloseTo(51.5074, 2)

    const tokyo = resolveLocationGeo('JP', 'Tokyo', 'Tokyo')
    expect(tokyo.timezone).toBe('Asia/Tokyo')
    expect(tokyo.latitude).toBeCloseTo(35.6762, 2)
  })

  it('prioritizes explicit admin proxy location overrides in lookupGeoIP', async () => {
    const host = '198.51.100.25'
    invalidateGeoCache(host)

    const geo = await lookupGeoIP(host, {
      country: 'US',
      region: 'CA',
      city: 'Los Angeles',
      timezone: 'America/Los_Angeles',
      latitude: 34.0522,
      longitude: -118.2437,
      isp: 'Dedicated Proxy LLC'
    })

    expect(geo.city).toBe('Los Angeles')
    expect(geo.region).toBe('CA')
    expect(geo.timezone).toBe('America/Los_Angeles')
    expect(geo.latitude).toBeCloseTo(34.0522, 2)
    expect(geo.longitude).toBeCloseTo(-118.2437, 2)
    expect(geo.isp).toBe('Dedicated Proxy LLC')
  })

  it('increments proxy_version and updates updated_at when admin updates location', () => {
    const proxy = proxyRepo.create({
      name: 'Residential Proxy 1',
      type: 'http',
      host: '104.28.19.45',
      port: 8080,
      country: 'US',
      region: 'NY',
      city: 'New York'
    })

    expect(proxy.proxyVersion).toBe(1)
    expect(proxy.city).toBe('New York')

    const updated = proxyRepo.update(proxy.id, {
      city: 'Los Angeles',
      region: 'CA',
      timezone: 'America/Los_Angeles',
      latitude: 34.0522,
      longitude: -118.2437
    })

    expect(updated).not.toBeNull()
    expect(updated?.proxyVersion).toBe(2)
    expect(updated?.city).toBe('Los Angeles')
    expect(updated?.region).toBe('CA')
    expect(updated?.timezone).toBe('America/Los_Angeles')
  })

  it('automatically synchronizes linked profile timezone, geolocation, and WebRTC IP when proxy location changes', async () => {
    // 1. Create a proxy in New York
    const proxy = proxyRepo.create({
      name: 'Shared HTTP Proxy',
      type: 'http',
      host: '142.250.190.46',
      port: 8080,
      country: 'US',
      region: 'NY',
      city: 'New York',
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.0060
    })

    // 2. Create browser profile linked to this proxy
    const profile = profileRepo.create({
      name: 'Ad Account 1',
      osType: 'windows-10',
      proxyId: proxy.id,
      timezone: 'America/New_York'
    })

    expect(profile.timezone).toBe('America/New_York')

    // 3. Admin changes proxy location from New York to Chicago, IL
    proxyRepo.update(proxy.id, {
      city: 'Chicago',
      region: 'IL',
      timezone: 'America/Chicago',
      latitude: 41.8781,
      longitude: -87.6298
    })

    // 4. Trigger Real-Time Sync on the proxy
    const syncRes = await proxySyncService.syncProxy(proxy.id, true)
    expect(syncRes.success).toBe(true)
    expect(syncRes.updatedProfilesCount).toBeGreaterThanOrEqual(1)

    // 5. Verify the linked browser profile was automatically updated
    const refreshedProfile = profileRepo.getById(profile.id)
    expect(refreshedProfile).not.toBeNull()
    expect(refreshedProfile?.timezone).toBe('America/Chicago')
    expect(refreshedProfile?.fingerprint?.timezone?.timezone).toBe('America/Chicago')
    expect(refreshedProfile?.fingerprint?.geolocation?.latitude).toBeCloseTo(41.8781, 2)
    expect(refreshedProfile?.fingerprint?.geolocation?.longitude).toBeCloseTo(-87.6298, 2)
    expect(refreshedProfile?.fingerprint?.webrtc?.publicIp).toBe('142.250.190.46')
  })

  it('syncProfileProxy ensures the profile gets the freshest proxy location on reload/launch', async () => {
    // 1. Create proxy in Florida (Miami)
    const proxy = proxyRepo.create({
      name: 'Miami Gateway',
      type: 'http',
      host: '64.233.160.1',
      port: 8080,
      country: 'US',
      region: 'FL',
      city: 'Miami',
      timezone: 'America/New_York',
      latitude: 25.7617,
      longitude: -80.1918
    })

    // 2. Create profile
    const profile = profileRepo.create({
      name: 'Miami Browser Session',
      osType: 'macos-arm',
      proxyId: proxy.id
    })

    // 3. Admin relocates proxy to London, UK
    proxyRepo.update(proxy.id, {
      country: 'GB',
      region: 'England',
      city: 'London',
      timezone: 'Europe/London',
      latitude: 51.5074,
      longitude: -0.1278
    })

    // 4. On browser reload or start, syncProfileProxy runs
    const refreshedProfile = await proxySyncService.syncProfileProxy(profile.id, true)
    expect(refreshedProfile).not.toBeNull()
    expect(refreshedProfile?.timezone).toBe('Europe/London')
    expect(refreshedProfile?.fingerprint?.timezone?.timezone).toBe('Europe/London')
    expect(refreshedProfile?.fingerprint?.geolocation?.latitude).toBeCloseTo(51.5074, 2)
    expect(refreshedProfile?.fingerprint?.geolocation?.longitude).toBeCloseTo(-0.1278, 2)
  })
})
