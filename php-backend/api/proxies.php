<?php
// ──────────────────────────────────────────────
// AntiProfiles — Centralized Proxies REST API & Real-Time Sync
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
$userStmt = $db->prepare("SELECT id, name, email, role, account_status FROM users WHERE id = ?");
$userStmt->execute([$userId]);
$currentUser = $userStmt->fetch(PDO::FETCH_ASSOC);

if (!$currentUser || $currentUser['account_status'] === 'suspended' || $currentUser['account_status'] === 'disabled') {
    respondJson(['success' => false, 'error' => 'Account is suspended or disabled.'], 403);
}

$userRole = strtolower($currentUser['role'] ?? 'user');
$isAdmin = ($userRole === 'admin' || $userRole === 'super_admin');

switch ($action) {

    // ── 1. List Proxies ──
    case 'list':
    case 'get-all':
        try {
            $search = trim($_GET['search'] ?? '');
            $query = "SELECT id, user_id, name, type, host, port, username, country, region, city, isp, asn, timezone, latitude, longitude, public_ip, proxy_version, test_status, last_tested, updated_at, created_at FROM proxies WHERE 1=1";
            $params = [];

            if (!$isAdmin) {
                $query .= " AND user_id = ?";
                $params[] = $userId;
            }

            if (!empty($search)) {
                $query .= " AND (name LIKE ? OR host LIKE ? OR city LIKE ? OR region LIKE ? OR country LIKE ?)";
                $like = "%{$search}%";
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            $query .= " ORDER BY updated_at DESC";

            $stmt = $db->prepare($query);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            respondJson([
                'success' => true,
                'data' => $rows,
                'count' => count($rows)
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to fetch proxies: ' . $e->getMessage()], 500);
        }
        break;

    // ── 2. Get Single Proxy ──
    case 'get':
        try {
            $proxyId = trim($_GET['id'] ?? $input['id'] ?? '');
            if (empty($proxyId)) {
                respondJson(['success' => false, 'error' => 'Proxy ID required.'], 400);
            }

            $stmt = $db->prepare("SELECT id, user_id, name, type, host, port, username, country, region, city, isp, asn, timezone, latitude, longitude, public_ip, proxy_version, test_status, last_tested, updated_at, created_at FROM proxies WHERE id = ?");
            $stmt->execute([$proxyId]);
            $proxy = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$proxy) {
                respondJson(['success' => false, 'error' => 'Proxy not found.'], 404);
            }

            if (!$isAdmin && $proxy['user_id'] !== $userId) {
                respondJson(['success' => false, 'error' => 'Access denied.'], 403);
            }

            respondJson([
                'success' => true,
                'data' => $proxy
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to get proxy: ' . $e->getMessage()], 500);
        }
        break;

    // ── 3. Save / Create Proxy ──
    case 'save':
    case 'create':
    case 'update':
        try {
            $id = trim($input['id'] ?? '') ?: generateUuid();
            $name = trim($input['name'] ?? '') ?: 'Proxy ' . substr($id, 0, 6);
            $type = strtolower(trim($input['type'] ?? 'http'));
            $host = trim($input['host'] ?? '');
            $port = (int)($input['port'] ?? 80);
            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            $country = strtoupper(trim($input['country'] ?? ''));
            $region = trim($input['region'] ?? '');
            $city = trim($input['city'] ?? '');
            $isp = trim($input['isp'] ?? '');
            $asn = trim($input['asn'] ?? '');
            $timezone = trim($input['timezone'] ?? '');
            $latitude = isset($input['latitude']) && is_numeric($input['latitude']) ? (float)$input['latitude'] : null;
            $longitude = isset($input['longitude']) && is_numeric($input['longitude']) ? (float)$input['longitude'] : null;
            $publicIp = trim($input['public_ip'] ?? $input['publicIp'] ?? '') ?: $host;

            // Check existing
            $checkStmt = $db->prepare("SELECT id, user_id, proxy_version FROM proxies WHERE id = ?");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                if (!$isAdmin && $existing['user_id'] !== $userId) {
                    respondJson(['success' => false, 'error' => 'Access denied.'], 403);
                }

                $newVersion = (int)($existing['proxy_version'] ?? 1) + 1;
                $updateSql = "UPDATE proxies SET name = ?, type = ?, host = ?, port = ?, username = ?, country = ?, region = ?, city = ?, isp = ?, asn = ?, timezone = ?, latitude = ?, longitude = ?, public_ip = ?, proxy_version = ?, updated_at = NOW() WHERE id = ?";
                $updateParams = [$name, $type, $host, $port, $username, $country, $region, $city, $isp, $asn, $timezone, $latitude, $longitude, $publicIp, $newVersion, $id];

                if (!empty($password)) {
                    $updateSql = "UPDATE proxies SET name = ?, type = ?, host = ?, port = ?, username = ?, password = ?, country = ?, region = ?, city = ?, isp = ?, asn = ?, timezone = ?, latitude = ?, longitude = ?, public_ip = ?, proxy_version = ?, updated_at = NOW() WHERE id = ?";
                    $updateParams = [$name, $type, $host, $port, $username, $password, $country, $region, $city, $isp, $asn, $timezone, $latitude, $longitude, $publicIp, $newVersion, $id];
                }

                $stmt = $db->prepare($updateSql);
                $stmt->execute($updateParams);
            } else {
                $stmt = $db->prepare("
                    INSERT INTO proxies (id, user_id, name, type, host, port, username, password, country, region, city, isp, asn, timezone, latitude, longitude, public_ip, proxy_version, updated_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
                ");
                $stmt->execute([$id, $userId, $name, $type, $host, $port, $username, $password, $country, $region, $city, $isp, $asn, $timezone, $latitude, $longitude, $publicIp]);
            }

            // Fetch refreshed record
            $fetchStmt = $db->prepare("SELECT id, user_id, name, type, host, port, username, country, region, city, isp, asn, timezone, latitude, longitude, public_ip, proxy_version, updated_at, created_at FROM proxies WHERE id = ?");
            $fetchStmt->execute([$id]);
            $saved = $fetchStmt->fetch(PDO::FETCH_ASSOC);

            // Broadcast real-time proxy sync event across all connected desktop software instances
            try {
                $evStmt = $db->prepare("
                    INSERT INTO realtime_sync_events (event_id, event_type, target_user_id, payload)
                    VALUES (?, 'proxy.location.updated', ?, ?)
                ");
                $evStmt->execute([
                    'evt_' . uniqid(),
                    $userId,
                    json_encode([
                        'proxy_id' => $id,
                        'city' => $saved['city'] ?? '',
                        'region' => $saved['region'] ?? '',
                        'country' => $saved['country'] ?? '',
                        'timezone' => $saved['timezone'] ?? '',
                        'latitude' => $saved['latitude'] ?? null,
                        'longitude' => $saved['longitude'] ?? null,
                        'timestamp' => time()
                    ])
                ]);
            } catch (Throwable $e) {}

            respondJson([
                'success' => true,
                'message' => 'Proxy saved successfully.',
                'data' => $saved
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to save proxy: ' . $e->getMessage()], 500);
        }
        break;

    // ── 4. Fast Update Proxy Location (Admin or User) ──
    case 'update-location':
        try {
            $id = trim($_GET['id'] ?? $input['id'] ?? '');
            if (empty($id)) {
                respondJson(['success' => false, 'error' => 'Proxy ID required.'], 400);
            }

            $checkStmt = $db->prepare("SELECT id, user_id, proxy_version FROM proxies WHERE id = ?");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                respondJson(['success' => false, 'error' => 'Proxy not found.'], 404);
            }

            if (!$isAdmin && $existing['user_id'] !== $userId) {
                respondJson(['success' => false, 'error' => 'Access denied.'], 403);
            }

            $country = isset($input['country']) ? strtoupper(trim($input['country'])) : null;
            $region = isset($input['region']) ? trim($input['region']) : null;
            $city = isset($input['city']) ? trim($input['city']) : null;
            $isp = isset($input['isp']) ? trim($input['isp']) : null;
            $timezone = isset($input['timezone']) ? trim($input['timezone']) : null;
            $latitude = isset($input['latitude']) && is_numeric($input['latitude']) ? (float)$input['latitude'] : null;
            $longitude = isset($input['longitude']) && is_numeric($input['longitude']) ? (float)$input['longitude'] : null;

            $sets = ["proxy_version = COALESCE(proxy_version, 1) + 1", "updated_at = NOW()"];
            $params = [];

            if ($country !== null) { $sets[] = "country = ?"; $params[] = $country; }
            if ($region !== null) { $sets[] = "region = ?"; $params[] = $region; }
            if ($city !== null) { $sets[] = "city = ?"; $params[] = $city; }
            if ($isp !== null) { $sets[] = "isp = ?"; $params[] = $isp; }
            if ($timezone !== null) { $sets[] = "timezone = ?"; $params[] = $timezone; }
            if ($latitude !== null) { $sets[] = "latitude = ?"; $params[] = $latitude; }
            if ($longitude !== null) { $sets[] = "longitude = ?"; $params[] = $longitude; }

            $params[] = $id;
            $sql = "UPDATE proxies SET " . implode(", ", $sets) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            // Fetch refreshed proxy
            $fetchStmt = $db->prepare("SELECT id, user_id, name, type, host, port, username, country, region, city, isp, asn, timezone, latitude, longitude, public_ip, proxy_version, updated_at FROM proxies WHERE id = ?");
            $fetchStmt->execute([$id]);
            $updated = $fetchStmt->fetch(PDO::FETCH_ASSOC);

            // Broadcast real-time proxy sync event across all connected desktop software instances
            try {
                $evStmt = $db->prepare("
                    INSERT INTO realtime_sync_events (event_id, event_type, target_user_id, payload)
                    VALUES (?, 'proxy.location.updated', ?, ?)
                ");
                $evStmt->execute([
                    'evt_' . uniqid(),
                    $userId,
                    json_encode([
                        'proxy_id' => $id,
                        'city' => $updated['city'] ?? '',
                        'region' => $updated['region'] ?? '',
                        'country' => $updated['country'] ?? '',
                        'timezone' => $updated['timezone'] ?? '',
                        'latitude' => $updated['latitude'] ?? null,
                        'longitude' => $updated['longitude'] ?? null,
                        'timestamp' => time()
                    ])
                ]);
            } catch (Throwable $e) {}

            respondJson([
                'success' => true,
                'message' => 'Proxy location updated successfully.',
                'data' => $updated
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to update proxy location: ' . $e->getMessage()], 500);
        }
        break;

    // ── 5. Delete Proxy ──
    case 'delete':
        try {
            $id = trim($_GET['id'] ?? $input['id'] ?? '');
            if (empty($id)) {
                respondJson(['success' => false, 'error' => 'Proxy ID required.'], 400);
            }

            $checkStmt = $db->prepare("SELECT id, user_id FROM proxies WHERE id = ?");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                if (!$isAdmin && $existing['user_id'] !== $userId) {
                    respondJson(['success' => false, 'error' => 'Access denied.'], 403);
                }
                $delStmt = $db->prepare("DELETE FROM proxies WHERE id = ?");
                $delStmt->execute([$id]);
            }

            respondJson(['success' => true, 'message' => 'Proxy deleted successfully.']);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to delete proxy: ' . $e->getMessage()], 500);
        }
        break;

    // ── 6. Sync Check (Lightweight timestamp & version map) ──
    case 'sync-check':
        try {
            $query = "SELECT id, proxy_version, updated_at FROM proxies";
            $params = [];
            if (!$isAdmin) {
                $query .= " WHERE user_id = ?";
                $params[] = $userId;
            }
            $stmt = $db->prepare($query);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            respondJson(['success' => true, 'data' => $rows]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Sync check failed: ' . $e->getMessage()], 500);
        }
        break;

    default:
        respondJson(['success' => false, 'error' => 'Unknown action: ' . htmlspecialchars($action)], 400);
        break;
}
