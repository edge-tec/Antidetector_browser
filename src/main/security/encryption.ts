// ──────────────────────────────────────────────
// ProfileVault — Credential Encryption (safeStorage)
// ──────────────────────────────────────────────

import { safeStorage } from 'electron'

/**
 * Encrypt a password string using the OS keychain via Electron safeStorage.
 * On macOS this uses the system Keychain.
 */
export function encryptPassword(password: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system. Cannot store passwords securely.')
  }
  return safeStorage.encryptString(password)
}

/**
 * Decrypt a password buffer back to a string.
 */
export function decryptPassword(encrypted: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system. Cannot decrypt passwords.')
  }
  return safeStorage.decryptString(encrypted)
}

/**
 * Check if encryption is available on this system.
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
