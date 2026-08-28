// ──────────────────────────────────────────────
// AntiProfiles — Admin Software Version Management & Enterprise Release Controller
// ──────────────────────────────────────────────

import React, { useState, useEffect } from 'react'

export interface SoftwareVersionItem {
  id: string
  version: string
  build?: string
  channel?: 'stable' | 'beta' | 'alpha' | 'internal'
  release_title: string
  release_notes: string
  status: 'draft' | 'published' | 'disabled' | 'archived'
  min_supported_version: string
  mandatory?: number
  force_update?: number
  
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
  
  signature?: string
  download_count?: number
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
      showToast('error', 'Please specify a version number (e.g. 2.5.0)')
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
        showToast('success', `🚀 Version v${v.version} is now LIVE and pushed to all active devices!`)
        await loadVersions()
      } else {
        showToast('error', res.error || 'Failed to publish.')
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleRollback = async (v: SoftwareVersionItem) => {
    if (!confirm(`Are you sure you want to rollback v${v.version}? This will disable v${v.version} and re-activate the previous stable version.`)) {
      return
    }

    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.updaterRollbackVersion(token, v.id)
      if (res?.success) {
        showToast('success', `✓ Successfully rolled back to v${res.rolledBackTo?.version || 'previous version'}!`)
        await loadVersions()
      } else {
        showToast('error', res?.error || 'Rollback failed.')
      }
    } catch (err: any) {
      showToast('error', 'Rollback error: ' + err.message)
    }
  }

  const handleDisable = async (v: SoftwareVersionItem) => {
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.updaterDisableVersion(token, v.id)
      if (res.success) {
        showToast('success', `Version v${v.version} disabled.`)
        await loadVersions()
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleDelete = async (v: SoftwareVersionItem) => {
    if (!confirm(`Are you sure you want to delete version v${v.version}?`)) return
    try {
      const token = localStorage.getItem('pv_session_token') || ''
      const res = await (window as any).api.updaterDeleteVersion(token, v.id)
      if (res.success) {
        showToast('success', `Version v${v.version} deleted.`)
        await loadVersions()
      }
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const startCreate = () => {
    setEditingVersion({
      version: '',
      build: '1',
      channel: 'stable',
      release_title: 'AntiProfiles Production Release',
      release_notes: '• Security enhancements and fingerprint updates.\n• Proxy performance improvements.\n• Cross-platform compatibility fixes.',
      status: 'draft',
      min_supported_version: '1.0.0',
      mandatory: 0,
      force_update: 0,
      win_download_url: '',
      win_file_size: 118000000,
      win_sha256: '',
      mac_arm_download_url: '',
      mac_arm_file_size: 113000000,
      mac_arm_sha256: '',
      mac_intel_download_url: '',
      mac_intel_file_size: 118000000,
      mac_intel_sha256: '',
      linux_download_url: '',
      linux_file_size: 123000000,
      linux_sha256: ''
    })
    setIsCreating(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: toastMsg.type === 'success' ? '#065F46' : '#7F1D1D',
            color: '#FFF',
            border: `1px solid ${toastMsg.type === 'success' ? '#10B981' : '#EF4444'}`,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px',
          backgroundColor: '#1E1E2E',
          borderRadius: '12px',
          border: '1px solid #2C2C3E',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🚀</span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
              Enterprise Software Release & Auto-Update Controller
            </h2>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '13px', margin: '6px 0 0' }}>
            Publish official application releases, manage update channels, enforce mandatory updates, and broadcast instant real-time updates to all connected devices.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#2DD4BF',
            color: '#0F172A',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(45, 212, 191, 0.3)'
          }}
        >
          <span>➕</span>
          <span>Publish New Version</span>
        </button>
      </div>

      {/* Release Editor Modal */}
      {(isCreating || editingVersion) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#181824',
              borderRadius: '16px',
              border: '1px solid #2C2C3E',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2C2C3E', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFF' }}>
                {isCreating ? '📦 Create & Publish Software Release' : `✏️ Edit Release v${editingVersion?.version}`}
              </h3>
              <button
                type="button"
                onClick={() => { setEditingVersion(null); setIsCreating(false) }}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Core Version Information */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Version Number (e.g. 2.5.0) *
                </label>
                <input
                  type="text"
                  value={editingVersion?.version || ''}
                  onChange={e => setEditingVersion(prev => ({ ...prev!, version: e.target.value }))}
                  placeholder="e.g. 2.5.0"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#101018', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Build Number
                </label>
                <input
                  type="text"
                  value={editingVersion?.build || '1'}
                  onChange={e => setEditingVersion(prev => ({ ...prev!, build: e.target.value }))}
                  placeholder="e.g. 250"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#101018', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Release Channel
                </label>
                <select
                  value={editingVersion?.channel || 'stable'}
                  onChange={e => setEditingVersion(prev => ({ ...prev!, channel: e.target.value as any }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#101018', color: '#FFF', fontSize: '13px' }}
                >
                  <option value="stable">Stable (Production)</option>
                  <option value="beta">Beta (Preview)</option>
                  <option value="alpha">Alpha (Experimental)</option>
                  <option value="internal">Internal Testing</option>
                </select>
              </div>
            </div>

            {/* Title & Minimum Version */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Release Title
                </label>
                <input
                  type="text"
                  value={editingVersion?.release_title || ''}
                  onChange={e => setEditingVersion(prev => ({ ...prev!, release_title: e.target.value }))}
                  placeholder="e.g. AntiProfiles v2.5.0 — Major Performance & Privacy Update"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#101018', color: '#FFF', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Min Supported Version
                </label>
                <input
                  type="text"
                  value={editingVersion?.min_supported_version || '1.0.0'}
                  onChange={e => setEditingVersion(prev => ({ ...prev!, min_supported_version: e.target.value }))}
                  placeholder="e.g. 1.0.0"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#101018', color: '#FFF', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Mandatory Update Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: '#101018', borderRadius: '8px', border: '1px solid #28283C' }}>
              <input
                type="checkbox"
                id="mandatoryUpdate"
                checked={Boolean(editingVersion?.mandatory || editingVersion?.force_update)}
                onChange={e => setEditingVersion(prev => ({ ...prev!, mandatory: e.target.checked ? 1 : 0, force_update: e.target.checked ? 1 : 0 }))}
                style={{ width: '18px', height: '18px', accentColor: '#EF4444', cursor: 'pointer' }}
              />
              <label htmlFor="mandatoryUpdate" style={{ fontSize: '13px', color: '#FFF', cursor: 'pointer' }}>
                <strong style={{ color: '#EF4444' }}>🚨 Mandatory Update:</strong> If enabled, client applications will block access until users update to this release.
              </label>
            </div>

            {/* Release Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                Changelog / Release Notes (Markdown supported)
              </label>
              <textarea
                rows={4}
                value={editingVersion?.release_notes || ''}
                onChange={e => setEditingVersion(prev => ({ ...prev!, release_notes: e.target.value }))}
                placeholder="• Feature 1\n• Bug fix 2\n• Performance improvement 3"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#101018', color: '#FFF', fontSize: '13px', fontFamily: 'monospace' }}
              />
            </div>

            {/* Platform Binaries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid #2C2C3E', paddingTop: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#2DD4BF' }}>
                Platform Installer Binaries & SHA-256 Checksums
              </h4>

              {/* Windows */}
              <div style={{ padding: '12px', backgroundColor: '#101018', borderRadius: '8px', border: '1px solid #232336' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#60A5FA', marginBottom: '6px' }}>🪟 Windows (64-bit .exe)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Download URL (e.g. https://.../AntiProfiles-Setup.exe)"
                    value={editingVersion?.win_download_url || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, win_download_url: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="number"
                    placeholder="Size (bytes)"
                    value={editingVersion?.win_file_size || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, win_file_size: Number(e.target.value) }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    placeholder="SHA-256 Hash"
                    value={editingVersion?.win_sha256 || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, win_sha256: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* macOS Apple Silicon */}
              <div style={{ padding: '12px', backgroundColor: '#101018', borderRadius: '8px', border: '1px solid #232336' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#34D399', marginBottom: '6px' }}>🍎 macOS Apple Silicon (ARM64 M1-M4 .dmg)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Download URL (e.g. https://.../AntiProfiles-arm64.dmg)"
                    value={editingVersion?.mac_arm_download_url || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, mac_arm_download_url: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="number"
                    placeholder="Size (bytes)"
                    value={editingVersion?.mac_arm_file_size || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, mac_arm_file_size: Number(e.target.value) }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    placeholder="SHA-256 Hash"
                    value={editingVersion?.mac_arm_sha256 || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, mac_arm_sha256: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* macOS Intel */}
              <div style={{ padding: '12px', backgroundColor: '#101018', borderRadius: '8px', border: '1px solid #232336' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#A78BFA', marginBottom: '6px' }}>🍎 macOS Intel (x64 .dmg)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Download URL (e.g. https://.../AntiProfiles-x64.dmg)"
                    value={editingVersion?.mac_intel_download_url || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, mac_intel_download_url: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="number"
                    placeholder="Size (bytes)"
                    value={editingVersion?.mac_intel_file_size || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, mac_intel_file_size: Number(e.target.value) }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    placeholder="SHA-256 Hash"
                    value={editingVersion?.mac_intel_sha256 || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, mac_intel_sha256: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* Linux */}
              <div style={{ padding: '12px', backgroundColor: '#101018', borderRadius: '8px', border: '1px solid #232336' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#FBBF24', marginBottom: '6px' }}>🐧 Linux (x64 .AppImage / .deb)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Download URL (e.g. https://.../AntiProfiles.AppImage)"
                    value={editingVersion?.linux_download_url || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, linux_download_url: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="number"
                    placeholder="Size (bytes)"
                    value={editingVersion?.linux_file_size || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, linux_file_size: Number(e.target.value) }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    placeholder="SHA-256 Hash"
                    value={editingVersion?.linux_sha256 || ''}
                    onChange={e => setEditingVersion(prev => ({ ...prev!, linux_sha256: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#181824', color: '#FFF', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #2C2C3E', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => { setEditingVersion(null); setIsCreating(false) }}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1E293B', color: '#CBD5E1', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #6366F1', backgroundColor: '#6366F125', color: '#A5B4FC', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                {saving ? 'Saving...' : '💾 Save as Draft'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#2DD4BF', color: '#0F172A', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(45, 212, 191, 0.4)' }}
              >
                {saving ? 'Publishing...' : '🚀 Publish & Broadcast to All Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Table */}
      <div style={{ backgroundColor: '#1E1E2E', borderRadius: '12px', border: '1px solid #2C2C3E', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2C2C3E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFF' }}>All Published & Draft Releases</h3>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>{versions.length} release(s) registered</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Loading software versions...</div>
        ) : versions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
            No software releases created yet. Click "Publish New Version" above to create your first release!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#161622', color: '#94A3B8', borderBottom: '1px solid #2C2C3E' }}>
                <th style={{ padding: '12px 16px' }}>VERSION</th>
                <th style={{ padding: '12px 16px' }}>CHANNEL</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px' }}>MANDATORY</th>
                <th style={{ padding: '12px 16px' }}>TITLE</th>
                <th style={{ padding: '12px 16px' }}>DATE</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #252538', color: '#E2E8F0' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#FFF' }}>
                    v{v.version} {v.build ? <span style={{ fontSize: '11px', color: '#64748B' }}>({v.build})</span> : null}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#6366F120', color: '#A5B4FC' }}>
                      {(v.channel || 'stable').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: v.status === 'published' ? '#10B98125' : (v.status === 'disabled' ? '#EF444425' : '#F59E0B25'),
                        color: v.status === 'published' ? '#10B981' : (v.status === 'disabled' ? '#EF4444' : '#F59E0B')
                      }}
                    >
                      {v.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {(v.mandatory || v.force_update) ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444' }}>🚨 MANDATORY</span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Optional</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#CBD5E1' }}>{v.release_title}</td>
                  <td style={{ padding: '14px 16px', color: '#64748B', fontSize: '12px' }}>
                    {v.published_at ? v.published_at.split('T')[0] : 'Unpublished'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      {v.status !== 'published' && (
                        <button
                          type="button"
                          onClick={() => handlePublish(v)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#10B98125', color: '#10B981', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                        >
                          🚀 Publish
                        </button>
                      )}

                      {v.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleRollback(v)}
                          title="Disable this version and revert to previous stable release"
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #F59E0B50', backgroundColor: '#F59E0B20', color: '#FBBF24', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                        >
                          ⏪ Rollback
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingVersion(v)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1E293B', color: '#CBD5E1', fontSize: '11px', cursor: 'pointer' }}
                      >
                        ✏️ Edit
                      </button>

                      {v.status !== 'disabled' && (
                        <button
                          type="button"
                          onClick={() => handleDisable(v)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#EF444420', color: '#F87171', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Disable
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(v)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '12px', cursor: 'pointer' }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
