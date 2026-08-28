<?php
// ──────────────────────────────────────────────
// AntiProfiles — Dynamic Affiliate Offer Landing Page Generator
// Supports All Pricing Plans: Free ($0), Starter ($19), Professional ($49), Business ($99)
// Route: /offer/{slug} e.g. /offer/starter, /offer/professional, /offer/business, /offer/free
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$db = getDbConnection();
ensureDatabaseTablesExist();

// Capture & record click if not already captured
$trackData = captureAndRecordAffiliateClick($db);

// Resolve Slug from URL or query
$slug = trim($_GET['slug'] ?? '');
if (empty($slug)) {
    $requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    if (preg_match('#^/offer/([^/?]+)#i', $requestUri, $matches)) {
        $slug = trim($matches[1]);
    }
}
if (empty($slug)) {
    $slug = 'professional';
}

// Fetch Landing Page from Database
$landingPage = null;
try {
    $stmt = $db->prepare("SELECT * FROM affiliate_landing_pages WHERE slug = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$slug]);
    $landingPage = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (Throwable $e) {}

if (!$landingPage) {
    // Fallback search by package name / offer ID
    try {
        $stmt = $db->prepare("SELECT * FROM affiliate_landing_pages WHERE slug LIKE ? AND is_active = 1 LIMIT 1");
        $stmt->execute(['%' . $slug . '%']);
        $landingPage = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {}
}

if (!$landingPage) {
    try {
        $stmt = $db->prepare("SELECT * FROM affiliate_landing_pages WHERE slug = 'professional' LIMIT 1");
        $stmt->execute();
        $landingPage = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {}
}

// Resolve associated Offer
$offer = null;
if ($landingPage && !empty($landingPage['offer_id'])) {
    try {
        $stOff = $db->prepare("SELECT * FROM affiliate_offers WHERE id = ? LIMIT 1");
        $stOff->execute([$landingPage['offer_id']]);
        $offer = $stOff->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {}
}

// All Pricing Plans Catalog
$allPlansCatalog = [
    'plan_free' => [
        'id' => 'plan_free',
        'slug' => 'free',
        'offer_id' => 'offer_free',
        'name' => 'Free',
        'badge' => 'FREE',
        'price' => 0.00,
        'original_price' => 0.00,
        'cta' => 'Start Free',
        'profiles' => '3 Profiles',
        'proxy' => 'Basic Proxy Support',
        'fingerprint' => 'Standard Controls',
        'users' => '1 User',
        'api' => 'Not Included',
        'support' => 'Community Support',
        'features' => [
            '3 Stealth Browser Profiles',
            'Basic Proxy Support (HTTP)',
            'Standard Fingerprint Controls',
            '1 Team User Seat',
            'No API Access',
            'Community Forum Support'
        ]
    ],
    'plan_starter' => [
        'id' => 'plan_starter',
        'slug' => 'starter',
        'offer_id' => 'offer_starter',
        'name' => 'Starter',
        'badge' => 'Starter',
        'price' => 19.00,
        'original_price' => 19.00,
        'cta' => 'Subscribe Starter',
        'profiles' => '25 Profiles',
        'proxy' => 'HTTP / HTTPS / SOCKS',
        'fingerprint' => 'Advanced Fingerprints',
        'users' => '2 Users',
        'api' => 'Basic API Access',
        'support' => 'Email Support',
        'features' => [
            '25 Isolated Browser Profiles',
            'HTTP / HTTPS / SOCKS Proxy Support',
            'Advanced Fingerprint Controls',
            '2 Team Workspace Users',
            'Basic REST API Access',
            'Standard Email Support'
        ]
    ],
    'plan_pro' => [
        'id' => 'plan_pro',
        'slug' => 'professional',
        'offer_id' => 'offer_main_saas',
        'name' => 'Professional',
        'badge' => 'MOST POPULAR',
        'price' => 49.00,
        'original_price' => 49.00,
        'cta' => 'Subscribe Professional',
        'profiles' => '100 Profiles',
        'proxy' => 'HTTP / HTTPS / SOCKS5',
        'fingerprint' => 'Advanced Controls & Spoofing',
        'users' => '10 Users',
        'api' => 'Full REST API + Driver API',
        'support' => 'Priority 24/7 Support',
        'features' => [
            '100 Isolated Browser Profiles',
            'HTTP / HTTPS / SOCKS5 Proxy Support',
            'Advanced Fingerprint Controls',
            '10 Team Workspace Users',
            'Full REST API + Driver API',
            'Priority 24/7 Live Agent Support'
        ]
    ],
    'plan_business' => [
        'id' => 'plan_business',
        'slug' => 'business',
        'offer_id' => 'offer_business',
        'name' => 'Business',
        'badge' => 'BEST VALUE',
        'price' => 99.00,
        'original_price' => 149.00,
        'cta' => 'Subscribe Business',
        'profiles' => '500 Profiles',
        'proxy' => 'HTTP / HTTPS / SOCKS5',
        'fingerprint' => 'Full Hardware Spoofing',
        'users' => '25 Users',
        'api' => 'Unlimited API Access',
        'support' => 'Dedicated Account Manager',
        'features' => [
            '500 Isolated Browser Profiles',
            'HTTP / HTTPS / SOCKS5 Proxy Support',
            'Full Hardware Spoofing (Canvas, WebGL, Audio)',
            '25 Team Workspace Users',
            'Unlimited REST & Driver API Concurrency',
            'Dedicated Account Manager'
        ]
    ]
];

// Merge latest dynamic database pricing into catalog
try {
    $dbPages = $db->query("SELECT * FROM affiliate_landing_pages WHERE is_active = 1")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($dbPages as $dp) {
        $pid = $dp['package_id'] ?? '';
        if (isset($allPlansCatalog[$pid])) {
            $allPlansCatalog[$pid]['price'] = (float)$dp['price_monthly'];
            $allPlansCatalog[$pid]['original_price'] = (float)($dp['original_price'] ?? $dp['price_monthly']);
            if (!empty($dp['badge_text'])) $allPlansCatalog[$pid]['badge'] = $dp['badge_text'];
            if (!empty($dp['cta_text'])) $allPlansCatalog[$pid]['cta'] = $dp['cta_text'];
        }
    }
} catch (Throwable $e) {}

// Active Selected Plan Data
$packageId = $landingPage['package_id'] ?? 'plan_pro';
$packageName = $landingPage['package_name'] ?? ($allPlansCatalog[$packageId]['name'] ?? 'Professional');
$heroTitle = $landingPage['hero_title'] ?? ('AntiProfiles ' . $packageName . ' — Scale Multi-Accounting with Zero Detection');
$heroSubtitle = $landingPage['hero_subtitle'] ?? 'Deploy isolated browser profiles with genuine hardware masking and proxy routing.';
$priceMonthly = (float)($landingPage['price_monthly'] ?? ($allPlansCatalog[$packageId]['price'] ?? 49.00));
$originalPrice = (float)($landingPage['original_price'] ?? ($allPlansCatalog[$packageId]['original_price'] ?? $priceMonthly));

// Auto-Calculate Discount % Formula: ((Old Price - New Price) / Old Price) * 100
$discountPercent = 0;
if ($originalPrice > $priceMonthly && $originalPrice > 0) {
    $discountPercent = (int)round((($originalPrice - $priceMonthly) / $originalPrice) * 100);
}

// Trial Enabled Logic: Trial is only enabled if Admin explicitly set trial_enabled = 1
$trialEnabled = (int)($landingPage['trial_enabled'] ?? ($offer['trial_enabled'] ?? 0));

// Resolve Dynamic CTA Text
if ($trialEnabled === 1) {
    $ctaText = 'Start 7-Day Free Trial';
} else if ($packageId === 'plan_free' || $priceMonthly == 0) {
    $ctaText = 'Start Free';
} else if ($packageId === 'plan_starter') {
    $ctaText = 'Subscribe Starter';
} else if ($packageId === 'plan_business') {
    $ctaText = 'Subscribe Business';
} else {
    $ctaText = 'Subscribe Professional';
}
if (!empty($landingPage['cta_text']) && strpos($landingPage['cta_text'], 'Trial') === false) {
    $ctaText = $landingPage['cta_text'];
}

$badgeText = $landingPage['badge_text'] ?? ($allPlansCatalog[$packageId]['badge'] ?? 'MOST POPULAR');
$offerId = $landingPage['offer_id'] ?? ($offer['id'] ?? 'offer_main_saas');

// Attribution & Tracking Parameters
$affId = $_GET['aff'] ?? $_GET['aff_id'] ?? $_COOKIE['aff_id'] ?? ($trackData['aff_id'] ?? '');
$clickId = $_GET['click_id'] ?? $_COOKIE['click_id'] ?? ($trackData['click_id'] ?? ('CLK_' . date('Ymd') . '_' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8))));
$subId1 = $_GET['subid1'] ?? $_GET['sub_id1'] ?? $_COOKIE['sub_id1'] ?? '';
$subId2 = $_GET['subid2'] ?? $_GET['sub_id2'] ?? $_COOKIE['sub_id2'] ?? '';
$utmSource = $_GET['utm_source'] ?? $_COOKIE['utm_source'] ?? '';
$utmCampaign = $_GET['utm_campaign'] ?? $_COOKIE['utm_campaign'] ?? '';
$utmMedium = $_GET['utm_medium'] ?? $_COOKIE['utm_medium'] ?? '';

// Build preserved query string for plan switcher
$preservedQueryParams = http_build_query(array_filter([
    'aff' => $affId,
    'click_id' => $clickId,
    'sub_id1' => $subId1,
    'sub_id2' => $subId2,
    'utm_source' => $utmSource,
    'utm_campaign' => $utmCampaign,
    'utm_medium' => $utmMedium
]));

// Decode Features, FAQ & Reviews
$features = json_decode($landingPage['features_json'] ?? '[]', true) ?: ($allPlansCatalog[$packageId]['features'] ?? [
    'Isolated Browser Profiles',
    'Hardware-Level Fingerprint Protection',
    'HTTP/HTTPS/SOCKS5 Proxy Support',
    'Multi-User Team Workspace',
    'Automated REST & Driver API'
]);
$faqs = json_decode($landingPage['faq_json'] ?? '[]', true) ?: [
    ['q' => 'How does AntiProfiles isolate browser environments?', 'a' => 'Each profile operates in a separate sandbox with genuine spoofed Canvas, WebGL, AudioContext, hardware concurrency, and client rects.'],
    ['q' => 'Can I switch or upgrade my package later?', 'a' => 'Yes, you can upgrade, downgrade, or switch between plans at any time directly from your dashboard without losing any profiles or cookies.'],
    ['q' => 'Does AntiProfiles support proxy rotation and auto-reconnect?', 'a' => 'Yes, you can bind residential, mobile, and datacenter proxies with automatic IP rotation, health check, and country geolocation matching.']
];
$reviews = json_decode($landingPage['reviews_json'] ?? '[]', true) ?: [
    ['name' => 'Alexandre R.', 'role' => 'Performance Media Buyer', 'comment' => 'AntiProfiles has replaced all other antidetect tools for our team. Zero checkpoint bans and flawless fingerprint consistency.'],
    ['name' => 'Sarah K.', 'role' => 'E-Commerce Growth Manager', 'comment' => 'Managing 40+ Amazon and eBay seller accounts seamlessly. The best antidetect software on the market.']
];
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title><?= htmlspecialchars($landingPage['seo_title'] ?? ('AntiProfiles ' . $packageName . ' Plan | High-Performance Antidetect Browser')) ?></title>
    <meta name="description" content="<?= htmlspecialchars($landingPage['meta_desc'] ?? $heroSubtitle) ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        heading: ['Outfit', 'sans-serif']
                    }
                }
            }
        }
    </script>
    <style>
        html, body {
            background-color: #070B14 !important;
            background-image: 
                radial-gradient(at 50% 0%, rgba(45, 212, 191, 0.14) 0px, transparent 60%),
                radial-gradient(at 100% 100%, rgba(56, 189, 248, 0.08) 0px, transparent 50%),
                radial-gradient(at 0% 50%, rgba(99, 102, 241, 0.06) 0px, transparent 50%) !important;
            background-attachment: fixed !important;
            color: #F8FAFC !important;
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            min-height: 100vh;
        }
        .text-glow {
            text-shadow: 0 0 35px rgba(45, 212, 191, 0.3);
        }
        .glass-panel {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .glass-panel:hover {
            border-color: rgba(45, 212, 191, 0.4);
        }
        .glass-card-active {
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #2DD4BF !important;
            box-shadow: 0 0 40px -10px rgba(45, 212, 191, 0.4);
        }
        .btn-glow {
            box-shadow: 0 0 25px -5px rgba(45, 212, 191, 0.5);
        }
        .btn-glow:hover {
            box-shadow: 0 0 35px 0px rgba(45, 212, 191, 0.7);
        }
    </style>
</head>
<body class="min-h-screen flex flex-col antialiased text-slate-100 selection:bg-teal-400 selection:text-slate-950">

    <!-- Header Navigation -->
    <header class="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
            <a href="/" class="flex items-center gap-3 group">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/25 font-black text-slate-950 text-xl font-heading group-hover:scale-105 transition-transform">
                    A
                </div>
                <div class="flex flex-col">
                    <span class="text-xl font-extrabold font-heading tracking-tight text-white group-hover:text-teal-300 transition-colors">AntiProfiles</span>
                    <span class="text-[10px] uppercase font-bold tracking-widest text-teal-400 -mt-1">Antidetect Browser</span>
                </div>
            </a>

            <div class="flex items-center gap-3 sm:gap-5">
                <a href="#all-pricing" class="text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors hidden sm:inline-block">All Pricing Plans</a>
                <a href="/login" class="text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Sign In</a>
                <button onclick="openOfferRegistrationModal()" class="px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 hover:from-teal-300 hover:to-cyan-300 transition-all shadow-lg shadow-teal-500/20 active:scale-95">
                    <?= htmlspecialchars($ctaText) ?>
                </button>
            </div>
        </div>
    </header>

    <!-- Main Dynamic Hero Section -->
    <main class="flex-grow">
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-16 text-center">
            
            <!-- Offer Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 mb-6 sm:mb-8 shadow-lg shadow-teal-500/10">
                <span><?= htmlspecialchars($badgeText) ?></span>
            </div>

            <!-- Hero Headline -->
            <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black font-heading text-white tracking-tight leading-[1.15] max-w-4xl mx-auto mb-6 text-glow">
                <?= htmlspecialchars($heroTitle) ?>
            </h1>

            <!-- Hero Subtitle -->
            <p class="text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto mb-10 sm:mb-14 leading-relaxed font-normal">
                <?= htmlspecialchars($heroSubtitle) ?>
            </p>

            <!-- Dynamic Selected Package Hero Card -->
            <div class="max-w-lg mx-auto glass-card-active rounded-3xl p-6 sm:p-10 relative mb-12 sm:mb-16 text-left">
                <div class="absolute -top-3.5 right-6 sm:right-8 px-3.5 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 uppercase tracking-wider shadow-md">
                    <?= htmlspecialchars($packageName) ?> PLAN
                </div>

                <div class="text-center pb-6 border-b border-slate-800">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Official Package Pricing</span>
                    <div class="flex items-baseline justify-center gap-2">
                        <?php if ($discountPercent > 0 && $originalPrice > $priceMonthly): ?>
                            <span class="text-2xl text-slate-500 line-through font-semibold">$<?= number_format($originalPrice, 2) ?></span>
                        <?php endif; ?>
                        <span class="text-5xl sm:text-6xl font-black text-white font-heading tracking-tight">
                            $<?= $priceMonthly == 0 ? '0' : number_format($priceMonthly, 2) ?>
                        </span>
                        <span class="text-slate-400 font-semibold text-base">/month</span>
                    </div>
                    <?php if ($discountPercent > 0): ?>
                        <span class="inline-block mt-2 text-xs font-extrabold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/40">
                            ⚡ Save <?= $discountPercent ?>% Special Promotion
                        </span>
                    <?php elseif ($priceMonthly == 0): ?>
                        <span class="inline-block mt-2 text-xs font-extrabold text-teal-300 bg-teal-500/20 px-3 py-1 rounded-full border border-teal-500/40">
                            ✓ 100% Free Forever
                        </span>
                    <?php endif; ?>
                </div>

                <!-- Features Checklist -->
                <div class="py-6 border-b border-slate-800">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">Included In <?= htmlspecialchars($packageName) ?>:</span>
                    <ul class="space-y-3.5 text-sm sm:text-base text-slate-200">
                        <?php foreach ($features as $feat): ?>
                            <li class="flex items-start gap-3">
                                <div class="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5 border border-teal-500/40">
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                                    </svg>
                                </div>
                                <span class="font-medium text-slate-200"><?= htmlspecialchars($feat) ?></span>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>

                <!-- OS Smart Detection & Dedicated CTA -->
                <div class="pt-6 space-y-3.5">
                    <button id="primary-cta-btn" onclick="openOfferRegistrationModal()" class="w-full py-4 sm:py-4.5 rounded-2xl font-extrabold text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:to-cyan-200 transition-all btn-glow flex items-center justify-center gap-2.5 text-base sm:text-lg active:scale-[0.98]">
                        <span id="cta-label"><?= htmlspecialchars($ctaText) ?></span>
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                    </button>

                    <!-- Auto-Detected System Architecture -->
                    <div id="os-detect-badge" class="text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-2 pt-1 font-medium">
                        <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span id="detected-os-text">Detecting your system architecture...</span>
                    </div>
                </div>
            </div>

            <!-- Trust Highlights Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-2 text-slate-300 text-xs sm:text-sm font-semibold">
                <div class="glass-panel p-4 rounded-2xl flex items-center justify-center gap-2.5">
                    <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    <span>100% Anti-Ban Protection</span>
                </div>
                <div class="glass-panel p-4 rounded-2xl flex items-center justify-center gap-2.5">
                    <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    <span>Hardware Spoofing</span>
                </div>
                <div class="glass-panel p-4 rounded-2xl flex items-center justify-center gap-2.5">
                    <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Instant Cloud Sync</span>
                </div>
                <div class="glass-panel p-4 rounded-2xl flex items-center justify-center gap-2.5">
                    <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    <span>Windows / Mac / Linux</span>
                </div>
            </div>
        </section>

        <!-- Complete 4-Package Pricing Cards Section -->
        <section id="all-pricing" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-slate-800/80">
            <div class="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                <span class="text-xs font-bold text-teal-400 uppercase tracking-widest block mb-2">FLEXIBLE SCALING FOR EVERY STAGE</span>
                <h2 class="text-3xl sm:text-4xl font-extrabold font-heading text-white tracking-tight">
                    Choose Your AntiProfiles Plan
                </h2>
                <p class="text-slate-300 text-sm sm:text-base mt-3">
                    Switch between any of our 4 official pricing plans while preserving your affiliate attribution and discounts.
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <?php foreach ($allPlansCatalog as $pKey => $p): 
                    $isActiveCard = ($pKey === $packageId);
                    $pOrig = $p['original_price'];
                    $pCur = $p['price'];
                    $pDisc = ($pOrig > $pCur && $pOrig > 0) ? (int)round((($pOrig - $pCur) / $pOrig) * 100) : 0;
                    $switchUrl = '/offer/' . $p['slug'] . ($preservedQueryParams ? '?' . $preservedQueryParams : '');
                ?>
                    <div class="rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 <?= $isActiveCard ? 'glass-card-active relative -translate-y-1' : 'glass-panel hover:-translate-y-1 border border-slate-800' ?>">
                        <?php if ($isActiveCard): ?>
                            <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-400 text-slate-950 shadow-md">
                                CURRENT SELECTION
                            </div>
                        <?php endif; ?>

                        <div>
                            <!-- Header & Badge -->
                            <div class="flex items-center justify-between mb-4">
                                <span class="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg <?= $isActiveCard ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-slate-800 text-slate-300' ?>">
                                    <?= htmlspecialchars($p['badge']) ?>
                                </span>
                                <?php if ($pDisc > 0): ?>
                                    <span class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                        Save <?= $pDisc ?>%
                                    </span>
                                <?php endif; ?>
                            </div>

                            <h3 class="text-2xl font-black font-heading text-white mb-2"><?= htmlspecialchars($p['name']) ?></h3>

                            <!-- Price Display -->
                            <div class="flex items-baseline gap-2 mb-6 pb-6 border-b border-slate-800">
                                <?php if ($pDisc > 0): ?>
                                    <span class="text-lg text-slate-500 line-through font-semibold">$<?= number_format($pOrig, 0) ?></span>
                                <?php endif; ?>
                                <span class="text-4xl font-extrabold text-white font-heading tracking-tight">
                                    $<?= $pCur == 0 ? '0' : number_format($pCur, 0) ?>
                                </span>
                                <span class="text-slate-400 text-xs font-semibold">/month</span>
                            </div>

                            <!-- Specs Checklist -->
                            <div class="space-y-3 mb-8 text-xs sm:text-sm text-slate-300">
                                <div class="flex items-center gap-2.5">
                                    <span class="text-teal-400 font-bold">✓</span>
                                    <span class="text-white font-semibold"><?= htmlspecialchars($p['profiles']) ?></span>
                                </div>
                                <div class="flex items-center gap-2.5">
                                    <span class="text-teal-400 font-bold">✓</span>
                                    <span>Proxy: <?= htmlspecialchars($p['proxy']) ?></span>
                                </div>
                                <div class="flex items-center gap-2.5">
                                    <span class="text-teal-400 font-bold">✓</span>
                                    <span>Fingerprint: <?= htmlspecialchars($p['fingerprint']) ?></span>
                                </div>
                                <div class="flex items-center gap-2.5">
                                    <span class="text-teal-400 font-bold">✓</span>
                                    <span>Team: <?= htmlspecialchars($p['users']) ?></span>
                                </div>
                                <div class="flex items-center gap-2.5">
                                    <span class="text-teal-400 font-bold">✓</span>
                                    <span>API: <?= htmlspecialchars($p['api']) ?></span>
                                </div>
                                <div class="flex items-center gap-2.5">
                                    <span class="text-teal-400 font-bold">✓</span>
                                    <span>Support: <?= htmlspecialchars($p['support']) ?></span>
                                </div>
                            </div>
                        </div>

                        <!-- Card CTA Button -->
                        <div>
                            <?php if ($isActiveCard): ?>
                                <button onclick="openOfferRegistrationModal()" class="w-full py-3.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 transition-all btn-glow text-sm active:scale-95">
                                    <?= htmlspecialchars($ctaText) ?>
                                </button>
                            <?php else: ?>
                                <a href="<?= htmlspecialchars($switchUrl) ?>" class="w-full py-3.5 rounded-xl font-bold text-slate-200 bg-slate-800/90 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all text-sm block text-center active:scale-95">
                                    <?= htmlspecialchars($p['cta']) ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- Testimonials Section -->
        <?php if (!empty($reviews)): ?>
        <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-slate-800/80">
            <h2 class="text-2xl sm:text-3xl font-extrabold font-heading text-center text-white mb-8 sm:mb-12">
                Trusted by Top Media Buyers & Automation Agencies
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <?php foreach ($reviews as $rev): ?>
                    <div class="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800">
                        <div class="flex items-center gap-1 text-amber-400 mb-4 text-base">
                            ★★★★★
                        </div>
                        <p class="text-slate-200 text-sm sm:text-base italic mb-6 leading-relaxed">
                            "<?= htmlspecialchars($rev['comment']) ?>"
                        </p>
                        <div class="flex items-center gap-3.5">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-cyan-500 text-slate-950 flex items-center justify-center font-black text-sm">
                                <?= strtoupper(substr($rev['name'], 0, 1)) ?>
                            </div>
                            <div>
                                <h4 class="text-sm sm:text-base font-bold text-white"><?= htmlspecialchars($rev['name']) ?></h4>
                                <span class="text-xs text-slate-400"><?= htmlspecialchars($rev['role']) ?></span>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- FAQ Section -->
        <?php if (!empty($faqs)): ?>
        <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-slate-800/80">
            <h2 class="text-2xl sm:text-3xl font-extrabold font-heading text-center text-white mb-8 sm:mb-12">
                Frequently Asked Questions
            </h2>
            <div class="space-y-4">
                <?php foreach ($faqs as $faq): ?>
                    <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800/80 text-left">
                        <h3 class="text-base sm:text-lg font-bold text-white mb-2.5">
                            <?= htmlspecialchars($faq['q']) ?>
                        </h3>
                        <p class="text-sm sm:text-base text-slate-300 leading-relaxed">
                            <?= htmlspecialchars($faq['a']) ?>
                        </p>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>
    </main>

    <!-- Footer -->
    <footer class="glass-panel border-t border-slate-800/90 py-8 sm:py-12 text-center text-xs sm:text-sm text-slate-400 mt-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div class="flex items-center gap-3">
                <div class="w-6 h-6 rounded-lg bg-teal-400 text-slate-950 font-black flex items-center justify-center text-xs">A</div>
                <span>&copy; <?= date('Y') ?> AntiProfiles Inc. All rights reserved.</span>
            </div>
            <div class="flex items-center gap-6 font-medium">
                <a href="/privacy" class="hover:text-teal-300 transition-colors">Privacy Policy</a>
                <a href="/terms" class="hover:text-teal-300 transition-colors">Terms of Service</a>
                <a href="/support" class="hover:text-teal-300 transition-colors">Help & Support</a>
            </div>
        </div>
    </footer>

    <!-- Interactive Registration / Checkout Modal -->
    <div id="offer-reg-modal" class="fixed inset-0 z-50 hidden bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
        <div class="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-8 border-2 border-teal-500/40 shadow-2xl relative">
            <button onclick="closeOfferRegistrationModal()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-xl font-bold p-1 transition-colors">✕</button>
            
            <div class="text-center mb-6">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-300 border border-teal-500/30 mb-3 shadow-md">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                </div>
                <h3 class="text-2xl font-black font-heading text-white">
                    <?= $trialEnabled === 1 ? 'Start 7-Day Free Trial' : ($priceMonthly == 0 ? 'Create Free Account' : ('Subscribe ' . htmlspecialchars($packageName))) ?>
                </h3>
                <p class="text-sm text-slate-300 mt-1">
                    Package: <strong class="text-teal-300 font-bold"><?= htmlspecialchars($packageName) ?></strong> 
                    (<?= $priceMonthly == 0 ? '$0 Free' : ('$' . number_format($priceMonthly, 2) . '/mo') ?>)
                </p>
            </div>

            <form id="offer-signup-form" onsubmit="handleOfferSignup(event)" class="space-y-4">
                <input type="hidden" name="affiliate_id" value="<?= htmlspecialchars($affId) ?>">
                <input type="hidden" name="click_id" value="<?= htmlspecialchars($clickId) ?>">
                <input type="hidden" name="offer_id" value="<?= htmlspecialchars($offerId) ?>">
                <input type="hidden" name="package_id" value="<?= htmlspecialchars($packageId) ?>">
                <input type="hidden" name="landing_page_slug" value="<?= htmlspecialchars($slug) ?>">

                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Full Name</label>
                    <input type="text" name="name" required placeholder="Alex Turner" class="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 transition-colors">
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Email Address</label>
                    <input type="email" name="email" required placeholder="alex@agency.com" class="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 transition-colors">
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Password</label>
                    <input type="password" name="password" required minlength="6" placeholder="••••••••" class="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 transition-colors">
                </div>

                <div id="signup-error-msg" class="hidden p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium"></div>
                <div id="signup-success-msg" class="hidden p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium"></div>

                <button type="submit" id="submit-signup-btn" class="w-full py-4 rounded-xl font-extrabold text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 transition-all btn-glow text-base active:scale-[0.98]">
                    <?= htmlspecialchars($ctaText) ?>
                </button>
            </form>
        </div>
    </div>

    <!-- Client-Side OS Detection & Modal Logic -->
    <script>
        const AFF_ID = <?= json_encode($affId) ?>;
        const CLICK_ID = <?= json_encode($clickId) ?>;
        const OFFER_ID = <?= json_encode($offerId) ?>;
        const PACKAGE_ID = <?= json_encode($packageId) ?>;
        const SLUG = <?= json_encode($slug) ?>;

        function detectUserOS() {
            const userAgent = window.navigator.userAgent || '';
            const platform = window.navigator.platform || '';
            let osName = 'Windows';
            let archName = 'x64';

            if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(userAgent) || /Mac/i.test(platform)) {
                osName = 'macOS';
                const isAppleSilicon = userAgent.includes('ARM64') || (window.navigator.userAgentData && window.navigator.userAgentData.architecture === 'arm');
                if (isAppleSilicon) {
                    archName = 'Apple Silicon (ARM64)';
                } else {
                    archName = 'Intel x86_64';
                }
            } else if (/Win32|Win64|Windows|WinCE/i.test(userAgent) || /Win/i.test(platform)) {
                osName = 'Windows';
                archName = 'x64';
            } else if (/Linux/i.test(userAgent) || /Linux/i.test(platform)) {
                osName = 'Linux';
                archName = '.AppImage / .deb';
            }

            const osBadge = document.getElementById('detected-os-text');
            if (osBadge) {
                osBadge.textContent = `Optimized for ${osName} (${archName})`;
            }
        }

        function openOfferRegistrationModal() {
            const modal = document.getElementById('offer-reg-modal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeOfferRegistrationModal() {
            const modal = document.getElementById('offer-reg-modal');
            if (modal) modal.classList.add('hidden');
        }

        async function handleOfferSignup(e) {
            e.preventDefault();
            const form = e.target;
            const errorDiv = document.getElementById('signup-error-msg');
            const successDiv = document.getElementById('signup-success-msg');
            const submitBtn = document.getElementById('submit-signup-btn');

            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            const payload = {
                action: 'register',
                name: form.name.value.trim(),
                email: form.email.value.trim(),
                password: form.password.value,
                affiliate_id: AFF_ID,
                referred_by_affiliate_id: AFF_ID,
                referred_by_click_id: CLICK_ID,
                referred_by_offer_id: OFFER_ID,
                referred_by_package_id: PACKAGE_ID,
                landing_page_slug: SLUG
            };

            try {
                const res = await fetch('/api/auth.php?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json().catch(() => null);

                if (data && data.success) {
                    if (data.requiresVerification) {
                        successDiv.textContent = data.message || 'Account created! Please check your email inbox to verify your account.';
                        successDiv.classList.remove('hidden');
                        setTimeout(() => {
                            window.location.href = '/verify-email?email=' + encodeURIComponent(form.email.value.trim());
                        }, 2000);
                    } else {
                        successDiv.textContent = 'Account created successfully! Redirecting to your dashboard...';
                        successDiv.classList.remove('hidden');
                        if (data.sessionToken || data.token) {
                            localStorage.setItem('sessionToken', data.sessionToken || data.token);
                            if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
                        }
                        setTimeout(() => {
                            window.location.href = '/?welcome=1&plan=' + encodeURIComponent(PACKAGE_ID);
                        }, 1200);
                    }
                } else {
                    errorDiv.textContent = (data && data.error) ? data.error : 'Failed to create account. Please check your details and try again.';
                    errorDiv.classList.remove('hidden');
                    submitBtn.disabled = false;
                    submitBtn.textContent = <?= json_encode($ctaText) ?>;
                }
            } catch (err) {
                errorDiv.textContent = 'Network or server error (' + (err.message || 'Unknown') + '). Please try again.';
                errorDiv.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = <?= json_encode($ctaText) ?>;
            }
        }

        document.addEventListener('DOMContentLoaded', detectUserOS);
    </script>
</body>
</html>
