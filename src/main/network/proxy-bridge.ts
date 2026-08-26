// ──────────────────────────────────────────────
// AntiProfiles — Local Universal Proxy Auth Bridge
// Transparent HTTP, HTTPS, SOCKS4, and SOCKS5 Authentication Tunnel
// Handles all proxy authentication at the network layer without browser login popups
// ──────────────────────────────────────────────

import net from 'net'
import { Proxy } from '../database/models'
import { decryptPassword } from '../security/encryption'
import { logger } from '../logging/logger'

interface BridgeServer {
  server: net.Server
  port: number
  close: () => void
}

const activeBridges = new Map<string, BridgeServer>()

/**
 * Start a local proxy authentication tunnel bridge for a profile.
 * Supports HTTP, HTTPS, SOCKS4, and SOCKS5 upstream proxies with automatic credential injection.
 */
export async function startProxyBridge(profileId: string, proxy: Proxy): Promise<string> {
  // Stop existing bridge if running
  stopProxyBridge(profileId)

  let password = ''
  if ((proxy as any).password) {
    password = (proxy as any).password
  } else if (proxy.encryptedPassword) {
    try {
      password = decryptPassword(proxy.encryptedPassword)
    } catch {
      if (typeof proxy.encryptedPassword === 'string') {
        password = proxy.encryptedPassword
      } else if (Buffer.isBuffer(proxy.encryptedPassword)) {
        password = (proxy.encryptedPassword as Buffer).toString('utf8')
      }
    }
  }

  const isSocks = proxy.type.startsWith('socks')
  const authHeaderValue = proxy.username
    ? `Basic ${Buffer.from(`${proxy.username}:${password}`).toString('base64')}`
    : null

  return new Promise((resolve, reject) => {
    const server = net.createServer(clientSocket => {
      let isHeaderParsed = false
      let buffer = Buffer.alloc(0)

      const onClientData = (chunk: Buffer) => {
        if (isHeaderParsed) return
        buffer = Buffer.concat([buffer, chunk])

        const headerEnd = buffer.indexOf('\r\n\r\n')
        const headerEndAlt = headerEnd === -1 ? buffer.indexOf('\n\n') : headerEnd
        if (headerEndAlt === -1) return

        isHeaderParsed = true
        clientSocket.removeListener('data', onClientData)
        clientSocket.pause()

        const actualEndIndex = headerEnd !== -1 ? headerEnd + 4 : headerEndAlt + 2
        const headerStr = buffer.slice(0, headerEnd !== -1 ? headerEnd : headerEndAlt).toString('latin1')
        const leftoverClientData = buffer.slice(actualEndIndex)

        const firstLine = headerStr.split(/\r?\n/)[0] || ''
        const parts = firstLine.split(' ')
        const method = parts[0] ? parts[0].toUpperCase() : ''
        const target = parts[1] || ''

        let targetHost = ''
        let targetPort = 80

        if (method === 'CONNECT') {
          const [h, p] = target.split(':')
          targetHost = h
          targetPort = Number(p) || 443
        } else if (target.startsWith('http://') || target.startsWith('https://')) {
          try {
            const url = new URL(target)
            targetHost = url.hostname
            targetPort = Number(url.port) || (url.protocol === 'https:' ? 443 : 80)
          } catch {
            clientSocket.destroy()
            return
          }
        } else {
          // Check Host header fallback
          const hostHeaderMatch = headerStr.match(/Host:\s*([^\r\n:]+)(?::(\d+))?/i)
          if (hostHeaderMatch && hostHeaderMatch[1]) {
            targetHost = hostHeaderMatch[1].trim()
            targetPort = hostHeaderMatch[2] ? Number(hostHeaderMatch[2]) : 80
          } else {
            clientSocket.destroy()
            return
          }
        }

        if (!targetHost) {
          clientSocket.destroy()
          return
        }

        // Connect to remote upstream proxy
        const proxySocket = net.connect({ host: proxy.host, port: proxy.port, timeout: 20000 })

        proxySocket.on('timeout', () => {
          logger.warn('proxy', `Upstream proxy connection to ${proxy.host}:${proxy.port} timed out`)
          sendHttpError(clientSocket, 504, 'Gateway Timeout — Upstream Proxy Not Responding')
          proxySocket.destroy()
        })

        clientSocket.on('error', () => {
          proxySocket.destroy()
        })

        proxySocket.on('error', err => {
          logger.error('proxy', `Upstream proxy connection error (${proxy.host}:${proxy.port}): ${err.message}`)
          sendHttpError(clientSocket, 502, `Bad Gateway — Proxy Connection Error: ${err.message}`)
        })

        if (isSocks) {
          // ── Upstream is SOCKS5 / SOCKS4 ──
          handleSocksUpstream(
            proxySocket,
            clientSocket,
            proxy,
            password,
            targetHost,
            targetPort,
            method,
            buffer,
            leftoverClientData
          )
        } else {
          // ── Upstream is HTTP / HTTPS ──
          handleHttpUpstream(
            proxySocket,
            clientSocket,
            proxy,
            authHeaderValue,
            targetHost,
            targetPort,
            method,
            headerStr,
            leftoverClientData
          )
        }
      }

      clientSocket.on('data', onClientData)
    })

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        logger.error('proxy', `Proxy Bridge port binding failed (${err.code}): ${err.message}`)
      }
      reject(err)
    })

    // Use 127.0.0.1 on macOS/Linux; on Windows use 0.0.0.0 for IPv4 loopback compatibility
    const bindHost = process.platform === 'win32' ? '0.0.0.0' : '127.0.0.1'
    server.listen(0, bindHost, () => {
      const address = server.address() as net.AddressInfo
      const localPort = address.port
      const localProxyUrl = `http://127.0.0.1:${localPort}`

      activeBridges.set(profileId, {
        server,
        port: localPort,
        close: () => {
          try { server.close() } catch {}
          activeBridges.delete(profileId)
        }
      })

      logger.info('proxy', `Proxy Auth Bridge [${proxy.type.toUpperCase()}] running on ${localProxyUrl} for profile "${profileId}" -> upstream ${proxy.host}:${proxy.port}`)
      resolve(localProxyUrl)
    })
  })
}

