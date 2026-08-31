// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Browser Injection Orchestrator
// Builds and injects fingerprint override scripts via CDP
// Page.addScriptToEvaluateOnNewDocument & Emulation domain
// Integrated with v3 browser-compat-matrix for accurate Client Hints
// ──────────────────────────────────────────────────────────────────

import { Page, Browser } from 'puppeteer-core'
import { Fingerprint, OSType } from '../../fingerprint/types'
import { getNotABrandVersion, getEngineForBrowser, hasFeatureFlag } from '../../fingerprint/browser-compat-matrix'
import { logger } from '../../logging/logger'

// Import injection script builders
import { buildNativeCloakerScript } from './scripts/native-cloaker'
import { buildNavigatorScript } from './scripts/navigator'
import { buildScreenScript } from './scripts/screen'
import { buildWebGLScript } from './scripts/webgl'
import { buildCanvasScript } from './scripts/canvas'
import { buildAudioScript } from './scripts/audio'
import { buildClientRectsScript } from './scripts/client-rects'
import { buildMediaDevicesScript } from './scripts/media-devices'
import { buildBatteryScript } from './scripts/battery'
import { buildNetworkInfoScript } from './scripts/network-info'
import { buildPermissionsScript } from './scripts/permissions'
import { buildFontsScript } from './scripts/fonts'
import { buildGeolocationScript } from './scripts/geolocation'
import { buildTimezoneScript } from './scripts/timezone'
import { buildWebRTCScript } from './scripts/webrtc'
import { buildGoogleRedirectBypassScript } from './scripts/google-redirect-bypass'
import { buildGoogleAuthNoticeScript } from './scripts/google-auth-notice'
import { setupGoogleRedirectInterceptor } from './google-redirect-interceptor'

/**
 * Build the complete injection script from all sub-scripts.
 * This is a single IIFE that runs before any page JavaScript.
 */
