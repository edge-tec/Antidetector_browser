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
        
// Determine Landing Page & Destination URL based on Offer and Query Params
$customLp = trim($_GET['lp'] ?? ($_GET['landing_page'] ?? ($_GET['target_url'] ?? ($_GET['url'] ?? ''))));
$landingPageSlug = '';
$targetUrl = "$baseOrigin/offer/professional";

if (!empty($customLp)) {
    if (strpos($customLp, 'http://') === 0 || strpos($customLp, 'https://') === 0) {
        $targetUrl = $customLp;
        $parsedCustom = parse_url($customLp);
        $pathParts = explode('/', trim($parsedCustom['path'] ?? '', '/'));
        if (count($pathParts) >= 2 && $pathParts[0] === 'offer') {
            $landingPageSlug = $pathParts[1];
        }
    } elseif (strpos($customLp, '/') === 0) {
        $targetUrl = $baseOrigin . $customLp;
        $pathParts = explode('/', trim($customLp, '/'));
        if (count($pathParts) >= 2 && $pathParts[0] === 'offer') {
            $landingPageSlug = $pathParts[1];
        }
    } else {
        $landingPageSlug = $customLp;
        $targetUrl = "$baseOrigin/offer/{$landingPageSlug}";
    }
} elseif (!empty($offer['landing_page_slug'])) {
    $landingPageSlug = trim($offer['landing_page_slug']);
    $targetUrl = "$baseOrigin/offer/{$landingPageSlug}";
} elseif (!empty($offer['target_url']) && $offer['target_url'] !== '/#pricing') {
    $rawTarget = trim($offer['target_url']);
    if (strpos($rawTarget, 'http://') === 0 || strpos($rawTarget, 'https://') === 0) {
        $targetUrl = $rawTarget;
    } else {
        $targetUrl = $baseOrigin . '/' . ltrim($rawTarget, '/');
    }
    $pathParts = explode('/', trim(parse_url($targetUrl, PHP_URL_PATH) ?? '', '/'));
    if (count($pathParts) >= 2 && $pathParts[0] === 'offer') {
        $landingPageSlug = $pathParts[1];
    }
} elseif (!empty($offer['signup_url']) && $offer['signup_url'] !== '/#pricing') {
    $rawTarget = trim($offer['signup_url']);
    if (strpos($rawTarget, 'http://') === 0 || strpos($rawTarget, 'https://') === 0) {
        $targetUrl = $rawTarget;
    } else {
        $targetUrl = $baseOrigin . '/' . ltrim($rawTarget, '/');
    }
    $pathParts = explode('/', trim(parse_url($targetUrl, PHP_URL_PATH) ?? '', '/'));
    if (count($pathParts) >= 2 && $pathParts[0] === 'offer') {
        $landingPageSlug = $pathParts[1];
    }
} else {
    // Default by package
    $pkg = strtolower($targetPlan ?: ($offer['package_id'] ?? ''));
    if (strpos($pkg, 'starter') !== false) $landingPageSlug = 'starter';
    elseif (strpos($pkg, 'business') !== false || strpos($pkg, 'enterprise') !== false) $landingPageSlug = 'business';
    elseif (strpos($pkg, 'free') !== false) $landingPageSlug = 'free';
    else $landingPageSlug = 'professional';
    $targetUrl = "$baseOrigin/offer/{$landingPageSlug}";
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
@setcookie('landing_page_slug', $landingPageSlug, $cookieDuration, '/', '', false, false);
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
$query['package'] = $targetPlan;

if (!empty($_GET['billing'])) $query['billing'] = trim($_GET['billing']);
if (!empty($_GET['sub_id1']) || !empty($_GET['subid1'])) $query['subid1'] = trim($_GET['sub_id1'] ?? $_GET['subid1']);
if (!empty($_GET['sub_id2']) || !empty($_GET['subid2'])) $query['subid2'] = trim($_GET['sub_id2'] ?? $_GET['subid2']);
if (!empty($_GET['sub_id3']) || !empty($_GET['subid3'])) $query['subid3'] = trim($_GET['sub_id3'] ?? $_GET['subid3']);
if (!empty($_GET['utm_source'])) $query['utm_source'] = trim($_GET['utm_source']);
if (!empty($_GET['utm_campaign'])) $query['utm_campaign'] = trim($_GET['utm_campaign']);
if (!empty($_GET['utm_medium'])) $query['utm_medium'] = trim($_GET['utm_medium']);

$destScheme = isset($parsed['scheme']) ? $parsed['scheme'] . '://' : 'https://';
$destHost   = isset($parsed['host']) ? $parsed['host'] : $host;
$destPort   = isset($parsed['port']) ? ':' . $parsed['port'] : '';
$destPath   = isset($parsed['path']) ? $parsed['path'] : "/offer/{$landingPageSlug}";
$newQuery   = '?' . http_build_query($query);
$fragment   = isset($parsed['fragment']) ? '#' . $parsed['fragment'] : '';

$finalDestination = "$destScheme$destHost$destPort$destPath$newQuery$fragment";

// Handle JSON request
if (isset($_GET['format']) && $_GET['format'] === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'click_id' => $clickId,
        'aff_id' => $affId,
        'offer_id' => $resolvedOfferId,
        'package_id' => $targetPlan,
        'landing_page_slug' => $landingPageSlug,
        'redirect_url' => $finalDestination,
        'tracking_data' => $trackResult
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// 302 Redirect to package-specific dynamic landing page
header("Location: $finalDestination", true, 302);
exit();
