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
  type VaultAccountInput
} from '../security/totp.service'
import {
  COOKIE_ROBOT_PRESETS,
  getCookieRobotRuns,
  runCookieRobot,
  type CookieRobotOptions
} from '../automation/cookie-robot.service'
import { auditProfileStealthScore } from '../browser/stealth-score.service'
import { windowSynchronizer, type SyncHumanizeConfig } from '../browser/window-synchronizer'

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
}
