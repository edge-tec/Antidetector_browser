import { describe, it, expect, beforeEach } from 'vitest'
import { launchUrlManager, getGlobalLaunchUrlConfig } from '../../src/main/browser/launch-url-manager'
import { getDatabase } from '../../src/main/database/connection'

describe('Global Launch URL & Start Page Management System', () => {
  beforeEach(() => {
    // Reset config before each test
    launchUrlManager.saveConfig({
      url: '',
      enabled: false,
      mode: 'enroll_all',
      lockOverride: false,
      additionalTabs: []
    })
  })

  it('1. Retrieves default configuration correctly', () => {
    const config = getGlobalLaunchUrlConfig()
    expect(config).toBeDefined()
    expect(typeof config.enabled).toBe('boolean')
    expect(Array.isArray(config.additionalTabs)).toBe(true)
  })

  it('2. Saves and persists admin launch URL settings', () => {
    const res = launchUrlManager.saveConfig({
      url: 'https://whoer.net',
      enabled: true,
      mode: 'force',
      lockOverride: true,
      additionalTabs: ['https://pixelscan.net']
    }, 'admin@antiprofiles.com')

    expect(res.success).toBe(true)
    expect(res.config.url).toBe('https://whoer.net')
    expect(res.config.enabled).toBe(true)
    expect(res.config.mode).toBe('force')
    expect(res.config.lockOverride).toBe(true)
    expect(res.config.additionalTabs).toContain('https://pixelscan.net')

    // Verify persistence
    const reloaded = getGlobalLaunchUrlConfig()
    expect(reloaded.url).toBe('https://whoer.net')
    expect(reloaded.enabled).toBe(true)
    expect(reloaded.mode).toBe('force')
  })

  it('3. Automatically enrolls all existing profiles upon save when mode is enroll_all', () => {
    const db = getDatabase()
    // Create dummy profiles to test enrollment
    const testId1 = 'test_p1_' + Date.now()
    const testId2 = 'test_p2_' + Date.now()
    try {
      db.prepare("INSERT INTO profiles (id, name, start_url) VALUES (?, ?, '')").run(testId1, 'Enroll Test 1')
      db.prepare("INSERT INTO profiles (id, name, start_url) VALUES (?, ?, 'https://old.com')").run(testId2, 'Enroll Test 2')

      const res = launchUrlManager.saveConfig({
        url: 'https://portal.company.com',
        enabled: true,
        mode: 'enroll_all',
        enrollNow: true
      })

      expect(res.success).toBe(true)
      expect(res.enrolledCount).toBeGreaterThanOrEqual(2)

      const p1 = db.prepare('SELECT start_url FROM profiles WHERE id = ?').get(testId1) as any
      const p2 = db.prepare('SELECT start_url FROM profiles WHERE id = ?').get(testId2) as any
      expect(p1.start_url).toBe('https://portal.company.com')
      expect(p2.start_url).toBe('https://portal.company.com')
    } finally {
      db.prepare('DELETE FROM profiles WHERE id IN (?, ?)').run(testId1, testId2)
    }
  })

  it('4. Handles remote sync from central server license heartbeat', () => {
    launchUrlManager.syncRemoteConfig({
      url: 'https://central-sync.com',
      enabled: true,
      mode: 'default',
      lockOverride: false
    })

    const config = getGlobalLaunchUrlConfig()
    expect(config.url).toBe('https://central-sync.com')
    expect(config.enabled).toBe(true)
    expect(config.mode).toBe('default')
  })
})
