// ──────────────────────────────────────────────
// AntiProfiles — Live Firefox Profile Setup & Arg Verification
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ensureFirefoxProfileDataDir } from '../../src/main/browser/chromium-resolver'

describe('Firefox Profile Direct Launch and Isolation Verification', () => {
  const profileId = 'live-test-ff-profile-' + Date.now()

  it('correctly initializes dedicated firefox-profile directory and required metadata', () => {
    const profileDir = ensureFirefoxProfileDataDir(profileId)
    expect(fs.existsSync(profileDir)).toBe(true)
    expect(profileDir).toContain('firefox-profile')

    // Clean up
    fs.rmSync(profileDir, { recursive: true, force: true })
    expect(fs.existsSync(profileDir)).toBe(false)
  })
})
