// ──────────────────────────────────────────────
// ProfileVault — Unit Tests: Database Models
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  profileFromRow,
  proxyFromRow,
  proxyToDisplay,
  groupFromRow,
  logFromRow,
  ProfileRow,
  ProxyRow,
  GroupRow,
  LogRow
} from '../../src/main/database/models'

describe('profileFromRow', () => {
  it('maps a database row to a Profile object', () => {
    const row: ProfileRow = {
      id: '123',
      name: 'Test',
      group_id: null,
      notes: 'some notes',
      color: '#6366F1',
      icon: 'globe',
      browser_version: 'latest',
      user_agent: '',
      language: 'en-US',
      timezone: 'America/New_York',
      screen_width: 1920,
      screen_height: 1080,
      webrtc_mode: 'default',
      canvas_mode: 'default',
      webgl_mode: 'default',
      hw_concurrency: 0,
      device_memory: 0,
      hw_acceleration: 1,
      proxy_id: null,
      tags: '["dev","test"]',
      status: 'stopped',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_used_at: null,
      pid: null
    }

    const profile = profileFromRow(row)

    expect(profile.id).toBe('123')
    expect(profile.name).toBe('Test')
    expect(profile.hwAcceleration).toBe(true)
    expect(profile.tags).toEqual(['dev', 'test'])
    expect(profile.status).toBe('stopped')
    expect(profile.groupId).toBeNull()
  })

  it('parses empty tags', () => {
    const row: ProfileRow = {
      id: '1', name: 'T', group_id: null, notes: '', color: '#000', icon: 'globe',
      browser_version: 'latest', user_agent: '', language: 'en-US', timezone: 'UTC',
      screen_width: 1920, screen_height: 1080, webrtc_mode: 'default', canvas_mode: 'default',
      webgl_mode: 'default', hw_concurrency: 0, device_memory: 0, hw_acceleration: 0,
      proxy_id: null, tags: '[]', status: 'stopped', created_at: '', updated_at: '',
      last_used_at: null, pid: null
    }

    const profile = profileFromRow(row)
    expect(profile.tags).toEqual([])
    expect(profile.hwAcceleration).toBe(false)
  })
})

describe('proxyToDisplay', () => {
  it('strips encrypted password and adds hasPassword flag', () => {
    const proxy = proxyFromRow({
      id: '1', name: 'Test', type: 'http', host: '1.2.3.4', port: 8080,
      username: 'user', encrypted_password: Buffer.from('secret'),
      last_tested: null, test_status: 'untested', created_at: ''
    })

    const display = proxyToDisplay(proxy)
    expect(display.hasPassword).toBe(true)
    expect('encryptedPassword' in display).toBe(false)
  })

  it('sets hasPassword to false when no password', () => {
    const proxy = proxyFromRow({
      id: '1', name: 'Test', type: 'http', host: '1.2.3.4', port: 8080,
      username: '', encrypted_password: null,
      last_tested: null, test_status: 'untested', created_at: ''
    })

    const display = proxyToDisplay(proxy)
    expect(display.hasPassword).toBe(false)
  })
})

describe('groupFromRow', () => {
  it('maps a group row correctly', () => {
    const row: GroupRow = {
      id: '1', name: 'Dev', color: '#FF0000', created_at: '2024-01-01', profile_count: 5
    }
    const group = groupFromRow(row)
    expect(group.name).toBe('Dev')
    expect(group.profileCount).toBe(5)
  })
})

describe('logFromRow', () => {
  it('maps a log row correctly', () => {
    const row: LogRow = {
      id: 1, level: 'error', category: 'browser', message: 'Failed to launch',
      details: '{"reason":"timeout"}', created_at: '2024-01-01T00:00:00Z'
    }
    const log = logFromRow(row)
    expect(log.level).toBe('error')
    expect(log.category).toBe('browser')
    expect(log.message).toBe('Failed to launch')
  })
})
