// ──────────────────────────────────────────────────────────────────
// v3 Device-Profile Consistency Test Suite
// Tests device templates, resolver pipeline, browser-compat-matrix,
// template-locked consistency validation, and injector integration.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  ALL_DEVICE_TEMPLATES as DEVICE_TEMPLATES,
  getDeviceTemplateById,
  getDeviceTemplatesByOs as getTemplatesForOS,
  getDeviceTemplatesGrouped as getTemplatesGroupedByCategory
} from '../../src/main/fingerprint/device-templates'
import {
  getEngineForBrowser,
  hasFeatureFlag,
  getNotABrandVersion,
  buildConsistentUA,
  isVersionSupported
} from '../../src/main/fingerprint/browser-compat-matrix'
import {
  resolveDeviceProfile,
  resolveLegacyProfile
} from '../../src/main/fingerprint/resolvers'
import {
  validateConsistency,
  validateWithDeviceTemplate
} from '../../src/main/fingerprint/consistency'
import { buildUserAgentMetadata } from '../../src/main/browser/injection/injector'
import { OSType, DeviceSelection } from '../../src/main/fingerprint/types'

// ═══════════════════════════════════════════
// 1. Device Template Database
// ═══════════════════════════════════════════

describe('Device Template Database', () => {
  it('should have at least 30 device templates', () => {
    expect(DEVICE_TEMPLATES.length).toBeGreaterThanOrEqual(30)
  })

  it('should have unique IDs for all templates', () => {
    const ids = DEVICE_TEMPLATES.map(t => t.deviceId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should return correct template by ID', () => {
    const firstTpl = DEVICE_TEMPLATES[0]
    const tpl = getDeviceTemplateById(firstTpl.id)
    expect(tpl).toBeDefined()
    if (tpl) {
      expect(tpl.id).toBe(firstTpl.id)
      expect(tpl.screenWidth).toBeGreaterThan(0)
      expect(tpl.memoryGB).toBeGreaterThan(0)
    }
  })

  it('should return null for unknown template ID', () => {
    expect(getDeviceTemplateById('nonexistent-id-xyz')).toBeNull()
  })

  it('should filter templates by OS', () => {
    const winTemplates = getTemplatesForOS('windows-11')
    expect(winTemplates.length).toBeGreaterThan(0)
    winTemplates.forEach(t => {
      expect(t.operatingSystem).toBe('windows-11')
    })
  })

  it('should group templates by category', () => {
    const grouped = getTemplatesGroupedByCategory()
    expect(Object.keys(grouped).length).toBeGreaterThan(0)
    Object.entries(grouped).forEach(([category, templates]) => {
      expect(category.length).toBeGreaterThan(0)
      expect(templates.length).toBeGreaterThan(0)
    })
  })

  it('every template must have valid screen dimensions', () => {
    DEVICE_TEMPLATES.forEach(t => {
      expect(t.screenWidth).toBeGreaterThan(0)
      expect(t.screenHeight).toBeGreaterThan(0)
      expect(t.devicePixelRatio).toBeGreaterThanOrEqual(1)
    })
  })

  it('every template must have CPU threads and memory', () => {
    DEVICE_TEMPLATES.forEach(t => {
      expect(t.cpuThreads).toBeGreaterThan(0)
      expect(t.memoryGB).toBeGreaterThan(0)
    })
  })

  it('every template must have GPU info', () => {
    DEVICE_TEMPLATES.forEach(t => {
      expect(t.gpuVendor.length).toBeGreaterThan(0)
      expect(t.gpuModel.length).toBeGreaterThan(0)
    })
  })

  it('mobile templates should have touchSupport=true', () => {
    DEVICE_TEMPLATES.filter(t => t.deviceType === 'mobile').forEach(t => {
      expect(t.touchSupport).toBe(true)
      expect(t.maxTouchPoints).toBeGreaterThanOrEqual(1)
    })
  })

  it('desktop templates should have touchSupport=false', () => {
    DEVICE_TEMPLATES.filter(t => t.deviceType === 'desktop' || t.deviceType === 'laptop').forEach(t => {
      expect(t.touchSupport).toBe(false)
      expect(t.maxTouchPoints).toBe(0)
    })
  })
})

// ═══════════════════════════════════════════
// 2. Browser Compatibility Matrix
// ═══════════════════════════════════════════

describe('Browser Compatibility Matrix', () => {
  describe('Engine Detection', () => {
    it('Windows + Chrome → Blink', () => {
      expect(getEngineForBrowser('windows-11', 'chrome')).toBe('blink')
    })

    it('Windows + Firefox → Gecko', () => {
      expect(getEngineForBrowser('windows-11', 'firefox')).toBe('gecko')
    })

    it('macOS ARM + Chrome → Blink', () => {
      expect(getEngineForBrowser('macos-arm', 'chrome')).toBe('blink')
    })

    it('iOS + Chrome → WebKit (forced)', () => {
      expect(getEngineForBrowser('ios', 'chrome')).toBe('webkit')
    })

    it('iOS + Firefox → WebKit (forced)', () => {
      expect(getEngineForBrowser('ios', 'firefox')).toBe('webkit')
    })

    it('Linux + Firefox → Gecko', () => {
      expect(getEngineForBrowser('linux', 'firefox')).toBe('gecko')
    })
  })

  describe('Feature Flags', () => {
    it('Windows Chrome should have client-hints', () => {
      expect(hasFeatureFlag('windows-11', 'chrome', 'client-hints')).toBe(true)
    })

    it('Firefox should NOT have client-hints', () => {
      expect(hasFeatureFlag('windows-11', 'firefox', 'client-hints')).toBe(false)
    })

    it('iOS Chrome should NOT have client-hints (WebKit)', () => {
      expect(hasFeatureFlag('ios', 'chrome', 'client-hints')).toBe(false)
    })

    it('Windows Chrome should have window.chrome', () => {
      expect(hasFeatureFlag('windows-11', 'chrome', 'window-chrome')).toBe(true)
    })

    it('Firefox should NOT have window.chrome', () => {
      expect(hasFeatureFlag('windows-11', 'firefox', 'window-chrome')).toBe(false)
    })
  })

  describe('Not-A-Brand Version', () => {
    it('should return a string version number', () => {
      const ver = getNotABrandVersion('128.0.6613.120')
      expect(typeof ver).toBe('string')
      expect(ver.length).toBeGreaterThan(0)
    })
  })

  describe('User-Agent Builder', () => {
    it('should build valid Chrome UA for Windows', () => {
      const ua = buildConsistentUA({ osType: 'windows-11', browserType: 'chrome', browserVersion: '131.0.6778.86' })
      expect(ua).toContain('Windows NT 10.0')
      expect(ua).toContain('Chrome/131')
      expect(ua).not.toContain('Firefox')
    })

    it('should build valid Firefox UA for macOS', () => {
      const ua = buildConsistentUA({ osType: 'macos-arm', browserType: 'firefox', browserVersion: '129.0' })
      expect(ua).toContain('Macintosh')
      expect(ua).toContain('Firefox/129')
      expect(ua).not.toContain('Chrome')
    })

    it('iOS Chrome UA should use CriOS token', () => {
      const ua = buildConsistentUA({ osType: 'ios', browserType: 'chrome', browserVersion: '128.0.6613.120' })
      expect(ua).toContain('CriOS')
      expect(ua).toContain('iPhone')
    })

    it('iOS Firefox UA should use FxiOS token', () => {
      const ua = buildConsistentUA({ osType: 'ios', browserType: 'firefox', browserVersion: '129.0' })
      expect(ua).toContain('FxiOS')
      expect(ua).toContain('iPhone')
    })
  })

  describe('Version Range Validation', () => {
    it('should accept valid Chrome version', () => {
      expect(isVersionSupported('windows-11', 'chrome', '128.0.6613.120')).toBe(true)
    })

    it('should accept valid Firefox version', () => {
      expect(isVersionSupported('linux', 'firefox', '129.0')).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════
// 3. Resolver Pipeline
// ═══════════════════════════════════════════

describe('Resolver Pipeline', () => {
  it('should resolve a Windows desktop device profile', () => {
    const winTemplates = getTemplatesForOS('windows-11')
    if (winTemplates.length === 0) return

    const selection: DeviceSelection = {
      osType: 'windows-11',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceTemplateId: winTemplates[0].id,
      seed: 'test-win-resolve'
    }

    const result = resolveDeviceProfile(selection)
    expect(result).toBeDefined()
    expect(result.fingerprint).toBeDefined()
    expect(result.validation).toBeDefined()

    const fp = result.fingerprint
    expect(fp.navigator?.platform).toContain('Win')
    expect(fp.screen?.width).toBe(winTemplates[0].screenWidth)
    expect(fp.screen?.height).toBe(winTemplates[0].screenHeight)
    expect(fp.screen?.devicePixelRatio).toBe(winTemplates[0].devicePixelRatio)
    expect(fp.navigator?.hardwareConcurrency).toBe(winTemplates[0].cpuThreads)
  })

  it('should resolve an iOS device profile with WebKit engine', () => {
    const iosTemplates = getTemplatesForOS('ios')
    if (iosTemplates.length === 0) return

    const selection: DeviceSelection = {
      osType: 'ios',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      deviceTemplateId: iosTemplates[0].id,
      seed: 'test-ios-resolve'
    }

    const result = resolveDeviceProfile(selection)
    const fp = result.fingerprint

    expect(fp.navigator?.platform).toBe('iPhone')
    expect(fp.navigator?.userAgent).toContain('CriOS')
  })

  it('should resolve an Android device profile', () => {
    const androidTemplates = getTemplatesForOS('android')
    if (androidTemplates.length === 0) return

    const selection: DeviceSelection = {
      osType: 'android',
      browserType: 'chrome',
      browserVersion: '128.0.6613.120',
      deviceTemplateId: androidTemplates[0].id,
      seed: 'test-android-resolve'
    }

    const result = resolveDeviceProfile(selection)
    const fp = result.fingerprint

    expect(fp.navigator?.userAgent).toContain('Android')
    expect(fp.navigator?.platform).toContain('Linux')
  })

  it('resolveLegacyProfile should return valid result from raw v2 data', () => {
    const legacyFp: any = {
      version: 2,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 16
      },
      screen: { width: 1920, height: 1080, devicePixelRatio: 1 },
      webgl: { gpuVendor: 'NVIDIA', gpuRenderer: 'RTX 4070' }
    }

    const result = resolveLegacyProfile(legacyFp, 'windows-10', 'chrome', '128.0.6613.120')
    expect(result).toBeDefined()
    expect(result.fingerprint).toBeDefined()
    expect(result.isLegacy).toBe(true)
  })
})

// ═══════════════════════════════════════════
// 4. Template-Locked Consistency Validation
// ═══════════════════════════════════════════

describe('Template-Locked Consistency Validation', () => {
  it('resolved profile should have valid consistency', () => {
    const winTemplates = getTemplatesForOS('windows-11')
    if (winTemplates.length === 0) return

    const result = resolveDeviceProfile({
      osType: 'windows-11',
      browserType: 'chrome',
      browserVersion: '131.0.6778.86',
      deviceTemplateId: winTemplates[0].id,
      seed: 'test-consistency'
    })

    expect(result.validation.valid).toBe(true)
    expect(result.validation.score).toBeGreaterThanOrEqual(90)
    expect(result.validation.errors).toHaveLength(0)
  })

  it('validateWithDeviceTemplate should catch screen mismatch', () => {
    const winTemplates = getTemplatesForOS('windows-11')
    if (winTemplates.length === 0) return
    const tpl = winTemplates[0]

    const badFp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
        platform: 'Win32',
        hardwareConcurrency: tpl.cpuThreads,
        deviceMemory: tpl.memoryGB
      },
      screen: {
        width: 3840,   // wrong — template says different
        height: 2160,
        devicePixelRatio: 2
      },
      webgl: {
        gpuRenderer: tpl.webglRenderer,
        gpuVendor: tpl.webglVendor
      }
    }

    // Correct parameter order: (fp, osType, browserType, browserVersion, deviceTemplateId)
    const result = validateWithDeviceTemplate(badFp, 'windows-11', 'chrome', '131.0.6778.86', tpl.id)
    expect(result.score).toBeLessThan(100)
  })

  it('iOS profile with raw Chrome/ UA should fail consistency', () => {
    const iosFp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Chrome/128.0.0.0',
        platform: 'iPhone',
        hardwareConcurrency: 6,
        deviceMemory: 6
      },
      screen: { width: 393, height: 852, devicePixelRatio: 3 },
      webgl: { gpuVendor: 'Apple Inc.', gpuRenderer: 'Apple GPU' }
    }

    const result = validateConsistency(iosFp, 'ios', 'chrome', '128.0.6613.120')
    expect(result.score).toBeLessThan(100)
  })

  it('Android Firefox with Chrome UA should fail', () => {
    const androidFp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/128.0.0.0 Mobile',
        platform: 'Linux armv8l',
        hardwareConcurrency: 8,
        deviceMemory: 12
      },
      screen: { width: 360, height: 800, devicePixelRatio: 3 },
      webgl: { gpuVendor: 'Qualcomm', gpuRenderer: 'Adreno 750' }
    }

    const result = validateConsistency(androidFp, 'android', 'firefox', '129.0')
    expect(result.score).toBeLessThan(100)
  })
})

