// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Strongly Typed Enterprise Frontend Service Layer
// Wraps window.api.enterprise.* exposed by src/preload/index.ts
// ──────────────────────────────────────────────────────────────────

import type {
  KernelEngine,
  InstalledKernelInfo,
  TrashedProfile,
  ManagedExtension,
  ManagedCookie,
  SyncSessionState,
  SyncActionPayload,
  TileGridLayout,
  RpaWorkflow,
  RpaExecutionRecord,
  EncryptedArchiveMetadata,
  TeamWorkspaceItem,
  TeamMemberRecord,
  TeamRole
} from '../types/enterprise'

function getEnterpriseApi(): any {
  const api = (window as any)?.api?.enterprise
  if (!api) {
    throw new Error('Enterprise IPC bridge is unavailable. Please restart the application.')
  }
  return api
}

export const enterpriseService = {
  // Multi-Kernel Runtimes & Diagnostics
  listKernels: (engine?: KernelEngine): Promise<InstalledKernelInfo[]> =>
    getEnterpriseApi().listKernels(engine),
  installKernel: (releaseId: string): Promise<InstalledKernelInfo> =>
    getEnterpriseApi().installKernel(releaseId),
  uninstallKernel: (releaseId: string): Promise<boolean> =>
    getEnterpriseApi().uninstallKernel(releaseId),
  cleanupKernelCache: (): Promise<{ removedFiles: number; freedBytes: number }> =>
    getEnterpriseApi().cleanupKernelCache(),
  getSystemDiagnostics: (): Promise<any> =>
    getEnterpriseApi().getSystemDiagnostics(),
  getProfileDiagnostics: (profileId: string): Promise<any> =>
    getEnterpriseApi().getProfileDiagnostics(profileId),

  // Trash & Recycle Bin
  moveToTrash: (profileId: string, deletedBy?: string): Promise<boolean> =>
    getEnterpriseApi().moveToTrash(profileId, deletedBy),
  listTrash: (userId?: string): Promise<TrashedProfile[]> =>
    getEnterpriseApi().listTrash(userId),
  restoreFromTrash: (profileId: string): Promise<boolean> =>
    getEnterpriseApi().restoreFromTrash(profileId),
  bulkRestoreFromTrash: (profileIds: string[]): Promise<{ restored: number }> =>
    getEnterpriseApi().bulkRestoreFromTrash(profileIds),
  permanentDeleteFromTrash: (profileId: string): Promise<boolean> =>
    getEnterpriseApi().permanentDeleteFromTrash(profileId),
  purgeExpiredTrash: (): Promise<{ purged: number }> =>
    getEnterpriseApi().purgeExpiredTrash(),

  // Extension Center
  listExtensions: (search?: string): Promise<ManagedExtension[]> =>
    getEnterpriseApi().listExtensions(search),
  uploadExtension: (packagePath: string, uploadedBy?: string): Promise<ManagedExtension> =>
    getEnterpriseApi().uploadExtension(packagePath, uploadedBy),
  toggleExtension: (extensionId: string, enabled: boolean): Promise<boolean> =>
    getEnterpriseApi().toggleExtension(extensionId, enabled),
  removeExtension: (extensionId: string): Promise<boolean> =>
    getEnterpriseApi().removeExtension(extensionId),
  assignExtensionToProfile: (extensionId: string, profileId: string): Promise<{ success: boolean }> =>
    getEnterpriseApi().assignExtensionToProfile(extensionId, profileId),
  assignExtensionToGroup: (extensionId: string, groupId: string): Promise<{ success: boolean }> =>
    getEnterpriseApi().assignExtensionToGroup(extensionId, groupId),

  // Cookie & Session Manager
  getCookies: (profileId: string, domainFilter?: string): Promise<ManagedCookie[]> =>
    getEnterpriseApi().getCookies(profileId, domainFilter),
  importCookies: (profileId: string, rawPayload: string): Promise<{ imported: number }> =>
    getEnterpriseApi().importCookies(profileId, rawPayload),
  exportCookies: (profileId: string, domainFilter?: string): Promise<string> =>
    getEnterpriseApi().exportCookies(profileId, domainFilter),
  deleteCookie: (profileId: string, name: string, domain: string): Promise<boolean> =>
    getEnterpriseApi().deleteCookie(profileId, name, domain),
  clearCookies: (profileId: string): Promise<{ success: boolean }> =>
    getEnterpriseApi().clearCookies(profileId),

  // Multi-Window Synchronizer
  getSyncStatus: (): Promise<SyncSessionState> =>
    getEnterpriseApi().getSyncStatus(),
  startSync: (masterProfileId: string, followerProfileIds: string[]): Promise<SyncSessionState> =>
    getEnterpriseApi().startSync(masterProfileId, followerProfileIds),
  stopSync: (): Promise<SyncSessionState> =>
    getEnterpriseApi().stopSync(),
  excludeSyncWindow: (profileId: string, excluded: boolean): Promise<SyncSessionState> =>
    getEnterpriseApi().excludeSyncWindow(profileId, excluded),
  broadcastSyncAction: (action: SyncActionPayload): Promise<{ succeeded: string[]; failed: Array<{ profileId: string; error: string }> }> =>
    getEnterpriseApi().broadcastSyncAction(action),
  tileSyncWindows: (profileIds: string[], layout: TileGridLayout, screenBounds?: { width: number; height: number }): Promise<{ arranged: number; failed: number }> =>
    getEnterpriseApi().tileSyncWindows(profileIds, layout, screenBounds),

  // No-Code RPA Automation
  listWorkflows: (): Promise<RpaWorkflow[]> =>
    getEnterpriseApi().listWorkflows(),
  createWorkflow: (input: Partial<RpaWorkflow> & { name: string; steps: RpaWorkflow['steps'] }): Promise<RpaWorkflow> =>
    getEnterpriseApi().createWorkflow(input),
  deleteWorkflow: (id: string): Promise<boolean> =>
    getEnterpriseApi().deleteWorkflow(id),
  executeWorkflow: (workflowId: string, profileId: string): Promise<RpaExecutionRecord> =>
    getEnterpriseApi().executeWorkflow(workflowId, profileId),
  pauseExecution: (executionId: string): Promise<boolean> =>
    getEnterpriseApi().pauseExecution(executionId),
  resumeExecution: (executionId: string): Promise<boolean> =>
    getEnterpriseApi().resumeExecution(executionId),
  stopExecution: (executionId: string): Promise<boolean> =>
    getEnterpriseApi().stopExecution(executionId),
  getExecution: (executionId: string): Promise<RpaExecutionRecord | null> =>
    getEnterpriseApi().getExecution(executionId),

  // E2E Encrypted Cloud Profile Sync
  getCloudSyncStatus: (): Promise<{ provider: string; s3Configured: boolean }> =>
    getEnterpriseApi().getCloudSyncStatus(),
  backupProfileCloud: (profileId: string, passphrase: string, createdBy?: string): Promise<EncryptedArchiveMetadata> =>
    getEnterpriseApi().backupProfileCloud(profileId, passphrase, createdBy),
  listCloudBackups: (profileId: string): Promise<EncryptedArchiveMetadata[]> =>
    getEnterpriseApi().listCloudBackups(profileId),
  restoreCloudBackup: (backupId: string, passphrase: string): Promise<{ restoredFiles: number; profileId: string; versionNum: number }> =>
    getEnterpriseApi().restoreCloudBackup(backupId, passphrase),

  // Team Workspace & RBAC
  createTeam: (name: string, ownerId: string, ownerEmail: string): Promise<TeamWorkspaceItem> =>
    getEnterpriseApi().createTeam(name, ownerId, ownerEmail),
  listTeams: (userId: string): Promise<TeamWorkspaceItem[]> =>
    getEnterpriseApi().listTeams(userId),
  listTeamMembers: (teamId: string): Promise<TeamMemberRecord[]> =>
    getEnterpriseApi().listTeamMembers(teamId),
  inviteTeamMember: (teamId: string, actorId: string, email: string, role: TeamRole): Promise<{ id: string; token: string; expiresAt: string }> =>
    getEnterpriseApi().inviteTeamMember(teamId, actorId, email, role),
  acceptTeamInvite: (token: string, userId: string, email: string): Promise<TeamMemberRecord> =>
    getEnterpriseApi().acceptTeamInvite(token, userId, email),
  updateTeamMemberRole: (teamId: string, actorId: string, targetId: string, role: TeamRole): Promise<boolean> =>
    getEnterpriseApi().updateTeamMemberRole(teamId, actorId, targetId, role),
  removeTeamMember: (teamId: string, actorId: string, targetId: string): Promise<boolean> =>
    getEnterpriseApi().removeTeamMember(teamId, actorId, targetId),
  shareProfile: (teamId: string, actorId: string, profileId: string, opts: { targetUserId?: string; canEdit?: boolean; canLaunch?: boolean; hideProxyPass?: boolean }): Promise<string> =>
    getEnterpriseApi().shareProfile(teamId, actorId, profileId, opts),
  getRolePermissions: (role: TeamRole): Promise<string[]> =>
    getEnterpriseApi().getRolePermissions(role),

  // Proxy Rotation & Failover
  configureProxyEnterprise: (proxyId: string, config: { rotationUrl?: string; failoverProxyId?: string | null; proxyGroup?: string }): Promise<boolean> =>
    getEnterpriseApi().configureProxyEnterprise(proxyId, config),
  rotateProxy: (proxyId: string): Promise<any> =>
    getEnterpriseApi().rotateProxy(proxyId),
  getProxyRotationHistory: (proxyId: string, limit?: number): Promise<any[]> =>
    getEnterpriseApi().getProxyRotationHistory(proxyId, limit)
}
