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
  signup_url?: string
  landing_page_slug?: string
  payout_type: 'percentage' | 'fixed' | 'revshare'
  commission_rate?: number
  revshare_percent?: number
  fixed_payout_usd: number
  package_id?: string
  package_name?: string
  price?: number
  discount_value?: number
  currency?: string
  status: 'active' | 'paused' | 'archived'
}

export function resolveOfferDetails(offer: any) {
  const title = (offer?.title || '').toLowerCase()
  const id = (offer?.id || '').toLowerCase()
  const pkgId = (offer?.package_id || '').toLowerCase()

  let packageName = 'Professional'
  let price = 49.00
  let landingSlug = 'professional'
  let targetUrl = '/offer/professional'

  if (id === 'offer_starter_license' || id === 'offer_starter_bounty' || title.includes('license') || title.includes('direct bounty')) {
    packageName = 'Starter License'
    price = 19.00
    landingSlug = 'starter-license'
    targetUrl = '/offer/starter-license'
  } else if (id === 'offer_starter' || pkgId === 'plan_starter' || title.includes('starter')) {
    packageName = 'Starter'
    price = 19.00
    landingSlug = 'starter'
    targetUrl = '/offer/starter'
  } else if (id === 'offer_enterprise_trial' || title.includes('enterprise custom trial') || title.includes('enterprise trial')) {
    packageName = 'Enterprise Trial'
    price = 99.00
    landingSlug = 'enterprise-trial'
    targetUrl = '/offer/enterprise-trial'
  } else if (id === 'offer_business_custom' || title.includes('custom business')) {
    packageName = 'Custom Business'
    price = 99.00
    landingSlug = 'business-custom'
    targetUrl = '/offer/business-custom'
  } else if (id === 'offer_business' || id.includes('enterprise') || pkgId === 'plan_business' || title.includes('enterprise') || title.includes('business')) {
    packageName = 'Enterprise'
    price = 99.00
    landingSlug = 'enterprise'
    targetUrl = '/offer/enterprise'
  } else if (id === 'offer_pro_team' || title.includes('team')) {
    packageName = 'Professional Team'
    price = 49.00
    landingSlug = 'pro-team'
    targetUrl = '/offer/pro-team'
  }

  return {
    packageName: offer?.package_name || packageName,
    price: offer?.price || price,
    landingSlug: offer?.landing_page_slug || landingSlug,
    targetUrl: offer?.signup_url || offer?.target_url || targetUrl
  }
}

