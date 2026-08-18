// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Fingerprint Generator
// Generates coherent, consistent fingerprints following the cascade:
//   OS → Browser → Hardware → Display → Locale → Network → Validate
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import {
  OSType, OSFamily, getOSFamily,
  Fingerprint, NavigatorFingerprint, ScreenFingerprint,
  LocaleFingerprint, TimezoneFingerprint, GeolocationFingerprint,
  WebRTCFingerprint, CanvasFingerprint, WebGLFingerprint,
  AudioFingerprint, ClientRectsFingerprint, FontsFingerprint,
  MediaDevicesFingerprint, BatteryFingerprint, NetworkInfoFingerprint,
  PermissionsFingerprint, BrowserConfig,
  createDefaultFingerprint
} from './types'

// Import curated datasets
import userAgentsData from './datasets/user-agents.json'
import gpuModelsData from './datasets/gpu-models.json'
import fontListsData from './datasets/font-lists.json'
import screenConfigsData from './datasets/screen-configs.json'
import localeProfilesData from './datasets/locale-profiles.json'

// ═══════════════════════════════════════════
// Seeded Random Number Generator
// Deterministic PRNG for reproducible fingerprints
// ═══════════════════════════════════════════

class SeededRandom {
  private seed: number

  constructor(seedStr: string) {
    // Convert string seed to numeric seed via hash
    let h = 0
    for (let i = 0; i < seedStr.length; i++) {
      h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0
    }
    this.seed = Math.abs(h) || 1
  }

  /** Returns a random float between 0 and 1 */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff
    return this.seed / 0x7fffffff
  }

  /** Returns a random integer between min (inclusive) and max (inclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** Pick a random element using weighted probabilities */
  pickWeighted<T extends { weight: number }>(arr: T[]): T {
    const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0)
    let r = this.next() * totalWeight
    for (const item of arr) {
      r -= item.weight
      if (r <= 0) return item
    }
    return arr[arr.length - 1]
  }

  /** Generate a random hex string */
  hex(length: number): string {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += Math.floor(this.next() * 16).toString(16)
    }
    return result
  }
}

// ═══════════════════════════════════════════
// OS Compatibility Matrices
// ═══════════════════════════════════════════

const OS_PLATFORM_MAP: Record<OSType, string> = {
  'windows-10': 'Win32',
  'windows-11': 'Win32',
  'macos-intel': 'MacIntel',
  'macos-arm': 'MacIntel',       // Chrome on ARM still reports MacIntel
  'linux': 'Linux x86_64',
  'android': 'Linux armv8l',
  'ios': 'iPhone'
}

const OS_APP_VERSION_PREFIX: Record<OSType, string> = {
  'windows-10': '5.0 (Windows NT 10.0; Win64; x64)',
  'windows-11': '5.0 (Windows NT 10.0; Win64; x64)',
  'macos-intel': '5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'macos-arm': '5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'linux': '5.0 (X11; Linux x86_64)',
  'android': '5.0 (Linux; Android 14)',
  'ios': '5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
}

const OS_CPU_ARCHITECTURES: Record<OSFamily, { arch: string; platformArch: string }> = {
  'windows': { arch: 'x86_64', platformArch: '64-bit' },
  'macos': { arch: 'x86_64', platformArch: '64-bit' },
  'linux': { arch: 'x86_64', platformArch: '64-bit' },
  'android': { arch: 'arm64', platformArch: '64-bit' },
  'ios': { arch: 'arm64', platformArch: '64-bit' }
}

const OS_CPU_RANGES: Record<OSFamily, number[]> = {
  'windows': [4, 6, 8, 12, 16, 24, 32],
  'macos': [4, 6, 8, 10, 12, 16, 20, 24],
  'linux': [2, 4, 6, 8, 12, 16, 32, 64],
  'android': [4, 6, 8],
  'ios': [6]
}

