// ──────────────────────────────────────────────────────────────────
// Migration 014 — In-House Multi-Crypto Payment Gateway Tables
// Additive, non-destructive financial schema using integer cents
// and network-aware (network, tx_hash) uniqueness constraints
// ──────────────────────────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 14
export const name = '014_inhouse_crypto_gateway'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_wallets (
      user_id        TEXT PRIMARY KEY,
      balance_cents  INTEGER NOT NULL DEFAULT 0,
      currency       TEXT NOT NULL DEFAULT 'USD',
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL,
      invoice_id           TEXT DEFAULT NULL,
      network              TEXT DEFAULT '',
      tx_hash              TEXT DEFAULT '',
      entry_type           TEXT NOT NULL, -- crypto_deposit, manual_adjustment, subscription_charge
      amount_cents         INTEGER NOT NULL,
      balance_after_cents  INTEGER NOT NULL,
      idempotency_key      TEXT NOT NULL UNIQUE,
      reason               TEXT DEFAULT '',
      created_at           TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);

    CREATE TABLE IF NOT EXISTS crypto_supported_networks (
      id                      TEXT PRIMARY KEY,
      symbol                  TEXT NOT NULL,
      network                 TEXT NOT NULL,
      network_label           TEXT NOT NULL,
      token_standard          TEXT NOT NULL,
      contract_address        TEXT DEFAULT '',
      decimals                INTEGER NOT NULL,
      receiving_address       TEXT DEFAULT '',
      min_deposit_usd_cents   INTEGER NOT NULL DEFAULT 1000,
      max_deposit_usd_cents   INTEGER NOT NULL DEFAULT 10000000,
      required_confirmations  INTEGER NOT NULL DEFAULT 12,
      invoice_expiry_minutes  INTEGER NOT NULL DEFAULT 30,
      primary_rpc_url         TEXT NOT NULL,
      fallback_rpc_url        TEXT DEFAULT '',
      enabled                 INTEGER NOT NULL DEFAULT 1,
      updated_at              TEXT NOT NULL,
      UNIQUE(symbol, network)
    );

    CREATE TABLE IF NOT EXISTS crypto_payment_invoices (
      id                      TEXT PRIMARY KEY,
      invoice_number          TEXT NOT NULL UNIQUE,
      user_id                 TEXT NOT NULL,
      network_id              TEXT NOT NULL,
      symbol                  TEXT NOT NULL,
      network                 TEXT NOT NULL,
      contract_address        TEXT DEFAULT '',
      decimals                INTEGER NOT NULL,
      requested_usd_cents     INTEGER NOT NULL,
      exchange_rate_micros    INTEGER NOT NULL,
      required_crypto_atomic  TEXT NOT NULL,
      received_crypto_atomic  TEXT NOT NULL DEFAULT '0',
      credited_usd_cents      INTEGER NOT NULL DEFAULT 0,
      deposit_address         TEXT NOT NULL,
      tx_hash                 TEXT DEFAULT NULL,
      confirmations           INTEGER NOT NULL DEFAULT 0,
      required_confirmations  INTEGER NOT NULL DEFAULT 12,
      status                  TEXT NOT NULL DEFAULT 'pending',
      expires_at              TEXT NOT NULL,
      credited_at             TEXT DEFAULT NULL,
      created_at              TEXT NOT NULL,
      updated_at              TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_crypto_inv_user ON crypto_payment_invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_crypto_inv_status ON crypto_payment_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_crypto_inv_addr ON crypto_payment_invoices(deposit_address);

    CREATE TABLE IF NOT EXISTS crypto_transactions (
      id              TEXT PRIMARY KEY,
      invoice_id      TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      network         TEXT NOT NULL,
      symbol          TEXT NOT NULL,
      tx_hash         TEXT NOT NULL,
      from_address    TEXT DEFAULT '',
      to_address      TEXT NOT NULL,
      contract_addr   TEXT DEFAULT '',
      amount_atomic   TEXT NOT NULL,
      confirmations   INTEGER NOT NULL DEFAULT 0,
      block_number    INTEGER DEFAULT 0,
      verified        INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'detected',
      detected_at     TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      UNIQUE(network, tx_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_crypto_tx_invoice ON crypto_transactions(invoice_id);

    CREATE TABLE IF NOT EXISTS crypto_payment_logs (
      id          TEXT PRIMARY KEY,
      invoice_id  TEXT DEFAULT NULL,
      network     TEXT DEFAULT '',
      level       TEXT NOT NULL DEFAULT 'info',
      event       TEXT NOT NULL,
      details     TEXT DEFAULT '',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crypto_reconciliation_logs (
      id                  TEXT PRIMARY KEY,
      checked_invoices    INTEGER NOT NULL DEFAULT 0,
      discrepancies_found INTEGER NOT NULL DEFAULT 0,
      summary_json        TEXT NOT NULL DEFAULT '{}',
      created_at          TEXT NOT NULL
    );
  `)
}
