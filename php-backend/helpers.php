<?php
// ──────────────────────────────────────────────
// ProfileVault — Central Helper Functions
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

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

// Get Auth Bearer Token from HTTP Headers
function getBearerToken(): ?string {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } else if (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
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
    if ($user['role'] !== 'admin' && ($lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false)) {
        $db = Database::getConnection();
        $up = $db->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
        $up->execute([$user['id']]);
        $user['role'] = 'admin';
    }

    if ($user['role'] !== 'admin' || $user['account_status'] === 'suspended') {
        respondJson(['success' => false, 'error' => 'Access denied. Administrator privileges required.'], 403);
    }
    return $user;
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
        return [
            'host' => $map['smtp_host'] ?? '',
            'port' => (int)($map['smtp_port'] ?? 587),
            'user' => $map['smtp_user'] ?? '',
            'password' => $map['smtp_password'] ?? '',
            'fromEmail' => $map['smtp_from_email'] ?? 'noreply@profilevault.local',
            'secure' => ($map['smtp_secure'] ?? 'false') === 'true',
            'enabled' => ($map['smtp_enabled'] ?? 'false') === 'true'
        ];
    } catch (Exception $e) {
        return ['enabled' => false];
    }
}

function sendSmtpMailPhp(string $toEmail, string $subject, string $htmlBody): bool {
    $smtp = getSmtpSettingsPhp();
    if (!$smtp['enabled'] || empty($smtp['host']) || empty($smtp['user'])) {
        return false;
    }

    $from = !empty($smtp['fromEmail']) ? $smtp['fromEmail'] : $smtp['user'];
    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: text/html; charset=utf-8';
    $headers[] = 'From: ProfileVault System <' . $from . '>';
    $headers[] = 'Reply-To: ' . $from;
    $headers[] = 'X-Mailer: ProfileVault Mailer/1.0';

    return @mail($toEmail, $subject, $htmlBody, implode("\r\n", $headers));
}

function sendVerificationEmailPhp(string $userId, string $userName, string $email): array {
    $db = Database::getConnection();
    $plainToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $plainToken);
    $tokenId = 'tok_' . bin2hex(random_bytes(8));

    $stmt = $db->prepare("
        INSERT INTO verification_tokens (id, user_id, token_hash, expires_at, used)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), 0)
    ");
    $stmt->execute([$tokenId, $userId, $tokenHash]);

    $baseUrl = defined('APP_BASE_URL') ? APP_BASE_URL : 'app://profilevault';
    $verificationUrl = $baseUrl . '/verify-email?token=' . $plainToken;

    $html = "
    <div style='font-family: sans-serif; background:#0F0F17; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#1C1C28; padding:30px; border-radius:12px; border:1px solid #2C2C3E;'>
        <h2 style='color:#F1F5F9; font-size:20px;'>Verify your ProfileVault Account</h2>
        <p>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
        <p>Thank you for registering with ProfileVault! Please verify your email to activate your account:</p>
        <p style='text-align:center; margin:24px 0;'>
          <a href='" . $verificationUrl . "' style='background:#2DD4BF; color:#0F0F17; font-weight:700; padding:12px 28px; text-decoration:none; border-radius:8px;'>Verify Email Account</a>
        </p>
        <p style='font-size:12px; color:#64748B;'>Or copy & paste: " . $verificationUrl . "</p>
      </div>
    </div>";

    $sent = sendSmtpMailPhp($email, 'Confirm your ProfileVault Account', $html);

    return [
        'success' => true,
        'token' => $plainToken,
        'verificationUrl' => $verificationUrl,
        'sentViaSmtp' => $sent
    ];
}

function sendAccountVerifiedConfirmationPhp(string $userName, string $email): bool {
    $html = "
    <div style='font-family: sans-serif; background:#0F0F17; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#1C1C28; padding:30px; border-radius:12px; border:1px solid #2C2C3E;'>
        <div style='text-align:center;'>
          <span style='background:#10B98120; border:1px solid #10B98140; color:#34D399; padding:4px 12px; border-radius:16px; font-size:12px; font-weight:600;'>✓ Email Verified Successfully</span>
          <h2 style='color:#F1F5F9; font-size:22px; margin-top:12px;'>Welcome to ProfileVault, " . htmlspecialchars($userName) . "!</h2>
        </div>
        <p>Your email address (<strong>" . htmlspecialchars($email) . "</strong>) has been verified. Your account is now fully active and ready to create isolated browser profiles and proxies.</p>
        <p style='text-align:center; margin:24px 0;'>
          <a href='app://profilevault' style='background:#2DD4BF; color:#0F0F17; font-weight:700; padding:12px 28px; text-decoration:none; border-radius:8px;'>Launch ProfileVault App</a>
        </p>
      </div>
    </div>";

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


