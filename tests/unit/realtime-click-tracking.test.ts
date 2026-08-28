import { describe, it, expect, beforeEach } from 'vitest'
import { AffiliateService } from '../../src/main/services/affiliate.service'
import { getDatabase } from '../../src/main/database/connection'

describe('Real-Time Affiliate Click Tracking & Synchronization Suite', () => {
  let affiliateService: AffiliateService
  const testUserId = 'usr_click_test_888'

  beforeEach(() => {
    affiliateService = AffiliateService.getInstance()
    const db = getDatabase()
    try {
      db.prepare('DELETE FROM affiliate_clicks WHERE affiliate_id LIKE "AFF-%"').run()
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId)
    } catch {}
  })

  it('1. Generates and persists click record with full package & system attribution', () => {
    const { affiliateId } = affiliateService.getOrCreateAffiliateId(testUserId)
    const click = affiliateService.recordClick({
      affiliateId,
      offerId: 'offer_main_saas',
      ipAddress: '198.51.100.42',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      subId1: 'google_ad_campaign'
    })

    expect(click.clickId).toBeDefined()
    expect(click.clickId.startsWith('clk_')).toBe(true)
    expect(click.redirectUrl).toContain(`click_id=${click.clickId}`)
    expect(click.redirectUrl).toContain(`aff_id=${affiliateId}`)
    expect(click.redirectUrl).toContain('sub_id1=google_ad_campaign')
  })

  it('2. Prevents duplicate insert and preserves immutable clickId when click_id is provided', () => {
    const { affiliateId } = affiliateService.getOrCreateAffiliateId(testUserId)
    const originalClickId = `clk_immut_${Date.now()}`

    const first = affiliateService.recordClick({
      affiliateId,
      offerId: 'offer_main_saas',
      clickId: originalClickId,
      ipAddress: '203.0.113.19',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })

    const second = affiliateService.recordClick({
      affiliateId,
      offerId: 'offer_main_saas',
      clickId: originalClickId,
      ipAddress: '203.0.113.19',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })

    expect(first.clickId).toBe(originalClickId)
    expect(second.clickId).toBe(originalClickId)

    const db = getDatabase()
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM affiliate_clicks WHERE click_id = ?').get(originalClickId) as any).cnt
    expect(count).toBe(1)
  })

  it('3. Simulates live test clicks and immediately updates user summary and todayClicks', () => {
    const { affiliateId } = affiliateService.getOrCreateAffiliateId(testUserId)

    const simRes = affiliateService.simulateTestClick(affiliateId, 'offer_main_saas', 'unit_test_stream')
    expect(simRes.success).toBe(true)
    expect(simRes.data.click_id).toBeDefined()

    const summary = affiliateService.getUserAffiliateSummary(testUserId)
    expect(summary.totalClicks).toBeGreaterThanOrEqual(1)
    expect(summary.todayClicks).toBeGreaterThanOrEqual(1)
    expect(summary.recentClicks.length).toBeGreaterThanOrEqual(1)
    expect(summary.recentClicks[0].click_id).toBe(simRes.data.click_id)
  })

  it('4. User summary returns accurate statistics and isolates traffic per affiliate', () => {
    const userA = affiliateService.getOrCreateAffiliateId('usr_alpha_11')
    const userB = affiliateService.getOrCreateAffiliateId('usr_beta_22')

    affiliateService.recordClick({ affiliateId: userA.affiliateId, offerId: 'offer_starter' })
    affiliateService.recordClick({ affiliateId: userA.affiliateId, offerId: 'offer_main_saas' })
    affiliateService.recordClick({ affiliateId: userB.affiliateId, offerId: 'offer_business' })

    const summaryA = affiliateService.getUserAffiliateSummary('usr_alpha_11')
    const summaryB = affiliateService.getUserAffiliateSummary('usr_beta_22')

    expect(summaryA.totalClicks).toBe(2)
    expect(summaryB.totalClicks).toBe(1)
  })
})
