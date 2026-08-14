import React, { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onBulkCreate: (count: number, osType: string, namePrefix: string, groupId?: string, proxyId?: string) => Promise<void>
  groups: any[]
  proxies: any[]
}

export const BulkProfileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onBulkCreate,
  groups,
  proxies
}) => {
  const [count, setCount] = useState(5)
  const [osType, setOsType] = useState('windows-10')
  const [namePrefix, setNamePrefix] = useState('Profile')
  const [groupId, setGroupId] = useState('')
  const [proxyId, setProxyId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onBulkCreate(count, osType, namePrefix, groupId || undefined, proxyId || undefined)
      onClose()
    } catch (err) {
      console.error('Bulk profile creation failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#181824',
        border: '1px solid #2A2A3C',
        borderRadius: '12px',
        padding: '24px',
        width: '480px',
        color: '#E2E8F0',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Bulk Create Profiles</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Number of Profiles to Create</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#1E1E2D', border: '1px solid #2E2E42', color: '#FFF' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Target Operating System</label>
            <select
              value={osType}
              onChange={e => setOsType(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#1E1E2D', border: '1px solid #2E2E42', color: '#FFF' }}
            >
              <option value="windows-10">Windows 10</option>
              <option value="windows-11">Windows 11</option>
              <option value="macos-intel">macOS (Intel)</option>
              <option value="macos-arm">macOS (Apple Silicon)</option>
              <option value="linux">Linux</option>
              <option value="android">Android</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Name Prefix</label>
            <input
              type="text"
              value={namePrefix}
              onChange={e => setNamePrefix(e.target.value)}
              placeholder="e.g. Account, QA-Agent"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#1E1E2D', border: '1px solid #2E2E42', color: '#FFF' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B' }}>
              Profiles will be named: "{namePrefix} 1", "{namePrefix} 2", etc. Each will have a unique, consistent fingerprint.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Group (Optional)</label>
              <select
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#1E1E2D', border: '1px solid #2E2E42', color: '#FFF' }}
              >
                <option value="">None</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Proxy (Optional)</label>
              <select
                value={proxyId}
                onChange={e => setProxyId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#1E1E2D', border: '1px solid #2E2E42', color: '#FFF' }}
              >
                <option value="">None</option>
                {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#2A2A3C', color: '#CBD5E1', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                backgroundColor: '#6366F1',
                color: '#FFF',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isSubmitting ? 'Creating...' : `Create ${count} Profiles`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
