// ──────────────────────────────────────────────────────────────────
// ProfileVault v2 — Browser Launcher (Puppeteer + Fingerprint Injection)
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import puppeteer, { Browser } from 'puppeteer-core'
import { Profile, Proxy } from '../database/models'
import { Fingerprint, createDefaultFingerprint } from '../fingerprint/types'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { decryptPassword } from '../security/encryption'
import { ensureProfileDataDir } from './chromium-resolver'
import { setupBrowserInjection } from './injection/injector'
import { startProxyBridge } from '../network/proxy-bridge'
import { logger } from '../logging/logger'

export interface LaunchResult {
  browser: Browser
  pid: number
  wsEndpoint: string
}

/**
 * Auto-generate Chromium Bookmarks JSON file inside profile data directory.
 */
function setupProfileBookmarks(userDataDir: string, bookmarks: Array<{ title: string; url: string }>): void {
  if (!Array.isArray(bookmarks) || bookmarks.length === 0) return
  try {
    const defaultDir = path.join(userDataDir, 'Default')
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true })
    }
    const bookmarksPath = path.join(defaultDir, 'Bookmarks')
    const bookmarkNodes = bookmarks.map((b, idx) => ({
      date_added: String(Date.now() * 1000),
      guid: `bm-guid-${idx}-${Date.now()}`,
      id: String(idx + 1),
      name: b.title || b.url,
      type: 'url',
      url: b.url.startsWith('http') ? b.url : `https://${b.url}`
    }))

    const bookmarksJson = {
      checksum: '00000000000000000000000000000000',
      roots: {
        bookmark_bar: {
          children: bookmarkNodes,
          date_added: '13300000000000000',
          date_modified: '13300000000000000',
          id: '1',
          name: 'Bookmarks bar',
          type: 'folder'
        },
        other: { children: [], date_added: '13300000000000000', date_modified: '0', id: '2', name: 'Other bookmarks', type: 'folder' },
        synced: { children: [], date_added: '13300000000000000', date_modified: '0', id: '3', name: 'Mobile bookmarks', type: 'folder' }
      },
      version: 1
    }

    fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarksJson, null, 2), 'utf8')
    logger.info('browser', `Wrote ${bookmarks.length} bookmarks to Chromium profile: ${bookmarksPath}`)
  } catch (err: any) {
    logger.warn('browser', `Failed to write Chromium bookmarks: ${err.message}`)
  }
}

/**
 * Build Chromium launch arguments for a profile.
 */
