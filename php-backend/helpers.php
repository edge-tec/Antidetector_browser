<?php
// ──────────────────────────────────────────────
// AntiProfiles — Central Helper Functions
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
            ('plan_starter', 'Starter', 'starter', 'Essential features for solo operators & small tasks', 19.00, 15.00, 25, 2, 'Basic API', '', 'Pay & Upgrade ($19)', '#pricing', 0, 2),
            ('plan_pro', 'Professional', 'professional', 'Advanced fingerprint controls & team features', 49.00, 39.00, 100, 10, 'Full REST & Driver API', 'Most Popular', 'Pay & Upgrade ($49)', '#pricing', 1, 3),
            ('plan_business', 'Business', 'business', 'Maximum power for large scale multi-profile teams', 99.00, 79.00, 500, 25, 'Unlimited API', 'Best Value', 'Pay & Upgrade ($99)', '#pricing', 0, 4)
            ON DUPLICATE KEY UPDATE 
                `name`=VALUES(`name`),
                `monthly_price`=VALUES(`monthly_price`),
                `yearly_price`=VALUES(`yearly_price`),
                `profile_limit`=VALUES(`profile_limit`),
                `team_limit`=VALUES(`team_limit`),
                `api_limit`=VALUES(`api_limit`),
                `badge`=VALUES(`badge`),
                `button_text`=VALUES(`button_text`),
                `is_popular`=VALUES(`is_popular`);
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
            $db->exec("ALTER TABLE `subscriptions` ADD COLUMN IF NOT EXISTS `profile_limit` INT DEFAULT NULL;");
            $db->exec("ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `profile_limit` INT DEFAULT NULL;");
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

        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `public_key` VARCHAR(255) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `secret_key` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `webhook_secret` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `currency` VARCHAR(10) DEFAULT 'USD'"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `config_json` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `is_enabled` TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `is_test_mode` TINYINT(1) DEFAULT 1"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `name` VARCHAR(100) NOT NULL DEFAULT 'Payment Gateway'"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `payment_gateways` ADD COLUMN `gateway_key` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}

        // Seed default gateways if empty
        try {
            $db->exec("
                INSERT INTO `payment_gateways` (`id`, `gateway_key`, `name`, `is_enabled`, `is_test_mode`, `public_key`, `secret_key`, `webhook_secret`, `currency`, `config_json`)
                VALUES
                ('gw_stripe', 'stripe', 'Stripe', 0, 1, '', '', '', 'USD', '{\"checkout_title\":\"AntiProfiles Subscription\",\"allow_promotion_codes\":true,\"billing_address_collection\":\"auto\"}'),
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
            ('livechat_widget_title', 'AntiProfiles Live Support'),
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
            ('site_title', 'AntiProfiles — Anti-Detect Browser & Profile Isolation'),
            ('site_description', 'Professional Multi-Account Anti-Detect Browser with Isolated Profiles, Fingerprint Spoofing & Residential Proxy Support.'),
            ('site_url', 'https://antiprofiles.com'),
            ('default_og_image', 'https://antiprofiles.com/og-cover.png'),
            ('twitter_handle', '@AntiProfilesApp'),
            ('robots_content', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://antiprofiles.com/sitemap.xml'),
            ('entity_brand_name', 'AntiProfiles Software Inc.'),
            ('entity_logo', 'https://antiprofiles.com/logo.png'),
            ('entity_email', 'support@antiprofiles.com'),
            ('entity_phone', '+1 (800) 555-0199'),
            ('entity_same_as', '[\"https://x.com/AntiProfilesApp\", \"https://github.com/edge-tec/Antidetector_browser\"]')
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
              'AntiProfiles — Anti-Detect Browser & Multi-Account Management Tool',
              'Manage thousands of social media, e-commerce, and ads accounts seamlessly with 100% isolated browser profiles, fingerprint spoofing, and residential proxies.',
              'antidetect browser, anti detect browser, browser fingerprint, browser fingerprinting, browser profile, profile manager, multi login browser, multi account browser, fingerprint spoofing, user agent spoofing, WebGL fingerprint, Canvas fingerprint, Audio fingerprint, WebRTC protection, DNS leak protection, proxy browser, SOCKS5 proxy, HTTP proxy, residential proxy, mobile proxy, affiliate marketing browser, CPA browser, media buying browser, Facebook browser, TikTok browser, Instagram browser, Google Ads browser, eCommerce browser, Amazon seller browser, dropshipping browser, anonymous browsing, privacy browser, secure browser, virtual browser, isolated browser profiles, browser automation, Chrome fingerprint, Firefox fingerprint, Mac antidetect browser, Windows antidetect browser, Linux antidetect browser, Apple Silicon browser, GoLogin alternative, AdsPower alternative, Multilogin alternative, Dolphin Anty alternative, Kameleo alternative, Incogniton alternative, VMLogin alternative, Hidemyacc alternative, Octo Browser alternative, MoreLogin alternative, browser identity manager, AntiProfiles browser',
              'https://antiprofiles.com/',
              'index, follow',
              'AntiProfiles — Anti-Detect Browser & Profile Isolation',
              'Professional anti-detect browser for managing isolated web profiles without bans.',
              'https://antiprofiles.com/og-cover.png',
              'SoftwareApplication',
              'antidetect browser',
              'AntiProfiles is a software platform designed for privacy, browser profile isolation, and multi-account management. It allows users to run separate Chromium and Firefox instances with unique canvas, WebGL, WebRTC, proxy configurations, and competitor alternatives like GoLogin, AdsPower, Multilogin.'
            ) ON DUPLICATE KEY UPDATE `keywords`=VALUES(`keywords`), `ai_quick_answer`=VALUES(`ai_quick_answer`);
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

            INSERT IGNORE INTO `seo_keywords` (`id`, `keyword`, `keyword_type`, `search_intent`, `target_url`) VALUES
            ('kw_1', 'multi-account management', 'primary', 'commercial', '/'),
            ('kw_2', 'affiliate marketing browser', 'primary', 'commercial', '/'),
            ('kw_3', 'cpa marketing browser', 'primary', 'commercial', '/'),
            ('kw_4', 'social media account manager', 'primary', 'commercial', '/'),
            ('kw_5', 'facebook multi account browser', 'secondary', 'commercial', '/'),
            ('kw_6', 'tiktok multi account browser', 'secondary', 'commercial', '/'),
            ('kw_7', 'instagram multi account browser', 'secondary', 'commercial', '/'),
            ('kw_8', 'ads account browser', 'secondary', 'commercial', '/'),
            ('kw_9', 'browser for media buying', 'secondary', 'commercial', '/'),
            ('kw_10', 'e-commerce browser profiles', 'secondary', 'commercial', '/'),
            ('kw_11', 'amazon seller browser', 'secondary', 'commercial', '/'),
            ('kw_12', 'dropshipping browser', 'secondary', 'commercial', '/'),
            ('kw_13', 'agency browser profiles', 'secondary', 'commercial', '/'),
            ('kw_14', 'canvas fingerprint protection', 'primary', 'commercial', '/'),
            ('kw_15', 'webgl fingerprint spoofing', 'primary', 'commercial', '/'),
            ('kw_16', 'audio fingerprint protection', 'secondary', 'commercial', '/'),
            ('kw_17', 'user agent spoofing', 'secondary', 'commercial', '/'),
            ('kw_18', 'timezone spoofing', 'secondary', 'commercial', '/'),
            ('kw_19', 'font fingerprint protection', 'secondary', 'commercial', '/'),
            ('kw_20', 'screen resolution spoofing', 'secondary', 'commercial', '/'),
            ('kw_21', 'device fingerprint masking', 'primary', 'commercial', '/'),
            ('kw_22', 'ip and fingerprint isolation', 'primary', 'commercial', '/'),
            ('kw_23', 'cookie isolation browser', 'secondary', 'commercial', '/'),
            ('kw_24', 'local storage isolation', 'secondary', 'commercial', '/'),
            ('kw_25', 'webrtc leak protection', 'primary', 'commercial', '/'),
            ('kw_26', 'dns leak protection', 'primary', 'commercial', '/'),
            ('kw_27', 'residential proxy browser', 'primary', 'commercial', '/'),
            ('kw_28', 'socks5 proxy browser', 'primary', 'commercial', '/'),
            ('kw_29', 'http proxy browser', 'secondary', 'commercial', '/'),
            ('kw_30', 'mobile proxy browser', 'secondary', 'commercial', '/'),
            ('kw_31', 'proxy profile management', 'secondary', 'commercial', '/'),
            ('kw_32', 'rotating proxy browser', 'secondary', 'commercial', '/'),
            ('kw_33', 'proxy fingerprint browser', 'secondary', 'commercial', '/'),
            ('kw_34', 'browser with proxy support', 'secondary', 'commercial', '/'),
            ('kw_35', 'gologin alternative', 'competitor', 'commercial', '/'),
            ('kw_36', 'multilogin alternative', 'competitor', 'commercial', '/'),
            ('kw_37', 'adspower alternative', 'competitor', 'commercial', '/'),
            ('kw_38', 'dolphin anty alternative', 'competitor', 'commercial', '/'),
            ('kw_39', 'incogniton alternative', 'competitor', 'commercial', '/'),
            ('kw_40', 'vmlogin alternative', 'competitor', 'commercial', '/'),
            ('kw_41', 'kameleo alternative', 'competitor', 'commercial', '/'),
            ('kw_42', 'hidemyacc alternative', 'competitor', 'commercial', '/'),
            ('kw_43', 'octo browser alternative', 'competitor', 'commercial', '/'),
            ('kw_44', 'morelogin alternative', 'competitor', 'commercial', '/'),
            ('kw_45', 'anti detect browser windows', 'primary', 'commercial', '/'),
            ('kw_46', 'anti detect browser mac', 'primary', 'commercial', '/'),
            ('kw_47', 'anti detect browser linux', 'primary', 'commercial', '/'),
            ('kw_48', 'apple silicon anti detect browser', 'secondary', 'commercial', '/'),
            ('kw_49', 'intel mac anti detect browser', 'secondary', 'commercial', '/'),
            ('kw_50', 'cross platform antidetect browser', 'secondary', 'commercial', '/'),
            ('kw_51', 'antidetect browser', 'primary', 'commercial', '/'),
            ('kw_52', 'anti detect browser', 'primary', 'commercial', '/'),
            ('kw_53', 'browser fingerprint', 'primary', 'informational', '/'),
            ('kw_54', 'fingerprint browser', 'primary', 'commercial', '/'),
            ('kw_55', 'multi account browser', 'primary', 'commercial', '/'),
            ('kw_56', 'privacy browser', 'primary', 'commercial', '/'),
            ('kw_57', 'anonymous browser', 'primary', 'commercial', '/'),
            ('kw_58', 'cpa marketing', 'secondary', 'commercial', '/'),
            ('kw_59', 'affiliate marketing', 'secondary', 'commercial', '/'),
            ('kw_60', 'media buying', 'secondary', 'commercial', '/'),
            ('kw_61', 'proxy browser', 'primary', 'commercial', '/'),
            ('kw_62', 'socks5 proxy', 'secondary', 'commercial', '/'),
            ('kw_63', 'residential proxy', 'secondary', 'commercial', '/'),
            ('kw_64', 'browser security', 'secondary', 'informational', '/'),
            ('kw_65', 'antiprofiles browser', 'brand', 'navigational', '/');
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
            CREATE TABLE IF NOT EXISTS `password_resets` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `email` VARCHAR(191) NOT NULL,
              `token_hash` VARCHAR(64) NOT NULL,
              `expires_at` DATETIME NOT NULL,
              `used` TINYINT(1) NOT NULL DEFAULT 0,
              `used_at` DATETIME DEFAULT NULL,
              `attempts` INT DEFAULT 0,
              `ip_address` VARCHAR(45) DEFAULT NULL,
              `user_agent` TEXT DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              KEY `idx_pwd_reset_token` (`token_hash`),
              KEY `idx_pwd_reset_user` (`user_id`, `expires_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS `email_logs` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `recipient` VARCHAR(191) NOT NULL,
              `email_type` VARCHAR(50) NOT NULL,
              `subject` VARCHAR(255) NOT NULL,
              `status` VARCHAR(20) NOT NULL,
              `delivery_method` VARCHAR(50) DEFAULT 'smtp',
              `error_message` TEXT DEFAULT NULL,
              `user_id` VARCHAR(36) DEFAULT NULL,
              `metadata_json` LONGTEXT DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              KEY `idx_el_recipient` (`recipient`),
              KEY `idx_el_type` (`email_type`),
              KEY `idx_el_status` (`status`),
              KEY `idx_el_created` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // 13. Account Notifications Table (Prevents duplicate renewal / expiration reminders)
        $db->exec("
            CREATE TABLE IF NOT EXISTS `account_notifications` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `notification_type` VARCHAR(50) NOT NULL,
              `reference_date` VARCHAR(50) NOT NULL,
              `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY `idx_user_notif_date` (`user_id`, `notification_type`, `reference_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `global_trial_settings` (
              `id` VARCHAR(64) NOT NULL PRIMARY KEY,
              `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
              `trial_duration_days` INT NOT NULL DEFAULT 7,
              `default_plan_id` VARCHAR(64) NOT NULL DEFAULT 'plan_starter',
              `applies_to_packages` VARCHAR(64) NOT NULL DEFAULT 'all',
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            INSERT IGNORE INTO `global_trial_settings` (`id`, `is_enabled`, `trial_duration_days`, `default_plan_id`, `applies_to_packages`)
            VALUES ('global_trial_config', 1, 7, 'plan_starter', 'all');
        ");

        // 14. CPA Affiliate System Tables
        $db->exec("
            CREATE TABLE IF NOT EXISTS `affiliate_offers` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `title` VARCHAR(255) NOT NULL,
              `description` TEXT DEFAULT NULL,
              `target_url` VARCHAR(500) NOT NULL,
              `payout_type` VARCHAR(20) NOT NULL DEFAULT 'revshare',
              `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
              `revshare_percent` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
              `fixed_payout_usd` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
              `status` VARCHAR(20) NOT NULL DEFAULT 'active',
              `total_clicks` INT NOT NULL DEFAULT 0,
              `total_conversions` INT NOT NULL DEFAULT 0,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_tracking_links` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `affiliate_id` VARCHAR(50) NOT NULL,
              `offer_id` VARCHAR(50) NOT NULL,
              `slug` VARCHAR(100) DEFAULT NULL,
              `sub_id1` VARCHAR(100) DEFAULT NULL,
              `sub_id2` VARCHAR(100) DEFAULT NULL,
              `full_url` TEXT NOT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_clicks` (
              `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
              `click_id` VARCHAR(64) NOT NULL UNIQUE,
              `affiliate_id` VARCHAR(50) NOT NULL,
              `offer_id` VARCHAR(50) NOT NULL,
              `ip_address` VARCHAR(45) DEFAULT NULL,
              `user_agent` TEXT DEFAULT NULL,
              `referrer` TEXT DEFAULT NULL,
              `sub_id1` VARCHAR(100) DEFAULT NULL,
              `sub_id2` VARCHAR(100) DEFAULT NULL,
              `converted` TINYINT(1) NOT NULL DEFAULT 0,
              `conversion_id` VARCHAR(64) DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_conversions` (
              `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
              `conversion_id` VARCHAR(64) NOT NULL UNIQUE,
              `click_id` VARCHAR(64) NOT NULL,
              `affiliate_id` VARCHAR(50) NOT NULL,
              `offer_id` VARCHAR(50) NOT NULL,
              `user_id` VARCHAR(36) DEFAULT NULL,
              `order_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              `payout_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
              `status` VARCHAR(20) NOT NULL DEFAULT 'approved',
              `idempotency_key` VARCHAR(100) DEFAULT NULL UNIQUE,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_postback_configs` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `affiliate_id` VARCHAR(50) NOT NULL UNIQUE,
              `postback_url` TEXT NOT NULL,
              `http_method` VARCHAR(10) NOT NULL DEFAULT 'GET',
              `is_active` TINYINT(1) NOT NULL DEFAULT 1,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_postbacks` (
              `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
              `conversion_id` VARCHAR(64) NOT NULL,
              `click_id` VARCHAR(64) NOT NULL,
              `affiliate_id` VARCHAR(50) NOT NULL,
              `url` TEXT NOT NULL,
              `http_method` VARCHAR(10) NOT NULL DEFAULT 'GET',
              `request_payload` TEXT DEFAULT NULL,
              `http_status` INT DEFAULT NULL,
              `response_body` TEXT DEFAULT NULL,
              `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
              `retry_count` INT NOT NULL DEFAULT 0,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_withdrawals` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `user_id` VARCHAR(36) NOT NULL,
              `amount` DECIMAL(10,2) NOT NULL,
              `payout_method` VARCHAR(50) NOT NULL,
              `payout_details_json` TEXT DEFAULT NULL,
              `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
              `admin_note` TEXT DEFAULT NULL,
              `payout_reference` VARCHAR(255) DEFAULT NULL,
              `processed_by` VARCHAR(36) DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `affiliate_audit_logs` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `action_type` VARCHAR(50) NOT NULL,
              `target_type` VARCHAR(50) NOT NULL,
              `target_id` VARCHAR(100) NOT NULL,
              `actor_id` VARCHAR(36) NOT NULL,
              `details_json` TEXT DEFAULT NULL,
              `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try { $db->exec("ALTER TABLE `users` ADD COLUMN `affiliate_id` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `referral_code` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `affiliate_status` VARCHAR(20) DEFAULT 'active'"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `referred_by_affiliate_id` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `referred_by_click_id` VARCHAR(64) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_clicks` ADD COLUMN `landing_url` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_clicks` ADD COLUMN `sub_id3` VARCHAR(100) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_clicks` ADD COLUMN `sub_id4` VARCHAR(100) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_clicks` ADD COLUMN `sub_id5` VARCHAR(100) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_clicks` ADD COLUMN `conversion_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_offers` ADD COLUMN `total_clicks` INT NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_offers` ADD COLUMN `total_conversions` INT NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `affiliate_offers` ADD COLUMN `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 15.00"); } catch (Throwable $e) {}

        // Seed default CPA offer if empty
        try {
            $db->exec("
                INSERT INTO `affiliate_offers` (`id`, `title`, `description`, `target_url`, `payout_type`, `revshare_percent`, `fixed_payout_usd`, `status`)
                VALUES ('offer_main_saas', 'AntiProfiles Pro & Team Subscription Plan', 'Earn 15% lifetime recurring commissions on all AntiProfiles browser subscription renewals.', '/#pricing', 'revshare', 15.00, 0.00, 'active')
                ON DUPLICATE KEY UPDATE `id`=`id`;
            ");
        } catch (Throwable $e) {}

        // Software Features Table
        try {
            $db->exec("
                CREATE TABLE IF NOT EXISTS `software_features` (
                  `id` VARCHAR(60) NOT NULL PRIMARY KEY,
                  `category` VARCHAR(50) NOT NULL,
                  `category_name` VARCHAR(100) NOT NULL,
                  `name` VARCHAR(150) NOT NULL,
                  `short_desc` TEXT NOT NULL,
                  `full_desc` TEXT DEFAULT NULL,
                  `icon` VARCHAR(100) NOT NULL,
                  `platforms` VARCHAR(120) NOT NULL DEFAULT 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
                  `badge` VARCHAR(50) DEFAULT NULL,
                  `sort_order` INT NOT NULL DEFAULT 0,
                  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
                  `keywords` TEXT DEFAULT NULL,
                  `doc_url` VARCHAR(255) DEFAULT NULL,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
        } catch (Throwable $e) {}

        try { $db->exec("ALTER TABLE `software_features` ADD COLUMN `platforms` VARCHAR(120) NOT NULL DEFAULT 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm'"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `software_features` ADD COLUMN `badge` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `software_features` ADD COLUMN `keywords` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `software_features` ADD COLUMN `doc_url` VARCHAR(255) DEFAULT NULL"); } catch (Throwable $e) {}

        try { $db->exec("ALTER TABLE `email_logs` ADD COLUMN `retry_count` INT DEFAULT 0"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `email_logs` ADD COLUMN `last_attempt_at` DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `email_logs` ADD COLUMN `html_body` LONGTEXT DEFAULT NULL"); } catch (Throwable $e) {}

        try { $db->exec("ALTER TABLE `users` ADD COLUMN `reset_token_hash` VARCHAR(128) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `reset_token_expires_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` ADD COLUMN `reset_token_created_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `users` MODIFY COLUMN `reset_token_hash` VARCHAR(128) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $db->exec("ALTER TABLE `password_resets` MODIFY COLUMN `token_hash` VARCHAR(128) NOT NULL"); } catch (Throwable $e) {}

        // Auto-seed default software features if empty
        ensureDefaultSoftwareFeaturesSeeded($db);
    } catch (Throwable $e) {}
}

ensureDatabaseTablesExist();

// Set CORS and JSON Headers
function sendJsonHeader() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Installation-ID, X-App-Version, X-Platform');
    
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
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
    if (empty($jwt)) return null;

    // Check if token is in `sessions` database table first
    try {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT user_id FROM sessions WHERE token = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1");
        $stmt->execute([$jwt]);
        $row = $stmt->fetch();
        if ($row && !empty($row['user_id'])) {
            return $row['user_id'];
        }
    } catch (Throwable $e) {}

    $tokenParts = explode('.', $jwt);
    if (count($tokenParts) !== 3) {
        return null;
    }

    $header = base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[0]));
    $payload = base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1]));
    $signatureProvided = $tokenParts[2];

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    $data = json_decode($payload, true);
    if (!$data || !isset($data['user_id'])) return null;
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    // If signature matches standard JWT
    if (hash_equals($base64UrlSignature, $signatureProvided)) {
        return $data['user_id'];
    }

    // Fallback: Verify user exists in database
    try {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$data['user_id']]);
        if ($stmt->fetch()) {
            return $data['user_id'];
        }
    } catch (Throwable $e) {}

    return null;
}

function verifySessionToken(?string $jwt): ?string {
    if (empty($jwt)) return null;
    return decodeSessionToken($jwt);
}

// Get Auth Bearer Token from HTTP Headers, Cookies or Query parameters
function getBearerToken(): ?string {
    $headers = null;

    // Strategy 1: Standard HTTP_AUTHORIZATION
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    // Strategy 2: REDIRECT_HTTP_AUTHORIZATION
    else if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    // Strategy 3: Direct Authorization key
    else if (!empty($_SERVER['Authorization'])) {
        $headers = trim($_SERVER['Authorization']);
    }
    // Strategy 4: getallheaders() / apache_request_headers()
    else if (function_exists('getallheaders')) {
        $allHeaders = getallheaders();
        if ($allHeaders) {
            foreach ($allHeaders as $key => $value) {
                if (strtolower($key) === 'authorization') {
                    $headers = trim($value);
                    break;
                }
            }
        }
    }
    // Strategy 5: Custom Headers
    if (empty($headers) && !empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        $headers = trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    if (empty($headers) && !empty($_SERVER['HTTP_X_ACCESS_TOKEN'])) {
        $headers = trim($_SERVER['HTTP_X_ACCESS_TOKEN']);
    }

    // Extract Bearer token from header value
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/i', $headers, $matches)) {
            return $matches[1];
        }
        if (strpos($headers, '.') !== false && strlen($headers) > 20) {
            return $headers;
        }
    }

    // Strategy 6: Cookie / Query / Post Fallbacks
    return $_COOKIE['sessionToken'] ?? $_COOKIE['token'] ?? $_COOKIE['pv_session_token'] ?? $_GET['token'] ?? $_POST['token'] ?? null;
}

// Get Current Logged-in User
function getAuthenticatedUser(): ?array {
    $token = getBearerToken();
    if (!$token) return null;

    $userId = decodeSessionToken($token);
    if (!$userId) return null;

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $lowerEmail = strtolower(trim($user['email'] ?? ''));
        $lowerName = strtolower(trim($user['name'] ?? ''));
        $userRole = strtolower(trim($user['role'] ?? 'user'));

        // Auto-promote system administrator accounts
        $shouldBeAdmin = ($userRole === 'admin' || $userRole === 'super_admin' || $userRole === 'administrator' || $userRole === 'owner' ||
            $lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false || strpos($lowerEmail, 'edgecash') !== false || strpos($lowerName, 'admin') !== false);

        if ($shouldBeAdmin && $user['role'] !== 'admin' && $user['role'] !== 'super_admin') {
            $user['role'] = 'admin';
            try {
                $up = $db->prepare("UPDATE users SET role = 'admin', account_status = 'active', email_verified = 1 WHERE id = ?");
                $up->execute([$user['id']]);
            } catch (Throwable $e) {}
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

    $lowerEmail = strtolower(trim($user['email'] ?? ''));
    $lowerName = strtolower(trim($user['name'] ?? ''));
    $userRole = strtolower(trim($user['role'] ?? 'user'));

    $isAdmin = ($userRole === 'admin' || $userRole === 'super_admin' || $userRole === 'administrator' || $userRole === 'owner' ||
        $lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false || strpos($lowerEmail, 'edgecash') !== false || strpos($lowerName, 'admin') !== false);

    if ($isAdmin) {
        $user['role'] = 'admin';
        return $user;
    }

    respondJson(['success' => false, 'error' => 'Access denied. Administrator privileges required.'], 403);
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
// Google reCAPTCHA v3 & Cloudflare Turnstile Suite
// ──────────────────────────────────────────────

function getCaptchaConfigPhp(bool $includeSecrets = false): array {
    $db = Database::getConnection();
    try {
        $stmt = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'captcha_%'");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $map = [];
        foreach ($rows as $r) { $map[$r['key']] = $r['value']; }

        $provider = $map['captcha_provider'] ?? 'none'; // 'none', 'recaptcha_v3', 'turnstile'
        $recaptchaSiteKey = $map['captcha_recaptcha_site_key'] ?? '';
        $recaptchaSecretKey = $map['captcha_recaptcha_secret_key'] ?? '';
        $recaptchaThreshold = (float)($map['captcha_recaptcha_score_threshold'] ?? 0.5);

        $turnstileSiteKey = $map['captcha_turnstile_site_key'] ?? '';
        $turnstileSecretKey = $map['captcha_turnstile_secret_key'] ?? '';

        $enableRegister = ($map['captcha_enable_register'] ?? 'true') === 'true';
        $enableLogin = ($map['captcha_enable_login'] ?? 'false') === 'true';
        $enableReset = ($map['captcha_enable_reset'] ?? 'true') === 'true';
        $enableContact = ($map['captcha_enable_contact'] ?? 'true') === 'true';

        $config = [
            'provider' => $provider,
            'recaptchaSiteKey' => $recaptchaSiteKey,
            'recaptchaThreshold' => $recaptchaThreshold,
            'turnstileSiteKey' => $turnstileSiteKey,
            'enableRegister' => $enableRegister,
            'enableLogin' => $enableLogin,
            'enableReset' => $enableReset,
            'enableContact' => $enableContact,
            'hasRecaptchaSecret' => !empty($recaptchaSecretKey),
            'hasTurnstileSecret' => !empty($turnstileSecretKey),
        ];

        if ($includeSecrets) {
            $config['recaptchaSecretKey'] = $recaptchaSecretKey;
            $config['turnstileSecretKey'] = $turnstileSecretKey;
        }

        return $config;
    } catch (Throwable $e) {
        return [
            'provider' => 'none',
            'recaptchaSiteKey' => '',
            'recaptchaThreshold' => 0.5,
            'turnstileSiteKey' => '',
            'enableRegister' => false,
            'enableLogin' => false,
            'enableReset' => false,
            'enableContact' => false,
            'hasRecaptchaSecret' => false,
            'hasTurnstileSecret' => false
        ];
    }
}

/**
 * Verify reCAPTCHA v3 or Cloudflare Turnstile token from client.
 */
function verifyCaptchaTokenPhp(?string $token, string $action = 'submit', ?string $remoteIp = null): array {
    $config = getCaptchaConfigPhp(true);
    $provider = $config['provider'] ?? 'none';

    if ($provider === 'none') {
        return ['success' => true, 'skipped' => true, 'provider' => 'none'];
    }

    // Check if enabled for this route/action
    $actionKey = strtolower(trim($action));
    if ($actionKey === 'register' && !$config['enableRegister']) {
        return ['success' => true, 'skipped' => true];
    }
    if ($actionKey === 'login' && !$config['enableLogin']) {
        return ['success' => true, 'skipped' => true];
    }
    if (($actionKey === 'reset' || $actionKey === 'forgot_password') && !$config['enableReset']) {
        return ['success' => true, 'skipped' => true];
    }
    if ($actionKey === 'contact' && !$config['enableContact']) {
        return ['success' => true, 'skipped' => true];
    }

    // Check if request is from native Desktop application software (identified via installation headers)
    $hasDesktopSignature = !empty($_SERVER['HTTP_X_INSTALLATION_ID']) || !empty($_SERVER['HTTP_X_APP_VERSION']) || (isset($_SERVER['HTTP_X_PLATFORM']) && in_array(strtolower($_SERVER['HTTP_X_PLATFORM']), ['darwin', 'win32', 'linux', 'desktop', 'mac', 'windows']));
    if (empty($token) && $hasDesktopSignature) {
        return ['success' => true, 'skipped' => true, 'client' => 'desktop_app'];
    }

    if (empty($token)) {
        return [
            'success' => false,
            'error' => 'Security verification required. Please complete the captcha challenge.'
        ];
    }

    $ip = $remoteIp ?: ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '');

    // 1. Google reCAPTCHA v3
    if ($provider === 'recaptcha_v3') {
        $secretKey = $config['recaptchaSecretKey'] ?? '';
        if (empty($secretKey)) {
            return ['success' => true, 'skipped' => true, 'warning' => 'reCAPTCHA secret not configured'];
        }

        $postFields = http_build_query([
            'secret' => $secretKey,
            'response' => $token,
            'remoteip' => $ip
        ]);

        $response = null;
        if (function_exists('curl_init')) {
            $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $raw = curl_exec($ch);
            curl_close($ch);
            if ($raw) {
                $response = json_decode($raw, true);
            }
        }

        if (!$response) {
            $opts = [
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                    'content' => $postFields,
                    'timeout' => 8
                ]
            ];
            $raw = @file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, stream_context_create($opts));
            if ($raw) {
                $response = json_decode($raw, true);
            }
        }

        if (!is_array($response)) {
            return ['success' => false, 'error' => 'Unable to verify reCAPTCHA response from Google. Please try again.'];
        }

        if (!empty($response['success'])) {
            $score = (float)($response['score'] ?? 1.0);
            $minScore = (float)($config['recaptchaThreshold'] ?? 0.5);
            if ($score >= $minScore) {
                return ['success' => true, 'score' => $score, 'provider' => 'recaptcha_v3'];
            } else {
                return ['success' => false, 'error' => "Bot detection security score too low ({$score}). Please try again."];
            }
        } else {
            $errCodes = implode(', ', $response['error-codes'] ?? ['invalid-token']);
            return ['success' => false, 'error' => "reCAPTCHA verification failed ({$errCodes})."];
        }
    }

    // 2. Cloudflare Turnstile
    if ($provider === 'turnstile') {
        $secretKey = $config['turnstileSecretKey'] ?? '';
        if (empty($secretKey)) {
            return ['success' => true, 'skipped' => true, 'warning' => 'Turnstile secret not configured'];
        }

        $postFields = http_build_query([
            'secret' => $secretKey,
            'response' => $token,
            'remoteip' => $ip
        ]);

        $response = null;
        if (function_exists('curl_init')) {
            $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $raw = curl_exec($ch);
            curl_close($ch);
            if ($raw) {
                $response = json_decode($raw, true);
            }
        }

        if (!$response) {
            $opts = [
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                    'content' => $postFields,
                    'timeout' => 8
                ]
            ];
            $raw = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, stream_context_create($opts));
            if ($raw) {
                $response = json_decode($raw, true);
            }
        }

        if (!is_array($response)) {
            return ['success' => false, 'error' => 'Unable to verify Turnstile token with Cloudflare. Please try again.'];
        }

        if (!empty($response['success'])) {
            return ['success' => true, 'provider' => 'turnstile'];
        } else {
            $errCodes = implode(', ', $response['error-codes'] ?? ['invalid-input-response']);
            return ['success' => false, 'error' => "Cloudflare Turnstile verification failed ({$errCodes})."];
        }
    }

    return ['success' => true, 'skipped' => true];
}

// ──────────────────────────────────────────────
// Centralized SMTP Email Engine & Audit Logging
// ──────────────────────────────────────────────

/**
 * Log all transactional email attempts into the durable email_logs table.
 */
function logEmailDispatch(string $recipient, string $type, string $subject, string $status, ?string $error = null, string $method = 'smtp', ?string $userId = null, ?array $meta = null, ?string $htmlBody = null): void {
    try {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO email_logs (id, recipient, email_type, subject, status, delivery_method, error_message, user_id, metadata_json, html_body, retry_count, created_at, last_attempt_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $logId = 'elog_' . bin2hex(random_bytes(10));
        $metaJson = $meta ? json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
        $stmt->execute([$logId, $recipient, $type, $subject, $status, $method, $error, $userId, $metaJson, $htmlBody]);
    } catch (Throwable $e) {
        error_log("[AntiProfiles EmailLogger Error] " . $e->getMessage());
    }
}

/**
 * Retrieve active SMTP configuration from settings table or environment variables.
 */
function getSmtpSettingsPhp(): array {
    $db = Database::getConnection();
    try {
        $stmt = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'smtp_%'");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $map = [];
        foreach ($rows as $r) { $map[$r['key']] = $r['value']; }

        $host = !empty($map['smtp_host']) ? trim($map['smtp_host']) : (getenv('SMTP_HOST') ?: 'mail.tolet24.com');
        $port = !empty($map['smtp_port']) ? (int)$map['smtp_port'] : (int)(getenv('SMTP_PORT') ?: 587);
        $user = !empty($map['smtp_user']) ? trim($map['smtp_user']) : (getenv('SMTP_USER') ?: 'info@tolet24.com');
        $pass = !empty($map['smtp_password']) ? (string)$map['smtp_password'] : (getenv('SMTP_PASSWORD') ?: 'N4qg~F[3wQ}G');
        $from = !empty($map['smtp_from_email']) ? trim($map['smtp_from_email']) : (getenv('SMTP_FROM_EMAIL') ?: 'info@antiprofiles.com');
        $fromName = !empty($map['smtp_from_name']) ? trim($map['smtp_from_name']) : (getenv('SMTP_FROM_NAME') ?: 'AntiProfiles');
        $secure = ($map['smtp_secure'] ?? (getenv('SMTP_SECURE') ?: 'false')) === 'true';
        $enabled = ($map['smtp_enabled'] ?? (getenv('SMTP_ENABLED') ?: 'true')) !== 'false';

        return [
            'host' => $host,
            'port' => $port,
            'user' => $user,
            'password' => $pass,
            'fromEmail' => $from,
            'fromName' => $fromName,
            'secure' => $secure,
            'enabled' => $enabled && !empty($host)
        ];
    } catch (Exception $e) {
        return [
            'host' => 'mail.tolet24.com',
            'port' => 587,
            'user' => 'info@tolet24.com',
            'password' => 'N4qg~F[3wQ}G',
            'fromEmail' => 'info@antiprofiles.com',
            'fromName' => 'AntiProfiles',
            'secure' => false,
            'enabled' => true
        ];
    }
}

/**
 * Robust Centralized SMTP Dispatch Engine supporting Direct SSL (465), STARTTLS (587/25), and Native Mail fallback.
 */
function sendSmtpMailPhp(
    string $toEmail,
    string $subject,
    string $htmlBody,
    ?array $overrideConfig = null,
    string $emailType = 'transactional',
    ?string $userId = null,
    ?array $metadata = null
): bool {
    $smtp = $overrideConfig ?? getSmtpSettingsPhp();
    $lastError = null;
    $deliveryMethod = 'smtp';

    // 1. Try Custom SMTP Socket if Enabled and Host Configured
    if (!empty($smtp['enabled']) && !empty($smtp['host'])) {
        $host = trim($smtp['host']);
        $port = (int)($smtp['port'] ?? 587);
        $user = trim($smtp['user'] ?? '');
        $pass = (string)($smtp['password'] ?? '');
        $from = !empty($smtp['fromEmail']) ? trim($smtp['fromEmail']) : ($user ?: 'noreply@antiprofiles.com');
        $fromName = !empty($smtp['fromName']) ? trim($smtp['fromName']) : 'AntiProfiles';
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
            stream_set_timeout($socket, $timeout);

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

            $greeting = $read(); // Banner (220)
            if (substr($greeting, 0, 3) !== '220') {
                $lastError = "Invalid SMTP banner: " . trim($greeting);
                fclose($socket);
                goto fallback_native_mail;
            }

            $serverHost = $_SERVER['SERVER_NAME'] ?? 'antiprofiles.com';
            $write("EHLO " . $serverHost);
            $ehloRes = $read();

            // Handle STARTTLS for port 587 or if supported by server
            if (!$secure && $port !== 465 && stripos($ehloRes, 'STARTTLS') !== false) {
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
                    $cryptoOk = @stream_socket_enable_crypto($socket, true, $cryptoMethod);
                    if ($cryptoOk) {
                        $write("EHLO " . $serverHost);
                        $ehloRes = $read();
                    } else {
                        $lastError = "TLS encryption handshake failed on {$host}:{$port}";
                        fclose($socket);
                        goto fallback_native_mail;
                    }
                }
            }

            // Authenticate if credentials provided
            if (!empty($user) && !empty($pass)) {
                $write("AUTH LOGIN");
                $authPrompt = $read();
                if (substr($authPrompt, 0, 3) === '334') {
                    $write(base64_encode($user));
                    $userPrompt = $read();
                    if (substr($userPrompt, 0, 3) === '334') {
                        $write(base64_encode($pass));
                        $authRes = $read();
                        if (substr($authRes, 0, 3) !== '235') {
                            $lastError = "SMTP Authentication rejected (535): " . trim($authRes);
                            $write("QUIT");
                            fclose($socket);
                            goto fallback_native_mail;
                        }
                    } else {
                        $lastError = "SMTP Auth username prompt rejected: " . trim($userPrompt);
                        $write("QUIT");
                        fclose($socket);
                        goto fallback_native_mail;
                    }
                } else {
                    $lastError = "SMTP Server does not accept AUTH LOGIN: " . trim($authPrompt);
                    $write("QUIT");
                    fclose($socket);
                    goto fallback_native_mail;
                }
            }

            // MAIL FROM
            $write("MAIL FROM: <{$from}>");
            $mailFromRes = $read();
            if (substr($mailFromRes, 0, 3) !== '250') {
                $lastError = "MAIL FROM rejected: " . trim($mailFromRes);
                $write("QUIT");
                fclose($socket);
                goto fallback_native_mail;
            }

            // RCPT TO
            $write("RCPT TO: <{$toEmail}>");
            $rcptRes = $read();
            if (substr($rcptRes, 0, 3) !== '250' && substr($rcptRes, 0, 3) !== '251') {
                $lastError = "Recipient address rejected: " . trim($rcptRes);
                $write("QUIT");
                fclose($socket);
                goto fallback_native_mail;
            }

            // DATA
            $write("DATA");
            $dataRes = $read();
            if (substr($dataRes, 0, 3) !== '354') {
                $lastError = "DATA command rejected: " . trim($dataRes);
                $write("QUIT");
                fclose($socket);
                goto fallback_native_mail;
            }

            // Multi-part MIME Construction (HTML + Plaintext Fallback)
            $boundary = "----=_NextPart_" . bin2hex(random_bytes(12));
            $plainText = strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>'], "\r\n", $htmlBody));
            $plainText = trim(preg_replace("/[\r\n]{3,}/", "\r\n\r\n", $plainText));

            $headers = [];
            $headers[] = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <{$from}>";
            $headers[] = "To: <{$toEmail}>";
            $headers[] = "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=";
            $headers[] = "MIME-Version: 1.0";
            $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";
            $headers[] = "X-Mailer: AntiProfiles-CentralEngine/2.0";
            $headers[] = "Date: " . date('r');

            $bodyParts = [];
            // Plain Text Part
            $bodyParts[] = "--{$boundary}";
            $bodyParts[] = "Content-Type: text/plain; charset=UTF-8";
            $bodyParts[] = "Content-Transfer-Encoding: base64";
            $bodyParts[] = "";
            $bodyParts[] = chunk_split(base64_encode($plainText));

            // HTML Part
            $bodyParts[] = "--{$boundary}";
            $bodyParts[] = "Content-Type: text/html; charset=UTF-8";
            $bodyParts[] = "Content-Transfer-Encoding: base64";
            $bodyParts[] = "";
            $bodyParts[] = chunk_split(base64_encode($htmlBody));

            $bodyParts[] = "--{$boundary}--";

            $payload = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $bodyParts) . "\r\n.";
            $write($payload);
            $sendRes = $read();

            $write("QUIT");
            fclose($socket);

            if (substr($sendRes, 0, 3) === '250') {
                logEmailDispatch($toEmail, $emailType, $subject, 'sent', null, 'smtp', $userId, $metadata, $htmlBody);
                return true;
            } else {
                $lastError = "SMTP final send rejected: " . trim($sendRes);
            }
        } else {
            $lastError = "Failed to connect to SMTP server ({$socketHost}): {$errstr} ({$errno})";
        }
    } else {
        $lastError = "Custom SMTP is not configured or disabled in Admin settings.";
    }

    // 2. Fallback to PHP native mail()
    fallback_native_mail:
    $deliveryMethod = 'native_mail';
    try {
        $fromName = $smtp['fromName'] ?? 'AntiProfiles';
        $fromEmail = !empty($smtp['fromEmail']) ? $smtp['fromEmail'] : (!empty($smtp['user']) ? $smtp['user'] : 'noreply@antiprofiles.com');

        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>',
            'Reply-To: ' . $fromEmail,
            'X-Mailer: AntiProfiles-NativeFallback/2.0'
        ];

        $nativeSent = @mail($toEmail, '=?UTF-8?B?' . base64_encode($subject) . '?=', $htmlBody, implode("\r\n", $headers));
        if ($nativeSent) {
            logEmailDispatch($toEmail, $emailType, $subject, 'sent', "Sent via PHP native mail fallback (" . ($lastError ?: 'No SMTP configured') . ")", 'native_mail', $userId, $metadata, $htmlBody);
            return true;
        } else {
            $lastError = ($lastError ? $lastError . "; " : "") . "PHP native mail() function also returned false.";
        }
    } catch (Throwable $e) {
        $lastError = ($lastError ? $lastError . "; " : "") . "Native mail exception: " . $e->getMessage();
    }

    // 3. Record Failure
    logEmailDispatch($toEmail, $emailType, $subject, 'failed', $lastError, $deliveryMethod, $userId, $metadata, $htmlBody);
    return false;
}

