// ──────────────────────────────────────────────
// AntiProfiles — Browser Setup & Diagnostic Modal
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

interface BrowserSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: (path: string) => void
  onLaunchProfile?: () => void
  initialPath?: string | null
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

export function BrowserSetupModal({
  isOpen,
  onClose,
  onSaved,
  onLaunchProfile,
  initialPath,
  showToast
}: BrowserSetupModalProps) {
  const [selectedPath, setSelectedPath] = useState<string>(initialPath || '')
  const [engine, setEngine] = useState<string>('Google Chrome')
  const [detectedBrowsers, setDetectedBrowsers] = useState<Array<{ name: string; engine: string; path: string; version: string }>>([])
  const [isDetecting, setIsDetecting] = useState<boolean>(false)
  const [isTesting, setIsTesting] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<{
    valid: boolean
    version: string
    engine: string
    path: string
    error?: string
  } | null>(null)
  const [diagnostics, setDiagnostics] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'setup' | 'diagnostics'>('setup')

  useEffect(() => {
    if (isOpen) {
      loadCurrentAndDetect()
    }
  }, [isOpen])

  const loadCurrentAndDetect = async () => {
    setIsDetecting(true)
    try {
      const res = await window.api.autoDetectBrowser()
      if (res.success && res.data) {
        if (res.data.detectedPath && !selectedPath) {
          setSelectedPath(res.data.detectedPath)
        }
        if (Array.isArray(res.data.allBrowsers)) {
          setDetectedBrowsers(res.data.allBrowsers)
        }
      }
      if (!selectedPath) {
        const cur = await window.api.getChromiumPath()
        if (cur.success && cur.data) {
          setSelectedPath(cur.data)
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsDetecting(false)
    }
  }

  const handleBrowse = async () => {
    try {
      const res = await window.api.selectFile([
        { name: 'Executable Files', extensions: ['exe', 'app', '*'] },
        { name: 'All Files', extensions: ['*'] }
      ])
      if (res.success && res.data) {
        setSelectedPath(res.data)
        handleTest(res.data)
      }
    } catch {
      showToast('error', 'Failed to open file browser.')
    }
  }

  const handleAutoDetect = async () => {
    setIsDetecting(true)
    setTestResult(null)
    try {
      const res = await window.api.autoDetectBrowser()
      if (res.success && res.data) {
        if (res.data.detectedPath) {
          setSelectedPath(res.data.detectedPath)
          showToast('success', `Found browser: ${res.data.detectedPath}`)
          handleTest(res.data.detectedPath)
        } else {
          showToast('warning', 'No Chrome/Chromium executable was automatically detected.')
        }
        if (Array.isArray(res.data.allBrowsers)) {
          setDetectedBrowsers(res.data.allBrowsers)
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Auto-detect failed.')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleTest = async (pathToTest?: string) => {
    const target = pathToTest || selectedPath
    if (!target) {
      showToast('warning', 'Please enter or select a browser executable path first.')
      return
    }
    setIsTesting(true)
    try {
      const res = await window.api.testBrowser(target)
      if (res.success && res.data) {
        setTestResult(res.data)
        if (res.data.valid) {
          showToast('success', `✓ ${res.data.engine} (${res.data.version}) verified!`)
        } else {
          showToast('error', res.data.error || 'Browser validation failed.')
        }
      } else {
        showToast('error', res.error || 'Failed to test browser executable.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Test execution failed.')
    } finally {
      setIsTesting(false)
    }
  }

  const handleRunDiagnostics = async () => {
    try {
      const res = await window.api.getBrowserDiagnostics()
      if (res.success && res.data) {
        setDiagnostics(res.data)
      }
    } catch (err: any) {
      showToast('error', 'Diagnostics failed: ' + err.message)
    }
  }

  const handleSave = async (andLaunch = false) => {
    if (!selectedPath) {
      showToast('warning', 'Please select or enter a valid browser executable path.')
      return
    }
    try {
      const saveRes = await window.api.setChromiumPath(selectedPath)
      if (saveRes.success) {
        showToast('success', 'Browser path saved successfully!')
        if (onSaved) onSaved(selectedPath)
        onClose()
        if (andLaunch && onLaunchProfile) {
          onLaunchProfile()
        }
      } else {
        showToast('error', saveRes.error || 'Failed to save browser path.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save settings.')
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 640, width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <h3 className="modal-title">Browser Engine & Detection Setup</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 20px', gap: 16 }}>
          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'setup' ? '2px solid var(--color-primary)' : '2px solid transparent',
              fontWeight: 600,
              color: activeTab === 'setup' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              padding: '10px 4px'
            }}
            onClick={() => setActiveTab('setup')}
          >
            Configuration
          </button>
          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'diagnostics' ? '2px solid var(--color-primary)' : '2px solid transparent',
              fontWeight: 600,
              color: activeTab === 'diagnostics' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              padding: '10px 4px'
            }}
            onClick={() => {
              setActiveTab('diagnostics')
              handleRunDiagnostics()
            }}
          >
            Health Check & Diagnostics
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {activeTab === 'setup' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                  AntiProfiles launches isolated browser sessions using Google Chrome or Chromium. Ensure a compatible executable is configured below.
                </p>
              </div>

              {/* Browser Engine Selection */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Browser Engine</label>
                <select
                  className="form-input"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Google Chrome">Google Chrome (Recommended)</option>
                  <option value="Chromium">Chromium</option>
                  <option value="Microsoft Edge">Microsoft Edge (Chromium Engine)</option>
                  <option value="Brave">Brave Browser</option>
                  <option value="Custom">Custom Chromium-Based Browser</option>
                </select>
              </div>

              {/* Executable Path Input */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Browser Executable Path</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. C:\Program Files\Google\Chrome\Application\chrome.exe"
                    value={selectedPath}
                    onChange={(e) => setSelectedPath(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <button className="btn btn-secondary" onClick={handleBrowse}>
                    Browse...
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" disabled={isDetecting} onClick={handleAutoDetect}>
                  {isDetecting ? '🔍 Scanning PC...' : '🔍 Auto-Detect Chrome'}
                </button>
                <button className="btn btn-secondary btn-sm" disabled={isTesting || !selectedPath} onClick={() => handleTest()}>
                  {isTesting ? 'Testing...' : '⚡ Test Browser'}
                </button>
                {selectedPath && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedPath('')
                      setTestResult(null)
                    }}
                  >
                    Clear Path
                  </button>
                )}
              </div>

              {/* Discovered Browsers */}
              {detectedBrowsers.length > 0 && (
                <div style={{ background: 'var(--color-bg-tertiary)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Discovered Browsers on System
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detectedBrowsers.map((b, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: selectedPath === b.path ? 'rgba(45,212,191,0.1)' : 'var(--color-bg-secondary)',
                          border: selectedPath === b.path ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                          borderRadius: 6,
                          padding: '8px 12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {b.name} <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 400 }}>v{b.version}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.path}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${selectedPath === b.path ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => {
                            setSelectedPath(b.path)
                            handleTest(b.path)
                          }}
                        >
                          {selectedPath === b.path ? '✓ Selected' : 'Select'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Result Card */}
              {testResult && (
                <div
                  style={{
                    background: testResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${testResult.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 8,
                    padding: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{testResult.valid ? '✅' : '❌'}</span>
                    <strong style={{ color: testResult.valid ? '#22C55E' : '#EF4444' }}>
                      {testResult.valid ? 'Browser Validated Successfully' : 'Browser Validation Failed'}
                    </strong>
                  </div>
                  {testResult.valid ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      <div><strong>Engine:</strong> {testResult.engine}</div>
                      <div><strong>Version:</strong> {testResult.version}</div>
                      <div style={{ fontFamily: 'monospace' }}><strong>Path:</strong> {testResult.path}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#EF4444' }}>{testResult.error}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Diagnostics Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>6-Layer System & Process Health Check</span>
                <button className="btn btn-secondary btn-sm" onClick={handleRunDiagnostics}>
                  🔄 Re-run Check
                </button>
              </div>

              {diagnostics ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { title: 'Browser Engine', item: diagnostics.engine },
                    { title: 'Executable Path', item: diagnostics.executablePath },
                    { title: 'Executable Exists', item: diagnostics.executableExists },
                    { title: 'Version Detection', item: diagnostics.versionDetection },
                    { title: 'Profile Data Directory', item: diagnostics.profileDirectory },
                    { title: 'Process Launch Permission', item: diagnostics.processLaunch }
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 6,
                        background: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{row.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {row.item?.detail || row.item?.path || 'Checked'}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: row.item?.status === 'pass' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                          color: row.item?.status === 'pass' ? '#22C55E' : '#EF4444'
                        }}
                      >
                        {row.item?.status === 'pass' ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-secondary)' }}>
                  Loading diagnostics...
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={() => handleSave(false)}>
            Save Path
          </button>
          {onLaunchProfile && (
            <button className="btn btn-primary" onClick={() => handleSave(true)}>
              Save & Launch Profile
            </button>
          )}
        </div>
      </div>
    </>
  )
}
