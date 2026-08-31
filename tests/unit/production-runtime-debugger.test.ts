import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { ProductionRuntimeDebugger } from '../../src/main/browser/production-runtime-debugger'
import { SingleFlightAuthManager } from '../../src/main/browser/auth/auth-compatibility'

describe('AntiProfiles v5.2 Production Runtime Debugger Tests', () => {
  const profileId = 'debug-profile-' + Date.now()

  beforeEach(() => {
    ProductionRuntimeDebugger.clear()
    SingleFlightAuthManager.reset()
  })

  afterEach(() => {
    deleteProfileDataDir(profileId)
    ProductionRuntimeDebugger.clear()
  })

  // ── Phase 1: Identity Consistency Audit ──
  describe('Phase 1: Identity Consistency Audit', () => {
    it('passes identity consistency on valid Windows profile and flags mismatches on corrupted profiles', () => {
      const validFp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const validRes = ProductionRuntimeDebugger.auditIdentityConsistency(validFp)
      expect(validRes.status).toBe('PASS')
      expect(validRes.mismatches.length).toBe(0)

      // Inconsistent profile: Windows platform with iPhone UA
      const badFp = { ...validFp, navigator: { ...validFp.navigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' } }
      const badRes = ProductionRuntimeDebugger.auditIdentityConsistency(badFp)
      expect(badRes.status).toBe('FAIL')
      expect(badRes.mismatches[0]).toContain('mobile User-Agent')
    })
  })

  // ── Phase 2: Startup Timeline Audit ──
  describe('Phase 2: Startup Timeline Audit', () => {
    it('records all startup phases and verifies restore sequence completes before navigation', () => {
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'PROFILE_LOADED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'COOKIES_RESTORED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'LOCAL_STORAGE_RESTORED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'INDEXED_DB_RESTORED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'CACHE_RESTORED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'SERVICE_WORKER_RESTORED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'PROXY_APPLIED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'TIMEZONE_SYNCHRONIZED', status: 'SUCCESS' })
      ProductionRuntimeDebugger.recordTimelineEvent(profileId, { phase: 'NAVIGATED_TO_X', status: 'SUCCESS' })

      const events = ProductionRuntimeDebugger.getTimeline(profileId)
      expect(events.length).toBe(9)
      expect(events[events.length - 1].phase).toBe('NAVIGATED_TO_X')
    })
  })

  // ── Phase 3: Session Storage Verification ──
  describe('Phase 3: Session Storage Verification', () => {
    it('verifies presence of isolated directories for cookies, IndexedDB, LocalStorage, and Cache', () => {
      const dataDir = ensureProfileDataDir(profileId)
      const networkDir = path.join(dataDir, 'Default', 'Network')
      const localStorageDir = path.join(dataDir, 'Default', 'Local Storage')
      const indexedDbDir = path.join(dataDir, 'Default', 'IndexedDB')
      const swDir = path.join(dataDir, 'Default', 'Service Worker')
      const cacheDir = path.join(dataDir, 'Default', 'Cache')

      fs.mkdirSync(networkDir, { recursive: true })
      fs.mkdirSync(localStorageDir, { recursive: true })
      fs.mkdirSync(indexedDbDir, { recursive: true })
      fs.mkdirSync(swDir, { recursive: true })
      fs.mkdirSync(cacheDir, { recursive: true })

      const storageAudit = ProductionRuntimeDebugger.verifySessionStorage(dataDir)
      expect(storageAudit.status).toBe('PASS')
      expect(storageAudit.cookieDbExists).toBe(true)
      expect(storageAudit.indexedDbReadable).toBe(true)
      expect(storageAudit.localStorageReadable).toBe(true)
    })
  })

  // ── Phase 5, 6 & 7: Diagnostics & Production Report Generation ──
  describe('Phase 5, 6 & 7: Production Report & Challenge Guidance', () => {
    it('generates a complete production diagnostic report with PASS ratings and rate-limit fixes', () => {
      const dataDir = ensureProfileDataDir(profileId)
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })

      const report = ProductionRuntimeDebugger.generateProductionReport({
        profileId,
        fingerprint: fp,
        profileDataDir: dataDir,
        proxyCountry: 'US',
        authOutcome: 'RATE_LIMITED'
      })

      expect(report.profileId).toBe(profileId)
      expect(report.identityConsistency.status).toBe('PASS')
      expect(report.sessionStorage.status).toBe('PASS')
      expect(report.authenticationOutcome.statusCategory).toBe('4xx_RATE_LIMITED')
      expect(report.authenticationOutcome.autoRetryProhibited).toBe(true)
      expect(report.recommendedRuntimeFixes.length).toBeGreaterThan(0)
    })
  })
})
