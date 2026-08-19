// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Device Template Database
// Structured device-profile database: one device model = one coherent
// set of compatible properties. No independent random generation.
// ──────────────────────────────────────────────────────────────────

import { OSType } from './types'

// ═══════════════════════════════════════════
// Device Template Interface
// ═══════════════════════════════════════════

export interface WebGLProfileTemplate {
  version: string
  vendor: string
  renderer: string
  unmaskedVendor: string
  unmaskedRenderer: string
  maxTextureSize: number
  maxViewportDims: [number, number]
  maxRenderbufferSize: number
  shadingLanguageVersion: string
  antialiasing: boolean
}

export interface MediaDeviceTemplate {
  videoInputs: number
  audioInputs: number
  audioOutputs: number
  cameraLabels: string[]
  microphoneLabels: string[]
  speakerLabels: string[]
}

export interface DeviceTemplate {
  // Identity
  deviceId: string
  manufacturer: string
  model: string
  deviceType: 'desktop' | 'laptop' | 'mobile' | 'tablet'
  category: string

  // Operating System
  operatingSystem: OSType
  osVersion: string
  platform: string
  architecture: string
  platformArchitecture: string

  // Browser Compatibility
  supportedBrowsers: Array<{ browser: 'chrome' | 'firefox'; engine: 'blink' | 'gecko' | 'webkit' }>

  // Display
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
  viewportWidth: number
  viewportHeight: number
  orientation: 'landscape-primary' | 'portrait-primary'
  colorDepth: number
  pixelDepth: number

  // Hardware
  cpuClass: string
  cpuThreads: number
  memoryGB: number

  // GPU / WebGL
  gpuVendor: string
  gpuModel: string
  webglProfile: WebGLProfileTemplate

  // Capabilities
  touchSupport: boolean
  maxTouchPoints: number
  batteryApi: boolean
  pdfViewerEnabled: boolean

  // Network defaults
  networkType: 'wifi' | 'cellular' | 'ethernet'
  networkDownlink: number
  networkRtt: number

  // Defaults
  languageDefaults: string[]
  timezoneDefaults: string[]
  fontFamilies: string[]
  mediaDevices: MediaDeviceTemplate
}

// ═══════════════════════════════════════════
// Helper: OS family detection
// ═══════════════════════════════════════════

function getOSFamily(osType: OSType): string {
  if (osType === 'windows-10' || osType === 'windows-11') return 'windows'
  if (osType === 'macos-arm' || osType === 'macos-intel') return 'macos'
  if (osType === 'linux') return 'linux'
  if (osType === 'ios') return 'ios'
  if (osType === 'android') return 'android'
  return 'windows'
}

// ═══════════════════════════════════════════
// Shared Font/Media Constants
// ═══════════════════════════════════════════

