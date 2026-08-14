// ──────────────────────────────────────────────
// ProfileVault — Migration 004: Landing Page & CMS System
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 4
export const name = '004_landing_cms'

export function up(db: Database.Database): void {
  // 1. Branding Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_branding (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Initial Branding Seed
  const defaultBranding = [
    ['site_name', 'ProfileVault'],
    ['logo_text', '🛡️ ProfileVault'],
    ['tagline', 'Next-Gen Anti-Detect & Browser Profile Isolation'],
    ['primary_color', '#6366F1'],
    ['secondary_color', '#8B5CF6'],
    ['accent_color', '#2DD4BF'],
    ['dark_mode_default', 'true'],
    ['contact_email', 'support@profilevault.local'],
    ['contact_telegram', 'https://t.me/profilevault_support'],
    ['contact_whatsapp', '+1 (555) 019-2834'],
    ['support_url', 'https://docs.profilevault.local/help'],
    ['facebook_url', 'https://facebook.com/profilevault'],
    ['twitter_url', 'https://twitter.com/profilevault'],
    ['linkedin_url', 'https://linkedin.com/company/profilevault'],
    ['telegram_channel', 'https://t.me/profilevault_official'],
    ['youtube_url', 'https://youtube.com/@profilevault']
  ]

  const insertBranding = db.prepare('INSERT OR IGNORE INTO landing_branding (key, value) VALUES (?, ?)')
  defaultBranding.forEach(([k, v]) => insertBranding.run(k, v))

  // 2. Hero Section
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_hero (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      headline         TEXT NOT NULL,
      subheadline      TEXT NOT NULL,
      cta_primary_text TEXT NOT NULL,
      cta_primary_url  TEXT NOT NULL,
      cta_secondary_text TEXT NOT NULL,
      cta_secondary_url TEXT NOT NULL,
      trust_text       TEXT NOT NULL
    );
  `)

  db.prepare(`
    INSERT OR IGNORE INTO landing_hero (id, headline, subheadline, cta_primary_text, cta_primary_url, cta_secondary_text, cta_secondary_url, trust_text)
    VALUES (
      1,
      'Browse Privately. Manage Profiles. Scale Your Workflow.',
      'Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.',
      'Start Free',
      '#register',
      'View Pricing',
      '#pricing',
      '⚡ No credit card required • Free trial available • Cancel anytime'
    );
  `).run()

  // 3. Hero Statistics
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_stats (
      id         TEXT PRIMARY KEY,
      number     TEXT NOT NULL,
      label      TEXT NOT NULL,
      icon       TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active  INTEGER DEFAULT 1
    );
  `)

  const defaultStats = [
    ['stat_1', '10K+', 'Active Profiles', '🌐', 1],
    ['stat_2', '99.9%', 'Platform Uptime', '⚡', 2],
    ['stat_3', '150+', 'Countries Supported', '🌍', 3],
    ['stat_4', '24/7', 'Expert Support', '🛡️', 4]
  ]

  const insertStat = db.prepare('INSERT OR IGNORE INTO landing_stats (id, number, label, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
  defaultStats.forEach(([id, num, label, icon, sort]) => insertStat.run(id, num, label, icon, sort))

  // 4. Features Grid
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_features (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      icon        TEXT NOT NULL,
      button_text TEXT DEFAULT '',
      button_url  TEXT DEFAULT '',
      sort_order  INTEGER DEFAULT 0,
      is_active   INTEGER DEFAULT 1
    );
  `)

  const defaultFeatures = [
    ['feat_1', 'Isolated Browser Profiles', 'Keep cookies, local storage, sessions, and browser data completely separated between profiles.', '🔒', 'Learn More', '#features', 1],
    ['feat_2', 'Fingerprint Management', 'Configure browser and device environment parameters including WebGL, Canvas, and User Agents.', '🛡️', '', '', 2],
    ['feat_3', 'Proxy Management System', 'Seamlessly assign and test HTTP, HTTPS, SOCKS4, and SOCKS5 proxy configurations per profile.', '🌐', '', '', 3],
    ['feat_4', 'Reusable Profile Templates', 'Create standardized profile templates for fast batch provisioning across your operations.', '📋', '', '', 4],
    ['feat_5', 'Team Access Controls', 'Share browser profiles securely across team members with granular permission levels.', '👥', '', '', 5],
    ['feat_6', 'Automation API', 'Access local REST endpoints and automation drivers for Puppeteer and Selenium workflows.', '⚡', '', '', 6],
    ['feat_7', 'Encrypted Local Storage', 'All session data and cookies are stored with high-standard AES-256 local database encryption.', '💾', '', '', 7],
    ['feat_8', 'Cross-Platform Compatibility', 'Native desktop support tailored for macOS, Windows, and Linux operating systems.', '💻', '', '', 8]
  ]

  const insertFeature = db.prepare('INSERT OR IGNORE INTO landing_features (id, title, description, icon, button_text, button_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
  defaultFeatures.forEach(([id, title, desc, icon, btnText, btnUrl, sort]) => insertFeature.run(id, title, desc, icon, btnText, btnUrl, sort))

  // 5. How It Works Steps
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_steps (
      id          TEXT PRIMARY KEY,
      step_number INTEGER NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      icon        TEXT NOT NULL,
      sort_order  INTEGER DEFAULT 0
    );
  `)

  const defaultSteps = [
    ['step_1', 1, 'Create Your Profile', 'Choose a profile template or start from scratch to configure your environment.', 1],
    ['step_2', 2, 'Configure Environment', 'Set custom User Agent, OS, timezone, language, WebGL fingerprint, and proxy.', 2],
    ['step_3', 3, 'Launch Isolated Window', 'Open an isolated browser window running with dedicated storage and cookies.', 3],
    ['step_4', 4, 'Scale & Manage', 'Monitor profile status, organize into groups, and manage team access effortlessly.', 4]
  ]

  const insertStep = db.prepare('INSERT OR IGNORE INTO landing_steps (id, step_number, title, description, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  defaultSteps.forEach(([id, num, title, desc, icon, sort]) => insertStep.run(id, num, title, desc, icon, sort))

  // 6. Pricing Plans & Plan Features
  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      slug             TEXT NOT NULL UNIQUE,
      description      TEXT NOT NULL,
      monthly_price    REAL NOT NULL,
      yearly_price     REAL NOT NULL,
      yearly_discount  INTEGER DEFAULT 20,
      currency         TEXT DEFAULT '$',
      profile_limit    INTEGER NOT NULL,
      team_limit       INTEGER NOT NULL,
      api_limit        TEXT DEFAULT 'Basic',
      badge            TEXT DEFAULT '',
      button_text      TEXT NOT NULL,
      button_url       TEXT NOT NULL,
      is_popular       INTEGER DEFAULT 0,
      is_active        INTEGER DEFAULT 1,
      sort_order       INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_plan_features (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id       TEXT NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
      feature_name  TEXT NOT NULL,
      feature_value TEXT NOT NULL,
      sort_order    INTEGER DEFAULT 0
    );
  `)

  // Initial Pricing Plans
  const defaultPlans = [
    ['plan_free', 'Free', 'free', 'Ideal for testing & personal profile management', 0, 0, 20, '$', 3, 1, '—', '', 'Start Free', '#register', 0, 1],
    ['plan_starter', 'Starter', 'starter', 'Essential features for solo operators & small tasks', 19, 15, 20, '$', 25, 2, 'Basic API', '', 'Start Trial', '#register', 0, 2],
    ['plan_pro', 'Professional', 'professional', 'Advanced fingerprint controls & team features', 49, 39, 20, '$', 100, 10, 'Full API', 'Most Popular', 'Get Started', '#register', 1, 3],
    ['plan_business', 'Business', 'business', 'Maximum power for large scale multi-profile teams', 99, 79, 20, '$', 500, 25, 'High Limit API', 'Best Value', 'Contact Sales', '#contact', 0, 4]
  ]

  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO pricing_plans (id, name, slug, description, monthly_price, yearly_price, yearly_discount, currency, profile_limit, team_limit, api_limit, badge, button_text, button_url, is_popular, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  defaultPlans.forEach((p) => insertPlan.run(...p))

  // Initial Plan Features
  const defaultPlanFeatures = [
    ['plan_free', 'Browser Profiles', '3 Profiles', 1],
    ['plan_free', 'Proxy Management', 'Basic', 2],
    ['plan_free', 'Fingerprint Controls', 'Standard', 3],
    ['plan_free', 'Team Members', '1 User', 4],
    ['plan_free', 'Automation API', '—', 5],
    ['plan_free', 'Support', 'Community', 6],

    ['plan_starter', 'Browser Profiles', '25 Profiles', 1],
    ['plan_starter', 'Proxy Management', 'HTTP/HTTPS/SOCKS', 2],
    ['plan_starter', 'Fingerprint Controls', 'Advanced', 3],
    ['plan_starter', 'Team Members', '2 Users', 4],
    ['plan_starter', 'Automation API', 'Basic API', 5],
    ['plan_starter', 'Support', 'Email Support', 6],

    ['plan_pro', 'Browser Profiles', '100 Profiles', 1],
    ['plan_pro', 'Proxy Management', 'HTTP/HTTPS/SOCKS', 2],
    ['plan_pro', 'Fingerprint Controls', 'Advanced Custom', 3],
    ['plan_pro', 'Team Members', '10 Users', 4],
    ['plan_pro', 'Automation API', 'Full REST & Driver API', 5],
    ['plan_pro', 'Support', 'Priority 24/7', 6],

    ['plan_business', 'Browser Profiles', '500 Profiles', 1],
    ['plan_business', 'Proxy Management', 'HTTP/HTTPS/SOCKS', 2],
    ['plan_business', 'Fingerprint Controls', 'Full Control', 3],
    ['plan_business', 'Team Members', '25 Users', 4],
    ['plan_business', 'Automation API', 'Unlimited API', 5],
    ['plan_business', 'Support', 'Dedicated Account Manager', 6]
  ]

  const insertPlanFeat = db.prepare('INSERT OR IGNORE INTO pricing_plan_features (plan_id, feature_name, feature_value, sort_order) VALUES (?, ?, ?, ?)')
  defaultPlanFeatures.forEach(([pid, name, val, sort]) => insertPlanFeat.run(pid, name, val, sort))

  // 7. FAQs
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_faqs (
      id         TEXT PRIMARY KEY,
      question   TEXT NOT NULL,
      answer     TEXT NOT NULL,
      category   TEXT DEFAULT 'General',
      sort_order INTEGER DEFAULT 0,
      is_active  INTEGER DEFAULT 1
    );
  `)

  const defaultFaqs = [
    ['faq_1', 'What is an anti-detect browser?', 'An anti-detect browser is a specialized software environment designed to isolate browser profiles and provide configurable hardware, network, and device parameters to keep sessions separated.', 'General', 1],
    ['faq_2', 'What is a browser profile?', 'A browser profile is a completely isolated container containing its own browser data, cookies, local storage, cache, proxies, and hardware fingerprint settings.', 'Profiles', 2],
    ['faq_3', 'Can I use HTTP, SOCKS4, and SOCKS5 proxies?', 'Yes! ProfileVault supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with built-in connection checking and IP geolocation display.', 'Proxies', 3],
    ['faq_4', 'Can I upgrade or downgrade my plan at any time?', 'Yes. You can upgrade or modify your subscription tier at any time according to your operational needs.', 'Billing', 4],
    ['faq_5', 'Does ProfileVault offer an Automation API?', 'Yes. Professional and Business plans provide local REST endpoints and automation integration for Puppeteer and Selenium drivers.', 'API', 5]
  ]

  const insertFaq = db.prepare('INSERT OR IGNORE INTO landing_faqs (id, question, answer, category, sort_order) VALUES (?, ?, ?, ?, ?)')
  defaultFaqs.forEach(([id, q, a, cat, sort]) => insertFaq.run(id, q, a, cat, sort))

  // 8. Testimonials
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_testimonials (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      position    TEXT NOT NULL,
      company     TEXT NOT NULL,
      avatar_url  TEXT NOT NULL,
      rating      INTEGER DEFAULT 5,
      testimonial TEXT NOT NULL,
      is_demo     INTEGER DEFAULT 1,
      sort_order  INTEGER DEFAULT 0,
      is_active   INTEGER DEFAULT 1
    );
  `)

  const defaultTestimonials = [
    ['test_1', 'Alex Rivera', 'E-Commerce Manager', 'Apex Brands', '👤', 5, 'ProfileVault completely transformed how our agency manages 50+ accounts. Session isolation and proxy integration are rock solid.', 1, 1],
    ['test_2', 'Sarah Chen', 'Lead Growth Engineer', 'Veloce Digital', '👩‍💻', 5, 'The local automation API and custom WebGL fingerprinting options made automated testing across multiple browser contexts seamless.', 1, 2],
    ['test_3', 'Marcus Vance', 'Privacy Consultant', 'CyberShield', '🛡️', 5, 'Solid security architecture, local encrypted database, and clear RBAC user permissions. Exactly what professional teams require.', 1, 3]
  ]

  const insertTestimonial = db.prepare('INSERT OR IGNORE INTO landing_testimonials (id, name, position, company, avatar_url, rating, testimonial, is_demo, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  defaultTestimonials.forEach(([id, name, pos, comp, av, rat, text, demo, sort]) => insertTestimonial.run(id, name, pos, comp, av, rat, text, demo, sort))

  // 9. SEO Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_seo (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const defaultSeo = [
    ['meta_title', 'ProfileVault — Next-Gen Anti-Detect & Privacy Browser'],
    ['meta_description', 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Antidetect Software.'],
    ['meta_keywords', 'anti detect browser, browser isolation, proxy manager, multi accounting, browser fingerprinting, privacy browser'],
    ['og_title', 'ProfileVault — Anti-Detect Browser Platform'],
    ['og_description', 'Create isolated browser profiles with configurable environments, secure session storage, and team access.'],
    ['canonical_url', 'https://profilevault.local'],
    ['robots_txt', 'User-agent: *\nAllow: /']
  ]

  const insertSeo = db.prepare('INSERT OR IGNORE INTO landing_seo (key, value) VALUES (?, ?)')
  defaultSeo.forEach(([k, v]) => insertSeo.run(k, v))
}
