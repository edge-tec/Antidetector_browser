// ──────────────────────────────────────────────
// AntiProfiles — Profile Backup Integrity Check
// ──────────────────────────────────────────────

import crypto from 'crypto'
import fs from 'fs'

export interface ProfileArchiveMetadata {
  version: string
  profileId: string
  profileName: string
  exportedAt: number
  sha256Checksum: string
  totalEntries: number
}

export class BackupIntegrityService {
  /**
   * Calculate SHA-256 hash of a file or buffer.
   */
  public static calculateChecksum(data: Buffer | string): string {
    const hash = crypto.createHash('sha256')
    if (typeof data === 'string') {
      if (fs.existsSync(data)) {
        const buffer = fs.readFileSync(data)
        hash.update(buffer)
      } else {
        hash.update(data, 'utf8')
      }
    } else {
      hash.update(data)
    }
    return hash.digest('hex')
  }

  /**
   * Validate checksum of an imported profile archive payload against its declared hash.
   */
  public static verifyArchiveChecksum(payload: Buffer | string, expectedChecksum: string): boolean {
    if (!expectedChecksum) return true
    const computed = this.calculateChecksum(payload)
    return computed.toLowerCase() === expectedChecksum.toLowerCase()
  }

  /**
   * Create an integrity-signed export envelope.
   */
  public static createSignedPackage(profileData: any, rawArchiveBytes?: Buffer): { envelope: string; checksum: string } {
    const serialized = JSON.stringify(profileData)
    const checksum = rawArchiveBytes ? this.calculateChecksum(rawArchiveBytes) : this.calculateChecksum(serialized)
    const envelope = JSON.stringify({
      schema: 'antiprofiles.v3.signed',
      exportedAt: Date.now(),
      checksum,
      data: profileData
    })
    return { envelope, checksum }
  }
}
