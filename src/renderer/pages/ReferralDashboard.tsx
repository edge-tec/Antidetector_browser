// ──────────────────────────────────────────────
// AntiProfiles — Dedicated CPA Affiliate & Referral Dashboard
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

interface CommissionItem {
  id: string
  referred_user_name?: string
  referred_user_email?: string
  payment_id?: string
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
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | 'cancelled'
  admin_notes?: string
  payout_reference?: string
  requested_at: string
  paid_at?: string
}

interface OfferItem {
  id: string
  title: string
  description?: string
  target_url: string
  payout_type: 'percentage' | 'fixed' | 'revshare'
  commission_rate?: number
  revshare_percent?: number
  fixed_payout_usd: number
  currency?: string
  status: 'active' | 'paused' | 'archived'
}

interface ClickItem {
  click_id: string
  affiliate_id: string
  offer_id: string
  ip_address?: string
  referrer?: string
  landing_url: string
  sub_id1?: string
  converted: number
  created_at: string
}

interface ConversionItem {
  conversion_id: string
  click_id: string
  affiliate_id: string
  offer_id: string
  order_amount: number
  payout_amount: number
  currency: string
  status: string
  created_at: string
}

interface PostbackLogItem {
  id: string
  conversion_id: string
  click_id: string
  url: string
  http_method: string
  http_status?: number
  response_body?: string
  attempt_count: number
  status: 'pending' | 'sent' | 'confirmed' | 'failed' | 'retrying'
  error_message?: string
  created_at: string
}

interface AffiliateSummary {
  affiliateId: string
  affiliateStatus: 'active' | 'suspended' | 'disabled'
  referralCode: string
  referralLink: string
  commissionRate: number
  minWithdrawalUsd: number
  holdingPeriodDays: number
  totalClicks: number
  uniqueClicks: number
  totalConversions: number
  conversionRate: number
  totalReferredSales: number
  totalEarned: number
  pendingCommission: number
  approvedCommission: number
  paidCommission: number
  availableBalance: number
  withdrawnAmount: number
  pendingWithdrawalAmount: number
  enabledPayoutMethods: string[]
  postbackConfig?: {
    postback_url: string
    http_method: 'GET' | 'POST'
    is_active: number
  } | null
  offers: OfferItem[]
  recentClicks: ClickItem[]
  recentConversions: ConversionItem[]
  recentCommissions: CommissionItem[]
  recentWithdrawals: WithdrawalItem[]
  recentPostbacks: PostbackLogItem[]
}

const DEFAULT_FALLBACK_OFFERS: OfferItem[] = [
  {
    id: 'offer_main_saas',
    title: 'AntiProfiles Pro & Team Subscription Plan',
    description: 'Earn 15% recurring lifetime revenue share on every monthly or annual plan purchased.',
    target_url: 'https://antiprofiles.com/#pricing',
    payout_type: 'percentage',
    commission_rate: 15.0,
    fixed_payout_usd: 0,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_starter_bounty',
    title: 'AntiProfiles Starter Account Direct Bounty',
    description: 'Earn a $10.00 instant CPA bounty for every newly verified paying user.',
    target_url: 'https://antiprofiles.com/register',
    payout_type: 'fixed',
    commission_rate: 0,
    fixed_payout_usd: 10.0,
    currency: 'USD',
    status: 'active'
  }
]

const createDefaultSummary = (userId?: string): AffiliateSummary => {
  const clean = (userId || 'PARTNER').replace(/^usr_/i, '').replace(/[^a-zA-Z0-9]/g, '')
  const defaultSuffix = clean.length >= 4 ? clean.slice(0, 6).toUpperCase() : (clean + '8888').slice(0, 6).toUpperCase()
  const affId = `AFF-${defaultSuffix}`
  const refCode = `REF_${defaultSuffix}`
  return {
    affiliateId: affId,
    affiliateStatus: 'active',
    referralCode: refCode,
    referralLink: `https://antiprofiles.com/register?ref=${refCode}`,
    commissionRate: 15,
    minWithdrawalUsd: 50,
    holdingPeriodDays: 7,
    totalClicks: 0,
    uniqueClicks: 0,
    totalConversions: 0,
    conversionRate: 0,
    totalReferredSales: 0,
    totalEarned: 0,
    pendingCommission: 0,
    approvedCommission: 0,
    paidCommission: 0,
    availableBalance: 0,
    withdrawnAmount: 0,
    pendingWithdrawalAmount: 0,
    enabledPayoutMethods: ['crypto', 'wise', 'payoneer', 'apple_bank'],
    postbackConfig: null,
    offers: DEFAULT_FALLBACK_OFFERS,
    recentClicks: [],
    recentConversions: [],
    recentCommissions: [],
    recentWithdrawals: [],
    recentPostbacks: []
  }
}

