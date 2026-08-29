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
        asn: geo.asn,
        timezone: geo.timezone,
        latitude: geo.latitude,
        longitude: geo.longitude,
        publicIp: resolvedIp
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

function extractIpFromBody(body: string): string | null {
  if (!body) return null
  try {
    const json = JSON.parse(body)
    const ip = json.ip || json.query || json.origin || json.ip_address || json.client_ip
    if (typeof ip === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim())) {
      return ip.trim()
    }
  } catch {}

  const ipv4Match = body.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/)
  if (ipv4Match) return ipv4Match[0]

  const ipv6Match = body.match(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/)
  if (ipv6Match) return ipv6Match[0]

  return null
}

async function makeProxyRequest(proxy: Proxy, rawPassword?: string): Promise<{ ip: string }> {
  const timeout = 12000
  const password = getPasswordFromProxy(proxy, rawPassword)
  const proxyType = (proxy.type || 'http').toLowerCase()

  let proxyAuth = ''
  if (proxy.username) {
    proxyAuth = `${proxy.username}:${password}`
  }

  if (proxyType === 'http' || proxyType === 'https') {
    // 1. Try standard HTTP Forward Proxy request across high-availability IP reflection endpoints
    const testEndpoints = [
      'http://api.ipify.org?format=json',
      'http://ip-api.com/json',
      'http://icanhazip.com',
      'http://ifconfig.me/ip',
      'http://checkip.amazonaws.com'
    ]

    for (const targetUrl of testEndpoints) {
      try {
        const res = await testHttpForwardProxy(proxy.host, proxy.port, proxyAuth, targetUrl, timeout)
        if (res?.ip) return res
      } catch (err: any) {
        // If the error is 407 (Proxy Auth Required) or 403 (Forbidden), fail fast with clear message
        if (err.message && (err.message.includes('407') || err.message.includes('Authentication'))) {
          throw new Error('Proxy Authentication Required (407) — Invalid Username/Password')
        }
      }
    }

    // 2. Fallback: HTTP CONNECT tunnel method to api.ipify.org:80 (plain HTTP over tunnel)
    try {
      const res = await testHttpConnectTunnel(proxy.host, proxy.port, proxyAuth, 'api.ipify.org', 80, timeout)
      if (res?.ip) return res
    } catch {}

    // 3. Fallback: HTTP CONNECT tunnel method to ip-api.com:80
    try {
      const res = await testHttpConnectTunnel(proxy.host, proxy.port, proxyAuth, 'ip-api.com', 80, timeout)
      if (res?.ip) return res
    } catch {}

    throw new Error('Could not verify proxy IP — Proxy server unreachable or rejected connection')
  } else if (proxyType === 'socks4') {
    return testSocks4(proxy.host, proxy.port, timeout)
  } else {
    // SOCKS5 (Default)
    try {
      return await testSocks5(proxy.host, proxy.port, proxy.username || '', password, 'api.ipify.org', 80, timeout)
    } catch (err: any) {
      if (err.message && err.message.includes('authentication failed')) {
        throw err
      }
      return await testSocks5(proxy.host, proxy.port, proxy.username || '', password, 'ip-api.com', 80, timeout)
    }
  }
}

