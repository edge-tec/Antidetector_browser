-- ──────────────────────────────────────────────
-- ProfileVault — Full MySQL Production Database Schema & Seeds
-- Import this SQL into aaPanel MySQL Database
-- ──────────────────────────────────────────────

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
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

-- Initial Admin Account Seed (admin@profilevault.local / Password: admin)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `permissions`, `auth_version`, `email_verified`, `email_verified_at`, `account_status`, `created_at`)
VALUES ('admin-default', 'System Admin', 'admin@profilevault.local', '$2y$10$JBDYVWMf1wgg8RNqyD0PuOJg2Sp8Em9fPOLcW.sZUmOOYNG1HzhNu', 'super_admin', '["*"]', 1, 1, NOW(), 'active', NOW())
ON DUPLICATE KEY UPDATE `password_hash`='$2y$10$JBDYVWMf1wgg8RNqyD0PuOJg2Sp8Em9fPOLcW.sZUmOOYNG1HzhNu', `role`='super_admin', `permissions`='["*"]', `email_verified`=1, `account_status`='active';

-- 1.0 Verification Tokens Table
CREATE TABLE IF NOT EXISTS `verification_tokens` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `attempts` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_vtok_user` (`user_id`, `used`),
  KEY `idx_vtok_hash` (`token_hash`),
  CONSTRAINT `fk_vtok_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.1 Real-Time Outbox Events Table
CREATE TABLE IF NOT EXISTS `realtime_events` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `event_id` VARCHAR(50) NOT NULL UNIQUE,
  `user_id` VARCHAR(36) NULL,
  `target_role` VARCHAR(50) NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_evt_user_time` (`user_id`, `created_at`),
  KEY `idx_evt_type` (`event_type`),
  KEY `idx_evt_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1.2 User Active Sessions & Revocation Tracking
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL UNIQUE,
  `platform` VARCHAR(50) DEFAULT 'desktop',
  `device_name` VARCHAR(255) DEFAULT 'Device',
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `auth_version` INT NOT NULL DEFAULT 1,
  `is_revoked` TINYINT(1) NOT NULL DEFAULT 0,
  `revoked_reason` VARCHAR(255) DEFAULT NULL,
  `revoked_at` DATETIME DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_sess_user` (`user_id`, `is_revoked`),
  CONSTRAINT `fk_sess_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. Pricing Plans Table
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

