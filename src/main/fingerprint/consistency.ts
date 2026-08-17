// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Fingerprint Consistency Engine
// Validates cross-parameter coherence and returns a consistency score.
// "Don't make random fingerprint the core feature.
//  Make consistent fingerprint the core feature."
// ──────────────────────────────────────────────────────────────────

import {
  OSType, OSFamily, getOSFamily,
  Fingerprint, ConsistencyResult, ConsistencyCheck, ConsistencyStatus,
  StabilityWarning, StabilityWarningLevel, CORE_FINGERPRINT_FIELDS
} from './types'
import fontListsData from './datasets/font-lists.json'

// ═══════════════════════════════════════════
// Consistency Validator
// ═══════════════════════════════════════════

/**
 * Run all consistency checks on a fingerprint and return a scored result.
 * Each check has a severity (1-10). The final score is weighted:
 *   score = 100 - sum(failed_severities) - sum(warned_severities * 0.3)
 */
export function validateConsistency(fingerprint: Fingerprint, osType: OSType): ConsistencyResult {
  const checks: ConsistencyCheck[] = []
  const family = getOSFamily(osType)

  // Run all checks
  checks.push(checkOsUserAgent(fingerprint, osType))
  checks.push(checkOsFonts(fingerprint, family))
  checks.push(checkOsPlatform(fingerprint, osType))
  checks.push(checkBrowserUserAgent(fingerprint))
  checks.push(checkScreenDPR(fingerprint))
  checks.push(checkGpuOs(fingerprint, family))
  checks.push(checkWebGLGpu(fingerprint))
  checks.push(checkLanguageLocale(fingerprint))
  checks.push(checkTimezoneLocation(fingerprint))
  checks.push(checkMediaDeviceType(fingerprint, family))
  checks.push(checkCpuArchitecture(fingerprint, family))
  checks.push(checkRamDeviceClass(fingerprint, family))
  checks.push(checkTouchOs(fingerprint, family))
  checks.push(checkViewportScreen(fingerprint))
  checks.push(checkWebRTCConsistency(fingerprint))

  // Calculate score
  const totalSeverity = checks.reduce((sum, c) => sum + c.severity, 0)
  let penalty = 0
  for (const check of checks) {
    if (check.status === 'fail') penalty += check.severity
    else if (check.status === 'warn') penalty += check.severity * 0.3
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / totalSeverity) * 100)))

  return {
    score,
    totalChecks: checks.length,
    passedChecks: checks.filter(c => c.status === 'pass').length,
    warnings: checks.filter(c => c.status === 'warn').length,
    failures: checks.filter(c => c.status === 'fail').length,
    checks
  }
}

// ═══════════════════════════════════════════
// Individual Check Functions
// ═══════════════════════════════════════════

function makeCheck(
  id: string,
  category: string,
  left: string,
  right: string,
  status: ConsistencyStatus,
  message: string,
  severity: number
): ConsistencyCheck {
  return { id, category, left, right, status, message, severity }
}

/**
 * Check 1: OS ↔ User-Agent
 * The User-Agent string must contain the correct OS identifier.
 */
function checkOsUserAgent(fp: Fingerprint, osType: OSType): ConsistencyCheck {
  const ua = fp.navigator.userAgent
  const id = 'os-ua'
  const cat = 'OS ↔ User-Agent'

  const osPatterns: Record<OSType, string[]> = {
    'windows-10': ['Windows NT 10.0'],
    'windows-11': ['Windows NT 10.0'],   // Win11 still reports NT 10.0
    'macos-intel': ['Macintosh', 'Mac OS X'],
    'macos-arm': ['Macintosh', 'Mac OS X'],
    'linux': ['Linux x86_64', 'X11'],
    'android': ['Android', 'Linux']
  }

  const patterns = osPatterns[osType] || []
  const matches = patterns.some(p => ua.includes(p))

  if (!matches) {
    return makeCheck(id, cat, osType, ua.substring(0, 60), 'fail',
      `User-Agent "${ua.substring(0, 60)}..." does not match OS "${osType}"`, 10)
  }

  return makeCheck(id, cat, osType, 'UA matches', 'pass',
    'User-Agent correctly identifies the operating system', 10)
}

