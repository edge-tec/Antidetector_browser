# AntiProfiles v2.0 — Final Commercial Go-Live Checklist

**Date:** 2026-11-19  
**Branch:** `feat/enterprise-upgrade`  
**Automated Verification:** **9 test suites / 42/42 tests PASSED** | `electron-vite build` **0 errors**  

---

## Final Commercial Release Decision

> **B. CONDITIONALLY APPROVED — SPECIFIC BLOCKERS REMAIN**

All software engineering, security hardening, disaster recovery, database migration, UI integration, and CI/CD release-engineering gates are **PASS**. Commercial public launch is ready to proceed immediately once the 5 external infrastructure/signing actions below are executed by the release owner.

---

## Go-Live Gate Checklist

| # | Gate | Status | Exact Command / Action to Close |
| :---: | :--- | :---: | :--- |
| 1 | Codebase, P0–P8 Tests (42/42), Production Build | **PASS** | Verified locally (`vitest run` + `electron-vite build`) |
| 2 | Electron, IPC, SSRF, Zip-Slip, RBAC, Crypto, Log Sanitizer | **PASS** | Verified locally (`enterprise-p5/p6/p7/p8` test suites) |
| 3 | Local DB Atomic Backup/Restore & 30-Day Trash Recovery | **PASS** | Verified locally (`enterprise-p8-readiness.test.ts`) |
| 4 | CI/CD Least-Privilege Pipeline (`contents: read`) & `SHA256SUMS.txt` | **PASS** | `.github/workflows/release.yml` + `scripts/generate-release-checksums.mjs` |
| 5 | Push `feat/enterprise-upgrade` & Add GitHub Secrets | **BLOCKED** | `git push -u origin feat/enterprise-upgrade`, then add `CSC_*`, `APPLE_*`, `WIN_CSC_*`, `ANTIPROFILES_S3_*` in GitHub Repo Settings → Secrets |
| 6 | Build Signed Release Candidate (`v2.0.0-rc.1`) on macOS/Win/Linux | **BLOCKED** | Trigger `.github/workflows/release.yml` (`workflow_dispatch`) and verify `codesign`, `spctl`, `stapler`, and `signtool` |
| 7 | Live S3 / Cloudflare R2 Bucket Round-Trip Verification | **BLOCKED** | Configure `ANTIPROFILES_S3_*` and run upload → download → SHA-256 verify → restore → cleanup |
| 8 | Deploy HTTPS Update Feed (`releases.antiprofiles.com/updates`) | **BLOCKED** | Host signed artifacts + `latest*.yml` + `SHA256SUMS.txt` behind HTTPS |
| 9 | Interactive Multi-Browser Stress Benchmark (1/5/10/25/50) | **NOT TESTED** | Run live GUI benchmark on target hardware and document RAM/CPU limits |
