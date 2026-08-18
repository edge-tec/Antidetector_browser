// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Proxy Information & Geo Details Component
// Clean, compact, and complete proxy geo-information display card
// ──────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { ProxyTestResult } from '../types'

interface ProxyInfoCardProps {
  info: ProxyTestResult | null
  loading?: boolean
  onTest?: () => void
  testButtonLabel?: string
  showTestButton?: boolean
}

export const ProxyInfoCard: React.FC<ProxyInfoCardProps> = ({
  info,
  loading = false,
  onTest,
  testButtonLabel = 'Check Proxy',
  showTestButton = true
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!info) return
    const textToCopy = [
      `Proxy Name: ${info.proxyName || 'N/A'}`,
      `Status: ${info.success ? 'Connection test passed!' : 'Connection test failed'}`,
      `IP: ${info.ip || 'N/A'}`,
      `Location: ${(info.country || 'N/A').toLowerCase()} / ${(info.regionName || info.region || 'N/A').toLowerCase()} / ${(info.city || 'N/A').toLowerCase()}`,
      `Country: ${info.countryName || info.country || 'N/A'}`,
      `State/Region: ${info.regionName || info.region || 'N/A'}`,
      `City: ${info.city || 'N/A'}`,
      `Zip code: ${info.zip || 'N/A'}`,
      `Latitude and Longitude: ${info.latitude !== undefined && info.longitude !== undefined ? `${info.latitude.toFixed(6)}, ${info.longitude.toFixed(6)}` : 'N/A'}`,
      `ISP: ${info.isp || info.org || 'N/A'}`,
      `Timezone: ${info.timezone || 'N/A'}`,
      `Proxy Type: ${info.proxyType || 'N/A'}`
    ].join('\n')

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div style={{
      marginTop: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      width: '100%'
    }}>
      {/* Top action header: Check button and Copy button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {showTestButton && onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={loading}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              backgroundColor: loading ? '#1E293B' : '#F8FAFC',
              color: loading ? '#94A3B8' : '#0F172A',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            {loading ? '🔄 Testing...' : testButtonLabel}
          </button>
        )}

        {info && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy proxy details to clipboard"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: '#1E293B',
              color: copied ? '#4ADE80' : '#94A3B8',
              border: '1px solid #334155',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '13px' }}>📋</span>
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Main information card */}
      {info && (
        <div style={{
          padding: '14px 16px',
          borderRadius: '10px',
          backgroundColor: '#090D16',
          border: info.success ? '1px solid #22C55E30' : '1px solid #EF444430',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '13px',
          lineHeight: '1.65',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {info.success ? (
            <>
              {/* Status Header */}
              <div style={{ color: '#84CC16', fontWeight: 600, fontSize: '13.5px', marginBottom: '2px' }}>
                Connection test passed! {info.latency ? <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 400 }}>({info.latency}ms)</span> : null}
              </div>

              {/* IP */}
              <div style={{ color: '#A3E635' }}>
                <span style={{ color: '#84CC16' }}>IP: </span>
                <span style={{ fontWeight: 600 }}>{info.ip || 'N/A'}</span>
              </div>

              {/* Location Short Line */}
              <div style={{ color: '#A3E635' }}>
                <span style={{ color: '#84CC16' }}>Location: </span>
                <span>
                  {(info.country || 'N/A').toLowerCase()} / {(info.regionName || info.region || 'N/A').toLowerCase()} / {(info.city || 'N/A').toLowerCase()}
                </span>
              </div>

              {/* Coordinates */}
              <div style={{ color: '#A3E635', marginTop: '6px' }}>
                <div style={{ color: '#84CC16' }}>Latitude and</div>
                <div>
                  <span style={{ color: '#84CC16' }}>Longitude: </span>
                  <span>
                    {info.latitude !== undefined && info.longitude !== undefined
                      ? `${info.latitude.toFixed(6)}, ${info.longitude.toFixed(6)}`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Zip code */}
              <div style={{ color: '#A3E635' }}>
                <span style={{ color: '#84CC16' }}>Zip code: </span>
                <span>{info.zip || 'N/A'}</span>
              </div>

              {/* Detailed Breakdown */}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1E293B', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px', fontSize: '12px' }}>
                {info.proxyName && (
                  <div>
                    <span style={{ color: '#64748B' }}>Proxy Name: </span>
                    <span style={{ color: '#E2E8F0' }}>{info.proxyName}</span>
                  </div>
                )}
                <div>
                  <span style={{ color: '#64748B' }}>Proxy Type: </span>
                  <span style={{ color: '#E2E8F0' }}>{info.proxyType || 'HTTP'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Country: </span>
                  <span style={{ color: '#E2E8F0' }}>{info.countryName || info.country || 'N/A'} {info.flag || ''}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>State/Region: </span>
                  <span style={{ color: '#E2E8F0' }}>{info.regionName || info.region || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>City: </span>
                  <span style={{ color: '#E2E8F0' }}>{info.city || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>ISP: </span>
                  <span style={{ color: '#E2E8F0' }}>{info.isp || info.org || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Timezone: </span>
                  <span style={{ color: '#E2E8F0' }}>{info.timezone || 'N/A'}</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#EF4444', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>✕ Connection test failed</div>
              <div style={{ fontSize: '12px', color: '#FCA5A5' }}>
                Error: {info.error || 'Connection timed out or proxy unreachable'}
              </div>
              {info.proxyType && <div style={{ fontSize: '11px', color: '#94A3B8' }}>Type: {info.proxyType}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
