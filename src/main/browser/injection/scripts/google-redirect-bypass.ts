// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google Redirect Bypass (Client-Side Fallback)
// Injected via evaluateOnNewDocument to catch /sorry/ bot gate pages.
// Explicitly ignores accounts.google.com and authentication flows.
// ──────────────────────────────────────────────────────────────────

/**
 * Build a client-side JavaScript injection script that detects
 * Google /sorry/ bot block pages and attempts fallback bypass.
 */
export function buildGoogleRedirectBypassScript(): string {
  return `
// ═══ Google /sorry/ Bot Page Bypass (Client-Side) ═══
(function() {
  'use strict';

  function isAuthPage(loc) {
    var host = (loc.hostname || '').toLowerCase();
    var path = (loc.pathname || '').toLowerCase();
    return (
      host.indexOf('accounts.google.') !== -1 ||
      host.indexOf('myaccount.google.') !== -1 ||
      host.indexOf('oauth') !== -1 ||
      path.indexOf('/signin') !== -1 ||
      path.indexOf('/signup') !== -1 ||
      path.indexOf('/servicelogin') !== -1 ||
      path.indexOf('/oauth') !== -1 ||
      path.indexOf('/v3/signin') !== -1
    );
  }

  // Known Google /sorry/ hostnames
  var googleRedirectHosts = [
    'www.google.com', 'google.com',
    'ipv4.google.com'
  ];

  function isGoogleSorryHost(hostname) {
    if (googleRedirectHosts.indexOf(hostname) !== -1) return true;
    return /^([a-z0-9-]+\\.)?google\\.[a-z.]+$/i.test(hostname);
  }

  var sorryPaths = ['/sorry/', '/sorry/index'];
  var destParams = ['continue', 'url', 'q', 'dest', 'redirect', 'target'];

  function checkAndBypass() {
    try {
      var loc = window.location;
      if (isAuthPage(loc)) return;
      if (!isGoogleSorryHost(loc.hostname)) return;

      var isSorry = false;
      for (var i = 0; i < sorryPaths.length; i++) {
        if (loc.pathname.indexOf(sorryPaths[i]) === 0) {
          isSorry = true;
          break;
        }
      }
      if (!isSorry) return;

      var params = new URLSearchParams(loc.search);
      for (var j = 0; j < destParams.length; j++) {
        var value = params.get(destParams[j]);
        if (value) {
          var decoded = value;
          try { decoded = decodeURIComponent(value); } catch(e) { decoded = value; }
          if (decoded.indexOf('http://') === 0 || decoded.indexOf('https://') === 0) {
            try {
              var parsed = new URL(decoded);
              if (isAuthPage(parsed)) return;
            } catch(e) {}
            window.location.replace(decoded);
            return;
          }
        }
      }
    } catch(e) {}
  }

  checkAndBypass();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndBypass);
  }
})();`
}
