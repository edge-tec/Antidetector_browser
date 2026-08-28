<?php
// ──────────────────────────────────────────────
// AntiProfiles — Dedicated Software Features Catalog & Showcase
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

header('Content-Type: text/html; charset=utf-8');

$pdo = getDbConnection();

// Load dynamic branding
$landingLogoUrl = '/brand-logo.png';
$landingFaviconUrl = '/favicon.ico';
try {
    if ($pdo) {
        $bStmt = $pdo->query("SELECT config_key, config_value FROM desktop_app_config WHERE config_key IN ('landing_logo_url', 'landing_favicon_url')");
        while ($b = $bStmt->fetch()) {
            if ($b['config_key'] === 'landing_logo_url' && !empty($b['config_value'])) {
                $landingLogoUrl = htmlspecialchars($b['config_value']);
            }
            if ($b['config_key'] === 'landing_favicon_url' && !empty($b['config_value'])) {
                $landingFaviconUrl = htmlspecialchars($b['config_value']);
            }
        }
    }
} catch (Throwable $e) {}

// Load dynamic features list
$allFeatures = [];
$featureCategories = [];
try {
    if ($pdo) {
        $allFeatures = getAllSoftwareFeatures($pdo, null, true);
        $featureCategories = getSoftwareFeatureCategories($pdo);
    }
} catch (Throwable $e) {
    $allFeatures = getDefaultSoftwareFeaturesList();
}
if (empty($allFeatures)) {
    $allFeatures = getDefaultSoftwareFeaturesList();
}

$catMeta = [
    'browser_profiles' => ['icon' => '🌐', 'name' => 'Browser Profiles & Lifecycle'],
    'fingerprint' => ['icon' => '🛡️', 'name' => 'Fingerprint Protection'],
    'proxy_network' => ['icon' => '🔌', 'name' => 'Proxy & Network'],
    'automation' => ['icon' => '🤖', 'name' => 'Automation & API'],
    'cookies_session' => ['icon' => '🍪', 'name' => 'Cookies & Sessions'],
    'team_collab' => ['icon' => '👥', 'name' => 'Team Collaboration'],
    'security_privacy' => ['icon' => '🔒', 'name' => 'Security & Privacy'],
    'sync_cloud' => ['icon' => '☁️', 'name' => 'Sync & Cloud'],
    'ai_tools' => ['icon' => '🧠', 'name' => 'AI & Smart Tools'],
    'extensions' => ['icon' => '🧩', 'name' => 'Extensions & Add-ons'],
    'system_performance' => ['icon' => '⚡', 'name' => 'Performance & Branding'],
    'desktop_client' => ['icon' => '💻', 'name' => 'Desktop Application']
];

// Count per category
$catCounts = [];
foreach ($allFeatures as $f) {
    $cKey = $f['category'] ?? 'other';
    $catCounts[$cKey] = ($catCounts[$cKey] ?? 0) + 1;
}

