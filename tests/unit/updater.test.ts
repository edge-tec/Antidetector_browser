// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Updater Service & Version Controller
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { compareSemver, UpdaterService } from '../../src/main/services/updater.service'

describe('Software Updater & Version Management Tests', () => {
  describe('compareSemver Utility', () => {
    it('correctly compares greater versions', () => {
      expect(compareSemver('1.1.0', '1.0.0')).toBe(1)
      expect(compareSemver('2.0.0', '1.9.9')).toBe(1)
      expect(compareSemver('1.0.1', '1.0.0')).toBe(1)
      expect(compareSemver('v1.2.0', '1.1.9')).toBe(1)
      expect(compareSemver('1.10.0', '1.9.0')).toBe(1)
      expect(compareSemver('1.0.0.1', '1.0.0.0')).toBe(1)
    })

    it('correctly compares lesser versions', () => {
      expect(compareSemver('1.0.0', '1.1.0')).toBe(-1)
      expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
      expect(compareSemver('0.9.9', '1.0.0')).toBe(-1)
    })

    it('identifies equal versions', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
      expect(compareSemver('v1.0.0', '1.0.0')).toBe(0)
      expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
    })
  })

  describe('Platform & Package Resolution', () => {
    it('detects platform key', () => {
      const updater = UpdaterService.getInstance()
      const plat = updater.detectClientPlatform()
      expect(['windows-x64', 'macos-arm64', 'macos-x64', 'linux-x64']).toContain(plat.key)
      expect(plat.label).toBeDefined()
    })

    it('resolves correct platform binaries for a version', () => {
      const updater = UpdaterService.getInstance()
      const dummyVersion: any = {
        id: 'ver_2_0_0',
        version: '2.0.0',
        release_title: 'v2.0.0',
        release_notes: 'Notes',
        status: 'published',
        win_download_url: 'https://dl.antiprofiles.com/win.exe',
        win_file_size: 90000000,
        win_sha256: 'abc123win',
        mac_arm_download_url: 'https://dl.antiprofiles.com/mac-arm.dmg',
        mac_arm_file_size: 95000000,
        mac_arm_sha256: 'abc123arm',
        mac_intel_download_url: 'https://dl.antiprofiles.com/mac-x64.dmg',
        mac_intel_file_size: 96000000,
        mac_intel_sha256: 'abc123intel',
        linux_download_url: 'https://dl.antiprofiles.com/linux.AppImage',
        linux_file_size: 85000000,
        linux_sha256: 'abc123linux'
      }

      const winPkg = updater.getPackageInfoForPlatform(dummyVersion, 'windows-x64')
      expect(winPkg.downloadUrl).toBe('https://dl.antiprofiles.com/win.exe')
      expect(winPkg.sha256).toBe('abc123win')
      expect(winPkg.filename).toBe('AntiProfiles-Setup-2.0.0.exe')

      const macArmPkg = updater.getPackageInfoForPlatform(dummyVersion, 'macos-arm64')
      expect(macArmPkg.downloadUrl).toBe('https://dl.antiprofiles.com/mac-arm.dmg')
      expect(macArmPkg.sha256).toBe('abc123arm')
      expect(macArmPkg.filename).toBe('AntiProfiles-2.0.0-arm64.dmg')

      const linuxPkg = updater.getPackageInfoForPlatform(dummyVersion, 'linux-x64')
      expect(linuxPkg.downloadUrl).toBe('https://dl.antiprofiles.com/linux.AppImage')
      expect(linuxPkg.sha256).toBe('abc123linux')
      expect(linuxPkg.filename).toBe('AntiProfiles-2.0.0.AppImage')
    })
  })
})
