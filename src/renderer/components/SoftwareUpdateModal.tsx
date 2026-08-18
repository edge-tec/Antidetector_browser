// ──────────────────────────────────────────────
// AntiProfiles — Real-Time Software Update Notification & In-App Auto-Updater Modal
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

export interface UpdateInfoPayload {
  version: string
  releaseTitle: string
  releaseNotes: string
  publishedAt?: string
  forceUpdate?: boolean
  minSupportedVersion?: string
  packageInfo?: {
    platformKey: string
    platformLabel: string
    downloadUrl: string
    fileSize: number
    sha256: string
    filename: string
  }
}

interface SoftwareUpdateModalProps {
  isOpen: boolean
  updateInfo: UpdateInfoPayload | null
  currentVersion: string
  onClose: () => void
  onLater: () => void
}

export const SoftwareUpdateModal: React.FC<SoftwareUpdateModalProps> = ({
  isOpen,
  updateInfo,
  currentVersion,
  onClose,
  onLater
}) => {
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number
    transferred: number
    total: number
    speed: number
  } | null>(null)
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false)
      setDownloadProgress(null)
      setDownloadedFilePath(null)
      setErrorMsg(null)
      setSuccessMsg(null)
      return
    }

    // Subscribe to IPC download progress events
    let cleanup: (() => void) | undefined
    if ((window as any).api?.onDownloadProgress) {
      cleanup = (window as any).api.onDownloadProgress((_event: any, data: any) => {
        setDownloadProgress(data)
      })
    }

    return () => {
      if (cleanup) cleanup()
    }
  }, [isOpen])

  if (!isOpen || !updateInfo) return null

  const handleUpdateNow = async () => {
    const pkg = updateInfo.packageInfo
    const downloadUrl = pkg?.downloadUrl || ''

    if (!downloadUrl) {
      setErrorMsg('No package download URL found for your operating system.')
      return
    }

    setDownloading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if ((window as any).api?.updaterDownloadUpdate) {
        const res = await (window as any).api.updaterDownloadUpdate(downloadUrl, pkg?.sha256 || undefined)
        if (res.success && res.filePath) {
          setDownloadedFilePath(res.filePath)
          setSuccessMsg('✓ Update package downloaded and SHA-256 integrity verified!')
        } else {
          setErrorMsg(res.error || 'Failed to download update package.')
          setDownloading(false)
        }
      } else {
        setErrorMsg('Updater API is unavailable in this environment.')
        setDownloading(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Download encountered an unexpected error.')
      setDownloading(false)
    }
  }

  const handleInstallAndRestart = async () => {
    if (!downloadedFilePath) return
    setInstalling(true)
    setErrorMsg(null)
    try {
      if ((window as any).api?.updaterInstallUpdate) {
        const res = await (window as any).api.updaterInstallUpdate(downloadedFilePath)
        if (res.success) {
          setSuccessMsg(res.message || 'Installer launched successfully. Please follow on-screen prompts.')
        } else {
          setErrorMsg(res.error || 'Failed to execute update installer.')
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error launching installer.')
    } finally {
      setInstalling(false)
    }
  }

  const pkg = updateInfo.packageInfo
  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  const formatSpeed = (bytesPerSec: number) => (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s'

  return (
    <>
      <div
        className="modal-backdrop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 5, 10, 0.82)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <div
          style={{
            width: '580px',
            maxWidth: '92%',
            backgroundColor: '#161622',
            border: '1px solid #2DD4BF50',
            borderRadius: '16px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(45, 212, 191, 0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
            padding: '24px',
            borderBottom: '1px solid #2C2C3E',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2DD4BF, #3B82F6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                boxShadow: '0 8px 16px rgba(45, 212, 191, 0.3)'
              }}>
                🚀
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#FFF', fontWeight: 800, letterSpacing: '-0.2px' }}>
                  New Software Update Available
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#94A3B8', padding: '2px 8px', background: '#0F172A', borderRadius: '4px', border: '1px solid #334155' }}>
                    Current: v{currentVersion}
                  </span>
                  <span style={{ color: '#2DD4BF', fontSize: '12px', fontWeight: 700 }}>➔</span>
                  <span style={{ fontSize: '12px', color: '#0F172A', background: '#2DD4BF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                    Latest: v{updateInfo.version}
                  </span>
                  {pkg && (
                    <span style={{ fontSize: '11px', color: '#CBD5E1', background: '#1E293B', padding: '2px 8px', borderRadius: '4px' }}>
                      {pkg.platformLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!updateInfo.forceUpdate && (
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Body Content */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '60vh', overflowY: 'auto' }}>
            {/* Title & Notes */}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: '#F1F5F9', fontWeight: 700 }}>
                {updateInfo.releaseTitle}
              </h4>
              <div style={{
                background: '#10101A',
                border: '1px solid #232336',
                borderRadius: '8px',
                padding: '14px 16px',
                fontSize: '13px',
                color: '#CBD5E1',
                lineHeight: 1.6,
                whiteSpace: 'pre-line'
              }}>
                {updateInfo.releaseNotes}
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                color: '#FCA5A5',
                fontSize: '12px',
                fontWeight: 600
              }}>
                ❌ {errorMsg}
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                color: '#6EE7B7',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {successMsg}
              </div>
            )}

            {/* Download Progress State */}
            {downloading && (
              <div style={{
                background: '#14141F',
                border: '1px solid #2C2C3E',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ color: '#2DD4BF' }}>
                    {downloadProgress && downloadProgress.percent >= 100
                      ? '🔒 Verifying package SHA-256 checksum...'
                      : 'Downloading update package...'}
                  </span>
                  <span style={{ color: '#FFF' }}>{downloadProgress ? `${downloadProgress.percent}%` : '0%'}</span>
                </div>

                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#1E293B',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${downloadProgress ? downloadProgress.percent : 5}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #2DD4BF, #3B82F6)',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease'
                  }} />
                </div>

                {downloadProgress && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                    <span>{formatMB(downloadProgress.transferred)} / {formatMB(downloadProgress.total)}</span>
                    <span>{formatSpeed(downloadProgress.speed)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Zero data loss security guarantee notice */}
            <div style={{
              fontSize: '11px',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 0'
            }}>
              <span>🛡️</span>
              <span>All browser profiles, cookies, proxies, and application data will remain completely intact.</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: '16px 24px',
            background: '#10101A',
            borderTop: '1px solid #2C2C3E',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            alignItems: 'center'
          }}>
            {!updateInfo.forceUpdate && !downloadedFilePath && (
              <button
                disabled={downloading}
                onClick={onLater}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#94A3B8',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Later
              </button>
            )}

            {!downloadedFilePath ? (
              <button
                disabled={downloading}
                onClick={handleUpdateNow}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2DD4BF, #0EA5E9)',
                  color: '#0F172A',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: downloading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(45, 212, 191, 0.3)'
                }}
              >
                <span>⚡</span>
                {downloading ? 'Downloading...' : 'Update Now'}
              </button>
            ) : (
              <button
                disabled={installing}
                onClick={handleInstallAndRestart}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: installing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                <span>📦</span>
                {installing ? 'Launching...' : 'Install & Update'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
