// ──────────────────────────────────────────────
// AntiProfiles — Proxy Connection Tester & Geo Profiler
// ──────────────────────────────────────────────

import http from 'http'
import https from 'https'
import { URL } from 'url'
import { Proxy } from '../database/models'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { decryptPassword } from '../security/encryption'
import { lookupGeoIP, GeoLocationResult } from './geo-lookup'
import { logger } from '../logging/logger'

export interface ProxyTestResult {
  success: boolean
  latency: number
  ip?: string
  proxyName?: string
  proxyType?: string
  country?: string
  countryName?: string
  city?: string
  region?: string
  regionName?: string
  zip?: string
  latitude?: number
  longitude?: number
  isp?: string
  org?: string
  timezone?: string
  flag?: string
  error?: string
}

/**
 * Test a proxy connection by making a request through it and resolving complete geo details.
 */
export async function testProxyConnection(proxyId: string): Promise<ProxyTestResult> {
  const proxy = proxyRepo.getById(proxyId)
  if (!proxy) {
    return { success: false, latency: 0, error: 'Proxy not found' }
  }

  if (proxy.type === 'direct') {
    return testDirectConnection(proxy.name)
  }

  if (!proxy.host || proxy.port === 0) {
    proxyRepo.updateTestStatus(proxyId, 'failed')
    return { success: false, latency: 0, error: 'Proxy host and port are required' }
  }

  proxyRepo.updateTestStatus(proxyId, 'testing')
  const startTime = Date.now()

  try {
    const rawResult = await makeProxyRequest(proxy)
    const latency = Date.now() - startTime

    // Fetch complete geo-information for the proxy IP
    const resolvedIp = (rawResult.ip && rawResult.ip !== 'connected' && !rawResult.ip.includes('SOCKS5'))
      ? rawResult.ip
      : proxy.host
    const geo = await lookupGeoIP(resolvedIp)

    proxyRepo.updateTestStatus(proxyId, 'success')
    if (geo) {
      proxyRepo.update(proxyId, {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        isp: geo.isp,
        asn: geo.asn
      } as any)
    }

    logger.info('proxy', `Proxy test succeeded for "${proxy.name}" (${latency}ms) — IP: ${resolvedIp}`)

    return {
      success: true,
      latency,
      ip: resolvedIp,
      proxyName: proxy.name,
      proxyType: (proxy.type || 'http').toUpperCase(),
      country: geo?.country || 'N/A',
      countryName: geo?.countryName || 'N/A',
      city: geo?.city || 'N/A',
      region: geo?.region || 'N/A',
      regionName: geo?.regionName || 'N/A',
      zip: geo?.zip || 'N/A',
      latitude: geo?.latitude !== undefined ? geo.latitude : undefined,
      longitude: geo?.longitude !== undefined ? geo.longitude : undefined,
      isp: geo?.isp || geo?.org || 'N/A',
      org: geo?.org || 'N/A',
      timezone: geo?.timezone || 'N/A',
      flag: geo?.flag || '🌐'
    }
  } catch (err: any) {
    const latency = Date.now() - startTime

    proxyRepo.updateTestStatus(proxyId, 'failed')
    logger.warn('proxy', `Proxy test failed for "${proxy.name}": ${err.message}`)

    return {
      success: false,
      latency,
      proxyName: proxy.name,
      proxyType: (proxy.type || 'http').toUpperCase(),
      error: err.message
    }
  }
}

async function testDirectConnection(proxyName = 'Direct Connection'): Promise<ProxyTestResult> {
  const startTime = Date.now()
  try {
    const response = await fetch('https://httpbin.org/ip', { signal: AbortSignal.timeout(10000) })
    const data = await response.json() as { origin: string }
    const ip = data.origin || '127.0.0.1'
    const geo = await lookupGeoIP(ip)
    return {
      success: true,
      latency: Date.now() - startTime,
      ip,
      proxyName,
      proxyType: 'DIRECT',
      country: geo?.country || 'N/A',
      countryName: geo?.countryName || 'N/A',
      city: geo?.city || 'N/A',
      region: geo?.region || 'N/A',
      regionName: geo?.regionName || 'N/A',
      zip: geo?.zip || 'N/A',
      latitude: geo?.latitude,
      longitude: geo?.longitude,
      isp: geo?.isp || 'N/A',
      org: geo?.org || 'N/A',
      timezone: geo?.timezone || 'N/A',
      flag: geo?.flag || '🌐'
    }
  } catch (err: any) {
    return { success: false, latency: Date.now() - startTime, error: err.message }
  }
}

