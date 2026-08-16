<?php
// ──────────────────────────────────────────────
// ProfileVault — Centralized Application Download & Release Management API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

$db = Database::getConnection();

// Ensure app_releases table exists
try {
    $db->exec("
        CREATE TABLE IF NOT EXISTS `app_releases` (
          `id` VARCHAR(50) NOT NULL PRIMARY KEY,
          `platform` VARCHAR(50) NOT NULL,
          `version` VARCHAR(50) NOT NULL,
          `release_name` VARCHAR(255) NOT NULL,
          `file_path` VARCHAR(255) DEFAULT NULL,
          `download_url` TEXT DEFAULT NULL,
          `original_filename` VARCHAR(255) DEFAULT NULL,
          `file_size` BIGINT DEFAULT 0,
          `release_notes` TEXT DEFAULT NULL,
          `status` VARCHAR(50) NOT NULL DEFAULT 'active',
          `published_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          `uploaded_by` VARCHAR(255) DEFAULT 'admin',
          `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY `idx_rel_plat_status` (`platform`, `status`),
          KEY `idx_rel_ver` (`platform`, `version`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Throwable $e) {}

// Get Active Release for a platform
function getActiveReleaseForPlatform(PDO $db, string $platformKey): ?array {
    $stmt = $db->prepare("SELECT * FROM app_releases WHERE platform = ? AND status = 'active' ORDER BY published_at DESC LIMIT 1");
    $stmt->execute([$platformKey]);
    $rel = $stmt->fetch();
    return $rel ?: null;
}

// Fallback config from desktop_app_config
$config = getDesktopAppConfigMap();

$platforms = ['windows-x64', 'macos-arm64', 'macos-x64', 'linux-x64'];
$manifestPlatforms = [];

foreach ($platforms as $pKey) {
    $activeRel = getActiveReleaseForPlatform($db, $pKey);

    $defaultSlugMap = [
        'windows-x64' => '/download/windows',
        'macos-arm64' => '/download/macos-arm64',
        'macos-x64' => '/download/macos-intel',
        'linux-x64' => '/download/linux'
    ];

    $defaultFilenameMap = [
        'windows-x64' => 'ProfileVault-Windows-x64.exe',
        'macos-arm64' => 'ProfileVault-macOS-AppleSilicon-arm64.dmg',
        'macos-x64' => 'ProfileVault-macOS-Intel-x64.dmg',
        'linux-x64' => 'ProfileVault-Linux-x86_64.AppImage'
    ];

    $nameMap = [
        'windows-x64' => 'Windows Client',
        'macos-arm64' => 'macOS Apple Silicon',
        'macos-x64' => 'macOS Intel',
        'linux-x64' => 'Linux Client'
    ];

    if ($activeRel) {
        $manifestPlatforms[$pKey] = [
            'id' => $activeRel['id'],
            'name' => $nameMap[$pKey],
            'version' => $activeRel['version'],
            'release_name' => $activeRel['release_name'],
            'filename' => $activeRel['original_filename'] ?: $defaultFilenameMap[$pKey],
            'file_size' => (int)$activeRel['file_size'],
            'download_url' => $defaultSlugMap[$pKey],
            'direct_url' => $activeRel['download_url'] ?? null,
            'release_notes' => $activeRel['release_notes'],
            'published_at' => $activeRel['published_at'],
            'enabled' => true
        ];
    } else {
        // Fallback to legacy config
        $legacyVer = $config[$pKey === 'windows-x64' ? 'win_app_version' : ($pKey === 'macos-arm64' ? 'mac_arm_app_version' : ($pKey === 'macos-x64' ? 'mac_intel_app_version' : 'linux_app_version'))] ?? '1.0.0';
        $manifestPlatforms[$pKey] = [
            'id' => 'legacy_' . $pKey,
            'name' => $nameMap[$pKey],
            'version' => $legacyVer,
            'release_name' => "ProfileVault v{$legacyVer} Release",
            'filename' => $defaultFilenameMap[$pKey],
            'file_size' => 159,
            'download_url' => $defaultSlugMap[$pKey],
            'release_notes' => 'Initial stable release',
            'published_at' => date('Y-m-d H:i:s'),
            'enabled' => true
        ];
    }
}

$manifest = [
    'version' => $manifestPlatforms['windows-x64']['version'] ?? '1.0.0',
    'min_supported_version' => $config['min_supported_version'] ?? '1.0.0',
    'force_update' => ($config['force_update'] ?? 'false') === 'true',
    'release_notes' => $config['release_notes'] ?? 'Initial stable release with multi-profile isolation, proxy bridge, and team controls.',
    'platforms' => $manifestPlatforms
];

// Handle direct download request: /download/windows or /api/releases?download=1&platform=windows-x64
if (isset($_GET['download']) && $_GET['download'] == '1') {
    $platformKey = $_GET['platform'] ?? 'windows-x64';
    
    // Normalize platform aliases
    $aliasMap = [
        'windows' => 'windows-x64',
        'win' => 'windows-x64',
        'macos-intel' => 'macos-x64',
        'mac-intel' => 'macos-x64',
        'macos-arm64' => 'macos-arm64',
        'apple-silicon' => 'macos-arm64',
        'mac-arm' => 'macos-arm64',
        'linux' => 'linux-x64'
    ];
    if (isset($aliasMap[$platformKey])) {
        $platformKey = $aliasMap[$platformKey];
    }

    if (!isset($manifest['platforms'][$platformKey])) {
        header('HTTP/1.1 404 Not Found');
        echo "Error: Platform '{$platformKey}' not supported.";
        exit;
    }

    // Check optional user authentication & subscription status
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $m)) {
        $userId = decodeSessionToken($m[1]);
        if ($userId) {
            $userStmt = $db->prepare("SELECT account_status FROM users WHERE id = ?");
            $userStmt->execute([$userId]);
            $u = $userStmt->fetch();
            if ($u && $u['account_status'] === 'suspended') {
                header('HTTP/1.1 403 Forbidden');
                echo "Error: Account suspended. Downloads are disabled.";
                exit;
            }
        }
    }

    $activeRel = getActiveReleaseForPlatform($db, $platformKey);

    if ($activeRel) {
        // Direct URL redirection if external full link (e.g. Google Drive, S3, GitHub)
        if (!empty($activeRel['download_url']) && preg_match('/^https?:\/\//i', $activeRel['download_url']) && strpos($activeRel['download_url'], 'your-domain.com') === false) {
            header('Location: ' . $activeRel['download_url']);
            exit;
        }

        // Local file path streaming
        if (!empty($activeRel['file_path'])) {
            $localFile = __DIR__ . '/../' . ltrim($activeRel['file_path'], '/');
            if (file_exists($localFile) && is_file($localFile)) {
                $filename = $activeRel['original_filename'] ?: basename($localFile);
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
        }
    }

    // Default release file fallback from releases directory
    $defaultFilenameMap = [
        'windows-x64' => 'ProfileVault-Windows-x64.exe',
        'macos-arm64' => 'ProfileVault-macOS-AppleSilicon-arm64.dmg',
        'macos-x64' => 'ProfileVault-macOS-Intel-x64.dmg',
        'linux-x64' => 'ProfileVault-Linux-x86_64.AppImage'
    ];

    $filename = $defaultFilenameMap[$platformKey] ?? 'ProfileVault-Installer.exe';
    $localFile = __DIR__ . '/../releases/' . $filename;

    if (file_exists($localFile) && is_file($localFile)) {
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

    // Text placeholder fallback
    $placeholderContent = "ProfileVault Anti-Detect Browser Installer Package\n"
        . "Platform: " . $platformKey . "\n"
        . "Version: " . ($activeRel['version'] ?? '1.0.0') . "\n"
        . "Status: Active Published Release\n"
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
