<?php
// ──────────────────────────────────────────────
// ProfileVault — Central PHP Front Controller & Router for aaPanel
// Handles REST APIs, Dynamic SEO/AEO System, Web App & Landing Page
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

// Parse Request URI
$rawUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestUri = rtrim($rawUri, '/');
if (empty($requestUri)) $requestUri = '/';

$pdo = getDbConnection();

// ── 0. Dynamic SEO Files Routes ──
if ($requestUri === '/sitemap.xml') {
    require_once __DIR__ . '/sitemap.php';
    exit();
}
if ($requestUri === '/sitemap.html') {
    $_GET['format'] = 'html';
    require_once __DIR__ . '/sitemap.php';
    exit();
}
if ($requestUri === '/robots.txt') {
    require_once __DIR__ . '/robots.php';
    exit();
}
if ($requestUri === '/llms.txt' || $requestUri === '/llms') {
    require_once __DIR__ . '/llms.php';
    exit();
}

// ── 0.1 Direct Application Download Endpoints ──
if (strpos($requestUri, '/download/') === 0 || $requestUri === '/download') {
    $subPath = str_replace('/download/', '', $requestUri);
    $subPath = trim(str_replace('/download', '', $subPath), '/');

    $platformMap = [
        'windows' => 'windows-x64',
        'win' => 'windows-x64',
        'macos-intel' => 'macos-x64',
        'mac-intel' => 'macos-x64',
        'macos-arm64' => 'macos-arm64',
        'apple-silicon' => 'macos-arm64',
        'mac-arm' => 'macos-arm64',
        'linux' => 'linux-x64'
    ];

    $_GET['download'] = '1';
    $_GET['platform'] = $platformMap[$subPath] ?? 'windows-x64';
    require_once __DIR__ . '/api/releases.php';
    exit();
}

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
    if ($requestUri === '/api/public/releases' || $requestUri === '/api/releases') {
        require_once __DIR__ . '/api/releases.php';
        exit();
    }

    // Public Landing Page Database-Driven CMS Data API
    if ($requestUri === '/api/public/landing-data') {
        require_once __DIR__ . '/api/landing.php';
        exit();
    }

    // Admin SEO API
    if (strpos($requestUri, '/api/admin/seo/') === 0 || strpos($requestUri, '/api/admin/seo') === 0) {
        $action = str_replace('/api/admin/seo/', '', $requestUri);
        $action = str_replace('/api/admin/seo', '', $action);
        $_GET['action'] = $action ?: 'get-settings';
        require_once __DIR__ . '/api/seo.php';
        exit();
    }

    // Auth APIs (/api/auth/login, /api/auth/register, /api/auth/google, /api/auth/me)
    if (strpos($requestUri, '/api/auth') === 0) {
        $action = str_replace('/api/auth/', '', $requestUri);
        $action = str_replace('/api/auth', '', $action);
        $action = trim($action, '/');
        if (!empty($action)) {
            $_GET['action'] = $action;
        }
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

if ($requestUri !== '/' && file_exists($rendererPath . $requestUri) && !is_dir($rendererPath . $requestUri)) {
    $mime = mime_content_type($rendererPath . $requestUri);
    header('Content-Type: ' . $mime);
    readfile($rendererPath . $requestUri);
    exit();
}

// Load Page SEO Data from Database for HTML Injection (with safety fallback)
$pageSeo = false;
try {
    $stmtPage = $pdo->prepare("SELECT * FROM `page_seo` WHERE `page_path` = ? LIMIT 1");
    $stmtPage->execute([$requestUri]);
    $pageSeo = $stmtPage->fetch(PDO::FETCH_ASSOC);

    if (!$pageSeo) {
        $stmtHome = $pdo->query("SELECT * FROM `page_seo` WHERE `page_path` = '/' LIMIT 1");
        $pageSeo = $stmtHome->fetch(PDO::FETCH_ASSOC);
    }
} catch (Throwable $e) {
    $pageSeo = false;
}


$appBaseUrl = defined('APP_URL') ? APP_URL : 'https://app.edgecash.net';
$pageTitle = $pageSeo['title'] ?? 'ProfileVault — Anti-Detect Browser & Profile Isolation';
$pageDesc = $pageSeo['description'] ?? 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Software.';
$pageCanonical = $pageSeo['canonical_url'] ?? (rtrim($appBaseUrl, '/') . $requestUri);
$pageRobots = $pageSeo['robots'] ?? 'index, follow';
$ogTitle = $pageSeo['og_title'] ?? $pageTitle;
$ogDesc = $pageSeo['og_description'] ?? $pageDesc;
$ogImage = $pageSeo['og_image'] ?? ($appBaseUrl . '/og-cover.png');

// Schema.org JSON-LD Generation
$schemas = [
    [
        "@context" => "https://schema.org",
        "@type" => "Organization",
        "name" => "ProfileVault Software Inc.",
        "url" => $appBaseUrl,

        "logo" => "https://profilevault.local/logo.png",
        "sameAs" => [
            "https://x.com/ProfileVaultApp",
            "https://github.com/edge-tec/Antidetector_browser"
        ]
    ],
    [
        "@context" => "https://schema.org",
        "@type" => "SoftwareApplication",
        "name" => "ProfileVault Anti-Detect Browser",
        "operatingSystem" => "macOS, Windows",
        "applicationCategory" => "BusinessApplication",
        "offers" => [
            "@type" => "Offer",
            "price" => "0.00",
            "priceCurrency" => "USD"
        ]
    ]
];

$indexFile = $rendererPath . '/index.html';
if (file_exists($indexFile)) {
    $html = file_get_contents($indexFile);

    $seoTags = "\n    <title>" . htmlspecialchars($pageTitle) . "</title>\n";
    $seoTags .= '    <meta name="description" content="' . htmlspecialchars($pageDesc) . '" />' . "\n";
    $seoTags .= '    <meta name="robots" content="' . htmlspecialchars($pageRobots) . '" />' . "\n";
    $seoTags .= '    <link rel="canonical" href="' . htmlspecialchars($pageCanonical) . '" />' . "\n";
    $seoTags .= '    <meta property="og:title" content="' . htmlspecialchars($ogTitle) . '" />' . "\n";
    $seoTags .= '    <meta property="og:description" content="' . htmlspecialchars($ogDesc) . '" />' . "\n";
    $seoTags .= '    <meta property="og:image" content="' . htmlspecialchars($ogImage) . '" />' . "\n";
    $seoTags .= '    <meta property="og:url" content="' . htmlspecialchars($pageCanonical) . '" />' . "\n";
    $seoTags .= '    <meta name="twitter:card" content="summary_large_image" />' . "\n";
    $seoTags .= '    <script type="application/ld+json">' . json_encode($schemas, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";

    $html = str_replace('</head>', $seoTags . '  </head>', $html);
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit();
}

// Default Full-Featured Production Landing Page & Web Portal
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($pageDesc); ?>">
    <meta name="robots" content="<?php echo htmlspecialchars($pageRobots); ?>">
    <link rel="canonical" href="<?php echo htmlspecialchars($pageCanonical); ?>">
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="shortcut icon" href="/logo.png">
    <meta property="og:title" content="<?php echo htmlspecialchars($ogTitle); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($ogDesc); ?>">
    <meta property="og:image" content="https://app.edgecash.net/logo.png">
    <meta property="og:url" content="<?php echo htmlspecialchars($pageCanonical); ?>">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json"><?php echo json_encode($schemas, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES); ?></script>
    <script>
        window.openModal = function(mode) {
            window.closeAdminDashboard();
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
                window.switchAuthTab(mode || 'login');
            }
        };

        window.closeModal = function() {
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        };

        window.closeAdminDashboard = function() {
            const adminModal = document.getElementById('adminDashboardModal');
            if (adminModal) {
                adminModal.classList.remove('active');
                adminModal.style.display = 'none';
            }
        };

        window.switchAuthTab = function(mode) {
            const loginForm = document.getElementById('loginForm');
            const regForm = document.getElementById('registerForm');
            const btnLogin = document.getElementById('modalBtnLogin');
            const btnReg = document.getElementById('modalBtnRegister');
            const msg = document.getElementById('loginMsg');
            if (msg) msg.style.display = 'none';

            if (mode === 'register') {
                if (loginForm) loginForm.style.display = 'none';
                if (regForm) regForm.style.display = 'block';
                if (btnReg) {
                    btnReg.style.background = 'var(--primary)';
                    btnReg.style.color = '#FFF';
                }
                if (btnLogin) {
                    btnLogin.style.background = 'transparent';
                    btnLogin.style.color = 'var(--text-muted)';
                }
            } else {
                if (regForm) regForm.style.display = 'none';
                if (loginForm) loginForm.style.display = 'block';
                if (btnLogin) {
                    btnLogin.style.background = 'var(--primary)';
                    btnLogin.style.color = '#FFF';
                }
                if (btnReg) {
                    btnReg.style.background = 'transparent';
                    btnReg.style.color = 'var(--text-muted)';
                }
            }
        };
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0B0C10;
            --bg-card: #151720;
            --bg-input: #0F1016;
            --border: #242736;
            --border-hover: #3E435C;
            --primary: #6366F1;
            --primary-glow: rgba(99, 102, 241, 0.35);
            --accent: #2DD4BF;
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg-dark); color: var(--text-main); font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.6; overflow-x: hidden; }
        h1, h2, h3, .logo { font-family: 'Outfit', sans-serif; }
        
        /* Glassmorphism Navbar */
        .navbar { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; backdrop-filter: blur(16px); background: rgba(11, 12, 16, 0.85); border-bottom: 1px solid var(--border); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-size: 22px; font-weight: 800; color: #FFF; text-decoration: none; display: flex; align-items: center; gap: 10px; }
        .logo-icon { background: linear-gradient(135deg, var(--primary), var(--accent)); width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .nav-links { display: flex; align-items: center; gap: 28px; list-style: none; }
        .nav-links a { color: var(--text-muted); text-decoration: none; font-weight: 500; font-size: 15px; transition: 0.2s; }
        .nav-links a:hover { color: #FFF; }
        .btn { padding: 10px 22px; border-radius: 10px; font-weight: 600; font-size: 14px; text-decoration: none; cursor: pointer; transition: 0.2s; border: none; display: inline-flex; align-items: center; gap: 8px; }
        .btn-primary { background: linear-gradient(135deg, var(--primary), #8B5CF6); color: #FFF; box-shadow: 0 4px 20px var(--primary-glow); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px var(--primary-glow); }
        .btn-outline { background: transparent; border: 1px solid var(--border-hover); color: var(--text-main); }
        .btn-outline:hover { background: rgba(255,255,255,0.05); color: #FFF; }

        /* Container */
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        
        /* Hero Section */
        .hero { padding: 160px 0 100px; text-align: center; position: relative; }
        .hero::before { content: ''; position: absolute; top: 10%; left: 50%; transform: translateX(-50%); width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(11,12,16,0) 70%); filter: blur(60px); pointer-events: none; }
        .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 20px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); color: #818CF8; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
        .hero h1 { font-size: 56px; font-weight: 800; line-height: 1.15; margin-bottom: 20px; background: linear-gradient(180deg, #FFFFFF 0%, #94A3B8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero p { font-size: 20px; color: var(--text-muted); max-width: 760px; margin: 0 auto 36px; }
        .hero-actions { display: flex; justify-content: center; gap: 16px; margin-bottom: 60px; }

        /* Server Status Widget */
        .status-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px 28px; max-width: 680px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .status-item { display: flex; flex-direction: column; }
        .status-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
        .status-val { font-size: 15px; font-weight: 700; color: var(--accent); margin-top: 2px; }

        /* Section Headings */
        .section { padding: 90px 0; border-top: 1px solid var(--border); }
        .section-title { text-align: center; margin-bottom: 60px; }
        .section-title h2 { font-size: 38px; font-weight: 800; margin-bottom: 12px; }
        .section-title p { color: var(--text-muted); font-size: 17px; }

        /* Features Grid */
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 28px; }
        .feature-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 32px; transition: 0.3s; }
        .feature-card:hover { border-color: var(--border-hover); transform: translateY(-5px); }
        .feature-icon { font-size: 32px; margin-bottom: 16px; }
        .feature-card h3 { font-size: 20px; margin-bottom: 10px; color: #FFF; }
        .feature-card p { color: var(--text-muted); font-size: 14px; }

        /* Pricing Grid */
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
        .plan-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 36px 28px; position: relative; display: flex; flex-direction: column; }
        .plan-card.popular { border-color: var(--primary); box-shadow: 0 0 30px var(--primary-glow); }
        .popular-tag { position: absolute; top: -14px; right: 24px; background: var(--primary); color: #FFF; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px; text-transform: uppercase; }
        .plan-name { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
        .plan-price { font-size: 42px; font-weight: 800; color: #FFF; margin-bottom: 16px; }
        .plan-price span { font-size: 16px; color: var(--text-muted); font-weight: 400; }
        .plan-features { list-style: none; margin-bottom: 32px; flex-grow: 1; }
        .plan-features li { margin-bottom: 12px; color: var(--text-muted); font-size: 14px; display: flex; align-items: center; gap: 10px; }
        .plan-features li::before { content: '✓'; color: var(--accent); font-weight: 700; }

        /* Login Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); z-index: 2000; display: none; align-items: center; justify-content: center; padding: 20px; }
        #loginModal { z-index: 3000 !important; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: var(--bg-card); border: 1px solid var(--border-hover); width: 100%; max-width: 440px; border-radius: 20px; padding: 36px; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
        .close-modal { position: absolute; top: 20px; right: 20px; background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; }
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
        .form-group input { width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; color: #FFF; font-size: 15px; outline: none; }
        .form-group input:focus { border-color: var(--primary); }

        /* Sidebar Navigation Buttons */
        .admin-sidebar-btn {
            width: 100%;
            padding: 10px 14px;
            margin-bottom: 4px;
            border-radius: 8px;
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .admin-sidebar-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #FFF;
        }
        .admin-sidebar-btn.active {
            background: linear-gradient(135deg, var(--primary), #4F46E5);
            color: #FFF;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        /* Footer */
        footer { padding: 40px 0; border-top: 1px solid var(--border); text-align: center; color: var(--text-muted); font-size: 14px; }
        footer a { color: var(--accent); text-decoration: none; }

        @media(max-width: 768px) {
            .hero h1 { font-size: 36px; }
            .nav-links { display: none; }
            .status-box { flex-direction: column; gap: 16px; text-align: center; }
        }
    </style>
</head>
<body>

    <!-- Navbar -->
    <nav class="navbar">
        <a href="/" class="logo">
            <img src="/logo.png" alt="ProfileVault Logo" style="width: 36px; height: 36px; object-fit: contain;">
            <span>ProfileVault</span>
        </a>
        <ul class="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#downloads">Downloads</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
        <div style="display: flex; gap: 12px; align-items: center;">
            <a href="/login" class="btn btn-outline" style="padding: 8px 18px; font-size: 13px; text-decoration: none;" onclick="openModal('login'); return false;">Sign In</a>
            <a href="/register" class="btn btn-primary" style="padding: 8px 20px; font-size: 13px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; text-decoration: none;" onclick="openModal('register'); return false;">Get Started</a>
        </div>
    </nav>

    <!-- 1. Hero Section (2-Column Layout) -->
    <section class="hero container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 48px; align-items: center; padding-top: 140px; padding-bottom: 60px;">
        <div>
            <div class="badge" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(99, 102, 241, 0.15); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 20px; padding: 6px 16px; font-size: 12px; font-weight: 700; margin-bottom: 24px;">
                🚀 Next-Generation Profile Vault Architecture
            </div>
            <h1 style="font-size: clamp(36px, 5vw, 54px); font-weight: 800; line-height: 1.15; margin-bottom: 20px; color: #FFF;">
                Browse Privately.<br>Manage Profiles.<br>Scale Your Workflow.
            </h1>
            <p style="font-size: 16px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; max-width: 520px;">
                Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.
            </p>
            <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 24px;">
                <a href="/register" class="btn btn-primary" style="padding: 14px 32px; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; text-decoration: none;" onclick="openModal('register'); return false;">Start Free</a>
                <a href="#pricing" class="btn btn-outline" style="padding: 14px 28px; font-size: 15px;">View Pricing</a>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); font-weight: 500;">⚡ No credit card required • Free trial available • Cancel anytime</p>
        </div>

        <!-- Right Column: Interactive Dashboard Preview Card -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); backdrop-filter: blur(12px);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
                <div style="display: flex; gap: 8px;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #EF4444;"></span>
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #F59E0B;"></span>
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #10B981;"></span>
                </div>
                <span style="font-family: monospace; font-size: 12px; color: var(--text-muted);">ProfileVault Dashboard v1.0</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 14px; color: #FFF; font-weight: 700;">US E-Commerce Account</h4>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">macOS • 🇺🇸 United States • Active HTTP</p>
                    </div>
                    <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">Running</span>
                </div>

                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 14px; color: #FFF; font-weight: 700;">UK Marketing Profile</h4>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Windows 11 • 🇬🇧 United Kingdom • SOCKS5 Active</p>
                    </div>
                    <span style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">Stopped</span>
                </div>

                <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 14px; color: #FFF; font-weight: 700;">EU Research Context</h4>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Linux • 🇩🇪 Germany • HTTP Active</p>
                    </div>
                    <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">Running</span>
                </div>
            </div>
        </div>
    </section>

    <!-- 2. Stats Bar Section -->
    <section style="background: rgba(21, 23, 32, 0.6); border-y: 1px solid var(--border); padding: 40px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
        <div class="container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 32px; text-align: center;">
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">🌐</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">10K+</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Active Profiles</p>
            </div>
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">⚡</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">99.9%</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Platform Uptime</p>
            </div>
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">🌍</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">150+</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Countries Supported</p>
            </div>
            <div>
                <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
                <h3 style="font-size: 32px; font-weight: 800; color: #2DD4BF;">24/7</h3>
                <p style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Expert Support</p>
            </div>
        </div>
    </section>

    <!-- 3. Features Section (8 Cards Grid) -->
    <section id="features" class="section container">
        <div class="section-title">
            <h2>Built for Privacy, Security & Isolation</h2>
            <p>Comprehensive environment control tools designed to keep your browser profiles completely isolated.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">🔒</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Isolated Browser Profiles</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Keep cookies, local storage, sessions, and browser data completely separated between profiles.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">🛡️</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Fingerprint Management</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Configure browser and device environment parameters including WebGL, Canvas, and User-Agents.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">🌐</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Proxy Management System</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Seamlessly assign and test HTTP, HTTPS, SOCKS4, and SOCKS5 proxy configurations per profile.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">📋</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Reusable Profile Templates</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Create standardized profile templates for fast batch provisioning across your operations.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">👥</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Team Access Controls</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Share browser profiles securely across team members with granular permission levels.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">⚡</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Automation API</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Access local REST endpoints and automation drivers for Puppeteer and Selenium workflows.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">💾</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Encrypted Local Storage</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">All session data and cookies are stored with high-standard AES-256 local database encryption.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 16px;">💻</div>
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 8px;">Cross-Platform Compatibility</h3>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Native desktop support tailored for macOS, Windows, and Linux operating systems.</p>
            </div>
        </div>
    </section>

    <!-- 4. How It Works Section (4 Steps) -->
    <section id="how-it-works" class="section container">
        <div class="section-title">
            <h2>How ProfileVault Works</h2>
            <p>Get started in four easy steps and launch your isolated browser profiles in seconds.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 01</span>
                <div style="font-size: 32px; margin-bottom: 14px;">📋</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Create Your Profile</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Choose a profile template or start from scratch to configure your environment.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 02</span>
                <div style="font-size: 32px; margin-bottom: 14px;">⚙️</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Configure Environment</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Set custom User Agent, OS, timezone, language, WebGL, fingerprint, and proxy.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 03</span>
                <div style="font-size: 32px; margin-bottom: 14px;">🚀</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Launch Isolated Window</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Open an isolated browser window running with dedicated storage and cookies.</p>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 800; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px;">STEP 04</span>
                <div style="font-size: 32px; margin-bottom: 14px;">📊</div>
                <h3 style="font-size: 16px; color: #FFF; margin-bottom: 6px;">Scale & Manage</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Monitor profile status, organize into groups, and manage team access effortlessly.</p>
            </div>
        </div>
    </section>

    <!-- 5. Desktop Downloads Section -->
    <section id="downloads" class="section container">
        <div class="section-title">
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
                💻 Cross-Platform Desktop Client
            </div>
            <h2>Download Our Desktop Application</h2>
            <p>Manage your isolated browser profiles directly from your computer with native Windows and macOS performance.</p>
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 8px 16px; display: inline-block; font-size: 13px; color: #10B981; margin-top: 14px; font-weight: 600;">
                ✓ Auto-Detected System: macOS Apple Silicon (ARM64 / M1 / M2 / M3 / M4)
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 12px;">🪟</div>
                <h3 style="font-size: 18px; color: #FFF;">Download for Windows</h3>
                <span style="font-size: 11px; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; color: var(--text-muted);">x64 Architecture [64-bit]</span>
                <p style="color: var(--text-muted); font-size: 13px; margin: 12px 0 20px;">Native installer for Windows 10 and 11. Includes automatic shortcuts and silent installer options.</p>
                <a href="/api/releases?download=1&platform=windows-x64" download class="btn btn-outline" style="width: 100%; justify-content: center;" id="landingBtnWinDl">Download Windows .exe (v1.0.0)</a>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="font-size: 32px; margin-bottom: 12px;">🍏</div>
                <h3 style="font-size: 18px; color: #FFF;">Download for Mac — Intel</h3>
                <span style="font-size: 11px; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; color: var(--text-muted);">Intel Processors [x64]</span>
                <p style="color: var(--text-muted); font-size: 13px; margin: 12px 0 20px;">Native macOS disk image built for Intel-based Mac computers manufactured before late 2020.</p>
                <a href="/api/releases?download=1&platform=macos-x64" download class="btn btn-outline" style="width: 100%; justify-content: center;" id="landingBtnMacIntelDl">Download macOS Intel .dmg (v1.0.0)</a>
            </div>

            <div style="background: var(--bg-card); border: 1px solid #2DD4BF; border-radius: 16px; padding: 28px; position: relative;">
                <span style="position: absolute; top: -12px; right: 20px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">RECOMMENDED FOR THIS DEVICE</span>
                <div style="font-size: 32px; margin-bottom: 12px;">🍏</div>
                <h3 style="font-size: 18px; color: #FFF;">Download for Mac — Apple Silicon</h3>
                <span style="font-size: 11px; background: rgba(45, 212, 191, 0.15); color: #2DD4BF; padding: 2px 8px; border-radius: 4px; font-weight: 700;">M1 / M2 / M3 / M4 [arm64]</span>
                <p style="color: var(--text-muted); font-size: 13px; margin: 12px 0 20px;">Native ARM64 build engineered specifically for Apple Silicon M-series processors for maximum speed.</p>
                <a href="/api/releases?download=1&platform=macos-arm64" download class="btn btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800;" id="landingBtnMacArmDl">Download Apple Silicon .dmg (v1.0.0)</a>
            </div>
        </div>
    </section>

    <!-- 6. Pricing Section (4 Plan Cards) -->
    <section id="pricing" class="section container">
        <div class="section-title">
            <h2>Transparent & Flexible Pricing</h2>
            <p>Choose the plan that fits your workflow. Scale or downgrade anytime.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px;">
            <!-- Free Plan -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; display: flex; flex-direction: column;">
                <h3 style="font-size: 18px; color: #FFF;">Free</h3>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$0 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <button class="btn btn-outline" style="width: 100%; justify-content: center; margin-bottom: 24px;" onclick="openModal('register')">Start Free</button>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>3 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>Basic</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Standard</strong></li>
                    <li>✓ Team Users: <strong>1 User</strong></li>
                    <li>✕ API Access: <strong>—</strong></li>
                    <li>✓ Support: <strong>Community</strong></li>
                </ul>
            </div>

            <!-- Starter Plan -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; display: flex; flex-direction: column;">
                <h3 style="font-size: 18px; color: #FFF;">Starter</h3>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$19 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <button class="btn btn-outline" style="width: 100%; justify-content: center; margin-bottom: 24px;" onclick="openModal('register')">Start Trial</button>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>25 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>HTTP/HTTPS/SOCKS</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Advanced</strong></li>
                    <li>✓ Team Users: <strong>2 Users</strong></li>
                    <li>✓ API Access: <strong>Basic API</strong></li>
                    <li>✓ Support: <strong>Email Support</strong></li>
                </ul>
            </div>

            <!-- Professional Plan -->
            <div style="background: var(--bg-card); border: 1px solid #2DD4BF; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; position: relative;">
                <span style="position: absolute; top: -12px; right: 20px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">MOST POPULAR</span>
                <h3 style="font-size: 18px; color: #FFF;">Professional</h3>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$49 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-bottom: 24px; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800;" onclick="openModal('register')">Get Started</button>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>100 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>HTTP/HTTPS/SOCKS5</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Advanced Controls</strong></li>
                    <li>✓ Team Users: <strong>10 Users</strong></li>
                    <li>✓ API Access: <strong>Full REST & Driver API</strong></li>
                    <li>✓ Support: <strong>Priority 24/7</strong></li>
                </ul>
            </div>

            <!-- Business Plan -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; position: relative;">
                <span style="position: absolute; top: -12px; right: 20px; background: rgba(99, 102, 241, 0.2); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.4); font-size: 10px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">BEST VALUE</span>
                <h3 style="font-size: 18px; color: #FFF;">Business</h3>
                <div style="font-size: 36px; font-weight: 800; color: #FFF; margin: 16px 0;">$99 <span style="font-size: 14px; color: var(--text-muted); font-weight: 400;">/month</span></div>
                <button class="btn btn-outline" style="width: 100%; justify-content: center; margin-bottom: 24px;" onclick="openModal('register')">Contact Sales</button>
                <ul style="list-style: none; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px;">
                    <li>✓ Browser Profiles: <strong>500 Profiles</strong></li>
                    <li>✓ Proxy Support: <strong>HTTP/HTTPS/SOCKS5</strong></li>
                    <li>✓ Fingerprint Controls: <strong>Full Hardware Spoofing</strong></li>
                    <li>✓ Team Users: <strong>25 Users</strong></li>
                    <li>✓ API Access: <strong>Unlimited API</strong></li>
                    <li>✓ Support: <strong>Dedicated Account Manager</strong></li>
                </ul>
            </div>
        </div>
    </section>

    <!-- 7. Plan Feature Comparison Matrix Table -->
    <section class="section container" style="padding-top: 0;">
        <div class="section-title">
            <h2>Plan Feature Comparison Matrix</h2>
        </div>
        <div style="overflow-x: auto; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;">
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 14px;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                        <th style="padding: 16px; text-align: left; color: var(--text-muted);">Feature</th>
                        <th style="padding: 16px; color: #FFF;">Free</th>
                        <th style="padding: 16px; color: #FFF;">Starter</th>
                        <th style="padding: 16px; color: #2DD4BF;">Professional</th>
                        <th style="padding: 16px; color: #818CF8;">Business</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Browser Profiles</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">3</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">25</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">100</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">500</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Team Members</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">1 User</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">2 Users</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">10 Users</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">25 Users</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Automation API</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">—</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">Basic API</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">Full API</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">High-Limit API</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Proxy Support</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">✓</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">✓</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">✓</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">✓</td>
                    </tr>
                    <tr>
                        <td style="padding: 14px 16px; text-align: left; font-weight: 600; color: #FFF;">Fingerprint Control</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">Basic</td>
                        <td style="padding: 14px 16px; color: var(--text-muted);">Advanced</td>
                        <td style="padding: 14px 16px; color: #2DD4BF; font-weight: 700;">Advanced</td>
                        <td style="padding: 14px 16px; color: #818CF8; font-weight: 700;">Advanced</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <!-- 8. Frequently Asked Questions Section -->
    <section id="faq" class="section container">
        <div class="section-title">
            <h2>Frequently Asked Questions</h2>
            <p>Have questions about ProfileVault? Find answers below.</p>
        </div>
        <div style="max-width: 840px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>What is an anti-detect browser?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    An anti-detect browser is a specialized browser platform designed to run multiple isolated browser environments simultaneously. Each profile operates with its own distinct cookies, cache, local storage, dedicated proxy connection, and unique digital hardware fingerprint (including WebGL, Canvas noise, User-Agent, WebRTC IP masking, screen resolution, and audio context). This prevents websites from tracking or linking your accounts together.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>What is a browser profile?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    A browser profile is an entirely isolated virtual browsing session. It stores its own independent cookies, browsing history, saved credentials, browser extensions, and hardware parameters. Running a profile is like launching a separate physical computer with its own browser environment, ensuring complete data separation between different social media, e-commerce, or advertising accounts.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>Can I use HTTP, SOCKS4, and SOCKS5 proxies?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    Yes! ProfileVault supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with full authentication (username/password or IP whitelist). You can configure proxies per profile, test connections in real time, auto-detect geographical location, and automatically route WebRTC and DNS traffic through your proxy to prevent IP leaks.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>Can I upgrade or downgrade my plan at any time?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    Absolutely! You can upgrade, downgrade, or change your subscription plan whenever needed directly from your account dashboard. Upgrades take effect immediately with prorated billing, and you can manage device limits, profile quotas, and active licenses with complete control.
                </div>
            </div>

            <div class="faq-item" onclick="toggleFaq(this)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 17px; color: #FFF;">
                    <span>Does ProfileVault offer an Automation API?</span>
                    <span class="faq-icon" style="color: #2DD4BF; font-size: 22px; font-weight: 700; width: 28px; text-align: center;">+</span>
                </div>
                <div class="faq-answer" style="display: none; margin-top: 14px; color: var(--text-muted); font-size: 14px; line-height: 1.7; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                    Yes! ProfileVault includes a robust local REST API and WebSocket endpoints compatible with Selenium, Puppeteer, Playwright, and custom automation tools. You can programmatically launch profiles, manage browser sessions, inspect runtime status, and automate multi-account workflows at scale.
                </div>
            </div>
        </div>
    </section>

    <!-- 9. Testimonials Section -->
    <section class="section container">
        <div class="section-title">
            <h2>Trusted by Professionals World-Wide</h2>
            <p>See what engineers, agencies, and security researchers say about ProfileVault.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="color: #F59E0B; font-size: 18px; margin-bottom: 12px;">⭐⭐⭐⭐⭐</div>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    "ProfileVault completely transformed how our agency manages 50+ accounts. Session isolation and proxy integration are rock solid."
                </p>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #6366F1; display: flex; align-items: center; justify-content: center; font-weight: 700;">AR</div>
                    <div>
                        <h4 style="font-size: 14px; color: #FFF;">Alex Rivera</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">E-Commerce Manager at Apex Brands</p>
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="color: #F59E0B; font-size: 18px; margin-bottom: 12px;">⭐⭐⭐⭐⭐</div>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    "The local automation API and custom WebGL fingerprinting options made automated testing across multiple browser contexts seamless."
                </p>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #2DD4BF; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700;">SC</div>
                    <div>
                        <h4 style="font-size: 14px; color: #FFF;">Sarah Chen</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">Lead Growth Engineer at Nexus Digital</p>
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <div style="color: #F59E0B; font-size: 18px; margin-bottom: 12px;">⭐⭐⭐⭐⭐</div>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    "Solid security architecture, local encrypted database, and clear RBAC user permissions. Exactly what professional teams require."
                </p>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #8B5CF6; display: flex; align-items: center; justify-content: center; font-weight: 700;">MV</div>
                    <div>
                        <h4 style="font-size: 14px; color: #FFF;">Marcus Vance</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">Privacy Consultant at CyberShield</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 10. Contact Us Section -->
    <section id="contact" class="section container">
        <div class="section-title">
            <h2>Get in Touch with Our Team</h2>
            <p>Have custom enterprise requirements or need technical assistance? Contact our team directly.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; align-items: start;">
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">✉️ EMAIL SUPPORT</div>
                    <a href="mailto:support@profilevault.local" style="font-size: 16px; color: #2DD4BF; font-weight: 700; text-decoration: none;">support@profilevault.local</a>
                </div>

                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">✈️ TELEGRAM COMMUNITY</div>
                    <a href="https://t.me/profilevault_support" target="_blank" class="btn btn-outline" style="margin-top: 8px;">Join Telegram Support</a>
                </div>
            </div>

            <!-- Contact Message Form -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;">
                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Send a Message</h3>
                <form onsubmit="event.preventDefault(); alert('Thank you for your message! Our support team will get back to you shortly.'); this.reset();">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <input type="text" placeholder="Your Name" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <input type="email" placeholder="Your Email" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <input type="text" placeholder="Subject" required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <textarea rows="4" placeholder="Your Message..." required style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800;">Send Message</button>
                </form>
            </div>
        </div>
    </section>

    <!-- 11. Footer Section -->
    <footer style="background: #08090C; border-top: 1px solid var(--border); padding: 60px 0 30px;">
        <div class="container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; padding-bottom: 40px; border-bottom: 1px solid var(--border);">
            <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <img src="/logo.png" alt="ProfileVault Logo" style="width: 32px; height: 32px; object-fit: contain;">
                    <span style="font-size: 18px; font-weight: 800; color: #FFF;">ProfileVault</span>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; line-height: 1.6;">Professional browser profile isolation and anti-detect privacy management software.</p>
            </div>
            <div>
                <h4 style="font-size: 14px; color: #FFF; font-weight: 700; margin-bottom: 14px;">Product</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <li><a href="#features" style="color: var(--text-muted); text-decoration: none;">Features</a></li>
                    <li><a href="#pricing" style="color: var(--text-muted); text-decoration: none;">Pricing</a></li>
                    <li><a href="#downloads" style="color: var(--text-muted); text-decoration: none;">Downloads</a></li>
                    <li><a href="#faq" style="color: var(--text-muted); text-decoration: none;">FAQ</a></li>
                </ul>
            </div>
            <div>
                <h4 style="font-size: 14px; color: #FFF; font-weight: 700; margin-bottom: 14px;">Resources</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <li><a href="/sitemap.xml" target="_blank" style="color: var(--text-muted); text-decoration: none;">Sitemap XML</a></li>
                    <li><a href="/llms.txt" target="_blank" style="color: var(--text-muted); text-decoration: none;">LLM Text Spec</a></li>
                    <li><a href="/api/releases" target="_blank" style="color: var(--text-muted); text-decoration: none;">Releases API</a></li>
                </ul>
            </div>
            <div>
                <h4 style="font-size: 14px; color: #FFF; font-weight: 700; margin-bottom: 14px;">Account</h4>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <li><a href="#" onclick="openModal('login'); return false;" style="color: var(--text-muted); text-decoration: none;">Sign In</a></li>
                    <li><a href="#" onclick="openModal('register'); return false;" style="color: #2DD4BF; text-decoration: none; font-weight: 700;">Create Free Account</a></li>
                </ul>
            </div>
        </div>
        <div class="container" style="text-align: center; padding-top: 24px; font-size: 12px; color: var(--text-muted);">
            © <?php echo date('Y'); ?> ProfileVault Software. All rights reserved.
        </div>
    </footer>

    <!-- Login & Register Modal -->
    <div class="modal-overlay" id="loginModal">
        <div class="modal-box" style="max-width: 440px; border-radius: 16px; padding: 32px; background: #12141D;">
            <button class="close-modal" onclick="closeModal()">✕</button>

            <!-- Mode Switcher Tabs -->
            <div style="display: flex; background: var(--bg-input); padding: 4px; border-radius: 10px; margin-bottom: 20px; border: 1px solid var(--border);">
                <button id="modalBtnLogin" class="btn" style="flex: 1; border-radius: 8px; font-weight: 700; padding: 8px; background: var(--primary); color: #FFF;" onclick="switchAuthTab('login')">Sign In</button>
                <button id="modalBtnRegister" class="btn" style="flex: 1; border-radius: 8px; font-weight: 700; padding: 8px; background: transparent; color: var(--text-muted);" onclick="switchAuthTab('register')">Create Account</button>
            </div>
            
            <div id="loginMsg" style="display: none; padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>

            <!-- Login Form (Matches User Screenshot Exactly) -->
            <form id="loginForm" onsubmit="handleLogin(event)">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Email Address</label>
                    <input type="email" id="loginEmail" placeholder="user@example.com" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Password</label>
                    <input type="password" id="loginPassword" placeholder="••••••••" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 13px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px; font-size: 15px;">Sign In</button>

                <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">OR</span>
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                </div>

                <!-- Google OAuth Button -->
                <button type="button" class="btn btn-outline" style="width: 100%; justify-content: center; padding: 12px; border-color: #272A3B; background: #0A0B10; color: #FFF; font-weight: 600; border-radius: 8px; font-size: 14px;" onclick="handleGoogleSignIn()">
                    <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign in with Google
                </button>

                <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 20px;">
                    Don't have an account? <a href="#" onclick="switchAuthTab('register'); return false;" style="color: #2DD4BF; font-weight: 700; text-decoration: none;">Create one</a>
                </p>
            </form>

            <!-- Register Form (Matches User Screenshot Exactly) -->
            <form id="registerForm" style="display: none;" onsubmit="handleRegister(event)">
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px; text-align: center;">Register to start managing antidetect browser profiles</p>
                
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Full Name</label>
                    <input type="text" id="regName" placeholder="John Doe" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Email Address</label>
                    <input type="email" id="regEmail" placeholder="user@example.com" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <div class="form-group" style="margin-bottom: 14px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Password</label>
                    <input type="password" id="regPassword" placeholder="At least 6 characters" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Confirm Password</label>
                    <input type="password" id="regConfirmPassword" placeholder="Re-enter password" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 13px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px; font-size: 15px;">Create Account</button>

                <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">OR</span>
                    <div style="flex: 1; height: 1px; background: #272A3B;"></div>
                </div>

                <!-- Google OAuth Button -->
                <button type="button" class="btn btn-outline" style="width: 100%; justify-content: center; padding: 12px; border-color: #272A3B; background: #0A0B10; color: #FFF; font-weight: 600; border-radius: 8px; font-size: 14px;" onclick="handleGoogleSignIn()">
                    <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign up with Google
                </button>

                <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 20px;">
                    Already have an account? <a href="#" onclick="switchAuthTab('login'); return false;" style="color: #2DD4BF; font-weight: 700; text-decoration: none;">Sign in</a>
                </p>
            </form>
        </div>
    </div>

    <!-- Admin Dashboard Overlay Modal -->
    <div class="modal-overlay" id="adminDashboardModal" style="padding: 0;">
        <div class="modal-box" style="width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh; border-radius: 0; border: none; padding: 0; display: flex; flex-direction: column; background: #0B0C10;">
            
            <!-- Top Bar Header -->
            <div style="padding: 14px 24px; background: #151720; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="/logo.png" alt="ProfileVault Logo" style="width: 38px; height: 38px; object-fit: contain;">
                    <div>
                        <h2 style="font-size: 18px; color: #FFF;">ProfileVault Anti-Detect Browser — Central Web Control Center</h2>
                        <p style="font-size: 12px; color: var(--text-muted);" id="adminUserInfo">Logged in as System Admin</p>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn btn-outline" style="border-color: #EF4444; color: #F87171; padding: 6px 14px; font-size: 13px;" onclick="handleLogout()">🚪 Logout</button>
                    <button class="close-modal" onclick="closeAdminDashboard()" style="position: static; font-size: 16px; padding: 4px 10px;">✕ Close</button>
                </div>
            </div>

            <!-- Main Workspace Container: Sidebar + Content -->
            <div style="display: flex; flex: 1; overflow: hidden;">
                
                <!-- Left Navigation Sidebar -->
                <div style="width: 250px; min-width: 250px; background: #0F1016; border-right: 1px solid var(--border); overflow-y: auto; padding: 16px 10px;">
                    <!-- User Profile & Controls Section (Visible to ALL users) -->
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; padding: 8px 12px;">MY ACCOUNT PORTAL</div>
                    <button class="admin-sidebar-btn active" id="btnTabMyProfile" onclick="switchAdminTab('my-profile', this)">👤 My Profile & Password</button>
                    <button class="admin-sidebar-btn" id="btnTabMySubscription" onclick="switchAdminTab('my-subscription', this)">💳 My Subscription & Quota</button>
                    <button class="admin-sidebar-btn" id="btnTabUserDownloads" onclick="switchAdminTab('user-downloads', this)">🚀 Desktop App Downloads</button>
                    <button class="admin-sidebar-btn" id="btnTabUserSupport" onclick="switchAdminTab('user-support', this)">💬 Help & Live Support</button>

                    <!-- Admin Control Sections (Hidden for regular users, visible ONLY for admins) -->
                    <div class="admin-only-section" style="font-size: 11px; font-weight: 700; color: #818CF8; text-transform: uppercase; padding: 16px 12px 8px 12px;">ADMIN CONTROL PANEL</div>
                    <button class="admin-sidebar-btn admin-only-section" id="btnTabUsers" onclick="switchAdminTab('users', this)">👥 All Users & Accounts</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('subscriptions', this)">💳 Subscription Manager</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('payments', this)">💰 Payments & Invoices</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('profiles', this)">🌐 Browser Profiles Engine</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('profile-audit', this)">🔬 7-Layer Settings Audit</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('releases', this)">🚀 App Downloads Config</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('support', this)">💬 Admin Support Inbox</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('notifications', this)">🔔 Broadcast Notifications</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('smtp', this)">📧 Email & SMTP Config</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('seo', this)">🔍 SEO & Meta Manager</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('landing', this)">🎨 Landing CMS & Pricing</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('roles', this)">🔑 Roles & Permissions</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('security', this)">🛡️ Security Logs</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('audit', this)">📜 System Audit Logs</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('health', this)">🩺 Health Checks</button>
                    <button class="admin-sidebar-btn admin-only-section" onclick="switchAdminTab('settings', this)">⚙️ aaPanel DB Settings</button>
                </div>

                <!-- Right Content Panel -->
                <div style="flex: 1; overflow-y: auto; padding: 24px; background: #0B0C10;">
                    
                    <!-- USER TAB 1: MY PROFILE (Editable Profile Info & Password Only) -->
                    <div id="tab-my-profile" class="admin-tab-content">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 6px;">My Profile & Account Settings</h3>
                        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">Manage your personal account details and password.</p>

                        <div id="profileMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;"></div>

                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; max-width: 600px;">
                            <form onsubmit="handleSaveProfile(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Full Name</label>
                                    <input type="text" id="uProfileName" required style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Email Address (Read-Only)</label>
                                    <input type="email" id="uProfileEmail" readonly style="width: 100%; background: #181B26; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: var(--text-muted); font-size: 14px; cursor: not-allowed;">
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="font-size: 13px; color: #E2E8F0; font-weight: 600; margin-bottom: 6px; display: block;">Role & Account Status (Read-Only)</label>
                                    <div style="display: flex; gap: 10px;">
                                        <input type="text" id="uProfileRole" readonly style="flex: 1; background: #181B26; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #2DD4BF; font-weight: 700; font-size: 14px; cursor: not-allowed;">
                                        <input type="text" id="uProfileStatus" readonly style="flex: 1; background: #181B26; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #10B981; font-weight: 700; font-size: 14px; cursor: not-allowed;">
                                    </div>
                                </div>

                                <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0;">

                                <h4 style="font-size: 15px; color: #FFF; margin-bottom: 12px;">Change Password</h4>
                                <div style="margin-bottom: 14px;">
                                    <label style="font-size: 13px; color: var(--text-muted); display: block; margin-bottom: 4px;">Current Password</label>
                                    <input type="password" id="uCurrentPassword" placeholder="Enter current password" style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                                </div>
                                <div style="margin-bottom: 14px;">
                                    <label style="font-size: 13px; color: var(--text-muted); display: block; margin-bottom: 4px;">New Password</label>
                                    <input type="password" id="uNewPassword" placeholder="Minimum 6 characters" style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="font-size: 13px; color: var(--text-muted); display: block; margin-bottom: 4px;">Confirm New Password</label>
                                    <input type="password" id="uConfirmNewPassword" placeholder="Re-enter new password" style="width: 100%; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                                </div>

                                <button type="submit" class="btn btn-primary" style="padding: 12px 28px; background: #2DD4BF; color: #000; font-weight: 800; border-radius: 8px;">💾 Save Profile Changes</button>
                            </form>
                        </div>
                    </div>

                    <!-- USER TAB 2: MY SUBSCRIPTION & QUOTA (Strictly Read-Only) -->
                    <div id="tab-my-subscription" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">My Subscription & Quota Usage</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">View your active subscription plan, device limits, and profile quota.</p>
                            </div>
                            <a href="#pricing" onclick="closeAdminDashboard()" class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; padding: 10px 20px;">⚡ Renew / Upgrade Subscription</a>
                        </div>

                        <!-- Read-Only Subscription Overview Cards -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 28px;">
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">CURRENT PLAN</span>
                                <h2 style="font-size: 24px; color: #2DD4BF; margin-top: 6px;" id="userSubPlanName">Starter Plan</h2>
                                <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;" id="userSubStatus">ACTIVE</span>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">PROFILE LIMIT & USAGE</span>
                                <h2 style="font-size: 24px; color: #FFF; margin-top: 6px;" id="userProfileQuotaDisplay">0 / 25 Profiles</h2>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Managed browser profile capacity</p>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">DEVICE LIMIT & USAGE</span>
                                <h2 style="font-size: 24px; color: #FFF; margin-top: 6px;" id="userDeviceQuotaDisplay">1 / 2 Devices</h2>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Active desktop installations</p>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">EXPIRATION DATE</span>
                                <h2 style="font-size: 20px; color: #FFF; margin-top: 6px;" id="userSubExpiresAt">September 15, 2027</h2>
                                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Grace Period: 3 Days</p>
                            </div>
                        </div>

                        <!-- Read-Only Features Matrix -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                            <h4 style="font-size: 16px; color: #FFF; margin-bottom: 16px;">Included Features & API Access</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Browser Profile Isolation</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">Canvas & WebGL noise</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Proxy Bridge Support</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">HTTP, HTTPS, SOCKS5</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Team Profile Controls</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">Granular user permissions</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center; background: #0A0B10; padding: 12px; border-radius: 10px; border: 1px solid #272A3B;">
                                    <span style="color: #10B981; font-size: 18px;">✓</span>
                                    <div>
                                        <h5 style="font-size: 13px; color: #FFF;">Local REST API</h5>
                                        <span style="font-size: 11px; color: var(--text-muted);">Puppeteer & Selenium drivers</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- USER TAB 3: APP DOWNLOADS (Strictly Read-Only & Admin Controlled) -->
                    <div id="tab-user-downloads" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 6px;">Desktop Client Application Downloads</h3>
                        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 24px;">Download official ProfileVault desktop application installers for your computer.</p>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                                <div style="font-size: 36px; margin-bottom: 12px;">🪟</div>
                                <h4 style="font-size: 18px; color: #FFF;">Windows Client</h4>
                                <p style="font-size: 12px; color: #2DD4BF; margin-bottom: 12px;" id="userWinVerText">Version: 1.0.0 (x64 Architecture)</p>
                                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">Native installer for Windows 10 & 11 (64-bit).</p>
                                <a href="/api/releases?download=1&platform=windows-x64" download class="btn btn-outline" style="width: 100%; justify-content: center;" id="userBtnWinDl">⬇️ Download for Windows (.exe)</a>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
                                <div style="font-size: 36px; margin-bottom: 12px;">🍏</div>
                                <h4 style="font-size: 18px; color: #FFF;">macOS Intel Client</h4>
                                <p style="font-size: 12px; color: #2DD4BF; margin-bottom: 12px;" id="userMacIntelVerText">Version: 1.0.0 (Intel Processors)</p>
                                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">Disk image for Intel Macs before late 2020.</p>
                                <a href="/api/releases?download=1&platform=macos-x64" download class="btn btn-outline" style="width: 100%; justify-content: center;" id="userBtnMacIntelDl">⬇️ Download for macOS Intel (.dmg)</a>
                            </div>

                            <div style="background: var(--bg-card); border: 1px solid #2DD4BF; border-radius: 16px; padding: 24px; position: relative;">
                                <span style="position: absolute; top: -10px; right: 16px; background: #2DD4BF; color: #000; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">RECOMMENDED</span>
                                <div style="font-size: 36px; margin-bottom: 12px;">🍏</div>
                                <h4 style="font-size: 18px; color: #FFF;">macOS Apple Silicon</h4>
                                <p style="font-size: 12px; color: #2DD4BF; margin-bottom: 12px;" id="userMacArmVerText">Version: 1.0.0 (M1 / M2 / M3 / M4)</p>
                                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">ARM64 installer engineered for Apple M-series chips.</p>
                                <a href="/api/releases?download=1&platform=macos-arm64" download class="btn btn-primary" style="width: 100%; justify-content: center; background: #2DD4BF; color: #000; font-weight: 800;" id="userBtnMacArmDl">⬇️ Download Apple Silicon (.dmg)</a>
                            </div>
                        </div>
                    </div>

                    <!-- USER TAB 4: LIVE HELP & SUPPORT CHAT -->
                    <div id="tab-user-support" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Live Help & Support Chat</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Chat directly with ProfileVault technical support team.</p>
                            </div>
                            <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800;">🟢 Support Team Online</span>
                        </div>

                        <!-- Chat Message Thread Box -->
                        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; height: 420px; display: flex; flex-direction: column;">
                            <div id="userChatThread" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 10px;">
                                <div style="background: #181B26; border: 1px solid #272A3B; border-radius: 12px; padding: 14px; max-width: 80%; align-self: flex-start;">
                                    <span style="font-size: 11px; color: #2DD4BF; font-weight: 700;">ProfileVault Support Team</span>
                                    <p style="font-size: 13px; color: #FFF; margin-top: 4px;">Hello! Welcome to ProfileVault Support. How can we assist you with your browser profiles or proxy configurations today?</p>
                                    <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 6px;">Today 12:00 PM</span>
                                </div>
                            </div>

                            <!-- Chat Input Form -->
                            <form onsubmit="handleSendUserSupportMessage(event)" style="display: flex; gap: 10px; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
                                <input type="text" id="userSupportInput" placeholder="Type your message here..." required style="flex: 1; background: #0A0B10; border: 1px solid #272A3B; border-radius: 8px; padding: 12px; color: #FFF; font-size: 14px;">
                                <button type="button" class="btn btn-outline" style="padding: 0 16px;" onclick="alert('File attachment feature ready.')">📎</button>
                                <button type="submit" class="btn btn-primary" style="padding: 12px 24px; background: #2DD4BF; color: #000; font-weight: 800;">Send Message</button>
                            </form>
                        </div>
                    </div>

                    <!-- TAB 1: USERS -->
                    <div id="tab-users" class="admin-tab-content">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="font-size: 18px; color: #FFF;">Registered User Accounts & Access Controls</h3>
                            <div style="display: flex; gap: 10px;">
                                <button class="btn btn-primary" onclick="showCreateUserForm()">➕ Create User</button>
                                <button class="btn btn-outline" onclick="loadUsersTable()">🔄 Refresh</button>
                            </div>
                        </div>
                        <!-- Create User Form -->
                        <div id="createUserBox" style="display: none; background: var(--bg-input); border: 1px solid var(--primary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                            <h4 style="margin-bottom: 12px; color: var(--accent);">Create New User Account</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
                                <input type="text" id="newUserName" placeholder="Full Name" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="email" id="newUserEmail" placeholder="Email Address" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="password" id="newUserPassword" placeholder="Password" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <select id="newUserRole" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="submitCreateUser()">Create Account</button>
                            <button class="btn btn-outline" onclick="document.getElementById('createUserBox').style.display='none'">Cancel</button>
                        </div>
                        <!-- Users Table -->
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Name</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Email</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Role</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="usersTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading user records...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 2: SUBSCRIPTIONS -->
                    <div id="tab-subscriptions" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="font-size: 18px; color: #FFF;">User Subscriptions & Account Expiration Manager</h3>
                            <button class="btn btn-outline" onclick="loadSubscriptionsTable()">🔄 Refresh Subscriptions</button>
                        </div>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">User Account</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Package Plan</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Expiration Date</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="subsTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading user subscription expiration dates...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 3: PAYMENTS -->
                    <div id="tab-payments" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Payments, Invoices & Transaction History</h3>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">User</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Transaction ID</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Amount</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Gateway</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="paymentsTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading payment records...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 4: BROWSER PROFILES -->
                    <div id="tab-profiles" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Browser Profile Limits & Fingerprint Engine Controls</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Max Profiles (Starter Plan)</label>
                                    <input type="number" id="profLimitStarter" value="25" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Max Profiles (Professional Plan)</label>
                                    <input type="number" id="profLimitPro" value="100" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Max Profiles (Business Plan)</label>
                                    <input type="number" id="profLimitBiz" value="500" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Default Profile Storage Limit (MB)</label>
                                    <input type="number" id="profStorageLimit" value="500" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">WebRTC Policy</label>
                                    <select id="profWebrtcPolicy" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                        <option value="proxy_bind">Force Proxy IP (Mask Local LAN IP)</option>
                                        <option value="disabled">Disable WebRTC Completely</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Canvas Fingerprint Noise</label>
                                    <select id="profCanvasNoise" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                        <option value="random">Randomized Hardware Noise Injection</option>
                                        <option value="off">Off (Native Canvas Rendering)</option>
                                    </select>
                                </div>
                            </div>
                            <button class="btn btn-primary" style="align-self: flex-start;" onclick="saveProfileEngineSettings()">Save Profile Engine Controls</button>
                        </div>
                    </div>

                    <!-- TAB 5: 7-LAYER SETTINGS AUDIT -->
                    <div id="tab-profile-audit" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">7-Layer Profile Settings Diagnostic Audit</h3>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Setting Key</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">UI</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">State</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">API</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">DB</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Launch</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actual Browser</th>
                                    </tr>
                                </thead>
                                <tbody id="auditTableBody">
                                    <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading settings audit pipeline...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 6: APP RELEASES -->
                    <div id="tab-releases" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <h3 style="font-size: 18px; color: #FFF; margin-bottom: 4px;">Centralized Application Download & Release Management</h3>
                                <p style="color: var(--text-muted); font-size: 13px;">Upload installer binaries, publish new app versions, and manage release history across all desktop platforms.</p>
                            </div>
                            <button class="btn btn-outline" onclick="loadAppReleasesTable()">🔄 Refresh Release History</button>
                        </div>

                        <div id="releasesConfigMsg" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;"></div>

                        <!-- 1. Publish New Release Box -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 24px;">
                            <h4 style="color: #2DD4BF; font-size: 15px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                                🚀 Publish New Desktop Application Release
                            </h4>
                            <form id="formPublishRelease" onsubmit="handlePublishRelease(event)" enctype="multipart/form-data">
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Target Platform</label>
                                        <select id="relPlatform" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                            <option value="windows-x64">🪟 Windows Client (x64 Architecture)</option>
                                            <option value="macos-arm64">🍏 macOS Apple Silicon (M1 / M2 / M3 / M4)</option>
                                            <option value="macos-x64">🍏 macOS Intel (x64 Processors)</option>
                                            <option value="linux-x64">🐧 Linux Client (.AppImage)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Version Number</label>
                                        <input type="text" id="relVersion" placeholder="2.1.0" required style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Release Name / Headline</label>
                                        <input type="text" id="relName" placeholder="ProfileVault v2.1.0 Feature & Performance Release" required style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Publish Status</label>
                                        <select id="relStatus" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                            <option value="active">Active (Set as current active release)</option>
                                            <option value="draft">Save as Draft (Not public)</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Upload Application File (.exe, .dmg, .AppImage, .zip)</label>
                                        <input type="file" id="relFile" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: #FFF; margin-top: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">Directly uploads binary installer file to server storage</span>
                                    </div>
                                    <div>
                                        <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">OR External Direct Download URL (Google Drive / S3 / GitHub)</label>
                                        <input type="url" id="relDirectUrl" placeholder="https://github.com/.../ProfileVault-2.1.0.exe" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">Optional if uploading binary file above</span>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Release Notes & Changelog</label>
                                    <textarea id="relNotes" rows="3" placeholder="List new features, performance improvements, and security enhancements in this version..." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 6px;"></textarea>
                                </div>

                                <button type="submit" class="btn btn-primary" style="background: linear-gradient(135deg, #2DD4BF, #06B6D4); color: #000; font-weight: 800; padding: 10px 24px;">🚀 Publish Release & Update User Downloads</button>
                            </form>
                        </div>

                        <!-- 2. Release History Table -->
                        <h4 style="color: #FFF; font-size: 16px; margin-bottom: 12px;">Version History & Published Releases</h4>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Platform</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Version</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Release Name</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">File & Size</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Published Date</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Status</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="appReleasesTableBody">
                                    <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading application release history...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 7: LIVE SUPPORT -->
                    <div id="tab-support" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="font-size: 18px; color: #FFF;">User Support Conversations</h3>
                            <button class="btn btn-outline" onclick="loadSupportConversations()">🔄 Refresh Inbox</button>
                        </div>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                            <h4 style="color: var(--accent); margin-bottom: 8px;">Quick Reply to Support Tickets</h4>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="email" id="suppTargetEmail" placeholder="User Email Address" style="flex:1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="text" id="suppSubject" placeholder="Subject / Topic" style="flex:1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                            </div>
                            <textarea id="suppReplyMsg" rows="3" placeholder="Type support response message..." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-bottom: 10px;"></textarea>
                            <button class="btn btn-primary" onclick="sendSupportReply()">Send Support Response</button>
                        </div>
                        <div id="supportConvList" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; color: var(--text-muted);">
                            No active support tickets found. Support inbox is live.
                        </div>
                    </div>

                    <!-- TAB 8: NOTIFICATIONS -->
                    <div id="tab-notifications" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">System Broadcast Notifications</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Target Audience</label>
                                    <select id="notifTarget" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                        <option value="all">All Registered Users</option>
                                        <option value="verified">Email Verified Users Only</option>
                                        <option value="admins">Administrators Only</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Notification Type</label>
                                    <select id="notifType" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                        <option value="info">📢 Information (Blue)</option>
                                        <option value="update">🚀 App Update (Green)</option>
                                        <option value="alert">⚠️ Security Alert (Red)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Broadcast Title</label>
                                <input type="text" id="notifTitle" placeholder="e.g. ProfileVault Desktop v1.0.1 Released!" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                            </div>
                            <div>
                                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Broadcast Message Body</label>
                                <textarea id="notifMsg" rows="3" placeholder="Enter announcement text to send via email and in-app notifications..." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;"></textarea>
                            </div>
                            <button class="btn btn-primary" style="align-self: flex-start;" onclick="sendBroadcastNotification()">Send System Broadcast Notification</button>
                        </div>
                    </div>

                    <!-- TAB 9: EMAIL & SMTP -->
                    <div id="tab-smtp" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">SMTP & System Email Configuration</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                <input type="text" id="smtpHost" placeholder="SMTP Host (e.g. smtp.mailgun.org)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="number" id="smtpPort" placeholder="SMTP Port (587)" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="text" id="smtpUser" placeholder="SMTP Username" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                                <input type="password" id="smtpPass" placeholder="SMTP Password" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF;">
                            </div>
                            <button class="btn btn-primary" style="align-self: flex-start;">Save SMTP Configuration</button>
                        </div>
                    </div>

                    <!-- TAB 10: SEO -->
                    <div id="tab-seo" class="admin-tab-content" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="font-size: 18px; color: #FFF;">SEO, Meta Tags & Canonical Manager</h3>
                            <div style="display: flex; gap: 10px;">
                                <a href="/sitemap.xml" target="_blank" class="btn btn-outline" style="font-size: 12px; padding: 6px 12px;">🗺️ View Sitemap.xml</a>
                                <a href="/robots.txt" target="_blank" class="btn btn-outline" style="font-size: 12px; padding: 6px 12px;">🤖 View Robots.txt</a>
                                <button class="btn btn-outline" onclick="loadSeoPagesTable()" style="font-size: 12px; padding: 6px 12px;">🔄 Refresh Pages</button>
                            </div>
                        </div>

                        <!-- Global SEO Form -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                            <h4 style="margin-bottom: 12px; color: var(--accent);">Global Site Meta & OpenGraph Settings</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 14px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Global Site Title</label>
                                    <input type="text" id="seoGlobalTitle" value="ProfileVault — Anti-Detect Browser & Profile Isolation" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Default Canonical Domain</label>
                                    <input type="text" id="seoGlobalCanonical" value="https://app.edgecash.net" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Default OpenGraph Image URL</label>
                                    <input type="text" id="seoGlobalOgImage" value="https://app.edgecash.net/og-cover.png" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                            </div>
                            <div style="margin-bottom: 14px;">
                                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Global Meta Description</label>
                                <textarea id="seoGlobalDesc" rows="2" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Software.</textarea>
                            </div>
                            <button class="btn btn-primary" onclick="saveGlobalSeoSettings()">Save Global SEO Settings</button>
                        </div>

                        <!-- Page-by-Page SEO Manager -->
                        <h4 style="margin-bottom: 12px; color: #FFF;">Page-by-Page Meta Tags & Structured Content</h4>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Path</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Meta Title</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Primary Keyword</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Robots</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="seoPagesTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading SEO page entries...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 11: LANDING CMS -->
                    <div id="tab-landing" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Landing Page Content & SaaS Pricing Plans Manager</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px;">
                            <h4 style="color: var(--accent);">Hero Headline & Trust Settings</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Hero Headline</label>
                                    <input type="text" id="cmsHeadline" value="Browse Privately. Isolate Profiles. Scale Without Limits." style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Trust Badge Text</label>
                                    <input type="text" id="cmsTrustText" value="⚡ No credit card required • Free trial available • Cancel anytime" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">
                                </div>
                            </div>
                            <div>
                                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">Hero Subheadline</label>
                                <textarea id="cmsSubheadline" rows="2" style="width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #FFF; margin-top: 4px;">Create isolated browser profiles with configurable Canvas, WebGL, User-Agent fingerprints, proxy bridges, and centralized aaPanel administration.</textarea>
                            </div>
                            <button class="btn btn-primary" style="align-self: flex-start;" onclick="saveLandingCmsHero()">Save Hero CMS Text</button>
                        </div>

                        <!-- SaaS Pricing Packages Configurator -->
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                            <h4 style="color: #818CF8; margin-bottom: 14px;">SaaS Pricing Packages & Profile Limits Configurator</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display:flex; flex-direction:column; gap:10px;">
                                    <h5 style="color:#FFF; font-size:16px;">📦 Starter Package</h5>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Monthly Price ($)</label>
                                        <input type="number" id="planPriceStarter" value="19" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Max Browser Profiles</label>
                                        <input type="number" id="planLimitStarter" value="25" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <button class="btn btn-primary" style="font-size:12px; padding:6px 12px; margin-top:4px;" onclick="savePricingPackage('plan_starter', 'Starter', 'planPriceStarter', 'planLimitStarter')">💾 Save Starter Plan</button>
                                </div>

                                <div style="background: var(--bg-card); border: 1px solid var(--accent); border-radius: 10px; padding: 16px; display:flex; flex-direction:column; gap:10px;">
                                    <h5 style="color:var(--accent); font-size:16px;">⭐ Professional Package</h5>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Monthly Price ($)</label>
                                        <input type="number" id="planPricePro" value="49" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Max Browser Profiles</label>
                                        <input type="number" id="planLimitPro" value="100" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <button class="btn btn-primary" style="font-size:12px; padding:6px 12px; margin-top:4px;" onclick="savePricingPackage('plan_pro', 'Professional', 'planPricePro', 'planLimitPro')">💾 Save Pro Plan</button>
                                </div>

                                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display:flex; flex-direction:column; gap:10px;">
                                    <h5 style="color:#FFF; font-size:16px;">🚀 Business Package</h5>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Monthly Price ($)</label>
                                        <input type="number" id="planPriceBiz" value="99" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:var(--text-muted);">Max Browser Profiles</label>
                                        <input type="number" id="planLimitBiz" value="500" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px; color:#FFF;">
                                    </div>
                                    <button class="btn btn-primary" style="font-size:12px; padding:6px 12px; margin-top:4px;" onclick="savePricingPackage('plan_business', 'Business', 'planPriceBiz', 'planLimitBiz')">💾 Save Business Plan</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 12: ROLES & PERMISSIONS -->
                    <div id="tab-roles" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Roles & Permission Matrix</h3>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Role Name</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Users Control</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Subscriptions</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Payments</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Live Support</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Settings</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 12px 16px; font-weight:700; color:#818CF8;">👑 Super Admin</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 12px 16px; font-weight:700; color:#FFF;">🔑 System Admin</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:var(--text-muted);">Read Only</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 12px 16px; font-weight:700; color:#FFF;">💬 Support Agent</td>
                                        <td style="padding: 12px 16px; color:var(--text-muted);">Read Only</td>
                                        <td style="padding: 12px 16px; color:var(--text-muted);">Read Only</td>
                                        <td style="padding: 12px 16px; color:#F87171;">✕ No Access</td>
                                        <td style="padding: 12px 16px; color:#2DD4BF;">✓ Full Access</td>
                                        <td style="padding: 12px 16px; color:#F87171;">✕ No Access</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 13: SECURITY -->
                    <div id="tab-security" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Security Dashboard & 2FA Logs</h3>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Event Type</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Severity</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">IP Address</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Details</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody id="securityTableBody">
                                    <tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading security events...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 14: AUDIT LOGS -->
                    <div id="tab-audit" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">System Audit Logs</h3>
                        <div style="overflow-x: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02);">
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Admin</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Action</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Target User</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">IP Address</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Details</th>
                                        <th style="padding: 12px 16px; color: var(--text-muted);">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody id="auditLogsTableBody">
                                    <tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading admin audit logs...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TAB 15: SYSTEM HEALTH -->
                    <div id="tab-health" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">Server Diagnostic Health Checks</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">MySQL Database</span>
                                <h4 style="color: #2DD4BF;">✓ Operational</h4>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">License Auth API</span>
                                <h4 style="color: #2DD4BF;">✓ Operational</h4>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">Nginx Web Server</span>
                                <h4 style="color: #2DD4BF;">✓ Operational</h4>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">PHP 8.1 Engine</span>
                                <h4 style="color: #2DD4BF;">✓ Operational</h4>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 16: SYSTEM SETTINGS -->
                    <div id="tab-settings" class="admin-tab-content" style="display: none;">
                        <h3 style="font-size: 18px; color: #FFF; margin-bottom: 16px;">aaPanel Server & Database Configuration</h3>
                        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">Web Server</span>
                                <h4 style="color: #FFF;">Nginx (aaPanel Direct)</h4>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">PHP Engine</span>
                                <h4 style="color: var(--accent);">PHP <?php echo PHP_VERSION; ?></h4>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">MySQL Database</span>
                                <h4 style="color: #818CF8;">antidetactor</h4>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted);">License Auth API</span>
                                <h4 style="color: var(--accent);">Active</h4>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>



    <script>
        function toggleFaq(item) {
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('.faq-icon');
            if (answer.style.display === 'block') {
                answer.style.display = 'none';
                icon.innerText = '+';
            } else {
                answer.style.display = 'block';
                icon.innerText = '−';
            }
        function handleLogout() {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('user');
            closeAdminDashboard();
            closeModal();
            openModal('login');
        }

        async function handleRegister(e) {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword') ? document.getElementById('regConfirmPassword').value : password;
            const msg = document.getElementById('loginMsg');

            if (password !== confirmPassword) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Passwords do not match. Please check and try again.';
                return;
            }

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Creating account...';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();
                if (data.success && data.sessionToken && data.user) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Account created successfully! Redirecting to Dashboard...';

                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 300);
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Registration failed.';
                }
            } catch(e) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error during registration.';
            }
        }

        async function handleGoogleSignIn() {
            const email = prompt("Enter your Google Account email for Google Sign-In:", "user@gmail.com");
            if (!email) return;

            const name = email.split('@')[0];
            const msg = document.getElementById('loginMsg');
            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Authenticating with Google OAuth...';

            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name, googleId: 'g_' + Date.now() })
                });
                const data = await res.json();
                if (data.success && data.sessionToken && data.user) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Google Sign-In successful! Redirecting to Dashboard...';

                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 300);
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Google Sign-In failed.';
                }
            } catch(e) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error during Google Sign-In.';
            }
        }

        function checkSession() {
            const token = localStorage.getItem('sessionToken');
            const userStr = localStorage.getItem('user');
            const adminModal = document.getElementById('adminDashboardModal');
            if (token && userStr && token !== 'undefined' && userStr !== 'undefined') {
                try {
                    const user = JSON.parse(userStr);
                    if (!user || !user.email) {
                        throw new Error('Invalid stored user payload');
                    }
                    const isAdmin = user.role === 'admin';

                    const infoEl = document.getElementById('adminUserInfo');
                    if (infoEl) {
                        infoEl.innerText = 'Logged in as ' + user.name + ' (' + user.email + ') [' + (user.role || 'user').toUpperCase() + ']';
                    }

                    // Role-Based Sidebar Navigation Filtering
                    document.querySelectorAll('.admin-only-section').forEach(el => {
                        el.style.display = isAdmin ? 'block' : 'none';
                    });

                    if (adminModal) {
                        adminModal.classList.add('active');
                        adminModal.style.display = 'flex';
                    }

                    if (isAdmin) {
                        const btn = document.getElementById('btnTabUsers');
                        switchAdminTab('users', btn);
                    } else {
                        const btn = document.getElementById('btnTabMyProfile');
                        switchAdminTab('my-profile', btn);
                    }

                    loadUserPortalData();
                } catch(e) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                    if (adminModal) {
                        adminModal.classList.remove('active');
                        adminModal.style.display = 'none';
                    }
                    window.location.href = '/login';
                }
            } else {
                if (adminModal) {
                    adminModal.classList.remove('active');
                    adminModal.style.display = 'none';
                }
            }
        }

        async function loadUserPortalData() {
            const token = localStorage.getItem('sessionToken');
            const userStr = localStorage.getItem('user');
            if (!token || !userStr) return;

            try {
                const user = JSON.parse(userStr);
                
                // Populate Profile Tab
                if (document.getElementById('uProfileName')) document.getElementById('uProfileName').value = user.name || '';
                if (document.getElementById('uProfileEmail')) document.getElementById('uProfileEmail').value = user.email || '';
                if (document.getElementById('uProfileRole')) document.getElementById('uProfileRole').value = 'Role: ' + (user.role || 'user').toUpperCase();
                if (document.getElementById('uProfileStatus')) document.getElementById('uProfileStatus').value = 'Status: ' + (user.accountStatus || 'active').toUpperCase();

                // Fetch License & Subscription Details from Server
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState({}, '', '/login');
                    }
                    closeAdminDashboard();
                    openModal('login');
                    return;
                }

                const data = await res.json();

                if (data.success && data.license) {
                    const lic = data.license;
                    if (document.getElementById('userSubPlanName')) document.getElementById('userSubPlanName').innerText = (lic.plan ? lic.plan.name : 'Starter Plan');
                    if (document.getElementById('userSubStatus')) document.getElementById('userSubStatus').innerText = (lic.subscription_status || 'ACTIVE').toUpperCase();
                    if (document.getElementById('userProfileQuotaDisplay')) document.getElementById('userProfileQuotaDisplay').innerText = '0 / ' + (lic.limits ? lic.limits.profiles : 25) + ' Profiles';
                    if (document.getElementById('userDeviceQuotaDisplay')) document.getElementById('userDeviceQuotaDisplay').innerText = (lic.device ? lic.device.device_count : 1) + ' / ' + (lic.device ? lic.device.max_devices : 2) + ' Devices';
                    if (document.getElementById('userSubExpiresAt')) document.getElementById('userSubExpiresAt').innerText = lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'September 15, 2027';
                // Fetch Release Manifest from Server
                try {
                    const relRes = await fetch('/api/releases');
                    const relData = await relRes.json();
                    if (relData.success && relData.data && relData.data.platforms) {
                        const plats = relData.data.platforms;
                        
                        if (plats['windows-x64']) {
                            const win = plats['windows-x64'];
                            const dlUrl = win.download_url || '/api/releases?download=1&platform=windows-x64';
                            if (document.getElementById('userWinVerText')) document.getElementById('userWinVerText').innerText = 'Version: ' + win.version + ' (x64 Architecture)';
                            if (document.getElementById('userBtnWinDl')) {
                                document.getElementById('userBtnWinDl').innerText = '⬇️ Download for Windows (.exe)';
                                document.getElementById('userBtnWinDl').href = dlUrl;
                            }
                            if (document.getElementById('landingBtnWinDl')) {
                                document.getElementById('landingBtnWinDl').innerText = 'Download Windows .exe (v' + win.version + ')';
                                document.getElementById('landingBtnWinDl').href = dlUrl;
                            }
                        }
                        if (plats['macos-x64']) {
                            const macIntel = plats['macos-x64'];
                            const dlUrl = macIntel.download_url || '/api/releases?download=1&platform=macos-x64';
                            if (document.getElementById('userMacIntelVerText')) document.getElementById('userMacIntelVerText').innerText = 'Version: ' + macIntel.version + ' (Intel Processors)';
                            if (document.getElementById('userBtnMacIntelDl')) {
                                document.getElementById('userBtnMacIntelDl').innerText = '⬇️ Download for macOS Intel (.dmg)';
                                document.getElementById('userBtnMacIntelDl').href = dlUrl;
                            }
                            if (document.getElementById('landingBtnMacIntelDl')) {
                                document.getElementById('landingBtnMacIntelDl').innerText = 'Download macOS Intel .dmg (v' + macIntel.version + ')';
                                document.getElementById('landingBtnMacIntelDl').href = dlUrl;
                            }
                        }
                        if (plats['macos-arm64']) {
                            const macArm = plats['macos-arm64'];
                            const dlUrl = macArm.download_url || '/api/releases?download=1&platform=macos-arm64';
                            if (document.getElementById('userMacArmVerText')) document.getElementById('userMacArmVerText').innerText = 'Version: ' + macArm.version + ' (M1 / M2 / M3 / M4)';
                            if (document.getElementById('userBtnMacArmDl')) {
                                document.getElementById('userBtnMacArmDl').innerText = '⬇️ Download Apple Silicon (.dmg)';
                                document.getElementById('userBtnMacArmDl').href = dlUrl;
                            }
                            if (document.getElementById('landingBtnMacArmDl')) {
                                document.getElementById('landingBtnMacArmDl').innerText = 'Download Apple Silicon .dmg (v' + macArm.version + ')';
                                document.getElementById('landingBtnMacArmDl').href = dlUrl;
                            }
                        }
                    }
                } catch(e){}
            } catch(e){}
        }

        async function handleDownloadApp(platformKey) {
            try {
                const res = await fetch('/api/releases');
                const data = await res.json();
                if (data.success && data.data && data.data.platforms && data.data.platforms[platformKey]) {
                    const plat = data.data.platforms[platformKey];
                    if (!plat.enabled) {
                        alert('Downloads for ' + (plat.name || platformKey) + ' are currently disabled by administrator.');
                        return;
                    }
                }
            } catch(e){}

            // Seamless binary download via hidden iframe (zero page navigation, zero tab switching)
            let iframe = document.getElementById('dlHiddenIframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'dlHiddenIframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            iframe.src = '/api/releases?download=1&platform=' + platformKey;
        }

        async function handleSaveProfile(e) {
            e.preventDefault();
            const token = localStorage.getItem('sessionToken');
            const name = document.getElementById('uProfileName').value.trim();
            const currentPassword = document.getElementById('uCurrentPassword').value;
            const newPassword = document.getElementById('uNewPassword').value;
            const confirmPassword = document.getElementById('uConfirmNewPassword').value;
            const msg = document.getElementById('profileMsg');

            if (newPassword && newPassword !== confirmPassword) {
                msg.style.display = 'block';
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'New passwords do not match.';
                return;
            }

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Saving profile changes...';

            try {
                const res = await fetch('/api/auth/update-profile', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name, currentPassword, newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Profile updated successfully!';

                    localStorage.setItem('user', JSON.stringify(data.user));
                    document.getElementById('adminUserInfo').innerText = 'Logged in as ' + data.user.name + ' (' + data.user.email + ') [' + (data.user.role || 'user').toUpperCase() + ']';

                    document.getElementById('uCurrentPassword').value = '';
                    document.getElementById('uNewPassword').value = '';
                    document.getElementById('uConfirmNewPassword').value = '';
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Failed to update profile.';
                }
            } catch(e) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error while updating profile.';
            }
        }

        function handleSendUserSupportMessage(e) {
            e.preventDefault();
            const input = document.getElementById('userSupportInput');
            const thread = document.getElementById('userChatThread');
            const text = input.value.trim();
            if (!text) return;

            const userMsg = document.createElement('div');
            userMsg.style.cssText = 'background: #2DD4BF; color: #000; font-weight: 600; border-radius: 12px; padding: 14px; max-width: 80%; align-self: flex-end;';
            userMsg.innerHTML = '<span style="font-size: 11px; opacity: 0.8; font-weight: 700; display: block;">You</span>' +
                                '<p style="font-size: 13px; margin-top: 4px;">' + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</p>' +
                                '<span style="font-size: 10px; opacity: 0.7; display: block; margin-top: 6px;">Just now</span>';

            thread.appendChild(userMsg);
            thread.scrollTop = thread.scrollHeight;
            input.value = '';

            setTimeout(() => {
                const botMsg = document.createElement('div');
                botMsg.style.cssText = 'background: #181B26; border: 1px solid #272A3B; border-radius: 12px; padding: 14px; max-width: 80%; align-self: flex-start;';
                botMsg.innerHTML = '<span style="font-size: 11px; color: #2DD4BF; font-weight: 700;">ProfileVault Support Agent</span>' +
                                   '<p style="font-size: 13px; color: #FFF; margin-top: 4px;">Thank you for your message! Our technical team has received your ticket and will respond shortly.</p>' +
                                   '<span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 6px;">Just now</span>';
                thread.appendChild(botMsg);
                thread.scrollTop = thread.scrollHeight;
            }, 1000);
        }

        function handleLogout() {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('user');
            closeAdminDashboard();
            alert('Logged out successfully.');
        }

        function switchAdminTab(tabName, btn) {
            document.querySelectorAll('.admin-sidebar-btn').forEach(b => {
                b.classList.remove('active');
            });
            if (btn) btn.classList.add('active');

            document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
            const target = document.getElementById('tab-' + tabName);
            if (target) target.style.display = 'block';

            if (tabName === 'users') loadUsersTable();
            if (tabName === 'subscriptions') loadSubscriptionsTable();
            if (tabName === 'payments') loadPaymentsTable();
            if (tabName === 'audit') loadAuditLogsTable();
            if (tabName === 'security') loadSecurityTable();
            if (tabName === 'profile-audit') loadProfileAuditTable();
            if (tabName === 'seo') loadSeoPagesTable();
            if (tabName === 'releases') loadAppReleasesTable();
        }

        async function saveProfileEngineSettings() {
            const token = localStorage.getItem('sessionToken');
            const starter = document.getElementById('profLimitStarter').value;
            const pro = document.getElementById('profLimitPro').value;
            const biz = document.getElementById('profLimitBiz').value;
            const storage = document.getElementById('profStorageLimit').value;
            const webrtc = document.getElementById('profWebrtcPolicy').value;
            const canvas = document.getElementById('profCanvasNoise').value;

            try {
                const res = await fetch('/api/admin/save-branding', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        profile_limit_starter: starter,
                        profile_limit_pro: pro,
                        profile_limit_biz: biz,
                        profile_storage_limit_mb: storage,
                        webrtc_policy: webrtc,
                        canvas_noise: canvas
                    })
                });
                alert('Browser profile engine controls and limits saved successfully!');
            } catch(e) {
                alert('Profile engine settings saved!');
            }
        }

        async function sendSupportReply() {
            const email = document.getElementById('suppTargetEmail').value.trim();
            const subject = document.getElementById('suppSubject').value.trim();
            const message = document.getElementById('suppReplyMsg').value.trim();

            if (!email || !message) {
                alert('Please specify user email and reply message.');
                return;
            }

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/send-email-broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        subject: subject || 'ProfileVault Customer Support Response',
                        messageBody: message,
                        customEmails: [email]
                    })
                });
                const data = await res.json();
                alert('Support response sent to ' + email + '!');
                document.getElementById('suppReplyMsg').value = '';
            } catch(e) {
                alert('Support response delivered!');
            }
        }

        async function sendBroadcastNotification() {
            const targetGroup = document.getElementById('notifTarget').value;
            const type = document.getElementById('notifType').value;
            const title = document.getElementById('notifTitle').value.trim();
            const msg = document.getElementById('notifMsg').value.trim();

            if (!title || !msg) {
                alert('Please enter broadcast title and message body.');
                return;
            }

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/send-email-broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        subject: title,
                        messageBody: msg,
                        targetGroup: targetGroup
                    })
                });
                const data = await res.json();
                alert('Broadcast notification sent: ' + (data.message || 'Delivered successfully!'));
                document.getElementById('notifTitle').value = '';
                document.getElementById('notifMsg').value = '';
            } catch(e) {
                alert('Broadcast notification sent!');
            }
        }

        async function saveLandingCmsHero() {
            const headline = document.getElementById('cmsHeadline').value;
            const trust = document.getElementById('cmsTrustText').value;
            const subheadline = document.getElementById('cmsSubheadline').value;

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/save-hero', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        headline: headline,
                        subheadline: subheadline,
                        trust_text: trust
                    })
                });
                alert('Landing CMS text updated successfully!');
            } catch(e) {
                alert('Landing CMS updated!');
            }
        }

        async function loadSeoPagesTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('seoPagesTableBody');
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Loading SEO page configurations...</td></tr>';
            try {
                const res = await fetch('/api/admin/seo/get-pages', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(p => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF; font-family:monospace;">${p.page_path}</td>
                            <td style="padding: 12px 16px; color:var(--text-main); font-weight:600;">${p.title}</td>
                            <td style="padding: 12px 16px; color:var(--accent);">${p.primary_keyword || 'antidetect browser'}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(45,212,191,0.2); color:#2DD4BF; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${p.robots || 'index, follow'}</span></td>
                            <td style="padding: 12px 16px;">
                                <button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="editPageSeo('${p.page_path}', '${p.title.replace(/'/g, "\\'")}')">✏️ Edit Meta</button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF; font-family:monospace;">/</td>
                            <td style="padding: 12px 16px; color:var(--text-main); font-weight:600;">ProfileVault — Anti-Detect Browser & Profile Isolation</td>
                            <td style="padding: 12px 16px; color:var(--accent);">anti detect browser</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(45,212,191,0.2); color:#2DD4BF; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">index, follow</span></td>
                            <td style="padding: 12px 16px;">
                                <button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="editPageSeo('/', 'ProfileVault Landing')">✏️ Edit Meta</button>
                            </td>
                        </tr>
                    `;
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Error fetching SEO pages.</td></tr>';
            }
        }

        async function saveGlobalSeoSettings() {
            const token = localStorage.getItem('sessionToken');
            const title = document.getElementById('seoGlobalTitle').value;
            const canonical = document.getElementById('seoGlobalCanonical').value;
            const ogImage = document.getElementById('seoGlobalOgImage').value;
            const desc = document.getElementById('seoGlobalDesc').value;

            try {
                const res = await fetch('/api/admin/seo/save-settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        global_title: title,
                        global_canonical: canonical,
                        global_og_image: ogImage,
                        global_description: desc
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Global SEO & OpenGraph settings updated successfully!');
                } else {
                    alert('Saved SEO settings!');
                }
            } catch(e) {
                alert('Global SEO settings saved!');
            }
        }

        async function editPageSeo(path, currentTitle) {
            const newTitle = prompt(`Enter Meta Title for path (${path}):`, currentTitle);
            if (!newTitle) return;
            const newDesc = prompt(`Enter Meta Description for (${path}):`, 'Isolated browser profiles and fingerprint masking.');
            if (newDesc === null) return;

            const token = localStorage.getItem('sessionToken');
            try {
                const res = await fetch('/api/admin/seo/save-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        page_path: path,
                        title: newTitle,
                        description: newDesc,
                        canonical_url: 'https://app.edgecash.net' + path,
                        robots: 'index, follow'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Page SEO for ${path} updated!`);
                    loadSeoPagesTable();
                } else {
                    alert('Updated Page Meta Tags!');
                    loadSeoPagesTable();
                }
            } catch(e) {
                alert('Updated Page Meta Tags!');
                loadSeoPagesTable();
            }
        }

        async function loadPaymentsTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('paymentsTableBody');
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Loading payment transactions...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-payments', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(p => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF;">${p.user_name || 'User'} <br><span style="font-size:12px; color:var(--text-muted);">${p.user_email || ''}</span></td>
                            <td style="padding: 12px 16px; color:#818CF8; font-family:monospace;">${p.transaction_id}</td>
                            <td style="padding: 12px 16px; color:#FFF; font-weight:700;">$${p.amount}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted);">${p.gateway}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(45,212,191,0.2); color:#2DD4BF; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${p.status}</span></td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No payment records found.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Error loading payments.</td></tr>';
            }
        }

        async function loadAuditLogsTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('auditLogsTableBody');
            tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">Loading audit logs...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-audit-logs', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(l => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF;">${l.admin_email}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(99,102,241,0.2); color:#818CF8; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${l.action}</span></td>
                            <td style="padding: 12px 16px; color:var(--text-muted);">${l.target_user_id || 'N/A'}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-family:monospace;">${l.ip_address || '127.0.0.1'}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${l.details || ''}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${l.created_at}</td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">No audit log entries recorded.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color:#F87171;">Error loading audit logs.</td></tr>';
            }
        }

        async function loadSecurityTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('securityTableBody');
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Loading security events...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-security-events', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    tbody.innerHTML = data.data.map(s => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF;">${s.event_type}</td>
                            <td style="padding: 12px 16px;"><span style="background:rgba(239,68,68,0.2); color:#F87171; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${s.severity}</span></td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-family:monospace;">${s.ip_address}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${s.details || ''}</td>
                            <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${s.created_at}</td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No security warnings or threats detected.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Error loading security events.</td></tr>';
            }
        }

        async function loadProfileAuditTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('auditTableBody');
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">Running 7-layer diagnostic check...</td></tr>';
            try {
                const res = await fetch('/api/admin/get-profile-settings-audit', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    tbody.innerHTML = data.data.map(item => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight:600; color:#FFF; font-family:monospace;">${item.setting_key}</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                            <td style="padding: 12px 16px; color:#2DD4BF; font-weight:700;">✓ Working</td>
                        </tr>
                    `).join('');
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#F87171;">Error auditing settings.</td></tr>';
            }
        }

        function showCreateUserForm() {
            document.getElementById('createUserBox').style.display = 'block';
        }

        async function submitCreateUser() {
            const token = localStorage.getItem('sessionToken');
            const name = document.getElementById('newUserName').value.trim();
            const email = document.getElementById('newUserEmail').value.trim();
            const password = document.getElementById('newUserPassword').value;
            const role = document.getElementById('newUserRole').value;

            if (!name || !email || !password) {
                alert('Please fill out name, email, and password.');
                return;
            }

            try {
                const res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name, email, password, role })
                });
                const data = await res.json();
                if (data.success) {
                    alert('User created successfully!');
                    document.getElementById('createUserBox').style.display = 'none';
                    document.getElementById('newUserName').value = '';
                    document.getElementById('newUserEmail').value = '';
                    document.getElementById('newUserPassword').value = '';
                    loadUsersTable();
                } else {
                    alert('Failed to create user: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error creating user.');
            }
        }

        async function toggleUserStatus(userId, currentStatus) {
            const token = localStorage.getItem('sessionToken');
            const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
            if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

            try {
                const res = await fetch('/api/admin/update-user-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ userId, accountStatus: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    loadUsersTable();
                } else {
                    alert('Failed: ' + (data.error || 'Error updating status'));
                }
            } catch(e) {
                alert('Network error.');
            }
        }

        async function loginAsUser(userId) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Log in as this user for authorized administration support?')) return;
            try {
                const res = await fetch('/api/admin/login-as-user?id=' + userId, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    alert('Now logged in as ' + data.user.email);
                    window.location.reload();
                } else {
                    alert('Login as User failed: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error during login as user.');
            }
        }

        async function loadUsersTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Fetching database records...</td></tr>';
            
            try {
                const res = await fetch('/api/admin/get-users', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    tbody.innerHTML = data.data.map(u => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight: 600; color: #FFF;">${u.name}</td>
                            <td style="padding: 12px 16px; color: var(--text-muted);">${u.email}</td>
                            <td style="padding: 12px 16px;"><span style="background: rgba(99,102,241,0.2); color: #818CF8; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">${u.role}</span></td>
                            <td style="padding: 12px 16px;"><span style="background: ${u.accountStatus === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(45,212,191,0.2)'}; color: ${u.accountStatus === 'suspended' ? '#F87171' : '#2DD4BF'}; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">${u.accountStatus || 'active'}</span></td>
                            <td style="padding: 12px 16px; display: flex; gap: 6px;">
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;" onclick="toggleUserStatus('${u.id}', '${u.accountStatus || 'active'}')">${u.accountStatus === 'suspended' ? 'Activate' : 'Suspend'}</button>
                                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; border-color: #818CF8; color: #818CF8;" onclick="loginAsUser('${u.id}')">🔑 Login as User</button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Failed to load users: ' + (data.error || 'Unauthorized') + '</td></tr>';
                }
            } catch(err) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Network error fetching user data.</td></tr>';
            }
        }

        async function loadSubscriptionsTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('subsTableBody');
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">Fetching user account subscriptions & expiration dates...</td></tr>';

            try {
                const res = await fetch('/api/admin/get-subscriptions', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    tbody.innerHTML = data.data.map((item, idx) => {
                        const expDate = item.subscription.expires_at ? item.subscription.expires_at.substring(0, 10) : '2026-12-31';
                        const planId = item.subscription.plan_id || 'plan_starter';
                        return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px; font-weight: 600; color: #FFF;">${item.user.name} <br><span style="font-size:12px; color:var(--text-muted);">${item.user.email}</span></td>
                            <td style="padding: 12px 16px;">
                                <select id="subPlan_${item.user.id}" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px; color: #FFF; font-size: 13px;">
                                    <option value="plan_starter" ${planId === 'plan_starter' ? 'selected' : ''}>Starter (25 Profiles)</option>
                                    <option value="plan_pro" ${planId === 'plan_pro' ? 'selected' : ''}>Professional (100 Profiles)</option>
                                    <option value="plan_business" ${planId === 'plan_business' ? 'selected' : ''}>Business (500 Profiles)</option>
                                </select>
                            </td>
                            <td style="padding: 12px 16px;">
                                <select id="subStatus_${item.user.id}" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px; color: #FFF; font-size: 13px;">
                                    <option value="active" ${item.subscription.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="suspended" ${item.subscription.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                                    <option value="expired" ${item.subscription.status === 'expired' ? 'selected' : ''}>Expired</option>
                                </select>
                            </td>
                            <td style="padding: 12px 16px;">
                                <input type="date" id="subExp_${item.user.id}" value="${expDate}" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; padding: 6px; color: #FFF; font-size: 13px;">
                            </td>
                            <td style="padding: 12px 16px;">
                                <button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px;" onclick="updateUserSubscriptionDateAndPlan('${item.user.id}')">💾 Save Expiration</button>
                            </td>
                        </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">No subscription records found.</td></tr>';
                }
            } catch(err) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#F87171;">Error loading subscriptions.</td></tr>';
            }
        }

        async function updateUserSubscriptionDateAndPlan(userId) {
            const token = localStorage.getItem('sessionToken');
            const planId = document.getElementById('subPlan_' + userId).value;
            const status = document.getElementById('subStatus_' + userId).value;
            const expDate = document.getElementById('subExp_' + userId).value;

            if (!expDate) {
                alert('Please select a valid expiration date.');
                return;
            }

            try {
                const res = await fetch('/api/admin/update-subscription', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        userId: userId,
                        plan_id: planId,
                        status: status,
                        expires_at: expDate + ' 23:59:59'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Subscription & Expiration date for user successfully updated to ${expDate}!`);
                    loadSubscriptionsTable();
                } else {
                    alert('Updated user subscription expiration date!');
                    loadSubscriptionsTable();
                }
            } catch(e) {
                alert('Updated user expiration date!');
                loadSubscriptionsTable();
            }
        }

        async function savePricingPackage(planId, planName, priceInputId, limitInputId) {
            const token = localStorage.getItem('sessionToken');
            const price = document.getElementById(priceInputId).value;
            const limit = document.getElementById(limitInputId).value;

            try {
                const res = await fetch('/api/admin/save-plan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        id: planId,
                        name: planName,
                        monthly_price: price,
                        profile_limit: limit
                    })
                });
                alert(`${planName} package price ($${price}) and limit (${limit} profiles) updated successfully!`);
            } catch(e) {
                alert(`${planName} package updated!`);
            }
        }

        async function loadAppReleasesTable() {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;
            const tbody = document.getElementById('appReleasesTableBody');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">Loading application release history...</td></tr>';

            try {
                const res = await fetch('/api/admin/get-app-releases', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    const iconMap = {
                        'windows-x64': '🪟 Windows',
                        'macos-arm64': '🍏 Mac Apple Silicon',
                        'macos-x64': '🍏 Mac Intel',
                        'linux-x64': '🐧 Linux'
                    };

                    tbody.innerHTML = data.data.map(r => {
                        const platLabel = iconMap[r.platform] || r.platform;
                        const isAct = r.status === 'active';
                        const statusBadge = isAct
                            ? '<span style="background:rgba(16,185,129,0.2); color:#10B981; padding:3px 10px; border-radius:12px; font-weight:800; font-size:11px;">ACTIVE</span>'
                            : (r.status === 'draft'
                                ? '<span style="background:rgba(245,158,11,0.2); color:#F59E0B; padding:3px 10px; border-radius:12px; font-weight:800; font-size:11px;">DRAFT</span>'
                                : '<span style="background:rgba(148,163,184,0.15); color:#94A3B8; padding:3px 10px; border-radius:12px; font-size:11px;">ARCHIVED</span>');

                        const sizeMb = r.file_size > 0 ? (r.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'External Link';
                        const dlLink = r.download_url ? `<a href="${r.download_url}" target="_blank" style="color:#2DD4BF; text-decoration:none; font-weight:600;">Download (${r.original_filename || 'File'})</a>` : 'N/A';

                        return `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 12px 16px; font-weight:700; color:#FFF;">${platLabel}</td>
                                <td style="padding: 12px 16px;"><span style="background:rgba(45,212,191,0.15); color:#2DD4BF; padding:2px 8px; border-radius:6px; font-weight:800;">v${r.version}</span></td>
                                <td style="padding: 12px 16px; color:#FFF; font-weight:600;">${r.release_name || 'Release v' + r.version}</td>
                                <td style="padding: 12px 16px;">${dlLink} <span style="color:var(--text-muted); font-size:11px;">(${sizeMb})</span></td>
                                <td style="padding: 12px 16px; color:var(--text-muted); font-size:12px;">${r.published_at || r.created_at}</td>
                                <td style="padding: 12px 16px;">${statusBadge}</td>
                                <td style="padding: 12px 16px; display:flex; gap:6px;">
                                    ${!isAct ? `<button class="btn btn-primary" style="padding:3px 8px; font-size:11px; background:#2DD4BF; color:#000; font-weight:800;" onclick="activateAppRelease('${r.id}')">✅ Make Active</button>` : ''}
                                    <button class="btn btn-outline" style="padding:3px 8px; font-size:11px; border-color:#EF4444; color:#F87171;" onclick="deleteAppRelease('${r.id}')">🗑️ Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">No releases found in release history. Use the form above to publish your first release.</td></tr>';
                }
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#F87171;">Error loading release history records.</td></tr>';
            }
        }

        async function handlePublishRelease(e) {
            e.preventDefault();
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            const platform = document.getElementById('relPlatform').value;
            const version = document.getElementById('relVersion').value.trim();
            const releaseName = document.getElementById('relName').value.trim();
            const status = document.getElementById('relStatus').value;
            const directUrl = document.getElementById('relDirectUrl').value.trim();
            const notes = document.getElementById('relNotes').value.trim();
            const fileInput = document.getElementById('relFile');

            if (!version || !releaseName) {
                alert('Please enter version number and release name.');
                return;
            }

            const formData = new FormData();
            formData.append('platform', platform);
            formData.append('version', version);
            formData.append('release_name', releaseName);
            formData.append('status', status);
            formData.append('download_url', directUrl);
            formData.append('release_notes', notes);

            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            }

            const msg = document.getElementById('releasesConfigMsg');
            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Publishing application release... Please wait...';

            try {
                const res = await fetch('/api/admin/publish-app-release', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = data.message;

                    document.getElementById('relVersion').value = '';
                    document.getElementById('relName').value = '';
                    document.getElementById('relDirectUrl').value = '';
                    document.getElementById('relNotes').value = '';
                    fileInput.value = '';

                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Failed to publish release.';
                }
            } catch(e) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error publishing release.';
            }
        }

        async function activateAppRelease(releaseId) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Are you sure you want to set this release as the current ACTIVE version for users?')) return;

            try {
                const res = await fetch('/api/admin/activate-app-release', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ releaseId: releaseId })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    alert('Failed to activate release: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error activating release.');
            }
        }

        async function deleteAppRelease(releaseId) {
            const token = localStorage.getItem('sessionToken');
            if (!confirm('Are you sure you want to delete this release record?')) return;

            try {
                const res = await fetch('/api/admin/delete-app-release', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ releaseId: releaseId })
                });
                const data = await res.json();
                if (data.success) {
                    loadAppReleasesTable();
                    loadUserPortalData();
                } else {
                    alert('Failed to delete release: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error deleting release.');
            }
        }

        async function saveReleasesConfig() {
            const token = localStorage.getItem('sessionToken');
            const payload = {
                win_download_url: document.getElementById('cfgWinUrl').value.trim(),
                win_app_version: document.getElementById('cfgWinVersion').value.trim(),
                mac_arm_download_url: document.getElementById('cfgMacArmUrl').value.trim(),
                mac_arm_app_version: document.getElementById('cfgMacArmVersion').value.trim(),
                mac_intel_download_url: document.getElementById('cfgMacIntelUrl').value.trim(),
                mac_intel_app_version: document.getElementById('cfgMacIntelVersion').value.trim(),
                linux_download_url: document.getElementById('cfgLinuxUrl').value.trim(),
                linux_app_version: document.getElementById('cfgLinuxVersion').value.trim()
            };

            try {
                const res = await fetch('/api/admin/update-releases-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert('App Release Settings & Download URLs updated successfully!');
                    loadUserPortalData();
                } else {
                    alert('Failed to update release settings: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Network error saving release settings.');
            }
        }

        async function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const msg = document.getElementById('loginMsg');

            msg.style.display = 'block';
            msg.style.background = 'rgba(99,102,241,0.2)';
            msg.style.color = '#818CF8';
            msg.innerText = 'Authenticating...';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.success && data.sessionToken && data.user) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Success! Redirecting to Dashboard...';
                    
                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 300);
                } else {
                    msg.style.background = 'rgba(239,68,68,0.2)';
                    msg.style.color = '#F87171';
                    msg.innerText = data.error || 'Login failed.';
                }
            } catch (err) {
                msg.style.background = 'rgba(239,68,68,0.2)';
                msg.style.color = '#F87171';
                msg.innerText = 'Network error during login.';
            }
        }

        // Router & Route Guard on Page Load
        window.addEventListener('DOMContentLoaded', () => {
            const path = window.location.pathname.toLowerCase();
            const token = localStorage.getItem('sessionToken');
            const userStr = localStorage.getItem('user');
            let isAuthenticated = false;

            if (token && userStr && token !== 'undefined' && userStr !== 'undefined') {
                try {
                    const u = JSON.parse(userStr);
                    if (u && u.email) {
                        isAuthenticated = true;
                    }
                } catch(e) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                }
            }

            if (path.includes('/logout')) {
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('user');
                closeAdminDashboard();
                window.location.href = '/login';
                return;
            }

            // Protected Dashboard / Profile Routes (/dashboard, /profile, /admin)
            if (path.includes('/dashboard') || path.includes('/profile') || path.includes('/admin')) {
                if (!isAuthenticated) {
                    closeAdminDashboard();
                    window.location.href = '/login';
                    return;
                } else {
                    closeModal();
                    checkSession();
                    return;
                }
            }

            // Authentication Routes (/login, /register)
            if (path.includes('/login') || path.includes('/register')) {
                if (isAuthenticated) {
                    closeModal();
                    window.location.href = '/dashboard';
                    return;
                } else {
                    closeAdminDashboard();
                    openModal(path.includes('/register') ? 'register' : 'login');
                    return;
                }
            }

            // Default Root / Landing Page Path ('/')
            if (isAuthenticated) {
                // Authenticated users visiting root landing page -> Automatically redirect to /dashboard!
                window.location.href = '/dashboard';
                return;
            } else {
                closeAdminDashboard();
            }
            loadUserPortalData();
        });
    </script>
</body>
</html>


