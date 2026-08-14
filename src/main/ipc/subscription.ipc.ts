// ──────────────────────────────────────────────
// ProfileVault — Subscriptions & Licensing IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { subscriptionRepo } from '../database/repositories/subscription.repo'
import { authorizeUser } from '../security/session'
import { logger } from '../logging/logger'

export function setupSubscriptionIPC(): void {
  // Validate User License & Device Heartbeat
  ipcMain.handle('subscription:get-license-status', async (_event, sessionToken: string, installationId?: string, platform?: string, appVersion?: string) => {
    const auth = authorizeUser(sessionToken)
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Authentication required.' }
    }

    try {
      const license = subscriptionRepo.validateLicense(auth.user.id, installationId, platform, appVersion)
      return { success: true, data: license }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get User Active Devices
  ipcMain.handle('subscription:get-user-devices', async (_event, sessionToken: string) => {
    const auth = authorizeUser(sessionToken)
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Authentication required.' }
    }

    try {
      const devices = subscriptionRepo.getUserInstallations(auth.user.id)
      return { success: true, data: devices }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Revoke Device Installation
  ipcMain.handle('subscription:revoke-device', async (_event, sessionToken: string, installationId: string) => {
    const auth = authorizeUser(sessionToken)
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Authentication required.' }
    }

    try {
      subscriptionRepo.revokeInstallation(auth.user.id, installationId)
      logger.info('subscription', `User "${auth.user.email}" revoked device "${installationId}"`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Public Desktop Release Downloads & Platform Manifest
  ipcMain.handle('subscription:get-app-releases', async () => {
    try {
      const config = subscriptionRepo.getDesktopConfig()
      const manifest = subscriptionRepo.getAppUpdateManifest()
      return { success: true, data: config, manifest }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── ADMIN ROUTES ──

  // Admin Get Subscriptions List
  ipcMain.handle('admin:get-subscriptions', async (_event, sessionToken: string, filter?: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const list = subscriptionRepo.getAdminSubscriptions(filter)
      return { success: true, data: list }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Update User Subscription
  ipcMain.handle('admin:update-user-subscription', async (_event, sessionToken: string, targetUserId: string, updateData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const updated = subscriptionRepo.updateUserSubscription(targetUserId, updateData)
      logger.info('admin', `Admin "${auth.user.email}" updated subscription for user "${targetUserId}"`)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Get Desktop App Configuration
  ipcMain.handle('admin:get-desktop-app-config', async (_event, sessionToken: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const config = subscriptionRepo.getDesktopConfig()
      return { success: true, data: config }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Save Desktop App Configuration
  ipcMain.handle('admin:save-desktop-app-config', async (_event, sessionToken: string, entries: Record<string, string>) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const updated = subscriptionRepo.updateDesktopConfig(entries)
      logger.info('admin', `Admin "${auth.user.email}" updated desktop application release config`)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
