// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Strict Enterprise UI Types (Phase P4)
// Matches exact IPC return shapes from src/main/ipc/enterprise.ipc.ts
// ──────────────────────────────────────────────────────────────────

export type KernelEngine = 'chromium' | 'firefox'
export type TeamRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer'
export type TileGridLayout = '2x2' | '3x3' | '4x4' | 'custom'

export interface InstalledKernelInfo {
  id: string
  engine: KernelEngine
  channel: 'stable' | 'esr' | 'devedition'
  version: string
  major: number
  label: string
  recommended?: boolean
  installed: boolean
  installDir: string
  executablePath: string | null
  sizeBytes: number
  integrityStatus: 'verified' | 'unverified' | 'missing'
  installedAt?: string
}

export interface TrashedProfile {
  id: string
  name: string
  osType: string
  groupId: string | null
  deletedAt: string
  deletedBy: string
  daysRemaining: number
}

export interface ManagedExtension {
  id: string
  name: string
  version: string
  manifestVersion: number
  description: string
  storagePath: string
  permissions: string[]
  riskWarnings: string[]
  sha256: string
  enabled: boolean
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

export interface ManagedCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface SyncSessionState {
  active: boolean
  masterProfileId: string | null
  followerProfileIds: string[]
  excludedProfileIds: string[]
  connectedFollowers: string[]
  logs: Array<{ timestamp: string; message: string; level: 'info' | 'warn' | 'error' }>
}

export interface SyncActionPayload {
  type: 'navigate' | 'reload' | 'back' | 'forward' | 'scroll' | 'click' | 'type'
  url?: string
  x?: number
  y?: number
  deltaX?: number
  deltaY?: number
  text?: string
}

export type RpaActionType =
  | 'open_url'
  | 'back'
  | 'forward'
  | 'wait'
  | 'click'
  | 'type'
  | 'select'
  | 'scroll'
  | 'screenshot'
  | 'extract'
  | 'set_variable'
  | 'condition'
  | 'loop'

export interface RpaStep {
  id: string
  type: RpaActionType
  label?: string
  url?: string
  selector?: string
  value?: string
  ms?: number
  deltaY?: number
  variableName?: string
  conditionVar?: string
  conditionEquals?: string
  loopCount?: number
  children?: RpaStep[]
}

export interface RpaWorkflow {
  id: string
  name: string
  description: string
  steps: RpaStep[]
  variables: Record<string, string>
  scheduleCron: string
  scheduleTz: string
  scheduleActive: boolean
  maxRetries: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface RpaExecutionRecord {
  id: string
  workflowId: string
  profileId: string
  status: 'queued' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed'
  logs: Array<{ timestamp: string; message: string }>
  error: string
  startedAt: string
  finishedAt: string | null
}

export interface EncryptedArchiveMetadata {
  id: string
  profileId: string
  versionNum: number
  provider: string
  remoteKey: string
  sha256: string
  sizeBytes: number
  ivHex: string
  saltHex: string
  authTagHex: string
  createdBy: string
  createdAt: string
}

export interface TeamWorkspaceItem {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
  role: TeamRole
}

export interface TeamMemberRecord {
  id: string
  teamId: string
  userId: string
  email: string
  role: TeamRole
  joinedAt: string
}

export type ShowToastFn = (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
