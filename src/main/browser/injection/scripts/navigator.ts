// ──────────────────────────────────────────────────────────────────
// ProfileVault — Navigator Injection Script Builder
// Overrides navigator.* properties using Object.defineProperty
// ──────────────────────────────────────────────────────────────────

import { NavigatorFingerprint } from '../../../fingerprint/types'

export function buildNavigatorScript(nav: NavigatorFingerprint): string {
  return `
// ═══ Navigator Override ═══
(function() {
  const navOverrides = ${JSON.stringify({
    userAgent: nav.userAgent,
    platform: nav.platform,
    appCodeName: nav.appCodeName,
    appName: nav.appName,
    appVersion: nav.appVersion,
    product: nav.product,
    productSub: nav.productSub,
    vendor: nav.vendor,
    vendorSub: nav.vendorSub,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
    doNotTrack: nav.doNotTrack,
    cookieEnabled: nav.cookieEnabled,
    pdfViewerEnabled: nav.pdfViewerEnabled,
    webdriver: nav.webdriver
  })};

  for (const [key, value] of Object.entries(navOverrides)) {
    if (value === undefined) continue;
    try {
      Object.defineProperty(Navigator.prototype, key, {
        get: function() { return value; },
        configurable: true
      });
    } catch(e) {
      try {
        Object.defineProperty(navigator, key, {
          get: function() { return value; },
          configurable: true
        });
      } catch(e2) {}
    }
  }

  // Override navigator.languages (getter only)
  const _languages = ${JSON.stringify(nav.languages || ['en-US', 'en'])};
  try {
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: function() { return Object.freeze([..._languages]); },
      configurable: true
    });
  } catch(e) {}

  // Ensure navigator.webdriver is always false
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
      configurable: true
    });
  } catch(e) {}

  // Override User-Agent Client Hints API if available
  if (navigator.userAgentData) {
    try {
      const brandVersion = ${JSON.stringify(nav.browserVersion.split('.')[0] || '128')};
      const isAndroidOS = ${nav.touchSupport || nav.platform.includes('arm') || nav.platform.includes('Android') ? 'true' : 'false'};
      const clientPlatform = isAndroidOS ? "Android" : ${JSON.stringify(nav.platform === 'Win32' ? 'Windows' : nav.platform.includes('Mac') ? 'macOS' : 'Linux')};

      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: function() {
          return {
            brands: [
              { brand: "Chromium", version: brandVersion },
              { brand: "Google Chrome", version: brandVersion },
              { brand: "Not-A.Brand", version: "99" }
            ],
            mobile: isAndroidOS,
            platform: clientPlatform,
            getHighEntropyValues: function(hints) {
              return Promise.resolve({
                brands: this.brands,
                mobile: this.mobile,
                platform: this.platform,
                architecture: isAndroidOS ? "arm" : ${JSON.stringify(nav.cpuArchitecture)},
                bitness: ${JSON.stringify(nav.platformArchitecture === '64-bit' ? '64' : '32')},
                model: isAndroidOS ? "Pixel 8" : "",
                platformVersion: isAndroidOS ? "14.0.0" : "10.0.0",
                uaFullVersion: ${JSON.stringify(nav.browserVersion)},
                fullVersionList: this.brands
              });
            }
          };
        },
        configurable: true
      });
    } catch(e) {}
  }

  // Touch support override
  if (${nav.touchSupport}) {
    try {
      if (!('ontouchstart' in window)) {
        Object.defineProperty(window, 'ontouchstart', { get: () => null, configurable: true });
      }
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => ${nav.maxTouchPoints || 5}, configurable: true });
    } catch(e) {}
  } else {
    try {
      Object.defineProperty(window, 'ontouchstart', { get: () => undefined, configurable: true });
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 0, configurable: true });
    } catch(e) {}
  }
})();`
}
