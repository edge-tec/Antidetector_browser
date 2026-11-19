import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import vm from 'vm'
import {
  KERNEL_CATALOG,
  getKernelArtifactSpec,
  multiKernelManager,
  computeFileSha256,
  verifyFileSha256
} from '../../src/main/browser/multi-kernel-manager'
import {
  validateExtensionManifest,
  assertSafeDirectoryTree,
  stripCrxHeader
} from '../../src/main/browser/extension-manager'
import { parseCookiePayload } from '../../src/main/browser/cookie-manager'
import {
  encryptProfilePayload,
  decryptProfilePayload
} from '../../src/main/storage/cloud-sync-engine'
import {
  hasPermission,
  assertPermission,
  sanitizeProxyForRole
} from '../../src/main/security/rbac'
import { buildInjectionScript } from '../../src/main/browser/injection/injector'
import { generateFingerprint } from '../../src/main/fingerprint/generator'
import { OSType } from '../../src/main/fingerprint/types'

describe('AntiProfiles Enterprise Platform — P0–P3 Verification Suite', () => {
  describe('P0: Multi-Kernel Manager & Checksum Verification', () => {
    it('exposes Chrome for Testing multi-version catalog and Firefox ESR/DevEdition', () => {
      const chromeReleases = KERNEL_CATALOG.filter((r) => r.engine === 'chromium')
      const ffReleases = KERNEL_CATALOG.filter((r) => r.engine === 'firefox')

      expect(chromeReleases.length).toBeGreaterThanOrEqual(4)
      expect(ffReleases.some((r) => r.channel === 'esr')).toBe(true)
      expect(ffReleases.some((r) => r.channel === 'devedition')).toBe(true)

      const spec = getKernelArtifactSpec(chromeReleases[0])
      expect(spec.downloadUrl).toContain('chrome-for-testing-public')
    })

    it('never silently substitutes an uninstalled requested major version', () => {
      const report = multiKernelManager.resolveKernelForProfile('chromium', '999.0.0.0')
      expect(report.compatible).toBe(false)
      expect(report.exactMatch).toBe(false)
      expect(report.error).toContain('999.0.0.0')
    })

    it('verifies SHA-256 file integrity accurately', () => {
      const tmp = path.join(os.tmpdir(), `ap-sha-test-${Date.now()}.bin`)
      fs.writeFileSync(tmp, 'antiprofiles-integrity-test')
      try {
        const hash = computeFileSha256(tmp)
        expect(verifyFileSha256(tmp, hash)).toBe(true)
        expect(verifyFileSha256(tmp, '0'.repeat(64))).toBe(false)
      } finally {
        fs.unlinkSync(tmp)
      }
    })
  })

  describe('P0: Advanced Browser Compatibility Scripts (WebGPU, SpeechSynthesis, WebGL2, Workers)', () => {
    it('compiles cleanly in V8 across all 7 OS families and includes new compatibility modules', () => {
      const osList: OSType[] = ['windows-10', 'windows-11', 'macos-intel', 'macos-arm', 'linux', 'android', 'ios']
      for (const osType of osList) {
        const fp = generateFingerprint({ osType, browserType: 'chrome' })
        ;(fp as any).osType = osType
        const script = buildInjectionScript(fp, 'chrome')
        expect(() => new vm.Script(script)).not.toThrow()
        expect(script).toContain('SpeechSynthesis Voices Consistency')
        expect(script).toContain('OffscreenCanvas & Worker WebGL Consistency')
        expect(script).toContain('WebGL & WebGL2 Capability Override')
      }
    })
  })

  describe('P1: Extension Center Security & Manifest Validation', () => {
    it('validates MV3 manifest and flags high-risk permissions', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ext-'))
      try {
        fs.writeFileSync(
          path.join(dir, 'manifest.json'),
          JSON.stringify({
            manifest_version: 3,
            name: 'Enterprise Test Ext',
            version: '1.2.3',
            permissions: ['storage', 'cookies'],
            host_permissions: ['<all_urls>']
          })
        )
        const meta = validateExtensionManifest(dir)
        expect(meta.name).toBe('Enterprise Test Ext')
        expect(meta.manifestVersion).toBe(3)
        expect(meta.riskWarnings.length).toBeGreaterThanOrEqual(2)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })

    it('rejects symlinks inside extension packages (path traversal defense)', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ext-sym-'))
      try {
        fs.symlinkSync('/etc/hosts', path.join(dir, 'evil-link'))
        expect(() => assertSafeDirectoryTree(dir)).toThrow(/symlinks are not allowed/i)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })

    it('strips CRX3 header to expose raw ZIP bytes', () => {
      const header = Buffer.alloc(12)
      header.write('Cr24', 0, 'ascii')
      header.writeUInt32LE(3, 4) // CRX3
      header.writeUInt32LE(4, 8) // 4-byte proto header
      const proto = Buffer.from([1, 2, 3, 4])
      const zipPayload = Buffer.from('PK\x03\x04test')
      const crx = Buffer.concat([header, proto, zipPayload])
      expect(stripCrxHeader(crx).toString()).toBe('PK\x03\x04test')
    })
  })

  describe('P1: Cookie Parser (JSON & Netscape formats)', () => {
    it('parses JSON and Netscape cookies.txt formats accurately', () => {
      const jsonCookies = parseCookiePayload(JSON.stringify([{ name: 'sid', value: 'abc', domain: '.example.com', secure: true }]))
      expect(jsonCookies).toHaveLength(1)
      expect(jsonCookies[0].name).toBe('sid')
      expect(jsonCookies[0].secure).toBe(true)

      const netscape = '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tTRUE\t1893456000\ttoken\txyz123'
      const nsCookies = parseCookiePayload(netscape)
      expect(nsCookies).toHaveLength(1)
      expect(nsCookies[0].name).toBe('token')
      expect(nsCookies[0].value).toBe('xyz123')
    })
  })

  describe('P1: E2E Encrypted Cloud Profile Sync (AES-256-GCM + AAD)', () => {
    it('encrypts, verifies SHA-256, and decrypts with matching passphrase & AAD; rejects wrong key or tampered data', () => {
      const plaintext = Buffer.from(JSON.stringify({ cookies: [{ name: 'auth', value: 'secret' }] }))
      const aad = 'profile-123:v1'
      const enc = encryptProfilePayload(plaintext, 'StrongPassphrase!2026', aad)

      const decrypted = decryptProfilePayload(enc.ciphertext, 'StrongPassphrase!2026', enc, aad)
      expect(decrypted.equals(plaintext)).toBe(true)

      // Wrong passphrase must fail
      expect(() => decryptProfilePayload(enc.ciphertext, 'WrongPassphrase!2026', enc, aad)).toThrow()

      // Wrong AAD (replay/cross-profile restore) must fail
      expect(() => decryptProfilePayload(enc.ciphertext, 'StrongPassphrase!2026', enc, 'other-profile:v1')).toThrow()

      // Tampered ciphertext must fail SHA-256 integrity check
      const tampered = Buffer.from(enc.ciphertext)
      tampered[0] ^= 0xff
      expect(() => decryptProfilePayload(tampered, 'StrongPassphrase!2026', enc, aad)).toThrow(/SHA-256 mismatch/i)
    })
  })

  describe('P2: Granular RBAC & Proxy Credential Redaction', () => {
    it('enforces role permissions and redacts proxy credentials for non-privileged roles', () => {
      expect(hasPermission('owner', 'billing.manage')).toBe(true)
      expect(hasPermission('admin', 'billing.manage')).toBe(false)
      expect(hasPermission('operator', 'profile.launch')).toBe(true)
      expect(hasPermission('operator', 'profile.delete')).toBe(false)
      expect(hasPermission('viewer', 'profile.launch')).toBe(false)

      expect(() => assertPermission('viewer', 'proxy.manage')).toThrow(/Access denied/i)

      const proxy = { id: 'p1', host: '1.2.3.4', port: 8080, username: 'alice', password: 'secret', encryptedPassword: Buffer.from('enc') }
      const forOperator = sanitizeProxyForRole(proxy, 'operator')
      expect(forOperator.password).toBeUndefined()
      expect(forOperator.encryptedPassword).toBeUndefined()
      expect(forOperator.username).toBe('***')

      const forAdmin = sanitizeProxyForRole(proxy, 'admin')
      expect(forAdmin.password).toBe('secret')
    })
  })
})
