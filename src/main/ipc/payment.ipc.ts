// ──────────────────────────────────────────────
// AntiProfiles — Payment & Billing IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { paymentService } from '../services/payment.service'
import { authorizeUser } from '../security/session'

export function registerPaymentIpcHandlers(): void {
  // 1. Admin: Get Overview (All user purchases, transactions, metrics, gateways)
  ipcMain.handle('admin:get-payments-overview', async (_event, sessionToken: string, options: { search?: string; status?: string; gateway?: string } = {}) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const data = paymentService.getAdminPaymentsOverview(options.search, options.status, options.gateway)
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch payments.' }
    }
  })

  // 2. Admin: Get Gateways
  ipcMain.handle('admin:get-payment-gateways', async (_event, sessionToken: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const gateways = paymentService.getAllGateways()
      return { success: true, data: gateways }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 3. Admin: Save / Toggle Gateway Configuration
  ipcMain.handle('admin:save-payment-gateway', async (_event, sessionToken: string, gatewayData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const saved = paymentService.saveGateway(gatewayData)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save gateway.' }
    }
  })

  // 4. Admin: Set Trial Period for Any User / Subscription
  ipcMain.handle('admin:set-user-trial', async (_event, sessionToken: string, input: { userId: string; trialDays: number; planId?: string }) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      if (!input?.userId) {
        return { success: false, error: 'User ID is required.' }
      }
      const res = paymentService.setUserTrial(input.userId, input.trialDays || 7, input.planId || 'plan_starter')
      return { success: true, data: res }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to set trial period.' }
    }
  })

  // 5. Admin: Record Manual Payment
  ipcMain.handle('admin:record-manual-payment', async (_event, sessionToken: string, paymentData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const record = paymentService.recordManualPayment(paymentData)
      return { success: true, data: record }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to record manual payment.' }
    }
  })

  // 6. Admin: Refund Payment
  ipcMain.handle('admin:refund-payment', async (_event, sessionToken: string, input: { paymentId: string; reason?: string }) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const res = paymentService.refundPayment(input.paymentId, input.reason)
      return { success: true, data: res }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to refund payment.' }
    }
  })

  // 7. Admin: Get Global Free Trial Policy
  ipcMain.handle('admin:get-global-trial-config', async (_event, sessionToken: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const data = paymentService.getGlobalTrialConfig()
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 8. Admin: Save Global Free Trial Policy
  ipcMain.handle('admin:save-global-trial-config', async (_event, sessionToken: string, config: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }
    try {
      const data = paymentService.saveGlobalTrialConfig(config)
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 9. Client / Public: Get Enabled Gateways for Checkout
  ipcMain.handle('payment:get-available-gateways', async () => {
    try {
      const gateways = paymentService.getPublicGateways()
      return { success: true, data: gateways }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
