<?php
// ──────────────────────────────────────────────
// ProfileVault — Landing Page Database-Driven CMS API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

sendJsonHeader();
$db = Database::getConnection();

// 1. Branding
$brandingStmt = $db->query("SELECT config_key, config_value FROM landing_branding");
$brandingRows = $brandingStmt->fetchAll();
$branding = [];
foreach ($brandingRows as $r) {
    $branding[$r['config_key']] = $r['config_value'];
}

// 2. Hero
$heroStmt = $db->query("SELECT * FROM landing_hero WHERE id = 1");
$hero = $heroStmt->fetch() ?: [
    'headline' => 'Browse Privately. Manage Profiles. Scale Your Workflow.',
    'subheadline' => 'Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.',
    'cta_primary_text' => 'Start Free',
    'cta_primary_url' => '#register',
    'cta_secondary_text' => 'View Pricing',
    'cta_secondary_url' => '#pricing',
    'trust_text' => '⚡ No credit card required • Free trial available • Cancel anytime'
];

// 3. Stats
$statsStmt = $db->query("SELECT * FROM landing_stats WHERE is_active = 1 ORDER BY sort_order ASC");
$stats = $statsStmt->fetchAll();

// 4. Features
$featStmt = $db->query("SELECT * FROM landing_features WHERE is_active = 1 ORDER BY sort_order ASC");
$features = $featStmt->fetchAll();

// 5. Steps
$stepsStmt = $db->query("SELECT * FROM landing_steps ORDER BY sort_order ASC");
$steps = $stepsStmt->fetchAll();

// 6. Pricing Plans & Features
$plansStmt = $db->query("SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC");
$plans = $plansStmt->fetchAll();

$planFeatStmt = $db->query("SELECT * FROM pricing_plan_features ORDER BY sort_order ASC");
$planFeaturesRows = $planFeatStmt->fetchAll();

$planFeaturesMap = [];
foreach ($planFeaturesRows as $pf) {
    $planFeaturesMap[$pf['plan_id']][] = $pf;
}

foreach ($plans as &$p) {
    $p['features'] = $planFeaturesMap[$p['id']] ?? [];
}

// 7. FAQs
$faqStmt = $db->query("SELECT * FROM landing_faqs WHERE is_active = 1 ORDER BY sort_order ASC");
$faqs = $faqStmt->fetchAll();

// 8. Testimonials
$testStmt = $db->query("SELECT * FROM landing_testimonials WHERE is_active = 1 ORDER BY sort_order ASC");
$testimonials = $testStmt->fetchAll();

// 9. SEO Settings
$seoStmt = $db->query("SELECT config_key, config_value FROM landing_seo");
$seoRows = $seoStmt->fetchAll();
$seo = [];
foreach ($seoRows as $s) {
    $seo[$s['config_key']] = $s['config_value'];
}

// 10. Inject Admin-Configured Desktop Releases & Download URLs
$config = getDesktopAppConfigMap();
$releases = [
    'windows' => [
        'url' => $config['win_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-Windows-x64.exe',
        'version' => $config['win_app_version'] ?? '1.0.0',
        'enabled' => ($config['win_enabled'] ?? 'true') !== 'false'
    ],
    'mac_intel' => [
        'url' => $config['mac_intel_download_url'] ?? $config['mac_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-macOS-Intel-x64.dmg',
        'version' => $config['mac_intel_app_version'] ?? '1.0.0',
        'enabled' => ($config['mac_intel_enabled'] ?? 'true') !== 'false'
    ],
    'mac_arm' => [
        'url' => $config['mac_arm_download_url'] ?? $config['mac_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-macOS-Apple-Silicon-arm64.dmg',
        'version' => $config['mac_arm_app_version'] ?? '1.0.0',
        'enabled' => ($config['mac_arm_enabled'] ?? 'true') !== 'false'
    ],
    'linux' => [
        'url' => $config['linux_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-Linux-x86_64.AppImage',
        'version' => $config['linux_app_version'] ?? '1.0.0',
        'enabled' => ($config['linux_enabled'] ?? 'true') !== 'false'
    ]
];

respondJson([
    'success' => true,
    'data' => [
        'branding' => $branding,
        'hero' => $hero,
        'stats' => $stats,
        'features' => $features,
        'steps' => $steps,
        'pricing_plans' => $plans,
        'faqs' => $faqs,
        'testimonials' => $testimonials,
        'seo' => $seo,
        'releases' => $releases
    ]
]);
