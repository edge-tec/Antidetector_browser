import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

interface ReferralInfo {
  referralCode: string
  referralLink: string
  totalReferrals: number
  activeBonusRate: string
  rewardsEarned: string
  tier: string
}

export const ReferralPage: React.FC<{ showToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void }> = ({ showToast }) => {
  const { currentUser } = useAuth()
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [loading, setLoading] = useState(false)

  const cleanId = (currentUser?.id || 'PARTNER').replace(/^usr_/i, '').replace(/[^a-zA-Z0-9]/g, '')
  const defaultSuffix = cleanId.length >= 4 ? cleanId.slice(0, 6).toUpperCase() : (cleanId + '8888').slice(0, 6).toUpperCase()
  const defaultRefCode = (currentUser as any)?.referral_code || `REF_${defaultSuffix}`
  const defaultRefLink = `https://antiprofiles.com/register?ref=${defaultRefCode}`

  const [referralData, setReferralData] = useState<ReferralInfo>({
    referralCode: defaultRefCode,
    referralLink: defaultRefLink,
    totalReferrals: 0,
    activeBonusRate: '10% Bonus Credits',
    rewardsEarned: '0 Bonus Days',
    tier: 'Standard Referral Partner'
  })

  useEffect(() => {
    let isMounted = true
    const loadReferralData = async () => {
      if (!currentUser) return
      setLoading(true)
      try {
        if (typeof window !== 'undefined' && (window as any).api?.getOrCreateReferralCode) {
          const res = await (window as any).api.getOrCreateReferralCode(currentUser.id)
          if (res && res.referralCode && isMounted) {
            const domain = 'https://antiprofiles.com'
            setReferralData(prev => ({
              ...prev,
              referralCode: res.referralCode,
              referralLink: res.referralLink || `${domain}/register?ref=${res.referralCode}`,
              activeBonusRate: res.activeBonusRate || `${res.bonusRatePercent || 10}% Bonus Credits`
            }))
          }
        }
        if (typeof window !== 'undefined' && (window as any).api?.affiliateGetUserSummary) {
          const sumRes = await (window as any).api.affiliateGetUserSummary(currentUser.id)
          if (sumRes?.success && sumRes?.data && isMounted) {
            const sum = sumRes.data
            setReferralData(prev => ({
              ...prev,
              totalReferrals: sum.totalConversions || sum.totalClicks || 0,
              rewardsEarned: sum.totalEarned > 0 ? `$${Number(sum.totalEarned).toFixed(2)} Earned` : `${sum.totalConversions || 0} Bonus Days`,
              activeBonusRate: `${sum.commissionRate || 10}% Bonus Credits`
            }))
          }
        }
      } catch (err) {
        console.warn('Could not fetch referral code from IPC:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadReferralData()
    return () => { isMounted = false }
  }, [currentUser])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralData.referralLink)
    setCopied(true)
    if (showToast) showToast('success', 'Referral link copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralData.referralCode)
    setCopiedCode(true)
    if (showToast) showToast('success', 'Referral code copied to clipboard!')
    setTimeout(() => setCopiedCode(false), 2500)
  }

  const shareText = encodeURIComponent(`Manage multiple browser profiles safely with isolated fingerprints on AntiProfiles Antidetect Browser! Sign up using my invite link:`)
  const shareUrl = encodeURIComponent(referralData.referralLink)

  const openWebAffiliate = () => {
    const url = 'https://antiprofiles.com'
    if (typeof window !== 'undefined' && (window as any).api?.openExternalUrl) {
      (window as any).api.openExternalUrl(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto', color: '#F1F5F9' }}>
      
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '26px' }}>🤝</span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFF', margin: 0, letterSpacing: '-0.02em' }}>
            Refer a Friend
          </h1>
          <span style={{
            background: 'rgba(45, 212, 191, 0.15)',
            color: '#2DD4BF',
            border: '1px solid rgba(45, 212, 191, 0.3)',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em'
          }}>
            REWARDS PROGRAM
          </span>
        </div>
        <p style={{ color: '#94A3B8', fontSize: '13.5px', margin: 0, lineHeight: 1.5, maxWidth: '720px' }}>
          Invite your friends, colleagues, or digital marketing teams to AntiProfiles. When they sign up using your personal referral link, you both receive bonus profile credits and subscription extensions.
        </p>
      </div>

      {/* Main Referral Link Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #131826 0%, #171E31 100%)',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '24px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Your Personal Referral Link
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Referral Code:</span>
              <button
                onClick={handleCopyCode}
                title="Click to copy referral code"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#38BDF8',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {referralData.referralCode} {copiedCode ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* Link Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#0B0F19',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '8px 12px',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '16px', color: '#64748B' }}>🔗</span>
            <input
              type="text"
              readOnly
              value={referralData.referralLink}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#38BDF8',
                fontSize: '13px',
                fontFamily: 'monospace',
                outline: 'none',
                fontWeight: 600
              }}
            />
            <button
              onClick={handleCopyLink}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: copied ? '#10B981' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '12.5px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
              }}
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Quick Share Buttons */}
          <div>
            <span style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', fontWeight: 600, marginBottom: '10px' }}>
              SHARE DIRECTLY VIA:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <a
                href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38BDF8',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>✈️</span> Telegram
              </a>

              <a
                href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>𝕏</span> Twitter / X
              </a>

              <a
                href={`https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  color: '#4ADE80',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>💬</span> WhatsApp
              </a>

              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  color: '#0EA5E9',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>💼</span> LinkedIn
              </a>

              <a
                href={`mailto:?subject=Try%20AntiProfiles%20Antidetect%20Browser&body=Hey!%20Check%20out%20AntiProfiles%20Antidetect%20Browser%20for%20managing%20isolated%20browser%20fingerprints:%20${referralData.referralLink}`}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#CBD5E1',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>✉️</span> Email
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Program Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '18px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>FRIENDS INVITED</span>
          <h3 style={{ fontSize: '24px', color: '#FFF', margin: '8px 0 2px 0', fontWeight: 800 }}>{referralData.totalReferrals}</h3>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>Registered via your link</span>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '18px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>REFERRAL BONUS RATE</span>
          <h3 style={{ fontSize: '24px', color: '#2DD4BF', margin: '8px 0 2px 0', fontWeight: 800 }}>{referralData.activeBonusRate}</h3>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>Applied to all successful referrals</span>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '18px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>REWARDS EARNED</span>
          <h3 style={{ fontSize: '24px', color: '#38BDF8', margin: '8px 0 2px 0', fontWeight: 800 }}>{referralData.rewardsEarned}</h3>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>Added to your account</span>
        </div>

        <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '12px', padding: '18px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>REFERRAL STATUS</span>
          <h3 style={{ fontSize: '18px', color: '#10B981', margin: '12px 0 4px 0', fontWeight: 700 }}>Active Partner</h3>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>Lifetime referral eligibility</span>
        </div>
      </div>

      {/* How It Works Section */}
      <div style={{ background: '#131826', border: '1px solid #1E293B', borderRadius: '14px', padding: '22px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', margin: '0 0 16px 0' }}>
          ✨ How the Referral Program Works
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '10px' }}>
              1
            </div>
            <h4 style={{ fontSize: '14px', color: '#FFF', margin: '0 0 4px 0' }}>Share Your Link</h4>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              Send your personal referral invite link to your friends, coworkers, or social media community.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(45, 212, 191, 0.15)', color: '#2DD4BF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '10px' }}>
              2
            </div>
            <h4 style={{ fontSize: '14px', color: '#FFF', margin: '0 0 4px 0' }}>They Create an Account</h4>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              Your invited friends register on AntiProfiles and start managing isolated browser profiles.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '10px' }}>
              3
            </div>
            <h4 style={{ fontSize: '14px', color: '#FFF', margin: '0 0 4px 0' }}>Unlock Extra Credits</h4>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              You automatically earn bonus subscription time and extra profile credits credited to your account.
            </p>
          </div>
        </div>
      </div>

      {/* Web Affiliate Portal Callout Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '18px'
      }}>
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>💼</span>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFF', margin: 0 }}>
              Looking for our Professional CPA Affiliate & Performance Network?
            </h4>
          </div>
          <p style={{ fontSize: '12.5px', color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
            Earn up to <strong>50% lifetime recurring commissions</strong> and instant CPA bounties. Full affiliate tools (custom sub-ID tracking, postback webhooks, dynamic landing pages, click analytics, and crypto/bank payouts) are available exclusively via the <strong>AntiProfiles Web Dashboard</strong>.
          </p>
        </div>

        <button
          onClick={openWebAffiliate}
          style={{
            padding: '11px 22px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            color: '#FFF',
            fontWeight: 800,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>🌐</span>
          <span>Open Web Affiliate Portal</span>
        </button>
      </div>

    </div>
  )
}
