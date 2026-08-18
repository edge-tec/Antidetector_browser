// ──────────────────────────────────────────────
// AntiProfiles — IPC Browser Control Handlers
// ──────────────────────────────────────────────

import { ipcMain, BrowserWindow } from 'electron'
import { profileManager } from '../browser/profile-manager'
import { processTracker } from '../browser/process-tracker'
import { profileRepo } from '../database/repositories/profile.repo'
import { validateId } from '../security/validators'
import { logger } from '../logging/logger'

import { authorizeUser, normalizeUserRole } from '../security/session'

export function registerBrowserHandlers(): void {
  ipcMain.handle('browser:start', async (event, sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const sessionToken = maybeId ? sessionTokenOrId : ''

    logger.info('browser', `[PROFILE_START_CLICKED] Profile start requested for ID: "${id}"`)

    try {
      logger.info('browser', `[AUTH_STATE_CHECK] Validating session token for profile "${id}"`)
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) {
        logger.warn('browser', `[PROFILE_ACCESS_DENIED] Authentication check failed: ${auth.error || 'Authentication required'}`)
        return { success: false, error: auth.error || 'Authentication required. Please log in.' }
      }

      validateId(id)
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        logger.warn('browser', `[PROFILE_ACCESS_DENIED] User "${auth.user.email}" (${auth.user.id}) denied access to profile "${id}"`)
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      logger.info('browser', `[PROFILE_AUTHORIZED] User "${auth.user.email}" authorized to run profile "${id}"`)
      logger.info('browser', `[BROWSER_LAUNCH_STARTED] Launching Chromium process for profile "${id}"`)
      const result = await profileManager.startProfile(id)
      logger.info('browser', `[BROWSER_LAUNCH_SUCCESS] Profile "${id}" is running (PID: ${result.pid})`)

      // Notify renderer of status change
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.webContents.send('profile:statusChanged', {
          profileId: id,
          status: 'running',
          pid: result.pid
        })
      }

      // Sync status to Central Backend
      try {
        centralApi.setProfileStatus(id, 'running').catch(() => {})
      } catch {}

      return { success: true, data: result }
    } catch (err: any) {
      logger.error('browser', `[BROWSER_LAUNCH_FAILED] Failed to start profile "${id}": ${err.message}`)

      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.webContents.send('profile:statusChanged', {
          profileId: id,
          status: 'error',
          error: err.message
        })
      }

      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('browser:stop', async (event, sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const sessionToken = maybeId ? sessionTokenOrId : ''

    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) {
        return { success: false, error: auth.error || 'Authentication required. Please log in.' }
      }

      validateId(id)
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      await profileManager.stopProfile(id)

      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.webContents.send('profile:statusChanged', {
          profileId: id,
          status: 'stopped'
        })
      }

      // Sync status to Central Backend
      try {
        centralApi.setProfileStatus(id, 'stopped').catch(() => {})
      } catch {}

      return { success: true }
    } catch (err: any) {
      logger.error('browser', `Failed to stop profile: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('browser:status', async (_event, id: string) => {
    try {
      validateId(id)
      const isRunning = processTracker.isRunning(id)
      const info = processTracker.getInfo(id)
      const profile = profileRepo.getById(id)

      return {
        success: true,
        data: {
          profileId: id,
          status: profile?.status || 'stopped',
          isRunning,
          ...(info ? {
            pid: info.pid,
            wsEndpoint: info.wsEndpoint,
            startedAt: info.startedAt.toISOString()
          } : {})
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('browser:runningCount', async () => {
    return { success: true, data: processTracker.getRunningCount() }
  })

  ipcMain.handle('dashboard:stats', async () => {
    try {
      const stats = profileRepo.getStats()
      return { success: true, data: stats }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
