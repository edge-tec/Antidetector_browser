<?php
// ──────────────────────────────────────────────
// ProfileVault — Releases & Application Downloads REST API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

sendJsonHeader();

$config = getDesktopAppConfigMap();

$manifest = [
    'version' => $config['win_app_version'] ?? '1.0.0',
    'min_supported_version' => $config['min_supported_version'] ?? '1.0.0',
    'force_update' => ($config['force_update'] ?? 'false') === 'true',
    'release_notes' => $config['release_notes'] ?? 'Initial stable release.',
    'platforms' => [
        'windows-x64' => [
            'version' => $config['win_app_version'] ?? '1.0.0',
            'download_url' => $config['win_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-Windows-x64.exe',
            'enabled' => ($config['win_enabled'] ?? 'true') !== 'false'
        ],
        'macos-arm64' => [
            'version' => $config['mac_arm_app_version'] ?? $config['mac_app_version'] ?? '1.0.0',
            'download_url' => $config['mac_arm_download_url'] ?? $config['mac_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-macOS-Apple-Silicon-arm64.dmg',
            'enabled' => ($config['mac_arm_enabled'] ?? 'true') !== 'false'
        ],
        'macos-x64' => [
            'version' => $config['mac_intel_app_version'] ?? $config['mac_app_version'] ?? '1.0.0',
            'download_url' => $config['mac_intel_download_url'] ?? $config['mac_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-macOS-Intel-x64.dmg',
            'enabled' => ($config['mac_intel_enabled'] ?? 'true') !== 'false'
        ],
        'linux-x64' => [
            'version' => $config['linux_app_version'] ?? '1.0.0',
            'download_url' => $config['linux_download_url'] ?? 'https://releases.profilevault.local/ProfileVault-Linux-x86_64.AppImage',
            'enabled' => ($config['linux_enabled'] ?? 'true') !== 'false'
        ]
    ]
];

respondJson(['success' => true, 'data' => $manifest]);
