-- ──────────────────────────────────────────────
-- Migration 008: Enterprise Software Versions & Update Logs
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `software_versions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `version` VARCHAR(50) NOT NULL,
  `build` VARCHAR(50) DEFAULT '1',
  `channel` VARCHAR(50) NOT NULL DEFAULT 'stable',
  `os` VARCHAR(50) NOT NULL DEFAULT 'all',
  `architecture` VARCHAR(50) NOT NULL DEFAULT 'all',
  `release_title` VARCHAR(255) NOT NULL,
  `release_notes` LONGTEXT DEFAULT NULL,
  `mandatory` TINYINT(1) NOT NULL DEFAULT 0,
  `min_supported_version` VARCHAR(50) DEFAULT '1.0.0',
  
  `win_download_url` TEXT DEFAULT NULL,
  `win_file_size` BIGINT DEFAULT 0,
  `win_sha256` VARCHAR(64) DEFAULT NULL,
  
  `mac_arm_download_url` TEXT DEFAULT NULL,
  `mac_arm_file_size` BIGINT DEFAULT 0,
  `mac_arm_sha256` VARCHAR(64) DEFAULT NULL,
  
  `mac_intel_download_url` TEXT DEFAULT NULL,
  `mac_intel_file_size` BIGINT DEFAULT 0,
  `mac_intel_sha256` VARCHAR(64) DEFAULT NULL,
  
  `linux_download_url` TEXT DEFAULT NULL,
  `linux_file_size` BIGINT DEFAULT 0,
  `linux_sha256` VARCHAR(64) DEFAULT NULL,
  
  `signature` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `download_count` INT NOT NULL DEFAULT 0,
  `published_at` DATETIME DEFAULT NULL,
  `created_by` VARCHAR(100) NOT NULL DEFAULT 'admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_ver_status_channel` (`status`, `channel`),
  KEY `idx_ver_num` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `software_update_logs` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(100) DEFAULT NULL,
  `license_key` VARCHAR(100) DEFAULT NULL,
  `from_version` VARCHAR(50) NOT NULL,
  `to_version` VARCHAR(50) NOT NULL,
  `os` VARCHAR(50) NOT NULL,
  `architecture` VARCHAR(50) NOT NULL,
  `channel` VARCHAR(50) NOT NULL DEFAULT 'stable',
  `status` VARCHAR(50) NOT NULL,
  `error_message` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_log_user` (`user_id`),
  KEY `idx_log_ver` (`to_version`),
  KEY `idx_log_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
