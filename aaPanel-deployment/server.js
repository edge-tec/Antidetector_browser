// ──────────────────────────────────────────────
// ProfileVault — Centralized Production Web & API Server for aaPanel
// Node.js + Express + Better-SQLite3 / MySQL Engine
// ──────────────────────────────────────────────

const express = require('express')
const http = require('http')
const path = require('path')
const fs = require('fs')

// Load environment variables
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'production'
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'profilevault.db')

console.log(`[ProfileVault Server] Starting production backend service on port ${PORT}...`)
console.log(`[ProfileVault Server] Environment: ${NODE_ENV}`)
console.log(`[ProfileVault Server] Database Path: ${DB_PATH}`)

// Import compiled backend modules or fallback to dynamic bundle
let userRepo, subscriptionRepo, landingRepo, userModel, encryption, passwordSec

try {
  // Try importing compiled main bundle or modules
  const dbConnection = require('../out/main/database/connection')
  const migrations = require('../out/main/database/migrations/runner')
  const uRepo = require('../out/main/database/repositories/user.repo')
  const sRepo = require('../out/main/database/repositories/subscription.repo')
  const lRepo = require('../out/main/database/repositories/landing.repo')
  
  // Initialize Database
  const db = dbConnection.initDatabase(DB_PATH)
  migrations.runMigrations(db)

  userRepo = uRepo.userRepo
  subscriptionRepo = sRepo.subscriptionRepo
  landingRepo = lRepo.landingRepo
  console.log('[ProfileVault Server] Database initialized and migrations verified successfully.')
} catch (err) {
  console.error('[ProfileVault Server] Core module load failed, utilizing fallback runtime:', err.message)
}

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Security Headers & CORS Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Installation-ID, X-App-Version, X-Platform')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

// Serve static frontend build if available
const rendererDistPath = path.join(__dirname, '../out/renderer')
if (fs.existsSync(rendererDistPath)) {
  app.use(express.static(rendererDistPath))
  console.log(`[ProfileVault Server] Serving static Web UI from: ${rendererDistPath}`)
}

