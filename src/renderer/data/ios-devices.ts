// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Real-Time iOS / iPhone Mobile Devices Catalog
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
    id: 'iphone-17-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 17 Pro Max',
    modelCode: 'iPhone18,2',
    iosVersion: '19.0',
    cpu: 'Apple A19 Pro (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A19 Pro GPU',
    screenWidth: 440,
    screenHeight: 956,
    dpr: 3.0,
    cores: 6,
    memory: 12
  },
  {
    id: 'iphone-17-pro',
    brand: 'Apple',
    modelName: 'iPhone 17 Pro',
    modelCode: 'iPhone18,1',
    iosVersion: '19.0',
    cpu: 'Apple A19 Pro (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A19 Pro GPU',
    screenWidth: 402,
    screenHeight: 874,
    dpr: 3.0,
    cores: 6,
    memory: 12
  },
  {
    id: 'iphone-17-air',
    brand: 'Apple',
    modelName: 'iPhone 17 Air (Slim)',
    modelCode: 'iPhone18,4',
    iosVersion: '19.0',
    cpu: 'Apple A19 (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A19 GPU',
    screenWidth: 414,
    screenHeight: 896,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
  {
    id: 'iphone-17',
    brand: 'Apple',
    modelName: 'iPhone 17',
    modelCode: 'iPhone18,3',
    iosVersion: '19.0',
    cpu: 'Apple A19 (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A19 GPU',
    screenWidth: 393,
    screenHeight: 852,
    dpr: 3.0,
    cores: 6,
    memory: 8
  },
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
    id: 'iphone-15-plus',
    brand: 'Apple',
    modelName: 'iPhone 15 Plus',
    modelCode: 'iPhone15,5',
    iosVersion: '17.4',
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
    id: 'iphone-15',
    brand: 'Apple',
    modelName: 'iPhone 15',
    modelCode: 'iPhone15,4',
    iosVersion: '17.4',
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
    iosVersion: '17.2',
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
    iosVersion: '17.2',
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
    id: 'iphone-14-plus',
    brand: 'Apple',
    modelName: 'iPhone 14 Plus',
    modelCode: 'iPhone14,8',
    iosVersion: '16.6',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 428,
    screenHeight: 926,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-14',
    brand: 'Apple',
    modelName: 'iPhone 14',
    modelCode: 'iPhone14,7',
    iosVersion: '16.6',
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
    id: 'iphone-13-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 13 Pro Max',
    modelCode: 'iPhone14,3',
    iosVersion: '16.5',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 428,
    screenHeight: 926,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-13-pro',
    brand: 'Apple',
    modelName: 'iPhone 13 Pro',
    modelCode: 'iPhone14,2',
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
    id: 'iphone-13',
    brand: 'Apple',
    modelName: 'iPhone 13',
    modelCode: 'iPhone14,5',
    iosVersion: '16.4',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 390,
    screenHeight: 844,
    dpr: 3.0,
    cores: 6,
    memory: 4
  },
  {
    id: 'iphone-13-mini',
    brand: 'Apple',
    modelName: 'iPhone 13 mini',
    modelCode: 'iPhone14,4',
    iosVersion: '16.4',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 375,
    screenHeight: 812,
    dpr: 3.0,
    cores: 6,
    memory: 4
  },
  {
    id: 'iphone-12-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 12 Pro Max',
    modelCode: 'iPhone13,4',
    iosVersion: '16.2',
    cpu: 'Apple A14 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A14 GPU',
    screenWidth: 428,
    screenHeight: 926,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-12-pro',
    brand: 'Apple',
    modelName: 'iPhone 12 Pro',
    modelCode: 'iPhone13,3',
    iosVersion: '16.2',
    cpu: 'Apple A14 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A14 GPU',
    screenWidth: 390,
    screenHeight: 844,
    dpr: 3.0,
    cores: 6,
    memory: 6
  },
  {
    id: 'iphone-12',
    brand: 'Apple',
    modelName: 'iPhone 12',
    modelCode: 'iPhone13,2',
    iosVersion: '16.0',
    cpu: 'Apple A14 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A14 GPU',
    screenWidth: 390,
    screenHeight: 844,
    dpr: 3.0,
    cores: 6,
    memory: 4
  },
  {
    id: 'iphone-11-pro-max',
    brand: 'Apple',
    modelName: 'iPhone 11 Pro Max',
    modelCode: 'iPhone12,5',
    iosVersion: '15.7',
    cpu: 'Apple A13 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A13 GPU',
    screenWidth: 414,
    screenHeight: 896,
    dpr: 3.0,
    cores: 6,
    memory: 4
  },
  {
    id: 'iphone-11',
    brand: 'Apple',
    modelName: 'iPhone 11',
    modelCode: 'iPhone12,1',
    iosVersion: '15.7',
    cpu: 'Apple A13 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A13 GPU',
    screenWidth: 414,
    screenHeight: 896,
    dpr: 2.0,
    cores: 6,
    memory: 4
  },
  {
    id: 'iphone-se-3',
    brand: 'Apple',
    modelName: 'iPhone SE (3rd Gen)',
    modelCode: 'iPhone14,6',
    iosVersion: '17.0',
    cpu: 'Apple A15 Bionic (6 Cores)',
    gpuVendor: 'Apple Inc.',
    gpuRenderer: 'Apple A15 GPU',
    screenWidth: 375,
    screenHeight: 667,
    dpr: 2.0,
    cores: 6,
    memory: 4
  }
]

export function getIosDeviceById(idOrCode: string): IosDeviceSpec | undefined {
  if (!idOrCode) return undefined
  const query = idOrCode.toLowerCase().trim()
  return IOS_DEVICES.find(d =>
    d.id.toLowerCase() === query ||
    d.modelCode.toLowerCase() === query ||
    d.modelName.toLowerCase() === query ||
    d.modelName.toLowerCase().replace(/\s+/g, '-').includes(query)
  )
}

export function generateIosUserAgent(dev: IosDeviceSpec, browser: 'chrome' | 'firefox' = 'chrome', version?: string): string {
  const v = dev.iosVersion.replace('.', '_')
  if (browser === 'firefox') {
    const ffVer = version ? (version.includes('.') ? version : `${version}.0`) : '129.0'
    return `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${ffVer} Mobile/15E148 Safari/605.1.15`
  }
  const cVer = version || '128.0.6613.120'
  return `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${cVer} Mobile/15E148 Safari/604.1`
}
