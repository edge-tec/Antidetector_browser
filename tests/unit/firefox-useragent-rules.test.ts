import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { getDeviceById, generateAndroidUserAgent } from '../../src/renderer/data/android-devices'
import { getIosDeviceById, generateIosUserAgent } from '../../src/renderer/data/ios-devices'

describe('Firefox User-Agent and User Rules Application', () => {
  it('generates Windows-compatible Firefox User-Agent when Firefox + Windows is selected', () => {
    const fp = generateFingerprint({
      osType: 'windows-10',
      browserType: 'firefox',
      browserVersion: '129.0'
    })
    expect(fp.navigator.userAgent).toContain('Windows NT 10.0')
    expect(fp.navigator.userAgent).toContain('Firefox/129.0')
    expect(fp.navigator.userAgent).not.toContain('Chrome')
    expect(fp.navigator.vendor).toBe('')
    expect(fp.browser.type).toBe('firefox')
  })

  it('generates Intel Mac Firefox User-Agent when Firefox + macOS Intel is selected', () => {
    const fp = generateFingerprint({
      osType: 'macos-intel',
      browserType: 'firefox',
      browserVersion: '128.0'
    })
    expect(fp.navigator.userAgent).toContain('Macintosh; Intel Mac OS X')
    expect(fp.navigator.userAgent).toContain('Firefox/128.0')
    expect(fp.navigator.userAgent).not.toContain('Chrome')
    expect(fp.browser.type).toBe('firefox')
  })

  it('generates Linux Firefox User-Agent when Firefox + Linux is selected', () => {
    const fp = generateFingerprint({
      osType: 'linux',
      browserType: 'firefox',
      browserVersion: '127.0'
    })
    expect(fp.navigator.userAgent).toContain('X11; Linux x86_64')
    expect(fp.navigator.userAgent).toContain('Firefox/127.0')
    expect(fp.navigator.userAgent).not.toContain('Chrome')
  })

  it('generates Android Firefox User-Agent when Firefox + Android is selected', () => {
    const fp = generateFingerprint({
      osType: 'android',
      browserType: 'firefox',
      browserVersion: '129.0'
    })
    expect(fp.navigator.userAgent).toContain('Android')
    expect(fp.navigator.userAgent).toContain('Firefox/129.0')
    expect(fp.navigator.userAgent).not.toContain('Chrome')
    expect(fp.navigator.userAgent).toContain('Mobile')
  })

  it('generates iOS FxiOS User-Agent when Firefox + iOS/iPhone is selected without desktop Gecko leakage', () => {
    const fp = generateFingerprint({
      osType: 'ios',
      browserType: 'firefox',
      browserVersion: '129.0'
    })
    expect(fp.navigator.userAgent).toContain('iPhone; CPU iPhone OS')
    expect(fp.navigator.userAgent).toContain('FxiOS/129.0')
    expect(fp.navigator.userAgent).toContain('AppleWebKit')
    expect(fp.navigator.userAgent).not.toContain('CriOS')
    expect(fp.navigator.platform).toBe('iPhone')
    expect(fp.navigator.vendor).toBe('Apple Computer, Inc.')
  })

  it('correctly maps specific iPhone 16 Pro Max device model with iOS Firefox', () => {
    const dev = getIosDeviceById('iphone-16-pro-max')
    expect(dev).toBeDefined()
    if (dev) {
      const ua = generateIosUserAgent(dev, 'firefox', '129.0')
      expect(ua).toContain('FxiOS/129.0')
      expect(ua).toContain('AppleWebKit/605.1.15')
      expect(ua).not.toContain('Chrome')
    }
  })

  it('switches cleanly between Chrome and Firefox without stale cross-engine tokens', () => {
    const chromeFp = generateFingerprint({
      osType: 'windows-11',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120'
    })
    expect(chromeFp.navigator.userAgent).toContain('Chrome/128.0.6613.120')
    expect(chromeFp.navigator.userAgent).not.toContain('Firefox')

    const ffFp = generateFingerprint({
      osType: 'windows-11',
      browserType: 'firefox',
      browserVersion: '129.0'
    })
    expect(ffFp.navigator.userAgent).toContain('Firefox/129.0')
    expect(ffFp.navigator.userAgent).not.toContain('Chrome')
  })
})
