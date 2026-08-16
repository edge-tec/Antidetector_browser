<?php
// ──────────────────────────────────────────────
// ProfileVault — Central PHP Front Controller & Router for aaPanel
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

// ── 1. API Route Dispatcher ──
if (strpos($requestUri, '/api/') === 0 || strpos($requestUri, 'api/') === 0) {
    
    // Health Check
    if ($requestUri === '/api/health') {
        respondJson([
            'status' => 'online',
            'engine' => 'PHP ' . PHP_VERSION,
            'app' => APP_NAME,
            'version' => APP_VERSION,
            'timestamp' => date('c')
        ]);
    }

    // Public Releases & App Downloads Manifest API
    if ($requestUri === '/api/public/releases') {
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

    // Auth APIs (/api/auth/login, /api/auth/register, /api/auth/me)
    if (strpos($requestUri, '/api/auth/') === 0) {
        $action = str_replace('/api/auth/', '', $requestUri);
        $_GET['action'] = $action;
        require_once __DIR__ . '/api/auth.php';
        exit();
    }

    // License Validation & Device API (/api/license/validate)
    if ($requestUri === '/api/license/validate' || $requestUri === '/api/license') {
        require_once __DIR__ . '/api/license.php';
        exit();
    }

    // Admin APIs (/api/admin/*)
    if (strpos($requestUri, '/api/admin/') === 0) {
        $action = str_replace('/api/admin/', '', $requestUri);
        $_GET['action'] = $action;
        require_once __DIR__ . '/api/admin.php';
        exit();
    }

    // Support APIs (/api/support/*)
    if (strpos($requestUri, '/api/support/') === 0) {
        $action = str_replace('/api/support/', '', $requestUri);
        $_GET['action'] = $action;
        require_once __DIR__ . '/api/support.php';
        exit();
    }

    respondJson(['success' => false, 'error' => 'API endpoint not found.'], 404);
}

// ── 2. Serve Static Frontend Web UI & Single Page App (SPA) ──
$rendererPath = __DIR__ . '/public';

if ($requestUri !== '/' && file_exists($rendererPath . $requestUri) && !is_dir($rendererPath . $requestUri)) {
    $mime = mime_content_type($rendererPath . $requestUri);
    header('Content-Type: ' . $mime);
    readfile($rendererPath . $requestUri);
    exit();
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


$appBaseUrl = defined('APP_URL') ? APP_URL : 'https://app.edgecash.net';
$pageTitle = $pageSeo['title'] ?? 'ProfileVault — Anti-Detect Browser & Profile Isolation';
$pageDesc = $pageSeo['description'] ?? 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Software.';
$pageCanonical = $pageSeo['canonical_url'] ?? (rtrim($appBaseUrl, '/') . $requestUri);
$pageRobots = $pageSeo['robots'] ?? 'index, follow';
$ogTitle = $pageSeo['og_title'] ?? $pageTitle;
$ogDesc = $pageSeo['og_description'] ?? $pageDesc;
$ogImage = $pageSeo['og_image'] ?? ($appBaseUrl . '/og-cover.png');

// Schema.org JSON-LD Generation
$schemas = [
    [
        "@context" => "https://schema.org",
        "@type" => "Organization",
        "name" => "ProfileVault Software Inc.",
        "url" => $appBaseUrl,

        "logo" => "https://profilevault.local/logo.png",
        "sameAs" => [
            "https://x.com/ProfileVaultApp",
            "https://github.com/edge-tec/Antidetector_browser"
        ]
    ],
    [
        "@context" => "https://schema.org",
        "@type" => "SoftwareApplication",
        "name" => "ProfileVault Anti-Detect Browser",
        "operatingSystem" => "macOS, Windows",
        "applicationCategory" => "BusinessApplication",
        "offers" => [
            "@type" => "Offer",
            "price" => "0.00",
            "priceCurrency" => "USD"
        ]
    ]
];

$indexFile = $rendererPath . '/index.html';
if (file_exists($indexFile)) {
    $html = file_get_contents($indexFile);

    $seoTags = "\n    <title>" . htmlspecialchars($pageTitle) . "</title>\n";
    $seoTags .= '    <meta name="description" content="' . htmlspecialchars($pageDesc) . '" />' . "\n";
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

// Default Fallback Page
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($pageDesc); ?>">
    <meta name="robots" content="<?php echo htmlspecialchars($pageRobots); ?>">
    <link rel="canonical" href="<?php echo htmlspecialchars($pageCanonical); ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($ogTitle); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($ogDesc); ?>">
    <meta property="og:image" content="<?php echo htmlspecialchars($ogImage); ?>">
    <script type="application/ld+json"><?php echo json_encode($schemas, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES); ?></script>
    <style>
        body { background-color: #0F0F14; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #161622; border: 1px solid #2C2C3E; padding: 40px; border-radius: 16px; text-align: center; max-width: 540px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        h1 { color: #2DD4BF; margin-top: 0; }
        p { color: #94A3B8; font-size: 14px; line-height: 1.6; }
        .badge { background: #3B82F620; color: #60A5FA; border: 1px solid #3B82F650; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; display: inline-block; margin-bottom: 16px; }
        .code { background: #09090D; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #2DD4BF; text-align: left; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">PHP <?php echo PHP_VERSION; ?> ACTIVE ON AAPANEL</div>
        <h1>🛡️ <?php echo htmlspecialchars(APP_NAME); ?> Server</h1>
        <p><?php echo htmlspecialchars($pageDesc); ?></p>
        <div class="code">
            <strong>REST API Status:</strong> ONLINE<br>
            <strong>SEO & AEO Engine:</strong> ACTIVE<br>
            <strong>Sitemap:</strong> <a href="/sitemap.xml" style="color:#2DD4BF;">/sitemap.xml</a> | <a href="/llms.txt" style="color:#2DD4BF;">/llms.txt</a>
        </div>
    </div>
</body>
</html>
