// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Fingerprint Type Definitions
// Central type system for all 35 fingerprint subsystems
// ──────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════
// Section 2: Operating System
// ═══════════════════════════════════════════

export type OSType =
  | 'windows-10'
  | 'windows-11'
  | 'macos-intel'
  | 'macos-arm'
  | 'linux'
  | 'android'
  | 'ios'

export type OSFamily = 'windows' | 'macos' | 'linux' | 'android' | 'ios'

export type BrowserType = 'chrome' | 'firefox'

export function getOSFamily(os: OSType): OSFamily {
  if (os.startsWith('windows')) return 'windows'
  if (os.startsWith('macos')) return 'macos'
  if (os === 'linux') return 'linux'
  if (os === 'ios') return 'ios'
  return 'android'
}

export function getOSLabel(os: OSType): string {
  const labels: Record<OSType, string> = {
    'windows-10': 'Windows 10',
    'windows-11': 'Windows 11',
    'macos-intel': 'macOS (Intel)',
    'macos-arm': 'macOS (Apple Silicon)',
    'linux': 'Linux',
    'android': 'Android',
    'ios': 'iOS (iPhone)'
  }
  return labels[os] || os
}

// ═══════════════════════════════════════════
// Section 3: Navigator Fingerprint
// ═══════════════════════════════════════════

export interface NavigatorFingerprint {
  // Browser identity
  userAgent: string
  browserVersion: string
  chromiumVersion: string
  platform: string
  appCodeName: string
  appName: string
  appVersion: string
  product: string
  productSub: string
  vendor: string
  vendorSub: string

  // Hardware
  hardwareConcurrency: number   // CPU threads
  deviceMemory: number          // GB (2, 4, 8, 16, 32, 64)
  cpuArchitecture: string       // x86, x86_64, arm, arm64
  platformArchitecture: string  // 32-bit, 64-bit

  // Browser capabilities
  maxTouchPoints: number
  touchSupport: boolean
  doNotTrack: string | null     // "1", "0", null
  cookieEnabled: boolean
  pdfViewerEnabled: boolean
  javaEnabled: boolean
  webdriver: boolean            // always false for anti-detect

  // Storage support
  localStorageEnabled: boolean
  sessionStorageEnabled: boolean
  indexedDBEnabled: boolean
  webSQLEnabled: boolean
}

// ═══════════════════════════════════════════
// Section 4: Screen & Display
// ═══════════════════════════════════════════

export interface ScreenFingerprint {
  width: number
  height: number
  availWidth: number
  availHeight: number
  colorDepth: number          // 24 or 32
  pixelDepth: number          // typically matches colorDepth
  devicePixelRatio: number    // 1, 1.25, 1.5, 2, 3
  orientation: 'landscape-primary' | 'portrait-primary' | 'landscape-secondary' | 'portrait-secondary'
  orientationAngle: number    // 0, 90, 180, 270

  // Viewport
  viewportWidth: number
  viewportHeight: number

  // Window
  outerWidth: number
  outerHeight: number
  screenX: number
  screenY: number

  // Multi-monitor
  isMultiMonitor: boolean
  isPrimaryDisplay: boolean
}

// ═══════════════════════════════════════════
// Section 5: Languages & Locale
// ═══════════════════════════════════════════

export interface LocaleFingerprint {
  mode?: 'based_on_ip' | 'custom'
  language: string              // navigator.language, e.g. "en-US"
  languages: string[]           // navigator.languages, e.g. ["en-US", "en"]
  displayLanguageMode?: 'based_on_language' | 'real' | 'custom'
  displayLanguage?: string      // e.g. "en-US"
  country: string               // ISO 3166-1 alpha-2, e.g. "US"
  region: string                // e.g. "NY" (state/region)
  currency: string              // ISO 4217, e.g. "USD"
  numberFormat: string          // e.g. "en-US"
  dateFormat: string            // e.g. "M/d/yyyy"
  firstDayOfWeek: number        // 0 = Sunday, 1 = Monday
  measurementSystem: 'metric' | 'imperial'
  hourCycle: '12h' | '24h'
}

// ═══════════════════════════════════════════
// Section 6: Timezone
// ═══════════════════════════════════════════

