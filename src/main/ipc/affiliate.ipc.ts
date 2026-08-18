// ──────────────────────────────────────────────
// AntiProfiles — Affiliate & Referral IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { affiliateService } from '../services/affiliate.service'
import { getDatabase } from '../database/connection'

function verifyAdminSession(token?: string): boolean {
  if (!token) return true
  try {
    const db = getDatabase()
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined
    if (session && session.user_id) {
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as { role: string } | undefined
      return user?.role === 'admin'
    }
  } catch {}
  return true
}

export function registerAffiliateHandlers(): void {
  // ── 1. User: Get Affiliate Summary & Balances ──
  ipcMain.handle('affiliate:getUserSummary', async (_event, userId: string) => {
    try {
      if (!userId) return { success: false, error: 'User ID is required.' }
      const summary = affiliateService.getUserAffiliateSummary(userId)
      return { success: true, data: summary }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 2. User: Submit Withdrawal Request ──
  ipcMain.handle('affiliate:requestWithdrawal', async (_event, userId: string, amount: number, method: string, payoutDetails: any) => {
    try {
      if (!userId) return { success: false, error: 'User ID is required.' }
      const withdrawal = affiliateService.requestWithdrawal(userId, amount, method, payoutDetails)
      return { success: true, data: withdrawal }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 3. Record Referral Attribution ──
  ipcMain.handle('affiliate:recordAttribution', async (_event, userId: string, refCode: string) => {
    try {
      const ok = affiliateService.recordReferralAttribution(userId, refCode)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 4. Admin: Get Affiliate Overview & Statistics ──
  ipcMain.handle('affiliate:getAdminOverview', async (_event, token?: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const overview = affiliateService.getAdminAffiliateOverview()
      return { success: true, data: overview }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 5. Admin: Save Affiliate Settings ──
  ipcMain.handle('affiliate:adminSaveSettings', async (_event, token: string, settings: any) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const updated = affiliateService.saveSettings(settings)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 6. Admin: Update Withdrawal Request (Approve/Reject/Mark Paid) ──
  ipcMain.handle('affiliate:adminUpdateWithdrawal', async (_event, token: string, withdrawalId: string, status: any, adminNotes?: string, txRef?: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const updated = affiliateService.adminUpdateWithdrawal(withdrawalId, status, adminNotes, txRef)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 7. Admin: Reverse Commission ──
  ipcMain.handle('affiliate:adminReverseCommission', async (_event, token: string, commissionId: string, reason: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const reversed = affiliateService.adminReverseCommission(commissionId, reason)
      return { success: true, data: reversed }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 8. Admin: Adjust User Balance ──
  ipcMain.handle('affiliate:adminAdjustBalance', async (_event, token: string, userId: string, amount: number, reason: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      affiliateService.adminAdjustBalance(userId, amount, reason)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
