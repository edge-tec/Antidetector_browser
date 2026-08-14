// ──────────────────────────────────────────────
// ProfileVault — IPC Profile Handlers (With Authorization & Ownership Isolation)
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { profileRepo } from '../database/repositories/profile.repo'
import { profileManager } from '../browser/profile-manager'
import { validateProfileName, validateId } from '../security/validators'
import { authorizeUser } from '../security/session'
import { logger } from '../logging/logger'

export function registerProfileHandlers(): void {
  ipcMain.handle('profiles:getAll', async (_event, sessionToken?: string, search?: string, groupId?: string, status?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) {
        return { success: false, error: auth.error || 'Authentication required' }
      }
      const filterUserId = auth.user.role === 'admin' ? undefined : auth.user.id
      return { success: true, data: profileRepo.getAll(filterUserId, search, groupId, status) }
    } catch (err: any) {
      logger.error('profile', `Failed to get profiles: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:getById', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      const profile = profileRepo.getById(id)
      if (!profile) return { success: false, error: 'Profile not found' }

      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      return { success: true, data: profile }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:create', async (_event, sessionToken: string, input: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateProfileName(input.name)
      const profile = profileManager.createProfile(input, auth.user.id)
      return { success: true, data: profile }
    } catch (err: any) {
      logger.error('profile', `Failed to create profile: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:update', async (_event, sessionToken: string, id: string, input: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      if (input.name) validateProfileName(input.name)
      const profile = profileRepo.update(id, input)
      if (!profile) return { success: false, error: 'Profile not found' }
      return { success: true, data: profile }
    } catch (err: any) {
      logger.error('profile', `Failed to update profile: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:delete', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      await profileManager.deleteProfile(id)
      return { success: true }
    } catch (err: any) {
      logger.error('profile', `Failed to delete profile: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:duplicate', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      const profile = profileManager.duplicateProfile(id, auth.user.id)
      if (!profile) return { success: false, error: 'Profile not found' }
      return { success: true, data: profile }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:export', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      const data = profileManager.exportProfile(id)
      if (!data) return { success: false, error: 'Profile not found' }
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:import', async (_event, sessionToken: string, data: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      const profile = profileManager.importProfile(data, auth.user.id)
      return { success: true, data: profile }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:getSize', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      if (!profileRepo.verifyOwnership(id, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      return { success: true, data: profileManager.getProfileSize(id) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