const WIN_FONTS = ['Segoe UI', 'Arial', 'Calibri', 'Tahoma', 'Verdana', 'Times New Roman', 'Consolas', 'Courier New', 'Georgia', 'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Microsoft Sans Serif', 'Palatino Linotype', 'Lucida Console']
const MAC_FONTS = ['.AppleSystemUIFont', 'Helvetica', 'Helvetica Neue', 'SF Pro', 'SF Pro Display', 'SF Pro Text', 'Menlo', 'Monaco', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Trebuchet MS', 'Verdana', 'Lucida Grande']
const LINUX_FONTS = ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans', 'Noto Sans', 'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', 'Times New Roman', 'DejaVu Serif', 'Liberation Serif', 'Droid Sans', 'Cantarell']
const IOS_FONTS = ['.AppleSystemUIFont', 'Helvetica Neue', 'Helvetica', 'SF Pro', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Trebuchet MS', 'Verdana']
const ANDROID_FONTS = ['Roboto', 'Droid Sans', 'Noto Sans', 'Roboto Mono', 'Droid Sans Mono', 'Arial', 'Times New Roman', 'Courier New', 'Georgia']

// ═══════════════════════════════════════════
// Windows Desktop Templates
// ═══════════════════════════════════════════

const WINDOWS_TEMPLATES: DeviceTemplate[] = [
  {
    deviceId: 'win-desktop-i9-rtx4090',
    manufacturer: 'Generic',
    model: 'High-End Gaming Desktop',
    deviceType: 'desktop',
    category: 'High-End Gaming',
    operatingSystem: 'windows-11',
    osVersion: '11',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 2560, screenHeight: 1440, devicePixelRatio: 1, viewportWidth: 2560, viewportHeight: 1369,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i9-13900K', cpuThreads: 24, memoryGB: 64,
    gpuVendor: 'NVIDIA', gpuModel: 'GeForce RTX 4090',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 32768, maxViewportDims: [32767, 32767], maxRenderbufferSize: 32768,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'ethernet', networkDownlink: 100, networkRtt: 10,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 2, cameraLabels: ['Integrated HD Camera'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker', 'NVIDIA HDMI Audio'] }
  },
  {
    deviceId: 'win-desktop-i7-rtx4070',
    manufacturer: 'Generic',
    model: 'Mid-Range Gaming Desktop',
    deviceType: 'desktop',
    category: 'Mid-Range Gaming',
    operatingSystem: 'windows-11',
    osVersion: '11',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1080, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 969,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i7-13700K', cpuThreads: 16, memoryGB: 32,
    gpuVendor: 'NVIDIA', gpuModel: 'GeForce RTX 4070',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384, maxViewportDims: [32767, 32767], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'ethernet', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 2, cameraLabels: ['Integrated Webcam'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker', 'NVIDIA HDMI Audio'] }
  },
  {
    deviceId: 'win-desktop-i5-rx6700',
    manufacturer: 'Generic',
    model: 'Budget Gaming Desktop',
    deviceType: 'desktop',
    category: 'Budget Gaming',
    operatingSystem: 'windows-11',
    osVersion: '11',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1080, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 969,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i5-13600K', cpuThreads: 12, memoryGB: 16,
    gpuVendor: 'AMD', gpuModel: 'Radeon RX 6700 XT',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (AMD)',
      unmaskedRenderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384, maxViewportDims: [32767, 32767], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 50, networkRtt: 20,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['HD WebCam'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker'] }
  },
  {
    deviceId: 'win-desktop-office',
    manufacturer: 'Generic',
    model: 'Office Workstation',
    deviceType: 'desktop',
    category: 'Office',
    operatingSystem: 'windows-10',
    osVersion: '10',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1080, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 969,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i5-10400', cpuThreads: 6, memoryGB: 16,
    gpuVendor: 'Intel', gpuModel: 'UHD Graphics 630',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Intel)',
      unmaskedRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'ethernet', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['Integrated HD Camera'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker'] }
  },
  {
    deviceId: 'win-desktop-ryzen9-rtx4080',
    manufacturer: 'Generic',
    model: 'Developer Workstation',
    deviceType: 'desktop',
    category: 'Developer',
    operatingSystem: 'windows-11',
    osVersion: '11',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 2560, screenHeight: 1440, devicePixelRatio: 1.25, viewportWidth: 2048, viewportHeight: 1095,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'AMD Ryzen 9 7950X', cpuThreads: 32, memoryGB: 64,
    gpuVendor: 'NVIDIA', gpuModel: 'GeForce RTX 4080',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 32768, maxViewportDims: [32767, 32767], maxRenderbufferSize: 32768,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'ethernet', networkDownlink: 100, networkRtt: 10,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 2, cameraLabels: ['Logitech HD Pro Webcam C920'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker', 'NVIDIA HDMI Audio'] }
  },
  {
    deviceId: 'win-laptop-gaming',
    manufacturer: 'Generic',
    model: 'Gaming Laptop',
    deviceType: 'laptop',
    category: 'Gaming Laptop',
    operatingSystem: 'windows-11',
    osVersion: '11',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1080, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 969,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i7-13700H', cpuThreads: 16, memoryGB: 16,
    gpuVendor: 'NVIDIA', gpuModel: 'GeForce RTX 3060 Laptop',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384, maxViewportDims: [32767, 32767], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 50, networkRtt: 25,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['Integrated HD Camera'], microphoneLabels: ['Internal Microphone'], speakerLabels: ['Internal Speaker'] }
  },
  {
    deviceId: 'win-laptop-business',
    manufacturer: 'Generic',
    model: 'Business Ultrabook',
    deviceType: 'laptop',
    category: 'Business',
    operatingSystem: 'windows-11',
    osVersion: '11',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1200, devicePixelRatio: 1.25, viewportWidth: 1536, viewportHeight: 912,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i7-1365U', cpuThreads: 12, memoryGB: 16,
    gpuVendor: 'Intel', gpuModel: 'Iris Xe Graphics',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Intel)',
      unmaskedRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 50, networkRtt: 30,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['Integrated HD Camera'], microphoneLabels: ['Internal Microphone'], speakerLabels: ['Internal Speaker'] }
  },
  {
    deviceId: 'win-desktop-budget',
    manufacturer: 'Generic',
    model: 'Budget Desktop PC',
    deviceType: 'desktop',
    category: 'Budget',
    operatingSystem: 'windows-10',
    osVersion: '10',
    platform: 'Win32',
    architecture: 'x86_64',
    platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1366, screenHeight: 768, devicePixelRatio: 1, viewportWidth: 1366, viewportHeight: 697,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i3-10100', cpuThreads: 4, memoryGB: 8,
    gpuVendor: 'Intel', gpuModel: 'UHD Graphics 630',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Intel)',
      unmaskedRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 20, networkRtt: 40,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
    fontFamilies: WIN_FONTS,
    mediaDevices: { videoInputs: 0, audioInputs: 1, audioOutputs: 1, cameraLabels: [], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker'] }
  }
]

// ═══════════════════════════════════════════
// macOS Templates
// ═══════════════════════════════════════════

const MACOS_TEMPLATES: DeviceTemplate[] = [
  {
    deviceId: 'mac-mbp14-m4',
    manufacturer: 'Apple', model: 'MacBook Pro 14" M4', deviceType: 'laptop', category: 'Pro Laptop',
    operatingSystem: 'macos-arm', osVersion: '15.0', platform: 'MacIntel', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 3024, screenHeight: 1964, devicePixelRatio: 2, viewportWidth: 1512, viewportHeight: 911,
    orientation: 'landscape-primary', colorDepth: 30, pixelDepth: 30,
    cpuClass: 'Apple M4', cpuThreads: 10, memoryGB: 16,
    gpuVendor: 'Apple', gpuModel: 'Apple M4',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera'], microphoneLabels: ['MacBook Pro Microphone'], speakerLabels: ['MacBook Pro Speakers'] }
  },
  {
    deviceId: 'mac-mbp16-m4pro',
    manufacturer: 'Apple', model: 'MacBook Pro 16" M4 Pro', deviceType: 'laptop', category: 'Pro Laptop',
    operatingSystem: 'macos-arm', osVersion: '15.0', platform: 'MacIntel', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 3456, screenHeight: 2234, devicePixelRatio: 2, viewportWidth: 1728, viewportHeight: 1046,
    orientation: 'landscape-primary', colorDepth: 30, pixelDepth: 30,
    cpuClass: 'Apple M4 Pro', cpuThreads: 14, memoryGB: 24,
    gpuVendor: 'Apple', gpuModel: 'Apple M4 Pro',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera'], microphoneLabels: ['MacBook Pro Microphone'], speakerLabels: ['MacBook Pro Speakers'] }
  },
  {
    deviceId: 'mac-mbp16-m3pro',
    manufacturer: 'Apple', model: 'MacBook Pro 16" M3 Pro', deviceType: 'laptop', category: 'Pro Laptop',
    operatingSystem: 'macos-arm', osVersion: '14.5', platform: 'MacIntel', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 3456, screenHeight: 2234, devicePixelRatio: 2, viewportWidth: 1728, viewportHeight: 1046,
    orientation: 'landscape-primary', colorDepth: 30, pixelDepth: 30,
    cpuClass: 'Apple M3 Pro', cpuThreads: 12, memoryGB: 36,
    gpuVendor: 'Apple', gpuModel: 'Apple M3 Pro',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, Apple M3 Pro, OpenGL 4.1)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera'], microphoneLabels: ['MacBook Pro Microphone'], speakerLabels: ['MacBook Pro Speakers'] }
  },
  {
    deviceId: 'mac-mbp14-m3',
    manufacturer: 'Apple', model: 'MacBook Pro 14" M3', deviceType: 'laptop', category: 'Pro Laptop',
    operatingSystem: 'macos-arm', osVersion: '14.5', platform: 'MacIntel', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 3024, screenHeight: 1964, devicePixelRatio: 2, viewportWidth: 1512, viewportHeight: 911,
    orientation: 'landscape-primary', colorDepth: 30, pixelDepth: 30,
    cpuClass: 'Apple M3', cpuThreads: 8, memoryGB: 16,
    gpuVendor: 'Apple', gpuModel: 'Apple M3',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera'], microphoneLabels: ['MacBook Pro Microphone'], speakerLabels: ['MacBook Pro Speakers'] }
  },
  {
    deviceId: 'mac-mba-m2',
    manufacturer: 'Apple', model: 'MacBook Air M2', deviceType: 'laptop', category: 'Ultrabook',
    operatingSystem: 'macos-arm', osVersion: '14.5', platform: 'MacIntel', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 2560, screenHeight: 1600, devicePixelRatio: 2, viewportWidth: 1280, viewportHeight: 729,
    orientation: 'landscape-primary', colorDepth: 30, pixelDepth: 30,
    cpuClass: 'Apple M2', cpuThreads: 8, memoryGB: 8,
    gpuVendor: 'Apple', gpuModel: 'Apple M2',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 50, networkRtt: 20,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera (1080p)'], microphoneLabels: ['MacBook Air Microphone'], speakerLabels: ['MacBook Air Speakers'] }
  },
  {
    deviceId: 'mac-imac24-m3',
    manufacturer: 'Apple', model: 'iMac 24" M3', deviceType: 'desktop', category: 'All-in-One',
    operatingSystem: 'macos-arm', osVersion: '14.5', platform: 'MacIntel', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 4480, screenHeight: 2520, devicePixelRatio: 2, viewportWidth: 2240, viewportHeight: 1189,
    orientation: 'landscape-primary', colorDepth: 30, pixelDepth: 30,
    cpuClass: 'Apple M3', cpuThreads: 8, memoryGB: 16,
    gpuVendor: 'Apple', gpuModel: 'Apple M3',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 100, networkRtt: 15,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera (1080p)'], microphoneLabels: ['iMac Microphone'], speakerLabels: ['iMac Speakers'] }
  },
  {
    deviceId: 'mac-mbp-intel',
    manufacturer: 'Apple', model: 'MacBook Pro 15" (Intel)', deviceType: 'laptop', category: 'Pro Laptop (Intel)',
    operatingSystem: 'macos-intel', osVersion: '13.6', platform: 'MacIntel', architecture: 'x86_64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 2880, screenHeight: 1800, devicePixelRatio: 2, viewportWidth: 1440, viewportHeight: 829,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i9-9880H', cpuThreads: 8, memoryGB: 16,
    gpuVendor: 'Intel', gpuModel: 'Iris Plus Graphics 655',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Intel)', unmaskedRenderer: 'ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 50, networkRtt: 25,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
    fontFamilies: MAC_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['FaceTime HD Camera'], microphoneLabels: ['MacBook Pro Microphone'], speakerLabels: ['MacBook Pro Speakers'] }
  }
]

