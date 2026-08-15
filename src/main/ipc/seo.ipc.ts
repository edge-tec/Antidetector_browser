// ──────────────────────────────────────────────
// ProfileVault — IPC Handlers for SEO & AEO Management System
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { seoRepo } from '../database/repositories/seo.repo'
import { seoService } from '../services/seo.service'
import { authorizeUser } from '../security/session'
import { logger } from '../logging/logger'

export function registerSeoHandlers(): void {
  // Get Global SEO Settings
  ipcMain.handle('seo:get-settings', async (_event, sessionToken?: string) => {
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
  ipcMain.handle('seo:save-settings', async (_event, sessionToken: string, settings: Record<string, string>) => {
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
  ipcMain.handle('seo:get-pages', async (_event, sessionToken?: string) => {
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
  ipcMain.handle('seo:save-page', async (_event, sessionToken: string, pageData: any) => {
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
  ipcMain.handle('seo:delete-page', async (_event, sessionToken: string, id: string) => {
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
  ipcMain.handle('seo:get-keywords', async (_event, sessionToken?: string) => {
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
  ipcMain.handle('seo:save-keyword', async (_event, sessionToken: string, kwData: any) => {
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
  ipcMain.handle('seo:delete-keyword', async (_event, sessionToken: string, id: string) => {
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
  ipcMain.handle('seo:get-redirects', async (_event, sessionToken?: string) => {
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
  ipcMain.handle('seo:save-redirect', async (_event, sessionToken: string, redData: any) => {
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
  ipcMain.handle('seo:delete-redirect', async (_event, sessionToken: string, id: string) => {
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
  ipcMain.handle('seo:get-404-logs', async (_event, sessionToken?: string) => {
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
  ipcMain.handle('seo:run-audit', async (_event, sessionToken: string) => {
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
  ipcMain.handle('seo:get-latest-audit', async (_event, sessionToken?: string) => {
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
  ipcMain.handle('seo:generate-content-assistant', async (_event, sessionToken: string, params: any) => {
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
  ipcMain.handle('seo:get-sitemap-xml', async (_event) => {
    try {
      return { success: true, data: seoService.generateSitemapXml() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get LLMS.txt
  ipcMain.handle('seo:get-llms-txt', async (_event) => {
    try {
      return { success: true, data: seoService.generateLlmsTxt() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
