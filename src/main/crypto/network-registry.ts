// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Supported Cryptocurrency & Blockchain Network Registry
// Supports all 9 enterprise networks with official mainnet contracts,
// decimal precision, confirmation thresholds, and address validators
// ──────────────────────────────────────────────────────────────────

export type CryptoNetworkKey =
  | 'tron'
  | 'bsc'
  | 'ethereum'
  | 'bitcoin'
  | 'polygon'
  | 'solana'

export interface SupportedCryptoNetwork {
  id: string
  symbol: string
  network: CryptoNetworkKey
  networkLabel: string
  tokenStandard: 'TRC20' | 'BEP20' | 'ERC20' | 'NATIVE'
  contractAddress: string
  decimals: number
  receivingAddress: string
  minDepositUsdCents: number
  maxDepositUsdCents: number
  requiredConfirmations: number
  invoiceExpiryMinutes: number
  primaryRpcUrl: string
  fallbackRpcUrl: string
  enabled: boolean
  coingeckoId: string
}

export const DEFAULT_CRYPTO_NETWORKS: SupportedCryptoNetwork[] = [
  {
    id: 'usdt-tron',
    symbol: 'USDT',
    network: 'tron',
    networkLabel: 'TRON (TRC20)',
    tokenStandard: 'TRC20',
    contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    decimals: 6,
    receivingAddress: '',
    minDepositUsdCents: 1000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 20,
    invoiceExpiryMinutes: 30,
    primaryRpcUrl: 'https://api.trongrid.io',
    fallbackRpcUrl: 'https://api.tronstack.io',
    enabled: true,
    coingeckoId: 'tether'
  },
  {
    id: 'trx-tron',
    symbol: 'TRX',
    network: 'tron',
    networkLabel: 'TRON',
    tokenStandard: 'NATIVE',
    contractAddress: '',
    decimals: 6,
    receivingAddress: '',
    minDepositUsdCents: 1000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 20,
    invoiceExpiryMinutes: 30,
    primaryRpcUrl: 'https://api.trongrid.io',
    fallbackRpcUrl: 'https://api.tronstack.io',
    enabled: true,
    coingeckoId: 'tron'
  },
  {
    id: 'usdt-bsc',
    symbol: 'USDT',
    network: 'bsc',
    networkLabel: 'BNB Smart Chain (BEP20)',
    tokenStandard: 'BEP20',
    contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    receivingAddress: '',
    minDepositUsdCents: 1000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 15,
    invoiceExpiryMinutes: 30,
    primaryRpcUrl: 'https://bsc-dataseed.binance.org',
    fallbackRpcUrl: 'https://bsc-dataseed1.defibit.io',
    enabled: true,
    coingeckoId: 'tether'
  },
  {
    id: 'bnb-bsc',
    symbol: 'BNB',
    network: 'bsc',
    networkLabel: 'BNB Smart Chain',
    tokenStandard: 'NATIVE',
    contractAddress: '',
    decimals: 18,
    receivingAddress: '',
    minDepositUsdCents: 1000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 15,
    invoiceExpiryMinutes: 30,
    primaryRpcUrl: 'https://bsc-dataseed.binance.org',
    fallbackRpcUrl: 'https://bsc-dataseed1.defibit.io',
    enabled: true,
    coingeckoId: 'binancecoin'
  },
  {
    id: 'usdt-ethereum',
    symbol: 'USDT',
    network: 'ethereum',
    networkLabel: 'Ethereum (ERC20)',
    tokenStandard: 'ERC20',
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    receivingAddress: '',
    minDepositUsdCents: 2000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 12,
    invoiceExpiryMinutes: 45,
    primaryRpcUrl: 'https://ethereum-rpc.publicnode.com',
    fallbackRpcUrl: 'https://rpc.ankr.com/eth',
    enabled: true,
    coingeckoId: 'tether'
  },
  {
    id: 'eth-ethereum',
    symbol: 'ETH',
    network: 'ethereum',
    networkLabel: 'Ethereum',
    tokenStandard: 'NATIVE',
    contractAddress: '',
    decimals: 18,
    receivingAddress: '',
    minDepositUsdCents: 2000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 12,
    invoiceExpiryMinutes: 45,
    primaryRpcUrl: 'https://ethereum-rpc.publicnode.com',
    fallbackRpcUrl: 'https://rpc.ankr.com/eth',
    enabled: true,
    coingeckoId: 'ethereum'
  },
  {
    id: 'btc-bitcoin',
    symbol: 'BTC',
    network: 'bitcoin',
    networkLabel: 'Bitcoin',
    tokenStandard: 'NATIVE',
    contractAddress: '',
    decimals: 8,
    receivingAddress: '',
    minDepositUsdCents: 2000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 3,
    invoiceExpiryMinutes: 60,
    primaryRpcUrl: 'https://mempool.space/api',
    fallbackRpcUrl: 'https://blockstream.info/api',
    enabled: true,
    coingeckoId: 'bitcoin'
  },
  {
    id: 'pol-polygon',
    symbol: 'POL',
    network: 'polygon',
    networkLabel: 'Polygon (MATIC/POL)',
    tokenStandard: 'NATIVE',
    contractAddress: '',
    decimals: 18,
    receivingAddress: '',
    minDepositUsdCents: 1000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 30,
    invoiceExpiryMinutes: 30,
    primaryRpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    fallbackRpcUrl: 'https://rpc.ankr.com/polygon',
    enabled: true,
    coingeckoId: 'matic-network'
  },
  {
    id: 'sol-solana',
    symbol: 'SOL',
    network: 'solana',
    networkLabel: 'Solana',
    tokenStandard: 'NATIVE',
    contractAddress: '',
    decimals: 9,
    receivingAddress: '',
    minDepositUsdCents: 1000,
    maxDepositUsdCents: 10000000,
    requiredConfirmations: 32,
    invoiceExpiryMinutes: 30,
    primaryRpcUrl: 'https://api.mainnet-beta.solana.com',
    fallbackRpcUrl: 'https://solana-rpc.publicnode.com',
    enabled: true,
    coingeckoId: 'solana'
  }
]

