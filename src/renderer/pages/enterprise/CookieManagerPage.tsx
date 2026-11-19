import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import type { Profile } from '../../types'
import type { ManagedCookie, ShowToastFn } from '../../types/enterprise'

export function CookieManagerPage({ showToast }: { showToast: ShowToastFn }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [cookies, setCookies] = useState<ManagedCookie[]>([])
  const [domainFilter, setDomainFilter] = useState('')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProfiles = useCallback(async () => {
    try {
      const res = await window.api.getProfiles()
      if (res?.success && Array.isArray(res.data)) {
        setProfiles(res.data)
        if (res.data.length > 0 && !selectedProfileId) setSelectedProfileId(res.data[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedProfileId])

  const loadCookies = useCallback(async () => {
    if (!selectedProfileId) return setCookies([])
    try {
      const list = await enterpriseService.getCookies(selectedProfileId, domainFilter || undefined)
      setCookies(list || [])
    } catch (err: any) {
      showToast('error', err.message)
    }
  }, [selectedProfileId, domainFilter, showToast])

  useEffect(() => { loadProfiles() }, [loadProfiles])
  useEffect(() => { loadCookies() }, [loadCookies])

  const handleImport = async () => {
    if (!selectedProfileId || !importText.trim()) return
    try {
      const res = await enterpriseService.importCookies(selectedProfileId, importText)
      showToast('success', `Imported ${res.imported} cookies`)
      setImportText('')
      setShowImport(false)
      await loadCookies()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleExport = async () => {
    if (!selectedProfileId) return
    try {
      const json = await enterpriseService.exportCookies(selectedProfileId, domainFilter || undefined)
      await navigator.clipboard.writeText(json)
      showToast('success', 'Cookies exported to clipboard (JSON)')
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleDelete = async (c: ManagedCookie) => {
    if (!selectedProfileId) return
    try {
      await enterpriseService.deleteCookie(selectedProfileId, c.name, c.domain)
      showToast('info', `Deleted cookie ${c.name}`)
      await loadCookies()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleClearAll = async () => {
    if (!selectedProfileId || !window.confirm('Clear all cookies for this profile?')) return
    try {
      await enterpriseService.clearCookies(selectedProfileId)
      showToast('info', 'All cookies cleared')
      await loadCookies()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Cookie Manager...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cookie & Session Manager</h1>
          <p className="page-subtitle">Inspect, search, import (JSON/Netscape), export, and manage browser profile cookies</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}>Import Cookies</button>
          <button className="btn btn-secondary" disabled={!selectedProfileId} onClick={handleExport}>Export JSON</button>
          <button className="btn btn-danger" disabled={!selectedProfileId} onClick={handleClearAll}>Clear All</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 10 }}>
        <select className="form-select" value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} style={{ minWidth: 220 }}>
          <option value="">— Select Profile —</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
        </select>
        <input className="form-input" placeholder="Filter by domain or cookie name..." value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} style={{ flex: 1 }} />
      </div>

      {showImport && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <label className="form-label">Paste JSON Array or Netscape cookies.txt</label>
          <textarea className="form-input" rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} style={{ width: '100%', fontFamily: 'monospace', marginBottom: 8 }} />
          <button className="btn btn-primary" onClick={handleImport}>Import Now</button>
        </div>
      )}

      <div className="card" style={{ padding: 16 }}>
        {cookies.length === 0 ? (
          <div className="text-secondary">No cookies found for this profile/filter.</div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Name</th>
                <th>Flags</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((c, idx) => (
                <tr key={`${c.domain}-${c.name}-${idx}`}>
                  <td>{c.domain}</td>
                  <td style={{ fontFamily: 'monospace' }}>{c.name}</td>
                  <td>{c.secure ? 'Secure ' : ''}{c.httpOnly ? 'HttpOnly' : ''}</td>
                  <td>{c.expires ? new Date(c.expires * 1000).toLocaleDateString() : 'Session'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
