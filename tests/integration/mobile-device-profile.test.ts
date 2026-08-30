import { describe, it, expect } from 'vitest'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'

describe('Mobile Device Profile Presentation & Capability Audit', () => {
  it('validates mobile profile metrics and flags missing touch capabilities', () => {
    const validMobile = AuthCompatibilityEngine.validateDeviceProfileMetrics({
      osType: 'android',
      deviceType: 'mobile',
      touchSupport: true,
      maxTouchPoints: 5
    })
    expect(validMobile.isValid).toBe(true)
    expect(validMobile.anomalies.length).toBe(0)

    const invalidMobile = AuthCompatibilityEngine.validateDeviceProfileMetrics({
      osType: 'android',
      deviceType: 'mobile',
      touchSupport: false,
      maxTouchPoints: 0
    })
    expect(invalidMobile.isValid).toBe(false)
    expect(invalidMobile.anomalies[0]).toContain('touch points')
  })

  it('transparently declares unsupported native Android/iOS hardware APIs under Chromium runtime', () => {
    const iosReport = AuthCompatibilityEngine.checkCompatibility('macOS', 'iOS', 'desktop', 'mobile')
    expect(iosReport.unsupportedCapabilities).toContain('Native iOS WebKit Engine (Running on Chromium Runtime)')

    const androidReport = AuthCompatibilityEngine.checkCompatibility('windows-11', 'android', 'desktop', 'mobile')
    expect(androidReport.unsupportedCapabilities).toContain('Native Android SafetyNet/Play Integrity Hardware API')
  })
})
