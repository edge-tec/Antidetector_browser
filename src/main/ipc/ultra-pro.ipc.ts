// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Ultra-Pro Suite IPC Handlers
// Exposes: Cookie Robot, 2FA TOTP Account Vault, Stealth Score Audit,
// and Synchronizer Humanize (Delay & Click Jitter) Controls.
// ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import {
  listVaultAccounts,
  upsertVaultAccount,
  revealVaultPassword,
  deleteVaultAccount,
  generateTotpCode,
  autoFillVaultAccount,
  type VaultAccountInput
} from '../security/totp.service'
import {
  COOKIE_ROBOT_PRESETS,
  getCookieRobotRuns,
  runCookieRobot,
  runBatchCookieRobot,
  type CookieRobotOptions,
  type BatchCookieRobotOptions
} from '../automation/cookie-robot.service'
import { auditProfileStealthScore } from '../browser/stealth-score.service'
import { windowSynchronizer, type SyncHumanizeConfig } from '../browser/window-synchronizer'
import { parseBulkProxies, importBulkProxies, checkIpFraudScore } from '../network/proxy-bulk-fraud.service'
import { buildCamoufoxEnvConfig } from '../browser/multi-kernel-manager'
import { ProfileRepository } from '../database/repositories/profile.repo'

export function registerUltraProHandlers(): void {
  // ── 2FA (TOTP) & Account Vault ──
  ipcMain.handle('ultrapro:vault:list', (_e, profileId?: string) => {
    try {
      return { success: true, accounts: listVaultAccounts(profileId) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:vault:upsert', (_e, input: VaultAccountInput) => {
    try {
      return { success: true, account: upsertVaultAccount(input) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:vault:reveal', (_e, accountId: string) => {
    try {
      return { success: true, ...revealVaultPassword(accountId) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:vault:delete', (_e, accountId: string) => {
    try {
      return { success: true, deleted: deleteVaultAccount(accountId) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:vault:totp', (_e, secret: string) => {
    try {
      return { success: true, ...generateTotpCode(secret) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:vault:autofill', async (_e, accountId: string) => {
    try {
      const res = await autoFillVaultAccount(accountId)
      return { success: true, ...res }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Cookie Robot (Profile Warm-Up) ──
  ipcMain.handle('ultrapro:cookie-robot:presets', () => {
    return { success: true, presets: COOKIE_ROBOT_PRESETS }
  })

  ipcMain.handle('ultrapro:cookie-robot:runs', (_e, profileId?: string) => {
    try {
      return { success: true, runs: getCookieRobotRuns(profileId) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:cookie-robot:run', async (_e, options: CookieRobotOptions) => {
    try {
      const run = await runCookieRobot(options)
      return { success: true, run }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:cookie-robot:run-batch', async (_e, options: BatchCookieRobotOptions) => {
    try {
      const summary = await runBatchCookieRobot(options)
      return { success: true, ...summary }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Built-in Fingerprint Stealth Score Audit ──
  ipcMain.handle('ultrapro:stealth:audit', (_e, profileId: string) => {
    try {
      const report = auditProfileStealthScore(profileId)
      return { success: true, report }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Window Synchronizer Humanize Controls ──
  ipcMain.handle('ultrapro:sync:humanize', (_e, cfg: Partial<SyncHumanizeConfig>) => {
    try {
      return { success: true, humanize: windowSynchronizer.setHumanizeConfig(cfg) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Bulk Proxy Importer & Live IP Fraud Score ──
  ipcMain.handle('ultrapro:proxy:parse-bulk', (_e, rawText: string, defaultType?: any) => {
    try {
      return { success: true, ...parseBulkProxies(rawText, defaultType) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:proxy:import-bulk', (_e, rawText: string, defaultType?: any) => {
    try {
      return { success: true, ...importBulkProxies(rawText, defaultType) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ultrapro:proxy:fraud-score', async (_e, ipOrHost: string) => {
    try {
      const report = await checkIpFraudScore(ipOrHost)
      return { success: true, report }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Camoufox C++ Native Kernel Config Preview ──
  ipcMain.handle('ultrapro:camoufox:config', (_e, profileId: string) => {
    try {
      const profile = ProfileRepository.findById(profileId)
      if (!profile) throw new Error('Profile not found')
      return { success: true, env: buildCamoufoxEnvConfig(profile) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
