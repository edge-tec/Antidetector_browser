// ──────────────────────────────────────────────────────────────────
// AntiProfiles v3 — Browser Launcher (Puppeteer + Fingerprint Injection)
// Integrated with v3 Device Template resolver pipeline
// ──────────────────────────────────────────────────────────────────

import { spawn, execSync, ChildProcess } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import net from 'net'
import path from 'path'
import puppeteer, { Browser } from 'puppeteer-core'
import { Profile, Proxy } from '../database/models'
import { Fingerprint, OSType, createDefaultFingerprint } from '../fingerprint/types'
import { proxyRepo } from '../database/repositories/proxy.repo'
import { decryptPassword } from '../security/encryption'
import { ensureProfileDataDir, ensureFirefoxProfileDataDir } from './chromium-resolver'
import { setupBrowserInjection } from './injection/injector'
import { startProxyBridge } from '../network/proxy-bridge'
import { lookupGeoIP } from '../network/geo-lookup'
import { proxySyncService } from '../services/proxy-sync.service'
import { killProcessTree } from './process-tracker'
import { logger } from '../logging/logger'
import { getGlobalLaunchUrlConfig } from './launch-url-manager'

import { ResolvedFirefoxProfile, resolveFirefoxProfile } from './firefox/firefox-resolver'
import { installFirefoxRuntimeExtension } from './firefox/firefox-extension-builder'
import { installChromiumRuntimeExtension } from './chromium/chromium-extension-builder'
import { BrowserIconManager } from './branding/browser-icon-manager'

export interface LaunchResult {
  browser: Browser | any
  pid: number
  wsEndpoint: string
}

/**
 * Quick TCP-level proxy reachability check.
 * Connects to the proxy host:port with a short timeout to verify it's alive
 * before launching the browser. Returns success/failure with latency and IP.
 */
async function quickProxyCheck(proxy: Proxy): Promise<{ success: boolean; latency: number; ip?: string; error?: string }> {
  const startTime = Date.now()
  const timeout = 8000

  return new Promise((resolve) => {
    const socket = net.connect({ host: proxy.host, port: proxy.port, timeout })

    socket.on('connect', () => {
      const latency = Date.now() - startTime
      socket.destroy()
      resolve({ success: true, latency, ip: proxy.host })
    })

    socket.on('error', (err: Error) => {
      const latency = Date.now() - startTime
      socket.destroy()
      resolve({ success: false, latency, error: err.message })
    })

    socket.on('timeout', () => {
      const latency = Date.now() - startTime
      socket.destroy()
      resolve({ success: false, latency, error: `Connection timed out after ${timeout}ms` })
    })
  })
}

/**
 * Generate Firefox profile preferences (user.js) for anti-detect fingerprint isolation.
 */
