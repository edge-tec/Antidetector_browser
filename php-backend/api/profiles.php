<?php
// ──────────────────────────────────────────────
// ProfileVault — Centralized Profile Management REST API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$db = Database::getConnection();

// Authenticate request token
$token = null;
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
    $token = $matches[1];
} elseif (!empty($_GET['token'])) {
    $token = $_GET['token'];
}

$input = json_input();
if (!$token && !empty($input['sessionToken'])) {
    $token = $input['sessionToken'];
}

if (!$token) {
    respondJson(['success' => false, 'error' => 'Authentication token required.'], 401);
}

$userId = verifySessionToken($token);
if (!$userId) {
    respondJson(['success' => false, 'error' => 'Invalid or expired session token.'], 401);
}

// Fetch authenticated user details
$userStmt = $db->prepare("SELECT id, name, email, role, permissions, auth_version, account_status FROM users WHERE id = ?");
$userStmt->execute([$userId]);
$currentUser = $userStmt->fetch(PDO::FETCH_ASSOC);

if (!$currentUser || $currentUser['account_status'] === 'suspended' || $currentUser['account_status'] === 'disabled') {
    respondJson(['success' => false, 'error' => 'Account is suspended or disabled.'], 403);
}

$userRole = strtolower($currentUser['role'] ?? 'user');
$isAdmin = ($userRole === 'admin' || $userRole === 'super_admin');

