# AntiProfiles v2.0 — Phase P5 Independent Security & Hardening Report

**Audit Date:** 2026-11-19  
**Branch:** `feat/enterprise-upgrade`  
**Baseline Commit Audited:** `52a9e41`  

---

## 1. Security Controls Independently Verified

| Control | File & Location | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Electron `contextIsolation: true` & `nodeIntegration: false` | `src/main/index.ts:72-73` | **VERIFIED WORKING** | Confirmed in BrowserWindow `webPreferences` |
| External Window Popups Restricted | `src/main/index.ts:96-101` | **VERIFIED WORKING** | Denies popups; allows only `http:`/`https:` via `shell.openExternal` |
| IPC Sender Origin Validation (P5 Hardened) | `src/main/ipc/enterprise.ipc.ts` | **VERIFIED WORKING** | All 53 `enterprise:*` IPC handlers wrapped in `secureHandle()` enforcing `assertTrustedIpcSender()` (`file://` or localhost dev only); external web origins rejected (`enterprise-p5-hardening.test.ts`) |
| SSRF Protection on Proxy Rotation URLs (P5 Hardened) | `src/main/network/proxy-rotation.ts` | **VERIFIED WORKING** | `assertSafeRotationUrl()` blocks `localhost`, `127.0.0.0/8`, `::1`, `169.254.169.254`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `file://` (`enterprise-p5-hardening.test.ts`) |
| Pre-Extraction Zip-Slip & Symlink Defense (P5 Hardened) | `src/main/browser/extension-manager.ts` | **VERIFIED WORKING** | `assertSafeZipEntryList()` inspects archive entries BEFORE extraction; `assertSafeDirectoryTree()` rejects symlinks & out-of-root paths (`enterprise-p5-hardening.test.ts`, `enterprise-platform.test.ts`) |
| Local API v2 Security (P5 Hardened) | `src/main/automation/server.ts` | **VERIFIED WORKING** | Strictly bound to `127.0.0.1`, Host header DNS-rebinding check, Bearer token auth, rate limit, `express.json({ limit: '5mb' })`, bulk start/stop capped at 50 profiles |
| AES-256-GCM + scrypt + AAD + SHA-256 Cloud Backup | `src/main/storage/cloud-sync-engine.ts` | **VERIFIED WORKING** | Random 32-byte salt + 12-byte IV per archive, `scryptSync(N=16384, r=8, p=1)`, AAD=`profileId:vN`, SHA-256 pre-decrypt check; wrong passphrase, wrong AAD, and tampered ciphertext all rejected (`enterprise-platform.test.ts`) |
| Backend RBAC & Proxy Credential Redaction | `src/main/security/rbac.ts`, `team.service.ts` | **VERIFIED WORKING** | 5 roles / 13 permissions enforced on backend; `sanitizeProxyForRole()` strips `password`/`encryptedPassword` for Operator & Viewer (`enterprise-platform.test.ts`) |

---

## 2. Remaining Medium/Low Recommendations (Post-Release)
1. **Electron `sandbox: true`:** Currently `sandbox: false` in `src/main/index.ts:74`; verify preload has zero Node.js dependencies before enabling.
2. **Legacy `execSync` Path Interpolation:** Older launch/kill paths in `runtime-provisioner.ts` and `process-tracker.ts` still use `execSync` with quoted strings; all new P0–P5 modules use `execFileSync` with argument arrays (`shell: false`).
3. **macOS Code Signing & Notarization:** Production `.dmg` distribution requires an Apple Developer ID certificate (`CSC_IDENTITY_AUTO_DISCOVERY=true`).
