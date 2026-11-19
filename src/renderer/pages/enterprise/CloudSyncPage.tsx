import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import type { Profile } from '../../types'
import type { EncryptedArchiveMetadata, ShowToastFn } from '../../types/enterprise'

export function CloudSyncPage({ showToast }: { showToast: ShowToastFn }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [backups, setBackups] = useState<EncryptedArchiveMetadata[]>([])
  const [status, setStatus] = useState<{ provider: string; s3Configured: boolean } | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadBase = useCallback(async () => {
    try {
      const [profRes, syncStat] = await Promise.all([
        window.api.getProfiles(),
        enterpriseService.getCloudSyncStatus()
      ])
      setStatus(syncStat)
      if (profRes?.success && Array.isArray(profRes.data)) {
        setProfiles(profRes.data)
        if (profRes.data.length > 0 && !selectedProfileId) {
          setSelectedProfileId(profRes.data[0].id)
        }
      }
    } catch (err: any) {
      showToast('error', `Failed to load cloud sync status: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedProfileId, showToast])

  const loadBackups = useCallback(async () => {
    if (!selectedProfileId) return setBackups([])
    try {
      const list = await enterpriseService.listCloudBackups(selectedProfileId)
      setBackups(list || [])
    } catch (err: any) {
      showToast('error', err.message)
    }
  }, [selectedProfileId, showToast])

  useEffect(() => {
    loadBase()
  }, [loadBase])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const handleBackup = async () => {
    if (!selectedProfileId) return showToast('warning', 'Select a profile first.')
    if (passphrase.length < 8) return showToast('warning', 'Encryption passphrase must be at least 8 characters.')
    setBusy(true)
    try {
      const meta = await enterpriseService.backupProfileCloud(selectedProfileId, passphrase)
      showToast('success', `Created AES-256-GCM encrypted backup v${meta.versionNum} (${meta.sizeBytes} bytes)`)
      await loadBackups()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (backupId: string) => {
    if (passphrase.length < 8) return showToast('warning', 'Enter your decryption passphrase (8+ chars) to restore.')
    setBusy(true)
    try {
      const res = await enterpriseService.restoreCloudBackup(backupId, passphrase)
      showToast('success', `Integrity verified & restored v${res.versionNum} (${res.restoredFiles} files)`)
    } catch (err: any) {
      showToast('error', err.message || 'Decryption or SHA-256 integrity verification failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Cloud Profile Sync...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">E2E Encrypted Cloud Profile Sync</h1>
          <p className="page-subtitle">Client-side AES-256-GCM encrypted backups with scrypt key derivation and SHA-256 integrity verification</p>
        </div>
      </div>

      <div className="grid-stats" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-value">AES-256-GCM</div>
          <div className="stat-card-label">Client-Side Encryption</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{status?.s3Configured ? 'S3 / R2' : 'Local Vault'}</div>
          <div className="stat-card-label">Active Storage Provider</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{backups.length}</div>
          <div className="stat-card-label">Encrypted Versions</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">Zero-Knowledge</div>
          <div className="stat-card-label">Keys Never Stored with Archives</div>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Create or Restore Encrypted Backup</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <select className="form-select" value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">— Select Profile —</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            type="password"
            className="form-input"
            placeholder="Encryption passphrase (min 8 chars, never saved)..."
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
          <button className="btn btn-primary" disabled={busy || !selectedProfileId} onClick={handleBackup}>
            {busy ? 'Encrypting...' : '🔒 Create Encrypted Backup'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Backup Version History</h3>
        {backups.length === 0 ? (
          <div className="text-secondary">No encrypted backups found for this profile yet.</div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Provider</th>
                <th>Size</th>
                <th>SHA-256 Integrity</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td><strong>v{b.versionNum}</strong></td>
                  <td>{b.provider}</td>
                  <td>{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.sha256.slice(0, 20)}...</td>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleRestore(b.id)}>
                      Restore
                    </button>
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
