<?php
// ──────────────────────────────────────────────────────────────────
// AntiProfiles — In-House Direct-to-TrustWallet Crypto Payment Gateway
// Zero third-party processors (no NOWPayments / CoinGate / BTCPay)
// Payments arrive directly in your Trust Wallet; automatic on-chain
// confirmation via direct RPC immediately activates user packages.
// ──────────────────────────────────────────────────────────────────

class InHouseCryptoGateway
{
    public const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    /**
     * Authoritative 9-network registry with official mainnet contracts & RPCs.
     */
    public static function getNetworks(array $gwConfig = []): array
    {
        $wallets = $gwConfig['trust_wallets'] ?? $gwConfig['wallets'] ?? [];
        $defaultTrc20 = trim((string)($wallets['tron'] ?? $gwConfig['wallet_address_trc20'] ?? $gwConfig['wallet_address'] ?? ''));
        $defaultEvm   = trim((string)($wallets['evm'] ?? $wallets['bsc'] ?? $wallets['ethereum'] ?? $gwConfig['wallet_address_evm'] ?? ''));
        $defaultBtc   = trim((string)($wallets['bitcoin'] ?? $gwConfig['wallet_address_btc'] ?? ''));
        $defaultSol   = trim((string)($wallets['solana'] ?? $gwConfig['wallet_address_sol'] ?? ''));

        return [
            'usdt-tron' => [
                'id' => 'usdt-tron', 'symbol' => 'USDT', 'network' => 'tron', 'label' => 'USDT — TRON (TRC20)',
                'standard' => 'TRC20', 'contract' => 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'decimals' => 6,
                'confirmations' => 19, 'chain_id' => 0,
                'wallet' => trim((string)($wallets['usdt-tron'] ?? $defaultTrc20)),
                'rpc' => $gwConfig['rpc_tron'] ?? 'https://api.trongrid.io'
            ],
            'trx-tron' => [
                'id' => 'trx-tron', 'symbol' => 'TRX', 'network' => 'tron', 'label' => 'TRX — TRON',
                'standard' => 'NATIVE', 'contract' => '', 'decimals' => 6,
                'confirmations' => 19, 'chain_id' => 0,
                'wallet' => trim((string)($wallets['trx-tron'] ?? $defaultTrc20)),
                'rpc' => $gwConfig['rpc_tron'] ?? 'https://api.trongrid.io'
            ],
            'usdt-bsc' => [
                'id' => 'usdt-bsc', 'symbol' => 'USDT', 'network' => 'bsc', 'label' => 'USDT — BNB Smart Chain (BEP20)',
                'standard' => 'BEP20', 'contract' => '0x55d398326f99059fF775485246999027B3197955', 'decimals' => 18,
                'confirmations' => 12, 'chain_id' => 56,
                'wallet' => trim((string)($wallets['usdt-bsc'] ?? $defaultEvm)),
                'rpc' => $gwConfig['rpc_bsc'] ?? 'https://bsc-dataseed.binance.org'
            ],
            'bnb-bsc' => [
                'id' => 'bnb-bsc', 'symbol' => 'BNB', 'network' => 'bsc', 'label' => 'BNB — BNB Smart Chain',
                'standard' => 'NATIVE', 'contract' => '', 'decimals' => 18,
                'confirmations' => 12, 'chain_id' => 56,
                'wallet' => trim((string)($wallets['bnb-bsc'] ?? $defaultEvm)),
                'rpc' => $gwConfig['rpc_bsc'] ?? 'https://bsc-dataseed.binance.org'
            ],
            'usdt-ethereum' => [
                'id' => 'usdt-ethereum', 'symbol' => 'USDT', 'network' => 'ethereum', 'label' => 'USDT — Ethereum (ERC20)',
                'standard' => 'ERC20', 'contract' => '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'decimals' => 6,
                'confirmations' => 12, 'chain_id' => 1,
                'wallet' => trim((string)($wallets['usdt-ethereum'] ?? $defaultEvm)),
                'rpc' => $gwConfig['rpc_ethereum'] ?? 'https://ethereum-rpc.publicnode.com'
            ],
            'eth-ethereum' => [
                'id' => 'eth-ethereum', 'symbol' => 'ETH', 'network' => 'ethereum', 'label' => 'ETH — Ethereum',
                'standard' => 'NATIVE', 'contract' => '', 'decimals' => 18,
                'confirmations' => 12, 'chain_id' => 1,
                'wallet' => trim((string)($wallets['eth-ethereum'] ?? $defaultEvm)),
                'rpc' => $gwConfig['rpc_ethereum'] ?? 'https://ethereum-rpc.publicnode.com'
            ],
            'btc-bitcoin' => [
                'id' => 'btc-bitcoin', 'symbol' => 'BTC', 'network' => 'bitcoin', 'label' => 'BTC — Bitcoin',
                'standard' => 'NATIVE', 'contract' => '', 'decimals' => 8,
                'confirmations' => 2, 'chain_id' => 0,
                'wallet' => trim((string)($wallets['btc-bitcoin'] ?? $defaultBtc)),
                'rpc' => $gwConfig['rpc_bitcoin'] ?? 'https://mempool.space/api'
            ],
            'pol-polygon' => [
                'id' => 'pol-polygon', 'symbol' => 'POL', 'network' => 'polygon', 'label' => 'POL/MATIC — Polygon',
                'standard' => 'NATIVE', 'contract' => '', 'decimals' => 18,
                'confirmations' => 20, 'chain_id' => 137,
                'wallet' => trim((string)($wallets['pol-polygon'] ?? $defaultEvm)),
                'rpc' => $gwConfig['rpc_polygon'] ?? 'https://polygon-bor-rpc.publicnode.com'
            ],
            'sol-solana' => [
                'id' => 'sol-solana', 'symbol' => 'SOL', 'network' => 'solana', 'label' => 'SOL — Solana',
                'standard' => 'NATIVE', 'contract' => '', 'decimals' => 9,
                'confirmations' => 32, 'chain_id' => 0,
                'wallet' => trim((string)($wallets['sol-solana'] ?? $defaultSol)),
                'rpc' => $gwConfig['rpc_solana'] ?? 'https://api.mainnet-beta.solana.com'
            ]
        ];
    }

