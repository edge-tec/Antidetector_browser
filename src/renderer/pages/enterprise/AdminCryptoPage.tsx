import React, { useState, useEffect, useCallback } from 'react'
import type { ShowToastFn } from '../../types/enterprise'

export function AdminCryptoPage({ showToast }: { showToast: ShowToastFn }) {
  const cryptoApi = (window as any)?.api?.crypto

  const [overview, setOverview] = useState<any>(null)
  const [hdConfig, setHdConfig] = useState<any>(null)
  const [revealedMnemonic, setRevealedMnemonic] = useState<string | null>(null)
  const [customMnemonicInput, setCustomMnemonicInput] = useState('')
  const [sweepLogs, setSweepLogs] = useState<any[]>([])
  const [networks, setNetworks] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [editingNet, setEditingNet] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!cryptoApi) return setLoading(false)
    try {
      const [ov, nets, invs, hd, sweeps] = await Promise.all([
        cryptoApi.getAdminOverview(),
        cryptoApi.listNetworks(false),
        cryptoApi.listInvoices({ status: statusFilter || undefined, limit: 100 }),
        cryptoApi.getHdWalletConfig?.().catch(() => null),
        cryptoApi.listSweepLogs?.(30).catch(() => [])
      ])
      setOverview(ov)
      setNetworks(nets || [])
      setInvoices(invs || [])
      setHdConfig(hd)
      setSweepLogs(sweeps || [])
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setLoading(false)
    }
  }, [cryptoApi, statusFilter, showToast])

  useEffect(() => { loadData() }, [loadData])

  const handleRevealMnemonic = async () => {
    if (revealedMnemonic) {
      setRevealedMnemonic(null)
      return
    }
    try {
      const res = await cryptoApi.revealHdMnemonic()
      setRevealedMnemonic(res?.mnemonic || '')
      showToast('info', 'Trust Wallet 12-word recovery phrase unlocked')
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleSaveHdConfig = async (patch: any, msg = 'Trust Wallet HD & Auto-Sweep configuration saved') => {
    try {
      const updated = await cryptoApi.saveHdWalletConfig(patch)
      setHdConfig(updated)
      setCustomMnemonicInput('')
      if (patch.generateNewSeed || patch.mnemonic) {
        const rev = await cryptoApi.revealHdMnemonic()
        setRevealedMnemonic(rev?.mnemonic || null)
      }
      showToast('success', msg)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleManualSweep = async (invoiceId: string) => {
    try {
      const res = await cryptoApi.sweepInvoiceToTrustWallet(invoiceId)
      showToast('success', `Swept to Trust Wallet Master (${res.sweepTxHash.slice(0, 14)}...)`)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

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

      {/* Trust Wallet Connected HD Seed & Auto-Sweep Treasury */}
      {hdConfig && (
        <div className="card" style={{ padding: 18, marginBottom: 20, border: '1px solid rgba(59,130,246,0.35)', background: 'linear-gradient(135deg, rgba(30,41,59,0.7), rgba(15,23,42,0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                🛡️ Trust Wallet Connected HD Wallet & Auto-Sweep Treasury (BIP-32 / BIP-39 / BIP-44)
              </h3>
              <p className="text-secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Every customer deposit invoice automatically derives a unique child address from your Trust Wallet seed phrase, auto-verifies incoming funds on-chain, and auto-sweeps them to your Trust Wallet Master Treasury (Index #0).
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleRevealMnemonic}>
                {revealedMnemonic ? '🙈 Hide Seed Phrase' : '🔑 Reveal 12-Word Trust Wallet Phrase'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleSaveHdConfig({ generateNewSeed: true }, 'Generated new 12-word Trust Wallet HD seed & synced Master Addresses')}
              >
                🎲 Generate New 12-Word Seed
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14, padding: 10, borderRadius: 8, background: 'rgba(15,23,42,0.55)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!hdConfig.hdEnabled}
                onChange={(e) => handleSaveHdConfig({ hdEnabled: e.target.checked })}
              />
              <strong>Auto-Derive Unique HD Address per Invoice</strong>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!hdConfig.autoDetectEnabled}
                onChange={(e) => handleSaveHdConfig({ autoDetectEnabled: e.target.checked })}
              />
              <strong>Auto-Detect & Verify On-Chain Without TxHash</strong>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!hdConfig.autoSweepEnabled}
                onChange={(e) => handleSaveHdConfig({ autoSweepEnabled: e.target.checked })}
              />
              <strong>Auto-Sweep Verified Funds to Trust Wallet Master</strong>
            </label>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#60A5FA' }}>
              Next HD Child Index: <strong>#{hdConfig.nextDerivationIndex}</strong>
            </span>
          </div>

          {/* Mnemonic Display / Import */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(15,23,42,0.65)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Active Trust Wallet BIP-39 Seed Phrase (Import this 12-word phrase in Trust Wallet Mobile/Extension):
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, color: revealedMnemonic ? '#34D399' : '#94A3B8', wordBreak: 'break-word' }}>
                  {revealedMnemonic || hdConfig.mnemonicPreview}
                </code>
                {revealedMnemonic && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { navigator.clipboard.writeText(revealedMnemonic); showToast('success', 'Trust Wallet 12-word seed copied') }}
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(15,23,42,0.65)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Connect Existing Trust Wallet (Paste 12 or 24-word Mnemonic Phrase):
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="form-input"
                  placeholder="word1 word2 word3 ... word12"
                  value={customMnemonicInput}
                  onChange={(e) => setCustomMnemonicInput(e.target.value)}
                  style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={customMnemonicInput.trim().split(/\s+/).length < 12}
                  onClick={() => handleSaveHdConfig({ mnemonic: customMnemonicInput.trim() }, 'Connected your Trust Wallet mnemonic phrase & derived Master Addresses')}
                >
                  Connect Trust Wallet
                </button>
              </div>
            </div>
          </div>

          {/* Derived Trust Wallet Master Treasury Addresses (Index 0) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 6, background: 'rgba(15,23,42,0.45)', fontSize: 11 }}>
              <span className="text-secondary">EVM Master (ETH / BSC / Polygon • m/44&apos;/60&apos;/0&apos;/0/0):</span>
              <div style={{ fontFamily: 'monospace', color: '#E2E8F0', marginTop: 2 }}>{hdConfig.trustMasterEvmAddress}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 6, background: 'rgba(15,23,42,0.45)', fontSize: 11 }}>
              <span className="text-secondary">TRON Master (TRX / USDT-TRC20 • m/44&apos;/195&apos;/0&apos;/0/0):</span>
              <div style={{ fontFamily: 'monospace', color: '#E2E8F0', marginTop: 2 }}>{hdConfig.trustMasterTronAddress}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 6, background: 'rgba(15,23,42,0.45)', fontSize: 11 }}>
              <span className="text-secondary">Bitcoin Native SegWit Master (BTC • m/84&apos;/0&apos;/0&apos;/0/0):</span>
              <div style={{ fontFamily: 'monospace', color: '#E2E8F0', marginTop: 2 }}>{hdConfig.trustMasterBtcAddress}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 6, background: 'rgba(15,23,42,0.45)', fontSize: 11 }}>
              <span className="text-secondary">Solana Master (SOL • m/44&apos;/501&apos;/0&apos;/0&apos;):</span>
              <div style={{ fontFamily: 'monospace', color: '#E2E8F0', marginTop: 2 }}>{hdConfig.trustMasterSolAddress}</div>
            </div>
          </div>
        </div>
      )}

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
                <th>Asset / Network</th>
                <th>HD Child Address & Path</th>
                <th>Requested</th>
                <th>Received</th>
                <th>Auto-Sweep to Trust Wallet</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{inv.invoiceNumber}</td>
                  <td>{inv.symbol} ({inv.network})</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    <div>{inv.depositAddress ? `${inv.depositAddress.slice(0, 10)}...${inv.depositAddress.slice(-6)}` : '—'}</div>
                    {inv.derivationPath && <span style={{ fontSize: 10, color: '#60A5FA' }}>{inv.derivationPath}</span>}
                  </td>
                  <td>${(inv.requestedUsdCents / 100).toFixed(2)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{inv.receivedCryptoDisplay} {inv.symbol}</td>
                  <td style={{ fontSize: 11 }}>
                    {inv.sweepStatus === 'swept' ? (
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>
                        ✅ Swept ({inv.sweepTxHash ? `${inv.sweepTxHash.slice(0, 10)}...` : 'OK'})
                      </span>
                    ) : (inv.status === 'credited' || inv.status === 'overpaid') ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleManualSweep(inv.id)}>
                        ⚡ Sweep to Trust Wallet
                      </button>
                    ) : (
                      <span className="text-secondary">Awaiting deposit</span>
                    )}
                  </td>
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
