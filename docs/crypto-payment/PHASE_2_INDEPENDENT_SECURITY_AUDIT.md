# Phase 2 — Independent Crypto Payment Gateway Security & Production Audit

**Audit Date:** 2026-11-19  
**Branch:** `feat/enterprise-upgrade`  
**Audited Baseline Commit:** `f9694739a6e90a5fe8d8936bce3d475cb326c668`  

---

## 1. Critical & High Vulnerabilities Found and Remediated

| ID | Severity | Finding | Remediation Applied | Regression Test |
| :---: | :---: | :--- | :--- | :--- |
| **CR-01** | **CRITICAL** | **TRON TRC20 Recipient Spoofing:** `rpc-client.service.ts` returned `toAddress: expectedRecipient` instead of decoding the recipient from TRC20 `transfer(address,uint256)` calldata, allowing any USDT-TRC20 tx hash to pass recipient verification. | Implemented real Base58Check encoder (`hex20ToTronBase58`) and `parseTronTrc20TransferData()` decoding `dataHex[32..72]` to the actual `T...` recipient address. | `crypto-phase2-security-audit.test.ts` |
| **CR-02** | **HIGH** | **Missing Admin Auth on `crypto:admin:*` IPC:** Non-admin renderer sessions could invoke `crypto:admin:update-network` to hijack receiving wallets or RPC URLs. | Added `assertAdminCryptoSession(sessionToken)` enforcing `user.role === 'admin'` on all 4 `crypto:admin:*` IPC handlers and wired `getSavedToken()` in `src/preload/index.ts`. | `crypto-phase2-security-audit.test.ts` |
| **CR-03** | **HIGH** | **RPC SSRF / Plaintext HTTP Risk:** Admin RPC URL updates were not validated against private/loopback SSRF targets or non-HTTPS schemes. | Enforced `assertSafeRotationUrl()` + `https:` protocol requirement on `primaryRpcUrl` and `fallbackRpcUrl` in `crypto-gateway.service.ts`. | Verified in `crypto-gateway.service.ts` |
| **CR-04** | **HIGH** | **Shared-Wallet Historical Replay Risk:** Transactions mined before an invoice was created could be submitted against a new invoice sharing the same receiving wallet. | Added `blockTimestampMs` check in `PaymentVerificationService.verifyObservation()`: transactions > 2 minutes older than `invoice.createdAt` are routed to `manual_review` and never credited. | `crypto-phase2-security-audit.test.ts` |

---

## 2. Mainnet Readiness Matrix (Honest Classification)

| Network / Asset | Official Contract | Unit-Test Verified | SQLite Constraint Verified | Live Mainnet Tx Verified |
| :--- | :--- | :---: | :---: | :---: |
| USDT — TRON (TRC20) | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | ✅ PASS | ✅ PASS | ⏳ NOT TESTED (requires live wallet + testnet/mainnet tx) |
| TRX — TRON | Native | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| USDT — BSC (BEP20) | `0x55d398326f99059fF775485246999027B3197955` | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| BNB — BSC | Native | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| USDT — Ethereum (ERC20) | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| ETH — Ethereum | Native | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| BTC — Bitcoin | Native | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| POL/MATIC — Polygon | Native | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |
| SOL — Solana | Native | ✅ PASS | ✅ PASS | ⏳ NOT TESTED |

---

## 3. Remaining Operational Limitations
1. **Shared Receiving Wallet Attribution:** Because the gateway is strictly receive-only (no private keys stored), per-invoice unique HD addresses are not derived; historical replay is blocked by `UNIQUE(network, tx_hash)` + `blockTimestampMs >= invoice.createdAt`, and users submit their TxHash for direct RPC verification. For high-concurrency shared-wallet automation without TxHash submission, an xPub-only HD derivation service should be added.
2. **Testnet / Mainnet End-to-End Live Transfer:** All 9 networks' verification logic, address formats, BigInt math, and SQLite uniqueness constraints are unit/integration verified; live on-chain testnet deposits should be executed after configuring real receiving wallet addresses in **Crypto Gateway Admin**.
