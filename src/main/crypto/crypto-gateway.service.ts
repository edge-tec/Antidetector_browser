// ──────────────────────────────────────────────────────────────────
// AntiProfiles — In-House Crypto Gateway Orchestrator
// Combines CryptoInvoiceService, BlockchainMonitorService,
// CryptoReconciliationService, and Admin Network Configuration
// ──────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import {
  DEFAULT_CRYPTO_NETWORKS,
  SupportedCryptoNetwork,
  CryptoNetworkKey,
  isValidNetworkAddress,
  usdCentsToCryptoAtomic,
  cryptoAtomicToUsdCents,
  formatAtomicAmount
} from './network-registry'
import { CryptoExchangeRateService } from './exchange-rate.service'
import { BlockchainRpcClient } from './rpc-client.service'
import { PaymentVerificationService, CryptoPaymentStatus } from './payment-verification.service'
import { UserBalanceCreditService } from './balance-credit.service'
import { assertSafeRotationUrl } from '../network/proxy-rotation'
import { logger } from '../logging/logger'

export interface CryptoInvoiceRecord {
  id: string
  invoiceNumber: string
  userId: string
  networkId: string
  symbol: string
  network: CryptoNetworkKey
  contractAddress: string
  decimals: number
  requestedUsdCents: number
  exchangeRateMicros: number
  requiredCryptoAtomic: string
  requiredCryptoDisplay: string
  receivedCryptoAtomic: string
  receivedCryptoDisplay: string
  creditedUsdCents: number
  depositAddress: string
  txHash: string | null
  confirmations: number
  requiredConfirmations: number
  status: CryptoPaymentStatus
  expiresAt: string
  creditedAt: string | null
  createdAt: string
}

class CryptoGatewayService {
  private monitorTimer: NodeJS.Timeout | null = null
  private seeded = false

  /**
   * Seed all 9 supported networks into crypto_supported_networks if not already present.
   */
  ensureSeededNetworks(): void {
    if (this.seeded) return
    try {
      const db = getDatabase()
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO crypto_supported_networks (
          id, symbol, network, network_label, token_standard, contract_address, decimals,
          receiving_address, min_deposit_usd_cents, max_deposit_usd_cents,
          required_confirmations, invoice_expiry_minutes, primary_rpc_url, fallback_rpc_url, enabled, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const n of DEFAULT_CRYPTO_NETWORKS) {
        stmt.run(
          n.id, n.symbol, n.network, n.networkLabel, n.tokenStandard, n.contractAddress, n.decimals,
          n.receivingAddress, n.minDepositUsdCents, n.maxDepositUsdCents,
          n.requiredConfirmations, n.invoiceExpiryMinutes, n.primaryRpcUrl, n.fallbackRpcUrl, n.enabled ? 1 : 0, now
        )
      }
      this.seeded = true
    } catch {}
  }

