// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Comprehensive Unit Tests: Firefox Profile Runtime Resolution
// Tests OS configuration, browser version matching, device display consistency,
// profile switching isolation, and truthful host-controlled diagnostics.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { Profile } from '../../src/main/database/models'
import {
  resolveFirefoxProfile,
  BrowserVersionResolver,
  UserAgentResolver,
  DeviceDisplayResolver,
  HardwareCoherenceResolver
} from '../../src/main/browser/firefox/firefox-resolver'
import {
  FirefoxRuntimeDiagnostics,
  validateFirefoxProfile
} from '../../src/main/browser/firefox/firefox-diagnostics'
import { installFirefoxRuntimeExtension } from '../../src/main/browser/firefox/firefox-extension-builder'
import { ensureFirefoxProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('Firefox Profile Runtime Resolution & Anti-Detect Isolation System', () => {

  // ─────────────────────────────────────────────────────────────
  // Test A: OS Configuration & Platform Propagation
  // ─────────────────────────────────────────────────────────────
  describe('Test A — OS Configuration & Platform Propagation', () => {
    it('resolves Windows 10/11 configuration with compliant Win32 platform, OSCPU, and User-Agent', () => {
      const profile: Profile = {
        id: 'test-win-ff-profile',
        userId: 'user-1',
        name: 'Windows 11 Firefox Profile',
        groupId: null,
        notes: null,
        color: '#3B82F6',
        icon: 'firefox',
        osType: 'windows-11',
        browserType: 'firefox',
        browserVersion: '129.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({
          osType: 'windows-11',
          browser: { type: 'firefox', version: '129.0' }
        }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const resolved = resolveFirefoxProfile(profile)

      expect(resolved.operatingSystem).toBe('windows')
      expect(resolved.platform).toBe('Win32')
      expect(resolved.oscpu).toBe('Windows NT 10.0; Win64; x64')
      expect(resolved.userAgent).toContain('Windows NT 10.0; Win64; x64; rv:129.0')
      expect(resolved.userAgent).toContain('Gecko/20100101 Firefox/129.0')
      expect(resolved.appVersion).toBe('5.0 (Windows)')
      expect(resolved.isEmulatedAtRuntime).toBe(true)
    })

    it('resolves macOS configuration with compliant MacIntel platform and Intel Mac OS X OSCPU', () => {
      const profile: Profile = {
        id: 'test-mac-ff-profile',
        userId: 'user-1',
        name: 'macOS Firefox Profile',
        groupId: null,
        notes: null,
        color: '#10B981',
        icon: 'firefox',
        osType: 'macos-arm',
        browserType: 'firefox',
        browserVersion: '131.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({
          osType: 'macos-arm',
          browser: { type: 'firefox', version: '131.0' }
        }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const resolved = resolveFirefoxProfile(profile)

      expect(resolved.operatingSystem).toBe('macos')
      expect(resolved.platform).toBe('MacIntel')
      expect(resolved.oscpu).toBe('Intel Mac OS X 10.15')
      expect(resolved.userAgent).toContain('Macintosh; Intel Mac OS X 10.15; rv:131.0')
      expect(resolved.appVersion).toBe('5.0 (Macintosh)')
    })

    it('resolves Linux configuration with Linux x86_64 platform and OSCPU', () => {
      const profile: Profile = {
        id: 'test-linux-ff-profile',
        userId: 'user-1',
        name: 'Linux Firefox Profile',
        groupId: null,
        notes: null,
        color: '#EF4444',
        icon: 'firefox',
        osType: 'linux',
        browserType: 'firefox',
        browserVersion: '128.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({
          osType: 'linux',
          browser: { type: 'firefox', version: '128.0' }
        }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const resolved = resolveFirefoxProfile(profile)

      expect(resolved.operatingSystem).toBe('linux')
      expect(resolved.platform).toBe('Linux x86_64')
      expect(resolved.oscpu).toBe('Linux x86_64')
      expect(resolved.userAgent).toContain('X11; Linux x86_64; rv:128.0')
      expect(resolved.appVersion).toBe('5.0 (X11)')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test B: Browser Version & Binary Verification
  // ─────────────────────────────────────────────────────────────
  describe('Test B — Browser Version & Binary Verification', () => {
    it('verifies exact match when configured version equals runtime binary', () => {
      const res = BrowserVersionResolver.resolveVersion('131.0', '131.0.2')
      expect(res.status).toBe('PASS')
      expect(res.isExactMatch).toBe(true)
      expect(res.version).toBe('131.0')
    })

    it('flags MISMATCH if configured version differs in major version from binary', () => {
      const res = BrowserVersionResolver.resolveVersion('120.0', '131.0')
      expect(res.status).toBe('MISMATCH')
      expect(res.isExactMatch).toBe(false)
      expect(res.message).toContain('differs from installed runtime binary')
    })

    it('guarantees User-Agent version strictly matches resolved browser version', () => {
      const ua = UserAgentResolver.resolve('windows-10', '129.0', 'Win32')
      expect(ua.userAgent).toContain('rv:129.0')
      expect(ua.userAgent).toContain('Firefox/129.0')
      expect(ua.userAgent).not.toContain('Firefox/131.0')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test C: Device & Display Consistency (Mobile vs Desktop)
  // ─────────────────────────────────────────────────────────────
  describe('Test C — Device & Display Consistency', () => {
    it('resolves authentic iPhone display and touch parameters without desktop defaults', () => {
      const display = DeviceDisplayResolver.resolve('ios', undefined, 'iphone-16-pro-max')
      expect(display.screenWidth).toBe(440)
      expect(display.screenHeight).toBe(956)
      expect(display.devicePixelRatio).toBe(3)
      expect(display.touchSupport).toBe(true)
      expect(display.maxTouchPoints).toBe(5)
      expect(display.orientation).toBe('portrait-primary')
    })

    it('resolves authentic Android display and touch parameters', () => {
      const display = DeviceDisplayResolver.resolve('android', undefined, 'samsung-s24-ultra')
      expect(display.screenWidth).toBe(412)
      expect(display.screenHeight).toBe(915)
      expect(display.devicePixelRatio).toBe(3.5)
      expect(display.touchSupport).toBe(true)
      expect(display.maxTouchPoints).toBe(5)
    })

    it('resolves desktop display without touch support and landscape orientation', () => {
      const display = DeviceDisplayResolver.resolve('windows-10', { width: 1920, height: 1080, devicePixelRatio: 1 })
      expect(display.screenWidth).toBe(1920)
      expect(display.screenHeight).toBe(1080)
      expect(display.devicePixelRatio).toBe(1)
      expect(display.touchSupport).toBe(false)
      expect(display.maxTouchPoints).toBe(0)
      expect(display.orientation).toBe('landscape-primary')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test D: Profile Switching & Stale State Isolation
  // ─────────────────────────────────────────────────────────────
  describe('Test D — Profile Switching & Stale State Isolation', () => {
    const profileAId = 'test-profile-a-desktop'
    const profileBId = 'test-profile-b-mobile'

    afterEach(() => {
      deleteProfileDataDir(profileAId)
      deleteProfileDataDir(profileBId)
    })

    it('ensures separate profile directories with isolated extensions and clean state', () => {
      const dirA = ensureFirefoxProfileDataDir(profileAId)
      const dirB = ensureFirefoxProfileDataDir(profileBId)

      expect(dirA).not.toBe(dirB)
      expect(fs.existsSync(dirA)).toBe(true)
      expect(fs.existsSync(dirB)).toBe(true)

      const profileA: Profile = {
        id: profileAId,
        userId: 'user-1',
        name: 'Profile A Desktop',
        groupId: null,
        notes: null,
        color: '#3B82F6',
        icon: 'firefox',
        osType: 'windows-10',
        browserType: 'firefox',
        browserVersion: '131.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({ osType: 'windows-10' }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const profileB: Profile = {
        id: profileBId,
        userId: 'user-1',
        name: 'Profile B Mobile',
        groupId: null,
        notes: null,
        color: '#10B981',
        icon: 'firefox',
        osType: 'ios',
        browserType: 'firefox',
        browserVersion: '131.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({ osType: 'ios', deviceModelId: 'iphone-16-pro-max' }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const resolvedA = resolveFirefoxProfile(profileA)
      const resolvedB = resolveFirefoxProfile(profileB)

      // Install runtime extensions
      const extDirA = installFirefoxRuntimeExtension(dirA, resolvedA)
      const extDirB = installFirefoxRuntimeExtension(dirB, resolvedB)

      expect(fs.existsSync(path.join(extDirA, 'manifest.json'))).toBe(true)
      expect(fs.existsSync(path.join(extDirB, 'manifest.json'))).toBe(true)

      const contentA = fs.readFileSync(path.join(extDirA, 'content-bridge.js'), 'utf8')
      const contentB = fs.readFileSync(path.join(extDirB, 'content-bridge.js'), 'utf8')

      // Verify Profile A content has Windows platform and Profile B has iPhone
      expect(contentA).toContain('Win32')
      expect(contentB).toContain('iPhone')
      expect(contentB).not.toContain('Win32')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test E: Truthful Diagnostics & Host-Controlled Property Detection
  // ─────────────────────────────────────────────────────────────
  describe('Test E — Truthful Diagnostics & Host-Controlled Detection', () => {
    it('correctly reports HOST-CONTROLLED for mobile hardware emulation on desktop host', () => {
      const profile: Profile = {
        id: 'test-mobile-diag-profile',
        userId: 'user-1',
        name: 'iPhone Mobile Diagnostic',
        groupId: null,
        notes: null,
        color: '#F59E0B',
        icon: 'firefox',
        osType: 'ios',
        browserType: 'firefox',
        browserVersion: '131.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({ osType: 'ios', deviceModelId: 'iphone-16-pro' }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const result = validateFirefoxProfile(profile)

      expect(result.valid).toBe(true)
      expect(result.hostControlled.length).toBeGreaterThan(0)
      
      const gpuDiag = result.diagnostics.find(d => d.field === 'WebGL Renderer')
      expect(gpuDiag?.status).toBe('HOST-CONTROLLED')
    })

    it('reports PASS status for fully coherent desktop profile configuration', () => {
      const profile: Profile = {
        id: 'test-desktop-diag-profile',
        userId: 'user-1',
        name: 'Desktop Win Diagnostic',
        groupId: null,
        notes: null,
        color: '#3B82F6',
        icon: 'firefox',
        osType: 'windows-10',
        browserType: 'firefox',
        browserVersion: '131.0',
        webrtcMode: 'altered',
        fingerprint: JSON.stringify({ osType: 'windows-10' }),
        proxyId: null,
        status: 'ready',
        lastLaunchedAt: null,
        totalLaunchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const result = validateFirefoxProfile(profile, '131.0')

      expect(result.valid).toBe(true)
      expect(result.status).toBe('PASS')
      expect(result.errors.length).toBe(0)
    })
  })
})