function testHttpForwardProxy(
  proxyHost: string,
  proxyPort: number,
  proxyAuth: string,
  targetUrl: string,
  timeout: number
): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl)
    const options: http.RequestOptions = {
      host: proxyHost,
      port: proxyPort,
      method: 'GET',
      path: targetUrl,
      headers: {
        'Host': u.hostname,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        ...(proxyAuth ? { 'Proxy-Authorization': `Basic ${Buffer.from(proxyAuth).toString('base64')}` } : {})
      },
      timeout
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk.toString('utf8') })
      res.on('end', () => {
        if (res.statusCode === 407) {
          return reject(new Error('Proxy Authentication Required (407) — Invalid Username/Password'))
        }
        const ip = extractIpFromBody(data)
        if (ip) {
          resolve({ ip })
        } else if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Proxy returned HTTP ${res.statusCode}`))
        } else {
          reject(new Error('Unable to parse IP from response'))
        }
      })
    })

    req.on('error', (err) => reject(new Error(`Proxy connection error: ${err.message}`)))
    req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')) })
    req.end()
  })
}

function testHttpConnectTunnel(
  proxyHost: string,
  proxyPort: number,
  proxyAuth: string,
  targetHost: string,
  targetPort: number,
  timeout: number
): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      host: proxyHost,
      port: proxyPort,
      method: 'CONNECT',
      path: `${targetHost}:${targetPort}`,
      timeout,
      headers: {}
    }

    if (proxyAuth) {
      options.headers!['Proxy-Authorization'] = `Basic ${Buffer.from(proxyAuth).toString('base64')}`
    }

    const req = http.request(options)

    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) {
        let httpResp = ''
        socket.on('data', (chunk: Buffer) => {
          httpResp += chunk.toString('utf8')
          const ip = extractIpFromBody(httpResp)
          if (ip) {
            socket.destroy()
            resolve({ ip })
          }
        })
        socket.on('end', () => {
          const ip = extractIpFromBody(httpResp)
          if (ip) resolve({ ip })
          else reject(new Error('Could not parse IP from tunnel'))
          socket.destroy()
        })
        socket.on('error', (err: Error) => {
          socket.destroy()
          reject(err)
        })

        socket.write(`GET /?format=json HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: AntiProfiles/2.0\r\nConnection: close\r\n\r\n`)
      } else {
        socket.destroy()
        reject(new Error(`Proxy CONNECT failed with HTTP ${res.statusCode}`))
      }
    })

    req.on('error', (err) => reject(new Error(`Proxy CONNECT error: ${err.message}`)))
    req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')) })
    req.end()
  })
}

function testSocks5(
  proxyHost: string,
  proxyPort: number,
  username: string,
  password: string,
  targetHost: string,
  targetPort: number,
  timeout: number
): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const net = require('net')
    const socket = net.connect({ host: proxyHost, port: proxyPort, timeout })

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
        if (method === 0x02 && username) {
          const uBuf = Buffer.from(username, 'utf8')
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
          sendSocks5ConnectReq(socket, targetHost, targetPort)
          socksStage = 2
        } else {
          socket.destroy()
          reject(new Error('SOCKS5 proxy rejected authentication method'))
        }
      } else if (socksStage === 1) {
        if (data[1] === 0x00) {
          sendSocks5ConnectReq(socket, targetHost, targetPort)
          socksStage = 2
        } else {
          socket.destroy()
          reject(new Error('SOCKS5 proxy authentication failed (Invalid credentials)'))
        }
      } else if (socksStage === 2) {
        if (data[1] === 0x00) {
          socksStage = 3
          let httpResp = ''
          socket.on('data', (chunk: Buffer) => {
            httpResp += chunk.toString('utf8')
            const ip = extractIpFromBody(httpResp)
            if (ip) {
              socket.destroy()
              resolve({ ip })
            }
          })
          socket.write(`GET /?format=json HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: AntiProfiles/2.0\r\nConnection: close\r\n\r\n`)
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
  })
}

function testSocks4(
  proxyHost: string,
  proxyPort: number,
  timeout: number
): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const net = require('net')
    const socket = net.connect({ host: proxyHost, port: proxyPort, timeout })

    socket.on('connect', () => {
      // SOCKS4a request to api.ipify.org:80 (IP 0.0.0.1 signals domain name in SOCKS4a)
      const hostBuf = Buffer.from('api.ipify.org', 'utf8')
      const req = Buffer.concat([
        Buffer.from([0x04, 0x01, 0x00, 0x50, 0x00, 0x00, 0x00, 0x01, 0x00]),
        hostBuf,
        Buffer.from([0x00])
      ])
      socket.write(req)
    })

    let stage = 0
    socket.on('data', (data: Buffer) => {
      if (stage === 0) {
        if (data[1] === 0x5a) { // 0x5a = Granted
          stage = 1
          let httpResp = ''
          socket.on('data', (chunk: Buffer) => {
            httpResp += chunk.toString('utf8')
            const ip = extractIpFromBody(httpResp)
            if (ip) {
              socket.destroy()
              resolve({ ip })
            }
          })
          socket.write('GET /?format=json HTTP/1.1\r\nHost: api.ipify.org\r\nConnection: close\r\n\r\n')
        } else {
          socket.destroy()
          reject(new Error(`SOCKS4 CONNECT rejected with status 0x${data[1].toString(16)}`))
        }
      }
    })

    socket.on('error', (err: Error) => reject(new Error(`SOCKS4 connection error: ${err.message}`)))
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timed out')) })
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