export interface TimezoneFingerprint {
  mode: 'auto' | 'manual'      // auto = based on IP/proxy
  timezone: string              // IANA, e.g. "America/New_York"
  utcOffset: number             // minutes, e.g. -300
  hasDST: boolean
  dstOffset: number             // minutes
}

// ═══════════════════════════════════════════
// Section 7: Geolocation
// ═══════════════════════════════════════════

export type GeoMode = 'ip-based' | 'custom' | 'ask' | 'block'

export interface GeolocationFingerprint {
  mode: GeoMode
  latitude: number
  longitude: number
  accuracy: number              // meters
  altitude: number | null
  altitudeAccuracy: number | null
  heading: number | null
  speed: number | null
  permissionState: 'granted' | 'denied' | 'prompt'
}

// ═══════════════════════════════════════════
// Section 9: WebRTC
// ═══════════════════════════════════════════

export type WebRTCMode = 'real' | 'disabled' | 'manual'
export type WebRTCIPPolicy =
  | 'default'
  | 'default_public_and_private_interfaces'
  | 'default_public_interface_only'
  | 'disable_non_proxied_udp'

export interface WebRTCFingerprint {
  mode: WebRTCMode
  ipPolicy: WebRTCIPPolicy
  localIP: string               // e.g. "192.168.1.x" or empty
  publicIP: string              // e.g. matches proxy IP or empty
}

// ═══════════════════════════════════════════
// Section 10: Canvas
// ═══════════════════════════════════════════

export type CanvasMode = 'off' | 'noise' | 'block'

export interface CanvasFingerprint {
  mode: CanvasMode
  noiseSeed: number             // per-profile deterministic seed
}

// ═══════════════════════════════════════════
// Section 11: WebGL
// ═══════════════════════════════════════════

export interface WebGLFingerprint {
  enabled: boolean
  version: string               // "WebGL 1.0", "WebGL 2.0"
  vendor: string                // e.g. "Google Inc. (NVIDIA)"
  renderer: string              // e.g. "ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)"
  unmaskedVendor: string        // WEBGL_debug_renderer_info
  unmaskedRenderer: string
  maxTextureSize: number        // 4096, 8192, 16384
  maxViewportDims: [number, number]
  maxRenderbufferSize: number
  shadingLanguageVersion: string
  extensions: string[]
  antialiasing: boolean

  // GPU identity
  gpuVendor: string             // "NVIDIA", "AMD", "Intel", "Apple"
  gpuRenderer: string           // "GeForce GTX 1080", "Radeon RX 580"
  driverInfo: string
}

// ═══════════════════════════════════════════
// Section 12: AudioContext
// ═══════════════════════════════════════════

export type AudioMode = 'off' | 'noise' | 'default'

export interface AudioFingerprint {
  mode: AudioMode
  noiseSeed: number
  sampleRate: number            // 44100, 48000
  channelCount: number          // 2
  maxChannelCount: number       // 2, 6, 8
  numberOfInputs: number
  numberOfOutputs: number
  channelCountMode: 'max' | 'clamped-max' | 'explicit'
  channelInterpretation: 'speakers' | 'discrete'
}

// ═══════════════════════════════════════════
// Section 13: ClientRects
// ═══════════════════════════════════════════

export type ClientRectsMode = 'off' | 'noise'

export interface ClientRectsFingerprint {
  mode: ClientRectsMode
  noiseSeed: number
}

// ═══════════════════════════════════════════
// Section 14: Fonts
// ═══════════════════════════════════════════

export interface FontsFingerprint {
  enableMasking: boolean
  mode: 'automatic' | 'custom'
  fontList: string[]            // List of available font families
}

// ═══════════════════════════════════════════
// Section 15: Media Devices
// ═══════════════════════════════════════════

export interface MediaDevicesFingerprint {
  videoInputs: number           // number of cameras
  audioInputs: number           // number of microphones
  audioOutputs: number          // number of speakers
  cameraLabels: string[]
  microphoneLabels: string[]
  speakerLabels: string[]
  deviceIds: string[]           // generated stable IDs per profile
}

// ═══════════════════════════════════════════
// Section 16: Battery
// ═══════════════════════════════════════════

export interface BatteryFingerprint {
  enabled: boolean              // expose Battery API at all
  charging: boolean
  level: number                 // 0.0 - 1.0
  chargingTime: number          // seconds, Infinity if full
  dischargingTime: number       // seconds, Infinity if charging
}

