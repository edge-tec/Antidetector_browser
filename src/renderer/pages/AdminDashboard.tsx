// ──────────────────────────────────────────────
// ProfileVault — Admin Management Dashboard (Users, Subscriptions, Desktop App, CMS, SMTP)
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { UserDisplay, Profile } from '../types'

interface SmtpFormState {
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
  secure: boolean
  enabled: boolean
}

const mockUsersStore: UserDisplay[] = [
  {
    id: 'admin-default',
    name: 'System Admin',
    email: 'admin@profilevault.local',
    role: 'admin',
    emailVerified: true,
    accountStatus: 'active',
    hasPassword: true,
    googleId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    profileCount: 0
  }
]

const callAdminIpc = async (channel: string, ...args: any[]) => {
  if (typeof window !== 'undefined' && (window as any).api) {
    const apiMethodMap: Record<string, string> = {
      'admin:get-users': 'adminGetUsers',
      'admin:create-user': 'adminCreateUser',
      'admin:get-audit-logs': 'adminGetAuditLogs',
      'admin:update-user-status': 'adminUpdateUserStatus',
      'admin:delete-user': 'adminDeleteUser',
      'admin:resend-verification': 'adminResendVerification',
      'admin:get-user-profiles': 'adminGetUserProfiles',
      'admin:impersonate-user': 'adminImpersonateUser',
      'admin:get-smtp-config': 'adminGetSmtpConfig',
      'admin:save-smtp-config': 'adminSaveSmtpConfig',
      'admin:test-smtp-config': 'adminTestSmtpConfig',
      'landing:get-public-data': 'getPublicLandingData',
      'landing:admin-update-branding': 'adminUpdateBranding',
      'landing:admin-update-hero': 'adminUpdateHero',
      'landing:admin-save-plan': 'adminSavePlan',
      'landing:admin-delete-plan': 'adminDeletePlan',
      'landing:admin-save-faq': 'adminSaveFaq',
      'landing:admin-delete-faq': 'adminDeleteFaq',
      'landing:admin-save-testimonial': 'adminSaveTestimonial',
      'landing:admin-delete-testimonial': 'adminDeleteTestimonial',
      'landing:admin-update-seo': 'adminUpdateSeo',
      'admin:get-subscriptions': 'adminGetSubscriptions',
      'admin:update-user-subscription': 'adminUpdateUserSubscription',
      'admin:get-desktop-app-config': 'adminGetDesktopAppConfig',
      'admin:save-desktop-app-config': 'adminSaveDesktopAppConfig'
    }
    const methodName = apiMethodMap[channel]
    if (methodName && typeof (window as any).api[methodName] === 'function') {
      return await (window as any).api[methodName](...args)
    }
  }

  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    return await (window as any).electron.ipcRenderer.invoke(channel, ...args)
  }

  // Fallback for preview / dev renderer mode
  if (channel === 'admin:get-users') {
    return { success: true, data: mockUsersStore }
  }

  if (channel === 'admin:get-desktop-app-config') {
    return {
      success: true,
      data: {
        win_download_url: 'https://releases.profilevault.local/ProfileVault-Setup-1.0.0.exe',
        win_app_version: '1.0.0',
        win_enabled: 'true',
        mac_download_url: 'https://releases.profilevault.local/ProfileVault-1.0.0.dmg',
        mac_app_version: '1.0.0',
        mac_enabled: 'true',
        release_notes: 'Initial stable release.',
        min_supported_version: '1.0.0',
        force_update: 'false',
        max_devices_limit: '2',
        offline_allowance_hours: '72'
      }
    }
  }

  return { success: true }
}