/**
 * Check 2: OS ↔ Fonts
 * Font list should contain OS-specific fonts.
 */
function checkOsFonts(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'os-fonts'
  const cat = 'OS ↔ Fonts'

  if (!fp.fonts.enableMasking || fp.fonts.fontList.length === 0) {
    return makeCheck(id, cat, family, 'No font list', 'warn',
      'Font masking is disabled or font list is empty', 6)
  }

  const osFonts = (fontListsData as any)[family] || []
  const userFonts = new Set(fp.fonts.fontList)

  // Check for OS-specific marker fonts
  const markers: Record<OSFamily, string[]> = {
    windows: ['Segoe UI', 'Calibri', 'Consolas', 'Arial', 'Cambria', 'Verdana', 'Tahoma', 'Georgia'],
    macos: ['.AppleSystemUIFont', 'Helvetica', 'SF Pro', 'Menlo', 'Monaco', 'Geneva'],
    linux: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans'],
    android: ['Roboto', 'Droid Sans', 'Noto Sans']
  }

  const expected = markers[family] || []
  const found = expected.filter(f => userFonts.has(f))

  if (found.length === 0 && expected.length > 0) {
    return makeCheck(id, cat, family, fp.fonts.fontList.slice(0, 3).join(', '), 'fail',
      `Font list lacks characteristic ${family} fonts (expected: ${expected.join(', ')})`, 7)
  }

  // Check for cross-OS contamination
  const otherFamilies: OSFamily[] = (['windows', 'macos', 'linux', 'android'] as OSFamily[]).filter(f => f !== family)
  for (const otherFamily of otherFamilies) {
    const otherMarkers = markers[otherFamily]
    const contamination = otherMarkers.filter(f => userFonts.has(f))
    if (contamination.length >= 2) {
      return makeCheck(id, cat, family, contamination.join(', '), 'warn',
        `Font list contains ${otherFamily}-specific fonts: ${contamination.join(', ')}`, 5)
    }
  }

  return makeCheck(id, cat, family, `${found.length}/${expected.length} markers found`, 'pass',
    'Font list is consistent with the operating system', 7)
}

/**
 * Check 3: OS ↔ Platform
 * navigator.platform must match the OS.
 */
function checkOsPlatform(fp: Fingerprint, osType: OSType): ConsistencyCheck {
  const id = 'os-platform'
  const cat = 'OS ↔ Platform'
  const platform = fp.navigator.platform

  const validPlatforms: Record<OSType, string[]> = {
    'windows-10': ['Win32'],
    'windows-11': ['Win32'],
    'macos-intel': ['MacIntel'],
    'macos-arm': ['MacIntel'],
    'linux': ['Linux x86_64', 'Linux i686'],
    'android': ['Linux armv81', 'Linux armv8l', 'Linux aarch64']
  }

  const valid = validPlatforms[osType] || []
  if (!valid.includes(platform)) {
    return makeCheck(id, cat, osType, platform, 'fail',
      `Platform "${platform}" is not valid for ${osType} (expected: ${valid.join(' or ')})`, 9)
  }

  return makeCheck(id, cat, osType, platform, 'pass',
    'Platform string matches the operating system', 9)
}

/**
 * Check 4: Browser ↔ User-Agent
 * Browser version in user-agent must match reported version.
 */
function checkBrowserUserAgent(fp: Fingerprint): ConsistencyCheck {
  const id = 'browser-ua'
  const cat = 'Browser ↔ User-Agent'
  const ua = fp.navigator.userAgent
  const version = fp.navigator.browserVersion

  if (!version) {
    return makeCheck(id, cat, 'Browser version', 'Empty', 'warn',
      'Browser version is not set', 5)
  }

  if (!ua.includes(`Chrome/${version}`)) {
    return makeCheck(id, cat, version, ua.substring(0, 60), 'fail',
      `User-Agent does not contain Chrome/${version}`, 8)
  }

  return makeCheck(id, cat, version, 'Matches UA', 'pass',
    'Browser version matches the User-Agent string', 8)
}

/**
 * Check 5: Screen ↔ DPR
 * Device pixel ratio should be plausible for the resolution.
 */
