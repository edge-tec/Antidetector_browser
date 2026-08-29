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
import { setupGoogleRedirectInterceptor } from './google-redirect-interceptor'

/**
 * Build the complete injection script from all sub-scripts.
 * This is a single IIFE that runs before any page JavaScript.
 */
export function buildInjectionScript(fingerprint: Fingerprint, browserType?: 'chrome' | 'firefox'): string {
  const bType = browserType || fingerprint.browser?.type || (fingerprint.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
  const scripts = [
    buildNavigatorScript(fingerprint.navigator, bType),
    buildScreenScript(fingerprint.screen),
    buildWebGLScript(fingerprint.webgl),
    buildCanvasScript(fingerprint.canvas),
    buildAudioScript(fingerprint.audio),
    buildClientRectsScript(fingerprint.clientRects),
    buildMediaDevicesScript(fingerprint.mediaDevices),
    buildBatteryScript(fingerprint.battery),
    buildNetworkInfoScript(fingerprint.networkInfo),
    buildPermissionsScript(fingerprint.permissions),
    buildFontsScript(fingerprint.fonts),
    buildGeolocationScript(fingerprint.geolocation),
    buildTimezoneScript(fingerprint.timezone),
    buildWebRTCScript(fingerprint.webrtc),
    buildGoogleRedirectBypassScript()
  ]

  // Wrap all scripts in a single IIFE with error isolation
  return `(function() {
  'use strict';
  try {
    ${scripts.join('\n\n    ')}
  } catch(e) {
    // Silent failure — don't let injection errors break the page
  }
})();`
}

/**
 * Build Client Hints userAgentMetadata aligned with OS platform and browser version.
 */
export function buildUserAgentMetadata(fingerprint: Fingerprint): any {
  const nav = fingerprint.navigator || ({} as any)
  const fullVersion = nav.browserVersion || '131.0.0.0'
  const brandVersion = fullVersion.split('.')[0] || '131'
  const osType = (fingerprint as any).osType || ''
  const platformStr = nav.platform || ''
  const ua = nav.userAgent || ''

  const isAndroid = ua.includes('Android') || platformStr.includes('Android') || osType === 'android'
  const isIOS = ua.includes('iPhone') || ua.includes('iPad') || platformStr === 'iPhone' || osType === 'ios'
  const isMac = !isAndroid && !isIOS && (platformStr.includes('Mac') || ua.includes('Macintosh') || osType.includes('macos'))
  const isLinux = !isAndroid && !isIOS && !isMac && (platformStr.includes('Linux') || ua.includes('Linux') || osType === 'linux')

  let platform = 'Windows'
  let platformVersion = '15.0.0'
  let architecture = 'x86'
  let bitness = '64'
  let model = ''
  let mobile = false

  if (isAndroid) {
    platform = 'Android'
    platformVersion = '14.0.0'
    architecture = 'arm'
    bitness = '64'
    mobile = true
    const uaMatch = ua.match(/Android[^;]+;\s*([^)]+)\)/i)
    model = (nav as any).deviceModelCode || (nav as any).deviceModel || (uaMatch && uaMatch[1] ? uaMatch[1].trim() : 'SM-S928B')
  } else if (isIOS) {
    platform = 'iOS'
    platformVersion = '18.0.0'
    architecture = 'arm'
    bitness = '64'
    mobile = true
    model = 'iPhone'
  } else if (isMac) {
    platform = 'macOS'
    platformVersion = '14.5.0'
    architecture = osType === 'macos-arm' || nav.cpuArchitecture === 'arm64' ? 'arm' : 'x86'
    bitness = '64'
    model = ''
    mobile = false
  } else if (isLinux) {
    platform = 'Linux'
    platformVersion = '6.5.0'
    architecture = 'x86'
    bitness = '64'
    model = ''
    mobile = false
  } else {
    // Windows
    platform = 'Windows'
    platformVersion = osType === 'windows-11' ? '15.0.0' : '10.0.0'
    architecture = 'x86'
    bitness = '64'
    model = ''
    mobile = false
  }

  // v3: Use browser-compat-matrix for correct Not-A-Brand version
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
    platform,
    platformVersion,
    architecture,
    model,
    mobile,
    bitness
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
    // Run script before any page JS on every frame/navigation
    await page.evaluateOnNewDocument(script)
  } catch (err: any) {
    logger.warn('browser', `Failed to evaluateOnNewDocument: ${err.message}`)
  }

  try {
    await page.setViewport(null)
  } catch {}

  // Setup Google redirect interception (CDP Fetch layer)
  try {
    await setupGoogleRedirectInterceptor(page)
  } catch (err: any) {
    logger.warn('browser', `Could not setup Google redirect interceptor: ${err.message}`)
  }

  try {
    const client = await page.target().createCDPSession()

    // Remove Puppeteer/ChromeDriver CDP markers that Google uses for bot detection
    try {
      await client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          // Remove cdc_ properties from document that Puppeteer/ChromeDriver inject
          try {
            Object.defineProperty(document, '$cdc_asdjflasutopfhvcZLmcfl_', { get: () => undefined, configurable: true });
            for (const prop of Object.getOwnPropertyNames(document)) {
              if (/^\\$cdc_/.test(prop)) {
                try { delete document[prop]; } catch(e) {}
              }
            }
          } catch(e) {}
          // Ensure navigator.webdriver is false
          try {
            Object.defineProperty(Navigator.prototype, 'webdriver', {
              get: () => false, configurable: true, enumerable: true
            });
          } catch(e) {}
        `
      })
    } catch {}

    // ── Fluid Responsive Viewport & Touch Configuration ──
    // Always clear fixed device metrics overrides so the browsing area fluidly fills 100% of the window
    // without letterboxing or black void offsets. Screen properties (screen.width/height, DPR, orientation)
    // are faithfully spoofed via JavaScript prototype descriptors in scripts/screen.ts.
    await client.send('Emulation.clearDeviceMetricsOverride')

    if (isAndroid || isIOS) {
      await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: fingerprint.navigator?.maxTouchPoints || 5
      })
      try {
        await client.send('Emulation.setEmitTouchEventsForMouse', {
          enabled: true,
          configuration: 'mobile'
        })
      } catch {}
    } else {
      await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: false,
        maxTouchPoints: 0
      })
      try {
        await client.send('Emulation.setEmitTouchEventsForMouse', {
          enabled: false
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

    // ── Universal User-Agent & Client Hints Override for ALL Platforms ──
    const osType: OSType = (fingerprint as any).osType || (fingerprint.navigator as any)?.osType || (isAndroid ? 'android' : isIOS ? 'ios' : 'windows-10')
    const browserType: 'chrome' | 'firefox' = isFirefox ? 'firefox' : 'chrome'
    const engine = getEngineForBrowser(osType, browserType)
    const shouldSendClientHints = engine === 'blink' && hasFeatureFlag(osType, browserType, 'client-hints')

    const userAgentMetadata = buildUserAgentMetadata(fingerprint)
    const acceptLanguage = (fingerprint.locale?.languages || ['en-US', 'en']).join(',')
    const uaString = fingerprint.navigator?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

    // Also inject the complete anti-detect script directly into CDP Page domain for instant execution
    try {
      await client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: script
      })
    } catch {}

    // Override at both Network and Emulation CDP domains
    await client.send('Network.setUserAgentOverride', {
      userAgent: uaString,
      acceptLanguage,
      platform: userAgentMetadata.platform,
      userAgentMetadata: shouldSendClientHints ? userAgentMetadata : undefined
    })

    try {
      await client.send('Emulation.setUserAgentOverride', {
        userAgent: uaString,
        acceptLanguage,
        platform: userAgentMetadata.platform,
        userAgentMetadata: shouldSendClientHints ? userAgentMetadata : undefined
      })
    } catch {}
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
