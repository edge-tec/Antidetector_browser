import { SamsungDeviceProfile } from '../samsung/SamsungDeviceProfile'
import {
  AndroidBuildSpec,
  DisplayMetricsSpec,
  HardwareSpec,
  CameraSpec,
  SensorSpec,
  ConnectivitySpec,
  SyntheticIdentifiers,
  ScreenOrientation,
  LensFacing,
  SensorType,
  CapabilityStatus
} from '../core/types'
import { SoftwareConfigSpec, SoftwareConfiguration } from '../software/SoftwareConfiguration'
import { SyntheticIdentifierGenerator } from '../identity/SyntheticIdentifierGenerator'

export interface GalaxyA33ProfileOptions {
  profileId?: string
  ramGb?: 6 | 8
  storageGb?: 128 | 256
  androidVersion?: '14' | '15'
  apiLevel?: 34 | 35
  oneUiVersion?: '6.1' | '7.0'
  identifiers?: SyntheticIdentifiers
}

/**
 * Concrete Profile definition for Samsung Galaxy A33 5G (SM-A336E/DS)
 */
export class GalaxyA33Profile extends SamsungDeviceProfile {
  constructor(options: GalaxyA33ProfileOptions = {}) {
    const androidVer = options.androidVersion ?? '15'
    const apiLvl = options.apiLevel ?? (androidVer === '15' ? 35 : 34)
    const oneUiVer = options.oneUiVersion ?? '7.0'
    const ram = options.ramGb ?? 8
    const storage = options.storageGb ?? 128

    const buildId = androidVer === '15' ? 'AP3A.240905.015' : 'UP1A.231005.007'
    const bootloader = 'A336EDXU9EXK1'
    const fingerprint = `samsung/a33xx/a33x:${androidVer}/${buildId}/${bootloader}:user/release-keys`

    const androidBuild: AndroidBuildSpec = {
      brand: 'samsung',
      manufacturer: 'samsung',
      model: 'SM-A336E',
      device: 'a33x',
      product: 'a33xx',
      board: 'exynos1280',
      hardware: 'exynos1280',
      bootloader,
      androidVersion: androidVer,
      apiLevel: apiLvl,
      buildId,
      buildTags: 'release-keys',
      securityPatchDate: '2025-01-01',
      fingerprint,
      oneUiVersion: oneUiVer
    }

    const displayMetrics: DisplayMetricsSpec = {
      widthPixels: 1080,
      heightPixels: 2400,
      density: 2.8125,
      densityDpi: 450,
      scaledDensity: 2.8125,
      xdpi: 411.0,
      ydpi: 411.0,
      refreshRate: 90,
      supportedRefreshRates: [60, 90],
      diagonalInches: 6.4,
      panelType: 'SUPER_AMOLED',
      hdrSupported: false,
      colorGamut: 'DCI-P3',
      multiTouchPoints: 10,
      orientation: ScreenOrientation.PORTRAIT,
      cutout: {
        hasCutout: true,
        type: 'WATERDROP',
        position: 'CENTER',
        safeInsetTop: 84,
        safeInsetBottom: 0,
        safeInsetLeft: 0,
        safeInsetRight: 0,
        radius: 30
      }
    }

    const hardwareSpec: HardwareSpec = {
      socModel: 'Samsung Exynos 1280 (5nm)',
      socVendor: 'Samsung',
      cpuArchitecture: 'arm64-v8a',
      supportedAbis: ['arm64-v8a', 'armeabi-v7a', 'armeabi'],
      coreCount: 8,
      coreClusters: [
        { type: 'performance', count: 2, maxFrequencyMhz: 2400 },
        { type: 'efficiency', count: 6, maxFrequencyMhz: 2000 }
      ],
      gpuModel: 'Mali-G68',
      gpuVendor: 'ARM',
      ramBytes: ram * 1024 * 1024 * 1024,
      ramGb: ram,
      storageBytes: storage * 1024 * 1024 * 1024,
      storageGb: storage,
      storageTechnology: 'UFS 2.2',
      battery: {
        capacityMah: 5000,
        fastChargingWattage: 25,
        wirelessCharging: false,
        reverseCharging: false
      }
    }

    const cameras: CameraSpec[] = [
      {
        cameraId: '0',
        facing: LensFacing.BACK,
        label: 'Wide 48MP Main with OIS',
        sensorResolutionMp: 48,
        activeArrayWidth: 8000,
        activeArrayHeight: 6000,
        focalLengthMm: 26.0,
        apertureFNumber: 1.8,
        hasAutofocus: true,
        hasOpticalStabilization: true,
        hasFlash: true,
        hasHdr: true,
        supportedImageFormats: ['JPEG', 'YUV_420_888', 'RAW_SENSOR'],
        supportedVideoResolutions: [
          { width: 3840, height: 2160, maxFps: 30, label: '4K UHD @ 30fps' },
          { width: 1920, height: 1080, maxFps: 60, label: '1080p @ 60fps' },
          { width: 1280, height: 720, maxFps: 480, label: '720p SlowMo @ 480fps' }
        ]
      },
      {
        cameraId: '1',
        facing: LensFacing.FRONT,
        label: 'Front Selfie 13MP',
        sensorResolutionMp: 13,
        activeArrayWidth: 4160,
        activeArrayHeight: 3120,
        focalLengthMm: 26.0,
        apertureFNumber: 2.2,
        hasAutofocus: false,
        hasOpticalStabilization: false,
        hasFlash: false,
        hasHdr: true,
        supportedImageFormats: ['JPEG', 'YUV_420_888'],
        supportedVideoResolutions: [
          { width: 3840, height: 2160, maxFps: 30, label: '4K UHD @ 30fps' },
          { width: 1920, height: 1080, maxFps: 30, label: '1080p @ 30fps' }
        ]
      },
      {
        cameraId: '2',
        facing: LensFacing.BACK,
        label: 'Ultrawide 8MP',
        sensorResolutionMp: 8,
        activeArrayWidth: 3264,
        activeArrayHeight: 2448,
        focalLengthMm: 16.0,
        apertureFNumber: 2.2,
        hasAutofocus: false,
        hasOpticalStabilization: false,
        hasFlash: false,
        hasHdr: true,
        supportedImageFormats: ['JPEG'],
        supportedVideoResolutions: [
          { width: 1920, height: 1080, maxFps: 30, label: '1080p @ 30fps' }
        ]
      },
      {
        cameraId: '3',
        facing: LensFacing.BACK,
        label: 'Macro 5MP',
        sensorResolutionMp: 5,
        activeArrayWidth: 2560,
        activeArrayHeight: 1920,
        focalLengthMm: 24.0,
        apertureFNumber: 2.4,
        hasAutofocus: false,
        hasOpticalStabilization: false,
        hasFlash: false,
        hasHdr: false,
        supportedImageFormats: ['JPEG'],
        supportedVideoResolutions: []
      },
      {
        cameraId: '4',
        facing: LensFacing.BACK,
        label: 'Depth 2MP',
        sensorResolutionMp: 2,
        activeArrayWidth: 1600,
        activeArrayHeight: 1200,
        focalLengthMm: 24.0,
        apertureFNumber: 2.4,
        hasAutofocus: false,
        hasOpticalStabilization: false,
        hasFlash: false,
        hasHdr: false,
        supportedImageFormats: ['JPEG'],
        supportedVideoResolutions: []
      }
    ]

    const sensors: SensorSpec[] = [
      {
        type: SensorType.ACCELEROMETER,
        name: 'STMicroelectronics LSM6DSO Accelerometer',
        vendor: 'STMicroelectronics',
        version: 1,
        maximumRange: 78.45,
        resolution: 0.00239,
        powerMa: 0.25,
        minDelayUs: 10000,
        maxDelayUs: 200000,
        isWakeUpSensor: false,
        status: CapabilityStatus.SUPPORTED
      },
      {
        type: SensorType.GYROSCOPE,
        name: 'STMicroelectronics LSM6DSO Gyroscope',
        vendor: 'STMicroelectronics',
        version: 1,
        maximumRange: 34.906,
        resolution: 0.001065,
        powerMa: 0.55,
        minDelayUs: 10000,
        maxDelayUs: 200000,
        isWakeUpSensor: false,
        status: CapabilityStatus.SUPPORTED
      },
      {
        type: SensorType.MAGNETIC_FIELD,
        name: 'Asahi Kasei AK09918 Geomagnetic Sensor',
        vendor: 'Asahi Kasei',
        version: 1,
        maximumRange: 4912.0,
        resolution: 0.15,
        powerMa: 1.1,
        minDelayUs: 10000,
        maxDelayUs: 200000,
        isWakeUpSensor: false,
        status: CapabilityStatus.SUPPORTED
      },
      {
        type: SensorType.PROXIMITY,
        name: 'Samsung Virtual Proximity Sensing',
        vendor: 'Samsung Electronics',
        version: 1,
        maximumRange: 5.0,
        resolution: 5.0,
        powerMa: 0.75,
        minDelayUs: 0,
        maxDelayUs: 0,
        isWakeUpSensor: true,
        status: CapabilityStatus.SUPPORTED
      },
      {
        type: SensorType.LIGHT,
        name: 'Sensortek STK3338 Ambient Light Sensor',
        vendor: 'Sensortek',
        version: 1,
        maximumRange: 65535.0,
        resolution: 1.0,
        powerMa: 0.18,
        minDelayUs: 100000,
        maxDelayUs: 1000000,
        isWakeUpSensor: false,
        status: CapabilityStatus.SUPPORTED
      },
      {
        type: SensorType.STEP_COUNTER,
        name: 'Samsung Step Counter Sensor',
        vendor: 'Samsung Electronics',
        version: 1,
        maximumRange: 4294967295,
        resolution: 1.0,
        powerMa: 0.05,
        minDelayUs: 0,
        maxDelayUs: 0,
        isWakeUpSensor: false,
        status: CapabilityStatus.SUPPORTED
      },
      {
        type: SensorType.STEP_DETECTOR,
        name: 'Samsung Step Detector Sensor',
        vendor: 'Samsung Electronics',
        version: 1,
        maximumRange: 1.0,
        resolution: 1.0,
        powerMa: 0.05,
        minDelayUs: 0,
        maxDelayUs: 0,
        isWakeUpSensor: false,
        status: CapabilityStatus.SUPPORTED
      }
    ]

    const connectivity: ConnectivitySpec = {
      wifi: {
        standard: 'Wi-Fi 5 (802.11ac)',
        supportedFrequenciesGhz: [2.4, 5.0],
        wifiDirect: true,
        hotspot: true
      },
      bluetooth: {
        version: '5.1',
        lowEnergySupported: true,
        profiles: ['A2DP', 'AVRCP', 'DI', 'HFP', 'HID', 'HOGP', 'HSP', 'MAP', 'OPP', 'PAN', 'PBAP']
      },
      nfc: {
        supported: true,
        secureElementSupported: true,
        status: CapabilityStatus.SUPPORTED
      },
      cellular: {
        generation: '5G Sub6',
        supportedBands: ['n1', 'n3', 'n5', 'n7', 'n8', 'n20', 'n28', 'n38', 'n40', 'n41', 'n66', 'n78'],
        dualSim: true,
        volteSupported: true,
        vowifiSupported: true,
        eSimSupported: false
      },
      gnss: {
        constellations: ['GPS', 'GLONASS', 'GALILEO', 'BEIDOU', 'QZSS'],
        assistedGps: true
      },
      usb: {
        connector: 'USB-C',
        version: 'USB 2.0',
        otgSupported: true
      }
    }

    const softwareSpec: SoftwareConfigSpec = {
      androidVersion: androidVer,
      apiLevel: apiLvl,
      oneUiVersion: oneUiVer,
      locale: 'en_US',
      localesSupported: ['en_US', 'en_GB', 'es_ES', 'fr_FR', 'de_DE', 'bn_BD', 'hi_IN', 'ja_JP'],
      timezone: 'America/New_York',
      fontScale: 1.0,
      keyboardLayout: 'Samsung English (US)',
      browserCompatibility: {
        samsungInternetVersion: '28.0.0.45',
        chromeVersion: '138.0.7000.80',
        userAgentSamsungInternet: `Mozilla/5.0 (Linux; Android ${androidVer}; SM-A336E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/138.0.7000.80 Mobile Safari/537.36`,
        userAgentChrome: `Mozilla/5.0 (Linux; Android ${androidVer}; SM-A336E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7000.80 Mobile Safari/537.36`
      },
      systemApps: SoftwareConfiguration.createDefaultSamsungApps(oneUiVer)
    }

    const synthIds = options.identifiers ?? SyntheticIdentifierGenerator.generate('a33')
    const finalProfileId = options.profileId ?? synthIds.profileId

    super(
      finalProfileId,
      'Galaxy A33 5G',
      'a33x',
      'a33xx',
      androidBuild,
      displayMetrics,
      hardwareSpec,
      cameras,
      sensors,
      connectivity,
      softwareSpec,
      synthIds
    )
  }
}
