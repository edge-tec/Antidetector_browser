<?php
// ──────────────────────────────────────────────
// AntiProfiles — Privacy Policy Page
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy — AntiProfiles Anti-Detect Browser</title>
    <meta name="description" content="AntiProfiles Privacy Policy. Learn how we protect your account information, browser profile isolation, and privacy.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://antiprofiles.com/privacy">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-body: #07090E;
            --bg-card: rgba(18, 20, 30, 0.75);
            --border: #232738;
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
            line-height: 1.7;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 0 24px;
        }
        nav {
            padding: 20px 0;
            border-bottom: 1px solid var(--border);
            background: rgba(7, 9, 14, 0.85);
            backdrop-filter: blur(12px);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .nav-inner {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .btn-back {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(45, 212, 191, 0.1);
            color: #2DD4BF;
            border: 1px solid rgba(45, 212, 191, 0.25);
            padding: 8px 16px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.2s ease;
        }
        .btn-back:hover {
            background: rgba(45, 212, 191, 0.2);
            transform: translateX(-2px);
        }
        .policy-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 48px;
            margin: 40px auto 60px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }
        h1, h2, h3, h4 {
            font-family: 'Outfit', sans-serif;
            color: #FFF;
            margin-top: 36px;
            margin-bottom: 16px;
            letter-spacing: -0.5px;
        }
        h1 { font-size: 38px; margin-top: 0; }
        h2 { font-size: 22px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; margin-top: 40px; color: #2DD4BF; }
        h3 { font-size: 17px; margin-top: 24px; color: #818CF8; }
        p { margin-bottom: 16px; color: #CBD5E1; font-size: 15px; }
        ul { margin-bottom: 20px; padding-left: 24px; }
        li { margin-bottom: 8px; color: #CBD5E1; font-size: 15px; }
        .summary-box {
            background: linear-gradient(135deg, rgba(45, 212, 191, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
            border: 1px solid rgba(45, 212, 191, 0.25);
            border-radius: 14px;
            padding: 24px;
            margin: 28px 0;
        }
        .summary-box h3 { margin-top: 0; color: #2DD4BF; }
        .contact-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .contact-table td {
            padding: 10px 14px;
            border-bottom: 1px solid var(--border);
            font-size: 14px;
        }
        .contact-table td:first-child {
            font-weight: 700;
            color: #2DD4BF;
            width: 160px;
        }
        footer {
            border-top: 1px solid var(--border);
            padding: 40px 0;
            text-align: center;
            color: var(--text-muted);
            font-size: 13px;
        }
        @media(max-width: 768px) {
            .policy-card { padding: 24px 20px; margin: 20px auto; }
            h1 { font-size: 28px; }
            h2 { font-size: 20px; }
        }
    </style>
</head>
<body>

    <!-- Top Navigation -->
    <nav>
        <div class="container nav-inner">
            <a href="/" style="display: flex; align-items: center; text-decoration: none;">
                <img src="/brand-logo.png" alt="AntiProfiles Logo" style="height: 36px; width: auto; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';">
            </a>
            <a href="/" class="btn-back">← Back to Home</a>
        </div>
    </nav>

    <!-- Main Content Container -->
    <div class="container">
        <div class="policy-card">
            
            <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(45, 212, 191, 0.12); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.25); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-bottom: 18px;">
                Official Legal Document
            </div>

            <h1>AntiProfiles Privacy Policy</h1>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 28px;">
                <strong>Last Updated:</strong> August 18, 2026
            </p>

            <p>
                This Privacy Policy explains how AntiProfiles (“AntiProfiles,” “we,” “us,” or “our”) collects, uses, stores, and protects information when you use our website, desktop applications, browser-profile management software, and related services (collectively, the “Services”).
            </p>
            <p>
                By using AntiProfiles, you agree to the practices described in this Privacy Policy.
            </p>

            <!-- Privacy Summary Card -->
            <div class="summary-box">
                <h3>🛡️ Privacy Summary & Core Principles</h3>
                <ul style="margin-bottom: 0; padding-left: 20px;">
                    <li>🔐 <strong>Protect account information:</strong> Passwords are always cryptographically hashed with industry-standard bcrypt/Argon2.</li>
                    <li>👤 <strong>Keep browser profiles isolated:</strong> Profiles run in sandboxed Chromium environments with separate storage, cookies, and fingerprint noise.</li>
                    <li>🔄 <strong>Securely synchronize:</strong> Account settings and subscriptions are synced over encrypted TLS connections.</li>
                    <li>💳 <strong>Third-party payment processors:</strong> Transactions are handled directly by PCI-compliant gateways (e.g., Stripe) or crypto networks.</li>
                    <li>📧 <strong>Service communications:</strong> Email is used strictly for authentication, security alerts, and system notices.</li>
                    <li>🛡️ <strong>Authentication & access controls:</strong> Role-based permissions safeguard administrative operations.</li>
                    <li>🗑️ <strong>Account deletion:</strong> We provide straightforward mechanisms for account and data deletion.</li>
                </ul>
            </div>

            <h2>1. Information We Collect</h2>
            <p>Depending on how you use AntiProfiles, we may collect the following categories of information:</p>

            <h3>1.1 Account Information</h3>
            <p>When you create an AntiProfiles account, we may collect:</p>
            <ul>
                <li>Name or username</li>
                <li>Email address</li>
                <li>Password credentials in securely hashed form (never stored in plain text)</li>
                <li>Account type and role (User, Manager, Administrator)</li>
                <li>Subscription information and quota limits</li>
                <li>Account status and activity timestamps</li>
                <li>Email-verification status</li>
                <li>Support communications and correspondence</li>
            </ul>

            <h3>1.2 Payment Information</h3>
            <p>
                If you purchase a subscription, payment information is processed by third-party payment providers. Depending on the payment method, we may receive limited metadata including:
            </p>
            <ul>
                <li>Payment status (completed, pending, refunded)</li>
                <li>Transaction ID and invoice reference</li>
                <li>Subscription plan selected</li>
                <li>Billing amount and currency</li>
                <li>Payment date and time</li>
                <li>Limited billing information required for invoicing</li>
            </ul>
            <p>We do not store complete payment card numbers or CVV codes on our servers.</p>

            <h3>1.3 Browser Profile Information</h3>
            <p>
                AntiProfiles allows users to create and manage isolated browser profiles. Depending on the features you use, profile-related metadata may include:
            </p>
            <ul>
                <li>Profile name and user-assigned tags</li>
                <li>Unique profile identifier (UUID)</li>
                <li>Browser engine and kernel configuration</li>
                <li>Operating-system spoofing parameters</li>
                <li>Language and timezone preferences</li>
                <li>Screen resolution and display configuration</li>
                <li>Browser settings and launch flags</li>
                <li>Proxy configuration (protocol, host, port, credentials)</li>
                <li>Profile creation and modification timestamps</li>
            </ul>

            <h3>1.4 Technical Information</h3>
            <p>We may collect limited technical information necessary to operate, secure, and troubleshoot the Services, such as:</p>
            <ul>
                <li>IP address and geographical location (country/city level)</li>
                <li>Device type and architecture (x64, ARM64)</li>
                <li>Operating system and version (Windows, macOS, Linux)</li>
                <li>Application version and build number</li>
                <li>Error logs and crash diagnostic reports</li>
                <li>Login timestamps and authentication security events</li>
            </ul>

            <h3>1.5 Support and Communications</h3>
            <p>If you contact our live chat or email support team, we may collect:</p>
            <ul>
                <li>Your email address and user ID</li>
                <li>Support messages and inquiry details</li>
                <li>Attachments, screenshots, or logs voluntarily provided</li>
                <li>Support conversation history and resolution notes</li>
            </ul>

            <h2>2. Information We Do Not Intentionally Collect</h2>
            <p>
                AntiProfiles is designed to provide privacy-first browser profile management. Unless specifically required by a feature you choose to use, we do not inspect or collect the contents of websites you visit through your browser profiles.
            </p>
            <p>We do not collect:</p>
            <ul>
                <li>Website passwords stored inside your local browser profiles</li>
                <li>Private browsing messages or contents on third-party websites</li>
                <li>Payment-card numbers entered on third-party websites</li>
                <li>Personal files stored on your local computer</li>
                <li>Website content unrelated to providing the Services</li>
            </ul>

            <h2>3. How We Use Information</h2>
            <p>We use information to:</p>
            <ul>
                <li>Create and manage your AntiProfiles account</li>
                <li>Authenticate users and maintain secure sessions</li>
                <li>Verify email addresses and prevent fraudulent registrations</li>
                <li>Provide browser profile management and cloud synchronization</li>
                <li>Synchronize account settings across web and desktop applications</li>
                <li>Manage subscriptions and process payment transactions</li>
                <li>Provide 24/7 customer and technical support</li>
                <li>Send important service announcements and security alerts</li>
                <li>Detect unauthorized access, abuse, and security attacks</li>
                <li>Diagnose technical problems and improve application reliability</li>
                <li>Comply with applicable legal and regulatory obligations</li>
            </ul>

            <h2>4. Browser Profiles and Local Data</h2>
            <p>
                AntiProfiles stores browser-profile data locally on your device depending on your configuration. Local profile data includes browser cookies, local storage, indexedDB, cache, extensions, and session states.
            </p>
            <p>
                You retain full control of your local browser profiles. When you delete a local profile, its cached data is purged from your local drive.
            </p>

            <h2>5. Synchronization Between Web and Desktop Applications</h2>
            <p>
                AntiProfiles provides real-time synchronization between the web management dashboard and the native desktop applications:
            </p>
            <p style="font-family: monospace; background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border); color: #2DD4BF;">
                Web Account ➔ AntiProfiles Secure Backend ➔ Database ➔ Desktop Client Application
            </p>
            <p>
                Account profiles, subscription tiers, proxy credentials, and permission changes take effect immediately across all connected instances upon synchronization.
            </p>

            <h2>6. Cookies and Similar Technologies</h2>
            <p>Our website uses essential cookies and session tokens for:</p>
            <ul>
                <li>User authentication and maintaining active sessions</li>
                <li>Remembering UI preferences and theme modes</li>
                <li>Protecting forms against Cross-Site Request Forgery (CSRF)</li>
                <li>Performance monitoring and platform reliability</li>
            </ul>

            <h2>7. Email Communications</h2>
            <p>We may use your registered email address to deliver:</p>
            <ul>
                <li>Account verification links</li>
                <li>Password reset tokens</li>
                <li>Security and new login notifications</li>
                <li>Subscription renewal, upgrade, or expiration receipts</li>
                <li>Technical support replies and status updates</li>
            </ul>

            <h2>8. Third-Party Service Providers</h2>
            <p>We work with trusted infrastructure partners to deliver our Services:</p>
            <ul>
                <li>Cloud hosting and high-availability server infrastructure</li>
                <li>Encrypted MySQL database storage</li>
                <li>Transactional email delivery (SMTP)</li>
                <li>Payment gateway processors (Stripe, Cryptocurrency IPN)</li>
                <li>Security and DDoS mitigation networks</li>
            </ul>

            <h2>9. Payment Processing</h2>
            <p>
                Payments are processed securely via verified payment providers such as Stripe or decentralized cryptocurrency gateways. Transactions are governed by the payment provider's privacy policy and PCI-DSS compliance standards.
            </p>

            <h2>10. Data Security</h2>
            <p>
                We enforce rigorous administrative, technical, and physical safeguards:
            </p>
            <ul>
                <li>TLS 1.3 encryption in transit for all web and API communications</li>
                <li>AES-256 GCM encryption for sensitive stored credentials</li>
                <li>Bcrypt hashing for user account passwords</li>
                <li>Strict Role-Based Access Controls (RBAC)</li>
                <li>Automated audit logging of all sensitive administrative actions</li>
            </ul>

            <h2>11. Account Roles and Permissions</h2>
            <p>
                AntiProfiles supports distinct access levels (User, Support Agent, Manager, Administrator). Administrative events are logged with timestamp and IP address to prevent unauthorized changes.
            </p>

            <h2>12. Data Retention</h2>
            <p>
                We retain account information for as long as your account remains active or as required to fulfill legal, tax, and accounting compliance. Inactive free accounts may be archived according to our system lifecycle policies.
            </p>

            <h2>13. Data Deletion & Privacy Rights</h2>
            <p>
                You have the right to request deletion of your account and associated personal data at any time. You may also request data access, correction, or export by contacting our privacy officer.
            </p>

            <h2>14. Children's Privacy</h2>
            <p>
                AntiProfiles is intended solely for adult professionals, agencies, and businesses. We do not knowingly collect personal data from individuals under 18 years of age.
            </p>

            <h2>15. Contact Information</h2>
            <table class="contact-table">
                <tr>
                    <td>Company</td>
                    <td>AntiProfiles Software</td>
                </tr>
                <tr>
                    <td>Website</td>
                    <td><a href="https://antiprofiles.com" style="color: #2DD4BF;">https://antiprofiles.com</a></td>
                </tr>
                <tr>
                    <td>Privacy Email</td>
                    <td><a href="mailto:privacy@antiprofiles.com" style="color: #2DD4BF;">privacy@antiprofiles.com</a></td>
                </tr>
                <tr>
                    <td>Support Email</td>
                    <td><a href="mailto:support@antiprofiles.com" style="color: #2DD4BF;">support@antiprofiles.com</a></td>
                </tr>
                <tr>
                    <td>Live Support</td>
                    <td>24/7 Real-Time Chat at <a href="https://antiprofiles.com" style="color: #2DD4BF;">antiprofiles.com</a></td>
                </tr>
            </table>

        </div>
    </div>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>© <?php echo date('Y'); ?> AntiProfiles Software. All rights reserved.</p>
            <p style="margin-top: 6px;">
                <a href="/" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Home</a> •
                <a href="/privacy" style="color: #2DD4BF; text-decoration: none; margin: 0 10px;">Privacy Policy</a> •
                <a href="/#downloads" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Downloads</a> •
                <a href="/#pricing" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Pricing</a>
            </p>
        </div>
    </footer>

</body>
</html>