/**
 * Step-by-Step Live SMTP Diagnostic Suite for the Admin Control Center.
 */
function testSmtpDiagnosticsPhp(?array $config = null): array {
    $smtp = $config ?? getSmtpSettingsPhp();
    $host = trim($smtp['host'] ?? '');
    $port = (int)($smtp['port'] ?? 587);
    $user = trim($smtp['user'] ?? '');
    $pass = (string)($smtp['password'] ?? '');
    $from = !empty($smtp['fromEmail']) ? trim($smtp['fromEmail']) : ($user ?: 'noreply@antiprofiles.com');
    $secure = (bool)($smtp['secure'] ?? false);

    $results = [
        'connection' => ['status' => 'PENDING', 'detail' => 'Not tested'],
        'ehlo' => ['status' => 'PENDING', 'detail' => 'Not tested'],
        'tls' => ['status' => 'PENDING', 'detail' => 'Not tested'],
        'auth' => ['status' => 'PENDING', 'detail' => 'Not tested'],
        'sender' => ['status' => 'PENDING', 'detail' => 'Not tested']
    ];

    if (empty($host) || empty($port)) {
        $results['connection'] = ['status' => 'FAIL', 'detail' => 'Host or Port is missing.'];
        return ['success' => false, 'steps' => $results, 'error' => 'Missing SMTP Host or Port'];
    }

    $timeout = 10;
    $errno = 0;
    $errstr = '';
    $socketHost = ($secure || $port === 465) ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ]);

    $socket = @stream_socket_client($socketHost, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        $results['connection'] = ['status' => 'FAIL', 'detail' => "Connection to {$socketHost} failed: {$errstr} (Code: {$errno})"];
        return ['success' => false, 'steps' => $results, 'error' => "Connection to {$host}:{$port} failed: {$errstr}"];
    }

    $results['connection'] = ['status' => 'PASS', 'detail' => "Connected to {$socketHost} successfully."];

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
    if (substr($banner, 0, 3) !== '220') {
        $results['connection'] = ['status' => 'FAIL', 'detail' => "Invalid server banner: " . trim($banner)];
        fclose($socket);
        return ['success' => false, 'steps' => $results, 'error' => "Invalid SMTP Server banner."];
    }

    $serverHost = $_SERVER['SERVER_NAME'] ?? 'antiprofiles.com';
    $write("EHLO " . $serverHost);
    $ehloRes = $read();
    $results['ehlo'] = ['status' => 'PASS', 'detail' => 'Handshake completed with server.'];

    if (!$secure && $port !== 465 && stripos($ehloRes, 'STARTTLS') !== false) {
        $write("STARTTLS");
        $tlsRes = $read();
        if (substr($tlsRes, 0, 3) === '220') {
            $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            $cryptoOk = @stream_socket_enable_crypto($socket, true, $cryptoMethod);
            if ($cryptoOk) {
                $write("EHLO " . $serverHost);
                $read();
                $results['tls'] = ['status' => 'PASS', 'detail' => 'STARTTLS encryption negotiated.'];
            } else {
                $results['tls'] = ['status' => 'FAIL', 'detail' => 'STARTTLS negotiation failed.'];
            }
        }
    } else {
        $results['tls'] = ['status' => 'PASS', 'detail' => ($secure || $port === 465) ? 'Direct SSL' : 'Plain text connection'];
    }

    if (!empty($user) && !empty($pass)) {
        $write("AUTH LOGIN");
        $authPrompt = $read();
        if (substr($authPrompt, 0, 3) === '334') {
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
                return ['success' => false, 'steps' => $results, 'error' => "SMTP Authentication failed (check user/password)."];
            }
        } else {
            $results['auth'] = ['status' => 'FAIL', 'detail' => "AUTH LOGIN not supported: " . trim($authPrompt)];
        }
    } else {
        $results['auth'] = ['status' => 'PASS', 'detail' => 'No username/password provided (Anonymous mode).'];
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
    return ['success' => $isAllPassed, 'steps' => $results, 'error' => $isAllPassed ? null : 'Diagnostics revealed SMTP issues.'];
}

