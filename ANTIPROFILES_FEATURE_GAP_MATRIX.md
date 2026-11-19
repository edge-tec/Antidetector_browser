# AntiProfiles v2.0 — Enterprise Feature Gap Matrix

**Comparison Baseline:** AdsPower · ixBrowser · GoLogin  

| Phase | Feature Area | Current Status | Target Enterprise Capability |
| :---: | :--- | :--- | :--- |
| **P0** | Multi-Kernel Browser Version Manager | `PARTIALLY IMPLEMENTED` (single snapshot) | Chrome for Testing multi-version catalog, per-profile version pinning, SHA256 verification, no silent substitution, install/remove/rollback |
| **P0** | Advanced Browser Compatibility | `PARTIALLY IMPLEMENTED` | Add `webgpu.ts`, `speech.ts`, full WebGL2 parameters/extensions, Worker/OffscreenCanvas consistency, regression test suite |
| **P0** | Firefox ESR / Developer Edition | `PARTIALLY IMPLEMENTED` | Switch managed Firefox channel to ESR/Developer Edition, extension signature validation, profile isolation |
| **P0** | Runtime Diagnostics Center | `PARTIALLY IMPLEMENTED` | Unified diagnostics service + IPC + UI showing engine, version, compatibility, proxy status, extension health, launch errors |
| **P1** | Multi-Window Synchronizer | `NOT IMPLEMENTED` | Master/slave CDP action mirroring, window exclusion, 2x2 / 3x3 / 4x4 grid tiling, error isolation, sync logs |
| **P1** | Extension Center | `NOT IMPLEMENTED` | ZIP/CRX upload, manifest & path-traversal validation, permission warnings, bulk install to profiles/groups, enable/disable/remove |
| **P1** | No-Code RPA Builder & Scheduler | `NOT IMPLEMENTED` | Visual workflow editor, 15+ actions (navigate, wait, click, type, select, scroll, screenshot, extract, variables, loop, condition), cron scheduler |
| **P1** | Cookie & Session Management | `PARTIALLY IMPLEMENTED` | View/search/filter/import/export/delete/clear/backup cookies per profile via CDP & storage |
| **P1** | E2E Encrypted Cloud Profile Sync | `NOT IMPLEMENTED` | AES-256-GCM client-side encrypted profile archive (PBKDF2/scrypt key derivation), S3/R2 adapter interface, version history, conflict resolution |
| **P2** | Team Workspace & Granular RBAC | `NOT IMPLEMENTED` | Workspaces, invitations, Owner/Admin/Manager/Operator/Viewer roles, backend-enforced permissions (`profile.*`, `proxy.*`, `team.*`, `audit.view`) |
| **P2** | Trash & Recycle Bin | `NOT IMPLEMENTED` | Soft delete (`deleted_at`, `deleted_by`), 30-day retention, single/bulk restore, permanent purge, deletion audit logs |
| **P2** | Advanced Proxy Management | `PARTIALLY IMPLEMENTED` | Proxy groups, rotation URL + manual/scheduled rotation, backup failover proxy, usage history, credential redaction |
| **P3** | Local Automation API v2 | `PARTIALLY IMPLEMENTED` | Complete v2 endpoints (profiles, restore, runtimes, proxy rotate/failover, cookies, automation workflows, bulk start/stop, token rotation & scopes) |
| **UI** | Enterprise Dashboard & Navigation | `PARTIALLY IMPLEMENTED` | Unified 17-section enterprise sidebar, dark/light theme, KPI dashboard, dedicated views wired to real backend IPC |