export const ReferralDashboard: React.FC = () => {
  const { currentUser } = useAuth()
  const [summary, setSummary] = useState<AffiliateSummary>(() => createDefaultSummary(currentUser?.id))
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'postback' | 'clicks' | 'conversions' | 'postback_logs' | 'withdrawals'>('campaigns')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [selectedOfferForLink, setSelectedOfferForLink] = useState<string>('offer_main_saas')
  const [customSubId, setCustomSubId] = useState<string>('')
  const [generatedTrackingUrl, setGeneratedTrackingUrl] = useState<string>('')
  const [copiedCustomLink, setCopiedCustomLink] = useState(false)

  // Postback Config Form
  const [postbackUrl, setPostbackUrl] = useState('')
  const [postbackMethod, setPostbackMethod] = useState<'GET' | 'POST'>('GET')
  const [savingPostback, setSavingPostback] = useState(false)

  // Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('crypto')
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
    const uid = currentUser?.id || 'admin-default'
    setLoading(true)
    try {
      if ((window as any).api?.affiliateGetUserSummary) {
        const res = await (window as any).api.affiliateGetUserSummary(uid)
        if (res?.success && res?.data) {
          const offersList = (res.data.offers && res.data.offers.length > 0) ? res.data.offers : DEFAULT_FALLBACK_OFFERS
          const updatedSummary = { ...res.data, offers: offersList }
          setSummary(updatedSummary)
          if (res.data.postbackConfig?.postback_url) {
            setPostbackUrl(res.data.postbackConfig.postback_url)
            setPostbackMethod(res.data.postbackConfig.http_method || 'GET')
          }
          if (offersList.length > 0) {
            const validOfferId = offersList.some((o: any) => o.id === selectedOfferForLink) ? selectedOfferForLink : offersList[0].id
            setSelectedOfferForLink(validOfferId)
            handleGenerateLink(validOfferId, updatedSummary)
          }
        } else {
          // Fallback to fetching offers
          if ((window as any).api?.affiliateGetOffers) {
            const offersRes = await (window as any).api.affiliateGetOffers(true)
            if (offersRes?.success && Array.isArray(offersRes.data) && offersRes.data.length > 0) {
              setSummary(prev => ({ ...prev, offers: offersRes.data }))
              const validOfferId = offersRes.data.some((o: any) => o.id === selectedOfferForLink) ? selectedOfferForLink : offersRes.data[0].id
              setSelectedOfferForLink(validOfferId)
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Could not load affiliate summary from IPC:', err)
    } finally {
      setLoading(false)
    }
  }

  const cleanId = (currentUser?.id || 'PARTNER').replace(/^usr_/i, '').replace(/[^a-zA-Z0-9]/g, '')
  const fallbackSuffix = cleanId.length >= 4 ? cleanId.slice(0, 6).toUpperCase() : (cleanId + '8888').slice(0, 6).toUpperCase()

  const rawRefCode = summary?.referralCode
  const activeReferralCode = (rawRefCode && !rawRefCode.endsWith('_') && rawRefCode !== 'REF_USR' && rawRefCode !== 'REF_USER' && rawRefCode.length > 5)
    ? rawRefCode
    : `REF_${fallbackSuffix}`

  const rawAffId = summary?.affiliateId
  const activeAffiliateId = (rawAffId && !rawAffId.endsWith('_') && rawAffId !== 'AFF-USR' && rawAffId !== 'AFF-USER' && rawAffId.length > 5)
    ? rawAffId
    : `AFF-${fallbackSuffix}`

  const activeReferralLink = (summary?.referralLink && !summary.referralLink.endsWith('_') && !summary.referralLink.includes('REF_USR_'))
    ? summary.referralLink
    : `https://antiprofiles.com/register?ref=${activeReferralCode}`

  useEffect(() => {
    loadSummary()

    let unsubComm: (() => void) | undefined
    let unsubRef: (() => void) | undefined
    let unsubWith: (() => void) | undefined
    let unsubSync: (() => void) | undefined

    if ((window as any).api?.onAffiliateCommissionEarned) {
      unsubComm = (window as any).api.onAffiliateCommissionEarned((_e: any, d: any) => {
        if (d?.referrerUserId === currentUser?.id) {
          showToast('success', `🎉 You just earned $${Number(d.commissionAmount || 0).toFixed(2)} in CPA commission!`)
          loadSummary()
        }
      })
    }

    if ((window as any).api?.onAffiliateNewReferral) {
      unsubRef = (window as any).api.onAffiliateNewReferral((_e: any, d: any) => {
        if (d?.referrerUserId === currentUser?.id) {
          showToast('success', '👥 A new customer signed up through your CPA link!')
          loadSummary()
        }
      })
    }

    if ((window as any).api?.onAffiliateWithdrawalUpdated) {
      unsubWith = (window as any).api.onAffiliateWithdrawalUpdated((_e: any, d: any) => {
        if (d?.userId === currentUser?.id) {
          showToast('success', `💸 Withdrawal update: Status is now ${String(d.status).toUpperCase()}`)
          loadSummary()
        }
      })
    }

    let unsubOffers: (() => void) | undefined

    if ((window as any).api?.onRealtimeSyncEvent) {
      unsubSync = (window as any).api.onRealtimeSyncEvent((_e: any, d: any) => {
        if (d?.eventType?.includes('affiliate') || d?.eventType?.includes('offer')) {
          loadSummary()
        }
      })
    }

    if ((window as any).api?.onAffiliateOffersUpdated) {
      unsubOffers = (window as any).api.onAffiliateOffersUpdated(() => {
        loadSummary()
      })
    }

    return () => {
      unsubComm?.()
      unsubRef?.()
      unsubWith?.()
      unsubSync?.()
      unsubOffers?.()
    }
  }, [currentUser?.id])

  const copyToClipboard = (text: string, isLink: boolean) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    if (isLink) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } else {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    }
  }

  const handleGenerateLink = async (offerId?: string, currentSummaryState?: AffiliateSummary) => {
    const activeSummary = currentSummaryState || summary
    const targetOfferId = offerId || selectedOfferForLink || activeSummary?.offers?.[0]?.id || 'offer_main_saas'
    const uid = currentUser?.id || activeSummary?.affiliateId || 'admin-default'

    try {
      const customParams: Record<string, string> = {}
      if (customSubId.trim()) customParams.sub_id1 = customSubId.trim()

      if ((window as any).api?.affiliateGenerateTrackingLink) {
        const res = await (window as any).api.affiliateGenerateTrackingLink(uid, targetOfferId, customParams)
        if (res?.success && res?.data?.trackingUrl) {
          setGeneratedTrackingUrl(res.data.trackingUrl)
          showToast('success', 'CPA Tracking Link generated successfully!')
          return
        }
      }

      // Standalone / fallback local link generation
      const affId = activeSummary?.affiliateId || (currentUser?.id ? `AFF-${currentUser.id.slice(0, 6).toUpperCase()}` : 'AFF-1001')
      const domain = 'https://antiprofiles.com'
      let fallbackUrl = `${domain}/track?aff_id=${encodeURIComponent(affId)}&offer_id=${encodeURIComponent(targetOfferId)}`
      if (customSubId.trim()) fallbackUrl += `&sub_id1=${encodeURIComponent(customSubId.trim())}`
      setGeneratedTrackingUrl(fallbackUrl)
      showToast('success', 'CPA Tracking Link generated successfully!')
    } catch (err: any) {
      showToast('error', 'Error generating link: ' + err.message)
    }
  }

  const handleSavePostback = async () => {
    if (!currentUser?.id) return
    if (!postbackUrl.trim()) {
      showToast('error', 'Please enter a valid postback URL.')
      return
    }
    setSavingPostback(true)
    try {
      if ((window as any).api?.affiliateSavePostbackConfig) {
        const res = await (window as any).api.affiliateSavePostbackConfig(currentUser.id, postbackUrl.trim(), postbackMethod)
        if (res?.success) {
          showToast('success', '✅ CPA Postback URL configuration saved!')
          loadSummary()
        } else {
          showToast('error', res?.error || 'Failed to save postback')
        }
      }
    } catch (err: any) {
      showToast('error', 'Error: ' + err.message)
    } finally {
      setSavingPostback(false)
    }
  }

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser?.id || !summary) return

    const numAmount = parseFloat(withdrawAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('error', 'Please enter a valid withdrawal amount.')
      return
    }
    if (numAmount < summary.minWithdrawalUsd) {
      showToast('error', `Minimum withdrawal amount is $${summary.minWithdrawalUsd.toFixed(2)}.`)
      return
    }
    if (numAmount > summary.availableBalance) {
      showToast('error', `Amount exceeds available balance ($${summary.availableBalance.toFixed(2)}).`)
      return
    }

    let payoutDetails: Record<string, any> = {}
    if (withdrawMethod === 'crypto') {
      if (!cryptoAddress.trim()) {
        showToast('error', 'Please provide a recipient wallet address.')
        return
      }
      payoutDetails = { network: cryptoNetwork, address: cryptoAddress.trim() }
    } else if (withdrawMethod === 'wise') {
      if (!wiseEmail.trim()) {
        showToast('error', 'Please provide your Wise account email.')
        return
      }
      payoutDetails = { wiseEmail: wiseEmail.trim() }
    } else if (withdrawMethod === 'payoneer') {
      if (!payoneerEmail.trim()) {
        showToast('error', 'Please provide your Payoneer email.')
        return
      }
      payoutDetails = { payoneerEmail: payoneerEmail.trim() }
    } else if (withdrawMethod === 'apple_bank') {
      if (!bankHolder.trim() || !bankIban.trim() || !bankName.trim()) {
        showToast('error', 'Please complete all required bank account fields.')
        return
      }
      payoutDetails = { accountHolder: bankHolder.trim(), iban: bankIban.trim(), bankName: bankName.trim() }
    }

    setSubmittingWithdrawal(true)
    try {
      if ((window as any).api?.affiliateRequestWithdrawal) {
        const res = await (window as any).api.affiliateRequestWithdrawal(
          currentUser.id,
          numAmount,
          withdrawMethod,
          payoutDetails
        )
        if (res.success) {
          showToast('success', '🎉 Withdrawal request submitted! We will process your payout shortly.')
          setShowWithdrawModal(false)
          setWithdrawAmount('')
          loadSummary()
        } else {
          showToast('error', res.error || 'Failed to submit withdrawal.')
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Withdrawal request failed.')
    } finally {
      setSubmittingWithdrawal(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'confirmed':
      case 'approved':
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80', border: 'rgba(34, 197, 94, 0.3)' }
      case 'processing':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.3)' }
      case 'pending':
      case 'retrying':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#FACC15', border: 'rgba(234, 179, 8, 0.3)' }
      case 'failed':
      case 'rejected':
      case 'reversed':
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
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          background: toastMsg.type === 'success' ? '#065F46' : '#991B1B',
          color: '#FFF',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60A5FA',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                ⚡ CPA AFFILIATE & PERFORMANCE NETWORK
              </span>
              <span style={{
                background: summary?.affiliateStatus === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: summary?.affiliateStatus === 'active' ? '#4ADE80' : '#F87171',
                border: `1px solid ${summary?.affiliateStatus === 'active' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                STATUS: {summary?.affiliateStatus ? summary.affiliateStatus.toUpperCase() : 'ACTIVE'}
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 800, color: '#FFF' }}>
              Affiliate ID: <span style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{activeAffiliateId}</span>
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
              Earn recurring commissions and fixed CPA bounties on every customer referral with real-time postback sync.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              AVAILABLE FOR PAYOUT
            </span>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#34D399', letterSpacing: '-0.5px' }}>
              ${summary ? summary.availableBalance.toFixed(2) : '0.00'}
            </div>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!summary || summary.availableBalance < summary.minWithdrawalUsd}
              style={{
                marginTop: '8px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: summary && summary.availableBalance >= summary.minWithdrawalUsd
                  ? 'linear-gradient(135deg, #10B981, #059669)'
                  : '#1E293B',
                color: summary && summary.availableBalance >= summary.minWithdrawalUsd ? '#FFF' : '#64748B',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: summary && summary.availableBalance >= summary.minWithdrawalUsd ? 'pointer' : 'not-allowed',
                boxShadow: summary && summary.availableBalance >= summary.minWithdrawalUsd ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              💸 Request Withdrawal
            </button>
          </div>
        </div>

        {/* Global Default Links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', borderTop: '1px solid #1E293B', paddingTop: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>
              🔗 DEFAULT REFERRAL URL
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={activeReferralLink}
                style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', backgroundColor: '#0B0F19', border: '1px solid #334155', color: '#38BDF8', fontSize: '12px', fontFamily: 'monospace' }}
              />
              <button
                onClick={() => copyToClipboard(activeReferralLink, true)}
                style={{ padding: '0 16px', borderRadius: '6px', backgroundColor: copiedLink ? '#10B981' : '#38BDF8', color: '#0F172A', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
                style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', backgroundColor: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}
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

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>🖱️ TOTAL CLICKS</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FFF' }}>{summary ? summary.totalClicks : 0}</div>
          <div style={{ fontSize: '11px', color: '#38BDF8', marginTop: '4px' }}>{summary ? summary.uniqueClicks : 0} Unique Visitors</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>🎯 CONVERSIONS</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#4ADE80' }}>{summary ? summary.totalConversions : 0}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>CR: {summary ? summary.conversionRate : 0}%</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>💰 TOTAL EARNED</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FACC15' }}>${summary ? summary.totalEarned.toFixed(2) : '0.00'}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Lifetime Commissions</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>⏳ PENDING HOLD</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FB923C' }}>${summary ? summary.pendingCommission.toFixed(2) : '0.00'}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{summary?.holdingPeriodDays || 7} Days Clearance</div>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>🏦 TOTAL PAID OUT</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#38BDF8' }}>${summary ? summary.paidCommission.toFixed(2) : '0.00'}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Settled Withdrawals</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1E293B', paddingBottom: '12px', marginBottom: '20px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'campaigns', label: '🎯 CPA Offers & Links' },
          { id: 'postback', label: '🔗 Postback Settings' },
          { id: 'clicks', label: `🖱️ Clicks (${summary?.recentClicks?.length || 0})` },
          { id: 'conversions', label: `🎉 Conversions (${summary?.recentConversions?.length || 0})` },
          { id: 'postback_logs', label: `📡 Postback Logs (${summary?.recentPostbacks?.length || 0})` },
          { id: 'withdrawals', label: `💳 Withdrawals (${summary?.recentWithdrawals?.length || 0})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === t.id ? '#2563EB' : '#131826',
              color: activeTab === t.id ? '#FFF' : '#94A3B8',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>📈 Recent Commission Records</h3>
            {(!summary?.recentCommissions || summary.recentCommissions.length === 0) ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                No commission transactions recorded yet. Share your CPA tracking link to start earning!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>DATE</th>
                      <th style={{ padding: '10px 12px' }}>REFERRAL</th>
                      <th style={{ padding: '10px 12px' }}>ORDER VALUE</th>
                      <th style={{ padding: '10px 12px' }}>COMMISSION</th>
                      <th style={{ padding: '10px 12px' }}>STATUS</th>
                      <th style={{ padding: '10px 12px' }}>AVAILABLE AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentCommissions.map(comm => {
                      const badge = getStatusBadge(comm.status)
                      return (
                        <tr key={comm.id} style={{ borderBottom: '1px solid #1E293B' }}>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(comm.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 12px', color: '#FFF', fontWeight: 600 }}>
                            {comm.referred_user_name || comm.referred_user_email || 'Verified Customer'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>${Number(comm.order_amount || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', color: '#34D399', fontWeight: 700 }}>+${Number(comm.commission_amount || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                              {comm.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>
                            {comm.available_at ? new Date(comm.available_at).toLocaleDateString() : 'Instant'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CPA OFFERS & CAMPAIGNS ── */}
      {activeTab === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tracking Link Generator Tool */}
          <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#FFF' }}>⚡ CPA Tracking Link Builder</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94A3B8' }}>
              Select a CPA offer to generate your unique tracking URL with custom SubID tracking tags.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>SELECT CPA CAMPAIGN</label>
                <select
                  value={selectedOfferForLink}
                  onChange={e => {
                    const newOfferId = e.target.value
                    setSelectedOfferForLink(newOfferId)
                    handleGenerateLink(newOfferId)
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                >
                  {((summary?.offers && summary.offers.length > 0) ? summary.offers : DEFAULT_FALLBACK_OFFERS).map(o => {
                    const isRev = o.payout_type === 'percentage' || o.payout_type === 'revshare'
                    const rate = o.commission_rate !== undefined ? o.commission_rate : (o.revshare_percent !== undefined ? o.revshare_percent : 0)
                    const label = isRev ? `${rate}% RevShare` : `$${Number(o.fixed_payout_usd || 0).toFixed(2)} Fixed Bounty`
                    return (
                      <option key={o.id} value={o.id}>
                        {o.title} ({label})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>CUSTOM SUBID1 (OPTIONAL)</label>
                <input
                  placeholder="e.g. facebook_ads, telegram_group"
                  value={customSubId}
                  onChange={e => {
                    setCustomSubId(e.target.value)
                  }}
                  onBlur={() => handleGenerateLink(selectedOfferForLink)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => handleGenerateLink(selectedOfferForLink)}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '6px', background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  ⚡ Generate Tracking Link
                </button>
              </div>
            </div>

            {generatedTrackingUrl && (
              <div style={{ background: '#0B0F19', border: '1px solid #38BDF840', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  readOnly
                  value={generatedTrackingUrl}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#38BDF8', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedTrackingUrl)
                    setCopiedCustomLink(true)
                    setTimeout(() => setCopiedCustomLink(false), 2500)
                  }}
                  style={{ padding: '6px 14px', borderRadius: '6px', background: copiedCustomLink ? '#10B981' : '#38BDF8', color: '#0F172A', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                >
                  {copiedCustomLink ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Offers List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {summary?.offers?.map(offer => {
              const isRev = offer.payout_type === 'percentage' || offer.payout_type === 'revshare'
              const rate = offer.commission_rate !== undefined ? offer.commission_rate : (offer.revshare_percent !== undefined ? offer.revshare_percent : 0)
              const badgeText = isRev ? `${rate}% RECURRING` : `$${Number(offer.fixed_payout_usd || 0).toFixed(2)} CPA FIXED`
              return (
                <div key={offer.id} style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                        {badgeText}
                      </span>
                      <span style={{ fontSize: '11px', color: '#4ADE80', fontWeight: 600 }}>{offer.status === 'active' ? 'Active' : offer.status}</span>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#FFF' }}>{offer.title}</h4>
                    <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                      {offer.description || 'Standard conversion offer for AntiProfiles products and subscriptions.'}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #1E293B', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Target: {offer.target_url}</span>
                    <button
                      onClick={() => {
                        setSelectedOfferForLink(offer.id)
                        handleGenerateLink(offer.id)
                      }}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Create Link
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: CPA POSTBACK SETTINGS ── */}
      {activeTab === 'postback' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#FFF' }}>🔗 Server-to-Server CPA Postback URL</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94A3B8' }}>
            Whenever a customer referred by your link converts, AntiProfiles will instantly send a server-to-server HTTP request to your tracker or affiliate network.
          </p>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '8px' }}>
              POSTBACK URL
            </label>
            <input
              placeholder="https://tracker.your-domain.com/postback?click_id={CLICK_ID}&payout={PAYOUT}&status={STATUS}"
              value={postbackUrl}
              onChange={e => setPostbackUrl(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>HTTP METHOD:</label>
            <select
              value={postbackMethod}
              onChange={e => setPostbackMethod(e.target.value as any)}
              style={{ padding: '8px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
            >
              <option value="GET">GET (Recommended)</option>
              <option value="POST">POST</option>
            </select>
          </div>

          {/* Dynamic Macro Helper Chips */}
          <div style={{ background: '#0B0F19', border: '1px solid #1E293B', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', display: 'block', marginBottom: '8px' }}>
              SUPPORTED DYNAMIC MACROS (Click to insert):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { tag: '{CLICK_ID}', desc: 'Unique Click ID' },
                { tag: '{AFFILIATE_ID}', desc: 'Your Affiliate ID' },
                { tag: '{OFFER_ID}', desc: 'Offer Campaign ID' },
                { tag: '{CONVERSION_ID}', desc: 'Conversion Event ID' },
                { tag: '{STATUS}', desc: 'approved/pending' },
                { tag: '{PAYOUT}', desc: 'Commission in USD' },
                { tag: '{AMOUNT}', desc: 'Order transaction amount' }
              ].map(m => (
                <button
                  key={m.tag}
                  type="button"
                  onClick={() => setPostbackUrl(prev => prev + (prev.includes('?') ? '&' : '?') + `${m.tag.replace(/[{}]/g, '').toLowerCase()}=${m.tag}`)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#1E293B',
                    color: '#E2E8F0',
                    border: '1px solid #334155',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    cursor: 'pointer'
                  }}
                  title={m.desc}
                >
                  {m.tag} <span style={{ color: '#64748B', fontSize: '10px' }}>({m.desc})</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSavePostback}
            disabled={savingPostback}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              color: '#FFF',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              cursor: savingPostback ? 'not-allowed' : 'pointer'
            }}
          >
            {savingPostback ? 'Saving...' : 'Save Postback Configuration'}
          </button>
        </div>
      )}

      {/* ── TAB 4: CLICKS LOG ── */}
      {activeTab === 'clicks' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>Live Click Stream</h3>
          {(!summary?.recentClicks || summary.recentClicks.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No click traffic recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>TIME</th>
                    <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                    <th style={{ padding: '10px 12px' }}>OFFER</th>
                    <th style={{ padding: '10px 12px' }}>IP ADDRESS</th>
                    <th style={{ padding: '10px 12px' }}>SUBID1</th>
                    <th style={{ padding: '10px 12px' }}>CONVERTED</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentClicks.map(clk => (
                    <tr key={clk.click_id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(clk.created_at).toLocaleTimeString()}</td>
                      <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{clk.click_id}</td>
                      <td style={{ padding: '10px 12px', color: '#FFF' }}>{clk.offer_id}</td>
                      <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{clk.ip_address || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#A78BFA' }}>{clk.sub_id1 || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {clk.converted ? (
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80' }}>
                            CONVERTED
                          </span>
                        ) : (
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', color: '#64748B' }}>
                            Clicked
                          </span>
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
      {activeTab === 'conversions' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>CPA Conversions Log</h3>
          {(!summary?.recentConversions || summary.recentConversions.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No conversions recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>DATE</th>
                    <th style={{ padding: '10px 12px' }}>CONVERSION ID</th>
                    <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                    <th style={{ padding: '10px 12px' }}>OFFER</th>
                    <th style={{ padding: '10px 12px' }}>ORDER VALUE</th>
                    <th style={{ padding: '10px 12px' }}>PAYOUT</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentConversions.map(conv => (
                    <tr key={conv.conversion_id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(conv.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#FACC15', fontFamily: 'monospace' }}>{conv.conversion_id}</td>
                      <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{conv.click_id}</td>
                      <td style={{ padding: '10px 12px', color: '#FFF' }}>{conv.offer_id}</td>
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

      {/* ── TAB 6: POSTBACK LOGS ── */}
      {activeTab === 'postback_logs' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#FFF' }}>📡 Postback Delivery Logs</h3>
          {(!summary?.recentPostbacks || summary.recentPostbacks.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No postback deliveries triggered yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>TIME</th>
                    <th style={{ padding: '10px 12px' }}>TARGET URL</th>
                    <th style={{ padding: '10px 12px' }}>STATUS CODE</th>
                    <th style={{ padding: '10px 12px' }}>ATTEMPTS</th>
                    <th style={{ padding: '10px 12px' }}>STATE</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPostbacks.map(pb => {
                    const badge = getStatusBadge(pb.status)
                    return (
                      <tr key={pb.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(pb.created_at).toLocaleTimeString()}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pb.url}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: pb.http_status === 200 ? '#4ADE80' : '#F87171' }}>
                          {pb.http_status ? `${pb.http_status} OK` : 'Failed'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{pb.attempt_count}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.text }}>
                            {pb.status.toUpperCase()}
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
      )}

      {/* ── TAB 7: WITHDRAWALS ── */}
      {activeTab === 'withdrawals' && (
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#FFF' }}>💳 Payout & Withdrawal History</h3>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!summary || summary.availableBalance < summary.minWithdrawalUsd}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: summary && summary.availableBalance >= summary.minWithdrawalUsd ? '#10B981' : '#1E293B',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: summary && summary.availableBalance >= summary.minWithdrawalUsd ? 'pointer' : 'not-allowed'
              }}
            >
              + New Withdrawal Request
            </button>
          </div>

          {(!summary?.recentWithdrawals || summary.recentWithdrawals.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No payout requests yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>REQUESTED AT</th>
                    <th style={{ padding: '10px 12px' }}>AMOUNT</th>
                    <th style={{ padding: '10px 12px' }}>METHOD</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                    <th style={{ padding: '10px 12px' }}>TX REFERENCE / NOTES</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentWithdrawals.map(w => {
                    const badge = getStatusBadge(w.status)
                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(w.requested_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#FFF' }}>${Number(w.amount).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8' }}>{w.payout_method.toUpperCase()}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                            {w.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace' }}>
                          {w.payout_reference || w.admin_notes || '—'}
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

      {/* ── WITHDRAWAL MODAL ── */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#131826',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '500px',
            color: '#FFF'
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>💸 Request Affiliate Payout</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94A3B8' }}>
              Available Withdrawable Balance: <strong style={{ color: '#34D399' }}>${summary?.availableBalance.toFixed(2)}</strong>
            </p>

            <form onSubmit={handleWithdrawalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: 600 }}>
                  AMOUNT (USD) — Min: ${summary?.minWithdrawalUsd.toFixed(2)}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={summary?.minWithdrawalUsd || 20}
                  max={summary?.availableBalance || 0}
                  required
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: 600 }}>
                  PAYOUT METHOD
                </label>
                <select
                  value={withdrawMethod}
                  onChange={e => setWithdrawMethod(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="crypto">Cryptocurrency (USDT / BTC)</option>
                  <option value="wise">Wise (TransferWise)</option>
                  <option value="payoneer">Payoneer</option>
                  <option value="apple_bank">Direct Bank Transfer (IBAN)</option>
                </select>
              </div>

              {withdrawMethod === 'crypto' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>CRYPTO WALLET ADDRESS</label>
                  <input
                    placeholder="Enter USDT TRC-20 / ERC-20 Address"
                    required
                    value={cryptoAddress}
                    onChange={e => setCryptoAddress(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>
              )}

              {withdrawMethod === 'wise' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>WISE EMAIL</label>
                  <input
                    type="email"
                    placeholder="wise-account@domain.com"
                    required
                    value={wiseEmail}
                    onChange={e => setWiseEmail(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>
              )}

              {withdrawMethod === 'payoneer' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>PAYONEER EMAIL</label>
                  <input
                    type="email"
                    placeholder="payoneer-account@domain.com"
                    required
                    value={payoneerEmail}
                    onChange={e => setPayoneerEmail(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                  />
                </div>
              )}

              {withdrawMethod === 'apple_bank' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>ACCOUNT HOLDER NAME</label>
                    <input
                      placeholder="Full Name"
                      required
                      value={bankHolder}
                      onChange={e => setBankHolder(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>IBAN / ACCOUNT NUMBER</label>
                    <input
                      placeholder="IBAN or Account Number"
                      required
                      value={bankIban}
                      onChange={e => setBankIban(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>BANK NAME & SWIFT</label>
                    <input
                      placeholder="Bank Name & SWIFT/BIC Code"
                      required
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1E293B', color: '#CBD5E1', border: '1px solid #334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdrawal}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#10B981', color: '#FFF', border: 'none', fontWeight: 700, fontSize: '13px', cursor: submittingWithdrawal ? 'not-allowed' : 'pointer' }}
                >
                  {submittingWithdrawal ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