/**
 * Validate blockchain receiving wallet address format for a specific network.
 */
export function isValidNetworkAddress(network: CryptoNetworkKey, address: string): boolean {
  const addr = (address || '').trim()
  if (!addr) return false
  switch (network) {
    case 'tron':
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)
    case 'bsc':
    case 'ethereum':
    case 'polygon':
      return /^0x[a-fA-F0-9]{40}$/.test(addr)
    case 'bitcoin':
      return /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(addr)
    case 'solana':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
    default:
      return false
  }
}

/**
 * Format an atomic integer string (e.g. "10500000" with 6 decimals) into human decimal string ("10.500000").
 * Uses BigInt exclusively — zero floating-point precision loss.
 */
export function formatAtomicAmount(atomicStr: string, decimals: number): string {
  const val = BigInt(atomicStr || '0')
  const neg = val < 0n
  const abs = neg ? -val : val
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const frac = (abs % base).toString().padStart(decimals, '0')
  const trimmedFrac = frac.replace(/0+$/, '') || '0'
  return `${neg ? '-' : ''}${whole.toString()}.${trimmedFrac}`
}

/**
 * Convert USD cents + exchange rate in USD micros (1 USD = 1_000_000 micros)
 * into exact required crypto atomic units using BigInt ceiling division.
 */
export function usdCentsToCryptoAtomic(
  usdCents: number,
  rateUsdMicros: number,
  decimals: number
): string {
  if (usdCents <= 0 || rateUsdMicros <= 0) {
    throw new Error('USD cents and exchange rate must be positive integers.')
  }
  // usdCents / 100 USD divided by (rateUsdMicros / 1_000_000 USD per coin) * 10^decimals
  // = (usdCents * 10_000 * 10^decimals) / rateUsdMicros
  const numerator = BigInt(Math.round(usdCents)) * 10000n * (10n ** BigInt(decimals))
  const denom = BigInt(Math.round(rateUsdMicros))
  // Ceiling division so merchant never loses fractional dust
  const atomic = (numerator + denom - 1n) / denom
  return atomic.toString()
}

/**
 * Convert received crypto atomic units into USD cents using BigInt floor division.
 */
export function cryptoAtomicToUsdCents(
  atomicStr: string,
  rateUsdMicros: number,
  decimals: number
): number {
  const atomic = BigInt(atomicStr || '0')
  if (atomic <= 0n || rateUsdMicros <= 0) return 0
  const numerator = atomic * BigInt(Math.round(rateUsdMicros))
  const denom = 10000n * (10n ** BigInt(decimals))
  return Number(numerator / denom)
}
