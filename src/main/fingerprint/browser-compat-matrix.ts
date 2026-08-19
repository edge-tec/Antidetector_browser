// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Browser Compatibility Matrix
// Version-specific rules enforcing correct engine, UA format,
// Client Hints, and feature flags per OS/browser combination.
// ──────────────────────────────────────────────────────────────────

import { OSType } from './types'

// ═══════════════════════════════════════════
// Browser Compatibility Interfaces
// ═══════════════════════════════════════════

export interface BrowserCompatibilityEntry {
  browser: 'chrome' | 'firefox'
  engine: 'blink' | 'gecko' | 'webkit'
  supportedVersionRange: { min: number; max: number }
  featureFlags: string[]
}

export interface BrowserCompatRule {
  osType: OSType
  browsers: BrowserCompatibilityEntry[]
}

export interface UABuildOptions {
  osType: OSType
  browserType: 'chrome' | 'firefox'
  browserVersion: string
  platform?: string
  deviceModel?: string
  osVersion?: string
  architecture?: string
}

// ═══════════════════════════════════════════
// Compatibility Matrix
// ═══════════════════════════════════════════

export const BROWSER_COMPAT_MATRIX: BrowserCompatRule[] = [
  // Windows
  {
    osType: 'windows-11',
    browsers: [
      { browser: 'chrome', engine: 'blink', supportedVersionRange: { min: 100, max: 135 }, featureFlags: ['client-hints', 'pdf-viewer', 'window-chrome', 'webgpu'] },
      { browser: 'firefox', engine: 'gecko', supportedVersionRange: { min: 100, max: 135 }, featureFlags: ['pdf-viewer'] }
    ]
  },
  {
    osType: 'windows-10',
    browsers: [
      { browser: 'chrome', engine: 'blink', supportedVersionRange: { min: 90, max: 135 }, featureFlags: ['client-hints', 'pdf-viewer', 'window-chrome', 'webgpu'] },
      { browser: 'firefox', engine: 'gecko', supportedVersionRange: { min: 90, max: 135 }, featureFlags: ['pdf-viewer'] }
    ]
  },
  // macOS
  {
    osType: 'macos-arm',
    browsers: [
      { browser: 'chrome', engine: 'blink', supportedVersionRange: { min: 100, max: 135 }, featureFlags: ['client-hints', 'pdf-viewer', 'window-chrome'] },
      { browser: 'firefox', engine: 'gecko', supportedVersionRange: { min: 100, max: 135 }, featureFlags: ['pdf-viewer'] }
    ]
  },
  {
    osType: 'macos-intel',
    browsers: [
      { browser: 'chrome', engine: 'blink', supportedVersionRange: { min: 90, max: 135 }, featureFlags: ['client-hints', 'pdf-viewer', 'window-chrome'] },
      { browser: 'firefox', engine: 'gecko', supportedVersionRange: { min: 90, max: 135 }, featureFlags: ['pdf-viewer'] }
    ]
  },
  // Linux
  {
    osType: 'linux',
    browsers: [
      { browser: 'chrome', engine: 'blink', supportedVersionRange: { min: 90, max: 135 }, featureFlags: ['client-hints', 'pdf-viewer', 'window-chrome'] },
      { browser: 'firefox', engine: 'gecko', supportedVersionRange: { min: 90, max: 135 }, featureFlags: ['pdf-viewer'] }
    ]
  },
  // iOS — all browsers use WebKit engine
  {
    osType: 'ios',
    browsers: [
      { browser: 'chrome', engine: 'webkit', supportedVersionRange: { min: 100, max: 135 }, featureFlags: [] },
      { browser: 'firefox', engine: 'webkit', supportedVersionRange: { min: 100, max: 135 }, featureFlags: [] }
    ]
  },
  // Android
  {
    osType: 'android',
    browsers: [
      { browser: 'chrome', engine: 'blink', supportedVersionRange: { min: 100, max: 135 }, featureFlags: ['client-hints', 'window-chrome'] },
      { browser: 'firefox', engine: 'gecko', supportedVersionRange: { min: 100, max: 135 }, featureFlags: [] }
    ]
  }
]

