import { describe, it, expect } from 'vitest'
import { recalculateDependentFields, generateFingerprint } from '../../src/main/fingerprint/generator'
import { getAndroidDeviceById } from '../../src/main/fingerprint/android-devices'
import { getIosDeviceById } from '../../src/main/fingerprint/ios-devices'
import { buildUserAgentMetadata } from '../../src/main/browser/injection/injector'

describe('Device Selection Hardware & Configuration Coherence', () => {
  it('strictly applies Samsung Galaxy S24 Ultra hardware specs without host PC leak', () => {
    const s24 = getAndroidDeviceById('samsung-s24-ultra')!
    expect(s24).toBeDefined()

    // Simulate an existing Mac profile with 16GB RAM and 10 CPU cores
    const macFp = generateFingerprint({
      osType: 'macos-arm',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120'
    })

    // User switches device to Android Galaxy S24 Ultra
    const androidFp = recalculateDependentFields(macFp, {
      osType: 'android',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      deviceModelId: s24.id
    })

    // Validate Navigator specs
    expect(androidFp.navigator.platform).toBe('Linux armv8l')
    expect(androidFp.navigator.hardwareConcurrency).toBe(8)
    expect(androidFp.navigator.deviceMemory).toBe(12)
    expect(androidFp.navigator.maxTouchPoints).toBe(5)
    expect(androidFp.navigator.touchSupport).toBe(true)
    expect((androidFp.navigator as any).deviceBrand).toBe('Samsung')
    expect((androidFp.navigator as any).deviceModelCode).toBe('SM-S928B')

    // Validate Screen specs
    expect(androidFp.screen.width).toBe(s24.screenWidth)
    expect(androidFp.screen.height).toBe(s24.screenHeight)
    expect(androidFp.screen.devicePixelRatio).toBe(s24.dpr)
    expect(androidFp.screen.orientation).toBe('portrait-primary')

    // Validate WebGL GPU specs
    expect(androidFp.webgl.gpuVendor).toBe('Qualcomm')
    expect(androidFp.webgl.unmaskedRenderer).toBe('Adreno (TM) 750')

    // Validate Client Hints User-Agent Metadata
    const ch = buildUserAgentMetadata(androidFp)
    expect(ch.platform).toBe('Android')
    expect(ch.architecture).toBe('arm')
    expect(ch.mobile).toBe(true)
    expect(ch.model).toBe('SM-S928B')
  })

  it('strictly applies iPhone 16 Pro Max hardware specs without host PC leak', () => {
    const iphone = getIosDeviceById('iphone-16-pro-max')!
    expect(iphone).toBeDefined()

    // Simulate an existing Windows profile with 32GB RAM and 16 CPU cores
    const winFp = generateFingerprint({
      osType: 'windows-11',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120'
    })

    // User switches device to iPhone 16 Pro Max
    const iosFp = recalculateDependentFields(winFp, {
      osType: 'ios',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      deviceModelId: iphone.id
    })

    // Validate Navigator specs
    expect(iosFp.navigator.platform).toBe('iPhone')
    expect(iosFp.navigator.hardwareConcurrency).toBe(6)
    expect(iosFp.navigator.deviceMemory).toBe(8)
    expect(iosFp.navigator.maxTouchPoints).toBe(5)
    expect(iosFp.navigator.touchSupport).toBe(true)
    expect((iosFp.navigator as any).deviceBrand).toBe('Apple')
    expect((iosFp.navigator as any).deviceModel).toBe('iPhone 16 Pro Max')

    // Validate Screen specs
    expect(iosFp.screen.width).toBe(iphone.screenWidth)
    expect(iosFp.screen.height).toBe(iphone.screenHeight)
    expect(iosFp.screen.devicePixelRatio).toBe(iphone.dpr)
    expect(iosFp.screen.orientation).toBe('portrait-primary')

    // Validate WebGL GPU specs
    expect(iosFp.webgl.gpuVendor).toBe('Apple Inc.')
    expect(iosFp.webgl.unmaskedRenderer).toBe('Apple A18 Pro GPU')

    // Validate Client Hints User-Agent Metadata
    const ch = buildUserAgentMetadata(iosFp)
    expect(ch.platform).toBe('iOS')
    expect(ch.architecture).toBe('arm')
    expect(ch.mobile).toBe(true)
    expect(ch.model).toBe('iPhone')
  })

  it('switches between multiple Android models (Pixel 8 Pro, Xiaomi 14 Pro) and updates GPU/Screen specs cleanly', () => {
    const pixel = getAndroidDeviceById('pixel-8-pro')!
    expect(pixel).toBeDefined()
    const xiaomi = getAndroidDeviceById('xiaomi-14-pro')!
    expect(xiaomi).toBeDefined()

    const pixelFp = generateFingerprint({
      osType: 'android',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      deviceModelId: pixel.id
    })
    expect((pixelFp.navigator as any).deviceBrand).toBe('Google Pixel')
    expect((pixelFp.navigator as any).deviceModelCode).toBe('Pixel 8 Pro')
    expect(pixelFp.webgl.unmaskedRenderer).toBe('Mali-G715 Immortalis MC10')

    const xiaomiFp = recalculateDependentFields(pixelFp, {
      osType: 'android',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      deviceModelId: xiaomi.id
    })
    expect((xiaomiFp.navigator as any).deviceBrand).toBe('Xiaomi / Redmi')
    expect((xiaomiFp.navigator as any).deviceModelCode).toBe('23116PN5BC')
    expect(xiaomiFp.webgl.unmaskedRenderer).toBe('Adreno (TM) 750')
  })
})
