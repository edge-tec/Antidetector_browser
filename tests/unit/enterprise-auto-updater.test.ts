// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Enterprise Auto-Update Engine & Platform Packages
// ──────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { compareSemver, UpdaterService, SoftwareVersionRecord } from '../../src/main/services/updater.service'
import { getDatabase, initDatabase } from '../../src/main/database/connection'

describe('Enterprise Auto-Update Engine Tests', () => {
  beforeEach(() => {
    initDatabase()
  })

  describe('Semver Comparison Suite', () => {
    it('accurately identifies newer versions', () => {
      expect(compareSemver('2.5.0', '2.4.9')).toBe(1)
      expect(compareSemver('2.10.0', '2.9.0')).toBe(1)
      expect(compareSemver('3.0.0-beta.1', '2.9.9')).toBe(1)
      expect(compareSemver('v2.0.1', '2.0.0')).toBe(1)
    })

    it('accurately identifies older versions', () => {
      expect(compareSemver('1.9.9', '2.0.0')).toBe(-1)
      expect(compareSemver('2.4.9', '2.5.0')).toBe(-1)
    })

    it('accurately identifies identical versions', () => {
      expect(compareSemver('2.5.0', '2.5.0')).toBe(0)
      expect(compareSemver('v2.5.0', '2.5.0')).toBe(0)
    })
  })

  describe('Multi-Platform Binary Resolution', () => {
    const mockRelease: SoftwareVersionRecord = {
      id: 'ver_2_5_0',
      version: '2.5.0',
      build: '250',
      channel: 'stable',
      release_title: 'AntiProfiles Enterprise v2.5.0',
      release_notes: '• Security enhancements\n• Proxy speed optimization',
      status: 'published',
      min_supported_version: '2.0.0',
      mandatory: 1,
      force_update: 1,
      win_download_url: 'https://releases.antiprofiles.com/AntiProfiles-Setup-2.5.0.exe',
      win_file_size: 118000000,
      win_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      mac_arm_download_url: 'https://releases.antiprofiles.com/AntiProfiles-2.5.0-arm64.dmg',
      mac_arm_file_size: 113000000,
      mac_arm_sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      mac_intel_download_url: 'https://releases.antiprofiles.com/AntiProfiles-2.5.0-x64.dmg',
      mac_intel_file_size: 118000000,
      mac_intel_sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      linux_download_url: 'https://releases.antiprofiles.com/AntiProfiles-2.5.0.AppImage',
      linux_file_size: 123000000,
      linux_sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      signature: 'DIGITAL_SIG_MOCK_XYZ',
      published_at: new Date().toISOString()
    }

    it('resolves Windows x64 package details', () => {
      const updater = UpdaterService.getInstance()
      const pkg = updater.getPackageInfoForPlatform(mockRelease, 'windows-x64')
      expect(pkg.platformKey).toBe('windows-x64')
      expect(pkg.downloadUrl).toBe(mockRelease.win_download_url)
      expect(pkg.sha256).toBe(mockRelease.win_sha256)
      expect(pkg.filename).toBe('AntiProfiles-Setup-2.5.0.exe')
    })

    it('resolves macOS Apple Silicon (ARM64) package details', () => {
      const updater = UpdaterService.getInstance()
      const pkg = updater.getPackageInfoForPlatform(mockRelease, 'macos-arm64')
      expect(pkg.platformKey).toBe('macos-arm64')
      expect(pkg.downloadUrl).toBe(mockRelease.mac_arm_download_url)
      expect(pkg.sha256).toBe(mockRelease.mac_arm_sha256)
      expect(pkg.filename).toBe('AntiProfiles-2.5.0-arm64.dmg')
    })

    it('resolves macOS Intel (x64) package details', () => {
      const updater = UpdaterService.getInstance()
      const pkg = updater.getPackageInfoForPlatform(mockRelease, 'macos-x64')
      expect(pkg.platformKey).toBe('macos-x64')
      expect(pkg.downloadUrl).toBe(mockRelease.mac_intel_download_url)
      expect(pkg.sha256).toBe(mockRelease.mac_intel_sha256)
      expect(pkg.filename).toBe('AntiProfiles-2.5.0-x64.dmg')
    })

    it('resolves Linux x64 package details', () => {
      const updater = UpdaterService.getInstance()
      const pkg = updater.getPackageInfoForPlatform(mockRelease, 'linux-x64')
      expect(pkg.platformKey).toBe('linux-x64')
      expect(pkg.downloadUrl).toBe(mockRelease.linux_download_url)
      expect(pkg.sha256).toBe(mockRelease.linux_sha256)
      expect(pkg.filename).toBe('AntiProfiles-2.5.0.AppImage')
    })
  })

  describe('Update Settings Management', () => {
    it('manages update channel and auto-download settings', () => {
      const updater = UpdaterService.getInstance()
      const initial = updater.getUpdateSettings()
      expect(initial.channel).toBeDefined()
      expect(initial.check_frequency_hours).toBeGreaterThanOrEqual(1)

      const updated = updater.saveUpdateSettings({
        channel: 'beta',
        auto_download: true,
        check_frequency_hours: 12
      })

      expect(updated.channel).toBe('beta')
      expect(updated.auto_download).toBe(true)
      expect(updated.check_frequency_hours).toBe(12)
    })
  })

  describe('Version Management & Rollback Lifecycle', () => {
    it('saves draft version and publishes it', () => {
      const updater = UpdaterService.getInstance()
      const saved = updater.saveVersion({
        version: '3.1.0',
        build: '310',
        channel: 'stable',
        release_title: 'AntiProfiles v3.1.0 Release',
        release_notes: 'Major Release',
        status: 'draft',
        win_download_url: 'https://dl.antiprofiles.com/win.exe'
      })

      expect(saved.version).toBe('3.1.0')
      expect(saved.status).toBe('draft')

      const published = updater.publishVersion(saved.id)
      expect(published.status).toBe('published')
      expect(published.published_at).toBeDefined()
    })

    it('supports version rollback to previous stable release', () => {
      const updater = UpdaterService.getInstance()
      const v1 = updater.saveVersion({
        version: '2.0.0',
        release_title: 'v2.0.0 Stable',
        release_notes: 'Stable base',
        status: 'published'
      })

      const v2 = updater.saveVersion({
        version: '2.1.0',
        release_title: 'v2.1.0 Faulty',
        release_notes: 'Has bug',
        status: 'published'
      })

      const rollbackRes = updater.rollbackVersion(v2.id)
      expect(rollbackRes.success).toBe(true)
      expect(rollbackRes.rolledBackTo).toBeDefined()

      const currentLatest = updater.getVersionById(v2.id)
      expect(currentLatest?.status).toBe('disabled')
    })
  })
})
