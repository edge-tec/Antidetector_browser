// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Comprehensive Unit Tests: Real-Time Profile Validation & Audit
// Multi-engine (Chromium & Firefox), multi-OS, profile switching isolation,
// truthful runtime verification, contradiction failure guards, and auto-repair.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveMasterProfile } from '../../src/main/fingerprint/master-profile-resolver'
import { RealTimeProfileValidator } from '../../src/main/browser/realtime-profile-validator'
import { ProfileAutoRepairEngine } from '../../src/main/fingerprint/auto-repair'
import { auditLogger } from '../../src/main/logging/audit-logger'
import { validateConsistency } from '../../src/main/fingerprint/consistency'

describe('Real-Time Profile Validation, Audit & Auto-Repair Engine', () => {

  beforeEach(() => {
    auditLogger.clear()
  })

  // ─────────────────────────────────────────────────────────────
  // Test 1: Multi-Engine & Multi-OS Truthful Audit
  // ─────────────────────────────────────────────────────────────
  describe('Test 1: Multi-Engine & Multi-OS Truthful Audit', () => {
    it('accurately audits Windows 11 Chrome profile without contradictions', () => {
      const master = resolveMasterProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      const report = RealTimeProfileValidator.validate(master, {
        browserEngine: 'blink',
        browserVersion: '128.0.6613.120',
        userAgent: master.userAgent,
        platform: 'Win32',
        screenWidth: master.screenWidth,
        screenHeight: master.screenHeight,
        devicePixelRatio: master.devicePixelRatio,
        hardwareConcurrency: master.hardwareConcurrency,
        deviceMemory: master.deviceMemory
      })

      expect(report.overallStatus).toBe('PASS')
      expect(report.summary.fail).toBe(0)
      expect(report.criticalContradictions).toHaveLength(0)
      expect(report.checks.find(c => c.id === 'browser-engine')?.status).toBe('PASS')
      expect(report.checks.find(c => c.id === 'platform')?.status).toBe('PASS')
    })

    it('accurately audits macOS ARM Firefox profile with Apple Silicon GPU', () => {
      const master = resolveMasterProfile({
        osType: 'macos-arm',
        browserType: 'firefox',
        browserVersion: '129.0'
      })

      const report = RealTimeProfileValidator.validate(master, {
        browserEngine: 'gecko',
        browserVersion: '129.0',
        userAgent: master.userAgent,
        platform: 'MacIntel',
        screenWidth: master.screenWidth,
        screenHeight: master.screenHeight,
        devicePixelRatio: 2,
        hardwareConcurrency: master.hardwareConcurrency
      })

      expect(report.overallStatus).toBe('PASS')
      expect(report.summary.fail).toBe(0)
      expect(master.userAgent).toContain('Gecko/20100101 Firefox/129.0')
      expect(master.userAgent).not.toContain('Chrome')
    })

    it('truthfully marks mobile OS on desktop host as HOST-CONTROLLED', () => {
      const master = resolveMasterProfile({
        osType: 'android',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120',
        deviceModelId: 'samsung-s24-ultra'
      })

      const report = RealTimeProfileValidator.validate(master, {
        browserEngine: 'blink',
        browserVersion: '128.0.6613.120',
        userAgent: master.userAgent,
        platform: 'Linux armv8l'
      })

      const osCheck = report.checks.find(c => c.id === 'operating-system')
      expect(osCheck?.status).toBe('HOST-CONTROLLED')
      expect(report.overallStatus).toBe('PASS')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test 2: Contradiction Failure Guards
  // ─────────────────────────────────────────────────────────────
  describe('Test 2: Contradiction Failure Guards', () => {
    it('strictly FAILS when a Chrome profile runs with a Firefox User-Agent', () => {
      const master = resolveMasterProfile({
        osType: 'macos-arm',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      const report = RealTimeProfileValidator.validate(master, {
        browserEngine: 'blink',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0'
      })

      expect(report.overallStatus).toBe('FAIL')
      expect(report.summary.fail).toBeGreaterThanOrEqual(1)
      expect(report.criticalContradictions).toContain('Chrome profile contains Firefox UA tokens')
    })

    it('strictly FAILS when browser version runtime does not match configured version', () => {
      const master = resolveMasterProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      const report = RealTimeProfileValidator.validate(master, {
        browserEngine: 'blink',
        browserVersion: '115.0.5790.170'
      })

      expect(report.overallStatus).toBe('FAIL')
      expect(report.checks.find(c => c.id === 'browser-version')?.status).toBe('FAIL')
    })

    it('strictly FAILS when platform does not match OS expectation', () => {
      const master = resolveMasterProfile({
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })

      const report = RealTimeProfileValidator.validate(master, {
        platform: 'iPhone'
      })

      expect(report.overallStatus).toBe('FAIL')
      expect(report.checks.find(c => c.id === 'platform')?.status).toBe('FAIL')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test 3: Profile Switching Isolation (A ➔ B ➔ C ➔ D)
  // ─────────────────────────────────────────────────────────────
  describe('Test 3: Profile Switching Isolation (A ➔ B ➔ C ➔ D)', () => {
    it('completely isolates all state across consecutive profile switches', () => {
      // 1. Profile A: Windows 11 + Chrome 128
      const profileA = resolveMasterProfile({
        profileId: 'prof-a',
        osType: 'windows-11',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120'
      })
      expect(profileA.platform).toBe('Win32')
      expect(profileA.userAgent).toContain('Windows NT 10.0')
      expect(profileA.userAgent).toContain('Chrome/128.0.6613.120')

      // 2. Profile B: macOS ARM + Firefox 129
      const profileB = resolveMasterProfile({
        profileId: 'prof-b',
        osType: 'macos-arm',
        browserType: 'firefox',
        browserVersion: '129.0'
      })
      expect(profileB.platform).toBe('MacIntel')
      expect(profileB.userAgent).toContain('Macintosh; Intel Mac OS X')
      expect(profileB.userAgent).toContain('rv:129.0')
      expect(profileB.userAgent).toContain('Gecko/20100101 Firefox/129.0')
      expect(profileB.userAgent).not.toContain('Windows')
      expect(profileB.userAgent).not.toContain('Chrome')

      // 3. Profile C: Linux + Chrome 126
      const profileC = resolveMasterProfile({
        profileId: 'prof-c',
        osType: 'linux',
        browserType: 'chrome',
        browserVersion: '126.0.6478.182'
      })
      expect(profileC.platform).toBe('Linux x86_64')
      expect(profileC.userAgent).toContain('X11; Linux x86_64')
      expect(profileC.userAgent).not.toContain('Macintosh')
      expect(profileC.userAgent).not.toContain('Firefox')

      // 4. Profile D: Android Samsung S24
      const profileD = resolveMasterProfile({
        profileId: 'prof-d',
        osType: 'android',
        browserType: 'chrome',
        browserVersion: '128.0.6613.120',
        deviceModelId: 'samsung-s24-ultra'
      })
      expect(profileD.platform).toBe('Linux armv8l')
      expect(profileD.userAgent).toContain('Android 14; SM-S928B')
      expect(profileD.userAgent).toContain('Chrome/128.0.6613.120 Mobile Safari')
      expect(profileD.userAgent).not.toContain('X11')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test 4: Auto-Repair Engine Verification
  // ─────────────────────────────────────────────────────────────
  describe('Test 4: Auto-Repair Engine Verification', () => {
    it('automatically repairs corrupted fingerprint fields to full coherence', () => {
      const corruptFingerprint: any = {
        browser: { type: 'chrome', version: '129.0' },
        navigator: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0',
          platform: 'Win32',
          browserVersion: '129.0'
        },
        screen: { width: 1920, height: 1080 }
      }

      const repairResult = ProfileAutoRepairEngine.repair(
        {
          profileId: 'repair-test',
          osType: 'macos-arm',
          browserType: 'chrome',
          browserVersion: '128.0.6613.120'
        },
        corruptFingerprint
      )

      expect(repairResult.success).toBe(true)
      expect(repairResult.repairedCount).toBeGreaterThan(0)
      expect(repairResult.repairedMasterProfile.userAgent).toContain('Chrome/128.0.6613.120')
      expect(repairResult.repairedMasterProfile.userAgent).not.toContain('Firefox')
      expect(repairResult.repairedMasterProfile.platform).toBe('MacIntel')

      // Re-validate repaired configuration
      const reAudit = RealTimeProfileValidator.validate(repairResult.repairedMasterProfile)
      expect(reAudit.overallStatus).toBe('PASS')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Test 5: Sanitized Structured Audit Logging
  // ─────────────────────────────────────────────────────────────
  describe('Test 5: Sanitized Structured Audit Logging', () => {
    it('redacts passwords, proxy auth, and sensitive secrets in audit logs', () => {
      const entry = auditLogger.log({
        profileId: 'audit-sec-test',
        property: 'Proxy Configuration',
        configuredValue: 'http://user_test:SuperSecretPassword123@proxy.example.com:8080',
        resolvedValue: { password: 'SuperSecretPassword123', token: 'bearer abcdef1234567890xyz' },
        runtimeValue: 'Connected',
        status: 'PASS',
        source: 'Validation Engine'
      })

      expect(entry.configuredValue).not.toContain('SuperSecretPassword123')
      expect(entry.configuredValue).toContain('***')
      expect(entry.resolvedValue.password).toBe('***REDACTED***')
      expect(entry.resolvedValue.token).toBe('***REDACTED***')
    })
  })
})
