<?php
// ──────────────────────────────────────────────
// ProfileVault / AntiProfiles — Background Cron Automation Engine
// Handles: 7-Day Expiration Reminders, Overdue Auto-Expiration, and Failed Email Retries
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

$isCli = (php_sapi_name() === 'cli' || defined('STDIN'));
$db = Database::getConnection();

// Web invocation requires admin or cron key
if (!$isCli) {
    $cronKey = $_GET['key'] ?? '';
    $user = getAuthenticatedUser();
    $isAdmin = $user && in_array(strtolower($user['role'] ?? ''), ['admin', 'super_admin']);

    if (!$isAdmin && $cronKey !== 'antiprofiles_cron_secret_key') {
        respondJson(['success' => false, 'error' => 'Unauthorized cron execution.'], 403);
    }
}

$results = runAccountExpirationAndRemindersCron($db);

if ($isCli) {
    echo "[" . date('Y-m-d H:i:s') . "] Cron Execution Completed:\n";
    echo " - Reminders Sent: " . $results['reminders_sent'] . "\n";
    echo " - Accounts Expired: " . $results['accounts_expired'] . "\n";
    echo " - Emails Retried: " . $results['emails_retried'] . "\n";
    if (!empty($results['errors'])) {
        echo " - Errors: " . implode(", ", $results['errors']) . "\n";
    }
    exit(0);
} else {
    respondJson(['success' => true, 'data' => $results]);
}
