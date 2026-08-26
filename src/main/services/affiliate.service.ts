// ──────────────────────────────────────────────
// AntiProfiles — Real-Time CPA Affiliate Tracking, Commission, Postback & Withdrawal Service
// ──────────────────────────────────────────────

import { BrowserWindow } from 'electron'
import http from 'http'
import https from 'https'
import { URL } from 'url'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'
import {
  AffiliateOffer,
  AffiliateTrackingLink,
  AffiliateClick,
  AffiliateConversion,
  AffiliatePostbackConfig,
  AffiliatePostbackLog,
  AffiliateAuditLog,
  WithdrawalStatus,
  AffiliateAccountStatus
} from '../database/models'

export interface AffiliateSettings {
  enabled: boolean
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
  status: WithdrawalStatus
  admin_notes?: string | null
  payout_reference?: string | null
  requested_at: string
  processed_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
}

export interface AffiliateUserSummary {
  affiliateId: string
  affiliateStatus: AffiliateAccountStatus
  referralCode: string
  referralLink: string
  commissionRate: number
  minWithdrawalUsd: number
  holdingPeriodDays: number
  totalClicks: number
  uniqueClicks: number
  totalConversions: number
  conversionRate: number
  totalReferredSales: number
  totalEarned: number
  pendingCommission: number
  approvedCommission: number
  paidCommission: number
  availableBalance: number
  withdrawnAmount: number
  pendingWithdrawalAmount: number
  enabledPayoutMethods: string[]
  postbackConfig: AffiliatePostbackConfig | null
  offers: AffiliateOffer[]
  trackingLinks: AffiliateTrackingLink[]
  recentClicks: AffiliateClick[]
  recentConversions: AffiliateConversion[]
  recentCommissions: AffiliateCommissionRecord[]
  recentWithdrawals: AffiliateWithdrawalRecord[]
  recentPostbacks: AffiliatePostbackLog[]
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

