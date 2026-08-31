// ──────────────────────────────────────────────
// AntiProfiles — Data Models & TypeScript Interfaces
// ──────────────────────────────────────────────

export type ProfileStatus = 'running' | 'stopped' | 'launching' | 'error'
export type ProxyType = 'direct' | 'http' | 'https' | 'socks4' | 'socks5'
export type ProxyTestStatus = 'success' | 'failed' | 'untested' | 'testing'
export type WebRTCMode = 'default' | 'disabled' | 'public_only'
export type CanvasMode = 'default' | 'noise'
export type WebGLMode = 'default' | 'noise'
export type LogLevel = 'info' | 'warn' | 'error'
export type LogCategory =
  | 'profile'
  | 'browser'
  | 'proxy'
  | 'api'
  | 'database'
  | 'system'
  | 'fingerprint'
  | 'auth'
  | 'admin'
  | 'sync'
  | 'updater'
  | 'network'
  | 'storage'
  | 'recovery'
  | 'affiliate'
  | 'payment'
  | 'support'
  | 'central-api'

export type UserRole = 'admin' | 'user'
export type AccountStatus = 'pending' | 'active' | 'suspended'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string | null
  role: UserRole
  emailVerified: boolean
  accountStatus: AccountStatus
  googleId: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface UserDisplay {
  id: string
  name: string
  email: string
  role: UserRole
  emailVerified: boolean
  accountStatus: AccountStatus
  hasPassword: boolean
  googleId: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  profileCount?: number
}

export interface UserCreateInput {
  name: string
  email: string
  password?: string
  role?: UserRole
  emailVerified?: boolean
  accountStatus?: AccountStatus
  googleId?: string
}

export interface UserUpdateInput {
  name?: string
  email?: string
  password?: string
  role?: UserRole
  emailVerified?: boolean
  accountStatus?: AccountStatus
  googleId?: string
  lastLoginAt?: string
}

