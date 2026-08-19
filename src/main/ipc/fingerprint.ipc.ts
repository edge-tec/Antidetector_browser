// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Fingerprint IPC Handlers
// Exposes fingerprint operations to the renderer via contextBridge
// ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import {
  generateFingerprint,
  regenerateFingerprint,
  recalculateDependentFields,
  getBuiltinTemplates,
  GenerateOptions,
  RecalculateOptions
} from '../fingerprint/generator'
import { validateConsistency, detectContradictions, getStabilityWarnings } from '../fingerprint/consistency'
import { OSType, Fingerprint, ConsistencyResult, StabilityWarning, RuntimeDiagnosticReport } from '../fingerprint/types'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { profileRepo } from '../database/repositories/profile.repo'
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

      const fp = recalculateDependentFields(rawFp, {
        osType,
        browserType: browserEngine,
        browserVersion
      })

      let proxy: any = null
      if (profile.proxyId) {
        proxy = proxyRepo.getById(profile.proxyId)
      }

      const isFirefox = browserEngine === 'firefox'
      const isMobile = osType === 'android' || osType === 'ios'

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

  logger.info('fingerprint', 'Fingerprint IPC handlers registered with recalculation and diagnostic support')
}
