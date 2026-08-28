// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Global Launch URL IPC Handlers
// ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { launchUrlManager, GlobalLaunchUrlConfig } from '../browser/launch-url-manager'
import { authorizeUser } from '../security/session'

export function registerLaunchUrlHandlers(): void {
  // Public/User: Get active global launch URL configuration
  ipcMain.handle('launch-url:get-config', async () => {
    try {
      const config = launchUrlManager.getConfig()
      return { success: true, data: config }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin: Get launch URL configuration
  ipcMain.handle('admin:get-launch-url-config', async (_event, sessionToken: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin privileges required.' }
    }

    try {
      const config = launchUrlManager.getConfig()
      return { success: true, data: config }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin: Save launch URL configuration and automatically enroll profiles across all user accounts & devices
  ipcMain.handle(
    'admin:save-launch-url-config',
    async (_event, sessionToken: string, payload: Partial<GlobalLaunchUrlConfig> & { enrollNow?: boolean }) => {
      const auth = authorizeUser(sessionToken, { requireAdmin: true })
      if (auth.error || !auth.user) {
        return { success: false, error: auth.error || 'Admin privileges required.' }
      }

      try {
        const result = launchUrlManager.saveConfig(payload, auth.user.email)
        return {
          success: true,
          data: result.config,
          enrolledCount: result.enrolledCount,
          message: `Launch URL configuration saved. ${result.enrolledCount} profile(s) enrolled.`
        }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // Admin: Force immediate enrollment of all existing profiles to a specific URL
  ipcMain.handle('admin:enroll-all-launch-url', async (_event, sessionToken: string, launchUrl: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin privileges required.' }
    }

    try {
      const count = launchUrlManager.enrollAllProfiles(launchUrl)
      return { success: true, enrolledCount: count, message: `Enrolled ${count} profile(s) with launch URL.` }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
