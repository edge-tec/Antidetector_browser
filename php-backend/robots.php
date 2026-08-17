<?php
// ──────────────────────────────────────────────
// ProfileVault — Dynamic Robots.txt Endpoint
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = getDbConnection();
$content = null;
try {
    $stmt = $pdo->prepare("SELECT `value` FROM `settings` WHERE `key` = 'seo_robots_content' OR `key` = 'robots_content'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['value'])) $content = $row['value'];
} catch (Throwable $e) {}

if (!$content) {
    try {
        $stmt = $pdo->prepare("SELECT `value` FROM `seo_settings` WHERE `key` = 'robots_content'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && !empty($row['value'])) $content = $row['value'];
    } catch (Throwable $e) {}
}

if (!empty($content)) {
    echo $content;
} else {
    $baseUrl = defined('APP_URL') ? APP_URL : 'https://app.edgecash.net';
    echo "User-agent: *\n";
    echo "Allow: /\n";
    echo "Disallow: /admin/\n";
    echo "Disallow: /api/\n\n";
    echo "Sitemap: " . rtrim($baseUrl, '/') . "/sitemap.xml\n";
}
