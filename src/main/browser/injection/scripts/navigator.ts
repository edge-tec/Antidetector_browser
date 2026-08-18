// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Navigator Injection Script Builder
// Overrides navigator.* properties, plugins, mimeTypes, and native fidelity
// ──────────────────────────────────────────────────────────────────

import { NavigatorFingerprint } from '../../../fingerprint/types'

export function buildNavigatorScript(nav: NavigatorFingerprint): string {
  const isMobile = !!nav.touchSupport || nav.platform === 'iPhone' || nav.platform.includes('Android') || nav.platform.includes('arm')
  const brandVersion = nav.browserVersion ? nav.browserVersion.split('.')[0] : '131'
  const clientPlatform = isMobile
    ? (nav.platform === 'iPhone' ? 'iOS' : 'Android')
    : (nav.platform === 'Win32' ? 'Windows' : nav.platform.includes('Mac') ? 'macOS' : 'Linux')

  return `
// ═══ Navigator & Browser Environment Integrity ═══
(function() {
  'use strict';

  const safeOverrides = ${JSON.stringify({
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
    doNotTrack: nav.doNotTrack
  })};

  for (const [key, value] of Object.entries(safeOverrides)) {
    if (value === undefined || value === null) continue;
    try {
      Object.defineProperty(Navigator.prototype, key, {
        get: function() {
          if (this !== navigator && !(this instanceof Navigator)) {
            throw new TypeError('Illegal invocation');
          }
          return value;
        },
        configurable: true,
        enumerable: true
      });
    } catch(e) {}
  }

  // Override navigator.languages (frozen array)
  const _languages = ${JSON.stringify(nav.languages || ['en-US', 'en'])};
  try {
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: function() { return Object.freeze([..._languages]); },
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

  // Ensure navigator.webdriver is false
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: function() { return false; },
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

  // ── Preserve Native Desktop Plugins & MimeTypes or Emulate Cleanly ──
  if (!${isMobile ? 'true' : 'false'} && typeof navigator !== 'undefined' && (!navigator.plugins || navigator.plugins.length === 0)) {
    try {
      const pluginDefs = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] }
      ];

      if (typeof PluginArray !== 'undefined' && typeof MimeTypeArray !== 'undefined') {
        const pluginsObj = Object.create(PluginArray.prototype);
        const mimeTypesObj = Object.create(MimeTypeArray.prototype);
        const rawPlugins = [];
        const rawMimes = [];

        pluginDefs.forEach(function(p) {
          const plugin = Object.create(Plugin.prototype);
          Object.defineProperties(plugin, {
            name: { value: p.name, enumerable: true },
            filename: { value: p.filename, enumerable: true },
            description: { value: p.description, enumerable: true },
            length: { value: p.mimeTypes.length, enumerable: true }
          });

          p.mimeTypes.forEach(function(m, mIdx) {
            const mime = Object.create(MimeType.prototype);
            Object.defineProperties(mime, {
              type: { value: m.type, enumerable: true },
              suffixes: { value: m.suffixes, enumerable: true },
              description: { value: m.description, enumerable: true },
              enabledPlugin: { value: plugin, enumerable: true }
            });
            plugin[mIdx] = mime;
            plugin[m.type] = mime;
            rawMimes.push(mime);
          });

          rawPlugins.push(plugin);
        });

        rawPlugins.forEach(function(pl, i) {
          pluginsObj[i] = pl;
          pluginsObj[pl.name] = pl;
        });

        rawMimes.forEach(function(m, i) {
          mimeTypesObj[i] = m;
          mimeTypesObj[m.type] = m;
        });

        Object.defineProperty(pluginsObj, 'length', { value: rawPlugins.length, enumerable: false });
        Object.defineProperty(pluginsObj, 'item', { value: function(i) { return this[i] || null; } });
        Object.defineProperty(pluginsObj, 'namedItem', { value: function(name) { return this[name] || null; } });
        Object.defineProperty(pluginsObj, 'refresh', { value: function() {} });

        Object.defineProperty(mimeTypesObj, 'length', { value: rawMimes.length, enumerable: false });
        Object.defineProperty(mimeTypesObj, 'item', { value: function(i) { return this[i] || null; } });
        Object.defineProperty(mimeTypesObj, 'namedItem', { value: function(name) { return this[name] || null; } });

        Object.defineProperty(Navigator.prototype, 'plugins', {
          get: function() { return pluginsObj; },
          enumerable: true,
          configurable: true
        });

        Object.defineProperty(Navigator.prototype, 'mimeTypes', {
          get: function() { return mimeTypesObj; },
          enumerable: true,
          configurable: true
        });
      }
    } catch(e) {}
  }

  // ── Standard window.chrome Object for Chrome Profiles ──
  try {
    if (!window.chrome) {
      window.chrome = {};
    }
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      };
    }
  } catch(e) {}
})();`
}