const OS_MEMORY_RANGES: Record<OSFamily, number[]> = {
  'windows': [4, 8, 16, 32, 64],
  'macos': [8, 16, 24, 32, 36, 48, 64, 96, 128],
  'linux': [4, 8, 16, 32, 64],
  'android': [4, 6, 8, 12],
  'ios': [4, 6, 8]
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
// Main Fingerprint Generator
// ═══════════════════════════════════════════

export interface GenerateOptions {
  osType: OSType
  seed?: string               // If provided, produces deterministic results
  country?: string            // ISO country code, e.g. "US"
  proxyTimezone?: string      // Auto-detected timezone from proxy
}

/**
 * Generate a complete, coherent fingerprint for the given OS type.
 *
 * The generation follows a strict cascade to ensure consistency:
 *   1. OS type → platform, architecture, compatible browsers
 *   2. Browser → user-agent, version, vendor
 *   3. Hardware → CPU cores, memory, GPU/WebGL
 *   4. Display → screen resolution, DPR, viewport
 *   5. Locale → language, timezone, country, currency
 *   6. Privacy → canvas, audio, clientRects noise seeds
 *   7. Peripherals → media devices, battery, network
 *   8. Permissions → default states
 */
export function generateFingerprint(options: GenerateOptions): Fingerprint {
  const { osType, country } = options
  const seed = options.seed || crypto.randomBytes(16).toString('hex')
  const rng = new SeededRandom(seed)
  const family = getOSFamily(osType)

  // ── Step 1: Navigator (OS-aware) ──
  const navigator = generateNavigator(osType, family, rng)

  // ── Step 2: Screen (OS-aware, consistent with DPR) ──
  const screen = generateScreen(osType, family, rng)

  // ── Step 3: Locale (country-aware) ──
  const locale = generateLocale(country || 'US', rng)

  // ── Step 4: Timezone (consistent with country/locale) ──
  const timezone = generateTimezone(country || 'US', options.proxyTimezone, rng)

  // ── Step 5: Geolocation (consistent with country/timezone) ──
  const geolocation = generateGeolocation(country || 'US', rng)

  // ── Step 6: WebRTC ──
  const webrtc = generateWebRTC()

  // ── Step 7: Canvas ──
  const canvas = generateCanvas(rng)

  // ── Step 8: WebGL (OS-aware, consistent with GPU) ──
  const webgl = generateWebGL(osType, family, rng)

  // ── Step 9: Audio ──
  const audio = generateAudio(rng)

  // ── Step 10: ClientRects ──
  const clientRects = generateClientRects(rng)

  // ── Step 11: Fonts (OS-specific) ──
  const fonts = generateFonts(family, rng)

  // ── Step 12: Media Devices ──
  const mediaDevices = generateMediaDevices(family, rng)

  // ── Step 13: Battery ──
  const battery = generateBattery(family)

  // ── Step 14: Network Info ──
  const networkInfo = generateNetworkInfo(family)

  // ── Step 15: Permissions ──
  const permissions = generatePermissions()

  // ── Step 16: Browser Config ──
  const browser = generateBrowserConfig()

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    seed,
    navigator,
    screen,
    locale,
    timezone,
    geolocation,
    webrtc,
    canvas,
    webgl,
    audio,
    clientRects,
    fonts,
    mediaDevices,
    battery,
    networkInfo,
    permissions,
    browser
  }
}

// ═══════════════════════════════════════════
// Step 1: Navigator Generation
// ═══════════════════════════════════════════

function generateNavigator(osType: OSType, family: OSFamily, rng: SeededRandom): NavigatorFingerprint {
  const uaData = (userAgentsData as any)[osType] || (userAgentsData as any)['windows-10']
  const selectedUA = rng.pick(uaData)

  const cpuArch = OS_CPU_ARCHITECTURES[family]
  const cores = rng.pick(OS_CPU_RANGES[family])
  const memory = rng.pick(OS_MEMORY_RANGES[family])

  const isMobile = family === 'android' || family === 'ios'
  const isAndroid = family === 'android'
  const isIos = family === 'ios'
  const isMac = family === 'macos'

  return {
    userAgent: selectedUA.ua,
    browserVersion: selectedUA.version,
    chromiumVersion: selectedUA.chromium,
    platform: OS_PLATFORM_MAP[osType] || (isIos ? 'iPhone' : 'Win32'),
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: OS_APP_VERSION_PREFIX[osType] + ` AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${selectedUA.version} ${isMobile ? 'Mobile ' : ''}Safari/537.36`,
    product: 'Gecko',
    productSub: '20030107',
    vendor: isIos ? 'Apple Computer, Inc.' : 'Google Inc.',
    vendorSub: '',
    hardwareConcurrency: cores,
    deviceMemory: memory,
    cpuArchitecture: cpuArch.arch,
    platformArchitecture: cpuArch.platformArch,
    maxTouchPoints: isMobile ? 5 : 0,
    touchSupport: isMobile,
    doNotTrack: rng.next() > 0.8 ? '1' : null,    // ~20% enable DNT
    cookieEnabled: true,
    pdfViewerEnabled: !isMobile,
    javaEnabled: false,
    webdriver: false,
    localStorageEnabled: true,
    sessionStorageEnabled: true,
    indexedDBEnabled: true,
    webSQLEnabled: false
  }
}

