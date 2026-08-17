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

        // 6. Payment Gateways Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `payment_gateways` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `gateway_key` VARCHAR(50) NOT NULL UNIQUE,
              `name` VARCHAR(100) NOT NULL,
              `is_enabled` TINYINT(1) DEFAULT 0,
              `is_test_mode` TINYINT(1) DEFAULT 1,
              `public_key` VARCHAR(255) DEFAULT NULL,
              `secret_key` TEXT DEFAULT NULL,
              `webhook_secret` TEXT DEFAULT NULL,
              `currency` VARCHAR(10) DEFAULT 'USD',
              `config_json` TEXT DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try {
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `public_key` VARCHAR(255) DEFAULT NULL;");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `secret_key` TEXT DEFAULT NULL;");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `webhook_secret` TEXT DEFAULT NULL;");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `currency` VARCHAR(10) DEFAULT 'USD';");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `config_json` TEXT DEFAULT NULL;");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `is_enabled` TINYINT(1) DEFAULT 0;");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `is_test_mode` TINYINT(1) DEFAULT 1;");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `name` VARCHAR(100) NOT NULL DEFAULT 'Payment Gateway';");
            $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN IF NOT EXISTS `gateway_key` VARCHAR(50) DEFAULT NULL;");
        } catch (Throwable $e) {}

        // Seed default gateways if empty
        try {
            $db->exec("
                INSERT INTO `payment_gateways` (`id`, `gateway_key`, `name`, `is_enabled`, `is_test_mode`, `public_key`, `secret_key`, `webhook_secret`, `currency`, `config_json`)
                VALUES
                ('gw_stripe', 'stripe', 'Stripe', 0, 1, '', '', '', 'USD', '{\"checkout_title\":\"ProfileVault Subscription\",\"allow_promotion_codes\":true,\"billing_address_collection\":\"auto\"}'),
                ('gw_crypto', 'crypto', 'Cryptocurrency', 0, 1, '', '', '', 'USD', '{\"provider\":\"nowpayments\",\"supported_coins\":[\"BTC\",\"ETH\",\"USDT\",\"USDC\"],\"network\":\"TRC20,ERC20,BTC\",\"min_amount\":10,\"confirmations_required\":2}')
                ON DUPLICATE KEY UPDATE `id`=`id`;
            ");
        } catch (Throwable $e) {}

        // 7. Invoices Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `invoices` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
              `user_id` VARCHAR(36) NOT NULL,
              `plan_id` VARCHAR(50) NOT NULL,
              `amount` DECIMAL(10,2) NOT NULL,
              `amount_cents` INT NOT NULL,
              `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
              `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
              `gateway` VARCHAR(50) DEFAULT NULL,
              `transaction_id` VARCHAR(100) DEFAULT NULL,
              `metadata` TEXT DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `paid_at` DATETIME DEFAULT NULL,
              `expires_at` DATETIME DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // 8. Payments Table
        $db->exec("
            CREATE TABLE IF NOT EXISTS `payments` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `invoice_id` VARCHAR(50) DEFAULT NULL,
              `subscription_id` VARCHAR(50) DEFAULT NULL,
              `package_id` VARCHAR(50) DEFAULT NULL,
              `transaction_id` VARCHAR(100) NOT NULL,
              `provider_payment_id` VARCHAR(150) DEFAULT NULL,
              `amount` DECIMAL(10,2) NOT NULL,
              `amount_cents` INT NOT NULL DEFAULT 0,
              `currency` VARCHAR(10) DEFAULT 'USD',
              `gateway` VARCHAR(50) NOT NULL DEFAULT 'stripe',
              `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
              `payment_method` VARCHAR(50) DEFAULT 'card',
              `invoice_url` VARCHAR(255) DEFAULT NULL,
              `metadata` TEXT DEFAULT NULL,
              `paid_at` DATETIME DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // 9. Payment Events Table (Webhook Idempotency)
        $db->exec("
            CREATE TABLE IF NOT EXISTS `payment_events` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `provider` VARCHAR(50) NOT NULL,
              `event_id` VARCHAR(150) NOT NULL,
              `event_type` VARCHAR(100) NOT NULL,
              `invoice_id` VARCHAR(50) DEFAULT NULL,
              `payload` LONGTEXT DEFAULT NULL,
              `status` VARCHAR(50) NOT NULL DEFAULT 'processed',
              `error_message` TEXT DEFAULT NULL,
              `received_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `processed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY `uk_provider_event` (`provider`, `event_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // 10. Live Chat & Support System Tables
        $db->exec("
            CREATE TABLE IF NOT EXISTS `support_conversations` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) DEFAULT NULL,
              `visitor_token` VARCHAR(100) DEFAULT NULL,
              `guest_name` VARCHAR(100) DEFAULT NULL,
              `guest_email` VARCHAR(191) DEFAULT NULL,
              `channel` VARCHAR(30) NOT NULL DEFAULT 'web',
              `assigned_agent_id` VARCHAR(36) DEFAULT NULL,
              `status` VARCHAR(50) NOT NULL DEFAULT 'open',
              `priority` VARCHAR(50) NOT NULL DEFAULT 'normal',
              `subject` VARCHAR(255) NOT NULL DEFAULT 'Live Chat Support',
              `last_message_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `closed_at` DATETIME DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              KEY `idx_sup_conv_user_status` (`user_id`, `status`),
              KEY `idx_sup_conv_visitor` (`visitor_token`),
              KEY `idx_sup_conv_last_msg` (`last_message_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try {
            $db->exec("ALTER TABLE `support_conversations` ADD COLUMN IF NOT EXISTS `visitor_token` VARCHAR(100) DEFAULT NULL;");
            $db->exec("ALTER TABLE `support_conversations` ADD COLUMN IF NOT EXISTS `guest_name` VARCHAR(100) DEFAULT NULL;");
            $db->exec("ALTER TABLE `support_conversations` ADD COLUMN IF NOT EXISTS `guest_email` VARCHAR(191) DEFAULT NULL;");
            $db->exec("ALTER TABLE `support_conversations` ADD COLUMN IF NOT EXISTS `channel` VARCHAR(30) NOT NULL DEFAULT 'web';");
            $db->exec("ALTER TABLE `support_conversations` MODIFY `user_id` VARCHAR(36) DEFAULT NULL;");
        } catch (Throwable $e) {}

        $db->exec("
            CREATE TABLE IF NOT EXISTS `support_messages` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `conversation_id` VARCHAR(50) NOT NULL,
              `client_message_id` VARCHAR(100) DEFAULT NULL,
              `sender_id` VARCHAR(36) DEFAULT NULL,
              `sender_name` VARCHAR(100) DEFAULT NULL,
              `sender_type` VARCHAR(20) NOT NULL,
              `message` TEXT NOT NULL,
              `message_type` VARCHAR(50) DEFAULT 'text',
              `status` VARCHAR(20) NOT NULL DEFAULT 'sent',
              `attachment_path` VARCHAR(255) DEFAULT NULL,
              `attachment_name` VARCHAR(255) DEFAULT NULL,
              `attachment_size` INT DEFAULT NULL,
              `attachment_mime` VARCHAR(100) DEFAULT NULL,
              `is_read` TINYINT(1) DEFAULT 0,
              `read_at` DATETIME DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              KEY `idx_sup_msg_conv_created` (`conversation_id`, `created_at`),
              KEY `idx_sup_msg_unread` (`conversation_id`, `sender_type`, `is_read`),
              KEY `idx_sup_msg_client_id` (`conversation_id`, `client_message_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try {
            $db->exec("ALTER TABLE `support_messages` ADD COLUMN IF NOT EXISTS `client_message_id` VARCHAR(100) DEFAULT NULL;");
            $db->exec("ALTER TABLE `support_messages` ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NOT NULL DEFAULT 'sent';");
            $db->exec("ALTER TABLE `support_messages` ADD COLUMN IF NOT EXISTS `sender_name` VARCHAR(100) DEFAULT NULL;");
            $db->exec("ALTER TABLE `support_messages` MODIFY `sender_id` VARCHAR(36) DEFAULT NULL;");
        } catch (Throwable $e) {}

        $db->exec("
            CREATE TABLE IF NOT EXISTS `support_internal_notes` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `conversation_id` VARCHAR(50) NOT NULL,
              `agent_id` VARCHAR(36) NOT NULL,
              `agent_name` VARCHAR(255) NOT NULL,
              `note` TEXT NOT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS `support_settings` (
              `key` VARCHAR(100) NOT NULL PRIMARY KEY,
              `value` TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            INSERT INTO `support_settings` (`key`, `value`) VALUES
            ('support_enabled', 'true'),
            ('support_hours', '24/7 Live Agent Support'),
            ('auto_reply_enabled', 'true'),
            ('auto_reply_message', 'Thank you for reaching out! A technical support engineer has been notified and will assist you shortly.'),
            ('livechat_widget_title', 'ProfileVault Live Support'),
            ('livechat_welcome_message', 'Hello! 👋 How can we help you today with your browser profiles, proxies, or subscriptions?'),
            ('rate_limit_messages_per_min', '25')
            ON DUPLICATE KEY UPDATE `key`=`key`;
        ");

        // 11. SEO, AEO & Meta Management Tables
        $db->exec("
            CREATE TABLE IF NOT EXISTS `seo_settings` (
              `key` VARCHAR(100) NOT NULL PRIMARY KEY,
              `value` TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            INSERT INTO `seo_settings` (`key`, `value`) VALUES
            ('site_title', 'ProfileVault — Anti-Detect Browser & Profile Isolation'),
            ('site_description', 'Professional Multi-Account Anti-Detect Browser with Isolated Profiles, Fingerprint Spoofing & Residential Proxy Support.'),
            ('site_url', 'https://antiprofiles.com'),
            ('default_og_image', 'https://antiprofiles.com/og-cover.png'),
            ('twitter_handle', '@ProfileVaultApp'),
            ('robots_content', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://antiprofiles.com/sitemap.xml'),
            ('entity_brand_name', 'ProfileVault Software Inc.'),
            ('entity_logo', 'https://antiprofiles.com/logo.png'),
            ('entity_email', 'support@antiprofiles.com'),
            ('entity_phone', '+1 (800) 555-0199'),
            ('entity_same_as', '[\"https://x.com/ProfileVaultApp\", \"https://github.com/edge-tec/Antidetector_browser\"]')
            ON DUPLICATE KEY UPDATE `key`=`key`;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS `page_seo` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `page_path` VARCHAR(255) NOT NULL UNIQUE,
              `page_type` VARCHAR(50) NOT NULL DEFAULT 'webpage',
              `title` VARCHAR(255) NOT NULL,
              `description` TEXT NOT NULL,
              `keywords` TEXT DEFAULT NULL,
              `canonical_url` VARCHAR(255) DEFAULT NULL,
              `robots` VARCHAR(100) DEFAULT 'index, follow',
              `og_title` VARCHAR(255) DEFAULT NULL,
              `og_description` TEXT DEFAULT NULL,
              `og_image` VARCHAR(255) DEFAULT NULL,
              `twitter_card` VARCHAR(50) DEFAULT 'summary_large_image',
              `twitter_title` VARCHAR(255) DEFAULT NULL,
              `twitter_description` TEXT DEFAULT NULL,
              `schema_type` VARCHAR(50) DEFAULT 'SoftwareApplication',
              `primary_keyword` VARCHAR(255) DEFAULT NULL,
              `ai_quick_answer` TEXT DEFAULT NULL,
              `structured_data_json` TEXT DEFAULT NULL,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            INSERT INTO `page_seo` (
              `id`, `page_path`, `page_type`, `title`, `description`, `keywords`, `canonical_url`, `robots`,
              `og_title`, `og_description`, `og_image`, `schema_type`, `primary_keyword`, `ai_quick_answer`
            ) VALUES (
              'page_home', '/', 'homepage',
              'ProfileVault — Anti-Detect Browser & Multi-Account Management Tool',
              'Manage thousands of social media, e-commerce, and ads accounts seamlessly with 100% isolated browser profiles, fingerprint spoofing, and residential proxies.',
              'anti detect browser, multi account browser, browser profile isolation, fingerprint spoofing, proxy manager',
              'https://antiprofiles.com/',
              'index, follow',
              'ProfileVault — Anti-Detect Browser & Profile Isolation',
              'Professional anti-detect browser for managing isolated web profiles without bans.',
              'https://antiprofiles.com/og-cover.png',
              'SoftwareApplication',
              'anti detect browser',
              'ProfileVault is a software platform designed for privacy, browser profile isolation, and multi-account management. It allows users to run separate Chromium instances with unique canvas, WebGL, WebRTC, and proxy configurations.'
            ) ON DUPLICATE KEY UPDATE `id`=`id`;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS `seo_keywords` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `keyword` VARCHAR(255) NOT NULL UNIQUE,
              `keyword_type` VARCHAR(50) DEFAULT 'primary',
              `search_intent` VARCHAR(50) DEFAULT 'commercial',
              `target_url` VARCHAR(255) NOT NULL,
              `country` VARCHAR(10) DEFAULT 'US',
              `language` VARCHAR(10) DEFAULT 'en',
              `status` VARCHAR(50) DEFAULT 'active',
              `ranking_position` INT DEFAULT 0,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS `seo_redirects` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `source_path` VARCHAR(255) NOT NULL UNIQUE,
              `target_path` VARCHAR(255) NOT NULL,
              `status_code` INT DEFAULT 301,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS `seo_404_logs` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `request_path` VARCHAR(255) NOT NULL,
              `referrer` TEXT DEFAULT NULL,
              `user_agent` TEXT DEFAULT NULL,
              `hit_count` INT DEFAULT 1,
              `last_seen_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    
    // 1. Try Custom SMTP Socket if Enabled
    if (!empty($smtp['enabled']) && !empty($smtp['host']) && !empty($smtp['user'])) {
        $host = $smtp['host'];
        $port = (int)($smtp['port'] ?? 587);
        $user = $smtp['user'];
        $pass = $smtp['password'] ?? '';
        $from = !empty($smtp['fromEmail']) ? $smtp['fromEmail'] : $user;
        $fromName = !empty($smtp['fromName']) ? $smtp['fromName'] : 'ProfileVault';
        $secure = (bool)($smtp['secure'] ?? false);

        $timeout = 15;
        $errno = 0;
        $errstr = '';

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $socketHost = ($secure || $port === 465) ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
        $socket = @stream_socket_client($socketHost, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);

        if ($socket) {
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

            // STARTTLS for port 587 or if supported
            if (!$secure && $port !== 465 && strpos($ehloRes, 'STARTTLS') !== false) {
                $write("STARTTLS");
                $tlsRes = $read();
                if (substr($tlsRes, 0, 3) === '220') {
                    $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                    if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                        $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
                    }
                    if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                        $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
                    }
                    @stream_socket_enable_crypto($socket, true, $cryptoMethod);
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
                    goto fallback_native_mail;
                }
            }

            // MAIL FROM
            $write("MAIL FROM: <{$from}>");
            $mailFromRes = $read();
            if (substr($mailFromRes, 0, 3) !== '250') {
                $write("QUIT");
                fclose($socket);
                goto fallback_native_mail;
            }

            // RCPT TO
            $write("RCPT TO: <{$toEmail}>");
            $rcptRes = $read();
            if (substr($rcptRes, 0, 3) !== '250' && substr($rcptRes, 0, 3) !== '251') {
                $write("QUIT");
                fclose($socket);
                goto fallback_native_mail;
            }

            // DATA
            $write("DATA");
            $dataRes = $read();
            if (substr($dataRes, 0, 3) !== '354') {
                $write("QUIT");
                fclose($socket);
                goto fallback_native_mail;
            }

            // Headers & Body
            $headers = [];
            $headers[] = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <{$from}>";
            $headers[] = "To: <{$toEmail}>";
            $headers[] = "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=";
            $headers[] = "MIME-Version: 1.0";
            $headers[] = "Content-Type: text/html; charset=UTF-8";
            $headers[] = "Content-Transfer-Encoding: base64";
            $headers[] = "X-Mailer: ProfileVault-Mailer/1.0";

            $payload = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($htmlBody)) . "\r\n.";
            $write($payload);
            $sendRes = $read();

            $write("QUIT");
            fclose($socket);

            if (substr($sendRes, 0, 3) === '250') {
                return true;
            }
        }
    }

    // 2. Fallback to PHP native mail()
    fallback_native_mail:
    try {
        $fromName = $smtp['fromName'] ?? 'ProfileVault';
        $fromEmail = !empty($smtp['fromEmail']) ? $smtp['fromEmail'] : (!empty($smtp['user']) ? $smtp['user'] : 'noreply@antiprofiles.com');

        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>',
            'Reply-To: ' . $fromEmail,
            'X-Mailer: PHP/' . phpversion()
        ];

        return @mail($toEmail, '=?UTF-8?B?' . base64_encode($subject) . '?=', $htmlBody, implode("\r\n", $headers));
    } catch (Throwable $e) {
        return false;
    }
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
 * Global helper for emitting SSE and WebSocket broadcast events.
 */
