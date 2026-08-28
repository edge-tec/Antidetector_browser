import React, { useState, useEffect } from 'react'

export interface VersionHistoryItem {
  id: string
  version: string
  build?: string
  channel?: string
  release_title: string
  release_notes: string
  mandatory?: number
  published_at?: string
  download_count?: number
}

interface VersionHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  currentVersion: string
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  currentVersion
}) => {
  const [history, setHistory] = useState<VersionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const loadHistory = async () => {
      setLoading(true)
      try {
        if ((window as any).api?.updaterGetAllVersions) {
          const token = localStorage.getItem('pv_session_token') || ''
          const res = await (window as any).api.updaterGetAllVersions(token)
          if (res?.success && Array.isArray(res?.data)) {
            setHistory(res.data)
          }
        }
      } catch {
        // Fallback default
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 10, 18, 0.85)',
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
          maxWidth: '680px',
          maxHeight: '85vh',
          backgroundColor: '#161622',
          border: '1px solid #2C2C3E',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #28283C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(45, 212, 191, 0.05) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📜</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFF' }}>Version History & Changelog</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Complete release notes, security patches, and feature updates.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
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
        </div>

        {/* Timeline Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Loading release history...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              <div>📦</div>
              <p style={{ marginTop: '8px' }}>Currently running AntiProfiles v{currentVersion} (Production Build)</p>
            </div>
          ) : (
            history.map((item, idx) => {
              const isCurrent = item.version === currentVersion
              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: isCurrent ? '#2DD4BF10' : '#101018',
                    border: `1px solid ${isCurrent ? '#2DD4BF50' : '#232336'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#FFF' }}>v{item.version}</span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#2DD4BF25',
                            color: '#2DD4BF',
                            border: '1px solid #2DD4BF50'
                          }}
                        >
                          INSTALLED VERSION
                        </span>
                      )}
                      {item.channel && item.channel !== 'stable' && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#8B5CF625',
                            color: '#C084FC'
                          }}
                        >
                          {item.channel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {item.published_at ? item.published_at.split('T')[0] : 'Release'}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>
                    {item.release_title || `AntiProfiles v${item.version}`}
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      backgroundColor: '#14141F',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #1E1E2E'
                    }}
                  >
                    {item.release_notes || 'General stability and performance improvements.'}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#101018',
            borderTop: '1px solid #232336',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2DD4BF',
              color: '#0F172A',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
