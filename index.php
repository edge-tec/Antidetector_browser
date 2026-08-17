<?php
// ──────────────────────────────────────────────
// ProfileVault — Root Request Dispatcher
// ──────────────────────────────────────────────

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$parsedPath = parse_url($requestUri, PHP_URL_PATH) ?? '/';

// If static or api request from root, map to php-backend
if (strpos($parsedPath, '/api/') === 0 || strpos($parsedPath, '/verify-email') === 0 || strpos($parsedPath, '/sitemap') === 0 || strpos($parsedPath, '/robots') === 0 || strpos($parsedPath, '/llms') === 0) {
    if (file_exists(__DIR__ . '/php-backend' . $parsedPath)) {
        require_once __DIR__ . '/php-backend' . $parsedPath;
        exit;
    }
}

require_once __DIR__ . '/php-backend/index.php';
