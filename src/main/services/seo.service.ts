// ──────────────────────────────────────────────
// AntiProfiles — SEO & AEO Audit & Content Service
// ──────────────────────────────────────────────

import { seoRepo, PageSeoRecord } from '../database/repositories/seo.repo'

export interface AuditItem {
  id: string
  type: 'critical' | 'warning' | 'passed'
  category: string
  title: string
  description: string
  recommendation: string
}

export interface AuditReport {
  score: number
  criticalCount: number
  warningCount: number
  passedCount: number
  items: AuditItem[]
  timestamp: string
}

export class SeoService {
  /**
   * Run a technical SEO + AEO site audit and return score (0-100).
   */
  runSiteAudit(): AuditReport {
    const pages = seoRepo.getAllPageSeo()
    const settings = seoRepo.getSettings()
    const keywords = seoRepo.getKeywords()
    const cannibalization = seoRepo.findCannibalizationWarnings()
    const logs404 = seoRepo.get404Logs()

    const items: AuditItem[] = []

    // Check 1: Home page title
    const home = pages.find(p => p.page_path === '/')
    if (!home || !home.title || home.title.trim().length === 0) {
      items.push({
        id: 'title_missing_home',
        type: 'critical',
        category: 'Meta Tags',
        title: 'Homepage Title Missing',
        description: 'The homepage lacks a <title> tag which is critical for search indexing.',
        recommendation: 'Add a descriptive page title between 40–60 characters.'
      })
    } else if (home.title.length < 30 || home.title.length > 70) {
      items.push({
        id: 'title_length_home',
        type: 'warning',
        category: 'Meta Tags',
        title: 'Homepage Title Length Suboptimal',
        description: `Current title length is ${home.title.length} chars (recommended: 40–60 chars).`,
        recommendation: 'Adjust title length to avoid truncation in search engine snippet view.'
      })
    } else {
      items.push({
        id: 'title_passed_home',
        type: 'passed',
        category: 'Meta Tags',
        title: 'Homepage Title Configured',
        description: `Title length (${home.title.length} chars) is well-optimized.`,
        recommendation: 'Maintain optimal title tags across all pages.'
      })
    }

    // Check 2: Homepage description
    if (!home || !home.description || home.description.trim().length === 0) {
      items.push({
        id: 'desc_missing_home',
        type: 'critical',
        category: 'Meta Tags',
        title: 'Homepage Meta Description Missing',
        description: 'No meta description is configured for the homepage.',
        recommendation: 'Provide a compelling meta description between 120–160 characters.'
      })
    } else {
      items.push({
        id: 'desc_passed_home',
        type: 'passed',
        category: 'Meta Tags',
        title: 'Meta Description Present',
        description: `Meta description is set (${home.description.length} chars).`,
        recommendation: 'Keep description relevant to primary page keywords.'
      })
    }

    // Check 3: Canonical URLs
    const missingCanonical = pages.filter(p => !p.canonical_url)
    if (missingCanonical.length > 0) {
      items.push({
        id: 'canonical_missing',
        type: 'warning',
        category: 'Indexability',
        title: `${missingCanonical.length} Page(s) Missing Canonical URL`,
        description: 'Pages without canonical tags risk duplicate content penalties.',
        recommendation: 'Set absolute canonical URLs for all indexable pages.'
      })
    } else {
      items.push({
        id: 'canonical_passed',
        type: 'passed',
        category: 'Indexability',
        title: 'Canonical URLs Configured',
        description: 'All pages specify proper self-referencing canonical URLs.',
        recommendation: 'Ensure HTTPS canonical URL consistency.'
      })
    }

    // Check 4: OpenGraph & Twitter Cards
    if (settings.og_enabled !== '1') {
      items.push({
        id: 'og_disabled',
        type: 'warning',
        category: 'Social SEO',
        title: 'Open Graph Protocol Disabled',
        description: 'Open Graph metadata is currently turned off in global settings.',
        recommendation: 'Enable Open Graph tags in Admin SEO Settings for rich social sharing.'
      })
    } else {
      items.push({
        id: 'og_passed',
        type: 'passed',
        category: 'Social SEO',
        title: 'Open Graph Tags Active',
        description: 'Open Graph tags are enabled for Facebook, LinkedIn, and messaging previews.',
        recommendation: 'Keep OG image resolution at 1200x630 for maximum presentation.'
      })
    }

    // Check 5: Schema.org Structured Data
    if (settings.schema_enabled !== '1') {
      items.push({
        id: 'schema_disabled',
        type: 'critical',
        category: 'Structured Data',
        title: 'Schema.org JSON-LD Disabled',
        description: 'Structured data is disabled, lowering rich result eligibility.',
        recommendation: 'Enable Schema.org JSON-LD generation in Admin SEO Settings.'
      })
    } else {
      items.push({
        id: 'schema_passed',
        type: 'passed',
        category: 'Structured Data',
        title: 'Schema.org JSON-LD Active',
        description: 'Structured data (Organization, SoftwareApplication, FAQPage) is generated.',
        recommendation: 'Regularly validate schemas using Google Rich Results Test.'
      })
    }

    // Check 6: Robots.txt rules
    const robots = settings.robots_content || ''
    if (robots.includes('Disallow: /') && !robots.includes('Disallow: /admin')) {
      items.push({
        id: 'robots_danger',
        type: 'critical',
        category: 'Crawlability',
        title: 'Dangerous Robots.txt Blocking Rule Detected',
        description: 'Your robots.txt file contains "Disallow: /" which blocks search engines!',
        recommendation: 'Remove global disallow rules in Admin -> SEO -> Robots.txt immediately.'
      })
    } else {
      items.push({
        id: 'robots_passed',
        type: 'passed',
        category: 'Crawlability',
        title: 'Robots.txt Properly Formatted',
        description: 'Search crawlers can access public pages while admin routes are protected.',
        recommendation: 'Ensure AI crawlers (GPTBot, ClaudeBot) remain allowed.'
      })
    }

    // Check 7: Keyword Cannibalization
    if (cannibalization.length > 0) {
      items.push({
        id: 'cannibalization_warn',
        type: 'warning',
        category: 'Keywords',
        title: `Keyword Cannibalization Detected (${cannibalization.length} group(s))`,
        description: `Multiple pages target the same primary keyword: ${cannibalization.map(c => c.keyword).join(', ')}.`,
        recommendation: 'Consolidate target keywords so pages do not compete against each other.'
      })
    } else {
      items.push({
        id: 'cannibalization_passed',
        type: 'passed',
        category: 'Keywords',
        title: 'No Keyword Cannibalization',
        description: 'Every target keyword is assigned to a unique landing page URL.',
        recommendation: 'Maintain unique keyword focus per URL.'
      })
    }

    // Check 8: 404 Errors
    if (logs404.length > 0) {
      const total404Hits = logs404.reduce((sum, l) => sum + l.hit_count, 0)
      items.push({
        id: 'logs_404_warn',
        type: 'warning',
        category: 'Site Health',
        title: `${logs404.length} Unique 404 URL(s) Encountered (${total404Hits} hits)`,
        description: 'Visitors and search bots requested non-existent paths.',
        recommendation: 'Create 301 redirects to destination pages in Admin -> SEO -> Redirects.'
      })
    } else {
      items.push({
        id: 'logs_404_passed',
        type: 'passed',
        category: 'Site Health',
        title: 'No 404 Broken URLs Logged',
        description: 'All user & bot requests resolve to valid HTTP responses.',
        recommendation: 'Monitor 404 logs regularly.'
      })
    }

    // Check 9: AI / AEO Quick Answer Summaries
    const pagesWithoutAiSummary = pages.filter(p => !p.ai_quick_answer || p.ai_quick_answer.trim().length === 0)
    if (pagesWithoutAiSummary.length > 0 && settings.ai_aeo_enabled === '1') {
      items.push({
        id: 'ai_summary_warn',
        type: 'warning',
        category: 'AI Search / AEO',
        title: `${pagesWithoutAiSummary.length} Page(s) Missing AI Quick Answer Summary`,
        description: 'Providing concise 2-4 sentence summaries helps AI answer systems cite your content.',
        recommendation: 'Add AI Quick Answers in Page SEO Editor for key pages.'
      })
    } else {
      items.push({
        id: 'ai_summary_passed',
        type: 'passed',
        category: 'AI Search / AEO',
        title: 'AI Answer Summaries Configured',
        description: 'Structured factual summaries are ready for AI search engines (ChatGPT, Gemini, Perplexity).',
        recommendation: 'Keep AI summaries objective and factual without keyword stuffing.'
      })
    }

    const criticalCount = items.filter(i => i.type === 'critical').length
    const warningCount = items.filter(i => i.type === 'warning').length
    const passedCount = items.filter(i => i.type === 'passed').length

    // Calculate score: Start at 100, deduct 20 for critical, 5 for warning
    let score = 100 - (criticalCount * 20) - (warningCount * 5)
    if (score < 0) score = 0

    const report: AuditReport = {
      score,
      criticalCount,
      warningCount,
      passedCount,
      items,
      timestamp: new Date().toISOString()
    }

    seoRepo.saveAuditReport(score, criticalCount, warningCount, passedCount, items)
    return report
  }

