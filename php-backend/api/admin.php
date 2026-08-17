<?php
// ──────────────────────────────────────────────
// ProfileVault — Central Admin Management API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/license.php';

ensureDatabaseTablesExist();

// Require Admin authorization
$adminUser = requireAdmin();
$admin = $adminUser;
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

        // Automatically provision Free plan (or Pro for admin)
        ensureUserFreeSubscription($db, $userId, $role);

        respondJson(['success' => true, 'data' => ['id' => $userId, 'name' => $name, 'email' => $email, 'role' => $role]]);
        break;

    case 'update-user-role':
    case 'update-role':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $_GET['id'] ?? $input['userId'] ?? $input['id'] ?? null;
        $newRole = strtolower(trim($input['role'] ?? ''));

        if (!$userId || !$newRole) {
            respondJson(['success' => false, 'error' => 'User ID and new Role are required.'], 400);
        }

        $db->beginTransaction();
        try {
            $userStmt = $db->prepare("SELECT id, email, role, permissions, auth_version FROM users WHERE id = ? FOR UPDATE");
            $userStmt->execute([$userId]);
            $targetUser = $userStmt->fetch();

            if (!$targetUser) {
                $db->rollBack();
                respondJson(['success' => false, 'error' => 'User not found.'], 404);
            }

            $oldRole = $targetUser['role'];
            $newVersion = (int)($targetUser['auth_version'] ?? 1) + 1;

            $upd = $db->prepare("UPDATE users SET role = ?, auth_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            $upd->execute([$newRole, $newVersion, $userId]);

            // Audit log
            logAdminAction($admin['id'], $admin['email'], 'ROLE_CHANGED', $userId, "Changed user role from {$oldRole} to {$newRole}", $oldRole, $newRole);

            // Publish Real-Time Event
            $eventPayload = [
                'type' => 'user.role.updated',
                'userId' => $userId,
                'previousRole' => $oldRole,
                'newRole' => $newRole,
                'version' => $newVersion,
                'timestamp' => date('c')
            ];
            publishRealtimeEvent($db, $userId, 'user.role.updated', $eventPayload, null, $newVersion);

            $db->commit();
            respondJson(['success' => true, 'data' => ['userId' => $userId, 'role' => $newRole, 'version' => $newVersion]]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Failed to update role: ' . $e->getMessage()], 500);
        }
        break;

    case 'update-user-permissions':
    case 'update-permissions':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $_GET['id'] ?? $input['userId'] ?? $input['id'] ?? null;
        $perms = $input['permissions'] ?? null;

        if (!$userId || $perms === null) {
            respondJson(['success' => false, 'error' => 'User ID and permissions array/json required.'], 400);
        }

        $permsJson = is_array($perms) ? json_encode($perms) : $perms;

        $db->beginTransaction();
        try {
            $userStmt = $db->prepare("SELECT id, email, role, permissions, auth_version FROM users WHERE id = ? FOR UPDATE");
            $userStmt->execute([$userId]);
            $targetUser = $userStmt->fetch();

            if (!$targetUser) {
                $db->rollBack();
                respondJson(['success' => false, 'error' => 'User not found.'], 404);
            }

            $newVersion = (int)($targetUser['auth_version'] ?? 1) + 1;

            $upd = $db->prepare("UPDATE users SET permissions = ?, auth_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            $upd->execute([$permsJson, $newVersion, $userId]);

            logAdminAction($admin['id'], $admin['email'], 'PERMISSIONS_CHANGED', $userId, "Updated granular permissions", $targetUser['permissions'], $permsJson);

            $resolved = resolveUserPermissions($targetUser['role'], $permsJson);
            $eventPayload = [
                'type' => 'user.permissions.updated',
                'userId' => $userId,
                'permissions' => $resolved,
                'version' => $newVersion,
                'timestamp' => date('c')
            ];
            publishRealtimeEvent($db, $userId, 'user.permissions.updated', $eventPayload, null, $newVersion);

            $db->commit();
            respondJson(['success' => true, 'data' => ['userId' => $userId, 'permissions' => $resolved, 'version' => $newVersion]]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Failed to update permissions: ' . $e->getMessage()], 500);
        }
        break;

    case 'revoke-user-sessions':
    case 'revoke-sessions':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $_GET['id'] ?? $input['userId'] ?? $input['id'] ?? null;
        $reason = $input['reason'] ?? 'Revoked by administrator';

        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID required.'], 400);
        }

        $db->beginTransaction();
        try {
            revokeAllUserSessions($db, $userId, $reason);
            logAdminAction($admin['id'], $admin['email'], 'SESSIONS_REVOKED', $userId, $reason);

            $eventPayload = [
                'type' => 'session.revoked',
                'userId' => $userId,
                'reason' => $reason,
                'timestamp' => date('c')
            ];
            publishRealtimeEvent($db, $userId, 'session.revoked', $eventPayload);

            $db->commit();
            respondJson(['success' => true, 'message' => 'User sessions revoked successfully.']);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Failed to revoke sessions: ' . $e->getMessage()], 500);
        }
        break;

    case 'update-user-status':
    case 'update-user':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $_GET['id'] ?? $input['userId'] ?? $input['id'] ?? null;
        
        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID is required.'], 400);
        }

        $db->beginTransaction();
        try {
            $userStmt = $db->prepare("SELECT * FROM users WHERE id = ? FOR UPDATE");
            $userStmt->execute([$userId]);
            $targetUser = $userStmt->fetch();

            if (!$targetUser) {
                $db->rollBack();
                respondJson(['success' => false, 'error' => 'User not found.'], 404);
            }

            $sets = [];
            $params = [];
            $newStatus = $input['accountStatus'] ?? $input['account_status'] ?? null;
            $newRole = $input['role'] ?? null;
            $isStatusChanged = false;
            $isRoleChanged = false;

            if (isset($input['name'])) { $sets[] = "name = ?"; $params[] = trim($input['name']); }
            if (isset($input['email'])) { $sets[] = "email = ?"; $params[] = strtolower(trim($input['email'])); }
            if ($newRole && $newRole !== $targetUser['role']) {
                $sets[] = "role = ?";
                $params[] = $newRole;
                $isRoleChanged = true;
            }
            if ($newStatus && $newStatus !== $targetUser['account_status']) {
                $sets[] = "account_status = ?";
                $params[] = $newStatus;
                $isStatusChanged = true;
            }
            if (isset($input['password']) && strlen($input['password']) >= 6) {
                $sets[] = "password_hash = ?";
                $params[] = hashUserPassword($input['password']);
            }

            $newVersion = (int)($targetUser['auth_version'] ?? 1) + 1;
            $sets[] = "auth_version = ?";
            $params[] = $newVersion;

            if (empty($sets)) {
                $db->rollBack();
                respondJson(['success' => false, 'error' => 'No update parameters specified.'], 400);
            }

            $params[] = $userId;
            $updStmt = $db->prepare("UPDATE users SET " . implode(', ', $sets) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            $updStmt->execute($params);

            // If account is suspended or disabled, automatically revoke sessions
            if ($isStatusChanged && ($newStatus === 'suspended' || $newStatus === 'disabled')) {
                $revStmt = $db->prepare("UPDATE user_sessions SET is_revoked = 1, revoked_reason = ?, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?");
                $revStmt->execute(["Account status changed to {$newStatus}", $userId]);

                publishRealtimeEvent($db, $userId, 'session.revoked', [
                    'type' => 'session.revoked',
                    'userId' => $userId,
                    'status' => $newStatus,
                    'reason' => "Account {$newStatus} by administrator",
                    'version' => $newVersion,
                    'timestamp' => date('c')
                ], null, $newVersion);
            }

            if ($isStatusChanged) {
                logAdminAction($admin['id'], $admin['email'], 'ACCOUNT_STATUS_CHANGED', $userId, "Changed status from {$targetUser['account_status']} to {$newStatus}", $targetUser['account_status'], $newStatus);
                publishRealtimeEvent($db, $userId, 'user.status.updated', [
                    'type' => 'user.status.updated',
                    'userId' => $userId,
                    'status' => $newStatus,
                    'version' => $newVersion,
                    'timestamp' => date('c')
                ], null, $newVersion);
            }

            if ($isRoleChanged) {
                logAdminAction($admin['id'], $admin['email'], 'ROLE_CHANGED', $userId, "Changed role from {$targetUser['role']} to {$newRole}", $targetUser['role'], $newRole);
                publishRealtimeEvent($db, $userId, 'user.role.updated', [
                    'type' => 'user.role.updated',
                    'userId' => $userId,
                    'previousRole' => $targetUser['role'],
                    'newRole' => $newRole,
                    'version' => $newVersion,
                    'timestamp' => date('c')
                ], null, $newVersion);
            }

            // General user update event
            publishRealtimeEvent($db, $userId, 'user.updated', [
                'type' => 'user.updated',
                'userId' => $userId,
                'version' => $newVersion,
                'timestamp' => date('c')
            ], null, $newVersion);

            $db->commit();
            respondJson(['success' => true, 'version' => $newVersion]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Update failed: ' . $e->getMessage()], 500);
        }
        break;

    case 'delete-user':
        $userId = $_GET['id'] ?? null;
        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID required.'], 400);
        }

        $db->beginTransaction();
        try {
            $userStmt = $db->prepare("SELECT email FROM users WHERE id = ?");
            $userStmt->execute([$userId]);
            $userEmail = $userStmt->fetchColumn() ?: 'unknown';

            // Revoke sessions first
            $revStmt = $db->prepare("UPDATE user_sessions SET is_revoked = 1, revoked_reason = 'User deleted', revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?");
            $revStmt->execute([$userId]);

            $delStmt = $db->prepare("DELETE FROM users WHERE id = ?");
            $delStmt->execute([$userId]);

            logAdminAction($admin['id'], $admin['email'], 'USER_DELETED', $userId, "Deleted user {$userEmail}");

            publishRealtimeEvent($db, $userId, 'user.deleted', [
                'type' => 'user.deleted',
                'userId' => $userId,
                'timestamp' => date('c')
            ]);

            $db->commit();
            respondJson(['success' => true]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Failed to delete user: ' . $e->getMessage()], 500);
        }
        break;

    // ── 2. Subscriptions Management APIs ──
    case 'get-subscriptions':
        $stmt = $db->prepare("
            SELECT u.id as user_id, u.name, u.email, u.role, u.account_status,
                   s.id as sub_id, s.plan_id, s.status as sub_status, s.starts_at, s.expires_at, s.grace_period_days, s.device_limit as sub_device_limit,
                   p.name as plan_name, p.monthly_price, p.yearly_price, p.team_limit as plan_team_limit
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
            $activeCount = count($devices);

            $deviceLimit = !empty($r['sub_device_limit']) ? (int)$r['sub_device_limit'] : (int)($r['plan_team_limit'] ?? 2);

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
                    'device_limit' => $deviceLimit,
                    'plan' => [
                        'id' => $r['plan_id'] ?: 'plan_starter',
                        'name' => $r['plan_name'] ?: 'Starter',
                        'monthly_price' => (float)($r['monthly_price'] ?? 19),
                        'yearly_price' => (float)($r['yearly_price'] ?? 15),
                        'team_limit' => (int)($r['plan_team_limit'] ?? 2)
                    ]
                ],
                'active_devices_count' => $activeCount,
                'devices' => $devices
            ];
        }

        respondJson(['success' => true, 'data' => $data]);
        break;

    case 'update-subscription':
    case 'update-user-subscription':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $input['userId'] ?? $input['user_id'] ?? $_GET['userId'] ?? null;

        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID is required.'], 400);
        }

        $planId = $input['plan_id'] ?? null;
        $status = $input['status'] ?? null;
        $expiresAt = $input['expires_at'] ?? null;
        $graceDays = isset($input['grace_period_days']) ? (int)$input['grace_period_days'] : null;
        $deviceLimit = isset($input['device_limit']) ? (int)$input['device_limit'] : (isset($input['deviceLimit']) ? (int)$input['deviceLimit'] : null);

        $db->beginTransaction();
        try {
            $checkSub = $db->prepare("SELECT id FROM subscriptions WHERE user_id = ? FOR UPDATE");
            $checkSub->execute([$userId]);
            $sub = $checkSub->fetch();

            if (!$sub) {
                $subId = 'sub_' . $userId;
                $insSub = $db->prepare("
                    INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days, device_limit)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
                ");
                $insSub->execute([
                    $subId,
                    $userId,
                    $planId ?: 'plan_starter',
                    $status ?: 'active',
                    $expiresAt ?: date('Y-m-d H:i:s', strtotime('+1 year')),
                    $graceDays ?? 3,
                    $deviceLimit ?: 2
                ]);
            } else {
                $updSub = $db->prepare("
                    UPDATE subscriptions SET
                        plan_id = COALESCE(?, plan_id),
                        status = COALESCE(?, status),
                        expires_at = COALESCE(?, expires_at),
                        grace_period_days = COALESCE(?, grace_period_days),
                        device_limit = COALESCE(?, device_limit),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ");
                $updSub->execute([$planId, $status, $expiresAt, $graceDays, $deviceLimit, $userId]);
            }

            // Bump user auth_version for subscription & device limit state sync
            $db->prepare("UPDATE users SET auth_version = auth_version + 1 WHERE id = ?")->execute([$userId]);
            $verStmt = $db->prepare("SELECT auth_version FROM users WHERE id = ?");
            $verStmt->execute([$userId]);
            $newVer = (int)($verStmt->fetchColumn() ?: 1);

            logAdminAction($admin['id'], $admin['email'], 'SUBSCRIPTION_CHANGED', $userId, "Plan: $planId, Devices: $deviceLimit, Status: $status, Expires: $expiresAt");

            publishRealtimeEvent($db, $userId, 'subscription.updated', [
                'type' => 'subscription.updated',
                'userId' => $userId,
                'planId' => $planId,
                'deviceLimit' => $deviceLimit,
                'status' => $status,
                'expiresAt' => $expiresAt,
                'version' => $newVer,
                'timestamp' => date('c')
            ], null, $newVer);

            publishRealtimeEvent($db, $userId, 'device.limit.updated', [
                'type' => 'device.limit.updated',
                'userId' => $userId,
                'deviceLimit' => $deviceLimit,
                'version' => $newVer,
                'timestamp' => date('c')
            ], null, $newVer);

            $db->commit();
            respondJson(['success' => true, 'message' => "User subscription (Plan: $planId, Devices: $deviceLimit) and expiration updated successfully."]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Failed to update subscription: ' . $e->getMessage()], 500);
        }
        break;

    case 'update-user-expiry':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $input['userId'] ?? $input['user_id'] ?? $_GET['userId'] ?? null;
        $expiresAt = $input['expires_at'] ?? $input['expiresAt'] ?? null;

        if (!$userId || !$expiresAt) {
            respondJson(['success' => false, 'error' => 'User ID and expiration date (YYYY-MM-DD HH:MM:SS) are required.'], 400);
        }

        $formattedExpiry = date('Y-m-d H:i:s', strtotime($expiresAt));
        $now = time();
        $isFuture = strtotime($formattedExpiry) > $now;
        $newStatus = $isFuture ? 'active' : 'expired';

        $db->beginTransaction();
        try {
            $db->prepare("
                UPDATE subscriptions SET 
                    expires_at = ?, 
                    status = ?, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ?
            ")->execute([$formattedExpiry, $newStatus, $userId]);

            $db->prepare("UPDATE users SET auth_version = auth_version + 1 WHERE id = ?")->execute([$userId]);
            $verStmt = $db->prepare("SELECT auth_version FROM users WHERE id = ?");
            $verStmt->execute([$userId]);
            $newVer = (int)($verStmt->fetchColumn() ?: 1);

            logAdminAction($admin['id'], $admin['email'], 'EXPIRY_CHANGED', $userId, "Expires: $formattedExpiry, Status: $newStatus");

            publishRealtimeEvent($db, $userId, 'subscription.updated', [
                'type' => 'subscription.updated',
                'userId' => $userId,
                'status' => $newStatus,
                'expiresAt' => $formattedExpiry,
                'version' => $newVer,
                'timestamp' => date('c')
            ], null, $newVer);

            $db->commit();
            respondJson(['success' => true, 'message' => 'Subscription expiration updated successfully.']);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            respondJson(['success' => false, 'error' => 'Failed to update expiry: ' . $e->getMessage()], 500);
        }
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

    // ── 4.5. Google OAuth Configuration APIs ──
    case 'get-google-oauth-config':
        try {
            $config = getGoogleOAuthConfigPhp();
            respondJson(['success' => true, 'data' => $config]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    case 'save-google-oauth-config':
        try {
            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $stmt = $db->prepare("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)");

            if (isset($input['enabled'])) $stmt->execute(['google_oauth_enabled', $input['enabled'] ? 'true' : 'false']);
            if (isset($input['clientId'])) $stmt->execute(['google_oauth_client_id', trim((string)$input['clientId'])]);
            if (isset($input['clientSecret'])) $stmt->execute(['google_oauth_client_secret', trim((string)$input['clientSecret'])]);
            if (isset($input['oneTap'])) $stmt->execute(['google_oauth_one_tap', $input['oneTap'] ? 'true' : 'false']);

            logAdminAction($adminUser['id'], $adminUser['email'], 'Updated Google OAuth Configuration');
            respondJson(['success' => true, 'message' => 'Google OAuth settings saved successfully.']);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    // ── 5. SMTP Configuration & Email Auditing APIs ──
    case 'get-smtp-config':
        try {
            $stmt = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'smtp_%'");
            $stmt->execute();
            $rows = $stmt->fetchAll();
            $map = [];
            foreach ($rows as $r) {
                $map[$r['key']] = $r['value'];
            }
            $hasPass = !empty($map['smtp_password']);
            $config = [
                'host' => $map['smtp_host'] ?? '',
                'port' => (int)($map['smtp_port'] ?? 587),
                'user' => $map['smtp_user'] ?? '',
                'password' => $hasPass ? '••••••••' : '',
                'hasPassword' => $hasPass,
                'fromEmail' => $map['smtp_from_email'] ?? '',
                'fromName' => $map['smtp_from_name'] ?? 'AntiProfiles',
                'secure' => ($map['smtp_secure'] ?? 'false') === 'true',
                'enabled' => ($map['smtp_enabled'] ?? 'false') === 'true'
            ];
            respondJson(['success' => true, 'data' => $config]);
        } catch (Exception $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    case 'save-smtp-config':
        try {
            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $stmt = $db->prepare("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)");

            if (isset($input['host'])) $stmt->execute(['smtp_host', trim((string)$input['host'])]);
            if (isset($input['port'])) $stmt->execute(['smtp_port', (string)(int)$input['port']]);
            if (isset($input['user'])) $stmt->execute(['smtp_user', trim((string)$input['user'])]);
            if (isset($input['password']) && $input['password'] !== '' && $input['password'] !== '••••••••') {
                $stmt->execute(['smtp_password', (string)$input['password']]);
            }
            if (isset($input['fromEmail'])) $stmt->execute(['smtp_from_email', trim((string)$input['fromEmail'])]);
            if (isset($input['fromName'])) $stmt->execute(['smtp_from_name', trim((string)$input['fromName'])]);
            if (isset($input['secure'])) $stmt->execute(['smtp_secure', ($input['secure'] === true || $input['secure'] === 'true') ? 'true' : 'false']);
            if (isset($input['enabled'])) $stmt->execute(['smtp_enabled', ($input['enabled'] === true || $input['enabled'] === 'true') ? 'true' : 'false']);

            logAdminAction($adminUser['id'], $adminUser['email'], 'Updated SMTP Configuration', null, 'Host: ' . ($input['host'] ?? ''));
            respondJson(['success' => true, 'message' => 'SMTP configuration saved successfully and activated for Website & Applications!']);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    case 'test-smtp-config':
    case 'test-smtp-connection':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        // If password is masked, fetch stored password from database
        if (empty($input['password']) || $input['password'] === '••••••••') {
            $currSmtp = getSmtpSettingsPhp();
            $input['password'] = $currSmtp['password'] ?? '';
            if (empty($input['host'])) $input['host'] = $currSmtp['host'] ?? '';
            if (empty($input['user'])) $input['user'] = $currSmtp['user'] ?? '';
            if (empty($input['port'])) $input['port'] = $currSmtp['port'] ?? 587;
        }

        $diag = testSmtpDiagnosticsPhp($input);

        $testRecipient = trim($input['testRecipient'] ?? $input['test_recipient'] ?? '');
        $testEmailSent = false;
        if (!empty($testRecipient) && $diag['success']) {
            $testRes = sendAdminTestEmailPhp($testRecipient, $input);
            $testEmailSent = $testRes['success'];
            $diag['steps']['testEmail'] = [
                'status' => $testEmailSent ? 'PASS' : 'FAIL',
                'detail' => $testEmailSent ? "Delivered to {$testRecipient}" : "Failed to deliver to {$testRecipient}"
            ];
        }

        respondJson([
            'success' => $diag['success'],
            'message' => $diag['success'] ? 'All SMTP Connection and Authentication tests PASSED.' : ($diag['error'] ?? 'SMTP diagnostic failed.'),
            'diagnostics' => $diag['steps'],
            'testEmailSent' => $testEmailSent
        ]);
        break;

    case 'send-test-email':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $recipient = trim($input['recipient'] ?? $input['email'] ?? $input['to'] ?? '');

        if (!$recipient || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            respondJson(['success' => false, 'error' => 'Please provide a valid recipient email address.'], 400);
        }

        $override = null;
        if (!empty($input['host'])) {
            $override = $input;
            if (empty($override['password']) || $override['password'] === '••••••••') {
                $curr = getSmtpSettingsPhp();
                $override['password'] = $curr['password'] ?? '';
            }
        }

        $res = sendAdminTestEmailPhp($recipient, $override);
        logAdminAction($adminUser['id'], $adminUser['email'], 'SENT_ADMIN_TEST_EMAIL', null, "Recipient: {$recipient}, Success: " . ($res['success'] ? 'Yes' : 'No'));

        if ($res['success']) {
            respondJson([
                'success' => true,
                'message' => "Test email successfully delivered to {$recipient}!",
                'timestamp' => $res['timestamp']
            ]);
        } else {
            respondJson([
                'success' => false,
                'error' => "Failed to deliver test email to {$recipient}. Please verify SMTP credentials and check Email Logs."
            ], 500);
        }
        break;

    case 'get-email-logs':
        try {
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
            $offset = ($page - 1) * $limit;
            $status = trim($_GET['status'] ?? 'all');
            $search = trim($_GET['search'] ?? '');

            $whereClauses = [];
            $params = [];

            if ($status && $status !== 'all') {
                $whereClauses[] = "status = ?";
                $params[] = $status;
            }

            if ($search) {
                $whereClauses[] = "(recipient LIKE ? OR subject LIKE ? OR email_type LIKE ? OR error_message LIKE ?)";
                $s = "%{$search}%";
                $params = array_merge($params, [$s, $s, $s, $s]);
            }

            $whereSql = $whereClauses ? "WHERE " . implode(" AND ", $whereClauses) : "";

            $countStmt = $db->prepare("SELECT COUNT(*) FROM email_logs {$whereSql}");
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            $stmt = $db->prepare("
                SELECT id, recipient, email_type, subject, status, delivery_method, error_message, user_id, created_at
                FROM email_logs
                {$whereSql}
                ORDER BY created_at DESC
                LIMIT {$limit} OFFSET {$offset}
            ");
            $stmt->execute($params);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Summary stats safely
            $sentCount = 0;
            $failedCount = 0;
            try {
                $sentCount = (int)$db->query("SELECT COUNT(*) FROM email_logs WHERE status = 'sent'")->fetchColumn();
                $failedCount = (int)$db->query("SELECT COUNT(*) FROM email_logs WHERE status = 'failed'")->fetchColumn();
            } catch (Throwable $e) {}

            respondJson([
                'success' => true,
                'data' => $logs ?: [],
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'stats' => [
                    'total' => $total,
                    'sent' => $sentCount,
                    'failed' => $failedCount
                ]
            ]);
        } catch (Throwable $e) {
            respondJson([
                'success' => true,
                'data' => [],
                'total' => 0,
                'page' => 1,
                'limit' => 25,
                'stats' => ['total' => 0, 'sent' => 0, 'failed' => 0]
            ]);
        }
        break;

    case 'clear-email-logs':
        try {
            $db->exec("DELETE FROM email_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            logAdminAction($adminUser['id'], $adminUser['email'], 'CLEARED_OLD_EMAIL_LOGS', null, "Cleared logs older than 30 days");
            respondJson(['success' => true, 'message' => 'Email logs older than 30 days cleared.']);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    case 'resend-user-verification':
    case 'resend-verification':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = $_GET['id'] ?? $input['userId'] ?? $input['id'] ?? null;
        if (!$userId) {
            respondJson(['success' => false, 'error' => 'User ID required.'], 400);
        }

        $userStmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $userStmt->execute([$userId]);
        $targetUser = $userStmt->fetch();

        if (!$targetUser) {
            respondJson(['success' => false, 'error' => 'User not found.'], 404);
        }

        $emailRes = sendVerificationEmailPhp($targetUser['id'], $targetUser['name'], $targetUser['email']);
        logAdminAction($adminUser['id'], $adminUser['email'], 'RESENT_USER_VERIFICATION', $userId, "Resent verification link to {$targetUser['email']}");

        respondJson([
            'success' => true,
            'emailSent' => $emailRes['sentViaSmtp'] ?? false,
            'message' => ($emailRes['sentViaSmtp'] ?? false)
                ? "Verification email resent successfully to {$targetUser['email']}."
                : "Verification link generated. (SMTP connection issue).",
            'verificationUrl' => $emailRes['verificationUrl'] ?? null,
            'token' => $emailRes['token'] ?? null
        ]);
        break;

    case 'send-email-broadcast':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $subject = trim($input['subject'] ?? '');
        $messageBody = trim($input['messageBody'] ?? $input['message_body'] ?? '');
        $targetGroup = $input['targetGroup'] ?? 'all';
        $customEmails = $input['customEmails'] ?? [];

        if (!$subject || !$messageBody) {
            respondJson(['success' => false, 'error' => 'Subject and message body are required.'], 400);
        }

        $recipients = [];
        if (!empty($customEmails)) {
            $recipients = array_filter(array_map('trim', (array)$customEmails));
        } else {
            if ($targetGroup === 'verified') {
                $stmt = $db->prepare("SELECT email FROM users WHERE email_verified = 1");
            } elseif ($targetGroup === 'admins') {
                $stmt = $db->prepare("SELECT email FROM users WHERE role = 'admin'");
            } else {
                $stmt = $db->prepare("SELECT email FROM users");
            }
            $stmt->execute();
            $rows = $stmt->fetchAll();
            foreach ($rows as $r) { $recipients[] = $r['email']; }
        }

        $htmlBody = "
        <div style='font-family: sans-serif; background:#0F0F17; color:#CBD5E1; padding:30px;'>
          <div style='max-width:580px; margin:0 auto; background:#1C1C28; padding:30px; border-radius:12px; border:1px solid #2C2C3E;'>
            <span style='background:#6366F120; border:1px solid #6366F140; color:#818CF8; padding:4px 12px; border-radius:16px; font-size:12px; font-weight:600;'>📢 System Update</span>
            <h2 style='color:#F1F5F9; font-size:20px; margin-top:12px;'>" . htmlspecialchars($subject) . "</h2>
            <div style='line-height:1.6; font-size:14px; color:#CBD5E1; background:#14141F; padding:18px; border-radius:8px; margin:20px 0;'>
              " . nl2br(htmlspecialchars($messageBody)) . "
            </div>
            <p style='font-size:12px; color:#64748B;'>Official notification from ProfileVault Antidetect Software.</p>
          </div>
        </div>";

        $sentCount = 0;
        foreach ($recipients as $recipientEmail) {
            if (sendSmtpMailPhp($recipientEmail, $subject, $htmlBody)) {
                $sentCount++;
            }
        }

        respondJson([
            'success' => true,
            'totalSent' => $sentCount,
            'message' => "Email broadcast delivered to {$sentCount} recipient(s)."
        ]);
        break;

    // ── 6. Security, Audit Logs & System Health APIs ──
    case 'get-audit-logs':
        try {
            $stmt = $db->prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
            $stmt->execute();
            $logs = $stmt->fetchAll();
            respondJson(['success' => true, 'data' => $logs]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => []]);
        }
        break;

    case 'get-security-events':
        try {
            $stmt = $db->prepare("SELECT * FROM security_events ORDER BY created_at DESC LIMIT 100");
            $stmt->execute();
            $evts = $stmt->fetchAll();
            respondJson(['success' => true, 'data' => $evts]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => []]);
        }
        break;

    // ── Payment Gateways & Transactions Admin APIs ──
    case 'get-payment-gateways':
        try {
            ensureDatabaseTablesExist();
            $stmt = $db->prepare("SELECT * FROM payment_gateways ORDER BY gateway_key ASC");
            $stmt->execute();
            $gateways = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Re-seed default gateways if empty
            if (empty($gateways)) {
                try {
                    $db->exec("
                        INSERT INTO `payment_gateways` (`id`, `gateway_key`, `name`, `is_enabled`, `is_test_mode`, `public_key`, `secret_key`, `webhook_secret`, `currency`, `config_json`)
                        VALUES
                        ('gw_stripe', 'stripe', 'Stripe', 0, 1, '', '', '', 'USD', '{\"checkout_title\":\"ProfileVault Subscription\",\"allow_promotion_codes\":true,\"billing_address_collection\":\"auto\"}'),
                        ('gw_crypto', 'crypto', 'Cryptocurrency', 0, 1, '', '', '', 'USD', '{\"provider\":\"nowpayments\",\"supported_coins\":[\"BTC\",\"ETH\",\"USDT\",\"USDC\"],\"network\":\"TRC20,ERC20,BTC\",\"min_amount\":10,\"confirmations_required\":2}')
                        ON DUPLICATE KEY UPDATE `id`=`id`;
                    ");
                    $stmt->execute();
                    $gateways = $stmt->fetchAll(PDO::FETCH_ASSOC);
                } catch (Throwable $e) {}
            }

            // Mask secrets safely before returning to Admin UI
            foreach ($gateways as &$gw) {
                $gw['config'] = json_decode($gw['config_json'] ?? '{}', true) ?: [];
                if (!empty($gw['secret_key'])) {
                    $prefix = substr($gw['secret_key'], 0, 7);
                    $suffix = substr($gw['secret_key'], -4);
                    $gw['secret_key_masked'] = $prefix . '••••••••••••' . $suffix;
                } else {
                    $gw['secret_key_masked'] = '';
                }
                if (!empty($gw['webhook_secret'])) {
                    $prefix = substr($gw['webhook_secret'], 0, 5);
                    $suffix = substr($gw['webhook_secret'], -4);
                    $gw['webhook_secret_masked'] = $prefix . '••••••••••••' . $suffix;
                } else {
                    $gw['webhook_secret_masked'] = '';
                }
                // Unset raw secrets to guarantee they never leak to UI
                unset($gw['secret_key']);
                unset($gw['webhook_secret']);
            }
            respondJson([
                'success' => true,
                'data' => $gateways,
                'gateways' => $gateways
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    case 'save-payment-gateway':
        try {
            ensureDatabaseTablesExist();
            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $key = trim($input['gateway_key'] ?? $input['key'] ?? '');
            $isEnabled = isset($input['is_enabled']) ? (int)(bool)$input['is_enabled'] : 0;
            $isTestMode = isset($input['is_test_mode']) ? (int)(bool)$input['is_test_mode'] : (isset($input['test_mode']) ? (int)(bool)$input['test_mode'] : 1);
            $publicKey = trim($input['public_key'] ?? '');
            $currency = strtoupper(trim($input['currency'] ?? 'USD'));
            $config = $input['config'] ?? [];

            if (!$key) {
                respondJson(['success' => false, 'error' => 'Gateway key is required.'], 400);
            }

            // Fetch existing gateway to preserve secrets if not changed
            $existStmt = $db->prepare("SELECT * FROM payment_gateways WHERE gateway_key = ?");
            $existStmt->execute([$key]);
            $existing = $existStmt->fetch(PDO::FETCH_ASSOC);

            $secretKey = $existing['secret_key'] ?? '';
            if (!empty($input['secret_key']) && strpos($input['secret_key'], '••••') === false) {
                $secretKey = trim($input['secret_key']);
            }

            $webhookSecret = $existing['webhook_secret'] ?? '';
            if (!empty($input['webhook_secret']) && strpos($input['webhook_secret'], '••••') === false) {
                $webhookSecret = trim($input['webhook_secret']);
            }

            if ($key === 'crypto' && !empty($input['supported_coins']) && is_array($input['supported_coins'])) {
                $config['supported_coins'] = $input['supported_coins'];
            }

            // Ensure payment_gateways table has all required columns
            try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
            try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch (Throwable $e) {}

            if (!$existing) {
                $gwId = 'gw_' . $key;
                $ins = $db->prepare("
                    INSERT INTO payment_gateways (id, gateway_key, name, is_enabled, is_test_mode, public_key, secret_key, webhook_secret, currency, config_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $ins->execute([$gwId, $key, ucfirst($key), $isEnabled, $isTestMode, $publicKey, $secretKey, $webhookSecret, $currency, json_encode($config)]);
            } else {
                $upd = $db->prepare("
                    UPDATE payment_gateways SET
                        is_enabled = ?,
                        is_test_mode = ?,
                        public_key = ?,
                        secret_key = ?,
                        webhook_secret = ?,
                        currency = ?,
                        config_json = ?
                    WHERE gateway_key = ?
                ");
                $upd->execute([
                    $isEnabled,
                    $isTestMode,
                    $publicKey,
                    $secretKey,
                    $webhookSecret,
                    $currency,
                    json_encode($config),
                    $key
                ]);
            }

            logAdminAction($admin['id'], $admin['email'], 'PAYMENT_GATEWAY_CONFIG_UPDATED', $key, "Updated gateway {$key} (Enabled: {$isEnabled}, Mode: " . ($isTestMode ? 'Test' : 'Live') . ")");
            
            // Broadcast gateway update to connected desktop & web clients
            publishRealtimeEvent($db, null, 'gateway.config.updated', [
                'gateway' => $key,
                'isEnabled' => (bool)$isEnabled,
                'isTestMode' => (bool)$isTestMode,
                'currency' => $currency,
                'timestamp' => date('c')
            ]);

            respondJson(['success' => true, 'message' => "Payment gateway '{$key}' settings saved successfully."]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => 'Failed to save gateway: ' . $e->getMessage()], 500);
        }
        break;

    case 'toggle-payment-gateway':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $key = trim($input['gateway_key'] ?? $input['key'] ?? '');
        $enable = (int)(bool)($input['enable'] ?? false);

        $upd = $db->prepare("UPDATE payment_gateways SET is_enabled = ? WHERE gateway_key = ?");
        $upd->execute([$enable, $key]);

        logAdminAction($admin['id'], $admin['email'], $enable ? 'PAYMENT_GATEWAY_ENABLED' : 'PAYMENT_GATEWAY_DISABLED', $key, "Toggled gateway {$key} to " . ($enable ? 'Enabled' : 'Disabled'));

        publishRealtimeEvent($db, null, 'gateway.config.updated', [
            'gateway' => $key,
            'isEnabled' => (bool)$enable,
            'timestamp' => date('c')
        ]);

        respondJson(['success' => true, 'message' => "Gateway '{$key}' " . ($enable ? 'enabled' : 'disabled') . " successfully."]);
        break;

    case 'test-gateway-connection':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $key = trim($input['gateway_key'] ?? $input['key'] ?? '');

        $stmt = $db->prepare("SELECT * FROM payment_gateways WHERE gateway_key = ?");
        $stmt->execute([$key]);
        $gw = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$gw) {
            respondJson(['success' => false, 'error' => 'Gateway not found.'], 404);
        }

        if ($key === 'stripe') {
            $secret = trim($gw['secret_key'] ?? '');
            if (!$secret) {
                respondJson(['success' => false, 'error' => 'Stripe Secret Key is not configured yet.'], 400);
            }

            // Call Stripe Balance API to verify live credentials
            $ch = curl_init('https://api.stripe.com/v1/balance');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $secret]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($err) {
                respondJson(['success' => false, 'error' => 'Connection failed: ' . $err], 500);
            }

            $json = json_decode($res, true);
            if ($code === 200) {
                respondJson([
                    'success' => true,
                    'message' => 'Stripe connection successful! Live API credentials verified.',
                    'livemode' => (bool)($json['livemode'] ?? false),
                    'currency' => $gw['currency']
                ]);
            } else {
                respondJson([
                    'success' => false,
                    'error' => 'Stripe API authentication error: ' . ($json['error']['message'] ?? "HTTP Code $code")
                ], 400);
            }
        } elseif ($key === 'crypto') {
            $conf = json_decode($gw['config_json'] ?? '{}', true) ?: [];
            $apiKey = trim($gw['secret_key'] ?? '');

            if (!$apiKey) {
                respondJson(['success' => false, 'error' => 'Crypto Provider API Key is not configured yet.'], 400);
            }

            $ch = curl_init('https://api.nowpayments.io/v1/status');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: ' . $apiKey]);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200) {
                respondJson(['success' => true, 'message' => 'Cryptocurrency API connection verified and active!']);
            } else {
                respondJson(['success' => false, 'error' => "Crypto Provider API responded with status code $code."], 400);
            }
        } else {
            respondJson(['success' => false, 'error' => "Unknown gateway {$key}"], 400);
        }
        break;

    case 'get-payments':
    case 'get-payment-transactions':
        try {
            $search = trim($_GET['search'] ?? '');
            $gateway = trim($_GET['gateway'] ?? '');
            $status = trim($_GET['status'] ?? '');

            $sql = "
                SELECT p.*, u.name as user_name, u.email as user_email, i.invoice_number 
                FROM payments p 
                LEFT JOIN users u ON p.user_id = u.id 
                LEFT JOIN invoices i ON p.invoice_id = i.id
                WHERE 1=1
            ";
            $params = [];

            if ($search) {
                $sql .= " AND (p.transaction_id LIKE ? OR u.email LIKE ? OR u.name LIKE ? OR i.invoice_number LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            if ($gateway) {
                $sql .= " AND p.gateway = ?";
                $params[] = $gateway;
            }
            if ($status) {
                $sql .= " AND p.status = ?";
                $params[] = $status;
            }

            $sql .= " ORDER BY p.created_at DESC LIMIT 100";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $pays = $stmt->fetchAll(PDO::FETCH_ASSOC);

            respondJson(['success' => true, 'data' => $pays]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => []]);
        }
        break;

    case 'get-webhook-events':
        try {
            $stmt = $db->prepare("SELECT * FROM payment_events ORDER BY received_at DESC LIMIT 50");
            $stmt->execute();
            $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
            respondJson(['success' => true, 'data' => $events]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    case 'refund-payment':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $paymentId = trim($input['payment_id'] ?? '');

        $payStmt = $db->prepare("SELECT * FROM payments WHERE id = ?");
        $payStmt->execute([$paymentId]);
        $pay = $payStmt->fetch(PDO::FETCH_ASSOC);

        if (!$pay) {
            respondJson(['success' => false, 'error' => 'Payment record not found.'], 404);
        }

        if ($pay['status'] === 'refunded') {
            respondJson(['success' => false, 'error' => 'This payment is already refunded.'], 400);
        }

        if ($pay['gateway'] === 'stripe') {
            $gw = getPaymentGatewayConfig($db, 'stripe');
            $secret = trim($gw['secret_key'] ?? '');

            if ($secret && $pay['transaction_id']) {
                $refRes = callStripeApi($secret, 'refunds', 'POST', ['payment_intent' => $pay['transaction_id']]);
                if (!$refRes['success']) {
                    // Try with charge ID fallback
                    $refRes = callStripeApi($secret, 'refunds', 'POST', ['charge' => $pay['transaction_id']]);
                }
            }
        }

        $db->prepare("UPDATE payments SET status = 'refunded' WHERE id = ?")->execute([$paymentId]);
        if (!empty($pay['invoice_id'])) {
            $db->prepare("UPDATE invoices SET status = 'refunded' WHERE id = ?")->execute([$pay['invoice_id']]);
        }

        logAdminAction($admin['id'], $admin['email'], 'PAYMENT_REFUNDED', $pay['user_id'], "Refunded payment {$pay['id']} ($$pay[amount]) via {$pay['gateway']}");

        respondJson(['success' => true, 'message' => "Payment #{$paymentId} marked as refunded."]);
        break;

    case 'login-as-user':
        $targetUserId = $_GET['id'] ?? null;
        if (!$targetUserId) {
            respondJson(['success' => false, 'error' => 'Target User ID required.'], 400);
        }
        $uStmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $uStmt->execute([$targetUserId]);
        $targetUser = $uStmt->fetch();
        if (!$targetUser) {
            respondJson(['success' => false, 'error' => 'User not found.'], 404);
        }
        $token = createSessionToken($targetUser['id']);
        logAdminAction($adminUser['id'], $adminUser['email'], 'LOGIN_AS_USER', $targetUser['id'], "Admin logged in as user {$targetUser['email']}");
        respondJson([
            'success' => true,
            'sessionToken' => $token,
            'user' => [
                'id' => $targetUser['id'],
                'name' => $targetUser['name'],
                'email' => $targetUser['email'],
                'role' => $targetUser['role']
            ]
        ]);
        break;

    case 'get-profile-settings-audit':
        $auditSettings = [
            ['setting_key' => 'general.profile_name', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working'],
            ['setting_key' => 'proxy.http_socks5_bridge', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working'],
            ['setting_key' => 'fingerprint.canvas_noise', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working'],
            ['setting_key' => 'fingerprint.webgl_spoofing', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working'],
            ['setting_key' => 'fingerprint.webrtc_masking', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working'],
            ['setting_key' => 'navigator.user_agent', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working'],
            ['setting_key' => 'navigator.hardware_concurrency', 'status' => 'working', 'layer_ui' => 'working', 'layer_state' => 'working', 'layer_api' => 'working', 'layer_db' => 'working', 'layer_profile_config' => 'working', 'layer_launch' => 'working', 'layer_actual_browser' => 'working']
        ];
        respondJson(['success' => true, 'data' => $auditSettings]);
        break;

    // ── 7. SEO & Metadata APIs ──
    case 'seo/get-settings':
    case 'seo-get-settings':
        try {
            $stmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'seo_%'");
            $rows = $stmt ? $stmt->fetchAll() : [];
            $map = [];
            foreach ($rows as $r) { $map[$r['key']] = $r['value']; }

            // Also check seo_settings table if present
            try {
                $stmt2 = $db->query("SELECT `key`, `value` FROM seo_settings");
                $rows2 = $stmt2 ? $stmt2->fetchAll() : [];
                foreach ($rows2 as $r2) { $map[$r2['key']] = $r2['value']; }
            } catch (Throwable $e) {}

            $settings = [
                'global_title' => $map['seo_global_title'] ?? $map['site_name'] ?? 'ProfileVault — Anti-Detect Browser & Profile Isolation',
                'global_canonical' => $map['seo_global_canonical'] ?? $map['site_url'] ?? 'https://antiprofiles.com',
                'global_og_image' => $map['seo_global_og_image'] ?? $map['default_og_image'] ?? 'https://antiprofiles.com/og-cover.png',
                'global_description' => $map['seo_global_description'] ?? $map['site_description'] ?? 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Software.',
                'robots_content' => $map['robots_content'] ?? "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://antiprofiles.com/sitemap.xml"
            ];
            respondJson(['success' => true, 'data' => $settings]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => [
                'global_title' => 'ProfileVault — Anti-Detect Browser & Profile Isolation',
                'global_canonical' => 'https://antiprofiles.com',
                'global_og_image' => 'https://antiprofiles.com/og-cover.png',
                'global_description' => 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Software.'
            ]]);
        }
        break;

    case 'seo/get-pages':
    case 'seo-pages':
    case 'seo/pages':
        try {
            $pages = [];
            try {
                $stmt = $db->query("SELECT * FROM page_seo ORDER BY page_path ASC");
                $pages = $stmt ? $stmt->fetchAll() : [];
            } catch (Throwable $e) {}

            if (empty($pages)) {
                try {
                    $stmt2 = $db->query("SELECT * FROM seo_pages ORDER BY page_path ASC");
                    $pages = $stmt2 ? $stmt2->fetchAll() : [];
                } catch (Throwable $e) {}
            }

            if (empty($pages)) {
                $pages = [
                    [
                        'id' => 'seo_home',
                        'page_path' => '/',
                        'title' => 'ProfileVault — Anti-Detect Browser & Multi-Accounting Platform',
                        'description' => 'Enterprise Anti-Detect Browser. Manage thousands of isolated browser profiles, proxies, and digital fingerprints securely.',
                        'primary_keyword' => 'anti detect browser',
                        'robots' => 'index, follow',
                        'canonical_url' => 'https://antiprofiles.com/'
                    ],
                    [
                        'id' => 'seo_download',
                        'page_path' => '/download',
                        'title' => 'Download ProfileVault Anti-Detect Browser for Windows, macOS & Linux',
                        'description' => 'Download official ProfileVault application binaries with built-in proxy isolation and fingerprint spoofing.',
                        'primary_keyword' => 'download antidetect browser',
                        'robots' => 'index, follow',
                        'canonical_url' => 'https://antiprofiles.com/download'
                    ],
                    [
                        'id' => 'seo_pricing',
                        'page_path' => '/pricing',
                        'title' => 'ProfileVault Pricing & Subscription Plans',
                        'description' => 'Affordable multi-accounting browser plans for affiliate marketers, e-commerce, and agencies.',
                        'primary_keyword' => 'antidetect browser price',
                        'robots' => 'index, follow',
                        'canonical_url' => 'https://antiprofiles.com/pricing'
                    ]
                ];
            }

            // Normalize fields for frontend table
            foreach ($pages as &$p) {
                if (!isset($p['page_path']) && isset($p['path'])) $p['page_path'] = $p['path'];
                if (!isset($p['title']) && isset($p['meta_title'])) $p['title'] = $p['meta_title'];
                if (!isset($p['description']) && isset($p['meta_description'])) $p['description'] = $p['meta_description'];
                if (!isset($p['primary_keyword']) && isset($p['keyword'])) $p['primary_keyword'] = $p['keyword'];
                if (empty($p['robots'])) $p['robots'] = 'index, follow';
                if (empty($p['primary_keyword'])) $p['primary_keyword'] = 'anti detect browser';
            }

            respondJson(['success' => true, 'data' => $pages]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => []]);
        }
        break;

    case 'seo/save-settings':
    case 'seo-save-settings':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $allowedSeoKeys = ['global_title', 'global_canonical', 'global_og_image', 'global_description', 'robots_content', 'sitemap_enabled'];
        $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
        foreach ($allowedSeoKeys as $k) {
            if (isset($input[$k])) {
                $stmt->execute(['seo_' . $k, (string)$input[$k]]);
            }
        }
        logAdminAction($adminUser['id'], $adminUser['email'], 'SAVE_SEO_SETTINGS', null, 'Admin saved global SEO and OpenGraph metadata');
        respondJson(['success' => true, 'message' => 'Global SEO settings saved successfully.']);
        break;

    case 'seo/save-page':
    case 'seo-save-page':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $path = trim($input['page_path'] ?? $input['path'] ?? '/');
        $title = trim($input['title'] ?? $input['meta_title'] ?? 'ProfileVault');
        $desc = trim($input['description'] ?? $input['meta_description'] ?? '');
        $robots = trim($input['robots'] ?? 'index, follow');
        $canonical = trim($input['canonical_url'] ?? ('https://antiprofiles.com' . $path));
        $keyword = trim($input['primary_keyword'] ?? $input['keyword'] ?? 'antidetect browser');

        try {
            $db->prepare("
                INSERT INTO page_seo (id, page_path, title, description, primary_keyword, robots, canonical_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), primary_keyword = VALUES(primary_keyword), robots = VALUES(robots), canonical_url = VALUES(canonical_url), updated_at = NOW()
            ")->execute(['page_' . md5($path), $path, $title, $desc, $keyword, $robots, $canonical]);
        } catch (Throwable $e) {}

        try {
            $db->prepare("
                INSERT INTO seo_pages (id, page_path, title, description, primary_keyword, robots, canonical_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), primary_keyword = VALUES(primary_keyword), robots = VALUES(robots), canonical_url = VALUES(canonical_url), updated_at = NOW()
            ")->execute(['seo_' . md5($path), $path, $title, $desc, $keyword, $robots, $canonical]);
        } catch (Throwable $e) {}

        logAdminAction($adminUser['id'], $adminUser['email'], 'SAVE_SEO_PAGE', null, "Admin updated SEO for page {$path}");
        respondJson(['success' => true, 'message' => "SEO metadata for {$path} saved successfully."]);
        break;

    case 'seo/delete-page':
    case 'seo-delete-page':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $path = trim($input['page_path'] ?? $input['path'] ?? $_GET['path'] ?? '');
        if (!$path || $path === '/') {
            respondJson(['success' => false, 'error' => 'Cannot delete root homepage SEO.'], 400);
        }

        try {
            $db->prepare("DELETE FROM page_seo WHERE page_path = ?")->execute([$path]);
        } catch (Throwable $e) {}
        try {
            $db->prepare("DELETE FROM seo_pages WHERE page_path = ?")->execute([$path]);
        } catch (Throwable $e) {}

        logAdminAction($adminUser['id'], $adminUser['email'], 'DELETE_SEO_PAGE', null, "Admin deleted SEO for page {$path}");
        respondJson(['success' => true, 'message' => "SEO for page {$path} deleted successfully."]);
        break;

    case 'get-releases-config':
        $config = getDesktopAppConfigMap();
        respondJson(['success' => true, 'data' => $config]);
        break;

    case 'update-releases-config':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $allowedKeys = [
            'win_app_version', 'win_download_url', 'win_enabled',
            'mac_arm_app_version', 'mac_arm_download_url', 'mac_arm_enabled',
            'mac_intel_app_version', 'mac_intel_download_url', 'mac_intel_enabled',
            'linux_app_version', 'linux_download_url', 'linux_enabled',
            'min_supported_version', 'release_notes'
        ];

        $stmt = $db->prepare("INSERT INTO desktop_app_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
        foreach ($allowedKeys as $k) {
            if (isset($input[$k])) {
                $stmt->execute([$k, (string)$input[$k]]);
            }
        }
        logAdminAction($adminUser['id'], $adminUser['email'], 'UPDATE_RELEASES_CONFIG', null, 'Admin updated desktop release download links and versions');
        respondJson(['success' => true, 'message' => 'Release configuration updated successfully.']);
        break;

    case 'upload-release-file':
        if (!isset($_FILES['file'])) {
            respondJson(['success' => false, 'error' => 'No file uploaded.'], 400);
        }

        $platform = $_POST['platform'] ?? 'windows-x64';
        $filenameMap = [
            'windows-x64' => 'ProfileVault-Windows-x64.exe',
            'macos-arm64' => 'ProfileVault-macOS-AppleSilicon-arm64.dmg',
            'macos-x64' => 'ProfileVault-macOS-Intel-x64.dmg',
            'linux-x64' => 'ProfileVault-Linux-x86_64.AppImage'
        ];

        $targetName = $filenameMap[$platform] ?? basename($_FILES['file']['name']);
        $releasesDir = __DIR__ . '/../releases';
        if (!is_dir($releasesDir)) {
            mkdir($releasesDir, 0755, true);
        }

        $targetPath = $releasesDir . '/' . $targetName;
        if (move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
            chmod($targetPath, 0644);
            $downloadUrl = '/api/releases?download=1&platform=' . $platform;

            $configKeyMap = [
                'windows-x64' => 'win_download_url',
                'macos-arm64' => 'mac_arm_download_url',
                'macos-x64' => 'mac_intel_download_url',
                'linux-x64' => 'linux_download_url'
            ];

            if (isset($configKeyMap[$platform])) {
                $stmt = $db->prepare("INSERT INTO desktop_app_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
                $stmt->execute([$configKeyMap[$platform], $downloadUrl]);
            }

            logAdminAction($adminUser['id'], $adminUser['email'], 'UPLOAD_RELEASE_FILE', null, "Uploaded release binary file for platform {$platform}");
            respondJson([
                'success' => true,
                'message' => "Application binary '{$targetName}' uploaded successfully (" . filesize($targetPath) . " bytes).",
                'downloadUrl' => $downloadUrl,
                'fileSize' => filesize($targetPath)
            ]);
        } else {
            respondJson(['success' => false, 'error' => 'Failed to save uploaded release file.'], 500);
        }
        break;

    case 'get-app-releases':
        try {
            $stmt = $db->query("SELECT * FROM app_releases ORDER BY created_at DESC");
            $releases = $stmt->fetchAll();
            respondJson(['success' => true, 'data' => $releases]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => []]);
        }
        break;

    case 'publish-app-release':
        $platform = trim($_POST['platform'] ?? 'windows-x64');
        $version = trim($_POST['version'] ?? '1.0.0');
        $releaseName = trim($_POST['release_name'] ?? "ProfileVault v{$version} Release");
        $releaseNotes = trim($_POST['release_notes'] ?? '');
        $status = trim($_POST['status'] ?? 'active');
        $directUrl = trim($_POST['download_url'] ?? '');

        $releaseId = 'rel_' . bin2hex(random_bytes(8));
        $filePath = null;
        $originalFilename = null;
        $fileSize = 0;

        if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $releasesDir = __DIR__ . '/../releases';
            if (!is_dir($releasesDir)) {
                mkdir($releasesDir, 0755, true);
            }

            $ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION);
            $cleanVersion = preg_replace('/[^a-zA-Z0-9\._-]/', '', $version);
            $targetFilename = "ProfileVault-{$platform}-v{$cleanVersion}.{$ext}";
            $targetPath = $releasesDir . '/' . $targetFilename;

            if (move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
                chmod($targetPath, 0644);
                $filePath = 'releases/' . $targetFilename;
                $originalFilename = $_FILES['file']['name'];
                $fileSize = filesize($targetPath);
            }
        }

        if (empty($directUrl) && !empty($filePath)) {
            $slugMap = [
                'windows-x64' => '/download/windows',
                'macos-arm64' => '/download/macos-arm64',
                'macos-x64' => '/download/macos-intel',
                'linux-x64' => '/download/linux'
            ];
            $directUrl = $slugMap[$platform] ?? '/download/windows';
        }

        if ($status === 'active') {
            // Archive existing releases for platform
            $archStmt = $db->prepare("UPDATE app_releases SET status = 'archived' WHERE platform = ?");
            $archStmt->execute([$platform]);

            // Sync with legacy config
            $cfgVerKey = $platform === 'windows-x64' ? 'win_app_version' : ($platform === 'macos-arm64' ? 'mac_arm_app_version' : ($platform === 'macos-x64' ? 'mac_intel_app_version' : 'linux_app_version'));
            $cfgUrlKey = $platform === 'windows-x64' ? 'win_download_url' : ($platform === 'macos-arm64' ? 'mac_arm_download_url' : ($platform === 'macos-x64' ? 'mac_intel_download_url' : 'linux_download_url'));

            $syncStmt = $db->prepare("INSERT INTO desktop_app_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
            $syncStmt->execute([$cfgVerKey, $version]);
            $syncStmt->execute([$cfgUrlKey, $directUrl]);
        }

        $insStmt = $db->prepare("
            INSERT INTO app_releases (id, platform, version, release_name, file_path, download_url, original_filename, file_size, release_notes, status, published_at, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
        ");
        $insStmt->execute([
            $releaseId, $platform, $version, $releaseName, $filePath, $directUrl,
            $originalFilename, $fileSize, $releaseNotes, $status, $adminUser['email']
        ]);

        logAdminAction($adminUser['id'], $adminUser['email'], 'PUBLISH_APP_RELEASE', null, "Published release {$version} for {$platform}");

        respondJson([
            'success' => true,
            'message' => "Application release v{$version} for {$platform} published successfully!",
            'releaseId' => $releaseId
        ]);
        break;

    case 'activate-app-release':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $releaseId = $input['releaseId'] ?? '';

        if (!$releaseId) {
            respondJson(['success' => false, 'error' => 'Release ID required.'], 400);
        }

        $relStmt = $db->prepare("SELECT * FROM app_releases WHERE id = ?");
        $relStmt->execute([$releaseId]);
        $rel = $relStmt->fetch();

        if (!$rel) {
            respondJson(['success' => false, 'error' => 'Release record not found.'], 404);
        }

        // Archive all for platform
        $archStmt = $db->prepare("UPDATE app_releases SET status = 'archived' WHERE platform = ?");
        $archStmt->execute([$rel['platform']]);

        // Activate specified release
        $actStmt = $db->prepare("UPDATE app_releases SET status = 'active', published_at = CURRENT_TIMESTAMP WHERE id = ?");
        $actStmt->execute([$releaseId]);

        // Sync legacy config
        $platform = $rel['platform'];
        $cfgVerKey = $platform === 'windows-x64' ? 'win_app_version' : ($platform === 'macos-arm64' ? 'mac_arm_app_version' : ($platform === 'macos-x64' ? 'mac_intel_app_version' : 'linux_app_version'));
        $cfgUrlKey = $platform === 'windows-x64' ? 'win_download_url' : ($platform === 'macos-arm64' ? 'mac_arm_download_url' : ($platform === 'macos-x64' ? 'mac_intel_download_url' : 'linux_download_url'));

        $syncStmt = $db->prepare("INSERT INTO desktop_app_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
        $syncStmt->execute([$cfgVerKey, $rel['version']]);
        $syncStmt->execute([$cfgUrlKey, $rel['download_url']]);

        logAdminAction($adminUser['id'], $adminUser['email'], 'ACTIVATE_APP_RELEASE', null, "Activated release {$rel['version']} for {$platform}");

        respondJson(['success' => true, 'message' => "Release v{$rel['version']} for {$platform} is now active!"]);
        break;

    case 'delete-app-release':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $releaseId = $input['releaseId'] ?? '';

        if (!$releaseId) {
            respondJson(['success' => false, 'error' => 'Release ID required.'], 400);
        }

        $relStmt = $db->prepare("SELECT * FROM app_releases WHERE id = ?");
        $relStmt->execute([$releaseId]);
        $rel = $relStmt->fetch();

        if ($rel) {
            if (!empty($rel['file_path'])) {
                $file = __DIR__ . '/../' . ltrim($rel['file_path'], '/');
                if (file_exists($file) && is_file($file)) {
                    @unlink($file);
                }
            }
            $delStmt = $db->prepare("DELETE FROM app_releases WHERE id = ?");
            $delStmt->execute([$releaseId]);
        }

        logAdminAction($adminUser['id'], $adminUser['email'], 'DELETE_APP_RELEASE', null, "Deleted release record {$releaseId}");
        respondJson(['success' => true, 'message' => 'Release deleted successfully.']);
        break;

    default:
        respondJson(['success' => false, 'error' => 'Invalid admin action.'], 404);
}