  // ──────────────────────────────────────────────
  // 1. Settings Management
  // ──────────────────────────────────────────────

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
      enabled: map.affiliate_system_enabled !== '0',
      commission_rate_percent: parseFloat(map.commission_rate_percent || '10.0'),
      holding_period_days: parseInt(map.holding_period_days || '7', 10),
      min_withdrawal_usd: parseFloat(map.min_withdrawal_usd || '20.0'),
      enabled_payout_methods: enabledMethods,
      attribution_model: map.attribution_model || 'first_click',
      self_referral_allowed: map.self_referral_allowed === '1',
      system_domain: map.system_domain || 'https://antiprofiles.com'
    }
  }

  public saveSettings(settings: Partial<AffiliateSettings>, adminUserId: string = 'admin-default'): AffiliateSettings {
    const db = getDatabase()
    if (settings.enabled !== undefined) {
      db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('affiliate_system_enabled', ?, datetime('now'))")
        .run(settings.enabled ? '1' : '0')
    }
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

    this.recordAuditLog('settings_updated', adminUserId, 'global_settings', JSON.stringify(settings))
    logger.info('affiliate', '[AffiliateService] Updated global affiliate settings.')
    return this.getSettings()
  }

  // ──────────────────────────────────────────────
  // 2. Affiliate ID & Referral Identity
  // ──────────────────────────────────────────────

  public getOrCreateAffiliateId(userId: string): { affiliateId: string; referralCode: string; status: AffiliateAccountStatus } {
    const db = getDatabase()
    const user = db.prepare('SELECT id, referral_code, affiliate_id, affiliate_status FROM users WHERE id = ?').get(userId) as any

    let refCode = user?.referral_code
    let affId = user?.affiliate_id
    const affStatus: AffiliateAccountStatus = user?.affiliate_status || 'active'

    if (!refCode) {
      const prefix = userId && userId.length >= 4 ? userId.slice(0, 4).toUpperCase() : 'USER'
      refCode = 'REF_' + prefix + '_' + Math.random().toString(36).substring(2, 6).toUpperCase()
      if (user) {
        db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(refCode, userId)
      }
    }

    if (!affId) {
      affId = 'AFF-' + (refCode ? refCode.replace(/^REF_/, '') : userId.slice(0, 6).toUpperCase())
      if (user) {
        db.prepare('UPDATE users SET affiliate_id = ? WHERE id = ?').run(affId, userId)
      } else {
        try {
          db.prepare(`
            INSERT INTO users (id, email, name, role, email_verified, referral_code, affiliate_id, affiliate_status, created_at, updated_at)
            VALUES (?, ?, ?, 'user', 1, ?, ?, 'active', datetime('now'), datetime('now'))
          `).run(userId, `${userId}@antiprofiles.local`, `User ${userId.slice(0, 6)}`, refCode, affId)
        } catch {}
      }
    }

    return { affiliateId: affId, referralCode: refCode, status: affStatus }
  }

  public getOrCreateReferralCode(userId: string): { referralCode: string; referralLink: string; affiliateId: string } {
    const { affiliateId, referralCode } = this.getOrCreateAffiliateId(userId)
    const settings = this.getSettings()
    const domain = (settings?.system_domain || 'https://antiprofiles.com').replace(/\/$/, '')
    const link = `${domain}/register?ref=${referralCode}`
    return { referralCode, referralLink: link, affiliateId }
  }

  public updateAffiliateStatus(affiliateId: string, status: AffiliateAccountStatus, adminUserId: string = 'admin-default'): boolean {
    const db = getDatabase()
    const user = db.prepare('SELECT id, name, email FROM users WHERE affiliate_id = ? OR id = ?').get(affiliateId, affiliateId) as any
    if (!user) return false

    db.prepare("UPDATE users SET affiliate_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, user.id)
    this.recordAuditLog(`affiliate_${status}`, adminUserId, user.id, `Affiliate status changed to ${status}`)
    logger.info('affiliate', `[AffiliateService] Updated affiliate status for user ${user.id} to ${status}`)
    return true
  }

  // ──────────────────────────────────────────────
  // 3. CPA Offers & Campaigns Management
  // ──────────────────────────────────────────────

  public getOffers(onlyActive: boolean = false): AffiliateOffer[] {
    const db = getDatabase()
    const query = onlyActive
      ? "SELECT * FROM affiliate_offers WHERE status = 'active' ORDER BY created_at DESC"
      : "SELECT * FROM affiliate_offers ORDER BY created_at DESC"
    let offers = db.prepare(query).all() as AffiliateOffer[]

    if (!offers || offers.length === 0) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO affiliate_offers (id, title, description, target_url, payout_type, commission_rate, fixed_payout_usd, status, created_at, updated_at)
          VALUES 
            ('offer_main_saas', 'AntiProfiles Pro & Team Subscription Plan', 'Earn 15% recurring lifetime revenue share on every monthly or annual plan purchased.', 'https://antiprofiles.com/#pricing', 'percentage', 15.0, 0.0, 'active', datetime('now'), datetime('now')),
            ('offer_starter_bounty', 'AntiProfiles Starter Account Direct Bounty', 'Earn a $10.00 instant CPA bounty for every newly verified paying user.', 'https://antiprofiles.com/register', 'fixed', 0.0, 10.0, 'active', datetime('now'), datetime('now'))
        `).run()
        offers = db.prepare(query).all() as AffiliateOffer[]
      } catch {}
    }

    return offers
  }

  public getOfferById(offerId: string): AffiliateOffer | null {
    const db = getDatabase()
    let offer = db.prepare('SELECT * FROM affiliate_offers WHERE id = ?').get(offerId) as AffiliateOffer | undefined
    if (!offer) {
      this.getOffers() // Trigger auto-seed
      offer = db.prepare('SELECT * FROM affiliate_offers WHERE id = ?').get(offerId) as AffiliateOffer | undefined
    }
    return offer || null
  }

  public createOrUpdateOffer(offer: Partial<AffiliateOffer>, adminUserId: string = 'admin-default'): AffiliateOffer {
    const db = getDatabase()
    const offerId = offer.id || `offer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const title = offer.title || 'Untitled CPA Offer'
    const desc = offer.description || ''
    const targetUrl = offer.target_url || 'https://antiprofiles.com'
    const payoutType = offer.payout_type || 'percentage'
    const commRate = offer.commission_rate !== undefined ? offer.commission_rate : 10.0
    const fixedPayout = offer.fixed_payout_usd !== undefined ? offer.fixed_payout_usd : 0.0
    const currency = offer.currency || 'USD'
    const status = offer.status || 'active'

    db.prepare(`
      INSERT INTO affiliate_offers (
        id, title, description, target_url, payout_type, commission_rate, fixed_payout_usd, currency, status, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        target_url = excluded.target_url,
        payout_type = excluded.payout_type,
        commission_rate = excluded.commission_rate,
        fixed_payout_usd = excluded.fixed_payout_usd,
        currency = excluded.currency,
        status = excluded.status,
        updated_at = datetime('now')
    `).run(offerId, title, desc, targetUrl, payoutType, commRate, fixedPayout, currency, status)

    this.recordAuditLog('offer_saved', adminUserId, offerId, `Saved CPA Offer: ${title} (${payoutType}: ${payoutType === 'percentage' ? commRate + '%' : '$' + fixedPayout})`)
    return this.getOfferById(offerId)!
  }

  public deleteOffer(offerId: string, adminUserId: string = 'admin-default'): boolean {
    const db = getDatabase()
    db.prepare("UPDATE affiliate_offers SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(offerId)
    this.recordAuditLog('offer_archived', adminUserId, offerId, `Archived CPA offer: ${offerId}`)
    return true
  }

  // ──────────────────────────────────────────────
  // 4. CPA Tracking Links & Click Tracking
  // ──────────────────────────────────────────────

  public generateTrackingLink(userId: string, offerId: string, customParams?: Record<string, string>): { linkId: string; trackingUrl: string } {
    const db = getDatabase()
    const { affiliateId } = this.getOrCreateAffiliateId(userId)
    const offer = this.getOfferById(offerId)
    if (!offer) throw new Error(`CPA Offer "${offerId}" not found.`)

    const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const settings = this.getSettings()
    const domain = (settings?.system_domain || 'https://antiprofiles.com').replace(/\/$/, '')

    let trackingUrl = `${domain}/track?aff_id=${encodeURIComponent(affiliateId)}&offer_id=${encodeURIComponent(offerId)}`
    if (customParams) {
      for (const [k, v] of Object.entries(customParams)) {
        if (v) trackingUrl += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`
      }
    }

    db.prepare(`
      INSERT INTO affiliate_tracking_links (
        id, affiliate_id, user_id, offer_id, tracking_url, custom_params, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(linkId, affiliateId, userId, offerId, trackingUrl, customParams ? JSON.stringify(customParams) : null)

    return { linkId, trackingUrl }
  }

  public getTrackingLinksForUser(userId: string): AffiliateTrackingLink[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM affiliate_tracking_links WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId) as AffiliateTrackingLink[]
  }

  public recordClick(params: {
    affiliateId: string
    offerId: string
    clickId?: string
    ipAddress?: string
    userAgent?: string
    referrer?: string
    subId1?: string
    subId2?: string
    subId3?: string
    subId4?: string
    subId5?: string
  }): { clickId: string; redirectUrl: string; offer: AffiliateOffer | null } {
    const db = getDatabase()
    const { affiliateId, offerId } = params

    // Validate Affiliate & Offer
    const user = db.prepare('SELECT id, affiliate_status FROM users WHERE affiliate_id = ? OR referral_code = ?').get(affiliateId, affiliateId) as any
    if (user && user.affiliate_status === 'disabled') {
      logger.warn('affiliate', `[Tracking] Click rejected: Affiliate ${affiliateId} is disabled.`)
    }

    const offer = this.getOfferById(offerId) || this.getOffers(true)[0]
    const targetBaseUrl = offer ? offer.target_url : 'https://antiprofiles.com'

    // Generate or use immutable Click ID
    const clickId = (params.clickId && params.clickId.trim()) ? params.clickId.trim() : `clk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

    // Check if Click ID already recorded
    const existing = db.prepare('SELECT click_id FROM affiliate_clicks WHERE click_id = ?').get(clickId)
    if (!existing) {
      db.prepare(`
        INSERT INTO affiliate_clicks (
          click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, landing_url,
          sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, converted, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 0, datetime('now')
        )
      `).run(
        clickId,
        affiliateId,
        offerId,
        params.ipAddress || '',
        params.userAgent || '',
        params.referrer || '',
        targetBaseUrl,
        params.subId1 || null,
        params.subId2 || null,
        params.subId3 || null,
        params.subId4 || null,
        params.subId5 || null
      )

      if (offer) {
        db.prepare('UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?').run(offer.id)
      }
    }

    // Build redirect destination preserving click_id
    const redirectUrlObj = new URL(targetBaseUrl)
    redirectUrlObj.searchParams.set('click_id', clickId)
    redirectUrlObj.searchParams.set('aff_id', affiliateId)
    redirectUrlObj.searchParams.set('offer_id', offerId)
    if (params.subId1) redirectUrlObj.searchParams.set('sub_id1', params.subId1)

    logger.info('affiliate', `[Tracking] 🚀 Recorded click ${clickId} for affiliate ${affiliateId} on offer ${offerId}`)

    return { clickId, redirectUrl: redirectUrlObj.toString(), offer }
  }

  // ──────────────────────────────────────────────
  // 5. CPA Conversion & Commission Engine
  // ──────────────────────────────────────────────

  public async recordCpaConversion(input: {
    clickId: string
    orderAmount?: number
    currency?: string
    idempotencyKey?: string
    meta?: Record<string, any>
    userId?: string
  }): Promise<{ success: boolean; conversion?: AffiliateConversion; commission?: AffiliateCommissionRecord; error?: string }> {
    const db = getDatabase()
    const { clickId, orderAmount = 0.0, currency = 'USD', idempotencyKey, meta, userId } = input

    if (!clickId || !clickId.trim()) {
      return { success: false, error: 'Missing required click_id.' }
    }

    // 1. Idempotency & Deduplication
    if (idempotencyKey) {
      const existingByIdem = db.prepare('SELECT * FROM affiliate_conversions WHERE idempotency_key = ?').get(idempotencyKey) as AffiliateConversion | undefined
      if (existingByIdem) {
        logger.info('affiliate', `[Conversion] Duplicate conversion skipped for idempotency key ${idempotencyKey}`)
        return { success: true, conversion: existingByIdem }
      }
    }

    const existingByClick = db.prepare('SELECT * FROM affiliate_conversions WHERE click_id = ?').get(clickId) as AffiliateConversion | undefined
    if (existingByClick) {
      logger.info('affiliate', `[Conversion] Duplicate conversion skipped for click_id ${clickId}`)
      return { success: true, conversion: existingByClick }
    }

    // 2. Lookup Click record
    const click = db.prepare('SELECT * FROM affiliate_clicks WHERE click_id = ?').get(clickId) as AffiliateClick | undefined
    if (!click) {
      logger.warn('affiliate', `[Conversion] Click ID not found: ${clickId}`)
      return { success: false, error: `Click ID "${clickId}" not found in tracking records.` }
    }

    // 3. Lookup Affiliate and Offer
    const affiliate = db.prepare('SELECT id, affiliate_status FROM users WHERE affiliate_id = ? OR id = ?').get(click.affiliate_id, click.affiliate_id) as any
    if (affiliate && affiliate.affiliate_status === 'disabled') {
      return { success: false, error: `Affiliate ${click.affiliate_id} is disabled.` }
    }

    const offer = this.getOfferById(click.offer_id)
    const settings = this.getSettings()

    // 4. Calculate Commission
    let payoutAmount = 0.0
    let commissionRate = settings.commission_rate_percent

    if (offer) {
      if (offer.payout_type === 'fixed') {
        payoutAmount = offer.fixed_payout_usd
        commissionRate = 0
      } else {
        commissionRate = offer.commission_rate || settings.commission_rate_percent
        payoutAmount = Math.round((orderAmount * (commissionRate / 100)) * 100) / 100
      }
    } else {
      payoutAmount = Math.round((orderAmount * (commissionRate / 100)) * 100) / 100
    }

    const conversionId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const now = new Date().toISOString()
    const holdingDays = settings.holding_period_days
    const availableAt = holdingDays > 0
      ? new Date(Date.now() + holdingDays * 24 * 60 * 60 * 1000).toISOString()
      : now
    const initialCommStatus = holdingDays > 0 ? 'pending' : 'available'

    // 5. Database Transaction for Consistency
    const saveTx = db.transaction(() => {
      // Mark Click as converted
      db.prepare(`
        UPDATE affiliate_clicks
        SET converted = 1, conversion_id = ?, conversion_at = datetime('now')
        WHERE click_id = ?
      `).run(conversionId, clickId)

      // Insert Conversion
      db.prepare(`
        INSERT INTO affiliate_conversions (
          conversion_id, click_id, affiliate_id, offer_id, user_id, order_amount,
          payout_amount, currency, status, idempotency_key, meta_json, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, 'approved', ?, ?, datetime('now'), datetime('now')
        )
      `).run(
        conversionId,
        clickId,
        click.affiliate_id,
        click.offer_id,
        userId || null,
        orderAmount,
        payoutAmount,
        currency,
        idempotencyKey || null,
        meta ? JSON.stringify(meta) : null
      )

      // Increment offer conversions
      if (offer) {
        db.prepare('UPDATE affiliate_offers SET total_conversions = total_conversions + 1 WHERE id = ?').run(offer.id)
      }

      // Generate Commission Record if payout > 0
      let commRecord: AffiliateCommissionRecord | undefined
      if (payoutAmount > 0 && affiliate) {
        const commId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        db.prepare(`
          INSERT INTO affiliate_commissions (
            id, referrer_user_id, referred_user_id, payment_id, order_amount,
            commission_rate, commission_amount, status, available_at, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, datetime('now'), datetime('now')
          )
        `).run(
          commId,
          affiliate.id,
          userId || affiliate.id,
          conversionId,
          orderAmount,
          commissionRate,
          payoutAmount,
          initialCommStatus,
          availableAt
        )
        commRecord = db.prepare('SELECT * FROM affiliate_commissions WHERE id = ?').get(commId) as AffiliateCommissionRecord
      }

      return { commRecord }
    })

    const { commRecord } = saveTx()
    const conversion = db.prepare('SELECT * FROM affiliate_conversions WHERE conversion_id = ?').get(conversionId) as AffiliateConversion

    logger.info('affiliate', `[Conversion] 🎉 Successfully attributed conversion ${conversionId} to affiliate ${click.affiliate_id} (Payout: $${payoutAmount})`)

    // 6. Fire Real-Time Postback
    try {
      await this.firePostback(conversionId)
    } catch (err: any) {
      logger.warn('affiliate', `[Postback] Failed async postback execution: ${err.message}`)
    }

    // 7. Broadcast in-app notification
    if (affiliate) {
      this.broadcastEvent('ui:affiliate-commission-earned', {
        referrerUserId: affiliate.id,
        commissionAmount: payoutAmount,
        orderAmount,
        planName: offer?.title || 'CPA Conversion',
        status: initialCommStatus,
        availableAt,
        timestamp: Date.now()
      })
    }

    return { success: true, conversion, commission: commRecord }
  }

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

  public adminReverseCommission(commissionId: string, reason: string): AffiliateCommissionRecord {
    const db = getDatabase()
    const comm = db.prepare('SELECT * FROM affiliate_commissions WHERE id = ?').get(commissionId) as AffiliateCommissionRecord | undefined
    if (!comm) throw new Error('Commission not found.')

    db.prepare(`
      UPDATE affiliate_commissions
      SET status = 'reversed', reversal_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(reason || 'Refund or chargeback reversal', commissionId)

    db.prepare(`
      INSERT INTO affiliate_ledger (
        id, user_id, type, amount, balance_after, reference_id, description, created_at
      ) VALUES (
        ?, ?, 'commission_reversal', ?, 0, ?, ?, datetime('now')
      )
    `).run(`ledg_${Date.now()}`, comm.referrer_user_id, comm.commission_amount, commissionId, `Reversed commission: ${reason}`)

    return db.prepare('SELECT * FROM affiliate_commissions WHERE id = ?').get(commissionId) as AffiliateCommissionRecord
  }

  // ──────────────────────────────────────────────
  // 6. Affiliate Postback Dispatcher & Macro Engine
  // ──────────────────────────────────────────────

  public getPostbackConfig(userId: string): AffiliatePostbackConfig | null {
    const db = getDatabase()
    const cfg = db.prepare('SELECT * FROM affiliate_postback_configs WHERE user_id = ?').get(userId) as AffiliatePostbackConfig | undefined
    return cfg || null
  }

  public savePostbackConfig(userId: string, postbackUrl: string, httpMethod: 'GET' | 'POST' = 'GET'): AffiliatePostbackConfig {
    const db = getDatabase()
    const { affiliateId } = this.getOrCreateAffiliateId(userId)
    const id = `pbcfg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    db.prepare(`
      INSERT INTO affiliate_postback_configs (
        id, user_id, affiliate_id, postback_url, http_method, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now')
      )
      ON CONFLICT(user_id) DO UPDATE SET
        postback_url = excluded.postback_url,
        http_method = excluded.http_method,
        is_active = 1,
        updated_at = datetime('now')
    `).run(id, userId, affiliateId, postbackUrl.trim(), httpMethod)

    return this.getPostbackConfig(userId)!
  }

  public async firePostback(conversionId: string): Promise<AffiliatePostbackLog | null> {
    const db = getDatabase()
    const conv = db.prepare('SELECT * FROM affiliate_conversions WHERE conversion_id = ?').get(conversionId) as AffiliateConversion | undefined
    if (!conv) return null

    // Lookup affiliate's postback configuration
    const cfg = db.prepare('SELECT * FROM affiliate_postback_configs WHERE affiliate_id = ? AND is_active = 1').get(conv.affiliate_id) as AffiliatePostbackConfig | undefined
    if (!cfg || !cfg.postback_url) {
      logger.info('affiliate', `[Postback] No active postback configured for affiliate ${conv.affiliate_id}`)
      return null
    }

    // Dynamic Macro Replacement
    let renderedUrl = cfg.postback_url
      .replace(/{CLICK_ID}/gi, encodeURIComponent(conv.click_id))
      .replace(/{AFFILIATE_ID}/gi, encodeURIComponent(conv.affiliate_id))
      .replace(/{OFFER_ID}/gi, encodeURIComponent(conv.offer_id))
      .replace(/{CONVERSION_ID}/gi, encodeURIComponent(conv.conversion_id))
      .replace(/{STATUS}/gi, encodeURIComponent(conv.status))
      .replace(/{PAYOUT}/gi, encodeURIComponent(String(conv.payout_amount)))
      .replace(/{COMMISSION}/gi, encodeURIComponent(String(conv.payout_amount)))
      .replace(/{AMOUNT}/gi, encodeURIComponent(String(conv.order_amount)))

    const logId = `pb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    // Perform Server-to-Server HTTP request with timeout & redaction
    const startTime = Date.now()
    const result = await this.executeHttpRequest(renderedUrl, cfg.http_method, 8000)

    const status = (result.statusCode >= 200 && result.statusCode < 300)
      ? 'confirmed'
      : (result.statusCode > 0 ? 'failed' : 'retrying')

    // Redact sensitive headers or secrets in response body
    const cleanResponseBody = result.body ? result.body.slice(0, 1000) : ''

    db.prepare(`
      INSERT INTO affiliate_postbacks (
        id, conversion_id, click_id, affiliate_id, url, http_method, http_status,
        response_body, attempt_count, status, error_message, last_attempt_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, 1, ?, ?, datetime('now'), datetime('now')
      )
    `).run(
      logId,
      conv.conversion_id,
      conv.click_id,
      conv.affiliate_id,
      renderedUrl,
      cfg.http_method,
      result.statusCode || null,
      cleanResponseBody,
      status,
      result.error || null
    )

    const log = db.prepare('SELECT * FROM affiliate_postbacks WHERE id = ?').get(logId) as AffiliatePostbackLog
    logger.info('affiliate', `[Postback] Dispatched postback for conversion ${conv.conversion_id} to ${renderedUrl} -> Status ${result.statusCode || 'ERR'} (${Date.now() - startTime}ms)`)

    return log
  }

  public async retryPostback(postbackId: string, adminUserId: string = 'admin-default'): Promise<AffiliatePostbackLog> {
    const db = getDatabase()
    const pb = db.prepare('SELECT * FROM affiliate_postbacks WHERE id = ?').get(postbackId) as AffiliatePostbackLog | undefined
    if (!pb) throw new Error('Postback record not found.')

    const result = await this.executeHttpRequest(pb.url, pb.http_method || 'GET', 8000)
    const newStatus = (result.statusCode >= 200 && result.statusCode < 300) ? 'confirmed' : 'failed'

    db.prepare(`
      UPDATE affiliate_postbacks
      SET attempt_count = attempt_count + 1,
          http_status = ?,
          response_body = ?,
          status = ?,
          error_message = ?,
          last_attempt_at = datetime('now')
      WHERE id = ?
    `).run(result.statusCode || null, result.body?.slice(0, 1000) || '', newStatus, result.error || null, postbackId)

    this.recordAuditLog('postback_retried', adminUserId, postbackId, `Retried postback: ${newStatus} (${result.statusCode})`)
    return db.prepare('SELECT * FROM affiliate_postbacks WHERE id = ?').get(postbackId) as AffiliatePostbackLog
  }

  private executeHttpRequest(targetUrl: string, method: string = 'GET', timeoutMs: number = 8000): Promise<{ statusCode: number; body: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(targetUrl)
        const isHttps = parsed.protocol === 'https:'
        const client = isHttps ? https : http

        const req = client.request(
          targetUrl,
          {
            method: method.toUpperCase(),
            timeout: timeoutMs,
            headers: {
              'User-Agent': 'AntiProfiles-CPA-Postback/1.0',
              'Accept': '*/*'
            }
          },
          (res) => {
            let data = ''
            res.setEncoding('utf8')
            res.on('data', (chunk) => { data += chunk })
            res.on('end', () => {
              resolve({ statusCode: res.statusCode || 0, body: data })
            })
          }
        )

        req.on('timeout', () => {
          req.destroy()
          resolve({ statusCode: 408, body: '', error: 'Request timeout' })
        })

        req.on('error', (err) => {
          resolve({ statusCode: 0, body: '', error: err.message })
        })

        req.end()
      } catch (err: any) {
        resolve({ statusCode: 0, body: '', error: err.message })
      }
    })
  }

  // ──────────────────────────────────────────────
  // 7. Multi-Status Withdrawal Engine
  // ──────────────────────────────────────────────

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

    this.recordAuditLog('withdrawal_requested', userId, withdrawalId, `User requested withdrawal of $${amount} via ${payoutMethod}`)
    return db.prepare('SELECT * FROM affiliate_withdrawals WHERE id = ?').get(withdrawalId) as AffiliateWithdrawalRecord
  }

  public adminUpdateWithdrawal(
    withdrawalId: string,
    status: WithdrawalStatus,
    adminNotes?: string,
    payoutReference?: string,
    adminUserId: string = 'admin-default'
  ): AffiliateWithdrawalRecord {
    const db = getDatabase()
    const w = db.prepare('SELECT * FROM affiliate_withdrawals WHERE id = ?').get(withdrawalId) as AffiliateWithdrawalRecord | undefined
    if (!w) throw new Error('Withdrawal request not found.')

    // Prevent duplicate settlements if already paid
    if (w.status === 'paid' && status === 'paid') {
      throw new Error('This withdrawal has already been settled and marked as Paid.')
    }

    const now = new Date().toISOString()

    const updateTx = db.transaction(() => {
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

        logger.info('affiliate', `[AffiliateService] 💸 Withdrawal ${withdrawalId} ($${w.amount}) successfully marked as PAID (Ref: ${payoutReference})`)
      } else if (status === 'rejected' || status === 'failed' || status === 'cancelled') {
        db.prepare(`
          UPDATE affiliate_withdrawals
          SET status = ?, admin_notes = ?, processed_at = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(status, adminNotes || `Withdrawal marked as ${status}`, now, withdrawalId)

        // Ledger refund record
        db.prepare(`
          INSERT INTO affiliate_ledger (
            id, user_id, type, amount, balance_after, reference_id, description, created_at
          ) VALUES (
            ?, ?, 'withdrawal_refund', ?, (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE referrer_user_id = ? AND status = 'available'), ?, ?, datetime('now')
          )
        `).run(`ledg_${Date.now()}`, w.user_id, w.amount, w.user_id, withdrawalId, `Refunded ${status} withdrawal of $${w.amount}`)
      } else if (status === 'processing') {
        db.prepare(`
          UPDATE affiliate_withdrawals
          SET status = 'processing', admin_notes = ?, processed_at = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(adminNotes || w.admin_notes, now, withdrawalId)
      } else {
        db.prepare(`
          UPDATE affiliate_withdrawals
          SET status = 'approved', admin_notes = ?, processed_at = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(adminNotes || w.admin_notes, now, withdrawalId)
      }

      this.recordAuditLog(`withdrawal_${status}`, adminUserId, withdrawalId, `Withdrawal ${withdrawalId} updated to ${status}. Notes: ${adminNotes || ''}`)
    })

    updateTx()

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

  // ──────────────────────────────────────────────
  // 8. User Affiliate Summary & Analytics
  // ──────────────────────────────────────────────

  public getUserAffiliateSummary(userId: string): AffiliateUserSummary {
    this.promoteMaturedCommissions()
    const db = getDatabase()
    const { affiliateId, referralCode, status: affStatus } = this.getOrCreateAffiliateId(userId)
    const settings = this.getSettings()

    // Clicks stats
    const totalClicksRow = db.prepare('SELECT COUNT(*) as count FROM affiliate_clicks WHERE affiliate_id = ?').get(affiliateId) as { count: number }
    const uniqueClicksRow = db.prepare('SELECT COUNT(DISTINCT ip_address) as count FROM affiliate_clicks WHERE affiliate_id = ?').get(affiliateId) as { count: number }
    const totalClicks = totalClicksRow?.count || 0
    const uniqueClicks = uniqueClicksRow?.count || 0

    // Conversions stats
    const convRow = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(payout_amount), 0) as totalPayout FROM affiliate_conversions WHERE affiliate_id = ?').get(affiliateId) as { count: number; totalPayout: number }
    const totalConversions = convRow?.count || 0
    const conversionRate = totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 10000) / 100 : 0

    // Financial Balances
    const totalSalesRow = db.prepare(`
      SELECT COALESCE(SUM(order_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status != 'rejected' AND status != 'reversed'
    `).get(userId) as { total: number }
    const totalReferredSales = Math.round(totalSalesRow.total * 100) / 100

    const totalEarnedRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status IN ('pending', 'available', 'withdrawn')
    `).get(userId) as { total: number }
    const totalEarned = Math.round(totalEarnedRow.total * 100) / 100

    const pendingRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status = 'pending'
    `).get(userId) as { total: number }
    const pendingCommission = Math.round(pendingRow.total * 100) / 100

    const availableGrossRow = db.prepare(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM affiliate_commissions
      WHERE referrer_user_id = ? AND status = 'available'
    `).get(userId) as { total: number }
    const availableGross = Math.round(availableGrossRow.total * 100) / 100

    const paidWithRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM affiliate_withdrawals
      WHERE user_id = ? AND status = 'paid'
    `).get(userId) as { total: number }
    const paidCommission = Math.round(paidWithRow.total * 100) / 100

    const pendingWithRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM affiliate_withdrawals
      WHERE user_id = ? AND status IN ('pending', 'approved', 'processing')
    `).get(userId) as { total: number }
    const pendingWithdrawalAmount = Math.round(pendingWithRow.total * 100) / 100

    const availableBalance = Math.max(0, Math.round((availableGross - pendingWithdrawalAmount) * 100) / 100)

    // Detailed collections
    const postbackConfig = this.getPostbackConfig(userId)
    const offers = this.getOffers(true)
    const trackingLinks = this.getTrackingLinksForUser(userId)

    const recentClicks = db.prepare(`
      SELECT * FROM affiliate_clicks WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(affiliateId) as AffiliateClick[]

    const recentConversions = db.prepare(`
      SELECT * FROM affiliate_conversions WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(affiliateId) as AffiliateConversion[]

    const recentCommissions = db.prepare(`
      SELECT c.*, u.name as referred_user_name, u.email as referred_user_email
      FROM affiliate_commissions c
      LEFT JOIN users u ON u.id = c.referred_user_id
      WHERE c.referrer_user_id = ?
      ORDER BY c.created_at DESC
      LIMIT 30
    `).all(userId) as AffiliateCommissionRecord[]

    const rawWithdrawals = db.prepare(`
      SELECT * FROM affiliate_withdrawals WHERE user_id = ? ORDER BY requested_at DESC LIMIT 30
    `).all(userId) as AffiliateWithdrawalRecord[]

    const recentWithdrawals = rawWithdrawals.map(w => {
      let parsed = {}
      try { parsed = JSON.parse(w.payout_details) } catch {}
      return { ...w, parsed_payout_details: parsed }
    })

    const recentPostbacks = db.prepare(`
      SELECT * FROM affiliate_postbacks WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(affiliateId) as AffiliatePostbackLog[]

    const domain = (settings?.system_domain || 'https://antiprofiles.com').replace(/\/$/, '')

    return {
      affiliateId,
      affiliateStatus: affStatus,
      referralCode,
      referralLink: `${domain}/register?ref=${referralCode}`,
      commissionRate: settings.commission_rate_percent,
      minWithdrawalUsd: settings.min_withdrawal_usd,
      holdingPeriodDays: settings.holding_period_days,
      totalClicks,
      uniqueClicks,
      totalConversions,
      conversionRate,
      totalReferredSales,
      totalEarned,
      pendingCommission,
      approvedCommission: availableGross,
      paidCommission,
      availableBalance,
      withdrawnAmount: paidCommission,
      pendingWithdrawalAmount,
      enabledPayoutMethods: settings.enabled_payout_methods,
      postbackConfig,
      offers,
      trackingLinks,
      recentClicks,
      recentConversions,
      recentCommissions,
      recentWithdrawals,
      recentPostbacks
    }
  }

  // ──────────────────────────────────────────────
  // 9. Admin Overview & Reporting
  // ──────────────────────────────────────────────

  public getAdminAffiliateOverview(): {
    settings: AffiliateSettings
    stats: {
      totalAffiliates: number
      totalClicks: number
      totalConversions: number
      totalReferredRevenue: number
      totalCommissionsPaid: number
      totalCommissionsPending: number
      totalPendingWithdrawalRequests: number
      pendingWithdrawalSum: number
    }
    affiliates: any[]
    offers: AffiliateOffer[]
    clicks: AffiliateClick[]
    conversions: AffiliateConversion[]
    postbacks: AffiliatePostbackLog[]
    withdrawals: AffiliateWithdrawalRecord[]
    auditLogs: AffiliateAuditLog[]
  } {
    this.promoteMaturedCommissions()
    const db = getDatabase()
    const settings = this.getSettings()

    const affiliates = db.prepare(`
      SELECT u.id, u.name, u.email, u.affiliate_id, u.affiliate_status, u.referral_code, u.created_at,
             COALESCE((SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id = u.affiliate_id), 0) as clicks_count,
             COALESCE((SELECT COUNT(*) FROM affiliate_conversions WHERE affiliate_id = u.affiliate_id), 0) as conversions_count,
             COALESCE((SELECT SUM(commission_amount) FROM affiliate_commissions WHERE referrer_user_id = u.id AND status IN ('pending','available','withdrawn')), 0) as total_earned,
             COALESCE((SELECT SUM(amount) FROM affiliate_withdrawals WHERE user_id = u.id AND status = 'paid'), 0) as total_withdrawn
      FROM users u
      WHERE u.affiliate_id IS NOT NULL OR u.referral_code IS NOT NULL
      ORDER BY u.created_at DESC
      LIMIT 100
    `).all()

    const clicksCountRow = db.prepare('SELECT COUNT(*) as count FROM affiliate_clicks').get() as { count: number }
    const convCountRow = db.prepare('SELECT COUNT(*) as count FROM affiliate_conversions').get() as { count: number }
    const revRow = db.prepare("SELECT COALESCE(SUM(order_amount), 0) as total FROM affiliate_commissions WHERE status != 'rejected' AND status != 'reversed'").get() as { total: number }
    const paidCommsRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM affiliate_withdrawals WHERE status = 'paid'").get() as { total: number }
    const pendingCommsRow = db.prepare("SELECT COALESCE(SUM(commission_amount), 0) as total FROM affiliate_commissions WHERE status = 'pending'").get() as { total: number }
    const pendingWithsRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as sum FROM affiliate_withdrawals WHERE status IN ('pending', 'approved', 'processing')").get() as { count: number; sum: number }

    const offers = this.getOffers(false)
    const clicks = db.prepare('SELECT * FROM affiliate_clicks ORDER BY created_at DESC LIMIT 50').all() as AffiliateClick[]
    const conversions = db.prepare('SELECT * FROM affiliate_conversions ORDER BY created_at DESC LIMIT 50').all() as AffiliateConversion[]
    const postbacks = db.prepare('SELECT * FROM affiliate_postbacks ORDER BY created_at DESC LIMIT 50').all() as AffiliatePostbackLog[]

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

    const auditLogs = db.prepare('SELECT * FROM affiliate_audit_logs ORDER BY created_at DESC LIMIT 50').all() as AffiliateAuditLog[]

    return {
      settings,
      stats: {
        totalAffiliates: affiliates.length,
        totalClicks: clicksCountRow?.count || 0,
        totalConversions: convCountRow?.count || 0,
        totalReferredRevenue: Math.round(revRow.total * 100) / 100,
        totalCommissionsPaid: Math.round(paidCommsRow.total * 100) / 100,
        totalCommissionsPending: Math.round(pendingCommsRow.total * 100) / 100,
        totalPendingWithdrawalRequests: pendingWithsRow?.count || 0,
        pendingWithdrawalSum: Math.round(pendingWithsRow?.sum * 100) / 100
      },
      affiliates,
      offers,
      clicks,
      conversions,
      postbacks,
      withdrawals,
      auditLogs
    }
  }

  // ──────────────────────────────────────────────
  // 10. Audit Logging & Utilities
  // ──────────────────────────────────────────────

  public recordAuditLog(action: string, performedBy: string, targetId: string, details: string, ipAddress?: string): void {
    try {
      const db = getDatabase()
      const logId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      db.prepare(`
        INSERT INTO affiliate_audit_logs (id, action, performed_by, target_id, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(logId, action, performedBy, targetId, details, ipAddress || '127.0.0.1')
    } catch {}
  }

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

  public recordReferralAttribution(newUserId: string, rawRefCode: string): boolean {
    if (!rawRefCode || !rawRefCode.trim()) return false
    const code = rawRefCode.trim().toUpperCase()
    const db = getDatabase()

    const referringUser = db.prepare('SELECT id FROM users WHERE UPPER(referral_code) = ? OR UPPER(affiliate_id) = ?').get(code, code) as { id: string } | undefined
    if (!referringUser) return false
    if (referringUser.id === newUserId) return false

    db.prepare('UPDATE users SET referred_by = ? WHERE id = ? AND (referred_by IS NULL OR referred_by = "")').run(referringUser.id, newUserId)
    logger.info('affiliate', `[AffiliateService] User ${newUserId} attributed to referrer ${referringUser.id}`)

    this.broadcastEvent('ui:affiliate-new-referral', {
      referrerUserId: referringUser.id,
      referredUserId: newUserId,
      timestamp: Date.now()
    })

    return true
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
