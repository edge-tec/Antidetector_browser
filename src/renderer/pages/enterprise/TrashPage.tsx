import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import type { TrashedProfile, ShowToastFn } from '../../types/enterprise'

export function TrashPage({ showToast }: { showToast: ShowToastFn }) {
  const [items, setItems] = useState<TrashedProfile[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTrash = useCallback(async () => {
    try {
      const list = await enterpriseService.listTrash()
      setItems(list || [])
    } catch (err: any) {
      showToast('error', `Failed to load trash: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.id.toLowerCase().includes(search.toLowerCase()) ||
    item.deletedBy.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleRestore = async (id: string) => {
    try {
      await enterpriseService.restoreFromTrash(id)
      showToast('success', 'Profile restored successfully')
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      await loadTrash()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await enterpriseService.bulkRestoreFromTrash(selectedIds)
      showToast('success', `Restored ${res.restored} profile(s)`)
      setSelectedIds([])
      await loadTrash()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handlePermanentDelete = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete "${name}" and its disk profile data? This cannot be undone.`)) return
    try {
      await enterpriseService.permanentDeleteFromTrash(id)
      showToast('info', `Permanently deleted "${name}"`)
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      await loadTrash()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handlePurgeExpired = async () => {
    try {
      const res = await enterpriseService.purgeExpiredTrash()
      showToast('info', `Purged ${res.purged} expired profile(s)`)
      await loadTrash()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Trash...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trash & Recycle Bin</h1>
          <p className="page-subtitle">Soft-deleted profiles are retained for 30 days before permanent removal</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Search deleted profiles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          {selectedIds.length > 0 && (
            <button className="btn btn-primary" onClick={handleBulkRestore}>
              Restore Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePurgeExpired}>Purge Expired</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
          <h3>Trash is Empty</h3>
          <p className="text-secondary">Deleted profiles appear here for 30 days so you can safely restore them.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Profile Name</th>
                <th>OS</th>
                <th>Deleted By</th>
                <th>Deleted Date</th>
                <th>Retention</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{item.id.slice(0, 12)}</div>
                  </td>
                  <td>{item.osType}</td>
                  <td>{item.deletedBy}</td>
                  <td>{new Date(item.deletedAt).toLocaleString()}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: item.daysRemaining <= 5 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', color: item.daysRemaining <= 5 ? '#EF4444' : '#60A5FA' }}>
                      {item.daysRemaining}d left
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRestore(item.id)}>Restore</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handlePermanentDelete(item.id, item.name)}>Delete Forever</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
