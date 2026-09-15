import { describe, it, expect } from 'vitest'
import {
  GalaxyA16Profile,
  GalaxyA33Profile,
  ScreenOrientation,
  SensorType,
  LensFacing
} from '../../../src/main/device-profile'

describe('Display, Camera, Sensors and Connectivity Compatibility', () => {
  describe('DisplayConfiguration', () => {
    it('should reflect Galaxy A16 display metrics and cutout', () => {
      const a16 = new GalaxyA16Profile()
      const display = a16.getDisplayConfiguration()

      expect(display.getWidth()).toBe(1080)
      expect(display.getHeight()).toBe(2340)
      expect(display.getDensityDpi()).toBe(420)
      expect(display.getRefreshRate()).toBe(90)
      expect(display.getOrientation()).toBe(ScreenOrientation.PORTRAIT)

      const cutout = display.getCutout()
      expect(cutout.hasCutout).toBe(true)
      expect(cutout.type).toBe('WATERDROP')
      expect(cutout.position).toBe('CENTER')
    })

    it('should handle orientation changes with dimension swapping', () => {
      const a33 = new GalaxyA33Profile()
      const display = a33.getDisplayConfiguration()

      expect(display.getWidth()).toBe(1080)
      expect(display.getHeight()).toBe(2400)

      display.setOrientation(ScreenOrientation.LANDSCAPE)
      expect(display.getWidth()).toBe(2400)
      expect(display.getHeight()).toBe(1080)
      expect(display.getOrientation()).toBe(ScreenOrientation.LANDSCAPE)

      display.setOrientation(ScreenOrientation.PORTRAIT)
      expect(display.getWidth()).toBe(1080)
      expect(display.getHeight()).toBe(2400)
    })

    it('should permit switching refresh rates between supported rates and reject unsupported', () => {
      const a33 = new GalaxyA33Profile()
      const display = a33.getDisplayConfiguration()

      display.setRefreshRate(60)
      expect(display.getRefreshRate()).toBe(60)

      display.setRefreshRate(90)
      expect(display.getRefreshRate()).toBe(90)

      expect(() => display.setRefreshRate(144)).toThrow(/Unsupported refresh rate: 144Hz/)
    })

    it('should produce standard Android DisplayMetrics output', () => {
      const a16 = new GalaxyA16Profile()
      const metrics = a16.getDisplayConfiguration().toAndroidDisplayMetrics()

      expect(metrics.widthPixels).toBe(1080)
      expect(metrics.heightPixels).toBe(2340)
      expect(metrics.densityDpi).toBe(420)
      expect(metrics.density).toBeCloseTo(2.625)
    })
  })

  describe('CameraConfiguration', () => {
    it('should list all cameras and distinguish front and back lenses', () => {
      const a33 = new GalaxyA33Profile()
      const camConfig = a33.getCameraConfiguration()

      const all = camConfig.getCameras()
      expect(all.length).toBe(5) // 4 rear + 1 front

      const back = camConfig.getBackCameras()
      expect(back.length).toBe(4)

      const front = camConfig.getFrontCameras()
      expect(front.length).toBe(1)
      expect(front[0].facing).toBe(LensFacing.FRONT)
    })

    it('should format Camera2 compatible CameraCharacteristics map', () => {
      const a16 = new GalaxyA16Profile()
      const map = a16.getCameraConfiguration().toCameraCharacteristicsMap()

      expect(map['0']).toBeDefined()
      expect(map['0']['android.lens.facing']).toBe('LENS_FACING_BACK')
      expect(map['0']['android.sensor.info.pixelArraySize']).toEqual({ width: 8160, height: 6120 })
      expect(map['0']['android.flash.info.available']).toBe(true)

      expect(map['1']).toBeDefined()
      expect(map['1']['android.lens.facing']).toBe('LENS_FACING_FRONT')
    })
  })

  describe('SensorConfiguration & Deterministic Simulation', () => {
    it('should list available sensors for Galaxy A33 5G', () => {
      const a33 = new GalaxyA33Profile()
      const sensorConfig = a33.getSensorConfiguration()

      expect(sensorConfig.hasSensor(SensorType.ACCELEROMETER)).toBe(true)
      expect(sensorConfig.hasSensor(SensorType.GYROSCOPE)).toBe(true)
      expect(sensorConfig.hasSensor(SensorType.MAGNETIC_FIELD)).toBe(true)
      expect(sensorConfig.hasSensor(SensorType.LIGHT)).toBe(true)
      expect(sensorConfig.hasSensor(SensorType.STEP_COUNTER)).toBe(true)
    })

    it('should generate deterministic, reproducible sensor readings for testing', () => {
      const a33 = new GalaxyA33Profile()
      const sensorConfig = a33.getSensorConfiguration()

      const reading1 = sensorConfig.generateDeterministicReading(SensorType.ACCELEROMETER, 0)
      const reading2 = sensorConfig.generateDeterministicReading(SensorType.ACCELEROMETER, 0)
      const readingStep5 = sensorConfig.generateDeterministicReading(SensorType.ACCELEROMETER, 5)

      expect(reading1).not.toBeNull()
      expect(reading1?.sensorType).toBe(SensorType.ACCELEROMETER)
      expect(reading1?.values[2]).toBeCloseTo(9.80665) // Gravity baseline
      expect(reading1?.values).toEqual(reading2?.values) // Deterministic reproducibility
      expect(readingStep5?.timestampNs).toBeGreaterThan(reading1!.timestampNs)
    })
  })

  describe('ConnectivityProfile', () => {
    it('should expose Android NetworkCapabilities and synthetic carrier configs', () => {
      const a33 = new GalaxyA33Profile()
      const conn = a33.getConnectivityProfile()

      const netCaps = conn.toAndroidNetworkCapabilities()
      expect(netCaps.hasTransportWifi).toBe(true)
      expect(netCaps.hasTransportCellular).toBe(true)
      expect(netCaps.networkCapabilities).toContain('NET_CAPABILITY_INTERNET')

      const carrier = conn.getCarrier()
      expect(carrier.mcc).toBe('001') // Test MCC
      expect(carrier.mnc).toBe('01')
      expect(carrier.carrierName).toBe('Test Mobile QA')
    })
  })
})