// ═══════════════════════════════════════════
// Linux Templates
// ═══════════════════════════════════════════

const LINUX_TEMPLATES: DeviceTemplate[] = [
  {
    deviceId: 'linux-dev-workstation',
    manufacturer: 'Generic', model: 'Linux Developer Workstation', deviceType: 'desktop', category: 'Developer',
    operatingSystem: 'linux', osVersion: '6.5', platform: 'Linux x86_64', architecture: 'x86_64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 2560, screenHeight: 1440, devicePixelRatio: 1, viewportWidth: 2560, viewportHeight: 1413,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'AMD Ryzen 9 5950X', cpuThreads: 32, memoryGB: 64,
    gpuVendor: 'NVIDIA', gpuModel: 'GeForce GTX 1080',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (NVIDIA Corporation)',
      unmaskedRenderer: 'ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1080/PCIe/SSE2, OpenGL 4.5)',
      maxTextureSize: 16384, maxViewportDims: [32767, 32767], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'ethernet', networkDownlink: 100, networkRtt: 10,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'Europe/London', 'America/Los_Angeles'],
    fontFamilies: LINUX_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['USB HD Camera'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker'] }
  },
  {
    deviceId: 'linux-thinkpad',
    manufacturer: 'Lenovo', model: 'ThinkPad X1 Carbon (Linux)', deviceType: 'laptop', category: 'Business Laptop',
    operatingSystem: 'linux', osVersion: '6.5', platform: 'Linux x86_64', architecture: 'x86_64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1200, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 1173,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i7-1365U', cpuThreads: 12, memoryGB: 16,
    gpuVendor: 'Intel', gpuModel: 'Mesa Intel UHD Graphics 630',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (Intel)',
      unmaskedRenderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: true, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 50, networkRtt: 25,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'Europe/London', 'America/Los_Angeles'],
    fontFamilies: LINUX_FONTS,
    mediaDevices: { videoInputs: 1, audioInputs: 1, audioOutputs: 1, cameraLabels: ['Integrated Camera'], microphoneLabels: ['Internal Microphone'], speakerLabels: ['Internal Speaker'] }
  },
  {
    deviceId: 'linux-budget',
    manufacturer: 'Generic', model: 'Budget Linux Desktop', deviceType: 'desktop', category: 'Budget',
    operatingSystem: 'linux', osVersion: '6.5', platform: 'Linux x86_64', architecture: 'x86_64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth: 1920, screenHeight: 1080, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 1053,
    orientation: 'landscape-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: 'Intel Core i5-10400', cpuThreads: 6, memoryGB: 8,
    gpuVendor: 'AMD', gpuModel: 'Radeon RX 580',
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: 'Google Inc. (X.Org)',
      unmaskedRenderer: 'ANGLE (X.Org, AMD Radeon RX 580, OpenGL 4.6)',
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)', antialiasing: true
    },
    touchSupport: false, maxTouchPoints: 0, batteryApi: false, pdfViewerEnabled: true,
    networkType: 'wifi', networkDownlink: 20, networkRtt: 40,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'Europe/London', 'America/Los_Angeles'],
    fontFamilies: LINUX_FONTS,
    mediaDevices: { videoInputs: 0, audioInputs: 1, audioOutputs: 1, cameraLabels: [], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker'] }
  }
]

