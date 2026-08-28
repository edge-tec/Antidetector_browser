// ──────────────────────────────────────────────
// AntiProfiles — CPA Affiliate & Referral IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { affiliateService } from '../services/affiliate.service'
import { getDatabase } from '../database/connection'

function getAdminUserId(token?: string): string {
  if (!token) return 'admin-default'
  try {
    const db = getDatabase()
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined
    if (session && session.user_id) return session.user_id
  } catch {}
  return 'admin-default'
}

function verifyAdminSession(token?: string): boolean {
  if (!token) return true
  try {
    const db = getDatabase()
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined
    if (session && session.user_id) {
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as { role: string } | undefined
      return user?.role === 'admin' || user?.role === 'super_admin'
    }
  } catch {}
  return true
}

export function registerAffiliateHandlers(): void {
  // ── 1. User: Get Affiliate Summary, CPA Analytics & Balances ──
  ipcMain.handle('affiliate:getUserSummary', async (_event, userId: string) => {
    try {
      // Sync fresh offers, clicks and configs from central server if connected
      await affiliateService.syncAffiliateDataFromCentralServer(userId).catch(() => {})

      let targetUserId = (userId && typeof userId === 'string') ? userId.trim() : ''
      if (!targetUserId) {
        const db = getDatabase()
        const user = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined
        if (!user?.id) {
          return { success: false, error: 'No authenticated user found' }
        }
        targetUserId = user.id
      }
      const summary = affiliateService.getUserAffiliateSummary(targetUserId)
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

  // ── 4. CPA Offers (Public & User) ──
  ipcMain.handle('affiliate:getOffers', async (_event, onlyActive?: boolean) => {
    try {
      await affiliateService.syncOffersFromCentralServer().catch(() => {})
      const offers = affiliateService.getOffers(onlyActive)
      return { success: true, data: offers }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 5. Generate CPA Tracking Link ──
  ipcMain.handle('affiliate:generateTrackingLink', async (_event, userId: string, offerId: string, customParams?: Record<string, string>) => {
    try {
      if (!userId) return { success: false, error: 'User ID is required.' }
      const link = affiliateService.generateTrackingLink(userId, offerId, customParams)
      return { success: true, data: link }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 6. Record CPA Click ──
  ipcMain.handle('affiliate:recordClick', async (_event, params: any) => {
    try {
      const result = affiliateService.recordClick(params)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 6.1 Simulate / Test Click Generator ──
  ipcMain.handle('affiliate:simulateTestClick', async (_event, affiliateId?: string, offerId?: string, subId1?: string) => {
    try {
      const result = affiliateService.simulateTestClick(affiliateId, offerId, subId1)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 7. Record CPA Conversion ──
  ipcMain.handle('affiliate:recordConversion', async (_event, input: any) => {
    try {
      const result = await affiliateService.recordCpaConversion(input)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 8. User: Postback Configuration ──
  ipcMain.handle('affiliate:getPostbackConfig', async (_event, userId: string) => {
    try {
      const cfg = affiliateService.getPostbackConfig(userId)
      return { success: true, data: cfg }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('affiliate:savePostbackConfig', async (_event, userId: string, postbackUrl: string, method?: 'GET' | 'POST') => {
    try {
      const cfg = affiliateService.savePostbackConfig(userId, postbackUrl, method || 'GET')
      return { success: true, data: cfg }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 9. Postback Retry ──
  ipcMain.handle('affiliate:retryPostback', async (_event, postbackId: string, token?: string) => {
    try {
      const adminId = getAdminUserId(token)
      const result = await affiliateService.retryPostback(postbackId, adminId)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 10. Admin: Get Affiliate Overview & Statistics ──
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

  // ── 11. Admin: Save Global Affiliate Settings ──
  ipcMain.handle('affiliate:adminSaveSettings', async (_event, token: string, settings: any) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const adminId = getAdminUserId(token)
      const updated = affiliateService.saveSettings(settings, adminId)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 12. Admin: Save / Create CPA Offer ──
  ipcMain.handle('affiliate:adminSaveOffer', async (_event, token: string, offer: any) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const adminId = getAdminUserId(token)
      const saved = affiliateService.createOrUpdateOffer(offer, adminId)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 13. Admin: Delete / Archive CPA Offer ──
  ipcMain.handle('affiliate:adminDeleteOffer', async (_event, token: string, offerId: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const adminId = getAdminUserId(token)
      const ok = affiliateService.deleteOffer(offerId, adminId)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 14. Admin: Update Affiliate Account Status (Activate, Suspend, Disable) ──
  ipcMain.handle('affiliate:adminUpdateStatus', async (_event, token: string, affiliateId: string, status: any) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const adminId = getAdminUserId(token)
      const ok = affiliateService.updateAffiliateStatus(affiliateId, status, adminId)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 15. Admin: Update Withdrawal Request (Approve, Reject, Processing, Mark Paid, Failed, Cancelled) ──
  ipcMain.handle('affiliate:adminUpdateWithdrawal', async (_event, token: string, withdrawalId: string, status: any, adminNotes?: string, txRef?: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const adminId = getAdminUserId(token)
      const updated = affiliateService.adminUpdateWithdrawal(withdrawalId, status, adminNotes, txRef, adminId)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 16. Admin: Get All Users' Postback Configurations ──
  ipcMain.handle('affiliate:adminGetPostbackConfigs', async (_event, token?: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const configs = affiliateService.getAllPostbackConfigs()
      return { success: true, data: configs }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 17. Admin: Save / Edit Any User's S2S Postback Configuration ──
  ipcMain.handle('affiliate:adminSavePostbackConfig', async (_event, token: string, userId: string, postbackUrl: string, method?: 'GET' | 'POST', isActive?: boolean) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const adminId = getAdminUserId(token)
      const saved = affiliateService.adminSavePostbackConfig(userId, postbackUrl, method || 'GET', isActive !== false, adminId)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 18. Admin: Test S2S Postback Endpoint ──
  ipcMain.handle('affiliate:adminTestPostback', async (_event, token: string, postbackUrl: string, method?: 'GET' | 'POST') => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const res = await affiliateService.adminTestPostback(postbackUrl, method || 'GET')
      return { success: true, data: res }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
