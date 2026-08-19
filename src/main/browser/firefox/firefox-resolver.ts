// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Resolved Firefox Profile Engine & Unified Resolvers
// Authoritative single source of truth for Firefox profile runtime execution
// ──────────────────────────────────────────────────────────────────

import { Profile } from '../../database/models'
import { Fingerprint, OSType, createDefaultFingerprint } from '../../fingerprint/types'
import { recalculateDependentFields, generateFromDeviceTemplate } from '../../fingerprint/generator'
import { getDeviceTemplateById } from '../../fingerprint/device-templates'
import { getIosDeviceById, IOS_DEVICES } from '../../fingerprint/ios-devices'
import { getDeviceById, ANDROID_DEVICES } from '../../fingerprint/android-devices'
import { logger } from '../../logging/logger'

export interface ResolvedFirefoxProfile {
  // Core Profile Identity
  profileId: string
  profileName: string
  
  // OS & Platform Specs
  operatingSystem: 'windows' | 'macos' | 'linux' | 'ios' | 'android'
  osType: OSType
  osVersion: string
  deviceModel: string
  deviceBrand: string
  platform: string
  oscpu: string
  architecture: 'x86_64' | 'x86' | 'arm64' | 'arm'
  bitness: '64' | '32'

  // Browser Specs
  browser: 'firefox'
  browserEngine: 'gecko' | 'webkit'
  browserVersion: string
  userAgent: string
  appVersion: string
  productSub: string
  vendor: string

  // Display & Screen Dimensions
  screenWidth: number
  screenHeight: number
  availableScreenWidth: number
  availableScreenHeight: number
  devicePixelRatio: number
  viewportWidth: number
  viewportHeight: number
  orientation: 'landscape-primary' | 'portrait-primary'
  colorDepth: number
  pixelDepth: number

  // Hardware & Concurrency
  hardwareConcurrency: number
  deviceMemory: number
  touchSupport: boolean
  maxTouchPoints: number

  // GPU & WebGL
  gpuVendor: string
  gpuRenderer: string
  unmaskedVendor: string
  unmaskedRenderer: string

  // Locale & Network
  language: string
  languages: string[]
  timezone: string
  webrtcPolicy: string
  doNotTrack: string | null

  // Complete Normalized Fingerprint Payload
  fingerprint: Fingerprint

  // Capabilities & Emulation Status
  isEmulatedAtRuntime: boolean
  unsupportedAtRuntime: boolean
  unsupportedReasons: string[]
  hostControlledFields: string[]
}

/**
 * Validates and resolves the Firefox binary version against supported versions.
 */
export class BrowserVersionResolver {
  public static readonly SUPPORTED_FIREFOX_VERSIONS = [
    '131.0',
    '130.0',
    '129.0',
    '128.0',
    '127.0',
    '126.0',
    '125.0.1',
    '124.0.2',
    '123.0',
    '120.0',
    '115.0'
  ]

  public static readonly DEFAULT_VERSION = '131.0'

  public static resolveVersion(configuredVersion?: string, installedBinaryVersion?: string): {
    version: string
    isExactMatch: boolean
    isSupported: boolean
    status: 'PASS' | 'FALLBACK_REQUIRED' | 'MISMATCH'
    message: string
  } {
    const targetVer = (configuredVersion || this.DEFAULT_VERSION).trim()
    const cleanVer = targetVer.includes('.') ? targetVer : `${targetVer}.0`

    const isSupported = this.SUPPORTED_FIREFOX_VERSIONS.some(v => 
      v === cleanVer || v.startsWith(cleanVer.split('.')[0])
    )

    if (!installedBinaryVersion) {
      return {
        version: isSupported ? cleanVer : this.DEFAULT_VERSION,
        isExactMatch: true,
        isSupported,
        status: isSupported ? 'PASS' : 'FALLBACK_REQUIRED',
        message: isSupported 
          ? `Firefox version ${cleanVer} configured.` 
          : `Requested version ${targetVer} unsupported; defaulting to ${this.DEFAULT_VERSION}.`
      }
    }

    const binaryMajor = installedBinaryVersion.split('.')[0]
    const targetMajor = cleanVer.split('.')[0]
    const isExactMatch = binaryMajor === targetMajor

    if (isExactMatch) {
      return {
        version: cleanVer,
        isExactMatch: true,
        isSupported: true,
        status: 'PASS',
        message: `Configured Firefox ${cleanVer} matches installed runtime binary (${installedBinaryVersion}).`
      }
    }

    return {
      version: cleanVer,
      isExactMatch: false,
      isSupported: true,
      status: 'MISMATCH',
      message: `Configured Firefox ${cleanVer} differs from installed runtime binary ${installedBinaryVersion}.`
    }
  }
}

