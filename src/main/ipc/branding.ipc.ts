// ──────────────────────────────────────────────
// AntiProfiles — IPC Browser Branding Handlers
// ──────────────────────────────────────────────

import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import { BrowserIconManager, BrandingTarget, BrowserEngineType } from '../browser/branding/browser-icon-manager'
import { logger } from '../logging/logger'

export function registerBrandingHandlers(): void {
  // Get all branding configuration and preview URLs
  ipcMain.handle('branding:getConfig', async () => {
    try {
      const config = BrowserIconManager.getBrandingConfig()
      return { success: true, data: config }
    } catch (err: any) {
      logger.error('admin', `Failed to get branding config: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // Open file picker dialog and upload custom icon
  ipcMain.handle('branding:selectAndUploadIcon', async (_event, target: BrandingTarget) => {
    try {
      const result = await dialog.showOpenDialog({
        title: `Select Custom ${target.toUpperCase()} Icon`,
        properties: ['openFile'],
        filters: [
          { name: 'Images / Icons', extensions: ['png', 'jpg', 'jpeg', 'ico', 'icns', 'webp'] }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      const filePath = result.filePaths[0]
      const fileBuffer = fs.readFileSync(filePath)
      const res = await BrowserIconManager.uploadCustomIcon(target, fileBuffer, filePath)
      return res
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Upload custom icon from buffer / base64
  ipcMain.handle('branding:uploadIcon', async (_event, target: BrandingTarget, base64Data: string, filename: string) => {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(cleanBase64, 'base64')
      const res = await BrowserIconManager.uploadCustomIcon(target, buffer, filename)
      return res
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Reset custom icon to bundled default
  ipcMain.handle('branding:resetIcon', async (_event, target: BrandingTarget) => {
    try {
      const res = BrowserIconManager.resetCustomIcon(target)
      return res
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Resolve icon for profile / engine
  ipcMain.handle('branding:resolveIcon', async (_event, engine: BrowserEngineType, profileId?: string) => {
    try {
      const resolved = BrowserIconManager.resolveIcon(engine, profileId ? { id: profileId } : null)
      return { success: true, data: resolved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Set per-profile custom icon via file picker
  ipcMain.handle('branding:selectProfileIcon', async (_event, profileId: string) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Custom Profile Icon',
        properties: ['openFile'],
        filters: [
          { name: 'Images / Icons', extensions: ['png', 'jpg', 'jpeg', 'ico', 'webp'] }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      const filePath = result.filePaths[0]
      const fileBuffer = fs.readFileSync(filePath)
      const res = await BrowserIconManager.setProfileIcon(profileId, fileBuffer, filePath)
      return res
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Reset per-profile custom icon
  ipcMain.handle('branding:resetProfileIcon', async (_event, profileId: string) => {
    try {
      const res = BrowserIconManager.resetProfileIcon(profileId)
      return res
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
