// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Runtime Diagnostic & Debug Modal
// Deep inspection of Profile Config vs Runtime vs Network vs Device Template vs Consistency
// ──────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import { RuntimeDiagnosticReport } from '../../main/fingerprint/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  profileId: string
  profileName: string
}

export const RuntimeDiagnosticModal: React.FC<Props> = ({
  isOpen,
  onClose,
  profileId,
  profileName
}) => {
  const [report, setReport] = useState<RuntimeDiagnosticReport | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'all' | 'profile' | 'runtime' | 'network' | 'template' | 'consistency'>('all')

  useEffect(() => {
    if (isOpen && profileId) {
      setLoading(true)
      setError(null)
      if ((window as any).api?.getDiagnosticReport) {
        (window as any).api.getDiagnosticReport(profileId)
          .then((res: any) => {
            if (res?.success && res?.data) {
              setReport(res.data)
            } else {
              setError(res?.error || 'Failed to load diagnostic report.')
            }
          })
          .catch((err: any) => {
            setError(err.message || 'Error fetching diagnostic data.')
          })
          .finally(() => {
            setLoading(false)
          })
      } else {
        setLoading(false)
        setError('Diagnostic API not available in current environment.')
      }
    }
  }, [isOpen, profileId])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#181824',
        border: '1px solid #2C2C3E',
        borderRadius: '12px',
        width: '940px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        overflow: 'hidden',
        color: '#E2E8F0'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #2C2C3E',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#14141F'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔍</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#F1F5F9' }}>
                Runtime Diagnostic & Debug Inspector
              </h2>
              {/* v3: Consistency Score Mini Badge */}
              {report?.consistencyValidation && (
                <span style={{
                  marginLeft: '8px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: report.consistencyValidation.score >= 90
                    ? 'rgba(16, 185, 129, 0.2)'
                    : report.consistencyValidation.score >= 70
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                  color: report.consistencyValidation.score >= 90
                    ? '#34D399'
                    : report.consistencyValidation.score >= 70
                    ? '#FBBF24'
                    : '#F87171',
                  border: `1px solid ${report.consistencyValidation.score >= 90
                    ? 'rgba(16, 185, 129, 0.3)'
                    : report.consistencyValidation.score >= 70
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)'
                  }`
                }}>
                  Score: {report.consistencyValidation.score}/100
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              Profile: <span style={{ color: '#2DD4BF', fontWeight: 500 }}>{profileName}</span> ({profileId})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Section Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 28px',
          backgroundColor: '#14141F',
          borderBottom: '1px solid #2C2C3E'
        }}>
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'template', label: '🔒 Device Template' },
            { id: 'consistency', label: '✅ Consistency' },
            { id: 'profile', label: '1. Profile Config' },
            { id: 'runtime', label: '2. Browser Runtime' },
            { id: 'network', label: '3. Network & IP' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeSection === tab.id ? '#2DD4BF' : '#1C1C28',
                color: activeSection === tab.id ? '#0F172A' : '#94A3B8',
                fontSize: '12px',
                fontWeight: activeSection === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              <div>Analyzing effective runtime configuration...</div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {!loading && !error && report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* ── 1. Profile Configuration ── */}
              {(activeSection === 'all' || activeSection === 'profile') && (
                <div style={{
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2C2C3E',
                  borderRadius: '10px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38BDF8' }} />
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1. Profile Configuration (Source of Truth)
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <Field label="OS Type" value={report.profileConfig.osType} />
                    <Field label="Browser Engine" value={`${report.profileConfig.browserEngine} (v${report.profileConfig.browserVersion})`} />
                    <Field label="Platform Token" value={report.profileConfig.platform} />
                    <Field label="Screen & DPR" value={`${report.profileConfig.screenResolution} @${report.profileConfig.devicePixelRatio}x`} />
                    <Field label="Hardware Cores" value={`${report.profileConfig.cpuCores} Cores`} />
                    <Field label="Memory" value={`${report.profileConfig.memoryGb} GB`} />
                    <Field label="GPU Renderer" value={report.profileConfig.gpuRenderer} span={2} />
                    <Field label="Timezone" value={report.profileConfig.timezone} />
                    <Field label="Languages" value={report.profileConfig.languages.join(', ')} />
                    <Field label="Touch Support" value={report.profileConfig.touchSupport ? `Yes (${report.profileConfig.maxTouchPoints} points)` : 'No (0 points)'} />
                    <Field label="WebRTC Policy" value={report.profileConfig.webrtcPolicy} />
                    <Field label="User-Agent" value={report.profileConfig.userAgent} span={3} code />
                  </div>
                </div>
              )}

              {/* ── Firefox Runtime Verification (Configured vs Effective Runtime) ── */}
              {(report as any)?.firefoxValidation && (
                <div style={{
                  backgroundColor: '#1C1C28',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '10px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>🦊</span>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Firefox Runtime Verification (Configured vs Runtime)
                      </h3>
                    </div>
                    <span style={{
                      padding: '3px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: (report as any).firefoxValidation.status === 'PASS' ? 'rgba(52, 211, 153, 0.15)' : (report as any).firefoxValidation.status === 'WARNING' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: (report as any).firefoxValidation.status === 'PASS' ? '#34D399' : (report as any).firefoxValidation.status === 'WARNING' ? '#FBBF24' : '#F87171'
                    }}>
                      Status: {(report as any).firefoxValidation.status}
                    </span>
                  </div>

                  {/* Diagnostics Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {((report as any).firefoxValidation.diagnostics || []).map((diag: any, idx: number) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#14141F',
                        borderRadius: '6px',
                        border: '1px solid #2C2C3E',
                        fontSize: '12px'
                      }}>
                        <div style={{ width: '180px', fontWeight: 600, color: '#CBD5E1' }}>{diag.field}</div>
                        <div style={{ flex: 1, color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>
                          <span style={{ color: '#64748B' }}>Config:</span> {String(diag.configured)} <span style={{ color: '#64748B' }}>→ Runtime:</span> {String(diag.runtime)}
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: diag.status === 'PASS' ? 'rgba(52, 211, 153, 0.15)' : diag.status === 'HOST-CONTROLLED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: diag.status === 'PASS' ? '#34D399' : diag.status === 'HOST-CONTROLLED' ? '#FBBF24' : '#F87171'
                        }}>
                          {diag.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 2. Effective Browser Runtime ── */}
              {(activeSection === 'all' || activeSection === 'runtime') && (
                <div style={{
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2C2C3E',
                  borderRadius: '10px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399' }} />
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Effective Browser Runtime Values (Injected & Emulated)
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <Field label="navigator.platform" value={report.effectiveRuntime.navigatorPlatform} highlight />
                    <Field label="navigator.vendor" value={report.effectiveRuntime.navigatorVendor || '"" (Firefox default)'} highlight />
                    <Field label="window.devicePixelRatio" value={`${report.effectiveRuntime.windowDpr}x`} highlight />
                    <Field label="navigator.hardwareConcurrency" value={`${report.effectiveRuntime.hardwareConcurrency} Cores`} highlight />
                    <Field label="navigator.deviceMemory" value={`${report.effectiveRuntime.deviceMemory} GB`} highlight />
                    <Field label="Client Hints (userAgentData)" value={report.effectiveRuntime.clientHintsActive ? 'Active (Chromium)' : 'Disabled / Undefined (Firefox/iOS)'} highlight />
                    <Field label="window.chrome" value={report.effectiveRuntime.windowChromePresent ? 'Present (Chromium)' : 'Undefined (Firefox/Safari)'} highlight />
                    <Field label="WebGL Unmasked Renderer" value={report.effectiveRuntime.webglRenderer} span={2} highlight />
                    <Field label="navigator.userAgent" value={report.effectiveRuntime.navigatorUserAgent} span={3} code highlight />
                  </div>
                </div>
              )}

              {/* ── 3. Network & IP Information ── */}
              {(activeSection === 'all' || activeSection === 'network') && (
                <div style={{
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2C2C3E',
                  borderRadius: '10px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      3. Network & IP Identity (Separation of Concerns)
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <Field label="Proxy Configuration" value={report.networkIdentity.hasProxy ? `${report.networkIdentity.proxyType.toUpperCase()} Proxy: ${report.networkIdentity.proxyHost}:${report.networkIdentity.proxyPort || 'default'}` : 'Direct Connection (No proxy configured)'} />
                    <Field label="WebRTC Interface Policy" value={report.networkIdentity.webrtcIpPolicy} />
                  </div>

                  {/* Explicit Disclaimer Card */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '16px', marginTop: '1px' }}>ℹ️</span>
                    <div style={{ fontSize: '12px', color: '#FDE68A', lineHeight: '1.5' }}>
                      {report.networkIdentity.disclaimer}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. Device Template (v3) ── */}
              {(activeSection === 'all' || activeSection === 'template') && report.deviceTemplate && (
                <div style={{
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2DD4BF33',
                  borderRadius: '10px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2DD4BF' }} />
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      4. Device Hardware Template (v3 Locked)
                    </h3>
                    <span style={{
                      marginLeft: 'auto',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: report.deviceTemplate.isTemplateLocked ? 'rgba(45, 212, 191, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: report.deviceTemplate.isTemplateLocked ? '#2DD4BF' : '#FBBF24'
                    }}>
                      {report.deviceTemplate.isTemplateLocked ? '🔒 Locked' : '🔓 Unlocked'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <Field label="Template ID" value={report.deviceTemplate.templateId} />
                    <Field label="Device Model" value={report.deviceTemplate.model} highlight />
                    <Field label="Category" value={report.deviceTemplate.category} />
                    <Field label="CPU Model" value={`${report.deviceTemplate.cpuModel} (${report.deviceTemplate.cpuThreads} threads)`} highlight />
                    <Field label="GPU Model" value={report.deviceTemplate.gpuModel} highlight />
                    <Field label="RAM" value={`${report.deviceTemplate.memoryGB} GB`} highlight />
                    <Field label="Screen Resolution" value={`${report.deviceTemplate.screenWidth}×${report.deviceTemplate.screenHeight}`} highlight />
                    <Field label="Device Pixel Ratio" value={`${report.deviceTemplate.devicePixelRatio}x`} highlight />
                  </div>
                </div>
              )}

              {/* No template info notice */}
              {(activeSection === 'template') && !report.deviceTemplate && (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: '13px',
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2C2C3E',
                  borderRadius: '10px'
                }}>
                  📦 No device template is assigned to this profile. Select one in the Profile Editor to lock hardware values.
                </div>
              )}

              {/* ── 5. Consistency Validation (v3) ── */}
              {(activeSection === 'all' || activeSection === 'consistency') && report.consistencyValidation && (
                <div style={{
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2C2C3E',
                  borderRadius: '10px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#A78BFA' }} />
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      5. Consistency Validation Report
                    </h3>
                  </div>

                  {/* Score Summary Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '10px',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      backgroundColor: '#14141F',
                      border: '1px solid #242436',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: report.consistencyValidation.score >= 90 ? '#34D399' : report.consistencyValidation.score >= 70 ? '#FBBF24' : '#F87171' }}>
                        {report.consistencyValidation.score}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>Score</div>
                    </div>
                    <div style={{ backgroundColor: '#14141F', border: '1px solid #242436', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#F1F5F9' }}>{report.consistencyValidation.totalChecks}</div>
                      <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>Total</div>
                    </div>
                    <div style={{ backgroundColor: '#14141F', border: '1px solid #242436', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#34D399' }}>{report.consistencyValidation.passedChecks}</div>
                      <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>Passed</div>
                    </div>
                    <div style={{ backgroundColor: '#14141F', border: '1px solid #242436', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#FBBF24' }}>{report.consistencyValidation.warnings}</div>
                      <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>Warnings</div>
                    </div>
                    <div style={{ backgroundColor: '#14141F', border: '1px solid #242436', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#F87171' }}>{report.consistencyValidation.failures}</div>
                      <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>Failures</div>
                    </div>
                  </div>

                  {/* Contradictions */}
                  {report.consistencyValidation.contradictions.length > 0 && (
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      marginBottom: '14px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#F87171', marginBottom: '6px' }}>
                        ⚠️ Contradictions Detected:
                      </div>
                      {report.consistencyValidation.contradictions.map((c, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#FCA5A5', padding: '2px 0' }}>
                          • {c}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Individual Checks Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {report.consistencyValidation.checks.map((check, idx) => (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 100px 1fr 60px',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '6px 10px',
                        backgroundColor: idx % 2 === 0 ? '#14141F' : '#1C1C28',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <span style={{ fontSize: '14px' }}>
                          {check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'}
                        </span>
                        <span style={{
                          color: '#64748B',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          {check.category}
                        </span>
                        <span style={{
                          color: check.status === 'pass' ? '#94A3B8' : check.status === 'warn' ? '#FBBF24' : '#F87171'
                        }}>
                          {check.message}
                        </span>
                        <span style={{
                          textAlign: 'right',
                          fontSize: '10px',
                          color: '#475569'
                        }}>
                          sev: {check.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No consistency info notice */}
              {(activeSection === 'consistency') && !report.consistencyValidation && (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: '13px',
                  backgroundColor: '#1C1C28',
                  border: '1px solid #2C2C3E',
                  borderRadius: '10px'
                }}>
                  📊 Consistency validation data not available for this profile.
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid #2C2C3E',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#14141F'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              backgroundColor: '#2C2C3E',
              border: 'none',
              color: '#FFF',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  span = 1,
  code = false,
  highlight = false
}: {
  label: string
  value: any
  span?: number
  code?: boolean
  highlight?: boolean
}) {
  return (
    <div style={{
      gridColumn: span > 1 ? `span ${span}` : undefined,
      backgroundColor: '#14141F',
      border: '1px solid #242436',
      borderRadius: '6px',
      padding: '8px 12px'
    }}>
      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </div>
      <div style={{
        fontSize: code ? '11px' : '13px',
        color: highlight ? '#34D399' : '#F1F5F9',
        fontFamily: code ? 'monospace' : 'inherit',
        wordBreak: 'break-word'
      }}>
        {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
      </div>
    </div>
  )
}
