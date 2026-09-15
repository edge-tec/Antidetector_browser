/**
 * Core type definitions for the Samsung Device Profile & Android Compatibility Layer.
 * Designed for QA, automated testing, and developer compatibility validation.
 */

/**
 * Explicit capability status to guarantee compliance with security and privacy boundaries.
 * Informs developers and test runners whether a feature is genuine, simulated, or requires hardware.
 */
export enum CapabilityStatus {
  /** Feature is natively supported by the runtime environment */
  SUPPORTED = 'SUPPORTED',
  /** Feature is not available on the current platform or environment */
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  /** Feature is deterministically simulated for QA/testing purposes only */
  SIMULATED_FOR_TESTING = 'SIMULATED_FOR_TESTING',
  /** Feature relies on genuine hardware (e.g. Knox Vault, StrongBox, hardware keystore) */
  REQUIRES_REAL_HARDWARE = 'REQUIRES_REAL_HARDWARE'
}

/**
 * Screen orientation enum matching Android Configuration
 */
export enum ScreenOrientation {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE',
  REVERSE_PORTRAIT = 'REVERSE_PORTRAIT',
  REVERSE_LANDSCAPE = 'REVERSE_LANDSCAPE'
}

/**
 * Display Cutout / Notch geometry specification
 */
export interface DisplayCutoutSpec {
  hasCutout: boolean
  type: 'PUNCH_HOLE' | 'WATERDROP' | 'NONE'
  position: 'CENTER' | 'LEFT' | 'RIGHT' | 'NONE'
  safeInsetTop: number
  safeInsetBottom: number
  safeInsetLeft: number
  safeInsetRight: number
  radius: number
}

/**
 * Display metrics matching Android DisplayMetrics & Configuration
 */
export interface DisplayMetricsSpec {
  widthPixels: number
  heightPixels: number
  density: number
  densityDpi: number
  scaledDensity: number
  xdpi: number
  ydpi: number
  refreshRate: number
  supportedRefreshRates: number[]
  diagonalInches: number
  panelType: 'SUPER_AMOLED' | 'DYNAMIC_AMOLED' | 'IPS_LCD' | 'TFT'
  hdrSupported: boolean
  colorGamut: 'DCI-P3' | 'sRGB'
  multiTouchPoints: number
  orientation: ScreenOrientation
  cutout: DisplayCutoutSpec
}

/**
 * Camera lens facing matching Android CameraMetadata.LENS_FACING
 */
export enum LensFacing {
  BACK = 0,
  FRONT = 1,
  EXTERNAL = 2
}

/**
 * Individual Camera spec matching Android CameraCharacteristics
 */
export interface CameraSpec {
  cameraId: string
  facing: LensFacing
  label: string
  sensorResolutionMp: number
  activeArrayWidth: number
  activeArrayHeight: number
  focalLengthMm: number
  apertureFNumber: number
  hasAutofocus: boolean
  hasOpticalStabilization: boolean
  hasFlash: boolean
  hasHdr: boolean
  supportedImageFormats: string[]
  supportedVideoResolutions: Array<{
    width: number
    height: number
    maxFps: number
    label: string
  }>
}

/**
 * Android standard sensor types
 */
export enum SensorType {
  ACCELEROMETER = 1,
  MAGNETIC_FIELD = 2,
  ORIENTATION = 3,
  GYROSCOPE = 4,
  LIGHT = 5,
  PRESSURE = 6,
  PROXIMITY = 8,
  GRAVITY = 9,
  LINEAR_ACCELERATION = 10,
  ROTATION_VECTOR = 11,
  RELATIVE_HUMIDITY = 12,
  AMBIENT_TEMPERATURE = 13,
  STEP_DETECTOR = 18,
  STEP_COUNTER = 19,
  GEOMAGNETIC_ROTATION_VECTOR = 20,
  HEART_RATE = 21
}

/**
 * Individual sensor specification matching Android Sensor class
 */
