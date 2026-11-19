// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise IPC Handlers
// Wires Multi-Kernel Runtimes, Diagnostics, Trash, Extension Center,
// Cookie Manager, Multi-Window Synchronizer, RPA, Cloud Sync,
// Team Workspaces, and Proxy Rotation to Renderer via contextBridge
// ──────────────────────────────────────────────────────────────────

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { multiKernelManager, KernelEngine } from '../browser/multi-kernel-manager'

/**
 * Validate that IPC requests originate strictly from the trusted Electron app renderer
 * (file:// bundle or local Vite dev server) and never from untrusted remote web origins.
 */
export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const url = event?.senderFrame?.url || ''
  if (!url) return // Allow internal/unit-test invocation with no browser frame
  const isTrusted =
    url.startsWith('file://') ||
    url.startsWith('http://localhost:') ||
    url.startsWith('http://127.0.0.1:')
  if (!isTrusted) {
    throw new Error(`Security rejection: untrusted IPC sender origin "${url}"`)
  }
}

function secureHandle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => any): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event)
    return handler(event, ...args)
  })
}
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
  secureHandle('enterprise:kernels:list', (_e, engine?: KernelEngine) => {
    return multiKernelManager.listRuntimes(engine)
  })
  secureHandle('enterprise:kernels:install', async (_e, releaseId: string) => {
    return multiKernelManager.installKernel(releaseId)
  })
  secureHandle('enterprise:kernels:uninstall', (_e, releaseId: string) => {
    return multiKernelManager.uninstallKernel(releaseId)
  })
  secureHandle('enterprise:kernels:cleanup-cache', () => {
    return multiKernelManager.cleanupCache()
  })
  secureHandle('enterprise:diagnostics:system', () => {
    return RuntimeDiagnosticsService.getSystemDiagnostics()
  })
  secureHandle('enterprise:diagnostics:profile', (_e, profileId: string) => {
    return RuntimeDiagnosticsService.getProfileDiagnostics(profileId)
  })

  // ── Trash & Recycle Bin ──
  secureHandle('enterprise:trash:move', async (_e, profileId: string, deletedBy?: string) => {
    return TrashManager.moveToTrash(profileId, deletedBy)
  })
  secureHandle('enterprise:trash:list', (_e, userId?: string) => {
    return TrashManager.listTrash(userId)
  })
  secureHandle('enterprise:trash:restore', (_e, profileId: string) => {
    return TrashManager.restoreProfile(profileId)
  })
  secureHandle('enterprise:trash:bulk-restore', (_e, profileIds: string[]) => {
    return TrashManager.bulkRestore(profileIds)
  })
  secureHandle('enterprise:trash:permanent-delete', async (_e, profileId: string) => {
    return TrashManager.permanentDelete(profileId)
  })
  secureHandle('enterprise:trash:purge-expired', async () => {
    return TrashManager.purgeExpired()
  })

  // ── Extension Center ──
  secureHandle('enterprise:extensions:list', (_e, search?: string) => {
    return ExtensionManager.listExtensions(search)
  })
  secureHandle('enterprise:extensions:upload', (_e, packagePath: string, uploadedBy?: string) => {
    return ExtensionManager.uploadExtensionPackage(packagePath, uploadedBy)
  })
  secureHandle('enterprise:extensions:toggle', (_e, extensionId: string, enabled: boolean) => {
    return ExtensionManager.setExtensionEnabled(extensionId, enabled)
  })
  secureHandle('enterprise:extensions:remove', (_e, extensionId: string) => {
    return ExtensionManager.removeExtension(extensionId)
  })
  secureHandle('enterprise:extensions:assign-profile', (_e, extensionId: string, profileId: string) => {
    ExtensionManager.assignToProfile(extensionId, profileId)
    return { success: true }
  })
  secureHandle('enterprise:extensions:assign-group', (_e, extensionId: string, groupId: string) => {
    ExtensionManager.assignToGroup(extensionId, groupId)
    return { success: true }
  })

  // ── Cookie & Session Manager ──
  secureHandle('enterprise:cookies:get', async (_e, profileId: string, domainFilter?: string) => {
    return CookieManager.getCookies(profileId, domainFilter)
  })
  secureHandle('enterprise:cookies:import', async (_e, profileId: string, rawPayload: string) => {
    return CookieManager.importCookies(profileId, rawPayload)
  })
  secureHandle('enterprise:cookies:export', async (_e, profileId: string, domainFilter?: string) => {
    return CookieManager.exportCookies(profileId, domainFilter)
  })
  secureHandle('enterprise:cookies:delete', async (_e, profileId: string, name: string, domain: string) => {
    return CookieManager.deleteCookie(profileId, name, domain)
  })
  secureHandle('enterprise:cookies:clear', async (_e, profileId: string) => {
    await CookieManager.clearCookies(profileId)
    return { success: true }
  })

  // ── Multi-Window Synchronizer ──
  secureHandle('enterprise:sync:status', () => windowSynchronizer.getStatus())
  secureHandle('enterprise:sync:start', async (_e, masterProfileId: string, followerProfileIds: string[]) => {
    return windowSynchronizer.startSync(masterProfileId, followerProfileIds)
  })
  secureHandle('enterprise:sync:stop', () => windowSynchronizer.stopSync())
  secureHandle('enterprise:sync:exclude', (_e, profileId: string, excluded: boolean) => {
    return windowSynchronizer.setWindowExcluded(profileId, excluded)
  })
  secureHandle('enterprise:sync:broadcast', async (_e, action: SyncActionPayload) => {
    return windowSynchronizer.broadcastAction(action)
  })
  secureHandle('enterprise:sync:tile', async (_e, profileIds: string[], layout: TileGridLayout, screenBounds?: { width: number; height: number }) => {
    return windowSynchronizer.tileWindows(profileIds, layout, screenBounds)
  })

  // ── No-Code RPA Automation ──
  secureHandle('enterprise:rpa:list', () => rpaEngine.listWorkflows())
  secureHandle('enterprise:rpa:create', (_e, input: any) => rpaEngine.createWorkflow(input))
  secureHandle('enterprise:rpa:delete', (_e, id: string) => rpaEngine.deleteWorkflow(id))
  secureHandle('enterprise:rpa:execute', async (_e, workflowId: string, profileId: string) => {
    return rpaEngine.executeWorkflow(workflowId, profileId)
  })
  secureHandle('enterprise:rpa:pause', (_e, executionId: string) => rpaEngine.pauseExecution(executionId))
  secureHandle('enterprise:rpa:resume', (_e, executionId: string) => rpaEngine.resumeExecution(executionId))
  secureHandle('enterprise:rpa:stop', (_e, executionId: string) => rpaEngine.stopExecution(executionId))
  secureHandle('enterprise:rpa:execution', (_e, executionId: string) => rpaEngine.getExecution(executionId))

  // ── E2E Encrypted Cloud Sync ──
  secureHandle('enterprise:cloud:status', () => cloudSyncEngine.getProviderStatus())
  secureHandle('enterprise:cloud:backup', async (_e, profileId: string, passphrase: string, createdBy?: string) => {
    return cloudSyncEngine.backupProfile(profileId, passphrase, createdBy)
  })
  secureHandle('enterprise:cloud:list', (_e, profileId: string) => {
    return cloudSyncEngine.listBackups(profileId)
  })
  secureHandle('enterprise:cloud:restore', async (_e, backupId: string, passphrase: string) => {
    return cloudSyncEngine.restoreBackup(backupId, passphrase)
  })

  // ── Team Workspace & RBAC ──
  secureHandle('enterprise:team:create', (_e, name: string, ownerId: string, ownerEmail: string) => {
    return TeamService.createWorkspace(name, ownerId, ownerEmail)
  })
  secureHandle('enterprise:team:list', (_e, userId: string) => TeamService.listWorkspacesForUser(userId))
  secureHandle('enterprise:team:members', (_e, teamId: string) => TeamService.listMembers(teamId))
  secureHandle('enterprise:team:invite', (_e, teamId: string, actorId: string, email: string, role: TeamRole) => {
    return TeamService.inviteMember(teamId, actorId, email, role)
  })
  secureHandle('enterprise:team:accept-invite', (_e, token: string, userId: string, email: string) => {
    return TeamService.acceptInvitation(token, userId, email)
  })
  secureHandle('enterprise:team:update-role', (_e, teamId: string, actorId: string, targetId: string, role: TeamRole) => {
    return TeamService.updateMemberRole(teamId, actorId, targetId, role)
  })
  secureHandle('enterprise:team:remove-member', (_e, teamId: string, actorId: string, targetId: string) => {
    return TeamService.removeMember(teamId, actorId, targetId)
  })
  secureHandle('enterprise:team:share-profile', (_e, teamId: string, actorId: string, profileId: string, opts: any) => {
    return TeamService.shareProfile(teamId, actorId, profileId, opts)
  })
  secureHandle('enterprise:team:permissions', (_e, role: TeamRole) => getPermissionsForRole(role))

  // ── Proxy Rotation & Failover ──
  secureHandle('enterprise:proxy:configure', (_e, proxyId: string, config: any) => {
    return ProxyRotationManager.configureProxyEnterprise(proxyId, config)
  })
  secureHandle('enterprise:proxy:rotate', async (_e, proxyId: string) => {
    return ProxyRotationManager.rotateProxy(proxyId)
  })
  secureHandle('enterprise:proxy:rotation-history', (_e, proxyId: string, limit?: number) => {
    return ProxyRotationManager.getRotationHistory(proxyId, limit)
  })
}
