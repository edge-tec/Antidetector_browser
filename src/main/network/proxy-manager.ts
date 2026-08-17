// ──────────────────────────────────────────────
// AntiProfiles — Proxy Manager
// ──────────────────────────────────────────────

import { Proxy } from '../database/models'
import { decryptPassword } from '../security/encryption'

/**
 * Build Chromium proxy CLI flags for a proxy configuration.
 */
export function buildProxyArgs(proxy: Proxy): string[] {
  if (proxy.type === 'direct' || !proxy.host) {
    return ['--no-proxy-server']
  }

  const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`
  return [`--proxy-server=${proxyUrl}`]
}

/**
 * Build a proxy URL string (without credentials for display).
 */
export function getProxyDisplayUrl(proxy: Proxy): string {
  if (proxy.type === 'direct') return 'Direct connection'
  if (!proxy.host) return 'Not configured'
  return `${proxy.type}://${proxy.host}:${proxy.port}`
}

/**
 * Build a proxy URL with credentials (for testing).
 * This is NEVER logged or stored.
 */
export function buildProxyUrlWithAuth(proxy: Proxy): string | null {
  if (proxy.type === 'direct' || !proxy.host) return null

  let auth = ''
  if (proxy.username && proxy.encryptedPassword) {
    const password = decryptPassword(proxy.encryptedPassword)
    auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password)}@`
  }

  return `${proxy.type}://${auth}${proxy.host}:${proxy.port}`
}
