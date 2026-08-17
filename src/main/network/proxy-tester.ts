// ──────────────────────────────────────────────
// AntiProfiles — Proxy Connection Tester
// ──────────────────────────────────────────────

import http from 'http'
import https from 'https'
import { URL } from 'url'
import { Proxy } from '../database/models'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { decryptPassword } from '../security/encryption'
import { logger } from '../logging/logger'

export interface ProxyTestResult {
  success: boolean
  latency: number
  ip?: string
  error?: string
}

/**
 * Test a proxy connection by making a request through it.
 */
export async function testProxyConnection(proxyId: string): Promise<ProxyTestResult> {
  const proxy = proxyRepo.getById(proxyId)
  if (!proxy) {
    return { success: false, latency: 0, error: 'Proxy not found' }
  }

  if (proxy.type === 'direct') {
    // For "direct" connections, just test internet connectivity
    return testDirectConnection()
  }

  if (!proxy.host || proxy.port === 0) {
    proxyRepo.updateTestStatus(proxyId, 'failed')
    return { success: false, latency: 0, error: 'Proxy host and port are required' }
  }

  proxyRepo.updateTestStatus(proxyId, 'testing')
  const startTime = Date.now()

  try {
    const result = await makeProxyRequest(proxy)
    const latency = Date.now() - startTime

    proxyRepo.updateTestStatus(proxyId, 'success')
    logger.info('proxy', `Proxy test succeeded for "${proxy.name}" (${latency}ms)`)

    return { success: true, latency, ip: result.ip }
  } catch (err: any) {
    const latency = Date.now() - startTime

    proxyRepo.updateTestStatus(proxyId, 'failed')
    logger.warn('proxy', `Proxy test failed for "${proxy.name}": ${err.message}`)

    return { success: false, latency, error: err.message }
  }
}

async function testDirectConnection(): Promise<ProxyTestResult> {
  const startTime = Date.now()
  try {
    const response = await fetch('https://httpbin.org/ip', { signal: AbortSignal.timeout(10000) })
    const data = await response.json() as { origin: string }
    return { success: true, latency: Date.now() - startTime, ip: data.origin }
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
          // Connection established through proxy
          const tlsOptions = {
            socket,
            host: 'httpbin.org',
            servername: 'httpbin.org'
          }

          const tls = require('tls')
          const tlsSocket = tls.connect(tlsOptions, () => {
            const httpReq = `GET /ip HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n`
            tlsSocket.write(httpReq)
          })

          let data = ''
          tlsSocket.on('data', (chunk: Buffer) => { data += chunk.toString() })
          tlsSocket.on('end', () => {
            try {
              const body = data.split('\r\n\r\n').pop() || ''
              const json = JSON.parse(body)
              resolve({ ip: json.origin || 'unknown' })
            } catch {
              resolve({ ip: 'connected' })
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
      // SOCKS5 (or SOCKS4 fallback) connection
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
            // SOCKS5 greeting ok, send CONNECT request to target
            sendSocks5ConnectReq(socket, 'httpbin.org', 80)
            socksStage = 2
          } else {
            socket.destroy()
            reject(new Error('SOCKS5 proxy rejected authentication method'))
          }
        } else if (socksStage === 1) {
          if (data[1] === 0x00) {
            // Auth success, send CONNECT request
            sendSocks5ConnectReq(socket, 'httpbin.org', 80)
            socksStage = 2
          } else {
            socket.destroy()
            reject(new Error('SOCKS5 proxy authentication failed (Invalid credentials)'))
          }
        } else if (socksStage === 2) {
          socket.destroy()
          if (data[1] === 0x00) {
            resolve({ ip: 'connected (SOCKS5)' })
          } else {
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
}): Promise<ProxyTestResult> {
  const proxy: Proxy = {
    id: 'temp',
    name: 'Temp Test Proxy',
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
    return { success: true, latency, ip: result.ip }
  } catch (err: any) {
    const latency = Date.now() - startTime
    return { success: false, latency, error: err.message }
  }
}

