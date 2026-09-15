import { describe, it, expect } from 'vitest'
import {
  SamsungDeviceProfileFactory,
  GalaxyA16Profile,
  GalaxyA33Profile,
  CapabilityStatus,
  ScreenOrientation
} from '../../../src/main/device-profile'

describe('Samsung Device Profiles (Galaxy A16 & Galaxy A33 5G)', () => {
  describe('SamsungDeviceProfileFactory', () => {
    it('should list registered models including Galaxy A16 and Galaxy A33 5G', () => {
      const models = SamsungDeviceProfileFactory.getSupportedModels()
      const keys = models.map((m) => m.key)
      expect(keys).toContain('galaxy-a16')
      expect(keys).toContain('galaxy-a33')
    })

    it('should instantiate Galaxy A16 via factory', () => {
      const profile = SamsungDeviceProfileFactory.create('galaxy-a16')
      expect(profile).toBeInstanceOf(GalaxyA16Profile)
      expect(profile.model).toBe('Galaxy A16')
      expect(profile.deviceCodename).toBe('a16x')
      expect(profile.productName).toBe('a16xx')
      expect(profile.manufacturer).toBe('Samsung')
      expect(profile.brand).toBe('samsung')
    })

    it('should instantiate Galaxy A33 5G via factory', () => {
      const profile = SamsungDeviceProfileFactory.create('galaxy-a33')
      expect(profile).toBeInstanceOf(GalaxyA33Profile)
      expect(profile.model).toBe('Galaxy A33 5G')
      expect(profile.deviceCodename).toBe('a33x')
      expect(profile.productName).toBe('a33xx')
    })

    it('should throw error on unsupported model key', () => {
      expect(() => SamsungDeviceProfileFactory.create('non-existent-device')).toThrow(/Unknown Samsung model key/)
    })
  })

  describe('GalaxyA16Profile Specification', () => {
    it('should have correct default Android 15 & One UI 7.0 build properties', () => {
      const a16 = new GalaxyA16Profile()
      const build = a16.getAndroidBuild()

      expect(build.model).toBe('SM-A165F')
      expect(build.androidVersion).toBe('15')
      expect(build.apiLevel).toBe(35)
      expect(build.board).toBe('exynos1330')
      expect(build.hardware).toBe('exynos1330')
      expect(build.fingerprint).toContain('samsung/a16xx/a16x:15')
      expect(build.buildTags).toBe('release-keys')

      const props = a16.getBuildProperties()
      expect(props['ro.product.model']).toBe('SM-A165F')
      expect(props['ro.build.version.release']).toBe('15')
      expect(props['ro.build.version.sdk']).toBe('35')
      expect(props['ro.build.version.oneui']).toBe('7.0')
    })

    it('should support configurable Android version (e.g. Android 14 / API 34)', () => {
      const a16 = new GalaxyA16Profile({
        androidVersion: '14',
        apiLevel: 34,
        oneUiVersion: '6.1',
        ramGb: 8,
        storageGb: 256
      })
      const build = a16.getAndroidBuild()
      expect(build.androidVersion).toBe('14')
      expect(build.apiLevel).toBe(34)
      expect(a16.getHardware().ramGb).toBe(8)
      expect(a16.getHardware().storageGb).toBe(256)
    })

    it('should have accurate hardware specs for Galaxy A16', () => {
      const a16 = new GalaxyA16Profile()
      const hw = a16.getHardware()

      expect(hw.socModel).toBe('Samsung Exynos 1330')
      expect(hw.cpuArchitecture).toBe('arm64-v8a')
      expect(hw.coreCount).toBe(8)
      expect(hw.gpuModel).toBe('Mali-G68 MP2')
      expect(hw.battery.capacityMah).toBe(5000)
      expect(hw.battery.fastChargingWattage).toBe(25)
    })

    it('should accurately report security capability boundaries without unsupported claims', () => {
      const a16 = new GalaxyA16Profile()
      const report = a16.getCapabilityReport()

      expect(report.getStatus('BUILD_PROPERTIES')).toBe(CapabilityStatus.SUPPORTED)
      expect(report.getStatus('KNOX_HARDWARE_VAULT')).toBe(CapabilityStatus.REQUIRES_REAL_HARDWARE)
      expect(report.getStatus('PLAY_INTEGRITY_HARDWARE_VERIFICATION')).toBe(CapabilityStatus.REQUIRES_REAL_HARDWARE)
      expect(report.getStatus('WIDEVINE_L1_OEM_CRYPTO')).toBe(CapabilityStatus.REQUIRES_REAL_HARDWARE)
      expect(report.hasUnsupportedClaims()).toBe(false)
    })
  })

  describe('GalaxyA33Profile Specification', () => {
    it('should have correct default Android 15 & One UI 7.0 build properties for Galaxy A33 5G', () => {
      const a33 = new GalaxyA33Profile()
      const build = a33.getAndroidBuild()

      expect(build.model).toBe('SM-A336E')
      expect(build.androidVersion).toBe('15')
      expect(build.board).toBe('exynos1280')
      expect(build.fingerprint).toContain('samsung/a33xx/a33x:15')

      const props = a33.getBuildProperties()
      expect(props['ro.product.model']).toBe('SM-A336E')
      expect(props['ro.product.board']).toBe('exynos1280')
      expect(props['ro.build.version.oneui']).toBe('7.0')
    })

    it('should have 5G Sub6 cellular capability configured', () => {
      const a33 = new GalaxyA33Profile()
      const conn = a33.getConnectivityProfile()

      expect(conn.has5G()).toBe(true)
      expect(conn.hasDualSim()).toBe(true)
      expect(conn.hasNfc()).toBe(true)
    })

    it('should have 48MP main camera with Optical Image Stabilization (OIS)', () => {
      const a33 = new GalaxyA33Profile()
      const camConfig = a33.getCameraConfiguration()
      const mainCam = camConfig.getPrimaryBackCamera()

      expect(mainCam).toBeDefined()
      expect(mainCam?.sensorResolutionMp).toBe(48)
      expect(mainCam?.hasOpticalStabilization).toBe(true)
      expect(mainCam?.hasAutofocus).toBe(true)
      expect(mainCam?.supportedImageFormats).toContain('RAW_SENSOR')
    })
  })
})
