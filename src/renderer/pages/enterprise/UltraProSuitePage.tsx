import React, { useEffect, useState } from 'react'

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const UltraProSuitePage: React.FC<Props> = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState<'cookie-robot' | 'vault' | 'stealth' | 'bulk-proxy'>('cookie-robot')
  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  // Bulk Proxy & Fraud Score State
  const [bulkProxyText, setBulkProxyText] = useState<string>('')
  const [bulkProxyProtocol, setBulkProxyProtocol] = useState<string>('socks5')
  const [importingProxies, setImportingProxies] = useState(false)
  const [fraudIpInput, setFraudIpInput] = useState<string>('')
  const [fraudReport, setFraudReport] = useState<any>(null)
  const [checkingFraud, setCheckingFraud] = useState(false)

  // Cookie Robot State
  const [presets, setPresets] = useState<any[]>([])
  const [customUrls, setCustomUrls] = useState<string>('https://www.wikipedia.org\nhttps://www.bbc.com\nhttps://www.imdb.com')
  const [robotRuns, setRobotRuns] = useState<any[]>([])
  const [runningRobot, setRunningRobot] = useState(false)

  // 2FA Vault State
  const [vaultAccounts, setVaultAccounts] = useState<any[]>([])
  const [platform, setPlatform] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpSecret, setTotpSecret] = useState('')

  // Stealth Audit State
  const [auditReport, setAuditReport] = useState<any>(null)
  const [auditing, setAuditing] = useState(false)

  const api = (window as any).api

  useEffect(() => {
    ;(async () => {
      try {
        const profs = await api?.getProfiles?.()
        const list = Array.isArray(profs) ? profs : profs?.profiles || []
        setProfiles(list)
        if (list.length > 0 && !selectedProfileId) setSelectedProfileId(list[0].id)
      } catch {}

      try {
        const pr = await api?.ultraPro?.getCookieRobotPresets?.()
        if (pr?.presets) setPresets(pr.presets)
      } catch {}
    })()
  }, [])

  const refreshRuns = async (pid?: string) => {
    const res = await api?.ultraPro?.getCookieRobotRuns?.(pid || undefined)
    if (res?.runs) setRobotRuns(res.runs)
  }

  const refreshVault = async (pid?: string) => {
    const res = await api?.ultraPro?.listVaultAccounts?.(pid || undefined)
    if (res?.accounts) setVaultAccounts(res.accounts)
  }

  useEffect(() => {
    refreshRuns(selectedProfileId)
    refreshVault(selectedProfileId)
  }, [selectedProfileId])

  // Auto-refresh live 6-digit TOTP codes every 5 seconds while on Vault tab
  useEffect(() => {
    if (activeTab !== 'vault') return
    const timer = setInterval(() => refreshVault(selectedProfileId), 5000)
    return () => clearInterval(timer)
  }, [activeTab, selectedProfileId])

  const handleRunCookieRobot = async () => {
    if (!selectedProfileId) return showToast('Select a profile first', 'error')
    const urls = customUrls.split(/\r?\n/).map((u) => u.trim()).filter(Boolean)
    if (urls.length === 0) return showToast('Enter at least one URL', 'error')
    setRunningRobot(true)
    try {
      const res = await api.ultraPro.runCookieRobot({ profileId: selectedProfileId, urls, scrollSteps: 3, clickInternalLinks: true })
      if (res?.success) {
        showToast(`Cookie Robot completed! Visited ${res.run.urlsVisited} sites (+${res.run.cookiesGained} cookies)`, 'success')
        refreshRuns(selectedProfileId)
      } else {
        showToast(res?.error || 'Cookie Robot failed', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Cookie Robot error', 'error')
    } finally {
      setRunningRobot(false)
    }
  }

  const handleRunBatchCookieRobot = async () => {
    const allIds = profiles.map((p) => p.id).filter(Boolean)
    if (allIds.length === 0) return showToast('No profiles available for batch warm-up', 'error')
    const urls = customUrls.split(/\r?\n/).map((u) => u.trim()).filter(Boolean)
    if (urls.length === 0) return showToast('Enter at least one URL', 'error')
    setRunningRobot(true)
    try {
      const res = await api.ultraPro.runBatchCookieRobot({ profileIds: allIds.slice(0, 15), urls, concurrency: 3, scrollSteps: 3 })
      if (res?.success) {
        showToast(`Batch Warm-Up done! ${res.succeeded}/${res.totalProfiles} profiles warmed up.`, 'success')
        refreshRuns(selectedProfileId)
      } else {
        showToast(res?.error || 'Batch Cookie Robot failed', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Batch Cookie Robot error', 'error')
    } finally {
      setRunningRobot(false)
    }
  }

  const handleAutoFillVault = async (id: string) => {
    try {
      const res = await api.ultraPro.autoFillVaultAccount(id)
      if (res?.success) {
        const filled = [
          res.filledUsername && 'Username',
          res.filledPassword && 'Password',
          res.filledTotp && `2FA (${res.totpCode})`
        ].filter(Boolean)
        showToast(
          filled.length > 0 ? `Auto-filled: ${filled.join(', ')}` : 'Browser opened (focus login inputs and click again)',
          'success'
        )
      } else {
        showToast(res?.error || 'Auto-fill failed', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Auto-fill error', 'error')
    }
  }

  const handleSaveVault = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfileId || !platform || !username) {
      return showToast('Profile, Platform, and Username are required', 'error')
    }
    const res = await api.ultraPro.upsertVaultAccount({
      profileId: selectedProfileId,
      platform,
      loginUrl,
      username,
      password,
      totpSecret
    })
    if (res?.success) {
      showToast('Account & 2FA TOTP saved securely!', 'success')
      setPlatform('')
      setLoginUrl('')
      setUsername('')
      setPassword('')
      setTotpSecret('')
      refreshVault(selectedProfileId)
    } else {
      showToast(res?.error || 'Failed to save account', 'error')
    }
  }

  const handleCopyTotp = (code: string) => {
    navigator.clipboard.writeText(code)
    showToast(`2FA Code ${code} copied!`, 'success')
  }

  const handleRevealPassword = async (id: string) => {
    const res = await api.ultraPro.revealVaultPassword(id)
    if (res?.success && res.password) {
      navigator.clipboard.writeText(res.password)
      showToast('Password copied to clipboard!', 'success')
    } else {
      showToast(res?.error || 'No password saved', 'info')
    }
  }

  const handleDeleteVault = async (id: string) => {
    await api.ultraPro.deleteVaultAccount(id)
    showToast('Account removed from vault', 'info')
    refreshVault(selectedProfileId)
  }

  const handleRunStealthAudit = async () => {
    if (!selectedProfileId) return showToast('Select a profile first', 'error')
    setAuditing(true)
    try {
      const res = await api.ultraPro.auditProfileStealth(selectedProfileId)
      if (res?.success) {
        setAuditReport(res.report)
        showToast(`Stealth Score: ${res.report.score}/100 (Grade ${res.report.grade})`, 'success')
      } else {
        showToast(res?.error || 'Audit failed', 'error')
      }
    } finally {
      setAuditing(false)
    }
  }

  const handleImportBulkProxies = async () => {
    if (!bulkProxyText.trim()) return showToast('Paste at least one proxy line first', 'error')
    setImportingProxies(true)
    try {
      const res = await api.ultraPro.importBulkProxies(bulkProxyText, bulkProxyProtocol)
      if (res?.success) {
        showToast(`Imported ${res.importedCount} proxies (${res.duplicatesRemoved} duplicates skipped, ${res.invalidCount} invalid)`, 'success')
        setBulkProxyText('')
      } else {
        showToast(res?.error || 'Bulk import failed', 'error')
      }
    } finally {
      setImportingProxies(false)
    }
  }

  const handleCheckFraudScore = async () => {
    if (!fraudIpInput.trim()) return showToast('Enter an IP address or proxy host', 'error')
    setCheckingFraud(true)
    try {
      const res = await api.ultraPro.checkIpFraudScore(fraudIpInput.trim())
      if (res?.success) {
        setFraudReport(res.report)
        showToast(`Fraud Score: ${res.report.fraudScore}/100 (${res.report.category})`, res.report.fraudScore <= 35 ? 'success' : 'error')
      } else {
        showToast(res?.error || 'Fraud check failed', 'error')
      }
    } finally {
      setCheckingFraud(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>⚡ Ultra-Pro Anti-Detect Suite</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 13 }}>
            Cookie Warm-Up Robot • Per-Profile 2FA (TOTP) Account Vault • One-Click Stealth Trust Score
          </p>
        </div>
        <select
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="form-control"
          style={{ minWidth: 260, padding: '8px 12px', borderRadius: 8 }}
        >
          <option value="">-- Select Profile --</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.osType || 'win'})
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className={`btn ${activeTab === 'cookie-robot' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('cookie-robot')}
        >
          🍪 Cookie Robot
        </button>
        <button
          className={`btn ${activeTab === 'vault' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('vault')}
        >
          🔐 2FA (TOTP) Vault
        </button>
        <button
          className={`btn ${activeTab === 'stealth' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('stealth')}
        >
          🛡️ Stealth Score Checker
        </button>
        <button
          className={`btn ${activeTab === 'bulk-proxy' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('bulk-proxy')}
        >
          🌐 Bulk Proxy & Fraud Score
        </button>
      </div>

      {/* TAB 1: COOKIE ROBOT */}
      {activeTab === 'cookie-robot' && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>🍪 Automated Cookie Warm-Up Robot</h3>
          <p style={{ fontSize: 13, opacity: 0.75 }}>
            Automatically browses high-trust sites with human-like scrolling and random dwell times to build authentic cookies & history.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {presets.map((pr) => (
              <button
                key={pr.id}
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => setCustomUrls(pr.urls.join('\n'))}
              >
                📋 {pr.name}
              </button>
            ))}
          </div>

          <textarea
            rows={5}
            value={customUrls}
            onChange={(e) => setCustomUrls(e.target.value)}
            placeholder="One URL per line (https://...)"
            style={{ width: '100%', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={runningRobot} onClick={handleRunCookieRobot}>
              {runningRobot ? '⏳ Warming up profile...' : '🚀 Start Cookie Robot Warm-Up'}
            </button>
            <button className="btn btn-secondary" disabled={runningRobot || profiles.length === 0} onClick={handleRunBatchCookieRobot}>
              {runningRobot ? '⏳ Running Batch Queue...' : `⚡ Batch Warm-Up All Profiles (${Math.min(profiles.length, 15)})`}
            </button>
          </div>

          <h4 style={{ marginTop: 22, marginBottom: 8 }}>Recent Warm-Up Runs</h4>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Sites Visited</th>
                <th style={{ padding: 8 }}>Cookies Gained</th>
                <th style={{ padding: 8 }}>Started</th>
              </tr>
            </thead>
            <tbody>
              {robotRuns.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 12, opacity: 0.6 }}>No Cookie Robot runs yet.</td></tr>
              ) : (
                robotRuns.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{r.status.toUpperCase()}</td>
                    <td style={{ padding: 8 }}>{r.urlsVisited} / {r.urlsTotal}</td>
                    <td style={{ padding: 8, color: '#2DD4BF' }}>+{r.cookiesGained}</td>
                    <td style={{ padding: 8 }}>{new Date(r.startedAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: 2FA TOTP ACCOUNT VAULT */}
      {activeTab === 'vault' && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>🔐 Per-Profile 2FA (TOTP) Authenticator & Account Vault</h3>
          <form onSubmit={handleSaveVault} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
            <input placeholder="Platform (e.g. Facebook, Google)" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
            <input placeholder="Username / Email" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
            <input type="password" placeholder="Password (Encrypted)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
            <input placeholder="2FA TOTP Secret (Base32 or otpauth://)" value={totpSecret} onChange={(e) => setTotpSecret(e.target.value)} style={{ padding: 8, borderRadius: 6, fontFamily: 'monospace' }} />
            <input placeholder="Login URL (optional)" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
            <button type="submit" className="btn btn-primary">💾 Save to Vault</button>
          </form>

          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                <th style={{ padding: 8 }}>Platform</th>
                <th style={{ padding: 8 }}>Username</th>
                <th style={{ padding: 8 }}>Live 2FA Code</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vaultAccounts.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 14, opacity: 0.6 }}>No accounts saved for this profile yet.</td></tr>
              ) : (
                vaultAccounts.map((acc) => (
                  <tr key={acc.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{acc.platform}</td>
                    <td style={{ padding: 8, fontFamily: 'monospace' }}>{acc.username}</td>
                    <td style={{ padding: 8 }}>
                      {acc.totpCode ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontFamily: 'monospace', fontWeight: 800, color: '#2DD4BF', padding: '4px 10px' }}
                          onClick={() => handleCopyTotp(acc.totpCode)}
                          title="Click to copy 2FA code"
                        >
                          {acc.totpCode} ({acc.totpRemainingSeconds}s)
                        </button>
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={() => handleAutoFillVault(acc.id)} title="Launch/attach browser and auto-fill Username + Password + Live 2FA">
                        ⚡ Auto-Fill Login
                      </button>
                      {acc.hasPassword && (
                        <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => handleRevealPassword(acc.id)}>🔑 Copy Pass</button>
                      )}
                      <button className="btn btn-secondary" style={{ fontSize: 11, color: '#F87171' }} onClick={() => handleDeleteVault(acc.id)}>🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: STEALTH SCORE CHECKER */}
      {activeTab === 'stealth' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>🛡️ Built-in Fingerprint Stealth Trust Score</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.75 }}>
                10-point inspection covering OS/UA coherence, Proxy DNS/QUIC Kill-Switch, WebRTC, Canvas, WebGL/WebGPU, Audio, and Timezone sync.
              </p>
            </div>
            <button className="btn btn-primary" disabled={auditing} onClick={handleRunStealthAudit}>
              {auditing ? '⏳ Auditing...' : '🔍 Audit Profile Now'}
            </button>
          </div>

          {auditReport && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 12, background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.3)', marginBottom: 16 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: auditReport.score >= 88 ? '#10B981' : auditReport.score >= 70 ? '#F59E0B' : '#F87171' }}>
                  {auditReport.score}/100
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Grade {auditReport.grade} — {auditReport.profileName}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Audited {new Date(auditReport.createdAt).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {auditReport.checks.map((c: any) => (
                  <div key={c.id} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'} {c.category}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{c.detail}</div>
                      {c.recommendation && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 3 }}>Fix: {c.recommendation}</div>}
                    </div>
                    <div style={{ fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {c.points}/{c.maxPoints}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BULK PROXY IMPORTER & LIVE IP FRAUD SCORE */}
      {activeTab === 'bulk-proxy' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>🌐 One-Click Bulk Proxy Importer (BrightData / IPRoyal / Smartproxy / Webshare)</h3>
            <p style={{ fontSize: 13, opacity: 0.75 }}>
              Paste 100+ proxies in any format: <code>socks5://user:pass@host:port</code>, <code>host:port:user:pass</code>, <code>user:pass@host:port</code>, or <code>host:port</code>.
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12 }}>Default Protocol:</label>
              <select value={bulkProxyProtocol} onChange={(e) => setBulkProxyProtocol(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6 }}>
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks4">SOCKS4</option>
              </select>
            </div>
            <textarea
              rows={6}
              value={bulkProxyText}
              onChange={(e) => setBulkProxyText(e.target.value)}
              placeholder={'socks5://user:pass@1.2.3.4:1080\n5.6.7.8:8080:user2:pass2\n9.10.11.12:3128'}
              style={{ width: '100%', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
            />
            <button className="btn btn-primary" disabled={importingProxies} onClick={handleImportBulkProxies}>
              {importingProxies ? '⏳ Importing...' : '📥 Import Bulk Proxies'}
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>🔍 Live IP Fraud / Risk Score Checker</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input
                value={fraudIpInput}
                onChange={(e) => setFraudIpInput(e.target.value)}
                placeholder="Enter proxy IP or hostname (e.g. 1.1.1.1)"
                style={{ flex: 1, padding: 10, borderRadius: 8, fontFamily: 'monospace' }}
              />
              <button className="btn btn-primary" disabled={checkingFraud} onClick={handleCheckFraudScore}>
                {checkingFraud ? '⏳ Checking...' : '🩺 Check Fraud Score'}
              </button>
            </div>
            {fraudReport && (
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 16 }}>
                    {fraudReport.ip} — {fraudReport.category}
                  </strong>
                  <span style={{ fontWeight: 900, fontSize: 18, color: fraudReport.fraudScore <= 20 ? '#10B981' : fraudReport.fraudScore <= 55 ? '#F59E0B' : '#F87171' }}>
                    Risk: {fraudReport.fraudScore}/100 ({fraudReport.riskLevel.toUpperCase()})
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
                  <div>📍 Location: {fraudReport.city}, {fraudReport.region}, {fraudReport.country} ({fraudReport.countryCode})</div>
                  <div>🏢 ISP: {fraudReport.isp}</div>
                  <div>🌐 ASN: {fraudReport.asn}</div>
                  <div>🕒 Timezone: {fraudReport.timezone}</div>
                  <div>⚡ Latency: {fraudReport.latencyMs}ms</div>
                  <div>🛡️ Flags: {fraudReport.isMobile ? 'Mobile' : 'Fixed'} | {fraudReport.isHosting ? 'Datacenter' : 'Non-DC'} | {fraudReport.isProxy ? 'Proxy/VPN' : 'Clean'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
