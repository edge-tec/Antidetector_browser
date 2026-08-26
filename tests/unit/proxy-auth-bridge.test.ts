// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Universal Proxy Auth Bridge
// ──────────────────────────────────────────────

import { describe, it, expect, afterEach } from 'vitest'
import net from 'net'
import { startProxyBridge, stopProxyBridge } from '../../src/main/network/proxy-bridge'
import { Proxy } from '../../src/main/database/models'

describe('Universal Proxy Auth Bridge (HTTP / HTTPS / SOCKS)', () => {
  const testProfileId = 'test-profile-proxy-123'

  afterEach(() => {
    stopProxyBridge(testProfileId)
  })

  it('starts a local bridge and injects HTTP Proxy-Authorization on CONNECT requests', async () => {
    // Mock upstream HTTP proxy server
    let receivedConnectHeader = ''
    const upstreamServer = net.createServer(client => {
      client.on('data', chunk => {
        receivedConnectHeader += chunk.toString('latin1')
        if (receivedConnectHeader.includes('\r\n\r\n')) {
          // Upstream proxy sends 200 Connection Established
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        }
      })
    })

    await new Promise<void>(resolve => upstreamServer.listen(0, '127.0.0.1', () => resolve()))
    const upstreamPort = (upstreamServer.address() as net.AddressInfo).port

    const mockProxy: Proxy = {
      id: 'px-1',
      name: 'SmartProxy HTTP',
      type: 'http',
      host: '127.0.0.1',
      port: upstreamPort,
      username: 'smartuser123',
      encryptedPassword: 'mypassword',
      testStatus: 'working',
      createdAt: new Date().toISOString()
    }

    // Start local auth bridge
    const bridgeUrl = await startProxyBridge(testProfileId, mockProxy)
    expect(bridgeUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    const bridgePort = Number(bridgeUrl.split(':').pop())

    // Browser client connects to local bridge
    const client = net.connect({ host: '127.0.0.1', port: bridgePort })
    let clientResponse = ''

    await new Promise<void>(resolve => {
      client.on('connect', () => {
        // Browser sends CONNECT without credentials to local bridge
        client.write('CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n')
      })

      client.on('data', chunk => {
        clientResponse += chunk.toString('latin1')
        if (clientResponse.includes('200 Connection Established')) {
          client.destroy()
          resolve()
        }
      })
    })

    // Verify upstream received the base64-encoded Proxy-Authorization header
    expect(receivedConnectHeader).toContain('CONNECT example.com:443 HTTP/1.1')
    const expectedAuth = Buffer.from('smartuser123:mypassword').toString('base64')
    expect(receivedConnectHeader).toContain(`Proxy-Authorization: Basic ${expectedAuth}`)

    // Verify client received 200 OK without seeing any 407 challenge
    expect(clientResponse).toContain('HTTP/1.1 200 Connection Established')

    upstreamServer.close()
  })

  it('injects Proxy-Authorization on plain HTTP GET requests', async () => {
    let receivedHttpGetHeader = ''
    const upstreamServer = net.createServer(client => {
      client.on('data', chunk => {
        receivedHttpGetHeader += chunk.toString('latin1')
        client.write('HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello, world!')
      })
    })

    await new Promise<void>(resolve => upstreamServer.listen(0, '127.0.0.1', () => resolve()))
    const upstreamPort = (upstreamServer.address() as net.AddressInfo).port

    const mockProxy: Proxy = {
      id: 'px-2',
      name: 'Plain HTTP Auth',
      type: 'http',
      host: '127.0.0.1',
      port: upstreamPort,
      username: 'plainuser',
      encryptedPassword: 'secretpassword',
      testStatus: 'working',
      createdAt: new Date().toISOString()
    }

    const bridgeUrl = await startProxyBridge(testProfileId, mockProxy)
    const bridgePort = Number(bridgeUrl.split(':').pop())

    const client = net.connect({ host: '127.0.0.1', port: bridgePort })
    let clientResponse = ''

    await new Promise<void>(resolve => {
      client.on('connect', () => {
        client.write('GET http://example.com/test HTTP/1.1\r\nHost: example.com\r\n\r\n')
      })

      client.on('data', chunk => {
        clientResponse += chunk.toString('latin1')
        if (clientResponse.includes('Hello, world!')) {
          client.destroy()
          resolve()
        }
      })
    })

    const expectedAuth = Buffer.from('plainuser:secretpassword').toString('base64')
    expect(receivedHttpGetHeader).toContain(`Proxy-Authorization: Basic ${expectedAuth}`)
    expect(clientResponse).toContain('HTTP/1.1 200 OK')
    expect(clientResponse).toContain('Hello, world!')

    upstreamServer.close()
  })

  it('handles bridge shutdown and isolation cleanly', async () => {
    const mockProxy: Proxy = {
      id: 'px-3',
      name: 'Isolated Proxy',
      type: 'http',
      host: '127.0.0.1',
      port: 8080,
      username: 'user',
      encryptedPassword: 'pass',
      testStatus: 'untested',
      createdAt: new Date().toISOString()
    }

    const bridgeUrl = await startProxyBridge(testProfileId, mockProxy)
    expect(bridgeUrl).toBeDefined()
    stopProxyBridge(testProfileId)

    const bridgePort = Number(bridgeUrl.split(':').pop())
    const client = net.connect({ host: '127.0.0.1', port: bridgePort })

    const connectionRefused = await new Promise<boolean>(resolve => {
      client.on('error', (err: any) => {
        resolve(err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')
      })
      client.on('connect', () => {
        client.destroy()
        resolve(false)
      })
    })

    expect(connectionRefused).toBe(true)
  })
})
