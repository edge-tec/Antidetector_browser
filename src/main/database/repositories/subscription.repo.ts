// ──────────────────────────────────────────────
// AntiProfiles — Subscription, Licensing & Device Repository
// ──────────────────────────────────────────────

import { getDatabase } from '../connection'

export interface PlanFeatureMatrix {
  plan_id: string
  plan_name: string
  profile_limit: number
  team_limit: number
  proxy_support: 'basic' | 'socks' | 'socks5'
  allowed_proxy_types: string[]
  fingerprint_level: 'standard' | 'advanced' | 'advanced_controls' | 'full_hardware'
  has_advanced_fingerprint: boolean
  has_full_hardware_spoofing: boolean
  api_access: 'none' | 'basic' | 'full' | 'unlimited'
  has_api: boolean
  has_driver_api: boolean
  support_level: 'community' | 'email' | 'priority_24_7' | 'dedicated_manager'
  can_access_team: boolean
}

export function resolveLocalPlanFeatureMatrix(planId?: string, role: string = 'user'): PlanFeatureMatrix {
  const isAdmin = role === 'admin' || role === 'super_admin'
  if (isAdmin) {
    return {
      plan_id: 'plan_business',
      plan_name: 'System Admin',
      profile_limit: 1000,
      team_limit: 50,
      proxy_support: 'socks5',
      allowed_proxy_types: ['direct', 'http', 'https', 'socks4', 'socks5'],
      fingerprint_level: 'full_hardware',
      has_advanced_fingerprint: true,
      has_full_hardware_spoofing: true,
      api_access: 'unlimited',
      has_api: true,
      has_driver_api: true,
      support_level: 'dedicated_manager',
      can_access_team: true
    }
  }

  const normalized = (planId || 'free').toLowerCase()
  if (normalized.includes('business')) {
    return {
      plan_id: 'plan_business',
      plan_name: 'Business',
      profile_limit: 500,
      team_limit: 25,
      proxy_support: 'socks5',
      allowed_proxy_types: ['direct', 'http', 'https', 'socks4', 'socks5'],
      fingerprint_level: 'full_hardware',
      has_advanced_fingerprint: true,
      has_full_hardware_spoofing: true,
      api_access: 'unlimited',
      has_api: true,
      has_driver_api: true,
      support_level: 'dedicated_manager',
      can_access_team: true
    }
  }

  if (normalized.includes('pro')) {
    return {
      plan_id: 'plan_pro',
      plan_name: 'Professional',
      profile_limit: 100,
      team_limit: 10,
      proxy_support: 'socks5',
      allowed_proxy_types: ['direct', 'http', 'https', 'socks4', 'socks5'],
      fingerprint_level: 'advanced_controls',
      has_advanced_fingerprint: true,
      has_full_hardware_spoofing: false,
      api_access: 'full',
      has_api: true,
      has_driver_api: true,
      support_level: 'priority_24_7',
      can_access_team: true
    }
  }

  if (normalized.includes('starter')) {
    return {
      plan_id: 'plan_starter',
      plan_name: 'Starter',
      profile_limit: 25,
      team_limit: 2,
      proxy_support: 'socks',
      allowed_proxy_types: ['direct', 'http', 'https', 'socks4', 'socks5'],
      fingerprint_level: 'advanced',
      has_advanced_fingerprint: true,
      has_full_hardware_spoofing: false,
      api_access: 'basic',
      has_api: true,
      has_driver_api: false,
      support_level: 'email',
      can_access_team: true
    }
  }

  // Free default
  return {
    plan_id: 'plan_free',
    plan_name: 'Free',
    profile_limit: 3,
    team_limit: 1,
    proxy_support: 'basic',
    allowed_proxy_types: ['direct', 'http'],
    fingerprint_level: 'standard',
    has_advanced_fingerprint: false,
    has_full_hardware_spoofing: false,
    api_access: 'none',
    has_api: false,
    has_driver_api: false,
    support_level: 'community',
    can_access_team: false
  }
}