// ── 1. Health Check Endpoint ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'ProfileVault Centralized Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// ── 2. Public Release & Download Information (Admin Configured) ──
app.get('/api/public/releases', (req, res) => {
  try {
    if (subscriptionRepo) {
      const manifest = subscriptionRepo.getAppUpdateManifest()
      return res.json({ success: true, data: manifest })
    }
    return res.json({
      success: true,
      data: {
        version: '1.0.0',
        min_supported_version: '1.0.0',
        force_update: false,
        platforms: {
          'windows-x64': { version: '1.0.0', download_url: 'https://releases.profilevault.local/ProfileVault-Windows-x64.exe', enabled: true },
          'macos-arm64': { version: '1.0.0', download_url: 'https://releases.profilevault.local/ProfileVault-macOS-arm64.dmg', enabled: true },
          'linux-x64': { version: '1.0.0', download_url: 'https://releases.profilevault.local/ProfileVault-Linux-x86_64.AppImage', enabled: true }
        }
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── 3. Public Database-Driven Landing Page CMS Data ──
app.get('/api/public/landing-data', (req, res) => {
  try {
    if (landingRepo) {
      const data = landingRepo.getPublicData()
      // Inject dynamic download URLs into hero and release sections
      if (subscriptionRepo) {
        const config = subscriptionRepo.getDesktopConfig()
        data.releases = {
          windows: {
            url: config.win_download_url || '#download-windows',
            version: config.win_app_version || '1.0.0',
            enabled: config.win_enabled !== 'false'
          },
          mac_intel: {
            url: config.mac_intel_download_url || '#download-mac-intel',
            version: config.mac_intel_app_version || '1.0.0',
            enabled: config.mac_intel_enabled !== 'false'
          },
          mac_arm: {
            url: config.mac_arm_download_url || '#download-mac-arm',
            version: config.mac_arm_app_version || '1.0.0',
            enabled: config.mac_arm_enabled !== 'false'
          },
          linux: {
            url: config.linux_download_url || '#download-linux',
            version: config.linux_app_version || '1.0.0',
            enabled: config.linux_enabled !== 'false'
          }
        }
      }
      return res.json({ success: true, data })
    }
    return res.status(500).json({ success: false, error: 'Landing repository unavailable' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── 4. Authentication Endpoints ──
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    if (!userRepo) {
      return res.status(500).json({ success: false, error: 'Database repository offline' })
    }

    const user = userRepo.getByEmail(email)
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your account has been suspended by an administrator.' })
    }

    const pwdSec = require('../out/main/security/password')
    if (!user.passwordHash || !pwdSec.verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    // Update last login timestamp
    userRepo.update(user.id, { lastLoginAt: new Date().toISOString() })

    // Generate session token
    const tokenSec = require('../out/main/security/session')
    const sessionToken = tokenSec.createSessionToken(user.id)
    const userDisplay = userRepo.getDisplayById(user.id)

    // Validate license / subscription
    let license = null
    if (subscriptionRepo) {
      const installationId = req.headers['x-installation-id'] || req.body.installationId
      const platform = req.headers['x-platform'] || req.body.platform
      const appVersion = req.headers['x-app-version'] || req.body.appVersion
      license = subscriptionRepo.validateLicense(user.id, installationId, platform, appVersion)
    }

    res.json({
      success: true,
      sessionToken,
      user: userDisplay,
      license
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' })
    }

    if (!userRepo) {
      return res.status(500).json({ success: false, error: 'Database repository offline' })
    }

    const existing = userRepo.getByEmail(email)
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' })
    }

    const newUser = userRepo.create({
      name,
      email,
      password,
      role: 'user',
      emailVerified: true,
      accountStatus: 'active'
    })

    // Assign default starter subscription
    if (subscriptionRepo) {
      subscriptionRepo.getOrCreateSubscription(newUser.id)
    }

    const tokenSec = require('../out/main/security/session')
    const sessionToken = tokenSec.createSessionToken(newUser.id)

    res.json({
      success: true,
      sessionToken,
      user: newUser
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── 5. Server-Side Licensing & Authoritative Permissions API ──
app.post('/api/license/validate', (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.body.sessionToken
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Session token required' })
    }

    const tokenSec = require('../out/main/security/session')
    const userId = tokenSec.getUserIdFromToken(token)
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token' })
    }

    if (!subscriptionRepo) {
      return res.status(500).json({ success: false, error: 'Subscription repository offline' })
    }

    const installationId = req.headers['x-installation-id'] || req.body.installationId
    const platform = req.headers['x-platform'] || req.body.platform
    const appVersion = req.headers['x-app-version'] || req.body.appVersion

    const result = subscriptionRepo.validateLicense(userId, installationId, platform, appVersion)
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── 6. Admin Authentication & Authorization Middleware ──
function adminAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.query.token
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Admin token required' })
    }

    const tokenSec = require('../out/main/security/session')
    const userId = tokenSec.getUserIdFromToken(token)
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid token' })
    }

    const user = userRepo.getById(userId)
    if (!user || user.role !== 'admin' || user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, error: 'Access denied. Administrator privilege required.' })
    }

    req.adminUser = user
    next()
  } catch (err) {
    res.status(403).json({ success: false, error: 'Unauthorized admin access' })
  }
}

// ── 7. Admin Management Endpoints ──

// A. User Management APIs
app.get('/api/admin/users', adminAuthMiddleware, (req, res) => {
  try {
    const { search, role, status } = req.query
    const users = userRepo.listUsers({ query: search, role, status })
    res.json({ success: true, data: users })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/admin/users', adminAuthMiddleware, (req, res) => {
  try {
    const newUser = userRepo.create(req.body)
    if (subscriptionRepo) {
      subscriptionRepo.getOrCreateSubscription(newUser.id)
    }
    res.json({ success: true, data: newUser })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.put('/api/admin/users/:id', adminAuthMiddleware, (req, res) => {
  try {
    const updated = userRepo.update(req.params.id, req.body)
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.post('/api/admin/users/:id/reset-password', adminAuthMiddleware, (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }
    const updated = userRepo.update(req.params.id, { password: newPassword })
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.delete('/api/admin/users/:id', adminAuthMiddleware, (req, res) => {
  try {
    const success = userRepo.delete(req.params.id)
    res.json({ success })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// B. Subscriptions Management APIs
app.get('/api/admin/subscriptions', adminAuthMiddleware, (req, res) => {
  try {
    const { search, status, planId } = req.query
    const list = subscriptionRepo.getAdminSubscriptions({ query: search, status, planId })
    res.json({ success: true, data: list })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.put('/api/admin/subscriptions/:userId', adminAuthMiddleware, (req, res) => {
  try {
    const updated = subscriptionRepo.updateUserSubscription(req.params.userId, req.body)
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// C. Application Downloads & Releases Management APIs
app.get('/api/admin/desktop-app-config', adminAuthMiddleware, (req, res) => {
  try {
    const config = subscriptionRepo.getDesktopConfig()
    res.json({ success: true, data: config })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/admin/desktop-app-config', adminAuthMiddleware, (req, res) => {
  try {
    const updated = subscriptionRepo.updateDesktopConfig(req.body)
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// D. Landing Page CMS Admin Management APIs
app.post('/api/admin/landing/branding', adminAuthMiddleware, (req, res) => {
  try {
    const updated = landingRepo.updateBranding(req.body)
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.post('/api/admin/landing/hero', adminAuthMiddleware, (req, res) => {
  try {
    const updated = landingRepo.updateHero(req.body)
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.post('/api/admin/landing/plans', adminAuthMiddleware, (req, res) => {
  try {
    const saved = landingRepo.savePlan(req.body)
    res.json({ success: true, data: saved })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// Single Page Application (SPA) Fallback
app.get('*', (req, res) => {
  const indexHtmlPath = path.join(rendererDistPath, 'index.html')
  if (fs.existsSync(indexHtmlPath)) {
    return res.sendFile(indexHtmlPath)
  }
  res.status(404).send('ProfileVault Production Server Running. Frontend bundle not found.')
})

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ProfileVault Server] Centralized production server running at http://0.0.0.0:${PORT}`)
})
