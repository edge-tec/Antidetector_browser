// ──────────────────────────────────────────────────────────────────
// AntiProfiles — CryptoExchangeRateService
// Fetches live USD exchange rates in integer micros (1 USD = 1_000_000)
// with short-lived cache and stablecoin peg protection
// ──────────────────────────────────────────────────────────────────

import https from 'https'
import { DEFAULT_CRYPTO_NETWORKS } from './network-registry'

interface CachedRate {
  rateUsdMicros: number
  source: string
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000

const FALLBACK_RATES_MICROS: Record<string, number> = {
  USDT: 1_000_000,
  TRX: 160_000,
  BNB: 600_000_000,
  ETH: 3_200_000_000,
  BTC: 90_000_000_000,
  POL: 500_000,
  SOL: 200_000_000
}

function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'AntiProfiles-CryptoGateway/2.0' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Rate fetch timeout')) })
  })
}

export class CryptoExchangeRateService {
  private static cache = new Map<string, CachedRate>()

  static async getUsdRateMicros(symbol: string): Promise<{ rateUsdMicros: number; rateUsd: number; source: string }> {
    const sym = symbol.toUpperCase()
    if (sym === 'USDT') {
      return { rateUsdMicros: 1_000_000, rateUsd: 1.0, source: 'stablecoin-peg' }
    }

    const cached = this.cache.get(sym)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { rateUsdMicros: cached.rateUsdMicros, rateUsd: cached.rateUsdMicros / 1_000_000, source: cached.source }
    }

    // Try Binance public ticker first (fast, no API key required)
    const binancePair = sym === 'POL' ? 'POLUSDT' : `${sym}USDT`
    try {
      const data = await fetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${binancePair}`)
      const price = Number(data?.price)
      if (Number.isFinite(price) && price > 0) {
        const rateUsdMicros = Math.round(price * 1_000_000)
        this.cache.set(sym, { rateUsdMicros, source: 'binance-spot', fetchedAt: Date.now() })
        return { rateUsdMicros, rateUsd: rateUsdMicros / 1_000_000, source: 'binance-spot' }
      }
    } catch {}

    // Secondary fallback: CoinGecko simple price
    const net = DEFAULT_CRYPTO_NETWORKS.find((n) => n.symbol === sym)
    if (net?.coingeckoId) {
      try {
        const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${net.coingeckoId}&vs_currencies=usd`)
        const price = Number(data?.[net.coingeckoId]?.usd)
        if (Number.isFinite(price) && price > 0) {
          const rateUsdMicros = Math.round(price * 1_000_000)
          this.cache.set(sym, { rateUsdMicros, source: 'coingecko', fetchedAt: Date.now() })
          return { rateUsdMicros, rateUsd: rateUsdMicros / 1_000_000, source: 'coingecko' }
        }
      } catch {}
    }

    // Offline/fallback reference rate
    const fallback = FALLBACK_RATES_MICROS[sym] || 1_000_000
    return { rateUsdMicros: fallback, rateUsd: fallback / 1_000_000, source: 'offline-fallback' }
  }
}