export interface LicenseValidationResult {
  valid: boolean
  account_status: string
  subscription_status: string // active, trial, past_due, expired, cancelled, suspended, pending
  plan: {
    id: string
    name: string
    monthly_price: number
    yearly_price: number
  }
  expires_at: string
  grace_period_active: boolean
  features: {
    browser_profiles?: boolean
    proxy_support?: 'basic' | 'socks' | 'socks5'
    allowed_proxy_types?: string[]
    fingerprint_level?: 'standard' | 'advanced' | 'advanced_controls' | 'full_hardware'
    advanced_fingerprint?: boolean
    full_hardware_spoofing?: boolean
    proxy_manager?: boolean
    profile_templates?: boolean
    team_management?: boolean
    api_access?: 'none' | 'basic' | 'full' | 'unlimited'
    has_api?: boolean
    has_driver_api?: boolean
    support_level?: 'community' | 'email' | 'priority_24_7' | 'dedicated_manager'
    [key: string]: any
  }
  limits: {
    profiles: number
    team_members: number
    api_access: boolean | string
    proxy_types?: string[]
    fingerprint_level?: string
    support_level?: string
  }
  device: {
    installation_id: string
    device_count: number
    max_devices: number
  }
  app_version_status: {
    force_update: boolean
    min_version: string
    current_version: string
    is_supported: boolean
  }
  error?: string
  renewal_url?: string
}

export class SubscriptionRepository {

