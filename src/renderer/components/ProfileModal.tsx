import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ANDROID_DEVICES,
  ANDROID_BRANDS,
  getDevicesByBrand,
  getDeviceById,
  generateAndroidUserAgent,
  AndroidDeviceSpec
} from '../data/android-devices'
import {
  IOS_DEVICES,
  getIosDeviceById,
  generateIosUserAgent,
  IosDeviceSpec
} from '../data/ios-devices'
import { parseCookies, CookieItem } from '../utils/cookie-parser'
import { ProxyInfoCard } from './ProxyInfoCard'
import { ConsistencyBadge, ConsistencyResult } from './ConsistencyBadge'
import { ProxyTestResult } from '../types'
import { ChromeLogo, FirefoxLogo } from './BrowserLogos'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (profileData: any) => Promise<void>
  initialProfile?: any
  proxies: any[]
  groups: any[]
  existingProfiles?: any[]
  licenseInfo?: any
  onUpgrade?: () => void
}

export function getNextProfileName(existingProfiles?: { name?: string }[]): string {
  if (!existingProfiles || existingProfiles.length === 0) {
    return 'profile 1'
  }
  
  const usedNumbers = new Set<number>()
  for (const p of existingProfiles) {
    if (p && p.name) {
      const match = p.name.trim().match(/^profile\s+(\d+)$/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > 0) {
          usedNumbers.add(num)
        }
      }
    }
  }

  let nextNum = 1
  while (usedNumbers.has(nextNum)) {
    nextNum++
  }

  return `profile ${nextNum}`
}

type TabType =
  | 'overview'
  | 'proxy'
  | 'timezone'
  | 'language'
  | 'webrtc'
  | 'extensions'
  | 'bookmarks'
  | 'geolocation'
  | 'advanced'
  | 'cookies'

