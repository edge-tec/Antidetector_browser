// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Isolated HD Wallet & Auto-Sweep Signer Service
// Strictly bound to 127.0.0.1 | Authenticated via Bearer SIGNER_API_KEY
// Derives unique per-order deposit addresses (EVM & TRON) and
// automatically sweeps confirmed funds directly to your Trust Wallet.
// ──────────────────────────────────────────────────────────────────

import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { TronWeb } from 'tronweb';

const HOST = process.env.SIGNER_HOST || '127.0.0.1';
const PORT = Number(process.env.SIGNER_PORT || 3105);
const API_KEY = (process.env.SIGNER_API_KEY || '').trim();
const ENV_MNEMONIC = (process.env.HD_MASTER_MNEMONIC || '').trim();
const ALLOW_EVM = (process.env.TRUST_WALLET_EVM || '').trim();
const ALLOW_TRON = (process.env.TRUST_WALLET_TRON || '').trim();
const GAS_FUNDER_EVM = (process.env.GAS_FUNDER_PRIVATE_KEY_EVM || '').trim();
const GAS_FUNDER_TRON = (process.env.GAS_FUNDER_PRIVATE_KEY_TRON || '').trim();
const TRONGRID_API_KEY = (process.env.TRONGRID_API_KEY || '').trim();

if (!API_KEY || API_KEY.length < 16) {
  console.error('[Signer] FATAL: SIGNER_API_KEY must be set (min 16 chars) in .env');
  process.exit(1);
}

const envMasterMnemonic = (ENV_MNEMONIC && ENV_MNEMONIC.split(/\s+/).length >= 12)
  ? ethers.Mnemonic.fromPhrase(ENV_MNEMONIC)
  : null;

function resolveMnemonic(rawPhrase) {
  const phrase = String(rawPhrase || '').trim().replace(/\s+/g, ' ');
  if (phrase) {
    const words = phrase.split(' ');
    if (words.length < 12) {
      throw new Error('Secret recovery phrase must be 12 or 24 valid BIP-39 words');
    }
    return ethers.Mnemonic.fromPhrase(phrase);
  }
  if (envMasterMnemonic) {
    return envMasterMnemonic;
  }
  throw new Error('Trust Wallet / HD Secret Recovery Phrase is not configured yet. Add it in Admin Panel -> Payment Gateways -> Crypto.');
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const DEFAULT_RPCS = {
  bsc: 'https://bsc-dataseed.binance.org',
  ethereum: 'https://ethereum-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  tron: 'https://api.trongrid.io'
};

function constantTimeAuth(req) {
  const header = String(req.headers['authorization'] || '');
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7).trim();
  const a = Buffer.from(token);
  const b = Buffer.from(API_KEY);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function deriveChildWallet(network, index, mnemonicObj) {
  const activeMnemonic = mnemonicObj || resolveMnemonic('');
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx > 2147483647) {
    throw new Error(`Invalid derivation index: ${index}`);
  }
  const net = String(network || '').toLowerCase();

  if (net === 'tron') {
    const path = `m/44'/195'/0'/0/${idx}`;
    const hd = ethers.HDNodeWallet.fromMnemonic(activeMnemonic, path);
    const privHex = hd.privateKey.replace(/^0x/, '');
    const tronAddress = TronWeb.address.fromPrivateKey(privHex);
    return {
      network: 'tron',
      index: idx,
      derivationPath: path,
      address: tronAddress,
      privateKey: privHex
    };
  }

  if (net === 'bsc' || net === 'ethereum' || net === 'polygon') {
    const path = `m/44'/60'/0'/0/${idx}`;
    const hd = ethers.HDNodeWallet.fromMnemonic(activeMnemonic, path);
    return {
      network: net,
      index: idx,
      derivationPath: path,
      address: hd.address,
      privateKey: hd.privateKey
    };
  }

  throw new Error(`Unsupported HD network: ${network}`);
}

function assertTreasuryAllowed(network, toTreasuryAddress) {
  const target = String(toTreasuryAddress || '').trim();
  if (!target) throw new Error('toTreasuryAddress (Trust Wallet) is required');

  if (network === 'tron') {
    if (ALLOW_TRON && target !== ALLOW_TRON) {
      throw new Error('Destination rejected: does not match TRUST_WALLET_TRON allowlist');
    }
    return target;
  }

  if (!ethers.isAddress(target)) {
    throw new Error(`Invalid EVM Trust Wallet address: ${target}`);
  }
  if (ALLOW_EVM && target.toLowerCase() !== ALLOW_EVM.toLowerCase()) {
    throw new Error('Destination rejected: does not match TRUST_WALLET_EVM allowlist');
  }
  return ethers.getAddress(target);
}