// ═══════════════════════════════════════════
// iOS Templates (migrated from ios-devices.ts)
// ═══════════════════════════════════════════

function buildIosTemplate(
  id: string, model: string, iosVersion: string, cpu: string, gpuRenderer: string,
  screenWidth: number, screenHeight: number, dpr: number, cores: number, memory: number
): DeviceTemplate {
  return {
    deviceId: id, manufacturer: 'Apple', model, deviceType: 'mobile', category: 'Flagship Phone',
    operatingSystem: 'ios', osVersion: iosVersion, platform: 'iPhone', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'webkit' }, { browser: 'firefox', engine: 'webkit' }],
    screenWidth, screenHeight, devicePixelRatio: dpr,
    viewportWidth: screenWidth, viewportHeight: Math.floor(screenHeight * 0.93),
    orientation: 'portrait-primary', colorDepth: 32, pixelDepth: 32,
    cpuClass: cpu, cpuThreads: cores, memoryGB: memory,
    gpuVendor: 'Apple Inc.', gpuModel: gpuRenderer,
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'Apple Inc.', renderer: gpuRenderer,
      unmaskedVendor: 'Apple Inc.', unmaskedRenderer: gpuRenderer,
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Apple)', antialiasing: true
    },
    touchSupport: true, maxTouchPoints: 5, batteryApi: true, pdfViewerEnabled: false,
    networkType: 'cellular', networkDownlink: 15, networkRtt: 50,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles'],
    fontFamilies: IOS_FONTS,
    mediaDevices: { videoInputs: 2, audioInputs: 1, audioOutputs: 1, cameraLabels: ['Back Camera', 'Front Camera'], microphoneLabels: ['iPhone Microphone'], speakerLabels: ['iPhone Speaker'] }
  }
}

