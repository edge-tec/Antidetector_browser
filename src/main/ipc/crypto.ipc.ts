// ──────────────────────────────────────────────────────────────────
// AntiProfiles — In-House Crypto Payment Gateway IPC Handlers
// Protected by assertTrustedIpcSender (Electron origin validation)
// ──────────────────────────────────────────────────────────────────

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { assertTrustedIpcSender } from './enterprise.ipc'
import { cryptoGatewayService } from '../crypto/crypto-gateway.service'
import { CryptoExchangeRateService } from '../crypto/exchange-rate.service'
import { UserBalanceCreditService } from '../crypto/balance-credit.service'

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
  secureCryptoHandle('crypto:wallet:balance', (_e, userId: string) => ({
    balanceCents: UserBalanceCreditService.getUserBalanceCents(userId)
  }))
  secureCryptoHandle('crypto:wallet:ledger', (_e, userId: string, limit?: number) =>
    UserBalanceCreditService.getUserLedger(userId, limit)
  )

  // Admin APIs
  secureCryptoHandle('crypto:admin:overview', () =>
    cryptoGatewayService.getAdminOverview()
  )
  secureCryptoHandle('crypto:admin:update-network', (_e, networkId: string, patch: any) =>
    cryptoGatewayService.updateNetworkConfig(networkId, patch)
  )
  secureCryptoHandle('crypto:admin:reconcile', () =>
    cryptoGatewayService.runReconciliation()
  )
  secureCryptoHandle('crypto:admin:monitor-sweep', async () =>
    cryptoGatewayService.runMonitorSweep()
  )
}
