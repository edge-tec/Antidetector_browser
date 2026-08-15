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
   * Send confirmation email after user successfully verifies their email address.
   */
  async sendAccountVerifiedEmail(userName: string, email: string): Promise<{ success: boolean; sentViaSmtp: boolean; error?: string }> {
    const htmlContent = this.renderVerifiedConfirmationHtml(userName, email)
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
          subject: '🎉 ProfileVault Account Confirmed & Ready!',
          html: htmlContent
        })

        sentViaSmtp = true
        logger.info('auth', `Account verification confirmation email sent via SMTP to "${email}"`)
      } catch (err: any) {
        smtpError = err.message
        logger.error('auth', `Failed to send verification confirmation email via SMTP to "${email}": ${err.message}`)
      }
    } else {
      logger.info('auth', `SMTP disabled. Account verified confirmation logged for "${email}"`)
    }

    return {
      success: true,
      sentViaSmtp,
      error: smtpError
    }
  }

  /**
   * Send system update / announcement email to target list of user emails.
   */
  async sendBroadcastEmail(
    recipients: string[],
    subject: string,
    messageBody: string
  ): Promise<{ success: boolean; totalSent: number; totalFailed: number; sentViaSmtp: boolean; message: string }> {
    if (!recipients || recipients.length === 0) {
      return { success: false, totalSent: 0, totalFailed: 0, sentViaSmtp: false, message: 'No recipient emails specified.' }
    }

    const smtpConfig = this.getSmtpConfig()
    const htmlContent = this.renderBroadcastHtml(subject, messageBody)

    let totalSent = 0
    let totalFailed = 0

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

        for (const recipient of recipients) {
          try {
            await transporter.sendMail({
              from: `"ProfileVault Updates" <${smtpConfig.fromEmail || smtpConfig.user}>`,
              to: recipient,
              subject: subject,
              html: htmlContent
            })
            totalSent++
          } catch (err: any) {
            totalFailed++
            logger.error('admin', `Failed to send broadcast email to "${recipient}": ${err.message}`)
          }
        }

        logger.info('admin', `Email broadcast completed. Sent: ${totalSent}, Failed: ${totalFailed}`)
        return {
          success: true,
          totalSent,
          totalFailed,
          sentViaSmtp: true,
          message: `Broadcast delivered via SMTP to ${totalSent} recipient(s).`
        }
      } catch (err: any) {
        return {
          success: false,
          totalSent: 0,
          totalFailed: recipients.length,
          sentViaSmtp: false,
          message: `SMTP Broadcast transport failed: ${err.message}`
        }
      }
    } else {
      logger.info('admin', `SMTP disabled. Simulated broadcast of "${subject}" to ${recipients.length} recipients.`)
      return {
        success: true,
        totalSent: recipients.length,
        totalFailed: 0,
        sentViaSmtp: false,
        message: `SMTP disabled. Broadcast logged for ${recipients.length} user(s) in system log.`
      }
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

  /**
   * Render HTML template for account verification confirmation email.
   */
  renderVerifiedConfirmationHtml(userName: string, email: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Verified — ProfileVault</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F0F17; color: #CBD5E1; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #1C1C28; border: 1px solid #2C2C3E; border-radius: 12px; padding: 36px; }
    .header { text-align: center; border-bottom: 1px solid #2C2C3E; padding-bottom: 24px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 700; color: #2DD4BF; letter-spacing: 0.5px; }
    .badge { display: inline-block; background: #10B98120; border: 1px solid #10B98140; color: #34D399; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    h2 { color: #F1F5F9; font-size: 22px; margin-top: 0; }
    p { line-height: 1.6; font-size: 14px; color: #94A3B8; }
    .feature-list { background: #14141F; border: 1px solid #2C2C3E; border-radius: 8px; padding: 18px 24px; margin: 24px 0; }
    .feature-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #CBD5E1; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; padding: 14px 32px; background-color: #2DD4BF; color: #0F0F17; font-weight: 700; text-decoration: none; border-radius: 8px; font-size: 14px; }
    .footer { text-align: center; font-size: 12px; color: #475569; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🛡️ ProfileVault Antidetect</div>
    </div>
    <div style="text-align: center;">
      <span class="badge">✓ Email Verified Successfully</span>
      <h2>Welcome to ProfileVault, ${userName}!</h2>
    </div>
    <p>Your email address (<strong>${email}</strong>) has been verified. Your account is now fully active and ready to use.</p>

    <div class="feature-list">
      <div style="font-weight: 600; color: #F1F5F9; margin-bottom: 12px; font-size: 14px;">🚀 What you can do now:</div>
      <div class="feature-item">🔒 Create isolated, fingerprint-protected browser profiles</div>
      <div class="feature-item">🌐 Assign HTTP/HTTPS & SOCKS5 proxies per profile</div>
      <div class="feature-item">👥 Provision team access & share profile permissions</div>
      <div class="feature-item">⚡ Automate routine tasks with browser session isolation</div>
    </div>

    <div class="btn-container">
      <a href="app://profilevault" class="btn">Open ProfileVault Application</a>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} ProfileVault Antidetect Software. All rights reserved.
    </div>
  </div>
</body>
</html>
    `
  }

  /**
   * Render HTML template for admin broadcast emails / system updates.
   */
  renderBroadcastHtml(subject: string, messageBody: string): string {
    const formattedBody = messageBody.replace(/\n/g, '<br>')
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F0F17; color: #CBD5E1; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1C1C28; border: 1px solid #2C2C3E; border-radius: 12px; padding: 36px; }
    .header { text-align: center; border-bottom: 1px solid #2C2C3E; padding-bottom: 24px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 700; color: #2DD4BF; letter-spacing: 0.5px; }
    .badge { display: inline-block; background: #6366F120; border: 1px solid #6366F140; color: #818CF8; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 14px; }
    h2 { color: #F1F5F9; font-size: 20px; margin-top: 0; }
    .content { line-height: 1.7; font-size: 14px; color: #CBD5E1; background: #14141F; border: 1px solid #2C2C3E; padding: 20px; border-radius: 10px; margin: 20px 0; }
    .footer { text-align: center; font-size: 12px; color: #475569; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🛡️ ProfileVault System Announcement</div>
    </div>
    <div>
      <span class="badge">📢 System Update</span>
      <h2>${subject}</h2>
    </div>

    <div class="content">
      ${formattedBody}
    </div>

    <p style="font-size: 12px; color: #64748B;">You are receiving this official update because you are a registered user of ProfileVault Antidetect Software.</p>

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