/**
 * Generates an authentic Gecko User-Agent matching the resolved OS, Platform, and Version.
 */
export class UserAgentResolver {
  public static resolve(
    osType: OSType,
    browserVersion: string,
    platform: string,
    deviceModel?: string
  ): { userAgent: string; appVersion: string; oscpu: string } {
    const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`

    if (osType === 'windows-10' || osType === 'windows-11') {
      const oscpu = 'Windows NT 10.0; Win64; x64'
      const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
      const appVersion = `5.0 (Windows)`
      return { userAgent, appVersion, oscpu }
    }

    if (osType === 'macos-arm' || osType === 'macos-intel') {
      const oscpu = 'Intel Mac OS X 10.15'
      const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
      const appVersion = `5.0 (Macintosh)`
      return { userAgent, appVersion, oscpu }
    }

    if (osType === 'linux') {
      const oscpu = 'Linux x86_64'
      const userAgent = `Mozilla/5.0 (X11; Linux x86_64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
      const appVersion = `5.0 (X11)`
      return { userAgent, appVersion, oscpu }
    }

    if (osType === 'ios') {
      const dev = getIosDeviceById(deviceModel || '') || IOS_DEVICES[0]
      const iosVerStr = (dev?.iosVersion || '18.0').replace('.', '_')
      const oscpu = `CPU iPhone OS ${iosVerStr} like Mac OS X`
      const userAgent = `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVerStr} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${ffVer} Mobile/15E148 Safari/605.1.15`
      const appVersion = `5.0 (iPhone; CPU iPhone OS ${iosVerStr} like Mac OS X)`
      return { userAgent, appVersion, oscpu }
    }

    if (osType === 'android') {
      const dev = getDeviceById(deviceModel || '') || ANDROID_DEVICES[0]
      const androidVer = dev?.androidVersion || '14'
      const oscpu = `Linux armv8l`
      const userAgent = `Mozilla/5.0 (Android ${androidVer}; Mobile; rv:${ffVer}) Gecko/${ffVer} Firefox/${ffVer}`
      const appVersion = `5.0 (Android ${androidVer})`
      return { userAgent, appVersion, oscpu }
    }

    // Default Fallback
    const oscpu = 'Windows NT 10.0; Win64; x64'
    const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    const appVersion = `5.0 (Windows)`
    return { userAgent, appVersion, oscpu }
  }
}

/**
 * Resolves screen and viewport metrics ensuring mobile vs desktop metrics do not mix.
 */
