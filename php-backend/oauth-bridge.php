<?php
// ──────────────────────────────────────────────
// AntiProfiles — Dedicated Google OAuth Desktop Bridge
// ──────────────────────────────────────────────

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$googleConfig = getGoogleOAuthConfigPhp();
$clientId = $googleConfig['clientId'] ?? '';
$isDesktop = isset($_GET['desktop']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in with Google - AntiProfiles</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <!-- Google Identity Services SDK -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        body {
            background: #0B0C10;
            color: #FFFFFF;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .bridge-card {
            width: 100%;
            max-width: 440px;
            background: #12141D;
            border: 1px solid #272A3B;
            border-radius: 16px;
            padding: 36px 28px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }
        .brand-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 24px;
        }
        .brand-logo img {
            width: 38px;
            height: 38px;
            border-radius: 8px;
        }
        .brand-logo span {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #FFF;
        }
        .brand-logo span b {
            color: #2DD4BF;
        }
        .google-icon-box {
            width: 58px;
            height: 58px;
            background: #1A1D2B;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            border: 1px solid #2A2E42;
        }
        h2 {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #FFF;
        }
        p {
            font-size: 13px;
            color: #94A3B8;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .msg-box {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 13px;
            font-weight: 600;
            display: none;
            line-height: 1.4;
        }
        .btn-google {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            background: #0A0B10;
            border: 1px solid #272A3B;
            color: #FFF;
            padding: 14px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-bottom: 16px;
        }
        .btn-google:hover {
            border-color: #4285F4;
            background: rgba(66, 133, 244, 0.1);
        }
        .input-group {
            text-align: left;
            margin-bottom: 16px;
        }
        .input-group label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #CBD5E1;
            margin-bottom: 6px;
        }
        .input-group input {
            width: 100%;
            background: #0A0B10;
            border: 1px solid #272A3B;
            border-radius: 8px;
            padding: 12px;
            color: #FFF;
            font-size: 14px;
            outline: none;
        }
        .input-group input:focus {
            border-color: #2DD4BF;
        }
        .btn-submit {
            width: 100%;
            background: #2DD4BF;
            color: #000;
            font-weight: 800;
            padding: 13px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            transition: opacity 0.2s;
        }
        .btn-submit:hover { opacity: 0.9; }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #2DD4BF;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="bridge-card">
        <div class="brand-logo">
            <img src="/logo.png" alt="AntiProfiles">
            <span>Anti<b>Profiles</b></span>
        </div>

        <div class="google-icon-box">
            <svg width="30" height="30" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        </div>

        <h2>Google Sign-In Bridge</h2>
        <p>Connecting your Google Account securely to AntiProfiles Desktop Application.</p>

        <div id="statusMsg" class="msg-box"></div>

        <div id="gsiButtonArea" style="margin-bottom: 16px;">
            <button type="button" id="btnLaunchGoogle" class="btn-google" onclick="triggerGooglePopup()">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                Continue with Google
            </button>
        </div>

        <div id="fallbackForm" style="display: none; border-top: 1px solid #272A3B; padding-top: 18px; margin-top: 18px;">
            <form onsubmit="submitDirectEmail(event); return false;">
                <div class="input-group">
                    <label>Or enter your Google Email directly:</label>
                    <input type="email" id="directEmailInput" placeholder="name@gmail.com" required>
                </div>
                <button type="submit" id="btnDirectSubmit" class="btn-submit">Authenticate with Email</button>
            </form>
        </div>
    </div>

    <script>
        const GOOGLE_CLIENT_ID = "<?php echo htmlspecialchars($clientId, ENT_QUOTES, 'UTF-8'); ?>";
        let tokenClient = null;

        function showMessage(text, isSuccess, isError) {
            const el = document.getElementById('statusMsg');
            if (!el) return;
            el.style.display = 'block';
            if (isSuccess) {
                el.style.background = 'rgba(45,212,191,0.2)';
                el.style.color = '#2DD4BF';
                el.style.border = '1px solid rgba(45,212,191,0.4)';
            } else if (isError) {
                el.style.background = 'rgba(239,68,68,0.2)';
                el.style.color = '#F87171';
                el.style.border = '1px solid rgba(239,68,68,0.4)';
            } else {
                el.style.background = 'rgba(99,102,241,0.2)';
                el.style.color = '#818CF8';
                el.style.border = '1px solid rgba(99,102,241,0.4)';
            }
            el.innerHTML = text;
        }

        function initBridge() {
            if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 20 && !GOOGLE_CLIENT_ID.includes('YOUR_')) {
                setupGoogle();
            } else {
                document.getElementById('fallbackForm').style.display = 'block';
                showMessage('ℹ️ Google OAuth Client ID is not configured in Admin settings yet. You can sign in using your email address below.', false, false);
            }
        }

        function setupGoogle() {
            if (typeof google === 'undefined' || !google.accounts) {
                setTimeout(setupGoogle, 200);
                return;
            }

            try {
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                if (google.accounts.oauth2) {
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: GOOGLE_CLIENT_ID,
                        scope: 'email profile openid',
                        callback: async (res) => {
                            if (res && res.access_token) {
                                await sendAuthPayload({ access_token: res.access_token });
                            } else if (res && res.error) {
                                showMessage('Google sign-in cancelled or failed: ' + res.error, false, true);
                            }
                        }
                    });
                }

                // User clicks button to launch Google popup or uses email
            } catch (e) {
                console.warn('[Bridge] Google setup error:', e);
                document.getElementById('fallbackForm').style.display = 'block';
            }
        }

        function triggerGooglePopup() {
            if (tokenClient) {
                tokenClient.requestAccessToken({ prompt: 'select_account' });
            } else if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                google.accounts.id.prompt();
            } else {
                document.getElementById('fallbackForm').style.display = 'block';
            }
        }

        async function handleCredentialResponse(response) {
            if (response && response.credential) {
                await sendAuthPayload({ credential: response.credential });
            }
        }

        async function submitDirectEmail(e) {
            if (e) e.preventDefault();
            const email = (document.getElementById('directEmailInput').value || '').trim();
            if (!email || !email.includes('@')) {
                showMessage('Please enter a valid email address.', false, true);
                return;
            }
            const name = email.split('@')[0].replace(/[._]/g, ' ');
            await sendAuthPayload({
                email: email,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                googleId: 'g_' + Math.random().toString(36).substring(2, 12)
            });
        }

        async function sendAuthPayload(payload) {
            showMessage('<span class="spinner"></span> Authenticating with AntiProfiles Server...', false, false);
            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success && data.sessionToken && data.user) {
                    showMessage('✅ Google Sign-In successful! Connecting to Desktop App...', true, false);
                    localStorage.setItem('sessionToken', data.sessionToken);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Store in window for Electron reader
                    window.__antiprofiles_auth_success = true;
                    window.__antiprofiles_session_token = data.sessionToken;
                    window.__antiprofiles_user = data.user;

                    // If loopback desktop port is present, redirect to local desktop server
                    const urlParams = new URLSearchParams(window.location.search);
                    const port = urlParams.get('port');
                    if (port && port.length > 1) {
                        try {
                            window.location.href = 'http://127.0.0.1:' + encodeURIComponent(port) + '/callback?token=' + encodeURIComponent(data.sessionToken) + '&user=' + encodeURIComponent(JSON.stringify(data.user));
                            return;
                        } catch(e) {}
                    }

                    setTimeout(() => {
                        window.close();
                    }, 1000);
                } else {
                    showMessage('❌ ' + (data.error || 'Authentication failed. Please try again.'), false, true);
                    document.getElementById('fallbackForm').style.display = 'block';
                }
            } catch (err) {
                showMessage('❌ Network error connecting to authentication server.', false, true);
                document.getElementById('fallbackForm').style.display = 'block';
            }
        }

        window.addEventListener('DOMContentLoaded', initBridge);
    </script>
</body>
</html>
