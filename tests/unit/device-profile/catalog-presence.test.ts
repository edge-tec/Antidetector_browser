import { describe, it, expect } from 'vitest'
import { ANDROID_DEVICES as RENDERER_DEVICES, getDeviceById as getRendererDeviceById } from '../../../src/renderer/data/android-devices'
import { ANDROID_DEVICES as MAIN_DEVICES, getAndroidDeviceById } from '../../../src/main/fingerprint/android-devices'
import { ALL_DEVICE_TEMPLATES } from '../../../src/main/fingerprint/device-templates'

describe('Android Device Catalog - Galaxy A16 & Galaxy A33 5G Presence', () => {
  it('should include Galaxy A16 in renderer catalog', () => {
    const dev = getRendererDeviceById('samsung-a16')
    expect(dev).toBeDefined()
    expect(dev?.modelName).toBe('Galaxy A16 (SM-A165F)')
    expect(dev?.brand).toBe('Samsung')
    expect(dev?.modelCode).toBe('SM-A165F')
    expect(dev?.androidVersion).toBe('15')
  })

  it('should include Galaxy A33 5G in renderer catalog', () => {
    const dev = getRendererDeviceById('samsung-a33-5g')
    expect(dev).toBeDefined()
    expect(dev?.modelName).toBe('Galaxy A33 5G (SM-A336E)')
    expect(dev?.brand).toBe('Samsung')
    expect(dev?.modelCode).toBe('SM-A336E')
    expect(dev?.androidVersion).toBe('15')
  })

  it('should include Galaxy A16 in main fingerprint catalog', () => {
    const dev = getAndroidDeviceById('samsung-a16')
    expect(dev).toBeDefined()
    expect(dev?.modelName).toBe('Galaxy A16 (SM-A165F)')
    expect(dev?.modelCode).toBe('SM-A165F')
  })

  it('should include Galaxy A33 5G in main fingerprint catalog', () => {
    const dev = getAndroidDeviceById('samsung-a33-5g')
    expect(dev).toBeDefined()
    expect(dev?.modelName).toBe('Galaxy A33 5G (SM-A336E)')
    expect(dev?.modelCode).toBe('SM-A336E')
  })

  it('should have device templates registered for both models', () => {
    const a16Tmpl = ALL_DEVICE_TEMPLATES.find((t) => t.deviceId === 'samsung-a16')
    const a33Tmpl = ALL_DEVICE_TEMPLATES.find((t) => t.deviceId === 'samsung-a33-5g')

    expect(a16Tmpl).toBeDefined()
    expect(a16Tmpl?.model).toBe('Samsung Galaxy A16')

    expect(a33Tmpl).toBeDefined()
    expect(a33Tmpl?.model).toBe('Samsung Galaxy A33 5G')
  })
})