    /**
     * Resolve a network spec by networkId (e.g. "usdt-tron") or coin/network shorthand.
     */
    public static function resolveNetwork(array $gwConfig, string $networkIdOrCoin): ?array
    {
        $all = self::getNetworks($gwConfig);
        $key = strtolower(trim($networkIdOrCoin));
        if (isset($all[$key])) {
            return $all[$key];
        }
        $aliases = [
            'usdt' => 'usdt-tron', 'usdt-trc20' => 'usdt-tron', 'trc20' => 'usdt-tron',
            'usdt-bep20' => 'usdt-bsc', 'bep20' => 'usdt-bsc',
            'usdt-erc20' => 'usdt-ethereum', 'erc20' => 'usdt-ethereum',
            'trx' => 'trx-tron', 'bnb' => 'bnb-bsc', 'eth' => 'eth-ethereum',
            'btc' => 'btc-bitcoin', 'pol' => 'pol-polygon', 'matic' => 'pol-polygon', 'sol' => 'sol-solana'
        ];
        return isset($aliases[$key]) ? ($all[$aliases[$key]] ?? null) : null;
    }

    /**
     * Fetch live USD spot price from Binance public API (no key required).
     */
    public static function getUsdPrice(string $symbol): float
    {
        $sym = strtoupper($symbol);
        if ($sym === 'USDT' || $sym === 'USDC') {
            return 1.0;
        }
        $pair = ($sym === 'POL' ? 'POLUSDT' : $sym . 'USDT');
        $res = self::httpJson("https://api.binance.com/api/v3/ticker/price?symbol={$pair}", 'GET');
        if (!empty($res['price']) && (float)$res['price'] > 0) {
            return (float)$res['price'];
        }
        $fallbacks = ['TRX' => 0.16, 'BNB' => 600.0, 'ETH' => 3200.0, 'BTC' => 90000.0, 'POL' => 0.50, 'SOL' => 200.0];
        return $fallbacks[$sym] ?? 1.0;
    }

    /**
     * Compute unique expected crypto amount with a deterministic micro-tag (0.0001..0.0099)
     * so concurrent invoices to the same Trust Wallet can be auto-matched on-chain.
     */
    public static function computeUniqueCryptoAmount(float $usdAmount, float $rateUsd, int $decimals, string $invoiceNumber): string
    {
        $base = $usdAmount / max(0.00000001, $rateUsd);
        $tagSeed = (crc32($invoiceNumber) % 97) + 1; // 1..97
        $displayDecimals = min($decimals, 6);
        $tagIncrement = $tagSeed / pow(10, min(4, $displayDecimals));
        return number_format($base + $tagIncrement, $displayDecimals, '.', '');
    }

