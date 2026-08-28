import React, { useState, useEffect } from 'react'

export interface UpdatePackageInfo {
  platformKey: string
  platformLabel: string
  downloadUrl: string
  fileSize: number
  sha256: string
  filename: string
}

export interface UpdateAvailablePayload {
  version: string
  build?: string
  channel?: string
  releaseTitle?: string
  releaseNotes?: string
  publishedAt?: string
  forceUpdate?: boolean
  mandatory?: boolean
  minSupportedVersion?: string
  packageInfo?: UpdatePackageInfo
}

interface UpdateNotificationModalProps {
  updateInfo: UpdateAvailablePayload
  currentVersion: string
  isOpen: boolean
  onClose: () => void
  onOpenChangelog?: () => void
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  updateInfo,
  currentVersion,
  isOpen,
  onClose,
  onOpenChangelog
}) => {
  const isStrictlyNewer = (() => {
    if (!updateInfo?.version) return false
    const cleanA = (updateInfo.version || '').replace(/^v/i, '').trim()
    const cleanB = (currentVersion || '').replace(/^v/i, '').trim()
    const partsA = cleanA.split(/[-+.]/).map(p => isNaN(Number(p)) ? p : Number(p))
    const partsB = cleanB.split(/[-+.]/).map(p => isNaN(Number(p)) ? p : Number(p))
    const maxLen = Math.max(partsA.length, partsB.length)
    for (let i = 0; i < maxLen; i++) {
      const a = partsA[i] !== undefined ? partsA[i] : 0
      const b = partsB[i] !== undefined ? partsB[i] : 0
      if (typeof a === 'number' && typeof b === 'number') {
        if (a > b) return true
        if (a < b) return false
      } else {
        if (String(a) > String(b)) return true
        if (String(a) < String(b)) return false
      }
    }
    return false
  })()

  const isMandatory = isStrictlyNewer && Boolean(updateInfo.mandatory || updateInfo.forceUpdate)
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'paused' | 'verifying' | 'ready_to_install' | 'installing' | 'error'>('idle')
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    percent: number
    transferred: number
    total: number
    speed: number
    remainingSeconds: number
    error?: string
  }>({
    percent: 0,
    transferred: 0,
    total: updateInfo.packageInfo?.fileSize || 0,
    speed: 0,
    remainingSeconds: 0
  })

  useEffect(() => {
    if (!isOpen) return

    // Listen to real-time download progress from main process
    const cleanup = (window as any).api?.onDownloadProgress?.((_event: any, data: any) => {
      if (data) {
        setProgress({
          percent: data.percent || 0,
          transferred: data.transferred || 0,
          total: data.total || 0,
          speed: data.speed || 0,
          remainingSeconds: data.remainingSeconds || 0,
          error: data.error
        })

        if (data.status === 'downloading') setDownloadState('downloading')
        else if (data.status === 'paused') setDownloadState('paused')
        else if (data.status === 'verifying') setDownloadState('verifying')
        else if (data.status === 'completed') setDownloadState('ready_to_install')
        else if (data.status === 'error') setDownloadState('error')
      }
    })

    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec <= 0) return '0 KB/s'
    if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  }

  const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return 'Unknown size'
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'calculating...'
    if (seconds < 60) return `${seconds}s remaining`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s remaining`
  }

  const handleStartDownload = async () => {
    const pkg = updateInfo.packageInfo
    if (!pkg?.downloadUrl) {
      setDownloadState('error')
      setProgress(prev => ({ ...prev, error: 'No valid download URL available for this platform.' }))
      return
    }

    setDownloadState('downloading')
    try {
      const res = await (window as any).api?.updaterDownloadUpdate?.(pkg.downloadUrl, pkg.sha256)
      if (res?.success && res?.filePath) {
        setDownloadedFilePath(res.filePath)
        setDownloadState('ready_to_install')
      } else {
        setDownloadState('error')
        setProgress(prev => ({ ...prev, error: res?.error || 'Download failed.' }))
      }
    } catch (err: any) {
      setDownloadState('error')
      setProgress(prev => ({ ...prev, error: err.message }))
    }
  }

  const handlePause = async () => {
    await (window as any).api?.updaterPauseDownload?.()
    setDownloadState('paused')
  }

  const handleResume = async () => {
    setDownloadState('downloading')
    await (window as any).api?.updaterResumeDownload?.()
  }

  const handleCancel = async () => {
    await (window as any).api?.updaterCancelDownload?.()
    setDownloadState('idle')
    setProgress({
      percent: 0,
      transferred: 0,
      total: updateInfo.packageInfo?.fileSize || 0,
      speed: 0,
      remainingSeconds: 0
    })
  }

  const handleInstall = async () => {
    if (!downloadedFilePath) return
    setDownloadState('installing')
    try {
      await (window as any).api?.updaterInstallUpdate?.(downloadedFilePath)
    } catch (err: any) {
      setDownloadState('error')
      setProgress(prev => ({ ...prev, error: `Installation failed: ${err.message}` }))
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 10, 18, 0.85)',
        backdropFilter: 'blur(10px)',
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
          maxWidth: '580px',
          backgroundColor: '#161622',
          border: isMandatory ? '2px solid #EF4444' : '1px solid rgba(45, 212, 191, 0.4)',
          borderRadius: '16px',
          boxShadow: isMandatory
            ? '0 20px 50px rgba(239, 68, 68, 0.3)'
            : '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(45, 212, 191, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.25s ease-out'
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            padding: '20px 24px',
            background: isMandatory
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(45, 212, 191, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)',
            borderBottom: '1px solid #28283C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: isMandatory ? '#EF444420' : '#2DD4BF20',
                border: `1px solid ${isMandatory ? '#EF444460' : '#2DD4BF60'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}
            >
              {isMandatory ? '🚨' : '🚀'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#FFF' }}>
                  {isMandatory ? 'Mandatory Update Required' : 'New Version Available'}
                </h3>
                {isMandatory && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#EF4444',
                      color: '#FFF'
                    }}
                  >
                    REQUIRED
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                {updateInfo.releaseTitle || `AntiProfiles v${updateInfo.version}`}
              </p>
            </div>
          </div>

          {(!isMandatory || downloadState === 'error') && downloadState !== 'installing' && (
            <button
              onClick={onClose}
              title="Close update dialog"
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Version Comparison Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#101018',
              borderRadius: '10px',
              border: '1px solid #232336'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>CURRENT VERSION</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#94A3B8' }}>v{currentVersion}</div>
            </div>
            <div style={{ fontSize: '18px', color: '#2DD4BF' }}>➔</div>
            <div>
              <div style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: 600 }}>LATEST VERSION</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFF' }}>v{updateInfo.version}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>PACKAGE SIZE</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>
                {formatSize(updateInfo.packageInfo?.fileSize || 0)}
              </div>
            </div>
          </div>

          {/* Release Notes */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
              WHAT'S NEW IN THIS RELEASE:
            </div>
            <div
              style={{
                maxHeight: '130px',
                overflowY: 'auto',
                padding: '12px 14px',
                backgroundColor: '#101018',
                borderRadius: '8px',
                border: '1px solid #232336',
                color: '#CBD5E1',
                fontSize: '12px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit'
              }}
            >
              {updateInfo.releaseNotes || '• Performance enhancements and bug fixes.\n• Fingerprint spoofing accuracy updates.\n• Proxy stability and security improvements.'}
            </div>
          </div>

          {/* Download & Progress Section */}
          {downloadState !== 'idle' && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#101018',
                borderRadius: '10px',
                border: '1px solid #232336',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ fontWeight: 600, color: '#FFF' }}>
                  {downloadState === 'downloading' && '📥 Downloading Update Package...'}
                  {downloadState === 'paused' && '⏸️ Download Paused'}
                  {downloadState === 'verifying' && '🔍 Verifying SHA-256 Checksum...'}
                  {downloadState === 'ready_to_install' && '✓ Download & Checksum Verified! Ready to Install.'}
                  {downloadState === 'installing' && '⚙️ Installing & Relaunching...'}
                  {downloadState === 'error' && '❌ Download Failed'}
                </span>
                <span style={{ color: '#2DD4BF', fontWeight: 700 }}>{progress.percent}%</span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#232336',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: '100%',
                    backgroundColor: downloadState === 'error' ? '#EF4444' : '#2DD4BF',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease-out'
                  }}
                />
              </div>

              {/* Download Stats */}
              {downloadState === 'downloading' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                  <span>{formatSize(progress.transferred)} / {formatSize(progress.total)}</span>
                  <span>⚡ {formatSpeed(progress.speed)}</span>
                  <span>⏱️ {formatTime(progress.remainingSeconds)}</span>
                </div>
              )}

              {/* Error Display */}
              {downloadState === 'error' && progress.error && (
                <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>
                  Error: {progress.error}
                </div>
              )}
            </div>
          )}

          {/* Zero Data Loss Assurance Notice */}
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🔒</span>
            <span>Your profiles, cookies, proxies, and database remain 100% safe and intact.</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#101018',
            borderTop: '1px solid #232336',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          {onOpenChangelog && (
            <button
              type="button"
              onClick={onOpenChangelog}
              style={{
                background: 'none',
                border: 'none',
                color: '#2DD4BF',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              📜 View Full Changelog
            </button>
          )}

          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
            {(!isMandatory || downloadState === 'error') && downloadState !== 'downloading' && downloadState !== 'installing' && downloadState !== 'ready_to_install' && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#1E293B',
                  color: '#CBD5E1',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {downloadState === 'error' ? 'Dismiss' : 'Later'}
              </button>
            )}

            {downloadState === 'downloading' && (
              <>
                <button
                  type="button"
                  onClick={handlePause}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #F59E0B',
                    backgroundColor: '#F59E0B20',
                    color: '#FBBF24',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  ⏸ Pause
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #EF4444',
                    backgroundColor: '#EF444420',
                    color: '#F87171',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </>
            )}

            {downloadState === 'paused' && (
              <button
                type="button"
                onClick={handleResume}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2DD4BF',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ▶️ Resume Download
              </button>
            )}

            {downloadState === 'error' && (
              <button
                type="button"
                onClick={handleStartDownload}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2DD4BF',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🔄 Retry Download
              </button>
            )}

            {downloadState === 'idle' && (
              <button
                type="button"
                onClick={handleStartDownload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isMandatory ? '#EF4444' : '#2DD4BF',
                  color: isMandatory ? '#FFF' : '#0F172A',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: isMandatory ? '0 4px 14px rgba(239,68,68,0.4)' : '0 4px 14px rgba(45,212,191,0.3)'
                }}
              >
                <span>📥</span>
                <span>Update Now</span>
              </button>
            )}

            {downloadState === 'ready_to_install' && (
              <button
                type="button"
                onClick={handleInstall}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10B981',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)'
                }}
              >
                <span>🚀</span>
                <span>Install & Restart</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
