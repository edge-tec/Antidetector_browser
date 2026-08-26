// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Custom Browser Branding & Icon Manager
// Manages multi-resolution application, engine, and per-profile icons
// for Chromium & Firefox across Windows, macOS, and Linux.
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { execSync } from 'child_process'
import { Profile } from '../../database/models'
import { getDatabase } from '../../database/connection'
import { logger } from '../../logging/logger'

export type BrowserEngineType = 'chromium' | 'firefox' | 'chrome'
export type BrandingTarget = 'chromium' | 'firefox' | 'app'

export interface ResolvedBrowserIcon {
  engine: 'chromium' | 'firefox'
  profileId?: string
  source: 'profile-custom' | 'admin-custom' | 'bundled-custom' | 'default-fallback'
  icoPath?: string
  icnsPath?: string
  pngPath?: string
  dataUrl?: string
}

export interface BrandingConfig {
  chromium: {
    isCustom: boolean
    previewUrl: string
    updatedAt?: string
  }
  firefox: {
    isCustom: boolean
    previewUrl: string
    updatedAt?: string
  }
  app: {
    isCustom: boolean
    previewUrl: string
    updatedAt?: string
  }
}

export class BrowserIconManager {
  private static getResourcesDir(): string {
    if (app && app.isPackaged) {
      return path.join(process.resourcesPath)
    }
    const appPath = app ? app.getAppPath() : process.cwd()
    return path.join(appPath, 'resources')
  }

