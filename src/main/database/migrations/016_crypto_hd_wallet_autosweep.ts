// ──────────────────────────────────────────────────────────────────
// Migration 016 — HD Wallet (Trust Wallet BIP39/BIP44) & Auto-Sweep Schema
// Adds derivation_index, derivation_path, sweep_status, sweep_tx_hash,
// and crypto_hd_wallet_config table for automated per-invoice addresses
// and automatic sweeping into the master Trust Wallet treasury.
// ──────────────────────────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 16
export const name = '016_crypto_hd_wallet_autosweep'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crypto_hd_wallet_config (
      id                        TEXT PRIMARY KEY DEFAULT 'default',
      encrypted_mnemonic        TEXT DEFAULT '',
      wallet_label              TEXT DEFAULT 'Trust Wallet Multi-Chain HD Vault',
      hd_enabled                INTEGER NOT NULL DEFAULT 1,
      auto_detect_enabled       INTEGER NOT NULL DEFAULT 1,
      auto_sweep_enabled        INTEGER NOT NULL DEFAULT 1,
      next_derivation_index     INTEGER NOT NULL DEFAULT 1,
      trust_master_evm_address  TEXT DEFAULT '',
      trust_master_tron_address TEXT DEFAULT '',
      trust_master_btc_address  TEXT DEFAULT '',
      trust_master_sol_address  TEXT DEFAULT '',
      updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crypto_sweep_logs (
      id              TEXT PRIMARY KEY,
      invoice_id      TEXT NOT NULL,
      network         TEXT NOT NULL,
      symbol          TEXT NOT NULL,
      from_address    TEXT NOT NULL,
      to_master_addr  TEXT NOT NULL,
      amount_atomic   TEXT NOT NULL,
      sweep_tx_hash   TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'swept',
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_crypto_sweep_inv ON crypto_sweep_logs(invoice_id);
  `)

  const alterCols = [
    "ALTER TABLE crypto_payment_invoices ADD COLUMN derivation_index INTEGER DEFAULT NULL",
    "ALTER TABLE crypto_payment_invoices ADD COLUMN derivation_path TEXT DEFAULT ''",
    "ALTER TABLE crypto_payment_invoices ADD COLUMN sweep_status TEXT DEFAULT 'pending'",
    "ALTER TABLE crypto_payment_invoices ADD COLUMN sweep_tx_hash TEXT DEFAULT NULL",
    "ALTER TABLE crypto_payment_invoices ADD COLUMN swept_at TEXT DEFAULT NULL"
  ]

  for (const sql of alterCols) {
    try {
      db.exec(sql)
    } catch {
      // Column already exists
    }
  }
}
