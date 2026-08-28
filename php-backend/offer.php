<?php
// ──────────────────────────────────────────────
// AntiProfiles — Dynamic Affiliate Offer Landing Page Generator
// Route: /offer/{slug} e.g. /offer/starter, /offer/professional, /offer/starter-license
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
    // Fallback to professional
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

$packageName = $landingPage['package_name'] ?? 'Professional';
$heroTitle = $landingPage['hero_title'] ?? 'AntiProfiles — Scale Multi-Accounting with Zero Detection';
$heroSubtitle = $landingPage['hero_subtitle'] ?? 'Deploy isolated browser profiles with genuine hardware masking and proxy routing.';
$priceMonthly = (float)($landingPage['price_monthly'] ?? 49.00);
$priceYearly = (float)($landingPage['price_yearly'] ?? ($priceMonthly * 10));
$originalPrice = (float)($landingPage['original_price'] ?? $priceMonthly);
$discountPercent = (float)($landingPage['discount_percent'] ?? 0.00);
$badgeText = $landingPage['badge_text'] ?? '🔥 MOST POPULAR • 50% Recurring Commission';
$ctaText = $landingPage['cta_text'] ?? 'Start 7-Day Free Trial';
$themeColor = $landingPage['theme_color'] ?? '#2DD4BF';
$packageId = $landingPage['package_id'] ?? 'plan_pro';
$offerId = $landingPage['offer_id'] ?? ($offer['id'] ?? 'offer_main_saas');

// Attribution Parameters
$affId = $_GET['aff'] ?? $_GET['aff_id'] ?? $_COOKIE['aff_id'] ?? ($trackData['aff_id'] ?? '');
$clickId = $_GET['click_id'] ?? $_COOKIE['click_id'] ?? ($trackData['click_id'] ?? ('CLK_' . date('Ymd') . '_' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8))));
$subId1 = $_GET['subid1'] ?? $_GET['sub_id1'] ?? $_COOKIE['sub_id1'] ?? '';

