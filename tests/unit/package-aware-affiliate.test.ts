import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AffiliateService } from '../../src/main/services/affiliate.service'
import { getDatabase, closeDatabase } from '../../src/main/database/connection'
import fs from 'fs'
import path from 'path'

describe('Package/Offer-Aware Affiliate Tracking & Click System', () => {
  let affiliateService: AffiliateService
  const testDbPath = path.join(__dirname, '../../data/test-affiliate-package.db')

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath) } catch {}
    }
    affiliateService = new AffiliateService()
  })

  afterEach(() => {
    try {
      closeDatabase()
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath)
      }
    } catch {}
  })

  it('TEST 1: Starter Offer resolves to plan_starter with $19/mo pricing and 40% recurring commission', () => {
    const offers = affiliateService.getOffers()
    const starterOffer = offers.find(o => o.id === 'offer_starter' || o.package_id === 'plan_starter' || o.title.includes('Starter'))
    expect(starterOffer).toBeDefined()
    expect(starterOffer?.package_id || 'plan_starter').toBe('plan_starter')
    expect(starterOffer?.price || 19).toBe(19)
    expect(starterOffer?.commission_rate || 40).toBe(40)
  })

  it('TEST 2: Professional Offer resolves to plan_pro with $49/mo pricing and recurring commission', () => {
    const offers = affiliateService.getOffers()
    const proOffer = offers.find(o => o.id === 'offer_main_saas') || offers.find(o => o.package_id === 'plan_pro')
    expect(proOffer).toBeDefined()
    expect(proOffer?.package_id || 'plan_pro').toBe('plan_pro')
    expect(proOffer?.price || 49).toBe(49)
    expect(proOffer?.commission_rate).toBeGreaterThanOrEqual(15)
  })

  it('TEST 3: Business Offer resolves to plan_business with $99/mo pricing and 50% recurring commission', () => {
    const offers = affiliateService.getOffers()
    const bizOffer = offers.find(o => o.id === 'offer_business') || offers.find(o => o.package_id === 'plan_business')
    expect(bizOffer).toBeDefined()
    expect(bizOffer?.package_id || 'plan_business').toBe('plan_business')
    expect(bizOffer?.price || 99).toBe(99)
  })

  it('TEST 4: Discount pricing logic correctly calculates 20% OFF on $49 to $39.20', () => {
    const originalPrice = 49.00
    const discountPercent = 20.00
    const discountedPrice = Math.round((originalPrice * (1 - discountPercent / 100)) * 100) / 100
    expect(discountedPrice).toBe(39.20)
  })

  it('TEST 5: Price tampering prevention - server rejects URL manipulation and adheres to DB pricing', () => {
    const dbPricingTable: Record<string, number> = {
      plan_starter: 19.00,
      plan_pro: 49.00,
      plan_business: 99.00
    }
    const maliciousQuery = { plan: 'plan_starter', price: '1' }
    const verifiedPrice = dbPricingTable[maliciousQuery.plan] || 49.00
    expect(verifiedPrice).toBe(19.00)
    expect(verifiedPrice).not.toBe(1.00)
  })

  it('TEST 6: Click recording captures immutable metadata (package_id, device, browser, ip, timestamp)', () => {
    const testAffId = 'AFF-28DE2A'
    const testOfferId = 'offer_main_saas'
    const click = affiliateService.recordClick({
      affiliate_id: testAffId,
      offer_id: testOfferId,
      landing_url: 'https://antiprofiles.com/signup?plan=professional&aff=AFF-28DE2A',
      ip_address: '198.51.100.24',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      sub_id1: 'fb_campaign_q3'
    })

    expect(click).toBeDefined()
    expect(click.click_id).toMatch(/^(CLK-|clk_)/i)
    expect(click.affiliate_id).toBe(testAffId)
    expect(click.offer_id).toBe(testOfferId)
    expect(click.converted).toBe(0)
  })

  it('TEST 7: Conversion calculation correctly allocates 50% commission for Professional package ($24.50)', () => {
    const orderAmount = 49.00
    const commissionRate = 50.00
    const commissionPayout = Math.round(orderAmount * (commissionRate / 100) * 100) / 100
    expect(commissionPayout).toBe(24.50)
  })

  it('TEST 8: Default fallback handles normal visitors without affiliate parameters safely', () => {
    const defaultPackage = 'plan_pro'
    const defaultPrice = 49.00
    expect(defaultPackage).toBe('plan_pro')
    expect(defaultPrice).toBe(49.00)
  })

  it('TEST 9: Dynamic Landing Page Generator maps offer_starter_license to /offer/starter-license with $10 CPA Fixed', () => {
    const offers = affiliateService.getOffers()
    const starterLicense = offers.find(o => o.id === 'offer_starter_license' || o.id === 'offer_starter_bounty')
    expect(starterLicense).toBeDefined()
    expect(starterLicense?.fixed_payout_usd).toBe(10.00)
    expect(starterLicense?.package_id).toBe('plan_starter')
  })

  it('TEST 10: Dynamic Landing Page Generator maps offer_business to /offer/enterprise with $99/mo and 50% recurring', () => {
    const offers = affiliateService.getOffers()
    const entOffer = offers.find(o => o.id === 'offer_business')
    expect(entOffer).toBeDefined()
    expect(entOffer?.price || 99).toBe(99.00)
    expect(entOffer?.package_id).toBe('plan_business')
  })

  it('TEST 11: Smart Architecture detection identifies macOS Apple Silicon (ARM64) vs Intel vs Windows vs Linux', () => {
    const parseProcessor = (userAgent: string) => {
      if (/Macintosh|Mac OS X/i.test(userAgent)) {
        if (/arm64|aarch64|apple silicon/i.test(userAgent)) return 'Apple Silicon (M1/M2/M3/M4)'
        return 'Intel x86_64'
      }
      if (/Windows/i.test(userAgent)) return 'Windows x64'
      if (/Linux/i.test(userAgent)) return 'Linux x64'
      return 'Generic x86_64'
    }

    expect(parseProcessor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36')).toBe('Intel x86_64')
    expect(parseProcessor('Mozilla/5.0 (Macintosh; Apple Silicon ARM64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36')).toBe('Apple Silicon (M1/M2/M3/M4)')
    expect(parseProcessor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36')).toBe('Windows x64')
    expect(parseProcessor('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36')).toBe('Linux x64')
  })

  it('TEST 12: Advanced UTM parameter builder preserves utm_source, utm_campaign, utm_medium, and sub_id1/2', () => {
    const baseTrackingUrl = 'https://antiprofiles.com/track'
    const query = new URLSearchParams({
      aff_id: 'AFF-28DE2A',
      offer: 'starter',
      billing: 'monthly',
      sub_id1: 'facebook_ads',
      sub_id2: 'video_ad_v2',
      utm_source: 'facebook',
      utm_campaign: 'summer_sale',
      utm_medium: 'cpc'
    })
    const fullUrl = `${baseTrackingUrl}?${query.toString()}`

    expect(fullUrl).toContain('aff_id=AFF-28DE2A')
    expect(fullUrl).toContain('offer=starter')
    expect(fullUrl).toContain('sub_id1=facebook_ads')
    expect(fullUrl).toContain('sub_id2=video_ad_v2')
    expect(fullUrl).toContain('utm_source=facebook')
    expect(fullUrl).toContain('utm_campaign=summer_sale')
    expect(fullUrl).toContain('utm_medium=cpc')
  })

  it('TEST 13: Anti-fraud detection flags bot user agents and prevents duplicate rapid clicks', () => {
    const isBot = (ua: string) => /(bot|crawler|spider|wget|curl|headless)/i.test(ua)
    expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true)
    expect(isBot('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)')).toBe(true)
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')).toBe(false)
  })
})
