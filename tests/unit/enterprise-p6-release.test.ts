import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { signS3Request } from '../../src/main/storage/s3-r2-provider'
import { sanitizeLogString } from '../../src/main/logging/log-sanitizer'

describe('Phase P6 — Production Release Engineering, S3/R2 SigV4 & Observability', () => {
  it('generates valid AWS Signature Version 4 headers for Cloudflare R2 / S3 endpoints', () => {
    const headers = signS3Request({
      method: 'PUT',
      url: new URL('https://acct123.r2.cloudflarestorage.com/antiprofiles-backups/p1_v1.apenc'),
      region: 'auto',
      accessKeyId: 'AKIA_TEST_KEY',
      secretAccessKey: 'SECRET_TEST_KEY_123456',
      payload: Buffer.from('encrypted-blob'),
      amzDate: '20261119T120000Z'
    })

    expect(headers.Host).toBe('acct123.r2.cloudflarestorage.com')
    expect(headers['x-amz-date']).toBe('20261119T120000Z')
    expect(headers['x-amz-content-sha256']).toHaveLength(64)
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA_TEST_KEY\/20261119\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/)
  })

  it('sanitizes proxy credentials, Bearer tokens, passphrases, and cookies from logs', () => {
    const raw = 'Connecting socks5://alice:MySecretPass@1.2.3.4:1080 with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload and {"passphrase":"TopSecret123"}'
    const cleaned = sanitizeLogString(raw)
    expect(cleaned).not.toContain('MySecretPass')
    expect(cleaned).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(cleaned).not.toContain('TopSecret123')
    expect(cleaned).toContain('socks5://***:***@1.2.3.4:1080')
    expect(cleaned).toContain('Bearer [REDACTED]')
  })

  it('verifies production packaging configuration, entitlements, CI workflow, and checksum generator', () => {
    const root = path.resolve(__dirname, '../..')
    const builderYml = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
    expect(builderYml).toContain('hardenedRuntime: true')
    expect(builderYml).toContain('https://releases.antiprofiles.com/updates')
    expect(builderYml).not.toContain('profilevault.local')
    expect(builderYml).toContain('target: portable')
    expect(builderYml).toContain('target: AppImage')

    expect(fs.existsSync(path.join(root, 'build/entitlements.mac.plist'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'build/entitlements.mac.inherit.plist'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'scripts/notarize-and-sign-mac.sh'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'scripts/generate-release-checksums.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.github/workflows/release.yml'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.env.production.example'))).toBe(true)
  })
})
