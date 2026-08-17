// ──────────────────────────────────────────────
// ProfileVault — User Repository
// ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../connection'
import {
  User, UserRow, UserCreateInput, UserUpdateInput, UserDisplay,
  userFromRow, userToDisplay
} from '../models'
import { hashPassword } from '../../security/password'

export class UserRepository {
  create(input: UserCreateInput): UserDisplay {
    const db = getDatabase()
    const id = uuidv4()
    const passwordHash = input.password ? hashPassword(input.password) : null
    const role = input.role || 'user'
    const emailVerified = input.emailVerified ?? false
    const accountStatus = input.accountStatus || (emailVerified ? 'active' : 'pending')
    const googleId = input.googleId || null

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, email_verified, account_status, google_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      input.name.trim(),
      input.email.trim().toLowerCase(),
      passwordHash,
      role,
      emailVerified ? 1 : 0,
      accountStatus,
      googleId
    )

    return this.getDisplayById(id)!
  }

  createWithId(input: UserCreateInput & { id: string }): UserDisplay {
    const db = getDatabase()
    const id = input.id
    const passwordHash = input.password ? hashPassword(input.password) : null
    const role = input.role || 'user'
    const emailVerified = input.emailVerified ?? false
    const accountStatus = input.accountStatus || (emailVerified ? 'active' : 'pending')
    const googleId = input.googleId || null

    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, email_verified, account_status, google_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      input.name.trim(),
      input.email.trim().toLowerCase(),
      passwordHash,
      role,
      emailVerified ? 1 : 0,
      accountStatus,
      googleId
    )

    return this.getDisplayById(id)!
  }

  getById(id: string): User | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? userFromRow(row) : null
  }

  getByEmail(email: string): User | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as UserRow | undefined
    return row ? userFromRow(row) : null
  }

  getByGoogleId(googleId: string): User | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as UserRow | undefined
    return row ? userFromRow(row) : null
  }

  getDisplayById(id: string): UserDisplay | null {
    const user = this.getById(id)
    if (!user) return null
    const count = this.getUserProfileCount(id)
    return userToDisplay(user, count)
  }

  update(id: string, input: UserUpdateInput): UserDisplay | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const sets: string[] = ['updated_at = datetime(\'now\')']
    const params: any[] = []

    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name.trim()) }
    if (input.email !== undefined) { sets.push('email = ?'); params.push(input.email.trim().toLowerCase()) }
    if (input.password !== undefined) { sets.push('password_hash = ?'); params.push(input.password ? hashPassword(input.password) : null) }
    if (input.role !== undefined) { sets.push('role = ?'); params.push(input.role) }
    if (input.emailVerified !== undefined) { sets.push('email_verified = ?'); params.push(input.emailVerified ? 1 : 0) }
    if (input.accountStatus !== undefined) { sets.push('account_status = ?'); params.push(input.accountStatus) }
    if (input.googleId !== undefined) { sets.push('google_id = ?'); params.push(input.googleId) }
    if (input.lastLoginAt !== undefined) { sets.push('last_login_at = ?'); params.push(input.lastLoginAt) }

    params.push(id)
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getDisplayById(id)
  }

  verifyEmail(id: string): UserDisplay | null {
    return this.update(id, { emailVerified: true, accountStatus: 'active' })
  }

  updateStatus(id: string, accountStatus: 'active' | 'pending' | 'suspended'): UserDisplay | null {
    return this.update(id, { accountStatus })
  }

  updateRole(id: string, role: 'admin' | 'user'): UserDisplay | null {
    return this.update(id, { role })
  }

  delete(id: string): boolean {
    const user = this.getById(id)
    if (user && user.role === 'admin' && this.countAdmins() <= 1) {
      throw new Error('Cannot delete the only remaining administrator account.')
    }
    const db = getDatabase()
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    return result.changes > 0
  }

  countAdmins(): number {
    const db = getDatabase()
    const row = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND account_status != 'suspended'").get() as { count: number }
    return row ? row.count : 0
  }

  getUserProfileCount(userId: string): number {
    try {
      const db = getDatabase()
      const row = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE user_id = ?').get(userId) as { count: number }
      return row ? row.count : 0
    } catch {
      return 0
    }
  }

  listUsers(filter?: { query?: string; role?: string; status?: string }): UserDisplay[] {
    const db = getDatabase()
    let sql = 'SELECT * FROM users WHERE 1=1'
    const params: any[] = []

    if (filter?.query) {
      sql += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)'
      const q = `%${filter.query.trim().toLowerCase()}%`
      params.push(q, q)
    }
    if (filter?.role) {
      sql += ' AND role = ?'
      params.push(filter.role)
    }
    if (filter?.status) {
      sql += ' AND account_status = ?'
      params.push(filter.status)
    }

    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params) as UserRow[]
    return rows.map(r => {
      const u = userFromRow(r)
      const count = this.getUserProfileCount(u.id)
      return userToDisplay(u, count)
    })
  }
}

export const userRepo = new UserRepository()