// ═══════════════════════════════════════════
// Step 2: Screen Generation
// ═══════════════════════════════════════════

function generateScreen(osType: OSType, family: OSFamily, rng: SeededRandom): ScreenFingerprint {
  const configs = screenConfigsData as any
  const taskbarHeight = configs.taskbar_heights[osType] || 0

  let pool: any[]
  if (family === 'android') {
    pool = configs.android
  } else if (family === 'ios') {
    pool = configs.ios || configs.android
  } else if (osType === 'macos-arm' || osType === 'macos-intel') {
    // macOS uses retina displays predominantly
    pool = rng.next() > 0.15 ? configs['macos-retina'] : configs.desktop
  } else {
    pool = configs.desktop
  }

  const selected = rng.pickWeighted(pool)

  const isMobile = family === 'android' || family === 'ios'
  const availHeight = isMobile ? selected.height : selected.height - taskbarHeight
  const viewportWidth = selected.viewport[0]
  const viewportHeight = selected.viewport[1]

  return {
    width: selected.width,
    height: selected.height,
    availWidth: selected.width,
    availHeight,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: selected.dpr,
    orientation: isMobile ? 'portrait-primary' : 'landscape-primary',
    orientationAngle: 0,
    viewportWidth,
    viewportHeight,
    outerWidth: isMobile ? selected.width : viewportWidth,
    outerHeight: isMobile ? selected.height : viewportHeight + 71 + taskbarHeight, // Chrome UI height
    screenX: 0,
    screenY: 0,
    isMultiMonitor: !isMobile && rng.next() > 0.7, // 30% of desktop users have multi-monitor
    isPrimaryDisplay: true
  }
}

// ═══════════════════════════════════════════
// Step 3: Locale Generation
// ═══════════════════════════════════════════

function generateLocale(country: string, rng: SeededRandom): LocaleFingerprint {
  const profiles = (localeProfilesData as any).profiles
  const profile = profiles[country] || profiles['US']

  return {
    language: profile.language,
    languages: profile.languages,
    country,
    region: '',
    currency: profile.currency,
    numberFormat: profile.numberFormat,
    dateFormat: profile.dateFormat,
    firstDayOfWeek: profile.firstDayOfWeek,
    measurementSystem: profile.measurementSystem,
    hourCycle: profile.hourCycle
  }
}

// ═══════════════════════════════════════════
// Step 4: Timezone Generation
// ═══════════════════════════════════════════

function generateTimezone(country: string, proxyTimezone: string | undefined, rng: SeededRandom): TimezoneFingerprint {
  if (proxyTimezone) {
    return {
      mode: 'auto',
      timezone: proxyTimezone,
      utcOffset: getUtcOffset(proxyTimezone),
      hasDST: hasDST(proxyTimezone),
      dstOffset: 60
    }
  }

  const profiles = (localeProfilesData as any).profiles
  const profile = profiles[country] || profiles['US']
  const tz = rng.pick(profile.timezones)

  return {
    mode: 'manual',
    timezone: tz,
    utcOffset: getUtcOffset(tz),
    hasDST: hasDST(tz),
    dstOffset: 60
  }
}

function getUtcOffset(timezone: string): number {
  try {
    const now = new Date()
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    return (tzDate.getTime() - utcDate.getTime()) / 60000
  } catch {
    return -300 // Default to EST
  }
}

function hasDST(timezone: string): boolean {
  try {
    const jan = new Date(2024, 0, 1)
    const jul = new Date(2024, 6, 1)
    const janOffset = jan.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    const julOffset = jul.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    return janOffset !== julOffset
  } catch {
    return true
  }
}

// ═══════════════════════════════════════════
// Step 5: Geolocation Generation
// ═══════════════════════════════════════════

function generateGeolocation(country: string, rng: SeededRandom): GeolocationFingerprint {
  const geoCoords = (localeProfilesData as any).geo_coords
  const coords = geoCoords[country]

  if (coords && coords.length > 0) {
    const city = rng.pick(coords)
    // Add small randomization to coordinates (within ~5km)
    const latNoise = (rng.next() - 0.5) * 0.09
    const lonNoise = (rng.next() - 0.5) * 0.09

    return {
      mode: 'custom',
      latitude: Math.round((city.lat + latNoise) * 10000) / 10000,
      longitude: Math.round((city.lon + lonNoise) * 10000) / 10000,
      accuracy: rng.pick([10, 20, 50, 100, 150]),
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      permissionState: 'prompt'
    }
  }

  // Fallback: New York
  return {
    mode: 'ask',
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 50,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    permissionState: 'prompt'
  }
}

