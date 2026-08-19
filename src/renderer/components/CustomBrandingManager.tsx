import React, { useState, useEffect } from 'react'
import defaultChromeImg from '../assets/antiprofiles-chrome.png'
import defaultFirefoxImg from '../assets/antiprofiles-firefox.png'

interface BrandingTargetConfig {
  isCustom: boolean
  previewUrl: string
  updatedAt?: string
}

interface BrandingConfig {
  chromium: BrandingTargetConfig
  firefox: BrandingTargetConfig
  app: BrandingTargetConfig
}

export const CustomBrandingManager: React.FC = () => {
  const [config, setConfig] = useState<BrandingConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const loadConfig = async () => {
    try {
      if ((window as any).api?.getBrandingConfig) {
        const res = await (window as any).api.getBrandingConfig()
        if (res?.success && res?.data) {
          setConfig(res.data)
        }
      }
    } catch (err: any) {
      console.error('Failed to load branding config:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleUpload = async (target: 'chromium' | 'firefox' | 'app') => {
    try {
      setUploadingTarget(target)
      setFeedback({ type: 'info', message: `Selecting custom icon for ${target.toUpperCase()}...` })

      if ((window as any).api?.selectAndUploadBrandingIcon) {
        const res = await (window as any).api.selectAndUploadBrandingIcon(target)
        if (res?.success) {
          setFeedback({ type: 'success', message: `Successfully updated custom branding for ${target.toUpperCase()}!` })
          await loadConfig()
        } else if (!res?.canceled) {
          setFeedback({ type: 'error', message: `Failed to upload icon: ${res?.error || 'Unknown error'}` })
        } else {
          setFeedback(null)
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Error uploading icon: ${err.message}` })
    } finally {
      setUploadingTarget(null)
    }
  }

  const handleReset = async (target: 'chromium' | 'firefox' | 'app') => {
    try {
      setUploadingTarget(target)
      setFeedback({ type: 'info', message: `Restoring default icon for ${target.toUpperCase()}...` })

      if ((window as any).api?.resetBrandingIcon) {
        const res = await (window as any).api.resetBrandingIcon(target)
        if (res?.success) {
          setFeedback({ type: 'success', message: `Restored default branding for ${target.toUpperCase()}!` })
          await loadConfig()
        } else {
          setFeedback({ type: 'error', message: 'Failed to reset icon' })
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Error resetting icon: ${err.message}` })
    } finally {
      setUploadingTarget(null)
    }
  }

  const renderCard = (
    title: string,
    target: 'chromium' | 'firefox' | 'app',
    subtitle: string,
    defaultImg: string,
    badgeColor: string
  ) => {
    const targetData = config ? config[target] : null
    const isCustom = targetData?.isCustom || false
    const preview = targetData?.previewUrl || defaultImg
    const isBusy = uploadingTarget === target

    return (
      <div
        style={{
          flex: '1 1 300px',
          background: '#161622',
          border: '1px solid #28283C',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#0F0F16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid #2B2B3D'
                }}
              >
                <img
                  src={preview}
                  alt={title}
                  style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                  onError={(e: any) => { e.target.src = defaultImg }}
                />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#FFF', fontWeight: 600 }}>{title}</h4>
                <span style={{ fontSize: '12px', color: '#8E8EA8' }}>{subtitle}</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                background: isCustom ? `${badgeColor}20` : '#38BDF820',
                color: isCustom ? badgeColor : '#38BDF8',
                border: `1px solid ${isCustom ? badgeColor : '#38BDF8'}40`
              }}
            >
              {isCustom ? 'Custom Logo Active' : 'Bundled Antiprofile'}
            </span>
          </div>

          <div
            style={{
              background: '#0D0D14',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#A0A0B8',
              lineHeight: 1.5
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Multi-Res Formats:</span>
              <strong style={{ color: '#E2E8F0' }}>.ICO, .ICNS, .PNG (16-1024px)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>OS Target:</span>
              <strong style={{ color: '#E2E8F0' }}>Windows, macOS, Linux</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Runtime Scope:</span>
              <strong style={{ color: '#10B981' }}>Window, Dock & Taskbar</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleUpload(target)}
            disabled={isBusy}
            style={{
              flex: 1,
              padding: '9px 12px',
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {isBusy ? 'Processing...' : 'Upload Logo'}
          </button>

          {isCustom && (
            <button
              type="button"
              onClick={() => handleReset(target)}
              disabled={isBusy}
              style={{
                padding: '9px 12px',
                background: '#1F1F2E',
                border: '1px solid #33334A',
                borderRadius: '8px',
                color: '#EF4444',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.7 : 1
              }}
              title="Reset to default Antiprofile logo"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '24px', background: '#12121B', borderRadius: '14px', padding: '24px', border: '1px solid #232334' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#FFF', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🎨</span> Custom Browser Branding & Icon Management
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
            Customize the window, taskbar, and dock branding icons applied to Chromium and Firefox profile runtimes.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            background: feedback.type === 'success' ? '#10B98120' : feedback.type === 'error' ? '#EF444420' : '#3B82F620',
            border: `1px solid ${feedback.type === 'success' ? '#10B981' : feedback.type === 'error' ? '#EF4444' : '#3B82F6'}50`,
            color: feedback.type === 'success' ? '#34D399' : feedback.type === 'error' ? '#F87171' : '#60A5FA',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>{feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '⚠' : 'ℹ'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {renderCard(
          'Firefox Branding Icon',
          'firefox',
          'Mozilla Firefox / Quantum Runtime',
          defaultFirefoxImg,
          '#F97316'
        )}

        {renderCard(
          'Chromium Branding Icon',
          'chromium',
          'Google Chrome / Chromium Runtime',
          defaultChromeImg,
          '#3B82F6'
        )}

        {renderCard(
          'Application Master Logo',
          'app',
          'Desktop Launcher & Main Window',
          defaultChromeImg,
          '#8B5CF6'
        )}
      </div>
    </div>
  )
}
