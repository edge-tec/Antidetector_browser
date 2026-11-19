// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise IPC Handlers
// Wires Multi-Kernel Runtimes, Diagnostics, Trash, Extension Center,
// Cookie Manager, Multi-Window Synchronizer, RPA, Cloud Sync,
// Team Workspaces, and Proxy Rotation to Renderer via contextBridge
// ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { multiKernelManager, KernelEngine } from '../browser/multi-kernel-manager'
import { RuntimeDiagnosticsService } from '../browser/runtime-diagnostics'
import { TrashManager } from '../browser/trash-manager'
import { ExtensionManager } from '../browser/extension-manager'
import { CookieManager } from '../browser/cookie-manager'
import { windowSynchronizer, SyncActionPayload, TileGridLayout } from '../browser/window-synchronizer'
import { rpaEngine } from '../automation/rpa-engine'
import { cloudSyncEngine } from '../storage/cloud-sync-engine'
import { TeamService } from '../services/team.service'
import { ProxyRotationManager } from '../network/proxy-rotation'
import { getPermissionsForRole, TeamRole } from '../security/rbac'

export function registerEnterpriseHandlers(): void {
  // ── Multi-Kernel Browser Runtimes & Diagnostics ──
  ipcMain.handle('enterprise:kernels:list', (_e, engine?: KernelEngine) => {
    return multiKernelManager.listRuntimes(engine)
  })
  ipcMain.handle('enterprise:kernels:install', async (_e, releaseId: string) => {
    return multiKernelManager.installKernel(releaseId)
  })
  ipcMain.handle('enterprise:kernels:uninstall', (_e, releaseId: string) => {
    return multiKernelManager.uninstallKernel(releaseId)
  })
  ipcMain.handle('enterprise:kernels:cleanup-cache', () => {
    return multiKernelManager.cleanupCache()
  })
  ipcMain.handle('enterprise:diagnostics:system', () => {
    return RuntimeDiagnosticsService.getSystemDiagnostics()
  })
  ipcMain.handle('enterprise:diagnostics:profile', (_e, profileId: string) => {
    return RuntimeDiagnosticsService.getProfileDiagnostics(profileId)
  })

  // ── Trash & Recycle Bin ──
  ipcMain.handle('enterprise:trash:move', async (_e, profileId: string, deletedBy?: string) => {
    return TrashManager.moveToTrash(profileId, deletedBy)
  })
  ipcMain.handle('enterprise:trash:list', (_e, userId?: string) => {
    return TrashManager.listTrash(userId)
  })
  ipcMain.handle('enterprise:trash:restore', (_e, profileId: string) => {
    return TrashManager.restoreProfile(profileId)
  })
  ipcMain.handle('enterprise:trash:bulk-restore', (_e, profileIds: string[]) => {
    return TrashManager.bulkRestore(profileIds)
  })
  ipcMain.handle('enterprise:trash:permanent-delete', async (_e, profileId: string) => {
    return TrashManager.permanentDelete(profileId)
  })
  ipcMain.handle('enterprise:trash:purge-expired', async () => {
    return TrashManager.purgeExpired()
  })

  // ── Extension Center ──
  ipcMain.handle('enterprise:extensions:list', (_e, search?: string) => {
    return ExtensionManager.listExtensions(search)
  })
  ipcMain.handle('enterprise:extensions:upload', (_e, packagePath: string, uploadedBy?: string) => {
    return ExtensionManager.uploadExtensionPackage(packagePath, uploadedBy)
  })
  ipcMain.handle('enterprise:extensions:toggle', (_e, extensionId: string, enabled: boolean) => {
    return ExtensionManager.setExtensionEnabled(extensionId, enabled)
  })
  ipcMain.handle('enterprise:extensions:remove', (_e, extensionId: string) => {
    return ExtensionManager.removeExtension(extensionId)
  })
  ipcMain.handle('enterprise:extensions:assign-profile', (_e, extensionId: string, profileId: string) => {
    ExtensionManager.assignToProfile(extensionId, profileId)
    return { success: true }
  })
  ipcMain.handle('enterprise:extensions:assign-group', (_e, extensionId: string, groupId: string) => {
    ExtensionManager.assignToGroup(extensionId, groupId)
    return { success: true }
  })

  // ── Cookie & Session Manager ──
  ipcMain.handle('enterprise:cookies:get', async (_e, profileId: string, domainFilter?: string) => {
    return CookieManager.getCookies(profileId, domainFilter)
  })
  ipcMain.handle('enterprise:cookies:import', async (_e, profileId: string, rawPayload: string) => {
    return CookieManager.importCookies(profileId, rawPayload)
  })
  ipcMain.handle('enterprise:cookies:export', async (_e, profileId: string, domainFilter?: string) => {
    return CookieManager.exportCookies(profileId, domainFilter)
  })
  ipcMain.handle('enterprise:cookies:delete', async (_e, profileId: string, name: string, domain: string) => {
    return CookieManager.deleteCookie(profileId, name, domain)
  })
  ipcMain.handle('enterprise:cookies:clear', async (_e, profileId: string) => {
    await CookieManager.clearCookies(profileId)
    return { success: true }
  })

  // ── Multi-Window Synchronizer ──
  ipcMain.handle('enterprise:sync:status', () => windowSynchronizer.getStatus())
  ipcMain.handle('enterprise:sync:start', async (_e, masterProfileId: string, followerProfileIds: string[]) => {
    return windowSynchronizer.startSync(masterProfileId, followerProfileIds)
  })
  ipcMain.handle('enterprise:sync:stop', () => windowSynchronizer.stopSync())
  ipcMain.handle('enterprise:sync:exclude', (_e, profileId: string, excluded: boolean) => {
    return windowSynchronizer.setWindowExcluded(profileId, excluded)
  })
  ipcMain.handle('enterprise:sync:broadcast', async (_e, action: SyncActionPayload) => {
    return windowSynchronizer.broadcastAction(action)
  })
  ipcMain.handle('enterprise:sync:tile', async (_e, profileIds: string[], layout: TileGridLayout, screenBounds?: { width: number; height: number }) => {
    return windowSynchronizer.tileWindows(profileIds, layout, screenBounds)
  })

  // ── No-Code RPA Automation ──
  ipcMain.handle('enterprise:rpa:list', () => rpaEngine.listWorkflows())
  ipcMain.handle('enterprise:rpa:create', (_e, input: any) => rpaEngine.createWorkflow(input))
  ipcMain.handle('enterprise:rpa:delete', (_e, id: string) => rpaEngine.deleteWorkflow(id))
  ipcMain.handle('enterprise:rpa:execute', async (_e, workflowId: string, profileId: string) => {
    return rpaEngine.executeWorkflow(workflowId, profileId)
  })
  ipcMain.handle('enterprise:rpa:pause', (_e, executionId: string) => rpaEngine.pauseExecution(executionId))
  ipcMain.handle('enterprise:rpa:resume', (_e, executionId: string) => rpaEngine.resumeExecution(executionId))
  ipcMain.handle('enterprise:rpa:stop', (_e, executionId: string) => rpaEngine.stopExecution(executionId))
  ipcMain.handle('enterprise:rpa:execution', (_e, executionId: string) => rpaEngine.getExecution(executionId))

  // ── E2E Encrypted Cloud Sync ──
  ipcMain.handle('enterprise:cloud:status', () => cloudSyncEngine.getProviderStatus())
  ipcMain.handle('enterprise:cloud:backup', async (_e, profileId: string, passphrase: string, createdBy?: string) => {
    return cloudSyncEngine.backupProfile(profileId, passphrase, createdBy)
  })
  ipcMain.handle('enterprise:cloud:list', (_e, profileId: string) => {
    return cloudSyncEngine.listBackups(profileId)
  })
  ipcMain.handle('enterprise:cloud:restore', async (_e, backupId: string, passphrase: string) => {
    return cloudSyncEngine.restoreBackup(backupId, passphrase)
  })

  // ── Team Workspace & RBAC ──
  ipcMain.handle('enterprise:team:create', (_e, name: string, ownerId: string, ownerEmail: string) => {
    return TeamService.createWorkspace(name, ownerId, ownerEmail)
  })
  ipcMain.handle('enterprise:team:list', (_e, userId: string) => TeamService.listWorkspacesForUser(userId))
  ipcMain.handle('enterprise:team:members', (_e, teamId: string) => TeamService.listMembers(teamId))
  ipcMain.handle('enterprise:team:invite', (_e, teamId: string, actorId: string, email: string, role: TeamRole) => {
    return TeamService.inviteMember(teamId, actorId, email, role)
  })
  ipcMain.handle('enterprise:team:accept-invite', (_e, token: string, userId: string, email: string) => {
    return TeamService.acceptInvitation(token, userId, email)
  })
  ipcMain.handle('enterprise:team:update-role', (_e, teamId: string, actorId: string, targetId: string, role: TeamRole) => {
    return TeamService.updateMemberRole(teamId, actorId, targetId, role)
  })
  ipcMain.handle('enterprise:team:remove-member', (_e, teamId: string, actorId: string, targetId: string) => {
    return TeamService.removeMember(teamId, actorId, targetId)
  })
  ipcMain.handle('enterprise:team:share-profile', (_e, teamId: string, actorId: string, profileId: string, opts: any) => {
    return TeamService.shareProfile(teamId, actorId, profileId, opts)
  })
  ipcMain.handle('enterprise:team:permissions', (_e, role: TeamRole) => getPermissionsForRole(role))

  // ── Proxy Rotation & Failover ──
  ipcMain.handle('enterprise:proxy:configure', (_e, proxyId: string, config: any) => {
    return ProxyRotationManager.configureProxyEnterprise(proxyId, config)
  })
  ipcMain.handle('enterprise:proxy:rotate', async (_e, proxyId: string) => {
    return ProxyRotationManager.rotateProxy(proxyId)
  })
  ipcMain.handle('enterprise:proxy:rotation-history', (_e, proxyId: string, limit?: number) => {
    return ProxyRotationManager.getRotationHistory(proxyId, limit)
  })
}
