// ──────────────────────────────────────────────
// AntiProfiles — User Referral & Affiliate Commission Dashboard
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

interface CommissionItem {
  id: string
  referred_user_name?: string
  referred_user_email?: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'available' | 'withdrawn' | 'rejected' | 'reversed'
  available_at: string
  reversal_reason?: string
  created_at: string
}

interface WithdrawalItem {
  id: string
  amount: number
  payout_method: string
  payout_details: string
  parsed_payout_details?: any
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  admin_notes?: string
  payout_reference?: string
  requested_at: string
  paid_at?: string
}

interface AffiliateSummary {
  referralCode: string
  referralLink: string
  commissionRate: number
  minWithdrawalUsd: number
  holdingPeriodDays: number
  totalReferrals: number
  activeReferrals: number
  totalReferredSales: number
  totalEarned: number
  pendingCommission: number
  availableBalance: number
  withdrawnAmount: number
  pendingWithdrawalAmount: number
  enabledPayoutMethods: string[]
  recentCommissions: CommissionItem[]
  recentWithdrawals: WithdrawalItem[]
}

export const ReferralDashboard: React.FC = () => {
  const { currentUser } = useAuth()
  const [summary, setSummary] = useState<AffiliateSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  
  // Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('crypto')
  
  // Payout Details
  const [cryptoAddress, setCryptoAddress] = useState('')
  const [cryptoNetwork, setCryptoNetwork] = useState('USDT (TRC-20)')
  const [wiseEmail, setWiseEmail] = useState('')
  const [payoneerEmail, setPayoneerEmail] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [bankName, setBankName] = useState('')
  
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadSummary = async () => {
    const uid = currentUser?.id
    if (!uid) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if ((window as any).api?.affiliateGetUserSummary) {
        const res = await (window as any).api.affiliateGetUserSummary(uid)
        if (res.success && res.data) {
          setSummary(res.data)
        }
      }
    } catch (err: any) {
      showToast('error', 'Failed to load affiliate data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const activeReferralCode = summary?.referralCode || (loading ? 'Loading...' : '')
  const activeReferralLink = summary?.referralLink || (loading ? 'Loading...' : '')

  useEffect(() => {
    loadSummary()

    let unsubComm: (() => void) | undefined
    let unsubWith: (() => void) | undefined
    let unsubRef: (() => void) | undefined

    if ((window as any).api?.onAffiliateCommissionEarned) {
      unsubComm = (window as any).api.onAffiliateCommissionEarned((_e: any, d: any) => {
        if (d?.referrerUserId === currentUser?.id) {
          showToast('success', `🎉 You just earned $${d.commissionAmount?.toFixed(2)} in referral commission!`)
          loadSummary()
        }
      })
    }

    if ((window as any).api?.onAffiliateNewReferral) {
      unsubRef = (window as any).api.onAffiliateNewReferral((_e: any, d: any) => {
        if (d?.referrerUserId === currentUser?.id) {
          showToast('success', '👥 A new user just signed up using your referral link!')
          loadSummary()
        }
      })
    }

    if ((window as any).api?.onAffiliateWithdrawalUpdated) {
      unsubWith = (window as any).api.onAffiliateWithdrawalUpdated((_e: any, d: any) => {
        if (d?.userId === currentUser?.id) {
          showToast('success', `💸 Payout status updated: ${d.status.toUpperCase()}`)
          loadSummary()
        }
      })
    }

    return () => {
      unsubComm?.()
      unsubRef?.()
      unsubWith?.()
    }
  }, [currentUser?.id])

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text)
    if (isLink) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } else {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    }
  }

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser?.id || !summary) return

    const amt = parseFloat(withdrawAmount)
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Please enter a valid withdrawal amount.')
      return
    }

    if (amt < summary.minWithdrawalUsd) {
      showToast('error', `Minimum withdrawal amount is $${summary.minWithdrawalUsd.toFixed(2)}.`)
      return
    }

    if (amt > summary.availableBalance) {
      showToast('error', `Amount exceeds your available balance ($${summary.availableBalance.toFixed(2)}).`)
      return
    }

    let details: Record<string, any> = {}
    if (withdrawMethod === 'crypto') {
      if (!cryptoAddress.trim()) {
        showToast('error', 'Please enter your crypto wallet payout address.')
        return
      }
      details = { walletAddress: cryptoAddress.trim(), network: cryptoNetwork }
    } else if (withdrawMethod === 'wise') {
      if (!wiseEmail.trim()) {
        showToast('error', 'Please enter your Wise account email.')
        return
      }
      details = { wiseEmail: wiseEmail.trim() }
    } else if (withdrawMethod === 'payoneer') {
      if (!payoneerEmail.trim()) {
        showToast('error', 'Please enter your Payoneer email or ID.')
        return
      }
      details = { payoneerEmail: payoneerEmail.trim() }
    } else if (withdrawMethod === 'apple_bank') {
      if (!bankHolder.trim() || !bankIban.trim()) {
        showToast('error', 'Please enter your Account Holder Name and IBAN/Account Number.')
        return
      }
      details = { accountHolder: bankHolder.trim(), iban: bankIban.trim(), bankName: bankName.trim() }
    }

    setSubmittingWithdrawal(true)
    try {
      const res = await (window as any).api.affiliateRequestWithdrawal(
        currentUser.id,
        amt,
        withdrawMethod,
        details
      )
      if (res.success) {
        showToast('success', '✓ Withdrawal request submitted successfully! Pending Admin review.')
        setShowWithdrawModal(false)
        setWithdrawAmount('')
        await loadSummary()
      } else {
        showToast('error', res.error || 'Failed to submit withdrawal request.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error processing request.')
    } finally {
      setSubmittingWithdrawal(false)
    }
  }

  const formatUsd = (num?: number) => `$${(num || 0).toFixed(2)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
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

      {/* Hero Affiliate Link Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
        border: '1px solid #2DD4BF40',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(45,212,191,0.15)', padding: '4px 10px', borderRadius: '20px', color: '#2DD4BF', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
              <span>🎁</span> LIFETIME AFFILIATE PROGRAM
            </div>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#FFF', fontWeight: 800 }}>
              Earn {summary?.commissionRate || 10}% Commission On Every Referral
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94A3B8', maxWidth: '640px' }}>
              Invite colleagues, marketing teams, and developers to AntiProfiles. When they subscribe to any plan, you get paid direct commission for as long as they stay active.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Available Balance</div>
            <div style={{ fontSize: '26px', color: '#2DD4BF', fontWeight: 900 }}>
              {formatUsd(summary?.availableBalance)}
            </div>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!summary || summary.availableBalance < summary.minWithdrawalUsd}
              style={{
                marginTop: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: summary && summary.availableBalance >= summary.minWithdrawalUsd ? '#2DD4BF' : '#334155',
                color: summary && summary.availableBalance >= summary.minWithdrawalUsd ? '#0F172A' : '#94A3B8',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: summary && summary.availableBalance >= summary.minWithdrawalUsd ? 'pointer' : 'not-allowed'
              }}
            >
              💸 Request Payout
            </button>
          </div>
        </div>

        {/* Link and Code inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', borderTop: '1px solid #2C2C3E', paddingTop: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>
              🔗 YOUR UNIQUE REFERRAL LINK
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={activeReferralLink}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', backgroundColor: '#10101A', border: '1px solid #2C2C3E', color: '#2DD4BF', fontSize: '12px', fontFamily: 'monospace' }}
              />
              <button
                onClick={() => copyToClipboard(activeReferralLink, true)}
                style={{ padding: '0 16px', borderRadius: '6px', backgroundColor: copiedLink ? '#10B981' : '#2DD4BF', color: '#0F172A', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {copiedLink ? '✓ Copied' : '📋 Copy Link'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>
              🎟️ REFERRAL CODE
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={activeReferralCode}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', backgroundColor: '#10101A', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', fontWeight: 700, letterSpacing: '1px' }}
              />
              <button
                onClick={() => copyToClipboard(activeReferralCode, false)}
                style={{ padding: '0 16px', borderRadius: '6px', backgroundColor: copiedCode ? '#10B981' : '#334155', color: '#FFF', fontWeight: 600, fontSize: '12px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {copiedCode ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Key Performance Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {/* Total Referrals */}
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>👥 Total Referrals</div>
          <div style={{ fontSize: '24px', color: '#FFF', fontWeight: 800, marginTop: '6px' }}>
            {summary?.totalReferrals || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#2DD4BF', marginTop: '4px' }}>
            {summary?.activeReferrals || 0} active customers
          </div>
        </div>

        {/* Referred Sales */}
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>📈 Referred Sales</div>
          <div style={{ fontSize: '24px', color: '#60A5FA', fontWeight: 800, marginTop: '6px' }}>
            {formatUsd(summary?.totalReferredSales)}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            Gross purchase volume
          </div>
        </div>

        {/* Total Commission Earned */}
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>💰 Total Earned</div>
          <div style={{ fontSize: '24px', color: '#10B981', fontWeight: 800, marginTop: '6px' }}>
            {formatUsd(summary?.totalEarned)}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            Lifetime commissions
          </div>
        </div>

        {/* Pending Holding */}
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>⏳ Pending Holding</div>
          <div style={{ fontSize: '24px', color: '#F59E0B', fontWeight: 800, marginTop: '6px' }}>
            {formatUsd(summary?.pendingCommission)}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            {summary?.holdingPeriodDays || 7}-day clearance period
          </div>
        </div>

        {/* Total Withdrawn */}
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>💸 Total Withdrawn</div>
          <div style={{ fontSize: '24px', color: '#CBD5E1', fontWeight: 800, marginTop: '6px' }}>
            {formatUsd(summary?.withdrawnAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            Paid out to your accounts
          </div>
        </div>

        {/* Min Withdrawal */}
        <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>🎯 Commission Rate</div>
          <div style={{ fontSize: '24px', color: '#A78BFA', fontWeight: 800, marginTop: '6px' }}>
            {summary?.commissionRate || 10}%
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            Min payout: {formatUsd(summary?.minWithdrawalUsd)}
          </div>
        </div>
      </div>

      {/* Commission Earnings History */}
      <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#FFF', fontWeight: 700 }}>
            📊 Commission Earnings History ({summary?.recentCommissions?.length || 0})
          </h4>
          <button onClick={loadSummary} style={{ background: 'none', border: 'none', color: '#2DD4BF', cursor: 'pointer', fontSize: '12px' }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>Loading commissions...</div>
        ) : !summary?.recentCommissions?.length ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No commissions recorded yet. Share your link to start earning!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Referred Customer</th>
                  <th style={{ padding: '12px 16px' }}>Order Amount</th>
                  <th style={{ padding: '12px 16px' }}>Rate</th>
                  <th style={{ padding: '12px 16px' }}>Commission</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentCommissions.map(c => {
                  const isAvail = c.status === 'available'
                  const isPend = c.status === 'pending'
                  const isWith = c.status === 'withdrawn'
                  const isRev = c.status === 'reversed' || c.status === 'rejected'
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #1F1F2E' }}>
                      <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#FFF' }}>
                        {c.referred_user_name || (c.referred_user_email ? c.referred_user_email.replace(/(.{2})(.*)(?=@)/, '$1***') : 'Referred User')}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#CBD5E1' }}>
                        {formatUsd(c.order_amount)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#A78BFA' }}>
                        {c.commission_rate}%
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: isRev ? '#EF4444' : '#2DD4BF' }}>
                        {formatUsd(c.commission_amount)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isAvail ? 'rgba(45,212,191,0.15)' : isPend ? 'rgba(245,158,11,0.15)' : isWith ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                          color: isAvail ? '#2DD4BF' : isPend ? '#F59E0B' : isWith ? '#60A5FA' : '#EF4444'
                        }}>
                          {isAvail ? '✓ Available' : isPend ? '⏳ Pending' : isWith ? '💸 Paid Out' : '❌ Reversed'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal Requests & History Table */}
      <div style={{ background: '#161622', border: '1px solid #2C2C3E', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#FFF', fontWeight: 700 }}>
            💸 Payout & Withdrawal History ({summary?.recentWithdrawals?.length || 0})
          </h4>
        </div>

        {!summary?.recentWithdrawals?.length ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No withdrawal requests submitted yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Request Date</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Method & Details</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Tx Reference / Notes</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentWithdrawals.map(w => {
                  const isPaid = w.status === 'paid'
                  const isApp = w.status === 'approved'
                  const isRej = w.status === 'rejected'
                  const isPend = w.status === 'pending'
                  const details = w.parsed_payout_details || {}
                  return (
                    <tr key={w.id} style={{ borderBottom: '1px solid #1F1F2E' }}>
                      <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                        {new Date(w.requested_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#FFF' }}>
                        {formatUsd(w.amount)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#F1F5F9', textTransform: 'capitalize' }}>
                          {w.payout_method.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {details.walletAddress ? `${details.network}: ${details.walletAddress.slice(0, 8)}...` : (details.wiseEmail || details.payoneerEmail || details.iban || 'Standard Payout')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isPaid ? 'rgba(16,185,129,0.15)' : isApp ? 'rgba(59,130,246,0.15)' : isPend ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: isPaid ? '#10B981' : isApp ? '#60A5FA' : isPend ? '#F59E0B' : '#EF4444'
                        }}>
                          {isPaid ? '✓ Paid' : isApp ? 'Approved' : isPend ? '⏳ Pending Review' : 'Rejected'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                        {w.payout_reference ? (
                          <span style={{ fontFamily: 'monospace', color: '#6EE7B7' }}>Tx: {w.payout_reference}</span>
                        ) : (w.admin_notes || '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {showWithdrawModal && summary && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 5, 10, 0.82)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '500px',
            maxWidth: '92%',
            backgroundColor: '#161622',
            border: '1px solid #2DD4BF50',
            borderRadius: '16px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#FFF', fontWeight: 800 }}>
                💸 Request Commission Withdrawal
              </h3>
              <button onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#10101A', border: '1px solid #232336', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Available Balance</div>
                <div style={{ fontSize: '18px', color: '#2DD4BF', fontWeight: 800 }}>{formatUsd(summary.availableBalance)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Min. Payout</div>
                <div style={{ fontSize: '14px', color: '#FFF', fontWeight: 600 }}>{formatUsd(summary.minWithdrawalUsd)}</div>
              </div>
            </div>

            <form onSubmit={handleWithdrawalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Withdrawal Amount ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={summary.minWithdrawalUsd}
                  max={summary.availableBalance}
                  required
                  placeholder={`Min. $${summary.minWithdrawalUsd}`}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '14px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Payout Method *</label>
                <select
                  value={withdrawMethod}
                  onChange={e => setWithdrawMethod(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="crypto">Cryptocurrency (USDT / BTC / ETH)</option>
                  <option value="wise">Wise (TransferWise)</option>
                  <option value="payoneer">Payoneer</option>
                  <option value="apple_bank">Bank Transfer / Local Wire</option>
                </select>
              </div>

              {/* Dynamic Payout Fields */}
              {withdrawMethod === 'crypto' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Crypto Network *</label>
                    <select
                      value={cryptoNetwork}
                      onChange={e => setCryptoNetwork(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                    >
                      <option value="USDT (TRC-20)">USDT (TRC-20 - Tron Network)</option>
                      <option value="USDT (ERC-20)">USDT (ERC-20 - Ethereum Network)</option>
                      <option value="Bitcoin (BTC)">Bitcoin (BTC)</option>
                      <option value="Ethereum (ETH)">Ethereum (ETH)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Wallet Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Txyz... or 0x..."
                      value={cryptoAddress}
                      onChange={e => setCryptoAddress(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {withdrawMethod === 'wise' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Wise Account Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="your-email@example.com"
                    value={wiseEmail}
                    onChange={e => setWiseEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                  />
                </div>
              )}

              {withdrawMethod === 'payoneer' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Payoneer Email or ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="payoneer-email@example.com"
                    value={payoneerEmail}
                    onChange={e => setPayoneerEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                  />
                </div>
              )}

              {withdrawMethod === 'apple_bank' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Account Holder Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Full Legal Name"
                      value={bankHolder}
                      onChange={e => setBankHolder(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>IBAN / Account Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GB29 XIBK 2004 1500 0000 00"
                      value={bankIban}
                      onChange={e => setBankIban(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#2C2C3E', color: '#FFF', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdrawal}
                  style={{ padding: '10px 22px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  {submittingWithdrawal ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
