// ──────────────────────────────────────────────
// AntiProfiles — Real-Time Referral & Affiliate Commission Service
// ──────────────────────────────────────────────

import { BrowserWindow } from 'electron'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'

export interface AffiliateSettings {
  commission_rate_percent: number
  holding_period_days: number
  min_withdrawal_usd: number
  enabled_payout_methods: string[]
  attribution_model: string
  self_referral_allowed: boolean
  system_domain: string
}

export interface AffiliateCommissionRecord {
  id: string
  referrer_user_id: string
  referred_user_id: string
  referred_user_name?: string
  referred_user_email?: string
  payment_id: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'available' | 'withdrawn' | 'rejected' | 'reversed'
  available_at: string
  reversal_reason?: string | null
  created_at: string
  updated_at: string
}

export interface AffiliateWithdrawalRecord {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  amount: number
  payout_method: string
  payout_details: string
  parsed_payout_details?: any
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  admin_notes?: string | null
  payout_reference?: string | null
  requested_at: string
  processed_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
}

export class AffiliateService {
  private static instance: AffiliateService

  private constructor() {}

  public static getInstance(): AffiliateService {
    if (!AffiliateService.instance) {
      AffiliateService.instance = new AffiliateService()
    }
    return AffiliateService.instance
  }

  /**
   * Get all affiliate global settings
   */
  public getSettings(): AffiliateSettings {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM affiliate_settings').all() as { key: string; value: string }[]
    const map: Record<string, string> = {}
    rows.forEach(r => { map[r.key] = r.value })

    let enabledMethods = ['crypto', 'wise', 'payoneer', 'apple_bank']
    try {
      if (map.enabled_payout_methods) {
        enabledMethods = JSON.parse(map.enabled_payout_methods)
      }
    } catch {}

    return {
      commission_rate_percent: parseFloat(map.commission_rate_percent || '10.0'),
      holding_period_days: parseInt(map.holding_period_days || '7', 10),
      min_withdrawal_usd: parseFloat(map.min_withdrawal_usd || '20.0'),
      enabled_payout_methods: enabledMethods,
      attribution_model: map.attribution_model || 'first_click',
      self_referral_allowed: map.self_referral_allowed === '1',
      system_domain: map.system_domain || 'https://antiprofiles.com'
    }
  }

  /**
   * Save affiliate settings (Admin only)
   */
  public saveSettings(settings: Partial<AffiliateSettings>): AffiliateSettings {
    const db = getDatabase()
    if (settings.commission_rate_percent !== undefined) {
      db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('commission_rate_percent', ?, datetime('now'))")
        .run(String(settings.commission_rate_percent))
    }
    if (settings.holding_period_days !== undefined) {
      db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('holding_period_days', ?, datetime('now'))")
        .run(String(settings.holding_period_days))
    }
    if (settings.min_withdrawal_usd !== undefined) {
      db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('min_withdrawal_usd', ?, datetime('now'))")
        .run(String(settings.min_withdrawal_usd))
    }
    if (settings.enabled_payout_methods !== undefined) {
      db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('enabled_payout_methods', ?, datetime('now'))")
        .run(JSON.stringify(settings.enabled_payout_methods))
    }
    if (settings.system_domain !== undefined) {
      db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('system_domain', ?, datetime('now'))")
        .run(settings.system_domain)
    }

    logger.info('affiliate', '[AffiliateService] Updated global affiliate settings.')
    return this.getSettings()
  }

  /**
   * Get or create referral code for a user
   */
  public getOrCreateReferralCode(userId: string): { referralCode: string; referralLink: string } {
    const db = getDatabase()
    const user = db.prepare('SELECT id, referral_code FROM users WHERE id = ?').get(userId) as { id: string; referral_code?: string } | undefined
    if (!user) throw new Error('User not found')

    let code = user.referral_code
    if (!code) {
      code = 'REF_' + userId.slice(0, 4).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
      db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, userId)
    }

    const settings = this.getSettings()
    const link = `${settings.system_domain.replace(/\/$/, '')}/register?ref=${code}`

