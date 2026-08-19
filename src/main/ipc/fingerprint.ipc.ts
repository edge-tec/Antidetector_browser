// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Fingerprint IPC Handlers
// Exposes fingerprint operations to the renderer via contextBridge
// Includes v3 Device Template resolver pipeline integration
// ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import {
  generateFingerprint,
  regenerateFingerprint,
  recalculateDependentFields,
  getBuiltinTemplates,
  GenerateOptions,
  RecalculateOptions,
  generateFromDeviceTemplate,
  resolveExistingProfile,
  ALL_DEVICE_TEMPLATES,
  getDeviceTemplatesByOs,
  getDeviceTemplatesGrouped,
  getDeviceTemplateById
} from '../fingerprint/generator'
import { validateConsistency, detectContradictions, getStabilityWarnings } from '../fingerprint/consistency'
import {
  OSType, Fingerprint, ConsistencyResult, StabilityWarning,
  RuntimeDiagnosticReport, DeviceSelection, ResolvedRuntimeProfile
} from '../fingerprint/types'
import { profileRepo } from '../database/repositories/profile.repo'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { FirefoxRuntimeDiagnostics, validateFirefoxProfile } from '../browser/firefox/firefox-diagnostics'
import { resolveFirefoxProfile } from '../browser/firefox/firefox-resolver'
import { logger } from '../logging/logger'

