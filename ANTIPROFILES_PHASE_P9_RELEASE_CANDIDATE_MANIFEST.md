# AntiProfiles v2.0 — Phase P9 Release Candidate Artifact Manifest

**Date:** 2026-11-19  
**Branch:** `feat/enterprise-upgrade`  
**Source Commit:** `1233c7140ceb28b32d796bba9cf6feabce078fb4`  
**Build Runner:** Local macOS `27.2.1` (`arm64`)  

| Artifact Filename | Platform | Arch | File Size | SHA-256 Checksum (`shasum -a 256 -c`) | Signing Status | Verification Evidence |
| :--- | :---: | :---: | :---: | :--- | :---: | :--- |
| `dist/AntiProfiles-macOS-arm64.dmg` | macOS | `arm64` | 116,235,821 bytes | `fc766c90a88c62e857d594a7adb36d6b612582df688e07655639578f4d2250ec` (**OK**) | **UNSIGNED** (ad-hoc/skipped) | `codesign --verify` reported unsigned bundle (`CSC_IDENTITY_AUTO_DISCOVERY=false`); requires Apple Developer ID + `notarytool` |
| `AntiProfiles-macOS-x64.dmg` / `.zip` | macOS | `x64` | — | — | **BLOCKED** | Requires CI runner + Apple Developer ID secrets |
| `AntiProfiles-Windows-x64.exe` (NSIS + Portable) | Windows | `x64` | — | — | **BLOCKED** | Requires GitHub `windows-latest` runner + `WIN_CSC_LINK` |
| `AntiProfiles-Linux-x64.AppImage` / `.deb` / `.rpm` | Linux | `x64` | — | — | **BLOCKED** | Requires GitHub `ubuntu-latest` runner |
