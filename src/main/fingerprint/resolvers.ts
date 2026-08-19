// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Device Profile Resolver Pipeline
// Unified resolver that transforms a DeviceSelection into a
// fully resolved, internally consistent ResolvedRuntimeProfile.
//
// Pipeline: DeviceSelection → Template Lookup → Hardware Resolution
//   → Display Resolution → WebGL Resolution → UA Resolution
//   → Browser Compat Resolution → Validation → ResolvedRuntimeProfile
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import {
  OSType, getOSFamily,
  Fingerprint, DeviceSelection, ResolvedRuntimeProfile,
  ProfileConsistencyValidation, ProfileValidationIssue,
  createDefaultFingerprint
} from './types'
import {
  DeviceTemplate, getDeviceTemplateById,
  getDefaultDeviceTemplate, findBestMatchingTemplate
} from './device-templates'
import {
  getEngineForBrowser, buildConsistentUA, getNavigatorVendor,
  getNavigatorPlatform, buildAppVersion, getNotABrandVersion,
  validateBrowserCompat
} from './browser-compat-matrix'
import { SeededRandom } from './generator'

// ═══════════════════════════════════════════
// Master Resolver — Single Entry Point
// ═══════════════════════════════════════════

/**
 * Resolves a user's DeviceSelection into a complete, immutable
 * ResolvedRuntimeProfile with full fingerprint and validation.
 *
 * This is the "Single Source of Truth" — all hardware, display, GPU,
 * WebGL, touch, media, and font values come from the device template.
 */
export function resolveDeviceProfile(selection: DeviceSelection): ResolvedRuntimeProfile {
  const { osType, browserType, browserVersion, seed } = selection
  const masterSeed = seed || crypto.randomBytes(16).toString('hex')
  const rng = new SeededRandom(masterSeed)

  // 1. Resolve device template
  const template = selection.deviceTemplateId
    ? getDeviceTemplateById(selection.deviceTemplateId) || getDefaultDeviceTemplate(osType)
    : getDefaultDeviceTemplate(osType)

  // 2. Resolve browser engine
  const engine = getEngineForBrowser(osType, browserType)

  // 3. Build the complete fingerprint from the template
  const fingerprint = buildFingerprintFromTemplate(template, browserType, browserVersion, engine, masterSeed, rng)

  // 4. Validate consistency
  const validation = validateResolvedProfile(fingerprint, template, browserType, browserVersion, osType)

  return {
    deviceTemplateId: template.deviceId,
    deviceModel: template.model,
    deviceManufacturer: template.manufacturer,
    deviceType: template.deviceType,
    category: template.category,
    browserType,
    browserEngine: engine,
    browserVersion,
    fingerprint,
    validation,
    profileSchemaVersion: 3,
    resolvedAt: new Date().toISOString(),
    isLegacy: false
  }
}

/**
 * Resolve a legacy fingerprint (v2, no deviceTemplateId) into a
 * ResolvedRuntimeProfile. Non-destructive: finds the best matching
 * template and validates against it.
 */
export function resolveLegacyProfile(
  existingFp: Fingerprint,
  osType: OSType,
  browserType: 'chrome' | 'firefox',
  browserVersion: string
): ResolvedRuntimeProfile {
  const template = findBestMatchingTemplate(existingFp, osType)
  const engine = getEngineForBrowser(osType, browserType)

  // Validate the existing fingerprint against the best-match template
  const validation = validateResolvedProfile(existingFp, template, browserType, browserVersion, osType)

  return {
    deviceTemplateId: template.deviceId,
    deviceModel: template.model,
    deviceManufacturer: template.manufacturer,
    deviceType: template.deviceType,
    category: template.category,
    browserType,
    browserEngine: engine,
    browserVersion,
    fingerprint: existingFp,
    validation,
    profileSchemaVersion: 2,
    resolvedAt: new Date().toISOString(),
    isLegacy: true
  }
}

// ═══════════════════════════════════════════
// Fingerprint Builder from Device Template
// ═══════════════════════════════════════════