INSERT INTO `pricing_plans` (`id`, `name`, `slug`, `description`, `monthly_price`, `yearly_price`, `profile_limit`, `team_limit`, `api_limit`, `badge`, `button_text`, `button_url`, `is_popular`, `sort_order`)
VALUES
('plan_free', 'Free', 'free', 'Ideal for testing & personal profile management', 0.00, 0.00, 3, 1, '—', '', 'Start Free', '#register', 0, 1),
('plan_starter', 'Starter', 'starter', 'Essential features for solo operators & small tasks', 19.00, 15.00, 25, 2, 'Basic API', '', 'Start Trial', '#register', 0, 2),
('plan_pro', 'Professional', 'professional', 'Advanced fingerprint controls & team features', 49.00, 39.00, 100, 10, 'Full API', 'Most Popular', 'Get Started', '#register', 1, 3),
('plan_business', 'Business', 'business', 'Maximum power for large scale multi-profile teams', 99.00, 79.00, 500, 25, 'High Limit API', 'Best Value', 'Contact Sales', '#contact', 0, 4)
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 3. Subscriptions Table
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `plan_id` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `starts_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `grace_period_days` INT DEFAULT 3,
  `auto_renew` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `subscriptions` (`id`, `user_id`, `plan_id`, `status`, `starts_at`, `expires_at`, `grace_period_days`)
VALUES ('sub_admin-default', 'admin-default', 'plan_pro', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 5 YEAR), 3)
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 4. Desktop Installations Table
CREATE TABLE IF NOT EXISTS `desktop_installations` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `installation_id` VARCHAR(255) NOT NULL UNIQUE,
  `platform` VARCHAR(50) NOT NULL,
  `device_name` VARCHAR(255) NOT NULL,
  `app_version` VARCHAR(50) NOT NULL,
  `last_seen_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inst_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `app_releases` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `platform` VARCHAR(50) NOT NULL,
  `version` VARCHAR(50) NOT NULL,
  `release_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) DEFAULT NULL,
  `download_url` TEXT DEFAULT NULL,
  `original_filename` VARCHAR(255) DEFAULT NULL,
  `file_size` BIGINT DEFAULT 0,
  `release_notes` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `published_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` VARCHAR(255) DEFAULT 'admin',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_rel_plat_status` (`platform`, `status`),
  KEY `idx_rel_ver` (`platform`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `app_releases` (`id`, `platform`, `version`, `release_name`, `file_path`, `download_url`, `original_filename`, `file_size`, `release_notes`, `status`, `uploaded_by`) VALUES
('rel_win_100', 'windows-x64', '1.0.0', 'ProfileVault v1.0.0 Stable Release', 'releases/ProfileVault-Windows-x64.exe', '/download/windows', 'ProfileVault-Windows-x64.exe', 159, 'Initial stable release with multi-profile isolation, proxy bridge, and team controls.', 'active', 'system'),
('rel_mac_arm_100', 'macos-arm64', '1.0.0', 'ProfileVault Apple Silicon v1.0.0 Stable Release', 'releases/ProfileVault-macOS-AppleSilicon-arm64.dmg', '/download/macos-arm64', 'ProfileVault-macOS-AppleSilicon-arm64.dmg', 159, 'ARM64 build engineered specifically for Apple Silicon M-series chips.', 'active', 'system'),
('rel_mac_intel_100', 'macos-x64', '1.0.0', 'ProfileVault macOS Intel v1.0.0 Stable Release', 'releases/ProfileVault-macOS-Intel-x64.dmg', '/download/macos-intel', 'ProfileVault-macOS-Intel-x64.dmg', 159, 'x64 build for Intel-based Mac computers.', 'active', 'system'),
('rel_linux_100', 'linux-x64', '1.0.0', 'ProfileVault Linux v1.0.0 AppImage', 'releases/ProfileVault-Linux-x86_64.AppImage', '/download/linux', 'ProfileVault-Linux-x86_64.AppImage', 159, 'Native Linux AppImage installer package.', 'active', 'system')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- 5. Desktop App Configuration (Downloads & Releases)
CREATE TABLE IF NOT EXISTS `desktop_app_config` (
  `config_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `config_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `desktop_app_config` (`config_key`, `config_value`) VALUES
('win_download_url', '/download/windows'),
('win_app_version', '1.0.0'),
('win_enabled', 'true'),
('mac_intel_download_url', '/download/macos-intel'),
('mac_intel_app_version', '1.0.0'),
('mac_intel_enabled', 'true'),
('mac_arm_download_url', '/download/macos-arm64'),
('mac_arm_app_version', '1.0.0'),
('mac_arm_enabled', 'true'),
('linux_download_url', '/download/linux'),
('linux_app_version', '1.0.0'),
('linux_enabled', 'true'),
('release_notes', 'Initial stable release with multi-profile isolation, proxy bridge, and team controls.'),
('min_supported_version', '1.0.0'),
('force_update', 'false'),
('max_devices_limit', '2')
ON DUPLICATE KEY UPDATE `config_key`=`config_key`;

-- 6. Landing Page CMS Tables
CREATE TABLE IF NOT EXISTS `landing_branding` (
  `config_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `config_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_branding` (`config_key`, `config_value`) VALUES
('site_name', 'ProfileVault'),
('logo_text', '🛡️ ProfileVault'),
('primary_color', '#6366F1'),
('secondary_color', '#8B5CF6'),
('accent_color', '#2DD4BF'),
('contact_email', 'support@your-domain.com')
ON DUPLICATE KEY UPDATE `config_key`=`config_key`;

CREATE TABLE IF NOT EXISTS `landing_hero` (
  `id` INT NOT NULL PRIMARY KEY,
  `headline` TEXT NOT NULL,
  `subheadline` TEXT NOT NULL,
  `cta_primary_text` VARCHAR(100) NOT NULL,
  `cta_primary_url` VARCHAR(255) NOT NULL,
  `cta_secondary_text` VARCHAR(100) NOT NULL,
  `cta_secondary_url` VARCHAR(255) NOT NULL,
  `trust_text` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_hero` (`id`, `headline`, `subheadline`, `cta_primary_text`, `cta_primary_url`, `cta_secondary_text`, `cta_secondary_url`, `trust_text`)
VALUES (1, 'Browse Privately. Manage Profiles. Scale Your Workflow.', 'Create isolated browser profiles with configurable environments, secure sessions, proxy support, and powerful team profile management.', 'Start Free', '#register', 'View Pricing', '#pricing', '⚡ No credit card required • Free trial available • Cancel anytime')
ON DUPLICATE KEY UPDATE `id`=`id`;

CREATE TABLE IF NOT EXISTS `landing_stats` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `number` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50) NOT NULL,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_stats` (`id`, `number`, `label`, `icon`, `sort_order`) VALUES
('stat_1', '10K+', 'Active Profiles', '🌐', 1),
('stat_2', '99.9%', 'Platform Uptime', '⚡', 2),
('stat_3', '150+', 'Countries Supported', '🌍', 3),
('stat_4', '24/7', 'Expert Support', '🛡️', 4)
ON DUPLICATE KEY UPDATE `id`=`id`;

CREATE TABLE IF NOT EXISTS `landing_features` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `icon` VARCHAR(50) NOT NULL,
  `button_text` VARCHAR(100) DEFAULT '',
  `button_url` VARCHAR(255) DEFAULT '',
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_features` (`id`, `title`, `description`, `icon`, `sort_order`) VALUES
('feat_1', 'Isolated Browser Profiles', 'Keep cookies, local storage, sessions, and browser data completely separated between profiles.', '🔒', 1),
('feat_2', 'Fingerprint Management', 'Configure browser and device environment parameters including WebGL, Canvas, and User Agents.', '🛡️', 2),
('feat_3', 'Proxy Management System', 'Seamlessly assign and test HTTP, HTTPS, SOCKS4, and SOCKS5 proxy configurations per profile.', '🌐', 3),
('feat_4', 'Reusable Profile Templates', 'Create standardized profile templates for fast batch provisioning across your operations.', '📋', 4)
ON DUPLICATE KEY UPDATE `id`=`id`;

CREATE TABLE IF NOT EXISTS `landing_steps` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `step_number` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `icon` VARCHAR(50) NOT NULL,
  `sort_order` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_steps` (`id`, `step_number`, `title`, `description`, `icon`, `sort_order`) VALUES
('step_1', 1, 'Create Your Profile', 'Choose a profile template or start from scratch to configure your environment.', '📋', 1),
('step_2', 2, 'Configure Environment', 'Set custom User Agent, OS, timezone, language, WebGL fingerprint, and proxy.', '⚡', 2),
('step_3', 3, 'Launch Isolated Window', 'Open an isolated browser window running with dedicated storage and cookies.', '🌐', 3)
ON DUPLICATE KEY UPDATE `id`=`id`;

CREATE TABLE IF NOT EXISTS `landing_faqs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `question` TEXT NOT NULL,
  `answer` TEXT NOT NULL,
  `category` VARCHAR(100) DEFAULT 'General',
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_faqs` (`id`, `question`, `answer`, `category`, `sort_order`) VALUES
('faq_1', 'What is an anti-detect browser?', 'An anti-detect browser is specialized software designed to isolate browser profiles and provide configurable hardware, network, and device parameters.', 'General', 1),
('faq_2', 'Can I use HTTP and SOCKS5 proxies?', 'Yes! ProfileVault supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies with connection checking.', 'Proxies', 2)
ON DUPLICATE KEY UPDATE `id`=`id`;

CREATE TABLE IF NOT EXISTS `landing_testimonials` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `position` VARCHAR(255) NOT NULL,
  `company` VARCHAR(255) NOT NULL,
  `avatar_url` VARCHAR(255) NOT NULL,
  `rating` INT DEFAULT 5,
  `testimonial` TEXT NOT NULL,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_testimonials` (`id`, `name`, `position`, `company`, `avatar_url`, `rating`, `testimonial`, `sort_order`) VALUES
('test_1', 'Alex Rivera', 'E-Commerce Manager', 'Apex Brands', '👤', 5, 'ProfileVault completely transformed how our agency manages 50+ accounts. Session isolation and proxy integration are rock solid.', 1)
ON DUPLICATE KEY UPDATE `id`=`id`;

CREATE TABLE IF NOT EXISTS `landing_seo` (
  `config_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `config_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `landing_seo` (`config_key`, `config_value`) VALUES
('meta_title', 'ProfileVault — Next-Gen Anti-Detect & Privacy Browser'),
('meta_description', 'Manage isolated browser profiles, configure proxies, and automate workflows securely with ProfileVault Antidetect Software.')
ON DUPLICATE KEY UPDATE `config_key`=`config_key`;

-- 7. System Settings Table (SMTP & General System Configuration)
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `settings` (`key`, `value`) VALUES
('smtp_host', 'smtp.gmail.com'),
('smtp_port', '587'),
('smtp_user', ''),
('smtp_password', ''),
('smtp_from_email', 'noreply@profilevault.local'),
('smtp_secure', 'false'),
('smtp_enabled', 'false')
ON DUPLICATE KEY UPDATE `key`=`key`;

-- 8. Support System Tables
CREATE TABLE IF NOT EXISTS `support_conversations` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `assigned_agent_id` VARCHAR(36) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'open',
  `priority` VARCHAR(50) NOT NULL DEFAULT 'normal',
  `subject` VARCHAR(255) NOT NULL DEFAULT 'Support Request',
  `last_message_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_sup_conv_user_status` (`user_id`, `status`),
  KEY `idx_sup_conv_last_msg` (`last_message_at`),
  CONSTRAINT `fk_sup_conv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `support_messages` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `conversation_id` VARCHAR(50) NOT NULL,
  `sender_id` VARCHAR(36) NOT NULL,
  `sender_type` VARCHAR(20) NOT NULL,
  `message` TEXT NOT NULL,
  `message_type` VARCHAR(50) DEFAULT 'text',
  `attachment_path` VARCHAR(255) DEFAULT NULL,
  `attachment_name` VARCHAR(255) DEFAULT NULL,
  `attachment_size` INT DEFAULT NULL,
  `attachment_mime` VARCHAR(100) DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `read_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_sup_msg_conv_created` (`conversation_id`, `created_at`),
  KEY `idx_sup_msg_unread` (`conversation_id`, `sender_type`, `is_read`),
  CONSTRAINT `fk_sup_msg_conv` FOREIGN KEY (`conversation_id`) REFERENCES `support_conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `support_internal_notes` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `conversation_id` VARCHAR(50) NOT NULL,
  `agent_id` VARCHAR(36) NOT NULL,
  `agent_name` VARCHAR(255) NOT NULL,
  `note` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sup_note_conv` FOREIGN KEY (`conversation_id`) REFERENCES `support_conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `support_settings` (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `support_settings` (`key`, `value`) VALUES
('support_enabled', 'true'),
('support_hours', '24/7 Live Agent Support'),
('auto_reply_enabled', 'true'),
('rate_limit_messages_per_min', '15')
ON DUPLICATE KEY UPDATE `key`=`key`;

-- 9. Google SEO & AI Search Optimization (AEO/GEO) Tables
CREATE TABLE IF NOT EXISTS `seo_settings` (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `seo_settings` (`key`, `value`) VALUES
('seo_enabled', '1'),
('schema_enabled', '1'),
('sitemap_enabled', '1'),
('robots_enabled', '1'),
('og_enabled', '1'),
('ai_aeo_enabled', '1'),
('internal_links_enabled', '1'),
('seo_audit_enabled', '1'),
('content_assistant_enabled', '1'),
('site_name', 'ProfileVault'),
('site_description', 'Professional Multi-Account Anti-Detect Browser with Isolated Profiles, Fingerprint Spoofing & Residential Proxy Support.'),
('site_url', 'https://profilevault.local'),
('default_og_image', 'https://profilevault.local/og-cover.png'),
('twitter_handle', '@ProfileVaultApp'),
('robots_content', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://profilevault.local/sitemap.xml'),
('entity_brand_name', 'ProfileVault Software Inc.'),
('entity_logo', 'https://profilevault.local/logo.png'),
('entity_email', 'support@profilevault.local'),
('entity_phone', '+1 (800) 555-0199'),
('entity_same_as', '["https://x.com/ProfileVaultApp", "https://github.com/edge-tec/Antidetector_browser"]')
ON DUPLICATE KEY UPDATE `key`=`key`;

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

INSERT INTO `page_seo` (
  `id`, `page_path`, `page_type`, `title`, `description`, `keywords`, `canonical_url`, `robots`,
  `og_title`, `og_description`, `og_image`, `schema_type`, `primary_keyword`, `ai_quick_answer`
) VALUES (
  'page_home', '/', 'homepage',
  'ProfileVault — Anti-Detect Browser & Multi-Account Management Tool',
  'Manage thousands of social media, e-commerce, and ads accounts seamlessly with 100% isolated browser profiles, fingerprint spoofing, and residential proxies.',
  'anti detect browser, multi account browser, browser profile isolation, fingerprint spoofing, proxy manager',
  'https://profilevault.local/',
  'index, follow',
  'ProfileVault — Anti-Detect Browser & Profile Isolation',
  'Professional anti-detect browser for managing isolated web profiles without bans.',
  'https://profilevault.local/og-cover.png',
  'SoftwareApplication',
  'anti detect browser',
  'ProfileVault is a software platform designed for privacy, browser profile isolation, and multi-account management. It allows users to run separate Chromium instances with unique canvas, WebGL, WebRTC, and proxy configurations.'
) ON DUPLICATE KEY UPDATE `id`=`id`;

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

CREATE TABLE IF NOT EXISTS `seo_redirects` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `source_path` VARCHAR(255) NOT NULL UNIQUE,
  `target_path` VARCHAR(255) NOT NULL,
  `status_code` INT DEFAULT 301,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `seo_404_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `request_path` VARCHAR(255) NOT NULL,
  `referrer` TEXT DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `hit_count` INT DEFAULT 1,
  `last_seen_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `seo_internal_links` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `source_page` VARCHAR(255) NOT NULL,
  `target_page` VARCHAR(255) NOT NULL,
  `anchor_text` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'suggested',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `seo_audit_reports` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `score` INT NOT NULL,
  `critical_count` INT NOT NULL,
  `warning_count` INT NOT NULL,
  `passed_count` INT NOT NULL,
  `audit_json` LONGTEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Audit Logs, Login History, Security & System Health Tables
CREATE TABLE IF NOT EXISTS `login_history` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `location` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'success',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_lh_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `admin_id` VARCHAR(36) NOT NULL,
  `admin_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_user_id` VARCHAR(36) DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `previous_value` TEXT DEFAULT NULL,
  `new_value` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_audit_admin` (`admin_id`),
  KEY `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `security_events` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `event_type` VARCHAR(100) NOT NULL,
  `severity` VARCHAR(20) NOT NULL DEFAULT 'warning',
  `user_id` VARCHAR(36) DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `subscription_id` VARCHAR(50) DEFAULT NULL,
  `transaction_id` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) DEFAULT '$',
  `gateway` VARCHAR(50) NOT NULL DEFAULT 'manual',
  `status` VARCHAR(50) NOT NULL DEFAULT 'successful',
  `payment_method` VARCHAR(50) DEFAULT 'credit_card',
  `invoice_url` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_pay_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payment_gateways` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `gateway_key` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `is_enabled` TINYINT(1) DEFAULT 1,
  `is_test_mode` TINYINT(1) DEFAULT 0,
  `config_json` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `profile_configurations` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `profile_name` VARCHAR(255) NOT NULL,
  `browser_type` VARCHAR(50) DEFAULT 'chromium',
  `fingerprint_json` LONGTEXT DEFAULT NULL,
  `proxy_config_json` TEXT DEFAULT NULL,
  `storage_limit_mb` INT DEFAULT 500,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_prof_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `profile_settings_audit` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `layer_ui` VARCHAR(20) DEFAULT 'working',
  `layer_state` VARCHAR(20) DEFAULT 'working',
  `layer_api` VARCHAR(20) DEFAULT 'working',
  `layer_db` VARCHAR(20) DEFAULT 'working',
  `layer_profile_config` VARCHAR(20) DEFAULT 'working',
  `layer_launch` VARCHAR(20) DEFAULT 'working',
  `layer_actual_browser` VARCHAR(20) DEFAULT 'working',
  `status` VARCHAR(20) DEFAULT 'working',
  `last_checked_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `smtp_settings` (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `template_key` VARCHAR(100) NOT NULL UNIQUE,
  `subject` VARCHAR(255) NOT NULL,
  `body_html` LONGTEXT NOT NULL,
  `body_text` LONGTEXT NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `recipient` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `template_key` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'sent',
  `error_message` TEXT DEFAULT NULL,
  `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `target_type` VARCHAR(50) NOT NULL DEFAULT 'all',
  `target_id` VARCHAR(50) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'info',
  `is_read` TINYINT(1) DEFAULT 0,
  `scheduled_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;



