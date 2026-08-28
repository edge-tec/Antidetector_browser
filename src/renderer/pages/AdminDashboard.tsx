// ──────────────────────────────────────────────
// AntiProfiles — Admin Management Dashboard (Users, Subscriptions, Desktop App, CMS, SMTP)
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { UserDisplay, Profile } from '../types'
import { AdminSupportManager } from '../components/AdminSupportManager'
import { AdminSeoManager } from '../components/AdminSeoManager'
import { AdminSoftwareVersionManager } from '../components/AdminSoftwareVersionManager'
import { AdminAffiliateManager } from '../components/AdminAffiliateManager'
import { CustomBrandingManager } from '../components/CustomBrandingManager'
import { AdminLaunchUrlManager } from '../components/AdminLaunchUrlManager'
import { AdminPaymentManager } from '../components/AdminPaymentManager'

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
    email: 'admin@antiprofiles.com',
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
      'admin:send-email-broadcast': 'adminSendEmailBroadcast',
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
      'admin:save-desktop-app-config': 'adminSaveDesktopAppConfig',
      'admin:get-launch-url-config': 'adminGetLaunchUrlConfig',
      'admin:save-launch-url-config': 'adminSaveLaunchUrlConfig',
      'admin:enroll-all-launch-url': 'adminEnrollAllLaunchUrl',
      'admin:get-payments-overview': 'adminGetPaymentsOverview',
      'admin:get-payment-gateways': 'adminGetPaymentGateways',
      'admin:save-payment-gateway': 'adminSavePaymentGateway',
      'admin:set-user-trial': 'adminSetUserTrial',
      'admin:record-manual-payment': 'adminRecordManualPayment',
      'admin:refund-payment': 'adminRefundPayment'
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
        win_download_url: 'https://releases.antiprofiles.com/AntiProfiles-Setup-1.0.0.exe',
        win_app_version: '1.0.0',
        win_enabled: 'true',
        mac_download_url: 'https://releases.antiprofiles.com/AntiProfiles-1.0.0.dmg',
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

  if (channel === 'admin:get-smtp-config') {
    return {
      success: true,
      data: {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'admin@antiprofiles.com',
        password: '',
        fromEmail: 'noreply@antiprofiles.com',
        secure: false,
        enabled: true
      }
    }
  }

  if (channel === 'admin:test-smtp-config') {
    return {
      success: true,
      message: 'Successfully connected to SMTP server (Mock Test)'
    }
  }

  return { success: true }
}

