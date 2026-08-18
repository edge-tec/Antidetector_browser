// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests for Standalone Runtime Provisioner
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  getSystemInfo,
  getBrowserRuntimesBaseDir,
  getDownloadsDir,
  getEngineInstallDir,
  getChromiumArtifactInfo,
  getFirefoxArtifactInfo,
  getRuntimeDetails,
  verifyManagedExecutable
} from '../../src/main/browser/runtime-provisioner'

describe('Native Runtime Provisioner & Download Manager', () => {
  it('correctly detects host system platform and architecture', () => {
    const sys = getSystemInfo()
    expect(['windows', 'macos', 'linux']).toContain(sys.platform)
    expect(['x64', 'arm64', 'x86']).toContain(sys.arch)
    expect(sys.osKey).toBeDefined()
  })

  it('creates dedicated browser-runtimes and downloads directory hierarchy', () => {
    const runtimesDir = getBrowserRuntimesBaseDir()
    const downloadsDir = getDownloadsDir()
    const chromeDir = getEngineInstallDir('chromium')
    const firefoxDir = getEngineInstallDir('firefox')

    expect(fs.existsSync(runtimesDir)).toBe(true)
    expect(fs.existsSync(downloadsDir)).toBe(true)
    expect(fs.existsSync(chromeDir)).toBe(true)
    expect(fs.existsSync(firefoxDir)).toBe(true)

    expect(chromeDir).toContain('chromium')
    expect(firefoxDir).toContain('firefox')
  })

  it('generates valid official Google and Mozilla download URLs', () => {
    const chromeInfo = getChromiumArtifactInfo()
    const firefoxInfo = getFirefoxArtifactInfo()

    expect(chromeInfo.downloadUrl).toContain('commondatastorage.googleapis.com/chromium-browser-snapshots')
    expect(chromeInfo.fileName).toContain('.zip')

    expect(firefoxInfo.downloadUrl).toContain('ftp.mozilla.org/pub/firefox/releases')
    expect(firefoxInfo.fileName).toMatch(/\.(dmg|zip|tar\.bz2)$/)
  })

  it('returns structured runtime details for Chromium and Firefox', () => {
    const chromeDetails = getRuntimeDetails('chromium')
    const firefoxDetails = getRuntimeDetails('firefox')

    expect(chromeDetails.engine).toBe('chromium')
    expect(chromeDetails.name).toBe('Google Chromium')
    expect(chromeDetails.version).toBeDefined()
    expect(chromeDetails.installDir).toBeDefined()
    expect(chromeDetails.installed).toBeTypeOf('boolean')

    expect(firefoxDetails.engine).toBe('firefox')
    expect(firefoxDetails.name).toBe('Mozilla Firefox')
    expect(firefoxDetails.version).toBeDefined()
    expect(firefoxDetails.installDir).toBeDefined()
    expect(firefoxDetails.installed).toBeTypeOf('boolean')
  })

  it('handles verification of missing files gracefully without throwing', () => {
    const result = verifyManagedExecutable('/non/existent/path/to/browser')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('does not exist')
  })
})
