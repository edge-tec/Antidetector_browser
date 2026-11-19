// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Granular Role-Based Access Control (RBAC)
// Backend-enforced permission matrix for Team Workspaces
// ──────────────────────────────────────────────────────────────────

export type TeamRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer'

export type Permission =
  | 'profile.create'
  | 'profile.view'
  | 'profile.edit'
  | 'profile.delete'
  | 'profile.restore'
  | 'profile.launch'
  | 'profile.share'
  | 'proxy.view'
  | 'proxy.manage'
  | 'team.invite'
  | 'team.manage'
  | 'billing.manage'
  | 'audit.view'

const ROLE_PERMISSIONS: Record<TeamRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
    'profile.create', 'profile.view', 'profile.edit', 'profile.delete', 'profile.restore', 'profile.launch', 'profile.share',
    'proxy.view', 'proxy.manage',
    'team.invite', 'team.manage',
    'billing.manage', 'audit.view'
  ]),
  admin: new Set<Permission>([
    'profile.create', 'profile.view', 'profile.edit', 'profile.delete', 'profile.restore', 'profile.launch', 'profile.share',
    'proxy.view', 'proxy.manage',
    'team.invite', 'team.manage',
    'audit.view'
  ]),
  manager: new Set<Permission>([
    'profile.create', 'profile.view', 'profile.edit', 'profile.delete', 'profile.restore', 'profile.launch', 'profile.share',
    'proxy.view', 'proxy.manage',
    'team.invite', 'audit.view'
  ]),
  operator: new Set<Permission>([
    'profile.view', 'profile.launch', 'proxy.view'
  ]),
  viewer: new Set<Permission>([
    'profile.view'
  ])
}

export function hasPermission(role: TeamRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  return !!perms && perms.has(permission)
}

export function getPermissionsForRole(role: TeamRole): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] || [])
}

export function assertPermission(role: TeamRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Access denied: role "${role}" lacks required permission "${permission}".`)
  }
}

/**
 * Redact proxy credentials when returning proxy objects to non-privileged roles.
 */
export function sanitizeProxyForRole<T extends Record<string, any>>(proxy: T, role: TeamRole): T {
  if (hasPermission(role, 'proxy.manage')) return proxy
  const copy: any = { ...proxy }
  delete copy.encryptedPassword
  delete copy.password
  if (copy.username) copy.username = '***'
  return copy
}