  public static getCustomBrandingDir(): string {
    const base = app ? app.getPath('userData') : path.join(process.cwd(), 'userData')
    const dir = path.join(base, 'custom-branding')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (err: any) {
        logger.warn('system', `Could not create custom-branding dir: ${err.message}`)
      }
    }
    return dir
  }

  public static getProfileIconsDir(): string {
    const dir = path.join(this.getCustomBrandingDir(), 'profiles')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (err: any) {
        logger.warn('system', `Could not create profile icons dir: ${err.message}`)
      }
    }
    return dir
  }

  /**
   * Resolve authoritative icon paths for a profile or engine with robust fallbacks:
   * 1. Per-Profile Custom Icon
   * 2. Custom Uploaded Engine Icon
   * 3. Bundled Engine Branding Icon
   * 4. Default Application Icon
   */
  public static resolveIcon(
    engine: BrowserEngineType = 'chromium',
    profile?: Partial<Profile> | null
  ): ResolvedBrowserIcon {
    let isFirefox = engine === 'firefox'
    if (profile) {
      if ((profile as any).browserType === 'firefox') isFirefox = true
      else if (profile.browserVersion?.toLowerCase().includes('firefox')) isFirefox = true
      else if (profile.userAgent?.includes('Firefox') || profile.userAgent?.includes('FxiOS')) isFirefox = true
      else if (profile.fingerprint) {
        if (typeof profile.fingerprint === 'object' && profile.fingerprint.browser?.type === 'firefox') isFirefox = true
        else if (typeof profile.fingerprint === 'string' && profile.fingerprint.includes('"type":"firefox"')) isFirefox = true
      }
    }
    const normalizedEngine: 'chromium' | 'firefox' = isFirefox ? 'firefox' : 'chromium'

    const customDir = this.getCustomBrandingDir()
    const profileDir = this.getProfileIconsDir()
    const resourcesDir = this.getResourcesDir()

    // 1. Check Per-Profile Custom Icon
    if (profile?.id) {
      const profileIco = path.join(profileDir, `${profile.id}.ico`)
      const profileIcns = path.join(profileDir, `${profile.id}.icns`)
      const profilePng = path.join(profileDir, `${profile.id}.png`)

      if (fs.existsSync(profileIco) || fs.existsSync(profilePng) || fs.existsSync(profileIcns)) {
        return {
          engine: normalizedEngine,
          profileId: profile.id,
          source: 'profile-custom',
          icoPath: fs.existsSync(profileIco) ? profileIco : undefined,
          icnsPath: fs.existsSync(profileIcns) ? profileIcns : undefined,
          pngPath: fs.existsSync(profilePng) ? profilePng : undefined,
          dataUrl: this.pathToDataUrl(fs.existsSync(profilePng) ? profilePng : profileIco)
        }
      }
    }

    // 2. Check Custom Uploaded Engine Icon (Admin Uploaded) or Master App Logo
    const customEngineIco = path.join(customDir, `${normalizedEngine}.ico`)
    const customEngineIcns = path.join(customDir, `${normalizedEngine}.icns`)
    const customEnginePng = path.join(customDir, `${normalizedEngine}.png`)

    const customAppIco = path.join(customDir, 'app.ico')
    const customAppIcns = path.join(customDir, 'app.icns')
    const customAppPng = path.join(customDir, 'app.png')

    const chosenIco = fs.existsSync(customEngineIco) ? customEngineIco : (fs.existsSync(customAppIco) ? customAppIco : undefined)
    const chosenIcns = fs.existsSync(customEngineIcns) ? customEngineIcns : (fs.existsSync(customAppIcns) ? customAppIcns : undefined)
    const chosenPng = fs.existsSync(customEnginePng) ? customEnginePng : (fs.existsSync(customAppPng) ? customAppPng : undefined)

    if (chosenIco || chosenPng || chosenIcns) {
      return {
        engine: normalizedEngine,
        profileId: profile?.id,
        source: 'admin-custom',
        icoPath: chosenIco,
        icnsPath: chosenIcns,
        pngPath: chosenPng,
        dataUrl: this.pathToDataUrl(chosenPng || chosenIco || '')
      }
    }

    // 3. Bundled Custom Engine Icon
    const bundledEngineIco = path.join(resourcesDir, normalizedEngine === 'firefox' ? 'firefox.ico' : 'chromium.ico')
    const bundledEngineIcns = path.join(resourcesDir, normalizedEngine === 'firefox' ? 'firefox.icns' : 'chromium.icns')
    const bundledEnginePng = path.join(resourcesDir, normalizedEngine === 'firefox' ? 'firefox.png' : 'chromium.png')

    if (fs.existsSync(bundledEngineIco) || fs.existsSync(bundledEnginePng) || fs.existsSync(bundledEngineIcns)) {
      return {
        engine: normalizedEngine,
        profileId: profile?.id,
        source: 'bundled-custom',
        icoPath: fs.existsSync(bundledEngineIco) ? bundledEngineIco : undefined,
        icnsPath: fs.existsSync(bundledEngineIcns) ? bundledEngineIcns : undefined,
        pngPath: fs.existsSync(bundledEnginePng) ? bundledEnginePng : undefined,
        dataUrl: this.pathToDataUrl(fs.existsSync(bundledEnginePng) ? bundledEnginePng : bundledEngineIco)
      }
    }

    // 4. Default Application Icon Fallback
    const defaultIco = path.join(resourcesDir, 'icon.ico')
    const defaultIcns = path.join(resourcesDir, 'icon.icns')
    const defaultPng = path.join(resourcesDir, 'icon.png')

    return {
      engine: normalizedEngine,
      profileId: profile?.id,
      source: 'default-fallback',
      icoPath: fs.existsSync(defaultIco) ? defaultIco : undefined,
      icnsPath: fs.existsSync(defaultIcns) ? defaultIcns : undefined,
      pngPath: fs.existsSync(defaultPng) ? defaultPng : undefined,
      dataUrl: this.pathToDataUrl(fs.existsSync(defaultPng) ? defaultPng : defaultIco)
    }
  }

  /**
   * Recursively locate all installed browser runtime app bundles or executables.
   */
  public static findExecutableCandidates(engine: 'chromium' | 'firefox'): string[] {
    const base = app ? app.getPath('userData') : path.join(process.cwd(), 'userData')
    const searchDirs = [
      path.join(base, 'browser-runtimes', engine),
      path.join(base, `managed-${engine}`)
    ]
    const candidates: string[] = []

    const walk = (dir: string, depth = 0) => {
      if (depth > 6 || !fs.existsSync(dir)) return
      try {
        const entries = fs.readdirSync(dir)
        for (const entry of entries) {
          const fullPath = path.join(dir, entry)
          const stat = fs.statSync(fullPath)
          if (stat.isDirectory()) {
            if (process.platform === 'darwin' && entry.endsWith('.app')) {
              candidates.push(fullPath)
            } else {
              walk(fullPath, depth + 1)
            }
          } else if (process.platform === 'win32') {
            if (entry.toLowerCase() === (engine === 'firefox' ? 'firefox.exe' : 'chrome.exe')) {
              candidates.push(fullPath)
            }
          } else if (process.platform === 'linux') {
            if (entry === (engine === 'firefox' ? 'firefox' : 'chrome')) {
              candidates.push(fullPath)
            }
          }
        }
      } catch {}
    }

    for (const d of searchDirs) {
      walk(d)
    }
    return candidates
  }

  /**
   * Setup Firefox profile window & taskbar icon branding in the profile's chrome/ directory.
   * Firefox natively looks for window icons in <profileDir>/chrome/icons/default/main-window.*
   */
  public static setupFirefoxBranding(userDataDir: string, profile: Profile): void {
    try {
      const resolvedIcon = this.resolveIcon('firefox', profile)
      const chromeDir = path.join(userDataDir, 'chrome')
      const iconsDefaultDir = path.join(chromeDir, 'icons', 'default')

      if (!fs.existsSync(iconsDefaultDir)) {
        fs.mkdirSync(iconsDefaultDir, { recursive: true })
      }

      // 1. Install Windows & OS icons in Firefox chrome/icons/default/
      if (resolvedIcon.icoPath && fs.existsSync(resolvedIcon.icoPath)) {
        fs.copyFileSync(resolvedIcon.icoPath, path.join(iconsDefaultDir, 'main-window.ico'))
        fs.copyFileSync(resolvedIcon.icoPath, path.join(iconsDefaultDir, 'default.ico'))
      }

      if (resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'main-window.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default16.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default32.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default48.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default64.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default128.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'default256.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDefaultDir, 'about-logo.png'))
      }

      // 2. Enable toolkit.legacyUserProfileCustomizations.stylesheets in user.js
      const userJsPath = path.join(userDataDir, 'user.js')
      const prefLine = [
        'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);',
        'user_pref("app.branding.name", "AntiProfiles Firefox");',
        'user_pref("app.branding.app", "AntiProfiles Firefox");',
        'user_pref("app.branding.version", "129.0");',
        'user_pref("browser.aboutwelcome.enabled", false);',
        'user_pref("browser.newtabpage.activity-stream.showSearch", false);'
      ].join('\n') + '\n'

      if (fs.existsSync(userJsPath)) {
        const content = fs.readFileSync(userJsPath, 'utf8')
        if (!content.includes('toolkit.legacyUserProfileCustomizations.stylesheets')) {
          fs.appendFileSync(userJsPath, prefLine, 'utf8')
        }
      }

      logger.info('browser', `[Branding] Custom Firefox branding installed for profile "${profile.name}" from ${resolvedIcon.source}`)
    } catch (err: any) {
      logger.warn('browser', `[Branding] Could not setup Firefox branding: ${err.message}`)
    }
  }

  /**
   * Patch standalone or system Firefox runtime package / bundle to use custom branding.
   */
  public static patchFirefoxRuntimeBranding(executablePath?: string | null): boolean {
    try {
      const resolvedIcon = this.resolveIcon('firefox')
      if (!resolvedIcon) return false

      const targets: string[] = []
      if (executablePath) {
        targets.push(executablePath)
      } else {
        const candidates = this.findExecutableCandidates('firefox')
        targets.push(...candidates)
        try {
          const { getManagedFirefoxExecutable } = require('../firefox-downloader')
          const managed = getManagedFirefoxExecutable()
          if (managed && !targets.includes(managed)) targets.push(managed)
        } catch {}
      }

      let anyPatched = false

      for (const targetExec of targets) {
        if (!fs.existsSync(targetExec)) continue

        if (process.platform === 'darwin') {
          const appBundle = targetExec.includes('.app') ? targetExec.split('.app')[0] + '.app' : (targetExec.endsWith('.app') ? targetExec : null)
          if (appBundle && fs.existsSync(appBundle)) {
            const resDir = path.join(appBundle, 'Contents', 'Resources')
            if (fs.existsSync(resDir)) {
              if (resolvedIcon.icnsPath && fs.existsSync(resolvedIcon.icnsPath)) {
                fs.copyFileSync(resolvedIcon.icnsPath, path.join(resDir, 'firefox.icns'))
                fs.copyFileSync(resolvedIcon.icnsPath, path.join(resDir, 'document.icns'))
                const ffBinIcns = path.join(resDir, 'firefox-bin.icns')
                if (fs.existsSync(ffBinIcns)) fs.copyFileSync(resolvedIcon.icnsPath, ffBinIcns)
              }
            }
            const infoPlist = path.join(appBundle, 'Contents', 'Info.plist')
            if (fs.existsSync(infoPlist)) {
              try {
                let plistContent = fs.readFileSync(infoPlist, 'utf8')
                plistContent = plistContent.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleDisplayName</key>\n\t<string>AntiProfiles Firefox</string>')
                plistContent = plistContent.replace(/<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleName</key>\n\t<string>AntiProfiles Firefox</string>')
                fs.writeFileSync(infoPlist, plistContent, 'utf8')
              } catch {}
            }
            try {
              execSync(`touch "${appBundle}"`, { stdio: 'ignore' })
            } catch {}
            logger.info('browser', `[Branding] Patched macOS Firefox.app bundle at: ${appBundle}`)
            anyPatched = true
          }
        } else if (process.platform === 'win32') {
          const firefoxDir = fs.statSync(targetExec).isDirectory() ? targetExec : path.dirname(targetExec)
          const visDir = path.join(firefoxDir, 'browser', 'visualelements')
          if (fs.existsSync(visDir) && resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
            fs.copyFileSync(resolvedIcon.pngPath, path.join(visDir, 'VisualElements_70.png'))
            fs.copyFileSync(resolvedIcon.pngPath, path.join(visDir, 'VisualElements_150.png'))
          }
          const iconsDir = path.join(firefoxDir, 'browser', 'chrome', 'icons', 'default')
          if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
          if (resolvedIcon.icoPath && fs.existsSync(resolvedIcon.icoPath)) {
            fs.copyFileSync(resolvedIcon.icoPath, path.join(iconsDir, 'main-window.ico'))
            fs.copyFileSync(resolvedIcon.icoPath, path.join(iconsDir, 'default.ico'))
          }
          logger.info('browser', `[Branding] Patched Windows Firefox runtime at: ${firefoxDir}`)
          anyPatched = true
        } else {
          const firefoxDir = fs.statSync(targetExec).isDirectory() ? targetExec : path.dirname(targetExec)
          const iconsDir = path.join(firefoxDir, 'browser', 'chrome', 'icons', 'default')
          if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
          if (resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
            fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'main-window.png'))
            fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'default16.png'))
            fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'default32.png'))
            fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'default48.png'))
            fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'default128.png'))
          }
          logger.info('browser', `[Branding] Patched Linux Firefox runtime at: ${firefoxDir}`)
          anyPatched = true
        }
      }
      return anyPatched
    } catch (err: any) {
      logger.warn('browser', `[Branding] Could not patch Firefox runtime branding: ${err.message}`)
      return false
    }
  }

  /**
   * Patch standalone or system Chromium runtime package / bundle to use custom branding.
   */
  public static patchChromiumRuntimeBranding(executablePath?: string | null): boolean {
    try {
      const resolvedIcon = this.resolveIcon('chromium')
      if (!resolvedIcon) return false

      const targets: string[] = []
      if (executablePath) {
        targets.push(executablePath)
      } else {
        const candidates = this.findExecutableCandidates('chromium')
        targets.push(...candidates)
        try {
          const { getManagedChromiumExecutable } = require('../chromium-downloader')
          const managed = getManagedChromiumExecutable()
          if (managed && !targets.includes(managed)) targets.push(managed)
        } catch {}
      }

      let anyPatched = false

      for (const targetExec of targets) {
        if (!fs.existsSync(targetExec)) continue

        if (process.platform === 'darwin') {
          const appBundle = targetExec.includes('.app') ? targetExec.split('.app')[0] + '.app' : (targetExec.endsWith('.app') ? targetExec : null)
          if (appBundle && fs.existsSync(appBundle)) {
            const resDir = path.join(appBundle, 'Contents', 'Resources')
            if (fs.existsSync(resDir)) {
              if (resolvedIcon.icnsPath && fs.existsSync(resolvedIcon.icnsPath)) {
                fs.copyFileSync(resolvedIcon.icnsPath, path.join(resDir, 'app.icns'))
                fs.copyFileSync(resolvedIcon.icnsPath, path.join(resDir, 'document.icns'))
                const appProfileIcns = path.join(resDir, 'app_profile.icns')
                if (fs.existsSync(appProfileIcns)) {
                  fs.copyFileSync(resolvedIcon.icnsPath, appProfileIcns)
                }
                const chromeIcns = path.join(resDir, 'chrome.icns')
                if (fs.existsSync(chromeIcns)) {
                  fs.copyFileSync(resolvedIcon.icnsPath, chromeIcns)
                }
                const chromiumIcns = path.join(resDir, 'chromium.icns')
                if (fs.existsSync(chromiumIcns)) {
                  fs.copyFileSync(resolvedIcon.icnsPath, chromiumIcns)
                }
              }
            }
            const infoPlist = path.join(appBundle, 'Contents', 'Info.plist')
            if (fs.existsSync(infoPlist)) {
              try {
                let plistContent = fs.readFileSync(infoPlist, 'utf8')
                plistContent = plistContent.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleDisplayName</key>\n\t<string>AntiProfiles Chromium</string>')
                plistContent = plistContent.replace(/<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleName</key>\n\t<string>AntiProfiles Chromium</string>')
                fs.writeFileSync(infoPlist, plistContent, 'utf8')
              } catch {}
            }
            try {
              execSync(`touch "${appBundle}"`, { stdio: 'ignore' })
            } catch {}
            logger.info('browser', `[Branding] Patched macOS Chromium .app bundle at: ${appBundle}`)
            anyPatched = true
          }
        } else if (process.platform === 'win32') {
          const chromeDir = fs.statSync(targetExec).isDirectory() ? targetExec : path.dirname(targetExec)
          const visDir = path.join(chromeDir, 'VisualElements')
          if (!fs.existsSync(visDir)) {
            try { fs.mkdirSync(visDir, { recursive: true }) } catch {}
          }
          if (fs.existsSync(visDir) && resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
            fs.copyFileSync(resolvedIcon.pngPath, path.join(visDir, 'VisualElements_70.png'))
            fs.copyFileSync(resolvedIcon.pngPath, path.join(visDir, 'VisualElements_150.png'))
          }
          if (resolvedIcon.icoPath && fs.existsSync(resolvedIcon.icoPath)) {
            fs.copyFileSync(resolvedIcon.icoPath, path.join(chromeDir, 'app.ico'))
          }
          logger.info('browser', `[Branding] Patched Windows Chromium runtime at: ${chromeDir}`)
          anyPatched = true
        } else {
          const chromeDir = fs.statSync(targetExec).isDirectory() ? targetExec : path.dirname(targetExec)
          const desktopPath = path.join(chromeDir, 'antiprofiles-chromium.desktop')
          const desktopContent = `[Desktop Entry]\nVersion=1.0\nName=AntiProfiles Chromium\nExec="${targetExec}" %U\nIcon=${resolvedIcon.pngPath || 'chromium'}\nType=Application\nCategories=Network;WebBrowser;\n`
          try {
            fs.writeFileSync(desktopPath, desktopContent, 'utf8')
          } catch {}
          logger.info('browser', `[Branding] Patched Linux Chromium runtime at: ${chromeDir}`)
          anyPatched = true
        }
      }
      return anyPatched
    } catch (err: any) {
      logger.warn('browser', `[Branding] Could not patch Chromium runtime branding: ${err.message}`)
      return false
    }
  }

  /**
   * Setup Chromium profile-level branding assets.
   */
  public static setupChromiumBranding(userDataDir: string, profile: Profile): void {
    try {
      const resolvedIcon = this.resolveIcon('chromium', profile)
      const brandingDir = path.join(userDataDir, 'branding')
      if (!fs.existsSync(brandingDir)) {
        fs.mkdirSync(brandingDir, { recursive: true })
      }

      if (resolvedIcon.icoPath && fs.existsSync(resolvedIcon.icoPath)) {
        fs.copyFileSync(resolvedIcon.icoPath, path.join(brandingDir, 'app.ico'))
      }

      if (resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
        fs.copyFileSync(resolvedIcon.pngPath, path.join(brandingDir, 'app.png'))
        fs.copyFileSync(resolvedIcon.pngPath, path.join(brandingDir, 'icon-128.png'))
      }

      logger.info('browser', `[Branding] Custom Chromium profile branding provisioned for "${profile.name}" from ${resolvedIcon.source}`)
    } catch (err: any) {
      logger.warn('browser', `[Branding] Could not setup Chromium branding: ${err.message}`)
    }
  }

  /**
   * Get Chromium launch arguments for custom branding / Windows AppUserModelID.
   * Note: Never pass --app-id (reserved for installed PWAs which crashes Chromium if not found)
   * or non-standard --window-icon / --class flags.
   */
  public static getChromiumBrandingArgs(profile: Profile): string[] {
    const args: string[] = []

    // Set Windows AppUserModelID for taskbar grouping without triggering PWA app-mode crash
    if (process.platform === 'win32' && profile?.id) {
      args.push(`--app-user-model-id=antiprofiles.browser.${profile.id}`)
    }

    return args
  }

  /**
   * Get overall branding configuration for admin / settings panel.
   */
  public static getBrandingConfig(): BrandingConfig {
    const customDir = this.getCustomBrandingDir()

    const checkEngine = (engine: 'chromium' | 'firefox' | 'app') => {
      const customPng = path.join(customDir, `${engine}.png`)
      const isCustom = fs.existsSync(customPng)
      let updatedAt: string | undefined
      let previewUrl = ''

      if (isCustom) {
        // Use the actual custom-uploaded icon as the preview
        previewUrl = this.pathToDataUrl(customPng)
        try {
          updatedAt = fs.statSync(customPng).mtime.toISOString()
        } catch {}
      } else {
        // Fall back to resolveIcon for the default/bundled icon
        const icon = this.resolveIcon(engine === 'app' ? 'chromium' : engine)
        previewUrl = icon.dataUrl || ''
      }

      return {
        isCustom,
        previewUrl,
        updatedAt
      }
    }

    return {
      chromium: checkEngine('chromium'),
      firefox: checkEngine('firefox'),
      app: checkEngine('app')
    }
  }

  /**
   * Upload and process a custom icon for an engine or application.
   */
  public static async uploadCustomIcon(
    target: BrandingTarget,
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
    try {
      const customDir = this.getCustomBrandingDir()
      const scratchDir = path.join(customDir, 'scratch')
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true })
      }

      const tempIn = path.join(scratchDir, `upload_${Date.now()}_${path.basename(filename)}`)
      fs.writeFileSync(tempIn, fileBuffer)

      const targetPng = path.join(customDir, `${target}.png`)
      const targetIco = path.join(customDir, `${target}.ico`)
      const targetIcns = path.join(customDir, `${target}.icns`)

      // Convert to multi-resolution PNG and ICO
      if (process.platform === 'darwin') {
        try {
          execSync(`sips -z 512 512 -s format png "${tempIn}" --out "${targetPng}"`, { stdio: 'ignore' })
        } catch {
          fs.copyFileSync(tempIn, targetPng)
        }
      } else {
        fs.copyFileSync(tempIn, targetPng)
      }

      // Generate multi-size .ico
      this.generateIcoFromPng(targetPng, targetIco)

      // Generate native macOS .icns
      if (process.platform === 'darwin') {
        this.generateIcnsFromPng(targetPng, targetIcns)
      }

      // Clean temp
      try {
        fs.unlinkSync(tempIn)
      } catch {}

      // Update settings in database
      const db = getDatabase()
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        `branding_${target}_custom`,
        'true'
      )

      // Patch existing standalone runtime packages with the new custom icon
      if (target === 'firefox') {
        this.patchFirefoxRuntimeBranding()
      } else if (target === 'chromium') {
        this.patchChromiumRuntimeBranding()
      } else if (target === 'app') {
        // 'app' target affects both engines
        this.patchChromiumRuntimeBranding()
        this.patchFirefoxRuntimeBranding()
      }

      const previewUrl = this.pathToDataUrl(targetPng)
      logger.info('admin', `[Branding] Successfully updated custom branding icon for: ${target}`)

      this.broadcastBrandingChange()
      return { success: true, previewUrl }
    } catch (err: any) {
      logger.error('admin', `[Branding] Failed to upload custom icon for ${target}: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  /**
   * Reset custom icon to bundled default.
   */
  public static resetCustomIcon(target: BrandingTarget): { success: boolean; previewUrl?: string } {
    try {
      const customDir = this.getCustomBrandingDir()
      const files = [`${target}.png`, `${target}.ico`, `${target}.icns`]

      for (const f of files) {
        const p = path.join(customDir, f)
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p)
          } catch {}
        }
      }

      const db = getDatabase()
      db.prepare('DELETE FROM settings WHERE key = ?').run(`branding_${target}_custom`)

      // Re-patch runtimes with bundled default icon
      if (target === 'firefox' || target === 'app') {
        this.patchFirefoxRuntimeBranding()
      }
      if (target === 'chromium' || target === 'app') {
        this.patchChromiumRuntimeBranding()
      }

      const defaultIcon = this.resolveIcon(target === 'app' ? 'chromium' : target)
      logger.info('admin', `[Branding] Restored default branding icon for: ${target}`)

      this.broadcastBrandingChange()
      return { success: true, previewUrl: defaultIcon.dataUrl }
    } catch (err: any) {
      logger.error('admin', `[Branding] Failed to reset custom icon for ${target}: ${err.message}`)
      return { success: false }
    }
  }

  /**
   * Broadcast branding updates in realtime to all active Electron windows.
   */
  public static broadcastBrandingChange(): void {
    try {
      const config = this.getBrandingConfig()
      const { BrowserWindow } = require('electron')
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send('branding:updated', config)
        }
      }
    } catch {}
  }

  /**
   * Set a custom icon for a specific profile.
   */
  public static async setProfileIcon(
    profileId: string,
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
    try {
      const profileDir = this.getProfileIconsDir()
      const targetPng = path.join(profileDir, `${profileId}.png`)
      const targetIco = path.join(profileDir, `${profileId}.ico`)
      const tempIn = path.join(profileDir, `temp_${profileId}_${Date.now()}`)

      fs.writeFileSync(tempIn, fileBuffer)

      if (process.platform === 'darwin') {
        try {
          execSync(`sips -z 256 256 -s format png "${tempIn}" --out "${targetPng}"`, { stdio: 'ignore' })
        } catch {
          fs.copyFileSync(tempIn, targetPng)
        }
      } else {
        fs.copyFileSync(tempIn, targetPng)
      }

      this.generateIcoFromPng(targetPng, targetIco)

      try {
        fs.unlinkSync(tempIn)
      } catch {}

      // Update profile record icon field
      const db = getDatabase()
      db.prepare('UPDATE profiles SET icon = ? WHERE id = ?').run(`custom:${profileId}`, profileId)

      const previewUrl = this.pathToDataUrl(targetPng)
      this.broadcastBrandingChange()
      return { success: true, previewUrl }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  /**
   * Reset profile custom icon.
   */
  public static resetProfileIcon(profileId: string): { success: boolean } {
    try {
      const profileDir = this.getProfileIconsDir()
      const files = [`${profileId}.png`, `${profileId}.ico`, `${profileId}.icns`]
      for (const f of files) {
        const p = path.join(profileDir, f)
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p)
          } catch {}
        }
      }

      const db = getDatabase()
      db.prepare('UPDATE profiles SET icon = ? WHERE id = ?').run('', profileId)
      this.broadcastBrandingChange()
      return { success: true }
    } catch (err: any) {
      return { success: false }
    }
  }

  /**
   * Helper to build a multi-resolution ICO file from a base PNG.
   */
  private static generateIcoFromPng(sourcePng: string, targetIco: string): void {
    try {
      if (!fs.existsSync(sourcePng)) return
      const icoSizes = [16, 24, 32, 48, 64, 128, 256]
      const pngBuffers: { size: number; buffer: Buffer }[] = []

      for (const sz of icoSizes) {
        if (process.platform === 'darwin') {
          const tempPng = `${sourcePng}_${sz}.png`
          try {
            execSync(`sips -z ${sz} ${sz} -s format png "${sourcePng}" --out "${tempPng}"`, { stdio: 'ignore' })
            if (fs.existsSync(tempPng)) {
              pngBuffers.push({ size: sz, buffer: fs.readFileSync(tempPng) })
              fs.unlinkSync(tempPng)
            }
          } catch {}
        }
      }

      if (pngBuffers.length === 0) {
        pngBuffers.push({ size: 256, buffer: fs.readFileSync(sourcePng) })
      }

      const icoBuf = this.createIcoBuffer(pngBuffers)
      fs.writeFileSync(targetIco, icoBuf)
    } catch (err: any) {
      logger.warn('system', `Could not generate ICO: ${err.message}`)
    }
  }

  /**
   * Helper to build a native macOS ICNS file with 16 to 1024 Retina resolutions.
   */
  private static generateIcnsFromPng(sourcePng: string, targetIcns: string): void {
    if (process.platform !== 'darwin') return
    try {
      if (!fs.existsSync(sourcePng)) return
      const customDir = this.getCustomBrandingDir()
      const iconsetDir = path.join(customDir, `temp_${Date.now()}.iconset`)
      if (fs.existsSync(iconsetDir)) fs.rmSync(iconsetDir, { recursive: true, force: true })
      fs.mkdirSync(iconsetDir, { recursive: true })

      const sizes = [
        { name: 'icon_16x16.png', size: 16 },
        { name: 'icon_16x16@2x.png', size: 32 },
        { name: 'icon_32x32.png', size: 32 },
        { name: 'icon_32x32@2x.png', size: 64 },
        { name: 'icon_128x128.png', size: 128 },
        { name: 'icon_128x128@2x.png', size: 256 },
        { name: 'icon_256x256.png', size: 256 },
        { name: 'icon_256x256@2x.png', size: 512 },
        { name: 'icon_512x512.png', size: 512 },
        { name: 'icon_512x512@2x.png', size: 1024 }
      ]

      for (const s of sizes) {
        const outPath = path.join(iconsetDir, s.name)
        execSync(`sips -z ${s.size} ${s.size} -s format png "${sourcePng}" --out "${outPath}"`, { stdio: 'ignore' })
      }

      execSync(`iconutil -c icns "${iconsetDir}" -o "${targetIcns}"`, { stdio: 'ignore' })
      fs.rmSync(iconsetDir, { recursive: true, force: true })
    } catch (err: any) {
      logger.warn('system', `Could not generate ICNS: ${err.message}`)
    }
  }

  private static createIcoBuffer(images: { size: number; buffer: Buffer }[]): Buffer {
    const count = images.length
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(count, 4)

    const dirEntries: Buffer[] = []
    let offset = 6 + count * 16

    for (const img of images) {
      const entry = Buffer.alloc(16)
      const sz = img.size >= 256 ? 0 : img.size
      entry.writeUInt8(sz, 0)
      entry.writeUInt8(sz, 1)
      entry.writeUInt8(0, 2)
      entry.writeUInt8(0, 3)
      entry.writeUInt16LE(1, 4)
      entry.writeUInt16LE(32, 6)
      entry.writeUInt32LE(img.buffer.length, 8)
      entry.writeUInt32LE(offset, 12)
      dirEntries.push(entry)
      offset += img.buffer.length
    }

    return Buffer.concat([header, ...dirEntries, ...images.map(i => i.buffer)])
  }

  private static pathToDataUrl(filePath?: string): string {
    if (!filePath || !fs.existsSync(filePath)) return ''
    try {
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.ico' ? 'image/x-icon' : 'image/png'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return ''
    }
  }
}
