// ──────────────────────────────────────────────
// AntiProfiles — Unit Tests: Complete CPA Affiliate Tracking, Commission, Postback & Withdrawal System
// ──────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { getDatabase } from '../../src/main/database/connection'
import { AffiliateService } from '../../src/main/services/affiliate.service'

describe('CPA Affiliate Tracking, Postback & Withdrawal System', () => {
  let affiliateService: AffiliateService

  beforeEach(() => {
    affiliateService = AffiliateService.getInstance()
  })

  describe('1. Affiliate Identity & Offers Management', () => {
    it('creates unique affiliate ID and referral code for a user', () => {
      const userRes = affiliateService.getOrCreateAffiliateId('usr_test_cpa_1001')
      expect(userRes.affiliateId).toMatch(/^AFF-/)
      expect(userRes.referralCode).toMatch(/^REF_/)
      expect(userRes.status).toBe('active')
    })

    it('retrieves and manages CPA offers with percentage and fixed payouts', () => {
      const offers = affiliateService.getOffers(false)
      expect(Array.isArray(offers)).toBe(true)

      const createdOffer = affiliateService.createOrUpdateOffer({
        id: 'offer_cpa_test_1',
        title: 'Test CPA Campaign Pro',
        target_url: 'https://antiprofiles.com/pricing',
        payout_type: 'fixed',
        fixed_payout_usd: 25.0,
        status: 'active'
      }, 'admin_test')

      expect(createdOffer.id).toBe('offer_cpa_test_1')
      expect(createdOffer.fixed_payout_usd).toBe(25.0)

      const retrieved = affiliateService.getOfferById('offer_cpa_test_1')
      expect(retrieved?.title).toBe('Test CPA Campaign Pro')
    })

    it('allows admin to activate, suspend, or disable affiliate accounts', () => {
      const { affiliateId } = affiliateService.getOrCreateAffiliateId('usr_test_status_change')
      
      const suspended = affiliateService.updateAffiliateStatus(affiliateId, 'suspended', 'admin_1')
      expect(suspended).toBe(true)

      const db = getDatabase()
      const userRow = db.prepare('SELECT affiliate_status FROM users WHERE id = ?').get('usr_test_status_change') as any
      expect(userRow?.affiliate_status).toBe('suspended')
    })
  })

  describe('2. CPA Tracking Link & Click Logging', () => {
    it('generates a valid CPA tracking link preserving affiliate and offer IDs', () => {
      const { trackingUrl } = affiliateService.generateTrackingLink('usr_aff_link_test', 'offer_main_saas', {
        sub_id1: 'adwords_camp_1'
      })

      expect(trackingUrl).toContain('/track?')
      expect(trackingUrl).toContain('aff_id=AFF-')
      expect(trackingUrl).toContain('offer_id=offer_main_saas')
      expect(trackingUrl).toContain('sub_id1=adwords_camp_1')
    })

    it('records incoming clicks with immutable Click ID and redirects properly', () => {
      const clickId = 'clk_unique_test_' + Date.now()
      const { affiliateId } = affiliateService.getOrCreateAffiliateId('usr_click_test_stream')
      
      const clickRes = affiliateService.recordClick({
        affiliateId,
        offerId: 'offer_main_saas',
        clickId,
        ipAddress: '198.51.100.25',
        userAgent: 'Mozilla/5.0 Chrome/128.0',
        referrer: 'https://google.com',
        subId1: 'promo_spring'
      })

      expect(clickRes.clickId).toBe(clickId)
      expect(clickRes.redirectUrl).toContain('click_id=' + clickId)
      expect(clickRes.redirectUrl).toContain('aff_id=' + affiliateId)

      // Verify DB persistence
      const db = getDatabase()
      const savedClick = db.prepare('SELECT * FROM affiliate_clicks WHERE click_id = ?').get(clickId) as any
      expect(savedClick).toBeDefined()
      expect(savedClick.ip_address).toBe('198.51.100.25')
      expect(Boolean(savedClick.converted)).toBe(false)
    })
  })

  describe('3. CPA Conversions & Idempotent Commission Calculation', () => {
    it('records conversion, attributes payout, and updates balances', async () => {
      const clickId = 'clk_conv_test_' + Date.now()
      const { affiliateId } = affiliateService.getOrCreateAffiliateId('usr_conv_test_stream')

      // Record Click first
      affiliateService.recordClick({
        affiliateId,
        offerId: 'offer_main_saas',
        clickId
      })

      // Record Conversion on $100 order (50% rate = $50)
      const convResult = await affiliateService.recordCpaConversion({
        clickId,
        orderAmount: 100.0,
        currency: 'USD',
        idempotencyKey: 'idem_tx_test_' + Date.now(),
        userId: 'usr_paying_customer'
      })

      expect(convResult.success).toBe(true)
      expect(convResult.conversion?.click_id).toBe(clickId)
      expect(convResult.conversion?.payout_amount).toBe(50.0)

      // Verify Click marked as converted
      const db = getDatabase()
      const clickRow = db.prepare('SELECT converted, conversion_id FROM affiliate_clicks WHERE click_id = ?').get(clickId) as any
      expect(Boolean(clickRow?.converted)).toBe(true)
      expect(clickRow?.conversion_id).toBe(convResult.conversion?.conversion_id)
    })

    it('guarantees idempotency and prevents duplicate conversions on same Click ID', async () => {
      const clickId = 'clk_dup_prevent_test_' + Date.now()
      const { affiliateId } = affiliateService.getOrCreateAffiliateId('usr_idem_test_stream')

      affiliateService.recordClick({
        affiliateId,
        offerId: 'offer_main_saas',
        clickId
      })

      const firstConv = await affiliateService.recordCpaConversion({
        clickId,
        orderAmount: 50.0
      })
      expect(firstConv.success).toBe(true)

      // Duplicate attempt on same click
      const duplicateConv = await affiliateService.recordCpaConversion({
        clickId,
        orderAmount: 50.0
      })
      expect(duplicateConv.success).toBe(true)
      expect(duplicateConv.conversion?.conversion_id).toBe(firstConv.conversion?.conversion_id)

      // Verify only 1 conversion was recorded in DB
      const db = getDatabase()
      const totalConv = db.prepare('SELECT COUNT(*) as count FROM affiliate_conversions WHERE click_id = ?').get(clickId) as any
      expect(totalConv.count).toBe(1)
    })
  })

  describe('4. Postback URL Macro Engine & Server-to-Server Dispatch', () => {
    it('saves postback URL and renders dynamic macros accurately', async () => {
      const userId = 'usr_pb_test_macro_' + Date.now()
      const clickId = 'clk_pb_macro_test_' + Date.now()
      const { affiliateId } = affiliateService.getOrCreateAffiliateId(userId)

      affiliateService.savePostbackConfig(
        userId,
        'https://network.example.com/postback?click_id={CLICK_ID}&aff_id={AFFILIATE_ID}&payout={PAYOUT}&status={STATUS}',
        'GET'
      )

      const savedCfg = affiliateService.getPostbackConfig(userId)
      expect(savedCfg?.postback_url).toContain('{CLICK_ID}')
      expect(savedCfg?.http_method).toBe('GET')

      // Record Click & Conversion
      affiliateService.recordClick({
        affiliateId,
        offerId: 'offer_main_saas',
        clickId
      })

      const conv = await affiliateService.recordCpaConversion({
        clickId,
        orderAmount: 80.0
      })

      expect(conv.success).toBe(true)

      const pbResult = await affiliateService.firePostback(conv.conversion?.conversion_id!)
      expect(pbResult).toBeDefined()
      expect(pbResult?.url).toContain('click_id=' + clickId)
      expect(pbResult?.url).toContain('aff_id=' + affiliateId)
      expect(pbResult?.url).toContain('status=approved')
    })
  })

  describe('5. Multi-Status Withdrawal Engine & Payment Protection', () => {
    it('handles withdrawal lifecycle and prevents duplicate settlements', () => {
      const userId = 'usr_with_lifecycle_' + Date.now()
      affiliateService.getOrCreateAffiliateId(userId)

      // Add balance via admin adjustment ($100)
      affiliateService.adminAdjustBalance(userId, 100.0, 'Initial test balance')

      const summaryBefore = affiliateService.getUserAffiliateSummary(userId)
      expect(summaryBefore.availableBalance).toBe(100.0)

      // 1. Submit Withdrawal Request ($50)
      const withdrawal = affiliateService.requestWithdrawal(userId, 50.0, 'crypto', {
        address: 'TRX_WALLET_123',
        network: 'USDT (TRC-20)'
      })
      expect(withdrawal.status).toBe('pending')
      expect(withdrawal.amount).toBe(50.0)

      // Available balance reflects pending hold
      const summaryPending = affiliateService.getUserAffiliateSummary(userId)
      expect(summaryPending.availableBalance).toBe(50.0)

      // 2. Admin Approves
      const approved = affiliateService.adminUpdateWithdrawal(withdrawal.id, 'approved', 'Verified KYC', undefined, 'admin_super')
      expect(approved.status).toBe('approved')

      // 3. Admin Marks as Processing
      const processing = affiliateService.adminUpdateWithdrawal(withdrawal.id, 'processing', 'Initiating chain payout', undefined, 'admin_super')
      expect(processing.status).toBe('processing')

      // 4. Admin Marks as Paid with TX Reference
      const paid = affiliateService.adminUpdateWithdrawal(withdrawal.id, 'paid', 'Payout confirmed', '0xTX_HASH_998877', 'admin_super')
      expect(paid.status).toBe('paid')
      expect(paid.payout_reference).toBe('0xTX_HASH_998877')

      // 5. Prevent double settlement
      expect(() => {
        affiliateService.adminUpdateWithdrawal(withdrawal.id, 'paid', 'Second payment attempt', '0xDUP', 'admin_super')
      }).toThrow('This withdrawal has already been settled and marked as Paid.')

      // Check Audit Log
      const db = getDatabase()
      const auditRows = db.prepare('SELECT * FROM affiliate_audit_logs WHERE target_id = ?').all(withdrawal.id) as any[]
      expect(auditRows.length).toBeGreaterThanOrEqual(3)
    })
  })
})
