// ──────────────────────────────────────────────────────────────────
// AntiProfiles v2 — Browser Launcher (Puppeteer + Fingerprint Injection)
// ──────────────────────────────────────────────────────────────────

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import puppeteer, { Browser } from 'puppeteer-core'
import { Profile, Proxy } from '../database/models'
import { Fingerprint, createDefaultFingerprint } from '../fingerprint/types'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { decryptPassword } from '../security/encryption'
import { ensureProfileDataDir, ensureFirefoxProfileDataDir } from './chromium-resolver'
import { setupBrowserInjection } from './injection/injector'
import { startProxyBridge } from '../network/proxy-bridge'
import { logger } from '../logging/logger'

export interface LaunchResult {
  browser: Browser | any
  pid: number
  wsEndpoint: string
}

/**
 * Generate Firefox profile preferences (user.js) for anti-detect fingerprint isolation.
 */
function setupFirefoxProfilePrefs(
  userDataDir: string,
  profile: Profile,
  fingerprint: Fingerprint,
  proxy: Proxy | null
): void {
  const resolvedDir = path.resolve(userDataDir)
  try {
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true, mode: 0o700 })
    }
    fs.accessSync(resolvedDir, fs.constants.R_OK | fs.constants.W_OK)
  } catch (dirErr: any) {
    logger.warn('browser', `[FirefoxProfile] Repairing inaccessible profile directory: ${resolvedDir}`)
    try {
      fs.mkdirSync(resolvedDir, { recursive: true, mode: 0o700 })
    } catch {}
  }

  // Unconditionally remove all stale lock files and broken Unix symlinks
  const lockFiles = ['.parentlock', 'parent.lock', 'lock', '.parentlock.link', 'parent.lock.link', 'lock.link']
  for (const file of lockFiles) {
    const lockPath = path.join(resolvedDir, file)
    try {
      fs.rmSync(lockPath, { force: true, recursive: true })
      try {
        fs.unlinkSync(lockPath)
      } catch {}
      logger.info('browser', `[FirefoxProfile] Cleaned lock file/symlink: ${lockPath}`)
    } catch (err: any) {
      // Ignore if already gone
    }
  }

  const cacheDir = path.join(resolvedDir, 'startupCache')
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  } catch {}

  // Ensure times.json exists for valid profile initialization
  const timesJsonPath = path.join(resolvedDir, 'times.json')
  if (!fs.existsSync(timesJsonPath)) {
    try {
      fs.writeFileSync(timesJsonPath, JSON.stringify({ created: Date.now(), firstUse: Date.now() }, null, 2), 'utf8')
    } catch {}
  }

  const prefs: string[] = [
    '// AntiProfiles Generated Firefox Preferences',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("browser.startup.page", 1);',
    'user_pref("browser.tabs.warnOnClose", false);',
    'user_pref("datareporting.healthreport.uploadEnabled", false);',
    'user_pref("toolkit.telemetry.enabled", false);',
    'user_pref("app.normandy.enabled", false);',
    'user_pref("app.shield.optoutstudies.enabled", true);',
    'user_pref("browser.discovery.enabled", false);',
    'user_pref("extensions.pocket.enabled", false);',
    'user_pref("privacy.resistFingerprinting", false);',
    'user_pref("toolkit.startup.max_resumed_crashes", -1);'
  ]

  // User-Agent & Platform Overrides
  if (fingerprint?.navigator?.userAgent) {
    prefs.push(`user_pref("general.useragent.override", ${JSON.stringify(fingerprint.navigator.userAgent)});`)
  }
  if (fingerprint?.navigator?.appVersion) {
    prefs.push(`user_pref("general.appversion.override", ${JSON.stringify(fingerprint.navigator.appVersion)});`)
  }
  if (fingerprint?.navigator?.platform) {
    prefs.push(`user_pref("general.platform.override", ${JSON.stringify(fingerprint.navigator.platform)});`)
    prefs.push(`user_pref("general.oscpu.override", ${JSON.stringify(fingerprint.navigator.platform)});`)
  }

  // Languages
  const langList = fingerprint?.locale?.languages?.join(',') || fingerprint?.locale?.language || 'en-US,en'
  prefs.push(`user_pref("intl.accept_languages", ${JSON.stringify(langList)});`)
  prefs.push(`user_pref("general.useragent.locale", ${JSON.stringify(fingerprint?.locale?.language || 'en-US')});`)

  // WebRTC
  if (fingerprint?.webrtc?.mode === 'disabled' || profile.webrtcMode === 'disabled' || (profile.webrtcMode as string) === 'off') {
    prefs.push('user_pref("media.peerconnection.enabled", false);')
  } else {
    prefs.push('user_pref("media.peerconnection.enabled", true);')
    if (fingerprint?.webrtc?.ipPolicy === 'disable_non_proxied_udp') {
      prefs.push('user_pref("media.peerconnection.ice.proxy_only", true);')
    }
  }

  // Keep Firefox UI & font scaling at normal 100% responsive default
  prefs.push('user_pref("layout.css.devPixelsPerPx", "-1.0");')
  prefs.push('user_pref("browser.uidensity", 0);')
  prefs.push('user_pref("font.size.systemFontScale", 100);')
  prefs.push('user_pref("browser.window.width", 1280);')
  prefs.push('user_pref("browser.window.height", 800);')
  prefs.push('user_pref("browser.newtabpage.activity-stream.topSitesRows", 1);')
  prefs.push('user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);')

  // Hardware Acceleration
  if (profile.hwAcceleration === false) {
    prefs.push('user_pref("layers.acceleration.disabled", true);')
    prefs.push('user_pref("gfx.direct2d.disabled", true);')
  }

  // Proxy Configuration
  if (proxy && proxy.type !== 'direct' && proxy.host) {
    prefs.push('user_pref("network.proxy.type", 1);')
    if (proxy.type.startsWith('socks')) {
      prefs.push(`user_pref("network.proxy.socks", ${JSON.stringify(proxy.host)});`)
      prefs.push(`user_pref("network.proxy.socks_port", ${proxy.port});`)
      prefs.push(`user_pref("network.proxy.socks_version", ${proxy.type === 'socks4' ? 4 : 5});`)
      prefs.push('user_pref("network.proxy.socks_remote_dns", true);')
    } else {
      prefs.push(`user_pref("network.proxy.http", ${JSON.stringify(proxy.host)});`)
      prefs.push(`user_pref("network.proxy.http_port", ${proxy.port});`)
      prefs.push(`user_pref("network.proxy.ssl", ${JSON.stringify(proxy.host)});`)
      prefs.push(`user_pref("network.proxy.ssl_port", ${proxy.port});`)
    }
  }

  const userJsPath = path.join(resolvedDir, 'user.js')
  const prefsJsPath = path.join(resolvedDir, 'prefs.js')
  const content = prefs.join('\n') + '\n'
  fs.writeFileSync(userJsPath, content, 'utf8')
  if (!fs.existsSync(prefsJsPath)) {
    fs.writeFileSync(prefsJsPath, content, 'utf8')
  }

  // Pre-seed xulstore.json to ensure Firefox opens in a normal, compact centered window
  const xulstorePath = path.join(resolvedDir, 'xulstore.json')
  const xulstoreConfig = {
    'chrome://browser/content/browser.xhtml': {
      'main-window': {
        width: '1280',
        height: '800',
        sizemode: 'normal',
        screenX: '100',
        screenY: '60'
      }
    }
  }
  try {
    fs.writeFileSync(xulstorePath, JSON.stringify(xulstoreConfig, null, 2), 'utf8')
  } catch {}

  logger.info('browser', `[FirefoxProfile] Wrote Firefox profile configuration to: ${userJsPath}`)
}

