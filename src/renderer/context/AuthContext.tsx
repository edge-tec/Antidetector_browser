// ──────────────────────────────────────────────
// AntiProfiles — Authentication Context (With Impersonation Support)
// ──────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect } from 'react'
import { UserDisplay } from '../types'

export interface ImpersonationState {
  originalToken: string
  originalAdminUser: UserDisplay
}

interface AuthContextType {
  currentUser: UserDisplay | null
  sessionToken: string | null
  impersonatedBy: ImpersonationState | null
  isLoading: boolean
  isAuthenticated: boolean
  isVerified: boolean
  isAdmin: boolean
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; verificationUrl?: string; user?: UserDisplay; token?: string }>
  register: (name: string, email: string, pass: string, confirm: string, refCode?: string) => Promise<{ success: boolean; error?: string; verificationUrl?: string }>
  googleLogin: (payload?: any) => Promise<{ success: boolean; error?: string }>
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string; verificationUrl?: string }>
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>
  impersonateUser: (targetUser: UserDisplay) => Promise<{ success: boolean; error?: string }>
  exitImpersonation: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const callIpc = async (channel: string, ...args: any[]) => {
  if (typeof window !== 'undefined' && (window as any).api) {
    const apiMethodMap: Record<string, string> = {
      'auth:login': 'loginUser',
      'auth:register': 'registerUser',
      'auth:google-login': 'googleLogin',
      'auth:verify-email': 'verifyEmail',
      'auth:resend-verification': 'resendVerification',
      'auth:forgot-password': 'forgotPassword',
      'auth:reset-password': 'resetPassword',
      'auth:get-current-user': 'getCurrentUser',
      'auth:logout': 'logoutUser',
      'admin:impersonate-user': 'adminImpersonateUser'
    }
    const methodName = apiMethodMap[channel]
    if (methodName && typeof (window as any).api[methodName] === 'function') {
      return await (window as any).api[methodName](...args)
    }
  }

  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    return await (window as any).electron.ipcRenderer.invoke(channel, ...args)
  }

  // Fallback for web preview / standalone renderer mode
  if (channel === 'auth:login') {
    const [payload] = args
    if (payload?.email?.toLowerCase() === 'admin@antiprofiles.com') {
      const mockAdmin: UserDisplay = {
        id: 'admin-default',
        name: 'System Admin',
        email: 'admin@antiprofiles.com',
        role: 'admin',
        emailVerified: true,
        accountStatus: 'active',
        hasPassword: true,
        googleId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profileCount: 0
      }
      return { success: true, user: mockAdmin, token: 'mock-admin-token' }
    }
  }

  if (channel === 'auth:get-current-user') {
    const mockAdmin: UserDisplay = {
      id: 'admin-default',
      name: 'System Admin',
      email: 'admin@antiprofiles.com',
      role: 'admin',
      emailVerified: true,
      accountStatus: 'active',
      hasPassword: true,
      googleId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      profileCount: 0
    }
    return { success: true, data: mockAdmin }
  }

  if (channel === 'admin:impersonate-user') {
    const [, targetUserId] = args
    const mockUser: UserDisplay = {
      id: targetUserId || `usr_${Date.now()}`,
      name: 'Target User',
      email: 'user@example.com',
      role: 'user',
      emailVerified: true,
      accountStatus: 'active',
      hasPassword: true,
      googleId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      profileCount: 0
    }
    return {
      success: true,
      token: `impersonate_token_${targetUserId}`,
      user: mockUser
    }
  }

  throw new Error('Electron IPC Bridge is unavailable. Please restart the app in Electron.')
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserDisplay | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('pv_session_token'))
  const [impersonatedBy, setImpersonatedBy] = useState<ImpersonationState | null>(() => {
    try {
      const stored = localStorage.getItem('pv_impersonated_by')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const checkSession = async () => {
      if (!sessionToken) {
        setIsLoading(false)
        return
      }
      try {
        const res = await callIpc('auth:get-current-user', sessionToken)
        if (isMounted) {
          if (res?.success && res.data) {
            setCurrentUser(res.data)
          } else {
            localStorage.removeItem('pv_session_token')
            localStorage.removeItem('pv_impersonated_by')
            setSessionToken(null)
            setCurrentUser(null)
            setImpersonatedBy(null)
          }
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem('pv_session_token')
          localStorage.removeItem('pv_impersonated_by')
          setSessionToken(null)
          setCurrentUser(null)
          setImpersonatedBy(null)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    checkSession()
    return () => { isMounted = false }
  }, [sessionToken])

  const login = async (email: string, pass: string) => {
    const res = await callIpc('auth:login', { email, password: pass })
    if (res?.success && res.token && res.user) {
      localStorage.setItem('pv_session_token', res.token)
      localStorage.removeItem('pv_impersonated_by')
      setSessionToken(res.token)
      setCurrentUser(res.user)
      setImpersonatedBy(null)
    }
    return res
  }

  const register = async (name: string, email: string, pass: string, confirm: string, refCode?: string) => {
    return await callIpc('auth:register', { name, email, password: pass, confirmPassword: confirm, ref: refCode })
  }

  const googleLogin = async (payload?: any) => {
    const res = await callIpc('auth:google-login', payload)
    if (res?.success && res.token && res.user) {
      localStorage.setItem('pv_session_token', res.token)
      localStorage.removeItem('pv_impersonated_by')
      setSessionToken(res.token)
      setCurrentUser(res.user)
      setImpersonatedBy(null)
    }
    return res
  }

  const verifyEmail = async (token: string) => {
    const res = await callIpc('auth:verify-email', token)
    if (res?.success && res.token && res.user) {
      localStorage.setItem('pv_session_token', res.token)
      localStorage.removeItem('pv_impersonated_by')
      setSessionToken(res.token)
      setCurrentUser(res.user)
      setImpersonatedBy(null)
    }
    return res
  }

  const resendVerification = async (email: string) => {
    return await callIpc('auth:resend-verification', email)
  }

  const forgotPassword = async (email: string) => {
    return await callIpc('auth:forgot-password', email)
  }

  const resetPassword = async (token: string, newPassword: string) => {
    return await callIpc('auth:reset-password', { token, newPassword })
  }

  const impersonateUser = async (targetUser: UserDisplay) => {
    if (!sessionToken || !currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required to impersonate user.' }
    }

    try {
      const res = await callIpc('admin:impersonate-user', sessionToken, targetUser.id)
      if (res?.success && res.token && res.user) {
        const impState: ImpersonationState = {
          originalToken: sessionToken,
          originalAdminUser: currentUser
        }
        localStorage.setItem('pv_impersonated_by', JSON.stringify(impState))
        localStorage.setItem('pv_session_token', res.token)

        setImpersonatedBy(impState)
        setSessionToken(res.token)
        setCurrentUser(res.user)
        return { success: true }
      }
      return { success: false, error: res?.error || 'Failed to switch user account.' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const exitImpersonation = () => {
    if (impersonatedBy) {
      localStorage.setItem('pv_session_token', impersonatedBy.originalToken)
      localStorage.removeItem('pv_impersonated_by')
      setSessionToken(impersonatedBy.originalToken)
      setCurrentUser(impersonatedBy.originalAdminUser)
      setImpersonatedBy(null)
    }
  }

  const logout = async () => {
    if (sessionToken) {
      await callIpc('auth:logout', sessionToken).catch(() => {})
    }
    localStorage.removeItem('pv_session_token')
    localStorage.removeItem('pv_impersonated_by')
    setSessionToken(null)
    setCurrentUser(null)
    setImpersonatedBy(null)
  }

  const isAuthenticated = !!currentUser && currentUser.accountStatus !== 'suspended'
  const isVerified = isAuthenticated && currentUser?.emailVerified === true
  const isAdmin = isAuthenticated && currentUser?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        sessionToken,
        impersonatedBy,
        isLoading,
        isAuthenticated,
        isVerified,
        isAdmin,
        login,
        register,
        googleLogin,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        impersonateUser,
        exitImpersonation,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
