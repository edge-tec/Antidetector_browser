// ──────────────────────────────────────────────
// AntiProfiles — IPC Profile Handlers (With Authorization & Central Sync)
// ──────────────────────────────────────────────

import { ipcMain, shell } from 'electron'
import { profileRepo } from '../database/repositories/profile.repo'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { subscriptionRepo } from '../database/repositories/subscription.repo'
import { profileManager } from '../browser/profile-manager'
import { validateProfileName, validateId } from '../security/validators'
import { authorizeUser, normalizeUserRole } from '../security/session'
import { centralApi } from '../services/api-client.service'
import { proxySyncService } from '../services/proxy-sync.service'
import { logger } from '../logging/logger'
import { processTracker } from '../browser/process-tracker'
import {
  startGoogleSystemBrowserOAuth,
  getProfileGoogleAccount,
  disconnectProfileGoogleAccount,
  callGmailApi
} from '../security/google-oauth-loopback'

function checkUserQuota(userId: string, role: string): { allowed: boolean; current: number; max: number; error?: string; locked?: boolean; expired?: boolean } {
  const normalized = normalizeUserRole(role)
  const isAdmin = (normalized === 'admin' || normalized === 'super_admin')
  if (isAdmin) return { allowed: true, current: 0, max: 1000 }

  // ── Authoritative Trial / Subscription Expiration Lock Guard ──
  const liveLicense = centralApi.getCurrentLicense() || subscriptionRepo.validateLicense(userId)
  if (liveLicense && (!liveLicense.valid || liveLicense.subscription_status === 'expired')) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      locked: true,
      expired: true,
      error: 'Your Free Trial has expired. All profile creation and launching options are locked. Please subscribe to an active package to unlock your profiles.'
    }
  }

  const currentCount = profileRepo.getAll(userId).length
  let maxAllowed = 3
  if (liveLicense?.limits?.profiles && typeof liveLicense.limits.profiles === 'number' && liveLicense.limits.profiles > 0) {
    maxAllowed = liveLicense.limits.profiles
  } else {
    try {
      const localLicense = subscriptionRepo.validateLicense(userId)
      if (localLicense?.limits?.profiles && typeof localLicense.limits.profiles === 'number' && localLicense.limits.profiles > 0) {
        maxAllowed = localLicense.limits.profiles
      }
    } catch {}
  }

  if (currentCount >= maxAllowed) {
    return {
      allowed: false,
      current: currentCount,
      max: maxAllowed,
      error: `Profile limit reached (${currentCount}/${maxAllowed}). Your account is allowed a maximum of ${maxAllowed} profile${maxAllowed === 1 ? '' : 's'}. Please upgrade your plan in the Web Control Center to create more profiles.`
    }
  }

  return { allowed: true, current: currentCount, max: maxAllowed }
}

function checkProxyPermission(proxyId: string | undefined, userId: string): { allowed: boolean; error?: string; minPlan?: string } {
  if (!proxyId) return { allowed: true }
  const proxy = proxyRepo.getById(proxyId)
  if (!proxy || proxy.type === 'direct') return { allowed: true }

  const reqType = proxy.type.toLowerCase()
  const license = centralApi.getCurrentLicense() || subscriptionRepo.validateLicense(userId)
  if (license?.features?.allowed_proxy_types && !license.features.allowed_proxy_types.includes(reqType)) {
    return {
      allowed: false,
      error: `Selected proxy "${proxy.name}" (${reqType.toUpperCase()}) requires Starter plan ($19/mo) or higher. Your Free plan includes Basic HTTP proxy support only.`,
      minPlan: 'Starter ($19/mo)'
    }
  }

  return { allowed: true }
}

