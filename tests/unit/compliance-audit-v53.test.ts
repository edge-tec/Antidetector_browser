import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { ensureProfileDataDir, deleteProfileDataDir } from '../../src/main/browser/chromium-resolver'
import { ComplianceAuditEngineV53 } from '../../src/main/browser/compliance-audit-v53'

describe('AntiProfiles v5.3 Production Browser Compliance Audit Test Suite', () => {
  const testProfId = 'v53-compliance-test-' + Date.now()

  afterEach(() => {
    deleteProfileDataDir(testProfId)
  })

  // ── Module 1: Browser Client Hints ──
  describe('Module 1: Browser Client Hints Audit', () => {
    it('audits Client Hints consistency for Windows 11 platform', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const res = ComplianceAuditEngineV53.auditClientHints(fp)

      expect(res.status).toBe('PASS')
      expect(res.secChUaMobile).toBe(false)
      expect(res.secChUaPlatform).toBe('"Windows"')
      expect(res.mismatches.length).toBe(0)
    })
  })

  // ── Module 2: Navigator Consistency ──
  describe('Module 2: Navigator Consistency Audit', () => {
    it('verifies runtime navigator properties match Windows profile', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const res = ComplianceAuditEngineV53.auditNavigator(fp)

      expect(res.status).toBe('PASS')
      expect(res.platform).toBe('Win32')
      expect(res.userAgent).toContain('Windows NT')
      expect(res.mismatches.length).toBe(0)
    })
  })

  // ── Module 3: Browser Feature Detection ──
  describe('Module 3: Standard Web APIs Availability', () => {
    it('confirms availability of standard browser APIs', () => {
      const res = ComplianceAuditEngineV53.auditApiAvailability()
      expect(res.status).toBe('PASS')
      expect(res.indexedDB).toBe(true)
      expect(res.serviceWorkers).toBe(true)
      expect(res.webCrypto).toBe(true)
      expect(res.webAssembly).toBe(true)
      expect(res.missingApis.length).toBe(0)
    })
  })

  // ── Module 4: Storage Lifecycle Startup Order ──
  describe('Module 4: Storage Lifecycle & Startup Sequence Order', () => {
    it('passes when restore sequence finishes before first navigation and fails if inverted', () => {
      const validEvents = [
        'LOAD_PROFILE',
        'RESTORE_COOKIES',
        'RESTORE_LOCAL_STORAGE',
        'RESTORE_INDEXED_DB',
        'RESTORE_CACHE_STORAGE',
        'RESTORE_SERVICE_WORKERS',
        'START_NETWORK_STACK',
        'NAVIGATE_TO_FIRST_URL'
      ]

      const validRes = ComplianceAuditEngineV53.auditStorageLifecycle(validEvents)
      expect(validRes.status).toBe('PASS')
      expect(validRes.completedBeforeFirstNavigation).toBe(true)

      const invertedEvents = [
        'LOAD_PROFILE',
        'NAVIGATE_TO_FIRST_URL',
        'RESTORE_COOKIES'
      ]
      const invertedRes = ComplianceAuditEngineV53.auditStorageLifecycle(invertedEvents)
      expect(invertedRes.status).toBe('FAIL')
      expect(invertedRes.errors.length).toBeGreaterThan(0)
    })
  })

  // ── Module 6: Session Persistence ──
  describe('Module 6: Session Persistence Audit', () => {
    it('verifies that persistent storage directories exist and are isolated', () => {
      const dataDir = ensureProfileDataDir(testProfId)
      fs.mkdirSync(path.join(dataDir, 'Default', 'Network'), { recursive: true })
      fs.mkdirSync(path.join(dataDir, 'Default', 'Local Storage'), { recursive: true })
      fs.mkdirSync(path.join(dataDir, 'Default', 'IndexedDB'), { recursive: true })
      fs.mkdirSync(path.join(dataDir, 'Default', 'Cache'), { recursive: true })
      fs.mkdirSync(path.join(dataDir, 'Default', 'Service Worker'), { recursive: true })

      const res = ComplianceAuditEngineV53.auditSessionPersistence(dataDir)
      expect(res.status).toBe('PASS')
      expect(res.cookiesPersisted).toBe(true)
      expect(res.indexedDbPersisted).toBe(true)
    })
  })

  // ── Module 7: Browser Integrity Hash ──
  describe('Module 7: Browser Integrity & Identity Hash Locking', () => {
    it('generates matching identity hash across login lifecycles and detects illegal mutations', () => {
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })
      const res = ComplianceAuditEngineV53.auditBrowserIntegrity(fp, fp)

      expect(res.status).toBe('PASS')
      expect(res.hashMatched).toBe(true)

      const mutatedFp = { ...fp, navigator: { ...fp.navigator, userAgent: 'MUTATED_UA' } }
      const mutatedRes = ComplianceAuditEngineV53.auditBrowserIntegrity(fp, mutatedFp)
      expect(mutatedRes.status).toBe('FAIL')
      expect(mutatedRes.violations.length).toBeGreaterThan(0)
    })
  })

  // ── Final JSON Compliance Report ──
  describe('Final Master Compliance JSON Report', () => {
    it('generates structured JSON compliance report covering all 8 modules', () => {
      const dataDir = ensureProfileDataDir(testProfId)
      const fp = generateFingerprint({ osType: 'windows-11', browserType: 'chrome' })

      const report = ComplianceAuditEngineV53.generateMasterReport({
        profileId: testProfId,
        fingerprint: fp,
        profileDataDir: dataDir,
        authOutcome: {
          responseStatus: 429,
          responseBody: "We've temporarily limited your login. Please try again later."
        }
      })

      expect(report.profileId).toBe(testProfId)
      expect(report.overallCompliance).toBe('PASS')
      expect(report.modules.clientHints.status).toBe('PASS')
      expect(report.modules.navigator.status).toBe('PASS')
      expect(report.modules.apiAvailability.status).toBe('PASS')
      expect(report.modules.storageLifecycle.status).toBe('PASS')
      expect(report.modules.sessionPersistence.status).toBe('PASS')
      expect(report.modules.browserIntegrity.status).toBe('PASS')
      expect(report.modules.authDiagnostics.isRateLimitDetected).toBe(true)
      expect(report.recommendedFixes.length).toBeGreaterThan(0)
    })
  })
})
