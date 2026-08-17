// ──────────────────────────────────────────────
// AntiProfiles — Group Repository
// ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../connection'
import { Group, GroupCreateInput, GroupRow, groupFromRow } from '../models'

export class GroupRepository {
  getAll(): Group[] {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT g.*, COUNT(p.id) as profile_count
      FROM groups g
      LEFT JOIN profiles p ON p.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name ASC
    `).all() as GroupRow[]
    return rows.map(groupFromRow)
  }

  getById(id: string): Group | null {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT g.*, COUNT(p.id) as profile_count
      FROM groups g
      LEFT JOIN profiles p ON p.group_id = g.id
      WHERE g.id = ?
      GROUP BY g.id
    `).get(id) as GroupRow | undefined
    return row ? groupFromRow(row) : null
  }

  create(input: GroupCreateInput): Group {
    const db = getDatabase()
    const id = uuidv4()

    db.prepare('INSERT INTO groups (id, name, color) VALUES (?, ?, ?)')
      .run(id, input.name, input.color ?? '#6366F1')

    return this.getById(id)!
  }

  update(id: string, input: Partial<GroupCreateInput>): Group | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const sets: string[] = []
    const params: any[] = []

    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
    if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color) }

    if (sets.length === 0) return existing

    params.push(id)
    db.prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDatabase()
    // Unlink profiles from this group
    db.prepare('UPDATE profiles SET group_id = NULL WHERE group_id = ?').run(id)
    const result = db.prepare('DELETE FROM groups WHERE id = ?').run(id)
    return result.changes > 0
  }
}

export const groupRepo = new GroupRepository()
