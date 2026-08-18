<?php
// ──────────────────────────────────────────────
// AntiProfiles — Reset Password Page
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

header('Content-Type: text/html; charset=utf-8');

$token = trim($_GET['token'] ?? '');
$initialValid = false;
$userEmail = '';
$userName = '';

if (!empty($token)) {
    try {
        $db = Database::getConnection();
        $tokenHash = hash('sha256', $token);
        $stmt = $db->prepare("
            SELECT pr.*, u.name, u.email
            FROM password_resets pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.token_hash = ? AND pr.used = 0 AND pr.expires_at > NOW()
            ORDER BY pr.created_at DESC LIMIT 1
        ");
        $stmt->execute([$tokenHash]);
        $resetRecord = $stmt->fetch();
        if ($resetRecord) {
            $initialValid = true;
            $userEmail = $resetRecord['email'];
            $userName = $resetRecord['name'];
        }
    } catch (Throwable $e) {}
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password — AntiProfiles</title>
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-body: #07090E;
            --bg-card: rgba(18, 20, 30, 0.85);
            --border: #232738;
            --primary: #2DD4BF;
            --primary-hover: #14B8A6;
            --accent: #818CF8;
            --text-main: #F1F5F9;
            --text-muted: #94A3B8;
            --error: #EF4444;
            --success: #10B981;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg-body);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 24px;
            background-image: radial-gradient(circle at top center, rgba(45, 212, 191, 0.08) 0%, transparent 60%);
        }
        .reset-container {
            width: 100%;
            max-width: 440px;
        }
        .logo-header {
            text-align: center;
            margin-bottom: 28px;
        }
        .reset-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 36px 32px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(16px);
        }
        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 24px;
            color: #FFF;
            text-align: center;
            margin-bottom: 8px;
        }
        .subtitle {
            font-size: 13px;
            color: var(--text-muted);
            text-align: center;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .form-group {
            margin-bottom: 18px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #CBD5E1;
            margin-bottom: 6px;
        }
        .input-wrapper {
            position: relative;
        }
        input[type="password"],
        input[type="text"] {
            width: 100%;
            background: rgba(9, 11, 18, 0.9);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 42px 12px 14px;
            color: #FFF;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
        }
        input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.18);
        }
        .toggle-btn {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
        }
        .toggle-btn:hover {
            color: #FFF;
        }
        .btn-submit {
            width: 100%;
            background: linear-gradient(135deg, #2DD4BF, #06B6D4);
            color: #07090E;
            border: none;
            border-radius: 10px;
            padding: 14px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 8px;
            box-shadow: 0 4px 18px rgba(45, 212, 191, 0.25);
        }
        .btn-submit:hover {
            opacity: 0.92;
            transform: translateY(-1px);
        }
        .btn-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .alert {
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
            margin-bottom: 18px;
            display: none;
        }
        .alert-error {
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.35);
            color: #FCA5A5;
        }
        .alert-success {
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.35);
            color: #6EE7B7;
        }
        .footer-link {
            text-align: center;
            margin-top: 22px;
            font-size: 13px;
            color: var(--text-muted);
        }
        .footer-link a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
        }
        .footer-link a:hover {
            text-decoration: underline;
        }
        /* Google reCAPTCHA v3 Policy-Compliant Badge Hide & Attribution */
        .grecaptcha-badge {
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        .recaptcha-legal-notice {
            font-size: 11px;
            color: #64748B;
            line-height: 1.5;
            text-align: center;
            margin-top: 14px;
            display: block;
        }
        .recaptcha-legal-notice a {
            color: #94A3B8;
            text-decoration: underline;
            transition: color 0.15s ease;
        }
        .recaptcha-legal-notice a:hover {
            color: var(--primary);
        }
    </style>
</head>
<body>

    <div class="reset-container">
        
        <div class="logo-header">
            <a href="/" style="display: inline-block;">
                <img src="/brand-logo.png" alt="AntiProfiles" style="height: 40px; width: auto; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';">
            </a>
        </div>

        <div class="reset-card">
            
            <div id="alertBox" class="alert"></div>

            <?php if (empty($token)): ?>
                <!-- No token state -->
                <h1>Request Password Reset</h1>
                <p class="subtitle">Enter your account email to receive a password reset link.</p>
                <form id="requestResetForm" onsubmit="handleRequestReset(event)">
                    <div class="form-group">
                        <label for="reqEmail">Email Address</label>
                        <input type="email" id="reqEmail" placeholder="yourname@domain.com" required>
                    </div>
                    <button type="submit" id="btnReqSubmit" class="btn-submit">Send Password Reset Link</button>
                    <p class="recaptcha-legal-notice">
                        This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
                    </p>
                </form>
            <?php elseif (!$initialValid): ?>
                <!-- Invalid or expired token -->
                <div style="text-align: center; padding: 10px 0;">
                    <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
                    <h1 style="font-size: 20px;">Invalid or Expired Link</h1>
                    <p class="subtitle" style="margin-bottom: 20px;">
                        This password reset token is either invalid, already used, or has expired after 1 hour.
                    </p>
                    <a href="/reset-password" class="btn-submit" style="display: block; text-decoration: none; text-align: center; line-height: 1.4;">
                        Request New Reset Link
                    </a>
                </div>
            <?php else: ?>
                <!-- Token is valid -> Show reset form -->
                <div id="formSection">
                    <h1>Set New Password</h1>
                    <p class="subtitle">
                        Resetting password for <strong><?php echo htmlspecialchars($userEmail); ?></strong>
                    </p>
                    
                    <form id="resetPasswordForm" onsubmit="handlePasswordReset(event)">
                        <input type="hidden" id="resetToken" value="<?php echo htmlspecialchars($token); ?>">
                        
                        <div class="form-group">
                            <label for="newPassword">New Password (min. 6 characters)</label>
                            <div class="input-wrapper">
                                <input type="password" id="newPassword" placeholder="••••••••" required minlength="6">
                                <button type="button" class="toggle-btn" onclick="toggleVisibility('newPassword', this)">👁️</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="confirmPassword">Confirm New Password</label>
                            <div class="input-wrapper">
                                <input type="password" id="confirmPassword" placeholder="••••••••" required minlength="6">
                                <button type="button" class="toggle-btn" onclick="toggleVisibility('confirmPassword', this)">👁️</button>
                            </div>
                        </div>

                        <button type="submit" id="btnResetSubmit" class="btn-submit">Update Password</button>
                        <p class="recaptcha-legal-notice">
                            This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
                        </p>
                    </form>
                </div>

                <div id="successSection" style="display: none; text-align: center; padding: 10px 0;">
                    <div style="font-size: 44px; margin-bottom: 12px;">🎉</div>
                    <h1 style="font-size: 22px;">Password Reset Complete!</h1>
                    <p class="subtitle" style="margin-bottom: 24px;">
                        Your password has been changed successfully. You can now sign in with your new credentials across Web and Desktop applications.
                    </p>
                    <a href="/#login" class="btn-submit" style="display: block; text-decoration: none; text-align: center;">
                        Sign In to Your Account
                    </a>
                </div>
            <?php endif; ?>

            <div class="footer-link">
                <a href="/">← Back to Homepage</a> • <a href="/#login">Sign In</a>
            </div>

        </div>
    </div>

    <script>
        function toggleVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🔒';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        }

        function showAlert(msg, isSuccess) {
            const box = document.getElementById('alertBox');
            box.className = 'alert ' + (isSuccess ? 'alert-success' : 'alert-error');
            box.textContent = msg;
            box.style.display = 'block';
        }

        async function handleRequestReset(e) {
            e.preventDefault();
            const email = document.getElementById('reqEmail').value.trim();
            const btn = document.getElementById('btnReqSubmit');
            btn.disabled = true;
            btn.textContent = 'Sending Link...';

            try {
                const res = await fetch('/api/auth.php?action=forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert(data.message || 'If an account exists, a reset link has been dispatched to your email.', true);
                    document.getElementById('reqEmail').value = '';
                } else {
                    showAlert(data.error || 'Failed to send reset link.', false);
                }
            } catch (err) {
                showAlert('Network error communicating with server.', false);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Password Reset Link';
            }
        }

        async function handlePasswordReset(e) {
            e.preventDefault();
            const token = document.getElementById('resetToken').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const btn = document.getElementById('btnResetSubmit');

            if (newPassword.length < 6) {
                showAlert('Password must be at least 6 characters long.', false);
                return;
            }

            if (newPassword !== confirmPassword) {
                showAlert('Passwords do not match. Please re-enter.', false);
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Updating Password...';

            try {
                const res = await fetch('/api/auth.php?action=reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token, newPassword: newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById('formSection').style.display = 'none';
                    document.getElementById('alertBox').style.display = 'none';
                    document.getElementById('successSection').style.display = 'block';
                } else {
                    showAlert(data.error || 'Password reset failed.', false);
                    btn.disabled = false;
                    btn.textContent = 'Update Password';
                }
            } catch (err) {
                showAlert('Network error communicating with server.', false);
                btn.disabled = false;
                btn.textContent = 'Update Password';
            }
        }
    </script>
</body>
</html>
