// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Real-Time HTTP Proxy Synchronization Service
// Keeps Proxy Geolocation, Timezone, Coordinates & Fingerprints
// Synchronized Across Every Browser Profile in Real Time
// ──────────────────────────────────────────────────────────────────

import { BrowserWindow } from 'electron'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { profileRepo } from '../database/repositories/profile.repo'
import { centralApi } from './api-client.service'
import { resolveLocationGeo, invalidateGeoCache, lookupGeoIP, getCountryLocale } from '../network/geo-lookup'
import { testProxyConnection } from '../network/proxy-tester'
import { processTracker } from '../browser/process-tracker'
import { Proxy, Profile } from '../database/models'
import { logger } from '../logging/logger'

export class ProxySyncService {
  private syncInProgress = new Map<string, Promise<any>>()

  /**
   * Live-sync updated GeoLocation, Timezone, and cache clearing to an active running browser profile via CDP.
   * Modifies running browser state instantly without requiring a restart or manual reload.
   */
  public async liveSyncRunningBrowser(
    profileId: string,
    geo: {
      latitude: number
      longitude: number
      timezone: string
      city?: string
      region?: string
      country?: string
      publicIp?: string
    }
  ): Promise<boolean> {
    try {
      const browser = processTracker.getBrowser(profileId)
      if (!browser || !browser.connected) return false

      logger.info('proxy', `[ProxySync] ⚡ Live CDP syncing running browser for profile ${profileId} to City: ${geo.city || 'N/A'}, TZ: ${geo.timezone}, Coords: [${geo.latitude}, ${geo.longitude}]`)

      const pages = await browser.pages().catch(() => [])
      for (const page of pages) {
        try {
          if (page.isClosed()) continue

          // 1. Create or obtain CDP Session
          const client = await page.target().createCDPSession()

          // 2. Override Geolocation at DevTools Protocol level
          await client.send('Emulation.setGeolocationOverride', {
            latitude: geo.latitude,
            longitude: geo.longitude,
            accuracy: 50
          }).catch(() => {})

          // 3. Override Timezone at native V8 / ICU level
          if (geo.timezone) {
            await client.send('Emulation.setTimezoneOverride', {
              timezoneId: geo.timezone
            }).catch(() => {})
          }

          // 4. Clear HTTP & DNS browser caches to remove old location-bound cached resources
          await client.send('Network.clearBrowserCache').catch(() => {})

          // 5. Live update in-page JavaScript APIs (Intl, Date, navigator.geolocation)
          await page.evaluate((lat, lon, tz) => {
            try {
              if (typeof (window as any).__antiprofiles_set_geo === 'function') {
                (window as any).__antiprofiles_set_geo(lat, lon, 50)
              }
              if (typeof (window as any).__antiprofiles_set_tz === 'function' && tz) {
                (window as any).__antiprofiles_set_tz(tz)
              }
            } catch {}
          }, geo.latitude, geo.longitude, geo.timezone).catch(() => {})
        } catch (pageErr: any) {
          logger.warn('proxy', `[ProxySync] Page live sync warning for profile ${profileId}: ${pageErr.message}`)
        }
      }

      return true
    } catch (err: any) {
      logger.warn('proxy', `[ProxySync] Live sync failed for profile ${profileId}: ${err.message}`)
      return false
    }
  }

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
        if (localProxy.publicIp) {
          invalidateGeoCache(localProxy.publicIp)
        }

        // 3. Actively probe real-time exit IP and fresh Geolocation through the proxy tunnel
        if (localProxy.type !== 'direct' && localProxy.host && localProxy.port > 0) {
          try {
            logger.info('proxy', `[ProxySync] 🌐 Probing live proxy connection for "${localProxy.name}" (${localProxy.host}:${localProxy.port})...`)
            const probePromise = testProxyConnection(proxyId)
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
            const probe = await Promise.race([probePromise, timeoutPromise])
            if (probe && (probe as any).success) {
              localProxy = proxyRepo.getById(proxyId) || localProxy
              logger.info('proxy', `[ProxySync] ✓ Live probe detected IP: ${localProxy.publicIp || (probe as any).ip}, City: ${localProxy.city || (probe as any).city}, TZ: ${localProxy.timezone || (probe as any).timezone}`)
            }
          } catch (probeErr: any) {
            logger.warn('proxy', `[ProxySync] Live proxy test probe warning for ${proxyId}: ${probeErr.message}`)
          }
        }

        // 4. Resolve authoritative City, State/Region, Country, Timezone, and Coordinates
        const resolvedGeo = resolveLocationGeo(localProxy.country, localProxy.region, localProxy.city)
        
        let effectiveTimezone = localProxy.timezone?.trim() || resolvedGeo.timezone
        let effectiveLat = typeof localProxy.latitude === 'number' && !isNaN(localProxy.latitude) ? localProxy.latitude : resolvedGeo.latitude
        let effectiveLon = typeof localProxy.longitude === 'number' && !isNaN(localProxy.longitude) ? localProxy.longitude : resolvedGeo.longitude

        // Ensure database reflects the fresh effective coordinates and timezone
        proxyRepo.updateGeoLocation(proxyId, {
          country: localProxy.country || resolvedGeo.country,
          region: localProxy.region || resolvedGeo.region,
          city: localProxy.city || resolvedGeo.city,
          isp: localProxy.isp || resolvedGeo.countryName,
          asn: localProxy.asn,
          timezone: effectiveTimezone,
          latitude: effectiveLat,
          longitude: effectiveLon,
          publicIp: localProxy.publicIp || localProxy.host
        })
        localProxy = proxyRepo.getById(proxyId) || localProxy

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

            // Synchronize Locale & Language if country is resolved
            if (localProxy.country) {
              const countryLocale = getCountryLocale(localProxy.country)
              if (!fp.locale || fp.locale.language !== countryLocale.language) {
                fp.locale = {
                  language: countryLocale.language,
                  languages: countryLocale.languages
                }
                changed = true
              }
            }

            if (changed || prof.timezone !== effectiveTimezone) {
              profileRepo.update(prof.id, {
                timezone: effectiveTimezone,
                language: fp.locale?.language || prof.language,
                fingerprint: fp
              })
              updatedCount++
              logger.info('proxy', `[ProxySync] ✓ Auto-updated profile "${prof.name}" (${prof.id}) to location: ${localProxy.city || 'N/A'}, ${localProxy.region || 'N/A'}, ${localProxy.country || 'N/A'} (Timezone: ${effectiveTimezone}, Lat: ${effectiveLat}, Lon: ${effectiveLon})`)
            }

            // 5. Live-Sync to running browser instance if currently open!
            if (processTracker.isRunning(prof.id)) {
              await this.liveSyncRunningBrowser(prof.id, {
                latitude: effectiveLat,
                longitude: effectiveLon,
                timezone: effectiveTimezone,
                city: localProxy.city,
                region: localProxy.region,
                country: localProxy.country,
                publicIp: targetIp
              })
            }
          } catch (err: any) {
            logger.warn('proxy', `[ProxySync] Could not update linked profile ${prof.id}: ${err.message}`)
          }
        }

        // 6. Broadcast real-time location update event to all UI windows
        try {
          const windows = BrowserWindow.getAllWindows()
          windows.forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.send('proxies:location-updated', {
                proxyId,
                proxy: localProxy,
                timezone: effectiveTimezone,
                latitude: effectiveLat,
                longitude: effectiveLon,
                city: localProxy.city,
                region: localProxy.region,
                country: localProxy.country
              })
              win.webContents.send('profiles:status-changed', {
                proxyId,
                updatedCount
              })
            }
          })
        } catch {}

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
