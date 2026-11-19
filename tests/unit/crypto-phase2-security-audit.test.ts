import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as migration014 from '../../src/main/database/migrations/014_inhouse_crypto_gateway'
import { hex20ToTronBase58, parseTronTrc20TransferData, assertExpectedEvmChainId } from '../../src/main/crypto/rpc-client.service'
import { PaymentVerificationService, InvoiceForVerification } from '../../src/main/crypto/payment-verification.service'
import { assertAdminCryptoSession } from '../../src/main/ipc/crypto.ipc'

describe('Phase 2 — Independent Crypto Gateway Security Audit & Attack Simulations', () => {
  it('decodes TRON TRC20 transfer(address,uint256) calldata to real Base58Check recipient and blocks spoofed recipient', () => {
    // Official USDT-TRC20 contract hex20 -> TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
    const officialTrc20Hex20 = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c'
    expect(hex20ToTronBase58(officialTrc20Hex20)).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')

    const amountHex = (25_000_000n).toString(16).padStart(64, '0')
    const calldata = 'a9059cbb' + '000000000000000000000000' + officialTrc20Hex20 + amountHex
    const decoded = parseTronTrc20TransferData(calldata)
    expect(decoded.matched).toBe(true)
    expect(decoded.toAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    expect(decoded.amountAtomic).toBe('25000000')

    // Attack: submit this tx against an invoice expecting a DIFFERENT TRON wallet
    const invoice: InvoiceForVerification = {
      id: 'inv-tron-1',
      userId: 'u-1',
      symbol: 'USDT',
      network: 'tron',
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      decimals: 6,
      depositAddress: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
      requiredCryptoAtomic: '25000000',
      requiredConfirmations: 20,
      status: 'pending',
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString()
    }
    const res = PaymentVerificationService.verifyObservation(
      invoice,
      {
        found: true,
        network: 'tron',
        txHash: 'tron-tx-spoof',
        executionSuccess: true,
        fromAddress: 'TFromAddress',
        toAddress: decoded.toAddress,
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        amountAtomic: decoded.amountAtomic,
        confirmations: 25,
        blockNumber: 65000000,
        rpcEndpointUsed: 'https://api.trongrid.io'
      },
      { isDuplicateTxOnNetwork: false }
    )
    expect(res.valid).toBe(false)
    expect(res.shouldCredit).toBe(false)
    expect(res.nextStatus).toBe('failed')
    expect(res.reason).toMatch(/Recipient address mismatch/i)
  })

  it('blocks historical transaction replay on shared receiving wallets (tx older than invoice createdAt)', () => {
    const now = Date.now()
    const invoice: InvoiceForVerification = {
      id: 'inv-hist-1',
      userId: 'u-1',
      symbol: 'ETH',
      network: 'ethereum',
      contractAddress: '',
      decimals: 18,
      depositAddress: '0x1111111111111111111111111111111111111111',
      requiredCryptoAtomic: '100000000000000000',
      requiredConfirmations: 12,
      status: 'pending',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1800_000).toISOString()
    }

    const res = PaymentVerificationService.verifyObservation(
      invoice,
      {
        found: true,
        network: 'ethereum',
        txHash: '0xoldtx1234567890',
        executionSuccess: true,
        fromAddress: '0x2222222222222222222222222222222222222222',
        toAddress: '0x1111111111111111111111111111111111111111',
        contractAddress: '',
        amountAtomic: '100000000000000000',
        confirmations: 100,
        blockNumber: 19999000,
        blockTimestampMs: now - 10 * 60 * 1000, // 10 minutes BEFORE invoice creation
        rpcEndpointUsed: 'https://ethereum-rpc.publicnode.com'
      },
      { isDuplicateTxOnNetwork: false, nowMs: now }
    )

    expect(res.valid).toBe(false)
    expect(res.shouldCredit).toBe(false)
    expect(res.nextStatus).toBe('manual_review')
    expect(res.reason).toMatch(/Historical transaction predates invoice creation/i)
  })

  it('rejects reverted transactions and zero-confirmation mempool transactions', () => {
    const now = Date.now()
    const invoice: InvoiceForVerification = {
      id: 'inv-rev-1',
      userId: 'u-1',
      symbol: 'BNB',
      network: 'bsc',
      contractAddress: '',
      decimals: 18,
      depositAddress: '0x1111111111111111111111111111111111111111',
      requiredCryptoAtomic: '100000000000000000',
      requiredConfirmations: 15,
      status: 'pending',
      createdAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 1800_000).toISOString()
    }

    const reverted = PaymentVerificationService.verifyObservation(
      invoice,
      {
        found: true, network: 'bsc', txHash: '0xrev', executionSuccess: false,
        fromAddress: '0x2222222222222222222222222222222222222222',
        toAddress: '0x1111111111111111111111111111111111111111',
        contractAddress: '', amountAtomic: '100000000000000000', confirmations: 20, blockNumber: 1, rpcEndpointUsed: 'https://bsc-dataseed.binance.org'
      },
      { isDuplicateTxOnNetwork: false }
    )
    expect(reverted.shouldCredit).toBe(false)
    expect(reverted.nextStatus).toBe('failed')

    const mempool = PaymentVerificationService.verifyObservation(
      invoice,
      {
        found: true, network: 'bsc', txHash: '0xmem', executionSuccess: false,
        fromAddress: '0x2222222222222222222222222222222222222222',
        toAddress: '0x1111111111111111111111111111111111111111',
        contractAddress: '', amountAtomic: '100000000000000000', confirmations: 0, blockNumber: 0, rpcEndpointUsed: 'https://bsc-dataseed.binance.org'
      },
      { isDuplicateTxOnNetwork: false }
    )
    expect(mempool.shouldCredit).toBe(false)
    expect(mempool.nextStatus).toBe('detected')
  })

  it('enforces exact EVM eth_chainId to prevent mainnet/testnet cross-chain RPC spoofing', () => {
    expect(() => assertExpectedEvmChainId('ethereum', '0x1')).not.toThrow()
    expect(() => assertExpectedEvmChainId('bsc', '0x38')).not.toThrow()
    expect(() => assertExpectedEvmChainId('polygon', '0x89')).not.toThrow()
    // Sepolia (0xaa36a7) or BSC (0x38) returned for Ethereum must be rejected
    expect(() => assertExpectedEvmChainId('ethereum', '0xaa36a7')).toThrow(/chainId mismatch/i)
    expect(() => assertExpectedEvmChainId('ethereum', '0x38')).toThrow(/chainId mismatch/i)
    expect(() => assertExpectedEvmChainId('bsc', '0x1')).toThrow(/chainId mismatch/i)
  })

  it('blocks unauthorized crypto admin IPC calls without valid admin session token', () => {
    expect(() => assertAdminCryptoSession(undefined)).toThrow(/Unauthorized: Admin privileges required/i)
    expect(() => assertAdminCryptoSession('')).toThrow(/Unauthorized: Admin privileges required/i)
    expect(() => assertAdminCryptoSession('invalid-token-123')).toThrow(/Unauthorized: Admin privileges required/i)
  })

  it('enforces UNIQUE(idempotency_key) in wallet_ledger on real sqlite3 to prevent double-crediting', () => {
    const dbPath = path.join(os.tmpdir(), `ap-ledger-dup-${Date.now()}.sqlite`)
    const captured: string[] = []
    migration014.up({ exec: (sql: string) => captured.push(sql) } as any)
    try {
      execFileSync('sqlite3', [dbPath], { input: captured.join('\n'), encoding: 'utf8' })
      execFileSync('sqlite3', [dbPath], {
        input: `
          INSERT INTO wallet_ledger (id, user_id, invoice_id, network, tx_hash, entry_type, amount_cents, balance_after_cents, idempotency_key, created_at)
          VALUES ('l1', 'u1', 'i1', 'ethereum', '0xabc', 'crypto_deposit', 5000, 5000, 'crypto:ethereum:0xabc', '2026-01-01');
        `,
        encoding: 'utf8'
      })
      expect(() => {
        execFileSync('sqlite3', [dbPath], {
          input: `
            INSERT INTO wallet_ledger (id, user_id, invoice_id, network, tx_hash, entry_type, amount_cents, balance_after_cents, idempotency_key, created_at)
            VALUES ('l2', 'u1', 'i1', 'ethereum', '0xabc', 'crypto_deposit', 5000, 10000, 'crypto:ethereum:0xabc', '2026-01-01');
          `,
          encoding: 'utf8',
          stdio: 'pipe'
        })
      }).toThrow()
    } finally {
      try { fs.unlinkSync(dbPath) } catch {}
    }
  })
})
