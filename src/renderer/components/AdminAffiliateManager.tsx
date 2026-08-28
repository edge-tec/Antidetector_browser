// ──────────────────────────────────────────────
// AntiProfiles — Admin CPA Affiliate, Offers, Postback & Multi-Status Withdrawal Control
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

interface AdminAffiliateData {
  settings: {
    enabled: boolean
    commission_rate_percent: number
    holding_period_days: number
    min_withdrawal_usd: number
    enabled_payout_methods: string[]
    attribution_model: string
    self_referral_allowed: boolean
    system_domain: string
  }
  stats: {
    totalAffiliates: number
    totalClicks: number
    totalConversions: number
    totalReferredRevenue: number
    totalCommissionsPaid: number
    totalCommissionsPending: number
    totalPendingWithdrawalRequests: number
    pendingWithdrawalSum: number
  }
  affiliates: any[]
  offers: any[]
  clicks: any[]
  conversions: any[]
  postbacks: any[]
  postbackConfigs: any[]
  withdrawals: any[]
  auditLogs: any[]
}

export const AdminAffiliateManager: React.FC = () => {
  const [data, setData] = useState<AdminAffiliateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'affiliates' | 'offers' | 'landing_pages' | 'clicks' | 'fraud' | 'conversions' | 'postbacks' | 'settings' | 'audit'>('withdrawals')
  
  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<any>({
    enabled: true,
    commission_rate_percent: 10,
    holding_period_days: 7,
    min_withdrawal_usd: 20,
    system_domain: 'https://antiprofiles.com'
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Offer Modal State
  const [offerModal, setOfferModal] = useState<{
    open: boolean
    isEdit: boolean
    id?: string
    title: string
    description: string
    target_url: string
    package_id: string
    package_name: string
    price: number
    original_price: number
    discount_percent: number
    discount_start_date: string
    discount_end_date: string
    cta_text: string
    badge_text: string
    trial_enabled: boolean
    billing_interval: string
    payout_type: 'percentage' | 'fixed'
    commission_rate: number
    fixed_payout_usd: number
    status: 'active' | 'paused' | 'archived'
  }>({
    open: false,
    isEdit: false,
    title: '',
    description: '',
    target_url: '/offer/starter',
    package_id: 'plan_starter',
    package_name: 'Starter',
    price: 19,
    original_price: 19,
    discount_percent: 0,
    discount_start_date: '',
    discount_end_date: '',
    cta_text: 'Subscribe Starter',
    badge_text: 'Starter',
    trial_enabled: false,
    billing_interval: 'month',
    payout_type: 'percentage',
    commission_rate: 40,
    fixed_payout_usd: 10,
    status: 'active'
  })
  const [savingOffer, setSavingOffer] = useState(false)

  // Payout Action Modal State
  const [actionModal, setActionModal] = useState<{
    open: boolean
    withdrawal: any | null
    status: 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | 'cancelled'
    adminNotes: string
    txRef: string
  }>({
    open: false,
    withdrawal: null,
    status: 'paid',
    adminNotes: '',
    txRef: ''
  })
  const [processingAction, setProcessingAction] = useState(false)

  // S2S Postback Edit & Test Modal State
  const [postbackModal, setPostbackModal] = useState<{
    open: boolean
    userId: string
    userName?: string
    userEmail?: string
    affiliateId: string
    postbackUrl: string
    httpMethod: 'GET' | 'POST'
    isActive: boolean
  }>({
    open: false,
    userId: '',
    affiliateId: '',
    postbackUrl: '',
    httpMethod: 'GET',
    isActive: true
  })
  const [savingPostback, setSavingPostback] = useState(false)
  const [testingPostback, setTestingPostback] = useState(false)
  const [testPostbackResult, setTestPostbackResult] = useState<{ statusCode: number; responseTimeMs: number; error?: string } | null>(null)

  // Reports Modal State
  const [showReportModal, setShowReportModal] = useState(false)
  const [clickSearch, setClickSearch] = useState('')
  const [convSearch, setConvSearch] = useState('')

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Unified API caller supporting both Electron Desktop IPC and Web Browser REST API
  const callAffiliateApi = async (action: string, method = 'GET', payload?: any) => {
    const token = localStorage.getItem('pv_session_token') || ''

    try {
      // 1. Electron IPC Environment
      if (action === 'admin-get-overview' && (window as any).api?.affiliateGetAdminOverview) {
        return await (window as any).api.affiliateGetAdminOverview(token)
      }
      if (action === 'admin-save-offer' && (window as any).api?.affiliateAdminSaveOffer) {
        return await (window as any).api.affiliateAdminSaveOffer(token, payload)
      }
      if (action === 'admin-delete-offer' && (window as any).api?.affiliateAdminDeleteOffer) {
        return await (window as any).api.affiliateAdminDeleteOffer(token, payload?.id)
      }
      if (action === 'admin-save-settings' && (window as any).api?.affiliateAdminSaveSettings) {
        return await (window as any).api.affiliateAdminSaveSettings(token, payload)
      }
      if (action === 'admin-update-affiliate-status' && (window as any).api?.affiliateAdminUpdateStatus) {
        return await (window as any).api.affiliateAdminUpdateStatus(token, payload.affiliateId, payload.status)
      }
      if (action === 'admin-update-withdrawal' && (window as any).api?.affiliateAdminUpdateWithdrawal) {
        return await (window as any).api.affiliateAdminUpdateWithdrawal(token, payload.withdrawalId, payload.status, payload.adminNotes, payload.txRef)
      }
      if (action === 'admin-retry-postback' && (window as any).api?.affiliateRetryPostback) {
        return await (window as any).api.affiliateRetryPostback(payload.postbackId, token)
      }
      if (action === 'admin-save-postback-config' && (window as any).api?.affiliateAdminSavePostbackConfig) {
        return await (window as any).api.affiliateAdminSavePostbackConfig(token, payload.userId, payload.postbackUrl, payload.method, payload.isActive)
      }
      if (action === 'admin-test-postback' && (window as any).api?.affiliateAdminTestPostback) {
        return await (window as any).api.affiliateAdminTestPostback(token, payload.postbackUrl, payload.method)
      }
      if (action === 'admin-reverse-commission' && (window as any).api?.affiliateAdminReverseCommission) {
        return await (window as any).api.affiliateAdminReverseCommission(token, payload.commissionId, payload.reason)
      }
      if (action === 'admin-adjust-balance' && (window as any).api?.affiliateAdminAdjustBalance) {
        return await (window as any).api.affiliateAdminAdjustBalance(token, payload.userId, payload.amount, payload.reason)
      }
    } catch {}

    // 2. Web REST API Fallback
    try {
      const res = await fetch(`/api/affiliate.php?action=${encodeURIComponent(action)}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        ...(payload && method !== 'GET' ? { body: JSON.stringify(payload) } : {})
      })
      return await res.json()
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await callAffiliateApi('admin-get-overview', 'GET')
      if (res?.success && res?.data) {
        setData(res.data)
        setSettingsForm({
          enabled: res.data.settings?.enabled !== false,
          commission_rate_percent: res.data.settings?.commission_rate_percent || 10,
          holding_period_days: res.data.settings?.holding_period_days || 7,
          min_withdrawal_usd: res.data.settings?.min_withdrawal_usd || 20,
          system_domain: res.data.settings?.system_domain || 'https://antiprofiles.com'
        })
      } else if (res?.error && showSpinner) {
        showToast('error', res.error)
      }
    } catch (err: any) {
      if (showSpinner) showToast('error', 'Failed to load affiliate administration: ' + err.message)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  // Real-Time CSV Export & Reporting Engine
  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('success', `📥 Exported ${filename}.csv successfully!`)
  }

  const exportReport = (type: 'clicks' | 'conversions' | 'affiliates' | 'withdrawals' | 'audit' | 'executive') => {
    if (type === 'clicks') {
      const headers = ['Time', 'Click ID', 'Affiliate ID', 'Offer ID', 'IP Address', 'User Agent', 'SubID1', 'SubID2', 'Converted']
      const rows = [headers, ...(data?.clicks || []).map(c => [
        new Date(c.created_at).toLocaleString(),
        c.click_id,
        c.affiliate_id,
        c.offer_id,
        c.ip_address || '',
        c.user_agent || '',
        c.sub_id1 || '',
        c.sub_id2 || '',
        c.converted ? 'YES' : 'NO'
      ])]
      downloadCsv('Live_Click_Stream_Report', rows)
    } else if (type === 'conversions') {
      const headers = ['Time', 'Conversion ID', 'Click ID', 'Affiliate ID', 'Offer ID', 'Order Amount ($)', 'Payout Amount ($)', 'Status']
      const rows = [headers, ...(data?.conversions || []).map(c => [
        new Date(c.created_at).toLocaleString(),
        c.conversion_id,
        c.click_id,
        c.affiliate_id,
        c.offer_id,
        Number(c.order_amount || 0).toFixed(2),
        Number(c.payout_amount || 0).toFixed(2),
        c.status.toUpperCase()
      ])]
      downloadCsv('CPA_Conversions_Attribution_Report', rows)
    } else if (type === 'affiliates') {
      const headers = ['Name', 'Email', 'Affiliate ID', 'Referral Code', 'Total Clicks', 'Total Conversions', 'Total Earned ($)', 'Total Withdrawn ($)', 'Status', 'Registered Date']
      const rows = [headers, ...(data?.affiliates || []).map(a => [
        a.name || 'User',
        a.email,
        a.affiliate_id,
        a.referral_code,
        a.clicks_count || 0,
        a.conversions_count || 0,
        Number(a.total_earned || 0).toFixed(2),
        Number(a.total_withdrawn || 0).toFixed(2),
        (a.affiliate_status || 'active').toUpperCase(),
        new Date(a.created_at).toLocaleDateString()
      ])]
      downloadCsv('Affiliates_Directory_Performance_Report', rows)
    } else if (type === 'withdrawals') {
      const headers = ['Withdrawal ID', 'User Name', 'User Email', 'Amount ($)', 'Method', 'Status', 'Requested At', 'Processed At', 'Transaction Ref', 'Admin Notes']
      const rows = [headers, ...(data?.withdrawals || []).map(w => [
        w.id,
        w.user_name || '',
        w.user_email || '',
        Number(w.amount || 0).toFixed(2),
        w.payout_method.toUpperCase(),
        w.status.toUpperCase(),
        new Date(w.requested_at).toLocaleString(),
        w.processed_at ? new Date(w.processed_at).toLocaleString() : '',
        w.payout_reference || '',
        w.admin_notes || ''
      ])]
      downloadCsv('Withdrawals_Settlements_Report', rows)
    } else if (type === 'audit') {
      const headers = ['Time', 'Action Type', 'Admin User', 'Target ID', 'Details', 'IP Address']
      const rows = [headers, ...(data?.auditLogs || []).map(l => [
        new Date(l.created_at).toLocaleString(),
        l.action_type,
        l.admin_user_id || 'system',
        l.target_id || '',
        l.details || '',
        l.ip_address || ''
      ])]
      downloadCsv('Affiliate_Audit_Trail_Report', rows)
    } else if (type === 'executive') {
      const rows = [
        ['ANTI-PROFILES CPA AFFILIATE NETWORK EXECUTIVE REPORT'],
        ['Generated At', new Date().toLocaleString()],
        [''],
        ['--- KEY PERFORMANCE METRICS ---'],
        ['Total Registered Affiliates', data?.stats?.totalAffiliates || 0],
        ['Total Tracked Clicks', data?.stats?.totalClicks || 0],
        ['Total Conversions', data?.stats?.totalConversions || 0],
        ['Total Referred Revenue ($)', Number(data?.stats?.totalReferredRevenue || 0).toFixed(2)],
        ['Total Commissions Paid ($)', Number(data?.stats?.totalCommissionsPaid || 0).toFixed(2)],
        ['Total Pending Commissions ($)', Number(data?.stats?.totalCommissionsPending || 0).toFixed(2)],
        ['Pending Withdrawals Count', data?.stats?.totalPendingWithdrawalRequests || 0],
        ['Pending Withdrawals Sum ($)', Number(data?.stats?.pendingWithdrawalSum || 0).toFixed(2)],
        ['Active CPA Offers', data?.offers?.length || 0],
        ['']
      ]
      downloadCsv('CPA_Network_Executive_Report', rows)
    }
  }

  // Real-Time Simulation for Live Demonstration
  const handleSimulateTestClick = async () => {
    const targetAffId = data?.affiliates?.[0]?.affiliate_id || 'AFF-28DE2A'
    const targetOfferId = data?.offers?.[0]?.id || 'offer_main_saas'
    try {
      if ((window as any).api?.affiliateRecordClick) {
        const res = await (window as any).api.affiliateRecordClick({
          affiliate_id: targetAffId,
          offer_id: targetOfferId,
          sub_id1: 'live_test',
          ip_address: '127.0.0.1',
          user_agent: navigator.userAgent
        })
        if (res?.success) {
          showToast('success', `🧪 Simulated live click logged: ${res.data?.click_id}`)
          loadData(false)
        }
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleSimulateTestConversion = async () => {
    const targetAffId = data?.affiliates?.[0]?.affiliate_id || 'AFF-28DE2A'
    const targetOfferId = data?.offers?.[0]?.id || 'offer_main_saas'
    const clickId = data?.clicks?.[0]?.click_id || `clk_${Date.now()}`
    try {
      if ((window as any).api?.affiliateRecordConversion) {
        const res = await (window as any).api.affiliateRecordConversion({
          click_id: clickId,
          affiliate_id: targetAffId,
          offer_id: targetOfferId,
          order_amount: 49.00,
          customer_user_id: 'usr_test_buyer'
        })
        if (res?.success) {
          showToast('success', `🎉 Simulated live conversion: ${res.conversionId || 'Success'} (+$${res.commissionAmount || 15} credited)`)
          loadData(false)
        }
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  useEffect(() => {
    loadData(true)

    // Real-Time 4-second Polling Loop
    const pollTimer = setInterval(() => {
      loadData(false)
    }, 4000)

    // Real-time synchronization across Desktop & Web Admin instances
    let unsubSync: (() => void) | undefined
    let unsubOffers: (() => void) | undefined
    let unsubComm: (() => void) | undefined
    let unsubRef: (() => void) | undefined

    if ((window as any).api?.onRealtimeSyncEvent) {
      unsubSync = (window as any).api.onRealtimeSyncEvent((_e: any, d: any) => {
        if (d?.eventType?.includes('affiliate') || d?.eventType?.includes('offer')) {
          loadData(false)
        }
      })
    }

    if ((window as any).api?.onAffiliateOffersUpdated) {
      unsubOffers = (window as any).api.onAffiliateOffersUpdated(() => {
        loadData(false)
      })
    }

    if ((window as any).api?.onAffiliateCommissionEarned) {
      unsubComm = (window as any).api.onAffiliateCommissionEarned(() => {
        loadData(false)
      })
    }

    if ((window as any).api?.onAffiliateNewReferral) {
      unsubRef = (window as any).api.onAffiliateNewReferral(() => {
        loadData(false)
      })
    }

    return () => {
      clearInterval(pollTimer)
      if (unsubSync) unsubSync()
      if (unsubOffers) unsubOffers()
      if (unsubComm) unsubComm()
      if (unsubRef) unsubRef()
    }
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await callAffiliateApi('admin-save-settings', 'POST', settingsForm)
      if (res?.success) {
        showToast('success', '✅ Affiliate system settings updated successfully!')
        loadData()
      } else {
        showToast('error', res?.error || 'Failed to save settings')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingOffer(true)
    try {
      const orig = Number(offerModal.original_price) || 0
      const cur = Number(offerModal.price) || 0
      const computedDiscount = (orig > cur && orig > 0) ? Math.round(((orig - cur) / orig) * 100) : 0
      const payload = {
        ...offerModal,
        price: cur,
        original_price: orig,
        discount_percent: computedDiscount,
        discounted_price: cur,
        trial_enabled: offerModal.trial_enabled ? 1 : 0,
        revshare_percent: offerModal.commission_rate,
        fixed_payout_usd: offerModal.fixed_payout_usd
      }
      const res = await callAffiliateApi('admin-save-offer', 'POST', payload)
      if (res?.success) {
        showToast('success', `✅ CPA Offer "${offerModal.title}" saved successfully across Web & Desktop!`)
        setOfferModal(prev => ({ ...prev, open: false }))
        loadData()
      } else {
        showToast('error', res?.error || 'Failed to save offer')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSavingOffer(false)
    }
  }

  const handleUpdateAffiliateStatus = async (affiliateId: string, status: 'active' | 'suspended' | 'disabled') => {
    try {
      const res = await callAffiliateApi('admin-update-affiliate-status', 'POST', { affiliateId, status })
      if (res?.success) {
        showToast('success', `Affiliate ${affiliateId} status updated to ${status.toUpperCase()}`)
        loadData()
      } else {
        showToast('error', res?.error || 'Failed to update status')
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleExecuteWithdrawalAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actionModal.withdrawal) return
    setProcessingAction(true)
    try {
      const res = await callAffiliateApi('admin-update-withdrawal', 'POST', {
        withdrawalId: actionModal.withdrawal.id,
        status: actionModal.status,
        adminNotes: actionModal.adminNotes,
        txRef: actionModal.txRef
      })
      if (res?.success) {
        showToast('success', `Withdrawal ${actionModal.withdrawal.id} marked as ${actionModal.status.toUpperCase()}`)
        setActionModal({ ...actionModal, open: false })
        loadData()
      } else {
        showToast('error', res?.error || 'Failed to update withdrawal')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRetryPostback = async (postbackId: string) => {
    try {
      const res = await callAffiliateApi('admin-retry-postback', 'POST', { postbackId })
      if (res?.success) {
        showToast('success', `Postback retried: Status is now ${res.data?.status?.toUpperCase() || 'COMPLETED'}`)
        loadData()
      } else {
        showToast('error', res?.error || 'Failed to retry postback')
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleOpenEditPostback = (cfg: any) => {
    setPostbackModal({
      open: true,
      userId: cfg.user_id,
      userName: cfg.user_name,
      userEmail: cfg.user_email,
      affiliateId: cfg.affiliate_id,
      postbackUrl: cfg.postback_url || '',
      httpMethod: cfg.http_method || 'GET',
      isActive: cfg.is_active !== 0
    })
    setTestPostbackResult(null)
  }

  const handleSavePostbackConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postbackModal.userId) return
    setSavingPostback(true)
    try {
      const res = await callAffiliateApi('admin-save-postback-config', 'POST', {
        userId: postbackModal.userId,
        postbackUrl: postbackModal.postbackUrl,
        method: postbackModal.httpMethod,
        isActive: postbackModal.isActive
      })
      if (res?.success) {
        showToast('success', 'User S2S Postback Configuration updated successfully!')
        setPostbackModal(prev => ({ ...prev, open: false }))
        loadData()
      } else {
        showToast('error', res?.error || 'Failed to update postback config')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSavingPostback(false)
    }
  }

  const handleTestPostback = async () => {
    if (!postbackModal.postbackUrl.trim()) {
      showToast('error', 'Please enter a postback URL first')
      return
    }
    setTestingPostback(true)
    setTestPostbackResult(null)
    try {
      const res = await callAffiliateApi('admin-test-postback', 'POST', {
        postbackUrl: postbackModal.postbackUrl,
        method: postbackModal.httpMethod
      })
      if (res?.success && res.data) {
        setTestPostbackResult(res.data)
        if (res.data.statusCode >= 200 && res.data.statusCode < 300) {
          showToast('success', `✓ Server returned HTTP ${res.data.statusCode} in ${res.data.responseTimeMs}ms!`)
        } else {
          showToast('error', `Server returned HTTP ${res.data.statusCode || 'ERR'}: ${res.data.error || 'Check endpoint'}`)
        }
      } else {
        showToast('error', res?.error || 'Test failed')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setTestingPostback(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'confirmed':
      case 'approved':
      case 'active':
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80', border: 'rgba(34, 197, 94, 0.3)' }
      case 'processing':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.3)' }
      case 'pending':
      case 'retrying':
      case 'paused':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#FACC15', border: 'rgba(234, 179, 8, 0.3)' }
      case 'failed':
      case 'rejected':
      case 'suspended':
      case 'disabled':
      case 'reversed':
      case 'archived':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.3)' }
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.3)' }
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '8px',
          background: toastMsg.type === 'success' ? '#065F46' : '#991B1B',
          color: '#FFF', fontWeight: 600, fontSize: '13px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
        border: '1px solid #334155', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '20px' }}>👑</span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#FFF' }}>
              Affiliate Control, CPA Network & Payout Center
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
            Manage CPA offers, affiliate approval & status, click streams, conversion payouts, postback webhooks, and multi-status withdrawal settlements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#10B981',
            background: 'rgba(16, 185, 129, 0.12)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
            LIVE REAL-TIME SYNC
          </span>

          <button
            onClick={() => setShowReportModal(true)}
            style={{ padding: '9px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #4F46E5, #3B82F6)', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
          >
            📊 Export Reports
          </button>

          <button
            onClick={() => setOfferModal({
              open: true, isEdit: false, title: '', description: '',
              target_url: 'https://antiprofiles.com', payout_type: 'percentage',
              commission_rate: 15, fixed_payout_usd: 10, status: 'active'
            })}
            style={{ padding: '9px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
          >
            + Create CPA Offer
          </button>
          <button
            onClick={() => loadData(true)}
            style={{ padding: '9px 16px', borderRadius: '8px', background: '#1E293B', color: '#E2E8F0', border: '1px solid #334155', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>👥 TOTAL AFFILIATES</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFF', marginTop: '4px' }}>{data?.stats?.totalAffiliates || 0}</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>🖱️ TOTAL CLICKS</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>{data?.stats?.totalClicks || 0}</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>🎯 CONVERSIONS</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#4ADE80', marginTop: '4px' }}>{data?.stats?.totalConversions || 0}</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>💵 REFERRED SALES</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#FACC15', marginTop: '4px' }}>${Number(data?.stats?.totalReferredRevenue || 0).toFixed(2)}</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>⏳ PENDING WITHDRAWALS</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#FB923C', marginTop: '4px' }}>
            {data?.stats?.totalPendingWithdrawalRequests || 0} <span style={{ fontSize: '12px', color: '#94A3B8' }}>(${Number(data?.stats?.pendingWithdrawalSum || 0).toFixed(2)})</span>
          </div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>🏦 COMMISSIONS PAID</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#34D399', marginTop: '4px' }}>${Number(data?.stats?.totalCommissionsPaid || 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1E293B', paddingBottom: '12px', marginBottom: '20px', overflowX: 'auto' }}>
        {[
          { id: 'withdrawals', label: `💳 Withdrawals (${data?.withdrawals?.length || 0})` },
          { id: 'affiliates', label: `👥 Affiliates Directory (${data?.affiliates?.length || 0})` },
          { id: 'offers', label: `🎯 CPA Offers (${data?.offers?.length || 0})` },
          { id: 'landing_pages', label: '🌐 Landing Page Builder' },
          { id: 'clicks', label: `🖱️ Clicks Stream (${data?.clicks?.length || 0})` },
          { id: 'fraud', label: '🛡️ Anti-Fraud Review' },
          { id: 'conversions', label: `🎉 Conversions (${data?.conversions?.length || 0})` },
          { id: 'postbacks', label: `📡 Postback Logs (${data?.postbacks?.length || 0})` },
          { id: 'settings', label: '⚙️ Global CPA Settings' },
          { id: 'audit', label: `📜 Audit Logs (${data?.auditLogs?.length || 0})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: activeSubTab === t.id ? '#2563EB' : '#131826',
              color: activeSubTab === t.id ? '#FFF' : '#94A3B8',
              fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: WITHDRAWALS (Multi-Status Manager) ── */}
      {activeSubTab === 'withdrawals' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>Affiliate Withdrawal Requests & Settlement</h3>
          {(!data?.withdrawals || data.withdrawals.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No withdrawal requests recorded.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>REQUESTED</th>
                    <th style={{ padding: '10px 12px' }}>AFFILIATE</th>
                    <th style={{ padding: '10px 12px' }}>AMOUNT</th>
                    <th style={{ padding: '10px 12px' }}>METHOD</th>
                    <th style={{ padding: '10px 12px' }}>RECIPIENT DETAILS</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                    <th style={{ padding: '10px 12px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.withdrawals.map(w => {
                    const badge = getStatusBadge(w.status)
                    const detailsStr = w.parsed_payout_details
                      ? Object.entries(w.parsed_payout_details).map(([k, v]) => `${k}: ${v}`).join(' | ')
                      : w.payout_details
                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(w.requested_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>
                          {w.user_name || w.user_email || w.user_id}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#34D399' }}>${Number(w.amount).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8' }}>{w.payout_method.toUpperCase()}</td>
                        <td style={{ padding: '10px 12px', color: '#CBD5E1', fontFamily: 'monospace', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {detailsStr}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                            {w.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {w.status !== 'paid' && (
                              <button
                                onClick={() => setActionModal({ open: true, withdrawal: w, status: 'paid', adminNotes: '', txRef: '' })}
                                style={{ padding: '4px 8px', borderRadius: '4px', background: '#059669', color: '#FFF', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                              >
                                Mark Paid
                              </button>
                            )}
                            {w.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => setActionModal({ open: true, withdrawal: w, status: 'approved', adminNotes: '', txRef: '' })}
                                  style={{ padding: '4px 8px', borderRadius: '4px', background: '#2563EB', color: '#FFF', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => setActionModal({ open: true, withdrawal: w, status: 'processing', adminNotes: '', txRef: '' })}
                                  style={{ padding: '4px 8px', borderRadius: '4px', background: '#7C3AED', color: '#FFF', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                >
                                  Processing
                                </button>
                                <button
                                  onClick={() => setActionModal({ open: true, withdrawal: w, status: 'rejected', adminNotes: 'Declined by administrator', txRef: '' })}
                                  style={{ padding: '4px 8px', borderRadius: '4px', background: '#DC2626', color: '#FFF', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: AFFILIATES DIRECTORY ── */}
      {activeSubTab === 'affiliates' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>Affiliate Accounts & Performance</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>AFFILIATE ID</th>
                  <th style={{ padding: '10px 12px' }}>NAME / EMAIL</th>
                  <th style={{ padding: '10px 12px' }}>CLICKS</th>
                  <th style={{ padding: '10px 12px' }}>CONVERSIONS</th>
                  <th style={{ padding: '10px 12px' }}>TOTAL EARNED</th>
                  <th style={{ padding: '10px 12px' }}>WITHDRAWN</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                  <th style={{ padding: '10px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data?.affiliates?.map(aff => {
                  const badge = getStatusBadge(aff.affiliate_status || 'active')
                  return (
                    <tr key={aff.id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 12px', color: '#38BDF8', fontWeight: 700, fontFamily: 'monospace' }}>
                        {aff.affiliate_id || 'AFF-USER'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ color: '#FFF', fontWeight: 600 }}>{aff.name}</div>
                        <div style={{ color: '#64748B', fontSize: '11px' }}>{aff.email}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{aff.clicks_count}</td>
                      <td style={{ padding: '10px 12px', color: '#4ADE80', fontWeight: 700 }}>{aff.conversions_count}</td>
                      <td style={{ padding: '10px 12px', color: '#FACC15', fontWeight: 700 }}>${Number(aff.total_earned).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#38BDF8' }}>${Number(aff.total_withdrawn).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.text }}>
                          {(aff.affiliate_status || 'active').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {aff.affiliate_status !== 'active' && (
                            <button
                              onClick={() => handleUpdateAffiliateStatus(aff.affiliate_id || aff.id, 'active')}
                              style={{ padding: '4px 8px', borderRadius: '4px', background: '#059669', color: '#FFF', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                            >
                              Activate
                            </button>
                          )}
                          {aff.affiliate_status !== 'suspended' && (
                            <button
                              onClick={() => handleUpdateAffiliateStatus(aff.affiliate_id || aff.id, 'suspended')}
                              style={{ padding: '4px 8px', borderRadius: '4px', background: '#D97706', color: '#FFF', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                            >
                              Suspend
                            </button>
                          )}
                          {aff.affiliate_status !== 'disabled' && (
                            <button
                              onClick={() => handleUpdateAffiliateStatus(aff.affiliate_id || aff.id, 'disabled')}
                              style={{ padding: '4px 8px', borderRadius: '4px', background: '#DC2626', color: '#FFF', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                            >
                              Disable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: CPA OFFERS ── */}
      {activeSubTab === 'offers' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#FFF' }}>CPA Offers & Dynamic Package Pricing Plans</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                Configure pricing, discounts, custom badges, dedicated CTAs, and trial toggles for Free, Starter, Professional, and Business packages.
              </p>
            </div>
            <button
              onClick={() => setOfferModal({
                open: true, isEdit: false, title: 'AntiProfiles Starter Subscription', description: 'Standard 40% recurring conversion offer for AntiProfiles Starter package ($19/mo).',
                target_url: '/offer/starter', package_id: 'plan_starter', package_name: 'Starter',
                price: 19, original_price: 19, discount_percent: 0, discount_start_date: '', discount_end_date: '',
                cta_text: 'Subscribe Starter', badge_text: 'Starter', trial_enabled: false, billing_interval: 'month',
                payout_type: 'percentage', commission_rate: 40, fixed_payout_usd: 0, status: 'active'
              })}
              style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
            >
              + New CPA Offer / Plan
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>PACKAGE & OFFER</th>
                  <th style={{ padding: '10px 12px' }}>PRICE / DISCOUNT</th>
                  <th style={{ padding: '10px 12px' }}>CTA BUTTON</th>
                  <th style={{ padding: '10px 12px' }}>TRIAL</th>
                  <th style={{ padding: '10px 12px' }}>COMMISSION MODEL</th>
                  <th style={{ padding: '10px 12px' }}>CLICKS / CONV</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                  <th style={{ padding: '10px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data?.offers?.map(offer => {
                  const orig = Number(offer.original_price || offer.price || 0)
                  const cur = Number(offer.price || 0)
                  const disc = (orig > cur && orig > 0) ? Math.round(((orig - cur) / orig) * 100) : 0
                  return (
                    <tr key={offer.id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ color: '#FFF', fontWeight: 700 }}>{offer.title}</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ color: '#2DD4BF', fontSize: '11px', fontWeight: 600 }}>{offer.package_name || 'Professional'}</span>
                          <span style={{ color: '#64748B', fontSize: '10px', fontFamily: 'monospace' }}>• {offer.id}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px' }}>
                          {disc > 0 && <span style={{ textDecoration: 'line-through', color: '#64748B', fontSize: '11px', marginRight: '4px' }}>${orig.toFixed(2)}</span>}
                          ${cur.toFixed(2)}<span style={{ fontSize: '10px', color: '#94A3B8' }}>/mo</span>
                        </div>
                        {disc > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#4ADE80', background: 'rgba(74, 222, 128, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                            Save {disc}%
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#E2E8F0', fontWeight: 600 }}>
                        {offer.cta_text || 'Subscribe'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                          background: offer.trial_enabled ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                          color: offer.trial_enabled ? '#38BDF8' : '#94A3B8'
                        }}>
                          {offer.trial_enabled ? '7-DAY TRIAL ON' : 'NO TRIAL (DIRECT)'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#34D399', fontWeight: 700 }}>
                        {offer.payout_type === 'percentage' ? `${offer.commission_rate}% RevShare` : `$${offer.fixed_payout_usd} Fixed CPA`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {offer.total_clicks || 0} / <strong style={{ color: '#4ADE80' }}>{offer.total_conversions || 0}</strong>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80' }}>
                          {offer.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => setOfferModal({
                              open: true, isEdit: true, id: offer.id,
                              title: offer.title, description: offer.description || '',
                              target_url: offer.target_url || `/offer/${offer.landing_page_slug || 'starter'}`,
                              package_id: offer.package_id || 'plan_starter',
                              package_name: offer.package_name || 'Starter',
                              price: Number(offer.price || 19),
                              original_price: Number(offer.original_price || offer.price || 19),
                              discount_percent: disc,
                              discount_start_date: offer.discount_start_date || '',
                              discount_end_date: offer.discount_end_date || '',
                              cta_text: offer.cta_text || 'Subscribe Starter',
                              badge_text: offer.badge_text || 'Starter',
                              trial_enabled: Boolean(offer.trial_enabled),
                              billing_interval: offer.billing_interval || 'month',
                              payout_type: offer.payout_type,
                              commission_rate: offer.commission_rate,
                              fixed_payout_usd: offer.fixed_payout_usd,
                              status: offer.status
                            })}
                            style={{ padding: '5px 10px', borderRadius: '6px', background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to permanently delete offer "${offer.title}" (${offer.id})?\n\nThis will remove this offer/package plan from the system.`)) {
                                const res = await callAffiliateApi('admin-delete-offer', 'POST', { id: offer.id, permanent: true })
                                if (res?.success) {
                                  showToast('success', `🗑️ Offer "${offer.title}" deleted successfully!`)
                                  loadData()
                                } else {
                                  showToast('error', res?.error || 'Failed to delete offer')
                                }
                              }
                            }}
                            style={{ padding: '5px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: CLICKS STREAM ── */}
      {activeSubTab === 'clicks' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Live Click Stream (Audit & Anti-Fraud)
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#38BDF820', color: '#38BDF8', fontWeight: 700 }}>
                  {data?.clicks?.length || 0} Recorded
                </span>
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                Real-time tracking feed of incoming referral clicks, subIDs, IP addresses, and conversion status.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={clickSearch}
                onChange={e => setClickSearch(e.target.value)}
                placeholder="🔍 Search click, affiliate or IP..."
                style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px', width: '200px' }}
              />
              <button
                onClick={handleSimulateTestClick}
                style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38BDF8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                🧪 Simulate Test Click
              </button>
              <button
                onClick={() => exportReport('clicks')}
                style={{ padding: '6px 12px', borderRadius: '6px', background: '#1E293B', border: '1px solid #334155', color: '#E2E8F0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {(!data?.clicks || data.clicks.length === 0) ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#0B0F19', borderRadius: '8px', border: '1px dashed #334155' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖱️</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>No Clicks Recorded in the Live Stream Yet</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '480px', margin: '0 auto 16px auto' }}>
                Clicks generated when visitors click any affiliate referral link (e.g. <code>/register?ref=REF_...</code> or tracking URLs) will populate here in real-time.
              </p>
              <button
                onClick={handleSimulateTestClick}
                style={{ padding: '8px 18px', borderRadius: '8px', background: '#38BDF8', color: '#0F172A', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
              >
                🧪 Generate First Live Test Click
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>TIME</th>
                    <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                    <th style={{ padding: '10px 12px' }}>AFFILIATE ID</th>
                    <th style={{ padding: '10px 12px' }}>OFFER ID</th>
                    <th style={{ padding: '10px 12px' }}>IP ADDRESS</th>
                    <th style={{ padding: '10px 12px' }}>SUBID1</th>
                    <th style={{ padding: '10px 12px' }}>CONVERTED</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clicks
                    .filter(c => !clickSearch || (
                      c.click_id.toLowerCase().includes(clickSearch.toLowerCase()) ||
                      c.affiliate_id.toLowerCase().includes(clickSearch.toLowerCase()) ||
                      (c.ip_address && c.ip_address.includes(clickSearch)) ||
                      (c.sub_id1 && c.sub_id1.toLowerCase().includes(clickSearch.toLowerCase()))
                    ))
                    .map(c => (
                      <tr key={c.click_id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(c.created_at).toLocaleTimeString()}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{c.click_id}</td>
                        <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>{c.affiliate_id}</td>
                        <td style={{ padding: '10px 12px' }}>{c.offer_id}</td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{c.ip_address || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#A78BFA' }}>{c.sub_id1 || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.converted ? (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(34,197,94,0.2)', color: '#4ADE80' }}>
                              ✓ CONVERTED
                            </span>
                          ) : (
                            <span style={{ color: '#64748B' }}>Click</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: CONVERSIONS ── */}
      {activeSubTab === 'conversions' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                CPA Conversions & Attributions
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#4ADE8020', color: '#4ADE80', fontWeight: 700 }}>
                  {data?.conversions?.length || 0} Orders
                </span>
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                Attributed purchases, generated order revenue, affiliate commissions and postback trigger records.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                placeholder="🔍 Search conversion or affiliate..."
                style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px', width: '200px' }}
              />
              <button
                onClick={handleSimulateTestConversion}
                style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(74, 222, 128, 0.15)', border: '1px solid rgba(74, 222, 128, 0.4)', color: '#4ADE80', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                🧪 Simulate Test Conversion
              </button>
              <button
                onClick={() => exportReport('conversions')}
                style={{ padding: '6px 12px', borderRadius: '6px', background: '#1E293B', border: '1px solid #334155', color: '#E2E8F0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {(!data?.conversions || data.conversions.length === 0) ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#0B0F19', borderRadius: '8px', border: '1px dashed #334155' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>No Conversions Recorded Yet</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '480px', margin: '0 auto 16px auto' }}>
                When referred users purchase a plan or sign up, commissions are attributed and shown here in real-time.
              </p>
              <button
                onClick={handleSimulateTestConversion}
                style={{ padding: '8px 18px', borderRadius: '8px', background: '#10B981', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
              >
                🧪 Generate First Live Test Conversion
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>TIME</th>
                    <th style={{ padding: '10px 12px' }}>CONVERSION ID</th>
                    <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                    <th style={{ padding: '10px 12px' }}>AFFILIATE ID</th>
                    <th style={{ padding: '10px 12px' }}>PACKAGE</th>
                    <th style={{ padding: '10px 12px' }}>OFFER</th>
                    <th style={{ padding: '10px 12px' }}>ORDER VALUE</th>
                    <th style={{ padding: '10px 12px' }}>COMMISSION PAYOUT</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversions
                    .filter(conv => !convSearch || (
                      conv.conversion_id.toLowerCase().includes(convSearch.toLowerCase()) ||
                      conv.click_id.toLowerCase().includes(convSearch.toLowerCase()) ||
                      conv.affiliate_id.toLowerCase().includes(convSearch.toLowerCase()) ||
                      (conv.package_name && conv.package_name.toLowerCase().includes(convSearch.toLowerCase()))
                    ))
                    .map(conv => (
                      <tr key={conv.conversion_id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(conv.created_at).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: '#FACC15', fontFamily: 'monospace' }}>{conv.conversion_id}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{conv.click_id}</td>
                        <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>{conv.affiliate_id}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 700, color: '#2DD4BF', background: 'rgba(45, 212, 191, 0.12)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(45, 212, 191, 0.3)' }}>
                            {conv.package_name || (conv.package_id === 'plan_starter' ? 'Starter' : conv.package_id === 'plan_business' ? 'Business' : conv.package_id === 'plan_free' ? 'Free' : 'Professional')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#CBD5E1' }}>{conv.offer_id}</td>
                        <td style={{ padding: '10px 12px' }}>${Number(conv.order_amount || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: '#34D399', fontWeight: 700 }}>+${Number(conv.payout_amount || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}>
                            APPROVED
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 6: POSTBACK CONFIGS & DELIVERY LOGS ── */}
      {activeSubTab === 'postbacks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 1: User S2S Postback Webhook Configurations */}
          <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#FFF' }}>⚡ User S2S Postback Webhook Configurations</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                  Live postback webhook endpoints configured by affiliates for automated conversion tracking.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>AFFILIATE / USER</th>
                    <th style={{ padding: '10px 12px' }}>METHOD</th>
                    <th style={{ padding: '10px 12px' }}>POSTBACK URL & MACROS</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                    <th style={{ padding: '10px 12px' }}>UPDATED</th>
                    <th style={{ padding: '10px 12px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data?.postbackConfigs || data.postbackConfigs.length === 0) ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No user S2S postback webhooks configured yet.
                      </td>
                    </tr>
                  ) : (
                    data.postbackConfigs.map(cfg => (
                      <tr key={cfg.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ color: '#FFF', fontWeight: 600 }}>{cfg.user_name || cfg.user_email || cfg.user_id}</div>
                          <div style={{ color: '#38BDF8', fontSize: '11px', fontFamily: 'monospace' }}>{cfg.affiliate_id}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 6px', borderRadius: '4px', background: '#1E293B', color: '#CBD5E1', fontSize: '10px', fontWeight: 700 }}>
                            {cfg.http_method || 'GET'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cfg.postback_url}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                            background: cfg.is_active !== 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: cfg.is_active !== 0 ? '#4ADE80' : '#F87171'
                          }}>
                            {cfg.is_active !== 0 ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: '11px' }}>
                          {new Date(cfg.updated_at || cfg.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={() => handleOpenEditPostback(cfg)}
                            style={{ padding: '4px 10px', borderRadius: '6px', background: '#2563EB', color: '#FFF', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Postback Delivery History Logs */}
          <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>📜 Server-to-Server Postback Delivery Logs</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>TIME</th>
                    <th style={{ padding: '10px 12px' }}>AFFILIATE ID</th>
                    <th style={{ padding: '10px 12px' }}>TARGET URL</th>
                    <th style={{ padding: '10px 12px' }}>HTTP CODE</th>
                    <th style={{ padding: '10px 12px' }}>ATTEMPTS</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                    <th style={{ padding: '10px 12px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data?.postbacks || data.postbacks.length === 0) ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No postback delivery history yet.
                      </td>
                    </tr>
                  ) : (
                    data.postbacks.map(pb => (
                      <tr key={pb.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(pb.created_at).toLocaleTimeString()}</td>
                        <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>{pb.affiliate_id}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pb.url}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: pb.http_status === 200 ? '#4ADE80' : '#F87171' }}>
                          {pb.http_status ? `${pb.http_status}` : 'ERR'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{pb.attempt_count}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: pb.status === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: pb.status === 'confirmed' ? '#4ADE80' : '#F87171' }}>
                            {pb.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={() => handleRetryPostback(pb.id)}
                            style={{ padding: '4px 8px', borderRadius: '4px', background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: SETTINGS ── */}
      {activeSubTab === 'settings' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '24px', maxWidth: '700px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#FFF' }}>Global Affiliate & CPA Settings</h3>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0B0F19', borderRadius: '8px', border: '1px solid #334155' }}>
              <input
                type="checkbox"
                id="affiliate_enabled"
                checked={settingsForm.enabled}
                onChange={e => setSettingsForm({ ...settingsForm, enabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="affiliate_enabled" style={{ fontSize: '13px', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}>
                Enable CPA Affiliate & Referral Program Globally
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px' }}>
                DEFAULT COMMISSION RATE (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                value={settingsForm.commission_rate_percent}
                onChange={e => setSettingsForm({ ...settingsForm, commission_rate_percent: parseFloat(e.target.value) })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px' }}>
                COMMISSION HOLDING PERIOD (DAYS)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={settingsForm.holding_period_days}
                onChange={e => setSettingsForm({ ...settingsForm, holding_period_days: parseInt(e.target.value, 10) })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px' }}>
                MINIMUM WITHDRAWAL THRESHOLD (USD)
              </label>
              <input
                type="number"
                min="1"
                value={settingsForm.min_withdrawal_usd}
                onChange={e => setSettingsForm({ ...settingsForm, min_withdrawal_usd: parseFloat(e.target.value) })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px' }}>
                SYSTEM DOMAIN URL
              </label>
              <input
                type="url"
                value={settingsForm.system_domain}
                onChange={e => setSettingsForm({ ...settingsForm, system_domain: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              style={{
                marginTop: '10px', padding: '10px 20px', borderRadius: '8px',
                background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer'
              }}
            >
              {savingSettings ? 'Saving...' : 'Save Global Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 8: AUDIT LOGS ── */}
      {activeSubTab === 'audit' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>Affiliate System Audit Trail</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>TIMESTAMP</th>
                  <th style={{ padding: '10px 12px' }}>ACTION</th>
                  <th style={{ padding: '10px 12px' }}>PERFORMED BY</th>
                  <th style={{ padding: '10px 12px' }}>TARGET ID</th>
                  <th style={{ padding: '10px 12px' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {data?.auditLogs?.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#38BDF8', fontWeight: 700 }}>{log.action}</td>
                    <td style={{ padding: '10px 12px', color: '#FFF' }}>{log.performed_by}</td>
                    <td style={{ padding: '10px 12px', color: '#FACC15', fontFamily: 'monospace' }}>{log.target_id}</td>
                    <td style={{ padding: '10px 12px', color: '#CBD5E1' }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: LANDING PAGE BUILDER ── */}
      {activeSubTab === 'landing_pages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#FFF' }}>🌐 Dynamic Package Landing Pages</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                  Every affiliate offer automatically generates a tailored landing page with OS detection and custom pricing.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {[
                { slug: 'starter-license', title: 'Starter License', price: '$19/mo', badge: '$10 CPA Fixed', theme: '#38BDF8', url: '/offer/starter-license' },
                { slug: 'starter', title: 'Starter Subscription', price: '$19/mo', badge: '40% Recurring', theme: '#2DD4BF', url: '/offer/starter' },
                { slug: 'professional', title: 'Professional', price: '$49/mo', badge: '50% Recurring • Most Popular', theme: '#2DD4BF', url: '/offer/professional' },
                { slug: 'pro-team', title: 'Pro + Team Plan', price: '$49/mo', badge: '50% Recurring • Team', theme: '#818CF8', url: '/offer/pro-team' },
                { slug: 'enterprise-trial', title: 'Enterprise Trial', price: '$99/mo', badge: '7-Day Enterprise Pilot', theme: '#C084FC', url: '/offer/enterprise-trial' },
                { slug: 'enterprise', title: 'Enterprise Suite', price: '$99/mo', badge: '50% Recurring', theme: '#A855F7', url: '/offer/enterprise' },
                { slug: 'business-custom', title: 'Custom Business', price: '$99/mo', badge: '50% RevShare', theme: '#EC4899', url: '/offer/business-custom' }
              ].map(lp => (
                <div key={lp.slug} style={{ background: '#0B0F19', border: `1px solid ${lp.theme}40`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFF' }}>{lp.title}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: lp.theme, background: `${lp.theme}15`, padding: '3px 8px', borderRadius: '12px', border: `1px solid ${lp.theme}30` }}>
                        {lp.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px' }}>
                      Path: <code style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{lp.url}</code>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#FFF', marginBottom: '12px' }}>
                      {lp.price}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={`https://antiprofiles.com${lp.url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ flex: 1, padding: '7px 12px', textAlign: 'center', borderRadius: '6px', background: '#1E293B', color: '#38BDF8', fontSize: '11px', fontWeight: 600, textDecoration: 'none', border: '1px solid #334155' }}
                    >
                      🔗 Preview Page
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://antiprofiles.com${lp.url}`)
                        showToast('success', `Copied URL: https://antiprofiles.com${lp.url}`)
                      }}
                      style={{ padding: '7px 12px', borderRadius: '6px', background: '#2563EB', color: '#FFF', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                    >
                      Copy URL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ANTI-FRAUD REVIEW ── */}
      {activeSubTab === 'fraud' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#FFF' }}>🛡️ Anti-Fraud Tracking & Traffic Security Logs</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Monitors suspicious click spikes, bot user-agents, rapid repeat clicks, and self-referrals.
              </p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>TIMESTAMP</th>
                  <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                  <th style={{ padding: '10px 12px' }}>AFFILIATE</th>
                  <th style={{ padding: '10px 12px' }}>IP ADDRESS</th>
                  <th style={{ padding: '10px 12px' }}>REASON</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(data?.clicks || []).filter((c: any) => c.is_fraud || c.fraud_reason).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                      ✓ Clean traffic health: 0 fraudulent click alerts detected in current monitoring window.
                    </td>
                  </tr>
                ) : (
                  (data?.clicks || []).filter((c: any) => c.is_fraud || c.fraud_reason).map((f: any) => (
                    <tr key={f.click_id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(f.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#F87171', fontFamily: 'monospace' }}>{f.click_id}</td>
                      <td style={{ padding: '10px 12px', color: '#FFF' }}>{f.affiliate_id}</td>
                      <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{f.ip_address}</td>
                      <td style={{ padding: '10px 12px', color: '#F87171', fontWeight: 600 }}>{f.fraud_reason || 'duplicate_rapid_click'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#EF444420', color: '#F87171', fontSize: '11px', fontWeight: 600 }}>
                          BLOCKED / FLAGGED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── OFFER MODAL ── */}
      {offerModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px'
        }}>
          <div style={{
            background: '#131826', border: '1px solid #334155', borderRadius: '16px',
            padding: '24px', width: '100%', maxWidth: '640px', color: '#FFF', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {offerModal.isEdit ? '✏️ Edit Dynamic Pricing Offer' : '⚡ Create New CPA / Pricing Offer'}
              </h3>
              <button onClick={() => setOfferModal(prev => ({ ...prev, open: false }))} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveOffer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Package Template Preset Selector */}
              <div style={{ background: '#0B0F19', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#2DD4BF', marginBottom: '6px', fontWeight: 700 }}>
                  ⚡ LOAD OFFICIAL PACKAGE PRESET
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'plan_free', name: 'Free', price: 0, orig: 0, cta: 'Start Free', badge: 'FREE', target: '/offer/free', comm: 0, fixed: 0, type: 'percentage' },
                    { id: 'plan_starter', name: 'Starter', price: 19, orig: 19, cta: 'Subscribe Starter', badge: 'Starter', target: '/offer/starter', comm: 40, fixed: 10, type: 'percentage' },
                    { id: 'plan_pro', name: 'Professional', price: 49, orig: 49, cta: 'Subscribe Professional', badge: 'MOST POPULAR', target: '/offer/professional', comm: 50, fixed: 0, type: 'percentage' },
                    { id: 'plan_business', name: 'Business', price: 99, orig: 149, cta: 'Subscribe Business', badge: 'BEST VALUE', target: '/offer/business', comm: 50, fixed: 0, type: 'percentage' }
                  ].map(pkg => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => {
                        setOfferModal(prev => ({
                          ...prev,
                          package_id: pkg.id,
                          package_name: pkg.name,
                          title: `AntiProfiles ${pkg.name} Subscription`,
                          description: `${pkg.name} plan pricing and conversion terms.`,
                          target_url: pkg.target,
                          price: pkg.price,
                          original_price: pkg.orig,
                          cta_text: pkg.cta,
                          badge_text: pkg.badge,
                          payout_type: pkg.type as any,
                          commission_rate: pkg.comm,
                          fixed_payout_usd: pkg.fixed,
                          trial_enabled: false
                        }))
                      }}
                      style={{
                        padding: '6px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                        background: offerModal.package_id === pkg.id ? '#2563EB' : '#1E293B',
                        color: offerModal.package_id === pkg.id ? '#FFF' : '#CBD5E1',
                        border: '1px solid ' + (offerModal.package_id === pkg.id ? '#3B82F6' : '#334155'),
                        cursor: 'pointer'
                      }}
                    >
                      {pkg.name} (${pkg.price}/mo)
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>OFFER TITLE</label>
                  <input
                    required
                    placeholder="e.g. AntiProfiles Business Subscription"
                    value={offerModal.title}
                    onChange={e => setOfferModal({ ...offerModal, title: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>PACKAGE IDENTIFIER</label>
                  <select
                    value={offerModal.package_id}
                    onChange={e => {
                      const pid = e.target.value
                      const pName = pid === 'plan_free' ? 'Free' : pid === 'plan_starter' ? 'Starter' : pid === 'plan_business' ? 'Business' : 'Professional'
                      setOfferModal({ ...offerModal, package_id: pid, package_name: pName })
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  >
                    <option value="plan_free">Free Plan (3 Profiles, $0/mo)</option>
                    <option value="plan_starter">Starter Plan (25 Profiles, $19/mo)</option>
                    <option value="plan_pro">Professional Plan (100 Profiles, $49/mo)</option>
                    <option value="plan_business">Business Plan (500 Profiles, $99/mo)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Pricing: Old Price, New Price & Live Auto-Calculated Discount % */}
              <div style={{ background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                      ORIGINAL PRICE ($) <span style={{ color: '#64748B' }}>(Old Price)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={offerModal.original_price}
                      onChange={e => setOfferModal({ ...offerModal, original_price: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#2DD4BF', marginBottom: '4px', fontWeight: 600 }}>
                      DISCOUNT PRICE ($) <span style={{ color: '#64748B' }}>(Selling)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={offerModal.price}
                      onChange={e => setOfferModal({ ...offerModal, price: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#2DD4BF', fontWeight: 700, fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                      DYNAMIC DISCOUNT %
                    </label>
                    <div style={{
                      padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155',
                      fontSize: '12px', fontWeight: 800,
                      color: (offerModal.original_price > offerModal.price && offerModal.original_price > 0) ? '#4ADE80' : '#94A3B8'
                    }}>
                      {(offerModal.original_price > offerModal.price && offerModal.original_price > 0)
                        ? `Save ${Math.round(((offerModal.original_price - offerModal.price) / offerModal.original_price) * 100)}%`
                        : '0% (Regular Price)'
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>CTA BUTTON TEXT</label>
                  <input
                    required
                    placeholder="e.g. Subscribe Starter"
                    value={offerModal.cta_text}
                    onChange={e => setOfferModal({ ...offerModal, cta_text: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>PACKAGE BADGE</label>
                  <input
                    placeholder="e.g. MOST POPULAR / BEST VALUE / FREE"
                    value={offerModal.badge_text}
                    onChange={e => setOfferModal({ ...offerModal, badge_text: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>TARGET / LANDING PAGE SLUG URL</label>
                <input
                  type="text"
                  required
                  placeholder="/offer/starter"
                  value={offerModal.target_url}
                  onChange={e => setOfferModal({ ...offerModal, target_url: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#38BDF8', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>

              {/* Commission Model & Trial Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>COMMISSION MODEL</label>
                  <select
                    value={offerModal.payout_type}
                    onChange={e => setOfferModal({ ...offerModal, payout_type: e.target.value as any })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  >
                    <option value="percentage">RevShare (% Recurring Commission)</option>
                    <option value="fixed">Fixed CPA ($ Instant Bounty)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>
                    {offerModal.payout_type === 'percentage' ? 'COMMISSION RATE (%)' : 'FIXED BOUNTY ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={offerModal.payout_type === 'percentage' ? offerModal.commission_rate : offerModal.fixed_payout_usd}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0
                      if (offerModal.payout_type === 'percentage') {
                        setOfferModal({ ...offerModal, commission_rate: val })
                      } else {
                        setOfferModal({ ...offerModal, fixed_payout_usd: val })
                      }
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* Trial Toggle & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center', background: '#0B0F19', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="trial_enabled_chk"
                    checked={offerModal.trial_enabled}
                    onChange={e => setOfferModal({ ...offerModal, trial_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="trial_enabled_chk" style={{ fontSize: '12px', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}>
                    Enable 7-Day Free Trial
                    <span style={{ display: 'block', fontSize: '10px', color: '#94A3B8' }}>
                      {offerModal.trial_enabled ? 'Shows "Start 7-Day Free Trial" button' : 'Shows dedicated Subscribe CTA (Default)'}
                    </span>
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>OFFER STATUS</label>
                  <select
                    value={offerModal.status}
                    onChange={e => setOfferModal({ ...offerModal, status: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#1E293B', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  >
                    <option value="active">Active (Visible in Links & Landing Pages)</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                {offerModal.isEdit && offerModal.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to permanently delete "${offerModal.title}" (${offerModal.id})?\n\nThis cannot be undone.`)) {
                        setSavingOffer(true)
                        const res = await callAffiliateApi('admin-delete-offer', 'POST', { id: offerModal.id, permanent: true })
                        setSavingOffer(false)
                        if (res?.success) {
                          showToast('success', `🗑️ Offer deleted successfully!`)
                          setOfferModal(prev => ({ ...prev, open: false }))
                          loadData()
                        } else {
                          showToast('error', res?.error || 'Failed to delete offer')
                        }
                      }
                    }}
                    style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                  >
                    🗑️ Delete Offer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOfferModal(prev => ({ ...prev, open: false }))}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1E293B', color: '#CBD5E1', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOffer}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#2563EB', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {savingOffer ? 'Saving Package Offer...' : 'Save Offer & Pricing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WITHDRAWAL ACTION MODAL ── */}
      {actionModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div style={{
            background: '#131826', border: '1px solid #334155', borderRadius: '16px',
            padding: '24px', width: '100%', maxWidth: '480px', color: '#FFF'
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>
              Update Withdrawal #{actionModal.withdrawal?.id}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>
              Amount: <strong style={{ color: '#34D399' }}>${Number(actionModal.withdrawal?.amount).toFixed(2)}</strong> via {actionModal.withdrawal?.payout_method.toUpperCase()}
            </p>

            <form onSubmit={handleExecuteWithdrawalAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>SET STATUS</label>
                <select
                  value={actionModal.status}
                  onChange={e => setActionModal({ ...actionModal, status: e.target.value as any })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="approved">Approved (Queue for Payment)</option>
                  <option value="processing">Processing (Transfer Initiated)</option>
                  <option value="paid">Paid (Mark Complete & Settle)</option>
                  <option value="rejected">Rejected (Refund to Affiliate)</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {actionModal.status === 'paid' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>PAYMENT REFERENCE / TX HASH</label>
                  <input
                    placeholder="Blockchain TX hash or Bank Reference ID"
                    required
                    value={actionModal.txRef}
                    onChange={e => setActionModal({ ...actionModal, txRef: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>ADMIN NOTES (OPTIONAL)</label>
                <textarea
                  rows={2}
                  placeholder="Notes visible to affiliate and in audit log"
                  value={actionModal.adminNotes}
                  onChange={e => setActionModal({ ...actionModal, adminNotes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActionModal({ ...actionModal, open: false })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1E293B', color: '#CBD5E1', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAction}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#059669', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {processingAction ? 'Updating...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT S2S POSTBACK MODAL ── */}
      {postbackModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div style={{
            background: '#131826', border: '1px solid #334155', borderRadius: '16px',
            padding: '24px', width: '100%', maxWidth: '580px', color: '#FFF'
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>
              Edit S2S Postback Configuration
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>
              Affiliate: <strong style={{ color: '#38BDF8' }}>{postbackModal.userName || postbackModal.userEmail || postbackModal.userId}</strong> ({postbackModal.affiliateId})
            </p>

            <form onSubmit={handleSavePostbackConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>POSTBACK ENDPOINT URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://tracker.partner.com/postback?click_id={CLICK_ID}&payout={PAYOUT}"
                  value={postbackModal.postbackUrl}
                  onChange={e => setPostbackModal({ ...postbackModal, postbackUrl: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#38BDF8', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '6px' }}>Insert Dynamic Macro Tags:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['{CLICK_ID}', '{PAYOUT}', '{COMMISSION}', '{STATUS}', '{OFFER_ID}', '{CONVERSION_ID}', '{AMOUNT}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setPostbackModal(prev => ({ ...prev, postbackUrl: prev.postbackUrl + (prev.postbackUrl.includes('?') ? '&' : '?') + tag.replace(/[{}]/g, '').toLowerCase() + '=' + tag }))}
                      style={{ padding: '3px 8px', borderRadius: '4px', background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace' }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px', fontWeight: 600 }}>HTTP METHOD</label>
                  <select
                    value={postbackModal.httpMethod}
                    onChange={e => setPostbackModal({ ...postbackModal, httpMethod: e.target.value as any })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  >
                    <option value="GET">GET (Standard Query Params)</option>
                    <option value="POST">POST (Webhook Payload)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                  <input
                    type="checkbox"
                    id="pb_is_active"
                    checked={postbackModal.isActive}
                    onChange={e => setPostbackModal({ ...postbackModal, isActive: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="pb_is_active" style={{ fontSize: '12px', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}>
                    Active & Receiving Webhooks
                  </label>
                </div>
              </div>

              {/* Test Postback Ping */}
              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#FFF' }}>Verify Endpoint Connection</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Sends a simulated conversion ping to test responsiveness.</div>
                </div>
                <button
                  type="button"
                  onClick={handleTestPostback}
                  disabled={testingPostback || !postbackModal.postbackUrl}
                  style={{ padding: '6px 14px', borderRadius: '6px', background: '#334155', color: '#38BDF8', border: '1px solid #475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {testingPostback ? 'Testing...' : '🚀 Test Ping'}
                </button>
              </div>

              {testPostbackResult && (
                <div style={{
                  padding: '8px 12px', borderRadius: '6px', fontSize: '11px',
                  background: testPostbackResult.statusCode >= 200 && testPostbackResult.statusCode < 300 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: testPostbackResult.statusCode >= 200 && testPostbackResult.statusCode < 300 ? '#4ADE80' : '#F87171',
                  border: `1px solid ${testPostbackResult.statusCode >= 200 && testPostbackResult.statusCode < 300 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {testPostbackResult.statusCode >= 200 && testPostbackResult.statusCode < 300
                    ? `✓ Status ${testPostbackResult.statusCode} OK — Received in ${testPostbackResult.responseTimeMs}ms`
                    : `⚠️ HTTP ${testPostbackResult.statusCode || 'ERR'}: ${testPostbackResult.error || 'Connection failed'}`
                  }
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPostbackModal(prev => ({ ...prev, open: false }))}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1E293B', color: '#CBD5E1', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPostback}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#2563EB', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {savingPostback ? 'Saving...' : '💾 Save Postback Config'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REPORTS & CSV EXPORT MODAL ── */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#131826', border: '1px solid #334155', borderRadius: '16px', padding: '28px', maxWidth: '640px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1E293B', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📊</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFF' }}>CPA Network Executive Reports & Export</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>Download clean formatted CSV reports of real-time network activity.</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>📈 Executive Network Summary</div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px 0' }}>All high-level revenue, clicks, conversions, and liability figures.</p>
                </div>
                <button
                  onClick={() => { exportReport('executive'); setShowReportModal(false) }}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#FFF', fontWeight: 600, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  📥 Export Summary CSV
                </button>
              </div>

              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>🖱️ Live Clicks Stream Logs</div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px 0' }}>Complete clickstream logs ({data?.clicks?.length || 0} events) with IPs & SubIDs.</p>
                </div>
                <button
                  onClick={() => { exportReport('clicks'); setShowReportModal(false) }}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38BDF8', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  📥 Export Clicks CSV
                </button>
              </div>

              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>🎯 Conversion Attributions</div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px 0' }}>Attributed purchase sales ({data?.conversions?.length || 0} orders) & commissions.</p>
                </div>
                <button
                  onClick={() => { exportReport('conversions'); setShowReportModal(false) }}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'rgba(74, 222, 128, 0.15)', border: '1px solid rgba(74, 222, 128, 0.4)', color: '#4ADE80', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  📥 Export Conversions CSV
                </button>
              </div>

              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>👥 Affiliates Directory & Earnings</div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px 0' }}>All {data?.affiliates?.length || 0} affiliates with earned & withdrawn balances.</p>
                </div>
                <button
                  onClick={() => { exportReport('affiliates'); setShowReportModal(false) }}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#FFF', fontWeight: 600, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  📥 Export Affiliates CSV
                </button>
              </div>

              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>💳 Payouts & Settlements</div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px 0' }}>Withdrawal requests, payout transactions, crypto hashes & methods.</p>
                </div>
                <button
                  onClick={() => { exportReport('withdrawals'); setShowReportModal(false) }}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#FFF', fontWeight: 600, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  📥 Export Payouts CSV
                </button>
              </div>

              <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>📜 Security & Audit Trail</div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px 0' }}>Administrative actions, postbacks and manual adjustments.</p>
                </div>
                <button
                  onClick={() => { exportReport('audit'); setShowReportModal(false) }}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: '#334155', color: '#FFF', fontWeight: 600, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  📥 Export Audit CSV
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setShowReportModal(false)}
                style={{ padding: '10px 20px', borderRadius: '8px', background: '#1E293B', color: '#CBD5E1', border: '1px solid #334155', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
