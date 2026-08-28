import { describe, it, expect } from 'vitest'
import { parseProxyString } from '../../src/renderer/components/ProfileModal'

describe('Proxy Quick Fill String Parser Unit Tests', () => {
  it('1. correctly parses Smartproxy key-value labeled format with Proxy Server, Port, username, password', () => {
    const raw = `Proxy Server:proxy.smartproxy.net
Port:3120
username:smart-xsd50tpuivwx
password:YkpXpYdKoQsSl6BK`

    const res = parseProxyString(raw)
    expect(res).not.toBeNull()
    expect(res?.type).toBe('http')
    expect(res?.host).toBe('proxy.smartproxy.net')
    expect(res?.port).toBe('3120')
    expect(res?.username).toBe('smart-xsd50tpuivwx')
    expect(res?.password).toBe('YkpXpYdKoQsSl6BK')
  })

  it('2. correctly parses single line space-separated Smartproxy string', () => {
    const raw = 'Proxy Server:proxy.smartproxy.net Port:3120 username:smart-xsd50tpuivwx password:YkpXpYdKoQsSl6BK'
    const res = parseProxyString(raw)
    expect(res).not.toBeNull()
    expect(res?.type).toBe('http')
    expect(res?.host).toBe('proxy.smartproxy.net')
    expect(res?.port).toBe('3120')
    expect(res?.username).toBe('smart-xsd50tpuivwx')
    expect(res?.password).toBe('YkpXpYdKoQsSl6BK')
  })

  it('3. correctly parses standard IP:PORT:USER:PASS format', () => {
    const raw = '31.59.20.176:6754:nwkfcetx:pass12345'
    const res = parseProxyString(raw)
    expect(res).not.toBeNull()
    expect(res?.type).toBe('http')
    expect(res?.host).toBe('31.59.20.176')
    expect(res?.port).toBe('6754')
    expect(res?.username).toBe('nwkfcetx')
    expect(res?.password).toBe('pass12345')
  })

  it('4. correctly parses socks5 URL format', () => {
    const raw = 'socks5://admin:secret123@gate.smartproxy.io:10001'
    const res = parseProxyString(raw)
    expect(res).not.toBeNull()
    expect(res?.type).toBe('socks5')
    expect(res?.host).toBe('gate.smartproxy.io')
    expect(res?.port).toBe('10001')
    expect(res?.username).toBe('admin')
    expect(res?.password).toBe('secret123')
  })

  it('5. correctly parses user:pass@host:port format', () => {
    const raw = 'myuser:mypass@104.28.19.4:3000'
    const res = parseProxyString(raw)
    expect(res).not.toBeNull()
    expect(res?.type).toBe('http')
    expect(res?.host).toBe('104.28.19.4')
    expect(res?.port).toBe('3000')
    expect(res?.username).toBe('myuser')
    expect(res?.password).toBe('mypass')
  })
})
