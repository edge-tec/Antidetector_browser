// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Real-Time HTTP Proxy Synchronization Service
// Keeps Proxy Geolocation, Timezone, Coordinates & Fingerprints
// Synchronized Across Every Browser Profile in Real Time
// ──────────────────────────────────────────────────────────────────

import { proxyRepo } from '../database/repositories/proxy.repo'
import { profileRepo } from '../database/repositories/profile.repo'
import { centralApi } from './api-client.service'
import { resolveLocationGeo, invalidateGeoCache, lookupGeoIP } from '../network/geo-lookup'
import { Proxy, Profile } from '../database/models'
import { logger } from '../logging/logger'

export class ProxySyncService {
  private syncInProgress = new Map<string, Promise<any>>()

  /**
   * Synchronize a specific proxy configuration from Central API or local database,
   * resolve location data (City, State/Region, Country, Timezone, Coordinates),
   * invalidate cached data, and automatically update all linked browser profiles.
   */
  public async syncProxy(
    proxyId: string,
    force: boolean = false
  ): Promise<{ success: boolean; proxy: Proxy | null; updatedProfilesCount: number; error?: string }> {
    if (!proxyId) {
      return { success: false, proxy: null, updatedProfilesCount: 0, error: 'Proxy ID is required' }
    }

    // Deduplicate concurrent sync calls for the same proxy ID
    if (this.syncInProgress.has(proxyId)) {
      return await this.syncInProgress.get(proxyId)
    }

    const promise = (async () => {
      try {
        let localProxy = proxyRepo.getById(proxyId)

        // 1. Fetch latest remote proxy state from Central Server if available
        try {
          const remoteRes = await centralApi.getProxyById(proxyId)
          if (remoteRes.success && remoteRes.data) {
            const remoteProxy = remoteRes.data
            const remoteVersion = Number(remoteProxy.proxy_version || remoteProxy.proxyVersion || 1)
            const localVersion = Number(localProxy?.proxyVersion || 1)
            const remoteUpdatedAt = remoteProxy.updated_at || remoteProxy.updatedAt || ''
            const localUpdatedAt = localProxy?.updatedAt || ''

            if (force || remoteVersion > localVersion || remoteUpdatedAt !== localUpdatedAt || !localProxy) {
              logger.info('proxy', `[ProxySync] Remote proxy ${proxyId} updated (v${remoteVersion} vs local v${localVersion}). Updating local cache.`)
              proxyRepo.upsertFromRemote(remoteProxy)
              localProxy = proxyRepo.getById(proxyId)
            }
          }
        } catch (err: any) {
          logger.warn('proxy', `[ProxySync] Central API sync skipped for ${proxyId}: ${err.message}`)
        }

        if (!localProxy) {
          return { success: false, proxy: null, updatedProfilesCount: 0, error: 'Proxy not found' }
        }

        // 2. Invalidate stale cached IP geo data immediately
        if (localProxy.host) {
          invalidateGeoCache(localProxy.host)
        }

        // 3. Resolve authoritative City, State/Region, Country, Timezone, and Coordinates
        const resolvedGeo = resolveLocationGeo(localProxy.country, localProxy.region, localProxy.city)
        
        let effectiveTimezone = localProxy.timezone?.trim() || resolvedGeo.timezone
        let effectiveLat = typeof localProxy.latitude === 'number' && !isNaN(localProxy.latitude) ? localProxy.latitude : resolvedGeo.latitude
        let effectiveLon = typeof localProxy.longitude === 'number' && !isNaN(localProxy.longitude) ? localProxy.longitude : resolvedGeo.longitude

        // If local proxy was missing timezone or coordinates, persist the resolved values
        if (!localProxy.timezone || localProxy.latitude === undefined || localProxy.longitude === undefined) {
          proxyRepo.updateGeoLocation(proxyId, {
            country: localProxy.country || resolvedGeo.country,
            region: localProxy.region || resolvedGeo.region,
            city: localProxy.city || resolvedGeo.city,
            isp: localProxy.isp,
            asn: localProxy.asn,
            timezone: effectiveTimezone,
            latitude: effectiveLat,
            longitude: effectiveLon,
            publicIp: localProxy.publicIp || localProxy.host
          })
          localProxy = proxyRepo.getById(proxyId)
        }

        // Pre-warm geo cache with authoritative data
        if (localProxy?.host) {
          await lookupGeoIP(localProxy.host, {
            country: localProxy.country,
            region: localProxy.region,
            city: localProxy.city,
            isp: localProxy.isp,
            asn: localProxy.asn,
            timezone: effectiveTimezone,
            latitude: effectiveLat,
            longitude: effectiveLon,
            publicIp: localProxy.publicIp || localProxy.host
          })
        }

        // 4. Propagate location updates to EVERY linked browser profile
        const linkedProfiles = profileRepo.getByProxyId(proxyId)
        let updatedCount = 0

        for (const prof of linkedProfiles) {
          try {
            const fp = prof.fingerprint ? { ...prof.fingerprint } : {}
            let changed = false

            // Update Timezone
            if (!fp.timezone || fp.timezone.timezone !== effectiveTimezone || prof.timezone !== effectiveTimezone) {
              fp.timezone = {
                mode: 'custom',
                timezone: effectiveTimezone
              }
              changed = true
            }

            // Update Geolocation Coordinates
            if (
              !fp.geolocation ||
              fp.geolocation.latitude !== effectiveLat ||
              fp.geolocation.longitude !== effectiveLon ||
              fp.geolocation.mode !== 'ip-based'
            ) {
              fp.geolocation = {
                mode: 'ip-based',
                latitude: effectiveLat,
                longitude: effectiveLon,
                accuracy: 50,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              }
              changed = true
            }

            // Update WebRTC Public IP
            if (!fp.webrtc) fp.webrtc = {}
            const targetIp = localProxy.publicIp || localProxy.host
            if (targetIp && fp.webrtc.publicIp !== targetIp) {
              fp.webrtc.publicIp = targetIp
              changed = true
            }

            if (changed || prof.timezone !== effectiveTimezone) {
              profileRepo.update(prof.id, {
                timezone: effectiveTimezone,
                fingerprint: fp
              })
              updatedCount++
              logger.info('proxy', `[ProxySync] ✓ Auto-updated profile "${prof.name}" (${prof.id}) to location: ${localProxy.city || 'N/A'}, ${localProxy.region || 'N/A'}, ${localProxy.country || 'N/A'} (Timezone: ${effectiveTimezone}, Lat: ${effectiveLat}, Lon: ${effectiveLon})`)
            }
          } catch (err: any) {
            logger.warn('proxy', `[ProxySync] Could not update linked profile ${prof.id}: ${err.message}`)
          }
        }

        return {
          success: true,
          proxy: localProxy,
          updatedProfilesCount: updatedCount
        }
      } catch (err: any) {
        logger.error('proxy', `[ProxySync] Failed to sync proxy ${proxyId}: ${err.message}`)
        return { success: false, proxy: null, updatedProfilesCount: 0, error: err.message }
      } finally {
        this.syncInProgress.delete(proxyId)
      }
    })()

    this.syncInProgress.set(proxyId, promise)
    return await promise
  }

  /**
   * Synchronize the proxy configured on a specific browser profile before launch or reload.
   */
  public async syncProfileProxy(profileId: string, force: boolean = false): Promise<Profile | null> {
    const profile = profileRepo.getById(profileId)
    if (!profile) return null

    if (profile.proxyId) {
      await this.syncProxy(profile.proxyId, force)
      return profileRepo.getById(profileId)
    }

    return profile
  }

  /**
   * Synchronize all user proxies and linked profiles from Central API.
   */
  public async syncAllProxies(): Promise<void> {
    try {
      const res = await centralApi.getProxies().catch(() => ({ success: false, data: [] }))
      if (res.success && Array.isArray(res.data)) {
        for (const remoteProxy of res.data) {
          if (remoteProxy.id) {
            proxyRepo.upsertFromRemote(remoteProxy)
            await this.syncProxy(remoteProxy.id, true)
          }
        }
        logger.info('proxy', `[ProxySync] ✓ Background synchronization completed for ${res.data.length} proxies.`)
      }
    } catch (err: any) {
      logger.warn('proxy', `[ProxySync] Sync all proxies skipped: ${err.message}`)
    }
  }
}

export const proxySyncService = new ProxySyncService()
