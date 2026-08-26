// ──────────────────────────────────────────────
// AntiProfiles — Local SOCKS5 Auth Tunnel Bridge
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
 * Start a local HTTP-to-SOCKS5 authentication tunnel bridge for a profile.
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

  return new Promise((resolve, reject) => {
    const server = net.createServer(clientSocket => {
      let isHeaderParsed = false
      let buffer = Buffer.alloc(0)

      const onClientData = (chunk: Buffer) => {
        if (isHeaderParsed) return
        buffer = Buffer.concat([buffer, chunk])

        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd === -1) return

        isHeaderParsed = true
        clientSocket.removeListener('data', onClientData)
        clientSocket.pause()

        const headerStr = buffer.slice(0, headerEnd).toString('latin1')
        const firstLine = headerStr.split('\r\n')[0] || ''
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

        // Connect to remote SOCKS5 proxy with timeout
        const proxySocket = net.connect({ host: proxy.host, port: proxy.port, timeout: 15000 }, () => {
          // Send SOCKS5 Greeting: 0x00 (No Auth), 0x02 (Username/Password)
          proxySocket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]))
        })

        proxySocket.on('timeout', () => {
          logger.warn('proxy', `SOCKS5 connection to ${proxy.host}:${proxy.port} timed out`)
          sendHttpError(clientSocket, 504, 'SOCKS5 Proxy Connection Timeout')
          proxySocket.destroy()
        })

        let socksStage = 0 // 0: greeting sent, 1: auth sent, 2: connect sent, 3: connected

        const onProxyData = (data: Buffer) => {
          if (socksStage === 0) {
            // SOCKS5 Greeting Response: [0x05, method]
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
            // SOCKS5 Auth Response: [0x01, status]
            if (data[1] === 0x00) {
              sendSocks5Connect(proxySocket, targetHost, targetPort)
              socksStage = 2
            } else {
              sendHttpError(clientSocket, 502, 'SOCKS5 Proxy Authentication Failed (401)')
              proxySocket.destroy()
            }
          } else if (socksStage === 2) {
            // SOCKS5 Connect Response: [0x05, status, 0x00, addressType, ...]
            if (data[1] === 0x00) {
              socksStage = 3
              proxySocket.removeListener('data', onProxyData)

              let headerLen = 10
              if (data[3] === 0x03) { // Domain name
                headerLen = 7 + data[4]
              } else if (data[3] === 0x04) { // IPv6
                headerLen = 22
              }

              const leftoverData = data.slice(headerLen)

              if (method === 'CONNECT') {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
              } else {
                // Rewrite absolute URL to relative path for origin HTTP requests
                let rawReq = buffer.toString('latin1')
                rawReq = rawReq.replace(/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+https?:\/\/[^\/]+/i, '$1 ')
                proxySocket.write(Buffer.from(rawReq, 'latin1'))
              }

              if (leftoverData.length > 0) {
                clientSocket.write(leftoverData)
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

        proxySocket.on('error', err => {
          logger.error('proxy', `SOCKS5 Proxy Socket error: ${err.message}`)
          sendHttpError(clientSocket, 502, `SOCKS5 Proxy Connection Error: ${err.message}`)
        })

        clientSocket.on('error', () => {
          proxySocket.destroy()
        })
      }

      clientSocket.on('data', onClientData)
    })

    server.on('error', (err: any) => {
      // Handle Windows-specific binding errors
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        logger.error('proxy', `SOCKS5 Bridge port binding failed (${err.code}): ${err.message}`)
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
          server.close()
          activeBridges.delete(profileId)
        }
      })

      logger.info('proxy', `SOCKS5 Tunnel Bridge started on ${localProxyUrl} (bound to ${bindHost}) for profile ${profileId}`)
      resolve(localProxyUrl)
    })
  })
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
      socket.destroy()
    })
  } else {
    socket.destroy()
  }
}

export function stopProxyBridge(profileId: string): void {
  const bridge = activeBridges.get(profileId)
  if (bridge) {
    bridge.close()
  }
}
