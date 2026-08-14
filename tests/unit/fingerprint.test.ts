import { describe, it, expect } from 'vitest'
import { generateFingerprint, regenerateFingerprint, generateBulkFingerprints } from '../../src/main/fingerprint/generator'
import { validateConsistency, getStabilityWarnings } from '../../src/main/fingerprint/consistency'
import { OSType } from '../../src/main/fingerprint/types'

describe('Fingerprint Generator', () => {
  const osTypes: OSType[] = ['windows-10', 'windows-11', 'macos-intel', 'macos-arm', 'linux', 'android']

  it('generates complete, valid fingerprints for all OS types', () => {
    for (const os of osTypes) {
      const fp = generateFingerprint({ osType: os })

      expect(fp).toBeDefined()
      expect(fp.version).toBe(2)
      expect(fp.seed).toBeDefined()
      expect(fp.seed.length).toBeGreaterThan(0)

      // Navigator check
      expect(fp.navigator.userAgent).toBeDefined()
      expect(fp.navigator.userAgent.length).toBeGreaterThan(20)
      expect(fp.navigator.hardwareConcurrency).toBeGreaterThanOrEqual(2)
      expect(fp.navigator.deviceMemory).toBeGreaterThanOrEqual(2)
      expect(fp.navigator.webdriver).toBe(false)

      // Screen check
      expect(fp.screen.width).toBeGreaterThan(0)
      expect(fp.screen.height).toBeGreaterThan(0)
      expect(fp.screen.devicePixelRatio).toBeGreaterThan(0)

      // WebGL check
      expect(fp.webgl.enabled).toBe(true)
      expect(fp.webgl.unmaskedRenderer).toBeDefined()
      expect(fp.webgl.gpuVendor).toBeDefined()

      // Canvas / Audio / ClientRects noise seeds
      expect(fp.canvas.noiseSeed).toBeGreaterThan(0)
      expect(fp.audio.noiseSeed).toBeGreaterThan(0)
      expect(fp.clientRects.noiseSeed).toBeGreaterThan(0)

      // Fonts
      expect(fp.fonts.fontList.length).toBeGreaterThan(0)
    }
  })

  it('produces deterministic output when given identical seeds', () => {
    const seed = 'test-seed-12345'
    const fp1 = generateFingerprint({ osType: 'windows-10', seed })
    const fp2 = generateFingerprint({ osType: 'windows-10', seed })

    expect(fp1.navigator.userAgent).toBe(fp2.navigator.userAgent)
    expect(fp1.screen.width).toBe(fp2.screen.width)
    expect(fp1.webgl.unmaskedRenderer).toBe(fp2.webgl.unmaskedRenderer)
    expect(fp1.canvas.noiseSeed).toBe(fp2.canvas.noiseSeed)
    expect(fp1.audio.noiseSeed).toBe(fp2.audio.noiseSeed)
  });

  it('produces distinct output for different seeds', () => {
    const fp1 = generateFingerprint({ osType: 'windows-10', seed: 'seed-A' })
    const fp2 = generateFingerprint({ osType: 'windows-10', seed: 'seed-B' })

    expect(fp1.canvas.noiseSeed).not.toBe(fp2.canvas.noiseSeed)
    expect(fp1.audio.noiseSeed).not.toBe(fp2.audio.noiseSeed)
  })

  it('enforces Touch support strictly for Android', () => {
    const androidFp = generateFingerprint({ osType: 'android' })
    expect(androidFp.navigator.touchSupport).toBe(true)
    expect(androidFp.navigator.maxTouchPoints).toBeGreaterThan(0)

    const winFp = generateFingerprint({ osType: 'windows-10' })
    expect(winFp.navigator.touchSupport).toBe(false)
    expect(winFp.navigator.maxTouchPoints).toBe(0)
  })

  it('assigns OS-specific fonts for macOS and Windows profiles', () => {
    const macFp = generateFingerprint({ osType: 'macos-arm' })
    const winFp = generateFingerprint({ osType: 'windows-10' })

    expect(macFp.fonts.fontList.length).toBeGreaterThan(10)
    expect(winFp.fonts.fontList.length).toBeGreaterThan(10)
    // macOS should contain Apple font markers
    expect(macFp.fonts.fontList.some(f => f.includes('Apple') || f.includes('SF Pro') || f.includes('Helvetica'))).toBe(true)
    // Windows should contain Windows font markers
    expect(winFp.fonts.fontList.some(f => f.includes('Segoe') || f.includes('Arial') || f.includes('Calibri'))).toBe(true)
  })

  it('supports bulk creation', () => {
    const bulk = generateBulkFingerprints({ count: 5, osType: 'windows-10' })
    expect(bulk.length).toBe(5)
    // All seeds should be unique
    const seeds = new Set(bulk.map(b => b.seed))
    expect(seeds.size).toBe(5)
  })
})

describe('Consistency Engine', () => {
  it('gives high consistency score (90+) to freshly generated fingerprints', () => {
    const osTypes: OSType[] = ['windows-10', 'windows-11', 'macos-intel', 'macos-arm', 'linux', 'android']
    for (const os of osTypes) {
      const fp = generateFingerprint({ osType: os })
      const result = validateConsistency(fp, os)

      if (result.failures > 0) {
        console.log(`Failures for OS ${os}:`, result.checks.filter(c => c.status === 'fail'))
      }

      expect(result.score).toBeGreaterThanOrEqual(90)
      expect(result.failures).toBe(0)
    }
  })

  it('detects OS ↔ User-Agent mismatch and fails check', () => {
    const fp = generateFingerprint({ osType: 'windows-10' })
    // Corrupt the user agent to macOS
    fp.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0.0.0'

    const result = validateConsistency(fp, 'windows-10')
    expect(result.failures).toBeGreaterThan(0)
    const osUaCheck = result.checks.find(c => c.id === 'os-ua')
    expect(osUaCheck?.status).toBe('fail')
  })

  it('detects OS ↔ Platform mismatch', () => {
    const fp = generateFingerprint({ osType: 'windows-10' })
    fp.navigator.platform = 'MacIntel'

    const result = validateConsistency(fp, 'windows-10')
    const platformCheck = result.checks.find(c => c.id === 'os-platform')
    expect(platformCheck?.status).toBe('fail')
  })

  it('emits stability warnings when modifying used profile core fields', () => {
    const fp1 = generateFingerprint({ osType: 'windows-10' })
    const fp2 = JSON.parse(JSON.stringify(fp1))

    // Changing User-Agent on used profile
    fp2.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0'

    const warnings = getStabilityWarnings(fp1, fp2, true)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some(w => w.field === 'User-Agent')).toBe(true)
    expect(warnings.some(w => w.level === 'danger')).toBe(true)
  })

  it('emits no stability warnings if profile has not been used yet', () => {
    const fp1 = generateFingerprint({ osType: 'windows-10' })
    const fp2 = JSON.parse(JSON.stringify(fp1))
    fp2.navigator.userAgent = 'Different UA'

    const warnings = getStabilityWarnings(fp1, fp2, false)
    expect(warnings.length).toBe(0)
  })
})
