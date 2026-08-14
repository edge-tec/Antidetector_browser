<?php
// ──────────────────────────────────────────────
// ProfileVault — Licensing & Device REST API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

function getDesktopAppConfigMap(): array {
    $db = Database::getConnection();
    $stmt = $db->query("SELECT config_key, config_value FROM desktop_app_config");
    $rows = $stmt->fetchAll();
    $map = [];
    foreach ($rows as $r) {
        $map[$r['config_key']] = $r['config_value'];
    }
    return $map;
}

function compareSemanticVersions(string $v1, string $v2): int {
    $p1 = array_map('intval', explode('.', $v1));
    $p2 = array_map('intval', explode('.', $v2));
    for ($i = 0; $i < max(count($p1), count($p2)); $i++) {
        $val1 = $p1[$i] ?? 0;
        $val2 = $p2[$i] ?? 0;
        if ($val1 > $val2) return 1;
        if ($val1 < $val2) return -1;
    }
    return 0;
}

function validateUserLicenseInternal(string $userId, ?string $installationId = null, ?string $platform = null, ?string $appVersion = null): array {
    $db = Database::getConnection();

    // 1. Fetch User Account
    $userStmt = $db->prepare("SELECT id, name, email, role, account_status FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        return [
            'valid' => false,
            'account_status' => 'not_found',
            'subscription_status' => 'invalid',
            'error' => 'User account not found'
        ];
    }

    if ($user['account_status'] === 'suspended') {
        return [
            'valid' => false,
            'account_status' => 'suspended',
            'subscription_status' => 'suspended',
            'error' => 'Your account has been suspended by an administrator. Please contact support.',
            'renewal_url' => '#contact'
        ];
    }

    // 2. Desktop Version Check
    $config = getDesktopAppConfigMap();
    $minVersion = $config['min_supported_version'] ?? '1.0.0';
    $forceUpdate = ($config['force_update'] ?? 'false') === 'true';
    $isVersionSupported = !$appVersion || compareSemanticVersions($appVersion, $minVersion) >= 0;

    if (!$isVersionSupported && $forceUpdate) {
        return [
            'valid' => false,
            'account_status' => $user['account_status'],
            'subscription_status' => 'update_required',
            'error' => "Your desktop application version ($appVersion) is below the minimum required version ($minVersion). Please update to proceed.",
            'app_version_status' => [
                'force_update' => true,
                'min_version' => $minVersion,
                'current_version' => $appVersion ?: '1.0.0',
                'is_supported' => false
            ],
            'renewal_url' => '#download'
        ];
    }

    // 3. Device Count Limit Check
    $maxDevicesLimit = (int)($config['max_devices_limit'] ?? 2);
    if ($installationId) {
        $instStmt = $db->prepare("SELECT * FROM desktop_installations WHERE installation_id = ?");
        $instStmt->execute([$installationId]);
        $inst = $instStmt->fetch();

        if (!$inst) {
            $countStmt = $db->prepare("SELECT COUNT(*) as count FROM desktop_installations WHERE user_id = ? AND revoked_at IS NULL");
            $countStmt->execute([$userId]);
            $existingCount = (int)$countStmt->fetch()['count'];

            if ($existingCount >= $maxDevicesLimit && $user['role'] !== 'admin') {
                return [
                    'valid' => false,
                    'account_status' => $user['account_status'],
                    'subscription_status' => 'device_limit_reached',
                    'error' => "Device limit reached. Your subscription allows up to $maxDevicesLimit active devices. Please revoke an existing device to proceed.",
                    'device' => ['device_count' => $existingCount, 'max_devices' => $maxDevicesLimit],
                    'renewal_url' => '#devices'
                ];
            }

            $insertInst = $db->prepare("
                INSERT INTO desktop_installations (id, user_id, installation_id, platform, device_name, app_version, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ");
            $insertInst->execute([
                'inst_' . bin2hex(random_bytes(6)),
                $userId,
                $installationId,
                $platform ?: 'desktop',
                ($platform ?: 'Desktop') . ' Device',
                $appVersion ?: '1.0.0'
            ]);
        } else {
            if ($inst['revoked_at'] !== null) {
                return [
                    'valid' => false,
                    'account_status' => $user['account_status'],
                    'subscription_status' => 'device_revoked',
                    'error' => 'This device installation has been revoked by an administrator or user.',
                    'renewal_url' => '#devices'
                ];
            }

            $updateInst = $db->prepare("UPDATE desktop_installations SET last_seen_at = CURRENT_TIMESTAMP, app_version = ? WHERE installation_id = ?");
            $updateInst->execute([$appVersion ?: '1.0.0', $installationId]);
        }
    }

    $activeCountStmt = $db->prepare("SELECT COUNT(*) as count FROM desktop_installations WHERE user_id = ? AND revoked_at IS NULL");
    $activeCountStmt->execute([$userId]);
    $activeDevicesCount = (int)$activeCountStmt->fetch()['count'];

    // 4. Subscription & Expiration Verification
    $subStmt = $db->prepare("SELECT * FROM subscriptions WHERE user_id = ?");
    $subStmt->execute([$userId]);
    $sub = $subStmt->fetch();

    if (!$sub) {
        $subId = 'sub_' . $userId;
        $defaultPlanId = $user['role'] === 'admin' ? 'plan_pro' : 'plan_starter';
        $createSub = $db->prepare("
            INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days)
            VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 YEAR), 3)
        ");
        $createSub->execute([$subId, $userId, $defaultPlanId]);

        $subStmt->execute([$userId]);
        $sub = $subStmt->fetch();
    }

    $planStmt = $db->prepare("SELECT * FROM pricing_plans WHERE id = ?");
    $planStmt->execute([$sub['plan_id']]);
    $plan = $planStmt->fetch() ?: [
        'id' => 'plan_starter',
        'name' => 'Starter',
        'monthly_price' => 19,
        'yearly_price' => 15,
        'profile_limit' => 25,
        'team_limit' => 2,
        'api_limit' => 'Basic API'
    ];

    $now = time();
    $expiresAtTime = strtotime($sub['expires_at']);
    $graceDays = (int)($sub['grace_period_days'] ?? 3);
    $graceExpiresAtTime = $expiresAtTime + ($graceDays * 86400);

    $isExpired = $now > $expiresAtTime;
    $isGraceActive = false;
    $currentSubStatus = $sub['status'];

    if ($sub['status'] === 'suspended') {
        return [
            'valid' => false,
            'account_status' => $user['account_status'],
            'subscription_status' => 'suspended',
            'plan' => ['id' => $plan['id'], 'name' => $plan['name']],
            'expires_at' => $sub['expires_at'],
            'error' => 'Your subscription is suspended. Please contact support.',
            'renewal_url' => '#pricing'
        ];
    }

    if ($isExpired) {
        if ($now <= $graceExpiresAtTime && $graceDays > 0) {
            $isGraceActive = true;
            $currentSubStatus = 'grace_period';
        } else {
            $currentSubStatus = 'expired';
            $updSub = $db->prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?");
            $updSub->execute([$sub['id']]);

            return [
                'valid' => false,
                'account_status' => $user['account_status'],
                'subscription_status' => 'expired',
                'plan' => ['id' => $plan['id'], 'name' => $plan['name']],
                'expires_at' => $sub['expires_at'],
                'error' => 'Your subscription has expired. Please renew to continue using desktop browser profiles.',
                'renewal_url' => '#pricing'
            ];
        }
    }

    $hasApiAccess = $plan['api_limit'] !== '—' && $plan['api_limit'] !== 'Disabled';
    $isProOrBusiness = (float)$plan['monthly_price'] >= 49 || $user['role'] === 'admin';

    return [
        'valid' => true,
        'account_status' => $user['account_status'],
        'subscription_status' => $currentSubStatus,
        'plan' => [
            'id' => $plan['id'],
            'name' => $plan['name'],
            'monthly_price' => (float)$plan['monthly_price'],
            'yearly_price' => (float)$plan['yearly_price']
        ],
        'expires_at' => $sub['expires_at'],
        'grace_period_active' => $isGraceActive,
        'features' => [
            'browser_profiles' => true,
            'advanced_fingerprint' => $isProOrBusiness,
            'proxy_manager' => true,
            'profile_templates' => true,
            'team_management' => (int)$plan['team_limit'] > 1 || $user['role'] === 'admin',
            'api_access' => $hasApiAccess
        ],
        'limits' => [
            'profiles' => $user['role'] === 'admin' ? 1000 : (int)($plan['profile_limit'] ?? 25),
            'team_members' => $user['role'] === 'admin' ? 50 : (int)($plan['team_limit'] ?? 2),
            'api_access' => $hasApiAccess
        ],
        'device' => [
            'installation_id' => $installationId ?: '',
            'device_count' => $activeDevicesCount,
            'max_devices' => $maxDevicesLimit
        ],
        'app_version_status' => [
            'force_update' => false,
            'min_version' => $minVersion,
            'current_version' => $appVersion ?: '1.0.0',
            'is_supported' => true
        ]
    ];
}

// REST API Handler for /api/license
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    $user = getAuthenticatedUser();
    if (!$user) {
        respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $installationId = $_SERVER['HTTP_X_INSTALLATION_ID'] ?? $input['installationId'] ?? null;
    $platform = $_SERVER['HTTP_X_PLATFORM'] ?? $input['platform'] ?? null;
    $appVersion = $_SERVER['HTTP_X_APP_VERSION'] ?? $input['appVersion'] ?? null;

    $result = validateUserLicenseInternal($user['id'], $installationId, $platform, $appVersion);
    respondJson(['success' => true, 'data' => $result]);
}