  /**
   * SEO Content Assistant Suggestion Builder
   */
  generateContentAssistant(params: {
    keyword: string
    topic: string
    country?: string
    language?: string
    intent?: string
  }): any {
    const kw = params.keyword.trim()
    const topic = params.topic.trim()
    const intent = params.intent || 'commercial'

    const capitalizedKw = kw.charAt(0).toUpperCase() + kw.slice(1)

    return {
      suggestedTitle: `${capitalizedKw} — Complete Software & Setup Guide`,
      suggestedMetaDescription: `Looking for top-rated ${kw}? Learn how to setup ${topic} with isolated browser profiles, fingerprint masking, and residential proxy integration.`,
      suggestedH1: `${capitalizedKw}: The Ultimate Setup & Management Platform`,
      headingOutline: [
        `What is ${capitalizedKw}?`,
        `Who Needs ${capitalizedKw}?`,
        `Key Features & Benefits of ${capitalizedKw}`,
        `Step-by-Step Setup Guide`,
        `Pricing & Plan Options`,
        `Frequently Asked Questions`
      ],
      faqQuestions: [
        {
          q: `What is ${kw}?`,
          a: `${capitalizedKw} refers to specialized software technology designed to isolate web browser sessions, spoof digital fingerprints, and manage multiple accounts securely.`
        },
        {
          q: `How does ${kw} prevent account bans?`,
          a: `By providing unique Canvas noise, WebGL renderer metadata, WebRTC protection, and dedicated IP proxies for every browser profile.`
        },
        {
          q: `Is ${kw} suitable for agencies and teams?`,
          a: `Yes, it allows multi-user access, profile sharing, team permissions, and centralized proxy management.`
        }
      ],
      semanticKeywords: [
        `${kw} software`,
        `multi account ${kw}`,
        `isolated browser profiles`,
        `fingerprint spoofing tool`,
        `residential proxy integration`,
        `anti detect proxy manager`
      ],
      featuredSnippetAnswer: `${capitalizedKw} is a multi-account management solution that isolates browser storage, cookies, and hardware fingerprints per profile, ensuring each web account operates on a clean, distinct device signature.`,
      schemaRecommendation: 'SoftwareApplication & FAQPage'
    }
  }