function checkScreenDPR(fp: Fingerprint): ConsistencyCheck {
  const id = 'screen-dpr'
  const cat = 'Screen ↔ DPR'
  const { width, height, devicePixelRatio: dpr, viewportWidth, viewportHeight } = fp.screen

  // Basic sanity: DPR should be between 1 and 4
  if (dpr < 0.5 || dpr > 4) {
    return makeCheck(id, cat, `${width}x${height}`, `DPR ${dpr}`, 'fail',
      `Device pixel ratio ${dpr} is outside plausible range (0.5-4)`, 6)
  }

  // Viewport should be <= screen / DPR (approximately)
  const expectedMaxViewport = Math.ceil(width / dpr) + 50 // small tolerance
  if (viewportWidth > expectedMaxViewport) {
    return makeCheck(id, cat, `Viewport ${viewportWidth}`, `Screen/DPR = ${Math.ceil(width / dpr)}`, 'warn',
      `Viewport width (${viewportWidth}) seems too large for ${width}px screen at ${dpr}x DPR`, 5)
  }

  return makeCheck(id, cat, `${width}x${height} @${dpr}x`, `Viewport ${viewportWidth}x${viewportHeight}`, 'pass',
    'Screen resolution, DPR, and viewport dimensions are consistent', 6)
}

/**
 * Check 6: GPU ↔ OS
 * GPU vendor/renderer should be plausible for the OS.
 */
function checkGpuOs(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'gpu-os'
  const cat = 'GPU ↔ OS'

  if (!fp.webgl.enabled) {
    return makeCheck(id, cat, family, 'WebGL disabled', 'pass',
      'WebGL is disabled, GPU check skipped', 7)
  }

  const renderer = fp.webgl.unmaskedRenderer.toLowerCase()
  const vendor = fp.webgl.unmaskedVendor.toLowerCase()

  // Windows uses Direct3D ANGLE, macOS uses OpenGL/Metal, Linux uses OpenGL
  if (family === 'windows') {
    if (!renderer.includes('direct3d') && !renderer.includes('d3d') && !renderer.includes('vulkan')) {
      return makeCheck(id, cat, family, fp.webgl.gpuRenderer, 'warn',
        `Windows GPU renderer usually contains "Direct3D" but got: ${fp.webgl.unmaskedRenderer.substring(0, 50)}`, 6)
    }
  } else if (family === 'macos') {
    if (!renderer.includes('opengl') && !renderer.includes('metal') && !renderer.includes('apple')) {
      return makeCheck(id, cat, family, fp.webgl.gpuRenderer, 'warn',
        `macOS GPU renderer usually contains "OpenGL" or "Apple" but got: ${fp.webgl.unmaskedRenderer.substring(0, 50)}`, 6)
    }
  }

  return makeCheck(id, cat, family, fp.webgl.gpuRenderer, 'pass',
    'GPU renderer is consistent with the operating system', 7)
}

/**
 * Check 7: WebGL ↔ GPU
 * WebGL renderer info should match GPU identity.
 */
function checkWebGLGpu(fp: Fingerprint): ConsistencyCheck {
  const id = 'webgl-gpu'
  const cat = 'WebGL ↔ GPU'

  if (!fp.webgl.enabled) {
    return makeCheck(id, cat, 'WebGL', 'Disabled', 'pass', 'WebGL is disabled', 5)
  }

  const renderer = fp.webgl.unmaskedRenderer
  const gpuName = fp.webgl.gpuRenderer

  if (gpuName && !renderer.toLowerCase().includes(gpuName.toLowerCase().split(' ')[0])) {
    return makeCheck(id, cat, gpuName, renderer.substring(0, 50), 'warn',
      `GPU renderer "${gpuName}" doesn't appear in WebGL unmasked renderer`, 5)
  }

  return makeCheck(id, cat, gpuName, 'WebGL consistent', 'pass',
    'WebGL renderer matches GPU identity', 5)
}

/**
 * Check 8: Language ↔ Locale
 * navigator.language should match locale settings.
 */
