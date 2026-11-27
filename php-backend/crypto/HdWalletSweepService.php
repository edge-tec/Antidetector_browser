<?php
// ──────────────────────────────────────────────────────────────────
// AntiProfiles — HD Wallet Deposit Allocation & Auto-Sweep Engine
// Allocates a unique BIP-44 HD deposit address per order via local
// signer-service (127.0.0.1:3105) and automatically sweeps confirmed
// payments directly into the administrator's Trust Wallet.
// ──────────────────────────────────────────────────────────────────

class HdWalletSweepService
{
    public const HD_SUPPORTED_NETWORKS = ['tron', 'bsc', 'ethereum', 'polygon'];

    private static function getVaultKey(): string
    {
        $parts = [
            defined('JWT_SECRET') ? (string)JWT_SECRET : (string)(getenv('JWT_SECRET') ?: ''),
            defined('DB_PASS') ? (string)DB_PASS : (string)(getenv('DB_PASS') ?: ''),
            defined('DB_NAME') ? (string)DB_NAME : (string)(getenv('DB_NAME') ?: ''),
            __DIR__,
            'antiprofiles-hd-mnemonic-vault-v1'
        ];
        return hash('sha256', implode('|', $parts), true);
    }

    public static function encryptSecret(string $plaintext): string
    {
        $clean = trim($plaintext);
        if ($clean === '') return '';
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($clean, 'aes-256-gcm', self::getVaultKey(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            throw new RuntimeException('Failed to encrypt Trust Wallet secret phrase');
        }
        return 'enc_v1:' . base64_encode($iv . $tag . $cipher);
    }

    public static function decryptSecret(string $encoded): string
    {
        $encoded = trim($encoded);
        if ($encoded === '') return '';
        if (strpos($encoded, 'enc_v1:') !== 0) {
            return $encoded;
        }
        $raw = base64_decode(substr($encoded, 7), true);
        if ($raw === false || strlen($raw) < 29) {
            return '';
        }
        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipher = substr($raw, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', self::getVaultKey(), OPENSSL_RAW_DATA, $iv, $tag);
        return $plain === false ? '' : trim($plain);
    }

    public static function validateMnemonic(string $rawPhrase): array
    {
        $normalized = strtolower(trim(preg_replace('/\s+/', ' ', $rawPhrase)));
        $words = $normalized === '' ? [] : explode(' ', $normalized);
        $count = count($words);
        if (!in_array($count, [12, 15, 18, 21, 24], true)) {
            return ['valid' => false, 'error' => "Secret recovery phrase must be 12 or 24 words (got {$count})."];
        }
        foreach ($words as $w) {
            if (!preg_match('/^[a-z]{2,12}$/', $w)) {
                return ['valid' => false, 'error' => 'Secret recovery phrase contains invalid characters. Use space-separated lowercase English BIP-39 words.'];
            }
        }
        $masked = $words[0] . ' •••• •••• ... ' . $words[$count - 1] . " ({$count} words)";
        return ['valid' => true, 'phrase' => $normalized, 'wordCount' => $count, 'masked' => $masked];
    }

    public static function resolveDecryptedMnemonic(array $gwConfig): string
    {
        if (!empty($gwConfig['hd_mnemonic_enc'])) {
            return self::decryptSecret((string)$gwConfig['hd_mnemonic_enc']);
        }
        if (!empty($gwConfig['hd_mnemonic'])) {
            return trim((string)$gwConfig['hd_mnemonic']);
        }
        return '';
    }

    public static function deriveTreasuryAddresses(array $gwConfig, ?string $overrideMnemonic = null): array
    {
        $payload = [];
        if ($overrideMnemonic !== null && trim($overrideMnemonic) !== '') {
            $payload['mnemonic'] = trim(preg_replace('/\s+/', ' ', $overrideMnemonic));
        }
        return self::callSigner($gwConfig, '/derive-treasury', $payload);
    }

    public static function ensureSchema(PDO $db): void
    {
        $db->exec("
            CREATE TABLE IF NOT EXISTS `crypto_hd_deposits` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `invoice_id` VARCHAR(50) NOT NULL,
              `invoice_number` VARCHAR(50) NOT NULL,
              `user_id` VARCHAR(36) NOT NULL,
              `network_id` VARCHAR(40) NOT NULL,
              `network` VARCHAR(24) NOT NULL,
              `symbol` VARCHAR(16) NOT NULL,
              `standard` VARCHAR(16) NOT NULL DEFAULT 'NATIVE',
              `contract_address` VARCHAR(100) DEFAULT '',
              `decimals` INT NOT NULL DEFAULT 18,
              `derivation_index` INT NOT NULL,
              `derivation_path` VARCHAR(64) NOT NULL,
              `deposit_address` VARCHAR(120) NOT NULL,
              `treasury_wallet` VARCHAR(120) NOT NULL,
              `expected_amount` DECIMAL(24,8) NOT NULL,
              `received_amount` DECIMAL(24,8) NOT NULL DEFAULT 0,
              `deposit_tx_hash` VARCHAR(128) DEFAULT NULL,
              `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
              `sweep_tx_hash` VARCHAR(128) DEFAULT NULL,
              `sweep_amount` DECIMAL(24,8) DEFAULT NULL,
              `sweep_error` TEXT DEFAULT NULL,
              `sweep_attempts` INT NOT NULL DEFAULT 0,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `confirmed_at` DATETIME DEFAULT NULL,
              `swept_at` DATETIME DEFAULT NULL,
              UNIQUE KEY `uniq_hd_net_idx` (`network`, `derivation_index`),
              UNIQUE KEY `uniq_hd_addr_net` (`network`, `deposit_address`),
              KEY `idx_hd_invoice` (`invoice_number`),
              KEY `idx_hd_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    /**
     * HD + Auto-Sweep is active when signer_url + signer_api_key are configured
     * and the selected network supports HD derivation (tron, bsc, ethereum, polygon).
     */
    public static function isHdModeEnabled(array $gwConfig, array $net): bool
    {
        $mode = strtolower(trim((string)($gwConfig['mode'] ?? 'auto')));
        if ($mode === 'direct') {
            return false;
        }
        $signerUrl = trim((string)($gwConfig['signer_url'] ?? ''));
        $signerKey = trim((string)($gwConfig['signer_api_key'] ?? ''));
        if ($signerUrl === '' || $signerKey === '') {
            return false;
        }
        return in_array(strtolower((string)$net['network']), self::HD_SUPPORTED_NETWORKS, true);
    }

    /**
     * Atomically allocate a brand-new unique HD deposit address for this order.
     */
    public static function allocateDepositAddress(
        PDO $db,
        array $gwConfig,
        array $net,
        string $invoiceId,
        string $invoiceNumber,
        string $userId,
        string $expectedCryptoAmount
    ): array {
        self::ensureSchema($db);

        $network = strtolower((string)$net['network']);
        $treasuryWallet = trim((string)$net['wallet']);
        if ($treasuryWallet === '') {
            $derivedTreasury = self::deriveTreasuryAddresses($gwConfig);
            if (!empty($derivedTreasury['success'])) {
                $treasuryWallet = ($network === 'tron')
                    ? trim((string)($derivedTreasury['tron'] ?? ''))
                    : trim((string)($derivedTreasury['evm'] ?? ''));
            }
        }
        if ($treasuryWallet === '') {
            throw new RuntimeException("Trust Wallet treasury address not configured for {$net['label']}");
        }

        $db->beginTransaction();
        try {
            $maxStmt = $db->prepare("SELECT COALESCE(MAX(derivation_index), 0) AS max_idx FROM crypto_hd_deposits WHERE network = ? FOR UPDATE");
            $maxStmt->execute([$network]);
            $nextIndex = ((int)($maxStmt->fetchColumn() ?: 0)) + 1;

            $derived = self::callSigner($gwConfig, '/derive-address', [
                'network' => $network,
                'index' => $nextIndex
            ]);

            if (empty($derived['success']) || empty($derived['address'])) {
                throw new RuntimeException('HD Signer derivation failed: ' . ($derived['error'] ?? 'unknown error'));
            }

            $depositId = 'hd_' . bin2hex(random_bytes(8));
            $ins = $db->prepare("
                INSERT INTO crypto_hd_deposits (
                    id, invoice_id, invoice_number, user_id, network_id, network, symbol, standard,
                    contract_address, decimals, derivation_index, derivation_path, deposit_address,
                    treasury_wallet, expected_amount, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $ins->execute([
                $depositId,
                $invoiceId,
                $invoiceNumber,
                $userId,
                $net['id'],
                $network,
                $net['symbol'],
                $net['standard'],
                $net['contract'] ?? '',
                (int)$net['decimals'],
                $nextIndex,
                $derived['derivationPath'],
                $derived['address'],
                $treasuryWallet,
                $expectedCryptoAmount
            ]);

            $db->commit();

            return [
                'id' => $depositId,
                'derivationIndex' => $nextIndex,
                'derivationPath' => $derived['derivationPath'],
                'depositAddress' => $derived['address'],
                'treasuryWallet' => $treasuryWallet
            ];
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Check on-chain balance directly on a dedicated per-order HD deposit address.
     * Because the address is unique to this order, any balance >= expectedAmount
     * proves payment without requiring the user to paste a TxHash.
     */
    public static function checkDedicatedHdAddressBalance(array $net, string $depositAddress, float $expectedAmount): array
    {
        $network = strtolower((string)$net['network']);
        $rpc = rtrim((string)$net['rpc'], '/');
        $decimals = (int)$net['decimals'];

        if ($network === 'bsc' || $network === 'ethereum' || $network === 'polygon') {
            if (!empty($net['contract'])) {
                // ERC20 / BEP20 balanceOf(address) -> selector 0x70a08231
                $paddedAddr = str_pad(ltrim(strtolower($depositAddress), '0x'), 64, '0', STR_PAD_LEFT);
                $res = self::httpJson($rpc, 'POST', [
                    'jsonrpc' => '2.0',
                    'id' => 1,
                    'method' => 'eth_call',
                    'params' => [['to' => $net['contract'], 'data' => '0x70a08231' . $paddedAddr], 'latest']
                ]);
                $bal = self::hexToFloat((string)($res['result'] ?? '0x0'), $decimals);
            } else {
                $res = self::httpJson($rpc, 'POST', [
                    'jsonrpc' => '2.0',
                    'id' => 1,
                    'method' => 'eth_getBalance',
                    'params' => [$depositAddress, 'latest']
                ]);
                $bal = self::hexToFloat((string)($res['result'] ?? '0x0'), $decimals);
            }

            return [
                'funded' => $bal >= ($expectedAmount * 0.995) && $bal > 0,
                'balance' => $bal,
                'syntheticRef' => 'hd_bal_' . $network . '_' . substr(md5(strtolower($depositAddress)), 0, 16)
            ];
        }

        if ($network === 'tron') {
            if (!empty($net['contract'])) {
                $events = self::httpJson(
                    "{$rpc}/v1/accounts/" . urlencode($depositAddress) . "/transactions/trc20?limit=10&only_to=true&contract_address=" . urlencode($net['contract']),
                    'GET'
                );
                $total = 0.0;
                $firstTx = '';
                foreach (($events['data'] ?? []) as $ev) {
                    $total += ((float)($ev['value'] ?? 0)) / pow(10, $decimals);
                    if ($firstTx === '' && !empty($ev['transaction_id'])) {
                        $firstTx = (string)$ev['transaction_id'];
                    }
                }
                return [
                    'funded' => $total >= ($expectedAmount * 0.995) && $total > 0,
                    'balance' => $total,
                    'txHash' => $firstTx
                ];
            } else {
                $acct = self::httpJson("{$rpc}/wallet/getaccount", 'POST', ['address' => $depositAddress, 'visible' => true]);
                $trxBal = ((float)($acct['balance'] ?? 0)) / 1e6;
                return [
                    'funded' => $trxBal >= ($expectedAmount * 0.995) && $trxBal > 0,
                    'balance' => $trxBal,
                    'syntheticRef' => 'hd_bal_tron_' . substr(md5($depositAddress), 0, 16)
                ];
            }
        }

        return ['funded' => false, 'balance' => 0.0];
    }

    /**
     * Mark HD deposit confirmed and immediately auto-sweep funds to Trust Wallet.
     */
    public static function markConfirmedAndAutoSweep(
        PDO $db,
        array $gwConfig,
        array $net,
        string $invoiceNumber,
        string $depositTxHash,
        float $receivedAmount
    ): array {
        self::ensureSchema($db);

        $stmt = $db->prepare("SELECT * FROM crypto_hd_deposits WHERE invoice_number = ? LIMIT 1");
        $stmt->execute([$invoiceNumber]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return ['swept' => false, 'reason' => 'Not an HD deposit invoice'];
        }

        if ($row['status'] === 'swept' && !empty($row['sweep_tx_hash'])) {
            return [
                'swept' => true,
                'sweepTxHash' => $row['sweep_tx_hash'],
                'treasuryWallet' => $row['treasury_wallet']
            ];
        }

        $db->prepare("
            UPDATE crypto_hd_deposits
            SET status = 'confirmed',
                deposit_tx_hash = COALESCE(deposit_tx_hash, ?),
                received_amount = ?,
                confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP)
            WHERE id = ? AND status IN ('pending', 'confirming', 'sweep_failed')
        ")->execute([$depositTxHash, $receivedAmount, $row['id']]);

        return self::executeSweep($db, $gwConfig, $net, $row);
    }

    /**
     * Execute sweep call against localhost signer-service -> Trust Wallet.
     */
    public static function executeSweep(PDO $db, array $gwConfig, array $net, array $row): array
    {
        $db->prepare("UPDATE crypto_hd_deposits SET status = 'sweeping', sweep_attempts = sweep_attempts + 1 WHERE id = ?")
           ->execute([$row['id']]);

        $res = self::callSigner($gwConfig, '/sweep', [
            'network' => $row['network'],
            'index' => (int)$row['derivation_index'],
            'tokenStandard' => $row['standard'],
            'contractAddress' => $row['contract_address'],
            'decimals' => (int)$row['decimals'],
            'toTreasuryAddress' => $row['treasury_wallet'],
            'rpcUrl' => $net['rpc'] ?? ''
        ]);

        if (!empty($res['success']) && !empty($res['sweepTxHash'])) {
            $db->prepare("
                UPDATE crypto_hd_deposits
                SET status = 'swept',
                    sweep_tx_hash = ?,
                    sweep_amount = ?,
                    sweep_error = NULL,
                    swept_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ")->execute([
                (string)$res['sweepTxHash'],
                (float)($res['sweptAmount'] ?? $row['received_amount']),
                $row['id']
            ]);

            return [
                'swept' => true,
                'sweepTxHash' => (string)$res['sweepTxHash'],
                'sweptAmount' => $res['sweptAmount'] ?? null,
                'treasuryWallet' => $row['treasury_wallet']
            ];
        }

        $err = (string)($res['error'] ?? 'Auto-sweep failed');
        $db->prepare("UPDATE crypto_hd_deposits SET status = 'sweep_failed', sweep_error = ? WHERE id = ?")
           ->execute([substr($err, 0, 500), $row['id']]);

        return ['swept' => false, 'error' => $err];
    }

    /**
     * Cron job: retry any confirmed or sweep_failed HD deposits so 100% of funds
     * reach Trust Wallet automatically.
     */
    public static function retryPendingSweeps(PDO $db, array $gwConfig): array
    {
        $summary = ['attempted' => 0, 'swept' => 0, 'failed' => 0, 'errors' => []];
        if (trim((string)($gwConfig['signer_url'] ?? '')) === '') {
            return $summary;
        }

        try {
            self::ensureSchema($db);
            $stmt = $db->prepare("
                SELECT * FROM crypto_hd_deposits
                WHERE status IN ('confirmed', 'sweep_failed')
                  AND sweep_attempts < 10
                ORDER BY confirmed_at ASC
                LIMIT 20
            ");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                $net = InHouseCryptoGateway::resolveNetwork($gwConfig, (string)$row['network_id']);
                if (!$net) continue;
                $summary['attempted']++;
                $res = self::executeSweep($db, $gwConfig, $net, $row);
                if (!empty($res['swept'])) {
                    $summary['swept']++;
                } else {
                    $summary['failed']++;
                    $summary['errors'][] = $row['invoice_number'] . ': ' . ($res['error'] ?? 'sweep failed');
                }
            }
        } catch (Throwable $e) {
            $summary['errors'][] = $e->getMessage();
        }
        return $summary;
    }

    public static function callSigner(array $gwConfig, string $path, array $payload): array
    {
        $baseUrl = rtrim(trim((string)($gwConfig['signer_url'] ?? 'http://127.0.0.1:3105')), '/');
        $apiKey = trim((string)($gwConfig['signer_api_key'] ?? ''));

        // Security guardrail: only transmit decrypted mnemonic over strict localhost loopback
        $host = strtolower((string)(parse_url($baseUrl, PHP_URL_HOST) ?? ''));
        $isLocalhost = in_array($host, ['127.0.0.1', 'localhost', '::1'], true);
        if (!$isLocalhost) {
            return ['success' => false, 'error' => 'Security blocked: Signer URL must be strictly 127.0.0.1 / localhost.'];
        }
        if (empty($payload['mnemonic'])) {
            $decrypted = self::resolveDecryptedMnemonic($gwConfig);
            if ($decrypted !== '') {
                $payload['mnemonic'] = $decrypted;
            }
        }

        $ch = curl_init($baseUrl . $path);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 35);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            return ['success' => false, 'error' => 'Signer connection failed: ' . $err];
        }
        $decoded = json_decode((string)$raw, true);
        return is_array($decoded) ? $decoded : ['success' => false, 'error' => 'Invalid signer JSON response'];
    }

    private static function httpJson(string $url, string $method = 'GET', $body = null): array
    {
        $ch = curl_init($url);
        $headers = ['Accept: application/json', 'User-Agent: AntiProfiles-HdSweep/1.0'];
        if ($method === 'POST') {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body ?? (object)[]));
        }
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $raw = curl_exec($ch);
        curl_close($ch);
        $decoded = json_decode((string)$raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function hexToFloat(string $hex, int $decimals): float
    {
        $clean = ltrim(strtolower(preg_replace('/^0x/', '', $hex)), '0');
        if ($clean === '') return 0.0;
        $val = 0.0;
        for ($i = 0; $i < strlen($clean); $i++) {
            $val = $val * 16 + hexdec($clean[$i]);
        }
        return $val / pow(10, $decimals);
    }
}