export function buildInjectionScript(fingerprint: Fingerprint, browserType?: 'chrome' | 'firefox'): string {
  const bType = browserType || fingerprint.browser?.type || (fingerprint.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
  const isMobile = !!fingerprint.navigator?.touchSupport || (fingerprint.navigator?.platform && fingerprint.navigator.platform.includes('arm')) || (fingerprint.navigator?.platform && fingerprint.navigator.platform.includes('Android')) || (fingerprint.navigator?.userAgent && fingerprint.navigator.userAgent.includes('Android'))
  
  // 1. Core environment integrity scripts — ALWAYS run on 100% of domains (including x.com, twitter.com, google.com)
  const coreScripts = [
    buildNativeCloakerScript(),
    buildNavigatorScript(fingerprint.navigator, bType),
    buildScreenScript(fingerprint.screen),
    buildWebGLScript(fingerprint.webgl),
    buildFontsScript(fingerprint.fonts),
    buildGeolocationScript(fingerprint.geolocation),
    buildTimezoneScript(fingerprint.timezone),
    buildWebRTCScript(fingerprint.webrtc),
    buildNetworkInfoScript(fingerprint.networkInfo),
    buildPermissionsScript(fingerprint.permissions),
    buildClientRectsScript(fingerprint.clientRects),
    buildGoogleRedirectBypassScript()
  ]

  // 2. Peripheral/noise scripts — safely executed
  const noiseScripts = [
    buildCanvasScript(fingerprint.canvas),
    buildAudioScript(fingerprint.audio),
    buildMediaDevicesScript(fingerprint.mediaDevices),
    buildBatteryScript(fingerprint.battery)
  ]

  // Wrap all scripts in a single IIFE with Safe Domain Policy & error isolation
  return `(function() {
  'use strict';
  try {
    // ── Universal Automation Shield (Orbita / GoLogin Rule) ──
    // Eliminates navigator.webdriver across ALL domains (including Google Accounts & Gmail)
    // to strictly comply with Google Rule #3: "Controlled through software automation".
    try {
      var proto = Object.getPrototypeOf(navigator) || Navigator.prototype;
      delete proto.webdriver;
      Object.defineProperty(proto, 'webdriver', {
        get: function() { return false; },
        set: undefined,
        enumerable: true,
        configurable: true
      });
      if ('webdriver' in navigator) {
        try {
          Object.defineProperty(navigator, 'webdriver', {
            get: function() { return false; },
            configurable: true
          });
        } catch(e) {}
      }
    } catch(e) {}

    // Ensure desktop window.chrome standard runtime is present
    try {
      if (typeof window !== 'undefined' && !window.chrome) {
        window.chrome = {
          ...(!${isMobile ? 'true' : 'false'} ? {
            app: {
              isInstalled: false,
              InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
              RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
            }
          } : {}),
          runtime: {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
          }
        };
      }
    } catch(e) {}

    // ── 1. Execute Core Environment Overrides (Navigator, Screen, Timezone, Client Hints, WebRTC) ──
    // Crucial: Must execute across ALL domains so navigator.platform, userAgentData, and HTTP headers match 100%.
    ${coreScripts.join('\n\n    ')}

    // ── Safe Domain Policy (Orbita / GoLogin Standard) ──
    // Core environment consistency is maintained across all origins (including Google, X, Facebook, LinkedIn, GitHub).
    // Peripheral noise modifications (Canvas, Audio, MediaDevices, Battery) are selectively bypassed on BotGuard/Auth challenge pages
    // so hardware cryptographic attestation challenges pass natively with genuine device metrics.
    function isProtectedAuthDomain() {
      try {
        var loc = (typeof window !== 'undefined' ? window.location : null) || {};
        var rawHost = (loc.hostname || loc.host || '').toLowerCase();
        var host = rawHost.split(':')[0];
        var isTrustedAuthHost = (
          host === 'x.com' || host.endsWith('.x.com') ||
          host === 'twitter.com' || host.endsWith('.twitter.com') ||
          host === 'google.com' || host.endsWith('.google.com') ||
          host === 'facebook.com' || host.endsWith('.facebook.com') ||
          host === 'instagram.com' || host.endsWith('.instagram.com') ||
          host === 'linkedin.com' || host.endsWith('.linkedin.com') ||
          host === 'github.com' || host.endsWith('.github.com') ||
          host === 'apple.com' || host.endsWith('.apple.com')
        );

        if (!isTrustedAuthHost) {
          return false;
        }

        var path = (loc.pathname || '').toLowerCase();
        var href = (loc.href || '').toLowerCase();

        return (
          host === 'accounts.google.com' ||
          host === 'myaccount.google.com' ||
          host === 'oauth2.googleapis.com' ||
          host === 'mail.google.com' ||
          path.indexOf('/challenge') !== -1 ||
          path.indexOf('/signin') !== -1 ||
          path.indexOf('/servicelogin') !== -1 ||
          path.indexOf('/i/flow/login') !== -1 ||
          path.indexOf('/i/flow/') !== -1 ||
          href.indexOf('/v3/signin') !== -1 ||
          href.indexOf('/identifier') !== -1
        );
      } catch(e) {
        return false;
      }
    }

    if (!isProtectedAuthDomain()) {
      ${noiseScripts.join('\n\n      ')}
    }
  } catch(e) {
    // Silent failure — don't let injection errors break the page
  }
})();`
}

import { DeviceConsistencyValidator } from '../device/device-consistency'

/**
 * Build Client Hints userAgentMetadata aligned with OS platform and browser version.
 * Derived directly from the centralized DeviceConsistencyValidator.
 */
export function buildUserAgentMetadata(fingerprint: Fingerprint): any {
  const nav = fingerprint.navigator || ({} as any)
  const fullVersion = nav.browserVersion || '131.0.0.0'
  const brandVersion = fullVersion.split('.')[0] || '131'
  const osType = (fingerprint as any).osType || ''

  const resolved = DeviceConsistencyValidator.resolvePlatformProfile({
    osType,
    userAgent: nav.userAgent,
    platform: nav.platform,
    browserVersion: fullVersion,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    touchSupport: nav.touchSupport,
    maxTouchPoints: nav.maxTouchPoints,
    deviceModel: (nav as any).deviceModelCode || (nav as any).deviceModel
  })

  const notABrandVer = getNotABrandVersion(fullVersion)

  return {
    brands: [
      { brand: 'Chromium', version: brandVersion },
      { brand: 'Google Chrome', version: brandVersion },
      { brand: 'Not_A Brand', version: notABrandVer }
    ],
    fullVersionList: [
      { brand: 'Chromium', version: fullVersion },
      { brand: 'Google Chrome', version: fullVersion },
      { brand: 'Not_A Brand', version: `${notABrandVer}.0.0.0` }
    ],
    fullVersion,
    platform: resolved.clientHintsPlatform,
    platformVersion: resolved.clientHintsPlatformVersion,
    architecture: resolved.architecture === 'arm64' ? 'arm' : 'x86',
    model: resolved.model,
    mobile: resolved.mobile,
    bitness: resolved.bitness
  }
}

/**
 * Inject fingerprint overrides into a single page via CDP.
 */
export async function injectFingerprint(page: Page, fingerprint: Fingerprint): Promise<void> {
  await applyPageEmulation(page, fingerprint)
}

async function applyPageEmulation(page: Page, fingerprint: Fingerprint): Promise<void> {
  const isAndroid = fingerprint.navigator?.userAgent?.includes('Android') || fingerprint.navigator?.appVersion?.includes('Android')
  const isIOS = fingerprint.navigator?.userAgent?.includes('iPhone') || fingerprint.navigator?.userAgent?.includes('iPad') || fingerprint.navigator?.platform === 'iPhone'
  const isFirefox = fingerprint.browser?.type === 'firefox' || fingerprint.navigator?.userAgent?.includes('Firefox')

  const script = buildInjectionScript(fingerprint, isFirefox ? 'firefox' : 'chrome')

  try {
    // Single consolidated evaluation on every new document/frame
    await page.evaluateOnNewDocument(script)
  } catch (err: any) {
    logger.warn('browser', `Failed to evaluateOnNewDocument: ${err.message}`)
  }

  try {
    await page.setViewport(null)
  } catch {}

  // Setup Google redirect interception (CDP Fetch layer) - skip on accounts/auth pages
  try {
    const currentUrl = page.url() || ''
    if (!currentUrl.includes('accounts.google.') && !currentUrl.includes('mail.google.') && !currentUrl.includes('/signin') && !currentUrl.includes('/oauth')) {
      await setupGoogleRedirectInterceptor(page)
    }
  } catch (err: any) {
    logger.warn('browser', `Could not setup Google redirect interceptor: ${err.message}`)
  }

  try {
    const client = await page.target().createCDPSession()

    // ── Fluid Responsive Viewport Configuration ──
    // Always clear fixed device metrics overrides so the browsing area fluidly fills 100% of the window
    await client.send('Emulation.clearDeviceMetricsOverride')

    if (isAndroid || isIOS) {
      try {
        await client.send('Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: fingerprint.navigator?.maxTouchPoints || 5
        })
        await client.send('Emulation.setEmitTouchEventsForMouse', {
          enabled: true,
          configuration: 'mobile'
        })
      } catch {}
    }

    // Geolocation CDP Override
    if (fingerprint.geolocation && (fingerprint.geolocation.mode === 'custom' || fingerprint.geolocation.mode === 'ip-based')) {
      try {
        await client.send('Emulation.setGeolocationOverride', {
          latitude: fingerprint.geolocation.latitude || 40.7128,
          longitude: fingerprint.geolocation.longitude || -74.006,
          accuracy: fingerprint.geolocation.accuracy || 50
        })
      } catch (err: any) {
        logger.warn('browser', `Could not set CDP Geolocation override: ${err.message}`)
      }
    }

    // Timezone CDP Override (Native V8 ICU / Date / Intl level)
    if (fingerprint.timezone?.timezone) {
      try {
        await client.send('Emulation.setTimezoneOverride', {
          timezoneId: fingerprint.timezone.timezone
        })
      } catch (err: any) {
        logger.warn('browser', `Could not set CDP Timezone override: ${err.message}`)
      }
    }

    // ── Universal User-Agent & Client Hints Override ──
    const osType: OSType = (fingerprint as any).osType || (fingerprint.navigator as any)?.osType || (isAndroid ? 'android' : isIOS ? 'ios' : 'windows-10')
    const browserType: 'chrome' | 'firefox' = isFirefox ? 'firefox' : 'chrome'
    const engine = getEngineForBrowser(osType, browserType)
    const shouldSendClientHints = engine === 'blink' && hasFeatureFlag(osType, browserType, 'client-hints')

    const userAgentMetadata = buildUserAgentMetadata(fingerprint)
    const acceptLanguage = (fingerprint.locale?.languages || ['en-US', 'en']).join(',')
    const uaString = fingerprint.navigator?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

    // Override at Network CDP domain cleanly
    await client.send('Network.setUserAgentOverride', {
      userAgent: uaString,
      acceptLanguage,
      platform: userAgentMetadata.platform,
      userAgentMetadata: shouldSendClientHints ? userAgentMetadata : undefined
    })
  } catch (err: any) {
    logger.warn('browser', `Could not apply CDP page emulation: ${err.message}`)
  }

  // ── Passive Verification Page Diagnostic Recording ──
  try {
    page.on('response', (response) => {
      try {
        const url = response.url()
        const status = response.status()
        if (
          url.includes('google.com/sorry/') ||
          url.includes('challenges.cloudflare.com') ||
          url.includes('geo.captcha-delivery.com') ||
          url.includes('arkoselabs.com') ||
          url.includes('recaptcha/enterprise')
        ) {
          logger.info('diagnostics', `[AuthNetworkDiagnostic] Status: ${status} on URL: ${url.split('?')[0].slice(0, 100)}`, {
            status,
            endpoint: url.split('?')[0],
            platform: fingerprint.navigator?.platform,
            locale: fingerprint.locale?.language,
            timezone: fingerprint.timezone?.timezone
          })
        }
      } catch {}
    })
  } catch {}
}

/**
 * Set up fingerprint injection for all current and future pages in a browser.
 */
export async function setupBrowserInjection(browser: Browser, fingerprint: Fingerprint): Promise<void> {
  // Inject into all existing pages
  try {
    const pages = await browser.pages()
    for (const page of pages) {
      await applyPageEmulation(page, fingerprint)
    }
  } catch (err: any) {
    logger.warn('browser', `Could not inject into existing pages: ${err.message}`)
  }

  // Inject into all future pages/tabs
  browser.on('targetcreated', async (target) => {
    try {
      const page = await target.page()
      if (page) {
        await applyPageEmulation(page, fingerprint)
      }
    } catch {
      // Ignore errors for non-page targets (service workers, etc.)
    }
  })

  logger.info('browser', 'Browser injection setup complete')
}
