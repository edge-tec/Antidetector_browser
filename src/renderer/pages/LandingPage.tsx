// ──────────────────────────────────────────────
// AntiProfiles — Public Anti-Detect SaaS Landing Page
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import logoImg from '../assets/logo.png'
import { SupportChatWidget } from '../components/SupportChatWidget'

interface LandingProps {
  onNavigateLogin: () => void
  onNavigateRegister: () => void
}

const DEFAULT_LANDING_DATA = {
  branding: {
    site_name: 'AntiProfiles',
    logo_text: '🛡️ AntiProfiles',
    primary_color: '#6366F1',
    secondary_color: '#8B5CF6',
    accent_color: '#2DD4BF',
    contact_email: 'support@antiprofiles.com',
    contact_telegram: 'https://t.me/antiprofiles_support',
    contact_whatsapp: '+1 (555) 019-2834',
    support_url: 'https://docs.antiprofiles.com/help'
  },
  hero: {
    headline: 'Browse Privately. Manage Profiles. Scale Your Workflow.',
    subheadline: 'Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.',
    cta_primary_text: 'Start Free',
    cta_primary_url: '#register',
    cta_secondary_text: 'View Pricing',
    cta_secondary_url: '#pricing',
    trust_text: '⚡ No credit card required • Free trial available • Cancel anytime'
  },
  stats: [
    { id: '1', number: '10K+', label: 'Active Profiles', icon: '🌐' },
    { id: '2', number: '99.9%', label: 'Platform Uptime', icon: '⚡' },
    { id: '3', number: '150+', label: 'Countries Supported', icon: '🌍' },
    { id: '4', number: '24/7', label: 'Expert Support', icon: '🛡️' }
  ],
  features: [
    { id: '1', title: 'Isolated Browser Profiles', description: 'Keep cookies, local storage, sessions, and browser data completely separated between profiles.', icon: '🔒' },
    { id: '2', title: 'Fingerprint Management', description: 'Configure browser and device environment parameters including WebGL, Canvas, and User Agents.', icon: '🛡️' },
    { id: '3', title: 'Proxy Management System', description: 'Seamlessly assign and test HTTP, HTTPS, SOCKS4, and SOCKS5 proxy configurations per profile.', icon: '🌐' },
    { id: '4', title: 'Reusable Profile Templates', description: 'Create standardized profile templates for fast batch provisioning across your operations.', icon: '📋' },
    { id: '5', title: 'Team Access Controls', description: 'Share browser profiles securely across team members with granular permission levels.', icon: '👥' },
    { id: '6', title: 'Automation API', description: 'Access local REST endpoints and automation drivers for Puppeteer and Selenium workflows.', icon: '⚡' },
    { id: '7', title: 'Encrypted Local Storage', description: 'All session data and cookies are stored with high-standard AES-256 local database encryption.', icon: '💾' },
    { id: '8', title: 'Cross-Platform Compatibility', description: 'Native desktop support tailored for macOS, Windows, and Linux operating systems.', icon: '💻' }
  ],
  steps: [
    { id: '1', step_number: 1, title: 'Create Your Profile', description: 'Choose a profile template or start from scratch to configure your environment.', icon: '📋' },
    { id: '2', step_number: 2, title: 'Configure Environment', description: 'Set custom User Agent, OS, timezone, language, WebGL fingerprint, and proxy.', icon: '⚙️' },
    { id: '3', step_number: 3, title: 'Launch Isolated Window', description: 'Open an isolated browser window running with dedicated storage and cookies.', icon: '🚀' },
    { id: '4', step_number: 4, title: 'Scale & Manage', description: 'Monitor profile status, organize into groups, and manage team access effortlessly.', icon: '📊' }
  ],
  pricingPlans: [
    {
      id: 'p1', name: 'Free', monthly_price: 0, yearly_price: 0, yearly_discount: 20, currency: '$', profile_limit: 3, team_limit: 1, api_limit: '—', badge: '', button_text: 'Start Free', button_url: '#register', is_popular: 0,
      features: [{ feature_name: 'Browser Profiles', feature_value: '3 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'Basic' }, { feature_name: 'Fingerprint Controls', feature_value: 'Standard' }, { feature_name: 'Team Users', feature_value: '1 User' }, { feature_name: 'API Access', feature_value: '—' }, { feature_name: 'Support', feature_value: 'Community' }]
    },
    {
      id: 'p2', name: 'Starter', monthly_price: 19, yearly_price: 15, yearly_discount: 20, currency: '$', profile_limit: 25, team_limit: 2, api_limit: 'Basic API', badge: '', button_text: 'Start Trial', button_url: '#register', is_popular: 0,
      features: [{ feature_name: 'Browser Profiles', feature_value: '25 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'HTTP/HTTPS/SOCKS' }, { feature_name: 'Fingerprint Controls', feature_value: 'Advanced' }, { feature_name: 'Team Users', feature_value: '2 Users' }, { feature_name: 'API Access', feature_value: 'Basic API' }, { feature_name: 'Support', feature_value: 'Email Support' }]
    },
    {
      id: 'p3', name: 'Professional', monthly_price: 49, yearly_price: 39, yearly_discount: 20, currency: '$', profile_limit: 100, team_limit: 10, api_limit: 'Full API', badge: 'Most Popular', button_text: 'Get Started', button_url: '#register', is_popular: 1,
      features: [{ feature_name: 'Browser Profiles', feature_value: '100 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'HTTP/HTTPS/SOCKS' }, { feature_name: 'Fingerprint Controls', feature_value: 'Advanced Custom' }, { feature_name: 'Team Users', feature_value: '10 Users' }, { feature_name: 'API Access', feature_value: 'Full REST & Driver API' }, { feature_name: 'Support', feature_value: 'Priority 24/7' }]
    },
    {
      id: 'p4', name: 'Business', monthly_price: 99, yearly_price: 79, yearly_discount: 20, currency: '$', profile_limit: 500, team_limit: 25, api_limit: 'High Limit API', badge: 'Best Value', button_text: 'Contact Sales', button_url: '#contact', is_popular: 0,
      features: [{ feature_name: 'Browser Profiles', feature_value: '500 Profiles' }, { feature_name: 'Proxy Support', feature_value: 'HTTP/HTTPS/SOCKS' }, { feature_name: 'Fingerprint Controls', feature_value: 'Full Control' }, { feature_name: 'Team Users', feature_value: '25 Users' }, { feature_name: 'API Access', feature_value: 'Unlimited API' }, { feature_name: 'Support', feature_value: 'Dedicated Account Manager' }]
    }
  ],
  faqs: [
    { id: '1', question: 'What is an anti-detect browser?', answer: 'An anti-detect browser is a specialized software environment designed to isolate browser profiles and provide configurable hardware, network, and device parameters.' },
    { id: '2', question: 'What is a browser profile?', answer: 'A browser profile is a completely isolated container containing its own browser data, cookies, local storage, cache, proxies, and hardware fingerprint settings.' },
    { id: '3', question: 'Can I use HTTP, SOCKS4, and SOCKS5 proxies?', answer: 'Yes! AntiProfiles supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with built-in connection checking and IP geolocation display.' },
    { id: '4', question: 'Can I upgrade or downgrade my plan at any time?', answer: 'Yes. You can upgrade or modify your subscription tier at any time according to your operational needs.' },
    { id: '5', question: 'Does AntiProfiles offer an Automation API?', answer: 'Yes. Professional and Business plans provide local REST endpoints and automation integration for Puppeteer and Selenium drivers.' }
  ],
  testimonials: [
    { id: '1', name: 'Alex Rivera', position: 'E-Commerce Manager', company: 'Apex Brands', avatar_url: '👤', rating: 5, testimonial: 'AntiProfiles completely transformed how our agency manages 50+ accounts. Session isolation and proxy integration are rock solid.', is_demo: 1 },
    { id: '2', name: 'Sarah Chen', position: 'Lead Growth Engineer', company: 'Veloce Digital', avatar_url: '👩‍💻', rating: 5, testimonial: 'The local automation API and custom WebGL fingerprinting options made automated testing across multiple browser contexts seamless.', is_demo: 1 },
    { id: '3', name: 'Marcus Vance', position: 'Privacy Consultant', company: 'CyberShield', avatar_url: '🛡️', rating: 5, testimonial: 'Solid security architecture, local encrypted database, and clear RBAC user permissions. Exactly what professional teams require.', is_demo: 1 }
  ],
  seo: {
    meta_title: 'AntiProfiles — Next-Gen Anti-Detect & Privacy Browser',
    meta_description: 'Manage isolated browser profiles, configure proxies, and automate workflows securely with AntiProfiles Antidetect Software.'
  },
  trial: {
    is_enabled: true,
    trial_duration_days: 7,
    default_plan_id: 'plan_starter',
    applies_to_packages: 'all'
  }
}

const callLandingIpc = async (channel: string, ...args: any[]) => {
  if (typeof window !== 'undefined' && (window as any).api) {
    const apiMethodMap: Record<string, string> = {
      'landing:get-public-data': 'getPublicLandingData'
    }
    const methodName = apiMethodMap[channel]
    if (methodName && typeof (window as any).api[methodName] === 'function') {
      return await (window as any).api[methodName](...args)
    }
  }

  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    return await (window as any).electron.ipcRenderer.invoke(channel, ...args)
  }

  return { success: true, data: DEFAULT_LANDING_DATA }
}

export const LandingPage: React.FC<LandingProps> = ({ onNavigateLogin, onNavigateRegister }) => {
  const [data, setData] = useState<any>(null)
  const [appReleases, setAppReleases] = useState<any>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  // OS & CPU Architecture Detection State
  const [detectedTarget, setDetectedTarget] = useState<'windows-x64' | 'macos-arm64' | 'macos-x64'>('windows-x64')
  const [showArchHelpModal, setShowArchHelpModal] = useState(false)

  // Contact Form State
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [contactSending, setContactSending] = useState(false)

  useEffect(() => {
    // OS and Architecture Detection
    const ua = navigator.userAgent || ''
    const platform = (navigator.platform || '').toLowerCase()
    let isMac = platform.includes('mac') || ua.includes('Macintosh') || ua.includes('Mac OS')
    
    if (isMac) {
      let isArm = false
      try {
        const canvas = document.createElement('canvas')
        const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
          if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
            if (/Apple M\d|Apple GPU|Apple/i.test(renderer)) {
              isArm = true
            }
          }
        }
      } catch {}

      if (isArm) setDetectedTarget('macos-arm64')
      else setDetectedTarget('macos-x64')
    } else {
      setDetectedTarget('windows-x64')
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const res = await callLandingIpc('landing:get-public-data')
        if (isMounted) {
          if (res?.success && res.data) {
            setData(res.data)
          } else {
            setData(DEFAULT_LANDING_DATA)
          }
        }
      } catch {
        if (isMounted) {
          setData(DEFAULT_LANDING_DATA)
        }
      }

      try {
        if (typeof window !== 'undefined' && (window as any).api?.getAppReleases) {
          const rel = await (window as any).api.getAppReleases()
          if (isMounted && rel?.success && rel.data) {
            setAppReleases(rel.data)
          }
        } else {
          // Direct web fallback to central releases API
          const res = await fetch('/api/releases?t=' + Date.now())
          const json = await res.json()
          if (isMounted && json?.success && json?.data?.platforms) {
            const plats = json.data.platforms
            setAppReleases({
              win_app_version: plats['windows-x64']?.version || '2.0.0',
              win_download_url: plats['windows-x64']?.download_url || '/api/releases?download=1&platform=windows-x64',
              mac_arm_app_version: plats['macos-arm64']?.version || '2.0.0',
              mac_arm_download_url: plats['macos-arm64']?.download_url || '/api/releases?download=1&platform=macos-arm64',
              mac_intel_app_version: plats['macos-x64']?.version || '2.0.0',
              mac_intel_download_url: plats['macos-x64']?.download_url || '/api/releases?download=1&platform=macos-x64',
              linux_app_version: plats['linux-x64']?.version || '2.0.0',
              linux_download_url: plats['linux-x64']?.download_url || '/api/releases?download=1&platform=linux-x64'
            })
          }
        }
      } catch {}
    }
    fetchData()
    const timer = setTimeout(() => {
      if (isMounted && !data) {
        setData(DEFAULT_LANDING_DATA)
      }
    }, 400)
    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [])

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0F0F14', color: '#2DD4BF', fontSize: '18px', fontWeight: 600 }}>
        🛡️ Loading AntiProfiles...
      </div>
    )
  }

  const { branding, hero, stats, features, steps, pricingPlans, faqs, testimonials, trial } = data
  const accentColor = branding.accent_color || '#2DD4BF'
  const primaryColor = branding.primary_color || '#6366F1'

  const trialActive = trial ? Boolean(trial.is_enabled) : true
  const trialDays = trial ? Number(trial.trial_duration_days || 7) : 7
  const trialPlanId = trial?.default_plan_id || 'plan_starter'
  const trialScope = trial?.applies_to_packages || 'all'

  const isPlanTrialActive = (plan: any) => {
    if (!trialActive) return false
    if (Number(plan.monthly_price) === 0) return false
    if (trialScope === 'all') return true
    const pId = String(plan.id || '').toLowerCase()
    const tId = String(trialPlanId || '').toLowerCase()
    const pName = String(plan.name || '').toLowerCase()
    return pId === tId || tId.includes(pId) || pId.includes(tId) || (pName && tId.includes(pName))
  }

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setContactSending(true)
    setTimeout(() => {
      setContactSending(false)
      setContactSubmitted(true)
      setContactForm({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setContactSubmitted(false), 5000)
    }, 800)
  }

  return (
    <div style={{ backgroundColor: '#0F0F14', color: '#CBD5E1', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', width: '100%', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
      
      {/* ── 1. Sticky Navigation Bar ── */}
      <header className="window-drag-area" style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: '#0F0F14D0',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #2C2C3E',
        padding: '16px 24px 16px 90px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Brand Logo & Name */}
          <div className="window-no-drag" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logoImg} alt="AntiProfiles Logo" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(59,130,246,0.6))' }} />
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px' }}>
              {branding.site_name || 'AntiProfiles'}
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }} className="desktop-nav window-no-drag">
            <a href="#features" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Features</a>
            <a href="#how-it-works" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>How It Works</a>
            <a href="#showcase" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Preview</a>
            <a href="#pricing" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Pricing</a>
            <a href="#faq" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>FAQ</a>
            <a href="#contact" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Contact</a>
          </nav>

          {/* Right Action CTAs */}
          <div className="window-no-drag" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onNavigateLogin}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: '1px solid #2C2C3E',
                color: '#F1F5F9',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={onNavigateRegister}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                backgroundColor: accentColor,
                border: 'none',
                color: '#0F0F17',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: `0 4px 14px ${accentColor}40`
              }}
            >
              Get Started
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: '#FFF', fontSize: '22px', cursor: 'pointer', display: 'none' }}
              className="mobile-toggle"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu Dropdown */}
        {mobileMenuOpen && (
          <div style={{ backgroundColor: '#161622', borderTop: '1px solid #2C2C3E', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: '#CBD5E1', textDecoration: 'none', fontSize: '15px' }}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} style={{ color: '#CBD5E1', textDecoration: 'none', fontSize: '15px' }}>How It Works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={{ color: '#CBD5E1', textDecoration: 'none', fontSize: '15px' }}>Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} style={{ color: '#CBD5E1', textDecoration: 'none', fontSize: '15px' }}>FAQ</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ color: '#CBD5E1', textDecoration: 'none', fontSize: '15px' }}>Contact</a>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section style={{ padding: '80px 24px 60px', maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: `${primaryColor}20`, border: `1px solid ${primaryColor}40`, color: accentColor, fontSize: '12px', fontWeight: 600, marginBottom: '20px' }}>
            <span>🚀</span> Next-Generation AntiProfiles Architecture
          </div>
          
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, color: '#F8FAFC', lineHeight: 1.15, margin: '0 0 20px', letterSpacing: '-1px' }}>
            {hero.headline}
          </h1>

          <p style={{ fontSize: '16px', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 32px', maxWidth: '540px' }}>
            {hero.subheadline}
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={onNavigateRegister}
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                backgroundColor: accentColor,
                color: '#0F0F17',
                fontWeight: 800,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: `0 6px 20px ${accentColor}40`
              }}
            >
              {hero.cta_primary_text}
            </button>

            <a
              href="#pricing"
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                backgroundColor: '#161622',
                border: '1px solid #2C2C3E',
                color: '#F1F5F9',
                fontWeight: 600,
                fontSize: '15px',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              {hero.cta_secondary_text}
            </a>
          </div>

          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {hero.trust_text}
          </div>
        </div>

        {/* Dashboard Live Mockup Visualizer */}
        <div style={{
          backgroundColor: '#161622',
          border: '1px solid #2C2C3E',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2C2C3E', paddingBottom: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>AntiProfiles Dashboard v1.0</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { name: 'US E-Commerce Account', os: 'macOS', location: '🇺🇸 United States', proxy: 'Active HTTP', status: 'Running' },
              { name: 'UK Marketing Profile', os: 'Windows 11', location: '🇬🇧 United Kingdom', proxy: 'SOCKS5 Active', status: 'Stopped' },
              { name: 'EU Research Context', os: 'Linux', location: '🇩🇪 Germany', proxy: 'HTTP Active', status: 'Running' }
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>{p.os} • {p.location} • {p.proxy}</div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: p.status === 'Running' ? '#10B98120' : '#2C2C3E',
                  color: p.status === 'Running' ? '#10B981' : '#94A3B8'
                }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Hero Statistics Row ── */}
      <section style={{ borderTop: '1px solid #2C2C3E', borderBottom: '1px solid #2C2C3E', backgroundColor: '#14141F', padding: '40px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', textAlign: 'center' }}>
          {stats.map((s: any) => (
            <div key={s.id} style={{ padding: '16px' }}>
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: accentColor, letterSpacing: '-0.5px' }}>{s.number}</div>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Features Section ── */}
      <section id="features" style={{ padding: '90px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px' }}>
            Built for Privacy, Security & Isolation
          </h2>
          <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '600px', margin: '0 auto' }}>
            Comprehensive environment control tools designed to keep your browser profiles completely isolated.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {features.map((f: any) => (
            <div key={f.id} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '14px', padding: '28px', transition: 'all 0.2s ease' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 10px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4b. Supported Accounts & Platforms Grid Section ── */}
      <section style={{ backgroundColor: '#FFFFFF', padding: '90px 24px', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, color: '#1E293B', margin: '0 0 48px', letterSpacing: '-0.5px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            Ideal for managing accounts across all services
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* 1. Facebook */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }} className="platform-card">
              <svg height="26" viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="24" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="26" letterSpacing="-1">facebook</text>
              </svg>
            </div>

            {/* 2. Amazon */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="28" viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="22" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="24">amazon</text>
                <path d="M12 28 C 30 35, 65 35, 80 25 M 76 23 L 83 25 L 80 30" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>

            {/* 3. eBay */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="26" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="24" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="28" letterSpacing="-1">ebay</text>
              </svg>
            </div>

            {/* 4. LinkedIn */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="23" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="24">Linked</text>
                <rect x="76" y="4" width="22" height="22" rx="4" fill="#64748B" />
                <text x="81" y="21" fill="#F8FAFC" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="18">in</text>
              </svg>
            </div>

            {/* 5. Reddit */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="26" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="16" r="10" fill="#64748B" />
                <circle cx="10" cy="14" r="2" fill="#F8FAFC" />
                <circle cx="18" cy="14" r="2" fill="#F8FAFC" />
                <path d="M 10 18 Q 14 22 18 18" stroke="#F8FAFC" strokeWidth="1.5" fill="none" />
                <text x="32" y="24" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="24">reddit</text>
              </svg>
            </div>

            {/* 6. Instagram */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="26" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="24" fill="#64748B" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="26">Instagram</text>
              </svg>
            </div>

            {/* 7. TikTok */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 14 6 L 14 20 A 5 5 0 1 1 9 15 M 14 11 A 7 7 0 0 0 21 6" stroke="#64748B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <text x="28" y="23" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="24">TikTok</text>
              </svg>
            </div>

            {/* 8. Discord */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 4 8 C 8 6 14 5 18 6 C 18 6 20 10 21 16 C 16 18 10 18 5 16 C 6 10 8 6 8 6" fill="#64748B" />
                <text x="26" y="23" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="22">Discord</text>
              </svg>
            </div>

            {/* 9. Gmail */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 4 8 L 14 16 L 24 8 L 24 22 L 4 22 Z" stroke="#64748B" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
                <path d="M 4 8 L 14 16 L 24 8" stroke="#64748B" strokeWidth="2.5" fill="none" />
                <text x="32" y="23" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="600" fontSize="22">Gmail</text>
              </svg>
            </div>

            {/* 10. Google Ads */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 6 22 L 14 6 L 22 22 Z" stroke="#64748B" strokeWidth="2.5" fill="none" />
                <circle cx="20" cy="20" r="4" fill="#64748B" />
                <text x="30" y="22" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="18">Google</text>
                <text x="94" y="22" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="400" fontSize="18">Ads</text>
              </svg>
            </div>

            {/* 11. Etsy */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="26" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="24" fill="#64748B" fontFamily="Georgia, serif" fontWeight="700" fontSize="28">Etsy</text>
              </svg>
            </div>

            {/* 12. Pinterest */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="26" viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="24" fill="#64748B" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="26">Pinterest</text>
              </svg>
            </div>

            {/* 13. Meta */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 6 16 C 6 10, 14 10, 18 16 C 22 22, 30 22, 30 16 C 30 10, 22 10, 18 16 C 14 22, 6 22, 6 16 Z" stroke="#64748B" strokeWidth="2.5" fill="none" />
                <text x="36" y="23" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="24">Meta</text>
              </svg>
            </div>

            {/* 14. X */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="26" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 10 6 L 25 24 M 25 6 L 10 24" stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* 15. Airbnb */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 14 6 C 10 6, 6 12, 6 18 C 6 22, 10 26, 14 26 C 18 26, 22 22, 22 18 C 22 12, 18 6, 14 6 Z M 14 14 C 12 14, 11 16, 11 18 C 11 20, 12 21, 14 21 C 16 21, 17 20, 17 18 C 17 16, 16 14, 14 14 Z" stroke="#64748B" strokeWidth="2" fill="none" />
                <text x="28" y="23" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="22">airbnb</text>
              </svg>
            </div>

            {/* 16. YouTube */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', border: '1px solid #F1F5F9' }} className="platform-card">
              <svg height="24" viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="6" width="26" height="18" rx="5" fill="#64748B" />
                <polygon points="12,10 20,15 12,20" fill="#F8FAFC" />
                <text x="34" y="22" fill="#64748B" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="22" letterSpacing="-0.5">YouTube</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. How It Works Timeline ── */}
      <section id="how-it-works" style={{ backgroundColor: '#14141F', borderTop: '1px solid #2C2C3E', borderBottom: '1px solid #2C2C3E', padding: '90px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px' }}>
              How AntiProfiles Works
            </h2>
            <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '600px', margin: '0 auto' }}>
              Get started in four easy steps and launch your isolated browser profiles in seconds.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            {steps.map((s: any) => (
              <div key={s.id} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '14px', padding: '24px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '12px', fontWeight: 800, color: accentColor, backgroundColor: `${accentColor}15`, padding: '4px 10px', borderRadius: '6px' }}>
                  STEP 0{s.step_number}
                </div>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>{s.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 10px' }}>{s.title}</h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download Desktop Application Section ── */}
      <section id="download" style={{ padding: '90px 24px', maxWidth: '1150px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}30`, color: accentColor, fontSize: '12px', fontWeight: 700, marginBottom: '20px' }}>
          <span>💻</span> Cross-Platform Desktop Client
        </div>

        <h2 style={{ fontSize: '36px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 16px' }}>
          Download Our Desktop Application
        </h2>

        <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '680px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          Manage your isolated browser profiles directly from your computer with native Windows and macOS performance.
        </p>

        {/* System OS / Architecture Auto-Detection Banner */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: '#161622',
          border: '1px solid #2C2C3E',
          marginBottom: '36px',
          fontSize: '13px'
        }}>
          <span style={{ color: '#10B981', fontWeight: 700 }}>✓ Auto-Detected System:</span>
          <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
            {detectedTarget === 'windows-x64' ? 'Windows 10/11 (64-bit x64)' : detectedTarget === 'macos-arm64' ? 'macOS Apple Silicon (M1/M2/M3/M4 arm64)' : 'macOS Intel (64-bit x64)'}
          </span>
        </div>

        {/* 4 Production Target Download Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {/* Target 1: Windows x64 */}
          <div style={{
            backgroundColor: '#161622',
            border: detectedTarget === 'windows-x64' ? `2px solid ${accentColor}` : '1px solid #2C2C3E',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: detectedTarget === 'windows-x64' ? `0 8px 30px ${accentColor}25` : undefined
          }}>
            {detectedTarget === 'windows-x64' && (
              <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'linear-gradient(135deg, #2DD4BF, #06B6D4)', color: '#0F0F17', fontSize: '10px', fontWeight: 900, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(45,212,191,0.4)' }}>
                RECOMMENDED FOR YOUR PC
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(0, 120, 212, 0.12)', border: '1px solid rgba(0, 120, 212, 0.25)' }}>
                  <svg width="24" height="24" viewBox="0 0 88 88" fill="none">
                    <path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/>
                  </svg>
                </div>
                <span style={{ fontSize: '10px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>WINDOWS</span>
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#F1F5F9', fontWeight: 700 }}>Windows Client</h3>
              <div style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 600, marginBottom: '8px' }}>v{appReleases?.win_app_version || '2.0.0'} (64-bit Architecture)</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
                Native installer for Windows 10 & 11 with automatic desktop shortcuts and HW acceleration.
              </p>
            </div>
            <a
              href={appReleases?.win_download_url || '/api/releases?download=1&platform=windows-x64'}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                backgroundColor: detectedTarget === 'windows-x64' ? accentColor : '#1C1C28',
                color: detectedTarget === 'windows-x64' ? '#0F0F17' : '#F1F5F9',
                fontWeight: 800,
                fontSize: '13px',
                textAlign: 'center',
                textDecoration: 'none',
                border: detectedTarget === 'windows-x64' ? 'none' : '1px solid #2C2C3E',
                boxShadow: detectedTarget === 'windows-x64' ? `0 4px 14px ${accentColor}40` : undefined
              }}
            >
              Download Windows .exe (v{appReleases?.win_app_version || '2.0.0'})
            </a>
          </div>

          {/* Target 2: macOS Apple Silicon arm64 */}
          <div style={{
            backgroundColor: '#161622',
            border: detectedTarget === 'macos-arm64' ? `2px solid ${accentColor}` : '1px solid #2C2C3E',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: detectedTarget === 'macos-arm64' ? `0 8px 30px ${accentColor}25` : undefined
          }}>
            {detectedTarget === 'macos-arm64' && (
              <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'linear-gradient(135deg, #2DD4BF, #06B6D4)', color: '#0F0F17', fontSize: '10px', fontWeight: 900, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(45,212,191,0.4)' }}>
                RECOMMENDED FOR YOUR MAC
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <svg width="22" height="22" viewBox="0 0 170 170" fill="none">
                    <path d="M150.37 130.25C146.59 135.79 142.34 141.05 137.62 146.03C131.18 152.83 124.97 158.4 118.99 162.74C111.02 168.51 103.35 171.4 96 171.4C90.72 171.4 84.77 169.89 78.15 166.87C71.53 163.85 65.41 162.34 59.79 162.34C53.79 162.34 47.45 163.95 40.77 167.17C34.09 170.39 28.53 172 24.1 172C16.94 172 9.27 169.01 1.09 163.04C-4.89 158.7 -11.05 153.18 -17.39 146.48C-26.17 137.22 -33.15 125.75 -38.33 112.07C-43.51 98.39 -46.1 84.8 -46.1 71.3C-46.1 56.4 -42.27 43.64 -34.61 33.02C-26.95 22.4 -16.98 17.09 -4.7 17.09C1.1 17.09 7.6 18.7 14.8 21.92C22 25.14 27.26 26.75 30.58 26.75C33.32 26.75 38.64 24.99 46.54 21.47C54.44 17.95 61.34 16.19 67.24 16.19C80.34 16.19 91.13 20.31 99.61 28.55C108.09 36.79 113.19 47.38 114.91 60.32C103.73 67.1 98.14 76.5 98.14 88.52C98.14 98.18 101.69 106.28 108.79 112.82C115.89 119.36 124.32 123.08 134.08 123.98C131.62 131.2 128.2 138.08 123.82 144.62L150.37 130.25ZM104.44 0C104.44 7.64 101.65 15.34 96.07 23.1C90.49 30.86 83.47 36.42 75.01 39.78C73.91 32.22 76.84 24.63 83.8 17.01C90.76 9.39 97.64 3.72 104.44 0Z" fill="#F8FAFC"/>
                  </svg>
                </div>
                <span style={{ fontSize: '10px', backgroundColor: 'rgba(45,212,191,0.15)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.3)', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>APPLE SILICON</span>
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#F1F5F9', fontWeight: 700 }}>macOS Silicon</h3>
              <div style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 600, marginBottom: '8px' }}>v{appReleases?.mac_arm_app_version || '2.0.0'} (M1 / M2 / M3 / M4)</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
                Native ARM64 build engineered specifically for Apple Silicon M-series processors for maximum speed.
              </p>
            </div>
            <a
              href={appReleases?.mac_arm_download_url || '/api/releases?download=1&platform=macos-arm64'}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                backgroundColor: detectedTarget === 'macos-arm64' ? accentColor : '#1C1C28',
                color: detectedTarget === 'macos-arm64' ? '#0F0F17' : '#F1F5F9',
                fontWeight: 800,
                fontSize: '13px',
                textAlign: 'center',
                textDecoration: 'none',
                border: detectedTarget === 'macos-arm64' ? 'none' : '1px solid #2C2C3E',
                boxShadow: detectedTarget === 'macos-arm64' ? `0 4px 14px ${accentColor}40` : undefined
              }}
            >
              Download Apple Silicon .dmg (v{appReleases?.mac_arm_app_version || '2.0.0'})
            </a>
          </div>

          {/* Target 3: macOS Intel x64 */}
          <div style={{
            backgroundColor: '#161622',
            border: detectedTarget === 'macos-x64' ? `2px solid ${accentColor}` : '1px solid #2C2C3E',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: detectedTarget === 'macos-x64' ? `0 8px 30px ${accentColor}25` : undefined
          }}>
            {detectedTarget === 'macos-x64' && (
              <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'linear-gradient(135deg, #2DD4BF, #06B6D4)', color: '#0F0F17', fontSize: '10px', fontWeight: 900, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(45,212,191,0.4)' }}>
                RECOMMENDED FOR YOUR MAC
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <svg width="22" height="22" viewBox="0 0 170 170" fill="none">
                    <path d="M150.37 130.25C146.59 135.79 142.34 141.05 137.62 146.03C131.18 152.83 124.97 158.4 118.99 162.74C111.02 168.51 103.35 171.4 96 171.4C90.72 171.4 84.77 169.89 78.15 166.87C71.53 163.85 65.41 162.34 59.79 162.34C53.79 162.34 47.45 163.95 40.77 167.17C34.09 170.39 28.53 172 24.1 172C16.94 172 9.27 169.01 1.09 163.04C-4.89 158.7 -11.05 153.18 -17.39 146.48C-26.17 137.22 -33.15 125.75 -38.33 112.07C-43.51 98.39 -46.1 84.8 -46.1 71.3C-46.1 56.4 -42.27 43.64 -34.61 33.02C-26.95 22.4 -16.98 17.09 -4.7 17.09C1.1 17.09 7.6 18.7 14.8 21.92C22 25.14 27.26 26.75 30.58 26.75C33.32 26.75 38.64 24.99 46.54 21.47C54.44 17.95 61.34 16.19 67.24 16.19C80.34 16.19 91.13 20.31 99.61 28.55C108.09 36.79 113.19 47.38 114.91 60.32C103.73 67.1 98.14 76.5 98.14 88.52C98.14 98.18 101.69 106.28 108.79 112.82C115.89 119.36 124.32 123.08 134.08 123.98C131.62 131.2 128.2 138.08 123.82 144.62L150.37 130.25ZM104.44 0C104.44 7.64 101.65 15.34 96.07 23.1C90.49 30.86 83.47 36.42 75.01 39.78C73.91 32.22 76.84 24.63 83.8 17.01C90.76 9.39 97.64 3.72 104.44 0Z" fill="#F8FAFC"/>
                  </svg>
                </div>
                <span style={{ fontSize: '10px', backgroundColor: 'rgba(148,163,184,0.15)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.3)', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>MACOS INTEL</span>
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#F1F5F9', fontWeight: 700 }}>macOS Intel</h3>
              <div style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 600, marginBottom: '8px' }}>v{appReleases?.mac_intel_app_version || '2.0.0'} (Intel Processors)</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
                Native macOS DMG package built for Intel Core i5/i7/i9 Mac computers manufactured before late 2020.
              </p>
            </div>
            <a
              href={appReleases?.mac_intel_download_url || '/api/releases?download=1&platform=macos-x64'}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                backgroundColor: detectedTarget === 'macos-x64' ? accentColor : '#1C1C28',
                color: detectedTarget === 'macos-x64' ? '#0F0F17' : '#F1F5F9',
                fontWeight: 800,
                fontSize: '13px',
                textAlign: 'center',
                textDecoration: 'none',
                border: detectedTarget === 'macos-x64' ? 'none' : '1px solid #2C2C3E',
                boxShadow: detectedTarget === 'macos-x64' ? `0 4px 14px ${accentColor}40` : undefined
              }}
            >
              Download macOS Intel .dmg (v{appReleases?.mac_intel_app_version || '2.0.0'})
            </a>
          </div>

          {/* Target 4: Linux x64 */}
          <div style={{
            backgroundColor: '#161622',
            border: detectedTarget === 'linux-x64' ? `2px solid ${accentColor}` : '1px solid #2C2C3E',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: detectedTarget === 'linux-x64' ? `0 8px 30px ${accentColor}25` : undefined
          }}>
            {detectedTarget === 'linux-x64' && (
              <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'linear-gradient(135deg, #2DD4BF, #06B6D4)', color: '#0F0F17', fontSize: '10px', fontWeight: 900, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(45,212,191,0.4)' }}>
                RECOMMENDED FOR YOUR LINUX
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(250, 204, 21, 0.12)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
                  <svg width="22" height="22" viewBox="0 0 448 512" fill="none">
                    <path d="M220.8 123.3c1 .5 1.8 1.7 3 1.7 1.1 0 2.8-.4 2.9-1.5.2-1.4-1.9-2.3-3.2-2.9-1.3-.7-2.9-1-4.3-.7-1.7.3-3.3 1.3-4.5 2.5-1.2 1.2-2.2 2.7-2.8 4.3-.6 1.6-.6 3.4-.2 5 .4 1.7 1.4 3.1 2.8 4.1 1.4 1 3.2 1.5 5 1.4 1.7-.1 3.4-.8 4.7-1.9 1.3-1.1 2.2-2.6 2.5-4.3.3-1.7-.1-3.4-1-4.9-.9-1.4-2.3-2.5-3.9-3-1.6-.4-3.3-.3-4.8.4zm-20.2 133.7c-5.8 4.2-12.8 6.5-20 6.5s-14.2-2.3-20-6.5c-4.4-3.2-8-7.3-10.7-12-3.4 10.6-4.5 22-3.1 33.1 2.3 18.2 10.3 35.1 23 48 12.8 12.8 29.7 20.8 48 23 11.1 1.4 22.5.3 33.1-3.1-4.7-2.7-8.8-6.3-12-10.7-4.2-5.8-6.5-12.8-6.5-20s2.3-14.2 6.5-20c2.7-3.7 6-6.8 9.8-9.2-8.5-17.7-21.9-32.3-38.4-42.1-3.1 5.3-5.7 11-7.7 17-2.1-6-4.7-11.7-7.7-17-16.5 9.8-29.9 24.4-38.4 42.1 3.8 2.4 7.1 5.5 9.8 9.2zm148.9-80.1C336.7 82.2 284.1 0 224 0S111.3 82.2 98.5 176.9c-27.4 18.7-44.5 49.3-46.5 82.6-.9 14.5 2.1 29 8.6 42 6.5 13 16.3 23.8 28.3 31.2 2.6 47.9 21.6 93.6 54 128.5 32.4 34.9 76.9 55.4 123.6 57.8 23.3 1.2 46.8-2.6 68.7-11.1 21.9-8.5 41.7-21.6 58-38.3 16.3-16.7 28.6-36.8 36.1-59 7.5-22.1 10.3-45.7 8.3-69 12-7.4 21.8-18.2 28.3-31.2 6.5-13 9.5-27.5 8.6-42-2-33.3-19.1-63.9-46.5-82.6z" fill="#FACC15"/>
                  </svg>
                </div>
                <span style={{ fontSize: '10px', backgroundColor: 'rgba(234,179,8,0.15)', color: '#FACC15', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>LINUX</span>
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#F1F5F9', fontWeight: 700 }}>Linux Client</h3>
              <div style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 600, marginBottom: '8px' }}>v{appReleases?.linux_app_version || '2.0.0'} (AppImage & .deb)</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
                Standalone binary package for Ubuntu, Debian, Fedora, Arch & openSUSE distributions.
              </p>
            </div>
            <a
              href={appReleases?.linux_download_url || '/api/releases?download=1&platform=linux-x64'}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                backgroundColor: detectedTarget === 'linux-x64' ? accentColor : '#1C1C28',
                color: detectedTarget === 'linux-x64' ? '#0F0F17' : '#F1F5F9',
                fontWeight: 800,
                fontSize: '13px',
                textAlign: 'center',
                textDecoration: 'none',
                border: detectedTarget === 'linux-x64' ? 'none' : '1px solid #2C2C3E',
                boxShadow: detectedTarget === 'linux-x64' ? `0 4px 14px ${accentColor}40` : undefined
              }}
            >
              Download Linux .AppImage (v{appReleases?.linux_app_version || '2.0.0'})
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowArchHelpModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#60A5FA',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            ❓ Which version should I download?
          </button>
        </div>
      </section>

      {/* Which Version Should I Download Modal */}
      {showArchHelpModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '540px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '28px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #2C2C3E', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#F1F5F9' }}>Which version should I download?</h3>
              <button type="button" onClick={() => setShowArchHelpModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
              <div style={{ padding: '12px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
                <strong style={{ color: '#60A5FA' }}>🪟 Windows (64-bit):</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>Select this if you run Windows 10 or Windows 11 on an Intel or AMD 64-bit processor.</p>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
                <strong style={{ color: '#F59E0B' }}>🍏 Mac — Apple Silicon (M1/M2/M3/M4):</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>Select this if your Mac was made late 2020 or newer and has an Apple M1, M2, M3, or M4 chip. To check: click  Apple Logo → <strong>About This Mac</strong> → look for <em>Chip: Apple M...</em></p>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
                <strong style={{ color: '#10B981' }}>🍏 Mac — Intel:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>Select this if your Mac has an Intel Core i5, i7, or i9 processor (typically models made before late 2020).</p>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                <strong style={{ color: '#60A5FA' }}>💡 macOS Gatekeeper / "App is damaged" Fix:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  If macOS shows <em>"AntiProfiles is damaged and can't be opened"</em>, open Terminal and run: <code style={{ color: '#34D399', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>xattr -cr /Applications/AntiProfiles.app</code>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowArchHelpModal(false)}
              style={{ width: '100%', marginTop: '20px', padding: '10px', borderRadius: '8px', backgroundColor: accentColor, color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              Got it, close guide
            </button>
          </div>
        </div>
      )}

      {/* ── 6. Pricing System with Toggle ── */}
      <section id="pricing" style={{ padding: '90px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px' }}>
            Transparent & Flexible Pricing
          </h2>
          <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '600px', margin: '0 auto 24px' }}>
            Choose the plan that fits your workflow. Scale or downgrade anytime.
          </p>

          {/* Billing Cycle Switcher */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', padding: '4px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: billingCycle === 'monthly' ? accentColor : 'transparent',
                color: billingCycle === 'monthly' ? '#0F0F17' : '#94A3B8',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: billingCycle === 'yearly' ? accentColor : 'transparent',
                color: billingCycle === 'yearly' ? '#0F0F17' : '#94A3B8',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Yearly Billing <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#10B98130', color: '#10B981' }}>Save 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
          {pricingPlans.map((plan: any) => {
            const price = billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price
            const isTrial = isPlanTrialActive(plan)
            const buttonLabel = isTrial ? `🎁 Start ${trialDays}-Day Free Trial` : (plan.monthly_price === 0 ? 'Start Free' : plan.button_text || `⚡ Pay & Upgrade (${plan.currency}${price})`)
            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: plan.is_popular ? '#1C1C2B' : '#161622',
                  border: isTrial ? `2px solid ${accentColor}` : (plan.is_popular ? `2px solid ${accentColor}` : '1px solid #2C2C3E'),
                  borderRadius: '16px',
                  padding: '32px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: isTrial ? `0 8px 30px ${accentColor}25` : undefined
                }}
              >
                {isTrial ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #2DD4BF, #06B6D4)',
                    color: '#0F0F17',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '4px 14px',
                    borderRadius: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 12px rgba(45, 212, 191, 0.4)',
                    whiteSpace: 'nowrap'
                  }}>
                    🎁 {trialDays}-DAY FREE TRIAL AVAILABLE
                  </div>
                ) : plan.badge ? (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: accentColor,
                    color: '#0F0F17',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '4px 14px',
                    borderRadius: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {plan.badge}
                  </div>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>{plan.name}</h3>
                  {isTrial && (
                    <span style={{ backgroundColor: `${accentColor}25`, color: accentColor, border: `1px solid ${accentColor}50`, borderRadius: '10px', fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
                      Trial Active
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px', minHeight: '36px' }}>{plan.description}</p>

                <div style={{ margin: '0 0 24px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#F8FAFC' }}>{plan.currency}{price}</span>
                  <span style={{ fontSize: '13px', color: '#64748B' }}> / month</span>
                  {billingCycle === 'yearly' && price > 0 && (
                    <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>Billed annually ({plan.yearly_discount}% off)</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onNavigateRegister}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: isTrial ? accentColor : (plan.is_popular ? accentColor : '#14141F'),
                    border: isTrial || plan.is_popular ? 'none' : '1px solid #2C2C3E',
                    color: isTrial || plan.is_popular ? '#0F0F17' : '#F1F5F9',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginBottom: '24px',
                    boxShadow: isTrial ? `0 4px 14px ${accentColor}40` : undefined
                  }}
                >
                  {buttonLabel}
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #2C2C3E', paddingTop: '20px' }}>
                  {plan.features.map((feat: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#CBD5E1' }}>
                      <span style={{ color: accentColor }}>✓</span>
                      <span>{feat.feature_name}: <strong>{feat.feature_value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 7. Pricing Comparison Table Matrix ── */}
      <section style={{ backgroundColor: '#14141F', borderTop: '1px solid #2C2C3E', borderBottom: '1px solid #2C2C3E', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#F8FAFC', textAlign: 'center', marginBottom: '32px' }}>
            Plan Feature Comparison Matrix
          </h3>

          <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#14141F', borderBottom: '1px solid #2C2C3E', color: '#94A3B8' }}>
                  <th style={{ padding: '16px 20px' }}>Feature</th>
                  {pricingPlans.map((p: any) => (
                    <th key={p.id} style={{ padding: '16px 20px', textAlign: 'center' }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'profile_limit', name: 'Browser Profiles', render: (p: any) => p.profile_limit },
                  { key: 'team_limit', name: 'Team Members', render: (p: any) => `${p.team_limit} ${p.team_limit === 1 ? 'User' : 'Users'}` },
                  { key: 'api_limit', name: 'Automation API', render: (p: any) => p.api_limit },
                  { key: 'proxy', name: 'Proxy Support', render: () => '✓' },
                  { key: 'fingerprint', name: 'Fingerprint Control', render: (p: any) => p.monthly_price > 0 ? 'Advanced' : 'Basic' }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #2C2C3E10' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#F1F5F9' }}>{row.name}</td>
                    {pricingPlans.map((p: any) => (
                      <td key={p.id} style={{ padding: '14px 20px', textAlign: 'center', color: '#CBD5E1' }}>
                        {row.render(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 8. FAQ Accordion Section ── */}
      <section id="faq" style={{ padding: '90px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px' }}>
            Frequently Asked Questions
          </h2>
          <p style={{ fontSize: '15px', color: '#94A3B8' }}>
            Have questions about AntiProfiles? Find answers below.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {faqs.map((faq: any) => {
            const isOpen = openFaq === faq.id
            return (
              <div key={faq.id} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                  style={{
                    width: '100%',
                    padding: '18px 20px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#F1F5F9',
                    fontWeight: 700,
                    fontSize: '15px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{faq.question}</span>
                  <span style={{ fontSize: '18px', color: accentColor }}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 20px 20px', fontSize: '14px', color: '#94A3B8', lineHeight: 1.6, borderTop: '1px solid #2C2C3E30', paddingTop: '14px' }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 9. Testimonials ── */}
      <section style={{ backgroundColor: '#14141F', borderTop: '1px solid #2C2C3E', borderBottom: '1px solid #2C2C3E', padding: '90px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px' }}>
              Trusted by Professionals World-Wide
            </h2>
            <p style={{ fontSize: '15px', color: '#94A3B8' }}>
              See what engineers, agencies, and security researchers say about AntiProfiles.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {testimonials.map((t: any) => (
              <div key={t.id} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '14px', color: '#F59E0B' }}>
                      {'★'.repeat(t.rating)}
                    </div>
                    {t.is_demo === 1 && (
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#2C2C3E', color: '#64748B' }}>
                        Demo Content
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '14px', color: '#CBD5E1', lineHeight: 1.6, margin: '0 0 20px', italic: 'true' }}>
                    "{t.testimonial}"
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#14141F', border: '1px solid #2C2C3E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    {t.avatar_url}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{t.position} at {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9.5. AI Search & Answer Engine Optimization (AEO/GEO) Structured Knowledge Block ── */}
      <section id="ai-overview" style={{ padding: '80px 24px', backgroundColor: '#09090D', borderBottom: '1px solid #2C2C3E' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: accentColor, backgroundColor: `${accentColor}15`, padding: '4px 12px', borderRadius: '12px', letterSpacing: '1px' }}>
              MACHINE & AI READABILITY LAYER
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#F8FAFC', margin: '10px 0 8px' }}>
              AntiProfiles Platform Specifications & AI Search Knowledge Base
            </h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', maxWidth: '650px', margin: '0 auto' }}>
              Verified factual overview structured for web indexers, search engines, and AI answer systems (ChatGPT, Gemini, Perplexity, Copilot, Claude).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: accentColor, fontWeight: 700 }}>What is AntiProfiles?</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                AntiProfiles is an anti-detect browser and multi-account management application. It enables users to run multiple isolated Chromium browser sessions with distinct digital fingerprints (Canvas, WebGL, WebRTC, RAM, CPU cores) and dedicated proxies.
              </p>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: accentColor, fontWeight: 700 }}>Who is AntiProfiles for?</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                Built for digital marketing agencies, e-commerce sellers, social media managers, affiliate marketers, and security researchers managing multiple client or business accounts safely.
              </p>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: accentColor, fontWeight: 700 }}>What problem does it solve?</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                It prevents account bans and cross-profile correlation caused by browser fingerprinting, shared cookie stores, IP overlaps, and WebRTC leaks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. Contact Section & Form ── */}
      <section id="contact" style={{ padding: '90px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px' }}>
              Get in Touch with Our Team
            </h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 32px' }}>
              Have custom enterprise requirements or need technical assistance? Contact our team directly.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '10px', backgroundColor: '#161622', border: '1px solid #2C2C3E' }}>
                <span style={{ fontSize: '20px' }}>✉️</span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Email Support</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>{branding.contact_email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '10px', backgroundColor: '#161622', border: '1px solid #2C2C3E' }}>
                <span style={{ fontSize: '20px' }}>✈️</span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Telegram Community</div>
                  <a href={branding.contact_telegram} target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: accentColor, textDecoration: 'none' }}>Join Telegram Support</a>
                </div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Send a Message</h3>
            
            {contactSubmitted && (
              <div style={{ backgroundColor: '#10B98115', border: '1px solid #10B98150', color: '#10B981', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                ✓ Message submitted successfully! Our team will contact you shortly.
              </div>
            )}

            <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Your Name"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="Your Email"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
              <input
                type="text"
                required
                value={contactForm.subject}
                onChange={e => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="Subject"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
              <textarea
                required
                rows={4}
                value={contactForm.message}
                onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Your Message..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', resize: 'none' }}
              />
              <button
                type="submit"
                disabled={contactSending}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: accentColor, color: '#0F0F17', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}
              >
                {contactSending ? 'Sending Message...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── 11. Footer ── */}
      <footer style={{ borderTop: '1px solid #2C2C3E', backgroundColor: '#0A0A0F', padding: '60px 24px 30px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '22px' }}>🛡️</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#F1F5F9' }}>{branding.site_name}</span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6, margin: 0 }}>
              Professional browser profile isolation and anti-detect privacy management software.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 14px' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <a href="#features" style={{ color: '#94A3B8', textDecoration: 'none' }}>Features</a>
              <a href="#pricing" style={{ color: '#94A3B8', textDecoration: 'none' }}>Pricing</a>
              <a href="#showcase" style={{ color: '#94A3B8', textDecoration: 'none' }}>Preview</a>
              <a href="#faq" style={{ color: '#94A3B8', textDecoration: 'none' }}>FAQ</a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 14px' }}>Social & Links</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              {branding.twitter_url && <a href={branding.twitter_url} target="_blank" rel="noreferrer" style={{ color: '#94A3B8', textDecoration: 'none' }}>Twitter / X</a>}
              {branding.facebook_url && <a href={branding.facebook_url} target="_blank" rel="noreferrer" style={{ color: '#94A3B8', textDecoration: 'none' }}>Facebook</a>}
              {branding.linkedin_url && <a href={branding.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#94A3B8', textDecoration: 'none' }}>LinkedIn</a>}
              {branding.youtube_url && <a href={branding.youtube_url} target="_blank" rel="noreferrer" style={{ color: '#94A3B8', textDecoration: 'none' }}>YouTube</a>}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 14px' }}>Account</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <button type="button" onClick={onNavigateLogin} style={{ background: 'none', border: 'none', color: '#94A3B8', textAlign: 'left', cursor: 'pointer', padding: 0 }}>Sign In</button>
              <button type="button" onClick={onNavigateRegister} style={{ background: 'none', border: 'none', color: accentColor, textAlign: 'left', cursor: 'pointer', padding: 0, fontWeight: 700 }}>Create Free Account</button>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #2C2C3E30', paddingTop: '24px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>
          © {new Date().getFullYear()} {branding.site_name || 'AntiProfiles'}. All rights reserved.
        </div>
      </footer>

      {/* Floating Live Support Chat Widget for Landing Page Visitors */}
      <SupportChatWidget />
    </div>
  )
}
