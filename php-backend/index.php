<?php
// ──────────────────────────────────────────────
// ProfileVault — Central PHP Front Controller & Router for aaPanel
// Handles REST APIs, Web App, Landing Page & Downloads
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

// Parse Request URI
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestUri = rtrim($requestUri, '/');

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

// If requested static file exists in public/
if ($requestUri && file_exists($rendererPath . $requestUri) && !is_dir($rendererPath . $requestUri)) {
    $mime = mime_content_type($rendererPath . $requestUri);
    header('Content-Type: ' . $mime);
    readfile($rendererPath . $requestUri);
    exit();
}

// SPA index.html fallback
$indexFile = $rendererPath . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($indexFile);
    exit();
}

// Default Welcome Page if static build is not uploaded
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ProfileVault — PHP Production Server Running on aaPanel</title>
    <style>
        body { background-color: #0F0F14; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #161622; border: 1px solid #2C2C3E; padding: 40px; border-radius: 16px; text-align: center; max-width: 520px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        h1 { color: #2DD4BF; margin-top: 0; }
        p { color: #94A3B8; font-size: 14px; line-height: 1.6; }
        .badge { background: #3B82F620; color: #60A5FA; border: 1px solid #3B82F650; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; display: inline-block; margin-bottom: 16px; }
        .code { background: #09090D; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #2DD4BF; text-align: left; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">PHP <?php echo PHP_VERSION; ?> ACTIVE ON AAPANEL</div>
        <h1>🛡️ ProfileVault Production Server</h1>
        <p>The centralized PHP backend service is running online with Database, Authentication, Server-Side Licensing, Application Downloads, and Admin Control APIs.</p>
        <div class="code">
            <strong>REST API Status:</strong> ONLINE<br>
            <strong>Database Driver:</strong> <?php echo strtoupper(DB_DRIVER); ?><br>
            <strong>aaPanel Ready:</strong> YES
        </div>
    </div>
</body>
</html>
