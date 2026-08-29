// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Fingerprint Consistency Engine
// Validates cross-parameter coherence, flags contradictions, and returns
// a consistency score for legitimate privacy and compatibility testing.
// Includes v3 device-template-aware validation checks.
// ──────────────────────────────────────────────────────────────────

import {
  OSType, OSFamily, getOSFamily,
  Fingerprint, ConsistencyResult, ConsistencyCheck, ConsistencyStatus,
  StabilityWarning, StabilityWarningLevel, CORE_FINGERPRINT_FIELDS
} from './types'
import { DeviceTemplate, getDeviceTemplateById, findBestMatchingTemplate } from './device-templates'
import { getEngineForBrowser, validateBrowserCompat } from './browser-compat-matrix'
import fontListsData from './datasets/font-lists.json'

// ═══════════════════════════════════════════
// Consistency Validator
// ═══════════════════════════════════════════

/**
 * Run all consistency checks on a fingerprint and return a scored result.
 * Each check has a severity (1-10). The final score is weighted:
 *   score = 100 - sum(failed_severities) - sum(warned_severities * 0.3)
 *
 * v3: Optionally accepts a deviceTemplateId for template-locked checks.
 */
export function validateConsistency(
  fingerprint: Fingerprint,
  osType: OSType,
  browserType?: 'chrome' | 'firefox',
  browserVersion?: string,
  deviceTemplateId?: string
): ConsistencyResult {
  const checks: ConsistencyCheck[] = []
  const family = getOSFamily(osType)
  const bType = browserType || fingerprint?.browser?.type || (fingerprint?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
  const bVer = browserVersion || fingerprint?.browser?.version || fingerprint?.navigator?.browserVersion

  // Run all consistency & contradiction checks
  checks.push(checkOsUserAgent(fingerprint, osType))
  checks.push(checkOsPlatform(fingerprint, osType))
  checks.push(checkBrowserUserAgent(fingerprint, bType, bVer, osType))
  checks.push(checkBrowserEngineProperties(fingerprint, bType))
  checks.push(checkProcessorHardwareConsistency(fingerprint, osType))
  checks.push(checkScreenDPR(fingerprint, family, osType))
  checks.push(checkGpuOs(fingerprint, family, osType))
  checks.push(checkWebGLGpu(fingerprint))
  checks.push(checkTouchOs(fingerprint, family))
  checks.push(checkCpuArchitecture(fingerprint, family, osType))
  checks.push(checkRamDeviceClass(fingerprint, family, osType))
  checks.push(checkViewportScreen(fingerprint))
  checks.push(checkLanguageLocale(fingerprint))
  checks.push(checkTimezoneLocation(fingerprint))
  checks.push(checkMediaDeviceType(fingerprint, family))
  checks.push(checkOsFonts(fingerprint, family))
  checks.push(checkWebRTCConsistency(fingerprint))

  // v3: iOS User-Agent engine check
  if (osType === 'ios') {
    checks.push(checkIosUaEngine(fingerprint, bType))
  }

  // v3: Device template-locked checks
  const template = deviceTemplateId
    ? getDeviceTemplateById(deviceTemplateId)
    : null

  if (template) {
    checks.push(checkDeviceTemplateScreenMatch(fingerprint, template))
    checks.push(checkDeviceTemplateGpuMatch(fingerprint, template))
    checks.push(checkDeviceTemplateCpuRamMatch(fingerprint, template))
  }

  // v3: Browser compatibility matrix validation
  if (bType && bVer) {
    const compatErrors = validateBrowserCompat(osType, bType, bVer, fingerprint)
    for (const err of compatErrors) {
      checks.push(makeCheck('browser-compat', 'Browser Compat Matrix', bType, osType, 'fail', err, 8))
    }
  }

  // Calculate score
  const totalSeverity = checks.reduce((sum, c) => sum + c.severity, 0)
  let penalty = 0
  for (const check of checks) {
    if (check.status === 'fail') penalty += check.severity
    else if (check.status === 'warn') penalty += check.severity * 0.3
  }

  const failures = checks.filter(c => c.status === 'fail')
  const warnings = checks.filter(c => c.status === 'warn')
  const contradictions = failures.map(f => f.message)

  let calculatedScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / totalSeverity) * 100)))
  // If there are critical failures / contradictions, cap the score below pass threshold (max 50%)
  if (failures.length > 0) {
    calculatedScore = Math.min(calculatedScore, Math.max(0, 50 - (failures.length - 1) * 10))
  }

  // Determine status: only minor warnings (severity ≤ 5) with high score (≥ 95) → still 'pass'
  const hasCriticalWarnings = warnings.some(w => w.severity > 5)
  const status: 'pass' | 'warn' | 'fail' =
    failures.length > 0
      ? 'fail'
      : (hasCriticalWarnings || calculatedScore < 90)
        ? 'warn'
        : (warnings.length > 0 && calculatedScore < 95)
          ? 'warn'
          : 'pass'

  return {
    score: calculatedScore,
    status,
    totalChecks: checks.length,
    passedChecks: checks.filter(c => c.status === 'pass').length,
    warnings: warnings.length,
    failures: failures.length,
    checks,
    contradictions
  }
}

