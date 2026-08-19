import React from 'react'
import chromeIconImg from '../assets/antiprofiles-chrome.png'
import firefoxIconImg from '../assets/antiprofiles-firefox.png'

export interface ProvisioningProgressData {
  profileId?: string
  engine: 'chromium' | 'firefox'
  step: 'checking' | 'downloading' | 'verifying' | 'extracting' | 'ready' | 'error'
  percent: number
  downloadedBytes: number
  totalBytes: number
  speedBytesPerSec: number
  speedFormatted: string
  etaSeconds: number
  message: string
  error?: string
}

interface Props {
  data: ProvisioningProgressData | null
  onClose?: () => void
}

export const RuntimeProvisioningModal: React.FC<Props> = ({ data, onClose }) => {
  if (!data || data.step === 'ready') return null

  const isChromium = data.engine === 'chromium'
  const engineTitle = isChromium ? 'Google Chromium Engine' : 'Mozilla Firefox Quantum'
  const engineIcon = isChromium
    ? <img src={chromeIconImg} alt="Antiprofile Chromium" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
    : <img src={firefoxIconImg} alt="Antiprofile Firefox" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
  const accentColor = isChromium ? '#38BDF8' : '#FB923C'

  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

  const stepsList = [
    { key: 'checking', label: 'Connecting to authorized repository' },
    { key: 'downloading', label: 'Downloading official standalone package' },
    { key: 'extracting', label: 'Extracting runtime binaries' },
    { key: 'verifying', label: 'Verifying integrity & permissions' }
  ]

  const getStepStatus = (stepKey: string) => {
    const order = ['checking', 'downloading', 'extracting', 'verifying', 'ready']
    const currentIndex = order.indexOf(data.step)
    const targetIndex = order.indexOf(stepKey)

    if (data.step === 'error') {
      if (stepKey === 'downloading') return 'error'
      return 'pending'
    }

    if (currentIndex > targetIndex) return 'done'
    if (currentIndex === targetIndex) return 'active'
    return 'pending'
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#181824',
          borderRadius: '16px',
          border: `1px solid ${data.step === 'error' ? '#F43F5E' : '#2A2A3C'}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '28px',
          color: '#F8FAFC',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: `${accentColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px'
            }}
          >
            {engineIcon}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              {data.step === 'error' ? 'Installation Issue' : 'Installing Browser Runtime'}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
              {engineTitle} • Standalone Isolated Build
            </p>
          </div>
        </div>

        {/* Progress Bar & Details */}
        {data.step !== 'error' && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: '#CBD5E1' }}>
              <span>{data.message}</span>
              <span style={{ fontWeight: 600, color: accentColor }}>{data.percent}%</span>
            </div>

            <div style={{ width: '100%', height: '8px', background: '#2A2A3C', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(5, data.percent)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${accentColor}, #818CF8)`,
                  transition: 'width 0.25s ease'
                }}
              />
            </div>

            {data.totalBytes > 0 && data.step === 'downloading' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                <span>{formatMB(data.downloadedBytes)} MB / {formatMB(data.totalBytes)} MB</span>
                <span>Speed: {data.speedFormatted} {data.etaSeconds > 0 ? `• ~${data.etaSeconds}s left` : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Details */}
        {data.step === 'error' && (
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(244,63,94,0.12)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: '#FDA4AF',
              fontSize: '13px',
              marginBottom: '20px',
              lineHeight: 1.5
            }}
          >
            <strong>Error:</strong> {data.error || data.message}
          </div>
        )}

        {/* Steps Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', background: '#12121A', padding: '14px', borderRadius: '10px', border: '1px solid #222232' }}>
          {stepsList.map(s => {
            const status = getStepStatus(s.key)
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                {status === 'done' && <span style={{ color: '#22C55E' }}>✓</span>}
                {status === 'active' && <span style={{ color: accentColor, animation: 'spin 1s linear infinite' }}>↻</span>}
                {status === 'error' && <span style={{ color: '#F43F5E' }}>✕</span>}
                {status === 'pending' && <span style={{ color: '#475569' }}>○</span>}
                <span style={{ color: status === 'done' ? '#94A3B8' : status === 'active' ? '#F1F5F9' : status === 'error' ? '#FDA4AF' : '#475569', fontWeight: status === 'active' ? 500 : 400 }}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Action Button */}
        {data.step === 'error' && onClose && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#2A2A3C',
              color: '#FFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Close & Retry
          </button>
        )}
      </div>
    </div>
  )
}
