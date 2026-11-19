// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Direct Blockchain RPC Verification Client
// Supports Primary + Secondary RPC failover for:
//   - EVM (Ethereum, BSC, Polygon): JSON-RPC + ERC20/BEP20 Transfer logs
//   - TRON (TRX, USDT-TRC20): FullNode HTTP API
//   - Bitcoin: Mempool / Blockstream REST API
//   - Solana: Solana JSON-RPC getTransaction
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import http from 'http'
import https from 'https'
import type { CryptoNetworkKey } from './network-registry'

export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * Convert a 20-byte hex address (40 hex chars, no 0x) into a TRON Base58Check address (T...).
 */
export function hex20ToTronBase58(hex20: string): string {
  const clean = hex20.replace(/^0x/i, '').toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(clean)) return ''
  const payload = Buffer.from('41' + clean, 'hex')
  const h1 = crypto.createHash('sha256').update(payload).digest()
  const h2 = crypto.createHash('sha256').update(h1).digest()
  const full = Buffer.concat([payload, h2.subarray(0, 4)])

  let num = BigInt('0x' + full.toString('hex'))
  let encoded = ''
  while (num > 0n) {
    const rem = Number(num % 58n)
    encoded = BASE58_ALPHABET[rem] + encoded
    num /= 58n
  }
  for (const b of full) {
    if (b === 0) encoded = '1' + encoded
    else break
  }
  return encoded
}

/**
 * Decode TRC20 transfer(address,uint256) calldata (selector a9059cbb) into real Base58Check recipient + amount.
 */
export function parseTronTrc20TransferData(dataHex: string): { matched: boolean; toAddress: string; amountAtomic: string } {
  const clean = (dataHex || '').replace(/^0x/i, '').toLowerCase()
  if (!clean.startsWith('a9059cbb') || clean.length < 136) {
    return { matched: false, toAddress: '', amountAtomic: '0' }
  }
  const recipientHex20 = clean.slice(32, 72)
  const amountHex = clean.slice(72, 136)
  const toAddress = hex20ToTronBase58(recipientHex20)
  const amountAtomic = BigInt('0x' + amountHex).toString()
  return { matched: !!toAddress, toAddress, amountAtomic }
}

export interface OnChainTxObservation {
  found: boolean
  network: CryptoNetworkKey
  txHash: string
  executionSuccess: boolean
  fromAddress: string
  toAddress: string
  contractAddress: string
  amountAtomic: string
  confirmations: number
  blockNumber: number
  blockTimestampMs?: number
  rpcEndpointUsed: string
  error?: string
}

function httpJsonRequest(
  urlStr: string,
  method: 'GET' | 'POST',
  body?: any,
  timeoutMs = 15000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const client = url.protocol === 'https:' ? https : http
    const payload = body ? JSON.stringify(body) : ''
    const headers: Record<string, string> = {
      'User-Agent': 'AntiProfiles-BlockchainRPC/2.0',
      Accept: 'application/json'
    }
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload).toString()
    }

    const req = client.request(url, { method, headers, timeout: timeoutMs }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`RPC HTTP ${res.statusCode}: ${data.slice(0, 160)}`))
        }
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('RPC request timed out')) })
    if (payload) req.write(payload)
    req.end()
  })
}

/**
 * Decode ERC20 / BEP20 Transfer(address indexed from, address indexed to, uint256 value) log
 * matching the expected contract and recipient address.
 */