  listNetworks(onlyEnabled = false): SupportedCryptoNetwork[] {
    this.ensureSeededNetworks()
    const db = getDatabase()
    const rows = (onlyEnabled
      ? db.prepare('SELECT * FROM crypto_supported_networks WHERE enabled = 1 ORDER BY id ASC').all()
      : db.prepare('SELECT * FROM crypto_supported_networks ORDER BY id ASC').all()
    ) as any[]

    return rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      network: r.network as CryptoNetworkKey,
      networkLabel: r.network_label,
      tokenStandard: r.token_standard,
      contractAddress: r.contract_address || '',
      decimals: Number(r.decimals),
      receivingAddress: r.receiving_address || '',
      minDepositUsdCents: Number(r.min_deposit_usd_cents),
      maxDepositUsdCents: Number(r.max_deposit_usd_cents),
      requiredConfirmations: Number(r.required_confirmations),
      invoiceExpiryMinutes: Number(r.invoice_expiry_minutes),
      primaryRpcUrl: r.primary_rpc_url,
      fallbackRpcUrl: r.fallback_rpc_url || '',
      enabled: !!r.enabled,
      coingeckoId: DEFAULT_CRYPTO_NETWORKS.find((d) => d.id === r.id)?.coingeckoId || ''
    }))
  }

  updateNetworkConfig(
    networkId: string,
    patch: Partial<{
      enabled: boolean
      receivingAddress: string
      minDepositUsdCents: number
      maxDepositUsdCents: number
      requiredConfirmations: number
      invoiceExpiryMinutes: number
      primaryRpcUrl: string
      fallbackRpcUrl: string
    }>
  ): SupportedCryptoNetwork {
    this.ensureSeededNetworks()
    const db = getDatabase()
    const existing = this.listNetworks().find((n) => n.id === networkId)
    if (!existing) throw new Error(`Supported crypto network not found: ${networkId}`)

    if (patch.receivingAddress !== undefined && patch.receivingAddress.trim() !== '') {
      if (!isValidNetworkAddress(existing.network, patch.receivingAddress)) {
        throw new Error(`Invalid ${existing.networkLabel} wallet address format.`)
      }
    }
    if (patch.primaryRpcUrl !== undefined && patch.primaryRpcUrl.trim() !== '') {
      const u = assertSafeRotationUrl(patch.primaryRpcUrl.trim())
      if (u.protocol !== 'https:') throw new Error('Primary RPC URL must use HTTPS.')
    }
    if (patch.fallbackRpcUrl !== undefined && patch.fallbackRpcUrl.trim() !== '') {
      const u = assertSafeRotationUrl(patch.fallbackRpcUrl.trim())
      if (u.protocol !== 'https:') throw new Error('Fallback RPC URL must use HTTPS.')
    }

    const now = new Date().toISOString()
    db.prepare(`
      UPDATE crypto_supported_networks SET
        enabled = ?,
        receiving_address = ?,
        min_deposit_usd_cents = ?,
        max_deposit_usd_cents = ?,
        required_confirmations = ?,
        invoice_expiry_minutes = ?,
        primary_rpc_url = ?,
        fallback_rpc_url = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      patch.receivingAddress !== undefined ? patch.receivingAddress.trim() : existing.receivingAddress,
      patch.minDepositUsdCents ?? existing.minDepositUsdCents,
      patch.maxDepositUsdCents ?? existing.maxDepositUsdCents,
      patch.requiredConfirmations ?? existing.requiredConfirmations,
      patch.invoiceExpiryMinutes ?? existing.invoiceExpiryMinutes,
      patch.primaryRpcUrl !== undefined ? patch.primaryRpcUrl.trim() : existing.primaryRpcUrl,
      patch.fallbackRpcUrl !== undefined ? patch.fallbackRpcUrl.trim() : existing.fallbackRpcUrl,
      now,
      networkId
    )

    return this.listNetworks().find((n) => n.id === networkId)!
  }

  /**
   * Generate a real cryptocurrency deposit invoice with live exchange rate & decimal-safe BigInt math.
   */
  async createDepositInvoice(userId: string, networkId: string, usdAmount: number): Promise<CryptoInvoiceRecord> {
    this.ensureSeededNetworks()
    const net = this.listNetworks().find((n) => n.id === networkId)
    if (!net || !net.enabled) {
      throw new Error(`Selected cryptocurrency network "${networkId}" is disabled or unavailable.`)
    }
    if (!net.receivingAddress || !isValidNetworkAddress(net.network, net.receivingAddress)) {
      throw new Error(`No valid receiving wallet address is configured for ${net.symbol} (${net.networkLabel}). Configure it in Crypto Admin first.`)
    }

    const usdCents = Math.round(usdAmount * 100)
    if (usdCents < net.minDepositUsdCents) {
      throw new Error(`Minimum deposit for ${net.symbol} (${net.networkLabel}) is $${(net.minDepositUsdCents / 100).toFixed(2)} USD.`)
    }
    if (usdCents > net.maxDepositUsdCents) {
      throw new Error(`Maximum deposit for ${net.symbol} (${net.networkLabel}) is $${(net.maxDepositUsdCents / 100).toFixed(2)} USD.`)
    }

    const rate = await CryptoExchangeRateService.getUsdRateMicros(net.symbol)
    const requiredCryptoAtomic = usdCentsToCryptoAtomic(usdCents, rate.rateUsdMicros, net.decimals)

    const id = uuidv4()
    const invoiceNumber = `AP-CR-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 4).toUpperCase()}`
    const now = new Date()
    const expiresAt = new Date(now.getTime() + net.invoiceExpiryMinutes * 60 * 1000).toISOString()

    const db = getDatabase()
    db.prepare(`
      INSERT INTO crypto_payment_invoices (
        id, invoice_number, user_id, network_id, symbol, network, contract_address, decimals,
        requested_usd_cents, exchange_rate_micros, required_crypto_atomic, received_crypto_atomic,
        credited_usd_cents, deposit_address, required_confirmations, status, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', 0, ?, ?, 'pending', ?, ?, ?)
    `).run(
      id, invoiceNumber, userId, net.id, net.symbol, net.network, net.contractAddress, net.decimals,
      usdCents, rate.rateUsdMicros, requiredCryptoAtomic, net.receivingAddress,
      net.requiredConfirmations, expiresAt, now.toISOString(), now.toISOString()
    )

    this.logEvent(id, net.network, 'info', 'invoice_created', `Invoice ${invoiceNumber} for $${(usdCents / 100).toFixed(2)} (${formatAtomicAmount(requiredCryptoAtomic, net.decimals)} ${net.symbol})`)
    return this.getInvoice(id)!
  }

  private mapInvoiceRow(r: any): CryptoInvoiceRecord {
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      userId: r.user_id,
      networkId: r.network_id,
      symbol: r.symbol,
      network: r.network,
      contractAddress: r.contract_address || '',
      decimals: Number(r.decimals),
      requestedUsdCents: Number(r.requested_usd_cents),
      exchangeRateMicros: Number(r.exchange_rate_micros),
      requiredCryptoAtomic: String(r.required_crypto_atomic),
      requiredCryptoDisplay: formatAtomicAmount(String(r.required_crypto_atomic), Number(r.decimals)),
      receivedCryptoAtomic: String(r.received_crypto_atomic || '0'),
      receivedCryptoDisplay: formatAtomicAmount(String(r.received_crypto_atomic || '0'), Number(r.decimals)),
      creditedUsdCents: Number(r.credited_usd_cents || 0),
      depositAddress: r.deposit_address,
      txHash: r.tx_hash || null,
      confirmations: Number(r.confirmations || 0),
      requiredConfirmations: Number(r.required_confirmations),
      status: r.status,
      expiresAt: r.expires_at,
      creditedAt: r.credited_at || null,
      createdAt: r.created_at
    }
  }

  getInvoice(id: string): CryptoInvoiceRecord | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM crypto_payment_invoices WHERE id = ?').get(id)
    return row ? this.mapInvoiceRow(row) : null
  }

  listInvoices(filter?: { userId?: string; status?: string; network?: string; limit?: number }): CryptoInvoiceRecord[] {
    const db = getDatabase()
    let sql = 'SELECT * FROM crypto_payment_invoices WHERE 1=1'
    const params: any[] = []
    if (filter?.userId) { sql += ' AND user_id = ?'; params.push(filter.userId) }
    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status) }
    if (filter?.network) { sql += ' AND network = ?'; params.push(filter.network) }
    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(filter?.limit || 100)
    return (db.prepare(sql).all(...params) as any[]).map((r) => this.mapInvoiceRow(r))
  }

  /**
   * Verify a submitted or monitored transaction hash directly against the blockchain RPC,
   * update confirmation progress, and atomically credit the user's USD balance once confirmed.
   */
  async verifyAndProcessTransaction(invoiceId: string, txHash: string): Promise<{
    invoice: CryptoInvoiceRecord
    verification: ReturnType<typeof PaymentVerificationService.verifyObservation>
  }> {
    const cleanHash = (txHash || '').trim()
    if (!cleanHash || cleanHash.length < 16) {
      throw new Error('Invalid transaction hash format.')
    }

    const invoice = this.getInvoice(invoiceId)
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`)

    const net = this.listNetworks().find((n) => n.id === invoice.networkId)
    if (!net) throw new Error(`Network config missing for ${invoice.networkId}`)

    const db = getDatabase()
    // Check if (network, tx_hash) already belongs to a DIFFERENT invoice (replay attack guard)
    const dupRow = db
      .prepare('SELECT invoice_id FROM crypto_transactions WHERE network = ? AND tx_hash = ?')
      .get(invoice.network, cleanHash) as { invoice_id: string } | undefined
    const isDuplicateTxOnNetwork = !!(dupRow && dupRow.invoice_id !== invoice.id)

    const observation = await BlockchainRpcClient.fetchTransaction({
      network: invoice.network,
      txHash: cleanHash,
      expectedRecipient: invoice.depositAddress,
      expectedContract: invoice.contractAddress,
      primaryRpcUrl: net.primaryRpcUrl,
      fallbackRpcUrl: net.fallbackRpcUrl
    })

    const verification = PaymentVerificationService.verifyObservation(invoice, observation, {
      isDuplicateTxOnNetwork
    })

    const now = new Date().toISOString()

    if (!isDuplicateTxOnNetwork && observation.found) {
      db.prepare(`
        INSERT INTO crypto_transactions (
          id, invoice_id, user_id, network, symbol, tx_hash, from_address, to_address,
          contract_addr, amount_atomic, confirmations, block_number, verified, status, detected_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(network, tx_hash) DO UPDATE SET
          confirmations = excluded.confirmations,
          block_number = excluded.block_number,
          verified = excluded.verified,
          status = excluded.status,
          updated_at = excluded.updated_at
      `).run(
        uuidv4(), invoice.id, invoice.userId, invoice.network, invoice.symbol, cleanHash,
        observation.fromAddress, observation.toAddress, observation.contractAddress,
        observation.amountAtomic, observation.confirmations, observation.blockNumber,
        verification.valid ? 1 : 0, verification.nextStatus, now, now
      )
    }

    db.prepare(`
      UPDATE crypto_payment_invoices
      SET tx_hash = COALESCE(tx_hash, ?), received_crypto_atomic = ?, confirmations = ?, status = ?, updated_at = ?
      WHERE id = ? AND status != 'credited'
    `).run(cleanHash, verification.receivedAtomic, verification.confirmations, verification.nextStatus, now, invoice.id)

    if (verification.shouldCredit) {
      const creditUsdCents = verification.nextStatus === 'overpaid'
        ? cryptoAtomicToUsdCents(verification.receivedAtomic, invoice.exchangeRateMicros, invoice.decimals)
        : invoice.requestedUsdCents

      UserBalanceCreditService.creditVerifiedDeposit({
        userId: invoice.userId,
        invoiceId: invoice.id,
        network: invoice.network,
        txHash: cleanHash,
        creditUsdCents,
        finalInvoiceStatus: verification.nextStatus === 'overpaid' ? 'overpaid' : 'credited'
      })
    }

    this.logEvent(invoice.id, invoice.network, verification.valid ? 'info' : 'warn', 'tx_verification', verification.reason)
    return { invoice: this.getInvoice(invoice.id)!, verification }
  }

  /**
   * Background monitor sweep: expires stale pending invoices and re-verifies confirming transactions.
   */
  async runMonitorSweep(): Promise<{ expired: number; rechecked: number }> {
    const db = getDatabase()
    const now = new Date().toISOString()

    const expRes = db
      .prepare("UPDATE crypto_payment_invoices SET status = 'expired', updated_at = ? WHERE status = 'pending' AND expires_at < ?")
      .run(now, now)

    const confirming = db
      .prepare("SELECT id, tx_hash FROM crypto_payment_invoices WHERE status IN ('detected', 'confirming') AND tx_hash IS NOT NULL LIMIT 25")
      .all() as Array<{ id: string; tx_hash: string }>

    let rechecked = 0
    for (const row of confirming) {
      try {
        await this.verifyAndProcessTransaction(row.id, row.tx_hash)
        rechecked++
      } catch (err: any) {
        logger.warn('system', `[CryptoMonitor] Recheck failed for ${row.id}: ${err.message}`)
      }
    }

    return { expired: expRes.changes, rechecked }
  }

  startBackgroundMonitor(intervalMs = 30_000): void {
    if (this.monitorTimer) return
    this.monitorTimer = setInterval(() => {
      this.runMonitorSweep().catch(() => {})
    }, intervalMs)
    this.monitorTimer.unref?.()
  }

  stopBackgroundMonitor(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }
  }

  /**
   * Reconcile credited invoices against immutable wallet_ledger entries.
   */
  runReconciliation(): { checkedInvoices: number; discrepanciesFound: number; discrepancies: any[] } {
    const db = getDatabase()
    const creditedInvoices = db
      .prepare("SELECT id, user_id, network, tx_hash, credited_usd_cents FROM crypto_payment_invoices WHERE status IN ('credited', 'overpaid')")
      .all() as any[]

    const discrepancies: any[] = []
    for (const inv of creditedInvoices) {
      const ledger = db
        .prepare("SELECT amount_cents FROM wallet_ledger WHERE invoice_id = ? AND entry_type = 'crypto_deposit'")
        .get(inv.id) as { amount_cents: number } | undefined
      if (!ledger || Number(ledger.amount_cents) !== Number(inv.credited_usd_cents)) {
        discrepancies.push({
          invoiceId: inv.id,
          expectedCents: inv.credited_usd_cents,
          ledgerCents: ledger?.amount_cents ?? null
        })
      }
    }

    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO crypto_reconciliation_logs (id, checked_invoices, discrepancies_found, summary_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), creditedInvoices.length, discrepancies.length, JSON.stringify(discrepancies), now)

    return { checkedInvoices: creditedInvoices.length, discrepanciesFound: discrepancies.length, discrepancies }
  }

  getAdminOverview(): {
    totalDeposits: number
    totalCreditedUsdCents: number
    pendingCount: number
    confirmingCount: number
    creditedCount: number
    failedCount: number
    underpaidCount: number
    overpaidCount: number
    monitorActive: boolean
  } {
    const db = getDatabase()
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(credited_usd_cents), 0) as totalCredited,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
        SUM(CASE WHEN status IN ('detected', 'confirming') THEN 1 ELSE 0 END) as confirmingCount,
        SUM(CASE WHEN status = 'credited' THEN 1 ELSE 0 END) as creditedCount,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedCount,
        SUM(CASE WHEN status = 'underpaid' THEN 1 ELSE 0 END) as underpaidCount,
        SUM(CASE WHEN status = 'overpaid' THEN 1 ELSE 0 END) as overpaidCount
      FROM crypto_payment_invoices
    `).get() as any

    return {
      totalDeposits: Number(stats?.total || 0),
      totalCreditedUsdCents: Number(stats?.totalCredited || 0),
      pendingCount: Number(stats?.pendingCount || 0),
      confirmingCount: Number(stats?.confirmingCount || 0),
      creditedCount: Number(stats?.creditedCount || 0),
      failedCount: Number(stats?.failedCount || 0),
      underpaidCount: Number(stats?.underpaidCount || 0),
      overpaidCount: Number(stats?.overpaidCount || 0),
      monitorActive: this.monitorTimer !== null
    }
  }

  private logEvent(invoiceId: string | null, network: string, level: string, event: string, details: string): void {
    try {
      const db = getDatabase()
      db.prepare(`
        INSERT INTO crypto_payment_logs (id, invoice_id, network, level, event, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), invoiceId, network, level, event, details, new Date().toISOString())
    } catch {}
  }
}

export const cryptoGatewayService = new CryptoGatewayService()
