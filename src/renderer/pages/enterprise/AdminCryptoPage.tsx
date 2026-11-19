import React, { useState, useEffect, useCallback } from 'react'
import type { ShowToastFn } from '../../types/enterprise'

export function AdminCryptoPage({ showToast }: { showToast: ShowToastFn }) {
  const cryptoApi = (window as any)?.api?.crypto

  const [overview, setOverview] = useState<any>(null)
  const [networks, setNetworks] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [editingNet, setEditingNet] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!cryptoApi) return setLoading(false)
    try {
      const [ov, nets, invs] = await Promise.all([
        cryptoApi.getAdminOverview(),
        cryptoApi.listNetworks(false),
        cryptoApi.listInvoices({ status: statusFilter || undefined, limit: 100 })
      ])
      setOverview(ov)
      setNetworks(nets || [])
      setInvoices(invs || [])
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setLoading(false)
    }
  }, [cryptoApi, statusFilter, showToast])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveNetwork = async () => {
    if (!editingNet) return
    try {
      await cryptoApi.updateNetworkConfig(editingNet.id, {
        enabled: editingNet.enabled,
        receivingAddress: editingNet.receivingAddress,
        minDepositUsdCents: Number(editingNet.minDepositUsdCents),
        maxDepositUsdCents: Number(editingNet.maxDepositUsdCents),
        requiredConfirmations: Number(editingNet.requiredConfirmations),
        primaryRpcUrl: editingNet.primaryRpcUrl,
        fallbackRpcUrl: editingNet.fallbackRpcUrl
      })
      showToast('success', `Updated ${editingNet.symbol} (${editingNet.networkLabel}) configuration`)
      setEditingNet(null)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleReconcile = async () => {
    try {
      const res = await cryptoApi.runReconciliation()
      showToast(res.discrepanciesFound === 0 ? 'success' : 'warning', `Reconciled ${res.checkedInvoices} credited invoices (${res.discrepanciesFound} discrepancies)`)
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleMonitorSweep = async () => {
    try {
      const res = await cryptoApi.runMonitorSweep()
      showToast('info', `Monitor sweep complete: ${res.rechecked} rechecked, ${res.expired} expired`)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Crypto Payment Admin...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">In-House Crypto Payment Admin</h1>
          <p className="page-subtitle">Configure receiving wallets, RPC endpoints, confirmation thresholds, and audit blockchain transactions</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleMonitorSweep}>↻ Run Monitor Sweep</button>
          <button className="btn btn-primary" onClick={handleReconcile}>⚖️ Reconcile Ledger</button>
        </div>
      </div>

      <div className="grid-stats" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-value">${((overview?.totalCreditedUsdCents || 0) / 100).toFixed(2)}</div>
          <div className="stat-card-label">Total Credited USD</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{overview?.totalDeposits || 0}</div>
          <div className="stat-card-label">Total Invoices</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{overview?.confirmingCount || 0}</div>
          <div className="stat-card-label">Awaiting Confirmations</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{overview?.monitorActive ? 'ONLINE' : 'STOPPED'}</div>
          <div className="stat-card-label">Blockchain Monitor</div>
        </div>
      </div>

      {/* Supported Networks Table */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Supported Cryptocurrencies & Networks (9)</h3>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Network</th>
              <th>Receiving Wallet</th>
              <th>Confs</th>
              <th>Min USD</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => (
              <tr key={n.id}>
                <td><strong>{n.symbol}</strong></td>
                <td>{n.networkLabel}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {n.receivingAddress ? `${n.receivingAddress.slice(0, 12)}...${n.receivingAddress.slice(-6)}` : <span style={{ color: '#F59E0B' }}>Not configured</span>}
                </td>
                <td>{n.requiredConfirmations}</td>
                <td>${(n.minDepositUsdCents / 100).toFixed(0)}</td>
                <td>{n.enabled ? '✅ Enabled' : '⛔ Disabled'}</td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => setEditingNet({ ...n })}>Configure</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transaction Monitor */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Incoming Invoices & Transactions</h3>
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
            <option value="">All Statuses</option>
            {['pending', 'detected', 'confirming', 'confirmed', 'credited', 'expired', 'underpaid', 'overpaid', 'failed', 'manual_review'].map((s) => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>
        {invoices.length === 0 ? (
          <div className="text-secondary">No invoices match the current filter.</div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>User</th>
                <th>Asset / Network</th>
                <th>Requested</th>
                <th>Received</th>
                <th>TxHash</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{inv.invoiceNumber}</td>
                  <td style={{ fontSize: 11 }}>{inv.userId.slice(0, 10)}</td>
                  <td>{inv.symbol} ({inv.network})</td>
                  <td>${(inv.requestedUsdCents / 100).toFixed(2)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{inv.receivedCryptoDisplay} {inv.symbol}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{inv.txHash ? `${inv.txHash.slice(0, 14)}...` : '—'}</td>
                  <td><strong>{String(inv.status).toUpperCase()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Network Config Modal */}
      {editingNet && (
        <>
          <div className="modal-backdrop" onClick={() => setEditingNet(null)} />
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">Configure {editingNet.symbol} ({editingNet.networkLabel})</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditingNet(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editingNet.enabled} onChange={(e) => setEditingNet({ ...editingNet, enabled: e.target.checked })} />
                Enable this network for customer deposits
              </label>
              <div>
                <label className="form-label">Receiving Wallet Address</label>
                <input className="form-input" value={editingNet.receivingAddress} onChange={(e) => setEditingNet({ ...editingNet, receivingAddress: e.target.value })} style={{ width: '100%', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Required Confirmations</label>
                  <input type="number" className="form-input" value={editingNet.requiredConfirmations} onChange={(e) => setEditingNet({ ...editingNet, requiredConfirmations: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label className="form-label">Min Deposit (USD Cents)</label>
                  <input type="number" className="form-input" value={editingNet.minDepositUsdCents} onChange={(e) => setEditingNet({ ...editingNet, minDepositUsdCents: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label className="form-label">Primary RPC URL</label>
                <input className="form-input" value={editingNet.primaryRpcUrl} onChange={(e) => setEditingNet({ ...editingNet, primaryRpcUrl: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <label className="form-label">Fallback RPC URL</label>
                <input className="form-input" value={editingNet.fallbackRpcUrl} onChange={(e) => setEditingNet({ ...editingNet, fallbackRpcUrl: e.target.value })} style={{ width: '100%' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingNet(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNetwork}>Save Network Config</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