// ═══════════════════════════════════════════
// 5. Injector Client Hints Integration
// ═══════════════════════════════════════════

describe('Injector Client Hints Integration', () => {
  it('buildUserAgentMetadata should return valid structure for Chrome', () => {
    const fp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.6778.86 Safari/537.36',
        browserVersion: '131.0.6778.86',
        platform: 'Win32'
      }
    }

    const metadata = buildUserAgentMetadata(fp)
    expect(metadata.brands).toBeInstanceOf(Array)
    expect(metadata.brands.length).toBeGreaterThanOrEqual(3)
    expect(metadata.platform).toBe('Windows')
    expect(metadata.mobile).toBe(false)
    expect(metadata.architecture).toBe('x86')
    expect(metadata.bitness).toBe('64')
  })

  it('buildUserAgentMetadata Not-A-Brand should use dynamic version', () => {
    const fp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.6778.86',
        browserVersion: '131.0.6778.86',
        platform: 'Win32'
      }
    }

    const metadata = buildUserAgentMetadata(fp)
    const notABrand = metadata.brands.find((b: any) => b.brand.includes('Not'))
    expect(notABrand).toBeDefined()
    expect(typeof notABrand.version).toBe('string')
  })

  it('buildUserAgentMetadata for Android should have mobile=true', () => {
    const fp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/128.0.0.0 Mobile',
        browserVersion: '128.0.6613.120',
        platform: 'Linux armv8l'
      }
    }

    const metadata = buildUserAgentMetadata(fp)
    expect(metadata.platform).toBe('Android')
    expect(metadata.mobile).toBe(true)
  })

  it('buildUserAgentMetadata for macOS should detect platform correctly', () => {
    const fp: any = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0',
        browserVersion: '131.0.6778.86',
        platform: 'MacIntel'
      }
    }

    const metadata = buildUserAgentMetadata(fp)
    expect(metadata.platform).toBe('macOS')
    expect(metadata.mobile).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 6. Cross-OS Template Resolver Coverage
// ═══════════════════════════════════════════

describe('Cross-OS Template Resolver Coverage', () => {
  const osTypes: OSType[] = ['windows-10', 'windows-11', 'macos-arm', 'macos-intel', 'linux', 'ios', 'android']

  osTypes.forEach(osType => {
    it(`should have at least 1 template for ${osType}`, () => {
      const templates = getTemplatesForOS(osType)
      expect(templates.length).toBeGreaterThanOrEqual(1)
    })

    it(`resolved ${osType} Chrome profile should pass basic consistency`, () => {
      const templates = getTemplatesForOS(osType)
      if (templates.length === 0) return

      const selection: DeviceSelection = {
        osType,
        browserType: 'chrome',
        browserVersion: '128.0.6613.120',
        deviceTemplateId: templates[0].id,
        seed: `cross-os-${osType}-chrome`
      }

      const result = resolveDeviceProfile(selection)
      expect(result.fingerprint).toBeDefined()
      expect(result.validation.score).toBeGreaterThanOrEqual(80)
      expect(result.validation.errors).toHaveLength(0)
    })
  })
})
