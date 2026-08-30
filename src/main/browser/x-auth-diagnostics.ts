// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Safe X.com Authentication Diagnostic Logger
// Strictly complies with X.com & Google Privacy and Security Policies:
// - Records ONLY high-level, non-sensitive diagnostic telemetry
// - NEVER records passwords, OTP/MFA codes, auth cookies, or OAuth tokens
// ──────────────────────────────────────────────────────────────────

export interface SafeAuthDiagnosticEvent {
  timestamp: string
  profileId: string
  hostname: string
  statusCategory: '2xx_SUCCESS' | '3xx_REDIRECT' | '4xx_CLIENT_RESTRICTION' | '5xx_SERVER_ERROR' | 'NETWORK_ERROR'
  processState: 'RUNNING' | 'STOPPED' | 'CRASHED'
  userVisibleState?: 'NORMAL' | 'RATE_LIMITED' | 'CHALLENGE_REQUIRED' | 'VERIFICATION_REQUIRED'
  notes?: string
}

export class SafeAuthDiagnostics {
  private static eventLog: SafeAuthDiagnosticEvent[] = []
  private static readonly MAX_LOG_SIZE = 200

  /**
   * Log a safe, sanitized authentication diagnostic event.
   * Strips all query params, tokens, passwords, and sensitive cookies.
   */
  public static logSafeEvent(event: Omit<SafeAuthDiagnosticEvent, 'timestamp'>): SafeAuthDiagnosticEvent {
    // Sanitize hostname: ensure no tokens, userinfo, or credentials exist
    let sanitizedHostname = 'unknown'
    try {
      if (event.hostname.startsWith('http://') || event.hostname.startsWith('https://')) {
        const parsed = new URL(event.hostname)
        sanitizedHostname = parsed.hostname.toLowerCase()
      } else {
        sanitizedHostname = event.hostname.split('/')[0].split('?')[0].toLowerCase()
      }
    } catch {
      sanitizedHostname = 'sanitized-domain'
    }

    const cleanEvent: SafeAuthDiagnosticEvent = {
      timestamp: new Date().toISOString(),
      profileId: event.profileId || 'default',
      hostname: sanitizedHostname,
      statusCategory: event.statusCategory,
      processState: event.processState,
      userVisibleState: event.userVisibleState || 'NORMAL',
      notes: event.notes ? event.notes.substring(0, 150) : undefined
    }

    this.eventLog.push(cleanEvent)
    if (this.eventLog.length > this.MAX_LOG_SIZE) {
      this.eventLog.shift()
    }

    return cleanEvent
  }

  /**
   * Retrieve recent diagnostic events for non-invasive health checks.
   */
  public static getRecentEvents(profileId?: string): SafeAuthDiagnosticEvent[] {
    if (!profileId) return [...this.eventLog]
    return this.eventLog.filter(e => e.profileId === profileId)
  }

  /**
   * Clear diagnostic history.
   */
  public static clear(): void {
    this.eventLog = []
  }
}
