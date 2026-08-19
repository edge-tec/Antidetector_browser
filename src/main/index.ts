// ──────────────────────────────────────────────
// AntiProfiles — Main Process Entry Point
// ──────────────────────────────────────────────

import { app, BrowserWindow, shell, nativeTheme } from 'electron'
import path from 'path'
import { initDatabase, closeDatabase, getDatabase } from './database/connection'
import { profileManager } from './browser/profile-manager'
import { registerProfileHandlers } from './ipc/profiles'
import { registerBrowserHandlers } from './ipc/browser'
import { registerProxyHandlers } from './ipc/proxies'
import { registerGroupHandlers } from './ipc/groups'
import { registerSettingsHandlers } from './ipc/settings'
import { registerFingerprintIPC } from './ipc/fingerprint.ipc'
import { setupAuthIPC } from './ipc/auth'
import { setupAdminIPC } from './ipc/admin'
import { setupLandingIPC } from './ipc/landing'
import { setupSubscriptionIPC } from './ipc/subscription.ipc'
import { setupSupportIPC } from './ipc/support.ipc'
import { registerSeoHandlers } from './ipc/seo.ipc'
import { registerUpdaterHandlers } from './ipc/updater'
import { registerAffiliateHandlers } from './ipc/affiliate.ipc'
import { registerBrandingHandlers } from './ipc/branding.ipc'
import { logger } from './logging/logger'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'AntiProfiles',
    icon: path.join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0F0F14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Show window when ready to avoid flash
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Safety fallback: Ensure window is shown even if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 400)

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  logger.info('system', 'AntiProfiles starting...')

  // Initialize database
  try {
    initDatabase()
    logger.info('system', 'Database initialized')

    // Connect logger to database
    const db = getDatabase()
    const insertLog = db.prepare('INSERT INTO logs (level, category, message, details) VALUES (?, ?, ?, ?)')
    logger.setDbStatement((level, category, message, details) => {
      try {
        insertLog.run(level, category, message, details)
      } catch {
        // Ignore DB logging errors
      }
    })
  } catch (err: any) {
    logger.error('system', `Database initialization failed: ${err.message}`)
  }

  // Register IPC handlers safely
  try { setupAuthIPC() } catch (err: any) { logger.error('system', `Auth IPC failed: ${err.message}`) }
  try { setupAdminIPC() } catch (err: any) { logger.error('system', `Admin IPC failed: ${err.message}`) }
  try { setupLandingIPC() } catch (err: any) { logger.error('system', `Landing IPC failed: ${err.message}`) }
  try { setupSubscriptionIPC() } catch (err: any) { logger.error('system', `Subscription IPC failed: ${err.message}`) }
  try { setupSupportIPC() } catch (err: any) { logger.error('system', `Support IPC failed: ${err.message}`) }
  try { registerSeoHandlers() } catch (err: any) { logger.error('system', `SEO IPC failed: ${err.message}`) }
  try { registerUpdaterHandlers() } catch (err: any) { logger.error('system', `Updater IPC failed: ${err.message}`) }
  try { registerAffiliateHandlers() } catch (err: any) { logger.error('system', `Affiliate IPC failed: ${err.message}`) }
  try { registerProfileHandlers() } catch (err: any) { logger.error('system', `Profile IPC failed: ${err.message}`) }
  try { registerBrowserHandlers() } catch (err: any) { logger.error('system', `Browser IPC failed: ${err.message}`) }
  try { registerProxyHandlers() } catch (err: any) { logger.error('system', `Proxy IPC failed: ${err.message}`) }
  try { registerGroupHandlers() } catch (err: any) { logger.error('system', `Group IPC failed: ${err.message}`) }
  try { registerSettingsHandlers() } catch (err: any) { logger.error('system', `Settings IPC failed: ${err.message}`) }
  try { registerFingerprintIPC() } catch (err: any) { logger.error('system', `Fingerprint IPC failed: ${err.message}`) }
  try { registerBrandingHandlers() } catch (err: any) { logger.error('system', `Branding IPC failed: ${err.message}`) }

  // Initialize profile manager (find Chromium)
  try {
    await profileManager.initialize()
  } catch (err: any) {
    logger.error('system', `Profile manager initialization failed: ${err.message}`)
  }

  // Create main window
  createWindow()

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  logger.info('system', 'AntiProfiles started successfully')
})

// Graceful shutdown
app.on('before-quit', async () => {
  logger.info('system', 'AntiProfiles shutting down...')
  try {
    await profileManager.shutdown()
  } catch (err: any) {
    logger.error('system', `Error during shutdown: ${err.message}`)
  }
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Security: Disable navigation to unknown URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault()
  })
})
