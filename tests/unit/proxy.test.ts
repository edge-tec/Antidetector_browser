// ──────────────────────────────────────────────
// ProfileVault — Unit Tests: Proxy Handling & Assignment
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { buildProxyArgs, getProxyDisplayUrl, buildProxyUrlWithAuth } from '../../src/main/network/proxy-manager'
import { testRawProxyConnection } from '../../src/main/network/proxy-tester'
import { Proxy } from '../../src/main/database/models'

describe('Proxy Manager - CLI Flags & Display URLs', () => {
  it('builds CLI args for direct connection', () => {
    const proxy: Proxy = {
      id: '1',
      name: 'Direct',
      type: 'direct',
      host: '',
      port: 0,
      username: null,
      encryptedPassword: null,
      testStatus: 'untested',
      createdAt: new Date().toISOString()
    }
    expect(buildProxyArgs(proxy)).toEqual(['--no-proxy-server'])
    expect(getProxyDisplayUrl(proxy)).toBe('Direct connection')
    expect(buildProxyUrlWithAuth(proxy)).toBeNull()
  })

  it('builds CLI args for HTTP proxy', () => {
    const proxy: Proxy = {
      id: '2',
      name: 'US HTTP Proxy',
      type: 'http',
      host: '1.2.3.4',
      port: 8080,
      username: null,
      encryptedPassword: null,
      testStatus: 'untested',
      createdAt: new Date().toISOString()
    }
    expect(buildProxyArgs(proxy)).toEqual(['--proxy-server=http://1.2.3.4:8080'])
    expect(getProxyDisplayUrl(proxy)).toBe('http://1.2.3.4:8080')
  })

  it('builds CLI args for SOCKS5 proxy', () => {
    const proxy: Proxy = {
      id: '3',
      name: 'EU SOCKS5 Proxy',
      type: 'socks5',
      host: '5.6.7.8',
      port: 1080,
      username: 'user123',
      encryptedPassword: null,
      testStatus: 'untested',
      createdAt: new Date().toISOString()
    }
    expect(buildProxyArgs(proxy)).toEqual(['--proxy-server=socks5://5.6.7.8:1080'])
    expect(getProxyDisplayUrl(proxy)).toBe('socks5://5.6.7.8:1080')
  })
})

describe('Proxy Tester - Custom Proxy Connection Check', () => {
  it('fails gracefully when testing invalid/unreachable custom proxy', async () => {
    const result = await testRawProxyConnection({
      type: 'http',
      host: '127.0.0.1',
      port: 59999, // Unused port
      username: 'myuser',
      password: 'mypassword'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.latency).toBeGreaterThanOrEqual(0)
  }, 10000)
})