export function parseEvmTokenTransferLog(
  logs: Array<{ address?: string; topics?: string[]; data?: string }>,
  expectedContract: string,
  expectedRecipient: string
): { matched: boolean; fromAddress: string; toAddress: string; contractAddress: string; amountAtomic: string } {
  const normContract = expectedContract.trim().toLowerCase()
  const normRecipient = expectedRecipient.trim().toLowerCase()

  for (const log of logs || []) {
    const logAddr = (log.address || '').toLowerCase()
    const topics = log.topics || []
    if (logAddr !== normContract) continue
    if (topics.length < 3 || (topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC) continue

    const fromAddr = '0x' + topics[1].slice(-40).toLowerCase()
    const toAddr = '0x' + topics[2].slice(-40).toLowerCase()
    if (toAddr !== normRecipient) continue

    const amountAtomic = BigInt(log.data || '0x0').toString()
    return {
      matched: true,
      fromAddress: fromAddr,
      toAddress: toAddr,
      contractAddress: logAddr,
      amountAtomic
    }
  }

  return { matched: false, fromAddress: '', toAddress: '', contractAddress: '', amountAtomic: '0' }
}

async function callWithFallback<T>(
  primaryUrl: string,
  fallbackUrl: string,
  fn: (rpcUrl: string) => Promise<T>
): Promise<{ result: T; rpcUrl: string }> {
  const urls = [primaryUrl, fallbackUrl].filter((u) => u && u.trim().length > 0)
  let lastError: Error | null = null
  for (const rpcUrl of urls) {
    try {
      const result = await fn(rpcUrl.replace(/\/+$/, ''))
      return { result, rpcUrl }
    } catch (err: any) {
      lastError = err
    }
  }
  throw lastError || new Error('All configured RPC endpoints failed')
}

export class BlockchainRpcClient {
  /**
   * Fetch and verify an on-chain transaction directly from the network's RPC node.
   */
  static async fetchTransaction(params: {
    network: CryptoNetworkKey
    txHash: string
    expectedRecipient: string
    expectedContract: string
    primaryRpcUrl: string
    fallbackRpcUrl: string
  }): Promise<OnChainTxObservation> {
    const { network, txHash, expectedRecipient, expectedContract, primaryRpcUrl, fallbackRpcUrl } = params

    if (network === 'ethereum' || network === 'bsc' || network === 'polygon') {
      const { result, rpcUrl } = await callWithFallback(primaryRpcUrl, fallbackRpcUrl, async (url) => {
        const [txRes, rcptRes, tipRes] = await Promise.all([
          httpJsonRequest(url, 'POST', { jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [txHash] }),
          httpJsonRequest(url, 'POST', { jsonrpc: '2.0', id: 2, method: 'eth_getTransactionReceipt', params: [txHash] }),
          httpJsonRequest(url, 'POST', { jsonrpc: '2.0', id: 3, method: 'eth_blockNumber', params: [] })
        ])
        return { tx: txRes?.result, receipt: rcptRes?.result, tipHex: tipRes?.result }
      })

      if (!result.tx) {
        return {
          found: false, network, txHash, executionSuccess: false, fromAddress: '', toAddress: '',
          contractAddress: '', amountAtomic: '0', confirmations: 0, blockNumber: 0, rpcEndpointUsed: rpcUrl
        }
      }

      const blockNum = result.receipt?.blockNumber ? parseInt(result.receipt.blockNumber, 16) : 0
      const tipNum = result.tipHex ? parseInt(result.tipHex, 16) : 0
      const confirmations = blockNum > 0 && tipNum >= blockNum ? (tipNum - blockNum + 1) : 0
      const executionSuccess = result.receipt ? result.receipt.status === '0x1' : false

      if (expectedContract) {
        const parsed = parseEvmTokenTransferLog(result.receipt?.logs || [], expectedContract, expectedRecipient)
        return {
          found: true,
          network,
          txHash,
          executionSuccess,
          fromAddress: parsed.fromAddress || (result.tx.from || ''),
          toAddress: parsed.toAddress,
          contractAddress: parsed.contractAddress,
          amountAtomic: parsed.amountAtomic,
          confirmations,
          blockNumber: blockNum,
          rpcEndpointUsed: rpcUrl
        }
      }

      return {
        found: true,
        network,
        txHash,
        executionSuccess,
        fromAddress: (result.tx.from || '').toLowerCase(),
        toAddress: (result.tx.to || '').toLowerCase(),
        contractAddress: '',
        amountAtomic: BigInt(result.tx.value || '0x0').toString(),
        confirmations,
        blockNumber: blockNum,
        rpcEndpointUsed: rpcUrl
      }
    }

    if (network === 'bitcoin') {
      const { result, rpcUrl } = await callWithFallback(primaryRpcUrl, fallbackRpcUrl, async (url) => {
        const [tx, tipHeight] = await Promise.all([
          httpJsonRequest(`${url}/tx/${encodeURIComponent(txHash)}`, 'GET'),
          httpJsonRequest(`${url}/blocks/tip/height`, 'GET')
        ])
        return { tx, tipHeight: Number(tipHeight) || 0 }
      })

      if (!result.tx?.txid) {
        return {
          found: false, network, txHash, executionSuccess: false, fromAddress: '', toAddress: '',
          contractAddress: '', amountAtomic: '0', confirmations: 0, blockNumber: 0, rpcEndpointUsed: rpcUrl
        }
      }

      let receivedSats = 0n
      for (const vout of result.tx.vout || []) {
        if ((vout.scriptpubkey_address || '').trim() === expectedRecipient.trim()) {
          receivedSats += BigInt(vout.value || 0)
        }
      }
      const blockNum = result.tx.status?.block_height || 0
      const confirmations = result.tx.status?.confirmed && blockNum > 0 && result.tipHeight >= blockNum
        ? (result.tipHeight - blockNum + 1)
        : 0

      return {
        found: true,
        network,
        txHash,
        executionSuccess: true,
        fromAddress: result.tx.vin?.[0]?.prevout?.scriptpubkey_address || '',
        toAddress: receivedSats > 0n ? expectedRecipient : '',
        contractAddress: '',
        amountAtomic: receivedSats.toString(),
        confirmations,
        blockNumber: blockNum,
        rpcEndpointUsed: rpcUrl
      }
    }

    if (network === 'tron') {
      const { result, rpcUrl } = await callWithFallback(primaryRpcUrl, fallbackRpcUrl, async (url) => {
        const [tx, info, nowBlock] = await Promise.all([
          httpJsonRequest(`${url}/wallet/gettransactionbyid`, 'POST', { value: txHash, visible: true }),
          httpJsonRequest(`${url}/wallet/gettransactioninfobyid`, 'POST', { value: txHash }),
          httpJsonRequest(`${url}/wallet/getnowblock`, 'POST', {})
        ])
        return { tx, info, tipBlock: nowBlock?.block_header?.raw_data?.number || 0 }
      })

      if (!result.tx?.txID) {
        return {
          found: false, network, txHash, executionSuccess: false, fromAddress: '', toAddress: '',
          contractAddress: '', amountAtomic: '0', confirmations: 0, blockNumber: 0, rpcEndpointUsed: rpcUrl
        }
      }

      const blockNum = result.info?.blockNumber || 0
      const confirmations = blockNum > 0 && result.tipBlock >= blockNum ? (result.tipBlock - blockNum + 1) : 0
      const retStatus = result.tx.ret?.[0]?.contractRet
      const executionSuccess = retStatus === 'SUCCESS'
      const contract = result.tx.raw_data?.contract?.[0]
      const paramVal = contract?.parameter?.value || {}

      if (expectedContract) {
        const contractAddr = paramVal.contract_address || ''
        const decoded = parseTronTrc20TransferData(String(paramVal.data || ''))
        return {
          found: true,
          network,
          txHash,
          executionSuccess,
          fromAddress: paramVal.owner_address || '',
          toAddress: decoded.toAddress,
          contractAddress: contractAddr,
          amountAtomic: decoded.amountAtomic,
          confirmations,
          blockNumber: blockNum,
          blockTimestampMs: result.info?.blockTimeStamp || result.tx.raw_data?.timestamp || undefined,
          rpcEndpointUsed: rpcUrl
        }
      }

      return {
        found: true,
        network,
        txHash,
        executionSuccess,
        fromAddress: paramVal.owner_address || '',
        toAddress: paramVal.to_address || '',
        contractAddress: '',
        amountAtomic: BigInt(paramVal.amount || 0).toString(),
        confirmations,
        blockNumber: blockNum,
        rpcEndpointUsed: rpcUrl
      }
    }

    // Solana JSON-RPC
    const { result, rpcUrl } = await callWithFallback(primaryRpcUrl, fallbackRpcUrl, async (url) => {
      const [txRes, slotRes] = await Promise.all([
        httpJsonRequest(url, 'POST', { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }),
        httpJsonRequest(url, 'POST', { jsonrpc: '2.0', id: 2, method: 'getSlot', params: [] })
      ])
      return { tx: txRes?.result, tipSlot: Number(slotRes?.result || 0) }
    })

    if (!result.tx) {
      return {
        found: false, network, txHash, executionSuccess: false, fromAddress: '', toAddress: '',
        contractAddress: '', amountAtomic: '0', confirmations: 0, blockNumber: 0, rpcEndpointUsed: rpcUrl
      }
    }

    const keys: string[] = (result.tx.transaction?.message?.accountKeys || []).map((k: any) => (typeof k === 'string' ? k : k.pubkey))
    const idx = keys.indexOf(expectedRecipient)
    let deltaLamports = 0n
    if (idx >= 0 && result.tx.meta) {
      const pre = BigInt(result.tx.meta.preBalances?.[idx] || 0)
      const post = BigInt(result.tx.meta.postBalances?.[idx] || 0)
      if (post > pre) deltaLamports = post - pre
    }
    const slot = Number(result.tx.slot || 0)
    const confirmations = slot > 0 && result.tipSlot >= slot ? (result.tipSlot - slot + 1) : 0

    return {
      found: true,
      network,
      txHash,
      executionSuccess: result.tx.meta?.err === null,
      fromAddress: keys[0] || '',
      toAddress: deltaLamports > 0n ? expectedRecipient : '',
      contractAddress: '',
      amountAtomic: deltaLamports.toString(),
      confirmations,
      blockNumber: slot,
      rpcEndpointUsed: rpcUrl
    }
  }
}