const IOS_TEMPLATES: DeviceTemplate[] = [
  buildIosTemplate('iphone-16-pro-max', 'iPhone 16 Pro Max', '18.0', 'Apple A18 Pro (6 Cores)', 'Apple A18 Pro GPU', 440, 956, 3.0, 6, 8),
  buildIosTemplate('iphone-16-pro', 'iPhone 16 Pro', '18.0', 'Apple A18 Pro (6 Cores)', 'Apple A18 Pro GPU', 402, 874, 3.0, 6, 8),
  buildIosTemplate('iphone-16-plus', 'iPhone 16 Plus', '18.0', 'Apple A18 (6 Cores)', 'Apple A18 GPU', 430, 932, 3.0, 6, 8),
  buildIosTemplate('iphone-16', 'iPhone 16', '18.0', 'Apple A18 (6 Cores)', 'Apple A18 GPU', 393, 852, 3.0, 6, 8),
  buildIosTemplate('iphone-15-pro-max', 'iPhone 15 Pro Max', '17.5', 'Apple A17 Pro (6 Cores)', 'Apple A17 Pro GPU', 430, 932, 3.0, 6, 8),
  buildIosTemplate('iphone-15-pro', 'iPhone 15 Pro', '17.5', 'Apple A17 Pro (6 Cores)', 'Apple A17 Pro GPU', 393, 852, 3.0, 6, 8),
  buildIosTemplate('iphone-15', 'iPhone 15', '17.5', 'Apple A16 Bionic (6 Cores)', 'Apple A16 GPU', 393, 852, 3.0, 6, 6),
  buildIosTemplate('iphone-14-pro-max', 'iPhone 14 Pro Max', '17.0', 'Apple A16 Bionic (6 Cores)', 'Apple A16 GPU', 430, 932, 3.0, 6, 6),
  buildIosTemplate('iphone-14-pro', 'iPhone 14 Pro', '17.0', 'Apple A16 Bionic (6 Cores)', 'Apple A16 GPU', 393, 852, 3.0, 6, 6),
  buildIosTemplate('iphone-14', 'iPhone 14', '16.5', 'Apple A15 Bionic (6 Cores)', 'Apple A15 GPU', 390, 844, 3.0, 6, 6),
  buildIosTemplate('iphone-13-pro', 'iPhone 13 Pro', '16.0', 'Apple A15 Bionic (6 Cores)', 'Apple A15 GPU', 390, 844, 3.0, 6, 6),
  buildIosTemplate('iphone-13', 'iPhone 13', '16.0', 'Apple A15 Bionic (6 Cores)', 'Apple A15 GPU', 390, 844, 3.0, 6, 4),
]

