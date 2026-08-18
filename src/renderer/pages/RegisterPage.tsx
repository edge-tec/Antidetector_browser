// ──────────────────────────────────────────────
// AntiProfiles — Registration Page
// ──────────────────────────────────────────────

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import brandLogoImg from '../assets/brand-logo.png'

interface Props {
  onNavigateLogin: () => void
  onRegistrationSuccess: (email: string, devUrl?: string) => void
}

export const RegisterPage: React.FC<Props> = ({ onNavigateLogin, onRegistrationSuccess }) => {
  const { register, googleLogin } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [refCode, setRefCode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const ref = urlParams.get('ref') || urlParams.get('r') || localStorage.getItem('antiprofiles_referral_code') || ''
      if (ref) localStorage.setItem('antiprofiles_referral_code', ref)
      return ref
    } catch {
      return ''
    }
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    try {
      const res = await register(name, email, password, confirmPassword, refCode || undefined)
      if (res.success) {
        onRegistrationSuccess(email, res.verificationUrl)
      } else {
        setError(res.error || 'Registration failed')
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
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
        maxWidth: '460px',
        margin: '0 auto',
        backgroundColor: '#161622',
        border: '1px solid #2C2C3E',
        borderRadius: '16px',
        padding: '36px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src={brandLogoImg} alt="AntiProfiles Logo" style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 12px rgba(59,130,246,0.4))' }} />
          <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#F1F5F9', fontWeight: 700 }}>
            Create Your Account
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
            Register to start managing antidetect browser profiles
          </p>
        </div>

        {error && (
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="John Doe"
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
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
              Email Address
            </label>
            <input
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
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
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
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
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
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 500 }}>
              <span>Referral Code</span>
              <span style={{ color: '#64748B' }}>Optional</span>
            </label>
            <input
              type="text"
              value={refCode}
              onChange={e => setRefCode(e.target.value.toUpperCase())}
              placeholder="e.g. REF_ABCD12"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#14141F',
                border: refCode ? '1px solid #2DD4BF80' : '1px solid #2C2C3E',
                color: '#2DD4BF',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
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
              marginTop: '6px',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#2C2C3E' }} />
          <span style={{ fontSize: '12px', color: '#64748B' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#2C2C3E' }} />
        </div>

        {/* Google Sign Up */}
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
          Sign up with Google
        </button>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#94A3B8' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateLogin}
            style={{ background: 'none', border: 'none', color: '#2DD4BF', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}