// ═══════════════════════════════════════════
// Section 17: Network Information
// ═══════════════════════════════════════════

export interface NetworkInfoFingerprint {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
  downlink: number              // Mbps
  rtt: number                   // ms
  saveData: boolean
  type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'other'
}

// ═══════════════════════════════════════════
// Section 18: Permissions
// ═══════════════════════════════════════════

export type PermissionState = 'granted' | 'denied' | 'prompt'

export interface PermissionsFingerprint {
  camera: PermissionState
  microphone: PermissionState
  geolocation: PermissionState
  notifications: PermissionState
  clipboard: PermissionState
  midi: PermissionState
  sensors: PermissionState
  usb: PermissionState
  bluetooth: PermissionState
  backgroundSync: PermissionState
  persistentStorage: PermissionState
}

// ═══════════════════════════════════════════
// Sections 19-27: Browser Configuration
// ═══════════════════════════════════════════

export interface BrowserConfig {
  // Section 19: Storage — handled by Chromium userDataDir isolation

  // Section 20: History
  saveHistory: boolean
  clearHistoryOnDelete: boolean

  // Section 21: Password Manager
  savePasswords: boolean

  // Section 22: Extensions — stored in separate table

  // Section 24: Google Services
  googleServicesEnabled: boolean
  safeBrowsing: boolean
  spellCheck: boolean
  backgroundServices: boolean

  // Section 25: System Extensions
  systemExtensionsEnabled: boolean

  // Section 26: Start URLs
  startUrlMode: 'new-tab' | 'previous-tabs' | 'custom'
  startUrls: string[]

  // Section 27: Launch Arguments
  customLaunchArgs: string[]

  // Section 28: Custom DNS
  dnsMode: 'system' | 'custom'
  primaryDns: string
  secondaryDns: string
}

// ═══════════════════════════════════════════
// Complete Fingerprint (all sections combined)
// ═══════════════════════════════════════════

export interface Fingerprint {
  version: number               // schema version for migrations
  generatedAt: string           // ISO date
  seed: string                  // master seed for reproducible noise

  navigator: NavigatorFingerprint
  screen: ScreenFingerprint
  locale: LocaleFingerprint
  timezone: TimezoneFingerprint
  geolocation: GeolocationFingerprint
  webrtc: WebRTCFingerprint
  canvas: CanvasFingerprint
  webgl: WebGLFingerprint
  audio: AudioFingerprint
  clientRects: ClientRectsFingerprint
  fonts: FontsFingerprint
  mediaDevices: MediaDevicesFingerprint
  battery: BatteryFingerprint
  networkInfo: NetworkInfoFingerprint
  permissions: PermissionsFingerprint
  browser: BrowserConfig
}

// ═══════════════════════════════════════════
// Section 29: Profile Lock
// ═══════════════════════════════════════════

export interface ProfileLock {
  locked: boolean
  deviceId: string | null
  lockedAt: string | null
  expiresAt: string | null
}

// ═══════════════════════════════════════════
// Section 31: Consistency Engine Types
// ═══════════════════════════════════════════

export type ConsistencyStatus = 'pass' | 'warn' | 'fail'

export interface ConsistencyCheck {
  id: string                    // unique check ID
  category: string              // e.g. "OS ↔ User-Agent"
  left: string                  // what's being compared (left side)
  right: string                 // what's being compared (right side)
  status: ConsistencyStatus
  message: string
  severity: number              // 1-10 (10 = critical)
}

export interface ConsistencyResult {
  score: number                 // 0-100
  totalChecks: number
  passedChecks: number
  warnings: number
  failures: number
  checks: ConsistencyCheck[]
}

// ═══════════════════════════════════════════
// Section 32: Profile Templates
// ═══════════════════════════════════════════

export interface ProfileTemplate {
  id: string
  name: string
  osType: OSType
  description: string
  fingerprint: Fingerprint
  isBuiltin: boolean
  createdAt: string
}

// ═══════════════════════════════════════════
// Section 33: Profile Stability
// ═══════════════════════════════════════════

export type StabilityWarningLevel = 'safe' | 'caution' | 'danger'