function checkLanguageLocale(fp: Fingerprint): ConsistencyCheck {
  const id = 'lang-locale'
  const cat = 'Language ↔ Locale'
  const lang = fp.locale.language
  const navLang = fp.navigator.userAgent // Check lang param in UA if set

  if (!lang) {
    return makeCheck(id, cat, 'Language', 'Not set', 'warn',
      'Language is not configured', 4)
  }

  // navigator.languages should include the primary language
  if (fp.locale.languages.length === 0) {
    return makeCheck(id, cat, lang, 'Empty languages[]', 'warn',
      'navigator.languages is empty', 4)
  }

  if (fp.locale.languages[0] !== lang) {
    return makeCheck(id, cat, lang, fp.locale.languages[0], 'fail',
      `Primary language "${lang}" should be first in languages array but found "${fp.locale.languages[0]}"`, 6)
  }

  // Check language matches country
  const countryLangMap: Record<string, string[]> = {
    'US': ['en-US', 'en'], 'GB': ['en-GB', 'en'], 'DE': ['de-DE', 'de'], 'FR': ['fr-FR', 'fr'],
    'ES': ['es-ES', 'es'], 'IT': ['it-IT', 'it'], 'JP': ['ja-JP', 'ja'], 'KR': ['ko-KR', 'ko'],
    'CN': ['zh-CN', 'zh'], 'BR': ['pt-BR', 'pt'], 'RU': ['ru-RU', 'ru'], 'IN': ['en-IN', 'hi-IN'],
    'BD': ['bn-BD', 'en'], 'TR': ['tr-TR', 'tr'], 'NL': ['nl-NL', 'nl'], 'PL': ['pl-PL', 'pl'],
    'AU': ['en-AU', 'en'], 'CA': ['en-CA', 'fr-CA']
  }

  const expectedLangs = countryLangMap[fp.locale.country]
  if (expectedLangs && !expectedLangs.includes(lang)) {
    return makeCheck(id, cat, `${lang} (${fp.locale.country})`, expectedLangs.join(', '), 'warn',
      `Language "${lang}" is unusual for country "${fp.locale.country}"`, 4)
  }

  return makeCheck(id, cat, lang, fp.locale.country, 'pass',
    'Language and locale settings are consistent', 6)
}

/**
 * Check 9: Timezone ↔ Location
 * Timezone should be geographically plausible for coordinates.
 */
function checkTimezoneLocation(fp: Fingerprint): ConsistencyCheck {
  const id = 'tz-location'
  const cat = 'Timezone ↔ Location'

  if (fp.geolocation.mode === 'block' || fp.geolocation.mode === 'ask') {
    return makeCheck(id, cat, fp.timezone.timezone, 'Geo blocked/prompt', 'pass',
      'Geolocation is blocked or prompting, timezone check not applicable', 5)
  }

  // Basic hemisphere check
  const lon = fp.geolocation.longitude
  const tz = fp.timezone.timezone

  // Very rough check: Americas should have negative offsets, Asia/Pacific positive
  if (lon < -30 && fp.timezone.utcOffset > 240) {
    return makeCheck(id, cat, tz, `Lon: ${lon}`, 'fail',
      `Timezone "${tz}" (UTC+${fp.timezone.utcOffset / 60}) is geographically implausible for longitude ${lon}`, 7)
  }
  if (lon > 30 && fp.timezone.utcOffset < -240) {
    return makeCheck(id, cat, tz, `Lon: ${lon}`, 'fail',
      `Timezone "${tz}" (UTC${fp.timezone.utcOffset / 60}) is geographically implausible for longitude ${lon}`, 7)
  }

  return makeCheck(id, cat, tz, `${fp.geolocation.latitude.toFixed(2)}, ${fp.geolocation.longitude.toFixed(2)}`, 'pass',
    'Timezone is geographically plausible for the configured location', 5)
}

/**
 * Check 10: Media Devices ↔ Device Type
 * Desktop should have ~1 camera, mobile can have 2.
 */
function checkMediaDeviceType(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'media-device'
  const cat = 'Media Devices ↔ Device Type'
  const isDesktop = family !== 'android'

  if (isDesktop && fp.mediaDevices.videoInputs > 3) {
    return makeCheck(id, cat, `${fp.mediaDevices.videoInputs} cameras`, 'Desktop', 'warn',
      `Desktop device with ${fp.mediaDevices.videoInputs} cameras is unusual`, 3)
  }

  if (!isDesktop && fp.mediaDevices.videoInputs === 0) {
    return makeCheck(id, cat, '0 cameras', 'Android', 'warn',
      'Android device with 0 cameras is unusual', 3)
  }

  return makeCheck(id, cat,
    `${fp.mediaDevices.videoInputs}V/${fp.mediaDevices.audioInputs}A/${fp.mediaDevices.audioOutputs}O`,
    isDesktop ? 'Desktop' : 'Mobile', 'pass',
    'Media device configuration matches device type', 3)
}

