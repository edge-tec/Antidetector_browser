import React, { useState, useEffect } from 'react'

export interface GlobalLaunchUrlConfig {
  url: string
  enabled: boolean
  mode: 'enroll_all' | 'force' | 'default'
  lockOverride: boolean
  additionalTabs: string[]
}

export const AdminLaunchUrlManager: React.FC = () => {
  const [config, setConfig] = useState<GlobalLaunchUrlConfig>({
    url: 'https://whoer.net',
    enabled: false,
    mode: 'enroll_all',
    lockOverride: false,
    additionalTabs: []
  })
  const [additionalTabsText, setAdditionalTabsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const loadConfig = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      let res: any = null

      if ((window as any).api?.adminGetLaunchUrlConfig) {
        res = await (window as any).api.adminGetLaunchUrlConfig(token)
      } else if ((window as any).api?.getLaunchUrlConfig) {
        res = await (window as any).api.getLaunchUrlConfig()
      }

      if (res?.success && res?.data) {
        setConfig(res.data)
        setAdditionalTabsText(Array.isArray(res.data.additionalTabs) ? res.data.additionalTabs.join('\n') : '')
      }
    } catch (err: any) {
      showToast('error', 'Failed to load configuration: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleSave = async (forceEnrollNow = false) => {
    let cleanUrl = config.url.trim()
    if (config.enabled && !cleanUrl) {
      showToast('error', 'Please provide a valid launch URL or disable the system.')
      return
    }

    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl
      setConfig(prev => ({ ...prev, url: cleanUrl }))
    }

    const tabs = additionalTabsText
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('http://') || t.startsWith('https://') ? t : 'https://' + t))

    setSaving(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const payload = {
        ...config,
        url: cleanUrl,
        additionalTabs: tabs,
        enrollNow: forceEnrollNow || config.mode === 'enroll_all'
      }

      let res: any = null
      if ((window as any).api?.adminSaveLaunchUrlConfig) {
        res = await (window as any).api.adminSaveLaunchUrlConfig(token, payload)
      }

      if (res?.success) {
        const enrolledMsg = res.enrolledCount !== undefined ? ` (${res.enrolledCount} profile(s) enrolled)` : ''
        showToast(
          'success',
          `✓ Launch URL saved & synchronized across all user accounts & device software!${enrolledMsg}`
        )
        await loadConfig()
      } else {
        showToast('error', res?.error || 'Failed to save Launch URL configuration.')
      }
    } catch (err: any) {
      showToast('error', 'Save error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleForceEnrollAll = async () => {
    const cleanUrl = config.url.trim()
    if (!cleanUrl) {
      showToast('error', 'Please enter a Launch URL to enroll.')
      return
    }

    setEnrolling(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      let res: any = null
      if ((window as any).api?.adminEnrollAllLaunchUrl) {
        res = await (window as any).api.adminEnrollAllLaunchUrl(token, cleanUrl)
      } else {
        res = await handleSave(true)
        return
      }

      if (res?.success) {
        showToast('success', `✓ Successfully enrolled ${res.enrolledCount ?? 'all'} profile(s) with "${cleanUrl}"!`)
      } else {
        showToast('error', res?.error || 'Failed to enroll profiles.')
      }
    } catch (err: any) {
      showToast('error', 'Enrollment error: ' + err.message)
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔄</div>
        Loading Global Launch URL settings...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            padding: '14px 20px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'success' ? '#065F46' : '#7F1D1D',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '14px',
            zIndex: 99999,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            border: `1px solid ${toast.type === 'success' ? '#10B981' : '#EF4444'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid rgba(45, 212, 191, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '26px' }}>🌐</span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
              Global Start Page & Launch URL System
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: config.enabled ? '#10B98125' : '#64748B25',
                color: config.enabled ? '#10B981' : '#94A3B8',
                border: `1px solid ${config.enabled ? '#10B98150' : '#64748B40'}`
              }}
            >
              {config.enabled ? 'ACTIVE & ENROLLING' : 'DISABLED'}
            </span>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            Configure an authoritative launch URL that automatically enrolls all user accounts and device software
            installations across your entire organization.
          </p>
        </div>

        {/* Master Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: config.enabled ? '#2DD4BF' : '#64748B', fontWeight: 600 }}>
            {config.enabled ? 'System Enabled' : 'System Disabled'}
          </span>
          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              backgroundColor: config.enabled ? '#2DD4BF' : '#334155',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.2s',
              padding: 0
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                position: 'absolute',
                top: '3px',
                left: config.enabled ? '27px' : '3px',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            />
          </button>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: '#1E1E2E',
          border: '1px solid #2C2C3E',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Launch URL Input */}
        <div>
          <label style={{ display: 'block', color: '#F1F5F9', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
            Primary Launch URL (Start Page)
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={config.url}
              onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
              placeholder="e.g. https://whoer.net or https://your-portal.com"
              style={{
                flex: 1,
                minWidth: '280px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #3B3B52',
                backgroundColor: '#14141F',
                color: '#F1F5F9',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            {config.url && (
              <a
                href={config.url.startsWith('http') ? config.url : `https://${config.url}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #2DD4BF40',
                  backgroundColor: '#2DD4BF15',
                  color: '#2DD4BF',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <span>🔗</span> Preview Link
              </a>
            )}
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Quick Presets:</span>
            {[
              { label: 'Whoer.net', url: 'https://whoer.net' },
              { label: 'Pixelscan', url: 'https://pixelscan.net' },
              { label: 'BrowserLeaks', url: 'https://browserleaks.com' },
              { label: 'Google', url: 'https://www.google.com' }
            ].map(preset => (
              <button
                key={preset.url}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, url: preset.url }))}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: config.url === preset.url ? '#2DD4BF20' : '#181824',
                  color: config.url === preset.url ? '#2DD4BF' : '#94A3B8',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Enrollment & Enforcement Mode */}
        <div>
          <label style={{ display: 'block', color: '#F1F5F9', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
            Enrollment & Enforcement Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {/* Mode 1: Auto-Enroll All */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, mode: 'enroll_all' }))}
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: config.mode === 'enroll_all' ? '#2DD4BF10' : '#14141F',
                border: `1px solid ${config.mode === 'enroll_all' ? '#2DD4BF' : '#2C2C3E'}`,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '18px' }}>🚀</span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    color: config.mode === 'enroll_all' ? '#2DD4BF' : '#F1F5F9'
                  }}
                >
                  Auto-Enroll All Profiles
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                Automatically updates and enrolls this Launch URL across all existing and newly created user profiles on all
                devices.
              </p>
            </div>

            {/* Mode 2: Strict Force Override */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, mode: 'force' }))}
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: config.mode === 'force' ? '#818CF815' : '#14141F',
                border: `1px solid ${config.mode === 'force' ? '#818CF8' : '#2C2C3E'}`,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '18px' }}>⚡</span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    color: config.mode === 'force' ? '#A5B4FC' : '#F1F5F9'
                  }}
                >
                  Strict Force Override
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                Browser always launches with this admin URL as Tab 1 on every single execution, regardless of what user
                profile specifies.
              </p>
            </div>

            {/* Mode 3: Global Default */}
            <div
              onClick={() => setConfig(prev => ({ ...prev, mode: 'default' }))}
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: config.mode === 'default' ? '#F59E0B10' : '#14141F',
                border: `1px solid ${config.mode === 'default' ? '#F59E0B' : '#2C2C3E'}`,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '18px' }}>🌐</span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    color: config.mode === 'default' ? '#FBBF24' : '#F1F5F9'
                  }}
                >
                  Default Fallback
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                Acts as the default start page for any profile where the user has not configured their own custom start URL.
              </p>
            </div>
          </div>
        </div>

        {/* Lock User Override */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: '#14141F',
            border: '1px solid #2C2C3E'
          }}
        >
          <input
            type="checkbox"
            id="lockOverride"
            checked={config.lockOverride}
            onChange={e => setConfig(prev => ({ ...prev, lockOverride: e.target.checked }))}
            style={{ width: '18px', height: '18px', accentColor: '#2DD4BF', cursor: 'pointer' }}
          />
          <label htmlFor="lockOverride" style={{ fontSize: '13px', color: '#E2E8F0', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontWeight: 600 }}>🔒 Lock User Override:</span> Prevent non-admin users from changing or
            clearing the start URL in their profile edit modals.
          </label>
        </div>

        {/* Additional Background Tabs */}
        <div>
          <label style={{ display: 'block', color: '#F1F5F9', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
            Additional Auto-Launch Tabs (Optional)
          </label>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: 0, marginBottom: '8px' }}>
            Enter extra URLs to open in background tabs alongside the main launch page (one URL per line).
          </p>
          <textarea
            rows={3}
            value={additionalTabsText}
            onChange={e => setAdditionalTabsText(e.target.value)}
            placeholder="https://example.com/tab2&#10;https://example.com/tab3"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #3B3B52',
              backgroundColor: '#14141F',
              color: '#F1F5F9',
              fontSize: '13px',
              fontFamily: 'monospace',
              outline: 'none',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid #2C2C3E' }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2DD4BF',
              color: '#0F172A',
              fontWeight: 700,
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            <span>{saving ? '⏳' : '💾'}</span>
            <span>{saving ? 'Saving & Enrolling...' : 'Save & Apply to All Users & Devices'}</span>
          </button>

          <button
            type="button"
            disabled={enrolling || saving || !config.url}
            onClick={handleForceEnrollAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '8px',
              border: '1px solid #6366F1',
              backgroundColor: '#6366F120',
              color: '#A5B4FC',
              fontWeight: 600,
              fontSize: '14px',
              cursor: enrolling ? 'not-allowed' : 'pointer',
              opacity: enrolling ? 0.7 : 1
            }}
          >
            <span>{enrolling ? '⏳' : '⚡'}</span>
            <span>{enrolling ? 'Enrolling Profiles...' : 'Force Re-Enroll All Profiles Now'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
