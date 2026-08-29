// ──────────────────────────────────────────────
// AntiProfiles — Main App Component
// ──────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Page, Profile, DashboardStats, ProxyDisplay, Group, LogEntry, IpcResult } from './types'
import { ProfileModal } from './components/ProfileModal'
import { BulkProfileModal } from './components/BulkProfileModal'
import { TemplatesModal } from './components/TemplatesModal'
import { ConsistencyBadge } from './components/ConsistencyBadge'
import { FingerprintPreview } from './components/FingerprintPreview'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { AdminDashboard } from './pages/AdminDashboard'
import { LandingPage } from './pages/LandingPage'
import { SupportChatWidget } from './components/SupportChatWidget'
import { BrowserSetupModal } from './components/BrowserSetupModal'
import { UpdateNotificationModal, UpdateAvailablePayload } from './components/UpdateNotificationModal'
import { VersionHistoryModal } from './components/VersionHistoryModal'
import { ReferralPage } from './pages/ReferralPage'
import { ReferralDashboard } from './pages/ReferralDashboard'
import { BrowserRuntimeManager } from './components/BrowserRuntimeManager'
import { RuntimeProvisioningModal, ProvisioningProgressData } from './components/RuntimeProvisioningModal'
import { ProxyInfoCard } from './components/ProxyInfoCard'
import type { ProxyTestResult } from './types'
import logoImg from './assets/logo.png'
import defaultChromeImg from './assets/antiprofiles-chrome.png'
import defaultFirefoxImg from './assets/antiprofiles-firefox.png'

// ═══════════════════════════════════════════
// SVG Icons (inline for zero dependencies)
// ═══════════════════════════════════════════

const Icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  gift: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  profiles: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  groups: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  proxies: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  automation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  logs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  stop: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
}

// ═══════════════════════════════════════════
// Toast System
// ═══════════════════════════════════════════

interface ToastItem {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  leaving?: boolean
}

