<?php
// ──────────────────────────────────────────────
// ProfileVault / AntiProfiles — Background Cron Automation Engine
// Handles: 7-Day Expiration Reminders, Overdue Auto-Expiration, and Failed Email Retries
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';
if (!defined('PAYMENTS_LIB_ONLY')) {
    define('PAYMENTS_LIB_ONLY', true);
}
require_once __DIR__ . '/payments.php';

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
$cryptoResults = runInHouseCryptoAutoConfirmCron($db);
$results['inhouse_crypto'] = $cryptoResults;

if ($isCli) {
    echo "[" . date('Y-m-d H:i:s') . "] Cron Execution Completed:\n";
    echo " - Reminders Sent: " . $results['reminders_sent'] . "\n";
    echo " - Accounts Expired: " . $results['accounts_expired'] . "\n";
    echo " - Emails Retried: " . $results['emails_retried'] . "\n";
    echo " - Crypto Invoices Checked: " . $cryptoResults['checked'] . "\n";
    echo " - Crypto Packages Activated: " . $cryptoResults['activated'] . "\n";
    echo " - Crypto Confirming: " . $cryptoResults['confirming'] . "\n";
    $sweeps = $cryptoResults['sweeps'] ?? ['attempted' => 0, 'swept' => 0, 'failed' => 0, 'errors' => []];
    echo " - HD Auto-Sweeps Attempted: " . $sweeps['attempted'] . " | Swept to Trust Wallet: " . $sweeps['swept'] . " | Failed: " . $sweeps['failed'] . "\n";
    if (!empty($results['errors'])) {
        echo " - Errors: " . implode(", ", $results['errors']) . "\n";
    }
    if (!empty($cryptoResults['errors'])) {
        echo " - Crypto Errors: " . implode(", ", $cryptoResults['errors']) . "\n";
    }
    if (!empty($sweeps['errors'])) {
        echo " - Sweep Errors: " . implode(", ", $sweeps['errors']) . "\n";
    }
    exit(0);
} else {
    respondJson(['success' => true, 'data' => $results]);
}
