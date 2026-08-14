// ──────────────────────────────────────────────
// ProfileVault — Admin Management IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { userRepo } from '../database/repositories/user.repo'
import { profileRepo } from '../database/repositories/profile.repo'
import { sessionManager, authorizeUser } from '../security/session'
import { emailService } from '../services/email.service'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'

export function setupAdminIPC(): void {
  // ── List / Search Users ──
  ipcMain.handle('admin:get-users', async (_event, sessionToken: string, filter?: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const users = userRepo.listUsers(filter)
      return { success: true, data: users }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Create New User Account (Admin Direct Creation) ──
  ipcMain.handle('admin:create-user', async (_event, sessionToken: string, input: { name: string; email: string; password: string; role?: 'admin' | 'user'; accountStatus?: 'active' | 'pending' | 'suspended'; emailVerified?: boolean }) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const { name, email, password, role = 'user', accountStatus = 'active', emailVerified = false } = input || {}
      if (!name || !email || !password) {
        return { success: false, error: 'Name, email, and password are required.' }
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' }
      }

      const existing = userRepo.getByEmail(email)
      if (existing) {
        return { success: false, error: 'An account with this email address already exists.' }
      }

      const newUser = userRepo.create({
        name,
        email,
        password,
        role,
        accountStatus,
        emailVerified
      })

      let verificationUrl: string | undefined
      let sentViaSmtp = false

      if (!emailVerified) {
        const result = await emailService.sendVerificationEmail(newUser.id, newUser.name, newUser.email)
        verificationUrl = result.verificationUrl
        sentViaSmtp = result.sentViaSmtp
      }

      logger.info('admin', `Admin "${auth.user.email}" created new user account "${newUser.email}" (Role: ${role}, Status: ${accountStatus})`)

      return {
        success: true,
        data: newUser,
        verificationUrl,
        sentViaSmtp,
        message: emailVerified
          ? `User "${newUser.name}" created successfully.`
          : `User "${newUser.name}" created. Verification email ${sentViaSmtp ? 'sent via SMTP' : 'generated'}.`
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Update User Account Status or Role ──
  ipcMain.handle('admin:update-user-status', async (_event, sessionToken: string, targetUserId: string, updateData: { status?: 'active' | 'pending' | 'suspended'; role?: 'admin' | 'user' }) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const targetUser = userRepo.getById(targetUserId)
      if (!targetUser) {
        return { success: false, error: 'Target user not found.' }
      }

      // Safety check: Prevent demoting or suspending the last remaining Admin account
      const adminCount = userRepo.countAdmins()
      if (targetUser.role === 'admin') {
        const isDemoting = updateData.role === 'user'
        const isSuspending = updateData.status === 'suspended'
        if ((isDemoting || isSuspending) && adminCount <= 1) {
          return { success: false, error: 'Operation rejected: Cannot demote or suspend the only remaining administrator account.' }
        }
      }

      // If user is suspended, invalidate active sessions
      if (updateData.status === 'suspended') {
        sessionManager.destroyUserSessions(targetUserId)
      }

      const updated = userRepo.update(targetUserId, {
        accountStatus: updateData.status,
        role: updateData.role
      })

      logger.info('admin', `Admin "${auth.user.email}" updated user "${targetUser.email}" status/role`, JSON.stringify(updateData))

      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Delete User ──
  ipcMain.handle('admin:delete-user', async (_event, sessionToken: string, targetUserId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const targetUser = userRepo.getById(targetUserId)
      if (!targetUser) {
        return { success: false, error: 'Target user not found.' }
      }

      // Safety check: Cannot delete last remaining admin
      if (targetUser.role === 'admin' && userRepo.countAdmins() <= 1) {
        return { success: false, error: 'Operation rejected: Cannot delete the only remaining administrator account.' }
      }

      sessionManager.destroyUserSessions(targetUserId)
      userRepo.delete(targetUserId)

      logger.info('admin', `Admin "${auth.user.email}" deleted user "${targetUser.email}" (${targetUserId})`)

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Admin Resend Verification Link ──
  ipcMain.handle('admin:resend-verification', async (_event, sessionToken: string, targetUserId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const targetUser = userRepo.getById(targetUserId)
      if (!targetUser) return { success: false, error: 'Target user not found.' }

      const result = await emailService.sendVerificationEmail(targetUser.id, targetUser.name, targetUser.email)
      logger.info('admin', `Admin "${auth.user.email}" sent verification email to "${targetUser.email}" (SMTP: ${result.sentViaSmtp})`)

      return {
        success: true,
        sentViaSmtp: result.sentViaSmtp,
        verificationUrl: result.verificationUrl,
        message: result.sentViaSmtp
          ? `Verification email sent via SMTP to ${targetUser.email}`
          : `Verification link generated for ${targetUser.email}`
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Get Profiles Owned by Specific User ──
  ipcMain.handle('admin:get-user-profiles', async (_event, sessionToken: string, targetUserId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const profiles = profileRepo.getAll(targetUserId)
      return { success: true, data: profiles }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Get System Audit Logs ──
  ipcMain.handle('admin:get-audit-logs', async (_event, sessionToken: string, limit = 100) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const db = getDatabase()
      const rows = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit)
      return { success: true, data: rows }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Admin Impersonate / Login As User ──
  ipcMain.handle('admin:impersonate-user', async (_event, sessionToken: string, targetUserId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const targetUserDisplay = userRepo.getDisplayById(targetUserId)
      if (!targetUserDisplay) {
        return { success: false, error: 'Target user not found.' }
      }

      if (targetUserDisplay.accountStatus === 'suspended') {
        return { success: false, error: 'Cannot log in as a suspended user account.' }
      }

      // Create new active session for target user
      const targetToken = sessionManager.createSession(targetUserDisplay)
      logger.info('admin', `Admin "${auth.user.email}" impersonating user "${targetUserDisplay.email}" (${targetUserId})`)

      return {
        success: true,
        token: targetToken,
        user: targetUserDisplay,
        originalAdminUser: auth.user
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── SMTP Configuration IPC ──
  ipcMain.handle('admin:get-smtp-config', async (_event, sessionToken: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    return { success: true, data: emailService.getSmtpConfig() }
  })

  ipcMain.handle('admin:save-smtp-config', async (_event, sessionToken: string, config: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    const updated = emailService.saveSmtpConfig(config)
    return { success: true, data: updated }
  })

  ipcMain.handle('admin:test-smtp-config', async (_event, sessionToken: string, config: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    const result = await emailService.testSmtpConfig(config)
    return result
  })
}
