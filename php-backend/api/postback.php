<?php
// ──────────────────────────────────────────────
// AntiProfiles — Public Server-to-Server CPA Postback & Conversion Receiver
// Route: /api/postback?click_id={CLICK_ID}&payout={PAYOUT}&order_amount={AMOUNT}&status=approved
// ──────────────────────────────────────────────

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$clickId = trim($_GET['click_id'] ?? $input['click_id'] ?? '');
$orderAmount = floatval($_GET['order_amount'] ?? $_GET['amount'] ?? $input['order_amount'] ?? $input['amount'] ?? 0.0);
$payoutAmount = floatval($_GET['payout'] ?? $input['payout'] ?? 0.0);
$currency = strtoupper(trim($_GET['currency'] ?? $input['currency'] ?? 'USD'));
$idempotencyKey = trim($_GET['tx_id'] ?? $_GET['idempotency_key'] ?? $input['idempotency_key'] ?? '');

if (empty($clickId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required click_id parameter']);
    exit();
}

try {
    $db = getDbConnection();

    // 1. Check duplicate conversion by click_id or idempotency_key
    $stmtCheck = $db->prepare("SELECT * FROM affiliate_conversions WHERE click_id = ? LIMIT 1");
    $stmtCheck->execute([$clickId]);
    $existing = $stmtCheck->fetch();

    if ($existing) {
        echo json_encode([
            'success' => true,
            'message' => 'Conversion already recorded (idempotent)',
            'conversion_id' => $existing['conversion_id']
        ]);
        exit();
    }

    // 2. Lookup original click
    $stmtClick = $db->prepare("SELECT * FROM affiliate_clicks WHERE click_id = ? LIMIT 1");
    $stmtClick->execute([$clickId]);
    $click = $stmtClick->fetch();

    if (!$click) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => "Click ID not found"]);
        exit();
    }

    $affiliateId = $click['affiliate_id'];
    $offerId = $click['offer_id'];

    // 3. Lookup Offer & Commission Calculation
    $stmtOffer = $db->prepare("SELECT * FROM affiliate_offers WHERE id = ? LIMIT 1");
    $stmtOffer->execute([$offerId]);
    $offer = $stmtOffer->fetch();

    if ($payoutAmount <= 0) {
        if ($offer) {
            if ($offer['payout_type'] === 'fixed') {
                $payoutAmount = floatval($offer['fixed_payout_usd']);
            } else {
                $rate = floatval($offer['commission_rate'] ?: 10.0);
                $payoutAmount = round($orderAmount * ($rate / 100), 2);
            }
        } else {
            $payoutAmount = round($orderAmount * 0.10, 2);
        }
    }

    $conversionId = 'conv_' . round(microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(4)), 0, 8);

    // 4. Record Conversion & Update Click
    $db->beginTransaction();

    $db->prepare("
        UPDATE affiliate_clicks
        SET converted = 1, conversion_id = ?, conversion_at = NOW()
        WHERE click_id = ?
    ")->execute([$conversionId, $clickId]);

    $stmtConv = $db->prepare("
        INSERT INTO affiliate_conversions (
            conversion_id, click_id, affiliate_id, offer_id, order_amount, payout_amount,
            currency, status, idempotency_key, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, 'approved', ?, NOW(), NOW()
        )
    ");
    $stmtConv->execute([
        $conversionId, $clickId, $affiliateId, $offerId, $orderAmount, $payoutAmount,
        $currency, $idempotencyKey ?: null
    ]);

    if ($offer) {
        $db->prepare("UPDATE affiliate_offers SET total_conversions = total_conversions + 1 WHERE id = ?")->execute([$offer['id']]);
    }

    // Lookup affiliate user to credit balance
    $stmtUser = $db->prepare("SELECT id FROM users WHERE affiliate_id = ? OR referral_code = ? LIMIT 1");
    $stmtUser->execute([$affiliateId, $affiliateId]);
    $affUser = $stmtUser->fetch();

    if ($affUser && $payoutAmount > 0) {
        $commId = 'comm_' . round(microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(4)), 0, 7);
        $db->prepare("
            INSERT INTO affiliate_commissions (
                id, referrer_user_id, referred_user_id, payment_id, order_amount,
                commission_rate, commission_amount, status, available_at, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, 'available', NOW(), NOW(), NOW()
            )
        ")->execute([
            $commId, $affUser['id'], $affUser['id'], $conversionId, $orderAmount,
            $offer ? $offer['commission_rate'] : 10, $payoutAmount
        ]);
    }

    $db->commit();

    // 5. Fire Affiliate Postback webhook if configured
    $stmtPb = $db->prepare("SELECT * FROM affiliate_postback_configs WHERE affiliate_id = ? AND is_active = 1 LIMIT 1");
    $stmtPb->execute([$affiliateId]);
    $pbConfig = $stmtPb->fetch();

    if ($pbConfig && !empty($pbConfig['postback_url'])) {
        $renderedUrl = str_ireplace(
            ['{CLICK_ID}', '{AFFILIATE_ID}', '{OFFER_ID}', '{CONVERSION_ID}', '{STATUS}', '{PAYOUT}', '{AMOUNT}'],
            [urlencode($clickId), urlencode($affiliateId), urlencode($offerId), urlencode($conversionId), 'approved', urlencode($payoutAmount), urlencode($orderAmount)],
            $pbConfig['postback_url']
        );

        $ch = curl_init($renderedUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_USERAGENT, 'AntiProfiles-CPA-Postback/1.0');
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $pbStatus = ($httpCode >= 200 && $httpCode < 300) ? 'confirmed' : 'failed';
        $pbId = 'pb_' . round(microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(4)), 0, 7);

        $stmtLog = $db->prepare("
            INSERT INTO affiliate_postbacks (
                id, conversion_id, click_id, affiliate_id, url, http_method, http_status,
                response_body, attempt_count, status, error_message, last_attempt_at, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, 'GET', ?,
                ?, 1, ?, ?, NOW(), NOW()
            )
        ");
        $stmtLog->execute([
            $pbId, $conversionId, $clickId, $affiliateId, $renderedUrl, $httpCode ?: null,
            substr($response ?: '', 0, 500), $pbStatus, $curlError ?: null
        ]);
    }

    echo json_encode([
        'success' => true,
        'conversion_id' => $conversionId,
        'payout' => $payoutAmount,
        'currency' => $currency
    ]);
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