// ═══════════════════════════════════════════
// Lookup & Validation Functions
// ═══════════════════════════════════════════

/**
 * Get the compatibility entry for a specific OS + browser combination.
 */
export function getBrowserCompat(osType: OSType, browserType: 'chrome' | 'firefox'): BrowserCompatibilityEntry | null {
  const rule = BROWSER_COMPAT_MATRIX.find(r => r.osType === osType)
  if (!rule) return null
  return rule.browsers.find(b => b.browser === browserType) || null
}

/**
 * Get the engine for a specific OS + browser combination.
 */
export function getEngineForBrowser(osType: OSType, browserType: 'chrome' | 'firefox'): 'blink' | 'gecko' | 'webkit' {
  const compat = getBrowserCompat(osType, browserType)
  if (compat) return compat.engine

  // Fallback logic
  if (osType === 'ios') return 'webkit'
  if (browserType === 'firefox') return 'gecko'
  return 'blink'
}

/**
 * Check if a browser version is within the supported range.
 */
export function isVersionSupported(osType: OSType, browserType: 'chrome' | 'firefox', version: string): boolean {
  const compat = getBrowserCompat(osType, browserType)
  if (!compat) return true // No rule = assume supported

  const majorVersion = parseInt(version.split('.')[0], 10)
  if (isNaN(majorVersion)) return true

  return majorVersion >= compat.supportedVersionRange.min && majorVersion <= compat.supportedVersionRange.max
}

/**
 * Check if a feature flag is present for the given OS + browser.
 */
export function hasFeatureFlag(osType: OSType, browserType: 'chrome' | 'firefox', flag: string): boolean {
  const compat = getBrowserCompat(osType, browserType)
  if (!compat) return false
  return compat.featureFlags.includes(flag)
}

/**
 * Validate that the browser type has the correct properties.
 * Returns an array of error messages (empty = valid).
 */
export function validateBrowserCompat(
  osType: OSType,
  browserType: 'chrome' | 'firefox',
  browserVersion: string,
  fingerprint: any
): string[] {
  const errors: string[] = []
  const compat = getBrowserCompat(osType, browserType)
  if (!compat) return errors

  // Version range check
  if (!isVersionSupported(osType, browserType, browserVersion)) {
    const majorVersion = parseInt(browserVersion.split('.')[0], 10)
    errors.push(`Browser version ${majorVersion} is outside supported range [${compat.supportedVersionRange.min}-${compat.supportedVersionRange.max}] for ${browserType} on ${osType}`)
  }

  // Engine consistency
  const engine = compat.engine
  const ua = fingerprint?.navigator?.userAgent || ''

  if (engine === 'webkit') {
    // iOS WebKit: should have CriOS or FxiOS, NOT Gecko or Chrome/xxx
    if (browserType === 'chrome' && !ua.includes('CriOS') && ua.includes('Chrome/')) {
      errors.push('iOS Chrome must use CriOS identifier in User-Agent, not desktop Chrome format')
    }
    if (browserType === 'firefox' && !ua.includes('FxiOS') && ua.includes('Gecko/')) {
      errors.push('iOS Firefox must use FxiOS identifier in User-Agent, not desktop Gecko format')
    }
  }

  if (engine === 'blink' || engine === 'gecko') {
    // Desktop/Android should NOT have CriOS/FxiOS unless on iOS
    if (ua.includes('CriOS') || ua.includes('FxiOS')) {
      errors.push(`Non-iOS platform ${osType} should not use CriOS/FxiOS identifiers in User-Agent`)
    }
  }

  // Firefox must NOT have window.chrome or Client Hints
  if (browserType === 'firefox' && engine !== 'webkit') {
    if (fingerprint?.navigator?.vendor && fingerprint.navigator.vendor !== '') {
      errors.push('Firefox vendor should be empty string, not "Google Inc."')
    }
  }

  // Chrome must have window.chrome on non-iOS platforms
  if (browserType === 'chrome' && engine === 'blink') {
    if (fingerprint?.navigator?.vendor && fingerprint.navigator.vendor !== 'Google Inc.') {
      errors.push('Chrome vendor must be "Google Inc." on Blink engine')
    }
  }

  return errors
}

