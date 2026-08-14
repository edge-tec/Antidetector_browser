<?php
// ──────────────────────────────────────────────
// ProfileVault — Central Admin Management API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

// Require Admin authorization
$adminUser = requireAdmin();
$db = Database::getConnection();
$action = $_GET['action'] ?? '';

switch ($action) {

    // ── 1. User Management APIs ──
    case 'get-users':
        $query = trim($_GET['search'] ?? '');
        $role = trim($_GET['role'] ?? '');
        $status = trim($_GET['status'] ?? '');

        $sql = "SELECT id, name, email, role, email_verified, account_status, created_at, last_login_at FROM users WHERE 1=1";
        $params = [];

        if ($query) {
            $sql .= " AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)";
            $params[] = '%' . strtolower($query) . '%';
            $params[] = '%' . strtolower($query) . '%';
        }
        if ($role) {
            $sql .= " AND role = ?";
            $params[] = $role;
        }
        if ($status) {
            $sql .= " AND account_status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll();

        foreach ($users as &$u) {
            $u['emailVerified'] = (bool)$u['email_verified'];
            $u['accountStatus'] = $u['account_status'];
            $u['hasPassword'] = true;
            $u['createdAt'] = $u['created_at'];
            $u['lastLoginAt'] = $u['last_login_at'];
            $u['profileCount'] = 0;
        }

        respondJson(['success' => true, 'data' => $users]);
        break;

    case 'create-user':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $name = trim($input['name'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $role = $input['role'] ?? 'user';

        if (!$name || !$email || !$password) {
            respondJson(['success' => false, 'error' => 'Name, email, and password are required.'], 400);
        }

        $userId = 'usr_' . bin2hex(random_bytes(8));
        $hash = hashUserPassword($password);

        $stmt = $db->prepare("
            INSERT INTO users (id, name, email, password_hash, role, email_verified, account_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $stmt->execute([$userId, $name, strtolower($email), $hash, $role]);

        // Create default subscription
        $subId = 'sub_' . $userId;
        $planId = $role === 'admin' ? 'plan_pro' : 'plan_starter';
        $subStmt = $db->prepare("
            INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days)
            VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 YEAR), 3)
        ");
        $subStmt->execute([$subId, $userId, $planId]);

        respondJson(['success' => true, 'data' => ['id' => $userId, 'name' => $name, 'email' => $email, 'role' => $role]]);
        break;

    case 'update-user-status':
    case 'update-user':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $_GET['id'] ?? $input['userId'] ?? $input['id'] ?? null;
        
        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID is required.'], 400);
        }

        $sets = [];
        $params = [];

        if (isset($input['name'])) { $sets[] = "name = ?"; $params[] = trim($input['name']); }
        if (isset($input['email'])) { $sets[] = "email = ?"; $params[] = strtolower(trim($input['email'])); }
        if (isset($input['role'])) { $sets[] = "role = ?"; $params[] = $input['role']; }
        if (isset($input['accountStatus']) || isset($input['account_status'])) {
            $sets[] = "account_status = ?";
            $params[] = $input['accountStatus'] ?? $input['account_status'];
        }
        if (isset($input['password']) && strlen($input['password']) >= 6) {
            $sets[] = "password_hash = ?";
            $params[] = hashUserPassword($input['password']);
        }

        if (empty($sets)) {
            respondJson(['success' => false, 'error' => 'No update parameters specified.'], 400);
        }

        $params[] = $userId;
        $updStmt = $db->prepare("UPDATE users SET " . implode(', ', $sets) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $updStmt->execute($params);

        respondJson(['success' => true]);
        break;

    case 'delete-user':
        $userId = $_GET['id'] ?? null;
        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID required.'], 400);
        }

        $delStmt = $db->prepare("DELETE FROM users WHERE id = ?");
        $delStmt->execute([$userId]);
        respondJson(['success' => true]);
        break;

    // ── 2. Subscriptions Management APIs ──
    case 'get-subscriptions':
        $stmt = $db->prepare("
            SELECT u.id as user_id, u.name, u.email, u.role, u.account_status,
                   s.id as sub_id, s.plan_id, s.status as sub_status, s.starts_at, s.expires_at, s.grace_period_days,
                   p.name as plan_name, p.monthly_price, p.yearly_price
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            LEFT JOIN pricing_plans p ON s.plan_id = p.id
            ORDER BY u.created_at DESC
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $data = [];
        foreach ($rows as $r) {
            // Count active devices for user
            $devStmt = $db->prepare("SELECT * FROM desktop_installations WHERE user_id = ? AND revoked_at IS NULL");
            $devStmt->execute([$r['user_id']]);
            $devices = $devStmt->fetchAll();

            $data[] = [
                'user' => [
                    'id' => $r['user_id'],
                    'name' => $r['name'],
                    'email' => $r['email'],
                    'role' => $r['role'],
                    'account_status' => $r['account_status']
                ],
                'subscription' => [
                    'id' => $r['sub_id'] ?: ('sub_' . $r['user_id']),
                    'user_id' => $r['user_id'],
                    'plan_id' => $r['plan_id'] ?: 'plan_starter',
                    'status' => $r['sub_status'] ?: 'active',
                    'starts_at' => $r['starts_at'] ?: date('Y-m-d H:i:s'),
                    'expires_at' => $r['expires_at'] ?: date('Y-m-d H:i:s', strtotime('+1 year')),
                    'grace_period_days' => (int)($r['grace_period_days'] ?? 3),
                    'plan' => [
                        'id' => $r['plan_id'] ?: 'plan_starter',
                        'name' => $r['plan_name'] ?: 'Starter',
                        'monthly_price' => (float)($r['monthly_price'] ?? 19),
                        'yearly_price' => (float)($r['yearly_price'] ?? 15)
                    ]
                ],
                'devices' => $devices
            ];
        }

        respondJson(['success' => true, 'data' => $data]);
        break;

    case 'update-subscription':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $input['userId'] ?? $input['user_id'] ?? $_GET['userId'] ?? null;

        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID is required.'], 400);
        }

        $planId = $input['plan_id'] ?? null;
        $status = $input['status'] ?? null;
        $expiresAt = $input['expires_at'] ?? null;
        $graceDays = isset($input['grace_period_days']) ? (int)$input['grace_period_days'] : null;

        $checkSub = $db->prepare("SELECT id FROM subscriptions WHERE user_id = ?");
        $checkSub->execute([$userId]);
        $sub = $checkSub->fetch();

        if (!$sub) {
            $subId = 'sub_' . $userId;
            $insSub = $db->prepare("
                INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            ");
            $insSub->execute([
                $subId,
                $userId,
                $planId ?: 'plan_starter',
                $status ?: 'active',
                $expiresAt ?: date('Y-m-d H:i:s', strtotime('+1 year')),
                $graceDays ?? 3
            ]);
        } else {
            $updSub = $db->prepare("
                UPDATE subscriptions SET
                    plan_id = COALESCE(?, plan_id),
                    status = COALESCE(?, status),
                    expires_at = COALESCE(?, expires_at),
                    grace_period_days = COALESCE(?, grace_period_days),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ");
            $updSub->execute([$planId, $status, $expiresAt, $graceDays, $userId]);
        }

        respondJson(['success' => true]);
        break;

    // ── 3. Application Downloads Management APIs ──
    case 'get-desktop-config':
        $config = getDesktopAppConfigMap();
        respondJson(['success' => true, 'data' => $config]);
        break;

    case 'save-desktop-config':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $stmt = $db->prepare("REPLACE INTO desktop_app_config (config_key, config_value) VALUES (?, ?)");

        foreach ($input as $k => $v) {
            $stmt->execute([$k, (string)$v]);
        }

        $config = getDesktopAppConfigMap();
        respondJson(['success' => true, 'data' => $config]);
        break;

    // ── 4. Landing Page CMS Management APIs ──
    case 'save-branding':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $stmt = $db->prepare("REPLACE INTO landing_branding (config_key, config_value) VALUES (?, ?)");
        foreach ($input as $k => $v) {
            $stmt->execute([$k, (string)$v]);
        }
        respondJson(['success' => true]);
        break;

    case 'save-hero':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $stmt = $db->prepare("
            UPDATE landing_hero SET
                headline = ?,
                subheadline = ?,
                cta_primary_text = ?,
                cta_primary_url = ?,
                cta_secondary_text = ?,
                cta_secondary_url = ?,
                trust_text = ?
            WHERE id = 1
        ");
        $stmt->execute([
            $input['headline'] ?? '',
            $input['subheadline'] ?? '',
            $input['cta_primary_text'] ?? '',
            $input['cta_primary_url'] ?? '',
            $input['cta_secondary_text'] ?? '',
            $input['cta_secondary_url'] ?? '',
            $input['trust_text'] ?? ''
        ]);
        respondJson(['success' => true]);
        break;

    case 'save-plan':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $planId = $input['id'] ?? ('plan_' . bin2hex(random_bytes(4)));

        $stmt = $db->prepare("
            REPLACE INTO pricing_plans (id, name, slug, description, monthly_price, yearly_price, profile_limit, team_limit, api_limit, badge, button_text, button_url, is_popular, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $planId,
            $input['name'] ?? 'Plan',
            $input['slug'] ?? strtolower($input['name'] ?? 'plan'),
            $input['description'] ?? '',
            (float)($input['monthly_price'] ?? 0),
            (float)($input['yearly_price'] ?? 0),
            (int)($input['profile_limit'] ?? 25),
            (int)($input['team_limit'] ?? 2),
            $input['api_limit'] ?? 'Basic',
            $input['badge'] ?? '',
            $input['button_text'] ?? 'Get Started',
            $input['button_url'] ?? '#register',
            (int)($input['is_popular'] ?? 0),
            (int)($input['is_active'] ?? 1),
            (int)($input['sort_order'] ?? 0)
        ]);

        respondJson(['success' => true]);
        break;

    default:
        respondJson(['success' => false, 'error' => 'Invalid admin action.'], 404);
}
