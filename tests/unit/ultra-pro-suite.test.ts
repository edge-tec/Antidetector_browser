import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateTotpCode, normalizeTotpSecret, decodeBase32 } from '../../src/main/security/totp.service'
import { COOKIE_ROBOT_PRESETS } from '../../src/main/automation/cookie-robot.service'
import { windowSynchronizer } from '../../src/main/browser/window-synchronizer'
import { KERNEL_CATALOG, buildCamoufoxEnvConfig } from '../../src/main/browser/multi-kernel-manager'
import { parseBulkProxies } from '../../src/main/network/proxy-bulk-fraud.service'

describe('Ultra-Pro Anti-Detect Suite', () => {
  it('generates RFC 6238 compliant 6-digit TOTP codes and parses otpauth URIs', () => {
    // Standard RFC 6238 / Google Authenticator Base32 secret
    const secret = 'JBSWY3DPEHPK3PXP'
    expect(decodeBase32(secret).toString('hex')).toBe('48656c6c6f21deadbeef')

    const res = generateTotpCode(secret, 1700000000000)
    expect(res.code).toMatch(/^\d{6}$/)
    expect(res.period).toBe(30)
    expect(res.remainingSeconds).toBeGreaterThanOrEqual(1)
    expect(res.remainingSeconds).toBeLessThanOrEqual(30)

    const uri = 'otpauth://totp/AntiProfiles:user@example.com?secret=jbsw-y3dp-ehpk-3pxp&issuer=AntiProfiles'
    expect(normalizeTotpSecret(uri)).toBe(secret)
    expect(generateTotpCode(uri, 1700000000000).code).toBe(res.code)
  })

  it('clamps WindowSynchronizer humanize delay and coordinate jitter safely', () => {
    const cfg = windowSynchronizer.setHumanizeConfig({
      delayMinMs: 50,
      delayMaxMs: 180,
      jitterPx: 4,
      captureMasterDomEvents: true
    })
    expect(cfg.delayMinMs).toBe(50)
    expect(cfg.delayMaxMs).toBe(180)
    expect(cfg.jitterPx).toBe(4)
    expect(cfg.captureMasterDomEvents).toBe(true)

    const clamped = windowSynchronizer.setHumanizeConfig({ delayMinMs: -10, jitterPx: 999 })
    expect(clamped.delayMinMs).toBe(0)
    expect(clamped.jitterPx).toBe(15)
  })

  it('ships valid built-in Cookie Robot warm-up presets', () => {
    expect(COOKIE_ROBOT_PRESETS.length).toBeGreaterThanOrEqual(3)
    for (const preset of COOKIE_ROBOT_PRESETS) {
      expect(preset.urls.length).toBeGreaterThanOrEqual(3)
      for (const u of preset.urls) {
        expect(u.startsWith('https://')).toBe(true)
      }
    }
  })

  it('enforces DNS-over-Proxy & QUIC leak shield + Proxy Kill-Switch in launcher.ts', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../src/main/browser/launcher.ts'), 'utf8')
    expect(src).toContain('--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1')
    expect(src).toContain('--disable-quic')
    expect(src).toContain('ProxyKillSwitch')
  })

  it('registers Camoufox C++ native anti-detect kernel and generates CAMOU_CONFIG_1', () => {
    const camou = KERNEL_CATALOG.find((k) => k.engine === 'camoufox')
    expect(camou).toBeDefined()
    expect(camou?.channel).toBe('stealth')

    const env = buildCamoufoxEnvConfig({
      osType: 'windows-11',
      timezone: 'America/New_York',
      screenWidth: 1920,
      screenHeight: 1080,
      fingerprint: { navigator: { hardwareConcurrency: 8 }, webgl: { unmaskedRenderer: 'ANGLE (NVIDIA RTX 3060)' } }
    })
    const parsed = JSON.parse(env.CAMOU_CONFIG_1)
    expect(parsed['navigator.platform']).toBe('Win32')
    expect(parsed['screen.width']).toBe(1920)
    expect(parsed['timezone']).toBe('America/New_York')
    expect(parsed['humanize']).toBe(true)
  })

  it('parses and deduplicates multi-format commercial bulk proxy lists', () => {
    const raw = [
      'socks5://user1:pass1@1.2.3.4:1080',
      'http://user2:pass2@5.6.7.8:8080',
      '9.10.11.12:3128:user3:pass:with:colon',
      'user4:pass4@13.14.15.16:9000',
      '17.18.19.20:8000',
      'socks5://user1:pass1@1.2.3.4:1080', // duplicate
      'invalid-line-here'
    ].join('\n')

    const res = parseBulkProxies(raw, 'socks5')
    expect(res.parsed.length).toBe(5)
    expect(res.duplicatesRemoved).toBe(1)
    expect(res.invalidLines.length).toBe(1)
    expect(res.parsed[2].password).toBe('pass:with:colon')
  })
})
