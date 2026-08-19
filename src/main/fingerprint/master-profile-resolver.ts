// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Master Profile Model & Canonical Resolver
// Single authoritative source of truth for resolved browser profiles.
// Unifies Chromium & Firefox profiles across all supported OS & device targets.
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import {
  OSType,
  OSFamily,
  getOSFamily,
  Fingerprint,
  createDefaultFingerprint,
  NavigatorFingerprint,
  ScreenFingerprint,
  WebGLFingerprint,
  FontsFingerprint,
  MediaDevicesFingerprint,
  BatteryFingerprint,
  NetworkInfoFingerprint
} from './types'
import {
  DeviceTemplate,
  getDeviceTemplateById,
  getDefaultDeviceTemplate
} from './device-templates'
import {
  getEngineForBrowser,
  buildConsistentUA,
  getNavigatorVendor,
  getNavigatorPlatform,
  buildAppVersion,
  validateBrowserCompat
} from './browser-compat-matrix'
import { getDeviceById, ANDROID_DEVICES, AndroidDeviceSpec } from './android-devices'
import { getIosDeviceById, IOS_DEVICES, IosDeviceSpec } from './ios-devices'
import { SeededRandom } from './generator'
import fontListsData from './datasets/font-lists.json'

export interface MasterProfileInput {
  profileId?: string
  name?: string
  osType: OSType
  browserType: 'chrome' | 'firefox'
  browserVersion: string
  deviceTemplateId?: string
  deviceModelId?: string
  seed?: string
  existingFingerprint?: Partial<Fingerprint>
  proxy?: {
    type?: string
    host?: string
    port?: number
    username?: string
    password?: string
  } | null
  customOverrides?: {
    language?: string
    languages?: string[]
    timezone?: string
    latitude?: number
    longitude?: number
    accuracy?: number
    webrtcMode?: string
  }
}

export interface MasterResolvedProfile {
  profileId: string
  name: string
  operatingSystem: OSType
  osFamily: OSFamily
  browserType: 'chrome' | 'firefox'
  browserEngine: 'blink' | 'gecko' | 'webkit'
  browserVersion: string
  majorBrowserVersion: string
  deviceTemplateId: string
  deviceModel: string
  deviceManufacturer: string
  platform: string
  userAgent: string
  appVersion: string
  oscpu: string
  screenWidth: number
  screenHeight: number
  availScreenWidth: number
  availScreenHeight: number
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  touchSupport: boolean
  maxTouchPoints: number
  hardwareConcurrency: number
  deviceMemory: number
  gpuVendor: string
  gpuRenderer: string
  unmaskedVendor: string
  unmaskedRenderer: string
  language: string
  languages: string[]
  timezone: string
  geolocation: {
    latitude: number
    longitude: number
    accuracy: number
  }
  webrtcMode: string
  proxyConfig: {
    enabled: boolean
    type: string
    host: string
    port: number
    hasAuth: boolean
  }
  fingerprint: Fingerprint
  resolvedAt: string
}

/**
 * Resolves an authoritative, completely coherent MasterResolvedProfile
 * without any cross-engine or cross-OS token pollution.
 */