// ═══════════════════════════════════════════
// User-Agent Builder
// ═══════════════════════════════════════════

/**
 * Build a consistent User-Agent string from device profile and browser selection.
 */
export function buildConsistentUA(options: UABuildOptions): string {
  const { osType, browserType, browserVersion, deviceModel, osVersion } = options
  const engine = getEngineForBrowser(osType, browserType)
  const majorVer = browserVersion.split('.')[0] || '131'

  // iOS — all browsers use WebKit
  if (osType === 'ios') {
    const iosVer = (osVersion || '18.0').replace(/\./g, '_')
    if (browserType === 'firefox') {
      const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
      return `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVer} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${ffVer} Mobile/15E148 Safari/605.1.15`
    }
    return `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVer} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${browserVersion} Mobile/15E148 Safari/604.1`
  }

  // Android
  if (osType === 'android') {
    const androidVer = osVersion || '14'
    const model = deviceModel || 'SM-S928B'
    if (browserType === 'firefox') {
      const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
      return `Mozilla/5.0 (Android ${androidVer}; Mobile; rv:${ffVer}) Gecko/${ffVer} Firefox/${ffVer}`
    }
    return `Mozilla/5.0 (Linux; Android ${androidVer}; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Mobile Safari/537.36`
  }

  // Windows
  if (osType === 'windows-11' || osType === 'windows-10') {
    const ntVer = osType === 'windows-11' ? '10.0' : '10.0'
    if (browserType === 'firefox') {
      const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
      return `Mozilla/5.0 (Windows NT ${ntVer}; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
    return `Mozilla/5.0 (Windows NT ${ntVer}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  }

  // macOS
  if (osType === 'macos-arm' || osType === 'macos-intel') {
    const macVer = (osVersion || (osType === 'macos-arm' ? '14_5' : '10_15_7')).replace(/\./g, '_')
    if (browserType === 'firefox') {
      const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVer}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  }

  // Linux
  if (osType === 'linux') {
    if (browserType === 'firefox') {
      const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
      return `Mozilla/5.0 (X11; Linux x86_64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  }

  // Fallback
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
}

/**
 * Get the Not-A-Brand version suffix for Chrome Client Hints.
 * Chrome 128+ uses "24", older versions use "8".
 */
export function getNotABrandVersion(chromeVersion: string): string {
  const major = parseInt(chromeVersion.split('.')[0], 10)
  if (isNaN(major) || major >= 128) return '24'
  if (major >= 120) return '8'
  return '99'
}

/**
 * Get the navigator.vendor value for a given browser.
 */
export function getNavigatorVendor(browserType: 'chrome' | 'firefox', osType: OSType): string {
  if (osType === 'ios') return 'Apple Computer, Inc.'
  if (browserType === 'firefox') return ''
  return 'Google Inc.'
}

/**
 * Get navigator.platform for a given OS.
 */
export function getNavigatorPlatform(osType: OSType): string {
  switch (osType) {
    case 'windows-10':
    case 'windows-11':
      return 'Win32'
    case 'macos-arm':
    case 'macos-intel':
      return 'MacIntel'
    case 'linux':
      return 'Linux x86_64'
    case 'ios':
      return 'iPhone'
    case 'android':
      return 'Linux armv8l'
    default:
      return 'Win32'
  }
}

/**
 * Build appVersion string from the user agent.
 */
export function buildAppVersion(userAgent: string): string {
  if (userAgent.startsWith('Mozilla/')) {
    return userAgent.replace('Mozilla/', '')
  }
  return userAgent
}
