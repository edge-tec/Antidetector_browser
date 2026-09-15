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

export interface GalaxyA16ProfileOptions {
  profileId?: string
  ramGb?: 4 | 6 | 8
  storageGb?: 128 | 256
  androidVersion?: '14' | '15'
  apiLevel?: 34 | 35
  oneUiVersion?: '6.1' | '7.0'
  identifiers?: SyntheticIdentifiers
}

/**
 * Concrete Profile definition for Samsung Galaxy A16 (SM-A165F/DS)
 */
export class GalaxyA16Profile extends SamsungDeviceProfile {
  constructor(options: GalaxyA16ProfileOptions = {}) {
    const androidVer = options.androidVersion ?? '15'
    const apiLvl = options.apiLevel ?? (androidVer === '15' ? 35 : 34)
    const oneUiVer = options.oneUiVersion ?? '7.0'
    const ram = options.ramGb ?? 6
    const storage = options.storageGb ?? 128

    const buildId = androidVer === '15' ? 'AP3A.240905.015' : 'UP1A.231005.007'
    const bootloader = 'A165FXXU1AXK2'
    const fingerprint = `samsung/a16xx/a16x:${androidVer}/${buildId}/${bootloader}:user/release-keys`

    const androidBuild: AndroidBuildSpec = {
      brand: 'samsung',
      manufacturer: 'samsung',
      model: 'SM-A165F',
      device: 'a16x',
      product: 'a16xx',
      board: 'exynos1330',
      hardware: 'exynos1330',
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
      heightPixels: 2340,
      density: 2.625,
      densityDpi: 420,
      scaledDensity: 2.625,
      xdpi: 385.0,
      ydpi: 385.0,
      refreshRate: 90,
      supportedRefreshRates: [60, 90],
      diagonalInches: 6.7,
      panelType: 'SUPER_AMOLED',
      hdrSupported: false,
      colorGamut: 'DCI-P3',
      multiTouchPoints: 10,
      orientation: ScreenOrientation.PORTRAIT,
      cutout: {
        hasCutout: true,
        type: 'WATERDROP',
        position: 'CENTER',
        safeInsetTop: 80,
        safeInsetBottom: 0,
        safeInsetLeft: 0,
        safeInsetRight: 0,
        radius: 28
      }
    }

    const hardwareSpec: HardwareSpec = {
      socModel: 'Samsung Exynos 1330',
      socVendor: 'Samsung',
      cpuArchitecture: 'arm64-v8a',
      supportedAbis: ['arm64-v8a', 'armeabi-v7a', 'armeabi'],
      coreCount: 8,
      coreClusters: [
        { type: 'performance', count: 2, maxFrequencyMhz: 2400 },
        { type: 'efficiency', count: 6, maxFrequencyMhz: 2000 }
      ],
      gpuModel: 'Mali-G68 MP2',
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
        label: 'Wide 50MP Main',
        sensorResolutionMp: 50,
        activeArrayWidth: 8160,
        activeArrayHeight: 6120,
        focalLengthMm: 26.0,
        apertureFNumber: 1.8,
        hasAutofocus: true,
        hasOpticalStabilization: false,
        hasFlash: true,
        hasHdr: true,
        supportedImageFormats: ['JPEG', 'YUV_420_888'],
        supportedVideoResolutions: [
          { width: 1920, height: 1080, maxFps: 30, label: '1080p @ 30fps' },
          { width: 1280, height: 720, maxFps: 120, label: '720p SlowMo @ 120fps' }
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
        apertureFNumber: 2.0,
        hasAutofocus: false,
        hasOpticalStabilization: false,
        hasFlash: false,
        hasHdr: true,
        supportedImageFormats: ['JPEG', 'YUV_420_888'],
        supportedVideoResolutions: [
          { width: 1920, height: 1080, maxFps: 30, label: '1080p @ 30fps' }
        ]
      },
      {
        cameraId: '2',
        facing: LensFacing.BACK,
        label: 'Ultrawide 5MP',
        sensorResolutionMp: 5,
        activeArrayWidth: 2560,
        activeArrayHeight: 1920,
        focalLengthMm: 17.0,
        apertureFNumber: 2.2,
        hasAutofocus: false,
        hasOpticalStabilization: false,
        hasFlash: false,
        hasHdr: false,
        supportedImageFormats: ['JPEG'],
        supportedVideoResolutions: [
          { width: 1920, height: 1080, maxFps: 30, label: '1080p @ 30fps' }
        ]
      },
      {
        cameraId: '3',
        facing: LensFacing.BACK,
        label: 'Macro 2MP',
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
        name: 'Samsung Virtual Light Sensing',
        vendor: 'Samsung Electronics',
        version: 1,
        maximumRange: 60000.0,
        resolution: 1.0,
        powerMa: 0.1,
        minDelayUs: 200000,
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
        version: '5.3',
        lowEnergySupported: true,
        profiles: ['A2DP', 'AVRCP', 'HFP', 'HID', 'PAN', 'PBAP']
      },
      nfc: {
        supported: true,
        secureElementSupported: true,
        status: CapabilityStatus.SUPPORTED
      },
      cellular: {
        generation: '4G LTE',
        supportedBands: ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'B8', 'B12', 'B20', 'B28', 'B38', 'B40', 'B41'],
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
      localesSupported: ['en_US', 'en_GB', 'es_ES', 'fr_FR', 'de_DE', 'bn_BD', 'hi_IN'],
      timezone: 'America/New_York',
      fontScale: 1.0,
      keyboardLayout: 'Samsung English (US)',
      browserCompatibility: {
        samsungInternetVersion: '28.0.0.45',
        chromeVersion: '138.0.7000.80',
        userAgentSamsungInternet: `Mozilla/5.0 (Linux; Android ${androidVer}; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/138.0.7000.80 Mobile Safari/537.36`,
        userAgentChrome: `Mozilla/5.0 (Linux; Android ${androidVer}; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7000.80 Mobile Safari/537.36`
      },
      systemApps: SoftwareConfiguration.createDefaultSamsungApps(oneUiVer)
    }

    const synthIds = options.identifiers ?? SyntheticIdentifierGenerator.generate('a16')
    const finalProfileId = options.profileId ?? synthIds.profileId

    super(
      finalProfileId,
      'Galaxy A16',
      'a16x',
      'a16xx',
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
