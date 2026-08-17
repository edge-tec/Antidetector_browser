// ──────────────────────────────────────────────
// AntiProfiles — Landing Page & CMS IPC Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { landingRepo } from '../database/repositories/landing.repo'
import { authorizeUser } from '../security/session'
import { logger } from '../logging/logger'

export function setupLandingIPC(): void {
  // Public Landing Page Data Fetcher
  ipcMain.handle('landing:get-public-data', async () => {
    try {
      const data = landingRepo.getPublicData()
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Update Branding Settings
  ipcMain.handle('landing:admin-update-branding', async (_event, sessionToken: string, entries: Record<string, string>) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const updated = landingRepo.updateBranding(entries)
      logger.info('admin', `Admin "${auth.user.email}" updated branding settings`)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Update Hero Section
  ipcMain.handle('landing:admin-update-hero', async (_event, sessionToken: string, heroData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const updated = landingRepo.updateHero(heroData)
      logger.info('admin', `Admin "${auth.user.email}" updated landing hero section`)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Save Pricing Plan (Create / Edit)
  ipcMain.handle('landing:admin-save-plan', async (_event, sessionToken: string, planData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const plans = landingRepo.savePricingPlan(planData)
      logger.info('admin', `Admin "${auth.user.email}" saved pricing plan "${planData.name}"`)
      return { success: true, data: plans }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Delete Pricing Plan
  ipcMain.handle('landing:admin-delete-plan', async (_event, sessionToken: string, planId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      landingRepo.deletePricingPlan(planId)
      logger.info('admin', `Admin "${auth.user.email}" deleted pricing plan "${planId}"`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Save FAQ
  ipcMain.handle('landing:admin-save-faq', async (_event, sessionToken: string, faqData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      landingRepo.saveFaq(faqData)
      logger.info('admin', `Admin "${auth.user.email}" saved FAQ "${faqData.question}"`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Delete FAQ
  ipcMain.handle('landing:admin-delete-faq', async (_event, sessionToken: string, faqId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      landingRepo.deleteFaq(faqId)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Save Testimonial
  ipcMain.handle('landing:admin-save-testimonial', async (_event, sessionToken: string, testimonialData: any) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      landingRepo.saveTestimonial(testimonialData)
      logger.info('admin', `Admin "${auth.user.email}" saved testimonial for "${testimonialData.name}"`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Delete Testimonial
  ipcMain.handle('landing:admin-delete-testimonial', async (_event, sessionToken: string, testimonialId: string) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      landingRepo.deleteTestimonial(testimonialId)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Admin Update SEO Settings
  ipcMain.handle('landing:admin-update-seo', async (_event, sessionToken: string, entries: Record<string, string>) => {
    const auth = authorizeUser(sessionToken, { requireAdmin: true })
    if (auth.error || !auth.user) {
      return { success: false, error: auth.error || 'Admin access required.' }
    }

    try {
      const updated = landingRepo.updateSeo(entries)
      logger.info('admin', `Admin "${auth.user.email}" updated SEO settings`)
      return { success: true, data: updated }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
