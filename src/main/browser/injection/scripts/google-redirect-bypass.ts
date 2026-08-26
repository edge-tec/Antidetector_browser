// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google Redirect Bypass (Client-Side Fallback)
// Injected via evaluateOnNewDocument to catch any Google redirect
// pages that slip through the CDP Fetch interceptor layer.
// ──────────────────────────────────────────────────────────────────

/**
 * Build a client-side JavaScript injection script that detects
 * Google redirect/interstitial pages and immediately redirects
 * to the extracted destination URL before reCAPTCHA renders.
 */
export function buildGoogleRedirectBypassScript(): string {
  return `
// ═══ Google Redirect / reCAPTCHA Bypass (Client-Side Fallback) ═══
(function() {
  'use strict';

  // Known Google redirect/interstitial hostnames
  var googleRedirectHosts = [
    'www.google.com', 'google.com',
    'www.google.co.uk', 'www.google.de', 'www.google.fr',
    'www.google.co.jp', 'www.google.com.br', 'www.google.ca',
    'www.google.com.au', 'www.google.co.in', 'www.google.ru',
    'www.google.es', 'www.google.it', 'www.google.nl',
    'consent.google.com', 'ipv4.google.com'
  ];

  // Check if current hostname matches any Google domain pattern
  function isGoogleHost(hostname) {
    if (googleRedirectHosts.indexOf(hostname) !== -1) return true;
    // Generic pattern: *.google.TLD
    return /^(www\\.|consent\\.|ipv4\\.)?google\\.[a-z.]+$/i.test(hostname);
  }

  // Known redirect/interstitial paths
  var redirectPaths = ['/sorry/', '/sorry/index', '/url'];

  // Known destination parameter names
  var destParams = ['continue', 'url', 'q', 'dest', 'redirect', 'target'];

  function checkAndBypass() {
    try {
      var loc = window.location;
      if (!isGoogleHost(loc.hostname)) return;

      // Check if current path matches a redirect pattern
      var isRedirect = false;
      for (var i = 0; i < redirectPaths.length; i++) {
        if (loc.pathname.indexOf(redirectPaths[i]) === 0) {
          isRedirect = true;
          break;
        }
      }
      if (!isRedirect) return;

      // Extract destination URL from query parameters
      var params = new URLSearchParams(loc.search);
      for (var j = 0; j < destParams.length; j++) {
        var value = params.get(destParams[j]);
        if (value) {
          var decoded = value;
          try { decoded = decodeURIComponent(value); } catch(e) { decoded = value; }
          if (decoded.indexOf('http://') === 0 || decoded.indexOf('https://') === 0) {
            // Found a valid destination — redirect immediately
            window.location.replace(decoded);
            return;
          }
          // Try prepending https:// if it looks like a domain
          if (decoded.indexOf('.') !== -1 && decoded.indexOf(' ') === -1 && decoded.charAt(0) !== '/') {
            window.location.replace('https://' + decoded);
            return;
          }
        }
      }

      // Also check hash parameters (some Google redirect formats)
      if (loc.hash && loc.hash.length > 1) {
        var hashParams = new URLSearchParams(loc.hash.substring(1));
        for (var k = 0; k < destParams.length; k++) {
          var hval = hashParams.get(destParams[k]);
          if (hval && (hval.indexOf('http://') === 0 || hval.indexOf('https://') === 0)) {
            window.location.replace(hval);
            return;
          }
        }
      }
    } catch(e) {
      // Silent failure
    }
  }

  // Run immediately (before DOM renders)
  checkAndBypass();

  // Also run on DOMContentLoaded as a safety net
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndBypass);
  }
})();`
}