// ═══════════════════════════════════════════
// Step 6: WebRTC
// ═══════════════════════════════════════════

function generateWebRTC(): WebRTCFingerprint {
  return {
    mode: 'real',
    ipPolicy: 'default_public_interface_only',
    localIP: '',
    publicIP: ''
  }
}

// ═══════════════════════════════════════════
// Step 7: Canvas
// ═══════════════════════════════════════════

function generateCanvas(rng: SeededRandom): CanvasFingerprint {
  return {
    mode: 'noise',
    noiseSeed: rng.int(100000, 999999)
  }
}

// ═══════════════════════════════════════════
// Step 8: WebGL (OS-aware GPU selection)
// ═══════════════════════════════════════════

function generateWebGL(osType: OSType, family: OSFamily, rng: SeededRandom): WebGLFingerprint {
  const gpuData = gpuModelsData as any
  const osGpus = gpuData[family === 'macos' ? 'macos' : family === 'android' ? 'android' : family === 'linux' ? 'linux' : 'windows']

  // Pick a GPU vendor category appropriate to OS
  const vendorCategories = Object.keys(osGpus)
  let vendorKey: string

  if (family === 'macos' && osType === 'macos-arm') {
    // Apple Silicon always uses Apple GPU
    vendorKey = 'apple'
  } else if (family === 'macos' && osType === 'macos-intel') {
    // Intel Macs can have Intel or AMD GPUs
    vendorKey = rng.pick(['intel', 'apple'])
    if (!osGpus[vendorKey]) vendorKey = vendorCategories[0]
  } else {
    vendorKey = rng.pick(vendorCategories)
  }

  const gpuList = osGpus[vendorKey] || osGpus[vendorCategories[0]]
  const gpu = rng.pick(gpuList)

  // Select WebGL extensions (pick ~70-90% of full list)
  const extCount = rng.int(Math.floor(WEBGL_EXTENSIONS.length * 0.7), WEBGL_EXTENSIONS.length)
  const extensions = [...WEBGL_EXTENSIONS].sort(() => rng.next() - 0.5).slice(0, extCount)

  return {
    enabled: true,
    version: 'WebGL 2.0',
    vendor: 'WebKit',
    renderer: 'WebKit WebGL',
    unmaskedVendor: gpu.vendor,
    unmaskedRenderer: gpu.renderer,
    maxTextureSize: gpu.maxTexture || 16384,
    maxViewportDims: [gpu.maxTexture || 32767, gpu.maxTexture || 32767],
    maxRenderbufferSize: gpu.maxTexture || 16384,
    shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)',
    extensions,
    antialiasing: true,
    gpuVendor: gpu.vendor.replace(/Google Inc\. \(|\)/g, '').split(',')[0].trim(),
    gpuRenderer: gpu.gpu,
    driverInfo: ''
  }
}

// ═══════════════════════════════════════════
// Step 9: Audio
// ═══════════════════════════════════════════

function generateAudio(rng: SeededRandom): AudioFingerprint {
  return {
    mode: 'noise',
    noiseSeed: rng.int(100000, 999999),
    sampleRate: rng.pick([44100, 48000]),
    channelCount: 2,
    maxChannelCount: rng.pick([2, 6]),
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCountMode: 'max',
    channelInterpretation: 'speakers'
  }
}

// ═══════════════════════════════════════════
// Step 10: ClientRects
// ═══════════════════════════════════════════

function generateClientRects(rng: SeededRandom): ClientRectsFingerprint {
  return {
    mode: 'noise',
    noiseSeed: rng.int(100000, 999999)
  }
}

// ═══════════════════════════════════════════
// Step 11: Fonts (OS-specific)
// ═══════════════════════════════════════════

