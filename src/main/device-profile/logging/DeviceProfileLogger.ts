export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  event: string
  profileId?: string
  model?: string
  data?: Record<string, unknown>
}

/**
 * Structured logger for Device Profiles.
 * Automatically scrubs any potential sensitive credentials, auth tokens, passwords, or personal keys.
 */
export class DeviceProfileLogger {
  private static subscribers: Array<(entry: LogEntry) => void> = []

  // Blacklist patterns that must be sanitized if encountered
  private static readonly SENSITIVE_PATTERNS = [
    /imei/i,
    /imsi/i,
    /iccid/i,
    /mac/i,
    /token/i,
    /secret/i,
    /password/i,
    /private.*key/i,
    /auth/i,
    /credential/i
  ]

  public static subscribe(listener: (entry: LogEntry) => void): () => void {
    this.subscribers.push(listener)
    return () => {
      this.subscribers = this.subscribers.filter((l) => l !== listener)
    }
  }

  public static info(event: string, meta?: { profileId?: string; model?: string; data?: Record<string, unknown> }): void {
    this.log('INFO', event, meta)
  }

  public static warn(event: string, meta?: { profileId?: string; model?: string; data?: Record<string, unknown> }): void {
    this.log('WARN', event, meta)
  }

  public static error(event: string, meta?: { profileId?: string; model?: string; data?: Record<string, unknown> }): void {
    this.log('ERROR', event, meta)
  }

  public static debug(event: string, meta?: { profileId?: string; model?: string; data?: Record<string, unknown> }): void {
    this.log('DEBUG', event, meta)
  }

  private static log(level: LogLevel, event: string, meta?: { profileId?: string; model?: string; data?: Record<string, unknown> }): void {
    const sanitizedData = meta?.data ? this.sanitize(meta.data) : undefined

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      profileId: meta?.profileId,
      model: meta?.model,
      data: sanitizedData
    }

    // Deliver to subscribers (e.g. test observers or main winston logger)
    for (const sub of this.subscribers) {
      try {
        sub(entry)
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  /**
   * Deep sanitize object to strip any disallowed credentials
   */
  private static sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = this.SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))
      if (isSensitive) {
        cleaned[key] = '[REDACTED_BY_SECURITY_POLICY]'
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.sanitize(value as Record<string, unknown>)
      } else {
        cleaned[key] = value
      }
    }
    return cleaned
  }
}
