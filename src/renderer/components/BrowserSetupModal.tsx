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

interface DiscoveredBrowser {
  name: string
  engine: string
  path: string
  version: string
}

function getBrowserIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('firefox')) return '🦊'
  if (lower.includes('edge')) return '🌊'
  if (lower.includes('brave')) return '🦁'
  if (lower.includes('chrome')) return '🌐'
  return '⚡'
}

function mapNameToEngine(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('firefox')) return 'Mozilla Firefox'
  if (lower.includes('edge')) return 'Microsoft Edge'
  if (lower.includes('brave')) return 'Brave'
  if (lower.includes('chromium')) return 'Chromium'
  if (lower.includes('chrome')) return 'Google Chrome'
  return 'Custom'
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
  const [detectedBrowsers, setDetectedBrowsers] = useState<DiscoveredBrowser[]>([])
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
      let discovered: DiscoveredBrowser[] = []
      if (res.success && res.data) {
        if (Array.isArray(res.data.allBrowsers)) {
          discovered = res.data.allBrowsers
          setDetectedBrowsers(discovered)
        }
      }

      let current = selectedPath
      if (!current) {
        const curChrome = await window.api.getChromiumPath()
        if (curChrome.success && curChrome.data) {
          current = curChrome.data
        } else if (res.data?.detectedPath) {
          current = res.data.detectedPath
        } else if (discovered.length > 0) {
          current = discovered[0].path
        }
      }

      if (current) {
        setSelectedPath(current)
        const matched = discovered.find(b => b.path.toLowerCase() === current.toLowerCase())
        if (matched) {
          setEngine(mapNameToEngine(matched.name))
        } else if (current.toLowerCase().includes('firefox')) {
          setEngine('Mozilla Firefox')
        }
        await handleTest(current, false)
      }
    } catch {
      // Ignore
    } finally {
      setIsDetecting(false)
    }
  }

  const handleEngineChange = async (newEngine: string) => {
    setEngine(newEngine)
    setTestResult(null)

    // Search in currently detected browsers
    const targetMatch = detectedBrowsers.find(b => {
      const lower = b.name.toLowerCase()
      if (newEngine === 'Mozilla Firefox') return lower.includes('firefox')
      if (newEngine === 'Google Chrome') return lower.includes('chrome') && !lower.includes('edge') && !lower.includes('brave')
      if (newEngine === 'Microsoft Edge') return lower.includes('edge')
      if (newEngine === 'Brave') return lower.includes('brave')
      if (newEngine === 'Chromium') return lower.includes('chromium')
      return false
    })

    if (targetMatch) {
      setSelectedPath(targetMatch.path)
      await handleTest(targetMatch.path, true)
    } else {
      // Check if backend has a configured path for this engine
      if (newEngine === 'Mozilla Firefox') {
        const ff = await window.api.getFirefoxPath()
        if (ff.success && ff.data) {
          setSelectedPath(ff.data)
          await handleTest(ff.data, true)
        } else {
          setSelectedPath('')
        }
      } else if (newEngine === 'Google Chrome' || newEngine === 'Chromium' || newEngine === 'Microsoft Edge' || newEngine === 'Brave') {
        const ch = await window.api.getChromiumPath()
        if (ch.success && ch.data) {
          setSelectedPath(ch.data)
          await handleTest(ch.data, true)
        }
      }
    }
  }

  const handleBrowse = async () => {
    try {
      const res = await window.api.selectFile([
        { name: 'Browser Executable', extensions: ['exe', 'app', '*'] },
        { name: 'All Files', extensions: ['*'] }
      ])
      if (res.success && res.data) {
        setSelectedPath(res.data)
        if (res.data.toLowerCase().includes('firefox')) {
          setEngine('Mozilla Firefox')
        }
        await handleTest(res.data, true)
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
        const list: DiscoveredBrowser[] = Array.isArray(res.data.allBrowsers) ? res.data.allBrowsers : []
        setDetectedBrowsers(list)

        if (list.length > 0) {
          // Check if current engine is in the list
          const currentMatch = list.find(b => mapNameToEngine(b.name) === engine)
          const target = currentMatch || list[0]
          setSelectedPath(target.path)
          setEngine(mapNameToEngine(target.name))
          showToast('success', `✓ Found ${list.length} installed browser${list.length === 1 ? '' : 's'}: ${list.map(b => b.name).join(', ')}`)
          await handleTest(target.path, false)
        } else {
          showToast('warning', 'No supported browsers automatically detected. Please browse to your browser executable.')
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Auto-detection failed.')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleSelectDiscovered = async (b: DiscoveredBrowser) => {
    setSelectedPath(b.path)
    setEngine(mapNameToEngine(b.name))
    await handleTest(b.path, true)
  }

  const handleTest = async (pathToTest?: string, notifyOnSuccess = true) => {
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
          if (notifyOnSuccess) {
            showToast('success', `✓ ${res.data.engine} (${res.data.version}) verified!`)
          }
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
      const res = await window.api.getBrowserDiagnostics(selectedPath || undefined)
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
      const isFirefox = engine === 'Mozilla Firefox' || (testResult && testResult.engine.includes('Gecko')) || selectedPath.toLowerCase().includes('firefox')
      
      if (isFirefox) {
        await window.api.setFirefoxPath(selectedPath)
      } else {
        await window.api.setChromiumPath(selectedPath)
      }

      await window.api.updateSetting('browser_default_engine', engine)

      showToast('success', `✓ ${engine} configuration saved successfully!`)
      if (onSaved) onSaved(selectedPath)
      onClose()

      if (andLaunch && onLaunchProfile) {
        onLaunchProfile()
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save settings.')
    }
  }

  if (!isOpen) return null

  const isFirefoxSelected = engine === 'Mozilla Firefox'

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 660, width: '94%' }}>
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
              {/* Dynamic Engine Banner */}
              <div style={{
                background: isFirefoxSelected ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.1)',
                border: isFirefoxSelected ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(59,130,246,0.3)',
                borderRadius: 8,
                padding: 12
              }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                  {isFirefoxSelected ? (
                    <>🦊 <strong>Mozilla Firefox (Gecko Engine)</strong>: AntiProfiles launches isolated Firefox profiles with customized <code>user.js</code> preferences, strict WebRTC privacy, and proxy isolation.</>
                  ) : (
                    <>🌐 <strong>{engine}</strong>: AntiProfiles launches isolated browser sessions with CDP injection, customized fingerprint attributes, and proxy routing.</>
                  )}
                </p>
              </div>

              {/* Browser Engine Selection */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Browser Engine</label>
                <select
                  className="form-input"
                  value={engine}
                  onChange={(e) => handleEngineChange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Google Chrome">Google Chrome (Recommended)</option>
                  <option value="Chromium">Chromium</option>
                  <option value="Microsoft Edge">Microsoft Edge (Chromium Engine)</option>
                  <option value="Brave">Brave Browser</option>
                  <option value="Mozilla Firefox">Mozilla Firefox (Gecko Engine)</option>
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
                    placeholder={isFirefoxSelected ? 'e.g. /Applications/Firefox.app/Contents/MacOS/firefox' : 'e.g. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}
                    value={selectedPath}
                    onChange={(e) => {
                      setSelectedPath(e.target.value)
                      if (e.target.value.toLowerCase().includes('firefox')) {
                        setEngine('Mozilla Firefox')
                      }
                    }}
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <button className="btn btn-secondary" onClick={handleBrowse}>
                    Browse...
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" disabled={isDetecting} onClick={handleAutoDetect}>
                  {isDetecting ? '🔍 Scanning System...' : '🔍 Auto-Detect Browsers'}
                </button>
                <button className="btn btn-secondary btn-sm" disabled={isTesting || !selectedPath} onClick={() => handleTest()}>
                  {isTesting ? '⚡ Testing...' : '⚡ Test Browser'}
                </button>
                {selectedPath && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedPath('')
                      setTestResult(null)
                      showToast('info', 'Browser executable path cleared.')
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
                    {detectedBrowsers.map((b, i) => {
                      const isSelected = selectedPath.toLowerCase() === b.path.toLowerCase()
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isSelected ? 'rgba(45,212,191,0.1)' : 'var(--color-bg-secondary)',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: 6,
                            padding: '8px 12px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{getBrowserIcon(b.name)}</span>
                              <span>{b.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 400 }}>v{b.version}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                              {b.path}
                            </div>
                          </div>
                          <button
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleSelectDiscovered(b)}
                          >
                            {isSelected ? '✓ Selected' : 'Select'}
                          </button>
                        </div>
                      )
                    })}
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
                    { title: 'Executable Exists & Permissions', item: diagnostics.executableExists },
                    { title: 'Version Detection', item: diagnostics.versionDetection },
                    { title: 'Profile Data Directory', item: diagnostics.profileDirectory },
                    { title: 'Process Launch Capability', item: diagnostics.processLaunch }
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