export function resolveMasterProfile(input: MasterProfileInput): MasterResolvedProfile {
  const osType = input.osType || 'macos-arm'
  const osFamily = getOSFamily(osType)
  const isMobile = osFamily === 'android' || osFamily === 'ios'
  const isIos = osFamily === 'ios'
  const isAndroid = osFamily === 'android'
  const isMac = osFamily === 'macos'
  const isWindows = osFamily === 'windows'
  const isLinux = osFamily === 'linux'

  const browserType: 'chrome' | 'firefox' = input.browserType === 'firefox' ? 'firefox' : 'chrome'
  const defaultVer = browserType === 'firefox' ? '129.0' : '128.0.6613.120'
  const browserVersion = (input.browserVersion && input.browserVersion.trim()) || defaultVer
  const majorBrowserVersion = browserVersion.split('.')[0] || (browserType === 'firefox' ? '129' : '128')
  const engine = getEngineForBrowser(osType, browserType)

  const seed = input.seed || (input.existingFingerprint as any)?.seed || crypto.randomBytes(16).toString('hex')
  const rng = new SeededRandom(seed)

  // 1. Resolve Device Template & Model
  let template: DeviceTemplate | null = null
  let iosDev: IosDeviceSpec | null = null
  let androidDev: AndroidDeviceSpec | null = null

  if (input.deviceTemplateId) {
    template = getDeviceTemplateById(input.deviceTemplateId)
  }

  if (isIos) {
    iosDev = (input.deviceModelId ? getIosDeviceById(input.deviceModelId) : null) || IOS_DEVICES[0]
  } else if (isAndroid) {
    androidDev = (input.deviceModelId ? getDeviceById(input.deviceModelId) : null) || ANDROID_DEVICES[0]
  }

  if (!template) {
    template = getDefaultDeviceTemplate(osType)
  }

  const deviceModel = isIos
    ? (iosDev?.modelName || 'iPhone 15 Pro')
    : isAndroid
    ? (androidDev?.modelName || 'Samsung Galaxy S24 Ultra')
    : (template?.model || (isMac ? 'MacBook Pro (Apple Silicon)' : isWindows ? 'Custom Desktop PC' : 'Linux Workstation'))

  const deviceManufacturer = isIos
    ? 'Apple'
    : isAndroid
    ? (androidDev?.brand || 'Samsung')
    : (template?.manufacturer || (isMac ? 'Apple' : isWindows ? 'Microsoft' : 'Generic'))

  // 2. Resolve Platform & OSCPU
  const platform = isIos ? 'iPhone' : isAndroid ? 'Linux armv8l' : isWindows ? 'Win32' : isLinux ? 'Linux x86_64' : 'MacIntel'
  const oscpu = isWindows
    ? 'Windows NT 10.0; Win64; x64'
    : isMac
    ? 'Intel Mac OS X 10.15'
    : isLinux
    ? 'Linux x86_64'
    : isIos
    ? `CPU iPhone OS ${(iosDev?.iosVersion || '18.0').replace('.', '_')} like Mac OS X`
    : 'Linux armv8l'

  // 3. Resolve User-Agent Strictly Without Contradicting Tokens
  const userAgent = buildConsistentUA({
    osType,
    browserType,
    browserVersion,
    deviceModel: isIos ? (iosDev?.id || 'iphone-15-pro') : isAndroid ? (androidDev?.modelCode || 'SM-S928B') : undefined,
    osVersion: isIos ? iosDev?.iosVersion : isAndroid ? androidDev?.androidVersion : undefined
  })

  const appVersion = buildAppVersion(userAgent)
  const vendor = isIos ? 'Apple Computer, Inc.' : browserType === 'firefox' ? '' : 'Google Inc.'

  // 4. Resolve Hardware (CPU / RAM)
  const hardwareConcurrency = isIos
    ? (iosDev?.cpuCores || 6)
    : isAndroid
    ? (androidDev?.cores || 8)
    : template?.cpuThreads || (isMac ? 8 : 8)

  const deviceMemory = isIos
    ? (iosDev?.memory || 8)
    : isAndroid
    ? (androidDev?.memory || 12)
    : template?.memoryGB || (isMac ? 16 : 16)

  // 5. Resolve Display & Screen Metrics
  const screenWidth = isIos
    ? (iosDev?.screenWidth || 393)
    : isAndroid
    ? (androidDev?.screenWidth || 412)
    : template?.screenWidth || (isMac ? 1512 : 1920)

  const screenHeight = isIos
    ? (iosDev?.screenHeight || 852)
    : isAndroid
    ? (androidDev?.screenHeight || 915)
    : template?.screenHeight || (isMac ? 982 : 1080)

  const taskbarHeight = isMobile ? 0 : (isMac ? 25 : isLinux ? 27 : 40)
  const availScreenWidth = screenWidth
  const availScreenHeight = isMobile ? screenHeight : Math.max(600, screenHeight - taskbarHeight)
  const viewportWidth = screenWidth
  const viewportHeight = isMobile ? Math.floor(screenHeight * 0.9) : availScreenHeight
  const devicePixelRatio = isIos ? (iosDev?.dpr || 3) : isAndroid ? (androidDev?.dpr || 3) : isMac ? 2 : (template?.devicePixelRatio || 1)
  const touchSupport = isMobile
  const maxTouchPoints = isMobile ? 5 : 0

  // 6. Resolve WebGL & GPU
  let gpuVendor = isWindows ? 'NVIDIA' : isMac ? 'Apple' : isLinux ? 'Intel' : isIos ? 'Apple Inc.' : (androidDev?.gpuVendor || 'ARM')
  let gpuRenderer = isWindows
    ? 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    : isMac
    ? (osType === 'macos-arm' ? 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)' : 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)')
    : isIos
    ? (iosDev?.gpuRenderer || 'Apple GPU')
    : isAndroid
    ? (androidDev?.gpuRenderer || 'Mali-G720 Immortalis')
    : 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)'

  let unmaskedVendor = isWindows
    ? 'Google Inc. (NVIDIA)'
    : isMac
    ? (osType === 'macos-arm' ? 'Google Inc. (Apple)' : 'Google Inc. (Intel)')
    : isIos
    ? 'Apple Inc.'
    : isAndroid
    ? (androidDev?.gpuVendor || 'ARM')
    : 'Google Inc. (Intel)'

  let unmaskedRenderer = gpuRenderer

  if (template?.webglProfile) {
    unmaskedVendor = template.webglProfile.unmaskedVendor || unmaskedVendor
    unmaskedRenderer = template.webglProfile.unmaskedRenderer || unmaskedRenderer
    gpuVendor = template.gpuVendor || gpuVendor
    gpuRenderer = template.gpuModel || gpuRenderer
  }

  // 7. Resolve Locale, Timezone, Geolocation
  const language = input.customOverrides?.language || 'en-US'
  const languages = input.customOverrides?.languages && input.customOverrides.languages.length > 0
    ? input.customOverrides.languages
    : ['en-US', 'en']
  const timezone = input.customOverrides?.timezone || 'America/New_York'
  const geolocation = {
    latitude: input.customOverrides?.latitude ?? 40.7128,
    longitude: input.customOverrides?.longitude ?? -74.006,
    accuracy: input.customOverrides?.accuracy ?? 50
  }
  const webrtcMode = input.customOverrides?.webrtcMode || 'real'

  // 8. Resolve Proxy Info
  const proxyConfig = {
    enabled: !!(input.proxy && input.proxy.host && input.proxy.type !== 'direct'),
    type: input.proxy?.type || 'direct',
    host: input.proxy?.host || '',
    port: input.proxy?.port || 0,
    hasAuth: !!(input.proxy?.username && input.proxy?.password)
  }

  // 9. Build Coherent Master Fingerprint
  const fontList = (fontListsData as any)[osFamily] || (fontListsData as any)['windows'] || ['Segoe UI', 'Arial', 'Tahoma']

  const fingerprint: Fingerprint = {
    version: 3,
    generatedAt: new Date().toISOString(),
    seed,
    osType,
    browser: {
      name: browserType === 'firefox' ? 'Firefox' : 'Chrome',
      type: browserType,
      version: browserVersion,
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
    },
    navigator: {
      userAgent,
      browserVersion,
      chromiumVersion: browserType === 'firefox' ? majorBrowserVersion : majorBrowserVersion,
      platform,
      vendor,
      vendorSub: '',
      product: 'Gecko',
      productSub: browserType === 'firefox' ? '20100101' : '20030107',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion,
      hardwareConcurrency,
      deviceMemory,
      cpuArchitecture: isIos || isAndroid || osType === 'macos-arm' ? 'arm64' : 'x86_64',
      platformArchitecture: isIos || isAndroid || osType === 'macos-arm' ? 'arm64' : 'x86_64',
      maxTouchPoints,
      touchSupport,
      pdfViewerEnabled: !isMobile && browserType === 'chrome',
      webdriver: false,
      doNotTrack: null,
      cookieEnabled: true,
      javaEnabled: false,
      localStorageEnabled: true,
      sessionStorageEnabled: true,
      indexedDBEnabled: true,
      webSQLEnabled: false,
      ...(isIos ? { deviceBrand: 'Apple', deviceModel, deviceModelCode: iosDev?.id } : {}),
      ...(isAndroid ? { deviceBrand: androidDev?.brand, deviceModel, deviceModelCode: androidDev?.modelCode } : {})
    },
    screen: {
      width: screenWidth,
      height: screenHeight,
      availWidth: availScreenWidth,
      availHeight: availScreenHeight,
      colorDepth: isIos ? 32 : 24,
      pixelDepth: isIos ? 32 : 24,
      devicePixelRatio,
      orientation: isMobile ? 'portrait-primary' : 'landscape-primary',
      orientationAngle: 0,
      viewportWidth,
      viewportHeight,
      outerWidth: screenWidth,
      outerHeight: screenHeight,
      screenX: 0,
      screenY: 0,
      isMultiMonitor: false,
      isPrimaryDisplay: true
    },
    webgl: {
      enabled: true,
      version: 'WebGL 2.0',
      vendor: isIos ? 'Apple Inc.' : isAndroid ? 'WebKit' : 'WebKit',
      renderer: isIos ? (iosDev?.gpuRenderer || 'Apple GPU') : 'WebKit WebGL',
      unmaskedVendor,
      unmaskedRenderer,
      maxTextureSize: 16384,
      maxViewportDims: [16384, 16384],
      maxRenderbufferSize: 16384,
      shadingLanguageVersion: `WebGL GLSL ES 3.00 (${browserType === 'firefox' ? 'OpenGL ES GLSL ES 3.0 Firefox' : 'OpenGL ES GLSL ES 3.0 Chromium'})`,
      extensions: [],
      antialiasing: true,
      gpuVendor,
      gpuRenderer,
      driverInfo: ''
    },
    locale: {
      language,
      languages,
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
      mode: 'auto',
      timezone,
      utcOffset: -300,
      hasDST: true,
      dstOffset: 60
    },
    geolocation: {
      mode: 'ask',
      latitude: geolocation.latitude,
      longitude: geolocation.longitude,
      accuracy: geolocation.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      permissionState: 'prompt'
    },
    webrtc: {
      mode: webrtcMode as any,
      ipPolicy: webrtcMode === 'disabled' ? 'disable_non_proxied_udp' : 'default_public_interface_only',
      localIP: '',
      publicIP: ''
    },
    canvas: {
      mode: 'noise',
      noiseSeed: rng.int(100000, 999999)
    },
    audio: {
      mode: 'noise',
      noiseSeed: rng.int(100000, 999999),
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
      noiseSeed: rng.int(100000, 999999)
    },
    fonts: {
      enableMasking: true,
      mode: 'automatic',
      fontList: [...fontList]
    },
    mediaDevices: {
      videoInputs: isMobile ? 2 : 1,
      audioInputs: 1,
      audioOutputs: isMobile ? 1 : 2,
      cameraLabels: isMobile ? ['camera2 0, facing back', 'camera2 1, facing front'] : ['Integrated HD Camera'],
      microphoneLabels: ['Default Microphone'],
      speakerLabels: ['Default Speaker'],
      deviceIds: [rng.hex(64), rng.hex(64), rng.hex(64)]
    },
    battery: {
      enabled: isMobile || isMac,
      charging: true,
      level: 0.92,
      chargingTime: 0,
      dischargingTime: Infinity
    },
    networkInfo: {
      effectiveType: '4g',
      downlink: isMobile ? 15 : 100,
      rtt: isMobile ? 50 : 20,
      saveData: false,
      type: isMobile ? 'cellular' : 'wifi'
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
    }
  }

  return {
    profileId: input.profileId || `prof-${Date.now()}`,
    name: input.name || 'Default Profile',
    operatingSystem: osType,
    osFamily,
    browserType,
    browserEngine: engine,
    browserVersion,
    majorBrowserVersion,
    deviceTemplateId: template.deviceId,
    deviceModel,
    deviceManufacturer,
    platform,
    userAgent,
    appVersion,
    oscpu,
    screenWidth,
    screenHeight,
    availScreenWidth,
    availScreenHeight,
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    touchSupport,
    maxTouchPoints,
    hardwareConcurrency,
    deviceMemory,
    gpuVendor,
    gpuRenderer,
    unmaskedVendor,
    unmaskedRenderer,
    language,
    languages,
    timezone,
    geolocation,
    webrtcMode,
    proxyConfig,
    fingerprint,
    resolvedAt: new Date().toISOString()
  }
}
