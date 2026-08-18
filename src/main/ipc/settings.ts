// ──────────────────────────────────────────────
// AntiProfiles — IPC Settings & System Handlers
// ──────────────────────────────────────────────

import { ipcMain, app, shell, dialog } from 'electron'
import { getDatabase } from '../database/connection'
import { profileManager } from '../browser/profile-manager'
import { findChromiumPath, findFirefoxPath, detectAllBrowsers, testBrowserExecutable, runBrowserDiagnostics } from '../browser/chromium-resolver'
import { startApiServer, stopApiServer, isApiRunning, getApiToken } from '../automation/server'
import { getManagedChromiumStatus, downloadAndInstallManagedChromium, getManagedRuntimeDir } from '../browser/chromium-downloader'
import { getManagedFirefoxStatus, downloadAndInstallManagedFirefox, getManagedFirefoxDir } from '../browser/firefox-downloader'
import fs from 'fs'

export function registerSettingsHandlers(): void {
  // ── Browser Runtime Manager IPC Handlers ──
  ipcMain.handle('runtime:getStatus', async () => {
    try {
      const chromium = await getManagedChromiumStatus()
      const firefox = await getManagedFirefoxStatus()
      return {
        success: true,
        data: {
          platform: process.platform,
          arch: process.arch,
          chromium,
          firefox
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('runtime:install', async (_event, engine: 'chromium' | 'firefox') => {
    try {
      if (engine === 'firefox') {
        const p = await downloadAndInstallManagedFirefox()
        return { success: true, data: { engine, executablePath: p } }
      } else {
        const p = await downloadAndInstallManagedChromium()
        return { success: true, data: { engine, executablePath: p } }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('runtime:verify', async (_event, engine: 'chromium' | 'firefox') => {
    try {
      const status = engine === 'firefox' ? await getManagedFirefoxStatus() : await getManagedChromiumStatus()
      if (!status.installed || !status.executablePath) {
        return { success: false, error: `${engine.toUpperCase()} runtime is not installed.` }
      }
      const testRes = await testBrowserExecutable(status.executablePath)
      return { success: true, data: testRes }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('runtime:repair', async (_event, engine: 'chromium' | 'firefox') => {
    try {
      if (engine === 'firefox') {
        const dir = getManagedFirefoxDir()
        try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
        const p = await downloadAndInstallManagedFirefox()
        return { success: true, data: { engine, executablePath: p } }
      } else {
        const dir = getManagedRuntimeDir()
        try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
        const p = await downloadAndInstallManagedChromium()
        return { success: true, data: { engine, executablePath: p } }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  // ── Settings ──
  ipcMain.handle('settings:getAll', async () => {
    try {
      const db = getDatabase()
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
      const settings: Record<string, string> = {}
      for (const row of rows) {
        settings[row.key] = row.value
      }
      return { success: true, data: settings }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:update', async (_event, key: string, value: string) => {
    try {
      const db = getDatabase()
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:chromiumPath', async () => {
    return { success: true, data: profileManager.getChromiumPath() }
  })

  ipcMain.handle('settings:setChromiumPath', async (_event, path: string) => {
    try {
      await profileManager.setChromiumPath(path)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:firefoxPath', async () => {
    return { success: true, data: profileManager.getFirefoxPath() }
  })

  ipcMain.handle('settings:setFirefoxPath', async (_event, path: string) => {
    try {
      await profileManager.setFirefoxPath(path)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:autoDetectBrowser', async () => {
    try {
      const detectedChrome = await findChromiumPath()
      const detectedFirefox = await findFirefoxPath()
      const all = await detectAllBrowsers()
      if (detectedChrome) {
        await profileManager.setChromiumPath(detectedChrome)
      }
      if (detectedFirefox) {
        await profileManager.setFirefoxPath(detectedFirefox)
      }
      return { success: true, data: { detectedPath: detectedChrome, detectedFirefox, allBrowsers: all } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:testBrowser', async (_event, executablePath: string) => {
    try {
      const result = await testBrowserExecutable(executablePath)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:browserDiagnostics', async () => {
    try {
      const currentPath = profileManager.getChromiumPath()
      const result = await runBrowserDiagnostics(currentPath || undefined)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Automation API ──
  ipcMain.handle('api:getToken', async () => {
    try {
      return { success: true, data: getApiToken() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('api:rotateToken', async () => {
    try {
      const token = rotateApiToken()
      logger.info('api', 'API token rotated')
      return { success: true, data: token }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('api:start', async () => {
    try {
      const db = getDatabase()
      const portRow = db.prepare("SELECT value FROM settings WHERE key = 'apiPort'").get() as { value: string } | undefined
      const port = parseInt(portRow?.value || '37100', 10)
      startApiServer(port)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('api:stop', async () => {
    try {
      stopApiServer()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('api:isRunning', async () => {
    return { success: true, data: isApiRunning() }
  })

  // ── Logs ──
  ipcMain.handle('logs:getAll', async (_event, limit?: number, level?: string, category?: string) => {
    try {
      const db = getDatabase()
      let query = 'SELECT * FROM logs WHERE 1=1'
      const params: any[] = []

      if (level) { query += ' AND level = ?'; params.push(level) }
      if (category) { query += ' AND category = ?'; params.push(category) }

      query += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit || 200)

      const rows = db.prepare(query).all(...params)
      return { success: true, data: rows }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('logs:clear', async () => {
    try {
      const db = getDatabase()
      db.prepare('DELETE FROM logs').run()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── System ──
  ipcMain.handle('system:version', async () => {
    return { success: true, data: app.getVersion() }
  })

  ipcMain.handle('system:openExternal', async (_event, url: string) => {
    // Only allow http/https URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'Only HTTP/HTTPS URLs are allowed' }
    }
    await shell.openExternal(url)
    return { success: true }
  })

  ipcMain.handle('system:selectFile', async (_event, filters?: any[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    })
    if (result.canceled) return { success: false, error: 'Canceled' }
    return { success: true, data: result.filePaths[0] }
  })

  ipcMain.handle('system:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) return { success: false, error: 'Canceled' }
    return { success: true, data: result.filePaths[0] }
  })
}
