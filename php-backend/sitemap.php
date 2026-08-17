<?php
// ──────────────────────────────────────────────
// ProfileVault — Dynamic XML & HTML Sitemap Endpoint
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

$pdo = getDbConnection();
$format = $_GET['format'] ?? 'xml';

$pages = [];
try {
    $stmt = $pdo->query("SELECT * FROM `page_seo` WHERE `robots` NOT LIKE '%noindex%' ORDER BY `page_path` ASC");
    $pages = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
} catch (Throwable $e) {}

if (empty($pages)) {
    try {
        $stmt2 = $pdo->query("SELECT * FROM `seo_pages` WHERE `robots` NOT LIKE '%noindex%' ORDER BY `page_path` ASC");
        $pages = $stmt2 ? $stmt2->fetchAll(PDO::FETCH_ASSOC) : [];
    } catch (Throwable $e) {}
}

if (empty($pages)) {
    $pages = [
        ['page_path' => '/', 'title' => 'ProfileVault Anti-Detect Browser', 'description' => 'Isolated browser profiles and fingerprint masking.', 'canonical_url' => 'https://antiprofiles.com/', 'updated_at' => date('Y-m-d')],
        ['page_path' => '/download', 'title' => 'Download ProfileVault', 'description' => 'Download for Windows, macOS & Linux.', 'canonical_url' => 'https://antiprofiles.com/download', 'updated_at' => date('Y-m-d')],
        ['page_path' => '/pricing', 'title' => 'Pricing & Plans', 'description' => 'Affordable multi-accounting browser plans.', 'canonical_url' => 'https://antiprofiles.com/pricing', 'updated_at' => date('Y-m-d')]
    ];
}

if ($format === 'html') {
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Sitemap — ProfileVault</title>
        <style>
            body { background: #0F0F14; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; }
            h1 { color: #2DD4BF; border-bottom: 1px solid #2C2C3E; padding-bottom: 12px; }
            ul { list-style: none; padding: 0; }
            li { margin-bottom: 12px; background: #161622; border: 1px solid #2C2C3E; padding: 14px; border-radius: 8px; }
            a { color: #60A5FA; text-decoration: none; font-weight: 700; font-size: 16px; }
            p { margin: 6px 0 0; color: #94A3B8; font-size: 13px; }
        </style>
    </head>
    <body>
        <h1>🗺️ ProfileVault Website Sitemap</h1>
        <ul>
            <?php foreach ($pages as $p): ?>
                <li>
                    <a href="<?php echo htmlspecialchars($p['canonical_url'] ?: $p['page_path']); ?>">
                        <?php echo htmlspecialchars($p['title']); ?>
                    </a>
                    <p><?php echo htmlspecialchars($p['description']); ?></p>
                </li>
            <?php endforeach; ?>
        </ul>
    </body>
    </html>
    <?php
    exit();
}

// XML Sitemap Output
header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

$baseUrl = defined('APP_URL') ? APP_URL : 'https://app.edgecash.net';

foreach ($pages as $p) {
    $loc = $p['canonical_url'] ?: (rtrim($baseUrl, '/') . $p['page_path']);
    $priority = $p['page_path'] === '/' ? '1.0' : '0.8';
    $changefreq = $p['page_path'] === '/' ? 'daily' : 'weekly';
    $lastmod = !empty($p['updated_at']) ? date('Y-m-d', strtotime($p['updated_at'])) : date('Y-m-d');

    echo "  <url>\n";
    echo "    <loc>" . htmlspecialchars($loc) . "</loc>\n";
    echo "    <lastmod>{$lastmod}</lastmod>\n";
    echo "    <changefreq>{$changefreq}</changefreq>\n";
    echo "    <priority>{$priority}</priority>\n";
    echo "  </url>\n";
}

echo '</urlset>';
