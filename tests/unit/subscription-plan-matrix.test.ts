// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Subscription Plan Matrix & Feature Access
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { resolveLocalPlanFeatureMatrix } from '../../src/main/database/repositories/subscription.repo'

describe('Subscription Plan Matrix & Feature Access Verification', () => {

  // 1. FREE PLAN — $0/month
  describe('FREE PLAN — $0/month', () => {
    const freePlan = resolveLocalPlanFeatureMatrix('plan_free', 'user')

    it('enforces 3 browser profiles limit', () => {
      expect(freePlan.profile_limit).toBe(3)
    })

    it('enforces Basic proxy support (Direct and HTTP only, SOCKS & HTTPS locked)', () => {
      expect(freePlan.proxy_support).toBe('basic')
      expect(freePlan.allowed_proxy_types).toEqual(['direct', 'http'])
      expect(freePlan.allowed_proxy_types.includes('socks4')).toBe(false)
      expect(freePlan.allowed_proxy_types.includes('socks5')).toBe(false)
      expect(freePlan.allowed_proxy_types.includes('https')).toBe(false)
    })

    it('enforces Standard fingerprint controls (Full hardware spoofing locked)', () => {
      expect(freePlan.fingerprint_level).toBe('standard')
      expect(freePlan.has_advanced_fingerprint).toBe(false)
      expect(freePlan.has_full_hardware_spoofing).toBe(false)
    })

    it('enforces 1 Team user / device limit', () => {
      expect(freePlan.team_limit).toBe(1)
      expect(freePlan.can_access_team).toBe(false)
    })

    it('enforces No API access (Automation API locked)', () => {
      expect(freePlan.api_access).toBe('none')
      expect(freePlan.has_api).toBe(false)
      expect(freePlan.has_driver_api).toBe(false)
    })

    it('enforces Community support tier', () => {
      expect(freePlan.support_level).toBe('community')
    })
  })

  // 2. STARTER PLAN — $19/month
  describe('STARTER PLAN — $19/month', () => {
    const starterPlan = resolveLocalPlanFeatureMatrix('plan_starter', 'user')

    it('enforces 25 browser profiles limit', () => {
      expect(starterPlan.profile_limit).toBe(25)
    })

    it('unlocks HTTP, HTTPS, and SOCKS proxy support', () => {
      expect(starterPlan.proxy_support).toBe('socks')
      expect(starterPlan.allowed_proxy_types).toContain('http')
      expect(starterPlan.allowed_proxy_types).toContain('https')
      expect(starterPlan.allowed_proxy_types).toContain('socks4')
      expect(starterPlan.allowed_proxy_types).toContain('socks5')
    })

    it('unlocks Advanced fingerprint controls', () => {
      expect(starterPlan.fingerprint_level).toBe('advanced')
      expect(starterPlan.has_advanced_fingerprint).toBe(true)
      expect(starterPlan.has_full_hardware_spoofing).toBe(false)
    })

    it('enforces 2 Team users / device limit', () => {
      expect(starterPlan.team_limit).toBe(2)
      expect(starterPlan.can_access_team).toBe(true)
    })

    it('unlocks Basic API (Rate limited, Driver API locked)', () => {
      expect(starterPlan.api_access).toBe('basic')
      expect(starterPlan.has_api).toBe(true)
      expect(starterPlan.has_driver_api).toBe(false)
    })

    it('unlocks Email Support tier', () => {
      expect(starterPlan.support_level).toBe('email')
    })
  })

  // 3. PROFESSIONAL PLAN — $49/month (MOST POPULAR)
  describe('PROFESSIONAL PLAN — $49/month (Most Popular)', () => {
    const proPlan = resolveLocalPlanFeatureMatrix('plan_pro', 'user')

    it('enforces 100 browser profiles limit', () => {
      expect(proPlan.profile_limit).toBe(100)
    })

    it('unlocks HTTP, HTTPS, and SOCKS5 proxy support', () => {
      expect(proPlan.proxy_support).toBe('socks5')
      expect(proPlan.allowed_proxy_types).toContain('socks5')
    })

    it('unlocks Advanced Controls fingerprinting', () => {
      expect(proPlan.fingerprint_level).toBe('advanced_controls')
      expect(proPlan.has_advanced_fingerprint).toBe(true)
    })

    it('enforces 10 Team users / device limit', () => {
      expect(proPlan.team_limit).toBe(10)
      expect(proPlan.can_access_team).toBe(true)
    })

    it('unlocks Full REST & Driver API (Puppeteer/Playwright CDP wsEndpoint)', () => {
      expect(proPlan.api_access).toBe('full')
      expect(proPlan.has_api).toBe(true)
      expect(proPlan.has_driver_api).toBe(true)
    })

    it('unlocks Priority 24/7 support tier', () => {
      expect(proPlan.support_level).toBe('priority_24_7')
    })
  })

  // 4. BUSINESS PLAN — $99/month (BEST VALUE)
  describe('BUSINESS PLAN — $99/month (Best Value)', () => {
    const businessPlan = resolveLocalPlanFeatureMatrix('plan_business', 'user')

    it('enforces 500 browser profiles limit', () => {
      expect(businessPlan.profile_limit).toBe(500)
    })

    it('unlocks Full Hardware Spoofing', () => {
      expect(businessPlan.fingerprint_level).toBe('full_hardware')
      expect(businessPlan.has_advanced_fingerprint).toBe(true)
      expect(businessPlan.has_full_hardware_spoofing).toBe(true)
    })

    it('enforces 25 Team users / device limit', () => {
      expect(businessPlan.team_limit).toBe(25)
      expect(businessPlan.can_access_team).toBe(true)
    })

    it('unlocks Unlimited / High-Limit API', () => {
      expect(businessPlan.api_access).toBe('unlimited')
      expect(businessPlan.has_api).toBe(true)
      expect(businessPlan.has_driver_api).toBe(true)
    })

    it('unlocks Dedicated Account Manager support tier', () => {
      expect(businessPlan.support_level).toBe('dedicated_manager')
    })
  })

  // 5. Admin & Role Overrides
  describe('Admin Role Overrides', () => {
    const adminPlan = resolveLocalPlanFeatureMatrix('plan_free', 'admin')

    it('gives system administrators unrestricted limits and full hardware spoofing', () => {
      expect(adminPlan.profile_limit).toBe(1000)
      expect(adminPlan.team_limit).toBe(50)
      expect(adminPlan.has_full_hardware_spoofing).toBe(true)
      expect(adminPlan.has_driver_api).toBe(true)
      expect(adminPlan.api_access).toBe('unlimited')
    })
  })
})
