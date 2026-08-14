// ──────────────────────────────────────────────
// ProfileVault — Confirmation Email Service (SMTP Support)
// ──────────────────────────────────────────────

import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { tokenRepo } from '../database/repositories/token.repo'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
  secure: boolean
  enabled: boolean
}

export interface SendVerificationResult {
  success: boolean
  token: string
  verificationUrl: string
  sentViaSmtp: boolean
  error?: string
}

export class EmailService {
  /**
   * Fetch current SMTP configuration from SQLite database.
   */
  getSmtpConfig(): SmtpConfig {
    const db = getDatabase()
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'").all() as { key: string; value: string }[]
    const map: Record<string, string> = {}
    rows.forEach(r => { map[r.key] = r.value })

    return {
      host: map['smtp_host'] || process.env.SMTP_HOST || '',
      port: parseInt(map['smtp_port'] || process.env.SMTP_PORT || '587', 10),
      user: map['smtp_user'] || process.env.SMTP_USER || '',
      password: map['smtp_password'] || process.env.SMTP_PASSWORD || '',
      fromEmail: map['smtp_from_email'] || process.env.SMTP_FROM || map['smtp_user'] || 'noreply@profilevault.local',
      secure: map['smtp_secure'] === 'true',
      enabled: map['smtp_enabled'] === 'true' || (!!map['smtp_host'] && !!map['smtp_user'])
    }
  }

  /**
   * Save SMTP configuration to database.
   */
  saveSmtpConfig(config: Partial<SmtpConfig>): SmtpConfig {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

    if (config.host !== undefined) stmt.run('smtp_host', config.host)
    if (config.port !== undefined) stmt.run('smtp_port', String(config.port))
    if (config.user !== undefined) stmt.run('smtp_user', config.user)
    if (config.password !== undefined) stmt.run('smtp_password', config.password)
    if (config.fromEmail !== undefined) stmt.run('smtp_from_email', config.fromEmail)
    if (config.secure !== undefined) stmt.run('smtp_secure', config.secure ? 'true' : 'false')
    if (config.enabled !== undefined) stmt.run('smtp_enabled', config.enabled ? 'true' : 'false')

    logger.info('system', 'SMTP Email configuration updated')
    return this.getSmtpConfig()
  }

  /**
   * Test connection to configured SMTP server.
   */
  async testSmtpConfig(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
    if (!config.host || !config.user) {
      return { success: false, message: 'SMTP Host and Username/Email are required.' }
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password
        },
        timeout: 10000
      })

      await transporter.verify()
      return { success: true, message: `Successfully connected to SMTP server ${config.host}:${config.port}` }
    } catch (err: any) {
      return { success: false, message: `SMTP Connection failed: ${err.message}` }
    }
  }

  /**
   * Create a single-use verification token and send a confirmation email.
   */
  async sendVerificationEmail(userId: string, name: string, email: string): Promise<SendVerificationResult> {
    // Generate secure 256-bit plain token
    const plainToken = crypto.randomBytes(32).toString('hex')

    // Store hashed token in DB with 24h expiration
    tokenRepo.createToken(userId, plainToken, 24)

    // Construct verification link
    const baseUrl = process.env.APP_BASE_URL || 'app://profilevault'
    const verificationUrl = `${baseUrl}/verify-email?token=${plainToken}`

    const htmlContent = this.renderEmailHtml(name, verificationUrl)
    const smtpConfig = this.getSmtpConfig()

    let sentViaSmtp = false
    let smtpError: string | undefined

    if (smtpConfig.enabled && smtpConfig.host && smtpConfig.user) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.password
          }
        })

        await transporter.sendMail({
          from: `"ProfileVault Security" <${smtpConfig.fromEmail || smtpConfig.user}>`,
          to: email,
          subject: 'Confirm your ProfileVault Account',
          html: htmlContent
        })

        sentViaSmtp = true
        logger.info('auth', `Verification email sent via SMTP to "${email}"`)
      } catch (err: any) {
        smtpError = err.message
        logger.error('auth', `Failed to send email via SMTP to "${email}": ${err.message}`)
      }
    } else {
      logger.info('auth', `SMTP disabled or not configured. Generated verification token for ${email}`, JSON.stringify({
        userId,
        email,
        verificationUrl
      }))
    }

    return {
      success: true,
      token: plainToken,
      verificationUrl,
      sentViaSmtp,
      error: smtpError
    }
  }

  /**
   * Render professional HTML template for account verification email.
   */
  renderEmailHtml(userName: string, verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your ProfileVault Account</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F0F17; color: #CBD5E1; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #1C1C28; border: 1px solid #2C2C3E; border-radius: 12px; padding: 36px; }
    .header { text-align: center; border-bottom: 1px solid #2C2C3E; padding-bottom: 24px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 700; color: #2DD4BF; letter-spacing: 0.5px; }
    h2 { color: #F1F5F9; font-size: 20px; margin-top: 0; }
    p { line-height: 1.6; font-size: 14px; color: #94A3B8; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 14px 32px; background-color: #2DD4BF; color: #0F0F17; font-weight: 700; text-decoration: none; border-radius: 8px; font-size: 14px; }
    .notice { background: #14141F; border: 1px solid #2C2C3E; padding: 16px; border-radius: 8px; font-size: 12px; color: #64748B; margin-top: 28px; }
    .footer { text-align: center; font-size: 12px; color: #475569; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🛡️ ProfileVault Antidetect</div>
    </div>
    <h2>Verify your email address</h2>
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Thank you for registering with ProfileVault! Please confirm your email address to activate your account and start creating isolated browser profiles.</p>

    <div class="btn-container">
      <a href="${verificationUrl}" class="btn">Verify Account</a>
    </div>

    <p style="font-size: 12px; color: #64748B;">Or copy and paste this link into your browser:<br>
    <span style="color: #2DD4BF; word-break: break-all;">${verificationUrl}</span></p>

    <div class="notice">
      ⏰ <strong>Security Notice:</strong> This single-use verification link will expire in 24 hours. If you did not create a ProfileVault account, you can safely ignore this message.
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} ProfileVault Antidetect Software. All rights reserved.
    </div>
  </div>
</body>
</html>
    `
  }
}

export const emailService = new EmailService()