// ═══════════════════════════════════════════
// Android Templates (migrated from android-devices.ts)
// ═══════════════════════════════════════════

function buildAndroidTemplate(
  id: string, brand: string, model: string, modelCode: string, androidVersion: string,
  cpu: string, gpuVendor: string, gpuRenderer: string,
  screenWidth: number, screenHeight: number, dpr: number, cores: number, memory: number,
  category: string = 'Flagship Phone'
): DeviceTemplate {
  return {
    deviceId: id, manufacturer: brand, model: `${brand} ${model}`, deviceType: 'mobile', category,
    operatingSystem: 'android', osVersion: androidVersion, platform: 'Linux armv8l', architecture: 'arm64', platformArchitecture: '64-bit',
    supportedBrowsers: [{ browser: 'chrome', engine: 'blink' }, { browser: 'firefox', engine: 'gecko' }],
    screenWidth, screenHeight, devicePixelRatio: dpr,
    viewportWidth: screenWidth, viewportHeight: Math.floor(screenHeight * 0.9),
    orientation: 'portrait-primary', colorDepth: 24, pixelDepth: 24,
    cpuClass: cpu, cpuThreads: cores, memoryGB: memory,
    gpuVendor, gpuModel: gpuRenderer,
    webglProfile: {
      version: 'WebGL 2.0', vendor: 'WebKit', renderer: 'WebKit WebGL',
      unmaskedVendor: gpuVendor, unmaskedRenderer: gpuRenderer,
      maxTextureSize: 16384, maxViewportDims: [16384, 16384], maxRenderbufferSize: 16384,
      shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Android)', antialiasing: true
    },
    touchSupport: true, maxTouchPoints: 5, batteryApi: true, pdfViewerEnabled: false,
    networkType: 'cellular', networkDownlink: 15, networkRtt: 50,
    languageDefaults: ['en-US', 'en'], timezoneDefaults: ['America/New_York', 'America/Los_Angeles'],
    fontFamilies: ANDROID_FONTS,
    mediaDevices: { videoInputs: 2, audioInputs: 1, audioOutputs: 1, cameraLabels: ['camera2 0, facing back', 'camera2 1, facing front'], microphoneLabels: ['Default Microphone'], speakerLabels: ['Default Speaker'] }
  }
}