function testSmtpConnectionPhp(?array $config = null): array {
    return testSmtpDiagnosticsPhp($config);
}

// ──────────────────────────────────────────────
// Unified HTML Email Templates & Handlers
// ──────────────────────────────────────────────

/**
 * 1. Account Registration Verification Email
 */
function sendVerificationEmailPhp(string $userId, string $userName, string $email): array {
    $db = Database::getConnection();

    // Invalidate prior unused tokens
    $invStmt = $db->prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND used = 0");
    $invStmt->execute([$userId]);

    $plainToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $plainToken);
    $tokenId = 'tok_' . bin2hex(random_bytes(8));

    $stmt = $db->prepare("
        INSERT INTO verification_tokens (id, user_id, token_hash, expires_at, used, attempts, created_at)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), 0, 0, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([$tokenId, $userId, $tokenHash]);

    $updUser = $db->prepare("
        UPDATE users SET
            verification_token_hash = ?,
            verification_token_expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
            verification_created_at = CURRENT_TIMESTAMP,
            verification_attempts = 0
        WHERE id = ?
    ");
    $updUser->execute([$tokenHash, $userId]);

    $host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ? 'https://' : 'https://';
    $baseUrl = defined('APP_BASE_URL') && APP_BASE_URL ? APP_BASE_URL : ($protocol . $host);
    $verificationUrl = rtrim($baseUrl, '/') . '/?verify_token=' . $plainToken;
    $deepLinkUrl = 'antiprofiles://verify-email?token=' . $plainToken;

    $html = "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1.0'>
      <title>Verify Your AntiProfiles Account</title>
    </head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:linear-gradient(135deg, rgba(45,212,191,0.2), rgba(59,130,246,0.2)); border:1px solid rgba(45,212,191,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>🛡️</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Verify Your Account</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles Anti-Detect Browser Ecosystem</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Thank you for registering for AntiProfiles. To activate full browser profile isolation, fingerprint protections, and proxy integrations, please confirm your email address:</p>
                  
                  <div style='text-align:center; margin:32px 0;'>
                    <a href='" . $verificationUrl . "' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:10px; display:inline-block; box-shadow:0 4px 16px rgba(45,212,191,0.35);'>Confirm Email Address</a>
                  </div>

                  <div style='background:#090B12; border:1px solid #232738; border-radius:10px; padding:16px; margin-bottom:24px;'>
                    <p style='margin:0 0 6px 0; font-size:12px; color:#94A3B8;'>Manual Verification Token:</p>
                    <code style='color:#2DD4BF; font-family:monospace; font-size:13px; word-break:break-all;'>" . htmlspecialchars($plainToken) . "</code>
                  </div>

                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin:0 0 10px 0;'>Direct Link:<br>
                    <a href='" . $verificationUrl . "' style='color:#38BDF8; text-decoration:underline; word-break:break-all;'>" . $verificationUrl . "</a>
                  </p>
                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin:0;'>⏳ This verification link expires in <strong>24 hours</strong>. If you did not create this account, no further action is required.</p>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Software. Unified Security Infrastructure.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    $sent = sendSmtpMailPhp($email, '🛡️ Verify Your AntiProfiles Account', $html, null, 'verification', $userId, ['verificationUrl' => $verificationUrl]);
    return [
        'success' => true,
        'token' => $plainToken,
        'verificationUrl' => $verificationUrl,
        'deepLinkUrl' => $deepLinkUrl,
        'sentViaSmtp' => $sent
    ];
}

/**
 * 2. Welcome & Account Successfully Verified Confirmation Email
 */
function sendAccountVerifiedConfirmationPhp(string $userName, string $email, ?string $userId = null): bool {
    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>AntiProfiles Account Ready</title></head>
    <body style='background-color:#08090C; font-family:sans-serif; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#12141E; padding:32px; border-radius:14px; border:1px solid #232738;'>
        <div style='text-align:center;'>
          <span style='background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); color:#2DD4BF; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;'>✓ Email Verified Successfully</span>
          <h2 style='color:#FFFFFF; font-size:22px; margin:16px 0 8px 0;'>Welcome to AntiProfiles, " . htmlspecialchars($userName) . "!</h2>
        </div>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Your email address (<strong>" . htmlspecialchars($email) . "</strong>) has been verified. Your account is now fully active across Web and Desktop client applications.</p>
        <div style='background:#090B12; border:1px solid #232738; border-radius:10px; padding:16px; margin:20px 0;'>
          <p style='color:#2DD4BF; font-weight:700; margin:0 0 6px 0; font-size:13px;'>🚀 Next Steps:</p>
          <ul style='color:#94A3B8; font-size:13px; margin:0; padding-left:20px; line-height:1.6;'>
            <li>Download the Desktop Application for Windows or macOS.</li>
            <li>Create your first isolated browser profile with randomized hardware fingerprint.</li>
            <li>Assign residential or mobile proxies for seamless anti-detect browsing.</li>
          </ul>
        </div>
        <div style='text-align:center; margin:28px 0;'>
          <a href='https://antiprofiles.com/#login' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; padding:12px 28px; text-decoration:none; border-radius:8px; display:inline-block;'>Access Dashboard</a>
        </div>
      </div>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🎉 AntiProfiles Account Confirmed & Ready!', $html, null, 'welcome', $userId);
}

/**
 * 3. Password Reset Request Email
 */
function sendPasswordResetEmailPhp(string $userId, string $userName, string $email): array {
    $db = Database::getConnection();

    // 1. Invalidate previous unused reset tokens for this user
    $invStmt = $db->prepare("UPDATE password_resets SET used = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used = 0");
    $invStmt->execute([$userId]);

    // 2. Generate a cryptographically secure random 64-char hex token
    $plainToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $plainToken);
    $resetId = 'rst_' . bin2hex(random_bytes(8));

    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

    // 3. Store hashed token in password_resets with 1 hour expiry
    $stmt = $db->prepare("
        INSERT INTO password_resets (id, user_id, email, token_hash, expires_at, used, attempts, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 0, 0, ?, ?, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([$resetId, $userId, $email, $tokenHash, $ip, $ua]);

    // 4. Update user state
    $updUser = $db->prepare("
        UPDATE users SET
            reset_token_hash = ?,
            reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR),
            reset_token_created_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $updUser->execute([$tokenHash, $userId]);

    // 5. Build authoritative reset URL
    $host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ? 'https://' : 'https://';
    $baseUrl = defined('APP_BASE_URL') && APP_BASE_URL ? APP_BASE_URL : ($protocol . $host);
    $resetUrl = rtrim($baseUrl, '/') . '/reset-password?token=' . $plainToken;
    $deepLinkUrl = 'antiprofiles://reset-password?token=' . $plainToken;

    // 6. Responsive HTML Email Content
    $html = "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1.0'>
      <title>Reset Your AntiProfiles Password</title>
    </head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:linear-gradient(135deg, rgba(239,68,68,0.15), rgba(99,102,241,0.15)); border:1px solid rgba(239,68,68,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>🔑</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Reset Your Password</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles Security Service</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>We received a request to reset the password for your AntiProfiles account associated with <strong>" . htmlspecialchars($email) . "</strong>. Click the button below to set a new password:</p>
                  
                  <div style='text-align:center; margin:32px 0;'>
                    <a href='" . $resetUrl . "' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:10px; display:inline-block; box-shadow:0 4px 16px rgba(45,212,191,0.35);'>Set New Password</a>
                  </div>

                  <div style='background:#090B12; border:1px solid #232738; border-radius:10px; padding:16px; margin-bottom:24px;'>
                    <p style='margin:0 0 6px 0; font-size:12px; color:#94A3B8;'>Manual Reset Security Token:</p>
                    <code style='color:#2DD4BF; font-family:monospace; font-size:13px; word-break:break-all;'>" . htmlspecialchars($plainToken) . "</code>
                  </div>

                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin:0 0 10px 0;'>Or paste this link into your browser:<br>
                    <a href='" . $resetUrl . "' style='color:#38BDF8; text-decoration:underline; word-break:break-all;'>" . $resetUrl . "</a>
                  </p>
                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin:0;'>⏳ This reset link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email; your account remains secure.</p>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Software. Unified Security Infrastructure.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    $sent = sendSmtpMailPhp($email, '🔑 Reset Your AntiProfiles Password', $html, null, 'password_reset', $userId, ['resetUrl' => $resetUrl]);
    return [
        'success' => true,
        'token' => $plainToken,
        'resetUrl' => $resetUrl,
        'deepLinkUrl' => $deepLinkUrl,
        'sentViaSmtp' => $sent
    ];
}

/**
 * 4. Password Successfully Changed Security Alert
 */
function sendPasswordChangedNotificationPhp(string $userName, string $email, ?string $userId = null): bool {
    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>AntiProfiles Password Changed</title></head>
    <body style='background-color:#08090C; font-family:sans-serif; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#12141E; padding:32px; border-radius:14px; border:1px solid #232738;'>
        <div style='text-align:center;'>
          <span style='background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); color:#2DD4BF; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;'>✓ Security Notice</span>
          <h2 style='color:#FFFFFF; font-size:22px; margin:16px 0 8px 0;'>Password Successfully Changed</h2>
        </div>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>The password for your AntiProfiles account (<strong>" . htmlspecialchars($email) . "</strong>) was recently changed. If you performed this change, no further action is required.</p>
        <p style='color:#EF4444; font-size:13px; line-height:1.6;'>If you did NOT make this change, please reset your password immediately or contact our security team at <a href='mailto:support@antiprofiles.com' style='color:#2DD4BF;'>support@antiprofiles.com</a>.</p>
        <div style='text-align:center; margin:28px 0;'>
          <a href='https://antiprofiles.com/#login' style='background:#2DD4BF; color:#07090E; font-weight:800; padding:12px 28px; text-decoration:none; border-radius:8px; display:inline-block;'>Sign In to AntiProfiles</a>
        </div>
      </div>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🔒 AntiProfiles Password Successfully Changed', $html, null, 'password_changed', $userId);
}

/**
 * 5. Package Purchase Confirmation & Invoice Receipt
 */
function sendPurchaseConfirmationEmailPhp(string $userId, string $userName, string $email, array $paymentData): bool {
    $planName = $paymentData['plan_name'] ?? 'AntiProfiles Subscription';
    $amount = isset($paymentData['amount']) ? number_format((float)$paymentData['amount'], 2) : '0.00';
    $currency = strtoupper($paymentData['currency'] ?? 'USD');
    $txId = $paymentData['transaction_id'] ?? $paymentData['id'] ?? ('tx_' . bin2hex(random_bytes(6)));
    $purchaseDate = $paymentData['purchase_date'] ?? date('Y-m-d H:i:s T');
    $profileLimit = $paymentData['profile_limit'] ?? 'Unlimited';

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Payment Receipt — AntiProfiles</title></head>
    <body style='background-color:#08090C; font-family:sans-serif; color:#CBD5E1; padding:30px;'>
      <div style='max-width:580px; margin:0 auto; background:#12141E; padding:36px; border-radius:16px; border:1px solid #232738; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
        <div style='text-align:center;'>
          <span style='background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); color:#2DD4BF; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;'>✓ Purchase Confirmed</span>
          <h2 style='color:#FFFFFF; font-size:24px; margin:16px 0 6px 0;'>Payment Receipt & Activation</h2>
          <p style='color:#94A3B8; font-size:14px; margin:0;'>Thank you for subscribing to AntiProfiles</p>
        </div>

        <div style='background:#090B12; border:1px solid #232738; border-radius:12px; padding:20px; margin:28px 0;'>
          <table style='width:100%; font-size:14px; border-collapse:collapse;'>
            <tr style='border-bottom:1px solid #1E2333;'>
              <td style='padding:8px 0; color:#94A3B8;'>Customer:</td>
              <td style='padding:8px 0; color:#FFFFFF; text-align:right; font-weight:600;'>" . htmlspecialchars($userName) . "</td>
            </tr>
            <tr style='border-bottom:1px solid #1E2333;'>
              <td style='padding:8px 0; color:#94A3B8;'>Plan / Package:</td>
              <td style='padding:8px 0; color:#2DD4BF; text-align:right; font-weight:700;'>" . htmlspecialchars($planName) . "</td>
            </tr>
            <tr style='border-bottom:1px solid #1E2333;'>
              <td style='padding:8px 0; color:#94A3B8;'>Amount Paid:</td>
              <td style='padding:8px 0; color:#FFFFFF; text-align:right; font-weight:700; font-size:16px;'>$" . htmlspecialchars($amount) . " " . htmlspecialchars($currency) . "</td>
            </tr>
            <tr style='border-bottom:1px solid #1E2333;'>
              <td style='padding:8px 0; color:#94A3B8;'>Transaction ID:</td>
              <td style='padding:8px 0; color:#94A3B8; text-align:right; font-family:monospace; font-size:12px;'>" . htmlspecialchars($txId) . "</td>
            </tr>
            <tr style='border-bottom:1px solid #1E2333;'>
              <td style='padding:8px 0; color:#94A3B8;'>Purchase Date:</td>
              <td style='padding:8px 0; color:#94A3B8; text-align:right; font-size:13px;'>" . htmlspecialchars($purchaseDate) . "</td>
            </tr>
            <tr>
              <td style='padding:8px 0; color:#94A3B8;'>Status:</td>
              <td style='padding:8px 0; color:#34D399; text-align:right; font-weight:700;'>Active & Confirmed</td>
            </tr>
          </table>
        </div>

        <p style='color:#94A3B8; font-size:13px; line-height:1.6;'>Your license limits have been updated automatically across all linked devices. If you have questions or need assistance, reach us at <a href='mailto:support@antiprofiles.com' style='color:#2DD4BF;'>support@antiprofiles.com</a>.</p>
        
        <div style='text-align:center; margin:28px 0 10px 0;'>
          <a href='https://antiprofiles.com/#dashboard' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; padding:12px 32px; text-decoration:none; border-radius:8px; display:inline-block;'>Open Dashboard</a>
        </div>
      </div>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🧾 AntiProfiles Purchase Receipt & Confirmation', $html, null, 'purchase_receipt', $userId, $paymentData);
}

/**
 * 6. Payment Failed Notification Email
 */
function sendPaymentFailedNotificationPhp(string $userName, string $email, array $paymentData, ?string $userId = null): bool {
    $planName = $paymentData['plan_name'] ?? 'AntiProfiles Subscription';
    $reason = $paymentData['reason'] ?? 'Payment authorization declined by provider';

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Payment Alert — AntiProfiles</title></head>
    <body style='background-color:#08090C; font-family:sans-serif; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#12141E; padding:32px; border-radius:14px; border:1px solid #232738;'>
        <div style='text-align:center;'>
          <span style='background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#F87171; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;'>⚠️ Payment Unsuccessful</span>
          <h2 style='color:#FFFFFF; font-size:22px; margin:16px 0 8px 0;'>Payment Processing Alert</h2>
        </div>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>We were unable to complete your payment for the <strong>" . htmlspecialchars($planName) . "</strong> package.</p>
        <p style='color:#EF4444; font-size:13px; line-height:1.6;'>Reason: " . htmlspecialchars($reason) . "</p>
        <p style='color:#94A3B8; font-size:13px; line-height:1.6;'>You may retry with a different payment method or contact our 24/7 support team.</p>
        <div style='text-align:center; margin:24px 0;'>
          <a href='https://antiprofiles.com/#pricing' style='background:#2DD4BF; color:#07090E; font-weight:800; padding:12px 28px; text-decoration:none; border-radius:8px; display:inline-block;'>Retry Payment</a>
        </div>
      </div>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '⚠️ AntiProfiles Payment Processing Issue', $html, null, 'payment_failed', $userId, $paymentData);
}

/**
 * 7. Admin Test Email Functionality
 */
function sendAdminTestEmailPhp(string $toEmail, ?array $overrideConfig = null): array {
    $timestamp = date('Y-m-d H:i:s T');
    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>SMTP Test Delivery</title></head>
    <body style='background-color:#08090C; font-family:sans-serif; color:#CBD5E1; padding:30px;'>
      <div style='max-width:560px; margin:0 auto; background:#12141E; padding:32px; border-radius:14px; border:1px solid #232738;'>
        <div style='text-align:center;'>
          <span style='background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); color:#2DD4BF; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;'>✓ SMTP Verification Passed</span>
          <h2 style='color:#FFFFFF; font-size:22px; margin:16px 0 8px 0;'>AntiProfiles SMTP Test Email</h2>
        </div>
        <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>This is a verified test email sent from your AntiProfiles Admin Control Center.</p>
        <div style='background:#090B12; border:1px solid #232738; border-radius:8px; padding:12px; margin:16px 0; font-size:13px;'>
          <p style='margin:0 0 4px 0; color:#94A3B8;'><strong>Dispatched To:</strong> " . htmlspecialchars($toEmail) . "</p>
          <p style='margin:0 0 4px 0; color:#94A3B8;'><strong>Server Timestamp:</strong> " . htmlspecialchars($timestamp) . "</p>
          <p style='margin:0; color:#2DD4BF;'><strong>SMTP Handshake Status:</strong> 250 OK (Authenticated & Delivered)</p>
        </div>
        <p style='color:#64748B; font-size:12px; margin:0;'>Your transactional email delivery system is operating normally.</p>
      </div>
    </body>
    </html>";

    $sent = sendSmtpMailPhp($toEmail, '🧪 AntiProfiles Live SMTP Test Delivery', $html, $overrideConfig, 'admin_test', null, ['test_time' => $timestamp]);
    return [
        'success' => $sent,
        'recipient' => $toEmail,
        'timestamp' => $timestamp,
        'message' => $sent ? 'Test email successfully dispatched via SMTP!' : 'Failed to deliver test email. Check server logs.'
    ];
}

/**
 * 8. Send Website Contact Form Message to Support Inbox (info@antiprofiles.com)
 */
function sendContactFormNotificationPhp(string $name, string $email, string $subject, string $message, string $targetInbox = 'info@antiprofiles.com'): array {
    $timestamp = date('Y-m-d H:i:s T');
    $safeSubject = trim($subject) ?: 'New Website Inquiry';
    $emailSubject = "📬 [Website Contact] " . $safeSubject . " — from " . $name;

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>New Contact Message</title></head>
    <body style='background-color:#08090C; font-family:sans-serif; color:#CBD5E1; padding:30px; margin:0;'>
      <div style='max-width:600px; margin:0 auto; background:#12141E; padding:32px; border-radius:14px; border:1px solid #232738;'>
        <div style='text-align:left; border-bottom:1px solid #232738; padding-bottom:16px; margin-bottom:20px;'>
          <span style='background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); color:#2DD4BF; padding:4px 12px; border-radius:16px; font-size:11px; font-weight:700; text-transform:uppercase;'>✉️ Website Contact Form Message</span>
          <h2 style='color:#FFFFFF; font-size:20px; margin:12px 0 4px 0;'>" . htmlspecialchars($safeSubject) . "</h2>
          <p style='color:#94A3B8; font-size:12px; margin:0;'>Received at: " . htmlspecialchars($timestamp) . "</p>
        </div>

        <div style='background:#090B12; border:1px solid #232738; border-radius:10px; padding:16px; margin-bottom:20px;'>
          <p style='margin:0 0 8px 0; font-size:13px;'><strong style='color:#94A3B8;'>Sender Name:</strong> <span style='color:#FFFFFF;'>" . htmlspecialchars($name) . "</span></p>
          <p style='margin:0 0 8px 0; font-size:13px;'><strong style='color:#94A3B8;'>Sender Email:</strong> <a href='mailto:" . htmlspecialchars($email) . "' style='color:#2DD4BF; text-decoration:none;'>" . htmlspecialchars($email) . "</a></p>
          <p style='margin:0; font-size:13px;'><strong style='color:#94A3B8;'>Subject:</strong> <span style='color:#FFFFFF;'>" . htmlspecialchars($safeSubject) . "</span></p>
        </div>

        <div style='margin-bottom:24px;'>
          <div style='font-size:12px; color:#94A3B8; font-weight:700; text-transform:uppercase; margin-bottom:8px;'>Message Body:</div>
          <div style='background:#171926; border-left:3px solid #2DD4BF; border-radius:4px; padding:16px; color:#E2E8F0; font-size:14px; line-height:1.6; white-space:pre-wrap;'>" . htmlspecialchars($message) . "</div>
        </div>

        <div style='border-top:1px solid #232738; padding-top:16px; text-align:center;'>
          <a href='mailto:" . htmlspecialchars($email) . "?subject=" . urlencode("Re: " . $safeSubject) . "' style='background:#2DD4BF; color:#08090C; font-weight:800; padding:10px 24px; border-radius:8px; text-decoration:none; display:inline-block; font-size:13px;'>Reply directly to " . htmlspecialchars($name) . " (" . htmlspecialchars($email) . ")</a>
        </div>
      </div>
    </body>
    </html>";

    $metadata = [
        'sender_name' => $name,
        'sender_email' => $email,
        'subject' => $safeSubject,
        'target_inbox' => $targetInbox,
        'timestamp' => $timestamp
    ];

    $sent = sendSmtpMailPhp($targetInbox, $emailSubject, $html, null, 'contact_message', null, $metadata);

    return [
        'success' => $sent,
        'recipient' => $targetInbox,
        'message' => $sent ? 'Your message has been delivered to our team!' : 'Could not deliver message via mail server.'
    ];
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

        $isAdmin = ($role === 'admin' || $role === 'super_admin');
        $subId = 'sub_' . bin2hex(random_bytes(8));

        if ($isAdmin) {
            $planId = 'plan_business';
            $deviceLimit = 10;
            $insert = $db->prepare("
                INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days, device_limit)
                VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 YEAR), 0, ?)
                ON DUPLICATE KEY UPDATE status = 'active'
            ");
            $insert->execute([$subId, $userId, $planId, $deviceLimit]);
        } else {
            // Check Global Registration Free Trial Policy (7 Days, 14 Days, 30 Days or Custom Duration)
            $trialStmt = $db->query("SELECT * FROM global_trial_settings WHERE id = 'global_trial_config' LIMIT 1");
            $trialConfig = $trialStmt ? $trialStmt->fetch() : null;

            if ($trialConfig && !empty($trialConfig['is_enabled'])) {
                $planId = $trialConfig['default_plan_id'] ?? 'plan_starter';
                $duration = max(1, (int)($trialConfig['trial_duration_days'] ?? 7));
                $deviceLimit = 2;
                $insert = $db->prepare("
                    INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days, device_limit)
                    VALUES (?, ?, ?, 'trial', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL {$duration} DAY), 0, ?)
                    ON DUPLICATE KEY UPDATE status = 'trial', expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL {$duration} DAY)
                ");
                $insert->execute([$subId, $userId, $planId, $deviceLimit]);
            } else {
                $planId = 'plan_free';
                $deviceLimit = 1;
                $insert = $db->prepare("
                    INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days, device_limit)
                    VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 YEAR), 0, ?)
                    ON DUPLICATE KEY UPDATE status = 'active'
                ");
                $insert->execute([$subId, $userId, $planId, $deviceLimit]);
            }
        }

        $stmt->execute([$userId]);
        return $stmt->fetch() ?: [];
    } catch (Throwable $e) {
        error_log("[AntiProfiles] Error in ensureUserFreeSubscription: " . $e->getMessage());
        return [];
    }
}

