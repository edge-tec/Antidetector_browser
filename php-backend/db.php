<?php
// ──────────────────────────────────────────────
// ProfileVault — Database Connection Helper (PDO MySQL / SQLite)
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            try {
                if (DB_DRIVER === 'sqlite') {
                    self::$instance = new PDO('sqlite:' . SQLITE_PATH);
                } else {
                    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    self::$instance = new PDO($dsn, DB_USER, DB_PASS, [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                    ]);
                }
            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'error' => 'Database connection failed. Please verify MySQL / SQLite settings in config.php: ' . $e->getMessage()
                ]);
                exit();
            }
        }
        return self::$instance;
    }
}

// Global helper wrapper function
function getDbConnection(): PDO {
    return Database::getConnection();
}

