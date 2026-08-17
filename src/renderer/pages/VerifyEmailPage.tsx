// ──────────────────────────────────────────────
// ProfileVault — Email Verification Screen & Handler
// ──────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

interface Props {
  email?: string
  initialDevUrl?: string
  onNavigateLogin: () => void
}

export const VerifyEmailPage: React.FC<Props> = ({ email: initialEmail, initialDevUrl, onNavigateLogin }) => {
  const { verifyEmail, resendVerification } = useAuth()
  const [emailInput, setEmailInput] = useState(initialEmail || '')
  const [tokenInput, setTokenInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatusMessage, setResendStatusMessage] = useState('')

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handlePerformVerification = useCallback(async (tokenToVerify: string) => {
    const cleanToken = tokenToVerify.trim()
    if (!cleanToken) return
    setStatus('verifying')
    setMessage('')
    setResendStatusMessage('')

    try {
      const res = await verifyEmail(cleanToken)
      if (res.success || res.alreadyVerified) {
        setStatus('success')
        setMessage(res.message || 'Your account has been verified successfully! You are now fully activated.')
      } else {
        setStatus('error')
        setMessage(res.error || 'Invalid or expired verification token.')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Verification failed. Please check your internet connection.')
    }
  }, [verifyEmail])

  useEffect(() => {
    // Check URL parameters for token
    const urlParams = new URLSearchParams(window.location.search)
    const tokenParam = urlParams.get('token')
    if (tokenParam) {
      setTokenInput(tokenParam)
      handlePerformVerification(tokenParam)
    } else if (initialDevUrl) {
      const match = initialDevUrl.match(/token=([a-f0-9]+)/i)
      if (match && match[1]) {
        setTokenInput(match[1])
      }
    }
  }, [initialDevUrl, handlePerformVerification])

  // Real-time listener: If account verified from web browser, auto-activate desktop UI!
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).api?.onRealtimeSyncEvent) return

    const unsubRealtime = (window as any).api.onRealtimeSyncEvent((_e: any, evt: any) => {
      if (evt && (evt.eventType === 'user.email_verified' || evt.type === 'user.email_verified')) {
        setStatus('success')
        setMessage('Your email was verified from your browser! You can now continue.')
      }
    })

    const unsubAuth = (window as any).api.onAuthStateUpdated?.((_e: any, auth: any) => {
      if (auth && auth.emailVerified) {
        setStatus('success')
        setMessage('Your email is verified! Access granted.')
      }
    })

    return () => {
      unsubRealtime?.()
      unsubAuth?.()
    }
  }, [])

  const handleResend = async () => {
    const cleanEmail = emailInput.trim().toLowerCase()
    if (!cleanEmail) {
      setResendStatusMessage('Please enter your email address to resend the verification link.')
      return
    }

    if (resendCooldown > 0) return

    setResendStatusMessage('Sending new confirmation email...')
    try {
      const res = await resendVerification(cleanEmail)
      if (res.success) {
        setResendCooldown(45)
        setResendStatusMessage(res.message || 'A new verification email has been dispatched to your address!')
        if (res.token) {
          setTokenInput(res.token)
        }
      } else if (res.cooldown) {
        setResendCooldown(res.cooldownSeconds || 45)
        setResendStatusMessage(res.error || 'Please wait before requesting another email.')
      } else {
        setResendStatusMessage(res.error || 'Failed to resend verification email.')
      }
    } catch (err: any) {
      setResendStatusMessage(err.message || 'Failed to resend email.')
    }
  }

  return (
    <div className="window-drag-area" style={{
      flex: 1,
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F0F14',
      color: '#CBD5E1',
      padding: '40px 20px',
      boxSizing: 'border-box'
    }}>
      <div className="window-no-drag" style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        backgroundColor: '#161622',
        border: '1px solid #2C2C3E',
        borderRadius: '16px',
        padding: '36px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        boxSizing: 'border-box',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {status === 'success' ? '✅' : status === 'error' ? '⚠️' : '✉️'}
        </div>

        <h2 style={{ margin: '0 0 10px', fontSize: '22px', color: '#F1F5F9', fontWeight: 700 }}>
          {status === 'success' ? 'Email Verified Successfully!' : 'Verification Required'}
        </h2>

        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
          {status === 'success'
            ? message || 'Your account is now fully active across Web, Windows, macOS, and Linux.'
            : status === 'error'
              ? message
              : 'Your account has been created. Please check your email and click the confirmation link to activate your account.'}
        </p>

        {status === 'error' && (
          <div style={{
            backgroundColor: '#FEF2F215',
            border: '1px solid #EF444450',
            color: '#F87171',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            {message}
          </div>
        )}

        {status === 'success' ? (
          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              onClick={onNavigateLogin}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '8px',
                backgroundColor: '#2DD4BF',
                color: '#0F0F17',
                fontWeight: 800,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(45,212,191,0.3)'
              }}
            >
              Continue to Sign In ➔
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textTransform: 'none' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', textAlign: 'left' }}>
                Verification Token (Paste manually if needed)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="Paste verification token..."
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#14141F',
                    border: '1px solid #2C2C3E',
                    color: '#FFF',
                    fontSize: '13px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handlePerformVerification(tokenInput)}
                  disabled={!tokenInput.trim() || status === 'verifying'}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#2DD4BF',
                    color: '#0F0F17',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    opacity: (!tokenInput.trim() || status === 'verifying') ? 0.6 : 1
                  }}
                >
                  {status === 'verifying' ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #2C2C3E', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', textAlign: 'left' }}>
                Resend confirmation email:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="user@example.com"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#14141F',
                    border: '1px solid #2C2C3E',
                    color: '#FFF',
                    fontSize: '13px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#1C1C28',
                    border: '1px solid #2C2C3E',
                    color: resendCooldown > 0 ? '#64748B' : '#CBD5E1',
                    fontWeight: 600,
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Link'}
                </button>
              </div>
              {resendStatusMessage && (
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#38BDF8', textAlign: 'left' }}>
                  {resendStatusMessage}
                </p>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px' }}>
          <button
            type="button"
            onClick={onNavigateLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '13px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

