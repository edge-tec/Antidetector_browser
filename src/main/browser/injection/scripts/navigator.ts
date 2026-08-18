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

  const nativeToString = Function.prototype.toString;
  const nativeFns = new WeakSet();

  function makeNative(fn, name) {
    if (typeof fn !== 'function') return fn;
    nativeFns.add(fn);
    return fn;
  }

  try {
    Function.prototype.toString = function() {
      if (nativeFns.has(this)) {
        const fnName = this.name || '';
        return fnName ? 'function ' + fnName + '() { [native code] }' : 'function () { [native code] }';
      }
      return nativeToString.call(this);
    };
    nativeFns.add(Function.prototype.toString);
  } catch(e) {}

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
    pdfViewerEnabled: nav.pdfViewerEnabled
  })};

  for (const [key, value] of Object.entries(navOverrides)) {
    if (value === undefined) continue;
    try {
      const getter = makeNative(function() { return value; }, 'get ' + key);
      Object.defineProperty(Navigator.prototype, key, {
        get: getter,
        configurable: true,
        enumerable: true
      });
    } catch(e) {
      try {
        const getter = makeNative(function() { return value; }, 'get ' + key);
        Object.defineProperty(navigator, key, {
          get: getter,
          configurable: true,
          enumerable: true
        });
      } catch(e2) {}
    }
  }

  // Override navigator.languages (frozen array)
  const _languages = ${JSON.stringify(nav.languages || ['en-US', 'en'])};
  try {
    const langGetter = makeNative(function() { return Object.freeze([..._languages]); }, 'get languages');
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: langGetter,
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

  // Ensure navigator.webdriver is false
  try {
    const wdGetter = makeNative(function() { return false; }, 'get webdriver');
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: wdGetter,
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

  // ── Standard Desktop Plugins & MimeTypes Emulation ──
  if (!${isMobile ? 'true' : 'false'} && typeof PluginArray !== 'undefined' && typeof MimeTypeArray !== 'undefined') {
    try {
      const pluginDefs = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] }
      ];

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
      Object.defineProperty(pluginsObj, 'item', { value: makeNative(function(i) { return this[i] || null; }, 'item') });
      Object.defineProperty(pluginsObj, 'namedItem', { value: makeNative(function(name) { return this[name] || null; }, 'namedItem') });
      Object.defineProperty(pluginsObj, 'refresh', { value: makeNative(function() {}, 'refresh') });

      Object.defineProperty(mimeTypesObj, 'length', { value: rawMimes.length, enumerable: false });
      Object.defineProperty(mimeTypesObj, 'item', { value: makeNative(function(i) { return this[i] || null; }, 'item') });
      Object.defineProperty(mimeTypesObj, 'namedItem', { value: makeNative(function(name) { return this[name] || null; }, 'namedItem') });

      Object.defineProperty(Navigator.prototype, 'plugins', {
        get: makeNative(function() { return pluginsObj; }, 'get plugins'),
        enumerable: true,
        configurable: true
      });

      Object.defineProperty(Navigator.prototype, 'mimeTypes', {
        get: makeNative(function() { return mimeTypesObj; }, 'get mimeTypes'),
        enumerable: true,
        configurable: true
      });
    } catch(e) {}
  }

  // ── Override User-Agent Client Hints API ──
  if ('userAgentData' in Navigator.prototype || 'userAgentData' in navigator) {
    try {
      const brandVer = ${JSON.stringify(brandVersion)};
      const clientPlat = ${JSON.stringify(clientPlatform)};
      const isMob = ${isMobile ? 'true' : 'false'};

      const brandsList = [
        { brand: 'Chromium', version: brandVer },
        { brand: 'Google Chrome', version: brandVer },
        { brand: 'Not_A Brand', version: '24' }
      ];

      const fullList = [
        { brand: 'Chromium', version: ${JSON.stringify(nav.browserVersion || '131.0.0.0')} },
        { brand: 'Google Chrome', version: ${JSON.stringify(nav.browserVersion || '131.0.0.0')} },
        { brand: 'Not_A Brand', version: '24.0.0.0' }
      ];

      const getHighEntropyValuesFn = makeNative(function(hints) {
        return Promise.resolve({
          brands: brandsList,
          mobile: isMob,
          platform: clientPlat,
          architecture: isMob ? 'arm' : ${JSON.stringify(nav.cpuArchitecture || 'x86')},
          bitness: ${JSON.stringify(nav.platformArchitecture === '64-bit' ? '64' : '32')},
          model: isMob ? (${JSON.stringify(nav.platform)} === 'iPhone' ? 'iPhone' : 'SM-S928B') : '',
          platformVersion: clientPlat === 'Windows' ? '15.0.0' : clientPlat === 'macOS' ? '14.5.0' : '14.0.0',
          uaFullVersion: ${JSON.stringify(nav.browserVersion || '131.0.0.0')},
          fullVersionList: fullList
        });
      }, 'getHighEntropyValues');

      const uaDataObj = {
        brands: brandsList,
        mobile: isMob,
        platform: clientPlat,
        getHighEntropyValues: getHighEntropyValuesFn,
        toJSON: makeNative(function() {
          return {
            brands: brandsList,
            mobile: isMob,
            platform: clientPlat
          };
        }, 'toJSON')
      };

      const uaDataGetter = makeNative(function() { return uaDataObj; }, 'get userAgentData');
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: uaDataGetter,
        configurable: true,
        enumerable: true
      });
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
        getDetails: makeNative(function() { return null; }, 'getDetails'),
        getIsInstalled: makeNative(function() { return false; }, 'getIsInstalled'),
        runningState: makeNative(function() { return 'cannot_run'; }, 'runningState')
      };
    }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: makeNative(function() {}, 'connect'),
        sendMessage: makeNative(function() {}, 'sendMessage')
      };
    }
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = makeNative(function() {
        const perf = window.performance && window.performance.timing;
        const navStart = perf ? perf.navigationStart / 1000 : Date.now() / 1000;
        return {
          commitLoadTime: perf ? perf.responseStart / 1000 : navStart,
          connectionInfo: 'h2',
          finishDocumentLoadTime: perf ? perf.domContentLoadedEventEnd / 1000 : navStart,
          finishLoadTime: perf ? perf.loadEventEnd / 1000 : navStart,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: perf ? perf.responseEnd / 1000 : navStart,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: navStart,
          startLoadTime: navStart,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        };
      }, 'loadTimes');
    }
    if (!window.chrome.csi) {
      window.chrome.csi = makeNative(function() {
        const perf = window.performance && window.performance.timing;
        const navStart = perf ? perf.navigationStart : Date.now();
        const loadEnd = perf ? perf.loadEventEnd : Date.now();
        return {
          startE: navStart,
          onloadT: loadEnd,
          pageT: loadEnd - navStart,
          tran: 15
        };
      }, 'csi');
    }
  } catch(e) {}
})();`
}