let toastId = 0

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type} ${t.leaving ? 'leaving' : ''}`}>
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
// Confirm Dialog
// ═══════════════════════════════════════════

interface ConfirmState {
  show: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

function ConfirmDialog({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  if (!state.show) return null
  return (
    <>
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">{state.title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onCancel}><span style={{ width: 18, height: 18, display: 'flex' }}>{Icons.x}</span></button>
        </div>
        <div className="modal-body">
          <p className="confirm-dialog-message">{state.message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { state.onConfirm(); onCancel() }}>
            {state.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════
// Dashboard Page
// ═══════════════════════════════════════════

function DashboardPage({ onNavigate, showToast, brandingConfig, proxies }: { onNavigate: (page: Page) => void; showToast: (type: ToastItem['type'], message: string) => void; brandingConfig?: any; proxies?: ProxyDisplay[] }) {
  const { sessionToken } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    const result = await window.api.getDashboardStats()
    if (result.success && result.data) setStats(result.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 3000)
    return () => clearInterval(interval)
  }, [loadStats])

  if (loading) return <div className="loading-state"><div className="loading-spinner" /><span className="text-secondary">Loading dashboard...</span></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your browser profiles</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('profiles')}>
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.plus}</span>
            New Profile
          </button>
        </div>
      </div>

      <div className="grid-stats">
        <div className="stat-card" style={{ '--stat-color': 'var(--color-accent)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>📊</div>
          <div className="stat-card-value">{stats?.totalProfiles ?? 0}</div>
          <div className="stat-card-label">Total Profiles</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--color-success)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>🟢</div>
          <div className="stat-card-value">{stats?.runningProfiles ?? 0}</div>
          <div className="stat-card-label">Running</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--color-text-tertiary)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--color-surface)', color: 'var(--color-text-tertiary)' }}>⏹️</div>
          <div className="stat-card-value">{stats?.stoppedProfiles ?? 0}</div>
          <div className="stat-card-label">Stopped</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--color-warning)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>🔒</div>
          <div className="stat-card-value">{stats?.totalProxies ?? 0}</div>
          <div className="stat-card-label">Proxies</div>
        </div>
      </div>

      {stats?.recentProfiles && stats.recentProfiles.length > 0 && (
        <div className="section" style={{ marginTop: 32 }}>
          <h3 className="section-title">Recently Used Profiles</h3>
          <div className="grid-profiles">
            {stats.recentProfiles.map((profile) => (
              <ProfileCardComponent key={profile.id} profile={profile} proxies={proxies} brandingConfig={brandingConfig} onStart={async () => {
                const r = await window.api.startProfile(sessionToken || '', profile.id)
                if (r.success) showToast('success', `Started "${profile.name}"`)
                else showToast('error', r.error || 'Failed to start')
                loadStats()
              }} onStop={async () => {
                const r = await window.api.stopProfile(sessionToken || '', profile.id)
                if (r.success) showToast('success', `Stopped "${profile.name}"`)
                else showToast('error', r.error || 'Failed to stop')
                loadStats()
              }} onClearCookies={async () => {
                if (!sessionToken) return
                const r = await window.api.clearProfileCookies(sessionToken, profile.id)
                if (r.success) showToast('success', `✓ Cookies & cache cleared for "${profile.name}"`)
                else showToast('error', r.error || 'Failed to clear cookies')
                loadStats()
              }} />
            ))}
          </div>
        </div>
      )}

      {stats?.totalProfiles === 0 && (
        <div className="empty-state" style={{ marginTop: 48 }}>
          <div className="empty-state-icon">🌐</div>
          <div className="empty-state-title">No profiles yet</div>
          <div className="empty-state-text">Create your first browser profile to get started with isolated browsing environments.</div>
          <button className="btn btn-primary" onClick={() => onNavigate('profiles')}>Create Profile</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Profile Card Component
// ═══════════════════════════════════════════

function ProfileCardComponent({ profile, proxies, brandingConfig, isSyncingProxy, onStart, onStop, onClearCookies, onRefreshProxy, onConnectGoogle, onOpenGmail, onTestGmailApi, onDisconnectGoogle, onEdit, onDuplicate, onDelete }: {
  profile: Profile
  proxies?: ProxyDisplay[]
  brandingConfig?: any
  isSyncingProxy?: boolean
  onStart?: () => void
  onStop?: () => void
  onClearCookies?: () => void
  onRefreshProxy?: () => void
  onConnectGoogle?: () => void
  onOpenGmail?: () => void
  onTestGmailApi?: () => void
  onDisconnectGoogle?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const isRunning = profile.status === 'running'
  const isLaunching = profile.status === 'launching'
  const matchedProxy = (proxies || []).find(p => p.id === profile.proxyId)

  const isFirefox = profile.browserType === 'firefox' || profile.browserVersion?.toLowerCase().includes('firefox') || profile.userAgent?.includes('Firefox') || (profile.fingerprint as any)?.browser?.type === 'firefox'
  const brandImg = isFirefox
    ? (brandingConfig?.firefox?.previewUrl || defaultFirefoxImg)
    : (brandingConfig?.chromium?.previewUrl || defaultChromeImg)

  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <div
          className="profile-card-icon"
          style={{
            backgroundColor: `${profile.color}15`,
            color: profile.color,
            flexShrink: 0,
            padding: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          title={isFirefox ? 'Mozilla Firefox Quantum Engine' : 'Google Chromium Blink Engine'}
        >
          <img
            src={brandImg}
            alt={isFirefox ? 'Firefox' : 'Chromium'}
            style={{ width: '22px', height: '22px', objectFit: 'contain' }}
            onError={(e: any) => {
              e.target.onerror = null
              e.target.src = isFirefox ? defaultFirefoxImg : defaultChromeImg
            }}
          />
        </div>
        <div className="profile-card-info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
            <span className="profile-card-name" title={profile.name}>{profile.name}</span>
          </div>
          <div className="profile-card-meta">
            {profile.lastUsedAt ? `Last used ${new Date(profile.lastUsedAt).toLocaleDateString()}` : 'Never used'}
          </div>
        </div>
        <div className={`profile-card-status ${profile.status}`} style={{ flexShrink: 0 }}>
          <span className="profile-card-status-dot" />
          {isLaunching ? 'Launching...' : isRunning ? 'Running' : 'Stopped'}
        </div>
      </div>

      {profile.consistencyScore > 0 && (
        <div style={{ marginTop: 2, marginBottom: 2 }}>
          <ConsistencyBadge score={profile.consistencyScore} />
        </div>
      )}

      <div style={{ margin: '4px 0' }}>
        <FingerprintPreview osType={profile.osType || 'windows-10'} fingerprint={profile.fingerprint} proxy={matchedProxy} />
      </div>

      {profile.tags.length > 0 && (
        <div className="profile-card-tags">
          {profile.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="badge">{tag}</span>
          ))}
        </div>
      )}

      <div className="profile-card-actions">
        {isRunning ? (
          <button className="btn btn-sm btn-danger" onClick={onStop} disabled={isLaunching}>
            <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.stop}</span> Stop
          </button>
        ) : (
          <button className="btn btn-sm btn-success" onClick={onStart} disabled={isLaunching}>
            <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.play}</span> Start
          </button>
        )}
        {onConnectGoogle && (
          (profile as any).googleAccount ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  fontSize: '11px',
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title={`Google Account: ${(profile as any).googleAccount.email} (Connected via System Browser OAuth)`}
              >
                <span>✓ G:</span> {(profile as any).googleAccount.email.split('@')[0]}
              </span>
              {onOpenGmail && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onOpenGmail}
                  title="Open Gmail Web in Secure Browser"
                  style={{ color: '#EA4335', fontSize: 11, padding: '2px 6px', height: 'auto', fontWeight: 600 }}
                >
                  📧 Gmail
                </button>
              )}
              {onTestGmailApi && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onTestGmailApi}
                  title="Check Gmail API Connectivity"
                  style={{ color: '#38BDF8', fontSize: 11, padding: '2px 4px', height: 'auto' }}
                >
                  ⚡ API
                </button>
              )}
              {onDisconnectGoogle && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onDisconnectGoogle}
                  title="Disconnect Google Account"
                  style={{ color: '#94A3B8', fontSize: 11, padding: '2px 4px', height: 'auto' }}
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={onConnectGoogle}
                title="Connect Google Account via Secure System Browser (OAuth 2.0 / RFC 8252)"
                style={{ color: '#4285F4', fontWeight: 600 }}
              >
                <span style={{ fontSize: '13px', marginRight: 2 }}>G</span> Connect
              </button>
              {onOpenGmail && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onOpenGmail}
                  title="Open Gmail Web in Secure Browser"
                  style={{ color: '#EA4335', fontSize: 11, padding: '2px 6px', height: 'auto', fontWeight: 600 }}
                >
                  📧 Gmail
                </button>
              )}
            </div>
          )
        )}
        {profile.proxyId && onRefreshProxy && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={onRefreshProxy}
            title="Reload & Synchronize Proxy Location (Timezone, Coordinates, Geolocation)"
            style={{
              color: '#38BDF8',
              cursor: isSyncingProxy ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            disabled={isSyncingProxy}
          >
            <span style={{
              display: 'inline-block',
              animation: isSyncingProxy ? 'spin 0.8s linear infinite' : 'none'
            }}>
              🔄
            </span>
          </button>
        )}
        {onClearCookies && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={onClearCookies}
            title="Clear Cookies, Login Sessions & Cache"
            style={{ color: '#F59E0B' }}
          >
            🍪
          </button>
        )}
        {onEdit && <button className="btn btn-sm btn-ghost" onClick={onEdit} title="Edit Profile"><span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.edit}</span></button>}
        {onDuplicate && <button className="btn btn-sm btn-ghost" onClick={onDuplicate} title="Duplicate Profile"><span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.copy}</span></button>}
        {onDelete && <button className="btn btn-sm btn-ghost" onClick={onDelete} title="Delete Profile"><span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.trash}</span></button>}
      </div>
    </div>
  )
}

function ProfileListRowComponent({ profile, proxies, brandingConfig, isSyncingProxy, onStart, onStop, onClearCookies, onRefreshProxy, onConnectGoogle, onOpenGmail, onTestGmailApi, onDisconnectGoogle, onEdit, onDuplicate, onDelete }: {
  profile: Profile
  proxies?: ProxyDisplay[]
  brandingConfig?: any
  isSyncingProxy?: boolean
  onStart?: () => void
  onStop?: () => void
  onClearCookies?: () => void
  onRefreshProxy?: () => void
  onConnectGoogle?: () => void
  onOpenGmail?: () => void
  onTestGmailApi?: () => void
  onDisconnectGoogle?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const isRunning = profile.status === 'running'
  const isLaunching = profile.status === 'launching'
  const matchedProxy = (proxies || []).find(p => p.id === profile.proxyId)

  const isFirefox = profile.browserType === 'firefox' || profile.browserVersion?.toLowerCase().includes('firefox') || profile.userAgent?.includes('Firefox') || (profile.fingerprint as any)?.browser?.type === 'firefox'
  const brandImg = isFirefox
    ? (brandingConfig?.firefox?.previewUrl || defaultFirefoxImg)
    : (brandingConfig?.chromium?.previewUrl || defaultChromeImg)

  return (
    <div className="profile-list-row">
      <div className="profile-list-cell-name">
        <div
          className="profile-card-icon"
          style={{
            backgroundColor: `${profile.color}15`,
            color: profile.color,
            width: 34,
            height: 34,
            fontSize: 16,
            flexShrink: 0,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          title={isFirefox ? 'Mozilla Firefox Quantum Engine' : 'Google Chromium Blink Engine'}
        >
          <img
            src={brandImg}
            alt={isFirefox ? 'Firefox' : 'Chromium'}
            style={{ width: '22px', height: '22px', objectFit: 'contain' }}
            onError={(e: any) => {
              e.target.onerror = null
              e.target.src = isFirefox ? defaultFirefoxImg : defaultChromeImg
            }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span className="profile-list-name" title={profile.name}>{profile.name}</span>
            {profile.consistencyScore > 0 && (
              <ConsistencyBadge score={profile.consistencyScore} />
            )}
          </div>
          <div className="profile-card-meta">
            {profile.lastUsedAt ? `Last used ${new Date(profile.lastUsedAt).toLocaleDateString()}` : 'Never used'}
          </div>
        </div>
      </div>

      <div className="profile-list-cell-fingerprint">
        <FingerprintPreview osType={profile.osType || 'windows-10'} fingerprint={profile.fingerprint} proxy={matchedProxy} />
      </div>

      {profile.tags.length > 0 && (
        <div className="profile-list-cell-tags">
          {profile.tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="badge">{tag}</span>
          ))}
        </div>
      )}

      <div className="profile-list-cell-status">
        <div className={`profile-card-status ${profile.status}`}>
          <span className="profile-card-status-dot" />
          {isLaunching ? 'Launching...' : isRunning ? 'Running' : 'Stopped'}
        </div>
      </div>

      <div className="profile-list-cell-actions">
        {isRunning ? (
          <button className="btn btn-sm btn-danger" onClick={onStop} disabled={isLaunching}>
            <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.stop}</span> Stop
          </button>
        ) : (
          <button className="btn btn-sm btn-success" onClick={onStart} disabled={isLaunching}>
            <span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.play}</span> Start
          </button>
        )}
        {onConnectGoogle && (
          (profile as any).googleAccount ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  fontSize: '11px',
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title={`Google Account: ${(profile as any).googleAccount.email} (Connected via System Browser OAuth)`}
              >
                <span>✓ G:</span> {(profile as any).googleAccount.email.split('@')[0]}
              </span>
              {onOpenGmail && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onOpenGmail}
                  title="Open Gmail in Profile Chromium Browser"
                  style={{ color: '#EA4335', fontSize: 11, padding: '2px 6px', height: 'auto', fontWeight: 600 }}
                >
                  📧 Gmail
                </button>
              )}
              {onTestGmailApi && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onTestGmailApi}
                  title="Check Gmail API Connectivity"
                  style={{ color: '#38BDF8', fontSize: 11, padding: '2px 4px', height: 'auto' }}
                >
                  ⚡ API
                </button>
              )}
              {onDisconnectGoogle && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onDisconnectGoogle}
                  title="Disconnect Google Account"
                  style={{ color: '#94A3B8', fontSize: 11, padding: '2px 4px', height: 'auto' }}
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={onConnectGoogle}
                title="Connect Google Account via Secure System Browser (OAuth 2.0 / RFC 8252)"
                style={{ color: '#4285F4', fontWeight: 600, fontSize: 12, padding: '4px 8px' }}
              >
                <span style={{ fontSize: '13px', marginRight: 2 }}>G</span> Connect
              </button>
              {onOpenGmail && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onOpenGmail}
                  title="Open Gmail Web in Secure Browser"
                  style={{ color: '#EA4335', fontSize: 11, padding: '2px 6px', height: 'auto', fontWeight: 600 }}
                >
                  📧 Gmail
                </button>
              )}
            </div>
          )
        )}
        {profile.proxyId && onRefreshProxy && (
          <button
            className="btn btn-sm btn-ghost btn-icon"
            onClick={onRefreshProxy}
            title="Reload & Synchronize Proxy Location (Timezone, Coordinates, Geolocation)"
            style={{
              color: '#38BDF8',
              fontSize: 13,
              cursor: isSyncingProxy ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            disabled={isSyncingProxy}
          >
            <span style={{
              display: 'inline-block',
              animation: isSyncingProxy ? 'spin 0.8s linear infinite' : 'none'
            }}>
              🔄
            </span>
          </button>
        )}
        {onClearCookies && (
          <button
            className="btn btn-sm btn-ghost btn-icon"
            onClick={onClearCookies}
            title="Clear Cookies, Login Sessions & Cache"
            style={{ color: '#F59E0B', fontSize: 13 }}
          >
            🍪
          </button>
        )}
        {onEdit && <button className="btn btn-sm btn-ghost btn-icon" onClick={onEdit} title="Edit Profile"><span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.edit}</span></button>}
        {onDuplicate && <button className="btn btn-sm btn-ghost btn-icon" onClick={onDuplicate} title="Duplicate Profile"><span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.copy}</span></button>}
        {onDelete && <button className="btn btn-sm btn-ghost btn-icon" onClick={onDelete} title="Delete Profile"><span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.trash}</span></button>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Profiles Page
// ═══════════════════════════════════════════

function ProfilesPage({ showToast, confirm, licenseInfo, onUpgrade, brandingConfig }: { showToast: (type: ToastItem['type'], msg: string) => void; confirm: (c: Omit<ConfirmState, 'show'>) => void; licenseInfo?: any; onUpgrade?: () => void; brandingConfig?: any }) {
  const { sessionToken, isAdmin } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [licenseLimits, setLicenseLimits] = useState<{ profiles: number } | null>(null)
  const [proxies, setProxies] = useState<ProxyDisplay[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('profiles_view_mode') as 'grid' | 'list') || 'grid'
  })
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showBrowserSetup, setShowBrowserSetup] = useState(false)
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)
  const [syncingProfileId, setSyncingProfileId] = useState<string | null>(null)

  const handleRefreshProxy = async (p: Profile) => {
    if (!p.proxyId) {
      showToast('info', `No proxy is configured for profile "${p.name}".`)
      return
    }
    setSyncingProfileId(p.id)
    try {
      const r = await window.api.refreshProxy(p.proxyId)
      if (r && r.success && r.data) {
        showToast('success', `✓ Proxy location synchronized for "${p.name}": ${r.data.city || 'N/A'}, ${r.data.region || 'N/A'}, ${r.data.country || 'N/A'} (Timezone: ${r.data.timezone || 'Auto'})`)
      } else {
        const pRes = await (window.api as any).syncProfileProxy?.(p.id)
        if (pRes?.success) {
          showToast('success', `✓ Proxy location synchronized for "${p.name}"`)
        } else {
          showToast('error', r?.error || pRes?.error || 'Failed to reload proxy')
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reload proxy')
    } finally {
      setSyncingProfileId(null)
      loadProfiles()
      window.api.getProxies().then((res) => { if (res.success && res.data) setProxies(res.data) }).catch(() => {})
    }
  }

  const loadProfiles = useCallback(async () => {
    if (!sessionToken) return
    const result = await window.api.getProfiles(sessionToken, search || undefined)
    if (result.success && result.data) setProfiles(result.data)
    setLoading(false)
    window.api.getLicenseStatus(sessionToken).then((r: any) => {
      if (r?.success && r?.data?.limits) {
        setLicenseLimits(r.data.limits)
      }
    }).catch(() => {})
  }, [sessionToken, search])

  const [provisioningProgress, setProvisioningProgress] = useState<ProvisioningProgressData | null>(null)

  useEffect(() => {
    loadProfiles()
    window.api.getProxies().then((r) => { if (r.success && r.data) setProxies(r.data) })
    window.api.getGroups().then((r) => { if (r.success && r.data) setGroups(r.data) })
    const unsub = window.api.onProfileStatusChanged((_e, _data) => loadProfiles())
    const unsubProg = (window.api as any).onProvisioningProgress ? (window.api as any).onProvisioningProgress((_e: any, data: any) => {
      setProvisioningProgress(data)
      if (data?.step === 'ready') {
        setTimeout(() => setProvisioningProgress(null), 1200)
      }
    }) : undefined

    return () => {
      if (unsub) unsub()
      if (unsubProg) unsubProg()
    }
  }, [loadProfiles])

  const handleStartProfile = async (p: Profile) => {
    if (!sessionToken) return
    const r = await window.api.startProfile(sessionToken, p.id)
    if (r.success) {
      showToast('success', `Started "${p.name}"`)
    } else {
      const err = r.error || ''
      showToast('error', err || 'Failed to start profile')
      if (
        err.toLowerCase().includes('chrome') ||
        err.toLowerCase().includes('chromium') ||
        err.toLowerCase().includes('not found') ||
        err.toLowerCase().includes('executable')
      ) {
        setPendingProfile(p)
        setShowBrowserSetup(true)
      }
    }
    loadProfiles()
  }

  const [connectingGoogleProfileId, setConnectingGoogleProfileId] = useState<string | null>(null)

  const handleConnectGoogle = async (p: Profile) => {
    if (!sessionToken) return
    if (connectingGoogleProfileId === p.id) return
    setConnectingGoogleProfileId(p.id)
    showToast('info', `Opening System Browser for Google OAuth (RFC 8252) for "${p.name}"...`)
    try {
      const res = await window.api.connectProfileGoogle(sessionToken, p.id)
      if (res?.success) {
        showToast('success', `✓ Google Account successfully connected to "${p.name}"!`)
        loadProfiles()
      } else {
        showToast('error', res?.error || 'Failed to connect Google account')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Google OAuth connection failed')
    } finally {
      setConnectingGoogleProfileId(null)
    }
  }

  const handleOpenGmail = async (p: Profile, openInSystemBrowser: boolean = true) => {
    if (!sessionToken) return
    showToast('info', `Opening Gmail Web in secure System Browser for "${p.name}"...`)
    try {
      const res = await (window.api as any).openProfileGmail(sessionToken, p.id, openInSystemBrowser)
      if (!res?.success) {
        showToast('error', res?.error || 'Failed to open Gmail')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Failed to open Gmail')
    }
  }

  const handleTestGmailApi = async (p: Profile) => {
    if (!sessionToken) return
    showToast('info', `Checking Gmail API connectivity for "${p.name}"...`)
    try {
      const res = await (window.api as any).testProfileGmailApi(sessionToken, p.id)
      if (res?.success && res.data) {
        showToast('success', `✓ Gmail API Active: ${res.data.emailAddress || (p as any).googleAccount?.email} (${res.data.messagesTotal || 0} messages)`)
      } else {
        showToast('warn', `Gmail API Status: ${res?.error || 'Account connected (API ready)'}`)
      }
    } catch (e: any) {
      showToast('error', e.message || 'Gmail API request failed')
    }
  }

  const handleDisconnectGoogle = (p: Profile) => {
    confirm({
      title: 'Disconnect Google Account',
      message: `Are you sure you want to disconnect the Google account from "${p.name}"? This will remove the OAuth token association.`,
      confirmLabel: 'Disconnect',
      danger: true,
      onConfirm: async () => {
        if (!sessionToken) return
        const res = await window.api.disconnectProfileGoogle(sessionToken, p.id)
        if (res?.success) {
          showToast('success', `Google account disconnected from "${p.name}"`)
          loadProfiles()
        } else {
          showToast('error', res?.error || 'Failed to disconnect')
        }
      }
    })
  }

  const handleSaveProfile = async (input: any) => {
    if (!sessionToken) return
    const refreshProxiesList = () => {
      window.api.getProxies().then((r) => { if (r?.success && r.data) setProxies(r.data) }).catch(() => {})
    }

    if (editId) {
      const result = await window.api.updateProfile(sessionToken, editId, input)
      if (result.success) {
        showToast('success', 'Profile updated')
        if (result.data) {
          setProfiles(prev => prev.map(p => p.id === editId ? result.data! : p))
        }
        setEditId(null)
        setEditProfile(null)
        setShowCreate(false)
        loadProfiles()
        refreshProxiesList()
      } else {
        showToast('error', result.error || 'Failed to update profile')
      }
    } else {
      const maxLimit = licenseLimits?.profiles ?? 3
      if (!isAdmin && profiles.length >= maxLimit) {
        showToast('error', `Profile limit reached (${profiles.length}/${maxLimit}). Your account is allowed a maximum of ${maxLimit} profile${maxLimit === 1 ? '' : 's'}. Please upgrade your subscription plan.`)
        return
      }

      const result = await window.api.createProfile(sessionToken, input)
      if (result.success) {
        const createdName = result.data?.name || input.name || 'New Profile'
        showToast('success', `Profile "${createdName}" created`)
        if (result.data) {
          setProfiles(prev => {
            const exists = prev.some(p => p.id === result.data!.id)
            return exists ? prev : [result.data!, ...prev]
          })
        }
        setShowCreate(false)
        loadProfiles()
        refreshProxiesList()
      } else {
        showToast('error', result.error || 'Failed to create profile')
      }
    }
  }

  const handleBulkCreate = async (count: number, osType: string, namePrefix: string, groupId?: string, proxyId?: string) => {
    if (!sessionToken) return
    const maxLimit = licenseLimits?.profiles ?? 3
    if (!isAdmin && profiles.length + count > maxLimit) {
      const remaining = Math.max(0, maxLimit - profiles.length)
      showToast('error', `Cannot create ${count} profiles. Your account quota only allows ${remaining} more profile(s) (${profiles.length}/${maxLimit}).`)
      return
    }
    let successCount = 0
    for (let i = 1; i <= count; i++) {
      const name = `${namePrefix} ${i}`
      const res = await window.api.createProfile(sessionToken, {
        name,
        osType,
        groupId,
        proxyId
      })
      if (res.success) {
        successCount++
        if (res.data) {
          setProfiles(prev => {
            const exists = prev.some(p => p.id === res.data!.id)
            return exists ? prev : [res.data!, ...prev]
          })
        }
      } else {
        showToast('error', res.error || 'Profile limit reached.')
        break
      }
    }
    if (successCount > 0) {
      showToast('success', `Created ${successCount} profiles successfully`)
    }
    loadProfiles()
  }

  const handleSelectTemplate = async (templateOs: string, templateName: string, mode: 'create' | 'edit') => {
    if (!sessionToken) return
    if (mode === 'edit') {
      setEditId(null)
      setEditProfile({
        name: templateName,
        osType: templateOs,
        fingerprint: {}
      } as any)
      setShowCreate(true)
    } else {
      const maxLimit = licenseLimits?.profiles ?? 3
      if (!isAdmin && profiles.length >= maxLimit) {
        showToast('error', `Profile limit reached (${profiles.length}/${maxLimit}). Your account is allowed a maximum of ${maxLimit} profile${maxLimit === 1 ? '' : 's'}. Please upgrade your plan.`)
        return
      }

      const res = await window.api.createProfile(sessionToken, {
        name: templateName,
        osType: templateOs
      })
      if (res.success) {
        showToast('success', `Created profile "${templateName}"`)
        if (res.data) {
          setProfiles(prev => {
            const exists = prev.some(p => p.id === res.data!.id)
            return exists ? prev : [res.data!, ...prev]
          })
        }
        loadProfiles()
      } else {
        showToast('error', res.error || 'Failed to create template profile')
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profiles</h1>
          <p className="page-subtitle">{profiles.length} browser profile{profiles.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!isAdmin && licenseLimits && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: profiles.length >= (licenseLimits.profiles ?? 3) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: profiles.length >= (licenseLimits.profiles ?? 3) ? '#EF4444' : '#60A5FA',
              border: `1px solid ${profiles.length >= (licenseLimits.profiles ?? 3) ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              <span>Profiles: {profiles.length} / {licenseLimits.profiles ?? 3}</span>
              {profiles.length >= (licenseLimits.profiles ?? 3) && (
                <button
                  className="btn btn-sm btn-primary"
                  style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', marginLeft: 4 }}
                  onClick={onUpgrade}
                >
                  Upgrade
                </button>
              )}
            </div>
          )}
          <button className="btn btn-ghost btn-icon" onClick={loadProfiles} title="Refresh">
            <span style={{ width: 16, height: 16, display: 'flex' }}>{Icons.refresh}</span>
          </button>
          <button className="btn btn-secondary" onClick={() => setShowBrowserSetup(true)} title="Configure Browser Engine">
            🌐 Browser Setup
          </button>
          <button className="btn btn-secondary" onClick={() => setShowTemplates(true)}>
            🎨 Templates
          </button>
          <button className="btn btn-secondary" onClick={() => setShowBulk(true)}>
            📦 Bulk Create
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const maxLimit = licenseLimits?.profiles ?? 3
              if (!isAdmin && profiles.length >= maxLimit) {
                showToast('error', `Profile limit reached (${profiles.length}/${maxLimit}). Your account is allowed a maximum of ${maxLimit} profile${maxLimit === 1 ? '' : 's'}. Please upgrade your plan in the Web Control Center.`)
                return
              }
              setEditId(null)
              setEditProfile(null)
              setShowCreate(true)
            }}
          >
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.plus}</span>
            New Profile
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 400, position: 'relative' }}>
          <span className="topbar-search-icon">{Icons.search}</span>
          <input
            className="form-input"
            placeholder="Search profiles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 3, gap: 4 }}>
          <button
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-secondary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 'calc(var(--radius-md) - 2px)', fontWeight: viewMode === 'grid' ? 600 : 400 }}
            onClick={() => { setViewMode('grid'); localStorage.setItem('profiles_view_mode', 'grid'); }}
            title="Grid View"
          >
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.grid}</span> Grid
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-secondary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 'calc(var(--radius-md) - 2px)', fontWeight: viewMode === 'list' ? 600 : 400 }}
            onClick={() => { setViewMode('list'); localStorage.setItem('profiles_view_mode', 'list'); }}
            title="List View"
          >
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.list}</span> List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="loading-spinner" /></div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌐</div>
          <div className="empty-state-title">{search ? 'No matching profiles' : 'No profiles yet'}</div>
          <div className="empty-state-text">
            {search ? 'Try a different search term.' : 'Create your first browser profile to get started.'}
          </div>
          {!search && (
            <button
              className="btn btn-primary"
              onClick={() => {
                const maxLimit = licenseLimits?.profiles ?? 3
                if (!isAdmin && profiles.length >= maxLimit) {
                  showToast('error', `Profile limit reached (${profiles.length}/${maxLimit}). Your account is allowed a maximum of ${maxLimit} profile${maxLimit === 1 ? '' : 's'}. Please upgrade your plan in the Web Control Center.`)
                  return
                }
                setEditId(null)
                setEditProfile(null)
                setShowCreate(true)
              }}
            >
              Create Profile
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid-profiles">
          {profiles.map((p) => (
            <ProfileCardComponent
              key={p.id}
              profile={p}
              proxies={proxies}
              brandingConfig={brandingConfig}
              isSyncingProxy={syncingProfileId === p.id}
              onStart={() => handleStartProfile(p)}
              onStop={async () => {
                if (!sessionToken) return
                const r = await window.api.stopProfile(sessionToken, p.id)
                if (r.success) showToast('success', `Stopped "${p.name}"`)
                else showToast('error', r.error || 'Failed to stop')
                loadProfiles()
              }}
              onRefreshProxy={() => handleRefreshProxy(p)}
              onConnectGoogle={() => handleConnectGoogle(p)}
              onOpenGmail={() => handleOpenGmail(p)}
              onTestGmailApi={() => handleTestGmailApi(p)}
              onDisconnectGoogle={() => handleDisconnectGoogle(p)}
              onClearCookies={() => confirm({
                title: 'Clear Cookies & Cache',
                message: `Are you sure you want to clear all cookies, active login sessions, and web cache for "${p.name}"? Your profile fingerprint and settings will be preserved.`,
                confirmLabel: 'Clear Cookies',
                danger: false,
                onConfirm: async () => {
                  if (!sessionToken) return
                  const r = await window.api.clearProfileCookies(sessionToken, p.id)
                  if (r.success) { showToast('success', `✓ Cookies & cache cleared for "${p.name}"`); loadProfiles() }
                  else showToast('error', r.error || 'Failed to clear cookies')
                }
              })}
              onEdit={() => {
                setEditId(p.id)
                setEditProfile(p)
                setShowCreate(true)
              }}
              onDuplicate={async () => {
                if (!sessionToken) return
                const r = await window.api.duplicateProfile(sessionToken, p.id)
                if (r.success) { showToast('success', 'Profile duplicated'); loadProfiles() }
                else showToast('error', r.error || 'Failed to duplicate')
              }}
              onDelete={() => confirm({
                title: 'Delete Profile',
                message: `Are you sure you want to delete "${p.name}"? This will also remove all browser data for this profile. This action cannot be undone.`,
                confirmLabel: 'Delete',
                danger: true,
                onConfirm: async () => {
                  if (!sessionToken) return
                  const r = await window.api.deleteProfile(sessionToken, p.id)
                  if (r.success) { showToast('success', 'Profile deleted'); loadProfiles() }
                  else showToast('error', r.error || 'Failed to delete')
                }
              })}
            />
          ))}
        </div>
      ) : (
        <div className="profile-list-container">
          {profiles.map((p) => (
            <ProfileListRowComponent
              key={p.id}
              profile={p}
              proxies={proxies}
              brandingConfig={brandingConfig}
              isSyncingProxy={syncingProfileId === p.id}
              onStart={() => handleStartProfile(p)}
              onStop={async () => {
                if (!sessionToken) return
                const r = await window.api.stopProfile(sessionToken, p.id)
                if (r.success) showToast('success', `Stopped "${p.name}"`)
                else showToast('error', r.error || 'Failed to stop')
                loadProfiles()
              }}
              onRefreshProxy={() => handleRefreshProxy(p)}
              onConnectGoogle={() => handleConnectGoogle(p)}
              onOpenGmail={() => handleOpenGmail(p)}
              onTestGmailApi={() => handleTestGmailApi(p)}
              onDisconnectGoogle={() => handleDisconnectGoogle(p)}
              onClearCookies={() => confirm({
                title: 'Clear Cookies & Cache',
                message: `Are you sure you want to clear all cookies, active login sessions, and web cache for "${p.name}"? Your profile fingerprint and settings will be preserved.`,
                confirmLabel: 'Clear Cookies',
                danger: false,
                onConfirm: async () => {
                  if (!sessionToken) return
                  const r = await window.api.clearProfileCookies(sessionToken, p.id)
                  if (r.success) { showToast('success', `✓ Cookies & cache cleared for "${p.name}"`); loadProfiles() }
                  else showToast('error', r.error || 'Failed to clear cookies')
                }
              })}
              onEdit={() => {
                setEditId(p.id)
                setEditProfile(p)
                setShowCreate(true)
              }}
              onDuplicate={async () => {
                if (!sessionToken) return
                const r = await window.api.duplicateProfile(sessionToken, p.id)
                if (r.success) { showToast('success', 'Profile duplicated'); loadProfiles() }
                else showToast('error', r.error || 'Failed to duplicate')
              }}
              onDelete={() => confirm({
                title: 'Delete Profile',
                message: `Are you sure you want to delete "${p.name}"? This will also remove all browser data for this profile. This action cannot be undone.`,
                confirmLabel: 'Delete',
                danger: true,
                onConfirm: async () => {
                  if (!sessionToken) return
                  const r = await window.api.deleteProfile(sessionToken, p.id)
                  if (r.success) { showToast('success', 'Profile deleted'); loadProfiles() }
                  else showToast('error', r.error || 'Failed to delete')
                }
              })}
            />
          ))}
        </div>
      )}

      {/* Modals wrapped in ErrorBoundary */}
      <ErrorBoundary fallbackTitle="Profile Editor Error">
        <ProfileModal
          isOpen={showCreate}
          onClose={() => { setShowCreate(false); setEditId(null); setEditProfile(null) }}
          onSave={handleSaveProfile}
          initialProfile={editProfile}
          proxies={proxies}
          groups={groups}
          existingProfiles={profiles}
          licenseInfo={licenseInfo}
          onUpgrade={onUpgrade}
        />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Bulk Profile Creator Error">
        <BulkProfileModal
          isOpen={showBulk}
          onClose={() => setShowBulk(false)}
          onBulkCreate={handleBulkCreate}
          groups={groups}
          proxies={proxies}
        />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Templates Modal Error">
        <TemplatesModal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          onSelectTemplate={handleSelectTemplate}
        />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Browser Setup Modal Error">
        <BrowserSetupModal
          isOpen={showBrowserSetup}
          onClose={() => { setShowBrowserSetup(false); setPendingProfile(null) }}
          onLaunchProfile={() => {
            if (pendingProfile) {
              const toStart = pendingProfile
              setPendingProfile(null)
              setShowBrowserSetup(false)
              handleStartProfile(toStart)
            }
          }}
          showToast={showToast}
        />
      </ErrorBoundary>

      <RuntimeProvisioningModal
        data={provisioningProgress}
        onClose={() => setProvisioningProgress(null)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════
// Groups Page
// ═══════════════════════════════════════════

function GroupsPage({ showToast, confirm }: { showToast: (type: ToastItem['type'], msg: string) => void; confirm: (c: Omit<ConfirmState, 'show'>) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366F1')

  const load = useCallback(async () => {
    const r = await window.api.getGroups()
    if (r.success && r.data) setGroups(r.data)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const r = await window.api.createGroup({ name: newName, color: newColor })
    if (r.success) { showToast('success', 'Group created'); setShowCreate(false); setNewName(''); load() }
    else showToast('error', r.error || 'Failed to create group')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">Organize profiles into groups</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.plus}</span> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <div className="empty-state-title">No groups yet</div>
          <div className="empty-state-text">Groups help you organize profiles by project, client, or purpose.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Group</button>
        </div>
      ) : (
        <div className="grid-profiles">
          {groups.map((g) => (
            <div key={g.id} className="card" style={{ borderLeft: `3px solid ${g.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
                  <div className="text-sm text-secondary" style={{ marginTop: 4 }}>{g.profileCount ?? 0} profile{g.profileCount !== 1 ? 's' : ''}</div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => confirm({
                  title: 'Delete Group', message: `Delete "${g.name}"? Profiles in this group will be ungrouped.`,
                  confirmLabel: 'Delete', danger: true,
                  onConfirm: async () => { await window.api.deleteGroup(g.id); showToast('success', 'Group deleted'); load() }
                })}>
                  <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.trash}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <>
          <div className="modal-backdrop" onClick={() => setShowCreate(false)} />
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">New Group</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><span style={{ width: 18, height: 18, display: 'flex' }}>{Icons.x}</span></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Group Name</label>
                <input className="form-input" placeholder="e.g. Development, Clients, Testing" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }} />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Create Group</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Proxies Page
// ═══════════════════════════════════════════

function ProxiesPage({ showToast, confirm, licenseInfo, onUpgrade }: { showToast: (type: ToastItem['type'], msg: string) => void; confirm: (c: Omit<ConfirmState, 'show'>) => void; licenseInfo?: any; onUpgrade: () => void }) {
  const isFreePlan = licenseInfo?.features?.proxy_support === 'basic' || licenseInfo?.plan?.id === 'plan_free' || (licenseInfo?.limits?.profiles === 3 && !licenseInfo?.features?.advanced_fingerprint)
  const [proxies, setProxies] = useState<ProxyDisplay[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editProxy, setEditProxy] = useState<ProxyDisplay | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, ProxyTestResult>>({})
  const [form, setForm] = useState({ name: '', type: 'http' as string, host: '', port: 8080, username: '', password: '' })
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'http' as string,
    host: '',
    port: 8080,
    username: '',
    password: '',
    country: '',
    region: '',
    city: '',
    isp: '',
    asn: '',
    timezone: '',
    latitude: '' as any,
    longitude: '' as any
  })

  const load = useCallback(async () => {
    const r = await window.api.getProxies()
    if (r.success && r.data) setProxies(r.data)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    if (isFreePlan && form.type !== 'http') {
      showToast('error', `Proxy type "${form.type.toUpperCase()}" requires Starter plan ($19/mo) or higher. Your Free plan includes Basic HTTP proxy support only.`)
      onUpgrade()
      return
    }
    const r = await window.api.createProxy(form)
    if (r.success) { showToast('success', 'Proxy created'); setShowCreate(false); setForm({ name: '', type: 'http', host: '', port: 8080, username: '', password: '' }); load() }
    else {
      showToast('error', r.error || 'Failed to create proxy')
      if (r.lockedFeature === 'proxy_support') {
        onUpgrade()
      }
    }
  }

  const handleOpenEdit = (px: ProxyDisplay) => {
    setEditProxy(px)
    setEditForm({
      name: px.name || '',
      type: px.type || 'http',
      host: px.host || '',
      port: px.port || 8080,
      username: px.username || '',
      password: '',
      country: px.country || '',
      region: px.region || '',
      city: px.city || '',
      isp: px.isp || '',
      asn: px.asn || '',
      timezone: px.timezone || '',
      latitude: px.latitude !== undefined && px.latitude !== null ? String(px.latitude) : '',
      longitude: px.longitude !== undefined && px.longitude !== null ? String(px.longitude) : ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editProxy) return
    const lat = editForm.latitude !== '' && !isNaN(Number(editForm.latitude)) ? Number(editForm.latitude) : undefined
    const lon = editForm.longitude !== '' && !isNaN(Number(editForm.longitude)) ? Number(editForm.longitude) : undefined

    const r = await window.api.updateProxy(editProxy.id, {
      name: editForm.name.trim(),
      type: editForm.type,
      host: editForm.host.trim(),
      port: Number(editForm.port) || 80,
      username: editForm.username.trim() || undefined,
      password: editForm.password ? editForm.password : undefined,
      country: editForm.country.trim() || undefined,
      region: editForm.region.trim() || undefined,
      city: editForm.city.trim() || undefined,
      isp: editForm.isp.trim() || undefined,
      asn: editForm.asn.trim() || undefined,
      timezone: editForm.timezone.trim() || undefined,
      latitude: lat,
      longitude: lon
    })

    if (r.success) {
      showToast('success', `✓ Proxy location updated & synchronized across linked browser profiles`)
      setEditProxy(null)
      load()
    } else {
      showToast('error', r.error || 'Failed to update proxy')
    }
  }

  const handleRefreshProxy = async (id: string) => {
    setSyncing(id)
    try {
      const r = await window.api.refreshProxy(id)
      if (r.success && r.data) {
        const count = r.updatedProfilesCount !== undefined ? r.updatedProfilesCount : 0
        showToast('success', `✓ Proxy synced: ${r.data.city || 'N/A'}, ${r.data.region || 'N/A'}, ${r.data.country || 'N/A'} (Updated ${count} linked profile${count === 1 ? '' : 's'})`)
      } else {
        showToast('error', r.error || 'Failed to sync proxy')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Sync failed')
    } finally {
      setSyncing(null)
      load()
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    const r = await window.api.testProxy(id)
    if (r.success && r.data) {
      setTestResults(prev => ({ ...prev, [id]: r.data }))
      if (r.data.success) showToast('success', `Proxy connected (${r.data.latency}ms)${r.data.ip ? ` — IP: ${r.data.ip}` : ''}`)
      else showToast('error', `Proxy test failed: ${r.data.error || 'Timed out'}`)
    } else {
      showToast('error', 'Failed to test proxy')
    }
    setTesting(null)
    load()
  }

  const statusBadge = (status: string) => {
    if (status === 'success') return <span className="badge badge-success">✓ Connected</span>
    if (status === 'failed') return <span className="badge badge-error">✕ Failed</span>
    if (status === 'testing') return <span className="badge badge-warning">Testing...</span>
    return <span className="badge">Untested</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proxies</h1>
          <p className="page-subtitle">Manage proxy configurations, real-time location sync & fingerprint coordinates</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load} title="Refresh Proxy List">
            🔄 Refresh All
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.plus}</span> Add Proxy
          </button>
        </div>
      </div>

      {proxies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <div className="empty-state-title">No proxies configured</div>
          <div className="empty-state-text">Add proxy servers to route browser traffic through different networks.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add Proxy</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {proxies.map((px) => {
            const hasResult = !!testResults[px.id]
            const info = testResults[px.id] || (px.country || px.city ? {
              success: px.testStatus === 'success',
              latency: 0,
              ip: px.host,
              proxyName: px.name,
              proxyType: px.type.toUpperCase(),
              country: px.country,
              countryName: px.country,
              city: px.city,
              region: px.region,
              regionName: px.region,
              isp: px.isp,
              timezone: px.timezone,
              latitude: px.latitude,
              longitude: px.longitude,
              zip: 'N/A'
            } : null)

            return (
              <div key={px.id} className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{px.name}</span>
                      {px.country && <span style={{ fontSize: '12px', color: '#94A3B8' }}>• {px.country} {px.city ? `/ ${px.city}` : ''} {px.region ? `(${px.region})` : ''}</span>}
                      {px.timezone && <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '2px 6px', borderRadius: '4px' }}>TZ: {px.timezone}</span>}
                    </div>
                    <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
                      {px.type}://{px.host}:{px.port}{px.username ? ` (auth: ${px.username})` : ''}
                      {px.latitude !== undefined && px.longitude !== undefined ? ` • [${Number(px.latitude).toFixed(4)}, ${Number(px.longitude).toFixed(4)}]` : ''}
                    </div>
                  </div>
                  {statusBadge(px.testStatus)}
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleRefreshProxy(px.id)}
                    disabled={syncing === px.id}
                    title="Reload and synchronize proxy location to all linked browser profiles"
                    style={{ color: '#38BDF8' }}
                  >
                    {syncing === px.id ? <div className="loading-spinner" style={{ width: 14, height: 14 }} /> : '🔄 Sync'}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleTest(px.id)} disabled={testing === px.id}>
                    {testing === px.id ? <div className="loading-spinner" style={{ width: 14, height: 14 }} /> : 'Check Proxy'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleOpenEdit(px)} title="Edit Location / Proxy Settings">
                    <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.edit}</span>
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => confirm({
                    title: 'Delete Proxy', message: `Delete "${px.name}"? Profiles using this proxy will switch to direct connection.`,
                    confirmLabel: 'Delete', danger: true,
                    onConfirm: async () => { await window.api.deleteProxy(px.id); showToast('success', 'Proxy deleted'); load() }
                  })}>
                    <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.trash}</span>
                  </button>
                </div>

                {/* Rich Geo Details Card */}
                {info && (
                  <ProxyInfoCard
                    info={info}
                    loading={testing === px.id}
                    showTestButton={false}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Proxy / Geo Location Modal */}
      {editProxy && (
        <>
          <div className="modal-backdrop" onClick={() => setEditProxy(null)} />
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Proxy & Geo Location</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditProxy(null)}><span style={{ width: 18, height: 18, display: 'flex' }}>{Icons.x}</span></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Proxy Name</label>
                  <input className="form-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="grid-form">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="socks5">SOCKS5</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input className="form-input" type="number" value={editForm.port} onChange={(e) => setEditForm({ ...editForm, port: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Host</label>
                  <input className="form-input" value={editForm.host} onChange={(e) => setEditForm({ ...editForm, host: e.target.value })} />
                </div>
                <div className="grid-form">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-input" placeholder="e.g. Los Angeles, Chicago, New York" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State / Region</label>
                    <input className="form-input" placeholder="e.g. CA, IL, NY, England" value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} />
                  </div>
                </div>
                <div className="grid-form">
                  <div className="form-group">
                    <label className="form-label">Country Code</label>
                    <input className="form-input" placeholder="e.g. US, GB, DE" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Timezone</label>
                    <input className="form-input" placeholder="e.g. America/Los_Angeles" value={editForm.timezone} onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })} />
                  </div>
                </div>
                <div className="grid-form">
                  <div className="form-group">
                    <label className="form-label">Latitude (optional)</label>
                    <input className="form-input" placeholder="e.g. 34.0522" value={editForm.latitude} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude (optional)</label>
                    <input className="form-input" placeholder="e.g. -118.2437" value={editForm.longitude} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">ISP / Organization</label>
                  <input className="form-input" placeholder="e.g. AT&T Services, Comcast" value={editForm.isp} onChange={(e) => setEditForm({ ...editForm, isp: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditProxy(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={!editForm.name.trim() || !editForm.host.trim()}>Save & Sync Profiles</button>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <>
          <div className="modal-backdrop" onClick={() => setShowCreate(false)} />
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Proxy</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><span style={{ width: 18, height: 18, display: 'flex' }}>{Icons.x}</span></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Proxy Name</label>
                  <input className="form-input" placeholder="e.g. US Proxy" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                </div>
                <div className="grid-form">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      <option value="http">HTTP</option>
                      <option value="https" disabled={isFreePlan}>HTTPS {isFreePlan ? '🔒 (Starter $19/mo)' : ''}</option>
                      <option value="socks5" disabled={isFreePlan}>SOCKS5 {isFreePlan ? '🔒 (Starter $19/mo)' : ''}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input className="form-input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                {isFreePlan && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span>🔒 Free plan includes Basic HTTP proxies. SOCKS & HTTPS require Starter ($19/mo).</span>
                    <button type="button" onClick={() => { setShowCreate(false); onUpgrade() }} style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F59E0B', color: '#000', border: 'none', fontWeight: 700, fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>Upgrade</button>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Host</label>
                  <input className="form-input" placeholder="proxy.example.com or 1.2.3.4" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
                </div>
                <div className="grid-form">
                  <div className="form-group">
                    <label className="form-label">Username (optional)</label>
                    <input className="form-input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password (optional)</label>
                    <input className="form-input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim() || !form.host.trim()}>Add Proxy</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Automation Page
// ═══════════════════════════════════════════

function AutomationPage({ showToast, licenseInfo, onUpgrade }: { showToast: (type: ToastItem['type'], msg: string) => void; licenseInfo?: any; onUpgrade: () => void }) {
  const [apiRunning, setApiRunning] = useState(false)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const isApiLocked = licenseInfo?.features?.has_api === false || licenseInfo?.features?.api_access === 'none' || licenseInfo?.plan?.id === 'plan_free'
  const apiTier = licenseInfo?.features?.api_access || (isApiLocked ? 'none' : 'basic')

  useEffect(() => {
    window.api.isApiRunning().then((r) => { if (r.success) setApiRunning(r.data!) })
    window.api.getApiToken().then((r) => { if (r.success) setToken(r.data!) })
  }, [])

  const toggleApi = async () => {
    if (isApiLocked) {
      showToast('error', 'Automation API is locked on the Free plan. Upgrade to Starter ($19/mo) or higher.')
      onUpgrade()
      return
    }
    if (apiRunning) {
      await window.api.stopApi()
      setApiRunning(false)
      showToast('info', 'API server stopped')
    } else {
      await window.api.startApi()
      setApiRunning(true)
      showToast('success', 'API server started on port 37100')
    }
  }

  const rotateToken = async () => {
    const r = await window.api.rotateApiToken()
    if (r.success) { setToken(r.data!); showToast('success', 'API token rotated') }
  }

  const endpoints = [
    { method: 'GET', path: '/api/v1/status', desc: 'Health check' },
    { method: 'GET', path: '/api/v1/profiles', desc: 'List all profiles' },
    { method: 'POST', path: '/api/v1/profiles', desc: 'Create profile' },
    { method: 'GET', path: '/api/v1/profiles/:id', desc: 'Get profile' },
    { method: 'PUT', path: '/api/v1/profiles/:id', desc: 'Update profile' },
    { method: 'DELETE', path: '/api/v1/profiles/:id', desc: 'Delete profile' },
    { method: 'POST', path: '/api/v1/profiles/:id/start', desc: 'Launch browser' },
    { method: 'POST', path: '/api/v1/profiles/:id/stop', desc: 'Stop browser' },
    { method: 'GET', path: '/api/v1/profiles/:id/status', desc: 'Browser status' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Automation API</h1>
            {isApiLocked ? (
              <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '10px' }}>🔒 LOCKED (FREE PLAN)</span>
            ) : apiTier === 'basic' ? (
              <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '10px' }}>⚡ BASIC API (60 req/min)</span>
            ) : apiTier === 'full' ? (
              <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(45, 212, 191, 0.15)', color: '#2DD4BF', border: '1px solid rgba(45, 212, 191, 0.3)', padding: '2px 8px', borderRadius: '10px' }}>🚀 FULL REST & DRIVER API</span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(129, 140, 248, 0.15)', color: '#818CF8', border: '1px solid rgba(129, 140, 248, 0.3)', padding: '2px 8px', borderRadius: '10px' }}>💎 UNLIMITED API</span>
            )}
          </div>
          <p className="page-subtitle">Control profiles programmatically via REST & Driver Automation APIs</p>
        </div>
        <button className={`btn ${apiRunning ? 'btn-danger' : isApiLocked ? 'btn-secondary' : 'btn-success'}`} onClick={toggleApi}>
          {apiRunning ? '● Stop API' : isApiLocked ? '🔒 Start API' : '○ Start API'}
        </button>
      </div>

      {isApiLocked && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '16px', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFF', marginBottom: '8px' }}>Automation API is Locked on Free Plan</h2>
          <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '560px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            Control and automate your browser profiles programmatically with Puppeteer, Playwright, Selenium, and REST API. Upgrade to Starter ($19/mo) or higher to unlock API automation.
          </p>
          <div style={{ display: 'inline-flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ background: '#1E293B', padding: '14px 18px', borderRadius: '10px', border: '1px solid #334155', textAlign: 'left', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, color: '#CBD5E1', marginBottom: '4px' }}>Starter Plan ($19/mo)</div>
              <div style={{ color: '#94A3B8' }}>• Basic API (60 req/min)</div>
              <div style={{ color: '#94A3B8' }}>• Profile start/stop/status</div>
            </div>
            <div style={{ background: '#1E293B', padding: '14px 18px', borderRadius: '10px', border: '1px solid #2DD4BF', textAlign: 'left', fontSize: '12px', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-10px', right: '10px', background: '#2DD4BF', color: '#000', fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '6px' }}>MOST POPULAR</span>
              <div style={{ fontWeight: 700, color: '#2DD4BF', marginBottom: '4px' }}>Professional Plan ($49/mo)</div>
              <div style={{ color: '#CBD5E1' }}>• Full REST & Driver API (300 req/min)</div>
              <div style={{ color: '#CBD5E1' }}>• Puppeteer / Playwright CDP wsEndpoint</div>
            </div>
            <div style={{ background: '#1E293B', padding: '14px 18px', borderRadius: '10px', border: '1px solid #818CF8', textAlign: 'left', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, color: '#818CF8', marginBottom: '4px' }}>Business Plan ($99/mo)</div>
              <div style={{ color: '#CBD5E1' }}>• Unlimited / High-Limit API</div>
              <div style={{ color: '#CBD5E1' }}>• Dedicated Account Manager</div>
            </div>
          </div>
          <div>
            <button 
              type="button" 
              onClick={onUpgrade} 
              className="btn btn-primary"
              style={{ padding: '10px 28px', fontSize: '14px', fontWeight: 800, background: 'linear-gradient(135deg, #2DD4BF, #06B6D4)', color: '#000', cursor: 'pointer' }}
            >
              ⚡ Pay & Upgrade Plan to Unlock API
            </button>
          </div>
        </div>
      )}

      {apiTier === 'basic' && (
        <div style={{ padding: '12px 18px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93C5FD', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <span style={{ fontWeight: 700, color: '#FFF' }}>Basic API Active (Starter Plan):</span> Rate limited to 60 req/min.
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Need Puppeteer / Playwright CDP Driver API (wsEndpoint)? Upgrade to Professional ($49/mo).</div>
          </div>
          <button type="button" onClick={onUpgrade} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#3B82F6', color: '#FFF', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>Upgrade</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="section-title"><span style={{ width: 16, height: 16, display: 'inline-flex' }}>{Icons.key}</span> API Token</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input" readOnly value={showToken ? token : '•'.repeat(40)} style={{ fontFamily: 'monospace', flex: 1 }} />
          <button className="btn btn-secondary" onClick={() => setShowToken(!showToken)}>{showToken ? 'Hide' : 'Show'}</button>
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(token); showToast('success', 'Token copied') }}>Copy</button>
          <button className="btn btn-ghost" onClick={rotateToken}>Rotate</button>
        </div>
        <p className="text-sm text-secondary" style={{ marginTop: 8 }}>Use this token in the <code>Authorization: Bearer &lt;token&gt;</code> header.</p>
      </div>

      <div className="section">
        <h3 className="section-title">Endpoints</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {endpoints.map((ep, i) => (
            <div key={i} className="api-endpoint">
              <span className={`api-method ${ep.method.toLowerCase()}`}>{ep.method}</span>
              <span style={{ flex: 1 }}>{ep.path}</span>
              <span className="text-secondary text-sm">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Example Usage</h3>
        <pre style={{ background: 'var(--color-bg-tertiary)', padding: 16, borderRadius: 8, fontSize: 12, fontFamily: 'monospace', overflow: 'auto', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
{`# List profiles
curl -H "Authorization: Bearer YOUR_TOKEN" \\
  http://127.0.0.1:37100/api/v1/profiles

# Start a profile
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \\
  http://127.0.0.1:37100/api/v1/profiles/PROFILE_ID/start`}
        </pre>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════

function SettingsPage({ theme, setTheme, showToast, licenseInfo, onUpgrade, onNavigateAdmin, onOpenChangelog }: {
  theme: string
  setTheme: (t: string) => void
  showToast: (type: ToastItem['type'], msg: string) => void
  licenseInfo?: any
  onUpgrade?: () => void
  onNavigateAdmin?: (tab: string) => void
  onOpenChangelog?: () => void
}) {
  const { currentUser, isAdmin, updateProfile, changePassword, refreshProfile } = useAuth()
  const [chromiumPath, setChromiumPath] = useState<string | null>(null)
  const [engineType, setEngineType] = useState<string>('Google Chrome')
  const [version, setVersion] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any | null>(null)
  const [diagnostics, setDiagnostics] = useState<any | null>(null)
  const [discoveredBrowsers, setDiscoveredBrowsers] = useState<any[]>([])
  const [clearingCache, setClearingCache] = useState(false)

  // Profile and Password Management State
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState(currentUser?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Enterprise Auto-Update Settings State
  const [updateSettings, setUpdateSettings] = useState<any>(null)
  const [updatePlatform, setUpdatePlatform] = useState<any>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) {
      showToast('warning', 'Please enter your name.')
      return
    }
    setSavingProfile(true)
    try {
      const res = await updateProfile(editName.trim())
      if (res?.success) {
        showToast('success', '✓ Profile name updated successfully!')
        setShowEditProfile(false)
      } else {
        showToast('error', res?.error || 'Failed to update profile.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      showToast('warning', 'New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('warning', 'New passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const res = await changePassword(oldPassword, newPassword)
      if (res?.success) {
        showToast('success', '✓ Password changed successfully!')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowChangePassword(false)
      } else {
        showToast('error', res?.error || 'Failed to change password.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const loadUpdateSettings = useCallback(async () => {
    try {
      if ((window as any).api?.updaterGetSettings) {
        const res = await (window as any).api.updaterGetSettings()
        if (res?.success && res?.data) {
          setUpdateSettings(res.data)
          setUpdatePlatform(res.data.platform)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadUpdateSettings()
  }, [loadUpdateSettings])

  const handleManualCheck = async () => {
    setCheckingUpdate(true)
    try {
      if ((window as any).api?.updaterCheckLatest) {
        const res = await (window as any).api.updaterCheckLatest()
        if (res?.success && res?.data?.hasUpdate) {
          showToast('info', `🚀 New Update Available: v${res.data.latestVersion?.version}!`)
        } else {
          showToast('success', '✓ You are using the latest version of AntiProfiles.')
        }
        await loadUpdateSettings()
      }
    } catch (err: any) {
      showToast('error', `Update check failed: ${err.message}`)
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleChannelChange = async (channel: string) => {
    try {
      if ((window as any).api?.updaterSaveSettings) {
        const res = await (window as any).api.updaterSaveSettings({ channel })
        if (res?.success) {
          setUpdateSettings((prev: any) => ({ ...prev, channel }))
          showToast('success', `Update channel set to ${channel.toUpperCase()}`)
        }
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleAutoDownloadToggle = async (auto_download: boolean) => {
    try {
      if ((window as any).api?.updaterSaveSettings) {
        const res = await (window as any).api.updaterSaveSettings({ auto_download })
        if (res?.success) {
          setUpdateSettings((prev: any) => ({ ...prev, auto_download }))
          showToast('success', `Automatic download ${auto_download ? 'enabled' : 'disabled'}`)
        }
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      window.api.getChromiumPath().then((r) => {
        if (r.success && r.data) {
          setChromiumPath(r.data)
          runTest(r.data)
        }
      })
      runDiagnostics()
    }
    window.api.getAppVersion().then((r) => { if (r.success) setVersion(r.data!) })
  }, [isAdmin])

  const runTest = async (pathToTest?: string) => {
    const target = pathToTest || chromiumPath
    if (!target) {
      setTestResult(null)
      return
    }
    setIsTesting(true)
    try {
      const res = await window.api.testBrowser(target)
      if (res.success && res.data) {
        setTestResult(res.data)
      }
    } catch {
      // Ignored
    } finally {
      setIsTesting(false)
    }
  }

  const runDiagnostics = async () => {
    try {
      const res = await window.api.getBrowserDiagnostics()
      if (res.success && res.data) {
        setDiagnostics(res.data)
      }
    } catch {}
  }

  const handleAutoDetect = async () => {
    setIsDetecting(true)
    try {
      const res = await window.api.autoDetectBrowser()
      if (res.success && res.data) {
        if (res.data.detectedPath) {
          setChromiumPath(res.data.detectedPath)
          showToast('success', `Detected: ${res.data.detectedPath}`)
          runTest(res.data.detectedPath)
        } else {
          showToast('warning', 'No Chrome/Chromium found in standard locations.')
        }
        if (Array.isArray(res.data.allBrowsers)) {
          setDiscoveredBrowsers(res.data.allBrowsers)
        }
        runDiagnostics()
      }
    } catch (e: any) {
      showToast('error', 'Auto-detection failed: ' + e.message)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleBrowse = async () => {
    const r = await window.api.selectFile([
      { name: 'Browser Executable', extensions: ['exe', 'app', '*'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (r.success && r.data) {
      await window.api.setChromiumPath(r.data)
      setChromiumPath(r.data)
      showToast('success', 'Browser path updated')
      runTest(r.data)
      runDiagnostics()
    }
  }

  const handleReset = async () => {
    await window.api.setChromiumPath('')
    setChromiumPath(null)
    setTestResult(null)
    showToast('info', 'Chromium path reset')
    runDiagnostics()
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      if (window.api?.clearLogs) {
        await window.api.clearLogs()
      }
      setTimeout(() => {
        setClearingCache(false)
        showToast('success', '🧹 Temporary browser cache and logs successfully cleared!')
      }, 600)
    } catch {
      setClearingCache(false)
      showToast('success', '🧹 Local cache cleaned!')
    }
  }

  const planName = licenseInfo?.plan?.name || licenseInfo?.planId?.toUpperCase() || (isAdmin ? 'ENTERPRISE / ADMIN' : 'FREE ACTIVE')
  const maxProfiles = licenseInfo?.limits?.profiles ?? (isAdmin ? 'Unlimited' : 3)
  const maxDevices = licenseInfo?.limits?.devices ?? (isAdmin ? 'Unlimited' : 2)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Personal preferences, account details, and application configuration</p>
        </div>
      </div>

      {/* ── 1. User Account & Membership Profile Card ── */}
      <div className="section">
        <h3 className="section-title">Account & Subscription</h3>
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(26,26,36,0.9), rgba(18,18,26,0.9))', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  color: '#FFF',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                }}
              >
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : (currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : '👤')}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 16, color: '#FFF', fontWeight: 600 }}>{currentUser?.name || 'User Profile'}</h4>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: isAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(45,212,191,0.15)',
                      color: isAdmin ? '#F59E0B' : '#2DD4BF',
                      border: `1px solid ${isAdmin ? '#F59E0B40' : '#2DD4BF40'}`
                    }}
                  >
                    {isAdmin ? '👑 ADMIN' : '👤 USER'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                  {currentUser?.email || 'user@antiprofiles.com'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditName(currentUser?.name || '')
                  setShowEditProfile(!showEditProfile)
                  setShowChangePassword(false)
                }}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                ✏️ Edit Name
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowChangePassword(!showChangePassword)
                  setShowEditProfile(false)
                }}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                🔑 Change Password
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await refreshProfile()
                  showToast('success', '✓ Profile information refreshed.')
                }}
                title="Refresh Profile"
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🔄 Refresh
              </button>
              <div style={{ textAlign: 'right', marginLeft: 6, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Plan</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2DD4BF' }}>{planName}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Limit: {maxProfiles} Profile{maxProfiles === 1 ? '' : 's'} • {maxDevices} Device{maxDevices === 1 ? '' : 's'}
                </div>
              </div>
              {onUpgrade && !isAdmin && (
                <button className="btn btn-primary btn-sm" onClick={onUpgrade} style={{ padding: '6px 14px' }}>
                  ⚡ Upgrade Plan
                </button>
              )}
            </div>
          </div>

          {/* Inline Profile Name Edit Form */}
          {showEditProfile && (
            <form onSubmit={handleSaveProfile} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your full name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Name'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEditProfile(false)}>
                Cancel
              </button>
            </form>
          )}

          {/* Inline Change Password Form */}
          {showChangePassword && (
            <form onSubmit={handleChangePassword} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>CURRENT PASSWORD</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>NEW PASSWORD</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>CONFIRM NEW PASSWORD</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowChangePassword(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingPassword}>
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── 2. Appearance Section ── */}
      <div className="section">
        <h3 className="section-title">Appearance</h3>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Theme Mode</div>
              <div className="text-sm text-secondary">Choose between sleek dark theme and crisp light theme</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('dark')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.moon}</span> Dark Mode
              </button>
              <button
                className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('light')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.sun}</span> Light Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Preferred Default Engine Selection ── */}
      <div className="section">
        <h3 className="section-title">Browser Engine Preference</h3>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Default Engine for New Profiles</div>
              <div className="text-sm text-secondary">Profiles will default to this engine during creation</div>
            </div>
            <div style={{ maxWidth: 400 }}>
              <select
                className="form-input"
                value={engineType}
                onChange={(e) => {
                  setEngineType(e.target.value)
                  showToast('info', `Default engine set to: ${e.target.value}`)
                }}
                style={{ width: '100%' }}
              >
                <option value="Google Chrome">Google Chromium (Official Blink Engine)</option>
                <option value="Mozilla Firefox">Mozilla Firefox (Quantum Gecko Engine)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Cache & Local Storage Management ── */}
      <div className="section">
        <h3 className="section-title">Storage & Performance</h3>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Clear Cache & Temporary Storage</div>
              <div className="text-sm text-secondary">Clears transient logs, network cache, and temporary launch data</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearCache}
              disabled={clearingCache}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {clearingCache ? '🧹 Cleaning...' : '🧹 Clean Cache'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Administrator-Only Controls & Runtime Management ── */}
      {isAdmin && (
        <div className="section" style={{ marginTop: 24, padding: 18, border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, background: 'rgba(245,158,11,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>👑</span>
                <h3 className="section-title" style={{ margin: 0, color: '#F59E0B' }}>Administrator Runtime & Engine Controls</h3>
              </div>
              <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
                Advanced system paths and standalone engine package maintenance (Visible only to Administrators)
              </div>
            </div>
          </div>

          <BrowserRuntimeManager />

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#FFF' }}>Custom Executable Override</h4>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Override Executable Path
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Auto-detected or custom binary path"
                    value={chromiumPath || ''}
                    onChange={async (e) => {
                      setChromiumPath(e.target.value)
                      if (e.target.value) {
                        await window.api.setChromiumPath(e.target.value)
                        runTest(e.target.value)
                      }
                    }}
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <button className="btn btn-secondary" onClick={handleBrowse}>
                    Browse...
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" disabled={isDetecting} onClick={handleAutoDetect}>
                  {isDetecting ? '🔍 Scanning...' : '🔍 Auto-Detect Browsers'}
                </button>
                <button className="btn btn-secondary btn-sm" disabled={isTesting || !chromiumPath} onClick={() => runTest()}>
                  {isTesting ? 'Testing...' : '⚡ Test Binary'}
                </button>
                {chromiumPath && (
                  <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                    Reset
                  </button>
                )}
              </div>

              {testResult && (
                <div
                  style={{
                    background: testResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${testResult.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 8,
                    padding: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{testResult.valid ? '✅' : '❌'}</span>
                    <strong style={{ color: testResult.valid ? '#22C55E' : '#EF4444' }}>
                      {testResult.valid ? 'Binary Validated' : 'Validation Failed'}
                    </strong>
                  </div>
                  {testResult.valid && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      {testResult.engine} v{testResult.version} • {testResult.path}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Start Page & Launch URL ── */}
      <div className="section">
        <h3 className="section-title">Start Page & Global Launch URL</h3>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: 4 }}>Authoritative Start Page (Launch URL)</div>
              <div className="text-sm text-secondary">
                Configure the master launch URL that automatically opens upon browser startup across all profiles & devices.
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 700 }}
                onClick={() => {
                  if (onNavigateAdmin) onNavigateAdmin('launch_url')
                }}
              >
                <span>🌐</span> Configure Global Launch URL
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Enterprise Software Updates & Channel Settings ── */}
      <div className="section">
        <h3 className="section-title">Software Updates & Release Channel</h3>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ fontSize: 15, color: '#FFF' }}>AntiProfiles Desktop</strong>
                <span className="badge" style={{ backgroundColor: '#2DD4BF25', color: '#2DD4BF', border: '1px solid #2DD4BF50' }}>
                  v{version || '1.0.0'}
                </span>
                {updatePlatform && (
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>• {updatePlatform.label}</span>
                )}
              </div>
              <div className="text-sm text-secondary" style={{ marginTop: 4 }}>
                Last checked: {updateSettings?.last_checked_at ? updateSettings.last_checked_at.replace('T', ' ') : 'Just now'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => onOpenChangelog && onOpenChangelog()}
              >
                📜 Version History
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={checkingUpdate}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 700 }}
                onClick={handleManualCheck}
              >
                <span>{checkingUpdate ? '🔄' : '🔍'}</span>
                <span>{checkingUpdate ? 'Checking...' : 'Check for Updates'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Update Release Channel</label>
              <select
                className="form-select"
                value={updateSettings?.channel || 'stable'}
                onChange={(e) => handleChannelChange(e.target.value)}
                style={{ width: '100%', fontSize: 13, backgroundColor: 'var(--color-bg-primary)' }}
              >
                <option value="stable">Stable (Production - Recommended)</option>
                <option value="beta">Beta (Preview Features & Fixes)</option>
                <option value="alpha">Alpha (Experimental Testing)</option>
                <option value="internal">Internal Development</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
              <input
                type="checkbox"
                id="autoDownloadSetting"
                checked={Boolean(updateSettings?.auto_download)}
                onChange={(e) => handleAutoDownloadToggle(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2DD4BF', cursor: 'pointer' }}
              />
              <label htmlFor="autoDownloadSetting" style={{ fontSize: 12, color: '#E2E8F0', cursor: 'pointer' }}>
                Automatically download updates in the background
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. About AntiProfiles ── */}
      <div className="section">
        <h3 className="section-title">About</h3>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>AntiProfiles</strong>
              <span className="badge">v{version || '1.0.0'}</span>
            </div>
            <div className="text-sm text-secondary">Next-Generation Anti-Detect Browser & Multi-Profile Privacy Management</div>
            <div className="text-sm text-secondary" style={{ marginTop: 6 }}>Built with Electron, Chromium Blink, Firefox Gecko, and Local SQLite Engine</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Logs Page
// ═══════════════════════════════════════════

function LogsPage({ showToast, confirm }: { showToast: (type: ToastItem['type'], msg: string) => void; confirm: (c: Omit<ConfirmState, 'show'>) => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState({ level: '', category: '' })

  const load = useCallback(async () => {
    const r = await window.api.getLogs(200, filter.level || undefined, filter.category || undefined)
    if (r.success && r.data) setLogs(r.data)
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Logs</h1>
          <p className="page-subtitle">System events and diagnostics</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-icon" onClick={load} title="Refresh"><span style={{ width: 16, height: 16, display: 'flex' }}>{Icons.refresh}</span></button>
          <button className="btn btn-sm btn-danger" onClick={() => confirm({
            title: 'Clear Logs', message: 'Clear all log entries? This cannot be undone.',
            confirmLabel: 'Clear', danger: true,
            onConfirm: async () => { await window.api.clearLogs(); showToast('success', 'Logs cleared'); load() }
          })}>Clear Logs</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select className="form-select" value={filter.level} onChange={(e) => setFilter({ ...filter, level: e.target.value })} style={{ width: 140 }}>
          <option value="">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <select className="form-select" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })} style={{ width: 160 }}>
          <option value="">All Categories</option>
          <option value="profile">Profile</option>
          <option value="browser">Browser</option>
          <option value="proxy">Proxy</option>
          <option value="api">API</option>
          <option value="system">System</option>
          <option value="database">Database</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No logs</div>
          <div className="empty-state-text">Events will appear here as you use the application.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--color-bg-tertiary)', borderRadius: 8, border: '1px solid var(--color-border)', maxHeight: 600, overflow: 'auto' }}>
          {logs.map((log) => (
            <div key={log.id} className="log-entry">
              <span className="log-entry-time">{new Date(log.created_at).toLocaleTimeString()}</span>
              <span className={`log-entry-level ${log.level}`}>{log.level}</span>
              <span className="log-entry-category">{log.category}</span>
              <span className="log-entry-message">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Live Support Page (Desktop Chat Interface)
// ═══════════════════════════════════════════

function SupportPage({ showToast }: { showToast: (type: ToastItem['type'], msg: string) => void }) {
  const { sessionToken, currentUser } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    if (!sessionToken) return
    try {
      const res = await fetch('https://antiprofiles.com/api/support/active-thread', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages)
      }
    } catch (e) {
      // Offline fallback
    }
  }, [sessionToken])

  useEffect(() => {
    setIsLoading(true)
    loadMessages().finally(() => setIsLoading(false))
    const interval = setInterval(loadMessages, 3500)
    return () => clearInterval(interval)
  }, [loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputMessage.trim()
    if (!text || !sessionToken || isSending) return

    setIsSending(true)
    setInputMessage('')

    const clientMsgId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

    // Optimistic message with status = 'sending'
    const tempMsg = {
      id: 'temp_' + clientMsgId,
      client_message_id: clientMsgId,
      sender_type: 'user',
      sender_name: currentUser?.name || 'You',
      message: text,
      status: 'sending',
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await fetch('https://antiprofiles.com/api/support/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          message: text,
          client_message_id: clientMsgId,
          channel: 'desktop'
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.map(m => m.client_message_id === clientMsgId ? { ...m, id: data.message_id, status: 'sent', created_at: data.created_at || m.created_at } : m))
        loadMessages()
      } else {
        setMessages(prev => prev.map(m => m.client_message_id === clientMsgId ? { ...m, status: 'failed' } : m))
        showToast('error', data.error || 'Message could not be sent. Please try again.')
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.client_message_id === clientMsgId ? { ...m, status: 'failed' } : m))
      showToast('error', 'Network error. Message could not be sent.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">24/7 Live Support & Help Desk</h1>
          <p className="page-description">Chat directly with AntiProfiles technical engineers in real time.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
          Support Engineers Online
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Main Chat Box */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Messages Stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isLoading && messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px' }}>Loading conversation history...</div>
            ) : messages.length === 0 ? (
              <div style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', maxWidth: '80%', alignSelf: 'flex-start' }}>
                <span style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: 700 }}>AntiProfiles Support Team</span>
                <p style={{ fontSize: '13px', color: '#FFF', marginTop: '4px' }}>Hello! 👋 Welcome to AntiProfiles Live Support. How can we assist you with your antidetect browser profiles, proxies, or subscriptions today?</p>
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginTop: '6px' }}>Just now</span>
              </div>
            ) : (
              messages.map(m => {
                const isAgent = m.sender_type === 'agent'
                const isFailed = m.status === 'failed'
                const isSendingMsg = m.status === 'sending'

                return (
                  <div
                    key={m.id || m.client_message_id || Math.random()}
                    style={{
                      background: isAgent ? 'var(--color-bg-tertiary)' : (isFailed ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, #2DD4BF, #06B6D4)'),
                      color: isAgent ? '#FFF' : (isFailed ? '#FCA5A5' : '#000'),
                      border: isAgent ? '1px solid var(--color-border)' : (isFailed ? '1px solid #EF4444' : 'none'),
                      borderRadius: isAgent ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                      padding: '12px 16px',
                      maxWidth: '75%',
                      alignSelf: isAgent ? 'flex-start' : 'flex-end',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isAgent ? '#2DD4BF' : (isFailed ? '#EF4444' : '#000') }}>
                        {isAgent ? (m.sender_name || 'AntiProfiles Support') : 'You'}
                      </span>
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        {isSendingMsg ? 'Sending... ⏳' : isFailed ? 'Failed ⚠️' : (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now')}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>{m.message}</p>
                    {isFailed && (
                      <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                        ⚠️ Message could not be sent. Please try again.
                      </span>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Composer Form */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', padding: '14px 18px', background: 'var(--color-bg-tertiary)', borderTop: '1px solid var(--color-border)' }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message to support..."
              disabled={isSending}
              className="form-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={isSending || !inputMessage.trim()} style={{ padding: '0 20px', fontWeight: 700 }}>
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>

        {/* Sidebar Info & FAQs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ fontSize: '14px', color: '#FFF', marginBottom: '8px' }}>⚡ Instant Help Tips</h4>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <strong style={{ color: '#2DD4BF', display: 'block' }}>Proxy Setup:</strong>
                Verify host, port, username, and password before launching profiles.
              </div>
              <div>
                <strong style={{ color: '#2DD4BF', display: 'block' }}>Fingerprint Checks:</strong>
                Test Canvas, WebGL, and Audio spoofing on pixelscan.net or browserleaks.com.
              </div>
              <div>
                <strong style={{ color: '#2DD4BF', display: 'block' }}>Device Limits:</strong>
                Manage active devices from your AntiProfiles account settings.
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>📧</span>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>Direct Email Support</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>support@antiprofiles.com</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════

function AppContent() {
  const { currentUser, sessionToken, isLoading, isAuthenticated, isVerified, isAdmin, impersonatedBy, exitImpersonation, logout } = useAuth()
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'verify' | 'landing'>('login')
  const [verifyEmailParam, setVerifyEmailParam] = useState<string | undefined>(undefined)
  const [verifyDevUrlParam, setVerifyDevUrlParam] = useState<string | undefined>(undefined)

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [currentPage, setCurrentPage] = useState<Page>('profiles')
  const [adminView, setAdminView] = useState(false)
  const [adminInitialTab, setAdminInitialTab] = useState<'users' | 'subscriptions' | 'launch_url' | 'releases' | 'cms' | 'smtp' | 'support' | 'seo' | 'affiliates' | 'audit'>('users')
  const [viewingPublicLanding, setViewingPublicLanding] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    show: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {}
  })
  const [runningCount, setRunningCount] = useState(0)

  // Subscriptions & Licensing State
  const [licenseInfo, setLicenseInfo] = useState<any | null>(null)
  const [userDevices, setUserDevices] = useState<any[]>([])
  const [showDevicesModal, setShowDevicesModal] = useState(false)
  const [profilesProxies, setProfilesProxies] = useState<ProxyDisplay[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.getProxies) {
      window.api.getProxies().then((r) => { if (r?.success && r.data) setProfilesProxies(r.data) }).catch(() => {})
    }
  }, [currentPage])

  // Real-Time Software Update State
  const [availableUpdate, setAvailableUpdate] = useState<UpdateAvailablePayload | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showChangelogModal, setShowChangelogModal] = useState(false)
  const [appVersion, setAppVersion] = useState('2.0.0')

  // Real-Time Custom Browser Branding State
  const [brandingConfig, setBrandingConfig] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).api?.getBrandingConfig) {
      (window as any).api.getBrandingConfig().then((res: any) => {
        if (res?.success && res?.data) setBrandingConfig(res.data)
      }).catch(() => {})
    }
    const unsub = (window as any).api?.onBrandingUpdated?.((_e: any, config: any) => {
      if (config) setBrandingConfig(config)
    })
    return () => { if (unsub) unsub() }
  }, [])

  // Real-Time Central Synchronization State
  const [syncStatus, setSyncStatus] = useState<{
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'syncing' | 'error'
    authVersion: number
    lastSyncTime: string
    cachedState?: any
  }>({
    status: 'disconnected',
    authVersion: 1,
    lastSyncTime: 'Never'
  })

  const [installationId] = useState(() => {
    let id = localStorage.getItem('pv_installation_id')
    if (!id) {
      id = `device_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`
      localStorage.setItem('pv_installation_id', id)
    }
    return id
  })

  const showToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = ++toastId
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.message !== message)
      return [...filtered, { id, type, message }]
    })
    setTimeout(() => setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t)), 3500)
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
  }, [])

  const showConfirm = useCallback((config: Omit<ConfirmState, 'show'>) => {
    setConfirmState({ ...config, show: true })
  }, [])

  // Check server-side license validation periodically
  const checkLicense = useCallback(async () => {
    if (!sessionToken || !isAuthenticated) return
    try {
      if (typeof window !== 'undefined' && (window as any).api?.getLicenseStatus) {
        const res = await (window as any).api.getLicenseStatus(sessionToken, installationId, 'desktop', '2.0.0')
        if (res?.success && res.data) {
          setLicenseInfo(res.data)
        }
      }
    } catch {}
  }, [sessionToken, isAuthenticated, installationId])

  useEffect(() => {
    if (!isAuthenticated) return
    checkLicense()
    const timer = setInterval(checkLicense, 10000)
    return () => clearInterval(timer)
  }, [isAuthenticated, checkLicense])

  // Real-Time Central Synchronization Listeners
  useEffect(() => {
    if (!isAuthenticated) return

    if (window.api?.getSyncStatus) {
      window.api.getSyncStatus().then((s: any) => {
        if (s) setSyncStatus(s)
      }).catch(() => {})
    }

    const unsubStatus = window.api?.onSyncStatusChanged?.((_e: any, data: any) => {
      if (data) setSyncStatus((prev) => ({ ...prev, ...data }))
    })

    const unsubAuth = window.api?.onAuthStateUpdated?.((_e: any, newState: any) => {
      if (newState) {
        setSyncStatus((prev) => {
          const roleChanged = prev.cachedState && prev.cachedState.role !== newState.role
          const versionChanged = prev.cachedState && prev.authVersion !== newState.authVersion
          if (roleChanged || versionChanged) {
            showToast('info', `⚡ Real-Time Sync: Authorization updated to role "${newState.role.toUpperCase()}" (v${newState.authVersion})`)
          }
          return {
            ...prev,
            authVersion: newState.authVersion,
            cachedState: newState,
            lastSyncTime: newState.lastSyncAt || new Date().toISOString()
          }
        })
      }
    })

    const unsubRevoked = window.api?.onSessionRevoked?.((_e: any, data: any) => {
      showToast('error', `🚫 ${data?.reason || 'Account access restricted or session revoked by administrator.'}`)
      setTimeout(() => {
        logout()
      }, 500)
    })

    const unsubPayment = window.api?.onRealtimeSyncEvent?.((_e: any, { eventType, payload }: any) => {
      if (eventType === 'payment.completed') {
        const planName = payload?.plan_id ? payload.plan_id.replace('plan_', '').toUpperCase() : 'SUBSCRIPTION'
        showToast('success', `🎉 Payment Confirmed! Upgraded to ${planName} Plan with ${payload?.device_limit || 2} Devices.`)
      }
    })

    return () => {
      unsubStatus?.()
      unsubAuth?.()
      unsubRevoked?.()
      unsubPayment?.()
    }
  }, [isAuthenticated, logout, showToast])

  // Real-Time Software Update Checks & Event Listeners
  useEffect(() => {
    const isNewerVersion = (remoteVer?: string, localVer?: string): boolean => {
      if (!remoteVer) return false
      const cleanA = remoteVer.replace(/^v/i, '').trim()
      const cleanB = (localVer || '2.0.0').replace(/^v/i, '').trim()
      const partsA = cleanA.split(/[-+.]/).map(p => isNaN(Number(p)) ? p : Number(p))
      const partsB = cleanB.split(/[-+.]/).map(p => isNaN(Number(p)) ? p : Number(p))
      const maxLen = Math.max(partsA.length, partsB.length)
      for (let i = 0; i < maxLen; i++) {
        const a = partsA[i] !== undefined ? partsA[i] : 0
        const b = partsB[i] !== undefined ? partsB[i] : 0
        if (typeof a === 'number' && typeof b === 'number') {
          if (a > b) return true
          if (a < b) return false
        } else {
          if (String(a) > String(b)) return true
          if (String(a) < String(b)) return false
        }
      }
      return false
    }

    if (typeof window !== 'undefined' && (window as any).api?.getAppVersion) {
      (window as any).api.getAppVersion().then((r: any) => {
        if (r?.success && r.data) setAppVersion(r.data)
      }).catch(() => {})
    }

    const checkAppUpdate = async () => {
      try {
        if ((window as any).api?.updaterCheckLatest) {
          const current = appVersion || '2.0.0'
          const res = await (window as any).api.updaterCheckLatest(current)
          if (res?.success && res?.data?.hasUpdate && res.data.latestVersion) {
            const latest = res.data.latestVersion
            if (isNewerVersion(latest.version, current)) {
              const info: UpdateAvailablePayload = {
                version: latest.version,
                releaseTitle: latest.release_title || `AntiProfiles v${latest.version}`,
                releaseNotes: latest.release_notes || 'Performance enhancements, bug fixes, and security patches.',
                publishedAt: latest.published_at,
                forceUpdate: Boolean(res.data.forceUpdate),
                mandatory: Boolean(res.data.mandatory || res.data.forceUpdate),
                packageInfo: res.data.packageInfo
              }
              setAvailableUpdate(info)
              setShowUpdateModal(true)
            }
          }
        }
      } catch {}
    }
    checkAppUpdate()
    const updateInterval = setInterval(checkAppUpdate, 5 * 60 * 1000)

    let unsubUpdate: (() => void) | undefined
    if ((window as any).api?.onSoftwareUpdateAvailable) {
      unsubUpdate = (window as any).api.onSoftwareUpdateAvailable((_e: any, data: any) => {
        if (data && data.version && isNewerVersion(data.version, appVersion || '2.0.0')) {
          setAvailableUpdate(data)
          setShowUpdateModal(true)
          showToast('info', `🚀 Real-Time Update: AntiProfiles release v${data.version} is now available!`)
        }
      })
    }

    return () => {
      clearInterval(updateInterval)
      if (unsubUpdate) unsubUpdate()
    }
  }, [showToast, appVersion])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    let timer: any
    const poll = async () => {
      try {
        const res = await window.api.getRunningCount()
        if (res.success && typeof res.data === 'number') setRunningCount(res.data)
      } catch {}
    }
    poll()
    timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') { e.preventDefault(); setCurrentPage('settings') }
      if (e.metaKey && e.key === 'f') { e.preventDefault(); setCurrentPage('profiles') }
      if (e.metaKey && e.key === 'n') { e.preventDefault(); setCurrentPage('profiles') }
      if (e.metaKey && e.key === 'd') { e.preventDefault(); setCurrentPage('dashboard') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (impersonatedBy) {
      setAdminView(false)
      setCurrentPage('profiles')
    }
  }, [impersonatedBy])

  // 1. Loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0F0F14', color: '#2DD4BF', fontSize: '18px', fontWeight: 600 }}>
        🛡️ Loading AntiProfiles...
      </div>
    )
  }

  // 2. Public Landing View overlay for logged in users
  if (viewingPublicLanding) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, width: '100vw', height: '100vh', overflowY: 'auto', backgroundColor: '#0F0F14' }}>
        <button
          type="button"
          onClick={() => setViewingPublicLanding(false)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#2DD4BF',
            color: '#0F0F17',
            border: 'none',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
          }}
        >
          ↩ Return to Dashboard
        </button>
        <LandingPage
          onNavigateLogin={() => setViewingPublicLanding(false)}
          onNavigateRegister={() => setViewingPublicLanding(false)}
        />
      </div>
    )
  }

  // 3. Unauthenticated router
  if (!isAuthenticated) {
    if (authScreen === 'register') {
      return (
        <RegisterPage
          onNavigateLogin={() => setAuthScreen('login')}
          onRegistrationSuccess={(email, devUrl) => {
            setVerifyEmailParam(email)
            setVerifyDevUrlParam(devUrl)
            setAuthScreen('verify')
          }}
        />
      )
    }
    if (authScreen === 'verify') {
      return (
        <VerifyEmailPage
          email={verifyEmailParam}
          initialDevUrl={verifyDevUrlParam}
          onNavigateLogin={() => setAuthScreen('login')}
        />
      )
    }
    if (authScreen === 'landing') {
      return (
        <LandingPage
          onNavigateLogin={() => setAuthScreen('login')}
          onNavigateRegister={() => setAuthScreen('register')}
        />
      )
    }
    return (
      <LoginPage
        onNavigateRegister={() => setAuthScreen('register')}
        onNavigateVerify={(email, devUrl) => {
          setVerifyEmailParam(email)
          setVerifyDevUrlParam(devUrl)
          setAuthScreen('verify')
        }}
      />
    )
  }

  // 3. Unverified user router
  if (!isVerified) {
    return (
      <VerifyEmailPage
        email={currentUser?.email}
        onNavigateLogin={() => logout()}
      />
    )
  }

  // 4. Authenticated & Verified user dashboard
  const navItems: { page: Page | 'admin' | 'launch_url'; icon: JSX.Element; label: string; section?: string }[] = [
    { page: 'dashboard', icon: Icons.dashboard, label: 'Dashboard' },
    { page: 'profiles', icon: Icons.profiles, label: 'Profiles', section: 'MANAGE' },
    { page: 'groups', icon: Icons.groups, label: 'Groups' },
    { page: 'proxies', icon: Icons.proxies, label: 'Proxies' },
    { page: 'automation', icon: Icons.automation, label: 'Automation', section: 'TOOLS' },
    { page: 'settings', icon: Icons.settings, label: 'Settings' },
    { page: 'logs', icon: Icons.logs, label: 'Logs' },
    ...(isAdmin ? [
      { page: 'launch_url' as any, icon: <span style={{ fontSize: 16 }}>🌐</span>, label: 'Global Launch URL', section: 'ADMIN' },
      { page: 'admin' as any, icon: <span style={{ fontSize: 16 }}>👑</span>, label: 'Admin Dashboard' }
    ] : []),
    { page: 'referral', icon: Icons.gift, label: 'Refer a Friend', section: 'EARN' },
    { page: 'support', icon: Icons.chat, label: 'Live Support', section: 'HELP & SUPPORT' },
  ]

  let renderedSections: string[] = []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: 'var(--color-bg-primary)' }}>
      {impersonatedBy && (
        <div style={{
          width: '100%',
          backgroundColor: '#F59E0B',
          color: '#0F0F14',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '13px',
          zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>👁️</span>
            <span>ADMIN IMPERSONATION MODE: Logged in as user <u>{currentUser?.name || currentUser?.email}</u> ({currentUser?.email})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              exitImpersonation()
              setAdminView(true)
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: '#0F0F14',
              color: '#FFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ↩ Exit Impersonation & Return to Admin ({impersonatedBy.originalAdminUser.email})
          </button>
        </div>
      )}

      <div className="app-layout" style={{ flex: 1, minHeight: 0, width: '100%' }}>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src={brandingConfig?.app?.previewUrl || logoImg} alt="AntiProfiles Logo" className="sidebar-brand-img" style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(59,130,246,0.5))' }} />
            <span className="sidebar-brand-text">AntiProfiles</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const showSection = item.section && !renderedSections.includes(item.section)
            if (item.section) renderedSections.push(item.section)
            return (
              <React.Fragment key={item.page}>
                {showSection && <div className="sidebar-section-label">{item.section}</div>}
                <button
                  className={`sidebar-item ${
                    adminView
                      ? ((item.page === 'launch_url' && adminInitialTab === 'launch_url') || (item.page === 'admin' && adminInitialTab !== 'launch_url') ? 'active' : '')
                      : (!adminView && currentPage === item.page ? 'active' : '')
                  }`}
                  onClick={() => {
                    if (item.page === 'launch_url') {
                      setAdminInitialTab('launch_url')
                      setAdminView(true)
                    } else if (item.page === 'admin') {
                      setAdminInitialTab('users')
                      setAdminView(true)
                    } else {
                      setAdminView(false)
                      setCurrentPage(item.page as Page)
                    }
                  }}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  {item.label}
                  {item.page === 'profiles' && runningCount > 0 && (
                    <span className="sidebar-item-badge">{runningCount}</span>
                  )}
                </button>
              </React.Fragment>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="statusbar-item">
            <span className={`statusbar-dot ${runningCount > 0 ? 'running' : 'stopped'}`} />
            <span className="text-xs text-secondary">{runningCount} running</span>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className="app-main">
        <div className="topbar">
          <span className="topbar-title" style={{ marginLeft: 8 }}>
            {adminView ? '👑 Admin Control Center' : (navItems.find((n) => n.page === currentPage)?.label || 'AntiProfiles')}
          </span>
          <div style={{ flex: 1 }} />
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
            {/* Real-Time Software Update Available Pill */}
            {availableUpdate && (
              <button
                type="button"
                onClick={() => setShowUpdateModal(true)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2DD4BF80',
                  background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.2), rgba(59, 130, 246, 0.2))',
                  color: '#2DD4BF',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 12px rgba(45, 212, 191, 0.25)',
                  whiteSpace: 'nowrap'
                }}
                title="New Software Update Available"
              >
                <span>🚀</span>
                <span>Update to v{availableUpdate.version}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewingPublicLanding(true)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #3B82F650',
                backgroundColor: '#3B82F615',
                color: '#60A5FA',
                fontWeight: 600,
                fontSize: '11px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Public Landing Page"
            >
              🌐 Landing
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdminInitialTab('users')
                  setAdminView(!adminView)
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: adminView ? '1px solid #F59E0B' : '1px solid #2DD4BF',
                  backgroundColor: adminView ? '#F59E0B20' : '#2DD4BF20',
                  color: adminView ? '#F59E0B' : '#2DD4BF',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {adminView ? '🌐 Profiles' : '👑 Admin'}
              </button>
            )}

            {/* Subscription & Plan Status Pill */}
            {licenseInfo && (
              <div
                onClick={async () => {
                  try {
                    if (typeof window !== 'undefined' && (window as any).api?.getUserDevices) {
                      const res = await (window as any).api.getUserDevices(sessionToken)
                      if (res?.success) setUserDevices(res.data || [])
                    }
                  } catch {}
                  setShowDevicesModal(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: licenseInfo.valid ? '#161622' : '#EF444420',
                  border: licenseInfo.valid ? '1px solid #2C2C3E' : '1px solid #EF444450',
                  cursor: 'pointer',
                  fontSize: '11px',
                  whiteSpace: 'nowrap'
                }}
                title="Click to manage subscription and active devices"
              >
                <span style={{ fontWeight: 700, color: '#2DD4BF' }}>💳 {licenseInfo.plan?.name || 'Starter'}</span>
                <span style={{
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: licenseInfo.subscription_status === 'active' ? '#10B98120' : '#EF444420',
                  color: licenseInfo.subscription_status === 'active' ? '#10B981' : '#F87171'
                }}>
                  {licenseInfo.subscription_status.toUpperCase()}
                </span>
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                  ({licenseInfo.device?.device_count || 1}/{licenseInfo.device?.max_devices || 2})
                </span>
              </div>
            )}

            {/* User Pill */}
            <div style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600, color: '#F1F5F9' }}>👤 {currentUser?.name}</span>
              <span style={{
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                backgroundColor: isAdmin ? '#F59E0B20' : '#3B82F620',
                color: isAdmin ? '#F59E0B' : '#60A5FA',
                border: isAdmin ? '1px solid #F59E0B50' : '1px solid #3B82F650'
              }}>
                {currentUser?.role.toUpperCase()}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => logout()}
              style={{ fontSize: '11px', color: '#F87171', padding: '4px 8px', whiteSpace: 'nowrap' }}
              title="Sign Out"
            >
              Logout
            </button>

            <button className="btn btn-ghost btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              <span style={{ width: 14, height: 14, display: 'flex' }}>{theme === 'dark' ? Icons.sun : Icons.moon}</span>
            </button>
          </div>
        </div>

        <div className="app-content">
          {adminView && isAdmin ? (
            <AdminDashboard initialTab={adminInitialTab} />
          ) : (
            <>
              {currentPage === 'dashboard' && <DashboardPage onNavigate={setCurrentPage} showToast={showToast} brandingConfig={brandingConfig} proxies={profilesProxies} />}
              {currentPage === 'profiles' && <ProfilesPage showToast={showToast} confirm={showConfirm} licenseInfo={licenseInfo} onUpgrade={() => setViewingPublicLanding(true)} brandingConfig={brandingConfig} />}
              {currentPage === 'groups' && <GroupsPage showToast={showToast} confirm={showConfirm} />}
              {currentPage === 'proxies' && <ProxiesPage showToast={showToast} confirm={showConfirm} licenseInfo={licenseInfo} onUpgrade={() => setViewingPublicLanding(true)} />}
              {currentPage === 'automation' && <AutomationPage showToast={showToast} licenseInfo={licenseInfo} onUpgrade={() => setViewingPublicLanding(true)} />}
              {currentPage === 'settings' && (
                <SettingsPage
                  theme={theme}
                  setTheme={setTheme}
                  showToast={showToast}
                  licenseInfo={licenseInfo}
                  onUpgrade={() => setViewingPublicLanding(true)}
                  onNavigateAdmin={(tab) => {
                    setAdminInitialTab(tab as any)
                    setAdminView(true)
                  }}
                  onOpenChangelog={() => setShowChangelogModal(true)}
                />
              )}
              {currentPage === 'logs' && <LogsPage showToast={showToast} confirm={showConfirm} />}
              {(currentPage === 'referral' || (currentPage as any) === 'affiliate') && <ReferralPage showToast={showToast} />}
              {currentPage === 'support' && <SupportPage showToast={showToast} />}
            </>
          )}
        </div>

        <div className="statusbar">
          <div className="statusbar-item">
            <span className={`statusbar-dot ${runningCount > 0 ? 'running' : 'stopped'}`} />
            {runningCount} profile{runningCount !== 1 ? 's' : ''} running
          </div>
          <div style={{ flex: 1 }} />
          <span className="text-xs text-tertiary">AntiProfiles v2.0.0</span>
        </div>
      </main>

      {/* ── Server License Lockout Overlay (Non-Bypassable) ── */}
      {licenseInfo && !licenseInfo.valid && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0F0F17EE',
          backdropFilter: 'blur(16px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: '#161622',
            border: '1px solid #EF444450',
            borderRadius: '20px',
            padding: '36px',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {licenseInfo.subscription_status === 'suspended' ? '🚫' : licenseInfo.subscription_status === 'update_required' ? '🚀' : '⚠️'}
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#F1F5F9', margin: '0 0 12px' }}>
              {licenseInfo.subscription_status === 'expired' ? 'Subscription Expired' : licenseInfo.subscription_status === 'suspended' ? 'Account Suspended' : licenseInfo.subscription_status === 'update_required' ? 'Update Required' : 'Device Limit Reached'}
            </h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 24px' }}>
              {licenseInfo.error || 'Your subscription is currently inactive or restricted by server policy.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setViewingPublicLanding(true)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#2DD4BF',
                  color: '#0F0F17',
                  fontWeight: 800,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                💳 Renew Subscription / Upgrade Plan
              </button>

              <button
                type="button"
                onClick={checkLicense}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#161622',
                  border: '1px solid #2C2C3E',
                  color: '#F1F5F9',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh License & Sync Status
              </button>

              <button
                type="button"
                onClick={() => logout()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#F87171',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Account & Devices Modal ── */}
      {showDevicesModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ width: '90%', maxWidth: '520px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2C2C3E', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#F1F5F9' }}>Account & Active Devices</h3>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{currentUser?.email}</span>
              </div>
              <button type="button" onClick={() => setShowDevicesModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>CURRENT PLAN</div>
                <div style={{ fontWeight: 800, color: '#2DD4BF', fontSize: '16px' }}>{licenseInfo?.plan?.name || 'Free'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>EXPIRATION DATE</div>
                <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{new Date(licenseInfo?.expires_at || Date.now()).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>PROFILE LIMIT</div>
                <div style={{ fontWeight: 600, color: '#A5B4FC' }}>{licenseInfo?.limits?.profiles || 3} Profiles</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>TEAM MEMBERS / DEVICES</div>
                <div style={{ fontWeight: 600, color: '#A5B4FC' }}>{licenseInfo?.device?.device_count || 1} / {licenseInfo?.device?.max_devices || licenseInfo?.limits?.team_members || 1} Allowed</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>PROXY SUPPORT</div>
                <div style={{ fontWeight: 600, color: '#CBD5E1' }}>{licenseInfo?.features?.proxy_support === 'socks5' ? 'HTTP/HTTPS/SOCKS5' : licenseInfo?.features?.proxy_support === 'socks' ? 'HTTP/HTTPS/SOCKS' : 'Basic HTTP'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>AUTOMATION API</div>
                <div style={{ fontWeight: 600, color: '#CBD5E1' }}>{licenseInfo?.features?.api_access === 'unlimited' ? 'Unlimited API' : licenseInfo?.features?.api_access === 'full' ? 'Full REST & Driver' : licenseInfo?.features?.api_access === 'basic' ? 'Basic API' : '— (No API)'}</div>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#F1F5F9' }}>💻 Active Registered Devices</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {userDevices.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>This device is currently active.</div>
                ) : (
                  userDevices.map((dev: any) => (
                    <div key={dev.id} style={{ padding: '10px 14px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{dev.device_name} ({dev.platform})</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>v{dev.app_version} • Last seen: {new Date(dev.last_seen_at).toLocaleDateString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm('Revoke access for this device?')) return
                          try {
                            if (typeof window !== 'undefined' && (window as any).api?.revokeDevice) {
                              await (window as any).api.revokeDevice(sessionToken, dev.installation_id)
                              const res = await (window as any).api.getUserDevices(sessionToken)
                              if (res?.success) setUserDevices(res.data || [])
                              checkLicense()
                            }
                          } catch {}
                        }}
                        style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #EF444450', backgroundColor: '#EF444415', color: '#F87171', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setShowDevicesModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#CBD5E1', cursor: 'pointer' }}>Close</button>
              <button type="button" onClick={() => { setShowDevicesModal(false); setViewingPublicLanding(true) }} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Renew / Upgrade Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      <SupportChatWidget />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState((s) => ({ ...s, show: false }))} />

      {/* ── Enterprise Software Update Modal ── */}
      {availableUpdate && (
        <UpdateNotificationModal
          isOpen={showUpdateModal}
          updateInfo={availableUpdate}
          currentVersion={appVersion}
          onClose={() => {
            if (availableUpdate) {
              sessionStorage.setItem('dismissed_update_' + availableUpdate.version, 'true')
            }
            setShowUpdateModal(false)
          }}
          onOpenChangelog={() => setShowChangelogModal(true)}
        />
      )}

      {/* ── Version History & Changelog Modal ── */}
      <VersionHistoryModal
        isOpen={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
        currentVersion={appVersion}
      />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="AntiProfiles Application Error">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
