// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Chromium Profile Runtime Extension Builder
// Auto-generates an unpacked Manifest V3 extension inside the profile directory
// to inject resolved DOM, Navigator, Screen, WebGL, and Hardware parameters
// at document_start in the MAIN world.
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { Fingerprint } from '../../fingerprint/types'
import { buildInjectionScript } from '../injection/injector'
import { logger } from '../../logging/logger'
import { BrowserIconManager } from '../branding/browser-icon-manager'

/**
 * Builds and installs the AntiProfiles Runtime Isolation Extension
 * directly into the Chromium profile's unpacked extension directory.
 */
export function installChromiumRuntimeExtension(
  userDataDir: string,
  fingerprint: Fingerprint,
  profileInfo?: { id: string; name: string; browserVersion?: string }
): string {
  const resolvedDir = path.resolve(userDataDir)
  const extensionDir = path.join(resolvedDir, 'antiprofiles-guard-extension')

  try {
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true, mode: 0o755 })
    }

    // 1. Build the JavaScript injection payload
    const rawInjectionPayload = buildInjectionScript(fingerprint, 'chrome')

    // 2. Create content-bridge.js script with world: MAIN and fallback DOM injection
    const contentBridgeJs = `// AntiProfiles Chromium Runtime Content Bridge
(function() {
  'use strict';
  try {
    ${rawInjectionPayload}
  } catch (err) {}

  // Fallback injector for dynamic iframes or shadow trees
  var code = ${JSON.stringify(rawInjectionPayload)};
  function inject() {
    try {
      var target = document.documentElement || document.head || document.body;
      if (target) {
        var scriptEl = document.createElement('script');
        scriptEl.textContent = code;
        target.appendChild(scriptEl);
        scriptEl.remove();
        return true;
      }
    } catch (err) {}
    return false;
  }

  if (document.readyState === 'loading') {
    var observer = new MutationObserver(function(mutations, obs) {
      if (document.documentElement || document.head || document.body) {
        obs.disconnect();
        inject();
      }
    });
    try {
      observer.observe(document, { childList: true, subtree: true });
    } catch (e) {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    }
  }
})();
`

    // 3. Icons provisioning
    const iconsDir = path.join(extensionDir, 'icons')
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true })
    }
    if (profileInfo) {
      const resolvedIcon = BrowserIconManager.resolveIcon('chromium', {
        id: profileInfo.id,
        name: profileInfo.name,
        browserVersion: profileInfo.browserVersion
      } as any)
      if (resolvedIcon.pngPath && fs.existsSync(resolvedIcon.pngPath)) {
        try {
          fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'icon-16.png'))
          fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'icon-48.png'))
          fs.copyFileSync(resolvedIcon.pngPath, path.join(iconsDir, 'icon-128.png'))
        } catch {}
      }
    }

    // 4. Manifest V3 unpacked extension
    const manifest = {
      manifest_version: 3,
      name: 'AntiProfiles Runtime Isolation Guard',
      version: '1.0.0',
      description: 'Applies resolved profile fingerprint parameters to web pages at runtime',
      icons: {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png'
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content-bridge.js'],
          run_at: 'document_start',
          all_frames: true,
          match_about_blank: true,
          world: 'MAIN'
        }
      ]
    }

    fs.writeFileSync(path.join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
    fs.writeFileSync(path.join(extensionDir, 'content-bridge.js'), contentBridgeJs, 'utf8')

    logger.info('browser', `[ChromiumExtension] Installed runtime isolation extension in: ${extensionDir}`)
    return extensionDir
  } catch (err: any) {
    logger.warn('browser', `[ChromiumExtension] Failed to build runtime extension: ${err.message}`)
    return ''
  }
}
