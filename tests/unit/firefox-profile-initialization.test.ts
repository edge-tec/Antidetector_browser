import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ensureFirefoxProfileDataDir, repairGlobalFirefoxProfilesIni, getFirefoxProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('Firefox Profile Initialization & "Profile Missing" Prevention Tests', () => {
  const testProfileId = 'ff-test-missing-' + Date.now()
  const profileDir = getFirefoxProfileDataDir(testProfileId)

  beforeEach(() => {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
  })

  it('ensureFirefoxProfileDataDir initializes compatibility.ini, times.json, and profiles.ini', () => {
    const dir = ensureFirefoxProfileDataDir(testProfileId)
    expect(fs.existsSync(dir)).toBe(true)

    const compatPath = path.join(dir, 'compatibility.ini')
    expect(fs.existsSync(compatPath)).toBe(true)
    const compatContent = fs.readFileSync(compatPath, 'utf8')
    expect(compatContent).toContain('[Compatibility]')
    expect(compatContent).toContain('LastVersion=')
    expect(compatContent).toContain('LastOSABI=')

    const timesPath = path.join(dir, 'times.json')
    expect(fs.existsSync(timesPath)).toBe(true)

    const profilesIniPath = path.join(dir, 'profiles.ini')
    expect(fs.existsSync(profilesIniPath)).toBe(true)
  })

  it('repairGlobalFirefoxProfilesIni executes safely without throwing on any OS platform', () => {
    expect(() => repairGlobalFirefoxProfilesIni()).not.toThrow()
  })
})
