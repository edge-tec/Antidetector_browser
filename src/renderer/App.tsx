// ──────────────────────────────────────────────
// ProfileVault — Main App Component
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
import logoImg from './assets/logo.png'

// ═══════════════════════════════════════════
// SVG Icons (inline for zero dependencies)
// ═══════════════════════════════════════════

const Icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
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

function DashboardPage({ onNavigate, showToast }: { onNavigate: (page: Page) => void; showToast: (type: ToastItem['type'], message: string) => void }) {
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
              <ProfileCardComponent key={profile.id} profile={profile} onStart={async () => {
                const r = await window.api.startProfile(sessionToken || '', profile.id)
                if (r.success) showToast('success', `Started "${profile.name}"`)
                else showToast('error', r.error || 'Failed to start')
                loadStats()
              }} onStop={async () => {
                const r = await window.api.stopProfile(sessionToken || '', profile.id)
                if (r.success) showToast('success', `Stopped "${profile.name}"`)
                else showToast('error', r.error || 'Failed to stop')
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

function ProfileCardComponent({ profile, proxies, onStart, onStop, onEdit, onDuplicate, onDelete }: {
  profile: Profile
  proxies?: ProxyDisplay[]
  onStart?: () => void
  onStop?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const isRunning = profile.status === 'running'
  const isLaunching = profile.status === 'launching'
  const matchedProxy = (proxies || []).find(p => p.id === profile.proxyId)

  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <div className="profile-card-icon" style={{ backgroundColor: `${profile.color}20`, color: profile.color }}>
          {profile.icon === 'globe' ? '🌐' : profile.icon === 'work' ? '💼' : profile.icon === 'shopping' ? '🛒' : profile.icon === 'social' ? '💬' : '🌐'}
        </div>
        <div className="profile-card-info" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="profile-card-name">{profile.name}</span>
            {profile.consistencyScore > 0 && (
              <ConsistencyBadge score={profile.consistencyScore} />
            )}
          </div>
          <div className="profile-card-meta">
            {profile.lastUsedAt ? `Last used ${new Date(profile.lastUsedAt).toLocaleDateString()}` : 'Never used'}
          </div>
        </div>
        <div className={`profile-card-status ${profile.status}`}>
          <span className="profile-card-status-dot" />
          {isLaunching ? 'Launching...' : isRunning ? 'Running' : 'Stopped'}
        </div>
      </div>

      <div style={{ margin: '8px 0' }}>
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
        {onEdit && <button className="btn btn-sm btn-ghost" onClick={onEdit}><span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.edit}</span></button>}
        {onDuplicate && <button className="btn btn-sm btn-ghost" onClick={onDuplicate}><span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.copy}</span></button>}
        {onDelete && <button className="btn btn-sm btn-ghost" onClick={onDelete}><span style={{ width: 12, height: 12, display: 'flex' }}>{Icons.trash}</span></button>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Profiles Page
// ═══════════════════════════════════════════

function ProfilesPage({ showToast, confirm }: { showToast: (type: ToastItem['type'], msg: string) => void; confirm: (c: Omit<ConfirmState, 'show'>) => void }) {
  const { sessionToken } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [proxies, setProxies] = useState<ProxyDisplay[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showBrowserSetup, setShowBrowserSetup] = useState(false)
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)

  const loadProfiles = useCallback(async () => {
    if (!sessionToken) return
    const result = await window.api.getProfiles(sessionToken, search || undefined)
    if (result.success && result.data) setProfiles(result.data)
    setLoading(false)
  }, [sessionToken, search])

  useEffect(() => {
    loadProfiles()
    window.api.getProxies().then((r) => { if (r.success && r.data) setProxies(r.data) })
    window.api.getGroups().then((r) => { if (r.success && r.data) setGroups(r.data) })
    const unsub = window.api.onProfileStatusChanged((_e, _data) => loadProfiles())
    return unsub
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

  const handleSaveProfile = async (input: any) => {
    if (!sessionToken) return
    if (editId) {
      const result = await window.api.updateProfile(sessionToken, editId, input)
      if (result.success) {
        showToast('success', 'Profile updated')
        setEditId(null)
        setEditProfile(null)
        setShowCreate(false)
        loadProfiles()
      } else {
        showToast('error', result.error || 'Failed to update profile')
      }
    } else {
      const result = await window.api.createProfile(sessionToken, input)
      if (result.success) {
        showToast('success', `Profile "${result.data!.name}" created`)
        setShowCreate(false)
        loadProfiles()
      } else {
        showToast('error', result.error || 'Failed to create profile')
      }
    }
  }

  const handleBulkCreate = async (count: number, osType: string, namePrefix: string, groupId?: string, proxyId?: string) => {
    if (!sessionToken) return
    let successCount = 0
    for (let i = 1; i <= count; i++) {
      const name = `${namePrefix} ${i}`
      const res = await window.api.createProfile(sessionToken, {
        name,
        osType,
        groupId,
        proxyId
      })
      if (res.success) successCount++
    }
    showToast('success', `Created ${successCount} profiles successfully`)
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
      const res = await window.api.createProfile(sessionToken, {
        name: templateName,
        osType: templateOs
      })
      if (res.success) {
        showToast('success', `Created profile "${templateName}"`)
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
        <div className="page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <button className="btn btn-primary" onClick={() => { setEditId(null); setEditProfile(null); setShowCreate(true) }}>
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.plus}</span>
            New Profile
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 400, position: 'relative' }}>
        <span className="topbar-search-icon">{Icons.search}</span>
        <input
          className="form-input"
          placeholder="Search profiles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
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
          {!search && <button className="btn btn-primary" onClick={() => { setEditId(null); setEditProfile(null); setShowCreate(true) }}>Create Profile</button>}
        </div>
      ) : (
        <div className="grid-profiles">
          {profiles.map((p) => (
            <ProfileCardComponent
              key={p.id}
              profile={p}
              proxies={proxies}
              onStart={() => handleStartProfile(p)}
              onStop={async () => {
                if (!sessionToken) return
                const r = await window.api.stopProfile(sessionToken, p.id)
                if (r.success) showToast('success', `Stopped "${p.name}"`)
                else showToast('error', r.error || 'Failed to stop')
                loadProfiles()
              }}
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

function ProxiesPage({ showToast, confirm }: { showToast: (type: ToastItem['type'], msg: string) => void; confirm: (c: Omit<ConfirmState, 'show'>) => void }) {
  const [proxies, setProxies] = useState<ProxyDisplay[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'http' as string, host: '', port: 8080, username: '', password: '' })

  const load = useCallback(async () => {
    const r = await window.api.getProxies()
    if (r.success && r.data) setProxies(r.data)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const r = await window.api.createProxy(form)
    if (r.success) { showToast('success', 'Proxy created'); setShowCreate(false); setForm({ name: '', type: 'http', host: '', port: 8080, username: '', password: '' }); load() }
    else showToast('error', r.error || 'Failed to create proxy')
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    const r = await window.api.testProxy(id)
    if (r.success && r.data) {
      if (r.data.success) showToast('success', `Proxy connected (${r.data.latency}ms)${r.data.ip ? ` — IP: ${r.data.ip}` : ''}`)
      else showToast('error', `Proxy test failed: ${r.data.error}`)
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
          <p className="page-subtitle">Manage proxy configurations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.plus}</span> Add Proxy
        </button>
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
          {proxies.map((px) => (
            <div key={px.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{px.name}</div>
                <div className="text-sm text-secondary" style={{ marginTop: 2 }}>{px.type}://{px.host}:{px.port}{px.username ? ` (auth: ${px.username})` : ''}</div>
              </div>
              {statusBadge(px.testStatus)}
              <button className="btn btn-sm btn-secondary" onClick={() => handleTest(px.id)} disabled={testing === px.id}>
                {testing === px.id ? <div className="loading-spinner" style={{ width: 14, height: 14 }} /> : 'Test'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => confirm({
                title: 'Delete Proxy', message: `Delete "${px.name}"? Profiles using this proxy will switch to direct connection.`,
                confirmLabel: 'Delete', danger: true,
                onConfirm: async () => { await window.api.deleteProxy(px.id); showToast('success', 'Proxy deleted'); load() }
              })}>
                <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.trash}</span>
              </button>
            </div>
          ))}
        </div>
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
                      <option value="https">HTTPS</option>
                      <option value="socks5">SOCKS5</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input className="form-input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
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

function AutomationPage({ showToast }: { showToast: (type: ToastItem['type'], msg: string) => void }) {
  const [apiRunning, setApiRunning] = useState(false)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    window.api.isApiRunning().then((r) => { if (r.success) setApiRunning(r.data!) })
    window.api.getApiToken().then((r) => { if (r.success) setToken(r.data!) })
  }, [])

  const toggleApi = async () => {
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
          <h1 className="page-title">Automation API</h1>
          <p className="page-subtitle">Control profiles programmatically via REST API</p>
        </div>
        <button className={`btn ${apiRunning ? 'btn-danger' : 'btn-success'}`} onClick={toggleApi}>
          {apiRunning ? '● Stop API' : '○ Start API'}
        </button>
      </div>

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

function SettingsPage({ theme, setTheme, showToast }: { theme: string; setTheme: (t: string) => void; showToast: (type: ToastItem['type'], msg: string) => void }) {
  const [chromiumPath, setChromiumPath] = useState<string | null>(null)
  const [engineType, setEngineType] = useState<string>('Google Chrome')
  const [version, setVersion] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any | null>(null)
  const [diagnostics, setDiagnostics] = useState<any | null>(null)
  const [discoveredBrowsers, setDiscoveredBrowsers] = useState<any[]>([])

  useEffect(() => {
    window.api.getChromiumPath().then((r) => {
      if (r.success && r.data) {
        setChromiumPath(r.data)
        runTest(r.data)
      }
    })
    window.api.getAppVersion().then((r) => { if (r.success) setVersion(r.data!) })
    runDiagnostics()
  }, [])

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Application configuration & browser engine control</p>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Appearance</h3>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Theme</div>
              <div className="text-sm text-secondary">Switch between dark and light mode</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTheme('dark')}>
                <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.moon}</span> Dark
              </button>
              <button className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTheme('light')}>
                <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.sun}</span> Light
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Browser Engine & Path</h3>
          <span className="text-sm text-secondary">Windows & macOS Multi-Engine Support</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Preferred Engine
            </label>
            <select
              className="form-input"
              value={engineType}
              onChange={(e) => setEngineType(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="Google Chrome">Google Chrome (Default / Recommended)</option>
              <option value="Chromium">Chromium</option>
              <option value="Microsoft Edge">Microsoft Edge (Chromium Engine)</option>
              <option value="Brave">Brave Browser</option>
              <option value="Custom">Custom Binary</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Browser Executable Path
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Click Auto-Detect or Browse for chrome.exe"
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
              {isDetecting ? '🔍 Scanning...' : '🔍 Auto-Detect Chrome'}
            </button>
            <button className="btn btn-secondary btn-sm" disabled={isTesting || !chromiumPath} onClick={() => runTest()}>
              {isTesting ? 'Testing...' : '⚡ Test Browser'}
            </button>
            {chromiumPath && (
              <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                Reset
              </button>
            )}
          </div>

          {/* Discovered Browsers */}
          {discoveredBrowsers.length > 0 && (
            <div style={{ background: 'var(--color-bg-tertiary)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                Discovered Browsers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {discoveredBrowsers.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: chromiumPath === b.path ? 'rgba(45,212,191,0.1)' : 'var(--color-bg-secondary)',
                      border: chromiumPath === b.path ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 6,
                      padding: '8px 12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {b.name} <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 400 }}>v{b.version}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.path}
                      </div>
                    </div>
                    <button
                      className={`btn btn-sm ${chromiumPath === b.path ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={async () => {
                        await window.api.setChromiumPath(b.path)
                        setChromiumPath(b.path)
                        showToast('success', `Selected ${b.name}`)
                        runTest(b.path)
                        runDiagnostics()
                      }}
                    >
                      {chromiumPath === b.path ? '✓ In Use' : 'Use'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Result Card */}
          {testResult && (
            <div
              style={{
                background: testResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${testResult.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 8,
                padding: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{testResult.valid ? '✅' : '❌'}</span>
                <strong style={{ color: testResult.valid ? '#22C55E' : '#EF4444' }}>
                  {testResult.valid ? 'Browser Validated Successfully' : 'Browser Validation Failed'}
                </strong>
              </div>
              {testResult.valid ? (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  <div><strong>Engine:</strong> {testResult.engine}</div>
                  <div><strong>Version:</strong> {testResult.version}</div>
                  <div style={{ fontFamily: 'monospace' }}><strong>Path:</strong> {testResult.path}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#EF4444' }}>{testResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Browser Diagnostics Section */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Browser Diagnostics & Health Check</h3>
          <button className="btn btn-secondary btn-sm" onClick={runDiagnostics}>
            🔄 Refresh Diagnostics
          </button>
        </div>
        <div className="card">
          {diagnostics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { title: 'Browser Engine', item: diagnostics.engine },
                { title: 'Executable Path', item: diagnostics.executablePath },
                { title: 'Executable Exists', item: diagnostics.executableExists },
                { title: 'Version Detection', item: diagnostics.versionDetection },
                { title: 'Profile Data Directory', item: diagnostics.profileDirectory },
                { title: 'Process Launch Permission', item: diagnostics.processLaunch }
              ].map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {row.item?.detail || row.item?.path || 'Checked'}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: row.item?.status === 'pass' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: row.item?.status === 'pass' ? '#22C55E' : '#EF4444'
                    }}
                  >
                    {row.item?.status === 'pass' ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-secondary)' }}>
              Checking browser subsystem...
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">About</h3>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><strong>ProfileVault</strong> v{version || '1.0.0'}</div>
            <div className="text-sm text-secondary">Professional browser profile management for macOS</div>
            <div className="text-sm text-secondary" style={{ marginTop: 8 }}>Built with Electron, React, Puppeteer, and SQLite</div>
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
          <p className="page-description">Chat directly with ProfileVault technical engineers in real time.</p>
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
                <span style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: 700 }}>ProfileVault Support Team</span>
                <p style={{ fontSize: '13px', color: '#FFF', marginTop: '4px' }}>Hello! 👋 Welcome to ProfileVault Live Support. How can we assist you with your antidetect browser profiles, proxies, or subscriptions today?</p>
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
                        {isAgent ? (m.sender_name || 'ProfileVault Support') : 'You'}
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
                Manage active devices from your ProfileVault account settings.
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
    setToasts((prev) => [...prev, { id, type, message }])
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
        const res = await (window as any).api.getLicenseStatus(sessionToken, installationId, 'desktop', '1.0.0')
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

  // 1. Loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0F0F14', color: '#2DD4BF', fontSize: '18px', fontWeight: 600 }}>
        🛡️ Loading ProfileVault...
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
  const navItems: { page: Page; icon: JSX.Element; label: string; section?: string }[] = [
    { page: 'dashboard', icon: Icons.dashboard, label: 'Dashboard' },
    { page: 'profiles', icon: Icons.profiles, label: 'Profiles', section: 'MANAGE' },
    { page: 'groups', icon: Icons.groups, label: 'Groups' },
    { page: 'proxies', icon: Icons.proxies, label: 'Proxies' },
    { page: 'automation', icon: Icons.automation, label: 'Automation', section: 'TOOLS' },
    { page: 'settings', icon: Icons.settings, label: 'Settings' },
    { page: 'logs', icon: Icons.logs, label: 'Logs' },
    { page: 'support', icon: Icons.chat, label: 'Live Support', section: 'HELP & SUPPORT' },
  ]

  let renderedSections: string[] = []

  return (
    <div className="app-layout">
      {impersonatedBy && (
        <div style={{
          gridColumn: '1 / -1',
          backgroundColor: '#F59E0B',
          color: '#0F0F14',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '13px',
          zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>👁️</span>
            <span>ADMIN IMPERSONATION MODE: Logged in as user <u>{currentUser?.name}</u> ({currentUser?.email})</span>
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

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src={logoImg} alt="ProfileVault Logo" className="sidebar-brand-img" style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(59,130,246,0.5))' }} />
            <span className="sidebar-brand-text">ProfileVault</span>
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
                  className={`sidebar-item ${!adminView && currentPage === item.page ? 'active' : ''}`}
                  onClick={() => { setAdminView(false); setCurrentPage(item.page) }}
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
            {adminView ? '👑 Admin Control Center' : (navItems.find((n) => n.page === currentPage)?.label || 'ProfileVault')}
          </span>
          <div style={{ flex: 1 }} />
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
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
                onClick={() => setAdminView(!adminView)}
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

            {/* Real-Time Central Synchronization Pill */}
            <div
              onClick={async () => {
                try {
                  showToast('info', '⚡ Refreshing authoritative synchronization...')
                  await (window as any).api?.resyncAuthoritativeState?.()
                } catch {}
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: syncStatus.status === 'connected' ? '#10B98115' : (syncStatus.status === 'error' ? '#EF444415' : '#F59E0B15'),
                border: `1px solid ${syncStatus.status === 'connected' ? '#10B98150' : (syncStatus.status === 'error' ? '#EF444450' : '#F59E0B50')}`,
                cursor: 'pointer',
                fontSize: '11px',
                whiteSpace: 'nowrap'
              }}
              title={`Central Sync: ${syncStatus.status.toUpperCase()} | Version: v${syncStatus.authVersion} | Click to Force Resync`}
            >
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: syncStatus.status === 'connected' ? '#10B981' : (syncStatus.status === 'error' ? '#EF4444' : '#F59E0B'),
                boxShadow: syncStatus.status === 'connected' ? '0 0 6px #10B981' : 'none'
              }} />
              <span style={{
                fontWeight: 700,
                color: syncStatus.status === 'connected' ? '#10B981' : (syncStatus.status === 'error' ? '#F87171' : '#F59E0B')
              }}>
                {syncStatus.status === 'connected' ? `Live Sync (v${syncStatus.authVersion})` : (syncStatus.status === 'syncing' ? 'Syncing...' : (syncStatus.status === 'reconnecting' ? 'Reconnecting...' : 'Offline'))}
              </span>
            </div>

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
            <AdminDashboard />
          ) : (
            <>
              {currentPage === 'dashboard' && <DashboardPage onNavigate={setCurrentPage} showToast={showToast} />}
              {currentPage === 'profiles' && <ProfilesPage showToast={showToast} confirm={showConfirm} />}
              {currentPage === 'groups' && <GroupsPage showToast={showToast} confirm={showConfirm} />}
              {currentPage === 'proxies' && <ProxiesPage showToast={showToast} confirm={showConfirm} />}
              {currentPage === 'automation' && <AutomationPage showToast={showToast} />}
              {currentPage === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} showToast={showToast} />}
              {currentPage === 'logs' && <LogsPage showToast={showToast} confirm={showConfirm} />}
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
          <span className="text-xs text-tertiary">ProfileVault v1.0.0</span>
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
                <div style={{ fontWeight: 800, color: '#2DD4BF', fontSize: '16px' }}>{licenseInfo?.plan?.name || 'Starter'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>EXPIRATION DATE</div>
                <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{new Date(licenseInfo?.expires_at || Date.now()).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>PROFILE LIMIT</div>
                <div style={{ fontWeight: 600, color: '#A5B4FC' }}>{licenseInfo?.limits?.profiles || 25} Profiles</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>DEVICE LIMIT</div>
                <div style={{ fontWeight: 600, color: '#A5B4FC' }}>{licenseInfo?.device?.device_count || 1} / {licenseInfo?.device?.max_devices || 2} Allowed</div>
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
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="ProfileVault Application Error">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