function setupFirefoxProfilePrefs(
  userDataDir: string,
  profile: Profile,
  resolvedProfile: ResolvedFirefoxProfile,
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

  const fp = resolvedProfile.fingerprint

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
    'user_pref("toolkit.startup.max_resumed_crashes", -1);',
    'user_pref("extensions.autoDisableScopes", 0);',
    'user_pref("xpinstall.signatures.required", false);',
    'user_pref("extensions.experiments.enabled", true);'
  ]

  // User-Agent, AppVersion, Platform, and OSCPU Overrides
  if (resolvedProfile.userAgent) {
    prefs.push(`user_pref("general.useragent.override", ${JSON.stringify(resolvedProfile.userAgent)});`)
  }
  if (resolvedProfile.appVersion) {
    prefs.push(`user_pref("general.appversion.override", ${JSON.stringify(resolvedProfile.appVersion)});`)
  }
  if (resolvedProfile.platform) {
    prefs.push(`user_pref("general.platform.override", ${JSON.stringify(resolvedProfile.platform)});`)
  }
  if (resolvedProfile.oscpu) {
    prefs.push(`user_pref("general.oscpu.override", ${JSON.stringify(resolvedProfile.oscpu)});`)
  }

  // Languages & Locale
  const langList = resolvedProfile.languages.join(',') || resolvedProfile.language || 'en-US,en'
  prefs.push(`user_pref("intl.accept_languages", ${JSON.stringify(langList)});`)
  prefs.push(`user_pref("general.useragent.locale", ${JSON.stringify(resolvedProfile.language || 'en-US')});`)

  // WebRTC Leak Shield
  if (fp?.webrtc?.mode === 'disabled' || profile.webrtcMode === 'disabled' || (profile.webrtcMode as string) === 'off') {
    prefs.push('user_pref("media.peerconnection.enabled", false);')
  } else {
    prefs.push('user_pref("media.peerconnection.enabled", true);')
    prefs.push('user_pref("media.peerconnection.ice.proxy_only", true);')
    prefs.push('user_pref("media.peerconnection.ice.default_address_only", true);')
    prefs.push('user_pref("media.peerconnection.ice.no_host", true);')
    prefs.push('user_pref("media.peerconnection.ice.force_interface", "");')
    prefs.push('user_pref("media.peerconnection.use_document_iceservers", false);')
    prefs.push('user_pref("media.navigator.enabled", false);')
  }

  // CPU Threads (Hardware Concurrency)
  if (resolvedProfile.hardwareConcurrency) {
    prefs.push(`user_pref("dom.maxHardwareConcurrency", ${resolvedProfile.hardwareConcurrency});`)
  }

  // Device Memory
  if (resolvedProfile.deviceMemory) {
    prefs.push('user_pref("dom.deviceMemory.enabled", true);')
  }

  // Do Not Track
  if (resolvedProfile.doNotTrack) {
    prefs.push(`user_pref("privacy.donottrackheader.enabled", ${resolvedProfile.doNotTrack === '1'});`)
  }

  // WebGL Vendor & Renderer Spoofing
  if (resolvedProfile.unmaskedRenderer) {
    prefs.push(`user_pref("webgl.renderer-string-override", ${JSON.stringify(resolvedProfile.unmaskedRenderer)});`)
  }
  if (resolvedProfile.unmaskedVendor) {
    prefs.push(`user_pref("webgl.vendor-string-override", ${JSON.stringify(resolvedProfile.unmaskedVendor)});`)
  }

  // Geolocation Spoofing
  if (fp?.geolocation && fp.geolocation.mode !== 'disabled') {
    const lat = fp.geolocation.latitude || 40.7128
    const lng = fp.geolocation.longitude || -74.006
    prefs.push('user_pref("geo.enabled", true);')
    prefs.push(`user_pref("geo.provider.network.url", "data:application/json,{\\"location\\":{\\"lat\\":${lat},\\"lng\\":${lng}},\\"accuracy\\":50}");`)
  }

  // Keep Firefox UI & font scaling user-friendly, sleek, compact, and responsive
  prefs.push('user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);')
  // Use natural system DPI scaling (-1.0 = auto) to prevent 2.0x double-scaling on Retina / high-DPI displays
  prefs.push('user_pref("layout.css.devPixelsPerPx", "-1.0");')
  prefs.push('user_pref("browser.compactmode.show", true);')
  prefs.push('user_pref("browser.uidensity", 0);')
  prefs.push('user_pref("font.size.systemFontScale", 100);')
  prefs.push(`user_pref("browser.window.width", ${resolvedProfile.screenWidth || 1200});`)
  prefs.push(`user_pref("browser.window.height", ${resolvedProfile.screenHeight || 780});`)
  prefs.push('user_pref("browser.toolbars.bookmarks.visibility", "never");')
  prefs.push('user_pref("browser.tabs.tabmanager.enabled", false);')
  prefs.push('user_pref("browser.newtabpage.activity-stream.topSitesRows", 1);')
  prefs.push('user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);')
  prefs.push('user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);')

  // Hardware Acceleration
  if (profile.hwAcceleration === false) {
    prefs.push('user_pref("layers.acceleration.disabled", true);')
    prefs.push('user_pref("gfx.direct2d.disabled", true);')
  }

  // Proxy Configuration
  if (proxy && proxy.type !== 'direct' && proxy.host) {
    prefs.push('user_pref("network.proxy.type", 1);')
    prefs.push('user_pref("network.proxy.no_proxies_on", "");')
    prefs.push('user_pref("network.proxy.share_proxy_settings", true);')
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
      prefs.push('user_pref("network.proxy.socks_remote_dns", true);')
    }
  } else {
    // Explicit Direct mode (prevents Firefox from falling back to Windows system proxy settings)
    prefs.push('user_pref("network.proxy.type", 0);')
  }

  const userJsPath = path.join(resolvedDir, 'user.js')
  const prefsJsPath = path.join(resolvedDir, 'prefs.js')
  const content = prefs.join('\n') + '\n'
  fs.writeFileSync(userJsPath, content, 'utf8')
  if (!fs.existsSync(prefsJsPath)) {
    fs.writeFileSync(prefsJsPath, content, 'utf8')
  }

  // Install runtime isolation WebExtension into the profile
  installFirefoxRuntimeExtension(resolvedDir, resolvedProfile)

  // Pre-seed chrome/userChrome.css and chrome/userContent.css for sleek modern UI proportions
  const chromeDir = path.join(resolvedDir, 'chrome')
  try {
    if (!fs.existsSync(chromeDir)) {
      fs.mkdirSync(chromeDir, { recursive: true, mode: 0o700 })
    }
    const userChromeCss = `
/* AntiProfiles Sleek Compact Modern Responsive Firefox Desktop UI */
:root {
  --tab-min-height: 36px !important;
  --tab-border-radius: 6px !important;
  --urlbar-min-height: 32px !important;
  --urlbar-height: 32px !important;
  --toolbarbutton-outer-padding: 2px !important;
  --toolbarbutton-inner-padding: 4px !important;
}

#nav-bar {
  padding-top: 2px !important;
  padding-bottom: 2px !important;
  min-height: 38px !important;
}

#urlbar-container {
  min-height: 32px !important;
  padding-top: 1px !important;
  padding-bottom: 1px !important;
}

#urlbar {
  min-height: 32px !important;
  border-radius: 8px !important;
  font-size: 13px !important;
}

#urlbar-background {
  border-radius: 8px !important;
}

.tabbrowser-tab {
  min-height: 36px !important;
  font-size: 13px !important;
}

.tab-background {
  border-radius: 6px 6px 0 0 !important;
  margin-block: 1px !important;
}

.toolbarbutton-1 {
  padding: 4px !important;
}

.toolbarbutton-icon {
  width: 18px !important;
  height: 18px !important;
}

#PersonalToolbar {
  max-height: 28px !important;
}

#browser {
  flex-grow: 1 !important;
}
`
    const userContentCss = `
/* AntiProfiles Responsive Compact New Tab Styling */
@-moz-document url("about:home"), url("about:newtab") {
  .logo-and-wordmark {
    margin-bottom: 16px !important;
  }
  .logo {
    width: 64px !important;
    height: 64px !important;
  }
  .wordmark {
    font-size: 28px !important;
  }
  .search-wrapper {
    margin-bottom: 20px !important;
    max-width: 600px !important;
  }
  .search-inner-wrapper {
    min-height: 40px !important;
    height: 40px !important;
  }
  .top-sites-list {
    gap: 14px !important;
  }
  .top-site-outer {
    padding: 6px !important;
  }
  .top-site-inner .tile {
    width: 52px !important;
    height: 52px !important;
  }
}
`
    fs.writeFileSync(path.join(chromeDir, 'userChrome.css'), userChromeCss.trim() + '\n', 'utf8')
    fs.writeFileSync(path.join(chromeDir, 'userContent.css'), userContentCss.trim() + '\n', 'utf8')
  } catch {}

  // Pre-seed xulstore.json to ensure Firefox opens in a normal, compact centered window
  const xulstorePath = path.join(resolvedDir, 'xulstore.json')
  const xulstoreConfig = {
    'chrome://browser/content/browser.xhtml': {
      'main-window': {
        width: '1200',
        height: '780',
        sizemode: 'normal',
        screenX: '140',
        screenY: '70'
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
  fingerprintOrResolved: Fingerprint | ResolvedFirefoxProfile,
  launchProxy: Proxy | null,
  startUrls: string[]
): Promise<LaunchResult> {
  const resolvedProfile: ResolvedFirefoxProfile =
    (fingerprintOrResolved as any)?.operatingSystem
      ? (fingerprintOrResolved as ResolvedFirefoxProfile)
      : resolveFirefoxProfile(profile)

  const userDataDir = path.resolve(ensureFirefoxProfileDataDir(profile.id))
  setupFirefoxProfilePrefs(userDataDir, profile, resolvedProfile, launchProxy)
  BrowserIconManager.patchFirefoxRuntimeBranding(firefoxPath)
  BrowserIconManager.setupFirefoxBranding(userDataDir, profile)

  // Use standard -no-remote, -profile, and responsive clean desktop dimensions
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

  const tz = resolvedProfile.timezone
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MOZ_NO_REMOTE: '1',
    ...(tz ? { TZ: tz } : {})
  }

  // Custom launch args (allowlisted)
  const customArgs = resolvedProfile.fingerprint?.browser?.customLaunchArgs
  if (customArgs && Array.isArray(customArgs)) {
    for (const arg of customArgs) {
      if (arg.startsWith('-') && !args.includes(arg)) {
        args.push(arg)
      }
    }
  }

  logger.info('browser', `[FirefoxLaunch] Launching Firefox for profile "${profile.name}" (${profile.id}) [OS: ${resolvedProfile.osType}, Ver: ${resolvedProfile.browserVersion}] with -profile ${userDataDir} at: ${firefoxPath}`)

  logger.info('browser', `[FirefoxLaunch] Spawning native Firefox process: ${firefoxPath}`)
  const child = spawn(firefoxPath, args, {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
    env
  })
  const pid = child.pid || 0

  const mockBrowser: any = {
    connected: true,
    process: () => child,
    wsEndpoint: () => '',
    pages: async () => [],
    close: async () => {
      try {
        if (child.pid) killProcessTree(child.pid)
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

    const roots: any = {
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
    }

    const md5 = crypto.createHash('md5')
    const hashNode = (node: any) => {
      md5.update(node.id || '')
      md5.update(node.name || '')
      if (node.type === 'url') md5.update(node.url || '')
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) hashNode(child)
      }
    }
    hashNode(roots.bookmark_bar)
    hashNode(roots.other)
    hashNode(roots.synced)
    const checksum = md5.digest('hex')

    const bookmarksJson = {
      checksum,
      roots,
      version: 1
    }

    fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarksJson, null, 2), 'utf8')
    logger.info('browser', `Wrote ${bookmarks.length} bookmarks with valid checksum to Chromium profile: ${bookmarksPath}`)
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

  const disabledFeatures = [
    'ProfilePickerOnStartup',
    'AppBoundEncryptionProvider',
    'AppBoundEncryption',
    'UserAgentClientHint'
  ].join(',')

  const args: string[] = [
    '--no-first-run',
    '--no-default-browser-check',
    '--profile-directory=Default',
    '--window-size=1280,800',
    '--window-position=100,60',
    `--disable-features=${disabledFeatures}`,
    '--disable-infobars',
    '--use-mock-keychain',
    '--password-store=basic',
    `--lang=${lang}`
  ]

  // Only add container sandbox bypass if running as root on Linux (Docker CI)
  if (process.platform === 'linux' && typeof (process as any).getuid === 'function' && (process as any).getuid() === 0) {
    args.push('--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage')
  }

  if (fingerprint?.navigator?.userAgent) {
    args.push(`--user-agent=${fingerprint.navigator.userAgent}`)
  }

  // Mobile / Touch Presentation flags
  const isMobileProfile = (profile.osType || '').includes('android') || (profile.osType || '').includes('ios') || !!fingerprint?.navigator?.touchSupport
  if (isMobileProfile) {
    args.push('--touch-events=enabled', '--enable-touch-drag-drop')
  }

  // WebRTC configuration - STRICT PRIVACY FOR PROXIES & LEAK SHIELD
  if (fingerprint?.webrtc?.mode === 'disabled' || profile.webrtcMode === 'disabled' || (profile.webrtcMode as string) === 'off') {
    args.push('--disable-webrtc')
  } else {
    // When WebRTC is active, strictly enforce disable_non_proxied_udp to guarantee zero host/LAN IP leaks
    args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
    args.push('--enforce-webrtc-ip-permission-check')
  }

  // Hardware acceleration
  if (!profile.hwAcceleration) {
    args.push('--disable-gpu')
    args.push('--disable-software-rasterizer')
  }

  // Google services (only disable background telemetry if explicitly requested by custom profile)
  if (fingerprint?.browser && fingerprint.browser.googleServicesEnabled === false) {
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
    // Route all traffic through proxy without Windows system proxy fallback
    args.push('--proxy-bypass-list=<-loopback>')
  } else {
    // Explicitly disable proxy when "No Proxy" / "Direct" is selected
    // Prevents Windows from using system proxy auto-detection (WPAD/PAC)
    args.push('--no-proxy-server')
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

import { recalculateDependentFields, generateFromDeviceTemplate, resolveExistingProfile } from '../fingerprint/generator'
import { validateConsistency } from '../fingerprint/consistency'
import { getDeviceTemplateById } from '../fingerprint/device-templates'

/**
 * Normalize a fingerprint using either:
 * 1) v3 device template resolver (if deviceTemplateId is available), or
 * 2) v2 recalculateDependentFields (legacy fallback)
 */
function normalizeFingerprint(
  raw: Partial<Fingerprint> | null,
  osType: string,
  browserType?: 'chrome' | 'firefox',
  browserVersion?: string,
  deviceTemplateId?: string,
  profile?: Profile
): Fingerprint {
  const targetOs = (osType as OSType) || (profile?.osType as OSType) || 'windows-10'
  const targetBrowser: 'chrome' | 'firefox' =
    browserType ||
    (profile as any)?.browserType ||
    raw?.browser?.type ||
    (raw?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')
  const targetVer =
    browserVersion ||
    profile?.browserVersion ||
    raw?.browser?.version ||
    raw?.navigator?.browserVersion ||
    (targetBrowser === 'firefox' ? '129.0' : '131.0.0.0')

  logger.info('profile', `[ConfigPrecedence] Resolving Profile Hierarchy for "${profile?.name || 'profile'}": Explicit Profile Config -> Template -> Defaults (Host defaults blocked)`)

  let baseFp: Fingerprint
  // 1. If deviceTemplateId is available, generate base from template
  if (deviceTemplateId) {
    const template = getDeviceTemplateById(deviceTemplateId)
    if (template) {
      try {
        const resolved = generateFromDeviceTemplate({
          osType: targetOs,
          browserType: targetBrowser,
          browserVersion: targetVer,
          deviceTemplateId,
          seed: raw?.seed || 'stable-seed'
        })
        baseFp = resolved.fingerprint
      } catch (err: any) {
        logger.warn('browser', `[v3 Resolver] Fallback to v2 recalculate: ${err.message}`)
        const base = raw && typeof raw === 'object' ? (raw as Fingerprint) : createDefaultFingerprint()
        baseFp = recalculateDependentFields(base, {
          osType: targetOs,
          browserType: targetBrowser,
          browserVersion: targetVer,
          seed: base.seed || 'stable-seed'
        })
      }
    } else {
      const base = raw && typeof raw === 'object' ? (raw as Fingerprint) : createDefaultFingerprint()
      baseFp = recalculateDependentFields(base, {
        osType: targetOs,
        browserType: targetBrowser,
        browserVersion: targetVer,
        seed: base.seed || 'stable-seed'
      })
    }
  } else {
    const base = raw && typeof raw === 'object' ? (raw as Fingerprint) : createDefaultFingerprint()
    baseFp = recalculateDependentFields(base, {
      osType: targetOs,
      browserType: targetBrowser,
      browserVersion: targetVer,
      seed: base.seed || 'stable-seed'
    })
  }

  // 2. Apply Explicit Profile / Fingerprint Overrides on top of Template/Defaults
  if (raw) {
    if (raw.navigator) {
      if (raw.navigator.hardwareConcurrency) baseFp.navigator.hardwareConcurrency = raw.navigator.hardwareConcurrency
      if (raw.navigator.deviceMemory) baseFp.navigator.deviceMemory = raw.navigator.deviceMemory
      if (raw.navigator.userAgent) baseFp.navigator.userAgent = raw.navigator.userAgent
      if (raw.navigator.platform) baseFp.navigator.platform = raw.navigator.platform
      if (raw.navigator.cpuArchitecture) baseFp.navigator.cpuArchitecture = raw.navigator.cpuArchitecture
    }
    if (raw.screen) {
      if (raw.screen.width) baseFp.screen.width = raw.screen.width
      if (raw.screen.height) baseFp.screen.height = raw.screen.height
      if (raw.screen.availWidth) baseFp.screen.availWidth = raw.screen.availWidth
      if (raw.screen.availHeight) baseFp.screen.availHeight = raw.screen.availHeight
      if (raw.screen.devicePixelRatio) baseFp.screen.devicePixelRatio = raw.screen.devicePixelRatio
    }
    if (raw.webgl) {
      if (raw.webgl.unmaskedVendor) baseFp.webgl.unmaskedVendor = raw.webgl.unmaskedVendor
      if (raw.webgl.unmaskedRenderer) baseFp.webgl.unmaskedRenderer = raw.webgl.unmaskedRenderer
    }
    if (raw.locale) {
      if (raw.locale.language) baseFp.locale.language = raw.locale.language
      if (raw.locale.languages) baseFp.locale.languages = raw.locale.languages
    }
    if (raw.timezone?.timezone) {
      baseFp.timezone.timezone = raw.timezone.timezone
    }
    if (raw.geolocation) {
      baseFp.geolocation = { ...baseFp.geolocation, ...raw.geolocation }
    }
  }

  // 3. Apply top-level Profile fields if explicitly provided on profile row
  if (profile) {
    if (profile.hwConcurrency) baseFp.navigator.hardwareConcurrency = profile.hwConcurrency
    if (profile.deviceMemory) baseFp.navigator.deviceMemory = profile.deviceMemory
    if (profile.screenWidth) baseFp.screen.width = profile.screenWidth
    if (profile.screenHeight) baseFp.screen.height = profile.screenHeight
    if (profile.userAgent) baseFp.navigator.userAgent = profile.userAgent
    if (profile.language) baseFp.locale.language = profile.language
    if (profile.timezone) baseFp.timezone.timezone = profile.timezone
  }

  // 4. Enforce strict device/OS coherence to prevent host hardware leaks
  const family = targetOs === 'android' ? 'android' : targetOs === 'ios' ? 'ios' : 'desktop'
  if (family === 'android') {
    baseFp.navigator.platform = 'Linux armv8l'
    baseFp.navigator.maxTouchPoints = 5
    baseFp.navigator.touchSupport = true
    if (baseFp.navigator.hardwareConcurrency > 8) baseFp.navigator.hardwareConcurrency = 8
  } else if (family === 'ios') {
    baseFp.navigator.platform = 'iPhone'
    baseFp.navigator.maxTouchPoints = 5
    baseFp.navigator.touchSupport = true
    if (baseFp.navigator.hardwareConcurrency > 8) baseFp.navigator.hardwareConcurrency = 6
    if (baseFp.navigator.deviceMemory > 8) baseFp.navigator.deviceMemory = 8
  }

  return baseFp
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

  // Determine browser type from profile / fingerprint if not specified
  let rawFp: any = null
  try {
    rawFp = profile.fingerprint
      ? (typeof profile.fingerprint === 'string'
        ? JSON.parse(profile.fingerprint)
        : profile.fingerprint)
      : null
  } catch {}

  const effectiveBrowserType: 'chrome' | 'firefox' =
    browserType ||
    (profile as any).browserType ||
    rawFp?.browser?.type ||
    (rawFp?.navigator?.userAgent?.includes('Firefox') ? 'firefox' : 'chrome')

  const effectiveBrowserVer =
    (profile as any).browserVersion ||
    rawFp?.browser?.version ||
    rawFp?.navigator?.browserVersion ||
    (effectiveBrowserType === 'firefox' ? '129.0' : '131.0.0.0')

  // Enforce consistent fingerprint normalization
  // v3: Check for deviceTemplateId on the profile
  const deviceTemplateId = (profile as any).deviceTemplateId || rawFp?.deviceTemplateId || undefined

  const fingerprint: Fingerprint = normalizeFingerprint(
    rawFp,
    profile.osType || 'windows-10',
    effectiveBrowserType,
    effectiveBrowserVer,
    deviceTemplateId,
    profile
  )

  // Validate consistency before launching (v3: passes deviceTemplateId for template-locked checks)
  const consistencyReport = validateConsistency(
    fingerprint,
    (profile.osType as any) || 'windows-10',
    effectiveBrowserType,
    effectiveBrowserVer,
    deviceTemplateId
  )

  // Real-time synchronization of proxy configuration & location data before launch
  if (profile.proxyId) {
    try {
      await proxySyncService.syncProfileProxy(profile.id)
    } catch (err: any) {
      logger.warn('proxy', `[ProxyPreSync] Profile proxy sync: ${err.message}`)
    }
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

  // If proxy requires authentication (HTTP/HTTPS/SOCKS) or is a SOCKS proxy, start local proxy auth bridge
  if (launchProxy && (launchProxy.type.startsWith('socks') || !!launchProxy.username)) {
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
      logger.error('browser', `Could not start proxy authentication bridge for profile "${profile.name}": ${err.message}`)
      throw new Error(`Proxy failed to initialize: ${err.message}`)
    }
  }

  // ── Auto-Sync Timezone, Geolocation & WebRTC to Proxy Location ──
  if (proxy && proxy.type !== 'direct' && proxy.host) {
    try {
      const geo = await lookupGeoIP(proxy.host, {
        country: proxy.country,
        region: proxy.region,
        city: proxy.city,
        isp: proxy.isp,
        asn: proxy.asn,
        timezone: proxy.timezone,
        latitude: proxy.latitude,
        longitude: proxy.longitude,
        publicIp: proxy.publicIp || proxy.host
      })

      if (geo) {
        if (geo.timezone) {
          fingerprint.timezone = fingerprint.timezone || { mode: 'custom', timezone: geo.timezone }
          fingerprint.timezone.timezone = geo.timezone
          profile.timezone = geo.timezone
          logger.info('proxy', `[ProxyTimezoneSync] ✓ Auto-matched browser timezone to "${geo.timezone}" for proxy host ${proxy.host} (${proxy.city || geo.city}, ${proxy.region || geo.region})`)
        }
        if (geo.latitude !== undefined && geo.longitude !== undefined) {
          fingerprint.geolocation = fingerprint.geolocation || { mode: 'ip-based', latitude: geo.latitude, longitude: geo.longitude, accuracy: 50 }
          fingerprint.geolocation.latitude = geo.latitude
          fingerprint.geolocation.longitude = geo.longitude
          fingerprint.geolocation.mode = 'ip-based'
          logger.info('proxy', `[ProxyGeoSync] ✓ Auto-matched geolocation coordinates (${geo.latitude}, ${geo.longitude}) for proxy host ${proxy.host} (${proxy.city || geo.city}, ${proxy.region || geo.region})`)
        }
        if (geo.ip) {
          if (!fingerprint.webrtc) fingerprint.webrtc = {}
          fingerprint.webrtc.publicIp = geo.ip
        }
      }
    } catch (err: any) {
      logger.warn('proxy', `[ProxySync] Could not resolve proxy geo: ${err.message}`)
    }
  }

  // ── Segregated Diagnostic Logging: Profile Config vs Runtime Config vs Network Config ──
  logger.info('profile', `[ProfileConfig] Initializing profile "${profile.name}" (${profile.id})`, {
    profileId: profile.id,
    osType: profile.osType || 'windows-10',
    browserEngine: effectiveBrowserType,
    browserVersion: effectiveBrowserVer,
    deviceTemplateId: deviceTemplateId || '[legacy/none]',
    platform: fingerprint.navigator?.platform,
    screen: `${fingerprint.screen?.width}x${fingerprint.screen?.height} @${fingerprint.screen?.devicePixelRatio}x`,
    hardwareConcurrency: fingerprint.navigator?.hardwareConcurrency,
    deviceMemory: fingerprint.navigator?.deviceMemory,
    gpuRenderer: fingerprint.webgl?.unmaskedRenderer,
    consistencyScore: consistencyReport.score,
    warnings: consistencyReport.warnings,
    contradictions: consistencyReport.contradictions
  })

  logger.info('network', `[NetworkConfig] Network identity isolation state for profile "${profile.name}"`, {
    profileId: profile.id,
    hasProxy: !!proxy,
    proxyType: proxy?.type || 'direct',
    proxyHost: proxy?.host || 'none',
    webrtcPolicy: fingerprint.webrtc?.ipPolicy || 'default_public_interface_only',
    dnsMode: fingerprint.browser?.dnsMode || 'system',
    networkNote: 'Fingerprint masking isolates browser and hardware characteristics; it does not alter public IP address without a proxy.'
  })

  // ── Pre-Launch Proxy Verification (prevents silent fallback to direct connection) ──
  if (launchProxy && launchProxy.type !== 'direct' && launchProxy.host) {
    logger.info('network', `[ProxyPreLaunchCheck] Verifying proxy reachability for profile "${profile.name}"`, {
      profileId: profile.id,
      platform: process.platform,
      proxyType: launchProxy.type,
      proxyHost: launchProxy.host,
      proxyPort: launchProxy.port,
      socksBridgeUsed: proxy?.type?.startsWith('socks') || false
    })

    try {
      const checkResult = await quickProxyCheck(launchProxy)
      if (checkResult.success) {
        logger.info('network', `[ProxyVerified] ✓ Proxy ${launchProxy.host}:${launchProxy.port} is reachable (${checkResult.latency}ms). External IP: ${checkResult.ip || 'resolved'}`)
      } else {
        logger.error('network', `[ProxyFailed] ✗ Proxy ${launchProxy.host}:${launchProxy.port} is unreachable: ${checkResult.error}`)
        throw new Error(`Proxy is unreachable: ${checkResult.error || 'Connection failed'}. Please check your proxy settings.`)
      }
    } catch (err: any) {
      if (err.message.startsWith('Proxy is unreachable')) throw err
      logger.warn('network', `[ProxyCheckSkipped] Could not verify proxy: ${err.message}. Proceeding with launch.`)
    }
  }

  // ── Determine start URLs (Integrated with Global Launch URL / Start Page System) ──
  const globalLaunch = getGlobalLaunchUrlConfig()
  let startUrls: string[] = []

  if (globalLaunch.enabled && globalLaunch.url) {
    const adminUrl = globalLaunch.url.trim()
    if (globalLaunch.mode === 'force') {
      // Force mode: Admin Launch URL takes absolute precedence as tab 1
      startUrls.push(adminUrl)
      if (profile.startUrl && profile.startUrl !== adminUrl && !globalLaunch.lockOverride) {
        startUrls.push(profile.startUrl)
      }
      logger.info('browser', `[GlobalLaunchUrl] Enforced admin launch URL: "${adminUrl}" (Mode: Force)`)
    } else if (globalLaunch.mode === 'enroll_all') {
      // Enroll-All mode: Use admin launch URL for all enrolled profiles
      startUrls.push(adminUrl)
      logger.info('browser', `[GlobalLaunchUrl] Applied enrolled admin launch URL: "${adminUrl}"`)
    } else {
      // Default mode: Use profile startUrl if set, otherwise fallback to admin launch URL
      if (profile.startUrl) {
        startUrls.push(profile.startUrl)
      } else {
        startUrls.push(adminUrl)
        logger.info('browser', `[GlobalLaunchUrl] Applied default admin launch URL: "${adminUrl}"`)
      }
    }

    // Append any extra tabs configured by the admin
    if (globalLaunch.additionalTabs && Array.isArray(globalLaunch.additionalTabs)) {
      for (const tabUrl of globalLaunch.additionalTabs) {
        if (tabUrl && !startUrls.includes(tabUrl)) {
          startUrls.push(tabUrl)
        }
      }
    }
  } else {
    // Normal profile start URL
    if (profile.startUrl) {
      startUrls.push(profile.startUrl)
    }
  }

  if (fingerprint?.browser?.startUrls && Array.isArray(fingerprint.browser.startUrls)) {
    for (const url of fingerprint.browser.startUrls) {
      if (url && !startUrls.includes(url)) startUrls.push(url)
    }
  }

  // ── Dispatch to Firefox Launcher if Firefox is Selected ──
  if (effectiveBrowserType === 'firefox') {
    logger.info('browser', `[RuntimeConfig] Launching Firefox Quantum Gecko Engine runtime for profile "${profile.name}"`)
    const resolvedFf = resolveFirefoxProfile(profile)
    if (fingerprint.timezone?.timezone) {
      resolvedFf.timezone = fingerprint.timezone.timezone
    }
    return launchFirefox(profile, executablePath, resolvedFf, launchProxy, startUrls)
  }

  // ── Otherwise Launch Chromium Engine ──
  // Auto-setup Bookmarks in Chromium Profile directory
  if (fingerprint?.browser?.bookmarks && Array.isArray(fingerprint.browser.bookmarks)) {
    setupProfileBookmarks(userDataDir, fingerprint.browser.bookmarks)
  }

  BrowserIconManager.patchChromiumRuntimeBranding(executablePath)
  BrowserIconManager.setupChromiumBranding(userDataDir, profile)
  const args = buildLaunchArgs(profile, fingerprint, launchProxy)
  const brandingArgs = BrowserIconManager.getChromiumBrandingArgs(profile)
  args.push(...brandingArgs)

  logger.info('browser', `[RuntimeConfig] Launching Chromium Blink Engine runtime for profile "${profile.name}"`, {
    profileId: profile.id,
    osType: profile.osType || 'windows-10',
    userDataDir,
    argCount: args.length,
    executablePath
  })

  try {
    const effectiveTz = fingerprint?.timezone?.timezone || profile.timezone || 'America/New_York'

    if (process.platform === 'darwin' || process.platform === 'linux') {
      try { fs.chmodSync(executablePath, 0o755) } catch {}
      if (process.platform === 'darwin') {
        try { execSync(`xattr -dr com.apple.quarantine "${executablePath}" 2>/dev/null || true`, { stdio: 'ignore' }) } catch {}
      }
    }

    // ── Install AntiProfiles Runtime Isolation Extension ──
    const extDir = installChromiumRuntimeExtension(userDataDir, fingerprint, {
      id: profile.id,
      name: profile.name,
      browserVersion: effectiveBrowserVer
    })

    // ── Native Google-Compliant Desktop Chromium Launch ──
    const finalArgs: string[] = [
      `--user-data-dir=${userDataDir}`,
      '--profile-directory=Default',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,800',
      '--window-position=100,60',
      '--disable-features=ProfilePickerOnStartup',
      ...args.filter(a => !a.startsWith('--user-data-dir=') && !a.startsWith('--profile-directory='))
    ]

    if (extDir && fs.existsSync(extDir)) {
      finalArgs.push(`--load-extension=${extDir}`)
      finalArgs.push(`--disable-extensions-except=${extDir}`)
    }

    if (startUrls.length > 0) {
      finalArgs.push(...startUrls)
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(effectiveTz ? { TZ: effectiveTz } : {})
    }

    logger.info('browser', `[ChromiumLaunch] Spawning native Chromium process: ${executablePath} with user-data-dir: ${userDataDir}`)
    const child = spawn(executablePath, finalArgs, {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
      env
    })
    const pid = child.pid || 0

    logger.info('browser', `[ChromiumLaunch] Native Chromium started for "${profile.name}" (PID: ${pid})`)
    return { browser: null as any, pid, wsEndpoint: '', childProcess: child }
  } catch (err: any) {
    logger.error('browser', `Failed to launch browser for "${profile.name}": ${err.message}`)
    throw new Error(`Browser failed to launch: ${err.message}`)
  }
}
