// ──────────────────────────────────────────────
// AntiProfiles — Profile Lifecycle Manager
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { profileRepo } from '../database/repositories/profile.repo'
import { Profile, ProfileCreateInput } from '../database/models'
import { launchBrowser } from './launcher'
import { processTracker } from './process-tracker'
import { findChromiumPath, findFirefoxPath, ensureProfileDataDir, ensureFirefoxProfileDataDir, deleteProfileDataDir, clearProfileCookiesData, getProfileDataDir, getProfileDataSize } from './chromium-resolver'
import { ensureBrowserRuntime } from './runtime-provisioner'
import { resolveFirefoxProfile } from './firefox/firefox-resolver'
import { ProfileHealthChecker } from './profile-health-checker'
import { ProfileLockSystem } from './profile-lock-system'
import { CrashRecoveryManager } from './crash-recovery-manager'
import { BackupIntegrityService } from '../storage/backup-integrity'
import { logger } from '../logging/logger'
import { getDatabase } from '../database/connection'

class ProfileManager {
  private chromiumPath: string | null = null
  private firefoxPath: string | null = null

  /**
   * Initialize the profile manager (find Chromium & Firefox).
   */
  async initialize(): Promise<void> {
    const db = getDatabase()
    const customChrome = db.prepare("SELECT value FROM settings WHERE key = 'chromiumPath'").get() as { value: string } | undefined
    const customFf = db.prepare("SELECT value FROM settings WHERE key = 'firefoxPath'").get() as { value: string } | undefined

    this.chromiumPath = await findChromiumPath(customChrome?.value)
    this.firefoxPath = await findFirefoxPath(customFf?.value)

    if (this.chromiumPath && !customChrome?.value) {
      try {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('chromiumPath', ?)").run(this.chromiumPath)
      } catch {}
    }

    if (this.firefoxPath && !customFf?.value) {
      try {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('firefoxPath', ?)").run(this.firefoxPath)
      } catch {}
    }

    // Clean up any orphaned running statuses from crashes
    processTracker.cleanupOrphans()

    logger.info('browser', `Profile manager initialized. Chromium: ${this.chromiumPath || 'not found'} | Firefox: ${this.firefoxPath || 'not found'}`)
  }

