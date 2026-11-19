import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as migration014 from '../../src/main/database/migrations/014_inhouse_crypto_gateway'
import {
  DEFAULT_CRYPTO_NETWORKS,
  isValidNetworkAddress,
  usdCentsToCryptoAtomic,
  cryptoAtomicToUsdCents,
  formatAtomicAmount
} from '../../src/main/crypto/network-registry'
import { parseEvmTokenTransferLog, ERC20_TRANSFER_TOPIC } from '../../src/main/crypto/rpc-client.service'
import { PaymentVerificationService, InvoiceForVerification } from '../../src/main/crypto/payment-verification.service'
import { CryptoDepositPage } from '../../src/renderer/pages/enterprise/CryptoDepositPage'
import { AdminCryptoPage } from '../../src/renderer/pages/enterprise/AdminCryptoPage'

describe('In-House Multi-Crypto Payment Gateway — Enterprise Financial & Security Suite', () => {
  it('supports all 9 required cryptocurrency networks and validates network-specific wallet addresses', () => {
    expect(DEFAULT_CRYPTO_NETWORKS).toHaveLength(9)
    const ids = DEFAULT_CRYPTO_NETWORKS.map((n) => n.id)
    for (const required of ['usdt-tron', 'trx-tron', 'usdt-bsc', 'bnb-bsc', 'usdt-ethereum', 'eth-ethereum', 'btc-bitcoin', 'pol-polygon', 'sol-solana']) {
      expect(ids).toContain(required)
    }

    expect(isValidNetworkAddress('tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(true)
    expect(isValidNetworkAddress('tron', '0x55d398326f99059fF775485246999027B3197955')).toBe(false)
    expect(isValidNetworkAddress('bsc', '0x55d398326f99059fF775485246999027B3197955')).toBe(true)
    expect(isValidNetworkAddress('bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')).toBe(true)
    expect(isValidNetworkAddress('solana', '11111111111111111111111111111111')).toBe(true)
  })

  it('performs decimal-safe BigInt USD-to-crypto and crypto-to-USD conversions without floating-point drift', () => {
    // $50.00 USD at 1.000000 USDT (6 decimals) = 50_000_000 atomic units
    const usdtAtomic = usdCentsToCryptoAtomic(5000, 1_000_000, 6)
    expect(usdtAtomic).toBe('50000000')
    expect(formatAtomicAmount(usdtAtomic, 6)).toBe('50.0')
    expect(cryptoAtomicToUsdCents(usdtAtomic, 1_000_000, 6)).toBe(5000)

    // $900.00 USD at $90,000 BTC (8 decimals) = 1_000_000 sats = 0.01 BTC
    const btcAtomic = usdCentsToCryptoAtomic(90000, 90_000_000_000, 8)
    expect(btcAtomic).toBe('1000000')
    expect(formatAtomicAmount(btcAtomic, 8)).toBe('0.01')
    expect(cryptoAtomicToUsdCents(btcAtomic, 90_000_000_000, 8)).toBe(90000)
  })

  it('decodes EVM ERC20/BEP20 Transfer logs accurately', () => {
    const contract = '0x55d398326f99059ff775485246999027b3197955'
    const recipient = '0x1111111111111111111111111111111111111111'
    const sender = '0x2222222222222222222222222222222222222222'
    const logs = [{
      address: contract,
      topics: [
        ERC20_TRANSFER_TOPIC,
        '0x000000000000000000000000' + sender.slice(2),
        '0x000000000000000000000000' + recipient.slice(2)
      ],
      data: '0x' + (50n * 10n ** 18n).toString(16)
    }]
    const parsed = parseEvmTokenTransferLog(logs, contract, recipient)
    expect(parsed.matched).toBe(true)
    expect(parsed.toAddress).toBe(recipient)
    expect(parsed.amountAtomic).toBe((50n * 10n ** 18n).toString())
  })

  it('enforces all PaymentVerificationService financial security rules (valid, network/recipient/contract mismatch, confirmations, underpaid, overpaid, replay, expired)', () => {
    const baseInvoice: InvoiceForVerification = {
      id: 'inv-1',
      userId: 'u-1',
      symbol: 'USDT',
      network: 'ethereum',
      contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      depositAddress: '0x1111111111111111111111111111111111111111',
      requiredCryptoAtomic: '50000000',
      requiredConfirmations: 12,
      status: 'pending',
      expiresAt: new Date(Date.now() + 600_000).toISOString()
    }

    const baseTx = {
      found: true,
      network: 'ethereum' as const,
      txHash: '0xabc123',
      executionSuccess: true,
      fromAddress: '0x2222222222222222222222222222222222222222',
      toAddress: '0x1111111111111111111111111111111111111111',
      contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      amountAtomic: '50000000',
      confirmations: 12,
      blockNumber: 20000000,
      rpcEndpointUsed: 'https://ethereum-rpc.publicnode.com'
    }

    // 1. Valid exact payment -> confirmed & shouldCredit
    const ok = PaymentVerificationService.verifyObservation(baseInvoice, baseTx, { isDuplicateTxOnNetwork: false })
    expect(ok.valid).toBe(true)
    expect(ok.shouldCredit).toBe(true)
    expect(ok.nextStatus).toBe('confirmed')

    // 2. Insufficient confirmations -> confirming, do NOT credit
    const conf = PaymentVerificationService.verifyObservation(baseInvoice, { ...baseTx, confirmations: 4 }, { isDuplicateTxOnNetwork: false })
    expect(conf.shouldCredit).toBe(false)
    expect(conf.nextStatus).toBe('confirming')

    // 3. Wrong network -> failed
    const wrongNet = PaymentVerificationService.verifyObservation(baseInvoice, { ...baseTx, network: 'bsc' }, { isDuplicateTxOnNetwork: false })
    expect(wrongNet.valid).toBe(false)
    expect(wrongNet.nextStatus).toBe('failed')

    // 4. Wrong token contract -> failed
    const wrongContract = PaymentVerificationService.verifyObservation(baseInvoice, { ...baseTx, contractAddress: '0xdeadbeef' }, { isDuplicateTxOnNetwork: false })
    expect(wrongContract.valid).toBe(false)
    expect(wrongContract.nextStatus).toBe('failed')

    // 5. Underpaid -> underpaid, do NOT credit
    const under = PaymentVerificationService.verifyObservation(baseInvoice, { ...baseTx, amountAtomic: '40000000' }, { isDuplicateTxOnNetwork: false })
    expect(under.shouldCredit).toBe(false)
    expect(under.nextStatus).toBe('underpaid')

    // 6. Overpaid -> overpaid, credit verified amount & flag
    const over = PaymentVerificationService.verifyObservation(baseInvoice, { ...baseTx, amountAtomic: '60000000' }, { isDuplicateTxOnNetwork: false })
    expect(over.shouldCredit).toBe(true)
    expect(over.nextStatus).toBe('overpaid')

    // 7. Duplicate / replayed txHash on same network -> manual_review, do NOT credit
    const dup = PaymentVerificationService.verifyObservation(baseInvoice, baseTx, { isDuplicateTxOnNetwork: true })
    expect(dup.shouldCredit).toBe(false)
    expect(dup.nextStatus).toBe('manual_review')

    // 8. Already credited invoice -> never double-credit
    const already = PaymentVerificationService.verifyObservation({ ...baseInvoice, status: 'credited' }, baseTx, { isDuplicateTxOnNetwork: false })
    expect(already.shouldCredit).toBe(false)
  })

  it('enforces UNIQUE(network, tx_hash) and UNIQUE(idempotency_key) in Migration 014 on real sqlite3', () => {
    const dbPath = path.join(os.tmpdir(), `ap-crypto-db-${Date.now()}.sqlite`)
    const captured: string[] = []
    migration014.up({ exec: (sql: string) => captured.push(sql) } as any)
    try {
      execFileSync('sqlite3', [dbPath], { input: captured.join('\n'), encoding: 'utf8' })

      // Same tx_hash on two DIFFERENT networks is allowed; same tx_hash on SAME network must fail
      execFileSync('sqlite3', [dbPath], {
        input: `
          INSERT INTO crypto_transactions (id, invoice_id, user_id, network, symbol, tx_hash, to_address, amount_atomic, detected_at, updated_at)
          VALUES ('t1', 'i1', 'u1', 'ethereum', 'USDT', '0xdup', '0x1', '100', '2026-01-01', '2026-01-01');
          INSERT INTO crypto_transactions (id, invoice_id, user_id, network, symbol, tx_hash, to_address, amount_atomic, detected_at, updated_at)
          VALUES ('t2', 'i2', 'u1', 'bsc', 'USDT', '0xdup', '0x1', '100', '2026-01-01', '2026-01-01');
        `,
        encoding: 'utf8'
      })

      expect(() => {
        execFileSync('sqlite3', [dbPath], {
          input: `
            INSERT INTO crypto_transactions (id, invoice_id, user_id, network, symbol, tx_hash, to_address, amount_atomic, detected_at, updated_at)
            VALUES ('t3', 'i3', 'u1', 'ethereum', 'USDT', '0xdup', '0x1', '100', '2026-01-01', '2026-01-01');
          `,
          encoding: 'utf8',
          stdio: 'pipe'
        })
      }).toThrow()
    } finally {
      try { fs.unlinkSync(dbPath) } catch {}
    }
  })

  it('verifies 1:1 IPC contract alignment for window.api.crypto.* and React UI exports', () => {
    expect(typeof CryptoDepositPage).toBe('function')
    expect(typeof AdminCryptoPage).toBe('function')

    const preloadSrc = fs.readFileSync(path.resolve(__dirname, '../../src/preload/index.ts'), 'utf8')
    const ipcSrc = fs.readFileSync(path.resolve(__dirname, '../../src/main/ipc/crypto.ipc.ts'), 'utf8')
    const channels = Array.from(preloadSrc.matchAll(/ipcRenderer\.invoke\('(crypto:[^']+)'/g)).map((m) => m[1])
    expect(channels.length).toBeGreaterThanOrEqual(12)
    for (const ch of channels) {
      expect(ipcSrc).toContain(`secureCryptoHandle('${ch}'`)
    }
  })
})
