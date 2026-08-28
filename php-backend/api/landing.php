<?php
// ──────────────────────────────────────────────
// AntiProfiles — Landing Page Database-Driven CMS API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

sendJsonHeader();
$db = Database::getConnection();

// 1. Branding
$branding = [];
try {
    $brandingStmt = $db->query("SELECT config_key, config_value FROM landing_branding");
    $brandingRows = $brandingStmt->fetchAll();
    foreach ($brandingRows as $r) {
        $branding[$r['config_key']] = $r['config_value'];
    }
} catch (Throwable $e) {
    $branding = [
        'brand_name' => 'AntiProfiles',
        'tagline' => 'Next-Gen Anti-Detect Browser & Multi-Account Privacy Solution',
        'logo_url' => '/brand-logo.png',
        'favicon_url' => '/favicon.ico'
    ];
}

// 2. Hero
$hero = [
    'headline' => 'Browse Privately. Manage Profiles. Scale Your Workflow.',
    'subheadline' => 'Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.',
    'cta_primary_text' => 'Start Free',
    'cta_primary_url' => '#register',
    'cta_secondary_text' => 'View Pricing',
    'cta_secondary_url' => '#pricing',
    'trust_text' => '⚡ No credit card required • Free trial available • Cancel anytime'
];
try {
    $heroStmt = $db->query("SELECT * FROM landing_hero WHERE id = 1");
    $dbHero = $heroStmt->fetch();
    if ($dbHero) $hero = $dbHero;
} catch (Throwable $e) {}

// 3. Stats
$stats = [];
try {
    $statsStmt = $db->query("SELECT * FROM landing_stats WHERE is_active = 1 ORDER BY sort_order ASC");
    $stats = $statsStmt->fetchAll();
} catch (Throwable $e) {}

// 4. Features
$features = [];
try {
    $featStmt = $db->query("SELECT * FROM landing_features WHERE is_active = 1 ORDER BY sort_order ASC");
    $features = $featStmt->fetchAll();
} catch (Throwable $e) {}

// 5. Steps
$steps = [];
try {
    $stepsStmt = $db->query("SELECT * FROM landing_steps ORDER BY sort_order ASC");
    $steps = $stepsStmt->fetchAll();
} catch (Throwable $e) {}

// 6. Pricing Plans & Features
$plans = [];
try {
    $plansStmt = $db->query("SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC");
    $plans = $plansStmt->fetchAll();
} catch (Throwable $e) {}

$planFeaturesMap = [];
try {
    $planFeatStmt = $db->query("SELECT * FROM pricing_plan_features ORDER BY sort_order ASC");
    $planFeaturesRows = $planFeatStmt->fetchAll();
    foreach ($planFeaturesRows as $pf) {
        $planFeaturesMap[$pf['plan_id']][] = $pf;
    }
} catch (Throwable $e) {}

foreach ($plans as &$p) {
    $p['features'] = $planFeaturesMap[$p['id']] ?? [];
}

// 7. FAQs
$faqs = [];
try {
    $faqStmt = $db->query("SELECT * FROM landing_faqs WHERE is_active = 1 ORDER BY sort_order ASC");
    $faqs = $faqStmt->fetchAll();
} catch (Throwable $e) {}

// 8. Testimonials
$testimonials = [];
try {
    $testStmt = $db->query("SELECT * FROM landing_testimonials WHERE is_active = 1 ORDER BY sort_order ASC");
    $testimonials = $testStmt->fetchAll();
} catch (Throwable $e) {}

// 9. SEO Settings
$seo = [];
try {
    $seoStmt = $db->query("SELECT config_key, config_value FROM landing_seo");
    $seoRows = $seoStmt->fetchAll();
    foreach ($seoRows as $s) {
        $seo[$s['config_key']] = $s['config_value'];
    }
} catch (Throwable $e) {}

// 10. Inject Admin-Configured Desktop Releases & Download URLs
$config = [];
try {
    $config = getDesktopAppConfigMap();
} catch (Throwable $e) {}

$releases = [
    'windows' => [
        'url' => $config['win_download_url'] ?? 'https://releases.antiprofiles.com/AntiProfiles-Windows-x64.exe',
        'version' => $config['win_app_version'] ?? '2.0.0',
        'enabled' => ($config['win_enabled'] ?? 'true') !== 'false'
    ],
    'mac_intel' => [
        'url' => $config['mac_intel_download_url'] ?? $config['mac_download_url'] ?? 'https://releases.antiprofiles.com/AntiProfiles-macOS-Intel-x64.dmg',
        'version' => $config['mac_intel_app_version'] ?? '2.0.0',
        'enabled' => ($config['mac_intel_enabled'] ?? 'true') !== 'false'
    ],
    'mac_arm' => [
        'url' => $config['mac_arm_download_url'] ?? $config['mac_download_url'] ?? 'https://releases.antiprofiles.com/AntiProfiles-macOS-Apple-Silicon-arm64.dmg',
        'version' => $config['mac_arm_app_version'] ?? '2.0.0',
        'enabled' => ($config['mac_arm_enabled'] ?? 'true') !== 'false'
    ],
    'linux' => [
        'url' => $config['linux_download_url'] ?? 'https://releases.antiprofiles.com/AntiProfiles-Linux-x86_64.AppImage',
        'version' => $config['linux_app_version'] ?? '2.0.0',
        'enabled' => ($config['linux_enabled'] ?? 'true') !== 'false'
    ]
];

// 11. Global Trial Configuration for Dynamic Landing Badges & Buttons
$trialSettings = [
    'is_enabled' => false,
    'trial_duration_days' => 7,
    'default_plan_id' => 'plan_starter',
    'applies_to_packages' => 'all'
];
try {
    $tStmt = $db->query("SELECT * FROM global_trial_settings WHERE id = 'global_trial_config' LIMIT 1");
    if ($tStmt && $tRow = $tStmt->fetch()) {
        $trialSettings = [
            'is_enabled' => (bool)$tRow['is_enabled'],
            'trial_duration_days' => max(1, (int)($tRow['trial_duration_days'] ?? 7)),
            'default_plan_id' => $tRow['default_plan_id'] ?? 'plan_starter',
            'applies_to_packages' => $tRow['applies_to_packages'] ?? 'all'
        ];
    }
} catch (Throwable $e) {}

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
        'releases' => $releases,
        'trial_settings' => $trialSettings
    ]
]);