$activeCategory = strtolower($_GET['category'] ?? 'all');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All Features & Tools (52 Capabilities) — AntiProfiles Anti-Detect Browser</title>
    <meta name="description" content="Explore all 52 audited features of AntiProfiles: Canvas noise, WebGL masking, WebRTC leak shield, CDP Automation, SOCKS5 proxies, Cookie robot, Dual Chromium/Firefox engines, and Team RBAC.">
    <meta name="keywords" content="antidetect browser features, fingerprint protection, canvas noise, webrtc leak protection, puppeteer automation, playwright browser, multi accounting browser">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://antiprofiles.com/features">

    <!-- Open Graph / Social Sharing -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="All Features & Tools (52 Capabilities) — AntiProfiles Anti-Detect Browser">
    <meta property="og:description" content="Explore all 52 audited features of AntiProfiles: Canvas noise, WebGL masking, WebRTC leak shield, CDP Automation, SOCKS5 proxies, Cookie robot, and Team RBAC.">
    <meta property="og:url" content="https://antiprofiles.com/features">
    <meta property="og:image" content="/brand-logo.png">

    <!-- Twitter Meta -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="All Features & Tools (52 Capabilities) — AntiProfiles">
    <meta name="twitter:description" content="Explore all 52 audited features of AntiProfiles Anti-Detect Browser.">
    <meta name="twitter:image" content="/brand-logo.png">

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="32x32" href="<?php echo $landingFaviconUrl; ?>">
    <link rel="shortcut icon" type="image/x-icon" href="<?php echo $landingFaviconUrl; ?>">
    <link rel="apple-touch-icon" sizes="180x180" href="<?php echo $landingFaviconUrl; ?>">

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">

    <!-- JSON-LD Structured Data for SEO / AEO -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "AntiProfiles Software Features Catalog",
      "description": "Comprehensive catalog of 52 isolated browsing, fingerprint spoofing, and automation capabilities in AntiProfiles.",
      "url": "https://antiprofiles.com/features",
      "mainEntity": {
        "@type": "ItemList",
        "itemListElement": [
          <?php 
          $schemaItems = [];
          $idx = 1;
          foreach ($allFeatures as $sf) {
              $schemaItems[] = json_encode([
                  '@type' => 'ListItem',
                  'position' => $idx++,
                  'name' => $sf['name'],
                  'description' => $sf['short_desc']
              ]);
          }
          echo implode(",\n          ", $schemaItems);
          ?>
        ]
      }
    }
    </script>

    <style>
        :root {
            --bg-body: #07090E;
            --bg-card: rgba(18, 20, 30, 0.85);
            --bg-input: rgba(10, 12, 18, 0.9);
            --border: #232738;
            --border-hover: rgba(45, 212, 191, 0.45);
            --primary: #2DD4BF;
            --accent: #818CF8;
            --text-main: #F1F5F9;
            --text-muted: #94A3B8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            background-color: var(--bg-body);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            line-height: 1.65;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
        }

        .container {
            max-width: 1240px;
            margin: 0 auto;
            padding: 0 24px;
        }

        /* Navbar */
        .navbar {
            position: sticky;
            top: 0;
            z-index: 1000;
            padding: 16px 0;
            background: rgba(7, 9, 14, 0.85);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border);
        }
        .nav-inner {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .nav-links {
            display: flex;
            gap: 28px;
            list-style: none;
            align-items: center;
        }
        .nav-links a {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            transition: color 0.2s;
        }
        .nav-links a:hover, .nav-links a.active {
            color: #FFF;
        }
        .nav-links a.active {
            color: var(--primary);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 9px 20px;
            border-radius: 10px;
            font-size: 13.5px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            border: none;
        }
        .btn-primary {
            background: linear-gradient(135deg, #2DD4BF, #06B6D4);
            color: #000;
            box-shadow: 0 4px 14px rgba(45, 212, 191, 0.3);
        }
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(45, 212, 191, 0.45);
        }
        .btn-outline {
            background: rgba(255, 255, 255, 0.05);
            color: #FFF;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .btn-outline:hover {
            border-color: var(--primary);
            color: var(--primary);
            background: rgba(45, 212, 191, 0.08);
        }

        /* Hero Header */
        .features-hero {
            padding: 70px 0 40px 0;
            text-align: center;
            position: relative;
        }
        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 18px;
            border-radius: 999px;
            background: rgba(45, 212, 191, 0.12);
            border: 1px solid rgba(45, 212, 191, 0.35);
            color: #2DD4BF;
            font-size: 12.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 20px;
        }
        .features-hero h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 42px;
            font-weight: 800;
            color: #FFF;
            line-height: 1.25;
            margin-bottom: 16px;
            letter-spacing: -0.5px;
        }
        .features-hero p {
            font-size: 16.5px;
            color: var(--text-muted);
            max-width: 720px;
            margin: 0 auto 30px auto;
            line-height: 1.6;
        }

        /* Search & Filter Toolbar */
        .filter-toolbar {
            background: rgba(15, 23, 42, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 36px;
            backdrop-filter: blur(16px);
            box-shadow: 0 12px 36px rgba(0,0,0,0.3);
        }
        .search-wrapper {
            position: relative;
            margin-bottom: 20px;
        }
        .search-input {
            width: 100%;
            padding: 15px 20px 15px 48px;
            background: rgba(2, 6, 23, 0.85);
            border: 1px solid rgba(45, 212, 191, 0.3);
            border-radius: 12px;
            color: #FFF;
            font-size: 15px;
            outline: none;
            transition: all 0.2s;
        }
        .search-input:focus {
            border-color: #2DD4BF;
            box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.18);
        }
        .search-icon {
            position: absolute;
            left: 18px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 18px;
            pointer-events: none;
            opacity: 0.7;
        }
        .search-clear {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255,255,255,0.1);
            border: none;
            color: #94A3B8;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            font-size: 12px;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .category-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .cat-pill {
            padding: 8px 16px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            transition: all 0.2s ease;
            text-decoration: none;
        }
        .cat-pill:hover {
            color: #FFF;
            border-color: rgba(255, 255, 255, 0.25);
            background: rgba(255, 255, 255, 0.06);
        }
        .cat-pill.active {
            border-color: rgba(45, 212, 191, 0.45);
            background: rgba(45, 212, 191, 0.15);
            color: #2DD4BF;
        }

        /* Features Grid */
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 24px;
            margin-bottom: 60px;
        }
        .feature-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 26px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s;
        }
        .feature-card:hover {
            transform: translateY(-4px);
            border-color: var(--border-hover);
            box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.5), 0 0 20px rgba(45, 212, 191, 0.12);
        }
        .card-header-meta {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            gap: 8px;
        }
        .card-cat-tag {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 3px 9px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.05);
            color: #94A3B8;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .card-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 9px;
            border-radius: 6px;
            background: rgba(45, 212, 191, 0.15);
            color: #2DD4BF;
            border: 1px solid rgba(45, 212, 191, 0.3);
        }
        .card-title-box {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 12px;
        }
        .card-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: rgba(45, 212, 191, 0.1);
            border: 1px solid rgba(45, 212, 191, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
        }
        .card-title {
            font-size: 17px;
            font-weight: 700;
            color: #FFF;
            line-height: 1.35;
        }
        .card-desc {
            color: var(--text-muted);
            font-size: 13.5px;
            line-height: 1.6;
            margin-bottom: 18px;
        }
        .card-footer {
            padding-top: 14px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }

        /* Bottom CTA */
        .bottom-cta {
            background: linear-gradient(135deg, rgba(21, 28, 38, 0.98), rgba(15, 23, 42, 0.98));
            border: 1px solid rgba(45, 212, 191, 0.35);
            border-radius: 24px;
            padding: 48px 36px;
            text-align: center;
            margin-bottom: 80px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(45, 212, 191, 0.1);
        }
        .bottom-cta h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 32px;
            font-weight: 800;
            color: #FFF;
            margin-bottom: 12px;
        }
        .bottom-cta p {
            color: var(--text-muted);
            font-size: 16px;
            max-width: 600px;
            margin: 0 auto 28px auto;
        }

        /* Footer */
        footer {
            padding: 40px 0;
            border-top: 1px solid var(--border);
            text-align: center;
            color: var(--text-muted);
            font-size: 13px;
        }
        footer a {
            color: var(--text-muted);
            text-decoration: none;
            margin: 0 10px;
            transition: color 0.2s;
        }
        footer a:hover {
            color: var(--primary);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .features-hero h1 { font-size: 30px; }
            .nav-links { display: none; }
            .features-grid { grid-template-columns: 1fr; }
            .filter-toolbar { padding: 18px; }
        }
    </style>
