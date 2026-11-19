// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise Team Workspace Service
// Multi-user workspaces, invitations, role updates, profile sharing,
// ownership transfer, and strict backend RBAC enforcement
// ──────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import { TeamRole, assertPermission } from '../security/rbac'
import { logger } from '../logging/logger'

export interface TeamWorkspace {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface TeamMemberRecord {
  id: string
  teamId: string
  userId: string
  email: string
  role: TeamRole
  joinedAt: string
}

export class TeamService {
  static createWorkspace(name: string, ownerId: string, ownerEmail: string): TeamWorkspace {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare('INSERT INTO teams (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      id, name.trim(), ownerId, now, now
    )
    db.prepare('INSERT INTO team_members (id, team_id, user_id, email, role, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuidv4(), id, ownerId, ownerEmail, 'owner', now
    )

    logger.info('system', `[TeamWorkspace] Created workspace "${name}" (${id}) by ${ownerId}`)
    return { id, name: name.trim(), ownerId, createdAt: now, updatedAt: now }
  }

  static getUserRole(teamId: string, userId: string): TeamRole | null {
    const db = getDatabase()
    const row = db
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, userId) as { role: TeamRole } | undefined
    return row ? row.role : null
  }

  static listWorkspacesForUser(userId: string): Array<TeamWorkspace & { role: TeamRole }> {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT t.id, t.name, t.owner_id, t.created_at, t.updated_at, tm.role
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = ?
      ORDER BY t.created_at DESC
    `).all(userId) as any[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ownerId: r.owner_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      role: r.role
    }))
  }

  static listMembers(teamId: string): TeamMemberRecord[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM team_members WHERE team_id = ? ORDER BY joined_at ASC')
      .all(teamId) as any[]
    return rows.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      userId: r.user_id,
      email: r.email,
      role: r.role,
      joinedAt: r.joined_at
    }))
  }

  static inviteMember(
    teamId: string,
    actorUserId: string,
    inviteeEmail: string,
    role: TeamRole = 'operator'
  ): { id: string; token: string; expiresAt: string } {
    const actorRole = this.getUserRole(teamId, actorUserId)
    if (!actorRole) throw new Error('Access denied: not a member of this workspace.')
    assertPermission(actorRole, 'team.invite')
    if (role === 'owner') throw new Error('Cannot invite a member directly as owner.')

    const db = getDatabase()
    const id = uuidv4()
    const token = crypto.randomBytes(24).toString('hex')
    const now = new Date()
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    db.prepare(`
      INSERT INTO team_invitations (id, team_id, email, role, token, status, invited_by, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, teamId, inviteeEmail.trim().toLowerCase(), role, token, actorUserId, now.toISOString(), expires.toISOString())

    logger.info('system', `[TeamWorkspace] Invited ${inviteeEmail} as ${role} to team ${teamId}`)
    return { id, token, expiresAt: expires.toISOString() }
  }

  static acceptInvitation(token: string, userId: string, userEmail: string): TeamMemberRecord {
    const db = getDatabase()
    const inv = db
      .prepare("SELECT * FROM team_invitations WHERE token = ? AND status = 'pending'")
      .get(token) as any
    if (!inv) throw new Error('Invitation is invalid or has already been used.')
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      throw new Error('Invitation has expired.')
    }

    const now = new Date().toISOString()
    const memberId = uuidv4()
    db.prepare(`
      INSERT OR REPLACE INTO team_members (id, team_id, user_id, email, role, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(memberId, inv.team_id, userId, userEmail.trim().toLowerCase(), inv.role, now)
    db.prepare("UPDATE team_invitations SET status = 'accepted' WHERE id = ?").run(inv.id)

    return { id: memberId, teamId: inv.team_id, userId, email: userEmail, role: inv.role, joinedAt: now }
  }

  static updateMemberRole(teamId: string, actorUserId: string, targetUserId: string, newRole: TeamRole): boolean {
    const actorRole = this.getUserRole(teamId, actorUserId)
    if (!actorRole) throw new Error('Access denied: not a member of this workspace.')
    assertPermission(actorRole, 'team.manage')
    if (newRole === 'owner' && actorRole !== 'owner') {
      throw new Error('Only workspace owners can assign owner role.')
    }

    const db = getDatabase()
    const res = db
      .prepare('UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?')
      .run(newRole, teamId, targetUserId)
    return res.changes > 0
  }

  static removeMember(teamId: string, actorUserId: string, targetUserId: string): boolean {
    const actorRole = this.getUserRole(teamId, actorUserId)
    if (!actorRole) throw new Error('Access denied: not a member of this workspace.')
    assertPermission(actorRole, 'team.manage')
    if (actorUserId === targetUserId) throw new Error('Cannot remove yourself from the workspace.')

    const db = getDatabase()
    const res = db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(teamId, targetUserId)
    return res.changes > 0
  }

  static shareProfile(
    teamId: string,
    actorUserId: string,
    profileId: string,
    options: { targetUserId?: string; canEdit?: boolean; canLaunch?: boolean; hideProxyPass?: boolean }
  ): string {
    const actorRole = this.getUserRole(teamId, actorUserId)
    if (!actorRole) throw new Error('Access denied: not a member of this workspace.')
    assertPermission(actorRole, 'profile.share')

    const db = getDatabase()
    const id = uuidv4()
    db.prepare(`
      INSERT INTO profile_shares (id, profile_id, team_id, target_user_id, can_edit, can_launch, hide_proxy_pass, shared_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      profileId,
      teamId,
      options.targetUserId || null,
      options.canEdit ? 1 : 0,
      options.canLaunch !== false ? 1 : 0,
      options.hideProxyPass !== false ? 1 : 0,
      actorUserId,
      new Date().toISOString()
    )
    return id
  }

  static transferProfileOwnership(teamId: string, actorUserId: string, profileId: string, newOwnerUserId: string): boolean {
    const actorRole = this.getUserRole(teamId, actorUserId)
    if (!actorRole) throw new Error('Access denied: not a member of this workspace.')
    assertPermission(actorRole, 'profile.share')

    const db = getDatabase()
    const res = db
      .prepare('UPDATE profiles SET user_id = ?, team_id = ?, updated_at = ? WHERE id = ?')
      .run(newOwnerUserId, teamId, new Date().toISOString(), profileId)
    return res.changes > 0
  }
}
