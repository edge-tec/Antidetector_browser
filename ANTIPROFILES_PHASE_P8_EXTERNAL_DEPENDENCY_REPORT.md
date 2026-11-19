# AntiProfiles v2.0 — Phase P8 External Dependency Inventory

**Date:** 2026-11-19  
**Branch:** `feat/enterprise-upgrade`  
**Validator:** `src/main/security/production-config-validator.ts` (`validateProductionEnvironment()`)  

| Dependency Category | Required Secrets / Resources | Configuration Location | Validation Command | Current Status | Owner Action Required |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Apple macOS Signing & Notarization** | `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | GitHub Actions Secrets + local keychain | `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/AntiProfiles.app && spctl --assess --type execute --verbose dist/mac-arm64/AntiProfiles.app && xcrun stapler validate dist/AntiProfiles-macOS-arm64.dmg` | **BLOCKED** | Provision Apple Developer ID Application certificate & App-Specific Password |
| **Windows Authenticode Signing** | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, native Windows CI runner | GitHub Actions Secrets (`windows-latest`) | `signtool verify /pa /v dist/AntiProfiles-Windows-x64.exe` | **BLOCKED** | Provision EV/OV Authenticode certificate & run `.github/workflows/release.yml` |
| **Linux Native Distribution** | Native Ubuntu/Fedora CI runner | GitHub Actions (`ubuntu-latest`) | `npm run package:linux:all` + install/launch smoke test | **BLOCKED** | Trigger `.github/workflows/release.yml` on `ubuntu-latest` |
| **Cloudflare R2 / S3 Production Bucket** | `ANTIPROFILES_S3_ENDPOINT`, `ANTIPROFILES_S3_BUCKET`, `ANTIPROFILES_S3_ACCESS_KEY`, `ANTIPROFILES_S3_SECRET_KEY` | `.env` / GitHub Secrets (never renderer) | Upload → Download → SHA-256 verify → Restore → Delete test object | **BLOCKED** | Create dedicated R2/S3 bucket with least-privilege PutObject/GetObject/DeleteObject policy |
| **Release Update Server** | HTTPS hosting at `https://releases.antiprofiles.com/updates` (stable & beta channels) | CDN / R2 / S3 behind HTTPS | `curl -fsI https://releases.antiprofiles.com/updates/latest-mac.yml` | **BLOCKED** | Deploy HTTPS release feed & upload signed artifacts + `SHA256SUMS.txt` |
| **Multi-Browser Hardware Stress Test** | Interactive desktop hardware (macOS/Windows/Linux) | Target release machine | Launch 1 / 5 / 10 / 25 / 50 profiles & record RAM/CPU/shutdown cleanup | **NOT TESTED** | Execute on target desktop machine before advertising 50+ concurrency |