export class DeviceDisplayResolver {
  public static resolve(
    osType: OSType,
    customScreen?: { width?: number; height?: number; devicePixelRatio?: number },
    deviceModelId?: string
  ) {
    if (osType === 'ios') {
      const dev = getIosDeviceById(deviceModelId || '') || IOS_DEVICES[0]
      const w = dev.screenWidth
      const h = dev.screenHeight
      const dpr = dev.dpr
      return {
        screenWidth: w,
        screenHeight: h,
        availableScreenWidth: w,
        availableScreenHeight: h,
        viewportWidth: w,
        viewportHeight: Math.floor(h * 0.9),
        devicePixelRatio: dpr,
        orientation: 'portrait-primary' as const,
        touchSupport: true,
        maxTouchPoints: 5,
        colorDepth: 32,
        pixelDepth: 32
      }
    }

    if (osType === 'android') {
      const dev = getDeviceById(deviceModelId || '') || ANDROID_DEVICES[0]
      const w = dev.screenWidth
      const h = dev.screenHeight
      const dpr = dev.dpr
      return {
        screenWidth: w,
        screenHeight: h,
        availableScreenWidth: w,
        availableScreenHeight: h,
        viewportWidth: w,
        viewportHeight: Math.floor(h * 0.9),
        devicePixelRatio: dpr,
        orientation: 'portrait-primary' as const,
        touchSupport: true,
        maxTouchPoints: 5,
        colorDepth: 24,
        pixelDepth: 24
      }
    }

    // Desktop
    const isMac = osType === 'macos-arm' || osType === 'macos-intel'
    const defaultW = isMac ? 1512 : 1920
    const defaultH = isMac ? 982 : 1080
    const defaultDpr = isMac ? 2 : 1

    const width = customScreen?.width && customScreen.width >= 1024 ? customScreen.width : defaultW
    const height = customScreen?.height && customScreen.height >= 600 ? customScreen.height : defaultH
    const dpr = customScreen?.devicePixelRatio ? customScreen.devicePixelRatio : defaultDpr

    return {
      screenWidth: width,
      screenHeight: height,
      availableScreenWidth: width,
      availableScreenHeight: height - (isMac ? 40 : 40),
      viewportWidth: width,
      viewportHeight: height - (isMac ? 80 : 80),
      devicePixelRatio: dpr,
      orientation: 'landscape-primary' as const,
      touchSupport: false,
      maxTouchPoints: 0,
      colorDepth: 24,
      pixelDepth: 24
    }
  }
}

/**
 * Resolves GPU & WebGL hardware profiles preventing contradictory cross-architecture combinations.
 */
export class HardwareCoherenceResolver {
  public static resolve(
    osType: OSType,
    customGpu?: { unmaskedVendor?: string; unmaskedRenderer?: string },
    deviceModelId?: string
  ) {
    if (osType === 'ios') {
      const dev = getIosDeviceById(deviceModelId || '') || IOS_DEVICES[0]
      return {
        gpuVendor: 'Apple Inc.',
        gpuRenderer: dev.gpuRenderer,
        unmaskedVendor: 'Apple Inc.',
        unmaskedRenderer: dev.gpuRenderer,
        cores: dev.cores,
        memory: dev.memory
      }
    }

    if (osType === 'android') {
      const dev = getDeviceById(deviceModelId || '') || ANDROID_DEVICES[0]
      return {
        gpuVendor: dev.gpuVendor,
        gpuRenderer: dev.gpuRenderer,
        unmaskedVendor: dev.gpuVendor,
        unmaskedRenderer: dev.gpuRenderer,
        cores: dev.cores,
        memory: dev.memory
      }
    }

    if (osType === 'macos-arm') {
      return {
        gpuVendor: 'Apple',
        gpuRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)',
        unmaskedVendor: 'Google Inc. (Apple)',
        unmaskedRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)',
        cores: 8,
        memory: 16
      }
    }

    if (osType === 'macos-intel') {
      return {
        gpuVendor: 'Intel',
        gpuRenderer: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)',
        unmaskedVendor: 'Google Inc. (Intel)',
        unmaskedRenderer: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)',
        cores: 8,
        memory: 16
      }
    }

    if (osType === 'linux') {
      return {
        gpuVendor: 'Intel',
        gpuRenderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
        unmaskedVendor: 'Google Inc. (Intel)',
        unmaskedRenderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
        cores: 8,
        memory: 16
      }
    }

    // Windows Desktop Default
    return {
      gpuVendor: 'NVIDIA',
      gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      cores: 8,
      memory: 16
    }
  }
}

/**
 * Single authoritative Firefox Profile Resolver.
 * Resolves and returns a cohesive ResolvedFirefoxProfile for launcher execution.
 */