export function registerProfileHandlers(): void {
  ipcMain.handle('profiles:getAll', async (_event, sessionToken?: string, search?: string, groupId?: string, status?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) {
        return { success: false, error: auth.error || 'Authentication required' }
      }
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      const filterUserId = isAdmin ? undefined : auth.user.id

      // 1. Get local profiles
      const localProfiles = profileRepo.getAll(filterUserId, search, groupId, status).map((p: any) => {
        const ga = getProfileGoogleAccount(p.id)
        return {
          ...p,
          googleAccount: ga ? { email: ga.email, name: ga.name, picture: ga.picture, connectedAt: ga.connectedAt } : null
        }
      })

      // 2. Fetch from Central API in background to keep state synchronized
      centralApi.getProfiles(search, groupId, status).then((res) => {
        if (res.success && Array.isArray(res.data)) {
          for (const cp of res.data) {
            const existing = profileRepo.getById(cp.id)
            if (!existing) {
              try {
                profileRepo.create({
                  id: cp.id,
                  name: cp.name,
                  groupId: cp.groupId,
                  notes: cp.notes,
                  color: cp.color,
                  icon: cp.icon,
                  browserVersion: cp.browserVersion,
                  userAgent: cp.userAgent,
                  language: cp.language,
                  timezone: cp.timezone,
                  screenWidth: cp.screenWidth,
                  screenHeight: cp.screenHeight,
                  webrtcMode: cp.webrtcMode,
                  canvasMode: cp.canvasMode,
                  webglMode: cp.webglMode,
                  hwConcurrency: cp.hwConcurrency,
                  deviceMemory: cp.deviceMemory,
                  hwAcceleration: cp.hwAcceleration,
                  proxyId: cp.proxyId,
                  tags: cp.tags,
                  osType: cp.osType,
                  fingerprint: cp.fingerprint,
                  startUrl: cp.startUrl
                } as any, cp.userId)
              } catch {}
            }
          }
        }
      }).catch(() => {})

      return { success: true, data: localProfiles }
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

      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      const ga = getProfileGoogleAccount(id)

      return {
        success: true,
        data: {
          ...profile,
          googleAccount: ga ? { email: ga.email, name: ga.name, picture: ga.picture, connectedAt: ga.connectedAt } : null
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:create', async (_event, sessionToken: string, input: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      if (!input || typeof input !== 'object') {
        return { success: false, error: 'Invalid profile parameters provided.' }
      }

      validateProfileName(input.name)

      // ── Quota Check: Enforce Profile Limit ──
      const quota = checkUserQuota(auth.user.id, auth.user.role)
      if (!quota.allowed) {
        logger.warn('profile', `[PROFILE_LIMIT_BLOCKED] User ${auth.user.id} reached quota (${quota.current}/${quota.max})`)
        return { success: false, error: quota.error }
      }

      // ── Proxy Type Check: Enforce Plan Allowed Proxy Types ──
      const proxyCheck = checkProxyPermission(input.proxyId, auth.user.id)
      if (!proxyCheck.allowed) {
        return {
          success: false,
          error: proxyCheck.error,
          lockedFeature: 'proxy_support',
          minPlan: proxyCheck.minPlan,
          upgradeUrl: '#pricing'
        }
      }

      // 1. Create local profile and filesystem sandbox
      const profile = profileManager.createProfile(input, auth.user.id)

      // 2. Synchronize to Central MySQL Database
      try {
        centralApi.createProfile({
          id: profile.id,
          name: profile.name,
          groupId: profile.groupId,
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
          proxyId: profile.proxyId,
          tags: profile.tags,
          osType: profile.osType,
          fingerprint: profile.fingerprint,
          startUrl: profile.startUrl
        }).then((centralRes) => {
          if (centralRes.success) {
            logger.info('profile', `[PROFILE_CENTRAL_SYNC] Profile "${profile.name}" replicated to Central Server.`)
          }
        }).catch((e) => {
          logger.warn('profile', `[PROFILE_CENTRAL_SYNC_WARNING] Background central sync error: ${e.message}`)
        })
      } catch {}

      return { success: true, data: profile }
    } catch (err: any) {
      logger.error('profile', `[PROFILE_CREATE_FAILED] Failed to create profile: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:update', async (_event, sessionToken: string, id: string, input: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      if (input.name) validateProfileName(input.name)

      // Proxy check on update
      if (input.proxyId) {
        const proxyCheck = checkProxyPermission(input.proxyId, auth.user.id)
        if (!proxyCheck.allowed) {
          return {
            success: false,
            error: proxyCheck.error,
            lockedFeature: 'proxy_support',
            minPlan: proxyCheck.minPlan,
            upgradeUrl: '#pricing'
          }
        }
      }

      const profile = profileRepo.update(id, input)
      if (!profile) return { success: false, error: 'Profile not found' }

      // Sync to Central Backend
      try {
        centralApi.updateProfile(id, input).catch(() => {})
      } catch {}

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
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      await profileManager.deleteProfile(id)

      // Sync delete to Central Backend
      try {
        centralApi.deleteProfile(id).catch(() => {})
      } catch {}

      return { success: true }
    } catch (err: any) {
      logger.error('profile', `Failed to delete profile: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:clearCookies', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      await profileManager.clearProfileCookies(id)

      // Also sync empty cookies to Central API
      try {
        centralApi.updateProfile(id, { cookies: '[]' } as any).catch(() => {})
      } catch {}

      return { success: true, message: 'Cookies and cache cleared successfully.' }
    } catch (err: any) {
      logger.error('profile', `Failed to clear cookies for profile ${id}: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:duplicate', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }

      validateId(id)
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      // Quota check before duplicating
      const quota = checkUserQuota(auth.user.id, auth.user.role)
      if (!quota.allowed) {
        return { success: false, error: quota.error }
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
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
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

      // Quota check before importing
      const quota = checkUserQuota(auth.user.id, auth.user.role)
      if (!quota.allowed) {
        return { success: false, error: quota.error }
      }

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
      const role = normalizeUserRole(auth.user.role)
      const isAdmin = (role === 'admin' || role === 'super_admin')
      if (!profileRepo.verifyOwnership(id, auth.user.id, isAdmin)) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      return { success: true, data: profileManager.getProfileSize(id) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Profile Reload & Proxy Synchronization ──
  ipcMain.handle('profiles:reload', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(id)

      await proxySyncService.syncProfileProxy(id, true)
      const profile = profileRepo.getById(id)
      if (!profile) return { success: false, error: 'Profile not found' }
      return { success: true, data: profile }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:refreshProxy', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(id)

      await proxySyncService.syncProfileProxy(id, true)
      const profile = profileRepo.getById(id)
      if (!profile) return { success: false, error: 'Profile not found' }
      return { success: true, data: profile }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Profile Google Account Association (RFC 8252 System Browser OAuth) ──
  ipcMain.handle('profiles:connect-google', async (_event, sessionToken: string, profileId: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(profileId)

      if (!profileRepo.verifyOwnership(profileId, auth.user.id, auth.user.role === 'admin')) {
        return { success: false, error: 'Access denied. You do not own this profile.' }
      }

      const oauthRes = await startGoogleSystemBrowserOAuth({ profileId })

      if (!oauthRes.success) {
        return { success: false, error: oauthRes.error || 'Failed to connect Google account.' }
      }

      return {
        success: true,
        data: oauthRes.linkedAccount || oauthRes.userProfile,
        message: 'Google Account successfully connected to profile via System Browser.'
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:get-google-account', async (_event, sessionToken: string, profileId: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(profileId)

      const linked = getProfileGoogleAccount(profileId)
      return { success: true, data: linked }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:open-gmail', async (_event, sessionToken: string, profileId: string, openInSystemBrowser: boolean = false) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(profileId)

      if (openInSystemBrowser) {
        await shell.openExternal('https://mail.google.com')
        return { success: true, mode: 'system' }
      }

      // Profile-specific browser Gmail navigation
      if (!processTracker.isRunning(profileId)) {
        await profileManager.startProfile(profileId)
      }

      const browser = processTracker.getBrowser(profileId)
      if (browser) {
        const pages = await browser.pages()
        const targetPage = pages.length > 0 ? pages[0] : await browser.newPage()
        await targetPage.goto('https://mail.google.com', { waitUntil: 'domcontentloaded' }).catch(() => {})
        return { success: true, mode: 'profile-browser' }
      }

      return { success: true, mode: 'profile-browser' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:test-gmail-api', async (_event, sessionToken: string, profileId: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(profileId)

      const apiResult = await callGmailApi(profileId, 'users/me/profile')
      return apiResult
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('profiles:disconnect-google', async (_event, sessionToken: string, profileId: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user) return { success: false, error: auth.error }
      validateId(profileId)

      const disconnected = disconnectProfileGoogleAccount(profileId)
      return { success: true, disconnected }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