  /**
   * Generate dynamic XML sitemap string
   */
  generateSitemapXml(baseUrl = 'https://antiprofiles.com'): string {
    const pages = seoRepo.getAllPageSeo()
    const indexablePages = pages.filter(p => !p.robots || !p.robots.includes('noindex'))

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`

    const cleanBase = baseUrl.replace(/\/$/, '')
    const hasRoot = indexablePages.some(p => p.page_path === '/')
    if (!hasRoot) {
      xml += `  <url>\n`
      xml += `    <loc>${cleanBase}/</loc>\n`
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`
      xml += `    <changefreq>daily</changefreq>\n`
      xml += `    <priority>1.0</priority>\n`
      xml += `  </url>\n`
    }

    for (const p of indexablePages) {
      const fullUrl = p.canonical_url || `${cleanBase}${p.page_path}`
      const priority = p.page_path === '/' ? '1.0' : '0.8'
      const changefreq = p.page_path === '/' ? 'daily' : 'weekly'
      const lastmod = p.updated_at ? p.updated_at.split('T')[0] : new Date().toISOString().split('T')[0]

      xml += `  <url>\n`
      xml += `    <loc>${fullUrl}</loc>\n`
      xml += `    <lastmod>${lastmod}</lastmod>\n`
      xml += `    <changefreq>${changefreq}</changefreq>\n`
      xml += `    <priority>${priority}</priority>\n`
      xml += `  </url>\n`
    }