// Decode Features, FAQ & Reviews
$features = json_decode($landingPage['features_json'] ?? '[]', true) ?: [
    'Unlimited Stealth Browser Profiles',
    'Hardware-Level Fingerprint Protection',
    'HTTP/HTTPS/SOCKS5 Proxy Support',
    'Multi-User Team Workspace',
    'Automated REST & Driver API',
    '7-Day Risk-Free Trial'
];
$faqs = json_decode($landingPage['faq_json'] ?? '[]', true) ?: [
    ['q' => 'How does AntiProfiles isolate browser environments?', 'a' => 'Each profile operates in a separate sandbox with spoofed Canvas, WebGL, AudioContext, fonts, and client rects.'],
    ['q' => 'Can I test AntiProfiles before paying?', 'a' => 'Yes, every new account includes a 7-day free trial with full feature access.']
];
$reviews = json_decode($landingPage['reviews_json'] ?? '[]', true) ?: [
    ['name' => 'Alexandre R.', 'role' => 'Performance Media Buyer', 'comment' => 'AntiProfiles has replaced all other antidetect browsers for our team. Flawless fingerprint consistency.']
];

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
$currentUrl = "$scheme://$host" . ($_SERVER['REQUEST_URI'] ?? '');
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($landingPage['seo_title'] ?? ($packageName . ' — AntiProfiles Antidetect Browser')) ?></title>
    <meta name="description" content="<?= htmlspecialchars($landingPage['meta_desc'] ?? $heroSubtitle) ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        heading: ['Outfit', 'sans-serif']
                    },
                    colors: {
                        brand: {
                            50: '#F0FDFA',
                            400: '<?= htmlspecialchars($themeColor) ?>',
                            500: '<?= htmlspecialchars($themeColor) ?>',
                            600: '#0D9488'
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #0B1120;
            color: #F8FAFC;
            font-family: 'Inter', sans-serif;
        }
        .glow-gradient {
            background: radial-gradient(circle at 50% -20%, rgba(45, 212, 191, 0.15), transparent 70%);
        }
        .glass-card {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .glass-card-hover:hover {
            border-color: rgba(45, 212, 191, 0.35);
            transform: translateY(-2px);
            box-shadow: 0 12px 30px -10px rgba(45, 212, 191, 0.15);
        }
    </style>
</head>
<body class="min-h-screen flex flex-col glow-gradient antialiased selection:bg-brand-500 selection:text-slate-900">

    <!-- Header Navigation -->
    <header class="sticky top-0 z-50 glass-card border-b border-slate-800/80">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a href="/" class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20 font-bold text-slate-950 text-xl font-heading">
                    A
                </div>
                <span class="text-xl font-bold font-heading tracking-tight text-white">AntiProfiles</span>
            </a>

            <div class="flex items-center gap-4">
                <a href="/login" class="text-sm font-medium text-slate-300 hover:text-white transition">Sign In</a>
                <button onclick="openOfferRegistrationModal()" class="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-slate-950 hover:bg-brand-400 transition shadow-lg shadow-brand-500/20">
                    Get Started Free
                </button>
            </div>
        </div>
    </header>

    <!-- Main Dynamic Hero Section -->
    <main class="flex-grow">
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 text-center">
            
            <!-- Offer Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-6 animate-pulse">
                <span><?= htmlspecialchars($badgeText) ?></span>
            </div>

            <!-- Hero Headline -->
            <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-heading text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6">
                <?= htmlspecialchars($heroTitle) ?>
            </h1>

            <!-- Hero Subtitle -->
            <p class="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
                <?= htmlspecialchars($heroSubtitle) ?>
            </p>

            <!-- Pricing & Call to Action Box -->
            <div class="max-w-md mx-auto glass-card rounded-2xl p-8 border-2 border-brand-500/30 shadow-2xl relative mb-12">
                <div class="absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-brand-500 to-cyan-400 text-slate-950 uppercase tracking-wider shadow">
                    <?= htmlspecialchars($packageName) ?>
                </div>

                <div class="text-center mb-6">
                    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Pricing Plan</span>
                    <div class="flex items-baseline justify-center gap-2">
                        <?php if ($discountPercent > 0 && $originalPrice > $priceMonthly): ?>
                            <span class="text-xl text-slate-500 line-through font-medium">$<?= number_format($originalPrice, 2) ?></span>
                        <?php endif; ?>
                        <span class="text-5xl font-extrabold text-white font-heading">$<?= number_format($priceMonthly, 2) ?></span>
                        <span class="text-slate-400 text-sm">/month</span>
                    </div>
                    <?php if ($discountPercent > 0): ?>
                        <span class="inline-block mt-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Save <?= (int)$discountPercent ?>% Special Promo
                        </span>
                    <?php endif; ?>
                </div>

                <!-- Features Checklist -->
                <ul class="space-y-3 text-left text-sm text-slate-300 mb-8 border-t border-b border-slate-800 py-6">
                    <?php foreach ($features as $feat): ?>
                        <li class="flex items-start gap-2.5">
                            <svg class="w-4 h-4 text-brand-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span><?= htmlspecialchars($feat) ?></span>
                        </li>
                    <?php endforeach; ?>
                </ul>

                <!-- OS Smart Detection Button -->
                <div class="space-y-3">
                    <button id="primary-cta-btn" onclick="openOfferRegistrationModal()" class="w-full py-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-brand-500 to-cyan-400 hover:from-brand-400 hover:to-cyan-300 transition shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 text-base">
                        <span id="cta-label"><?= htmlspecialchars($ctaText) ?></span>
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                    </button>

                    <!-- Auto-Detected Download Option -->
                    <div id="os-detect-badge" class="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span id="detected-os-text">Detecting your system architecture...</span>
                    </div>
                </div>
            </div>

            <!-- Trust Badges -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 text-slate-400 text-xs font-medium">
                <div class="glass-card p-3 rounded-xl flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    <span>100% Anti-Ban Guarantee</span>
                </div>
                <div class="glass-card p-3 rounded-xl flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    <span>Instant Cloud Sync</span>
                </div>
                <div class="glass-card p-3 rounded-xl flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>7-Day Full Trial</span>
                </div>
                <div class="glass-card p-3 rounded-xl flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    <span>Multi-Platform Desktop</span>
                </div>
            </div>
        </section>

        <!-- Testimonials Section -->
        <?php if (!empty($reviews)): ?>
        <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-800/60">
            <h2 class="text-2xl font-bold font-heading text-center text-white mb-8">Trusted by Global Automation & Affiliate Teams</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <?php foreach ($reviews as $rev): ?>
                    <div class="glass-card p-6 rounded-2xl border border-slate-800">
                        <div class="flex items-center gap-1 text-amber-400 mb-3">
                            ★★★★★
                        </div>
                        <p class="text-slate-300 text-sm italic mb-4 leading-relaxed">
                            "<?= htmlspecialchars($rev['comment']) ?>"
                        </p>
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                                <?= strtoupper(substr($rev['name'], 0, 1)) ?>
                            </div>
                            <div>
                                <h4 class="text-sm font-semibold text-white"><?= htmlspecialchars($rev['name']) ?></h4>
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
        <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/60">
            <h2 class="text-2xl sm:text-3xl font-bold font-heading text-center text-white mb-8">Frequently Asked Questions</h2>
            <div class="space-y-4">
                <?php foreach ($faqs as $idx => $faq): ?>
                    <div class="glass-card rounded-xl p-5 border border-slate-800">
                        <h3 class="text-base font-semibold text-white mb-2 flex items-center justify-between">
                            <span><?= htmlspecialchars($faq['q']) ?></span>
                        </h3>
                        <p class="text-sm text-slate-400 leading-relaxed">
                            <?= htmlspecialchars($faq['a']) ?>
                        </p>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>
    </main>

    <!-- Footer -->
    <footer class="glass-card border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span>&copy; <?= date('Y') ?> AntiProfiles Inc. All rights reserved.</span>
            <div class="flex items-center gap-6">
                <a href="/privacy" class="hover:text-slate-400 transition">Privacy Policy</a>
                <a href="/terms" class="hover:text-slate-400 transition">Terms of Service</a>
                <a href="/support" class="hover:text-slate-400 transition">Support</a>
            </div>
        </div>
    </footer>

    <!-- Interactive Registration / Free Trial Modal -->
    <div id="offer-reg-modal" class="fixed inset-0 z-50 hidden bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-md rounded-2xl p-6 sm:p-8 border border-brand-500/40 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onclick="closeOfferRegistrationModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold p-1">✕</button>
            
            <div class="text-center mb-6">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                </div>
                <h3 class="text-xl font-bold font-heading text-white">Start Your 7-Day Free Trial</h3>
                <p class="text-xs text-slate-400 mt-1">Package: <strong class="text-brand-400"><?= htmlspecialchars($packageName) ?></strong> ($<?= number_format($priceMonthly, 2) ?>/mo)</p>
            </div>

            <form id="offer-signup-form" onsubmit="handleOfferSignup(event)" class="space-y-4">
                <input type="hidden" name="affiliate_id" value="<?= htmlspecialchars($affId) ?>">
                <input type="hidden" name="click_id" value="<?= htmlspecialchars($clickId) ?>">
                <input type="hidden" name="offer_id" value="<?= htmlspecialchars($offerId) ?>">
                <input type="hidden" name="package_id" value="<?= htmlspecialchars($packageId) ?>">
                <input type="hidden" name="landing_page_slug" value="<?= htmlspecialchars($slug) ?>">

                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                    <input type="text" name="name" required placeholder="Alex Turner" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-400">
                </div>

                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                    <input type="email" name="email" required placeholder="alex@agency.com" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-400">
                </div>

                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">Password</label>
                    <input type="password" name="password" required minlength="6" placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-400">
                </div>

                <div id="signup-error-msg" class="hidden p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs"></div>
                <div id="signup-success-msg" class="hidden p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"></div>

                <button type="submit" id="submit-signup-btn" class="w-full py-3.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-brand-500 to-cyan-400 hover:from-brand-400 hover:to-cyan-300 transition shadow-lg shadow-brand-500/20 text-sm">
                    Activate 7-Day Free Account
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
            let downloadText = 'Download for Windows';

            if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(userAgent) || /Mac/i.test(platform)) {
                osName = 'macOS';
                // Detect Apple Silicon vs Intel
                const isAppleSilicon = userAgent.includes('ARM64') || (window.navigator.userAgentData && window.navigator.userAgentData.architecture === 'arm');
                if (isAppleSilicon) {
                    archName = 'Apple Silicon (M1/M2/M3/M4)';
                    downloadText = 'Download AntiProfiles for Apple Silicon';
                } else {
                    archName = 'Intel x86_64';
                    downloadText = 'Download AntiProfiles for macOS Intel';
                }
            } else if (/Win32|Win64|Windows|WinCE/i.test(userAgent) || /Win/i.test(platform)) {
                osName = 'Windows';
                downloadText = 'Download AntiProfiles for Windows (x64)';
            } else if (/Linux/i.test(userAgent) || /Linux/i.test(platform)) {
                osName = 'Linux';
                downloadText = 'Download AntiProfiles for Linux (.AppImage / .deb)';
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
            submitBtn.textContent = 'Creating your account...';

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
                const res = await fetch('/api/auth.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    successDiv.textContent = 'Account created successfully! Redirecting to your dashboard...';
                    successDiv.classList.remove('hidden');
                    if (data.token) {
                        localStorage.setItem('sessionToken', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user || {}));
                    }
                    setTimeout(() => {
                        window.location.href = '/?welcome=1&plan=' + encodeURIComponent(PACKAGE_ID);
                    }, 1200);
                } else {
                    errorDiv.textContent = data.error || 'Failed to create account. Please try again.';
                    errorDiv.classList.remove('hidden');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Activate 7-Day Free Account';
                }
            } catch (err) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Activate 7-Day Free Account';
            }
        }

        // Initialize OS detection on load
        document.addEventListener('DOMContentLoaded', detectUserOS);
    </script>
</body>
</html>
