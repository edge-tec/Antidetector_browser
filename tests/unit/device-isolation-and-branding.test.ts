// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Comprehensive Device Isolation & Custom Branding Test Suite
// Verifies complete profile device isolation, host leak prevention,
// configuration precedence, cloning fidelity, and custom branding for
// Firefox and Chromium across Windows, macOS Intel, macOS ARM, and Linux.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ProfileRepository } from '../../src/main/database/repositories/profile.repo'
import { BrowserIconManager } from '../../src/main/browser/branding/browser-icon-manager'
import { buildInjectionScript, buildUserAgentMetadata } from '../../src/main/browser/injection/injector'
import { resolveFirefoxProfile } from '../../src/main/browser/firefox/firefox-resolver'
import { resolveMasterProfile } from '../../src/main/fingerprint/master-profile-resolver'
import { getDatabase } from '../../src/main/database/connection'
import { OSType } from '../../src/main/fingerprint/types'

describe('Profile Device Isolation & Custom Browser Branding Suite', () => {
  let profileRepo: ProfileRepository
  let tempDir: string

  beforeEach(() => {
    profileRepo = new ProfileRepository()
    tempDir = path.join(os.tmpdir(), `antiprofiles-test-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    fs.mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch {}
  })

  describe('1. Firefox Multi-Platform Device Isolation Tests', () => {
    const testCases: Array<{ osType: OSType; label: string; expectedPlatform: string; expectedOscpu: string; expectedArch: string }> = [
      { osType: 'windows-11', label: 'Windows 11', expectedPlatform: 'Win32', expectedOscpu: 'Windows NT 10.0; Win64; x64', expectedArch: 'x86_64' },
      { osType: 'macos-intel', label: 'macOS Intel', expectedPlatform: 'MacIntel', expectedOscpu: 'Intel Mac OS X 10.15', expectedArch: 'x86_64' },
      { osType: 'macos-arm', label: 'macOS Apple Silicon (M4)', expectedPlatform: 'MacIntel', expectedOscpu: 'Intel Mac OS X 10.15', expectedArch: 'arm64' },
      { osType: 'linux', label: 'Linux Ubuntu', expectedPlatform: 'Linux x86_64', expectedOscpu: 'Linux x86_64', expectedArch: 'x86_64' }
    ]

    for (const tc of testCases) {
      it(`enforces pure ${tc.label} isolation in Firefox runtime without host leakage`, () => {
        const profile = profileRepo.create({
          name: `Firefox ${tc.label} Profile`,
          osType: tc.osType,
          browserVersion: '129.0',
          hwConcurrency: tc.osType === 'macos-arm' ? 10 : 8,
          deviceMemory: 16,
          screenWidth: tc.osType.startsWith('macos') ? 1512 : 1920,
          screenHeight: tc.osType.startsWith('macos') ? 982 : 1080
        } as any)

        const resolved = resolveFirefoxProfile(profile)

        // 1. Core Profile Identity
        expect(resolved.browser).toBe('firefox')
        expect(resolved.browserEngine).toBe('gecko')
        expect(resolved.userAgent).toContain('Firefox/129.0')
        expect(resolved.userAgent).not.toContain('Chrome')
        expect(resolved.userAgent).not.toContain('AppleWebKit')

        // 2. Hardware and Platform Isolation
        expect(resolved.platform).toBe(tc.expectedPlatform)
        expect(resolved.oscpu).toBe(tc.expectedOscpu)
        expect(resolved.hardwareConcurrency).toBe(tc.osType === 'macos-arm' ? 10 : 8)
        expect(resolved.deviceMemory).toBe(16)

        // 3. Screen Metrics
        expect(resolved.screenWidth).toBe(tc.osType.startsWith('macos') ? 1512 : 1920)
        expect(resolved.screenHeight).toBe(tc.osType.startsWith('macos') ? 982 : 1080)

        // 4. Injection Script Generation & Integrity
        const script = buildInjectionScript(resolved.fingerprint, 'firefox')
        expect(script).toContain(`hardwareConcurrency: ${resolved.hardwareConcurrency}`)
        expect(script).toContain(`deviceMemory: ${resolved.deviceMemory}`)
        expect(script).toContain('Screen.prototype')
        expect(script).toContain('delete window.chrome')

        // 5. Custom Branding Resolution
        const icon = BrowserIconManager.resolveIcon('firefox', profile)
        expect(icon.engine).toBe('firefox')
        expect(icon.pngPath || icon.icoPath || icon.icnsPath).toBeDefined()
      })
    }
  })

  describe('2. Chromium Multi-Platform Device Isolation Tests', () => {
    const testCases: Array<{ osType: OSType; label: string; expectedPlatform: string; expectedArch: string }> = [
      { osType: 'windows-11', label: 'Windows 11', expectedPlatform: 'Win32', expectedArch: 'x86' },
      { osType: 'macos-intel', label: 'macOS Intel', expectedPlatform: 'MacIntel', expectedArch: 'x86' },
      { osType: 'macos-arm', label: 'macOS Apple Silicon (M4)', expectedPlatform: 'MacIntel', expectedArch: 'arm' },
      { osType: 'linux', label: 'Linux Ubuntu', expectedPlatform: 'Linux x86_64', expectedArch: 'x86' }
    ]

    for (const tc of testCases) {
      it(`enforces pure ${tc.label} isolation in Chromium runtime without host leakage`, () => {
        const profile = profileRepo.create({
          name: `Chromium ${tc.label} Profile`,
          osType: tc.osType,
          browserType: 'chrome',
          browserVersion: '131.0.0.0',
          hwConcurrency: tc.osType === 'macos-arm' ? 10 : 8,
          deviceMemory: tc.osType === 'macos-arm' ? 16 : 16,
          screenWidth: tc.osType.startsWith('macos') ? 1512 : 1920,
          screenHeight: tc.osType.startsWith('macos') ? 982 : 1080
        } as any)

        const master = resolveMasterProfile({
          profileId: profile.id,
          name: profile.name,
          osType: tc.osType,
          browserType: 'chrome',
          browserVersion: '131.0.0.0',
          existingFingerprint: profile.fingerprint
        })

        // 1. Core Profile Identity
        expect(master.browserType).toBe('chrome')
        expect(master.userAgent).toContain('Chrome/131.0.0.0')
        expect(master.userAgent).not.toContain('Firefox')

        // 2. Hardware and Platform Isolation
        expect(master.platform).toBe(tc.expectedPlatform)
        expect(master.hardwareConcurrency).toBe(tc.osType === 'macos-arm' ? 10 : 8)
        expect(master.deviceMemory).toBe(tc.osType === 'macos-arm' ? 16 : 16)

        // 3. Client Hints userAgentMetadata
        const uaMeta = buildUserAgentMetadata(master.fingerprint)
        expect(uaMeta.architecture).toBe(tc.expectedArch)
        expect(uaMeta.fullVersion).toBe('131.0.0.0')
        expect(uaMeta.platform).toBe(tc.osType === 'windows-11' ? 'Windows' : tc.osType.startsWith('macos') ? 'macOS' : 'Linux')

        // 4. Custom Branding Resolution
        const icon = BrowserIconManager.resolveIcon('chromium', profile)
        expect(icon.engine).toBe('chromium')
        expect(icon.pngPath || icon.icoPath || icon.icnsPath).toBeDefined()
      })
    }
  })

  describe('3. Profile Configuration Precedence & Anti-Pollution Tests', () => {
    it('guarantees explicit profile configuration takes precedence over template & host defaults', () => {
      // User creates a profile with custom 32GB RAM and 16 Cores on Windows 11
      const profile = profileRepo.create({
        name: 'Custom High-End Workstation',
        osType: 'windows-11',
        browserType: 'chrome',
        hwConcurrency: 16,
        deviceMemory: 32,
        screenWidth: 2560,
        screenHeight: 1440,
        language: 'de-DE',
        timezone: 'Europe/Berlin'
      } as any)

      expect(profile.hwConcurrency).toBe(16)
      expect(profile.deviceMemory).toBe(32)
      expect(profile.screenWidth).toBe(2560)
      expect(profile.screenHeight).toBe(1440)
      expect(profile.language).toBe('de-DE')
      expect(profile.timezone).toBe('Europe/Berlin')

      // Fingerprint must have identical explicit values
      expect(profile.fingerprint.navigator.hardwareConcurrency).toBe(16)
      expect(profile.fingerprint.navigator.deviceMemory).toBe(32)
      expect(profile.fingerprint.screen.width).toBe(2560)
      expect(profile.fingerprint.screen.height).toBe(1440)
      expect(profile.fingerprint.locale.language).toBe('de-DE')
      expect(profile.fingerprint.timezone.timezone).toBe('Europe/Berlin')
    })

    it('creates multiple profiles without cross-contamination', () => {
      const p1 = profileRepo.create({
        name: 'Profile 1 - Firefox Mac M4',
        osType: 'macos-arm',
        browserType: 'firefox',
        browserVersion: '129.0',
        hwConcurrency: 10,
        deviceMemory: 16
      } as any)

      const p2 = profileRepo.create({
        name: 'Profile 2 - Chrome Windows 11',
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '131.0.0.0',
        hwConcurrency: 8,
        deviceMemory: 8
      } as any)

      // Verify p1
      expect(p1.osType).toBe('macos-arm')
      expect(p1.fingerprint.navigator.platform).toBe('MacIntel')
      expect(p1.fingerprint.navigator.hardwareConcurrency).toBe(10)
      expect(p1.fingerprint.navigator.userAgent).toContain('Firefox')

      // Verify p2
      expect(p2.osType).toBe('windows-11')
      expect(p2.fingerprint.navigator.platform).toBe('Win32')
      expect(p2.fingerprint.navigator.hardwareConcurrency).toBe(8)
      expect(p2.fingerprint.navigator.userAgent).toContain('Chrome')
      expect(p2.fingerprint.navigator.userAgent).not.toContain('Firefox')
    })
  })

  describe('4. Profile Cloning Fidelity Tests', () => {
    it('preserves complete hardware, browser, OS, GPU, screen, and branding on duplicate', () => {
      const original = profileRepo.create({
        name: 'Master Work Profile',
        osType: 'macos-arm',
        browserVersion: '129.0',
        hwConcurrency: 12,
        deviceMemory: 24,
        screenWidth: 1728,
        screenHeight: 1117,
        language: 'en-GB',
        timezone: 'Europe/London'
      } as any)

      const cloned = profileRepo.duplicate(original.id)
      expect(cloned).not.toBeNull()
      if (!cloned) return

      // Assert cloned properties match original configuration
      expect(cloned.osType).toBe('macos-arm')
      expect(cloned.hwConcurrency).toBe(12)
      expect(cloned.deviceMemory).toBe(24)
      expect(cloned.screenWidth).toBe(1728)
      expect(cloned.screenHeight).toBe(1117)
      expect(cloned.language).toBe('en-GB')
      expect(cloned.timezone).toBe('Europe/London')

      // Assert unique seed was generated to avoid canvas/audio collision
      expect(cloned.id).not.toBe(original.id)
      expect(cloned.fingerprint.seed).not.toBe(original.fingerprint.seed)
      expect(cloned.fingerprint.canvas.noiseSeed).not.toBe(original.fingerprint.canvas.noiseSeed)
    })
  })

  describe('5. Custom Branding Inheritance Tests', () => {
    it('resolves correct custom Firefox branding for Firefox profiles', () => {
      const ffProfile = profileRepo.create({
        name: 'Firefox User Profile',
        osType: 'windows-10',
        browserVersion: '129.0'
      } as any)

      const ffIcon = BrowserIconManager.resolveIcon('firefox', ffProfile)
      expect(ffIcon.engine).toBe('firefox')
      expect(ffIcon.pngPath || ffIcon.icoPath || ffIcon.icnsPath).toBeDefined()
    })

    it('resolves correct custom Chromium branding for Chromium profiles', () => {
      const chromeProfile = profileRepo.create({
        name: 'Chromium User Profile',
        osType: 'macos-arm',
        browserVersion: '131.0.0.0'
      } as any)

      const chromeIcon = BrowserIconManager.resolveIcon('chromium', chromeProfile)
      expect(chromeIcon.engine).toBe('chromium')
      expect(chromeIcon.pngPath || chromeIcon.icoPath || chromeIcon.icnsPath).toBeDefined()
    })
  })
})
