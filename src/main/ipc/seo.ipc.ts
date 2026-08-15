// ──────────────────────────────────────────────
// ProfileVault — IPC Handlers for SEO & AEO Management System
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { seoRepo } from '../database/repositories/seo.repo'
import { seoService } from '../services/seo.service'
import { authorizeUser } from '../security/session'
import { logger } from '../logging/logger'

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any) {
  try {
    ipcMain.removeHandler(channel)
  } catch {}
  try {
    ipcMain.handle(channel, listener)
  } catch (err: any) {
    console.error(`Failed to register IPC handler for ${channel}:`, err.message)
  }
}

export function registerSeoHandlers(): void {
  // Get Global SEO Settings
  safeHandle('seo:get-settings', async (_event, sessionToken?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      return { success: true, data: seoRepo.getSettings() }
    } catch (err: any) {
      logger.error('api', `Failed to get SEO settings: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // Save Global SEO Settings
  safeHandle('seo:save-settings', async (_event, sessionToken: string, settings: Record<string, string>) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      seoRepo.saveSettings(settings)
      return { success: true, data: seoRepo.getSettings() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Page SEO List
  safeHandle('seo:get-pages', async (_event, sessionToken?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      return { success: true, data: seoRepo.getAllPageSeo() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Save Page SEO Entry
  safeHandle('seo:save-page', async (_event, sessionToken: string, pageData: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const saved = seoRepo.savePageSeo(pageData)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete Page SEO Entry
  safeHandle('seo:delete-page', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      seoRepo.deletePageSeo(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Keywords List
  safeHandle('seo:get-keywords', async (_event, sessionToken?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const keywords = seoRepo.getKeywords()
      const warnings = seoRepo.findCannibalizationWarnings()
      return { success: true, data: { keywords, warnings } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Save Keyword
  safeHandle('seo:save-keyword', async (_event, sessionToken: string, kwData: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const saved = seoRepo.saveKeyword(kwData)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete Keyword
  safeHandle('seo:delete-keyword', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      seoRepo.deleteKeyword(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Redirects List
  safeHandle('seo:get-redirects', async (_event, sessionToken?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      return { success: true, data: seoRepo.getRedirects() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Save Redirect
  safeHandle('seo:save-redirect', async (_event, sessionToken: string, redData: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const saved = seoRepo.saveRedirect(redData)
      return { success: true, data: saved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete Redirect
  safeHandle('seo:delete-redirect', async (_event, sessionToken: string, id: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      seoRepo.deleteRedirect(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get 404 Error Logs
  safeHandle('seo:get-404-logs', async (_event, sessionToken?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      return { success: true, data: seoRepo.get404Logs() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Run Site Audit
  safeHandle('seo:run-audit', async (_event, sessionToken: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const report = seoService.runSiteAudit()
      return { success: true, data: report }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Latest Site Audit
  safeHandle('seo:get-latest-audit', async (_event, sessionToken?: string) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const report = seoRepo.getLatestAuditReport() || seoService.runSiteAudit()
      return { success: true, data: report }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Content Assistant Generator
  safeHandle('seo:generate-content-assistant', async (_event, sessionToken: string, params: any) => {
    try {
      const auth = authorizeUser(sessionToken)
      if (auth.error || !auth.user || auth.user.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }
      const result = seoService.generateContentAssistant(params)
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Sitemap XML
  safeHandle('seo:get-sitemap-xml', async (_event) => {
    try {
      return { success: true, data: seoService.generateSitemapXml() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get LLMS.txt
  safeHandle('seo:get-llms-txt', async (_event) => {
    try {
      return { success: true, data: seoService.generateLlmsTxt() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
