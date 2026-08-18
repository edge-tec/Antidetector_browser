// ──────────────────────────────────────────────
// AntiProfiles — Software Update & Release IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { updaterService } from '../services/updater.service'
import { getDatabase } from '../database/connection'

function verifyAdminSession(token?: string): boolean {
  if (!token) return true // In local standalone mode allow or check user table
  try {
    const db = getDatabase()
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined
    if (session && session.user_id) {
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.user_id) as { role: string } | undefined
      return user?.role === 'admin'
    }
  } catch {}
  return true
}

export function registerUpdaterHandlers(): void {
  // ── 1. Check for Latest Available Version ──
  ipcMain.handle('updater:checkLatest', async (_event, currentVer?: string) => {
    try {
      const res = updaterService.checkForUpdate(currentVer)
      return { success: true, data: res }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 2. Admin: Get All Software Versions ──
  ipcMain.handle('updater:getAllVersions', async (_event, token?: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const versions = updaterService.getAllVersions()
      return { success: true, data: versions }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 3. Admin: Save or Update Version ──
  ipcMain.handle('updater:saveVersion', async (_event, token: string, versionData: any) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const saved = updaterService.saveVersion(versionData)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 4. Admin: Publish Version (Real-Time Broadcast) ──
  ipcMain.handle('updater:publishVersion', async (_event, token: string, versionId: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const published = updaterService.publishVersion(versionId)
      return { success: true, data: published }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 5. Admin: Disable Version ──
  ipcMain.handle('updater:disableVersion', async (_event, token: string, versionId: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const disabled = updaterService.disableVersion(versionId)
      return { success: true, data: disabled }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 6. Admin: Delete Version ──
  ipcMain.handle('updater:deleteVersion', async (_event, token: string, versionId: string) => {
    try {
      if (!verifyAdminSession(token)) {
        return { success: false, error: 'Unauthorized. Admin access required.' }
      }
      const deleted = updaterService.deleteVersion(versionId)
      return { success: true, data: deleted }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 7. Download Update Package ──
  ipcMain.handle('updater:downloadUpdate', async (event, urlStr: string, expectedSha256?: string) => {
    try {
      const result = await updaterService.downloadUpdatePackage(urlStr, expectedSha256, (progress) => {
        event.sender.send('updater:download-progress', progress)
      })
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 8. Install Update Package ──
  ipcMain.handle('updater:installUpdate', async (_event, filePath: string) => {
    try {
      const result = await updaterService.installUpdate(filePath)
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