function publishEvent(string $eventType, array $payload, ?string $userId = null, ?string $targetRole = null): string {
    $db = Database::getConnection();
    return publishRealtimeEvent($db, $userId, $eventType, $payload, $targetRole);
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

/**
 * Automatically ensure every user has a valid active subscription (Free Plan for users, Pro for admins).
 */
function ensureUserFreeSubscription(PDO $db, string $userId, string $role = 'user'): array {
    try {
        $stmt = $db->prepare("SELECT s.*, p.name as plan_name, p.profile_limit, p.team_limit FROM subscriptions s LEFT JOIN pricing_plans p ON s.plan_id = p.id WHERE s.user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $sub = $stmt->fetch();

        if ($sub) {
            return $sub;
        }

        // Determine plan: Admin gets Pro, regular user gets Free
        $isAdmin = ($role === 'admin' || $role === 'super_admin');
        $planId = $isAdmin ? 'plan_pro' : 'plan_free';

        // Check if plan_free exists in pricing_plans
        $planCheck = $db->prepare("SELECT id FROM pricing_plans WHERE id = ? LIMIT 1");
        $planCheck->execute([$planId]);
        if (!$planCheck->fetch()) {
            $planId = 'plan_free';
        }

        $subId = 'sub_' . bin2hex(random_bytes(8));
        $deviceLimit = $isAdmin ? 10 : 1;

        $insert = $db->prepare("
            INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days, device_limit)
            VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 YEAR), 3, ?)
            ON DUPLICATE KEY UPDATE status = 'active'
        ");
        $insert->execute([$subId, $userId, $planId, $deviceLimit]);

        $stmt->execute([$userId]);
        return $stmt->fetch() ?: [];
    } catch (Throwable $e) {
        error_log("[ProfileVault] Error in ensureUserFreeSubscription: " . $e->getMessage());
        return [];
    }
}