const DEFAULT_FALLBACK_OFFERS: OfferItem[] = [
  {
    id: 'offer_starter_license',
    title: 'AntiProfiles Starter License',
    description: 'Fixed $10.00 instant CPA payout per verified first-time starter license purchase ($19/mo package).',
    target_url: '/offer/starter-license',
    signup_url: '/offer/starter-license',
    landing_page_slug: 'starter-license',
    payout_type: 'fixed',
    commission_rate: 0,
    revshare_percent: 0,
    fixed_payout_usd: 10.0,
    package_id: 'plan_starter',
    package_name: 'Starter License',
    price: 19.00,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_starter',
    title: 'AntiProfiles Starter Subscription',
    description: 'Standard 40% recurring conversion offer for AntiProfiles Starter package ($19/mo).',
    target_url: '/offer/starter',
    signup_url: '/offer/starter',
    landing_page_slug: 'starter',
    payout_type: 'revshare',
    commission_rate: 40.0,
    revshare_percent: 40.0,
    fixed_payout_usd: 0,
    package_id: 'plan_starter',
    package_name: 'Starter',
    price: 19.00,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_main_saas',
    title: 'AntiProfiles Professional',
    description: 'Earn 50% lifetime recurring commissions on Professional browser subscription renewals ($49/mo).',
    target_url: '/offer/professional',
    signup_url: '/offer/professional',
    landing_page_slug: 'professional',
    payout_type: 'revshare',
    commission_rate: 50.0,
    revshare_percent: 50.0,
    fixed_payout_usd: 0,
    package_id: 'plan_pro',
    package_name: 'Professional',
    price: 49.00,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_pro_team',
    title: 'AntiProfiles Pro + Team Plan',
    description: 'Multi-seat team workspace with 50% lifetime recurring commissions ($49/mo).',
    target_url: '/offer/pro-team',
    signup_url: '/offer/pro-team',
    landing_page_slug: 'pro-team',
    payout_type: 'revshare',
    commission_rate: 50.0,
    revshare_percent: 50.0,
    fixed_payout_usd: 0,
    package_id: 'plan_pro',
    package_name: 'Professional Team',
    price: 49.00,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_enterprise_trial',
    title: 'AntiProfiles Enterprise Trial',
    description: 'Enterprise 7-day risk-free pilot with 50% recurring onboard commissions ($99/mo).',
    target_url: '/offer/enterprise-trial',
    signup_url: '/offer/enterprise-trial',
    landing_page_slug: 'enterprise-trial',
    payout_type: 'revshare',
    commission_rate: 50.0,
    revshare_percent: 50.0,
    fixed_payout_usd: 0,
    package_id: 'plan_business',
    package_name: 'Enterprise Trial',
    price: 99.00,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_business',
    title: 'AntiProfiles Enterprise Suite',
    description: 'High-ticket 50% recurring onboarding commission on full Enterprise subscriptions ($99/mo).',
    target_url: '/offer/enterprise',
    signup_url: '/offer/enterprise',
    landing_page_slug: 'enterprise',
    payout_type: 'revshare',
    commission_rate: 50.0,
    revshare_percent: 50.0,
    fixed_payout_usd: 0,
    package_id: 'plan_business',
    package_name: 'Enterprise',
    price: 99.00,
    currency: 'USD',
    status: 'active'
  },
  {
    id: 'offer_business_custom',
    title: 'AntiProfiles Custom Business',
    description: 'Custom high-volume business licensing with dedicated infrastructure and 50% revenue share.',
    target_url: '/offer/business-custom',
    signup_url: '/offer/business-custom',
    landing_page_slug: 'business-custom',
    payout_type: 'revshare',
    commission_rate: 50.0,
    revshare_percent: 50.0,
    fixed_payout_usd: 0,
    package_id: 'plan_business',
    package_name: 'Custom Business',
    price: 99.00,
    currency: 'USD',
    status: 'active'
  }
]