    /**
     * Verify a specific transaction hash directly against the blockchain RPC.
     */
    public static function verifyTxHash(array $net, string $txHash, string $expectedWallet, float $expectedCryptoAmount): array
    {
        $txHash = trim($txHash);
        $expectedWallet = trim($expectedWallet);
        $network = $net['network'];
        $rpc = rtrim($net['rpc'], '/');

        if ($network === 'ethereum' || $network === 'bsc' || $network === 'polygon') {
            $chainRes = self::httpJson($rpc, 'POST', ['jsonrpc' => '2.0', 'id' => 0, 'method' => 'eth_chainId', 'params' => []]);
            $actualChain = isset($chainRes['result']) ? hexdec($chainRes['result']) : 0;
            if ($net['chain_id'] > 0 && $actualChain !== (int)$net['chain_id']) {
                return ['confirmed' => false, 'status' => 'failed', 'confirmations' => 0, 'reason' => "RPC chainId mismatch ({$actualChain} != {$net['chain_id']})"];
            }

            $txRes   = self::httpJson($rpc, 'POST', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'eth_getTransactionByHash', 'params' => [$txHash]]);
            $rcptRes = self::httpJson($rpc, 'POST', ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'eth_getTransactionReceipt', 'params' => [$txHash]]);
            $tipRes  = self::httpJson($rpc, 'POST', ['jsonrpc' => '2.0', 'id' => 3, 'method' => 'eth_blockNumber', 'params' => []]);

            $tx = $txRes['result'] ?? null;
            $rcpt = $rcptRes['result'] ?? null;
            if (!$tx) return ['confirmed' => false, 'status' => 'pending', 'confirmations' => 0, 'reason' => 'Transaction not found on-chain yet'];
            if (!$rcpt || empty($rcpt['blockNumber'])) return ['confirmed' => false, 'status' => 'detected', 'confirmations' => 0, 'reason' => 'Transaction in mempool (0 confirmations)'];
            if (($rcpt['status'] ?? '') !== '0x1') return ['confirmed' => false, 'status' => 'failed', 'confirmations' => 0, 'reason' => 'Transaction reverted on-chain'];

            $blockNum = hexdec($rcpt['blockNumber']);
            $tipNum = isset($tipRes['result']) ? hexdec($tipRes['result']) : $blockNum;
            $confs = max(1, $tipNum - $blockNum + 1);

            $receivedFloat = 0.0;
            if (!empty($net['contract'])) {
                $targetContract = strtolower($net['contract']);
                $targetWallet = strtolower($expectedWallet);
                foreach (($rcpt['logs'] ?? []) as $log) {
                    if (strtolower($log['address'] ?? '') !== $targetContract) continue;
                    $topics = $log['topics'] ?? [];
                    if (count($topics) < 3 || strtolower($topics[0]) !== self::ERC20_TRANSFER_TOPIC) continue;
                    $to = '0x' . strtolower(substr($topics[2], -40));
                    if ($to !== $targetWallet) continue;
                    $receivedFloat += self::hexToDecimalFloat($log['data'] ?? '0x0', (int)$net['decimals']);
                }
            } else {
                if (strtolower($tx['to'] ?? '') === strtolower($expectedWallet)) {
                    $receivedFloat = self::hexToDecimalFloat($tx['value'] ?? '0x0', (int)$net['decimals']);
                }
            }

