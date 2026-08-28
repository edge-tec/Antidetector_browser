// ──────────────────────────────────────────────
// AntiProfiles — Migration 012: Payments, Billing, Invoices & Payment Gateways
// ──────────────────────────────────────────────

import type Database from 'better-sqlite3'

export const id = 12
export const name = '012_payments_and_gateways'

export function up(db: Database.Database): void {
  // 1. Invoices Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id              TEXT PRIMARY KEY,
      invoice_number  TEXT NOT NULL UNIQUE,
      user_id         TEXT NOT NULL,
      plan_id         TEXT NOT NULL,
      amount          REAL NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'USD',
      status          TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled, refunded
      gateway         TEXT,
      transaction_id  TEXT,
      metadata        TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      paid_at         TEXT,
      expires_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(status);
  `)

  // 2. Payments Table
  db.exec(`
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
      status              TEXT NOT NULL DEFAULT 'paid', -- paid, pending, failed, refunded
      payment_method      TEXT DEFAULT 'card',
      invoice_url         TEXT,
      metadata            TEXT,
      paid_at             TEXT DEFAULT (datetime('now')),
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_pay_tx ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status);
  `)

  // 3. Payment Gateways Table
  db.exec(`
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
  `)

  // Seed default payment gateways if not exist
  const defaultGateways = [
    {
      id: 'gw_stripe',
      gateway_key: 'stripe',
      name: 'Stripe (Credit / Debit Cards, Apple Pay, Google Pay)',
      is_enabled: 1,
      is_test_mode: 1,
      public_key: 'pk_test_sample_stripe_key',
      secret_key: 'sk_test_sample_stripe_secret',
      webhook_secret: 'whsec_sample_secret',
      currency: 'USD',
      config_json: JSON.stringify({
        allowed_methods: ['card', 'apple_pay', 'google_pay'],
        statement_descriptor: 'AntiProfiles Inc.'
      })
    },
    {
      id: 'gw_crypto',
      gateway_key: 'crypto',
      name: 'Cryptocurrency (USDT TRC20 / ERC20, BTC, ETH)',
      is_enabled: 1,
      is_test_mode: 0,
      public_key: 'usdt_trc20_wallet_address_placeholder',
      secret_key: '',
      webhook_secret: '',
      currency: 'USD',
      config_json: JSON.stringify({
        provider: 'nowpayments',
        supported_coins: ['USDT-TRC20', 'USDT-ERC20', 'BTC', 'ETH', 'LTC'],
        wallet_address_trc20: 'TExampleUSDTWalletAddressTRC20',
        wallet_address_erc20: '0xExampleUSDTWalletAddressERC20',
        wallet_address_btc: '1ExampleBitcoinWalletAddress',
        min_deposit_usd: 10
      })
    },
    {
      id: 'gw_paypal',
      gateway_key: 'paypal',
      name: 'PayPal / Venmo',
      is_enabled: 0,
      is_test_mode: 1,
      public_key: '',
      secret_key: '',
      webhook_secret: '',
      currency: 'USD',
      config_json: JSON.stringify({
        client_id: '',
        mode: 'sandbox'
      })
    },
    {
      id: 'gw_manual_bank',
      gateway_key: 'manual_bank',
      name: 'Manual Wire Transfer / Wise / Payoneer',
      is_enabled: 1,
      is_test_mode: 0,
      public_key: '',
      secret_key: '',
      webhook_secret: '',
      currency: 'USD',
      config_json: JSON.stringify({
        instructions: 'Please transfer to Wise account: payments@antiprofiles.com with your account email as reference.',
        wise_email: 'payments@antiprofiles.com',
        payoneer_email: 'billing@antiprofiles.com'
      })
    }
  ]

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO payment_gateways (
      id, gateway_key, name, is_enabled, is_test_mode, public_key, secret_key, webhook_secret, currency, config_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const gw of defaultGateways) {
    try {
      insertStmt.run(
        gw.id, gw.gateway_key, gw.name, gw.is_enabled, gw.is_test_mode,
        gw.public_key, gw.secret_key, gw.webhook_secret, gw.currency, gw.config_json
      )
    } catch {}
  }
}