function buildLaunchArgs(profile: Profile, fingerprint: Fingerprint, proxy: Proxy | null): string[] {
  const lang = fingerprint?.locale?.language || 'en-US'

  const args: string[] = [
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    '--window-position=0,0',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-sync',
    '--disable-features=TranslateUI',
    '--disable-default-apps',
    '--disable-hang-monitor',
    `--lang=${lang}`
  ]

  if (fingerprint?.navigator?.userAgent) {
    args.push(`--user-agent=${fingerprint.navigator.userAgent}`)
  }

  // WebRTC configuration
  if (fingerprint?.webrtc?.mode === 'disabled' || profile.webrtcMode === 'disabled' || (profile.webrtcMode as string) === 'off') {
    args.push('--disable-webrtc')
  } else if (fingerprint?.webrtc?.ipPolicy) {
    args.push(`--force-webrtc-ip-handling-policy=${fingerprint.webrtc.ipPolicy}`)
  } else {
    args.push('--force-webrtc-ip-handling-policy=default_public_interface_only')
  }

  // Hardware acceleration
  if (!profile.hwAcceleration) {
    args.push('--disable-gpu')
    args.push('--disable-software-rasterizer')
  }

  // Google services
  if (fingerprint?.browser && !fingerprint.browser.googleServicesEnabled) {
    args.push('--disable-background-networking')
    args.push('--disable-client-side-phishing-detection')
  }

  // Safe browsing
  if (fingerprint?.browser && !fingerprint.browser.safeBrowsing) {
    args.push('--safebrowsing-disable-auto-update')
  }

  // Custom DNS
  if (fingerprint?.browser?.dnsMode === 'custom' && fingerprint.browser.primaryDns) {
    args.push(`--dns-over-https-templates=${fingerprint.browser.primaryDns}`)
  }

  // Proxy configuration
  if (proxy && proxy.type !== 'direct' && proxy.host) {
    const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`
    args.push(`--proxy-server=${proxyUrl}`)
  }

  // Custom launch args (allowlisted)
  if (fingerprint?.browser?.customLaunchArgs && Array.isArray(fingerprint.browser.customLaunchArgs)) {
    const allowedPrefixes = [
      '--disable-', '--enable-', '--force-', '--window-',
      '--proxy-', '--user-data-dir', '--lang',
      '--no-', '--incognito', '--start-'
    ]
    for (const arg of fingerprint.browser.customLaunchArgs) {
      if (allowedPrefixes.some(p => arg.startsWith(p))) {
        args.push(arg)
      } else {
        logger.warn('browser', `Blocked disallowed launch arg: ${arg}`)
      }
    }
  }

  return args
}

function normalizeFingerprint(raw: any, osType: string): Fingerprint {
  const fallback = createDefaultFingerprint({ osType: (osType as any) || 'windows-10' })
  if (!raw || typeof raw !== 'object') return fallback

  return {
    ...fallback,
    ...raw,
    screen: { ...fallback.screen, ...(raw.screen || {}) },
    navigator: { ...fallback.navigator, ...(raw.navigator || {}) },
    browser: { ...fallback.browser, ...(raw.browser || {}) },
    timezone: { ...fallback.timezone, ...(raw.timezone || {}) },
    geolocation: { ...fallback.geolocation, ...(raw.geolocation || {}) },
    webrtc: { ...fallback.webrtc, ...(raw.webrtc || {}) },
    canvas: { ...fallback.canvas, ...(raw.canvas || {}) },
    webgl: { ...fallback.webgl, ...(raw.webgl || {}) },
    audio: { ...fallback.audio, ...(raw.audio || {}) },
    clientRects: { ...fallback.clientRects, ...(raw.clientRects || {}) },
    fonts: { ...fallback.fonts, ...(raw.fonts || {}) },
    locale: { ...fallback.locale, ...(raw.locale || {}) },
    mediaDevices: { ...fallback.mediaDevices, ...(raw.mediaDevices || {}) }
  }
}

/**
 * Launch a Chromium browser instance with full fingerprint injection.
 */
export async function launchBrowser(
  profile: Profile,
  chromiumPath: string
): Promise<LaunchResult> {
  const userDataDir = ensureProfileDataDir(profile.id)

  // Parse fingerprint from profile or use default
  let fingerprint: Fingerprint
  try {
    const raw = profile.fingerprint
      ? (typeof profile.fingerprint === 'string'
        ? JSON.parse(profile.fingerprint)
        : profile.fingerprint)
      : null
    fingerprint = normalizeFingerprint(raw, profile.osType || 'windows-10')
  } catch {
    fingerprint = createDefaultFingerprint({ osType: (profile.osType as any) || 'windows-10' })
  }

  // Auto-setup Bookmarks in Chromium Profile directory
  if (fingerprint?.browser?.bookmarks && Array.isArray(fingerprint.browser.bookmarks)) {
    setupProfileBookmarks(userDataDir, fingerprint.browser.bookmarks)
  }

  // Resolve proxy
  let proxy: Proxy | null = null
  if (profile.proxyId) {
    const loadedProxy = proxyRepo.getById(profile.proxyId)
    if (loadedProxy && loadedProxy.type !== 'direct' && loadedProxy.host && loadedProxy.port > 0) {
      proxy = loadedProxy
    }
  }

  const effectiveProxy = proxy
  let launchProxy = proxy

  // If SOCKS proxy, start local proxy bridge
  if (launchProxy && launchProxy.type.startsWith('socks')) {
    try {
      const localBridgeUrl = await startProxyBridge(profile.id, launchProxy)
      const localPort = Number(localBridgeUrl.split(':').pop())
      launchProxy = {
        ...launchProxy,
        type: 'http' as any,
        host: '127.0.0.1',
        port: localPort,
        username: null,
        encryptedPassword: null
      }
    } catch (err: any) {
      logger.error('browser', `Could not start SOCKS proxy bridge for profile "${profile.name}": ${err.message}`)
      throw new Error(`Proxy failed to initialize: ${err.message}`)
    }
  }

  const args = buildLaunchArgs(profile, fingerprint, launchProxy)

  // Determine start URLs
  let startUrls: string[] = []
  if (profile.startUrl) {
    startUrls.push(profile.startUrl)
  }
  if (fingerprint?.browser?.startUrls && Array.isArray(fingerprint.browser.startUrls)) {
    for (const url of fingerprint.browser.startUrls) {
      if (url && !startUrls.includes(url)) startUrls.push(url)
    }
  }

  logger.info('browser', `Launching browser for profile "${profile.name}"`, JSON.stringify({
    profileId: profile.id,
    osType: profile.osType || 'windows-10',
    userDataDir,
    argCount: args.length,
    hasProxy: !!proxy,
    hasFingerprint: !!profile.fingerprint
  }))

  try {
    const browser = await puppeteer.launch({
      executablePath: chromiumPath,
      userDataDir,
      headless: false,
      defaultViewport: null,
      args,
      ignoreDefaultArgs: ['--enable-automation'],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    })

    const wsEndpoint = browser.wsEndpoint()
    const process = browser.process()
    const pid = process?.pid || 0

    // Inject full fingerprint via CDP
    await setupBrowserInjection(browser, fingerprint)

    // Maximize Chromium window & WebContents view via CDP
    try {
      const pages = await browser.pages()
      if (pages.length > 0) {
        const client = await pages[0].target().createCDPSession()
        const { windowId } = await client.send('Browser.getWindowForTarget')
        await client.send('Browser.setWindowBounds', {
          windowId,
          bounds: { windowState: 'maximized' }
        })
      }
    } catch (err: any) {
      logger.warn('browser', `Could not maximize CDP window: ${err.message}`)
    }

    // Set timezone via CDP
    const tz = fingerprint?.timezone?.timezone
    if (tz) {
      try {
        const pages = await browser.pages()
        for (const page of pages) {
          await page.emulateTimezone(tz)
        }
        browser.on('targetcreated', async (target) => {
          try {
            const page = await target.page()
            if (page && tz) {
              await page.emulateTimezone(tz)
            }
          } catch { /* Ignore */ }
        })
      } catch (err) {
        logger.warn('browser', `Could not set timezone: ${err}`)
      }
    }

    // Handle proxy authentication for HTTP/HTTPS proxies
    if (effectiveProxy && effectiveProxy.username && (effectiveProxy.type === 'http' || effectiveProxy.type === 'https')) {
      try {
        let password = ''
        if ((effectiveProxy as any).password) {
          password = (effectiveProxy as any).password
        } else if (effectiveProxy.encryptedPassword) {
          try {
            password = decryptPassword(effectiveProxy.encryptedPassword)
          } catch {
            if (typeof effectiveProxy.encryptedPassword === 'string') {
              password = effectiveProxy.encryptedPassword
            } else if (Buffer.isBuffer(effectiveProxy.encryptedPassword)) {
              password = effectiveProxy.encryptedPassword.toString('utf8')
            }
          }
        }
        const auth = { username: effectiveProxy.username, password }
        const pages = await browser.pages()
        for (const page of pages) {
          try {
            await page.authenticate(auth)
          } catch { /* Ignore */ }
        }
        browser.on('targetcreated', async (target) => {
          try {
            const page = await target.page()
            if (page) {
              await page.authenticate(auth)
            }
          } catch { /* Ignore */ }
        })
      } catch (err) {
        logger.warn('browser', `Proxy authentication error: ${err}`)
      }
    }

    // Navigate to start URLs
    if (startUrls.length > 0) {
      try {
        const pages = await browser.pages()
        if (pages[0] && startUrls[0]) {
          await pages[0].goto(startUrls[0], { waitUntil: 'domcontentloaded' })
        }
        for (let i = 1; i < startUrls.length; i++) {
          const newPage = await browser.newPage()
          await newPage.goto(startUrls[i], { waitUntil: 'domcontentloaded' })
        }
      } catch (err) {
        logger.warn('browser', `Could not navigate to start URLs: ${err}`)
      }
    }

    logger.info('browser', `Browser launched for "${profile.name}" (PID: ${pid}) with fingerprint injection`)
    return { browser, pid, wsEndpoint }
  } catch (err: any) {
    logger.error('browser', `Failed to launch browser for "${profile.name}": ${err.message}`)
    throw new Error(`Browser failed to launch: ${err.message}`)
  }
}
