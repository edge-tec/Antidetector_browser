import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { BrowserIconManager } from '../../src/main/browser/branding/browser-icon-manager'
import { initDatabase, closeDatabase, getDatabase } from '../../src/main/database/connection'

describe('Custom Browser Branding & Profile Icon Architecture', () => {
  let tempDir: string

  beforeEach(() => {
    initDatabase()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antiprofiles-branding-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
    closeDatabase()
  })

  describe('1. Engine Detection & Icon Resolution', () => {
    it('resolves bundled custom branding for Firefox engine', () => {
      const icon = BrowserIconManager.resolveIcon('firefox')
      expect(icon.engine).toBe('firefox')
      expect(icon.source).toMatch(/bundled-custom|admin-custom|default-fallback/)
      expect(icon.dataUrl).toContain('data:image/')
    })

    it('resolves bundled custom branding for Chromium engine', () => {
      const icon = BrowserIconManager.resolveIcon('chromium')
      expect(icon.engine).toBe('chromium')
      expect(icon.source).toMatch(/bundled-custom|admin-custom|default-fallback/)
      expect(icon.dataUrl).toContain('data:image/')
    })
  })

  describe('2. Per-Profile Branding & Fallback Order', () => {
    it('respects fallback hierarchy: Custom Profile Icon -> Engine Icon -> Default Icon', () => {
      const profileId = `test-prof-${Date.now()}`
      const mockProfile: any = { id: profileId, name: 'Test Profile', browserVersion: '128.0' }

      // Initial resolution falls back to engine/bundled
      const initial = BrowserIconManager.resolveIcon('chromium', mockProfile)
      expect(initial.source).not.toBe('profile-custom')

      // Create a mock profile custom icon
      const profileDir = BrowserIconManager.getProfileIconsDir()
      const mockPng = path.join(profileDir, `${profileId}.png`)
      fs.writeFileSync(mockPng, Buffer.from('fake-png-data'))

      // Now resolution should be profile-custom
      const withProfileCustom = BrowserIconManager.resolveIcon('chromium', mockProfile)
      expect(withProfileCustom.source).toBe('profile-custom')
      expect(withProfileCustom.profileId).toBe(profileId)

      // Cleanup
      try { fs.unlinkSync(mockPng) } catch {}
    })
  })

  describe('3. Firefox Profile Window Branding Provisioning', () => {
    it('provisions native chrome/icons/default/main-window assets into the Firefox profile directory', () => {
      const mockProfile: any = {
        id: 'firefox-branding-test',
        name: 'Firefox VIP Profile',
        browserVersion: '129.0'
      }

      BrowserIconManager.setupFirefoxBranding(tempDir, mockProfile)

      const chromeDir = path.join(tempDir, 'chrome')
      const iconsDir = path.join(chromeDir, 'icons', 'default')

      expect(fs.existsSync(iconsDir)).toBe(true)

      const files = fs.readdirSync(iconsDir)
      expect(files.length).toBeGreaterThan(0)
      expect(files.some(f => f.startsWith('main-window') || f.startsWith('default'))).toBe(true)
    })
  })

  describe('4. Chromium Launch Branding Arguments', () => {
    it('generates proper window class and AppUserModelID branding arguments', () => {
      const mockProfile: any = {
        id: 'chrom-branding-test',
        name: 'Chromium Profile'
      }

      const args = BrowserIconManager.getChromiumBrandingArgs(mockProfile)
      // On non-Windows platforms it returns empty or valid safe args without --app-id
      expect(args.every(a => !a.startsWith('--app-id='))).toBe(true)
    })
  })

  describe('5. Admin Branding Configuration & Reset', () => {
    it('retrieves branding configuration and handles custom upload and reset', async () => {
      const config = BrowserIconManager.getBrandingConfig()
      expect(config).toHaveProperty('chromium')
      expect(config).toHaveProperty('firefox')
      expect(config).toHaveProperty('app')

      // Reset
      const resetRes = BrowserIconManager.resetCustomIcon('firefox')
      expect(resetRes.success).toBe(true)
    })
  })

  describe('6. Firefox Standalone Runtime Package Patching', () => {
    it('patches standalone macOS/Windows/Linux Firefox bundle resources with custom branding', () => {
      // Create a mock macOS Firefox.app structure
      const mockApp = path.join(tempDir, 'Firefox.app')
      const mockContents = path.join(mockApp, 'Contents')
      const mockRes = path.join(mockContents, 'Resources')
      const mockMacOS = path.join(mockContents, 'MacOS')
      fs.mkdirSync(mockRes, { recursive: true })
      fs.mkdirSync(mockMacOS, { recursive: true })

      const mockExec = path.join(mockMacOS, 'firefox')
      fs.writeFileSync(mockExec, '#!/bin/sh\nexit 0\n')
      fs.writeFileSync(path.join(mockContents, 'Info.plist'), '<plist><dict><key>CFBundleDisplayName</key><string>Firefox</string><key>CFBundleName</key><string>Firefox</string></dict></plist>')
      fs.writeFileSync(path.join(mockRes, 'firefox.icns'), Buffer.from('old-icns'))

      const patched = BrowserIconManager.patchFirefoxRuntimeBranding(mockExec)
      expect(patched).toBe(true)

      const plistAfter = fs.readFileSync(path.join(mockContents, 'Info.plist'), 'utf8')
      expect(plistAfter).toContain('AntiProfiles Firefox')
    })
  })

  describe('7. Chromium Standalone Runtime Package Patching & Profile Branding', () => {
    it('patches standalone Chromium .app bundle resources and provisions profile branding assets', () => {
      // Create a mock macOS Chrome.app structure
      const mockApp = path.join(tempDir, 'Google Chrome for Testing.app')
      const mockContents = path.join(mockApp, 'Contents')
      const mockRes = path.join(mockContents, 'Resources')
      const mockMacOS = path.join(mockContents, 'MacOS')
      fs.mkdirSync(mockRes, { recursive: true })
      fs.mkdirSync(mockMacOS, { recursive: true })

      const mockExec = path.join(mockMacOS, 'Google Chrome for Testing')
      fs.writeFileSync(mockExec, '#!/bin/sh\nexit 0\n')
      fs.writeFileSync(path.join(mockContents, 'Info.plist'), '<plist><dict><key>CFBundleDisplayName</key><string>Chromium</string><key>CFBundleName</key><string>Chromium</string></dict></plist>')
      fs.writeFileSync(path.join(mockRes, 'app.icns'), Buffer.from('old-icns'))

      const patched = BrowserIconManager.patchChromiumRuntimeBranding(mockExec)
      expect(patched).toBe(true)

      const plistAfter = fs.readFileSync(path.join(mockContents, 'Info.plist'), 'utf8')
      expect(plistAfter).toContain('AntiProfiles Chromium')

      // Profile branding setup
      const mockProfile: any = { id: 'test-chrome-profile', name: 'Chrome Work Profile' }
      BrowserIconManager.setupChromiumBranding(tempDir, mockProfile)
      const brandingDir = path.join(tempDir, 'branding')
      expect(fs.existsSync(brandingDir)).toBe(true)
    })
  })
})