  // ── 1. Get or Create Default User Subscription ──
  getOrCreateSubscription(userId: string): any {
    const db = getDatabase()

    let sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any
    if (!sub) {
      // Check user role
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as any
      const defaultPlanId = user?.role === 'admin' ? 'plan_pro' : 'plan_free'
      const subId = `sub_${userId}`

      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, expires_at, grace_period_days)
        VALUES (?, ?, ?, 'active', datetime('now'), datetime('now', '+1 year'), 3)
      `).run(subId, userId, defaultPlanId)

      sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any
    }

    const plan = db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(sub.plan_id) as any
    return { ...sub, plan }
  }

  // ── 2. Server-side Licensing & Authoritative Permissions Check ──
  validateLicense(userId: string, installationId?: string, platform?: string, appVersion?: string): LicenseValidationResult {
    const db = getDatabase()

    // A. Check user status
    const user = db.prepare('SELECT id, email, role, account_status FROM users WHERE id = ?').get(userId) as any
    if (!user) {
      return {
        valid: false,
        account_status: 'not_found',
        subscription_status: 'invalid',
        plan: { id: 'none', name: 'None', monthly_price: 0, yearly_price: 0 },
        expires_at: new Date().toISOString(),
        grace_period_active: false,
        features: {},
        limits: { profiles: 0, team_members: 0, api_access: false },
        device: { installation_id: installationId || '', device_count: 0, max_devices: 0 },
        app_version_status: { force_update: false, min_version: '1.0.0', current_version: appVersion || '1.0.0', is_supported: true },
        error: 'User account not found'
      }
    }

    if (user.account_status === 'suspended') {
      return {
        valid: false,
        account_status: 'suspended',
        subscription_status: 'suspended',
        plan: { id: 'none', name: 'Suspended', monthly_price: 0, yearly_price: 0 },
        expires_at: new Date().toISOString(),
        grace_period_active: false,
        features: {},
        limits: { profiles: 0, team_members: 0, api_access: false },
        device: { installation_id: installationId || '', device_count: 0, max_devices: 0 },
        app_version_status: { force_update: false, min_version: '1.0.0', current_version: appVersion || '1.0.0', is_supported: true },
        error: 'Your account has been suspended by an administrator. Please contact support.',
        renewal_url: '#contact'
      }
    }

    // B. App Version & Release Check
    const configMap = this.getDesktopConfig()
    const minVersion = configMap.min_supported_version || '1.0.0'
    const forceUpdate = configMap.force_update === 'true'
    const isVersionSupported = !appVersion || this.compareVersions(appVersion, minVersion) >= 0

    if (!isVersionSupported && forceUpdate) {
      return {
        valid: false,
        account_status: user.account_status,
        subscription_status: 'update_required',
        plan: { id: 'none', name: 'None', monthly_price: 0, yearly_price: 0 },
        expires_at: new Date().toISOString(),
        grace_period_active: false,
        features: {},
        limits: { profiles: 0, team_members: 0, api_access: false },
        device: { installation_id: installationId || '', device_count: 0, max_devices: 0 },
        app_version_status: {
          force_update: true,
          min_version: minVersion,
          current_version: appVersion || '1.0.0',
          is_supported: false
        },
        error: `Your application version (${appVersion}) is below minimum supported version (${minVersion}). Please download the latest update.`,
        renewal_url: '#download'
      }
    }

    // C. Device Management & Max Device Limits
    const maxDevicesLimit = parseInt(configMap.max_devices_limit, 10) || 2
    let activeDevicesCount = 0

    if (installationId) {
      // Register or update installation
      const existingInst = db.prepare('SELECT * FROM desktop_installations WHERE installation_id = ?').get(installationId) as any
      if (!existingInst) {
        // Count existing un-revoked installations for user
        const existingCount = db.prepare('SELECT COUNT(*) as count FROM desktop_installations WHERE user_id = ? AND revoked_at IS NULL').get(userId) as any
        if (existingCount.count >= maxDevicesLimit && user.role !== 'admin') {
          return {
            valid: false,
            account_status: user.account_status,
            subscription_status: 'device_limit_reached',
            plan: { id: 'none', name: 'Limit Reached', monthly_price: 0, yearly_price: 0 },
            expires_at: new Date().toISOString(),
            grace_period_active: false,
            features: {},
            limits: { profiles: 0, team_members: 0, api_access: false },
            device: { installation_id: installationId, device_count: existingCount.count, max_devices: maxDevicesLimit },
            app_version_status: { force_update: false, min_version: minVersion, current_version: appVersion || '1.0.0', is_supported: true },
            error: `Device limit reached. Your subscription allows up to ${maxDevicesLimit} active devices. Please revoke an existing device to proceed.`,
            renewal_url: '#devices'
          }
        }

        db.prepare(`
          INSERT INTO desktop_installations (id, user_id, installation_id, platform, device_name, app_version, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(`inst_${Date.now()}`, userId, installationId, platform || 'desktop', `${platform || 'Desktop'} Device`, appVersion || '1.0.0')
      } else {
        if (existingInst.revoked_at) {
          return {
            valid: false,
            account_status: user.account_status,
            subscription_status: 'device_revoked',
            plan: { id: 'none', name: 'Revoked', monthly_price: 0, yearly_price: 0 },
            expires_at: new Date().toISOString(),
            grace_period_active: false,
            features: {},
            limits: { profiles: 0, team_members: 0, api_access: false },
            device: { installation_id: installationId, device_count: 0, max_devices: maxDevicesLimit },
            app_version_status: { force_update: false, min_version: minVersion, current_version: appVersion || '1.0.0', is_supported: true },
            error: 'This device installation has been revoked by an administrator or user.',
            renewal_url: '#devices'
          }
        }
        db.prepare("UPDATE desktop_installations SET last_seen_at = datetime('now'), app_version = ? WHERE installation_id = ?")
          .run(appVersion || '1.0.0', installationId)
      }
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM desktop_installations WHERE user_id = ? AND revoked_at IS NULL').get(userId) as any
    activeDevicesCount = countRow ? countRow.count : 0

    // D. Fetch Subscription & Expiration Check
    const sub = this.getOrCreateSubscription(userId)
    const now = new Date()
    const expiresAt = new Date(sub.expires_at)
    const graceDays = sub.grace_period_days ?? 3
    const graceExpiresAt = new Date(expiresAt.getTime() + graceDays * 86400000)

    let isExpired = now > expiresAt
    let isGraceActive = false
    let currentSubStatus = sub.status

    if (sub.status === 'suspended') {
      return {
        valid: false,
        account_status: user.account_status,
        subscription_status: 'suspended',
        plan: { id: sub.plan.id, name: sub.plan.name, monthly_price: sub.plan.monthly_price, yearly_price: sub.plan.yearly_price },
        expires_at: sub.expires_at,
        grace_period_active: false,
        features: {},
        limits: { profiles: 0, team_members: 0, api_access: false },
        device: { installation_id: installationId || '', device_count: activeDevicesCount, max_devices: maxDevicesLimit },
        app_version_status: { force_update: false, min_version: minVersion, current_version: appVersion || '1.0.0', is_supported: true },
        error: 'Your subscription is currently suspended. Please contact sales to reactivate.',
        renewal_url: '#pricing'
      }
    }

    if (isExpired) {
      if (now <= graceExpiresAt && graceDays > 0) {
        isGraceActive = true
        currentSubStatus = 'grace_period'
      } else {
        currentSubStatus = 'expired'
        db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(sub.id)
        return {
          valid: false,
          account_status: user.account_status,
          subscription_status: 'expired',
          plan: { id: sub.plan.id, name: sub.plan.name, monthly_price: sub.plan.monthly_price, yearly_price: sub.plan.yearly_price },
          expires_at: sub.expires_at,
          grace_period_active: false,
          features: {},
          limits: { profiles: sub.plan.profile_limit || 3, team_members: 1, api_access: false },
          device: { installation_id: installationId || '', device_count: activeDevicesCount, max_devices: maxDevicesLimit },
          app_version_status: { force_update: false, min_version: minVersion, current_version: appVersion || '1.0.0', is_supported: true },
          error: 'Your subscription has expired. Please renew to continue using desktop browser profiles.',
          renewal_url: '#pricing'
        }
      }
    }

    // E. Assemble Authoritative Feature Permissions
    const plan = sub.plan
    const matrix = resolveLocalPlanFeatureMatrix(plan?.id || plan?.slug, user.role)

    const userProfileLimit = (sub.profile_limit && sub.profile_limit > 0)
      ? sub.profile_limit
      : (user.profile_limit && user.profile_limit > 0)
        ? user.profile_limit
        : (plan && plan.profile_limit && plan.profile_limit > 0)
          ? plan.profile_limit
          : matrix.profile_limit

    const userTeamLimit = user.role === 'admin' ? 50 : (sub.device_limit || plan?.team_limit || matrix.team_limit)

    return {
      valid: true,
      account_status: user.account_status,
      subscription_status: currentSubStatus,
      plan: {
        id: plan.id,
        name: matrix.plan_name || plan.name,
        monthly_price: plan.monthly_price,
        yearly_price: plan.yearly_price
      },
      expires_at: sub.expires_at,
      grace_period_active: isGraceActive,
      features: {
        browser_profiles: true,
        proxy_support: matrix.proxy_support,
        allowed_proxy_types: matrix.allowed_proxy_types,
        fingerprint_level: matrix.fingerprint_level,
        advanced_fingerprint: matrix.has_advanced_fingerprint,
        full_hardware_spoofing: matrix.has_full_hardware_spoofing,
        proxy_manager: true,
        profile_templates: true,
        team_management: matrix.can_access_team || user.role === 'admin',
        api_access: matrix.api_access,
        has_api: matrix.has_api,
        has_driver_api: matrix.has_driver_api,
        support_level: matrix.support_level
      },
      limits: {
        profiles: user.role === 'admin' ? 1000 : userProfileLimit,
        team_members: userTeamLimit,
        proxy_types: matrix.allowed_proxy_types,
        api_access: matrix.api_access,
        fingerprint_level: matrix.fingerprint_level,
        support_level: matrix.support_level
      },
      device: {
        installation_id: installationId || '',
        device_count: activeDevicesCount,
        max_devices: userTeamLimit
      },
      app_version_status: {
        force_update: false,
        min_version: minVersion,
        current_version: appVersion || '1.0.0',
        is_supported: true
      }
    }
  }

