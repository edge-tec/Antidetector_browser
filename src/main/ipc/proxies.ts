// ──────────────────────────────────────────────
// AntiProfiles — Proxies IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { subscriptionRepo } from '../database/repositories/subscription.repo'
import { testProxyConnection, testRawProxyConnection } from '../network/proxy-tester'
import { lookupGeoIP, getCountryFlag } from '../network/geo-lookup'
import { validateId, validateNonEmpty, validatePort } from '../security/validators'
import { logger } from '../logging/logger'

export function registerProxyHandlers(): void {
  ipcMain.handle('proxies:getAll', async () => {
    try {
      const proxies = proxyRepo.getAll()
      return { success: true, data: proxies }
    } catch (err: any) {
      logger.error('proxy', `Failed to get proxies: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:getById', async (_event, id: string) => {
    try {
      validateId(id)
      const proxy = proxyRepo.getById(id)
      if (!proxy) {
        return { success: false, error: 'Proxy not found' }
      }
      return { success: true, data: proxy }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:create', async (_event, input: any) => {
    try {
      validateNonEmpty(input.name, 'Proxy name')
      if (input.type !== 'direct') {
        validateNonEmpty(input.host, 'Host')
        validatePort(input.port)
      }

      // Check Plan Proxy Restriction
      const reqType = (input.type || 'http').toLowerCase()
      if (reqType !== 'direct') {
        const license = subscriptionRepo.getActiveUserLicense()
        if (license && license.features?.allowed_proxy_types) {
          if (!license.features.allowed_proxy_types.includes(reqType)) {
            logger.warn('proxy', `User attempted to configure restricted proxy type "${reqType}" under plan "${license.plan.name}"`)
            return {
              success: false,
              error: `Proxy type "${reqType.toUpperCase()}" requires Starter plan ($19/mo) or higher. Your Free plan includes Basic HTTP proxy support only.`,
              lockedFeature: 'proxy_support',
              minPlan: 'Starter ($19/mo)',
              upgradeUrl: '#pricing'
            }
          }
        }
      }

      const proxy = proxyRepo.create({
        name: input.name.trim(),
        type: input.type || 'http',
        host: input.host?.trim() || '',
        port: input.port || 0,
        username: input.username?.trim() || undefined,
        password: input.password || undefined
      })

      // Attempt async geo-lookup on create
      if (proxy.host && proxy.type !== 'direct') {
        lookupGeoIP(proxy.host).then(geo => {
          if (geo) {
            proxyRepo.update(proxy.id, {
              country: geo.country,
              region: geo.region,
              city: geo.city,
              isp: geo.isp,
              asn: geo.asn
            } as any)
          }
        }).catch(() => {})
      }

      logger.info('proxy', `Created proxy "${proxy.name}" (${proxy.type}://${proxy.host}:${proxy.port})`)
      return { success: true, data: proxy }
    } catch (err: any) {
      logger.error('proxy', `Failed to create proxy: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:update', async (_event, id: string, input: any) => {
    try {
      validateId(id)
      const existing = proxyRepo.getById(id)
      if (!existing) {
        return { success: false, error: 'Proxy not found' }
      }

      if (input.name !== undefined) validateNonEmpty(input.name, 'Proxy name')
      if (input.port !== undefined && input.type !== 'direct') validatePort(input.port)

      // Check Plan Proxy Restriction on Update
      if (input.type && input.type !== 'direct') {
        const reqType = input.type.toLowerCase()
        const license = subscriptionRepo.getActiveUserLicense()
        if (license && license.features?.allowed_proxy_types) {
          if (!license.features.allowed_proxy_types.includes(reqType)) {
            logger.warn('proxy', `User attempted to update proxy to restricted type "${reqType}" under plan "${license.plan.name}"`)
            return {
              success: false,
              error: `Proxy type "${reqType.toUpperCase()}" requires Starter plan ($19/mo) or higher. Your Free plan includes Basic HTTP proxy support only.`,
              lockedFeature: 'proxy_support',
              minPlan: 'Starter ($19/mo)',
              upgradeUrl: '#pricing'
            }
          }
        }
      }

      const updated = proxyRepo.update(id, {
        name: input.name?.trim(),
        type: input.type,
        host: input.host?.trim(),
        port: input.port,
        username: input.username !== undefined ? (input.username?.trim() || null) : undefined,
        password: input.password !== undefined ? (input.password || undefined) : undefined,
        country: input.country,
        city: input.city
      })

      logger.info('proxy', `Updated proxy ${id}`)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:delete', async (_event, id: string) => {
    try {
      validateId(id)
      proxyRepo.delete(id)
      logger.info('proxy', `Deleted proxy ${id}`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:test', async (_event, id: string) => {
    try {
      validateId(id)
      const result = await testProxyConnection(id)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:geoLookup', async (_event, host: string) => {
    try {
      const geo = await lookupGeoIP(host)
      return { success: true, data: geo }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:testCustom', async (_event, input: any) => {
    try {
      const { type, host, port, username, password, name } = input || {}
      if (!host) throw new Error('Proxy host is required')

      const result = await testRawProxyConnection({
        type: type || 'socks5',
        host,
        port: Number(port) || 80,
        username,
        password,
        name
      })

      return {
        success: result.success,
        error: result.error,
        data: result
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Verify proxy before launching a profile — returns external IP for display
  ipcMain.handle('proxies:verifyBeforeLaunch', async (_event, proxyId: string) => {
    try {
      validateId(proxyId)
      const proxy = proxyRepo.getById(proxyId)
      if (!proxy) {
        return { success: false, error: 'Proxy not found' }
      }

      if (proxy.type === 'direct') {
        return { success: true, data: { ip: 'Direct Connection', proxyType: 'DIRECT' } }
      }

      const result = await testProxyConnection(proxyId)
      if (result.success) {
        return {
          success: true,
          data: {
            ip: result.ip,
            proxyName: result.proxyName,
            proxyType: result.proxyType,
            latency: result.latency,
            country: result.country,
            countryName: result.countryName,
            city: result.city,
            flag: result.flag
          }
        }
      } else {
        return { success: false, error: result.error || 'Proxy verification failed' }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
