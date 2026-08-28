// ──────────────────────────────────────────────
// ProfileVault — Unit Tests: Google SEO & AI Search Optimization (AEO/GEO)
// ──────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest'
import { initDatabase } from '../../src/main/database/connection'
import { seoRepo } from '../../src/main/database/repositories/seo.repo'
import { seoService } from '../../src/main/services/seo.service'

describe('Google SEO + AI Search Optimization (AEO/GEO) Engine', () => {
  beforeAll(() => {
    initDatabase()
  })

  it('1. Global SEO Settings: Load defaults & save updates', () => {
    seoRepo.saveSettings({ site_name: 'ProfileVault', seo_enabled: '1', schema_enabled: '1' })
    const settings = seoRepo.getSettings()
    expect(settings.seo_enabled).toBe('1')
    expect(settings.site_name).toBe('ProfileVault')
    expect(settings.schema_enabled).toBe('1')

    seoRepo.saveSettings({ site_name: 'ProfileVault Pro', default_og_image: 'https://example.com/og.png' })
    const updated = seoRepo.getSettings()
    expect(updated.site_name).toBe('ProfileVault Pro')
    expect(updated.default_og_image).toBe('https://example.com/og.png')
  })

  it('2. Page SEO Metadata: CRUD operations & canonical URL persistence', () => {
    const page = seoRepo.savePageSeo({
      page_path: '/pricing',
      page_type: 'webpage',
      title: 'ProfileVault Pricing & Plans',
      description: 'Flexible monthly plans for anti-detect browser profile management.',
      canonical_url: 'https://profilevault.local/pricing',
      primary_keyword: 'anti detect browser pricing',
      ai_quick_answer: 'ProfileVault offers plans starting from free trial up to agency and enterprise tiers.'
    })

    expect(page.page_path).toBe('/pricing')
    expect(page.title).toBe('ProfileVault Pricing & Plans')
    expect(page.primary_keyword).toBe('anti detect browser pricing')

    const fetched = seoRepo.getPageSeoByPath('/pricing')
    expect(fetched?.canonical_url).toBe('https://profilevault.local/pricing')
  })

  it('3. Keyword Management & Cannibalization Warning Detection', () => {
    seoRepo.saveKeyword({
      id: 'kw_cannibal_1',
      keyword: 'anti detect browser',
      target_url: '/',
      keyword_type: 'primary'
    })

    seoRepo.saveKeyword({
      id: 'kw_cannibal_2',
      keyword: 'anti detect browser',
      target_url: '/features',
      keyword_type: 'primary'
    })

    const warnings = seoRepo.findCannibalizationWarnings()
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some(w => w.keyword === 'anti detect browser')).toBe(true)
  })

  it('4. Site Audit Engine: Calculates audit score (0-100) & itemizes recommendations', () => {
    const report = seoService.runSiteAudit()
    expect(typeof report.score).toBe('number')
    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(report.items)).toBe(true)
    expect(report.items.length).toBeGreaterThan(0)
  })

  it('5. Sitemap XML Generator: Produces valid XML with indexable canonical URLs', () => {
    const xml = seoService.generateSitemapXml('https://profilevault.local')
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset')
    expect(xml).toMatch(/<loc>https:\/\/(profilevault\.local|antiprofiles\.com)\/?/i)
    expect(xml).toContain('</urlset>')
  })

  it('6. Machine-Readable AI / AEO Generator: Produces valid /llms.txt', () => {
    const llms = seoService.generateLlmsTxt()
    expect(llms).toMatch(/# (ProfileVault|AntiProfiles)/i)
    expect(llms).toContain('## Entity Overview')
    expect(llms).toContain('## Core Use Cases')
    expect(llms).toMatch(/Q: What is (ProfileVault|AntiProfiles)/i)
  })

  it('7. SEO Content Assistant: Generates structured heading outlines and FAQs', () => {
    const ca = seoService.generateContentAssistant({
      keyword: 'multi account browser',
      topic: 'Agency profile management',
      intent: 'commercial'
    })

    expect(ca.suggestedTitle).toContain('Multi account browser')
    expect(ca.headingOutline.length).toBeGreaterThan(3)
    expect(ca.faqQuestions.length).toBeGreaterThan(1)
    expect(ca.featuredSnippetAnswer).toBeDefined()
  })

  it('8. Robots.txt Generator: Provisions search engine and AI crawler allowlists', () => {
    const robots = seoService.generateRobotsTxt('https://antiprofiles.com')
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('User-agent: GPTBot')
    expect(robots).toContain('User-agent: ClaudeBot')
    expect(robots).toContain('User-agent: PerplexityBot')
    expect(robots).toContain('User-agent: Google-Extended')
    expect(robots).toContain('User-agent: Applebot')
    expect(robots).toContain('User-agent: Bingbot')
    expect(robots).toContain('Sitemap: https://antiprofiles.com/sitemap.xml')
  })

  it('9. Master One-Click Sync & Search Engine Notification Engine', async () => {
    const syncRes = await seoService.generateAndSyncAll('https://antiprofiles.com')
    expect(syncRes.success).toBe(true)
    expect(syncRes.sitemapXml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(syncRes.robotsTxt).toContain('User-agent: GPTBot')
    expect(syncRes.llmsTxt).toContain('## Entity Overview')
    expect(syncRes.pingResults.google.success).toBe(true)
    expect(syncRes.pingResults.bing.success).toBe(true)
    expect(syncRes.pingResults.aiBots.count).toBeGreaterThanOrEqual(8)
  })
})
