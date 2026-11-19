// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise Browser Runtime Diagnostics Center
// Aggregates runtime health, kernel compatibility, extension health,
// proxy status, and recent launch errors for system & profiles
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import { getRuntimeDetails, getSystemInfo } from './runtime-provisioner'
import { multiKernelManager, InstalledKernelInfo, KernelCompatibilityReport } from './multi-kernel-manager'
import { profileRepo } from '../database/repositories/profile.repo'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { getDatabase } from '../database/connection'

export interface ProfileRuntimeDiagnostic {
  profileId: string
  profileName: string
  osType: string
  engine: 'chromium' | 'firefox'
  requestedVersion: string
  kernelCompatibility: KernelCompatibilityReport
  proxyStatus: {
    configured: boolean
    type: string
    host?: string
    port?: number
    status?: string
    latencyMs?: number | null
  }
  extensionCompatibility: {
    engineSupported: boolean
    notes: string
  }
  recentErrors: Array<{ timestamp: string; message: string }>
  overallHealth: 'healthy' | 'warning' | 'error'
}

export interface SystemRuntimeDiagnostics {
  timestamp: string
  host: { platform: string; arch: string; osKey: string }
  managedRuntimes: {
    chromium: ReturnType<typeof getRuntimeDetails>
    firefox: ReturnType<typeof getRuntimeDetails>
  }
  installedKernels: InstalledKernelInfo[]
  recentLaunchErrors: Array<{ timestamp: string; level: string; category: string; message: string }>
}

export class RuntimeDiagnosticsService {
  static getSystemDiagnostics(): SystemRuntimeDiagnostics {
    let recentLaunchErrors: Array<{ timestamp: string; level: string; category: string; message: string }> = []
    try {
      const db = getDatabase()
      recentLaunchErrors = db
        .prepare("SELECT timestamp, level, category, message FROM logs WHERE level IN ('error', 'warn') AND category IN ('browser', 'proxy', 'profile') ORDER BY id DESC LIMIT 25")
        .all() as any[]
    } catch {}

    return {
      timestamp: new Date().toISOString(),
      host: getSystemInfo(),
      managedRuntimes: {
        chromium: getRuntimeDetails('chromium'),
        firefox: getRuntimeDetails('firefox')
      },
      installedKernels: multiKernelManager.listRuntimes(),
      recentLaunchErrors
    }
  }

  static getProfileDiagnostics(profileId: string): ProfileRuntimeDiagnostic {
    const profile = profileRepo.getById(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    let rawFp: any = null
    try {
      rawFp = typeof profile.fingerprint === 'string' ? JSON.parse(profile.fingerprint) : profile.fingerprint
    } catch {}

    const isFirefox =
      (profile as any).browserType === 'firefox' ||
      rawFp?.browser?.type === 'firefox' ||
      (profile.userAgent || '').includes('Firefox')
    const engine: 'chromium' | 'firefox' = isFirefox ? 'firefox' : 'chromium'
    const requestedVersion = profile.browserVersion || rawFp?.navigator?.browserVersion || 'latest'

    const kernelCompatibility = multiKernelManager.resolveKernelForProfile(engine, requestedVersion)
    const legacyRuntime = getRuntimeDetails(engine)
    if (!kernelCompatibility.compatible && legacyRuntime.installed && legacyRuntime.executablePath && fs.existsSync(legacyRuntime.executablePath)) {
      kernelCompatibility.warning = `Requested version ${requestedVersion} not pinned in multi-kernel store; default managed ${engine} runtime is installed at ${legacyRuntime.executablePath}.`
    }

    const proxy = profile.proxyId ? proxyRepo.getById(profile.proxyId) : null
    const proxyStatus = proxy
      ? {
          configured: true,
          type: proxy.type,
          host: proxy.host,
          port: proxy.port,
          status: proxy.status,
          latencyMs: proxy.latencyMs
        }
      : { configured: false, type: 'direct' }

    const extensionCompatibility = engine === 'firefox'
      ? {
          engineSupported: true,
          notes: 'Firefox ESR or Developer Edition is recommended for enterprise extension management.'
        }
      : {
          engineSupported: true,
          notes: 'Chromium Manifest V3 extensions and CDP emulation are fully supported.'
        }

    let recentErrors: Array<{ timestamp: string; message: string }> = []
    try {
      const db = getDatabase()
      recentErrors = db
        .prepare("SELECT timestamp, message FROM logs WHERE level = 'error' AND (message LIKE ? OR details LIKE ?) ORDER BY id DESC LIMIT 10")
        .all(`%${profileId}%`, `%${profileId}%`) as any[]
    } catch {}

    const overallHealth: 'healthy' | 'warning' | 'error' =
      recentErrors.length > 0 || (proxyStatus.configured && proxyStatus.status === 'dead')
        ? 'error'
        : !kernelCompatibility.compatible
          ? 'warning'
          : 'healthy'

    return {
      profileId: profile.id,
      profileName: profile.name,
      osType: profile.osType || 'windows-10',
      engine,
      requestedVersion,
      kernelCompatibility,
      proxyStatus,
      extensionCompatibility,
      recentErrors,
      overallHealth
    }
  }
}