export function resolveFirefoxProfile(
  profile: Profile,
  installedBinaryVersion?: string
): ResolvedFirefoxProfile {
  let rawFp: any = null
  try {
    rawFp = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint
  } catch {}

  const osType: OSType = (profile.osType as OSType) || rawFp?.osType || 'windows-10'
  const deviceTemplateId = (profile as any).deviceTemplateId || rawFp?.deviceTemplateId
  const deviceModelId = (profile as any).deviceModelId || rawFp?.navigator?.deviceModelCode || rawFp?.navigator?.deviceModel

  // 1. Resolve Firefox Browser Version
  const configuredVer = (profile as any).browserVersion || rawFp?.browser?.version || '131.0'
  const versionRes = BrowserVersionResolver.resolveVersion(configuredVer, installedBinaryVersion)

  // 2. Resolve Platform & Operating System Identity
  const isWindows = osType === 'windows-10' || osType === 'windows-11'
  const isMac = osType === 'macos-arm' || osType === 'macos-intel'
  const isLinux = osType === 'linux'
  const isIos = osType === 'ios'
  const isAndroid = osType === 'android'

  const operatingSystem: ResolvedFirefoxProfile['operatingSystem'] =
    isWindows ? 'windows' : isMac ? 'macos' : isLinux ? 'linux' : isIos ? 'ios' : 'android'

  const platform = isWindows ? 'Win32' : isLinux ? 'Linux x86_64' : isIos ? 'iPhone' : isAndroid ? 'Linux armv8l' : 'MacIntel'
  const architecture: ResolvedFirefoxProfile['architecture'] = (isAndroid || isIos || osType === 'macos-arm') ? 'arm64' : 'x86_64'
  const bitness: ResolvedFirefoxProfile['bitness'] = '64'
  const osVersion = isWindows ? (osType === 'windows-11' ? '11.0' : '10.0') : isMac ? '14.5' : isLinux ? 'Ubuntu 22.04' : isIos ? '18.0' : '14'

  // 3. Resolve User-Agent & Gecko Metadata
  const uaInfo = UserAgentResolver.resolve(osType, versionRes.version, platform, deviceModelId)

  // 4. Resolve Display Metrics
  const display = DeviceDisplayResolver.resolve(osType, rawFp?.screen, deviceModelId)

  // 5. Resolve Hardware & WebGL
  const hardware = HardwareCoherenceResolver.resolve(osType, rawFp?.webgl, deviceModelId)

  // 6. Base / Normalized Fingerprint
  let fp: Fingerprint
  if (deviceTemplateId) {
    const template = getDeviceTemplateById(deviceTemplateId)
    if (template) {
      try {
        const resolved = generateFromDeviceTemplate({
          osType,
          browserType: 'firefox',
          browserVersion: versionRes.version,
          deviceTemplateId,
          seed: rawFp?.seed || 'stable-firefox-seed'
        })
        fp = resolved.fingerprint
      } catch {
        fp = recalculateDependentFields(rawFp || createDefaultFingerprint(), {
          osType,
          browserType: 'firefox',
          browserVersion: versionRes.version,
          seed: rawFp?.seed || 'stable-firefox-seed'
        })
      }
    } else {
      fp = recalculateDependentFields(rawFp || createDefaultFingerprint(), {
        osType,
        browserType: 'firefox',
        browserVersion: versionRes.version,
        seed: rawFp?.seed || 'stable-firefox-seed'
      })
    }
  } else {
    fp = recalculateDependentFields(rawFp || createDefaultFingerprint(), {
      osType,
      browserType: 'firefox',
      browserVersion: versionRes.version,
      seed: rawFp?.seed || 'stable-firefox-seed'
    })
  }

  // Synchronize fingerprint with resolved properties
  fp.browser = {
    name: 'Firefox',
    type: 'firefox',
    version: versionRes.version,
    customLaunchArgs: rawFp?.browser?.customLaunchArgs || []
  }
  fp.navigator = {
    ...fp.navigator,
    userAgent: uaInfo.userAgent,
    appVersion: uaInfo.appVersion,
    platform,
    oscpu: uaInfo.oscpu,
    vendor: isIos ? 'Apple Computer, Inc.' : '',
    hardwareConcurrency: rawFp?.navigator?.hardwareConcurrency || hardware.cores,
    deviceMemory: rawFp?.navigator?.deviceMemory || hardware.memory,
    maxTouchPoints: display.maxTouchPoints,
    touchSupport: display.touchSupport,
    doNotTrack: rawFp?.navigator?.doNotTrack || null
  }
  fp.screen = {
    ...fp.screen,
    width: display.screenWidth,
    height: display.screenHeight,
    availWidth: display.availableScreenWidth,
    availHeight: display.availableScreenHeight,
    devicePixelRatio: display.devicePixelRatio,
    orientation: display.orientation,
    colorDepth: display.colorDepth,
    pixelDepth: display.pixelDepth
  }
  fp.webgl = {
    ...fp.webgl,
    gpuVendor: hardware.gpuVendor,
    gpuRenderer: hardware.gpuRenderer,
    unmaskedVendor: hardware.unmaskedVendor,
    unmaskedRenderer: hardware.unmaskedRenderer
  }

  // 7. Track Host-Controlled & Unsupported Fields
  const unsupportedReasons: string[] = []
  const hostControlledFields: string[] = []

  // Check if requested mobile OS is launched inside desktop Firefox binary
  if (isIos || isAndroid) {
    hostControlledFields.push('Native Touch Event Pipeline (Emulated via JS & Preferences)')
  }

  const resolvedProfile: ResolvedFirefoxProfile = {
    profileId: profile.id,
    profileName: profile.name,
    operatingSystem,
    osType,
    osVersion,
    deviceModel: isIos ? 'iPhone' : isAndroid ? 'Android Device' : isMac ? 'MacBook' : 'PC',
    deviceBrand: isIos ? 'Apple' : isAndroid ? 'Google' : isMac ? 'Apple' : 'Generic',
    platform,
    oscpu: uaInfo.oscpu,
    architecture,
    bitness,
    browser: 'firefox',
    browserEngine: isIos ? 'webkit' : 'gecko',
    browserVersion: versionRes.version,
    userAgent: uaInfo.userAgent,
    appVersion: uaInfo.appVersion,
    productSub: isIos ? '20030107' : '20100101',
    vendor: isIos ? 'Apple Computer, Inc.' : '',
    screenWidth: display.screenWidth,
    screenHeight: display.screenHeight,
    availableScreenWidth: display.availableScreenWidth,
    availableScreenHeight: display.availableScreenHeight,
    devicePixelRatio: display.devicePixelRatio,
    viewportWidth: display.viewportWidth,
    viewportHeight: display.viewportHeight,
    orientation: display.orientation,
    colorDepth: display.colorDepth,
    pixelDepth: display.pixelDepth,
    hardwareConcurrency: fp.navigator.hardwareConcurrency,
    deviceMemory: fp.navigator.deviceMemory,
    touchSupport: display.touchSupport,
    maxTouchPoints: display.maxTouchPoints,
    gpuVendor: hardware.gpuVendor,
    gpuRenderer: hardware.gpuRenderer,
    unmaskedVendor: hardware.unmaskedVendor,
    unmaskedRenderer: hardware.unmaskedRenderer,
    language: fp.locale?.language || 'en-US',
    languages: fp.locale?.languages || ['en-US', 'en'],
    timezone: fp.timezone?.timezone || 'America/New_York',
    webrtcPolicy: fp.webrtc?.ipPolicy || 'default_public_interface_only',
    doNotTrack: fp.navigator?.doNotTrack || null,
    fingerprint: fp,
    isEmulatedAtRuntime: true,
    unsupportedAtRuntime: unsupportedReasons.length > 0,
    unsupportedReasons,
    hostControlledFields
  }

  logger.info('profile', `[FirefoxResolver] Resolved profile "${profile.name}" (${profile.id}) => OS: ${osType} | Version: ${versionRes.version} | Platform: ${platform}`)
  return resolvedProfile
}
