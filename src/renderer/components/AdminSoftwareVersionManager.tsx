// ──────────────────────────────────────────────
// AntiProfiles — Admin Software Version Management & Release Controller
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

export interface SoftwareVersionItem {
  id: string
  version: string
  release_title: string
  release_notes: string
  status: 'draft' | 'published' | 'disabled'
  min_supported_version: string
  force_update: number
  
  win_download_url: string
  win_file_size: number
  win_sha256: string
  
  mac_intel_download_url: string
  mac_intel_file_size: number
  mac_intel_sha256: string
  
  mac_arm_download_url: string
  mac_arm_file_size: number
  mac_arm_sha256: string
  
  linux_download_url: string
  linux_file_size: number
  linux_sha256: string
  
  published_at?: string | null
  created_at: string
  updated_at: string
}

export const AdminSoftwareVersionManager: React.FC = () => {
  const [versions, setVersions] = useState<SoftwareVersionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVersion, setEditingVersion] = useState<Partial<SoftwareVersionItem> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadVersions = async () => {
    setLoading(true)
    try {
      if ((window as any).api?.updaterGetAllVersions) {
        const token = localStorage.getItem('pv_session_token') || ''
        const res = await (window as any).api.updaterGetAllVersions(token)
        if (res.success && Array.isArray(res.data)) {
          setVersions(res.data)
        }
      }
    } catch (err: any) {
      showToast('error', 'Failed to load versions: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVersions()
  }, [])

  const handleSave = async (publishImmediately = false) => {
    if (!editingVersion?.version?.trim()) {
      showToast('error', 'Please specify a version number (e.g. 1.1.0)')
      return
    }
    setSaving(true)
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const payload = {
        ...editingVersion,
        status: publishImmediately ? 'published' : (editingVersion.status || 'draft')
      }
      const res = await (window as any).api.updaterSaveVersion(token, payload)
      if (res.success) {
        showToast('success', publishImmediately ? `✓ Version v${res.data.version} published & broadcast to all connected clients!` : `✓ Version v${res.data.version} saved successfully!`)
        setEditingVersion(null)
        setIsCreating(false)
        await loadVersions()
      } else {
        showToast('error', res.error || 'Failed to save version.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving version.')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (v: SoftwareVersionItem) => {
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.updaterPublishVersion(token, v.id)
      if (res.success) {
        showToast('success', `🚀 Version v${v.version} is now PUBLISHED! Real-time notification sent to all active clients.`)
        await loadVersions()
      } else {
        showToast('error', res.error || 'Failed to publish version.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error publishing version.')
    }
  }

  const handleDisable = async (v: SoftwareVersionItem) => {
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.updaterDisableVersion(token, v.id)
      if (res.success) {
        showToast('success', `Version v${v.version} disabled.`)
        await loadVersions()
      } else {
        showToast('error', res.error || 'Failed to disable version.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error disabling version.')
    }
  }

  const handleDelete = async (v: SoftwareVersionItem) => {
    if (!confirm(`Are you sure you want to delete release version v${v.version}?`)) return
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.updaterDeleteVersion(token, v.id)
      if (res.success) {
        showToast('success', `Deleted version v${v.version}`)
        await loadVersions()
      } else {
        showToast('error', res.error || 'Failed to delete version.')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting version.')
    }
  }

  const latestPublished = versions.find(v => v.status === 'published')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: toastMsg.type === 'success' ? '#065F46' : '#991B1B',
          color: '#FFF',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#161622',
        border: '1px solid #2C2C3E',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#FFF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span> Software Releases & Real-Time Auto-Update Controller
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>
            Publish multi-OS releases and instantly notify all active user clients via real-time SSE stream.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', marginRight: '8px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Active Version</div>
            <div style={{ fontSize: '14px', color: '#2DD4BF', fontWeight: 700 }}>
              {latestPublished ? `v${latestPublished.version}` : 'None Published'}
            </div>
          </div>
          <button
            onClick={() => {
              setEditingVersion({
                version: '',
                release_title: '',
                release_notes: '',
                status: 'draft',
                min_supported_version: '1.0.0',
                force_update: 0,
                win_download_url: 'https://releases.antiprofiles.com/AntiProfiles-Windows-x64.exe',
                win_file_size: 85000000,
                mac_intel_download_url: 'https://releases.antiprofiles.com/AntiProfiles-macOS-Intel-x64.dmg',
                mac_intel_file_size: 92000000,
                mac_arm_download_url: 'https://releases.antiprofiles.com/AntiProfiles-macOS-Apple-Silicon-arm64.dmg',
                mac_arm_file_size: 89000000,
                linux_download_url: 'https://releases.antiprofiles.com/AntiProfiles-Linux-x86_64.AppImage',
                linux_file_size: 81000000
              })
              setIsCreating(true)
            }}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              backgroundColor: '#2DD4BF',
              color: '#0F172A',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>+</span> Create New Release
          </button>
        </div>
      </div>

      {/* Editor Modal / Card */}
      {(isCreating || editingVersion) && (
        <div style={{
          background: '#161622',
          border: '1px solid #2DD4BF50',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#FFF', fontWeight: 700 }}>
              {editingVersion?.id ? `✏️ Edit Release v${editingVersion.version}` : '🚀 Author New Software Release'}
            </h4>
            <button
              onClick={() => { setEditingVersion(null); setIsCreating(false) }}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Version Number *</label>
              <input
                type="text"
                placeholder="e.g. 1.1.0"
                value={editingVersion?.version || ''}
                onChange={e => setEditingVersion({ ...editingVersion, version: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Release Title *</label>
              <input
                type="text"
                placeholder="e.g. AntiProfiles v1.1.0 — Performance & Anti-Detection Overhaul"
                value={editingVersion?.release_title || ''}
                onChange={e => setEditingVersion({ ...editingVersion, release_title: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Status</label>
              <select
                value={editingVersion?.status || 'draft'}
                onChange={e => setEditingVersion({ ...editingVersion, status: e.target.value as any })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px' }}
              >
                <option value="draft">Draft (Private)</option>
                <option value="published">Published (Live & Broadcasted)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Release Notes / "What's New" *</label>
            <textarea
              rows={4}
              placeholder="• Feature 1: Multi-profile proxy routing&#10;• Feature 2: Firefox Quantum engine support&#10;• Security: SHA-256 integrity verification"
              value={editingVersion?.release_notes || ''}
              onChange={e => setEditingVersion({ ...editingVersion, release_notes: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#14141F', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '13px', lineHeight: 1.6 }}
            />
          </div>

          <div style={{ borderTop: '1px solid #2C2C3E', paddingTop: '16px' }}>
            <h5 style={{ margin: '0 0 12px', fontSize: '14px', color: '#E2E8F0' }}>📦 Operating System Binary Packages & Checksums</h5>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Windows */}
              <div style={{ background: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, color: '#60A5FA', fontSize: '13px', marginBottom: '8px' }}>🪟 Windows (x64)</div>
                <input
                  type="text"
                  placeholder="Download URL (.exe)"
                  value={editingVersion?.win_download_url || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, win_download_url: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '11px', marginBottom: '6px' }}
                />
                <input
                  type="text"
                  placeholder="SHA-256 Checksum (Optional)"
                  value={editingVersion?.win_sha256 || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, win_sha256: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </div>

              {/* macOS Apple Silicon */}
              <div style={{ background: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, color: '#F59E0B', fontSize: '13px', marginBottom: '8px' }}>⚡ macOS Apple Silicon (arm64)</div>
                <input
                  type="text"
                  placeholder="Download URL (.dmg)"
                  value={editingVersion?.mac_arm_download_url || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, mac_arm_download_url: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '11px', marginBottom: '6px' }}
                />
                <input
                  type="text"
                  placeholder="SHA-256 Checksum (Optional)"
                  value={editingVersion?.mac_arm_sha256 || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, mac_arm_sha256: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </div>

              {/* macOS Intel */}
              <div style={{ background: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, color: '#10B981', fontSize: '13px', marginBottom: '8px' }}>🍏 macOS Intel (x64)</div>
                <input
                  type="text"
                  placeholder="Download URL (.dmg)"
                  value={editingVersion?.mac_intel_download_url || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, mac_intel_download_url: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '11px', marginBottom: '6px' }}
                />
                <input
                  type="text"
                  placeholder="SHA-256 Checksum (Optional)"
                  value={editingVersion?.mac_intel_sha256 || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, mac_intel_sha256: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </div>

              {/* Linux */}
              <div style={{ background: '#14141F', border: '1px solid #2C2C3E', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, color: '#A78BFA', fontSize: '13px', marginBottom: '8px' }}>🐧 Linux (x64 AppImage)</div>
                <input
                  type="text"
                  placeholder="Download URL (.AppImage)"
                  value={editingVersion?.linux_download_url || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, linux_download_url: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#FFF', fontSize: '11px', marginBottom: '6px' }}
                />
                <input
                  type="text"
                  placeholder="SHA-256 Checksum (Optional)"
                  value={editingVersion?.linux_sha256 || ''}
                  onChange={e => setEditingVersion({ ...editingVersion, linux_sha256: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0F0F17', border: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #2C2C3E', paddingTop: '16px' }}>
            <button
              onClick={() => { setEditingVersion(null); setIsCreating(false) }}
              style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#2C2C3E', color: '#FFF', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={() => handleSave(false)}
              style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#334155', color: '#FFF', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {saving ? 'Saving...' : '💾 Save Draft'}
            </button>
            <button
              disabled={saving}
              onClick={() => handleSave(true)}
              style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#2DD4BF', color: '#0F172A', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              {saving ? 'Publishing...' : '🚀 Publish & Broadcast to All Clients'}
            </button>
          </div>
        </div>
      )}

      {/* Releases History Table */}
      <div style={{
        background: '#161622',
        border: '1px solid #2C2C3E',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#F1F5F9', fontWeight: 700 }}>
            Release History & Version Control ({versions.length})
          </h4>
          <button onClick={loadVersions} style={{ background: 'none', border: 'none', color: '#2DD4BF', cursor: 'pointer', fontSize: '12px' }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>Loading versions...</div>
        ) : versions.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No software versions created yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2C2C3E', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Version</th>
                  <th style={{ padding: '12px 16px' }}>Title & What's New</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Packages</th>
                  <th style={{ padding: '12px 16px' }}>Published Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map(v => {
                  const isPub = v.status === 'published'
                  const isDis = v.status === 'disabled'
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1F1F2E' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: isPub ? '#2DD4BF' : '#FFF' }}>
                        v{v.version}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{v.release_title}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.release_notes}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isPub ? 'rgba(45,212,191,0.15)' : isDis ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: isPub ? '#2DD4BF' : isDis ? '#EF4444' : '#F59E0B'
                        }}>
                          {isPub ? '● Published' : isDis ? 'Disabled' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
                          <span title={v.win_download_url ? 'Windows Available' : 'Missing'} style={{ opacity: v.win_download_url ? 1 : 0.3 }}>🪟</span>
                          <span title={v.mac_arm_download_url ? 'macOS arm64 Available' : 'Missing'} style={{ opacity: v.mac_arm_download_url ? 1 : 0.3 }}>⚡</span>
                          <span title={v.mac_intel_download_url ? 'macOS Intel Available' : 'Missing'} style={{ opacity: v.mac_intel_download_url ? 1 : 0.3 }}>🍏</span>
                          <span title={v.linux_download_url ? 'Linux Available' : 'Missing'} style={{ opacity: v.linux_download_url ? 1 : 0.3 }}>🐧</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '12px' }}>
                        {v.published_at ? new Date(v.published_at).toLocaleDateString() : 'Unpublished'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {!isPub && (
                            <button
                              onClick={() => handlePublish(v)}
                              style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(45,212,191,0.15)', color: '#2DD4BF', border: '1px solid #2DD4BF', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              🚀 Publish
                            </button>
                          )}
                          {isPub && (
                            <button
                              onClick={() => handleDisable(v)}
                              style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#2C2C3E', color: '#EF4444', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Disable
                            </button>
                          )}
                          <button
                            onClick={() => { setEditingVersion(v); setIsCreating(false) }}
                            style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#2C2C3E', color: '#FFF', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(v)}
                            style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#2C2C3E', color: '#EF4444', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
