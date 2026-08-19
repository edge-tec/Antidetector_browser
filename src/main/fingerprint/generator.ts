// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Fingerprint Generator & Recalculation Engine
// Generates coherent, consistent fingerprints following the cascade:
//   OS → Device Template → Browser Engine → Hardware → Display → Locale → Network → Validate
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import {
  OSType, OSFamily, getOSFamily,
  Fingerprint, NavigatorFingerprint, ScreenFingerprint,
  LocaleFingerprint, TimezoneFingerprint, GeolocationFingerprint,
  WebRTCFingerprint, CanvasFingerprint, WebGLFingerprint,
  AudioFingerprint, ClientRectsFingerprint, FontsFingerprint,
  MediaDevicesFingerprint, BatteryFingerprint, NetworkInfoFingerprint,
  PermissionsFingerprint, BrowserConfig, ProfileTemplate,
  DeviceSelection, ResolvedRuntimeProfile,
  createDefaultFingerprint
} from './types'
import { validateConsistency } from './consistency'
import { ANDROID_DEVICES, AndroidDeviceSpec, getDeviceById as getAndroidDeviceById } from './android-devices'
import { IOS_DEVICES, IosDeviceSpec, getIosDeviceById, generateIosUserAgent } from './ios-devices'
import { resolveDeviceProfile, resolveLegacyProfile } from './resolvers'
import {
  ALL_DEVICE_TEMPLATES, getDeviceTemplateById, getDeviceTemplatesByOs,
  getDeviceTemplatesGrouped, getDefaultDeviceTemplate, findBestMatchingTemplate
} from './device-templates'

// Import curated datasets
import userAgentsData from './datasets/user-agents.json'
import gpuModelsData from './datasets/gpu-models.json'
import fontListsData from './datasets/font-lists.json'
import screenConfigsData from './datasets/screen-configs.json'
import localeProfilesData from './datasets/locale-profiles.json'

// ═══════════════════════════════════════════
// Seeded Random Number Generator
// ═══════════════════════════════════════════

export class SeededRandom {
  private seed: number

  constructor(seedStr: string) {
    let h = 0
    for (let i = 0; i < seedStr.length; i++) {
      h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0
    }
    this.seed = Math.abs(h) || 1
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff
    return this.seed / 0x7fffffff
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  pick<T>(arr: T[]): T {
    if (!arr || arr.length === 0) return undefined as any
    return arr[Math.floor(this.next() * arr.length)]
  }

  pickWeighted<T extends { weight: number }>(arr: T[]): T {
    if (!arr || arr.length === 0) return undefined as any
    const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0)
    let r = this.next() * totalWeight
    for (const item of arr) {
      r -= item.weight
      if (r <= 0) return item
    }
    return arr[arr.length - 1]
  }

  hex(length: number): string {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += Math.floor(this.next() * 16).toString(16)
    }
    return result
  }
}

// ═══════════════════════════════════════════
// OS Compatibility Constants
// ═══════════════════════════════════════════

export const OS_PLATFORM_MAP: Record<OSType, string> = {
  'windows-10': 'Win32',
  'windows-11': 'Win32',
  'macos-intel': 'MacIntel',
  'macos-arm': 'MacIntel',       // Chrome/Firefox on macOS ARM still report MacIntel in navigator.platform
  'linux': 'Linux x86_64',
  'android': 'Linux armv8l',
  'ios': 'iPhone'
}

export const OS_APP_VERSION_PREFIX: Record<OSType, string> = {
  'windows-10': '5.0 (Windows NT 10.0; Win64; x64)',
  'windows-11': '5.0 (Windows NT 10.0; Win64; x64)',
  'macos-intel': '5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'macos-arm': '5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'linux': '5.0 (X11; Linux x86_64)',
  'android': '5.0 (Linux; Android 14)',
  'ios': '5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
}

