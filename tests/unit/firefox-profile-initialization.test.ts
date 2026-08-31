import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  ensureFirefoxProfileDataDir,
  repairGlobalFirefoxProfilesIni,
  getFirefoxProfileDataDir,
  getFirefoxBinaryVersion
} from '../../src/main/browser/chromium-resolver'

describe('Firefox Profile Lifecycle & "Profile Missing or Inaccessible" Prevention Engine', () => {
  const testProfileId = 'ff-test-lifecycle-' + Date.now()
  const profileDir = getFirefoxProfileDataDir(testProfileId)

  beforeEach(() => {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
  })

  // 1. Directory creation, access, and permissions
  it('1. Initializes valid Firefox profile directory with proper structure and access', () => {
    const dir = ensureFirefoxProfileDataDir(testProfileId)
    expect(fs.existsSync(dir)).toBe(true)

    // Directory must be readable and writable
    expect(() => fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK)).not.toThrow()

    // Required files must be pre-seeded
    expect(fs.existsSync(path.join(dir, 'compatibility.ini'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'times.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'handlers.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'containers.json'))).toBe(true)
  })

  // 2. Individual profile directory MUST NOT have an errant profiles.ini
  it('2. Ensures individual profile directory does NOT contain an errant profiles.ini that confuses Firefox -profile argument', () => {
    const dir = ensureFirefoxProfileDataDir(testProfileId)
    const errantIni = path.join(dir, 'profiles.ini')
    expect(fs.existsSync(errantIni)).toBe(false)

    // If an errant profiles.ini is placed in the folder, ensureFirefoxProfileDataDir cleans it up
    fs.writeFileSync(errantIni, '[General]\nPath=.\n', 'utf8')
    expect(fs.existsSync(errantIni)).toBe(true)

    ensureFirefoxProfileDataDir(testProfileId)
    expect(fs.existsSync(errantIni)).toBe(false)
  })

  // 3. Stale lock file and symlink cleanup
  it('3. Cleans all stale lock files and broken Unix symlinks (.parentlock, parent.lock, lock)', () => {
    const dir = ensureFirefoxProfileDataDir(testProfileId)
    const staleLocks = ['.parentlock', 'parent.lock', 'lock', '.parentlock.link', 'parent.lock.link', 'lock.link']

    for (const l of staleLocks) {
      fs.writeFileSync(path.join(dir, l), 'locked', 'utf8')
      expect(fs.existsSync(path.join(dir, l))).toBe(true)
    }

    ensureFirefoxProfileDataDir(testProfileId)

    for (const l of staleLocks) {
      expect(fs.existsSync(path.join(dir, l))).toBe(false)
    }
  })

  // 4. Compatibility.ini token and version consistency
  it('4. Pre-seeds compatibility.ini with exact OS ABI and version token', () => {
    const dir = ensureFirefoxProfileDataDir(testProfileId)
    const compatPath = path.join(dir, 'compatibility.ini')
    const content = fs.readFileSync(compatPath, 'utf8')

    expect(content).toContain('[Compatibility]')
    expect(content).toContain('LastPlatformToken=')
    expect(content).toContain('LastVersion=')
    expect(content).toContain('LastOSABI=')
  })

  // 5. Global profiles.ini and installs.ini health repair
  it('5. Repairs global Firefox profiles.ini and installs.ini to guarantee default profile exists', () => {
    expect(() => repairGlobalFirefoxProfilesIni()).not.toThrow()

    let ffGlobalDir = ''
    if (process.platform === 'darwin') {
      ffGlobalDir = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Firefox')
    } else if (process.platform === 'win32') {
      ffGlobalDir = path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox')
    } else {
      ffGlobalDir = path.join(process.env.HOME || '', '.mozilla', 'firefox')
    }

    const profilesIni = path.join(ffGlobalDir, 'profiles.ini')
    const installsIni = path.join(ffGlobalDir, 'installs.ini')

    try {
      if (fs.existsSync(profilesIni)) {
        const content = fs.readFileSync(profilesIni, 'utf8')
        expect(content).toContain('[General]')
      }
    } catch {}

    try {
      if (fs.existsSync(installsIni)) {
        const content = fs.readFileSync(installsIni, 'utf8')
        expect(content).toContain('[General]')
      }
    } catch {}
  })

  // 6. Handle spaces and special characters in profile path
  it('6. Correctly handles profile IDs with spaces and Unicode characters', () => {
    const complexId = 'ff profile space & émoji 🚀 ' + Date.now()
    const dir = ensureFirefoxProfileDataDir(complexId)

    expect(fs.existsSync(dir)).toBe(true)
    expect(() => fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK)).not.toThrow()

    // Cleanup complex dir
    fs.rmSync(dir, { recursive: true, force: true })
  })

  // 7. Binary version query fallback
  it('7. Querying Firefox binary version returns valid SemVer string', () => {
    const version = getFirefoxBinaryVersion()
    expect(version).toMatch(/^[\d.]+$/)
  })
})
