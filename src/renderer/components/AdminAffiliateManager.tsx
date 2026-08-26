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
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'affiliates' | 'offers' | 'clicks' | 'conversions' | 'postbacks' | 'settings' | 'audit'>('withdrawals')
  
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
    payout_type: 'percentage' | 'fixed'
    commission_rate: number
    fixed_payout_usd: number
    status: 'active' | 'paused' | 'archived'
  }>({
    open: false,
    isEdit: false,
    title: '',
    description: '',
    target_url: 'https://antiprofiles.com',
    payout_type: 'percentage',
    commission_rate: 15,
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

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateGetAdminOverview) {
        const res = await (window as any).api.affiliateGetAdminOverview(token)
        if (res?.success && res?.data) {
          setData(res.data)
          setSettingsForm({
            enabled: res.data.settings?.enabled !== false,
            commission_rate_percent: res.data.settings?.commission_rate_percent || 10,
            holding_period_days: res.data.settings?.holding_period_days || 7,
            min_withdrawal_usd: res.data.settings?.min_withdrawal_usd || 20,
            system_domain: res.data.settings?.system_domain || 'https://antiprofiles.com'
          })
        }
      }
    } catch (err: any) {
      showToast('error', 'Failed to load affiliate administration: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateAdminSaveSettings) {
        const res = await (window as any).api.affiliateAdminSaveSettings(token, settingsForm)
        if (res?.success) {
          showToast('success', '✅ Affiliate system settings updated successfully!')
          loadData()
        } else {
          showToast('error', res?.error || 'Failed to save settings')
        }
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
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateAdminSaveOffer) {
        const res = await (window as any).api.affiliateAdminSaveOffer(token, offerModal)
        if (res?.success) {
          showToast('success', `✅ CPA Offer "${offerModal.title}" saved successfully!`)
          setOfferModal({ ...offerModal, open: false })
          loadData()
        } else {
          showToast('error', res?.error || 'Failed to save offer')
        }
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSavingOffer(false)
    }
  }

  const handleUpdateAffiliateStatus = async (affiliateId: string, status: 'active' | 'suspended' | 'disabled') => {
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateAdminUpdateStatus) {
        const res = await (window as any).api.affiliateAdminUpdateStatus(token, affiliateId, status)
        if (res?.success) {
          showToast('success', `Affiliate ${affiliateId} status updated to ${status.toUpperCase()}`)
          loadData()
        } else {
          showToast('error', res?.error || 'Failed to update status')
        }
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
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateAdminUpdateWithdrawal) {
        const res = await (window as any).api.affiliateAdminUpdateWithdrawal(
          token,
          actionModal.withdrawal.id,
          actionModal.status,
          actionModal.adminNotes,
          actionModal.txRef
        )
        if (res?.success) {
          showToast('success', `Withdrawal ${actionModal.withdrawal.id} marked as ${actionModal.status.toUpperCase()}`)
          setActionModal({ ...actionModal, open: false })
          loadData()
        } else {
          showToast('error', res?.error || 'Failed to update withdrawal')
        }
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRetryPostback = async (postbackId: string) => {
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateRetryPostback) {
        const res = await (window as any).api.affiliateRetryPostback(postbackId, token)
        if (res?.success) {
          showToast('success', `Postback retried: Status is now ${res.data.status.toUpperCase()}`)
          loadData()
        } else {
          showToast('error', res?.error || 'Failed to retry postback')
        }
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
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateAdminSavePostbackConfig) {
        const res = await (window as any).api.affiliateAdminSavePostbackConfig(
          token,
          postbackModal.userId,
          postbackModal.postbackUrl,
          postbackModal.httpMethod,
          postbackModal.isActive
        )
        if (res?.success) {
          showToast('success', 'User S2S Postback Configuration updated successfully!')
          setPostbackModal(prev => ({ ...prev, open: false }))
          loadData()
        } else {
          showToast('error', res?.error || 'Failed to update postback config')
        }
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
      const token = localStorage.getItem('pv_session_token') || ''
      if ((window as any).api?.affiliateAdminTestPostback) {
        const res = await (window as any).api.affiliateAdminTestPostback(
          token,
          postbackModal.postbackUrl,
          postbackModal.httpMethod
        )
        if (res?.success && res.data) {
          setTestPostbackResult(res.data)
          if (res.data.statusCode >= 200 && res.data.statusCode < 300) {
            showToast('success', `✓ Server returned HTTP ${res.data.statusCode} in ${res.data.responseTimeMs}ms!`)
          } else {
            showToast('error', `Server returned HTTP ${res.data.statusCode || 'ERR'}: ${res.data.error || 'Check endpoint'}`)
          }
        }
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

        <div style={{ display: 'flex', gap: '10px' }}>
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
            onClick={loadData}
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
          { id: 'clicks', label: `🖱️ Clicks Stream (${data?.clicks?.length || 0})` },
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
            <h3 style={{ margin: 0, fontSize: '15px', color: '#FFF' }}>CPA Offers & Payout Campaigns</h3>
            <button
              onClick={() => setOfferModal({
                open: true, isEdit: false, title: '', description: '',
                target_url: 'https://antiprofiles.com/pricing', payout_type: 'percentage',
                commission_rate: 15, fixed_payout_usd: 0, status: 'active'
              })}
              style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
            >
              + New CPA Offer
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>OFFER ID</th>
                  <th style={{ padding: '10px 12px' }}>TITLE</th>
                  <th style={{ padding: '10px 12px' }}>PAYOUT MODEL</th>
                  <th style={{ padding: '10px 12px' }}>RATE / BOUNTY</th>
                  <th style={{ padding: '10px 12px' }}>CLICKS / CONV</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                  <th style={{ padding: '10px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data?.offers?.map(offer => (
                  <tr key={offer.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{offer.id}</td>
                    <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>{offer.title}</td>
                    <td style={{ padding: '10px 12px' }}>{offer.payout_type.toUpperCase()}</td>
                    <td style={{ padding: '10px 12px', color: '#34D399', fontWeight: 700 }}>
                      {offer.payout_type === 'percentage' ? `${offer.commission_rate}% RevShare` : `$${offer.fixed_payout_usd} Fixed`}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {offer.total_clicks || 0} / <strong style={{ color: '#4ADE80' }}>{offer.total_conversions || 0}</strong>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80' }}>
                        {offer.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => setOfferModal({
                          open: true, isEdit: true, id: offer.id,
                          title: offer.title, description: offer.description || '',
                          target_url: offer.target_url, payout_type: offer.payout_type,
                          commission_rate: offer.commission_rate, fixed_payout_usd: offer.fixed_payout_usd,
                          status: offer.status
                        })}
                        style={{ padding: '4px 10px', borderRadius: '4px', background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: CLICKS STREAM ── */}
      {activeSubTab === 'clicks' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>Live Click Stream (Audit & Anti-Fraud)</h3>
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
                {data?.clicks?.map(c => (
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
                          CONVERTED
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
        </div>
      )}

      {/* ── TAB 5: CONVERSIONS ── */}
      {activeSubTab === 'conversions' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>CPA Conversions & Attributions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>TIME</th>
                  <th style={{ padding: '10px 12px' }}>CONVERSION ID</th>
                  <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                  <th style={{ padding: '10px 12px' }}>AFFILIATE ID</th>
                  <th style={{ padding: '10px 12px' }}>OFFER</th>
                  <th style={{ padding: '10px 12px' }}>ORDER VALUE</th>
                  <th style={{ padding: '10px 12px' }}>PAYOUT</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data?.conversions?.map(conv => (
                  <tr key={conv.conversion_id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(conv.created_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#FACC15', fontFamily: 'monospace' }}>{conv.conversion_id}</td>
                    <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{conv.click_id}</td>
                    <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>{conv.affiliate_id}</td>
                    <td style={{ padding: '10px 12px' }}>{conv.offer_id}</td>
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

      {/* ── OFFER MODAL ── */}
      {offerModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div style={{
            background: '#131826', border: '1px solid #334155', borderRadius: '16px',
            padding: '24px', width: '100%', maxWidth: '540px', color: '#FFF'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
              {offerModal.isEdit ? 'Edit CPA Offer' : 'Create New CPA Offer'}
            </h3>
            <form onSubmit={handleSaveOffer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>OFFER TITLE</label>
                <input
                  required
                  placeholder="e.g. AntiProfiles Pro Annual Subscription"
                  value={offerModal.title}
                  onChange={e => setOfferModal({ ...offerModal, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>DESCRIPTION</label>
                <textarea
                  rows={2}
                  placeholder="Offer details and conversion criteria"
                  value={offerModal.description}
                  onChange={e => setOfferModal({ ...offerModal, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>TARGET / LANDING URL</label>
                <input
                  type="url"
                  required
                  value={offerModal.target_url}
                  onChange={e => setOfferModal({ ...offerModal, target_url: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>PAYOUT MODEL</label>
                  <select
                    value={offerModal.payout_type}
                    onChange={e => setOfferModal({ ...offerModal, payout_type: e.target.value as any })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  >
                    <option value="percentage">RevShare (% Commission)</option>
                    <option value="fixed">Fixed CPA ($ Bounty)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>
                    {offerModal.payout_type === 'percentage' ? 'COMMISSION %' : 'FIXED USD ($)'}
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>STATUS</label>
                <select
                  value={offerModal.status}
                  onChange={e => setOfferModal({ ...offerModal, status: e.target.value as any })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setOfferModal({ ...offerModal, open: false })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1E293B', color: '#CBD5E1', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOffer}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#2563EB', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {savingOffer ? 'Saving...' : 'Save Offer'}
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
    </div>
  )
}
