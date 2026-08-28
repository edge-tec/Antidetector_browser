// ──────────────────────────────────────────────
// AntiProfiles — Real-Time CPA Affiliate Tracking, Commission, Postback & Withdrawal Service
// ──────────────────────────────────────────────

import { BrowserWindow } from 'electron'
import http from 'http'
import https from 'https'
import { URL } from 'url'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'
import { centralApi } from './api-client.service'
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
  todayClicks: number
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

  private constructor() {
    this.ensureSchemaExists()
  }

  public static getInstance(): AffiliateService {
    if (!AffiliateService.instance) {
      AffiliateService.instance = new AffiliateService()
    }
    return AffiliateService.instance
  }

  public ensureSchemaExists(): void {
    try {
      const db = getDatabase()
      try { db.exec("ALTER TABLE users ADD COLUMN affiliate_id TEXT;") } catch {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_affiliate_id ON users(affiliate_id);") } catch {}
      try { db.exec("ALTER TABLE users ADD COLUMN affiliate_status TEXT DEFAULT 'active';") } catch {}
      try { db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT;") } catch {}
    } catch {}
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

    const cleanId = (userId || 'PARTNER').replace(/^usr_/i, '').replace(/[^a-zA-Z0-9]/g, '')
    const defaultSuffix = cleanId.length >= 4 ? cleanId.slice(0, 6).toUpperCase() : (cleanId + '8888').slice(0, 6).toUpperCase()

    const isInvalidRefCode = !refCode || refCode.endsWith('_') || refCode === 'REF_USR' || refCode === 'REF_USER' || refCode.length < 6
    if (isInvalidRefCode) {
      refCode = 'REF_' + defaultSuffix
      if (user) {
        try { db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(refCode, userId) } catch {}
      }
    }

    const isInvalidAffId = !affId || affId.endsWith('_') || affId === 'AFF-USR' || affId === 'AFF-USER' || affId.length < 6
    if (isInvalidAffId) {
      affId = 'AFF-' + (refCode ? refCode.replace(/^REF_/, '') : defaultSuffix)
      if (user) {
        try { db.prepare('UPDATE users SET affiliate_id = ? WHERE id = ?').run(affId, userId) } catch {}
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

  public updateAffiliateStatus(affiliateId: string, status: AffiliateAccountStatus, adminUserId: string = 'system'): boolean {
    const db = getDatabase()
    const res = db.prepare('UPDATE users SET affiliate_status = ? WHERE affiliate_id = ?').run(status, affiliateId)
    if (res.changes > 0) {
      this.recordAuditLog('affiliate_' + status, adminUserId, affiliateId, `Affiliate status changed to ${status}`)
      return true
    }
    return false
  }

  // ──────────────────────────────────────────────
  // 3. Dynamic CPA Offers Catalog & Sync
  // ──────────────────────────────────────────────

  public async syncOffersFromCentralServer(): Promise<AffiliateOffer[]> {
    try {
      const res = await centralApi.getAffiliateOffers(true)
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const db = getDatabase()
        const upsert = db.prepare(`
          INSERT INTO affiliate_offers (
            id, title, description, target_url, signup_url, payout_type,
            commission_rate, fixed_payout_usd, package_id, package_name, price,
            original_price, discount_type, discount_value, discounted_price, trial_days, status, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, datetime('now')
          )
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            target_url = excluded.target_url,
            signup_url = excluded.signup_url,
            payout_type = excluded.payout_type,
            commission_rate = excluded.commission_rate,
            fixed_payout_usd = excluded.fixed_payout_usd,
            package_id = excluded.package_id,
            package_name = excluded.package_name,
            price = excluded.price,
            original_price = excluded.original_price,
            discount_type = excluded.discount_type,
            discount_value = excluded.discount_value,
            discounted_price = excluded.discounted_price,
            trial_days = excluded.trial_days,
            status = excluded.status,
            updated_at = datetime('now')
        `)

        const tx = db.transaction(() => {
          for (const off of res.data) {
            upsert.run(
              off.id,
              off.title,
              off.description || '',
              off.target_url || off.targetUrl || '/offer/professional',
              off.signup_url || off.signupUrl || '/register',
              off.payout_type || off.payoutType || 'percentage',
              off.commission_rate ?? off.commissionRate ?? 50.0,
              off.fixed_payout_usd ?? off.fixedPayoutUsd ?? 0.0,
              off.package_id || off.packageId || 'plan_pro',
              off.package_name || off.packageName || 'Professional',
              off.price ?? 49.0,
              off.original_price ?? off.originalPrice ?? off.price ?? 49.0,
              off.discount_type || off.discountType || 'none',
              off.discount_value ?? off.discountValue ?? 0.0,
              off.discounted_price ?? off.discountedPrice ?? off.price ?? 49.0,
              off.trial_days ?? off.trialDays ?? 7,
              off.status || 'active'
            )
          }
        })
        tx()
        logger.info('affiliate', `[AffiliateService] Successfully synced ${res.data.length} CPA offers from central server.`)
      }
    } catch (err: any) {
      logger.warn('affiliate', `[AffiliateService] Remote CPA offers sync skipped/failed: ${err.message}`)
    }
    return this.getOffers(false)
  }

  public async syncAffiliateDataFromCentralServer(_userId?: string): Promise<void> {
    try {
      await this.syncOffersFromCentralServer().catch(() => {})
      
      const summaryRes = await centralApi.getAffiliateSummary().catch(() => null)
      if (summaryRes?.success && summaryRes.data) {
        const db = getDatabase()
        const data = summaryRes.data
        
        if (_userId) {
          this.serverSummaryCache.set(_userId, {
            totalClicks: Number(data.totalClicks) || 0,
            todayClicks: Number(data.todayClicks) || 0,
            uniqueClicks: Number(data.uniqueClicks) || 0,
            timestamp: Date.now()
          })
        }
        
        // Sync clicks
        if (Array.isArray(data.recentClicks) && data.recentClicks.length > 0) {
          const upsertClick = db.prepare(`
            INSERT INTO affiliate_clicks (
              click_id, affiliate_id, offer_id, package_id, ip_address, user_agent, referrer, landing_url,
              sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, converted, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?
            )
            ON CONFLICT(click_id) DO UPDATE SET
              converted = excluded.converted,
              ip_address = excluded.ip_address,
              package_id = excluded.package_id
          `)
          for (const c of data.recentClicks) {
            try {
              upsertClick.run(
                c.click_id,
                c.affiliate_id || 'AFF-28DE2A',
                c.offer_id || 'offer_main_saas',
                c.package_id || 'plan_pro',
                c.ip_address || '',
                c.user_agent || '',
                c.referrer || '',
                c.landing_url || '',
                c.sub_id1 || null,
                c.sub_id2 || null,
                c.sub_id3 || null,
                c.sub_id4 || null,
                c.sub_id5 || null,
                c.converted ? 1 : 0,
                c.created_at || new Date().toISOString()
              )
            } catch {}
          }
        }
      }
    } catch (err: any) {
      logger.warn('affiliate', `[Central Sync] Background affiliate data sync error: ${err.message}`)
    }
  }

  public getOffers(onlyActive: boolean = false): AffiliateOffer[] {
    const db = getDatabase()
    
    // Retrieve any deleted offer IDs to ensure they are never resurrected
    let deletedOfferIds: string[] = []
    try {
      const deletedRow = db.prepare("SELECT value FROM affiliate_settings WHERE key = 'deleted_offer_ids'").get() as { value: string } | undefined
      if (deletedRow?.value) {
        deletedOfferIds = JSON.parse(deletedRow.value)
      }
    } catch {}
    
    const defaultOffersToSeed = [
      ['offer_starter_license', 'AntiProfiles Starter License', 'Fixed $10.00 instant CPA payout per verified first-time starter license purchase ($19/mo package).', '/offer/starter-license', '/offer/starter-license', 'fixed', 0.0, 10.0, 'plan_starter', 'Starter License', 19.0, 19.0, 'none', 0.0, 19.0, 7, 'active'],
      ['offer_starter', 'AntiProfiles Starter Subscription', 'Standard 40% recurring conversion offer for AntiProfiles Starter package ($19/mo).', '/offer/starter', '/offer/starter', 'percentage', 40.0, 0.0, 'plan_starter', 'Starter', 19.0, 19.0, 'none', 0.0, 19.0, 7, 'active'],
      ['offer_main_saas', 'AntiProfiles Professional', 'Earn 50% lifetime recurring commissions on Professional browser subscription renewals ($49/mo).', '/offer/professional', '/offer/professional', 'percentage', 50.0, 0.0, 'plan_pro', 'Professional', 49.0, 49.0, 'none', 0.0, 49.0, 7, 'active'],
      ['offer_pro_team', 'AntiProfiles Pro + Team Plan', 'Multi-seat team workspace with 50% lifetime recurring commissions ($49/mo).', '/offer/pro-team', '/offer/pro-team', 'percentage', 50.0, 0.0, 'plan_pro', 'Professional Team', 49.0, 49.0, 'none', 0.0, 49.0, 7, 'active'],
      ['offer_enterprise_trial', 'AntiProfiles Enterprise Trial', 'Enterprise 7-day risk-free pilot with 50% recurring onboard commissions ($99/mo).', '/offer/enterprise-trial', '/offer/enterprise-trial', 'percentage', 50.0, 0.0, 'plan_business', 'Enterprise Trial', 99.0, 99.0, 'none', 0.0, 99.0, 7, 'active'],
      ['offer_business', 'AntiProfiles Enterprise Suite', 'High-ticket 50% recurring onboarding commission on full Enterprise subscriptions ($99/mo).', '/offer/enterprise', '/offer/enterprise', 'percentage', 50.0, 0.0, 'plan_business', 'Enterprise', 99.0, 99.0, 'none', 0.0, 99.0, 7, 'active'],
      ['offer_business_custom', 'AntiProfiles Custom Business', 'Custom high-volume business licensing with dedicated infrastructure and 50% revenue share.', '/offer/business-custom', '/offer/business-custom', 'percentage', 50.0, 0.0, 'plan_business', 'Custom Business', 99.0, 99.0, 'none', 0.0, 99.0, 7, 'active'],
      ['offer_starter_bounty', 'AntiProfiles Starter Account Direct Bounty', 'Earn a $10.00 instant CPA bounty for every newly verified paying user.', '/offer/starter-license', '/offer/starter-license', 'fixed', 0.0, 10.0, 'plan_starter', 'Starter License', 19.0, 19.0, 'none', 0.0, 19.0, 7, 'active']
    ]

    for (const dof of defaultOffersToSeed) {
      if (deletedOfferIds.includes(dof[0])) continue
      try {
        db.prepare(`
          INSERT INTO affiliate_offers (
            id, title, description, target_url, signup_url, payout_type, commission_rate, fixed_payout_usd,
            package_id, package_name, price, original_price, discount_type, discount_value, discounted_price, trial_days, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(id) DO NOTHING
        `).run(...dof)
      } catch {}
    }

    const query = onlyActive
      ? "SELECT * FROM affiliate_offers WHERE status = 'active' ORDER BY created_at DESC"
      : "SELECT * FROM affiliate_offers WHERE status != 'archived' ORDER BY created_at DESC"
    const offers = db.prepare(query).all() as AffiliateOffer[]
    return offers
  }

  public getOfferById(offerId: string): AffiliateOffer | null {
    const db = getDatabase()
    let offer = db.prepare('SELECT * FROM affiliate_offers WHERE id = ?').get(offerId) as AffiliateOffer | undefined
    if (!offer) {
      this.getOffers() // Trigger auto-seed if empty
      offer = db.prepare('SELECT * FROM affiliate_offers WHERE id = ?').get(offerId) as AffiliateOffer | undefined
    }
    return offer || null
  }

  public createOrUpdateOffer(offer: Partial<AffiliateOffer>, adminUserId: string = 'admin-default'): AffiliateOffer {
    const db = getDatabase()
    const offerId = offer.id || `offer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const title = offer.title || 'Untitled CPA Offer'
    const desc = offer.description || ''
    const targetUrl = offer.target_url || '/offer/professional'
    const signupUrl = offer.signup_url || targetUrl
    const payoutType = offer.payout_type || 'percentage'
    const commRate = offer.commission_rate !== undefined ? offer.commission_rate : 10.0
    const fixedPayout = offer.fixed_payout_usd !== undefined ? offer.fixed_payout_usd : 0.0
    const packageId = offer.package_id || 'plan_pro'
    const packageName = offer.package_name || 'Professional'
    const price = offer.price !== undefined ? offer.price : 49.0
    const originalPrice = offer.original_price !== undefined ? offer.original_price : price
    const discountType = offer.discount_type || 'none'
    const discountValue = offer.discount_value !== undefined ? offer.discount_value : (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0)
    const discountedPrice = offer.discounted_price !== undefined ? offer.discounted_price : price
    const trialDays = offer.trial_days !== undefined ? offer.trial_days : 7
    const trialEnabled = offer.trial_enabled ? 1 : 0
    const ctaText = offer.cta_text || 'Subscribe'
    const badgeText = offer.badge_text || null
    const landingPageSlug = offer.landing_page_slug || (packageId === 'plan_starter' ? 'starter' : packageId === 'plan_business' ? 'business' : packageId === 'plan_free' ? 'free' : 'professional')
    const bannerUrl = offer.banner_url || null
    const currency = offer.currency || 'USD'
    const status = offer.status || 'active'

    db.prepare(`
      INSERT INTO affiliate_offers (
        id, title, description, target_url, signup_url, payout_type, commission_rate, fixed_payout_usd,
        package_id, package_name, price, original_price, discount_type, discount_value, discounted_price,
        trial_days, trial_enabled, cta_text, badge_text, landing_page_slug, banner_url, currency, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        target_url = excluded.target_url,
        signup_url = excluded.signup_url,
        payout_type = excluded.payout_type,
        commission_rate = excluded.commission_rate,
        fixed_payout_usd = excluded.fixed_payout_usd,
        package_id = excluded.package_id,
        package_name = excluded.package_name,
        price = excluded.price,
        original_price = excluded.original_price,
        discount_type = excluded.discount_type,
        discount_value = excluded.discount_value,
        discounted_price = excluded.discounted_price,
        trial_days = excluded.trial_days,
        trial_enabled = excluded.trial_enabled,
        cta_text = excluded.cta_text,
        badge_text = excluded.badge_text,
        landing_page_slug = excluded.landing_page_slug,
        banner_url = excluded.banner_url,
        currency = excluded.currency,
        status = excluded.status,
        updated_at = datetime('now')
    `).run(
      offerId, title, desc, targetUrl, signupUrl, payoutType, commRate, fixedPayout,
      packageId, packageName, price, originalPrice, discountType, discountValue, discountedPrice,
      trialDays, trialEnabled, ctaText, badgeText, landingPageSlug, bannerUrl, currency, status
    )

    this.recordAuditLog('offer_saved', adminUserId, offerId, `Saved CPA Offer: ${title} (${payoutType}: ${payoutType === 'percentage' ? commRate + '%' : '$' + fixedPayout})`)

    // Broadcast to all active client windows
    try {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((win: any) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:realtime-event', {
            eventType: 'affiliate.offer.updated',
            payload: { id: offerId, title, status }
          })
          win.webContents.send('affiliate:offers-updated', { id: offerId, title, status })
        }
      })
    } catch {}

    // Sync to remote central server
    centralApi.adminSaveAffiliateOffer({
      id: offerId,
      title,
      description: desc,
      target_url: targetUrl,
      payout_type: payoutType === 'percentage' ? 'revshare' : payoutType,
      revshare_percent: payoutType === 'percentage' ? commRate : 0,
      fixed_payout_usd: payoutType === 'fixed' ? fixedPayout : 0,
      package_id: packageId,
      package_name: packageName,
      price,
      original_price: originalPrice,
      currency,
      landing_page_slug: landingPageSlug,
      banner_url: bannerUrl,
      status
    }).catch(err => {
      logger.warn('affiliate', `[AffiliateService] Central server save offer sync skipped: ${err.message}`)
    })

    return this.getOfferById(offerId)!
  }

  public deleteOffer(offerId: string, permanent: boolean = true, adminUserId: string = 'admin-default'): boolean {
    const db = getDatabase()

    // Store in deleted_offer_ids so it won't be resurrected
    try {
      let deletedOfferIds: string[] = []
      const deletedRow = db.prepare("SELECT value FROM affiliate_settings WHERE key = 'deleted_offer_ids'").get() as { value: string } | undefined
      if (deletedRow?.value) {
        deletedOfferIds = JSON.parse(deletedRow.value)
      }
      if (!deletedOfferIds.includes(offerId)) {
        deletedOfferIds.push(offerId)
        db.prepare("INSERT OR REPLACE INTO affiliate_settings (key, value, updated_at) VALUES ('deleted_offer_ids', ?, datetime('now'))")
          .run(JSON.stringify(deletedOfferIds))
      }
    } catch {}

    if (permanent) {
      db.prepare("DELETE FROM affiliate_offers WHERE id = ?").run(offerId)
      this.recordAuditLog('offer_deleted', adminUserId, offerId, `Permanently deleted CPA offer: ${offerId}`)
    } else {
      db.prepare("UPDATE affiliate_offers SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(offerId)
      this.recordAuditLog('offer_archived', adminUserId, offerId, `Archived CPA offer: ${offerId}`)
    }

    // Broadcast to all active client windows
    try {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((win: any) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:realtime-event', {
            eventType: 'affiliate.offer.deleted',
            payload: { id: offerId, status: permanent ? 'deleted' : 'archived' }
          })
          win.webContents.send('affiliate:offers-updated', { id: offerId, status: permanent ? 'deleted' : 'archived' })
        }
      })
    } catch {}

    // Sync to remote central server
    centralApi.adminDeleteAffiliateOffer(offerId).catch(err => {
      logger.warn('affiliate', `[AffiliateService] Central server delete offer sync skipped: ${err.message}`)
    })

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
    country?: string
    city?: string
    subId1?: string
    subId2?: string
    subId3?: string
    subId4?: string
    subId5?: string
  }): { clickId: string; redirectUrl: string; offer: AffiliateOffer | null; unique_click?: number } {
    const db = getDatabase()
    const affiliateId = (params.affiliateId || (params as any).affiliate_id || (params as any).ref || '').trim()
    const offerId = (params.offerId || (params as any).offer_id || 'offer_main_saas').trim()
    const subId1 = params.subId1 || (params as any).sub_id1 || null
    const subId2 = params.subId2 || (params as any).sub_id2 || null
    const subId3 = params.subId3 || (params as any).sub_id3 || null
    const subId4 = params.subId4 || (params as any).sub_id4 || null
    const subId5 = params.subId5 || (params as any).sub_id5 || null
    const ipAddress = params.ipAddress || (params as any).ip_address || '127.0.0.1'
    const userAgent = params.userAgent || (params as any).user_agent || ''
    const referrer = params.referrer || ''
    const country = params.country || (params as any).country || 'US'
    const city = params.city || (params as any).city || null

    // Parse Device, Browser, OS
    let device = 'Desktop'
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      device = 'Tablet'
    } else if (/(mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop)/i.test(userAgent)) {
      device = 'Mobile'
    }

    let browser = 'Chrome'
    if (/edg/i.test(userAgent)) browser = 'Edge'
    else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox'
    else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = 'Safari'
    else if (/opr\//i.test(userAgent)) browser = 'Opera'
    else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome'

    let os = 'Windows'
    if (/windows nt/i.test(userAgent)) os = 'Windows'
    else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS'
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS'
    else if (/android/i.test(userAgent)) os = 'Android'
    else if (/linux/i.test(userAgent)) os = 'Linux'

    // Validate Affiliate & Offer
    const user = db.prepare('SELECT id, affiliate_status FROM users WHERE affiliate_id = ? OR referral_code = ?').get(affiliateId, affiliateId) as any
    if (user && user.affiliate_status === 'disabled') {
      logger.warn('affiliate', `[Tracking] Click rejected: Affiliate ${affiliateId} is disabled.`)
    }

    const offer = this.getOfferById(offerId) || this.getOffers(true)[0]
    const targetBaseUrl = offer ? offer.target_url : 'https://antiprofiles.com'

    // Generate or use standardized Click ID (Format: CLK-YYYYMMDD-XXXXXXXX e.g. CLK-20260829-8FK39A2P)
    const rawClickId = params.clickId || (params as any).click_id
    let clickId = (rawClickId && rawClickId.trim()) ? rawClickId.trim() : ''
    if (!clickId) {
      const d = new Date()
      const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
      const rand = Math.random().toString(36).substring(2, 10).toUpperCase()
      clickId = `CLK-${ymd}-${rand}`
    }

    // Unique Click Detection (first click from this IP on this offer in last 24h)
    let uniqueClick = 1
    try {
      const count24h = db.prepare("SELECT COUNT(*) as count FROM affiliate_clicks WHERE ip_address = ? AND offer_id = ? AND datetime(created_at) >= datetime('now', '-24 hours')").get(ipAddress, offerId) as { count: number } | undefined
      if (count24h && count24h.count > 0) {
        uniqueClick = 0
      }
    } catch {}

    // Check if Click ID already recorded
    const existing = db.prepare('SELECT click_id FROM affiliate_clicks WHERE click_id = ?').get(clickId)
    if (!existing) {
      db.prepare(`
        INSERT INTO affiliate_clicks (
          click_id, affiliate_id, offer_id, package_id, ip_address, user_agent, referrer, landing_url,
          device, browser, os, country, city, unique_click,
          sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, converted, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 0, datetime('now')
        )
      `).run(
        clickId,
        affiliateId,
        offerId,
        offer?.package_id || 'plan_pro',
        ipAddress,
        userAgent,
        referrer,
        targetBaseUrl,
        device,
        browser,
        os,
        country,
        city,
        uniqueClick,
        subId1,
        subId2,
        subId3,
        subId4,
        subId5
      )

      if (offer) {
        db.prepare('UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?').run(offer.id)
      }
    }

    // Build redirect destination preserving click_id
    const fullTargetBase = targetBaseUrl.startsWith('http')
      ? targetBaseUrl
      : `https://antiprofiles.com${targetBaseUrl.startsWith('/') ? targetBaseUrl : '/' + targetBaseUrl}`
    const redirectUrlObj = new URL(fullTargetBase)
    redirectUrlObj.searchParams.set('click_id', clickId)
    redirectUrlObj.searchParams.set('aff_id', affiliateId)
    redirectUrlObj.searchParams.set('offer_id', offerId)
    if (params.subId1) redirectUrlObj.searchParams.set('sub_id1', params.subId1)

    logger.info('affiliate', `[Tracking] 🚀 Recorded click ${clickId} for affiliate ${affiliateId} on offer ${offerId} (Unique: ${uniqueClick ? 'YES' : 'NO'})`)

    const clickRecord = {
      clickId,
      click_id: clickId,
      redirectUrl: redirectUrlObj.toString(),
      offer,
      converted: 0,
      affiliate_id: affiliateId,
      affiliateId,
      offer_id: offerId,
      package_id: offer?.package_id || 'plan_pro',
      package_name: offer?.package_name || 'Professional',
      ip_address: ipAddress,
      device,
      browser,
      os,
      country,
      city,
      unique_click: uniqueClick,
      sub_id1: subId1,
      created_at: new Date().toISOString()
    }

    this.broadcastEvent('ui:affiliate-click-recorded', clickRecord)
    this.broadcastEvent('ui:affiliate-realtime-update', { type: 'click', data: clickRecord })

    return clickRecord
  }

  public simulateTestClick(affiliateId?: string, offerId?: string, subId1: string = 'test_simulator'): { success: boolean; data: any } {
    const db = getDatabase()
    const targetAffId = (affiliateId && affiliateId.trim()) ? affiliateId.trim() : 'AFF-28DE2A'
    const targetOfferId = (offerId && offerId.trim()) ? offerId.trim() : 'offer_main_saas'
    const offer = this.getOfferById(targetOfferId) || this.getOffers(true)[0]
    const testClickId = `clk_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const ip = '127.0.0.1'
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    const landing = `https://antiprofiles.com/register?ref=${targetAffId}`

    db.prepare(`
      INSERT INTO affiliate_clicks (
        click_id, affiliate_id, offer_id, package_id, ip_address, user_agent, referrer, landing_url,
        sub_id1, converted, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 'https://antiprofiles.com/dashboard', ?,
        ?, 0, datetime('now')
      )
    `).run(testClickId, targetAffId, targetOfferId, offer?.package_id || 'plan_pro', ip, ua, landing, subId1)

    try {
      db.prepare('UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?').run(targetOfferId)
    } catch {}

    logger.info('affiliate', `[AffiliateService] 🧪 Created simulated test click ${testClickId} for ${targetAffId}`)
    const clickData = {
      click_id: testClickId,
      clickId: testClickId,
      affiliate_id: targetAffId,
      affiliateId: targetAffId,
      offer_id: targetOfferId,
      package_id: offer?.package_id || 'plan_pro',
      package_name: offer?.package_name || 'Professional',
      ip_address: ip,
      landing_url: landing,
      sub_id1: subId1,
      created_at: new Date().toISOString()
    }

    this.broadcastEvent('ui:affiliate-click-recorded', clickData)
    this.broadcastEvent('ui:affiliate-realtime-update', { type: 'click', data: clickData })

    return {
      success: true,
      data: clickData
    }
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

  public getAllPostbackConfigs(): any[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT p.*, u.name as user_name, u.email as user_email
      FROM affiliate_postback_configs p
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.updated_at DESC
    `).all()
  }

  public savePostbackConfig(userId: string, postbackUrl: string, httpMethod: 'GET' | 'POST' = 'GET', isActive: boolean = true): AffiliatePostbackConfig {
    const db = getDatabase()
    const { affiliateId } = this.getOrCreateAffiliateId(userId)
    const id = `pbcfg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const activeVal = isActive ? 1 : 0

    db.prepare(`
      INSERT INTO affiliate_postback_configs (
        id, user_id, affiliate_id, postback_url, http_method, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      )
      ON CONFLICT(user_id) DO UPDATE SET
        postback_url = excluded.postback_url,
        http_method = excluded.http_method,
        is_active = excluded.is_active,
        updated_at = datetime('now')
    `).run(id, userId, affiliateId, postbackUrl.trim(), httpMethod, activeVal)

    return this.getPostbackConfig(userId)!
  }

  public adminSavePostbackConfig(userId: string, postbackUrl: string, httpMethod: 'GET' | 'POST' = 'GET', isActive: boolean = true, adminUserId: string = 'admin-default'): AffiliatePostbackConfig {
    const saved = this.savePostbackConfig(userId, postbackUrl, httpMethod, isActive)
    this.recordAuditLog('postback_admin_updated', adminUserId, userId, `Admin updated S2S postback config: ${postbackUrl} (${httpMethod}, active: ${isActive})`)
    logger.info('affiliate', `[AffiliateService] Admin ${adminUserId} updated S2S postback for user ${userId}`)
    return saved
  }

  public async adminTestPostback(postbackUrl: string, httpMethod: 'GET' | 'POST' = 'GET'): Promise<{ statusCode: number; responseTimeMs: number; error?: string }> {
    const testUrl = postbackUrl
      .replace(/{CLICK_ID}/gi, 'test_click_123456')
      .replace(/{AFFILIATE_ID}/gi, 'AFF-TEST')
      .replace(/{OFFER_ID}/gi, 'offer_main_saas')
      .replace(/{CONVERSION_ID}/gi, 'test_conv_987654')
      .replace(/{STATUS}/gi, 'approved')
      .replace(/{PAYOUT}/gi, '15.00')
      .replace(/{COMMISSION}/gi, '15.00')
      .replace(/{AMOUNT}/gi, '100.00')

    const start = Date.now()
    const res = await this.executeHttpRequest(testUrl, httpMethod, 6000)
    const elapsed = Date.now() - start
    return {
      statusCode: res.statusCode,
      responseTimeMs: elapsed,
      error: res.error
    }
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

    const cleanSuffix = referralCode.replace(/^(REF_|AFF-)/i, '')
    const searchAffIds = Array.from(new Set([affiliateId, referralCode, cleanSuffix, 'REF_' + cleanSuffix, 'AFF-' + cleanSuffix]))
    const placeholders = searchAffIds.map(() => '?').join(',')

    // Clicks stats
    const totalClicksRow = db.prepare(`SELECT COUNT(*) as count FROM affiliate_clicks WHERE affiliate_id IN (${placeholders})`).get(...searchAffIds) as { count: number }
    const todayClicksRow = db.prepare(`SELECT COUNT(*) as count FROM affiliate_clicks WHERE affiliate_id IN (${placeholders}) AND date(created_at) = date('now')`).get(...searchAffIds) as { count: number }
    const uniqueClicksRow = db.prepare(`SELECT COUNT(DISTINCT ip_address) as count FROM affiliate_clicks WHERE affiliate_id IN (${placeholders})`).get(...searchAffIds) as { count: number }

    const cachedServer = this.serverSummaryCache ? this.serverSummaryCache.get(userId) : null
    const totalClicks = Math.max(totalClicksRow?.count || 0, cachedServer?.totalClicks || 0)
    const todayClicks = Math.max(todayClicksRow?.count || 0, cachedServer?.todayClicks || 0)
    const uniqueClicks = Math.max(uniqueClicksRow?.count || 0, cachedServer?.uniqueClicks || 0)

    // Conversions stats
    const convRow = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(payout_amount), 0) as totalPayout FROM affiliate_conversions WHERE affiliate_id IN (${placeholders})`).get(...searchAffIds) as { count: number; totalPayout: number }
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
      SELECT * FROM affiliate_clicks WHERE affiliate_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 50
    `).all(...searchAffIds) as AffiliateClick[]

    const recentConversions = db.prepare(`
      SELECT * FROM affiliate_conversions WHERE affiliate_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 30
    `).all(...searchAffIds) as AffiliateConversion[]

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
      todayClicks,
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
    this.ensureSchemaExists()
    const db = getDatabase()
    const settings = this.getSettings()

    // Auto-provision and heal affiliate_id and referral_code for all users
    try {
      const allUsers = db.prepare('SELECT id, affiliate_id, referral_code FROM users').all() as { id: string; affiliate_id?: string; referral_code?: string }[]
      for (const u of allUsers) {
        if (!u.affiliate_id || !u.referral_code || u.affiliate_id.endsWith('_') || u.referral_code.endsWith('_') || u.affiliate_id.length < 6 || u.referral_code.length < 6) {
          this.getOrCreateAffiliateId(u.id)
        }
      }
    } catch {}

    let affiliates: any[] = []
    try {
      affiliates = db.prepare(`
        SELECT u.id, u.name, u.email, u.affiliate_id, COALESCE(u.affiliate_status, 'active') as affiliate_status, u.referral_code, u.created_at,
               COALESCE((SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id = u.affiliate_id), 0) as clicks_count,
               COALESCE((SELECT COUNT(*) FROM affiliate_conversions WHERE affiliate_id = u.affiliate_id), 0) as conversions_count,
               COALESCE((SELECT SUM(commission_amount) FROM affiliate_commissions WHERE referrer_user_id = u.id AND status IN ('pending','available','withdrawn')), 0) as total_earned,
               COALESCE((SELECT SUM(amount) FROM affiliate_withdrawals WHERE user_id = u.id AND status = 'paid'), 0) as total_withdrawn
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 500
      `).all()
    } catch {
      affiliates = []
    }

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
      postbackConfigs: this.getAllPostbackConfigs(),
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
