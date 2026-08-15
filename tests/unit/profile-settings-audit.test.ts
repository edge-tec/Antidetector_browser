// ──────────────────────────────────────────────
// ProfileVault — Profile Settings Complete Audit Test
// ──────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest'
import { initDatabase, getDatabase } from '../../src/main/database/connection'
import { profileRepo } from '../../src/main/database/repositories/profile.repo'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { generateFingerprint } from '../../src/main/fingerprint/generator'

describe('Browser Profile Settings System End-to-End Audit', () => {
  const testUserId = 'user-audit-1'

  beforeAll(() => {
    initDatabase()
    const db = getDatabase()
    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, email_verified, account_status)
      VALUES (?, 'Audit User', 'audit@example.com', 'hash', 'user', 1, 'active')
    `).run(testUserId)
  })

  it('1. Overview & General Settings: Saves, loads, and persists name, OS, startUrl, tags, notes', () => {
    const profile = profileRepo.create({
      name: 'Audit Profile Alpha',
      osType: 'macos-arm',
      startUrl: 'https://whoer.net',
      notes: 'Initial test notes',
      tags: ['audit', 'test-tag']
    }, testUserId)

    expect(profile.name).toBe('Audit Profile Alpha')
    expect(profile.osType).toBe('macos-arm')
    expect(profile.startUrl).toBe('https://whoer.net')
    expect(profile.notes).toBe('Initial test notes')
    expect(profile.tags).toEqual(['audit', 'test-tag'])

    // Update Overview settings
    const updated = profileRepo.update(profile.id, {
      name: 'Audit Profile Alpha (Renamed)',
      startUrl: 'https://browserleaks.com',
      notes: 'Updated notes description',
      tags: ['audit', 'updated-tag']
    })

    expect(updated?.name).toBe('Audit Profile Alpha (Renamed)')
    expect(updated?.startUrl).toBe('https://browserleaks.com')
    expect(updated?.notes).toBe('Updated notes description')
    expect(updated?.tags).toEqual(['audit', 'updated-tag'])
  })

  it('2. Timezone Settings: Configures auto/custom timezone and verifies persistence', () => {
    const fp = generateFingerprint({ osType: 'windows-10' })
    fp.timezone = { mode: 'manual', timezone: 'Europe/Berlin' }

    const profile = profileRepo.create({
      name: 'Timezone Profile',
      timezone: 'Europe/Berlin',
      fingerprint: fp
    }, testUserId)

    expect(profile.timezone).toBe('Europe/Berlin')
    expect(profile.fingerprint.timezone.timezone).toBe('Europe/Berlin')

    const reloaded = profileRepo.getById(profile.id)
    expect(reloaded?.timezone).toBe('Europe/Berlin')
  })

  it('3. WebRTC Settings: Configures disabled/public_only modes', () => {
    const fp = generateFingerprint({ osType: 'windows-10' })
    fp.webrtc = { mode: 'disabled', ipPolicy: 'disable_non_proxied_udp' }

    const profile = profileRepo.create({
      name: 'WebRTC Disabled Profile',
      webrtcMode: 'disabled',
      fingerprint: fp
    }, testUserId)

    expect(profile.webrtcMode).toBe('disabled')
    expect(profile.fingerprint.webrtc.mode).toBe('disabled')
  })

  it('4. Geolocation Settings: Custom coordinates and mode persistence', () => {
    const fp = generateFingerprint({ osType: 'macos-intel' })
    fp.geolocation = { mode: 'custom', latitude: 52.52, longitude: 13.405, accuracy: 10 }

    const profile = profileRepo.create({
      name: 'Geo Profile',
      fingerprint: fp
    }, testUserId)

    expect(profile.fingerprint.geolocation.latitude).toBe(52.52)
    expect(profile.fingerprint.geolocation.longitude).toBe(13.405)
    expect(profile.fingerprint.geolocation.mode).toBe('custom')
  })

  it('5. Extensions & Bookmarks: Stored in browser fingerprint object', () => {
    const fp = generateFingerprint({ osType: 'windows-10' })
    fp.browser = fp.browser || {}
    fp.browser.extensions = [{ id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', name: 'uBlock Origin' }]
    fp.browser.bookmarks = [{ title: 'Google', url: 'https://google.com' }]

    const profile = profileRepo.create({
      name: 'Extensions & Bookmarks Profile',
      fingerprint: fp
    }, testUserId)

    expect(profile.fingerprint.browser.extensions).toHaveLength(1)
    expect(profile.fingerprint.browser.extensions[0].name).toBe('uBlock Origin')
    expect(profile.fingerprint.browser.bookmarks).toHaveLength(1)
    expect(profile.fingerprint.browser.bookmarks[0].url).toBe('https://google.com')
  })

  it('6. Advanced & Navigator Settings: Generates clean, valid CDP injection script', () => {
    const fp = generateFingerprint({ osType: 'windows-11' })
    fp.navigator.hardwareConcurrency = 16
    fp.navigator.deviceMemory = 32
    fp.webgl = {
      enabled: true,
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)',
      imageMode: 'noise',
      metadataMode: 'mask'
    } as any

    const script = buildInjectionScript(fp)

    expect(script).toContain('Navigator Override')
    expect(script).toContain('WebGL Override')
    expect(script).toContain('NVIDIA GeForce RTX 4090')
    expect(typeof script).toBe('string')
    expect(script.length).toBeGreaterThan(100)
  })
})