export const OS_CPU_ARCHITECTURES: Record<OSFamily, { arch: string; platformArch: string }> = {
  'windows': { arch: 'x86_64', platformArch: '64-bit' },
  'macos': { arch: 'x86_64', platformArch: '64-bit' },
  'linux': { arch: 'x86_64', platformArch: '64-bit' },
  'android': { arch: 'arm64', platformArch: '64-bit' },
  'ios': { arch: 'arm64', platformArch: '64-bit' }
}

export const OS_CPU_RANGES: Record<OSFamily, number[]> = {
  'windows': [4, 6, 8, 12, 16, 24, 32],
  'macos': [4, 6, 8, 10, 12, 16],
  'linux': [4, 6, 8, 12, 16, 32],
  'android': [4, 6, 8],
  'ios': [6]
}

export const OS_MEMORY_RANGES: Record<OSFamily, number[]> = {
  'windows': [8, 16, 32, 64],
  'macos': [8, 16, 24, 32, 64],
  'linux': [8, 16, 32, 64],
  'android': [4, 6, 8, 12],
  'ios': [6, 8]
}

const WEBGL_EXTENSIONS = [
  'ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_color_buffer_half_float',
  'EXT_disjoint_timer_query', 'EXT_float_blend', 'EXT_frag_depth',
  'EXT_shader_texture_lod', 'EXT_texture_compression_bptc',
  'EXT_texture_compression_rgtc', 'EXT_texture_filter_anisotropic',
  'EXT_sRGB', 'KHR_parallel_shader_compile', 'OES_element_index_uint',
  'OES_fbo_render_mipmap', 'OES_standard_derivatives', 'OES_texture_float',
  'OES_texture_float_linear', 'OES_texture_half_float',
  'OES_texture_half_float_linear', 'OES_vertex_array_object',
  'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_s3tc',
  'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info',
  'WEBGL_debug_shaders', 'WEBGL_depth_texture', 'WEBGL_draw_buffers',
  'WEBGL_lose_context', 'WEBGL_multi_draw'
]

// ═══════════════════════════════════════════
// Helper: Format User-Agent String
// ═══════════════════════════════════════════

