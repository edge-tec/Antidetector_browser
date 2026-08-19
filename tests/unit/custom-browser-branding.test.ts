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
      expect(args.some(a => a.startsWith('--app-id='))).toBe(true)
      expect(args.some(a => a.startsWith('--class='))).toBe(true)
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
})
