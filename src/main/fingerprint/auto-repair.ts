// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Profile Auto-Repair Engine
// Detects fixable discrepancies and restores 100% coherent configuration
// without corrupting custom user settings or faking host-controlled limits.
// ──────────────────────────────────────────────────────────────────

import { MasterResolvedProfile, resolveMasterProfile, MasterProfileInput } from './master-profile-resolver'
import { RealTimeProfileValidator, RealTimePropertyCheck } from '../browser/realtime-profile-validator'
import { auditLogger } from '../logging/audit-logger'
import { Fingerprint, OSType } from './types'

export interface RepairAction {
  property: string
  beforeValue: any
  afterValue: any
  reason: string
}

export interface AutoRepairResult {
  success: boolean
  profileId: string
  repairedFingerprint: Fingerprint
  repairedMasterProfile: MasterResolvedProfile
  repairedCount: number
  actionsTaken: RepairAction[]
  unfixableProperties: string[]
}

export class ProfileAutoRepairEngine {
  /**
   * Automatically repairs a profile's contradictory or misaligned settings.
   */
  public static repair(
    input: MasterProfileInput,
    currentFingerprint?: Partial<Fingerprint>
  ): AutoRepairResult {
    // 1. Initial resolution of the current state
    const currentResolved = resolveMasterProfile({
      ...input,
      existingFingerprint: currentFingerprint
    })

    // 2. Audit current state for fixable defects
    const initialAudit = RealTimeProfileValidator.validate(currentResolved, {
      browserEngine: currentFingerprint?.browser?.type === 'firefox' ? 'gecko' : 'blink',
      browserVersion: currentFingerprint?.browser?.version || currentFingerprint?.navigator?.browserVersion,
      userAgent: currentFingerprint?.navigator?.userAgent,
      platform: currentFingerprint?.navigator?.platform,
      screenWidth: currentFingerprint?.screen?.width,
      screenHeight: currentFingerprint?.screen?.height,
      devicePixelRatio: currentFingerprint?.screen?.devicePixelRatio,
      hardwareConcurrency: currentFingerprint?.navigator?.hardwareConcurrency,
      deviceMemory: currentFingerprint?.navigator?.deviceMemory,
      unmaskedVendor: currentFingerprint?.webgl?.unmaskedVendor,
      unmaskedRenderer: currentFingerprint?.webgl?.unmaskedRenderer
    })

    const actionsTaken: RepairAction[] = []
    const unfixable: string[] = []

    const fixableChecks = initialAudit.checks.filter(c => (c.status === 'FAIL' || c.status === 'WARNING') && c.fixable)
    const unfixableChecks = initialAudit.checks.filter(c => (c.status === 'FAIL' || c.status === 'WARNING') && !c.fixable)

    for (const u of unfixableChecks) {
      unfixable.push(u.property)
    }

    // 3. Re-resolve authoritative master profile from clean primary selections
    const canonicalMaster = resolveMasterProfile({
      profileId: input.profileId,
      name: input.name,
      osType: input.osType,
      browserType: input.browserType,
      browserVersion: input.browserVersion,
      deviceTemplateId: input.deviceTemplateId,
      deviceModelId: input.deviceModelId,
      seed: input.seed || currentFingerprint?.seed,
      proxy: input.proxy,
      customOverrides: input.customOverrides
    })

    // 4. Record repair actions for each fixable defect
    for (const check of fixableChecks) {
      let afterVal: any = null
      switch (check.id) {
        case 'browser-version':
          afterVal = canonicalMaster.browserVersion
          break
        case 'user-agent':
          afterVal = canonicalMaster.userAgent
          break
        case 'platform':
          afterVal = canonicalMaster.platform
          break
        case 'screen-resolution':
          afterVal = `${canonicalMaster.screenWidth}×${canonicalMaster.screenHeight}`
          break
        case 'device-pixel-ratio':
          afterVal = canonicalMaster.devicePixelRatio
          break
        case 'cpu-cores':
          afterVal = `${canonicalMaster.hardwareConcurrency} Cores`
          break
        case 'device-memory':
          afterVal = `${canonicalMaster.deviceMemory} GB`
          break
        case 'webgl-renderer':
          afterVal = canonicalMaster.unmaskedRenderer
          break
        case 'webgl-vendor':
          afterVal = canonicalMaster.unmaskedVendor
          break
        case 'timezone':
          afterVal = canonicalMaster.timezone
          break
        case 'language':
          afterVal = canonicalMaster.language
          break
        default:
          afterVal = canonicalMaster.fingerprint
      }

      actionsTaken.push({
        property: check.property,
        beforeValue: check.runtime || check.configured,
        afterValue: afterVal,
        reason: check.detail
      })

      auditLogger.log({
        profileId: input.profileId || 'unknown',
        property: check.property,
        configuredValue: check.configured,
        resolvedValue: afterVal,
        runtimeValue: check.runtime,
        status: 'AUTO-REPAIRED',
        source: 'Auto-Repair Engine',
        repairAction: `Auto-repaired ${check.property} to align with ${input.osType} / ${input.browserType}`
      })
    }

    return {
      success: true,
      profileId: canonicalMaster.profileId,
      repairedFingerprint: canonicalMaster.fingerprint,
      repairedMasterProfile: canonicalMaster,
      repairedCount: actionsTaken.length,
      actionsTaken,
      unfixableProperties: unfixable
    }
  }
}