/**
 * Check 11: CPU ↔ Architecture
 * CPU cores should be plausible for the architecture.
 */
function checkCpuArchitecture(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'cpu-arch'
  const cat = 'CPU ↔ Architecture'
  const cores = fp.navigator.hardwareConcurrency

  const maxCores: Record<OSFamily, number> = {
    windows: 128, macos: 24, linux: 128, android: 8
  }
  const minCores: Record<OSFamily, number> = {
    windows: 2, macos: 4, linux: 1, android: 2
  }

  if (cores < minCores[family]) {
    return makeCheck(id, cat, `${cores} cores`, family, 'warn',
      `${cores} CPU cores is unusually low for ${family}`, 4)
  }
  if (cores > maxCores[family]) {
    return makeCheck(id, cat, `${cores} cores`, family, 'fail',
      `${cores} CPU cores exceeds maximum for ${family} (${maxCores[family]})`, 6)
  }

  return makeCheck(id, cat, `${cores} cores`, fp.navigator.cpuArchitecture, 'pass',
    'CPU core count is plausible for the architecture', 4)
}

/**
 * Check 12: RAM ↔ Device Class
 * Memory should be plausible for the device type.
 */
function checkRamDeviceClass(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'ram-class'
  const cat = 'RAM ↔ Device Class'
  const mem = fp.navigator.deviceMemory

  const ranges: Record<OSFamily, [number, number]> = {
    windows: [2, 128],
    macos: [4, 192],
    linux: [1, 128],
    android: [2, 16]
  }

  const [min, max] = ranges[family]
  if (mem < min || mem > max) {
    return makeCheck(id, cat, `${mem}GB`, family, 'fail',
      `${mem}GB RAM is outside plausible range for ${family} (${min}-${max}GB)`, 5)
  }

  return makeCheck(id, cat, `${mem}GB`, family, 'pass',
    'Device memory is plausible for the device class', 5)
}

/**
 * Check 13: Touch ↔ OS
 * Touch support should match OS type.
 */
function checkTouchOs(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'touch-os'
  const cat = 'Touch ↔ OS'

  if (family === 'android' && !fp.navigator.touchSupport) {
    return makeCheck(id, cat, 'No touch', 'Android', 'fail',
      'Android device must support touch', 7)
  }
  if (family === 'android' && fp.navigator.maxTouchPoints === 0) {
    return makeCheck(id, cat, 'maxTouchPoints=0', 'Android', 'fail',
      'Android device must have maxTouchPoints > 0', 7)
  }
  if ((family === 'windows' || family === 'linux') && fp.navigator.maxTouchPoints > 0 && fp.navigator.touchSupport) {
    // This is actually valid for touchscreen laptops, just warn
    return makeCheck(id, cat, `maxTouchPoints=${fp.navigator.maxTouchPoints}`, family, 'warn',
      'Touch support on desktop is valid but less common', 3)
  }

  return makeCheck(id, cat, `Touch: ${fp.navigator.touchSupport}`, family, 'pass',
    'Touch support configuration matches the OS type', 7)
}

/**
 * Check 14: Viewport ↔ Screen
 * Viewport should be smaller than or equal to screen dimensions.
 */
function checkViewportScreen(fp: Fingerprint): ConsistencyCheck {
  const id = 'viewport-screen'
  const cat = 'Viewport ↔ Screen'
  const { width, height, viewportWidth, viewportHeight } = fp.screen

  if (viewportWidth > width + 10) {
    return makeCheck(id, cat, `Viewport ${viewportWidth}`, `Screen ${width}`, 'fail',
      `Viewport width (${viewportWidth}) exceeds screen width (${width})`, 6)
  }
  if (viewportHeight > height + 10) {
    return makeCheck(id, cat, `Viewport ${viewportHeight}`, `Screen ${height}`, 'warn',
      `Viewport height (${viewportHeight}) exceeds screen height (${height})`, 4)
  }

  return makeCheck(id, cat, `${viewportWidth}x${viewportHeight}`, `${width}x${height}`, 'pass',
    'Viewport dimensions fit within screen bounds', 6)
}

