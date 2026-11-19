// ──────────────────────────────────────────────────────────────────
// AntiProfiles — UserBalanceCreditService
// Atomic integer-cents balance crediting with unique idempotency keys
// and immutable wallet_ledger entries (ZERO floating-point math)
// ──────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'

export interface CreditResult {
  credited: boolean
  alreadyCredited: boolean
  amountCents: number
  newBalanceCents: number
  ledgerEntryId: string
}

export class UserBalanceCreditService {
  static getUserBalanceCents(userId: string): number {
    const db = getDatabase()
    const row = db.prepare('SELECT balance_cents FROM user_wallets WHERE user_id = ?').get(userId) as { balance_cents: number } | undefined
    return row ? Number(row.balance_cents) : 0
  }

  static getUserLedger(userId: string, limit = 50): any[] {
    const db = getDatabase()
    return db
      .prepare('SELECT * FROM wallet_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit)
  }

  /**
   * Atomically credit a verified USD cent amount to a user's wallet.
   * Uses unique idempotency_key (`crypto:${network}:${txHash}`) so duplicate
   * balance credits are structurally impossible.
   */
  static creditVerifiedDeposit(params: {
    userId: string
    invoiceId: string
    network: string
    txHash: string
    creditUsdCents: number
    finalInvoiceStatus?: 'credited' | 'overpaid'
  }): CreditResult {
    const amountCents = Math.floor(params.creditUsdCents)
    if (amountCents <= 0) {
      throw new Error('Credit amount must be a positive integer in USD cents.')
    }

    const db = getDatabase()
    const idempotencyKey = `crypto:${params.network}:${params.txHash}`
    const now = new Date().toISOString()

    // Check idempotency first
    const existingLedger = db
      .prepare('SELECT id, balance_after_cents FROM wallet_ledger WHERE idempotency_key = ?')
      .get(idempotencyKey) as { id: string; balance_after_cents: number } | undefined

    if (existingLedger) {
      return {
        credited: false,
        alreadyCredited: true,
        amountCents: 0,
        newBalanceCents: existingLedger.balance_after_cents,
        ledgerEntryId: existingLedger.id
      }
    }

    const ledgerId = uuidv4()
    const runAtomic = db.transaction(() => {
      // Ensure wallet row exists
      db.prepare('INSERT OR IGNORE INTO user_wallets (user_id, balance_cents, currency, updated_at) VALUES (?, 0, ?, ?)').run(
        params.userId, 'USD', now
      )

      const wallet = db.prepare('SELECT balance_cents FROM user_wallets WHERE user_id = ?').get(params.userId) as { balance_cents: number }
      const newBalanceCents = Number(wallet.balance_cents) + amountCents

      db.prepare('UPDATE user_wallets SET balance_cents = ?, updated_at = ? WHERE user_id = ?').run(
        newBalanceCents, now, params.userId
      )

      db.prepare(`
        INSERT INTO wallet_ledger (id, user_id, invoice_id, network, tx_hash, entry_type, amount_cents, balance_after_cents, idempotency_key, reason, created_at)
        VALUES (?, ?, ?, ?, ?, 'crypto_deposit', ?, ?, ?, ?, ?)
      `).run(
        ledgerId,
        params.userId,
        params.invoiceId,
        params.network,
        params.txHash,
        amountCents,
        newBalanceCents,
        idempotencyKey,
        `Verified ${params.network} deposit (${params.txHash.slice(0, 16)}...)`,
        now
      )

      db.prepare(`
        UPDATE crypto_payment_invoices
        SET status = ?, credited_usd_cents = ?, credited_at = ?, updated_at = ?
        WHERE id = ?
      `).run(params.finalInvoiceStatus || 'credited', amountCents, now, now, params.invoiceId)

      return newBalanceCents
    })

    const newBalanceCents = runAtomic()
    logger.info('system', `[CryptoCredit] Credited $${(amountCents / 100).toFixed(2)} USD to user ${params.userId} (invoice ${params.invoiceId})`)

    return {
      credited: true,
      alreadyCredited: false,
      amountCents,
      newBalanceCents,
      ledgerEntryId: ledgerId
    }
  }
}