/**
 * Handle HTTP/HTTPS upstream proxy with automatic Proxy-Authorization injection.
 */
function handleHttpUpstream(
  proxySocket: net.Socket,
  clientSocket: net.Socket,
  proxy: Proxy,
  authHeaderValue: string | null,
  targetHost: string,
  targetPort: number,
  method: string,
  rawHeaderStr: string,
  leftoverClientData: Buffer
) {
  if (method === 'CONNECT') {
    // ── HTTPS / WebSocket CONNECT Tunnel ──
    let connectReq = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`
    if (authHeaderValue) {
      connectReq += `Proxy-Authorization: ${authHeaderValue}\r\n`
    }
    connectReq += `Proxy-Connection: Keep-Alive\r\nUser-Agent: AntiProfiles/1.0\r\n\r\n`

    let upstreamResponse = Buffer.alloc(0)
    let handshakeDone = false

    const onProxyConnectData = (chunk: Buffer) => {
      if (handshakeDone) return
      upstreamResponse = Buffer.concat([upstreamResponse, chunk])

      const endIdx = upstreamResponse.indexOf('\r\n\r\n')
      const endIdxAlt = endIdx === -1 ? upstreamResponse.indexOf('\n\n') : endIdx
      if (endIdxAlt === -1) return

      handshakeDone = true
      proxySocket.removeListener('data', onProxyConnectData)

      const headerLen = endIdx !== -1 ? endIdx + 4 : endIdxAlt + 2
      const resHeader = upstreamResponse.slice(0, endIdx !== -1 ? endIdx : endIdxAlt).toString('latin1')
      const leftoverUpstreamData = upstreamResponse.slice(headerLen)

      const statusLine = resHeader.split(/\r?\n/)[0] || ''
      const statusCodeMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/i)
      const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : 0

      if (statusCode >= 200 && statusCode < 300) {
        // Success: Tell browser the tunnel is established
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

        if (leftoverUpstreamData.length > 0) {
          clientSocket.write(leftoverUpstreamData)
        }
        if (leftoverClientData.length > 0) {
          proxySocket.write(leftoverClientData)
        }

        clientSocket.resume()
        clientSocket.pipe(proxySocket)
        proxySocket.pipe(clientSocket)
      } else {
        logger.warn('proxy', `Upstream HTTP proxy ${proxy.host}:${proxy.port} rejected CONNECT to ${targetHost}:${targetPort}: ${statusLine}`)
        if (statusCode === 407) {
          sendHttpError(clientSocket, 502, `Proxy Authentication Failed at Upstream Proxy (${proxy.host}:${proxy.port}). Please check proxy username and password.`)
        } else {
          sendHttpError(clientSocket, statusCode || 502, `Upstream Proxy Error: ${statusLine}`)
        }
        proxySocket.destroy()
      }
    }

    proxySocket.on('data', onProxyConnectData)
    proxySocket.write(Buffer.from(connectReq, 'latin1'))
  } else {
    // ── Plain HTTP Request ──
    // Inject Proxy-Authorization header if not present
    let modifiedHeader = rawHeaderStr
    if (authHeaderValue && !/Proxy-Authorization:/i.test(modifiedHeader)) {
      modifiedHeader = modifiedHeader.replace(/(\r?\n)/, `$1Proxy-Authorization: ${authHeaderValue}\r\n`)
    }

    const forwardBuffer = Buffer.concat([
      Buffer.from(modifiedHeader + '\r\n\r\n', 'latin1'),
      leftoverClientData
    ])

    proxySocket.write(forwardBuffer)
    clientSocket.resume()
    clientSocket.pipe(proxySocket)
    proxySocket.pipe(clientSocket)
  }
}

/**
 * Handle SOCKS5 / SOCKS4 upstream proxy with handshake & auth.
 */
function handleSocksUpstream(
  proxySocket: net.Socket,
  clientSocket: net.Socket,
  proxy: Proxy,
  password: string,
  targetHost: string,
  targetPort: number,
  method: string,
  rawBuffer: Buffer,
  leftoverClientData: Buffer
) {
  let socksStage = 0 // 0: greeting sent, 1: auth sent, 2: connect sent, 3: connected

  const onProxyData = (data: Buffer) => {
    if (socksStage === 0) {
      if (data[0] !== 0x05) {
        sendHttpError(clientSocket, 502, 'SOCKS5 Proxy Invalid Handshake')
        proxySocket.destroy()
        return
      }
      const authMethod = data[1]
      if (authMethod === 0x02 && proxy.username) {
        // Username / Password Auth RFC 1929
        const uBuf = Buffer.from(proxy.username, 'utf8')
        const pBuf = Buffer.from(password, 'utf8')
        const authReq = Buffer.concat([
          Buffer.from([0x01, uBuf.length]),
          uBuf,
          Buffer.from([pBuf.length]),
          pBuf
        ])
        socksStage = 1
        proxySocket.write(authReq)
      } else if (authMethod === 0x00) {
        // No Auth Required, send Connect Request
        sendSocks5Connect(proxySocket, targetHost, targetPort)
        socksStage = 2
      } else {
        sendHttpError(clientSocket, 502, 'SOCKS5 Proxy Auth Failed')
        proxySocket.destroy()
      }
    } else if (socksStage === 1) {
      if (data[1] === 0x00) {
        sendSocks5Connect(proxySocket, targetHost, targetPort)
        socksStage = 2
      } else {
        sendHttpError(clientSocket, 502, 'SOCKS5 Proxy Authentication Failed (401)')
        proxySocket.destroy()
      }
    } else if (socksStage === 2) {
      if (data[1] === 0x00) {
        socksStage = 3
        proxySocket.removeListener('data', onProxyData)

        let headerLen = 10
        if (data[3] === 0x03) { // Domain name
          headerLen = 7 + data[4]
        } else if (data[3] === 0x04) { // IPv6
          headerLen = 22
        }

        const leftoverUpstreamData = data.slice(headerLen)

        if (method === 'CONNECT') {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        } else {
          let rawReq = rawBuffer.toString('latin1')
          rawReq = rawReq.replace(/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+https?:\/\/[^\/]+/i, '$1 ')
          proxySocket.write(Buffer.from(rawReq, 'latin1'))
        }

        if (leftoverUpstreamData.length > 0) {
          clientSocket.write(leftoverUpstreamData)
        }
        if (leftoverClientData.length > 0) {
          proxySocket.write(leftoverClientData)
        }

        clientSocket.resume()
        clientSocket.pipe(proxySocket)
        proxySocket.pipe(clientSocket)
      } else {
        sendHttpError(clientSocket, 502, `SOCKS5 Target ${targetHost}:${targetPort} Unreachable (Status: ${data[1]})`)
        proxySocket.destroy()
      }
    }
  }

  proxySocket.on('data', onProxyData)

  // Send SOCKS5 Greeting: 0x00 (No Auth), 0x02 (Username/Password)
  proxySocket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]))
}

function sendSocks5Connect(socket: net.Socket, host: string, port: number) {
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

function sendHttpError(socket: net.Socket, statusCode: number, message: string) {
  if (socket.writable) {
    const body = `HTTP/1.1 ${statusCode} ${message}\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n${message}\r\n`
    socket.write(body, () => {
      try { socket.destroy() } catch {}
    })
  } else {
    try { socket.destroy() } catch {}
  }
}

export function stopProxyBridge(profileId: string): void {
  const bridge = activeBridges.get(profileId)
  if (bridge) {
    bridge.close()
  }
}
