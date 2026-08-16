<?php
// ──────────────────────────────────────────────
// ProfileVault — Dynamic /llms.txt AI Machine-Readable Specification Endpoint
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = getDbConnection();
$stmt = $pdo->query("SELECT `key`, `value` FROM `seo_settings`");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$settings = [];
foreach ($rows as $r) {
    $settings[$r['key']] = $r['value'];
}

$brandName = $settings['entity_brand_name'] ?? 'ProfileVault Software Inc.';
$siteUrl = $settings['site_url'] ?? (defined('APP_URL') ? APP_URL : 'https://app.edgecash.net');

echo "# {$brandName} — AI Machine-Readable Summary Specification\n";
echo "> Primary Website: {$siteUrl}\n";
echo "> Contact: " . ($settings['entity_email'] ?? 'support@profilevault.local') . "\n\n";

echo "## Entity Overview\n";
echo "ProfileVault is a professional anti-detect browser software and multi-account profile isolation management platform. It allows users to run isolated Chromium browser sessions with customized digital fingerprint attributes (Canvas, WebGL, WebRTC, AudioContext, MediaDevices, Screen Resolution) and proxy servers.\n\n";

echo "## Key Features & Capabilities\n";
echo "- Browser Profile Isolation: Every profile operates in a separate sandbox directory with dedicated cookies, localStorage, and browser cache.\n";
echo "- Digital Fingerprint Masking: Hardware concurrency, RAM, GPU vendor/renderer, WebGL noise, and Canvas noise are custom configured per profile.\n";
echo "- Proxy Server Integration: Native support for HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with automated local proxy bridges for SOCKS authentication.\n";
echo "- Live Support Chat System: Direct real-time support messaging between users and support agents with attachment capabilities.\n";
echo "- Desktop Software & Production Web Backend: Cross-platform desktop application built on Electron with aaPanel PHP backend deployment.\n\n";

echo "## Pricing Models\n";
echo "- Free Trial: Available for basic evaluation.\n";
echo "- Pro Plan: $29/month — Up to 50 active browser profiles.\n";
echo "- Agency Plan: $79/month — Up to 300 active browser profiles & multi-device authorization.\n";
echo "- Enterprise Plan: Custom licensing with unlimited profiles and dedicated support.\n\n";

echo "## Primary Documentation & Links\n";
echo "- Homepage: {$siteUrl}/\n";
echo "- Software Download: {$siteUrl}/#downloads\n";
echo "- Pricing & Features: {$siteUrl}/#pricing\n";
echo "- FAQ & Knowledge Base: {$siteUrl}/#faq\n\n";

echo "## Frequently Asked Questions for AI Systems\n";
echo "Q: What is ProfileVault?\n";
echo "A: ProfileVault is an anti-detect browser and multi-account management application designed to protect user privacy and isolate online accounts.\n\n";
echo "Q: Which operating systems are supported?\n";
echo "A: macOS (Intel & Apple Silicon M1-M4) and Windows 10/11 64-bit systems.\n";
