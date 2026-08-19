// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Runtime Diagnostic & Debug Modal
// Deep inspection of Profile Configuration vs Effective Runtime vs Network Identity
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
  const [activeSection, setActiveSection] = useState<'all' | 'profile' | 'runtime' | 'network'>('all')

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
            { id: 'profile', label: '1. Profile Configuration' },
            { id: 'runtime', label: '2. Effective Browser Runtime' },
            { id: 'network', label: '3. Network & IP Identity' }
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
