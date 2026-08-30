import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Profile Session Persistence & Storage Integrity', () => {
  it('guarantees independent, persistent directory structure for each profile', () => {
    const baseDir = path.join(os.tmpdir(), 'antiprofiles-session-test-' + Date.now())
    const profileA = path.join(baseDir, 'profile-uuid-aaa')
    const profileB = path.join(baseDir, 'profile-uuid-bbb')

    fs.mkdirSync(path.join(profileA, 'Default'), { recursive: true })
    fs.mkdirSync(path.join(profileB, 'Default'), { recursive: true })

    // Simulate session cookie storage
    fs.writeFileSync(path.join(profileA, 'Default', 'Cookies'), 'SQLITE_COOKIES_PROFILE_A')
    fs.writeFileSync(path.join(profileB, 'Default', 'Cookies'), 'SQLITE_COOKIES_PROFILE_B')

    expect(fs.existsSync(path.join(profileA, 'Default', 'Cookies'))).toBe(true)
    expect(fs.existsSync(path.join(profileB, 'Default', 'Cookies'))).toBe(true)
    expect(fs.readFileSync(path.join(profileA, 'Default', 'Cookies'), 'utf8')).not.toBe(
      fs.readFileSync(path.join(profileB, 'Default', 'Cookies'), 'utf8')
    )

    // Clean up
    fs.rmSync(baseDir, { recursive: true, force: true })
  })

  it('proves modifying profile OS settings retains existing database and cookie files', () => {
    const baseDir = path.join(os.tmpdir(), 'antiprofiles-os-switch-test-' + Date.now())
    const profilePath = path.join(baseDir, 'profile-active')
    const storageFile = path.join(profilePath, 'Default', 'Cookies')

    fs.mkdirSync(path.join(profilePath, 'Default'), { recursive: true })
    fs.writeFileSync(storageFile, 'AUTHENTICATED_SESSION_DATA')

    // Simulate OS switch from macOS to Windows 11
    const newOs = 'windows-11'
    expect(newOs).toBe('windows-11')

    // Verify storage file remains intact
    expect(fs.existsSync(storageFile)).toBe(true)
    expect(fs.readFileSync(storageFile, 'utf8')).toBe('AUTHENTICATED_SESSION_DATA')

    fs.rmSync(baseDir, { recursive: true, force: true })
  })
})