  // ── Helper to retrieve active user license synchronously ──
  getActiveUserLicense(): LicenseValidationResult | null {
    try {
      const db = getDatabase()
      const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined
      if (!user) return null
      return this.validateLicense(user.id)
    } catch {
      return null
    }
  }

  // ── 3. Desktop Installation Management ──
  getUserInstallations(userId: string): any[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM desktop_installations WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC').all(userId)
  }

  revokeInstallation(userId: string, installationId: string): void {
    const db = getDatabase()
    db.prepare("UPDATE desktop_installations SET revoked_at = datetime('now') WHERE user_id = ? AND installation_id = ?").run(userId, installationId)
  }

  // ── 4. Admin Subscriptions CRUD ──
  getAdminSubscriptions(filter?: { query?: string; status?: string; planId?: string }): any[] {
    const db = getDatabase()
    const users = db.prepare('SELECT id, name, email, role, account_status FROM users').all() as any[]
    
    return users.map(u => {
      const sub = this.getOrCreateSubscription(u.id)
      const devices = this.getUserInstallations(u.id)
      return {
        user: u,
        subscription: sub,
        devices
      }
    }).filter(item => {
      if (filter?.query) {
        const q = filter.query.toLowerCase()
        if (!item.user.name.toLowerCase().includes(q) && !item.user.email.toLowerCase().includes(q)) return false
      }
      if (filter?.status && item.subscription.status !== filter.status) return false
      if (filter?.planId && item.subscription.plan_id !== filter.planId) return false
      return true
    })
  }