export const WORLD_LANGUAGES: { code: string; name: string; native?: string }[] = [
  { code: 'en-US', name: 'English (United States)', native: 'English (US)' },
  { code: 'en-GB', name: 'English (United Kingdom)', native: 'English (UK)' },
  { code: 'en-CA', name: 'English (Canada)', native: 'English (Canada)' },
  { code: 'en-AU', name: 'English (Australia)', native: 'English (Australia)' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es-ES', name: 'Spanish (Spain)', native: 'Español (España)' },
  { code: 'es-MX', name: 'Spanish (Mexico)', native: 'Español (México)' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr-FR', name: 'French (France)', native: 'Français (France)' },
  { code: 'fr-CA', name: 'French (Canada)', native: 'Français (Canada)' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de-DE', name: 'German (Germany)', native: 'Deutsch (Deutschland)' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it-IT', name: 'Italian (Italy)', native: 'Italiano (Italia)' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', native: 'Português (Portugal)' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru-RU', name: 'Russian (Russia)', native: 'Русский' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '中文 (简体)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '中文 (繁體)' },
  { code: 'ja-JP', name: 'Japanese', native: '日本語' },
  { code: 'ko-KR', name: 'Korean', native: '한국어' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', native: 'العربية' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'bn-BD', name: 'Bengali (Bangladesh)', native: 'বাংলা (বাংলাদেশ)' },
  { code: 'bn-IN', name: 'Bengali (India)', native: 'বাংলা (ভারত)' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'tr-TR', name: 'Turkish', native: 'Türkçe' },
  { code: 'nl-NL', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl-PL', name: 'Polish', native: 'Polski' },
  { code: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'th-TH', name: 'Thai', native: 'ไทย' },
  { code: 'uk-UA', name: 'Ukrainian', native: 'Українська' },
  { code: 'sv-SE', name: 'Swedish', native: 'Svenska' },
  { code: 'no-NO', name: 'Norwegian', native: 'Norsk' },
  { code: 'fi-FI', name: 'Finnish', native: 'Suomi' },
  { code: 'da-DK', name: 'Danish', native: 'Dansk' },
  { code: 'cs-CZ', name: 'Czech', native: 'Čeština' },
  { code: 'el-GR', name: 'Greek', native: 'Ελληνικά' },
  { code: 'ro-RO', name: 'Romanian', native: 'Română' },
  { code: 'hu-HU', name: 'Hungarian', native: 'Magyar' },
  { code: 'he-IL', name: 'Hebrew', native: 'עברית' },
  { code: 'fa-IR', name: 'Persian', native: 'فارسی' }
]

export function getLanguageLabel(code: string): string {
  const found = WORLD_LANGUAGES.find(l => l.code.toLowerCase() === code.toLowerCase() || l.code.toLowerCase() === code.split('-')[0].toLowerCase())
  if (found && found.code.toLowerCase() === code.toLowerCase()) {
    return found.name
  }
  if (found) {
    return `${found.name} (${code})`
  }
  return code
}

// Pre-defined timezones with UTC offset for timezone search
const TIMEZONE_LIST = [
  { tz: 'Africa/Abidjan', offset: '+00:00' },
  { tz: 'Africa/Accra', offset: '+00:00' },
  { tz: 'Africa/Algiers', offset: '+01:00' },
  { tz: 'Africa/Bissau', offset: '+00:00' },
  { tz: 'Africa/Cairo', offset: '+02:00' },
  { tz: 'Africa/Casablanca', offset: '+00:00' },
  { tz: 'Africa/Ceuta', offset: '+01:00' },
  { tz: 'Africa/El_Aaiun', offset: '+00:00' },
  { tz: 'America/Anchorage', offset: '-09:00' },
  { tz: 'America/Chicago', offset: '-06:00' },
  { tz: 'America/Denver', offset: '-07:00' },
  { tz: 'America/Los_Angeles', offset: '-08:00' },
  { tz: 'America/New_York', offset: '-05:00' },
  { tz: 'America/Sao_Paulo', offset: '-03:00' },
  { tz: 'America/Toronto', offset: '-05:00' },
  { tz: 'Asia/Dhaka', offset: '+06:00' },
  { tz: 'Asia/Dubai', offset: '+04:00' },
  { tz: 'Asia/Hong_Kong', offset: '+08:00' },
  { tz: 'Asia/Kolkata', offset: '+05:30' },
  { tz: 'Asia/Seoul', offset: '+09:00' },
  { tz: 'Asia/Shanghai', offset: '+08:00' },
  { tz: 'Asia/Tokyo', offset: '+09:00' },
  { tz: 'Australia/Sydney', offset: '+11:00' },
  { tz: 'Europe/Amsterdam', offset: '+01:00' },
  { tz: 'Europe/Berlin', offset: '+01:00' },
  { tz: 'Europe/London', offset: '+00:00' },
  { tz: 'Europe/Madrid', offset: '+01:00' },
  { tz: 'Europe/Paris', offset: '+01:00' },
  { tz: 'Europe/Rome', offset: '+01:00' },
  { tz: 'Pacific/Honolulu', offset: '-10:00' }
]

const CHROME_VERSIONS = [
  '128.0.6613.120',
  '127.0.6533.120',
  '126.0.6478.126',
  '125.0.6422.141',
  '124.0.6367.207',
  '123.0.6312.122'
]

export const POPULAR_UA_PRESETS = [
  { label: '🖥️ Windows 11 — Chrome 128 (x64)', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'windows-11', platform: 'Win32', browser: 'chrome' },
  { label: '🦊 Windows 11 — Mozilla Firefox 129', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0', os: 'windows-11', platform: 'Win32', browser: 'firefox' },
  { label: '🖥️ Windows 10 — Chrome 128 (x64)', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'windows-10', platform: 'Win32', browser: 'chrome' },
  { label: '🍏 macOS Sonoma — Chrome 128 (Apple Silicon)', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'macos-arm', platform: 'MacIntel', browser: 'chrome' },
  { label: '🦊 macOS Sonoma — Firefox 129', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0', os: 'macos-arm', platform: 'MacIntel', browser: 'firefox' },
  { label: '🍏 macOS Sonoma — Chrome 128 (Intel)', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'macos-intel', platform: 'MacIntel', browser: 'chrome' },
  { label: '🐧 Linux Ubuntu — Chrome 128 (x86_64)', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'linux', platform: 'Linux x86_64', browser: 'chrome' },
  { label: '🦊 Linux Ubuntu — Firefox 129', ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0', os: 'linux', platform: 'Linux x86_64', browser: 'firefox' },
  { label: '📱 iOS 18.0 — iPhone 16 Pro Max (Chrome)', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.114 Mobile/15E148 Safari/604.1', os: 'ios', platform: 'iPhone', browser: 'chrome' },
  { label: '📱 iOS 18.0 — iPhone 16 Pro (Firefox)', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/128.0 Mobile/15E148 Safari/605.1.15', os: 'ios', platform: 'iPhone', browser: 'firefox' },
  { label: '📱 iOS 17.5 — iPhone 15 Pro (Safari)', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', os: 'ios', platform: 'iPhone', browser: 'chrome' },
  { label: '📱 Android 14 — Samsung Galaxy S24 Ultra', ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36', os: 'android', platform: 'Linux armv8l', browser: 'chrome' },
  { label: '📱 Android 14 — Google Pixel 8 Pro', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36', os: 'android', platform: 'Linux armv8l', browser: 'chrome' }
]

export const CHROME_VERSIONS_CATALOG = [
  { version: '128.0.6613.120', major: '128', label: 'Chrome 128.0.6613.120 (Latest Stable)' },
  { version: '127.0.6533.120', major: '127', label: 'Chrome 127.0.6533.120' },
  { version: '126.0.6478.126', major: '126', label: 'Chrome 126.0.6478.126' },
  { version: '125.0.6422.141', major: '125', label: 'Chrome 125.0.6422.141' },
  { version: '124.0.6367.207', major: '124', label: 'Chrome 124.0.6367.207' },
  { version: '123.0.6312.122', major: '123', label: 'Chrome 123.0.6312.122' },
  { version: '122.0.6261.128', major: '122', label: 'Chrome 122.0.6261.128' },
  { version: '120.0.6099.109', major: '120', label: 'Chrome 120.0.6099.109' }
]

export const FIREFOX_VERSIONS_CATALOG = [
  { version: '129.0', major: '129', label: 'Firefox 129.0 (Quantum Stable)' },
  { version: '128.0', major: '128', label: 'Firefox 128.0 (ESR / Stable)' },
  { version: '127.0', major: '127', label: 'Firefox 127.0' },
  { version: '126.0', major: '126', label: 'Firefox 126.0' },
  { version: '125.0.1', major: '125', label: 'Firefox 125.0.1' },
  { version: '124.0.2', major: '124', label: 'Firefox 124.0.2' },
  { version: '123.0', major: '123', label: 'Firefox 123.0' },
  { version: '120.0', major: '120', label: 'Firefox 120.0' },
  { version: '115.0', major: '115', label: 'Firefox 115.0 (ESR Legacy)' }
]

function generateUAForOS(osType: string, version = '128.0.6613.120', browserType: 'chrome' | 'firefox' = 'chrome'): string {
  if (browserType === 'firefox') {
    const ffVer = version.includes('.') ? version : `${version}.0`
    if (osType === 'windows-10' || osType === 'windows-11') {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
    if (osType === 'macos-intel' || osType === 'macos-arm') {
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
    if (osType === 'linux') {
      return `Mozilla/5.0 (X11; Linux x86_64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
    }
    if (osType === 'ios') {
      return `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${ffVer} Mobile/15E148 Safari/605.1.15`
    }
    if (osType === 'android') {
      return `Mozilla/5.0 (Android 14; Mobile; rv:${ffVer}) Gecko/${ffVer} Firefox/${ffVer}`
    }
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVer}) Gecko/20100101 Firefox/${ffVer}`
  }

  if (osType === 'windows-10' || osType === 'windows-11') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
  }
  if (osType === 'macos-intel' || osType === 'macos-arm') {
    const osVer = osType === 'macos-intel' ? '10_15_7' : '14_4_1'
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVer}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
  }
  if (osType === 'linux') {
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
  }
  if (osType === 'ios') {
    return `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${version} Mobile/15E148 Safari/604.1`
  }
  if (osType === 'android') {
    return `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`
  }
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
}

function generateRandomUAForOS(osType: string, browserType: 'chrome' | 'firefox' = 'chrome'): { ua: string; version: string; chromium: string } {
  if (browserType === 'firefox') {
    const item = FIREFOX_VERSIONS_CATALOG[Math.floor(Math.random() * FIREFOX_VERSIONS_CATALOG.length)]
    return {
      ua: generateUAForOS(osType, item.version, 'firefox'),
      version: item.version,
      chromium: item.major
    }
  }
  const item = CHROME_VERSIONS_CATALOG[Math.floor(Math.random() * CHROME_VERSIONS_CATALOG.length)]
  return {
    ua: generateUAForOS(osType, item.version, 'chrome'),
    version: item.version,
    chromium: item.major
  }
}


function ensureFpStructure(rawFp: any, targetOs = 'macos-intel', bType: 'chrome' | 'firefox' = 'chrome', bVer = '128.0.6613.120'): any {
  const fp = rawFp && typeof rawFp === 'object' ? rawFp : {}
  const isIos = targetOs === 'ios'
  const isAndroid = targetOs === 'android'
  const isMac = targetOs.startsWith('macos')
  const isLinux = targetOs === 'linux'
  const isWindows = targetOs.startsWith('windows')
  const isMobile = isIos || isAndroid

  let cleanVer = bVer || (bType === 'firefox' ? '129.0' : '128.0.6613.120')
  if (bType === 'firefox' && (cleanVer.split('.').length > 2 || cleanVer.includes('6613') || cleanVer.includes('Chrome'))) {
    cleanVer = '129.0'
  }
  if (bType === 'chrome' && cleanVer.split('.').length <= 2) {
    cleanVer = '128.0.6613.120'
  }
  bVer = cleanVer

  // 1. Android
  if (isAndroid) {
    const existingModelCode = fp.navigator?.deviceModelCode || fp.navigator?.deviceModel || ''
    const matchedDev = (existingModelCode ? getDeviceById(existingModelCode) : null) || ANDROID_DEVICES[0]
    const rawUa = typeof fp.navigator?.userAgent === 'string' ? fp.navigator.userAgent : ''
    const isMatchingEngine = bType === 'firefox'
      ? (rawUa.includes('Firefox') || rawUa.includes('FxiOS')) && !rawUa.includes('Chrome')
      : (rawUa.includes('Chrome') || rawUa.includes('CriOS')) && !rawUa.includes('Firefox')
    const isMatchingOs = rawUa.includes('Android')

    const userAgent = isMatchingEngine && isMatchingOs
      ? rawUa
      : generateAndroidUserAgent(matchedDev, bType, bVer)

    return {
      version: fp.version || 2,
      seed: fp.seed || 'default-seed',
      browser: {
        name: bType === 'firefox' ? 'Firefox' : 'Chrome',
        type: bType,
        version: bVer
      },
      navigator: {
        userAgent,
        browserVersion: bVer,
        chromiumVersion: bType === 'firefox' ? bVer.split('.')[0] : '128.0.0.0',
        platform: 'Linux armv8l',
        vendor: bType === 'firefox' ? '' : 'Google Inc.',
        deviceBrand: matchedDev.brand,
        deviceModel: matchedDev.modelName,
        deviceModelCode: matchedDev.modelCode,
        hardwareConcurrency: matchedDev.cores,
        deviceMemory: matchedDev.memory,
        maxTouchPoints: 5,
        touchSupport: true,
        doNotTrack: fp.navigator?.doNotTrack || null
      },
      screen: {
        width: matchedDev.screenWidth,
        height: matchedDev.screenHeight,
        availWidth: matchedDev.screenWidth,
        availHeight: matchedDev.screenHeight,
        devicePixelRatio: matchedDev.dpr,
        viewportWidth: matchedDev.screenWidth,
        viewportHeight: Math.floor(matchedDev.screenHeight * 0.9),
        colorDepth: 24,
        pixelDepth: 24,
        orientation: 'portrait-primary',
        orientationAngle: 0
      },
      locale: {
        mode: fp.locale?.mode || 'custom',
        language: fp.locale?.language || 'en-US',
        languages: fp.locale?.languages || ['en-US', 'en'],
        displayLanguageMode: fp.locale?.displayLanguageMode || 'custom',
        displayLanguage: fp.locale?.displayLanguage || 'en-US'
      },
      timezone: {
        mode: fp.timezone?.mode || 'auto',
        timezone: fp.timezone?.timezone || 'America/New_York'
      },
      geolocation: {
        mode: fp.geolocation?.mode || 'ip-based',
        latitude: fp.geolocation?.latitude || 40.7128,
        longitude: fp.geolocation?.longitude || -74.006,
        accuracy: fp.geolocation?.accuracy || 50
      },
      webrtc: {
        mode: fp.webrtc?.mode || 'default',
        ipPolicy: fp.webrtc?.ipPolicy || 'default_public_interface_only'
      },
      canvas: {
        mode: fp.canvas?.mode || 'off',
        noiseSeed: fp.canvas?.noiseSeed || 12345
      },
      webgl: {
        enabled: fp.webgl?.enabled !== false,
        gpuVendor: matchedDev.gpuVendor,
        gpuRenderer: matchedDev.gpuRenderer,
        unmaskedVendor: matchedDev.gpuVendor,
        unmaskedRenderer: matchedDev.gpuRenderer,
        imageMode: fp.webgl?.imageMode || 'off',
        metadataMode: fp.webgl?.metadataMode || 'mask'
      },
      audio: {
        mode: fp.audio?.mode || 'noise',
        noiseSeed: fp.audio?.noiseSeed || 54321
      },
      clientRects: {
        mode: fp.clientRects?.mode || 'off',
        noiseSeed: fp.clientRects?.noiseSeed || 9999
      },
      fonts: {
        enableMasking: fp.fonts?.enableMasking !== false,
        fontList: fp.fonts?.fontList?.length ? fp.fonts.fontList : ['Roboto', 'Noto Sans', 'Droid Sans']
      },
      mediaDevices: {
        videoInputs: fp.mediaDevices?.videoInputs ?? 2,
        audioInputs: fp.mediaDevices?.audioInputs ?? 1,
        audioOutputs: fp.mediaDevices?.audioOutputs ?? 1
      },
      battery: {
        enabled: true,
        charging: fp.battery?.charging ?? false,
        level: fp.battery?.level ?? 0.85
      },
      networkInfo: {
        effectiveType: fp.networkInfo?.effectiveType || '4g',
        downlink: fp.networkInfo?.downlink || 15,
        rtt: fp.networkInfo?.rtt || 50
      },
      permissions: fp.permissions || {
        camera: 'prompt',
        microphone: 'prompt',
        geolocation: 'prompt',
        notifications: 'prompt',
        clipboard: 'prompt'
      }
    }
  }

  // 2. iOS
  if (isIos) {
    const existingModelCode = fp.navigator?.deviceModelCode || fp.navigator?.deviceModel || ''
    const matchedDev = (existingModelCode ? getIosDeviceById(existingModelCode) : null) || IOS_DEVICES[0]
    const rawUa = typeof fp.navigator?.userAgent === 'string' ? fp.navigator.userAgent : ''
    const isMatchingEngine = bType === 'firefox'
      ? rawUa.includes('FxiOS')
      : rawUa.includes('CriOS') || (rawUa.includes('Safari') && !rawUa.includes('FxiOS') && !rawUa.includes('Firefox'))
    const isMatchingOs = rawUa.includes('iPhone') || rawUa.includes('iPad')

    const userAgent = isMatchingEngine && isMatchingOs
      ? rawUa
      : generateIosUserAgent(matchedDev, bType, bVer)

    return {
      version: fp.version || 2,
      seed: fp.seed || 'default-seed',
      browser: {
        name: bType === 'firefox' ? 'Firefox' : 'Chrome',
        type: bType,
        version: bVer
      },
      navigator: {
        userAgent,
        browserVersion: bVer,
        chromiumVersion: bType === 'firefox' ? bVer.split('.')[0] : '128.0.0.0',
        platform: 'iPhone',
        vendor: 'Apple Computer, Inc.',
        deviceBrand: 'Apple',
        deviceModel: matchedDev.modelName,
        deviceModelCode: matchedDev.id,
        hardwareConcurrency: matchedDev.cpuCores,
        deviceMemory: matchedDev.ramGb,
        maxTouchPoints: 5,
        touchSupport: true,
        doNotTrack: fp.navigator?.doNotTrack || null
      },
      screen: {
        width: matchedDev.width,
        height: matchedDev.height,
        availWidth: matchedDev.width,
        availHeight: matchedDev.height,
        devicePixelRatio: matchedDev.dpr,
        viewportWidth: matchedDev.width,
        viewportHeight: Math.floor(matchedDev.height * 0.9),
        colorDepth: 32,
        pixelDepth: 32,
        orientation: 'portrait-primary',
        orientationAngle: 0
      },
      locale: {
        mode: fp.locale?.mode || 'custom',
        language: fp.locale?.language || 'en-US',
        languages: fp.locale?.languages || ['en-US', 'en'],
        displayLanguageMode: fp.locale?.displayLanguageMode || 'custom',
        displayLanguage: fp.locale?.displayLanguage || 'en-US'
      },
      timezone: {
        mode: fp.timezone?.mode || 'auto',
        timezone: fp.timezone?.timezone || 'America/New_York'
      },
      geolocation: {
        mode: fp.geolocation?.mode || 'ip-based',
        latitude: fp.geolocation?.latitude || 40.7128,
        longitude: fp.geolocation?.longitude || -74.006,
        accuracy: fp.geolocation?.accuracy || 50
      },
      webrtc: {
        mode: fp.webrtc?.mode || 'default',
        ipPolicy: fp.webrtc?.ipPolicy || 'default_public_interface_only'
      },
      canvas: {
        mode: fp.canvas?.mode || 'off',
        noiseSeed: fp.canvas?.noiseSeed || 12345
      },
      webgl: {
        enabled: fp.webgl?.enabled !== false,
        gpuVendor: 'Apple Inc.',
        gpuRenderer: matchedDev.gpuRenderer,
        unmaskedVendor: 'Apple Inc.',
        unmaskedRenderer: matchedDev.gpuRenderer,
        imageMode: fp.webgl?.imageMode || 'off',
        metadataMode: fp.webgl?.metadataMode || 'mask'
      },
      audio: {
        mode: fp.audio?.mode || 'noise',
        noiseSeed: fp.audio?.noiseSeed || 54321
      },
      clientRects: {
        mode: fp.clientRects?.mode || 'off',
        noiseSeed: fp.clientRects?.noiseSeed || 9999
      },
      fonts: {
        enableMasking: fp.fonts?.enableMasking !== false,
        fontList: fp.fonts?.fontList?.length ? fp.fonts.fontList : ['.AppleSystemUIFont', 'Helvetica Neue', 'Helvetica', 'SF Pro', 'Arial']
      },
      mediaDevices: {
        videoInputs: fp.mediaDevices?.videoInputs ?? 2,
        audioInputs: fp.mediaDevices?.audioInputs ?? 1,
        audioOutputs: fp.mediaDevices?.audioOutputs ?? 1
      },
      battery: {
        enabled: true,
        charging: fp.battery?.charging ?? false,
        level: fp.battery?.level ?? 0.85
      },
      networkInfo: {
        effectiveType: fp.networkInfo?.effectiveType || '4g',
        downlink: fp.networkInfo?.downlink || 15,
        rtt: fp.networkInfo?.rtt || 50
      },
      permissions: fp.permissions || {
        camera: 'prompt',
        microphone: 'prompt',
        geolocation: 'prompt',
        notifications: 'prompt',
        clipboard: 'prompt'
      }
    }
  }

  // 3. Desktop OS Defaults (Windows, macOS, Linux)
  const defaultPlatform = isWindows ? 'Win32' : isLinux ? 'Linux x86_64' : 'MacIntel'
  const defaultVendor = bType === 'firefox' ? '' : 'Google Inc.'
  const defaultGpuVendor = isWindows ? 'NVIDIA' : isMac ? (targetOs === 'macos-arm' ? 'Apple' : 'Intel') : 'Intel'
  const defaultGpuRenderer = isWindows
    ? 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    : isMac
    ? (targetOs === 'macos-arm' ? 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)' : 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)')
    : 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)'

  const defaultUnmaskedVendor = isWindows
    ? 'Google Inc. (NVIDIA)'
    : isMac
    ? (targetOs === 'macos-arm' ? 'Google Inc. (Apple)' : 'Google Inc. (Intel)')
    : 'Google Inc. (Intel)'

  const rawUa = typeof fp.navigator?.userAgent === 'string' ? fp.navigator.userAgent : ''
  const isMatchingEngine = bType === 'firefox'
    ? (rawUa.includes('Firefox/') || rawUa.includes('rv:')) && !rawUa.includes('Chrome/') && !rawUa.includes('AppleWebKit')
    : rawUa.includes('Chrome/') && !rawUa.includes('Firefox/') && !rawUa.includes('rv:') && !rawUa.includes('Gecko/20100101')
  const isMatchingOs = isWindows
    ? rawUa.includes('Windows NT')
    : isMac
    ? rawUa.includes('Macintosh')
    : rawUa.includes('Linux')

  const userAgent = isMatchingEngine && isMatchingOs
    ? rawUa
    : generateUAForOS(targetOs, bVer, bType)

  const defaultFonts = isWindows
    ? ['Segoe UI', 'Arial', 'Calibri', 'Tahoma', 'Consolas', 'Verdana']
    : isMac
    ? ['.AppleSystemUIFont', 'Helvetica Neue', 'Helvetica', 'SF Pro', 'Menlo', 'Monaco']
    : ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans']

  // Validate and sanitize GPU renderer for Mac ARM
  let finalGpuRenderer = fp.webgl?.gpuRenderer || defaultGpuRenderer
  let finalUnmaskedRenderer = fp.webgl?.unmaskedRenderer || defaultGpuRenderer
  let finalGpuVendor = fp.webgl?.gpuVendor || defaultGpuVendor
  let finalUnmaskedVendor = fp.webgl?.unmaskedVendor || defaultUnmaskedVendor

  if (targetOs === 'macos-arm') {
    const isInvalidArmGpu = !finalUnmaskedRenderer.toLowerCase().includes('apple') &&
      !finalUnmaskedRenderer.toLowerCase().includes('m1') &&
      !finalUnmaskedRenderer.toLowerCase().includes('m2') &&
      !finalUnmaskedRenderer.toLowerCase().includes('m3') &&
      !finalUnmaskedRenderer.toLowerCase().includes('m4')
    if (isInvalidArmGpu) {
      finalGpuRenderer = defaultGpuRenderer
      finalUnmaskedRenderer = defaultGpuRenderer
      finalGpuVendor = 'Apple'
      finalUnmaskedVendor = 'Google Inc. (Apple)'
    }
  } else if (isWindows) {
    const isInvalidWinGpu = finalUnmaskedRenderer.toLowerCase().includes('apple') ||
      finalUnmaskedRenderer.toLowerCase().includes('metal') ||
      finalUnmaskedRenderer.toLowerCase().includes('mesa')
    if (isInvalidWinGpu) {
      finalGpuRenderer = defaultGpuRenderer
      finalUnmaskedRenderer = defaultGpuRenderer
      finalGpuVendor = 'NVIDIA'
      finalUnmaskedVendor = 'Google Inc. (NVIDIA)'
    }
  } else if (isLinux) {
    const isInvalidLinuxGpu = finalUnmaskedRenderer.toLowerCase().includes('apple') ||
      finalUnmaskedRenderer.toLowerCase().includes('direct3d') ||
      finalUnmaskedRenderer.toLowerCase().includes('metal')
    if (isInvalidLinuxGpu) {
      finalGpuRenderer = defaultGpuRenderer
      finalUnmaskedRenderer = defaultGpuRenderer
      finalGpuVendor = 'Intel'
      finalUnmaskedVendor = 'Google Inc. (Intel)'
    }
  } else if (targetOs === 'macos-intel') {
    const isInvalidMacIntelGpu = finalUnmaskedRenderer.toLowerCase().includes('direct3d') ||
      finalUnmaskedRenderer.toLowerCase().includes('mesa')
    if (isInvalidMacIntelGpu) {
      finalGpuRenderer = defaultGpuRenderer
      finalUnmaskedRenderer = defaultGpuRenderer
      finalGpuVendor = 'Intel'
      finalUnmaskedVendor = 'Google Inc. (Intel)'
    }
  }

  return {
    version: fp.version || 3,
    seed: fp.seed || 'default-seed',
    browser: {
      name: bType === 'firefox' ? 'Firefox' : 'Chrome',
      type: bType,
      version: bVer
    },
    navigator: {
      userAgent,
      browserVersion: bVer,
      chromiumVersion: bType === 'firefox' ? bVer.split('.')[0] : '128.0.0.0',
      platform: defaultPlatform,
      vendor: defaultVendor,
      productSub: bType === 'firefox' ? '20100101' : '20030107',
      hardwareConcurrency: fp.navigator?.hardwareConcurrency || (targetOs === 'macos-arm' ? 10 : 8),
      deviceMemory: fp.navigator?.deviceMemory || (isMac ? 16 : 16),
      maxTouchPoints: 0,
      touchSupport: false,
      doNotTrack: fp.navigator?.doNotTrack || null
    },
    screen: {
      width: fp.screen?.width && fp.screen.width >= 1200 ? fp.screen.width : (isMac ? 1512 : 1920),
      height: fp.screen?.height && fp.screen.height >= 700 ? fp.screen.height : (isMac ? 982 : 1080),
      devicePixelRatio: isMac ? 2 : (fp.screen?.devicePixelRatio || 1),
      viewportWidth: fp.screen?.viewportWidth || (isMac ? 1512 : 1920),
      viewportHeight: fp.screen?.viewportHeight || (isMac ? 942 : 1040),
      colorDepth: 24,
      pixelDepth: 24
    },
    locale: {
      mode: fp.locale?.mode || 'custom',
      language: fp.locale?.language || 'en-US',
      languages: fp.locale?.languages || ['en-US', 'en'],
      displayLanguageMode: fp.locale?.displayLanguageMode || 'custom',
      displayLanguage: fp.locale?.displayLanguage || 'en-US'
    },
    timezone: {
      mode: fp.timezone?.mode || 'auto',
      timezone: fp.timezone?.timezone || 'America/New_York'
    },
    geolocation: {
      mode: fp.geolocation?.mode || 'ip-based',
      latitude: fp.geolocation?.latitude || 40.7128,
      longitude: fp.geolocation?.longitude || -74.006,
      accuracy: fp.geolocation?.accuracy || 50
    },
    webrtc: {
      mode: fp.webrtc?.mode || 'default',
      ipPolicy: fp.webrtc?.ipPolicy || 'default_public_interface_only'
    },
    canvas: {
      mode: fp.canvas?.mode || 'off',
      noiseSeed: fp.canvas?.noiseSeed || 12345
    },
    webgl: {
      enabled: fp.webgl?.enabled !== false,
      gpuVendor: finalGpuVendor,
      gpuRenderer: finalGpuRenderer,
      unmaskedVendor: finalUnmaskedVendor,
      unmaskedRenderer: finalUnmaskedRenderer,
      imageMode: fp.webgl?.imageMode || 'off',
      metadataMode: fp.webgl?.metadataMode || 'mask'
    },
    audio: {
      mode: fp.audio?.mode || 'noise',
      noiseSeed: fp.audio?.noiseSeed || 54321
    },
    clientRects: {
      mode: fp.clientRects?.mode || 'off',
      noiseSeed: fp.clientRects?.noiseSeed || 9999
    },
    fonts: {
      enableMasking: fp.fonts?.enableMasking !== false,
      fontList: fp.fonts?.fontList?.length ? fp.fonts.fontList : defaultFonts
    },
    mediaDevices: {
      videoInputs: fp.mediaDevices?.videoInputs ?? 1,
      audioInputs: fp.mediaDevices?.audioInputs ?? 1,
      audioOutputs: fp.mediaDevices?.audioOutputs ?? 2
    },
    battery: {
      enabled: fp.battery?.enabled || isMac
    },
    networkInfo: {
      effectiveType: fp.networkInfo?.effectiveType || '4g',
      downlink: fp.networkInfo?.downlink || 100,
      rtt: fp.networkInfo?.rtt || 20
    },
    permissions: fp.permissions || {
      camera: 'prompt',
      microphone: 'prompt',
      geolocation: 'prompt',
      notifications: 'prompt',
      clipboard: 'prompt'
    }
  }
}

const POPULAR_EXTENSIONS = [
  { id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', name: 'uBlock Origin', icon: '🛡️', desc: 'Efficient ad blocker & tracker protection' },
  { id: 'nkbihfbeogaeaoehlefnkodbefgpgknn', name: 'MetaMask', icon: '🦊', desc: 'Ethereum & Web3 crypto wallet' },
  { id: 'hlkenndednhfkgmmfpiicbefidmlnehc', name: 'Cookie-Editor', icon: '🍪', desc: 'View, edit, import & export cookies' },
  { id: 'obhnbhjflbinggahalbbhstdgnnfibkg', name: 'Canvas Defender', icon: '🌐', desc: 'Canvas fingerprint protection' },
  { id: 'djflhoibgkdhkhhcedjiklpkjnoahfmg', name: 'User-Agent Switcher', icon: '🎭', desc: 'Quickly spoof browser User-Agent' },
  { id: 'bgnkhhnnamicmdkohcamalignooicbfa', name: 'AdGuard AdBlocker', icon: '🔒', desc: 'Blocks ads, popups & tracking scripts' }
]

function parseChromeExtensionInput(input: string): { id: string; name: string } {
  const trimmed = input.trim()
  if (!trimmed) return { id: '', name: '' }
  const match = trimmed.match(/(?:detail\/([^\/]+)\/([a-z0-9]{32})|detail\/([a-z0-9]{32}))/i)
  if (match) {
    const rawName = match[1] ? match[1].replace(/-/g, ' ') : ''
    const extId = match[2] || match[3] || match[1]
    const formattedName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : `Extension (${extId.substring(0, 8)}...)`
    return { id: extId, name: formattedName }
  }
  const name = trimmed.length === 32 ? `Extension (${trimmed.substring(0, 8)}...)` : trimmed
  return { id: trimmed, name }
}

const PROCESSOR_OPTIONS: Record<string, string[]> = {
  'macos-arm': ['M4', 'M3', 'M2', 'M1', 'M3 Max', 'M2 Max', 'M1 Pro'],
  'macos-intel': ['Intel Core i9-9880H', 'Intel Core i7-8850H', 'Intel Core i5-8259U', 'Intel Iris Plus Graphics'],
  'windows-10': ['Intel Core i9-13900K', 'Intel Core i7-12700K', 'Intel Core i5-11400', 'AMD Ryzen 9 7950X', 'AMD Ryzen 7 5800X'],
  'windows-11': ['Intel Core i9-14900K', 'Intel Core i7-13700K', 'Intel Core i5-13400', 'AMD Ryzen 7 7800X3D', 'AMD Ryzen 5 7600X'],
  'linux': ['Intel Core i9-13900K', 'Intel Core i7-12700K', 'AMD Ryzen 9 7900X', 'Mesa Intel UHD Graphics'],
  'android': ['Snapdragon 8 Gen 3 (Adreno 750)', 'Snapdragon 8 Gen 2 (Adreno 740)', 'Google Tensor G3 (Mali-G715)', 'Exynos 2400 (Xclipse 940)'],
  'ios': ['Apple A18 Pro (6 Cores)', 'Apple A18 (6 Cores)', 'Apple A17 Pro (6 Cores)', 'Apple A16 Bionic (6 Cores)', 'Apple A15 Bionic (6 Cores)', 'Apple A14 Bionic (6 Cores)']
}

const POPULAR_BOOKMARKS = [
  { title: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { title: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
  { title: 'Facebook', url: 'https://www.facebook.com', icon: '🌐' },
  { title: 'Twitter / X', url: 'https://x.com', icon: '🐦' },
  { title: 'Amazon', url: 'https://www.amazon.com', icon: '🛒' },
  { title: 'Gmail', url: 'https://mail.google.com', icon: '✉️' }
]

function parseProxyString(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed)
      const type = url.protocol.replace(':', '').toLowerCase()
      const host = url.hostname
      const port = url.port || (type.startsWith('socks') ? '1080' : '8080')
      const username = decodeURIComponent(url.username || '')
      const password = decodeURIComponent(url.password || '')
      return { type, host, port, username, password }
    } catch { /* fallback */ }
  }

  const parts = trimmed.split(':').map(p => p.trim())
  if (parts.length === 4) {
    const isIpOrDomain = (str: string) => /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str)
    const isPort = (str: string) => /^\d{1,5}$/.test(str) && Number(str) > 0 && Number(str) <= 65535

    if (isIpOrDomain(parts[0]) && isPort(parts[1])) {
      return { type: 'socks5', host: parts[0], port: parts[1], username: parts[2], password: parts[3] }
    }
    if (isIpOrDomain(parts[2]) && isPort(parts[3])) {
      return { type: 'socks5', host: parts[2], port: parts[3], username: parts[0], password: parts[1] }
    }
    return { type: 'socks5', host: parts[0], port: parts[1], username: parts[2], password: parts[3] }
  }

  if (parts.length === 2) {
    return { type: 'socks5', host: parts[0], port: parts[1], username: '', password: '' }
  }

  return null
}

export const ProfileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialProfile,
  proxies,
  groups,
  existingProfiles,
  licenseInfo,
  onUpgrade
}) => {
  const isFreePlan = licenseInfo?.features?.proxy_support === 'basic' || licenseInfo?.plan?.id === 'plan_free' || (licenseInfo?.limits?.profiles === 3 && !licenseInfo?.features?.advanced_fingerprint)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [name, setName] = useState(() => getNextProfileName(existingProfiles))
  const [folder, setFolder] = useState('')
  const [osType, setOsType] = useState('macos-arm')
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox'>('chrome')
  const [browserVersion, setBrowserVersion] = useState<string>('128.0.6613.120')

  const availableBrowserVersions = useMemo(() => {
    return browserType === 'firefox' ? FIREFOX_VERSIONS_CATALOG : CHROME_VERSIONS_CATALOG
  }, [browserType])

  const [processorGen, setProcessorGen] = useState('M4')
  const [androidBrand, setAndroidBrand] = useState('Samsung')
  const [androidModelId, setAndroidModelId] = useState('samsung-s24-ultra')
  const [iosModelId, setIosModelId] = useState('iphone-16-pro-max')
  const [groupId, setGroupId] = useState('')
  const [notes, setNotes] = useState('')
  const [startUrl, setStartUrl] = useState('')
  const [tagsStr, setTagsStr] = useState('')

  const selectedAndroidDevice = useMemo(() => {
    return getDeviceById(androidModelId) || ANDROID_DEVICES[0]
  }, [androidModelId])

  const selectedIosDevice = useMemo(() => {
    return getIosDeviceById(iosModelId) || IOS_DEVICES[0]
  }, [iosModelId])

  // Proxy state
  const [proxyTab, setProxyTab] = useState<'saved' | 'custom' | 'none'>('none')
  const [selectedProxyId, setSelectedProxyId] = useState('')
  const [customProxyType, setCustomProxyType] = useState('socks5')
  const [customProxyHost, setCustomProxyHost] = useState('')
  const [customProxyPort, setCustomProxyPort] = useState('')
  const [customProxyUser, setCustomProxyUser] = useState('')
  const [customProxyPass, setCustomProxyPass] = useState('')
  const [changeIpUrl, setChangeIpUrl] = useState('')
  const [proxyPasteInput, setProxyPasteInput] = useState('')
  const [proxyTestState, setProxyTestState] = useState<(ProxyTestResult & { testing: boolean }) | null>(null)

  // Timezone state
  const [autoTimezone, setAutoTimezone] = useState(true)
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York')

  // Geolocation state
  const [geoMode, setGeoMode] = useState<'prompt' | 'allow' | 'block'>('prompt')
  const [autoGeo, setAutoGeo] = useState(true)
  const [latitude, setLatitude] = useState(40.7128)
  const [longitude, setLongitude] = useState(-74.006)
  const [accuracy, setAccuracy] = useState(50)

  // WebRTC state
  const [webrtcSetting, setWebrtcSetting] = useState<'based_on_ip' | 'off'>('based_on_ip')

  // Language & Display Language state
  const [languageMode, setLanguageMode] = useState<'based_on_ip' | 'custom'>('custom')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en-US', 'en'])
  const [displayLanguageMode, setDisplayLanguageMode] = useState<'based_on_language' | 'real' | 'custom'>('real')
  const [customDisplayLanguage, setCustomDisplayLanguage] = useState('en-US')
  const [showAddLanguageModal, setShowAddLanguageModal] = useState(false)
  const [languageSearch, setLanguageSearch] = useState('')
  const [openLangMenuIdx, setOpenLangMenuIdx] = useState<number | null>(null)

  const handleAddLanguage = (code: string) => {
    if (!selectedLanguages.includes(code)) {
      const nextLangs = [...selectedLanguages, code]
      setSelectedLanguages(nextLangs)
      handleFpChange(prev => ({
        ...prev,
        locale: {
          ...prev.locale,
          language: nextLangs[0] || 'en-US',
          languages: nextLangs
        }
      }))
    }
  }

  const handleRemoveLanguage = (idx: number) => {
    if (selectedLanguages.length <= 1) return
    const nextLangs = selectedLanguages.filter((_, i) => i !== idx)
    setSelectedLanguages(nextLangs)
    handleFpChange(prev => ({
      ...prev,
      locale: {
        ...prev.locale,
        language: nextLangs[0] || 'en-US',
        languages: nextLangs
      }
    }))
  }

  const handleMoveLanguage = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= selectedLanguages.length) return
    const nextLangs = [...selectedLanguages]
    const temp = nextLangs[idx]
    nextLangs[idx] = nextLangs[targetIdx]
    nextLangs[targetIdx] = temp
    setSelectedLanguages(nextLangs)
    handleFpChange(prev => ({
      ...prev,
      locale: {
        ...prev.locale,
        language: nextLangs[0] || 'en-US',
        languages: nextLangs
      }
    }))
  }

  const handleSetPrimaryLanguage = (idx: number) => {
    if (idx === 0) return
    const target = selectedLanguages[idx]
    const nextLangs = [target, ...selectedLanguages.filter((_, i) => i !== idx)]
    setSelectedLanguages(nextLangs)
    handleFpChange(prev => ({
      ...prev,
      locale: {
        ...prev.locale,
        language: nextLangs[0] || 'en-US',
        languages: nextLangs
      }
    }))
  }

  // Extensions & Bookmarks state
  const [extensions, setExtensions] = useState<{ id: string; name: string }[]>([])
  const [newExtInput, setNewExtInput] = useState('')
  const [bookmarks, setBookmarks] = useState<{ title: string; url: string }[]>([])
  const [bmTitle, setBmTitle] = useState('')
  const [bmUrl, setBmUrl] = useState('')

  // Cookies state
  const [cookies, setCookies] = useState<CookieItem[]>([])
  const [cookieSearch, setCookieSearch] = useState('')
  const [showCookieModal, setShowCookieModal] = useState(false)
  const [cookiePasteText, setCookiePasteText] = useState('')
  const [cookieImportMode, setCookieImportMode] = useState<'replace' | 'append'>('replace')
  const [cookieImportMsg, setCookieImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedCookieIdx, setCopiedCookieIdx] = useState<number | null>(null)

  // Fingerprint state initialized safely with fallback
  const [fp, setFp] = useState<any>(() => ensureFpStructure(null, 'macos-intel'))
  const [copiedUA, setCopiedUA] = useState(false)
  const [fpToast, setFpToast] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [consistencyResult, setConsistencyResult] = useState<ConsistencyResult | null>(null)

  // v3: Device Template State
  const [deviceTemplateId, setDeviceTemplateId] = useState<string>('')
  const [deviceTemplatesGrouped, setDeviceTemplatesGrouped] = useState<Record<string, any[]>>({})
  const [templateLoading, setTemplateLoading] = useState(false)

  // v3: Load device templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        if ((window as any).api?.getDeviceTemplatesGrouped) {
          const res = await (window as any).api.getDeviceTemplatesGrouped()
          if (res?.success && res?.data) {
            setDeviceTemplatesGrouped(res.data)
          }
        }
      } catch (err) {
        console.warn('Could not load device templates:', err)
      }
    }
    loadTemplates()
  }, [])

  useEffect(() => {
    if (fp) {
      if ((window as any).api?.validateFingerprint) {
        (window as any).api.validateFingerprint(fp, osType, browserType, browserVersion).then((res: any) => {
          if (res?.success && res?.data) {
            setConsistencyResult(res.data)
          }
        })
      }
    }
  }, [fp, osType, browserType, browserVersion])

  const handleFixInconsistencies = async () => {
    try {
      if ((window as any).api?.autoRepairProfile) {
        const res = await (window as any).api.autoRepairProfile(
          {
            osType,
            browserType,
            browserVersion,
            deviceTemplateId: deviceTemplateId || undefined,
            deviceModelId: osType === 'ios' ? iosModelId : osType === 'android' ? androidModelId : undefined,
            processorGen,
            customOverrides: {
              processorGen,
              language: selectedLanguages[0],
              languages: selectedLanguages,
              timezone: selectedTimezone,
              latitude,
              longitude,
              accuracy,
              webrtcMode: webrtcSetting === 'off' ? 'disabled' : 'real'
            }
          },
          fp
        )
        if (res?.success && res?.data?.repairedFingerprint) {
          const repFp = res.data.repairedFingerprint
          setFp(repFp)
          if (res.data.repairedMasterProfile) {
            if (res.data.repairedMasterProfile.browserVersion) {
              setBrowserVersion(res.data.repairedMasterProfile.browserVersion)
            }
            if (res.data.repairedMasterProfile.browserType) {
              setBrowserType(res.data.repairedMasterProfile.browserType)
            }
          }
          setFpToast(true)
          const repairedCount = res.data.repairedCount || 0
          const repairedProps = res.data.actionsTaken?.map((a: any) => a.property).join(', ')
          console.log(`[Auto-Repair] Successfully fixed ${repairedCount} field(s): ${repairedProps}`)
          setTimeout(() => setFpToast(false), 2500)

          if ((window as any).api?.validateFingerprint) {
            (window as any).api.validateFingerprint(
              repFp,
              osType,
              res.data.repairedMasterProfile?.browserType || browserType,
              res.data.repairedMasterProfile?.browserVersion || browserVersion
            ).then((valRes: any) => {
              if (valRes?.success && valRes?.data) {
                setConsistencyResult(valRes.data)
              }
            })
          }
          return
        }
      }

      // v3: If deviceTemplateId is set, use template resolver
      if (deviceTemplateId && (window as any).api?.generateFromTemplate) {
        const res = await (window as any).api.generateFromTemplate({
          osType,
          browserType,
          browserVersion,
          deviceTemplateId,
          seed: fp?.seed || 'stable-seed'
        })
        if (res?.success && res?.data?.fingerprint) {
          setFp(res.data.fingerprint)
          setFpToast(true)
          setTimeout(() => setFpToast(false), 2200)
          return
        }
      }
      if (osType === 'ios') {
        const dev = getIosDeviceById(iosModelId) || IOS_DEVICES[0]
        applyIosDeviceToFp(dev, browserType, browserVersion, osType)
        setFpToast(true)
        setTimeout(() => setFpToast(false), 2200)
        return
      }
      if (osType === 'android') {
        const dev = getDeviceById(androidModelId) || ANDROID_DEVICES[0]
        applyAndroidDeviceToFp(dev, browserType, browserVersion, osType)
        setFpToast(true)
        setTimeout(() => setFpToast(false), 2200)
        return
      }
      // v2 fallback
      if ((window as any).api?.recalculateFingerprint) {
        const res = await (window as any).api.recalculateFingerprint(fp, {
          osType,
          browserType,
          browserVersion,
          deviceModelId: undefined
        })
        if (res?.success && res?.data) {
          setFp(res.data)
          setFpToast(true)
          setTimeout(() => setFpToast(false), 2200)
          return
        }
      }
      setFp(ensureFpStructure(null, osType, browserType, browserVersion))
      setFpToast(true)
      setTimeout(() => setFpToast(false), 2200)
    } catch (err) {
      console.error('Failed to fix inconsistencies:', err)
      setFp(ensureFpStructure(null, osType, browserType, browserVersion))
    }
  }

  // v3: Handle device template selection
  const handleDeviceTemplateChange = async (templateId: string) => {
    setDeviceTemplateId(templateId)
    if (!templateId) return

    setTemplateLoading(true)
    try {
      if ((window as any).api?.generateFromTemplate) {
        const res = await (window as any).api.generateFromTemplate({
          osType,
          browserType,
          browserVersion,
          deviceTemplateId: templateId,
          seed: fp?.seed || `tpl-${Date.now()}`
        })
        if (res?.success && res?.data?.fingerprint) {
          setFp(res.data.fingerprint)
          setFpToast(true)
          setTimeout(() => setFpToast(false), 2200)
        }
      }
    } catch (err) {
      console.error('Failed to generate from template:', err)
    } finally {
      setTemplateLoading(false)
    }
  }

  const applyAndroidDeviceToFp = (dev: AndroidDeviceSpec, bType: 'chrome' | 'firefox' = browserType, bVer: string = browserVersion, targetOs = 'android') => {
    const ffVer = bVer.includes('.') ? bVer : `${bVer}.0`
    const newUa = bType === 'firefox'
      ? `Mozilla/5.0 (Android ${dev.androidVersion}; Mobile; rv:${ffVer}) Gecko/${ffVer} Firefox/${ffVer}`
      : `Mozilla/5.0 (Linux; Android ${dev.androidVersion}; ${dev.modelCode}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bVer} Mobile Safari/537.36`

    handleFpChange(prev => ({
      ...prev,
      browser: {
        name: bType === 'firefox' ? 'Firefox' : 'Chrome',
        type: bType,
        version: bVer
      },
      navigator: {
        ...prev.navigator,
        userAgent: newUa,
        appVersion: bType === 'firefox'
          ? `5.0 (Android ${dev.androidVersion})`
          : `5.0 (Linux; Android ${dev.androidVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bVer} Mobile Safari/537.36`,
        platform: 'Linux armv8l',
        deviceBrand: dev.brand,
        deviceModel: dev.modelName,
        deviceModelCode: dev.modelCode,
        hardwareConcurrency: dev.cores,
        deviceMemory: dev.memory,
        maxTouchPoints: 5,
        touchSupport: true,
        vendor: bType === 'firefox' ? '' : 'Google Inc.',
        browserVersion: bVer
      },
      screen: {
        ...prev.screen,
        width: dev.screenWidth,
        height: dev.screenHeight,
        availWidth: dev.screenWidth,
        availHeight: dev.screenHeight,
        devicePixelRatio: dev.dpr,
        viewportWidth: dev.screenWidth,
        viewportHeight: Math.floor(dev.screenHeight * 0.9),
        orientation: 'portrait-primary',
        orientationAngle: 0
      },
      webgl: {
        ...prev.webgl,
        gpuVendor: dev.gpuVendor,
        gpuRenderer: dev.gpuRenderer,
        unmaskedVendor: dev.gpuVendor,
        unmaskedRenderer: dev.gpuRenderer
      }
    }), targetOs)
  }

  const handleAndroidBrandChange = (newBrand: string) => {
    setAndroidBrand(newBrand)
    const brandDevices = getDevicesByBrand(newBrand)
    if (brandDevices.length > 0) {
      const firstDev = brandDevices[0]
      setAndroidModelId(firstDev.id)
      applyAndroidDeviceToFp(firstDev, browserType, browserVersion, osType)
    }
  }

  const handleAndroidModelChange = (newModelId: string) => {
    setAndroidModelId(newModelId)
    const dev = getDeviceById(newModelId)
    if (dev) {
      applyAndroidDeviceToFp(dev, browserType, browserVersion, osType)
    }
  }

  const applyBrowserConfig = (
    bType: 'chrome' | 'firefox',
    bVersion: string,
    currentOs: string
  ) => {
    if (currentOs === 'ios') {
      const dev = getIosDeviceById(iosModelId) || IOS_DEVICES[0]
      applyIosDeviceToFp(dev, bType, bVersion, currentOs)
    } else if (currentOs === 'android') {
      const dev = getDeviceById(androidModelId) || ANDROID_DEVICES[0]
      applyAndroidDeviceToFp(dev, bType, bVersion, currentOs)
    } else {
      const newUa = generateUAForOS(currentOs, bVersion, bType)
      handleFpChange(prev => ({
        ...prev,
        browser: {
          name: bType === 'firefox' ? 'Firefox' : 'Chrome',
          type: bType,
          version: bVersion
        },
        navigator: {
          ...prev.navigator,
          userAgent: newUa,
          vendor: bType === 'firefox' ? '' : 'Google Inc.',
          browserVersion: bVersion
        }
      }), currentOs)
    }
  }

  const applyIosDeviceToFp = (dev: IosDeviceSpec, bType: 'chrome' | 'firefox' = browserType, bVer: string = browserVersion, targetOs = 'ios') => {
    const ffVer = bVer.includes('.') ? bVer : `${bVer}.0`
    const newUa = bType === 'firefox'
      ? `Mozilla/5.0 (iPhone; CPU iPhone OS ${dev.iosVersion.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${ffVer} Mobile/15E148 Safari/605.1.15`
      : `Mozilla/5.0 (iPhone; CPU iPhone OS ${dev.iosVersion.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${bVer} Mobile/15E148 Safari/604.1`

    handleFpChange(prev => ({
      ...prev,
      browser: {
        name: bType === 'firefox' ? 'Firefox' : 'Chrome',
        type: bType,
        version: bVer
      },
      navigator: {
        ...prev.navigator,
        platform: 'iPhone',
        userAgent: newUa,
        deviceModel: dev.modelName,
        deviceModelCode: dev.id,
        deviceBrand: 'Apple',
        hardwareConcurrency: dev.cpuCores,
        deviceMemory: dev.ramGb,
        maxTouchPoints: 5,
        touchSupport: true,
        vendor: 'Apple Computer, Inc.',
        browserVersion: bVer
      },
      screen: {
        ...prev.screen,
        width: dev.width,
        height: dev.height,
        availWidth: dev.width,
        availHeight: dev.height,
        devicePixelRatio: dev.dpr,
        colorDepth: 32,
        pixelDepth: 32
      },
      webgl: {
        ...prev.webgl,
        unmaskedVendor: 'Apple Inc.',
        unmaskedRenderer: dev.gpuRenderer,
        vendor: 'Apple Inc.',
        renderer: dev.gpuRenderer
      },
      fonts: {
        ...prev.fonts,
        fontList: ['.AppleSystemUIFont', 'Helvetica Neue', 'Helvetica', 'SF Pro', 'Arial']
      }
    }), targetOs)
  }

  const handleIosModelChange = (newModelId: string) => {
    setIosModelId(newModelId)
    const dev = getIosDeviceById(newModelId)
    if (dev) {
      applyIosDeviceToFp(dev, browserType, browserVersion, osType)
    }
  }

  const handleBrowserTypeChange = async (newBrowser: 'chrome' | 'firefox') => {
    setBrowserType(newBrowser)
    const defaultVer = newBrowser === 'firefox' ? '129.0' : (CHROME_VERSIONS_CATALOG[0]?.version || '128.0.6613.120')
    setBrowserVersion(defaultVer)
    try {
      if ((window as any).api?.recalculateFingerprint) {
        const res = await (window as any).api.recalculateFingerprint(fp, {
          osType,
          browserType: newBrowser,
          browserVersion: defaultVer,
          processorGen,
          deviceModelId: osType === 'ios' ? iosModelId : osType === 'android' ? androidModelId : undefined
        })
        if (res?.success && res?.data) {
          setFp(res.data)
          return
        }
      }
    } catch {}
    applyBrowserConfig(newBrowser, defaultVer, osType)
  }

  const handleBrowserVersionChange = async (newVersion: string) => {
    setBrowserVersion(newVersion)
    try {
      if ((window as any).api?.recalculateFingerprint) {
        const res = await (window as any).api.recalculateFingerprint(fp, {
          osType,
          browserType,
          browserVersion: newVersion,
          processorGen,
          deviceModelId: osType === 'ios' ? iosModelId : osType === 'android' ? androidModelId : undefined
        })
        if (res?.success && res?.data) {
          setFp(res.data)
          return
        }
      }
    } catch {}
    applyBrowserConfig(browserType, newVersion, osType)
  }

  const handleImportCookieText = (rawText: string, mode: 'replace' | 'append' = 'replace') => {
    setCookieImportMsg(null)
    const result = parseCookies(rawText)
    if (!result.success || result.cookies.length === 0) {
      setCookieImportMsg({
        type: 'error',
        text: result.error || 'No valid cookies found. Please check JSON format or Netscape format.'
      })
      return false
    }

    if (mode === 'replace') {
      setCookies(result.cookies)
    } else {
      // Append without duplicating exact name+domain
      setCookies(prev => {
        const existingKeys = new Set(prev.map(c => `${c.domain}|${c.name}`))
        const newItems = result.cookies.filter(c => !existingKeys.has(`${c.domain}|${c.name}`))
        return [...prev, ...newItems]
      })
    }

    setCookieImportMsg({
      type: 'success',
      text: `✓ Successfully imported ${result.cookies.length} cookie${result.cookies.length === 1 ? '' : 's'}!`
    })
    setCookiePasteText('')
    setTimeout(() => {
      setShowCookieModal(false)
      setCookieImportMsg(null)
    }, 1200)
    return true
  }

  const handleCookieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const text = String(evt.target?.result || '')
      handleImportCookieText(text, cookieImportMode)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportCookies = () => {
    if (cookies.length === 0) return
    const jsonStr = JSON.stringify(cookies, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(name || 'profile').replace(/\s+/g, '_')}_cookies.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyCookieVal = (val: string, idx: number) => {
    navigator.clipboard.writeText(val)
    setCopiedCookieIdx(idx)
    setTimeout(() => setCopiedCookieIdx(null), 1500)
  }

  const handleUserAgentChange = (newUA: string) => {
    let browserVer = fp?.navigator?.browserVersion || '128.0.0.0'
    let chromVer = fp?.navigator?.chromiumVersion || '128.0.0.0'
    let platform = fp?.navigator?.platform || 'Win32'

    const chromeMatch = newUA.match(/Chrome\/([0-9.]+)/)
    if (chromeMatch && chromeMatch[1]) {
      browserVer = chromeMatch[1]
      chromVer = chromeMatch[1].split('.')[0]
    }

    if (newUA.includes('Macintosh') || newUA.includes('Mac OS X')) {
      platform = 'MacIntel'
    } else if (newUA.includes('Windows NT')) {
      platform = 'Win32'
    } else if (newUA.includes('Android')) {
      platform = 'Linux armv8l'
    } else if (newUA.includes('Linux')) {
      platform = 'Linux x86_64'
    } else if (newUA.includes('iPhone') || newUA.includes('iPad')) {
      platform = 'iPhone'
    }

    handleFpChange(prev => ({
      ...prev,
      navigator: {
        ...prev.navigator,
        userAgent: newUA,
        browserVersion: browserVer,
        chromiumVersion: chromVer,
        platform
      }
    }))
  }

  const handlePasteUAClick = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        handleUserAgentChange(text.trim())
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err)
    }
  }

  const handleSelectUAPreset = (preset: (typeof POPULAR_UA_PRESETS)[0]) => {
    handleUserAgentChange(preset.ua)
  }

  useEffect(() => {
    if (isOpen) {
      const nextName = getNextProfileName(existingProfiles)
      if (initialProfile) {
        setName(initialProfile.name || nextName)
        setFolder(initialProfile.folder || '')
        const targetOs = initialProfile.osType || 'macos-intel'
        setOsType(targetOs)
        setGroupId(initialProfile.groupId || '')
        setNotes(initialProfile.notes || '')
        setTagsStr((initialProfile.tags || []).join(', '))

        const initialBrowserType: 'chrome' | 'firefox' = initialProfile.browserType || (initialProfile.fingerprint?.browser?.type) || (initialProfile.fingerprint?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
        let initialBrowserVer: string = initialProfile.browserVersion || initialProfile.fingerprint?.browser?.version || initialProfile.fingerprint?.navigator?.browserVersion || (initialBrowserType === 'firefox' ? '129.0' : '128.0.6613.120')
        if (initialBrowserType === 'firefox' && (initialBrowserVer.split('.').length > 2 || initialBrowserVer.includes('6613') || initialBrowserVer.includes('Chrome'))) {
          initialBrowserVer = '129.0'
        }
        if (initialBrowserType === 'chrome' && initialBrowserVer.split('.').length <= 2) {
          initialBrowserVer = '128.0.6613.120'
        }
        setBrowserType(initialBrowserType)
        setBrowserVersion(initialBrowserVer)

        // Synchronize processor generation for Mac ARM
        if (targetOs === 'macos-arm') {
          const rawGpu = (initialProfile.fingerprint?.webgl?.unmaskedRenderer || initialProfile.fingerprint?.webgl?.gpuRenderer || '').toLowerCase()
          if (rawGpu.includes('m4 pro')) setProcessorGen('M4 Pro')
          else if (rawGpu.includes('m4')) setProcessorGen('M4')
          else if (rawGpu.includes('m3 max')) setProcessorGen('M3 Max')
          else if (rawGpu.includes('m3 pro')) setProcessorGen('M3 Pro')
          else if (rawGpu.includes('m3')) setProcessorGen('M3')
          else if (rawGpu.includes('m2 max')) setProcessorGen('M2 Max')
          else if (rawGpu.includes('m2')) setProcessorGen('M2')
          else if (rawGpu.includes('m1 pro')) setProcessorGen('M1 Pro')
          else if (rawGpu.includes('m1')) setProcessorGen('M1')
          else setProcessorGen('M4')
        }

        if (targetOs === 'android') {
          const rawCode = initialProfile.fingerprint?.navigator?.deviceModelCode || initialProfile.fingerprint?.navigator?.deviceModel || ''
          const matched = (rawCode ? getDeviceById(rawCode) : null) || ANDROID_DEVICES[0]
          setAndroidBrand(matched.brand)
          setAndroidModelId(matched.id)
        } else if (targetOs === 'ios') {
          const rawCode = initialProfile.fingerprint?.navigator?.deviceModelCode || initialProfile.fingerprint?.navigator?.deviceModel || ''
          const matched = (rawCode ? getIosDeviceById(rawCode) : null) || IOS_DEVICES[0]
          setIosModelId(matched.id)
        }

        if (initialProfile.proxyId) {
          setSelectedProxyId(initialProfile.proxyId)
          const px = (proxies || []).find(p => p.id === initialProfile.proxyId)
          if (px) {
            setCustomProxyType(px.type || 'socks5')
            setCustomProxyHost(px.host || '')
            setCustomProxyPort(px.port ? String(px.port) : '')
            setCustomProxyUser(px.username || '')
            setCustomProxyPass('')
          }
          setProxyTab('saved')
        } else {
          setProxyTab('none')
          setSelectedProxyId('')
        }

        if (initialProfile.fingerprint && Object.keys(initialProfile.fingerprint).length > 0) {
          const loadedFp = ensureFpStructure(initialProfile.fingerprint, targetOs, initialBrowserType, initialBrowserVer)
          setFp(loadedFp)
          setSelectedTimezone(loadedFp.timezone?.timezone || 'America/New_York')
          setAutoTimezone(loadedFp.timezone?.mode === 'auto')
          setGeoMode(loadedFp.geolocation?.mode === 'custom' ? 'allow' : loadedFp.geolocation?.mode === 'block' ? 'block' : 'prompt')
          const fpWrtc = loadedFp.webrtc?.mode || initialProfile.webrtcMode
          setWebrtcSetting(fpWrtc === 'disabled' || fpWrtc === 'off' ? 'off' : 'based_on_ip')
          const loadedLocale = loadedFp.locale || initialProfile.fingerprint?.locale
          setLanguageMode(loadedLocale?.mode || 'custom')
          const langs = loadedLocale?.languages || (loadedLocale?.language ? [loadedLocale.language, 'en'] : ['en-US', 'en'])
          setSelectedLanguages(langs)
          setDisplayLanguageMode(loadedLocale?.displayLanguageMode || 'real')
          setCustomDisplayLanguage(loadedLocale?.displayLanguage || 'en-US')
        } else {
          const rawFp = initialProfile.fingerprint || null
          setFp(ensureFpStructure(rawFp, targetOs, initialBrowserType, initialBrowserVer))
          const fpWrtc = initialProfile.webrtcMode
          setWebrtcSetting(fpWrtc === 'disabled' || fpWrtc === 'off' ? 'off' : 'based_on_ip')
          setLanguageMode('custom')
          setSelectedLanguages(['en-US', 'en'])
          setDisplayLanguageMode('real')
          setCustomDisplayLanguage('en-US')
        }
        setStartUrl(initialProfile.startUrl || initialProfile.fingerprint?.browser?.startUrl || '')
        if (initialProfile.extensions && Array.isArray(initialProfile.extensions)) {
          setExtensions(initialProfile.extensions)
        } else if (initialProfile.fingerprint?.browser?.extensions && Array.isArray(initialProfile.fingerprint.browser.extensions)) {
          setExtensions(initialProfile.fingerprint.browser.extensions)
        } else {
          setExtensions([])
        }
        if (initialProfile.bookmarks && Array.isArray(initialProfile.bookmarks)) {
          setBookmarks(initialProfile.bookmarks)
        } else if (initialProfile.fingerprint?.browser?.bookmarks && Array.isArray(initialProfile.fingerprint.browser.bookmarks)) {
          setBookmarks(initialProfile.fingerprint.browser.bookmarks)
        } else {
          setBookmarks([])
        }
        if (initialProfile.cookies && Array.isArray(initialProfile.cookies)) {
          setCookies(initialProfile.cookies)
        } else if (initialProfile.fingerprint?.browser?.cookies && Array.isArray(initialProfile.fingerprint.browser.cookies)) {
          setCookies(initialProfile.fingerprint.browser.cookies)
        } else {
          setCookies([])
        }
      } else {
        setName(nextName)
        setFolder('')
        setOsType('macos-arm')
        setBrowserType('chrome')
        setGroupId('')
        setNotes('')
        setTagsStr('')
        setProxyTab('none')
        setSelectedProxyId('')
        setAutoTimezone(true)
        setAutoGeo(true)
        setGeoMode('prompt')
        setExtensions([])
        setBookmarks([])
        setCookies([])
        handleGenerateNew('macos-arm')
      }
      setActiveTab('overview')
    }
  }, [isOpen, initialProfile, existingProfiles])

  const handleGenerateNew = async (targetOs: string) => {
    if (targetOs === 'android') {
      const brandDevices = getDevicesByBrand(androidBrand)
      const dev = (brandDevices.length > 1 ? brandDevices[Math.floor(Math.random() * brandDevices.length)] : null) || ANDROID_DEVICES[Math.floor(Math.random() * ANDROID_DEVICES.length)]
      if (dev) {
        setAndroidBrand(dev.brand)
        setAndroidModelId(dev.id)
        applyAndroidDeviceToFp(dev, browserType, browserVersion)
        setFpToast(true)
        setTimeout(() => setFpToast(false), 2200)
        return
      }
    } else if (targetOs === 'ios') {
      const dev = IOS_DEVICES[Math.floor(Math.random() * IOS_DEVICES.length)]
      if (dev) {
        setIosModelId(dev.id)
        applyIosDeviceToFp(dev, browserType, browserVersion, targetOs)
        setFpToast(true)
        setTimeout(() => setFpToast(false), 2200)
        return
      }
    }
    try {
      const randomSeed = Math.random().toString(36).substring(2) + Date.now().toString(36)
      if ((window as any).api?.generateFingerprint) {
        const res = await (window as any).api.generateFingerprint({ osType: targetOs, browserType, browserVersion, seed: randomSeed })
        if (res?.success && res?.data) {
          setFp(ensureFpStructure(res.data, targetOs, browserType, browserVersion))
          setFpToast(true)
          setTimeout(() => setFpToast(false), 2200)
          return
        }
      }
    } catch (err) {
      console.error('Failed to generate fingerprint:', err)
    }
    // Fallback if API fails
    setFp(ensureFpStructure(null, targetOs, browserType, browserVersion))
    setFpToast(true)
    setTimeout(() => setFpToast(false), 2200)
  }

  const handleOsChange = async (newOs: string) => {
    setOsType(newOs)
    setDeviceTemplateId('')
    if (newOs === 'android') {
      const dev = getDeviceById(androidModelId) || ANDROID_DEVICES[0]
      setAndroidBrand(dev.brand)
      setAndroidModelId(dev.id)
      applyAndroidDeviceToFp(dev, browserType, browserVersion, newOs)
      setFpToast(true)
      setTimeout(() => setFpToast(false), 2200)
    } else if (newOs === 'ios') {
      const dev = getIosDeviceById(iosModelId) || IOS_DEVICES[0]
      setIosModelId(dev.id)
      applyIosDeviceToFp(dev, browserType, browserVersion, newOs)
      setFpToast(true)
      setTimeout(() => setFpToast(false), 2200)
    } else {
      const options = PROCESSOR_OPTIONS[newOs] || ['Default Processor']
      const newProc = options[0] || 'Default Processor'
      setProcessorGen(newProc)
      try {
        if ((window as any).api?.recalculateFingerprint) {
          const res = await (window as any).api.recalculateFingerprint(fp, {
            osType: newOs,
            browserType,
            browserVersion,
            processorGen: newProc
          })
          if (res?.success && res?.data) {
            setFp(res.data)
            setFpToast(true)
            setTimeout(() => setFpToast(false), 2200)
            return
          }
        }
      } catch {}
      handleGenerateNew(newOs)
    }
  }

  const handleFpChange = (updater: (prev: any) => any, currentOs?: string) => {
    setFp((prev: any) => ensureFpStructure(updater(prev), currentOs || osType, browserType, browserVersion))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!name.trim() || isSaving) return
    setIsSaving(true)

    try {
      const finalFp = ensureFpStructure(fp, osType, browserType, browserVersion)

      // Update timezone, geolocation & WebRTC in fingerprint object
      finalFp.timezone.mode = autoTimezone ? 'auto' : 'manual'
      finalFp.timezone.timezone = selectedTimezone
      finalFp.geolocation.mode = autoGeo ? 'ip-based' : (geoMode === 'allow' ? 'custom' : geoMode)
      finalFp.geolocation.latitude = latitude
      finalFp.geolocation.longitude = longitude
      finalFp.geolocation.accuracy = accuracy
      finalFp.webrtc.mode = webrtcSetting === 'off' ? 'disabled' : 'real'
      finalFp.webrtc.ipPolicy = webrtcSetting === 'off' ? 'disable_non_proxied_udp' : 'default_public_interface_only'

      // Update Language & Locale in fingerprint object
      finalFp.locale = finalFp.locale || {}
      finalFp.locale.mode = languageMode
      finalFp.locale.language = selectedLanguages[0] || 'en-US'
      finalFp.locale.languages = selectedLanguages.length > 0 ? selectedLanguages : ['en-US', 'en']
      finalFp.locale.displayLanguageMode = displayLanguageMode
      finalFp.locale.displayLanguage = displayLanguageMode === 'custom' ? customDisplayLanguage : displayLanguageMode === 'real' ? 'en-US' : (selectedLanguages[0] || 'en-US')

      // Handle proxy resolution
      let finalProxyId: string | null = null
      if (proxyTab === 'saved') {
        finalProxyId = selectedProxyId || null
      } else if (proxyTab === 'custom' && customProxyHost) {
        const proxyInput: any = {
          type: customProxyType,
          host: customProxyHost,
          port: Number(customProxyPort) || 80,
          username: customProxyUser
        }
        if (customProxyPass) {
          proxyInput.password = customProxyPass
        }

        if (initialProfile?.proxyId && (window as any).api?.updateProxy) {
          await (window as any).api.updateProxy(initialProfile.proxyId, proxyInput)
          finalProxyId = initialProfile.proxyId
        } else if ((window as any).api?.createProxy) {
          const newProxyRes = await (window as any).api.createProxy({
            name: `Proxy for ${name}`,
            ...proxyInput
          })
          if (newProxyRes?.success && newProxyRes?.data?.id) {
            finalProxyId = newProxyRes.data.id
          }
        }
      }

      finalFp.browser = finalFp.browser || {}
      finalFp.browser.type = browserType
      finalFp.browser.name = browserType === 'firefox' ? 'Firefox' : 'Chrome'
      finalFp.browser.version = browserVersion
      finalFp.navigator = finalFp.navigator || {}
      finalFp.navigator.browserVersion = browserVersion
      finalFp.browser.extensions = extensions
      finalFp.browser.bookmarks = bookmarks
      finalFp.browser.cookies = cookies
      finalFp.browser.startUrl = startUrl

      const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean)

      await onSave({
        name,
        folder,
        osType,
        browserType,
        browserVersion,
        deviceTemplateId: deviceTemplateId || null,
        groupId: groupId || null,
        proxyId: finalProxyId,
        webrtcMode: webrtcSetting === 'off' ? 'disabled' : 'default',
        notes,
        startUrl,
        tags,
        fingerprint: { ...finalFp, deviceTemplateId: deviceTemplateId || undefined },
        extensions,
        bookmarks,
        cookies
      })
      onClose()
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return TIMEZONE_LIST
    const q = timezoneSearch.toLowerCase()
    return TIMEZONE_LIST.filter(t => t.tz.toLowerCase().includes(q) || t.offset.includes(q))
  }, [timezoneSearch])

  const copyUAToClipboard = () => {
    const ua = fp?.navigator?.userAgent
    if (ua) {
      navigator.clipboard.writeText(ua)
      setCopiedUA(true)
      setTimeout(() => setCopiedUA(false), 2000)
    }
  }

  const activeProxyName = useMemo(() => {
    if (proxyTab === 'none') return 'Without proxy'
    const flag = proxyTestState?.flag || '🌐'
    if (proxyTab === 'saved') {
      const p = (proxies || []).find(px => px.id === selectedProxyId)
      return p ? `${flag} ${p.type}://${p.host}:${p.port}` : 'Saved proxy'
    }
    if (proxyTab === 'custom') {
      return customProxyHost ? `${flag} ${customProxyType}://${customProxyHost}:${customProxyPort || '80'}` : 'Custom proxy'
    }
    return 'Without proxy'
  }, [proxyTab, selectedProxyId, proxies, customProxyType, customProxyHost, customProxyPort, proxyTestState])

  const safeFp = useMemo(() => ensureFpStructure(fp, osType), [fp, osType])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1C1C28',
        border: '1px solid #2C2C3E',
        borderRadius: '12px',
        width: '1020px',
        height: '740px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
        overflow: 'hidden',
        color: '#E2E8F0'
      }}>

        {/* ── Top Header Bar ── */}
        <div style={{
          padding: '20px 28px 12px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          backgroundColor: '#1C1C28'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F1F5F9' }}>
              {initialProfile ? `Edit Profile — ${name}` : 'New Browser Profile'}
            </h2>
            {consistencyResult && (
              <ConsistencyBadge result={consistencyResult} />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '22px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* ── Live Contradiction / Consistency Warning Banner ── */}
        {consistencyResult && (consistencyResult.failures > 0 || (consistencyResult.contradictions && consistencyResult.contradictions.length > 0)) && (
          <div style={{
            margin: '0 28px 10px',
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#FCA5A5' }}>
              <span>⚠️</span>
              <span>
                <strong>Incompatible Configuration:</strong> {consistencyResult.contradictions?.[0] || consistencyResult.warnings?.[0] || 'Contradictory values detected.'}
                {((consistencyResult.contradictions?.length || 0) + (consistencyResult.failures || 0)) > 1 && (
                  <span style={{ opacity: 0.8, marginLeft: '4px' }}>
                    (+{((consistencyResult.contradictions?.length || 0) + (consistencyResult.failures || 0)) - 1} more issue{((consistencyResult.contradictions?.length || 0) + (consistencyResult.failures || 0)) > 2 ? 's' : ''})
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={handleFixInconsistencies}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              ⚡ Auto-Fix Coherence
            </button>
          </div>
        )}

        {/* ── Name & Folder Inputs Row ── */}
        <div style={{ padding: '0 28px 16px', display: 'flex', gap: '16px' }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Profile Name"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#14141F',
              border: '1px solid #2C2C3E',
              color: '#FFF',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <input
            type="text"
            value={folder}
            onChange={e => setFolder(e.target.value)}
            placeholder="No folder"
            style={{
              width: '260px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#14141F',
              border: '1px solid #2C2C3E',
              color: '#94A3B8',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* ── Navigation Tabs ── */}
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '0 28px',
          borderBottom: '1px solid #2C2C3E',
          backgroundColor: '#1C1C28'
        }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'proxy', label: 'Proxy' },
            { id: 'timezone', label: 'Timezone' },
            { id: 'language', label: 'Language' },
            { id: 'webrtc', label: 'WebRTC' },
            { id: 'extensions', label: 'Extensions' },
            { id: 'bookmarks', label: 'Bookmarks' },
            { id: 'geolocation', label: 'Geolocation' },
            { id: 'advanced', label: 'Advanced' },
            { id: 'cookies', label: `Cookies${cookies.length > 0 ? ` (${cookies.length})` : ''}` }
          ].map(t => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as TabType)}
                style={{
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid #2DD4BF' : '2px solid transparent',
                  color: active ? '#2DD4BF' : '#94A3B8',
                  fontSize: '14px',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Main Body: Left Content + Right Profile Summary Panel ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left Form Content Area */}
          <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>

              {/* ── TAB: OVERVIEW ── */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

                  {/* Operating System Segmented Buttons Bar */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                      Operating System
                    </label>
                    <div style={{
                      display: 'flex',
                      backgroundColor: '#14141F',
                      borderRadius: '8px',
                      border: '1px solid #2C2C3E',
                      overflow: 'hidden',
                      padding: '2px'
                    }}>
                      {[
                        { id: 'windows-10', label: 'Windows 10' },
                        { id: 'windows-11', label: 'Windows 11' },
                        { id: 'macos-intel', label: 'Mac Intel' },
                        { id: 'macos-arm', label: 'Mac ARM' },
                        { id: 'linux', label: 'Linux' },
                        { id: 'ios', label: 'iOS / iPhone' },
                        { id: 'android', label: 'Android' }
                      ].map(os => {
                        const isSelected = osType === os.id
                        return (
                          <button
                            key={os.id}
                            type="button"
                            onClick={() => handleOsChange(os.id)}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              backgroundColor: isSelected ? '#1C1C28' : 'transparent',
                              color: isSelected ? '#2DD4BF' : '#94A3B8',
                              border: isSelected ? '1px solid #2DD4BF' : '1px solid transparent',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'center'
                            }}
                          >
                            {os.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Browser Selection Section */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                      Browser Engine & Type
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleBrowserTypeChange('chrome')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          backgroundColor: browserType === 'chrome' ? '#1C1C28' : '#14141F',
                          color: browserType === 'chrome' ? '#2DD4BF' : '#94A3B8',
                          border: browserType === 'chrome' ? '1px solid #2DD4BF' : '1px solid #2C2C3E',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: browserType === 'chrome' ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left'
                        }}
                      >
                        <ChromeLogo size={28} />
                        <div>
                          <div style={{ color: browserType === 'chrome' ? '#FFF' : '#CBD5E1', fontWeight: 600 }}>Google Chrome / Chromium</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Blink Engine • Full Client Hints</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBrowserTypeChange('firefox')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          backgroundColor: browserType === 'firefox' ? '#1C1C28' : '#14141F',
                          color: browserType === 'firefox' ? '#F97316' : '#94A3B8',
                          border: browserType === 'firefox' ? '1px solid #F97316' : '1px solid #2C2C3E',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: browserType === 'firefox' ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left'
                        }}
                      >
                        <FirefoxLogo size={28} />
                        <div>
                          <div style={{ color: browserType === 'firefox' ? '#FFF' : '#CBD5E1', fontWeight: 600 }}>Mozilla Firefox</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Gecko Engine • Firefox Quantum</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Browser Version Selection Section */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                      Browser Version
                    </label>
                    <select
                      value={browserVersion}
                      onChange={e => handleBrowserVersionChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#14141F',
                        border: '1px solid #2C2C3E',
                        color: '#FFF',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      {availableBrowserVersions.map(v => (
                        <option key={v.version} value={v.version}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* v3: Device Hardware Template Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                      🔧 Device Hardware Template
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '8px', fontWeight: 400 }}>
                        All hardware values derive from this template
                      </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      <select
                        value={deviceTemplateId}
                        onChange={e => handleDeviceTemplateChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: templateLoading ? '#1a1a2e' : '#14141F',
                          border: deviceTemplateId ? '1px solid #2DD4BF' : '1px solid #2C2C3E',
                          color: '#FFF',
                          fontSize: '14px',
                          outline: 'none',
                          opacity: templateLoading ? 0.6 : 1
                        }}
                      >
                        <option value="">— Select a hardware template (optional) —</option>
                        {Object.entries(deviceTemplatesGrouped)
                          .filter(([category]) => {
                            // Filter categories to match current OS
                            const catLower = category.toLowerCase()
                            if (osType.startsWith('windows')) return catLower.includes('windows')
                            if (osType.startsWith('macos')) return catLower.includes('mac') || catLower.includes('apple')
                            if (osType === 'linux') return catLower.includes('linux')
                            if (osType === 'ios') return catLower.includes('iphone') || catLower.includes('ios')
                            if (osType === 'android') return catLower.includes('android') || catLower.includes('samsung') || catLower.includes('google') || catLower.includes('oneplus') || catLower.includes('xiaomi')
                            return true
                          })
                          .map(([category, templates]) => (
                            <optgroup key={category} label={category}>
                              {(templates as any[]).map((t: any) => (
                                <option key={t.id} value={t.id}>
                                  {t.model} — {t.cpuModel} • {t.gpuModel} • {t.screenWidth}×{t.screenHeight} @{t.devicePixelRatio}x • {t.memoryGB}GB RAM
                                </option>
                              ))}
                            </optgroup>
                          ))}
                      </select>

                      {/* Template specs badge */}
                      {deviceTemplateId && (() => {
                        const allTemplates = Object.values(deviceTemplatesGrouped).flat() as any[]
                        const tpl = allTemplates.find((t: any) => t.id === deviceTemplateId)
                        if (!tpl) return null
                        return (
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            backgroundColor: '#14141F',
                            border: '1px solid #2DD4BF33',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#94A3B8'
                          }}>
                            <span style={{ background: 'rgba(45,212,191,0.15)', color: '#2DD4BF', padding: '3px 10px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>
                              🔒 Template Locked
                            </span>
                            <span>⚡ <strong>CPU:</strong> {tpl.cpuModel} ({tpl.cpuThreads} threads)</span>
                            <span>🎮 <strong>GPU:</strong> {tpl.gpuModel}</span>
                            <span>📐 <strong>Screen:</strong> {tpl.screenWidth}×{tpl.screenHeight} @{tpl.devicePixelRatio}x</span>
                            <span>🧠 <strong>RAM:</strong> {tpl.memoryGB} GB</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Dynamic Processor or Mobile Device Selection (v2 fallback when no template selected) */}
                  {!deviceTemplateId && osType === 'ios' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                          📱 iPhone Model & Generation
                        </label>
                        <select
                          value={iosModelId}
                          onChange={e => handleIosModelChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: '#14141F',
                            border: '1px solid #2C2C3E',
                            color: '#FFF',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        >
                          {IOS_DEVICES.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.modelName} (iOS {d.iosVersion} • {d.cpu})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Realtime Specs Badge Bar */}
                      {selectedIosDevice && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 14px',
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#94A3B8'
                        }}>
                          <span style={{ background: 'rgba(45,212,191,0.12)', color: '#2DD4BF', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            Apple • {selectedIosDevice.modelCode}
                          </span>
                          <span>⚡ <strong>Chipset:</strong> {selectedIosDevice.cpu}</span>
                          <span>🎮 <strong>GPU:</strong> {selectedIosDevice.gpuRenderer}</span>
                          <span>📐 <strong>Display:</strong> {selectedIosDevice.screenWidth}x{selectedIosDevice.screenHeight} (@{selectedIosDevice.dpr}x DPR)</span>
                          <span>🧠 <strong>RAM:</strong> {selectedIosDevice.memory} GB</span>
                          <span>🍏 <strong>iOS {selectedIosDevice.iosVersion}</strong></span>
                        </div>
                      )}
                    </div>
                  ) : !deviceTemplateId && osType === 'android' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {/* Device Brand Dropdown */}
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                            📱 Device Brand / Manufacturer
                          </label>
                          <select
                            value={androidBrand}
                            onChange={e => handleAndroidBrandChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#14141F',
                              border: '1px solid #2C2C3E',
                              color: '#FFF',
                              fontSize: '14px',
                              outline: 'none'
                            }}
                          >
                            {ANDROID_BRANDS.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        {/* Mobile Model Dropdown */}
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                            🔥 Mobile Model
                          </label>
                          <select
                            value={androidModelId}
                            onChange={e => handleAndroidModelChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#14141F',
                              border: '1px solid #2C2C3E',
                              color: '#FFF',
                              fontSize: '14px',
                              outline: 'none'
                            }}
                          >
                            {getDevicesByBrand(androidBrand).map(d => (
                              <option key={d.id} value={d.id}>{d.modelName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Realtime Specs Badge Bar */}
                      {selectedAndroidDevice && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 14px',
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#94A3B8'
                        }}>
                          <span style={{ background: 'rgba(45,212,191,0.12)', color: '#2DD4BF', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            {selectedAndroidDevice.brand} • {selectedAndroidDevice.modelCode}
                          </span>
                          <span>⚡ <strong>Chipset:</strong> {selectedAndroidDevice.cpu}</span>
                          <span>🎮 <strong>GPU:</strong> {selectedAndroidDevice.gpuRenderer}</span>
                          <span>📐 <strong>Display:</strong> {selectedAndroidDevice.screenWidth}x{selectedAndroidDevice.screenHeight} (@{selectedAndroidDevice.dpr}x DPR)</span>
                          <span>🧠 <strong>RAM:</strong> {selectedAndroidDevice.memory} GB</span>
                          <span>🤖 <strong>Android {selectedAndroidDevice.androidVersion}</strong></span>
                        </div>
                      )}
                    </div>
                  ) : !deviceTemplateId ? (
                    <div style={{ maxWidth: '280px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                        Processor generation
                      </label>
                      <select
                        value={processorGen}
                        onChange={e => {
                          const newProc = e.target.value
                          setProcessorGen(newProc)
                          let newGpuRenderer = newProc
                          let cores = 8
                          let mem = 16
                          if (osType === 'macos-arm') {
                            if (newProc.includes('M4 Pro')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)'
                              cores = 14
                              mem = 24
                            } else if (newProc.includes('M4')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)'
                              cores = 10
                              mem = 16
                            } else if (newProc.includes('M3 Max')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified Version)'
                              cores = 16
                              mem = 36
                            } else if (newProc.includes('M3 Pro')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)'
                              cores = 12
                              mem = 18
                            } else if (newProc.includes('M3')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)'
                              cores = 8
                              mem = 16
                            } else if (newProc.includes('M2 Max')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)'
                              cores = 12
                              mem = 32
                            } else if (newProc.includes('M2')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'
                              cores = 8
                              mem = 16
                            } else if (newProc.includes('M1 Pro')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)'
                              cores = 10
                              mem = 16
                            } else if (newProc.includes('M1')) {
                              newGpuRenderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'
                              cores = 8
                              mem = 16
                            }
                          }
                          handleFpChange(prev => ({
                            ...prev,
                            navigator: {
                              ...prev?.navigator,
                              hardwareConcurrency: cores,
                              deviceMemory: mem
                            },
                            webgl: {
                              ...prev?.webgl,
                              gpuVendor: osType === 'macos-arm' ? 'Apple' : prev?.webgl?.gpuVendor,
                              gpuRenderer: newGpuRenderer,
                              unmaskedVendor: osType === 'macos-arm' ? 'Google Inc. (Apple)' : prev?.webgl?.unmaskedVendor,
                              unmaskedRenderer: newGpuRenderer
                            }
                          }))
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          color: '#FFF',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      >
                        {(PROCESSOR_OPTIONS[osType] || ['Default Processor']).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {/* New Fingerprint Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleGenerateNew(osType)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        backgroundColor: fpToast ? '#10B98130' : '#2DD4BF15',
                        color: fpToast ? '#10B981' : '#2DD4BF',
                        border: fpToast ? '1px solid #10B981' : '1px solid #2DD4BF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {fpToast ? '✓ New Fingerprint Generated!' : '🎲 New Fingerprint'}
                    </button>
                  </div>

                  {/* Group & Tags & Notes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Group</label>
                      <select
                        value={groupId}
                        onChange={e => setGroupId(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                      >
                        <option value="">No Group</option>
                        {(groups || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={tagsStr}
                        onChange={e => setTagsStr(e.target.value)}
                        placeholder="e.g. qa, work, facebook"
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Start Page / Launch URL</label>
                    <input
                      type="text"
                      value={startUrl}
                      onChange={e => setStartUrl(e.target.value)}
                      placeholder="e.g. https://whoer.net or https://google.com"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Notes for this profile..."
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* ── TAB: PROXY ── */}
              {activeTab === 'proxy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Segmented Proxy Buttons */}
                  <div style={{
                    display: 'inline-flex',
                    backgroundColor: '#14141F',
                    borderRadius: '8px',
                    padding: '4px',
                    width: 'fit-content',
                    border: '1px solid #2C2C3E'
                  }}>
                    <button
                      type="button"
                      onClick={() => setProxyTab('saved')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: proxyTab === 'saved' ? '#1C1C28' : 'transparent',
                        color: proxyTab === 'saved' ? '#2DD4BF' : '#94A3B8',
                        fontWeight: proxyTab === 'saved' ? 600 : 400,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Your proxy
                    </button>
                    <button
                      type="button"
                      onClick={() => setProxyTab('custom')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: proxyTab === 'custom' ? '#1C1C28' : 'transparent',
                        color: proxyTab === 'custom' ? '#2DD4BF' : '#94A3B8',
                        fontWeight: proxyTab === 'custom' ? 600 : 400,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Custom proxy
                    </button>
                    <button
                      type="button"
                      onClick={() => setProxyTab('none')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: proxyTab === 'none' ? '#1C1C28' : 'transparent',
                        color: proxyTab === 'none' ? '#2DD4BF' : '#94A3B8',
                        fontWeight: proxyTab === 'none' ? 600 : 400,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Without proxy
                    </button>
                  </div>

                  {proxyTab === 'saved' && (
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#F1F5F9' }}>Choose saved proxy</h4>
                      <select
                        value={selectedProxyId}
                        onChange={e => setSelectedProxyId(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                      >
                        <option value="">Select saved proxy</option>
                        {(proxies || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.type}://{p.host}:{p.port})</option>
                        ))}
                      </select>

                      {selectedProxyId && (
                        <div style={{ marginTop: '10px' }}>
                          <ProxyInfoCard
                            info={proxyTestState && !proxyTestState.testing ? proxyTestState : null}
                            loading={proxyTestState?.testing || false}
                            testButtonLabel="Check Proxy"
                            showTestButton={true}
                            onTest={async () => {
                              if (!selectedProxyId) return
                              setProxyTestState({ testing: true, success: false, latency: 0 })
                              try {
                                const res = await window.api.testProxy(selectedProxyId)
                                if (res?.success && res?.data?.success) {
                                  setProxyTestState({
                                    testing: false,
                                    ...res.data
                                  })
                                } else {
                                  const errMsg = res?.error || res?.data?.error || 'Proxy connection failed'
                                  setProxyTestState({
                                    testing: false,
                                    success: false,
                                    latency: 0,
                                    error: errMsg
                                  })
                                }
                              } catch (err: any) {
                                setProxyTestState({
                                  testing: false,
                                  success: false,
                                  latency: 0,
                                  error: err?.message || 'Proxy test failed'
                                })
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {proxyTab === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#F1F5F9' }}>Add or edit proxy</h4>

                      {/* Quick Proxy Paste Bar */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                          Paste Proxy String (Quick fill)
                        </label>
                        <input
                          type="text"
                          value={proxyPasteInput}
                          onChange={e => {
                            const val = e.target.value
                            setProxyPasteInput(val)
                            const parsed = parseProxyString(val)
                            if (parsed) {
                              setCustomProxyType(parsed.type)
                              setCustomProxyHost(parsed.host)
                              setCustomProxyPort(parsed.port)
                              setCustomProxyUser(parsed.username)
                              setCustomProxyPass(parsed.password)
                            }
                          }}
                          placeholder="e.g. socks5://nwkfcetx:pass@31.59.20.176:6754 or 31.59.20.176:6754:nwkfcetx:pass"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        />
                      </div>

                      {/* Type, IP Host, Port */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <select
                          value={customProxyType}
                          onChange={e => setCustomProxyType(e.target.value)}
                          style={{ width: '150px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        >
                          <option value="http">HTTP</option>
                          <option value="https" disabled={isFreePlan}>HTTPS {isFreePlan ? '🔒 ($19/mo)' : ''}</option>
                          <option value="socks4" disabled={isFreePlan}>SOCKS4 {isFreePlan ? '🔒 ($19/mo)' : ''}</option>
                          <option value="socks5" disabled={isFreePlan}>SOCKS5 {isFreePlan ? '🔒 ($19/mo)' : ''}</option>
                        </select>
                        <input
                          type="text"
                          value={customProxyHost}
                          onChange={e => setCustomProxyHost(e.target.value)}
                          placeholder="IP Address (e.g. 31.59.20.176)"
                          style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          value={customProxyPort}
                          onChange={e => setCustomProxyPort(e.target.value)}
                          placeholder="Port (6754)"
                          style={{ width: '110px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        />
                      </div>

                      {/* Login Username */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Login</label>
                        <input
                          type="text"
                          value={customProxyUser}
                          onChange={e => setCustomProxyUser(e.target.value)}
                          placeholder="Proxy Username (optional)"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Password</label>
                        <input
                          type="password"
                          value={customProxyPass}
                          onChange={e => setCustomProxyPass(e.target.value)}
                          placeholder="Proxy Password (optional)"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        />
                      </div>

                      {/* Change IP URL */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Change IP URL</label>
                        <input
                          type="url"
                          value={changeIpUrl}
                          onChange={e => setChangeIpUrl(e.target.value)}
                          placeholder="Change IP URL for mobile proxy (e.g. https://ipchange.net/rotate)"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        />
                      </div>

                      {isFreePlan && (
                        <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span>🔒 <strong>Free Plan:</strong> Basic HTTP proxy support included. HTTPS & SOCKS proxies require Starter ($19/mo) or higher.</span>
                          {onUpgrade && (
                            <button type="button" onClick={onUpgrade} style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#F59E0B', color: '#000', border: 'none', fontWeight: 700, fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>
                              ⚡ Upgrade Plan
                            </button>
                          )}
                        </div>
                      )}

                      {/* Proxy Connection Check & Result Info Card */}
                      <ProxyInfoCard
                        info={proxyTestState && !proxyTestState.testing ? proxyTestState : null}
                        loading={proxyTestState?.testing || false}
                        testButtonLabel="Check Proxy"
                        showTestButton={true}
                        onTest={async () => {
                          if (!customProxyHost) return
                          setProxyTestState({ testing: true, success: false, latency: 0 })
                          try {
                            let res: any = null
                            if ((window as any).api?.testCustomProxy) {
                              res = await (window as any).api.testCustomProxy({
                                type: customProxyType,
                                host: customProxyHost,
                                port: Number(customProxyPort) || 80,
                                username: customProxyUser,
                                password: customProxyPass,
                                name: customProxyHost
                              })
                            }
                            if (res?.success && res?.data?.success) {
                              setProxyTestState({
                                testing: false,
                                ...res.data
                              })
                            } else {
                              const errMsg = res?.error || res?.data?.error || 'Proxy connection failed'
                              setProxyTestState({
                                testing: false,
                                success: false,
                                latency: 0,
                                proxyType: customProxyType?.toUpperCase(),
                                error: errMsg
                              })
                            }
                          } catch (err: any) {
                            setProxyTestState({
                              testing: false,
                              success: false,
                              latency: 0,
                              proxyType: customProxyType?.toUpperCase(),
                              error: err?.message || 'Proxy test request failed'
                            })
                          }
                        }}
                      />

                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: TIMEZONE ── */}
              {activeTab === 'timezone' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoTimezone}
                        onChange={e => setAutoTimezone(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: autoTimezone ? '#2DD4BF' : '#2C2C3E',
                        borderRadius: '24px',
                        transition: '0.2s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: '18px',
                          width: '18px',
                          left: autoTimezone ? '26px' : '3px',
                          bottom: '3px',
                          backgroundColor: '#FFF',
                          borderRadius: '50%',
                          transition: '0.2s'
                        }} />
                      </span>
                    </label>
                    <span style={{ fontSize: '14px', color: '#F1F5F9' }}>Fill timezone based on the external IP ⚠️</span>
                  </div>

                  {!autoTimezone && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        value={timezoneSearch}
                        onChange={e => setTimezoneSearch(e.target.value)}
                        placeholder="Search timezone..."
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                      />
                      <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {filteredTimezones.map(t => {
                          const isSelected = selectedTimezone === t.tz
                          return (
                            <div
                              key={t.tz}
                              onClick={() => setSelectedTimezone(t.tz)}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '6px',
                                backgroundColor: isSelected ? '#2DD4BF20' : '#14141F',
                                border: isSelected ? '1px solid #2DD4BF50' : '1px solid transparent',
                                color: isSelected ? '#2DD4BF' : '#CBD5E1',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              {t.tz} ({t.offset})
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: LANGUAGE ── */}
              {activeTab === 'language' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* 1. Language Section */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '28px' }}>
                    <div style={{ width: '130px', paddingTop: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500, color: '#F1F5F9' }}>
                        Language
                      </label>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Segmented control: Based on IP vs Custom */}
                      <div style={{
                        display: 'inline-flex',
                        backgroundColor: '#14141F',
                        borderRadius: '8px',
                        padding: '3px',
                        border: '1px solid #2C2C3E',
                        width: 'fit-content'
                      }}>
                        <button
                          type="button"
                          onClick={() => setLanguageMode('based_on_ip')}
                          style={{
                            padding: '6px 20px',
                            borderRadius: '6px',
                            border: languageMode === 'based_on_ip' ? '1px solid #2DD4BF' : '1px solid transparent',
                            backgroundColor: languageMode === 'based_on_ip' ? '#1C1C28' : 'transparent',
                            color: languageMode === 'based_on_ip' ? '#2DD4BF' : '#94A3B8',
                            fontWeight: languageMode === 'based_on_ip' ? 600 : 400,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Based on IP
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguageMode('custom')}
                          style={{
                            padding: '6px 20px',
                            borderRadius: '6px',
                            border: languageMode === 'custom' ? '1px solid #2DD4BF' : '1px solid transparent',
                            backgroundColor: languageMode === 'custom' ? '#1C1C28' : 'transparent',
                            color: languageMode === 'custom' ? '#2DD4BF' : '#94A3B8',
                            fontWeight: languageMode === 'custom' ? 600 : 400,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Custom
                        </button>
                      </div>

                      {/* When Based on IP is active */}
                      {languageMode === 'based_on_ip' ? (
                        <div style={{
                          padding: '16px 20px',
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          borderRadius: '10px',
                          color: '#94A3B8',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}>
                          <span style={{ fontSize: '18px' }}>🌐</span>
                          <span>Languages and <code>Accept-Language</code> headers will be automatically configured based on your Proxy / External IP geographical location.</span>
                        </div>
                      ) : (
                        /* When Custom is active: Card with list of languages & + Add Language */
                        <div style={{
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          {selectedLanguages.map((langCode, idx) => {
                            const langName = getLanguageLabel(langCode)
                            const isPrimary = idx === 0
                            const isMenuOpen = openLangMenuIdx === idx

                            return (
                              <div
                                key={`${langCode}-${idx}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderBottom: idx === selectedLanguages.length - 1 ? 'none' : '1px solid #222233',
                                  position: 'relative'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '14px', color: '#F1F5F9', fontWeight: 500 }}>
                                    {langName}
                                  </span>
                                  {isPrimary && (
                                    <span style={{ fontSize: '11px', background: 'rgba(45,212,191,0.15)', color: '#2DD4BF', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                      Primary
                                    </span>
                                  )}
                                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                                    ({langCode})
                                  </span>
                                </div>

                                {/* 3-dots Menu Button */}
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenLangMenuIdx(isMenuOpen ? null : idx)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#94A3B8',
                                      fontSize: '18px',
                                      cursor: 'pointer',
                                      padding: '4px 8px',
                                      borderRadius: '4px'
                                    }}
                                    title="Language options"
                                  >
                                    ⋮
                                  </button>

                                  {/* Dropdown Action Menu */}
                                  {isMenuOpen && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        backgroundColor: '#1E1E2D',
                                        border: '1px solid #2C2C3E',
                                        borderRadius: '8px',
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                                        zIndex: 50,
                                        width: '160px',
                                        padding: '4px 0'
                                      }}
                                    >
                                      {idx > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleMoveLanguage(idx, 'up')
                                            setOpenLangMenuIdx(null)
                                          }}
                                          style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 14px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#CBD5E1',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ⬆ Move Up
                                        </button>
                                      )}
                                      {idx < selectedLanguages.length - 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleMoveLanguage(idx, 'down')
                                            setOpenLangMenuIdx(null)
                                          }}
                                          style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 14px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#CBD5E1',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ⬇ Move Down
                                        </button>
                                      )}
                                      {!isPrimary && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleSetPrimaryLanguage(idx)
                                            setOpenLangMenuIdx(null)
                                          }}
                                          style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 14px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#2DD4BF',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ⭐ Set as Primary
                                        </button>
                                      )}
                                      {selectedLanguages.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleRemoveLanguage(idx)
                                            setOpenLangMenuIdx(null)
                                          }}
                                          style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 14px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#EF4444',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            borderTop: '1px solid #2C2C3E'
                                          }}
                                        >
                                          🗑 Remove
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}

                          {/* Add Language Button */}
                          <div style={{ paddingTop: '8px', borderTop: selectedLanguages.length > 0 ? '1px solid #222233' : 'none' }}>
                            <button
                              type="button"
                              onClick={() => setShowAddLanguageModal(true)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'none',
                                border: 'none',
                                color: '#38BDF8',
                                fontSize: '13px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                padding: '6px 8px',
                                borderRadius: '6px'
                              }}
                            >
                              <span style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: '1.5px solid #38BDF8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                lineHeight: 1
                              }}>+</span>
                              Add Language
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Display Language Section */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '28px' }}>
                    <div style={{ width: '130px', paddingTop: '6px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500, color: '#F1F5F9' }}>
                        Display language
                      </label>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Segmented control: Based on Language vs Real vs Custom */}
                      <div style={{
                        display: 'inline-flex',
                        backgroundColor: '#14141F',
                        borderRadius: '8px',
                        padding: '3px',
                        border: '1px solid #2C2C3E',
                        width: 'fit-content'
                      }}>
                        {[
                          { id: 'based_on_language', label: 'Based on Language' },
                          { id: 'real', label: 'Real' },
                          { id: 'custom', label: 'Custom' }
                        ].map(m => {
                          const active = displayLanguageMode === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setDisplayLanguageMode(m.id as any)}
                              style={{
                                padding: '6px 20px',
                                borderRadius: '6px',
                                border: active ? '1px solid #2DD4BF' : '1px solid transparent',
                                backgroundColor: active ? '#1C1C28' : 'transparent',
                                color: active ? '#2DD4BF' : '#94A3B8',
                                fontWeight: active ? 600 : 400,
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {m.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Display language helper or custom selector */}
                      {displayLanguageMode === 'based_on_language' && (
                        <div style={{ fontSize: '13px', color: '#64748B' }}>
                          Browser interface UI language will match the primary selected language ({selectedLanguages[0] || 'en-US'}).
                        </div>
                      )}

                      {displayLanguageMode === 'real' && (
                        <div style={{ fontSize: '13px', color: '#64748B' }}>
                          Browser interface UI language will use your host system's native display language.
                        </div>
                      )}

                      {displayLanguageMode === 'custom' && (
                        <div style={{ maxWidth: '340px' }}>
                          <select
                            value={customDisplayLanguage}
                            onChange={e => setCustomDisplayLanguage(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#14141F',
                              border: '1px solid #2C2C3E',
                              color: '#FFF',
                              fontSize: '13px'
                            }}
                          >
                            {WORLD_LANGUAGES.map(l => (
                              <option key={l.code} value={l.code}>
                                {l.name} ({l.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ── TAB: WEBRTC ── */}
              {activeTab === 'webrtc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                      WebRTC
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        display: 'inline-flex',
                        backgroundColor: '#14141F',
                        borderRadius: '8px',
                        padding: '3px',
                        border: '1px solid #2C2C3E'
                      }}>
                        <button
                          type="button"
                          onClick={() => setWebrtcSetting('based_on_ip')}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '6px',
                            border: webrtcSetting === 'based_on_ip' ? '1px solid #2DD4BF' : '1px solid transparent',
                            backgroundColor: webrtcSetting === 'based_on_ip' ? '#1C1C28' : 'transparent',
                            color: webrtcSetting === 'based_on_ip' ? '#2DD4BF' : '#94A3B8',
                            fontWeight: webrtcSetting === 'based_on_ip' ? 600 : 400,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Based on IP
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebrtcSetting('off')}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '6px',
                            border: webrtcSetting === 'off' ? '1px solid #2DD4BF' : '1px solid transparent',
                            backgroundColor: webrtcSetting === 'off' ? '#1C1C28' : 'transparent',
                            color: webrtcSetting === 'off' ? '#2DD4BF' : '#94A3B8',
                            fontWeight: webrtcSetting === 'off' ? 600 : 400,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Off
                        </button>
                      </div>

                      {/* Info Icon with Tooltip */}
                      <div
                        title={
                          webrtcSetting === 'based_on_ip'
                            ? 'Based on IP: Restricts WebRTC media streams to your active public/proxy IP interface, masking local private network IP addresses.'
                            : 'Off: Completely disables WebRTC media connections (--disable-webrtc) to prevent any WebRTC network traffic.'
                        }
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: '1px solid #475569',
                          color: '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontStyle: 'italic',
                          fontFamily: 'serif',
                          cursor: 'help',
                          userSelect: 'none'
                        }}
                      >
                        ⓘ
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: GEOLOCATION ── */}
              {activeTab === 'geolocation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    display: 'inline-flex',
                    backgroundColor: '#14141F',
                    borderRadius: '8px',
                    padding: '4px',
                    width: 'fit-content',
                    border: '1px solid #2C2C3E'
                  }}>
                    {(['prompt', 'allow', 'block'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setGeoMode(m)
                          if (m !== 'allow') setAutoGeo(false)
                        }}
                        style={{
                          padding: '8px 24px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: geoMode === m ? '#1C1C28' : 'transparent',
                          color: geoMode === m ? '#2DD4BF' : '#94A3B8',
                          fontWeight: geoMode === m ? 600 : 400,
                          fontSize: '13px',
                          textTransform: 'capitalize',
                          cursor: 'pointer'
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoGeo}
                        onChange={e => setAutoGeo(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: autoGeo ? '#2DD4BF' : '#2C2C3E',
                        borderRadius: '24px',
                        transition: '0.2s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: '18px',
                          width: '18px',
                          left: autoGeo ? '26px' : '3px',
                          bottom: '3px',
                          backgroundColor: '#FFF',
                          borderRadius: '50%',
                          transition: '0.2s'
                        }} />
                      </span>
                    </label>
                    <span style={{ fontSize: '14px', color: '#F1F5F9' }}>Fill geolocation based on the external IP</span>
                  </div>

                  {!autoGeo && geoMode === 'allow' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={latitude}
                          onChange={e => setLatitude(Number(e.target.value))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={longitude}
                          onChange={e => setLongitude(Number(e.target.value))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Accuracy (m)</label>
                        <input
                          type="number"
                          value={accuracy}
                          onChange={e => setAccuracy(Number(e.target.value))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: EXTENSIONS ── */}
              {activeTab === 'extensions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#F1F5F9' }}>Chrome Extensions</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                      Add Chrome Web Store extensions by pasting the URL or ID below
                    </p>
                  </div>

                  {/* Add Input Bar */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={newExtInput}
                      onChange={e => setNewExtInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newExtInput.trim()) {
                            const parsed = parseChromeExtensionInput(newExtInput)
                            if (parsed.id && !extensions.some(x => x.id === parsed.id)) {
                              setExtensions(prev => [...prev, parsed])
                            }
                            setNewExtInput('')
                          }
                        }
                      }}
                      placeholder="Paste Chrome Web Store URL or Extension ID (e.g. cjpalhdlnbpafiamejdnhcphjbkeiagm)..."
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newExtInput.trim()) {
                          const parsed = parseChromeExtensionInput(newExtInput)
                          if (parsed.id && !extensions.some(x => x.id === parsed.id)) {
                            setExtensions(prev => [...prev, parsed])
                          }
                          setNewExtInput('')
                        }
                      }}
                      style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Add Extension
                    </button>
                  </div>

                  {/* Added Extensions List */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Active Profile Extensions ({extensions.length})
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '60px' }}>
                      {extensions.length === 0 ? (
                        <div style={{ padding: '14px', borderRadius: '8px', border: '1px dashed #2C2C3E', backgroundColor: '#14141F', color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
                          No extensions added yet. Choose from popular extensions below or paste a URL above.
                        </div>
                      ) : (
                        extensions.map((ext, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '16px' }}>🧩</span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>{ext.name}</div>
                                <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>ID: {ext.id}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExtensions(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px' }}
                              title="Remove Extension"
                            >
                              🗑
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 1-Click Popular Extensions */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ⚡ Popular Extensions (1-Click Add)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {POPULAR_EXTENSIONS.map(pop => {
                        const isAdded = extensions.some(x => x.id === pop.id)
                        return (
                          <div
                            key={pop.id}
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: isAdded ? '#1C1C28' : '#14141F',
                              border: isAdded ? '1px solid #2DD4BF' : '1px solid #2C2C3E',
                              display: 'flex',
                              alignItems: 'center',
                              justify: 'space-between',
                              gap: '10px'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {pop.icon} {pop.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {pop.desc}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (isAdded) {
                                  setExtensions(prev => prev.filter(x => x.id !== pop.id))
                                } else {
                                  setExtensions(prev => [...prev, { id: pop.id, name: pop.name }])
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: isAdded ? '#EF444420' : '#2DD4BF20',
                                color: isAdded ? '#EF4444' : '#2DD4BF',
                                border: isAdded ? '1px solid #EF444440' : '1px solid #2DD4BF40',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isAdded ? 'Remove' : '+ Add'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* ── TAB: BOOKMARKS ── */}
              {activeTab === 'bookmarks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#F1F5F9' }}>Bookmarks Manager</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                      Add custom bookmarks or web pages to launch inside your browser profile
                    </p>
                  </div>

                  {/* Add Bookmark Bar */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={bmTitle}
                      onChange={e => setBmTitle(e.target.value)}
                      placeholder="Bookmark Title (optional)..."
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      value={bmUrl}
                      onChange={e => setBmUrl(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const raw = bmUrl.trim()
                          if (raw) {
                            let formattedUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
                            let title = bmTitle.trim()
                            if (!title) {
                              try {
                                title = new URL(formattedUrl).hostname.replace(/^www\./, '')
                              } catch {
                                title = formattedUrl
                              }
                            }
                            setBookmarks(prev => [...prev, { title, url: formattedUrl }])
                            setBmTitle('')
                            setBmUrl('')
                          }
                        }
                      }}
                      placeholder="URL (e.g. https://affscash.net or google.com)..."
                      style={{ flex: 1.5, padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const raw = bmUrl.trim()
                        if (raw) {
                          let formattedUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
                          let title = bmTitle.trim()
                          if (!title) {
                            try {
                              title = new URL(formattedUrl).hostname.replace(/^www\./, '')
                            } catch {
                              title = formattedUrl
                            }
                          }
                          setBookmarks(prev => [...prev, { title, url: formattedUrl }])
                          setBmTitle('')
                          setBmUrl('')
                        }
                      }}
                      style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Add Bookmark
                    </button>
                  </div>

                  {/* Active Bookmarks List */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Profile Bookmarks ({bookmarks.length})
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '60px' }}>
                      {bookmarks.length === 0 ? (
                        <div style={{ padding: '14px', borderRadius: '8px', border: '1px dashed #2C2C3E', backgroundColor: '#14141F', color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
                          No bookmarks added yet. Type a URL above or add from popular bookmarks below.
                        </div>
                      ) : (
                        bookmarks.map((bm, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '16px' }}>⭐</span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>{bm.title}</div>
                                <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{bm.url}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBookmarks(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px' }}
                              title="Delete Bookmark"
                            >
                              🗑
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Quick-Add Popular Bookmarks */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ⚡ Quick-Add Popular Bookmarks
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      {POPULAR_BOOKMARKS.map(pop => {
                        const isAdded = bookmarks.some(b => b.url === pop.url)
                        return (
                          <button
                            key={pop.url}
                            type="button"
                            onClick={() => {
                              if (isAdded) {
                                setBookmarks(prev => prev.filter(b => b.url !== pop.url))
                              } else {
                                setBookmarks(prev => [...prev, { title: pop.title, url: pop.url }])
                              }
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              backgroundColor: isAdded ? '#1C1C28' : '#14141F',
                              border: isAdded ? '1px solid #2DD4BF' : '1px solid #2C2C3E',
                              color: isAdded ? '#2DD4BF' : '#F1F5F9',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px'
                            }}
                          >
                            <span>{pop.icon} {pop.title}</span>
                            <span>{isAdded ? '✓' : '+'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* ── TAB: ADVANCED ── */}
              {activeTab === 'advanced' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  {isFreePlan && (
                    <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#C7D2FE', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#FFF', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🔒</span>
                          <span>Standard Fingerprint Controls (Free Plan)</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                          Standard noise & basic fingerprint spoofing are active. Advanced controls (custom WebGL vendor/renderer, audio buffer noise, custom CPU/RAM) require Starter ($19/mo) or Professional ($49/mo).
                        </div>
                      </div>
                      {onUpgrade && (
                        <button type="button" onClick={onUpgrade} style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: '#818CF8', color: '#FFF', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                          ⚡ Upgrade Plan
                        </button>
                      )}
                    </div>
                  )}

                  {/* Navigator Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: '#818CF8', borderBottom: '1px solid #2C2C3E', paddingBottom: '6px' }}>Navigator</h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                          Custom User-Agent String
                        </label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={handlePasteUAClick}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#14141F',
                              color: '#CBD5E1',
                              border: '1px solid #2C2C3E',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Paste User-Agent from clipboard"
                          >
                            📋 Paste UA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUserAgentChange('')}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#14141F',
                              color: '#EF4444',
                              border: '1px solid #2C2C3E',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Clear User-Agent input completely"
                          >
                            🗑️ Clear UA
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const generated = generateRandomUAForOS(osType, browserType)
                              handleUserAgentChange(generated.ua)
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#2DD4BF20',
                              color: '#2DD4BF',
                              border: '1px solid #2DD4BF40',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            🎲 Generate New UA
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const defaultUA = generateUAForOS(osType, browserVersion, browserType)
                              handleUserAgentChange(defaultUA)
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#14141F',
                              color: '#94A3B8',
                              border: '1px solid #2C2C3E',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                            title="Reset User-Agent to default for current OS and browser engine"
                          >
                            ↺ Reset Default
                          </button>
                          <button
                            type="button"
                            onClick={copyUAToClipboard}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#14141F',
                              border: '1px solid #2C2C3E',
                              color: copiedUA ? '#10B981' : '#94A3B8',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Copy User-Agent"
                          >
                            {copiedUA ? '✓ Copied' : '📋 Copy'}
                          </button>
                        </div>
                      </div>

                      {/* Presets dropdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          defaultValue=""
                          onChange={e => {
                            const found = POPULAR_UA_PRESETS.find(p => p.label === e.target.value)
                            if (found) {
                              handleSelectUAPreset(found)
                            }
                            e.target.value = ''
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#14141F',
                            border: '1px solid #2C2C3E',
                            color: '#94A3B8',
                            fontSize: '12px',
                            outline: 'none'
                          }}
                        >
                          <option value="" disabled>⚡ Choose a popular User-Agent preset or type/paste your own below...</option>
                          {POPULAR_UA_PRESETS.map((p, i) => (
                            <option key={i} value={p.label}>{p.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Multi-line Editable User-Agent Textarea */}
                      <textarea
                        rows={3}
                        value={safeFp.navigator.userAgent}
                        onChange={e => handleUserAgentChange(e.target.value)}
                        placeholder="Paste or enter custom User-Agent string here..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#14141F',
                          border: '1px solid #2C2C3E',
                          color: '#FFF',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          lineHeight: 1.45,
                          outline: 'none',
                          resize: 'vertical'
                        }}
                      />

                      {/* Live Detection Info Badge */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        fontSize: '11px',
                        color: '#94A3B8'
                      }}>
                        <span style={{ backgroundColor: 'rgba(45,212,191,0.1)', color: '#2DD4BF', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Platform: {safeFp.navigator.platform || 'Auto'}
                        </span>
                        <span style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', padding: '2px 8px', borderRadius: '4px' }}>
                          {browserType === 'firefox' ? 'Firefox' : 'Chromium'}: {browserVersion || safeFp.navigator.browserVersion || (browserType === 'firefox' ? '129.0' : '128.0.0.0')}
                        </span>
                        <span style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', padding: '2px 8px', borderRadius: '4px' }}>
                          {safeFp.navigator.userAgent?.includes('Mobile') ? '📱 Mobile Browser' : '🖥️ Desktop Browser'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                          {browserType === 'firefox' ? 'Firefox Version' : 'Chromium Version'}
                        </label>
                        <select
                          value={browserVersion}
                          onChange={e => handleBrowserVersionChange(e.target.value)}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        >
                          {availableBrowserVersions.map(v => (
                            <option key={v.version} value={v.version}>{v.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Screen Resolution</label>
                        <select
                          value={`${safeFp.screen.width}x${safeFp.screen.height}`}
                          onChange={e => {
                            const [w, h] = e.target.value.split('x').map(Number)
                            handleFpChange(prev => ({ ...prev, screen: { ...prev.screen, width: w, height: h } }))
                          }}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        >
                          <option value="1920x1080">1920x1080 (Full HD)</option>
                          <option value="2560x1440">2560x1440 (QHD)</option>
                          <option value="3840x2160">3840x2160 (4K UHD)</option>
                          <option value="1440x900">1440x900 (WXGA+)</option>
                          <option value="1366x768">1366x768 (WXGA)</option>
                          <option value="1280x800">1280x800</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Platform</label>
                        <input
                          type="text"
                          value={safeFp.navigator.platform}
                          onChange={e => handleFpChange(prev => ({ ...prev, navigator: { ...prev.navigator, platform: e.target.value } }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>CPU Threads</label>
                        <select
                          value={safeFp.navigator.hardwareConcurrency}
                          onChange={e => handleFpChange(prev => ({ ...prev, navigator: { ...prev.navigator, hardwareConcurrency: Number(e.target.value) } }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        >
                          {[2, 4, 6, 8, 10, 12, 16, 24, 32].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>RAM (GB)</label>
                        <select
                          value={safeFp.navigator.deviceMemory}
                          onChange={e => handleFpChange(prev => ({ ...prev, navigator: { ...prev.navigator, deviceMemory: Number(e.target.value) } }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        >
                          {[2, 4, 8, 16, 32, 64].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Mask Media Devices Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: '#818CF8', borderBottom: '1px solid #2C2C3E', paddingBottom: '6px' }}>Mask Media Devices</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Video Inputs</label>
                        <input
                          type="number"
                          value={safeFp.mediaDevices.videoInputs}
                          onChange={e => handleFpChange(prev => ({ ...prev, mediaDevices: { ...prev.mediaDevices, videoInputs: Number(e.target.value) } }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Audio Inputs</label>
                        <input
                          type="number"
                          value={safeFp.mediaDevices.audioInputs}
                          onChange={e => handleFpChange(prev => ({ ...prev, mediaDevices: { ...prev.mediaDevices, audioInputs: Number(e.target.value) } }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Audio Outputs</label>
                        <input
                          type="number"
                          value={safeFp.mediaDevices.audioOutputs}
                          onChange={e => handleFpChange(prev => ({ ...prev, mediaDevices: { ...prev.mediaDevices, audioOutputs: Number(e.target.value) } }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Hardware ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#CBD5E1', borderBottom: '1px solid #2C2C3E', paddingBottom: '8px' }}>
                      Hardware
                    </h4>

                    {/* Canvas */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Canvas</label>
                        <span style={{ color: '#64748B', fontSize: '13px', cursor: 'help' }} title="Adds deterministic noise to HTML5 Canvas rendering to prevent fingerprinting">ⓘ</span>
                      </div>
                      <div style={{ display: 'inline-flex', backgroundColor: '#14141F', borderRadius: '6px', padding: '3px', border: '1px solid #2C2C3E' }}>
                        {['noise', 'off', 'block'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleFpChange(prev => ({ ...prev, canvas: { ...prev.canvas, mode: m } }))}
                            style={{
                              padding: '6px 22px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: safeFp.canvas.mode === m ? '#1C1C28' : 'transparent',
                              color: safeFp.canvas.mode === m ? '#2DD4BF' : '#94A3B8',
                              fontWeight: safeFp.canvas.mode === m ? 600 : 400,
                              fontSize: '13px',
                              textTransform: 'capitalize',
                              cursor: 'pointer'
                            }}
                          >
                            {m === 'noise' ? 'Noise' : m === 'off' ? 'Off' : 'Block'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Client Rects */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Client Rects</label>
                        <span style={{ color: '#64748B', fontSize: '13px', cursor: 'help' }} title="Masks DOM element bounding client rect measurements">ⓘ</span>
                      </div>
                      <div style={{ display: 'inline-flex', backgroundColor: '#14141F', borderRadius: '6px', padding: '3px', border: '1px solid #2C2C3E' }}>
                        {['noise', 'off'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleFpChange(prev => ({ ...prev, clientRects: { ...prev.clientRects, mode: m } }))}
                            style={{
                              padding: '6px 22px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: safeFp.clientRects.mode === m ? '#1C1C28' : 'transparent',
                              color: safeFp.clientRects.mode === m ? '#2DD4BF' : '#94A3B8',
                              fontWeight: safeFp.clientRects.mode === m ? 600 : 400,
                              fontSize: '13px',
                              textTransform: 'capitalize',
                              cursor: 'pointer'
                            }}
                          >
                            {m === 'noise' ? 'Noise' : 'Off'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audio Context */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Audio Context</label>
                        <span style={{ color: '#64748B', fontSize: '13px', cursor: 'help' }} title="Protects Web Audio API fingerprinting with micro-noise">ⓘ</span>
                      </div>
                      <div style={{ display: 'inline-flex', backgroundColor: '#14141F', borderRadius: '6px', padding: '3px', border: '1px solid #2C2C3E' }}>
                        {['noise', 'off'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleFpChange(prev => ({ ...prev, audio: { ...prev.audio, mode: m } }))}
                            style={{
                              padding: '6px 22px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: safeFp.audio.mode === m ? '#1C1C28' : 'transparent',
                              color: safeFp.audio.mode === m ? '#2DD4BF' : '#94A3B8',
                              fontWeight: safeFp.audio.mode === m ? 600 : 400,
                              fontSize: '13px',
                              textTransform: 'capitalize',
                              cursor: 'pointer'
                            }}
                          >
                            {m === 'noise' ? 'Noise' : 'Off'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WebGL Image */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>WebGL Image</label>
                        <span style={{ color: '#64748B', fontSize: '13px', cursor: 'help' }} title="Applies noise hash protection to WebGL rendered image pixels">ⓘ</span>
                      </div>
                      <div style={{ display: 'inline-flex', backgroundColor: '#14141F', borderRadius: '6px', padding: '3px', border: '1px solid #2C2C3E' }}>
                        {['noise', 'off'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleFpChange(prev => ({ ...prev, webgl: { ...prev.webgl, imageMode: m } }))}
                            style={{
                              padding: '6px 22px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: (safeFp.webgl.imageMode || 'off') === m ? '#1C1C28' : 'transparent',
                              color: (safeFp.webgl.imageMode || 'off') === m ? '#2DD4BF' : '#94A3B8',
                              fontWeight: (safeFp.webgl.imageMode || 'off') === m ? 600 : 400,
                              fontSize: '13px',
                              textTransform: 'capitalize',
                              cursor: 'pointer'
                            }}
                          >
                            {m === 'noise' ? 'Noise' : 'Off'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WebGL Metadata */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>WebGL Metadata</label>
                        <span style={{ color: '#64748B', fontSize: '13px', cursor: 'help' }} title="Masks UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL strings">ⓘ</span>
                      </div>
                      <div style={{ display: 'inline-flex', backgroundColor: '#14141F', borderRadius: '6px', padding: '3px', border: '1px solid #2C2C3E' }}>
                        {['mask', 'real'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleFpChange(prev => ({ ...prev, webgl: { ...prev.webgl, metadataMode: m } }))}
                            style={{
                              padding: '6px 22px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: (safeFp.webgl.metadataMode || 'mask') === m ? '#1C1C28' : 'transparent',
                              color: (safeFp.webgl.metadataMode || 'mask') === m ? '#2DD4BF' : '#94A3B8',
                              fontWeight: (safeFp.webgl.metadataMode || 'mask') === m ? 600 : 400,
                              fontSize: '13px',
                              textTransform: 'capitalize',
                              cursor: 'pointer'
                            }}
                          >
                            {m === 'mask' ? 'Mask' : 'Real'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WebGL Vendor */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>WebGL Vendor</label>
                      <select
                        value={safeFp.webgl.unmaskedVendor}
                        onChange={e => handleFpChange(prev => ({ ...prev, webgl: { ...prev.webgl, unmaskedVendor: e.target.value } }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                      >
                        <option value="Google Inc. (Apple)">Google Inc. (Apple)</option>
                        <option value="Google Inc. (NVIDIA)">Google Inc. (NVIDIA)</option>
                        <option value="Google Inc. (AMD)">Google Inc. (AMD)</option>
                        <option value="Google Inc. (Intel)">Google Inc. (Intel)</option>
                        <option value="Google Inc. (Qualcomm)">Google Inc. (Qualcomm)</option>
                      </select>
                    </div>

                    {/* WebGL Renderer */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>WebGL Renderer</label>
                      <select
                        value={safeFp.webgl.unmaskedRenderer}
                        onChange={e => handleFpChange(prev => ({ ...prev, webgl: { ...prev.webgl, unmaskedRenderer: e.target.value } }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                      >
                        <option value="ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)">ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)</option>
                        <option value="ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified Version)">ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified Version)</option>
                        <option value="ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)">ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)</option>
                        <option value="ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)">ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)</option>
                        <option value="ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)">ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)</option>
                        <option value="ANGLE (Intel, Intel(R) Iris(TM) Xe Graphics Direct3D11 vs_5_0 ps_5_0)">ANGLE (Intel, Intel(R) Iris(TM) Xe Graphics Direct3D11 vs_5_0 ps_5_0)</option>
                        <option value="ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)">ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)</option>
                        <option value="ANGLE (Qualcomm, Adreno (TM) 740 OpenGL ES 3.2)">ANGLE (Qualcomm, Adreno (TM) 740 OpenGL ES 3.2)</option>
                      </select>
                    </div>

                  </div>

                  {/* ── Section: Storage Options ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#CBD5E1', borderBottom: '1px solid #2C2C3E', paddingBottom: '8px' }}>
                      Storage Options
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
                        <span style={{ fontSize: '13px', color: '#F1F5F9' }}>Local Storage & Cookies</span>
                        <span style={{ color: '#2DD4BF', fontSize: '12px', fontWeight: 600 }}>Enabled</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
                        <span style={{ fontSize: '13px', color: '#F1F5F9' }}>Extension Storage</span>
                        <span style={{ color: '#2DD4BF', fontSize: '12px', fontWeight: 600 }}>Enabled</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: COOKIES ── */}
              {activeTab === 'cookies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#F1F5F9' }}>Profile Cookies</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                        Import cookies to automatically authenticate and preserve active login sessions in this profile.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowCookieModal(true)}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          color: '#2DD4BF',
                          border: '1px solid #2DD4BF',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Import Cookies
                      </button>

                      {cookies.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleExportCookies}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '6px',
                              backgroundColor: '#14141F',
                              color: '#94A3B8',
                              border: '1px solid #2C2C3E',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                            title="Export cookies as JSON"
                          >
                            Export JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to remove all cookies from this profile?')) {
                                setCookies([])
                              }
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#EF4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                            title="Clear all cookies"
                          >
                            Clear All
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cookie Search & Count Bar */}
                  {cookies.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="text"
                          value={cookieSearch}
                          onChange={e => setCookieSearch(e.target.value)}
                          placeholder="Search cookies by domain or name (e.g. google, session_id)..."
                          style={{
                            width: '100%',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            backgroundColor: '#14141F',
                            border: '1px solid #2C2C3E',
                            color: '#FFF',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                        {cookieSearch && (
                          <button
                            type="button"
                            onClick={() => setCookieSearch('')}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: '#94A3B8',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{
                        padding: '8px 14px',
                        backgroundColor: '#14141F',
                        border: '1px solid #2C2C3E',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#2DD4BF',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}>
                        🍪 {cookies.length} {cookies.length === 1 ? 'Cookie' : 'Cookies'} Loaded
                      </div>
                    </div>
                  )}

                  {/* Cookies Table or Empty State */}
                  {cookies.length === 0 ? (
                    <div style={{
                      padding: '48px 24px',
                      borderRadius: '10px',
                      border: '1px dashed #2C2C3E',
                      backgroundColor: '#14141F',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: '14px'
                    }}>
                      <div style={{ fontSize: '36px' }}>🍪</div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#F1F5F9', marginBottom: '4px' }}>
                          No Cookies Added
                        </div>
                        <div style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '420px', lineHeight: 1.5 }}>
                          Import cookies exported from browser extensions (EditThisCookie, Cookie-Editor) or Netscape format to start your profile pre-logged in.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCookieModal(true)}
                        style={{
                          marginTop: '6px',
                          padding: '10px 24px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          color: '#2DD4BF',
                          border: '1px solid #2DD4BF',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Import Cookies
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: '#14141F',
                      border: '1px solid #2C2C3E',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      maxHeight: '380px',
                      overflowY: 'auto'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#181824', color: '#94A3B8', borderBottom: '1px solid #2C2C3E' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 600 }}>Domain</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600 }}>Name</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600 }}>Value</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600 }}>Security</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600 }}>Expires</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cookies
                            .filter(c => {
                              if (!cookieSearch.trim()) return true
                              const q = cookieSearch.toLowerCase()
                              return c.domain.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
                            })
                            .map((c, idx) => {
                              const expDate = c.expires || c.expirationDate
                              let expFormatted = 'Session'
                              if (expDate && expDate > 0) {
                                try {
                                  expFormatted = new Date(expDate * 1000).toLocaleDateString()
                                } catch {
                                  expFormatted = 'Custom'
                                }
                              }

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #1E1E2D' }}>
                                  <td style={{ padding: '10px 14px', color: '#2DD4BF', fontFamily: 'monospace', fontWeight: 600 }}>
                                    {c.domain}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#F1F5F9', fontWeight: 600 }}>
                                    {c.name}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#94A3B8', fontFamily: 'monospace', maxWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                        {c.value ? `${c.value.substring(0, 14)}••••` : '<empty>'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCookieVal(c.value, idx)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: copiedCookieIdx === idx ? '#10B981' : '#64748B',
                                          cursor: 'pointer',
                                          fontSize: '11px',
                                          padding: '2px 4px'
                                        }}
                                        title="Copy Value"
                                      >
                                        {copiedCookieIdx === idx ? '✓' : '📋'}
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {c.secure && (
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981', fontWeight: 600 }}>
                                          Secure
                                        </span>
                                      )}
                                      {c.httpOnly && (
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818CF8', fontWeight: 600 }}>
                                          HttpOnly
                                        </span>
                                      )}
                                      {c.sameSite && (
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                                          {c.sameSite}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#94A3B8' }}>
                                    {expFormatted}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => setCookies(prev => prev.filter((_, i) => i !== idx))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        padding: '4px'
                                      }}
                                      title="Delete cookie"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Import Cookies Modal Overlay ── */}
                  {showCookieModal && (
                    <div style={{
                      position: 'fixed',
                      inset: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      backdropFilter: 'blur(5px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10000
                    }}>
                      <div style={{
                        backgroundColor: '#1C1C28',
                        border: '1px solid #2C2C3E',
                        borderRadius: '12px',
                        width: '640px',
                        maxHeight: '90vh',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '17px', color: '#F1F5F9' }}>
                            📥 Import Cookies
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCookieModal(false)
                              setCookieImportMsg(null)
                            }}
                            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>

                        <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
                          Paste cookies in <strong>JSON</strong> format (Cookie-Editor, EditThisCookie) or <strong>Netscape</strong> HTTP cookie file format, or upload a cookie file.
                        </p>

                        {/* File Upload Zone */}
                        <div style={{
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px dashed #2C2C3E',
                          backgroundColor: '#14141F',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>📁</span>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>Upload Cookie File</div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>Supports .json, .txt, .csv</div>
                            </div>
                          </div>
                          <label style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#2C2C3E',
                            color: '#F1F5F9',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}>
                            Choose File
                            <input
                              type="file"
                              accept=".json,.txt,.csv"
                              onChange={handleCookieFileUpload}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>

                        {/* Paste Textarea */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>
                            Or Paste Raw Cookies Content
                          </label>
                          <textarea
                            value={cookiePasteText}
                            onChange={e => {
                              setCookiePasteText(e.target.value)
                              setCookieImportMsg(null)
                            }}
                            rows={8}
                            placeholder={'[\n  {\n    "name": "session_id",\n    "value": "xyz123...",\n    "domain": ".example.com",\n    "path": "/",\n    "secure": true\n  }\n]'}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: '#14141F',
                              border: '1px solid #2C2C3E',
                              color: '#FFF',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              outline: 'none',
                              resize: 'vertical',
                              lineHeight: 1.4
                            }}
                          />
                        </div>

                        {/* Import Mode Options */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px', color: '#94A3B8' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="cookieImportMode"
                              checked={cookieImportMode === 'replace'}
                              onChange={() => setCookieImportMode('replace')}
                            />
                            Replace existing cookies
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="cookieImportMode"
                              checked={cookieImportMode === 'append'}
                              onChange={() => setCookieImportMode('append')}
                            />
                            Append to existing cookies
                          </label>
                        </div>

                        {/* Feedback message */}
                        {cookieImportMsg && (
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: '6px',
                            backgroundColor: cookieImportMsg.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: cookieImportMsg.type === 'success' ? '#10B981' : '#EF4444',
                            fontSize: '12px',
                            fontWeight: 500
                          }}>
                            {cookieImportMsg.text}
                          </div>
                        )}

                        {/* Modal Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCookieModal(false)
                              setCookieImportMsg(null)
                            }}
                            style={{
                              padding: '9px 18px',
                              borderRadius: '6px',
                              backgroundColor: '#2C2C3E',
                              color: '#CBD5E1',
                              border: 'none',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleImportCookieText(cookiePasteText, cookieImportMode)}
                            disabled={!cookiePasteText.trim()}
                            style={{
                              padding: '9px 24px',
                              borderRadius: '6px',
                              backgroundColor: cookiePasteText.trim() ? '#2DD4BF' : '#2DD4BF40',
                              color: '#0F0F17',
                              fontWeight: 600,
                              border: 'none',
                              fontSize: '13px',
                              cursor: cookiePasteText.trim() ? 'pointer' : 'not-allowed'
                            }}
                          >
                            Import Cookies
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #2C2C3E',
              display: 'flex',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#2C2C3E',
                  color: '#CBD5E1',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '10px 28px',
                  borderRadius: '6px',
                  backgroundColor: isSaving ? '#4338CA' : '#6366F1',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSaving ? 'wait' : 'pointer'
                }}
              >
                {isSaving ? '💾 Saving...' : initialProfile ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div >

          {/* ── Right Panel: Profile Summary (matching GoLogin screenshot) ── */}
          <div style={{
            width: '270px',
            backgroundColor: '#161622',
            borderLeft: fpToast ? '2px solid #2DD4BF' : '1px solid #2C2C3E',
            transition: 'border-left 0.2s ease',
            padding: '20px 18px',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: '1.7',
            color: '#CBD5E1'
          }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '13px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Profile Summary
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong style={{ color: '#94A3B8' }}>Profile Name:</strong> {name || getNextProfileName(existingProfiles)}</div>
              <div><strong style={{ color: '#94A3B8' }}>Proxy:</strong> {activeProxyName}</div>
              <div><strong style={{ color: '#94A3B8' }}>Browser:</strong> <span style={{ color: browserType === 'firefox' ? '#F97316' : '#2DD4BF', fontWeight: 600 }}>{browserType === 'firefox' ? 'Firefox Quantum' : 'Google Chrome'}</span> ({safeFp.navigator.browserVersion || browserVersion})</div>
              <div><strong style={{ color: '#94A3B8' }}>OS:</strong> {osType.startsWith('macos') ? 'mac' : osType.startsWith('win') ? 'win' : osType}</div>
              {osType === 'android' && (
                <div><strong style={{ color: '#94A3B8' }}>Device:</strong> <span style={{ color: '#2DD4BF', fontWeight: 600 }}>{safeFp.navigator.deviceModel || safeFp.navigator.deviceBrand || selectedAndroidDevice?.modelName || 'Samsung Galaxy S24 Ultra'}</span></div>
              )}
              <div><strong style={{ color: '#94A3B8' }}>Cookies:</strong> <span style={{ color: cookies.length > 0 ? '#2DD4BF' : '#94A3B8', fontWeight: 600 }}>{cookies.length} {cookies.length === 1 ? 'cookie' : 'cookies'}</span></div>
              <div><strong style={{ color: '#94A3B8' }}>User-Agent:</strong> {safeFp.navigator.userAgent ? `${safeFp.navigator.userAgent.substring(0, 22)}...` : 'Mozilla/...'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Resolution:</strong> {safeFp.screen.width}x{safeFp.screen.height} (@{safeFp.screen.devicePixelRatio || 1}x)</div>
              <div><strong style={{ color: '#94A3B8' }}>Languages:</strong> {languageMode === 'based_on_ip' ? 'based on ip' : selectedLanguages.join(', ')}</div>
              <div><strong style={{ color: '#94A3B8' }}>Display Lang:</strong> {displayLanguageMode === 'real' ? 'real (system)' : displayLanguageMode === 'custom' ? customDisplayLanguage : 'based on language'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Platform:</strong> {safeFp.navigator.platform}</div>
              <div><strong style={{ color: '#94A3B8' }}>Hardware:</strong> {safeFp.navigator.hardwareConcurrency} Cores / {safeFp.navigator.deviceMemory} GB RAM</div>
              <div><strong style={{ color: '#94A3B8' }}>GPU:</strong> {safeFp.webgl.unmaskedRenderer ? `${safeFp.webgl.unmaskedRenderer.substring(0, 22)}...` : 'GPU'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Timezone:</strong> {autoTimezone ? 'based on ip' : selectedTimezone}</div>
              <div><strong style={{ color: '#94A3B8' }}>Geolocation:</strong> {autoGeo ? 'based on ip' : geoMode}</div>
              <div><strong style={{ color: '#94A3B8' }}>WebRTC:</strong> {webrtcSetting === 'off' ? 'off' : 'based on ip'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Canvas:</strong> {safeFp.canvas.mode}</div>
              <div><strong style={{ color: '#94A3B8' }}>Client Rects:</strong> {safeFp.clientRects.mode}</div>
              <div><strong style={{ color: '#94A3B8' }}>WebGL Metadata:</strong> mask</div>
              <div><strong style={{ color: '#94A3B8' }}>WebGL Image:</strong> off</div>
              <div><strong style={{ color: '#94A3B8' }}>Audio Context:</strong> {safeFp.audio.mode}</div>
              <div><strong style={{ color: '#94A3B8' }}>Touch Support:</strong> {safeFp.navigator.maxTouchPoints > 0 ? `Yes (${safeFp.navigator.maxTouchPoints} points)` : 'None'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Fonts:</strong> {safeFp.fonts.fontList?.length || 221}</div>
              <div><strong style={{ color: '#94A3B8' }}>Media devices:</strong> ({safeFp.mediaDevices.videoInputs}|{safeFp.mediaDevices.audioInputs}|{safeFp.mediaDevices.audioOutputs})</div>
              <div><strong style={{ color: '#94A3B8' }}>Local Storage:</strong> true</div>
              <div><strong style={{ color: '#94A3B8' }}>Ext. Storage:</strong> true</div>
              <div><strong style={{ color: '#94A3B8' }}>Plugins:</strong> true</div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modal / Dialog: Add Language Picker ── */}
      {showAddLanguageModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000
        }}>
          <div style={{
            width: '440px',
            backgroundColor: '#181824',
            border: '1px solid #2C2C3E',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#FFF', fontWeight: 600 }}>Select Language</h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddLanguageModal(false)
                  setLanguageSearch('')
                }}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={languageSearch}
              onChange={e => setLanguageSearch(e.target.value)}
              placeholder="Search language (e.g. English, French, Spanish, en-GB)..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#14141F',
                border: '1px solid #2C2C3E',
                color: '#FFF',
                fontSize: '13px',
                outline: 'none'
              }}
            />

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {WORLD_LANGUAGES
                .filter(l => {
                  const q = languageSearch.toLowerCase().trim()
                  if (!q) return true
                  return l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q) || (l.native && l.native.toLowerCase().includes(q))
                })
                .map(l => {
                  const isAlreadyAdded = selectedLanguages.includes(l.code)
                  return (
                    <div
                      key={l.code}
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          handleAddLanguage(l.code)
                          setShowAddLanguageModal(false)
                          setLanguageSearch('')
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: isAlreadyAdded ? '#14141F' : 'transparent',
                        color: isAlreadyAdded ? '#64748B' : '#E2E8F0',
                        cursor: isAlreadyAdded ? 'default' : 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      <span>{l.name}</span>
                      <span style={{ fontSize: '12px', color: isAlreadyAdded ? '#64748B' : '#2DD4BF', fontWeight: 500 }}>
                        {isAlreadyAdded ? '✓ Added' : l.code}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