switch ($action) {

    // ── 1. List Profiles ──
    case 'list':
    case 'get-all':
        try {
            $search = trim($_GET['search'] ?? '');
            $groupId = trim($_GET['groupId'] ?? '');
            $status = trim($_GET['status'] ?? '');

            $query = "SELECT * FROM profiles WHERE 1=1";
            $params = [];

            if (!$isAdmin) {
                $query .= " AND user_id = ?";
                $params[] = $userId;
            }

            if (!empty($search)) {
                $query .= " AND (name LIKE ? OR notes LIKE ? OR tags LIKE ?)";
                $like = "%{$search}%";
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            if (!empty($groupId)) {
                $query .= " AND group_id = ?";
                $params[] = $groupId;
            }

            if (!empty($status)) {
                $query .= " AND status = ?";
                $params[] = $status;
            }

            $query .= " ORDER BY updated_at DESC";

            $stmt = $db->prepare($query);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $profiles = [];
            foreach ($rows as $r) {
                $fingerprint = !empty($r['fingerprint']) ? json_decode($r['fingerprint'], true) : [];
                $profiles[] = [
                    'id' => $r['id'],
                    'userId' => $r['user_id'],
                    'name' => $r['name'],
                    'groupId' => $r['group_id'],
                    'notes' => $r['notes'] ?? '',
                    'color' => $r['color'] ?? '#6366F1',
                    'icon' => $r['icon'] ?? 'globe',
                    'browserVersion' => $r['browser_version'] ?? 'latest',
                    'userAgent' => $r['user_agent'] ?? '',
                    'language' => $r['language'] ?? 'en-US',
                    'timezone' => $r['timezone'] ?? 'America/New_York',
                    'screenWidth' => (int)($r['screen_width'] ?? 1920),
                    'screenHeight' => (int)($r['screen_height'] ?? 1080),
                    'webrtcMode' => $r['webrtc_mode'] ?? 'fake',
                    'canvasMode' => $r['canvas_mode'] ?? 'noise',
                    'webglMode' => $r['webgl_mode'] ?? 'noise',
                    'hwConcurrency' => (int)($r['hw_concurrency'] ?? 8),
                    'deviceMemory' => (int)($r['device_memory'] ?? 8),
                    'hwAcceleration' => (bool)($r['hw_acceleration'] ?? 1),
                    'proxyId' => $r['proxy_id'] ?? null,
                    'tags' => $r['tags'] ?? '',
                    'status' => $r['status'] ?? 'stopped',
                    'osType' => $r['os_type'] ?? 'windows-10',
                    'fingerprint' => $fingerprint,
                    'folder' => $r['folder'] ?? null,
                    'startUrl' => $r['start_url'] ?? '',
                    'launchArgs' => $r['launch_args'] ?? '',
                    'saveHistory' => (bool)($r['save_history'] ?? 1),
                    'savePasswords' => (bool)($r['save_passwords'] ?? 1),
                    'googleServices' => (bool)($r['google_services'] ?? 0),
                    'systemExtensions' => (bool)($r['system_extensions'] ?? 0),
                    'customDns' => $r['custom_dns'] ?? null,
                    'createdAt' => $r['created_at'],
                    'updatedAt' => $r['updated_at']
                ];
            }

            respondJson(['success' => true, 'data' => $profiles, 'count' => count($profiles)]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to fetch profiles: ' . $e->getMessage()], 500);
        }
        break;

    // ── 2. Create Profile ──
    case 'create':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondJson(['success' => false, 'error' => 'POST method required.'], 405);
        }

        $name = trim($input['name'] ?? '');
        if (empty($name)) {
            respondJson(['success' => false, 'error' => 'Profile name is required.'], 400);
        }

        // 1. Quota Validation
        try {
            $countStmt = $db->prepare("SELECT COUNT(*) as total FROM profiles WHERE user_id = ?");
            $countStmt->execute([$userId]);
            $currentCount = (int)$countStmt->fetchColumn();

            // Fetch authoritative profile limit: Subscriptions custom limit > User custom limit > Pricing Plan limit > Default (3)
            $limitStmt = $db->prepare("
                SELECT 
                    s.profile_limit as sub_limit,
                    u.profile_limit as user_limit,
                    p.profile_limit as plan_limit
                FROM users u
                LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
                LEFT JOIN pricing_plans p ON s.plan_id = p.id
                WHERE u.id = ?
                ORDER BY s.created_at DESC LIMIT 1
            ");
            $limitStmt->execute([$userId]);
            $limits = $limitStmt->fetch();

            $maxAllowed = 3; // Default free plan limit
            if ($limits) {
                if (!empty($limits['sub_limit']) && (int)$limits['sub_limit'] > 0) {
                    $maxAllowed = (int)$limits['sub_limit'];
                } elseif (!empty($limits['user_limit']) && (int)$limits['user_limit'] > 0) {
                    $maxAllowed = (int)$limits['user_limit'];
                } elseif (!empty($limits['plan_limit']) && (int)$limits['plan_limit'] > 0) {
                    $maxAllowed = (int)$limits['plan_limit'];
                }
            }

            if (!$isAdmin && $currentCount >= $maxAllowed) {
                respondJson([
                    'success' => false,
                    'error' => "Profile limit reached ({$currentCount}/{$maxAllowed}). Your account is strictly limited to {$maxAllowed} profiles. Please upgrade your plan in the Web Control Center to create more profiles."
                ], 403);
            }
        } catch (Throwable $e) {}

        // 2. Insert Profile
        $profileId = $input['id'] ?? ('prof_' . bin2hex(random_bytes(8)));
        $groupId = $input['groupId'] ?? null;
        $notes = $input['notes'] ?? '';
        $color = $input['color'] ?? '#6366F1';
        $icon = $input['icon'] ?? 'globe';
        $browserVersion = $input['browserVersion'] ?? 'latest';
        $userAgent = $input['userAgent'] ?? '';
        $language = $input['language'] ?? 'en-US';
        $timezone = $input['timezone'] ?? 'America/New_York';
        $screenWidth = (int)($input['screenWidth'] ?? 1920);
        $screenHeight = (int)($input['screenHeight'] ?? 1080);
        $webrtcMode = $input['webrtcMode'] ?? 'fake';
        $canvasMode = $input['canvasMode'] ?? 'noise';
        $webglMode = $input['webglMode'] ?? 'noise';
        $hwConcurrency = (int)($input['hwConcurrency'] ?? 8);
        $deviceMemory = (int)($input['deviceMemory'] ?? 8);
        $hwAcceleration = isset($input['hwAcceleration']) ? (int)$input['hwAcceleration'] : 1;
        $proxyId = $input['proxyId'] ?? null;
        $tags = $input['tags'] ?? '';
        $osType = $input['osType'] ?? 'windows-10';
        $fingerprintJson = isset($input['fingerprint']) ? json_encode($input['fingerprint'], JSON_UNESCAPED_SLASHES) : null;
        $folder = $input['folder'] ?? null;
        $startUrl = $input['startUrl'] ?? '';
        $launchArgs = $input['launchArgs'] ?? '';
        $saveHistory = isset($input['saveHistory']) ? (int)$input['saveHistory'] : 1;
        $savePasswords = isset($input['savePasswords']) ? (int)$input['savePasswords'] : 1;
        $googleServices = isset($input['googleServices']) ? (int)$input['googleServices'] : 0;
        $systemExtensions = isset($input['systemExtensions']) ? (int)$input['systemExtensions'] : 0;
        $customDns = $input['customDns'] ?? null;

        try {
            $insert = $db->prepare("
                INSERT INTO profiles (
                    id, user_id, name, group_id, notes, color, icon, browser_version, user_agent,
                    language, timezone, screen_width, screen_height, webrtc_mode, canvas_mode, webgl_mode,
                    hw_concurrency, device_memory, hw_acceleration, proxy_id, tags, status, os_type,
                    fingerprint, folder, start_url, launch_args, save_history, save_passwords,
                    google_services, system_extensions, custom_dns, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, 'stopped', ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    group_id = VALUES(group_id),
                    notes = VALUES(notes),
                    color = VALUES(color),
                    icon = VALUES(icon),
                    user_agent = VALUES(user_agent),
                    language = VALUES(language),
                    timezone = VALUES(timezone),
                    screen_width = VALUES(screen_width),
                    screen_height = VALUES(screen_height),
                    proxy_id = VALUES(proxy_id),
                    fingerprint = VALUES(fingerprint),
                    updated_at = NOW()
            ");

            $insert->execute([
                $profileId, $userId, $name, $groupId, $notes, $color, $icon, $browserVersion, $userAgent,
                $language, $timezone, $screenWidth, $screenHeight, $webrtcMode, $canvasMode, $webglMode,
                $hwConcurrency, $deviceMemory, $hwAcceleration, $proxyId, $tags, $osType,
                $fingerprintJson, $folder, $startUrl, $launchArgs, $saveHistory, $savePasswords,
                $googleServices, $systemExtensions, $customDns
            ]);

            // Broadcast Real-Time SSE Event
            publishRealtimeEvent('profile.created', [
                'profileId' => $profileId,
                'userId' => $userId,
                'name' => $name,
                'osType' => $osType,
                'createdAt' => date('c')
            ], $userId);

            respondJson([
                'success' => true,
                'data' => [
                    'id' => $profileId,
                    'userId' => $userId,
                    'name' => $name,
                    'status' => 'stopped',
                    'osType' => $osType,
                    'createdAt' => date('c'),
                    'updatedAt' => date('c')
                ],
                'message' => "Profile \"{$name}\" created successfully!"
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to create profile: ' . $e->getMessage()], 500);
        }
        break;

    // ── 3. Update Profile ──
    case 'update':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondJson(['success' => false, 'error' => 'POST method required.'], 405);
        }

        $id = $input['id'] ?? $_GET['id'] ?? '';
        if (empty($id)) {
            respondJson(['success' => false, 'error' => 'Profile ID required.'], 400);
        }

        try {
            // Verify ownership
            $checkStmt = $db->prepare("SELECT user_id, name FROM profiles WHERE id = ?");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                respondJson(['success' => false, 'error' => 'Profile not found.'], 404);
            }

            if (!$isAdmin && $existing['user_id'] !== $userId) {
                respondJson(['success' => false, 'error' => 'Access denied.'], 403);
            }

            $fields = [];
            $params = [];

            if (isset($input['name'])) { $fields[] = "`name` = ?"; $params[] = trim($input['name']); }
            if (isset($input['notes'])) { $fields[] = "`notes` = ?"; $params[] = $input['notes']; }
            if (isset($input['color'])) { $fields[] = "`color` = ?"; $params[] = $input['color']; }
            if (isset($input['icon'])) { $fields[] = "`icon` = ?"; $params[] = $input['icon']; }
            if (isset($input['groupId'])) { $fields[] = "`group_id` = ?"; $params[] = $input['groupId']; }
            if (isset($input['proxyId'])) { $fields[] = "`proxy_id` = ?"; $params[] = $input['proxyId']; }
            if (isset($input['tags'])) { $fields[] = "`tags` = ?"; $params[] = $input['tags']; }
            if (isset($input['status'])) { $fields[] = "`status` = ?"; $params[] = $input['status']; }
            if (isset($input['startUrl'])) { $fields[] = "`start_url` = ?"; $params[] = $input['startUrl']; }
            if (isset($input['fingerprint'])) { $fields[] = "`fingerprint` = ?"; $params[] = json_encode($input['fingerprint'], JSON_UNESCAPED_SLASHES); }

            if (empty($fields)) {
                respondJson(['success' => true, 'message' => 'No fields to update.']);
            }

            $fields[] = "`updated_at` = NOW()";
            $sql = "UPDATE profiles SET " . implode(', ', $fields) . " WHERE id = ?";
            $params[] = $id;

            $updateStmt = $db->prepare($sql);
            $updateStmt->execute($params);

            // Broadcast Real-Time SSE Event
            publishRealtimeEvent('profile.updated', [
                'profileId' => $id,
                'userId' => $existing['user_id'],
                'updatedAt' => date('c')
            ], $existing['user_id']);

            respondJson(['success' => true, 'message' => 'Profile updated successfully.']);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to update profile: ' . $e->getMessage()], 500);
        }
        break;

    // ── 4. Delete Profile ──
    case 'delete':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondJson(['success' => false, 'error' => 'POST method required.'], 405);
        }

        $id = $input['id'] ?? $_GET['id'] ?? '';
        if (empty($id)) {
            respondJson(['success' => false, 'error' => 'Profile ID required.'], 400);
        }

        try {
            $checkStmt = $db->prepare("SELECT user_id, name FROM profiles WHERE id = ?");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                respondJson(['success' => true, 'message' => 'Profile already deleted.']);
            }

            if (!$isAdmin && $existing['user_id'] !== $userId) {
                respondJson(['success' => false, 'error' => 'Access denied.'], 403);
            }

            $delStmt = $db->prepare("DELETE FROM profiles WHERE id = ?");
            $delStmt->execute([$id]);

            // Broadcast Real-Time SSE Event
            publishRealtimeEvent('profile.deleted', [
                'profileId' => $id,
                'userId' => $existing['user_id'],
                'timestamp' => date('c')
            ], $existing['user_id']);

            respondJson(['success' => true, 'message' => 'Profile deleted successfully.']);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to delete profile: ' . $e->getMessage()], 500);
        }
        break;

    // ── 5. Status Change (Running / Stopped) ──
    case 'status':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondJson(['success' => false, 'error' => 'POST method required.'], 405);
        }

        $id = $input['id'] ?? '';
        $newStatus = $input['status'] ?? 'stopped';

        try {
            $upd = $db->prepare("UPDATE profiles SET status = ?, updated_at = NOW() WHERE id = ?");
            $upd->execute([$newStatus, $id]);

            publishRealtimeEvent('profile.status.changed', [
                'profileId' => $id,
                'status' => $newStatus,
                'timestamp' => date('c')
            ], $userId);

            respondJson(['success' => true, 'status' => $newStatus]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    default:
        respondJson(['success' => false, 'error' => "Unknown action '{$action}'."], 400);
        break;
}