async function sweepEvm({ network, index, tokenStandard, contractAddress, decimals, toTreasuryAddress, rpcUrl, mnemonic }) {
  const mnemonicObj = resolveMnemonic(mnemonic);
  const child = deriveChildWallet(network, index, mnemonicObj);
  const rootWallet = deriveChildWallet(network, 0, mnemonicObj);
  const treasury = assertTreasuryAllowed(network, toTreasuryAddress || rootWallet.address);
  const provider = new ethers.JsonRpcProvider(rpcUrl || DEFAULT_RPCS[network]);
  const wallet = new ethers.Wallet(child.privateKey, provider);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei');

  if (tokenStandard && tokenStandard !== 'NATIVE' && contractAddress) {
    const token = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
    const tokenBal = await token.balanceOf(wallet.address);
    if (tokenBal <= 0n) {
      return { success: false, status: 'empty', error: 'No ERC20/BEP20 token balance to sweep' };
    }

    const gasLimit = 65000n;
    const requiredGas = gasLimit * gasPrice * 130n / 100n; // 30% safety buffer
    let nativeBal = await provider.getBalance(wallet.address);

    if (nativeBal < requiredGas) {
      const funderKey = GAS_FUNDER_EVM || rootWallet.privateKey;
      const funder = new ethers.Wallet(funderKey, provider);
      const funderBal = await provider.getBalance(funder.address);
      const topUp = requiredGas - nativeBal;
      if (funderBal < topUp + (21000n * gasPrice)) {
        return {
          success: false,
          status: 'needs_gas',
          error: `Child address ${wallet.address} needs ${ethers.formatEther(requiredGas)} native gas; keep minimal BNB/ETH/POL in your Trust Wallet (${funder.address}) to auto-sponsor token sweeps`
        };
      }
      const fundTx = await funder.sendTransaction({ to: wallet.address, value: topUp, gasPrice });
      await fundTx.wait(1);
    }

    const sweepTx = await token.transfer(treasury, tokenBal, { gasLimit, gasPrice });
    const receipt = await sweepTx.wait(1);
    return {
      success: receipt?.status === 1,
      sweepTxHash: sweepTx.hash,
      sweptAmount: ethers.formatUnits(tokenBal, Number(decimals || 18)),
      fromAddress: wallet.address,
      toTreasuryAddress: treasury
    };
  }

  // Native coin sweep (BNB / ETH / POL)
  const balance = await provider.getBalance(wallet.address);
  const gasLimit = 21000n;
  const gasCost = gasLimit * gasPrice;
  if (balance <= gasCost) {
    return { success: false, status: 'dust', error: 'Native balance too low to cover gas fee' };
  }

  const sendAmount = balance - gasCost;
  const tx = await wallet.sendTransaction({
    to: treasury,
    value: sendAmount,
    gasLimit,
    gasPrice
  });
  const receipt = await tx.wait(1);
  return {
    success: receipt?.status === 1,
    sweepTxHash: tx.hash,
    sweptAmount: ethers.formatEther(sendAmount),
    fromAddress: wallet.address,
    toTreasuryAddress: treasury
  };
}