export interface EmailVerificationToken {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

export interface Profile {
  id: string
  userId: string
  name: string
  groupId: string | null
  notes: string
  color: string
  icon: string
  browserVersion: string
  userAgent: string
  language: string
  timezone: string
  screenWidth: number
  screenHeight: number
  webrtcMode: WebRTCMode
  canvasMode: CanvasMode
  webglMode: WebGLMode
  hwConcurrency: number
  deviceMemory: number
  hwAcceleration: boolean
  proxyId: string | null
  tags: string[]
  status: ProfileStatus
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  pid: number | null
  // v2 fields
  osType: string
  fingerprint: any
  folder: string
  profileLocked: boolean
  lockDeviceId: string | null
  consistencyScore: number
  fingerprintSeed: string
  startUrl: string
  launchArgs: string[]
  saveHistory: boolean
  savePasswords: boolean
  googleServices: boolean
  systemExtensions: boolean
  customDns: string
  lastModified: string | null
}

export interface ProfileCreateInput {
  name: string
  groupId?: string | null
  notes?: string
  color?: string
  icon?: string
  browserVersion?: string
  userAgent?: string
  language?: string
  timezone?: string
  screenWidth?: number
  screenHeight?: number
  webrtcMode?: WebRTCMode
  canvasMode?: CanvasMode
  webglMode?: WebGLMode
  hwConcurrency?: number
  deviceMemory?: number
  hwAcceleration?: boolean
  proxyId?: string | null
  tags?: string[]
  // v2 fields
  osType?: string
  fingerprint?: any
  folder?: string
  fingerprintSeed?: string
  startUrl?: string
  launchArgs?: string[]
  saveHistory?: boolean
  savePasswords?: boolean
  googleServices?: boolean
  systemExtensions?: boolean
  customDns?: string
}

export interface ProfileUpdateInput extends Partial<ProfileCreateInput> {
  status?: ProfileStatus
  lastUsedAt?: string
  pid?: number | null
  profileLocked?: boolean
  lockDeviceId?: string | null
  consistencyScore?: number
  lastModified?: string
}

export interface Proxy {
  id: string
  name: string
  type: ProxyType
  host: string
  port: number
  username: string
  encryptedPassword: Buffer | null
  country?: string
  region?: string
  city?: string
  isp?: string
  asn?: string
  timezone?: string
  latitude?: number
  longitude?: number
  publicIp?: string
  proxyVersion?: number
  lastTested: string | null
  testStatus: ProxyTestStatus
  createdAt: string
  updatedAt?: string
}

export interface ProxyCreateInput {
  name: string
  type: ProxyType
  host?: string
  port?: number
  username?: string
  password?: string
  country?: string
  region?: string
  city?: string
  isp?: string
  asn?: string
  timezone?: string
  latitude?: number
  longitude?: number
  publicIp?: string
  proxyVersion?: number
}

export interface ProxyUpdateInput extends Partial<ProxyCreateInput> {}

export interface ProxyDisplay extends Omit<Proxy, 'encryptedPassword'> {
  hasPassword: boolean
}

export interface Group {
  id: string
  name: string
  color: string
  createdAt: string
  profileCount?: number
}

export interface GroupCreateInput {
  name: string
  color?: string
}

export interface LogEntry {
  id: number
  level: LogLevel
  category: LogCategory
  message: string
  details: string | null
  createdAt: string
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  chromiumPath: string
  autoDownloadChromium: boolean
  apiEnabled: boolean
  apiPort: number
  dataDirectory: string
}

export interface DashboardStats {
  totalProfiles: number
  runningProfiles: number
  stoppedProfiles: number
  totalProxies: number
  totalGroups: number
  recentProfiles: Profile[]
}

// Database row types (snake_case from SQLite)
export interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string | null
  role: string
  email_verified: number
  account_status: string
  google_id: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface EmailVerificationTokenRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface ProfileRow {
  id: string
  user_id?: string
  name: string
  group_id: string | null
  notes: string
  color: string
  icon: string
  browser_version: string
  user_agent: string
  language: string
  timezone: string
  screen_width: number
  screen_height: number
  webrtc_mode: string
  canvas_mode: string
  webgl_mode: string
  hw_concurrency: number
  device_memory: number
  hw_acceleration: number
  proxy_id: string | null
  tags: string
  status: string
  created_at: string
  updated_at: string
  last_used_at: string | null
  pid: number | null
  // v2 fields
  os_type?: string
  fingerprint?: string
  folder?: string
  profile_locked?: number
  lock_device_id?: string | null
  consistency_score?: number
  fingerprint_seed?: string
  start_url?: string
  launch_args?: string
  save_history?: number
  save_passwords?: number
  google_services?: number
  system_extensions?: number
  custom_dns?: string
  last_modified?: string | null
}

export interface ProxyRow {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string
  encrypted_password: Buffer | null
  country?: string
  region?: string
  city?: string
  isp?: string
  asn?: string
  timezone?: string
  latitude?: number
  longitude?: number
  public_ip?: string
  proxy_version?: number
  last_tested: string | null
  test_status: string
  created_at: string
  updated_at?: string
}

export interface GroupRow {
  id: string
  name: string
  color: string
  created_at: string
  profile_count?: number
}

export interface LogRow {
  id: number
  level: string
  category: string
  message: string
  details: string | null
  created_at: string
}

// Mappers
export function userFromRow(row: UserRow): User {
  let role: UserRole = 'user'
  if (typeof row.role === 'string') {
    role = row.role as UserRole
  } else if (row.role && typeof row.role === 'object') {
    role = ((row.role as any).name || (row.role as any).role || (row.role as any).slug || (row.role as any).value || 'user') as UserRole
  } else if (typeof row.role === 'number') {
    role = (row.role === 1 ? 'admin' : 'user') as UserRole
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role,
    emailVerified: row.email_verified === 1,
    accountStatus: row.account_status as AccountStatus,
    googleId: row.google_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  }
}

export function userToDisplay(user: User, profileCount?: number): UserDisplay {
  const { passwordHash, ...rest } = user
  return {
    ...rest,
    hasPassword: passwordHash !== null && passwordHash.length > 0,
    profileCount
  }
}

export function profileFromRow(row: ProfileRow): Profile {
  let fingerprint: any = {}
  try {
    fingerprint = row.fingerprint ? (typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint) : row.fingerprint) : {}
  } catch { fingerprint = {} }

  let osType = row.os_type || 'windows-10'
  if (typeof osType === 'string' && (osType.startsWith('{') || osType.length > 50)) {
    try {
      const parsed = JSON.parse(osType)
      if (parsed && typeof parsed === 'object') {
        if (!fingerprint || Object.keys(fingerprint).length === 0) {
          fingerprint = parsed
        }
        osType = parsed.os || parsed.osType || (parsed.navigator?.userAgent?.includes('Mac') ? 'macos-intel' : 'windows-10')
      }
    } catch {
      osType = 'windows-10'
    }
  }

  return {
    id: row.id,
    userId: row.user_id || 'admin-default',
    name: row.name,
    groupId: row.group_id,
    notes: row.notes,
    color: row.color,
    icon: row.icon,
    browserVersion: row.browser_version,
    userAgent: row.user_agent,
    language: row.language,
    timezone: row.timezone,
    screenWidth: row.screen_width,
    screenHeight: row.screen_height,
    webrtcMode: row.webrtc_mode as WebRTCMode,
    canvasMode: row.canvas_mode as CanvasMode,
    webglMode: row.webgl_mode as WebGLMode,
    hwConcurrency: row.hw_concurrency,
    deviceMemory: row.device_memory,
    hwAcceleration: row.hw_acceleration === 1,
    proxyId: row.proxy_id,
    tags: JSON.parse(row.tags || '[]'),
    status: row.status as ProfileStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    pid: row.pid,
    // v2 fields
    osType,
    fingerprint,
    folder: row.folder || '',
    profileLocked: (row.profile_locked || 0) === 1,
    lockDeviceId: row.lock_device_id || null,
    consistencyScore: row.consistency_score || 0,
    fingerprintSeed: row.fingerprint_seed || '',
    startUrl: row.start_url || '',
    launchArgs: JSON.parse(row.launch_args || '[]'),
    saveHistory: (row.save_history ?? 1) === 1,
    savePasswords: (row.save_passwords || 0) === 1,
    googleServices: (row.google_services || 0) === 1,
    systemExtensions: (row.system_extensions || 0) === 1,
    customDns: row.custom_dns || '',
    lastModified: row.last_modified || null
  }
}