</head>
<body>

    <!-- Sticky Navbar -->
    <nav class="navbar">
        <div class="container nav-inner">
            <a href="/" class="logo" style="display: flex; align-items: center;">
                <img src="<?php echo $landingLogoUrl; ?>" alt="AntiProfiles Logo" class="brand-logo-img" style="height: 36px; width: auto; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';">
            </a>
            <ul class="nav-links">
                <li><a href="/">Home</a></li>
                <li><a href="/features" class="active">Features (52)</a></li>
                <li><a href="/#ecosystem">Ecosystem</a></li>
                <li><a href="/#how-it-works">How It Works</a></li>
                <li><a href="/#downloads">Downloads</a></li>
                <li><a href="/#pricing">Pricing</a></li>
                <li><a href="/#live-support-showcase">Support</a></li>
                <li><a href="/#faq">FAQ</a></li>
            </ul>
            <div style="display: flex; gap: 10px; align-items: center;">
                <a href="/login" class="btn btn-outline" style="padding: 7px 14px; font-size: 12.5px;">Sign In</a>
                <a href="/register" class="btn btn-primary" style="padding: 7px 16px; font-size: 12.5px;">Get Started</a>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container">
        <!-- Hero Section -->
        <section class="features-hero">
            <div class="hero-badge">
                <span>⚡ 100% Comprehensive Capability Matrix</span>
            </div>
            <h1>All AntiProfiles Desktop Capabilities, Tools & Shields</h1>
            <p>Explore all 52 advanced privacy layers, hardware spoofing engines, proxy managers, automation drivers, and team collaboration tools built into AntiProfiles.</p>
        </section>

        <!-- Search & Filter Toolbar -->
        <div class="filter-toolbar">
            <!-- Live Search Bar -->
            <div class="search-wrapper">
                <input 
                    type="text" 
                    id="featureSearchInput" 
                    class="search-input"
                    placeholder="🔍 Search all 52 features (e.g. WebRTC, Canvas, WebGL, Puppeteer, SOCKS5, Cookie Robot, Cloud Sync...)"
                    oninput="filterSoftwareFeaturesLive()"
                />
                <span class="search-icon">🔎</span>
                <button id="featureSearchClearBtn" class="search-clear" onclick="clearFeatureSearch()">✕</button>
            </div>

            <!-- Category Filter Pills -->
            <div class="category-pills" id="featureCategoryPillsContainer">
                <button 
                    class="cat-pill <?php echo ($activeCategory === 'all') ? 'active' : ''; ?>" 
                    onclick="setFeatureCategoryFilter('all', this)">
                    ✨ All Features (<span id="totalPillCount"><?php echo count($allFeatures); ?></span>)
                </button>
                <?php
                foreach ($catMeta as $cKey => $cData) {
                    $cnt = $catCounts[$cKey] ?? 0;
                    if ($cnt === 0) continue;
                    $isActive = ($activeCategory === $cKey) ? 'active' : '';
                    echo '<button class="cat-pill ' . $isActive . '" data-category="' . htmlspecialchars($cKey) . '" onclick="setFeatureCategoryFilter(\'' . htmlspecialchars($cKey) . '\', this)">' . $cData['icon'] . ' ' . htmlspecialchars($cData['name']) . ' (' . $cnt . ')</button>';
                }
                ?>
            </div>

            <!-- Active Filter Counter Status -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 13px; color: var(--text-muted);">
                <div>
                    Showing <strong id="featuresCountVisible" style="color: #2DD4BF;"><?php echo count($allFeatures); ?></strong> of <strong id="featuresCountTotal" style="color: #FFF;"><?php echo count($allFeatures); ?></strong> verified software capabilities
                </div>
                <div id="activeFilterBadge" style="display: none;">
                    <span style="background: rgba(45, 212, 191, 0.1); color: #2DD4BF; padding: 2px 10px; border-radius: 6px; font-weight: 600; font-size: 12px;" id="activeFilterText">All</span>
                    <button onclick="resetFeatureFilters()" style="background: none; border: none; color: #94A3B8; cursor: pointer; text-decoration: underline; margin-left: 8px; font-size: 12px;">Reset</button>
                </div>
            </div>
        </div>

        <!-- 52 Features Showcase Grid -->
        <div class="features-grid" id="allFeaturesGrid">
            <?php foreach ($allFeatures as $feat): 
                $fCat = $feat['category'] ?? 'browser_profiles';
                $fCatName = $feat['category_name'] ?? 'Feature';
                $fName = $feat['name'] ?? 'Feature Name';
                $fDesc = $feat['short_desc'] ?? '';
                $fFullDesc = $feat['full_desc'] ?? '';
                $fIcon = $feat['icon'] ?? '⚡';
                $fBadge = $feat['badge'] ?? '';
                $fKeywords = $feat['keywords'] ?? '';
                $fDocUrl = $feat['doc_url'] ?? '/#downloads';
            ?>
            <div class="feature-card software-feature-card" 
                 data-id="<?php echo htmlspecialchars($feat['id']); ?>"
                 data-category="<?php echo htmlspecialchars($fCat); ?>"
                 data-name="<?php echo htmlspecialchars(strtolower($fName)); ?>"
                 data-desc="<?php echo htmlspecialchars(strtolower($fDesc . ' ' . $fFullDesc)); ?>"
                 data-keywords="<?php echo htmlspecialchars(strtolower($fKeywords)); ?>">
                
                <div>
                    <!-- Top Category & Highlight Badge -->
                    <div class="card-header-meta">
                        <span class="card-cat-tag">
                            <?php echo htmlspecialchars($fCatName); ?>
                        </span>
                        <?php if (!empty($fBadge)): ?>
                        <span class="card-badge">
                            <?php echo htmlspecialchars($fBadge); ?>
                        </span>
                        <?php endif; ?>
                    </div>

                    <!-- Icon & Title -->
                    <div class="card-title-box">
                        <div class="card-icon">
                            <?php echo $fIcon; ?>
                        </div>
                        <h3 class="card-title">
                            <?php echo htmlspecialchars($fName); ?>
                        </h3>
                    </div>

                    <!-- Description -->
                    <p class="card-desc">
                        <?php echo htmlspecialchars($fDesc); ?>
                    </p>
                </div>

                <!-- Footer Platforms & Learn More -->
                <div class="card-footer">
                    <div style="color: #64748B; display: flex; align-items: center; gap: 6px;">
                        <span>💻</span>
                        <span style="font-weight: 600; color: #94A3B8;">Win • Mac • Linux (64/ARM)</span>
                    </div>
                    <a href="/#downloads" style="color: #2DD4BF; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                        <span>Get App</span>
                        <span>→</span>
                    </a>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <!-- No Features Found Empty State -->
        <div id="noFeaturesFoundMessage" style="display: none; background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 18px; padding: 48px 24px; text-align: center; margin-bottom: 60px;">
            <div style="font-size: 44px; margin-bottom: 14px;">🔍</div>
            <h3 style="font-size: 20px; color: #FFF; margin-bottom: 8px;">No matching features found</h3>
            <p style="color: var(--text-muted); font-size: 14px; max-width: 480px; margin: 0 auto 20px;">
                We couldn't find any software feature matching your search term. Try another keyword or reset your filter.
            </p>
            <button onclick="resetFeatureFilters()" class="btn btn-primary" style="padding: 10px 24px; font-size: 14px;">
                🔄 Reset Search & Show All 52 Features
            </button>
        </div>

        <!-- Bottom CTA -->
        <section class="bottom-cta">
            <h2>Ready to Supercharge Your Multi-Accounting?</h2>
            <p>Download the AntiProfiles desktop application for Windows, macOS (Intel & Apple Silicon), and Linux.</p>
            <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
                <a href="/#downloads" class="btn btn-primary" style="padding: 14px 32px; font-size: 15px;">⬇️ Download AntiProfiles Desktop</a>
                <a href="/register" class="btn btn-outline" style="padding: 14px 28px; font-size: 15px;">Start Free Trial</a>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p style="margin-bottom: 12px;">© <?php echo date('Y'); ?> AntiProfiles. All rights reserved. Enterprise-grade isolated browser management.</p>
            <div>
                <a href="/">Home</a>
                <a href="/features">All Features (52)</a>
                <a href="/#downloads">Downloads</a>
                <a href="/#pricing">Pricing</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms of Service</a>
                <a href="/sitemap.html">HTML Sitemap</a>
            </div>
        </div>
    </footer>

    <!-- Interactive Search & Filtering Script -->
    <script>
    (function() {
        let currentCategory = '<?php echo htmlspecialchars($activeCategory); ?>' || 'all';

        window.setFeatureCategoryFilter = function(category, btnElement) {
            currentCategory = category;
            
            document.querySelectorAll('.cat-pill').forEach(btn => {
                btn.classList.remove('active');
            });

            if (btnElement) {
                btnElement.classList.add('active');
            }

            filterSoftwareFeaturesLive();
        };

        window.filterSoftwareFeaturesLive = function() {
            const searchInput = document.getElementById('featureSearchInput');
            const clearBtn = document.getElementById('featureSearchClearBtn');
            const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
            
            if (clearBtn) {
                clearBtn.style.display = query.length > 0 ? 'inline-flex' : 'none';
            }

            const cards = document.querySelectorAll('.software-feature-card');
            let visibleCount = 0;

            cards.forEach(card => {
                const cardCat = card.getAttribute('data-category') || '';
                const cardName = card.getAttribute('data-name') || '';
                const cardDesc = card.getAttribute('data-desc') || '';
                const cardKeywords = card.getAttribute('data-keywords') || '';

                const matchesCat = (currentCategory === 'all' || cardCat === currentCategory);
                const matchesSearch = (!query || cardName.indexOf(query) !== -1 || cardDesc.indexOf(query) !== -1 || cardKeywords.indexOf(query) !== -1 || cardCat.indexOf(query) !== -1);

                if (matchesCat && matchesSearch) {
                    card.style.display = 'flex';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            const countVisibleEl = document.getElementById('featuresCountVisible');
            if (countVisibleEl) {
                countVisibleEl.textContent = visibleCount;
            }

            const activeFilterBadge = document.getElementById('activeFilterBadge');
            const activeFilterText = document.getElementById('activeFilterText');
            if (activeFilterBadge && activeFilterText) {
                if (currentCategory !== 'all' || query.length > 0) {
                    activeFilterBadge.style.display = 'inline-flex';
                    activeFilterText.textContent = (currentCategory !== 'all' ? currentCategory.replace('_', ' ').toUpperCase() : '') + (query ? ' ("' + query + '")' : '');
                } else {
                    activeFilterBadge.style.display = 'none';
                }
            }

            const noFeaturesMsg = document.getElementById('noFeaturesFoundMessage');
            const featuresGrid = document.getElementById('allFeaturesGrid');
            if (noFeaturesMsg && featuresGrid) {
                if (visibleCount === 0) {
                    noFeaturesMsg.style.display = 'block';
                    featuresGrid.style.display = 'none';
                } else {
                    noFeaturesMsg.style.display = 'none';
                    featuresGrid.style.display = 'grid';
                }
            }
        };

        window.clearFeatureSearch = function() {
            const searchInput = document.getElementById('featureSearchInput');
            if (searchInput) {
                searchInput.value = '';
                filterSoftwareFeaturesLive();
                searchInput.focus();
            }
        };

        window.resetFeatureFilters = function() {
            currentCategory = 'all';
            const firstPill = document.querySelector('.cat-pill');
            if (firstPill) setFeatureCategoryFilter('all', firstPill);
            const searchInput = document.getElementById('featureSearchInput');
            if (searchInput) searchInput.value = '';
            filterSoftwareFeaturesLive();
        };

        // Initialize on load
        if (currentCategory !== 'all') {
            const activePill = document.querySelector('.cat-pill[data-category="' + currentCategory + '"]');
            if (activePill) setFeatureCategoryFilter(currentCategory, activePill);
        }
    })();
    </script>
</body>
</html>
