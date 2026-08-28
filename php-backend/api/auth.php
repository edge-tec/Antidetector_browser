<?php
// ──────────────────────────────────────────────
// ProfileVault — Authentication REST API (PHP)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

$action = $_GET['action'] ?? '';
$db = Database::getConnection();

switch ($action) {

    // ── 0. Captcha Public Configuration ──
    case 'captcha-config':
        $config = getCaptchaConfigPhp(false);
        respondJson(['success' => true, 'data' => $config]);
        break;

    // ── 1. User Login ──
    case 'login':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (!$email || !$password) {
            respondJson(['success' => false, 'error' => 'Email and password are required.'], 400);
        }

        // Validate Captcha
        $captchaToken = $input['captcha_token'] ?? $input['captchaToken'] ?? $_POST['captcha_token'] ?? null;
        $cRes = verifyCaptchaTokenPhp($captchaToken, 'login');
        if (!$cRes['success']) {
            respondJson(['success' => false, 'error' => $cRes['error'] ?? 'Captcha verification failed.'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !verifyUserPassword($password, $user['password_hash'])) {
            respondJson(['success' => false, 'error' => 'Invalid email or password.'], 401);
        }

        if ($user['account_status'] === 'suspended') {
            respondJson(['success' => false, 'error' => 'Your account has been suspended by an administrator. Please contact support.'], 403);
        }

        // Enforce Email Verification Requirement (except default system admin)
        if ((int)$user['email_verified'] !== 1 && $user['id'] !== 'admin-default') {
            recordSecurityEvent('SESSION_BLOCKED_UNVERIFIED_USER', 'warning', $user['id'], "Login attempt blocked for unverified user {$email}");
            respondJson([
                'success' => false,
                'requiresVerification' => true,
                'emailVerified' => false,
                'error' => 'Please verify your email address before continuing.',
                'email' => $user['email']
            ], 403);
        }

        // Update last login timestamp
        $updateStmt = $db->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?");
        $updateStmt->execute([$user['id']]);

        // Generate JWT session token
        $sessionToken = createSessionToken($user['id']);

        $platform = $_SERVER['HTTP_X_PLATFORM'] ?? $input['platform'] ?? 'desktop';
        $deviceName = $_SERVER['HTTP_X_DEVICE_NAME'] ?? $input['deviceName'] ?? 'Desktop Client';
        $authVersion = (int)($user['auth_version'] ?? 1);

        // Register active session for tracking & revocation
        try {
            registerUserSession($db, $user['id'], $sessionToken, $platform, $deviceName, $authVersion);
        } catch (Throwable $e) {}

        // Resolve Granular RBAC Permissions
        $permissions = resolveUserPermissions($user['role'] ?? 'user', $user['permissions'] ?? null);

        // License & Subscription Verification safely
        $license = null;
        try {
            require_once __DIR__ . '/license.php';
            $installationId = $_SERVER['HTTP_X_INSTALLATION_ID'] ?? $input['installationId'] ?? null;
            $appVersion = $_SERVER['HTTP_X_APP_VERSION'] ?? $input['appVersion'] ?? null;
            $license = validateUserLicenseInternal($user['id'], $installationId, $platform, $appVersion);
        } catch (Throwable $e) {
            $license = [
                'valid' => true,
                'account_status' => $user['account_status'],
                'subscription_status' => 'active',
                'plan' => ['name' => 'Starter Plan', 'slug' => 'starter'],
                'limits' => ['profiles' => 25, 'team' => 2]
            ];
        }

        respondJson([
            'success' => true,
            'sessionToken' => $sessionToken,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'permissions' => $permissions,
                'authVersion' => $authVersion,
                'emailVerified' => (bool)$user['email_verified'],
                'accountStatus' => $user['account_status'],
                'createdAt' => $user['created_at'],
                'lastLoginAt' => date('c')
            ],
            'authorization' => [
                'role' => $user['role'],
                'permissions' => $permissions,
                'authVersion' => $authVersion,
                'accountStatus' => $user['account_status'],
                'isAuthorized' => ($user['account_status'] === 'active')
            ],
            'license' => $license
        ]);
        break;

    // ── 2. User Registration ──
    case 'register':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $name = trim($input['name'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (!$name || !$email || !$password) {
            respondJson(['success' => false, 'error' => 'Name, email, and password are required.'], 400);
        }

        // Validate Captcha
        $captchaToken = $input['captcha_token'] ?? $input['captchaToken'] ?? $_POST['captcha_token'] ?? null;
        $cRes = verifyCaptchaTokenPhp($captchaToken, 'register');
        if (!$cRes['success']) {
            respondJson(['success' => false, 'error' => $cRes['error'] ?? 'Captcha verification failed.'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondJson(['success' => false, 'error' => 'Please enter a valid email address.'], 400);
        }

        if (strlen($password) < 6) {
            respondJson(['success' => false, 'error' => 'Password must be at least 6 characters.'], 400);
        }

        $checkStmt = $db->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)");
        $checkStmt->execute([$email]);
        if ($checkStmt->fetch()) {
            respondJson(['success' => false, 'error' => 'An account with this email address already exists.'], 400);
        }

        $userId = 'usr_' . bin2hex(random_bytes(8));
        $passwordHash = hashUserPassword($password);

        $userCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $lowerEmail = strtolower($email);
        $isAdmin = ($userCount === 0 || $lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false);
        $role = $isAdmin ? 'admin' : 'user';
        $emailVerified = $isAdmin ? 1 : 0;
        $accountStatus = $isAdmin ? 'active' : 'pending_verification';
        $refAffId = trim($input['aff_id'] ?? $input['ref'] ?? $_COOKIE['aff_id'] ?? $_COOKIE['ref'] ?? '');
        $refClickId = trim($input['click_id'] ?? $_COOKIE['click_id'] ?? '');
        $refOfferId = trim($input['offer_id'] ?? $input['offer'] ?? $_COOKIE['offer_id'] ?? '');
        $refPackageId = trim($input['package_id'] ?? $input['plan'] ?? $_COOKIE['package_id'] ?? $_COOKIE['selected_plan'] ?? '');
        $refLinkId = trim($input['link_id'] ?? $_COOKIE['link_id'] ?? '');

        // Generate user's own affiliate ID and referral code
        $cleanId = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $userId), 0, 8));
        $userAffId = 'AFF-' . ($cleanId ?: strtoupper(bin2hex(random_bytes(4))));
        $userRefCode = 'REF_' . ($cleanId ?: strtoupper(bin2hex(random_bytes(4))));

        $insertStmt = $db->prepare("
            INSERT INTO users (
                id, name, email, password_hash, role, email_verified, account_status,
                affiliate_id, referral_code, referred_by_affiliate_id, referred_by_click_id,
                referred_by_offer_id, referred_by_package_id, referred_by_link_id,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $insertStmt->execute([
            $userId, $name, strtolower($email), $passwordHash, $role, $emailVerified, $accountStatus,
            $userAffId, $userRefCode, $refAffId ?: null, $refClickId ?: null,
            $refOfferId ?: null, $refPackageId ?: null, $refLinkId ?: null
        ]);

        // If affiliate click was present, mark click converted
        if (!empty($refClickId)) {
            try {
                $db->prepare("UPDATE affiliate_clicks SET converted = 1, converted_at = CURRENT_TIMESTAMP WHERE click_id = ?")->execute([$refClickId]);
            } catch (Throwable $e) {}
        }

        // Automatically provision Free plan subscription for new user
        ensureUserFreeSubscription($db, $userId, $role);

        // Automatically dispatch verification email via SMTP
        $emailRes = ['sentViaSmtp' => false];
        try {
            $emailRes = sendVerificationEmailPhp($userId, $name, $email);
        } catch (Throwable $e) {}

        recordSecurityEvent('USER_REGISTERED', 'info', $userId, "User registered with email {$email}. Mandatory email verification: " . ($emailVerified ? 'Admin Auto-verified' : 'Pending Verification'));

        if (!$emailVerified) {
            respondJson([
                'success' => true,
                'requiresVerification' => true,
                'emailVerified' => false,
                'email' => strtolower($email),
                'emailSent' => (bool)($emailRes['sentViaSmtp'] ?? false),
                'message' => 'Registration successful! We have sent a verification link to your email address. Please click the link to verify your account before signing in.',
                'verificationUrl' => $emailRes['verificationUrl'] ?? null
            ]);
        } else {
            $sessionToken = createSessionToken($userId);
            $permissions = resolveUserPermissions($role, null);
            respondJson([
                'success' => true,
                'requiresVerification' => false,
                'emailVerified' => true,
                'sessionToken' => $sessionToken,
                'message' => 'Account created successfully! Welcome to AntiProfiles.',
                'user' => [
                    'id' => $userId,
                    'name' => $name,
                    'email' => strtolower($email),
                    'role' => $role,
                    'permissions' => $permissions,
                    'emailVerified' => true,
                    'accountStatus' => 'active',
                    'createdAt' => date('c'),
                    'lastLoginAt' => date('c')
                ]
            ]);
        }
        break;

    // ── 0.1. Google OAuth Public Configuration ──
    case 'google-config':
        $cfg = getGoogleOAuthConfigPhp();
        respondJson([
            'success' => true,
            'data' => [
                'enabled' => $cfg['enabled'] ?? true,
                'clientId' => $cfg['clientId'] ?? '',
                'oneTap' => $cfg['oneTap'] ?? true
            ]
        ]);
        break;

    // ── 4. Google OAuth Login / Registration ──
    case 'google':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $credential = trim($input['credential'] ?? '');
        $accessToken = trim($input['access_token'] ?? $input['accessToken'] ?? '');
        $code = trim($input['code'] ?? '');
        $email = trim($input['email'] ?? '');
        $name = trim($input['name'] ?? '');
        $googleId = trim($input['googleId'] ?? '');
        $picture = trim($input['picture'] ?? '');

        // 1. Verify Access Token with Google Userinfo API if provided
        if (!empty($accessToken)) {
            try {
                $ch = curl_init("https://www.googleapis.com/oauth2/v3/userinfo");
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
                curl_setopt($ch, CURLOPT_TIMEOUT, 8);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode === 200 && $response) {
                    $uInfo = json_decode($response, true);
                    if (!empty($uInfo['email'])) {
                        $email = trim($uInfo['email']);
                        $name = trim($uInfo['name'] ?? explode('@', $email)[0]);
                        $googleId = trim($uInfo['sub'] ?? '');
                        $picture = trim($uInfo['picture'] ?? '');
                    }
                }
            } catch (Throwable $e) {}
        }

        // 2. Decode and verify Google JWT ID Token if provided
        if (empty($email) && !empty($credential)) {
            // First attempt: Verify directly with Google OAuth2 tokeninfo API
            $verifiedWithGoogle = false;
            try {
                $ch = curl_init("https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($credential));
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 8);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode === 200 && $response) {
                    $gData = json_decode($response, true);
                    if (!empty($gData['email'])) {
                        $email = trim($gData['email']);
                        $name = trim($gData['name'] ?? explode('@', $email)[0]);
                        $googleId = trim($gData['sub'] ?? '');
                        $picture = trim($gData['picture'] ?? '');
                        $verifiedWithGoogle = true;
                    }
                }
            } catch (Throwable $e) {}

            // Fallback: Decode JWT payload directly
            if (!$verifiedWithGoogle) {
                $jwtParts = explode('.', $credential);
                if (count($jwtParts) === 3) {
                    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $jwtParts[1])), true);
                    if ($payload && !empty($payload['email'])) {
                        $email = trim($payload['email']);
                        $name = trim($payload['name'] ?? explode('@', $email)[0]);
                        $googleId = trim($payload['sub'] ?? '');
                        $picture = trim($payload['picture'] ?? '');
                    }
                }
            }
        }

        if (!$email) {
            respondJson(['success' => false, 'error' => 'Valid Google Account authentication data or email address is required.'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondJson(['success' => false, 'error' => 'Invalid email address format.'], 400);
        }

        if (!$name) $name = explode('@', $email)[0];
        if (!$googleId) $googleId = 'gid_' . bin2hex(random_bytes(8));

        // Check if user already exists by email
        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Register new Google user automatically
            $userId = 'usr_g_' . bin2hex(random_bytes(6));
            $passwordHash = hashUserPassword('google_oauth_' . bin2hex(random_bytes(16)));

            $userCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
            $lowerEmail = strtolower($email);
            $role = ($userCount === 0 || $lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false) ? 'admin' : 'user';

            $refAffId = trim($input['aff_id'] ?? $input['ref'] ?? $_COOKIE['aff_id'] ?? $_COOKIE['ref'] ?? '');
            $refClickId = trim($input['click_id'] ?? $_COOKIE['click_id'] ?? '');

            $cleanId = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $userId), 0, 8));
            $userAffId = 'AFF-' . ($cleanId ?: strtoupper(bin2hex(random_bytes(4))));
            $userRefCode = 'REF_' . ($cleanId ?: strtoupper(bin2hex(random_bytes(4))));

            $insertStmt = $db->prepare("
                INSERT INTO users (id, name, email, password_hash, role, email_verified, account_status, google_id, affiliate_id, referral_code, referred_by_affiliate_id, referred_by_click_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, 'active', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ");
            $insertStmt->execute([$userId, $name, strtolower($email), $passwordHash, $role, $googleId, $userAffId, $userRefCode, $refAffId ?: null, $refClickId ?: null]);

            // Automatically provision Free plan subscription for new user
            ensureUserFreeSubscription($db, $userId, $role);

            $stmt->execute([$email]);
            $user = $stmt->fetch();
        } else {
            // Automatically mark email_verified = 1 since verified by Google
            $upG = $db->prepare("UPDATE users SET email_verified = 1, google_id = COALESCE(google_id, ?) WHERE id = ?");
            $upG->execute([$googleId, $user['id']]);
            $user['email_verified'] = 1;
        }

        if ($user['account_status'] === 'suspended') {
            respondJson(['success' => false, 'error' => 'Your account has been suspended by an administrator. Please contact support.'], 403);
        }

        // Update last login timestamp
        $updateStmt = $db->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?");
        $updateStmt->execute([$user['id']]);

        // Generate JWT session token
        $sessionToken = createSessionToken($user['id']);

        $platform = $_SERVER['HTTP_X_PLATFORM'] ?? $input['platform'] ?? 'desktop';
        $deviceName = $_SERVER['HTTP_X_DEVICE_NAME'] ?? $input['deviceName'] ?? 'Google OAuth Client';
        $authVersion = (int)($user['auth_version'] ?? 1);

        // Register active session for tracking & revocation
        try {
            registerUserSession($db, $user['id'], $sessionToken, $platform, $deviceName, $authVersion);
        } catch (Throwable $e) {}

        // Resolve Granular RBAC Permissions
        $permissions = resolveUserPermissions($user['role'] ?? 'user', $user['permissions'] ?? null);

        // License & Subscription Verification safely
        $license = null;
        try {
            require_once __DIR__ . '/license.php';
            $installationId = $_SERVER['HTTP_X_INSTALLATION_ID'] ?? $input['installationId'] ?? null;
            $appVersion = $_SERVER['HTTP_X_APP_VERSION'] ?? $input['appVersion'] ?? null;
            $license = validateUserLicenseInternal($user['id'], $installationId, $platform, $appVersion);
        } catch (Throwable $e) {
            $license = [
                'valid' => true,
                'account_status' => $user['account_status'],
                'subscription_status' => 'active',
                'plan' => ['name' => 'Starter Plan', 'slug' => 'starter'],
                'limits' => ['profiles' => 25, 'team' => 2]
            ];
        }

        respondJson([
            'success' => true,
            'sessionToken' => $sessionToken,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'permissions' => $permissions,
                'authVersion' => $authVersion,
                'emailVerified' => true,
                'accountStatus' => $user['account_status'],
                'createdAt' => $user['created_at'],
                'lastLoginAt' => date('c')
            ],
            'authorization' => [
                'role' => $user['role'],
                'permissions' => $permissions,
                'authVersion' => $authVersion,
                'accountStatus' => $user['account_status'],
                'isAuthorized' => ($user['account_status'] === 'active')
            ],
            'license' => $license
        ]);
        break;

    // ── 3. Get Current Profile & Permissions ──
    case 'me':
    case 'authorization':
        $token = getBearerToken();
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Unauthorized or expired session.'], 401);
        }

        // Check if session token was revoked
        if ($token && isUserSessionRevoked($db, $user['id'], $token)) {
            respondJson([
                'success' => false,
                'sessionRevoked' => true,
                'error' => 'Session has been invalidated or revoked by administrator. Please log in again.'
            ], 401);
        }

        if ($user['account_status'] === 'suspended' || $user['account_status'] === 'disabled') {
            respondJson([
                'success' => false,
                'accountSuspended' => true,
                'error' => 'Your account is ' . $user['account_status'] . '. Access restricted.'
            ], 403);
        }

        $authVersion = (int)($user['auth_version'] ?? 1);
        $permissions = resolveUserPermissions($user['role'] ?? 'user', $user['permissions'] ?? null);

        // Fetch user license & subscription details
        require_once __DIR__ . '/license.php';
        $license = validateUserLicenseInternal($user['id']);

        respondJson([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'permissions' => $permissions,
                'authVersion' => $authVersion,
                'emailVerified' => (bool)($user['email_verified'] ?? 1),
                'accountStatus' => $user['account_status'] ?? 'active',
                'createdAt' => $user['created_at'] ?? date('c'),
                'lastLoginAt' => $user['last_login_at'] ?? date('c')
            ],
            'authorization' => [
                'role' => $user['role'],
                'permissions' => $permissions,
                'authVersion' => $authVersion,
                'accountStatus' => $user['account_status'] ?? 'active',
                'isAuthorized' => ($user['account_status'] === 'active')
            ],
            'license' => $license,
            'timestamp' => date('c')
        ]);
        break;

    // ── 3.5. Logout & Session Invalidation ──
    case 'logout':
        $token = getBearerToken();
        $user = getAuthenticatedUser();
        if ($user && $token) {
            try {
                $tokenHash = hash('sha256', $token);
                $db->prepare("UPDATE user_sessions SET is_revoked = 1, revoked_reason = 'User logout', revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?")->execute([$tokenHash]);
            } catch (Throwable $e) {}
        }
        respondJson(['success' => true, 'message' => 'Logged out successfully.']);
        break;

    // ── 3.6. Resend Email Verification Token & Link ──
    case 'resend-verification':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $email = strtolower(trim($input['email'] ?? ''));
        if (!$email) {
            respondJson(['success' => false, 'error' => 'Email address is required.'], 400);
        }

        $userStmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
        $userStmt->execute([$email]);
        $targetUser = $userStmt->fetch();

        if (!$targetUser) {
            // Safe response to prevent email enumeration
            respondJson([
                'success' => true,
                'message' => 'If an account exists, a new verification link has been sent to your email.'
            ]);
        }

        if ((int)$targetUser['email_verified'] === 1) {
            respondJson([
                'success' => true,
                'alreadyVerified' => true,
                'message' => 'Your email address is already verified. Please sign in.'
            ]);
        }

        // Rate limiting cooldown (45 seconds between resends)
        if (!empty($targetUser['verification_created_at'])) {
            $lastSent = strtotime($targetUser['verification_created_at']);
            $elapsed = time() - $lastSent;
            if ($elapsed < 45) {
                $wait = 45 - $elapsed;
                respondJson([
                    'success' => false,
                    'cooldown' => true,
                    'cooldownSeconds' => $wait,
                    'error' => "Please wait {$wait} seconds before requesting another verification email."
                ], 429);
            }
        }

        $emailRes = sendVerificationEmailPhp($targetUser['id'], $targetUser['name'], $targetUser['email']);
        $sentSmtp = (bool)($emailRes['sentViaSmtp'] ?? false);

        recordSecurityEvent('VERIFICATION_RESENT', 'info', $targetUser['id'], "Verification email resent to {$email}");

        respondJson([
            'success' => true,
            'emailSent' => $sentSmtp,
            'message' => $sentSmtp
                ? 'A new confirmation link has been sent to your email address.'
                : 'A new token was generated, but SMTP could not dispatch the email. Please check SMTP settings.',
            'verificationUrl' => $emailRes['verificationUrl'] ?? null,
            'token' => $emailRes['token'] ?? null
        ]);
        break;

    // ── 3.7. Verify Email Token ──
    case 'verify-email':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $plainToken = trim($input['token'] ?? $_GET['token'] ?? '');
        if (!$plainToken) {
            respondJson(['success' => false, 'error' => 'Verification token is required.'], 400);
        }

        $tokenHash = hash('sha256', $plainToken);

        // Check if token exists in verification_tokens
        $tokStmt = $db->prepare("SELECT * FROM verification_tokens WHERE token_hash = ? ORDER BY id DESC LIMIT 1");
        $tokStmt->execute([$tokenHash]);
        $tokenRecord = $tokStmt->fetch();

        if (!$tokenRecord) {
            recordSecurityEvent('VERIFICATION_ATTEMPT_FAILED', 'warning', null, "Invalid verification token hash attempted");
            respondJson(['success' => false, 'error' => 'Invalid verification token. Please check the link or paste a valid token.'], 400);
        }

        $userId = $tokenRecord['user_id'];

        $uStmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $targetUser = $uStmt->fetch();

        if (!$targetUser) {
            respondJson(['success' => false, 'error' => 'Associated user account not found.'], 404);
        }

        // Already verified check
        if ((int)$targetUser['email_verified'] === 1) {
            respondJson([
                'success' => true,
                'alreadyVerified' => true,
                'message' => 'Your email address has already been verified. You can sign in now.'
            ]);
        }

        // Check token expiration
        if (strtotime($tokenRecord['expires_at']) < time()) {
            recordSecurityEvent('VERIFICATION_TOKEN_EXPIRED', 'warning', $userId, "Expired token attempted for user {$targetUser['email']}");
            respondJson([
                'success' => false,
                'expired' => true,
                'error' => 'Your verification link has expired. Please request a new verification email.'
            ], 400);
        }

        // Mark token as used
        $db->prepare("UPDATE verification_tokens SET used = 1 WHERE id = ?")->execute([$tokenRecord['id']]);

        // Invalidate any other open tokens for this user
        $db->prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND id != ?")->execute([$userId, $tokenRecord['id']]);

        // Mark user email verified
        $newAuthVersion = (int)($targetUser['auth_version'] ?? 1) + 1;
        $db->prepare("
            UPDATE users SET
                email_verified = 1,
                email_verified_at = CURRENT_TIMESTAMP,
                account_status = 'active',
                auth_version = ?,
                verification_token_hash = NULL,
                verification_token_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ")->execute([$newAuthVersion, $userId]);

        // Security & Audit log
        recordSecurityEvent('EMAIL_VERIFIED', 'info', $userId, "Email verified successfully for {$targetUser['email']}");
        logAdminAction($userId, $targetUser['email'], 'EMAIL_VERIFIED', $userId, "User email verified via token");

        // Publish real-time event for connected clients (Web + Desktop)
        publishRealtimeEvent($db, $userId, 'user.email_verified', [
            'type' => 'user.email_verified',
            'userId' => $userId,
            'email' => $targetUser['email'],
            'version' => $newAuthVersion,
            'timestamp' => date('c')
        ], null, $newAuthVersion);

        // Send confirmation email
        @sendAccountVerifiedConfirmationPhp($targetUser['name'], $targetUser['email'], $userId);

        // Generate session token
        $sessionToken = createSessionToken($userId);
        $permissions = resolveUserPermissions($targetUser['role'] ?? 'user', $targetUser['permissions'] ?? null);

        respondJson([
            'success' => true,
            'sessionToken' => $sessionToken,
            'user' => [
                'id' => $targetUser['id'],
                'name' => $targetUser['name'],
                'email' => $targetUser['email'],
                'role' => $targetUser['role'],
                'permissions' => $permissions,
                'authVersion' => $newAuthVersion,
                'emailVerified' => true,
                'accountStatus' => 'active',
                'createdAt' => $targetUser['created_at'],
                'lastLoginAt' => date('c')
            ],
            'authorization' => [
                'role' => $targetUser['role'],
                'permissions' => $permissions,
                'authVersion' => $newAuthVersion,
                'accountStatus' => 'active',
                'isAuthorized' => true
            ],
            'message' => 'Email verified successfully! Welcome to ProfileVault.'
        ]);
        break;

    // ── 3.8. Get Email Verification Status ──
    case 'verification-status':
        $email = trim($_GET['email'] ?? '');
        $token = getBearerToken();
        $user = null;

        if ($token) {
            $user = getAuthenticatedUser();
        } elseif ($email) {
            $uStmt = $db->prepare("SELECT id, email, email_verified, email_verified_at, account_status FROM users WHERE LOWER(email) = LOWER(?)");
            $uStmt->execute([$email]);
            $user = $uStmt->fetch();
        }

        if (!$user) {
            respondJson(['success' => false, 'error' => 'User not found.'], 404);
        }

        respondJson([
            'success' => true,
            'email' => $user['email'],
            'emailVerified' => (bool)($user['email_verified'] ?? 0),
            'emailVerifiedAt' => $user['email_verified_at'] ?? null,
            'accountStatus' => $user['account_status'] ?? 'pending'
        ]);
        break;

    // ── 5. User Update Profile (Editable: Name, Phone, Password ONLY) ──
    case 'update-profile':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        // Security Audit: Reject any attempts to mutate protected admin-controlled fields
        $protectedFields = [
            'role', 'account_status', 'subscription_plan', 'subscription_status',
            'subscription_expires_at', 'profile_limit', 'device_limit', 'expires_at',
            'permissions', 'download_urls', 'application_versions'
        ];

        foreach ($protectedFields as $pf) {
            if (isset($input[$pf])) {
                respondJson([
                    'success' => false,
                    'error' => "Access denied. Protected field ('$pf') cannot be modified by user."
                ], 403);
            }
        }

        $name = trim($input['name'] ?? $user['name']);
        $phone = trim($input['phone'] ?? '');
        $currentPassword = $input['currentPassword'] ?? null;
        $newPassword = $input['newPassword'] ?? null;

        if ($newPassword) {
            if (!$currentPassword || !verifyUserPassword($currentPassword, $user['password_hash'])) {
                respondJson(['success' => false, 'error' => 'Current password is incorrect.'], 400);
            }
            if (strlen($newPassword) < 6) {
                respondJson(['success' => false, 'error' => 'New password must be at least 6 characters.'], 400);
            }
            $passwordHash = hashUserPassword($newPassword);
            $stmt = $db->prepare("UPDATE users SET name = ?, password_hash = ? WHERE id = ?");
            $stmt->execute([$name, $passwordHash, $user['id']]);
        } else {
            $stmt = $db->prepare("UPDATE users SET name = ? WHERE id = ?");
            $stmt->execute([$name, $user['id']]);
        }

        $stmt = $db->prepare("SELECT id, name, email, role, email_verified, account_status, created_at, last_login_at FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $updatedUser = $stmt->fetch();

        respondJson([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => $updatedUser
        ]);
        break;

    // ── 7. Forgot Password / Request Password Reset Link ──
    case 'forgot-password':
    case 'request-password-reset':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $email = trim($input['email'] ?? '');

        // Validate Captcha
        $captchaToken = $input['captcha_token'] ?? $input['captchaToken'] ?? $_POST['captcha_token'] ?? null;
        $cRes = verifyCaptchaTokenPhp($captchaToken, 'reset');
        if (!$cRes['success']) {
            respondJson(['success' => false, 'error' => $cRes['error'] ?? 'Captcha verification failed.'], 400);
        }

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondJson(['success' => false, 'error' => 'Please provide a valid email address.'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            respondJson([
                'success' => true,
                'message' => 'If an account exists with this email, a password reset link has been dispatched.'
            ]);
        }

        if ($user['account_status'] === 'suspended') {
            respondJson(['success' => false, 'error' => 'This account is suspended. Please contact customer support.'], 403);
        }

        // Send Password Reset Email
        $resetResult = sendPasswordResetEmailPhp($user['id'], $user['name'] ?? 'User', $user['email']);

        recordSecurityEvent('PASSWORD_RESET_REQUESTED', 'info', $user['id'], "Password reset requested for {$email}");

        respondJson([
            'success' => true,
            'message' => 'A password reset link has been sent to your email address.',
            'email' => $user['email'],
            'sentViaSmtp' => $resetResult['sentViaSmtp'] ?? false
        ]);
        break;

    // ── 8. Validate Password Reset Token ──
    case 'validate-reset-token':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_GET;
        $token = trim($input['token'] ?? '');

        if (!$token) {
            respondJson(['success' => false, 'error' => 'Token is required.'], 400);
        }

        $tokenHash = hash('sha256', $token);
        $stmt = $db->prepare("
            SELECT pr.*, u.name, u.email, u.account_status
            FROM password_resets pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.token_hash = ? AND pr.used = 0 AND pr.expires_at > NOW()
            ORDER BY pr.created_at DESC LIMIT 1
        ");
        $stmt->execute([$tokenHash]);
        $resetRecord = $stmt->fetch();

        if (!$resetRecord) {
            respondJson(['success' => false, 'valid' => false, 'error' => 'This password reset link is invalid or has expired.'], 400);
        }

        respondJson([
            'success' => true,
            'valid' => true,
            'email' => $resetRecord['email'],
            'userName' => $resetRecord['name']
        ]);
        break;

    // ── 9. Reset Password / Confirm Password Reset ──
    case 'reset-password':
    case 'confirm-password-reset':
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $token = trim($input['token'] ?? '');
        $newPassword = $input['new_password'] ?? $input['newPassword'] ?? $input['password'] ?? '';

        if (!$token) {
            respondJson(['success' => false, 'error' => 'Reset token is required.'], 400);
        }

        if (!$newPassword || strlen($newPassword) < 6) {
            respondJson(['success' => false, 'error' => 'New password must be at least 6 characters long.'], 400);
        }

        $tokenHash = hash('sha256', $token);
        $stmt = $db->prepare("
            SELECT pr.*, u.name, u.email, u.account_status
            FROM password_resets pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.token_hash = ? AND pr.used = 0 AND pr.expires_at > NOW()
            ORDER BY pr.created_at DESC LIMIT 1
        ");
        $stmt->execute([$tokenHash]);
        $resetRecord = $stmt->fetch();

        if (!$resetRecord) {
            respondJson(['success' => false, 'error' => 'This password reset link is invalid or has expired. Please request a new one.'], 400);
        }

        $userId = $resetRecord['user_id'];
        $newHash = hashUserPassword($newPassword);

        // Update password, increment auth_version to invalidate old sessions, clear reset token
        $updUser = $db->prepare("
            UPDATE users SET
                password_hash = ?,
                auth_version = COALESCE(auth_version, 1) + 1,
                reset_token_hash = NULL,
                reset_token_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $updUser->execute([$newHash, $userId]);

        // Mark token as used
        $markUsed = $db->prepare("UPDATE password_resets SET used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?");
        $markUsed->execute([$resetRecord['id']]);

        // Send confirmation email
        try {
            sendPasswordChangedNotificationPhp($resetRecord['name'] ?? 'User', $resetRecord['email'], $userId);
        } catch (Throwable $e) {}

        recordSecurityEvent('PASSWORD_RESET_SUCCESSFUL', 'info', $userId, "Password reset successfully completed for {$resetRecord['email']}");

        respondJson([
            'success' => true,
            'message' => 'Password reset successfully! You can now log in with your new password.'
        ]);
        break;

    default:
        respondJson(['success' => false, 'error' => 'Invalid auth endpoint action.'], 404);
}
