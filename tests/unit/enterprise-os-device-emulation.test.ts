import { describe, it, expect } from 'vitest'
import vm from 'vm'
import { buildInjectionScript, buildUserAgentMetadata } from '../../src/main/browser/injection/injector'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { OSType } from '../../src/main/fingerprint/types'

describe('Enterprise OS & Device Emulation Integrity', () => {
  const allOsTypes: OSType[] = [
    'windows-10',
    'windows-11',
    'macos-intel',
    'macos-arm',
    'linux',
    'android',
    'ios'
  ]

  it('generates 100% syntactically valid JS injection scripts for every OS and browser engine (zero SyntaxError)', () => {
    for (const osType of allOsTypes) {
      for (const browserType of ['chrome', 'firefox'] as const) {
        const fp = generateFingerprint({ osType, browserType })
        ;(fp as any).osType = osType
        const script = buildInjectionScript(fp, browserType)

        expect(script).not.toContain(' as any')
        // Must compile cleanly in V8 without throwing SyntaxError
        expect(() => new vm.Script(script)).not.toThrow()
      }
    }
  })

  it('accurately spoofs Samsung Galaxy S26 Ultra (SM-S948B) on Android 16 in Client Hints and JS injection', () => {
    const fp = generateFingerprint({ osType: 'android', browserType: 'chrome', browserVersion: '128.0.6613.120' })
    ;(fp as any).osType = 'android'
    fp.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 16; SM-S948B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.120 Mobile Safari/537.36'
    fp.navigator.platform = 'Linux armv8l'
    fp.navigator.browserVersion = '128.0.6613.120'
    ;(fp.navigator as any).deviceModelCode = 'SM-S948B'
    ;(fp.navigator as any).androidVersion = '16'
    fp.screen.width = 412
    fp.screen.height = 919
    fp.screen.devicePixelRatio = 3.5
    fp.webgl.unmaskedRenderer = 'Adreno (TM) 840'

    const meta = buildUserAgentMetadata(fp)
    expect(meta.platform).toBe('Android')
    expect(meta.platformVersion).toBe('16.0.0')
    expect(meta.model).toBe('SM-S948B')
    expect(meta.mobile).toBe(true)
    expect(meta.architecture).toBe('arm')
    expect(meta.bitness).toBe('64')

    const script = buildInjectionScript(fp, 'chrome')
    expect(() => new vm.Script(script)).not.toThrow()
    expect(script).toContain('SM-S948B')
    expect(script).toContain('16.0.0')
    expect(script).toContain('Linux armv8l')
    expect(script).toContain('Adreno (TM) 840')
  })

  it('produces accurate Client Hints metadata for Windows 11, macOS ARM, and Linux', () => {
    const winFp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
    ;(winFp as any).osType = 'windows-11'
    const winMeta = buildUserAgentMetadata(winFp)
    expect(winMeta.platform).toBe('Windows')
    expect(winMeta.platformVersion).toBe('15.0.0')
    expect(winMeta.mobile).toBe(false)
    expect(winMeta.architecture).toBe('x86')

    const macFp = generateFingerprint({ osType: 'macos-arm', browserType: 'chrome' })
    ;(macFp as any).osType = 'macos-arm'
    const macMeta = buildUserAgentMetadata(macFp)
    expect(macMeta.platform).toBe('macOS')
    expect(macMeta.mobile).toBe(false)
    expect(macMeta.architecture).toBe('arm')

    const linuxFp = generateFingerprint({ osType: 'linux', browserType: 'chrome' })
    ;(linuxFp as any).osType = 'linux'
    const linuxMeta = buildUserAgentMetadata(linuxFp)
    expect(linuxMeta.platform).toBe('Linux')
    expect(linuxMeta.mobile).toBe(false)
  })
})
