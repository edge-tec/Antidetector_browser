// ──────────────────────────────────────────────
// AntiProfiles — Preload Script (contextBridge)
// ──────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron'

export type IpcApi = typeof api

function getSavedToken(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('pv_session_token') || ''
    }
  } catch {}
  return ''
}

const api = {
  // ── Authentication ──
  registerUser: (input: any) => ipcRenderer.invoke('auth:register', input),
  loginUser: (input: any) => ipcRenderer.invoke('auth:login', input),
  googleLogin: (payload: any) => ipcRenderer.invoke('auth:google-login', payload),
  verifyEmail: (token: string) => ipcRenderer.invoke('auth:verify-email', token),
  resendVerification: (email: string) => ipcRenderer.invoke('auth:resend-verification', email),
  forgotPassword: (email: string) => ipcRenderer.invoke('auth:forgot-password', email),
  resetPassword: (token: string, newPassword: string) => ipcRenderer.invoke('auth:reset-password', { token, newPassword }),
  getCurrentUser: (token: string) => ipcRenderer.invoke('auth:get-current-user', token),
  logoutUser: (token: string) => ipcRenderer.invoke('auth:logout', token),

  // ── Admin Management ──
  adminGetUsers: (token: string, filter?: any) => ipcRenderer.invoke('admin:get-users', token, filter),
  adminCreateUser: (token: string, input: any) => ipcRenderer.invoke('admin:create-user', token, input),
  adminUpdateUserStatus: (token: string, userId: string, data: any) => ipcRenderer.invoke('admin:update-user-status', token, userId, data),
  adminDeleteUser: (token: string, userId: string) => ipcRenderer.invoke('admin:delete-user', token, userId),
  adminResendVerification: (token: string, userId: string) => ipcRenderer.invoke('admin:resend-verification', token, userId),
  adminGetUserProfiles: (token: string, userId: string) => ipcRenderer.invoke('admin:get-user-profiles', token, userId),
  adminGetAuditLogs: (token: string, limit?: number) => ipcRenderer.invoke('admin:get-audit-logs', token, limit),
  adminImpersonateUser: (token: string, targetUserId: string) => ipcRenderer.invoke('admin:impersonate-user', token, targetUserId),
  adminGetSmtpConfig: (token: string) => ipcRenderer.invoke('admin:get-smtp-config', token),
  adminSaveSmtpConfig: (token: string, config: any) => ipcRenderer.invoke('admin:save-smtp-config', token, config),
  adminTestSmtpConfig: (token: string, config: any) => ipcRenderer.invoke('admin:test-smtp-config', token, config),
  adminSendEmailBroadcast: (token: string, payload: any) => ipcRenderer.invoke('admin:send-email-broadcast', token, payload),

  // ── Landing CMS ──
  getPublicLandingData: () => ipcRenderer.invoke('landing:get-public-data'),
  adminUpdateBranding: (token: string, entries: Record<string, string>) => ipcRenderer.invoke('landing:admin-update-branding', token, entries),
  adminUpdateHero: (token: string, heroData: any) => ipcRenderer.invoke('landing:admin-update-hero', token, heroData),
  adminSavePlan: (token: string, planData: any) => ipcRenderer.invoke('landing:admin-save-plan', token, planData),
  adminDeletePlan: (token: string, planId: string) => ipcRenderer.invoke('landing:admin-delete-plan', token, planId),
  adminSaveFaq: (token: string, faqData: any) => ipcRenderer.invoke('landing:admin-save-faq', token, faqData),
  adminDeleteFaq: (token: string, faqId: string) => ipcRenderer.invoke('landing:admin-delete-faq', token, faqId),
  adminSaveTestimonial: (token: string, data: any) => ipcRenderer.invoke('landing:admin-save-testimonial', token, data),
  adminDeleteTestimonial: (token: string, id: string) => ipcRenderer.invoke('landing:admin-delete-testimonial', token, id),
  adminUpdateSeo: (token: string, entries: Record<string, string>) => ipcRenderer.invoke('landing:admin-update-seo', token, entries),

  // ── Subscriptions & Licensing ──
  getLicenseStatus: (token: string, installationId?: string, platform?: string, appVersion?: string) =>
    ipcRenderer.invoke('subscription:get-license-status', token, installationId, platform, appVersion),
  getUserDevices: (token: string) => ipcRenderer.invoke('subscription:get-user-devices', token),
  revokeDevice: (token: string, installationId: string) => ipcRenderer.invoke('subscription:revoke-device', token, installationId),
  getAppReleases: () => ipcRenderer.invoke('subscription:get-app-releases'),
  adminGetSubscriptions: (token: string, filter?: any) => ipcRenderer.invoke('admin:get-subscriptions', token, filter),
  adminUpdateUserSubscription: (token: string, targetUserId: string, data: any) =>
    ipcRenderer.invoke('admin:update-user-subscription', token, targetUserId, data),
  adminGetDesktopAppConfig: (token: string) => ipcRenderer.invoke('admin:get-desktop-app-config', token),
  adminSaveDesktopAppConfig: (token: string, config: Record<string, string>) =>
    ipcRenderer.invoke('admin:save-desktop-app-config', token, config),

  // ── Profiles ──
  getProfiles: (sessionTokenOrSearch?: string, maybeSearch?: string, groupId?: string, status?: string) => {
    let token = getSavedToken()
    let search = maybeSearch
    const gid = groupId
    const stat = status

    if (sessionTokenOrSearch !== undefined && maybeSearch !== undefined) {
      token = sessionTokenOrSearch || getSavedToken()
      search = maybeSearch
    } else if (sessionTokenOrSearch !== undefined) {
      const saved = getSavedToken()
      if (
        sessionTokenOrSearch === saved ||
        sessionTokenOrSearch.includes('.') ||
        sessionTokenOrSearch.length >= 30 ||
        sessionTokenOrSearch.startsWith('mock-') ||
        sessionTokenOrSearch.startsWith('impersonate_') ||
        sessionTokenOrSearch.startsWith('usr_') ||
        sessionTokenOrSearch === 'admin-default'
      ) {
        token = sessionTokenOrSearch
        search = undefined
      } else {
        search = sessionTokenOrSearch
        token = saved
      }
    }
    return ipcRenderer.invoke('profiles:getAll', token, search, gid, stat)
  },
  getProfile: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('profiles:getById', token, id)
  },
  createProfile: (sessionTokenOrInput: any, maybeInput?: any) => {
    const input = maybeInput !== undefined ? maybeInput : sessionTokenOrInput
    const token = typeof sessionTokenOrInput === 'string' && maybeInput !== undefined ? sessionTokenOrInput : getSavedToken()
    return ipcRenderer.invoke('profiles:create', token, input)
  },
  updateProfile: (sessionTokenOrId: string, idOrInput: any, maybeInput?: any) => {
    let token = getSavedToken()
    let id = sessionTokenOrId
    let input = idOrInput
    if (maybeInput !== undefined) {
      token = sessionTokenOrId
      id = idOrInput
      input = maybeInput
    }
    return ipcRenderer.invoke('profiles:update', token, id, input)
  },
  deleteProfile: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('profiles:delete', token, id)
  },
  duplicateProfile: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('profiles:duplicate', token, id)
  },
  exportProfile: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('profiles:export', token, id)
  },
  importProfile: (sessionTokenOrData: any, maybeData?: any) => {
    const data = maybeData !== undefined ? maybeData : sessionTokenOrData
    const token = typeof sessionTokenOrData === 'string' && maybeData !== undefined ? sessionTokenOrData : getSavedToken()
    return ipcRenderer.invoke('profiles:import', token, data)
  },
  getProfileSize: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('profiles:getSize', token, id)
  },

  // ── Browser Control ──
  startProfile: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('browser:start', token, id)
  },
  stopProfile: (sessionTokenOrId: string, maybeId?: string) => {
    const id = maybeId || sessionTokenOrId
    const token = maybeId ? sessionTokenOrId : getSavedToken()
    return ipcRenderer.invoke('browser:stop', token, id)
  },
  getProfileStatus: (id: string) => ipcRenderer.invoke('browser:status', id),
  getRunningCount: () => ipcRenderer.invoke('browser:runningCount'),

  // ── Dashboard ──
  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),

  // ── Proxies ──
  getProxies: () => ipcRenderer.invoke('proxies:getAll'),
  getProxy: (id: string) => ipcRenderer.invoke('proxies:getById', id),
  createProxy: (input: any) => ipcRenderer.invoke('proxies:create', input),
  updateProxy: (id: string, input: any) => ipcRenderer.invoke('proxies:update', id, input),
  deleteProxy: (id: string) => ipcRenderer.invoke('proxies:delete', id),
  testProxy: (id: string) => ipcRenderer.invoke('proxies:test', id),
  testCustomProxy: (input: any) => ipcRenderer.invoke('proxies:testCustom', input),

  // ── Groups ──
  getGroups: () => ipcRenderer.invoke('groups:getAll'),
  createGroup: (input: any) => ipcRenderer.invoke('groups:create', input),
  updateGroup: (id: string, input: any) => ipcRenderer.invoke('groups:update', id, input),
  deleteGroup: (id: string) => ipcRenderer.invoke('groups:delete', id),

  // ── Settings ──
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke('settings:update', key, value),
  getChromiumPath: () => ipcRenderer.invoke('settings:chromiumPath'),
  setChromiumPath: (path: string) => ipcRenderer.invoke('settings:setChromiumPath', path),
  getFirefoxPath: () => ipcRenderer.invoke('settings:firefoxPath'),
  setFirefoxPath: (path: string) => ipcRenderer.invoke('settings:setFirefoxPath', path),
  autoDetectBrowser: () => ipcRenderer.invoke('settings:autoDetectBrowser'),
  testBrowser: (executablePath: string) => ipcRenderer.invoke('settings:testBrowser', executablePath),
  getBrowserDiagnostics: () => ipcRenderer.invoke('settings:browserDiagnostics'),

  // ── Browser Runtime Manager ──
  getRuntimeStatus: () => ipcRenderer.invoke('runtime:getStatus'),
  installRuntime: (engine: 'chromium' | 'firefox') => ipcRenderer.invoke('runtime:install', engine),
  verifyRuntime: (engine: 'chromium' | 'firefox') => ipcRenderer.invoke('runtime:verify', engine),
  repairRuntime: (engine: 'chromium' | 'firefox') => ipcRenderer.invoke('runtime:repair', engine),

  // ── Automation API ──
  getApiToken: () => ipcRenderer.invoke('api:getToken'),
  rotateApiToken: () => ipcRenderer.invoke('api:rotateToken'),
  startApi: () => ipcRenderer.invoke('api:start'),
  stopApi: () => ipcRenderer.invoke('api:stop'),
  isApiRunning: () => ipcRenderer.invoke('api:isRunning'),

  // ── Fingerprint ──
  generateFingerprint: (options: any) => ipcRenderer.invoke('fingerprint:generate', options),
  recalculateFingerprint: (currentFp: any, options: any) => ipcRenderer.invoke('fingerprint:recalculate', currentFp, options),
  regenerateFingerprint: (osType: string, country?: string) => ipcRenderer.invoke('fingerprint:regenerate', osType, country),
  validateFingerprint: (fingerprint: any, osType: string, browserType?: string, browserVersion?: string) =>
    ipcRenderer.invoke('fingerprint:validate', fingerprint, osType, browserType, browserVersion),
  detectContradictions: (fingerprint: any, osType: string, browserType?: string, browserVersion?: string) =>
    ipcRenderer.invoke('fingerprint:detectContradictions', fingerprint, osType, browserType, browserVersion),
  getProfileTemplates: () => ipcRenderer.invoke('fingerprint:getTemplates'),
  getDiagnosticReport: (profileId: string) => ipcRenderer.invoke('fingerprint:getDiagnosticReport', profileId),
  getStabilityWarnings: (oldFp: any, newFp: any, hasBeenUsed: boolean) =>
    ipcRenderer.invoke('fingerprint:stability-warnings', oldFp, newFp, hasBeenUsed),

  // ── Logs ──
  getLogs: (limit?: number, level?: string, category?: string) =>
    ipcRenderer.invoke('logs:getAll', limit, level, category),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),

  // ── System ──
  getAppVersion: () => ipcRenderer.invoke('system:version'),
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
  selectFile: (filters?: any[]) => ipcRenderer.invoke('system:selectFile', filters),
  selectDirectory: () => ipcRenderer.invoke('system:selectDirectory'),

  // ── Live Support System ──
  getSupportConversations: (token: string) => ipcRenderer.invoke('support:get-user-conversations', token),
  getSupportConversation: (token: string, conversationId: string) => ipcRenderer.invoke('support:get-conversation', token, conversationId),
  createSupportConversation: (token: string, input: any) => ipcRenderer.invoke('support:create-conversation', token, input),
  sendSupportMessage: (token: string, conversationId: string, message: string, attachment?: any) =>
    ipcRenderer.invoke('support:send-message', token, conversationId, message, attachment),
  markSupportRead: (token: string, conversationId: string) => ipcRenderer.invoke('support:mark-read', token, conversationId),
  sendSupportTyping: (token: string, conversationId: string, isTyping: boolean) =>
    ipcRenderer.invoke('support:typing', token, conversationId, isTyping),
  adminGetSupportConversations: (token: string, options?: any) => ipcRenderer.invoke('support:admin-get-conversations', token, options),
  adminUpdateSupportStatus: (token: string, conversationId: string, status: string) =>
    ipcRenderer.invoke('support:admin-update-status', token, conversationId, status),
  adminAssignSupportAgent: (token: string, conversationId: string, agentId: string | null) =>
    ipcRenderer.invoke('support:admin-assign-agent', token, conversationId, agentId),
  adminAddSupportInternalNote: (token: string, conversationId: string, note: string) =>
    ipcRenderer.invoke('support:admin-add-internal-note', token, conversationId, note),
  adminGetSupportSettings: (token: string) => ipcRenderer.invoke('support:admin-get-settings', token),
  adminSaveSupportSettings: (token: string, settings: Record<string, string>) =>
    ipcRenderer.invoke('support:admin-save-settings', token, settings),

  // ── Events (Main → Renderer) ──
  onProvisioningProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('runtime:provisioning-progress', callback)
    return () => ipcRenderer.removeListener('runtime:provisioning-progress', callback)
  },
  onProfileStatusChanged: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('profile:statusChanged', callback)
    return () => ipcRenderer.removeListener('profile:statusChanged', callback)
  },
  onToast: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('ui:toast', callback)
    return () => ipcRenderer.removeListener('ui:toast', callback)
  },
  onSupportNewMessage: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('support:new-message', callback)
    return () => ipcRenderer.removeListener('support:new-message', callback)
  },
  onSupportTypingIndicator: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('support:typing-indicator', callback)
    return () => ipcRenderer.removeListener('support:typing-indicator', callback)
  },
  onSupportStatusUpdated: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('support:status-updated', callback)
    return () => ipcRenderer.removeListener('support:status-updated', callback)
  },

  // ── Real-Time Synchronization & RBAC ──
  getSyncStatus: () => ipcRenderer.invoke('sync:get-status'),
  resyncAuthoritativeState: () => ipcRenderer.invoke('sync:resync'),
  reconnectSync: () => ipcRenderer.invoke('sync:reconnect'),
  checkPermission: (permission: string) => ipcRenderer.invoke('auth:check-permission', permission),
  getAuthoritativeState: () => ipcRenderer.invoke('auth:get-authoritative-state'),
  onSyncStatusChanged: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('sync:status-changed', callback)
    return () => ipcRenderer.removeListener('sync:status-changed', callback)
  },
  onAuthStateUpdated: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('auth:state-updated', callback)
    return () => ipcRenderer.removeListener('auth:state-updated', callback)
  },
  onSessionRevoked: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('auth:session-revoked', callback)
    return () => ipcRenderer.removeListener('auth:session-revoked', callback)
  },
  onRealtimeSyncEvent: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('sync:realtime-event', callback)
    return () => ipcRenderer.removeListener('sync:realtime-event', callback)
  },
  onPaymentCompleted: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('payment:completed', callback)
    return () => ipcRenderer.removeListener('payment:completed', callback)
  },

  // ── SEO & AEO Management APIs ──
  seoGetSettings: (token?: string) => ipcRenderer.invoke('seo:get-settings', token),
  seoSaveSettings: (token: string, settings: any) => ipcRenderer.invoke('seo:save-settings', token, settings),
  seoGetPages: (token?: string) => ipcRenderer.invoke('seo:get-pages', token),
  seoSavePage: (token: string, page: any) => ipcRenderer.invoke('seo:save-page', token, page),
  seoDeletePage: (token: string, id: string) => ipcRenderer.invoke('seo:delete-page', token, id),
  seoGetKeywords: (token?: string) => ipcRenderer.invoke('seo:get-keywords', token),
  seoSaveKeyword: (token: string, kw: any) => ipcRenderer.invoke('seo:save-keyword', token, kw),
  seoDeleteKeyword: (token: string, id: string) => ipcRenderer.invoke('seo:delete-keyword', token, id),
  seoGetRedirects: (token?: string) => ipcRenderer.invoke('seo:get-redirects', token),
  seoSaveRedirect: (token: string, r: any) => ipcRenderer.invoke('seo:save-redirect', token, r),
  seoDeleteRedirect: (token: string, id: string) => ipcRenderer.invoke('seo:delete-redirect', token, id),
  seoGet404Logs: (token?: string) => ipcRenderer.invoke('seo:get-404-logs', token),
  seoRunAudit: (token: string) => ipcRenderer.invoke('seo:run-audit', token),
  seoGetLatestAudit: (token?: string) => ipcRenderer.invoke('seo:get-latest-audit', token),
  seoGenerateContentAssistant: (token: string, params: any) => ipcRenderer.invoke('seo:generate-content-assistant', token, params),
  seoGetSitemapXml: () => ipcRenderer.invoke('seo:get-sitemap-xml'),
  seoGetLlmsTxt: () => ipcRenderer.invoke('seo:get-llms-txt'),

  // ── Software Release Management & Auto-Updates ──
  updaterCheckLatest: (currentVer?: string) => ipcRenderer.invoke('updater:checkLatest', currentVer),
  updaterGetAllVersions: (token?: string) => ipcRenderer.invoke('updater:getAllVersions', token),
  updaterSaveVersion: (token: string, versionData: any) => ipcRenderer.invoke('updater:saveVersion', token, versionData),
  updaterPublishVersion: (token: string, versionId: string) => ipcRenderer.invoke('updater:publishVersion', token, versionId),
  updaterDisableVersion: (token: string, versionId: string) => ipcRenderer.invoke('updater:disableVersion', token, versionId),
  updaterDeleteVersion: (token: string, versionId: string) => ipcRenderer.invoke('updater:deleteVersion', token, versionId),
  updaterDownloadUpdate: (url: string, expectedSha256?: string) => ipcRenderer.invoke('updater:downloadUpdate', url, expectedSha256),
  updaterInstallUpdate: (filePath: string) => ipcRenderer.invoke('updater:installUpdate', filePath),
  onSoftwareUpdateAvailable: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('ui:software-update-available', callback)
    return () => ipcRenderer.removeListener('ui:software-update-available', callback)
  },
  onDownloadProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('updater:download-progress', callback)
    return () => ipcRenderer.removeListener('updater:download-progress', callback)
  },

  // ── Referral & Affiliate Commission System ──
  affiliateGetUserSummary: (userId: string) => ipcRenderer.invoke('affiliate:getUserSummary', userId),
  affiliateRequestWithdrawal: (userId: string, amount: number, method: string, payoutDetails: any) =>
    ipcRenderer.invoke('affiliate:requestWithdrawal', userId, amount, method, payoutDetails),
  affiliateRecordAttribution: (userId: string, refCode: string) =>
    ipcRenderer.invoke('affiliate:recordAttribution', userId, refCode),
  affiliateGetAdminOverview: (token?: string) =>
    ipcRenderer.invoke('affiliate:getAdminOverview', token),
  affiliateAdminSaveSettings: (token: string, settings: any) =>
    ipcRenderer.invoke('affiliate:adminSaveSettings', token, settings),
  affiliateAdminUpdateWithdrawal: (token: string, withdrawalId: string, status: any, adminNotes?: string, txRef?: string) =>
    ipcRenderer.invoke('affiliate:adminUpdateWithdrawal', token, withdrawalId, status, adminNotes, txRef),
  affiliateAdminReverseCommission: (token: string, commissionId: string, reason: string) =>
    ipcRenderer.invoke('affiliate:adminReverseCommission', token, commissionId, reason),
  affiliateAdminAdjustBalance: (token: string, userId: string, amount: number, reason: string) =>
    ipcRenderer.invoke('affiliate:adminAdjustBalance', token, userId, amount, reason),
  onAffiliateCommissionEarned: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('ui:affiliate-commission-earned', callback)
    return () => ipcRenderer.removeListener('ui:affiliate-commission-earned', callback)
  },
  onAffiliateNewReferral: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('ui:affiliate-new-referral', callback)
    return () => ipcRenderer.removeListener('ui:affiliate-new-referral', callback)
  },
  onAffiliateWithdrawalUpdated: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('ui:affiliate-withdrawal-updated', callback)
    return () => ipcRenderer.removeListener('ui:affiliate-withdrawal-updated', callback)
  }
}

contextBridge.exposeInMainWorld('api', api)
