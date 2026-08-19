// ──────────────────────────────────────────────────────────────────
// AntiProfiles — iOS Mobile Devices & Models Catalog
// Comprehensive Real-World Apple iOS Specifications for Anti-Detect Emulation
// ──────────────────────────────────────────────────────────────────

export interface IosDeviceSpec {
  id: string
  brand: 'Apple'
  modelName: string
  modelCode: string
  iosVersion: string
  cpu: string
  gpuVendor: string
  gpuRenderer: string
  screenWidth: number
  screenHeight: number
  dpr: number
  cores: number
  memory: number
}

export const IOS_DEVICES: IosDeviceSpec[] = [
  {
    id: 'iphone-16-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 16 Pro Max',
    modelCode: 'iPhone17,2',
    iosVersion: '18.0',
    cpu: 'Apple A18 Pro (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A18 Pro GPU',
    screenWidth: 440,
    screenHeight: 956,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-16-pro',
    brand: 'Apple',
    modelName: 'iPhone 16 Pro',
    modelCode: 'iPhone17,1',
    iosVersion: '18.0',
    cpu: 'Apple A18 Pro (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A18 Pro GPU',
    screenWidth: 402,
    screenHeight: 874,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-16-plus',
    brand: 'Apple',
    modelName: 'iPhone 16 Plus',
    modelCode: 'iPhone17,4',
    iosVersion: '18.0',
    cpu: 'Apple A18 (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A18 GPU',
    screenWidth: 430,
    screenHeight: 932,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-16',
    brand: 'Apple',
    modelName: 'iPhone 16',
    modelCode: 'iPhone17,3',
    iosVersion: '18.0',
    cpu: 'Apple A18 (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A18 GPU',
    screenWidth: 393,
    screenHeight: 852,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-15-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 15 Pro Max',
    modelCode: 'iPhone16,2',
    iosVersion: '17.5',
    cpu: 'Apple A17 Pro (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A17 Pro GPU',
    screenWidth: 430,
    screenHeight: 932,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-15-pro',
    brand: 'Apple',
    modelName: 'iPhone 15 Pro',
    modelCode: 'iPhone16,1',
    iosVersion: '17.5',
    cpu: 'Apple A17 Pro (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A17 Pro GPU',
    screenWidth: 393,
    screenHeight: 852,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-15',
    brand: 'Apple',
    modelName: 'iPhone 15',
    modelCode: 'iPhone15,4',
    iosVersion: '17.5',
    cpu: 'Apple A16 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A16 GPU',
    screenWidth: 393,
    screenHeight: 852,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-14-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 14 Pro Max',
    modelCode: 'iPhone15,3',
    iosVersion: '17.0',
    cpu: 'Apple A16 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A16 GPU',
    screenWidth: 430,
    screenHeight: 932,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-14-pro',
    brand: 'Apple',
    modelName: 'iPhone 14 Pro',
    modelCode: 'iPhone15,2',
    iosVersion: '17.0',
    cpu: 'Apple A16 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A16 GPU',
    screenWidth: 393,
    screenHeight: 852,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-14',
    brand: 'Apple',
    modelName: 'iPhone 14',
    modelCode: 'iPhone14,7',
    iosVersion: '16.5',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 390,
    screenHeight: 844,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-13-pro',
    brand: 'Apple',
    modelName: 'iPhone 13 Pro',
    modelCode: 'iPhone14,2',
    iosVersion: '16.0',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 390,
    screenHeight: 844,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-13',
    brand: 'Apple',
    modelName: 'iPhone 13',
    modelCode: 'iPhone14,5',
    iosVersion: '16.0',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 390,
    screenHeight: 844,
    dpr: 3.0,
    cores: 6,
    memory: 4
  }
]

export function getIosDeviceById(idOrModelCode: string): IosDeviceSpec | null {
  if (!idOrModelCode) return null
  const clean = idOrModelCode.toLowerCase().trim()
  return (
    IOS_DEVICES.find(d => d.id.toLowerCase() === clean || d.modelCode.toLowerCase() === clean || d.modelName.toLowerCase() === clean) || null
  )
}

export function generateIosUserAgent(
  device: IosDeviceSpec,
  browserType: 'chrome' | 'firefox' = 'chrome',
  browserVersion = '128.0.6613.120'
): string {
  const osVerFormatted = (device.iosVersion || '18.0').replace(/\./g, '_')
  if (browserType === 'firefox') {
    const ffVer = browserVersion.includes('.') ? browserVersion : `${browserVersion}.0`
    return `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVerFormatted} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${ffVer} Mobile/15E148 Safari/605.1.15`
  }
  return `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVerFormatted} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${browserVersion} Mobile/15E148 Safari/604.1`
}