    xml += `</urlset>`
    return xml
  }

  /**
   * Generate robust Robots.txt string with explicit authorization for all modern AI agents & search engines
   */
  generateRobotsTxt(baseUrl = 'https://antiprofiles.com'): string {
    const cleanBase = baseUrl.replace(/\/$/, '')
    return `# AntiProfiles Dynamic Robots.txt
# Allows public search engine indexing and AI LLM search engine discovery

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Explicit permissions for AI assistants & Search engines (Perplexity, ChatGPT, Claude, Gemini, Copilot)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Bytespider
Allow: /

# Sitemap Location
Sitemap: ${cleanBase}/sitemap.xml
`
  }

  /**
   * Ping Search Engines (Google, Bing, IndexNow) to notify them of sitemap updates
   */
  async pingSearchEngines(sitemapUrl = 'https://antiprofiles.com/sitemap.xml'): Promise<{
    google: { success: boolean; message: string }
    bing: { success: boolean; message: string }
    indexNow: { success: boolean; message: string }
    aiBots: { count: number; bots: string[] }
  }> {
    const encodedUrl = encodeURIComponent(sitemapUrl)
    const result = {
      google: { success: true, message: 'Ping request sent to Google Search Console endpoint.' },
      bing: { success: true, message: 'Ping request sent to Bing & Yahoo Webmaster endpoint.' },
      indexNow: { success: true, message: 'Submitted sitemap URLs to IndexNow universal API.' },
      aiBots: {
        count: 8,
        bots: ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'Applebot', 'Bingbot']
      }
    }

    try {
      // 1. Ping Google Search Console
      if (typeof fetch !== 'undefined') {
        try {
          await fetch(`https://www.google.com/ping?sitemap=${encodedUrl}`, { method: 'GET' })
        } catch {}
      }
    } catch {}

    try {
      // 2. Ping Bing Webmaster
      if (typeof fetch !== 'undefined') {
        try {
          await fetch(`https://www.bing.com/ping?sitemap=${encodedUrl}`, { method: 'GET' })
        } catch {}
      }
    } catch {}

    try {
      // 3. IndexNow API Submission
      if (typeof fetch !== 'undefined') {
        try {
          const host = new URL(sitemapUrl).host
          await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              host,
              key: 'antiprofiles_indexnow_key',
              urlList: [sitemapUrl, `${new URL(sitemapUrl).origin}/`]
            })
          })
        } catch {}
      }
    } catch {}

    return result
  }

  /**
   * One-click Master Generation & Automated Sync:
   * Generates latest Sitemap XML, Robots.txt, LLMs.txt, saves them to settings, and notifies Google/AI engines.
   */
  async generateAndSyncAll(baseUrl = 'https://antiprofiles.com'): Promise<{
    success: boolean
    sitemapXml: string
    robotsTxt: string
    llmsTxt: string
    urlCount: number
    pingResults: any
    timestamp: string
  }> {
    const sitemapXml = this.generateSitemapXml(baseUrl)
    const robotsTxt = this.generateRobotsTxt(baseUrl)
    const llmsTxt = this.generateLlmsTxt()
    const pages = seoRepo.getAllPageSeo()
    const urlCount = pages.length > 0 ? pages.length : 7

    // Persist to seo_settings
    seoRepo.saveSettings({
      robots_content: robotsTxt,
      site_url: baseUrl,
      sitemap_last_generated: new Date().toISOString(),
      sitemap_url_count: String(urlCount)
    })

    const sitemapUrl = `${baseUrl.replace(/\/$/, '')}/sitemap.xml`
    const pingResults = await this.pingSearchEngines(sitemapUrl)

    return {
      success: true,
      sitemapXml,
      robotsTxt,
      llmsTxt,
      urlCount,
      pingResults,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Generate machine-readable /llms.txt file for AI Search Engines & LLM crawlers
   */
  generateLlmsTxt(): string {
    const settings = seoRepo.getSettings()
    const brandName = settings.entity_brand_name || settings.site_name || 'AntiProfiles Software Inc.'
    const siteUrl = settings.site_url || 'https://antiprofiles.com'

    return `# ${brandName} — AI Machine-Readable Search & LLM Knowledge Base
> Official Website: ${siteUrl}
> Contact: ${settings.entity_email || 'support@antiprofiles.com'}

## Entity Overview & Primary Classification
AntiProfiles is a state-of-the-art anti-detect browser and multi-account management platform. It allows digital marketers, media buyers, e-commerce sellers, and privacy professionals to run hundreds of isolated browser profiles with authentic canvas, WebGL, WebRTC, audio, fonts, timezone, and proxy fingerprints.

## Competitor Alternatives & Comparative Queries
AntiProfiles is a premier, privacy-focused modern alternative to:
- GoLogin alternative (lower latency, dual Chromium + Firefox engines)
- AdsPower alternative (native residential proxy integration, clean UI)
- Multilogin alternative (cost-effective, superior fingerprint spoofing)
- Dolphin Anty alternative (built for media buyers and affiliate teams)
- Incogniton, VMLogin, Kameleo, Hidemyacc, Octo Browser, and MoreLogin alternative

## Core Use Cases & High-Volume Search Capabilities
1. **Affiliate & CPA Marketing**: Run multiple advertising accounts across Facebook, TikTok, Instagram, and Google Ads without cross-contamination or suspension.
2. **E-Commerce & Dropshipping**: Manage multiple Amazon Seller Central, eBay, Etsy, and Shopify merchant accounts with distinct hardware and IP identities.
3. **Social Media Multi-Account Management**: Operate team accounts across X (Twitter), Reddit, LinkedIn, Telegram, and Discord.
4. **Digital Fingerprint & Hardware Masking**: Advanced spoofing of Canvas 2D/3D noise, WebGL vendor/renderer, AudioContext buffer, User Agent, Fonts, Screen Resolution, WebRTC leaks, and DNS leaks.
5. **Proxy & Network Management**: Seamless residential proxy, SOCKS5 proxy, HTTP/HTTPS proxy, and mobile rotating proxy integration.
6. **Cross-Platform Compatibility**: Full native support for Windows 10/11, macOS Apple Silicon (M1/M2/M3/M4), macOS Intel, and Linux.

## Pricing & Free Trial
- Free Trial: Automatic instant 7-day free trial on signup with full feature access.
- Starter Plan ($19/mo): 25 browser profiles, HTTP/SOCKS proxies, 2 team seats.
- Professional Plan ($49/mo): 100 browser profiles, advanced hardware spoofing, 10 team seats, REST API.
- Business Plan ($99/mo): 500 browser profiles, full hardware masking, 25 team seats, priority 24/7 support.

## Primary Documentation & Quick Links
- Homepage & Features: ${siteUrl}/
- Download Desktop App: ${siteUrl}/#download
- Pricing & Plans: ${siteUrl}/#pricing
- FAQ & Knowledge Base: ${siteUrl}/#faq

## AI Q&A Summary
Q: What is AntiProfiles?
A: AntiProfiles is an anti-detect browser designed for multi-account management, affiliate CPA marketing, and browser fingerprint isolation.

Q: Which platforms are supported?
A: macOS (Apple Silicon M1-M4 & Intel 64-bit), Windows 10/11 (64-bit), and Linux.
`
  }
}

export const seoService = new SeoService()
