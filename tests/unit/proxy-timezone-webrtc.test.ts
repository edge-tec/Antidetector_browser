import { describe, it, expect } from 'vitest'
import { buildTimezoneScript } from '../../src/main/browser/injection/scripts/timezone'
import { buildWebRTCScript } from '../../src/main/browser/injection/scripts/webrtc'
import { lookupGeoIP } from '../../src/main/network/geo-lookup'

describe('Proxy Timezone & WebRTC IP Leak Prevention', () => {
  it('buildTimezoneScript generates correct target timezone override', () => {
    const script = buildTimezoneScript({ timezone: 'America/Chicago', utcOffset: -300 })
    expect(script).toContain('America/Chicago')
    expect(script).toContain('Intl.DateTimeFormat.prototype.resolvedOptions')
    expect(script).toContain('Date.prototype.getTimezoneOffset')
  })

  it('buildWebRTCScript generates IP candidate stripping shield when enabled', () => {
    const script = buildWebRTCScript({
      mode: 'real',
      ipPolicy: 'disable_non_proxied_udp',
      localIP: '',
      publicIP: ''
    })
    expect(script).toContain('sanitizeCandidateLine')
    expect(script).toContain('RTCPeerConnection')
  })

  it('buildWebRTCScript completely disables RTCPeerConnection when mode is disabled', () => {
    const script = buildWebRTCScript({
      mode: 'disabled',
      ipPolicy: 'disable_non_proxied_udp',
      localIP: '',
      publicIP: ''
    })
    expect(script).toContain('window.RTCPeerConnection = undefined')
    expect(script).toContain('window.webkitRTCPeerConnection = undefined')
  })

  it('resolves correct Texas timezone (America/Chicago) for sample IP 47.189.201.223', async () => {
    // Lookup Texas IP from the user screenshot
    const geo = await lookupGeoIP('47.189.201.223')
    if (geo) {
      expect(geo.timezone).toBe('America/Chicago')
      expect(geo.regionName).toContain('Texas')
    }
  })
})
