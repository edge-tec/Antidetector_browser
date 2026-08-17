<?php
// ──────────────────────────────────────────────
// ProfileVault — Central Production Payment Gateway & Webhook API
// Supports: Stripe + Cryptocurrency (NOWPayments / Cryptomus)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

$db = Database::getConnection();

// Helper: Fetch Gateway Configuration
function getPaymentGatewayConfig(PDO $db, string $key): ?array {
    $stmt = $db->prepare("SELECT * FROM payment_gateways WHERE gateway_key = ?");
    $stmt->execute([$key]);
    $gw = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$gw) return null;
    $gw['config'] = json_decode($gw['config_json'] ?? '{}', true) ?: [];
    return $gw;
}

// Helper: Call Stripe API with cURL
function callStripeApi(string $secretKey, string $endpoint, string $method = 'POST', array $data = []): array {
    $url = 'https://api.stripe.com/v1/' . ltrim($endpoint, '/');
    $ch = curl_init();
    
    $headers = [
        'Authorization: Bearer ' . trim($secretKey),
        'User-Agent: ProfileVault-Stripe/1.0',
    ];

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    } else {
        if (!empty($data)) {
            $url .= '?' . http_build_query($data);
        }
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'error' => 'Stripe connection failed: ' . $curlError, 'httpCode' => $httpCode];
    }

    $json = json_decode($response, true);
    if ($httpCode >= 200 && $httpCode < 300 && $json) {
        return ['success' => true, 'data' => $json, 'httpCode' => $httpCode];
    }

    $errMsg = $json['error']['message'] ?? ('Stripe API returned error code ' . $httpCode);
    return ['success' => false, 'error' => $errMsg, 'data' => $json, 'httpCode' => $httpCode];
}

// Helper: Verify Stripe Webhook Cryptographic Signature
function verifyStripeWebhookSignature(string $rawPayload, string $sigHeader, string $secret): bool {
    if (empty($sigHeader) || empty($secret)) return false;

    $items = explode(',', $sigHeader);
    $timestamp = null;
    $signatures = [];

    foreach ($items as $item) {
        $parts = explode('=', trim($item), 2);
        if (count($parts) === 2) {
            if ($parts[0] === 't') {
                $timestamp = $parts[1];
            } elseif ($parts[0] === 'v1') {
                $signatures[] = $parts[1];
            }
        }
    }

    if (!$timestamp || empty($signatures)) return false;

    // Reject events older than 10 minutes (replay protection)
    if (abs(time() - (int)$timestamp) > 600) {
        return false;
    }

    $signedPayload = $timestamp . '.' . $rawPayload;
    $computedSig = hash_hmac('sha256', $signedPayload, trim($secret));

    foreach ($signatures as $sig) {
        if (hash_equals($computedSig, $sig)) {
            return true;
        }
    }
    return false;
}

