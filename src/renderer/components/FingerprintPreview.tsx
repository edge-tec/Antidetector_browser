import React, { useState, useEffect } from 'react'

interface Props {
  osType: string
  fingerprint: any
  proxy?: any
}

function getCountryFlag(countryCode: string | undefined | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export const FingerprintPreview: React.FC<Props> = ({ osType, fingerprint, proxy }) => {
  const [geoData, setGeoData] = useState<{ country?: string; region?: string; city?: string; isp?: string } | null>(null)

  useEffect(() => {
    if (proxy && proxy.host && !proxy.country) {
      let isMounted = true
      if ((window as any).api?.geoLookup) {
        (window as any).api.geoLookup(proxy.host).then((res: any) => {
          if (isMounted && res?.success && res?.data) {
            setGeoData(res.data)
            // Persist to backend if proxy ID is available
            if (proxy.id && (window as any).api?.updateProxy) {
              (window as any).api.updateProxy(proxy.id, {
                country: res.data.country,
                region: res.data.region,
                city: res.data.city,
                isp: res.data.isp
              }).catch(() => {})
            }
          }
        }).catch(() => {})
      }
      return () => { isMounted = false }
    } else {
      setGeoData(null)
    }
  }, [proxy?.id, proxy?.host, proxy?.country])

  const nav = fingerprint?.navigator || {}
  const screen = fingerprint?.screen || {}
  const webgl = fingerprint?.webgl || {}
  const locale = fingerprint?.locale || {}

  const osLabels: Record<string, string> = {
    'windows-10': 'Win 10',
    'windows-11': 'Win 11',
    'macos-intel': 'macOS (Intel)',
    'macos-arm': 'macOS (M1/M2)',
    'linux': 'Linux',
    'android': 'Android'
  }

  const country = proxy?.country || geoData?.country
  const region = proxy?.region || geoData?.region
  const city = proxy?.city || geoData?.city
  const isp = proxy?.isp || geoData?.isp

  const locationParts: string[] = []
  if (country) locationParts.push(country)
  if (region) locationParts.push(region)
  else if (city) locationParts.push(city)
  const locationStr = locationParts.join(', ')

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
      {proxy && proxy.host ? (
        <span
          title={`Location: ${city ? `${city}, ` : ''}${region ? `${region}, ` : ''}${country || 'Unknown'} | ISP: ${isp || 'N/A'} | Host: ${proxy.host}:${proxy.port}`}
          style={{ padding: '2px 8px', borderRadius: '4px', background: '#1E293B', color: '#2DD4BF', border: '1px solid #2DD4BF50', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          🔒 {getCountryFlag(country)} {locationStr ? `${locationStr} — ` : ''}{proxy.type || 'socks5'}://{proxy.host}:{proxy.port}
        </span>
      ) : (
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#2A2A3C', color: '#94A3B8' }}>
          🌐 Without proxy (Direct)
        </span>
      )}
      <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#2A2A3C', color: '#A5B4FC' }}>
        💻 {osLabels[osType] || (typeof osType === 'string' && !osType.startsWith('{') && osType.length <= 20 ? osType : 'Win 10')}
      </span>
      <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#2A2A3C', color: '#93C5FD' }}>
        🖥 {screen.width || 1920}x{screen.height || 1080} @{screen.devicePixelRatio || 1}x
      </span>
      <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#2A2A3C', color: '#FDE047' }}>
        ⚙ {nav.hardwareConcurrency || 8} CPU / {nav.deviceMemory || 8}GB RAM
      </span>
      <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#2A2A3C', color: '#C084FC' }}>
        🎮 {webgl.gpuRenderer || 'GPU'}
      </span>
      <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#2A2A3C', color: '#6EE7B7' }}>
        🌐 {locale.language || 'en-US'}
      </span>
    </div>
  )
}
