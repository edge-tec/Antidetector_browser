# AntiProfiles v2.0 — Enterprise Implementation Roadmap

## Execution Strategy

Work incrementally by phase, preserving all existing functionality, database records, and backward compatibility. Every phase concludes with automated unit/integration tests and a verified `electron-vite build`.

---

## Phase P0 — Browser Runtime & Fingerprint Integrity (Immediate Priority)
1. **Multi-Kernel Browser Version Manager (`src/main/browser/multi-kernel-manager.ts`)**
   - Chrome for Testing (CfT) JSON manifest integration with curated fallback versions (128, 131, 134, 136).
   - Isolated per-engine/per-version directories under `userData/browser-runtimes/chromium/<platform>/<arch>/<version>`.
   - SHA-256 integrity verification, install/uninstall/rollback, compatibility checks (never silently substituting a requested version without explicit reporting).
   - Firefox ESR / Developer Edition channel support with runtime detection and extension compatibility checks.
2. **Advanced Browser Compatibility (`src/main/browser/injection/scripts/`)**
   - Add `webgpu.ts` (WebGPU adapter info consistency matching profile GPU).
   - Add `speech.ts` (OS-consistent `speechSynthesis.getVoices()`).
   - Upgrade `webgl.ts` (WebGL2 parameters: `MAX_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE`, `MAX_VERTEX_ATTRIBS`, `MAX_COMBINED_TEXTURE_IMAGE_UNITS`, `getSupportedExtensions()`).
   - Add `worker-consistency.ts` (Worker / OffscreenCanvas / `navigator` consistency).
   - Wire all new modules into `injector.ts` and add comprehensive V8 syntax & behavior regression tests.
3. **Runtime Diagnostics Center (`src/main/browser/runtime-diagnostics.ts`)**
   - Unified diagnostic report per profile/system: engine, binary version, compatibility, proxy status, extension health, recent launch errors.

## Phase P1 — Flagship Product Features
1. **Database Migration `013_enterprise_platform.ts`**
   - Additive, non-destructive tables: `browser_runtimes`, `extensions`, `profile_extensions`, `automation_workflows`, `automation_executions`, `cloud_backups`, `teams`, `team_members`, `team_invitations`, `profile_shares`, `proxy_rotation_history`, plus soft-delete columns (`deleted_at`, `deleted_by`) on `profiles` and rotation/failover columns on `proxies`.
2. **Trash & Recycle Bin (`src/main/browser/trash-manager.ts`)** — Soft delete, 30-day retention, restore, bulk restore/purge, audit logging.
3. **Extension Center (`src/main/browser/extension-manager.ts`)** — Secure ZIP/CRX extraction (zip-slip/path-traversal prevention), manifest validation, permission risk warnings, profile & group assignment, Chromium `--load-extension` multi-extension support.
4. **Cookie & Session Management (`src/main/browser/cookie-manager.ts`)** — Inspect, search, filter, import (JSON/Netscape), export, delete, clear, and session backup per profile via CDP & profile storage.
5. **Multi-Window Synchronizer (`src/main/browser/window-synchronizer.ts`)** — Master/slave CDP action mirroring (navigation, clicks, typing, scrolling), window exclusion, 2x2 / 3x3 / 4x4 grid tiling via CDP `Browser.setWindowBounds`, isolated error handling.
6. **No-Code RPA Workflow Engine & Scheduler (`src/main/automation/rpa-engine.ts`)** — Action runner (15+ actions), variables, conditionals, loops, pause/resume/stop, execution logs, cron/interval scheduler.
7. **E2E Encrypted Cloud Profile Sync (`src/main/storage/cloud-sync-engine.ts`)** — Client-side AES-256-GCM encryption with scrypt/PBKDF2 key derivation, SHA-256 archive integrity, S3/R2 compatible storage provider interface, version history & restore.

## Phase P2 — Enterprise Team Management & Proxy Pro
1. **Team Workspace & Granular RBAC (`src/main/security/rbac.ts`, `src/main/services/team.service.ts`)** — Owner/Admin/Manager/Operator/Viewer roles, backend permission enforcement (`profile.*`, `proxy.*`, `team.*`, `audit.view`), workspace creation, invitations, profile sharing/transfer, proxy credential redaction.
2. **Advanced Proxy Management (`src/main/network/proxy-rotation.ts`)** — Rotation URL execution, manual/scheduled rotation, failover to backup proxy, usage & rotation history.

## Phase P3 — Local Automation API v2 & IPC Integration
1. **Upgrade `src/main/automation/server.ts`** — Full v2 endpoints (profiles, restore, runtimes, proxy rotate/failover, cookies, RPA workflows, bulk start/stop, token rotation & scopes) while preserving 100% v1 backward compatibility.
2. **IPC & Preload Exposure (`src/main/ipc/enterprise.ipc.ts`, `src/preload/index.ts`)** — Wire all new backend services safely through `contextBridge`.
3. **Enterprise UI Integration** — Expose new views/controls in `src/renderer/` wired directly to real IPC handlers.