const ANDROID_TEMPLATES: DeviceTemplate[] = [
  buildAndroidTemplate('samsung-s24-ultra', 'Samsung', 'Galaxy S24 Ultra', 'SM-S928B', '14', 'Snapdragon 8 Gen 3', 'Qualcomm', 'Adreno (TM) 750', 412, 915, 3.5, 8, 12),
  buildAndroidTemplate('samsung-s24-plus', 'Samsung', 'Galaxy S24+', 'SM-S926B', '14', 'Exynos 2400', 'Samsung Electronics', 'Samsung Xclipse 940', 384, 832, 3.0, 8, 12),
  buildAndroidTemplate('samsung-s24', 'Samsung', 'Galaxy S24', 'SM-S921B', '14', 'Exynos 2400', 'Samsung Electronics', 'Samsung Xclipse 940', 360, 780, 3.0, 8, 8),
  buildAndroidTemplate('samsung-s23-ultra', 'Samsung', 'Galaxy S23 Ultra', 'SM-S918B', '14', 'Snapdragon 8 Gen 2', 'Qualcomm', 'Adreno (TM) 740', 412, 915, 3.0, 8, 12),
  buildAndroidTemplate('samsung-s23', 'Samsung', 'Galaxy S23', 'SM-S911B', '14', 'Snapdragon 8 Gen 2', 'Qualcomm', 'Adreno (TM) 740', 360, 780, 3.0, 8, 8),
  buildAndroidTemplate('samsung-a54', 'Samsung', 'Galaxy A54', 'SM-A546B', '14', 'Exynos 1380', 'ARM', 'Mali-G68 MC4', 360, 780, 2.625, 8, 6, 'Mid-Range Phone'),
  buildAndroidTemplate('samsung-a34', 'Samsung', 'Galaxy A34', 'SM-A346B', '14', 'MediaTek Dimensity 1080', 'ARM', 'Mali-G68 MC4', 360, 780, 2.625, 8, 6, 'Mid-Range Phone'),
  buildAndroidTemplate('pixel-8-pro', 'Google', 'Pixel 8 Pro', 'Pixel 8 Pro', '14', 'Google Tensor G3', 'ARM', 'Mali-G715 Immortalis MC11', 412, 915, 2.625, 8, 12),
  buildAndroidTemplate('pixel-8', 'Google', 'Pixel 8', 'Pixel 8', '14', 'Google Tensor G3', 'ARM', 'Mali-G715 Immortalis MC11', 412, 915, 2.625, 8, 8),
  buildAndroidTemplate('pixel-7-pro', 'Google', 'Pixel 7 Pro', 'Pixel 7 Pro', '14', 'Google Tensor G2', 'ARM', 'Mali-G710 MC10', 412, 892, 2.625, 8, 12),
  buildAndroidTemplate('pixel-7', 'Google', 'Pixel 7', 'Pixel 7', '14', 'Google Tensor G2', 'ARM', 'Mali-G710 MC10', 412, 892, 2.625, 8, 8),
  buildAndroidTemplate('oneplus-12', 'OnePlus', '12', 'CPH2583', '14', 'Snapdragon 8 Gen 3', 'Qualcomm', 'Adreno (TM) 750', 412, 915, 3.5, 8, 12),
  buildAndroidTemplate('oneplus-11', 'OnePlus', '11', 'CPH2449', '14', 'Snapdragon 8 Gen 2', 'Qualcomm', 'Adreno (TM) 740', 412, 915, 3.0, 8, 12),
  buildAndroidTemplate('xiaomi-14-pro', 'Xiaomi', '14 Pro', '23116PN5BC', '14', 'Snapdragon 8 Gen 3', 'Qualcomm', 'Adreno (TM) 750', 412, 915, 3.5, 8, 12),
  buildAndroidTemplate('xiaomi-13', 'Xiaomi', '13', '2211133C', '14', 'Snapdragon 8 Gen 2', 'Qualcomm', 'Adreno (TM) 740', 393, 873, 2.75, 8, 8),
]