export function proxyFromRow(row: ProxyRow): Proxy {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ProxyType,
    host: row.host,
    port: row.port,
    username: row.username,
    encryptedPassword: row.encrypted_password,
    country: row.country || '',
    region: row.region || '',
    city: row.city || '',
    isp: row.isp || '',
    asn: row.asn || '',
    timezone: row.timezone || '',
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    publicIp: row.public_ip || '',
    proxyVersion: row.proxy_version || 1,
    lastTested: row.last_tested,
    testStatus: row.test_status as ProxyTestStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  }
}

export function proxyToDisplay(proxy: Proxy): ProxyDisplay {
  const { encryptedPassword, ...rest } = proxy
  return { ...rest, hasPassword: encryptedPassword !== null && encryptedPassword.length > 0 }
}

export function groupFromRow(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    profileCount: row.profile_count
  }
}

export function logFromRow(row: LogRow): LogEntry {
  return {
    id: row.id,
    level: row.level as LogLevel,
    category: row.category as LogCategory,
    message: row.message,
    details: row.details,
    createdAt: row.created_at
  }
}

// ── CPA Affiliate Types ──
export type PayoutType = 'percentage' | 'fixed'
export type OfferStatus = 'active' | 'paused' | 'archived'
export type AffiliateAccountStatus = 'active' | 'suspended' | 'disabled'
export type ConversionStatus = 'pending' | 'approved' | 'rejected'
export type PostbackStatus = 'pending' | 'sent' | 'confirmed' | 'failed' | 'retrying'
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed' | 'cancelled'

export interface AffiliateOffer {
  id: string
  title: string
  description?: string
  target_url: string
  signup_url?: string
  payout_type: PayoutType
  commission_rate: number
  revshare_percent?: number
  fixed_payout_usd: number
  currency: string
  package_id?: string
  package_name?: string
  price?: number
  original_price?: number
  discount_type?: string
  discount_value?: number
  discounted_price?: number
  trial_days?: number
  landing_page_slug?: string
  trial_enabled?: boolean | number
  cta_text?: string
  badge_text?: string | null
  banner_url?: string | null
  status: OfferStatus
  total_clicks?: number
  total_conversions?: number
  created_at?: string
  updated_at?: string
}

export interface AffiliateTrackingLink {
  id: string
  affiliate_id: string
  user_id: string
  offer_id: string
  package_id?: string
  tracking_url: string
  clicks?: number
  conversions?: number
  custom_params?: string
  created_at?: string
}

export interface AffiliateClick {
  click_id: string
  affiliate_id: string
  offer_id: string
  package_id?: string
  package_name?: string
  tracking_link_id?: string
  affiliate_link_id?: string
  ip_address?: string
  user_agent?: string
  referrer?: string
  landing_url: string
  device?: string
  browser?: string
  os?: string
  country?: string
  sub_id1?: string
  sub_id2?: string
  sub_id3?: string
  sub_id4?: string
  sub_id5?: string
  converted: number
  conversion_id?: string
  conversion_at?: string
  converted_at?: string
  created_at: string
}

export interface AffiliateConversion {
  conversion_id: string
  click_id: string
  affiliate_id: string
  offer_id: string
  user_id?: string
  order_amount: number
  payout_amount: number
  currency: string
  status: ConversionStatus
  idempotency_key?: string
  meta_json?: string
  created_at: string
  updated_at: string
}

export interface AffiliatePostbackConfig {
  id: string
  user_id: string
  affiliate_id: string
  postback_url: string
  http_method: 'GET' | 'POST'
  is_active: number
  created_at?: string
  updated_at?: string
}

export interface AffiliatePostbackLog {
  id: string
  conversion_id: string
  click_id: string
  affiliate_id: string
  url: string
  http_method: string
  http_status?: number
  response_body?: string
  attempt_count: number
  status: PostbackStatus
  error_message?: string
  last_attempt_at: string
  created_at: string
}

export interface AffiliateAuditLog {
  id: string
  action: string
  performed_by: string
  target_id: string
  details: string
  ip_address?: string
  created_at: string
}
