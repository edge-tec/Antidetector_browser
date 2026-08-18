// ──────────────────────────────────────────────
// AntiProfiles — Admin Referral & Affiliate Management Controller
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

interface AdminAffiliateData {
  settings: {
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
    totalReferralRegistrations: number
    totalReferredRevenue: number
    totalCommissionsPaid: number
    totalCommissionsPending: number
    totalPendingWithdrawalRequests: number
    pendingWithdrawalSum: number
  }
  withdrawals: any[]
  commissions: any[]
  referralPairs: any[]
}

export const AdminAffiliateManager: React.FC = () => {
  const [data, setData] = useState<AdminAffiliateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'commissions' | 'referrals' | 'settings'>('withdrawals')
  
  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<any>({
    commission_rate_percent: 10,
    holding_period_days: 7,
    min_withdrawal_usd: 20,
    system_domain: 'https://antiprofiles.com'
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Payout Action Modal State
  const [actionModal, setActionModal] = useState<{
    open: boolean
    withdrawal: any | null
    status: 'approved' | 'rejected' | 'paid'
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

  // Reverse Commission Modal
  const [reverseModal, setReverseModal] = useState<{
    open: boolean
    commission: any | null
    reason: string
  }>({
    open: false,
    commission: null,
    reason: 'Customer refund / chargeback reversal'
  })

  // Manual Adjustment Modal
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean
    userId: string
    amount: string
    reason: string
  }>({
    open: false,
    userId: '',
    amount: '',
    reason: 'Special promotional affiliate bonus'
  })

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
        if (res.success && res.data) {
          setData(res.data)
          setSettingsForm({
            commission_rate_percent: res.data.settings?.commission_rate_percent || 10,
            holding_period_days: res.data.settings?.holding_period_days || 7,
            min_withdrawal_usd: res.data.settings?.min_withdrawal_usd || 20,
            system_domain: res.data.settings?.system_domain || 'https://antiprofiles.com'
          })
        }
      }
    } catch (err: any) {
      showToast('error', 'Failed to load affiliate admin overview: ' + err.message)
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
      const res = await (window as any).api.affiliateAdminSaveSettings(token, settingsForm)
      if (res.success) {
        showToast('success', '✓ Affiliate settings saved successfully!')
        await loadData()
      } else {
        showToast('error', res.error || 'Failed to save settings.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleProcessWithdrawal = async () => {
    if (!actionModal.withdrawal) return
    setProcessingAction(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.affiliateAdminUpdateWithdrawal(
        token,
        actionModal.withdrawal.id,
        actionModal.status,
        actionModal.adminNotes,
        actionModal.txRef
      )
      if (res.success) {
        showToast('success', `✓ Withdrawal request marked as ${actionModal.status.toUpperCase()}!`)
        setActionModal({ open: false, withdrawal: null, status: 'paid', adminNotes: '', txRef: '' })
        await loadData()
      } else {
        showToast('error', res.error || 'Failed to process withdrawal.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error processing request.')
    } finally {
      setProcessingAction(false)
    }
  }

  const handleReverseCommission = async () => {
    if (!reverseModal.commission) return
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.affiliateAdminReverseCommission(
        token,
        reverseModal.commission.id,
        reverseModal.reason
      )
      if (res.success) {
        showToast('success', '✓ Commission successfully reversed.')
        setReverseModal({ open: false, commission: null, reason: '' })
        await loadData()
      } else {
        showToast('error', res.error || 'Failed to reverse commission.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error reversing commission.')
    }
  }

  const handleAdjustBalance = async () => {
    const amt = parseFloat(adjustModal.amount)
    if (!adjustModal.userId || isNaN(amt)) {
      showToast('error', 'Please provide valid user ID and amount.')
      return
    }
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.affiliateAdminAdjustBalance(
        token,
        adjustModal.userId,
        amt,
        adjustModal.reason
      )
      if (res.success) {
        showToast('success', `✓ Adjusted balance by $${amt.toFixed(2)} successfully.`)
        setAdjustModal({ open: false, userId: '', amount: '', reason: '' })
        await loadData()
      } else {
        showToast('error', res.error || 'Failed to adjust balance.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error adjusting balance.')
    }
  }

  const formatUsd = (num?: number) => `$${(num || 0).toFixed(2)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: toastMsg.type === 'success' ? '#065F46' : '#991B1B',
          color: '#FFF',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#161622',
        border: '1px solid #2C2C3E',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#FFF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🤝</span> Referral & Affiliate Program Management
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
            Audit affiliate payouts, review pending withdrawal requests, reverse commissions, and adjust global rates.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setAdjustModal({ open: true, userId: '', amount: '', reason: 'Special promotional bonus' })}
            style={{ padding: '8px 14px', borderRadius: '6px', backgroundColor: '#334155', color: '#FFF', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            ➕ Manual Balance Adjustment
          </button>
          <button
            onClick={loadData}
            style={{ padding: '8px 14px', borderRadius: '6px', backgroundColor: '#2DD4BF', color: '#0F172A', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Active Affiliates</div>
          <div style={{ fontSize: '22px', color: '#FFF', fontWeight: 800, marginTop: '4px' }}>{data?.stats?.totalAffiliates || 0}</div>
          <div style={{ fontSize: '11px', color: '#2DD4BF', marginTop: '2px' }}>{data?.stats?.totalReferralRegistrations || 0} Total Signups</div>
        </div>

        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Referred Revenue</div>
          <div style={{ fontSize: '22px', color: '#60A5FA', fontWeight: 800, marginTop: '4px' }}>{formatUsd(data?.stats?.totalReferredRevenue)}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Gross referred volume</div>
        </div>

        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Commissions Paid</div>
          <div style={{ fontSize: '22px', color: '#10B981', fontWeight: 800, marginTop: '4px' }}>{formatUsd(data?.stats?.totalCommissionsPaid)}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Completed payouts</div>
        </div>

        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Pending Withdrawals</div>
          <div style={{ fontSize: '22px', color: '#F59E0B', fontWeight: 800, marginTop: '4px' }}>
            {data?.stats?.totalPendingWithdrawalRequests || 0} ({formatUsd(data?.stats?.pendingWithdrawalSum)})
          </div>
          <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '2px' }}>Requires Admin action</div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #2C2C3E', paddingBottom: '12px' }}>
        {[
          { id: 'withdrawals', label: `💸 Withdrawal Requests (${data?.withdrawals?.filter(w => w.status === 'pending').length || 0} Pending)` },
          { id: 'commissions', label: `📊 Commissions Ledger (${data?.commissions?.length || 0})` },
          { id: 'referrals', label: `👥 Referral Connections (${data?.referralPairs?.length || 0})` },
          { id: 'settings', label: '⚙️ Global Commission Settings' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: activeSubTab === tab.id ? '#1C1C28' : 'transparent',
              color: activeSubTab === tab.id ? '#2DD4BF' : '#94A3B8',
              fontWeight: activeSubTab === tab.id ? 700 : 500,
              fontSize: '13px',
              border: activeSubTab === tab.id ? '1px solid #2DD4BF50' : '1px solid transparent',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Withdrawals Manager Tab */}
      {activeSubTab === 'withdrawals' && (
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#FFF', fontWeight: 700 }}>
              Payout Requests & Processing
            </h4>
          </div>

          {!data?.withdrawals?.length ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No withdrawal requests found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Affiliate User</th>
                    <th style={{ padding: '12px 16px' }}>Amount</th>
                    <th style={{ padding: '12px 16px' }}>Method & Payout Info</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.withdrawals.map(w => {
                    const isPend = w.status === 'pending'
                    const isPaid = w.status === 'paid'
                    const isRej = w.status === 'rejected'
                    const d = w.parsed_payout_details || {}
                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid #1F1F2E' }}>
                        <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                          {new Date(w.requested_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#FFF' }}>{w.user_name || 'User'}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{w.user_email}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#2DD4BF' }}>
                          {formatUsd(w.amount)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#CBD5E1', textTransform: 'capitalize' }}>
                            {w.payout_method.replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                            {d.walletAddress ? `${d.network}: ${d.walletAddress}` : (d.wiseEmail || d.payoneerEmail || d.iban || 'Standard')}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isPaid ? 'rgba(16,185,129,0.15)' : isPend ? 'rgba(245,158,11,0.15)' : isRej ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                            color: isPaid ? '#10B981' : isPend ? '#F59E0B' : isRej ? '#EF4444' : '#60A5FA'
                          }}>
                            {isPaid ? '✓ Paid' : isPend ? '⏳ Pending' : isRej ? 'Rejected' : 'Approved'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isPend ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setActionModal({ open: true, withdrawal: w, status: 'paid', adminNotes: 'Processed via admin payout', txRef: '' })}
                                style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: '#10B981', color: '#0F172A', fontWeight: 700, border: 'none', fontSize: '11px', cursor: 'pointer' }}
                              >
                                💸 Mark Paid
                              </button>
                              <button
                                onClick={() => setActionModal({ open: true, withdrawal: w, status: 'rejected', adminNotes: 'Invalid wallet address / rejected', txRef: '' })}
                                style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#2C2C3E', color: '#EF4444', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              {w.payout_reference ? `Tx: ${w.payout_reference.slice(0, 10)}...` : 'Complete'}
                            </span>
                          )}
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

      {/* 2. Commissions Ledger Tab */}
      {activeSubTab === 'commissions' && (
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#FFF', fontWeight: 700 }}>
              All Generated Commissions & Reversals
            </h4>
          </div>

          {!data?.commissions?.length ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No commissions recorded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Referrer ID</th>
                    <th style={{ padding: '12px 16px' }}>Referred Customer</th>
                    <th style={{ padding: '12px 16px' }}>Order</th>
                    <th style={{ padding: '12px 16px' }}>Commission</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.map(c => {
                    const isRev = c.status === 'reversed' || c.status === 'rejected'
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1F1F2E' }}>
                        <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#60A5FA' }}>
                          {c.referrer_user_id}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#FFF' }}>{c.referred_user_name || 'Customer'}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{c.referred_user_email}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#CBD5E1' }}>
                          {formatUsd(c.order_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: isRev ? '#EF4444' : '#2DD4BF' }}>
                          {formatUsd(c.commission_amount)} ({c.commission_rate}%)
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isRev ? 'rgba(239,68,68,0.15)' : 'rgba(45,212,191,0.15)',
                            color: isRev ? '#EF4444' : '#2DD4BF'
                          }}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {!isRev && (
                            <button
                              onClick={() => setReverseModal({ open: true, commission: c, reason: 'Customer refund / chargeback reversal' })}
                              style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#2C2C3E', color: '#EF4444', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Reverse Commission
                            </button>
                          )}
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

      {/* 3. Referral Relationships Tab */}
      {activeSubTab === 'referrals' && (
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#FFF', fontWeight: 700 }}>
              Referrer ➔ Customer Attribution Relationships
            </h4>
          </div>

          {!data?.referralPairs?.length ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No referral connections recorded.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Referred Customer</th>
                    <th style={{ padding: '12px 16px' }}>Referrer User</th>
                    <th style={{ padding: '12px 16px' }}>Signed Up Date</th>
                    <th style={{ padding: '12px 16px' }}>Total Customer Spend</th>
                    <th style={{ padding: '12px 16px' }}>Commission Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referralPairs.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1F1F2E' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#FFF' }}>{r.referred_user_name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{r.referred_user_email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#2DD4BF' }}>{r.referrer_name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{r.referrer_email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                        {new Date(r.registered_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#60A5FA', fontWeight: 600 }}>
                        {formatUsd(r.total_spent)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#10B981', fontWeight: 800 }}>
                        {formatUsd(r.commission_earned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Global Settings Tab */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '680px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#FFF', fontWeight: 700 }}>
            ⚙️ Affiliate Commission Configuration
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Commission Rate (%) *</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                required
                value={settingsForm.commission_rate_percent}
                onChange={e => setSettingsForm({ ...settingsForm, commission_rate_percent: parseFloat(e.target.value) })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Holding Period (Days) *</label>
              <input
                type="number"
                min="0"
                max="90"
                required
                value={settingsForm.holding_period_days}
                onChange={e => setSettingsForm({ ...settingsForm, holding_period_days: parseInt(e.target.value, 10) })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Min Withdrawal ($ USD) *</label>
              <input
                type="number"
                min="1"
                required
                value={settingsForm.min_withdrawal_usd}
                onChange={e => setSettingsForm({ ...settingsForm, min_withdrawal_usd: parseFloat(e.target.value) })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>System Domain URL *</label>
              <input
                type="text"
                required
                value={settingsForm.system_domain}
                onChange={e => setSettingsForm({ ...settingsForm, system_domain: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            style={{ marginTop: '10px', padding: '12px 20px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            {savingSettings ? 'Saving...' : '💾 Save Affiliate Settings'}
          </button>
        </form>
      )}

      {/* Payout Action Modal */}
      {actionModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,10,0.82)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '480px', maxWidth: '92%', backgroundColor: '#161622', border: '1px solid #2DD4BF50', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#FFF', fontWeight: 800 }}>
              Process Withdrawal Payout ({formatUsd(actionModal.withdrawal?.amount)})
            </h4>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>
              Affiliate: <strong>{actionModal.withdrawal?.user_name}</strong> ({actionModal.withdrawal?.user_email})
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Action Status</label>
              <select
                value={actionModal.status}
                onChange={e => setActionModal({ ...actionModal, status: e.target.value as any })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              >
                <option value="paid">Mark as Paid</option>
                <option value="approved">Approve (Pending Payout)</option>
                <option value="rejected">Reject (Refund Balance)</option>
              </select>
            </div>

            {actionModal.status === 'paid' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Transaction ID / Blockchain Reference Hash</label>
                <input
                  type="text"
                  placeholder="e.g. 0x8a92... or Wise Transfer ID"
                  value={actionModal.txRef}
                  onChange={e => setActionModal({ ...actionModal, txRef: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Admin Note</label>
              <input
                type="text"
                placeholder="Optional note to user"
                value={actionModal.adminNotes}
                onChange={e => setActionModal({ ...actionModal, adminNotes: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setActionModal({ ...actionModal, open: false })} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#2C2C3E', color: '#FFF', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button
                disabled={processingAction}
                onClick={handleProcessWithdrawal}
                style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
              >
                {processingAction ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Commission Modal */}
      {reverseModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,10,0.82)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '450px', maxWidth: '92%', backgroundColor: '#161622', border: '1px solid #EF444450', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#EF4444', fontWeight: 800 }}>
              ⚠️ Reverse Commission ({formatUsd(reverseModal.commission?.commission_amount)})
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
              This will deduct the commission from the affiliate's balance due to order refund or chargeback.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Reversal Reason *</label>
              <input
                type="text"
                value={reverseModal.reason}
                onChange={e => setReverseModal({ ...reverseModal, reason: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setReverseModal({ open: false, commission: null, reason: '' })} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#2C2C3E', color: '#FFF', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleReverseCommission} style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: '#EF4444', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Confirm Reversal</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {adjustModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,10,0.82)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '450px', maxWidth: '92%', backgroundColor: '#161622', border: '1px solid #2DD4BF50', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#FFF', fontWeight: 800 }}>
              ➕ Manual Affiliate Balance Adjustment
            </h4>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>User ID *</label>
              <input
                type="text"
                placeholder="User ID (e.g. usr_123...)"
                value={adjustModal.userId}
                onChange={e => setAdjustModal({ ...adjustModal, userId: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Amount ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 50.00"
                value={adjustModal.amount}
                onChange={e => setAdjustModal({ ...adjustModal, amount: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Adjustment Reason *</label>
              <input
                type="text"
                value={adjustModal.reason}
                onChange={e => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setAdjustModal({ open: false, userId: '', amount: '', reason: '' })} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#2C2C3E', color: '#FFF', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdjustBalance} style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Apply Adjustment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