function getPasswordFromProxy(proxy: Proxy, rawPassword?: string): string {
  if (rawPassword) return rawPassword
  if (!proxy.encryptedPassword) return ''
  try {
    return decryptPassword(proxy.encryptedPassword)
  } catch {
    if (typeof proxy.encryptedPassword === 'string') {
      return proxy.encryptedPassword
    }
    if (Buffer.isBuffer(proxy.encryptedPassword)) {
      return proxy.encryptedPassword.toString('utf8')
    }
    return ''
  }
}

function makeProxyRequest(proxy: Proxy, rawPassword?: string): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const timeout = 15000
    const password = getPasswordFromProxy(proxy, rawPassword)

    let proxyAuth = ''
    if (proxy.username) {
      proxyAuth = `${proxy.username}:${password}`
    }

    if (proxy.type === 'http' || proxy.type === 'https') {
      // HTTP CONNECT method through proxy
      const options: http.RequestOptions = {
        host: proxy.host,
        port: proxy.port,
        method: 'CONNECT',
        path: 'httpbin.org:443',
        timeout,
        headers: {}
      }

      if (proxyAuth) {
        options.headers!['Proxy-Authorization'] = `Basic ${Buffer.from(proxyAuth).toString('base64')}`
      }

      const req = http.request(options)

      req.on('connect', (res, socket) => {
        if (res.statusCode === 200) {
          const tls = require('tls')
          const tlsSocket = tls.connect({
            socket,
            host: 'httpbin.org',
            servername: 'httpbin.org'
          }, () => {
            const httpReq = `GET /ip HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n`
            tlsSocket.write(httpReq)
          })

          let data = ''
          tlsSocket.on('data', (chunk: Buffer) => { data += chunk.toString() })
          tlsSocket.on('end', () => {
            try {
              const body = data.split('\r\n\r\n').pop() || ''
              const json = JSON.parse(body)
              resolve({ ip: json.origin || proxy.host })
            } catch {
              resolve({ ip: proxy.host })
            }
            socket.destroy()
          })
          tlsSocket.on('error', (err: Error) => {
            socket.destroy()
            reject(new Error(`TLS error: ${err.message}`))
          })
        } else {
          socket.destroy()
          reject(new Error(`Proxy returned status ${res.statusCode}`))
        }
      })

      req.on('error', (err) => reject(new Error(`Proxy connection failed: ${err.message}`)))
      req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')) })
      req.end()
    } else {
      // SOCKS5 connection with full IP resolution over tunnel
      const net = require('net')
      const socket = net.connect({ host: proxy.host, port: proxy.port, timeout })

      let socksStage = 0

      socket.on('connect', () => {
        // Send SOCKS5 Greeting: 0x05, 2 auth methods (0x00 No Auth, 0x02 Username/Password)
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]))
      })

      socket.on('data', (data: Buffer) => {
        if (socksStage === 0) {
          if (data[0] !== 0x05) {
            socket.destroy()
            return reject(new Error('Invalid SOCKS5 server response'))
          }
          const method = data[1]
          if (method === 0x02 && proxy.username) {
            const uBuf = Buffer.from(proxy.username, 'utf8')
            const pBuf = Buffer.from(password, 'utf8')
            const authReq = Buffer.concat([
              Buffer.from([0x01, uBuf.length]),
              uBuf,
              Buffer.from([pBuf.length]),
              pBuf
            ])
            socksStage = 1
            socket.write(authReq)
          } else if (method === 0x00) {
            sendSocks5ConnectReq(socket, 'httpbin.org', 80)
            socksStage = 2
          } else {
            socket.destroy()
            reject(new Error('SOCKS5 proxy rejected authentication method'))
          }
        } else if (socksStage === 1) {
          if (data[1] === 0x00) {
            sendSocks5ConnectReq(socket, 'httpbin.org', 80)
            socksStage = 2
          } else {
            socket.destroy()
            reject(new Error('SOCKS5 proxy authentication failed (Invalid credentials)'))
          }
        } else if (socksStage === 2) {
          if (data[1] === 0x00) {
            // Send HTTP GET request over SOCKS5 tunnel to read actual public IP
            socksStage = 3
            let httpResp = ''
            socket.on('data', (chunk: Buffer) => {
              httpResp += chunk.toString('utf8')
              if (httpResp.includes('\r\n\r\n')) {
                try {
                  const body = httpResp.split('\r\n\r\n').pop() || ''
                  const json = JSON.parse(body)
                  resolve({ ip: json.origin || proxy.host })
                } catch {
                  resolve({ ip: proxy.host })
                }
                socket.destroy()
              }
            })
            socket.write('GET /ip HTTP/1.1\r\nHost: httpbin.org\r\nUser-Agent: curl/7.68.0\r\nConnection: close\r\n\r\n')
          } else {
            socket.destroy()
            reject(new Error(`SOCKS5 CONNECT failed with status code 0x${data[1].toString(16)}`))
          }
        }
      })

      socket.on('error', (err: Error) => {
        reject(new Error(`SOCKS5 connection failed: ${err.message}`))
      })

      socket.on('timeout', () => {
        socket.destroy()
        reject(new Error('Connection timed out'))
      })
    }
  })
}