  updateUserSubscription(userId: string, data: { plan_id?: string; status?: string; expires_at?: string; grace_period_days?: number }): any {
    const db = getDatabase()
    const sub = this.getOrCreateSubscription(userId)

    db.prepare(`
      UPDATE subscriptions SET
        plan_id = COALESCE(?, plan_id),
        status = COALESCE(?, status),
        expires_at = COALESCE(?, expires_at),
        grace_period_days = COALESCE(?, grace_period_days),
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(data.plan_id || null, data.status || null, data.expires_at || null, data.grace_period_days ?? null, userId)

    return this.getOrCreateSubscription(userId)
  }

  // ── 5. Desktop App Release Config ──
  getDesktopConfig(): Record<string, string> {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM desktop_app_config').all() as { key: string; value: string }[]
    const config: Record<string, string> = {}
    rows.forEach(r => { config[r.key] = r.value })
    return config
  }

  updateDesktopConfig(entries: Record<string, string>): Record<string, string> {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO desktop_app_config (key, value) VALUES (?, ?)')
    Object.entries(entries).forEach(([k, v]) => {
      stmt.run(k, String(v))
    })
    return this.getDesktopConfig()
  }

  // ── 6. Platform-Aware Auto-Update Manifest API ──
  getAppUpdateManifest(): any {
    const cfg = this.getDesktopConfig()
    return {
      version: cfg.win_app_version || '1.0.0',
      min_supported_version: cfg.min_supported_version || '1.0.0',
      force_update: cfg.force_update === 'true',
      platforms: {
        'windows-x64': {
          version: cfg.win_app_version || '1.0.0',
          download_url: cfg.win_download_url || 'https://releases.antiprofiles.com/AntiProfiles-Windows-x64.exe',
          enabled: cfg.win_enabled !== 'false',
          required: cfg.force_update === 'true'
        },
        'macos-x64': {
          version: cfg.mac_intel_app_version || cfg.mac_app_version || '1.0.0',
          download_url: cfg.mac_intel_download_url || cfg.mac_download_url || 'https://releases.antiprofiles.com/AntiProfiles-macOS-Intel-x64.dmg',
          enabled: cfg.mac_intel_enabled !== 'false',
          required: cfg.force_update === 'true'
        },
        'macos-arm64': {
          version: cfg.mac_arm_app_version || cfg.mac_app_version || '1.0.0',
          download_url: cfg.mac_arm_download_url || cfg.mac_download_url || 'https://releases.antiprofiles.com/AntiProfiles-macOS-Apple-Silicon-arm64.dmg',
          enabled: cfg.mac_arm_enabled !== 'false',
          required: cfg.force_update === 'true'
        }
      }
    }
  }

  // Helper semantic version comparator
  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number)
    const p2 = v2.split('.').map(Number)
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const val1 = p1[i] || 0
      const val2 = p2[i] || 0
      if (val1 > val2) return 1
      if (val1 < val2) return -1
    }
    return 0
  }
}

export const subscriptionRepo = new SubscriptionRepository()
