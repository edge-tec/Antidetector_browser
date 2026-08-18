import React, { useState, useEffect, useMemo } from 'react'
import {
  ANDROID_DEVICES,
  ANDROID_BRANDS,
  getDevicesByBrand,
  getDeviceById,
  generateAndroidUserAgent,
  AndroidDeviceSpec
} from '../data/android-devices'
import { parseCookies, CookieItem } from '../utils/cookie-parser'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (profileData: any) => Promise<void>
  initialProfile?: any
  proxies: any[]
  groups: any[]
}

type TabType =
  | 'overview'
  | 'proxy'
  | 'timezone'
  | 'webrtc'
  | 'extensions'
  | 'bookmarks'
  | 'geolocation'
  | 'advanced'
  | 'cookies'

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
  { label: '🖥️ Windows 11 — Chrome 128 (x64)', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'windows-11', platform: 'Win32' },
  { label: '🖥️ Windows 10 — Chrome 128 (x64)', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'windows-10', platform: 'Win32' },
  { label: '🍏 macOS Sonoma — Chrome 128 (Apple Silicon)', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'macos-arm', platform: 'MacIntel' },
  { label: '🍏 macOS Sonoma — Chrome 128 (Intel)', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'macos-intel', platform: 'MacIntel' },
  { label: '🐧 Linux Ubuntu — Chrome 128 (x86_64)', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', os: 'linux', platform: 'Linux x86_64' },
  { label: '📱 Android 14 — Samsung Galaxy S24 Ultra', ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36', os: 'android', platform: 'Linux armv8l' },
  { label: '📱 Android 14 — Google Pixel 8 Pro', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36', os: 'android', platform: 'Linux armv8l' },
  { label: '📱 iOS 17.5 — iPhone 15 Pro (Safari)', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', os: 'macos-arm', platform: 'iPhone' },
  { label: '🖥️ Windows 11 — Microsoft Edge 128', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0', os: 'windows-11', platform: 'Win32' },
  { label: '🦊 Windows 11 — Mozilla Firefox 129', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0', os: 'windows-11', platform: 'Win32' }
]

function generateUAForOS(osType: string, version = '124.0.6367.207'): string {
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
  if (osType === 'android') {
    return `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`
  }
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
}

function generateRandomUAForOS(osType: string): { ua: string; version: string; chromium: string } {
  const randomVer = CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)]
  const majorVer = randomVer.split('.')[0]

  if (osType === 'windows-10' || osType === 'windows-11') {
    return {
      ua: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVer} Safari/537.36`,
      version: randomVer,
      chromium: majorVer
    }
  }
  if (osType === 'macos-intel') {
    const osVers = ['10_15_7', '13_6_7', '14_4_1', '14_5']
    const randomOS = osVers[Math.floor(Math.random() * osVers.length)]
    return {
      ua: `Mozilla/5.0 (Macintosh; Intel Mac OS X ${randomOS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVer} Safari/537.36`,
      version: randomVer,
      chromium: majorVer
    }
  }
  if (osType === 'macos-arm') {
    const osVers = ['14_4_1', '14_5', '14_3_1', '13_6_7']
    const randomOS = osVers[Math.floor(Math.random() * osVers.length)]
    return {
      ua: `Mozilla/5.0 (Macintosh; Intel Mac OS X ${randomOS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVer} Safari/537.36`,
      version: randomVer,
      chromium: majorVer
    }
  }
  if (osType === 'linux') {
    return {
      ua: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVer} Safari/537.36`,
      version: randomVer,
      chromium: majorVer
    }
  }
  if (osType === 'android') {
    const devices = [
      'Linux; Android 14; Pixel 8',
      'Linux; Android 14; SM-S928B',
      'Linux; Android 13; SM-S918B',
      'Linux; Android 13; Pixel 7',
      'Linux; Android 14; Pixel 8 Pro'
    ]
    const dev = devices[Math.floor(Math.random() * devices.length)]
    return {
      ua: `Mozilla/5.0 (${dev}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVer} Mobile Safari/537.36`,
      version: randomVer,
      chromium: majorVer
    }
  }
  return {
    ua: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVer} Safari/537.36`,
    version: randomVer,
    chromium: majorVer
  }
}

function ensureFpStructure(rawFp: any, targetOs = 'macos-intel'): any {
  const fp = rawFp && typeof rawFp === 'object' ? rawFp : {}

  if (targetOs === 'android') {
    const isAlreadyAndroid = fp.navigator?.userAgent?.includes('Android')
    const existingModelCode = fp.navigator?.deviceModelCode || fp.navigator?.deviceModel || ''
    const matchedDev = (existingModelCode ? getDeviceById(existingModelCode) : null) || ANDROID_DEVICES[0]

    return {
      version: fp.version || 2,
      seed: fp.seed || 'default-seed',
      navigator: {
        userAgent: isAlreadyAndroid && fp.navigator?.userAgent ? fp.navigator.userAgent : generateAndroidUserAgent(matchedDev),
        browserVersion: fp.navigator?.browserVersion || '128.0.0.0',
        chromiumVersion: fp.navigator?.chromiumVersion || '128.0.0.0',
        platform: 'Linux armv8l',
        vendor: 'Google Inc.',
        deviceBrand: fp.navigator?.deviceBrand || matchedDev.brand,
        deviceModel: fp.navigator?.deviceModel || matchedDev.modelName,
        deviceModelCode: fp.navigator?.deviceModelCode || matchedDev.modelCode,
        hardwareConcurrency: fp.navigator?.hardwareConcurrency || matchedDev.cores,
        deviceMemory: fp.navigator?.deviceMemory || matchedDev.memory,
        maxTouchPoints: fp.navigator?.maxTouchPoints || 5,
        touchSupport: true,
        doNotTrack: fp.navigator?.doNotTrack || null
      },
      screen: {
        width: fp.screen?.width || matchedDev.screenWidth,
        height: fp.screen?.height || matchedDev.screenHeight,
        devicePixelRatio: fp.screen?.devicePixelRatio || matchedDev.dpr,
        viewportWidth: fp.screen?.viewportWidth || matchedDev.screenWidth,
        viewportHeight: fp.screen?.viewportHeight || Math.floor(matchedDev.screenHeight * 0.9),
        colorDepth: 24,
        pixelDepth: 24,
        orientation: 'portrait-primary',
        orientationAngle: 0
      },
      locale: {
        language: fp.locale?.language || 'en-US',
        languages: fp.locale?.languages || ['en-US', 'en']
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
        mode: fp.webrtc?.mode || 'real',
        ipPolicy: fp.webrtc?.ipPolicy || 'default_public_interface_only'
      },
      canvas: {
        mode: fp.canvas?.mode || 'off',
        noiseSeed: fp.canvas?.noiseSeed || 12345
      },
      webgl: {
        enabled: fp.webgl?.enabled !== false,
        gpuVendor: fp.webgl?.gpuVendor || matchedDev.gpuVendor,
        gpuRenderer: fp.webgl?.gpuRenderer || matchedDev.gpuRenderer,
        unmaskedVendor: fp.webgl?.unmaskedVendor || matchedDev.gpuVendor,
        unmaskedRenderer: fp.webgl?.unmaskedRenderer || matchedDev.gpuRenderer,
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
        fontList: fp.fonts?.fontList || ['Roboto', 'Noto Sans', 'Droid Sans']
      },
      mediaDevices: {
        videoInputs: fp.mediaDevices?.videoInputs ?? 2,
        audioInputs: fp.mediaDevices?.audioInputs ?? 1,
        audioOutputs: fp.mediaDevices?.audioOutputs ?? 1
      },
      battery: {
        enabled: fp.battery?.enabled || true,
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

  return {
    version: fp.version || 2,
    seed: fp.seed || 'default-seed',
    navigator: {
      userAgent: fp.navigator?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      browserVersion: fp.navigator?.browserVersion || '124.0.0.0',
      chromiumVersion: fp.navigator?.chromiumVersion || '124.0.0.0',
      platform: fp.navigator?.platform || (targetOs.startsWith('win') ? 'Win32' : 'MacIntel'),
      vendor: fp.navigator?.vendor || 'Google Inc.',
      hardwareConcurrency: fp.navigator?.hardwareConcurrency || 8,
      deviceMemory: fp.navigator?.deviceMemory || 8,
      maxTouchPoints: fp.navigator?.maxTouchPoints || 0,
      doNotTrack: fp.navigator?.doNotTrack || null
    },
    screen: {
      width: fp.screen?.width || 1920,
      height: fp.screen?.height || 1080,
      devicePixelRatio: fp.screen?.devicePixelRatio || 1,
      viewportWidth: fp.screen?.viewportWidth || fp.screen?.width || 1920,
      viewportHeight: fp.screen?.viewportHeight || fp.screen?.height || 1080,
      colorDepth: fp.screen?.colorDepth || 24,
      pixelDepth: fp.screen?.pixelDepth || 24
    },
    locale: {
      language: fp.locale?.language || 'en-US',
      languages: fp.locale?.languages || ['en-US', 'en']
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
      mode: fp.webrtc?.mode || 'real',
      ipPolicy: fp.webrtc?.ipPolicy || 'default_public_interface_only'
    },
    canvas: {
      mode: fp.canvas?.mode || 'off',
      noiseSeed: fp.canvas?.noiseSeed || 12345
    },
    webgl: {
      enabled: fp.webgl?.enabled !== false,
      gpuVendor: fp.webgl?.gpuVendor || 'Apple',
      gpuRenderer: fp.webgl?.gpuRenderer || 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)',
      unmaskedVendor: fp.webgl?.unmaskedVendor || 'Google Inc. (Apple)',
      unmaskedRenderer: fp.webgl?.unmaskedRenderer || 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)',
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
      fontList: fp.fonts?.fontList || []
    },
    mediaDevices: {
      videoInputs: fp.mediaDevices?.videoInputs ?? 1,
      audioInputs: fp.mediaDevices?.audioInputs ?? 1,
      audioOutputs: fp.mediaDevices?.audioOutputs ?? 1
    },
    battery: {
      enabled: fp.battery?.enabled || false
    },
    networkInfo: {
      effectiveType: fp.networkInfo?.effectiveType || '4g',
      downlink: fp.networkInfo?.downlink || 10,
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
  'android': ['Snapdragon 8 Gen 3 (Adreno 750)', 'Snapdragon 8 Gen 2 (Adreno 740)', 'Google Tensor G3 (Mali-G715)', 'Exynos 2400 (Xclipse 940)']
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
  groups
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [name, setName] = useState('profile 1')
  const [folder, setFolder] = useState('')
  const [osType, setOsType] = useState('macos-arm')
  const [processorGen, setProcessorGen] = useState('M4')
  const [androidBrand, setAndroidBrand] = useState('Samsung')
  const [androidModelId, setAndroidModelId] = useState('samsung-s24-ultra')
  const [groupId, setGroupId] = useState('')
  const [notes, setNotes] = useState('')
  const [startUrl, setStartUrl] = useState('')
  const [tagsStr, setTagsStr] = useState('')

  const selectedAndroidDevice = useMemo(() => {
    return getDeviceById(androidModelId) || ANDROID_DEVICES[0]
  }, [androidModelId])

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
  const [proxyTestState, setProxyTestState] = useState<{
    testing: boolean
    success?: boolean
    latency?: number
    ip?: string
    countryName?: string
    flag?: string
    error?: string
  } | null>(null)

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

  const applyAndroidDeviceToFp = (dev: AndroidDeviceSpec) => {
    const newUa = generateAndroidUserAgent(dev)
    handleFpChange(prev => ({
      ...prev,
      navigator: {
        ...prev.navigator,
        userAgent: newUa,
        appVersion: `5.0 (Linux; Android ${dev.androidVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36`,
        platform: 'Linux armv8l',
        deviceBrand: dev.brand,
        deviceModel: dev.modelName,
        deviceModelCode: dev.modelCode,
        hardwareConcurrency: dev.cores,
        deviceMemory: dev.memory,
        maxTouchPoints: 5,
        touchSupport: true
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
    }))
  }

  const handleAndroidBrandChange = (newBrand: string) => {
    setAndroidBrand(newBrand)
    const brandDevices = getDevicesByBrand(newBrand)
    if (brandDevices.length > 0) {
      const firstDev = brandDevices[0]
      setAndroidModelId(firstDev.id)
      applyAndroidDeviceToFp(firstDev)
    }
  }

  const handleAndroidModelChange = (newModelId: string) => {
    setAndroidModelId(newModelId)
    const dev = getDeviceById(newModelId)
    if (dev) {
      applyAndroidDeviceToFp(dev)
    }
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
      if (initialProfile) {
        setName(initialProfile.name || 'profile 1')
        setFolder(initialProfile.folder || '')
        const targetOs = initialProfile.osType || 'macos-intel'
        setOsType(targetOs)
        setGroupId(initialProfile.groupId || '')
        setNotes(initialProfile.notes || '')
        setTagsStr((initialProfile.tags || []).join(', '))

        if (targetOs === 'android') {
          const rawCode = initialProfile.fingerprint?.navigator?.deviceModelCode || initialProfile.fingerprint?.navigator?.deviceModel || ''
          const matched = (rawCode ? getDeviceById(rawCode) : null) || ANDROID_DEVICES[0]
          setAndroidBrand(matched.brand)
          setAndroidModelId(matched.id)
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
          const loadedFp = ensureFpStructure(initialProfile.fingerprint, targetOs)
          setFp(loadedFp)
          setSelectedTimezone(loadedFp.timezone?.timezone || 'America/New_York')
          setAutoTimezone(loadedFp.timezone?.mode === 'auto')
          setGeoMode(loadedFp.geolocation?.mode === 'custom' ? 'allow' : loadedFp.geolocation?.mode === 'block' ? 'block' : 'prompt')
          const fpWrtc = loadedFp.webrtc?.mode || initialProfile.webrtcMode
          setWebrtcSetting(fpWrtc === 'disabled' || fpWrtc === 'off' ? 'off' : 'based_on_ip')
        } else {
          const rawFp = initialProfile.fingerprint || null
          setFp(ensureFpStructure(rawFp, targetOs))
          const fpWrtc = initialProfile.webrtcMode
          setWebrtcSetting(fpWrtc === 'disabled' || fpWrtc === 'off' ? 'off' : 'based_on_ip')
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
        setName('profile 1')
        setFolder('')
        setOsType('macos-arm')
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
  }, [isOpen, initialProfile])

  const handleGenerateNew = async (targetOs: string) => {
    if (targetOs === 'android') {
      const brandDevices = getDevicesByBrand(androidBrand)
      const dev = (brandDevices.length > 1 ? brandDevices[Math.floor(Math.random() * brandDevices.length)] : null) || ANDROID_DEVICES[Math.floor(Math.random() * ANDROID_DEVICES.length)]
      if (dev) {
        setAndroidBrand(dev.brand)
        setAndroidModelId(dev.id)
        applyAndroidDeviceToFp(dev)
        setFpToast(true)
        setTimeout(() => setFpToast(false), 2200)
        return
      }
    }
    try {
      const randomSeed = Math.random().toString(36).substring(2) + Date.now().toString(36)
      if ((window as any).api?.generateFingerprint) {
        const res = await (window as any).api.generateFingerprint({ osType: targetOs, seed: randomSeed })
        if (res?.success && res?.data) {
          setFp(ensureFpStructure(res.data, targetOs))
          setFpToast(true)
          setTimeout(() => setFpToast(false), 2200)
          return
        }
      }
    } catch (err) {
      console.error('Failed to generate fingerprint:', err)
    }
    // Fallback if API fails
    setFp(ensureFpStructure(null, targetOs))
    setFpToast(true)
    setTimeout(() => setFpToast(false), 2200)
  }

  const handleOsChange = (newOs: string) => {
    setOsType(newOs)
    if (newOs === 'android') {
      const dev = getDeviceById(androidModelId) || ANDROID_DEVICES[0]
      setAndroidBrand(dev.brand)
      setAndroidModelId(dev.id)
      applyAndroidDeviceToFp(dev)
      setFpToast(true)
      setTimeout(() => setFpToast(false), 2200)
    } else {
      const options = PROCESSOR_OPTIONS[newOs] || ['Default Processor']
      setProcessorGen(options[0])
      handleGenerateNew(newOs)
    }
  }

  const handleFpChange = (updater: (prev: any) => any) => {
    setFp((prev: any) => ensureFpStructure(updater(prev), osType))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!name.trim() || isSaving) return
    setIsSaving(true)

    try {
      const finalFp = ensureFpStructure(fp, osType)

      // Update timezone, geolocation & WebRTC in fingerprint object
      finalFp.timezone.mode = autoTimezone ? 'auto' : 'manual'
      finalFp.timezone.timezone = selectedTimezone
      finalFp.geolocation.mode = autoGeo ? 'ip-based' : (geoMode === 'allow' ? 'custom' : geoMode)
      finalFp.geolocation.latitude = latitude
      finalFp.geolocation.longitude = longitude
      finalFp.geolocation.accuracy = accuracy
      finalFp.webrtc.mode = webrtcSetting === 'off' ? 'disabled' : 'real'
      finalFp.webrtc.ipPolicy = webrtcSetting === 'off' ? 'disable_non_proxied_udp' : 'default_public_interface_only'

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
      finalFp.browser.extensions = extensions
      finalFp.browser.bookmarks = bookmarks
      finalFp.browser.cookies = cookies
      finalFp.browser.startUrl = startUrl

      const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean)

      await onSave({
        name,
        folder,
        osType,
        groupId: groupId || null,
        proxyId: finalProxyId,
        webrtcMode: webrtcSetting === 'off' ? 'disabled' : 'default',
        notes,
        startUrl,
        tags,
        fingerprint: finalFp,
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
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F1F5F9' }}>
            {initialProfile ? `Edit Profile — ${name}` : 'New Browser Profile'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '22px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

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

                  {/* Dynamic Processor or Android Phone Brand/Model Selection */}
                  {osType === 'android' ? (
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
                  ) : (
                    <div style={{ maxWidth: '280px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 500 }}>
                        Processor generation
                      </label>
                      <select
                        value={processorGen}
                        onChange={e => {
                          setProcessorGen(e.target.value)
                          handleFpChange(prev => ({
                            ...prev,
                            webgl: { ...prev.webgl, gpuRenderer: e.target.value }
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
                  )}

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
                          style={{ width: '130px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks4">SOCKS4</option>
                          <option value="socks5">SOCKS5</option>
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

                      {/* Proxy Connection Check Button & Result Badge */}
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <button
                          type="button"
                          disabled={!customProxyHost || proxyTestState?.testing}
                          onClick={async () => {
                            if (!customProxyHost) return
                            setProxyTestState({ testing: true })
                            try {
                              let res: any = null
                              if ((window as any).api?.testCustomProxy) {
                                res = await (window as any).api.testCustomProxy({
                                  type: customProxyType,
                                  host: customProxyHost,
                                  port: Number(customProxyPort) || 80,
                                  username: customProxyUser,
                                  password: customProxyPass
                                })
                              }
                              if (res?.success && res?.data?.success) {
                                setProxyTestState({
                                  testing: false,
                                  success: true,
                                  latency: res.data.latency || 120,
                                  ip: res.data.ip || customProxyHost,
                                  countryName: res.data.countryName || res.data.country || 'Location Verified',
                                  flag: res.data.flag || '🌐'
                                })
                              } else {
                                const errMsg = res?.error || res?.data?.error || 'Proxy connection failed'
                                setProxyTestState({
                                  testing: false,
                                  success: false,
                                  error: errMsg
                                })
                              }
                            } catch (err: any) {
                              setProxyTestState({
                                testing: false,
                                success: false,
                                error: err?.message || 'Proxy test request failed'
                              })
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            backgroundColor: proxyTestState?.testing ? '#2C2C3E' : '#2DD4BF15',
                            color: proxyTestState?.testing ? '#94A3B8' : '#2DD4BF',
                            border: proxyTestState?.testing ? '1px solid #2C2C3E' : '1px solid #2DD4BF',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: (!customProxyHost || proxyTestState?.testing) ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          {proxyTestState?.testing ? '🔄 Testing Connection...' : '⚡ Check Proxy Connection'}
                        </button>

                        {/* Test Status Badge */}
                        {proxyTestState && !proxyTestState.testing && (
                          <div style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            backgroundColor: proxyTestState.success ? '#10B98120' : '#EF444420',
                            border: proxyTestState.success ? '1px solid #10B98140' : '1px solid #EF444440',
                            color: proxyTestState.success ? '#10B981' : '#EF4444',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            {proxyTestState.success ? (
                              <>
                                <span>✓ Active ({proxyTestState.latency}ms)</span>
                                <span>—</span>
                                <span>{proxyTestState.flag} {proxyTestState.countryName} ({proxyTestState.ip})</span>
                              </>
                            ) : (
                              <span>❌ Connection Failed: {proxyTestState.error || 'Timed out'}</span>
                            )}
                          </div>
                        )}
                      </div>

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
                            onClick={() => {
                              const generated = generateRandomUAForOS(osType)
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
                              const defaultUA = generateUAForOS(osType)
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
                            title="Reset User-Agent to default for current OS"
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
                          Chromium: {safeFp.navigator.browserVersion || '128.0.0.0'}
                        </span>
                        <span style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', padding: '2px 8px', borderRadius: '4px' }}>
                          {safeFp.navigator.userAgent?.includes('Mobile') ? '📱 Mobile Browser' : '🖥️ Desktop Browser'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Chromium Version</label>
                        <select
                          value={safeFp.navigator.browserVersion || '124.0.0.0'}
                          onChange={e => {
                            const ver = e.target.value
                            const newUA = generateUAForOS(osType, ver)
                            handleFpChange(prev => ({
                              ...prev,
                              navigator: { ...prev.navigator, browserVersion: ver, chromiumVersion: ver.split('.')[0], userAgent: newUA }
                            }))
                          }}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                        >
                          <option value="126.0.0.0">Chrome 126</option>
                          <option value="125.0.0.0">Chrome 125</option>
                          <option value="124.0.0.0">Chrome 124</option>
                          <option value="123.0.0.0">Chrome 123</option>
                          <option value="122.0.0.0">Chrome 122</option>
                          <option value="121.0.0.0">Chrome 121</option>
                          <option value="120.0.0.0">Chrome 120</option>
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
              <div><strong style={{ color: '#94A3B8' }}>Profile Name:</strong> {name || 'profile 1'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Proxy:</strong> {activeProxyName}</div>
              <div><strong style={{ color: '#94A3B8' }}>Browser:</strong> chrome (mobile)</div>
              <div><strong style={{ color: '#94A3B8' }}>OS:</strong> {osType.startsWith('macos') ? 'mac' : osType.startsWith('win') ? 'win' : osType}</div>
              {osType === 'android' && (
                <div><strong style={{ color: '#94A3B8' }}>Device:</strong> <span style={{ color: '#2DD4BF', fontWeight: 600 }}>{safeFp.navigator.deviceModel || safeFp.navigator.deviceBrand || selectedAndroidDevice?.modelName || 'Samsung Galaxy S24 Ultra'}</span></div>
              )}
              <div><strong style={{ color: '#94A3B8' }}>Cookies:</strong> <span style={{ color: cookies.length > 0 ? '#2DD4BF' : '#94A3B8', fontWeight: 600 }}>{cookies.length} {cookies.length === 1 ? 'cookie' : 'cookies'}</span></div>
              <div><strong style={{ color: '#94A3B8' }}>User-Agent:</strong> {safeFp.navigator.userAgent ? `${safeFp.navigator.userAgent.substring(0, 22)}...` : 'Mozilla/...'}</div>
              <div><strong style={{ color: '#94A3B8' }}>Resolution:</strong> {safeFp.screen.width}x{safeFp.screen.height} (@{safeFp.screen.devicePixelRatio || 1}x)</div>
              <div><strong style={{ color: '#94A3B8' }}>Languages:</strong> {safeFp.locale.language}</div>
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
    </div>
  )
}