export function registerFingerprintIPC(): void {
  // ── Generate a new fingerprint ──
  ipcMain.handle('fingerprint:generate', async (_event, options: GenerateOptions) => {
    try {
      const fingerprint = generateFingerprint(options)
      logger.info('fingerprint', `Generated fingerprint for OS "${options.osType}"`)
      return { success: true, data: fingerprint }
    } catch (err: any) {
      logger.error('fingerprint', `Generation failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Recalculate dependent fields automatically ──
  ipcMain.handle('fingerprint:recalculate', async (_event, currentFp: Fingerprint, options: RecalculateOptions) => {
    try {
      const recalculated = recalculateDependentFields(currentFp, options)
      return { success: true, data: recalculated }
    } catch (err: any) {
      logger.error('fingerprint', `Recalculation failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Regenerate fingerprint (keep OS, new random) ──
  ipcMain.handle('fingerprint:regenerate', async (_event, osType: OSType, country?: string) => {
    try {
      const fingerprint = regenerateFingerprint(osType, country)
      return { success: true, data: fingerprint }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Validate fingerprint consistency ──
  ipcMain.handle('fingerprint:validate', async (
    _event,
    fingerprint: Fingerprint,
    osType: OSType,
    browserType?: 'chrome' | 'firefox',
    browserVersion?: string
  ) => {
    try {
      const result = validateConsistency(fingerprint, osType, browserType, browserVersion)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Detect contradictions ──
  ipcMain.handle('fingerprint:detectContradictions', async (
    _event,
    fingerprint: Fingerprint,
    osType: OSType,
    browserType?: 'chrome' | 'firefox',
    browserVersion?: string
  ) => {
    try {
      const contradictions = detectContradictions(fingerprint, osType, browserType, browserVersion)
      return { success: true, data: contradictions }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Get builtin profile templates ──
  ipcMain.handle('fingerprint:getTemplates', async () => {
    try {
      const templates = getBuiltinTemplates()
      return { success: true, data: templates }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Get stability warnings ──
  ipcMain.handle('fingerprint:stability-warnings', async (
    _event,
    oldFingerprint: Fingerprint,
    newFingerprint: Fingerprint,
    hasBeenUsed: boolean
  ) => {
    try {
      const warnings = getStabilityWarnings(oldFingerprint, newFingerprint, hasBeenUsed)
      return { success: true, data: warnings }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Get full diagnostic report for a profile ──
  ipcMain.handle('fingerprint:getDiagnosticReport', async (_event, profileId: string) => {
    try {
      const profile = profileRepo.getById(profileId)
      if (!profile) return { success: false, error: 'Profile not found' }

      let rawFp: any = profile.fingerprint
      if (typeof rawFp === 'string') {
        try { rawFp = JSON.parse(rawFp) } catch {}
      }

      const osType = (profile.osType as OSType) || 'windows-10'
      const browserEngine = (profile as any).browserType || rawFp?.browser?.type || (rawFp?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
      const browserVersion = (profile as any).browserVersion || rawFp?.browser?.version || rawFp?.navigator?.browserVersion || (browserEngine === 'firefox' ? '129.0' : '131.0.0.0')

      let proxy: any = null
      if (profile.proxyId) {
        proxy = proxyRepo.getById(profile.proxyId)
      }

      const isFirefox = browserEngine === 'firefox'
      const isMobile = osType === 'android' || osType === 'ios'

      if (isFirefox) {
        const ffDiagnostics = FirefoxRuntimeDiagnostics.inspect(profile)
        const resolvedFf = resolveFirefoxProfile(profile)
        const fp = resolvedFf.fingerprint

        const report: RuntimeDiagnosticReport & { firefoxValidation?: any } = {
          profileConfig: {
            osType,
            browserEngine: 'firefox',
            browserVersion,
            platform: resolvedFf.platform,
            userAgent: resolvedFf.userAgent,
            screenResolution: `${resolvedFf.screenWidth}×${resolvedFf.screenHeight}`,
            devicePixelRatio: resolvedFf.devicePixelRatio,
            cpuCores: resolvedFf.hardwareConcurrency,
            memoryGb: resolvedFf.deviceMemory,
            gpuVendor: resolvedFf.gpuVendor,
            gpuRenderer: resolvedFf.gpuRenderer,
            unmaskedRenderer: resolvedFf.unmaskedRenderer,
            timezone: resolvedFf.timezone,
            language: resolvedFf.language,
            languages: resolvedFf.languages,
            webrtcPolicy: resolvedFf.webrtcPolicy,
            touchSupport: resolvedFf.touchSupport,
            maxTouchPoints: resolvedFf.maxTouchPoints
          },
          effectiveRuntime: {
            navigatorPlatform: resolvedFf.platform,
            navigatorUserAgent: resolvedFf.userAgent,
            navigatorVendor: resolvedFf.vendor,
            navigatorAppVersion: resolvedFf.appVersion,
            hardwareConcurrency: resolvedFf.hardwareConcurrency,
            deviceMemory: resolvedFf.deviceMemory,
            screenDimensions: `${resolvedFf.screenWidth}×${resolvedFf.screenHeight}`,
            windowDpr: resolvedFf.devicePixelRatio,
            webglVendor: resolvedFf.unmaskedVendor,
            webglRenderer: resolvedFf.unmaskedRenderer,
            resolvedTimezone: resolvedFf.timezone,
            resolvedLanguages: resolvedFf.languages,
            clientHintsActive: false,
            windowChromePresent: false,
            webrtcStatus: fp.webrtc.mode === 'disabled' ? 'Disabled (Protected)' : `Active (${resolvedFf.webrtcPolicy})`
          },
          networkIdentity: {
            hasProxy: !!proxy && proxy.type !== 'direct',
            proxyType: proxy?.type || 'direct',
            proxyHost: proxy?.host || 'Direct connection',
            proxyPort: proxy?.port || undefined,
            webrtcIpPolicy: resolvedFf.webrtcPolicy,
            disclaimer: 'Notice: Fingerprint configuration isolates observable hardware & browser identifiers. Changing browser fingerprint settings alone does NOT alter the user\'s public IP address or network identity without an active proxy.'
          },
          firefoxValidation: ffDiagnostics
        }
        return { success: true, data: report }
      }

      const fp = recalculateDependentFields(rawFp, {
        osType,
        browserType: browserEngine,
        browserVersion
      })

      const report: RuntimeDiagnosticReport = {
        profileConfig: {
          osType,
          browserEngine,
          browserVersion,
          platform: fp.navigator.platform,
          userAgent: fp.navigator.userAgent,
          screenResolution: `${fp.screen.width}×${fp.screen.height}`,
          devicePixelRatio: fp.screen.devicePixelRatio,
          cpuCores: fp.navigator.hardwareConcurrency,
          memoryGb: fp.navigator.deviceMemory,
          gpuVendor: fp.webgl.gpuVendor,
          gpuRenderer: fp.webgl.gpuRenderer,
          unmaskedRenderer: fp.webgl.unmaskedRenderer,
          timezone: fp.timezone.timezone,
          language: fp.locale.language,
          languages: fp.locale.languages,
          webrtcPolicy: fp.webrtc.ipPolicy,
          touchSupport: fp.navigator.touchSupport,
          maxTouchPoints: fp.navigator.maxTouchPoints
        },
        effectiveRuntime: {
          navigatorPlatform: fp.navigator.platform,
          navigatorUserAgent: fp.navigator.userAgent,
          navigatorVendor: fp.navigator.vendor,
          navigatorAppVersion: fp.navigator.appVersion,
          hardwareConcurrency: fp.navigator.hardwareConcurrency,
          deviceMemory: fp.navigator.deviceMemory,
          screenDimensions: `${fp.screen.width}×${fp.screen.height}`,
          windowDpr: fp.screen.devicePixelRatio,
          webglVendor: fp.webgl.unmaskedVendor,
          webglRenderer: fp.webgl.unmaskedRenderer,
          resolvedTimezone: fp.timezone.timezone,
          resolvedLanguages: fp.locale.languages,
          clientHintsActive: !isFirefox && !isMobile,
          windowChromePresent: !isFirefox,
          webrtcStatus: fp.webrtc.mode === 'disabled' ? 'Disabled (Protected)' : `Active (${fp.webrtc.ipPolicy})`
        },
        networkIdentity: {
          hasProxy: !!proxy && proxy.type !== 'direct',
          proxyType: proxy?.type || 'direct',
          proxyHost: proxy?.host || 'Direct connection',
          proxyPort: proxy?.port || undefined,
          webrtcIpPolicy: fp.webrtc.ipPolicy,
          disclaimer: 'Notice: Fingerprint configuration isolates observable hardware & browser identifiers. Changing browser fingerprint settings alone does NOT alter the user\'s public IP address or network identity without an active proxy.'
        }
      }

      return { success: true, data: report }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Validate Firefox Profile Runtime Coherence ──
  ipcMain.handle('fingerprint:validateFirefoxProfile', async (_event, profileOrId: any) => {
    try {
      const profile = typeof profileOrId === 'string' ? profileRepo.getById(profileOrId) : profileOrId
      if (!profile) return { success: false, error: 'Profile not found' }
      const validation = validateFirefoxProfile(profile)
      return { success: true, data: validation }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  logger.info('fingerprint', 'Fingerprint IPC handlers registered with recalculation and diagnostic support')

  // ═══════════════════════════════════════════
  // v3 Device Template IPC Handlers
  // ═══════════════════════════════════════════

  // ── List all device templates ──
  ipcMain.handle('fingerprint:getDeviceTemplates', async () => {
    try {
      return { success: true, data: ALL_DEVICE_TEMPLATES }
    } catch (err: any) {
      logger.error('fingerprint', `Failed to get device templates: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── List device templates filtered by OS ──
  ipcMain.handle('fingerprint:getDeviceTemplatesByOs', async (_event, osType: OSType) => {
    try {
      const templates = getDeviceTemplatesByOs(osType)
      return { success: true, data: templates }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── List device templates grouped by category ──
  ipcMain.handle('fingerprint:getDeviceTemplatesGrouped', async () => {
    try {
      const grouped = getDeviceTemplatesGrouped()
      return { success: true, data: grouped }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Get a single device template by ID ──
  ipcMain.handle('fingerprint:getDeviceTemplate', async (_event, templateId: string) => {
    try {
      const template = getDeviceTemplateById(templateId)
      if (!template) return { success: false, error: `Template not found: ${templateId}` }
      return { success: true, data: template }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Generate fingerprint from device template (v3 resolver) ──
  ipcMain.handle('fingerprint:generateFromTemplate', async (_event, selection: DeviceSelection) => {
    try {
      const profile = generateFromDeviceTemplate(selection)
      logger.info('fingerprint', `Generated v3 profile from template "${profile.deviceTemplateId}" for ${selection.osType}/${selection.browserType}`)
      return { success: true, data: profile }
    } catch (err: any) {
      logger.error('fingerprint', `Template-based generation failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Resolve a legacy (v2) profile against device templates ──
  ipcMain.handle('fingerprint:resolveLegacyProfile', async (
    _event,
    existingFp: Fingerprint,
    osType: OSType,
    browserType: 'chrome' | 'firefox',
    browserVersion: string
  ) => {
    try {
      const resolved = resolveExistingProfile(existingFp, osType, browserType, browserVersion)
      logger.info('fingerprint', `Resolved legacy profile to template "${resolved.deviceTemplateId}" (legacy=${resolved.isLegacy})`)
      return { success: true, data: resolved }
    } catch (err: any) {
      logger.error('fingerprint', `Legacy resolution failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Run Real-Time Profile Audit ──
  ipcMain.handle('fingerprint:runRealTimeAudit', async (
    _event,
    profileInput: any,
    runtimeProbe?: any
  ) => {
    try {
      const { resolveMasterProfile } = await import('../fingerprint/master-profile-resolver')
      const { RealTimeProfileValidator } = await import('../browser/realtime-profile-validator')
      
      const masterProfile = resolveMasterProfile(profileInput)
      const auditReport = RealTimeProfileValidator.validate(masterProfile, runtimeProbe)
      return { success: true, data: auditReport }
    } catch (err: any) {
      logger.error('fingerprint', `Real-time audit failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Auto-Repair Profile Configuration ──
  ipcMain.handle('fingerprint:autoRepairProfile', async (
    _event,
    profileInput: any,
    currentFingerprint?: any
  ) => {
    try {
      const { ProfileAutoRepairEngine } = await import('../fingerprint/auto-repair')
      const repairResult = ProfileAutoRepairEngine.repair(profileInput, currentFingerprint)
      return { success: true, data: repairResult }
    } catch (err: any) {
      logger.error('fingerprint', `Auto-repair failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // ── Query Audit Logs ──
  ipcMain.handle('fingerprint:getAuditLogs', async (
    _event,
    filter?: { profileId?: string; status?: any; limit?: number }
  ) => {
    try {
      const { auditLogger } = await import('../logging/audit-logger')
      const logs = auditLogger.getLogs(filter)
      return { success: true, data: logs }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  logger.info('fingerprint', 'v3 Device Template and Real-Time Audit IPC handlers registered')
}
