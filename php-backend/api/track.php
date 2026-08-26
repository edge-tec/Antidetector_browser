<?php
// ──────────────────────────────────────────────
// AntiProfiles — Public CPA Click Tracker & Redirection Endpoint
// Route: /track?aff_id=AFF-10025&offer_id=offer_pro&click_id=...&sub_id1=...
// ──────────────────────────────────────────────

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

$affId = isset($_GET['aff_id']) ? trim($_GET['aff_id']) : (isset($_GET['ref']) ? trim($_GET['ref']) : '');
$offerId = isset($_GET['offer_id']) ? trim($_GET['offer_id']) : 'offer_main_saas';
$subId1 = isset($_GET['sub_id1']) ? trim($_GET['sub_id1']) : '';
$subId2 = isset($_GET['sub_id2']) ? trim($_GET['sub_id2']) : '';
$subId3 = isset($_GET['sub_id3']) ? trim($_GET['sub_id3']) : '';
$subId4 = isset($_GET['sub_id4']) ? trim($_GET['sub_id4']) : '';
$subId5 = isset($_GET['sub_id5']) ? trim($_GET['sub_id5']) : '';

// Generate or use immutable click ID
$clickId = isset($_GET['click_id']) && !empty(trim($_GET['click_id']))
    ? trim($_GET['click_id'])
    : 'clk_' . round(microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(4)), 0, 8);

$ipAddress = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($ipAddress, ',') !== false) {
    $ipAddress = trim(explode(',', $ipAddress)[0]);
}
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$referrer = $_SERVER['HTTP_REFERER'] ?? '';

$targetUrl = 'https://antiprofiles.com/pricing';

try {
    $db = getDbConnection();

    // 1. Resolve Offer
    $stmtOffer = $db->prepare("SELECT * FROM affiliate_offers WHERE id = ? AND status = 'active' LIMIT 1");
    $stmtOffer->execute([$offerId]);
    $offer = $stmtOffer->fetch();

    if (!$offer) {
        $stmtDefault = $db->query("SELECT * FROM affiliate_offers WHERE status = 'active' LIMIT 1");
        $offer = $stmtDefault->fetch();
    }

    if ($offer && !empty($offer['target_url'])) {
        $targetUrl = $offer['target_url'];
    }

    // 2. Record Click (Idempotent by click_id)
    $stmtClick = $db->prepare("
        INSERT IGNORE INTO affiliate_clicks (
            click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, landing_url,
            sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, created_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, NOW()
        )
    ");
    $stmtClick->execute([
        $clickId, $affId, $offer ? $offer['id'] : $offerId, $ipAddress, $userAgent, $referrer, $targetUrl,
        $subId1 ?: null, $subId2 ?: null, $subId3 ?: null, $subId4 ?: null, $subId5 ?: null
    ]);

    if ($offer) {
        $db->prepare("UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?")->execute([$offer['id']]);
    }
} catch (Exception $e) {
    error_log('[CPA Track] Error recording click: ' . $e->getMessage());
}

// Preserve click_id, aff_id, offer_id in destination redirect
$parsed = parse_url($targetUrl);
$query = [];
if (!empty($parsed['query'])) {
    parse_str($parsed['query'], $query);
}
$query['click_id'] = $clickId;
$query['aff_id'] = $affId;
$query['offer_id'] = $offerId;
if ($subId1) $query['sub_id1'] = $subId1;

$scheme   = isset($parsed['scheme']) ? $parsed['scheme'] . '://' : 'https://';
$host     = isset($parsed['host']) ? $parsed['host'] : 'antiprofiles.com';
$port     = isset($parsed['port']) ? ':' . $parsed['port'] : '';
$path     = isset($parsed['path']) ? $parsed['path'] : '/';
$newQuery = '?' . http_build_query($query);
$fragment = isset($parsed['fragment']) ? '#' . $parsed['fragment'] : '';

$finalDestination = "$scheme$host$port$path$newQuery$fragment";

// 302 Redirect
header("Location: $finalDestination", true, 302);
exit();