function sendSocks5ConnectReq(socket: any, host: string, port: number) {
  const hostBuf = Buffer.from(host, 'utf8')
  const portBuf = Buffer.alloc(2)
  portBuf.writeUInt16BE(port, 0)
  const req = Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
    hostBuf,
    portBuf
  ])
  socket.write(req)
}

/**
 * Test custom raw proxy credentials without saving to repo first.
 */
export async function testRawProxyConnection(input: {
  type: string
  host: string
  port: number
  username?: string
  password?: string
  name?: string
}): Promise<ProxyTestResult> {
  const proxy: Proxy = {
    id: 'temp',
    name: input.name || 'Custom Proxy',
    type: (input.type as any) || 'socks5',
    host: input.host,
    port: input.port,
    username: input.username || null,
    encryptedPassword: null,
    testStatus: 'untested',
    createdAt: new Date().toISOString()
  }

  const startTime = Date.now()
  try {
    const result = await makeProxyRequest(proxy, input.password || '')
    const latency = Date.now() - startTime
    const resolvedIp = (result.ip && result.ip !== 'connected' && !result.ip.includes('SOCKS5'))
      ? result.ip
      : input.host
    const geo = await lookupGeoIP(resolvedIp)

    return {
      success: true,
      latency,
      ip: resolvedIp,
      proxyName: input.name || 'Custom Proxy',
      proxyType: (input.type || 'socks5').toUpperCase(),
      country: geo?.country || 'N/A',
      countryName: geo?.countryName || 'N/A',
      city: geo?.city || 'N/A',
      region: geo?.region || 'N/A',
      regionName: geo?.regionName || 'N/A',
      zip: geo?.zip || 'N/A',
      latitude: geo?.latitude !== undefined ? geo.latitude : undefined,
      longitude: geo?.longitude !== undefined ? geo.longitude : undefined,
      isp: geo?.isp || geo?.org || 'N/A',
      org: geo?.org || 'N/A',
      timezone: geo?.timezone || 'N/A',
      flag: geo?.flag || '🌐'
    }
  } catch (err: any) {
    const latency = Date.now() - startTime
    return {
      success: false,
      latency,
      proxyName: input.name || 'Custom Proxy',
      proxyType: (input.type || 'socks5').toUpperCase(),
      error: err.message
    }
  }
}
