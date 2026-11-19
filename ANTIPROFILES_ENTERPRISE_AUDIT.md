# AntiProfiles v2.0 — Enterprise Repository Audit

**Audit Date:** 2026-11-19  
**Git Base Commit:** `d99d19a67127c18c393695239c5e3965cacdd805`  
**Feature Branch:** `feat/enterprise-upgrade`  

---

## 1. Executive Summary

AntiProfiles v2.0 is an Electron 33 + React 19 + TypeScript + SQLite (`better-sqlite3`) desktop browser profile management platform with an embedded Express Local API, dual-engine browser provisioning (Chromium & Firefox), a comprehensive fingerprint/device template system, proxy management with local auth bridge, and commercial SaaS modules (Auth, Subscriptions, Payments, Affiliates, Support, Auto-Updater).

This audit verifies actual runtime behavior—not merely the presence of files or interfaces—across `src/main/`, `src/preload/`, `src/renderer/`, database migrations, and tests.

---

## 2. Subsystem-by-Subsystem Audit

| Subsystem | Key Files | Verified Runtime Status | Gaps & Limitations |
| :--- | :--- | :--- | :--- |
| **Browser Runtime Provisioning** | `src/main/browser/runtime-provisioner.ts`, `chromium-downloader.ts`, `chromium-version-manager.ts`, `firefox-downloader.ts` | **Working (Single Version)** — Auto-downloads Chromium snapshot (`LAST_CHANGE`) and Firefox `131.0`. | No multi-version Chrome for Testing kernel manager per profile; no SHA256 checksum verification; Firefox uses Release channel (blocks unsigned extensions instead of ESR/Dev Edition). |
| **Browser Launcher & CDP Emulation** | `src/main/browser/launcher.ts`, `src/main/browser/injection/injector.ts` | **Working (Recently Fixed)** — Spawns Chromium with dedicated local CDP port (`--remote-debugging-port`), connects Puppeteer, applies CDP `Network.setUserAgentOverride`, `Emulation.setDeviceMetricsOverride` (mobile), `setTouchEmulationEnabled`, `setHardwareConcurrencyOverride`, `setTimezoneOverride`, `setLocaleOverride`, `setGeolocationOverride`, plus MV3 guard extension. | Firefox still relies on `user.js` + unsigned extension (which Release Firefox ignores). |
| **Fingerprint & Browser Compatibility Scripts** | `src/main/browser/injection/scripts/*.ts` | **Working (Core Vectors)** — Navigator, Screen, WebGL (vendor/renderer), Canvas, Audio, ClientRects, Fonts, Geolocation, Timezone, WebRTC, MediaDevices, Battery, NetworkInfo, Permissions. | Missing `webgpu.ts`, `speech.ts` (SpeechSynthesis), full WebGL2 capability parameters/extensions (`MAX_TEXTURE_SIZE`, `getSupportedExtensions`), and Worker/OffscreenCanvas consistency. |
| **Device Catalog & Consistency** | `src/main/fingerprint/device-templates.ts`, `consistency.ts`, `browser/device/device-consistency.ts` | **Working** — Windows 10/11, macOS Intel/ARM, Linux, Android, iOS templates and consistency scoring. | Needs strict runtime-vs-profile major version mismatch warnings without silent substitution. |
| **Profile Lifecycle & Storage** | `src/main/browser/profile-manager.ts`, `src/main/database/repositories/profile.repo.ts` | **Working** — Isolated `userDataDir`, lock system, crash recovery, health checker. | `deleteProfile()` permanently deletes profiles immediately; no Trash / Recycle Bin (`deleted_at`, `deleted_by`, 30-day retention, restore). |
| **Proxy Management** | `src/main/network/proxy-bridge.ts`, `proxy-manager.ts`, `proxy-tester.ts`, `geo-lookup.ts`, `proxy.repo.ts` | **Working** — HTTP/HTTPS/SOCKS4/SOCKS5, local auth bridge, GeoIP auto-sync for timezone & geolocation. | Missing proxy rotation URL trigger, backup failover proxy, proxy usage history, and credential redaction for non-admin team members. |
| **Local Automation REST API** | `src/main/automation/server.ts` | **Working (v1)** — Express on `127.0.0.1`, Bearer token, DNS rebinding check, profile CRUD + start/stop/status. | Missing Trash restore, Runtime list/start/restart, Proxy rotate/test, Cookie import/export/read/clear, Bulk start/stop, Automation workflow endpoints, and API key rotation/scopes. |
| **Multi-Window Synchronizer** | *Not present* | **Not Implemented** | No master-to-slave CDP input/navigation sync, no grid window tiling (2x2/3x3/4x4). |
| **Extension Center** | *Only internal guard extension* | **Not Implemented** | No user-managed ZIP/CRX upload, manifest security inspection, path-traversal protection, or bulk profile/group extension assignment. |
| **No-Code RPA & Scheduler** | `src/main/services/gmail-automation-engine.ts` | **Partial (Gmail only)** | No general-purpose visual workflow builder, workflow execution engine, or cron scheduler. |
| **Cookie Management Center** | `src/renderer/utils/cookie-parser.ts` | **Partial (Parser only)** | No full Cookie Manager (inspect/search/filter/import/export/delete per profile via CDP or SQLite). |
| **E2E Encrypted Cloud Sync** | `src/main/services/sync.service.ts` | **Partial (Auth/Plan State only)** | Does not archive, AES-256-GCM encrypt, or sync browser profile data (cookies, localStorage, IndexedDB, bookmarks) to S3/R2. |
| **Team Workspace & RBAC** | `subscription.repo.ts` (`team_members` limit only) | **Not Implemented** | No `teams`, `team_members`, `invitations`, `roles`, `permissions`, profile sharing/transfer, or backend RBAC middleware. |
| **Database & Migrations** | `src/main/database/migrations/001`–`012`, `runner.ts` | **Working** — 12 SQLite migrations + fallback DB. | `runner.ts` silently catches all errors during `migration.up(db)` and lacks explicit transaction wrapping per migration. |
| **Electron Security** | `src/main/index.ts`, `src/preload/index.ts`, `src/main/security/` | **Good Baseline** — `contextIsolation: true`, `nodeIntegration: false`, `safeStorage` for passwords. | `sandbox: false` on main BrowserWindow; `localStorage` used for session token in preload; IPC handlers need centralized sender & permission validation; `execSync` calls with interpolated paths need hardening. |

---

## 3. Build & Baseline Verification

- `electron-vite build`: **PASSED** (0 errors, main + preload + renderer bundles built cleanly).
- Targeted unit tests (`enterprise-os-device-emulation`, `browser-consistency`, `runtime-provisioner`, `firefox-useragent-rules`, `realtime-profile-validator`): **31/31 PASSED**.
- Full unit test suite: **516 passed** (3 local-socket test files fail only inside network-isolated sandboxes with `EPERM 127.0.0.1`).
