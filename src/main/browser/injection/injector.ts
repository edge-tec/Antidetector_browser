// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Browser Injection Orchestrator
// Builds and injects fingerprint override scripts via CDP
// Page.addScriptToEvaluateOnNewDocument & Emulation domain
// ──────────────────────────────────────────────────────────────────

import { Page, Browser } from 'puppeteer-core'
import { Fingerprint } from '../../fingerprint/types'
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

/**
 * Build the complete injection script from all sub-scripts.
 * This is a single IIFE that runs before any page JavaScript.
 */
export function buildInjectionScript(fingerprint: Fingerprint): string {
  const scripts = [
    buildNavigatorScript(fingerprint.navigator),
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
    buildGeolocationScript(fingerprint.geolocation)
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
 * Inject fingerprint overrides into a single page via CDP.
 */
export async function injectFingerprint(page: Page, fingerprint: Fingerprint): Promise<void> {
  await applyPageEmulation(page, fingerprint)
}

async function applyPageEmulation(page: Page, fingerprint: Fingerprint): Promise<void> {
  const isAndroid = fingerprint.navigator?.userAgent?.includes('Android') || fingerprint.navigator?.appVersion?.includes('Android')
  const script = buildInjectionScript(fingerprint)

  try {
    // This runs the script before any page JS on every navigation
    await page.evaluateOnNewDocument(script)
    logger.info('browser', 'Fingerprint injected into page')
  } catch (err: any) {
    logger.warn('browser', `Failed to inject fingerprint: ${err.message}`)
  }

  try {
    await page.setViewport(null)
  } catch {}

  try {
    const client = await page.target().createCDPSession()

    // Always clear device metrics override so Chromium renders 100% native edge-to-edge
    await client.send('Emulation.clearDeviceMetricsOverride')

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

    if (isAndroid) {
      // 1. Enable CDP Touch Emulation for Android
      await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: fingerprint.navigator?.maxTouchPoints || 5
      })

      // 2. Extract device model for Client Hints (sec-ch-ua-model)
      let model = (fingerprint.navigator as any)?.deviceModelCode || (fingerprint.navigator as any)?.deviceModel || ''
      if (!model) {
        const uaMatch = fingerprint.navigator?.userAgent?.match(/Android[^;]+;\s*([^)]+)\)/i)
        if (uaMatch && uaMatch[1]) {
          model = uaMatch[1].trim()
        } else {
          model = 'SM-S928B'
        }
      }

      // 3. Override HTTP User Agent & Client Hints header via CDP Network Domain
      const brandVersion = fingerprint.navigator?.browserVersion ? fingerprint.navigator.browserVersion.split('.')[0] : '128'
      await client.send('Network.setUserAgentOverride', {
        userAgent: fingerprint.navigator.userAgent,
        acceptLanguage: (fingerprint.locale?.languages || ['en-US']).join(','),
        platform: 'Android',
        userAgentMetadata: {
          brands: [
            { brand: 'Chromium', version: brandVersion },
            { brand: 'Google Chrome', version: brandVersion },
            { brand: 'Not-A.Brand', version: '99' }
          ],
          fullVersion: fingerprint.navigator.browserVersion || '128.0.0.0',
          platform: 'Android',
          platformVersion: '14.0.0',
          architecture: 'arm',
          model: model,
          mobile: true,
          bitness: '64'
        }
      })
    }
  } catch (err: any) {
    logger.warn('browser', `Could not apply CDP page emulation: ${err.message}`)
  }
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
