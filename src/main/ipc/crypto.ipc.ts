// ──────────────────────────────────────────────────────────────────
// AntiProfiles — In-House Crypto Payment Gateway IPC Handlers
// Protected by assertTrustedIpcSender (Electron origin validation)
// ──────────────────────────────────────────────────────────────────

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { assertTrustedIpcSender } from './enterprise.ipc'
import { sessionManager } from '../security/session'
import { cryptoGatewayService } from '../crypto/crypto-gateway.service'
import { CryptoExchangeRateService } from '../crypto/exchange-rate.service'
import { UserBalanceCreditService } from '../crypto/balance-credit.service'
import { HdWalletService } from '../crypto/hd-wallet.service'

export function assertAdminCryptoSession(sessionToken?: string): void {
  if (!sessionToken || typeof sessionToken !== 'string' || !sessionToken.trim()) {
    throw new Error('Unauthorized: Admin privileges required for crypto gateway administration.')
  }
  const user = sessionManager.getSessionUser(sessionToken)
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: Admin privileges required for crypto gateway administration.')
  }
}

function secureCryptoHandle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => any): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event)
    return handler(event, ...args)
  })
}

export function registerCryptoPaymentHandlers(): void {
  cryptoGatewayService.ensureSeededNetworks()
  cryptoGatewayService.startBackgroundMonitor(30_000)

  // Customer APIs
  secureCryptoHandle('crypto:networks:list', (_e, onlyEnabled?: boolean) =>
    cryptoGatewayService.listNetworks(!!onlyEnabled)
  )
  secureCryptoHandle('crypto:rate:get', async (_e, symbol: string) =>
    CryptoExchangeRateService.getUsdRateMicros(symbol)
  )
  secureCryptoHandle('crypto:invoice:create', async (_e, userId: string, networkId: string, usdAmount: number) =>
    cryptoGatewayService.createDepositInvoice(userId, networkId, usdAmount)
  )
  secureCryptoHandle('crypto:invoice:get', (_e, invoiceId: string) =>
    cryptoGatewayService.getInvoice(invoiceId)
  )
  secureCryptoHandle('crypto:invoice:list', (_e, filter?: any) =>
    cryptoGatewayService.listInvoices(filter)
  )
  secureCryptoHandle('crypto:tx:verify', async (_e, invoiceId: string, txHash: string) =>
    cryptoGatewayService.verifyAndProcessTransaction(invoiceId, txHash)
  )
  secureCryptoHandle('crypto:invoice:auto-check', async (_e, invoiceId: string) =>
    cryptoGatewayService.autoCheckInvoiceDeposit(invoiceId)
  )
  secureCryptoHandle('crypto:wallet:balance', (_e, userId: string) => ({
    balanceCents: UserBalanceCreditService.getUserBalanceCents(userId)
  }))
  secureCryptoHandle('crypto:wallet:ledger', (_e, userId: string, limit?: number) =>
    UserBalanceCreditService.getUserLedger(userId, limit)
  )

  // Admin APIs (strict backend admin role enforcement)
  secureCryptoHandle('crypto:admin:overview', (_e, sessionToken?: string) => {
    assertAdminCryptoSession(sessionToken)
    return cryptoGatewayService.getAdminOverview()
  })
  secureCryptoHandle('crypto:admin:update-network', (_e, sessionToken: string, networkId: string, patch: any) => {
    assertAdminCryptoSession(sessionToken)
    return cryptoGatewayService.updateNetworkConfig(networkId, patch)
  })
  secureCryptoHandle('crypto:admin:reconcile', (_e, sessionToken?: string) => {
    assertAdminCryptoSession(sessionToken)
    return cryptoGatewayService.runReconciliation()
  })
  secureCryptoHandle('crypto:admin:monitor-sweep', async (_e, sessionToken?: string) => {
    assertAdminCryptoSession(sessionToken)
    return cryptoGatewayService.runMonitorSweep()
  })

  // Trust Wallet HD Seed & Auto-Sweep Admin APIs
  secureCryptoHandle('crypto:hd:get-config', (_e, sessionToken?: string) => {
    assertAdminCryptoSession(sessionToken)
    return HdWalletService.getConfig()
  })
  secureCryptoHandle('crypto:hd:save-config', (_e, sessionToken: string, patch: any) => {
    assertAdminCryptoSession(sessionToken)
    return HdWalletService.saveConfig(patch || {})
  })
  secureCryptoHandle('crypto:hd:reveal-mnemonic', (_e, sessionToken?: string) => {
    assertAdminCryptoSession(sessionToken)
    return HdWalletService.revealMnemonic()
  })
  secureCryptoHandle('crypto:hd:sweep-invoice', async (_e, sessionToken: string, invoiceId: string) => {
    assertAdminCryptoSession(sessionToken)
    return HdWalletService.sweepInvoiceToTrustWallet(invoiceId)
  })
  secureCryptoHandle('crypto:hd:sweep-logs', (_e, sessionToken?: string, limit?: number) => {
    assertAdminCryptoSession(sessionToken)
    return HdWalletService.listSweepLogs(limit || 50)
  })
}
