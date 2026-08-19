// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Firefox Profile Runtime WebExtension Builder
// Auto-generates an isolated WebExtension inside the profile directory
// to inject resolved DOM, Screen, WebGL, and Hardware parameters at document_start
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { ResolvedFirefoxProfile } from './firefox-resolver'
import { buildInjectionScript } from '../injection/injector'
import { logger } from '../../logging/logger'

import { BrowserIconManager } from '../branding/browser-icon-manager'

/**
 * Builds and installs the AntiProfiles Runtime Isolation WebExtension
 * directly into the Firefox profile's extension directory.
 */
export function installFirefoxRuntimeExtension(
  userDataDir: string,
  resolvedProfile: ResolvedFirefoxProfile
): string {
  const resolvedDir = path.resolve(userDataDir)
  const extensionDir = path.join(resolvedDir, 'extensions', 'antiprofiles-guard@antiprofiles.com')

  try {
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true, mode: 0o755 })
    }

    // 1. Build the JavaScript injection payload
    const rawInjectionPayload = buildInjectionScript(resolvedProfile.fingerprint, 'firefox')

    // 2. Create the content-bridge.js script
    const contentBridgeJs = `// AntiProfiles Firefox Runtime Content Bridge
(function() {
  'use strict';
  try {
    const code = ${JSON.stringify(rawInjectionPayload)};
    const scriptEl = document.createElement('script');
    scriptEl.textContent = code;
    (document.head || document.documentElement).appendChild(scriptEl);
    scriptEl.remove();
  } catch (err) {
    // Silent fail
  }
})();
`

    // 3. Icons provisioning
    const iconsDir = path.join(extensionDir, 'icons')
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true })
    }
    const resolvedIcon = BrowserIconManager.resolveIcon('firefox', resolvedProfile.profile)
    if (resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
      fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'icon-16.png'))
      fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'icon-48.png'))
      fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'icon-128.png'))
    }

    // 4. Manifest v2 (Compatible across all Firefox Quantum / ESR versions)
    const manifest = {
      manifest_version: 2,
      name: 'AntiProfiles Runtime Isolation Guard',
      version: '1.0.0',
      description: 'Applies resolved profile fingerprint parameters to web pages at runtime',
      icons: {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png'
      },
      applications: {
        gecko: {
          id: 'antiprofiles-guard@antiprofiles.com',
          strict_min_version: '115.0'
        }
      },
      browser_specific_settings: {
        gecko: {
          id: 'antiprofiles-guard@antiprofiles.com',
          strict_min_version: '115.0'
        }
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content-bridge.js'],
          run_at: 'document_start',
          all_frames: true,
          match_about_blank: true
        }
      ],
      permissions: ['<all_urls>']
    }

    fs.writeFileSync(path.join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
    fs.writeFileSync(path.join(extensionDir, 'content-bridge.js'), contentBridgeJs, 'utf8')

    logger.info('browser', `[FirefoxExtension] Installed runtime isolation extension in: ${extensionDir}`)
    return extensionDir
  } catch (err: any) {
    logger.warn('browser', `[FirefoxExtension] Failed to build runtime extension: ${err.message}`)
    return ''
  }
}
