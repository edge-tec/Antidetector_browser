<?php
// ──────────────────────────────────────────────
// ProfileVault — Dynamic Robots.txt Endpoint
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = getDbConnection();
$stmt = $pdo->prepare("SELECT `value` FROM `seo_settings` WHERE `key` = 'robots_content'");
$stmt->execute();
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!empty($row['value'])) {
    echo $row['value'];
} else {
    $baseUrl = defined('APP_URL') ? APP_URL : 'https://app.edgecash.net';
    echo "User-agent: *\n";
    echo "Allow: /\n";
    echo "Disallow: /admin/\n";
    echo "Disallow: /api/\n\n";
    echo "Sitemap: " . rtrim($baseUrl, '/') . "/sitemap.xml\n";
}