async function sweepTron({ index, tokenStandard, contractAddress, decimals, toTreasuryAddress, rpcUrl, mnemonic }) {
  const mnemonicObj = resolveMnemonic(mnemonic);
  const child = deriveChildWallet('tron', index, mnemonicObj);
  const rootWallet = deriveChildWallet('tron', 0, mnemonicObj);
  const treasury = assertTreasuryAllowed('tron', toTreasuryAddress || rootWallet.address);
  const fullHost = rpcUrl || DEFAULT_RPCS.tron;
  const headers = TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : undefined;

  const tronWeb = new TronWeb({ fullHost, headers, privateKey: child.privateKey });

  if (tokenStandard === 'TRC20' && contractAddress) {
    const contract = await tronWeb.contract().at(contractAddress);
    const rawBal = BigInt((await contract.balanceOf(child.address).call()).toString());
    if (rawBal <= 0n) {
      return { success: false, status: 'empty', error: 'No TRC20 token balance to sweep' };
    }

    // Ensure child address has at least 25 TRX for TRC20 energy/bandwidth
    const trxSun = BigInt(await tronWeb.trx.getBalance(child.address));
    const minSun = 25_000_000n; // 25 TRX
    if (trxSun < minSun) {
      const funderKey = GAS_FUNDER_TRON || rootWallet.privateKey;
      const funderTron = new TronWeb({ fullHost, headers, privateKey: funderKey });
      const funderAddr = TronWeb.address.fromPrivateKey(funderKey);
      const funderSun = BigInt(await funderTron.trx.getBalance(funderAddr));
      const topUpSun = Number(minSun - trxSun);
      if (funderSun < BigInt(topUpSun) + 2_000_000n) {
        return {
          success: false,
          status: 'needs_gas',
          error: `TRON child ${child.address} needs ~25 TRX for TRC20 sweep gas; keep TRX in your Trust Wallet (${funderAddr}) to auto-sponsor USDT-TRC20 sweeps`
        };
      }
      await funderTron.trx.sendTransaction(child.address, topUpSun);
      await new Promise((r) => setTimeout(r, 4000));
    }

    const txId = await contract.transfer(treasury, rawBal.toString()).send({ feeLimit: 40_000_000 });
    return {
      success: Boolean(txId),
      sweepTxHash: String(txId),
      sweptAmount: (Number(rawBal) / Math.pow(10, Number(decimals || 6))).toFixed(6),
      fromAddress: child.address,
      toTreasuryAddress: treasury
    };
  }

  // Native TRX sweep (leave 1.1 TRX reserve for bandwidth)
  const trxSun = BigInt(await tronWeb.trx.getBalance(child.address));
  const reserveSun = 1_100_000n;
  if (trxSun <= reserveSun) {
    return { success: false, status: 'dust', error: 'TRX balance too low to sweep' };
  }
  const sendSun = Number(trxSun - reserveSun);
  const res = await tronWeb.trx.sendTransaction(treasury, sendSun);
  const txId = res?.txid || res?.transaction?.txID || '';
  return {
    success: Boolean(res?.result && txId),
    sweepTxHash: String(txId),
    sweptAmount: (sendSun / 1e6).toFixed(6),
    fromAddress: child.address,
    toTreasuryAddress: treasury
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 128) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'antiprofiles-hd-signer',
        networks: ['tron', 'bsc', 'ethereum', 'polygon'],
        envMnemonicConfigured: Boolean(envMasterMnemonic),
        dynamicMnemonicSupported: true,
        treasuryAllowlistEnabled: Boolean(ALLOW_EVM || ALLOW_TRON)
      });
    }

    if (!constantTimeAuth(req)) {
      return sendJson(res, 401, { success: false, error: 'Unauthorized' });
    }

    if (req.method === 'POST' && req.url === '/derive-treasury') {
      const body = await readJsonBody(req);
      const mnemonicObj = resolveMnemonic(body.mnemonic);
      const tronRoot = deriveChildWallet('tron', 0, mnemonicObj);
      const evmRoot = deriveChildWallet('bsc', 0, mnemonicObj);
      return sendJson(res, 200, {
        success: true,
        tron: tronRoot.address,
        evm: evmRoot.address,
        paths: {
          tron: tronRoot.derivationPath,
          evm: evmRoot.derivationPath
        }
      });
    }

    if (req.method === 'POST' && req.url === '/derive-address') {
      const body = await readJsonBody(req);
      const mnemonicObj = resolveMnemonic(body.mnemonic);
      const child = deriveChildWallet(body.network, body.index, mnemonicObj);
      return sendJson(res, 200, {
        success: true,
        network: child.network,
        index: child.index,
        derivationPath: child.derivationPath,
        address: child.address
      });
    }

    if (req.method === 'POST' && req.url === '/sweep') {
      const body = await readJsonBody(req);
      const net = String(body.network || '').toLowerCase();
      const result = net === 'tron' ? await sweepTron(body) : await sweepEvm(body);
      return sendJson(res, result.success ? 200 : 422, result);
    }

    return sendJson(res, 404, { success: false, error: 'Not found' });
  } catch (err) {
    console.error('[Signer Error]', err?.message || err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Internal signer error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[AntiProfiles HD Signer] Listening strictly on http://${HOST}:${PORT}`);
});
