# AntiProfiles v2.0 — Phase P8 Disaster Recovery & Incident Response Runbook

**Date:** 2026-11-19  
**Verified Utility:** `src/main/storage/disaster-recovery.ts` + `src/main/storage/cloud-sync-engine.ts`  
**Automated Test Evidence:** `tests/unit/enterprise-p8-readiness.test.ts` (**PASSED**) + `tests/unit/enterprise-platform.test.ts` (**PASSED**)  

---

## 1. Tested Recovery Capabilities

| Recovery Scenario | Mechanism | Automated Test Status |
| :--- | :--- | :---: |
| **Local SQLite Database Backup & Atomic Restore** | `backupDatabaseFile()` + `verifyAndRestoreDatabaseFile()` (SHA-256 verification before atomic `fs.renameSync`; corrupted backups rejected) | **PASS** (`enterprise-p8-readiness.test.ts`) |
| **Encrypted Profile Backup & Restore** | `cloudSyncEngine.backupProfile()` / `restoreBackup()` (AES-256-GCM + scrypt + AAD + SHA-256; rejects wrong passphrase, cross-profile AAD, or tampered bytes) | **PASS** (`enterprise-platform.test.ts`) |
| **Accidental Profile Deletion** | `TrashManager` 30-day soft delete (`deleted_at`, `deleted_by`) + single/bulk restore | **PASS** (`enterprise-p5-hardening.test.ts`) |
| **Remote S3/R2 Outage Fallback** | Local encrypted vault remains operational; `S3CompatibleStorageProvider` retries 3x with backoff | **PASS** (local fallback) / **BLOCKED** (live S3 outage drill requires bucket) |

---

## 2. Production Incident Response Runbook

1. **Failed Release / Bad Update:** Halt release promotion; revert `latest*.yml` metadata on `https://releases.antiprofiles.com/updates` to previous signed version; keep `SHA256SUMS.txt` immutable.
2. **Credential Compromise (S3/R2 or Signing Cert):** Immediately revoke compromised R2/S3 access key or Apple/Windows certificate; rotate GitHub Actions secrets; audit bucket access logs; user profile archives remain encrypted at rest under user passphrases.
3. **Database Corruption:** Stop running browser profiles; run `verifyAndRestoreDatabaseFile()` against the latest SHA-256 verified `.sqlite.bak` snapshot.
4. **Browser Runtime Failure:** Open **Runtime Diagnostics Center** (`/api/v2/diagnostics`), clear download cache via `multiKernelManager.cleanupCache()`, and reinstall target Chrome for Testing / Firefox ESR kernel.
5. **Cloud Sync Outage:** App continues operating locally with isolated profile directories; retry encrypted backup once S3/R2 endpoint health returns.