// ═══════════════════════════════════════════
// Combined Database & Lookup Functions
// ═══════════════════════════════════════════

export const ALL_DEVICE_TEMPLATES: DeviceTemplate[] = [
  ...WINDOWS_TEMPLATES,
  ...MACOS_TEMPLATES,
  ...LINUX_TEMPLATES,
  ...IOS_TEMPLATES,
  ...ANDROID_TEMPLATES
]

/**
 * Get a device template by its unique deviceId.
 */
export function getDeviceTemplateById(deviceId: string): DeviceTemplate | null {
  if (!deviceId) return null
  const clean = deviceId.toLowerCase().trim()
  return ALL_DEVICE_TEMPLATES.find(t => t.deviceId.toLowerCase() === clean) || null
}

/**
 * Get all device templates for a given OS type.
 */
export function getDeviceTemplatesByOs(osType: OSType): DeviceTemplate[] {
  return ALL_DEVICE_TEMPLATES.filter(t => t.operatingSystem === osType)
}

/**
 * Get all device templates grouped by OS family.
 */
export function getDeviceTemplatesGrouped(): Record<string, DeviceTemplate[]> {
  const grouped: Record<string, DeviceTemplate[]> = {}
  for (const t of ALL_DEVICE_TEMPLATES) {
    const family = getOSFamily(t.operatingSystem)
    if (!grouped[family]) grouped[family] = []
    grouped[family].push(t)
  }
  return grouped
}

/**
 * Get the default device template for a given OS type.
 */
export function getDefaultDeviceTemplate(osType: OSType): DeviceTemplate {
  const templates = getDeviceTemplatesByOs(osType)
  if (templates.length > 0) return templates[0]

  // Fallback: find any template for the same family
  const family = getOSFamily(osType)
  const familyTemplates = ALL_DEVICE_TEMPLATES.filter(t => getOSFamily(t.operatingSystem) === family)
  if (familyTemplates.length > 0) return familyTemplates[0]

  // Ultimate fallback: first Windows template
  return WINDOWS_TEMPLATES[0]
}

/**
 * Find the best matching device template for a legacy fingerprint.
 * Used for non-destructive migration of profiles without a deviceTemplateId.
 */
export function findBestMatchingTemplate(fp: any, osType: OSType): DeviceTemplate {
  const candidates = getDeviceTemplatesByOs(osType)
  if (candidates.length === 0) return getDefaultDeviceTemplate(osType)

  let bestScore = -1
  let bestTemplate = candidates[0]

  for (const t of candidates) {
    let score = 0

    // Screen match
    if (fp?.screen?.width === t.screenWidth && fp?.screen?.height === t.screenHeight) score += 3
    if (fp?.screen?.devicePixelRatio === t.devicePixelRatio) score += 2

    // CPU match
    if (fp?.navigator?.hardwareConcurrency === t.cpuThreads) score += 2

    // Memory match
    if (fp?.navigator?.deviceMemory === t.memoryGB) score += 2

    // GPU match
    const fpGpu = (fp?.webgl?.unmaskedRenderer || fp?.webgl?.gpuRenderer || '').toLowerCase()
    if (fpGpu && t.webglProfile.unmaskedRenderer.toLowerCase().includes(fpGpu.split(' ')[0])) score += 3

    if (score > bestScore) {
      bestScore = score
      bestTemplate = t
    }
  }

  return bestTemplate
}
