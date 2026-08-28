// ──────────────────────────────────────────────
// AntiProfiles — Admin SEO & AI Search Optimization (AEO/GEO) Manager
// ──────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react'

interface AdminSeoManagerProps {
  sessionToken: string
}

export const AdminSeoManager: React.FC<AdminSeoManagerProps> = ({ sessionToken }) => {
  const [activeTab, setActiveTab] = useState<
    'settings' | 'pages' | 'content_assistant' | 'keywords' | 'entity' | 'robots' | 'sitemap' | 'audit' | 'redirects'
  >('audit')

  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [pages, setPages] = useState<any[]>([])
  const [selectedPage, setSelectedPage] = useState<any | null>(null)

  // Keywords state
  const [keywordsData, setKeywordsData] = useState<{ keywords: any[]; warnings: any[] }>({ keywords: [], warnings: [] })
  const [newKw, setNewKw] = useState({ keyword: '', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' })
  const [kwSearch, setKwSearch] = useState('')
  const [kwCategoryFilter, setKwCategoryFilter] = useState<'all' | 'affiliate' | 'privacy' | 'proxy' | 'competitor' | 'os'>('all')
  const [seedingKeywords, setSeedingKeywords] = useState(false)

  // Redirects & 404 state
  const [redirects, setRedirects] = useState<any[]>([])
  const [newRed, setNewRed] = useState({ source_path: '', target_path: '', status_code: 301 })
  const [logs404, setLogs404] = useState<any[]>([])

  // Audit state
  const [auditReport, setAuditReport] = useState<any | null>(null)
  const [auditing, setAuditing] = useState(false)

  // Content Assistant state
  const [caInput, setCaInput] = useState({ keyword: 'anti detect browser', topic: 'Profile isolation and proxy setup', intent: 'commercial' })
  const [caResult, setCaResult] = useState<any | null>(null)
  const [caLoading, setCaLoading] = useState(false)

  // Page Editor State
  const [pageForm, setPageForm] = useState({
    id: '',
    page_path: '/',
    title: '',
    description: '',
    keywords: '',
    canonical_url: '',
    robots: 'index, follow',
    og_title: '',
    og_description: '',
    og_image: '',
    schema_type: 'SoftwareApplication',
    primary_keyword: '',
    ai_quick_answer: ''
  })

  // Load Initial SEO Data
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncResult, setSyncResult] = useState<any | null>(null)
  const [sitemapXmlPreview, setSitemapXmlPreview] = useState<string>('')
  const [robotsTxtPreview, setRobotsTxtPreview] = useState<string>('')

  // Top-level filtered keywords calculation
  const filteredKeywords = useMemo(() => {
    return (keywordsData.keywords || []).filter((k: any) => {
      const text = (k.keyword || '').toLowerCase()
      if (kwSearch && !text.includes(kwSearch.toLowerCase())) return false
      if (kwCategoryFilter === 'affiliate') {
        return text.includes('affiliate') || text.includes('cpa') || text.includes('marketing') || text.includes('media buying') || text.includes('facebook') || text.includes('tiktok') || text.includes('instagram') || text.includes('ads') || text.includes('dropshipping') || text.includes('amazon') || text.includes('e-commerce') || text.includes('agency')
      }
      if (kwCategoryFilter === 'privacy') {
        return text.includes('fingerprint') || text.includes('canvas') || text.includes('webgl') || text.includes('audio') || text.includes('user agent') || text.includes('timezone') || text.includes('font') || text.includes('screen') || text.includes('webrtc') || text.includes('dns') || text.includes('isolation') || text.includes('cookie') || text.includes('privacy') || text.includes('anonymous') || text.includes('masking')
      }
      if (kwCategoryFilter === 'proxy') {
        return text.includes('proxy') || text.includes('socks') || text.includes('http') || text.includes('residential') || text.includes('mobile') || text.includes('rotating')
      }
      if (kwCategoryFilter === 'competitor') {
        return text.includes('alternative') || text.includes('gologin') || text.includes('adspower') || text.includes('multilogin') || text.includes('dolphin') || text.includes('incogniton') || text.includes('vmlogin') || text.includes('kameleo') || text.includes('hidemyacc') || text.includes('octo') || text.includes('morelogin')
      }
      if (kwCategoryFilter === 'os') {
        return text.includes('windows') || text.includes('mac') || text.includes('linux') || text.includes('silicon') || text.includes('cross platform')
      }
      return true
    })
  }, [keywordsData.keywords, kwSearch, kwCategoryFilter])

  const loadSeoData = async () => {
    setLoading(true)
    try {
      if (typeof window !== 'undefined' && (window as any).api) {
        const api = (window as any).api

        if (typeof api.seoGetSettings === 'function') {
          const res = await api.seoGetSettings(sessionToken)
          if (res?.success) setSettings(res.data)
        }

        if (typeof api.seoGetPages === 'function') {
          const res = await api.seoGetPages(sessionToken)
          if (res?.success && res.data) {
            setPages(res.data)
            if (res.data.length > 0 && !selectedPage) {
              setSelectedPage(res.data[0])
              setPageForm(res.data[0])
            }
          }
        }

        if (typeof api.seoGetKeywords === 'function') {
          const res = await api.seoGetKeywords(sessionToken)
          if (res?.success) setKeywordsData(res.data)
        }

        if (typeof api.seoGetRedirects === 'function') {
          const res = await api.seoGetRedirects(sessionToken)
          if (res?.success) setRedirects(res.data)
        }

        if (typeof api.seoGet404Logs === 'function') {
          const res = await api.seoGet404Logs(sessionToken)
          if (res?.success) setLogs404(res.data)
        }

        if (typeof api.seoGetLatestAudit === 'function') {
          const res = await api.seoGetLatestAudit(sessionToken)
          if (res?.success) setAuditReport(res.data)
        }

        if (typeof api.seoGetSitemapXml === 'function') {
          const res = await api.seoGetSitemapXml(settings.site_url || 'https://antiprofiles.com')
          if (res?.success) setSitemapXmlPreview(res.data)
        }
      }
    } catch (err) {
      console.error('Error loading SEO data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Master One-Click: Generate Sitemap, Robots.txt, and Sync to Google & All AI Engines
  const handleGenerateAndSyncAll = async () => {
    setSyncingAll(true)
    try {
      let res: any = null
      if ((window as any).api?.seoGenerateAndSyncAll) {
        res = await (window as any).api.seoGenerateAndSyncAll(sessionToken, settings.site_url || 'https://antiprofiles.com')
      } else {
        res = await fetch('/api/seo.php?action=generate-and-sync-all', {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }).then(r => r.json())
      }
      if (res?.success) {
        setSyncResult(res.data)
        if (res.data?.sitemapXml) setSitemapXmlPreview(res.data.sitemapXml)
        if (res.data?.robotsTxt) {
          setRobotsTxtPreview(res.data.robotsTxt)
          setSettings(prev => ({ ...prev, robots_content: res.data.robotsTxt }))
        }
        alert('✓ Sitemap & Robots.txt successfully generated and submitted to Google, Bing, IndexNow & AI engines!')
        loadSeoData()
      } else {
        alert(`Sync failed: ${res?.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert(`Sync error: ${err.message}`)
    } finally {
      setSyncingAll(false)
    }
  }

  // Generate standard AI-compliant Robots.txt
  const handleGenerateRobotsTxt = async () => {
    try {
      if ((window as any).api?.seoGenerateRobotsTxt) {
        const res = await (window as any).api.seoGenerateRobotsTxt(settings.site_url || 'https://antiprofiles.com')
        if (res?.success) {
          setSettings(prev => ({ ...prev, robots_content: res.data }))
          alert('✓ AI & Search Engine compliant robots.txt rules generated and saved!')
        }
      } else {
        const res = await fetch('/api/seo.php?action=generate-robots-txt', {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }).then(r => r.json())
        if (res?.success) {
          setSettings(prev => ({ ...prev, robots_content: res.data }))
          alert('✓ AI & Search Engine compliant robots.txt rules generated and saved!')
        }
      }
    } catch (err: any) {
      alert(`Robots generator error: ${err.message}`)
    }
  }

  // Seed Default High-Volume Keywords
  const handleSeedDefaultKeywords = async () => {
    setSeedingKeywords(true)
    try {
      if ((window as any).api?.seoSeedDefaultKeywords) {
        const res = await (window as any).api.seoSeedDefaultKeywords(sessionToken)
        if (res?.success) {
          alert(`✓ Successfully loaded 50+ high-volume SEO & competitor keywords into the indexing system!`)
          loadSeoData()
        }
      } else {
        const res = await fetch('/api/seo.php?action=seed-default-keywords', {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }).then(r => r.json())
        if (res?.success) {
          alert(`✓ Successfully loaded 50+ high-volume SEO & competitor keywords into the indexing system!`)
          loadSeoData()
        }
      }
    } catch (err: any) {
      alert(`Error seeding keywords: ${err.message}`)
    } finally {
      setSeedingKeywords(false)
    }
  }

  useEffect(() => {
    loadSeoData()
  }, [sessionToken])

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      if ((window as any).api?.seoSaveSettings) {
        const res = await (window as any).api.seoSaveSettings(sessionToken, settings)
        if (res?.success) {
          alert('✓ Global SEO & AEO settings saved successfully!')
          loadSeoData()
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  // Save Page SEO
  const handleSavePageSeo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if ((window as any).api?.seoSavePage) {
        const res = await (window as any).api.seoSavePage(sessionToken, pageForm)
        if (res?.success) {
          alert('✓ Page SEO saved successfully!')
          loadSeoData()
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  // Run Site Audit
  const handleRunAudit = async () => {
    setAuditing(true)
    try {
      if ((window as any).api?.seoRunAudit) {
        const res = await (window as any).api.seoRunAudit(sessionToken)
        if (res?.success) {
          setAuditReport(res.data)
        }
      }
    } catch (err: any) {
      alert(`Audit error: ${err.message}`)
    } finally {
      setAuditing(false)
    }
  }

  // Content Assistant
  const handleGenerateContentAssistant = async (e: React.FormEvent) => {
    e.preventDefault()
    setCaLoading(true)
    try {
      if ((window as any).api?.seoGenerateContentAssistant) {
        const res = await (window as any).api.seoGenerateContentAssistant(sessionToken, caInput)
        if (res?.success) setCaResult(res.data)
      }
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`)
    } finally {
      setCaLoading(false)
    }
  }

  // Add Keyword
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKw.keyword.trim()) return
    try {
      if ((window as any).api?.seoSaveKeyword) {
        const res = await (window as any).api.seoSaveKeyword(sessionToken, newKw)
        if (res?.success) {
          setNewKw({ keyword: '', keyword_type: 'primary', search_intent: 'commercial', target_url: '/' })
          loadSeoData()
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  // Delete Keyword
  const handleDeleteKeyword = async (id: string) => {
    if (!confirm('Delete this target keyword?')) return
    try {
      if ((window as any).api?.seoDeleteKeyword) {
        await (window as any).api.seoDeleteKeyword(sessionToken, id)
        loadSeoData()
      }
    } catch {}
  }

  // Add Redirect
  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRed.source_path.trim() || !newRed.target_path.trim()) return
    try {
      if ((window as any).api?.seoSaveRedirect) {
        const res = await (window as any).api.seoSaveRedirect(sessionToken, newRed)
        if (res?.success) {
          setNewRed({ source_path: '', target_path: '', status_code: 301 })
          loadSeoData()
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const isRobotsDangerous = (settings.robots_content || '').includes('Disallow: /') && !(settings.robots_content || '').includes('Disallow: /admin')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#F1F5F9' }}>
      
      {/* ── Top Header Navigation Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2C2C3E', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#F1F5F9' }}>
            🔍 Google SEO & AI Search Optimization (AEO/GEO)
          </h2>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
            Technical SEO, Schema.org JSON-LD, Search Engine Crawlability & AI Answer Engine Optimization (ChatGPT, Gemini, Perplexity, Claude)
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={auditing}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              backgroundColor: '#2DD4BF',
              color: '#0F0F17',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{auditing ? '⌛ Auditing...' : '⚡ Run Site Audit'}</span>
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: '#14141F', padding: '6px', borderRadius: '10px', border: '1px solid #2C2C3E' }}>
        {[
          { id: 'audit', label: '📊 Site Audit & Score' },
          { id: 'settings', label: '⚙️ Global Settings' },
          { id: 'pages', label: '📄 Page SEO & Snippets' },
          { id: 'content_assistant', label: '💡 Content Assistant' },
          { id: 'keywords', label: '🔑 Keywords & Cannibalization' },
          { id: 'entity', label: '🏢 Entity & Brand' },
          { id: 'robots', label: '🤖 Robots.txt' },
          { id: 'sitemap', label: '🗺️ Sitemap & llms.txt' },
          { id: 'redirects', label: '🔀 Redirects & 404s' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === t.id ? '#2DD4BF20' : 'transparent',
              color: activeTab === t.id ? '#2DD4BF' : '#94A3B8',
              fontWeight: activeTab === t.id ? 800 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: SITE AUDIT & SCORE ── */}
      {activeTab === 'audit' && auditReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Score Header Card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: '24px',
            backgroundColor: '#161622',
            border: '1px solid #2C2C3E',
            borderRadius: '14px',
            padding: '24px',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center', borderRight: '1px solid #2C2C3E', paddingRight: '24px' }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 900,
                color: auditReport.score >= 80 ? '#10B981' : auditReport.score >= 60 ? '#F59E0B' : '#EF4444'
              }}>
                {auditReport.score}/100
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', marginTop: '4px' }}>SEO & AEO HEALTH SCORE</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ backgroundColor: '#EF444415', border: '1px solid #EF444440', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#EF4444' }}>{auditReport.criticalCount}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F87171' }}>CRITICAL ISSUES</div>
              </div>
              <div style={{ backgroundColor: '#F59E0B15', border: '1px solid #F59E0B40', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#F59E0B' }}>{auditReport.warningCount}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#FBBF24' }}>WARNINGS</div>
              </div>
              <div style={{ backgroundColor: '#10B98115', border: '1px solid #10B98140', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981' }}>{auditReport.passedCount}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#34D399' }}>PASSED CHECKS</div>
              </div>
            </div>
          </div>

          {/* Audit Recommendation Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>AUDIT RECOMMENDATIONS & CHECKS</h3>
            {auditReport.items?.map((item: any) => (
              <div
                key={item.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#161622',
                  border: `1px solid ${item.type === 'critical' ? '#EF444460' : item.type === 'warning' ? '#F59E0B60' : '#2C2C3E'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: item.type === 'critical' ? '#EF444420' : item.type === 'warning' ? '#F59E0B20' : '#10B98120',
                      color: item.type === 'critical' ? '#F87171' : item.type === 'warning' ? '#FBBF24' : '#34D399'
                    }}>
                      {item.type.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>{item.description}</div>
                  <div style={{ fontSize: '12px', color: '#2DD4BF', marginTop: '6px', fontWeight: 600 }}>💡 Action: {item.recommendation}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ── TAB 2: GLOBAL SETTINGS ── */}
      {activeTab === 'settings' && (
        <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F1F5F9' }}>Global SEO & AEO System Controls</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { key: 'seo_enabled', label: 'Enable Technical SEO Engine' },
              { key: 'schema_enabled', label: 'Enable Schema.org JSON-LD Generation' },
              { key: 'sitemap_enabled', label: 'Enable Dynamic XML Sitemap (/sitemap.xml)' },
              { key: 'robots_enabled', label: 'Enable Robots.txt Directives (/robots.txt)' },
              { key: 'og_enabled', label: 'Enable Open Graph & Twitter Cards' },
              { key: 'ai_aeo_enabled', label: 'Enable AI Search & Answer Engine Optimization (AEO)' },
              { key: 'internal_links_enabled', label: 'Enable Internal Link Analyzer' },
              { key: 'seo_audit_enabled', label: 'Enable Automated SEO Site Audit' }
            ].map(ctrl => (
              <label key={ctrl.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E', cursor: 'pointer' }}>
                <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: 600 }}>{ctrl.label}</span>
                <input
                  type="checkbox"
                  checked={settings[ctrl.key] === '1'}
                  onChange={e => setSettings({ ...settings, [ctrl.key]: e.target.checked ? '1' : '0' })}
                  style={{ width: '18px', height: '18px', accentColor: '#2DD4BF' }}
                />
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>SITE NAME</label>
              <input
                type="text"
                value={settings.site_name || ''}
                onChange={e => setSettings({ ...settings, site_name: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>DEFAULT META DESCRIPTION</label>
              <textarea
                rows={2}
                value={settings.site_description || ''}
                onChange={e => setSettings({ ...settings, site_description: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', resize: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>PRIMARY CANONICAL SITE URL</label>
              <input
                type="text"
                value={settings.site_url || ''}
                onChange={e => setSettings({ ...settings, site_url: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            💾 Save Global Settings
          </button>
        </div>
      )}

      {/* ── TAB 3: PAGE SEO & GOOGLE SNIPPET PREVIEW ── */}
      {activeTab === 'pages' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
          
          {/* Page Selector Sidebar */}
          <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', marginBottom: '6px' }}>SELECT PAGE</div>
            {pages.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedPage(p); setPageForm(p) }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  textAlign: 'left',
                  backgroundColor: selectedPage?.id === p.id ? '#2DD4BF20' : '#14141F',
                  color: selectedPage?.id === p.id ? '#2DD4BF' : '#CBD5E1',
                  fontWeight: selectedPage?.id === p.id ? 700 : 400,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {p.page_path} ({p.title.substring(0, 18)}...)
              </button>
            ))}
          </div>

          {/* Page Form & Google Live Search Snippet Preview */}
          <form onSubmit={handleSavePageSeo} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F1F5F9' }}>
              Editing Page SEO — Path: <span style={{ color: '#2DD4BF' }}>{pageForm.page_path}</span>
            </h3>

            {/* Google Live Search Preview Widget */}
            <div style={{ backgroundColor: '#1E1E2E', border: '1px solid #313244', borderRadius: '10px', padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', marginBottom: '8px' }}>🔍 GOOGLE SEARCH RESULT PREVIEW</div>
              <div style={{ fontSize: '14px', color: '#BDC3C7', marginBottom: '2px' }}>{settings.site_name || 'AntiProfiles'}</div>
              <div style={{ fontSize: '18px', color: '#8AB4F8', fontWeight: 600, cursor: 'pointer', marginBottom: '4px' }}>
                {pageForm.title || 'Page Title Preview'}
              </div>
              <div style={{ fontSize: '13px', color: '#202124', backgroundColor: '#E8EAED', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px', fontFamily: 'monospace' }}>
                {pageForm.canonical_url || `https://antiprofiles.com${pageForm.page_path}`}
              </div>
              <div style={{ fontSize: '13px', color: '#BDC3C7', lineHeight: 1.5 }}>
                {pageForm.description || 'Page meta description preview will appear here...'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>SEO TITLE ({pageForm.title?.length || 0} chars)</label>
                <input
                  type="text"
                  required
                  value={pageForm.title || ''}
                  onChange={e => setPageForm({ ...pageForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>PRIMARY KEYWORD</label>
                <input
                  type="text"
                  value={pageForm.primary_keyword || ''}
                  onChange={e => setPageForm({ ...pageForm, primary_keyword: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>META DESCRIPTION ({pageForm.description?.length || 0} chars)</label>
              <textarea
                rows={3}
                required
                value={pageForm.description || ''}
                onChange={e => setPageForm({ ...pageForm, description: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>CANONICAL URL</label>
                <input
                  type="text"
                  value={pageForm.canonical_url || ''}
                  onChange={e => setPageForm({ ...pageForm, canonical_url: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>ROBOTS DIRECTIVE</label>
                <select
                  value={pageForm.robots || 'index, follow'}
                  onChange={e => setPageForm({ ...pageForm, robots: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                >
                  <option value="index, follow">index, follow (Default)</option>
                  <option value="noindex, follow">noindex, follow</option>
                  <option value="index, nofollow">index, nofollow</option>
                  <option value="noindex, nofollow">noindex, nofollow</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>AI / AEO QUICK ANSWER SUMMARY (2-4 Sentences)</label>
              <textarea
                rows={3}
                placeholder="Factual concise answer summary designed for AI answer engines..."
                value={pageForm.ai_quick_answer || ''}
                onChange={e => setPageForm({ ...pageForm, ai_quick_answer: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', resize: 'none' }}
              />
            </div>

            <button
              type="submit"
              style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              💾 Save Page SEO Metadata
            </button>
          </form>

        </div>
      )}

      {/* ── TAB 4: CONTENT ASSISTANT ── */}
      {activeTab === 'content_assistant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <form onSubmit={handleGenerateContentAssistant} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F1F5F9' }}>SEO & AEO Content Assistant Generator</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>TARGET KEYWORD</label>
                <input
                  type="text"
                  required
                  value={caInput.keyword}
                  onChange={e => setCaInput({ ...caInput, keyword: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>TOPIC / PAGE TYPE</label>
                <input
                  type="text"
                  required
                  value={caInput.topic}
                  onChange={e => setCaInput({ ...caInput, topic: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>SEARCH INTENT</label>
                <select
                  value={caInput.intent}
                  onChange={e => setCaInput({ ...caInput, intent: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                >
                  <option value="commercial">Commercial / Purchase Intent</option>
                  <option value="informational">Informational / Guide</option>
                  <option value="transactional">Transactional</option>
                  <option value="navigational">Navigational</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={caLoading}
              style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              {caLoading ? 'Generating...' : '🚀 Generate SEO & AEO Content Blueprint'}
            </button>
          </form>

          {caResult && (
            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#2DD4BF' }}>RECOMMENDED SEO CONTENT STRUCTURE</h4>
              
              <div><strong>Suggested Title:</strong> {caResult.suggestedTitle}</div>
              <div><strong>Suggested Meta Description:</strong> {caResult.suggestedMetaDescription}</div>
              <div><strong>Suggested H1:</strong> {caResult.suggestedH1}</div>

              <div>
                <strong>Heading Outline Structure (H2/H3):</strong>
                <ul>
                  {caResult.headingOutline?.map((h: string, idx: number) => <li key={idx}>{h}</li>)}
                </ul>
              </div>

              <div>
                <strong>AI Featured Snippet Quick Answer:</strong>
                <div style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', padding: '12px', borderRadius: '8px', color: '#2DD4BF', fontSize: '13px', marginTop: '6px' }}>
                  {caResult.featuredSnippetAnswer}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: KEYWORDS & CANNIBALIZATION ── */}
      {activeTab === 'keywords' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header with Seeding Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#F1F5F9' }}>
                  🎯 Search Engine & AI Indexing Keywords ({keywordsData.keywords?.length || 0} Total)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                  High-volume target search terms for Google SEO backlinks, YouTube tags, Play Store metadata, and AI assistants (ChatGPT, Claude, Perplexity).
                </p>
              </div>

              <button
                type="button"
                onClick={handleSeedDefaultKeywords}
                disabled={seedingKeywords}
                style={{
                  padding: '11px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {seedingKeywords ? 'Seeding Keywords...' : '⚡ Seed 50+ High-Volume SEO & Competitor Keywords'}
              </button>
            </div>

            {/* Cannibalization Warning Alert Box */}
            {keywordsData.warnings?.length > 0 && (
              <div style={{ backgroundColor: '#EF444415', border: '1px solid #EF4444', borderRadius: '12px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#EF4444', fontSize: '15px', fontWeight: 800 }}>⚠️ Keyword Cannibalization Warning</h4>
                {keywordsData.warnings.map((w: any, idx: number) => (
                  <div key={idx} style={{ fontSize: '13px', color: '#F87171', marginBottom: '4px' }}>
                    Keyword "<strong>{w.keyword}</strong>" is targeted across multiple URLs: {w.urls.join(', ')}
                  </div>
                ))}
              </div>
            )}

            {/* Search & Category Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '14px' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search tracked keywords..."
                  value={kwSearch}
                  onChange={e => setKwSearch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All (${keywordsData.keywords?.length || 0})` },
                  { id: 'affiliate', label: '💼 Affiliate & CPA' },
                  { id: 'privacy', label: '🛡️ Privacy & Fingerprints' },
                  { id: 'proxy', label: '🔌 Proxies & Network' },
                  { id: 'competitor', label: '🔄 Competitor Alternatives' },
                  { id: 'os', label: '💻 OS & Platforms' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setKwCategoryFilter(tab.id as any)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: kwCategoryFilter === tab.id ? '#2DD4BF20' : '#14141F',
                      color: kwCategoryFilter === tab.id ? '#2DD4BF' : '#94A3B8',
                      fontWeight: kwCategoryFilter === tab.id ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Keyword Form */}
            <form onSubmit={handleAddKeyword} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CUSTOM KEYWORD</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. facebook multi account browser"
                  value={newKw.keyword}
                  onChange={e => setNewKw({ ...newKw, keyword: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
              <div style={{ width: '160px' }}>
                <label style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>INTENT</label>
                <select
                  value={newKw.search_intent}
                  onChange={e => setNewKw({ ...newKw, search_intent: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                >
                  <option value="commercial">Commercial</option>
                  <option value="informational">Informational</option>
                  <option value="transactional">Transactional</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>TARGET URL</label>
                <input
                  type="text"
                  value={newKw.target_url}
                  onChange={e => setNewKw({ ...newKw, target_url: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
                />
              </div>
              <button type="submit" style={{ padding: '10px 18px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                ➕ Add Keyword
              </button>
            </form>

            {/* Keywords List Table */}
            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#14141F', color: '#94A3B8', borderBottom: '1px solid #2C2C3E' }}>
                    <th style={{ padding: '12px 16px' }}>KEYWORD</th>
                    <th style={{ padding: '12px 16px' }}>TYPE</th>
                    <th style={{ padding: '12px 16px' }}>INTENT</th>
                    <th style={{ padding: '12px 16px' }}>TARGET URL</th>
                    <th style={{ padding: '12px 16px' }}>STATUS</th>
                    <th style={{ padding: '12px 16px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeywords.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                        No keywords matching filter. Click <strong>"Seed 50+ High-Volume SEO Keywords"</strong> to populate.
                      </td>
                    </tr>
                  ) : (
                    filteredKeywords.map((k: any) => (
                      <tr key={k.id} style={{ borderBottom: '1px solid #2C2C3E' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#F1F5F9' }}>{k.keyword}</td>
                        <td style={{ padding: '12px 16px', color: '#CBD5E1' }}>
                          <span style={{
                            backgroundColor: k.keyword_type === 'competitor' ? '#F59E0B20' : '#3B82F620',
                            color: k.keyword_type === 'competitor' ? '#F59E0B' : '#60A5FA',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700
                          }}>
                            {k.keyword_type || 'primary'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{k.search_intent}</td>
                        <td style={{ padding: '12px 16px', color: '#60A5FA', fontFamily: 'monospace' }}>{k.target_url}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ backgroundColor: '#10B98120', color: '#10B981', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {k.status || 'active'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button type="button" onClick={() => handleDeleteKeyword(k.id)} style={{ backgroundColor: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 700 }}>
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* ── TAB 6: ENTITY & BRAND PROFILE ── */}
      {activeTab === 'entity' && (
        <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F1F5F9' }}>Organization & Brand Entity Profile</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>ORGANIZATION BRAND NAME</label>
              <input
                type="text"
                value={settings.entity_brand_name || ''}
                onChange={e => setSettings({ ...settings, entity_brand_name: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>LOGO URL</label>
              <input
                type="text"
                value={settings.entity_logo || ''}
                onChange={e => setSettings({ ...settings, entity_logo: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>SUPPORT EMAIL</label>
              <input
                type="text"
                value={settings.entity_email || ''}
                onChange={e => setSettings({ ...settings, entity_email: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>PHONE</label>
              <input
                type="text"
                value={settings.entity_phone || ''}
                onChange={e => setSettings({ ...settings, entity_phone: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>SAMEAS SOCIAL & REPOSITORY URLS (JSON Array)</label>
            <input
              type="text"
              value={settings.entity_same_as || ''}
              onChange={e => setSettings({ ...settings, entity_same_as: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontFamily: 'monospace' }}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            💾 Save Entity Profile
          </button>
        </div>
      )}

      {/* ── TAB 7: ROBOTS.TXT & AI CRAWLER CONTROLS ── */}
      {activeTab === 'robots' && (
        <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#F1F5F9' }}>
                🤖 Robots.txt & AI Crawler Permissions
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                Configures crawl access for search engines and generative AI agents (Perplexity, ChatGPT, Claude, Gemini, Copilot).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleGenerateRobotsTxt}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ⚡ Auto-Generate AI-Friendly Robots.txt
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#2DD4BF',
                  color: '#0F0F17',
                  fontWeight: 800,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                💾 Save Robots.txt
              </button>
            </div>
          </div>

          {/* AI Bots Supported Status Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', padding: '10px 14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>ACTIVE AI CRAWLERS:</span>
            {['GPTBot (ChatGPT)', 'ClaudeBot (Claude)', 'PerplexityBot (Perplexity)', 'Google-Extended (Gemini)', 'Applebot (Apple Intelligence)', 'Bingbot (Copilot)', 'Bytespider'].map(bot => (
              <span key={bot} style={{ backgroundColor: '#10B98120', color: '#10B981', border: '1px solid #10B98140', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                ✓ {bot}
              </span>
            ))}
          </div>

          {isRobotsDangerous && (
            <div style={{ backgroundColor: '#EF444420', color: '#EF4444', border: '1px solid #EF4444', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}>
              ⚠️ CRITICAL: DANGEROUS RULE DETECTED — Your rules may block all search engines from indexing the site!
            </div>
          )}

          <textarea
            rows={14}
            value={settings.robots_content || ''}
            onChange={e => setSettings({ ...settings, robots_content: e.target.value })}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: '#09090D',
              border: '1px solid #2C2C3E',
              color: '#2DD4BF',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6'
            }}
          />
        </div>
      )}

      {/* ── TAB 8: SITEMAP & SEARCH ENGINE + AI AUTO-PING ── */}
      {activeTab === 'sitemap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Master Generator & Push Banner */}
          <div style={{
            backgroundColor: '#161622',
            border: '1px solid #3B82F640',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            background: 'linear-gradient(135deg, rgba(22, 22, 34, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#F1F5F9' }}>
                🚀 Master Sitemap & AI Submission Engine
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                Click below to auto-generate the latest <code style={{ color: '#2DD4BF' }}>/sitemap.xml</code> and <code style={{ color: '#2DD4BF' }}>/robots.txt</code>, and instantly ping Google Search Console, Bing Webmaster, IndexNow, and AI LLM search engines.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateAndSyncAll}
              disabled={syncingAll}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#3B82F6',
                color: '#FFF',
                fontWeight: 800,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {syncingAll ? '⏳ Generating & Pinging Engines...' : '⚡ Generate & Sync to Google & All AI Systems'}
            </button>
          </div>

          {/* Sync Results Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>🌐</span>
                <strong style={{ color: '#F1F5F9', fontSize: '14px' }}>Google Search Console</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 700 }}>
                {syncResult?.pingResults?.google?.success ? '✓ Ping Submitted' : '🟢 Ready for Automated Ping'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                Endpoint: https://www.google.com/ping?sitemap=...
              </div>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>⚡</span>
                <strong style={{ color: '#F1F5F9', fontSize: '14px' }}>Bing & IndexNow API</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 700 }}>
                {syncResult?.pingResults?.indexNow?.success ? '✓ Dispatched to IndexNow' : '🟢 Instant Indexing Ready'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                Pushes to Bing, Yandex, Seznam & Naver
              </div>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>🤖</span>
                <strong style={{ color: '#F1F5F9', fontSize: '14px' }}>AI Search & LLM Engines</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 700 }}>
                ✓ 8 AI Bot Directives Active
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                ChatGPT, Claude, Perplexity, Gemini, Applebot
              </div>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>🗺️</span>
                <strong style={{ color: '#F1F5F9', fontSize: '14px' }}>Sitemap URL Entries</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 700 }}>
                {pages.length > 0 ? `${pages.length} Canonical URLs` : '7 Default Core URLs'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                Daily change frequency & priority: 1.0
              </div>
            </div>
          </div>

          {/* XML Sitemap & /llms.txt Preview Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>🗺️ XML Sitemap (/sitemap.xml)</h4>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sitemapXmlPreview || '')
                    alert('✓ XML Sitemap copied to clipboard!')
                  }}
                  style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#2DD4BF', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}
                >
                  📋 Copy XML
                </button>
              </div>
              <textarea
                readOnly
                rows={12}
                value={sitemapXmlPreview || 'Click "Generate & Sync" above to compile XML sitemap.'}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#09090D', border: '1px solid #2C2C3E', color: '#60A5FA', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#F1F5F9' }}>🤖 AI Specification (/llms.txt)</h4>
                <button
                  type="button"
                  onClick={async () => {
                    if ((window as any).api?.seoGetLlmsTxt) {
                      const res = await (window as any).api.seoGetLlmsTxt()
                      if (res?.data) {
                        navigator.clipboard.writeText(res.data)
                        alert('✓ /llms.txt copied to clipboard!')
                      }
                    }
                  }}
                  style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#2DD4BF', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}
                >
                  📋 Copy LLMS.txt
                </button>
              </div>
              <textarea
                readOnly
                rows={12}
                value={`# AntiProfiles Software Inc. — AI Machine-Readable Specification\n> Official Website: https://antiprofiles.com\n\n## Entity Overview\nAntiProfiles is an anti-detect browser for multi-account management, affiliate CPA marketing, and fingerprint isolation.\n\n## Competitor Alternatives\n- GoLogin alternative\n- AdsPower alternative\n- Multilogin alternative\n- Dolphin Anty alternative\n- Incogniton alternative\n\n## Supported Platforms\nWindows 10/11, macOS Apple Silicon (M1-M4), macOS Intel, Linux.`}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#09090D', border: '1px solid #2C2C3E', color: '#34D399', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5' }}
              />
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 9: REDIRECTS & 404 LOGS ── */}
      {activeTab === 'redirects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Add Redirect Form */}
          <form onSubmit={handleAddRedirect} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SOURCE PATH</label>
              <input
                type="text"
                required
                placeholder="/old-page"
                value={newRed.source_path}
                onChange={e => setNewRed({ ...newRed, source_path: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>TARGET PATH</label>
              <input
                type="text"
                required
                placeholder="/new-page"
                value={newRed.target_path}
                onChange={e => setNewRed({ ...newRed, target_path: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}
              />
            </div>
            <button type="submit" style={{ padding: '10px 18px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 800, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
              ➕ Add 301 Redirect
            </button>
          </form>

          {/* 301 Redirects Table */}
          <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', fontWeight: 800, fontSize: '14px', borderBottom: '1px solid #2C2C3E', color: '#F1F5F9' }}>ACTIVE 301/302 REDIRECTS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#14141F', color: '#94A3B8', borderBottom: '1px solid #2C2C3E' }}>
                  <th style={{ padding: '12px 16px' }}>SOURCE</th>
                  <th style={{ padding: '12px 16px' }}>TARGET</th>
                  <th style={{ padding: '12px 16px' }}>HTTP CODE</th>
                </tr>
              </thead>
              <tbody>
                {redirects.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #2C2C3E' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#F87171' }}>{r.source_path}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#34D399' }}>{r.target_path}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.status_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 404 Error Log Tracker Table */}
          <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', fontWeight: 800, fontSize: '14px', borderBottom: '1px solid #2C2C3E', color: '#F1F5F9' }}>RECENT 404 URL HIT LOGS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#14141F', color: '#94A3B8', borderBottom: '1px solid #2C2C3E' }}>
                  <th style={{ padding: '12px 16px' }}>REQUESTED PATH</th>
                  <th style={{ padding: '12px 16px' }}>HITS</th>
                  <th style={{ padding: '12px 16px' }}>LAST SEEN</th>
                </tr>
              </thead>
              <tbody>
                {logs404.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #2C2C3E' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#FBBF24' }}>{l.request_path}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#EF4444' }}>{l.hit_count}</td>
                    <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{l.last_seen_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  )
}
