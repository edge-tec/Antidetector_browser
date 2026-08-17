// ──────────────────────────────────────────────
// ProfileVault — Profile Lifecycle Manager
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { profileRepo } from '../database/repositories/profile.repo'
import { Profile, ProfileCreateInput } from '../database/models'
import { launchBrowser } from './launcher'
import { processTracker } from './process-tracker'
import { findChromiumPath, deleteProfileDataDir, getProfileDataDir, getProfileDataSize } from './chromium-resolver'
import { logger } from '../logging/logger'
import { getDatabase } from '../database/connection'

class ProfileManager {
  private chromiumPath: string | null = null

  /**
   * Initialize the profile manager (find Chromium).
   */
  async initialize(): Promise<void> {
    const db = getDatabase()
    const customPath = db.prepare("SELECT value FROM settings WHERE key = 'chromiumPath'").get() as { value: string } | undefined

    this.chromiumPath = await findChromiumPath(customPath?.value)

    if (this.chromiumPath && !customPath?.value) {
      try {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('chromiumPath', ?)").run(this.chromiumPath)
      } catch {}
    }

    // Clean up any orphaned running statuses from crashes
    processTracker.cleanupOrphans()

    logger.info('browser', `Profile manager initialized. Chromium: ${this.chromiumPath || 'not found'}`)
  }

  /**
   * Start a profile's browser.
   */
  async startProfile(profileId: string): Promise<{ pid: number; wsEndpoint: string }> {
    const profile = profileRepo.getById(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    if (processTracker.isRunning(profileId)) {
      throw new Error(`Profile "${profile.name}" is already running.`)
    }

    // Check existing path or auto-detect
    if (!this.chromiumPath || !fs.existsSync(this.chromiumPath)) {
      const db = getDatabase()
      const customPathRow = db.prepare("SELECT value FROM settings WHERE key = 'chromiumPath'").get() as { value: string } | undefined
      this.chromiumPath = await findChromiumPath(customPathRow?.value)

      if (this.chromiumPath) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('chromiumPath', ?)").run(this.chromiumPath)
      } else {
        throw new Error(
          'Chrome/Chromium executable not found. Please install Google Chrome, or click Settings -> Browser Engine to Auto-Detect or Browse.'
        )
      }
    }

    // Ensure profile data directory is accessible and created
    try {
      ensureProfileDataDir(profileId)
    } catch (dirErr: any) {
      throw new Error(`Cannot access profile data directory: ${dirErr.message}`)
    }

    // Update status to launching
    profileRepo.setStatus(profileId, 'launching')
    logger.info('browser', `[BrowserLaunch] Launching profile "${profile.name}" (${profileId}) with browser: ${this.chromiumPath}`)

    try {
      const result = await launchBrowser(profile, this.chromiumPath)

      // Track the process
      processTracker.track(profileId, profile.name, result.browser, result.pid, result.wsEndpoint)

      // Update status to running
      profileRepo.setStatus(profileId, 'running', result.pid)
      logger.info('browser', `[BrowserLaunch] Process started successfully: PID ${result.pid}`)

      return { pid: result.pid, wsEndpoint: result.wsEndpoint }
    } catch (err: any) {
      profileRepo.setStatus(profileId, 'error')
      logger.error('browser', `[BrowserLaunch] Failed to launch profile ${profileId}: ${err.message}`)
      throw err
    }
  }

  /**
   * Stop a profile's browser.
   */
  async stopProfile(profileId: string): Promise<void> {
    await processTracker.stop(profileId)
  }

  /**
   * Create a new profile.
   */
  createProfile(input: ProfileCreateInput, userId?: string): Profile {
    const profile = profileRepo.create(input, userId)
    logger.info('profile', `Created profile "${profile.name}" (${profile.id}) for user ${userId || 'default'}`)
    return profile
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
    const newProfile = profileRepo.create({
      name: `${original.name} (Copy)`,
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
   * Export a profile as a JSON config.
   */
  exportProfile(profileId: string): object | null {
    const profile = profileRepo.getById(profileId)
    if (!profile) return null

    return {
      exportVersion: 1,
      exportDate: new Date().toISOString(),
      profile: {
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
    }
  }

  /**
   * Import a profile from exported JSON.
   */
  importProfile(data: any, userId?: string): Profile {
    if (!data?.profile?.name) {
      throw new Error('Invalid profile export format.')
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
