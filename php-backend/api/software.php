<?php
// ──────────────────────────────────────────────
// AntiProfiles — Enterprise Auto-Update & Software Release API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

$db = Database::getConnection();

// Ensure software_versions and software_update_logs tables exist
try {
    $db->exec("
        CREATE TABLE IF NOT EXISTS `software_versions` (
          `id` VARCHAR(100) NOT NULL PRIMARY KEY,
          `version` VARCHAR(50) NOT NULL,
          `build` VARCHAR(50) DEFAULT '1',
          `channel` VARCHAR(50) NOT NULL DEFAULT 'stable',
          `os` VARCHAR(50) NOT NULL DEFAULT 'all',
          `architecture` VARCHAR(50) NOT NULL DEFAULT 'all',
          `release_title` VARCHAR(255) NOT NULL,
          `release_notes` LONGTEXT DEFAULT NULL,
          `mandatory` TINYINT(1) NOT NULL DEFAULT 0,
          `min_supported_version` VARCHAR(50) DEFAULT '1.0.0',
          
          `win_download_url` TEXT DEFAULT NULL,
          `win_file_size` BIGINT DEFAULT 0,
          `win_sha256` VARCHAR(64) DEFAULT NULL,
          
          `mac_arm_download_url` TEXT DEFAULT NULL,
          `mac_arm_file_size` BIGINT DEFAULT 0,
          `mac_arm_sha256` VARCHAR(64) DEFAULT NULL,
          
          `mac_intel_download_url` TEXT DEFAULT NULL,
          `mac_intel_file_size` BIGINT DEFAULT 0,
          `mac_intel_sha256` VARCHAR(64) DEFAULT NULL,
          
          `linux_download_url` TEXT DEFAULT NULL,
          `linux_file_size` BIGINT DEFAULT 0,
          `linux_sha256` VARCHAR(64) DEFAULT NULL,
          
          `signature` TEXT DEFAULT NULL,
          `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
          `download_count` INT NOT NULL DEFAULT 0,
          `published_at` DATETIME DEFAULT NULL,
          `created_by` VARCHAR(100) NOT NULL DEFAULT 'admin',
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY `idx_ver_status_channel` (`status`, `channel`),
          KEY `idx_ver_num` (`version`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS `software_update_logs` (
          `id` VARCHAR(100) NOT NULL PRIMARY KEY,
          `user_id` VARCHAR(100) DEFAULT NULL,
          `license_key` VARCHAR(100) DEFAULT NULL,
          `from_version` VARCHAR(50) NOT NULL,
          `to_version` VARCHAR(50) NOT NULL,
          `os` VARCHAR(50) NOT NULL,
          `architecture` VARCHAR(50) NOT NULL,
          `channel` VARCHAR(50) NOT NULL DEFAULT 'stable',
          `status` VARCHAR(50) NOT NULL,
          `error_message` TEXT DEFAULT NULL,
          `ip_address` VARCHAR(45) DEFAULT NULL,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY `idx_log_user` (`user_id`),
          KEY `idx_log_ver` (`to_version`),
          KEY `idx_log_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (Throwable $e) {}

/**
 * Compare two semver strings: returns 1 if vA > vB, -1 if vA < vB, 0 if equal
 */
function compareSemverPhp(string $vA, string $vB): int {
    $cleanA = trim(preg_replace('/^v/i', '', $vA) ?: '0.0.0');
    $cleanB = trim(preg_replace('/^v/i', '', $vB) ?: '0.0.0');

    $partsA = explode('.', explode('-', explode('+', $cleanA)[0])[0]);
    $partsB = explode('.', explode('-', explode('+', $cleanB)[0])[0]);

    $maxLen = max(count($partsA), count($partsB));
    for ($i = 0; $i < $maxLen; $i++) {
        $a = isset($partsA[$i]) ? (int)$partsA[$i] : 0;
        $b = isset($partsB[$i]) ? (int)$partsB[$i] : 0;
        if ($a > $b) return 1;
        if ($a < $b) return -1;
    }
    return 0;
}

/**
 * Format bytes into human readable string (e.g. 198 MB)
 */
function formatBytes(int $bytes, int $precision = 1): string {
    if ($bytes <= 0) return '0 MB';
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= (1 << (10 * $pow));
    return round($bytes, $precision) . ' ' . $units[$pow];
}

/**
 * Normalize Client Platform & Architecture
 */
function normalizePlatformInfo(string $rawOs, string $rawArch): array {
    $os = strtolower(trim($rawOs));
    $arch = strtolower(trim($rawArch));

    // Normalize OS
    if (in_array($os, ['win', 'win32', 'windows', 'windows_nt'])) {
        $normalizedOs = 'windows';
    } elseif (in_array($os, ['mac', 'macos', 'darwin', 'osx', 'apple'])) {
        $normalizedOs = 'macos';
    } else {
        $normalizedOs = 'linux';
    }

    // Normalize Arch
    if (in_array($arch, ['arm64', 'aarch64', 'm1', 'm2', 'm3', 'm4', 'apple_silicon', 'silicon'])) {
        $normalizedArch = 'arm64';
    } else {
        $normalizedArch = 'x64';
    }

    // Determine platform key
    if ($normalizedOs === 'windows') {
        $platformKey = 'windows-x64';
    } elseif ($normalizedOs === 'macos') {
        $platformKey = ($normalizedArch === 'arm64') ? 'macos-arm64' : 'macos-x64';
    } else {
        $platformKey = 'linux-x64';
    }

    return [
        'os' => $normalizedOs,
        'arch' => $normalizedArch,
        'platformKey' => $platformKey
    ];
}

// Parse request payload
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? 'check-update');

// ── 1. Check for Software Updates ──
if ($action === 'check-update') {
    $currentVersion = $_GET['current_version'] ?? ($input['current_version'] ?? '1.0.0');
    $rawOs = $_GET['os'] ?? ($input['os'] ?? PHP_OS);
    $rawArch = $_GET['architecture'] ?? ($input['architecture'] ?? ($input['arch'] ?? 'x64'));
    $channel = strtolower(trim($_GET['channel'] ?? ($input['channel'] ?? 'stable')));
    $licenseKey = trim($_GET['license_key'] ?? ($input['license_key'] ?? ''));

    $platInfo = normalizePlatformInfo($rawOs, $rawArch);
    $pKey = $platInfo['platformKey'];

    // Find latest published version for channel (with fallback to stable)
    $stmt = $db->prepare("
        SELECT * FROM software_versions
        WHERE status = 'published'
          AND (channel = ? OR channel = 'stable')
        ORDER BY published_at DESC, created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$channel]);
    $latest = $stmt->fetch();

    if (!$latest) {
        respondJson([
            'update_available' => false,
            'current_version' => $currentVersion,
            'message' => 'Your application is up to date.'
        ]);
    }

    $isNewer = compareSemverPhp($latest['version'], $currentVersion) > 0;
    $minSupported = $latest['min_supported_version'] ?? '1.0.0';
    $isMandatory = !empty($latest['mandatory']) || (compareSemverPhp($minSupported, $currentVersion) > 0);

    if (!$isNewer) {
        respondJson([
            'update_available' => false,
            'current_version' => $currentVersion,
            'latest_version' => $latest['version'],
            'message' => 'You are on the latest version.'
        ]);
    }

    // Select platform-specific binaries
    $downloadUrl = '';
    $fileSizeBytes = 0;
    $checksum = '';
    $filename = '';

    switch ($pKey) {
        case 'windows-x64':
            $downloadUrl = $latest['win_download_url'] ?: '';
            $fileSizeBytes = (int)($latest['win_file_size'] ?: 0);
            $checksum = $latest['win_sha256'] ?: '';
            $filename = "AntiProfiles-Setup-{$latest['version']}.exe";
            break;
        case 'macos-arm64':
            $downloadUrl = $latest['mac_arm_download_url'] ?: '';
            $fileSizeBytes = (int)($latest['mac_arm_file_size'] ?: 0);
            $checksum = $latest['mac_arm_sha256'] ?: '';
            $filename = "AntiProfiles-{$latest['version']}-arm64.dmg";
            break;
        case 'macos-x64':
            $downloadUrl = $latest['mac_intel_download_url'] ?: '';
            $fileSizeBytes = (int)($latest['mac_intel_file_size'] ?: 0);
            $checksum = $latest['mac_intel_sha256'] ?: '';
            $filename = "AntiProfiles-{$latest['version']}-x64.dmg";
            break;
        case 'linux-x64':
        default:
            $downloadUrl = $latest['linux_download_url'] ?: '';
            $fileSizeBytes = (int)($latest['linux_file_size'] ?: 0);
            $checksum = $latest['linux_sha256'] ?: '';
            $filename = "AntiProfiles-{$latest['version']}.AppImage";
            break;
    }

    // Default download slug if no external direct URL configured
    if (empty($downloadUrl) || strpos($downloadUrl, 'http') !== 0) {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $downloadUrl = "{$protocol}://{$host}/api/software.php?action=download&version={$latest['version']}&platform={$pKey}";
    }

    // Log check attempt
    try {
        $logStmt = $db->prepare("
            INSERT INTO software_update_logs (
                id, license_key, from_version, to_version, os, architecture, channel, status, ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'update_detected', ?)
        ");
        $logStmt->execute([
            'log_' . uniqid() . '_' . time(),
            $licenseKey ?: null,
            $currentVersion,
            $latest['version'],
            $platInfo['os'],
            $platInfo['arch'],
            $latest['channel'] ?? 'stable',
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);
    } catch (Throwable $e) {}

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseUrl = "{$protocol}://{$host}";

    $downloads = [
        'windows' => (!empty($latest['win_download_url']) && strpos($latest['win_download_url'], 'http') === 0)
            ? $latest['win_download_url']
            : "{$baseUrl}/api/software.php?action=download&version={$latest['version']}&platform=windows-x64",
        'mac_intel' => (!empty($latest['mac_intel_download_url']) && strpos($latest['mac_intel_download_url'], 'http') === 0)
            ? $latest['mac_intel_download_url']
            : "{$baseUrl}/api/software.php?action=download&version={$latest['version']}&platform=macos-x64",
        'mac_arm64' => (!empty($latest['mac_arm_download_url']) && strpos($latest['mac_arm_download_url'], 'http') === 0)
            ? $latest['mac_arm_download_url']
            : "{$baseUrl}/api/software.php?action=download&version={$latest['version']}&platform=macos-arm64",
        'linux' => (!empty($latest['linux_download_url']) && strpos($latest['linux_download_url'], 'http') === 0)
            ? $latest['linux_download_url']
            : "{$baseUrl}/api/software.php?action=download&version={$latest['version']}&platform=linux-x64"
    ];

    $rawNotes = $latest['release_notes'] ?: 'Performance improvements, proxy fixes, fingerprint updates and security patches.';
    $notesArray = array_values(array_filter(array_map('trim', explode("\n", $rawNotes))));

    respondJson([
        'update_available' => true,
        'latest_version' => $latest['version'],
        'minimum_version' => $minSupported,
        'min_supported_version' => $minSupported,
        'build' => $latest['build'] ?: '1',
        'channel' => $latest['channel'] ?: 'stable',
        'force_update' => (bool)$isMandatory,
        'mandatory' => (bool)$isMandatory,
        'title' => $latest['release_title'] ?: "AntiProfiles v{$latest['version']}",
        'description' => $rawNotes,
        'description_list' => !empty($notesArray) ? $notesArray : [$rawNotes],
        'release_date' => $latest['published_at'] ? substr($latest['published_at'], 0, 10) : date('Y-m-d'),
        'file_size' => formatBytes($fileSizeBytes),
        'file_size_bytes' => $fileSizeBytes,
        'filename' => $filename,
        'download_url' => $downloadUrl,
        'downloads' => $downloads,
        'checksum' => $checksum,
        'signature' => $latest['signature'] ?: '',
        'platform' => $pKey
    ]);
}

// ── 2. Download Installer Binary with HTTP Range Resumption ──
if ($action === 'download') {
    $ver = $_GET['version'] ?? '';
    $platformKey = $_GET['platform'] ?? 'windows-x64';
    $platInfo = normalizePlatformInfo($platformKey, 'x64');
    $pKey = $platInfo['platformKey'];

    $stmt = $db->prepare("SELECT * FROM software_versions WHERE (version = ? OR ? = '') AND status = 'published' ORDER BY published_at DESC LIMIT 1");
    $stmt->execute([$ver, $ver]);
    $rel = $stmt->fetch();

    if ($rel) {
        // Increment download counter
        try {
            $upd = $db->prepare("UPDATE software_versions SET download_count = download_count + 1 WHERE id = ?");
            $upd->execute([$rel['id']]);
        } catch (Throwable $e) {}

        // If direct external link, redirect
        $targetUrl = '';
        if ($pKey === 'windows-x64') $targetUrl = $rel['win_download_url'];
        elseif ($pKey === 'macos-arm64') $targetUrl = $rel['mac_arm_download_url'];
        elseif ($pKey === 'macos-x64') $targetUrl = $rel['mac_intel_download_url'];
        else $targetUrl = $rel['linux_download_url'];

        if (!empty($targetUrl) && preg_match('/^https?:\/\//i', $targetUrl) && strpos($targetUrl, $_SERVER['HTTP_HOST'] ?? '') === false) {
            header('Location: ' . $targetUrl);
            exit;
        }
    }

    // Stream from local releases directory
    $defaultFilenameMap = [
        'windows-x64' => 'AntiProfiles-Windows-x64.exe',
        'macos-arm64' => 'AntiProfiles-macOS-arm64.dmg',
        'macos-x64' => 'AntiProfiles-macOS-x64.dmg',
        'linux-x64' => 'AntiProfiles-Linux-x86_64.AppImage'
    ];

    $filename = $defaultFilenameMap[$pKey] ?? 'AntiProfiles-Installer.exe';
    $localFile = __DIR__ . '/../releases/' . $filename;

    if (file_exists($localFile) && is_file($localFile)) {
        $fileSize = filesize($localFile);
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');
        while (ob_get_level() > 0) @ob_end_clean();

        $fp = fopen($localFile, 'rb');
        $start = 0;
        $end = $fileSize - 1;

        if (isset($_SERVER['HTTP_RANGE'])) {
            if (preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $matches)) {
                $start = floatval($matches[1]);
                if (!empty($matches[2])) $end = floatval($matches[2]);
            }
            header('HTTP/1.1 206 Partial Content');
            header("Content-Range: bytes {$start}-{$end}/{$fileSize}");
        } else {
            header('HTTP/1.1 200 OK');
        }

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
        header('Accept-Ranges: bytes');
        header('Content-Length: ' . ($end - $start + 1));
        header('X-Accel-Buffering: no');
        header('Cache-Control: public, must-revalidate, max-age=0');

        if ($start > 0) fseek($fp, (int)$start);

        $bytesRemaining = $end - $start + 1;
        $chunkSize = 64 * 1024;
        while (!feof($fp) && $bytesRemaining > 0 && !connection_aborted()) {
            $readSize = ($bytesRemaining > $chunkSize) ? $chunkSize : $bytesRemaining;
            echo fread($fp, (int)$readSize);
            @flush();
            $bytesRemaining -= $readSize;
        }
        fclose($fp);
        exit;
    }

    header('HTTP/1.1 404 Not Found');
    echo "Error: Requested software release installer not found.";
    exit;
}

// ── 3. Version History & Changelog ──
if ($action === 'version-history') {
    $channel = strtolower(trim($_GET['channel'] ?? 'stable'));
    $stmt = $db->prepare("
        SELECT id, version, build, channel, release_title, release_notes, mandatory, min_supported_version, published_at, download_count
        FROM software_versions
        WHERE status = 'published'
        ORDER BY published_at DESC, created_at DESC
        LIMIT 50
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();

    respondJson([
        'success' => true,
        'data' => $rows
    ]);
}

// ── 4. Release Notes for Specific Version ──
if ($action === 'release-notes') {
    $ver = trim($_GET['version'] ?? '');
    $stmt = $db->prepare("SELECT version, release_title, release_notes, published_at, mandatory FROM software_versions WHERE version = ? LIMIT 1");
    $stmt->execute([$ver]);
    $rel = $stmt->fetch();

    if (!$rel) {
        respondJson(['success' => false, 'error' => 'Release not found'], 404);
    }

    respondJson([
        'success' => true,
        'data' => $rel
    ]);
}

// ── 5. Client Update Telemetry Logging ──
if ($action === 'report-status') {
    $fromVer = $input['from_version'] ?? '1.0.0';
    $toVer = $input['to_version'] ?? '1.0.0';
    $os = $input['os'] ?? PHP_OS;
    $arch = $input['architecture'] ?? 'x64';
    $channel = $input['channel'] ?? 'stable';
    $status = $input['status'] ?? 'unknown';
    $errorMsg = $input['error_message'] ?? null;
    $licenseKey = $input['license_key'] ?? null;

    try {
        $logStmt = $db->prepare("
            INSERT INTO software_update_logs (
                id, license_key, from_version, to_version, os, architecture, channel, status, error_message, ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $logStmt->execute([
            'log_' . uniqid() . '_' . time(),
            $licenseKey,
            $fromVer,
            $toVer,
            $os,
            $arch,
            $channel,
            $status,
            $errorMsg,
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);
        respondJson(['success' => true]);
    } catch (Throwable $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ── 6. Available Channels ──
if ($action === 'channels') {
    respondJson([
        'success' => true,
        'data' => [
            ['id' => 'stable', 'name' => 'Stable Channel (Recommended)', 'description' => 'Tested, production-grade releases with maximum reliability.'],
            ['id' => 'beta', 'name' => 'Beta Channel', 'description' => 'Early access to new features and fixes before public rollout.'],
            ['id' => 'alpha', 'name' => 'Alpha / Experimental', 'description' => 'Cutting-edge test builds for power users and QA.'],
            ['id' => 'internal', 'name' => 'Internal Testing', 'description' => 'Development and staging builds for internal team members.']
        ]
    ]);
}

respondJson(['success' => false, 'error' => 'Invalid action specified'], 400);
