/**
 * AntiProfiles v3 — Centralized Platform Resolution & Device Consistency Engine
 * 
 * Single authoritative platform configuration engine ensuring:
 * 1. Mutual consistency across HTTP User-Agent, Sec-CH-UA-Platform, Sec-CH-UA-Mobile,
 *    and JavaScript navigator.platform, navigator.userAgent, and navigator.userAgentData.
 * 2. Clean separation between Physical Runtime, Device Presentation, and Persistent Authentication Session.
 * 3. Prevention of impossible hardware/OS contradictions (e.g. Windows UA with MacIntel platform, or desktop with mobile touch characteristics).
 * 4. Deterministic resolution consumed by Launcher, Injection, and Validation modules.
 */

export type CanonicalOS = 'windows' | 'macos' | 'linux' | 'android' | 'ios'

export interface PlatformProfile {
  os: CanonicalOS
  architecture: 'x64' | 'arm64'
  mobile: boolean
  touch: boolean
  platformString: string
  userAgent: string
  clientHintsPlatform: string
  clientHintsPlatformVersion: string
  brands: Array<{ brand: string; version: string }>
  fullVersionList: Array<{ brand: string; version: string }>
  hardwareConcurrency: number
  deviceMemory: number
  maxTouchPoints: number
  model: string
  bitness: string
  appVersion: string
}

export interface PlatformConsistencyCheckResult {
  consistent: boolean
  runtime: {
    physicalPlatform: string
    physicalArch: string
  }
  presentation: {
    os: CanonicalOS
    platformString: string
    clientHintsPlatform: string
    userAgent: string
    mobile: boolean
  }
  network: {
    userAgentHeader?: string
    secChUaPlatform?: string
    secChUaMobile?: string
  }
  javascript: {
    navigatorPlatform?: string
    navigatorUserAgent?: string
    userAgentDataPlatform?: string
    userAgentDataMobile?: boolean
  }
  mismatches: string[]
  diagnosticReport: string
}

export interface DeviceValidationResult {
  isValid: boolean
  isMobilePresentation: boolean
  anomalies: string[]
  sanitizedProfile: {
    viewportWidth: number
    viewportHeight: number
    devicePixelRatio: number
    touchSupport: boolean
    maxTouchPoints: number
  }
}

export class DeviceConsistencyValidator {
  /**
   * Authoritatively canonicalizes an OS string into one of 5 supported OS families.
   */
  public static getCanonicalOS(rawOs?: string, userAgent?: string, platformStr?: string): CanonicalOS {
    const os = (rawOs || '').toLowerCase()
    const ua = (userAgent || '').toLowerCase()
    const plat = (platformStr || '').toLowerCase()

    if (os.includes('ios') || os.includes('iphone') || os.includes('ipad') || ua.includes('iphone') || ua.includes('ipad') || plat === 'iphone' || plat === 'ipad') {
      return 'ios'
    }
    if (os.includes('android') || ua.includes('android') || plat.includes('android') || plat.includes('armv')) {
      return 'android'
    }
    if (os.includes('win') || ua.includes('windows') || plat === 'win32' || plat === 'win64') {
      return 'windows'
    }
    if (os.includes('mac') || os.includes('darwin') || ua.includes('macintosh') || plat.includes('mac')) {
      return 'macos'
    }
    if (os.includes('linux') || ua.includes('linux') || plat.includes('linux')) {
      return 'linux'
    }
    return 'windows'
  }

  /**
   * Resolves the single authoritative PlatformProfile for a given OS and browser configuration.
   * All presentation modules, headers, and injection scripts MUST consume this exact structure.
   */
  public static resolvePlatformProfile(params: {
    osType?: string
    browserType?: 'chrome' | 'firefox'
    browserVersion?: string
    userAgent?: string
    platform?: string
    hardwareConcurrency?: number
    deviceMemory?: number
    touchSupport?: boolean
    maxTouchPoints?: number
    deviceModel?: string
  }): PlatformProfile {
    const canonicalOS = this.getCanonicalOS(params.osType, params.userAgent, params.platform)
    const browserVer = params.browserVersion || '131.0.0.0'
    const brandVersion = browserVer.split('.')[0] || '131'
    const isFirefox = params.browserType === 'firefox' || (params.userAgent && params.userAgent.includes('Firefox'))

    let architecture: 'x64' | 'arm64' = 'x64'
    let mobile = false
    let touch = false
    let platformString = 'Win32'
    let clientHintsPlatform = 'Windows'
    let clientHintsPlatformVersion = '15.0.0'
    let maxTouchPoints = 0
    let model = ''
    let bitness = '64'
    let defaultUA = ''
    let defaultAppVersion = ''

    switch (canonicalOS) {
      case 'windows':
        architecture = 'x64'
        mobile = false
        touch = params.touchSupport ?? false
        platformString = 'Win32'
        clientHintsPlatform = 'Windows'
        clientHintsPlatformVersion = params.osType === 'windows-11' ? '15.0.0' : '10.0.0'
        maxTouchPoints = touch ? (params.maxTouchPoints || 5) : 0
        model = ''
        bitness = '64'
        defaultUA = isFirefox
          ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${browserVer}) Gecko/20100101 Firefox/${browserVer}`
          : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Safari/537.36`
        defaultAppVersion = isFirefox ? '5.0 (Windows)' : `5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Safari/537.36`
        break

      case 'macos':
        architecture = (params.osType || '').includes('arm') ? 'arm64' : 'x64'
        mobile = false
        touch = false
        platformString = 'MacIntel'
        clientHintsPlatform = 'macOS'
        clientHintsPlatformVersion = '14.5.0'
        maxTouchPoints = 0
        model = ''
        bitness = '64'
        defaultUA = isFirefox
          ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${browserVer}) Gecko/20100101 Firefox/${browserVer}`
          : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Safari/537.36`
        defaultAppVersion = isFirefox ? '5.0 (Macintosh)' : `5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Safari/537.36`
        break

