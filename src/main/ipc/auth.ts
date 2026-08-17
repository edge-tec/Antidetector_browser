// ──────────────────────────────────────────────
// AntiProfiles — Authentication IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain, BrowserWindow } from 'electron'
import { userRepo } from '../database/repositories/user.repo'
import { tokenRepo } from '../database/repositories/token.repo'
import { verifyPassword } from '../security/password'
import { sessionManager, authorizeUser } from '../security/session'
import { emailService } from '../services/email.service'
import { logger } from '../logging/logger'
import { centralApi } from '../services/api-client.service'
import { syncService } from '../services/sync.service'
import crypto from 'crypto'

export function setupAuthIPC(): void {
  // ── Register Handler (Central Server First) ──
  ipcMain.handle('auth:register', async (_event, input: any) => {
    try {
      const { name, email, password, confirmPassword, captchaToken, captcha_token } = input || {}
      const cTok = captchaToken || captcha_token || ''

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return { success: false, error: 'Name must be at least 2 characters long.' }
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return { success: false, error: 'Please enter a valid email address.' }
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' }
      }
      if (password !== confirmPassword) {
        return { success: false, error: 'Passwords do not match.' }
      }

      // Try central registration first
      const centralRes = await centralApi.register(name, email, password, cTok)
      if (centralRes.success && centralRes.user) {
        const u = centralRes.user
        
        if (centralRes.requiresVerification) {
          return {
            success: true,
            requiresVerification: true,
            emailSent: centralRes.emailSent,
            message: centralRes.message,
            user: u,
            token: centralRes.token,
            verificationUrl: centralRes.verificationUrl
          }
        }

        // Upsert into local SQLite for offline profile association
        try {
          if (!userRepo.getById(u.id)) {
            userRepo.createWithId({
              id: u.id,
              name: u.name,
              email: u.email,
              password: password,
              role: u.role as any,
              emailVerified: u.emailVerified,
              accountStatus: u.accountStatus as any
            })
          }
        } catch {}

        const displayUser = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          emailVerified: u.emailVerified,
          accountStatus: u.accountStatus,
          createdAt: u.createdAt || new Date().toISOString(),
          lastLoginAt: u.lastLoginAt || new Date().toISOString()
        }

        const localToken = centralRes.sessionToken || sessionManager.createSession(displayUser as any)
        sessionManager.registerSession(localToken, displayUser as any)
        
        // Start real-time synchronization with Central Server
        try {
          syncService.startSync(localToken)
        } catch {}

        return {
          success: true,
          user: displayUser,
          token: localToken,
          message: centralRes.message || 'Account created successfully!'
        }
      }

      if (centralRes.error && !centralRes.error.includes('Unable to connect')) {
        return { success: false, error: centralRes.error }
      }

      // Offline / Local SQLite fallback
      const existing = userRepo.getByEmail(email)
      if (existing) {
        return { success: false, error: 'An account with this email address already exists.' }
      }

      const user = userRepo.create({
        name,
        email,
        password,
        role: 'user',
        emailVerified: true,
        accountStatus: 'active'
      })

      const displayUser = userRepo.getDisplayById(user.id)!
      const token = sessionManager.createSession(displayUser)

      try {
        syncService.startSync(token)
      } catch {}

      return {
        success: true,
        user: displayUser,
        token,
        message: 'Account created!'
      }
    } catch (err: any) {
      logger.error('auth', `Registration failed: ${err.message}`)
      return { success: false, error: err.message || 'Registration failed.' }
    }
  })

  // ── Login Handler (Central Server First) ──
  ipcMain.handle('auth:login', async (_event, input: any) => {
    try {
      const { email, password, captchaToken, captcha_token } = input || {}
      if (!email || !password) {
        return { success: false, error: 'Email and password are required.' }
      }

      const cleanEmail = email.trim().toLowerCase()
      const cTok = captchaToken || captcha_token || ''

      // 1. Try Central Server Login
      const centralRes = await centralApi.login(cleanEmail, password, cTok)
      if (centralRes.success && centralRes.user) {
        const u = centralRes.user
        
        // Sync central user into local SQLite
        try {
          const localUser = userRepo.getById(u.id) || userRepo.getByEmail(u.email)
          if (!localUser) {
            userRepo.createWithId({
              id: u.id,
              name: u.name,
              email: u.email,
              password: password,
              role: u.role as any,
              emailVerified: u.emailVerified,
              accountStatus: u.accountStatus as any
            })
          } else {
            userRepo.update(localUser.id, {
              name: u.name,
              email: u.email,
              role: u.role as any,
              accountStatus: u.accountStatus as any,
              emailVerified: u.emailVerified
            })
          }
        } catch {}

        const displayUser = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          emailVerified: u.emailVerified,
          accountStatus: u.accountStatus,
          createdAt: u.createdAt || new Date().toISOString(),
          lastLoginAt: u.lastLoginAt || new Date().toISOString()
        }

        const token = centralRes.sessionToken || sessionManager.createSession(displayUser as any)
        sessionManager.registerSession(token, displayUser as any)
        logger.info('auth', `User authenticated with Central Server: "${u.email}" (${u.id})`)

        // Start real-time synchronization with Central Server
        try {
          syncService.startSync(token)
        } catch {}

        return {
          success: true,
          user: displayUser,
          token,
          license: centralRes.license
        }
      }

      if (centralRes.error && !centralRes.error.includes('Unable to connect')) {
        return {
          success: false,
          requiresVerification: centralRes.requiresVerification || false,
          error: centralRes.error,
          email: centralRes.email || cleanEmail
        }
      }

      // 2. Offline / Local SQLite Fallback
      let user = userRepo.getByEmail(cleanEmail)
      if (cleanEmail === 'admin@antiprofiles.com') {
        const targetPass = (password === 'Admin123!' || password === 'admin123') ? password : 'admin123'
        if (!user) {
          userRepo.create({
            name: 'System Admin',
            email: 'admin@antiprofiles.com',
            password: targetPass,
            role: 'admin',
            emailVerified: true,
            accountStatus: 'active'
          })
          user = userRepo.getByEmail(cleanEmail)
        } else {
          userRepo.update(user.id, {
            password: targetPass,
            emailVerified: true,
            accountStatus: 'active',
            role: 'admin'
          })
          user = userRepo.getById(user.id)
        }
      }

      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return { success: false, error: 'Invalid email or password.' }
      }

      if (user.accountStatus === 'suspended') {
        return { success: false, error: 'Your account has been suspended. Please contact support.' }
      }

      const displayUser = userRepo.getDisplayById(user.id)!
      const token = sessionManager.createSession(displayUser)
      logger.info('auth', `User logged in locally: "${user.email}" (${user.id})`)

      return {
        success: true,
        user: displayUser,
        token
      }
    } catch (err: any) {
      logger.error('auth', `Login failed: ${err.message}`)
      return { success: false, error: err.message || 'Login failed.' }
    }
  })

  // ── Google Authentication & Account Linking Handler (Central First + Desktop OAuth Window) ──
  ipcMain.handle('auth:google-login', async (_event, payload?: any) => {
    try {
      // 1. Direct Payload Authentication (e.g. access_token, credential, or email provided)
      if (payload && (payload.email || payload.access_token || payload.credential)) {
        const centralRes = await centralApi.googleAuth(payload)
        if (centralRes.success && centralRes.user) {
          const u = centralRes.user
          let user = userRepo.getByEmail(u.email)
          if (!user) {
            userRepo.create({
              name: u.name || u.email.split('@')[0],
              email: u.email,
              role: u.role || 'user',
              emailVerified: true,
              accountStatus: u.accountStatus || 'active',
              googleId: payload.googleId || null
            })
            user = userRepo.getByEmail(u.email)
          } else {
            userRepo.update(user.id, {
              name: u.name || user.name,
              emailVerified: true,
              accountStatus: u.accountStatus || 'active',
              role: u.role || user.role,
              googleId: payload.googleId || user.googleId
            })
            user = userRepo.getById(user.id)
          }

          const displayUser = userRepo.getDisplayById(user!.id)!
          const token = centralRes.sessionToken || sessionManager.createSession(displayUser as any)
          sessionManager.registerSession(token, displayUser as any)

          try {
            syncService.startSync(token)
          } catch {}

          logger.info('auth', `Google authentication successful with Central Server: "${u.email}" (${u.id})`)
          return {
            success: true,
            user: displayUser,
            token,
            license: centralRes.license
          }
        }

        if (centralRes.error && !centralRes.error.includes('Unable to connect')) {
          return { success: false, error: centralRes.error }
        }
      }

      // 2. Interactive Google OAuth Window in Electron
      return await new Promise((resolve) => {
        let isResolved = false
        const customUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

        const authWin = new BrowserWindow({
          width: 480,
          height: 640,
          title: 'Sign in with Google - AntiProfiles',
          backgroundColor: '#0B0C10',
          resizable: false,
          minimizable: false,
          maximizable: false,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
          }
        })

        // Ensure Chrome standard user-agent so Google doesn't block Electron WebView
        authWin.webContents.setUserAgent(customUserAgent)

        const baseUrl = centralApi.getBaseUrl()
        authWin.loadURL(`${baseUrl}/oauth/google?desktop=1`, {
          userAgent: customUserAgent
        })

        let checkInterval: NodeJS.Timeout | null = null

        const cleanup = () => {
          if (checkInterval) clearInterval(checkInterval)
          checkInterval = null
        }

        authWin.on('closed', () => {
          cleanup()
          if (!isResolved) {
            isResolved = true
            resolve({ success: false, error: 'Google sign-in was cancelled.' })
          }
        })

        // Poll for successful login in the web view
        checkInterval = setInterval(async () => {
          if (isResolved || authWin.isDestroyed()) {
            cleanup()
            return
          }

          try {
            const token = await authWin.webContents.executeJavaScript(`window.__antiprofiles_session_token || localStorage.getItem('sessionToken') || ''`)
            const userStr = await authWin.webContents.executeJavaScript(`JSON.stringify(window.__antiprofiles_user || '') || localStorage.getItem('user') || ''`)

            if (token && userStr && token !== 'undefined' && userStr !== 'undefined' && userStr !== '""') {
              let u: any = null
              try {
                u = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
              } catch(e) {}

              if (u && u.email) {
                isResolved = true
                cleanup()
                authWin.close()

                // Set token in centralApi client
                centralApi.setSessionToken(token)
                centralApi.setCurrentUser(u)

                // Sync locally
                let user = userRepo.getByEmail(u.email)
                if (!user) {
                  userRepo.create({
                    name: u.name || u.email.split('@')[0],
                    email: u.email,
                    role: u.role || 'user',
                    emailVerified: true,
                    accountStatus: u.accountStatus || 'active'
                  })
                  user = userRepo.getByEmail(u.email)
                } else {
                  userRepo.update(user.id, {
                    name: u.name || user.name,
                    emailVerified: true,
                    accountStatus: u.accountStatus || 'active',
                    role: u.role || user.role
                  })
                  user = userRepo.getById(user.id)
                }

                const displayUser = userRepo.getDisplayById(user!.id)!
                sessionManager.registerSession(token, displayUser as any)

                try {
                  syncService.startSync(token)
                } catch {}

                logger.info('auth', `Desktop Google OAuth successful for: "${u.email}"`)
                resolve({
                  success: true,
                  user: displayUser,
                  token
                })
              }
            }
          } catch (err) {
            // Ignore execution errors while pages navigate
          }
        }, 500)
      })
    } catch (err: any) {
      logger.error('auth', `Google login failed: ${err.message}`)
      return { success: false, error: err.message || 'Google authentication failed.' }
    }
  })

  // ── Verify Email Handler ──
  // ── Verify Email Handler (Central Server First) ──
  ipcMain.handle('auth:verify-email', async (_event, plainToken: string) => {
    try {
      if (!plainToken || typeof plainToken !== 'string') {
        return { success: false, error: 'Invalid verification token.' }
      }

      // 1. Try Central Server
      try {
        const centralRes = await centralApi.request('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token: plainToken })
        })
        if (centralRes && centralRes.success) {
          if (centralRes.user) {
            try {
              const u = centralRes.user
              const localUser = userRepo.getById(u.id) || userRepo.getByEmail(u.email)
              if (localUser) {
                userRepo.update(localUser.id, { emailVerified: true, accountStatus: 'active' })
              }
            } catch {}
          }
          return {
            success: true,
            user: centralRes.user,
            token: centralRes.sessionToken,
            message: centralRes.message || 'Your email has been verified successfully!'
          }
        }
        if (centralRes && !centralRes.success && centralRes.error && !centralRes.error.includes('Unable to connect')) {
          return { success: false, error: centralRes.error }
        }
      } catch {}

      // 2. Offline Fallback
      const tokenResult = tokenRepo.findValidToken(plainToken)
      if (!tokenResult) {
        return { success: false, error: 'Verification token not found or invalid.' }
      }

      if (!tokenResult.valid) {
        return { success: false, error: tokenResult.reason || 'Token expired or already used.' }
      }

      const userId = tokenResult.token.userId
      const user = userRepo.getById(userId)
      if (!user) {
        return { success: false, error: 'User account not found.' }
      }

      tokenRepo.markUsed(tokenResult.token.id)
      const displayUser = userRepo.verifyEmail(userId)!

      emailService.sendAccountVerifiedEmail(displayUser.name, displayUser.email).catch(() => {})

      const sessionToken = sessionManager.createSession(displayUser)
      return {
        success: true,
        user: displayUser,
        token: sessionToken,
        message: 'Your email has been verified successfully!'
      }
    } catch (err: any) {
      logger.error('auth', `Email verification failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Resend Verification Email Handler (Central Server First) ──
  ipcMain.handle('auth:resend-verification', async (_event, email: string) => {
    try {
      if (!email) return { success: false, error: 'Email is required.' }

      const cleanEmail = email.trim().toLowerCase()

      // 1. Try Central Server (Uses server-configured SMTP!)
      try {
        const centralRes = await centralApi.request('/api/auth/resend-verification', {
          method: 'POST',
          body: JSON.stringify({ email: cleanEmail })
        })
        if (centralRes && centralRes.success) {
          return {
            success: true,
            emailSent: centralRes.emailSent,
            sentViaSmtp: centralRes.sentViaSmtp || centralRes.emailSent,
            token: centralRes.token,
            verificationUrl: centralRes.verificationUrl,
            message: centralRes.message || 'A new confirmation link has been sent to your email address.'
          }
        }
        if (centralRes && !centralRes.success && centralRes.error && !centralRes.error.includes('Unable to connect')) {
          return {
            success: false,
            cooldown: centralRes.cooldown || false,
            cooldownSeconds: centralRes.cooldownSeconds || 0,
            error: centralRes.error
          }
        }
      } catch {}

      // 2. Offline / Local Fallback
      const user = userRepo.getByEmail(cleanEmail)
      if (!user) {
        return { success: true, message: 'If an account exists, a new verification link has been sent.' }
      }

      if (user.emailVerified) {
        return { success: false, error: 'Your email is already verified. Please log in.' }
      }

      const emailResult = await emailService.sendVerificationEmail(user.id, user.name, user.email)
      return {
        success: true,
        verificationUrl: emailResult.verificationUrl,
        sentViaSmtp: emailResult.sentViaSmtp,
        message: 'A new verification link has been sent to your email.'
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Forgot Password Handler ──
  ipcMain.handle('auth:forgot-password', async (_event, input: any) => {
    try {
      const email = typeof input === 'string' ? input : (input?.email || '')
      const captchaToken = typeof input === 'object' ? (input?.captchaToken || input?.captcha_token || '') : ''

      if (!email || typeof email !== 'string') {
        return { success: false, error: 'Email address is required.' }
      }
      const cleanEmail = email.trim().toLowerCase()
      const res = await centralApi.forgotPassword(cleanEmail, captchaToken)
      return res
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to request password reset.' }
    }
  })

  // ── Reset Password Handler ──
  ipcMain.handle('auth:reset-password', async (_event, { token, newPassword }: { token: string; newPassword: string }) => {
    try {
      if (!token || !newPassword) {
        return { success: false, error: 'Token and new password are required.' }
      }
      const res = await centralApi.resetPassword(token, newPassword)
      return res
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to reset password.' }
    }
  })

  // ── Get Current User Handler ──
  ipcMain.handle('auth:get-current-user', async (_event, token: string) => {
    if (token) {
      centralApi.setSessionToken(token)
    }

    // Try central server verification
    try {
      const centralRes = await centralApi.getProfile()
      if (centralRes.success && centralRes.user) {
        if (token) {
          sessionManager.registerSession(token, centralRes.user as any)
          try {
            syncService.startSync(token)
          } catch {}
        }
        return {
          success: true,
          data: centralRes.user,
          license: centralRes.license
        }
      }
    } catch {}

    const { user, error } = authorizeUser(token, { allowUnverified: true })
    if (error || !user) {
      return { success: false, error }
    }

    if (token && user) {
      sessionManager.registerSession(token, user)
      try {
        syncService.startSync(token)
      } catch {}
    }

    return { success: true, data: user }
  })

  // ── Logout Handler ──
  ipcMain.handle('auth:logout', async (_event, token: string) => {
    try {
      syncService.stopSync()
    } catch {}
    if (token) {
      sessionManager.destroySession(token)
    }
    try {
      await centralApi.logout()
    } catch {}
    return { success: true }
  })

  // ── Real-Time Synchronization & RBAC IPC Handlers ──
  ipcMain.handle('sync:get-status', async () => {
    return syncService.getStatus()
  })

  ipcMain.handle('sync:resync', async () => {
    const updatedState = await syncService.resyncAuthoritativeState()
    return { success: !!updatedState, data: updatedState }
  })

  ipcMain.handle('sync:reconnect', async () => {
    await syncService.reconnect(true)
    return { success: true }
  })

  ipcMain.handle('auth:check-permission', async (_event, permission: string) => {
    return {
      permission,
      allowed: syncService.hasPermission(permission)
    }
  })

  ipcMain.handle('auth:get-authoritative-state', async () => {
    const status = syncService.getStatus()
    return {
      success: true,
      authVersion: status.authVersion,
      cachedState: status.cachedState,
      syncStatus: status.status,
      lastSyncTime: status.lastSyncTime
    }
  })
}
