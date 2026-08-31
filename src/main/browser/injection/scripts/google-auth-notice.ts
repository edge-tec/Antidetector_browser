// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google Authentication Notice & Guidance Script
// Injected into profile pages to inform users about RFC 8252 OAuth
// and prevent confusion if Google Botguard blocks direct logins.
// ──────────────────────────────────────────────────────────────────

export function buildGoogleAuthNoticeScript(): string {
  return `
// ═══ Google Authentication Notice (Client-Side Guidance) ═══
(function() {
  'use strict';

  function isGoogleAccountsPage() {
    try {
      var host = (window.location.hostname || '').toLowerCase();
      var path = (window.location.pathname || '').toLowerCase();
      return (
        host.indexOf('accounts.google.') !== -1 ||
        (host.indexOf('google.') !== -1 && (path.indexOf('/signin') !== -1 || path.indexOf('/v3/signin') !== -1 || path.indexOf('/servicelogin') !== -1))
      );
    } catch(e) {
      return false;
    }
  }

  function showGoogleAuthNotice() {
    if (!isGoogleAccountsPage()) return;
    if (document.getElementById('antiprofiles-google-auth-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'antiprofiles-google-auth-banner';
    banner.style.cssText = [
      'position: fixed',
      'top: 16px',
      'right: 16px',
      'z-index: 2147483647',
      'max-width: 360px',
      'padding: 16px 20px',
      'background: #181824',
      'color: #F1F5F9',
      'border: 1px solid #3B82F6',
      'border-radius: 12px',
      'box-shadow: 0 10px 30px rgba(0,0,0,0.5)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 13px',
      'line-height: 1.5'
    ].join(';');

    banner.innerHTML = [
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">',
      '  <div style="font-weight:700;color:#60A5FA;display:flex;align-items:center;gap:6px;">',
      '    <span>🛡️</span> Google Account Connection',
      '  </div>',
      '  <button id="antiprofiles-google-close-btn" style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:16px;line-height:1;padding:0;">✕</button>',
      '</div>',
      '<p style="margin:0 0 10px;color:#CBD5E1;font-size:12px;">',
      '  For security and compatibility, Google account authentication must be completed securely via Apple Safari Authentication Session / System Browser OAuth 2.0.',
      '</p>',
      '<p style="margin:0;color:#94A3B8;font-size:11px;">',
      '  Continue securely with Safari authentication using the <strong>"G Connect"</strong> button on your profile card.',
      '</p>'
    ].join('');

    function appendBanner() {
      if (document.body && !document.getElementById('antiprofiles-google-auth-banner')) {
        document.body.appendChild(banner);
        var closeBtn = document.getElementById('antiprofiles-google-close-btn');
        if (closeBtn) {
          closeBtn.onclick = function() {
            banner.remove();
          };
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', appendBanner);
    } else {
      appendBanner();
    }
  }

  try {
    showGoogleAuthNotice();
  } catch(e) {}
})();
`;
}
