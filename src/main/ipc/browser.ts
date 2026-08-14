// ──────────────────────────────────────────────
// ProfileVault — IPC Browser Control Handlers
// ──────────────────────────────────────────────

import { ipcMain, BrowserWindow } from 'electron'
import { profileManager } from '../browser/profile-manager'
import { processTracker } from '../browser/process-tracker'
import { profileRepo } from '../database/repositories/profile.repo'
import { validateId } from '../security/validators'
import { logger } from '../logging/logger'

import { authorizeUser } from '../security/session'

export function registerBrowserHandlers(): void {
  ipcMain.handle('browser:start', async (event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) {
        return { success: false, error: auth.error || 'Authentication required' }
      }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      const result = await profileManager.startProfile(id)

      // Notify renderer of status change
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.webContents.send('profile:statusChanged', {
          profileId: id,
          status: 'running',
          pid: result.pid
        })
      }

      return { success: true, data: result }
    } catch (err: any) {
      logger.error('browser', `Failed to start profile: ${err.message}`)

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

  ipcMain.handle('browser:stop', async (event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) {
        return { success: false, error: auth.error || 'Authentication required' }
      }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
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