// Helper: Idempotent Payment & Subscription Processing
function processSuccessfulPayment(
    PDO $db,
    string $provider,
    string $eventId,
    string $eventType,
    string $invoiceIdOrNum,
    string $providerPaymentId,
    string $transactionId,
    float $amount,
    string $currency,
    ?array $metadata = []
): array {
    // 1. Idempotency Check: Was this webhook event already processed?
    $checkEvt = $db->prepare("SELECT id, status FROM payment_events WHERE provider = ? AND event_id = ?");
    $checkEvt->execute([$provider, $eventId]);
    $existingEvt = $checkEvt->fetch(PDO::FETCH_ASSOC);

    if ($existingEvt) {
        return [
            'success' => true,
            'idempotent' => true,
            'message' => 'Event already processed.'
        ];
    }

    // 2. Fetch the corresponding invoice
    $invStmt = $db->prepare("SELECT * FROM invoices WHERE id = ? OR invoice_number = ? FOR UPDATE");
    $invStmt->execute([$invoiceIdOrNum, $invoiceIdOrNum]);
    $invoice = $invStmt->fetch(PDO::FETCH_ASSOC);

    if (!$invoice) {
        // Log event as failed due to missing invoice
        $insEvt = $db->prepare("
            INSERT INTO payment_events (id, provider, event_id, event_type, invoice_id, payload, status, error_message, received_at, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, 'failed', 'Invoice not found', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $insEvt->execute([
            'pevt_' . bin2hex(random_bytes(8)),
            $provider,
            $eventId,
            $eventType,
            $invoiceIdOrNum,
            json_encode($metadata)
        ]);
        return ['success' => false, 'error' => 'Invoice not found: ' . $invoiceIdOrNum];
    }

    $userId = $invoice['user_id'];
    $planId = $invoice['plan_id'];

    // 3. Execute Atomic Database Updates
    $db->beginTransaction();
    try {
        // A. Record Webhook Event (Guarantees Idempotency)
        $pevtId = 'pevt_' . bin2hex(random_bytes(8));
        $insEvt = $db->prepare("
            INSERT INTO payment_events (id, provider, event_id, event_type, invoice_id, payload, status, received_at, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, 'processed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $insEvt->execute([
            $pevtId,
            $provider,
            $eventId,
            $eventType,
            $invoice['id'],
            json_encode($metadata)
        ]);

        // B. Update Invoice to 'paid'
        $updInv = $db->prepare("
            UPDATE invoices SET
                status = 'paid',
                paid_at = CURRENT_TIMESTAMP,
                transaction_id = ?,
                gateway = ?
            WHERE id = ?
        ");
        $updInv->execute([$transactionId, $provider, $invoice['id']]);

        // C. Record / Update Payment Record
        $payId = 'pay_' . bin2hex(random_bytes(8));
        $insPay = $db->prepare("
            INSERT INTO payments (id, user_id, invoice_id, package_id, transaction_id, provider_payment_id, amount, amount_cents, currency, gateway, status, payment_method, metadata, paid_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE status = 'paid', paid_at = CURRENT_TIMESTAMP, transaction_id = VALUES(transaction_id)
        ");
        $insPay->execute([
            $payId,
            $userId,
            $invoice['id'],
            $planId,
            $transactionId,
            $providerPaymentId,
            $amount,
            (int)round($amount * 100),
            $currency,
            $provider,
            $metadata['payment_method'] ?? 'card',
            json_encode($metadata)
        ]);

        // D. Resolve Plan Details for Limits & Quotas
        $planStmt = $db->prepare("SELECT * FROM pricing_plans WHERE id = ?");
        $planStmt->execute([$planId]);
        $plan = $planStmt->fetch(PDO::FETCH_ASSOC) ?: [
            'id' => $planId,
            'name' => ucfirst(str_replace('plan_', '', $planId)),
            'profile_limit' => 25,
            'team_limit' => 2
        ];

        // E. Activate / Extend User Subscription
        $subStmt = $db->prepare("SELECT * FROM subscriptions WHERE user_id = ? FOR UPDATE");
        $subStmt->execute([$userId]);
        $sub = $subStmt->fetch(PDO::FETCH_ASSOC);

        $newExpiry = date('Y-m-d H:i:s', strtotime('+30 days'));
        $targetDeviceLimit = (int)($plan['team_limit'] ?? 2);

        if (!$sub) {
            $subId = 'sub_' . $userId;
            $insSub = $db->prepare("
                INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days, device_limit)
                VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, 3, ?)
            ");
            $insSub->execute([$subId, $userId, $planId, $newExpiry, $targetDeviceLimit]);
        } else {
            // If already active and not expired, extend from current expiry
            if ($sub['status'] === 'active' && strtotime($sub['expires_at']) > time()) {
                $newExpiry = date('Y-m-d H:i:s', strtotime($sub['expires_at'] . ' +30 days'));
            }
            $updSub = $db->prepare("
                UPDATE subscriptions SET
                    plan_id = ?,
                    status = 'active',
                    expires_at = ?,
                    device_limit = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ");
            $updSub->execute([$planId, $newExpiry, $targetDeviceLimit, $userId]);
        }

        // F. Bump User Auth Version for Real-time Sync
        $db->prepare("UPDATE users SET auth_version = auth_version + 1 WHERE id = ?")->execute([$userId]);
        $verStmt = $db->prepare("SELECT auth_version FROM users WHERE id = ?");
        $verStmt->execute([$userId]);
        $newVer = (int)($verStmt->fetchColumn() ?: 1);

        // G. Log Admin / System Audit Log
        logAdminAction('system', 'payment-gateway', 'PAYMENT_RECEIVED', $userId, "Gateway: $provider, Amount: $$amount, Invoice: {$invoice['invoice_number']}, Plan: $planId");

        // H. Broadcast Real-Time Events (Web + Desktop Clients)
        publishRealtimeEvent($db, $userId, 'payment.completed', [
            'type' => 'payment.completed',
            'userId' => $userId,
            'invoiceId' => $invoice['id'],
            'invoiceNumber' => $invoice['invoice_number'],
            'planId' => $planId,
            'planName' => $plan['name'],
            'amount' => $amount,
            'currency' => $currency,
            'expiresAt' => $newExpiry,
            'timestamp' => date('c')
        ], null, $newVer);

        publishRealtimeEvent($db, $userId, 'subscription.updated', [
            'type' => 'subscription.updated',
            'userId' => $userId,
            'planId' => $planId,
            'status' => 'active',
            'expiresAt' => $newExpiry,
            'deviceLimit' => $targetDeviceLimit,
            'version' => $newVer,
            'timestamp' => date('c')
        ], null, $newVer);

        publishRealtimeEvent($db, $userId, 'device.limit.updated', [
            'type' => 'device.limit.updated',
            'userId' => $userId,
            'deviceLimit' => $targetDeviceLimit,
            'version' => $newVer,
            'timestamp' => date('c')
        ], null, $newVer);

        // I. Send Purchase Confirmation & Invoice Email
        try {
            $uStmt = $db->prepare("SELECT id, name, email FROM users WHERE id = ?");
            $uStmt->execute([$userId]);
            $userRow = $uStmt->fetch(PDO::FETCH_ASSOC);
            if ($userRow && !empty($userRow['email'])) {
                sendPurchaseConfirmationEmailPhp($userId, $userRow['name'] ?? 'Customer', $userRow['email'], [
                    'plan_name' => $plan['name'],
                    'amount' => $amount,
                    'currency' => $currency,
                    'transaction_id' => $transactionId ?: $invoice['invoice_number'],
                    'purchase_date' => date('Y-m-d H:i:s T'),
                    'profile_limit' => $plan['profile_limit'] ?? 10
                ]);
            }
        } catch (Throwable $mailEx) {
            error_log("[AntiProfiles Payment Email Error] " . $mailEx->getMessage());
        }

        $db->commit();
        return [
            'success' => true,
            'invoice' => $invoice['invoice_number'],
            'plan' => $plan['name'],
            'expiresAt' => $newExpiry
        ];
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        return ['success' => false, 'error' => 'Failed to process payment: ' . $e->getMessage()];
    }
}

// ──────────────────────────────────────────────
// API REQUEST DISPATCHER
// ──────────────────────────────────────────────
$action = $_GET['action'] ?? '';

switch ($action) {

    // ── 1. Get Enabled Public Gateways (No Secrets Exposing) ──
    case 'public-gateways':
        ensureDatabaseTablesExist($db);
        $stmt = $db->prepare("SELECT gateway_key, name, is_enabled, is_test_mode, public_key, currency, config_json FROM payment_gateways WHERE is_enabled = 1");
        $stmt->execute();
        $gateways = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fallback: If no gateway is explicitly marked is_enabled=1 yet, fetch all available seeded gateways
        if (empty($gateways)) {
            $stmt = $db->prepare("SELECT gateway_key, name, is_enabled, is_test_mode, public_key, currency, config_json FROM payment_gateways ORDER BY id ASC");
            $stmt->execute();
            $gateways = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $result = [];
        foreach ($gateways as $gw) {
            $conf = json_decode($gw['config_json'] ?? '{}', true) ?: [];
            $result[] = [
                'gateway_key' => $gw['gateway_key'],
                'key' => $gw['gateway_key'],
                'name' => $gw['name'],
                'is_enabled' => (bool)$gw['is_enabled'],
                'is_test_mode' => (bool)$gw['is_test_mode'],
                'isTestMode' => (bool)$gw['is_test_mode'],
                'public_key' => $gw['public_key'] ?: '',
                'publicKey' => $gw['public_key'] ?: '',
                'currency' => $gw['currency'] ?: 'USD',
                'supportedCoins' => $conf['supported_coins'] ?? ['BTC', 'USDT', 'ETH', 'USDC'],
                'minAmount' => (float)($conf['min_amount'] ?? 5.0)
            ];
        }
        respondJson([
            'success' => true,
            'data' => $result,
            'gateways' => $result
        ]);
        break;

    // ── 2. Create Checkout Session / Order ──
    case 'create-checkout':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required. Please sign in.'], 401);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $planId = trim($input['plan_id'] ?? $input['planId'] ?? '');
        $gatewayKey = trim($input['gateway'] ?? 'stripe');

        if (!$planId) {
            respondJson(['success' => false, 'error' => 'Plan selection is required.'], 400);
        }

        // Fetch Plan Details
        $planStmt = $db->prepare("SELECT * FROM pricing_plans WHERE id = ?");
        $planStmt->execute([$planId]);
        $plan = $planStmt->fetch(PDO::FETCH_ASSOC);

        if (!$plan) {
            respondJson(['success' => false, 'error' => 'Selected pricing plan is invalid.'], 404);
        }

        $amount = (float)($plan['monthly_price'] ?? 19.00);
        $amountCents = (int)round($amount * 100);

        // Fetch Gateway Configuration
        $gw = getPaymentGatewayConfig($db, $gatewayKey);
        if (!$gw || !$gw['is_enabled']) {
            respondJson(['success' => false, 'error' => "Payment gateway '{$gatewayKey}' is currently unavailable or disabled by administrator."], 400);
        }

        // Generate Unique Invoice
        $invId = 'inv_' . bin2hex(random_bytes(8));
        $invNumber = 'INV-' . date('Y') . '-' . strtoupper(bin2hex(random_bytes(3)));

        $insInv = $db->prepare("
            INSERT INTO invoices (id, invoice_number, user_id, plan_id, amount, amount_cents, currency, status, gateway, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 HOUR))
        ");
        $insInv->execute([
            $invId,
            $invNumber,
            $user['id'],
            $planId,
            $amount,
            $amountCents,
            $gw['currency'] ?: 'USD',
            $gatewayKey
        ]);

        // Route to Provider Implementation
        if ($gatewayKey === 'stripe') {
            $secretKey = trim($gw['secret_key'] ?? '');
            if (!$secretKey) {
                respondJson(['success' => false, 'error' => 'Stripe is enabled but Secret Key is missing in admin configuration.'], 500);
            }

            $baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'antiprofiles.com');
            $successUrl = $baseUrl . '/#pricing?payment_status=success&invoice=' . $invNumber;
            $cancelUrl = $baseUrl . '/#pricing?payment_status=cancelled&invoice=' . $invNumber;

            $checkoutData = [
                'payment_method_types' => ['card'],
                'mode' => 'payment',
                'customer_email' => $user['email'],
                'client_reference_id' => $invNumber,
                'line_items' => [
                    [
                        'price_data' => [
                            'currency' => strtolower($gw['currency'] ?: 'usd'),
                            'product_data' => [
                                'name' => 'ProfileVault ' . $plan['name'] . ' Subscription',
                                'description' => 'Unlimited anti-detect browser profiles & fingerprints quota',
                            ],
                            'unit_amount' => $amountCents,
                        ],
                        'quantity' => 1,
                    ]
                ],
                'metadata' => [
                    'user_id' => $user['id'],
                    'invoice_id' => $invId,
                    'invoice_number' => $invNumber,
                    'plan_id' => $planId,
                ],
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl
            ];

            $stripeRes = callStripeApi($secretKey, 'checkout/sessions', 'POST', $checkoutData);
            if (!$stripeRes['success']) {
                respondJson(['success' => false, 'error' => 'Stripe Checkout generation failed: ' . $stripeRes['error']], 500);
            }

            $session = $stripeRes['data'];
            respondJson([
                'success' => true,
                'gateway' => 'stripe',
                'invoiceNumber' => $invNumber,
                'checkoutUrl' => $session['url'] ?? '',
                'sessionId' => $session['id'] ?? '',
                'amount' => $amount,
                'currency' => $gw['currency'] ?: 'USD'
            ]);
        } elseif ($gatewayKey === 'crypto') {
            $cryptoApiKey = trim($gw['secret_key'] ?? '');
            $provider = $gw['config']['provider'] ?? 'nowpayments';
            $coin = $input['coin'] ?? 'USDT';

            // NOWPayments or Cryptomus provider flow
            if ($cryptoApiKey && $provider === 'nowpayments') {
                $ch = curl_init('https://api.nowpayments.io/v1/payment');
                $payload = json_encode([
                    'price_amount' => $amount,
                    'price_currency' => strtolower($gw['currency'] ?: 'usd'),
                    'pay_currency' => strtolower($coin),
                    'order_id' => $invNumber,
                    'order_description' => 'ProfileVault ' . $plan['name'] . ' Plan',
                    'ipn_callback_url' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'antiprofiles.com') . '/api/payments/crypto/webhook'
                ]);

                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'x-api-key: ' . $cryptoApiKey,
                    'Content-Type: application/json'
                ]);
                $resp = curl_exec($ch);
                curl_close($ch);

                $json = json_decode($resp, true);
                if (!empty($json['pay_address'])) {
                    respondJson([
                        'success' => true,
                        'gateway' => 'crypto',
                        'invoiceNumber' => $invNumber,
                        'payAddress' => $json['pay_address'],
                        'payAmount' => $json['pay_amount'] ?? $amount,
                        'payCoin' => strtoupper($coin),
                        'paymentId' => $json['payment_id'] ?? '',
                        'qrUrl' => "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" . urlencode($json['pay_address']),
                        'expiresAt' => date('Y-m-d H:i:s', strtotime('+2 hours'))
                    ]);
                }
            }

            // Clean fallback direct crypto payment invoice
            $depositAddress = $gw['config']['wallet_address'] ?? 'TYsB... (Configured in Admin Gateway Manager)';
            respondJson([
                'success' => true,
                'gateway' => 'crypto',
                'invoiceNumber' => $invNumber,
                'payAddress' => $depositAddress,
                'payAmount' => $amount,
                'payCoin' => strtoupper($coin),
                'qrUrl' => "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" . urlencode($depositAddress),
                'instructions' => 'Send exact amount to the address above. Subscription will activate immediately upon network confirmation.'
            ]);
        } else {
            respondJson(['success' => false, 'error' => "Unsupported gateway: {$gatewayKey}"], 400);
        }
        break;

    // ── 3. Check Payment & Invoice Status ──
    case 'status':
        $invNumber = $_GET['invoice'] ?? $_GET['invoice_id'] ?? '';
        if (!$invNumber) {
            respondJson(['success' => false, 'error' => 'Invoice parameter is required.'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM invoices WHERE invoice_number = ? OR id = ?");
        $stmt->execute([$invNumber, $invNumber]);
        $inv = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$inv) {
            respondJson(['success' => false, 'error' => 'Invoice not found.'], 404);
        }

        respondJson([
            'success' => true,
            'invoice' => [
                'id' => $inv['id'],
                'invoiceNumber' => $inv['invoice_number'],
                'status' => $inv['status'],
                'amount' => (float)$inv['amount'],
                'currency' => $inv['currency'],
                'planId' => $inv['plan_id'],
                'gateway' => $inv['gateway'],
                'paidAt' => $inv['paid_at'],
                'createdAt' => $inv['created_at']
            ]
        ]);
        break;

    // ── 4. Official Stripe Webhook Handler ──
    case 'stripe/webhook':
    case 'stripe-webhook':
        $rawPayload = file_get_contents('php://input');
        $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

        $gw = getPaymentGatewayConfig($db, 'stripe');
        if (!$gw || empty($gw['webhook_secret'])) {
            http_response_code(400);
            respondJson(['success' => false, 'error' => 'Stripe webhook secret is not configured in Admin Control Panel.'], 400);
        }

        // Cryptographic Signature Verification
        if (!verifyStripeWebhookSignature($rawPayload, $sigHeader, $gw['webhook_secret'])) {
            http_response_code(400);
            respondJson(['success' => false, 'error' => 'Invalid or forged Stripe webhook signature.'], 400);
        }

        $event = json_decode($rawPayload, true);
        if (!$event || empty($event['type'])) {
            http_response_code(400);
            respondJson(['success' => false, 'error' => 'Invalid JSON webhook payload.'], 400);
        }

        $eventId = $event['id'] ?? ('evt_' . bin2hex(random_bytes(8)));
        $eventType = $event['type'];
        $obj = $event['data']['object'] ?? [];

        if ($eventType === 'checkout.session.completed') {
            $invoiceNumber = $obj['client_reference_id'] ?? ($obj['metadata']['invoice_number'] ?? '');
            $transactionId = $obj['payment_intent'] ?? $obj['id'] ?? '';
            $amount = ($obj['amount_total'] ?? 0) / 100;
            $currency = strtoupper($obj['currency'] ?? 'USD');

            $res = processSuccessfulPayment(
                $db,
                'stripe',
                $eventId,
                $eventType,
                $invoiceNumber,
                $obj['id'] ?? '',
                $transactionId,
                $amount,
                $currency,
                ['payment_method' => 'card', 'customer_email' => $obj['customer_email'] ?? '']
            );

            http_response_code(200);
            respondJson(['success' => true, 'processed' => true, 'result' => $res]);
        } elseif ($eventType === 'payment_intent.succeeded') {
            $invoiceNumber = $obj['metadata']['invoice_number'] ?? '';
            if ($invoiceNumber) {
                $res = processSuccessfulPayment(
                    $db,
                    'stripe',
                    $eventId,
                    $eventType,
                    $invoiceNumber,
                    $obj['id'],
                    $obj['id'],
                    ($obj['amount'] ?? 0) / 100,
                    strtoupper($obj['currency'] ?? 'USD'),
                    ['payment_method' => 'card']
                );
            }
            http_response_code(200);
            respondJson(['success' => true, 'received' => true]);
        } elseif ($eventType === 'charge.refunded') {
            // Handle Stripe Refund event
            $chargeId = $obj['id'] ?? '';
            $db->prepare("UPDATE payments SET status = 'refunded' WHERE transaction_id = ? OR provider_payment_id = ?")->execute([$chargeId, $chargeId]);
            http_response_code(200);
            respondJson(['success' => true, 'refund_recorded' => true]);
        } else {
            // Acknowledge other Stripe events
            http_response_code(200);
            respondJson(['success' => true, 'status' => 'ignored']);
        }
        break;

    // ── 5. Official Cryptocurrency IPN / Webhook Handler ──
    case 'crypto/webhook':
    case 'crypto-webhook':
        $rawPayload = file_get_contents('php://input');
        $gw = getPaymentGatewayConfig($db, 'crypto');
        $event = json_decode($rawPayload, true) ?: $_POST;

        $paymentStatus = strtolower($event['payment_status'] ?? $event['status'] ?? '');
        $orderId = $event['order_id'] ?? $event['invoice_id'] ?? '';
        $paymentId = (string)($event['payment_id'] ?? $event['id'] ?? bin2hex(random_bytes(8)));
        $amount = (float)($event['price_amount'] ?? $event['pay_amount'] ?? 0);
        $currency = strtoupper($event['price_currency'] ?? 'USD');

        // Check if payment is confirmed
        if (in_array($paymentStatus, ['finished', 'confirmed', 'paid', 'completed'])) {
            $res = processSuccessfulPayment(
                $db,
                'crypto',
                'crypto_' . $paymentId,
                'crypto.payment.confirmed',
                $orderId,
                $paymentId,
                $event['pay_address'] ?? $paymentId,
                $amount,
                $currency,
                $event
            );
            respondJson(['success' => true, 'result' => $res]);
        } else {
            respondJson(['success' => true, 'status' => 'pending_confirmation']);
        }
        break;

    default:
        respondJson(['success' => false, 'error' => "Unknown payment action: '{$action}'."], 404);
        break;
}