      case 'linux':
        architecture = 'x64'
        mobile = false
        touch = params.touchSupport ?? false
        platformString = 'Linux x86_64'
        clientHintsPlatform = 'Linux'
        clientHintsPlatformVersion = '6.5.0'
        maxTouchPoints = touch ? (params.maxTouchPoints || 5) : 0
        model = ''
        bitness = '64'
        defaultUA = isFirefox
          ? `Mozilla/5.0 (X11; Linux x86_64; rv:${browserVer}) Gecko/20100101 Firefox/${browserVer}`
          : `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Safari/537.36`
        defaultAppVersion = isFirefox ? '5.0 (X11)' : `5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Safari/537.36`
        break

      case 'android':
        architecture = 'arm64'
        mobile = true
        touch = true
        platformString = 'Linux armv8l'
        clientHintsPlatform = 'Android'
        clientHintsPlatformVersion = '14.0.0'
        maxTouchPoints = 5
        model = params.deviceModel || 'SM-S928B'
        bitness = '64'
        defaultUA = `Mozilla/5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Mobile Safari/537.36`
        defaultAppVersion = `5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVer} Mobile Safari/537.36`
        break

      case 'ios':
        architecture = 'arm64'
        mobile = true
        touch = true
        platformString = 'iPhone'
        clientHintsPlatform = 'iOS'
        clientHintsPlatformVersion = '18.0.0'
        maxTouchPoints = 5
        model = 'iPhone'
        bitness = '64'
        defaultUA = `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`
        defaultAppVersion = `5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`
        break
    }

    const finalUA = params.userAgent || defaultUA
    const hwConcurrency = Math.min(params.hardwareConcurrency || (canonicalOS === 'ios' ? 6 : canonicalOS === 'android' ? 8 : 8), canonicalOS === 'ios' ? 6 : 32)
    const deviceMem = Math.min(params.deviceMemory || 8, canonicalOS === 'ios' ? 8 : 32)

    const brands = [
      { brand: 'Chromium', version: brandVersion },
      { brand: 'Google Chrome', version: brandVersion },
      { brand: 'Not_A Brand', version: '24' }
    ]

    const fullVersionList = [
      { brand: 'Chromium', version: browserVer },
      { brand: 'Google Chrome', version: browserVer },
      { brand: 'Not_A Brand', version: '24.0.0.0' }
    ]

    return {
      os: canonicalOS,
      architecture,
      mobile,
      touch,
      platformString: params.platform || platformString,
      userAgent: finalUA,
      clientHintsPlatform,
      clientHintsPlatformVersion,
      brands,
      fullVersionList,
      hardwareConcurrency: hwConcurrency,
      deviceMemory: deviceMem,
      maxTouchPoints: params.maxTouchPoints !== undefined ? params.maxTouchPoints : maxTouchPoints,
      model,
      bitness,
      appVersion: defaultAppVersion
    }
  }

  /**
   * Audits full HTTP vs Client Hints vs JavaScript Navigator consistency.
   * Ensures no contradictory platform combinations are generated or exposed.
   */
  public static checkPlatformConsistency(check: {
    platformProfile: PlatformProfile
    httpHeaders?: {
      userAgent?: string
      secChUaPlatform?: string
      secChUaMobile?: string
    }
    jsEnvironment?: {
      navigatorPlatform?: string
      navigatorUserAgent?: string
      userAgentDataPlatform?: string
      userAgentDataMobile?: boolean
    }
  }): PlatformConsistencyCheckResult {
    const mismatches: string[] = []
    const profile = check.platformProfile

    // 1. Audit HTTP Headers against PlatformProfile
    if (check.httpHeaders?.userAgent) {
      const ua = check.httpHeaders.userAgent
      if (profile.os === 'windows' && !ua.includes('Windows')) {
        mismatches.push(`HTTP User-Agent (${ua}) does not contain Windows for Windows profile.`)
      }
      if (profile.os === 'macos' && !ua.includes('Macintosh') && !ua.includes('Mac OS X')) {
        mismatches.push(`HTTP User-Agent (${ua}) does not contain Macintosh for macOS profile.`)
      }
      if (profile.os === 'linux' && !ua.includes('Linux') && !ua.includes('X11')) {
        mismatches.push(`HTTP User-Agent (${ua}) does not contain Linux for Linux profile.`)
      }
    }

    if (check.httpHeaders?.secChUaPlatform) {
      const platformHeader = check.httpHeaders.secChUaPlatform.replace(/"/g, '')
      if (platformHeader.toLowerCase() !== profile.clientHintsPlatform.toLowerCase()) {
        mismatches.push(`Sec-CH-UA-Platform header ("${platformHeader}") does not match profile platform ("${profile.clientHintsPlatform}").`)
      }
    }

    // 2. Audit JS Environment against PlatformProfile
    if (check.jsEnvironment?.navigatorPlatform) {
      const navPlat = check.jsEnvironment.navigatorPlatform
      if (profile.os === 'windows' && navPlat !== 'Win32' && navPlat !== 'Win64') {
        mismatches.push(`JS navigator.platform ("${navPlat}") is contradictory for Windows profile (expected Win32).`)
      }
      if (profile.os === 'macos' && navPlat !== 'MacIntel') {
        mismatches.push(`JS navigator.platform ("${navPlat}") is contradictory for macOS profile (expected MacIntel).`)
      }
      if (profile.os === 'linux' && !navPlat.includes('Linux')) {
        mismatches.push(`JS navigator.platform ("${navPlat}") is contradictory for Linux profile (expected Linux x86_64).`)
      }
    }

    if (check.jsEnvironment?.userAgentDataPlatform) {
      const uaDataPlat = check.jsEnvironment.userAgentDataPlatform
      if (uaDataPlat.toLowerCase() !== profile.clientHintsPlatform.toLowerCase()) {
        mismatches.push(`JS navigator.userAgentData.platform ("${uaDataPlat}") does not match Client Hints platform ("${profile.clientHintsPlatform}").`)
      }
    }

    // 3. Cross-Check: HTTP UserAgent vs JS navigator.platform
    if (check.httpHeaders?.userAgent && check.jsEnvironment?.navigatorPlatform) {
      const ua = check.httpHeaders.userAgent
      const plat = check.jsEnvironment.navigatorPlatform
      if (ua.includes('Windows') && (plat.includes('Mac') || plat === 'MacIntel')) {
        mismatches.push('CRITICAL MISMATCH: HTTP User-Agent is Windows but JS navigator.platform is MacIntel.')
      }
      if (ua.includes('Macintosh') && (plat === 'Win32' || plat === 'Win64')) {
        mismatches.push('CRITICAL MISMATCH: HTTP User-Agent is Macintosh but JS navigator.platform is Win32.')
      }
    }

    const consistent = mismatches.length === 0
    const report = consistent
      ? `[Consistency: PASS] Profile (${profile.os} ${profile.architecture}) is 100% coherent across Network & JavaScript.`
      : `[Consistency: FAIL] ${mismatches.join(' | ')}`

    return {
      consistent,
      runtime: {
        physicalPlatform: process.platform,
        physicalArch: process.arch
      },
      presentation: {
        os: profile.os,
        platformString: profile.platformString,
        clientHintsPlatform: profile.clientHintsPlatform,
        userAgent: profile.userAgent,
        mobile: profile.mobile
      },
      network: check.httpHeaders || {},
      javascript: check.jsEnvironment || {},
      mismatches,
      diagnosticReport: report
    }
  }

  /**
   * Validates device presentation metrics and prevents impossible hardware anomalies.
   */
  public static validate(profile: {
    osType?: string
    deviceType?: 'desktop' | 'mobile' | 'tablet'
    viewportWidth?: number
    viewportHeight?: number
    devicePixelRatio?: number
    touchSupport?: boolean
    maxTouchPoints?: number
    userAgent?: string
  }): DeviceValidationResult {
    const anomalies: string[] = []
    const os = (profile.osType || 'macos').toLowerCase()
    const isMobile = profile.deviceType === 'mobile' || os.includes('ios') || os.includes('android')

    let width = profile.viewportWidth || (isMobile ? 390 : 1920)
    let height = profile.viewportHeight || (isMobile ? 844 : 1080)
    let dpr = profile.devicePixelRatio || (isMobile ? 3 : 1)
    let touch = profile.touchSupport ?? (isMobile ? true : false)
    let touchPoints = profile.maxTouchPoints ?? (isMobile ? 5 : 0)

    if (isMobile) {
      if (touchPoints === 0 || touch === false) {
        anomalies.push('Mobile device profile requires touch support and >0 touch points.')
        touch = true
        touchPoints = 5
      }
      if (width > 1200) {
        anomalies.push('Mobile viewport width exceeded standard mobile dimensions.')
      }
    } else {
      // Desktop
      if (os.includes('macos') && touchPoints > 5) {
        anomalies.push('macOS desktop profile configured with excessive touch points.')
        touchPoints = 0
        touch = false
      }
    }

    return {
      isValid: anomalies.length === 0,
      isMobilePresentation: isMobile,
      anomalies,
      sanitizedProfile: {
        viewportWidth: width,
        viewportHeight: height,
        devicePixelRatio: dpr,
        touchSupport: touch,
        maxTouchPoints: touchPoints
      }
    }
  }
}