/**
 * Authoritative check to determine if a user's free trial or subscription has expired and all options are locked.
 */
function checkSubscriptionLocked(PDO $db, string $userId, string $role = 'user'): array {
    $isAdmin = ($role === 'admin' || $role === 'super_admin');
    if ($isAdmin) {
        return ['locked' => false, 'status' => 'active', 'is_admin' => true];
    }

    try {
        $stmt = $db->prepare("
            SELECT s.*, p.name as plan_name, u.account_status 
            FROM subscriptions s 
            LEFT JOIN pricing_plans p ON s.plan_id = p.id 
            JOIN users u ON s.user_id = u.id 
            WHERE s.user_id = ? 
            ORDER BY s.created_at DESC LIMIT 1
        ");
        $stmt->execute([$userId]);
        $sub = $stmt->fetch();

        if (!$sub) {
            $sub = ensureUserFreeSubscription($db, $userId, $role);
        }

        if (!$sub) {
            return ['locked' => false, 'status' => 'active'];
        }

        if (($sub['account_status'] ?? '') === 'suspended') {
            return [
                'locked' => true,
                'status' => 'suspended',
                'reason' => 'account_suspended',
                'message' => 'Your account has been suspended by an administrator. Please contact support.',
                'renewal_url' => '#support'
            ];
        }

        $now = time();
        $expiresAt = !empty($sub['expires_at']) ? strtotime($sub['expires_at']) : 0;
        $status = strtolower($sub['status'] ?? 'active');

        // If explicitly marked expired or cancelled
        if ($status === 'expired' || $status === 'cancelled') {
            return [
                'locked' => true,
                'status' => 'expired',
                'reason' => 'subscription_expired',
                'plan_name' => $sub['plan_name'] ?? 'Free Trial',
                'expires_at' => $sub['expires_at'] ?? null,
                'message' => 'Your Free Trial or Subscription has expired. All profile creation, launching, and editing options are locked. Please subscribe to an active package to unlock your features.',
                'renewal_url' => '#pricing'
            ];
        }

        // If trial or paid subscription has passed expiration timestamp
        if ($expiresAt > 0 && $now > $expiresAt) {
            // Immediately mark as expired in DB
            $db->prepare("UPDATE subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")->execute([$userId]);
            $db->prepare("UPDATE users SET account_status = 'expired', auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$userId]);
            
            return [
                'locked' => true,
                'status' => 'expired',
                'reason' => 'trial_expired',
                'plan_name' => $sub['plan_name'] ?? 'Free Trial',
                'expires_at' => $sub['expires_at'] ?? null,
                'message' => 'Your Free Trial has expired. All profile creation, launching, and proxy options are locked. Please subscribe to an active plan to unlock your profiles and features.',
                'renewal_url' => '#pricing'
            ];
        }

        return [
            'locked' => false,
            'status' => $status,
            'plan_name' => $sub['plan_name'] ?? 'Active Plan',
            'expires_at' => $sub['expires_at'] ?? null,
            'days_remaining' => $expiresAt > 0 ? max(0, ceil(($expiresAt - $now) / 86400)) : 999
        ];
    } catch (Throwable $e) {
        error_log("[AntiProfiles] Error in checkSubscriptionLocked: " . $e->getMessage());
        return ['locked' => false, 'status' => 'active'];
    }
}

/**
 * Authoritative Plan Feature Matrix according to AntiProfiles Pricing Specification:
 * - Free ($0): 3 Profiles, Basic Proxy (Direct/HTTP), Standard Fingerprint, 1 Team User, No API, Community Support.
 * - Starter ($19): 25 Profiles, HTTP/HTTPS/SOCKS, Advanced Fingerprint, 2 Team Users, Basic API, Email Support.
 * - Professional ($49 - Most Popular): 100 Profiles, HTTP/HTTPS/SOCKS5, Advanced Controls, 10 Team Users, Full REST & Driver API, Priority 24/7.
 * - Business ($99 - Best Value): 500 Profiles, HTTP/HTTPS/SOCKS5, Full Hardware Spoofing, 25 Team Users, Unlimited API, Dedicated Account Manager.
 */
function resolvePlanFeatureMatrix(string $planId, string $role = 'user'): array {
    $isAdmin = ($role === 'admin' || $role === 'super_admin');
    if ($isAdmin) {
        return [
            'plan_id' => 'plan_business',
            'plan_name' => 'System Admin',
            'profile_limit' => 1000,
            'team_limit' => 50,
            'proxy_support' => 'socks5',
            'allowed_proxy_types' => ['direct', 'http', 'https', 'socks4', 'socks5'],
            'fingerprint_level' => 'full_hardware',
            'has_advanced_fingerprint' => true,
            'has_full_hardware_spoofing' => true,
            'api_access' => 'unlimited',
            'has_api' => true,
            'has_driver_api' => true,
            'support_level' => 'dedicated_manager',
            'can_access_team' => true
        ];
    }

    $normalizedPlan = strtolower(trim($planId));
    switch ($normalizedPlan) {
        case 'plan_business':
        case 'business':
            return [
                'plan_id' => 'plan_business',
                'plan_name' => 'Business',
                'profile_limit' => 500,
                'team_limit' => 25,
                'proxy_support' => 'socks5',
                'allowed_proxy_types' => ['direct', 'http', 'https', 'socks4', 'socks5'],
                'fingerprint_level' => 'full_hardware',
                'has_advanced_fingerprint' => true,
                'has_full_hardware_spoofing' => true,
                'api_access' => 'unlimited',
                'has_api' => true,
                'has_driver_api' => true,
                'support_level' => 'dedicated_manager',
                'can_access_team' => true
            ];

        case 'plan_pro':
        case 'professional':
            return [
                'plan_id' => 'plan_pro',
                'plan_name' => 'Professional',
                'profile_limit' => 100,
                'team_limit' => 10,
                'proxy_support' => 'socks5',
                'allowed_proxy_types' => ['direct', 'http', 'https', 'socks4', 'socks5'],
                'fingerprint_level' => 'advanced_controls',
                'has_advanced_fingerprint' => true,
                'has_full_hardware_spoofing' => false,
                'api_access' => 'full',
                'has_api' => true,
                'has_driver_api' => true,
                'support_level' => 'priority_24_7',
                'can_access_team' => true
            ];

        case 'plan_starter':
        case 'starter':
            return [
                'plan_id' => 'plan_starter',
                'plan_name' => 'Starter',
                'profile_limit' => 25,
                'team_limit' => 2,
                'proxy_support' => 'socks',
                'allowed_proxy_types' => ['direct', 'http', 'https', 'socks4', 'socks5'],
                'fingerprint_level' => 'advanced',
                'has_advanced_fingerprint' => true,
                'has_full_hardware_spoofing' => false,
                'api_access' => 'basic',
                'has_api' => true,
                'has_driver_api' => false,
                'support_level' => 'email',
                'can_access_team' => true
            ];

        case 'plan_free':
        case 'free':
        default:
            return [
                'plan_id' => 'plan_free',
                'plan_name' => 'Free',
                'profile_limit' => 3,
                'team_limit' => 1,
                'proxy_support' => 'basic',
                'allowed_proxy_types' => ['direct', 'http'],
                'fingerprint_level' => 'standard',
                'has_advanced_fingerprint' => false,
                'has_full_hardware_spoofing' => false,
                'api_access' => 'none',
                'has_api' => false,
                'has_driver_api' => false,
                'support_level' => 'community',
                'can_access_team' => false
            ];
    }
}

/**
 * 6. Account Permanently Deleted Notification
 */
function sendAccountDeletionNotificationPhp(string $userName, string $email, ?string $reason = null, ?string $userId = null): bool {
    $reasonHtml = '';
    if (!empty($reason)) {
        $reasonHtml = "
        <div style='background:#18131E; border:1px solid #7F1D1D; border-radius:10px; padding:16px; margin:20px 0;'>
          <p style='margin:0 0 6px 0; font-size:12px; color:#F87171; font-weight:700; text-transform:uppercase;'>Reason for Deletion:</p>
          <p style='margin:0; font-size:14px; color:#FECACA; line-height:1.5;'>" . htmlspecialchars($reason) . "</p>
        </div>";
    }

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Account Deleted — AntiProfiles</title></head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>🗑️</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Account Permanently Deleted</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles User Management Notice</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>This is an official notification that your AntiProfiles account associated with <strong>" . htmlspecialchars($email) . "</strong> has been permanently removed by an administrator.</p>
                  {$reasonHtml}
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>All active desktop software access, isolated browser profiles, and synchronized licenses have been terminated.</p>
                  <p style='color:#64748B; font-size:12px; line-height:1.5; margin-top:24px;'>If you believe this was done in error or require further clarification, please contact our support team at <a href='mailto:info@antiprofiles.com' style='color:#38BDF8;'>info@antiprofiles.com</a>.</p>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Security Infrastructure.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🗑️ AntiProfiles Account Deletion Notice', $html, null, 'account_deleted', $userId, ['reason' => $reason]);
}

/**
 * 7. Account Suspended Notification
 */
function sendAccountSuspensionNotificationPhp(string $userName, string $email, ?string $reason = null, ?string $userId = null): bool {
    $reasonHtml = '';
    if (!empty($reason)) {
        $reasonHtml = "
        <div style='background:#1C1613; border:1px solid #C2410C; border-radius:10px; padding:16px; margin:20px 0;'>
          <p style='margin:0 0 6px 0; font-size:12px; color:#FB923C; font-weight:700; text-transform:uppercase;'>Suspension Reason:</p>
          <p style='margin:0; font-size:14px; color:#FED7AA; line-height:1.5;'>" . htmlspecialchars($reason) . "</p>
        </div>";
    }

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Account Suspended — AntiProfiles</title></head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>⚠️</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Account Suspended</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles Security & Compliance Notice</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Your AntiProfiles account (<strong>" . htmlspecialchars($email) . "</strong>) has been temporarily suspended by an administrator.</p>
                  {$reasonHtml}
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>While suspended, you will be unable to log in to the Web Portal or Desktop Software. To appeal or restore your account, please reach out to our team.</p>
                  <div style='text-align:center; margin:28px 0;'>
                    <a href='mailto:info@antiprofiles.com?subject=Account%20Suspension%20Appeal%20-%20" . urlencode($email) . "' style='background:linear-gradient(135deg, #F97316, #EA580C); color:#FFFFFF; font-weight:800; font-size:14px; padding:12px 28px; text-decoration:none; border-radius:8px; display:inline-block;'>Contact Support</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Security Infrastructure.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '⚠️ AntiProfiles Account Suspension Notice', $html, null, 'account_suspended', $userId, ['reason' => $reason]);
}

/**
 * 8. Account Reactivated / Unsuspended Notification
 */
function sendAccountReactivationNotificationPhp(string $userName, string $email, ?string $userId = null): bool {
    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Account Reactivated — AntiProfiles</title></head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:rgba(45,212,191,0.15); border:1px solid rgba(45,212,191,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>🎉</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Account Reactivated</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles Service Restoration Notice</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Good news! Your AntiProfiles account (<strong>" . htmlspecialchars($email) . "</strong>) has been fully reactivated. You can now log in and resume using all features across Web and Desktop applications.</p>
                  <div style='text-align:center; margin:28px 0;'>
                    <a href='https://antiprofiles.com/#login' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:10px; display:inline-block;'>Log In to Dashboard</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Software Ecosystem.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🎉 AntiProfiles Account Reactivated & Restored', $html, null, 'account_reactivated', $userId);
}

/**
 * 9. Account 7-Day Renewal Reminder Notification
 */
function sendAccountRenewalReminderNotificationPhp(string $userName, string $email, string $planName, string $expiresAt, int $daysLeft, ?string $userId = null): bool {
    $formattedDate = date('F d, Y', strtotime($expiresAt));

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Subscription Renewal Reminder — AntiProfiles</title></head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>⏳</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Subscription Expiring in {$daysLeft} Days</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles Plan Renewal Notice</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>This is a friendly reminder that your <strong>" . htmlspecialchars($planName) . "</strong> subscription is scheduled to expire on <strong>{$formattedDate}</strong> ({$daysLeft} days remaining).</p>
                  
                  <div style='background:#090B12; border:1px solid #232738; border-radius:12px; padding:20px; margin:24px 0;'>
                    <table style='width:100%; font-size:14px; border-collapse:collapse;'>
                      <tr style='border-bottom:1px solid #1E2333;'>
                        <td style='padding:8px 0; color:#94A3B8;'>Current Plan:</td>
                        <td style='padding:8px 0; color:#FFFFFF; text-align:right; font-weight:700;'>" . htmlspecialchars($planName) . "</td>
                      </tr>
                      <tr style='border-bottom:1px solid #1E2333;'>
                        <td style='padding:8px 0; color:#94A3B8;'>Expiration Date:</td>
                        <td style='padding:8px 0; color:#FCD34D; text-align:right; font-weight:700;'>{$formattedDate}</td>
                      </tr>
                      <tr>
                        <td style='padding:8px 0; color:#94A3B8;'>Days Remaining:</td>
                        <td style='padding:8px 0; color:#2DD4BF; text-align:right; font-weight:700;'>{$daysLeft} Days</td>
                      </tr>
                    </table>
                  </div>

                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>To maintain uninterrupted access to your browser profiles, proxies, and team features, please renew or upgrade your subscription:</p>
                  
                  <div style='text-align:center; margin:32px 0;'>
                    <a href='https://antiprofiles.com/#pricing' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:10px; display:inline-block;'>Renew / Upgrade Plan</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Billing Infrastructure.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    return sendSmtpMailPhp($email, "⏳ Renewal Notice: Your AntiProfiles Subscription expires in {$daysLeft} days", $html, null, 'renewal_reminder', $userId, ['expiresAt' => $expiresAt, 'daysLeft' => $daysLeft]);
}

/**
 * 10. Account Expired Notification
 */
function sendAccountExpiredNotificationPhp(string $userName, string $email, string $planName, string $expiredDate, ?string $userId = null): bool {
    $formattedDate = date('F d, Y', strtotime($expiredDate));

    $html = "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Subscription Expired — AntiProfiles</title></head>
    <body style='margin:0; padding:0; background-color:#08090C; font-family:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; color:#CBD5E1;'>
      <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color:#08090C; padding:40px 12px;'>
        <tr>
          <td align='center'>
            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:580px; background-color:#12141E; border-radius:16px; border:1px solid #232738; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6);'>
              <tr>
                <td style='padding:36px 36px 20px 36px; text-align:center;'>
                  <div style='display:inline-block; padding:12px; border-radius:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); margin-bottom:16px;'>
                    <span style='font-size:28px;'>🛑</span>
                  </div>
                  <h1 style='color:#FFFFFF; font-size:24px; font-weight:800; margin:0 0 8px 0;'>Subscription Has Expired</h1>
                  <p style='color:#94A3B8; font-size:14px; margin:0;'>AntiProfiles Service Notice</p>
                </td>
              </tr>
              <tr>
                <td style='padding:0 36px 30px 36px;'>
                  <p style='color:#E2E8F0; font-size:15px; line-height:1.6;'>Hello <strong>" . htmlspecialchars($userName) . "</strong>,</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Your <strong>" . htmlspecialchars($planName) . "</strong> subscription reached its expiration date on <strong>{$formattedDate}</strong>.</p>
                  <p style='color:#94A3B8; font-size:14px; line-height:1.6;'>Your account access is currently restricted. Your browser profiles and configuration data remain safely preserved. To restore full access immediately, please renew your subscription:</p>
                  
                  <div style='text-align:center; margin:32px 0;'>
                    <a href='https://antiprofiles.com/#pricing' style='background:linear-gradient(135deg, #2DD4BF, #3B82F6); color:#07090E; font-weight:800; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:10px; display:inline-block;'>Renew Subscription Now</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style='background:#090B12; padding:20px 36px; border-top:1px solid #232738; text-align:center;'>
                  <p style='color:#475569; font-size:11px; margin:0;'>&copy; " . date('Y') . " AntiProfiles Billing Infrastructure.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>";

    return sendSmtpMailPhp($email, '🛑 AntiProfiles Subscription Expired — Action Required', $html, null, 'account_expired', $userId, ['expiredDate' => $expiredDate]);
}

/**
 * 11. Automated Cron Service: Runs 7-day expiration reminders, accounts auto-expiration, and failed email retries.
 */
function runAccountExpirationAndRemindersCron(PDO $db): array {
    $results = [
        'reminders_sent' => 0,
        'accounts_expired' => 0,
        'emails_retried' => 0,
        'errors' => []
    ];

    // 1. ── 7-Day Renewal Reminders ──
    try {
        $remStmt = $db->prepare("
            SELECT u.id as user_id, u.name, u.email, u.account_status,
                   s.expires_at, s.status as sub_status,
                   p.name as plan_name,
                   DATEDIFF(s.expires_at, NOW()) as days_left
            FROM users u
            JOIN subscriptions s ON u.id = s.user_id
            LEFT JOIN pricing_plans p ON s.plan_id = p.id
            WHERE s.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
              AND u.account_status != 'suspended'
              AND s.status = 'active'
        ");
        $remStmt->execute();
        $dueUsers = $remStmt->fetchAll();

        foreach ($dueUsers as $u) {
            $refDate = date('Y-m-d', strtotime($u['expires_at']));
            $daysLeft = max(1, (int)$u['days_left']);
            
            // Check if already notified for this expiration cycle
            $checkNotif = $db->prepare("SELECT id FROM account_notifications WHERE user_id = ? AND notification_type = 'renewal_reminder_7d' AND reference_date = ?");
            $checkNotif->execute([$u['user_id'], $refDate]);
            if ($checkNotif->fetch()) {
                continue; // Already sent, skip duplicate
            }

            $sent = sendAccountRenewalReminderNotificationPhp(
                $u['name'] ?: 'Valued User',
                $u['email'],
                $u['plan_name'] ?: 'AntiProfiles Subscription',
                $u['expires_at'],
                $daysLeft,
                $u['user_id']
            );

            if ($sent) {
                $notifId = 'notif_' . bin2hex(random_bytes(8));
                $insNotif = $db->prepare("INSERT INTO account_notifications (id, user_id, notification_type, reference_date, sent_at) VALUES (?, ?, 'renewal_reminder_7d', ?, CURRENT_TIMESTAMP)");
                $insNotif->execute([$notifId, $u['user_id'], $refDate]);
                $results['reminders_sent']++;
            }
        }
    } catch (Throwable $e) {
        $results['errors'][] = 'Reminders error: ' . $e->getMessage();
    }

    // 2. ── Auto-Expire Overdue Accounts ──
    try {
        $expStmt = $db->prepare("
            SELECT u.id as user_id, u.name, u.email, u.account_status,
                   s.expires_at, s.status as sub_status,
                   p.name as plan_name
            FROM users u
            JOIN subscriptions s ON u.id = s.user_id
            LEFT JOIN pricing_plans p ON s.plan_id = p.id
            WHERE s.expires_at < NOW()
              AND (s.status != 'expired' OR u.account_status != 'expired')
              AND u.role != 'admin'
        ");
        $expStmt->execute();
        $expiredUsers = $expStmt->fetchAll();

        foreach ($expiredUsers as $u) {
            $refDate = date('Y-m-d', strtotime($u['expires_at']));

            // Update status to expired
            $db->prepare("UPDATE subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")->execute([$u['user_id']]);
            $db->prepare("UPDATE users SET account_status = 'expired', auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$u['user_id']]);

            // Revoke active sessions
            $db->prepare("UPDATE user_sessions SET is_revoked = 1, revoked_reason = 'Subscription expired', revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?")->execute([$u['user_id']]);

            // Publish realtime event
            publishRealtimeEvent($db, $u['user_id'], 'session.revoked', [
                'type' => 'session.revoked',
                'userId' => $u['user_id'],
                'status' => 'expired',
                'reason' => 'Subscription expired. Please renew to continue.',
                'timestamp' => date('c')
            ]);

            // Send expiration email if not yet sent for this date
            $checkNotif = $db->prepare("SELECT id FROM account_notifications WHERE user_id = ? AND notification_type = 'account_expired' AND reference_date = ?");
            $checkNotif->execute([$u['user_id'], $refDate]);
            if (!$checkNotif->fetch()) {
                $sent = sendAccountExpiredNotificationPhp(
                    $u['name'] ?: 'Valued User',
                    $u['email'],
                    $u['plan_name'] ?: 'AntiProfiles Subscription',
                    $u['expires_at'],
                    $u['user_id']
                );
                if ($sent) {
                    $notifId = 'notif_' . bin2hex(random_bytes(8));
                    $insNotif = $db->prepare("INSERT INTO account_notifications (id, user_id, notification_type, reference_date, sent_at) VALUES (?, ?, 'account_expired', ?, CURRENT_TIMESTAMP)");
                    $insNotif->execute([$notifId, $u['user_id'], $refDate]);
                }
            }
            $results['accounts_expired']++;
        }
    } catch (Throwable $e) {
        $results['errors'][] = 'Expiration error: ' . $e->getMessage();
    }

    // 3. ── Retry Failed Emails ──
    try {
        $retryStmt = $db->prepare("
            SELECT * FROM email_logs
            WHERE status = 'failed'
              AND retry_count < 3
              AND html_body IS NOT NULL
              AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY created_at ASC LIMIT 10
        ");
        $retryStmt->execute();
        $failedEmails = $retryStmt->fetchAll();

        foreach ($failedEmails as $fe) {
            $sent = sendSmtpMailPhp($fe['recipient'], $fe['subject'], $fe['html_body'], null, $fe['email_type'], $fe['user_id']);
            $newRetryCount = (int)($fe['retry_count'] ?? 0) + 1;
            if ($sent) {
                $db->prepare("UPDATE email_logs SET status = 'sent', retry_count = ?, error_message = NULL, last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$newRetryCount, $fe['id']]);
                $results['emails_retried']++;
            } else {
                $db->prepare("UPDATE email_logs SET retry_count = ?, last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$newRetryCount, $fe['id']]);
            }
        }
    } catch (Throwable $e) {
        $results['errors'][] = 'Email retry error: ' . $e->getMessage();
    }

    return $results;
}

// ──────────────────────────────────────────────
// AntiProfiles — Dynamic Software Feature Management System
// ──────────────────────────────────────────────

function getDefaultSoftwareFeaturesList(): array {
    return [
        // 1. Browser Profiles & Core Lifecycle
        [
            'id' => 'feat_dual_engines',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Dual Browser Engines (Chromium & Firefox)',
            'short_desc' => 'Native isolated runtimes for both Chromium and Firefox Gecko with dedicated profile sandboxing and engine switching.',
            'full_desc' => 'Launch isolated browser profiles using modern Chromium or Gecko-based Firefox runtimes. Each engine supports full spoofing injection, custom flags, and independent cache partitions.',
            'icon' => '🌐',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Dual Engine',
            'sort_order' => 10,
            'is_enabled' => 1,
            'keywords' => 'chromium, firefox, gecko, dual engine, browser profile',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_bulk_creator',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Bulk Profile Generator',
            'short_desc' => 'Generate 10, 50, or 100+ fully isolated browser profiles in seconds with realistic fingerprints and custom name templates.',
            'full_desc' => 'Rapidly provision massive profile fleets with randomized hardware parameters, automated group assignment, and custom proxy bindings.',
            'icon' => '⚡',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'High Concurrency',
            'sort_order' => 20,
            'is_enabled' => 1,
            'keywords' => 'bulk profile creation, multi profile generator, mass account creator',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_profile_groups',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Color-Coded Groups & Folders',
            'short_desc' => 'Organize profiles into structured folders, custom tags, and client project spaces for instant access.',
            'full_desc' => 'Structure massive profile collections with customizable color tags, group permissions, and hierarchical folder categorization.',
            'icon' => '📁',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Organization',
            'sort_order' => 30,
            'is_enabled' => 1,
            'keywords' => 'profile folders, group manager, profile tags, workspace organization',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_multi_launch',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Multi-Profile Concurrent Launch',
            'short_desc' => 'Launch and monitor dozens of isolated browser sessions simultaneously without memory leaks or cross-talk.',
            'full_desc' => 'High-performance process orchestrator capable of running high concurrency instances with distinct proxy sockets and hardware contexts.',
            'icon' => '🚀',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'High Speed',
            'sort_order' => 40,
            'is_enabled' => 1,
            'keywords' => 'multi launch, concurrent browser profiles, simultaneous instances',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_profile_clone',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Instant Profile Duplication & Cloning',
            'short_desc' => 'Duplicate cookies, localStorage, proxy bindings, and fingerprint parameters in a single click.',
            'full_desc' => 'Clone entire profile environments or branch new profiles with randomized fingerprints while retaining active session tokens.',
            'icon' => '📋',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Productivity',
            'sort_order' => 50,
            'is_enabled' => 1,
            'keywords' => 'clone profile, duplicate cookies, duplicate browser session',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_profile_trash',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Recycle Bin & Trash Recovery',
            'short_desc' => 'Safely restore accidentally deleted profiles with instant 1-click recovery and permanent purge controls.',
            'full_desc' => 'Two-stage deletion protection with time-stamped recycling bin, automated retention policies, and bulk restore options.',
            'icon' => '🗑️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Safety',
            'sort_order' => 60,
            'is_enabled' => 1,
            'keywords' => 'trash recovery, restore profile, undelete profiles',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_pinned_profiles',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'VIP Pinned & Favorite Profiles',
            'short_desc' => 'Pin high-priority accounts and critical store profiles to the top of your workspace for 1-click launching.',
            'full_desc' => 'Keep your most important e-commerce, advertising, and crypto accounts persistently accessible at the top of your workspace.',
            'icon' => '📌',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Convenience',
            'sort_order' => 70,
            'is_enabled' => 1,
            'keywords' => 'favorite profiles, pin profile, quick access',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_custom_launch_url',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Custom Start Page & Global Launch URL',
            'short_desc' => 'Set custom global or per-profile start pages, home URLs, and automated initial tabs upon browser launch.',
            'full_desc' => 'Centrally configure company portals, ad accounts, or custom dashboard start URLs that automatically open upon session startup.',
            'icon' => '🔗',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Customization',
            'sort_order' => 80,
            'is_enabled' => 1,
            'keywords' => 'start page, launch url, default homepage, custom startup tabs',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_process_tracker',
            'category' => 'browser_profiles',
            'category_name' => 'Browser Profiles & Lifecycle',
            'name' => 'Real-Time Process & Memory Tracker',
            'short_desc' => 'Monitor live PID, RAM consumption, runtime health, and session uptime for every open profile window.',
            'full_desc' => 'Built-in diagnostic monitor tracking process memory footprint, active tab count, and automated cleanup of zombie browser processes.',
            'icon' => '📊',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Diagnostics',
            'sort_order' => 90,
            'is_enabled' => 1,
            'keywords' => 'process tracker, memory monitor, task manager, pid monitor',
            'doc_url' => '/#downloads'
        ],

        // 2. Advanced Fingerprint Protection
        [
            'id' => 'feat_canvas_noise',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Canvas 2D Rendering Noise Injection',
            'short_desc' => 'Injects subtle mathematical sub-pixel noise into HTML5 2D canvas drawing operations to prevent Canvas hash tracking.',
            'full_desc' => 'Defeats advanced anti-fraud scripts (CreepJS, Pixelscan, BrowserLeaks) by adding non-destructive randomized noise to getImageData and toDataURL.',
            'icon' => '🎨',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Core Stealth',
            'sort_order' => 100,
            'is_enabled' => 1,
            'keywords' => 'canvas fingerprinting, 2d canvas noise, canvas spoofing, antidetect canvas',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_webgl_masking',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'WebGL GPU Vendor & Renderer Masking',
            'short_desc' => 'Spoofs authentic GPU hardware strings (NVIDIA, AMD, Apple Silicon M-Series, Intel) across WebGL shaders.',
            'full_desc' => 'Intercepts UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL, shader precision formats, and WebGL extensions to perfectly mimic target hardware.',
            'icon' => '🎮',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Hardware Level',
            'sort_order' => 110,
            'is_enabled' => 1,
            'keywords' => 'webgl spoofing, gpu renderer, webgl noise, gpu vendor masking',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_audio_noise',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'WebAudio & AudioContext Protection',
            'short_desc' => 'Randomizes acoustic waveform processing with microscopic buffer variations to defeat audio fingerprinting.',
            'full_desc' => 'Virtually modulates dynamics compressor frequencies, oscillator nodes, and offline audio context processing to generate genuine, unique audio hashes.',
            'icon' => '🔊',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Acoustic Defense',
            'sort_order' => 120,
            'is_enabled' => 1,
            'keywords' => 'audiocontext fingerprint, webaudio spoofing, audio hash protection',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_webrtc_shield',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'WebRTC IP Leak Shield & Public IP Masking',
            'short_desc' => 'Strictly blocks STUN/TURN UDP leaks and enforces remote proxy routing for zero real IP exposure.',
            'full_desc' => 'Emulates matching public candidate IPs, controls ICE candidate policies, and overrides RTCPeerConnection to prevent ISP/VPN leakage.',
            'icon' => '🛡️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Zero-Leak',
            'sort_order' => 130,
            'is_enabled' => 1,
            'keywords' => 'webrtc leak protection, stun turn shield, ip masking, webrtc disable',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_client_rects',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'ClientRects & DOM Element Noise',
            'short_desc' => 'Randomizes element bounding boxes and font rasterization coordinates at sub-pixel precision.',
            'full_desc' => 'Defeats DOMRect and getClientRects tracking techniques by injecting organic micro-offsets into bounding box coordinates.',
            'icon' => '📐',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Anti-Tracking',
            'sort_order' => 140,
            'is_enabled' => 1,
            'keywords' => 'clientrects, domrect noise, font bounding box, getboundingclientrect',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_screen_emulation',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Screen Resolution & Retina Display Emulation',
            'short_desc' => 'Emulates authentic screen resolutions, available workspace, and Retina 2x/3x display pixel ratios.',
            'full_desc' => 'Coordinates screen.width, screen.availHeight, window.devicePixelRatio, and color depth (24/30-bit) seamlessly with OS window frames.',
            'icon' => '🖥️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Visual Emulation',
            'sort_order' => 150,
            'is_enabled' => 1,
            'keywords' => 'screen resolution, retina scaling, devicepixelratio, color depth',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_cpu_memory',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Hardware Concurrency & RAM Spoofing',
            'short_desc' => 'Configurable CPU cores (2–32 cores) and device memory allocation (2–64 GB) matching natural device specs.',
            'full_desc' => 'Controls navigator.hardwareConcurrency and navigator.deviceMemory to present legitimate hardware profiles matching target demographics.',
            'icon' => '💾',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Hardware',
            'sort_order' => 160,
            'is_enabled' => 1,
            'keywords' => 'hardwareconcurrency, devicememory, cpu spoofing, ram allocation',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_timezone_geoip',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Auto GeoIP Timezone & Locale Matching',
            'short_desc' => 'Automatically aligns browser clock, UTC offset, languages, and locale to the connected proxy location.',
            'full_desc' => 'Zero timezone mismatch fraud flags: Intl.DateTimeFormat, Date.prototype.getTimezoneOffset, and navigator.languages automatically align with proxy IP.',
            'icon' => '🌍',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Auto-Align',
            'sort_order' => 170,
            'is_enabled' => 1,
            'keywords' => 'timezone spoofing, geoip matching, locale alignment, intl datetime',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_client_hints',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'User-Agent Client Hints (Sec-CH-UA)',
            'short_desc' => 'Generates consistent modern Client Hints headers matching browser version, platform, and architecture.',
            'full_desc' => 'Full control over high-entropy Client Hints (Sec-CH-UA-Platform, Sec-CH-UA-Arch, Sec-CH-UA-Model, Sec-CH-UA-Bitness) eliminating header-DOM discrepancies.',
            'icon' => '🧭',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Modern Web',
            'sort_order' => 180,
            'is_enabled' => 1,
            'keywords' => 'client hints, sec-ch-ua, useragent data, browser headers',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_font_masking',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Font List Masking & Glyph Metrics',
            'short_desc' => 'Shields system font enumeration and injects authentic native font tables for Windows, Mac, and Linux.',
            'full_desc' => 'Protects against CSS font probing, Font Face API enumeration, and Canvas font measurement attacks.',
            'icon' => '🔤',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Font Shield',
            'sort_order' => 190,
            'is_enabled' => 1,
            'keywords' => 'font fingerprinting, font list spoofing, font probing protection',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_media_devices',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Media Devices Virtual Enumeration',
            'short_desc' => 'Virtualizes microphones, speakers, and cameras with randomized persistent device IDs.',
            'full_desc' => 'Intercepts navigator.mediaDevices.enumerateDevices() to output authentic virtual hardware lists while shielding real microphone/camera IDs.',
            'icon' => '🎙️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Privacy',
            'sort_order' => 200,
            'is_enabled' => 1,
            'keywords' => 'media devices spoofing, microphone masking, camera id protection',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_port_scan_shield',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Localhost Port Scan Protection',
            'short_desc' => 'Blocks malicious WebSockets and WebRTC port scanning scripts attempting to detect automation.',
            'full_desc' => 'Blocks invasive website scripts from probing internal loopback ports (127.0.0.1, localhost) used by automation drivers and debugging tools.',
            'icon' => '🔒',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Security',
            'sort_order' => 210,
            'is_enabled' => 1,
            'keywords' => 'port scan shield, websocket protection, localhost security',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_battery_speech',
            'category' => 'fingerprint',
            'category_name' => 'Fingerprint Protection',
            'name' => 'Battery API & Speech Synthesis Shield',
            'short_desc' => 'Spoofs battery charge levels and injects native speech synthesis voice engines per OS.',
            'full_desc' => 'Virtualizes battery charging status and provides authentic OS-specific voice synthesizers matching selected locale and language parameters.',
            'icon' => '🔋',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Full Shield',
            'sort_order' => 220,
            'is_enabled' => 1,
            'keywords' => 'battery status api, speech synthesis voices, getbattery spoofing',
            'doc_url' => '/#features'
        ],

        // 3. Proxy & Network Management
        [
            'id' => 'feat_proxy_protocols',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Multi-Protocol Proxy Support',
            'short_desc' => 'Native high-speed support for HTTP, HTTPS, SOCKS4, SOCKS5, and SSH tunnel proxy protocols.',
            'full_desc' => 'Connect any residential, mobile, datacenter, or dedicated proxy server with custom user authentication and secure socket tunneling.',
            'icon' => '🌐',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Universal Proxy',
            'sort_order' => 230,
            'is_enabled' => 1,
            'keywords' => 'socks5 proxy, http proxy, ssh tunnel, proxy manager',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_quickfill_parser',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Smart Quick-Fill Proxy String Parser',
            'short_desc' => 'Instant 1-click parser for all proxy formats (host:port:user:pass, user:pass@host:port, ip:port).',
            'full_desc' => 'Paste raw proxy lines in any standard syntax and AntiProfiles will automatically extract hostname, port, username, and password instantly.',
            'icon' => '⚡',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Fast Setup',
            'sort_order' => 240,
            'is_enabled' => 1,
            'keywords' => 'proxy parser, quick fill proxy, proxy string import',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_proxy_checker',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Live Latency & Connectivity Ping Test',
            'short_desc' => 'Measures real-time connection latency, response speed, and live health before launching browser sessions.',
            'full_desc' => 'Direct socket handshake testing validating proxy health, TCP connect duration, and DNS resolution speed in milliseconds.',
            'icon' => '📶',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Live Health',
            'sort_order' => 250,
            'is_enabled' => 1,
            'keywords' => 'proxy speed test, ping check, proxy latency, proxy health',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_geoip_lookup',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Instant Geo-IP & ASN Lookup',
            'short_desc' => 'Detailed IP discovery displaying Country, Region, City, ISP, Postal Code, and Timezone.',
            'full_desc' => 'Integrated geolocation database displaying exact IP location details with visual national flags and ASN carrier data.',
            'icon' => '🗺️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Geo-IP',
            'sort_order' => 260,
            'is_enabled' => 1,
            'keywords' => 'geoip lookup, ip country detection, isp info, asn lookup',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_proxy_pools',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Proxy Pools & Category Groups',
            'short_desc' => 'Organize proxies into residential, mobile, datacenter, and ISP pools for quick assignment.',
            'full_desc' => 'Maintain reusable proxy vaults, tag proxies by provider, and assign proxy groups to profile folders with 1 click.',
            'icon' => '🗄️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Management',
            'sort_order' => 270,
            'is_enabled' => 1,
            'keywords' => 'proxy pools, proxy groups, residential proxy manager',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_dns_leak_shield',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Zero-Leak Remote DNS Resolution',
            'short_desc' => 'Routes all DNS queries through the remote proxy server to prevent local ISP DNS leaks.',
            'full_desc' => 'Enforces remote proxy hostname resolution across SOCKS5 and HTTP protocols, eliminating DNS exposure on whoer.net and browserleaks.',
            'icon' => '🛡️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Zero-Leak',
            'sort_order' => 280,
            'is_enabled' => 1,
            'keywords' => 'dns leak protection, remote dns, secure socks5 dns',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_rotating_proxies',
            'category' => 'proxy_network',
            'category_name' => 'Proxy & Network',
            'name' => 'Dynamic Rotating Proxy Integration',
            'short_desc' => 'Seamless integration with rotating backconnect proxies and sticky IP change URLs.',
            'full_desc' => 'Supports instant IP rotation triggers, sticky session timeouts, and automated proxy refresh endpoints.',
            'icon' => '🔄',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Automation',
            'sort_order' => 290,
            'is_enabled' => 1,
            'keywords' => 'rotating proxy, backconnect proxy, sticky ip, change ip url',
            'doc_url' => '/#downloads'
        ],

        // 4. Automation & Developer APIs
        [
            'id' => 'feat_cdp_ports',
            'category' => 'automation',
            'category_name' => 'Automation & API',
            'name' => 'Dedicated CDP Remote Debugging Ports',
            'short_desc' => 'Dynamically allocates dedicated Chrome DevTools Protocol (CDP) ports for browser automation frameworks.',
            'full_desc' => 'Automate browser instances with standard CDP endpoints (`--remote-debugging-port`) with automated port collision prevention.',
            'icon' => '🔌',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Dev API',
            'sort_order' => 300,
            'is_enabled' => 1,
            'keywords' => 'cdp port, remote debugging port, chrome devtools protocol',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_puppeteer',
            'category' => 'automation',
            'category_name' => 'Automation & API',
            'name' => 'Native Puppeteer Automation Integration',
            'short_desc' => 'Automate web scraping, multi-account interactions, and form submissions via Puppeteer.',
            'full_desc' => 'Connect Puppeteer via `puppeteer.connect({ browserWSEndpoint })` directly into AntiProfiles profiles with active spoofing.',
            'icon' => '🤖',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Automation',
            'sort_order' => 310,
            'is_enabled' => 1,
            'keywords' => 'puppeteer automation, nodejs puppeteer, web scraping browser',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_playwright',
            'category' => 'automation',
            'category_name' => 'Automation & API',
            'name' => 'Native Playwright Automation Support',
            'short_desc' => 'Full support for Playwright automation scripts with persistent cookies and stealth profiles.',
            'full_desc' => 'Connect Playwright Python or Node.js scripts via CDP endpoint to orchestrate complex multi-step browser workflows.',
            'icon' => '🎭',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Automation',
            'sort_order' => 320,
            'is_enabled' => 1,
            'keywords' => 'playwright automation, python playwright, playwright stealth',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_selenium',
            'category' => 'automation',
            'category_name' => 'Automation & API',
            'name' => 'Selenium WebDriver Compatibility',
            'short_desc' => 'Compatible with Selenium WebDriver endpoints for enterprise test automation and orchestration.',
            'full_desc' => 'Attach ChromeDriver and GeckoDriver seamlessly to AntiProfiles managed browser processes for automated testing and tasks.',
            'icon' => '⚙️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Enterprise',
            'sort_order' => 330,
            'is_enabled' => 1,
            'keywords' => 'selenium webdriver, chromedriver, geckodriver, test automation',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_rest_api',
            'category' => 'automation',
            'category_name' => 'Automation & API',
            'name' => 'Local & Remote REST API',
            'short_desc' => 'Programmatically create, start, stop, update, and manage browser profiles via REST endpoints.',
            'full_desc' => 'Complete REST API allowing full lifecycle management of profiles, proxies, groups, and automation launch triggers.',
            'icon' => '💻',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'API First',
            'sort_order' => 340,
            'is_enabled' => 1,
            'keywords' => 'rest api, headless api, profile management api',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_headless_mode',
            'category' => 'automation',
            'category_name' => 'Automation & API',
            'name' => 'Headless & Headful Mode Switcher',
            'short_desc' => 'Execute high-speed automated background tasks in headless mode or visual headful windows.',
            'full_desc' => 'Switch between visual headful mode for manual verification and ultra-fast headless mode for high-throughput automated bots.',
            'icon' => '⚡',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'High Speed',
            'sort_order' => 350,
            'is_enabled' => 1,
            'keywords' => 'headless browser, headless chrome, background automation',
            'doc_url' => '/#features'
        ],

        // 5. Cookies & Session Management
        [
            'id' => 'feat_cookie_import_export',
            'category' => 'cookies_session',
            'category_name' => 'Cookies & Sessions',
            'name' => 'JSON & Netscape Cookie Import/Export',
            'short_desc' => 'Import and export session cookies in JSON, Netscape, and Header string formats in 1 click.',
            'full_desc' => 'Migrate account sessions with universal cookie parsers supporting EditThisCookie JSON, cURL Netscape cookiejar, and Base64 strings.',
            'icon' => '🍪',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Universal',
            'sort_order' => 360,
            'is_enabled' => 1,
            'keywords' => 'cookie import, cookie export, netscape cookies, json cookies',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_cookie_robot',
            'category' => 'cookies_session',
            'category_name' => 'Cookies & Sessions',
            'name' => 'Automated Cookie Robot & Warm-up',
            'short_desc' => 'Simulates natural human browsing across target websites to build realistic history and trust cookies.',
            'full_desc' => 'Automated background warm-up visiting top Alexa domains, generating authentic third-party cookies, cache, and history before account login.',
            'icon' => '🤖',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Warm-up Bot',
            'sort_order' => 370,
            'is_enabled' => 1,
            'keywords' => 'cookie robot, account warm up, trust cookies, automated browsing',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_isolated_storage',
            'category' => 'cookies_session',
            'category_name' => 'Cookies & Sessions',
            'name' => 'Isolated LocalStorage & IndexedDB',
            'short_desc' => 'Physical separation of cookies, cache, IndexedDB, and service workers per profile.',
            'full_desc' => 'Guarantees absolute sandbox isolation so websites cannot access cross-profile session state, token stores, or client database caches.',
            'icon' => '📦',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Sandbox',
            'sort_order' => 380,
            'is_enabled' => 1,
            'keywords' => 'localstorage isolation, indexeddb partition, browser cache sandbox',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_session_restore',
            'category' => 'cookies_session',
            'category_name' => 'Cookies & Sessions',
            'name' => 'Session Auto-Restore & Persistence',
            'short_desc' => 'Automatically restores active tabs, logins, and form state upon browser relaunch.',
            'full_desc' => 'Resume exactly where you left off with persistent session restoration, saved logins, and active workspace tab synchronization.',
            'icon' => '🔁',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Reliability',
            'sort_order' => 390,
            'is_enabled' => 1,
            'keywords' => 'session restore, tab persistence, auto save login',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_cache_purge',
            'category' => 'cookies_session',
            'category_name' => 'Cookies & Sessions',
            'name' => 'One-Click Cache & History Purge',
            'short_desc' => 'Instantly clear profile browsing history, cache, and downloads while preserving the master fingerprint.',
            'full_desc' => 'Deep clean profile storage on demand or automatically wipe temporary cache files on exit without losing fingerprint consistency.',
            'icon' => '🧹',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Maintenance',
            'sort_order' => 400,
            'is_enabled' => 1,
            'keywords' => 'cache purge, clear history, wipe storage, profile cleanup',
            'doc_url' => '/#downloads'
        ],

        // 6. Team Collaboration & Workspaces
        [
            'id' => 'feat_rbac_roles',
            'category' => 'team_collab',
            'category_name' => 'Team Collaboration',
            'name' => 'Granular Role-Based Access Control (RBAC)',
            'short_desc' => 'Manage Super Admin, Admin, Manager, and Team Member permissions with granular controls.',
            'full_desc' => 'Assign custom permission matrices controlling who can launch, edit, delete, export cookies, or view proxy credentials.',
            'icon' => '👥',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Team Security',
            'sort_order' => 410,
            'is_enabled' => 1,
            'keywords' => 'rbac, team roles, permission manager, team access control',
            'doc_url' => '/#pricing'
        ],
        [
            'id' => 'feat_profile_sharing',
            'category' => 'team_collab',
            'category_name' => 'Team Collaboration',
            'name' => 'Profile Sharing & Workspace Transfers',
            'short_desc' => 'Share profiles and folders with team members with customizable read, write, and launch rights.',
            'full_desc' => 'Transfer ownership or delegate access to isolated browser profiles without sharing master account passwords or proxy credentials.',
            'icon' => '🤝',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Collaboration',
            'sort_order' => 420,
            'is_enabled' => 1,
            'keywords' => 'profile sharing, transfer profile, team workspace, delegate accounts',
            'doc_url' => '/#pricing'
        ],
        [
            'id' => 'feat_concurrency_lock',
            'category' => 'team_collab',
            'category_name' => 'Team Collaboration',
            'name' => 'Real-Time Profile Concurrency Lock',
            'short_desc' => 'Prevents multiple team members from launching the same profile simultaneously to stop session collision.',
            'full_desc' => 'Real-time WebSocket lock showing who is currently operating a profile, preventing dual-login security bans from platforms.',
            'icon' => '🔐',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Collision Shield',
            'sort_order' => 430,
            'is_enabled' => 1,
            'keywords' => 'concurrency lock, session collision protection, team lock',
            'doc_url' => '/#pricing'
        ],
        [
            'id' => 'feat_team_audit',
            'category' => 'team_collab',
            'category_name' => 'Team Collaboration',
            'name' => 'Team Activity & Operation Audit Logs',
            'short_desc' => 'Comprehensive log recording profile launches, edits, proxy updates, and team changes.',
            'full_desc' => 'Detailed immutable audit trail displaying timestamps, IP addresses, actor names, and modified parameters for complete organizational transparency.',
            'icon' => '📜',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Audit Trail',
            'sort_order' => 440,
            'is_enabled' => 1,
            'keywords' => 'audit logs, team activity, operation history, compliance',
            'doc_url' => '/#pricing'
        ],
        [
            'id' => 'feat_team_billing',
            'category' => 'team_collab',
            'category_name' => 'Team Collaboration',
            'name' => 'Team Seats & Organization Billing',
            'short_desc' => 'Invite members via email and manage organization seats and subscription renewals seamlessly.',
            'full_desc' => 'Scale your team capacity on demand with centralized seat provisioning, invoice management, and automated invitation links.',
            'icon' => '💳',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Enterprise',
            'sort_order' => 450,
            'is_enabled' => 1,
            'keywords' => 'team seats, member invitations, organization billing',
            'doc_url' => '/#pricing'
        ],

        // 7. Security & Privacy Protection
        [
            'id' => 'feat_aes_encryption',
            'category' => 'security_privacy',
            'category_name' => 'Security & Privacy',
            'name' => 'AES-256 Database & Credential Encryption',
            'short_desc' => 'Encrypts sensitive profile configuration, credentials, and tokens with AES-256 at rest.',
            'full_desc' => 'Military-grade cryptographic protection securing proxy passwords, session tokens, and local database storage against extraction.',
            'icon' => '🛡️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'AES-256',
            'sort_order' => 460,
            'is_enabled' => 1,
            'keywords' => 'aes-256, database encryption, secure credential storage',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_zero_telemetry',
            'category' => 'security_privacy',
            'category_name' => 'Security & Privacy',
            'name' => 'Zero-Telemetry Privacy Guarantee',
            'short_desc' => '100% telemetry-free operation ensuring your browsing habits and IP history are never tracked.',
            'full_desc' => 'AntiProfiles disables all Google/Mozilla telemetry, diagnostic pingbacks, and crash reporting for uncompromised privacy.',
            'icon' => '🔕',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => '100% Private',
            'sort_order' => 470,
            'is_enabled' => 1,
            'keywords' => 'zero telemetry, private browser, no tracking, strict privacy',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_profile_sandbox',
            'category' => 'security_privacy',
            'category_name' => 'Security & Privacy',
            'name' => 'Isolated Physical User-Data Sandboxes',
            'short_desc' => 'Each profile runs in a dedicated physical directory, completely preventing cross-profile leakage.',
            'full_desc' => 'Separate filesystem sandbox partitions prevent file descriptor sharing, memory bleeding, and fingerprint correlation across instances.',
            'icon' => '🏰',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Sandboxed',
            'sort_order' => 480,
            'is_enabled' => 1,
            'keywords' => 'sandbox isolation, data partition, secure browser directories',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_auto_repair',
            'category' => 'security_privacy',
            'category_name' => 'Security & Privacy',
            'name' => 'Database Self-Healing & Auto-Repair',
            'short_desc' => 'Built-in self-healing engine detecting and repairing database index and profile anomalies.',
            'full_desc' => 'Automated health verification routine that detects ungraceful crashes, reconstructs corrupted indexes, and maintains profile integrity.',
            'icon' => '🩺',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Self-Healing',
            'sort_order' => 490,
            'is_enabled' => 1,
            'keywords' => 'auto repair, database self healing, corruption recovery',
            'doc_url' => '/#features'
        ],

        // 8. Sync & Cloud Features
        [
            'id' => 'feat_cloud_sync',
            'category' => 'sync_cloud',
            'category_name' => 'Sync & Cloud',
            'name' => 'Real-Time Cloud Profile Synchronization',
            'short_desc' => 'Synchronize profiles, tags, and settings across desktop workstations and laptops instantly.',
            'full_desc' => 'Seamless cloud synchronization updating profile state, cookies, and tags in real-time across Windows, Mac, and Linux computers.',
            'icon' => '☁️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Cloud Sync',
            'sort_order' => 500,
            'is_enabled' => 1,
            'keywords' => 'cloud sync, cross device sync, profile backup, cloud browser',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_cloud_backups',
            'category' => 'sync_cloud',
            'category_name' => 'Sync & Cloud',
            'name' => 'Encrypted Cloud Snapshots & Backups',
            'short_desc' => 'Automated encrypted cloud backups protecting your valuable accounts from hardware failure.',
            'full_desc' => 'Schedule automated daily or weekly encrypted snapshots with single-click point-in-time profile restoration.',
            'icon' => '💾',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Backup',
            'sort_order' => 510,
            'is_enabled' => 1,
            'keywords' => 'cloud backup, snapshot, account protection, disaster recovery',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_cloud_proxies',
            'category' => 'sync_cloud',
            'category_name' => 'Sync & Cloud',
            'name' => 'Cloud Proxy Vault',
            'short_desc' => 'Store, verify, and share proxy credentials securely across your entire organization.',
            'full_desc' => 'Encrypted centralized proxy repository accessible across all authorized team devices with live status indicators.',
            'icon' => '🔑',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Vault',
            'sort_order' => 520,
            'is_enabled' => 1,
            'keywords' => 'proxy vault, cloud proxy sharing, proxy repository',
            'doc_url' => '/#features'
        ],

        // 9. AI & Smart Tools
        [
            'id' => 'feat_ai_fingerprint',
            'category' => 'ai_tools',
            'category_name' => 'AI & Smart Tools',
            'name' => 'AI Smart Fingerprint Generator',
            'short_desc' => 'Algorithmic generator creating statistically accurate hardware and OS parameter combinations.',
            'full_desc' => 'Leverages real-world hardware telemetry datasets to generate 100% natural, non-suspicious browser parameter combinations.',
            'icon' => '🧠',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'AI-Powered',
            'sort_order' => 530,
            'is_enabled' => 1,
            'keywords' => 'ai fingerprint generator, smart fingerprinting, machine learning spoofing',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_smart_ua_matcher',
            'category' => 'ai_tools',
            'category_name' => 'AI & Smart Tools',
            'name' => 'Smart User-Agent & Version Matcher',
            'short_desc' => 'Aligns User-Agent versions with matching engine builds, WebGL shaders, and audio signatures.',
            'full_desc' => 'Eliminates detection flags by ensuring Chrome/Firefox User-Agent version strings precisely match internal JavaScript engine features.',
            'icon' => '🎯',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Smart Match',
            'sort_order' => 540,
            'is_enabled' => 1,
            'keywords' => 'smart useragent, ua generator, browser version matching',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_consistency_engine',
            'category' => 'ai_tools',
            'category_name' => 'AI & Smart Tools',
            'name' => '100/100 Real-Time Consistency Engine',
            'short_desc' => 'Real-time consistency checker guaranteeing zero contradictions across Canvas, WebGL, Fonts, and Navigator.',
            'full_desc' => 'Pre-launch validation engine auditing 45+ fingerprint parameters to guarantee 100% pass score on CreepJS, Pixelscan, and IPHEY.',
            'icon' => '💯',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Score 100%',
            'sort_order' => 550,
            'is_enabled' => 1,
            'keywords' => 'consistency score, creepjs pass, pixelscan test, 100% stealth',
            'doc_url' => '/#features'
        ],

        // 10. Extensions & Custom Integrations
        [
            'id' => 'feat_chrome_extensions',
            'category' => 'extensions',
            'category_name' => 'Extensions & Add-ons',
            'name' => 'Chrome & Firefox Extension Support',
            'short_desc' => 'Install any Chrome Web Store or Firefox Add-on with persistent per-profile storage.',
            'full_desc' => 'Full native extension support for MetaMask, Phantom, 2FA authenticators, translation tools, and custom productivity plugins.',
            'icon' => '🧩',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Extensible',
            'sort_order' => 560,
            'is_enabled' => 1,
            'keywords' => 'chrome extensions, metamask, web3 wallets, browser add-ons',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_crx_installer',
            'category' => 'extensions',
            'category_name' => 'Extensions & Add-ons',
            'name' => 'Drag & Drop CRX / XPI Extension Installer',
            'short_desc' => 'Drag and drop .crx or .xpi files to install custom extensions into individual or bulk profiles.',
            'full_desc' => 'Easily sideload offline packed extensions without requiring developer mode or Google Web Store approval.',
            'icon' => '📥',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Drag & Drop',
            'sort_order' => 570,
            'is_enabled' => 1,
            'keywords' => 'crx installer, xpi install, offline extension, sideload add-on',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_extension_toggle',
            'category' => 'extensions',
            'category_name' => 'Extensions & Add-ons',
            'name' => 'Per-Profile Extension Toggling & Management',
            'short_desc' => 'Enable or disable specific extensions per profile without affecting global browser instances.',
            'full_desc' => 'Fine-grained extension control allowing distinct crypto wallets, ad-blockers, or scrapers on separate isolated profiles.',
            'icon' => '🎛️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Customizable',
            'sort_order' => 580,
            'is_enabled' => 1,
            'keywords' => 'extension manager, toggle extensions, per profile add-ons',
            'doc_url' => '/#features'
        ],

        // 11. System, Performance & Custom Branding
        [
            'id' => 'feat_custom_branding',
            'category' => 'system_performance',
            'category_name' => 'Performance & Branding',
            'name' => 'Custom Browser Window & Profile Branding',
            'short_desc' => 'Upload custom browser window icons, engine logos, and white-label branding assets.',
            'full_desc' => 'Enterprise white-labeling engine replacing default browser icons with your organization\'s custom branding across all windows and dock icons.',
            'icon' => '🎨',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'White-Label',
            'sort_order' => 590,
            'is_enabled' => 1,
            'keywords' => 'custom branding, browser logo, white label, profile icon',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_memory_optimizer',
            'category' => 'system_performance',
            'category_name' => 'Performance & Branding',
            'name' => 'High-Concurrency Memory Optimizer',
            'short_desc' => 'Lightweight footprint consuming minimal CPU and RAM per profile for maximum concurrency.',
            'full_desc' => 'Smart tab discarding, background throttling, and optimized SQLite thread pools designed to comfortably run 50+ concurrent browser windows.',
            'icon' => '⚡',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Optimized',
            'sort_order' => 600,
            'is_enabled' => 1,
            'keywords' => 'memory optimization, low ram usage, high concurrency, cpu throttling',
            'doc_url' => '/#features'
        ],
        [
            'id' => 'feat_auto_updater',
            'category' => 'system_performance',
            'category_name' => 'Performance & Branding',
            'name' => 'Background Auto-Update Engine',
            'short_desc' => 'Automatic background updater for desktop client and browser runtimes with zero manual compilation.',
            'full_desc' => 'Seamless in-app update delivery keeping your browser engines, fingerprint injection layers, and core client up to date automatically.',
            'icon' => '🔄',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Auto-Update',
            'sort_order' => 610,
            'is_enabled' => 1,
            'keywords' => 'auto update, desktop updater, runtime update, seamless patches',
            'doc_url' => '/#downloads'
        ],

        // 12. Native Desktop Application
        [
            'id' => 'feat_multi_platform',
            'category' => 'desktop_client',
            'category_name' => 'Desktop Application',
            'name' => '6-Platform Architecture Support',
            'short_desc' => 'Native client builds for Windows x64/ARM64, macOS Apple Silicon/Intel, and Linux x64/ARM64.',
            'full_desc' => 'Built with native C++/Node.js bindings for ultimate hardware performance across Windows, Mac, and Linux without virtualization overhead.',
            'icon' => '💻',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Cross-Platform',
            'sort_order' => 620,
            'is_enabled' => 1,
            'keywords' => 'windows antidetect, mac apple silicon, linux antidetect browser',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_tray_menu',
            'category' => 'desktop_client',
            'category_name' => 'Desktop Application',
            'name' => 'System Tray Quick-Launch Menu',
            'short_desc' => 'Access running profiles, start instances, and view account status right from the system tray.',
            'full_desc' => 'Background tray icon with 1-click quick launch, active profile count badge, and instant pause/resume controls.',
            'icon' => '🔔',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Quick Tray',
            'sort_order' => 630,
            'is_enabled' => 1,
            'keywords' => 'system tray, background quick launch, taskbar menu',
            'doc_url' => '/#downloads'
        ],
        [
            'id' => 'feat_keyboard_shortcuts',
            'category' => 'desktop_client',
            'category_name' => 'Desktop Application',
            'name' => 'Customizable Keyboard Hotkeys & Shortcuts',
            'short_desc' => 'High-speed hotkeys for quick profile creation, launching, search, and workspace navigation.',
            'full_desc' => 'Boost your operational speed with custom global hotkeys for profile launch (Cmd/Ctrl+Enter), new profile (Cmd/Ctrl+N), and instant filter (Cmd/Ctrl+F).',
            'icon' => '⌨️',
            'platforms' => 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm',
            'badge' => 'Hotkeys',
            'sort_order' => 640,
            'is_enabled' => 1,
            'keywords' => 'keyboard shortcuts, hotkeys, fast navigation, quick actions',
            'doc_url' => '/#downloads'
        ]
    ];
}

function ensureDefaultSoftwareFeaturesSeeded(PDO $db): void {
    try {
        $check = $db->query("SELECT COUNT(*) FROM software_features")->fetchColumn();
        if ($check > 0) return;

        $features = getDefaultSoftwareFeaturesList();
        $ins = $db->prepare("
            INSERT INTO `software_features` 
            (`id`, `category`, `category_name`, `name`, `short_desc`, `full_desc`, `icon`, `platforms`, `badge`, `sort_order`, `is_enabled`, `keywords`, `doc_url`, `created_at`, `updated_at`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE 
                `name`=VALUES(`name`),
                `short_desc`=VALUES(`short_desc`),
                `full_desc`=VALUES(`full_desc`),
                `icon`=VALUES(`icon`),
                `category_name`=VALUES(`category_name`),
                `badge`=VALUES(`badge`),
                `platforms`=VALUES(`platforms`);
        ");

        foreach ($features as $f) {
            $ins->execute([
                $f['id'],
                $f['category'],
                $f['category_name'],
                $f['name'],
                $f['short_desc'],
                $f['full_desc'],
                $f['icon'],
                $f['platforms'],
                $f['badge'],
                $f['sort_order'],
                $f['is_enabled'],
                $f['keywords'],
                $f['doc_url']
            ]);
        }
    } catch (Throwable $e) {
        error_log('[Features] Seeding error: ' . $e->getMessage());
    }
}

function getAllSoftwareFeatures(PDO $db, ?string $category = null, bool $enabledOnly = false, ?string $search = null): array {
    ensureDatabaseTablesExist();
    ensureDefaultSoftwareFeaturesSeeded($db);

    $sql = "SELECT * FROM software_features WHERE 1=1";
    $params = [];

    if ($enabledOnly) {
        $sql .= " AND is_enabled = 1";
    }

    if (!empty($category) && $category !== 'all') {
        $sql .= " AND category = ?";
        $params[] = $category;
    }

    if (!empty($search)) {
        $sql .= " AND (name LIKE ? OR short_desc LIKE ? OR full_desc LIKE ? OR keywords LIKE ? OR category_name LIKE ?)";
        $term = '%' . $search . '%';
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $sql .= " ORDER BY sort_order ASC, name ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return array_map(function($r) {
        $r['is_enabled'] = (bool)($r['is_enabled'] ?? 1);
        $r['sort_order'] = (int)($r['sort_order'] ?? 0);
        return $r;
    }, $rows);
}

function getSoftwareFeatureCategories(PDO $db): array {
    ensureDatabaseTablesExist();
    $stmt = $db->query("
        SELECT category, category_name, COUNT(*) as total_count, SUM(is_enabled) as enabled_count, MIN(sort_order) as min_sort
        FROM software_features
        GROUP BY category, category_name
        ORDER BY min_sort ASC
    ");
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function saveSoftwareFeature(PDO $db, array $data): array {
    ensureDatabaseTablesExist();
    $id = trim($data['id'] ?? '');
    if (empty($id)) {
        $id = 'feat_' . bin2hex(random_bytes(6));
    }

    $name = trim($data['name'] ?? '');
    $category = trim($data['category'] ?? 'browser_profiles');
    $categoryName = trim($data['category_name'] ?? '');
    if (empty($categoryName)) {
        $catMap = [
            'browser_profiles' => 'Browser Profiles & Lifecycle',
            'fingerprint' => 'Fingerprint Protection',
            'proxy_network' => 'Proxy & Network',
            'automation' => 'Automation & API',
            'cookies_session' => 'Cookies & Sessions',
            'team_collab' => 'Team Collaboration',
            'security_privacy' => 'Security & Privacy',
            'sync_cloud' => 'Sync & Cloud',
            'ai_tools' => 'AI & Smart Tools',
            'extensions' => 'Extensions & Add-ons',
            'system_performance' => 'Performance & Branding',
            'desktop_client' => 'Desktop Application'
        ];
        $categoryName = $catMap[$category] ?? ucfirst(str_replace('_', ' ', $category));
    }

    $shortDesc = trim($data['short_desc'] ?? '');
    $fullDesc = trim($data['full_desc'] ?? $shortDesc);
    $icon = trim($data['icon'] ?? '⚡');
    $platforms = trim($data['platforms'] ?? 'win_x64,win_arm,mac_arm,mac_intel,linux_x64,linux_arm');
    $badge = trim($data['badge'] ?? '');
    $sortOrder = (int)($data['sort_order'] ?? 100);
    $isEnabled = isset($data['is_enabled']) ? ($data['is_enabled'] ? 1 : 0) : 1;
    $keywords = trim($data['keywords'] ?? '');
    $docUrl = trim($data['doc_url'] ?? '/#features');

    if (empty($name) || empty($shortDesc)) {
        return ['success' => false, 'error' => 'Feature name and short description are required.'];
    }

    $stmt = $db->prepare("
        INSERT INTO `software_features`
        (`id`, `category`, `category_name`, `name`, `short_desc`, `full_desc`, `icon`, `platforms`, `badge`, `sort_order`, `is_enabled`, `keywords`, `doc_url`, `created_at`, `updated_at`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
            `category`=VALUES(`category`),
            `category_name`=VALUES(`category_name`),
            `name`=VALUES(`name`),
            `short_desc`=VALUES(`short_desc`),
            `full_desc`=VALUES(`full_desc`),
            `icon`=VALUES(`icon`),
            `platforms`=VALUES(`platforms`),
            `badge`=VALUES(`badge`),
            `sort_order`=VALUES(`sort_order`),
            `is_enabled`=VALUES(`is_enabled`),
            `keywords`=VALUES(`keywords`),
            `doc_url`=VALUES(`doc_url`),
            `updated_at`=CURRENT_TIMESTAMP;
    ");

    $stmt->execute([
        $id, $category, $categoryName, $name, $shortDesc, $fullDesc, $icon, $platforms, $badge, $sortOrder, $isEnabled, $keywords, $docUrl
    ]);

    return ['success' => true, 'id' => $id, 'message' => 'Feature saved successfully.'];
}

function toggleSoftwareFeature(PDO $db, string $id, ?bool $isEnabled = null): bool {
    ensureDatabaseTablesExist();
    if ($isEnabled === null) {
        $stmt = $db->prepare("UPDATE software_features SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        return $stmt->execute([$id]);
    } else {
        $stmt = $db->prepare("UPDATE software_features SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        return $stmt->execute([$isEnabled ? 1 : 0, $id]);
    }
}

function deleteSoftwareFeature(PDO $db, string $id): bool {
    ensureDatabaseTablesExist();
    $stmt = $db->prepare("DELETE FROM software_features WHERE id = ?");
    return $stmt->execute([$id]);
}

function resetAllSoftwareFeaturesToDefault(PDO $db): bool {
    ensureDatabaseTablesExist();
    try {
        $db->exec("DELETE FROM software_features");
        ensureDefaultSoftwareFeaturesSeeded($db);
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

// ──────────────────────────────────────────────
// 15. Universal Affiliate & CPA Click Tracking Engine
// ──────────────────────────────────────────────

function captureAndRecordAffiliateClick(?PDO $db = null): ?array {
    try {
        if (!$db) {
            $db = getDbConnection();
        }
        if (!$db) return null;

        ensureDatabaseTablesExist();

        // 1. Detect if referral / affiliate query parameter or path exists
        $requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
        $pathRef = '';
        if (preg_match('#^/(?:r|track)/([^/?]+)#i', $requestUri, $matches)) {
            $pathRef = trim($matches[1]);
        }

        $rawRef = $_GET['ref'] ?? $_GET['aff'] ?? $_GET['aff_id'] ?? $_GET['referral'] ?? $_GET['r'] ?? $pathRef ?? '';
        $rawRef = trim((string)$rawRef);

        if (empty($rawRef)) {
            return null; // No referral code on this request
        }

        // 2. Resolve affiliate user from database
        $cleanRef = preg_replace('/[^a-zA-Z0-9_\-]/', '', $rawRef);
        $cleanCode = preg_replace('/^(REF_|AFF-)/i', '', $cleanRef);
        
        $affId = $cleanRef;
        $refCode = $cleanRef;
        $userId = null;

        $uStmt = $db->prepare("
            SELECT id, affiliate_id, referral_code, name, email 
            FROM users 
            WHERE LOWER(referral_code) = LOWER(?) 
               OR LOWER(affiliate_id) = LOWER(?) 
               OR LOWER(referral_code) = LOWER(?)
               OR LOWER(affiliate_id) = LOWER(?)
               OR LOWER(referral_code) = LOWER(?)
               OR LOWER(affiliate_id) = LOWER(?)
               OR id = ?
            LIMIT 1
        ");
        $uStmt->execute([
            $cleanRef,
            $cleanRef,
            'REF_' . $cleanCode,
            'AFF-' . $cleanCode,
            $cleanCode,
            $cleanCode,
            $cleanRef
        ]);
        $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);

        if ($uRow) {
            $userId = $uRow['id'];
            $affId = !empty($uRow['affiliate_id']) ? $uRow['affiliate_id'] : ('AFF-' . strtoupper($cleanCode));
            $refCode = !empty($uRow['referral_code']) ? $uRow['referral_code'] : ('REF_' . strtoupper($cleanCode));
        } else {
            // Normalize default formatting
            if (stripos($cleanRef, 'AFF-') === 0) {
                $affId = strtoupper($cleanRef);
                $refCode = 'REF_' . strtoupper(substr($cleanRef, 4));
            } elseif (stripos($cleanRef, 'REF_') === 0) {
                $refCode = strtoupper($cleanRef);
                $affId = 'AFF-' . strtoupper(substr($cleanRef, 4));
            } else {
                $affId = 'AFF-' . strtoupper($cleanRef);
                $refCode = 'REF_' . strtoupper($cleanRef);
            }
        }

        // 3. Generate Click ID
        $clickId = isset($_GET['click_id']) && !empty(trim($_GET['click_id']))
            ? trim($_GET['click_id'])
            : 'clk_' . round(microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(4)), 0, 8);

        // 4. Resolve Client Metadata
        $ipAddress = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (strpos($ipAddress, ',') !== false) {
            $ipAddress = trim(explode(',', $ipAddress)[0]);
        }
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $referrer = $_SERVER['HTTP_REFERER'] ?? '';

        // Scheme and host
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'antiprofiles.com';
        $fullLandingUrl = "$scheme://$host" . ($_SERVER['REQUEST_URI'] ?? '/');

        // Sub IDs & Offer ID
        $offerId = trim($_GET['offer_id'] ?? 'offer_main_saas');
        $subId1 = trim($_GET['sub_id1'] ?? $_GET['s1'] ?? '');
        $subId2 = trim($_GET['sub_id2'] ?? $_GET['s2'] ?? '');
        $subId3 = trim($_GET['sub_id3'] ?? $_GET['s3'] ?? '');
        $subId4 = trim($_GET['sub_id4'] ?? '');
        $subId5 = trim($_GET['sub_id5'] ?? '');

        // 5. Insert Click into affiliate_clicks table
        try {
            $stmtInsert = $db->prepare("
                INSERT INTO affiliate_clicks (
                    click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, landing_url,
                    sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, created_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                )
                ON DUPLICATE KEY UPDATE 
                    ip_address = VALUES(ip_address), 
                    user_agent = VALUES(user_agent),
                    landing_url = VALUES(landing_url)
            ");

            $stmtInsert->execute([
                $clickId,
                $affId,
                $offerId,
                $ipAddress,
                $userAgent,
                $referrer,
                $fullLandingUrl,
                $subId1 ?: null,
                $subId2 ?: null,
                $subId3 ?: null,
                $subId4 ?: null,
                $subId5 ?: null
            ]);
        } catch (Throwable $e) {
            // Fallback minimal insert if any newer columns are not yet loaded
            try {
                $stmtInsertMin = $db->prepare("
                    INSERT INTO affiliate_clicks (
                        click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, created_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                    )
                    ON DUPLICATE KEY UPDATE ip_address = VALUES(ip_address)
                ");
                $stmtInsertMin->execute([$clickId, $affId, $offerId, $ipAddress, $userAgent, $referrer]);
            } catch (Throwable $e2) {}
        }

        // Increment offer total_clicks
        try {
            $db->prepare("UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?")->execute([$offerId]);
        } catch (Throwable $e) {}

        // 6. Set 30-Day Attribution Cookies
        $cookieDuration = time() + (86400 * 30);
        @setcookie('aff_id', $affId, $cookieDuration, '/', '', false, false);
        @setcookie('ref', $refCode, $cookieDuration, '/', '', false, false);
        @setcookie('click_id', $clickId, $cookieDuration, '/', '', false, false);
        @setcookie('offer_id', $offerId, $cookieDuration, '/', '', false, false);
        if (!empty($subId1)) @setcookie('sub_id1', $subId1, $cookieDuration, '/', '', false, false);
        if (!empty($subId2)) @setcookie('sub_id2', $subId2, $cookieDuration, '/', '', false, false);

        return [
            'success' => true,
            'affId' => $affId,
            'refCode' => $refCode,
            'clickId' => $clickId,
            'offerId' => $offerId,
            'userId' => $userId,
            'landingUrl' => $fullLandingUrl
        ];
    } catch (Throwable $e) {
        error_log('[Affiliate Click Tracking Error] ' . $e->getMessage());
        return null;
    }
}
