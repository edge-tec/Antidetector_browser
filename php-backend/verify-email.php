<?php
// ──────────────────────────────────────────────
// ProfileVault — Central Web Email Verification Handler & Page
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$pdo = Database::getConnection();
$plainToken = trim($_GET['token'] ?? $_POST['token'] ?? '');
$resendEmail = trim($_POST['resend_email'] ?? '');

$state = 'idle'; // 'success', 'already_verified', 'expired', 'invalid', 'idle', 'resend_success', 'resend_error'
$message = '';
$userEmail = '';
$userName = '';

// Handle Resend Request from web
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($resendEmail)) {
    $uStmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
    $uStmt->execute([$resendEmail]);
    $targetUser = $uStmt->fetch();

    if ($targetUser) {
        if ((int)$targetUser['email_verified'] === 1) {
            $state = 'already_verified';
            $message = 'Your email address is already verified. You can sign in now.';
        } else {
            $res = sendVerificationEmailPhp($targetUser['id'], $targetUser['name'], $targetUser['email']);
            $state = 'resend_success';
            $message = ($res['sentViaSmtp'] ?? false)
                ? "A new confirmation email has been dispatched to {$targetUser['email']}."
                : "A new verification token was generated. Please check your inbox or paste the token below.";
        }
    } else {
        $state = 'resend_success';
        $message = 'If an account with that email exists, a new confirmation link has been sent.';
    }
} elseif (!empty($plainToken)) {
    $tokenHash = hash('sha256', $plainToken);
    $tokStmt = $pdo->prepare("SELECT * FROM verification_tokens WHERE token_hash = ? ORDER BY id DESC LIMIT 1");
    $tokStmt->execute([$tokenHash]);
    $tokenRecord = $tokStmt->fetch();

    if (!$tokenRecord) {
        $state = 'invalid';
        $message = 'Invalid verification link. Please check your email or request a new confirmation link.';
    } else {
        $userId = $tokenRecord['user_id'];
        $uStmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $targetUser = $uStmt->fetch();

        if (!$targetUser) {
            $state = 'invalid';
            $message = 'Associated user account was not found.';
        } elseif ((int)$targetUser['email_verified'] === 1) {
            $state = 'already_verified';
            $userEmail = $targetUser['email'];
            $userName = $targetUser['name'];
            $message = 'Your email address has already been verified. You can sign in immediately.';
        } elseif (strtotime($tokenRecord['expires_at']) < time()) {
            $state = 'expired';
            $userEmail = $targetUser['email'];
            $message = 'Your verification link has expired (24-hour limit). Please request a new verification email below.';
        } else {
            // Success: mark verified
            $pdo->prepare("UPDATE verification_tokens SET used = 1 WHERE id = ?")->execute([$tokenRecord['id']]);
            $pdo->prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND id != ?")->execute([$userId, $tokenRecord['id']]);

            $newVersion = (int)($targetUser['auth_version'] ?? 1) + 1;
            $pdo->prepare("
                UPDATE users SET
                    email_verified = 1,
                    email_verified_at = CURRENT_TIMESTAMP,
                    account_status = 'active',
                    auth_version = ?,
                    verification_token_hash = NULL,
                    verification_token_expires_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ")->execute([$newVersion, $userId]);

            recordSecurityEvent('EMAIL_VERIFIED', 'info', $userId, "Web email verification succeeded for {$targetUser['email']}");
            logAdminAction($userId, $targetUser['email'], 'EMAIL_VERIFIED_WEB', $userId, 'Email verified via web link');

            publishRealtimeEvent($pdo, $userId, 'user.email_verified', [
                'type' => 'user.email_verified',
                'userId' => $userId,
                'email' => $targetUser['email'],
                'version' => $newVersion,
                'timestamp' => date('c')
            ], null, $newVersion);

            @sendAccountVerifiedConfirmationPhp($targetUser['name'], $targetUser['email']);

            $state = 'success';
            $userEmail = $targetUser['email'];
            $userName = $targetUser['name'];
            $message = 'Your email address has been successfully verified! Your account is now fully active across Web, Windows, macOS, and Linux.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification — ProfileVault Anti-Detect Browser</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0A0A0F;
      --card-bg: #161622;
      --border: #2C2C3E;
      --primary: #2DD4BF;
      --primary-hover: #14B8A6;
      --text: #F1F5F9;
      --text-muted: #94A3B8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 40px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      text-align: center;
    }
    .icon {
      font-size: 52px;
      margin-bottom: 20px;
      display: inline-block;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .alert {
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 13px;
      text-align: left;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .alert-success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34D399; }
    .alert-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #F87171; }
    .alert-info { background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38BDF8; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 13px 24px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2DD4BF, #3B82F6);
      color: #0F0F17;
      box-shadow: 0 4px 14px rgba(45, 212, 191, 0.35);
    }
    .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
    .btn-outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .btn-outline:hover { background: #1C1C28; color: #FFF; }
    input[type="text"], input[type="email"] {
      width: 100%;
      padding: 12px 14px;
      border-radius: 9px;
      background: #0F0F17;
      border: 1px solid var(--border);
      color: #FFF;
      font-size: 14px;
      margin-bottom: 12px;
    }
    input:focus { outline: none; border-color: var(--primary); }
  </style>
</head>
<body>
  <div class="card">
    <?php if ($state === 'success'): ?>
      <div class="icon">✅</div>
      <h1>Email Verified Successfully!</h1>
      <p>Welcome to ProfileVault<?php if ($userName) echo ', ' . htmlspecialchars($userName); ?>! Your account is now fully active across Web, Windows, macOS, and Linux.</p>
      
      <a href="/#login" class="btn btn-primary">Open Web Control Center ➔</a>
      <a href="profilevault://verify-email?token=<?= htmlspecialchars($plainToken) ?>" class="btn btn-outline">Launch Desktop App</a>

    <?php elseif ($state === 'already_verified'): ?>
      <div class="icon">🛡️</div>
      <h1>Already Verified</h1>
      <p>Your email address is already verified. You can sign in to access your profiles.</p>
      <a href="/#login" class="btn btn-primary">Continue to Sign In ➔</a>

    <?php elseif ($state === 'expired'): ?>
      <div class="icon">⏳</div>
      <h1>Link Expired</h1>
      <div class="alert alert-danger"><?= htmlspecialchars($message) ?></div>
      <form method="POST" action="/verify-email">
        <input type="email" name="resend_email" value="<?= htmlspecialchars($userEmail) ?>" placeholder="Enter your email address" required>
        <button type="submit" class="btn btn-primary">Resend Verification Email</button>
      </form>
      <a href="/#login" class="btn btn-outline">Back to Sign In</a>

    <?php elseif ($state === 'resend_success'): ?>
      <div class="icon">✉️</div>
      <h1>Confirmation Link Dispatched</h1>
      <div class="alert alert-info"><?= htmlspecialchars($message) ?></div>
      <p>Please check your inbox or spam folder and click the link to activate your account.</p>
      <a href="/#login" class="btn btn-primary">Return to Sign In</a>

    <?php else: ?>
      <div class="icon">✉️</div>
      <h1>Account Verification</h1>
      <?php if ($state === 'invalid'): ?>
        <div class="alert alert-danger"><?= htmlspecialchars($message) ?></div>
      <?php else: ?>
        <p>Please enter your verification token below to activate your account:</p>
      <?php endif; ?>

      <form method="GET" action="/verify-email">
        <input type="text" name="token" placeholder="Paste verification token..." value="<?= htmlspecialchars($plainToken) ?>" required>
        <button type="submit" class="btn btn-primary">Verify Token</button>
      </form>

      <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:20px;">
        <p style="font-size:13px; margin-bottom:12px;">Need a new link?</p>
        <form method="POST" action="/verify-email">
          <input type="email" name="resend_email" placeholder="user@example.com" required>
          <button type="submit" class="btn btn-outline">Resend Confirmation Email</button>
        </form>
      </div>

      <div style="margin-top:16px;">
        <a href="/#login" style="color:var(--text-muted); font-size:13px; text-decoration:underline;">Back to Sign In</a>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
