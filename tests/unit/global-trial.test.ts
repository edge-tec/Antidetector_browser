// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Global Bulk & Individual Free Trial System
// ──────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { paymentService } from '../../src/main/services/payment.service'
import { getDatabase } from '../../src/main/database/connection'

describe('Global Bulk & Individual Free Trial Provisioning', () => {
  beforeEach(() => {
    paymentService.ensureTablesExist()
    const db = getDatabase()
    // Create mock users if not exist
    try {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, name, email, role, password_hash, created_at, updated_at)
        VALUES 
          ('user_trial_test_1', 'Alice Trader', 'alice_trial@test.com', 'user', 'hash', datetime('now'), datetime('now')),
          ('user_trial_test_2', 'Bob Marketer', 'bob_trial@test.com', 'user', 'hash', datetime('now'), datetime('now')),
          ('user_trial_test_3', 'Charlie Aff', 'charlie_trial@test.com', 'user', 'hash', datetime('now'), datetime('now'))
      `).run()
    } catch {}
  })

  it('1. Grants individual trial to a specific user with custom days & plan', () => {
    const res = paymentService.setUserTrial('user_trial_test_1', 14, 'plan_pro')
    expect(res.success).toBe(true)
    expect(res.user_id).toBe('user_trial_test_1')
    expect(res.user_email).toBe('alice_trial@test.com')
    expect(res.plan_id).toBe('plan_pro')
    expect(res.trial_days).toBe(14)
    expect(res.status).toBe('trial')
    expect(res.is_global).toBe(false)
  })

  it('2. Grants global bulk trial to ALL registered users when userId is "all"', () => {
    const res = paymentService.setUserTrial('all', 7, 'plan_starter')
    expect(res.success).toBe(true)
    expect(res.user_id).toBe('all')
    expect(res.is_global).toBe(true)
    expect(res.affected_count).toBeGreaterThanOrEqual(3)
    expect(res.plan_id).toBe('plan_starter')
    expect(res.trial_days).toBe(7)
    expect(res.status).toBe('trial')
  })

  it('3. Grants global bulk trial to ALL registered users when userId is "global"', () => {
    const res = paymentService.setUserTrial('global', 30, 'plan_business')
    expect(res.success).toBe(true)
    expect(res.user_id).toBe('all')
    expect(res.is_global).toBe(true)
    expect(res.plan_id).toBe('plan_business')
    expect(res.trial_days).toBe(30)
  })

  it('4. Correctly manages and returns global registration trial config', () => {
    const config = paymentService.getGlobalTrialConfig()
    expect(config).toBeDefined()
    expect(typeof config.is_enabled).toBe('boolean')
    expect(typeof config.trial_duration_days).toBe('number')
    expect(typeof config.default_plan_id).toBe('string')

    const saved = paymentService.saveGlobalTrialConfig({
      is_enabled: true,
      trial_duration_days: 10,
      default_plan_id: 'plan_pro',
      applies_to_packages: 'all'
    })
    expect(saved.is_enabled).toBe(true)
    expect(saved.trial_duration_days).toBe(10)
    expect(saved.default_plan_id).toBe('plan_pro')
  })
})
