// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Production S3 / Cloudflare R2 Storage Provider
// Zero-dependency AWS Signature Version 4 (AWS4-HMAC-SHA256) client
// Supports S3-compatible buckets & Cloudflare R2 with retry backoff
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import http from 'http'
import https from 'https'
import type { CloudStorageProvider } from './cloud-sync-engine'

export interface S3ProviderConfig {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  maxRetries?: number
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Compute AWS Signature Version 4 Authorization & signed headers for S3 / Cloudflare R2.
 */
export function signS3Request(params: {
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD'
  url: URL
  region: string
  accessKeyId: string
  secretAccessKey: string
  payload: Buffer
  amzDate?: string
}): Record<string, string> {
  const now = new Date()
  const amzDate = params.amzDate || now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256Hex(params.payload)
  const host = params.url.host
  const canonicalUri = params.url.pathname || '/'
  // AWS SigV4 requires query parameters sorted alphabetically by key and RFC 3986 encoded
  const sortedEntries = Array.from(params.url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
  const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  const canonicalQuerystring = sortedEntries.map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`).join('&')

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  const credentialScope = `${dateStamp}/${params.region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n')

  const kDate = hmacSha256(`AWS4${params.secretAccessKey}`, dateStamp)
  const kRegion = hmacSha256(kDate, params.region)
  const kService = hmacSha256(kRegion, 's3')
  const kSigning = hmacSha256(kService, 'aws4_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  return {
    Host: host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  }
}

export class S3CompatibleStorageProvider implements CloudStorageProvider {
  name = 's3-r2'
  private config: S3ProviderConfig

  constructor(config: S3ProviderConfig) {
    this.config = {
      ...config,
      region: config.region || 'auto',
      maxRetries: config.maxRetries ?? 3
    }
  }

  private buildObjectUrl(key: string): URL {
    const base = this.config.endpoint.replace(/\/+$/, '')
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    return new URL(`${base}/${encodeURIComponent(this.config.bucket)}/${encodedKey}`)
  }

  private async requestWithRetry(method: 'GET' | 'PUT' | 'DELETE', key: string, body: Buffer = Buffer.alloc(0)): Promise<Buffer> {
    const url = this.buildObjectUrl(key)
    const maxAttempts = Math.max(1, this.config.maxRetries || 3)
    let lastErr: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const headers = signS3Request({
          method,
          url,
          region: this.config.region,
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          payload: body
        })
        if (method === 'PUT') {
          headers['Content-Length'] = String(body.length)
          headers['Content-Type'] = 'application/octet-stream'
        }

        return await new Promise<Buffer>((resolve, reject) => {
          const client = url.protocol === 'https:' ? https : http
          const req = client.request(url, { method, headers, timeout: 60000 }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
            res.on('end', () => {
              const buf = Buffer.concat(chunks)
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(buf)
              } else {
                reject(new Error(`S3/R2 ${method} failed with HTTP ${res.statusCode}: ${buf.toString('utf8').slice(0, 200)}`))
              }
            })
            res.on('error', reject)
          })
          req.on('error', reject)
          req.on('timeout', () => { req.destroy(); reject(new Error(`S3/R2 ${method} timed out`)) })
          if (body.length > 0) req.write(body)
          req.end()
        })
      } catch (err: any) {
        lastErr = err
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 300 * attempt))
        }
      }
    }
    throw lastErr || new Error(`S3/R2 ${method} failed`)
  }

  async uploadObject(key: string, data: Buffer): Promise<void> {
    await this.requestWithRetry('PUT', key, data)
  }

  async downloadObject(key: string): Promise<Buffer> {
    return this.requestWithRetry('GET', key)
  }

  async deleteObject(key: string): Promise<void> {
    await this.requestWithRetry('DELETE', key)
  }
}

export function createS3ProviderFromEnv(): S3CompatibleStorageProvider | null {
  const endpoint = process.env.ANTIPROFILES_S3_ENDPOINT
  const bucket = process.env.ANTIPROFILES_S3_BUCKET
  const accessKeyId = process.env.ANTIPROFILES_S3_ACCESS_KEY
  const secretAccessKey = process.env.ANTIPROFILES_S3_SECRET_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null

  return new S3CompatibleStorageProvider({
    endpoint,
    bucket,
    region: process.env.ANTIPROFILES_S3_REGION || 'auto',
    accessKeyId,
    secretAccessKey
  })
}