function buildFingerprintFromTemplate(
  template: DeviceTemplate,
  browserType: 'chrome' | 'firefox',
  browserVersion: string,
  engine: 'blink' | 'gecko' | 'webkit',
  seed: string,
  rng: SeededRandom
): Fingerprint {
  const fp = createDefaultFingerprint()
  const osType = template.operatingSystem
  const family = getOSFamily(osType)
  const isMobile = family === 'android' || family === 'ios'

  // ── Metadata ──
  fp.version = 3
  fp.generatedAt = new Date().toISOString()
  fp.seed = seed
  fp.osType = osType

  // ── Navigator ──
  const userAgent = buildConsistentUA({
    osType,
    browserType,
    browserVersion,
    deviceModel: template.model,
    osVersion: template.osVersion,
    architecture: template.architecture
  })

  fp.navigator = {
    userAgent,
    browserVersion,
    chromiumVersion: browserVersion.split('.')[0],
    platform: template.platform,
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: buildAppVersion(userAgent),
    product: 'Gecko',
    productSub: browserType === 'firefox' ? '20100101' : '20030107',
    vendor: getNavigatorVendor(browserType, osType),
    vendorSub: '',
    hardwareConcurrency: template.cpuThreads,
    deviceMemory: template.memoryGB,
    cpuArchitecture: template.architecture,
    platformArchitecture: template.platformArchitecture,
    maxTouchPoints: template.maxTouchPoints,
    touchSupport: template.touchSupport,
    doNotTrack: null,
    cookieEnabled: true,
    pdfViewerEnabled: template.pdfViewerEnabled,
    javaEnabled: false,
    webdriver: false,
    localStorageEnabled: true,
    sessionStorageEnabled: true,
    indexedDBEnabled: true,
    webSQLEnabled: false
  }

  // ── Screen & Display ──
  const taskbarHeight = isMobile ? 0 : (family === 'macos' ? 25 : family === 'linux' ? 27 : 40)
  fp.screen = {
    width: template.screenWidth,
    height: template.screenHeight,
    availWidth: template.screenWidth,
    availHeight: isMobile ? template.screenHeight : template.screenHeight - taskbarHeight,
    colorDepth: template.colorDepth,
    pixelDepth: template.pixelDepth,
    devicePixelRatio: template.devicePixelRatio,
    orientation: template.orientation,
    orientationAngle: template.orientation === 'portrait-primary' ? 0 : 0,
    viewportWidth: template.viewportWidth,
    viewportHeight: template.viewportHeight,
    outerWidth: template.viewportWidth,
    outerHeight: template.viewportHeight + (isMobile ? 0 : 71),
    screenX: 0,
    screenY: 0,
    isMultiMonitor: false,
    isPrimaryDisplay: true
  }

  // ── WebGL ──
  const webglProfile = template.webglProfile
  fp.webgl = {
    enabled: true,
    version: webglProfile.version,
    vendor: webglProfile.vendor,
    renderer: webglProfile.renderer,
    unmaskedVendor: webglProfile.unmaskedVendor,
    unmaskedRenderer: webglProfile.unmaskedRenderer,
    maxTextureSize: webglProfile.maxTextureSize,
    maxViewportDims: webglProfile.maxViewportDims,
    maxRenderbufferSize: webglProfile.maxRenderbufferSize,
    shadingLanguageVersion: webglProfile.shadingLanguageVersion,
    extensions: [],
    antialiasing: webglProfile.antialiasing,
    gpuVendor: template.gpuVendor,
    gpuRenderer: template.gpuModel,
    driverInfo: ''
  }

  // ── Fonts ──
  fp.fonts = {
    enableMasking: true,
    mode: 'automatic',
    fontList: [...template.fontFamilies]
  }

  // ── Media Devices ──
  const md = template.mediaDevices
  fp.mediaDevices = {
    videoInputs: md.videoInputs,
    audioInputs: md.audioInputs,
    audioOutputs: md.audioOutputs,
    cameraLabels: [...md.cameraLabels],
    microphoneLabels: [...md.microphoneLabels],
    speakerLabels: [...md.speakerLabels],
    deviceIds: Array.from({ length: md.videoInputs + md.audioInputs + md.audioOutputs }, () => rng.hex(64))
  }

  // ── Battery ──
  fp.battery = {
    enabled: template.batteryApi,
    charging: template.batteryApi ? (rng.next() > 0.3) : true,
    level: template.batteryApi ? (0.2 + rng.next() * 0.8) : 1.0,
    chargingTime: 0,
    dischargingTime: template.batteryApi ? (3600 + rng.int(0, 14400)) : Infinity
  }

  // ── Network Info ──
  fp.networkInfo = {
    effectiveType: '4g',
    downlink: template.networkDownlink,
    rtt: template.networkRtt,
    saveData: false,
    type: template.networkType
  }

  // ── Locale (defaults, can be overridden) ──
  fp.locale = {
    language: template.languageDefaults[0] || 'en-US',
    languages: [...template.languageDefaults],
    country: 'US',
    region: '',
    currency: 'USD',
    numberFormat: 'en-US',
    dateFormat: 'M/d/yyyy',
    firstDayOfWeek: 0,
    measurementSystem: 'imperial',
    hourCycle: '12h'
  }

  // ── Timezone (defaults, can be overridden) ──
  const tz = rng.pick(template.timezoneDefaults) || 'America/New_York'
  fp.timezone = {
    mode: 'manual',
    timezone: tz,
    utcOffset: -300,
    hasDST: true,
    dstOffset: 60
  }

  // ── Geolocation ──
  fp.geolocation = {
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

  // ── WebRTC ──
  fp.webrtc = {
    mode: 'real',
    ipPolicy: 'default_public_interface_only',
    localIP: '',
    publicIP: ''
  }

  // ── Canvas ──
  fp.canvas = {
    mode: 'noise',
    noiseSeed: rng.int(1, 2147483647)
  }

  // ── Audio ──
  fp.audio = {
    mode: 'noise',
    noiseSeed: rng.int(1, 2147483647),
    sampleRate: 44100,
    channelCount: 2,
    maxChannelCount: isMobile ? 2 : 6,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCountMode: 'max',
    channelInterpretation: 'speakers'
  }

  // ── ClientRects ──
  fp.clientRects = {
    mode: 'noise',
    noiseSeed: rng.int(1, 2147483647)
  }

  // ── Permissions ──
  fp.permissions = {
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

  // ── Browser Config ──
  fp.browser = {
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
  }

  return fp
}

// ═══════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════

/**
 * Validates a resolved fingerprint against its device template.
 */
export function validateResolvedProfile(
  fp: Fingerprint,
  template: DeviceTemplate,
  browserType: 'chrome' | 'firefox',
  browserVersion: string,
  osType: OSType
): ProfileConsistencyValidation {
  const errors: ProfileValidationIssue[] = []
  const warnings: ProfileValidationIssue[] = []

  // ── Check 1: Screen Resolution matches template ──
  if (fp.screen?.width !== template.screenWidth || fp.screen?.height !== template.screenHeight) {
    errors.push({
      code: 'DEVICE_SCREEN_MISMATCH',
      field: 'screen.width/height',
      message: `Screen resolution ${fp.screen?.width}×${fp.screen?.height} does not match device template ${template.model} (${template.screenWidth}×${template.screenHeight})`,
      expected: `${template.screenWidth}×${template.screenHeight}`,
      actual: `${fp.screen?.width}×${fp.screen?.height}`,
      severity: 'error',
      remediation: `Set screen to ${template.screenWidth}×${template.screenHeight}`
    })
  }

  // ── Check 2: DPR matches template ──
  if (fp.screen?.devicePixelRatio !== template.devicePixelRatio) {
    errors.push({
      code: 'DEVICE_DPR_MISMATCH',
      field: 'screen.devicePixelRatio',
      message: `DPR ${fp.screen?.devicePixelRatio} does not match device template ${template.model} (${template.devicePixelRatio})`,
      expected: String(template.devicePixelRatio),
      actual: String(fp.screen?.devicePixelRatio),
      severity: 'error',
      remediation: `Set DPR to ${template.devicePixelRatio}`
    })
  }

  // ── Check 3: CPU threads match template ──
  if (fp.navigator?.hardwareConcurrency !== template.cpuThreads) {
    errors.push({
      code: 'DEVICE_CPU_MISMATCH',
      field: 'navigator.hardwareConcurrency',
      message: `CPU threads ${fp.navigator?.hardwareConcurrency} does not match device ${template.model} (${template.cpuThreads})`,
      expected: String(template.cpuThreads),
      actual: String(fp.navigator?.hardwareConcurrency),
      severity: 'error',
      remediation: `Set CPU threads to ${template.cpuThreads}`
    })
  }

  // ── Check 4: Memory matches template ──
  if (fp.navigator?.deviceMemory !== template.memoryGB) {
    warnings.push({
      code: 'DEVICE_MEMORY_MISMATCH',
      field: 'navigator.deviceMemory',
      message: `Memory ${fp.navigator?.deviceMemory}GB does not match device ${template.model} (${template.memoryGB}GB)`,
      expected: String(template.memoryGB),
      actual: String(fp.navigator?.deviceMemory),
      severity: 'warning',
      remediation: `Set memory to ${template.memoryGB}GB`
    })
  }

  // ── Check 5: GPU/WebGL matches template ──
  if (fp.webgl?.unmaskedRenderer && fp.webgl.unmaskedRenderer !== template.webglProfile.unmaskedRenderer) {
    errors.push({
      code: 'DEVICE_GPU_MISMATCH',
      field: 'webgl.unmaskedRenderer',
      message: `WebGL renderer does not match device ${template.model}`,
      expected: template.webglProfile.unmaskedRenderer,
      actual: fp.webgl.unmaskedRenderer,
      severity: 'error',
      remediation: `Set WebGL renderer to ${template.webglProfile.unmaskedRenderer}`
    })
  }

  // ── Check 6: Platform matches OS ──
  const expectedPlatform = template.platform
  if (fp.navigator?.platform && fp.navigator.platform !== expectedPlatform) {
    errors.push({
      code: 'PLATFORM_MISMATCH',
      field: 'navigator.platform',
      message: `Platform "${fp.navigator.platform}" does not match ${template.model} ("${expectedPlatform}")`,
      expected: expectedPlatform,
      actual: fp.navigator.platform,
      severity: 'error',
      remediation: `Set platform to "${expectedPlatform}"`
    })
  }

  // ── Check 7: Touch support matches device type ──
  const isMobile = template.deviceType === 'mobile' || template.deviceType === 'tablet'
  if (fp.navigator?.touchSupport !== template.touchSupport) {
    warnings.push({
      code: 'TOUCH_MISMATCH',
      field: 'navigator.touchSupport',
      message: `Touch support ${fp.navigator?.touchSupport} does not match device ${template.model} (${template.touchSupport})`,
      expected: String(template.touchSupport),
      actual: String(fp.navigator?.touchSupport),
      severity: 'warning'
    })
  }

  // ── Check 8: Browser compatibility ──
  const compatErrors = validateBrowserCompat(osType, browserType, browserVersion, fp)
  for (const err of compatErrors) {
    errors.push({
      code: 'BROWSER_COMPAT_ERROR',
      field: 'browser',
      message: err,
      severity: 'error'
    })
  }

  // ── Check 9: Firefox must not have Google Inc. vendor ──
  if (browserType === 'firefox' && getEngineForBrowser(osType, browserType) !== 'webkit') {
    if (fp.navigator?.vendor && fp.navigator.vendor !== '') {
      errors.push({
        code: 'FIREFOX_VENDOR_ERROR',
        field: 'navigator.vendor',
        message: 'Firefox navigator.vendor must be empty string',
        expected: '""',
        actual: `"${fp.navigator.vendor}"`,
        severity: 'error',
        remediation: 'Set vendor to empty string'
      })
    }
  }

  // ── Check 10: Mobile device must not have desktop orientation ──
  if (isMobile && fp.screen?.orientation === 'landscape-primary') {
    warnings.push({
      code: 'MOBILE_ORIENTATION_WARNING',
      field: 'screen.orientation',
      message: 'Mobile device has landscape orientation (unusual for phones)',
      severity: 'warning'
    })
  }

  // ── Check 11: iOS Chrome must use CriOS, iOS Firefox must use FxiOS ──
  if (osType === 'ios') {
    const ua = fp.navigator?.userAgent || ''
    if (browserType === 'chrome' && !ua.includes('CriOS')) {
      errors.push({
        code: 'IOS_CHROME_UA_ERROR',
        field: 'navigator.userAgent',
        message: 'iOS Chrome User-Agent must contain CriOS, not Chrome/',
        severity: 'error'
      })
    }
    if (browserType === 'firefox' && !ua.includes('FxiOS')) {
      errors.push({
        code: 'IOS_FIREFOX_UA_ERROR',
        field: 'navigator.userAgent',
        message: 'iOS Firefox User-Agent must contain FxiOS, not Gecko/',
        severity: 'error'
      })
    }
  }

  // ── Check 12: Windows/Linux must not have Apple GPU ──
  const family = getOSFamily(osType)
  if ((family === 'windows' || family === 'linux') && template.gpuVendor === 'Apple') {
    errors.push({
      code: 'GPU_OS_MISMATCH',
      field: 'webgl.gpuVendor',
      message: `Apple GPU is not compatible with ${osType}`,
      severity: 'error'
    })
  }

  // ── Check 13: Mobile must not have desktop-class GPU ──
  if (isMobile) {
    const gpuRenderer = (fp.webgl?.unmaskedRenderer || '').toLowerCase()
    if (gpuRenderer.includes('geforce') || gpuRenderer.includes('radeon rx') || gpuRenderer.includes('direct3d')) {
      errors.push({
        code: 'MOBILE_DESKTOP_GPU',
        field: 'webgl.unmaskedRenderer',
        message: 'Mobile device has desktop-class GPU renderer string',
        severity: 'error'
      })
    }
  }

  // Calculate score
  const totalChecks = errors.length + warnings.length + 13 // 13 checks total
  const passedChecks = 13 - errors.length
  const score = Math.max(0, Math.round((passedChecks / 13) * 100))

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings
  }
}

// ═══════════════════════════════════════════
// Helper: Merge user overrides into resolved profile
// ═══════════════════════════════════════════

/**
 * Apply user-level overrides (locale, timezone, proxy, etc.)
 * to a resolved profile without breaking device consistency.
 * Only "soft" fields (locale, timezone, geo, webrtc) can be overridden.
 */
export function applyUserOverrides(
  profile: ResolvedRuntimeProfile,
  overrides: {
    locale?: { language?: string; languages?: string[] }
    timezone?: { timezone?: string }
    geolocation?: { mode?: string; latitude?: number; longitude?: number }
    webrtc?: { mode?: string; ipPolicy?: string }
  }
): ResolvedRuntimeProfile {
  const fp = { ...profile.fingerprint }

  if (overrides.locale) {
    fp.locale = {
      ...fp.locale,
      ...(overrides.locale.language ? { language: overrides.locale.language } : {}),
      ...(overrides.locale.languages ? { languages: overrides.locale.languages } : {})
    }
  }

  if (overrides.timezone?.timezone) {
    fp.timezone = { ...fp.timezone, timezone: overrides.timezone.timezone }
  }

  if (overrides.geolocation) {
    fp.geolocation = { ...fp.geolocation, ...overrides.geolocation } as any
  }

  if (overrides.webrtc) {
    fp.webrtc = { ...fp.webrtc, ...overrides.webrtc } as any
  }

  return { ...profile, fingerprint: fp }
}
