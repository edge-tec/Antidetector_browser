// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Managed Firefox Runtime & Profile Isolation
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getFirefoxPlatformArtifactInfo, getManagedFirefoxDir } from '../../src/main/browser/firefox-downloader'
import { ensureFirefoxProfileDataDir, getFirefoxProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('Managed Firefox Runtime & Profile Isolation Architecture', () => {
  describe('1. Standalone Firefox Runtime Configuration', () => {
    it('determines valid official Mozilla download artifact info', () => {
      const info = getFirefoxPlatformArtifactInfo()
      expect(info.fileName).toBeTruthy()
      expect(info.downloadUrl).toContain('https://ftp.mozilla.org/pub/firefox/releases/')
      expect(info.executableRelativePath).toBeTruthy()
      expect(info.platformKey).toBeTruthy()
    })

    it('creates dedicated isolated managed-firefox directory', () => {
      const dir = getManagedFirefoxDir()
      expect(dir).toContain('managed-firefox')
      expect(fs.existsSync(dir)).toBe(true)
    })
  })

  describe('2. Firefox Profile Directory Isolation & Auto-Recovery', () => {
    const testProfileId = 'test-ff-isolated-profile-123'

    it('creates and returns dedicated firefox-profile directory', () => {
      const dir = ensureFirefoxProfileDataDir(testProfileId)
      expect(dir).toContain('firefox-profile')
      expect(fs.existsSync(dir)).toBe(true)
    })

    it('isolates Firefox profile from standard Chromium browser-data', () => {
      const ffDir = getFirefoxProfileDataDir(testProfileId)
      expect(ffDir).not.toContain('browser-data')
      expect(ffDir).toContain('firefox-profile')
    })

    it('properly cleans up profile directories without lingering locks', () => {
      const ffDir = ensureFirefoxProfileDataDir(testProfileId)
      // Simulate dummy lock file
      const lockPath = path.join(ffDir, 'parent.lock')
      fs.writeFileSync(lockPath, 'dummy-lock')
      expect(fs.existsSync(lockPath)).toBe(true)

      // Delete profile data
      deleteProfileDataDir(testProfileId)
      expect(fs.existsSync(lockPath)).toBe(false)
      expect(fs.existsSync(ffDir)).toBe(false)
    })
  })
})
