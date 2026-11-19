import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import type { Profile } from '../../types'
import type { SyncSessionState, TileGridLayout, ShowToastFn } from '../../types/enterprise'

export function SynchronizerPage({ showToast }: { showToast: ShowToastFn }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [syncState, setSyncState] = useState<SyncSessionState | null>(null)
  const [masterId, setMasterId] = useState<string>('')
  const [selectedFollowers, setSelectedFollowers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [navUrl, setNavUrl] = useState('https://example.com')
  const [typeText, setTypeText] = useState('')
  const [gridLayout, setGridLayout] = useState<TileGridLayout>('2x2')

  const loadData = useCallback(async () => {
    try {
      const [profRes, status] = await Promise.all([
        window.api.getProfiles(),
        enterpriseService.getSyncStatus()
      ])
      if (profRes?.success && Array.isArray(profRes.data)) {
        setProfiles(profRes.data)
      }
      setSyncState(status)
      if (status.active && status.masterProfileId) {
        setMasterId(status.masterProfileId)
        setSelectedFollowers(status.followerProfileIds)
      }
    } catch (err: any) {
      showToast('error', `Failed to load synchronizer state: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 4000)
    return () => clearInterval(timer)
  }, [loadData])

  const runningProfiles = profiles.filter((p) => p.status === 'running')

  const toggleFollower = (id: string) => {
    if (id === masterId) return
    setSelectedFollowers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleStartSync = async () => {
    if (!masterId) return showToast('warning', 'Select a running Master profile first.')
    if (selectedFollowers.length === 0) return showToast('warning', 'Select at least one Follower profile.')
    setBusy(true)
    try {
      const state = await enterpriseService.startSync(masterId, selectedFollowers)
      setSyncState(state)
      showToast('success', `Synchronization started (${state.connectedFollowers.length} followers connected)`)
    } catch (err: any) {
      showToast('error', err.message || 'Failed to start synchronization')
    } finally {
      setBusy(false)
    }
  }

  const handleStopSync = async () => {
    setBusy(true)
    try {
      const state = await enterpriseService.stopSync()
      setSyncState(state)
      showToast('info', 'Synchronization stopped')
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleExcludeToggle = async (profileId: string, excluded: boolean) => {
    try {
      const state = await enterpriseService.excludeSyncWindow(profileId, excluded)
      setSyncState(state)
      showToast('info', `${excluded ? 'Paused' : 'Resumed'} sync for window`)
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleBroadcast = async (payload: Parameters<typeof enterpriseService.broadcastSyncAction>[0]) => {
    setBusy(true)
    try {
      const res = await enterpriseService.broadcastSyncAction(payload)
      showToast('success', `Action "${payload.type}" mirrored to ${res.succeeded.length} window(s)${res.failed.length ? ` (${res.failed.length} failed)` : ''}`)
      loadData()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleTile = async (layout: TileGridLayout) => {
    const ids = Array.from(new Set([masterId, ...selectedFollowers].filter(Boolean)))
    const targets = ids.length > 0 ? ids : runningProfiles.map((p) => p.id)
    if (targets.length === 0) return showToast('warning', 'No running browser windows to tile.')
    setGridLayout(layout)
    setBusy(true)
    try {
      const res = await enterpriseService.tileSyncWindows(targets, layout, {
        width: window.screen.availWidth || 1920,
        height: window.screen.availHeight || 1080
      })
      showToast('success', `Arranged ${res.arranged} windows in ${layout} grid`)
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Multi-Window Synchronizer...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Multi-Window Synchronizer</h1>
          <p className="page-subtitle">Mirror authorized navigation, scroll, and QA actions from a Master browser to selected Slave windows</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          {(['2x2', '3x3', '4x4'] as TileGridLayout[]).map((layout) => (
            <button
              key={layout}
              className={`btn ${gridLayout === layout ? 'btn-primary' : 'btn-secondary'}`}
              disabled={busy}
              onClick={() => handleTile(layout)}
            >
              Tile {layout}
            </button>
          ))}
          {syncState?.active ? (
            <button className="btn btn-danger" disabled={busy} onClick={handleStopSync}>
              Stop Sync
            </button>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={handleStartSync}>
              Start Sync
            </button>
          )}
        </div>
      </div>

      <div className="grid-stats" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-value">{syncState?.active ? 'ACTIVE' : 'IDLE'}</div>
          <div className="stat-card-label">Sync Session Status</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{runningProfiles.length}</div>
          <div className="stat-card-label">Running Browsers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{syncState?.connectedFollowers.length ?? 0}</div>
          <div className="stat-card-label">Connected Followers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{syncState?.excludedProfileIds.length ?? 0}</div>
          <div className="stat-card-label">Excluded Windows</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
        {/* Profile Selection Sidebar */}
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Select Master & Follower Windows</h3>
          {profiles.length === 0 ? (
            <div className="empty-state">No profiles found. Create and launch profiles first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {profiles.map((p) => {
                const isRunning = p.status === 'running'
                const isMaster = masterId === p.id
                const isFollower = selectedFollowers.includes(p.id)
                const isExcluded = syncState?.excludedProfileIds.includes(p.id)

                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${isMaster ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: isMaster ? 'var(--color-accent-subtle)' : 'var(--color-bg-tertiary)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.name}{' '}
                        <span style={{ fontSize: 11, color: isRunning ? '#22C55E' : 'var(--color-text-tertiary)' }}>
                          ({isRunning ? 'Running' : 'Stopped'})
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{p.osType || 'windows-10'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={`btn btn-sm ${isMaster ? 'btn-primary' : 'btn-secondary'}`}
                        disabled={!isRunning || syncState?.active}
                        onClick={() => {
                          setMasterId(p.id)
                          setSelectedFollowers((prev) => prev.filter((x) => x !== p.id))
                        }}
                      >
                        {isMaster ? 'Master' : 'Set Master'}
                      </button>
                      {!isMaster && (
                        <button
                          className={`btn btn-sm ${isFollower ? 'btn-primary' : 'btn-secondary'}`}
                          disabled={!isRunning || syncState?.active}
                          onClick={() => toggleFollower(p.id)}
                        >
                          {isFollower ? 'Follower ✓' : '+ Follower'}
                        </button>
                      )}
                      {syncState?.active && isFollower && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleExcludeToggle(p.id, !isExcluded)}
                        >
                          {isExcluded ? 'Resume' : 'Exclude'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Synchronized Action Controls & Live Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Synchronized Action Broadcast</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                className="form-input"
                value={navUrl}
                onChange={(e) => setNavUrl(e.target.value)}
                placeholder="https://example.com"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                disabled={!syncState?.active || busy}
                onClick={() => handleBroadcast({ type: 'navigate', url: navUrl })}
              >
                Navigate All
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                className="form-input"
                value={typeText}
                onChange={(e) => setTypeText(e.target.value)}
                placeholder="Text to type in focused input..."
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                disabled={!syncState?.active || busy || !typeText}
                onClick={() => handleBroadcast({ type: 'type', text: typeText })}
              >
                Type Text
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-secondary" disabled={!syncState?.active || busy} onClick={() => handleBroadcast({ type: 'back' })}>← Back</button>
              <button className="btn btn-secondary" disabled={!syncState?.active || busy} onClick={() => handleBroadcast({ type: 'forward' })}>Forward →</button>
              <button className="btn btn-secondary" disabled={!syncState?.active || busy} onClick={() => handleBroadcast({ type: 'reload' })}>↻ Reload</button>
              <button className="btn btn-secondary" disabled={!syncState?.active || busy} onClick={() => handleBroadcast({ type: 'scroll', deltaY: 450 })}>↓ Scroll Down</button>
              <button className="btn btn-secondary" disabled={!syncState?.active || busy} onClick={() => handleBroadcast({ type: 'scroll', deltaY: -450 })}>↑ Scroll Up</button>
            </div>
          </div>

          <div className="card" style={{ padding: 18, flex: 1 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Synchronization Event Logs</h3>
            <div style={{ maxHeight: 220, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
              {(!syncState?.logs || syncState.logs.length === 0) ? (
                <div className="text-secondary">No synchronization events yet.</div>
              ) : (
                syncState.logs.map((entry, idx) => (
                  <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--color-border)', color: entry.level === 'error' ? '#EF4444' : 'var(--color-text-secondary)' }}>
                    [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
