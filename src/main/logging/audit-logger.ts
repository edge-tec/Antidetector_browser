// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Structured Audit Logger
// Sanitized, real-time diagnostic audit logging for browser profiles
// Redacts credentials, tokens, cookies, and sensitive information.
// ──────────────────────────────────────────────────────────────────

export type AuditStatus = 'PASS' | 'WARNING' | 'FAIL' | 'HOST-CONTROLLED' | 'UNSUPPORTED' | 'NOT TESTED' | 'AUTO-REPAIRED'

export interface AuditLogEntry {
  id: string
  timestamp: string
  profileId: string
  property: string
  configuredValue: any
  resolvedValue: any
  runtimeValue: any
  status: AuditStatus
  source: 'Profile Editor' | 'Profile Resolver' | 'Validation Engine' | 'Browser Launcher' | 'Browser Runtime' | 'Auto-Repair Engine'
  error?: string
  repairAction?: string
}

export class AuditLogger {
  private static instance: AuditLogger
  private logs: AuditLogEntry[] = []
  private maxLogs: number = 2000

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  /**
   * Redacts passwords, proxy auth, session tokens, and secrets from any value.
   */
  public sanitize(value: any): any {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
      // Redact URLs with passwords
      let sanitized = value.replace(/(:\/\/[^:]+:)([^@]+)(@)/g, '$1***$3')
      // Redact auth tokens
      sanitized = sanitized.replace(/(bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi, '$1***')
      // Redact password fields in strings
      sanitized = sanitized.replace(/("password"\s*:\s*")[^"]+(")/gi, '$1***$2')
      return sanitized
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(item => this.sanitize(item))
      }
      const clone: Record<string, any> = {}
      for (const [k, v] of Object.entries(value)) {
        const lowerKey = k.toLowerCase()
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('cookie') ||
          lowerKey.includes('auth')
        ) {
          clone[k] = '***REDACTED***'
        } else {
          clone[k] = this.sanitize(v)
        }
      }
      return clone
    }
    return value
  }

  /**
   * Records a structured, sanitized audit log entry.
   */
  public log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      profileId: entry.profileId,
      property: entry.property,
      configuredValue: this.sanitize(entry.configuredValue),
      resolvedValue: this.sanitize(entry.resolvedValue),
      runtimeValue: this.sanitize(entry.runtimeValue),
      status: entry.status,
      source: entry.source,
      error: entry.error ? this.sanitize(entry.error) : undefined,
      repairAction: entry.repairAction ? this.sanitize(entry.repairAction) : undefined
    }

    this.logs.unshift(fullEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }

    return fullEntry
  }

  /**
   * Query logs by filter options.
   */
  public getLogs(filter?: {
    profileId?: string
    status?: AuditStatus
    property?: string
    limit?: number
  }): AuditLogEntry[] {
    let result = this.logs
    if (filter?.profileId) {
      result = result.filter(l => l.profileId === filter.profileId)
    }
    if (filter?.status) {
      result = result.filter(l => l.status === filter.status)
    }
    if (filter?.property) {
      result = result.filter(l => l.property.toLowerCase().includes(filter.property!.toLowerCase()))
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit)
    }
    return result
  }

  /**
   * Clear in-memory audit logs.
   */
  public clear(profileId?: string): void {
    if (profileId) {
      this.logs = this.logs.filter(l => l.profileId !== profileId)
    } else {
      this.logs = []
    }
  }
}

export const auditLogger = AuditLogger.getInstance()
