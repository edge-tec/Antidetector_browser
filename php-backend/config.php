<?php
// ──────────────────────────────────────────────
// ProfileVault — Central PHP Backend Configuration
// Supports MySQL / MariaDB and SQLite on aaPanel
// ──────────────────────────────────────────────

define('DB_DRIVER', 'mysql'); // 'mysql' or 'sqlite'
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'antidetactor');
define('DB_USER', 'antidetactor');
define('DB_PASS', 'antidetactor');

// SQLite Fallback Path (if DB_DRIVER == 'sqlite')
define('SQLITE_PATH', __DIR__ . '/profilevault.sqlite');

// Secret Key for JWT / Session Tokens
define('JWT_SECRET', 'profilevault_php_secret_key_88921_change_me');

// CORS Allowed Origins
define('CORS_ORIGIN', '*');

// App Info
define('APP_NAME', 'ProfileVault');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'https://app.edgecash.net');


// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');

