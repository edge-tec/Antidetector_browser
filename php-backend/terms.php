<?php
// ──────────────────────────────────────────────
// AntiProfiles — Terms & Conditions Page
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
    <title>Terms & Conditions — AntiProfiles Anti-Detect Browser</title>
    <meta name="description" content="AntiProfiles Terms & Conditions. Read our software licensing, acceptable use policies, and subscription terms.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://antiprofiles.com/terms">
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
            line-height: 1.75;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 920px;
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
        .terms-card {
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
            margin-bottom: 14px;
            letter-spacing: -0.5px;
        }
        h1 { font-size: 38px; margin-top: 0; }
        h2 { font-size: 22px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; margin-top: 40px; color: #2DD4BF; }
        h3 { font-size: 16px; margin-top: 20px; color: #818CF8; }
        p { margin-bottom: 16px; color: #CBD5E1; font-size: 15px; }
        ul { margin-bottom: 20px; padding-left: 24px; }
        li { margin-bottom: 8px; color: #CBD5E1; font-size: 15px; }
        .highlight-box {
            background: linear-gradient(135deg, rgba(45, 212, 191, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
            border: 1px solid rgba(45, 212, 191, 0.25);
            border-radius: 14px;
            padding: 22px;
            margin: 24px 0;
        }
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
            width: 170px;
        }
        footer {
            border-top: 1px solid var(--border);
            padding: 40px 0;
            text-align: center;
            color: var(--text-muted);
            font-size: 13px;
        }
        @media(max-width: 768px) {
            .terms-card { padding: 24px 20px; margin: 20px auto; }
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
        <div class="terms-card">
            
            <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(45, 212, 191, 0.12); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.25); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-bottom: 18px;">
                Official Terms of Service
            </div>

            <h1>AntiProfiles — Terms & Conditions</h1>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 28px;">
                <strong>Last Updated:</strong> August 18, 2026
            </p>

            <p>
                These Terms & Conditions (“Terms”) govern your access to and use of AntiProfiles (“AntiProfiles,” “we,” “us,” or “our”), including our website, desktop applications, browser-profile management software, subscriptions, and related services (collectively, the “Services”).
            </p>
            <p>
                By creating an account, purchasing a subscription, installing the software, or using the Services, you agree to these Terms.
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>By using AntiProfiles, you confirm that:</p>
            <ul>
                <li>You have read and understood these Terms.</li>
                <li>You agree to comply with these Terms.</li>
                <li>You are legally permitted to use the Services in your jurisdiction.</li>
                <li>The information you provide to us is accurate and current.</li>
                <li>You are responsible for activity performed through your account.</li>
            </ul>
            <p>If you do not agree with these Terms, you must not use the Services.</p>

            <h2>2. Description of the Services</h2>
            <p>AntiProfiles provides software designed to help users manage separate browser profiles and browser environments.</p>
            <p>Features may include:</p>
            <ul>
                <li>Browser profile creation and management</li>
                <li>Isolated browser environments</li>
                <li>Profile settings and custom digital hardware fingerprinting</li>
                <li>Proxy configuration (HTTP, HTTPS, SOCKS4, SOCKS5)</li>
                <li>Browser configuration management</li>
                <li>Profile synchronization across devices</li>
                <li>Account management and team collaboration</li>
                <li>Automation features (Puppeteer, Selenium, Playwright integration)</li>
                <li>Subscription management</li>
                <li>Team/user permissions and access controls</li>
                <li>Web and desktop application access</li>
            </ul>
            <p>Features may change, be added, or be discontinued over time.</p>

            <h2>3. Legal and Acceptable Use</h2>
            <p>You agree to use AntiProfiles only for lawful purposes.</p>
            <p>You must not use AntiProfiles to:</p>
            <ul>
                <li>Commit fraud</li>
                <li>Conduct phishing attacks</li>
                <li>Steal credentials</li>
                <li>Impersonate individuals for fraudulent purposes</li>
                <li>Distribute malware or malicious code</li>
                <li>Conduct unauthorized attacks or denial-of-service activities</li>
                <li>Circumvent security systems unlawfully</li>
                <li>Access accounts without authorization</li>
                <li>Engage in identity theft</li>
                <li>Facilitate scams or deceptive schemes</li>
                <li>Distribute illegal content</li>
                <li>Violate applicable laws or regulations</li>
                <li>Abuse third-party services</li>
                <li>Perform unauthorized automated activity</li>
                <li>Violate the terms of websites or services you access</li>
            </ul>
            <p>
                The fact that AntiProfiles provides browser-profile or privacy features does not authorize you to violate another service's rules or applicable law.
            </p>

            <h2>4. Account Registration</h2>
            <p>Certain features require an AntiProfiles account. You agree to provide accurate information, including where required:</p>
            <ul>
                <li>Name</li>
                <li>Email address</li>
                <li>Password</li>
                <li>Billing information</li>
                <li>Other required account information</li>
            </ul>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately if you believe your account has been compromised.</p>

            <h2>5. Email Verification</h2>
            <p>
                AntiProfiles may require email verification before an account can access certain features. After registration, we may send a verification email to the address associated with your account. We may restrict account functionality until email verification is completed.
            </p>

            <h2>6. Account Security</h2>
            <p>
                You are responsible for activity performed through your account unless the activity resulted from unauthorized access that you could not reasonably have prevented.
            </p>
            <p>You must not:</p>
            <ul>
                <li>Share your password unnecessarily</li>
                <li>Sell or transfer your account without authorization</li>
                <li>Attempt to access another user's account</li>
                <li>Bypass authentication</li>
                <li>Circumvent account restrictions</li>
            </ul>
            <p>We may temporarily suspend an account when necessary to protect the user or AntiProfiles.</p>

            <h2>7. Subscriptions</h2>
            <p>Some AntiProfiles features require a paid subscription. Subscription plans may include different:</p>
            <ul>
                <li>Profile limits</li>
                <li>Device limits</li>
                <li>Team/user limits</li>
                <li>Storage limits</li>
                <li>Automation limits</li>
                <li>Feature availability</li>
                <li>Usage quotas</li>
            </ul>
            <p>The specific limits applicable to your account will be displayed during purchase or inside your account portal.</p>

            <h2>8. Payments</h2>
            <p>Payments may be processed through third-party payment providers. Depending on the available payment methods, AntiProfiles may support services such as:</p>
            <ul>
                <li>Credit/debit cards</li>
                <li>Stripe</li>
                <li>Cryptocurrency (USDT, BTC, ETH, USDC)</li>
                <li>Other supported payment providers</li>
            </ul>
            <p>Payment processing may be subject to the payment provider's own terms and policies.</p>

            <h2>9. Cryptocurrency Payments</h2>
            <p>If cryptocurrency payments are supported:</p>
            <ul>
                <li>Transactions are irreversible on blockchain networks.</li>
                <li>Blockchain network miner/gas fees may apply.</li>
                <li>Confirmation times may vary depending on network congestion.</li>
                <li>Exchange-rate fluctuations may affect the amount required.</li>
                <li>AntiProfiles is not responsible for incorrect wallet addresses provided by the customer.</li>
            </ul>
            <p>You are responsible for verifying payment details before sending cryptocurrency.</p>

            <h2>10. Refunds and Cancellations</h2>
            <p>Refund eligibility depends on the applicable subscription plan and our refund policy. Unless otherwise stated:</p>
            <ul>
                <li>Canceling a subscription does not automatically create a refund.</li>
                <li>Subscription cancellation prevents future automatic renewals.</li>
                <li>Previously paid subscription periods remain active until their expiration date.</li>
                <li>Certain payments may be non-refundable where permitted by applicable law.</li>
            </ul>
            <p>Nothing in this section limits mandatory consumer rights provided by applicable law.</p>

            <h2>11. Software License</h2>
            <p>
                Subject to these Terms, AntiProfiles grants you a limited, non-exclusive, non-transferable, revocable license to use the software for its intended purpose.
            </p>
            <p>You may not:</p>
            <ul>
                <li>Resell the software without authorization</li>
                <li>Redistribute the application packages</li>
                <li>Reverse engineer the software where prohibited by law</li>
                <li>Modify or remove proprietary notices</li>
                <li>Circumvent licensing controls</li>
                <li>Create unauthorized derivative versions</li>
                <li>Attempt to obtain source code through unauthorized methods</li>
            </ul>

            <h2>12. Updates</h2>
            <p>AntiProfiles may release updates that include security fixes, bug fixes, performance improvements, new features, compatibility updates, and changes to existing functionality. You may be required to install certain updates to continue using supported versions of the Services.</p>

            <h2>13. Browser Profiles and User Content</h2>
            <p>You remain responsible for information, configurations, data, and content that you create or store through AntiProfiles. You represent that you have the necessary rights to use any content or information you enter into the Services. You must not use the Services to store or distribute unlawful content.</p>

            <h2>14. Third-Party Websites</h2>
            <p>
                AntiProfiles allows you to access third-party websites through browser profiles. Those websites are operated independently from AntiProfiles.
            </p>
            <p>We are not responsible for:</p>
            <ul>
                <li>Third-party website availability</li>
                <li>Third-party content</li>
                <li>Third-party account restrictions</li>
                <li>Third-party terms</li>
                <li>Third-party privacy practices</li>
                <li>Actions taken by third-party websites against your account</li>
            </ul>
            <p>You are responsible for complying with the applicable third-party website's rules.</p>

            <h2>15. Proxies and Network Services</h2>
            <p>
                If AntiProfiles provides proxy configuration functionality, you are responsible for ensuring that your use of any proxy or network service is lawful. AntiProfiles does not authorize unauthorized access, fraud, abuse, or circumvention of third-party restrictions.
            </p>

            <h2>16. Prohibited Activities</h2>
            <p>You may not use AntiProfiles to facilitate fraudulent transactions, phishing, credential theft, malware distribution, unauthorized account access, identity theft, scams, spam campaigns, illegal financial activity, attacks against computer systems, unauthorized data collection, distribution of illegal material, or any activity that violates applicable law.</p>
            <p>We may investigate suspected violations and take appropriate action.</p>

            <h2>17. Suspension and Termination</h2>
            <p>
                We may suspend or terminate an account if we reasonably believe that the user violated these Terms, engaged in illegal activity, abused the Services, attempted to compromise our systems, attempted to bypass subscription restrictions, provided fraudulent information, or used the Services in a manner that creates significant security or legal risk.
            </p>

            <h2>18. Account Termination by User</h2>
            <p>You may stop using AntiProfiles at any time. You may request account deletion through the available account settings or by contacting our support team. Termination does not automatically eliminate obligations that arose before termination.</p>

            <h2>19. Intellectual Property & Trademark</h2>
            <p>
                AntiProfiles and its associated software, branding, design, code, documentation, logos, graphics, and other materials are protected by applicable intellectual-property laws. “AntiProfiles,” associated logos, names, designs, and branding are trademarks of AntiProfiles. You may not use AntiProfiles branding in a way that suggests unauthorized sponsorship, partnership, or affiliation.
            </p>

            <h2>20. Availability & Service Disclaimers</h2>
            <p>
                We aim to keep AntiProfiles available and reliable, but we do not guarantee uninterrupted service. The Services may temporarily become unavailable because of maintenance, software updates, network failures, hosting problems, security incidents, or events beyond our reasonable control.
            </p>
            <p>
                To the maximum extent permitted by applicable law, AntiProfiles is provided on an “as is” and “as available” basis without warranties of any kind.
            </p>

            <h2>21. Limitation of Liability</h2>
            <p>
                To the maximum extent permitted by applicable law, AntiProfiles and its owners, employees, affiliates, and service providers will not be liable for indirect, incidental, special, consequential, or punitive damages (including loss of data, business interruption, loss of revenue, or third-party account restrictions) arising from your use of the Services.
            </p>

            <h2>22. Indemnification</h2>
            <p>
                You agree to defend, indemnify, and hold harmless AntiProfiles and its owners, employees, affiliates, and service providers from claims, damages, liabilities, costs, and expenses arising from your violation of these Terms, unlawful use of the Services, or violation of third-party rights.
            </p>

            <h2>23. Changes to These Terms</h2>
            <p>
                We may update these Terms from time to time. When significant changes are made, we may notify users through email, website notifications, account notifications, or in-application notifications. Your continued use of AntiProfiles after updated Terms become effective means you accept the revised Terms.
            </p>

            <h2>24. Governing Law & Jurisdiction</h2>
            <p>
                These Terms will be governed by and construed in accordance with the laws of the <strong>United Kingdom</strong>, without regard to conflict-of-law principles, except where mandatory local consumer law provides otherwise.
            </p>

            <h2>25. Contact Information</h2>
            <table class="contact-table">
                <tr>
                    <td>Company</td>
                    <td>AntiProfiles Software Inc.</td>
                </tr>
                <tr>
                    <td>Website</td>
                    <td><a href="https://antiprofiles.com" style="color: #2DD4BF;">https://antiprofiles.com</a></td>
                </tr>
                <tr>
                    <td>Support Email</td>
                    <td><a href="mailto:support@antiprofiles.com" style="color: #2DD4BF;">support@antiprofiles.com</a></td>
                </tr>
                <tr>
                    <td>Legal Email</td>
                    <td><a href="mailto:legal@antiprofiles.com" style="color: #2DD4BF;">legal@antiprofiles.com</a></td>
                </tr>
                <tr>
                    <td>Business Address</td>
                    <td>128 City Road, London, United Kingdom, EC1V 2NX</td>
                </tr>
                <tr>
                    <td>Jurisdiction</td>
                    <td>United Kingdom</td>
                </tr>
            </table>

            <div class="highlight-box" style="text-align: center; margin-top: 36px;">
                <p style="margin-bottom: 0; font-size: 14px; color: #FFF; font-weight: 600;">
                    AntiProfiles — Browser Profiles. Privacy. Control.
                </p>
            </div>

        </div>
    </div>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>© <?php echo date('Y'); ?> AntiProfiles Software. All rights reserved.</p>
            <p style="margin-top: 6px;">
                <a href="/" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Home</a> •
                <a href="/terms" style="color: #2DD4BF; text-decoration: none; margin: 0 10px;">Terms & Conditions</a> •
                <a href="/privacy" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Privacy Policy</a> •
                <a href="/#downloads" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Downloads</a> •
                <a href="/#pricing" style="color: var(--text-muted); text-decoration: none; margin: 0 10px;">Pricing</a>
            </p>
        </div>
    </footer>

</body>
</html>
