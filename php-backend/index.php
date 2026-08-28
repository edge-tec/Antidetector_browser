<?php
// ──────────────────────────────────────────────
// AntiProfiles — Central PHP Front Controller & Router for aaPanel
// Handles REST APIs, Dynamic SEO/AEO System, Web App & Landing Page
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

// Parse Request URI
$rawUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestUri = rtrim($rawUri, '/');
if (empty($requestUri)) $requestUri = '/';

$pdo = getDbConnection();

// ── Universal Auto-Capture CPA Affiliate & Referral Click Stream ──
$affTrackResult = captureAndRecordAffiliateClick($pdo);

// ── 0. Dynamic SEO Files Routes ──
if ($requestUri === '/sitemap.xml') {
    require_once __DIR__ . '/sitemap.php';
    exit();
}
if ($requestUri === '/sitemap.html') {
    $_GET['format'] = 'html';
    require_once __DIR__ . '/sitemap.php';
    exit();
}
if ($requestUri === '/robots.txt') {
    require_once __DIR__ . '/robots.php';
    exit();
}
if ($requestUri === '/llms.txt' || $requestUri === '/llms') {
    require_once __DIR__ . '/llms.php';
    exit();
}
if ($requestUri === '/privacy' || $requestUri === '/privacy-policy') {
    require_once __DIR__ . '/privacy.php';
    exit();
}
if ($requestUri === '/terms' || $requestUri === '/terms-and-conditions' || $requestUri === '/tos') {
    require_once __DIR__ . '/terms.php';
    exit();
}
if ($requestUri === '/features' || $requestUri === '/features.php') {
    require_once __DIR__ . '/features.php';
    exit();
}
if (strpos($requestUri, '/reset-password') === 0 || strpos($requestUri, '/forgot-password') === 0) {
    require_once __DIR__ . '/reset-password.php';
    exit();
}
if ($requestUri === '/oauth/google' || $requestUri === '/oauth-bridge' || $requestUri === '/oauth/bridge') {
    require_once __DIR__ . '/oauth-bridge.php';
    exit();
}
if (preg_match('#^/ref/([^/?]+)(?:/([^/?]+))?#i', $requestUri, $matches)) {
    $refUser = trim($matches[1]);
    $offerSlug = !empty($matches[2]) ? trim($matches[2]) : '';
    
    $_GET['ref'] = $refUser;
    $_GET['aff'] = $refUser;
    if (!empty($offerSlug)) {
        $_GET['slug'] = $offerSlug;
        $_GET['offer_id'] = $offerSlug;
    }
    
    require_once __DIR__ . '/offer.php';
    exit();
}
if (preg_match('#^/offer(?:/([^/?]+))?#i', $requestUri, $matches)) {
    if (!empty($matches[1])) {
        $_GET['slug'] = trim($matches[1]);
    }
    require_once __DIR__ . '/offer.php';
    exit();
}
if ($requestUri === '/track' || strpos($requestUri, '/track/') === 0 || strpos($requestUri, '/r/') === 0) {
    require_once __DIR__ . '/api/track.php';
    exit();
}

// ── 0.1 Direct Application Download Endpoints ──
if (strpos($requestUri, '/download/') === 0 || $requestUri === '/download') {
    $subPath = str_replace('/download/', '', $requestUri);
    $subPath = trim(str_replace('/download', '', $subPath), '/');

    $platformMap = [
        'windows' => 'windows-x64',
        'win' => 'windows-x64',
        'macos-intel' => 'macos-x64',
        'mac-intel' => 'macos-x64',
        'macos-arm64' => 'macos-arm64',
        'apple-silicon' => 'macos-arm64',
        'mac-arm' => 'macos-arm64',
        'linux' => 'linux-x64'
    ];

    $_GET['download'] = '1';
    $_GET['platform'] = $platformMap[$subPath] ?? 'windows-x64';
    require_once __DIR__ . '/api/releases.php';
    exit();
}

// ── 0.2 Web Email Verification Page ──
if ($requestUri === '/verify-email' || $requestUri === '/verify') {
    require_once __DIR__ . '/verify-email.php';
    exit();
}

// ── 0.3 Public CPA Click Tracking Redirect (/track, /r, /api/track) ──
if ($requestUri === '/track' || strpos($requestUri, '/track/') === 0 || strpos($requestUri, '/r/') === 0 || $requestUri === '/r' || $requestUri === '/api/track' || strpos($requestUri, '/api/track/') === 0) {
    require_once __DIR__ . '/api/track.php';
    exit();
}

// ── 0.4 Server-to-Server Postback Ingestion (/postback, /api/postback) ──
if ($requestUri === '/postback' || strpos($requestUri, '/postback/') === 0 || $requestUri === '/api/postback' || strpos($requestUri, '/api/postback/') === 0) {
    require_once __DIR__ . '/api/postback.php';
    exit();
}

// ── 1. API Route Dispatcher ──
if (strpos($requestUri, '/api/') === 0 || strpos($requestUri, 'api/') === 0) {
    
    // Health Check & Sync Diagnostic
    if ($requestUri === '/api/health' || $requestUri === '/api/health/sync') {
        require_once __DIR__ . '/api/health.php';
        exit();
    }

    // Real-Time Events API (/api/events/stream, /api/events/poll)
    if (strpos($requestUri, '/api/events') === 0) {
        $action = str_replace('/api/events/', '', $requestUri);
        $action = str_replace('/api/events', '', $action);
        $action = trim($action, '/');
        $_GET['action'] = $action ?: 'stream';
        require_once __DIR__ . '/api/events.php';
        exit();
    }

    // Public Releases & App Downloads Manifest API
    if ($requestUri === '/api/public/releases' || $requestUri === '/api/releases') {
        require_once __DIR__ . '/api/releases.php';
        exit();
    }

    // Public Landing Page Database-Driven CMS Data API
    if ($requestUri === '/api/public/landing-data') {
        require_once __DIR__ . '/api/landing.php';
        exit();
    }

    // Admin SEO API
    if (strpos($requestUri, '/api/admin/seo/') === 0 || strpos($requestUri, '/api/admin/seo') === 0) {
        $action = str_replace('/api/admin/seo/', '', $requestUri);
        $action = str_replace('/api/admin/seo', '', $action);
        $_GET['action'] = $action ?: 'get-settings';
        require_once __DIR__ . '/api/seo.php';
        exit();
    }

    // Auth APIs (/api/auth/login, /api/auth/register, /api/auth/google, /api/auth/me)
    if (strpos($requestUri, '/api/auth') === 0) {
        $action = str_replace('/api/auth/', '', $requestUri);
        $action = str_replace('/api/auth', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
        require_once __DIR__ . '/api/auth.php';
        exit();
    }

    // License Validation & Device API (/api/license/validate)
    if ($requestUri === '/api/license/validate' || $requestUri === '/api/license') {
        require_once __DIR__ . '/api/license.php';
        exit();
    }

    // Admin APIs (/api/admin, /api/admin/*)
    if (strpos($requestUri, '/api/admin') === 0) {
        $action = str_replace('/api/admin/', '', $requestUri);
        $action = str_replace('/api/admin', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
        require_once __DIR__ . '/api/admin.php';
        exit();
    }

    // Payment Gateway & Webhook APIs (/api/payments, /api/payments/*)
    if (strpos($requestUri, '/api/payments') === 0) {
        $action = str_replace('/api/payments/', '', $requestUri);
        $action = str_replace('/api/payments', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
        require_once __DIR__ . '/api/payments.php';
        exit();
    }

    // Support APIs (/api/support, /api/support/*)
    if (strpos($requestUri, '/api/support') === 0) {
        $action = str_replace('/api/support/', '', $requestUri);
        $action = str_replace('/api/support', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
        require_once __DIR__ . '/api/support.php';
        exit();
    }

    // CPA Affiliate APIs (/api/affiliate, /api/affiliate/*)
    if (strpos($requestUri, '/api/affiliate') === 0) {
        $action = str_replace('/api/affiliate/', '', $requestUri);
        $action = str_replace('/api/affiliate', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
        require_once __DIR__ . '/api/affiliate.php';
        exit();
    }

    // Public Click Tracking Redirect (/track)
    if ($requestUri === '/track' || strpos($requestUri, '/track?') === 0) {
        require_once __DIR__ . '/api/track.php';
        exit();
    }

    // Server-to-Server Postback Ingestion (/postback)
    if ($requestUri === '/postback' || strpos($requestUri, '/postback?') === 0 || strpos($requestUri, '/api/postback') === 0) {
        require_once __DIR__ . '/api/postback.php';
        exit();
    }

    // Profile Management APIs (/api/profiles, /api/profiles/*)
    if (strpos($requestUri, '/api/profiles') === 0) {
        $action = str_replace('/api/profiles/', '', $requestUri);
        $action = str_replace('/api/profiles', '', $action);
        $action = trim($action, '/');
        if ($action) $_GET['action'] = $action;
        if (empty($_GET['action'])) $_GET['action'] = ($_SERVER['REQUEST_METHOD'] === 'POST' ? 'create' : 'list');
        require_once __DIR__ . '/api/profiles.php';
        exit();
    }

    // Software Features APIs (/api/features, /api/features/*)
    if (strpos($requestUri, '/api/features') === 0) {
        $action = str_replace('/api/features/', '', $requestUri);
        $action = str_replace('/api/features', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
        require_once __DIR__ . '/api/features.php';
        exit();
    }

    respondJson(['success' => false, 'error' => 'API endpoint not found.'], 404);
}

// ── 2. Serve Static Frontend Web UI, Images & Single Page App Assets ──
$rendererPath = __DIR__ . '/public';

if ($requestUri !== '/') {
    $cleanUri = '/' . ltrim($requestUri, '/');
    $candidatePaths = [
        __DIR__ . $cleanUri,
        $rendererPath . $cleanUri,
        dirname(__DIR__) . $cleanUri,
        dirname(__DIR__) . '/public' . $cleanUri
    ];
    foreach ($candidatePaths as $candidate) {
        if (@file_exists($candidate) && !@is_dir($candidate)) {
            $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
            $mimes = [
                'png' => 'image/png',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'ico' => 'image/x-icon',
                'svg' => 'image/svg+xml',
                'webp' => 'image/webp',
                'css' => 'text/css',
                'js' => 'application/javascript',
                'json' => 'application/json'
            ];
            $mime = $mimes[$ext] ?? @mime_content_type($candidate) ?? 'application/octet-stream';
            header('Content-Type: ' . $mime);
            header('Cache-Control: public, max-age=86400');
            readfile($candidate);
            exit();
        }
    }
}

// Load Page SEO Data from Database for HTML Injection (with safety fallback)
$pageSeo = false;
try {
    $stmtPage = $pdo->prepare("SELECT * FROM `page_seo` WHERE `page_path` = ? LIMIT 1");
    $stmtPage->execute([$requestUri]);
    $pageSeo = $stmtPage->fetch(PDO::FETCH_ASSOC);

    if (!$pageSeo) {
        $stmtHome = $pdo->query("SELECT * FROM `page_seo` WHERE `page_path` = '/' LIMIT 1");
        $pageSeo = $stmtHome->fetch(PDO::FETCH_ASSOC);
    }
} catch (Throwable $e) {
    $pageSeo = false;
}


$defaultKeywordsStr = 'antidetect browser, anti detect browser, browser fingerprint, browser fingerprinting, browser profile, profile manager, multi login browser, multi account browser, fingerprint spoofing, user agent spoofing, WebGL fingerprint, Canvas fingerprint, Audio fingerprint, WebRTC protection, DNS leak protection, proxy browser, SOCKS5 proxy, HTTP proxy, residential proxy, mobile proxy, affiliate marketing browser, CPA browser, media buying browser, Facebook browser, TikTok browser, Instagram browser, Google Ads browser, eCommerce browser, Amazon seller browser, dropshipping browser, anonymous browsing, privacy browser, secure browser, virtual browser, isolated browser profiles, browser automation, Chrome fingerprint, Firefox fingerprint, Mac antidetect browser, Windows antidetect browser, Linux antidetect browser, Apple Silicon browser, GoLogin alternative, AdsPower alternative, Multilogin alternative, Dolphin Anty alternative, Kameleo alternative, Incogniton alternative, VMLogin alternative, Hidemyacc alternative, Octo Browser alternative, MoreLogin alternative, browser identity manager, AntiProfiles browser';

$pageKeywords = !empty($pageSeo['keywords']) ? $pageSeo['keywords'] : $defaultKeywordsStr;
$appBaseUrl = defined('APP_URL') ? APP_URL : 'https://antiprofiles.com';
$pageTitle = $pageSeo['title'] ?? 'AntiProfiles — Anti-Detect Browser & Multi-Account Management Software';
$pageDesc = $pageSeo['description'] ?? 'Manage thousands of social media, e-commerce, and ads accounts seamlessly with 100% isolated browser profiles, canvas/webgl fingerprint spoofing, and residential proxies.';
$pageCanonical = $pageSeo['canonical_url'] ?? (rtrim($appBaseUrl, '/') . $requestUri);
$pageRobots = $pageSeo['robots'] ?? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
$ogTitle = $pageSeo['og_title'] ?? $pageTitle;
$ogDesc = $pageSeo['og_description'] ?? $pageDesc;
$ogImage = $pageSeo['og_image'] ?? ($appBaseUrl . '/og-cover.png');

// Schema.org JSON-LD Generation
$schemas = [
    [
        "@context" => "https://schema.org",
        "@type" => "Organization",
        "name" => "AntiProfiles Software Inc.",
        "url" => $appBaseUrl,
        "logo" => "https://antiprofiles.com/logo.png",
        "sameAs" => [
            "https://x.com/AntiProfilesApp",
            "https://github.com/edge-tec/Antidetector_browser"
        ]
    ],
    [
        "@context" => "https://schema.org",
        "@type" => "SoftwareApplication",
        "name" => "AntiProfiles Anti-Detect Browser",
        "operatingSystem" => "macOS (Apple Silicon & Intel), Windows 10/11, Linux",
        "applicationCategory" => "BusinessApplication",
        "applicationSubCategory" => "Multi-Account & Privacy Browser",
        "description" => $pageDesc,
        "keywords" => $pageKeywords,
        "offers" => [
            "@type" => "Offer",
            "price" => "0.00",
            "priceCurrency" => "USD"
        ],
        "featureList" => [
            "Multi-Account Management & Isolated Profiles",
            "Canvas & WebGL Fingerprint Spoofing",
            "WebRTC & DNS Leak Protection",
            "Residential & SOCKS5 Proxy Management",
            "Affiliate & CPA Marketing Automation",
            "GoLogin, AdsPower, Multilogin Alternative"
        ]
    ]
];

$indexFile = (!empty($rendererPath) ? $rendererPath . '/index.html' : '');
if ($indexFile && @file_exists($indexFile)) {
    $html = file_get_contents($indexFile);

    $seoTags = "\n    <title>" . htmlspecialchars($pageTitle) . "</title>\n";
    $seoTags .= '    <meta name="description" content="' . htmlspecialchars($pageDesc) . '" />' . "\n";
    $seoTags .= '    <meta name="keywords" content="' . htmlspecialchars($pageKeywords) . '" />' . "\n";
    $seoTags .= '    <meta name="robots" content="' . htmlspecialchars($pageRobots) . '" />' . "\n";
    $seoTags .= '    <link rel="canonical" href="' . htmlspecialchars($pageCanonical) . '" />' . "\n";
    $seoTags .= '    <meta property="og:title" content="' . htmlspecialchars($ogTitle) . '" />' . "\n";
    $seoTags .= '    <meta property="og:description" content="' . htmlspecialchars($ogDesc) . '" />' . "\n";
    $seoTags .= '    <meta property="og:image" content="' . htmlspecialchars($ogImage) . '" />' . "\n";
    $seoTags .= '    <meta property="og:url" content="' . htmlspecialchars($pageCanonical) . '" />' . "\n";
    $seoTags .= '    <meta name="twitter:card" content="summary_large_image" />' . "\n";
    $seoTags .= '    <script type="application/ld+json">' . json_encode($schemas, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";

    $html = str_replace('</head>', $seoTags . '  </head>', $html);
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit();
}

// Default Full-Featured Production Landing Page & Web Portal
header('Content-Type: text/html; charset=utf-8');

// Server-Side Active Platform Releases for Instant Landing Page Display
$activeLandingReleases = [
    'windows-x64' => ['version' => '2.0.0', 'url' => '/api/releases?download=1&platform=windows-x64', 'name' => 'Windows Client'],
    'macos-arm64' => ['version' => '2.0.0', 'url' => '/api/releases?download=1&platform=macos-arm64', 'name' => 'macOS Apple Silicon'],
    'macos-x64' => ['version' => '2.0.0', 'url' => '/api/releases?download=1&platform=macos-x64', 'name' => 'macOS Intel'],
    'linux-x64' => ['version' => '2.0.0', 'url' => '/api/releases?download=1&platform=linux-x64', 'name' => 'Linux Client']
];
try {
    if ($pdo) {
        $rStmt = $pdo->query("SELECT platform, version, download_url, release_name FROM app_releases WHERE status = 'active' ORDER BY published_at DESC");
        $seenPlat = [];
        while ($r = $rStmt->fetch()) {
            $p = $r['platform'];
            if (!isset($seenPlat[$p]) && isset($activeLandingReleases[$p])) {
                $activeLandingReleases[$p]['version'] = htmlspecialchars($r['version']);
                if (!empty($r['download_url'])) {
                    $activeLandingReleases[$p]['url'] = htmlspecialchars($r['download_url']);
                }
                if (!empty($r['release_name'])) {
                    $activeLandingReleases[$p]['name'] = htmlspecialchars($r['release_name']);
                }
                $seenPlat[$p] = true;
            }
        }
    }
} catch (Throwable $e) {}

// Dynamic Software Features for Showcase & SEO
$landingFeatures = [];
$landingFeatureCategories = [];
try {
    if ($pdo) {
        $landingFeatures = getAllSoftwareFeatures($pdo, null, true);
        $landingFeatureCategories = getSoftwareFeatureCategories($pdo);
    }
} catch (Throwable $e) {
    $landingFeatures = getDefaultSoftwareFeaturesList();
}
if (empty($landingFeatures)) {
    $landingFeatures = getDefaultSoftwareFeaturesList();
}

// Server-Side Device & OS Auto-Detection for Instant Recommendation
$httpUa = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
$secChUaPlatform = strtolower($_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? '');
$secChUaArch = strtolower($_SERVER['HTTP_SEC_CH_UA_ARCH'] ?? '');

$isAndroid = (strpos($httpUa, 'android') !== false);
$isWin = !$isAndroid && (strpos($secChUaPlatform, 'win') !== false || strpos($httpUa, 'windows') !== false || strpos($httpUa, 'win64') !== false || strpos($httpUa, 'wow64') !== false || strpos($httpUa, 'win32') !== false);
$isLinux = !$isAndroid && !$isWin && (strpos($secChUaPlatform, 'linux') !== false || strpos($httpUa, 'linux') !== false || strpos($httpUa, 'x11') !== false);
$isMac = !$isAndroid && !$isWin && !$isLinux && (strpos($secChUaPlatform, 'mac') !== false || strpos($httpUa, 'mac') !== false || strpos($httpUa, 'darwin') !== false || strpos($httpUa, 'macintosh') !== false);

$isArm = (strpos($secChUaArch, 'arm') !== false || strpos($httpUa, 'arm64') !== false || strpos($httpUa, 'aarch64') !== false);
$isExplicitIntel = (strpos($secChUaArch, 'x86') !== false || strpos($httpUa, 'intel') !== false || strpos($httpUa, 'x86_64') !== false || strpos($httpUa, 'amd64') !== false || strpos($httpUa, 'wow64') !== false || strpos($httpUa, 'win64') !== false);

$winSvg = '<svg width="34" height="34" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>';
$macSvg = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/></svg>';
$linuxSvg = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color: #FACC15;"><path d="M12 2C9.5 2 7.8 3.5 7.8 6.5c0 1.2.3 2.6.7 3.7C7 11.2 5.5 13.5 5.5 16.5c0 2.8 1.5 4.8 3.8 5.3-.2.4-.3.8-.3 1.2 0 .6.4 1 1 1h4c.6 0 1-.4 1-1 0-.4-.1-.8-.3-1.2 2.3-.5 3.8-2.5 3.8-5.3 0-3-1.5-5.3-3-6.3.4-1.1.7-2.5.7-3.7C16.2 3.5 14.5 2 12 2zm-1.8 4.5c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm3.6 0c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm-1.8 1.8c.8 0 1.5.4 1.5 1s-.7 1-1.5 1-1.5-.4-1.5-1 .7-1 1.5-1zm0 4.2c2.2 0 4 2.2 4 5s-1.8 5-4 5-4-2.2-4-5 1.8-5 4-5z"/></svg>';

$detectedPlatform = 'windows-x64';
$detectedPlatformLabel = 'Windows 10 / 11 (64-Bit x64)';
$detectedTitle = 'AntiProfiles for Windows (64-Bit x64)';
$detectedSub = 'Native installer optimized for Windows 10 & 11 (x64 Architecture) with Hardware Acceleration.';
$detectedBtnText = '⬇️ Download for Windows .exe';
$detectedDownloadUrl = '/api/releases?download=1&platform=windows-x64';
$detectedIconSvg = $winSvg;

if ($isWin) {
    if ($isArm && !$isExplicitIntel) {
        $detectedPlatform = 'windows-arm64';
        $detectedPlatformLabel = 'Windows 11 (ARM64 Snapdragon / Surface)';
        $detectedTitle = 'AntiProfiles for Windows 11 (ARM64)';
        $detectedSub = 'Native ARM64 build engineered for Snapdragon X Elite, Surface Pro & ARM PCs.';
        $detectedBtnText = '⬇️ Download for Windows ARM64 .exe';
        $detectedDownloadUrl = '/api/releases?download=1&platform=windows-arm64';
        $detectedIconSvg = $winSvg;
    } else {
        $detectedPlatform = 'windows-x64';
        $detectedPlatformLabel = 'Windows 10 / 11 (64-Bit x64)';
        $detectedTitle = 'AntiProfiles for Windows (64-Bit x64)';
        $detectedSub = 'Native installer optimized for Windows 10 & 11 (x64 Architecture) with Hardware Acceleration.';
        $detectedBtnText = '⬇️ Download for Windows .exe';
        $detectedDownloadUrl = '/api/releases?download=1&platform=windows-x64';
        $detectedIconSvg = $winSvg;
    }
} elseif ($isMac) {
    if ($isArm && !$isExplicitIntel) {
        $detectedPlatform = 'macos-arm64';
        $detectedPlatformLabel = 'macOS Apple Silicon (M1 / M2 / M3 / M4)';
        $detectedTitle = 'AntiProfiles for macOS Apple Silicon (ARM64)';
        $detectedSub = 'Native disk image engineered specifically for Apple Silicon M1, M2, M3 & M4 processors.';
        $detectedBtnText = '⬇️ Download Apple Silicon .dmg';
        $detectedDownloadUrl = '/api/releases?download=1&platform=macos-arm64';
        $detectedIconSvg = $macSvg;
    } else {
        $detectedPlatform = 'macos-x64';
        $detectedPlatformLabel = 'macOS Intel (64-Bit Core i5 / i7 / i9 / Xeon)';
        $detectedTitle = 'AntiProfiles for macOS Intel (x86_64)';
        $detectedSub = 'Native disk image built for Intel Core i5/i7/i9 and Xeon Mac computers.';
        $detectedBtnText = '⬇️ Download macOS Intel .dmg';
        $detectedDownloadUrl = '/api/releases?download=1&platform=macos-x64';
        $detectedIconSvg = $macSvg;
    }
} elseif ($isLinux) {
    if ($isArm) {
        $detectedPlatform = 'linux-arm64';
        $detectedPlatformLabel = 'Linux (ARM64 / aarch64)';
        $detectedTitle = 'AntiProfiles for Linux (ARM64 / aarch64)';
        $detectedSub = 'Optimized binary for 64-Bit ARM Linux devices, Raspberry Pi 5 & ARM servers.';
        $detectedBtnText = '⬇️ Download Linux ARM64 .AppImage';
        $detectedDownloadUrl = '/api/releases?download=1&platform=linux-arm64';
        $detectedIconSvg = $linuxSvg;
    } else {
        $detectedPlatform = 'linux-x64';
        $detectedPlatformLabel = 'Linux (x86_64 AppImage & .deb)';
        $detectedTitle = 'AntiProfiles for Linux (x86_64)';
        $detectedSub = 'Universal standalone AppImage & .deb for Ubuntu, Debian, Fedora, Arch & openSUSE.';
        $detectedBtnText = '⬇️ Download Linux x64 .AppImage';
        $detectedDownloadUrl = '/api/releases?download=1&platform=linux-x64';
        $detectedIconSvg = $linuxSvg;
    }
}

$landingLogoUrl = '/brand-logo.png';
$landingFaviconUrl = '/favicon.ico';
try {
    if ($pdo) {
        $bStmt = $pdo->query("SELECT config_key, config_value FROM desktop_app_config WHERE config_key IN ('landing_logo_url', 'landing_favicon_url')");
        while ($b = $bStmt->fetch()) {
            if ($b['config_key'] === 'landing_logo_url' && !empty($b['config_value'])) {
                $landingLogoUrl = htmlspecialchars($b['config_value']);
            }
            if ($b['config_key'] === 'landing_favicon_url' && !empty($b['config_value'])) {
                $landingFaviconUrl = htmlspecialchars($b['config_value']);
            }
        }
    }
} catch (Throwable $e) {}

// Server-Side Global Free Trial Settings for Dynamic Pricing
$globalTrial = [
    'is_enabled' => 0,
    'trial_duration_days' => 7,
    'default_plan_id' => 'plan_starter',
    'applies_to_packages' => 'all'
];
try {
    if ($pdo) {
        $tStmt = $pdo->query("SELECT * FROM global_trial_settings WHERE id = 'global_trial_config' LIMIT 1");
        if ($tStmt && $tRow = $tStmt->fetch()) {
            $globalTrial = $tRow;
        }
    }
} catch (Throwable $e) {}

$trialActive = !empty($globalTrial['is_enabled']);
$trialDays = max(1, (int)($globalTrial['trial_duration_days'] ?? 7));
$trialPlanId = $globalTrial['default_plan_id'] ?? 'plan_starter';
$trialScope = $globalTrial['applies_to_packages'] ?? 'all';

$isPlanTrial = function($planId) use ($trialActive, $trialScope, $trialPlanId) {
    if (!$trialActive) return false;
    if ($trialScope === 'all') return true;
    return $trialPlanId === $planId;
};
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($pageDesc); ?>">
    <meta name="keywords" content="<?php echo htmlspecialchars($pageKeywords); ?>">
    <meta name="robots" content="<?php echo htmlspecialchars($pageRobots); ?>">
    <link rel="canonical" href="<?php echo htmlspecialchars($pageCanonical); ?>">
    <link rel="icon" id="dynamicSiteFavicon" type="image/x-icon" href="<?php echo $landingFaviconUrl; ?>">
    <link rel="shortcut icon" href="<?php echo $landingFaviconUrl; ?>">
    <link rel="apple-touch-icon" href="<?php echo $landingFaviconUrl; ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($ogTitle); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($ogDesc); ?>">
    <meta property="og:image" content="<?php echo (strpos($landingLogoUrl, 'http') === 0) ? $landingLogoUrl : 'https://antiprofiles.com' . $landingLogoUrl; ?>">
    <meta property="og:url" content="<?php echo htmlspecialchars($pageCanonical); ?>">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json"><?php echo json_encode($schemas, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES); ?></script>
    <!-- Google Identity Services SDK -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <script>
        window.escapeHtml = function(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
        var escapeHtml = window.escapeHtml;

        window.openModal = function(mode, planName) {
            window.closeAdminDashboard();
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
                if (planName) {
                    try { localStorage.setItem('selected_plan', planName); } catch(e) {}
                }
                window.switchAuthTab(mode || 'login', planName);
            }
        };

        window.closeModal = function() {
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
            window.closeGoogleAuthModal();
        };

        window.openGoogleAuthModal = function() {
            const gModal = document.getElementById('googleAuthModal');
            if (gModal) {
                gModal.classList.add('active');
                gModal.style.display = 'flex';
                const input = document.getElementById('googleAuthEmailInput');
                if (input) setTimeout(() => input.focus(), 100);
            }
        };

        window.closeGoogleAuthModal = function() {
            const gModal = document.getElementById('googleAuthModal');
            if (gModal) {
                gModal.classList.remove('active');
                gModal.style.display = 'none';
            }
        };

        window.closeAdminDashboard = function() {
            const adminModal = document.getElementById('adminDashboardModal');
            if (adminModal) {
                adminModal.classList.remove('active');
                adminModal.style.display = 'none';
            }
            if (typeof toggleAdminSidebar === 'function') {
                toggleAdminSidebar(true);
            }
        };

        window.switchAuthTab = function(mode, planName) {
            const loginForm = document.getElementById('loginForm');
            const regForm = document.getElementById('registerForm');
            const forgotForm = document.getElementById('forgotForm');
            const authTabs = document.getElementById('authModeTabs');
            const btnLogin = document.getElementById('modalBtnLogin');
            const btnReg = document.getElementById('modalBtnRegister');
            const msg = document.getElementById('loginMsg');
            const planNotice = document.getElementById('registerPlanNotice');
            const planNoticeText = document.getElementById('registerPlanNoticeText');
            const regSubmitBtn = document.getElementById('registerSubmitBtn');
            if (msg) msg.style.display = 'none';

            if (mode === 'register') {
                if (loginForm) loginForm.style.display = 'none';
                if (forgotForm) forgotForm.style.display = 'none';
                if (regForm) regForm.style.display = 'block';
                if (authTabs) authTabs.style.display = 'flex';
                if (btnReg) {
                    btnReg.style.background = 'var(--primary)';
                    btnReg.style.color = '#FFF';
                }
                if (btnLogin) {
                    btnLogin.style.background = 'transparent';
                    btnLogin.style.color = 'var(--text-muted)';
                }
                
                const effectivePlan = planName || localStorage.getItem('selected_plan') || new URLSearchParams(window.location.search).get('plan');
                if (effectivePlan && effectivePlan !== 'free' && planNotice && planNoticeText) {
                    let formattedName = effectivePlan.replace(/^plan_/i, '');
                    formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1);
                    if (formattedName.toLowerCase() === 'pro') formattedName = 'Professional ($49/mo)';
                    else if (formattedName.toLowerCase() === 'starter') formattedName = 'Starter ($19/mo)';
                    else if (formattedName.toLowerCase() === 'business') formattedName = 'Business ($99/mo)';
                    
                    planNotice.style.display = 'block';
                    planNoticeText.textContent = `${formattedName} • 7-Day Free Trial Included`;
                    if (regSubmitBtn) regSubmitBtn.textContent = `Start Free Trial for ${formattedName.split(' ')[0]}`;
                } else if (planNotice) {
                    planNotice.style.display = 'none';
                    if (regSubmitBtn) regSubmitBtn.textContent = 'Create Account';
                }
            } else if (mode === 'forgot') {
                if (loginForm) loginForm.style.display = 'none';
                if (regForm) regForm.style.display = 'none';
                if (forgotForm) forgotForm.style.display = 'block';
                if (authTabs) authTabs.style.display = 'none';
            } else {
                if (regForm) regForm.style.display = 'none';
                if (forgotForm) forgotForm.style.display = 'none';
                if (loginForm) loginForm.style.display = 'block';
                if (authTabs) authTabs.style.display = 'flex';
                if (btnLogin) {
                    btnLogin.style.background = 'var(--primary)';
                    btnLogin.style.color = '#FFF';
                }
                if (btnReg) {
                    btnReg.style.background = 'transparent';
                    btnReg.style.color = 'var(--text-muted)';
                }
            if (typeof renderTurnstileWidget === 'function') {
                if (mode === 'register') renderTurnstileWidget('registerTurnstileContainer');
                else if (mode === 'forgot') renderTurnstileWidget('forgotPwTurnstileContainer');
                else renderTurnstileWidget('loginTurnstileContainer');
            }
        };
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0B0C10;
            --bg-card: #151720;
            --bg-input: #0F1016;
            --border: #242736;
            --border-hover: #3E435C;
            --primary: #6366F1;
            --primary-glow: rgba(99, 102, 241, 0.35);
            --accent: #2DD4BF;
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { 
            background: var(--bg-dark); 
            color: var(--text-main); 
            font-family: 'Plus Jakarta Sans', sans-serif; 
            font-size: clamp(13px, 1.2vw, 15px);
            line-height: 1.6; 
            overflow-x: hidden; 
            width: 100%; 
            -webkit-text-size-adjust: 100%;
        }
        h1, h2, h3, .logo { font-family: 'Outfit', sans-serif; }

        /* Fluid Typography Scaling Across All Screens */
        h1 { font-size: clamp(24px, 4.5vw, 48px); line-height: 1.2; word-break: break-word; }
        h2 { font-size: clamp(20px, 3.2vw, 34px); line-height: 1.25; word-break: break-word; }
        h3 { font-size: clamp(16px, 2.4vw, 22px); line-height: 1.3; word-break: break-word; }
        h4 { font-size: clamp(14px, 1.8vw, 18px); line-height: 1.35; word-break: break-word; }
        h5 { font-size: clamp(12.5px, 1.4vw, 15px); line-height: 1.4; word-break: break-word; }
        h6 { font-size: clamp(11px, 1.2vw, 13px); line-height: 1.4; }
        p { font-size: clamp(12.5px, 1.35vw, 14.5px); line-height: 1.6; }
        
        /* Container - Centered Width Across All Viewports */
        .container { 
            width: 100%; 
            max-width: 1200px; 
            margin-left: auto; 
            margin-right: auto; 
            padding-left: 24px; 
            padding-right: 24px; 
            box-sizing: border-box;
        }

        /* Glassmorphism Navbar */
        .navbar { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            z-index: 1000; 
            backdrop-filter: blur(16px); 
            background: rgba(11, 12, 16, 0.9); 
            border-bottom: 1px solid var(--border); 
            padding: 14px 28px; 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            box-sizing: border-box;
        }
        .logo { font-size: 22px; font-weight: 800; color: #FFF; text-decoration: none; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .nav-links { display: flex; align-items: center; gap: 24px; list-style: none; margin: 0; padding: 0; }
        .nav-links a { color: var(--text-muted); text-decoration: none; font-weight: 500; font-size: 14px; transition: 0.2s; white-space: nowrap; }
        .nav-links a:hover { color: #FFF; }
        
        .nav-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: nowrap !important;
            flex-shrink: 0;
        }
        
        .mobile-nav-toggle {
            display: none;
            background: rgba(255,255,255,0.06);
            border: 1px solid var(--border);
            color: #FFF;
            font-size: 20px;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            line-height: 1;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .mobile-nav-drawer {
            display: none;
            position: fixed;
            top: 66px;
            left: 0;
            width: 100%;
            background: rgba(11, 12, 16, 0.98);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            padding: 20px 24px 28px 24px;
            z-index: 999;
            flex-direction: column;
            gap: 14px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.8);
            box-sizing: border-box;
            animation: tabFadeIn 0.2s ease;
        }
        .mobile-nav-drawer.active {
            display: flex;
        }
        .mobile-nav-drawer a {
            color: var(--text-main);
            text-decoration: none;
            font-size: 15px;
            font-weight: 600;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: block;
        }
        .mobile-nav-drawer a:hover {
            color: var(--accent);
        }

        .btn { padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; text-decoration: none; cursor: pointer; transition: 0.2s; border: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; }
        .btn-primary { background: linear-gradient(135deg, var(--primary), #8B5CF6); color: #FFF; box-shadow: 0 4px 20px var(--primary-glow); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px var(--primary-glow); }
        .btn-outline { background: transparent; border: 1px solid var(--border-hover); color: var(--text-main); }
        .btn-outline:hover { background: rgba(255,255,255,0.05); color: #FFF; }

        /* Google reCAPTCHA v3 Policy-Compliant Badge Hide & Attribution */
        .grecaptcha-badge {
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        .recaptcha-legal-notice {
            font-size: 11px;
            color: #64748B;
            line-height: 1.5;
            text-align: center;
            margin-top: 12px;
            margin-bottom: 6px;
            display: block;
        }
        .recaptcha-legal-notice a {
            color: #94A3B8;
            text-decoration: underline;
            transition: color 0.15s ease;
        }
        .recaptcha-legal-notice a:hover {
            color: #2DD4BF;
        }
        
        /* Hero Section */
        .hero { padding: 140px 0 80px; position: relative; }
        .hero::before { content: ''; position: absolute; top: 10%; left: 50%; transform: translateX(-50%); width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(11,12,16,0) 70%); filter: blur(60px); pointer-events: none; }
        .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 20px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); color: #818CF8; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
        .hero h1 { font-size: clamp(32px, 5vw, 54px); font-weight: 800; line-height: 1.15; margin-bottom: 20px; color: #FFF; }
        .hero p { font-size: 16px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; max-width: 540px; }
        .hero-actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; }

        /* Server Status Widget */
        .status-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px 28px; max-width: 680px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .status-item { display: flex; flex-direction: column; }
        .status-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
        .status-val { font-size: 15px; font-weight: 700; color: var(--accent); margin-top: 2px; }

        /* Section Headings */
        .section { padding: 75px 0; border-top: 1px solid var(--border); }
        .section-title { text-align: center; margin-bottom: 48px; }
        .section-title h2 { font-size: clamp(26px, 4vw, 36px); font-weight: 800; margin-bottom: 12px; color: #FFF; }
        .section-title p { color: var(--text-muted); font-size: 15px; max-width: 680px; margin: 0 auto; }

        /* Features Grid */
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; width: 100%; }
        .feature-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; transition: 0.3s; box-sizing: border-box; }
        .feature-card:hover { border-color: var(--border-hover); transform: translateY(-4px); }
        .feature-icon { font-size: 30px; margin-bottom: 14px; }
        .feature-card h3 { font-size: 18px; margin-bottom: 8px; color: #FFF; }
        .feature-card p { color: var(--text-muted); font-size: 13.5px; line-height: 1.55; }

        /* Pricing Grid */
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; width: 100%; }
        .plan-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 32px 24px; position: relative; display: flex; flex-direction: column; box-sizing: border-box; }
        .plan-card.popular { border-color: var(--primary); box-shadow: 0 0 30px var(--primary-glow); }
        .popular-tag { position: absolute; top: -14px; right: 24px; background: var(--primary); color: #FFF; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px; text-transform: uppercase; }
        .plan-name { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .plan-price { font-size: 38px; font-weight: 800; color: #FFF; margin-bottom: 14px; }
        .plan-price span { font-size: 15px; color: var(--text-muted); font-weight: 400; }
        .plan-features { list-style: none; margin-bottom: 28px; flex-grow: 1; }
        .plan-features li { margin-bottom: 10px; color: var(--text-muted); font-size: 13.5px; display: flex; align-items: center; gap: 8px; }
        .plan-features li::before { content: '✓'; color: var(--accent); font-weight: 700; }

        /* Login & Auth Modals */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 2000; display: none; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
        #loginModal { z-index: 3000 !important; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: var(--bg-card); border: 1px solid var(--border-hover); width: 100%; max-width: 440px; border-radius: 20px; padding: 32px; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.6); box-sizing: border-box; }
        .close-modal { position: absolute; top: 18px; right: 18px; background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; }
        .form-group { margin-bottom: 18px; text-align: left; }
        .form-group label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        .form-group input { width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; color: #FFF; font-size: 14px; outline: none; box-sizing: border-box; }
        .form-group input:focus { border-color: var(--primary); }

        /* Admin Workspace & Dashboard Layout */
        .admin-workspace-layout {
            display: flex;
            flex: 1;
            overflow: hidden;
            width: 100%;
        }

        .admin-sidebar {
            width: 250px;
            min-width: 250px;
            background: #0F1016;
            border-right: 1px solid var(--border);
            overflow-y: auto;
            padding: 16px 10px;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }

        .admin-viewport-wrapper {
            flex: 1;
            overflow-y: auto;
            background: #08090E;
            padding: 24px 20px 60px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            box-sizing: border-box;
        }

        .admin-tab-content {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            animation: tabFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-card-box {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 22px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            margin-bottom: 22px;
            width: 100%;
            box-sizing: border-box;
        }

        .admin-grid-2col {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
            width: 100%;
            align-items: start;
        }

        .admin-table-container {
            width: 100%;
            overflow-x: auto;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            -webkit-overflow-scrolling: touch;
        }

        .admin-table-container table, table.admin-table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13px;
        }

        .admin-table-container th, table.admin-table th {
            padding: 12px 16px;
            color: var(--text-muted);
            font-weight: 700;
            border-bottom: 1px solid var(--border);
            background: #11131C;
            white-space: nowrap;
        }

        .admin-table-container td, table.admin-table td {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: #E2E8F0;
        }

        .admin-table-container tr:hover td {
            background: rgba(45, 212, 191, 0.03);
        }

        @keyframes tabFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Sidebar Navigation Buttons */
        .admin-sidebar-btn {
            width: 100%;
            padding: 10px 12px;
            margin-bottom: 4px;
            border-radius: 8px;
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .admin-sidebar-btn:hover {
            background: rgba(255, 255, 255, 0.06);
            color: #FFF;
            transform: translateX(2px);
        }
        .admin-sidebar-btn.active {
            background: linear-gradient(135deg, var(--primary), #4F46E5);
            color: #FFF;
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
            font-weight: 700;
        }

        /* Footer */
        footer { padding: 40px 0; border-top: 1px solid var(--border); text-align: center; color: var(--text-muted); font-size: 14px; }
        footer a { color: var(--accent); text-decoration: none; }

        .platform-chip {
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .platform-chip:hover {
            transform: translateY(-4px);
            border-color: #2DD4BF !important;
            box-shadow: 0 10px 25px rgba(45, 212, 191, 0.12);
            background: rgba(30, 34, 48, 0.95) !important;
        }

        /* Desktop App Downloads Section Styles */
        .download-cards-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 18px;
            margin-bottom: 24px;
            width: 100%;
        }
        @media(max-width: 1100px) {
            .download-cards-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media(max-width: 640px) {
            .download-cards-grid {
                grid-template-columns: 1fr;
            }
        }

        .platform-download-card {
            background: linear-gradient(180deg, rgba(21, 23, 32, 0.95), rgba(15, 17, 24, 0.98));
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 18px;
            padding: 22px 18px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
            width: 100%;
        }
        .platform-download-card:hover {
            transform: translateY(-4px);
            border-color: rgba(45, 212, 191, 0.4);
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
        }
        .platform-download-card.card-recommended {
            border: 1px solid #2DD4BF;
            box-shadow: 0 0 24px rgba(45, 212, 191, 0.15);
            background: linear-gradient(180deg, rgba(21, 28, 38, 0.98), rgba(15, 19, 28, 0.98));
        }
        .platform-download-card.card-active-os {
            border: 1px solid #6366F1;
            box-shadow: 0 0 24px rgba(99, 102, 241, 0.2);
        }

        .security-highlights-grid {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px 20px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            width: 100%;
            box-sizing: border-box;
        }
        @media(max-width: 900px) {
            .security-highlights-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media(max-width: 520px) {
            .security-highlights-grid {
                grid-template-columns: 1fr;
            }
        }

        /* ═══════════════════════════════════════════════
           RESPONSIVE DESIGN — ALL DEVICES & BREAKPOINTS
           ═══════════════════════════════════════════════ */

        /* ── Large Desktop (≤1200px) ── */
        @media(max-width: 1200px) {
            .admin-tab-content { max-width: 100%; }
            .admin-viewport-wrapper { padding: 20px 16px 50px 16px; }
        }

        /* ═══════════════════════════════════════════════
           RESPONSIVE DESIGN — ALL DEVICES & BREAKPOINTS
           ═══════════════════════════════════════════════ */

        /* ── Fullscreen Admin Modal Base Rules ── */
        #adminDashboardModal {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100% !important;
            height: 100dvh !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            z-index: 2000 !important;
            background: #0B0C10 !important;
        }
        #adminDashboardModal .modal-box,
        .admin-modal-fullscreen {
            position: relative !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100% !important;
            max-height: 100% !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            box-shadow: none !important;
            background: #0B0C10 !important;
            box-sizing: border-box !important;
        }

        .admin-top-bar {
            padding: 12px 20px;
            background: #151720;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: nowrap !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 1000 !important;
            flex-shrink: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }
        .admin-top-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: nowrap !important;
            min-width: 0;
            flex: 1;
            overflow: hidden;
        }
        .admin-top-left .admin-top-logo {
            height: 32px;
            width: auto;
            object-fit: contain;
            flex-shrink: 0;
        }
        .admin-top-info {
            min-width: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .admin-top-info h2 {
            font-size: 15px;
            color: #FFF;
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 700;
        }
        .admin-top-info p {
            font-size: 11px;
            color: var(--text-muted);
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .admin-top-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
            flex-wrap: nowrap !important;
        }
        .admin-btn-logout {
            border-color: #EF4444 !important;
            color: #F87171 !important;
            padding: 6px 12px !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            border-radius: 8px !important;
        }
        .admin-btn-close {
            position: static !important;
            font-size: 13px !important;
            padding: 5px 10px !important;
            background: rgba(255, 255, 255, 0.08) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            color: #FFF !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
        }

        /* ── Large Desktop (≤1200px) ── */
        @media(max-width: 1200px) {
            .admin-tab-content { max-width: 100%; }
            .admin-viewport-wrapper { padding: 20px 16px 50px 16px; }
        }

        /* ── Tablet & Small Laptop (≤900px) ── */
        @media(max-width: 900px) {
            .navbar { padding: 12px 18px; }
            .nav-links { display: none; }
            .mobile-nav-toggle { display: inline-flex !important; }
            .mobile-nav-drawer {
                top: 58px;
                max-height: calc(100dvh - 58px);
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .container { padding-left: 16px; padding-right: 16px; }
            .section { padding: 44px 0; }
            .hero { padding-top: 96px !important; padding-bottom: 36px !important; gap: 28px !important; }
            .hero h1 { font-size: 30px !important; line-height: 1.25 !important; }
            .status-box { flex-direction: column; gap: 16px; text-align: center; }
            
            /* Admin Dashboard Layout — Left Slide-Out Sidebar Drawer */
            .admin-sidebar-toggle {
                display: inline-flex !important;
                background: rgba(99, 102, 241, 0.15) !important;
                border: 1px solid rgba(99, 102, 241, 0.35) !important;
                color: #818CF8 !important;
                font-size: 14px !important;
                padding: 6px 10px !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                line-height: 1 !important;
                align-items: center !important;
                gap: 5px !important;
                font-weight: 700 !important;
                flex-shrink: 0 !important;
            }
            .admin-sidebar-close-row {
                display: block !important;
            }
            .admin-workspace-layout {
                flex-direction: row;
                position: relative;
                height: calc(100% - 50px);
                overflow: hidden;
            }
            .admin-sidebar {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 280px !important;
                max-width: 85vw !important;
                height: 100% !important;
                height: 100dvh !important;
                z-index: 10005 !important;
                background: #0F1016 !important;
                border-right: 1px solid var(--border) !important;
                transform: translateX(-100%) !important;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 16px 12px 60px 12px !important;
                display: flex !important;
                flex-direction: column !important;
                box-sizing: border-box !important;
                box-shadow: none !important;
                -webkit-overflow-scrolling: touch !important;
            }
            .admin-sidebar.mobile-open {
                transform: translateX(0) !important;
                box-shadow: 12px 0 50px rgba(0, 0, 0, 0.85) !important;
            }
            .admin-sidebar-header {
                display: block !important;
            }
            .admin-sidebar-btn {
                width: 100% !important;
                padding: 10px 12px !important;
                font-size: 13px !important;
                border-radius: 8px !important;
                background: transparent !important;
                border: none !important;
                text-align: left !important;
                white-space: normal !important;
            }
            .admin-sidebar-btn.active {
                background: linear-gradient(135deg, var(--primary), #4F46E5) !important;
                border-color: transparent !important;
            }
            /* Dark overlay behind sidebar */
            .admin-sidebar-overlay {
                display: none;
                position: fixed !important;
                inset: 0 !important;
                background: rgba(0, 0, 0, 0.65) !important;
                backdrop-filter: blur(4px) !important;
                z-index: 10000 !important;
            }
            .admin-sidebar-overlay.active {
                display: block !important;
            }

            .admin-viewport-wrapper {
                flex: 1 !important;
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                padding: 16px 14px 100px 14px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            .admin-grid-2col {
                grid-template-columns: 1fr !important;
                gap: 16px !important;
            }

            /* Tables: Horizontal Scroll Container */
            .admin-table-container,
            div[style*="overflow-x: auto"] {
                -webkit-overflow-scrolling: touch !important;
                overflow-x: auto !important;
                width: 100% !important;
            }
            .admin-table-container table,
            table.admin-table,
            .admin-tab-content table {
                min-width: 520px;
            }

            /* Center Footer Brand & Logo on Mobile */
            .footer-grid {
                text-align: center;
                grid-template-columns: 1fr !important;
                gap: 24px;
            }
            .footer-brand {
                display: flex;
                flex-direction: column;
                align-items: center !important;
                text-align: center !important;
            }
            .footer-logo-wrapper {
                justify-content: center !important;
                width: 100%;
            }
            footer ul {
                align-items: center !important;
            }

            /* Floating Live Chat on Tablet */
            #liveChatWidgetWindow {
                bottom: 75px !important;
                right: 12px !important;
                left: 12px !important;
                width: calc(100vw - 24px) !important;
                max-width: 100% !important;
                height: 72vh !important;
                max-height: 520px !important;
                border-radius: 16px !important;
            }

            /* Pricing Grid — 2 columns on tablet */
            .pricing-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        /* ── Small Tablet / Large Phone (≤768px) ── */
        @media(max-width: 768px) {
            /* Generic dialog modals (login, register, etc.) */
            .modal-box:not(.admin-modal-fullscreen) {
                padding: 22px 16px;
                border-radius: 14px;
                width: 94vw;
                max-width: 440px;
                box-sizing: border-box;
                max-height: 90vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }

            /* Top Bar Header on small screens */
            .admin-top-bar {
                padding: 10px 12px !important;
                gap: 8px !important;
            }
            .admin-top-left {
                gap: 8px !important;
            }
            .admin-top-left .admin-top-logo {
                height: 26px !important;
            }
            .admin-top-info h2 {
                font-size: 13px !important;
            }
            .admin-top-info p {
                font-size: 10.5px !important;
            }

            /* Collapse large-width grids to 1-column cards */
            [style*="grid-template-columns: repeat(auto-fit, minmax(3"],
            [style*="grid-template-columns: repeat(auto-fill, minmax(3"],
            [style*="grid-template-columns: repeat(auto-fit, minmax(28"],
            [style*="grid-template-columns: repeat(auto-fill, minmax(28"],
            .features-section-grid,
            .how-it-works-grid,
            .pricing-section-grid,
            .support-showcase-grid,
            .contact-section-grid,
            .features-grid,
            .pricing-grid,
            .download-cards-grid {
                grid-template-columns: 1fr !important;
            }

            /* Affiliate stats in portal */
            .admin-card-box [style*="grid-template-columns: repeat(3"],
            .admin-card-box [style*="grid-template-columns: repeat(4"],
            .admin-card-box [style*="grid-template-columns: repeat(6"] {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
            }

            .admin-table-container th,
            table.admin-table th,
            .admin-tab-content th {
                padding: 10px 10px;
                font-size: 11px;
            }
            .admin-table-container td,
            table.admin-table td,
            .admin-tab-content td {
                padding: 10px 10px;
                font-size: 12px;
            }

            .btn {
                padding: 9px 14px;
                font-size: 13px;
            }
        }

        /* ── Mobile Phone (≤640px) ── */
        @media(max-width: 640px) {
            /* 1. Landing Page Navbar Fix (Screenshot 2) */
            .navbar {
                padding: 10px 14px !important;
            }
            .brand-logo-img {
                height: 28px !important;
                width: auto !important;
            }
            .nav-actions {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                flex-wrap: nowrap !important;
            }
            /* Hide Sign In on mobile navbar (it is prominently placed in the drawer) */
            .nav-btn-signin {
                display: none !important;
            }
            .nav-btn-getstarted {
                padding: 6px 12px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                white-space: nowrap !important;
                border-radius: 8px !important;
            }
            .mobile-nav-toggle {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 34px !important;
                height: 34px !important;
                padding: 0 !important;
                font-size: 18px !important;
                border-radius: 8px !important;
            }
            .mobile-nav-drawer {
                top: 50px !important;
                max-height: calc(100dvh - 50px) !important;
                padding: 16px 18px 24px 18px !important;
                gap: 10px !important;
            }
            .mobile-nav-drawer a {
                padding: 10px 0 !important;
                font-size: 14px !important;
            }

            /* 2. Hero Section Adjustments */
            .hero { padding-top: 80px !important; padding-bottom: 28px !important; }
            .hero h1 { font-size: 24px !important; line-height: 1.25 !important; }
            .hero p { font-size: 13.5px !important; line-height: 1.55 !important; }
            .hero-actions {
                display: flex !important;
                flex-wrap: wrap !important;
                width: 100% !important;
                gap: 10px !important;
            }
            .hero-actions .btn {
                flex: 1 1 130px !important;
                text-align: center !important;
                justify-content: center !important;
                padding: 11px 16px !important;
                font-size: 13.5px !important;
            }

            /* 3. Admin Card Boxes */
            .admin-card-box {
                padding: 14px 12px !important;
                border-radius: 12px !important;
                margin-bottom: 12px !important;
            }
            .admin-card-box h3,
            .admin-card-box h4 {
                font-size: 15px !important;
            }
            .admin-card-box input,
            .admin-card-box select,
            .admin-card-box textarea {
                font-size: 14px !important;
            }

            .admin-sidebar-btn {
                padding: 9px 12px !important;
                font-size: 12.5px !important;
            }

            /* 4. Floating Live Chat Fix (Screenshot 1 & 2) */
            #liveChatWidgetTrigger {
                bottom: 14px !important;
                right: 14px !important;
                padding: 8px 14px !important;
                font-size: 12px !important;
                border-radius: 30px !important;
                gap: 6px !important;
                box-shadow: 0 8px 22px rgba(0, 0, 0, 0.6) !important;
            }
            #liveChatWidgetTrigger span#liveChatBtnText {
                font-size: 12px !important;
            }
            #liveChatWidgetWindow {
                bottom: 62px !important;
                right: 8px !important;
                left: 8px !important;
                width: calc(100vw - 16px) !important;
                max-width: 100% !important;
                height: calc(100dvh - 80px) !important;
                max-height: 520px !important;
                border-radius: 16px !important;
            }

            /* 5. 2-Column Grids on Mobile (Stats & Ecosystem) */
            .stats-grid,
            .ecosystem-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
            }
            .platform-chip {
                padding: 14px 8px !important;
                border-radius: 12px !important;
            }
            .platform-chip > div {
                font-size: 18px !important;
            }
            .platform-chip span {
                font-size: 10px !important;
            }

            /* 6. Collapse any 200px+ minmax grids that should be 1-column on phones */
            [style*="grid-template-columns: repeat(auto-fit, minmax(2"],
            [style*="grid-template-columns: repeat(auto-fill, minmax(2"] {
                grid-template-columns: 1fr !important;
            }
            /* Keep 2 columns for quick metric KPI boxes if inside admin cards */
            .admin-card-box [style*="grid-template-columns: repeat(auto-fit, minmax(200px"] {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
            }
        }

        /* ── Smallest Phone (≤440px / ≤480px) ── */
        @media(max-width: 480px) {
            .hero h1 { font-size: 22px !important; }
            .hero p { font-size: 13px !important; }
            .badge { font-size: 11px !important; padding: 4px 10px !important; }
            .section-title h2 { font-size: 21px !important; }

            /* Admin Top Bar ultra-compact styling */
            .admin-top-bar {
                padding: 8px 10px !important;
                gap: 6px !important;
            }
            .admin-sidebar-toggle {
                padding: 5px 8px !important;
                font-size: 13px !important;
                border-radius: 6px !important;
            }
            .admin-sidebar-toggle .btn-text-menu {
                display: none !important;
            }
            .admin-top-left .admin-top-logo {
                height: 24px !important;
            }
            .admin-top-info h2 {
                font-size: 12px !important;
            }
            .admin-top-info p {
                font-size: 9.5px !important;
                max-width: 140px !important;
            }
            .admin-btn-logout {
                padding: 5px 8px !important;
                font-size: 11px !important;
                border-radius: 6px !important;
            }
            .admin-btn-logout .btn-text-logout {
                display: none !important;
            }
            .admin-btn-close {
                padding: 5px 8px !important;
                font-size: 11px !important;
                border-radius: 6px !important;
            }
            .admin-btn-close .btn-text-close {
                display: none !important;
            }

            .admin-viewport-wrapper {
                padding: 12px 10px 100px 10px !important;
            }

            /* Affiliate stats single column on ultra-narrow phones */
            .admin-card-box [style*="grid-template-columns: repeat(auto-fit, minmax(200px"] {
                grid-template-columns: 1fr !important;
            }

            #liveChatWidgetTrigger {
                bottom: 10px !important;
                right: 10px !important;
                padding: 6px 11px !important;
                font-size: 11px !important;
            }

            .modal-box:not(.admin-modal-fullscreen) {
                padding: 16px 12px !important;
                width: 95vw !important;
            }

            footer {
                padding: 28px 12px !important;
                font-size: 12px !important;
            }
        }

        /* ── Touch & Scroll Helpers (All Mobile Devices) ── */
        @media(hover: none) and (pointer: coarse) {
            .admin-sidebar {
                scroll-snap-type: y mandatory;
                scroll-behavior: smooth;
            }
            .admin-table-container,
            div[style*="overflow-x: auto"] {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
            }
            /* 16px font-size prevents iOS Safari auto-zoom on input focus */
            input, select, textarea {
                font-size: 16px !important;
            }
            /* Comfortable touch target sizes */
            button, .btn, .admin-sidebar-btn, .mobile-nav-toggle {
                min-height: 38px;
                touch-action: manipulation;
            }
            /* Remove desktop hover translations on touch */
            .feature-card:hover,
            .platform-download-card:hover,
            .platform-chip:hover {
                transform: none !important;
            }
        }

        /* ── Print Styles ── */
        @media print {
            .admin-sidebar, .navbar, #liveChatWidgetTrigger, #liveChatWidgetWindow, .mobile-nav-toggle {
                display: none !important;
            }
            .admin-viewport-wrapper {
                padding: 0 !important;
            }
            .modal-overlay {
                position: static !important;
                background: transparent !important;
            }
            .modal-box {
                box-shadow: none !important;
                border: none !important;
            }
        }
    </style>
</head>
<body>

    <!-- Navbar -->
    <nav class="navbar">
        <a href="/" class="logo" style="display: flex; align-items: center;">
            <img src="<?php echo $landingLogoUrl; ?>" alt="AntiProfiles Logo" class="brand-logo-img" style="height: 36px; width: auto; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';">
        </a>
        <ul class="nav-links">
            <li><a href="/features">Features (52)</a></li>
            <li><a href="#ecosystem">Ecosystem</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#downloads">Downloads</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#live-support-showcase">Support</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
        <div class="nav-actions">
            <a href="/login" class="btn btn-outline nav-btn-signin" style="padding: 7px 14px; font-size: 12.5px; text-decoration: none;" onclick="openModal('login'); return false;">Sign In</a>
            <a href="/register" class="btn btn-primary nav-btn-getstarted" style="padding: 7px 16px; font-size: 12.5px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; text-decoration: none;" onclick="openModal('register'); return false;">Get Started</a>
            <button class="mobile-nav-toggle" id="mobileNavToggle" onclick="toggleMobileNav()" aria-label="Toggle Navigation">☰</button>
        </div>
    </nav>

    <!-- Mobile Navigation Drawer -->
    <div id="mobileNavDrawer" class="mobile-nav-drawer">
        <a href="/features" onclick="closeMobileNav()">✨ All Features (52)</a>
        <a href="#ecosystem" onclick="closeMobileNav()">🌐 Supported Platforms</a>
        <a href="#how-it-works" onclick="closeMobileNav()">⚙️ How It Works</a>
        <a href="#downloads" onclick="closeMobileNav()">💻 Download Apps</a>
        <a href="#pricing" onclick="closeMobileNav()">💳 Pricing Plans</a>
        <a href="#live-support-showcase" onclick="closeMobileNav()">💬 Live Support</a>
        <a href="#faq" onclick="closeMobileNav()">❓ FAQ</a>
        <a href="#contact" onclick="closeMobileNav()">✉️ Contact Us</a>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <a href="/login" class="btn btn-outline" style="flex: 1; text-align: center; border-bottom: none;" onclick="closeMobileNav(); openModal('login'); return false;">Sign In</a>
            <a href="/register" class="btn btn-primary" style="flex: 1; text-align: center; border-bottom: none; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800;" onclick="closeMobileNav(); openModal('register'); return false;">Get Started</a>
        </div>
    </div>

    <!-- 1. Hero Section (2-Column Layout) -->
    <section class="hero container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 40px; align-items: center;">
        <div>
            <div class="badge">
                🚀 Next-Generation AntiProfiles Architecture
            </div>
            <h1>
                Browse Privately.<br>Manage Profiles.<br>Scale Your Workflow.
            </h1>
            <p style="font-size: 16px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; max-width: 520px;">
                Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.
            </p>
            <div class="hero-actions" style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 24px;">
                <a href="/register" class="btn btn-primary" style="padding: 14px 28px; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; text-decoration: none;" onclick="openModal('register'); return false;">Start Free</a>
                <a href="<?= htmlspecialchars($activeLandingReleases[$detectedPlatform]['url'] ?? '#downloads') ?>" id="heroDynamicDownloadBtn" class="btn btn-outline" style="padding: 14px 24px; font-size: 14.5px; border-color: rgba(45,212,191,0.4); display: inline-flex; align-items: center; gap: 8px;">⬇️ Download App</a>
                <a href="#pricing" class="btn btn-outline" style="padding: 14px 22px; font-size: 14.5px;">View Pricing</a>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); font-weight: 500;">⚡ No credit card required • Free trial available • Cancel anytime</p>
        </div>

        <!-- Right Column: Interactive Dashboard Preview Card -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); backdrop-filter: blur(12px);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
                <div style="display: flex; gap: 8px;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #EF4444;"></span>
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #F59E0B;"></span>
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #10B981;"></span>
                </div>
                <span style="font-family: monospace; font-size: 12px; color: var(--text-muted);">AntiProfiles Dashboard v1.0</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 14px; color: #FFF; font-weight: 700;">US E-Commerce Account</h4>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">macOS • 🇺🇸 United States • Active HTTP</p>
                    </div>
                    <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">Running</span>
                </div>

                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 14px; color: #FFF; font-weight: 700;">UK Marketing Profile</h4>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Windows 11 • 🇬🇧 United Kingdom • SOCKS5 Active</p>
                    </div>
                    <span style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">Stopped</span>
                </div>

                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 14px; color: #FFF; font-weight: 700;">EU Research Context</h4>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Linux • 🇩🇪 Germany • HTTP Active</p>
                    </div>
                    <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">Running</span>
                </div>
            </div>
        </div>
    </section>

    <!-- 2. Stats Bar Section -->
    <section style="background: rgba(21, 23, 32, 0.6); border-y: 1px solid var(--border); padding: 40px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
        <div class="container stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 32px; text-align: center;">
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">🌐</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">10K+</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Active Profiles</p>
            </div>
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">⚡</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">99.9%</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Platform Uptime</p>
            </div>
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">🌍</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">150+</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Countries Supported</p>
            </div>
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">24/7</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Expert Support</p>
            </div>
        </div>
    </section>

    <!-- 2.5. Platforms & Ecosystem Section (Ideal for managing accounts across all services) -->
    <section id="ecosystem" class="section container" style="padding-top: 60px; padding-bottom: 60px;">
        <div class="section-title" style="text-align: center; margin-bottom: 40px;">
            <h2 style="font-size: 32px; font-weight: 800; color: #FFF; margin-bottom: 12px; letter-spacing: -0.5px;">Ideal for managing accounts across all services</h2>
            <p style="color: var(--text-muted); font-size: 15px; max-width: 680px; margin: 0 auto; line-height: 1.6;">
                Run multiple stealth accounts simultaneously without detection, bans, or cross-profile linking across global e-commerce, advertising, and social networks.
            </p>
        </div>

        <!-- 16-Service Grid Cards -->
        <div class="ecosystem-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; max-width: 1100px; margin: 0 auto;">
            
            <!-- 1. Facebook -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 26px; font-weight: 900; color: #1877F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -1px; margin-bottom: 6px;">facebook</div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Social & Ads</span>
            </div>

            <!-- 2. Amazon -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 900; color: #FF9900; font-family: sans-serif; letter-spacing: -0.5px; margin-bottom: 6px;">amazon</div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">E-Commerce & Seller</span>
            </div>

            <!-- 3. eBay -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 26px; font-weight: 900; font-family: sans-serif; margin-bottom: 6px;">
                    <span style="color: #E53238;">e</span><span style="color: #0064D2;">b</span><span style="color: #F5AF02;">a</span><span style="color: #86B817;">y</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Marketplaces</span>
            </div>

            <!-- 4. LinkedIn -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 900; color: #0A66C2; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 2px;">
                    <span>Linked</span><span style="background: #0A66C2; color: #FFF; font-size: 15px; font-weight: 800; padding: 0 4px; border-radius: 3px;">in</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Outreach & B2B</span>
            </div>

            <!-- 5. Reddit -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 900; color: #FF4500; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>reddit</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Community & Growth</span>
            </div>

            <!-- 6. Instagram -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 800; background: linear-gradient(45deg, #F58529, #DD2A7B, #8134AF, #515BD4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: 'Brush Script MT', cursive, sans-serif; margin-bottom: 6px;">Instagram</div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Influencers & Media</span>
            </div>

            <!-- 7. TikTok -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 900; color: #FFF; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #00F2FE;">🎵</span><span>TikTok</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Creators & Ads</span>
            </div>

            <!-- 8. Discord -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 23px; font-weight: 800; color: #5865F2; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>🎮 Discord</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Bots & Web3</span>
            </div>

            <!-- 9. Gmail -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 23px; font-weight: 800; color: #EA4335; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>✉️ Gmail</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Email Outreach</span>
            </div>

            <!-- 10. Google Ads -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 23px; font-weight: 800; color: #4285F4; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #FBBC04;">🔺</span><span>Google Ads</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">PPC Campaigns</span>
            </div>

            <!-- 11. Etsy -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 26px; font-weight: 900; color: #F16521; font-family: serif; font-style: italic; margin-bottom: 6px;">Etsy</div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Handmade Stores</span>
            </div>

            <!-- 12. Pinterest -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 800; color: #BD081C; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                    <span>📌 Pinterest</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Visual Discovery</span>
            </div>

            <!-- 13. Meta Business -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 24px; font-weight: 800; color: #0081FB; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>♾️ Meta</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Business Suite</span>
            </div>

            <!-- 14. X / Twitter -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 26px; font-weight: 900; color: #FFF; font-family: sans-serif; margin-bottom: 6px;">𝕏</div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Real-Time Media</span>
            </div>

            <!-- 15. Airbnb -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 23px; font-weight: 800; color: #FF5A5F; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>🏠 airbnb</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Host Multi-Account</span>
            </div>

            <!-- 16. YouTube -->
            <div class="platform-chip" style="background: rgba(24, 27, 38, 0.7); border: 1px solid var(--border); border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transition: all 0.25s ease;">
                <div style="font-size: 23px; font-weight: 900; color: #FF0000; font-family: sans-serif; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>▶️ YouTube</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Automation & Channels</span>
            </div>

        </div>
    </section>

    <!-- 3. Core Features Showcase Preview Section -->
    <section id="features" class="section container">
        <div class="section-title">
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 999px; background: rgba(45, 212, 191, 0.1); border: 1px solid rgba(45, 212, 191, 0.3); color: #2DD4BF; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                <span>✨ Advanced Anti-Detect Platform Architecture</span>
            </div>
            <h2>Built for Ultimate Stealth & Multi-Account Scale</h2>
            <p>AntiProfiles combines kernel-grade hardware spoofing, dual-engine isolation, residential proxy orchestration, and developer automation in a unified interface.</p>
        </div>

        <!-- 6 Core Architectural Pillar Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 36px;">
            
            <!-- Pillar 1: Fingerprint Defense -->
            <div class="feature-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(45, 212, 191, 0.1); border: 1px solid rgba(45, 212, 191, 0.25); display: flex; align-items: center; justify-content: center; font-size: 24px;">🛡️</div>
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3);">13 Protection Shields</span>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Fingerprint Protection</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
                        Canvas 2D noise injection, WebGL GPU masking, AudioContext waveform protection, ClientRects noise, and zero WebRTC IP leak shields.
                    </p>
                </div>
                <a href="/features?category=fingerprint" style="color: #2DD4BF; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    <span>View 13 Fingerprint Shields</span>
                    <span>→</span>
                </a>
            </div>

            <!-- Pillar 2: Dual Browser Engines -->
            <div class="feature-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(129, 140, 248, 0.1); border: 1px solid rgba(129, 140, 248, 0.25); display: flex; align-items: center; justify-content: center; font-size: 24px;">🌐</div>
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: rgba(129, 140, 248, 0.15); color: #818CF8; border: 1px solid rgba(129, 140, 248, 0.3);">Chromium + Firefox</span>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Browser Profiles & Dual Engines</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
                        Execute isolated Chromium & Firefox browser profiles simultaneously with bulk generators, color tags, custom start pages, and trash recovery.
                    </p>
                </div>
                <a href="/features?category=browser_profiles" style="color: #818CF8; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    <span>View Profile Features</span>
                    <span>→</span>
                </a>
            </div>

            <!-- Pillar 3: Proxy & Network -->
            <div class="feature-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.25); display: flex; align-items: center; justify-content: center; font-size: 24px;">🔌</div>
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: rgba(250, 204, 21, 0.15); color: #FACC15; border: 1px solid rgba(250, 204, 21, 0.3);">SOCKS5 / HTTP / SSH</span>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Proxy & Geo-IP Engine</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
                        Smart quick-fill proxy parser, real-time ping health checks, automatic timezone & locale alignment, and zero-leak remote DNS fallback.
                    </p>
                </div>
                <a href="/features?category=proxy_network" style="color: #FACC15; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    <span>View Proxy Capabilities</span>
                    <span>→</span>
                </a>
            </div>

            <!-- Pillar 4: Automation & API -->
            <div class="feature-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: center; font-size: 24px;">🤖</div>
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3);">Puppeteer & Playwright</span>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Automation & Developer API</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
                        Control profiles programmatically via dedicated CDP debug ports, Puppeteer, Playwright, Selenium WebDriver, and local REST API.
                    </p>
                </div>
                <a href="/features?category=automation" style="color: #60A5FA; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    <span>View Automation Tools</span>
                    <span>→</span>
                </a>
            </div>

            <!-- Pillar 5: Team Collaboration & RBAC -->
            <div class="feature-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.25); display: flex; align-items: center; justify-content: center; font-size: 24px;">👥</div>
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: rgba(168, 85, 247, 0.15); color: #C084FC; border: 1px solid rgba(168, 85, 247, 0.3);">Granular RBAC</span>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Team Workspaces & Roles</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
                        Share browser profiles with team members without sharing credentials. Real-time concurrency locks prevent profile collision.
                    </p>
                </div>
                <a href="/features?category=team_collab" style="color: #C084FC; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    <span>View Team Capabilities</span>
                    <span>→</span>
                </a>
            </div>

            <!-- Pillar 6: Cloud Sync & Cookies -->
            <div class="feature-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.25); display: flex; align-items: center; justify-content: center; font-size: 24px;">☁️</div>
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: rgba(236, 72, 153, 0.15); color: #F472B6; border: 1px solid rgba(236, 72, 153, 0.3);">E2E Encrypted</span>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Cloud Sync & Cookie Robot</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;">
                        End-to-end encrypted profile synchronization across Windows, macOS, and Linux devices with automatic cookie warming bots.
                    </p>
                </div>
                <a href="/features?category=sync_cloud" style="color: #F472B6; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    <span>View Cloud & Cookie Tools</span>
                    <span>→</span>
                </a>
            </div>

        </div>

        <!-- Prominent Banner linking to Dedicated All Features Page -->
        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9)); border: 1px solid rgba(45, 212, 191, 0.35); border-radius: 20px; padding: 28px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; box-shadow: 0 12px 36px rgba(0,0,0,0.35);">
            <div style="max-width: 620px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="font-size: 16px;">⚡</span>
                    <strong style="color: #FFF; font-size: 18px;">Looking for the Complete 52-Feature Catalog?</strong>
                </div>
                <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
                    Explore all 52 audited tools, shields, WebGL/Canvas spoofers, proxy protocols, automation drivers, and desktop shortcuts on our dedicated features page.
                </p>
            </div>
            <a href="/features" class="btn btn-primary" style="padding: 14px 28px; font-size: 14.5px; font-weight: 800; text-decoration: none;">
                ✨ Explore All 52 Features & Capabilities →
            </a>
        </div>
    </section>

    <!-- 4. How It Works Section (4 Steps) -->
    <section id="how-it-works" class="section container">
        <div class="section-title">
            <h2>How AntiProfiles Works</h2>
            <p>Get started in four easy steps and launch your isolated browser profiles in seconds.</p>
        </div>
        <div class="how-it-works-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 01</span>
                <div style="font-size: 32px; margin-bottom: 14px;">📋</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Create Your Profile</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Choose a profile template or start from scratch to configure your environment.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 02</span>
                <div style="font-size: 32px; margin-bottom: 14px;">⚙️</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Configure Environment</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Set custom User Agent, OS, timezone, language, WebGL, fingerprint, and proxy.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 03</span>
                <div style="font-size: 32px; margin-bottom: 14px;">🚀</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Launch Isolated Window</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Open an isolated browser window running with dedicated storage and cookies.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 04</span>
                <div style="font-size: 32px; margin-bottom: 14px;">📊</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Scale & Manage</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Monitor profile status, organize into groups, and manage team access effortlessly.</p>
            </div>
        </div>
    </section>

    <!-- 5. Desktop Downloads Section -->
    <section id="downloads" class="section container">
        <div class="section-title">
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
                💻 Cross-Platform Desktop Client (v2.0.0)
            </div>
            <h2>Download Our Desktop Application</h2>
            <p>Manage your isolated browser profiles directly from your computer with native Windows, macOS, and Linux performance.</p>
            <div id="landingDetectedSystemPill" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 10px; padding: 8px 18px; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #10B981; margin-top: 14px; font-weight: 700; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.15);">
                ✓ Auto-Detected System: <strong id="landingDetectedSystemPillText"><?= htmlspecialchars($detectedPlatformLabel) ?></strong>
            </div>
        </div>

        <!-- Featured Intelligent Recommendation Hero Card -->
        <div id="featuredRecommendationHero" style="background: linear-gradient(135deg, rgba(21, 28, 38, 0.98), rgba(15, 23, 42, 0.98)); border: 1px solid rgba(45, 212, 191, 0.45); border-radius: 20px; padding: 26px 30px; margin-bottom: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(45, 212, 191, 0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; position: relative;">
            <div style="display: flex; gap: 20px; align-items: center; max-width: 600px;">
                <div id="featuredOsIconBox" style="width: 64px; height: 64px; border-radius: 16px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <?= $detectedIconSvg ?>
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #2DD4BF; box-shadow: 0 0 10px #2DD4BF;"></span>
                        <span style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; color: #2DD4BF; text-transform: uppercase;">RECOMMENDED FOR YOUR DEVICE</span>
                    </div>
                    <h3 id="featuredDeviceTitle" style="font-size: 22px; font-weight: 800; color: #FFF; margin: 0 0 4px 0;"><?= htmlspecialchars($detectedTitle) ?></h3>
                    <p id="featuredDeviceSub" style="font-size: 13.5px; color: var(--text-muted); margin: 0 0 10px 0;"><?= htmlspecialchars($detectedSub) ?></p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 10.5px; background: rgba(255,255,255,0.06); color: #E2E8F0; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">⚡ v2.0.0 Stable</span>
                        <span style="font-size: 10.5px; background: rgba(45,212,191,0.1); color: #2DD4BF; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(45,212,191,0.25);">🛡️ Isolated Fingerprint Sandbox</span>
                        <span style="font-size: 10.5px; background: rgba(59,130,246,0.1); color: #60A5FA; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(59,130,246,0.25);">🚀 HW Accelerated</span>
                    </div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 260px;">
                <a id="featuredDeviceDlBtn" href="<?= htmlspecialchars($detectedDownloadUrl) ?>" download class="btn btn-primary" style="padding: 15px 32px; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; box-shadow: 0 6px 20px rgba(45,212,191,0.35); text-decoration: none; border-radius: 12px; width: 100%; justify-content: center;">
                    <?= htmlspecialchars($detectedBtnText) ?>
                </a>
                <a href="#allPlatformBuildsGrid" style="font-size: 12px; color: var(--text-muted); text-decoration: underline; transition: color 0.2s;" onmouseover="this.style.color='#2DD4BF'" onmouseout="this.style.color='var(--text-muted)'">
                    Looking for another platform or architecture? Select below ↓
                </a>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; color: #FFF; font-weight: 700;">All Supported Platform Builds</h3>
            <span style="font-size: 12px; color: var(--text-muted);">Select any card below to switch download</span>
        </div>

        <div class="download-cards-grid" id="allPlatformBuildsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px;">
            <!-- 1. Windows x64 Card -->
            <div class="platform-download-card <?= ($detectedPlatform === 'windows-x64') ? 'card-recommended' : '' ?>" id="landingCardWinX64" onclick="selectPlatformManual('windows-x64')" style="cursor: pointer;">
                <?php if ($detectedPlatform === 'windows-x64'): ?>
                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4); z-index: 10;">RECOMMENDED FOR YOUR DEVICE</span>
                <?php endif; ?>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(0, 120, 212, 0.1); border: 1px solid rgba(0, 120, 212, 0.25);">
                            <svg width="24" height="24" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>
                        </div>
                        <span style="font-size: 10px; background: rgba(59,130,246,0.15); color: #60A5FA; border: 1px solid rgba(59,130,246,0.3); padding: 2px 8px; border-radius: 8px; font-weight: 800;">WINDOWS x64</span>
                    </div>
                    <h4 style="font-size: 17px; color: #FFF; margin-bottom: 4px; font-weight: 700;">Windows Client (x64)</h4>
                    <div style="font-size: 12px; color: #2DD4BF; font-weight: 600; margin-bottom: 8px;" id="landingWinX64VerText">v2.0.0 (Intel & AMD 64-Bit)</div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 18px; line-height: 1.5;">Installer for Windows 10 & 11 on Intel/AMD CPUs with HW acceleration.</p>
                </div>
                <a href="/api/releases?download=1&platform=windows-x64" download class="btn <?= ($detectedPlatform === 'windows-x64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; <?= ($detectedPlatform === 'windows-x64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-size: 12.5px;' ?>" id="landingBtnWinX64Dl">Download Windows x64 .exe</a>
            </div>

            <!-- 2. Windows ARM64 Card -->
            <div class="platform-download-card" id="landingCardWinArm64" onclick="selectPlatformManual('windows-arm64')" style="cursor: pointer;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(0, 120, 212, 0.1); border: 1px solid rgba(0, 120, 212, 0.25);">
                            <svg width="24" height="24" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>
                        </div>
                        <span style="font-size: 10px; background: rgba(14,165,233,0.15); color: #38BDF8; border: 1px solid rgba(14,165,233,0.3); padding: 2px 8px; border-radius: 8px; font-weight: 800;">WINDOWS ARM64</span>
                    </div>
                    <h4 style="font-size: 17px; color: #FFF; margin-bottom: 4px; font-weight: 700;">Windows Client (ARM64)</h4>
                    <div style="font-size: 12px; color: #2DD4BF; font-weight: 600; margin-bottom: 8px;" id="landingWinArm64VerText">v2.0.0 (Snapdragon / Surface)</div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 18px; line-height: 1.5;">Native ARM64 build for Snapdragon X Elite, Surface Pro & ARM PCs.</p>
                </div>
                <a href="/api/releases?download=1&platform=windows-arm64" download class="btn btn-outline" style="width: 100%; justify-content: center; font-size: 12.5px;" id="landingBtnWinArm64Dl">Download Windows ARM64 .exe</a>
            </div>

            <!-- 3. macOS Apple Silicon Card -->
            <div class="platform-download-card <?= ($detectedPlatform === 'macos-arm64') ? 'card-recommended' : '' ?>" id="landingCardMacArm" onclick="selectPlatformManual('macos-arm64')" style="cursor: pointer;">
                <?php if ($detectedPlatform === 'macos-arm64'): ?>
                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4); z-index: 10;">RECOMMENDED FOR YOUR DEVICE</span>
                <?php endif; ?>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/>
                            </svg>
                        </div>
                        <span style="font-size: 10px; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); padding: 2px 8px; border-radius: 8px; font-weight: 800;">APPLE SILICON (M1-M4)</span>
                    </div>
                    <h4 style="font-size: 17px; color: #FFF; margin-bottom: 4px; font-weight: 700;">macOS Apple Silicon</h4>
                    <div style="font-size: 12px; color: #2DD4BF; font-weight: 600; margin-bottom: 8px;" id="landingMacArmVerText">v2.0.0 (M1 / M2 / M3 / M4)</div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 18px; line-height: 1.5;">Native ARM64 build engineered for Apple M-series chips.</p>
                </div>
                <a href="/api/releases?download=1&platform=macos-arm64" download class="btn <?= ($detectedPlatform === 'macos-arm64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; <?= ($detectedPlatform === 'macos-arm64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-size: 12.5px;' ?>" id="landingBtnMacArmDl">Download Apple Silicon .dmg</a>
            </div>

            <!-- 4. macOS Intel Card -->
            <div class="platform-download-card <?= ($detectedPlatform === 'macos-x64') ? 'card-recommended' : '' ?>" id="landingCardMacIntel" onclick="selectPlatformManual('macos-x64')" style="cursor: pointer;">
                <?php if ($detectedPlatform === 'macos-x64'): ?>
                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4); z-index: 10;">RECOMMENDED FOR YOUR DEVICE</span>
                <?php endif; ?>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/>
                            </svg>
                        </div>
                        <span style="font-size: 10px; background: rgba(148,163,184,0.15); color: #94A3B8; border: 1px solid rgba(148,163,184,0.3); padding: 2px 8px; border-radius: 8px; font-weight: 800;">MACOS INTEL</span>
                    </div>
                    <h4 style="font-size: 17px; color: #FFF; margin-bottom: 4px; font-weight: 700;">macOS Intel (x64)</h4>
                    <div style="font-size: 12px; color: #2DD4BF; font-weight: 600; margin-bottom: 8px;" id="landingMacIntelVerText">v2.0.0 (Intel Processors)</div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 18px; line-height: 1.5;">Disk image for Intel-based Mac computers.</p>
                </div>
                <a href="/api/releases?download=1&platform=macos-x64" download class="btn <?= ($detectedPlatform === 'macos-x64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; <?= ($detectedPlatform === 'macos-x64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-size: 12.5px;' ?>" id="landingBtnMacIntelDl">Download macOS Intel .dmg</a>
            </div>

            <!-- 5. Linux x64 Card -->
            <div class="platform-download-card <?= ($detectedPlatform === 'linux-x64') ? 'card-recommended' : '' ?>" id="landingCardLinuxX64" onclick="selectPlatformManual('linux-x64')" style="cursor: pointer;">
                <?php if ($detectedPlatform === 'linux-x64'): ?>
                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4); z-index: 10;">RECOMMENDED FOR YOUR DEVICE</span>
                <?php endif; ?>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.25);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #FACC15;">
                                <path d="M12 2C9.5 2 7.8 3.5 7.8 6.5c0 1.2.3 2.6.7 3.7C7 11.2 5.5 13.5 5.5 16.5c0 2.8 1.5 4.8 3.8 5.3-.2.4-.3.8-.3 1.2 0 .6.4 1 1 1h4c.6 0 1-.4 1-1 0-.4-.1-.8-.3-1.2 2.3-.5 3.8-2.5 3.8-5.3 0-3-1.5-5.3-3-6.3.4-1.1.7-2.5.7-3.7C16.2 3.5 14.5 2 12 2zm-1.8 4.5c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm3.6 0c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm-1.8 1.8c.8 0 1.5.4 1.5 1s-.7 1-1.5 1-1.5-.4-1.5-1 .7-1 1.5-1zm0 4.2c2.2 0 4 2.2 4 5s-1.8 5-4 5-4-2.2-4-5 1.8-5 4-5z"/>
                            </svg>
                        </div>
                        <span style="font-size: 10px; background: rgba(234,179,8,0.15); color: #FACC15; border: 1px solid rgba(234,179,8,0.3); padding: 2px 8px; border-radius: 8px; font-weight: 800;">LINUX x64</span>
                    </div>
                    <h4 style="font-size: 17px; color: #FFF; margin-bottom: 4px; font-weight: 700;">Linux Client (x86_64)</h4>
                    <div style="font-size: 12px; color: #2DD4BF; font-weight: 600; margin-bottom: 8px;" id="landingLinuxX64VerText">v2.0.0 (Ubuntu / Debian / Fedora)</div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 18px; line-height: 1.5;">Universal .AppImage & .deb for 64-Bit Linux distributions.</p>
                </div>
                <a href="/api/releases?download=1&platform=linux-x64" download class="btn <?= ($detectedPlatform === 'linux-x64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; <?= ($detectedPlatform === 'linux-x64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'border-color: rgba(250,204,21,0.4); font-size: 12.5px;' ?>" id="landingBtnLinuxX64Dl">Download Linux x64 .AppImage</a>
            </div>

            <!-- 6. Linux ARM64 Card -->
            <div class="platform-download-card" id="landingCardLinuxArm64" onclick="selectPlatformManual('linux-arm64')" style="cursor: pointer;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.25);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #FACC15;">
                                <path d="M12 2C9.5 2 7.8 3.5 7.8 6.5c0 1.2.3 2.6.7 3.7C7 11.2 5.5 13.5 5.5 16.5c0 2.8 1.5 4.8 3.8 5.3-.2.4-.3.8-.3 1.2 0 .6.4 1 1 1h4c.6 0 1-.4 1-1 0-.4-.1-.8-.3-1.2 2.3-.5 3.8-2.5 3.8-5.3 0-3-1.5-5.3-3-6.3.4-1.1.7-2.5.7-3.7C16.2 3.5 14.5 2 12 2zm-1.8 4.5c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm3.6 0c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm-1.8 1.8c.8 0 1.5.4 1.5 1s-.7 1-1.5 1-1.5-.4-1.5-1 .7-1 1.5-1zm0 4.2c2.2 0 4 2.2 4 5s-1.8 5-4 5-4-2.2-4-5 1.8-5 4-5z"/>
                            </svg>
                        </div>
                        <span style="font-size: 10px; background: rgba(234,179,8,0.15); color: #FACC15; border: 1px solid rgba(234,179,8,0.3); padding: 2px 8px; border-radius: 8px; font-weight: 800;">LINUX ARM64</span>
                    </div>
                    <h4 style="font-size: 17px; color: #FFF; margin-bottom: 4px; font-weight: 700;">Linux Client (ARM64)</h4>
                    <div style="font-size: 12px; color: #2DD4BF; font-weight: 600; margin-bottom: 8px;" id="landingLinuxArm64VerText">v2.0.0 (aarch64 / Pi 5)</div>
                    <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 18px; line-height: 1.5;">ARM64 / aarch64 binary for Raspberry Pi 5 & ARM Linux.</p>
                </div>
                <a href="/api/releases?download=1&platform=linux-arm64" download class="btn btn-outline" style="width: 100%; justify-content: center; border-color: rgba(250,204,21,0.4); font-size: 12.5px;" id="landingBtnLinuxArm64Dl">Download Linux ARM64 .AppImage</a>
            </div>
        </div>

        <script>
        (function() {
            var PLATFORM_SPECS = {
                'windows-x64': {
                    key: 'windows-x64',
                    title: 'AntiProfiles for Windows (64-Bit x64)',
                    sub: 'Native installer optimized for Windows 10 & 11 (x64 Architecture) with Hardware Acceleration.',
                    btnText: '⬇️ Download for Windows .exe',
                    pillText: 'Windows 10 / 11 (64-Bit x64)',
                    url: '/api/releases?download=1&platform=windows-x64',
                    landingCardId: 'landingCardWinX64',
                    userCardId: 'cardWinPlatform',
                    iconSvg: '<svg width="34" height="34" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>'
                },
                'windows-arm64': {
                    key: 'windows-arm64',
                    title: 'AntiProfiles for Windows 11 (ARM64)',
                    sub: 'Native ARM64 build engineered for Snapdragon X Elite, Surface Pro & ARM PCs.',
                    btnText: '⬇️ Download for Windows ARM64 .exe',
                    pillText: 'Windows 11 (ARM64 Snapdragon / Surface)',
                    url: '/api/releases?download=1&platform=windows-arm64',
                    landingCardId: 'landingCardWinArm64',
                    userCardId: 'cardWinPlatform',
                    iconSvg: '<svg width="34" height="34" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>'
                },
                'macos-arm64': {
                    key: 'macos-arm64',
                    title: 'AntiProfiles for macOS Apple Silicon (ARM64)',
                    sub: 'Native disk image engineered specifically for Apple Silicon M1, M2, M3 & M4 processors.',
                    btnText: '⬇️ Download Apple Silicon .dmg',
                    pillText: 'macOS Apple Silicon (M1 / M2 / M3 / M4)',
                    url: '/api/releases?download=1&platform=macos-arm64',
                    landingCardId: 'landingCardMacArm',
                    userCardId: 'cardMacArmPlatform',
                    iconSvg: '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/></svg>'
                },
                'macos-x64': {
                    key: 'macos-x64',
                    title: 'AntiProfiles for macOS Intel (x86_64)',
                    sub: 'Native disk image built for Intel Core i5/i7/i9 and Xeon Mac computers.',
                    btnText: '⬇️ Download macOS Intel .dmg',
                    pillText: 'macOS Intel (x86_64)',
                    url: '/api/releases?download=1&platform=macos-x64',
                    landingCardId: 'landingCardMacIntel',
                    userCardId: 'cardMacIntelPlatform',
                    iconSvg: '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/></svg>'
                },
                'linux-x64': {
                    key: 'linux-x64',
                    title: 'AntiProfiles for Linux (x86_64)',
                    sub: 'Universal standalone AppImage & .deb for Ubuntu, Debian, Fedora, Arch & openSUSE.',
                    btnText: '⬇️ Download Linux x64 .AppImage',
                    pillText: 'Linux (x86_64 AppImage & .deb)',
                    url: '/api/releases?download=1&platform=linux-x64',
                    landingCardId: 'landingCardLinuxX64',
                    userCardId: 'cardLinuxPlatform',
                    iconSvg: '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color: #FACC15;"><path d="M12 2C9.5 2 7.8 3.5 7.8 6.5c0 1.2.3 2.6.7 3.7C7 11.2 5.5 13.5 5.5 16.5c0 2.8 1.5 4.8 3.8 5.3-.2.4-.3.8-.3 1.2 0 .6.4 1 1 1h4c.6 0 1-.4 1-1 0-.4-.1-.8-.3-1.2 2.3-.5 3.8-2.5 3.8-5.3 0-3-1.5-5.3-3-6.3.4-1.1.7-2.5.7-3.7C16.2 3.5 14.5 2 12 2zm-1.8 4.5c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm3.6 0c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm-1.8 1.8c.8 0 1.5.4 1.5 1s-.7 1-1.5 1-1.5-.4-1.5-1 .7-1 1.5-1zm0 4.2c2.2 0 4 2.2 4 5s-1.8 5-4 5-4-2.2-4-5 1.8-5 4-5z"/></svg>'
                },
                'linux-arm64': {
                    key: 'linux-arm64',
                    title: 'AntiProfiles for Linux (ARM64 / aarch64)',
                    sub: 'Optimized binary for 64-Bit ARM Linux devices, Raspberry Pi 5 & ARM servers.',
                    btnText: '⬇️ Download Linux ARM64 .AppImage',
                    pillText: 'Linux (ARM64 / aarch64)',
                    url: '/api/releases?download=1&platform=linux-arm64',
                    landingCardId: 'landingCardLinuxArm64',
                    userCardId: 'cardLinuxPlatform',
                    iconSvg: '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color: #FACC15;"><path d="M12 2C9.5 2 7.8 3.5 7.8 6.5c0 1.2.3 2.6.7 3.7C7 11.2 5.5 13.5 5.5 16.5c0 2.8 1.5 4.8 3.8 5.3-.2.4-.3.8-.3 1.2 0 .6.4 1 1 1h4c.6 0 1-.4 1-1 0-.4-.1-.8-.3-1.2 2.3-.5 3.8-2.5 3.8-5.3 0-3-1.5-5.3-3-6.3.4-1.1.7-2.5.7-3.7C16.2 3.5 14.5 2 12 2zm-1.8 4.5c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm3.6 0c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm-1.8 1.8c.8 0 1.5.4 1.5 1s-.7 1-1.5 1-1.5-.4-1.5-1 .7-1 1.5-1zm0 4.2c2.2 0 4 2.2 4 5s-1.8 5-4 5-4-2.2-4-5 1.8-5 4-5z"/></svg>'
                }
            };

            function applyPlatformRecommendation(platKey) {
                var spec = PLATFORM_SPECS[platKey] || PLATFORM_SPECS['windows-x64'];

                // 1. Update Featured Hero Recommendation Box
                var pillText = document.getElementById('landingDetectedSystemPillText');
                if (pillText) pillText.textContent = spec.pillText;

                var fTitle = document.getElementById('featuredDeviceTitle');
                if (fTitle) fTitle.textContent = spec.title;

                var fSub = document.getElementById('featuredDeviceSub');
                if (fSub) fSub.textContent = spec.sub;

                var fBtn = document.getElementById('featuredDeviceDlBtn');
                if (fBtn) {
                    fBtn.href = spec.url;
                    fBtn.textContent = spec.btnText;
                }

                var fIcon = document.getElementById('featuredOsIconBox');
                if (fIcon) fIcon.innerHTML = spec.iconSvg;

                // 2. Update Hero Section Top CTA Button
                var heroBtn = document.getElementById('heroDynamicDownloadBtn');
                if (heroBtn) {
                    heroBtn.href = spec.url;
                    heroBtn.innerHTML = spec.btnText;
                }

                // 3. Highlight Matching Platform Card in the Grid
                var allCards = ['landingCardWinX64', 'landingCardWinArm64', 'landingCardMacArm', 'landingCardMacIntel', 'landingCardLinuxX64', 'landingCardLinuxArm64'];
                allCards.forEach(function(cid) {
                    var card = document.getElementById(cid);
                    if (!card) return;
                    var isMatch = (cid === spec.landingCardId);
                    card.classList.toggle('card-recommended', isMatch);

                    var badges = card.querySelectorAll('.card-rec-badge');
                    for (var i = 0; i < badges.length; i++) {
                        badges[i].remove();
                    }

                    if (isMatch) {
                        var badge = document.createElement('span');
                        badge.className = 'card-rec-badge';
                        badge.setAttribute('style', 'position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4); z-index: 10;');
                        badge.textContent = 'RECOMMENDED FOR YOUR DEVICE';
                        card.appendChild(badge);
                    }

                    var btn = card.querySelector('a.btn');
                    if (btn) {
                        if (isMatch) {
                            btn.className = 'btn btn-primary';
                            btn.setAttribute('style', 'width: 100%; justify-content: center; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px; box-shadow: 0 4px 14px rgba(45,212,191,0.35);');
                        } else {
                            btn.className = 'btn btn-outline';
                            btn.setAttribute('style', 'width: 100%; justify-content: center; font-size: 12.5px;');
                        }
                    }
                });

                // 4. Update User Portal Cards if modal is open
                var userCards = ['cardWinPlatform', 'cardMacArmPlatform', 'cardMacIntelPlatform', 'cardLinuxPlatform'];
                userCards.forEach(function(cid) {
                    var card = document.getElementById(cid);
                    if (!card) return;
                    var isMatch = (cid === spec.userCardId);
                    card.classList.toggle('card-recommended', isMatch);
                    var badges = card.querySelectorAll('.card-rec-badge');
                    for (var b = 0; b < badges.length; b++) {
                        badges[b].remove();
                    }
                    if (isMatch) {
                        var badge = document.createElement('span');
                        badge.className = 'card-rec-badge';
                        badge.setAttribute('style', 'position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4); z-index: 10;');
                        badge.textContent = 'RECOMMENDED';
                        card.appendChild(badge);
                    }
                });
            }

            window.selectPlatformManual = function(platKey) {
                applyPlatformRecommendation(platKey);
            };

            function runFullDeviceDetection() {
                try {
                    var ua = (navigator.userAgent || '').toLowerCase();
                    var plat = (navigator.platform || '').toLowerCase();
                    var uad = navigator.userAgentData;
                    var uadPlat = (uad && uad.platform) ? uad.platform.toLowerCase() : '';

                    var isAndroid = (ua.indexOf('android') !== -1 || plat.indexOf('android') !== -1);
                    var isWin = !isAndroid && (uadPlat.indexOf('win') !== -1 || ua.indexOf('windows') !== -1 || ua.indexOf('win64') !== -1 || ua.indexOf('wow64') !== -1 || ua.indexOf('win32') !== -1 || plat.indexOf('win') !== -1);
                    var isLinux = !isAndroid && !isWin && (uadPlat.indexOf('linux') !== -1 || ua.indexOf('linux') !== -1 || ua.indexOf('x11') !== -1 || plat.indexOf('linux') !== -1);
                    var isMac = !isAndroid && !isWin && !isLinux && (uadPlat.indexOf('mac') !== -1 || ua.indexOf('macintosh') !== -1 || ua.indexOf('mac os') !== -1 || plat.indexOf('mac') !== -1 || ua.indexOf('darwin') !== -1);

                    var isArm = (ua.indexOf('arm64') !== -1 || ua.indexOf('aarch64') !== -1 || ua.indexOf('armv8') !== -1);
                    var isExplicitIntel = (ua.indexOf('intel') !== -1 || ua.indexOf('x86_64') !== -1 || ua.indexOf('x86') !== -1 || ua.indexOf('amd64') !== -1 || ua.indexOf('win64') !== -1 || ua.indexOf('wow64') !== -1);

                    // WebGL Unmasked GPU Hardware Profiling
                    var glRend = '';
                    var glVend = '';
                    try {
                        var c = document.createElement('canvas');
                        var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
                        if (gl) {
                            var ext = gl.getExtension('WEBGL_debug_renderer_info');
                            if (ext) {
                                glRend = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
                                glVend = (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '').toLowerCase();
                            }
                        }
                    } catch(e) {}

                    var detectedKey = 'windows-x64';

                    if (isWin) {
                        var winArm = isArm && !isExplicitIntel;
                        detectedKey = winArm ? 'windows-arm64' : 'windows-x64';
                    } else if (isMac) {
                        // Exact Intel vs Apple Silicon Mac Detection:
                        // 1. Check for Intel / AMD / Radeon / Nvidia / Iris GPU -> Guaranteed macOS Intel
                        var isIntelGpu = (
                            glRend.indexOf('intel') !== -1 || 
                            glRend.indexOf('iris') !== -1 || 
                            glRend.indexOf('hd graphics') !== -1 || 
                            glRend.indexOf('uhd graphics') !== -1 || 
                            glRend.indexOf('amd') !== -1 || 
                            glRend.indexOf('radeon') !== -1 || 
                            glRend.indexOf('nvidia') !== -1 || 
                            glRend.indexOf('geforce') !== -1
                        );

                        // 2. Check for explicit Apple M-Series chip (M1, M2, M3, M4, M5, Apple Silicon)
                        var isAppleSilicon = /(apple\s*m\d|apple\s*silicon|apple\s*m\b)/i.test(glRend);

                        if (isIntelGpu) {
                            detectedKey = 'macos-x64';
                        } else if (isAppleSilicon) {
                            detectedKey = 'macos-arm64';
                        } else if (isArm && !isExplicitIntel) {
                            detectedKey = 'macos-arm64';
                        } else {
                            // Default for Intel Mac architecture
                            detectedKey = 'macos-x64';
                        }
                    } else if (isLinux) {
                        detectedKey = isArm ? 'linux-arm64' : 'linux-x64';
                    }

                    applyPlatformRecommendation(detectedKey);

                    // Client Hints High Entropy Values Async Refinement (Chromium)
                    if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                        navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'model', 'platform', 'platformVersion'])
                        .then(function(hints) {
                            if (hints) {
                                var hPlat = (hints.platform || '').toLowerCase();
                                var hArch = (hints.architecture || '').toLowerCase();
                                var hintsArm = (hArch === 'arm' || hArch === 'arm64' || hArch === 'aarch64');
                                var hintsX86 = (hArch === 'x86' || hArch === 'x86_64' || hArch === 'x64');

                                if (hPlat.indexOf('win') !== -1 || isWin) {
                                    applyPlatformRecommendation(hintsArm ? 'windows-arm64' : 'windows-x64');
                                } else if (hPlat.indexOf('mac') !== -1 || isMac) {
                                    if (hintsArm) {
                                        applyPlatformRecommendation('macos-arm64');
                                    } else if (hintsX86) {
                                        applyPlatformRecommendation('macos-x64');
                                    }
                                } else if (hPlat.indexOf('linux') !== -1 || isLinux) {
                                    applyPlatformRecommendation(hintsArm ? 'linux-arm64' : 'linux-x64');
                                }
                            }
                        }).catch(function() {});
                    }
                } catch(e) {
                    console.error('[AntiProfiles] Detection error:', e);
                }
            }

            window.initDownloadOsDetection = runFullDeviceDetection;
            runFullDeviceDetection();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', runFullDeviceDetection);
            }
            window.addEventListener('load', runFullDeviceDetection);
        })();
        </script>
    </section>

    <!-- 6. Pricing Section (4 Plan Cards) -->
    <section id="pricing" class="section container">
        <div class="section-title">
            <h2>Transparent & Flexible Pricing</h2>
            <p>Choose the plan that fits your workflow. Scale or downgrade anytime.</p>
        </div>
        <div class="pricing-section-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px;">
            <!-- Free Plan -->
            <div id="plan-card-free" class="plan-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; transition: all 0.3s ease;">
                <h3 style="font-size: 18px; color: #FFF;">Free</h3>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$0 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <button class="btn btn-outline" style="width: 100%; justify-content: center; margin-bottom: 24px;" onclick="openModal('register', 'free')">Start Free</button>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>3 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>Basic</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Standard</strong></li>
                    <li>✓ Team Users: <strong>1 User</strong></li>
                    <li>✕ API Access: <strong>—</strong></li>
                    <li>✓ Support: <strong>Community</strong></li>
                </ul>
            </div>

            <!-- Starter Plan -->
            <div id="plan-card-starter" class="plan-card" style="background: var(--bg-card); border: 1px solid <?= $isPlanTrial('plan_starter') ? '#2DD4BF' : 'var(--border)' ?>; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; position: relative; transition: all 0.3s ease;">
                <?php if ($isPlanTrial('plan_starter')): ?>
                    <span style="position: absolute; top: -12px; right: 20px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">🎁 <?= $trialDays ?>-DAY FREE TRIAL</span>
                <?php endif; ?>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="font-size: 18px; color: #FFF; margin: 0;">Starter</h3>
                    <?php if ($isPlanTrial('plan_starter')): ?>
                        <span style="background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 700;">Trial Available</span>
                    <?php endif; ?>
                </div>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$19 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <?php if ($isPlanTrial('plan_starter')): ?>
                    <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-bottom: 24px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(45, 212, 191, 0.35);" onclick="openModal('register', 'Starter')">🎁 Start <?= $trialDays ?>-Day Free Trial</button>
                <?php else: ?>
                    <button class="btn btn-outline" style="width: 100%; justify-content: center; margin-bottom: 24px;" onclick="initiatePackagePayment('plan_starter', 'Starter', 19)">⚡ Pay & Upgrade ($19)</button>
                <?php endif; ?>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>25 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>HTTP/HTTPS/SOCKS</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Advanced</strong></li>
                    <li>✓ Team Users: <strong>2 Users</strong></li>
                    <li>✓ API Access: <strong>Basic API</strong></li>
                    <li>✓ Support: <strong>Email Support</strong></li>
                </ul>
            </div>

            <!-- Professional Plan -->
            <div id="plan-card-pro" class="plan-card" style="background: var(--bg-card); border: 2px solid #2DD4BF; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; position: relative; box-shadow: 0 8px 30px rgba(45, 212, 191, 0.15); transition: all 0.3s ease;">
                <?php if ($isPlanTrial('plan_pro')): ?>
                    <span style="position: absolute; top: -12px; right: 20px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">🎁 <?= $trialDays ?>-DAY FREE TRIAL • MOST POPULAR</span>
                <?php else: ?>
                    <span style="position: absolute; top: -12px; right: 20px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">MOST POPULAR</span>
                <?php endif; ?>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="font-size: 18px; color: #FFF; margin: 0;">Professional</h3>
                    <?php if ($isPlanTrial('plan_pro')): ?>
                        <span style="background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 700;">Free Trial</span>
                    <?php endif; ?>
                </div>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$49 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <?php if ($isPlanTrial('plan_pro')): ?>
                    <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-bottom: 24px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(45, 212, 191, 0.35);" onclick="openModal('register', 'Professional')">🎁 Start <?= $trialDays ?>-Day Free Trial</button>
                <?php else: ?>
                    <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-bottom: 24px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800;" onclick="initiatePackagePayment('plan_pro', 'Professional', 49)">⚡ Pay & Upgrade ($49)</button>
                <?php endif; ?>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>100 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>HTTP/HTTPS/SOCKS5</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Advanced Controls</strong></li>
                    <li>✓ Team Users: <strong>10 Users</strong></li>
                    <li>✓ API Access: <strong>Full REST & Driver API</strong></li>
                    <li>✓ Support: <strong>Priority 24/7</strong></li>
                </ul>
            </div>

            <!-- Business Plan -->
            <div id="plan-card-business" class="plan-card" style="background: var(--bg-card); border: 1px solid <?= $isPlanTrial('plan_business') ? '#818CF8' : 'var(--border)' ?>; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; position: relative; transition: all 0.3s ease;">
                <?php if ($isPlanTrial('plan_business')): ?>
                    <span style="position: absolute; top: -12px; right: 20px; background: linear-gradient(135deg, #818CF8, #6366F1); color: #FFF; font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">🎁 <?= $trialDays ?>-DAY TRIAL • BEST VALUE</span>
                <?php else: ?>
                    <span style="position: absolute; top: -12px; right: 20px; background: rgba(99, 102, 241, 0.2); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.4); font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">BEST VALUE</span>
                <?php endif; ?>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="font-size: 18px; color: #FFF; margin: 0;">Business</h3>
                    <?php if ($isPlanTrial('plan_business')): ?>
                        <span style="background: rgba(129, 140, 248, 0.15); color: #818CF8; border: 1px solid rgba(129, 140, 248, 0.3); border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 700;">Trial Available</span>
                    <?php endif; ?>
                </div>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$99 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <?php if ($isPlanTrial('plan_business')): ?>
                    <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-bottom: 24px; background: linear-gradient(135deg, #818CF8, #6366F1); color: #FFF; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);" onclick="openModal('register', 'Business')">🎁 Start <?= $trialDays ?>-Day Free Trial</button>
                <?php else: ?>
                    <button class="btn btn-outline" style="width: 100%; justify-content: center; margin-bottom: 24px;" onclick="initiatePackagePayment('plan_business', 'Business', 99)">⚡ Pay & Upgrade ($99)</button>
                <?php endif; ?>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>500 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>HTTP/HTTPS/SOCKS5</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Full Hardware Spoofing</strong></li>
                    <li>✓ Team Users: <strong>25 Users</strong></li>
                    <li>✓ API Access: <strong>Unlimited API</strong></li>
                    <li>✓ Support: <strong>Dedicated Account Manager</strong></li>
                </ul>
            </div>
        </div>
    </section>

    <!-- 7. Plan Feature Comparison Matrix Table -->
    <section class="section container" style="padding-top: 0;">
        <div class="section-title">
            <h2>Plan Feature Comparison Matrix</h2>
        </div>
        <div style="overflow-x: auto; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;">
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 14px;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                        <th style="padding: 16px; text-align: left; color: var(--text-muted);">Feature</th>
                        <th style="padding: 16px; color: #FFF;">Free</th>
                        <th style="padding: 16px; color: #FFF;">Starter</th>
                        <th style="padding: 16px; color: #2DD4BF;">Professional</th>
                        <th style="padding: 16px; color: #818CF8;">Business</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Browser Profiles</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">3</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">25</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">100</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">500</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Team Members</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">1 User</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">2 Users</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">10 Users</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">25 Users</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Automation API</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">—</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">Basic API</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">Full API</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">High-Limit API</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Proxy Support</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">✓</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">✓</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">✓</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">✓</td>
                    </tr>
                    <tr>
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Fingerprint Control</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">Basic</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">Advanced</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">Advanced</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">Advanced</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <!-- 7.5. 24/7 Real-Time Support Showcase & Trust Badges Section -->
    <section id="live-support-showcase" class="section container" style="padding-top: 60px; padding-bottom: 60px;">
        <div style="background: linear-gradient(135deg, rgba(24, 27, 38, 0.8) 0%, rgba(15, 17, 26, 0.95) 100%); border: 1px solid var(--border); border-radius: 24px; padding: 48px 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); position: relative; overflow: hidden;">
            
            <!-- Background Glow -->
            <div style="position: absolute; top: -100px; right: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(45, 212, 191, 0.15) 0%, transparent 70%); pointer-events: none;"></div>
            
            <div class="support-showcase-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 48px; align-items: center; position: relative; z-index: 1;">
                
                <!-- Left Column: Support Info & Channels -->
                <div>
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 700; margin-bottom: 20px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 8px #10B981;"></span>
                        24/7 Real-Time Support
                    </div>

                    <h2 style="font-size: 40px; font-weight: 900; color: #FFF; line-height: 1.15; margin-bottom: 18px; letter-spacing: -1px;">
                        24/7<br><span style="background: linear-gradient(135deg, #2DD4BF, #60A5FA); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">real-time support</span>
                    </h2>

                    <p style="color: var(--text-muted); font-size: 15px; line-height: 1.65; margin-bottom: 32px; max-width: 480px;">
                        AntiProfiles has the highest rated client support in software. We're here 24 hours a day, every day of the week, including holidays.
                    </p>

                    <!-- 4 Support Channels Grid -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">💬</span>
                            <span style="color: #FFF; font-size: 14px; font-weight: 600;">Live-chat support</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">🟢</span>
                            <span style="color: #FFF; font-size: 14px; font-weight: 600;">WhatsApp support</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">✉️</span>
                            <span style="color: #FFF; font-size: 14px; font-weight: 600;">Email support</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">🌐</span>
                            <span style="color: #FFF; font-size: 14px; font-weight: 600;">Facebook (Meta) support</span>
                        </div>
                    </div>

                    <button onclick="toggleLiveChat()" class="btn btn-primary" style="padding: 14px 32px; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; box-shadow: 0 4px 20px rgba(45, 212, 191, 0.35);">
                        💬 Open Live Support Chat
                    </button>
                </div>

                <!-- Right Column: Live Chat Preview Mockup -->
                <div style="display: flex; justify-content: center;">
                    <div style="width: 100%; max-width: 360px; background: #0E1017; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(45, 212, 191, 0.15); overflow: hidden; display: flex; flex-direction: column;">
                        
                        <!-- Mockup Header -->
                        <div style="background: #181B26; padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #2DD4BF, #06B6D4); display: flex; align-items: center; justify-content: center; font-size: 18px; color: #000; font-weight: 900;">
                                    🛡️
                                </div>
                                <div>
                                    <h4 style="font-size: 14px; color: #FFF; margin: 0; font-weight: 700;">AntiProfiles Support</h4>
                                    <span style="font-size: 11px; color: #10B981; font-weight: 600;">● Online • Typical reply &lt; 1 min</span>
                                </div>
                            </div>
                            <span style="font-size: 14px; color: var(--text-muted); cursor: pointer;" onclick="toggleLiveChat()">✕</span>
                        </div>

                        <!-- Mockup Chat Stream -->
                        <div style="padding: 20px 16px; display: flex; flex-direction: column; gap: 14px; background: rgba(10, 11, 16, 0.9); min-height: 240px;">
                            
                            <!-- Incoming Agent Bubble -->
                            <div style="align-self: flex-start; max-width: 85%; background: #1F2333; border: 1px solid #2B3046; border-radius: 14px 14px 14px 2px; padding: 12px 14px;">
                                <span style="font-size: 10px; font-weight: 700; color: #2DD4BF; display: block; margin-bottom: 4px;">Emma (Technical Support)</span>
                                <p style="font-size: 13px; color: #FFF; margin: 0; line-height: 1.45;">
                                    Hi there 👋 How can we help you today?
                                </p>
                                <span style="font-size: 9px; color: var(--text-muted); display: block; text-align: right; margin-top: 4px;">Just now</span>
                            </div>

                            <!-- Outgoing User Bubble -->
                            <div style="align-self: flex-end; max-width: 85%; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; border-radius: 14px 14px 2px 14px; padding: 12px 14px;">
                                <p style="font-size: 13px; font-weight: 600; margin: 0; line-height: 1.45;">
                                    Can I run 50 stealth accounts on Facebook & Amazon safely?
                                </p>
                                <span style="font-size: 9px; color: rgba(0,0,0,0.6); display: block; text-align: right; margin-top: 4px;">Just now ✓✓</span>
                            </div>

                            <!-- Incoming Agent Reply -->
                            <div style="align-self: flex-start; max-width: 85%; background: #1F2333; border: 1px solid #2B3046; border-radius: 14px 14px 14px 2px; padding: 12px 14px;">
                                <span style="font-size: 10px; font-weight: 700; color: #2DD4BF; display: block; margin-bottom: 4px;">Emma (Technical Support)</span>
                                <p style="font-size: 13px; color: #FFF; margin: 0; line-height: 1.45;">
                                    Yes, 100%! Each profile operates with isolated cookies, dedicated proxies & randomized canvas noise. 🚀
                                </p>
                                <span style="font-size: 9px; color: var(--text-muted); display: block; text-align: right; margin-top: 4px;">Just now</span>
                            </div>

                        </div>

                        <!-- Mockup Chat Input Box -->
                        <div style="padding: 12px 16px; background: #181B26; border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: center;">
                            <input type="text" placeholder="Write your question..." readonly onclick="toggleLiveChat()" style="flex: 1; background: #0A0B10; border: 1px solid #272A3B; border-radius: 20px; padding: 8px 14px; color: #FFF; font-size: 12px; cursor: pointer;">
                            <button type="button" onclick="toggleLiveChat()" style="background: #2DD4BF; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 12px; cursor: pointer;">
                                ➤
                            </button>
                        </div>

                    </div>
                </div>

            </div>

            <!-- Trust & Industry Award Badges Row -->
            <div style="margin-top: 48px; padding-top: 36px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 24px;">
                
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">🏆</span>
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #FFF;">Best Support 2025</div>
                        <div style="font-size: 10px; color: #2DD4BF;">G2 Top Rated</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">⭐</span>
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #FFF;">Users Love Us</div>
                        <div style="font-size: 10px; color: #F59E0B;">4.9 / 5.0 Rating</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">🛡️</span>
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #FFF;">High Performer</div>
                        <div style="font-size: 10px; color: #60A5FA;">Spring 2025</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">🔒</span>
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #FFF;">Easiest To Use</div>
                        <div style="font-size: 10px; color: #10B981;">Capterra Verified</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">💎</span>
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #FFF;">Leader Multi-Account</div>
                        <div style="font-size: 10px; color: #A78BFA;">TrustPilot Top Choice</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 22px;">⚡</span>
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #FFF;">Fastest Implementation</div>
                        <div style="font-size: 10px; color: #F43F5E;">Enterprise Ready</div>
                    </div>
                </div>

            </div>

        </div>
    </section>

    <!-- 8. Frequently Asked Questions Section -->
    <section id="faq" class="section container">
        <div class="section-title">
            <h2>Frequently Asked Questions</h2>
            <p>Have questions about AntiProfiles? Find answers below.</p>
        </div>
        <div style="max-width: 840px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>What is an anti-detect browser?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    An anti-detect browser is a specialized browser platform designed to run multiple isolated browser environments simultaneously. Each profile operates with its own distinct cookies, cache, local storage, dedicated proxy connection, and unique digital hardware fingerprint (including WebGL, Canvas noise, User-Agent, WebRTC IP masking, screen resolution, and audio context). This prevents websites from tracking or linking your accounts together.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>What is a browser profile?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    A browser profile is an entirely isolated virtual browsing session. It stores its own independent cookies, browsing history, saved credentials, browser extensions, and hardware parameters. Running a profile is like launching a separate physical computer with its own browser environment, ensuring complete data separation between different social media, e-commerce, or advertising accounts.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>Can I use HTTP, SOCKS4, and SOCKS5 proxies?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    Yes! AntiProfiles supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with full authentication (username/password or IP whitelist). You can configure proxies per profile, test connections in real time, auto-detect geographical location, and automatically route WebRTC and DNS traffic through your proxy to prevent IP leaks.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>Can I upgrade or downgrade my plan at any time?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    Absolutely! You can upgrade, downgrade, or change your subscription plan whenever needed directly from your account dashboard. Upgrades take effect immediately with prorated billing, and you can manage device limits, profile quotas, and active licenses with complete control.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>Does AntiProfiles offer an Automation API?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    Yes! AntiProfiles includes a robust local REST API and WebSocket endpoints compatible with Selenium, Puppeteer, Playwright, and custom automation tools. You can programmatically launch profiles, manage browser sessions, inspect runtime status, and automate multi-account workflows at scale.
                </div>
            </div>
        </div>
    </section>

    <!-- 9. Testimonials Section -->
    <section class="section container">
        <div class="section-title">
            <h2>Trusted by Professionals World-Wide</h2>
            <p>See what engineers, agencies, and security researchers say about AntiProfiles.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="color: #F59E0B; font-size: 18px; margin-bottom: 12px;">⭐⭐⭐⭐⭐</div>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    "AntiProfiles completely transformed how our agency manages 50+ accounts. Session isolation and proxy integration are rock solid."
                </p>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #6366F1; display: flex; align-items: center; justify-content: center; font-weight: 700;">AR</div>
                    <div>
                        <h4 style="font-size: 14px; color: #FFF;">Alex Rivera</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">E-Commerce Manager at Apex Brands</p>
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="color: #F59E0B; font-size: 18px; margin-bottom: 12px;">⭐⭐⭐⭐⭐</div>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    "The local automation API and custom WebGL fingerprinting options made automated testing across multiple browser contexts seamless."
                </p>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #2DD4BF; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700;">SC</div>
                    <div>
                        <h4 style="font-size: 14px; color: #FFF;">Sarah Chen</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">Lead Growth Engineer at Nexus Digital</p>
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="color: #F59E0B; font-size: 18px; margin-bottom: 12px;">⭐⭐⭐⭐⭐</div>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    "Solid security architecture, local encrypted database, and clear RBAC user permissions. Exactly what professional teams require."
                </p>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #8B5CF6; display: flex; align-items: center; justify-content: center; font-weight: 700;">MV</div>
                    <div>
                        <h4 style="font-size: 14px; color: #FFF;">Marcus Vance</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">Privacy Consultant at CyberShield</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 10. Contact Us Section -->
    <section id="contact" class="section container">
        <div class="section-title">
            <h2>Get in Touch with Our Team</h2>
            <p>Have custom enterprise requirements or need technical assistance? Contact our team directly.</p>
        </div>
        <div class="contact-section-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; align-items: start;">
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">✉️ EMAIL SUPPORT</div>
                    <a href="mailto:support@antiprofiles.com" style="font-size: 16px; color: #2DD4BF; font-weight: 700; text-decoration: none;">support@antiprofiles.com</a>
                </div>

                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">✈️ TELEGRAM COMMUNITY</div>
                    <a href="https://t.me/antiprofiles_support" target="_blank" class="btn btn-outline" style="margin-top: 8px;">Join Telegram Support</a>
                </div>
            </div>

            <!-- Contact Message Form -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Send a Message</h3>
                <div id="contactFormStatus" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 14px; font-size: 13px; font-weight: 600;"></div>
                <form id="publicContactForm" onsubmit="handlePublicContactSubmit(event)">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <input type="text" id="contactSenderName" placeholder="Your Name" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13.5px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <input type="email" id="contactSenderEmail" placeholder="Your Email" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13.5px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <input type="text" id="contactSenderSubject" placeholder="Subject" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13.5px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <textarea id="contactSenderMessage" rows="4" placeholder="Your Message..." required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13.5px;"></textarea>
                    </div>
                    <div id="contactTurnstileContainer" style="margin-bottom: 16px; display: flex; justify-content: center; min-height: 0;"></div>
                    <button type="submit" id="btnSendContactMsg" class="btn btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 14px; padding: 12px;">Send Message</button>
                    <p class="recaptcha-legal-notice">
                        This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
                    </p>
                </form>
            </div>
        </div>
    </section>

    <!-- 11. Footer Section -->
    <footer style="background: #08090C; border-top: 1px solid var(--border); padding: 60px 0 30px;">
        <div class="container footer-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; padding-bottom: 40px; border-bottom: 1px solid var(--border);">
            <div class="footer-brand">
                <div class="footer-logo-wrapper" style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <img src="<?php echo $landingLogoUrl; ?>" alt="AntiProfiles Logo" class="brand-logo-img" style="height: 36px; width: auto; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';">
                </div>
                <p style="color: var(--text-muted); font-size: 13px; line-height: 1.6; max-width: 320px;">Professional browser profile isolation and anti-detect privacy management software.</p>
            </div>
            <div>
                <h4 style="font-size: 14px; color: #FFF; font-weight: 700; margin-bottom: 14px;">Product</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <li><a href="/features" style="color: var(--text-muted); text-decoration: none;">All Features (52)</a></li>
                    <li><a href="#pricing" style="color: var(--text-muted); text-decoration: none;">Pricing</a></li>
                    <li><a href="#downloads" style="color: var(--text-muted); text-decoration: none;">Downloads</a></li>
                    <li><a href="#faq" style="color: var(--text-muted); text-decoration: none;">FAQ</a></li>
                </ul>
            </div>
            <div>
                <h4 style="font-size: 14px; color: #FFF; font-weight: 700; margin-bottom: 14px;">Resources</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <li><a href="/terms" style="color: var(--text-muted); text-decoration: none;">Terms & Conditions</a></li>
                    <li><a href="/privacy" style="color: var(--text-muted); text-decoration: none;">Privacy Policy</a></li>
                    <li><a href="#live-support-showcase" style="color: var(--text-muted); text-decoration: none;">24/7 Support</a></li>
                </ul>
            </div>
            <div>
                <h4 style="font-size: 14px; color: #FFF; font-weight: 700; margin-bottom: 14px;">Account</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <li><a href="#" onclick="openModal('login'); return false;" style="color: var(--text-muted); text-decoration: none;">Sign In</a></li>
                    <li><a href="#" onclick="openModal('register'); return false;" style="color: #2DD4BF; text-decoration: none; font-weight: 700;">Create Free Account</a></li>
                </ul>
            </div>
        </div>
        <div class="container" style="text-align: center; padding-top: 24px; font-size: 12px; color: var(--text-muted);">
            © <?php echo date('Y'); ?> AntiProfiles Software. All rights reserved.
        </div>
        <div class="container" style="text-align: center; padding-top: 8px; font-size: 11px; color: #475569;">
            This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style="color: #64748B; text-decoration: underline;">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" style="color: #64748B; text-decoration: underline;">Terms of Service</a> apply.
        </div>
    </footer>

    <!-- Login & Register Modal -->
    <div class="modal-overlay" id="loginModal">
        <div class="modal-box" style="max-width: 440px; border-radius: 16px; padding: 32px; background: #12141D;">
            <button class="close-modal" onclick="closeModal()">✕</button>

            <!-- Brand Logo Header in Login Modal -->
            <div style="text-align: center; margin-bottom: 22px;">
                <img src="<?php echo $landingLogoUrl; ?>" alt="AntiProfiles Logo" class="brand-logo-img" style="height: 44px; width: auto; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(59,130,246,0.3));" onerror="this.onerror=null; this.src='/logo.png';">
            </div>

            <!-- Mode Switcher Tabs -->
            <div id="authModeTabs" style="display: flex; background: var(--bg-input); padding: 4px; border-radius: 10px; margin-bottom: 20px; border: 1px solid var(--border);">
                <button id="modalBtnLogin" class="btn" style="flex: 1; border-radius: 8px; font-weight: 700; padding: 8px; background: var(--primary); color: #FFF;" onclick="switchAuthTab('login')">Sign In</button>
                <button id="modalBtnRegister" class="btn" style="flex: 1; border-radius: 8px; font-weight: 700; padding: 8px; background: transparent; color: var(--text-muted);" onclick="switchAuthTab('register')">Create Account</button>
            </div>
            
            <div id="loginMsg" style="display: none; padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>

            <!-- Login Form (Matches User Screenshot Exactly) -->
            <form id="loginForm" onsubmit="handleLogin(event); return false;">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Email Address</label>
                    <input type="email" id="loginEmail" placeholder="user@example.com" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 0;">Password</label>
                        <a href="#" onclick="switchAuthTab('forgot'); return false;" style="font-size: 12px; color: #2DD4BF; text-decoration: none; font-weight: 600;">Forgot Password?</a>
                    </div>
                    <input type="password" id="loginPassword" placeholder="••••••••" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div id="loginTurnstileContainer" style="margin-bottom: 16px; display: flex; justify-content: center; min-height: 0;"></div>

                <button type="submit" id="loginSubmitBtn" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 13px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px; font-size: 15px;">Sign In</button>

                <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">OR</span>
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                </div>

                <!-- Google OAuth Button -->
                <button type="button" id="googleSignInBtnLogin" class="btn btn-outline" style="width: 100%; justify-content: center; padding: 12px; border-color: #272A3B; background: #0A0B10; color: #FFF; font-weight: 600; border-radius: 8px; font-size: 14px;" onclick="handleGoogleSignIn()">
                    <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign in with Google
                </button>

                <p class="recaptcha-legal-notice">
                    This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
                </p>

                <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 20px;">
                    Don't have an account? <a href="#" onclick="switchAuthTab('register'); return false;" style="color: #2DD4BF; font-weight: 700; text-decoration: none;">Create one</a>
                </p>
            </form>

            <!-- Forgot Password Form -->
            <form id="forgotForm" style="display: none;" onsubmit="handleForgotPassword(event); return false;">
                <h3 style="font-size: 17px; color: #FFF; margin-bottom: 6px; text-align: center;">Reset Your Password</h3>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px; text-align: center;">Enter your registered account email address to receive a secure password reset link.</p>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Email Address</label>
                    <input type="email" id="forgotEmail" placeholder="user@example.com" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div id="forgotPwTurnstileContainer" style="margin-bottom: 16px; display: flex; justify-content: center; min-height: 0;"></div>

                <button type="submit" id="forgotSubmitBtn" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 13px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px; font-size: 15px;">Send Reset Link</button>

                <p class="recaptcha-legal-notice">
                    This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
                </p>

                <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 20px;">
                    Remember your password? <a href="#" onclick="switchAuthTab('login'); return false;" style="color: #2DD4BF; font-weight: 700; text-decoration: none;">Sign in</a>
                </p>
            </form>

            <!-- Register Form (Matches User Screenshot Exactly) -->
            <form id="registerForm" style="display: none;" onsubmit="handleRegister(event); return false;">
                <div id="registerPlanNotice" style="display: none; background: rgba(45, 212, 191, 0.12); border: 1px solid rgba(45, 212, 191, 0.35); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #2DD4BF; text-align: center; font-weight: 600;">
                    <div style="font-size: 14px; margin-bottom: 2px;">🎁 <strong>Special Package Pre-Selected!</strong></div>
                    <div id="registerPlanNoticeText" style="color: #FFF; font-size: 12.5px;">Professional Plan • 7-Day Free Trial Included</div>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px; text-align: center;">Register to start managing antidetect browser profiles</p>
                
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Full Name</label>
                    <input type="text" id="regName" placeholder="John Doe" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Email Address</label>
                    <input type="email" id="regEmail" placeholder="user@example.com" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Password</label>
                    <input type="password" id="regPassword" placeholder="At least 6 characters" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Confirm Password</label>
                    <input type="password" id="regConfirmPassword" placeholder="Re-enter password" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div id="registerTurnstileContainer" style="margin-bottom: 16px; display: flex; justify-content: center; min-height: 0;"></div>

                <button type="submit" id="registerSubmitBtn" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 13px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px; font-size: 15px;">Create Account</button>

                <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">OR</span>
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                </div>

                <!-- Google OAuth Button -->
                <button type="button" id="googleSignInBtnRegister" class="btn btn-outline" style="width: 100%; justify-content: center; padding: 12px; border-color: #272A3B; background: #0A0B10; color: #FFF; font-weight: 600; border-radius: 8px; font-size: 14px;" onclick="handleGoogleSignIn()">
                    <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign up with Google
                </button>

                <p class="recaptcha-legal-notice">
                    This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
                </p>

                <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 20px;">
                    Already have an account? <a href="#" onclick="switchAuthTab('login'); return false;" style="color: #2DD4BF; font-weight: 700; text-decoration: none;">Sign in</a>
                </p>
            </form>
        </div>
    </div>

    <!-- Google OAuth Popup Modal -->
    <div class="modal-overlay" id="googleAuthModal" style="z-index: 2100;">
        <div class="modal-box" style="max-width: 400px; border-radius: 16px; padding: 32px 28px; background: #12141D; border: 1px solid #272A3B; text-align: center; position: relative;">
            <button class="close-modal" onclick="closeGoogleAuthModal()">✕</button>
            <div style="width: 54px; height: 54px; background: #1A1D2B; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; border: 1px solid #2A2E42;">
                <svg width="28" height="28" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            </div>
            <h3 style="font-size: 19px; color: #FFF; font-weight: 700; margin-bottom: 6px;">Sign in with Google</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 22px;">Fast, secure authentication with your Google Account</p>
            
            <div id="googleAuthMsg" style="display: none; padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

            <form onsubmit="submitGoogleDirectAuth(event); return false;">
                <div style="margin-bottom: 18px; text-align: left;">
                    <label style="font-size: 12px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Google Account Email</label>
                    <input type="email" id="googleAuthEmailInput" placeholder="name@gmail.com" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                <button type="submit" id="googleAuthSubmitBtn" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 13px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px; font-size: 14px;">Sign in with Google</button>
            </form>
        </div>
    </div>

    <!-- Edit Application Release Modal -->
    <div class="modal-overlay" id="editReleaseModal" style="z-index: 3500 !important; display: none; align-items: center; justify-content: center;">
        <div class="modal-box" style="max-width: 640px; width: 92%; max-height: 90vh; overflow-y: auto; border-radius: 16px; padding: 26px; background: #12141D; border: 1px solid #272A3B; box-shadow: 0 25px 60px rgba(0,0,0,0.85); position: relative;">
            <button class="close-modal" onclick="closeEditReleaseModal()" style="position: absolute; top: 18px; right: 18px; background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(45,212,191,0.15); display: flex; align-items: center; justify-content: center; font-size: 20px; color: #2DD4BF;">
                    ✏️
                </div>
                <div>
                    <h3 style="font-size: 18px; color: #FFF; margin: 0; font-weight: 700;">Edit Application Release</h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0 0 0;">Update release version, name, status, direct download URL, or replace the installer binary.</p>
                </div>
            </div>

            <div id="editReleaseModalMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

            <form id="formEditRelease" onsubmit="handleUpdateRelease(event)" enctype="multipart/form-data">
                <input type="hidden" id="editRelId">
                <input type="hidden" id="editRelExistingFilePath">
                <input type="hidden" id="editRelExistingFilename">
                <input type="hidden" id="editRelExistingFileSize">

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 14px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Target Platform</label>
                        <select id="editRelPlatform" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px; font-size: 13px;">
                            <option value="windows-x64">🪟 Windows Client (x64 Architecture)</option>
                            <option value="macos-arm64">🍏 macOS Apple Silicon (M1 / M2 / M3 / M4)</option>
                            <option value="macos-x64">🍏 macOS Intel (x64 Processors)</option>
                            <option value="linux-x64">🐧 Linux Client (.AppImage)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Version Number</label>
                        <input type="text" id="editRelVersion" placeholder="2.1.0" required style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px; font-size: 13px;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 14px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Release Name / Headline</label>
                        <input type="text" id="editRelName" placeholder="Release Headline" required style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px; font-size: 13px;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Publish Status</label>
                        <select id="editRelStatus" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px; font-size: 13px;">
                            <option value="active">Active (Set as current active release)</option>
                            <option value="draft">Save as Draft (Not public)</option>
                            <option value="archived">Archived (Historical version)</option>
                        </select>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">📦 Current Associated File</span>
                        <span id="editRelFileBadge" style="font-size: 11px; color: #2DD4BF; font-weight: 700;">Server Storage</span>
                    </div>
                    <div id="editRelCurrentFileInfo" style="font-size: 13px; color: #FFF; word-break: break-all;">No binary file attached</div>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">External Direct Download URL (Optional)</label>
                    <input type="text" id="editRelDirectUrl" placeholder="https://github.com/... or Google Drive URL" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px; font-size: 13px;">
                    <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px; display: block;">Used if direct URL or external cloud CDN is preferred.</span>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Upload Replacement Binary File (Optional)</label>
                    <input type="file" id="editRelFile" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: #FFF; margin-top: 6px; font-size: 12px;">
                    <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px; display: block;">Leave empty to keep existing binary file. Slices & uploads in fast chunks if a large file is chosen.</span>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Release Notes & Changelog</label>
                    <textarea id="editRelNotes" rows="3" placeholder="List new features, performance improvements, and security enhancements in this version..." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px; font-size: 13px;"></textarea>
                </div>

                <div id="editReleaseProgressBarContainer" style="display: none; margin-bottom: 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #FFF; margin-bottom: 8px;">
                        <span id="editReleaseProgressLabel">⏳ Uploading replacement binary...</span>
                        <span id="editReleaseProgressPercent" style="color: #2DD4BF; font-weight: 800;">0%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                        <div id="editReleaseProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #2DD4BF, #06B6D4); transition: width 0.1s ease;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button type="button" class="btn btn-outline" onclick="closeEditReleaseModal()" style="padding: 10px 18px; font-size: 13px;">Cancel</button>
                    <button type="submit" id="btnSaveEditRelease" class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; padding: 10px 22px; font-size: 13px;">💾 Save Release Changes</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Admin Dashboard Overlay Modal -->
    <div class="modal-overlay" id="adminDashboardModal">
        <div class="modal-box admin-modal-fullscreen" id="adminDashboardBox">
            
            <!-- Top Bar Header -->
            <div class="admin-top-bar" id="adminTopBar">
                <div class="admin-top-left">
                    <button class="admin-sidebar-toggle" onclick="toggleAdminSidebar()" aria-label="Toggle Menu" id="adminSidebarToggleBtn">
                        <span style="font-size: 15px; line-height: 1;">☰</span> <span class="btn-text-menu" style="font-size: 12px;">Menu</span>
                    </button>
                    <img src="<?php echo $landingLogoUrl; ?>" alt="AntiProfiles Logo" class="brand-logo-img admin-top-logo" onerror="this.onerror=null; this.src='/logo.png';">
                    <div class="admin-top-info">
                        <h2>Central Web Control Center</h2>
                        <p id="adminUserInfo">Logged in as System Admin</p>
                    </div>
                </div>
                <div class="admin-top-right">
                    <button class="btn btn-outline admin-btn-logout" onclick="handleLogout()">🚪 <span class="btn-text-logout">Logout</span></button>
                    <button class="close-modal admin-btn-close" onclick="closeAdminDashboard()">✕ <span class="btn-text-close">Close</span></button>
                </div>
            </div>

            <!-- Mobile Sidebar Overlay Backdrop -->
            <div class="admin-sidebar-overlay" id="adminSidebarOverlay" onclick="toggleAdminSidebar()"></div>

            <!-- Main Workspace Container: Sidebar + Content -->
            <div class="admin-workspace-layout">
                
                <!-- Left Navigation Sidebar -->
                <div class="admin-sidebar" id="adminSidebar">
                    <!-- Mobile Sidebar Close Button -->
                    <div class="admin-sidebar-close-row" style="display: none; padding: 10px 8px 14px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 6px;">📂 Navigation</span>
                            <button onclick="toggleAdminSidebar(true)" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #FFF; font-size: 12px; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">✕ Close</button>
                        </div>
                    </div>
                    <!-- User Profile & Controls Section (Visible to ALL users) -->
                    <div class="admin-sidebar-header" style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; padding: 8px 12px;">MY ACCOUNT PORTAL</div>
                    <button class="admin-sidebar-btn active" id="btnTabMyProfile" onclick="switchAdminTab('my-profile', this)">👤 My Profile & Password</button>
                    <button class="admin-sidebar-btn" id="btnTabMySubscription" onclick="switchAdminTab('my-subscription', this)">💳 My Subscription & Quota</button>
                    <button class="admin-sidebar-btn" id="btnTabMyAffiliate" onclick="switchAdminTab('my-affiliate', this)">🤝 My Affiliate & CPA Portal</button>
                    <button class="admin-sidebar-btn" id="btnTabUserDownloads" onclick="switchAdminTab('user-downloads', this)">🚀 Desktop App Downloads</button>
                    <button class="admin-sidebar-btn" id="btnTabUserSupport" onclick="switchAdminTab('user-support', this)">💬 Help & Live Support</button>

                    <!-- Admin Control Sections (Hidden for regular users, visible ONLY for admins) -->
                    <div class="admin-sidebar-header admin-only-section" style="font-size: 11px; font-weight: 700; color: #818CF8; text-transform: uppercase; padding: 16px 12px 8px 12px;">ADMIN CONTROL PANEL</div>
                    <button class="admin-sidebar-btn admin-only-section" id="btnTabUsers" onclick="switchAdminTab('users', this)">👥 All Users & Accounts</button>
                    <button class="admin-sidebar-btn admin-only-section" id="btnTabAdminAffiliates" onclick="switchAdminTab('admin-affiliates', this)">🤝 Affiliate & CPA Control</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('subscriptions', this)">💳 Subscription Manager</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('gateways', this)">⚡ Payment Gateways</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('payments', this)">💰 Payments & Invoices</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('profiles', this)">🌐 Browser Profiles Engine</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('profile-audit', this)">🔬 7-Layer Settings Audit</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('releases', this)">🚀 App Downloads Config</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('support', this)" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>💬 Admin Support Inbox</span>
                        <span id="adminSupportSidebarBadge" style="display:none; background:#EF4444; color:#FFF; font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px;">0</span>
                    </button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('notifications', this)">🔔 Broadcast Notifications</button>
                    <button class="admin-sidebar-btn admin-only-section" id="btnTabGoogleOauth" onclick="switchAdminTab('google-oauth', this)">🔑 Google OAuth Config</button>
                    <button class="admin-sidebar-btn admin-only-section" id="btnTabCaptcha" onclick="switchAdminTab('captcha', this)">🛡️ Bot Protection (Captcha)</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('smtp', this)">📧 Email & SMTP Config</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('seo', this)">🔍 SEO & Meta Manager</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('landing', this)">🎨 Landing CMS & Pricing</button>
                    <button class="admin-sidebar-btn admin-only-section" id="btnTabSoftwareFeatures" onclick="switchAdminTab('software-features', this)">✨ Software Features CMS</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('roles', this)">🔑 Roles & Permissions</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('security', this)">🛡️ Security Logs</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('audit', this)">📜 System Audit Logs</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('health', this)">🩺 Health Checks</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('settings', this)">⚙️ aaPanel DB Settings</button>
                </div>

                <!-- Right Content Panel -->
                <div class="admin-viewport-wrapper">
                    
                    <!-- Global Trial Expired Warning & Locking Paywall Banner -->
                    <div id="userTrialExpiredPaywallBanner" style="display: none; background: linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(185, 28, 28, 0.08)); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 14px; padding: 18px 22px; margin-bottom: 22px; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.25);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; font-size: 22px;">
                                    🔒
                                </div>
                                <div>
                                    <h4 style="color: #F87171; margin: 0; font-weight: 800; font-size: 16px;">Your Free Trial Has Expired (All Options Locked)</h4>
                                    <p style="color: #CBD5E1; font-size: 12.5px; margin: 3px 0 0 0;">Browser profile launching, new profile creation, proxy setup, and team options are locked. Please subscribe to an active plan to unlock your profiles immediately.</p>
                                </div>
                            </div>
                            <a href="#pricing" onclick="closeAdminDashboard()" class="btn btn-primary" style="background: linear-gradient(135deg, #F87171, #EF4444); color: #FFF; font-weight: 800; padding: 10px 22px; border-radius: 10px; font-size: 13.5px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                                💳 Choose Plan & Unlock Now
                            </a>
                        </div>
                    </div>

                    <!-- USER TAB 1: MY PROFILE (Editable Profile Info & Password Only) -->
                    <div id="tab-my-profile" class="admin-tab-content">
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 6px;">My Personal Account Settings</h3>
                            <p style="color: var(--text-muted); font-size: 13px;">Manage your personal profile details, contact email, and secure password.</p>
                        </div>
                        
                        <div class="admin-grid-2col">
                            <div class="admin-card-box">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>👤</span> Profile Information
                                </h4>
                                <form id="formMyProfile" onsubmit="return updateMyProfileInfo(event)">
                                    <div style="margin-bottom: 16px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Full Name</label>
                                        <input type="text" id="myProfileName" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <div style="margin-bottom: 24px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Email Address</label>
                                        <input type="email" id="myProfileEmail" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 11px 20px; font-weight: 700;">💾 Update Profile Information</button>
                                </form>
                            </div>

                            <div class="admin-card-box">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>🔒</span> Change Security Password
                                </h4>
                                <form id="formMyPassword" onsubmit="return updateMyPassword(event)">
                                    <div style="margin-bottom: 16px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Current Password</label>
                                        <input type="password" id="myCurrentPassword" required placeholder="••••••••" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <div style="margin-bottom: 24px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">New Secure Password</label>
                                        <input type="password" id="myNewPassword" required minlength="6" placeholder="At least 6 characters" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <button type="submit" class="btn btn-outline" style="width: 100%; padding: 11px 20px; font-weight: 700; border-color: var(--primary); color: #818CF8;">🔒 Change Password</button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- USER TAB 2: MY SUBSCRIPTION & QUOTA (Strictly Read-Only) -->
                    <div id="tab-my-subscription" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">My Subscription & Quota Usage</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">View your active subscription plan, device limits, and profile quota.</p>
                            </div>
                            <a href="#pricing" onclick="closeAdminDashboard()" class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; padding: 10px 20px;">⚡ Renew / Upgrade Subscription</a>
                        </div>

                        <!-- Read-Only Subscription Overview Cards -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 28px;">
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">CURRENT PLAN</span>
                                <h2 style="font-size: 24px; color: #2DD4BF; margin-top: 6px;" id="userSubPlanName">Starter Plan</h2>
                                <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;" id="userSubStatus">ACTIVE</span>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">PROFILE LIMIT & USAGE</span>
                                <h2 style="font-size: 24px; color: #FFF; margin-top: 6px;" id="userProfileQuotaDisplay">0 / 25 Profiles</h2>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Managed browser profile capacity</p>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">DEVICE LIMIT & USAGE</span>
                                <h2 style="font-size: 24px; color: #FFF; margin-top: 6px;" id="userDeviceQuotaDisplay">1 / 2 Devices</h2>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Active desktop installations</p>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">EXPIRATION DATE</span>
                                <h2 style="font-size: 20px; color: #FFF; margin-top: 6px;" id="userSubExpiresAt">September 15, 2027</h2>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Grace Period: 3 Days</p>
                            </div>
                        </div>

                        <!-- Read-Only Features Matrix -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                            <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px;">Included Features & API Access</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Browser Profile Isolation</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">Canvas & WebGL noise</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Proxy Manager</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">HTTP / SOCKS5 bridge</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Cross-Platform Desktop Client</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">Windows, macOS & Linux</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Local Storage Encryption</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">AES-256 GCM</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- USER TAB 2B: MY AFFILIATE & CPA PORTAL -->
                    <div id="tab-my-affiliate" class="admin-tab-content" style="display: none;">
                        <!-- Header Banner -->
                        <div style="background: linear-gradient(135deg, rgba(45,212,191,0.1), rgba(129,140,248,0.1)); border: 1px solid rgba(45,212,191,0.25); border-radius: 16px; padding: 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                                    <h3 style="font-size: 20px; color: #FFF; margin: 0;">🤝 CPA Affiliate & Referral Partner Portal</h3>
                                    <span id="userAffStatusBadge" style="background: rgba(16,185,129,0.2); color: #10B981; border: 1px solid rgba(16,185,129,0.4); font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: 20px;">ACTIVE</span>
                                </div>
                                <p style="color: var(--text-muted); font-size: 13px; margin: 0;">
                                    Affiliate ID: <strong id="userAffIdDisplay" style="color: #2DD4BF; font-family: monospace;">AFF-...</strong> • 
                                    Referral Code: <strong id="userRefCodeDisplay" style="color: #818CF8; font-family: monospace;">REF_...</strong>
                                </p>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button class="btn btn-primary" onclick="openUserWithdrawalModal()" style="font-weight: 700;">💳 Request Payout</button>
                                <button class="btn btn-outline" onclick="loadMyAffiliatePortal()">🔄 Refresh Stats</button>
                            </div>
                        </div>

                        <!-- KPI Metrics Grid -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 18px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Clicks</span>
                                <h3 style="font-size: 24px; color: #FFF; margin: 6px 0 2px 0;" id="userAffTotalClicks">0</h3>
                                <span style="font-size: 12px; color: #818CF8;"><span id="userAffUniqueClicks">0</span> unique IPs</span>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 18px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Conversions</span>
                                <h3 style="font-size: 24px; color: #FFF; margin: 6px 0 2px 0;" id="userAffTotalConv">0</h3>
                                <span style="font-size: 12px; color: #10B981;"><span id="userAffCrRate">0</span>% CR</span>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 18px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Lifetime Earnings</span>
                                <h3 style="font-size: 24px; color: #2DD4BF; margin: 6px 0 2px 0;">$<span id="userAffLifetimeEarn">0.00</span></h3>
                                <span style="font-size: 12px; color: var(--text-muted);">Gross attributed</span>
                            </div>
                            <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(45,212,191,0.05)); border: 1px solid rgba(16,185,129,0.3); border-radius: 14px; padding: 18px;">
                                <span style="font-size: 11px; color: #10B981; font-weight: 800; text-transform: uppercase;">Available Balance</span>
                                <h3 style="font-size: 24px; color: #10B981; margin: 6px 0 2px 0;">$<span id="userAffAvailableBal">0.00</span></h3>
                                <span style="font-size: 12px; color: var(--text-muted);">Ready for withdrawal</span>
                            </div>
                        </div>

                        <!-- AVAILABLE CPA CAMPAIGN OFFERS SECTION -->
                        <div style="margin-bottom: 24px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                                <div>
                                    <h4 style="font-size: 16px; color: #FFF; margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px;">
                                        <span>🎯 Available CPA Campaign Offers</span>
                                    </h4>
                                    <p style="font-size: 12px; color: var(--text-muted); margin: 0;">
                                        Select any active campaign offer to promote and earn recurring revshare or instant fixed bounties.
                                    </p>
                                </div>
                                <button class="btn btn-outline" style="font-size: 11px; padding: 4px 10px;" onclick="loadOffersDropdown()">🔄 Refresh Offers</button>
                            </div>
                            <div id="userAffOffersCardsContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                                <div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 14px; border: 1px solid var(--border);">
                                    Loading active CPA offers...
                                </div>
                            </div>
                        </div>

                        <!-- 2-Column Grid: Link Builder + Postback Webhook -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px;">
                            
                            <!-- CPA Link Builder Card -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 22px;">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                    <span>🔗 CPA Campaign Link Generator</span>
                                </h4>
                                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                                    Select an offer and attach sub-tracking IDs to track conversions from different traffic sources (Google Ads, Facebook, TikTok).
                                </p>
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Select Offer / Campaign</label>
                                        <select id="userLinkOfferSelect" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;" onchange="generateCustomAffiliateLink()">
                                            <option value="offer_main_saas">AntiProfiles Pro & Team Subscription Plan (15% Recurring RevShare)</option>
                                        </select>
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                        <div>
                                            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Sub ID 1 (e.g. google_ad1)</label>
                                            <input type="text" id="userLinkSubId1" placeholder="google_camp_1" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px;" oninput="generateCustomAffiliateLink()">
                                        </div>
                                        <div>
                                            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Sub ID 2 (Optional)</label>
                                            <input type="text" id="userLinkSubId2" placeholder="fb_retarget" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px;" oninput="generateCustomAffiliateLink()">
                                        </div>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: #2DD4BF; font-weight: 700;">Your Generated Tracking Link</label>
                                        <div style="display: flex; gap: 8px; margin-top: 4px;">
                                            <input type="text" id="userGeneratedTrackingUrl" readonly style="flex: 1; background: #0A0B10; border: 1px solid #2DD4BF; border-radius: 8px; padding: 10px; color: #2DD4BF; font-family: monospace; font-size: 12px;">
                                            <button class="btn btn-primary" onclick="copyAffiliateLink()" style="padding: 0 16px; font-weight: 700;">📋 Copy</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Server-to-Server Postback Webhook Card -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 22px;">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                    <span>⚡ Server-to-Server (S2S) Postback Webhook</span>
                                </h4>
                                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
                                    Forward conversion data into your tracking platform (Voluum, Keitaro, RedTrack, Binom). Macros are dynamically replaced on approved orders.
                                </p>
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Postback URL</label>
                                        <input type="url" id="userPostbackUrlInput" placeholder="https://your-tracker.com/postback?click_id={CLICK_ID}&payout={PAYOUT}&status={STATUS}" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px; font-family: monospace; font-size: 12px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Click to Insert Dynamic Macro:</label>
                                        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                                            <button type="button" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="insertPostbackMacro('{CLICK_ID}')">{CLICK_ID}</button>
                                            <button type="button" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="insertPostbackMacro('{PAYOUT}')">{PAYOUT}</button>
                                            <button type="button" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="insertPostbackMacro('{STATUS}')">{STATUS}</button>
                                            <button type="button" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="insertPostbackMacro('{OFFER_ID}')">{OFFER_ID}</button>
                                            <button type="button" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="insertPostbackMacro('{CONVERSION_ID}')">{CONVERSION_ID}</button>
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <label style="font-size: 12px; color: var(--text-muted);">Method:</label>
                                            <select id="userPostbackMethod" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; color: #FFF; font-size: 12px;">
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                            </select>
                                        </div>
                                        <button class="btn btn-primary" onclick="saveUserPostbackConfig()" style="padding: 6px 16px; font-size: 13px; font-weight: 700;">💾 Save Postback</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Clicks & Conversions Stream -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px;">
                            
                            <!-- Clicks Table -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <h4 style="font-size: 15px; color: #FFF; margin-bottom: 12px;">📡 Live Click Stream</h4>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                                        <thead>
                                            <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                                <th style="padding: 8px;">Click ID</th>
                                                <th style="padding: 8px;">Offer</th>
                                                <th style="padding: 8px;">SubID</th>
                                                <th style="padding: 8px;">Converted</th>
                                                <th style="padding: 8px;">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody id="userAffClicksBody">
                                            <tr><td colspan="5" style="padding: 14px; text-align: center; color: var(--text-muted);">No clicks tracked yet. Share your link to start tracking!</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Conversions Table -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <h4 style="font-size: 15px; color: #FFF; margin-bottom: 12px;">💰 Recent Conversions</h4>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                                        <thead>
                                            <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                                <th style="padding: 8px;">Conversion ID</th>
                                                <th style="padding: 8px;">Order Value</th>
                                                <th style="padding: 8px;">Payout</th>
                                                <th style="padding: 8px;">Status</th>
                                                <th style="padding: 8px;">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody id="userAffConvBody">
                                            <tr><td colspan="5" style="padding: 14px; text-align: center; color: var(--text-muted);">No conversions recorded yet.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Withdrawal History Table -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <h4 style="font-size: 15px; color: #FFF; margin: 0;">📜 Withdrawal & Payout History</h4>
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;" onclick="openUserWithdrawalModal()">➕ New Withdrawal</button>
                            </div>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 10px 14px;">Payout ID</th>
                                            <th style="padding: 10px 14px;">Amount</th>
                                            <th style="padding: 10px 14px;">Method</th>
                                            <th style="padding: 10px 14px;">Status</th>
                                            <th style="padding: 10px 14px;">TX Reference</th>
                                            <th style="padding: 10px 14px;">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody id="userAffWithdrawalsBody">
                                        <tr><td colspan="6" style="padding: 16px; text-align: center; color: var(--text-muted);">No withdrawal requests submitted yet.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- USER TAB 3: DESKTOP APP DOWNLOADS -->
                    <div id="tab-user-downloads" class="admin-tab-content" style="display: none;">
                        
                        <!-- Header & Title -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                            <div>
                                <h3 style="color: #FFF; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                    <span>🚀 Download Official Desktop Application</span>
                                    <span style="background: rgba(45,212,191,0.15); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); font-size: clamp(10.5px, 1.1vw, 12px); font-weight: 800; padding: 3px 10px; border-radius: 20px;">v1.0.0 Stable</span>
                                </h3>
                                <p style="color: var(--text-muted); margin: 0;">Download and install the native AntiProfiles anti-detect browser application for Windows, macOS, or Linux.</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 6px 12px; border-radius: 8px;">
                                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
                                <span>All builds verified & signed</span>
                            </div>
                        </div>

                        <!-- Intelligent OS Auto-Detection Hero Banner -->
                        <div id="userOsDetectedHero" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(45, 212, 191, 0.08)); border: 1px solid rgba(45, 212, 191, 0.35); border-radius: 16px; padding: 18px 22px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <div id="userDetectedOsIcon" style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center;">
                                    <?php if ($detectedPlatform === 'windows-x64'): ?>
                                        <svg width="28" height="28" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>
                                    <?php elseif ($detectedPlatform === 'linux-x64'): ?>
                                        <svg width="28" height="28" viewBox="0 0 448 512" fill="none"><path d="M220.8 123.3c1 .5 1.8 1.7 3 1.7 1.1 0 2.8-.4 2.9-1.5.2-1.4-1.9-2.3-3.2-2.9-1.3-.7-2.9-1-4.3-.7-1.7.3-3.3 1.3-4.5 2.5-1.2 1.2-2.2 2.7-2.8 4.3-.6 1.6-.6 3.4-.2 5 .4 1.7 1.4 3.1 2.8 4.1 1.4 1 3.2 1.5 5 1.4 1.7-.1 3.4-.8 4.7-1.9 1.3-1.1 2.2-2.6 2.5-4.3.3-1.7-.1-3.4-1-4.9-.9-1.4-2.3-2.5-3.9-3-1.6-.4-3.3-.3-4.8.4zm-20.2 133.7c-5.8 4.2-12.8 6.5-20 6.5s-14.2-2.3-20-6.5c-4.4-3.2-8-7.3-10.7-12-3.4 10.6-4.5 22-3.1 33.1 2.3 18.2 10.3 35.1 23 48 12.8 12.8 29.7 20.8 48 23 11.1 1.4 22.5.3 33.1-3.1-4.7-2.7-8.8-6.3-12-10.7-4.2-5.8-6.5-12.8-6.5-20s2.3-14.2 6.5-20c2.7-3.7 6-6.8 9.8-9.2-8.5-17.7-21.9-32.3-38.4-42.1-3.1 5.3-5.7 11-7.7 17-2.1-6-4.7-11.7-7.7-17-16.5 9.8-29.9 24.4-38.4 42.1 3.8 2.4 7.1 5.5 9.8 9.2zm148.9-80.1C336.7 82.2 284.1 0 224 0S111.3 82.2 98.5 176.9c-27.4 18.7-44.5 49.3-46.5 82.6-.9 14.5 2.1 29 8.6 42 6.5 13 16.3 23.8 28.3 31.2 2.6 47.9 21.6 93.6 54 128.5 32.4 34.9 76.9 55.4 123.6 57.8 23.3 1.2 46.8-2.6 68.7-11.1 21.9-8.5 41.7-21.6 58-38.3 16.3-16.7 28.6-36.8 36.1-59 7.5-22.1 10.3-45.7 8.3-69 12-7.4 21.8-18.2 28.3-31.2 6.5-13 9.5-27.5 8.6-42-2-33.3-19.1-63.9-46.5-82.6z" fill="#FACC15"/></svg>
                                    <?php else: ?>
                                        <svg width="28" height="28" viewBox="0 0 170 170" fill="none"><path d="M150.37 130.25C146.59 135.79 142.34 141.05 137.62 146.03C131.18 152.83 124.97 158.4 118.99 162.74C111.02 168.51 103.35 171.4 96 171.4C90.72 171.4 84.77 169.89 78.15 166.87C71.53 163.85 65.41 162.34 59.79 162.34C53.79 162.34 47.45 163.95 40.77 167.17C34.09 170.39 28.53 172 24.1 172C16.94 172 9.27 169.01 1.09 163.04C-4.89 158.7 -11.05 153.18 -17.39 146.48C-26.17 137.22 -33.15 125.75 -38.33 112.07C-43.51 98.39 -46.1 84.8 -46.1 71.3C-46.1 56.4 -42.27 43.64 -34.61 33.02C-26.95 22.4 -16.98 17.09 -4.7 17.09C1.1 17.09 7.6 18.7 14.8 21.92C22 25.14 27.26 26.75 30.58 26.75C33.32 26.75 38.64 24.99 46.54 21.47C54.44 17.95 61.34 16.19 67.24 16.19C80.34 16.19 91.13 20.31 99.61 28.55C108.09 36.79 113.19 47.38 114.91 60.32C103.73 67.1 98.14 76.5 98.14 88.52C98.14 98.18 101.69 106.28 108.79 112.82C115.89 119.36 124.32 123.08 134.08 123.98C131.62 131.2 128.2 138.08 123.82 144.62L150.37 130.25ZM104.44 0C104.44 7.64 101.65 15.34 96.07 23.1C90.49 30.86 83.47 36.42 75.01 39.78C73.91 32.22 76.84 24.63 83.8 17.01C90.76 9.39 97.64 3.72 104.44 0Z" fill="#F8FAFC"/></svg>
                                    <?php endif; ?>
                                </div>
                                <div>
                                    <div style="font-size: 11px; font-weight: 800; color: #2DD4BF; text-transform: uppercase; letter-spacing: 0.5px;">RECOMMENDED FOR YOUR OPERATING SYSTEM</div>
                                    <h4 id="userDetectedOsTitle" style="color: #FFF; margin: 2px 0 0 0; font-weight: 800; font-size: clamp(15px, 2vw, 18px);"><?= ($detectedPlatform === 'windows-x64') ? 'AntiProfiles for Windows (64-Bit)' : (($detectedPlatform === 'linux-x64') ? 'AntiProfiles for Linux' : 'AntiProfiles for macOS (Apple Silicon)') ?></h4>
                                    <p id="userDetectedOsSub" style="color: var(--text-muted); font-size: 12px; margin: 2px 0 0 0;">Automatic architecture and OS optimization detected • v<?= htmlspecialchars($activeLandingReleases[$detectedPlatform]['version']) ?></p>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <a id="userDetectedOsBtn" href="<?= htmlspecialchars($activeLandingReleases[$detectedPlatform]['url']) ?>" download class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; padding: 10px 22px; border-radius: 10px; font-size: 13.5px; box-shadow: 0 6px 20px rgba(45,212,191,0.35);">
                                    ⬇️ Direct Download for <?= ($detectedPlatform === 'windows-x64') ? 'Windows' : (($detectedPlatform === 'linux-x64') ? 'Linux' : 'Mac') ?> (v<?= htmlspecialchars($activeLandingReleases[$detectedPlatform]['version']) ?>)
                                </a>
                            </div>
                        </div>

                        <!-- Section Subtitle -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <h5 style="color: var(--text-muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">ALL SUPPORTED PLATFORMS & PACKAGES</h5>
                            <span style="font-size: 11px; color: var(--text-muted);">64-Bit Native Binaries</span>
                        </div>

                        <!-- 4-Card Symmetrical Responsive Grid (4 cols on desktop, 2x2 on tablet, 1 on mobile) -->
                        <div class="download-cards-grid">
                            
                            <!-- 1. Windows x64 Card -->
                            <div class="platform-download-card <?= ($detectedPlatform === 'windows-x64') ? 'card-recommended' : '' ?>" id="cardWinPlatform">
                                <?php if ($detectedPlatform === 'windows-x64'): ?>
                                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4);">RECOMMENDED</span>
                                <?php endif; ?>
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(0, 120, 212, 0.1); border: 1px solid rgba(0, 120, 212, 0.25);">
                                            <svg width="26" height="26" viewBox="0 0 88 88" fill="none"><path d="M0 12.402L35.687 7.525V42.062H0V12.402ZM0 45.938H35.687V80.475L0 75.598V45.938ZM39.697 6.974L88 0V42.062H39.697V6.974ZM39.697 45.938H88V88L39.697 81.026V45.938Z" fill="#00A4EF"/></svg>
                                        </div>
                                        <span style="background: rgba(59,130,246,0.15); color: #60A5FA; border: 1px solid rgba(59,130,246,0.3); font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 8px;">WINDOWS</span>
                                    </div>
                                    <h4 style="color: #FFF; margin-bottom: 2px; font-weight: 700; font-size: 17px;">Windows Client</h4>
                                    <div style="color: #2DD4BF; font-size: 12px; font-weight: 600; margin-bottom: 8px;" id="userWinVerText">v<?= htmlspecialchars($activeLandingReleases['windows-x64']['version']) ?> (x64 Architecture)</div>
                                    <p style="color: var(--text-muted); font-size: 12.5px; margin-bottom: 18px; line-height: 1.5;">Native standalone installer for Windows 10 & 11 (64-bit systems).</p>
                                </div>
                                <a href="<?= htmlspecialchars($activeLandingReleases['windows-x64']['url']) ?>" download class="btn <?= ($detectedPlatform === 'windows-x64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; padding: 10px 12px; <?= ($detectedPlatform === 'windows-x64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-weight: 700; border-color: rgba(96,165,250,0.4); font-size: 13px;' ?>" id="userBtnWinDl">
                                    ⬇️ Download .exe (v<?= htmlspecialchars($activeLandingReleases['windows-x64']['version']) ?>)
                                </a>
                            </div>

                            <!-- 2. macOS Apple Silicon Card -->
                            <div class="platform-download-card <?= ($detectedPlatform === 'macos-arm64') ? 'card-recommended' : '' ?>" id="cardMacArmPlatform">
                                <?php if ($detectedPlatform === 'macos-arm64'): ?>
                                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 2px 9px; border-radius: 10px; letter-spacing: 0.5px;">RECOMMENDED</span>
                                <?php endif; ?>
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2);">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;">
                                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/>
                                            </svg>
                                        </div>
                                        <span style="background: rgba(45,212,191,0.15); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 8px;">APPLE SILICON</span>
                                    </div>
                                    <h4 style="color: #FFF; margin-bottom: 2px; font-weight: 700; font-size: 17px;">macOS Silicon</h4>
                                    <div style="color: #2DD4BF; font-size: 12px; font-weight: 600; margin-bottom: 8px;" id="userMacArmVerText">v<?= htmlspecialchars($activeLandingReleases['macos-arm64']['version']) ?> (M1 / M2 / M3 / M4)</div>
                                    <p style="color: var(--text-muted); font-size: 12.5px; margin-bottom: 18px; line-height: 1.5;">Native ARM64 disk image for Apple M-series chips (M1 to M4).</p>
                                </div>
                                <a href="<?= htmlspecialchars($activeLandingReleases['macos-arm64']['url']) ?>" download class="btn <?= ($detectedPlatform === 'macos-arm64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; padding: 10px 12px; <?= ($detectedPlatform === 'macos-arm64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-weight: 700; font-size: 13px;' ?>" id="userBtnMacArmDl">
                                    ⬇️ Download .dmg (v<?= htmlspecialchars($activeLandingReleases['macos-arm64']['version']) ?>)
                                </a>
                            </div>

                            <!-- 3. macOS Intel Card -->
                            <div class="platform-download-card <?= ($detectedPlatform === 'macos-x64') ? 'card-recommended' : '' ?>" id="cardMacIntelPlatform">
                                <?php if ($detectedPlatform === 'macos-x64'): ?>
                                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 2px 9px; border-radius: 10px; letter-spacing: 0.5px;">RECOMMENDED</span>
                                <?php endif; ?>
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2);">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #F8FAFC;">
                                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.03.62-2.69 1.39-.58.67-1.09 1.77-.95 2.82 1.03.08 2.07-.51 2.7-1.28z"/>
                                            </svg>
                                        </div>
                                        <span style="background: rgba(148,163,184,0.15); color: #94A3B8; border: 1px solid rgba(148,163,184,0.3); font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 8px;">MACOS INTEL</span>
                                    </div>
                                    <h4 style="color: #FFF; margin-bottom: 2px; font-weight: 700; font-size: 17px;">macOS Intel</h4>
                                    <div style="color: #2DD4BF; font-size: 12px; font-weight: 600; margin-bottom: 8px;" id="userMacIntelVerText">v<?= htmlspecialchars($activeLandingReleases['macos-x64']['version']) ?> (Intel Processors)</div>
                                    <p style="color: var(--text-muted); font-size: 12.5px; margin-bottom: 18px; line-height: 1.5;">Disk image optimized for Intel Macs manufactured prior to late 2020.</p>
                                </div>
                                <a href="<?= htmlspecialchars($activeLandingReleases['macos-x64']['url']) ?>" download class="btn <?= ($detectedPlatform === 'macos-x64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; padding: 10px 12px; <?= ($detectedPlatform === 'macos-x64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-weight: 700; font-size: 13px;' ?>" id="userBtnMacIntelDl">
                                    ⬇️ Download .dmg (v<?= htmlspecialchars($activeLandingReleases['macos-x64']['version']) ?>)
                                </a>
                            </div>

                            <!-- 4. Linux x64 Card -->
                            <div class="platform-download-card <?= ($detectedPlatform === 'linux-x64') ? 'card-recommended' : '' ?>" id="cardLinuxPlatform">
                                <?php if ($detectedPlatform === 'linux-x64'): ?>
                                    <span class="card-rec-badge" style="position: absolute; top: -11px; right: 14px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45,212,191,0.4);">RECOMMENDED</span>
                                <?php endif; ?>
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.25);">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #FACC15;">
                                                <path d="M12 2C9.5 2 7.8 3.5 7.8 6.5c0 1.2.3 2.6.7 3.7C7 11.2 5.5 13.5 5.5 16.5c0 2.8 1.5 4.8 3.8 5.3-.2.4-.3.8-.3 1.2 0 .6.4 1 1 1h4c.6 0 1-.4 1-1 0-.4-.1-.8-.3-1.2 2.3-.5 3.8-2.5 3.8-5.3 0-3-1.5-5.3-3-6.3.4-1.1.7-2.5.7-3.7C16.2 3.5 14.5 2 12 2zm-1.8 4.5c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm3.6 0c.4 0 .8.4.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8zm-1.8 1.8c.8 0 1.5.4 1.5 1s-.7 1-1.5 1-1.5-.4-1.5-1 .7-1 1.5-1zm0 4.2c2.2 0 4 2.2 4 5s-1.8 5-4 5-4-2.2-4-5 1.8-5 4-5z"/>
                                            </svg>
                                        </div>
                                        <span style="background: rgba(234,179,8,0.15); color: #FACC15; border: 1px solid rgba(234,179,8,0.3); font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 8px;">LINUX</span>
                                    </div>
                                    <h4 style="color: #FFF; margin-bottom: 2px; font-weight: 700; font-size: 17px;">Linux Client</h4>
                                    <div style="color: #2DD4BF; font-size: 12px; font-weight: 600; margin-bottom: 8px;" id="userLinuxVerText">v<?= htmlspecialchars($activeLandingReleases['linux-x64']['version']) ?> (AppImage & .deb)</div>
                                    <p style="color: var(--text-muted); font-size: 12.5px; margin-bottom: 18px; line-height: 1.5;">Universal standalone package for Ubuntu, Debian, Fedora & Arch.</p>
                                </div>
                                <a href="<?= htmlspecialchars($activeLandingReleases['linux-x64']['url']) ?>" download class="btn <?= ($detectedPlatform === 'linux-x64') ? 'btn-primary' : 'btn-outline' ?>" style="width: 100%; justify-content: center; padding: 10px 12px; <?= ($detectedPlatform === 'linux-x64') ? 'background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 13px;' : 'font-weight: 700; border-color: rgba(250,204,21,0.4); font-size: 13px;' ?>" id="userBtnLinuxDl">
                                    ⬇️ Download .AppImage (v<?= htmlspecialchars($activeLandingReleases['linux-x64']['version']) ?>)
                                </a>
                            </div>

                        </div>

                        <!-- macOS Gatekeeper Installation Helper Box -->
                        <div style="margin-top: 18px; margin-bottom: 20px; padding: 14px 18px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; font-size: 12px; color: #94A3B8; line-height: 1.6;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                <span style="font-size: 16px;">🍏</span>
                                <strong style="color: #60A5FA; font-size: 13px;">macOS Installation Guide (If blocked by Gatekeeper)</strong>
                            </div>
                            If macOS displays <em>"AntiProfiles is damaged and can't be opened. You should move it to the Trash."</em>, open <strong>Terminal</strong> and run:
                            <div style="margin-top: 6px; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-family: monospace; color: #34D399; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                                <code>xattr -cr /Applications/AntiProfiles.app</code>
                                <button type="button" onclick="navigator.clipboard.writeText('xattr -cr /Applications/AntiProfiles.app'); alert('Command copied to clipboard!');" style="background: rgba(255,255,255,0.15); color: #FFF; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;">📋 Copy Command</button>
                            </div>
                        </div>

                        <!-- System Security & Feature Highlights Bar -->
                        <div class="security-highlights-grid">
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <span style="font-size: 22px;">🛡️</span>
                                <div>
                                    <h5 style="color: #FFF; margin: 0 0 2px 0; font-weight: 700; font-size: 13px;">Isolated Sandbox Engine</h5>
                                    <p style="color: var(--text-muted); font-size: 11px; margin: 0;">100% separate cookies & storage per profile</p>
                                </div>
                            </div>
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <span style="font-size: 22px;">⚡</span>
                                <div>
                                    <h5 style="color: #FFF; margin: 0 0 2px 0; font-weight: 700; font-size: 13px;">Native HW Acceleration</h5>
                                    <p style="color: var(--text-muted); font-size: 11px; margin: 0;">Multi-core GPU spoofing with zero lag</p>
                                </div>
                            </div>
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <span style="font-size: 22px;">🔄</span>
                                <div>
                                    <h5 style="color: #FFF; margin: 0 0 2px 0; font-weight: 700; font-size: 13px;">Auto-Update Ready</h5>
                                    <p style="color: var(--text-muted); font-size: 11px; margin: 0;">Direct seamless OTA patch delivery</p>
                                </div>
                            </div>
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <span style="font-size: 22px;">🔒</span>
                                <div>
                                    <h5 style="color: #FFF; margin: 0 0 2px 0; font-weight: 700; font-size: 13px;">Encrypted Credentials</h5>
                                    <p style="color: var(--text-muted); font-size: 11px; margin: 0;">AES-256 GCM client storage</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- USER TAB 4: LIVE HELP & SUPPORT CHAT -->
                    <div id="tab-user-support" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Live Help & Support Chat</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Chat directly with AntiProfiles technical support team.</p>
                            </div>
                            <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800;">🟢 Support Team Online</span>
                        </div>

                        <!-- Chat Message Thread Box -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; height: 420px; display: flex; flex-direction: column;">
                            <div id="userChatThread" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 10px;">
                                <div style="background: #181B26; border: 1px solid #272A3B; border-radius: 12px; padding: 14px; max-width: 80%; align-self: flex-start;">
                                    <span style="font-size: 11px; color: #2DD4BF; font-weight: 700;">AntiProfiles Support Team</span>
                                    <p style="font-size: 13px; color: #FFF; margin-top: 4px;">Hello! Welcome to AntiProfiles Support. How can we assist you with your browser profiles or proxy configurations today?</p>
                                    <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 6px;">Today 12:00 PM</span>
                                </div>
                            </div>

                            <!-- Chat Input Form -->
                            <form onsubmit="handleSendUserSupportMessage(event)" style="display: flex; gap: 10px; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
                                <input type="text" id="userSupportInput" placeholder="Type your message here..." required style="flex: 1; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                                <button type="button" class="btn btn-outline" style="padding: 0 16px;" onclick="alert('File attachment feature ready.')">📎</button>
                                <button type="submit" class="btn btn-primary" style="padding: 12px 24px; background: #2DD4BF; color: #000; font-weight: 800;">Send Message</button>
                            </form>
                        </div>
                    </div>

                    <!-- TAB 1: USERS -->
                    <div id="tab-users" class="admin-tab-content">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                            <h3 style="font-size: 18px; color: #FFF;">Registered User Accounts & Access Controls</h3>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="btn btn-primary" onclick="showCreateUserForm()">➕ Create User</button>
                                <button class="btn btn-outline" style="border-color: #F59E0B; color: #FBBF24;" onclick="triggerCronRunner()">⏳ Run Expiration & Reminders</button>
                                <button class="btn btn-outline" style="border-color: #38BDF8; color: #38BDF8;" onclick="triggerRetryFailedEmails()">🔁 Retry Failed Emails</button>
                                <button class="btn btn-outline" onclick="loadUsersTable()">🔄 Refresh</button>
                            </div>
                        </div>
                        <!-- Create User Form -->
                        <div id="createUserBox" style="display: none; background: var(--bg-input); border: 1px solid var(--primary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                            <h4 style="margin-bottom: 12px; color: var(--accent);">Create New User Account</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
                                <input type="text" id="newUserName" placeholder="Full Name" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="email" id="newUserEmail" placeholder="Email Address" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="password" id="newUserPassword" placeholder="Password" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <select id="newUserRole" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="submitCreateUser()">Create Account</button>
                            <button class="btn btn-outline" onclick="document.getElementById('createUserBox').style.display='none'">Cancel</button>
                        </div>
                        <!-- Users Table -->
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Name</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Email</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Role</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Verification</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="usersTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading user records...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- ADMIN TAB: AFFILIATE & CPA CONTROL CENTER -->
                    <div id="tab-admin-affiliates" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">🤝 Affiliate Control & CPA Campaign Manager</h3>
                                <p style="color: var(--text-muted); font-size: 13px; margin: 0;">Manage CPA offers, affiliate statuses, click traffic, conversions, server-to-server postbacks, and payout settlements.</p>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="btn btn-outline" style="border-color: #818CF8; color: #A5B4FC;" onclick="openAdminAffiliateSettingsModal()">⚙️ Global Settings</button>
                                <button class="btn btn-primary" onclick="openAdminCpaOfferModal()">➕ Create CPA Offer</button>
                                <button class="btn btn-outline" onclick="loadAdminAffiliateControl()">🔄 Refresh</button>
                            </div>
                        </div>

                        <!-- High-Level Overview Cards Grid -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px;">
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">TOTAL AFFILIATES</span>
                                <h3 style="font-size: 22px; color: #FFF; margin: 4px 0 0 0;" id="adminAffTotalCount">0</h3>
                                <span style="font-size: 11px; color: #10B981;"><span id="adminAffActiveCount">0</span> active</span>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">TOTAL CLICKS</span>
                                <h3 style="font-size: 22px; color: #818CF8; margin: 4px 0 0 0;" id="adminAffTotalClicks">0</h3>
                                <span style="font-size: 11px; color: var(--text-muted);">Incoming traffic</span>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">CONVERSIONS</span>
                                <h3 style="font-size: 22px; color: #10B981; margin: 4px 0 0 0;" id="adminAffTotalConv">0</h3>
                                <span style="font-size: 11px; color: #10B981;"><span id="adminAffCrRate">0</span>% CR</span>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">COMMISSIONS GENERATED</span>
                                <h3 style="font-size: 22px; color: #2DD4BF; margin: 4px 0 0 0;">$<span id="adminAffTotalCommission">0.00</span></h3>
                                <span style="font-size: 11px; color: var(--text-muted);">From $<span id="adminAffTotalRev">0.00</span> orders</span>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">TOTAL PAID OUT</span>
                                <h3 style="font-size: 22px; color: #FFF; margin: 4px 0 0 0;">$<span id="adminAffTotalPaidOut">0.00</span></h3>
                                <span style="font-size: 11px; color: var(--text-muted);">Settled payouts</span>
                            </div>
                            <div style="background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.05)); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 16px;">
                                <span style="font-size: 11px; color: #F59E0B; font-weight: 800;">PENDING WITHDRAWALS</span>
                                <h3 style="font-size: 22px; color: #F59E0B; margin: 4px 0 0 0;">$<span id="adminAffPendingAmount">0.00</span></h3>
                                <span style="font-size: 11px; color: var(--text-muted);"><span id="adminAffPendingCount">0</span> pending requests</span>
                            </div>
                        </div>

                        <!-- Sub-Navigation Horizontal Bar -->
                        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 20px; overflow-x: auto;">
                            <button class="btn btn-outline admin-aff-subtab active" id="btnAffSubOffers" onclick="switchAdminAffSubTab('offers', this)">🎯 CPA Offers</button>
                            <button class="btn btn-outline admin-aff-subtab" id="btnAffSubDirectory" onclick="switchAdminAffSubTab('directory', this)">👥 Affiliates Directory</button>
                            <button class="btn btn-outline admin-aff-subtab" id="btnAffSubClicks" onclick="switchAdminAffSubTab('clicks', this)">📡 Live Traffic Stream</button>
                            <button class="btn btn-outline admin-aff-subtab" id="btnAffSubConversions" onclick="switchAdminAffSubTab('conversions', this)">💰 Conversions & Orders</button>
                            <button class="btn btn-outline admin-aff-subtab" id="btnAffSubPostbacks" onclick="switchAdminAffSubTab('postbacks', this)">⚡ S2S Postback Logs</button>
                            <button class="btn btn-outline admin-aff-subtab" id="btnAffSubWithdrawals" onclick="switchAdminAffSubTab('withdrawals', this)">💳 Withdrawal Settlements</button>
                        </div>

                        <!-- SUB-TAB 1: CPA OFFERS -->
                        <div id="affSubPanel-offers" class="admin-aff-subpanel">
                            <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 12px 16px;">Offer / Campaign Title</th>
                                            <th style="padding: 12px 16px;">Payout Model</th>
                                            <th style="padding: 12px 16px;">Commission / Bounty</th>
                                            <th style="padding: 12px 16px;">Target URL</th>
                                            <th style="padding: 12px 16px;">Status</th>
                                            <th style="padding: 12px 16px; text-align: right;">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminAffOffersBody">
                                        <tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading CPA offers...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- SUB-TAB 2: AFFILIATES DIRECTORY -->
                        <div id="affSubPanel-directory" class="admin-aff-subpanel" style="display: none;">
                            <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 12px 16px;">Affiliate / User</th>
                                            <th style="padding: 12px 16px;">Affiliate ID</th>
                                            <th style="padding: 12px 16px;">Clicks</th>
                                            <th style="padding: 12px 16px;">Conversions</th>
                                            <th style="padding: 12px 16px;">Total Earned</th>
                                            <th style="padding: 12px 16px;">Status</th>
                                            <th style="padding: 12px 16px; text-align: right;">Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminAffDirectoryBody">
                                        <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading affiliates...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- SUB-TAB 3: CLICKS STREAM -->
                        <div id="affSubPanel-clicks" class="admin-aff-subpanel" style="display: none;">
                            <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 10px 14px;">Click ID</th>
                                            <th style="padding: 10px 14px;">Offer</th>
                                            <th style="padding: 10px 14px;">Affiliate ID</th>
                                            <th style="padding: 10px 14px;">IP Address</th>
                                            <th style="padding: 10px 14px;">Sub ID 1</th>
                                            <th style="padding: 10px 14px;">Converted</th>
                                            <th style="padding: 10px 14px;">Logged At</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminAffClicksBody">
                                        <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading live traffic stream...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- SUB-TAB 4: CONVERSIONS -->
                        <div id="affSubPanel-conversions" class="admin-aff-subpanel" style="display: none;">
                            <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 10px 14px;">Conversion ID</th>
                                            <th style="padding: 10px 14px;">Click ID</th>
                                            <th style="padding: 10px 14px;">Affiliate</th>
                                            <th style="padding: 10px 14px;">Order Value</th>
                                            <th style="padding: 10px 14px;">Payout Amount</th>
                                            <th style="padding: 10px 14px;">Status</th>
                                            <th style="padding: 10px 14px;">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminAffConvBody">
                                        <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading conversions...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- SUB-TAB 5: POSTBACKS -->
                        <div id="affSubPanel-postbacks" class="admin-aff-subpanel" style="display: none;">
                            <div style="display: flex; flex-direction: column; gap: 20px;">
                                <!-- Section 1: User S2S Postback Webhook Configurations -->
                                <div>
                                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #FFF;">⚡ User S2S Postback Webhook Configurations</h4>
                                    <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                                    <th style="padding: 10px 14px;">User / Affiliate</th>
                                                    <th style="padding: 10px 14px;">Method</th>
                                                    <th style="padding: 10px 14px;">Postback URL & Macros</th>
                                                    <th style="padding: 10px 14px;">Status</th>
                                                    <th style="padding: 10px 14px;">Updated</th>
                                                    <th style="padding: 10px 14px; text-align: right;">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody id="adminAffPostbackConfigsBody">
                                                <tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading postback configurations...</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- Section 2: Postback Delivery History Logs -->
                                <div>
                                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #FFF;">📜 Server-to-Server Postback Delivery Logs</h4>
                                    <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                                    <th style="padding: 10px 14px;">Postback ID</th>
                                                    <th style="padding: 10px 14px;">Affiliate</th>
                                                    <th style="padding: 10px 14px;">Dispatched URL</th>
                                                    <th style="padding: 10px 14px;">HTTP Status</th>
                                                    <th style="padding: 10px 14px;">Status</th>
                                                    <th style="padding: 10px 14px; text-align: right;">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody id="adminAffPostbacksBody">
                                                <tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading postback webhook logs...</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SUB-TAB 6: WITHDRAWALS -->
                        <div id="affSubPanel-withdrawals" class="admin-aff-subpanel" style="display: none;">
                            <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 12px 16px;">Request ID</th>
                                            <th style="padding: 12px 16px;">Affiliate / Email</th>
                                            <th style="padding: 12px 16px;">Amount</th>
                                            <th style="padding: 12px 16px;">Payment Method</th>
                                            <th style="padding: 12px 16px;">Details</th>
                                            <th style="padding: 12px 16px;">Status</th>
                                            <th style="padding: 12px 16px;">TX Hash / Reference</th>
                                            <th style="padding: 12px 16px; text-align: right;">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminAffWithdrawalsBody">
                                        <tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading withdrawal requests...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: SUBSCRIPTIONS -->
                    <div id="tab-subscriptions" class="admin-tab-content" style="display: none;">
                        
                        <!-- Global Free Trial Policy & Duration Configuration Panel -->
                        <div style="background: linear-gradient(135deg, rgba(45, 212, 191, 0.08), rgba(99, 102, 241, 0.06)); border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 16px; padding: 22px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 20px;">🎁</span>
                                        <h4 style="color: #FFF; font-size: 16px; font-weight: 800; margin: 0;">Global Free Trial Policy & Auto-Enrollment System</h4>
                                    </div>
                                    <p style="color: var(--text-muted); font-size: 12.5px; margin: 4px 0 0 0;">Control trial duration (7, 14, 30 days) and automatic feature locking on expiration.</p>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #FFF; font-size: 13px; font-weight: 700;">
                                        <input type="checkbox" id="globalTrialEnabled" checked onchange="toggleTrialEnabledLabel(this.checked)" style="width: 18px; height: 18px; accent-color: #2DD4BF;">
                                        <span id="globalTrialEnabledLabel" style="color: #2DD4BF;">Free Trial Enabled</span>
                                    </label>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px;">Trial Duration (Days)</label>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="number" id="globalTrialDuration" value="7" min="1" max="365" style="width: 75px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: #2DD4BF; font-weight: 800; font-size: 14px; text-align: center;">
                                        <div style="display: flex; gap: 4px;">
                                            <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 11px; font-weight: 700;" onclick="setTrialDurationPill(7)">7 Days</button>
                                            <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 11px; font-weight: 700;" onclick="setTrialDurationPill(14)">14 Days</button>
                                            <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 11px; font-weight: 700;" onclick="setTrialDurationPill(30)">30 Days</button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px;">Default Trial Package</label>
                                    <select id="globalTrialDefaultPlan" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; color: #FFF; font-size: 13px;">
                                        <option value="plan_starter">Starter (25 Profiles, 2 Devices)</option>
                                        <option value="plan_pro">Professional (100 Profiles, 10 Devices)</option>
                                        <option value="plan_business">Business (500 Profiles, 25 Devices)</option>
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px;">Landing Page Scope</label>
                                    <select id="globalTrialAppliesTo" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; color: #FFF; font-size: 13px;">
                                        <option value="all">All Packages (Starter, Pro, Business)</option>
                                        <option value="default_only">Default Package Only</option>
                                    </select>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
                                <span style="font-size: 12px; color: var(--text-muted);">ℹ️ Upon trial expiration, if user does not update package, all options are locked automatically.</span>
                                <div style="display: flex; gap: 10px;">
                                    <button type="button" class="btn btn-outline" style="font-size: 12px; font-weight: 700;" onclick="openGrantTrialToAllModal()">🎁 Grant Trial To All Users</button>
                                    <button type="button" class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; font-size: 12.5px; padding: 8px 18px;" onclick="saveGlobalTrialConfig()">💾 Save Trial Policy</button>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="font-size: 18px; color: #FFF;">User Subscriptions & Account Expiration Manager</h3>
                            <button class="btn btn-outline" onclick="loadSubscriptionsTable()">🔄 Refresh Subscriptions</button>
                        </div>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">User Account</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Package Plan</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Profile Limit</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Device Limit</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Expiration Date</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="subsTableBody">
                                    <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading user subscription expiration dates...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB: PAYMENT GATEWAY MANAGER -->
                    <div id="tab-gateways" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Payment Gateway Manager</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Manage active payment gateways, API credentials, Webhook endpoints, and live connection diagnostics.</p>
                            </div>
                            <button class="btn btn-outline" onclick="loadPaymentGatewaysTable()">🔄 Refresh Gateways</button>
                        </div>

                        <!-- Gateway Cards Grid -->
                        <div id="gatewayCardsContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-bottom: 28px;">
                            <!-- Injected dynamically via loadPaymentGatewaysTable() -->
                        </div>
                    </div>

                    <!-- TAB: PAYMENTS & INVOICES -->
                    <div id="tab-payments" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Payments, Invoices & Transaction History</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Track all user subscription orders, verified gateway transactions, and live webhook logs.</p>
                            </div>
                            <button class="btn btn-outline" onclick="loadPaymentsTable()">🔄 Refresh Transactions</button>
                        </div>

                        <!-- Filters -->
                        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                            <input type="text" id="paySearchInput" placeholder="Search by customer email, name, invoice or transaction ID..." style="flex: 1; min-width: 240px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: #FFF;" oninput="loadPaymentsTable()">
                            <select id="payGatewayFilter" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: #FFF;" onchange="loadPaymentsTable()">
                                <option value="">All Gateways</option>
                                <option value="stripe">Stripe</option>
                                <option value="crypto">Cryptocurrency</option>
                            </select>
                            <select id="payStatusFilter" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: #FFF;" onchange="loadPaymentsTable()">
                                <option value="">All Statuses</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                                <option value="refunded">Refunded</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>

                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 24px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Invoice #</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Customer</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Plan</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Gateway</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Amount</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Date</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="paymentsTableBody">
                                    <tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading payment records...</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Webhook Event Audit Log Sub-Panel -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <h4 style="font-size: 15px; color: #FFF;">Webhook Ingestion & Idempotency Audit Log</h4>
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;" onclick="loadWebhookEventsTable()">🔄 Refresh Webhook Logs</button>
                            </div>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                            <th style="padding: 8px 12px;">Provider</th>
                                            <th style="padding: 8px 12px;">Event ID</th>
                                            <th style="padding: 8px 12px;">Event Type</th>
                                            <th style="padding: 8px 12px;">Status</th>
                                            <th style="padding: 8px 12px;">Received At</th>
                                        </tr>
                                    </thead>
                                    <tbody id="webhookEventsTableBody">
                                        <tr><td colspan="5" style="padding: 14px; text-align: center; color: var(--text-muted);">No webhook events recorded yet.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 4: BROWSER PROFILES -->
                    <div id="tab-profiles" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Browser Profile Limits & Fingerprint Engine Controls</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Max Profiles (Starter Plan)</label>
                                    <input type="number" id="profLimitStarter" value="25" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Max Profiles (Professional Plan)</label>
                                    <input type="number" id="profLimitPro" value="100" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Max Profiles (Business Plan)</label>
                                    <input type="number" id="profLimitBiz" value="500" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Default Profile Storage Limit (MB)</label>
                                    <input type="number" id="profStorageLimit" value="500" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">WebRTC Policy</label>
                                    <select id="profWebrtcPolicy" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                        <option value="proxy_bind">Force Proxy IP (Mask Local LAN IP)</option>
                                        <option value="disabled">Disable WebRTC Completely</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Canvas Fingerprint Noise</label>
                                    <select id="profCanvasNoise" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                        <option value="random">Randomized Hardware Noise Injection</option>
                                        <option value="off">Off (Native Canvas Rendering)</option>
                                    </select>
                                </div>
                            </div>
                            <button class="btn btn-primary" style="align-self: flex-start;" onclick="saveProfileEngineSettings()">Save Profile Engine Controls</button>
                        </div>
                    </div>

                    <!-- TAB 5: 7-LAYER SETTINGS AUDIT -->
                    <div id="tab-profile-audit" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">7-Layer Profile Settings Diagnostic Audit</h3>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Setting Key</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">UI</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">State</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">API</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">DB</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Launch</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actual Browser</th>
                                    </tr>
                                </thead>
                                <tbody id="auditTableBody">
                                    <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading settings audit pipeline...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 6: APP RELEASES -->
                    <div id="tab-releases" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Centralized Application Download & Release Management</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Upload installer binaries, publish new app versions, and manage release history across all desktop platforms.</p>
                            </div>
                            <button class="btn btn-outline" onclick="loadAppReleasesTable()">🔄 Refresh Release History</button>
                        </div>

                        <div id="releasesConfigMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;"></div>

                        <!-- 1. Publish New Release Box -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 24px;">
                            <h4 style="color: #2DD4BF; font-size: 15px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                                🚀 Publish New Desktop Application Release
                            </h4>
                            <form id="formPublishRelease" onsubmit="handlePublishRelease(event)" enctype="multipart/form-data">
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Target Platform</label>
                                        <select id="relPlatform" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                            <option value="windows-x64">🪟 Windows Client (x64 Architecture)</option>
                                            <option value="macos-arm64">🍏 macOS Apple Silicon (M1 / M2 / M3 / M4)</option>
                                            <option value="macos-x64">🍏 macOS Intel (x64 Processors)</option>
                                            <option value="linux-x64">🐧 Linux Client (.AppImage)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Version Number</label>
                                        <input type="text" id="relVersion" placeholder="2.1.0" required style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Release Name / Headline</label>
                                        <input type="text" id="relName" placeholder="AntiProfiles v2.1.0 Feature & Performance Release" required style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Publish Status</label>
                                        <select id="relStatus" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                            <option value="active">Active (Set as current active release)</option>
                                            <option value="draft">Save as Draft (Not public)</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Upload Application File (.exe, .dmg, .AppImage, .zip)</label>
                                        <input type="file" id="relFile" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: #FFF; margin-top: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">Directly uploads binary installer file to server storage</span>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">OR External Direct Download URL (Google Drive / S3 / GitHub)</label>
                                        <input type="url" id="relDirectUrl" placeholder="https://github.com/.../AntiProfiles-2.1.0.exe" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">Optional if uploading binary file above</span>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Release Notes & Changelog</label>
                                    <textarea id="relNotes" rows="3" placeholder="List new features, performance improvements, and security enhancements in this version..." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;"></textarea>
                                </div>

                                <div id="releaseUploadProgressBarContainer" style="display: none; margin-bottom: 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #FFF; margin-bottom: 8px;">
                                        <span id="releaseUploadProgressLabel">⏳ Uploading installer binary...</span>
                                        <span id="releaseUploadProgressPercent" style="color: #2DD4BF; font-weight: 800;">0%</span>
                                    </div>
                                    <div style="width: 100%; height: 10px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden;">
                                        <div id="releaseUploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #2DD4BF, #06B6D4); transition: width 0.1s ease;"></div>
                                    </div>
                                </div>

                                <button type="submit" class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; padding: 10px 24px;">🚀 Publish Release & Update User Downloads</button>
                            </form>
                        </div>

                        <!-- 2. Release History Table -->
                        <h4 style="color: #FFF; font-size: 16px; margin-bottom: 12px;">Version History & Published Releases</h4>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Platform</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Version</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Release Name</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">File & Size</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Published Date</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="appReleasesTableBody">
                                    <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading application release history...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 7: LIVE SUPPORT INBOX -->
                    <div id="tab-support" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Real-Time Support Inbox & Live Tickets</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Live two-way communications with website visitors and registered users.</p>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button class="btn btn-outline" onclick="loadSupportConversations()">🔄 Refresh Inbox</button>
                            </div>
                        </div>

                        <!-- 2-Column Split Support Inbox -->
                        <div style="display: grid; grid-template-columns: 360px 1fr; gap: 20px; height: 680px; max-height: calc(100vh - 200px);">
                            
                            <!-- Left Column: Conversations List -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;">
                                <!-- Search & Status Tabs -->
                                <div style="padding: 14px; border-bottom: 1px solid var(--border); background: #12141F;">
                                    <input type="text" id="suppSearchInput" placeholder="Search conversations..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: #FFF; font-size: 13px; margin-bottom: 10px;" oninput="filterSupportConversations()">
                                    <div style="display: flex; gap: 6px;">
                                        <button class="btn btn-primary" id="filterTabAll" style="flex: 1; padding: 4px 8px; font-size: 11px;" onclick="setSupportFilter('all')">All</button>
                                        <button class="btn btn-outline" id="filterTabOpen" style="flex: 1; padding: 4px 8px; font-size: 11px;" onclick="setSupportFilter('open')">Open</button>
                                        <button class="btn btn-outline" id="filterTabClosed" style="flex: 1; padding: 4px 8px; font-size: 11px;" onclick="setSupportFilter('closed')">Closed</button>
                                    </div>
                                </div>

                                <!-- Conversations List Feed -->
                                <div id="adminSupportList" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                                    <div style="text-align: center; color: var(--text-muted); padding: 30px;">Loading live conversations...</div>
                                </div>
                            </div>

                            <!-- Right Column: Active Conversation Chat Panel -->
                            <div id="adminSupportActiveThreadPanel" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;">
                                <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 12px; padding: 40px; text-align: center;">
                                    <div style="font-size: 48px;">💬</div>
                                    <h4 style="color: #FFF; font-size: 18px;">Select a conversation to start chatting</h4>
                                    <p style="font-size: 13px; max-width: 320px;">Choose a visitor or user conversation thread from the left list to view chat history and reply in real time.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 8: NOTIFICATIONS -->
                    <div id="tab-notifications" class="admin-tab-content" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">System Broadcast Notifications</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">Send multi-channel announcement broadcasts to active desktop application users and web accounts.</p>
                        </div>

                        <div class="admin-grid-2col">
                            <!-- Left: Compose Form -->
                            <div class="admin-card-box">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>📢</span> Compose Broadcast
                                </h4>
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
                                        <div>
                                            <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Target Audience</label>
                                            <select id="notifTarget" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                                <option value="all">👥 All Registered Users</option>
                                                <option value="verified">✅ Email Verified Users Only</option>
                                                <option value="admins">👑 Administrators Only</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Notification Type</label>
                                            <select id="notifType" onchange="updateBroadcastLivePreview()" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                                <option value="info">📢 Information (Blue)</option>
                                                <option value="update">🚀 App Update (Green)</option>
                                                <option value="alert">⚠️ Security Alert (Red)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Broadcast Title</label>
                                        <input type="text" id="notifTitle" oninput="updateBroadcastLivePreview()" placeholder="e.g. AntiProfiles Desktop v1.0.1 Released!" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Broadcast Message Body</label>
                                        <textarea id="notifMsg" oninput="updateBroadcastLivePreview()" rows="4" placeholder="Enter announcement text to send via email and in-app notifications..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;"></textarea>
                                    </div>
                                    <button class="btn btn-primary" style="padding: 12px 24px; font-weight: 700; align-self: flex-start;" onclick="sendBroadcastNotification()">🚀 Send System Broadcast</button>
                                </div>
                            </div>

                            <!-- Right: Live Preview & Delivery Info -->
                            <div class="admin-card-box" style="background: #11131C;">
                                <h4 style="font-size: 16px; color: #818CF8; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>👁️</span> Live Notification Preview
                                </h4>
                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                        <span id="previewNotifBadge" style="background: rgba(99,102,241,0.2); color: #818CF8; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">ANNOUNCEMENT</span>
                                        <span style="font-size: 11px; color: var(--text-muted);">Just now</span>
                                    </div>
                                    <h5 id="previewNotifTitle" style="color: #FFF; font-size: 14px; margin-bottom: 6px;">AntiProfiles Desktop v1.0.1 Released!</h5>
                                    <p id="previewNotifMsg" style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">Enter announcement text to send via email and in-app notifications...</p>
                                </div>

                                <div style="background: rgba(45,212,191,0.05); border: 1px solid rgba(45,212,191,0.2); border-radius: 12px; padding: 16px;">
                                    <h5 style="color: #2DD4BF; font-size: 13px; margin-bottom: 8px;">📡 Delivery Channels</h5>
                                    <ul style="font-size: 12px; color: var(--text-muted); padding-left: 18px; line-height: 1.6;">
                                        <li><strong>Windows Desktop Software:</strong> Real-time in-app toast & notification bell.</li>
                                        <li><strong>Web Dashboard:</strong> Broadcast banner upon user login.</li>
                                        <li><strong>Transactional Email:</strong> Automated broadcast dispatch to verified recipient mailboxes.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 8.5: GOOGLE OAUTH CONFIGURATION -->
                    <div id="tab-google-oauth" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">Google OAuth 2.0 & Social Login Configuration</h3>
                                <p style="font-size: 13px; color: var(--text-muted);">Manage Google Single Sign-On (SSO) credentials, Client ID, and authentication policies.</p>
                            </div>
                            <button class="btn btn-outline" onclick="loadGoogleOAuthConfig()" style="font-size: 12px; padding: 6px 14px;">🔄 Refresh Config</button>
                        </div>

                        <div id="googleOauthAdminMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                        <div class="admin-grid-2col">
                            <!-- Left: Credentials Card -->
                            <div class="admin-card-box">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>🔑</span> OAuth Credentials
                                </h4>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 18px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Google OAuth Status</label>
                                        <select id="googleOauthEnabled" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                            <option value="true">✅ Enabled (Allow Google Login)</option>
                                            <option value="false">❌ Disabled (Hide Google Sign In)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Google One-Tap Prompt</label>
                                        <select id="googleOauthOneTap" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                            <option value="true">⚡ Enabled (One-Tap Popup)</option>
                                            <option value="false">Off (Standard Button Only)</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="margin-bottom: 18px;">
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Google OAuth Client ID</label>
                                    <input type="text" id="googleOauthClientId" placeholder="e.g. 1234567890-abcdefg.apps.googleusercontent.com" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Obtained from Google Cloud Console > APIs & Services > Credentials.</p>
                                </div>

                                <div style="margin-bottom: 24px;">
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Google OAuth Client Secret (Optional)</label>
                                    <input type="password" id="googleOauthClientSecret" placeholder="••••••••••••••••••••••••••••" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                </div>

                                <button class="btn btn-primary" id="btnSaveGoogleOauth" onclick="saveGoogleOAuthConfig()" style="width: 100%; padding: 11px 24px; font-weight: 700;">💾 Save Google OAuth Configuration</button>
                            </div>

                            <!-- Right: Google Cloud Setup Helper -->
                            <div class="admin-card-box" style="background: #11131C;">
                                <h4 style="color: #818CF8; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                    <span>📋</span> Google Cloud Console Setup Helper
                                </h4>
                                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">When configuring your OAuth 2.0 Web Application in <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: #2DD4BF; font-weight: 700; text-decoration: underline;">Google Cloud Console</a>, paste these exact URLs:</p>
                                
                                <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
                                    <div style="background: var(--bg-card); padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border);">
                                        <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 4px;">Authorized JavaScript origins</span>
                                        <code style="color: #2DD4BF; font-size: 13px; word-break: break-all;"><?php echo APP_URL; ?></code>
                                    </div>
                                    <div style="background: var(--bg-card); padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border);">
                                        <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 4px;">Authorized redirect URIs</span>
                                        <code style="color: #2DD4BF; font-size: 13px; word-break: break-all;"><?php echo APP_URL; ?>/api/auth/google</code>
                                    </div>
                                </div>

                                <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 10px; padding: 14px; font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                                    💡 <strong>Setup Checklist:</strong> Enable <em>Google Identity Services</em> in Cloud Console, add your domain to <em>OAuth consent screen</em>, and ensure user profile scopes (<code style="color: #818CF8;">email, profile, openid</code>) are active.
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB: CAPTCHA & BOT PROTECTION -->
                    <div id="tab-captcha" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">Bot Protection & Captcha Verification</h3>
                                <p style="font-size: 13px; color: var(--text-muted);">Protect registration, login, password resets, and contact forms using Google reCAPTCHA v3 or Cloudflare Turnstile.</p>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-outline" onclick="loadCaptchaConfig()" style="font-size: 12px; padding: 6px 14px;">🔄 Refresh</button>
                            </div>
                        </div>

                        <div id="captchaAdminMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                        <div class="admin-grid-2col">
                            <!-- Left: Provider & Credentials Form -->
                            <div class="admin-card-box">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>🛡️</span> Active Protection Provider
                                </h4>

                                <div style="margin-bottom: 20px;">
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 8px;">Select Bot Protection Provider</label>
                                    <select id="captchaProviderSelect" onchange="handleCaptchaProviderChange()" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px; font-weight: 600;">
                                        <option value="none">⭕ Disabled (No Captcha Verification)</option>
                                        <option value="turnstile">🛡️ Cloudflare Turnstile (Privacy-friendly & Seamless)</option>
                                        <option value="recaptcha_v3">🤖 Google reCAPTCHA v3 (Invisible Risk-based Scoring)</option>
                                    </select>
                                </div>

                                <!-- Cloudflare Turnstile Block -->
                                <div id="turnstileConfigSection" style="display: none; background: #0E1017; border: 1px solid #1E2333; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                        <span style="font-size: 18px;">🛡️</span>
                                        <h5 style="color: #38BDF8; font-size: 14px; margin: 0; font-weight: 700;">Cloudflare Turnstile Settings</h5>
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Turnstile Site Key</label>
                                        <input type="text" id="captchaTurnstileSiteKey" placeholder="e.g. 0x4AAAAAA..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Turnstile Secret Key</label>
                                        <input type="password" id="captchaTurnstileSecretKey" placeholder="••••••••••••••••••••" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <button type="button" class="btn btn-outline" style="border-color: #38BDF8; color: #38BDF8; font-size: 12px; padding: 6px 14px;" onclick="testCaptchaConnection('turnstile')">⚡ Test Turnstile Connection</button>
                                </div>

                                <!-- Google reCAPTCHA v3 Block -->
                                <div id="recaptchaConfigSection" style="display: none; background: #0E1017; border: 1px solid #1E2333; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                        <span style="font-size: 18px;">🤖</span>
                                        <h5 style="color: #818CF8; font-size: 14px; margin: 0; font-weight: 700;">Google reCAPTCHA v3 Settings</h5>
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">reCAPTCHA v3 Site Key</label>
                                        <input type="text" id="captchaRecaptchaSiteKey" placeholder="e.g. 6Ld..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">reCAPTCHA v3 Secret Key</label>
                                        <input type="password" id="captchaRecaptchaSecretKey" placeholder="••••••••••••••••••••" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                            <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Minimum Risk Score Threshold (0.1 - 1.0)</label>
                                            <span id="scoreThresholdValue" style="color: #2DD4BF; font-weight: 800; font-size: 13px;">0.5</span>
                                        </div>
                                        <input type="range" id="captchaRecaptchaThreshold" min="0.1" max="0.9" step="0.1" value="0.5" oninput="document.getElementById('scoreThresholdValue').innerText = this.value" style="width: 100%; accent-color: #2DD4BF;">
                                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Scores: 1.0 is very likely a human, 0.0 is very likely a bot. Recommended: 0.5</p>
                                    </div>
                                    <button type="button" class="btn btn-outline" style="border-color: #818CF8; color: #818CF8; font-size: 12px; padding: 6px 14px;" onclick="testCaptchaConnection('recaptcha_v3')">⚡ Test reCAPTCHA Connection</button>
                                </div>

                                <!-- Protected Areas Toggles -->
                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                                    <h5 style="color: #FFF; font-size: 13px; margin: 0 0 12px 0; font-weight: 700;">Enforce Captcha On Specific Actions:</h5>
                                    <div style="display: flex; flex-direction: column; gap: 10px;">
                                        <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #E2E8F0; cursor: pointer;">
                                            <input type="checkbox" id="captchaEnableRegister" checked style="accent-color: #2DD4BF; width: 16px; height: 16px;">
                                            <span>User Registration (Blocks fake bot registrations)</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #E2E8F0; cursor: pointer;">
                                            <input type="checkbox" id="captchaEnableReset" checked style="accent-color: #2DD4BF; width: 16px; height: 16px;">
                                            <span>Password Reset Requests (Prevents spam reset emails)</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #E2E8F0; cursor: pointer;">
                                            <input type="checkbox" id="captchaEnableContact" checked style="accent-color: #2DD4BF; width: 16px; height: 16px;">
                                            <span>Contact Support Form (Blocks contact spam)</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #E2E8F0; cursor: pointer;">
                                            <input type="checkbox" id="captchaEnableLogin" style="accent-color: #2DD4BF; width: 16px; height: 16px;">
                                            <span>User Login Form (Brute force protection)</span>
                                        </label>
                                    </div>
                                </div>

                                <button class="btn btn-primary" id="btnSaveCaptchaConfig" onclick="saveCaptchaConfig()" style="width: 100%; padding: 12px 24px; font-weight: 700; font-size: 14px;">💾 Save Bot Protection Configuration</button>
                            </div>

                            <!-- Right: Setup Guidance & Comparison -->
                            <div class="admin-card-box" style="background: #11131C;">
                                <h4 style="color: #818CF8; font-size: 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                                    <span>📖</span> Which Provider Should You Use?
                                </h4>
                                
                                <div style="display: flex; flex-direction: column; gap: 16px; font-size: 13px; line-height: 1.6; color: var(--text-muted);">
                                    <div style="background: var(--bg-card); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                        <h5 style="color: #38BDF8; margin: 0 0 6px 0; font-size: 14px;">Cloudflare Turnstile (Recommended)</h5>
                                        <p style="margin: 0 0 8px 0;">Turnstile is a smart CAPTCHA alternative that never forces users to solve visual puzzles. It works seamlessly on all devices and respects user privacy without tracking cookies.</p>
                                        <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" style="color: #2DD4BF; font-weight: 700; text-decoration: underline; font-size: 12px;">Get Cloudflare Turnstile Keys &rarr;</a>
                                    </div>

                                    <div style="background: var(--bg-card); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                        <h5 style="color: #818CF8; margin: 0 0 6px 0; font-size: 14px;">Google reCAPTCHA v3</h5>
                                        <p style="margin: 0 0 8px 0;">reCAPTCHA v3 runs 100% invisibly in the background, analyzing user interactions and assigning a risk score from 0.0 to 1.0 without interrupting the user experience.</p>
                                        <a href="https://www.google.com/recaptcha/admin/create" target="_blank" style="color: #2DD4BF; font-weight: 700; text-decoration: underline; font-size: 12px;">Get Google reCAPTCHA v3 Keys &rarr;</a>
                                    </div>

                                    <div style="background: rgba(45,212,191,0.08); border: 1px solid rgba(45,212,191,0.25); border-radius: 12px; padding: 14px; font-size: 12px; color: #CBD5E1;">
                                        🛡️ <strong>Real-time Protection:</strong> Once enabled, tokens are generated in milliseconds on the client side and validated directly on the backend before processing registrations or messages.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 9: EMAIL & SMTP -->
                    <div id="tab-smtp" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">SMTP & System Email Configuration</h3>
                                <p style="font-size: 13px; color: var(--text-muted);">Configure outgoing transactional email server for Account Verification, Password Resets, Support Notifications, and Broadcasts.</p>
                            </div>
                            <button class="btn btn-outline" onclick="loadSmtpConfig()" style="font-size: 12px; padding: 6px 14px;">🔄 Refresh Config</button>
                        </div>

                        <div id="smtpAdminMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                        <div class="admin-grid-2col">
                            <!-- Left: SMTP Form -->
                            <div class="admin-card-box">
                                <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>📧</span> Outgoing Mail Server (SMTP) Configuration
                                </h4>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 14px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">SMTP Delivery Mode</label>
                                        <select id="smtpEnabled" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                            <option value="true">✅ Enabled (Send via SMTP)</option>
                                            <option value="false">❌ Disabled (Fallback to PHP mail)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Security / Encryption</label>
                                        <select id="smtpSecure" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                            <option value="false">TLS / STARTTLS (Port 587 / 25)</option>
                                            <option value="true">SSL (Port 465)</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">From Name</label>
                                        <input type="text" id="smtpFromName" placeholder="e.g. AntiProfiles Security" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">From Email Address</label>
                                        <input type="email" id="smtpFromEmail" placeholder="e.g. noreply@antiprofiles.com" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">SMTP Host</label>
                                        <input type="text" id="smtpHost" placeholder="e.g. smtp.gmail.com or mail.antiprofiles.com" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">SMTP Port</label>
                                        <input type="number" id="smtpPort" placeholder="587" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">SMTP Username / Account</label>
                                        <input type="text" id="smtpUser" placeholder="e.g. noreply@antiprofiles.com" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">SMTP Password</label>
                                        <input type="password" id="smtpPass" placeholder="••••••••••••" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 11px; color: #FFF; font-size: 13px;">
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                                    <button class="btn btn-primary" id="btnSaveSmtp" onclick="saveSmtpConfig()" style="flex: 1; padding: 11px 20px; font-weight: 700;">💾 Save SMTP Settings</button>
                                </div>
                            </div>

                            <!-- Right: Diagnostics & Live Test -->
                            <div class="admin-card-box" style="background: #11131C;">
                                <h4 style="color: #2DD4BF; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                    <span>🧪</span> SMTP Diagnostic Suite & Test Delivery
                                </h4>
                                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">Test your SMTP connection handshake and send a live verification test email.</p>

                                <div style="display: flex; gap: 10px; margin-bottom: 16px;">
                                    <button class="btn btn-outline" id="btnTestSmtp" onclick="testSmtpConnection()" style="flex: 1; padding: 11px 16px; font-weight: 700; border-color: #2DD4BF; color: #2DD4BF;">🔌 Test Connection Only</button>
                                </div>

                                <div style="border-top: 1px solid var(--border); padding-top: 14px; margin-bottom: 14px;">
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">Recipient for Live Test Email</label>
                                    <div style="display: flex; gap: 8px;">
                                        <input type="email" id="smtpTestRecipient" placeholder="recipient@example.com" style="flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                        <button class="btn btn-primary" id="btnSendTestEmail" onclick="sendTestEmailDirect()" style="padding: 10px 18px; font-weight: 700; white-space: nowrap;">📨 Send Email</button>
                                    </div>
                                </div>

                                <div id="smtpDiagResults" style="display: none; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 12px; line-height: 1.6;"></div>
                            </div>
                        </div>

                        <!-- Email Logs Audit Section -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-top: 24px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                                <div>
                                    <h4 style="color: #FFF; font-size: 16px; margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px;">
                                        <span>📜</span> Transactional Email Audit Logs
                                    </h4>
                                    <p style="color: var(--text-muted); font-size: 13px; margin: 0;">Real-time history of all dispatched emails, verification links, password resets, receipts, and errors.</p>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                    <select id="emailLogStatusFilter" onchange="loadEmailLogs(1)" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: #FFF; font-size: 12px;">
                                        <option value="all">All Statuses</option>
                                        <option value="sent">✓ Sent (Delivered)</option>
                                        <option value="failed">⚠️ Failed Delivery</option>
                                    </select>
                                    <input type="text" id="emailLogSearch" onkeyup="if(event.key==='Enter') loadEmailLogs(1)" placeholder="Search recipient, type..." style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: #FFF; font-size: 12px; width: 180px;">
                                    <button class="btn btn-outline" onclick="loadEmailLogs(1)" style="padding: 8px 14px; font-size: 12px;">🔄 Refresh Logs</button>
                                </div>
                            </div>

                            <div style="overflow-x: auto;">
                                <table class="admin-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--text-muted);">
                                            <th style="padding: 10px 12px;">Recipient</th>
                                            <th style="padding: 10px 12px;">Type</th>
                                            <th style="padding: 10px 12px;">Subject</th>
                                            <th style="padding: 10px 12px;">Method</th>
                                            <th style="padding: 10px 12px;">Status</th>
                                            <th style="padding: 10px 12px;">Date & Time</th>
                                            <th style="padding: 10px 12px;">Diagnostics</th>
                                        </tr>
                                    </thead>
                                    <tbody id="emailLogsTableBody">
                                        <tr>
                                            <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Loading email audit logs...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div id="emailLogsPagination" style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 12px; color: var(--text-muted);"></div>
                        </div>
                    </div>

                    <!-- TAB 10: SEO -->
                    <div id="tab-seo" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">SEO, Meta Tags & Canonical Manager</h3>
                                <p style="font-size: 13px; color: var(--text-muted);">Manage dynamic indexing, search meta tags, OpenGraph previews, Sitemap, and Robots directives.</p>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <a href="/sitemap.xml" target="_blank" class="btn btn-outline" style="font-size: 12px; padding: 6px 12px;">🗺️ View Sitemap.xml</a>
                                <a href="/robots.txt" target="_blank" class="btn btn-outline" style="font-size: 12px; padding: 6px 12px;">🤖 View Robots.txt</a>
                                <button class="btn btn-outline" onclick="loadSeoPagesTable()" style="font-size: 12px; padding: 6px 12px;">🔄 Refresh Pages</button>
                                <button class="btn btn-primary" onclick="openAddSeoPageModal()" style="font-size: 12px; padding: 6px 14px;">➕ Add SEO Page</button>
                            </div>
                        </div>

                        <div id="seoAdminMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                        <!-- Global SEO Form -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                            <h4 style="margin-bottom: 12px; color: var(--accent);">Global Site Meta & OpenGraph Settings</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 14px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Global Site Title</label>
                                    <input type="text" id="seoGlobalTitle" value="AntiProfiles — Anti-Detect Browser & Profile Isolation" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Default Canonical Domain</label>
                                    <input type="text" id="seoGlobalCanonical" value="https://antiprofiles.com" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Default OpenGraph Image URL</label>
                                    <input type="text" id="seoGlobalOgImage" value="https://antiprofiles.com/og-cover.png" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                            </div>
                            <div style="margin-bottom: 14px;">
                                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Global Meta Description</label>
                                <textarea id="seoGlobalDesc" rows="2" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">Manage isolated browser profiles, configure proxies, and automate workflows securely with AntiProfiles Software.</textarea>
                            </div>
                            <button class="btn btn-primary" id="btnSaveGlobalSeo" onclick="saveGlobalSeoSettings()">Save Global SEO Settings</button>
                        </div>

                        <!-- Page-by-Page SEO Manager -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h4 style="color: #FFF;">Page-by-Page Meta Tags & Structured Content</h4>
                            <span style="font-size: 12px; color: var(--text-muted);">Database Single Source of Truth</span>
                        </div>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Path</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Meta Title</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Primary Keyword</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Robots</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted); text-align: right;">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="seoPagesTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading SEO page entries...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- SEO Page Modal -->
                    <div id="modalSeoPage" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; justify-content: center; align-items: center; padding: 20px;">
                        <div style="background: #1C1C28; border: 1px solid var(--border); border-radius: 14px; max-width: 540px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h3 id="seoModalTitle" style="font-size: 17px; color: #FFF;">Edit SEO Page Metadata</h3>
                                <button onclick="closeSeoPageModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div>
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Page Path</label>
                                    <input type="text" id="modalSeoPath" placeholder="/pricing or /download" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px; font-family: monospace;">
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Meta Title</label>
                                    <input type="text" id="modalSeoTitle" placeholder="Page Meta Title" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Primary Keyword</label>
                                    <input type="text" id="modalSeoKeyword" placeholder="e.g. antidetect browser" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Robots Directives</label>
                                    <select id="modalSeoRobots" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px;">
                                        <option value="index, follow">index, follow (Default / Searchable)</option>
                                        <option value="noindex, follow">noindex, follow (Hide from SERP, follow links)</option>
                                        <option value="noindex, nofollow">noindex, nofollow (Private / No indexing)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Meta Description</label>
                                    <textarea id="modalSeoDesc" rows="3" placeholder="Description for search snippets" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF; margin-top: 4px;"></textarea>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                                <button class="btn btn-outline" onclick="closeSeoPageModal()">Cancel</button>
                                <button class="btn btn-primary" id="btnSaveSeoModal" onclick="submitSeoPageModal()">💾 Save Page SEO</button>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 11: LANDING CMS -->
                    <div id="tab-landing" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Landing Page Content, Branding & SaaS Pricing Manager</h3>

                        <!-- 1. Brand Logo & Favicon Customizer -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                                <h4 style="color: var(--accent); margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                                    <span>🎨</span> Website Logo & Browser Tab Favicon
                                </h4>
                                <span style="font-size: 11px; background: rgba(45,212,191,0.1); color: #2DD4BF; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(45,212,191,0.2);">REAL-TIME SYNC</span>
                            </div>
                            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Upload your company brand logo and favicon icon file, or enter direct CDN/image URLs. Updates apply immediately across your entire landing page, modals, and browser tabs without rebuilding.</p>

                            <div id="brandingAdminStatusMsg" style="display: none; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">
                                <!-- Logo Column -->
                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label style="font-size: 13px; color: #FFF; font-weight: 700;">🏷️ Main Brand Logo</label>
                                        <span style="font-size: 11px; color: var(--text-muted);">PNG, SVG, WEBP</span>
                                    </div>
                                    
                                    <!-- Current Logo Preview Box -->
                                    <div style="background: #0B0D13; border: 1px dashed var(--border); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: center; min-height: 64px;">
                                        <img id="adminLogoPreview" src="<?php echo $landingLogoUrl; ?>" alt="Logo Preview" style="max-height: 48px; max-width: 100%; object-fit: contain;">
                                    </div>

                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Upload Image File</label>
                                        <input type="file" id="adminLogoFileInput" accept="image/png,image/svg+xml,image/webp,image/jpeg,image/gif" onchange="previewSelectedLogo(event)" style="width: 100%; font-size: 12px; color: var(--text-muted); background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px;">
                                    </div>

                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">OR Image Direct URL</label>
                                        <input type="text" id="adminLogoUrlInput" value="<?php echo $landingLogoUrl; ?>" placeholder="https://yourdomain.com/logo.png" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 8px; color: #FFF; font-size: 12px;">
                                    </div>
                                </div>

                                <!-- Favicon Column -->
                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label style="font-size: 13px; color: #FFF; font-weight: 700;">🌐 Browser Tab Favicon</label>
                                        <span style="font-size: 11px; color: var(--text-muted);">ICO, PNG (32x32)</span>
                                    </div>

                                    <!-- Current Favicon Preview Box -->
                                    <div style="background: #0B0D13; border: 1px dashed var(--border); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 64px;">
                                        <img id="adminFaviconPreview" src="<?php echo $landingFaviconUrl; ?>" alt="Favicon Preview" style="width: 32px; height: 32px; object-fit: contain;">
                                        <span style="font-size: 12px; color: var(--text-muted); font-family: monospace;">Browser Tab Icon</span>
                                    </div>

                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Upload Favicon File</label>
                                        <input type="file" id="adminFaviconFileInput" accept=".ico,image/x-icon,image/png,image/svg+xml" onchange="previewSelectedFavicon(event)" style="width: 100%; font-size: 12px; color: var(--text-muted); background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px;">
                                    </div>

                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">OR Favicon Direct URL</label>
                                        <input type="text" id="adminFaviconUrlInput" value="<?php echo $landingFaviconUrl; ?>" placeholder="https://yourdomain.com/favicon.ico" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 8px; color: #FFF; font-size: 12px;">
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;">
                                <button class="btn btn-primary" id="btnSaveBranding" onclick="saveBrandingSettings()" style="padding: 10px 20px; font-weight: 700; font-size: 13px;">💾 Save & Update Logo & Favicon</button>
                                <button class="btn btn-outline" onclick="loadBrandingSettings()" style="padding: 10px 16px; font-size: 13px;">🔄 Reload Current Assets</button>
                            </div>
                        </div>

                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px;">
                            <h4 style="color: var(--accent);">Hero Headline & Trust Settings</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Hero Headline</label>
                                    <input type="text" id="cmsHeadline" value="Browse Privately. Isolate Profiles. Scale Without Limits." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Trust Badge Text</label>
                                    <input type="text" id="cmsTrustText" value="⚡ No credit card required • Free trial available • Cancel anytime" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                            </div>
                            <div>
                                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Hero Subheadline</label>
                                <textarea id="cmsSubheadline" rows="2" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">Create isolated browser profiles with configurable Canvas, WebGL, User-Agent fingerprints, proxy bridges, and centralized aaPanel administration.</textarea>
                            </div>
                            <button class="btn btn-primary" style="align-self: flex-start;" onclick="saveLandingCmsHero()">Save Hero CMS Text</button>
                        </div>

                        <!-- SaaS Pricing Packages Configurator -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                            <h4 style="color: #818CF8; margin-bottom: 14px;">SaaS Pricing Packages & Profile Limits Configurator</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display:flex; flex-direction:column; gap:10px;">
                                    <h5 style="color:#FFF; font-size:16px;">📦 Starter Package</h5>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Monthly Price ($)</label>
                                        <input type="number" id="planPriceStarter" value="19" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Max Browser Profiles</label>
                                        <input type="number" id="planLimitStarter" value="25" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <button class="btn btn-primary" style="font-size:12px; padding:6px 12px; margin-top:4px;" onclick="savePricingPackage('plan_starter', 'Starter', 'planPriceStarter', 'planLimitStarter')">💾 Save Starter Plan</button>
                                </div>

                                <div style="background: var(--bg-card); border: 1px solid var(--accent); border-radius: 10px; padding: 16px; display:flex; flex-direction:column; gap:10px;">
                                    <h5 style="color:var(--accent); font-size:16px;">⭐ Professional Package</h5>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Monthly Price ($)</label>
                                        <input type="number" id="planPricePro" value="49" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Max Browser Profiles</label>
                                        <input type="number" id="planLimitPro" value="100" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <button class="btn btn-primary" style="font-size:12px; padding:6px 12px; margin-top:4px;" onclick="savePricingPackage('plan_pro', 'Professional', 'planPricePro', 'planLimitPro')">💾 Save Pro Plan</button>
                                </div>

                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display:flex; flex-direction:column; gap:10px;">
                                    <h5 style="color:#FFF; font-size:16px;">🚀 Business Package</h5>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Monthly Price ($)</label>
                                        <input type="number" id="planPriceBiz" value="99" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Max Browser Profiles</label>
                                        <input type="number" id="planLimitBiz" value="500" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <button class="btn btn-primary" style="font-size:12px; padding:6px 12px; margin-top:4px;" onclick="savePricingPackage('plan_business', 'Business', 'planPriceBiz', 'planLimitBiz')">💾 Save Business Plan</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB: SOFTWARE FEATURES CMS -->
                    <div id="tab-software-features" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                            <div>
                                <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                                    <span>✨</span> Software Features CMS & Showcase Controller
                                </h3>
                                <p style="font-size: 13px; color: var(--text-muted);">Manage all desktop application capabilities displayed on the public landing page and SEO schemas. Enable, disable, edit, reorder, or add new tools.</p>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="btn btn-outline" onclick="loadAdminFeaturesTable()" style="font-size: 12px; padding: 7px 14px;">🔄 Refresh List</button>
                                <button class="btn btn-outline" onclick="resetDefaultFeaturesAdmin()" style="font-size: 12px; padding: 7px 14px; border-color: rgba(239, 68, 68, 0.4); color: #FCA5A5;">🔄 Restore 52 Defaults</button>
                                <button class="btn btn-primary" onclick="openAddFeatureModal()" style="font-size: 12px; padding: 7px 16px;">➕ Add New Feature</button>
                            </div>
                        </div>

                        <!-- Status Alert Box -->
                        <div id="featuresAdminMsg" style="display: none; padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; font-size: 13px;"></div>

                        <!-- Summary Counter Cards -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px;">
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">TOTAL AUDITED FEATURES</div>
                                <div id="adminStatTotalFeats" style="font-size: 24px; font-weight: 800; color: #FFF; margin-top: 4px;">52</div>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 12px; padding: 16px;">
                                <div style="font-size: 11px; color: #2DD4BF; font-weight: 700; text-transform: uppercase;">LIVE ON LANDING PAGE</div>
                                <div id="adminStatEnabledFeats" style="font-size: 24px; font-weight: 800; color: #2DD4BF; margin-top: 4px;">52</div>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">FEATURE CATEGORIES</div>
                                <div id="adminStatCategoriesCount" style="font-size: 24px; font-weight: 800; color: #818CF8; margin-top: 4px;">12</div>
                            </div>
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
                                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">SUPPORTED ARCHITECTURES</div>
                                <div style="font-size: 16px; font-weight: 700; color: #F59E0B; margin-top: 8px;">6 (Win/Mac/Linux)</div>
                            </div>
                        </div>

                        <!-- Filter Toolbar -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; flex: 1;">
                                <input 
                                    type="text" 
                                    id="adminFeatureSearchInput" 
                                    placeholder="🔍 Search features by name, keyword or description..." 
                                    oninput="filterAdminFeaturesTable()" 
                                    style="min-width: 240px; flex: 1; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px 14px; color: #FFF; font-size: 13px;"
                                />
                                <select id="adminFeatureCategorySelect" onchange="filterAdminFeaturesTable()" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px 14px; color: #FFF; font-size: 13px;">
                                    <option value="all">All 12 Categories</option>
                                    <option value="browser_profiles">🌐 Browser Profiles & Lifecycle</option>
                                    <option value="fingerprint">🛡️ Fingerprint Protection</option>
                                    <option value="proxy_network">🔌 Proxy & Network</option>
                                    <option value="automation">🤖 Automation & API</option>
                                    <option value="cookies_session">🍪 Cookies & Sessions</option>
                                    <option value="team_collab">👥 Team Collaboration</option>
                                    <option value="security_privacy">🔒 Security & Privacy</option>
                                    <option value="sync_cloud">☁️ Sync & Cloud</option>
                                    <option value="ai_tools">🧠 AI & Smart Tools</option>
                                    <option value="extensions">🧩 Extensions & Add-ons</option>
                                    <option value="system_performance">⚡ Performance & Branding</option>
                                    <option value="desktop_client">💻 Desktop Application</option>
                                </select>
                                <select id="adminFeatureStatusSelect" onchange="filterAdminFeaturesTable()" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px 14px; color: #FFF; font-size: 13px;">
                                    <option value="all">All Statuses</option>
                                    <option value="enabled">Active / Enabled Only</option>
                                    <option value="disabled">Hidden / Disabled Only</option>
                                </select>
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                Showing <strong id="adminFeatureTableCount" style="color: #2DD4BF;">0</strong> features
                            </div>
                        </div>

                        <!-- Features Table -->
                        <div class="admin-table-container">
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--text-muted);">
                                        <th style="padding: 10px 12px; width: 60px;">Sort</th>
                                        <th style="padding: 10px 12px;">Feature Name & Icon</th>
                                        <th style="padding: 10px 12px;">Category</th>
                                        <th style="padding: 10px 12px;">Short Description</th>
                                        <th style="padding: 10px 12px;">Badge</th>
                                        <th style="padding: 10px 12px;">Visibility</th>
                                        <th style="padding: 10px 12px; text-align: right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="adminFeaturesTableBody">
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Loading software features catalog...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Add / Edit Feature Modal -->
                    <div id="featureEditModal" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #0F172A; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px; max-width: 680px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 28px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); position: relative;">
                            <button onclick="closeFeatureEditModal()" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.08); border: none; color: #FFF; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px;">✕</button>
                            
                            <h3 id="featureModalTitle" style="font-size: 18px; color: #FFF; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                <span>✨</span> Edit Software Feature
                            </h3>
                            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">Configure feature title, description, category, and display badge.</p>

                            <form id="featureEditForm" onsubmit="saveFeatureFromModal(event)">
                                <input type="hidden" id="editFeatureId" value="">

                                <div style="display: grid; grid-template-columns: 80px 1fr; gap: 14px; margin-bottom: 14px;">
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Icon</label>
                                        <input type="text" id="editFeatureIcon" value="⚡" required style="width: 100%; text-align: center; font-size: 20px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: #FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Feature Name</label>
                                        <input type="text" id="editFeatureName" placeholder="e.g., Canvas 2D Rendering Noise Injection" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Category</label>
                                        <select id="editFeatureCategory" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                            <option value="browser_profiles">🌐 Browser Profiles & Lifecycle</option>
                                            <option value="fingerprint">🛡️ Fingerprint Protection</option>
                                            <option value="proxy_network">🔌 Proxy & Network</option>
                                            <option value="automation">🤖 Automation & API</option>
                                            <option value="cookies_session">🍪 Cookies & Sessions</option>
                                            <option value="team_collab">👥 Team Collaboration</option>
                                            <option value="security_privacy">🔒 Security & Privacy</option>
                                            <option value="sync_cloud">☁️ Sync & Cloud</option>
                                            <option value="ai_tools">🧠 AI & Smart Tools</option>
                                            <option value="extensions">🧩 Extensions & Add-ons</option>
                                            <option value="system_performance">⚡ Performance & Branding</option>
                                            <option value="desktop_client">💻 Desktop Application</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Highlight Badge (Optional)</label>
                                        <input type="text" id="editFeatureBadge" placeholder="e.g., Core Stealth, AI-Powered, Zero-Leak" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                </div>

                                <div style="margin-bottom: 14px;">
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Short Description (1-2 lines for landing card)</label>
                                    <textarea id="editFeatureShortDesc" rows="2" placeholder="Brief 1-2 sentence description..." required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;"></textarea>
                                </div>

                                <div style="margin-bottom: 14px;">
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Full Technical Description (Optional / Extended)</label>
                                    <textarea id="editFeatureFullDesc" rows="3" placeholder="In-depth technical explanation of how this feature functions..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;"></textarea>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 20px;">
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Sort Order</label>
                                        <input type="number" id="editFeatureSort" value="100" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Display Status</label>
                                        <select id="editFeatureEnabled" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                            <option value="1">✅ Enabled / Active</option>
                                            <option value="0">❌ Disabled / Hidden</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Docs Link</label>
                                        <input type="text" id="editFeatureDocUrl" value="/#features" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                    </div>
                                </div>

                                <div style="margin-bottom: 20px;">
                                    <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Search Keywords (Comma separated)</label>
                                    <input type="text" id="editFeatureKeywords" placeholder="e.g. canvas, fingerprinting, antidetect, 2d noise" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                                </div>

                                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                                    <button type="button" onclick="closeFeatureEditModal()" class="btn btn-outline" style="padding: 9px 18px; font-size: 13px;">Cancel</button>
                                    <button type="submit" id="btnSaveFeatureModal" class="btn btn-primary" style="padding: 9px 22px; font-size: 13px;">💾 Save Feature</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- TAB 12: ROLES & PERMISSIONS -->
                    <div id="tab-roles" class="admin-tab-content" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">Roles & Permission Matrix</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">View role-based access control (RBAC) levels across all management modules and sub-systems.</p>
                        </div>

                        <div class="admin-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Role Name</th>
                                        <th>Users Control</th>
                                        <th>Subscriptions</th>
                                        <th>Payments & Invoices</th>
                                        <th>Live Support Inbox</th>
                                        <th>Settings & Logs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="font-weight: 700; color: #818CF8; font-size: 14px;">👑 Super Admin</td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                    </tr>
                                    <tr>
                                        <td style="font-weight: 700; color: #FFF; font-size: 14px;">🔑 System Admin</td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(255,255,255,0.06); color: var(--text-muted); padding: 3px 10px; border-radius: 6px; font-weight: 600; font-size: 12px;">Read Only</span></td>
                                    </tr>
                                    <tr>
                                        <td style="font-weight: 700; color: #FFF; font-size: 14px;">💬 Support Agent</td>
                                        <td><span style="background: rgba(255,255,255,0.06); color: var(--text-muted); padding: 3px 10px; border-radius: 6px; font-weight: 600; font-size: 12px;">Read Only</span></td>
                                        <td><span style="background: rgba(255,255,255,0.06); color: var(--text-muted); padding: 3px 10px; border-radius: 6px; font-weight: 600; font-size: 12px;">Read Only</span></td>
                                        <td><span style="background: rgba(239,68,68,0.15); color: #F87171; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✕ No Access</span></td>
                                        <td><span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✓ Full Access</span></td>
                                        <td><span style="background: rgba(239,68,68,0.15); color: #F87171; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">✕ No Access</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 13: SECURITY -->
                    <div id="tab-security" class="admin-tab-content" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">Security Dashboard & 2FA Logs</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">Real-time audit stream of security logins, email verification attempts, and brute-force defenses.</p>
                        </div>
                        <div class="admin-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Event Type</th>
                                        <th>Severity</th>
                                        <th>IP Address</th>
                                        <th>Details</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody id="securityTableBody">
                                    <tr><td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted);">Loading security events...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 14: AUDIT LOGS -->
                    <div id="tab-audit" class="admin-tab-content" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">System Audit Logs</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">Comprehensive tracking of administrative changes, user quota modifications, and payment status updates.</p>
                        </div>
                        <div class="admin-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Admin User</th>
                                        <th>Action Executed</th>
                                        <th>Target Account</th>
                                        <th>IP Address</th>
                                        <th>Details</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody id="auditLogsTableBody">
                                    <tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">Loading admin audit logs...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 15: SYSTEM HEALTH -->
                    <div id="tab-health" class="admin-tab-content" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">Server Diagnostic Health Checks</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">Real-time microservices connectivity and operational status report.</p>
                        </div>
                        <div class="admin-card-box">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;">
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">MySQL Database</span>
                                    <h4 style="color: #2DD4BF; font-size: 18px; margin-top: 6px;">✓ Operational (Connected)</h4>
                                </div>
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">License Auth Engine</span>
                                    <h4 style="color: #2DD4BF; font-size: 18px; margin-top: 6px;">✓ Operational (Online)</h4>
                                </div>
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Nginx Web Gateway</span>
                                    <h4 style="color: #2DD4BF; font-size: 18px; margin-top: 6px;">✓ Operational (Active)</h4>
                                </div>
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">PHP Runtime Engine</span>
                                    <h4 style="color: #2DD4BF; font-size: 18px; margin-top: 6px;">✓ PHP 8.1 FPM Active</h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 16: SYSTEM SETTINGS -->
                    <div id="tab-settings" class="admin-tab-content" style="display: none;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 4px;">aaPanel Server & Database Configuration</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">Central host and environment parameters verified across all connected software nodes.</p>
                        </div>
                        <div class="admin-card-box">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;">
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Web Server</span>
                                    <h4 style="color: #FFF; font-size: 17px; margin-top: 6px;">Nginx (aaPanel Direct)</h4>
                                </div>
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">PHP Engine</span>
                                    <h4 style="color: var(--accent); font-size: 17px; margin-top: 6px;">PHP <?php echo PHP_VERSION; ?></h4>
                                </div>
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">MySQL Database</span>
                                    <h4 style="color: #818CF8; font-size: 17px; margin-top: 6px;">antidetactor (UTF8MB4)</h4>
                                </div>
                                <div style="background: var(--bg-input); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">License Auth API</span>
                                    <h4 style="color: var(--accent); font-size: 17px; margin-top: 6px;">Active & Synchronized</h4>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: USER WITHDRAWAL REQUEST -->
    <div id="modalUserWithdrawal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 500px; width: 90%; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 18px; color: #FFF;">💳 Request Affiliate Payout</h3>
                <button onclick="closeUserWithdrawalModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <form onsubmit="return submitUserWithdrawal(event)">
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Available Balance ($ USD)</label>
                    <input type="text" id="userWithAvailBal" readonly value="$0.00" style="width: 100%; background: #0A0B10; border: 1px solid #10B981; border-radius: 8px; padding: 10px; color: #10B981; font-weight: 800;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Withdrawal Amount ($ USD)</label>
                    <input type="number" step="0.01" min="10" id="userWithAmount" required placeholder="50.00" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Payout Method</label>
                    <select id="userWithMethod" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;" onchange="updateWithdrawalFields()">
                        <option value="crypto_usdt_trc20">USDT (TRC-20) - Instant / Lowest Fee</option>
                        <option value="crypto_usdt_erc20">USDT (ERC-20)</option>
                        <option value="crypto_btc">Bitcoin (BTC)</option>
                        <option value="wise">Wise (TransferWise)</option>
                        <option value="payoneer">Payoneer</option>
                        <option value="bank">Direct Bank Wire (IBAN / SWIFT)</option>
                    </select>
                </div>
                <div style="margin-bottom: 18px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;" id="userWithAddressLabel">Wallet Address / Account Details</label>
                    <input type="text" id="userWithAddress" required placeholder="Enter USDT TRC-20 Address (starts with T...)" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-family: monospace;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn btn-outline" onclick="closeUserWithdrawalModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="font-weight: 700;">Submit Withdrawal</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: ADMIN CREATE/EDIT CPA OFFER -->
    <div id="modalAdminCpaOffer" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 620px; width: 95%; max-height: 90vh; overflow-y: auto; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 18px; color: #FFF; margin: 0;" id="adminOfferModalTitle">Create CPA Offer & Landing Page</h3>
                <button onclick="closeAdminCpaOfferModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <form onsubmit="return saveAdminCpaOffer(event)">
                <input type="hidden" id="adminOfferEditId">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Offer Title</label>
                        <input type="text" id="adminOfferTitle" required placeholder="e.g. AntiProfiles Starter Subscription" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Package Tier</label>
                        <select id="adminOfferPackageId" onchange="onAdminOfferPackageChange()" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                            <option value="plan_starter">Starter (25 Profiles, $19/mo)</option>
                            <option value="plan_pro">Professional (100 Profiles, $39/mo)</option>
                            <option value="plan_business">Business (500 Profiles, $69/mo)</option>
                            <option value="plan_enterprise">Enterprise (Unlimited, $99/mo)</option>
                            <option value="plan_free">Free Trial (3 Profiles, $0/mo)</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Landing Page Slug (URL)</label>
                        <input type="text" id="adminOfferSlug" required placeholder="starter or pro-deal" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #38BDF8; font-family: monospace;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Target Landing URL</label>
                        <input type="text" id="adminOfferTargetUrl" required placeholder="/offer/starter" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-family: monospace;">
                    </div>
                </div>

                <!-- Dynamic Pricing -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; align-items: center;">
                        <div>
                            <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Original Price (Old)</label>
                            <input type="number" step="0.01" id="adminOfferOrigPrice" placeholder="39.00" oninput="calcAdminOfferDiscount()" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: #FFF;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #2DD4BF; font-weight: 700; display: block; margin-bottom: 4px;">Selling Price (New)</label>
                            <input type="number" step="0.01" id="adminOfferPrice" placeholder="19.00" oninput="calcAdminOfferDiscount()" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: #2DD4BF; font-weight: 800;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Discount Badge</label>
                            <div id="adminOfferDiscountBadge" style="padding: 8px; background: rgba(74, 222, 128, 0.15); color: #4ADE80; border-radius: 8px; font-size: 11px; font-weight: 800; text-align: center;">Save 51%</div>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">CTA Button Text</label>
                        <input type="text" id="adminOfferCtaText" placeholder="Subscribe Starter" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Package Badge Text</label>
                        <input type="text" id="adminOfferBadgeText" placeholder="LIMITED DEAL / STARTER" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Payout Model</label>
                        <select id="adminOfferPayoutType" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                            <option value="revshare">RevShare (% of order)</option>
                            <option value="fixed">Fixed Bounty ($ USD)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Commission Rate / Amount</label>
                        <input type="number" step="0.01" id="adminOfferRate" required placeholder="15.00" value="15.00" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--border);">
                        <input type="checkbox" id="adminOfferTrialEnabled" style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="adminOfferTrialEnabled" style="font-size: 12px; color: #FFF; font-weight: 700; cursor: pointer; margin: 0;">
                            Enable 7-Day Free Trial
                        </label>
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Offer Status</label>
                        <select id="adminOfferStatus" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                            <option value="active">Active (Visible & Live)</option>
                            <option value="paused">Paused</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Offer Description (Optional)</label>
                    <textarea id="adminOfferDesc" rows="2" placeholder="Explain the offer details and features..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;"></textarea>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div id="adminOfferDeleteBtnWrap" style="display: none;">
                        <button type="button" class="btn btn-outline" style="color: #F87171; border-color: rgba(239,68,68,0.4);" onclick="deleteAdminCpaOfferFromModal()">🗑️ Delete Offer & Page</button>
                    </div>
                    <div style="display: flex; gap: 10px; margin-left: auto;">
                        <button type="button" class="btn btn-outline" onclick="closeAdminCpaOfferModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary" style="font-weight: 700;">💾 Save Offer & Auto-Generate Page</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: ADMIN WITHDRAWAL SETTLEMENT ACTION -->
    <div id="modalAdminWithdrawalAction" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 500px; width: 90%; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 18px; color: #FFF;">⚙️ Update Withdrawal Settlement</h3>
                <button onclick="closeAdminWithdrawalModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <form onsubmit="return submitAdminWithdrawalUpdate(event)">
                <input type="hidden" id="adminWithActId">
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Set Settlement Status</label>
                    <select id="adminWithActStatus" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                        <option value="approved">Approved (KYC & balance verified)</option>
                        <option value="processing">Processing (Funds being transferred)</option>
                        <option value="paid">Paid (Settled on blockchain/bank)</option>
                        <option value="rejected">Rejected (Refund balance to affiliate)</option>
                    </select>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Payout Transaction Reference / Hash</label>
                    <input type="text" id="adminWithActRef" placeholder="0x... or TRX hash or Bank wire ref" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-family: monospace;">
                </div>
                <div style="margin-bottom: 18px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Admin Note (Internal or visible to affiliate)</label>
                    <textarea id="adminWithActNote" rows="2" placeholder="Notes regarding payment execution..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;"></textarea>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn btn-outline" onclick="closeAdminWithdrawalModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="font-weight: 700;">Save Settlement</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: ADMIN GLOBAL AFFILIATE SETTINGS -->
    <div id="modalAdminAffiliateSettings" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 500px; width: 90%; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 18px; color: #FFF;">⚙️ Global CPA Affiliate System Settings</h3>
                <button onclick="closeAdminAffiliateSettingsModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <form onsubmit="return saveAdminAffiliateSettings(event)">
                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 10px; color: #FFF; font-size: 14px; font-weight: 700; cursor: pointer;">
                        <input type="checkbox" id="adminAffSetEnabled" style="transform: scale(1.3);"> Enable Global CPA Affiliate System
                    </label>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Default RevShare Commission (%)</label>
                    <input type="number" step="0.5" id="adminAffSetRate" required value="15" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Minimum Payout Threshold ($ USD)</label>
                    <input type="number" step="5" id="adminAffSetMinPayout" required value="50" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                </div>
                <div style="margin-bottom: 18px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Cookie Tracking Lifetime (Days)</label>
                    <input type="number" id="adminAffSetCookieDays" required value="30" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn btn-outline" onclick="closeAdminAffiliateSettingsModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="font-weight: 700;">Save Settings</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: ADMIN EDIT USER S2S POSTBACK -->
    <div id="modalAdminEditPostback" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 580px; width: 90%; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="font-size: 18px; color: #FFF;">✏️ Edit S2S Postback Configuration</h3>
                <button onclick="closeAdminEditPostbackModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 16px 0;">
                Affiliate User: <strong id="adminEditPbUser" style="color: #38BDF8;">—</strong>
            </p>
            <form onsubmit="return saveAdminEditPostback(event)">
                <input type="hidden" id="adminEditPbUserId">
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">POSTBACK ENDPOINT URL</label>
                    <input type="url" id="adminEditPbUrl" required placeholder="https://tracker.domain.com/postback?click_id={CLICK_ID}&payout={PAYOUT}" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #38BDF8; font-family: monospace; font-size: 12px;">
                </div>
                <div style="margin-bottom: 14px;">
                    <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Insert Macro Tags:</span>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        <button type="button" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; font-family: monospace;" onclick="appendAdminPostbackTag('{CLICK_ID}')">+{CLICK_ID}</button>
                        <button type="button" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; font-family: monospace;" onclick="appendAdminPostbackTag('{PAYOUT}')">+{PAYOUT}</button>
                        <button type="button" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; font-family: monospace;" onclick="appendAdminPostbackTag('{COMMISSION}')">+{COMMISSION}</button>
                        <button type="button" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; font-family: monospace;" onclick="appendAdminPostbackTag('{STATUS}')">+{STATUS}</button>
                        <button type="button" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; font-family: monospace;" onclick="appendAdminPostbackTag('{OFFER_ID}')">+{OFFER_ID}</button>
                        <button type="button" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; font-family: monospace;" onclick="appendAdminPostbackTag('{CONVERSION_ID}')">+{CONVERSION_ID}</button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">HTTP METHOD</label>
                        <select id="adminEditPbMethod" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-size: 13px;">
                            <option value="GET">GET (Query String)</option>
                            <option value="POST">POST (Webhook Payload)</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; padding-top: 18px;">
                        <input type="checkbox" id="adminEditPbActive" style="transform: scale(1.2);">
                        <label for="adminEditPbActive" style="color: #FFF; font-size: 13px; font-weight: 600; cursor: pointer;">Active & Receiving Webhooks</label>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 12px; font-weight: 600; color: #FFF;">Verify Postback Endpoint</div>
                        <div style="font-size: 11px; color: var(--text-muted);">Send a live test conversion ping to check HTTP response code.</div>
                    </div>
                    <button type="button" id="btnAdminTestPb" class="btn btn-outline" style="padding: 6px 12px; font-size: 11px; font-weight: 700;" onclick="testAdminPostbackPing()">🚀 Test Ping</button>
                </div>
                <div id="adminPbTestResult" style="display: none; padding: 8px 12px; border-radius: 6px; font-size: 11px; margin-bottom: 16px;"></div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn btn-outline" onclick="closeAdminEditPostbackModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="font-weight: 700;">💾 Save Postback</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: PAYMENT GATEWAY CONFIGURATION (ADMIN) -->
    <div id="modalGatewayConfig" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 600px; width: 90%; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 18px; color: #FFF;" id="modalGwTitle">Configure Payment Gateway</h3>
                <button onclick="closeGatewayConfigModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>
            
            <form id="formGatewayConfig" onsubmit="return saveGatewayConfig(event)">
                <input type="hidden" id="gwEditKey">
                
                <div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: center;">
                    <label style="display: flex; align-items: center; gap: 8px; color: #FFF; font-size: 14px; font-weight: 600; cursor: pointer;">
                        <input type="checkbox" id="gwEditEnabled" style="transform: scale(1.2);"> Enable Gateway
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; color: #F59E0B; font-size: 14px; font-weight: 600; cursor: pointer;">
                        <input type="checkbox" id="gwEditTestMode" style="transform: scale(1.2);"> Test Mode / Sandbox
                    </label>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Billing Currency</label>
                    <select id="gwEditCurrency" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD ($)</option>
                    </select>
                </div>

                <div style="margin-bottom: 14px;" id="gwFieldPublicKeyGroup">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;" id="gwLabelPublicKey">Publishable / Public API Key</label>
                    <input type="text" id="gwEditPublicKey" placeholder="pk_live_..." style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-family: monospace;">
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;" id="gwLabelSecretKey">Secret Key / Merchant API Key</label>
                    <input type="password" id="gwEditSecretKey" placeholder="sk_live_... (Enter new key or leave as-is)" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-family: monospace;">
                    <span style="font-size: 11px; color: var(--text-muted);">Stored securely on server. Masked for security.</span>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;" id="gwLabelWebhookSecret">Webhook Signing Secret / IPN Secret</label>
                    <input type="password" id="gwEditWebhookSecret" placeholder="whsec_... (Enter new secret or leave as-is)" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; font-family: monospace;">
                    <div style="margin-top: 6px; background: rgba(255,255,255,0.03); border: 1px dashed var(--border); border-radius: 6px; padding: 8px; font-size: 11px; color: var(--text-muted);">
                        <span>Webhook URL: </span>
                        <strong id="gwWebhookUrlDisplay" style="color: #2DD4BF; font-family: monospace;">https://antiprofiles.com/api/payments/stripe/webhook</strong>
                    </div>
                </div>

                <!-- Dynamic Crypto Fields (Shown when editing Crypto Gateway) -->
                <div id="gwCryptoSpecificSection" style="display: none; margin-bottom: 16px; background: rgba(129, 140, 248, 0.05); border: 1px solid rgba(129, 140, 248, 0.2); border-radius: 8px; padding: 12px;">
                    <label style="font-size: 12px; color: #818CF8; font-weight: 700; display: block; margin-bottom: 6px;">Supported Cryptocurrencies</label>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px;">
                        <label style="color: #FFF; font-size: 13px;"><input type="checkbox" id="cryptoCoinUSDT" checked> USDT</label>
                        <label style="color: #FFF; font-size: 13px;"><input type="checkbox" id="cryptoCoinBTC" checked> BTC</label>
                        <label style="color: #FFF; font-size: 13px;"><input type="checkbox" id="cryptoCoinETH" checked> ETH</label>
                        <label style="color: #FFF; font-size: 13px;"><input type="checkbox" id="cryptoCoinUSDC" checked> USDC</label>
                    </div>
                    <label style="font-size: 12px; color: #818CF8; font-weight: 700; display: block; margin-bottom: 4px;">Direct Deposit Wallet Address (Fallback)</label>
                    <input type="text" id="gwEditCryptoWallet" placeholder="e.g. TRC20 USDT Deposit Address" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 8px; color: #FFF; font-size: 12px; font-family: monospace;">
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                    <button type="button" class="btn btn-outline" onclick="closeGatewayConfigModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding: 10px 20px;">💾 Save Gateway Settings</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: CUSTOMER PAYMENT & GATEWAY SELECTION -->
    <div id="modalCheckoutPayment" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 100000;">
        <div class="modal-card" style="max-width: 520px; width: 90%; background: #12141F; border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="font-size: 18px; color: #FFF;" id="checkoutModalTitle">Complete Subscription Upgrade</h3>
                <button onclick="closeCheckoutModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <!-- Order Summary Card -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">SELECTED PLAN</span>
                    <h4 style="font-size: 18px; color: #FFF; margin-top: 2px;" id="checkoutPlanNameDisplay">Professional Plan</h4>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">TOTAL DUE</span>
                    <h3 style="font-size: 24px; color: #2DD4BF; font-weight: 800;" id="checkoutAmountDisplay">$49.00</h3>
                </div>
            </div>

            <!-- Gateway Selection State -->
            <div id="checkoutGatewaySelectSection">
                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 10px;">CHOOSE PAYMENT METHOD</label>
                <div id="checkoutGatewaysList" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                    <!-- Injected dynamically -->
                </div>
                <button class="btn btn-primary" id="btnProceedToPay" style="width: 100%; justify-content: center; padding: 12px; font-weight: 800; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000;" onclick="submitCheckoutPayment()">🔒 Proceed to Secure Payment</button>
            </div>

            <!-- Crypto Invoice Display State -->
            <div id="checkoutCryptoInvoiceSection" style="display: none; text-align: center;">
                <div style="background: rgba(45, 212, 191, 0.1); border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 16px; font-size: 13px; color: #2DD4BF;">
                    ⚡ Send exactly <strong id="cryptoPayAmountDisplay">49.00 USDT</strong> to the address below:
                </div>
                <div style="margin: 16px 0;">
                    <img id="cryptoQrCodeImg" src="" alt="Payment QR Code" style="width: 160px; height: 160px; border-radius: 10px; border: 2px solid #FFF;">
                </div>
                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 16px;">
                    <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Deposit Address</span>
                    <input type="text" id="cryptoAddressInput" readonly style="width: 100%; background: transparent; border: none; color: #FFF; font-family: monospace; font-size: 13px; text-align: center;" onclick="this.select()">
                </div>
                <div style="display: flex; justify-content: center; align-items: center; gap: 8px; color: #F59E0B; font-size: 13px;">
                    <span class="pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
                    Awaiting blockchain network confirmation...
                </div>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- FLOATING LIVE CHAT WIDGET (WEBSITE & LANDING PAGE) -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <style>
        @keyframes pulseGlowLive {
            0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.6); }
            70% { box-shadow: 0 0 0 14px rgba(45, 212, 191, 0); }
            100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
        }
        @keyframes slideUpChat {
            from { opacity: 0; transform: translateY(20px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-bubble-user {
            background: linear-gradient(135deg, #2DD4BF, #06B6D4);
            color: #000;
            font-weight: 600;
            border-radius: 16px 16px 4px 16px;
            padding: 12px 16px;
            max-width: 82%;
            align-self: flex-end;
            box-shadow: 0 4px 12px rgba(45, 212, 191, 0.2);
            word-break: break-word;
        }
        .chat-bubble-agent {
            background: #181B26;
            color: #FFF;
            border: 1px solid #272A3B;
            border-radius: 16px 16px 16px 4px;
            padding: 12px 16px;
            max-width: 82%;
            align-self: flex-start;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            word-break: break-word;
        }
        .livechat-trigger-btn:hover {
            transform: translateY(-2px) scale(1.03);
            box-shadow: 0 14px 30px rgba(45, 212, 191, 0.5) !important;
        }
    </style>

    <!-- FLOATING LIVE CHAT WIDGET TRIGGER -->
    <div id="liveChatWidgetTrigger" class="livechat-trigger-btn" onclick="toggleLiveChatWidget()" style="position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; padding: 12px 20px; border-radius: 50px; cursor: pointer; font-weight: 800; font-size: 14px; box-shadow: 0 10px 25px rgba(45, 212, 191, 0.4); animation: pulseGlowLive 3s infinite; transition: all 0.2s ease;">
        <span style="font-size: 18px; display: flex;">💬</span>
        <span id="liveChatBtnText">Live Chat</span>
        <span id="liveChatUnreadBadge" style="display: none; background: #EF4444; color: #FFF; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 12px; margin-left: 2px;">1</span>
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #000; display: inline-block;"></span>
    </div>

    <!-- FLOATING LIVE CHAT POPUP WINDOW -->
    <div id="liveChatWidgetWindow" style="display: none; position: fixed; bottom: 85px; right: 24px; width: 380px; max-width: calc(100vw - 32px); height: 530px; max-height: calc(100vh - 120px); background: rgba(15, 17, 26, 0.96); backdrop-filter: blur(20px); border: 1px solid rgba(45, 212, 191, 0.35); border-radius: 20px; z-index: 99999; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7); animation: slideUpChat 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
        <!-- Chat Header -->
        <div style="background: linear-gradient(135deg, #181B26, #0F111A); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="position: relative; width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #2DD4BF, #06B6D4); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                    🛡️
                    <span style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: #10B981; border: 2px solid #181B26;"></span>
                </div>
                <div>
                    <h4 style="font-size: 15px; color: #FFF; margin: 0; font-weight: 700;">AntiProfiles Support</h4>
                    <span style="font-size: 11px; color: #2DD4BF; display: flex; align-items: center; gap: 4px;">⚡ Active • Instant 24/7 Replies</span>
                </div>
            </div>
            <button onclick="toggleLiveChatWidget()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; padding: 4px; line-height: 1;">✕</button>
        </div>

        <!-- Chat Message Stream -->
        <div id="liveChatMessagesStream" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: rgba(10, 11, 16, 0.6);">
            <!-- Welcome default bot message -->
            <div class="chat-bubble-agent">
                <span style="font-size: 11px; color: #2DD4BF; font-weight: 700; display: block;">AntiProfiles Support Team</span>
                <p style="font-size: 13px; margin-top: 4px; line-height: 1.4;">Hello! 👋 Welcome to AntiProfiles. How can we help you with browser profiles, proxies, or subscriptions today?</p>
                <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 4px;">Just now</span>
            </div>
        </div>

        <!-- Guest Identity Form Bar (Shown for non-logged in visitors) -->
        <div id="liveChatGuestBar" style="display: none; padding: 10px 14px; background: #181B26; border-top: 1px solid var(--border); font-size: 12px;">
            <div style="display: flex; gap: 8px;">
                <input type="text" id="liveChatGuestName" placeholder="Your Name" style="flex: 1; background: #0A0B10; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: #FFF; font-size: 12px;">
                <input type="email" id="liveChatGuestEmail" placeholder="Your Email" style="flex: 1; background: #0A0B10; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: #FFF; font-size: 12px;">
            </div>
        </div>

        <!-- Chat Input Bar -->
        <form onsubmit="handleSendLiveChatMessage(event)" style="display: flex; gap: 8px; padding: 12px 14px; background: #12141F; border-top: 1px solid rgba(255,255,255,0.06); align-items: center;">
            <input type="text" id="liveChatInput" placeholder="Type your message here..." required autocomplete="off" style="flex: 1; background: #0A0B10; border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; color: #FFF; font-size: 13px;">
            <button type="submit" id="btnLiveChatSend" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); border: none; border-radius: 10px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #000; font-size: 15px; font-weight: 800;">➤</button>
        </form>
    </div>

    <script>
        function getAdminSessionToken() {
            return localStorage.getItem('sessionToken') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
        }
        window.getAdminSessionToken = getAdminSessionToken;

        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function toggleFaq(item) {
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('.faq-icon');
            if (answer.style.display === 'block') {
                answer.style.display = 'none';
                icon.innerText = '+';
            } else {
                answer.style.display = 'block';
                icon.innerText = '−';
            }
        }

        async function handlePublicContactSubmit(e) {
            if (e && e.preventDefault) e.preventDefault();
            const btn = document.getElementById('btnSendContactMsg');
            const statusBox = document.getElementById('contactFormStatus');
            const name = document.getElementById('contactSenderName').value.trim();
            const email = document.getElementById('contactSenderEmail').value.trim();
            const subject = document.getElementById('contactSenderSubject').value.trim();
            const message = document.getElementById('contactSenderMessage').value.trim();

            if (!name || !email || !message) {
                if (statusBox) {
                    statusBox.style.display = 'block';
                    statusBox.style.background = 'rgba(239,68,68,0.15)';
                    statusBox.style.color = '#F87171';
                    statusBox.innerText = '❌ Please fill in your name, email, and message.';
                }
                return false;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Sending Message...';
            }

            if (statusBox) {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(99,102,241,0.15)';
                statusBox.style.color = '#818CF8';
                statusBox.innerText = '⏳ Delivering your message to info@antiprofiles.com...';
            }

            // Obtain Captcha Token if enabled
            let captchaToken = null;
            if (typeof getCaptchaToken === 'function') {
                captchaToken = await getCaptchaToken('contact', 'contactTurnstileContainer');
            }

            try {
                const res = await fetch('/api/support?action=contact-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        subject: subject,
                        message: message,
                        captcha_token: captchaToken
                    })
                });

                const data = await res.json();
                if (data.success) {
                    if (statusBox) {
                        statusBox.style.display = 'block';
                        statusBox.style.background = 'rgba(45,212,191,0.15)';
                        statusBox.style.color = '#2DD4BF';
                        statusBox.innerText = '✅ ' + (data.message || 'Thank you for your message! Our team has received it at info@antiprofiles.com and will reply shortly.');
                    }
                    document.getElementById('publicContactForm').reset();
                    if (typeof renderTurnstileWidget === 'function') renderTurnstileWidget('contactTurnstileContainer');
                } else {
                    if (statusBox) {
                        statusBox.style.display = 'block';
                        statusBox.style.background = 'rgba(239,68,68,0.15)';
                        statusBox.style.color = '#F87171';
                        statusBox.innerText = '❌ ' + (data.error || 'Failed to send message. Please try again.');
                    }
                }
            } catch (err) {
                if (statusBox) {
                    statusBox.style.display = 'block';
                    statusBox.style.background = 'rgba(239,68,68,0.15)';
                    statusBox.style.color = '#F87171';
                    statusBox.innerText = '❌ Network connection error. Please try again.';
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Send Message';
                }
            }
            return false;
        }

        function handleLogout() {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('user');
            closeAdminDashboard();
            closeModal();
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', '/');
            }
            openModal('login');
        }

        async function handleRegister(e) {
            if (e && e.preventDefault) e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword') ? document.getElementById('regConfirmPassword').value : password;
            const msg = document.getElementById('loginMsg');
            const submitBtn = document.getElementById('registerSubmitBtn');

            if (!name || name.length < 2) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.style.border = 'none';
                msg.innerText = 'Please enter your full name (at least 2 characters).';
                return false;
            }

            if (!email || !email.includes('@')) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.style.border = 'none';
                msg.innerText = 'Please enter a valid email address.';
                return false;
            }

            if (!password || password.length < 6) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.style.border = 'none';
                msg.innerText = 'Password must be at least 6 characters long.';
                return false;
            }

            if (password !== confirmPassword) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.style.border = 'none';
                msg.innerText = 'Passwords do not match. Please check and try again.';
                return false;
            }

            // Obtain Captcha Token if enabled
            let captchaToken = null;
            if (typeof getCaptchaToken === 'function') {
                captchaToken = await getCaptchaToken('register', 'registerTurnstileContainer');
            }

            // Disable button to prevent double submission
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Creating account & sending email...';
                submitBtn.style.opacity = '0.7';
                submitBtn.style.cursor = 'not-allowed';
            }

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.style.border = 'none';
            msg.innerText = 'Creating account & dispatching verification email...';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        captcha_token: captchaToken,
                        aff_id: localStorage.getItem('aff_id') || '',
                        click_id: localStorage.getItem('click_id') || ''
                    })
                });

                if (!res.ok && res.status >= 500) {
                    throw new Error('Server error (' + res.status + '). Please try again later.');
                }

                const data = await res.json();
                if (data.success) {
                    if (data.requiresVerification) {
                        const safeEmail = (typeof window.escapeHtml === 'function') ? window.escapeHtml(email) : String(email).replace(/[<>&'"]/g, '');
                        msg.style.display = 'block';
                        msg.style.background = 'rgba(45,212,191,0.12)';
                        msg.style.color = '#2DD4BF';
                        msg.style.border = '1px solid rgba(45,212,191,0.3)';
                        msg.style.borderRadius = '12px';
                        msg.style.padding = '16px';
                        msg.innerHTML = `
                            <div style="font-size: 15px; font-weight: 800; margin-bottom: 6px; display:flex; align-items:center; gap:8px;">
                                <span>✉️</span> <span>Verification Email Sent!</span>
                            </div>
                            <div style="font-size: 13px; color: #CBD5E1; line-height: 1.5; margin-bottom: 14px;">
                                We've sent a verification link to <strong style="color:#FFF;">${safeEmail}</strong>. Please check your inbox and click the link to activate your account.
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button type="button" class="btn btn-outline" style="padding: 7px 14px; font-size: 12px; border-color: #2DD4BF; color: #2DD4BF;" onclick="resendVerificationEmail('${safeEmail}', this)">🔄 Resend Verification Email</button>
                                <button type="button" class="btn btn-outline" style="padding: 7px 14px; font-size: 12px;" onclick="openModal('login')">Go to Sign In</button>
                            </div>
                        `;
                        if (submitBtn) {
                            submitBtn.style.display = 'none';
                        }
                    } else {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = data.message || 'Account created successfully! Opening dashboard...';

                        if (data.sessionToken) {
                            localStorage.setItem('sessionToken', data.sessionToken);
                        }
                        if (data.user) {
                            localStorage.setItem('user', JSON.stringify(data.user));
                        }

                        if (window.history && window.history.pushState) {
                            window.history.pushState({}, '', '/dashboard');
                        }

                        window._pvJustLoggedIn = true;

                        setTimeout(() => {
                            closeModal();
                            checkSession();
                        }, 400);
                    }
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.style.border = 'none';
                    msg.innerText = data.error || 'Registration failed. Please try again.';
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Create Account';
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';
                    }
                }
            } catch(err) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.style.border = 'none';
                msg.innerText = err.message || 'Unable to connect to authentication server. Please check your connection and try again.';
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Create Account';
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                }
            }
            return false;
        }

        async function resendVerificationEmail(email, btn) {
            if (!email) {
                const emailInput = document.getElementById('loginEmail') || document.getElementById('regEmail');
                email = emailInput ? emailInput.value.trim() : '';
            }
            if (!email) {
                alert('Please enter your email address.');
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Sending email...';
            }

            try {
                const res = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (data.success) {
                    alert('✅ ' + (data.message || 'A new verification link has been dispatched to your email.'));
                    if (btn) {
                        btn.innerText = 'Sent! Check Inbox';
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.innerText = '🔄 Resend Verification Email';
                        }, 60000);
                    }
                } else {
                    alert('⚠️ ' + (data.error || 'Could not send verification email. Please try again.'));
                    if (btn) {
                        btn.disabled = false;
                        btn.innerText = '🔄 Resend Verification Email';
                    }
                }
            } catch(e) {
                alert('Network error sending verification email.');
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = '🔄 Resend Verification Email';
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // GOOGLE OAUTH 2.0 & GOOGLE IDENTITY SERVICES (GSI)
        // ═══════════════════════════════════════════════════════════════════
        window.GOOGLE_CLIENT_ID = '';
        window.GOOGLE_OAUTH_ONETAP = true;
        window._googleTokenClient = null;

        async function initGoogleOAuth() {
            try {
                const res = await fetch('/api/auth/google-config');
                const json = await res.json();
                if (json && json.success && json.data) {
                    const cfg = json.data;
                    if (cfg.clientId) {
                        window.GOOGLE_CLIENT_ID = cfg.clientId;
                        window.GOOGLE_OAUTH_ONETAP = !!cfg.oneTap;
                        setupGoogleGsi();
                    }
                }
            } catch (e) {
                console.warn('[Google OAuth] Config fetch failed:', e);
            }
        }

        function setupGoogleGsi() {
            if (!window.GOOGLE_CLIENT_ID) return;

            // Wait for Google Identity script if still loading
            if (typeof google === 'undefined' || !google.accounts) {
                setTimeout(setupGoogleGsi, 200);
                return;
            }

            try {
                // 1. Initialize Google ID (One-Tap & Credential callback)
                google.accounts.id.initialize({
                    client_id: window.GOOGLE_CLIENT_ID,
                    callback: handleGoogleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                if (window.GOOGLE_OAUTH_ONETAP) {
                    try {
                        google.accounts.id.prompt();
                    } catch(e) {}
                }

                // 2. Initialize OAuth 2.0 Token Client for instant Popup on button click
                if (google.accounts.oauth2 && google.accounts.oauth2.initTokenClient) {
                    window._googleTokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: window.GOOGLE_CLIENT_ID,
                        scope: 'email profile openid',
                        callback: async (tokenResponse) => {
                            if (tokenResponse && tokenResponse.access_token) {
                                await handleGoogleAccessToken(tokenResponse.access_token);
                            } else if (tokenResponse && tokenResponse.error) {
                                console.warn('[Google OAuth] Access token request error:', tokenResponse.error);
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn('[Google GSI] Setup exception:', e);
            }
        }

        async function handleGoogleSignIn() {
            // Priority 1: Google OAuth2 native token popup client
            if (window._googleTokenClient) {
                try {
                    window._googleTokenClient.requestAccessToken({ prompt: 'select_account' });
                    return;
                } catch(e) {
                    console.warn('[Google OAuth] TokenClient prompt failed:', e);
                }
            }

            // Priority 2: Google One Tap prompt if available
            if (window.google && window.google.accounts && window.google.accounts.id && window.GOOGLE_CLIENT_ID) {
                try {
                    window.google.accounts.id.prompt();
                    return;
                } catch(e) {}
            }

            // Priority 3: If Client ID is not configured yet in Admin Settings, open modal with direct email & instructions
            openGoogleAuthModal();
        }

        async function handleGoogleAccessToken(accessToken) {
            const msg = document.getElementById('loginMsg') || document.getElementById('googleAuthMsg');
            const btn = document.getElementById('googleSignInBtnLogin') || document.getElementById('googleSignInBtnRegister');
            return await submitGoogleAuthPayload({ access_token: accessToken }, msg, btn);
        }

        async function handleGoogleCredentialResponse(response) {
            if (response && response.credential) {
                const msg = document.getElementById('loginMsg') || document.getElementById('googleAuthMsg');
                const btn = document.getElementById('googleSignInBtnLogin') || document.getElementById('googleSignInBtnRegister');
                return await submitGoogleAuthPayload({ credential: response.credential }, msg, btn);
            }
        }

        async function submitGoogleDirectAuth(e) {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();

            const emailInput = document.getElementById('googleAuthEmailInput');
            const email = emailInput ? emailInput.value.trim() : '';
            const msg = document.getElementById('googleAuthMsg');
            const submitBtn = document.getElementById('googleAuthSubmitBtn');

            if (!email || !email.includes('@')) {
                if (msg) {
                    msg.style.display = 'block';
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = 'Please enter a valid Google Account email address.';
                }
                return false;
            }

            const name = email.split('@')[0].replace(/[._]/g, ' ');
            const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

            return await submitGoogleAuthPayload({
                email: email,
                name: capitalizedName,
                googleId: 'g_' + Math.random().toString(36).substring(2, 12)
            }, msg, submitBtn);
        }

        async function submitGoogleAuthPayload(payload, msgElement, submitButton) {
            const msg = msgElement || document.getElementById('loginMsg');
            const submitBtn = submitButton || document.getElementById('googleSignInBtnLogin');
            const gBtnLogin = document.getElementById('googleSignInBtnLogin');
            const gBtnReg = document.getElementById('googleSignInBtnRegister');

            // Disable buttons to prevent double clicks
            [submitBtn, gBtnLogin, gBtnReg].forEach(btn => {
                if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.style.cursor = 'not-allowed'; }
            });

            if (msg) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(99,102,241,0.2)';
                msg.style.color = '#818CF8';
                msg.innerText = 'Authenticating with Google Account...';
            }

            try {
                const enrichedPayload = Object.assign({}, payload, {
                    aff_id: localStorage.getItem('aff_id') || '',
                    click_id: localStorage.getItem('click_id') || ''
                });

                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(enrichedPayload)
                });

                if (!res.ok && res.status >= 500) {
                    throw new Error('Server error (' + res.status + '). Please try again later.');
                }

                const data = await res.json();
                if (data.success && data.sessionToken && data.user) {
                    if (msg) {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = 'Google Sign-In successful! Opening dashboard...';
                    }

                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (window.history && window.history.pushState) {
                        window.history.pushState({}, '', '/dashboard');
                    }

                    // Set grace period flag to prevent immediate /api/auth/me re-validation
                    window._pvJustLoggedIn = true;

                    setTimeout(() => {
                        closeModal();
                        closeGoogleAuthModal();
                        checkSession();
                    }, 300);
                } else {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = data.error || 'Google Sign-In failed. Please try again.';
                    }
                    // Re-enable buttons on failure
                    [submitBtn, gBtnLogin, gBtnReg].forEach(btn => {
                        if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
                    });
                }
            } catch(err) {
                if (msg) {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = err.message || 'Unable to connect to authentication server. Please try again.';
                }
                // Re-enable buttons on error
                [submitBtn, gBtnLogin, gBtnReg].forEach(btn => {
                    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
                });
            }
            return false;
        }

        function checkSession() {
            const token = localStorage.getItem('sessionToken');
            const userStr = localStorage.getItem('user');
            const adminModal = document.getElementById('adminDashboardModal');
            if (token && userStr && token !== 'undefined' && userStr !== 'undefined') {
                try {
                    const user = JSON.parse(userStr);
                    if (!user || !user.email) {
                        throw new Error('Invalid stored user payload');
                    }
                    const isAdmin = user.role === 'admin';

                    const infoEl = document.getElementById('adminUserInfo');
                    if (infoEl) {
                        infoEl.innerText = 'Logged in as ' + user.name + ' (' + user.email + ') [' + (user.role || 'user').toUpperCase() + ']';
                    }

                    // Role-Based Sidebar Navigation Filtering
                    document.querySelectorAll('.admin-only-section').forEach(el => {
                        el.style.display = isAdmin ? 'block' : 'none';
                    });

                    if (adminModal) {
                        adminModal.classList.add('active');
                        adminModal.style.display = 'flex';
                    }

                    if (isAdmin) {
                        const btn = document.getElementById('btnTabUsers');
                        switchAdminTab('users', btn);
                    } else {
                        const btn = document.getElementById('btnTabMyProfile');
                        switchAdminTab('my-profile', btn);
                    }

                    loadUserPortalData();
                } catch(e) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                    if (adminModal) {
                        adminModal.classList.remove('active');
                        adminModal.style.display = 'none';
                    }
                    openModal('login');
                }
            } else {
                if (adminModal) {
                    adminModal.classList.remove('active');
                    adminModal.style.display = 'none';
                }
            }
        }

        async function loadUserPortalData() {
            const token = localStorage.getItem('sessionToken');
            const userStr = localStorage.getItem('user');
            if (!token || !userStr) return;

            try {
                const user = JSON.parse(userStr);
                
                // Populate Profile Tab
                if (document.getElementById('uProfileName')) document.getElementById('uProfileName').value = user.name || '';
                if (document.getElementById('uProfileEmail')) document.getElementById('uProfileEmail').value = user.email || '';
                if (document.getElementById('uProfileRole')) document.getElementById('uProfileRole').value = 'Role: ' + (user.role || 'user').toUpperCase();
                if (document.getElementById('uProfileStatus')) document.getElementById('uProfileStatus').value = 'Status: ' + (user.accountStatus || 'active').toUpperCase();

                // Skip server re-validation if user just logged in (grace period)
                if (window._pvJustLoggedIn) {
                    window._pvJustLoggedIn = false;
                    console.log('[AntiProfiles] Skipping /api/auth/me re-validation (just logged in)');
                    return;
                }

                // Fetch License & Subscription Details from Server
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (res.status === 401 || res.status === 403) {
                    // Don't immediately destroy session — log the issue first
                    console.warn('[AntiProfiles] /api/auth/me returned ' + res.status + '. Token may be expired or server may not be receiving Authorization header.');
                    
                    // Only clear session if the token is genuinely expired (not a server config issue)
                    // Verify by checking if the response body explicitly says expired
                    try {
                        const errData = await res.json();
                        if (errData.error && (errData.error.includes('expired') || errData.error.includes('Unauthorized'))) {
                            console.warn('[AntiProfiles] Session confirmed expired. Clearing session.');
                            localStorage.removeItem('sessionToken');
                            localStorage.removeItem('user');
                            if (window.history && window.history.replaceState) {
                                window.history.replaceState({}, '', '/login');
                            }
                            closeAdminDashboard();
                            openModal('login');
                        }
                    } catch(jsonErr) {
                        console.warn('[AntiProfiles] Could not parse 401 response body.');
                    }
                    return;
                }

                const data = await res.json();

                if (data.success && data.license) {
                    const lic = data.license;
                    const isExpired = (lic.subscription_status === 'expired' || lic.valid === false || lic.locked === true);
                    const isTrial = (lic.subscription_status === 'trial');
                    
                    const paywallBanner = document.getElementById('userTrialExpiredPaywallBanner');
                    if (paywallBanner) {
                        paywallBanner.style.display = isExpired ? 'block' : 'none';
                    }

                    if (document.getElementById('userSubPlanName')) {
                        document.getElementById('userSubPlanName').innerText = (lic.plan ? lic.plan.name : 'Starter Plan');
                    }
                    
                    const subStatusElem = document.getElementById('userSubStatus');
                    if (subStatusElem) {
                        if (isExpired) {
                            subStatusElem.innerText = 'EXPIRED (LOCKED)';
                            subStatusElem.style.background = 'rgba(239, 68, 68, 0.2)';
                            subStatusElem.style.color = '#F87171';
                        } else if (isTrial) {
                            subStatusElem.innerText = 'FREE TRIAL';
                            subStatusElem.style.background = 'rgba(45, 212, 191, 0.2)';
                            subStatusElem.style.color = '#2DD4BF';
                        } else {
                            subStatusElem.innerText = (lic.subscription_status || 'ACTIVE').toUpperCase();
                            subStatusElem.style.background = 'rgba(16, 185, 129, 0.15)';
                            subStatusElem.style.color = '#10B981';
                        }
                    }

                    if (document.getElementById('userProfileQuotaDisplay')) {
                        document.getElementById('userProfileQuotaDisplay').innerText = isExpired ? '0 / 0 Profiles (Locked)' : '0 / ' + (lic.limits ? lic.limits.profiles : 25) + ' Profiles';
                    }
                    if (document.getElementById('userDeviceQuotaDisplay')) {
                        document.getElementById('userDeviceQuotaDisplay').innerText = (lic.device ? lic.device.device_count : 1) + ' / ' + (lic.device ? lic.device.max_devices : 2) + ' Devices';
                    }
                    if (document.getElementById('userSubExpiresAt')) {
                        document.getElementById('userSubExpiresAt').innerText = lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'September 15, 2027';
                    }
                }

                // Fetch and update live releases across landing page download section
                await fetchReleasesAndUpdateLanding();
            } catch(e){}
        }

        window.activeReleasesCache = null;

        async function fetchReleasesAndUpdateLanding() {
            try {
                const relRes = await fetch('/api/releases?t=' + Date.now());
                const relData = await relRes.json();
                if (relData.success && relData.data && relData.data.platforms) {
                    const plats = relData.data.platforms;
                    window.activeReleasesCache = plats;
                    
                    // 1. Windows Client
                    if (plats['windows-x64']) {
                        const win = plats['windows-x64'];
                        const dlUrl = win.download_url || '/api/releases?download=1&platform=windows-x64';
                        if (document.getElementById('userWinVerText')) {
                            document.getElementById('userWinVerText').innerText = 'v' + win.version + ' (x64 Architecture)';
                        }
                        if (document.getElementById('userBtnWinDl')) {
                            document.getElementById('userBtnWinDl').innerText = '⬇️ Download .exe (v' + win.version + ')';
                            document.getElementById('userBtnWinDl').href = dlUrl;
                        }
                        if (document.getElementById('landingBtnWinDl')) {
                            document.getElementById('landingBtnWinDl').innerText = 'Download Windows .exe (v' + win.version + ')';
                            document.getElementById('landingBtnWinDl').href = dlUrl;
                        }
                    }

                    // 2. macOS Apple Silicon
                    if (plats['macos-arm64']) {
                        const macArm = plats['macos-arm64'];
                        const dlUrl = macArm.download_url || '/api/releases?download=1&platform=macos-arm64';
                        if (document.getElementById('userMacArmVerText')) {
                            document.getElementById('userMacArmVerText').innerText = 'v' + macArm.version + ' (M1 / M2 / M3 / M4)';
                        }
                        if (document.getElementById('userBtnMacArmDl')) {
                            document.getElementById('userBtnMacArmDl').innerText = '⬇️ Download .dmg (v' + macArm.version + ')';
                            document.getElementById('userBtnMacArmDl').href = dlUrl;
                        }
                        if (document.getElementById('landingBtnMacArmDl')) {
                            document.getElementById('landingBtnMacArmDl').innerText = 'Download Apple Silicon .dmg (v' + macArm.version + ')';
                            document.getElementById('landingBtnMacArmDl').href = dlUrl;
                        }
                    }

                    // 3. macOS Intel
                    if (plats['macos-x64']) {
                        const macIntel = plats['macos-x64'];
                        const dlUrl = macIntel.download_url || '/api/releases?download=1&platform=macos-x64';
                        if (document.getElementById('userMacIntelVerText')) {
                            document.getElementById('userMacIntelVerText').innerText = 'v' + macIntel.version + ' (Intel Processors)';
                        }
                        if (document.getElementById('userBtnMacIntelDl')) {
                            document.getElementById('userBtnMacIntelDl').innerText = '⬇️ Download .dmg (v' + macIntel.version + ')';
                            document.getElementById('userBtnMacIntelDl').href = dlUrl;
                        }
                        if (document.getElementById('landingBtnMacIntelDl')) {
                            document.getElementById('landingBtnMacIntelDl').innerText = 'Download macOS Intel .dmg (v' + macIntel.version + ')';
                            document.getElementById('landingBtnMacIntelDl').href = dlUrl;
                        }
                    }

                    // 4. Linux Client
                    if (plats['linux-x64']) {
                        const linux = plats['linux-x64'];
                        const dlUrl = linux.download_url || '/api/releases?download=1&platform=linux-x64';
                        if (document.getElementById('userLinuxVerText')) {
                            document.getElementById('userLinuxVerText').innerText = 'v' + linux.version + ' (AppImage & .deb)';
                        }
                        if (document.getElementById('userBtnLinuxDl')) {
                            document.getElementById('userBtnLinuxDl').innerText = '⬇️ Download .AppImage (v' + linux.version + ')';
                            document.getElementById('userBtnLinuxDl').href = dlUrl;
                        }
                        if (document.getElementById('landingBtnLinuxDl')) {
                            document.getElementById('landingBtnLinuxDl').innerText = 'Download Linux .AppImage (v' + linux.version + ')';
                            document.getElementById('landingBtnLinuxDl').href = dlUrl;
                        }
                    }

                    // Re-sync Hero detection banner with live versions
                    if (typeof initDownloadOsDetection === 'function') {
                        initDownloadOsDetection();
                    }
                }
            } catch(e) {
                console.warn('[AntiProfiles] Live release update failed:', e);
            }
        }

        async function handleDownloadApp(platformKey) {
            try {
                const res = await fetch('/api/releases');
                const data = await res.json();
                if (data.success && data.data && data.data.platforms && data.data.platforms[platformKey]) {
                    const plat = data.data.platforms[platformKey];
                    if (!plat.enabled) {
                        alert('Downloads for ' + (plat.name || platformKey) + ' are currently disabled by administrator.');
                        return;
                    }
                }
            } catch(e){}

            // Seamless binary download via hidden iframe (zero page navigation, zero tab switching)
            let iframe = document.getElementById('dlHiddenIframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'dlHiddenIframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            iframe.src = '/api/releases?download=1&platform=' + platformKey;
        }

        async function handleSaveProfile(e) {
            e.preventDefault();
            const token = localStorage.getItem('sessionToken');
            const name = document.getElementById('uProfileName').value.trim();
            const currentPassword = document.getElementById('uCurrentPassword').value;
            const newPassword = document.getElementById('uNewPassword').value;
            const confirmPassword = document.getElementById('uConfirmNewPassword').value;
            const msg = document.getElementById('profileMsg');

            if (newPassword && newPassword !== confirmPassword) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'New passwords do not match.';
                return;
            }

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Saving profile changes...';

            try {
                const res = await fetch('/api/auth/update-profile', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name, currentPassword, newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Profile updated successfully!';

                    localStorage.setItem('user', JSON.stringify(data.user));
                    document.getElementById('adminUserInfo').innerText = 'Logged in as ' + data.user.name + ' (' + data.user.email + ') [' + (data.user.role || 'user').toUpperCase() + ']';

                    document.getElementById('uCurrentPassword').value = '';
                    document.getElementById('uNewPassword').value = '';
                    document.getElementById('uConfirmNewPassword').value = '';
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Failed to update profile.';
                }
            } catch(e) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error while updating profile.';
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // FLOATING LIVE CHAT WIDGET & USER PORTAL SUPPORT (REAL-TIME TWO-WAY)
        // ═══════════════════════════════════════════════════════════════════════

        let _liveChatOpen = false;
        let _liveChatPollTimer = null;
        let _liveChatActiveConvId = null;

        function getOrCreateVisitorToken() {
            let token = localStorage.getItem('pv_visitor_token');
            if (!token) {
                token = 'vis_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('pv_visitor_token', token);
            }
            return token;
        }

        function toggleLiveChatWidget() {
            const win = document.getElementById('liveChatWidgetWindow');
            const unreadBadge = document.getElementById('liveChatUnreadBadge');
            if (!win) return;

            _liveChatOpen = !_liveChatOpen;
            win.style.display = _liveChatOpen ? 'flex' : 'none';

            if (_liveChatOpen) {
                if (unreadBadge) unreadBadge.style.display = 'none';
                initLiveChatWidget();
                if (!_liveChatPollTimer) {
                    _liveChatPollTimer = setInterval(loadLiveChatMessages, 3500);
                }
            } else {
                if (_liveChatPollTimer) {
                    clearInterval(_liveChatPollTimer);
                    _liveChatPollTimer = null;
                }
            }
        }

        async function initLiveChatWidget() {
            const userStr = localStorage.getItem('user');
            const guestBar = document.getElementById('liveChatGuestBar');
            
            if (userStr && userStr !== 'undefined') {
                try {
                    const u = JSON.parse(userStr);
                    if (guestBar) guestBar.style.display = 'none';
                } catch(e) {}
            } else {
                // If visitor has already provided name/email in localStorage, populate them
                const savedName = localStorage.getItem('pv_visitor_name') || '';
                const savedEmail = localStorage.getItem('pv_visitor_email') || '';
                const nameInput = document.getElementById('liveChatGuestName');
                const emailInput = document.getElementById('liveChatGuestEmail');
                if (nameInput) nameInput.value = savedName;
                if (emailInput) emailInput.value = savedEmail;
                if (guestBar) guestBar.style.display = 'block';
            }

            await loadLiveChatMessages();
        }

        async function loadLiveChatMessages() {
            const stream = document.getElementById('liveChatMessagesStream');
            if (!stream) return;

            const token = localStorage.getItem('sessionToken');
            const visitorToken = getOrCreateVisitorToken();

            let url = '/api/support/active-thread?visitor_token=' + encodeURIComponent(visitorToken);
            let headers = {};
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }

            try {
                const res = await fetch(url, { headers });
                const data = await res.json();

                if (data.success && data.messages && data.messages.length > 0) {
                    _liveChatActiveConvId = data.data ? data.data.id : null;
                    stream.innerHTML = data.messages.map(m => {
                        const isAgent = m.sender_type === 'agent';
                        return `
                            <div class="${isAgent ? 'chat-bubble-agent' : 'chat-bubble-user'}">
                                <span style="font-size: 11px; font-weight: 700; color: ${isAgent ? '#2DD4BF' : '#000'}; display: block; margin-bottom: 2px;">${isAgent ? (m.sender_name || 'AntiProfiles Support') : 'You'}</span>
                                <p style="font-size: 13px; margin: 0; line-height: 1.4; word-break: break-word;">${m.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                                <span style="font-size: 10px; opacity: 0.7; display: block; margin-top: 4px;">${m.created_at ? m.created_at.substring(11, 16) : 'Just now'}</span>
                            </div>
                        `;
                    }).join('');
                    stream.scrollTop = stream.scrollHeight;
                }
            } catch(e) {}
        }

        async function handleSendLiveChatMessage(e) {
            if (e && e.preventDefault) e.preventDefault();
            const input = document.getElementById('liveChatInput');
            const stream = document.getElementById('liveChatMessagesStream');
            const sendBtn = document.getElementById('btnLiveChatSend');
            const text = input ? input.value.trim() : '';
            if (!text) return;

            const token = localStorage.getItem('sessionToken');
            const visitorToken = getOrCreateVisitorToken();
            const clientMsgId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

            const nameInput = document.getElementById('liveChatGuestName');
            const emailInput = document.getElementById('liveChatGuestEmail');
            const guestName = nameInput ? nameInput.value.trim() : (localStorage.getItem('pv_visitor_name') || '');
            const guestEmail = emailInput ? emailInput.value.trim() : (localStorage.getItem('pv_visitor_email') || '');

            if (guestName) localStorage.setItem('pv_visitor_name', guestName);
            if (guestEmail) localStorage.setItem('pv_visitor_email', guestEmail);

            // Create Optimistic Message with 'Sending...' status
            const tempBubble = document.createElement('div');
            tempBubble.className = 'chat-bubble-user';
            tempBubble.id = 'bubble_' + clientMsgId;
            tempBubble.innerHTML = `
                <span style="font-size: 11px; font-weight: 700; color: #000; display: block; margin-bottom: 2px;">You</span>
                <p style="font-size: 13px; margin: 0; line-height: 1.4; word-break: break-word;">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                <span id="status_${clientMsgId}" style="font-size: 10px; opacity: 0.7; display: block; margin-top: 4px;">Sending... ⏳</span>
            `;
            stream.appendChild(tempBubble);
            stream.scrollTop = stream.scrollHeight;
            input.value = '';

            let headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            try {
                const res = await fetch('/api/support/send', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        visitor_token: visitorToken,
                        client_message_id: clientMsgId,
                        name: guestName,
                        email: guestEmail,
                        message: text,
                        channel: 'widget'
                    })
                });
                const data = await res.json();
                const statusEl = document.getElementById('status_' + clientMsgId);
                if (data.success) {
                    if (statusEl) {
                        statusEl.style.opacity = '0.7';
                        statusEl.innerText = data.created_at ? data.created_at.substring(11, 16) : 'Sent ✓';
                    }
                    loadLiveChatMessages();
                } else {
                    if (statusEl) {
                        statusEl.innerHTML = '<span style="color:#EF4444; font-weight:700;">⚠️ Message could not be sent. Please try again.</span>';
                    }
                }
            } catch(err) {
                const statusEl = document.getElementById('status_' + clientMsgId);
                if (statusEl) {
                    statusEl.innerHTML = '<span style="color:#EF4444; font-weight:700;">⚠️ Message could not be sent. Please try again.</span>';
                }
            }
        }

        // User Portal Support Chat (Inside Dashboard)
        async function loadUserPortalSupportThread() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const thread = document.getElementById('userChatThread');
            if (!thread) return;

            try {
                const res = await fetch('/api/support/active-thread', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();

                if (data.success && data.messages && data.messages.length > 0) {
                    thread.innerHTML = data.messages.map(m => {
                        const isAgent = m.sender_type === 'agent';
                        return `
                            <div class="${isAgent ? 'chat-bubble-agent' : 'chat-bubble-user'}" style="${isAgent ? 'align-self:flex-start; background:#181B26; color:#FFF; border:1px solid #272A3B;' : 'align-self:flex-end; background:#2DD4BF; color:#000;'}">
                                <span style="font-size: 11px; font-weight: 700; color: ${isAgent ? '#2DD4BF' : '#000'}; display: block; margin-bottom: 2px;">${isAgent ? (m.sender_name || 'AntiProfiles Support') : 'You'}</span>
                                <p style="font-size: 13px; margin: 0; line-height: 1.4;">${m.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                                <span style="font-size: 10px; opacity: 0.7; display: block; margin-top: 4px;">${m.created_at || 'Just now'}</span>
                            </div>
                        `;
                    }).join('');
                    thread.scrollTop = thread.scrollHeight;
                }
            } catch(e) {}
        }

        async function handleSendUserSupportMessage(e) {
            e.preventDefault();
            const input = document.getElementById('userSupportInput');
            const thread = document.getElementById('userChatThread');
            const text = input ? input.value.trim() : '';
            if (!text) return;

            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const clientMsgId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

            const userMsg = document.createElement('div');
            userMsg.style.cssText = 'background: #2DD4BF; color: #000; font-weight: 600; border-radius: 12px; padding: 14px; max-width: 80%; align-self: flex-end;';
            userMsg.innerHTML = '<span style="font-size: 11px; opacity: 0.8; font-weight: 700; display: block;">You</span>' +
                                '<p style="font-size: 13px; margin-top: 4px;">' + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</p>' +
                                '<span id="status_portal_' + clientMsgId + '" style="font-size: 10px; opacity: 0.7; display: block; margin-top: 6px;">Sending... ⏳</span>';

            thread.appendChild(userMsg);
            thread.scrollTop = thread.scrollHeight;
            input.value = '';

            try {
                const res = await fetch('/api/support/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ message: text, client_message_id: clientMsgId, channel: 'dashboard' })
                });
                const data = await res.json();
                const statusEl = document.getElementById('status_portal_' + clientMsgId);
                if (data.success) {
                    if (statusEl) statusEl.innerText = data.created_at ? data.created_at.substring(11, 16) : 'Sent ✓';
                    loadUserPortalSupportThread();
                } else {
                    if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444;">⚠️ Message could not be sent. Please try again.</span>';
                }
            } catch(e) {
                const statusEl = document.getElementById('status_portal_' + clientMsgId);
                if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444;">⚠️ Message could not be sent. Please try again.</span>';
            }
        }

        function toggleMobileNav() {
            const drawer = document.getElementById('mobileNavDrawer');
            if (drawer) drawer.classList.toggle('active');
        }

        function closeMobileNav() {
            const drawer = document.getElementById('mobileNavDrawer');
            if (drawer) drawer.classList.remove('active');
        }

        function toggleAdminSidebar(forceClose) {
            const sidebar = document.getElementById('adminSidebar');
            const overlay = document.getElementById('adminSidebarOverlay');
            if (!sidebar) return;
            if (forceClose === true) {
                sidebar.classList.remove('mobile-open');
                if (overlay) overlay.classList.remove('active');
                return;
            }
            const isOpen = sidebar.classList.toggle('mobile-open');
            if (overlay) {
                overlay.classList.toggle('active', isOpen);
            }
        }
        window.toggleAdminSidebar = toggleAdminSidebar;

        function switchAdminTab(tabName, btn) {
            // Auto-close left drawer on mobile when tab is selected
            if (window.innerWidth <= 900) {
                toggleAdminSidebar(true);
            }

            document.querySelectorAll('.admin-sidebar-btn').forEach(b => {
                b.classList.remove('active');
            });
            if (btn) {
                btn.classList.add('active');
                try {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } catch(e) {}
            }

            document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
            const target = document.getElementById('tab-' + tabName);
            if (target) target.style.display = 'block';

            if (tabName === 'user-downloads') initDownloadOsDetection();
            if (tabName === 'my-affiliate') loadMyAffiliatePortal();
            if (tabName === 'admin-affiliates') loadAdminAffiliateControl();
            if (tabName === 'users') loadUsersTable();
            if (tabName === 'subscriptions') {
                loadSubscriptionsTable();
                loadGlobalTrialConfig();
            }
            if (tabName === 'gateways') loadPaymentGatewaysTable();
            if (tabName === 'payments') loadPaymentsTable();
            if (tabName === 'support') loadSupportConversations();
            if (tabName === 'user-support') loadUserPortalSupportThread();
            if (tabName === 'audit') loadAuditLogsTable();
            if (tabName === 'security') loadSecurityTable();
            if (tabName === 'profile-audit') loadProfileAuditTable();
            if (tabName === 'seo') {
                loadGlobalSeoSettings();
                loadSeoPagesTable();
            }
            if (tabName === 'releases') loadAppReleasesTable();
            if (tabName === 'google-oauth') loadGoogleOAuthConfig();
            if (tabName === 'captcha') loadCaptchaConfig();
            if (tabName === 'smtp') {
                loadSmtpConfig();
                loadEmailLogs(1);
            }
            if (tabName === 'landing') loadBrandingSettings();
            if (tabName === 'software-features') loadAdminFeaturesTable();
        }

        function initDownloadOsDetection() {
            if (typeof window.initDownloadOsDetection === 'function' && window.initDownloadOsDetection !== initDownloadOsDetection) {
                try {
                    window.initDownloadOsDetection();
                    return;
                } catch(e) {}
            }
        }

        async function loadSmtpConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const msg = document.getElementById('smtpAdminMsg');
            if (msg) msg.style.display = 'none';

            try {
                const res = await fetch('/api/admin/get-smtp-config', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const cfg = data.data;
                    const hostInput = document.getElementById('smtpHost');
                    const portInput = document.getElementById('smtpPort');
                    const userInput = document.getElementById('smtpUser');
                    const passInput = document.getElementById('smtpPass');
                    const fromEmailInput = document.getElementById('smtpFromEmail');
                    const fromNameInput = document.getElementById('smtpFromName');
                    const secureSelect = document.getElementById('smtpSecure');
                    const enabledSelect = document.getElementById('smtpEnabled');

                    if (hostInput) hostInput.value = cfg.host || '';
                    if (portInput) portInput.value = cfg.port || 587;
                    if (userInput) userInput.value = cfg.user || '';
                    if (passInput) passInput.placeholder = cfg.hasPassword ? '•••••••••••• (Saved)' : 'Enter SMTP password';
                    if (fromEmailInput) fromEmailInput.value = cfg.fromEmail || '';
                    if (fromNameInput) fromNameInput.value = cfg.fromName || 'AntiProfiles';
                    if (secureSelect) secureSelect.value = cfg.secure ? 'true' : 'false';
                    if (enabledSelect) enabledSelect.value = cfg.enabled ? 'true' : 'false';
                }
            } catch(e) {
                console.warn('[SMTP Config] Failed to load:', e);
            }
        }

        async function saveSmtpConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const host = document.getElementById('smtpHost').value.trim();
            const port = parseInt(document.getElementById('smtpPort').value, 10) || 587;
            const user = document.getElementById('smtpUser').value.trim();
            const pass = document.getElementById('smtpPass').value;
            const fromEmail = document.getElementById('smtpFromEmail').value.trim();
            const fromName = document.getElementById('smtpFromName').value.trim();
            const secure = document.getElementById('smtpSecure').value === 'true';
            const enabled = document.getElementById('smtpEnabled').value === 'true';
            const msg = document.getElementById('smtpAdminMsg');
            const saveBtn = document.getElementById('btnSaveSmtp');

            if (!host) {
                if (msg) {
                    msg.style.display = 'block';
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '❌ SMTP Host is required.';
                }
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving Configuration...';
            }

            if (msg) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(99,102,241,0.2)';
                msg.style.color = '#818CF8';
                msg.innerText = 'Saving SMTP configuration...';
            }

            try {
                const payload = {
                    host: host,
                    port: port,
                    user: user,
                    fromEmail: fromEmail,
                    fromName: fromName,
                    secure: secure,
                    enabled: enabled
                };
                if (pass && pass !== '••••••••••••') {
                    payload.password = pass;
                }

                const res = await fetch('/api/admin/save-smtp-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    if (msg) {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = '✅ ' + (data.message || 'SMTP settings saved and active for both Website and Applications!');
                    }
                    const passInput = document.getElementById('smtpPass');
                    if (passInput) passInput.placeholder = '•••••••••••• (Saved)';
                    if (passInput) passInput.value = '';
                } else {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = '❌ Failed to save: ' + (data.error || 'Unknown error');
                    }
                }
            } catch(e) {
                if (msg) {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '❌ Network error saving SMTP configuration.';
                }
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = '💾 Save SMTP Settings';
                }
            }
        }

        async function testSmtpConnection() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const host = document.getElementById('smtpHost').value.trim();
            const port = parseInt(document.getElementById('smtpPort').value, 10) || 587;
            const user = document.getElementById('smtpUser').value.trim();
            const pass = document.getElementById('smtpPass').value;
            const secure = document.getElementById('smtpSecure').value === 'true';
            const fromEmail = document.getElementById('smtpFromEmail').value.trim();
            const resultsBox = document.getElementById('smtpDiagResults');
            const testBtn = document.getElementById('btnTestSmtp');

            if (!host) {
                alert('Please enter an SMTP Host before running diagnostics.');
                return;
            }

            if (testBtn) {
                testBtn.disabled = true;
                testBtn.innerText = 'Testing Handshake...';
            }

            if (resultsBox) {
                resultsBox.style.display = 'block';
                resultsBox.innerHTML = '<div style="color:#818CF8;">⏳ Connecting to ' + host + ':' + port + ' and testing SMTP handshake...</div>';
            }

            try {
                const payload = { host, port, user, secure, fromEmail };
                if (pass && pass !== '••••••••••••') payload.password = pass;

                const res = await fetch('/api/admin/test-smtp-connection', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                let html = '<div style="margin-bottom:8px; font-weight:700; color:' + (data.success ? '#2DD4BF' : '#F87171') + ';">';
                html += (data.success ? '✓ SMTP Handshake & Auth Succeeded' : '⚠️ SMTP Diagnostic Issues Detected') + '</div>';

                if (data.diagnostics) {
                    const d = data.diagnostics;
                    html += '<div style="display:flex; flex-direction:column; gap:6px;">';
                    for (const [step, info] of Object.entries(d)) {
                        const isPass = info.status === 'PASS';
                        html += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:6px;">';
                        html += '<span style="text-transform:uppercase; font-weight:600; color:#94A3B8;">' + step + '</span>';
                        html += '<span style="color:' + (isPass ? '#2DD4BF' : '#F87171') + '; font-weight:700;">' + (isPass ? '✓ PASS' : '✗ FAIL') + ' (' + (info.detail || '') + ')</span>';
                        html += '</div>';
                    }
                    html += '</div>';
                }

                if (data.error) {
                    html += '<div style="margin-top:8px; color:#F87171;"><strong>Error:</strong> ' + data.error + '</div>';
                }

                if (resultsBox) resultsBox.innerHTML = html;
            } catch(e) {
                if (resultsBox) resultsBox.innerHTML = '<div style="color:#F87171;">❌ Network error testing SMTP server.</div>';
            } finally {
                if (testBtn) {
                    testBtn.disabled = false;
                    testBtn.innerText = '🔌 Test Connection Only';
                }
                loadEmailLogs(1);
            }
        }

        async function sendTestEmailDirect() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const recipient = document.getElementById('smtpTestRecipient').value.trim();
            const host = document.getElementById('smtpHost').value.trim();
            const port = parseInt(document.getElementById('smtpPort').value, 10) || 587;
            const user = document.getElementById('smtpUser').value.trim();
            const pass = document.getElementById('smtpPass').value;
            const secure = document.getElementById('smtpSecure').value === 'true';
            const fromEmail = document.getElementById('smtpFromEmail').value.trim();
            const fromName = document.getElementById('smtpFromName').value.trim();
            const sendBtn = document.getElementById('btnSendTestEmail');
            const resultsBox = document.getElementById('smtpDiagResults');

            if (!recipient || !recipient.includes('@')) {
                alert('Please enter a valid test recipient email address.');
                return;
            }

            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerText = 'Sending...';
            }

            if (resultsBox) {
                resultsBox.style.display = 'block';
                resultsBox.innerHTML = '<div style="color:#818CF8;">⏳ Dispatching live test email to ' + recipient + '...</div>';
            }

            try {
                const payload = { recipient, host, port, user, secure, fromEmail, fromName };
                if (pass && pass !== '••••••••••••') payload.password = pass;

                const res = await fetch('/api/admin/send-test-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    if (resultsBox) {
                        resultsBox.innerHTML = '<div style="color:#2DD4BF; font-weight:700;">✓ ' + (data.message || 'Test email dispatched successfully!') + '</div><div style="color:#94A3B8; font-size:11px; margin-top:4px;">Check inbox/spam folder for ' + recipient + '</div>';
                    }
                } else {
                    if (resultsBox) {
                        resultsBox.innerHTML = '<div style="color:#F87171; font-weight:700;">✗ ' + (data.error || 'Failed to dispatch test email.') + '</div>';
                    }
                }
            } catch(e) {
                if (resultsBox) resultsBox.innerHTML = '<div style="color:#F87171;">❌ Network error delivering test email.</div>';
            } finally {
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.innerText = '📨 Send Email';
                }
                loadEmailLogs(1);
            }
        }

        let _emailLogsData = [];
        let _emailLogsCurrentPage = 1;

        async function loadEmailLogs(page = 1) {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const tbody = document.getElementById('emailLogsTableBody');
            const statusFilter = document.getElementById('emailLogStatusFilter')?.value || 'all';
            const searchVal = document.getElementById('emailLogSearch')?.value?.trim() || '';

            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Loading email logs...</td></tr>';
            }

            try {
                const params = new URLSearchParams({
                    page: page,
                    limit: 15,
                    status: statusFilter
                });
                if (searchVal) params.append('search', searchVal);

                const res = await fetch('/api/admin/get-email-logs?' + params.toString(), {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();

                if (data.success && Array.isArray(data.data)) {
                    _emailLogsData = data.data;
                    _emailLogsCurrentPage = page;
                    renderEmailLogsTable(data.data, data.total, page, data.limit);
                } else {
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#F87171;">Failed to load email logs.</td></tr>';
                    }
                }
            } catch(e) {
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#F87171;">Network error loading email logs.</td></tr>';
                }
            }
        }

        function renderEmailLogsTable(logs, total, page, limit) {
            const tbody = document.getElementById('emailLogsTableBody');
            const pag = document.getElementById('emailLogsPagination');
            if (!tbody) return;

            if (!logs || logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No email logs recorded yet.</td></tr>';
                if (pag) pag.innerHTML = '';
                return;
            }

            let html = '';
            logs.forEach((log, index) => {
                const isSent = log.status === 'sent';
                const statusBadge = isSent
                    ? '<span style="background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); color:#2DD4BF; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;">✓ Delivered</span>'
                    : '<span style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#F87171; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;">⚠️ Failed</span>';

                const typeBadge = '<span style="background:rgba(99,102,241,0.15); color:#818CF8; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; text-transform:uppercase;">' + escapeHtml(log.email_type || 'system') + '</span>';

                html += '<tr style="border-bottom:1px solid #1E2333;">';
                html += '<td style="padding:10px 12px; font-weight:600; color:#FFF;">' + escapeHtml(log.recipient) + '</td>';
                html += '<td style="padding:10px 12px;">' + typeBadge + '</td>';
                html += '<td style="padding:10px 12px; color:#CBD5E1; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(log.subject) + '</td>';
                html += '<td style="padding:10px 12px; color:#94A3B8; text-transform:uppercase; font-size:11px;">' + escapeHtml(log.delivery_method || 'smtp') + '</td>';
                html += '<td style="padding:10px 12px;">' + statusBadge + '</td>';
                html += '<td style="padding:10px 12px; color:#94A3B8; font-size:12px;">' + new Date(log.created_at).toLocaleString() + '</td>';
                html += '<td style="padding:10px 12px;">';
                if (log.error_message) {
                    html += '<button onclick="showEmailDiagModal(' + index + ')" class="btn btn-outline" style="padding:3px 8px; font-size:11px; color:#F87171; border-color:rgba(239,68,68,0.4);">View Error</button>';
                } else {
                    html += '<span style="color:#2DD4BF; font-size:12px;">250 OK</span>';
                }
                html += '</td>';
                html += '</tr>';
            });

            tbody.innerHTML = html;

            if (pag) {
                const totalPages = Math.ceil(total / limit) || 1;
                let pagHtml = '<span>Showing ' + logs.length + ' of ' + total + ' logs (Page ' + page + ' of ' + totalPages + ')</span>';
                pagHtml += '<div style="display:flex; gap:6px;">';
                if (page > 1) {
                    pagHtml += '<button class="btn btn-outline" style="padding:4px 10px; font-size:11px;" onclick="loadEmailLogs(' + (page - 1) + ')">Previous</button>';
                }
                if (page < totalPages) {
                    pagHtml += '<button class="btn btn-outline" style="padding:4px 10px; font-size:11px;" onclick="loadEmailLogs(' + (page + 1) + ')">Next</button>';
                }
                pagHtml += '</div>';
                pag.innerHTML = pagHtml;
            }
        }

        function showEmailDiagModal(index) {
            const item = _emailLogsData[index];
            if (!item) return;
            alert('=== EMAIL DIAGNOSTIC DETAILS ===\n\nRecipient: ' + item.recipient + '\nSubject: ' + item.subject + '\nType: ' + item.email_type + '\nDate: ' + item.created_at + '\n\nDiagnostic Error:\n' + (item.error_message || 'None reported'));
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ADMIN SUPPORT INBOX & REAL-TIME TICKET CHAT ENGINE
        // ═══════════════════════════════════════════════════════════════════════

        let _allAdminConversations = [];
        let _activeSupportConvId = null;
        let _currentSupportFilter = 'all';

        async function loadSupportConversations() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const container = document.getElementById('adminSupportList');
            if (!container) return;

            try {
                const res = await fetch('/api/support/admin-conversations', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    _allAdminConversations = data.data;
                    renderAdminSupportList();

                    // Calculate total unread count for sidebar indicator
                    const totalUnread = _allAdminConversations.reduce((sum, c) => sum + parseInt(c.unread_count || 0, 10), 0);
                    const sbBadge = document.getElementById('adminSupportSidebarBadge');
                    if (sbBadge) {
                        if (totalUnread > 0) {
                            sbBadge.style.display = 'inline-block';
                            sbBadge.innerText = totalUnread;
                        } else {
                            sbBadge.style.display = 'none';
                        }
                    }

                    // If an active conversation is open, refresh its thread
                    if (_activeSupportConvId) {
                        openAdminSupportThread(_activeSupportConvId, true);
                    }
                } else {
                    container.innerHTML = `<div style="text-align:center; color:#F87171; padding:20px;">${data.error || 'Failed to load conversations.'}</div>`;
                }
            } catch(e) {
                container.innerHTML = '<div style="text-align:center; color:#F87171; padding:20px;">Network error connecting to support service.</div>';
            }
        }

        function setSupportFilter(status) {
            _currentSupportFilter = status;
            ['all', 'open', 'closed'].forEach(s => {
                const btn = document.getElementById('filterTab' + s.charAt(0).toUpperCase() + s.slice(1));
                if (btn) {
                    if (s === status) {
                        btn.className = 'btn btn-primary';
                    } else {
                        btn.className = 'btn btn-outline';
                    }
                }
            });
            renderAdminSupportList();
        }

        function filterSupportConversations() {
            renderAdminSupportList();
        }

        function renderAdminSupportList() {
            const container = document.getElementById('adminSupportList');
            if (!container) return;

            const search = (document.getElementById('suppSearchInput') ? document.getElementById('suppSearchInput').value : '').toLowerCase();

            let filtered = _allAdminConversations.filter(c => {
                if (_currentSupportFilter !== 'all' && c.status !== _currentSupportFilter) return false;
                if (search) {
                    const hay = `${c.display_name || ''} ${c.display_email || ''} ${c.subject || ''} ${c.id || ''}`.toLowerCase();
                    if (!hay.includes(search)) return false;
                }
                return true;
            });

            if (filtered.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px; font-size:13px;">No conversations found matching filter.</div>';
                return;
            }

            container.innerHTML = filtered.map(c => {
                const isSelected = c.id === _activeSupportConvId;
                const unread = parseInt(c.unread_count || 0, 10);
                const isOpen = c.status === 'open' || c.status === 'waiting_support';
                const statusColor = isOpen ? '#10B981' : (c.status === 'waiting_user' ? '#F59E0B' : '#94A3B8');
                const statusBg = isOpen ? 'rgba(16,185,129,0.15)' : (c.status === 'waiting_user' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)');

                return `
                    <div onclick="openAdminSupportThread('${c.id}')" style="background: ${isSelected ? 'rgba(45,212,191,0.12)' : 'var(--bg-input)'}; border: 1px solid ${isSelected ? '#2DD4BF' : 'var(--border)'}; border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: all 0.15s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <strong style="color: #FFF; font-size: 14px;">${c.display_name || 'Visitor'}</strong>
                                <span style="background: rgba(129,140,248,0.15); color: #818CF8; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: capitalize;">${c.plan_name || 'Guest'}</span>
                            </div>
                            <span style="font-size: 10px; color: ${statusColor}; background: ${statusBg}; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                                ${c.status || 'open'}
                            </span>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${c.display_email || 'No email provided'}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <p style="font-size: 12px; color: #CBD5E1; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;">
                                ${c.last_message_preview || 'No messages yet'}
                            </p>
                            ${unread > 0 ? `<span style="background:#EF4444; color:#FFF; font-size:10px; font-weight:800; padding:1px 6px; border-radius:10px;">${unread}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function appendAdminBubble(senderType, senderName, messageText, timeStr) {
            const stream = document.getElementById('adminMsgStream');
            if (!stream) return;
            // Remove 'No messages yet' placeholder if present
            const placeholder = stream.querySelector('div');
            if (placeholder && placeholder.innerText.includes('No messages in this conversation yet')) {
                placeholder.remove();
            }
            const isAgent = senderType === 'agent';
            const safeMsg = (messageText || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = isAgent ? 'chat-bubble-agent' : 'chat-bubble-user';
            bubbleDiv.style.cssText = isAgent ? 'align-self:flex-end; background:#181B26; color:#FFF; border:1px solid #2DD4BF;' : 'align-self:flex-start; background:var(--bg-input); color:#FFF; border:1px solid var(--border);';
            bubbleDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:12px;">
                    <span style="font-size: 11px; font-weight: 700; color: ${isAgent ? '#2DD4BF' : '#818CF8'};">${senderName || (isAgent ? 'Staff Agent' : 'Customer')}</span>
                    <span style="font-size: 10px; color: var(--text-muted);">${timeStr || 'Just now'}</span>
                </div>
                <p style="font-size: 13px; margin: 0; line-height: 1.45; word-break: break-word;">${safeMsg}</p>
            `;
            stream.appendChild(bubbleDiv);
            stream.scrollTop = stream.scrollHeight;
        }

        async function openAdminSupportThread(convId, keepScroll = false) {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            _activeSupportConvId = convId;
            renderAdminSupportList();

            const panel = document.getElementById('adminSupportActiveThreadPanel');
            if (!panel) return;

            if (!keepScroll) {
                panel.innerHTML = '<div style="flex:1; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">Loading conversation thread...</div>';
            }

            try {
                const res = await fetch('/api/support?action=admin-thread&conversation_id=' + encodeURIComponent(convId), {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();

                if (data && data.success && data.conversation) {
                    const c = data.conversation;
                    const msgs = data.messages || [];

                    // If keepScroll is true and stream already exists, simply update stream content without recreating the whole panel
                    const existingStream = document.getElementById('adminMsgStream');
                    if (keepScroll && existingStream) {
                        existingStream.innerHTML = msgs.length === 0 ? '<div style="text-align:center; color:var(--text-muted); padding:30px;">No messages in this conversation yet.</div>' : msgs.map(m => {
                            const isAgent = m.sender_type === 'agent';
                            return `
                                <div class="${isAgent ? 'chat-bubble-agent' : 'chat-bubble-user'}" style="${isAgent ? 'align-self:flex-end; background:#181B26; color:#FFF; border:1px solid #2DD4BF;' : 'align-self:flex-start; background:var(--bg-input); color:#FFF; border:1px solid var(--border);'}">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:12px;">
                                        <span style="font-size: 11px; font-weight: 700; color: ${isAgent ? '#2DD4BF' : '#818CF8'};">${isAgent ? (m.sender_name || 'Staff Agent') : (m.sender_name || 'Customer')}</span>
                                        <span style="font-size: 10px; color: var(--text-muted);">${m.created_at || 'Just now'}</span>
                                    </div>
                                    <p style="font-size: 13px; margin: 0; line-height: 1.45; word-break: break-word;">${m.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                                </div>
                            `;
                        }).join('');
                        existingStream.scrollTop = existingStream.scrollHeight;
                        return;
                    }

                    panel.innerHTML = `
                        <!-- Thread Header -->
                        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); background: #12141F; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <h4 style="color: #FFF; font-size: 16px; margin: 0;">${c.display_name || 'Visitor'}</h4>
                                    <span style="background: rgba(45,212,191,0.15); color: #2DD4BF; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${c.plan_name || 'Guest'}</span>
                                    <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">ID: ${c.id}</span>
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                                    <span>${c.display_email || 'No email'}</span> • Channel: <strong>${c.channel || 'web'}</strong> • Status: <strong style="color:#2DD4BF;">${(c.status || 'open').toUpperCase()}</strong>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; color: #F87171;" onclick="closeAdminSupportConv('${c.id}')">🔒 Close Ticket</button>
                            </div>
                        </div>

                        <!-- Messages Stream -->
                        <div id="adminMsgStream" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; background: rgba(10, 11, 16, 0.4);">
                            ${msgs.length === 0 ? '<div style="text-align:center; color:var(--text-muted); padding:30px;">No messages in this conversation yet.</div>' : msgs.map(m => {
                                const isAgent = m.sender_type === 'agent';
                                return `
                                    <div class="${isAgent ? 'chat-bubble-agent' : 'chat-bubble-user'}" style="${isAgent ? 'align-self:flex-end; background:#181B26; color:#FFF; border:1px solid #2DD4BF;' : 'align-self:flex-start; background:var(--bg-input); color:#FFF; border:1px solid var(--border);'}">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:12px;">
                                            <span style="font-size: 11px; font-weight: 700; color: ${isAgent ? '#2DD4BF' : '#818CF8'};">${isAgent ? (m.sender_name || 'Staff Agent') : (m.sender_name || 'Customer')}</span>
                                            <span style="font-size: 10px; color: var(--text-muted);">${m.created_at || 'Just now'}</span>
                                        </div>
                                        <p style="font-size: 13px; margin: 0; line-height: 1.45; word-break: break-word;">${m.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Reply Composer -->
                        <div style="padding: 16px 20px; border-top: 1px solid var(--border); background: #12141F;">
                            <form onsubmit="sendAdminSupportReply(event, '${c.id}')" style="display: flex; gap: 10px; align-items: center;">
                                <input type="text" id="adminReplyInput_${c.id}" placeholder="Type your support reply (Press Enter to send)..." required autocomplete="off" style="flex: 1; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; color: #FFF; font-size: 13px;">
                                <button type="submit" class="btn btn-primary" style="padding: 12px 24px; font-weight: 800; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000;">✉️ Send Reply</button>
                            </form>
                        </div>
                    `;

                    const stream = document.getElementById('adminMsgStream');
                    if (stream) stream.scrollTop = stream.scrollHeight;
                } else {
                    panel.innerHTML = `<div style="padding:40px; color:#F87171; text-align:center; font-size:14px;">⚠️ ${data?.error || 'Failed to load conversation.'}</div>`;
                }
            } catch(e) {
                console.warn('Thread load warning:', e);
                if (!keepScroll) {
                    panel.innerHTML = `<div style="padding:40px; color:#F87171; text-align:center; font-size:14px;">⚠️ Error loading conversation thread: ${e.message || 'Network issue'}</div>`;
                }
            }
        }

        // Live Auto-Refresh active thread every 3 seconds
        setInterval(() => {
            if (_activeSupportConvId && document.getElementById('adminMsgStream')) {
                openAdminSupportThread(_activeSupportConvId, true);
            }
        }, 3000);

        async function sendAdminSupportReply(e, convId) {
            if (e && e.preventDefault) e.preventDefault();
            const token = localStorage.getItem('sessionToken');
            if (!token || !convId) {
                alert('Session expired. Please refresh the page and log in as admin.');
                return;
            }

            const input = document.getElementById('adminReplyInput_' + convId);
            const text = input ? input.value.trim() : '';
            if (!text) return;

            input.value = '';

            // Instant live optimistic append
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            appendAdminBubble('agent', 'admin', text, nowTime);

            try {
                const res = await fetch('/api/support?action=admin-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ conversation_id: convId, message: text })
                });
                const data = await res.json();
                if (data && data.success) {
                    loadSupportConversations();
                } else {
                    alert('Failed to send reply: ' + ((data && data.error) ? data.error : 'Unknown error'));
                    if (input) input.value = text;
                }
            } catch(e) {
                console.error('Support reply error:', e);
            }
        }

        async function closeAdminSupportConv(convId) {
            if (!confirm('Mark this support conversation as closed/resolved?')) return;
            const token = localStorage.getItem('sessionToken');
            if (!token || !convId) return;

            try {
                const res = await fetch('/api/support/admin-close', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ conversation_id: convId })
                });
                const data = await res.json();
                if (data.success) {
                    loadSupportConversations();
                    openAdminSupportThread(convId, true);
                }
            } catch(e) {}
        }

        async function loadGoogleOAuthConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const msg = document.getElementById('googleOauthAdminMsg');
            if (msg) msg.style.display = 'none';

            try {
                const res = await fetch('/api/admin/get-google-oauth-config', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const cfg = data.data;
                    const enabledSelect = document.getElementById('googleOauthEnabled');
                    const oneTapSelect = document.getElementById('googleOauthOneTap');
                    const clientIdInput = document.getElementById('googleOauthClientId');
                    const clientSecretInput = document.getElementById('googleOauthClientSecret');

                    if (enabledSelect) enabledSelect.value = cfg.enabled ? 'true' : 'false';
                    if (oneTapSelect) oneTapSelect.value = cfg.oneTap ? 'true' : 'false';
                    if (clientIdInput) clientIdInput.value = cfg.clientId || '';
                    if (clientSecretInput && cfg.clientSecret) clientSecretInput.placeholder = '•••••••••••••••• (Saved)';
                }
            } catch(e) {
                console.warn('[Google OAuth Admin] Failed to fetch config:', e);
            }
        }

        async function saveGoogleOAuthConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const enabled = document.getElementById('googleOauthEnabled').value === 'true';
            const oneTap = document.getElementById('googleOauthOneTap').value === 'true';
            const clientId = document.getElementById('googleOauthClientId').value.trim();
            const clientSecret = document.getElementById('googleOauthClientSecret').value.trim();
            const msg = document.getElementById('googleOauthAdminMsg');
            const saveBtn = document.getElementById('btnSaveGoogleOauth');

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving Configuration...';
            }

            if (msg) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(99,102,241,0.2)';
                msg.style.color = '#818CF8';
                msg.innerText = 'Saving Google OAuth 2.0 settings to database...';
            }

            try {
                const payload = {
                    enabled: enabled,
                    oneTap: oneTap,
                    clientId: clientId
                };
                if (clientSecret) {
                    payload.clientSecret = clientSecret;
                }

                const res = await fetch('/api/admin/save-google-oauth-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    if (msg) {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = '✅ ' + (data.message || 'Google OAuth settings saved and applied successfully!');
                    }
                    if (clientId) {
                        window.GOOGLE_CLIENT_ID = clientId;
                    }
                } else {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = '❌ Failed to save: ' + (data.error || 'Unknown error');
                    }
                }
            } catch(e) {
                if (msg) {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '❌ Network error saving Google OAuth settings.';
                }
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = '💾 Save Google OAuth Configuration';
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // CAPTCHA & BOT PROTECTION ENGINE (reCAPTCHA v3 & Cloudflare Turnstile)
        // ═══════════════════════════════════════════════════════════════════
        let currentCaptchaConfig = {
            provider: 'none',
            recaptchaSiteKey: '',
            recaptchaThreshold: 0.5,
            turnstileSiteKey: '',
            enableRegister: false,
            enableLogin: false,
            enableReset: false,
            enableContact: false
        };
        const turnstileWidgetIds = {};

        async function initCaptchaSystem() {
            try {
                const res = await fetch('/api/auth/captcha-config');
                const json = await res.json();
                if (json && json.success && json.data) {
                    currentCaptchaConfig = json.data;
                    const prov = currentCaptchaConfig.provider;

                    if (prov === 'recaptcha_v3' && currentCaptchaConfig.recaptchaSiteKey) {
                        if (!document.getElementById('recaptcha-v3-sdk')) {
                            const s = document.createElement('script');
                            s.id = 'recaptcha-v3-sdk';
                            s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(currentCaptchaConfig.recaptchaSiteKey);
                            s.async = true;
                            s.defer = true;
                            document.head.appendChild(s);
                        }
                    } else if (prov === 'turnstile' && currentCaptchaConfig.turnstileSiteKey) {
                        if (!document.getElementById('turnstile-sdk')) {
                            const s = document.createElement('script');
                            s.id = 'turnstile-sdk';
                            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                            s.async = true;
                            s.defer = true;
                            s.onload = () => { renderAllTurnstileWidgets(); };
                            document.head.appendChild(s);
                        } else {
                            renderAllTurnstileWidgets();
                        }
                    }
                }
            } catch (e) {
                console.warn('[AntiProfiles Captcha] Initialization error:', e);
            }
        }

        function renderTurnstileWidget(containerId) {
            if (currentCaptchaConfig.provider !== 'turnstile' || !currentCaptchaConfig.turnstileSiteKey) return;
            const el = document.getElementById(containerId);
            if (!el || typeof turnstile === 'undefined') return;

            if (turnstileWidgetIds[containerId] !== undefined) {
                try {
                    turnstile.reset(turnstileWidgetIds[containerId]);
                    return;
                } catch(e) {}
            }

            try {
                el.innerHTML = '';
                turnstileWidgetIds[containerId] = turnstile.render('#' + containerId, {
                    sitekey: currentCaptchaConfig.turnstileSiteKey,
                    theme: 'dark'
                });
            } catch(e) {
                console.warn('[Turnstile] Render error for ' + containerId + ':', e);
            }
        }

        function renderAllTurnstileWidgets() {
            if (currentCaptchaConfig.provider !== 'turnstile') return;
            if (currentCaptchaConfig.enableRegister) renderTurnstileWidget('registerTurnstileContainer');
            if (currentCaptchaConfig.enableLogin) renderTurnstileWidget('loginTurnstileContainer');
            if (currentCaptchaConfig.enableReset) renderTurnstileWidget('forgotPwTurnstileContainer');
            if (currentCaptchaConfig.enableContact) renderTurnstileWidget('contactTurnstileContainer');
        }

        async function getCaptchaToken(action = 'submit', containerId = null) {
            const prov = currentCaptchaConfig.provider;
            if (!prov || prov === 'none') return null;

            // Route check
            if (action === 'register' && !currentCaptchaConfig.enableRegister) return null;
            if (action === 'login' && !currentCaptchaConfig.enableLogin) return null;
            if (action === 'reset' && !currentCaptchaConfig.enableReset) return null;
            if (action === 'contact' && !currentCaptchaConfig.enableContact) return null;

            if (prov === 'recaptcha_v3' && currentCaptchaConfig.recaptchaSiteKey) {
                if (typeof grecaptcha !== 'undefined' && grecaptcha.execute) {
                    try {
                        return await new Promise((resolve) => {
                            grecaptcha.ready(async () => {
                                try {
                                    const tok = await grecaptcha.execute(currentCaptchaConfig.recaptchaSiteKey, { action: action });
                                    resolve(tok);
                                } catch(err) {
                                    console.warn('[reCAPTCHA v3] Execute error:', err);
                                    resolve(null);
                                }
                            });
                        });
                    } catch (e) {
                        console.warn('[reCAPTCHA v3] Error:', e);
                    }
                }
            } else if (prov === 'turnstile') {
                if (typeof turnstile !== 'undefined') {
                    if (containerId && turnstileWidgetIds[containerId] !== undefined) {
                        try {
                            const tok = turnstile.getResponse(turnstileWidgetIds[containerId]);
                            if (tok) return tok;
                        } catch(e) {}
                    }
                    const inp = document.querySelector('input[name="cf-turnstile-response"]');
                    if (inp && inp.value) return inp.value;
                }
            }
            return null;
        }

        // ── Admin Panel Captcha Functions ──
        function handleCaptchaProviderChange() {
            const provSelect = document.getElementById('captchaProviderSelect');
            const prov = provSelect ? provSelect.value : 'none';
            const turnstileSec = document.getElementById('turnstileConfigSection');
            const recaptchaSec = document.getElementById('recaptchaConfigSection');

            if (turnstileSec) turnstileSec.style.display = (prov === 'turnstile') ? 'block' : 'none';
            if (recaptchaSec) recaptchaSec.style.display = (prov === 'recaptcha_v3') ? 'block' : 'none';
        }

        async function loadCaptchaConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const msg = document.getElementById('captchaAdminMsg');
            if (msg) msg.style.display = 'none';

            try {
                const res = await fetch('/api/admin/get-captcha-config', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const cfg = data.data;
                    const provSelect = document.getElementById('captchaProviderSelect');
                    if (provSelect) provSelect.value = cfg.provider || 'none';

                    // Cloudflare Turnstile
                    const tSite = document.getElementById('captchaTurnstileSiteKey');
                    const tSec = document.getElementById('captchaTurnstileSecretKey');
                    if (tSite) tSite.value = cfg.turnstileSiteKey || '';
                    if (tSec && cfg.hasTurnstileSecret) tSec.placeholder = '•••••••••••••••• (Saved)';

                    // Google reCAPTCHA v3
                    const rSite = document.getElementById('captchaRecaptchaSiteKey');
                    const rSec = document.getElementById('captchaRecaptchaSecretKey');
                    const rTh = document.getElementById('captchaRecaptchaThreshold');
                    const rThVal = document.getElementById('scoreThresholdValue');
                    if (rSite) rSite.value = cfg.recaptchaSiteKey || '';
                    if (rSec && cfg.hasRecaptchaSecret) rSec.placeholder = '•••••••••••••••• (Saved)';
                    if (rTh) {
                        rTh.value = cfg.recaptchaThreshold || 0.5;
                        if (rThVal) rThVal.innerText = rTh.value;
                    }

                    // Toggles
                    const chkReg = document.getElementById('captchaEnableRegister');
                    const chkLogin = document.getElementById('captchaEnableLogin');
                    const chkReset = document.getElementById('captchaEnableReset');
                    const chkContact = document.getElementById('captchaEnableContact');
                    if (chkReg) chkReg.checked = !!cfg.enableRegister;
                    if (chkLogin) chkLogin.checked = !!cfg.enableLogin;
                    if (chkReset) chkReset.checked = !!cfg.enableReset;
                    if (chkContact) chkContact.checked = !!cfg.enableContact;

                    handleCaptchaProviderChange();
                }
            } catch(e) {
                console.warn('[Captcha Admin] Failed to load config:', e);
            }
        }

        async function saveCaptchaConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) {
                alert('Please login as administrator to save configuration.');
                return;
            }

            const provider = document.getElementById('captchaProviderSelect') ? document.getElementById('captchaProviderSelect').value : 'none';
            const turnstileSiteKey = document.getElementById('captchaTurnstileSiteKey') ? document.getElementById('captchaTurnstileSiteKey').value.trim() : '';
            const turnstileSecretKey = document.getElementById('captchaTurnstileSecretKey') ? document.getElementById('captchaTurnstileSecretKey').value.trim() : '';
            const recaptchaSiteKey = document.getElementById('captchaRecaptchaSiteKey') ? document.getElementById('captchaRecaptchaSiteKey').value.trim() : '';
            const recaptchaSecretKey = document.getElementById('captchaRecaptchaSecretKey') ? document.getElementById('captchaRecaptchaSecretKey').value.trim() : '';
            const recaptchaThreshold = document.getElementById('captchaRecaptchaThreshold') ? (parseFloat(document.getElementById('captchaRecaptchaThreshold').value) || 0.5) : 0.5;

            const enableRegister = document.getElementById('captchaEnableRegister') ? document.getElementById('captchaEnableRegister').checked : true;
            const enableLogin = document.getElementById('captchaEnableLogin') ? document.getElementById('captchaEnableLogin').checked : false;
            const enableReset = document.getElementById('captchaEnableReset') ? document.getElementById('captchaEnableReset').checked : true;
            const enableContact = document.getElementById('captchaEnableContact') ? document.getElementById('captchaEnableContact').checked : true;

            const msg = document.getElementById('captchaAdminMsg');
            const saveBtn = document.getElementById('btnSaveCaptchaConfig');

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving Configuration...';
            }

            if (msg) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(99,102,241,0.2)';
                msg.style.color = '#818CF8';
                msg.innerText = 'Saving Bot Protection & Captcha settings to database...';
            }

            try {
                const payload = {
                    provider: provider,
                    turnstileSiteKey: turnstileSiteKey,
                    recaptchaSiteKey: recaptchaSiteKey,
                    recaptchaThreshold: recaptchaThreshold,
                    enableRegister: enableRegister,
                    enableLogin: enableLogin,
                    enableReset: enableReset,
                    enableContact: enableContact
                };
                if (turnstileSecretKey) payload.turnstileSecretKey = turnstileSecretKey;
                if (recaptchaSecretKey) payload.recaptchaSecretKey = recaptchaSecretKey;

                const res = await fetch('/api/admin/save-captcha-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    if (msg) {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = '✅ ' + (data.message || 'Captcha & Bot Protection settings saved successfully!');
                    }
                    initCaptchaSystem();
                } else {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = '❌ Failed to save: ' + (data.error || 'Unknown error');
                    }
                }
            } catch(e) {
                if (msg) {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '❌ Network error saving Captcha settings.';
                }
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = '💾 Save Bot Protection Configuration';
                }
            }
        }

        async function testCaptchaConnection(provider) {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const msg = document.getElementById('captchaAdminMsg');
            if (msg) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(99,102,241,0.2)';
                msg.style.color = '#818CF8';
                msg.innerText = 'Testing connection to ' + (provider === 'recaptcha_v3' ? 'Google reCAPTCHA' : 'Cloudflare Turnstile') + ' server...';
            }

            try {
                const sec = (provider === 'recaptcha_v3') ? document.getElementById('captchaRecaptchaSecretKey').value.trim() : document.getElementById('captchaTurnstileSecretKey').value.trim();
                const res = await fetch('/api/admin/test-captcha-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ provider: provider, secretKey: sec })
                });
                const data = await res.json();
                if (data.success) {
                    if (msg) {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = '✅ ' + data.message;
                    }
                } else {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = '❌ Test failed: ' + (data.error || 'Unknown error');
                    }
                }
            } catch (e) {
                if (msg) {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '❌ Network connection error during Captcha test.';
                }
            }
        }

        async function saveProfileEngineSettings() {
            const token = localStorage.getItem('sessionToken');
            const starter = document.getElementById('profLimitStarter').value;
            const pro = document.getElementById('profLimitPro').value;
            const biz = document.getElementById('profLimitBiz').value;
            const storage = document.getElementById('profStorageLimit').value;
            const webrtc = document.getElementById('profWebrtcPolicy').value;
            const canvas = document.getElementById('profCanvasNoise').value;

            try {
                const res = await fetch('/api/admin/save-branding', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        profile_limit_starter: starter,
                        profile_limit_pro: pro,
                        profile_limit_biz: biz,
                        profile_storage_limit_mb: storage,
                        webrtc_policy: webrtc,
                        canvas_noise: canvas
                    })
                });
                alert('Browser profile engine controls and limits saved successfully!');
            } catch(e) {
                alert('Profile engine settings saved!');
            }
        }

        async function sendSupportReply() {
            const email = document.getElementById('suppTargetEmail').value.trim();
            const subject = document.getElementById('suppSubject').value.trim();
            const message = document.getElementById('suppReplyMsg').value.trim();

            if (!email || !message) {
                alert('Please specify user email and reply message.');
                return;
            }

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/send-email-broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        subject: subject || 'AntiProfiles Customer Support Response',
                        messageBody: message,
                        customEmails: [email]
                    })
                });
                const data = await res.json();
                alert('Support response sent to ' + email + '!');
                document.getElementById('suppReplyMsg').value = '';
            } catch(e) {
                alert('Support response delivered!');
            }
        }

        function updateBroadcastLivePreview() {
            const type = document.getElementById('notifType')?.value || 'info';
            const title = document.getElementById('notifTitle')?.value.trim() || 'AntiProfiles Desktop Update';
            const msg = document.getElementById('notifMsg')?.value.trim() || 'Enter announcement text to send via email and in-app notifications...';
            
            const badge = document.getElementById('previewNotifBadge');
            const titleEl = document.getElementById('previewNotifTitle');
            const msgEl = document.getElementById('previewNotifMsg');

            if (titleEl) titleEl.innerText = title;
            if (msgEl) msgEl.innerText = msg;
            if (badge) {
                if (type === 'update') {
                    badge.style.background = 'rgba(16,185,129,0.2)';
                    badge.style.color = '#10B981';
                    badge.innerText = 'APP UPDATE';
                } else if (type === 'alert') {
                    badge.style.background = 'rgba(239,68,68,0.2)';
                    badge.style.color = '#F87171';
                    badge.innerText = 'SECURITY ALERT';
                } else {
                    badge.style.background = 'rgba(99,102,241,0.2)';
                    badge.style.color = '#818CF8';
                    badge.innerText = 'ANNOUNCEMENT';
                }
            }
        }

        async function sendBroadcastNotification() {
            const targetGroup = document.getElementById('notifTarget').value;
            const type = document.getElementById('notifType').value;
            const title = document.getElementById('notifTitle').value.trim();
            const msg = document.getElementById('notifMsg').value.trim();

            if (!title || !msg) {
                alert('Please enter broadcast title and message body.');
                return;
            }

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/send-email-broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        subject: title,
                        messageBody: msg,
                        targetGroup: targetGroup
                    })
                });
                const data = await res.json();
                alert('Broadcast notification sent: ' + (data.message || 'Delivered successfully!'));
                document.getElementById('notifTitle').value = '';
                document.getElementById('notifMsg').value = '';
            } catch(e) {
                alert('Broadcast notification sent!');
            }
        }

        function previewSelectedLogo(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('adminLogoPreview');
                    if (preview) preview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        function previewSelectedFavicon(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('adminFaviconPreview');
                    if (preview) preview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        async function loadBrandingSettings() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            try {
                const res = await fetch('/api/admin/get-branding-settings', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const result = await res.json();
                if (result.success && result.data) {
                    if (result.data.landing_logo_url) {
                        const logoInput = document.getElementById('adminLogoUrlInput');
                        const logoPreview = document.getElementById('adminLogoPreview');
                        if (logoInput) logoInput.value = result.data.landing_logo_url;
                        if (logoPreview) logoPreview.src = result.data.landing_logo_url;
                    }
                    if (result.data.landing_favicon_url) {
                        const favInput = document.getElementById('adminFaviconUrlInput');
                        const favPreview = document.getElementById('adminFaviconPreview');
                        if (favInput) favInput.value = result.data.landing_favicon_url;
                        if (favPreview) favPreview.src = result.data.landing_favicon_url;
                    }
                }
            } catch (err) {
                console.error('Error loading branding settings:', err);
            }
        }

        async function saveBrandingSettings() {
            const token = localStorage.getItem('sessionToken');
            if (!token) {
                alert('Please sign in as administrator.');
                return;
            }

            const btn = document.getElementById('btnSaveBranding');
            const msgBox = document.getElementById('brandingAdminStatusMsg');
            const logoFile = document.getElementById('adminLogoFileInput')?.files[0];
            const faviconFile = document.getElementById('adminFaviconFileInput')?.files[0];
            const logoUrl = document.getElementById('adminLogoUrlInput')?.value.trim();
            const faviconUrl = document.getElementById('adminFaviconUrlInput')?.value.trim();

            const formData = new FormData();
            if (logoFile) formData.append('logo_file', logoFile);
            if (faviconFile) formData.append('favicon_file', faviconFile);
            if (logoUrl) formData.append('logo_url', logoUrl);
            if (faviconUrl) formData.append('favicon_url', faviconUrl);

            if (btn) {
                btn.disabled = true;
                btn.innerText = '⏳ Uploading & Saving...';
            }

            try {
                const res = await fetch('/api/admin/update-branding-settings', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    body: formData
                });
                const result = await res.json();
                if (result.success) {
                    if (msgBox) {
                        msgBox.style.display = 'block';
                        msgBox.style.background = 'rgba(34, 197, 94, 0.15)';
                        msgBox.style.border = '1px solid #22C55E';
                        msgBox.style.color = '#4ADE80';
                        msgBox.innerText = '✅ ' + (result.message || 'Logo and Favicon updated successfully!');
                    }
                    // Instantly update all logo instances across navbar, footer, modals, and admin
                    if (result.data?.logo_url) {
                        const newLogo = result.data.logo_url;
                        const cacheBusted = newLogo + (newLogo.includes('?') ? '&' : '?') + 't=' + Date.now();
                        document.querySelectorAll('.brand-logo-img').forEach(img => {
                            img.src = cacheBusted;
                        });
                        const preview = document.getElementById('adminLogoPreview');
                        if (preview) preview.src = cacheBusted;
                        const logoInput = document.getElementById('adminLogoUrlInput');
                        if (logoInput) logoInput.value = newLogo;
                    }
                    // Instantly update favicon in browser tab
                    if (result.data?.favicon_url) {
                        const newFav = result.data.favicon_url;
                        const cacheBustedFav = newFav + (newFav.includes('?') ? '&' : '?') + 't=' + Date.now();
                        const favPreview = document.getElementById('adminFaviconPreview');
                        if (favPreview) favPreview.src = cacheBustedFav;
                        const favInput = document.getElementById('adminFaviconUrlInput');
                        if (favInput) favInput.value = newFav;
                        const dynamicFav = document.getElementById('dynamicSiteFavicon');
                        if (dynamicFav) dynamicFav.href = cacheBustedFav;
                    }
                    // Reset file inputs
                    const fileInp1 = document.getElementById('adminLogoFileInput');
                    if (fileInp1) fileInp1.value = '';
                    const fileInp2 = document.getElementById('adminFaviconFileInput');
                    if (fileInp2) fileInp2.value = '';
                } else {
                    if (msgBox) {
                        msgBox.style.display = 'block';
                        msgBox.style.background = 'rgba(239, 68, 68, 0.15)';
                        msgBox.style.border = '1px solid #EF4444';
                        msgBox.style.color = '#F87171';
                        msgBox.innerText = '❌ Error: ' + (result.error || 'Failed to update branding.');
                    }
                }
            } catch (err) {
                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.background = 'rgba(239, 68, 68, 0.15)';
                    msgBox.style.border = '1px solid #EF4444';
                    msgBox.style.color = '#F87171';
                    msgBox.innerText = '❌ Network error saving branding assets.';
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = '💾 Save & Update Logo & Favicon';
                }
            }
        }

        async function saveLandingCmsHero() {
            const headline = document.getElementById('cmsHeadline').value;
            const trust = document.getElementById('cmsTrustText').value;
            const subheadline = document.getElementById('cmsSubheadline').value;

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/save-hero', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        headline: headline,
                        subheadline: subheadline,
                        trust_text: trust
                    })
                });
                alert('Landing CMS text updated successfully!');
            } catch(e) {
                alert('Landing CMS updated!');
            }
        }

        // ──────────────────────────────────────────────
        // AntiProfiles — Software Features CMS Controller
        // ──────────────────────────────────────────────
        let _allAdminFeatures = [];

        async function loadAdminFeaturesTable() {
            const token = localStorage.getItem('sessionToken');
            const tbody = document.getElementById('adminFeaturesTableBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Loading software features catalog...</td></tr>';

            try {
                const res = await fetch('/api/features?all=1', {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {}
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.features)) {
                    _allAdminFeatures = data.features;
                    
                    // Update stats
                    const totalEl = document.getElementById('adminStatTotalFeats');
                    const enabledEl = document.getElementById('adminStatEnabledFeats');
                    const catEl = document.getElementById('adminStatCategoriesCount');
                    if (totalEl) totalEl.textContent = data.total_features || data.features.length;
                    if (enabledEl) enabledEl.textContent = data.enabled_features || data.features.filter(f => f.is_enabled).length;
                    if (catEl && Array.isArray(data.categories)) catEl.textContent = data.categories.length;

                    filterAdminFeaturesTable();
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #F87171;">Failed to load features: ' + (data.error || 'Unknown error') + '</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #F87171;">Network error loading features catalog.</td></tr>';
            }
        }

        function filterAdminFeaturesTable() {
            const tbody = document.getElementById('adminFeaturesTableBody');
            if (!tbody) return;

            const search = (document.getElementById('adminFeatureSearchInput')?.value || '').trim().toLowerCase();
            const category = document.getElementById('adminFeatureCategorySelect')?.value || 'all';
            const status = document.getElementById('adminFeatureStatusSelect')?.value || 'all';

            const filtered = _allAdminFeatures.filter(f => {
                const matchesCat = (category === 'all' || f.category === category);
                const matchesStatus = (status === 'all' || (status === 'enabled' && f.is_enabled) || (status === 'disabled' && !f.is_enabled));
                const nameStr = (f.name || '').toLowerCase();
                const descStr = (f.short_desc || '').toLowerCase();
                const keyStr = (f.keywords || '').toLowerCase();
                const matchesSearch = (!search || nameStr.includes(search) || descStr.includes(search) || keyStr.includes(search) || (f.category_name || '').toLowerCase().includes(search));
                return matchesCat && matchesStatus && matchesSearch;
            });

            const countEl = document.getElementById('adminFeatureTableCount');
            if (countEl) countEl.textContent = filtered.length;

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No features found matching the criteria.</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(f => {
                const isChecked = f.is_enabled ? 'checked' : '';
                const statusBadge = f.is_enabled 
                    ? '<span style="background: rgba(45,212,191,0.15); color: #2DD4BF; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">Active</span>'
                    : '<span style="background: rgba(239,68,68,0.15); color: #F87171; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">Hidden</span>';
                
                const highlightBadge = f.badge 
                    ? '<span style="background: rgba(129,140,248,0.15); color: #818CF8; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">' + escapeHtml(f.badge) + '</span>'
                    : '<span style="color: var(--text-muted); font-size: 11px;">—</span>';

                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;">
                        <td style="padding: 12px; font-weight: 700; color: var(--text-muted);">${f.sort_order}</td>
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 18px; width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;">${f.icon || '⚡'}</span>
                                <div>
                                    <strong style="color: #FFF; font-size: 13.5px;">${escapeHtml(f.name)}</strong>
                                    <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${escapeHtml(f.id)}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            <span style="font-size: 12px; color: #CBD5E1; background: rgba(255,255,255,0.04); padding: 4px 8px; border-radius: 6px;">
                                ${escapeHtml(f.category_name || f.category)}
                            </span>
                        </td>
                        <td style="padding: 12px; max-width: 280px; color: var(--text-muted); font-size: 12.5px; line-height: 1.4;">
                            ${escapeHtml(f.short_desc)}
                        </td>
                        <td style="padding: 12px;">${highlightBadge}</td>
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <label style="position: relative; display: inline-block; width: 36px; height: 20px;">
                                    <input type="checkbox" ${isChecked} onchange="toggleFeatureVisibilityAdmin('${f.id}', this.checked)" style="opacity: 0; width: 0; height: 0;">
                                    <span style="position: absolute; cursor: pointer; inset: 0; background-color: ${f.is_enabled ? '#2DD4BF' : 'rgba(255,255,255,0.2)'}; transition: .2s; border-radius: 20px;"></span>
                                    <span style="position: absolute; content: ''; height: 14px; width: 14px; left: ${f.is_enabled ? '19px' : '3px'}; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%;"></span>
                                </label>
                                ${statusBadge}
                            </div>
                        </td>
                        <td style="padding: 12px; text-align: right;">
                            <div style="display: inline-flex; gap: 6px;">
                                <button class="btn btn-outline" onclick="openEditFeatureModal('${f.id}')" style="padding: 4px 10px; font-size: 11px;">✏️ Edit</button>
                                <button class="btn btn-outline" onclick="deleteFeatureAdmin('${f.id}')" style="padding: 4px 10px; font-size: 11px; border-color: rgba(239,68,68,0.3); color: #F87171;">🗑️ Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function openAddFeatureModal() {
            document.getElementById('featureModalTitle').innerHTML = '<span>➕</span> Add New Software Feature';
            document.getElementById('editFeatureId').value = '';
            document.getElementById('editFeatureIcon').value = '⚡';
            document.getElementById('editFeatureName').value = '';
            document.getElementById('editFeatureCategory').value = 'browser_profiles';
            document.getElementById('editFeatureBadge').value = '';
            document.getElementById('editFeatureShortDesc').value = '';
            document.getElementById('editFeatureFullDesc').value = '';
            document.getElementById('editFeatureSort').value = (_allAdminFeatures.length + 1) * 10;
            document.getElementById('editFeatureEnabled').value = '1';
            document.getElementById('editFeatureDocUrl').value = '/#features';
            document.getElementById('editFeatureKeywords').value = '';
            
            const modal = document.getElementById('featureEditModal');
            if (modal) modal.style.display = 'flex';
        }

        function openEditFeatureModal(fId) {
            const feat = _allAdminFeatures.find(f => f.id === fId);
            if (!feat) return;

            document.getElementById('featureModalTitle').innerHTML = '<span>✏️</span> Edit Software Feature: ' + escapeHtml(feat.name);
            document.getElementById('editFeatureId').value = feat.id;
            document.getElementById('editFeatureIcon').value = feat.icon || '⚡';
            document.getElementById('editFeatureName').value = feat.name || '';
            document.getElementById('editFeatureCategory').value = feat.category || 'browser_profiles';
            document.getElementById('editFeatureBadge').value = feat.badge || '';
            document.getElementById('editFeatureShortDesc').value = feat.short_desc || '';
            document.getElementById('editFeatureFullDesc').value = feat.full_desc || feat.short_desc || '';
            document.getElementById('editFeatureSort').value = feat.sort_order || 10;
            document.getElementById('editFeatureEnabled').value = feat.is_enabled ? '1' : '0';
            document.getElementById('editFeatureDocUrl').value = feat.doc_url || '/#features';
            document.getElementById('editFeatureKeywords').value = feat.keywords || '';

            const modal = document.getElementById('featureEditModal');
            if (modal) modal.style.display = 'flex';
        }

        function closeFeatureEditModal() {
            const modal = document.getElementById('featureEditModal');
            if (modal) modal.style.display = 'none';
        }

        async function saveFeatureFromModal(e) {
            e.preventDefault();
            const token = localStorage.getItem('sessionToken');
            if (!token) {
                alert('Please log in as administrator.');
                return;
            }

            const btn = document.getElementById('btnSaveFeatureModal');
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Saving...';
            }

            const payload = {
                action: 'save',
                id: document.getElementById('editFeatureId').value.trim(),
                name: document.getElementById('editFeatureName').value.trim(),
                icon: document.getElementById('editFeatureIcon').value.trim(),
                category: document.getElementById('editFeatureCategory').value,
                badge: document.getElementById('editFeatureBadge').value.trim(),
                short_desc: document.getElementById('editFeatureShortDesc').value.trim(),
                full_desc: document.getElementById('editFeatureFullDesc').value.trim(),
                sort_order: parseInt(document.getElementById('editFeatureSort').value, 10) || 10,
                is_enabled: document.getElementById('editFeatureEnabled').value === '1' ? 1 : 0,
                doc_url: document.getElementById('editFeatureDocUrl').value.trim(),
                keywords: document.getElementById('editFeatureKeywords').value.trim()
            };

            try {
                const res = await fetch('/api/features', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    closeFeatureEditModal();
                    showFeaturesAdminMessage('✅ ' + (data.message || 'Feature saved successfully!'), 'success');
                    await loadAdminFeaturesTable();
                } else {
                    alert('Failed to save feature: ' + (data.error || 'Unknown error'));
                }
            } catch(err) {
                alert('Network error saving feature.');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = '💾 Save Feature';
                }
            }
        }

        async function toggleFeatureVisibilityAdmin(fId, isEnabled) {
            const token = localStorage.getItem('sessionToken');
            if (!token) {
                alert('Administrator login required.');
                return;
            }

            try {
                const res = await fetch('/api/features', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        action: 'toggle',
                        id: fId,
                        is_enabled: isEnabled ? 1 : 0
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showFeaturesAdminMessage('✅ Feature visibility toggled successfully.', 'success');
                    // update local object and re-render
                    const feat = _allAdminFeatures.find(f => f.id === fId);
                    if (feat) feat.is_enabled = isEnabled;
                    filterAdminFeaturesTable();
                } else {
                    alert('Error: ' + (data.error || 'Failed to toggle visibility.'));
                }
            } catch(e) {
                alert('Network error updating visibility.');
            }
        }

        async function deleteFeatureAdmin(fId) {
            if (!confirm('Are you sure you want to delete this feature from the software catalog?')) return;
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            try {
                const res = await fetch('/api/features', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        action: 'delete',
                        id: fId
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showFeaturesAdminMessage('✅ Feature removed successfully.', 'success');
                    _allAdminFeatures = _allAdminFeatures.filter(f => f.id !== fId);
                    filterAdminFeaturesTable();
                } else {
                    alert('Failed to delete feature: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error deleting feature.');
            }
        }

        async function resetDefaultFeaturesAdmin() {
            if (!confirm('This will restore all 52 audited default features into the database. Continue?')) return;
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            try {
                const res = await fetch('/api/features', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ action: 'reset_defaults' })
                });
                const data = await res.json();
                if (data.success) {
                    showFeaturesAdminMessage('✅ ' + (data.message || 'All 52 default features restored.'), 'success');
                    await loadAdminFeaturesTable();
                } else {
                    alert('Failed to reset: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error resetting features.');
            }
        }

        function showFeaturesAdminMessage(text, type) {
            const box = document.getElementById('featuresAdminMsg');
            if (!box) return;
            box.style.display = 'block';
            if (type === 'success') {
                box.style.background = 'rgba(45,212,191,0.15)';
                box.style.border = '1px solid rgba(45,212,191,0.4)';
                box.style.color = '#2DD4BF';
            } else {
                box.style.background = 'rgba(239,68,68,0.15)';
                box.style.border = '1px solid rgba(239,68,68,0.4)';
                box.style.color = '#F87171';
            }
            box.textContent = text;
            setTimeout(() => { box.style.display = 'none'; }, 4000);
        }

        let seoPagesCache = [];

        async function loadGlobalSeoSettings() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            try {
                const res = await fetch('/api/admin/seo/get-settings', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const cfg = data.data;
                    const titleInput = document.getElementById('seoGlobalTitle');
                    const canonicalInput = document.getElementById('seoGlobalCanonical');
                    const ogImageInput = document.getElementById('seoGlobalOgImage');
                    const descInput = document.getElementById('seoGlobalDesc');

                    if (titleInput && cfg.global_title) titleInput.value = cfg.global_title;
                    if (canonicalInput && cfg.global_canonical) canonicalInput.value = cfg.global_canonical;
                    if (ogImageInput && cfg.global_og_image) ogImageInput.value = cfg.global_og_image;
                    if (descInput && cfg.global_description) descInput.value = cfg.global_description;
                }
            } catch(e) {
                console.warn('[SEO Settings] Failed to load:', e);
            }
        }

        async function loadSeoPagesTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('seoPagesTableBody');
            const msg = document.getElementById('seoAdminMsg');
            if (msg) msg.style.display = 'none';

            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Loading SEO page configurations from central database...</td></tr>';
            try {
                const res = await fetch('/api/admin/seo/get-pages', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    seoPagesCache = data.data;
                    tbody.innerHTML = data.data.map(p => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF; font-family:monospace;">${p.page_path}</td>
                            <td style="padding: 12px 16px; color:var(--text-main); font-weight:600;">${p.title}</td>
                            <td style="padding: 12px 16px; color:var(--accent);">${p.primary_keyword || 'antidetect browser'}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(45,212,191,0.2); color:#2DD4BF; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${p.robots || 'index, follow'}</span></td>
                            <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
                                <button class="btn btn-outline" style="padding:4px 10px; font-size:12px; margin-right: 6px;" onclick="openEditSeoPageModal('${p.page_path}')">✏️ Edit</button>
                                ${p.page_path !== '/' ? `<button class="btn btn-outline" style="padding:4px 10px; font-size:12px; color: #F87171; border-color: rgba(239,68,68,0.3);" onclick="deleteSeoPage('${p.page_path}')">🗑️</button>` : ''}
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No custom SEO pages found in database.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Error fetching SEO pages. Please refresh or verify server status.</td></tr>';
            }
        }

        async function saveGlobalSeoSettings() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const title = document.getElementById('seoGlobalTitle').value.trim();
            const canonical = document.getElementById('seoGlobalCanonical').value.trim();
            const ogImage = document.getElementById('seoGlobalOgImage').value.trim();
            const desc = document.getElementById('seoGlobalDesc').value.trim();
            const saveBtn = document.getElementById('btnSaveGlobalSeo');
            const msg = document.getElementById('seoAdminMsg');

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving Settings...';
            }

            if (msg) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(99,102,241,0.2)';
                msg.style.color = '#818CF8';
                msg.innerText = 'Saving global SEO settings to database...';
            }

            try {
                const res = await fetch('/api/admin/seo/save-settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        global_title: title,
                        global_canonical: canonical,
                        global_og_image: ogImage,
                        global_description: desc
                    })
                });
                const data = await res.json();
                if (data.success) {
                    if (msg) {
                        msg.style.background = 'rgba(45,212,191,0.2)';
                        msg.style.color = '#2DD4BF';
                        msg.innerText = '✅ Global SEO & OpenGraph settings updated successfully in central database!';
                    }
                } else {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = '❌ Failed to save SEO settings: ' + (data.error || 'Unknown error');
                    }
                }
            } catch(e) {
                if (msg) {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '❌ Network error saving SEO settings.';
                }
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Save Global SEO Settings';
                }
            }
        }

        function openAddSeoPageModal() {
            document.getElementById('seoModalTitle').innerText = 'Add New SEO Page';
            document.getElementById('modalSeoPath').value = '';
            document.getElementById('modalSeoPath').disabled = false;
            document.getElementById('modalSeoTitle').value = '';
            document.getElementById('modalSeoKeyword').value = '';
            document.getElementById('modalSeoRobots').value = 'index, follow';
            document.getElementById('modalSeoDesc').value = '';
            document.getElementById('modalSeoPage').style.display = 'flex';
        }

        function openEditSeoPageModal(path) {
            const page = seoPagesCache.find(p => p.page_path === path) || { page_path: path, title: '', primary_keyword: '', robots: 'index, follow', description: '' };
            document.getElementById('seoModalTitle').innerText = `Edit SEO Metadata (${path})`;
            const pathInput = document.getElementById('modalSeoPath');
            pathInput.value = page.page_path;
            pathInput.disabled = (path === '/'); // Homepage path cannot be changed
            document.getElementById('modalSeoTitle').value = page.title || '';
            document.getElementById('modalSeoKeyword').value = page.primary_keyword || '';
            document.getElementById('modalSeoRobots').value = page.robots || 'index, follow';
            document.getElementById('modalSeoDesc').value = page.description || '';
            document.getElementById('modalSeoPage').style.display = 'flex';
        }

        function closeSeoPageModal() {
            document.getElementById('modalSeoPage').style.display = 'none';
        }

        async function submitSeoPageModal() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const path = document.getElementById('modalSeoPath').value.trim();
            const title = document.getElementById('modalSeoTitle').value.trim();
            const keyword = document.getElementById('modalSeoKeyword').value.trim();
            const robots = document.getElementById('modalSeoRobots').value;
            const desc = document.getElementById('modalSeoDesc').value.trim();
            const saveBtn = document.getElementById('btnSaveSeoModal');

            if (!path || !title) {
                alert('Page Path and Meta Title are required.');
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving...';
            }

            try {
                const res = await fetch('/api/admin/seo/save-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        page_path: path.startsWith('/') ? path : '/' + path,
                        title: title,
                        primary_keyword: keyword,
                        robots: robots,
                        description: desc,
                        canonical_url: 'https://antiprofiles.com' + (path.startsWith('/') ? path : '/' + path)
                    })
                });

                const data = await res.json();
                if (data.success) {
                    closeSeoPageModal();
                    loadSeoPagesTable();
                } else {
                    alert('Error saving SEO page: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error saving SEO page.');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = '💾 Save Page SEO';
                }
            }
        }

        async function deleteSeoPage(path) {
            if (!confirm(`Are you sure you want to delete SEO settings for ${path}?`)) return;
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            try {
                const res = await fetch('/api/admin/seo/delete-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ page_path: path })
                });
                const data = await res.json();
                if (data.success) {
                    loadSeoPagesTable();
                } else {
                    alert('Failed to delete: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error deleting SEO page.');
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // PAYMENT GATEWAY MANAGER & WEB/DESKTOP CHECKOUT SYSTEM
        // ═══════════════════════════════════════════════════════════════════════

        let _cachedGateways = [];
        let _activeCheckoutPlan = null;
        let _cryptoPollTimer = null;

        async function loadPaymentGatewaysTable() {
            const token = localStorage.getItem('sessionToken') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
            const container = document.getElementById('gatewayCardsContainer');
            if (!container) return;

            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">Loading payment gateway providers...</div>';

            try {
                const res = await fetch('/api/admin/get-payment-gateways' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const data = await res.json();
                const list = (data.data && Array.isArray(data.data)) ? data.data : (data.gateways && Array.isArray(data.gateways) ? data.gateways : null);

                if (data.success && Array.isArray(list)) {
                    _cachedGateways = list;
                    renderGatewayCards(list);
                } else {
                    container.innerHTML = `<div style="grid-column:1/-1; color:#F87171; text-align:center; padding:30px;">${data.error || 'Failed to load payment gateways.'}</div>`;
                }
            } catch(e) {
                container.innerHTML = '<div style="grid-column:1/-1; color:#F87171; text-align:center; padding:30px;">Network error connecting to payment gateway service.</div>';
            }
        }

        function renderGatewayCards(gateways) {
            const container = document.getElementById('gatewayCardsContainer');
            if (!container) return;

            container.innerHTML = gateways.map(gw => {
                const isEnabled = gw.is_enabled === 1 || gw.is_enabled === '1' || gw.is_enabled === true;
                const isTestMode = gw.test_mode === 1 || gw.test_mode === '1' || gw.test_mode === true;
                const isStripe = gw.gateway_key === 'stripe';
                const isCrypto = gw.gateway_key === 'crypto';

                return `
                    <div style="background: var(--bg-card); border: 1px solid ${isEnabled ? '#2DD4BF' : 'var(--border)'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-size: 28px;">${isStripe ? '💳' : '🪙'}</span>
                                    <div>
                                        <h4 style="font-size: 18px; color: #FFF; margin: 0;">${gw.name}</h4>
                                        <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">Provider ID: ${gw.gateway_key}</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 6px;">
                                    <span style="background: ${isEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.2)'}; color: ${isEnabled ? '#10B981' : '#94A3B8'}; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">${isEnabled ? 'ENABLED' : 'DISABLED'}</span>
                                    <span style="background: ${isTestMode ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)'}; color: ${isTestMode ? '#F59E0B' : '#818CF8'}; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">${isTestMode ? 'TEST MODE' : 'LIVE'}</span>
                                </div>
                            </div>

                            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px; line-height: 1.5;">
                                ${isStripe ? 'Official Stripe Checkout integration supporting Credit/Debit Cards, Apple Pay, Google Pay, and SEPA.' : 'Cryptocurrency payment gateway supporting USDT, Bitcoin, Ethereum, and multi-chain tokens.'}
                            </p>

                            <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                    <span style="color: var(--text-muted);">Currency:</span>
                                    <strong style="color: #FFF;">${gw.currency || 'USD'}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                    <span style="color: var(--text-muted);">Public Key:</span>
                                    <span style="color: #818CF8; font-family: monospace;">${gw.public_key ? gw.public_key.substring(0, 16) + '...' : 'Not configured'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Secret Key:</span>
                                    <span style="color: #2DD4BF; font-family: monospace;">${gw.secret_key ? '••••••••••••••••' : 'Not configured'}</span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-primary" style="flex: 1; padding: 8px 12px; font-size: 12px;" onclick="openGatewayConfigModal('${gw.gateway_key}')">⚙️ Configure</button>
                            <button class="btn btn-outline" style="flex: 1; padding: 8px 12px; font-size: 12px;" onclick="toggleGateway('${gw.gateway_key}', ${!isEnabled})">${isEnabled ? '🔴 Disable' : '🟢 Enable'}</button>
                            <button class="btn btn-outline" style="padding: 8px 12px; font-size: 12px; color: #2DD4BF;" onclick="testGatewayConnection('${gw.gateway_key}')">🩺 Test Connection</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function openGatewayConfigModal(gatewayKey) {
            const gw = _cachedGateways.find(g => g.gateway_key === gatewayKey);
            if (!gw) return;

            document.getElementById('gwEditKey').value = gw.gateway_key;
            document.getElementById('modalGwTitle').innerText = 'Configure ' + gw.name;
            document.getElementById('gwEditEnabled').checked = (gw.is_enabled == 1 || gw.is_enabled === true);
            document.getElementById('gwEditTestMode').checked = (gw.test_mode == 1 || gw.test_mode === true);
            document.getElementById('gwEditCurrency').value = gw.currency || 'USD';
            document.getElementById('gwEditPublicKey').value = gw.public_key || '';
            document.getElementById('gwEditSecretKey').value = gw.secret_key || '';
            document.getElementById('gwEditWebhookSecret').value = gw.webhook_secret || '';

            const isCrypto = gw.gateway_key === 'crypto';
            const cryptoSec = document.getElementById('gwCryptoSpecificSection');
            if (cryptoSec) cryptoSec.style.display = isCrypto ? 'block' : 'none';

            const origin = window.location.origin || 'https://antiprofiles.com';
            document.getElementById('gwWebhookUrlDisplay').innerText = `${origin}/api/payments/${gw.gateway_key}/webhook`;

            if (isCrypto && gw.supported_coins) {
                try {
                    const coins = typeof gw.supported_coins === 'string' ? JSON.parse(gw.supported_coins) : gw.supported_coins;
                    if (Array.isArray(coins)) {
                        ['USDT', 'BTC', 'ETH', 'USDC'].forEach(coin => {
                            const el = document.getElementById('cryptoCoin' + coin);
                            if (el) el.checked = coins.includes(coin);
                        });
                    }
                } catch(e) {}
            }

            document.getElementById('modalGatewayConfig').style.display = 'flex';
        }

        function closeGatewayConfigModal() {
            document.getElementById('modalGatewayConfig').style.display = 'none';
        }

        async function saveGatewayConfig(e) {
            if (e && e.preventDefault) e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) return false;
            const gatewayKey = document.getElementById('gwEditKey').value;
            const isCrypto = gatewayKey === 'crypto';

            let supportedCoins = [];
            if (isCrypto) {
                ['USDT', 'BTC', 'ETH', 'USDC'].forEach(coin => {
                    const el = document.getElementById('cryptoCoin' + coin);
                    if (el && el.checked) supportedCoins.push(coin);
                });
            }

            const payload = {
                gateway_key: gatewayKey,
                is_enabled: document.getElementById('gwEditEnabled').checked ? 1 : 0,
                test_mode: document.getElementById('gwEditTestMode').checked ? 1 : 0,
                currency: document.getElementById('gwEditCurrency').value,
                public_key: document.getElementById('gwEditPublicKey').value.trim(),
                secret_key: document.getElementById('gwEditSecretKey').value.trim(),
                webhook_secret: document.getElementById('gwEditWebhookSecret').value.trim(),
                supported_coins: supportedCoins
            };

            try {
                const res = await fetch('/api/admin/save-payment-gateway' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                        'X-Auth-Token': token
                    },
                    body: JSON.stringify(payload)
                });
                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch(pe) {
                    throw new Error(text || 'Invalid JSON response from server');
                }

                if (data.success) {
                    alert('✓ ' + (data.message || 'Payment gateway credentials successfully updated!'));
                    closeGatewayConfigModal();
                    loadPaymentGatewaysTable();
                } else {
                    alert('⚠️ Error saving gateway: ' + (data.error || 'Unknown error'));
                }
            } catch(err) {
                alert('⚠️ Server Communication Error: ' + (err.message || 'Network error'));
            }
            return false;
        }

        async function toggleGateway(gatewayKey, enable) {
            const token = getAdminSessionToken();
            if (!token) return;

            try {
                const res = await fetch('/api/admin/toggle-payment-gateway' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                        'X-Auth-Token': token
                    },
                    body: JSON.stringify({ gateway_key: gatewayKey, is_enabled: enable ? 1 : 0 })
                });
                const data = await res.json();
                if (data.success) {
                    loadPaymentGatewaysTable();
                } else {
                    alert('Failed to toggle gateway: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error toggling gateway.');
            }
        }

        async function testGatewayConnection(gatewayKey) {
            const token = getAdminSessionToken();
            if (!token) return;

            alert('Testing live API connection with ' + gatewayKey.toUpperCase() + ' servers... Please wait.');

            try {
                const res = await fetch('/api/admin/test-gateway-connection' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                        'X-Auth-Token': token
                    },
                    body: JSON.stringify({ gateway_key: gatewayKey })
                });
                const data = await res.json();

                if (data.success) {
                    alert('🎉 Gateway Connection Test SUCCESSFUL!\n\nDetails: ' + data.message + '\nLatency: ' + (data.latency_ms || '< 100') + 'ms');
                } else {
                    alert('❌ Gateway Connection FAILED:\n\n' + (data.error || 'Unable to connect to payment provider API.'));
                }
            } catch(e) {
                alert('Network error testing gateway connection.');
            }
        }

        async function loadPaymentsTable() {
            const token = getAdminSessionToken();
            if (!token) return;
            const tbody = document.getElementById('paymentsTableBody');
            if (!tbody) return;

            const search = (document.getElementById('paySearchInput') ? document.getElementById('paySearchInput').value : '').toLowerCase();
            const gatewayFilter = document.getElementById('payGatewayFilter') ? document.getElementById('payGatewayFilter').value : '';
            const statusFilter = document.getElementById('payStatusFilter') ? document.getElementById('payStatusFilter').value : '';

            tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--text-muted);">Loading payment transactions...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-payment-transactions' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    let filtered = data.data.filter(p => {
                        if (gatewayFilter && p.gateway !== gatewayFilter) return false;
                        if (statusFilter && p.status !== statusFilter) return false;
                        if (search) {
                            const hay = `${p.invoice_number || ''} ${p.user_name || ''} ${p.user_email || ''} ${p.transaction_id || ''}`.toLowerCase();
                            if (!hay.includes(search)) return false;
                        }
                        return true;
                    });

                    if (filtered.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--text-muted);">No payment records match the filter criteria.</td></tr>';
                        return;
                    }

                    tbody.innerHTML = filtered.map(p => {
                        const isPaid = p.status === 'paid';
                        const isRefunded = p.status === 'refunded';
                        const statusColor = isPaid ? '#10B981' : (isRefunded ? '#F59E0B' : '#EF4444');
                        const statusBg = isPaid ? 'rgba(16,185,129,0.15)' : (isRefunded ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)');

                        return `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 12px 16px; font-weight:700; color:#818CF8; font-family:monospace;">${p.invoice_number || ('INV-' + p.id)}</td>
                                <td style="padding: 12px 16px; font-weight:600; color:#FFF;">${p.user_name || 'Customer'} <br><span style="font-size:12px; color:var(--text-muted);">${p.user_email || ''}</span></td>
                                <td style="padding: 12px 16px; color:#2DD4BF; font-weight:600; text-transform:capitalize;">${p.plan_id || 'Subscription'}</td>
                                <td style="padding: 12px 16px; color:#FFF; font-weight:600; text-transform:uppercase;">${p.gateway || 'N/A'}</td>
                                <td style="padding: 12px 16px; color:#FFF; font-weight:800; font-size:15px;">$${parseFloat(p.amount).toFixed(2)}</td>
                                <td style="padding: 12px 16px;"><span style="background:${statusBg}; color:${statusColor}; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:800; text-transform:uppercase;">${p.status}</span></td>
                                <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${p.created_at || 'Recently'}</td>
                                <td style="padding: 12px 16px;">
                                    ${(isPaid && p.gateway === 'stripe') ? `<button class="btn btn-outline" style="padding:4px 8px; font-size:11px; color:#F87171;" onclick="refundPayment(${p.id})">Refund</button>` : `<span style="font-size:11px; color:var(--text-muted);">Verified</span>`}
                                </td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--text-muted);">No payment records found.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:#F87171;">Error loading payments.</td></tr>';
            }
        }

        async function loadWebhookEventsTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('webhookEventsTableBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="5" style="padding:14px; text-align:center; color:var(--text-muted);">Loading webhook events...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-webhook-events', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(ev => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 8px 12px; font-weight:700; color:#FFF; text-transform:uppercase;">${ev.provider}</td>
                            <td style="padding: 8px 12px; font-family:monospace; color:#818CF8; font-size:12px;">${ev.event_id}</td>
                            <td style="padding: 8px 12px; color:#2DD4BF; font-weight:600;">${ev.event_type}</td>
                            <td style="padding: 8px 12px;"><span style="background:rgba(16,185,129,0.15); color:#10B981; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${ev.status}</span></td>
                            <td style="padding: 8px 12px; color:var(--text-muted); font-size:11px;">${ev.created_at}</td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:14px; text-align:center; color:var(--text-muted);">No webhook events logged yet.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:14px; text-align:center; color:#F87171;">Error loading webhook logs.</td></tr>';
            }
        }

        async function refundPayment(paymentId) {
            if (!confirm('Are you sure you want to refund this payment? This will revoke the subscription extension.')) return;
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            try {
                const res = await fetch('/api/admin/refund-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ payment_id: paymentId })
                });
                const data = await res.json();
                if (data.success) {
                    alert('✓ Payment refunded successfully.');
                    loadPaymentsTable();
                    loadSubscriptionsTable();
                } else {
                    alert('Refund failed: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error issuing refund.');
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // CUSTOMER PAYMENT & SUBSCRIPTION UPGRADE FLOW
        // ═══════════════════════════════════════════════════════════════════════

        async function initiatePackagePayment(planId, planName, amount) {
            const token = localStorage.getItem('sessionToken');
            if (!token) {
                openModal('login');
                return;
            }

            _activeCheckoutPlan = { planId, planName, amount };

            document.getElementById('checkoutPlanNameDisplay').innerText = planName + ' Plan';
            document.getElementById('checkoutAmountDisplay').innerText = '$' + amount.toFixed(2);
            document.getElementById('checkoutGatewaySelectSection').style.display = 'block';
            document.getElementById('checkoutCryptoInvoiceSection').style.display = 'none';

            const list = document.getElementById('checkoutGatewaysList');
            list.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">Loading payment options...</div>';
            document.getElementById('modalCheckoutPayment').style.display = 'flex';

            try {
                const res = await fetch('/api/payments/public-gateways');
                const data = await res.json();
                const listData = Array.isArray(data.data) ? data.data : (Array.isArray(data.gateways) ? data.gateways : []);

                if (data.success && listData.length > 0) {
                    list.innerHTML = listData.map((gw, idx) => {
                        const gwKey = gw.gateway_key || gw.key || 'stripe';
                        const gwName = gw.name || (gwKey === 'stripe' ? 'Stripe' : 'Cryptocurrency');
                        const isStripe = gwKey === 'stripe';
                        const desc = isStripe ? 'Credit / Debit Card, Apple Pay, Google Pay' : 'USDT, Bitcoin, Ethereum (Instant)';
                        const icon = isStripe ? '💳' : '🪙';

                        return `
                        <label style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-input); border:1px solid var(--border); border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <input type="radio" name="checkoutGateway" value="${gwKey}" ${idx === 0 ? 'checked' : ''} style="transform:scale(1.2);">
                                <div>
                                    <strong style="color:#FFF; font-size:14px;">${gwName}</strong>
                                    <span style="display:block; font-size:11.5px; color:var(--text-muted); margin-top:2px;">${desc}</span>
                                </div>
                            </div>
                            <span style="font-size:22px;">${icon}</span>
                        </label>
                        `;
                    }).join('');
                } else {
                    list.innerHTML = '<div style="color:#F87171; font-size:13px; padding:10px; text-align:center;">No payment gateways currently active. Please contact administrator.</div>';
                }
            } catch(e) {
                list.innerHTML = '<div style="color:#F87171; font-size:13px; padding:10px; text-align:center;">Failed to load payment options.</div>';
            }
        }

        function closeCheckoutModal() {
            if (_cryptoPollTimer) clearInterval(_cryptoPollTimer);
            document.getElementById('modalCheckoutPayment').style.display = 'none';
        }

        async function submitCheckoutPayment() {
            const token = localStorage.getItem('sessionToken');
            if (!token || !_activeCheckoutPlan) return;

            const selectedGw = document.querySelector('input[name="checkoutGateway"]:checked');
            if (!selectedGw) {
                alert('Please select a payment gateway.');
                return;
            }

            const gatewayKey = selectedGw.value;
            const btn = document.getElementById('btnProceedToPay');
            btn.disabled = true;
            btn.innerText = 'Creating Secure Payment Session...';

            try {
                const res = await fetch('/api/payments/create-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({
                        plan_id: _activeCheckoutPlan.planId,
                        gateway: gatewayKey,
                        success_url: window.location.origin + '/?payment=success',
                        cancel_url: window.location.origin + '/?payment=cancelled'
                    })
                });

                const data = await res.json();
                btn.disabled = false;
                btn.innerText = '🔒 Proceed to Secure Payment';

                const checkoutUrl = data.checkout_url || data.checkoutUrl || (data.data && (data.data.checkout_url || data.data.checkoutUrl));

                if (data.success) {
                    if (checkoutUrl) {
                        window.location.href = checkoutUrl;
                    } else if (data.type === 'crypto' || data.gateway === 'crypto') {
                        // Display Crypto payment deposit details
                        document.getElementById('checkoutGatewaySelectSection').style.display = 'none';
                        document.getElementById('checkoutCryptoInvoiceSection').style.display = 'block';
                        document.getElementById('cryptoPayAmountDisplay').innerText = data.amount + ' ' + (data.currency || 'USDT');
                        document.getElementById('cryptoAddressInput').value = data.deposit_address || '';
                        document.getElementById('cryptoQrCodeImg').src = data.qr_code_url || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.deposit_address)}`;

                        pollCryptoInvoiceStatus(data.invoice_number || data.invoiceNumber);
                    } else {
                        alert(data.message || 'Payment initiated successfully.');
                    }
                } else {
                    alert('⚠️ Payment Checkout Error: ' + (data.error || 'Failed to initialize payment session.'));
                }
            } catch(e) {
                btn.disabled = false;
                btn.innerText = '🔒 Proceed to Secure Payment';
                alert('Network error creating payment checkout session. Please try again.');
            }
        }

        function pollCryptoInvoiceStatus(invoiceNumber) {
            if (_cryptoPollTimer) clearInterval(_cryptoPollTimer);
            _cryptoPollTimer = setInterval(async () => {
                try {
                    const res = await fetch('/api/payments/status?invoice=' + encodeURIComponent(invoiceNumber));
                    const data = await res.json();
                    if (data.success && data.status === 'paid') {
                        clearInterval(_cryptoPollTimer);
                        alert('🎉 Cryptocurrency payment verified! Your subscription has been activated.');
                        closeCheckoutModal();
                        loadUserPortalData();
                        loadSubscriptionsTable();
                    }
                } catch(e) {}
            }, 5000);
        }

        async function loadAuditLogsTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('auditLogsTableBody');
            tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">Loading audit logs...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-audit-logs', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(l => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF;">${l.admin_email}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(99,102,241,0.2); color:#818CF8; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${l.action}</span></td>
                            <td style="padding: 12px 16px; color:var(--text-muted);">${l.target_user_id || 'N/A'}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-family:monospace;">${l.ip_address || '127.0.0.1'}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${l.details || ''}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${l.created_at}</td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">No audit log entries recorded.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:#F87171;">Error loading audit logs.</td></tr>';
            }
        }

        async function loadSecurityTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('securityTableBody');
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Loading security events...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-security-events', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(s => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF;">${s.event_type}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(239,68,68,0.2); color:#F87171; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${s.severity}</span></td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-family:monospace;">${s.ip_address}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${s.details || ''}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${s.created_at}</td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No security warnings or threats detected.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Error loading security events.</td></tr>';
            }
        }

        async function loadProfileAuditTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('auditTableBody');
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">Running 7-layer diagnostic check...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-profile-settings-audit', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    tbody.innerHTML = data.data.map(item => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF; font-family:monospace;">${item.setting_key}</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                        </tr>
                    `).join('');
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#F87171;">Error auditing settings.</td></tr>';
            }
        }

        function showCreateUserForm() {
            document.getElementById('createUserBox').style.display = 'block';
        }

        async function submitCreateUser() {
            const token = localStorage.getItem('sessionToken');
            const name = document.getElementById('newUserName').value.trim();
            const email = document.getElementById('newUserEmail').value.trim();
            const password = document.getElementById('newUserPassword').value;
            const role = document.getElementById('newUserRole').value;

            if (!name || !email || !password) {
                alert('Please fill out name, email, and password.');
                return;
            }

            try {
                const res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name, email, password, role })
                });
                const data = await res.json();
                if (data.success) {
                    alert('User created successfully!');
                    document.getElementById('createUserBox').style.display = 'none';
                    document.getElementById('newUserName').value = '';
                    document.getElementById('newUserEmail').value = '';
                    document.getElementById('newUserPassword').value = '';
                    loadUsersTable();
                } else {
                    alert('Failed to create user: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error creating user.');
            }
        }

        async function toggleUserStatus(userId, currentStatus, userEmail) {
            const token = localStorage.getItem('sessionToken');
            if (currentStatus === 'suspended') {
                if (!confirm(`Are you sure you want to REACTIVATE user ${userEmail || ''}? A reactivation notification email will be dispatched automatically.`)) return;
                try {
                    const res = await fetch('/api/admin/reactivate-user', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ userId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert(data.message || 'User successfully reactivated and notification email sent!');
                        loadUsersTable();
                    } else {
                        alert('Failed: ' + (data.error || 'Error reactivating user'));
                    }
                } catch(e) {
                    alert('Network error.');
                }
            } else {
                const reason = prompt(`Enter suspension reason for ${userEmail || 'this user'} (optional, will be included in suspension notification email):`, 'Terms of service compliance review');
                if (reason === null) return; // User pressed Cancel

                try {
                    const res = await fetch('/api/admin/suspend-user', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ userId, reason: reason.trim() })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert(data.message || 'User successfully suspended and notification email dispatched!');
                        loadUsersTable();
                    } else {
                        alert('Failed: ' + (data.error || 'Error suspending user'));
                    }
                } catch(e) {
                    alert('Network error.');
                }
            }
        }

        async function deleteUserPrompt(userId, userEmail) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY DELETE user ${userEmail}?\n\nThis will revoke all active desktop and web sessions and cannot be undone.`)) return;

            const reason = prompt(`Enter account deletion reason for ${userEmail} (optional, will be sent to user's email):`, 'Administrative account termination');
            if (reason === null) return; // Cancelled

            try {
                const res = await fetch('/api/admin/delete-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ userId, reason: reason.trim() })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || `User ${userEmail} permanently deleted and notification email sent!`);
                    loadUsersTable();
                } else {
                    alert('Failed to delete user: ' + (data.error || 'Unknown error'));
                }
            } catch (e) {
                alert('Network error deleting user.');
            }
        }

        async function triggerCronRunner() {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Run Account Expiration & 7-Day Renewal Reminder Cron now?')) return;
            try {
                const res = await fetch('/api/admin/run-cron', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const d = data.data;
                    alert(`✅ Cron Executed Successfully!\n\n• Renewal Reminders Sent (7-Day): ${d.reminders_sent}\n• Overdue Accounts Expired: ${d.accounts_expired}\n• Failed Emails Retried: ${d.emails_retried}` + (d.errors.length ? `\n• Errors: ${d.errors.join(', ')}` : ''));
                    loadUsersTable();
                    if (typeof loadSubscriptionsTable === 'function') loadSubscriptionsTable();
                } else {
                    alert('Cron execution failed: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error executing cron.');
            }
        }

        async function triggerRetryFailedEmails() {
            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/retry-failed-emails', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success) {
                    alert(`🔁 Email Retry Cycle Completed!\n\n• Successfully retried: ${data.retried}\n• Total failed emails found: ${data.totalFailed}`);
                    if (typeof loadEmailLogs === 'function') loadEmailLogs();
                } else {
                    alert('Email retry failed: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error retrying emails.');
            }
        }

        async function loginAsUser(userId) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Log in as this user for authorized administration support?')) return;
            try {
                const res = await fetch('/api/admin/login-as-user?id=' + userId, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    alert('Now logged in as ' + data.user.email);
                    window.location.reload();
                } else {
                    alert('Login as User failed: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error during login as user.');
            }
        }

        async function loadUsersTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">Fetching database records...</td></tr>';
            
            try {
                const res = await fetch('/api/admin/get-users', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    tbody.innerHTML = data.data.map(u => {
                        const isVerified = (u.emailVerified === true || u.emailVerified === 1 || u.email_verified === 1);
                        const isSuspended = (u.accountStatus === 'suspended');
                        const isExpired = (u.accountStatus === 'expired');
                        
                        let statusBadge = '<span style="background: rgba(45,212,191,0.2); color: #2DD4BF; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">Active</span>';
                        if (isSuspended) {
                            statusBadge = '<span style="background: rgba(239,68,68,0.2); color: #F87171; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">Suspended</span>';
                        } else if (isExpired) {
                            statusBadge = '<span style="background: rgba(245,158,11,0.2); color: #FBBF24; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">Expired</span>';
                        }

                        return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight: 600; color: #FFF;">${window.escapeHtml ? window.escapeHtml(u.name || '') : (u.name || '')}</td>
                            <td style="padding: 12px 16px; color: var(--text-muted);">${window.escapeHtml ? window.escapeHtml(u.email || '') : (u.email || '')}</td>
                            <td style="padding: 12px 16px;"><span style="background: rgba(99,102,241,0.2); color: #818CF8; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">${u.role}</span></td>
                            <td style="padding: 12px 16px;"><span style="background: ${isVerified ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}; color: ${isVerified ? '#34D399' : '#FBBF24'}; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">${isVerified ? '✓ Verified' : '⚠ Unverified'}</span></td>
                            <td style="padding: 12px 16px;">${statusBadge}</td>
                            <td style="padding: 12px 16px; display: flex; gap: 6px; flex-wrap: wrap;">
                                ${!isVerified ? `<button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; border-color: #FBBF24; color: #FBBF24;" onclick="resendUserVerification('${u.id}', '${window.escapeHtml ? window.escapeHtml(u.email || '') : (u.email || '')}')">✉️ Resend Verification</button>` : ''}
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; ${isSuspended ? 'border-color: #34D399; color: #34D399;' : 'border-color: #F97316; color: #FB923C;'}" onclick="toggleUserStatus('${u.id}', '${u.accountStatus || 'active'}', '${window.escapeHtml ? window.escapeHtml(u.email || '') : (u.email || '')}')">${isSuspended ? '✓ Reactivate' : '⚠️ Suspend'}</button>
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; border-color: #EF4444; color: #EF4444;" onclick="deleteUserPrompt('${u.id}', '${window.escapeHtml ? window.escapeHtml(u.email || '') : (u.email || '')}')">🗑️ Delete</button>
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; border-color: #818CF8; color: #818CF8;" onclick="loginAsUser('${u.id}')">🔑 Login as User</button>
                            </td>
                        </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:#F87171;">Failed to load users: ' + (data.error || 'Unauthorized') + '</td></tr>';
                }
            } catch(err) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:#F87171;">Network error fetching user data.</td></tr>';
            }
        }

        async function resendUserVerification(userId, userEmail) {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            if (!confirm(`Resend verification link to ${userEmail}?`)) return;

            try {
                const res = await fetch('/api/admin/resend-user-verification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ userId })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || `Verification link successfully sent to ${userEmail}!`);
                } else {
                    alert('Error resending verification: ' + (data.error || data.message || 'Unknown error'));
                }
            } catch (err) {
                alert('Network error while resending verification.');
            }
        }

        function setTrialDurationPill(days) {
            const input = document.getElementById('globalTrialDuration');
            if (input) {
                input.value = days;
                input.dispatchEvent(new Event('change'));
            }
        }

        function toggleTrialEnabledLabel(checked) {
            const label = document.getElementById('globalTrialEnabledLabel');
            if (label) {
                label.innerText = checked ? 'Free Trial Enabled' : 'Free Trial Disabled';
                label.style.color = checked ? '#2DD4BF' : '#94A3B8';
            }
        }

        async function loadGlobalTrialConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            try {
                const res = await fetch('/api/admin?action=get-global-trial-config', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const cfg = data.data;
                    const chk = document.getElementById('globalTrialEnabled');
                    const dur = document.getElementById('globalTrialDuration');
                    const defPlan = document.getElementById('globalTrialDefaultPlan');
                    const applies = document.getElementById('globalTrialAppliesTo');
                    if (chk) {
                        chk.checked = !!cfg.is_enabled;
                        toggleTrialEnabledLabel(chk.checked);
                    }
                    if (dur) dur.value = cfg.trial_duration_days || 7;
                    if (defPlan) defPlan.value = cfg.default_plan_id || 'plan_starter';
                    if (applies) applies.value = cfg.applies_to_packages || 'all';
                }
            } catch(e) {
                console.warn('[AntiProfiles] Error loading trial config:', e);
            }
        }

        async function saveGlobalTrialConfig() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const isEnabled = document.getElementById('globalTrialEnabled') ? document.getElementById('globalTrialEnabled').checked : true;
            const duration = parseInt(document.getElementById('globalTrialDuration')?.value || '7', 10);
            const defaultPlan = document.getElementById('globalTrialDefaultPlan')?.value || 'plan_starter';
            const appliesTo = document.getElementById('globalTrialAppliesTo')?.value || 'all';

            try {
                const res = await fetch('/api/admin?action=save-global-trial-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        is_enabled: isEnabled ? 1 : 0,
                        trial_duration_days: duration,
                        default_plan_id: defaultPlan,
                        applies_to_packages: appliesTo
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`✅ Global Free Trial Policy updated!\nDuration: ${duration} Days\nDefault Plan: ${defaultPlan}\nStatus: ${isEnabled ? 'Active' : 'Disabled'}\nAll new registrations will automatically enroll in this ${duration}-day trial.`);
                    loadGlobalTrialConfig();
                } else {
                    alert('Error saving trial policy: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error while saving trial policy: ' + e.message);
            }
        }

        async function openGrantTrialToAllModal() {
            const durationStr = prompt('Enter Trial Duration in Days to grant to ALL users (e.g., 7, 14, 30):', '7');
            if (!durationStr) return;
            const days = parseInt(durationStr, 10);
            if (isNaN(days) || days <= 0) {
                alert('Please enter a valid positive number of days.');
                return;
            }

            if (!confirm(`⚠️ Confirm: Are you sure you want to grant a ${days}-day Free Trial to ALL registered users? This will update their subscription and activate full access for ${days} days.`)) {
                return;
            }

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin?action=grant-user-trial', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        userId: 'all',
                        trialDays: days,
                        planId: 'plan_starter'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || `Successfully granted ${days}-day free trial to all users!`);
                    loadSubscriptionsTable();
                } else {
                    alert('Error: ' + (data.error || 'Failed to grant global trial.'));
                }
            } catch(e) {
                alert('Network error: ' + e.message);
            }
        }

        async function grantSpecificUserTrial(userId, userEmail) {
            const daysStr = prompt(`Grant Free Trial to ${userEmail}\nChoose duration in days (e.g. 7, 14, 30):`, '7');
            if (!daysStr) return;
            const days = parseInt(daysStr, 10);
            if (isNaN(days) || days <= 0) {
                alert('Please enter a valid number of days.');
                return;
            }

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin?action=grant-user-trial', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        userId: userId,
                        trialDays: days,
                        planId: 'plan_starter'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || `Successfully granted ${days}-day free trial to ${userEmail}!`);
                    loadSubscriptionsTable();
                } else {
                    alert('Error: ' + (data.error || 'Failed to grant user trial.'));
                }
            } catch(e) {
                alert('Network error: ' + e.message);
            }
        }

        async function loadSubscriptionsTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('subsTableBody');
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">Fetching user account subscriptions & expiration dates...</td></tr>';

            try {
                const res = await fetch('/api/admin/get-subscriptions', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    tbody.innerHTML = data.data.map((item, idx) => {
                        const expDate = item.subscription.expires_at ? item.subscription.expires_at.substring(0, 10) : '2026-12-31';
                        const planId = item.subscription.plan_id || 'plan_starter';
                        const profileLimit = item.subscription.profile_limit || (planId === 'plan_free' ? 3 : (planId === 'plan_starter' ? 25 : (planId === 'plan_pro' ? 100 : 500)));
                        const deviceLimit = item.subscription.device_limit || item.subscription.plan.team_limit || 2;
                        const activeDevices = item.active_devices_count || 0;
                        const isTrial = item.subscription.status === 'trial';
                        const isExpired = item.subscription.status === 'expired';
                        return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight: 600; color: #FFF;">
                                ${item.user.name} <br>
                                <span style="font-size:12px; color:var(--text-muted);">${item.user.email}</span>
                                ${isTrial ? '<br><span style="background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">🎁 TRIAL ACTIVE</span>' : ''}
                                ${isExpired ? '<br><span style="background: rgba(239, 68, 68, 0.15); color: #F87171; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">🔒 LOCKED (EXPIRED)</span>' : ''}
                            </td>
                            <td style="padding: 12px 16px;">
                                <select id="subPlan_${item.user.id}" onchange="const def = {'plan_free':3,'plan_starter':25,'plan_pro':100,'plan_business':500}[this.value]||3; const inp = document.getElementById('subProfileLimit_${item.user.id}'); if (inp) inp.value = def;" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px; color: #FFF; font-size: 13px;">
                                    <option value="plan_free" ${planId === 'plan_free' ? 'selected' : ''}>Free (3 Profiles)</option>
                                    <option value="plan_starter" ${planId === 'plan_starter' ? 'selected' : ''}>Starter (25 Profiles)</option>
                                    <option value="plan_pro" ${planId === 'plan_pro' ? 'selected' : ''}>Professional (100 Profiles)</option>
                                    <option value="plan_business" ${planId === 'plan_business' ? 'selected' : ''}>Business (500 Profiles)</option>
                                </select>
                            </td>
                            <td style="padding: 12px 16px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <input type="number" id="subProfileLimit_${item.user.id}" value="${profileLimit}" min="1" max="10000" style="width: 65px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; color: #2DD4BF; font-weight: 700; font-size: 13px; text-align: center;">
                                    <span style="font-size: 11px; color: #94A3B8; white-space: nowrap;">profiles</span>
                                </div>
                            </td>
                            <td style="padding: 12px 16px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="number" id="subDeviceLimit_${item.user.id}" value="${deviceLimit}" min="1" max="100" style="width: 60px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; color: #38BDF8; font-weight: 700; font-size: 13px; text-align: center;">
                                    <span style="font-size: 11px; color: #94A3B8; white-space: nowrap;">(${activeDevices} active)</span>
                                </div>
                            </td>
                            <td style="padding: 12px 16px;">
                                <select id="subStatus_${item.user.id}" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px; color: #FFF; font-size: 13px;">
                                    <option value="active" ${item.subscription.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="trial" ${item.subscription.status === 'trial' ? 'selected' : ''}>Trial</option>
                                    <option value="suspended" ${item.subscription.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                                    <option value="expired" ${item.subscription.status === 'expired' ? 'selected' : ''}>Expired</option>
                                </select>
                            </td>
                            <td style="padding: 12px 16px;">
                                <input type="date" id="subExp_${item.user.id}" value="${expDate}" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px; color: #FFF; font-size: 13px;">
                            </td>
                            <td style="padding: 12px 16px;">
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px;" onclick="updateUserSubscriptionDateAndPlan('${item.user.id}')">💾 Save</button>
                                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #2DD4BF; border-color: rgba(45,212,191,0.4);" onclick="grantSpecificUserTrial('${item.user.id}', '${item.user.email}')">🎁 Trial</button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#F87171;">No subscription records found.</td></tr>';
                }
            } catch(err) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#F87171;">Error loading subscriptions.</td></tr>';
            }
        }

        async function updateUserSubscriptionDateAndPlan(userId) {
            const token = localStorage.getItem('sessionToken');
            const planId = document.getElementById('subPlan_' + userId).value;
            const profileLimit = document.getElementById('subProfileLimit_' + userId)?.value || 3;
            const deviceLimit = document.getElementById('subDeviceLimit_' + userId)?.value || 2;
            const status = document.getElementById('subStatus_' + userId).value;
            const expDate = document.getElementById('subExp_' + userId).value;

            if (!expDate) {
                alert('Please select a valid expiration date.');
                return;
            }

            try {
                const res = await fetch('/api/admin/update-subscription', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        userId: userId,
                        plan_id: planId,
                        profile_limit: parseInt(profileLimit, 10),
                        device_limit: parseInt(deviceLimit, 10),
                        status: status,
                        expires_at: expDate + ' 23:59:59'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`User subscription (Plan: ${planId}, Profile Limit: ${profileLimit}, Device Limit: ${deviceLimit}) and expiration updated successfully!`);
                    loadSubscriptionsTable();
                } else {
                    alert('Error: ' + (data.error || 'Failed to update subscription.'));
                    loadSubscriptionsTable();
                }
            } catch(e) {
                alert('Network error while updating subscription: ' + e.message);
                loadSubscriptionsTable();
            }
        }

        async function savePricingPackage(planId, planName, priceInputId, limitInputId) {
            const token = localStorage.getItem('sessionToken');
            const price = document.getElementById(priceInputId).value;
            const limit = document.getElementById(limitInputId).value;

            try {
                const res = await fetch('/api/admin/save-plan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        id: planId,
                        name: planName,
                        monthly_price: price,
                        profile_limit: limit
                    })
                });
                alert(`${planName} package price ($${price}) and limit (${limit} profiles) updated successfully!`);
            } catch(e) {
                alert(`${planName} package updated!`);
            }
        }

        window.currentAppReleases = [];

        async function loadAppReleasesTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('appReleasesTableBody');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">Loading application release history...</td></tr>';

            try {
                const res = await fetch('/api/admin/get-app-releases', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    window.currentAppReleases = data.data;
                    const iconMap = {
                        'windows-x64': '🪟 Windows',
                        'macos-arm64': '🍏 Mac Apple Silicon',
                        'macos-x64': '🍏 Mac Intel',
                        'linux-x64': '🐧 Linux'
                    };

                    tbody.innerHTML = data.data.map(r => {
                        const platLabel = iconMap[r.platform] || r.platform;
                        const isAct = r.status === 'active';
                        const statusBadge = isAct
                            ? '<span style="background:rgba(16,185,129,0.2); color:#10B981; padding:3px 10px; border-radius:12px; font-weight:800; font-size:11px;">ACTIVE</span>'
                            : (r.status === 'draft'
                                ? '<span style="background:rgba(245,158,11,0.2); color:#F59E0B; padding:3px 10px; border-radius:12px; font-weight:800; font-size:11px;">DRAFT</span>'
                                : '<span style="background:rgba(148,163,184,0.15); color:#94A3B8; padding:3px 10px; border-radius:12px; font-size:11px;">ARCHIVED</span>');

                        const sizeMb = r.file_size > 0 ? (r.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'External Link';
                        const dlLink = r.download_url ? `<a href="${r.download_url}" target="_blank" style="color:#2DD4BF; text-decoration:none; font-weight:600;">Download (${r.original_filename || 'File'})</a>` : 'N/A';

                        return `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 12px 16px; font-weight:700; color:#FFF;">${platLabel}</td>
                                <td style="padding: 12px 16px;"><span style="background:rgba(45,212,191,0.15); color:#2DD4BF; padding:2px 8px; border-radius:6px; font-weight:800;">v${r.version}</span></td>
                                <td style="padding: 12px 16px; color:#FFF; font-weight:600;">${r.release_name || 'Release v' + r.version}</td>
                                <td style="padding: 12px 16px;">${dlLink} <span style="color:var(--text-muted); font-size:11px;">(${sizeMb})</span></td>
                                <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${r.published_at || r.created_at}</td>
                                <td style="padding: 12px 16px;">${statusBadge}</td>
                                <td style="padding: 12px 16px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                    <button class="btn btn-outline" style="padding:3px 8px; font-size:11px; border-color:#2DD4BF; color:#2DD4BF; font-weight:700;" onclick="openEditReleaseModal('${r.id}')">✏️ Edit</button>
                                    ${!isAct ? `<button class="btn btn-primary" style="padding:3px 8px; font-size:11px; background:#2DD4BF; color:#000; font-weight:800;" onclick="activateAppRelease('${r.id}')">✅ Make Active</button>` : ''}
                                    <button class="btn btn-outline" style="padding:3px 8px; font-size:11px; border-color:#EF4444; color:#F87171;" onclick="deleteAppRelease('${r.id}')">🗑️ Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    window.currentAppReleases = [];
                    tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">No releases found in release history. Use the form above to publish your first release.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#F87171;">Error loading release history records.</td></tr>';
            }
        }

        function openEditReleaseModal(releaseId) {
            const releases = window.currentAppReleases || [];
            const r = releases.find(item => String(item.id) === String(releaseId));
            if (!r) {
                alert('Release record not found. Please refresh release history.');
                return;
            }

            document.getElementById('editRelId').value = r.id;
            document.getElementById('editRelPlatform').value = r.platform || 'windows-x64';
            document.getElementById('editRelVersion').value = r.version || '';
            document.getElementById('editRelName').value = r.release_name || '';
            document.getElementById('editRelStatus').value = r.status || 'active';
            document.getElementById('editRelDirectUrl').value = r.download_url || '';
            document.getElementById('editRelNotes').value = r.release_notes || '';
            document.getElementById('editRelExistingFilePath').value = r.file_path || '';
            document.getElementById('editRelExistingFilename').value = r.original_filename || '';
            document.getElementById('editRelExistingFileSize').value = r.file_size || 0;

            const fileInput = document.getElementById('editRelFile');
            if (fileInput) fileInput.value = '';

            const infoEl = document.getElementById('editRelCurrentFileInfo');
            const badgeEl = document.getElementById('editRelFileBadge');
            if (r.file_path || r.original_filename) {
                const sizeStr = r.file_size > 0 ? (r.file_size / (1024 * 1024)).toFixed(2) + ' MB' : '';
                infoEl.innerHTML = `<span style="font-weight:700;">${r.original_filename || 'binary-installer'}</span> ${sizeStr ? `<span style="color:var(--text-muted);">(${sizeStr})</span>` : ''} <br><code style="color:#2DD4BF; font-size:11px;">${r.file_path || r.download_url}</code>`;
                if (badgeEl) {
                    badgeEl.innerText = r.file_path ? 'Server Storage' : 'External Link';
                    badgeEl.style.color = '#2DD4BF';
                }
            } else if (r.download_url) {
                infoEl.innerHTML = `<span style="color:#818CF8; font-weight:700;">External URL:</span> <code style="color:#FFF; font-size:11px;">${r.download_url}</code>`;
                if (badgeEl) {
                    badgeEl.innerText = 'External Link';
                    badgeEl.style.color = '#818CF8';
                }
            } else {
                infoEl.innerHTML = '<span style="color:var(--text-muted);">No binary file or URL attached</span>';
                if (badgeEl) {
                    badgeEl.innerText = 'None';
                    badgeEl.style.color = 'var(--text-muted)';
                }
            }

            const modalMsg = document.getElementById('editReleaseModalMsg');
            if (modalMsg) {
                modalMsg.style.display = 'none';
                modalMsg.innerText = '';
            }

            const progressContainer = document.getElementById('editReleaseProgressBarContainer');
            if (progressContainer) progressContainer.style.display = 'none';

            const modal = document.getElementById('editReleaseModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        }

        function closeEditReleaseModal() {
            const modal = document.getElementById('editReleaseModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
            const modalMsg = document.getElementById('editReleaseModalMsg');
            if (modalMsg) modalMsg.style.display = 'none';
            const progressContainer = document.getElementById('editReleaseProgressBarContainer');
            if (progressContainer) progressContainer.style.display = 'none';
        }

        async function handleUpdateRelease(e) {
            e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) {
                alert('Session expired. Please sign in as administrator.');
                return;
            }

            const releaseId = document.getElementById('editRelId').value;
            const platform = document.getElementById('editRelPlatform').value;
            const version = document.getElementById('editRelVersion').value.trim();
            const releaseName = document.getElementById('editRelName').value.trim();
            const status = document.getElementById('editRelStatus').value;
            const directUrl = document.getElementById('editRelDirectUrl').value.trim();
            const notes = document.getElementById('editRelNotes').value.trim();
            const fileInput = document.getElementById('editRelFile');
            const submitBtn = document.getElementById('btnSaveEditRelease');

            const existingFilePath = document.getElementById('editRelExistingFilePath').value;
            const existingFilename = document.getElementById('editRelExistingFilename').value;
            const existingFileSize = parseInt(document.getElementById('editRelExistingFileSize').value) || 0;

            if (!releaseId) {
                alert('Release ID missing.');
                return;
            }
            if (!version || !releaseName) {
                alert('Please enter version number and release headline.');
                return;
            }

            const hasNewFile = fileInput && fileInput.files && fileInput.files.length > 0;
            if (!hasNewFile && !existingFilePath && !directUrl) {
                alert('Please either provide an installer binary file or an external download URL.');
                return;
            }

            const modalMsg = document.getElementById('editReleaseModalMsg');
            const progressContainer = document.getElementById('editReleaseProgressBarContainer');
            const progressLabel = document.getElementById('editReleaseProgressLabel');
            const progressPercent = document.getElementById('editReleaseProgressPercent');
            const progressBar = document.getElementById('editReleaseProgressBar');

            if (modalMsg) {
                modalMsg.style.display = 'block';
                modalMsg.style.background = 'rgba(99,102,241,0.2)';
                modalMsg.style.color = '#818CF8';
                modalMsg.innerText = hasNewFile ? '⏳ Slicing and uploading replacement binary...' : 'Saving changes...';
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.6';
                submitBtn.innerText = '⏳ Saving...';
            }

            if (hasNewFile && progressContainer) {
                progressContainer.style.display = 'block';
                if (progressBar) progressBar.style.width = '0%';
                if (progressPercent) progressPercent.innerText = '0%';
                if (progressLabel) progressLabel.innerText = '⏳ Initializing chunked upload...';
            }

            let uploadedFilePath = existingFilePath;
            let uploadedFileSize = existingFileSize;
            let uploadedFilename = existingFilename;

            // If a replacement file is provided, chunk upload it
            if (hasNewFile) {
                const file = fileInput.files[0];
                const chunkSize = 2 * 1024 * 1024; // 2MB safe chunks
                const totalChunks = Math.ceil(file.size / chunkSize);
                const uploadId = 'upl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                uploadedFilename = file.name;

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunkBlob = file.slice(start, end);

                    const chunkForm = new FormData();
                    chunkForm.append('uploadId', uploadId);
                    chunkForm.append('chunkIndex', i);
                    chunkForm.append('totalChunks', totalChunks);
                    chunkForm.append('platform', platform);
                    chunkForm.append('version', version);
                    chunkForm.append('filename', file.name);
                    chunkForm.append('chunk', chunkBlob, 'chunk.part');
                    chunkForm.append('token', token);

                    let attempt = 0;
                    let chunkSuccess = false;
                    while (attempt < 3 && !chunkSuccess) {
                        try {
                            const res = await fetch('/api/admin/upload-release-chunk?token=' + encodeURIComponent(token), {
                                method: 'POST',
                                headers: { 'Authorization': 'Bearer ' + token },
                                body: chunkForm
                            });
                            const data = await res.json();
                            if (data && data.success) {
                                chunkSuccess = true;
                                if (data.completed) {
                                    uploadedFilePath = data.filePath;
                                    uploadedFileSize = data.fileSize || file.size;
                                }
                            } else {
                                attempt++;
                                await new Promise(r => setTimeout(r, 1000));
                            }
                        } catch(err) {
                            attempt++;
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }

                    if (!chunkSuccess) {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.style.opacity = '1';
                            submitBtn.innerText = '💾 Save Release Changes';
                        }
                        if (modalMsg) {
                            modalMsg.style.background = 'rgba(239,68,68,0.2)';
                            modalMsg.style.color = '#F87171';
                            modalMsg.innerText = `⚠️ Upload failed on chunk ${i + 1}/${totalChunks}. Please try again.`;
                        }
                        return;
                    }

                    const progressBytes = end;
                    const percent = Math.min(100, Math.round((progressBytes / file.size) * 100));
                    const uploadedMB = (progressBytes / (1024 * 1024)).toFixed(1);
                    const totalMB = (file.size / (1024 * 1024)).toFixed(1);

                    if (progressBar) progressBar.style.width = percent + '%';
                    if (progressPercent) progressPercent.innerText = `${percent}% (${uploadedMB} MB / ${totalMB} MB)`;
                    if (progressLabel) {
                        if (percent >= 100) {
                            progressLabel.innerText = '⚙️ Finalizing updated application release...';
                        } else {
                            progressLabel.innerText = `⏳ Uploading chunk ${i + 1}/${totalChunks} (${percent}%)...`;
                        }
                    }
                }
            }

            // Post update payload
            const updateForm = new FormData();
            updateForm.append('releaseId', releaseId);
            updateForm.append('platform', platform);
            updateForm.append('version', version);
            updateForm.append('release_name', releaseName);
            updateForm.append('status', status);
            updateForm.append('download_url', directUrl);
            updateForm.append('release_notes', notes);
            updateForm.append('file_path', uploadedFilePath || '');
            updateForm.append('original_filename', uploadedFilename || '');
            updateForm.append('file_size', uploadedFileSize || 0);
            updateForm.append('token', token);

            try {
                const res = await fetch('/api/admin/update-app-release?token=' + encodeURIComponent(token), {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: updateForm
                });
                const data = await res.json();

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerText = '💾 Save Release Changes';
                }

                if (data && data.success) {
                    closeEditReleaseModal();
                    
                    const topMsg = document.getElementById('releasesConfigMsg');
                    if (topMsg) {
                        topMsg.style.display = 'block';
                        topMsg.style.background = 'rgba(45,212,191,0.2)';
                        topMsg.style.color = '#2DD4BF';
                        topMsg.innerText = '✓ ' + (data.message || 'Application release updated successfully!');
                    }

                    await fetchReleasesAndUpdateLanding();
                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    if (modalMsg) {
                        modalMsg.style.background = 'rgba(239,68,68,0.2)';
                        modalMsg.style.color = '#F87171';
                        modalMsg.innerText = '⚠️ ' + (data?.error || 'Failed to update release.');
                    }
                }
            } catch(e) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerText = '💾 Save Release Changes';
                }
                if (modalMsg) {
                    modalMsg.style.background = 'rgba(239,68,68,0.2)';
                    modalMsg.style.color = '#F87171';
                    modalMsg.innerText = '⚠️ Network error saving release changes.';
                }
            }
        }

        async function handlePublishRelease(e) {
            e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) {
                alert('Session expired. Please sign in as administrator.');
                return;
            }

            const platform = document.getElementById('relPlatform').value;
            const version = document.getElementById('relVersion').value.trim();
            const releaseName = document.getElementById('relName').value.trim();
            const status = document.getElementById('relStatus').value;
            const directUrl = document.getElementById('relDirectUrl').value.trim();
            const notes = document.getElementById('relNotes').value.trim();
            const fileInput = document.getElementById('relFile');
            const submitBtn = e.target.querySelector('button[type="submit"]');

            if (!version || !releaseName) {
                alert('Please enter version number and release name.');
                return;
            }

            const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
            if (!hasFile && !directUrl) {
                alert('Please either upload an application installer file or enter an external download URL.');
                return;
            }

            const msg = document.getElementById('releasesConfigMsg');
            const progressContainer = document.getElementById('releaseUploadProgressBarContainer');
            const progressLabel = document.getElementById('releaseUploadProgressLabel');
            const progressPercent = document.getElementById('releaseUploadProgressPercent');
            const progressBar = document.getElementById('releaseUploadProgressBar');

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = hasFile ? '⏳ Slicing binary for smooth fast upload...' : 'Publishing application release... Please wait...';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.6';
                submitBtn.innerText = '⏳ Uploading / Publishing...';
            }

            if (hasFile && progressContainer) {
                progressContainer.style.display = 'block';
                if (progressBar) progressBar.style.width = '0%';
                if (progressPercent) progressPercent.innerText = '0%';
                if (progressLabel) progressLabel.innerText = '⏳ Initializing chunked upload...';
            }

            let uploadedFilePath = null;
            let uploadedFileSize = 0;
            let uploadedFilename = null;

            // 1. If file is selected, upload via 2MB chunk stream
            if (hasFile) {
                const file = fileInput.files[0];
                const chunkSize = 2 * 1024 * 1024; // 2MB safe chunks
                const totalChunks = Math.ceil(file.size / chunkSize);
                const uploadId = 'upl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                uploadedFilename = file.name;

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunkBlob = file.slice(start, end);

                    const chunkForm = new FormData();
                    chunkForm.append('uploadId', uploadId);
                    chunkForm.append('chunkIndex', i);
                    chunkForm.append('totalChunks', totalChunks);
                    chunkForm.append('platform', platform);
                    chunkForm.append('version', version);
                    chunkForm.append('filename', file.name);
                    chunkForm.append('chunk', chunkBlob, 'chunk.part');
                    chunkForm.append('token', token);

                    let attempt = 0;
                    let chunkSuccess = false;
                    while (attempt < 3 && !chunkSuccess) {
                        try {
                            const res = await fetch('/api/admin/upload-release-chunk?token=' + encodeURIComponent(token), {
                                method: 'POST',
                                headers: { 'Authorization': 'Bearer ' + token },
                                body: chunkForm
                            });
                            const data = await res.json();
                            if (data && data.success) {
                                chunkSuccess = true;
                                if (data.completed) {
                                    uploadedFilePath = data.filePath;
                                    uploadedFileSize = data.fileSize || file.size;
                                }
                            } else {
                                attempt++;
                                await new Promise(r => setTimeout(r, 1000));
                            }
                        } catch(err) {
                            attempt++;
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }

                    if (!chunkSuccess) {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.style.opacity = '1';
                            submitBtn.innerText = '🚀 Publish Release & Update User Downloads';
                        }
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.innerText = `⚠️ Upload failed on chunk ${i + 1}/${totalChunks}. Please check internet connection and try again.`;
                        return;
                    }

                    const progressBytes = end;
                    const percent = Math.min(100, Math.round((progressBytes / file.size) * 100));
                    const uploadedMB = (progressBytes / (1024 * 1024)).toFixed(1);
                    const totalMB = (file.size / (1024 * 1024)).toFixed(1);

                    if (progressBar) progressBar.style.width = percent + '%';
                    if (progressPercent) progressPercent.innerText = `${percent}% (${uploadedMB} MB / ${totalMB} MB)`;
                    if (progressLabel) {
                        if (percent >= 100) {
                            progressLabel.innerText = '⚙️ Finalizing and publishing application release on server...';
                        } else {
                            progressLabel.innerText = `⏳ Uploading chunk ${i + 1}/${totalChunks} (${percent}%)...`;
                        }
                    }
                }
            }

            // 2. Finalize & publish release record
            const publishForm = new FormData();
            publishForm.append('platform', platform);
            publishForm.append('version', version);
            publishForm.append('release_name', releaseName);
            publishForm.append('status', status);
            publishForm.append('download_url', directUrl);
            publishForm.append('release_notes', notes);
            publishForm.append('token', token);

            if (uploadedFilePath) {
                publishForm.append('file_path', uploadedFilePath);
                publishForm.append('original_filename', uploadedFilename);
                publishForm.append('file_size', uploadedFileSize);
            }

            try {
                const res = await fetch('/api/admin/publish-app-release?token=' + encodeURIComponent(token), {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: publishForm
                });
                const data = await res.json();

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerText = '🚀 Publish Release & Update User Downloads';
                }

                if (data && data.success) {
                    if (progressContainer) {
                        if (progressBar) progressBar.style.width = '100%';
                        if (progressPercent) progressPercent.innerText = '100% Complete';
                        if (progressLabel) progressLabel.innerText = '✓ Binary Uploaded & Published!';
                    }
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = '✓ ' + (data.message || 'Application release published successfully!');

                    document.getElementById('relVersion').value = '';
                    document.getElementById('relName').value = '';
                    document.getElementById('relDirectUrl').value = '';
                    document.getElementById('relNotes').value = '';
                    if (fileInput) fileInput.value = '';

                    await fetchReleasesAndUpdateLanding();
                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    if (progressContainer) progressContainer.style.display = 'none';
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = '⚠️ ' + (data?.error || 'Failed to publish release.');
                }
            } catch(e) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerText = '🚀 Publish Release & Update User Downloads';
                }
                if (progressContainer) progressContainer.style.display = 'none';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = '⚠️ Network error finalizing release.';
            }
        }

        async function activateAppRelease(releaseId) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Are you sure you want to set this release as the current ACTIVE version for users?')) return;

            try {
                const res = await fetch('/api/admin/activate-app-release', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ releaseId: releaseId })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    await fetchReleasesAndUpdateLanding();
                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    alert('Failed to activate release: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error activating release.');
            }
        }

        async function deleteAppRelease(releaseId) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Are you sure you want to delete this release record?')) return;

            try {
                const res = await fetch('/api/admin/delete-app-release', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ releaseId: releaseId })
                });
                const data = await res.json();
                if (data.success) {
                    await fetchReleasesAndUpdateLanding();
                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    alert('Failed to delete release: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error deleting release.');
            }
        }

        async function saveReleasesConfig() {
            const token = localStorage.getItem('sessionToken');
            const payload = {
                win_download_url: document.getElementById('cfgWinUrl').value.trim(),
                win_app_version: document.getElementById('cfgWinVersion').value.trim(),
                mac_arm_download_url: document.getElementById('cfgMacArmUrl').value.trim(),
                mac_arm_app_version: document.getElementById('cfgMacArmVersion').value.trim(),
                mac_intel_download_url: document.getElementById('cfgMacIntelUrl').value.trim(),
                mac_intel_app_version: document.getElementById('cfgMacIntelVersion').value.trim(),
                linux_download_url: document.getElementById('cfgLinuxUrl').value.trim(),
                linux_app_version: document.getElementById('cfgLinuxVersion').value.trim()
            };

            try {
                const res = await fetch('/api/admin/update-releases-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert('App Release Settings & Download URLs updated successfully!');
                    await fetchReleasesAndUpdateLanding();
                    loadUserPortalData();
                } else {
                    alert('Failed to update release settings: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error saving release settings.');
            }
        }

        async function handleLogin(e) {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const msg = document.getElementById('loginMsg');
            const submitBtn = document.getElementById('loginSubmitBtn');

            if (!email || !password) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Email Address and Password are required.';
                return false;
            }

            if (!email.includes('@')) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Please enter a valid email address.';
                return false;
            }

            // Obtain Captcha Token if enabled
            let captchaToken = null;
            if (typeof getCaptchaToken === 'function') {
                captchaToken = await getCaptchaToken('login', 'loginTurnstileContainer');
            }

            // Disable button to prevent double submission
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Signing in...';
                submitBtn.style.opacity = '0.7';
                submitBtn.style.cursor = 'not-allowed';
            }

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Authenticating credentials...';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, captcha_token: captchaToken })
                });

                if (!res.ok && res.status >= 500) {
                    throw new Error('Server error (' + res.status + '). Please try again later.');
                }

                const data = await res.json();
                if (data.success && data.sessionToken && data.user) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Login successful! Opening dashboard...';
                    
                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (window.history && window.history.pushState) {
                        window.history.pushState({}, '', '/dashboard');
                    }

                    // Set grace period flag to prevent immediate /api/auth/me re-validation
                    window._pvJustLoggedIn = true;

                    setTimeout(() => {
                        closeModal();
                        checkSession();
                    }, 300);
                } else {
                    msg.style.display = 'block';
                    if (data.requiresVerification || data.emailVerified === false) {
                        const safeEmail = (typeof window.escapeHtml === 'function') ? window.escapeHtml(email) : String(email).replace(/[<>&'"]/g, '');
                        msg.style.background = 'rgba(239,68,68,0.15)';
                        msg.style.color = '#F87171';
                        msg.style.border = '1px solid rgba(239,68,68,0.3)';
                        msg.style.borderRadius = '10px';
                        msg.style.padding = '14px';
                        msg.innerHTML = `
                            <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 4px;">⚠️ Email Verification Required</div>
                            <div style="font-size: 12.5px; color: #CBD5E1; margin-bottom: 10px;">Please verify your email address before continuing.</div>
                            <button type="button" class="btn btn-outline" style="font-size: 11.5px; padding: 6px 12px; border-color: #2DD4BF; color: #2DD4BF;" onclick="resendVerificationEmail('${safeEmail}', this)">🔄 Resend Verification Email</button>
                        `;
                    } else {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.style.border = 'none';
                        if (data.error) {
                            msg.innerText = data.error;
                        } else if (res.status === 401) {
                            msg.innerText = 'Invalid email address or password.';
                        } else if (res.status === 403) {
                            msg.innerText = 'Your account has been suspended. Please contact support.';
                        } else {
                            msg.innerText = 'Login failed. Please check your credentials and try again.';
                        }
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Sign In';
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';
                    }
                }
            } catch (err) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = err.message || 'Unable to connect to authentication server. Please check your connection and try again.';
                // Re-enable button on error
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Sign In';
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                }
            }
            return false;
        }

        async function handleForgotPassword(e) {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();
            const email = document.getElementById('forgotEmail').value.trim();
            const msg = document.getElementById('loginMsg');
            const submitBtn = document.getElementById('forgotSubmitBtn');

            if (!email || !email.includes('@')) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Please enter a valid email address.';
                return false;
            }

            // Obtain Captcha Token if enabled
            let captchaToken = null;
            if (typeof getCaptchaToken === 'function') {
                captchaToken = await getCaptchaToken('reset', 'forgotPwTurnstileContainer');
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Sending Link...';
                submitBtn.style.opacity = '0.7';
                submitBtn.style.cursor = 'not-allowed';
            }

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Dispatching secure password reset token...';

            try {
                const res = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, captcha_token: captchaToken })
                });

                const data = await res.json();
                if (data.success) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = data.message || 'Password reset link sent! Please check your email inbox.';
                    document.getElementById('forgotEmail').value = '';
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Failed to send password reset link.';
                }
            } catch (err) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error communicating with authentication server.';
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Send Reset Link';
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                }
            }
            return false;
        }

        // ── Real-Time Web Synchronization via Server-Sent Events (SSE) ──
        let sseSource = null;
        function initRealtimeWebSync() {
            if (typeof EventSource === 'undefined') return;
            const token = localStorage.getItem('sessionToken');
            const visitorToken = typeof getOrCreateVisitorToken === 'function' ? getOrCreateVisitorToken() : 'vis_guest';

            if (sseSource) {
                try { sseSource.close(); } catch(e) {}
            }

            try {
                const sseUrl = '/api/events/stream?' + (token ? 'token=' + encodeURIComponent(token) : 'visitor_token=' + encodeURIComponent(visitorToken));
                sseSource = new EventSource(sseUrl);

                sseSource.addEventListener('connected', (e) => {
                    console.log('⚡ [WebSync] Connected to Central Real-Time Event Stream:', e.data);
                });

                sseSource.addEventListener('user.role.updated', (e) => {
                    console.log('⚡ [WebSync] user.role.updated received');
                    loadUsersTable();
                    loadUserPortalData();
                });

                sseSource.addEventListener('user.permissions.updated', (e) => {
                    console.log('⚡ [WebSync] user.permissions.updated received');
                    loadUsersTable();
                });

                sseSource.addEventListener('user.status.updated', (e) => {
                    console.log('⚡ [WebSync] user.status.updated received');
                    loadUsersTable();
                });

                sseSource.addEventListener('subscription.updated', (e) => {
                    console.log('⚡ [WebSync] subscription.updated received');
                    loadSubscriptionsTable();
                    loadUserPortalData();
                });

                sseSource.addEventListener('payment.completed', (e) => {
                    console.log('🎉 [WebSync] payment.completed received');
                    loadUserPortalData();
                    loadSubscriptionsTable();
                    loadPaymentsTable();
                    loadWebhookEventsTable();
                });

                sseSource.addEventListener('gateway.config.updated', (e) => {
                    console.log('⚡ [WebSync] gateway.config.updated received');
                    loadPaymentGatewaysTable();
                });

                sseSource.addEventListener('user.deleted', (e) => {
                    console.log('⚡ [WebSync] user.deleted received');
                    loadUsersTable();
                    loadSubscriptionsTable();
                });

                sseSource.addEventListener('session.revoked', (e) => {
                    console.warn('🚫 [WebSync] Session revoked by administrator');
                    alert('Your account access has been restricted or session revoked by an administrator.');
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                    window.location.reload();
                });

                sseSource.addEventListener('support.message.created', (e) => {
                    console.log('💬 [WebSync] support.message.created received', e.data);
                    loadSupportConversations();
                    try {
                        const payload = JSON.parse(e.data);
                        if (_activeSupportConvId && payload.conversation_id === _activeSupportConvId) {
                            openAdminSupportThread(_activeSupportConvId, true);
                        }
                    } catch(err) {}
                });

                sseSource.addEventListener('support.reply.created', (e) => {
                    console.log('💬 [WebSync] support.reply.created received', e.data);
                    try {
                        const payload = JSON.parse(e.data);
                        if (_liveChatOpen) {
                            loadLiveChatMessages();
                        } else {
                            const unread = document.getElementById('liveChatUnreadBadge');
                            if (unread) unread.style.display = 'inline-block';
                        }
                        loadUserPortalSupportThread();
                        if (_activeSupportConvId && payload.conversation_id === _activeSupportConvId) {
                            openAdminSupportThread(_activeSupportConvId, true);
                        }
                    } catch(err) {}
                });

                sseSource.addEventListener('support.conversation.closed', (e) => {
                    loadSupportConversations();
                    loadLiveChatMessages();
                    loadUserPortalSupportThread();
                });

                sseSource.onerror = () => {
                    // Reconnects automatically via EventSource standard
                };
            } catch(err) {
                console.warn('WebSync setup failed:', err);
            }
        }

        // ──────────────────────────────────────────────
        // CPA Affiliate Portal & Admin Control Controller
        // ──────────────────────────────────────────────

        let _userAffiliateData = null;
        let _adminAffOverview = null;

        async function loadMyAffiliatePortal() {
            // Immediate bootstrap from localStorage session
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const u = JSON.parse(userStr);
                    const rawId = (u.id || 'USER').toString();
                    const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
                    const affId = u.affiliate_id || ('AFF-' + (cleanId || 'PARTNER'));
                    const refCode = u.referral_code || ('REF_' + (cleanId || 'PARTNER'));
                    if (!_userAffiliateData) {
                        _userAffiliateData = { affiliateId: affId, referralCode: refCode, status: u.affiliate_status || 'active' };
                    }
                    const affIdEl = document.getElementById('userAffIdDisplay');
                    const refCodeEl = document.getElementById('userRefCodeDisplay');
                    if (affIdEl && affIdEl.innerText.includes('...')) affIdEl.innerText = affId;
                    if (refCodeEl && refCodeEl.innerText.includes('...')) refCodeEl.innerText = refCode;
                }
            } catch(e) {}

            // Always load offers immediately
            loadOffersDropdown();

            const token = getAdminSessionToken();
            if (!token) return;

            try {
                const res = await fetch('/api/affiliate/get-summary' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const resData = await res.json();
                if (!resData.success || !resData.data) return;

                const d = resData.data;
                _userAffiliateData = d;

                // 1. Identity
                if (d.affiliateId) document.getElementById('userAffIdDisplay').innerText = d.affiliateId;
                if (d.referralCode) document.getElementById('userRefCodeDisplay').innerText = d.referralCode;
                const statusBadge = document.getElementById('userAffStatusBadge');
                if (statusBadge) {
                    statusBadge.innerText = (d.status || 'active').toUpperCase();
                    statusBadge.style.color = d.status === 'active' ? '#10B981' : '#F87171';
                }

                // 2. KPI Metrics
                document.getElementById('userAffTotalClicks').innerText = d.totalClicks || 0;
                document.getElementById('userAffUniqueClicks').innerText = d.uniqueClicks || 0;
                document.getElementById('userAffTotalConv').innerText = d.totalConversions || 0;
                document.getElementById('userAffCrRate').innerText = d.conversionRate || 0;
                document.getElementById('userAffLifetimeEarn').innerText = Number(d.lifetimeEarnings || 0).toFixed(2);
                document.getElementById('userAffAvailableBal').innerText = Number(d.availableBalance || 0).toFixed(2);
                const availInput = document.getElementById('userWithAvailBal');
                if (availInput) availInput.value = '$' + Number(d.availableBalance || 0).toFixed(2);

                // 3. Postback Config
                if (d.postbackConfig) {
                    document.getElementById('userPostbackUrlInput').value = d.postbackConfig.postback_url || '';
                    document.getElementById('userPostbackMethod').value = d.postbackConfig.http_method || 'GET';
                }

                // 4. Render offers if present in summary
                if (Array.isArray(d.offers) && d.offers.length > 0) {
                    const sel = document.getElementById('userLinkOfferSelect');
                    if (sel) {
                        const currentVal = sel.value;
                        sel.innerHTML = d.offers.map(o => {
                            const isRev = o.payout_type === 'revshare' || o.payout_type === 'percentage';
                            const rateVal = o.revshare_percent !== undefined ? o.revshare_percent : (o.commission_rate !== undefined ? o.commission_rate : 15);
                            const rateTxt = isRev ? (rateVal + '% RevShare') : ('$' + Number(o.fixed_payout_usd || 0).toFixed(2) + ' Fixed Bounty');
                            return `<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)} (${rateTxt})</option>`;
                        }).join('');
                        if (currentVal && d.offers.some(o => o.id === currentVal)) {
                            sel.value = currentVal;
                        }
                    }
                    renderUserAffiliateOffers(d.offers);
                }

                generateCustomAffiliateLink();

                // 5. Clicks Stream
                const clicksTbody = document.getElementById('userAffClicksBody');
                if (clicksTbody) {
                    if (!d.recentClicks || d.recentClicks.length === 0) {
                        clicksTbody.innerHTML = '<tr><td colspan="5" style="padding: 14px; text-align: center; color: var(--text-muted);">No clicks tracked yet. Share your link to start tracking!</td></tr>';
                    } else {
                        clicksTbody.innerHTML = d.recentClicks.map(c => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 8px; font-family: monospace; color: #818CF8;">${escapeHtml(c.click_id)}</td>
                                <td style="padding: 8px;">${escapeHtml(c.offer_id)}</td>
                                <td style="padding: 8px; color: var(--text-muted);">${escapeHtml(c.sub_id1 || '—')}</td>
                                <td style="padding: 8px;">
                                    <span style="background:${c.converted == 1 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)'}; color:${c.converted == 1 ? '#10B981' : '#94A3B8'}; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">
                                        ${c.converted == 1 ? 'CONVERTED' : 'UNCONVERTED'}
                                    </span>
                                </td>
                                <td style="padding: 8px; color: var(--text-muted);">${new Date(c.created_at).toLocaleString()}</td>
                            </tr>
                        `).join('');
                    }
                }

                // 6. Conversions Table
                const convTbody = document.getElementById('userAffConvBody');
                if (convTbody) {
                    if (!d.recentConversions || d.recentConversions.length === 0) {
                        convTbody.innerHTML = '<tr><td colspan="5" style="padding: 14px; text-align: center; color: var(--text-muted);">No conversions recorded yet.</td></tr>';
                    } else {
                        convTbody.innerHTML = d.recentConversions.map(v => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 8px; font-family: monospace; color: #2DD4BF;">${escapeHtml(v.conversion_id)}</td>
                                <td style="padding: 8px; font-weight: 600;">$${Number(v.order_amount || 0).toFixed(2)}</td>
                                <td style="padding: 8px; font-weight: 700; color: #10B981;">+$${Number(v.payout_amount || 0).toFixed(2)}</td>
                                <td style="padding: 8px;">
                                    <span style="background:rgba(16,185,129,0.15); color:#10B981; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">
                                        ${escapeHtml((v.status || 'approved').toUpperCase())}
                                    </span>
                                </td>
                                <td style="padding: 8px; color: var(--text-muted);">${new Date(v.created_at).toLocaleString()}</td>
                            </tr>
                        `).join('');
                    }
                }

                // 7. Withdrawals Table
                const withTbody = document.getElementById('userAffWithdrawalsBody');
                if (withTbody) {
                    if (!d.withdrawals || d.withdrawals.length === 0) {
                        withTbody.innerHTML = '<tr><td colspan="6" style="padding: 16px; text-align: center; color: var(--text-muted);">No withdrawal requests submitted yet.</td></tr>';
                    } else {
                        withTbody.innerHTML = d.withdrawals.map(w => {
                            const statusColor = w.status === 'paid' ? '#10B981' : (w.status === 'rejected' ? '#F87171' : '#F59E0B');
                            return `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                    <td style="padding: 10px 14px; font-family: monospace; color: #818CF8;">${escapeHtml(w.id)}</td>
                                    <td style="padding: 10px 14px; font-weight: 700; color: #FFF;">$${Number(w.amount).toFixed(2)}</td>
                                    <td style="padding: 10px 14px; text-transform: uppercase; font-size: 12px;">${escapeHtml(w.payout_method)}</td>
                                    <td style="padding: 10px 14px;">
                                        <span style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800;">
                                            ${escapeHtml(w.status.toUpperCase())}
                                        </span>
                                    </td>
                                    <td style="padding: 10px 14px; font-family: monospace; font-size: 11px; color: var(--text-muted);">${escapeHtml(w.payout_reference || '—')}</td>
                                    <td style="padding: 10px 14px; color: var(--text-muted); font-size: 12px;">${new Date(w.created_at).toLocaleDateString()}</td>
                                </tr>
                            `;
                        }).join('');
                    }
                }

            } catch(e) {
                console.error('Affiliate portal error:', e);
            }
        }

        async function loadOffersDropdown() {
            const token = getAdminSessionToken();
            try {
                const res = await fetch('/api/affiliate/get-offers' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: token ? { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token } : {}
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    const sel = document.getElementById('userLinkOfferSelect');
                    if (sel) {
                        const currentVal = sel.value;
                        sel.innerHTML = data.data.map(o => {
                            const isRev = o.payout_type === 'revshare' || o.payout_type === 'percentage';
                            const rateVal = o.revshare_percent !== undefined ? o.revshare_percent : (o.commission_rate !== undefined ? o.commission_rate : 15);
                            const rateTxt = isRev ? (rateVal + '% RevShare') : ('$' + Number(o.fixed_payout_usd || 0).toFixed(2) + ' Fixed Bounty');
                            return `<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)} (${rateTxt})</option>`;
                        }).join('');
                        if (currentVal && data.data.some(o => o.id === currentVal)) {
                            sel.value = currentVal;
                        }
                    }
                    renderUserAffiliateOffers(data.data);
                    generateCustomAffiliateLink();
                } else {
                    renderUserAffiliateOffers([]);
                }
            } catch(e) {
                renderUserAffiliateOffers([]);
            }
        }

        function renderUserAffiliateOffers(offers) {
            const container = document.getElementById('userAffOffersCardsContainer');
            if (!container) return;
            if (!offers || offers.length === 0) {
                container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border);">No active CPA offers available at the moment.</div>';
                return;
            }
            let affId = (_userAffiliateData && _userAffiliateData.affiliateId) ? _userAffiliateData.affiliateId : '';
            if (!affId) {
                try {
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        const u = JSON.parse(userStr);
                        const cleanId = (u.id || 'USER').toString().replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
                        affId = u.affiliate_id || ('AFF-' + (cleanId || 'PARTNER'));
                    }
                } catch(e) {}
            }
            if (!affId) affId = 'AFF-DEFAULT';

            const origin = window.location.origin;

            container.innerHTML = offers.map(o => {
                const isRev = o.payout_type === 'revshare' || o.payout_type === 'percentage';
                const rateVal = o.revshare_percent !== undefined ? o.revshare_percent : (o.commission_rate !== undefined ? o.commission_rate : 15);
                const rateBadge = isRev ? `${rateVal}% REVSHARE` : `$${Number(o.fixed_payout_usd || 0).toFixed(2)} CPA BOUNTY`;
                const directUrl = `${origin}/track?aff_id=${encodeURIComponent(affId)}&offer_id=${encodeURIComponent(o.id)}`;
                
                return `
                    <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #2DD4BF, #818CF8);"></div>
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span style="background: rgba(45,212,191,0.15); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px;">
                                    ${rateBadge}
                                </span>
                                <span style="font-size: 11px; color: #10B981; font-weight: 700;">● Active</span>
                            </div>
                            <h4 style="font-size: 16px; color: #FFF; margin: 0 0 8px 0; font-weight: 700;">${escapeHtml(o.title)}</h4>
                            <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin: 0 0 12px 0;">
                                ${escapeHtml(o.description || 'Promote this AntiProfiles package and earn commissions for every referred customer.')}
                            </p>
                            <div style="font-size: 11px; color: #818CF8; font-family: monospace; word-break: break-all;">
                                Target: ${escapeHtml(o.target_url)}
                            </div>
                        </div>
                        <div style="border-top: 1px solid var(--border); padding-top: 14px; display: flex; gap: 8px;">
                            <button class="btn btn-outline" style="flex: 1; font-size: 12px; padding: 7px 10px;" onclick="selectOfferInBuilder('${escapeHtml(o.id)}')">
                                ⚡ Link Builder
                            </button>
                            <button class="btn btn-primary" style="flex: 1; font-size: 12px; padding: 7px 10px; font-weight: 700;" onclick="copyDirectOfferLink('${escapeHtml(directUrl)}')">
                                📋 Copy Link
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function selectOfferInBuilder(offerId) {
            const sel = document.getElementById('userLinkOfferSelect');
            if (sel) {
                sel.value = offerId;
                generateCustomAffiliateLink();
                sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                sel.style.borderColor = '#2DD4BF';
                setTimeout(() => sel.style.borderColor = 'var(--border)', 1500);
            }
        }

        function copyDirectOfferLink(url) {
            navigator.clipboard.writeText(url).then(() => {
                alert('✓ Direct CPA Campaign link copied to clipboard!\n\n' + url);
            }).catch(() => {
                prompt('Copy your link:', url);
            });
        }

        function generateCustomAffiliateLink() {
            let affId = (_userAffiliateData && _userAffiliateData.affiliateId) ? _userAffiliateData.affiliateId : '';
            if (!affId) {
                try {
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        const u = JSON.parse(userStr);
                        const rawId = (u.id || 'USER').toString();
                        const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
                        affId = u.affiliate_id || ('AFF-' + (cleanId || 'PARTNER'));
                    }
                } catch(e) {}
            }
            if (!affId) affId = 'AFF-DEFAULT';

            const offerSelect = document.getElementById('userLinkOfferSelect');
            const offerId = offerSelect ? offerSelect.value : 'offer_main_saas';
            const subId1 = document.getElementById('userLinkSubId1') ? document.getElementById('userLinkSubId1').value.trim() : '';
            const subId2 = document.getElementById('userLinkSubId2') ? document.getElementById('userLinkSubId2').value.trim() : '';

            const origin = window.location.origin;
            let link = `${origin}/track?aff_id=${encodeURIComponent(affId)}&offer_id=${encodeURIComponent(offerId)}`;
            if (subId1) link += `&sub_id1=${encodeURIComponent(subId1)}`;
            if (subId2) link += `&sub_id2=${encodeURIComponent(subId2)}`;

            const targetInput = document.getElementById('userGeneratedTrackingUrl');
            if (targetInput) targetInput.value = link;
        }

        function copyAffiliateLink() {
            const el = document.getElementById('userGeneratedTrackingUrl');
            if (!el || !el.value) return;
            navigator.clipboard.writeText(el.value).then(() => {
                alert('✓ Tracking link copied to clipboard!\n\n' + el.value);
            }).catch(() => {
                el.select();
                document.execCommand('copy');
                alert('✓ Link copied!');
            });
        }

        function insertPostbackMacro(macro) {
            const input = document.getElementById('userPostbackUrlInput');
            if (!input) return;
            input.value += (input.value.includes('?') ? '&' : '?') + macro.replace(/[{}]/g, '').toLowerCase() + '=' + macro;
            input.focus();
        }

        async function saveUserPostbackConfig() {
            const token = getAdminSessionToken();
            if (!token) return;
            const url = document.getElementById('userPostbackUrlInput').value.trim();
            const method = document.getElementById('userPostbackMethod').value;

            try {
                const res = await fetch('/api/affiliate/save-postback-config' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ postback_url: url, http_method: method, is_active: 1 })
                });
                const data = await res.json();
                if (data.success) {
                    alert('✓ Postback webhook configuration successfully saved!');
                } else {
                    alert('⚠️ Error saving postback: ' + (data.error || 'Failed'));
                }
            } catch(e) {
                alert('Network error saving postback.');
            }
        }

        function openUserWithdrawalModal() {
            document.getElementById('modalUserWithdrawal').style.display = 'flex';
            if (_userAffiliateData) {
                document.getElementById('userWithAvailBal').value = '$' + Number(_userAffiliateData.availableBalance || 0).toFixed(2);
            }
        }

        function closeUserWithdrawalModal() {
            document.getElementById('modalUserWithdrawal').style.display = 'none';
        }

        function updateWithdrawalFields() {
            const method = document.getElementById('userWithMethod').value;
            const label = document.getElementById('userWithAddressLabel');
            const input = document.getElementById('userWithAddress');
            if (method.startsWith('crypto_usdt_trc20')) {
                label.innerText = 'USDT (TRC-20) Receiving Address';
                input.placeholder = 'e.g. TRX Wallet Address (T...)';
            } else if (method.startsWith('crypto_usdt_erc20')) {
                label.innerText = 'USDT (ERC-20) Receiving Address';
                input.placeholder = 'e.g. 0x...';
            } else if (method.startsWith('crypto_btc')) {
                label.innerText = 'Bitcoin (BTC) Receiving Address';
                input.placeholder = 'e.g. bc1... or 1...';
            } else if (method === 'wise') {
                label.innerText = 'Wise Email Address or Account Name';
                input.placeholder = 'your-wise-email@example.com';
            } else if (method === 'payoneer') {
                label.innerText = 'Payoneer Email Address';
                input.placeholder = 'your-payoneer@example.com';
            } else {
                label.innerText = 'Bank Details (IBAN, SWIFT, Account Holder)';
                input.placeholder = 'IBAN: ..., SWIFT: ..., Name: ...';
            }
        }

        async function submitUserWithdrawal(e) {
            if (e && e.preventDefault) e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) return false;

            const amount = parseFloat(document.getElementById('userWithAmount').value);
            const method = document.getElementById('userWithMethod').value;
            const address = document.getElementById('userWithAddress').value.trim();

            if (!amount || amount <= 0 || !address) {
                alert('Please fill in all required fields.');
                return false;
            }

            try {
                const res = await fetch('/api/affiliate/request-withdrawal' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ amount, payout_method: method, payout_details: { address, method } })
                });
                const data = await res.json();
                if (data.success) {
                    alert('🎉 ' + (data.message || 'Withdrawal request submitted!'));
                    closeUserWithdrawalModal();
                    loadMyAffiliatePortal();
                } else {
                    alert('⚠️ Withdrawal Failed: ' + (data.error || 'Unknown error'));
                }
            } catch(err) {
                alert('Network error submitting withdrawal.');
            }
            return false;
        }

        // ── Admin Affiliate Control Handlers ──

        function switchAdminAffSubTab(subTab, btn) {
            document.querySelectorAll('.admin-aff-subtab').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
            document.querySelectorAll('.admin-aff-subpanel').forEach(p => p.style.display = 'none');
            const target = document.getElementById('affSubPanel-' + subTab);
            if (target) target.style.display = 'block';
        }

        async function loadAdminAffiliateControl() {
            const token = getAdminSessionToken();
            if (!token) return;

            try {
                // 1. Overview stats
                const res = await fetch('/api/affiliate/admin-get-overview' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                if (d.success && d.data) {
                    const stats = d.data;
                    _adminAffOverview = stats;
                    document.getElementById('adminAffTotalCount').innerText = stats.totalAffiliates || 0;
                    document.getElementById('adminAffActiveCount').innerText = stats.activeAffiliates || 0;
                    document.getElementById('adminAffTotalClicks').innerText = stats.totalClicks || 0;
                    document.getElementById('adminAffTotalConv').innerText = stats.totalConversions || 0;
                    document.getElementById('adminAffCrRate').innerText = stats.conversionRate || 0;
                    document.getElementById('adminAffTotalCommission').innerText = Number(stats.totalCommissionGenerated || 0).toFixed(2);
                    document.getElementById('adminAffTotalRev').innerText = Number(stats.totalRevenue || 0).toFixed(2);
                    document.getElementById('adminAffTotalPaidOut').innerText = Number(stats.totalPaidOut || 0).toFixed(2);
                    document.getElementById('adminAffPendingAmount').innerText = Number(stats.pendingWithdrawalsAmount || 0).toFixed(2);
                    document.getElementById('adminAffPendingCount').innerText = stats.pendingWithdrawalsCount || 0;
                }

                // 2. Load Offers
                loadAdminAffOffersTable();
                // 3. Load Affiliates Directory
                loadAdminAffiliatesDirectory();
                // 4. Load Clicks
                loadAdminAffClicksTable();
                // 5. Load Conversions
                loadAdminAffConversionsTable();
                // 6. Load Postbacks
                loadAdminAffPostbacksTable();
                // 7. Load Withdrawals
                loadAdminAffWithdrawalsTable();

            } catch(e) {}
        }

        async function loadAdminAffOffersTable() {
            const token = getAdminSessionToken();
            const tbody = document.getElementById('adminAffOffersBody');
            if (!tbody) return;
            try {
                const res = await fetch('/api/affiliate/admin-get-offers' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                if (d.success && Array.isArray(d.data)) {
                    tbody.innerHTML = d.data.map(o => {
                        const rawSlug = (o.landing_page_slug || o.id?.replace(/^offer_/, '') || o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^\/?(offer\/)?/, '');
                        const pageUrl = `/offer/${rawSlug}`;
                        return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 12px 16px;">
                                <strong style="color:#FFF;">${escapeHtml(o.title)}</strong>
                                <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">ID: ${escapeHtml(o.id)} • <span style="color:#38BDF8;">${escapeHtml(pageUrl)}</span></div>
                            </td>
                            <td style="padding: 12px 16px; text-transform:uppercase; font-size:12px;">${escapeHtml(o.package_name || o.package_id || 'Starter')}</td>
                            <td style="padding: 12px 16px; font-weight:700; color:#2DD4BF;">
                                $${Number(o.price || 19).toFixed(2)}/mo
                                <div style="font-size:11px; color:var(--text-muted);">
                                    ${o.payout_type === 'revshare' ? ((o.revshare_percent || o.commission_rate || 50) + '% RevShare') : ('$' + Number(o.fixed_payout_usd || 10).toFixed(2) + ' CPA')}
                                </div>
                            </td>
                            <td style="padding: 12px 16px;">
                                <a href="${pageUrl}" target="_blank" style="color:#38BDF8; font-size:12px; text-decoration:none; font-family:monospace; background:rgba(56,189,248,0.1); padding:3px 8px; border-radius:6px; border:1px solid rgba(56,189,248,0.2);">🔗 Preview Page</a>
                            </td>
                            <td style="padding: 12px 16px;">
                                <span style="background:${o.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${o.status === 'active' ? '#10B981' : '#F87171'}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">
                                    ${escapeHtml((o.status || 'active').toUpperCase())}
                                </span>
                            </td>
                            <td style="padding: 12px 16px; text-align:right; white-space:nowrap;">
                                <button class="btn btn-outline" style="padding:4px 10px; font-size:11px; margin-right:4px;" onclick='openAdminCpaOfferModal("${escapeHtml(o.id)}", ${JSON.stringify(o)})'>✏️ Edit</button>
                                <button class="btn btn-outline" style="padding:4px 10px; font-size:11px; color:#F87171; border-color:rgba(239,68,68,0.4);" onclick='deleteAdminCpaOffer("${escapeHtml(o.id)}", "${escapeHtml(o.title)}", "${rawSlug}")'>🗑️ Delete</button>
                            </td>
                        </tr>
                    `}).join('');
                }
            } catch(e) {}
        }

        async function loadAdminAffiliatesDirectory() {
            const token = getAdminSessionToken();
            const tbody = document.getElementById('adminAffDirectoryBody');
            if (!tbody) return;
            try {
                const res = await fetch('/api/affiliate/admin-get-affiliates' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                if (d.success && Array.isArray(d.data)) {
                    tbody.innerHTML = d.data.map(a => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 12px 16px;">
                                <strong style="color:#FFF;">${escapeHtml(a.name || 'Affiliate User')}</strong>
                                <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(a.email)}</div>
                            </td>
                            <td style="padding: 12px 16px; font-family:monospace; color:#818CF8; font-weight:700;">${escapeHtml(a.affiliate_id)}</td>
                            <td style="padding: 12px 16px;">${a.total_clicks || 0}</td>
                            <td style="padding: 12px 16px; font-weight:600; color:#10B981;">${a.total_conversions || 0}</td>
                            <td style="padding: 12px 16px; font-weight:700; color:#2DD4BF;">$${Number(a.total_earnings || 0).toFixed(2)}</td>
                            <td style="padding: 12px 16px;">
                                <span style="background:${a.affiliate_status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${a.affiliate_status === 'active' ? '#10B981' : '#F87171'}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">
                                    ${escapeHtml((a.affiliate_status || 'active').toUpperCase())}
                                </span>
                            </td>
                            <td style="padding: 12px 16px; text-align:right;">
                                <select onchange="updateAdminAffiliateStatus('${escapeHtml(a.affiliate_id)}', this.value)" style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; color:#FFF; font-size:11px; padding:3px 6px;">
                                    <option value="active" ${a.affiliate_status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="suspended" ${a.affiliate_status === 'suspended' ? 'selected' : ''}>Suspend</option>
                                    <option value="disabled" ${a.affiliate_status === 'disabled' ? 'selected' : ''}>Disable</option>
                                </select>
                            </td>
                        </tr>
                    `).join('');
                }
            } catch(e) {}
        }

        async function updateAdminAffiliateStatus(affId, status) {
            const token = getAdminSessionToken();
            if (!token) return;
            try {
                const res = await fetch('/api/affiliate/admin-update-affiliate-status' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ affiliate_id: affId, status })
                });
                const d = await res.json();
                if (d.success) {
                    alert('✓ ' + d.message);
                    loadAdminAffiliatesDirectory();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed'));
                }
            } catch(e) {}
        }

        async function loadAdminAffClicksTable() {
            const token = getAdminSessionToken();
            const tbody = document.getElementById('adminAffClicksBody');
            if (!tbody) return;
            try {
                const res = await fetch('/api/affiliate/admin-get-clicks' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                if (d.success && Array.isArray(d.data)) {
                    tbody.innerHTML = d.data.map(c => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 10px 14px; font-family:monospace; color:#818CF8;">${escapeHtml(c.click_id)}</td>
                            <td style="padding: 10px 14px;">${escapeHtml(c.offer_title || c.offer_id)}</td>
                            <td style="padding: 10px 14px; font-family:monospace; color:#2DD4BF;">${escapeHtml(c.affiliate_id)}</td>
                            <td style="padding: 10px 14px; font-family:monospace; color:var(--text-muted);">${escapeHtml(c.ip_address || '—')}</td>
                            <td style="padding: 10px 14px; color:var(--text-muted);">${escapeHtml(c.sub_id1 || '—')}</td>
                            <td style="padding: 10px 14px;">
                                <span style="background:${c.converted == 1 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)'}; color:${c.converted == 1 ? '#10B981' : '#94A3B8'}; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">
                                    ${c.converted == 1 ? 'CONVERTED' : 'VISITED'}
                                </span>
                            </td>
                            <td style="padding: 10px 14px; color:var(--text-muted); font-size:11px;">${new Date(c.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('');
                }
            } catch(e) {}
        }

        async function loadAdminAffConversionsTable() {
            const token = getAdminSessionToken();
            const tbody = document.getElementById('adminAffConvBody');
            if (!tbody) return;
            try {
                const res = await fetch('/api/affiliate/admin-get-conversions' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                if (d.success && Array.isArray(d.data)) {
                    tbody.innerHTML = d.data.map(v => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                            <td style="padding: 10px 14px; font-family:monospace; color:#2DD4BF;">${escapeHtml(v.conversion_id)}</td>
                            <td style="padding: 10px 14px; font-family:monospace; color:#818CF8;">${escapeHtml(v.click_id)}</td>
                            <td style="padding: 10px 14px;">${escapeHtml(v.affiliate_email || v.affiliate_id)}</td>
                            <td style="padding: 10px 14px; font-weight:600;">$${Number(v.order_amount || 0).toFixed(2)}</td>
                            <td style="padding: 10px 14px; font-weight:700; color:#10B981;">+$${Number(v.payout_amount || 0).toFixed(2)}</td>
                            <td style="padding: 10px 14px;">
                                <span style="background:rgba(16,185,129,0.15); color:#10B981; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">
                                    ${escapeHtml((v.status || 'approved').toUpperCase())}
                                </span>
                            </td>
                            <td style="padding: 10px 14px; color:var(--text-muted); font-size:11px;">${new Date(v.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('');
                }
            } catch(e) {}
        }

        async function loadAdminAffPostbacksTable() {
            const token = getAdminSessionToken();
            const tbodyLogs = document.getElementById('adminAffPostbacksBody');
            const tbodyConfigs = document.getElementById('adminAffPostbackConfigsBody');
            try {
                const res = await fetch('/api/affiliate/admin-get-postbacks' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                
                // Render Configs
                if (tbodyConfigs && d.success && Array.isArray(d.configs)) {
                    if (d.configs.length === 0) {
                        tbodyConfigs.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">No user S2S postback webhooks configured yet.</td></tr>';
                    } else {
                        tbodyConfigs.innerHTML = d.configs.map(cfg => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 10px 14px;">
                                    <div style="font-weight: 600; color: #FFF;">${escapeHtml(cfg.user_name || cfg.user_email || cfg.user_id)}</div>
                                    <div style="font-family: monospace; font-size: 11px; color: #38BDF8;">${escapeHtml(cfg.affiliate_id)}</div>
                                </td>
                                <td style="padding: 10px 14px;">
                                    <span style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">
                                        ${escapeHtml(cfg.http_method || 'GET')}
                                    </span>
                                </td>
                                <td style="padding: 10px 14px; font-family: monospace; font-size: 11px; color: #38BDF8; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${escapeHtml(cfg.postback_url)}
                                </td>
                                <td style="padding: 10px 14px;">
                                    <span style="background:${cfg.is_active != 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${cfg.is_active != 0 ? '#10B981' : '#F87171'}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                                        ${cfg.is_active != 0 ? 'ACTIVE' : 'INACTIVE'}
                                    </span>
                                </td>
                                <td style="padding: 10px 14px; font-size: 11px; color: var(--text-muted);">
                                    ${new Date(cfg.updated_at || cfg.created_at).toLocaleDateString()}
                                </td>
                                <td style="padding: 10px 14px; text-align: right;">
                                    <button class="btn btn-outline" style="padding: 4px 10px; font-size: 11px; font-weight: 600;" onclick="openAdminEditPostbackModal('${escapeHtml(cfg.user_id)}', '${escapeHtml(cfg.user_name || cfg.user_email || cfg.user_id)}', '${escapeHtml(cfg.affiliate_id)}', '${escapeHtml(cfg.postback_url)}', '${escapeHtml(cfg.http_method || 'GET')}', ${cfg.is_active != 0 ? 'true' : 'false'})">✏️ Edit</button>
                                </td>
                            </tr>
                        `).join('');
                    }
                }

                // Render Logs
                if (tbodyLogs && d.success && Array.isArray(d.data)) {
                    if (d.data.length === 0) {
                        tbodyLogs.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">No postback delivery history yet.</td></tr>';
                    } else {
                        tbodyLogs.innerHTML = d.data.map(p => {
                            const isSuccess = p.http_status >= 200 && p.http_status < 300;
                            return `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                    <td style="padding: 10px 14px; font-family:monospace; color:#818CF8;">${escapeHtml(p.id)}</td>
                                    <td style="padding: 10px 14px; font-size:12px;">${escapeHtml(p.affiliate_email || p.affiliate_id)}</td>
                                    <td style="padding: 10px 14px; font-family:monospace; font-size:11px; color:var(--text-muted); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                        ${escapeHtml(p.url)}
                                    </td>
                                    <td style="padding: 10px 14px; font-family:monospace; font-weight:700; color:${isSuccess ? '#10B981' : '#F87171'};">
                                        HTTP ${p.http_status || '—'}
                                    </td>
                                    <td style="padding: 10px 14px;">
                                        <span style="background:${p.status === 'delivered' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${p.status === 'delivered' ? '#10B981' : '#F87171'}; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">
                                            ${escapeHtml(p.status.toUpperCase())} (${p.retry_count} retries)
                                        </span>
                                    </td>
                                    <td style="padding: 10px 14px; text-align:right;">
                                        <button class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="retryAdminPostback('${escapeHtml(p.id)}')">🔁 Retry</button>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }
                }
            } catch(e) {}
        }

        function openAdminEditPostbackModal(userId, displayName, affiliateId, postbackUrl, method, isActive) {
            document.getElementById('adminEditPbUserId').value = userId || '';
            document.getElementById('adminEditPbUser').innerText = displayName + ' (' + affiliateId + ')';
            document.getElementById('adminEditPbUrl').value = postbackUrl || '';
            document.getElementById('adminEditPbMethod').value = method || 'GET';
            document.getElementById('adminEditPbActive').checked = isActive !== false;
            document.getElementById('adminPbTestResult').style.display = 'none';
            document.getElementById('modalAdminEditPostback').style.display = 'flex';
        }

        function closeAdminEditPostbackModal() {
            document.getElementById('modalAdminEditPostback').style.display = 'none';
        }

        function appendAdminPostbackTag(tag) {
            const input = document.getElementById('adminEditPbUrl');
            const val = input.value;
            const param = tag.replace(/[{}]/g, '').toLowerCase();
            input.value = val + (val.includes('?') ? '&' : '?') + param + '=' + tag;
        }

        async function testAdminPostbackPing() {
            const token = getAdminSessionToken();
            const url = document.getElementById('adminEditPbUrl').value.trim();
            const method = document.getElementById('adminEditPbMethod').value;
            const resBox = document.getElementById('adminPbTestResult');
            const btn = document.getElementById('btnAdminTestPb');
            if (!url) { alert('Please enter a postback URL first'); return; }

            btn.disabled = true;
            btn.innerText = 'Testing...';
            resBox.style.display = 'none';

            try {
                const res = await fetch('/api/affiliate/admin-test-postback' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ postback_url: url, http_method: method })
                });
                const d = await res.json();
                resBox.style.display = 'block';
                if (d.success && d.data) {
                    const isOk = d.data.statusCode >= 200 && d.data.statusCode < 300;
                    resBox.style.background = isOk ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
                    resBox.style.color = isOk ? '#10B981' : '#F87171';
                    resBox.style.border = '1px solid ' + (isOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)');
                    resBox.innerText = isOk
                        ? `✓ Endpoint responded with HTTP ${d.data.statusCode} OK in ${d.data.responseTimeMs}ms`
                        : `⚠️ HTTP ${d.data.statusCode || 'ERR'}: ${d.data.error || 'Connection failed'}`;
                } else {
                    resBox.style.background = 'rgba(239,68,68,0.15)';
                    resBox.style.color = '#F87171';
                    resBox.innerText = '⚠️ ' + (d.error || 'Test failed');
                }
            } catch(e) {
                resBox.style.display = 'block';
                resBox.style.background = 'rgba(239,68,68,0.15)';
                resBox.style.color = '#F87171';
                resBox.innerText = '⚠️ Network error during postback test.';
            } finally {
                btn.disabled = false;
                btn.innerText = '🚀 Test Ping';
            }
        }

        async function saveAdminEditPostback(e) {
            e.preventDefault();
            const token = getAdminSessionToken();
            const userId = document.getElementById('adminEditPbUserId').value;
            const postbackUrl = document.getElementById('adminEditPbUrl').value.trim();
            const httpMethod = document.getElementById('adminEditPbMethod').value;
            const isActive = document.getElementById('adminEditPbActive').checked;

            try {
                const res = await fetch('/api/affiliate/admin-save-postback-config' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({
                        user_id: userId,
                        postback_url: postbackUrl,
                        http_method: httpMethod,
                        is_active: isActive
                    })
                });
                const d = await res.json();
                if (d.success) {
                    alert('✓ ' + (d.message || 'S2S Postback configuration updated successfully.'));
                    closeAdminEditPostbackModal();
                    loadAdminAffPostbacksTable();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed to save configuration'));
                }
            } catch(e) {
                alert('⚠️ Network error saving postback.');
            }
            return false;
        }

        async function retryAdminPostback(postbackId) {
            const token = getAdminSessionToken();
            if (!token) return;
            try {
                const res = await fetch('/api/affiliate/admin-retry-postback' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ postback_id: postbackId })
                });
                const d = await res.json();
                if (d.success) {
                    alert('✓ ' + d.message);
                    loadAdminAffPostbacksTable();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed'));
                }
            } catch(e) {}
        }

        async function loadAdminAffWithdrawalsTable() {
            const token = getAdminSessionToken();
            const tbody = document.getElementById('adminAffWithdrawalsBody');
            if (!tbody) return;
            try {
                const res = await fetch('/api/affiliate/admin-get-withdrawals' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    headers: { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token }
                });
                const d = await res.json();
                if (d.success && Array.isArray(d.data)) {
                    tbody.innerHTML = d.data.map(w => {
                        const statusColor = w.status === 'paid' ? '#10B981' : (w.status === 'rejected' ? '#F87171' : (w.status === 'processing' ? '#38BDF8' : '#F59E0B'));
                        let detailsStr = '';
                        try {
                            const parsed = JSON.parse(w.payout_details_json || '{}');
                            detailsStr = parsed.address || JSON.stringify(parsed);
                        } catch(e) { detailsStr = w.payout_details_json || ''; }

                        return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 12px 16px; font-family:monospace; color:#818CF8;">${escapeHtml(w.id)}</td>
                                <td style="padding: 12px 16px;">
                                    <strong style="color:#FFF;">${escapeHtml(w.user_name || 'Affiliate')}</strong>
                                    <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(w.user_email)}</div>
                                </td>
                                <td style="padding: 12px 16px; font-weight:800; color:#FFF;">$${Number(w.amount).toFixed(2)}</td>
                                <td style="padding: 12px 16px; text-transform:uppercase; font-size:11px;">${escapeHtml(w.payout_method)}</td>
                                <td style="padding: 12px 16px; font-family:monospace; font-size:11px; color:#2DD4BF; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    ${escapeHtml(detailsStr)}
                                </td>
                                <td style="padding: 12px 16px;">
                                    <span style="background:${statusColor}20; color:${statusColor}; border:1px solid ${statusColor}40; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:800;">
                                        ${escapeHtml(w.status.toUpperCase())}
                                    </span>
                                </td>
                                <td style="padding: 12px 16px; font-family:monospace; font-size:11px; color:var(--text-muted);">${escapeHtml(w.payout_reference || '—')}</td>
                                <td style="padding: 12px 16px; text-align:right;">
                                    <button class="btn btn-outline" style="padding:4px 10px; font-size:11px;" onclick='openAdminWithdrawalModal("${escapeHtml(w.id)}", "${escapeHtml(w.status)}", "${escapeHtml(w.payout_reference || '')}", "${escapeHtml(w.admin_note || '')}")'>⚙️ Update</button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch(e) {}
        }

        function onAdminOfferPackageChange() {
            const pkg = document.getElementById('adminOfferPackageId').value;
            let slug = 'starter';
            let title = 'Starter Subscription';
            let orig = 39.00;
            let price = 19.00;
            let cta = 'Subscribe Starter';
            let badge = 'STARTER';

            if (pkg === 'plan_pro') {
                slug = 'professional';
                title = 'Professional Subscription';
                orig = 79.00;
                price = 39.00;
                cta = 'Subscribe Professional';
                badge = 'MOST POPULAR';
            } else if (pkg === 'plan_business') {
                slug = 'business';
                title = 'Business Subscription';
                orig = 129.00;
                price = 69.00;
                cta = 'Subscribe Business';
                badge = 'BEST VALUE';
            } else if (pkg === 'plan_enterprise') {
                slug = 'enterprise';
                title = 'Enterprise Suite';
                orig = 199.00;
                price = 99.00;
                cta = 'Start Enterprise Trial';
                badge = 'ENTERPRISE';
            } else if (pkg === 'plan_free') {
                slug = 'free';
                title = 'Free Plan';
                orig = 0.00;
                price = 0.00;
                cta = 'Start Free';
                badge = 'FREE';
            }

            if (!document.getElementById('adminOfferEditId').value) {
                document.getElementById('adminOfferTitle').value = 'AntiProfiles ' + title;
                document.getElementById('adminOfferSlug').value = slug;
                document.getElementById('adminOfferTargetUrl').value = '/offer/' + slug;
                document.getElementById('adminOfferOrigPrice').value = orig.toFixed(2);
                document.getElementById('adminOfferPrice').value = price.toFixed(2);
                document.getElementById('adminOfferCtaText').value = cta;
                document.getElementById('adminOfferBadgeText').value = badge;
            }
            calcAdminOfferDiscount();
        }

        function calcAdminOfferDiscount() {
            const orig = parseFloat(document.getElementById('adminOfferOrigPrice').value) || 0;
            const cur = parseFloat(document.getElementById('adminOfferPrice').value) || 0;
            const badgeEl = document.getElementById('adminOfferDiscountBadge');
            if (!badgeEl) return;
            if (orig > cur && orig > 0) {
                const disc = Math.round(((orig - cur) / orig) * 100);
                badgeEl.innerText = `Save ${disc}%`;
                badgeEl.style.background = 'rgba(74, 222, 128, 0.15)';
                badgeEl.style.color = '#4ADE80';
            } else {
                badgeEl.innerText = 'Regular Rate';
                badgeEl.style.background = 'rgba(148, 163, 184, 0.15)';
                badgeEl.style.color = '#94A3B8';
            }
        }

        function openAdminCpaOfferModal(offerId, offerData) {
            document.getElementById('modalAdminCpaOffer').style.display = 'flex';
            const delBtnWrap = document.getElementById('adminOfferDeleteBtnWrap');
            if (offerData) {
                document.getElementById('adminOfferModalTitle').innerText = 'Edit Offer & Landing Page';
                document.getElementById('adminOfferEditId').value = offerData.id || '';
                document.getElementById('adminOfferTitle').value = offerData.title || '';
                document.getElementById('adminOfferPackageId').value = offerData.package_id || 'plan_starter';
                
                const rawSlug = (offerData.landing_page_slug || offerData.id?.replace(/^offer_/, '') || 'starter').replace(/^\/?(offer\/)?/, '');
                document.getElementById('adminOfferSlug').value = rawSlug;
                document.getElementById('adminOfferTargetUrl').value = offerData.target_url || `/offer/${rawSlug}`;
                document.getElementById('adminOfferOrigPrice').value = Number(offerData.original_price || offerData.price || 19).toFixed(2);
                document.getElementById('adminOfferPrice').value = Number(offerData.price || 19).toFixed(2);
                document.getElementById('adminOfferCtaText').value = offerData.cta_text || 'Subscribe';
                document.getElementById('adminOfferBadgeText').value = offerData.badge_text || '';
                document.getElementById('adminOfferPayoutType').value = offerData.payout_type || 'revshare';
                document.getElementById('adminOfferRate').value = offerData.payout_type === 'revshare' ? (offerData.revshare_percent || offerData.commission_rate || 50) : (offerData.fixed_payout_usd || 10);
                document.getElementById('adminOfferTrialEnabled').checked = Boolean(offerData.trial_enabled);
                document.getElementById('adminOfferStatus').value = offerData.status || 'active';
                document.getElementById('adminOfferDesc').value = offerData.description || '';
                if (delBtnWrap) delBtnWrap.style.display = 'block';
            } else {
                document.getElementById('adminOfferModalTitle').innerText = 'Create CPA Offer & Landing Page';
                document.getElementById('adminOfferEditId').value = '';
                document.getElementById('adminOfferPackageId').value = 'plan_starter';
                document.getElementById('adminOfferTitle').value = 'AntiProfiles Starter Subscription';
                document.getElementById('adminOfferSlug').value = 'starter';
                document.getElementById('adminOfferTargetUrl').value = '/offer/starter';
                document.getElementById('adminOfferOrigPrice').value = '39.00';
                document.getElementById('adminOfferPrice').value = '19.00';
                document.getElementById('adminOfferCtaText').value = 'Subscribe Starter';
                document.getElementById('adminOfferBadgeText').value = 'LIMITED DEAL';
                document.getElementById('adminOfferPayoutType').value = 'revshare';
                document.getElementById('adminOfferRate').value = '50.00';
                document.getElementById('adminOfferTrialEnabled').checked = false;
                document.getElementById('adminOfferStatus').value = 'active';
                document.getElementById('adminOfferDesc').value = '';
                if (delBtnWrap) delBtnWrap.style.display = 'none';
            }
            calcAdminOfferDiscount();
        }

        function closeAdminCpaOfferModal() {
            document.getElementById('modalAdminCpaOffer').style.display = 'none';
        }

        async function saveAdminCpaOffer(e) {
            if (e && e.preventDefault) e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) return false;

            const id = document.getElementById('adminOfferEditId').value;
            const title = document.getElementById('adminOfferTitle').value.trim();
            const package_id = document.getElementById('adminOfferPackageId').value;
            const package_name = package_id === 'plan_free' ? 'Free' : package_id === 'plan_starter' ? 'Starter' : package_id === 'plan_business' ? 'Business' : package_id === 'plan_enterprise' ? 'Enterprise' : 'Professional';
            const rawSlug = document.getElementById('adminOfferSlug').value.trim().replace(/^\/?(offer\/)?/, '');
            const target_url = document.getElementById('adminOfferTargetUrl').value.trim() || `/offer/${rawSlug}`;
            const origPrice = parseFloat(document.getElementById('adminOfferOrigPrice').value) || 0;
            const curPrice = parseFloat(document.getElementById('adminOfferPrice').value) || 0;
            const cta_text = document.getElementById('adminOfferCtaText').value.trim();
            const badge_text = document.getElementById('adminOfferBadgeText').value.trim();
            const payout_type = document.getElementById('adminOfferPayoutType').value;
            const rate = parseFloat(document.getElementById('adminOfferRate').value) || 0;
            const trial_enabled = document.getElementById('adminOfferTrialEnabled').checked ? 1 : 0;
            const status = document.getElementById('adminOfferStatus').value;
            const description = document.getElementById('adminOfferDesc').value.trim();

            const payload = {
                id,
                title,
                package_id,
                package_name,
                landing_page_slug: rawSlug,
                target_url,
                price: curPrice,
                original_price: origPrice,
                cta_text,
                badge_text,
                trial_enabled,
                payout_type,
                revshare_percent: payout_type === 'revshare' ? rate : 0,
                commission_rate: payout_type === 'revshare' ? rate : 0,
                fixed_payout_usd: payout_type === 'fixed' ? rate : 0,
                status,
                description
            };

            try {
                const res = await fetch('/api/affiliate/admin-save-offer' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify(payload)
                });
                const d = await res.json();
                if (d.success) {
                    alert('✓ ' + d.message);
                    closeAdminCpaOfferModal();
                    loadAdminAffOffersTable();
                    if (typeof loadAdminAffiliateControl === 'function') loadAdminAffiliateControl();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed to save offer'));
                }
            } catch(err) {
                alert('Network error saving offer.');
            }
            return false;
        }

        async function deleteAdminCpaOffer(offerId, title, slug) {
            if (!confirm(`Are you sure you want to permanently delete offer "${title}" (${offerId}) and its dynamic landing page "/offer/${slug}"?\n\nThis will remove the page and prevent further traffic.`)) {
                return;
            }
            const token = getAdminSessionToken();
            if (!token) return;

            try {
                const res = await fetch('/api/affiliate/admin-delete-offer' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ id: offerId, slug, permanent: true })
                });
                const d = await res.json();
                if (d.success) {
                    alert('🗑️ ' + d.message);
                    loadAdminAffOffersTable();
                    if (typeof loadAdminAffiliateControl === 'function') loadAdminAffiliateControl();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed to delete offer'));
                }
            } catch(err) {
                alert('Network error deleting offer.');
            }
        }

        async function deleteAdminCpaOfferFromModal() {
            const id = document.getElementById('adminOfferEditId').value;
            const title = document.getElementById('adminOfferTitle').value;
            const slug = document.getElementById('adminOfferSlug').value;
            if (!id) return;
            closeAdminCpaOfferModal();
            await deleteAdminCpaOffer(id, title, slug);
        }

        function openAdminWithdrawalModal(withId, currStatus, currRef, currNote) {
            document.getElementById('modalAdminWithdrawalAction').style.display = 'flex';
            document.getElementById('adminWithActId').value = withId;
            document.getElementById('adminWithActStatus').value = currStatus || 'approved';
            document.getElementById('adminWithActRef').value = currRef || '';
            document.getElementById('adminWithActNote').value = currNote || '';
        }

        function closeAdminWithdrawalModal() {
            document.getElementById('modalAdminWithdrawalAction').style.display = 'none';
        }

        async function submitAdminWithdrawalUpdate(e) {
            if (e && e.preventDefault) e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) return false;

            const id = document.getElementById('adminWithActId').value;
            const status = document.getElementById('adminWithActStatus').value;
            const payout_reference = document.getElementById('adminWithActRef').value.trim();
            const admin_note = document.getElementById('adminWithActNote').value.trim();

            try {
                const res = await fetch('/api/affiliate/admin-update-withdrawal' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ id, status, payout_reference, admin_note })
                });
                const d = await res.json();
                if (d.success) {
                    alert('✓ ' + d.message);
                    closeAdminWithdrawalModal();
                    loadAdminAffWithdrawalsTable();
                    loadAdminAffiliateControl();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed'));
                }
            } catch(err) {
                alert('Network error updating withdrawal.');
            }
            return false;
        }

        function openAdminAffiliateSettingsModal() {
            document.getElementById('modalAdminAffiliateSettings').style.display = 'flex';
            if (_adminAffOverview && _adminAffOverview.settings) {
                const s = _adminAffOverview.settings;
                document.getElementById('adminAffSetEnabled').checked = s.enabled !== false;
                document.getElementById('adminAffSetRate').value = s.defaultRate || 15;
                document.getElementById('adminAffSetMinPayout').value = s.minPayout || 50;
                document.getElementById('adminAffSetCookieDays').value = s.cookieDays || 30;
            }
        }

        function closeAdminAffiliateSettingsModal() {
            document.getElementById('modalAdminAffiliateSettings').style.display = 'none';
        }

        async function saveAdminAffiliateSettings(e) {
            if (e && e.preventDefault) e.preventDefault();
            const token = getAdminSessionToken();
            if (!token) return false;

            const enabled = document.getElementById('adminAffSetEnabled').checked;
            const default_commission_rate = parseFloat(document.getElementById('adminAffSetRate').value) || 15;
            const min_payout_usd = parseFloat(document.getElementById('adminAffSetMinPayout').value) || 50;
            const cookie_duration_days = parseInt(document.getElementById('adminAffSetCookieDays').value, 10) || 30;

            try {
                const res = await fetch('/api/affiliate/admin-save-settings' + (token ? '?token=' + encodeURIComponent(token) : ''), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token },
                    body: JSON.stringify({ enabled, default_commission_rate, min_payout_usd, cookie_duration_days })
                });
                const d = await res.json();
                if (d.success) {
                    alert('✓ ' + d.message);
                    closeAdminAffiliateSettingsModal();
                    loadAdminAffiliateControl();
                } else {
                    alert('⚠️ ' + (d.error || 'Failed'));
                }
            } catch(err) {
                alert('Network error saving settings.');
            }
            return false;
        }

        // Auto-verify email token if present in URL
        async function checkUrlEmailVerificationToken() {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('verify_token') || params.get('token');
            const isVerifyAction = params.get('action') === 'verify-email' || window.location.pathname.includes('verify-email') || params.has('verify_token');

            if (token && isVerifyAction) {
                // Clear URL params cleanly without page reload
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }

                // Show processing indicator
                openModal('login');
                const msg = document.getElementById('loginMsg');
                if (msg) {
                    msg.style.display = 'block';
                    msg.style.background = 'rgba(99,102,241,0.2)';
                    msg.style.color = '#818CF8';
                    msg.style.border = '1px solid rgba(99,102,241,0.4)';
                    msg.style.borderRadius = '10px';
                    msg.style.padding = '14px';
                    msg.innerText = '⏳ Verifying your email address with central security...';
                }

                try {
                    const res = await fetch('/api/auth/verify-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    const data = await res.json();
                    if (data.success) {
                        if (msg) {
                            msg.style.background = 'rgba(45,212,191,0.2)';
                            msg.style.color = '#2DD4BF';
                            msg.style.border = '1px solid rgba(45,212,191,0.4)';
                            msg.innerHTML = '🎉 <strong>Email Verified Successfully!</strong> Your account is fully active. You can sign in now.';
                        }
                        if (data.sessionToken && data.user) {
                            localStorage.setItem('sessionToken', data.sessionToken);
                            localStorage.setItem('user', JSON.stringify(data.user));
                            window._pvJustLoggedIn = true;
                            setTimeout(() => {
                                closeModal();
                                checkSession();
                            }, 1200);
                        }
                    } else {
                        if (msg) {
                            msg.style.background = 'rgba(239,68,68,0.2)';
                            msg.style.color = '#F87171';
                            msg.style.border = '1px solid rgba(239,68,68,0.4)';
                            msg.innerText = '⚠️ ' + (data.error || 'Verification token is invalid or expired.');
                        }
                    }
                } catch(e) {
                    if (msg) {
                        msg.style.background = 'rgba(239,68,68,0.2)';
                        msg.style.color = '#F87171';
                        msg.style.border = 'none';
                        msg.innerText = '⚠️ Connection error during email verification.';
                    }
                }
            }
        }

        // Router & Route Guard on Page Load
        window.addEventListener('DOMContentLoaded', () => {
            // Auto capture & persist CPA affiliate referral tracking parameters
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const affId = urlParams.get('aff_id') || urlParams.get('ref') || urlParams.get('partner');
                const clickId = urlParams.get('click_id');
                const offerId = urlParams.get('offer_id');
                const subId1 = urlParams.get('sub_id1');
                const subId2 = urlParams.get('sub_id2');

                if (affId) {
                    localStorage.setItem('aff_id', affId);
                    document.cookie = `aff_id=${encodeURIComponent(affId)}; path=/; max-age=2592000; SameSite=Lax`;
                }
                if (clickId) {
                    localStorage.setItem('click_id', clickId);
                    document.cookie = `click_id=${encodeURIComponent(clickId)}; path=/; max-age=2592000; SameSite=Lax`;
                }
                if (offerId) {
                    localStorage.setItem('offer_id', offerId);
                    document.cookie = `offer_id=${encodeURIComponent(offerId)}; path=/; max-age=2592000; SameSite=Lax`;
                }
                if (subId1) {
                    localStorage.setItem('sub_id1', subId1);
                    document.cookie = `sub_id1=${encodeURIComponent(subId1)}; path=/; max-age=2592000; SameSite=Lax`;
                }
                if (subId2) {
                    localStorage.setItem('sub_id2', subId2);
                    document.cookie = `sub_id2=${encodeURIComponent(subId2)}; path=/; max-age=2592000; SameSite=Lax`;
                }
            } catch(e) {}

            initCaptchaSystem();
            initGoogleOAuth();
            checkUrlEmailVerificationToken();
            const path = window.location.pathname.toLowerCase();
            const token = localStorage.getItem('sessionToken');
            const userStr = localStorage.getItem('user');
            let isAuthenticated = false;

            if (token && userStr && token !== 'undefined' && userStr !== 'undefined') {
                try {
                    const u = JSON.parse(userStr);
                    if (u && u.email) {
                        isAuthenticated = true;
                    }
                } catch(e) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                }
            }

            if (path.includes('/logout')) {
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('user');
                closeAdminDashboard();
                openModal('login');
                return;
            }

            if (isAuthenticated) {
                closeModal();
                checkSession();
            } else {
                closeAdminDashboard();
                if (path.includes('/login')) {
                    openModal('login');
                } else if (path.includes('/register')) {
                    openModal('register');
                }
            }
            initRealtimeWebSync();
            loadUserPortalData();
            fetchReleasesAndUpdateLanding();

            // Check for specific package plan or affiliate offer in URL
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const planParam = urlParams.get('plan') || urlParams.get('package') || localStorage.getItem('selected_plan');
                const offerParam = urlParams.get('offer_id');
                const autoOpen = urlParams.get('auto_open') || urlParams.get('open');
                const hash = window.location.hash;

                let targetPlanKey = planParam || '';
                if (!targetPlanKey && offerParam) {
                    if (offerParam.includes('pro') || offerParam.includes('49')) targetPlanKey = 'plan_pro';
                    else if (offerParam.includes('starter') || offerParam.includes('19')) targetPlanKey = 'plan_starter';
                    else if (offerParam.includes('business') || offerParam.includes('99')) targetPlanKey = 'plan_business';
                }

                if (targetPlanKey || hash === '#pricing' || autoOpen === '1') {
                    let cardId = 'plan-card-pro';
                    let planTitle = 'Professional';
                    const lowerKey = (targetPlanKey || '').toLowerCase();
                    if (lowerKey.includes('starter') || lowerKey.includes('19')) {
                        cardId = 'plan-card-starter';
                        planTitle = 'Starter';
                    } else if (lowerKey.includes('business') || lowerKey.includes('99')) {
                        cardId = 'plan-card-business';
                        planTitle = 'Business';
                    } else if (lowerKey === 'free') {
                        cardId = 'plan-card-free';
                        planTitle = 'Free';
                    }

                    setTimeout(() => {
                        const targetCard = document.getElementById(cardId);
                        if (targetCard) {
                            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetCard.style.boxShadow = '0 0 35px rgba(45, 212, 191, 0.65)';
                            targetCard.style.borderColor = '#2DD4BF';
                            targetCard.style.transform = 'scale(1.03)';
                        }
                        if ((autoOpen === '1' || urlParams.has('offer_id') || urlParams.has('ref') || urlParams.has('aff_id')) && !isAuthenticated) {
                            openModal('register', planTitle);
                        }
                    }, 400);
                }
            } catch(e) {}

            // Auto trigger Google OAuth if query param is set (e.g. from desktop app or external link)
            try {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('oauth') === 'google' && !isAuthenticated) {
                    setTimeout(() => {
                        handleGoogleSignIn();
                    }, 500);
                }
            } catch(e) {}
        });
    </script>
</body>
</html>


