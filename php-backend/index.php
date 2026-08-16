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
    if ($requestUri === '/api/public/releases') {
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

    // Auth APIs (/api/auth/login, /api/auth/register, /api/auth/me)
    if (strpos($requestUri, '/api/auth/') === 0) {
        $action = str_replace('/api/auth/', '', $requestUri);
        $_GET['action'] = $action;
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
    <meta property="og:title" content="<?php echo htmlspecialchars($ogTitle); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($ogDesc); ?>">
    <meta property="og:image" content="<?php echo htmlspecialchars($ogImage); ?>">
    <meta property="og:url" content="<?php echo htmlspecialchars($pageCanonical); ?>">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json"><?php echo json_encode($schemas, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES); ?></script>
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
        .modal-overlay.active { display: flex; }
        .modal-box { background: var(--bg-card); border: 1px solid var(--border-hover); width: 100%; max-width: 440px; border-radius: 20px; padding: 36px; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
        .close-modal { position: absolute; top: 20px; right: 20px; background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; }
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
        .form-group input { width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; color: #FFF; font-size: 15px; outline: none; }
        .form-group input:focus { border-color: var(--primary); }

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
            <div class="logo-icon">🛡️</div>
            <span>ProfileVault</span>
        </a>
        <ul class="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#downloads">Downloads</a></li>
            <li><a href="/sitemap.xml" target="_blank">Sitemap</a></li>
        </ul>
        <div>
            <button class="btn btn-outline" onclick="openModal('login')">Login</button>
            <button class="btn btn-primary" onclick="openModal('login')">Admin Portal</button>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero container">
        <div class="badge">⚡ NEXT-GEN ANTI-DETECT & FINGERPRINT ISOLATION</div>
        <h1>Browse Privately. Isolate Profiles.<br>Scale Without Limits.</h1>
        <p>Create isolated browser profiles with configurable Canvas, WebGL, User-Agent fingerprints, proxy bridges, and centralized aaPanel administration.</p>
        <div class="hero-actions">
            <button class="btn btn-primary" style="padding: 14px 32px; font-size: 16px;" onclick="openModal('login')">🚀 Admin Login & Dashboard</button>
            <a href="#pricing" class="btn btn-outline" style="padding: 14px 28px; font-size: 16px;">View Pricing Plans</a>
        </div>

        <!-- Live Server Status Bar -->
        <div class="status-box">
            <div class="status-item">
                <span class="status-label">Backend Engine</span>
                <span class="status-val">PHP <?php echo PHP_VERSION; ?> Native</span>
            </div>
            <div class="status-item">
                <span class="status-label">REST API</span>
                <span class="status-val">Online & Active</span>
            </div>
            <div class="status-item">
                <span class="status-label">Database</span>
                <span class="status-val">MySQL Connected</span>
            </div>
            <div class="status-item">
                <span class="status-label">aaPanel Status</span>
                <span class="status-val">Production Ready</span>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="section container">
        <div class="section-title">
            <h2>Built for Privacy, Security & Automation</h2>
            <p>Enterprise-grade profile management designed for digital agencies, marketers, and power users.</p>
        </div>
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <h3>Isolated Profiles</h3>
                <p>Cookies, local storage, sessions, and browser data are 100% separated between profiles with zero data leakage.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🛡️</div>
                <h3>Fingerprint Protection</h3>
                <p>Configure hardware parameters, WebGL/Canvas noise, WebRTC masking, and custom User Agents per profile.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🌐</div>
                <h3>Proxy Manager</h3>
                <p>Seamlessly assign HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with connection testing and automatic IP detection.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">📋</div>
                <h3>Reusable Templates</h3>
                <p>Create standardized profile templates for fast batch provisioning across your operations.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">👥</div>
                <h3>Team Management</h3>
                <p>Assign team roles, set profile access permissions, and manage subscription limits from a central dashboard.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>REST API Automation</h3>
                <p>Programmatically create, start, stop, and control browser profiles via localhost REST API endpoints.</p>
            </div>
        </div>
    </section>

    <!-- Pricing Section -->
    <section id="pricing" class="section container">
        <div class="section-title">
            <h2>Simple & Transparent Pricing</h2>
            <p>Choose the plan that best fits your profile management requirements.</p>
        </div>
        <div class="pricing-grid">
            <div class="plan-card">
                <div class="plan-name">Starter</div>
                <div class="plan-price">$19 <span>/month</span></div>
                <ul class="plan-features">
                    <li>25 Browser Profiles</li>
                    <li>Basic Fingerprint Control</li>
                    <li>Proxy Bridge Support</li>
                    <li>1 Team Member</li>
                </ul>
                <button class="btn btn-outline" onclick="openModal('login')">Select Starter</button>
            </div>
            <div class="plan-card popular">
                <div class="popular-tag">Most Popular</div>
                <div class="plan-name">Professional</div>
                <div class="plan-price">$49 <span>/month</span></div>
                <ul class="plan-features">
                    <li>100 Browser Profiles</li>
                    <li>Advanced Fingerprint Masking</li>
                    <li>HTTP / SOCKS5 Proxies</li>
                    <li>5 Team Members</li>
                    <li>REST API Access</li>
                </ul>
                <button class="btn btn-primary" onclick="openModal('login')">Select Professional</button>
            </div>
            <div class="plan-card">
                <div class="plan-name">Business</div>
                <div class="plan-price">$99 <span>/month</span></div>
                <ul class="plan-features">
                    <li>500 Browser Profiles</li>
                    <li>Full Hardware Spoofing</li>
                    <li>Unlimited Proxy Bridges</li>
                    <li>25 Team Members</li>
                    <li>High-Priority Support</li>
                </ul>
                <button class="btn btn-outline" onclick="openModal('login')">Select Business</button>
            </div>
        </div>
    </section>

    <!-- Downloads Section -->
    <section id="downloads" class="section container">
        <div class="section-title">
            <h2>Download Desktop Application</h2>
            <p>Available for macOS, Windows 10/11, and Linux operating systems.</p>
        </div>
        <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
            <a href="/api/public/releases" class="btn btn-outline" style="padding: 16px 28px;">🍏 macOS (.dmg)</a>
            <a href="/api/public/releases" class="btn btn-outline" style="padding: 16px 28px;">🪟 Windows (.exe)</a>
            <a href="/api/public/releases" class="btn btn-outline" style="padding: 16px 28px;">🐧 Linux (.AppImage)</a>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>&copy; <?php echo date('Y'); ?> ProfileVault Software. All rights reserved. | Powered by aaPanel PHP Engine.</p>
            <p style="margin-top: 8px;">
                <a href="/sitemap.xml" target="_blank">Sitemap XML</a> • 
                <a href="/llms.txt" target="_blank">LLM Specification</a> • 
                <a href="/api/health" target="_blank">API Health Status</a>
            </p>
        </div>
    </footer>

    <!-- Login Modal -->
    <div class="modal-overlay" id="loginModal">
        <div class="modal-box">
            <button class="close-modal" onclick="closeModal()">✕</button>
            <h2 style="margin-bottom: 8px;">Admin & User Login</h2>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">Sign in to access your ProfileVault dashboard.</p>
            
            <div id="loginMsg" style="display: none; padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>

            <form id="loginForm" onsubmit="handleLogin(event)">
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="loginEmail" value="admin@profilevault.local" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" value="admin" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 14px;">Sign In to Dashboard</button>
            </form>
        </div>
    </div>

    <script>
        function openModal(type) {
            document.getElementById('loginModal').classList.add('active');
        }
        function closeModal() {
            document.getElementById('loginModal').classList.remove('active');
        }
        async function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
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
                if (data.success) {
                    msg.style.background = 'rgba(45,212,191,0.2)';
                    msg.style.color = '#2DD4BF';
                    msg.innerText = 'Success! Redirecting to Dashboard...';
                    setTimeout(() => {
                        alert('Welcome ' + data.user.name + '! Login successful (Token: ' + data.sessionToken.substring(0, 15) + '...)');
                        closeModal();
                    }, 800);
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
    </script>
</body>
</html>

