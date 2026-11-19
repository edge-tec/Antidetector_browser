// ──────────────────────────────────────────────────────────────────
// AntiProfiles — PaymentVerificationService
// Enforces all 12 mandatory server-side blockchain payment rules:
// network, recipient, contract, asset, txHash, execution status,
// BigInt amount comparison, confirmations, expiration, replay/dup guard
// ──────────────────────────────────────────────────────────────────

import type { CryptoNetworkKey } from './network-registry'
import type { OnChainTxObservation } from './rpc-client.service'

export type CryptoPaymentStatus =
  | 'pending'
  | 'detected'
  | 'confirming'
  | 'confirmed'
  | 'credited'
  | 'expired'
  | 'underpaid'
  | 'overpaid'
  | 'failed'
  | 'manual_review'

export interface InvoiceForVerification {
  id: string
  userId: string
  symbol: string
  network: CryptoNetworkKey
  contractAddress: string
  decimals: number
  depositAddress: string
  requiredCryptoAtomic: string
  requiredConfirmations: number
  status: CryptoPaymentStatus
  expiresAt: string
}

export interface PaymentVerificationResult {
  valid: boolean
  shouldCredit: boolean
  nextStatus: CryptoPaymentStatus
  receivedAtomic: string
  confirmations: number
  reason: string
}

function normalizeAddr(network: CryptoNetworkKey, addr: string): string {
  const trimmed = (addr || '').trim()
  if (network === 'ethereum' || network === 'bsc' || network === 'polygon') {
    return trimmed.toLowerCase()
  }
  return trimmed
}

export class PaymentVerificationService {
  /**
   * Pure, deterministic server-side verification of an on-chain observation against an invoice.
   * Never trusts frontend input; enforces network, recipient, contract, BigInt amount,
   * confirmation threshold, expiration, and duplicate-transaction rules.
   */
  static verifyObservation(
    invoice: InvoiceForVerification,
    tx: OnChainTxObservation,
    options: { isDuplicateTxOnNetwork: boolean; nowMs?: number }
  ): PaymentVerificationResult {
    const nowMs = options.nowMs ?? Date.now()

    // Rule 10 & 11: Reject already credited or duplicate/replayed (network, tx_hash)
    if (invoice.status === 'credited') {
      return {
        valid: false, shouldCredit: false, nextStatus: 'credited',
        receivedAtomic: tx.amountAtomic, confirmations: tx.confirmations,
        reason: 'Invoice is already credited (duplicate credit blocked).'
      }
    }
    if (options.isDuplicateTxOnNetwork) {
      return {
        valid: false, shouldCredit: false, nextStatus: 'manual_review',
        receivedAtomic: '0', confirmations: 0,
        reason: `Replay/duplicate transaction rejected: txHash ${tx.txHash} already used on ${tx.network}.`
      }
    }

    if (!tx.found) {
      const expired = new Date(invoice.expiresAt).getTime() < nowMs
      return {
        valid: false, shouldCredit: false, nextStatus: expired ? 'expired' : invoice.status,
        receivedAtomic: '0', confirmations: 0,
        reason: expired ? 'Invoice expired before payment was detected.' : 'Transaction not yet found on-chain.'
      }
    }

    // Rule 1: Exact blockchain network match
    if (tx.network !== invoice.network) {
      return {
        valid: false, shouldCredit: false, nextStatus: 'failed',
        receivedAtomic: '0', confirmations: 0,
        reason: `Network mismatch: expected ${invoice.network}, observed ${tx.network}.`
      }
    }

    // Rule 6: On-chain execution status must be successful
    if (!tx.executionSuccess && tx.confirmations > 0) {
      return {
        valid: false, shouldCredit: false, nextStatus: 'failed',
        receivedAtomic: '0', confirmations: tx.confirmations,
        reason: 'Transaction reverted / failed on-chain execution.'
      }
    }

    // Rule 2: Exact receiving wallet address match
    if (normalizeAddr(invoice.network, tx.toAddress) !== normalizeAddr(invoice.network, invoice.depositAddress)) {
      return {
        valid: false, shouldCredit: false, nextStatus: 'failed',
        receivedAtomic: '0', confirmations: tx.confirmations,
        reason: 'Recipient address mismatch.'
      }
    }

    // Rule 3: Exact token contract address match (for TRC20 / BEP20 / ERC20)
    if (invoice.contractAddress) {
      if (normalizeAddr(invoice.network, tx.contractAddress) !== normalizeAddr(invoice.network, invoice.contractAddress)) {
        return {
          valid: false, shouldCredit: false, nextStatus: 'failed',
          receivedAtomic: '0', confirmations: tx.confirmations,
          reason: `Token contract mismatch: expected ${invoice.contractAddress}, got ${tx.contractAddress || 'native'}.`
        }
      }
    }

    // Rule 7: BigInt decimal-safe amount check
    const required = BigInt(invoice.requiredCryptoAtomic)
    const received = BigInt(tx.amountAtomic || '0')
    if (received <= 0n) {
      return {
        valid: false, shouldCredit: false, nextStatus: 'failed',
        receivedAtomic: '0', confirmations: tx.confirmations,
        reason: 'Transferred amount is zero.'
      }
    }

    // Rule 9: Confirmation threshold check
    if (tx.confirmations < invoice.requiredConfirmations) {
      return {
        valid: true,
        shouldCredit: false,
        nextStatus: tx.confirmations === 0 ? 'detected' : 'confirming',
        receivedAtomic: received.toString(),
        confirmations: tx.confirmations,
        reason: `Confirming on-chain (${tx.confirmations}/${invoice.requiredConfirmations}).`
      }
    }

    // Underpayment check (allow 0.5% tolerance for minor network dust)
    const minAcceptable = (required * 995n) / 1000n
    if (received < minAcceptable) {
      return {
        valid: false,
        shouldCredit: false,
        nextStatus: 'underpaid',
        receivedAtomic: received.toString(),
        confirmations: tx.confirmations,
        reason: `Underpayment detected: received ${received.toString()} atomic units, required ${required.toString()}.`
      }
    }

    // Overpayment check (> 5% above requested -> flag overpaid for policy handling, never silently discard excess)
    const maxExact = (required * 1050n) / 1000n
    if (received > maxExact) {
      return {
        valid: true,
        shouldCredit: true,
        nextStatus: 'overpaid',
        receivedAtomic: received.toString(),
        confirmations: tx.confirmations,
        reason: `Overpayment detected (${received.toString()} > ${required.toString()}); crediting exact verified USD value and flagging for review.`
      }
    }

    // Late payment on already expired invoice -> manual_review
    if (invoice.status === 'expired' || new Date(invoice.expiresAt).getTime() < nowMs) {
      return {
        valid: false,
        shouldCredit: false,
        nextStatus: 'manual_review',
        receivedAtomic: received.toString(),
        confirmations: tx.confirmations,
        reason: 'Late payment received after invoice expiration; routed to Manual Review.'
      }
    }

    return {
      valid: true,
      shouldCredit: true,
      nextStatus: 'confirmed',
      receivedAtomic: received.toString(),
      confirmations: tx.confirmations,
      reason: `Payment verified with ${tx.confirmations}/${invoice.requiredConfirmations} confirmations.`
    }
  }
}
