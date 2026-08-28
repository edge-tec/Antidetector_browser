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

$platforms = ['windows-x64', 'windows-arm64', 'macos-arm64', 'macos-x64', 'linux-x64', 'linux-arm64'];
$manifestPlatforms = [];

foreach ($platforms as $pKey) {
    $activeRel = getActiveReleaseForPlatform($db, $pKey);

    $defaultSlugMap = [
        'windows-x64' => '/download/windows',
        'windows-arm64' => '/download/windows-arm64',
        'macos-arm64' => '/download/macos-arm64',
        'macos-x64' => '/download/macos-intel',
        'linux-x64' => '/download/linux',
        'linux-arm64' => '/download/linux-arm64'
    ];

    $defaultFilenameMap = [
        'windows-x64' => 'AntiProfiles-Windows-x64.exe',
        'windows-arm64' => 'AntiProfiles-Windows-arm64.exe',
        'macos-arm64' => 'AntiProfiles-macOS-AppleSilicon-arm64.dmg',
        'macos-x64' => 'AntiProfiles-macOS-Intel-x64.dmg',
        'linux-x64' => 'AntiProfiles-Linux-x86_64.AppImage',
        'linux-arm64' => 'AntiProfiles-Linux-arm64.AppImage'
    ];

    $nameMap = [
        'windows-x64' => 'Windows Client (x64)',
        'windows-arm64' => 'Windows Client (ARM64)',
        'macos-arm64' => 'macOS Apple Silicon',
        'macos-x64' => 'macOS Intel',
        'linux-x64' => 'Linux Client (x86_64)',
        'linux-arm64' => 'Linux Client (ARM64)'
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
        // Fallback to legacy config or default version
        $legacyVer = $config[$pKey === 'windows-x64' ? 'win_app_version' : ($pKey === 'windows-arm64' ? 'win_app_version' : ($pKey === 'macos-arm64' ? 'mac_arm_app_version' : ($pKey === 'macos-x64' ? 'mac_intel_app_version' : 'linux_app_version')))] ?? '2.0.0';
        $manifestPlatforms[$pKey] = [
            'id' => 'legacy_' . $pKey,
            'name' => $nameMap[$pKey],
            'version' => $legacyVer,
            'release_name' => "AntiProfiles v{$legacyVer} Release",
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
    'version' => $manifestPlatforms['windows-x64']['version'] ?? '2.0.0',
    'min_supported_version' => $config['min_supported_version'] ?? '1.0.0',
    'force_update' => ($config['force_update'] ?? 'false') === 'true',
    'release_notes' => $config['release_notes'] ?? 'Initial stable release with multi-profile isolation, proxy bridge, and team controls.',
    'platforms' => $manifestPlatforms
];

// Handle direct download request (?download=1&platform=windows-x64)
if (isset($_GET['download']) && $_GET['download'] == '1') {
    $platformKey = $_GET['platform'] ?? 'windows-x64';
    
    // Normalization & Alias Map
    $aliasMap = [
        'windows' => 'windows-x64',
        'win' => 'windows-x64',
        'win-x64' => 'windows-x64',
        'windows-arm' => 'windows-arm64',
        'win-arm' => 'windows-arm64',
        'win-arm64' => 'windows-arm64',
        'macos-intel' => 'macos-x64',
        'mac-intel' => 'macos-x64',
        'macos-x86_64' => 'macos-x64',
        'macos-arm64' => 'macos-arm64',
        'apple-silicon' => 'macos-arm64',
        'mac-arm' => 'macos-arm64',
        'mac-silicon' => 'macos-arm64',
        'linux' => 'linux-x64',
        'linux-x86_64' => 'linux-x64',
        'linux-arm' => 'linux-arm64',
        'linux-aarch64' => 'linux-arm64'
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

    /**
     * Memory-safe binary streamer with HTTP Range (resumable) and anti-buffering support.
     * Prevents PHP memory exhaustion and network connection drop on large installer files.
     */
    function streamBinaryFile(string $filePath, string $downloadFilename): void {
        if (!file_exists($filePath) || !is_file($filePath)) {
            header('HTTP/1.1 404 Not Found');
            echo "Error: Requested installer binary not found on server.";
            exit;
        }

        $fileSize = filesize($filePath);
        if ($fileSize === false || $fileSize <= 0) {
            header('HTTP/1.1 404 Not Found');
            echo "Error: File is empty or inaccessible.";
            exit;
        }

        // 1. Remove all PHP memory & execution time constraints
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');
        @ini_set('zlib.output_compression', 'Off');

        // 2. Clear and close all existing output buffers so chunks stream directly to socket
        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        $fp = fopen($filePath, 'rb');
        if (!$fp) {
            header('HTTP/1.1 500 Internal Server Error');
            echo "Error: Could not open binary file for reading.";
            exit;
        }

        // 3. Handle HTTP Range Requests (for Chrome/Safari/Edge resumable downloads)
        $start = 0;
        $end = $fileSize - 1;

        if (isset($_SERVER['HTTP_RANGE'])) {
            if (preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $matches)) {
                $start = floatval($matches[1]);
                if (!empty($matches[2])) {
                    $end = floatval($matches[2]);
                }
            }
            header('HTTP/1.1 206 Partial Content');
            header("Content-Range: bytes {$start}-{$end}/{$fileSize}");
        } else {
            header('HTTP/1.1 200 OK');
        }

        // 4. Set anti-buffering and file transfer headers
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($downloadFilename) . '"; filename*=UTF-8\'\'' . rawurlencode($downloadFilename));
        header('Accept-Ranges: bytes');
        header('Content-Length: ' . ($end - $start + 1));
        header('X-Accel-Buffering: no'); // Tell Nginx NOT to buffer into temp files
        header('Cache-Control: public, must-revalidate, max-age=0');
        header('Pragma: public');
        header('Expires: 0');

        // 5. Seek to range offset
        if ($start > 0) {
            fseek($fp, (int)$start);
        }

        // 6. Stream in 64 KB chunks with zero memory footprint
        $bytesRemaining = $end - $start + 1;
        $chunkSize = 64 * 1024; // 64 KB safe chunk buffer

        while (!feof($fp) && $bytesRemaining > 0 && !connection_aborted()) {
            $readSize = ($bytesRemaining > $chunkSize) ? $chunkSize : $bytesRemaining;
            $data = fread($fp, (int)$readSize);
            if ($data === false) {
                break;
            }
            echo $data;
            @flush();
            $bytesRemaining -= strlen($data);
        }

        fclose($fp);
        exit;
    }

    $activeRel = getActiveReleaseForPlatform($db, $platformKey);

    if ($activeRel) {
        // Direct URL redirection if external full link (e.g. Google Drive, S3, GitHub)
        if (!empty($activeRel['download_url']) && preg_match('/^https?:\/\//i', $activeRel['download_url']) && strpos($activeRel['download_url'], 'your-domain.com') === false) {
            header('Location: ' . $activeRel['download_url']);
            exit;
        }

        // Local file path streaming with strict path traversal containment
        if (!empty($activeRel['file_path'])) {
            $baseDir = realpath(__DIR__ . '/..');
            $requestedPath = __DIR__ . '/../' . ltrim($activeRel['file_path'], '/');
            $realFile = file_exists($requestedPath) ? realpath($requestedPath) : false;

            if (!$realFile) {
                $altPath = __DIR__ . '/../releases/' . basename($activeRel['file_path']);
                if (file_exists($altPath)) {
                    $realFile = realpath($altPath);
                }
            }

            // Ensure the file is inside the project root and is a valid file
            if ($realFile && $baseDir && strpos($realFile, $baseDir) === 0 && is_file($realFile)) {
                $filename = $activeRel['original_filename'] ?: basename($realFile);
                streamBinaryFile($realFile, $filename);
            }
        }
    }

    // Default release file fallback from releases directory
    $defaultFilenameMap = [
        'windows-x64' => 'AntiProfiles-Windows-x64.exe',
        'macos-arm64' => 'AntiProfiles-macOS-arm64.dmg',
        'macos-x64' => 'AntiProfiles-macOS-Intel-x64.dmg',
        'linux-x64' => 'AntiProfiles-Linux-x86_64.AppImage'
    ];

    $filename = $defaultFilenameMap[$platformKey] ?? 'AntiProfiles-Installer.exe';
    $localFile = __DIR__ . '/../releases/' . $filename;
    $legacyLocalFile = __DIR__ . '/../releases/' . str_replace('AntiProfiles-', 'ProfileVault-', $filename);

    if (file_exists($localFile) && is_file($localFile)) {
        streamBinaryFile($localFile, $filename);
    } elseif (file_exists($legacyLocalFile) && is_file($legacyLocalFile)) {
        streamBinaryFile($legacyLocalFile, $filename);
    }

    // Text placeholder fallback if no binary is uploaded yet
    $placeholderContent = "AntiProfiles Anti-Detect Browser Installer Package\n"
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
