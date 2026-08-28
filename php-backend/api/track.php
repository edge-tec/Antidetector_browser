<?php
// ──────────────────────────────────────────────
// AntiProfiles — Public CPA Click Tracker & Redirection Endpoint
// Route: /track?aff_id=AFF-10025&offer_id=offer_pro&click_id=...&sub_id1=...
// Also supports /r/{refCode} or /track/{affId}
// ──────────────────────────────────────────────

// When loaded from index.php, helpers.php is already loaded.
// When loaded standalone, load it now.
if (!function_exists('ensureDatabaseTablesExist')) {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../db.php';
    require_once __DIR__ . '/../helpers.php';
}

$db = Database::getConnection();

// Extract parameters from Query String or URI path
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$pathAffId = '';
if (preg_match('#^/(?:r|track)/([^/?]+)#i', $requestUri, $matches)) {
    $pathAffId = trim($matches[1]);
}

$affId = isset($_GET['aff_id']) ? trim($_GET['aff_id']) : (isset($_GET['ref']) ? trim($_GET['ref']) : $pathAffId);
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

// Determine Base Origin
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
$baseOrigin = defined('APP_URL') && !empty(APP_URL) ? rtrim(APP_URL, '/') : "$scheme://$host";

$targetUrl = "$baseOrigin/#pricing";
$resolvedOfferId = $offerId;

try {
    // 1. Resolve Affiliate from referral code or affiliate_id
    if (!empty($affId)) {
        $uStmt = $db->prepare("SELECT affiliate_id, referral_code FROM users WHERE affiliate_id = ? OR referral_code = ? LIMIT 1");
        $uStmt->execute([$affId, $affId]);
        $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
        if ($uRow && !empty($uRow['affiliate_id'])) {
            $affId = $uRow['affiliate_id'];
        }
    }

    // 2. Resolve Offer
    $offer = null;
    try {
        $stmtOffer = $db->prepare("SELECT * FROM affiliate_offers WHERE id = ? AND status = 'active' LIMIT 1");
        $stmtOffer->execute([$offerId]);
        $offer = $stmtOffer->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {}

    if (!$offer) {
        try {
            $stmtDefault = $db->query("SELECT * FROM affiliate_offers WHERE status = 'active' ORDER BY created_at ASC LIMIT 1");
            $offer = $stmtDefault->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {}
    }

    if ($offer) {
        $resolvedOfferId = $offer['id'];
        if (!empty($offer['target_url'])) {
            $rawTarget = trim($offer['target_url']);
            if (strpos($rawTarget, 'http://') === 0 || strpos($rawTarget, 'https://') === 0) {
                $targetUrl = $rawTarget;
            } else {
                $targetUrl = $baseOrigin . '/' . ltrim($rawTarget, '/');
            }
        }
    }

    // 3. Record Click in Database
    $effectiveAffId = !empty($affId) ? $affId : 'AFF-DIRECT';

    try {
        $stmtClick = $db->prepare("
            INSERT INTO affiliate_clicks (
                click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, landing_url,
                sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
            ON DUPLICATE KEY UPDATE ip_address = VALUES(ip_address), user_agent = VALUES(user_agent)
        ");
        $stmtClick->execute([
            $clickId, $effectiveAffId, $resolvedOfferId, $ipAddress, $userAgent, $referrer, $targetUrl,
            $subId1 ?: null, $subId2 ?: null, $subId3 ?: null, $subId4 ?: null, $subId5 ?: null
        ]);
    } catch (Throwable $e) {
        error_log('[CPA Track] Click insert error: ' . $e->getMessage());
        // Fallback: try with minimal columns (in case some columns are missing)
        try {
            $stmtClickMin = $db->prepare("
                INSERT INTO affiliate_clicks (
                    click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, created_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                )
                ON DUPLICATE KEY UPDATE ip_address = VALUES(ip_address)
            ");
            $stmtClickMin->execute([
                $clickId, $effectiveAffId, $resolvedOfferId, $ipAddress, $userAgent, $referrer
            ]);
        } catch (Throwable $e2) {
            error_log('[CPA Track] Click insert fallback error: ' . $e2->getMessage());
        }
    }

    // 4. Increment offer total_clicks (safe — ignore if column missing)
    if ($offer) {
        try {
            $db->prepare("UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?")->execute([$offer['id']]);
        } catch (Throwable $e) {
            error_log('[CPA Track] total_clicks update skipped: ' . $e->getMessage());
        }
    }
} catch (Throwable $e) {
    error_log('[CPA Track Error] ' . $e->getMessage());
}

// 5. Set 30-Day Cookies for Client Attribution
$cookieDuration = time() + (86400 * 30);
if (!empty($affId)) {
    @setcookie('aff_id', $affId, $cookieDuration, '/', '', false, false);
}
@setcookie('click_id', $clickId, $cookieDuration, '/', '', false, false);
@setcookie('offer_id', $resolvedOfferId, $cookieDuration, '/', '', false, false);
if (!empty($subId1)) {
    @setcookie('sub_id1', $subId1, $cookieDuration, '/', '', false, false);
}
if (!empty($subId2)) {
    @setcookie('sub_id2', $subId2, $cookieDuration, '/', '', false, false);
}

// 6. Preserve click_id, aff_id, offer_id in destination redirect
$parsed = parse_url($targetUrl);
$query = [];
if (!empty($parsed['query'])) {
    parse_str($parsed['query'], $query);
}
if (!empty($affId)) $query['aff_id'] = $affId;
$query['click_id'] = $clickId;
$query['offer_id'] = $resolvedOfferId;
if (!empty($subId1)) $query['sub_id1'] = $subId1;
if (!empty($subId2)) $query['sub_id2'] = $subId2;

$destScheme = isset($parsed['scheme']) ? $parsed['scheme'] . '://' : 'https://';
$destHost   = isset($parsed['host']) ? $parsed['host'] : $host;
$destPort   = isset($parsed['port']) ? ':' . $parsed['port'] : '';
$destPath   = isset($parsed['path']) ? $parsed['path'] : '/';
$newQuery   = '?' . http_build_query($query);
$fragment   = isset($parsed['fragment']) ? '#' . $parsed['fragment'] : '';

$finalDestination = "$destScheme$destHost$destPort$destPath$newQuery$fragment";

// 7. 302 Redirect
header("Location: $finalDestination", true, 302);
exit();