/**
 * Check 15: WebRTC Consistency
 * WebRTC should not expose conflicting IPs.
 */
function checkWebRTCConsistency(fp: Fingerprint): ConsistencyCheck {
  const id = 'webrtc-ip'
  const cat = 'WebRTC ↔ Network'

  if (fp.webrtc.mode === 'disabled') {
    return makeCheck(id, cat, 'WebRTC', 'Disabled', 'pass',
      'WebRTC is disabled — no IP leak risk', 5)
  }

  if (fp.webrtc.ipPolicy === 'disable_non_proxied_udp') {
    return makeCheck(id, cat, 'WebRTC', 'Non-proxied UDP disabled', 'pass',
      'WebRTC configured to prevent IP leaks via proxy', 5)
  }

  if (fp.webrtc.ipPolicy === 'default') {
    return makeCheck(id, cat, 'WebRTC', 'Default policy', 'warn',
      'WebRTC default policy may expose real IP when using a proxy', 6)
  }

  return makeCheck(id, cat, 'WebRTC', fp.webrtc.ipPolicy, 'pass',
    'WebRTC IP handling policy is appropriately configured', 5)
}

// ═══════════════════════════════════════════
// Profile Stability Warnings (Section 33)
// ═══════════════════════════════════════════

/**
 * Check if changing a fingerprint field on a used profile would
 * make it appear as a different device.
 */
export function getStabilityWarnings(
  oldFingerprint: Fingerprint,
  newFingerprint: Fingerprint,
  hasBeenUsed: boolean
): StabilityWarning[] {
  if (!hasBeenUsed) return []

  const warnings: StabilityWarning[] = []

  // Core parameters that should remain stable
  if (oldFingerprint.navigator.userAgent !== newFingerprint.navigator.userAgent) {
    warnings.push({
      field: 'User-Agent',
      level: 'danger',
      message: '⚠ Changing the User-Agent may make this profile appear as a different device.'
    })
  }

  if (oldFingerprint.screen.width !== newFingerprint.screen.width ||
      oldFingerprint.screen.height !== newFingerprint.screen.height) {
    warnings.push({
      field: 'Screen Resolution',
      level: 'danger',
      message: '⚠ Changing screen resolution may make this profile appear as a different device.'
    })
  }

  if (oldFingerprint.webgl.unmaskedRenderer !== newFingerprint.webgl.unmaskedRenderer) {
    warnings.push({
      field: 'WebGL Renderer',
      level: 'danger',
      message: '⚠ Changing the GPU renderer may make this profile appear as a different device.'
    })
  }

  if (oldFingerprint.canvas.noiseSeed !== newFingerprint.canvas.noiseSeed) {
    warnings.push({
      field: 'Canvas Seed',
      level: 'caution',
      message: 'Changing the canvas noise seed will change this profile\'s canvas fingerprint.'
    })
  }

  if (oldFingerprint.audio.noiseSeed !== newFingerprint.audio.noiseSeed) {
    warnings.push({
      field: 'Audio Seed',
      level: 'caution',
      message: 'Changing the audio noise seed will change this profile\'s audio fingerprint.'
    })
  }

  if (JSON.stringify(oldFingerprint.fonts.fontList) !== JSON.stringify(newFingerprint.fonts.fontList)) {
    warnings.push({
      field: 'Font List',
      level: 'caution',
      message: 'Changing the font list may affect font fingerprint detection.'
    })
  }

  if (oldFingerprint.navigator.hardwareConcurrency !== newFingerprint.navigator.hardwareConcurrency) {
    warnings.push({
      field: 'CPU Cores',
      level: 'caution',
      message: 'Changing CPU core count may make this profile appear as a different device.'
    })
  }

  if (oldFingerprint.navigator.deviceMemory !== newFingerprint.navigator.deviceMemory) {
    warnings.push({
      field: 'Device Memory',
      level: 'caution',
      message: 'Changing device memory may make this profile appear as a different device.'
    })
  }

  return warnings
}