  /**
   * Start a profile's browser (Chromium or Firefox depending on profile configuration).
   */
  async startProfile(profileId: string): Promise<{ pid: number; wsEndpoint: string }> {
    const profile = profileRepo.getById(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    if (processTracker.isRunning(profileId) || ProfileLockSystem.isLocked(profileId)) {
      throw new Error(`Profile "${profile.name}" is already running in an active instance. Multi-instance concurrency locked.`)
    }

    // ── Profile Storage Health Check & Auto-Repair ──
    try {
      ProfileHealthChecker.autoRepair(profileId)
    } catch {}

    // Determine configured browser engine & type
    let rawFp: any = null
    try {
      rawFp = typeof profile.fingerprint === 'string' ? JSON.parse(profile.fingerprint) : profile.fingerprint
    } catch {}

    const browserType: 'chrome' | 'firefox' =
      (profile as any).browserType ||
      rawFp?.browser?.type ||
      (rawFp?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')

    const targetEngine: 'chromium' | 'firefox' = browserType === 'firefox' ? 'firefox' : 'chromium'

    // Validate Firefox Profile Coherence if targetEngine is firefox
    if (targetEngine === 'firefox') {
      const resolved = resolveFirefoxProfile(profile)
      if (resolved.unsupportedAtRuntime) {
        throw new Error(`PROFILE_RUNTIME_MISMATCH: ${resolved.unsupportedReasons.join('; ')}`)
      }
    }

    // ── Auto-Provision & Verify AntiProfiles-Managed Browser Runtime ──
    let executablePath: string | null = null
    try {
      executablePath = await ensureBrowserRuntime(targetEngine, profileId)
    } catch (err: any) {
      logger.warn('browser', `[BrowserLaunch] Managed runtime error: ${err.message}. Finding fallback browser...`)
      executablePath = await findBrowserExecutable(browserType)
    }

    if (!executablePath || !fs.existsSync(executablePath)) {
      executablePath = await findBrowserExecutable(browserType)
    }

    if (!executablePath || !fs.existsSync(executablePath)) {
      throw new Error(`Failed to locate verified ${targetEngine.toUpperCase()} executable. Please check Settings > Browser Runtime.`)
    }

    // Ensure profile data directory is accessible and created
    try {
      if (browserType === 'firefox') {
        ensureFirefoxProfileDataDir(profileId)
      } else {
        ensureProfileDataDir(profileId)
      }
    } catch (dirErr: any) {
      throw new Error(`Cannot access profile data directory: ${dirErr.message}`)
    }

    // Update status to launching
    profileRepo.setStatus(profileId, 'launching')
    logger.info('browser', `[BrowserLaunch] Launching profile "${profile.name}" (${profileId}) with ${browserType.toUpperCase()} at: ${executablePath}`)

    try {
      const result = await launchBrowser(profile, executablePath, browserType)

      // Acquire instance lock & track process
      ProfileLockSystem.acquireLock(profileId, result.pid)
      processTracker.track(profileId, profile.name, result.browser, result.pid, result.wsEndpoint, (result as any).childProcess)

      // Update status to running
      profileRepo.setStatus(profileId, 'running', result.pid)
      logger.info('browser', `[BrowserLaunch] Process started successfully: PID ${result.pid}`)

      return { pid: result.pid, wsEndpoint: result.wsEndpoint }
    } catch (err: any) {
      ProfileLockSystem.releaseLock(profileId)
      profileRepo.setStatus(profileId, 'error')
      logger.error('browser', `[BrowserLaunch] Failed to launch profile ${profileId}: ${err.message}`)
      throw err
    }
  }

  /**
   * Stop a profile's browser.
   */
  async stopProfile(profileId: string): Promise<void> {
    CrashRecoveryManager.markCleanExit(profileId)
    ProfileLockSystem.releaseLock(profileId)
    await processTracker.stop(profileId)
  }

  /**
   * Create a new profile.
   */
  createProfile(input: ProfileCreateInput, userId?: string): Profile {
    logger.info('profile', `[PROFILE_CREATE_STARTED] Initializing profile "${input.name}" for user ${userId || 'default'}`)
    const profile = profileRepo.create(input, userId)
    
    // 1. Ensure isolated storage directory
    try {
      const dataDir = ensureProfileDataDir(profile.id)
      const profileRootDir = path.dirname(dataDir)
      
      // 2. Write metadata.json and settings.json
      const meta = {
        id: profile.id,
        name: profile.name,
        userId: profile.userId,
        createdAt: profile.createdAt,
        osType: profile.osType,
        browserVersion: profile.browserVersion
      }
      fs.writeFileSync(path.join(profileRootDir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf-8')
      fs.writeFileSync(path.join(profileRootDir, 'settings.json'), JSON.stringify(profile, null, 2), 'utf-8')
      
      logger.info('profile', `[PROFILE_INITIALIZATION_SUCCESS] Created profile storage at: ${dataDir}`)
    } catch (fsErr: any) {
      logger.warn('profile', `[PROFILE_STORAGE_WARNING] Could not write metadata files: ${fsErr.message}`)
    }

    logger.info('profile', `[PROFILE_READY] Profile "${profile.name}" (${profile.id}) is ready.`)
    return profile
  }

  /**
   * Clear cookies and browser cache for a profile while preserving profile settings.
   */
  async clearProfileCookies(profileId: string): Promise<void> {
    // 1. Stop if running
    if (processTracker.isRunning(profileId)) {
      await processTracker.stop(profileId)
    }

    const profile = profileRepo.getById(profileId)
    const name = profile?.name || profileId

    // 2. Clear files on disk
    clearProfileCookiesData(profileId)

    // 3. Clear cookies in database
    try {
      profileRepo.update(profileId, { cookies: '[]' } as any)
    } catch {}

    logger.info('profile', `Cleared cookies and cache for profile "${name}" (${profileId})`)
  }

  /**
   * Delete a profile and its data.
   */
  async deleteProfile(profileId: string): Promise<void> {
    // Stop if running
    if (processTracker.isRunning(profileId)) {
      await processTracker.stop(profileId)
    }

    const profile = profileRepo.getById(profileId)
    const name = profile?.name || profileId

    // Delete browser data directory
    deleteProfileDataDir(profileId)

    // Delete from database
    profileRepo.delete(profileId)

    logger.info('profile', `Deleted profile "${name}" and its data`)
  }

  /**
   * Duplicate a profile (config only, not browser data).
   */
  duplicateProfile(profileId: string, userId?: string): Profile | null {
    const original = profileRepo.getById(profileId)
    if (!original) return null

    const userProfiles = profileRepo.getAll(userId || original.userId)
    const existingNames = new Set(userProfiles.map(p => (p.name || '').trim().toLowerCase()))

    let candidateName = `${original.name} (Copy)`
    let copyNum = 2
    while (existingNames.has(candidateName.toLowerCase())) {
      candidateName = `${original.name} (Copy ${copyNum})`
      copyNum++
    }

    const newProfile = profileRepo.create({
      name: candidateName,
      groupId: original.groupId,
      notes: original.notes,
      color: original.color,
      icon: original.icon,
      browserVersion: original.browserVersion,
      userAgent: original.userAgent,
      language: original.language,
      timezone: original.timezone,
      screenWidth: original.screenWidth,
      screenHeight: original.screenHeight,
      webrtcMode: original.webrtcMode,
      canvasMode: original.canvasMode,
      webglMode: original.webglMode,
      hwConcurrency: original.hwConcurrency,
      deviceMemory: original.deviceMemory,
      hwAcceleration: original.hwAcceleration,
      proxyId: original.proxyId,
      tags: original.tags,
      osType: original.osType,
      fingerprint: original.fingerprint,
      folder: original.folder,
      startUrl: original.startUrl,
      launchArgs: original.launchArgs,
      saveHistory: original.saveHistory,
      savePasswords: original.savePasswords,
      googleServices: original.googleServices,
      systemExtensions: original.systemExtensions,
      customDns: original.customDns
    }, userId || original.userId)

    if (newProfile) {
      logger.info('profile', `Duplicated profile "${newProfile.name}" from ${profileId}`)
    }
    return newProfile
  }

  /**
   * Export a profile as a JSON config with SHA256 checksum.
   */
  exportProfile(profileId: string): object | null {
    const profile = profileRepo.getById(profileId)
    if (!profile) return null

    const profileData = {
      name: profile.name,
      notes: profile.notes,
      color: profile.color,
      icon: profile.icon,
      browserVersion: profile.browserVersion,
      userAgent: profile.userAgent,
      language: profile.language,
      timezone: profile.timezone,
      screenWidth: profile.screenWidth,
      screenHeight: profile.screenHeight,
      webrtcMode: profile.webrtcMode,
      canvasMode: profile.canvasMode,
      webglMode: profile.webglMode,
      hwConcurrency: profile.hwConcurrency,
      deviceMemory: profile.deviceMemory,
      hwAcceleration: profile.hwAcceleration,
      tags: profile.tags
    }

    const checksum = BackupIntegrityService.calculateChecksum(JSON.stringify(profileData))

    return {
      exportVersion: 2,
      exportDate: new Date().toISOString(),
      checksum,
      profile: profileData
    }
  }

  /**
   * Import a profile from exported JSON with checksum verification.
   */
  importProfile(data: any, userId?: string): Profile {
    if (!data?.profile?.name) {
      throw new Error('Invalid profile export format.')
    }

    // Verify SHA-256 integrity if present
    if (data.checksum) {
      const isValid = BackupIntegrityService.verifyArchiveChecksum(JSON.stringify(data.profile), data.checksum)
      if (!isValid) {
        logger.warn('browser', '[ProfileImport] Archive checksum mismatch. File may have been modified or corrupted.')
      }
    }

    const p = data.profile
    return this.createProfile({
      name: `${p.name} (Imported)`,
      notes: p.notes,
      color: p.color,
      icon: p.icon,
      browserVersion: p.browserVersion,
      userAgent: p.userAgent,
      language: p.language,
      timezone: p.timezone,
      screenWidth: p.screenWidth,
      screenHeight: p.screenHeight,
      webrtcMode: p.webrtcMode,
      canvasMode: p.canvasMode,
      webglMode: p.webglMode,
      hwConcurrency: p.hwConcurrency,
      deviceMemory: p.deviceMemory,
      hwAcceleration: p.hwAcceleration,
      tags: p.tags
    }, userId)
  }

  /**
   * Get Chromium path.
   */
  getChromiumPath(): string | null {
    return this.chromiumPath
  }

  /**
   * Set a custom Chromium path.
   */
  async setChromiumPath(customPath: string): Promise<void> {
    if (customPath && !fs.existsSync(customPath)) {
      throw new Error(`Chromium binary not found at: ${customPath}`)
    }
    this.chromiumPath = customPath || null
    const db = getDatabase()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('chromiumPath', ?)").run(customPath)
    logger.info('browser', `Chromium path updated to: ${customPath || '(auto-detect)'}`)
  }

  /**
   * Get Firefox path.
   */
  getFirefoxPath(): string | null {
    return this.firefoxPath
  }

  /**
   * Set a custom Firefox path.
   */
  async setFirefoxPath(customPath: string): Promise<void> {
    if (customPath && !fs.existsSync(customPath)) {
      throw new Error(`Firefox binary not found at: ${customPath}`)
    }
    this.firefoxPath = customPath || null
    const db = getDatabase()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('firefoxPath', ?)").run(customPath)
    logger.info('browser', `Firefox path updated to: ${customPath || '(auto-detect)'}`)
  }

  /**
   * Get profile storage size.
   */
  getProfileSize(profileId: string): number {
    return getProfileDataSize(profileId)
  }

  /**
   * Stop all browsers (for app shutdown).
   */
  async shutdown(): Promise<void> {
    await processTracker.stopAll()
  }
}

export const profileManager = new ProfileManager()