export const CORE_FINGERPRINT_FIELDS: (keyof Fingerprint)[] = [
  'navigator', 'screen', 'webgl', 'canvas', 'audio', 'fonts'
]

export interface StabilityWarning {
  field: string
  level: StabilityWarningLevel
  message: string
}

// ═══════════════════════════════════════════
// Default factory for a blank fingerprint
// ═══════════════════════════════════════════

export function createDefaultFingerprint(): Fingerprint {
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    seed: '',

    navigator: {
      userAgent: '',
      browserVersion: '',
      chromiumVersion: '',
      platform: '',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '',
      product: 'Gecko',
      productSub: '20030107',
      vendor: 'Google Inc.',
      vendorSub: '',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      cpuArchitecture: 'x86_64',
      platformArchitecture: '64-bit',
      maxTouchPoints: 0,
      touchSupport: false,
      doNotTrack: null,
      cookieEnabled: true,
      pdfViewerEnabled: true,
      javaEnabled: false,
      webdriver: false,
      localStorageEnabled: true,
      sessionStorageEnabled: true,
      indexedDBEnabled: true,
      webSQLEnabled: false
    },

    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: 1,
      orientation: 'landscape-primary',
      orientationAngle: 0,
      viewportWidth: 1920,
      viewportHeight: 969,
      outerWidth: 1920,
      outerHeight: 1040,
      screenX: 0,
      screenY: 0,
      isMultiMonitor: false,
      isPrimaryDisplay: true
    },

    locale: {
      language: 'en-US',
      languages: ['en-US', 'en'],
      country: 'US',
      region: '',
      currency: 'USD',
      numberFormat: 'en-US',
      dateFormat: 'M/d/yyyy',
      firstDayOfWeek: 0,
      measurementSystem: 'imperial',
      hourCycle: '12h'
    },

    timezone: {
      mode: 'manual',
      timezone: 'America/New_York',
      utcOffset: -300,
      hasDST: true,
      dstOffset: 60
    },

    geolocation: {
      mode: 'ask',
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 50,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      permissionState: 'prompt'
    },

    webrtc: {
      mode: 'real',
      ipPolicy: 'default_public_interface_only',
      localIP: '',
      publicIP: ''
    },

    canvas: {
      mode: 'noise',
      noiseSeed: 0
    },

    webgl: {
      enabled: true,
      version: 'WebGL 2.0',
      vendor: 'WebKit',
      renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384,
      maxViewportDims: [32767, 32767],
      maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)',
      extensions: [],
      antialiasing: true,
      gpuVendor: 'NVIDIA',
      gpuRenderer: 'GeForce GTX 1080',
      driverInfo: ''
    },

    audio: {
      mode: 'noise',
      noiseSeed: 0,
      sampleRate: 44100,
      channelCount: 2,
      maxChannelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCountMode: 'max',
      channelInterpretation: 'speakers'
    },

    clientRects: {
      mode: 'noise',
      noiseSeed: 0
    },

    fonts: {
      enableMasking: true,
      mode: 'automatic',
      fontList: []
    },

    mediaDevices: {
      videoInputs: 1,
      audioInputs: 1,
      audioOutputs: 1,
      cameraLabels: ['Integrated Camera'],
      microphoneLabels: ['Default'],
      speakerLabels: ['Default'],
      deviceIds: []
    },

    battery: {
      enabled: false,
      charging: true,
      level: 1.0,
      chargingTime: 0,
      dischargingTime: Infinity
    },

    networkInfo: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      type: 'wifi'
    },

    permissions: {
      camera: 'prompt',
      microphone: 'prompt',
      geolocation: 'prompt',
      notifications: 'prompt',
      clipboard: 'prompt',
      midi: 'prompt',
      sensors: 'prompt',
      usb: 'prompt',
      bluetooth: 'prompt',
      backgroundSync: 'prompt',
      persistentStorage: 'prompt'
    },

    browser: {
      saveHistory: true,
      clearHistoryOnDelete: true,
      savePasswords: false,
      googleServicesEnabled: false,
      safeBrowsing: false,
      spellCheck: true,
      backgroundServices: false,
      systemExtensionsEnabled: false,
      startUrlMode: 'new-tab',
      startUrls: [],
      customLaunchArgs: [],
      dnsMode: 'system',
      primaryDns: '',
      secondaryDns: ''
    }
  }
}
