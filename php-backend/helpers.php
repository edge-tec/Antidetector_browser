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
    return $user ?: null;
}

// Require Admin Privilege
function requireAdmin(): array {
    $user = getAuthenticatedUser();
    if (!$user) {
        respondJson(['success' => false, 'error' => 'Authentication required. Please sign in.'], 401);
    }
    if ($user['role'] !== 'admin' || $user['account_status'] === 'suspended') {
        respondJson(['success' => false, 'error' => 'Access denied. Administrator privileges required.'], 403);
    }
    return $user;
}