export const AdminDashboard: React.FC = () => {
  const { sessionToken, currentUser, impersonateUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'releases' | 'cms' | 'smtp' | 'audit'>('users')
  const [users, setUsers] = useState<UserDisplay[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Subscriptions Tab State
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([])
  const [subStatusFilter, setSubStatusFilter] = useState<string>('')
  const [subSearchQuery, setSubSearchQuery] = useState<string>('')
  const [loadingSubs, setLoadingSubs] = useState(false)

  // Sub Edit Modal State
  const [selectedSubItem, setSelectedSubItem] = useState<any | null>(null)
  const [subEditForm, setSubEditForm] = useState({
    plan_id: 'plan_pro',
    status: 'active',
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    grace_period_days: 3
  })

  // Desktop App Release Settings State
  const [desktopConfig, setDesktopConfig] = useState<Record<string, string>>({
    win_download_url: 'https://releases.profilevault.local/ProfileVault-Setup-1.0.0.exe',
    win_app_version: '1.0.0',
    win_enabled: 'true',
    mac_download_url: 'https://releases.profilevault.local/ProfileVault-1.0.0.dmg',
    mac_app_version: '1.0.0',
    mac_enabled: 'true',
    release_notes: 'Initial stable release with multi-profile isolation.',
    min_supported_version: '1.0.0',
    force_update: 'false',
    max_devices_limit: '2',
    offline_allowance_hours: '72',
    license_check_interval_hours: '24'
  })
  const [savingDesktopConfig, setSavingDesktopConfig] = useState(false)

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    accountStatus: 'active' as 'active' | 'pending' | 'suspended',
    emailVerified: true
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [createError, setCreateError] = useState('')

  // Selected User Modal State
  const [selectedUser, setSelectedUser] = useState<UserDisplay | null>(null)
  const [userProfiles, setUserProfiles] = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // SMTP Settings State
  const [smtpForm, setSmtpForm] = useState<SmtpFormState>({
    host: '',
    port: 587,
    user: '',
    password: '',
    fromEmail: '',
    secure: false,
    enabled: false
  })
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpStatusMessage, setSmtpStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Landing CMS State
  const [cmsTab, setCmsTab] = useState<'branding' | 'hero' | 'pricing' | 'faq' | 'seo'>('branding')
  const [cmsBranding, setCmsBranding] = useState<Record<string, string>>({ site_name: 'ProfileVault', accent_color: '#2DD4BF' })
  const [cmsHero, setCmsHero] = useState({ headline: '', subheadline: '', cta_primary_text: '', cta_primary_url: '', cta_secondary_text: '', cta_secondary_url: '', trust_text: '' })
  const [cmsPlans, setCmsPlans] = useState<any[]>([])
  const [cmsFaqs, setCmsFaqs] = useState<any[]>([])
  const [cmsSeo, setCmsSeo] = useState<Record<string, string>>({})

  // Plan Edit Modal State
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>({ name: '', monthly_price: 19, profile_limit: 25, team_limit: 2 })

  const fetchUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callAdminIpc('admin:get-users', sessionToken || 'mock-admin-token', { query: searchQuery, role: roleFilter, status: statusFilter })
      if (res?.success) setUsers(res.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubscriptions = async () => {
    setLoadingSubs(true)
    try {
      const res = await callAdminIpc('admin:get-subscriptions', sessionToken || 'mock-admin-token', { query: subSearchQuery, status: subStatusFilter })
      if (res?.success) {
        setSubscriptionsList(res.data || [])
      }
    } catch {} finally {
      setLoadingSubs(false)
    }
  }

  const fetchDesktopConfig = async () => {
    try {
      const res = await callAdminIpc('admin:get-desktop-app-config', sessionToken || 'mock-admin-token')
      if (res?.success && res.data) {
        setDesktopConfig(res.data)
      }
    } catch {}
  }

  const fetchCmsData = async () => {
    try {
      const res = await callAdminIpc('landing:get-public-data')
      if (res?.success && res.data) {
        if (res.data.branding) setCmsBranding(res.data.branding)
        if (res.data.hero) setCmsHero(res.data.hero)
        if (res.data.pricingPlans) setCmsPlans(res.data.pricingPlans)
        if (res.data.faqs) setCmsFaqs(res.data.faqs)
        if (res.data.seo) setCmsSeo(res.data.seo)
      }
    } catch {}
  }

  const fetchAuditLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await callAdminIpc('admin:get-audit-logs', sessionToken || 'mock-admin-token', 100)
      if (res?.success) setAuditLogs(res.data || [])
    } catch {} finally {
      setLoadingLogs(false)
    }
  }

  const fetchSmtpConfig = async () => {
    try {
      const res = await callAdminIpc('admin:get-smtp-config', sessionToken || 'mock-admin-token')
      if (res?.success && res.data) setSmtpForm(res.data)
    } catch {}
  }

  useEffect(() => {
    if (activeTab === 'users') fetchUsers()
    else if (activeTab === 'subscriptions') fetchSubscriptions()
    else if (activeTab === 'releases') fetchDesktopConfig()
    else if (activeTab === 'smtp') fetchSmtpConfig()
    else if (activeTab === 'cms') fetchCmsData()
    else fetchAuditLogs()
  }, [sessionToken, searchQuery, roleFilter, statusFilter, subSearchQuery, subStatusFilter, activeTab])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const handleImpersonateUser = async (user: UserDisplay) => {
    if (user.id === currentUser?.id) return
    if (!window.confirm(`Log in as user "${user.name}" (${user.email})?`)) return
    const res = await impersonateUser(user)
    if (!res.success) alert(res.error || 'Failed to log in as user.')
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreatingUser(true)
    try {
      const res = await callAdminIpc('admin:create-user', sessionToken || 'mock-admin-token', createForm)
      if (res?.success) {
        showToast(`User "${createForm.name}" created successfully.`)
        setShowCreateModal(false)
        fetchUsers()
      } else {
        setCreateError(res?.error || 'Failed to create user')
      }
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreatingUser(false)
    }
  }

  const handleSaveSubEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubItem) return
    try {
      const res = await callAdminIpc('admin:update-user-subscription', sessionToken || 'mock-admin-token', selectedSubItem.user.id, subEditForm)
      if (res?.success) {
        showToast(`Subscription updated for ${selectedSubItem.user.email}`)
        setSelectedSubItem(null)
        fetchSubscriptions()
      } else {
        alert(res?.error || 'Failed to update subscription')
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSaveDesktopConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingDesktopConfig(true)
    try {
      const res = await callAdminIpc('admin:save-desktop-app-config', sessionToken || 'mock-admin-token', desktopConfig)
      if (res?.success) {
        showToast('Desktop release and licensing configuration saved!')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSavingDesktopConfig(false)
    }
  }

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await callAdminIpc('landing:admin-update-branding', sessionToken || 'mock-admin-token', cmsBranding)
      if (res?.success) showToast('Branding settings saved!')
    } catch (err: any) { alert(err.message) }
  }

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await callAdminIpc('landing:admin-update-hero', sessionToken || 'mock-admin-token', cmsHero)
      if (res?.success) showToast('Hero settings saved!')
    } catch (err: any) { alert(err.message) }
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await callAdminIpc('landing:admin-save-plan', sessionToken || 'mock-admin-token', editingPlan)
      if (res?.success) {
        showToast(`Plan "${editingPlan.name}" saved!`)
        setShowPlanModal(false)
        fetchCmsData()
      }
    } catch (err: any) { alert(err.message) }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!window.confirm('Delete this plan?')) return
    try {
      const res = await callAdminIpc('landing:admin-delete-plan', sessionToken || 'mock-admin-token', planId)
      if (res?.success) { showToast('Plan deleted.'); fetchCmsData() }
    } catch (err: any) { alert(err.message) }
  }

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSmtp(true)
    try {
      const res = await callAdminIpc('admin:save-smtp-config', sessionToken || 'mock-admin-token', smtpForm)
      if (res?.success) {
        setSmtpStatusMessage({ type: 'success', text: 'SMTP configuration saved!' })
      }
    } catch (err: any) {
      setSmtpStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSavingSmtp(false)
    }
  }

  const handleUpdateStatus = async (userId: string, newStatus: 'active' | 'pending' | 'suspended') => {
    try {
      const res = await callAdminIpc('admin:update-user-status', sessionToken || 'mock-admin-token', userId, { status: newStatus })
      if (res?.success) { showToast(`User status updated to ${newStatus}`); fetchUsers() }
    } catch (err: any) { alert(err.message) }
  }

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const res = await callAdminIpc('admin:update-user-status', sessionToken || 'mock-admin-token', userId, { role: newRole })
      if (res?.success) { showToast(`User role updated to ${newRole}`); fetchUsers() }
    } catch (err: any) { alert(err.message) }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Delete user "${userName}"?`)) return
    try {
      const res = await callAdminIpc('admin:delete-user', sessionToken || 'mock-admin-token', userId)
      if (res?.success) { showToast(`User "${userName}" deleted`); fetchUsers() }
    } catch (err: any) { alert(err.message) }
  }

  const handleResendVerification = async (user: UserDisplay) => {
    try {
      const res = await callAdminIpc('admin:resend-verification', sessionToken || 'mock-admin-token', user.id)
      if (res?.success) showToast(res.message || `Verification email sent`)
    } catch (err: any) { alert(err.message) }
  }

  const handleViewUserProfiles = async (user: UserDisplay) => {
    setSelectedUser(user)
    setLoadingProfiles(true)
    try {
      const res = await callAdminIpc('admin:get-user-profiles', sessionToken || 'mock-admin-token', user.id)
      if (res?.success) setUserProfiles(res.data || [])
    } catch { setUserProfiles([]) } finally { setLoadingProfiles(false) }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0F0F14', color: '#CBD5E1', overflow: 'hidden' }}>
      {/* Header Bar */}
      <div className="window-drag-area" style={{ padding: '16px 24px 16px 90px', backgroundColor: '#161622', borderBottom: '1px solid #2C2C3E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>👑</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#F1F5F9', fontWeight: 700 }}>
              Admin Control Center
            </h2>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
              System Users, Subscriptions, Windows & macOS Releases, CMS & Licensing
            </span>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="window-no-drag" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#14141F', padding: '3px', borderRadius: '8px', border: '1px solid #2C2C3E' }}>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'users' ? '#1C1C28' : 'transparent',
                color: activeTab === 'users' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'users' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              User Management ({users.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('subscriptions')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'subscriptions' ? '#1C1C28' : 'transparent',
                color: activeTab === 'subscriptions' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'subscriptions' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              💳 Subscriptions
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('releases')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'releases' ? '#1C1C28' : 'transparent',
                color: activeTab === 'releases' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'releases' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              💻 Desktop Releases
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cms')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'cms' ? '#1C1C28' : 'transparent',
                color: activeTab === 'cms' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'cms' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🎨 Landing CMS
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('smtp')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'smtp' ? '#1C1C28' : 'transparent',
                color: activeTab === 'smtp' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'smtp' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              📧 SMTP Settings
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#2DD4BF',
              color: '#0F0F17',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ➕ Create User
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{ backgroundColor: '#10B98120', borderBottom: '1px solid #10B98150', color: '#10B981', padding: '10px 24px', fontSize: '13px', fontWeight: 500 }}>
          ✓ {toastMessage}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

        {/* 1. User Management Tab */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search user name or email..."
                style={{ flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#CBD5E1', fontSize: '13px' }}>
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#14141F', borderBottom: '1px solid #2C2C3E', color: '#94A3B8' }}>
                    <th style={{ padding: '14px 16px' }}>User Details</th>
                    <th style={{ padding: '14px 16px' }}>Role</th>
                    <th style={{ padding: '14px 16px' }}>Email Status</th>
                    <th style={{ padding: '14px 16px' }}>Account Status</th>
                    <th style={{ padding: '14px 16px' }}>Profiles</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #2C2C3E10' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{u.name}</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: u.role === 'admin' ? '#F59E0B20' : '#3B82F620', color: u.role === 'admin' ? '#F59E0B' : '#60A5FA' }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: u.emailVerified ? '#10B98120' : '#EF444420', color: u.emailVerified ? '#10B981' : '#F87171' }}>
                          {u.emailVerified ? '✓ Verified' : '✉ Unverified'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: u.accountStatus === 'active' ? '#10B98120' : '#EF444420', color: u.accountStatus === 'active' ? '#10B981' : '#F87171' }}>
                          {u.accountStatus.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#A5B4FC' }}>{u.profileCount ?? 0}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {u.id !== currentUser?.id && u.accountStatus === 'active' && (
                            <button type="button" onClick={() => handleImpersonateUser(u)} style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #10B98150', backgroundColor: '#10B98115', color: '#10B981', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                              🔑 Login As
                            </button>
                          )}
                          <button type="button" onClick={() => handleViewUserProfiles(u)} style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #2C2C3E', backgroundColor: '#14141F', color: '#CBD5E1', fontSize: '11px', cursor: 'pointer' }}>
                            Profiles ({u.profileCount ?? 0})
                          </button>
                          <button type="button" onClick={() => handleDeleteUser(u.id, u.name)} disabled={u.id === currentUser?.id} style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #EF444450', backgroundColor: '#14141F', color: '#F87171', fontSize: '11px', cursor: 'pointer' }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Subscriptions Management Tab */}
        {activeTab === 'subscriptions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={subSearchQuery}
                onChange={e => setSubSearchQuery(e.target.value)}
                placeholder="Filter by user email or name..."
                style={{ flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
              <select value={subStatusFilter} onChange={e => setSubStatusFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#CBD5E1', fontSize: '13px' }}>
                <option value="">All Subscription Statuses</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="grace_period">Grace Period</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#14141F', borderBottom: '1px solid #2C2C3E', color: '#94A3B8' }}>
                    <th style={{ padding: '14px 16px' }}>User</th>
                    <th style={{ padding: '14px 16px' }}>Assigned Plan</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                    <th style={{ padding: '14px 16px' }}>Starts At</th>
                    <th style={{ padding: '14px 16px' }}>Expires At</th>
                    <th style={{ padding: '14px 16px' }}>Active Devices</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSubs ? (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>Loading subscriptions...</td></tr>
                  ) : subscriptionsList.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No subscriptions found.</td></tr>
                  ) : (
                    subscriptionsList.map((item: any) => (
                      <tr key={item.user.id} style={{ borderBottom: '1px solid #2C2C3E10' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{item.user.name}</div>
                          <div style={{ fontSize: '12px', color: '#94A3B8' }}>{item.user.email}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#2DD4BF' }}>
                          {item.subscription?.plan?.name || 'Starter'} (${item.subscription?.plan?.monthly_price || 19}/mo)
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: item.subscription?.status === 'active' ? '#10B98120' : item.subscription?.status === 'suspended' ? '#EF444420' : '#F59E0B20',
                            color: item.subscription?.status === 'active' ? '#10B981' : item.subscription?.status === 'suspended' ? '#F87171' : '#F59E0B'
                          }}>
                            {(item.subscription?.status || 'active').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '12px' }}>
                          {new Date(item.subscription?.starts_at || Date.now()).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#CBD5E1', fontSize: '12px', fontWeight: 600 }}>
                          {new Date(item.subscription?.expires_at || Date.now()).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#A5B4FC' }}>
                          {item.devices?.length || 0} Device{(item.devices?.length || 0) !== 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubItem(item)
                              setSubEditForm({
                                plan_id: item.subscription?.plan_id || 'plan_pro',
                                status: item.subscription?.status || 'active',
                                expires_at: new Date(item.subscription?.expires_at || Date.now() + 30 * 86400000).toISOString().split('T')[0],
                                grace_period_days: item.subscription?.grace_period_days ?? 3
                              })
                            }}
                            style={{ padding: '5px 12px', borderRadius: '4px', border: '1px solid #2DD4BF50', backgroundColor: '#2DD4BF15', color: '#2DD4BF', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            ⚙️ Manage Subscription
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

        {/* 3. Desktop App Releases & Licensing Configuration Tab */}
        {activeTab === 'releases' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            <form onSubmit={handleSaveDesktopConfig} style={{ backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9', fontWeight: 700 }}>
                💻 Desktop Application Releases & Licensing Settings
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                Configure Windows and macOS binary download links, version enforcement, and device limits.
              </p>

              <div style={{ borderTop: '1px solid #2C2C3E', paddingTop: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#60A5FA' }}>🪟 Windows (x64) Release</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94A3B8' }}>Download URL (ProfileVault-Windows-x64.exe)</label>
                    <input type="text" value={desktopConfig.win_download_url || ''} onChange={e => setDesktopConfig({ ...desktopConfig, win_download_url: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94A3B8' }}>Version</label>
                    <input type="text" value={desktopConfig.win_app_version || '1.0.0'} onChange={e => setDesktopConfig({ ...desktopConfig, win_app_version: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #2C2C3E', paddingTop: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#10B981' }}>🍏 macOS Intel (x64) Release</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94A3B8' }}>Download URL (ProfileVault-macOS-Intel-x64.dmg)</label>
                    <input type="text" value={desktopConfig.mac_intel_download_url || desktopConfig.mac_download_url || ''} onChange={e => setDesktopConfig({ ...desktopConfig, mac_intel_download_url: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94A3B8' }}>Version</label>
                    <input type="text" value={desktopConfig.mac_intel_app_version || desktopConfig.mac_app_version || '1.0.0'} onChange={e => setDesktopConfig({ ...desktopConfig, mac_intel_app_version: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #2C2C3E', paddingTop: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#F59E0B' }}>⚡ macOS Apple Silicon (arm64) Release</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94A3B8' }}>Download URL (ProfileVault-macOS-Apple-Silicon-arm64.dmg)</label>
                    <input type="text" value={desktopConfig.mac_arm_download_url || desktopConfig.mac_download_url || ''} onChange={e => setDesktopConfig({ ...desktopConfig, mac_arm_download_url: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94A3B8' }}>Version</label>
                    <input type="text" value={desktopConfig.mac_arm_app_version || desktopConfig.mac_app_version || '1.0.0'} onChange={e => setDesktopConfig({ ...desktopConfig, mac_arm_app_version: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #2C2C3E', paddingTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94A3B8' }}>Min Supported Version</label>
                  <input type="text" value={desktopConfig.min_supported_version || '1.0.0'} onChange={e => setDesktopConfig({ ...desktopConfig, min_supported_version: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94A3B8' }}>Max Devices Per Account</label>
                  <input type="number" value={desktopConfig.max_devices_limit || '2'} onChange={e => setDesktopConfig({ ...desktopConfig, max_devices_limit: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94A3B8' }}>Release Notes</label>
                <textarea rows={3} value={desktopConfig.release_notes || ''} onChange={e => setDesktopConfig({ ...desktopConfig, release_notes: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px', resize: 'none' }} />
              </div>

              <button type="submit" disabled={savingDesktopConfig} style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                {savingDesktopConfig ? 'Saving...' : '💾 Save Release & Licensing Settings'}
              </button>
            </form>
          </div>
        )}

        {/* 4. Landing CMS Tab */}
        {activeTab === 'cms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #2C2C3E', paddingBottom: '12px' }}>
              {(['branding', 'hero', 'pricing', 'faq', 'seo'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCmsTab(tab)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: cmsTab === tab ? '#1C1C28' : 'transparent',
                    color: cmsTab === tab ? '#2DD4BF' : '#94A3B8',
                    fontWeight: cmsTab === tab ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {cmsTab === 'branding' && (
              <form onSubmit={handleSaveBranding} style={{ maxWidth: '600px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9' }}>Site Branding & Colors</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Site Name</label>
                  <input type="text" value={cmsBranding.site_name || ''} onChange={e => setCmsBranding({ ...cmsBranding, site_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }} />
                </div>
                <button type="submit" style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>💾 Save Branding</button>
              </form>
            )}
          </div>
        )}

        {/* 5. SMTP Tab */}
        {activeTab === 'smtp' && (
          <div style={{ maxWidth: '640px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '28px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#F1F5F9' }}>📧 SMTP Server Settings</h3>
            {smtpStatusMessage && <div style={{ padding: '10px', marginBottom: '16px', borderRadius: '8px', backgroundColor: smtpStatusMessage.type === 'success' ? '#10B98120' : '#EF444420', color: smtpStatusMessage.type === 'success' ? '#10B981' : '#F87171' }}>{smtpStatusMessage.text}</div>}
            <form onSubmit={handleSaveSmtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="text" placeholder="SMTP Host" value={smtpForm.host} onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })} style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }} />
              <button type="submit" style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Save SMTP Settings</button>
            </form>
          </div>
        )}
      </div>

      {/* Subscription Edit Modal */}
      {selectedSubItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: '90%', maxWidth: '480px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2C2C3E', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#F1F5F9' }}>Manage Subscription: {selectedSubItem.user.name}</h3>
              <button type="button" onClick={() => setSelectedSubItem(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleSaveSubEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94A3B8' }}>Select Plan</label>
                <select value={subEditForm.plan_id} onChange={e => setSubEditForm({ ...subEditForm, plan_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}>
                  <option value="plan_free">Free ($0/mo)</option>
                  <option value="plan_starter">Starter ($19/mo)</option>
                  <option value="plan_pro">Professional ($49/mo)</option>
                  <option value="plan_business">Business ($99/mo)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94A3B8' }}>Status</label>
                <select value={subEditForm.status} onChange={e => setSubEditForm({ ...subEditForm, status: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="grace_period">Grace Period</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94A3B8' }}>Expiration Date</label>
                <input type="date" value={subEditForm.expires_at} onChange={e => setSubEditForm({ ...subEditForm, expires_at: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setSelectedSubItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#94A3B8', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Profiles Drawer Modal */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: '90%', maxWidth: '600px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#F1F5F9' }}>User Profiles: {selectedUser.name}</h3>
              <button type="button" onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>✕</button>
            </div>
            {userProfiles.map(p => (
              <div key={p.id} style={{ padding: '8px 12px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '6px', marginBottom: '8px', fontSize: '13px', color: '#F1F5F9' }}>
                {p.name} ({p.osType})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
