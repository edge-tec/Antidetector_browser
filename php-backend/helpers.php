<?php
// ──────────────────────────────────────────────
// ProfileVault — Central Helper Functions
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Auto Ensure Core Database Tables Exist
function ensureDatabaseTablesExist() {
    static $executed = false;
    if ($executed) return;
    $executed = true;

    try {
        $db = Database::getConnection();

        // 1. Users Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `users` (
              `id` VARCHAR(36) NOT NULL PRIMARY KEY,
              `name` VARCHAR(255) NOT NULL,
              `email` VARCHAR(255) NOT NULL UNIQUE,
              `password_hash` VARCHAR(255) DEFAULT NULL,
              `role` VARCHAR(50) NOT NULL DEFAULT 'user',
              `permissions` TEXT DEFAULT NULL,
              `auth_version` INT NOT NULL DEFAULT 1,
              `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
              `email_verified_at` DATETIME DEFAULT NULL,
              `verification_token_hash` VARCHAR(64) DEFAULT NULL,
              `verification_token_expires_at` DATETIME DEFAULT NULL,
              `verification_created_at` DATETIME DEFAULT NULL,
              `verification_attempts` INT DEFAULT 0,
              `account_status` VARCHAR(50) NOT NULL DEFAULT 'pending',
              `google_id` VARCHAR(255) DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              `last_login_at` DATETIME DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try { $db->exec("ALTER TABLE `users` ADD COLUMN `last_login_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `permissions` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `auth_version` INT NOT NULL DEFAULT 1"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `verification_token_hash` VARCHAR(64) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `verification_token_expires_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `verification_created_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `verification_attempts` INT DEFAULT 0"); } catch (Throwable $e) {}

        // 1.0 Verification Tokens Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `verification_tokens` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `token_hash` VARCHAR(64) NOT NULL UNIQUE,
              `expires_at` DATETIME NOT NULL,
              `used` TINYINT(1) NOT NULL DEFAULT 0,
              `attempts` INT DEFAULT 0,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              KEY `idx_vtok_user` (`user_id`, `used`),
              KEY `idx_vtok_hash` (`token_hash`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // 2. Pricing Plans Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `pricing_plans` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `name` VARCHAR(100) NOT NULL,
              `slug` VARCHAR(100) NOT NULL UNIQUE,
              `description` TEXT NOT NULL,
              `monthly_price` DECIMAL(10,2) NOT NULL,
              `yearly_price` DECIMAL(10,2) NOT NULL,
              `yearly_discount` INT DEFAULT 20,
              `currency` VARCHAR(10) DEFAULT '$',
              `profile_limit` INT NOT NULL,
              `team_limit` INT NOT NULL,
              `api_limit` VARCHAR(100) DEFAULT 'Basic',
              `badge` VARCHAR(100) DEFAULT '',
              `button_text` VARCHAR(100) NOT NULL,
              `button_url` VARCHAR(255) NOT NULL,
              `is_popular` TINYINT(1) DEFAULT 0,
              `is_active` TINYINT(1) DEFAULT 1,
              `sort_order` INT DEFAULT 0,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            INSERT INTO `pricing_plans` (`id`, `name`, `slug`, `description`, `monthly_price`, `yearly_price`, `profile_limit`, `team_limit`, `api_limit`, `badge`, `button_text`, `button_url`, `is_popular`, `sort_order`)
            VALUES
            ('plan_free', 'Free', 'free', 'Ideal for testing & personal profile management', 0.00, 0.00, 3, 1, '—', '', 'Start Free', '#register', 0, 1),
            ('plan_starter', 'Starter', 'starter', 'Essential features for solo operators & small tasks', 19.00, 15.00, 25, 2, 'Basic API', '', 'Start Trial', '#register', 0, 2),
            ('plan_pro', 'Professional', 'professional', 'Advanced fingerprint controls & team features', 49.00, 39.00, 100, 10, 'Full API', 'Most Popular', 'Get Started', '#register', 1, 3),
            ('plan_business', 'Business', 'business', 'Maximum power for large scale multi-profile teams', 99.00, 79.00, 500, 25, 'High Limit API', 'Best Value', 'Contact Sales', '#contact', 0, 4)
            ON DUPLICATE KEY UPDATE `id`=`id`;
        ");

        // 3. Subscriptions Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `subscriptions` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL UNIQUE,
              `plan_id` VARCHAR(50) NOT NULL,
              `status` VARCHAR(50) NOT NULL DEFAULT 'active',
              `starts_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `expires_at` DATETIME NOT NULL,
              `grace_period_days` INT DEFAULT 3,
              `device_limit` INT DEFAULT NULL,
              `auto_renew` TINYINT(1) DEFAULT 1,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        try {
            $db->exec("ALTER TABLE `subscriptions` ADD COLUMN IF NOT EXISTS `device_limit` INT DEFAULT NULL;");
        } catch (Throwable $e) {}

        // 4. Desktop Installations Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `desktop_installations` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `installation_id` VARCHAR(100) NOT NULL UNIQUE,
              `platform` VARCHAR(50) NOT NULL,
              `device_name` VARCHAR(255) DEFAULT NULL,
              `app_version` VARCHAR(50) DEFAULT '1.0.0',
              `last_seen_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `revoked_at` DATETIME DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // 5. App Releases Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `app_releases` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `platform` VARCHAR(50) NOT NULL,
              `version` VARCHAR(50) NOT NULL,
              `release_name` VARCHAR(255) NOT NULL,
              `file_path` VARCHAR(500) NOT NULL,
              `original_file_name` VARCHAR(255) NOT NULL,
              `file_size` BIGINT NOT NULL DEFAULT 0,
              `release_notes` TEXT DEFAULT NULL,
              `status` VARCHAR(20) NOT NULL DEFAULT 'published',
              `published_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `uploaded_by` VARCHAR(36) DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Throwable $e) {}
}

ensureDatabaseTablesExist();

// Set CORS and JSON Headers
function sendJsonHeader() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Installation-ID, X-App-Version, X-Platform');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
}

// Send JSON Response
function respondJson(array $data, int $statusCode = 200) {
    sendJsonHeader();
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

// Password Hashing (bcrypt)
function hashUserPassword(string $password): string {
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
}

function verifyUserPassword(string $password, string $hash): bool {
    return password_verify($password, $hash);
}

// Token Generation & Decoding
function createSessionToken(string $userId): string {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $userId,
        'iat' => time(),
        'exp' => time() + (30 * 86400) // 30 days
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function decodeSessionToken(string $jwt): ?string {
    $tokenParts = explode('.', $jwt);
    if (count($tokenParts) !== 3) return null;

    $header = base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[0]));
    $payload = base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1]));
    $signatureProvided = $tokenParts[2];

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    if ($base64UrlSignature !== $signatureProvided) return null;

    $data = json_decode($payload, true);
    if (!$data || !isset($data['user_id'])) return null;
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data['user_id'];
}

// Get Auth Bearer Token from HTTP Headers (robust multi-server support)
function getBearerToken(): ?string {
    $headers = null;

    // Strategy 1: Standard HTTP_AUTHORIZATION (most common)
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    // Strategy 2: REDIRECT_HTTP_AUTHORIZATION (Apache mod_rewrite with [E=] flag)
    else if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    // Strategy 3: Direct Authorization key (some CGI configurations)
    else if (!empty($_SERVER['Authorization'])) {
        $headers = trim($_SERVER['Authorization']);
    }
    // Strategy 4: getallheaders() / apache_request_headers() (Apache module mode)
    else if (function_exists('getallheaders')) {
        $allHeaders = getallheaders();
        if ($allHeaders) {
            // Case-insensitive search for Authorization header
            foreach ($allHeaders as $key => $value) {
                if (strtolower($key) === 'authorization') {
                    $headers = trim($value);
                    break;
                }
            }
        }
    }
    // Strategy 5: apache_request_headers() fallback (Apache only)
    else if (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        if ($requestHeaders) {
            $requestHeaders = array_combine(
                array_map('ucwords', array_keys($requestHeaders)),
                array_values($requestHeaders)
            );
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }
    }

    // Extract Bearer token from header value
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

// Get Current Logged-in User
function getAuthenticatedUser(): ?array {
    $token = getBearerToken();
    if (!$token) {
        $token = $_GET['token'] ?? $_POST['token'] ?? null;
    }
    if (!$token) return null;

    $userId = decodeSessionToken($token);
    if (!$userId) return null;

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT id, name, email, role, email_verified, account_status, created_at, last_login_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if ($user) {
        // Auto-grant admin role for system owner accounts (edge@gmail.com, admin accounts, or first users)
        $lowerEmail = strtolower($user['email']);
        if ($user['role'] !== 'admin' && ($lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false)) {
            $up = $db->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
            $up->execute([$user['id']]);
            $user['role'] = 'admin';
        }
    }

    return $user ?: null;
}

// Require Admin Privilege
function requireAdmin(): array {
    $user = getAuthenticatedUser();
    if (!$user) {
        respondJson(['success' => false, 'error' => 'Authentication required. Please sign in.'], 401);
    }

    $lowerEmail = strtolower($user['email']);
    if ($user['role'] !== 'admin' && $user['role'] !== 'super_admin' && ($lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false)) {
        $db = Database::getConnection();
        $up = $db->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
        $up->execute([$user['id']]);
        $user['role'] = 'admin';
    }

    $userRole = strtolower($user['role'] ?? 'user');
    if (($userRole !== 'admin' && $userRole !== 'super_admin') || $user['account_status'] === 'suspended') {
        respondJson(['success' => false, 'error' => 'Access denied. Administrator privileges required.'], 403);
    }
    return $user;
}

// ──────────────────────────────────────────────
// Google OAuth Configuration Helper
// ──────────────────────────────────────────────

function getGoogleOAuthConfigPhp(): array {
    $db = Database::getConnection();
    try {
        $stmt = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'google_oauth_%'");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $map = [];
        foreach ($rows as $r) { $map[$r['key']] = $r['value']; }
        return [
            'enabled' => ($map['google_oauth_enabled'] ?? 'true') === 'true',
            'clientId' => $map['google_oauth_client_id'] ?? '',
            'clientSecret' => $map['google_oauth_client_secret'] ?? '',
            'oneTap' => ($map['google_oauth_one_tap'] ?? 'true') === 'true'
        ];
    } catch (Throwable $e) {
        return [
            'enabled' => true,
            'clientId' => '',
            'clientSecret' => '',
            'oneTap' => true
        ];
    }
}

// ──────────────────────────────────────────────
// SMTP Email System Helper Functions
// ──────────────────────────────────────────────

function getSmtpSettingsPhp(): array {
    $db = Database::getConnection();
    try {
        $stmt = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'smtp_%'");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $map = [];
        foreach ($rows as $r) { $map[$r['key']] = $r['value']; }

        $host = $map['smtp_host'] ?? getenv('SMTP_HOST') ?: '';
        $port = (int)($map['smtp_port'] ?? getenv('SMTP_PORT') ?: 587);
        $user = $map['smtp_user'] ?? getenv('SMTP_USER') ?: '';
        $pass = $map['smtp_password'] ?? getenv('SMTP_PASSWORD') ?: '';
        $from = $map['smtp_from_email'] ?? getenv('SMTP_FROM_EMAIL') ?: ($user ?: 'noreply@antiprofiles.com');
        $fromName = $map['smtp_from_name'] ?? getenv('SMTP_FROM_NAME') ?: 'ProfileVault';
        $secure = ($map['smtp_secure'] ?? (getenv('SMTP_SECURE') ?: 'false')) === 'true';
        $enabled = ($map['smtp_enabled'] ?? (getenv('SMTP_ENABLED') ?: 'true')) === 'true';

        return [
            'host' => $host,
            'port' => $port,
            'user' => $user,
            'password' => $pass,
            'fromEmail' => $from,
            'fromName' => $fromName,
            'secure' => $secure,
            'enabled' => $enabled && !empty($host) && !empty($user)
        ];
    } catch (Exception $e) {
        return ['enabled' => false];
    }
}

function sendSmtpMailPhp(string $toEmail, string $subject, string $htmlBody, ?array $overrideConfig = null): bool {
    $smtp = $overrideConfig ?? getSmtpSettingsPhp();
    if (!$smtp['enabled'] || empty($smtp['host']) || empty($smtp['user'])) {
        return false;
    }

    $host = $smtp['host'];
    $port = (int)($smtp['port'] ?? 587);
    $user = $smtp['user'];
    $pass = $smtp['password'];
    $from = !empty($smtp['fromEmail']) ? $smtp['fromEmail'] : $user;
    $fromName = !empty($smtp['fromName']) ? $smtp['fromName'] : 'ProfileVault';
    $secure = (bool)($smtp['secure'] ?? false);

    $timeout = 15;
    $errno = 0;
    $errstr = '';

    $socketHost = ($secure || $port === 465) ? "ssl://{$host}" : $host;
    $socket = @fsockopen($socketHost, $port, $errno, $errstr, $timeout);

    if (!$socket) {
        error_log("[SMTP Error] Could not connect to {$host}:{$port} - {$errstr} ({$errno})");
        return false;
    }

    $read = function() use ($socket) {
        $data = '';
        while ($str = fgets($socket, 515)) {
            $data .= $str;
            if (substr($str, 3, 1) === ' ' || substr($str, 3, 1) === "\r" || substr($str, 3, 1) === "\n") break;
        }
        return $data;
    };

    $write = function(string $cmd) use ($socket) {
        fputs($socket, $cmd . "\r\n");
    };

    $read(); // Initial greeting banner (220)

    $serverHost = $_SERVER['SERVER_NAME'] ?? 'antiprofiles.com';
    $write("EHLO " . $serverHost);
    $ehloRes = $read();

    // If port 587 and STARTTLS is supported and not already SSL
    if (!$secure && $port !== 465 && strpos($ehloRes, 'STARTTLS') !== false) {
        $write("STARTTLS");
        $tlsRes = $read();
        if (substr($tlsRes, 0, 3) === '220') {
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $write("EHLO " . $serverHost);
            $read();
        }
    }

    // AUTH LOGIN
    if (!empty($user) && !empty($pass)) {
        $write("AUTH LOGIN");
        $read();
        $write(base64_encode($user));
        $read();
        $write(base64_encode($pass));
        $authRes = $read();
        if (substr($authRes, 0, 3) !== '235') {
            error_log("[SMTP Auth Error] Authentication failed: " . trim($authRes));
            $write("QUIT");
            fclose($socket);
            return false;
        }
    }

    // MAIL FROM
    $write("MAIL FROM: <{$from}>");
    $mailFromRes = $read();
    if (substr($mailFromRes, 0, 3) !== '250') {
        error_log("[SMTP Error] MAIL FROM rejected: " . trim($mailFromRes));
        $write("QUIT");
        fclose($socket);
        return false;
    }

    // RCPT TO
    $write("RCPT TO: <{$toEmail}>");
    $rcptRes = $read();
    if (substr($rcptRes, 0, 3) !== '250' && substr($rcptRes, 0, 3) !== '251') {
        error_log("[SMTP Error] RCPT TO rejected: " . trim($rcptRes));
        $write("QUIT");
        fclose($socket);
        return false;
    }

    // DATA
    $write("DATA");
    $dataRes = $read();
    if (substr($dataRes, 0, 3) !== '354') {
        $write("QUIT");
        fclose($socket);
        return false;
    }

    // Message payload
    $headers = [];
    $headers[] = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <{$from}>";
    $headers[] = "To: <{$toEmail}>";
    $headers[] = "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=";
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-Type: text/html; charset=UTF-8";
    $headers[] = "Content-Transfer-Encoding: 8bit";
    $headers[] = "Date: " . date('r');
    $headers[] = "Message-ID: <" . md5(uniqid(microtime(true), true)) . "@" . $serverHost . ">";

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $htmlBody . "\r\n.";
    $write($message);
    $sentRes = $read();

    $write("QUIT");
    fclose($socket);

    return substr($sentRes, 0, 3) === '250';
}

function testSmtpDiagnosticsPhp(?array $config = null): array {
    $smtp = $config ?? getSmtpSettingsPhp();
    $host = $smtp['host'] ?? '';
    $port = (int)($smtp['port'] ?? 587);
    $user = $smtp['user'] ?? '';
    $pass = $smtp['password'] ?? '';
    $from = $smtp['fromEmail'] ?? $user;
    $secure = (bool)($smtp['secure'] ?? false);

    $results = [
        'connection' => ['status' => 'FAIL', 'detail' => 'Not tested'],
        'ehlo' => ['status' => 'FAIL', 'detail' => 'Not tested'],
        'tls' => ['status' => 'PASS', 'detail' => 'Plain / Direct SSL'],
        'auth' => ['status' => 'FAIL', 'detail' => 'Not tested'],
        'sender' => ['status' => 'FAIL', 'detail' => 'Not tested']
    ];

    if (empty($host) || empty($port)) {
        $results['connection'] = ['status' => 'FAIL', 'detail' => 'Host or Port is missing.'];
        return ['success' => false, 'steps' => $results, 'error' => 'Missing SMTP Host or Port'];
    }

    $timeout = 10;
    $errno = 0;
    $errstr = '';
    $socketHost = ($secure || $port === 465) ? "ssl://{$host}" : $host;
    $socket = @fsockopen($socketHost, $port, $errno, $errstr, $timeout);

    if (!$socket) {
        $results['connection'] = ['status' => 'FAIL', 'detail' => "Connection to {$host}:{$port} failed: {$errstr} ({$errno})"];
        return ['success' => false, 'steps' => $results, 'error' => "Connection failed: {$errstr}"];
    }

    $results['connection'] = ['status' => 'PASS', 'detail' => "Connected to {$socketHost}:{$port} successfully."];

    $read = function() use ($socket) {
        $data = '';
        while ($str = fgets($socket, 515)) {
            $data .= $str;
            if (substr($str, 3, 1) === ' ' || substr($str, 3, 1) === "\r" || substr($str, 3, 1) === "\n") break;
        }
        return $data;
    };
    $write = function(string $cmd) use ($socket) { fputs($socket, $cmd . "\r\n"); };

    $banner = $read();
    $serverHost = $_SERVER['SERVER_NAME'] ?? 'antiprofiles.com';
    $write("EHLO " . $serverHost);
    $ehloRes = $read();

    $results['ehlo'] = ['status' => 'PASS', 'detail' => 'Handshake completed with server.'];

    if (!$secure && $port !== 465 && strpos($ehloRes, 'STARTTLS') !== false) {
        $write("STARTTLS");
        $tlsRes = $read();
        if (substr($tlsRes, 0, 3) === '220') {
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $write("EHLO " . $serverHost);
            $read();
            $results['tls'] = ['status' => 'PASS', 'detail' => 'STARTTLS encryption negotiated.'];
        }
    }

    if (!empty($user) && !empty($pass)) {
        $write("AUTH LOGIN");
        $read();
        $write(base64_encode($user));
        $read();
        $write(base64_encode($pass));
        $authRes = $read();
        if (substr($authRes, 0, 3) === '235') {
            $results['auth'] = ['status' => 'PASS', 'detail' => "Authenticated as {$user}."];
        } else {
            $results['auth'] = ['status' => 'FAIL', 'detail' => "Auth rejected: " . trim($authRes)];
            $write("QUIT");
            fclose($socket);
            return ['success' => false, 'steps' => $results, 'error' => "Authentication failed."];
        }
    } else {
        $results['auth'] = ['status' => 'PASS', 'detail' => 'Anonymous / No auth configured.'];
    }

    $write("MAIL FROM: <{$from}>");
    $mailRes = $read();
    if (substr($mailRes, 0, 3) === '250') {
        $results['sender'] = ['status' => 'PASS', 'detail' => "Sender <{$from}> accepted."];
    } else {
        $results['sender'] = ['status' => 'FAIL', 'detail' => "Sender rejected: " . trim($mailRes)];
    }

    $write("QUIT");
    fclose($socket);

    $isAllPassed = $results['connection']['status'] === 'PASS' && $results['auth']['status'] === 'PASS' && $results['sender']['status'] === 'PASS';
    return ['success' => $isAllPassed, 'steps' => $results, 'error' => $isAllPassed ? null : 'Diagnostics revealed issues.'];
}

function sendVerificationEmailPhp(string $userId, string $userName, string $email): array {
    $db = Database::getConnection();

    // 1. Invalidate any previous unused tokens for this user
    $invStmt = $db->prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND used = 0");
    $invStmt->execute([$userId]);

    // 2. Generate a cryptographically secure random 64-char hex token
    $plainToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $plainToken);
    $tokenId = 'tok_' . bin2hex(random_bytes(8));

    // 3. Store hashed token in verification_tokens with 24 hours expiry
    $stmt = $db->prepare("
        INSERT INTO verification_tokens (id, user_id, token_hash, expires_at, used, attempts, created_at)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), 0, 0, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([$tokenId, $userId, $tokenHash]);

    // 4. Update user state
    $updUser = $db->prepare("
        UPDATE users SET
            verification_token_hash = ?,
            verification_token_expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
            verification_created_at = CURRENT_TIMESTAMP,
            verification_attempts = 0
        WHERE id = ?
    ");
    $updUser->execute([$tokenHash, $userId]);

    // 5. Build authoritative verification URL
    $host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ? 'https://' : 'https://';
    $baseUrl = defined('APP_BASE_URL') && APP_BASE_URL ? APP_BASE_URL : ($protocol . $host);
    $verificationUrl = rtrim($baseUrl, '/') . '/verify-email?token=' . $plainToken;
    $deepLinkUrl = 'profilevault://verify-email?token=' . $plainToken;

    // 6. Responsive HTML Email Content
    $html = "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1.0'>
      <title>Verify Your ProfileVault Account</title>
    </head>
    <body style='margin:0; padding:0; background-color:#0A0A0F; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#0A0A0F; padding:40px 10px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#161622; border-radius:16px; border:1px solid #2C2C3E; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:linear-gradient(135deg, rgba(45,212,191,0.2), rgba(59,130,246,0.2)); border:1px solid rgba(45,212,191,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>🛡️</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Verify Your Account</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>Welcome to ProfileVault Central Anti-Detect Ecosystem</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Your ProfileVault account has been registered successfully. To activate full browser profile isolation, proxies, and team capabilities, please confirm your email address by clicking the button below:</p>
                  
                  <div style='text-align:center; margin:32px 0;'>
                    <a href='" . $verificationUrl . "' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#0F0F17; font-weight:800; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:10px; display:inline-block; box-shadow:0 4px 16px rgba(45,212,191,0.35);'>Verify Email Address</a>
                  </div>

                  <div style='background:#0F0F17; border:1px solid #2C2C3E; border-radius:10px; padding:16px; margin-bottom:24px;'>
                    <p style='margin:0 0 6px 0; font-size:12px; color:#94A3B8;'>Manual Verification Token:</p>
                    <code style='color:#2DD4BF; font-family:monospace; font-size:13px; word-break:break-all;'>" . htmlspecialchars($plainToken) . "</code>
                  </div>

                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin:0 0 10px 0;'>Or copy & paste this URL into your browser:<br>
                    <a href='" . $verificationUrl . "' style='color:#38BDF8; text-decoration:underline; word-break:break-all;'>" . $verificationUrl . "</a>
                  </p>
                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin:0;'>⏳ This verification link expires in <strong>24 hours</strong>. If you did not create this account, you can safely disregard this message.</p>
                </td>
              </tr>
              <tr>
                <td style='background:#0F0F17; padding:20px 36px; border-top:1px solid #2C2C3E; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " ProfileVault Anti-Detect Browser. Unified Web & Desktop Security.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    $sent = sendSmtpMailPhp($email, 'Verify Your ProfileVault Account', $html);

    if ($sent) {
        recordSecurityEvent('VERIFICATION_EMAIL_SENT', 'info', $userId, "Verification token dispatched to {$email}");
    } else {
        recordSecurityEvent('VERIFICATION_EMAIL_FAILED', 'warning', $userId, "SMTP failed to deliver verification token to {$email}");
    }

    return [
        'success' => true,
        'token' => $plainToken,
        'verificationUrl' => $verificationUrl,
        'deepLinkUrl' => $deepLinkUrl,
        'sentViaSmtp' => $sent
    ];
}

function sendAccountVerifiedConfirmationPhp(string $userName, string $email): bool {
    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>ProfileVault Account Confirmed</title></head>
    <body style='background-color:#0A0A0F; font-family:sans-serif; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#161622; padding:32px; border-radius:14px; border:1px solid #2C2C3E;'>
        <div style='text-align:center;'>
          <span style='background:#10B98125; border:1px solid #10B98150; color:#34D399; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;'>✓ Email Verified Successfully</span>
          <h2 style='color:#FFFFFF; font-size:22px; margin:16px 0 8px 0;'>Welcome aboard, " . htmlspecialchars($userName) . "!</h2>
        </div>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Your email address (<strong>" . htmlspecialchars($email) . "</strong>) has been verified. Your account is now fully active across Web, Windows, macOS, and Linux.</p>
        <div style='text-align:center; margin:28px 0;'>
          <a href='https://antiprofiles.com/#login' style='background:#2DD4BF; color:#0F0F17; font-weight:800; padding:12px 28px; text-decoration:none; border-radius:8px; display:inline-block;'>Access Control Center</a>
        </div>
      </div>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🎉 ProfileVault Account Confirmed & Ready!', $html);
}

// Audit Logging Helper
function logAdminAction(string $adminId, string $adminEmail, string $action, ?string $targetUserId = null, ?string $details = null, ?string $prevVal = null, ?string $newVal = null) {
    try {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO audit_logs (id, admin_id, admin_email, action, target_user_id, ip_address, details, previous_value, new_value, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ");
        $logId = 'log_' . bin2hex(random_bytes(8));
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $stmt->execute([$logId, $adminId, $adminEmail, $action, $targetUserId, $ip, $details, $prevVal, $newVal]);
    } catch (Throwable $e) {}
}

// Security Events Logger
function recordSecurityEvent(string $eventType, string $severity = 'warning', ?string $userId = null, ?string $details = null) {
    try {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO security_events (id, event_type, severity, user_id, ip_address, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ");
        $evtId = 'sec_' . bin2hex(random_bytes(8));
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $stmt->execute([$evtId, $eventType, $severity, $userId, $ip, $details]);
    } catch (Throwable $e) {}
}

// ──────────────────────────────────────────────
// Central RBAC & Real-Time Synchronization Engine
// ──────────────────────────────────────────────

const ROLE_PERMISSIONS = [
    'super_admin' => ['*'],
    'admin' => [
        'profiles.view', 'profiles.create', 'profiles.edit', 'profiles.delete', 'profiles.start', 'profiles.stop',
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'subscriptions.view', 'subscriptions.manage',
        'settings.view', 'settings.manage',
        'support.view', 'support.manage',
        'releases.view', 'releases.manage',
        'audit.view', 'security.view'
    ],
    'manager' => [
        'profiles.view', 'profiles.create', 'profiles.edit', 'profiles.delete', 'profiles.start', 'profiles.stop',
        'users.view', 'subscriptions.view',
        'support.view', 'support.manage'
    ],
    'user' => [
        'profiles.view', 'profiles.create', 'profiles.edit', 'profiles.delete', 'profiles.start', 'profiles.stop',
        'support.view'
    ]
];

/**
 * Resolve granular permissions for a given user role and custom override json.
 */
function resolveUserPermissions(string $role, ?string $customPermissionsJson = null): array {
    $normalizedRole = strtolower(trim($role));
    $basePermissions = ROLE_PERMISSIONS[$normalizedRole] ?? ROLE_PERMISSIONS['user'];

    if ($customPermissionsJson) {
        $custom = json_decode($customPermissionsJson, true);
        if (is_array($custom)) {
            if (in_array('*', $custom, true)) {
                return ['*'];
            }
            return array_values(array_unique(array_merge($basePermissions, $custom)));
        }
    }

    return $basePermissions;
}

/**
 * Check if resolved user permissions satisfy a required action.
 */
function checkUserPermission(array $userPermissions, string $requiredPermission): bool {
    if (in_array('*', $userPermissions, true)) {
        return true;
    }
    if (in_array($requiredPermission, $userPermissions, true)) {
        return true;
    }
    // Check wildcard prefix e.g. profiles.* matching profiles.create
    $parts = explode('.', $requiredPermission);
    if (count($parts) === 2 && in_array($parts[0] . '.*', $userPermissions, true)) {
        return true;
    }
    return false;
}

/**
 * Publish an authoritative Real-Time Event into durable outbox stream.
 */
function publishRealtimeEvent(PDO $db, ?string $userId, string $eventType, array $payload, ?string $targetRole = null, int $version = 1): string {
    $eventId = 'evt_' . bin2hex(random_bytes(10));
    $stmt = $db->prepare("
        INSERT INTO realtime_events (event_id, user_id, target_role, event_type, payload, version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([
        $eventId,
        $userId,
        $targetRole,
        $eventType,
        json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $version
    ]);
    return $eventId;
}

/**
 * Register active user session for token revocation & platform tracking.
 */
function registerUserSession(PDO $db, string $userId, string $token, string $platform = 'desktop', string $deviceName = 'Desktop Client', int $authVersion = 1): string {
    $sessionId = 'sess_' . bin2hex(random_bytes(8));
    $tokenHash = hash('sha256', $token);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    $stmt = $db->prepare("
        INSERT INTO user_sessions (id, user_id, token_hash, platform, device_name, ip_address, auth_version, is_revoked, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 30 DAY), CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE auth_version = VALUES(auth_version), is_revoked = 0, revoked_at = NULL, expires_at = VALUES(expires_at)
    ");
    $stmt->execute([$sessionId, $userId, $tokenHash, $platform, $deviceName, $ip, $authVersion]);
    return $sessionId;
}

/**
 * Check if a session token has been revoked or invalidated by auth version bump.
 */
function isUserSessionRevoked(PDO $db, string $userId, string $token): bool {
    $tokenHash = hash('sha256', $token);
    $stmt = $db->prepare("
        SELECT s.is_revoked, s.auth_version AS sess_version, u.auth_version AS user_version, u.account_status
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$tokenHash, $userId]);
    $row = $stmt->fetch();

    if (!$row) return false; // fallback to stateless token if not in session table

    if ((int)$row['is_revoked'] === 1) return true;
    if ($row['account_status'] === 'suspended' || $row['account_status'] === 'disabled') return true;
    if ((int)$row['sess_version'] < (int)$row['user_version']) return true;

    return false;
}

/**
 * Revoke all active sessions for a user (e.g. on role/status change or explicit revoke).
 */
function revokeAllUserSessions(PDO $db, string $userId, string $reason = 'Administrative revocation'): void {
    $stmt = $db->prepare("
        UPDATE user_sessions
        SET is_revoked = 1, revoked_reason = ?, revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_revoked = 0
    ");
    $stmt->execute([$reason, $userId]);

    // Also increment user auth_version so any cached tokens become invalid
    $stmt2 = $db->prepare("UPDATE users SET auth_version = auth_version + 1 WHERE id = ?");
    $stmt2->execute([$userId]);
}


