// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Fingerprint IPC Handlers
// Exposes fingerprint operations to the renderer via contextBridge
// ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { generateFingerprint, regenerateFingerprint, GenerateOptions } from '../fingerprint/generator'
import { validateConsistency, getStabilityWarnings } from '../fingerprint/consistency'
import { OSType, Fingerprint, ConsistencyResult, StabilityWarning } from '../fingerprint/types'
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
  ipcMain.handle('fingerprint:validate', async (_event, fingerprint: Fingerprint, osType: OSType) => {
    try {
      const result = validateConsistency(fingerprint, osType)
      return { success: true, data: result }
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

  logger.info('fingerprint', 'Fingerprint IPC handlers registered')
}
