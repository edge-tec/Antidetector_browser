import { describe, it, expect } from 'vitest'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'

describe('Security Audit: Runtime Capability Consistency & Anomaly Prevention', () => {
  it('prevents contradictory hardware combinations (e.g. desktop macOS with excessive touch points)', () => {
    const anomalousMac = AuthCompatibilityEngine.validateDeviceProfileMetrics({
      osType: 'macos-sonoma',
      deviceType: 'desktop',
      touchSupport: false,
      maxTouchPoints: 10
    })

    expect(anomalousMac.isValid).toBe(false)
    expect(anomalousMac.anomalies[0]).toContain('macOS desktop profile')
  })

  it('validates genuine mobile presentation metrics consistency', () => {
    const validAndroid = AuthCompatibilityEngine.validateDeviceProfileMetrics({
      osType: 'android',
      deviceType: 'mobile',
      touchSupport: true,
      maxTouchPoints: 5
    })

    expect(validAndroid.isValid).toBe(true)
    expect(validAndroid.anomalies.length).toBe(0)
  })

  it('reports NATIVE_RUNTIME_REQUIRED capabilities transparently for iOS/Android', () => {
    const iosCheck = AuthCompatibilityEngine.checkCompatibility('windows-11', 'ios', 'desktop', 'mobile')
    expect(iosCheck.unsupportedCapabilities.length).toBeGreaterThan(0)
    expect(iosCheck.unsupportedCapabilities).toContain('Native iOS WebKit Engine (Running on Chromium Runtime)')
  })

  it('validates device presentation consistency through DeviceConsistencyValidator', async () => {
    const { DeviceConsistencyValidator } = await import('../../src/main/browser/device/device-consistency')
    const res = DeviceConsistencyValidator.validate({
      osType: 'android',
      deviceType: 'mobile',
      touchSupport: false,
      maxTouchPoints: 0
    })

    expect(res.isMobilePresentation).toBe(true)
    expect(res.anomalies.length).toBeGreaterThan(0)
    expect(res.sanitizedProfile.touchSupport).toBe(true)
    expect(res.sanitizedProfile.maxTouchPoints).toBe(5)
  })
})

