// ──────────────────────────────────────────────
// AntiProfiles — Shared Types (Renderer)
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

export type Page = 'dashboard' | 'profiles' | 'groups' | 'proxies' | 'automation' | 'settings' | 'logs' | 'support' | 'affiliate'

export type ConversationStatus = 'open' | 'pending' | 'waiting_user' | 'waiting_support' | 'closed'
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type SenderType = 'user' | 'agent' | 'system'

export interface SupportConversation {
  id: string
  user_id: string
  assigned_agent_id: string | null
  status: ConversationStatus
  priority: ConversationPriority
  subject: string
  last_message_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
  user_name?: string
  user_email?: string
  assigned_agent_name?: string
  unread_count?: number
  last_message_preview?: string
  user_plan?: string
  user_status?: string
  user_created_at?: string
}

export interface SupportMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_type: SenderType
  message: string
  message_type: 'text' | 'attachment' | 'system_event'
  attachment_path: string | null
  attachment_name: string | null
  attachment_size: number | null
  attachment_mime: string | null
  is_read: number
  read_at: string | null
  created_at: string
  sender_name?: string
}

export interface SupportInternalNote {
  id: string
  conversation_id: string
  agent_id: string
  agent_name: string
  note: string
  created_at: string
}

export interface SupportSettingsMap {
  support_enabled: string
  support_available: string
  business_hours: string
  welcome_message: string
  offline_message: string
  auto_reply_enabled: string
  auto_reply_message: string
  max_attachment_size_mb: string
  allowed_file_types: string
  notification_sound_enabled: string
  max_open_conversations_per_user: string
  rate_limit_messages_per_min: string
}


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
      autoDetectBrowser: () => Promise<IpcResult<{ detectedPath: string | null; allBrowsers: Array<{ name: string; engine: string; path: string; version: string }> }>>
      testBrowser: (executablePath: string) => Promise<IpcResult<{ valid: boolean; exists: boolean; isExecutable: boolean; version: string; engine: string; path: string; error?: string }>>
      getBrowserDiagnostics: () => Promise<IpcResult<any>>
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
      getSyncStatus: () => Promise<any>
      resyncAuthoritativeState: () => Promise<any>
      reconnectSync: () => Promise<any>
      checkPermission: (permission: string) => Promise<{ permission: string; allowed: boolean }>
      getAuthoritativeState: () => Promise<any>
      onSyncStatusChanged: (callback: (event: any, data: any) => void) => () => void
      onAuthStateUpdated: (callback: (event: any, data: any) => void) => () => void
      onSessionRevoked: (callback: (event: any, data: any) => void) => () => void
      onRealtimeSyncEvent: (callback: (event: any, data: any) => void) => () => void
      [key: string]: any
    }
  }
}
