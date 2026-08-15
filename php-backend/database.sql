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
  `email_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `account_status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `google_id` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Admin Account Seed (admin@profilevault.local / Password: admin)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `email_verified`, `account_status`, `created_at`)
VALUES ('admin-default', 'System Admin', 'admin@profilevault.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 1, 'active', NOW())
ON DUPLICATE KEY UPDATE `id`=`id`;

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

-- 5. Desktop App Configuration (Downloads & Releases)
CREATE TABLE IF NOT EXISTS `desktop_app_config` (
  `config_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `config_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `desktop_app_config` (`config_key`, `config_value`) VALUES
('win_download_url', 'https://your-domain.com/downloads/ProfileVault-Windows-x64.exe'),
('win_app_version', '1.0.0'),
('win_enabled', 'true'),
('mac_intel_download_url', 'https://your-domain.com/downloads/ProfileVault-macOS-Intel-x64.dmg'),
('mac_intel_app_version', '1.0.0'),
('mac_intel_enabled', 'true'),
('mac_arm_download_url', 'https://your-domain.com/downloads/ProfileVault-macOS-Apple-Silicon-arm64.dmg'),
('mac_arm_app_version', '1.0.0'),
('mac_arm_enabled', 'true'),
('linux_download_url', 'https://your-domain.com/downloads/ProfileVault-Linux-x86_64.AppImage'),
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
('support_available', 'true'),
('business_hours', 'Mon-Fri 09:00 - 18:00 UTC'),
('welcome_message', 'Hello! How can our support team assist you today?'),
('offline_message', 'Our support team is currently offline. Please leave a message and we will respond shortly.'),
('auto_reply_enabled', 'true'),
('auto_reply_message', 'Thanks for contacting ProfileVault support! An agent has been notified and will reply shortly.'),
('max_attachment_size_mb', '10'),
('allowed_file_types', 'jpg,jpeg,png,gif,webp,pdf,txt,zip'),
('notification_sound_enabled', 'true'),
('max_open_conversations_per_user', '3'),
('rate_limit_messages_per_min', '15')
ON DUPLICATE KEY UPDATE `key`=`key`;

SET FOREIGN_KEY_CHECKS = 1;


