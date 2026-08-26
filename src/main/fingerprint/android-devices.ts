// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Real-Time Android Mobile Devices & Models Catalog
// Comprehensive Real-World Mobile Specifications for Anti-Detect Emulation
// ──────────────────────────────────────────────────────────────────

export interface AndroidDeviceSpec {
  id: string
  brand: string
  modelName: string
  modelCode: string
  androidVersion: string
  cpu: string
  gpuVendor: string
  gpuRenderer: string
  screenWidth: number
  screenHeight: number
  dpr: number
  cores: number
  memory: number
}

export const ANDROID_DEVICES: AndroidDeviceSpec[] = [
  // ── 1. Samsung ──
  {
    id: 'samsung-s24-ultra',
    brand: 'Samsung',
    modelName: 'Galaxy S24 Ultra (SM-S928B)',
    modelCode: 'SM-S928B',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 12
  },
  {
    id: 'samsung-s24-plus',
    brand: 'Samsung',
    modelName: 'Galaxy S24+ (SM-S926B)',
    modelCode: 'SM-S926B',
    androidVersion: '14',
    cpu: 'Exynos 2400 (Xclipse 940)',
    gpuVendor: 'Samsung Electronics',
    gpuRenderer: 'Samsung Xclipse 940',
    screenWidth: 384,
    screenHeight: 832,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'samsung-s24',
    brand: 'Samsung',
    modelName: 'Galaxy S24 (SM-S921B)',
    modelCode: 'SM-S921B',
    androidVersion: '14',
    cpu: 'Exynos 2400 (Xclipse 940)',
    gpuVendor: 'Samsung Electronics',
    gpuRenderer: 'Samsung Xclipse 940',
    screenWidth: 360,
    screenHeight: 780,
    dpr: 3.0,
    cores: 8,
    memory: 8
  },
  {
    id: 'samsung-s23-ultra',
    brand: 'Samsung',
    modelName: 'Galaxy S23 Ultra (SM-S918B)',
    modelCode: 'SM-S918B',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'samsung-s23-plus',
    brand: 'Samsung',
    modelName: 'Galaxy S23+ (SM-S916B)',
    modelCode: 'SM-S916B',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 384,
    screenHeight: 832,
    dpr: 3.0,
    cores: 8,
    memory: 8
  },
  {
    id: 'samsung-s23',
    brand: 'Samsung',
    modelName: 'Galaxy S23 (SM-S911B)',
    modelCode: 'SM-S911B',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 360,
    screenHeight: 780,
    dpr: 3.0,
    cores: 8,
    memory: 8
  },
  {
    id: 'samsung-s22-ultra',
    brand: 'Samsung',
    modelName: 'Galaxy S22 Ultra (SM-S908B)',
    modelCode: 'SM-S908B',
    androidVersion: '13',
    cpu: 'Snapdragon 8 Gen 1 (Adreno 730)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 730',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'samsung-z-fold5',
    brand: 'Samsung',
    modelName: 'Galaxy Z Fold 5 (SM-F946B)',
    modelCode: 'SM-F946B',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 820,
    screenHeight: 880,
    dpr: 2.5,
    cores: 8,
    memory: 12
  },
  {
    id: 'samsung-z-flip5',
    brand: 'Samsung',
    modelName: 'Galaxy Z Flip 5 (SM-F731B)',
    modelCode: 'SM-F731B',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 1008,
    dpr: 2.625,
    cores: 8,
    memory: 8
  },
  {
    id: 'samsung-a54',
    brand: 'Samsung',
    modelName: 'Galaxy A54 5G (SM-A546B)',
    modelCode: 'SM-A546B',
    androidVersion: '14',
    cpu: 'Exynos 1380 (Mali-G68 MP5)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G68 MP5',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 2.625,
    cores: 8,
    memory: 8
  },
  {
    id: 'samsung-tab-s9-ultra',
    brand: 'Samsung',
    modelName: 'Galaxy Tab S9 Ultra (SM-X910)',
    modelCode: 'SM-X910',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 1848,
    screenHeight: 1155,
    dpr: 2.0,
    cores: 8,
    memory: 12
  },

  // ── 2. Google Pixel ──
  {
    id: 'pixel-8-pro',
    brand: 'Google Pixel',
    modelName: 'Pixel 8 Pro',
    modelCode: 'Pixel 8 Pro',
    androidVersion: '14',
    cpu: 'Google Tensor G3 (Immortalis-G715)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G715 Immortalis MC10',
    screenWidth: 412,
    screenHeight: 892,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'pixel-8',
    brand: 'Google Pixel',
    modelName: 'Pixel 8',
    modelCode: 'Pixel 8',
    androidVersion: '14',
    cpu: 'Google Tensor G3 (Immortalis-G715)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G715 Immortalis MC10',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 2.625,
    cores: 8,
    memory: 8
  },
  {
    id: 'pixel-8a',
    brand: 'Google Pixel',
    modelName: 'Pixel 8a',
    modelCode: 'Pixel 8a',
    androidVersion: '14',
    cpu: 'Google Tensor G3 (Immortalis-G715)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G715 Immortalis MC10',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 2.625,
    cores: 8,
    memory: 8
  },
  {
    id: 'pixel-7-pro',
    brand: 'Google Pixel',
    modelName: 'Pixel 7 Pro',
    modelCode: 'Pixel 7 Pro',
    androidVersion: '14',
    cpu: 'Google Tensor G2 (Mali-G710)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G710 MP7',
    screenWidth: 412,
    screenHeight: 892,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'pixel-7',
    brand: 'Google Pixel',
    modelName: 'Pixel 7',
    modelCode: 'Pixel 7',
    androidVersion: '14',
    cpu: 'Google Tensor G2 (Mali-G710)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G710 MP7',
    screenWidth: 393,
    screenHeight: 873,
    dpr: 2.75,
    cores: 8,
    memory: 8
  },
  {
    id: 'pixel-7a',
    brand: 'Google Pixel',
    modelName: 'Pixel 7a',
    modelCode: 'Pixel 7a',
    androidVersion: '14',
    cpu: 'Google Tensor G2 (Mali-G710)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G710 MP7',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 2.625,
    cores: 8,
    memory: 8
  },
  {
    id: 'pixel-6-pro',
    brand: 'Google Pixel',
    modelName: 'Pixel 6 Pro',
    modelCode: 'Pixel 6 Pro',
    androidVersion: '13',
    cpu: 'Google Tensor (Mali-G78)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G78 MP20',
    screenWidth: 412,
    screenHeight: 892,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'pixel-fold',
    brand: 'Google Pixel',
    modelName: 'Pixel Fold',
    modelCode: 'Pixel Fold',
    androidVersion: '14',
    cpu: 'Google Tensor G2 (Mali-G710)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G710 MP7',
    screenWidth: 840,
    screenHeight: 920,
    dpr: 2.5,
    cores: 8,
    memory: 12
  },

  // ── 3. Xiaomi / Redmi / POCO ──
  {
    id: 'xiaomi-14-pro',
    brand: 'Xiaomi / Redmi',
    modelName: 'Xiaomi 14 Pro (23116PN5BC)',
    modelCode: '23116PN5BC',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 12
  },
  {
    id: 'xiaomi-14',
    brand: 'Xiaomi / Redmi',
    modelName: 'Xiaomi 14 (23127PN0CG)',
    modelCode: '23127PN0CG',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 393,
    screenHeight: 873,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'xiaomi-13-ultra',
    brand: 'Xiaomi / Redmi',
    modelName: 'Xiaomi 13 Ultra (2304FPN6DC)',
    modelCode: '2304FPN6DC',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 12
  },
  {
    id: 'xiaomi-13t-pro',
    brand: 'Xiaomi / Redmi',
    modelName: 'Xiaomi 13T Pro (23078PND5G)',
    modelCode: '23078PND5G',
    androidVersion: '14',
    cpu: 'Dimensity 9200+ (Immortalis-G715)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G715 Immortalis MC11',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'redmi-note-13-pro-plus',
    brand: 'Xiaomi / Redmi',
    modelName: 'Redmi Note 13 Pro+ 5G (23090RA98G)',
    modelCode: '23090RA98G',
    androidVersion: '14',
    cpu: 'Dimensity 7200-Ultra (Mali-G610)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G610 MC4',
    screenWidth: 393,
    screenHeight: 873,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'poco-f6-pro',
    brand: 'Xiaomi / Redmi',
    modelName: 'POCO F6 Pro (23113RKC6G)',
    modelCode: '23113RKC6G',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },

  // ── 4. OnePlus ──
  {
    id: 'oneplus-12',
    brand: 'OnePlus',
    modelName: 'OnePlus 12 (CPH2581)',
    modelCode: 'CPH2581',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 16
  },
  {
    id: 'oneplus-12r',
    brand: 'OnePlus',
    modelName: 'OnePlus 12R (CPH2609)',
    modelCode: 'CPH2609',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 16
  },
  {
    id: 'oneplus-11',
    brand: 'OnePlus',
    modelName: 'OnePlus 11 5G (CPH2449)',
    modelCode: 'CPH2449',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 16
  },
  {
    id: 'oneplus-open',
    brand: 'OnePlus',
    modelName: 'OnePlus Open (CPH2551)',
    modelCode: 'CPH2551',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 820,
    screenHeight: 880,
    dpr: 2.5,
    cores: 8,
    memory: 16
  },
  {
    id: 'oneplus-nord-3',
    brand: 'OnePlus',
    modelName: 'OnePlus Nord 3 5G (CPH2493)',
    modelCode: 'CPH2493',
    androidVersion: '14',
    cpu: 'Dimensity 9000 (Mali-G710)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G710 MC10',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 16
  },

  // ── 5. Oppo ──
  {
    id: 'oppo-find-x7-ultra',
    brand: 'Oppo',
    modelName: 'Oppo Find X7 Ultra (PHY110)',
    modelCode: 'PHY110',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 16
  },
  {
    id: 'oppo-find-n3',
    brand: 'Oppo',
    modelName: 'Oppo Find N3 (CPH2499)',
    modelCode: 'CPH2499',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 820,
    screenHeight: 880,
    dpr: 2.5,
    cores: 8,
    memory: 16
  },
  {
    id: 'oppo-reno-11-pro',
    brand: 'Oppo',
    modelName: 'Oppo Reno 11 Pro 5G (CPH2607)',
    modelCode: 'CPH2607',
    androidVersion: '14',
    cpu: 'Dimensity 8200 (Mali-G610)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G610 MC6',
    screenWidth: 393,
    screenHeight: 873,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },

  // ── 6. Vivo / iQOO ──
  {
    id: 'vivo-x100-pro',
    brand: 'Vivo',
    modelName: 'Vivo X100 Pro (V2324A)',
    modelCode: 'V2324A',
    androidVersion: '14',
    cpu: 'Dimensity 9300 (Immortalis-G720)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G720 Immortalis MC12',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 16
  },
  {
    id: 'vivo-iqoo-12-pro',
    brand: 'Vivo',
    modelName: 'iQOO 12 Pro (V2307A)',
    modelCode: 'V2307A',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 16
  },
  {
    id: 'vivo-x90-pro-plus',
    brand: 'Vivo',
    modelName: 'Vivo X90 Pro+ (V2227A)',
    modelCode: 'V2227A',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },

  // ── 7. Motorola ──
  {
    id: 'moto-edge-50-ultra',
    brand: 'Motorola',
    modelName: 'Motorola Edge 50 Ultra (XT2401-1)',
    modelCode: 'XT2401-1',
    androidVersion: '14',
    cpu: 'Snapdragon 8s Gen 3 (Adreno 735)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 735',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'moto-razr-50-ultra',
    brand: 'Motorola',
    modelName: 'Motorola Razr 50 Ultra (XT2453-3)',
    modelCode: 'XT2453-3',
    androidVersion: '14',
    cpu: 'Snapdragon 8s Gen 3 (Adreno 735)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 735',
    screenWidth: 412,
    screenHeight: 1008,
    dpr: 2.625,
    cores: 8,
    memory: 12
  },

  // ── 8. Sony Xperia ──
  {
    id: 'sony-xperia-1-vi',
    brand: 'Sony Xperia',
    modelName: 'Sony Xperia 1 VI (XQ-EC54)',
    modelCode: 'XQ-EC54',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'sony-xperia-1-v',
    brand: 'Sony Xperia',
    modelName: 'Sony Xperia 1 V (XQ-DQ54)',
    modelCode: 'XQ-DQ54',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 412,
    screenHeight: 960,
    dpr: 3.5,
    cores: 8,
    memory: 12
  },

  // ── 9. Asus ROG ──
  {
    id: 'asus-rog-8-pro',
    brand: 'Asus ROG',
    modelName: 'Asus ROG Phone 8 Pro (AI2401)',
    modelCode: 'AI2401',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 16
  },
  {
    id: 'asus-zenfone-11-ultra',
    brand: 'Asus ROG',
    modelName: 'Asus Zenfone 11 Ultra (AI2401)',
    modelCode: 'AI2401',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },

  // ── 10. Nothing Phone ──
  {
    id: 'nothing-phone-2',
    brand: 'Nothing Phone',
    modelName: 'Nothing Phone (2) (A065)',
    modelCode: 'A065',
    androidVersion: '14',
    cpu: 'Snapdragon 8+ Gen 1 (Adreno 730)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 730',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 12
  },
  {
    id: 'nothing-phone-2a',
    brand: 'Nothing Phone',
    modelName: 'Nothing Phone (2a) (A142)',
    modelCode: 'A142',
    androidVersion: '14',
    cpu: 'Dimensity 7200 Pro (Mali-G610)',
    gpuVendor: 'ARM',
    gpuRenderer: 'Mali-G610 MC4',
    screenWidth: 393,
    screenHeight: 873,
    dpr: 2.75,
    cores: 8,
    memory: 8
  },

  // ── 11. Realme ──
  {
    id: 'realme-gt-5-pro',
    brand: 'Realme',
    modelName: 'Realme GT 5 Pro (RMX3888)',
    modelCode: 'RMX3888',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.0,
    cores: 8,
    memory: 16
  },
  {
    id: 'realme-12-pro-plus',
    brand: 'Realme',
    modelName: 'Realme 12 Pro+ 5G (RMX3840)',
    modelCode: 'RMX3840',
    androidVersion: '14',
    cpu: 'Snapdragon 7s Gen 2 (Adreno 710)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 710',
    screenWidth: 393,
    screenHeight: 873,
    dpr: 2.75,
    cores: 8,
    memory: 12
  },

  // ── 12. Honor ──
  {
    id: 'honor-magic-6-pro',
    brand: 'Honor',
    modelName: 'Honor Magic 6 Pro (BVL-AN16)',
    modelCode: 'BVL-AN16',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 3 (Adreno 750)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 750',
    screenWidth: 412,
    screenHeight: 915,
    dpr: 3.5,
    cores: 8,
    memory: 12
  },
  {
    id: 'honor-magic-v2',
    brand: 'Honor',
    modelName: 'Honor Magic V2 (VER-AN10)',
    modelCode: 'VER-AN10',
    androidVersion: '14',
    cpu: 'Snapdragon 8 Gen 2 (Adreno 740)',
    gpuVendor: 'Qualcomm',
    gpuRenderer: 'Adreno (TM) 740',
    screenWidth: 820,
    screenHeight: 880,
    dpr: 2.5,
    cores: 8,
    memory: 16
  }
]

export const ANDROID_BRANDS = Array.from(new Set(ANDROID_DEVICES.map(d => d.brand)))

export function getDevicesByBrand(brand: string): AndroidDeviceSpec[] {
  return ANDROID_DEVICES.filter(d => d.brand.toLowerCase() === brand.toLowerCase())
}

export function getDeviceById(idOrCode: string): AndroidDeviceSpec | undefined {
  return ANDROID_DEVICES.find(d => d.id === idOrCode || d.modelCode === idOrCode || d.modelName === idOrCode)
}
export const getAndroidDeviceById = getDeviceById

export function generateAndroidUserAgent(device: AndroidDeviceSpec, browser: 'chrome' | 'firefox' = 'chrome', version = '128.0.0.0'): string {
  if (browser === 'firefox') {
    const ffVer = version.includes('.') ? version : `${version}.0`
    return `Mozilla/5.0 (Android ${device.androidVersion}; Mobile; rv:${ffVer}) Gecko/${ffVer} Firefox/${ffVer}`
  }
  return `Mozilla/5.0 (Linux; Android ${device.androidVersion}; ${device.modelCode}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`
}
