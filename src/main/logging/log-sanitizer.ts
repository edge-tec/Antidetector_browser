// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Production Log Secret & PII Sanitizer
// Strips Bearer tokens, proxy credentials, passphrases, and cookies
// before any log message is written to disk, DB, or diagnostics
// ──────────────────────────────────────────────────────────────────

export function sanitizeLogString(input: string): string {
  if (!input) return input
  return input
    // Redact proxy/HTTP URLs containing user:pass@host
    .replace(/((?:https?|socks[45]?):\/\/)([^:\s/@]+):([^@\s/]+)@/gi, '$1***:***@')
    // Redact Bearer tokens
    .replace(/(Bearer\s+)[A-Za-z0-9._\-+/=]{8,}/gi, '$1[REDACTED]')
    // Redact key=value / JSON secrets (password, passphrase, secret, token, cookie)
    .replace(/("(?:password|passphrase|secret|secretAccessKey|token|apiToken|cookie|authorization)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/\b(password|passphrase|secret|token)=([^\s&;,]+)/gi, '$1=[REDACTED]')
}
