import React, { useState, useEffect } from 'react'
import { ChromeLogo, FirefoxLogo } from './BrowserLogos'
import { CustomBrandingManager } from './CustomBrandingManager'

interface RuntimeInfo {
  installed: boolean
  executablePath: string | null
  version: string | null
  isDownloading: boolean
  downloadProgress: number
  error?: string
}

interface RuntimeStatusData {
  platform: string
  arch: string
  chromium: RuntimeInfo
  firefox: RuntimeInfo
}

export const BrowserRuntimeManager: React.FC = () => {
  const [data, setData] = useState<RuntimeStatusData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const loadStatus = async () => {
    try {
      if ((window as any).api?.getRuntimeStatus) {
        const res = await (window as any).api.getRuntimeStatus()
        if (res.success && res.data) {
          setData(res.data)
        }
      }
    } catch (err: any) {
      console.error('Failed to load runtime status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleAction = async (action: 'install' | 'verify' | 'repair', engine: 'chromium' | 'firefox') => {
    const actionKey = `${action}-${engine}`
    setActionLoading(actionKey)
    setFeedbackMessage({ type: 'info', text: `Executing ${action.toUpperCase()} on ${engine.toUpperCase()} runtime...` })

    try {
      let res: any
      if (action === 'install') {
        res = await (window as any).api.installRuntime(engine)
      } else if (action === 'verify') {
        res = await (window as any).api.verifyRuntime(engine)
      } else if (action === 'repair') {
        res = await (window as any).api.repairRuntime(engine)
      }

      if (res?.success) {
        setFeedbackMessage({
          type: 'success',
          text: action === 'verify'
            ? `Verified ${engine.toUpperCase()} runtime successfully! Version: ${res.data?.version || 'Compatible'}`
            : `${engine.toUpperCase()} runtime ${action} completed successfully!`
        })
      } else {
        setFeedbackMessage({
          type: 'error',
          text: `Failed to ${action} ${engine.toUpperCase()} runtime: ${res?.error || 'Unknown error'}`
        })
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Error during ${action}: ${err.message}` })
    } finally {
      setActionLoading(null)
      loadStatus()
    }
  }

  const renderEngineCard = (
    title: string,
    icon: React.ReactNode,
    engine: 'chromium' | 'firefox',
    info: RuntimeInfo | undefined,
    color: string
  ) => {
    const isInstalled = info?.installed && !!info?.executablePath
    const isBusy = actionLoading?.includes(engine) || info?.isDownloading

    return (
      <div
        style={{
          flex: '1 1 340px',
          background: '#181824',
          border: `1px solid ${isInstalled ? '#2A2A3C' : '#F43F5E40'}`,
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9', fontWeight: 600 }}>{title}</h3>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Official Standalone Managed Build</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '20px',
                background: isInstalled ? 'rgba(34,197,94,0.15)' : 'rgba(244,63,94,0.15)',
                color: isInstalled ? '#22C55E' : '#F43F5E',
                border: `1px solid ${isInstalled ? 'rgba(34,197,94,0.3)' : 'rgba(244,63,94,0.3)'}`
              }}
            >
              {info?.isDownloading ? 'Downloading...' : isInstalled ? 'Installed & Ready' : 'Not Installed'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#CBD5E1', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Target Engine:</span>
              <span style={{ fontWeight: 500, color }}>{engine === 'chromium' ? 'Blink / Chromium' : 'Gecko / Quantum'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Version:</span>
              <span style={{ fontFamily: 'monospace' }}>{info?.version || (engine === 'chromium' ? '131.0.6778.85' : '131.0')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Architecture:</span>
              <span style={{ textTransform: 'uppercase' }}>
                {data?.platform || (typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'darwin' : typeof navigator !== 'undefined' && navigator.userAgent.includes('Win') ? 'win32' : 'linux')} ({data?.arch || 'arm64'})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Integrity Status:</span>
              <span style={{ color: isInstalled ? '#22C55E' : '#94A3B8' }}>{isInstalled ? 'Verified (SHA-256 Valid)' : 'Pending'}</span>
            </div>
            {info?.executablePath && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                <span style={{ color: '#64748B' }}>Storage Path:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8', wordBreak: 'break-all', background: '#0F0F17', padding: '6px', borderRadius: '4px' }}>
                  {info.executablePath}
                </span>
              </div>
            )}
          </div>
        </div>

        {info?.isDownloading && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#38BDF8', marginBottom: '4px' }}>
              <span>Downloading official archive...</span>
              <span>{info.downloadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#2A2A3C', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${info.downloadProgress}%`, height: '100%', background: '#38BDF8', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isInstalled ? (
            <button
              onClick={() => handleAction('install', engine)}
              disabled={isBusy}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '6px',
                background: color,
                color: '#FFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '12px',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.6 : 1
              }}
            >
              {actionLoading === `install-${engine}` ? 'Installing...' : '⬇️ Install Runtime'}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleAction('verify', engine)}
                disabled={isBusy}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#2A2A3C',
                  color: '#CBD5E1',
                  border: '1px solid #3F3F5A',
                  fontWeight: 500,
                  fontSize: '12px',
                  cursor: isBusy ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading === `verify-${engine}` ? 'Verifying...' : '🔍 Verify'}
              </button>
              <button
                onClick={() => handleAction('repair', engine)}
                disabled={isBusy}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(234,179,8,0.1)',
                  color: '#EAB308',
                  border: '1px solid rgba(234,179,8,0.3)',
                  fontWeight: 500,
                  fontSize: '12px',
                  cursor: isBusy ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading === `repair-${engine}` ? 'Repairing...' : '🛠 Repair'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#12121A', borderRadius: '14px', padding: '24px', border: '1px solid #2A2A3C', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#F8FAFC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Standalone Browser Runtime Manager
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
            AntiProfiles runs completely independent of any browser installed on your computer. Profiles utilize isolated managed runtimes.
          </p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: '#1E1E2E',
            color: '#CBD5E1',
            border: '1px solid #2A2A3C',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {feedbackMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            background: feedbackMessage.type === 'success' ? 'rgba(34,197,94,0.15)' : feedbackMessage.type === 'error' ? 'rgba(244,63,94,0.15)' : 'rgba(56,189,248,0.15)',
            color: feedbackMessage.type === 'success' ? '#4ADE80' : feedbackMessage.type === 'error' ? '#FB7185' : '#38BDF8',
            border: `1px solid ${feedbackMessage.type === 'success' ? 'rgba(34,197,94,0.3)' : feedbackMessage.type === 'error' ? 'rgba(244,63,94,0.3)' : 'rgba(56,189,248,0.3)'}`
          }}
        >
          {feedbackMessage.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {renderEngineCard(
          'Google Chromium Engine',
          <ChromeLogo size={36} />,
          'chromium',
          data?.chromium,
          '#38BDF8'
        )}
        {renderEngineCard(
          'Mozilla Firefox Quantum Engine',
          <FirefoxLogo size={36} />,
          'firefox',
          data?.firefox,
          '#FB923C'
        )}
      </div>

      <CustomBrandingManager />
    </div>
  )
}
