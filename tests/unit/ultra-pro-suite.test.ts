import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateTotpCode, normalizeTotpSecret, decodeBase32 } from '../../src/main/security/totp.service'
import { COOKIE_ROBOT_PRESETS } from '../../src/main/automation/cookie-robot.service'
import { windowSynchronizer } from '../../src/main/browser/window-synchronizer'

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
})
