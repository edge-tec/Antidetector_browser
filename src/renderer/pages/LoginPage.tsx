import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import brandLogoImg from '../assets/brand-logo.png'

interface Props {
  onNavigateRegister: () => void
  onNavigateVerify: (email?: string, devUrl?: string) => void
}

export const LoginPage: React.FC<Props> = ({ onNavigateRegister, onNavigateVerify }) => {
  const { login, googleLogin, forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmailVal, setForgotEmailVal] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotIsSuccess, setForgotIsSuccess] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleDoLogin = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setError('')

    const emailInputEl = document.getElementById('login-email-input') as HTMLInputElement | null
    const passwordInputEl = document.getElementById('login-password-input') as HTMLInputElement | null

    const emailVal = email.trim() || emailInputEl?.value?.trim() || ''
    const passwordVal = password || passwordInputEl?.value || ''

    if (!emailVal || !passwordVal) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)

    try {
      const res = await login(emailVal, passwordVal)
      if (!res.success) {
        if (res.requiresVerification) {
          onNavigateVerify(emailVal, res.verificationUrl)
        } else {
          setError(res.error || 'Invalid email or password.')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during login.')
    } finally {
      setLoading(false)
    }
  }

  const handleDoForgot = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setForgotMsg('')
    setForgotIsSuccess(false)

    const cleanEmail = forgotEmailVal.trim() || email.trim()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setForgotMsg('Please enter a valid email address.')
      return
    }

    setForgotLoading(true)
    try {
      const res = await forgotPassword(cleanEmail)
      if (res.success) {
        setForgotIsSuccess(true)
        setForgotMsg(res.message || 'Password reset link sent! Please check your email inbox.')
      } else {
        setForgotIsSuccess(false)
        setForgotMsg(res.error || 'Failed to request password reset.')
      }
    } catch (err: any) {
      setForgotIsSuccess(false)
      setForgotMsg(err.message || 'Network error communicating with authentication server.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleGoogleSignIn = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await googleLogin()
      if (!res.success) {
        setError(res.error || 'Google login failed')
      }
    } catch (err: any) {
      setError(err.message || 'Google login failed')
    } finally {
      setLoading(false)
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
        maxWidth: '440px',
        margin: '0 auto',
        backgroundColor: '#161622',
        border: '1px solid #2C2C3E',
        borderRadius: '16px',
        padding: '36px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        boxSizing: 'border-box'
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src={brandLogoImg} alt="AntiProfiles Logo" style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 12px rgba(59,130,246,0.4))' }} />
          <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#F1F5F9', fontWeight: 700 }}>
            {showForgot ? 'Reset Password' : 'Welcome to AntiProfiles'}
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
            {showForgot ? 'Enter your account email to receive a password reset link' : 'Sign in to access your anti-detect browser profiles'}
          </p>
        </div>

        {error && !showForgot && (
          <div style={{
            backgroundColor: '#FEF2F215',
            border: '1px solid #EF444450',
            color: '#F87171',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {showForgot ? (
          /* Forgot Password View */
          <div>
            {forgotMsg && (
              <div style={{
                backgroundColor: forgotIsSuccess ? 'rgba(45,212,191,0.15)' : 'rgba(239,68,68,0.15)',
                border: forgotIsSuccess ? '1px solid rgba(45,212,191,0.35)' : '1px solid rgba(239,68,68,0.35)',
                color: forgotIsSuccess ? '#2DD4BF' : '#F87171',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: 1.5
              }}>
                {forgotIsSuccess ? '✓ ' : '⚠️ '}{forgotMsg}
              </div>
            )}

            <form onSubmit={handleDoForgot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmailVal}
                  onChange={e => setForgotEmailVal(e.target.value)}
                  placeholder="user@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#14141F',
                    border: '1px solid #2C2C3E',
                    color: '#FFF',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#2DD4BF',
                  color: '#0F0F17',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  marginTop: '4px',
                  opacity: forgotLoading ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                {forgotLoading ? 'Sending Reset Link...' : 'Send Password Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotMsg(''); }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#94A3B8',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: '1px solid #2C2C3E',
                  cursor: 'pointer'
                }}
              >
                ← Back to Sign In
              </button>
            </form>
          </div>
        ) : (
          /* Sign In View */
          <>
            <form onSubmit={handleDoLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
                  Email Address
                </label>
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#14141F',
                    border: '1px solid #2C2C3E',
                    color: '#FFF',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmailVal(email); }}
                    style={{ background: 'none', border: 'none', color: '#2DD4BF', fontSize: '12px', cursor: 'pointer', fontWeight: 500, padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  id="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#14141F',
                    border: '1px solid #2C2C3E',
                    color: '#FFF',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                onClick={handleDoLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#2DD4BF',
                  color: '#0F0F17',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '4px',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2C2C3E' }} />
              <span style={{ fontSize: '12px', color: '#64748B' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2C2C3E' }} />
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#14141F',
                border: '1px solid #2C2C3E',
                color: '#F1F5F9',
                fontWeight: 600,
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign in with Google
            </button>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#94A3B8' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onNavigateRegister}
                style={{ background: 'none', border: 'none', color: '#2DD4BF', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Create one
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
