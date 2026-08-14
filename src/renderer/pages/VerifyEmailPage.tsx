// ──────────────────────────────────────────────
// ProfileVault — Email Verification Screen & Handler
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
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
  const [devLink, setDevLink] = useState(initialDevUrl || '')

  useEffect(() => {
    // Check if token is in URL query parameters
    const urlParams = new URLSearchParams(window.location.search)
    const tokenParam = urlParams.get('token')
    if (tokenParam) {
      handlePerformVerification(tokenParam)
    } else if (initialDevUrl) {
      const match = initialDevUrl.match(/token=([a-f0-9]+)/i)
      if (match && match[1]) {
        setTokenInput(match[1])
      }
    }
  }, [initialDevUrl])

  const handlePerformVerification = async (tokenToVerify: string) => {
    if (!tokenToVerify) return
    setStatus('verifying')
    setMessage('')

    try {
      const res = await verifyEmail(tokenToVerify)
      if (res.success) {
        setStatus('success')
        setMessage('Your account has been verified successfully! Redirecting...')
      } else {
        setStatus('error')
        setMessage(res.error || 'Invalid or expired verification token.')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Verification failed.')
    }
  }

  const handleResend = async () => {
    if (!emailInput) {
      setMessage('Please enter your email address to resend the verification link.')
      return
    }

    try {
      const res = await resendVerification(emailInput)
      if (res.success) {
        setMessage('A new verification email has been sent!')
        if (res.verificationUrl) {
          setDevLink(res.verificationUrl)
          const match = res.verificationUrl.match(/token=([a-f0-9]+)/i)
          if (match && match[1]) setTokenInput(match[1])
        }
      } else {
        setMessage(res.error || 'Failed to resend verification email.')
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to resend email.')
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
          {status === 'success' ? 'Email Verified!' : 'Verification Required'}
        </h2>

        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
          {status === 'success'
            ? 'Your account is now fully active. You have full access to profile management.'
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

        {status !== 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textTransform: 'none' }}>
            {devLink && (
              <div style={{
                backgroundColor: '#10B98115',
                border: '1px solid #10B98150',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 600, color: '#10B981', marginBottom: '4px' }}>⚡ Verification Token Ready:</div>
                <div style={{ color: '#94A3B8', wordBreak: 'break-all', fontFamily: 'monospace' }}>{tokenInput}</div>
                <button
                  type="button"
                  onClick={() => handlePerformVerification(tokenInput)}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#10B981',
                    color: '#0F0F17',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Click Here To Confirm & Activate Account
                </button>
              </div>
            )}

            {!devLink && (
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
                    disabled={!tokenInput || status === 'verifying'}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#2DD4BF',
                      color: '#0F0F17',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}

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
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#1C1C28',
                    border: '1px solid #2C2C3E',
                    color: '#CBD5E1',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Resend Link
                </button>
              </div>
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
