# AntiProfiles v2.0 — Security & Privacy Audit

**Audit Date:** 2026-11-19  
**Scope:** Electron main/preload/renderer security, IPC, Local API, Credential Storage, File/Shell Operations, Cloud Encryption  

---

## 1. Security Posture Summary

| Control | Current State | Risk Level | Remediation |
| :--- | :--- | :---: | :--- |
| `contextIsolation` | Enabled (`true`) in `src/main/index.ts:72` | Low | Keep enabled; verify all new BrowserWindows enforce it. |
| `nodeIntegration` | Disabled (`false`) in `src/main/index.ts:73` | Low | Keep disabled. |
| `sandbox` | Disabled (`false`) in `src/main/index.ts:74` | Medium | Preload only uses `contextBridge`/`ipcRenderer`; evaluate enabling `sandbox: true` after verifying preload bundle has no Node imports. |
| `setWindowOpenHandler` | Denies popups and restricts `shell.openExternal` to `http:`/`https:` | Low | Maintain strict protocol allowlist. |
| Credential Storage | `safeStorage.encryptString` / `decryptString` (`src/main/security/encryption.ts`) | Low | Keep OS Keychain encryption; never log decrypted proxy passwords or return them to non-privileged team members. |
| Session Token Storage | Stored in renderer `localStorage` (`src/preload/index.ts:12`) | Medium | Mitigate XSS via strict CSP and avoid exposing raw tokens to third-party scripts. |
| Local API (`server.ts`) | Binds `127.0.0.1`, validates `Host` header (DNS rebinding), Bearer token, rate limit | Low-Medium | Add request body size limits, token rotation endpoint, permission scopes, and sanitized error responses. |
| Shell Execution (`execSync`) | Multiple `execSync` calls interpolate file paths (`runtime-provisioner.ts`, `launcher.ts`, `process-tracker.ts`) | High | Prefer `execFileSync`/`spawn` with argument arrays (`shell: false`) for all new modules and strictly validate/normalize paths. |
| Extension Upload Security | Not yet implemented | High (when added) | Must enforce zip-slip path traversal prevention, manifest schema validation, file size limits, and permission risk warnings. |
| Cloud Profile Sync | Not yet implemented | High (when added) | Must enforce client-side AES-256-GCM encryption, PBKDF2/scrypt key derivation, never store raw encryption keys alongside archives, and verify SHA-256 + GCM auth tags before restore. |
| Team RBAC Enforcement | Not yet implemented | High (when added) | All permissions must be enforced on backend IPC and REST API layers—never UI-only. |

---

## 2. Threat Model for New Enterprise Modules

1. **Extension Center (ZIP/CRX Upload):**
   - *Threat:* Zip Slip (`../../etc/passwd` or overwriting app files), malicious `manifest.json`, oversized archives (zip bomb).
   - *Mitigation:* Validate every archive entry path resolves strictly inside the target staging directory (`path.resolve(dest, entry).startsWith(dest + path.sep)`), enforce max uncompressed size & file count, validate `manifest_version` (2 or 3) and required fields, flag dangerous permissions (`<all_urls>`, `cookies`, `webRequest`, `debugger`, `nativeMessaging`) for explicit user confirmation.
2. **Cloud Profile Sync (S3/R2):**
   - *Threat:* Storage bucket compromise exposing user session cookies/tokens; archive tampering.
   - *Mitigation:* Client-side AES-256-GCM authenticated encryption with per-archive random 96-bit IV + 256-bit salt + `scryptSync` key derivation; authenticated associated data (AAD) binding `profileId` + `version`; SHA-256 integrity hash verified prior to decryption/extraction.
3. **Local Automation API v2:**
   - *Threat:* Cross-site requests from visited web pages hitting `127.0.0.1`, brute-force token guessing, oversized payloads.
   - *Mitigation:* Strict `127.0.0.1` binding, `Host` header allowlist, `Origin` check, Bearer token with constant-time comparison (`crypto.timingSafeEqual`), permission scopes, rate limiting, `express.json({ limit: '5mb' })`.
4. **Proxy Credentials & Team RBAC:**
   - *Threat:* Operator/Viewer team members extracting paid residential proxy passwords.
   - *Mitigation:* Strip `encryptedPassword` and plaintext `password` from all proxy DTOs returned to roles without `proxy.manage`; never log proxy credentials in `logger` or `audit-logger`.
