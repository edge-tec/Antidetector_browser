// ──────────────────────────────────────────────
// AntiProfiles — Admin Payment, Billing, Gateways & Trial Manager
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

export interface PaymentItem {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  invoice_id?: string | null
  subscription_id?: string | null
  plan_id?: string | null
  plan_name?: string | null
  transaction_id: string
  amount: number
  currency: string
  gateway: string
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  payment_method: string
  metadata?: string | null
  paid_at?: string | null
  created_at: string
}

export interface GatewayItem {
  id: string
  gateway_key: string
  name: string
  is_enabled: boolean
  is_test_mode: boolean
  public_key: string
  secret_key: string
  webhook_secret: string
  currency: string
  config_json: string
  parsed_config?: any
}

interface Props {
  onSubscriptionUpdated?: () => void
}

export const AdminPaymentManager: React.FC<Props> = ({ onSubscriptionUpdated }) => {
  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'gateways' | 'manual_payment' | 'trial_grant'>('transactions')
  const [loading, setLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Metrics & Data
  const [metrics, setMetrics] = useState({
    totalRevenueUsd: 0,
    paidTransactionsCount: 0,
    pendingTransactionsCount: 0,
    refundedCount: 0,
    activeSubscribersCount: 0,
    trialUsersCount: 0
  })
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [gateways, setGateways] = useState<GatewayItem[]>([])
  const [usersList, setUsersList] = useState<{ id: string; name: string; email: string }[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [gatewayFilter, setGatewayFilter] = useState('all')

  // Modals
  const [editingGateway, setEditingGateway] = useState<GatewayItem | null>(null)
  const [savingGateway, setSavingGateway] = useState(false)

  const [trialForm, setTrialForm] = useState({
    userId: '',
    trialDays: 7,
    planId: 'plan_starter'
  })
  const [grantingTrial, setGrantingTrial] = useState(false)

  const [manualPayForm, setManualPayForm] = useState({
    userId: '',
    planId: 'plan_pro',
    amount: 49.0,
    currency: 'USD',
    gateway: 'manual_bank',
    transactionId: '',
    durationMonths: 1,
    notes: ''
  })
  const [recordingPayment, setRecordingPayment] = useState(false)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadPaymentsOverview = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.adminGetPaymentsOverview(token, {
        search: searchQuery,
        status: statusFilter,
        gateway: gatewayFilter
      })
      if (res?.success && res.data) {
        setMetrics(res.data.metrics || {})
        setPayments(res.data.payments || [])
        setGateways(res.data.gateways || [])
      }

      // Fetch users for dropdowns
      const uRes = await (window as any).api.adminGetUsers(token)
      if (uRes?.success && uRes.users) {
        setUsersList(uRes.users.map((u: any) => ({ id: u.id, name: u.name, email: u.email })))
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load payments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentsOverview()
  }, [searchQuery, statusFilter, gatewayFilter])

  // Save Gateway
  const handleSaveGateway = async () => {
    if (!editingGateway) return
    setSavingGateway(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.adminSavePaymentGateway(token, editingGateway)
      if (res?.success) {
        showToast('success', `✓ Gateway "${editingGateway.name}" saved successfully!`)
        setEditingGateway(null)
        await loadPaymentsOverview()
      } else {
        showToast('error', res?.error || 'Failed to save gateway.')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSavingGateway(false)
    }
  }

  // Toggle Gateway Enabled
  const handleToggleGateway = async (gw: GatewayItem) => {
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const updated = { ...gw, is_enabled: !gw.is_enabled }
      const res = await (window as any).api.adminSavePaymentGateway(token, updated)
      if (res?.success) {
        showToast('success', `✓ ${gw.name} is now ${!gw.is_enabled ? 'ENABLED' : 'DISABLED'}`)
        await loadPaymentsOverview()
      } else {
        showToast('error', res?.error || 'Failed to update gateway.')
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  // Grant Trial Period
  const handleGrantTrial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trialForm.userId) {
      showToast('error', 'Please select a user to grant a trial.')
      return
    }
    setGrantingTrial(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.adminSetUserTrial(token, trialForm)
      if (res?.success) {
        showToast('success', `🎉 Successfully granted ${trialForm.trialDays}-day Free Trial for ${res.data.user_email}!`)
        setActiveSubTab('transactions')
        await loadPaymentsOverview()
        if (onSubscriptionUpdated) onSubscriptionUpdated()
      } else {
        showToast('error', res?.error || 'Failed to set trial period.')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setGrantingTrial(false)
    }
  }

  // Record Manual Payment
  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualPayForm.userId) {
      showToast('error', 'Please select a user.')
      return
    }
    setRecordingPayment(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.adminRecordManualPayment(token, manualPayForm)
      if (res?.success) {
        showToast('success', `✓ Recorded payment of $${manualPayForm.amount} and updated subscription!`)
        setActiveSubTab('transactions')
        await loadPaymentsOverview()
        if (onSubscriptionUpdated) onSubscriptionUpdated()
      } else {
        showToast('error', res?.error || 'Failed to record payment.')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setRecordingPayment(false)
    }
  }

  // Refund Payment
  const handleRefund = async (p: PaymentItem) => {
    if (!confirm(`Are you sure you want to refund payment ${p.transaction_id} ($${p.amount})? This will revoke the user's subscription.`)) {
      return
    }
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.adminRefundPayment(token, { paymentId: p.id, reason: 'Admin dashboard refund' })
      if (res?.success) {
        showToast('success', `✓ Payment ${p.transaction_id} marked as Refunded.`)
        await loadPaymentsOverview()
        if (onSubscriptionUpdated) onSubscriptionUpdated()
      } else {
        showToast('error', res?.error || 'Failed to refund payment.')
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          backgroundColor: toastMsg.type === 'success' ? '#10B98125' : '#EF444425',
          border: `1px solid ${toastMsg.type === 'success' ? '#10B981' : '#EF4444'}`,
          color: toastMsg.type === 'success' ? '#34D399' : '#F87171',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600
        }}>
          {toastMsg.type === 'success' ? '✓ ' : '⚠️ '} {toastMsg.text}
        </div>
      )}

      {/* 1. Metrics Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ padding: '16px 20px', backgroundColor: '#1E1E2E', border: '1px solid #2C2C3E', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>💰 Total Revenue</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#34D399', marginTop: '4px' }}>
            ${metrics.totalRevenueUsd.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Across all payment gateways</div>
        </div>

        <div style={{ padding: '16px 20px', backgroundColor: '#1E1E2E', border: '1px solid #2C2C3E', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>💳 Paid Purchases</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#60A5FA', marginTop: '4px' }}>
            {metrics.paidTransactionsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Completed transactions</div>
        </div>

        <div style={{ padding: '16px 20px', backgroundColor: '#1E1E2E', border: '1px solid #2C2C3E', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>👑 Active Subscribers</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#FBBF24', marginTop: '4px' }}>
            {metrics.activeSubscribersCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Paid active accounts</div>
        </div>

        <div style={{ padding: '16px 20px', backgroundColor: '#1E1E2E', border: '1px solid #2C2C3E', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>⏱️ Free Trial Users</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#A78BFA', marginTop: '4px' }}>
            {metrics.trialUsersCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Active trial licenses</div>
        </div>
      </div>

      {/* 2. Sub-Tabs Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2C2C3E', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('transactions')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'transactions' ? '#1C1C28' : 'transparent',
              color: activeSubTab === 'transactions' ? '#2DD4BF' : '#94A3B8',
              fontWeight: activeSubTab === 'transactions' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            💳 Purchases & Transactions ({payments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('gateways')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'gateways' ? '#1C1C28' : 'transparent',
              color: activeSubTab === 'gateways' ? '#2DD4BF' : '#94A3B8',
              fontWeight: activeSubTab === 'gateways' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            ⚙️ Payment Gateways ({gateways.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('trial_grant')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#A855F720',
              border: '1px solid #A855F760',
              color: '#C084FC',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            ⏱️ Grant Free Trial Period
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('manual_payment')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#2DD4BF',
              border: 'none',
              color: '#0F172A',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(45, 212, 191, 0.3)'
            }}
          >
            ➕ Record Manual Payment
          </button>
        </div>
      </div>

      {/* ── Sub-Tab 1: Purchases & Transactions Table ── */}
      {activeSubTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search user, email, or transaction ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#CBD5E1', fontSize: '13px' }}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={gatewayFilter}
              onChange={e => setGatewayFilter(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid #2C2C3E', color: '#CBD5E1', fontSize: '13px' }}
            >
              <option value="all">All Gateways</option>
              <option value="stripe">Stripe</option>
              <option value="crypto">Cryptocurrency (USDT/BTC)</option>
              <option value="paypal">PayPal</option>
              <option value="manual_bank">Manual Wire / Bank</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ backgroundColor: '#1E1E2E', borderRadius: '12px', border: '1px solid #2C2C3E', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Loading transaction records...</div>
            ) : payments.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                No purchase transactions recorded yet. Click "Record Manual Payment" above to create your first transaction!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#161622', borderBottom: '1px solid #2C2C3E', color: '#94A3B8' }}>
                    <th style={{ padding: '14px 18px' }}>User</th>
                    <th style={{ padding: '14px 18px' }}>Plan</th>
                    <th style={{ padding: '14px 18px' }}>Amount</th>
                    <th style={{ padding: '14px 18px' }}>Gateway / Method</th>
                    <th style={{ padding: '14px 18px' }}>Transaction ID</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px' }}>Date</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #232336' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#FFF' }}>{p.user_name || 'System User'}</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>{p.user_email || p.user_id}</div>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#E2E8F0', fontWeight: 500 }}>
                        {p.plan_name || p.plan_id || 'Subscription'}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#34D399' }}>
                        ${p.amount.toFixed(2)} {p.currency}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#1E293B',
                          color: '#CBD5E1',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {p.gateway}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '12px', color: '#94A3B8' }}>
                        {p.transaction_id}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: p.status === 'paid' ? '#10B98120' : p.status === 'refunded' ? '#EF444420' : '#F59E0B20',
                          color: p.status === 'paid' ? '#34D399' : p.status === 'refunded' ? '#F87171' : '#FBBF24',
                          border: `1px solid ${p.status === 'paid' ? '#10B98140' : p.status === 'refunded' ? '#EF444440' : '#F59E0B40'}`
                        }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#94A3B8', fontSize: '12px' }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {p.status === 'paid' && (
                          <button
                            type="button"
                            onClick={() => handleRefund(p)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #EF444450',
                              backgroundColor: '#EF444415',
                              color: '#F87171',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Sub-Tab 2: Payment Gateways Settings ── */}
      {activeSubTab === 'gateways' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {gateways.map(gw => (
            <div
              key={gw.id}
              style={{
                backgroundColor: '#1E1E2E',
                borderRadius: '16px',
                border: `1px solid ${gw.is_enabled ? '#2DD4BF50' : '#2C2C3E'}`,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>
                      {gw.gateway_key === 'stripe' ? '💳' : gw.gateway_key === 'crypto' ? '🪙' : gw.gateway_key === 'paypal' ? '🅿️' : '🏦'}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FFF' }}>{gw.name}</h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Key: <code>{gw.gateway_key}</code></div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleGateway(gw)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: gw.is_enabled ? '#10B981' : '#334155',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {gw.is_enabled ? '✓ ACTIVE' : 'DISABLED'}
                </button>
              </div>

              {/* Summary Details */}
              <div style={{ backgroundColor: '#14141F', borderRadius: '8px', padding: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Mode:</span>
                  <span style={{ color: gw.is_test_mode ? '#FBBF24' : '#34D399', fontWeight: 600 }}>
                    {gw.is_test_mode ? 'Sandbox / Test Mode' : 'Live Production'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Currency:</span>
                  <span style={{ color: '#FFF', fontWeight: 600 }}>{gw.currency}</span>
                </div>
                {gw.public_key && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Public Key / Wallet:</span>
                    <span style={{ color: '#CBD5E1', fontFamily: 'monospace', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {gw.public_key}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditingGateway({ ...gw })}
                style={{
                  marginTop: 'auto',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#2C2C3E',
                  border: '1px solid #3B3B54',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ✏️ Configure API Keys & Settings
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Sub-Tab 3: Grant Free Trial Period ── */}
      {activeSubTab === 'trial_grant' && (
        <div style={{ maxWidth: '600px', backgroundColor: '#1E1E2E', borderRadius: '16px', border: '1px solid #2C2C3E', padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>⏱️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFF' }}>Set Free Trial Period for User</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                Instantly grant or extend full software access for any user without requiring a credit card or payment.
              </p>
            </div>
          </div>

          <form onSubmit={handleGrantTrial} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Select User *
              </label>
              <select
                required
                value={trialForm.userId}
                onChange={e => setTrialForm({ ...trialForm, userId: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              >
                <option value="">-- Choose User --</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Trial Duration (Days) *
                </label>
                <select
                  value={trialForm.trialDays}
                  onChange={e => setTrialForm({ ...trialForm, trialDays: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                >
                  <option value={3}>3 Days Trial</option>
                  <option value={7}>7 Days Trial (Recommended)</option>
                  <option value={14}>14 Days Trial</option>
                  <option value={30}>30 Days Trial</option>
                  <option value={60}>60 Days Trial</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Plan Tier to Unlock
                </label>
                <select
                  value={trialForm.planId}
                  onChange={e => setTrialForm({ ...trialForm, planId: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="plan_starter">Starter Plan (25 Profiles)</option>
                  <option value="plan_pro">Professional Plan (100 Profiles)</option>
                  <option value="plan_business">Business Plan (500 Profiles)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveSubTab('transactions')}
                style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={grantingTrial}
                style={{
                  flex: 1,
                  padding: '10px 22px',
                  borderRadius: '8px',
                  backgroundColor: '#A855F7',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
                }}
              >
                {grantingTrial ? 'Granting Trial...' : '🚀 Grant Free Trial Access'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Sub-Tab 4: Record Manual Payment ── */}
      {activeSubTab === 'manual_payment' && (
        <div style={{ maxWidth: '600px', backgroundColor: '#1E1E2E', borderRadius: '16px', border: '1px solid #2C2C3E', padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>💵</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFF' }}>Record Manual Offline Payment</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                Record a direct bank wire, crypto transfer, or cash payment and automatically activate the user's subscription.
              </p>
            </div>
          </div>

          <form onSubmit={handleRecordManualPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Select User *
              </label>
              <select
                required
                value={manualPayForm.userId}
                onChange={e => setManualPayForm({ ...manualPayForm, userId: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              >
                <option value="">-- Choose User --</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Subscription Plan
                </label>
                <select
                  value={manualPayForm.planId}
                  onChange={e => setManualPayForm({ ...manualPayForm, planId: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="plan_starter">Starter ($19/mo)</option>
                  <option value="plan_pro">Professional ($49/mo)</option>
                  <option value="plan_business">Business ($99/mo)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Amount Paid ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={manualPayForm.amount}
                  onChange={e => setManualPayForm({ ...manualPayForm, amount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Payment Method / Gateway
                </label>
                <select
                  value={manualPayForm.gateway}
                  onChange={e => setManualPayForm({ ...manualPayForm, gateway: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="manual_bank">Bank Wire / Wise / Payoneer</option>
                  <option value="crypto">Cryptocurrency (Direct USDT/BTC)</option>
                  <option value="stripe">Stripe Offline</option>
                  <option value="paypal">PayPal Direct</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Duration (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={manualPayForm.durationMonths}
                  onChange={e => setManualPayForm({ ...manualPayForm, durationMonths: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Transaction ID / Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. TX-WISE-984218"
                value={manualPayForm.transactionId}
                onChange={e => setManualPayForm({ ...manualPayForm, transactionId: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveSubTab('transactions')}
                style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                style={{
                  flex: 1,
                  padding: '10px 22px',
                  borderRadius: '8px',
                  backgroundColor: '#2DD4BF',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(45, 212, 191, 0.4)'
                }}
              >
                {recordingPayment ? 'Recording...' : '💾 Save Payment & Activate Subscription'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Gateway Editor Modal ── */}
      {editingGateway && (
        <div
          className="window-no-drag"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingGateway(null) }}
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
              maxWidth: '620px',
              backgroundColor: '#181824',
              border: '1px solid #2C2C3E',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2C2C3E', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFF' }}>
                ⚙️ Configure {editingGateway.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingGateway(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#CBD5E1',
                  fontSize: '18px',
                  width: '34px',
                  height: '34px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#FFF', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingGateway.is_enabled}
                    onChange={e => setEditingGateway({ ...editingGateway, is_enabled: e.target.checked })}
                  />
                  Enable this Gateway in Checkout
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#FBBF24', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingGateway.is_test_mode}
                    onChange={e => setEditingGateway({ ...editingGateway, is_test_mode: e.target.checked })}
                  />
                  Test / Sandbox Mode
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  {editingGateway.gateway_key === 'crypto' ? 'USDT TRC20 / ERC20 Wallet Address' : 'Public / Publishable API Key'}
                </label>
                <input
                  type="text"
                  value={editingGateway.public_key || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, public_key: e.target.value })}
                  placeholder={editingGateway.gateway_key === 'crypto' ? 'e.g. Txxxxxxxxxxxxxxxxxxxx' : 'pk_live_... / pk_test_...'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Secret Key / Private API Token
                </label>
                <input
                  type="password"
                  value={editingGateway.secret_key || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, secret_key: e.target.value })}
                  placeholder="sk_live_... / sk_test_..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Webhook Signing Secret
                </label>
                <input
                  type="password"
                  value={editingGateway.webhook_secret || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, webhook_secret: e.target.value })}
                  placeholder="whsec_..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Additional Configuration (JSON format)
                </label>
                <textarea
                  rows={4}
                  value={editingGateway.config_json || '{}'}
                  onChange={e => setEditingGateway({ ...editingGateway, config_json: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#101018', border: '1px solid #334155', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid #2C2C3E' }}>
                <button
                  type="button"
                  onClick={() => setEditingGateway(null)}
                  style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingGateway}
                  onClick={handleSaveGateway}
                  style={{ padding: '10px 22px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}
                >
                  {savingGateway ? 'Saving...' : '💾 Save Gateway Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
