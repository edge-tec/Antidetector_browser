// ──────────────────────────────────────────────
// ProfileVault — Subscriptions & Licensing Integration Tests
// ──────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { initDatabase, getDatabase } from '../../src/main/database/connection'
import { subscriptionRepo } from '../../src/main/database/repositories/subscription.repo'

describe('Subscription & Licensing System', () => {
  let db: any

  beforeEach(() => {
    db = initDatabase()

    // Reset tables for isolated test runs
    db.prepare('DELETE FROM desktop_installations').run()
    db.prepare('DELETE FROM subscriptions').run()
    subscriptionRepo.updateDesktopConfig({ max_devices_limit: '2', min_supported_version: '1.0.0', force_update: 'false' })

    // Seed test user
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, email_verified, account_status)
      VALUES ('user-test-1', 'Test User', 'user@example.com', 'hash', 'user', 1, 'active')
    `).run()
  })

  it('should create default subscription for new user and validate license', () => {
    const license = subscriptionRepo.validateLicense('user-test-1', 'inst-123', 'windows', '1.0.0')
    expect(license.valid).toBe(true)
    expect(license.account_status).toBe('active')
    expect(['active', 'trial']).toContain(license.subscription_status)
    expect(license.plan.name).toBeDefined()
    expect(license.features.browser_profiles).toBe(true)
  })

  it('should automatically provision free trial for new users based on global policy', () => {
    db.prepare('DELETE FROM subscriptions').run()
    const sub = subscriptionRepo.getOrCreateSubscription('user-test-1')
    expect(sub.status).toBe('trial')
    expect(sub.plan_id).toBe('plan_starter')
    expect(sub.expires_at).toBeDefined()
  })

  it('should enforce device limits per subscription', () => {
    // Admin set limit to 1 device
    subscriptionRepo.updateDesktopConfig({ max_devices_limit: '1' })

    // Register device 1
    const res1 = subscriptionRepo.validateLicense('user-test-1', 'inst-1', 'windows', '1.0.0')
    expect(res1.valid).toBe(true)

    // Register device 2 (should fail due to device limit)
    const res2 = subscriptionRepo.validateLicense('user-test-1', 'inst-2', 'macos', '1.0.0')
    expect(res2.valid).toBe(false)
    expect(res2.subscription_status).toBe('device_limit_reached')
  })

  it('should handle subscription expiration and grace period', () => {
    // Set expiration date to yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    subscriptionRepo.updateUserSubscription('user-test-1', {
      expires_at: yesterday,
      grace_period_days: 0
    })

    const license = subscriptionRepo.validateLicense('user-test-1', 'inst-1', 'windows', '1.0.0')
    expect(license.valid).toBe(false)
    expect(license.subscription_status).toBe('expired')
  })

  it('should enter grace period if within configured grace period days', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    subscriptionRepo.updateUserSubscription('user-test-1', {
      expires_at: yesterday,
      grace_period_days: 3
    })

    const license = subscriptionRepo.validateLicense('user-test-1', 'inst-1', 'windows', '1.0.0')
    expect(license.valid).toBe(true)
    expect(license.grace_period_active).toBe(true)
    expect(license.subscription_status).toBe('grace_period')
  })

  it('should block license if user account is suspended by admin', () => {
    db.prepare("UPDATE users SET account_status = 'suspended' WHERE id = 'user-test-1'").run()

    const license = subscriptionRepo.validateLicense('user-test-1', 'inst-1', 'windows', '1.0.0')
    expect(license.valid).toBe(false)
    expect(license.subscription_status).toBe('suspended')
    expect(license.account_status).toBe('suspended')
  })

  it('should allow admin to update user plan and extend expiration date', () => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString()
    subscriptionRepo.updateUserSubscription('user-test-1', {
      plan_id: 'plan_pro',
      expires_at: nextYear,
      status: 'active'
    })

    const sub = subscriptionRepo.getOrCreateSubscription('user-test-1')
    expect(sub.plan_id).toBe('plan_pro')
    expect(sub.status).toBe('active')
  })

  it('should generate platform-aware update manifest for Windows x64, macOS Intel, and Apple Silicon', () => {
    const manifest = subscriptionRepo.getAppUpdateManifest()
    expect(manifest.platforms['windows-x64']).toBeDefined()
    expect(manifest.platforms['macos-x64']).toBeDefined()
    expect(manifest.platforms['macos-arm64']).toBeDefined()
    expect(manifest.platforms['windows-x64'].download_url).toMatch(/(AntiProfiles|ProfileVault)-Windows-x64\.exe/)
    expect(manifest.platforms['macos-x64'].download_url).toMatch(/(AntiProfiles|ProfileVault)-macOS-Intel-x64\.dmg/)
    expect(manifest.platforms['macos-arm64'].download_url).toMatch(/(AntiProfiles|ProfileVault)-macOS-Apple-Silicon-arm64\.dmg/)
  })
})
