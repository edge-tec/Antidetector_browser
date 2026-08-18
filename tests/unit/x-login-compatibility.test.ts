// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: X (Twitter) Login & Browser Standards Compatibility
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { getPlatformArtifactInfo, getManagedRuntimeDir } from '../../src/main/browser/chromium-downloader'

describe('X (Twitter) & Standards-Compliant Browser Compatibility Tests', () => {
  describe('1. Navigator Environment & Plugins Support', () => {
    it('generates standard desktop plugins and mimeTypes in injection script', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('PluginArray')
      expect(script).toContain('MimeTypeArray')
      expect(script).toContain('PDF Viewer')
      expect(script).toContain('Chrome PDF Viewer')
      expect(script).toContain('application/pdf')
    })

    it('ensures modern clean window.chrome without obsolete loadTimes/csi triggers', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('window.chrome')
      expect(script).toContain('app')
      // Obsolete methods must NOT be injected
      expect(script).not.toContain('loadTimes')
      expect(script).not.toContain('csi')
    })

    it('ensures navigator.webdriver is cleanly false', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('webdriver')
      expect(script).toContain('return false')
    })
  })

  describe('2. WebGL & Typography (Fonts) Integrity', () => {
    it('does not corrupt WebGL parameters or getExtension', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('UNMASKED_VENDOR')
      expect(script).toContain('UNMASKED_RENDERER')
    })

    it('does not block site webfonts (like TwitterChirp)', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('document.fonts.check')
    })
  })

  describe('3. Managed Standalone Chromium Runtime', () => {
    it('determines correct platform artifact info for independent runtime download', () => {
      const info = getPlatformArtifactInfo()
      expect(info.zipName).toBeTruthy()
      expect(info.executableRelativePath).toBeTruthy()
      expect(info.platformKey).toBeTruthy()
    })

    it('creates dedicated isolated managed-chromium directory', () => {
      const dir = getManagedRuntimeDir()
      expect(dir).toContain('managed-chromium')
    })
  })

  describe('4. Client Hints & Network Information', () => {
    it('ensures clean navigator properties and hardware concurrency', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('hardwareConcurrency')
      expect(script).toContain('deviceMemory')
    })

    it('preserves NetworkInformation prototype safely', () => {
      const fp = generateFingerprint({ osType: 'windows-10' })
      const script = buildInjectionScript(fp)

      expect(script).toContain('NetworkInformation')
    })
  })
})
