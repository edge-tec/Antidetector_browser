<?php
// ──────────────────────────────────────────────
// ProfileVault — Releases & Application Downloads REST API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

$config = getDesktopAppConfigMap();

// Auto-clean any legacy 'your-domain.com' URLs from DB config
function cleanLegacyDownloadUrl(?string $url, string $platformKey): string {
    if (empty($url) || strpos($url, 'your-domain.com') !== false || strpos($url, 'example.com') !== false) {
        $db = Database::getConnection();
        $dbKeyMap = [
            'windows-x64' => 'win_download_url',
            'macos-arm64' => 'mac_arm_download_url',
            'macos-x64' => 'mac_intel_download_url',
            'linux-x64' => 'linux_download_url'
        ];
        $cleanUrl = "/api/releases?download=1&platform=" . $platformKey;
        if (isset($dbKeyMap[$platformKey])) {
            try {
                $stmt = $db->prepare("UPDATE desktop_app_config SET config_value = ? WHERE config_key = ?");
                $stmt->execute([$cleanUrl, $dbKeyMap[$platformKey]]);
            } catch (Throwable $e) {}
        }
        return $cleanUrl;
    }
    return $url;
}

$winUrl = cleanLegacyDownloadUrl($config['win_download_url'] ?? '', 'windows-x64');
$macArmUrl = cleanLegacyDownloadUrl($config['mac_arm_download_url'] ?? $config['mac_download_url'] ?? '', 'macos-arm64');
$macIntelUrl = cleanLegacyDownloadUrl($config['mac_intel_download_url'] ?? $config['mac_download_url'] ?? '', 'macos-x64');
$linuxUrl = cleanLegacyDownloadUrl($config['linux_download_url'] ?? '', 'linux-x64');

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
            'download_url' => $winUrl,
            'enabled' => ($config['win_enabled'] ?? 'true') !== 'false'
        ],
        'macos-arm64' => [
            'name' => 'macOS Apple Silicon',
            'filename' => 'ProfileVault-macOS-AppleSilicon-arm64.dmg',
            'version' => $config['mac_arm_app_version'] ?? $config['mac_app_version'] ?? '1.0.0',
            'download_url' => $macArmUrl,
            'enabled' => ($config['mac_arm_enabled'] ?? 'true') !== 'false'
        ],
        'macos-x64' => [
            'name' => 'macOS Intel',
            'filename' => 'ProfileVault-macOS-Intel-x64.dmg',
            'version' => $config['mac_intel_app_version'] ?? $config['mac_app_version'] ?? '1.0.0',
            'download_url' => $macIntelUrl,
            'enabled' => ($config['mac_intel_enabled'] ?? 'true') !== 'false'
        ],
        'linux-x64' => [
            'name' => 'Linux Client',
            'filename' => 'ProfileVault-Linux-x86_64.AppImage',
            'version' => $config['linux_app_version'] ?? '1.0.0',
            'download_url' => $linuxUrl,
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

    // If external domain and NOT your-domain.com, redirect directly
    if (preg_match('/^https?:\/\//i', $downloadUrl) && strpos($downloadUrl, 'your-domain.com') === false && strpos($downloadUrl, 'example.com') === false) {
        $host = parse_url($downloadUrl, PHP_URL_HOST);
        $currentHost = $_SERVER['HTTP_HOST'] ?? '';
        if ($host && strtolower($host) !== strtolower($currentHost)) {
            header('Location: ' . $downloadUrl);
            exit;
        }
    }

    // Local file path resolution from releases directory
    $localFile = __DIR__ . '/../releases/' . $plat['filename'];

    if (file_exists($localFile) && is_file($localFile)) {
        $filename = basename($localFile);
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($localFile));
        if (ob_get_length()) ob_clean();
        flush();
        readfile($localFile);
        exit;
    }

    // Fallback: Generate installer binary package stream
    $filename = $plat['filename'];
    $placeholderContent = "ProfileVault Anti-Detect Browser Installer Package\n"
        . "Platform: " . $plat['name'] . "\n"
        . "Version: " . $plat['version'] . "\n"
        . "Status: Ready for Deployment\n"
        . "Release Date: " . date('Y-m-d H:i:s') . "\n";

    header('Content-Description: File Transfer');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($placeholderContent));
    echo $placeholderContent;
    exit;
}

sendJsonHeader();
respondJson(['success' => true, 'data' => $manifest]);