export function formatUserAgent(
  osType: OSType,
  browserType: 'chrome' | 'firefox' = 'chrome',
  browserVersion = '131.0.0.0',
  deviceModelId?: string
): string {
  const family = getOSFamily(osType)

  if (family === 'ios') {
    const dev = (deviceModelId ? getIosDeviceById(deviceModelId) : null) || IOS_DEVICES[0]
    return generateIosUserAgent(dev, browserType, browserVersion)
  }

  if (family === 'android') {
    const dev = (deviceModelId ? getAndroidDeviceById(deviceModelId) : null) || ANDROID_DEVICES[0]
    const osVer = dev.androidVersion || '14'
    const modelCode = dev.modelCode || 'SM-S928B'
    if (browserType === 'firefox') {
      const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
      return `Mozilla/5.0 (Android ${osVer}; Mobile; rv:${ffVer}) Gecko/${ffVer} Firefox/${ffVer}`
    }
    return `Mozilla/5.0 (Linux; Android ${osVer}; ${modelCode}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Mobile Safari/537.36`
  }

  if (browserType === 'firefox') {
    const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
    if (osType === 'windows-10' || osType === 'windows-11') {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    } else if (osType.startsWith('macos')) {
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    } else {
      return `Mozilla/5.0 (X11; Linux x86_64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
  }

  // Chrome Desktop
  if (osType === 'windows-10' || osType === 'windows-11') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  } else if (osType.startsWith('macos')) {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  } else {
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  }
}

// ═══════════════════════════════════════════
// Recalculate Dependent Fields Engine
// ═══════════════════════════════════════════

export interface RecalculateOptions {
  osType: OSType
  browserType?: 'chrome' | 'firefox'
  browserVersion?: string
  deviceModelId?: string
  deviceTemplateId?: string     // v3: device template ID
  seed?: string
}

/**
 * Automatically recalculates all dependent fingerprint values when the OS,
 * browser type, or version is changed, guaranteeing internal coherence.
 */
export function recalculateDependentFields(
  currentFp: Fingerprint,
  options: RecalculateOptions
): Fingerprint {
  const { osType, deviceModelId } = options
  const family = getOSFamily(osType)
  const isMobile = family === 'android' || family === 'ios'
  const isIos = family === 'ios'
  const isAndroid = family === 'android'

  const browserType: 'chrome' | 'firefox' =
    options.browserType || currentFp?.browser?.type || (currentFp?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
  const browserVersion =
    options.browserVersion || currentFp?.browser?.version || currentFp?.navigator?.browserVersion || (browserType === 'firefox' ? '129.0' : '131.0.0.0')

  const seed = options.seed || currentFp?.seed || crypto.randomBytes(16).toString('hex')
  const rng = new SeededRandom(seed)

  // 1. Mobile Specific Specs
  let iosDev: IosDeviceSpec | null = null
  let androidDev: AndroidDeviceSpec | null = null
  if (isIos) {
    if (deviceModelId) {
      iosDev = getIosDeviceById(deviceModelId)
    }
    if (!iosDev && (currentFp?.navigator as any)?.deviceModelCode) {
      iosDev = getIosDeviceById((currentFp.navigator as any).deviceModelCode)
    }
    if (!iosDev) {
      iosDev = IOS_DEVICES[0]
    }
  } else if (isAndroid) {
    if (deviceModelId) {
      androidDev = getAndroidDeviceById(deviceModelId)
    }
    if (!androidDev && (currentFp?.navigator as any)?.deviceModelCode) {
      androidDev = getAndroidDeviceById((currentFp.navigator as any).deviceModelCode)
    }
    if (!androidDev) {
      androidDev = ANDROID_DEVICES[0]
    }
  }

  // 2. User-Agent & Navigator Alignment
  const userAgent = formatUserAgent(osType, browserType, browserVersion, iosDev?.id || androidDev?.id)
  const platform = OS_PLATFORM_MAP[osType] || (isIos ? 'iPhone' : 'Win32')
  const cpuArch = OS_CPU_ARCHITECTURES[family]

  let cores = isIos ? (iosDev?.cores || 6) : isAndroid ? (androidDev?.cores || 8) : currentFp?.navigator?.hardwareConcurrency || rng.pick(OS_CPU_RANGES[family])
  if (isIos && cores > 8) cores = 6
  if (isAndroid && cores > 8) cores = 8

  let memory = isIos ? (iosDev?.memory || 8) : isAndroid ? (androidDev?.memory || 12) : currentFp?.navigator?.deviceMemory || rng.pick(OS_MEMORY_RANGES[family])
  if (isIos && memory > 8) memory = 8

  const vendor = isIos ? 'Apple Computer, Inc.' : browserType === 'firefox' ? '' : 'Google Inc.'

  const navigator: NavigatorFingerprint = {
    ...(currentFp?.navigator || {}),
    userAgent,
    browserVersion,
    chromiumVersion: browserVersion.split('.')[0],
    platform,
    vendor,
    vendorSub: '',
    product: 'Gecko',
    productSub: browserType === 'firefox' ? '20100101' : '20030107',
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: OS_APP_VERSION_PREFIX[osType] + (browserType === 'firefox' ? '' : ` AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} ${isMobile ? 'Mobile ' : ''}Safari/537.36`),
    hardwareConcurrency: cores,
    deviceMemory: memory,
    cpuArchitecture: cpuArch.arch,
    platformArchitecture: cpuArch.platformArch,
    maxTouchPoints: isMobile ? 5 : 0,
    touchSupport: isMobile,
    pdfViewerEnabled: !isMobile && browserType === 'chrome',
    webdriver: false,
    doNotTrack: currentFp?.navigator?.doNotTrack || null,
    cookieEnabled: true,
    javaEnabled: false,
    localStorageEnabled: true,
    sessionStorageEnabled: true,
    indexedDBEnabled: true,
    webSQLEnabled: false
  }

  if (isIos && iosDev) {
    (navigator as any).deviceBrand = 'Apple';
    (navigator as any).deviceModel = iosDev.modelName;
    (navigator as any).deviceModelCode = iosDev.id;
  } else if (isAndroid && androidDev) {
    (navigator as any).deviceBrand = androidDev.brand;
    (navigator as any).deviceModel = androidDev.modelName;
    (navigator as any).deviceModelCode = androidDev.modelCode;
  }

  // 3. Screen & Resolution Alignment
  let screen: ScreenFingerprint
  if (isIos && iosDev) {
    screen = {
      width: iosDev.screenWidth,
      height: iosDev.screenHeight,
      availWidth: iosDev.screenWidth,
      availHeight: iosDev.screenHeight,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: iosDev.dpr,
      orientation: 'portrait-primary',
      orientationAngle: 0,
      viewportWidth: iosDev.screenWidth,
      viewportHeight: Math.floor(iosDev.screenHeight * 0.9),
      outerWidth: iosDev.screenWidth,
      outerHeight: iosDev.screenHeight,
      screenX: 0,
      screenY: 0,
      isMultiMonitor: false,
      isPrimaryDisplay: true
    }
  } else if (isAndroid && androidDev) {
    screen = {
      width: androidDev.screenWidth,
      height: androidDev.screenHeight,
      availWidth: androidDev.screenWidth,
      availHeight: androidDev.screenHeight,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: androidDev.dpr,
      orientation: 'portrait-primary',
      orientationAngle: 0,
      viewportWidth: androidDev.screenWidth,
      viewportHeight: Math.floor(androidDev.screenHeight * 0.9),
      outerWidth: androidDev.screenWidth,
      outerHeight: androidDev.screenHeight,
      screenX: 0,
      screenY: 0,
      isMultiMonitor: false,
      isPrimaryDisplay: true
    }
  } else {
    // Desktop Screen Configuration
    const configs = screenConfigsData as any
    const pool = osType.startsWith('macos') ? configs['macos-retina'] || configs.desktop : configs.desktop
    const selected = rng.pickWeighted(pool) || { width: 1920, height: 1080, dpr: 1, viewport: [1920, 969] }
    const taskbarHeight = (configs.taskbar_heights as any)[osType] || 40

    screen = {
      width: selected.width,
      height: selected.height,
      availWidth: selected.width,
      availHeight: selected.height - taskbarHeight,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: selected.dpr,
      orientation: 'landscape-primary',
      orientationAngle: 0,
      viewportWidth: selected.viewport ? selected.viewport[0] : selected.width,
      viewportHeight: selected.viewport ? selected.viewport[1] : selected.height - taskbarHeight,
      outerWidth: selected.width,
      outerHeight: selected.height,
      screenX: 0,
      screenY: 0,
      isMultiMonitor: !isMobile && rng.next() > 0.7,
      isPrimaryDisplay: true
    }
  }

  // 4. WebGL / GPU Alignment
  let webgl: WebGLFingerprint
  if (isIos && iosDev) {
    webgl = {
      enabled: true,
      version: 'WebGL 2.0',
      vendor: 'Apple Inc.',
      renderer: iosDev.gpuRenderer,
      unmaskedVendor: 'Apple Inc.',
      unmaskedRenderer: iosDev.gpuRenderer,
      maxTextureSize: 16384,
      maxViewportDims: [16384, 16384],
      maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Apple)',
      extensions: WEBGL_EXTENSIONS.slice(0, 20),
      antialiasing: true,
      gpuVendor: 'Apple Inc.',
      gpuRenderer: iosDev.gpuRenderer,
      driverInfo: ''
    }
  } else if (isAndroid && androidDev) {
    webgl = {
      enabled: true,
      version: 'WebGL 2.0',
      vendor: 'WebKit',
      renderer: 'WebKit WebGL',
      unmaskedVendor: androidDev.gpuVendor,
      unmaskedRenderer: androidDev.gpuRenderer,
      maxTextureSize: 16384,
      maxViewportDims: [16384, 16384],
      maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Android)',
      extensions: WEBGL_EXTENSIONS.slice(0, 22),
      antialiasing: true,
      gpuVendor: androidDev.gpuVendor,
      gpuRenderer: androidDev.gpuRenderer,
      driverInfo: ''
    }
  } else {
    // Pick GPU appropriate for OS
    const gpuData = gpuModelsData as any
    const osGpus = gpuData[family === 'macos' ? 'macos' : family === 'linux' ? 'linux' : 'windows'] || gpuData.windows
    const vendorKeys = Object.keys(osGpus)
    let vKey = vendorKeys[0]
    if (osType === 'macos-arm') {
      vKey = 'apple'
    } else if (osType === 'macos-intel') {
      vKey = 'intel'
    } else {
      vKey = rng.pick(vendorKeys)
    }
    const gpuList = osGpus[vKey] || osGpus[vendorKeys[0]]
    const gpu = rng.pick(gpuList)

    webgl = {
      enabled: true,
      version: 'WebGL 2.0',
      vendor: 'WebKit',
      renderer: 'WebKit WebGL',
      unmaskedVendor: gpu.vendor,
      unmaskedRenderer: gpu.renderer,
      maxTextureSize: gpu.maxTexture || 16384,
      maxViewportDims: [gpu.maxTexture || 32767, gpu.maxTexture || 32767],
      maxRenderbufferSize: gpu.maxTexture || 16384,
      shadingLanguageVersion: `WebGL GLSL ES 3.00 (${browserType === 'firefox' ? 'OpenGL ES GLSL ES 3.0 Firefox' : 'OpenGL ES GLSL ES 3.0 Chromium'})`,
      extensions: WEBGL_EXTENSIONS,
      antialiasing: true,
      gpuVendor: gpu.vendor.replace(/Google Inc\. \(|\)/g, '').split(',')[0].trim(),
      gpuRenderer: gpu.gpu,
      driverInfo: ''
    }
  }

  // 5. Fonts Alignment
  const osFonts: string[] = (fontListsData as any)[family] || (fontListsData as any)['windows']
  const fonts: FontsFingerprint = {
    enableMasking: true,
    mode: 'automatic',
    fontList: [...osFonts].sort()
  }

  // 6. Media Devices
  const mediaDevices: MediaDevicesFingerprint = {
    videoInputs: isMobile ? 2 : 1,
    audioInputs: 1,
    audioOutputs: isMobile ? 1 : 2,
    cameraLabels: isMobile ? ['camera2 0, facing back', 'camera2 1, facing front'] : ['Integrated HD Camera'],
    microphoneLabels: ['Default Microphone'],
    speakerLabels: ['Default Speaker'],
    deviceIds: [rng.hex(64), rng.hex(64), rng.hex(64)]
  }

  // 7. Battery & Network
  const battery: BatteryFingerprint = {
    enabled: isMobile || family === 'macos',
    charging: true,
    level: 0.95,
    chargingTime: 0,
    dischargingTime: Infinity
  }

  const networkInfo: NetworkInfoFingerprint = {
    effectiveType: '4g',
    downlink: isMobile ? 15 : 100,
    rtt: isMobile ? 50 : 20,
    saveData: false,
    type: isMobile ? 'cellular' : 'wifi'
  }

  // 8. Browser Config
  const browser: BrowserConfig = {
    ...(currentFp?.browser || {
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
    }),
    type: browserType,
    name: browserType === 'firefox' ? 'Firefox' : 'Chrome',
    version: browserVersion
  }

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    seed,
    osType,
    navigator,
    screen,
    locale: currentFp?.locale || {
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
    timezone: currentFp?.timezone || {
      mode: 'auto',
      timezone: 'America/New_York',
      utcOffset: -300,
      hasDST: true,
      dstOffset: 60
    },
    geolocation: currentFp?.geolocation || {
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
    webrtc: currentFp?.webrtc || {
      mode: 'real',
      ipPolicy: 'default_public_interface_only',
      localIP: '',
      publicIP: ''
    },
    canvas: {
      mode: currentFp?.canvas?.mode || 'noise',
      noiseSeed: (currentFp?.canvas?.noiseSeed && currentFp.canvas.noiseSeed > 0) ? currentFp.canvas.noiseSeed : rng.int(100000, 999999)
    },
    webgl,
    audio: {
      mode: currentFp?.audio?.mode || 'noise',
      noiseSeed: (currentFp?.audio?.noiseSeed && currentFp.audio.noiseSeed > 0) ? currentFp.audio.noiseSeed : rng.int(100000, 999999),
      sampleRate: 44100,
      channelCount: 2,
      maxChannelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCountMode: 'max',
      channelInterpretation: 'speakers'
    },
    clientRects: {
      mode: currentFp?.clientRects?.mode || 'noise',
      noiseSeed: (currentFp?.clientRects?.noiseSeed && currentFp.clientRects.noiseSeed > 0) ? currentFp.clientRects.noiseSeed : rng.int(100000, 999999)
    },
    fonts,
    mediaDevices,
    battery,
    networkInfo,
    permissions: currentFp?.permissions || {
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
    browser
  }
}

// ═══════════════════════════════════════════
// Main Fingerprint Generator
// ═══════════════════════════════════════════

export interface GenerateOptions {
  osType: OSType
  browserType?: 'chrome' | 'firefox'
  browserVersion?: string
  deviceModelId?: string
  deviceTemplateId?: string     // v3: device template ID
  seed?: string
  country?: string
  proxyTimezone?: string
}

export function generateFingerprint(options: GenerateOptions): Fingerprint {
  const blank = createDefaultFingerprint()
  return recalculateDependentFields(blank, options)
}

export function regenerateFingerprint(osType: OSType, country?: string): Fingerprint {
  return generateFingerprint({
    osType,
    seed: crypto.randomBytes(16).toString('hex'),
    country
  })
}

export function generateBulkFingerprints(options: { count: number; osType: OSType; browserType?: 'chrome' | 'firefox' }): Fingerprint[] {
  const result: Fingerprint[] = []
  for (let i = 0; i < options.count; i++) {
    result.push(generateFingerprint({
      osType: options.osType,
      browserType: options.browserType,
      seed: crypto.randomBytes(16).toString('hex')
    }))
  }
  return result
}

// ═══════════════════════════════════════════
// v3 Device Template Integration
// ═══════════════════════════════════════════

/**
 * Generate a fingerprint using the v3 device template resolver pipeline.
 * Returns a ResolvedRuntimeProfile with full validation.
 */
export function generateFromDeviceTemplate(selection: DeviceSelection): ResolvedRuntimeProfile {
  return resolveDeviceProfile(selection)
}

/**
 * Resolve a legacy fingerprint against the best-matching device template.
 * Non-destructive — the original fingerprint values are preserved.
 */
export function resolveExistingProfile(
  existingFp: Fingerprint,
  osType: OSType,
  browserType: 'chrome' | 'firefox',
  browserVersion: string
): ResolvedRuntimeProfile {
  return resolveLegacyProfile(existingFp, osType, browserType, browserVersion)
}

// Re-export device template functions for IPC/UI access
export {
  ALL_DEVICE_TEMPLATES,
  getDeviceTemplateById,
  getDeviceTemplatesByOs,
  getDeviceTemplatesGrouped,
  getDefaultDeviceTemplate,
  findBestMatchingTemplate
}

// ═══════════════════════════════════════════
// Canonical Predefined Profile Templates
// ═══════════════════════════════════════════

export function getBuiltinTemplates(): ProfileTemplate[] {
  const tpls: Array<{
    id: string
    name: string
    osType: OSType
    browserType: 'chrome' | 'firefox'
    browserVersion: string
    deviceClass: 'desktop' | 'mobile' | 'tablet'
    description: string
    deviceModelId?: string
  }> = [
    {
      id: 'win11-chrome-standard',
      name: 'Windows 11 Chrome Desktop (Workstation)',
      osType: 'windows-11',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceClass: 'desktop',
      description: 'Windows 11 64-bit desktop with Google Chrome 131, NVIDIA GeForce RTX 4070, 1920x1080 @ 1x DPR, and 16GB RAM.'
    },
    {
      id: 'win10-firefox-quantum',
      name: 'Windows 10 Firefox Quantum (Privacy)',
      osType: 'windows-10',
      browserType: 'firefox',
      browserVersion: '129.0',
      deviceClass: 'desktop',
      description: 'Windows 10 with Mozilla Firefox 129 Quantum Gecko engine, Intel UHD Graphics Direct3D, 8GB RAM, and 6 CPU cores.'
    },
    {
      id: 'macos-arm-chrome-retina',
      name: 'macOS Apple Silicon (M3 Pro) Chrome',
      osType: 'macos-arm',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceClass: 'desktop',
      description: 'MacBook Pro Apple Silicon M3 GPU, Retina 1512x982 @ 2x DPR, 16GB RAM, Metal WebGL.'
    },
    {
      id: 'macos-intel-firefox',
      name: 'macOS Intel Firefox Quantum',
      osType: 'macos-intel',
      browserType: 'firefox',
      browserVersion: '129.0',
      deviceClass: 'desktop',
      description: 'MacBook Pro Intel with Intel Iris Plus Graphics, 1440x900 @ 2x DPR, Firefox Quantum 129.'
    },
    {
      id: 'linux-ubuntu-chrome',
      name: 'Linux Ubuntu Chrome Workstation',
      osType: 'linux',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceClass: 'desktop',
      description: 'Ubuntu Linux x86_64 desktop, Google Chrome 131, Mesa Intel OpenGL WebGL, 1920x1080 @ 1x DPR, 16GB RAM.'
    },
    {
      id: 'linux-debian-firefox',
      name: 'Linux Debian Firefox Stable',
      osType: 'linux',
      browserType: 'firefox',
      browserVersion: '129.0',
      deviceClass: 'desktop',
      description: 'Debian Linux with Firefox 129, AMD Radeon OpenGL, 1920x1080, font masking.'
    },
    {
      id: 'iphone-15-pro-ios',
      name: 'iPhone 15 Pro (iOS 17.5 Safari/Chrome)',
      osType: 'ios',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceClass: 'mobile',
      description: 'Apple iPhone 15 Pro with Apple A17 Pro GPU, 393x852 @ 3x DPR screen, 8GB RAM, 6 Cores, Touch support.',
      deviceModelId: 'iphone-15-pro'
    },
    {
      id: 'samsung-s24-ultra-android',
      name: 'Samsung Galaxy S24 Ultra (Android 14 Chrome)',
      osType: 'android',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceClass: 'mobile',
      description: 'Samsung Galaxy S24 Ultra (SM-S928B), Snapdragon 8 Gen 3 Adreno 750, 412x915 @ 3.5x DPR, 12GB RAM, Touch support.',
      deviceModelId: 'samsung-s24-ultra'
    }
  ]

  return tpls.map(t => {
    const fp = generateFingerprint({
      osType: t.osType,
      browserType: t.browserType,
      browserVersion: t.browserVersion,
      deviceModelId: t.deviceModelId,
      seed: `builtin-${t.id}`
    })

    return {
      id: t.id,
      name: t.name,
      osType: t.osType,
      browserType: t.browserType,
      browserVersion: t.browserVersion,
      deviceClass: t.deviceClass,
      description: t.description,
      fingerprint: fp,
      isBuiltin: true,
      createdAt: '2026-08-19T00:00:00.000Z'
    }
  })
}