    return { referralCode: code, referralLink: link }
  }

  /**
   * Attribute newly registered user to a referring user
   */
  public recordReferralAttribution(newUserId: string, rawRefCode: string): boolean {
    if (!rawRefCode || !rawRefCode.trim()) return false
    const code = rawRefCode.trim().toUpperCase()
    const db = getDatabase()

    const referringUser = db.prepare('SELECT id FROM users WHERE UPPER(referral_code) = ?').get(code) as { id: string } | undefined
    if (!referringUser) {
      logger.warn('affiliate', `[AffiliateService] Invalid referral code supplied: ${code}`)
      return false
    }

    // Prevent Self-Referral
    if (referringUser.id === newUserId) {
      logger.warn('affiliate', `[AffiliateService] Self-referral attempt blocked for user ${newUserId}`)
      return false
    }

    db.prepare('UPDATE users SET referred_by = ? WHERE id = ? AND (referred_by IS NULL OR referred_by = "")').run(referringUser.id, newUserId)
    logger.info('affiliate', `[AffiliateService] User ${newUserId} successfully attributed to referrer ${referringUser.id} via code ${code}`)

    // Real-time alert to referring user
    this.broadcastEvent('ui:affiliate-new-referral', {
      referrerUserId: referringUser.id,
      referredUserId: newUserId,
      timestamp: Date.now()
    })

    return true
  }

  /**
   * Promote matured pending commissions to available
   */
  public promoteMaturedCommissions(): void {
    const db = getDatabase()
    try {
      db.prepare(`
        UPDATE affiliate_commissions
        SET status = 'available', updated_at = datetime('now')
        WHERE status = 'pending' AND datetime(available_at) <= datetime('now')
      `).run()
    } catch (err: any) {
      logger.warn('affiliate', `Failed to promote pending commissions: ${err.message}`)
    }
  }

  /**
   * Generate commission on verified payment completion
   */
  public processPaymentCommission(data: {
    userId: string
    amount: number
    paymentId?: string
    planName?: string
  }): AffiliateCommissionRecord | null {
    const { userId, amount, paymentId, planName } = data
    if (!userId || amount <= 0) return null

    const db = getDatabase()
    const payer = db.prepare('SELECT id, name, email, referred_by FROM users WHERE id = ?').get(userId) as any
    if (!payer || !payer.referred_by) {
      return null // Not a referred purchase
    }

    const referrerId = payer.referred_by
    if (referrerId === userId) {
      logger.warn('affiliate', `Self-referral purchase ignored for user ${userId}`)
      return null
    }

    // Idempotency: Prevent duplicate commission on same payment_id
    if (paymentId) {
      const existing = db.prepare('SELECT id FROM affiliate_commissions WHERE payment_id = ?').get(paymentId)
      if (existing) {
        logger.info('affiliate', `Commission already processed for payment ${paymentId}`)
        return null
      }
    }

    const settings = this.getSettings()
    const rate = settings.commission_rate_percent
    const commAmount = Math.round((amount * (rate / 100)) * 100) / 100

    if (commAmount <= 0) return null

    const commId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const holdingDays = settings.holding_period_days
    const availableAt = holdingDays > 0
      ? new Date(Date.now() + holdingDays * 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString()
    const initialStatus = holdingDays > 0 ? 'pending' : 'available'

    db.prepare(`
      INSERT INTO affiliate_commissions (
        id, referrer_user_id, referred_user_id, payment_id, order_amount,
        commission_rate, commission_amount, status, available_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, datetime('now'), datetime('now')
      )
    `).run(
      commId, referrerId, userId, paymentId || `pay_${Date.now()}`, amount,
      rate, commAmount, initialStatus, availableAt
    )

    // Add immutable ledger entry
    const commRecord = db.prepare('SELECT * FROM affiliate_commissions WHERE id = ?').get(commId) as AffiliateCommissionRecord

    logger.info('affiliate', `[AffiliateService] 💰 Generated $${commAmount} commission for referrer ${referrerId} from $${amount} order (${initialStatus})`)

    // Broadcast in-app real-time event to referring user
    this.broadcastEvent('ui:affiliate-commission-earned', {
      referrerUserId: referrerId,
      commissionAmount: commAmount,
      orderAmount: amount,
      planName: planName || 'Subscription',
      status: initialStatus,
      availableAt,
      timestamp: Date.now()
    })

    return commRecord
  }

  /**
   * Get user affiliate overview & balances
   */
  public getUserAffiliateSummary(userId: string): {
    referralCode: string
    referralLink: string
    commissionRate: number
    minWithdrawalUsd: number
    holdingPeriodDays: number
    totalReferrals: number
    activeReferrals: number
    totalReferredSales: number
    totalEarned: number
    pendingCommission: number
    availableBalance: number
    withdrawnAmount: number
    pendingWithdrawalAmount: number
    enabledPayoutMethods: string[]
    recentCommissions: AffiliateCommissionRecord[]
    recentWithdrawals: AffiliateWithdrawalRecord[]
  } {
    this.promoteMaturedCommissions()
    const db = getDatabase()
    const { referralCode, referralLink } = this.getOrCreateReferralCode(userId)
    const settings = this.getSettings()

    // 1. Total Referrals Count
    const totalRefRow = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(userId) as { count: number }
    const totalReferrals = totalRefRow.count || 0

    // 2. Active Referrals (referred users who made at least 1 paid order)
    const activeRefRow = db.prepare(`
      SELECT COUNT(DISTINCT referred_user_id) as count
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status != 'rejected' AND status != 'reversed'
    `).get(userId) as { count: number }
    const activeReferrals = activeRefRow.count || 0

    // 3. Total Referred Sales ($)
    const totalSalesRow = db.prepare(`
      SELECT COALESCE(SUM(order_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status != 'rejected' AND status != 'reversed'
    `).get(userId) as { total: number }
    const totalReferredSales = Math.round(totalSalesRow.total * 100) / 100

    // 4. Total Earned ($)
    const totalEarnedRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status IN ('pending', 'available', 'withdrawn')
    `).get(userId) as { total: number }
    const totalEarned = Math.round(totalEarnedRow.total * 100) / 100

    // 5. Pending Commission ($)
    const pendingRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status = 'pending'
    `).get(userId) as { total: number }
    const pendingCommission = Math.round(pendingRow.total * 100) / 100

    // 6. Available Gross Commissions ($)
    const availableGrossRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status = 'available'
    `).get(userId) as { total: number }
    const availableGross = Math.round(availableGrossRow.total * 100) / 100

    // 7. Withdrawn Amount ($)
    const withdrawnRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM affiliate_withdrawals
      WHERE user_id = ? AND status = 'paid'
    `).get(userId) as { total: number }
    const withdrawnAmount = Math.round(withdrawnRow.total * 100) / 100

    // 8. Pending/Approved Withdrawals ($)
    const pendingWithRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM affiliate_withdrawals
      WHERE user_id = ? AND status IN ('pending', 'approved')
    `).get(userId) as { total: number }
    const pendingWithdrawalAmount = Math.round(pendingWithRow.total * 100) / 100

    // Available Balance = Gross Available - Pending Withdrawals
    const availableBalance = Math.max(0, Math.round((availableGross - pendingWithdrawalAmount) * 100) / 100)

    // 9. Recent Commissions
    const commissions = db.prepare(`
      SELECT c.*, u.name as referred_user_name, u.email as referred_user_email
      FROM affiliate_commissions c
      LEFT JOIN users u ON u.id = c.referred_user_id
      WHERE c.referrer_user_id = ?
      ORDER BY c.created_at DESC
      LIMIT 50
    `).all(userId) as AffiliateCommissionRecord[]

    // 10. Recent Withdrawals
    const rawWithdrawals = db.prepare(`
      SELECT * FROM affiliate_withdrawals
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId) as AffiliateWithdrawalRecord[]

    const withdrawals = rawWithdrawals.map(w => {
      let parsed = {}
      try { parsed = JSON.parse(w.payout_details) } catch {}
      return { ...w, parsed_payout_details: parsed }
    })

    return {
      referralCode,
      referralLink,
      commissionRate: settings.commission_rate_percent,
      minWithdrawalUsd: settings.min_withdrawal_usd,
      holdingPeriodDays: settings.holding_period_days,
      totalReferrals,
      activeReferrals,
      totalReferredSales,
      totalEarned,
      pendingCommission,
      availableBalance,
      withdrawnAmount,
      pendingWithdrawalAmount,
      enabledPayoutMethods: settings.enabled_payout_methods,
      recentCommissions: commissions,
      recentWithdrawals: withdrawals
    }
  }

  /**
   * User: Submit a withdrawal request
   */
  public requestWithdrawal(
    userId: string,
    amount: number,
    payoutMethod: string,
    payoutDetails: Record<string, any>
  ): AffiliateWithdrawalRecord {
    const summary = this.getUserAffiliateSummary(userId)
    const settings = this.getSettings()

    if (amount <= 0) throw new Error('Withdrawal amount must be greater than zero.')
    if (amount < settings.min_withdrawal_usd) {
      throw new Error(`Minimum withdrawal amount is $${settings.min_withdrawal_usd.toFixed(2)}.`)
    }
    if (amount > summary.availableBalance) {
      throw new Error(`Insufficient available balance ($${summary.availableBalance.toFixed(2)}).`)
    }
    if (!settings.enabled_payout_methods.includes(payoutMethod)) {
      throw new Error(`Payout method "${payoutMethod}" is not enabled.`)
    }

    const db = getDatabase()
    const withdrawalId = `wth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const detailsJson = JSON.stringify(payoutDetails || {})

    db.prepare(`
      INSERT INTO affiliate_withdrawals (
        id, user_id, amount, payout_method, payout_details, status, requested_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'), datetime('now')
      )
    `).run(withdrawalId, userId, amount, payoutMethod, detailsJson)

    // Record in ledger
    const balanceAfter = Math.max(0, summary.availableBalance - amount)
    db.prepare(`
      INSERT INTO affiliate_ledger (
        id, user_id, type, amount, balance_after, reference_id, description, created_at
      ) VALUES (
        ?, ?, 'withdrawal_debit', ?, ?, ?, ?, datetime('now')
      )
    `).run(`ledg_${Date.now()}`, userId, amount, balanceAfter, withdrawalId, `Withdrawal request of $${amount} via ${payoutMethod}`)

    const record = db.prepare('SELECT * FROM affiliate_withdrawals WHERE id = ?').get(withdrawalId) as AffiliateWithdrawalRecord
    logger.info('affiliate', `[AffiliateService] User ${userId} requested withdrawal of $${amount} via ${payoutMethod}`)

    return record
  }

  /**
   * Admin: Get comprehensive affiliate overview, commissions & withdrawal requests
   */
  public getAdminAffiliateOverview(): {
    settings: AffiliateSettings
    stats: {
      totalAffiliates: number
      totalReferralRegistrations: number
      totalReferredRevenue: number
      totalCommissionsPaid: number
      totalCommissionsPending: number
      totalPendingWithdrawalRequests: number
      pendingWithdrawalSum: number
    }
    withdrawals: AffiliateWithdrawalRecord[]
    commissions: AffiliateCommissionRecord[]
    referralPairs: any[]
  } {
    this.promoteMaturedCommissions()
    const db = getDatabase()
    const settings = this.getSettings()

    const affiliatesCountRow = db.prepare(`
      SELECT COUNT(DISTINCT referrer_user_id) as count FROM affiliate_commissions
    `).get() as { count: number }

    const regCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE referred_by IS NOT NULL AND referred_by != ''
    `).get() as { count: number }

    const revRow = db.prepare(`
      SELECT COALESCE(SUM(order_amount), 0) as total FROM affiliate_commissions WHERE status != 'rejected' AND status != 'reversed'
    `).get() as { total: number }

    const paidCommsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM affiliate_withdrawals WHERE status = 'paid'
    `).get() as { total: number }

    const pendingCommsRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total FROM affiliate_commissions WHERE status = 'pending'
    `).get() as { total: number }

    const pendingWithsRow = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as sum FROM affiliate_withdrawals WHERE status = 'pending'
    `).get() as { count: number; sum: number }

    // All Withdrawals
    const rawWithdrawals = db.prepare(`
      SELECT w.*, u.name as user_name, u.email as user_email
      FROM affiliate_withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      ORDER BY w.requested_at DESC
      LIMIT 100
    `).all() as AffiliateWithdrawalRecord[]

    const withdrawals = rawWithdrawals.map(w => {
      let parsed = {}
      try { parsed = JSON.parse(w.payout_details) } catch {}
      return { ...w, parsed_payout_details: parsed }
    })

    // All Commissions
    const commissions = db.prepare(`
      SELECT c.*, u.name as referred_user_name, u.email as referred_user_email
      FROM affiliate_commissions c
      LEFT JOIN users u ON u.id = c.referred_user_id
      ORDER BY c.created_at DESC
      LIMIT 100
    `).all() as AffiliateCommissionRecord[]

    // Referral Relationships
    const referralPairs = db.prepare(`
      SELECT u.id as referred_user_id, u.name as referred_user_name, u.email as referred_user_email, u.created_at as registered_at,
             ref.id as referrer_id, ref.name as referrer_name, ref.email as referrer_email,
             COALESCE((SELECT SUM(c.order_amount) FROM affiliate_commissions c WHERE c.referred_user_id = u.id AND c.status != 'reversed'), 0) as total_spent,
             COALESCE((SELECT SUM(c.commission_amount) FROM affiliate_commissions c WHERE c.referred_user_id = u.id AND c.status != 'reversed'), 0) as commission_earned
      FROM users u
      JOIN users ref ON ref.id = u.referred_by
      ORDER BY u.created_at DESC
      LIMIT 100
    `).all()

    return {
      settings,
      stats: {
        totalAffiliates: affiliatesCountRow.count || 0,
        totalReferralRegistrations: regCountRow.count || 0,
        totalReferredRevenue: Math.round(revRow.total * 100) / 100,
        totalCommissionsPaid: Math.round(paidCommsRow.total * 100) / 100,
        totalCommissionsPending: Math.round(pendingCommsRow.total * 100) / 100,
        totalPendingWithdrawalRequests: pendingWithsRow.count || 0,
        pendingWithdrawalSum: Math.round(pendingWithsRow.sum * 100) / 100
      },
      withdrawals,
      commissions,
      referralPairs
    }
  }

  /**
   * Admin: Update withdrawal request status (Approve, Reject, or Mark as Paid)
   */
  public adminUpdateWithdrawal(
    withdrawalId: string,
    status: 'approved' | 'rejected' | 'paid',
    adminNotes?: string,
    payoutReference?: string
  ): AffiliateWithdrawalRecord {
    const db = getDatabase()
    const w = db.prepare('SELECT * FROM affiliate_withdrawals WHERE id = ?').get(withdrawalId) as AffiliateWithdrawalRecord | undefined
    if (!w) throw new Error('Withdrawal request not found.')

    const now = new Date().toISOString()

    if (status === 'paid') {
      db.prepare(`
        UPDATE affiliate_withdrawals
        SET status = 'paid', admin_notes = ?, payout_reference = ?, processed_at = ?, paid_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(adminNotes || w.admin_notes, payoutReference || w.payout_reference, now, now, withdrawalId)

      // Deduct from gross available commissions by transitioning equivalent amount to 'withdrawn'
      let remainingToDeduct = w.amount
      const availableComms = db.prepare(`
        SELECT id, commission_amount FROM affiliate_commissions
        WHERE referrer_user_id = ? AND status = 'available'
        ORDER BY created_at ASC
      `).all(w.user_id) as { id: string; commission_amount: number }[]

      for (const comm of availableComms) {
        if (remainingToDeduct <= 0) break
        db.prepare("UPDATE affiliate_commissions SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?").run(comm.id)
        remainingToDeduct -= comm.commission_amount
      }

      logger.info('affiliate', `[AffiliateService] Withdrawal ${withdrawalId} ($${w.amount}) marked as PAID with ref: ${payoutReference}`)
    } else if (status === 'rejected') {
      db.prepare(`
        UPDATE affiliate_withdrawals
        SET status = 'rejected', admin_notes = ?, processed_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(adminNotes || 'Withdrawal rejected by administrator.', now, withdrawalId)

      // Ledger refund record
      db.prepare(`
        INSERT INTO affiliate_ledger (
          id, user_id, type, amount, balance_after, reference_id, description, created_at
        ) VALUES (
          ?, ?, 'withdrawal_refund', ?, (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE referrer_user_id = ? AND status = 'available'), ?, ?, datetime('now')
        )
      `).run(`ledg_${Date.now()}`, w.user_id, w.amount, w.user_id, withdrawalId, `Refunded rejected withdrawal of $${w.amount}`)

      logger.info('affiliate', `[AffiliateService] Withdrawal ${withdrawalId} REJECTED. Reason: ${adminNotes}`)
    } else {
      db.prepare(`
        UPDATE affiliate_withdrawals
        SET status = 'approved', admin_notes = ?, processed_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(adminNotes || w.admin_notes, now, withdrawalId)
    }

    // Notify user in real-time
    this.broadcastEvent('ui:affiliate-withdrawal-updated', {
      userId: w.user_id,
      withdrawalId,
      status,
      adminNotes,
      payoutReference,
      timestamp: Date.now()
    })

    return db.prepare('SELECT * FROM affiliate_withdrawals WHERE id = ?').get(withdrawalId) as AffiliateWithdrawalRecord
  }

  /**
   * Admin: Reverse a commission due to refund or chargeback
   */
  public adminReverseCommission(commissionId: string, reason: string): AffiliateCommissionRecord {
    const db = getDatabase()
    const comm = db.prepare('SELECT * FROM affiliate_commissions WHERE id = ?').get(commissionId) as AffiliateCommissionRecord | undefined
    if (!comm) throw new Error('Commission not found.')

    db.prepare(`
      UPDATE affiliate_commissions
      SET status = 'reversed', reversal_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(reason || 'Refund or chargeback reversal', commissionId)

    // Ledger entry
    db.prepare(`
      INSERT INTO affiliate_ledger (
        id, user_id, type, amount, balance_after, reference_id, description, created_at
      ) VALUES (
        ?, ?, 'commission_reversal', ?, 0, ?, ?, datetime('now')
      )
    `).run(`ledg_${Date.now()}`, comm.referrer_user_id, comm.commission_amount, commissionId, `Reversed commission: ${reason}`)

    logger.info('affiliate', `[AffiliateService] Commission ${commissionId} reversed. Reason: ${reason}`)
    return db.prepare('SELECT * FROM affiliate_commissions WHERE id = ?').get(commissionId) as AffiliateCommissionRecord
  }

  /**
   * Admin: Manual balance adjustment
   */
  public adminAdjustBalance(userId: string, amount: number, reason: string): void {
    const db = getDatabase()
    const commId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    if (amount > 0) {
      db.prepare(`
        INSERT INTO affiliate_commissions (
          id, referrer_user_id, referred_user_id, payment_id, order_amount,
          commission_rate, commission_amount, status, available_at, reversal_reason, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'manual_admin_adjustment', ?, 100, ?, 'available', datetime('now'), ?, datetime('now'), datetime('now')
        )
      `).run(commId, userId, userId, amount, amount, reason || 'Manual Admin Credit')
    }

    db.prepare(`
      INSERT INTO affiliate_ledger (
        id, user_id, type, amount, balance_after, reference_id, description, created_at
      ) VALUES (
        ?, ?, 'admin_adjustment', ?, 0, ?, ?, datetime('now')
      )
    `).run(`ledg_${Date.now()}`, userId, amount, commId, reason || `Admin balance adjustment of $${amount}`)

    logger.info('affiliate', `[AffiliateService] Admin adjusted balance for user ${userId} by $${amount}`)
  }

  private broadcastEvent(channel: string, payload: any): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(w => {
        if (!w.isDestroyed()) {
          w.webContents.send(channel, payload)
        }
      })
    } catch {}
  }
}

export const affiliateService = AffiliateService.getInstance()
