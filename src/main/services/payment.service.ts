// ──────────────────────────────────────────────
// AntiProfiles — Payment, Billing & Gateway Management Service
// ──────────────────────────────────────────────

import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'
import { subscriptionRepo } from '../database/repositories/subscription.repo'

export interface PaymentRecord {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  invoice_id?: string | null
  subscription_id?: string | null
  plan_id?: string | null
  plan_name?: string | null
  transaction_id: string
  provider_payment_id?: string | null
  amount: number
  currency: string
  gateway: string
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  payment_method: string
  invoice_url?: string | null
  metadata?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
}

export interface PaymentGatewayConfig {
  id: string
  gateway_key: string
  name: string
  is_enabled: boolean
  is_test_mode: boolean
  public_key: string
  secret_key: string
  webhook_secret: string
  currency: string
  config_json: string
  parsed_config?: any
  created_at: string
  updated_at: string
}

export interface AdminPaymentsOverview {
  metrics: {
    totalRevenueUsd: number
    paidTransactionsCount: number
    pendingTransactionsCount: number
    refundedCount: number
    activeSubscribersCount: number
    trialUsersCount: number
  }
  payments: PaymentRecord[]
  gateways: PaymentGatewayConfig[]
}

export class PaymentService {
  private static instance: PaymentService