interface AffiliateSummary {
  affiliateId: string
  affiliateStatus: string
  referralCode: string
  referralLink: string
  commissionRate: number
  minWithdrawalUsd: number
  holdingPeriodDays: number
  totalClicks: number
  todayClicks?: number
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
  postbackConfig: any
  offers: OfferItem[]
  recentClicks: any[]
  recentConversions: any[]
  recentCommissions: CommissionItem[]
  recentWithdrawals: WithdrawalItem[]
  recentPostbacks: any[]
}

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
    todayClicks: 0,
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
  const [selectedLandingPage, setSelectedLandingPage] = useState<string>('offer_default')
  const [customLandingPageUrl, setCustomLandingPageUrl] = useState<string>('')
  const [customSubId, setCustomSubId] = useState<string>('')
  const [customSubId2, setCustomSubId2] = useState<string>('')
  const [customBilling, setCustomBilling] = useState<'month' | 'year'>('month')
  const [utmSource, setUtmSource] = useState<string>('')
  const [utmCampaign, setUtmCampaign] = useState<string>('')
  const [utmMedium, setUtmMedium] = useState<string>('')
  const [generatedTrackingUrl, setGeneratedTrackingUrl] = useState<string>('')
  const [copiedCustomLink, setCopiedCustomLink] = useState(false)
  const [clickFilterPackage, setClickFilterPackage] = useState<string>('all')
  const [clickSearchQuery, setClickSearchQuery] = useState<string>('')

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

  const getOfferLandingPageSlug = (off?: OfferItem): string => {
    if (!off) return 'professional'
    if (off.landing_page_slug) return off.landing_page_slug
    if (off.target_url) {
      const clean = off.target_url.replace(/^\/offer\//, '').replace(/^\//, '')
      if (clean) return clean
    }
    const pkg = (off.package_id || '').toLowerCase()
    if (pkg.includes('starter')) return 'starter'
    if (pkg.includes('business') || pkg.includes('enterprise')) return 'business'
    if (pkg.includes('free')) return 'free'
    return 'professional'
  }

  const loadSummary = async (silent: boolean = false) => {
    const uid = currentUser?.id || 'admin-default'
    if (!silent) setLoading(true)
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
          if (offersList.length > 0 && !selectedOfferForLink) {
            const validOfferId = offersList.some((o: any) => o.id === selectedOfferForLink) ? selectedOfferForLink : offersList[0].id
            setSelectedOfferForLink(validOfferId)
            handleGenerateLink(validOfferId, 'offer_default', updatedSummary)
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
      if (!silent) console.warn('Could not load affiliate summary from IPC:', err)
    } finally {
      if (!silent) setLoading(false)
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
    loadSummary(false)

    let unsubComm: (() => void) | undefined
    let unsubRef: (() => void) | undefined
    let unsubWith: (() => void) | undefined
    let unsubSync: (() => void) | undefined
    let unsubOffers: (() => void) | undefined
    let unsubClick: (() => void) | undefined
    let unsubRealtime: (() => void) | undefined

    if ((window as any).api?.onAffiliateClickRecorded) {
      unsubClick = (window as any).api.onAffiliateClickRecorded((_e: any, d: any) => {
        setSummary(prev => {
          if (!prev) return prev
          const already = (prev.recentClicks || []).some(c => c.click_id === d.click_id)
          const newClicks = already ? prev.recentClicks : [d, ...(prev.recentClicks || [])]
          return {
            ...prev,
            totalClicks: already ? prev.totalClicks : (prev.totalClicks || 0) + 1,
            todayClicks: already ? (prev.todayClicks || 0) : ((prev.todayClicks || 0) + 1),
            recentClicks: newClicks
          }
        })
        showToast('success', `⚡ Live Click Recorded: ${d.click_id || 'new click'}`)
      })
    }

    if ((window as any).api?.onAffiliateRealtimeUpdate) {
      unsubRealtime = (window as any).api.onAffiliateRealtimeUpdate((_e: any, _d: any) => {
        loadSummary(true)
      })
    }

    if ((window as any).api?.onAffiliateCommissionEarned) {
      unsubComm = (window as any).api.onAffiliateCommissionEarned((_e: any, d: any) => {
        if (d?.referrerUserId === currentUser?.id) {
          showToast('success', `🎉 You just earned $${Number(d.commissionAmount || 0).toFixed(2)} in CPA commission!`)
          loadSummary(true)
        }
      })
    }

    if ((window as any).api?.onAffiliateNewReferral) {
      unsubRef = (window as any).api.onAffiliateNewReferral((_e: any, d: any) => {
        if (d?.referrerUserId === currentUser?.id) {
          showToast('success', '👥 A new customer signed up through your CPA link!')
          loadSummary(true)
        }
      })
    }

    if ((window as any).api?.onAffiliateWithdrawalUpdated) {
      unsubWith = (window as any).api.onAffiliateWithdrawalUpdated((_e: any, d: any) => {
        if (d?.userId === currentUser?.id) {
          showToast('success', `💸 Withdrawal update: Status is now ${String(d.status).toUpperCase()}`)
          loadSummary(true)
        }
      })
    }

    if ((window as any).api?.onRealtimeSyncEvent) {
      unsubSync = (window as any).api.onRealtimeSyncEvent((_e: any, d: any) => {
        if (d?.eventType?.includes('affiliate') || d?.eventType?.includes('offer')) {
          loadSummary(true)
        }
      })
    }

    if ((window as any).api?.onAffiliateOffersUpdated) {
      unsubOffers = (window as any).api.onAffiliateOffersUpdated(() => {
        loadSummary(true)
      })
    }

    // Auto sync poller every 5 seconds for real-time background sync
    const poller = setInterval(() => {
      loadSummary(true)
    }, 5000)

    const handleOnline = () => loadSummary(true)
    window.addEventListener('online', handleOnline)

    return () => {
      clearInterval(poller)
      window.removeEventListener('online', handleOnline)
      unsubComm?.()
      unsubRef?.()
      unsubWith?.()
      unsubSync?.()
      unsubOffers?.()
      unsubClick?.()
      unsubRealtime?.()
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

  const handleGenerateLink = async (offerId?: string, lpChoice?: string, currentSummaryState?: AffiliateSummary) => {
    const activeSummary = currentSummaryState || summary
    const targetOfferId = offerId || selectedOfferForLink || activeSummary?.offers?.[0]?.id || 'offer_main_saas'
    const uid = currentUser?.id || activeSummary?.affiliateId || 'admin-default'
    const chosenOffer = (activeSummary?.offers || DEFAULT_FALLBACK_OFFERS).find(o => o.id === targetOfferId)
    const offerSlug = getOfferLandingPageSlug(chosenOffer)

    const activeLp = lpChoice !== undefined ? lpChoice : selectedLandingPage

    let resolvedLp = ''
    if (activeLp === 'offer_default') {
      resolvedLp = `/offer/${offerSlug}`
    } else if (activeLp === 'main_home') {
      resolvedLp = '/'
    } else if (activeLp === 'pricing') {
      resolvedLp = '/pricing'
    } else if (activeLp === 'signup') {
      resolvedLp = '/signup'
    } else if (activeLp === 'custom') {
      resolvedLp = customLandingPageUrl.trim() || `/offer/${offerSlug}`
    } else if (activeLp) {
      resolvedLp = activeLp
    } else {
      resolvedLp = `/offer/${offerSlug}`
    }

    try {
      const customParams: Record<string, string> = {}
      if (customSubId.trim()) customParams.sub_id1 = customSubId.trim()
      if (customSubId2.trim()) customParams.sub_id2 = customSubId2.trim()
      if (customBilling) customParams.billing = customBilling
      if (utmSource.trim()) customParams.utm_source = utmSource.trim()
      if (utmCampaign.trim()) customParams.utm_campaign = utmCampaign.trim()
      if (utmMedium.trim()) customParams.utm_medium = utmMedium.trim()
      if (resolvedLp) customParams.landing_page = resolvedLp

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
      const params = new URLSearchParams({
        aff_id: affId,
        offer_id: targetOfferId
      })
      if (resolvedLp) params.set('lp', resolvedLp.replace(/^\/offer\//, ''))
      if (customBilling && customBilling !== 'month') params.set('billing', customBilling)
      if (customSubId.trim()) params.set('sub_id1', customSubId.trim())
      if (customSubId2.trim()) params.set('sub_id2', customSubId2.trim())
      if (utmSource.trim()) params.set('utm_source', utmSource.trim())
      if (utmCampaign.trim()) params.set('utm_campaign', utmCampaign.trim())
      if (utmMedium.trim()) params.set('utm_medium', utmMedium.trim())

      const fallbackUrl = `${domain}/track?${params.toString()}`
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>🖱️ TOTAL CLICKS</div>
            <span style={{ fontSize: '10px', color: '#38BDF8', background: 'rgba(56,189,248,0.12)', padding: '2px 6px', borderRadius: '4px' }}>Stream</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FFF' }}>{summary ? summary.totalClicks : 0}</div>
          <div style={{ fontSize: '11px', color: '#38BDF8', marginTop: '4px' }}>{summary ? summary.uniqueClicks : 0} Unique Visitors</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(37, 99, 235, 0.12))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '12px', padding: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 700 }}>⚡ TODAY'S CLICKS</div>
            <span style={{ display: 'inline-flex', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#38BDF8' }}>{summary ? (summary.todayClicks ?? 0) : 0}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Real-Time Stream</div>
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
          <div id="cpaLinkBuilderCard" style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#FFF' }}>⚡ CPA Tracking Link Builder</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94A3B8' }}>
              Select a CPA offer and landing page to generate your unique tracking URL with custom SubID tracking tags.
            </p>
            {(() => {
              const allOffers = (summary?.offers && summary.offers.length > 0) ? summary.offers : DEFAULT_FALLBACK_OFFERS
              const currentOfferObj = allOffers.find(o => o.id === selectedOfferForLink) || allOffers[0]
              const currentSlug = getOfferLandingPageSlug(currentOfferObj)

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>SELECT CPA CAMPAIGN / OFFER</label>
                      <select
                        value={selectedOfferForLink}
                        onChange={e => {
                          const newOfferId = e.target.value
                          setSelectedOfferForLink(newOfferId)
                          handleGenerateLink(newOfferId, selectedLandingPage)
                        }}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                      >
                        {allOffers.map(o => {
                          const details = resolveOfferDetails(o)
                          const isRev = o.payout_type === 'percentage' || o.payout_type === 'revshare'
                          const rate = o.commission_rate !== undefined ? o.commission_rate : (o.revshare_percent !== undefined ? o.revshare_percent : 0)
                          const label = isRev ? `${rate}% RevShare` : `$${Number(o.fixed_payout_usd || 0).toFixed(2)} Fixed Bounty`
                          return (
                            <option key={o.id} value={o.id}>
                              {o.title} — {details.packageName} (${details.price}/mo) • {label}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#2DD4BF', marginBottom: '6px', fontWeight: 700 }}>
                        🎯 TARGET LANDING PAGE
                      </label>
                      <select
                        value={selectedLandingPage}
                        onChange={e => {
                          const lp = e.target.value
                          setSelectedLandingPage(lp)
                          handleGenerateLink(selectedOfferForLink, lp)
                        }}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #2DD4BF60', color: '#FFF', fontSize: '12px' }}
                      >
                        <option value="offer_default">🎯 Offer Landing Page (/offer/{currentSlug}) [Recommended]</option>
                        <option value="main_home">🏠 Main Homepage (/)</option>
                        <option value="pricing">💎 Pricing Table (/pricing)</option>
                        <option value="signup">📝 Direct Signup & Checkout (/signup)</option>
                        <option value="custom">⚙️ Custom Landing Page URL...</option>
                      </select>
                    </div>

                    {selectedLandingPage === 'custom' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>CUSTOM URL / PATH</label>
                        <input
                          placeholder="e.g. /offer/starter or https://..."
                          value={customLandingPageUrl}
                          onChange={e => {
                            setCustomLandingPageUrl(e.target.value)
                          }}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>BILLING CYCLE</label>
                      <select
                        value={customBilling}
                        onChange={e => {
                          const b = e.target.value as 'month' | 'year'
                          setCustomBilling(b)
                        }}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                      >
                        <option value="month">Monthly Subscription</option>
                        <option value="year">Annual Subscription (Save 20%)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>SUBID1 (CAMPAIGN / TAG)</label>
                      <input
                        placeholder="e.g. facebook_ads, telegram"
                        value={customSubId}
                        onChange={e => setCustomSubId(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>SUBID2 (CREATIVE / ADSET)</label>
                      <input
                        placeholder="e.g. video_ad_v2, banner_1"
                        value={customSubId2}
                        onChange={e => setCustomSubId2(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>UTM SOURCE</label>
                      <input
                        placeholder="e.g. google, youtube"
                        value={utmSource}
                        onChange={e => setUtmSource(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>UTM CAMPAIGN</label>
                      <input
                        placeholder="e.g. summer_scale, q3_promo"
                        value={utmCampaign}
                        onChange={e => setUtmCampaign(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        onClick={() => handleGenerateLink(selectedOfferForLink, selectedLandingPage)}
                        style={{ width: '100%', padding: '10px 16px', borderRadius: '6px', background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                      >
                        ⚡ Generate Tracking Link
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}

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
            {((summary?.offers && summary.offers.length > 0) ? summary.offers : DEFAULT_FALLBACK_OFFERS).map(offer => {
              const details = resolveOfferDetails(offer)
              const isRev = offer.payout_type === 'percentage' || offer.payout_type === 'revshare'
              const rate = offer.commission_rate !== undefined ? offer.commission_rate : (offer.revshare_percent !== undefined ? offer.revshare_percent : 0)
              const badgeText = isRev ? `${rate}% RECURRING` : `$${Number(offer.fixed_payout_usd || 0).toFixed(2)} CPA FIXED`
              const offerLpSlug = getOfferLandingPageSlug(offer)
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#2DD4BF', fontWeight: 700 }}>
                        Package: {details.packageName}
                      </span>
                      <span style={{ color: '#64748B' }}>•</span>
                      <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                        Price: ${details.price}/month
                      </span>
                      {offer.discount_value && offer.discount_value > 0 ? (
                        <span style={{ color: '#4ADE80', fontSize: '10px', fontWeight: 700 }}>
                          ({offer.discount_value}% OFF)
                        </span>
                      ) : null}
                    </div>
                    <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                      {offer.description || 'Standard conversion offer for AntiProfiles products and subscriptions.'}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #1E293B', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#38BDF8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      🎯 Landing: /offer/{offerLpSlug}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedOfferForLink(offer.id)
                        setSelectedLandingPage('offer_default')
                        handleGenerateLink(offer.id, 'offer_default')
                        const el = document.getElementById('cpaLinkBuilderCard')
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      ⚡ Create Link
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
          <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#94A3B8' }}>
            Configure an automated S2S Postback HTTP webhook that notifies your external tracker (Voluum, RedTrack, Keitaro, Binom) instantly whenever a referral converts.
          </p>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>GLOBAL POSTBACK WEBHOOK URL</label>
            <input
              value={postbackUrl}
              onChange={e => setPostbackUrl(e.target.value)}
              placeholder="https://track.yourdomain.com/postback?click_id={click_id}&payout={payout_amount}&sub1={sub_id1}"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '13px', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600 }}>AVAILABLE MACROS (CLICK TO INSERT)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { tag: '{click_id}', desc: 'Unique CPA Click ID' },
                { tag: '{conversion_id}', desc: 'Conversion Transaction ID' },
                { tag: '{payout_amount}', desc: 'Commission Earned (USD)' },
                { tag: '{order_amount}', desc: 'Customer Purchase Total (USD)' },
                { tag: '{offer_id}', desc: 'CPA Campaign Offer ID' },
                { tag: '{affiliate_id}', desc: 'Your Partner ID' },
                { tag: '{sub_id1}', desc: 'Tracking SubID 1' },
                { tag: '{sub_id2}', desc: 'Tracking SubID 2' }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#FFF' }}>Live Click Stream</h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
                Real-Time Listening
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Package Filter */}
              <select
                value={clickFilterPackage}
                onChange={e => setClickFilterPackage(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px' }}
              >
                <option value="all">All Packages</option>
                <option value="plan_free">Free ($0)</option>
                <option value="plan_starter">Starter ($19)</option>
                <option value="plan_pro">Professional ($49)</option>
                <option value="plan_business">Business ($99)</option>
              </select>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search Click ID, SubID..."
                value={clickSearchQuery}
                onChange={e => setClickSearchQuery(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', background: '#0B0F19', border: '1px solid #334155', color: '#FFF', fontSize: '12px', width: '160px' }}
              />

              <button
                onClick={async () => {
                  try {
                    if ((window as any).api?.affiliateSimulateTestClick) {
                      const res = await (window as any).api.affiliateSimulateTestClick(activeAffiliateId, selectedOfferForLink, 'live_test')
                      if (res?.success) {
                        showToast('success', `🧪 Simulated test click recorded for ${activeAffiliateId}`)
                        loadSummary(true)
                      }
                    }
                  } catch (e: any) {
                    showToast('error', e.message)
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38BDF8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🧪 Test Click
              </button>
              <button
                onClick={() => loadSummary(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#E2E8F0',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {(() => {
            const rawClicks = summary?.recentClicks || []
            const filteredClicks = rawClicks.filter(c => {
              if (clickFilterPackage !== 'all') {
                const pkg = (c.package_id || 'plan_pro').toLowerCase()
                if (pkg !== clickFilterPackage.toLowerCase()) return false
              }
              if (clickSearchQuery.trim()) {
                const q = clickSearchQuery.toLowerCase()
                const clickId = (c.click_id || '').toLowerCase()
                const sub1 = (c.sub_id1 || '').toLowerCase()
                const ip = (c.ip_address || '').toLowerCase()
                const device = (c.device || '').toLowerCase()
                if (!clickId.includes(q) && !sub1.includes(q) && !ip.includes(q) && !device.includes(q)) return false
              }
              return true
            })

            if (filteredClicks.length === 0) {
              return (
                <div style={{ padding: '36px 20px', textAlign: 'center', background: '#0B0F19', borderRadius: '8px', border: '1px dashed #334155' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖱️</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>
                    {rawClicks.length > 0 ? 'No clicks matching filter criteria.' : 'No click traffic recorded yet.'}
                  </div>
                  <p style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '460px', margin: '0 auto 16px auto' }}>
                    Clicks generated when visitors click your referral link (<code>{activeReferralLink}</code>) will populate here in real-time.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        if ((window as any).api?.affiliateSimulateTestClick) {
                          const res = await (window as any).api.affiliateSimulateTestClick(activeAffiliateId, selectedOfferForLink, 'live_test')
                          if (res?.success) {
                            showToast('success', `🧪 Simulated test click recorded for ${activeAffiliateId}`)
                            loadSummary(true)
                          }
                        }
                      } catch (e: any) {
                        showToast('error', e.message)
                      }
                    }}
                    style={{ padding: '8px 18px', borderRadius: '8px', background: '#38BDF8', color: '#0F172A', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
                  >
                    🧪 Generate Live Test Click
                  </button>
                </div>
              )
            }

            return (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>TIME</th>
                      <th style={{ padding: '10px 12px' }}>CLICK ID</th>
                      <th style={{ padding: '10px 12px' }}>PACKAGE / OFFER</th>
                      <th style={{ padding: '10px 12px' }}>DEVICE / OS</th>
                      <th style={{ padding: '10px 12px' }}>SUBID1</th>
                      <th style={{ padding: '10px 12px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClicks.map(clk => (
                      <tr key={clk.click_id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(clk.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                        <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace', fontWeight: 600 }}>{clk.click_id}</td>
                        <td style={{ padding: '10px 12px', color: '#FFF' }}>
                          <span style={{ fontWeight: 600, color: '#2DD4BF' }}>
                            {clk.package_name || (clk.package_id === 'plan_starter' ? 'Starter' : clk.package_id === 'plan_business' ? 'Business' : clk.package_id === 'plan_free' ? 'Free' : 'Professional')}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{clk.offer_id}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>
                          {clk.device || 'Desktop'} • {clk.browser || 'Chrome'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#A78BFA' }}>{clk.sub_id1 || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {clk.converted ? (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80' }}>
                              CONVERTED
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)' }}>
                              ⚡ Clicked
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
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
                    <th style={{ padding: '10px 12px' }}>PACKAGE</th>
                    <th style={{ padding: '10px 12px' }}>OFFER</th>
                    <th style={{ padding: '10px 12px' }}>ORDER VALUE</th>
                    <th style={{ padding: '10px 12px' }}>COMMISSION PAYOUT</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentConversions.map(conv => (
                    <tr key={conv.conversion_id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{new Date(conv.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#FACC15', fontFamily: 'monospace' }}>{conv.conversion_id}</td>
                      <td style={{ padding: '10px 12px', color: '#38BDF8', fontFamily: 'monospace' }}>{conv.click_id}</td>
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
