// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Proxy Pool Manager
// Manages proxy rotation pools and round-robin / random selection
// ──────────────────────────────────────────────────────────────────

import { proxyRepo } from '../database/repositories/proxy.repo'
import { ProxyDisplay } from '../database/models'

export type RotationStrategy = 'round-robin' | 'random' | 'lowest-latency'

export class ProxyPoolManager {
  private roundRobinIndices: Map<string, number> = new Map()

  /**
   * Get the next proxy from a pool according to its rotation strategy.
   */
  getNextProxyFromPool(poolId: string, strategy: RotationStrategy = 'round-robin'): ProxyDisplay | null {
    const allProxies = proxyRepo.getAll()
    const poolProxies = allProxies.filter(p => (p as any).poolId === poolId)

    if (poolProxies.length === 0) return null

    if (strategy === 'random') {
      const idx = Math.floor(Math.random() * poolProxies.length)
      return poolProxies[idx]
    }

    if (strategy === 'lowest-latency') {
      const sorted = [...poolProxies].sort((a, b) => {
        const latA = (a as any).latencyMs ?? 9999
        const latB = (b as any).latencyMs ?? 9999
        return latA - latB
      })
      return sorted[0]
    }

    // Default: Round-robin
    const currentIndex = this.roundRobinIndices.get(poolId) || 0
    const selected = poolProxies[currentIndex % poolProxies.length]
    this.roundRobinIndices.set(poolId, (currentIndex + 1) % poolProxies.length)
    return selected
  }

  /**
   * Trigger URL rotation for a proxy (e.g. mobile/residential proxy reset link).
   */
  async triggerRotationUrl(rotationUrl: string): Promise<boolean> {
    if (!rotationUrl || !rotationUrl.startsWith('http')) return false

    try {
      const response = await fetch(rotationUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      return response.ok
    } catch {
      return false
    }
  }
}

export const proxyPoolManager = new ProxyPoolManager()
