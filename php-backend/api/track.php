<?php
// ──────────────────────────────────────────────
// AntiProfiles — Public CPA Click Tracker & Redirection Endpoint
// Route: /track?aff_id=AFF-28DE2A&offer_id=offer_1d215c8d748a&click_id=...&sub_id1=...
// Also supports /r/{refCode} or /track/{affId}
// ──────────────────────────────────────────────

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

$db = getDbConnection();
ensureDatabaseTablesExist();

// Capture and record click with universal attribution engine
$trackResult = captureAndRecordAffiliateClick($db);

$affId = $trackResult['aff_id'] ?? ($_GET['aff_id'] ?? ($_GET['ref'] ?? 'AFF-28DE2A'));
$resolvedOfferId = $trackResult['offer_id'] ?? ($_GET['offer_id'] ?? 'offer_main_saas');
$clickId = $trackResult['click_id'] ?? ('clk_' . round(microtime(true) * 1000));
$subId1 = $_GET['sub_id1'] ?? '';
$subId2 = $_GET['sub_id2'] ?? '';

// Determine Base Origin
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
$baseOrigin = defined('APP_URL') && !empty(APP_URL) ? rtrim(APP_URL, '/') : "$scheme://$host";

$targetPlan = $trackResult['packageId'] ?? '';
$targetUrl = "$baseOrigin/signup";

// Lookup Offer details to detect specific package plan
try {
    $stmtOffer = $db->prepare("SELECT * FROM affiliate_offers WHERE id = ? LIMIT 1");
    $stmtOffer->execute([$resolvedOfferId]);
    $offer = $stmtOffer->fetch(PDO::FETCH_ASSOC);

    if (!$offer) {
        $stmtDef = $db->query("SELECT * FROM affiliate_offers WHERE status = 'active' ORDER BY created_at ASC LIMIT 1");
        $offer = $stmtDef->fetch(PDO::FETCH_ASSOC);
    }

    if ($offer) {
        $resolvedOfferId = $offer['id'];
        $targetPlan = !empty($offer['package_id']) ? $offer['package_id'] : $targetPlan;
        
        if (!empty($offer['signup_url']) && $offer['signup_url'] !== '/#pricing') {
            $rawTarget = trim($offer['signup_url']);
            if (strpos($rawTarget, 'http://') === 0 || strpos($rawTarget, 'https://') === 0) {
                $targetUrl = $rawTarget;
            } else {
                $targetUrl = $baseOrigin . '/' . ltrim($rawTarget, '/');
            }
        } elseif (!empty($offer['target_url']) && $offer['target_url'] !== '/#pricing') {
            $rawTarget = trim($offer['target_url']);
            if (strpos($rawTarget, 'http://') === 0 || strpos($rawTarget, 'https://') === 0) {
                $targetUrl = $rawTarget;
            } else {
                $targetUrl = $baseOrigin . '/' . ltrim($rawTarget, '/');
            }
        }
    }
} catch (Throwable $e) {
    error_log('[CPA Track] Offer detection error: ' . $e->getMessage());
}

if (empty($targetPlan)) {
    if (isset($_GET['plan'])) {
        $targetPlan = trim($_GET['plan']);
    } else {
        $targetPlan = 'plan_pro';
    }
}

// 30-Day Cookies for Client Attribution
$cookieDuration = time() + (86400 * 30);
if (!empty($affId)) {
    @setcookie('aff_id', $affId, $cookieDuration, '/', '', false, false);
    @setcookie('ref', $affId, $cookieDuration, '/', '', false, false);
}
@setcookie('click_id', $clickId, $cookieDuration, '/', '', false, false);
@setcookie('offer_id', $resolvedOfferId, $cookieDuration, '/', '', false, false);
@setcookie('package_id', $targetPlan, $cookieDuration, '/', '', false, false);
@setcookie('selected_plan', $targetPlan, $cookieDuration, '/', '', false, false);

// Preserve all parameters in destination redirect
$parsed = parse_url($targetUrl);
$query = [];
if (!empty($parsed['query'])) {
    parse_str($parsed['query'], $query);
}
if (!empty($affId)) {
    $query['aff'] = $affId;
    $query['aff_id'] = $affId;
    $query['ref'] = $affId;
}
$query['click_id'] = $clickId;
$query['offer'] = $resolvedOfferId;
$query['offer_id'] = $resolvedOfferId;
$query['plan'] = $targetPlan;
if (!empty($subId1)) $query['sub_id1'] = $subId1;
if (!empty($subId2)) $query['sub_id2'] = $subId2;

$destScheme = isset($parsed['scheme']) ? $parsed['scheme'] . '://' : 'https://';
$destHost   = isset($parsed['host']) ? $parsed['host'] : $host;
$destPort   = isset($parsed['port']) ? ':' . $parsed['port'] : '';
$destPath   = isset($parsed['path']) ? $parsed['path'] : '/signup';
$newQuery   = '?' . http_build_query($query);
$fragment   = isset($parsed['fragment']) ? '#' . $parsed['fragment'] : '';

$finalDestination = "$destScheme$destHost$destPort$destPath$newQuery$fragment";

// 302 Redirect to package-specific signup
header("Location: $finalDestination", true, 302);
exit();