  private constructor() {
    this.ensureTablesExist()
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService()
    }
    return PaymentService.instance
  }

  public ensureTablesExist(): void {
    try {
      const db = getDatabase()
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id              TEXT PRIMARY KEY,
          invoice_number  TEXT NOT NULL UNIQUE,
          user_id         TEXT NOT NULL,
          plan_id         TEXT NOT NULL,
          amount          REAL NOT NULL,
          currency        TEXT NOT NULL DEFAULT 'USD',
          status          TEXT NOT NULL DEFAULT 'pending',
          gateway         TEXT,
          transaction_id  TEXT,
          metadata        TEXT,
          created_at      TEXT DEFAULT (datetime('now')),
          paid_at         TEXT,
          expires_at      TEXT
        );

        CREATE TABLE IF NOT EXISTS payments (
          id                  TEXT PRIMARY KEY,
          user_id             TEXT NOT NULL,
          invoice_id          TEXT,
          subscription_id     TEXT,
          plan_id             TEXT,
          transaction_id      TEXT NOT NULL,
          provider_payment_id TEXT,
          amount              REAL NOT NULL,
          currency            TEXT NOT NULL DEFAULT 'USD',
          gateway             TEXT NOT NULL DEFAULT 'stripe',
          status              TEXT NOT NULL DEFAULT 'paid',
          payment_method      TEXT DEFAULT 'card',
          invoice_url         TEXT,
          metadata            TEXT,
          paid_at             TEXT DEFAULT (datetime('now')),
          created_at          TEXT DEFAULT (datetime('now')),
          updated_at          TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS payment_gateways (
          id              TEXT PRIMARY KEY,
          gateway_key     TEXT NOT NULL UNIQUE,
          name            TEXT NOT NULL,
          is_enabled      INTEGER NOT NULL DEFAULT 0,
          is_test_mode    INTEGER NOT NULL DEFAULT 1,
          public_key      TEXT DEFAULT '',
          secret_key      TEXT DEFAULT '',
          webhook_secret  TEXT DEFAULT '',
          currency        TEXT NOT NULL DEFAULT 'USD',
          config_json     TEXT DEFAULT '{}',
          created_at      TEXT DEFAULT (datetime('now')),
          updated_at      TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS global_trial_settings (
          id                  TEXT PRIMARY KEY,
          is_enabled          INTEGER NOT NULL DEFAULT 1,
          trial_duration_days INTEGER NOT NULL DEFAULT 7,
          default_plan_id     TEXT NOT NULL DEFAULT 'plan_starter',
          applies_to_packages TEXT NOT NULL DEFAULT 'all',
          created_at          TEXT DEFAULT (datetime('now')),
          updated_at          TEXT DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO global_trial_settings (id, is_enabled, trial_duration_days, default_plan_id, applies_to_packages)
        VALUES ('global_trial_config', 1, 7, 'plan_starter', 'all');
      `)
    } catch {}
  }

  // ──────────────────────────────────────────────
  // 1. Admin Payments Overview
  // ──────────────────────────────────────────────

  public getAdminPaymentsOverview(search?: string, status?: string, gateway?: string): AdminPaymentsOverview {
    this.ensureTablesExist()
    const db = getDatabase()

    let query = `
      SELECT p.*, u.name as user_name, u.email as user_email, pp.name as plan_name
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN pricing_plans pp ON pp.id = p.plan_id
      WHERE 1=1
    `
    const params: any[] = []

    if (search && search.trim()) {
      query += ` AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(p.transaction_id) LIKE ?)`
      const s = `%${search.trim().toLowerCase()}%`
      params.push(s, s, s)
    }

    if (status && status !== 'all') {
      query += ` AND p.status = ?`
      params.push(status)
    }

    if (gateway && gateway !== 'all') {
      query += ` AND p.gateway = ?`
      params.push(gateway)
    }

    query += ` ORDER BY p.created_at DESC LIMIT 200`

    let payments: PaymentRecord[] = []
    try {
      payments = db.prepare(query).all(...params) as PaymentRecord[]
    } catch {
      payments = []
    }

    // Revenue Metrics
    let totalRevenueUsd = 0
    let paidCount = 0
    let pendingCount = 0
    let refundedCount = 0

    try {
      const revRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid'").get() as any
      totalRevenueUsd = revRow ? Number(revRow.total) : 0

      const paidRow = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'paid'").get() as any
      paidCount = paidRow ? paidRow.count : 0

      const pendingRow = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get() as any
      pendingCount = pendingRow ? pendingRow.count : 0

      const refRow = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'refunded'").get() as any
      refundedCount = refRow ? refRow.count : 0
    } catch {}

    // Subscriptions stats
    let activeSubscribersCount = 0
    let trialUsersCount = 0
    try {
      const actRow = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").get() as any
      activeSubscribersCount = actRow ? actRow.count : 0

      const trRow = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'trial'").get() as any
      trialUsersCount = trRow ? trRow.count : 0
    } catch {}

    const gateways = this.getAllGateways()

    return {
      metrics: {
        totalRevenueUsd,
        paidTransactionsCount: paidCount,
        pendingTransactionsCount: pendingCount,
        refundedCount,
        activeSubscribersCount,
        trialUsersCount
      },
      payments,
      gateways
    }
  }

  // ──────────────────────────────────────────────
  // 2. Gateway Management
  // ──────────────────────────────────────────────

  public getAllGateways(): PaymentGatewayConfig[] {
    this.ensureTablesExist()
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM payment_gateways ORDER BY is_enabled DESC, name ASC').all() as any[]
    return rows.map(r => {
      let parsed = {}
      try { parsed = JSON.parse(r.config_json || '{}') } catch {}
      return {
        ...r,
        is_enabled: Boolean(r.is_enabled),
        is_test_mode: Boolean(r.is_test_mode),
        parsed_config: parsed
      }
    })
  }

  public getPublicGateways(): any[] {
    const all = this.getAllGateways()
    return all.filter(g => g.is_enabled).map(g => ({
      gateway_key: g.gateway_key,
      name: g.name,
      currency: g.currency,
      is_test_mode: g.is_test_mode,
      public_key: g.public_key,
      config: g.parsed_config
    }))
  }

  public saveGateway(gw: Partial<PaymentGatewayConfig>): PaymentGatewayConfig {
    this.ensureTablesExist()
    const db = getDatabase()

    if (!gw.gateway_key || !gw.name) {
      throw new Error('Gateway key and name are required.')
    }

    const id = gw.id || `gw_${gw.gateway_key}`
    const isEnabled = gw.is_enabled ? 1 : 0
    const isTestMode = gw.is_test_mode ? 1 : 0
    const publicKey = gw.public_key || ''
    const secretKey = gw.secret_key || ''
    const webhookSecret = gw.webhook_secret || ''
    const currency = gw.currency || 'USD'
    const configJson = typeof gw.parsed_config === 'object' ? JSON.stringify(gw.parsed_config) : (gw.config_json || '{}')

    db.prepare(`
      INSERT INTO payment_gateways (
        id, gateway_key, name, is_enabled, is_test_mode, public_key, secret_key, webhook_secret, currency, config_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        is_enabled = excluded.is_enabled,
        is_test_mode = excluded.is_test_mode,
        public_key = excluded.public_key,
        secret_key = excluded.secret_key,
        webhook_secret = excluded.webhook_secret,
        currency = excluded.currency,
        config_json = excluded.config_json,
        updated_at = datetime('now')
    `).run(id, gw.gateway_key, gw.name, isEnabled, isTestMode, publicKey, secretKey, webhookSecret, currency, configJson)

    logger.info('payment', `[PaymentService] Saved gateway configuration for "${gw.name}" (${gw.gateway_key})`)
    const updated = db.prepare('SELECT * FROM payment_gateways WHERE id = ?').get(id) as any
    let parsed = {}
    try { parsed = JSON.parse(updated.config_json || '{}') } catch {}
    return {
      ...updated,
      is_enabled: Boolean(updated.is_enabled),
      is_test_mode: Boolean(updated.is_test_mode),
      parsed_config: parsed
    }
  }

  // ──────────────────────────────────────────────
  // 3. User Trial Period & Subscription Control
  // ──────────────────────────────────────────────

  public setUserTrial(userId: string, trialDays: number = 7, planId: string = 'plan_starter'): any {
    this.ensureTablesExist()
    const db = getDatabase()

    const days = Math.max(1, parseInt(String(trialDays), 10) || 7)
    const startsAt = new Date().toISOString()
    const expiresAtDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const expiresAt = expiresAtDate.toISOString()

    // ── Global Bulk Grant for ALL Registered Users ──
    if (userId === 'all' || userId === 'global') {
      const allUsers = db.prepare('SELECT id, name, email FROM users').all() as any[]
      let grantedCount = 0

      for (const u of allUsers) {
        const sub = subscriptionRepo.getOrCreateSubscription(u.id)
        db.prepare(`
          UPDATE subscriptions
          SET plan_id = ?,
              status = 'trial',
              starts_at = ?,
              expires_at = ?,
              grace_period_days = 3,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(planId, startsAt, expiresAt, sub.id)
        grantedCount++
      }

      logger.info('payment', `[PaymentService] Granted GLOBAL ${days}-day Free Trial for all ${grantedCount} users (Plan: ${planId}, Expires: ${expiresAt})`)

      return {
        success: true,
        user_id: 'all',
        user_email: `ALL USERS (${grantedCount} Total)`,
        is_global: true,
        affected_count: grantedCount,
        plan_id: planId,
        status: 'trial',
        trial_days: days,
        starts_at: startsAt,
        expires_at: expiresAt
      }
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as any
    if (!user) throw new Error('User not found.')

    const sub = subscriptionRepo.getOrCreateSubscription(userId)

    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?,
          status = 'trial',
          starts_at = ?,
          expires_at = ?,
          grace_period_days = 3,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(planId, startsAt, expiresAt, sub.id)

    logger.info('payment', `[PaymentService] Granted ${days}-day Free Trial for user ${user.email} (Plan: ${planId}, Expires: ${expiresAt})`)

    return {
      success: true,
      user_id: userId,
      user_email: user.email,
      is_global: false,
      plan_id: planId,
      status: 'trial',
      trial_days: days,
      starts_at: startsAt,
      expires_at: expiresAt
    }
  }

  // ── Global Automatic Free Trial Policy for All New Users ──
  public getGlobalTrialConfig(): {
    is_enabled: boolean
    trial_duration_days: number
    default_plan_id: string
    applies_to_packages: string
  } {
    this.ensureTablesExist()
    const db = getDatabase()
    try {
      const row = db.prepare('SELECT * FROM global_trial_settings WHERE id = ?').get('global_trial_config') as any
      if (row) {
        return {
          is_enabled: Boolean(row.is_enabled),
          trial_duration_days: Number(row.trial_duration_days || 7),
          default_plan_id: row.default_plan_id || 'plan_starter',
          applies_to_packages: row.applies_to_packages || 'all'
        }
      }
    } catch {}
    return {
      is_enabled: true,
      trial_duration_days: 7,
      default_plan_id: 'plan_starter',
      applies_to_packages: 'all'
    }
  }

  public saveGlobalTrialConfig(config: {
    is_enabled: boolean
    trial_duration_days: number
    default_plan_id: string
    applies_to_packages?: string
  }): any {
    this.ensureTablesExist()
    const db = getDatabase()
    const isEnabled = config.is_enabled ? 1 : 0
    const duration = Math.max(1, Number(config.trial_duration_days) || 7)
    const planId = config.default_plan_id || 'plan_starter'
    const appliesTo = config.applies_to_packages || 'all'

    db.prepare(`
      INSERT INTO global_trial_settings (id, is_enabled, trial_duration_days, default_plan_id, applies_to_packages, updated_at)
      VALUES ('global_trial_config', ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        is_enabled = excluded.is_enabled,
        trial_duration_days = excluded.trial_duration_days,
        default_plan_id = excluded.default_plan_id,
        applies_to_packages = excluded.applies_to_packages,
        updated_at = datetime('now')
    `).run(isEnabled, duration, planId, appliesTo)

    logger.info('payment', `[PaymentService] Admin updated Global Registration Trial Policy: is_enabled=${isEnabled}, duration=${duration}d, plan=${planId}, scope=${appliesTo}`)
    return this.getGlobalTrialConfig()
  }

  // ──────────────────────────────────────────────
  // 4. Record Manual Payment & Upgrade User
  // ──────────────────────────────────────────────

  public recordManualPayment(input: {
    userId: string
    planId: string
    amount: number
    currency?: string
    gateway?: string
    transactionId?: string
    notes?: string
    durationMonths?: number
  }): PaymentRecord {
    this.ensureTablesExist()
    const db = getDatabase()

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(input.userId) as any
    if (!user) throw new Error('User not found.')

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const txId = input.transactionId || `MANUAL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const amount = Number(input.amount) || 0
    const currency = input.currency || 'USD'
    const gateway = input.gateway || 'manual_bank'
    const durationMonths = Math.max(1, input.durationMonths || 1)

    const sub = subscriptionRepo.getOrCreateSubscription(input.userId)
    const startsAt = new Date().toISOString()
    const expiresAtDate = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000)
    const expiresAt = expiresAtDate.toISOString()

    // 1. Insert Payment Record
    db.prepare(`
      INSERT INTO payments (
        id, user_id, subscription_id, plan_id, transaction_id, amount, currency, gateway, status, payment_method, metadata, paid_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'manual', ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(paymentId, input.userId, sub.id, input.planId, txId, amount, currency, gateway, JSON.stringify({ notes: input.notes || 'Manual admin payment record', duration_months: durationMonths }))

    // 2. Upgrade Subscription
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?,
          status = 'active',
          starts_at = ?,
          expires_at = ?,
          auto_renew = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(input.planId, startsAt, expiresAt, sub.id)

    logger.info('payment', `[PaymentService] Recorded manual payment of $${amount} for user ${user.email} (TX: ${txId})`)

    return db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as PaymentRecord
  }

  // ──────────────────────────────────────────────
  // 5. Refund / Cancel Payment
  // ──────────────────────────────────────────────

  public refundPayment(paymentId: string, reason: string = 'Admin issued refund'): any {
    this.ensureTablesExist()
    const db = getDatabase()

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any
    if (!payment) throw new Error('Payment not found.')

    db.prepare(`
      UPDATE payments
      SET status = 'refunded',
          metadata = json_set(COALESCE(metadata, '{}'), '$.refund_reason', ?, '$.refunded_at', datetime('now')),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(reason, paymentId)

    // Downgrade subscription to free if needed
    if (payment.subscription_id) {
      db.prepare(`
        UPDATE subscriptions
        SET plan_id = 'plan_free',
            status = 'expired',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(payment.subscription_id)
    }

    logger.info('payment', `[PaymentService] Refunded payment ${paymentId} (TX: ${payment.transaction_id})`)
    return { success: true, paymentId, status: 'refunded' }
  }
}

export const paymentService = PaymentService.getInstance()