interface AdminDashboardProps {
  initialTab?: 'users' | 'subscriptions' | 'payments' | 'launch_url' | 'releases' | 'cms' | 'smtp' | 'support' | 'seo' | 'affiliates' | 'audit'
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialTab }) => {
  const { sessionToken, currentUser, impersonateUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'payments' | 'launch_url' | 'releases' | 'cms' | 'smtp' | 'support' | 'seo' | 'affiliates' | 'audit'>(initialTab || 'users')

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
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
    win_download_url: 'https://releases.antiprofiles.com/AntiProfiles-Setup-1.0.0.exe',
    win_app_version: '1.0.0',
    win_enabled: 'true',
    mac_download_url: 'https://releases.antiprofiles.com/AntiProfiles-1.0.0.dmg',
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
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [smtpStatusMessage, setSmtpStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Broadcast Email State
  const [broadcastForm, setBroadcastForm] = useState({
    targetGroup: 'all',
    customEmails: '',
    subject: '⚡ AntiProfiles Latest Update & Feature Announcement',
    messageBody: 'Hello,\n\nWe are excited to share our latest product updates with you! Check out the new performance improvements, updated browser fingerprint databases, and enhanced security features in AntiProfiles.\n\nThank you for choosing AntiProfiles!'
  })
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastStatus, setBroadcastStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Landing CMS State
  const [cmsTab, setCmsTab] = useState<'branding' | 'hero' | 'pricing' | 'faq' | 'seo'>('branding')
  const [cmsBranding, setCmsBranding] = useState<Record<string, string>>({ site_name: 'AntiProfiles', accent_color: '#2DD4BF' })
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
    setSmtpStatusMessage(null)
    try {
      const res = await callAdminIpc('admin:save-smtp-config', sessionToken || 'mock-admin-token', smtpForm)
      if (res?.success) {
        setSmtpStatusMessage({ type: 'success', text: 'SMTP server configuration updated and saved successfully!' })
      } else {
        setSmtpStatusMessage({ type: 'error', text: res?.error || 'Failed to save SMTP configuration.' })
      }
    } catch (err: any) {
      setSmtpStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSavingSmtp(false)
    }
  }

  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    setSmtpStatusMessage(null)
    try {
      const res = await callAdminIpc('admin:test-smtp-config', sessionToken || 'mock-admin-token', smtpForm)
      if (res?.success) {
        setSmtpStatusMessage({ type: 'success', text: res.message || 'Successfully connected to SMTP server!' })
      } else {
        setSmtpStatusMessage({ type: 'error', text: res?.message || res?.error || 'SMTP Connection test failed.' })
      }
    } catch (err: any) {
      setSmtpStatusMessage({ type: 'error', text: err.message })
    } finally {
      setTestingSmtp(false)
    }
  }

  const applySmtpPreset = (preset: 'gmail' | 'outlook' | 'sendgrid' | 'mailgun' | 'ses') => {
    switch (preset) {
      case 'gmail':
        setSmtpForm(prev => ({ ...prev, host: 'smtp.gmail.com', port: 587, secure: false, enabled: true }))
        showToast('Applied Gmail SMTP preset (smtp.gmail.com:587)')
        break
      case 'outlook':
        setSmtpForm(prev => ({ ...prev, host: 'smtp.office365.com', port: 587, secure: false, enabled: true }))
        showToast('Applied Outlook / Office 365 preset (smtp.office365.com:587)')
        break
      case 'sendgrid':
        setSmtpForm(prev => ({ ...prev, host: 'smtp.sendgrid.net', port: 587, secure: false, enabled: true }))
        showToast('Applied SendGrid preset (smtp.sendgrid.net:587)')
        break
      case 'mailgun':
        setSmtpForm(prev => ({ ...prev, host: 'smtp.mailgun.org', port: 587, secure: false, enabled: true }))
        showToast('Applied Mailgun preset (smtp.mailgun.org:587)')
        break
      case 'ses':
        setSmtpForm(prev => ({ ...prev, host: 'email-smtp.us-east-1.amazonaws.com', port: 587, secure: false, enabled: true }))
        showToast('Applied Amazon SES preset (Port 587)')
        break
    }
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastForm.subject || !broadcastForm.messageBody) {
      setBroadcastStatus({ type: 'error', text: 'Subject and message body content are required.' })
      return
    }
    setSendingBroadcast(true)
    setBroadcastStatus(null)
    try {
      const customEmailsArr = broadcastForm.targetGroup === 'custom'
        ? broadcastForm.customEmails.split(',').map(e => e.trim()).filter(Boolean)
        : []
      const res = await callAdminIpc('admin:send-email-broadcast', sessionToken || 'mock-admin-token', {
        targetGroup: broadcastForm.targetGroup,
        customEmails: customEmailsArr,
        subject: broadcastForm.subject,
        messageBody: broadcastForm.messageBody
      })
      if (res?.success) {
        setBroadcastStatus({ type: 'success', text: res.message || 'Email update broadcast sent successfully!' })
        showToast('Email broadcast delivered!')
      } else {
        setBroadcastStatus({ type: 'error', text: res?.error || res?.message || 'Failed to deliver broadcast email.' })
      }
    } catch (err: any) {
      setBroadcastStatus({ type: 'error', text: err.message })
    } finally {
      setSendingBroadcast(false)
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
              onClick={() => setActiveTab('payments')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'payments' ? '#1C1C28' : 'transparent',
                color: activeTab === 'payments' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'payments' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              💰 Payments & Billing
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('launch_url')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'launch_url' ? '#1C1C28' : 'transparent',
                color: activeTab === 'launch_url' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'launch_url' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🌐 Launch URL
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

            <button
              type="button"
              onClick={() => setActiveTab('support')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'support' ? '#1C1C28' : 'transparent',
                color: activeTab === 'support' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'support' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              💬 Live Support
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('seo')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'seo' ? '#1C1C28' : 'transparent',
                color: activeTab === 'seo' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'seo' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🔍 SEO Management
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('affiliates')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'affiliates' ? '#1C1C28' : 'transparent',
                color: activeTab === 'affiliates' ? '#2DD4BF' : '#94A3B8',
                fontWeight: activeTab === 'affiliates' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🤝 Affiliates & Referrals
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
                            onClick={async () => {
                              const days = prompt(`Enter Free Trial duration in days for ${item.user.name || item.user.email}:`, '7')
                              if (!days) return
                              const numDays = parseInt(days, 10)
                              if (isNaN(numDays) || numDays <= 0) {
                                alert('Please enter a valid number of days.')
                                return
                              }
                              const token = localStorage.getItem('pv_session_token') || ''
                              const res = await (window as any).api.adminSetUserTrial(token, {
                                userId: item.user.id,
                                trialDays: numDays,
                                planId: item.subscription?.plan_id || 'plan_starter'
                              })
                              if (res?.success) {
                                showToast(`Granted ${numDays}-day Free Trial for ${item.user.email}`)
                                fetchSubscriptions()
                              } else {
                                alert(res?.error || 'Failed to set trial')
                              }
                            }}
                            style={{ marginRight: '8px', padding: '5px 10px', borderRadius: '4px', border: '1px solid #A855F750', backgroundColor: '#A855F715', color: '#C084FC', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            ⏱️ Set Trial
                          </button>

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

        {/* 2.5 Payments, Purchases & Gateway Configuration Tab */}
        {activeTab === 'payments' && (
          <AdminPaymentManager onSubscriptionUpdated={fetchSubscriptions} />
        )}

        {/* 3. Global Launch URL & Start Page Management Tab */}
        {activeTab === 'launch_url' && (
          <AdminLaunchUrlManager />
        )}

        {/* 4. Desktop App Releases & Software Version Management Tab */}
        {activeTab === 'releases' && (
          <AdminSoftwareVersionManager />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <form onSubmit={handleSaveBranding} style={{ maxWidth: '600px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9' }}>Site Branding & Colors</h3>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Site Name</label>
                    <input type="text" value={cmsBranding.site_name || ''} onChange={e => setCmsBranding({ ...cmsBranding, site_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF' }} />
                  </div>
                  <button type="submit" style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>💾 Save Branding</button>
                </form>

                <CustomBrandingManager />
              </div>
            )}
          </div>
        )}

        {/* 5. SMTP Tab */}
        {activeTab === 'smtp' && (
          <div style={{ maxWidth: '800px', backgroundColor: '#161622', border: '1px solid #2C2C3E', borderRadius: '16px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #2C2C3E', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#F1F5F9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📧</span> Full SMTP Server Configuration
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  Configure outgoing mail server for email verification links, security alerts, and system notifications.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: smtpForm.enabled ? '#10B98120' : '#64748B20',
                    color: smtpForm.enabled ? '#10B981' : '#94A3B8',
                    border: `1px solid ${smtpForm.enabled ? '#10B98140' : '#64748B40'}`
                  }}
                >
                  {smtpForm.enabled ? '● SMTP Active' : '○ SMTP Disabled'}
                </span>
              </div>
            </div>

            {/* Quick Provider Presets */}
            <div style={{ marginBottom: '20px', backgroundColor: '#14141F', padding: '14px', borderRadius: '12px', border: '1px solid #2C2C3E' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                ⚡ Quick Provider Presets
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('gmail')}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1C1C28', border: '1px solid #334155', color: '#F87171', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  🔴 Gmail
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('outlook')}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1C1C28', border: '1px solid #334155', color: '#60A5FA', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  🟦 Outlook 365
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('sendgrid')}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1C1C28', border: '1px solid #334155', color: '#34D399', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  🟩 SendGrid
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('mailgun')}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1C1C28', border: '1px solid #334155', color: '#FBBF24', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  🟧 Mailgun
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('ses')}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1C1C28', border: '1px solid #334155', color: '#F472B6', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  🟨 Amazon SES
                </button>
              </div>
            </div>

            {smtpStatusMessage && (
              <div
                style={{
                  padding: '12px 16px',
                  marginBottom: '20px',
                  borderRadius: '10px',
                  backgroundColor: smtpStatusMessage.type === 'success' ? '#10B9811A' : '#EF44441A',
                  color: smtpStatusMessage.type === 'success' ? '#34D399' : '#F87171',
                  border: `1px solid ${smtpStatusMessage.type === 'success' ? '#10B98140' : '#EF444440'}`,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>{smtpStatusMessage.type === 'success' ? '✅' : '❌'}</span>
                <span>{smtpStatusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveSmtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Toggle Switch Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  backgroundColor: '#14141F',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #2C2C3E'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9' }}>Enable Outgoing SMTP Delivery</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    When enabled, account verification and alerts are delivered directly to user email inboxes via SMTP.
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={smtpForm.enabled}
                    onChange={e => setSmtpForm({ ...smtpForm, enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: smtpForm.enabled ? '#2DD4BF' : '#334155',
                      borderRadius: '26px',
                      transition: '0.2s',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      height: '20px',
                      width: '20px',
                      left: smtpForm.enabled ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: '#FFF',
                      borderRadius: '50%',
                      transition: '0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                </label>
              </div>

              {/* Server Host & Port Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    SMTP Server Host
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. smtp.gmail.com or mail.yourdomain.com"
                    value={smtpForm.host}
                    onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    placeholder="587"
                    value={smtpForm.port}
                    onChange={e => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) || 587 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Security & Encryption Option */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                  Encryption Protocol
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSmtpForm({ ...smtpForm, secure: false })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: !smtpForm.secure ? '#1C1C28' : '#14141F',
                      border: `1px solid ${!smtpForm.secure ? '#2DD4BF' : '#2C2C3E'}`,
                      color: !smtpForm.secure ? '#2DD4BF' : '#94A3B8',
                      fontSize: '13px',
                      fontWeight: !smtpForm.secure ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🔒 STARTTLS / TLS (Port 587/25)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSmtpForm({ ...smtpForm, secure: true })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: smtpForm.secure ? '#1C1C28' : '#14141F',
                      border: `1px solid ${smtpForm.secure ? '#2DD4BF' : '#2C2C3E'}`,
                      color: smtpForm.secure ? '#2DD4BF' : '#94A3B8',
                      fontSize: '13px',
                      fontWeight: smtpForm.secure ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🛡️ Direct SSL / TLS (Port 465)
                  </button>
                </div>
              </div>

              {/* Authentication Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    SMTP Username / Email
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. user@gmail.com or api_key"
                    value={smtpForm.user}
                    onChange={e => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    SMTP Password / App Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      placeholder="••••••••••••••••"
                      value={smtpForm.password}
                      onChange={e => setSmtpForm({ ...smtpForm, password: e.target.value })}
                      style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '14px' }}
                    >
                      {showSmtpPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Email Address */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                  Default "From" Sender Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. noreply@antiprofiles.com"
                  value={smtpForm.fromEmail}
                  onChange={e => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', outline: 'none' }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  If left empty, system defaults to SMTP Username.
                </span>
              </div>

              {/* Buttons Bar */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px', borderTop: '1px solid #2C2C3E', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || !smtpForm.host || !smtpForm.user}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#1C1C28',
                    border: '1px solid #334155',
                    color: testingSmtp ? '#94A3B8' : '#F1F5F9',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: testingSmtp || !smtpForm.host || !smtpForm.user ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {testingSmtp ? '⚡ Testing Connection...' : '⚡ Test SMTP Connection'}
                </button>

                <button
                  type="submit"
                  disabled={savingSmtp}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#2DD4BF',
                    color: '#0F0F17',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: savingSmtp ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {savingSmtp ? '💾 Saving Configuration...' : '💾 Save SMTP Settings'}
                </button>
              </div>
            </form>

            {/* 📢 Admin Email Broadcast & Updates System Card */}
            <div style={{ marginTop: '24px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px' }}>
              <div style={{ marginBottom: '16px', borderBottom: '1px solid #2C2C3E', paddingBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📢</span> Send Latest Update & System Announcement
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  Deliver latest product update notifications, release notes, or security announcements directly to user inboxes.
                </p>
              </div>

              {broadcastStatus && (
                <div
                  style={{
                    padding: '10px 14px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    backgroundColor: broadcastStatus.type === 'success' ? '#10B9811A' : '#EF44441A',
                    color: broadcastStatus.type === 'success' ? '#34D399' : '#F87171',
                    border: `1px solid ${broadcastStatus.type === 'success' ? '#10B98140' : '#EF444440'}`,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>{broadcastStatus.type === 'success' ? '✅' : '❌'}</span>
                  <span>{broadcastStatus.text}</span>
                </div>
              )}

              <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    Target Audience
                  </label>
                  <select
                    value={broadcastForm.targetGroup}
                    onChange={e => setBroadcastForm({ ...broadcastForm, targetGroup: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#1C1C28', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                  >
                    <option value="all">👥 All Registered Users</option>
                    <option value="verified">✓ Verified Users Only</option>
                    <option value="admins">👑 Administrators Only</option>
                    <option value="custom">✏️ Custom Email Address List</option>
                  </select>
                </div>

                {broadcastForm.targetGroup === 'custom' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                      Custom Recipients (Comma-separated emails)
                    </label>
                    <input
                      type="text"
                      placeholder="user1@example.com, user2@example.com"
                      value={broadcastForm.customEmails}
                      onChange={e => setBroadcastForm({ ...broadcastForm, customEmails: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#1C1C28', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    Email Subject / Headline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ⚡ AntiProfiles Update: New Features Released!"
                    value={broadcastForm.subject}
                    onChange={e => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#1C1C28', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                    Announcement Message Body
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Type your system announcement or update details here..."
                    value={broadcastForm.messageBody}
                    onChange={e => setBroadcastForm({ ...broadcastForm, messageBody: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#1C1C28', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', resize: 'vertical', lineHeight: '1.5' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastForm.subject || !broadcastForm.messageBody}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#6366F1',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: sendingBroadcast || !broadcastForm.subject || !broadcastForm.messageBody ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}
                >
                  {sendingBroadcast ? '🚀 Delivering Broadcast...' : '📢 Send Email Announcement to Users'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Support Tab View */}
        {activeTab === 'support' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <AdminSupportManager />
          </div>
        )}

        {/* SEO Management Tab View */}
        {activeTab === 'seo' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <AdminSeoManager sessionToken={sessionToken || ''} />
          </div>
        )}

        {/* Affiliate Management Tab View */}
        {activeTab === 'affiliates' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <AdminAffiliateManager />
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

              {/* Quick Trial Presets */}
              <div style={{ padding: '10px 12px', backgroundColor: '#14141F', borderRadius: '8px', border: '1px solid #2C2C3E', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: '#C084FC', fontWeight: 700 }}>⏱️ QUICK TRIAL PRESETS:</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[3, 7, 14, 30].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        const now = new Date()
                        now.setDate(now.getDate() + days)
                        setSubEditForm({
                          ...subEditForm,
                          status: 'trial',
                          expires_at: now.toISOString().split('T')[0]
                        })
                      }}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', backgroundColor: '#2C2C3E', border: '1px solid #3B3B54', color: '#C084FC', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {days}d Trial
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setSelectedSubItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#94A3B8', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F0F17', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div
          className="window-no-drag"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            WebkitAppRegion: 'no-drag' as any
          }}
        >
          <div
            className="window-no-drag"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#181824',
              border: '1px solid #2C2C3E',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              position: 'relative',
              WebkitAppRegion: 'no-drag' as any
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2C2C3E', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>👤</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFF' }}>Create New User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#CBD5E1',
                  fontSize: '18px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FFF'
                  e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.3)'
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#CBD5E1'
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                }}
              >
                ✕
              </button>
            </div>

            {createError && (
              <div style={{ backgroundColor: '#EF444420', border: '1px solid #EF444460', color: '#F87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@example.com"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Password *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Role</label>
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm({ ...createForm, role: e.target.value as any })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                  >
                    <option value="user">Regular User</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>Account Status</label>
                  <select
                    value={createForm.accountStatus}
                    onChange={e => setCreateForm({ ...createForm, accountStatus: e.target.value as any })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid #2C2C3E' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  style={{ padding: '10px 22px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(45, 212, 191, 0.4)' }}
                >
                  {creatingUser ? 'Creating...' : '➕ Create User'}
                </button>
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
