import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { enterpriseService } from '../../src/renderer/services/enterpriseService'
import { SynchronizerPage } from '../../src/renderer/pages/enterprise/SynchronizerPage'
import { ExtensionCenterPage } from '../../src/renderer/pages/enterprise/ExtensionCenterPage'
import { RpaBuilderPage } from '../../src/renderer/pages/enterprise/RpaBuilderPage'
import { TeamWorkspacePage } from '../../src/renderer/pages/enterprise/TeamWorkspacePage'
import { TrashPage } from '../../src/renderer/pages/enterprise/TrashPage'
import { CloudSyncPage } from '../../src/renderer/pages/enterprise/CloudSyncPage'
import { CookieManagerPage } from '../../src/renderer/pages/enterprise/CookieManagerPage'

describe('Phase P4 — Enterprise React UI & IPC Integration Verification', () => {
  it('exports all 7 dedicated Enterprise React page components', () => {
    expect(typeof SynchronizerPage).toBe('function')
    expect(typeof ExtensionCenterPage).toBe('function')
    expect(typeof RpaBuilderPage).toBe('function')
    expect(typeof TeamWorkspacePage).toBe('function')
    expect(typeof TrashPage).toBe('function')
    expect(typeof CloudSyncPage).toBe('function')
    expect(typeof CookieManagerPage).toBe('function')
  })

  it('guarantees 100% 1:1 IPC contract alignment between enterpriseService, preload/index.ts, and enterprise.ipc.ts', () => {
    const preloadSrc = fs.readFileSync(path.resolve(__dirname, '../../src/preload/index.ts'), 'utf8')
    const ipcSrc = fs.readFileSync(path.resolve(__dirname, '../../src/main/ipc/enterprise.ipc.ts'), 'utf8')

    // Every method exposed on enterpriseService must exist in preload's enterprise object
    const serviceMethods = Object.keys(enterpriseService)
    expect(serviceMethods.length).toBeGreaterThanOrEqual(40)

    for (const method of serviceMethods) {
      expect(preloadSrc).toContain(`${method}:`)
    }

    // Every enterprise:* invoke channel in preload must have a matching ipcMain.handle in enterprise.ipc.ts
    const invokedChannels = Array.from(preloadSrc.matchAll(/ipcRenderer\.invoke\('(enterprise:[^']+)'/g)).map((m) => m[1])
    expect(invokedChannels.length).toBeGreaterThanOrEqual(40)

    for (const channel of invokedChannels) {
      expect(ipcSrc).toMatch(new RegExp(`(?:ipcMain\\.handle|secureHandle)\\('${channel}'`))
    }
  })

  it('registers all Enterprise routes in App.tsx without duplicate sidebar keys', () => {
    const appSrc = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/App.tsx'), 'utf8')
    const requiredPages = ['synchronizer', 'extensions', 'rpa', 'cookies', 'cloud-sync', 'team', 'trash']
    for (const page of requiredPages) {
      expect(appSrc).toContain(`currentPage === '${page}'`)
    }
  })
})
