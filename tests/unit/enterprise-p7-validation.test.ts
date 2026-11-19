import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { signS3Request } from '../../src/main/storage/s3-r2-provider'
import { sanitizeLogString } from '../../src/main/logging/log-sanitizer'

describe('Phase P7 — Independent Security, SigV4 & CI Supply-Chain Validation', () => {
  it('enforces Electron hardened webPreferences, navigation guard, and permission handler in src/main/index.ts', () => {
    const mainSrc = fs.readFileSync(path.resolve(__dirname, '../../src/main/index.ts'), 'utf8')
    expect(mainSrc).toContain('contextIsolation: true')
    expect(mainSrc).toContain('nodeIntegration: false')
    expect(mainSrc).toContain('webviewTag: false')
    expect(mainSrc).toContain('allowRunningInsecureContent: false')
    expect(mainSrc).toContain('will-navigate')
    expect(mainSrc).toContain('setPermissionRequestHandler')
  })

  it('produces identical AWS SigV4 signatures regardless of query parameter order (canonical query sorting)', () => {
    const h1 = signS3Request({
      method: 'GET',
      url: new URL('https://acct.r2.cloudflarestorage.com/bucket/key?prefix=abc&list-type=2'),
      region: 'auto',
      accessKeyId: 'KEY1',
      secretAccessKey: 'SECRET1',
      payload: Buffer.alloc(0),
      amzDate: '20261119T120000Z'
    })
    const h2 = signS3Request({
      method: 'GET',
      url: new URL('https://acct.r2.cloudflarestorage.com/bucket/key?list-type=2&prefix=abc'),
      region: 'auto',
      accessKeyId: 'KEY1',
      secretAccessKey: 'SECRET1',
      payload: Buffer.alloc(0),
      amzDate: '20261119T120000Z'
    })
    expect(h1.Authorization).toBe(h2.Authorization)
  })

  it('enforces least-privilege contents: read in .github/workflows/release.yml', () => {
    const wf = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/release.yml'), 'utf8')
    expect(wf).toContain('contents: read')
    expect(wf).not.toContain('contents: write')
  })

  it('redacts Cookie, Set-Cookie, x-api-key, and AWS4-HMAC-SHA256 headers across multiline logs', () => {
    const multiline = [
      'Request failed:',
      'Cookie: session=supersecret123; sid=999',
      'Set-Cookie: auth_token=xyz987; HttpOnly',
      'x-api-key: live_key_abcdef',
      'Authorization: AWS4-HMAC-SHA256 Credential=AKIA123/20261119/auto/s3/aws4_request, SignedHeaders=host, Signature=deadbeef0123456789'
    ].join('\n')

    const cleaned = sanitizeLogString(multiline)
    expect(cleaned).not.toContain('supersecret123')
    expect(cleaned).not.toContain('xyz987')
    expect(cleaned).not.toContain('live_key_abcdef')
    expect(cleaned).not.toContain('AKIA123')
    expect(cleaned).not.toContain('deadbeef0123456789')
  })
})
