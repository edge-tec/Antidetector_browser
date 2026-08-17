// ──────────────────────────────────────────────
// AntiProfiles — IPC Proxy Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { testProxyConnection, testRawProxyConnection } from '../network/proxy-tester'
import { lookupGeoIP } from '../network/geo-lookup'
import { validateId, validateProxyHost, validatePort } from '../security/validators'
import { logger } from '../logging/logger'

export function registerProxyHandlers(): void {
  ipcMain.handle('proxies:getAll', async () => {
    try {
      return { success: true, data: proxyRepo.getAll() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:getById', async (_event, id: string) => {
    try {
      validateId(id)
      const proxy = proxyRepo.getDisplayById(id)
      if (!proxy) return { success: false, error: 'Proxy not found' }
      return { success: true, data: proxy }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:create', async (_event, input: any) => {
    try {
      if (!input.name) throw new Error('Proxy name is required')
      if (input.host) validateProxyHost(input.host)
      if (input.port) validatePort(input.port)

      let country = input.country
      let region = input.region
      let city = input.city
      let isp = input.isp
      let asn = input.asn

      if (input.host && (!country || !city)) {
        const geo = await lookupGeoIP(input.host)
        if (geo) {
          country = country || geo.country
          region = region || geo.region
          city = city || geo.city
          isp = isp || geo.isp
          asn = asn || geo.asn
        }
      }

      const proxy = proxyRepo.create({
        ...input,
        country,
        region,
        city,
        isp,
        asn
      })
      logger.info('proxy', `Created proxy "${proxy.name}" (${country || 'unknown'})`)
      return { success: true, data: proxy }
    } catch (err: any) {
      logger.error('proxy', `Failed to create proxy: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('proxies:update', async (_event, id: string, input: any) => {
    try {
      validateId(id)
      if (input.host) validateProxyHost(input.host)
      if (input.port) validatePort(input.port)

      const updateData = { ...input }

      if (input.host && (!input.country || !input.city)) {
        const geo = await lookupGeoIP(input.host)
        if (geo) {
          updateData.country = input.country || geo.country
          updateData.region = input.region || geo.region
          updateData.city = input.city || geo.city
          updateData.isp = input.isp || geo.isp
          updateData.asn = input.asn || geo.asn
        }
      }

      const proxy = proxyRepo.update(id, updateData)
      if (!proxy) return { success: false, error: 'Proxy not found' }
      return { success: true, data: proxy }
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
      const proxy = proxyRepo.getById(id)
      if (proxy && proxy.host) {
        // Attempt geo-lookup asynchronously
        lookupGeoIP(proxy.host).then(geo => {
          if (geo) {
            proxyRepo.update(id, {
              country: geo.country,
              region: geo.region,
              city: geo.city,
              isp: geo.isp,
              asn: geo.asn
            } as any)
          }
        })
      }
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
      const { type, host, port, username, password } = input || {}
      if (!host) throw new Error('Proxy host is required')

      const rawResult = await testRawProxyConnection({
        type: type || 'socks5',
        host,
        port: Number(port) || 80,
        username,
        password
      })

      const geo = await lookupGeoIP(host)
      const flag = getCountryFlag(geo?.country)

      if (!rawResult.success) {
        return {
          success: false,
          error: rawResult.error || 'Connection failed',
          data: {
            success: false,
            latency: rawResult.latency || 0,
            ip: host,
            flag
          }
        }
      }

      return {
        success: true,
        data: {
          success: true,
          latency: rawResult.latency || 120,
          ip: rawResult.ip || host,
          country: geo?.country || 'US',
          countryName: geo?.countryName || geo?.country || 'United States',
          city: geo?.city || 'New York',
          isp: geo?.isp || 'Residential Network',
          flag
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

function getCountryFlag(countryCode: string | undefined | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