/**
 * Fast helper to extract only failing contradiction messages
 */
export function detectContradictions(
  fingerprint: Fingerprint,
  osType: OSType,
  browserType?: 'chrome' | 'firefox',
  browserVersion?: string
): string[] {
  const result = validateConsistency(fingerprint, osType, browserType, browserVersion)
  return result.contradictions
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
 * The User-Agent string must contain the exact OS identifier.
 */
function checkOsUserAgent(fp: Fingerprint, osType: OSType): ConsistencyCheck {
  const ua = fp.navigator?.userAgent || ''
  const id = 'os-ua'
  const cat = 'OS ↔ User-Agent'

  const osPatterns: Record<OSType, string[]> = {
    'windows-10': ['Windows NT 10.0'],
    'windows-11': ['Windows NT 10.0'],   // Win11 still reports NT 10.0 in UA string
    'macos-intel': ['Macintosh', 'Mac OS X'],
    'macos-arm': ['Macintosh', 'Mac OS X'],
    'linux': ['Linux x86_64', 'X11; Linux x86_64', 'X11; Ubuntu; Linux x86_64'],
    'android': ['Android'],
    'ios': ['iPhone', 'iPad', 'CPU iPhone OS', 'CPU OS']
  }

  // Reject impossible cross-OS contamination
  if (osType === 'ios' && (ua.includes('Windows NT') || ua.includes('Macintosh; Intel') || ua.includes('Linux x86_64') || ua.includes('Android'))) {
    return makeCheck(id, cat, osType, ua.substring(0, 60), 'fail',
      `Contradiction: iOS profile has a desktop/Android User-Agent string: "${ua.substring(0, 60)}..."`, 10)
  }
  if (osType === 'linux' && (ua.includes('Windows NT') || ua.includes('Macintosh') || ua.includes('iPhone'))) {
    return makeCheck(id, cat, osType, ua.substring(0, 60), 'fail',
      `Contradiction: Linux profile has non-Linux OS markers in User-Agent: "${ua.substring(0, 60)}..."`, 10)
  }
  if (osType.startsWith('windows') && (ua.includes('Macintosh') || ua.includes('iPhone') || ua.includes('Android'))) {
    return makeCheck(id, cat, osType, ua.substring(0, 60), 'fail',
      `Contradiction: Windows profile has non-Windows markers in User-Agent: "${ua.substring(0, 60)}..."`, 10)
  }

  const patterns = osPatterns[osType] || []
  const matches = patterns.some(p => ua.includes(p))

  if (!matches) {
    return makeCheck(id, cat, osType, ua.substring(0, 60), 'fail',
      `User-Agent "${ua.substring(0, 60)}..." does not match OS "${osType}"`, 10)
  }

  return makeCheck(id, cat, osType, 'UA matches OS', 'pass',
    'User-Agent correctly identifies the operating system', 10)
}

/**
 * Check 2: OS ↔ Platform
 * navigator.platform must match the OS.
 */
function checkOsPlatform(fp: Fingerprint, osType: OSType): ConsistencyCheck {
  const id = 'os-platform'
  const cat = 'OS ↔ Platform'
  const platform = fp.navigator?.platform || ''

  const validPlatforms: Record<OSType, string[]> = {
    'windows-10': ['Win32'],
    'windows-11': ['Win32'],
    'macos-intel': ['MacIntel'],
    'macos-arm': ['MacIntel'],
    'linux': ['Linux x86_64', 'Linux i686'],
    'android': ['Linux armv81', 'Linux armv8l', 'Linux aarch64'],
    'ios': ['iPhone', 'iPad', 'iPhone Simulator']
  }

  const valid = validPlatforms[osType] || []
  if (!valid.includes(platform)) {
    return makeCheck(id, cat, osType, platform, 'fail',
      `Contradiction: Platform "${platform}" does not match OS "${osType}" (expected: ${valid.join(' or ')})`, 10)
  }

  return makeCheck(id, cat, osType, platform, 'pass',
    'Platform string matches the operating system', 10)
}

/**
 * Check 3: Browser Engine ↔ User-Agent & Version
 */
function checkBrowserUserAgent(
  fp: Fingerprint,
  expectedBrowserType: 'chrome' | 'firefox',
  expectedVersion?: string,
  osType?: OSType
): ConsistencyCheck {
  const id = 'browser-ua'
  const cat = 'Browser Engine ↔ User-Agent'
  const ua = fp.navigator?.userAgent || ''
  const reportedVersion = expectedVersion || fp.navigator?.browserVersion || ''
  const isIos = osType === 'ios' || fp.navigator?.platform === 'iPhone'

  const isFirefoxUA = ua.includes('Firefox/') || ua.includes('FxiOS/')
  const isChromeUA = ua.includes('Chrome/') || ua.includes('CriOS/')

  if (expectedBrowserType === 'firefox') {
    if (!isFirefoxUA) {
      return makeCheck(id, cat, 'Firefox', ua.substring(0, 60), 'fail',
        `Contradiction: Profile is configured as Mozilla Firefox, but User-Agent is not Firefox: "${ua.substring(0, 60)}..."`, 10)
    }
    // Desktop Firefox must NOT contain WebKit / Chrome / Safari tokens
    if (!isIos && (ua.includes('AppleWebKit') || ua.includes('Chrome/') || ua.includes('Safari/'))) {
      return makeCheck(id, cat, 'Firefox Desktop', ua.substring(0, 60), 'fail',
        `Contradiction: Desktop Firefox User-Agent contains non-Gecko tokens (AppleWebKit/Chrome/Safari): "${ua.substring(0, 60)}..."`, 10)
    }
  }

  if (expectedBrowserType === 'chrome') {
    if (!isChromeUA) {
      return makeCheck(id, cat, 'Chrome/Chromium', ua.substring(0, 60), 'fail',
        `Contradiction: Profile is configured as Google Chrome / Chromium, but User-Agent is not Chromium: "${ua.substring(0, 60)}..."`, 10)
    }
    if (isFirefoxUA && !isChromeUA) {
      return makeCheck(id, cat, 'Chrome/Chromium', ua.substring(0, 60), 'fail',
        `Contradiction: Profile is configured as Google Chrome / Chromium, but User-Agent contains Firefox: "${ua.substring(0, 60)}..."`, 10)
    }
  }

  if (reportedVersion) {
    const majorVer = reportedVersion.split('.')[0]
    const matchesVersion =
      ua.includes(`Chrome/${reportedVersion}`) ||
      ua.includes(`Chrome/${majorVer}`) ||
      ua.includes(`CriOS/${reportedVersion}`) ||
      ua.includes(`CriOS/${majorVer}`) ||
      ua.includes(`Firefox/${reportedVersion}`) ||
      ua.includes(`Firefox/${majorVer}`) ||
      ua.includes(`FxiOS/${reportedVersion}`) ||
      ua.includes(`FxiOS/${majorVer}`) ||
      ua.includes(`rv:${reportedVersion}`) ||
      ua.includes(`rv:${majorVer}`)

    if (!matchesVersion) {
      return makeCheck(id, cat, `Ver: ${reportedVersion}`, ua.substring(0, 60), 'warn',
        `Browser version "${reportedVersion}" not strictly reflected in User-Agent`, 6)
    }
  }

  return makeCheck(id, cat, expectedBrowserType, 'UA matches Engine', 'pass',
    'Browser engine and version match the User-Agent string', 8)
}

/**
 * Check 4: Browser Engine Specific Properties
 * E.g., Firefox should not report Google Inc. vendor or Chromium Client Hints.
 */
function checkBrowserEngineProperties(
  fp: Fingerprint,
  browserType: 'chrome' | 'firefox'
): ConsistencyCheck {
  const id = 'browser-engine-props'
  const cat = 'Browser Engine ↔ Properties'
  const vendor = fp.navigator?.vendor || ''
  const productSub = fp.navigator?.productSub || ''
  const isIos = fp.navigator?.platform === 'iPhone' || fp.navigator?.userAgent?.includes('iPhone')

  if (browserType === 'firefox') {
    if (vendor === 'Google Inc.' && !isIos) {
      return makeCheck(id, cat, 'Firefox', `vendor="${vendor}"`, 'fail',
        'Contradiction: Firefox profile reports Chromium vendor "Google Inc." (Firefox vendor must be empty string)', 9)
    }
    if (productSub === '20030107') {
      return makeCheck(id, cat, 'Firefox', `productSub="${productSub}"`, 'fail',
        'Contradiction: Firefox profile reports Chromium productSub "20030107" (Firefox must report "20100101")', 8)
    }
  } else if (browserType === 'chrome') {
    if (!isIos && vendor !== 'Google Inc.' && vendor !== '') {
      return makeCheck(id, cat, 'Chrome', `vendor="${vendor}"`, 'warn',
        `Chromium desktop typically reports "Google Inc." vendor but found "${vendor}"`, 5)
    }
    if (productSub === '20100101') {
      return makeCheck(id, cat, 'Chrome', `productSub="${productSub}"`, 'fail',
        'Contradiction: Chrome profile reports Firefox productSub "20100101" (Chrome must report "20030107")', 8)
    }
  }

  return makeCheck(id, cat, browserType, 'Properties consistent', 'pass',
    'Browser engine properties are consistent', 7)
}

/**
 * Check 4b: Processor ↔ Hardware & OS Consistency
 */
function checkProcessorHardwareConsistency(
  fp: Fingerprint,
  osType: OSType
): ConsistencyCheck {
  const id = 'proc-hardware'
  const cat = 'Processor ↔ Hardware & OS'
  const renderer = (fp.webgl?.unmaskedRenderer || fp.webgl?.gpuRenderer || '').toLowerCase()
  const dpr = fp.screen?.devicePixelRatio || 1

  if (osType === 'macos-arm') {
    const isAppleSiliconGPU = renderer.includes('apple') || renderer.includes('m1') || renderer.includes('m2') || renderer.includes('m3') || renderer.includes('m4')
    if (!isAppleSiliconGPU && fp.webgl?.enabled !== false && renderer) {
      return makeCheck(id, cat, 'Mac ARM', fp.webgl?.unmaskedRenderer || 'GPU', 'fail',
        `Contradiction: Mac ARM (Apple Silicon) profile must use Apple M-series GPU renderer, found: "${fp.webgl?.unmaskedRenderer}"`, 9)
    }
    if (fp.navigator?.platform && fp.navigator?.platform !== 'MacIntel') {
      return makeCheck(id, cat, 'Mac ARM', `platform="${fp.navigator?.platform}"`, 'fail',
        `Contradiction: macOS browsers must report platform "MacIntel" (found: "${fp.navigator?.platform}")`, 9)
    }
    if (dpr < 2 && fp.screen?.width) {
      return makeCheck(id, cat, 'Mac ARM', `DPR=${dpr}x`, 'warn',
        `Apple Silicon Macs feature Retina displays with 2x DPR (found: ${dpr}x)`, 6)
    }
  }

  if (osType === 'macos-intel') {
    if (renderer.includes('metal') || (renderer.includes('apple') && (renderer.includes('m1') || renderer.includes('m2') || renderer.includes('m3') || renderer.includes('m4')))) {
      return makeCheck(id, cat, 'Mac Intel', fp.webgl?.unmaskedRenderer || 'GPU', 'fail',
        `Contradiction: Intel Mac profile configured with Apple Silicon M-series GPU`, 9)
    }
  }

  return makeCheck(id, cat, osType, 'Hardware Coherent', 'pass',
    'Hardware architecture, processor, GPU, and display metrics are coherent', 8)
}

/**
 * Check 5: Screen ↔ DPR & Device Class
 * Flags impossible resolutions (e.g. iPhone with 1920x1080@1x)
 */
function checkScreenDPR(fp: Fingerprint, family: OSFamily, osType: OSType): ConsistencyCheck {
  const id = 'screen-dpr'
  const cat = 'Screen ↔ DPR & Device Class'
  const { width, height, devicePixelRatio: dpr, orientation } = fp.screen || ({} as any)

  if (!width || !height || !dpr) {
    return makeCheck(id, cat, 'Screen', 'Incomplete', 'fail',
      'Screen width, height, or devicePixelRatio is missing', 8)
  }

  // 1. Mobile (iPhone / iOS / Android) Contradiction: Desktop-only resolution with 1x DPR
  if (family === 'ios') {
    if (dpr === 1) {
      return makeCheck(id, cat, `${width}x${height} @${dpr}x`, 'iOS Device', 'fail',
        `Contradiction: iPhone cannot have a 1x standard desktop DPR (Retina requires 2x or 3x)`, 9)
    }
    // Check if resolution matches typical iPhone screens
    const validIosDims = [
      [440, 956], [402, 874], [414, 896], [393, 852], [430, 932], [390, 844], [428, 926], [375, 812], [375, 667],
      [1320, 2868], [1206, 2622], [1179, 2556], [1290, 2796], [1170, 2532], [1284, 2778], [1125, 2436], [828, 1792], [750, 1334]
    ]
    const matchesDim = validIosDims.some(([w, h]) => (width === w && height === h) || (width === h && height === w))
    if (!matchesDim && (width === 1920 && height === 1080)) {
      return makeCheck(id, cat, `${width}x${height}`, 'iPhone', 'fail',
        'Contradiction: iPhone profile configured with desktop resolution 1920x1080', 9)
    }
  }

  if (family === 'android') {
    if (dpr === 1 && (width === 1920 && height === 1080)) {
      return makeCheck(id, cat, `${width}x${height} @${dpr}x`, 'Android', 'warn',
        'Android mobile profile configured with standard desktop 1920x1080 @ 1x DPR', 6)
    }
  }

  // 2. Desktop Contradictions
  if (family === 'windows' || family === 'linux') {
    if (dpr > 2.5 && width <= 1920) {
      return makeCheck(id, cat, `${width}x${height} @${dpr}x`, family, 'warn',
        `Unusual DPR (${dpr}x) for standard ${width}x${height} ${family} desktop`, 5)
    }
  }

  return makeCheck(id, cat, `${width}x${height} @${dpr}x`, `${osType}`, 'pass',
    'Screen resolution, DPR, and device class are coherent', 7)
}

/**
 * Check 6: GPU ↔ OS
 * GPU vendor/renderer must be plausible for the OS.
 */
function checkGpuOs(fp: Fingerprint, family: OSFamily, osType: OSType): ConsistencyCheck {
  const id = 'gpu-os'
  const cat = 'GPU ↔ OS'

  if (!fp.webgl || fp.webgl.enabled === false) {
    return makeCheck(id, cat, family, 'WebGL disabled', 'pass',
      'WebGL is disabled, GPU check skipped', 7)
  }

  const renderer = (fp.webgl.unmaskedRenderer || fp.webgl.gpuRenderer || '').toLowerCase()
  const vendor = (fp.webgl.unmaskedVendor || fp.webgl.gpuVendor || '').toLowerCase()

  // Contradiction 1: Apple GPU / Metal on Windows or Linux
  if ((family === 'windows' || family === 'linux') && (renderer.includes('apple') || vendor.includes('apple') || renderer.includes('metal'))) {
    return makeCheck(id, cat, family, fp.webgl.unmaskedRenderer.substring(0, 50), 'fail',
      `Contradiction: ${family.toUpperCase()} profile configured with Apple GPU / Metal renderer`, 9)
  }

  // Contradiction 2: Direct3D / ANGLE Direct3D on macOS, Linux, or iOS
  if ((family === 'macos' || family === 'linux' || family === 'ios' || family === 'android') && (renderer.includes('direct3d') || renderer.includes('d3d11') || renderer.includes('d3d9'))) {
    return makeCheck(id, cat, family, fp.webgl.unmaskedRenderer.substring(0, 50), 'fail',
      `Contradiction: Non-Windows profile (${family}) configured with Direct3D renderer`, 9)
  }

  // Contradiction 3: iOS / Apple Silicon should use Apple GPU
  if (osType === 'macos-arm' && !renderer.includes('apple') && !renderer.includes('m1') && !renderer.includes('m2') && !renderer.includes('m3') && !renderer.includes('m4')) {
    return makeCheck(id, cat, osType, fp.webgl.unmaskedRenderer.substring(0, 50), 'warn',
      `Apple Silicon macOS normally reports Apple M-series GPU renderer`, 6)
  }

  if (osType === 'ios' && !renderer.includes('apple')) {
    return makeCheck(id, cat, 'iOS', fp.webgl.unmaskedRenderer.substring(0, 50), 'fail',
      `Contradiction: iOS device must use Apple GPU renderer`, 9)
  }

  return makeCheck(id, cat, family, fp.webgl.gpuRenderer || 'Plausible GPU', 'pass',
    'GPU vendor and renderer are consistent with the operating system', 8)
}

/**
 * Check 7: WebGL ↔ GPU
 * WebGL renderer info should match GPU identity.
 */
function checkWebGLGpu(fp: Fingerprint): ConsistencyCheck {
  const id = 'webgl-gpu'
  const cat = 'WebGL ↔ GPU'

  if (!fp.webgl || !fp.webgl.enabled) {
    return makeCheck(id, cat, 'WebGL', 'Disabled', 'pass', 'WebGL is disabled', 5)
  }

  const renderer = (fp.webgl.unmaskedRenderer || '').toLowerCase()
  const gpuName = (fp.webgl.gpuRenderer || '').toLowerCase()

  if (gpuName && renderer) {
    // Normalize: strip ANGLE(...) wrapper, parentheticals, (TM)/(R), and extra whitespace
    const normalize = (s: string) => s
      .replace(/angle\s*\(/gi, '')
      .replace(/\(tm\)/gi, '')
      .replace(/\(r\)/gi, '')
      .replace(/[(),]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const normRenderer = normalize(renderer)
    const normGpu = normalize(gpuName)

    // Extract significant keywords (≥ 2 chars) from GPU name and check if any appear in renderer
    const gpuKeywords = normGpu.split(' ').filter(w => w.length >= 2)
    const matches = gpuKeywords.some(kw => normRenderer.includes(kw))

    if (!matches && gpuKeywords.length > 0) {
      return makeCheck(id, cat, fp.webgl.gpuRenderer || gpuName, (fp.webgl.unmaskedRenderer || renderer).substring(0, 50), 'warn',
        `GPU renderer "${fp.webgl.gpuRenderer}" doesn't appear in WebGL unmasked renderer`, 4)
    }
  }

  return makeCheck(id, cat, gpuName || 'WebGL', 'WebGL consistent', 'pass',
    'WebGL renderer matches GPU identity', 5)
}

/**
 * Check 8: Touch ↔ OS
 * Touch support must match OS type.
 */
function checkTouchOs(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'touch-os'
  const cat = 'Touch ↔ OS'
  const touchSupport = fp.navigator?.touchSupport
  const maxTouchPoints = fp.navigator?.maxTouchPoints ?? 0

  if (family === 'android' || family === 'ios') {
    if (!touchSupport) {
      return makeCheck(id, cat, 'No touch', family, 'fail',
        `Contradiction: ${family.toUpperCase()} mobile profile must have touchSupport enabled`, 8)
    }
    if (maxTouchPoints <= 0) {
      return makeCheck(id, cat, `maxTouchPoints=${maxTouchPoints}`, family, 'fail',
        `Contradiction: ${family.toUpperCase()} mobile profile must have maxTouchPoints > 0 (typically 5)`, 8)
    }
  }

  return makeCheck(id, cat, `Touch: ${touchSupport}`, family, 'pass',
    'Touch support configuration matches the OS type', 7)
}

/**
 * Check 9: CPU ↔ Architecture & Device Class
 */
function checkCpuArchitecture(fp: Fingerprint, family: OSFamily, osType: OSType): ConsistencyCheck {
  const id = 'cpu-arch'
  const cat = 'CPU ↔ Architecture'
  const cores = fp.navigator?.hardwareConcurrency || 8

  if (osType === 'ios' && cores > 8) {
    return makeCheck(id, cat, `${cores} cores`, 'iOS', 'fail',
      `Contradiction: iPhone CPU core count cannot exceed 6-8 cores (configured: ${cores})`, 8)
  }

  if (family === 'android' && cores > 8) {
    return makeCheck(id, cat, `${cores} cores`, 'Android', 'warn',
      `Android mobile CPU core count rarely exceeds 8 cores (configured: ${cores})`, 5)
  }

  const maxCores: Record<OSFamily, number> = {
    windows: 128, macos: 24, linux: 128, android: 8, ios: 8
  }

  if (cores > maxCores[family]) {
    return makeCheck(id, cat, `${cores} cores`, family, 'fail',
      `${cores} CPU cores exceeds plausible maximum for ${family} (${maxCores[family]})`, 7)
  }

  return makeCheck(id, cat, `${cores} cores`, fp.navigator?.cpuArchitecture || 'Arch', 'pass',
    'CPU core count is plausible for the device architecture', 6)
}

/**
 * Check 10: RAM ↔ Device Class
 */
function checkRamDeviceClass(fp: Fingerprint, family: OSFamily, osType: OSType): ConsistencyCheck {
  const id = 'ram-class'
  const cat = 'RAM ↔ Device Class'
  const mem = fp.navigator?.deviceMemory || 8

  if (osType === 'ios' && mem > 16) {
    return makeCheck(id, cat, `${mem}GB RAM`, 'iOS', 'fail',
      `Contradiction: iPhone RAM cannot exceed 16GB (configured: ${mem}GB)`, 8)
  }

  if (family === 'android' && mem > 24) {
    return makeCheck(id, cat, `${mem}GB RAM`, 'Android', 'warn',
      `Android RAM rarely exceeds 24GB (configured: ${mem}GB)`, 5)
  }

  return makeCheck(id, cat, `${mem}GB`, family, 'pass',
    'Device memory is plausible for the device class', 6)
}

/**
 * Check 11: Viewport ↔ Screen
 */
function checkViewportScreen(fp: Fingerprint): ConsistencyCheck {
  const id = 'viewport-screen'
  const cat = 'Viewport ↔ Screen'
  const { width = 1920, height = 1080, viewportWidth = 1920, viewportHeight = 1080 } = fp.screen || {}

  if (viewportWidth > width + 50) {
    return makeCheck(id, cat, `Viewport ${viewportWidth}`, `Screen ${width}`, 'fail',
      `Contradiction: Viewport width (${viewportWidth}px) exceeds screen width (${width}px)`, 7)
  }

  return makeCheck(id, cat, `${viewportWidth}x${viewportHeight}`, `${width}x${height}`, 'pass',
    'Viewport dimensions fit within screen bounds', 6)
}

/**
 * Check 12: Language ↔ Locale
 */
function checkLanguageLocale(fp: Fingerprint): ConsistencyCheck {
  const id = 'lang-locale'
  const cat = 'Language ↔ Locale'
  const lang = fp.locale?.language
  const langs = fp.locale?.languages || []

  if (!lang) {
    return makeCheck(id, cat, 'Language', 'Not set', 'warn', 'Language is not configured', 4)
  }

  if (langs.length > 0 && langs[0] !== lang) {
    return makeCheck(id, cat, lang, langs[0], 'warn',
      `Primary language "${lang}" does not match first entry in languages array "${langs[0]}"`, 5)
  }

  return makeCheck(id, cat, lang, fp.locale?.country || 'US', 'pass',
    'Language and locale settings are consistent', 6)
}

/**
 * Check 13: Timezone ↔ Location
 */
function checkTimezoneLocation(fp: Fingerprint): ConsistencyCheck {
  const id = 'tz-location'
  const cat = 'Timezone ↔ Location'

  if (fp.geolocation?.mode === 'block' || fp.geolocation?.mode === 'ask') {
    return makeCheck(id, cat, fp.timezone?.timezone || 'UTC', 'Geo blocked/prompt', 'pass',
      'Geolocation is prompt/blocked, timezone check skipped', 5)
  }

  const lon = fp.geolocation?.longitude
  const tz = fp.timezone?.timezone || ''

  if (lon !== undefined && lon < -40 && (fp.timezone?.utcOffset || 0) > 240) {
    return makeCheck(id, cat, tz, `Lon: ${lon}`, 'fail',
      `Timezone "${tz}" is geographically implausible for western longitude ${lon}`, 7)
  }

  return makeCheck(id, cat, tz, 'Geographically plausible', 'pass',
    'Timezone and geographical coordinates are coherent', 5)
}

/**
 * Check 14: Media Devices ↔ Device Type
 */
function checkMediaDeviceType(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'media-device'
  const cat = 'Media Devices ↔ Device Type'
  const isDesktop = family !== 'android' && family !== 'ios'
  const videoInputs = fp.mediaDevices?.videoInputs ?? 1

  if (isDesktop && videoInputs > 3) {
    return makeCheck(id, cat, `${videoInputs} cameras`, 'Desktop', 'warn',
      `Desktop device with ${videoInputs} cameras is unusual`, 3)
  }

  return makeCheck(id, cat, `${videoInputs} cameras`, isDesktop ? 'Desktop' : 'Mobile', 'pass',
    'Media device configuration matches device class', 4)
}

/**
 * Check 15: OS ↔ Fonts
 */
function checkOsFonts(fp: Fingerprint, family: OSFamily): ConsistencyCheck {
  const id = 'os-fonts'
  const cat = 'OS ↔ Fonts'

  if (!fp.fonts?.enableMasking || !fp.fonts?.fontList || fp.fonts.fontList.length === 0) {
    return makeCheck(id, cat, family, 'No font list', 'pass',
      'Native font detection enabled', 5)
  }

  const userFonts = new Set(fp.fonts.fontList)
  const markers: Record<OSFamily, string[]> = {
    windows: ['Segoe UI', 'Arial', 'Calibri', 'Tahoma'],
    macos: ['.AppleSystemUIFont', 'Helvetica', 'SF Pro', 'Menlo'],
    linux: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans'],
    android: ['Roboto', 'Droid Sans', 'Noto Sans'],
    ios: ['.AppleSystemUIFont', 'Helvetica Neue', 'Helvetica', 'SF Pro', 'Arial']
  }

  const expected = markers[family] || []
  const found = expected.filter(f => userFonts.has(f))

  if (found.length === 0 && expected.length > 0) {
    return makeCheck(id, cat, family, fp.fonts.fontList.slice(0, 3).join(', '), 'warn',
      `Font list lacks characteristic ${family} fonts (${expected.join(', ')})`, 6)
  }

  return makeCheck(id, cat, family, `${found.length}/${expected.length} markers found`, 'pass',
    'Font list is consistent with the operating system', 6)
}

/**
 * Check 16: WebRTC Consistency
 */
function checkWebRTCConsistency(fp: Fingerprint): ConsistencyCheck {
  const id = 'webrtc-ip'
  const cat = 'WebRTC ↔ Network'

  if (fp.webrtc?.mode === 'disabled') {
    return makeCheck(id, cat, 'WebRTC', 'Disabled', 'pass',
      'WebRTC is disabled — no IP leak risk', 5)
  }

  return makeCheck(id, cat, 'WebRTC', fp.webrtc?.ipPolicy || 'default', 'pass',
    'WebRTC policy is appropriately configured', 5)
}

// ═══════════════════════════════════════════
// Profile Stability Warnings (Section 33)
// ═══════════════════════════════════════════

export function getStabilityWarnings(
  oldFingerprint: Fingerprint,
  newFingerprint: Fingerprint,
  hasBeenUsed: boolean
): StabilityWarning[] {
  if (!hasBeenUsed) return []
  const warnings: StabilityWarning[] = []

  if (oldFingerprint?.navigator?.userAgent !== newFingerprint?.navigator?.userAgent) {
    warnings.push({
      field: 'User-Agent',
      level: 'danger',
      message: '⚠ Changing the User-Agent may make this profile appear as a different device.'
    })
  }

  if (oldFingerprint?.screen?.width !== newFingerprint?.screen?.width ||
      oldFingerprint?.screen?.height !== newFingerprint?.screen?.height) {
    warnings.push({
      field: 'Screen Resolution',
      level: 'danger',
      message: '⚠ Changing screen resolution may make this profile appear as a different device.'
    })
  }

  if (oldFingerprint?.webgl?.unmaskedRenderer !== newFingerprint?.webgl?.unmaskedRenderer) {
    warnings.push({
      field: 'WebGL Renderer',
      level: 'danger',
      message: '⚠ Changing the GPU renderer may make this profile appear as a different device.'
    })
  }

  return warnings
}

// ═══════════════════════════════════════════
// v3 Device Template-Locked Checks
// ═══════════════════════════════════════════

/**
 * v3 Check: Screen resolution and DPR must exactly match the device template.
 */
function checkDeviceTemplateScreenMatch(fp: Fingerprint, template: DeviceTemplate): ConsistencyCheck {
  const id = 'tpl-screen'
  const cat = 'Device Template ↔ Screen'
  const w = fp.screen?.width
  const h = fp.screen?.height
  const dpr = fp.screen?.devicePixelRatio

  if (w !== template.screenWidth || h !== template.screenHeight) {
    return makeCheck(id, cat, `${w}×${h}`, `${template.screenWidth}×${template.screenHeight}`, 'fail',
      `আলাদা (Contradiction): Screen ${w}×${h} does not match device template "${template.model}" (${template.screenWidth}×${template.screenHeight})`, 10)
  }

  if (dpr !== template.devicePixelRatio) {
    return makeCheck(id, cat, `DPR ${dpr}`, `DPR ${template.devicePixelRatio}`, 'fail',
      `Contradiction: DPR ${dpr} does not match device template "${template.model}" (${template.devicePixelRatio})`, 9)
  }

  return makeCheck(id, cat, `${w}×${h} @${dpr}x`, template.model, 'pass',
    'Screen resolution and DPR match the device template', 10)
}

/**
 * v3 Check: GPU / WebGL renderer must match the device template.
 */
function checkDeviceTemplateGpuMatch(fp: Fingerprint, template: DeviceTemplate): ConsistencyCheck {
  const id = 'tpl-gpu'
  const cat = 'Device Template ↔ GPU'

  if (!fp.webgl?.enabled) {
    return makeCheck(id, cat, 'WebGL', 'Disabled', 'pass', 'WebGL disabled, GPU template check skipped', 8)
  }

  const unmasked = fp.webgl?.unmaskedRenderer || ''
  const expected = template.webglProfile?.unmaskedRenderer || ''

  if (expected && unmasked && unmasked !== expected) {
    return makeCheck(id, cat, unmasked.substring(0, 50), expected.substring(0, 50), 'fail',
      `Contradiction: WebGL renderer "${unmasked.substring(0, 50)}..." does not match device template "${template.model}" (expected: "${expected.substring(0, 50)}...")`, 9)
  }

  return makeCheck(id, cat, template.gpuModel, template.model, 'pass',
    'GPU/WebGL renderer matches the device template', 9)
}

/**
 * v3 Check: CPU threads and RAM must match the device template.
 */
function checkDeviceTemplateCpuRamMatch(fp: Fingerprint, template: DeviceTemplate): ConsistencyCheck {
  const id = 'tpl-cpu-ram'
  const cat = 'Device Template ↔ CPU/RAM'
  const cores = fp.navigator?.hardwareConcurrency
  const mem = fp.navigator?.deviceMemory

  if (cores !== undefined && cores !== template.cpuThreads) {
    return makeCheck(id, cat, `${cores} threads`, `${template.cpuThreads} threads`, 'fail',
      `Contradiction: CPU threads (${cores}) does not match device template "${template.model}" (${template.cpuThreads})`, 8)
  }

  if (mem !== undefined && mem !== template.memoryGB) {
    return makeCheck(id, cat, `${mem}GB RAM`, `${template.memoryGB}GB`, 'warn',
      `RAM (${mem}GB) does not match device template "${template.model}" (${template.memoryGB}GB)`, 6)
  }

  return makeCheck(id, cat, `${cores || '?'} cores / ${mem || '?'}GB`, template.model, 'pass',
    'CPU threads and RAM match the device template', 8)
}

/**
 * v3 Check: iOS must use WebKit engine identifiers (CriOS/FxiOS).
 */
function checkIosUaEngine(fp: Fingerprint, browserType: 'chrome' | 'firefox'): ConsistencyCheck {
  const id = 'ios-ua-engine'
  const cat = 'iOS ↔ Browser Engine'
  const ua = fp.navigator?.userAgent || ''

  if (browserType === 'chrome') {
    if (ua.includes('Chrome/') && !ua.includes('CriOS/')) {
      return makeCheck(id, cat, 'Chrome/', 'CriOS/', 'fail',
        'Contradiction: iOS Chrome must use CriOS/ identifier in User-Agent, not desktop Chrome/', 10)
    }
  }

  if (browserType === 'firefox') {
    if (ua.includes('Gecko/') && !ua.includes('FxiOS/')) {
      return makeCheck(id, cat, 'Gecko/', 'FxiOS/', 'fail',
        'Contradiction: iOS Firefox must use FxiOS/ identifier in User-Agent, not desktop Gecko/', 10)
    }
  }

  return makeCheck(id, cat, browserType, 'Correct iOS engine', 'pass',
    'iOS browser uses correct WebKit-based engine identifier', 10)
}

// ═══════════════════════════════════════════
// v3 Public API: Validate with Device Template
// ═══════════════════════════════════════════

/**
 * Validates a fingerprint against a device template.
 * If no templateId is given, tries to find the best matching template.
 */
export function validateWithDeviceTemplate(
  fingerprint: Fingerprint,
  osType: OSType,
  browserType: 'chrome' | 'firefox',
  browserVersion: string,
  deviceTemplateId?: string
): ConsistencyResult {
  const templateId = deviceTemplateId || undefined
  return validateConsistency(fingerprint, osType, browserType, browserVersion, templateId)
}
