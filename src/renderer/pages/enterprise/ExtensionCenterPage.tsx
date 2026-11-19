import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import type { Profile, Group } from '../../types'
import type { ManagedExtension, ShowToastFn } from '../../types/enterprise'

export function ExtensionCenterPage({ showToast }: { showToast: ShowToastFn }) {
  const [extensions, setExtensions] = useState<ManagedExtension[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [assignModalExt, setAssignModalExt] = useState<ManagedExtension | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [extList, profRes, grpRes] = await Promise.all([
        enterpriseService.listExtensions(search || undefined),
        window.api.getProfiles(),
        window.api.getGroups()
      ])
      setExtensions(extList || [])
      if (profRes?.success && Array.isArray(profRes.data)) setProfiles(profRes.data)
      if (grpRes?.success && Array.isArray(grpRes.data)) setGroups(grpRes.data)
    } catch (err: any) {
      showToast('error', `Failed to load extensions: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [search, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpload = async () => {
    try {
      const fileRes = await window.api.selectFile([
        { name: 'Browser Extensions', extensions: ['zip', 'crx'] }
      ])
      if (!fileRes?.success || !fileRes.data) return
      setUploading(true)
      const ext = await enterpriseService.uploadExtension(fileRes.data)
      showToast('success', `Installed extension "${ext.name}" v${ext.version} (MV${ext.manifestVersion})`)
      if (ext.riskWarnings.length > 0) {
        showToast('warning', `Security notice: ${ext.riskWarnings.length} sensitive permission(s) flagged.`)
      }
      await loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Extension package rejected by security validation')
    } finally {
      setUploading(false)
    }
  }

  const handleToggle = async (ext: ManagedExtension) => {
    try {
      await enterpriseService.toggleExtension(ext.id, !ext.enabled)
      showToast('success', `${ext.name} ${!ext.enabled ? 'enabled' : 'disabled'}`)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleRemove = async (ext: ManagedExtension) => {
    if (!window.confirm(`Remove extension "${ext.name}" and unassign from all profiles?`)) return
    try {
      await enterpriseService.removeExtension(ext.id)
      showToast('success', `Removed "${ext.name}"`)
      await loadData()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleAssignProfile = async () => {
    if (!assignModalExt || !selectedProfileId) return
    try {
      await enterpriseService.assignExtensionToProfile(assignModalExt.id, selectedProfileId)
      showToast('success', `Assigned "${assignModalExt.name}" to profile`)
      setAssignModalExt(null)
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleAssignGroup = async () => {
    if (!assignModalExt || !selectedGroupId) return
    try {
      await enterpriseService.assignExtensionToGroup(assignModalExt.id, selectedGroupId)
      showToast('success', `Assigned "${assignModalExt.name}" to profile group`)
      setAssignModalExt(null)
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Extension Center...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Extension Center</h1>
          <p className="page-subtitle">Upload validated ZIP/CRX packages, inspect manifest permissions, and assign extensions across profiles or groups</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <input
            className="form-input"
            placeholder="Search extensions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <button className="btn btn-primary" disabled={uploading} onClick={handleUpload}>
            {uploading ? 'Validating & Installing...' : '+ Upload ZIP / CRX'}
          </button>
        </div>
      </div>

      {extensions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧩</div>
          <h3 style={{ margin: '0 0 6px' }}>No Managed Extensions Yet</h3>
          <p className="text-secondary" style={{ marginBottom: 16 }}>
            Upload a ZIP or CRX browser extension. Packages are checked for manifest validity, Zip-Slip path safety, and sensitive permissions.
          </p>
          <button className="btn btn-primary" onClick={handleUpload}>Upload Extension Package</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {extensions.map((ext) => (
            <div key={ext.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{ext.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    v{ext.version} • Manifest V{ext.manifestVersion}
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: ext.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                  color: ext.enabled ? '#22C55E' : '#94A3B8'
                }}>
                  {ext.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>

              {ext.description && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>{ext.description}</p>}

              {ext.riskWarnings.length > 0 && (
                <div style={{ padding: 10, borderRadius: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', fontSize: 11, color: '#F59E0B' }}>
                  <strong>⚠ Permission Warnings ({ext.riskWarnings.length}):</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {ext.riskWarnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>
                SHA-256: {ext.sha256.slice(0, 20)}...
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setAssignModalExt(ext)}>Assign</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(ext)}>
                  {ext.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemove(ext)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignModalExt && (
        <>
          <div className="modal-backdrop" onClick={() => setAssignModalExt(null)} />
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">Assign "{assignModalExt.name}"</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAssignModalExt(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Assign to Single Profile</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-select" value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">— Select profile —</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="btn btn-primary" disabled={!selectedProfileId} onClick={handleAssignProfile}>Assign</button>
                </div>
              </div>
              <div>
                <label className="form-label">Bulk Assign to Profile Group</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-select" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">— Select group —</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button className="btn btn-primary" disabled={!selectedGroupId} onClick={handleAssignGroup}>Assign Group</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
