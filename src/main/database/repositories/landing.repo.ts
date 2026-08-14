// ──────────────────────────────────────────────
// ProfileVault — Landing Page Repository
// ──────────────────────────────────────────────

import { getDatabase } from '../connection'

export interface LandingPublicData {
  branding: Record<string, string>
  hero: {
    headline: string
    subheadline: string
    cta_primary_text: string
    cta_primary_url: string
    cta_secondary_text: string
    cta_secondary_url: string
    trust_text: string
  }
  stats: any[]
  features: any[]
  steps: any[]
  pricingPlans: any[]
  faqs: any[]
  testimonials: any[]
  seo: Record<string, string>
}

export class LandingRepository {
  getPublicData(): LandingPublicData {
    const db = getDatabase()

    let branding: Record<string, string> = {
      site_name: 'ProfileVault',
      logo_text: '🛡️ ProfileVault',
      tagline: 'Next-Gen Anti-Detect & Browser Profile Isolation',
      primary_color: '#6366F1',
      secondary_color: '#8B5CF6',
      accent_color: '#2DD4BF',
      contact_email: 'support@profilevault.local',
      contact_telegram: 'https://t.me/profilevault_support',
      contact_whatsapp: '+1 (555) 019-2834',
      support_url: 'https://docs.profilevault.local/help'
    }

    let hero: any = {
      headline: 'Browse Privately. Manage Profiles. Scale Your Workflow.',
      subheadline: 'Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.',
      cta_primary_text: 'Start Free',
      cta_primary_url: '#register',
      cta_secondary_text: 'View Pricing',
      cta_secondary_url: '#pricing',
      trust_text: '⚡ No credit card required • Free trial available • Cancel anytime'
    }

    let stats: any[] = [
      { id: 'stat_1', number: '10K+', label: 'Active Profiles', icon: '🌐' },
      { id: 'stat_2', number: '99.9%', label: 'Platform Uptime', icon: '⚡' },
      { id: 'stat_3', number: '150+', label: 'Countries Supported', icon: '🌍' },
      { id: 'stat_4', number: '24/7', label: 'Expert Support', icon: '🛡️' }
    ]

    let features: any[] = [
      { id: 'feat_1', title: 'Isolated Browser Profiles', description: 'Keep cookies, local storage, sessions, and browser data completely separated between profiles.', icon: '🔒' },
      { id: 'feat_2', title: 'Fingerprint Management', description: 'Configure browser and device environment parameters including WebGL, Canvas, and User Agents.', icon: '🛡️' },
      { id: 'feat_3', title: 'Proxy Management System', description: 'Seamlessly assign and test HTTP, HTTPS, SOCKS4, and SOCKS5 proxy configurations per profile.', icon: '🌐' },
      { id: 'feat_4', title: 'Reusable Profile Templates', description: 'Create standardized profile templates for fast batch provisioning across your operations.', icon: '📋' },
      { id: 'feat_5', title: 'Team Access Controls', description: 'Share browser profiles securely across team members with granular permission levels.', icon: '👥' },
      { id: 'feat_6', title: 'Automation API', description: 'Access local REST endpoints and automation drivers for Puppeteer and Selenium workflows.', icon: '⚡' },
      { id: 'feat_7', title: 'Encrypted Local Storage', description: 'All session data and cookies are stored with high-standard AES-256 local database encryption.', icon: '💾' },
      { id: 'feat_8', title: 'Cross-Platform Compatibility', description: 'Native desktop support tailored for macOS, Windows, and Linux operating systems.', icon: '💻' }
    ]

    let steps: any[] = [
      { id: 'step_1', step_number: 1, title: 'Create Your Profile', description: 'Choose a profile template or start from scratch to configure your environment.', icon: '📋' },
      { id: 'step_2', step_number: 2, title: 'Configure Environment', description: 'Set custom User Agent, OS, timezone, language, WebGL fingerprint, and proxy.', icon: '⚙️' },
      { id: 'step_3', step_number: 3, title: 'Launch Isolated Window', description: 'Open an isolated browser window running with dedicated storage and cookies.', icon: '🚀' },
      { id: 'step_4', step_number: 4, title: 'Scale & Manage', description: 'Monitor profile status, organize into groups, and manage team access effortlessly.', icon: '📊' }
    ]

    let pricingPlans: any[] = [
      {
        id: 'plan_free', name: 'Free', monthly_price: 0, yearly_price: 0, yearly_discount: 20, currency: '$', profile_limit: 3, team_limit: 1, api_limit: '—', badge: '', button_text: 'Start Free', button_url: '#register', is_popular: 0,
        features: [{ feature_name: 'Browser Profiles', feature_value: '3 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'Basic' }, { feature_name: 'Fingerprint Controls', feature_value: 'Standard' }, { feature_name: 'Team Users', feature_value: '1 User' }, { feature_name: 'API Access', feature_value: '—' }, { feature_name: 'Support', feature_value: 'Community' }]
      },
      {
        id: 'plan_starter', name: 'Starter', monthly_price: 19, yearly_price: 15, yearly_discount: 20, currency: '$', profile_limit: 25, team_limit: 2, api_limit: 'Basic API', badge: '', button_text: 'Start Trial', button_url: '#register', is_popular: 0,
        features: [{ feature_name: 'Browser Profiles', feature_value: '25 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'HTTP/HTTPS/SOCKS' }, { feature_name: 'Fingerprint Controls', feature_value: 'Advanced' }, { feature_name: 'Team Users', feature_value: '2 Users' }, { feature_name: 'API Access', feature_value: 'Basic API' }, { feature_name: 'Support', feature_value: 'Email Support' }]
      },
      {
        id: 'plan_pro', name: 'Professional', monthly_price: 49, yearly_price: 39, yearly_discount: 20, currency: '$', profile_limit: 100, team_limit: 10, api_limit: 'Full API', badge: 'Most Popular', button_text: 'Get Started', button_url: '#register', is_popular: 1,
        features: [{ feature_name: 'Browser Profiles', feature_value: '100 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'HTTP/HTTPS/SOCKS' }, { feature_name: 'Fingerprint Controls', feature_value: 'Advanced Custom' }, { feature_name: 'Team Users', feature_value: '10 Users' }, { feature_name: 'API Access', feature_value: 'Full REST & Driver API' }, { feature_name: 'Support', feature_value: 'Priority 24/7' }]
      },
      {
        id: 'plan_business', name: 'Business', monthly_price: 99, yearly_price: 79, yearly_discount: 20, currency: '$', profile_limit: 500, team_limit: 25, api_limit: 'High Limit API', badge: 'Best Value', button_text: 'Contact Sales', button_url: '#contact', is_popular: 0,
        features: [{ feature_name: 'Browser Profiles', feature_value: '500 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'HTTP/HTTPS/SOCKS' }, { feature_name: 'Fingerprint Controls', feature_value: 'Full Control' }, { feature_name: 'Team Users', feature_value: '25 Users' }, { feature_name: 'API Access', feature_value: 'Unlimited API' }, { feature_name: 'Support', feature_value: 'Dedicated Account Manager' }]
      }
    ]

    let faqs: any[] = [
      { id: 'faq_1', question: 'What is an anti-detect browser?', answer: 'An anti-detect browser is a specialized software environment designed to isolate browser profiles and provide configurable hardware, network, and device parameters.' },
      { id: 'faq_2', question: 'What is a browser profile?', answer: 'A browser profile is a completely isolated container containing its own browser data, cookies, local storage, cache, proxies, and hardware fingerprint settings.' },
      { id: 'faq_3', question: 'Can I use HTTP, SOCKS4, and SOCKS5 proxies?', answer: 'Yes! ProfileVault supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with built-in connection checking and IP geolocation display.' },
      { id: 'faq_4', question: 'Can I upgrade or downgrade my plan at any time?', answer: 'Yes. You can upgrade or modify your subscription tier at any time according to your operational needs.' },
      { id: 'faq_5', question: 'Does ProfileVault offer an Automation API?', answer: 'Yes. Professional and Business plans provide local REST endpoints and automation integration for Puppeteer and Selenium drivers.' }
    ]

    let testimonials: any[] = [
      { id: 'test_1', name: 'Alex Rivera', position: 'E-Commerce Manager', company: 'Apex Brands', avatar_url: '👤', rating: 5, testimonial: 'ProfileVault completely transformed how our agency manages 50+ accounts. Session isolation and proxy integration are rock solid.', is_demo: 1 },
      { id: 'test_2', name: 'Sarah Chen', position: 'Lead Growth Engineer', company: 'Veloce Digital', avatar_url: '👩‍💻', rating: 5, testimonial: 'The local automation API and custom WebGL fingerprinting options made automated testing across multiple browser contexts seamless.', is_demo: 1 },
      { id: 'test_3', name: 'Marcus Vance', position: 'Privacy Consultant', company: 'CyberShield', avatar_url: '🛡️', rating: 5, testimonial: 'Solid security architecture, local encrypted database, and clear RBAC user permissions. Exactly what professional teams require.', is_demo: 1 }
    ]

    let seo: Record<string, string> = {
      meta_title: 'ProfileVault — Next-Gen Anti-Detect & Privacy Browser',
      meta_description: 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Antidetect Software.'
    }

    try {
      const brandingRows = db.prepare('SELECT key, value FROM landing_branding').all() as { key: string; value: string }[]
      if (brandingRows.length > 0) {
        brandingRows.forEach(r => { branding[r.key] = r.value })
      }
    } catch {}

    try {
      const heroDb = db.prepare('SELECT * FROM landing_hero WHERE id = 1').get() as any
      if (heroDb) hero = heroDb
    } catch {}

    try {
      const statsDb = db.prepare('SELECT * FROM landing_stats WHERE is_active = 1 ORDER BY sort_order ASC').all()
      if (statsDb.length > 0) stats = statsDb
    } catch {}

    try {
      const featuresDb = db.prepare('SELECT * FROM landing_features WHERE is_active = 1 ORDER BY sort_order ASC').all()
      if (featuresDb.length > 0) features = featuresDb
    } catch {}

    try {
      const stepsDb = db.prepare('SELECT * FROM landing_steps ORDER BY sort_order ASC').all()
      if (stepsDb.length > 0) steps = stepsDb
    } catch {}

    try {
      const plansDb = db.prepare('SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC').all() as any[]
      if (plansDb.length > 0) {
        pricingPlans = plansDb.map(p => {
          try {
            const planFeatures = db.prepare('SELECT * FROM pricing_plan_features WHERE plan_id = ? ORDER BY sort_order ASC').all(p.id)
            return { ...p, features: planFeatures.length > 0 ? planFeatures : [] }
          } catch {
            return { ...p, features: [] }
          }
        })
      }
    } catch {}

    try {
      const faqsDb = db.prepare('SELECT * FROM landing_faqs WHERE is_active = 1 ORDER BY sort_order ASC').all()
      if (faqsDb.length > 0) faqs = faqsDb
    } catch {}

    try {
      const testimonialsDb = db.prepare('SELECT * FROM landing_testimonials WHERE is_active = 1 ORDER BY sort_order ASC').all()
      if (testimonialsDb.length > 0) testimonials = testimonialsDb
    } catch {}

    try {
      const seoRows = db.prepare('SELECT key, value FROM landing_seo').all() as { key: string; value: string }[]
      if (seoRows.length > 0) {
        seoRows.forEach(r => { seo[r.key] = r.value })
      }
    } catch {}

    return {
      branding,
      hero,
      stats,
      features,
      steps,
      pricingPlans,
      faqs,
      testimonials,
      seo
    }
  }

  // ── Branding Admin Updates ──
  updateBranding(entries: Record<string, string>): Record<string, string> {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO landing_branding (key, value) VALUES (?, ?)')
    Object.entries(entries).forEach(([k, v]) => {
      stmt.run(k, v)
    })
    return this.getPublicData().branding
  }

  // ── Hero Admin Update ──
  updateHero(data: any): any {
    const db = getDatabase()
    db.prepare(`
      UPDATE landing_hero SET
        headline = ?,
        subheadline = ?,
        cta_primary_text = ?,
        cta_primary_url = ?,
        cta_secondary_text = ?,
        cta_secondary_url = ?,
        trust_text = ?
      WHERE id = 1
    `).run(
      data.headline,
      data.subheadline,
      data.cta_primary_text,
      data.cta_primary_url,
      data.cta_secondary_text,
      data.cta_secondary_url,
      data.trust_text
    )
    return this.getPublicData().hero
  }

  // ── Pricing Plans CRUD ──
  savePricingPlan(plan: any): any {
    const db = getDatabase()
    const planId = plan.id || `plan_${Date.now()}`

    db.prepare(`
      INSERT OR REPLACE INTO pricing_plans (
        id, name, slug, description, monthly_price, yearly_price, yearly_discount,
        currency, profile_limit, team_limit, api_limit, badge, button_text,
        button_url, is_popular, is_active, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      planId,
      plan.name,
      plan.slug || plan.name.toLowerCase().replace(/\s+/g, '-'),
      plan.description || '',
      parseFloat(plan.monthly_price) || 0,
      parseFloat(plan.yearly_price) || 0,
      parseInt(plan.yearly_discount, 10) || 20,
      plan.currency || '$',
      parseInt(plan.profile_limit, 10) || 0,
      parseInt(plan.team_limit, 10) || 1,
      plan.api_limit || '—',
      plan.badge || '',
      plan.button_text || 'Get Started',
      plan.button_url || '#register',
      plan.is_popular ? 1 : 0,
      plan.is_active !== undefined ? (plan.is_active ? 1 : 0) : 1,
      parseInt(plan.sort_order, 10) || 0
    )

    // Replace plan features
    if (Array.isArray(plan.features)) {
      db.prepare('DELETE FROM pricing_plan_features WHERE plan_id = ?').run(planId)
      const featStmt = db.prepare('INSERT INTO pricing_plan_features (plan_id, feature_name, feature_value, sort_order) VALUES (?, ?, ?, ?)')
      plan.features.forEach((f: any, idx: number) => {
        featStmt.run(planId, f.feature_name || f.name, f.feature_value || f.value || '✓', idx + 1)
      })
    }

    return this.getPublicData().pricingPlans
  }

  deletePricingPlan(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM pricing_plans WHERE id = ?').run(id)
  }

  // ── FAQ CRUD ──
  saveFaq(faq: any): void {
    const db = getDatabase()
    const faqId = faq.id || `faq_${Date.now()}`
    db.prepare(`
      INSERT OR REPLACE INTO landing_faqs (id, question, answer, category, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      faqId,
      faq.question,
      faq.answer,
      faq.category || 'General',
      parseInt(faq.sort_order, 10) || 0,
      faq.is_active !== undefined ? (faq.is_active ? 1 : 0) : 1
    )
  }

  deleteFaq(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM landing_faqs WHERE id = ?').run(id)
  }

  // ── Testimonial CRUD ──
  saveTestimonial(test: any): void {
    const db = getDatabase()
    const testId = test.id || `test_${Date.now()}`
    db.prepare(`
      INSERT OR REPLACE INTO landing_testimonials (id, name, position, company, avatar_url, rating, testimonial, is_demo, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testId,
      test.name,
      test.position || '',
      test.company || '',
      test.avatar_url || '👤',
      parseInt(test.rating, 10) || 5,
      test.testimonial,
      test.is_demo ? 1 : 0,
      parseInt(test.sort_order, 10) || 0,
      test.is_active !== undefined ? (test.is_active ? 1 : 0) : 1
    )
  }

  deleteTestimonial(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM landing_testimonials WHERE id = ?').run(id)
  }

  // ── SEO Settings ──
  updateSeo(entries: Record<string, string>): Record<string, string> {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO landing_seo (key, value) VALUES (?, ?)')
    Object.entries(entries).forEach(([k, v]) => {
      stmt.run(k, v)
    })
    return this.getPublicData().seo
  }
}

export const landingRepo = new LandingRepository()
