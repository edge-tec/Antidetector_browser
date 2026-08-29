// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Navigator Injection Script Builder
// Overrides navigator.* properties, Client Hints, plugins, and native fidelity
// ──────────────────────────────────────────────────────────────────

import { NavigatorFingerprint } from '../../../fingerprint/types'

export function buildNavigatorScript(
  nav: NavigatorFingerprint,
  browserType: 'chrome' | 'firefox' = 'chrome'
): string {
  const isMobile = !!nav.touchSupport || nav.platform === 'iPhone' || (nav.platform && nav.platform.includes('Android')) || (nav.platform && nav.platform.includes('arm'))
  const isFirefox = browserType === 'firefox' || (nav.userAgent && nav.userAgent.includes('Firefox')) || (nav.userAgent && nav.userAgent.includes('FxiOS'))
  const isIos = nav.platform === 'iPhone' || (nav.userAgent && nav.userAgent.includes('iPhone'))

  const brandVersion = nav.browserVersion ? nav.browserVersion.split('.')[0] : '131'
  const clientPlatform = isMobile
    ? (isIos ? 'iOS' : 'Android')
    : (nav.platform === 'Win32' ? 'Windows' : nav.platform.includes('Mac') ? 'macOS' : 'Linux')

  return `
// ═══ Navigator Override & Environment Integrity ═══
(function() {
  'use strict';

  const cloak = window.__cloakFunction || function(f) { return f; };
  const cloakGetter = window.__cloakGetter || function(f) { return f; };

  // 1. Prototype Property Traps
  const protoOverrides = {
    platform: ${JSON.stringify(nav.platform || 'Win32')},
    vendor: ${JSON.stringify(nav.vendor || (isFirefox ? '' : 'Google Inc.'))},
    vendorSub: ${JSON.stringify(nav.vendorSub || '')},
    product: ${JSON.stringify(nav.product || 'Gecko')},
    productSub: ${JSON.stringify(nav.productSub || (isFirefox ? '20100101' : '20030107'))},
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: ${JSON.stringify(nav.appVersion || (isFirefox ? '5.0 (Windows)' : '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'))},
    userAgent: ${JSON.stringify(nav.userAgent || '')},
    hardwareConcurrency: ${nav.hardwareConcurrency || 8},
    deviceMemory: ${nav.deviceMemory || 8},
    maxTouchPoints: ${nav.maxTouchPoints ?? (isMobile ? 5 : 0)},
    doNotTrack: ${JSON.stringify(nav.doNotTrack || null)},
    webdriver: false,
    cookieEnabled: true,
    pdfViewerEnabled: ${!isMobile && !isFirefox}
  };

  for (const [key, value] of Object.entries(protoOverrides)) {
    if (value === undefined) continue;
    try {
      const getter = cloakGetter(function() {
        if (this !== navigator && !(this instanceof Navigator)) {
          throw new TypeError('Illegal invocation');
        }
        return value;
      }, key);

      Object.defineProperty(Navigator.prototype, key, {
        get: getter,
        configurable: true,
        enumerable: true
      });
    } catch(e) {}
  }

  // 2. Override navigator.languages (frozen array)
  const _languages = ${JSON.stringify(nav.languages || ['en-US', 'en'])};
  try {
    const langGetter = cloakGetter(function() { return _languages[0] || 'en-US'; }, 'language');
    const langsGetter = cloakGetter(function() { return Object.freeze([..._languages]); }, 'languages');

    Object.defineProperty(Navigator.prototype, 'languages', {
      get: langsGetter,
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(Navigator.prototype, 'language', {
      get: langGetter,
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

  ${isFirefox ? `
  // ── Firefox Integrity: Ensure window.chrome & Client Hints are NOT Present ──
  try {
    if (typeof window !== 'undefined' && 'chrome' in window) {
      delete window.chrome;
    }
    if ('userAgentData' in Navigator.prototype) {
      delete (Navigator.prototype as any).userAgentData;
    }
  } catch(e) {}
  ` : `
  // ── Chromium Integrity: Standard window.chrome Object ──
  try {
    if (typeof window !== 'undefined') {
      if (!window.chrome) {
        window.chrome = {};
      }

      // Chrome App Object
      if (!window.chrome.app) {
        window.chrome.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails: cloak(function() { return null; }, 'getDetails'),
          getIsInstalled: cloak(function() { return false; }, 'getIsInstalled'),
          runningState: cloak(function() { return 'cannot_run'; }, 'runningState')
        };
      }

      // Chrome Runtime Object
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
          connect: cloak(function() {
            return {
              disconnect: cloak(function() {}, 'disconnect'),
              onDisconnect: { addListener: cloak(function() {}, 'addListener') },
              onMessage: { addListener: cloak(function() {}, 'addListener') },
              postMessage: cloak(function() {}, 'postMessage')
            };
          }, 'connect'),
          sendMessage: cloak(function() {}, 'sendMessage'),
          id: undefined
        };
      }
    }
  } catch(e) {}

  // ── Chromium Client Hints (navigator.userAgentData) ──
  ${!isIos ? `
  try {
    const brandsList = [
      { brand: 'Chromium', version: ${JSON.stringify(brandVersion)} },
      { brand: 'Google Chrome', version: ${JSON.stringify(brandVersion)} },
      { brand: 'Not_A Brand', version: '24' }
    ];
    const fullVersionList = [
      { brand: 'Chromium', version: ${JSON.stringify(nav.browserVersion || '131.0.0.0')} },
      { brand: 'Google Chrome', version: ${JSON.stringify(nav.browserVersion || '131.0.0.0')} },
      { brand: 'Not_A Brand', version: '24.0.0.0' }
    ];

    const uaDataObj = {
      brands: Object.freeze(brandsList),
      mobile: ${isMobile ? 'true' : 'false'},
      platform: ${JSON.stringify(clientPlatform)},
      getHighEntropyValues: cloak(function(hints) {
        return Promise.resolve({
          brands: brandsList,
          mobile: ${isMobile ? 'true' : 'false'},
          platform: ${JSON.stringify(clientPlatform)},
          architecture: ${JSON.stringify(nav.cpuArchitecture || 'x86')},
          bitness: '64',
          model: ${JSON.stringify(isMobile ? ((nav as any).deviceModelCode || (nav as any).deviceModel || '') : '')},
          platformVersion: ${JSON.stringify(clientPlatform === 'Windows' ? '15.0.0' : clientPlatform === 'macOS' ? '14.5.0' : '6.5.0')},
          fullVersionList: fullVersionList,
          uaFullVersion: ${JSON.stringify(nav.browserVersion || '131.0.0.0')}
        });
      }, 'getHighEntropyValues'),
      toJSON: cloak(function() {
        return {
          brands: brandsList,
          mobile: ${isMobile ? 'true' : 'false'},
          platform: ${JSON.stringify(clientPlatform)}
        };
      }, 'toJSON')
    };

    const uaDataGetter = cloakGetter(function() { return uaDataObj; }, 'userAgentData');
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: uaDataGetter,
      enumerable: true,
      configurable: true
    });
  } catch(e) {}
  ` : ''}

  // ── Desktop Chromium Plugins Emulation ──
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
        Object.defineProperty(pluginsObj, 'item', { value: cloak(function(i) { return this[i] || null; }, 'item') });
        Object.defineProperty(pluginsObj, 'namedItem', { value: cloak(function(name) { return this[name] || null; }, 'namedItem') });
        Object.defineProperty(pluginsObj, 'refresh', { value: cloak(function() {}, 'refresh') });

        Object.defineProperty(mimeTypesObj, 'length', { value: rawMimes.length, enumerable: false });
        Object.defineProperty(mimeTypesObj, 'item', { value: cloak(function(i) { return this[i] || null; }, 'item') });
        Object.defineProperty(mimeTypesObj, 'namedItem', { value: cloak(function(name) { return this[name] || null; }, 'namedItem') });

        Object.defineProperty(Navigator.prototype, 'plugins', {
          get: cloakGetter(function() { return pluginsObj; }, 'plugins'),
          enumerable: true,
          configurable: true
        });

        Object.defineProperty(Navigator.prototype, 'mimeTypes', {
          get: cloakGetter(function() { return mimeTypesObj; }, 'mimeTypes'),
          enumerable: true,
          configurable: true
        });
      }
    } catch(e) {}
  }
  `}
})();`
}
