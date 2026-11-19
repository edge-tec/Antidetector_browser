import React, { useState, useEffect, useCallback } from 'react'
import { enterpriseService } from '../../services/enterpriseService'
import { useAuth } from '../../context/AuthContext'
import type { Profile } from '../../types'
import type { TeamWorkspaceItem, TeamMemberRecord, TeamRole, ShowToastFn } from '../../types/enterprise'

const ROLES: TeamRole[] = ['owner', 'admin', 'manager', 'operator', 'viewer']

export function TeamWorkspacePage({ showToast }: { showToast: ShowToastFn }) {
  const { currentUser } = useAuth()
  const userId = currentUser?.id || 'admin-default'
  const userEmail = currentUser?.email || 'admin@antiprofiles.com'

  const [teams, setTeams] = useState<TeamWorkspaceItem[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [members, setMembers] = useState<TeamMemberRecord[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [newTeamName, setNewTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('operator')
  const [lastInviteToken, setLastInviteToken] = useState('')
  const [acceptToken, setAcceptToken] = useState('')

  const [shareProfileId, setShareProfileId] = useState('')
  const [hideProxyPass, setHideProxyPass] = useState(true)

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null

  const loadWorkspaces = useCallback(async () => {
    try {
      const [list, profRes] = await Promise.all([
        enterpriseService.listTeams(userId),
        window.api.getProfiles()
      ])
      setTeams(list || [])
      if (profRes?.success && Array.isArray(profRes.data)) setProfiles(profRes.data)
      if (list && list.length > 0 && !selectedTeamId) {
        setSelectedTeamId(list[0].id)
      }
    } catch (err: any) {
      showToast('error', `Failed to load team workspaces: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [userId, selectedTeamId, showToast])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([])
      setPermissions([])
      return
    }
    enterpriseService.listTeamMembers(selectedTeamId).then(setMembers).catch(() => {})
    if (selectedTeam) {
      enterpriseService.getRolePermissions(selectedTeam.role).then(setPermissions).catch(() => {})
    }
  }, [selectedTeamId, selectedTeam])

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return showToast('warning', 'Enter a workspace name.')
    try {
      const created = await enterpriseService.createTeam(newTeamName.trim(), userId, userEmail)
      setNewTeamName('')
      setSelectedTeamId(created.id)
      showToast('success', `Workspace "${created.name}" created`)
      await loadWorkspaces()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleInvite = async () => {
    if (!selectedTeamId || !inviteEmail.trim()) return
    try {
      const inv = await enterpriseService.inviteTeamMember(selectedTeamId, userId, inviteEmail.trim(), inviteRole)
      setLastInviteToken(inv.token)
      setInviteEmail('')
      showToast('success', `Invitation created for ${inviteEmail} (${inviteRole})`)
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleAcceptInvite = async () => {
    if (!acceptToken.trim()) return
    try {
      await enterpriseService.acceptTeamInvite(acceptToken.trim(), userId, userEmail)
      setAcceptToken('')
      showToast('success', 'Joined team workspace!')
      await loadWorkspaces()
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleRoleChange = async (targetUserId: string, role: TeamRole) => {
    if (!selectedTeamId) return
    try {
      await enterpriseService.updateTeamMemberRole(selectedTeamId, userId, targetUserId, role)
      showToast('success', `Updated role to ${role}`)
      setMembers(await enterpriseService.listTeamMembers(selectedTeamId))
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleRemoveMember = async (targetUserId: string) => {
    if (!selectedTeamId) return
    try {
      await enterpriseService.removeTeamMember(selectedTeamId, userId, targetUserId)
      showToast('success', 'Member removed from workspace')
      setMembers(await enterpriseService.listTeamMembers(selectedTeamId))
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  const handleShareProfile = async () => {
    if (!selectedTeamId || !shareProfileId) return
    try {
      await enterpriseService.shareProfile(selectedTeamId, userId, shareProfileId, {
        canLaunch: true,
        canEdit: false,
        hideProxyPass
      })
      showToast('success', 'Profile shared with team workspace')
      setShareProfileId('')
    } catch (err: any) {
      showToast('error', err.message)
    }
  }

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><span>Loading Team Workspace...</span></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Workspace & RBAC</h1>
          <p className="page-subtitle">Manage workspaces, backend-enforced role permissions, invitations, and secure profile sharing</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            placeholder="New workspace name..."
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            style={{ width: 200 }}
          />
          <button className="btn btn-primary" onClick={handleCreateTeam}>+ Create Workspace</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Left: Workspaces & Accept Invite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Your Workspaces ({teams.length})</h3>
            {teams.length === 0 ? (
              <div className="text-secondary" style={{ fontSize: 12 }}>No workspaces yet. Create one above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {teams.map((t) => (
                  <button
                    key={t.id}
                    className={`btn ${selectedTeamId === t.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => setSelectedTeamId(t.id)}
                  >
                    <span>{t.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.85 }}>{t.role.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Accept Team Invitation</h4>
            <input
              className="form-input"
              placeholder="Paste invite token..."
              value={acceptToken}
              onChange={(e) => setAcceptToken(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }}
            />
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={handleAcceptInvite}>Join Workspace</button>
          </div>
        </div>

        {/* Right: Active Workspace Details */}
        {!selectedTeam ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
            <h3>Select or Create a Team Workspace</h3>
            <p className="text-secondary">Collaborate with granular Owner, Admin, Manager, Operator, and Viewer roles.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Invite & Share Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Invite Member</h4>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="form-input" placeholder="member@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
                  <select className="form-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TeamRole)} style={{ width: 115 }}>
                    {ROLES.filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary btn-sm" disabled={!permissions.includes('team.invite')} onClick={handleInvite}>
                  Generate Invite Token
                </button>
                {lastInviteToken && (
                  <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', padding: 8, borderRadius: 6, background: 'var(--color-bg-tertiary)' }}>
                    Token: {lastInviteToken}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Share Profile to Workspace</h4>
                <select className="form-select" value={shareProfileId} onChange={(e) => setShareProfileId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
                  <option value="">— Select profile —</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
                  <input type="checkbox" checked={hideProxyPass} onChange={(e) => setHideProxyPass(e.target.checked)} />
                  Hide proxy credentials from Operator/Viewer roles
                </label>
                <button className="btn btn-primary btn-sm" disabled={!shareProfileId || !permissions.includes('profile.share')} onClick={handleShareProfile}>
                  Share Profile
                </button>
              </div>
            </div>

            {/* Members Table */}
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Members ({members.length})</h4>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.email}</td>
                      <td>
                        <select
                          className="form-select"
                          value={m.role}
                          disabled={m.userId === userId || !permissions.includes('team.manage')}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as TeamRole)}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
                      <td>
                        {m.userId !== userId && permissions.includes('team.manage') && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.userId)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Active Role Permissions */}
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Your Backend-Enforced Permissions ({selectedTeam.role.toUpperCase()})</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {permissions.map((perm) => (
                  <span key={perm} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