            return self::evaluateAmountsAndConfirmations($receivedFloat, $expectedCryptoAmount, $confs, (int)$net['confirmations'], $txHash);
        }

        if ($network === 'tron') {
            $tx = self::httpJson("{$rpc}/wallet/gettransactionbyid", 'POST', ['value' => $txHash, 'visible' => true]);
            $info = self::httpJson("{$rpc}/wallet/gettransactioninfobyid", 'POST', ['value' => $txHash]);
            $nowBlock = self::httpJson("{$rpc}/wallet/getnowblock", 'POST', (object)[]);

            if (empty($tx['txID'])) return ['confirmed' => false, 'status' => 'pending', 'confirmations' => 0, 'reason' => 'TRON tx not found'];
            if (($tx['ret'][0]['contractRet'] ?? '') !== 'SUCCESS') return ['confirmed' => false, 'status' => 'failed', 'confirmations' => 0, 'reason' => 'TRON tx failed'];

            $blockNum = (int)($info['blockNumber'] ?? 0);
            $tipNum = (int)($nowBlock['block_header']['raw_data']['number'] ?? $blockNum);
            $confs = $blockNum > 0 ? max(1, $tipNum - $blockNum + 1) : 0;

            $receivedFloat = 0.0;
            if (!empty($net['contract'])) {
                // Verify via TronGrid TRC20 account transfer event for exact Base58 recipient match
                $events = self::httpJson("{$rpc}/v1/accounts/" . urlencode($expectedWallet) . "/transactions/trc20?limit=30&only_to=true&contract_address=" . urlencode($net['contract']), 'GET');
                foreach (($events['data'] ?? []) as $ev) {
                    if (($ev['transaction_id'] ?? '') === $txHash && ($ev['to'] ?? '') === $expectedWallet) {
                        $receivedFloat = ((float)($ev['value'] ?? 0)) / pow(10, (int)$net['decimals']);
                        break;
                    }
                }
            } else {
                $val = $tx['raw_data']['contract'][0]['parameter']['value'] ?? [];
                if (($val['to_address'] ?? '') === $expectedWallet) {
                    $receivedFloat = ((float)($val['amount'] ?? 0)) / pow(10, (int)$net['decimals']);
                }
            }

            return self::evaluateAmountsAndConfirmations($receivedFloat, $expectedCryptoAmount, $confs, (int)$net['confirmations'], $txHash);
        }

        if ($network === 'bitcoin') {
            $tx = self::httpJson("{$rpc}/tx/" . urlencode($txHash), 'GET');
            $tip = (int)trim((string)self::httpRaw("{$rpc}/blocks/tip/height"));
            if (empty($tx['txid'])) return ['confirmed' => false, 'status' => 'pending', 'confirmations' => 0, 'reason' => 'Bitcoin tx not found'];
            $sats = 0;
            foreach (($tx['vout'] ?? []) as $vout) {
                if (($vout['scriptpubkey_address'] ?? '') === $expectedWallet) {
                    $sats += (int)($vout['value'] ?? 0);
                }
            }
            $blockH = (int)($tx['status']['block_height'] ?? 0);
            $confs = (!empty($tx['status']['confirmed']) && $blockH > 0) ? max(1, $tip - $blockH + 1) : 0;
            return self::evaluateAmountsAndConfirmations($sats / 1e8, $expectedCryptoAmount, $confs, (int)$net['confirmations'], $txHash);
        }

        // Solana
        $txRes = self::httpJson($rpc, 'POST', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'getTransaction', 'params' => [$txHash, ['encoding' => 'jsonParsed', 'maxSupportedTransactionVersion' => 0]]]);
        $slotRes = self::httpJson($rpc, 'POST', ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'getSlot', 'params' => []]);
        $tx = $txRes['result'] ?? null;
        if (!$tx) return ['confirmed' => false, 'status' => 'pending', 'confirmations' => 0, 'reason' => 'Solana tx not found'];
        if (($tx['meta']['err'] ?? null) !== null) return ['confirmed' => false, 'status' => 'failed', 'confirmations' => 0, 'reason' => 'Solana tx failed'];

        $keys = array_map(fn($k) => is_array($k) ? ($k['pubkey'] ?? '') : (string)$k, $tx['transaction']['message']['accountKeys'] ?? []);
        $idx = array_search($expectedWallet, $keys, true);
        $solReceived = 0.0;
        if ($idx !== false) {
            $pre = (int)($tx['meta']['preBalances'][$idx] ?? 0);
            $post = (int)($tx['meta']['postBalances'][$idx] ?? 0);
            if ($post > $pre) $solReceived = ($post - $pre) / 1e9;
        }
        $slot = (int)($tx['slot'] ?? 0);
        $tipSlot = (int)($slotRes['result'] ?? $slot);
        $confs = $slot > 0 ? max(1, $tipSlot - $slot + 1) : 0;
        return self::evaluateAmountsAndConfirmations($solReceived, $expectedCryptoAmount, $confs, (int)$net['confirmations'], $txHash);
    }

    /**
     * Automatically detect incoming USDT-TRC20 or BTC transfer to Trust Wallet without user submitting TxHash.
     */
    public static function autoDetectIncomingTx(array $net, string $expectedWallet, float $expectedCryptoAmount, int $invoiceCreatedTs): ?string
    {
        $rpc = rtrim($net['rpc'], '/');
        if ($net['network'] === 'tron' && !empty($net['contract'])) {
            $events = self::httpJson("{$rpc}/v1/accounts/" . urlencode($expectedWallet) . "/transactions/trc20?limit=25&only_to=true&contract_address=" . urlencode($net['contract']), 'GET');
            foreach (($events['data'] ?? []) as $ev) {
                $tsSec = (int)(($ev['block_timestamp'] ?? 0) / 1000);
                if ($tsSec < $invoiceCreatedTs - 120) continue;
                $amt = ((float)($ev['value'] ?? 0)) / pow(10, (int)$net['decimals']);
                if (abs($amt - $expectedCryptoAmount) <= max(0.0002, $expectedCryptoAmount * 0.002)) {
                    return (string)($ev['transaction_id'] ?? '');
                }
            }
        }
        if ($net['network'] === 'bitcoin') {
            $txs = self::httpJson("{$rpc}/address/" . urlencode($expectedWallet) . "/txs", 'GET');
            if (is_array($txs)) {
                foreach (array_slice($txs, 0, 20) as $tx) {
                    $bt = (int)($tx['status']['block_time'] ?? time());
                    if ($bt < $invoiceCreatedTs - 120) continue;
                    $sats = 0;
                    foreach (($tx['vout'] ?? []) as $vout) {
                        if (($vout['scriptpubkey_address'] ?? '') === $expectedWallet) $sats += (int)($vout['value'] ?? 0);
                    }
                    $btc = $sats / 1e8;
                    if (abs($btc - $expectedCryptoAmount) <= max(0.00001, $expectedCryptoAmount * 0.005)) {
                        return (string)($tx['txid'] ?? '');
                    }
                }
            }
        }
        return null;
    }

    private static function evaluateAmountsAndConfirmations(float $received, float $expected, int $confs, int $reqConfs, string $txHash): array
    {
        if ($received <= 0) {
            return ['confirmed' => false, 'status' => 'failed', 'confirmations' => $confs, 'received' => 0, 'txHash' => $txHash, 'reason' => 'No funds sent to Trust Wallet address'];
        }
        if ($received < $expected * 0.995) {
            return ['confirmed' => false, 'status' => 'underpaid', 'confirmations' => $confs, 'received' => $received, 'txHash' => $txHash, 'reason' => "Underpaid: received {$received}, expected {$expected}"];
        }
        if ($confs < $reqConfs) {
            return ['confirmed' => false, 'status' => 'confirming', 'confirmations' => $confs, 'received' => $received, 'txHash' => $txHash, 'reason' => "Confirming on-chain ({$confs}/{$reqConfs})"];
        }
        return ['confirmed' => true, 'status' => 'confirmed', 'confirmations' => $confs, 'received' => $received, 'txHash' => $txHash, 'reason' => "Confirmed ({$confs}/{$reqConfs}) directly in Trust Wallet"];
    }

    private static function hexToDecimalFloat(string $hex, int $decimals): float
    {
        $clean = ltrim(strtolower(preg_replace('/^0x/', '', $hex)), '0');
        if ($clean === '') return 0.0;
        // Convert hex to decimal string safely using bcmath if available, else float
        $val = 0.0;
        for ($i = 0; $i < strlen($clean); $i++) {
            $val = $val * 16 + hexdec($clean[$i]);
        }
        return $val / pow(10, $decimals);
    }

    private static function httpJson(string $url, string $method = 'GET', $body = null): array
    {
        $raw = self::httpRaw($url, $method, $body);
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function httpRaw(string $url, string $method = 'GET', $body = null): string
    {
        $ch = curl_init($url);
        $headers = ['Accept: application/json', 'User-Agent: AntiProfiles-InHouseCrypto/2.0'];
        if ($method === 'POST') {
            $payload = is_string($body) ? $body : json_encode($body ?? (object)[]);
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $resp = curl_exec($ch);
        curl_close($ch);
        return is_string($resp) ? $resp : '';
    }
}
