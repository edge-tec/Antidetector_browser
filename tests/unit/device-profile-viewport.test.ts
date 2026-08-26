// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Device Profile Viewport & Window Sizing
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { buildScreenScript } from '../../src/main/browser/injection/scripts/screen'
import { buildNavigatorScript } from '../../src/main/browser/injection/scripts/navigator'
import { ScreenFingerprint, NavigatorFingerprint } from '../../src/fingerprint/types'

describe('Device Profile Viewport & Window Sizing Integrity', () => {

  // 1. Windows Profile
  describe('Windows Profile', () => {
    const screen: ScreenFingerprint = {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: 'landscape-primary',
      orientationAngle: 0
    }
    const nav: NavigatorFingerprint = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      vendorSub: '',
      product: 'Gecko',
      productSub: '20030107',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0,
      doNotTrack: null,
      languages: ['en-US', 'en'],
      touchSupport: false
    }

    it('injects accurate Windows screen dimensions and DPR', () => {
      const script = buildScreenScript(screen)
      expect(script).toContain('width: 1920')
      expect(script).toContain('height: 1080')
      expect(script).toContain('devicePixelRatio\', {\n      get: function() { return 1; }')
      expect(script).toContain('outerWidth\', {\n      get: function() { return 1920; }')
      expect(script).toContain('outerHeight\', {\n      get: function() { return 1080; }')
    })

    it('injects Win32 platform with zero touch points', () => {
      const script = buildNavigatorScript(nav, 'chrome')
      expect(script).toContain('platform: "Win32"')
      expect(script).toContain('maxTouchPoints: 0')
    })
  })

  // 2. macOS Profile
  describe('macOS Profile', () => {
    const screen: ScreenFingerprint = {
      width: 1512,
      height: 982,
      availWidth: 1512,
      availHeight: 942,
      devicePixelRatio: 2,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: 'landscape-primary',
      orientationAngle: 0
    }
    const nav: NavigatorFingerprint = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      vendorSub: '',
      product: 'Gecko',
      productSub: '20030107',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      hardwareConcurrency: 10,
      deviceMemory: 16,
      maxTouchPoints: 0,
      doNotTrack: null,
      languages: ['en-US', 'en'],
      touchSupport: false
    }

    it('injects macOS Retina screen dimensions and DPR 2', () => {
      const script = buildScreenScript(screen)
      expect(script).toContain('width: 1512')
      expect(script).toContain('height: 982')
      expect(script).toContain('devicePixelRatio\', {\n      get: function() { return 2; }')
    })

    it('injects MacIntel platform without touch points', () => {
      const script = buildNavigatorScript(nav, 'chrome')
      expect(script).toContain('platform: "MacIntel"')
      expect(script).toContain('maxTouchPoints: 0')
    })
  })

  // 3. Linux Profile
  describe('Linux Profile', () => {
    const screen: ScreenFingerprint = {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: 'landscape-primary',
      orientationAngle: 0
    }
    const nav: NavigatorFingerprint = {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      platform: 'Linux x86_64',
      vendor: 'Google Inc.',
      vendorSub: '',
      product: 'Gecko',
      productSub: '20030107',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0,
      doNotTrack: null,
      languages: ['en-US', 'en'],
      touchSupport: false
    }

    it('injects Linux screen dimensions', () => {
      const script = buildScreenScript(screen)
      expect(script).toContain('width: 1920')
      expect(script).toContain('height: 1080')
    })

    it('injects Linux x86_64 platform', () => {
      const script = buildNavigatorScript(nav, 'chrome')
      expect(script).toContain('platform: "Linux x86_64"')
      expect(script).toContain('maxTouchPoints: 0')
    })
  })

  // 4. Android Profile
  describe('Android Profile', () => {
    const screen: ScreenFingerprint = {
      width: 1080,
      height: 2400,
      availWidth: 1080,
      availHeight: 2400,
      devicePixelRatio: 2.625,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: 'portrait-primary',
      orientationAngle: 0
    }
    const nav: NavigatorFingerprint = {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      vendorSub: '',
      product: 'Gecko',
      productSub: '20030107',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 12,
      maxTouchPoints: 5,
      doNotTrack: null,
      languages: ['en-US', 'en'],
      touchSupport: true
    }

    it('injects Android screen resolution and DPR', () => {
      const script = buildScreenScript(screen)
      expect(script).toContain('width: 1080')
      expect(script).toContain('height: 2400')
      expect(script).toContain('devicePixelRatio\', {\n      get: function() { return 2.625; }')
      expect(script).toContain('portrait-primary')
    })

    it('enables touch points and mobile platform for Android', () => {
      const script = buildNavigatorScript(nav, 'chrome')
      expect(script).toContain('platform: "Linux armv8l"')
      expect(script).toContain('maxTouchPoints: 5')
    })
  })

  // 5. iPhone / iOS Profile
  describe('iPhone / iOS Profile', () => {
    const screen: ScreenFingerprint = {
      width: 393,
      height: 852,
      availWidth: 393,
      availHeight: 852,
      devicePixelRatio: 3,
      colorDepth: 32,
      pixelDepth: 32,
      orientation: 'portrait-primary',
      orientationAngle: 0
    }
    const nav: NavigatorFingerprint = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      vendorSub: '',
      product: 'Gecko',
      productSub: '20030107',
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1',
      hardwareConcurrency: 6,
      deviceMemory: 8,
      maxTouchPoints: 5,
      doNotTrack: null,
      languages: ['en-US', 'en'],
      touchSupport: true
    }

    it('injects iPhone screen resolution and DPR 3', () => {
      const script = buildScreenScript(screen)
      expect(script).toContain('width: 393')
      expect(script).toContain('height: 852')
      expect(script).toContain('devicePixelRatio\', {\n      get: function() { return 3; }')
      expect(script).toContain('colorDepth: 32')
    })

    it('enables touch points and iPhone platform for iOS', () => {
      const script = buildNavigatorScript(nav, 'chrome')
      expect(script).toContain('platform: "iPhone"')
      expect(script).toContain('maxTouchPoints: 5')
    })
  })
})
