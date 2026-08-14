// ──────────────────────────────────────────────
// ProfileVault — Shared Types (Renderer)
// ──────────────────────────────────────────────

export type ProfileStatus = 'running' | 'stopped' | 'launching' | 'error'
export type ProxyType = 'direct' | 'http' | 'https' | 'socks5'
export type ProxyTestStatus = 'success' | 'failed' | 'untested' | 'testing'
export type WebRTCMode = 'default' | 'disabled' | 'public_only'
export type CanvasMode = 'default' | 'noise'
export type WebGLMode = 'default' | 'noise'
export type LogLevel = 'info' | 'warn' | 'error'

export type UserRole = 'admin' | 'user'
export type AccountStatus = 'pending' | 'active' | 'suspended'

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

export interface Profile {
  id: string
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
}

export interface ProxyDisplay {
  id: string
  name: string
  type: ProxyType
  host: string
  port: number
  username: string
  hasPassword: boolean
  country?: string
  region?: string
  city?: string
  isp?: string
  asn?: string
  lastTested: string | null
  testStatus: ProxyTestStatus
  createdAt: string
}

export interface Group {
  id: string
  name: string
  color: string
  createdAt: string
  profileCount?: number
}

export interface LogEntry {
  id: number
  level: LogLevel
  category: string
  message: string
  details: string | null
  created_at: string
}

export interface DashboardStats {
  totalProfiles: number
  runningProfiles: number
  stoppedProfiles: number
  totalProxies: number
  totalGroups: number
  recentProfiles: Profile[]
}

export interface IpcResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

export type Page = 'dashboard' | 'profiles' | 'groups' | 'proxies' | 'automation' | 'settings' | 'logs'

// Window API type
declare global {
  interface Window {
    api: {
      getProfiles: (search?: string, groupId?: string, status?: string) => Promise<IpcResult<Profile[]>>
      getProfile: (id: string) => Promise<IpcResult<Profile>>
      createProfile: (input: any) => Promise<IpcResult<Profile>>
      updateProfile: (id: string, input: any) => Promise<IpcResult<Profile>>
      deleteProfile: (id: string) => Promise<IpcResult>
      duplicateProfile: (id: string) => Promise<IpcResult<Profile>>
      exportProfile: (id: string) => Promise<IpcResult<any>>
      importProfile: (data: any) => Promise<IpcResult<Profile>>
      getProfileSize: (id: string) => Promise<IpcResult<number>>
      startProfile: (id: string) => Promise<IpcResult<{ pid: number; wsEndpoint: string }>>
      stopProfile: (id: string) => Promise<IpcResult>
      getProfileStatus: (id: string) => Promise<IpcResult<any>>
      getRunningCount: () => Promise<IpcResult<number>>
      getDashboardStats: () => Promise<IpcResult<DashboardStats>>
      getProxies: () => Promise<IpcResult<ProxyDisplay[]>>
      getProxy: (id: string) => Promise<IpcResult<ProxyDisplay>>
      createProxy: (input: any) => Promise<IpcResult<ProxyDisplay>>
      updateProxy: (id: string, input: any) => Promise<IpcResult<ProxyDisplay>>
      deleteProxy: (id: string) => Promise<IpcResult>
      testProxy: (id: string) => Promise<IpcResult<{ success: boolean; latency: number; ip?: string; error?: string }>>
      getGroups: () => Promise<IpcResult<Group[]>>
      createGroup: (input: any) => Promise<IpcResult<Group>>
      updateGroup: (id: string, input: any) => Promise<IpcResult<Group>>
      deleteGroup: (id: string) => Promise<IpcResult>
      getSettings: () => Promise<IpcResult<Record<string, string>>>
      updateSetting: (key: string, value: string) => Promise<IpcResult>
      getChromiumPath: () => Promise<IpcResult<string | null>>
      setChromiumPath: (path: string) => Promise<IpcResult>
      getApiToken: () => Promise<IpcResult<string>>
      rotateApiToken: () => Promise<IpcResult<string>>
      startApi: () => Promise<IpcResult>
      stopApi: () => Promise<IpcResult>
      isApiRunning: () => Promise<IpcResult<boolean>>
      getLogs: (limit?: number, level?: string, category?: string) => Promise<IpcResult<LogEntry[]>>
      clearLogs: () => Promise<IpcResult>
      getAppVersion: () => Promise<IpcResult<string>>
      openExternal: (url: string) => Promise<IpcResult>
      selectFile: (filters?: any[]) => Promise<IpcResult<string>>
      selectDirectory: () => Promise<IpcResult<string>>
      onProfileStatusChanged: (callback: (event: any, data: any) => void) => () => void
      onToast: (callback: (event: any, data: any) => void) => () => void
    }
  }
}