function generateFonts(family: OSFamily, rng: SeededRandom): FontsFingerprint {
  const allFonts: string[] = (fontListsData as any)[family] || (fontListsData as any)['windows']

  // Use 60-90% of the OS font list to create variation
  const count = Math.max(rng.int(Math.floor(allFonts.length * 0.6), allFonts.length), 3)
  const shuffled = [...allFonts].sort(() => rng.next() - 0.5)
  const selectedFonts = shuffled.slice(0, count)

  const markers: Record<OSFamily, string[]> = {
    windows: ['Segoe UI', 'Arial'],
    macos: ['.AppleSystemUIFont', 'Helvetica'],
    linux: ['DejaVu Sans', 'Ubuntu'],
    android: ['Roboto', 'Droid Sans', 'Noto Sans']
  }
  const primaryMarkers = markers[family] || []
  if (primaryMarkers.length > 0 && !selectedFonts.some(f => primaryMarkers.includes(f))) {
    selectedFonts.push(rng.pick(primaryMarkers))
  }

  return {
    enableMasking: true,
    mode: 'automatic',
    fontList: selectedFonts.sort()
  }
}

// ═══════════════════════════════════════════
// Step 12: Media Devices
// ═══════════════════════════════════════════

function generateMediaDevices(family: OSFamily, rng: SeededRandom): MediaDevicesFingerprint {
  const isDesktop = family !== 'android'
  const videoInputs = isDesktop ? rng.pick([0, 1, 1, 1]) : rng.pick([1, 2])
  const audioInputs = rng.pick([1, 1, 1, 2])
  const audioOutputs = isDesktop ? rng.pick([1, 1, 2, 2, 3]) : 1

  // Generate stable device IDs
  const deviceIds: string[] = []
  for (let i = 0; i < videoInputs + audioInputs + audioOutputs; i++) {
    deviceIds.push(rng.hex(64))
  }

  const cameraLabels = Array.from({ length: videoInputs }, (_, i) =>
    isDesktop
      ? rng.pick(['Integrated Camera', 'HD WebCam', 'USB2.0 HD UVC WebCam', 'FaceTime HD Camera', 'Logitech HD Pro Webcam C920'])
      : i === 0 ? 'camera2 0, facing back' : 'camera2 1, facing front'
  )

  const micLabels = Array.from({ length: audioInputs }, () =>
    rng.pick(['Default', 'Internal Microphone', 'Built-in Microphone', 'Microphone Array'])
  )

  const speakerLabels = Array.from({ length: audioOutputs }, (_, i) =>
    i === 0 ? 'Default' : rng.pick(['External Headphones', 'Speakers (Realtek)', 'Built-in Output'])
  )

  return {
    videoInputs,
    audioInputs,
    audioOutputs,
    cameraLabels,
    microphoneLabels: micLabels,
    speakerLabels,
    deviceIds
  }
}

// ═══════════════════════════════════════════
// Step 13: Battery
// ═══════════════════════════════════════════

function generateBattery(family: OSFamily): BatteryFingerprint {
  // Desktop devices typically don't expose Battery API meaningfully
  // Android/laptop profiles can expose it
  const isLaptop = family === 'macos' || family === 'android'

  return {
    enabled: isLaptop,
    charging: true,
    level: 1.0,
    chargingTime: 0,
    dischargingTime: Infinity
  }
}

// ═══════════════════════════════════════════
// Step 14: Network Info
// ═══════════════════════════════════════════

function generateNetworkInfo(family: OSFamily): NetworkInfoFingerprint {
  return {
    effectiveType: '4g',
    downlink: family === 'android' ? 10 : 100,
    rtt: family === 'android' ? 100 : 50,
    saveData: false,
    type: family === 'android' ? 'cellular' : 'wifi'
  }
}

// ═══════════════════════════════════════════
// Step 15: Permissions
// ═══════════════════════════════════════════

function generatePermissions(): PermissionsFingerprint {
  return {
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

// ═══════════════════════════════════════════
// Step 16: Browser Config
// ═══════════════════════════════════════════

function generateBrowserConfig(): BrowserConfig {
  return {
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

// ═══════════════════════════════════════════
// Bulk Generation
// ═══════════════════════════════════════════

export interface BulkCreateOptions {
  count: number
  osType: OSType
  country?: string
  namePrefix?: string
}

export function generateBulkFingerprints(options: BulkCreateOptions): Fingerprint[] {
  const results: Fingerprint[] = []
  for (let i = 0; i < options.count; i++) {
    const seed = crypto.randomBytes(16).toString('hex')
    results.push(generateFingerprint({
      osType: options.osType,
      seed,
      country: options.country
    }))
  }
  return results
}

// ═══════════════════════════════════════════
// Regenerate (keep OS, generate new values)
// ═══════════════════════════════════════════

export function regenerateFingerprint(osType: OSType, country?: string): Fingerprint {
  return generateFingerprint({
    osType,
    seed: crypto.randomBytes(16).toString('hex'),
    country
  })
}
