import { describe, it, expect } from 'vitest'
import { AuthCompatibilityEngine } from '../../src/main/browser/auth/auth-compatibility'
import { DeviceConsistencyValidator } from '../../src/main/browser/device/device-consistency'

describe('Mobile Device Profile Presentation & Capability Audit (Specification §5 & §13)', () => {
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

  it('resolves authoritative Android mobile PlatformProfile with consistent touch, client hints, and user agent', () => {
    const profile = DeviceConsistencyValidator.resolvePlatformProfile({
      osType: 'android',
      browserType: 'chrome',
      deviceModel: 'SM-S928B'
    })

    expect(profile.os).toBe('android')
    expect(profile.mobile).toBe(true)
    expect(profile.touch).toBe(true)
    expect(profile.maxTouchPoints).toBe(5)
    expect(profile.clientHintsPlatform).toBe('Android')
    expect(profile.platformString).toBe('Linux armv8l')
    expect(profile.userAgent).toContain('Android')
    expect(profile.userAgent).toContain('SM-S928B')
  })

  it('resolves authoritative iOS mobile PlatformProfile with consistent touch, client hints, and user agent', () => {
    const profile = DeviceConsistencyValidator.resolvePlatformProfile({
      osType: 'ios',
      browserType: 'chrome'
    })

    expect(profile.os).toBe('ios')
    expect(profile.mobile).toBe(true)
    expect(profile.touch).toBe(true)
    expect(profile.maxTouchPoints).toBe(5)
    expect(profile.clientHintsPlatform).toBe('iOS')
    expect(profile.platformString).toBe('iPhone')
    expect(profile.userAgent).toContain('iPhone')
  })

  it('transparently declares unsupported native Android/iOS hardware APIs under Chromium runtime', () => {
    const iosReport = AuthCompatibilityEngine.checkCompatibility('macOS', 'iOS', 'desktop', 'mobile')
    expect(iosReport.unsupportedCapabilities).toContain('Native iOS WebKit Engine (Running on Chromium Runtime)')
    expect(iosReport.unsupportedCapabilities).toContain('Apple Secure Enclave Hardware Passkey Attestation')

    const androidReport = AuthCompatibilityEngine.checkCompatibility('windows-11', 'android', 'desktop', 'mobile')
    expect(androidReport.unsupportedCapabilities).toContain('Native Android SafetyNet/Play Integrity Hardware API')
    expect(androidReport.unsupportedCapabilities).toContain('Android Google Play Services FIDO2 Authenticator')
  })
})