export interface SensorSpec {
  type: SensorType
  name: string
  vendor: string
  version: number
  maximumRange: number
  resolution: number
  powerMa: number
  minDelayUs: number
  maxDelayUs: number
  isWakeUpSensor: boolean
  status: CapabilityStatus
}

/**
 * Connectivity options and cellular/Wi-Fi specifications
 */
export interface ConnectivitySpec {
  wifi: {
    standard: 'Wi-Fi 5 (802.11ac)' | 'Wi-Fi 6 (802.11ax)' | 'Wi-Fi 6E' | 'Wi-Fi 7'
    supportedFrequenciesGhz: number[]
    wifiDirect: boolean
    hotspot: boolean
  }
  bluetooth: {
    version: string
    lowEnergySupported: boolean
    profiles: string[]
  }
  nfc: {
    supported: boolean
    secureElementSupported: boolean
    status: CapabilityStatus
  }
  cellular: {
    generation: '4G LTE' | '5G Sub6' | '5G mmWave'
    supportedBands: string[]
    dualSim: boolean
    volteSupported: boolean
    vowifiSupported: boolean
    eSimSupported: boolean
  }
  gnss: {
    constellations: Array<'GPS' | 'GLONASS' | 'GALILEO' | 'BEIDOU' | 'QZSS'>
    assistedGps: boolean
  }
  usb: {
    connector: 'USB-C'
    version: 'USB 2.0' | 'USB 3.2 Gen 1'
    otgSupported: boolean
  }
}

/**
 * Hardware specifications (CPU, RAM, Storage, Battery)
 */
export interface HardwareSpec {
  socModel: string
  socVendor: 'Samsung' | 'MediaTek' | 'Qualcomm'
  cpuArchitecture: 'arm64-v8a' | 'armeabi-v7a'
  supportedAbis: string[]
  coreCount: number
  coreClusters: Array<{
    type: 'efficiency' | 'performance'
    count: number
    maxFrequencyMhz: number
  }>
  gpuModel: string
  gpuVendor: 'ARM' | 'Qualcomm' | 'Samsung'
  ramBytes: number
  ramGb: number
  storageBytes: number
  storageGb: number
  storageTechnology: 'UFS 2.2' | 'UFS 3.1' | 'eMMC 5.1'
  battery: {
    capacityMah: number
    fastChargingWattage: number
    wirelessCharging: boolean
    reverseCharging: boolean
  }
}

/**
 * Android build metadata matching android.os.Build
 */
export interface AndroidBuildSpec {
  brand: string
  manufacturer: string
  model: string
  device: string
  product: string
  board: string
  hardware: string
  bootloader: string
  androidVersion: string
  apiLevel: number
  buildId: string
  buildTags: 'release-keys' | 'test-keys'
  securityPatchDate: string
  fingerprint: string
  oneUiVersion?: string
}

/**
 * Synthetic test identifiers. Every identifier is explicitly marked synthetic
 * to strictly prevent usage or impersonation of real hardware credentials.
 */
export interface SyntheticIdentifiers {
  isSynthetic: true
  type: 'synthetic-test-profile'
  profileId: string
  testDeviceId: string
  syntheticSessionId: string
  installationId: string
  syntheticSimId: string
  generatedAt: string
}

/**
 * Complete, serializable JSON format of a Samsung Device Profile
 */
export interface SamsungDeviceProfileJson {
  profileId: string
  manufacturer: string
  brand: string
  model: string
  deviceCodename: string
  productName: string
  createdAt: string
  updatedAt: string
  enabled: boolean
  android: AndroidBuildSpec
  display: DisplayMetricsSpec
  hardware: HardwareSpec
  cameras: CameraSpec[]
  sensors: SensorSpec[]
  connectivity: ConnectivitySpec
  identifiers: SyntheticIdentifiers
  capabilities: Record<string, CapabilityStatus>
}