/**
 * Launch Mozilla Firefox with isolated profile & parameters.
 */
export async function launchFirefox(
  profile: Profile,
  firefoxPath: string,
  fingerprint: Fingerprint,
  launchProxy: Proxy | null,
  startUrls: string[]
): Promise<LaunchResult> {
  const userDataDir = path.resolve(ensureFirefoxProfileDataDir(profile.id))
  setupFirefoxProfilePrefs(userDataDir, profile, fingerprint, launchProxy)

  // Use standard -no-remote, -profile, and compact window dimensions
  const args: string[] = [
    '-no-remote',
    '-profile',
    userDataDir,
    '-width',
    '1280',
    '-height',
    '800'
  ]

  if (startUrls.length > 0) {
    args.push(...startUrls)
  }

  logger.info('browser', `[FirefoxLaunch] Launching Firefox for profile "${profile.name}" (${profile.id}) with -profile ${userDataDir} at: ${firefoxPath}`)

  let child: ChildProcess
  let pid = 0

  if (process.platform === 'darwin' && firefoxPath.includes('.app')) {
    const appPath = firefoxPath.substring(0, firefoxPath.indexOf('.app') + 4)
    const openArgs = ['-n', '-a', appPath, '--args', '-no-remote', '-profile', userDataDir, '-width', '1280', '-height', '800']
    if (startUrls.length > 0) {
      openArgs.push(...startUrls)
    }

    logger.info('browser', `[FirefoxLaunch] Spawning macOS GUI instance via open: ${openArgs.join(' ')}`)
    child = spawn('open', openArgs, {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        MOZ_NO_REMOTE: '1'
      }
    })
    child.unref()
    pid = child.pid || 0
  } else {
    child = spawn(firefoxPath, args, {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        MOZ_NO_REMOTE: '1'
      }
    })
    child.unref()
    pid = child.pid || 0
  }

  const mockBrowser: any = {
    connected: true,
    process: () => child,
    wsEndpoint: () => '',
    pages: async () => [],
    close: async () => {
      try {
        if (child.pid) process.kill(child.pid, 'SIGTERM')
      } catch {}
    },
    on: (event: string, cb: any) => {
      if (event === 'disconnected') {
        child.on('exit', cb)
      }
    }
  }

  logger.info('browser', `[FirefoxLaunch] Firefox launched directly for "${profile.name}" (PID: ${pid})`)
  return { browser: mockBrowser, pid, wsEndpoint: '' }
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
  let lang = fingerprint?.locale?.language || 'en-US'
  if (fingerprint?.locale?.displayLanguageMode === 'real') {
    try {
      lang = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
    } catch {}
  } else if (fingerprint?.locale?.displayLanguageMode === 'custom' && fingerprint?.locale?.displayLanguage) {
    lang = fingerprint.locale.displayLanguage
  }

  const args: string[] = [
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    '--window-position=100,60',
    '--password-store=basic',
    '--use-mock-keychain',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
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
 * Launch a browser instance (Chromium or Firefox) with full fingerprint configuration.
 */
export async function launchBrowser(
  profile: Profile,
  executablePath: string,
  browserType: 'chrome' | 'firefox' = 'chrome'
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

  // Determine browser type from profile / fingerprint if not specified
  const effectiveBrowserType: 'chrome' | 'firefox' =
    browserType ||
    (profile as any).browserType ||
    fingerprint?.browser?.type ||
    (fingerprint?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')

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

  // ── Dispatch to Firefox Launcher if Firefox is Selected ──
  if (effectiveBrowserType === 'firefox') {
    return launchFirefox(profile, executablePath, fingerprint, launchProxy, startUrls)
  }

  // ── Otherwise Launch Chromium Engine ──
  // Auto-setup Bookmarks in Chromium Profile directory
  if (fingerprint?.browser?.bookmarks && Array.isArray(fingerprint.browser.bookmarks)) {
    setupProfileBookmarks(userDataDir, fingerprint.browser.bookmarks)
  }

  const args = buildLaunchArgs(profile, fingerprint, launchProxy)

  logger.info('browser', `Launching Chromium for profile "${profile.name}"`, JSON.stringify({
    profileId: profile.id,
    osType: profile.osType || 'windows-10',
    userDataDir,
    argCount: args.length,
    hasProxy: !!proxy,
    hasFingerprint: !!profile.fingerprint
  }))

  try {
    const browser = await puppeteer.launch({
      executablePath: executablePath,
      userDataDir,
      headless: false,
      defaultViewport: null,
      args,
      ignoreDefaultArgs: true,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    })

    const wsEndpoint = browser.wsEndpoint()
    const process = browser.process()
    const pid = process?.pid || 0

    // Inject full fingerprint via CDP
    await setupBrowserInjection(browser, fingerprint)

    // Set standard normal centered Chromium window bounds via CDP
    try {
      const pages = await browser.pages()
      if (pages.length > 0) {
        const client = await pages[0].target().createCDPSession()
        const { windowId } = await client.send('Browser.getWindowForTarget')
        await client.send('Browser.setWindowBounds', {
          windowId,
          bounds: { windowState: 'normal', width: 1280, height: 800, left: 100, top: 60 }
        })
      }
    } catch (err: any) {
      logger.warn('browser', `Could not set CDP window bounds: ${err.message}`)
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

    // Inject Profile Cookies via CDP Network Domain
    const cookiesToInject = fingerprint?.browser?.cookies || (profile as any).cookies
    if (Array.isArray(cookiesToInject) && cookiesToInject.length > 0) {
      try {
        const pages = await browser.pages()
        if (pages.length > 0) {
          const client = await pages[0].target().createCDPSession()
          const cdpCookies = cookiesToInject.map((c: any) => {
            let domain = c.domain || 'localhost'
            if (domain.startsWith('http://') || domain.startsWith('https://')) {
              try { domain = new URL(domain).hostname } catch {}
            }
            const exp = c.expires || c.expirationDate
            return {
              name: String(c.name || ''),
              value: String(c.value !== undefined ? c.value : ''),
              domain,
              path: c.path || '/',
              expires: typeof exp === 'number' && exp > 0 ? exp : undefined,
              httpOnly: Boolean(c.httpOnly),
              secure: Boolean(c.secure),
              sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : undefined
            }
          }).filter((c: any) => c.name)

          if (cdpCookies.length > 0) {
            await client.send('Network.setCookies', { cookies: cdpCookies })
            logger.info('browser', `Injected ${cdpCookies.length} cookies into browser session via CDP for "${profile.name}"`)
          }
        }
      } catch (err: any) {
        logger.warn('browser', `Could not inject cookies via CDP: ${err.message}`)
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
