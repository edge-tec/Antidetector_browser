// ──────────────────────────────────────────────
// AntiProfiles — Logger (file + database)
// ──────────────────────────────────────────────

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { LogLevel, LogCategory } from '../database/models'

// Patterns to redact from log output
const SENSITIVE_PATTERNS = [
  /password["\s]*[:=]["\s]*[^\s,}]*/gi,
  /token["\s]*[:=]["\s]*[^\s,}]*/gi,
  /authorization["\s]*[:=]["\s]*[^\s,}]*/gi,
  /cookie["\s]*[:=]["\s]*[^\s,}]*/gi,
  /secret["\s]*[:=]["\s]*[^\s,}]*/gi,
  /pvault_[a-f0-9]{64}/gi,
  /(:\/\/[^:]+:)[^@]+(@)/gi
]

function redactSensitive(text: string): string {
  let result = text
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.source.includes('$') || pattern.source.includes('://')) {
      result = result.replace(pattern, '$1[REDACTED]$2')
    } else {
      result = result.replace(pattern, '[REDACTED]')
    }
  }
  return result
}

class Logger {
  private logDir: string
  private logFile: string
  private dbInsert: any = null

  constructor() {
    try {
      this.logDir = path.join(app.getPath('userData'), 'logs')
    } catch {
      this.logDir = path.join(process.cwd(), 'logs')
    }
    this.logFile = path.join(this.logDir, 'antiprofiles.log')

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
    } catch {
      // Non-critical
    }
  }

  /**
   * Set the database statement for log insertion.
   * Called after DB is initialized.
   */
  setDbStatement(insertFn: (level: string, category: string, message: string, details: string | null) => void): void {
    this.dbInsert = insertFn
  }

  private writeToFile(level: string, category: string, message: string, details?: string): void {
    try {
      const timestamp = new Date().toISOString()
      const sanitizedMessage = redactSensitive(message)
      const sanitizedDetails = details ? redactSensitive(details) : ''
      const line = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${sanitizedMessage}${sanitizedDetails ? ` | ${sanitizedDetails}` : ''}\n`

      fs.appendFileSync(this.logFile, line, { encoding: 'utf-8' })

      // Rotate if file gets too large (10MB)
      this.rotateIfNeeded()
    } catch {
      // Logging should never crash the app
    }
  }

  private writeToDb(level: string, category: string, message: string, details?: string): void {
    try {
      if (this.dbInsert) {
        const sanitizedMessage = redactSensitive(message)
        const sanitizedDetails = details ? redactSensitive(details) : null
        this.dbInsert(level, category, sanitizedMessage, sanitizedDetails)
      }
    } catch {
      // Logging should never crash the app
    }
  }

  private rotateIfNeeded(): void {
    try {
      const stats = fs.statSync(this.logFile)
      if (stats.size > 10 * 1024 * 1024) {
        // Rotate: rename current file, keep up to 5 history files
        for (let i = 4; i >= 1; i--) {
          const from = path.join(this.logDir, `antiprofiles.${i}.log`)
          const to = path.join(this.logDir, `antiprofiles.${i + 1}.log`)
          if (fs.existsSync(from)) {
            fs.renameSync(from, to)
          }
        }
        fs.renameSync(this.logFile, path.join(this.logDir, 'antiprofiles.1.log'))
      }
    } catch {
      // Non-critical
    }
  }

  log(level: LogLevel, category: LogCategory, message: string, details?: string): void {
    this.writeToFile(level, category, message, details)
    this.writeToDb(level, category, message, details)

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${category}]`
      if (level === 'error') console.error(prefix, message, details || '')
      else if (level === 'warn') console.warn(prefix, message, details || '')
      else console.log(prefix, message, details || '')
    }
  }

  info(category: LogCategory, message: string, details?: string): void {
    this.log('info', category, message, details)
  }

  warn(category: LogCategory, message: string, details?: string): void {
    this.log('warn', category, message, details)
  }

  error(category: LogCategory, message: string, details?: string): void {
    this.log('error', category, message, details)
  }
}

export const logger = new Logger()
