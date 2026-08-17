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
export type LogCategory = 'profile' | 'browser' | 'proxy' | 'api' | 'database' | 'system' | 'fingerprint' | 'auth' | 'admin'

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
  lastTested: string | null
  testStatus: ProxyTestStatus
  createdAt: string
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
  last_tested: string | null
  test_status: string
  created_at: string
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
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
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
    fingerprint = row.fingerprint ? JSON.parse(row.fingerprint) : {}
  } catch { fingerprint = {} }

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
    osType: row.os_type || 'windows-10',
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
    lastTested: row.last_tested,
    testStatus: row.test_status as ProxyTestStatus,
    createdAt: row.created_at
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
