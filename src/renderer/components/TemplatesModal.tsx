import React, { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (templateOs: string, templateName: string, mode: 'create' | 'edit') => Promise<void>
}

export const TemplatesModal: React.FC<Props> = ({ isOpen, onClose, onSelectTemplate }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (!isOpen) return null

  const templates = [
    {
      id: 'win10-std',
      name: 'Windows 10 Standard Desktop',
      os: 'windows-10',
      desc: 'Common Windows 10 profile with Intel UHD graphics, 1920x1080 resolution, and 8GB RAM.',
      icon: '🪟',
      badge: 'Popular'
    },
    {
      id: 'win11-gamer',
      name: 'Windows 11 High-End Workstation',
      os: 'windows-11',
      desc: 'Windows 11 with NVIDIA GeForce RTX 3080, 2560x1440 resolution, 32GB RAM, 16 CPU cores.',
      icon: '🎮',
      badge: 'High Spec'
    },
    {
      id: 'mac-m2-dev',
      name: 'macOS Apple Silicon (M2 / M3)',
      os: 'macos-arm',
      desc: 'MacBook Pro 14" with Apple M2 GPU, 3024x1964 Retina screen, 16GB RAM.',
      icon: '🍎',
      badge: 'Retina'
    },
    {
      id: 'mac-intel-std',
      name: 'macOS Intel Legacy',
      os: 'macos-intel',
      desc: 'MacBook Pro Intel with Iris Plus Graphics, 2560x1600 resolution.',
      icon: '💻',
      badge: 'Legacy'
    },
    {
      id: 'linux-priv',
      name: 'Linux Privacy Workstation',
      os: 'linux',
      desc: 'Ubuntu x86_64 desktop with Mesa Intel graphics, 1920x1080 resolution, and strict font masking.',
      icon: '🐧',
      badge: 'Privacy'
    },
    {
      id: 'android-pixel8',
      name: 'Android Mobile QA (Pixel 8)',
      os: 'android',
      desc: 'Android 14 mobile profile with touch support, 412x915 resolution, and Adreno 740 GPU.',
      icon: '📱',
      badge: 'Mobile'
    }
  ]

  const handleAction = async (tpl: typeof templates[0], mode: 'create' | 'edit') => {
    setLoadingId(tpl.id)
    try {
      await onSelectTemplate(tpl.os, tpl.name, mode)
      onClose()
    } catch (err) {
      console.error('Failed to select template:', err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#181824',
        border: '1px solid #2A2A3C',
        borderRadius: '14px',
        padding: '28px',
        width: '720px',
        color: '#E2E8F0',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#F1F5F9' }}>🎨 Profile Templates</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94A3B8' }}>Choose a template to create a new profile instantly or open in editor</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '22px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Templates Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', maxHeight: '440px', overflowY: 'auto' }}>
          {templates.map(tpl => {
            const isLoading = loadingId === tpl.id
            return (
              <div
                key={tpl.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#1E1E2D',
                  border: '1px solid #2E2E42',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#F1F5F9' }}>{tpl.icon} {tpl.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#6366F120', color: '#818CF8', fontSize: '11px', fontWeight: 600 }}>
                      {tpl.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', lineHeight: '1.5' }}>{tpl.desc}</p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleAction(tpl, 'create')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#6366F1',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.7 : 1
                    }}
                  >
                    {isLoading ? 'Creating...' : '⚡ Create Profile'}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleAction(tpl, 'edit')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#2A2A3C',
                      color: '#CBD5E1',
                      border: '1px solid #3F3F56',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: isLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ✏️ Customize
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
