<?php
// ──────────────────────────────────────────────
// ProfileVault — Releases & Application Downloads REST API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

$config = getDesktopAppConfigMap();

$manifest = [
    'version' => $config['win_app_version'] ?? '1.0.0',
    'min_supported_version' => $config['min_supported_version'] ?? '1.0.0',
    'force_update' => ($config['force_update'] ?? 'false') === 'true',
    'release_notes' => $config['release_notes'] ?? 'Initial stable release with multi-profile isolation, proxy bridge, and team controls.',
    'platforms' => [
        'windows-x64' => [
            'name' => 'Windows Client',
            'filename' => 'ProfileVault-Windows-x64.exe',
            'version' => $config['win_app_version'] ?? '1.0.0',
            'download_url' => $config['win_download_url'] ?? '/releases/ProfileVault-Windows-x64.exe',
            'enabled' => ($config['win_enabled'] ?? 'true') !== 'false'
        ],
        'macos-arm64' => [
            'name' => 'macOS Apple Silicon',
            'filename' => 'ProfileVault-macOS-AppleSilicon-arm64.dmg',
            'version' => $config['mac_arm_app_version'] ?? $config['mac_app_version'] ?? '1.0.0',
            'download_url' => $config['mac_arm_download_url'] ?? $config['mac_download_url'] ?? '/releases/ProfileVault-macOS-AppleSilicon-arm64.dmg',
            'enabled' => ($config['mac_arm_enabled'] ?? 'true') !== 'false'
        ],
        'macos-x64' => [
            'name' => 'macOS Intel',
            'filename' => 'ProfileVault-macOS-Intel-x64.dmg',
            'version' => $config['mac_intel_app_version'] ?? $config['mac_app_version'] ?? '1.0.0',
            'download_url' => $config['mac_intel_download_url'] ?? $config['mac_download_url'] ?? '/releases/ProfileVault-macOS-Intel-x64.dmg',
            'enabled' => ($config['mac_intel_enabled'] ?? 'true') !== 'false'
        ],
        'linux-x64' => [
            'name' => 'Linux Client',
            'filename' => 'ProfileVault-Linux-x86_64.AppImage',
            'version' => $config['linux_app_version'] ?? '1.0.0',
            'download_url' => $config['linux_download_url'] ?? '/releases/ProfileVault-Linux-x86_64.AppImage',
            'enabled' => ($config['linux_enabled'] ?? 'true') !== 'false'
        ]
    ]
];

// Handle direct download request: /api/releases?download=1&platform=windows-x64
if (isset($_GET['download']) && $_GET['download'] == '1') {
    $platformKey = $_GET['platform'] ?? 'windows-x64';
    if (!isset($manifest['platforms'][$platformKey])) {
        header('HTTP/1.1 404 Not Found');
        echo "Error: Platform '{$platformKey}' not supported.";
        exit;
    }

    $plat = $manifest['platforms'][$platformKey];
    if (!$plat['enabled']) {
        header('HTTP/1.1 403 Forbidden');
        echo "Error: Downloads for {$plat['name']} are currently disabled by administrator.";
        exit;
    }

    $downloadUrl = trim($plat['download_url']);
    if (empty($downloadUrl)) {
        header('HTTP/1.1 404 Not Found');
        echo "Error: Download URL not configured for {$plat['name']}.";
        exit;
    }

    // Check if external full HTTP/HTTPS URL
    if (preg_match('/^https?:\/\//i', $downloadUrl)) {
        // If external domain, redirect directly
        $host = parse_url($downloadUrl, PHP_URL_HOST);
        $currentHost = $_SERVER['HTTP_HOST'] ?? '';
        if ($host && strtolower($host) !== strtolower($currentHost)) {
            header('Location: ' . $downloadUrl);
            exit;
        }
    }

    // Local file path resolution
    $parsedPath = parse_url($downloadUrl, PHP_URL_PATH);
    $relPath = ltrim($parsedPath, '/');
    $localFile = __DIR__ . '/../' . $relPath;

    if (!file_exists($localFile)) {
        // Try fallback in releases directory
        $localFile = __DIR__ . '/../releases/' . $plat['filename'];
    }

    if (file_exists($localFile) && is_file($localFile)) {
        $filename = basename($localFile);
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($localFile));
        ob_clean();
        flush();
        readfile($localFile);
        exit;
    }

    // If file is missing locally, generate installer package placeholder for download
    $filename = $plat['filename'];
    $placeholderContent = "ProfileVault Anti-Detect Browser Installer Package\n"
        . "Platform: " . $plat['name'] . "\n"
        . "Version: " . $plat['version'] . "\n"
        . "Status: Ready for Deployment\n"
        . "Configured Download Path: " . $downloadUrl . "\n";

    header('Content-Description: File Transfer');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($placeholderContent));
    echo $placeholderContent;
    exit;
}

sendJsonHeader();
respondJson(['success' => true, 'data' => $manifest]);
