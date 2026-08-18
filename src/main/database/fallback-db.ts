// ──────────────────────────────────────────────
// AntiProfiles — Fault-Tolerant Persistent JSON/SQLite Fallback Engine
// Used when native better-sqlite3 cannot be loaded (e.g. architecture mismatch on Intel macOS)
// ──────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

export class FallbackDatabase {
  private filePath: string
  private tables: Record<string, any[]> = {}

  constructor(filePath: string) {
    this.filePath = filePath.replace(/\.db$/, '_fallback.json')
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.tables = JSON.parse(raw) || {}
      }
    } catch {
      this.tables = {}
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.tables, null, 2), 'utf-8')
    } catch (e) {
      console.error('[FallbackDB] Save error:', e)
    }
  }

  private getTable(name: string): any[] {
    const cleanName = name.toLowerCase().replace(/[`"']/g, '')
    if (!this.tables[cleanName]) {
      this.tables[cleanName] = []
    }
    return this.tables[cleanName]
  }

  public pragma(_stmt: string): void {
    // No-op for pragma statements in fallback mode
  }

  public exec(sql: string): void {
    // Simple table creation / alter table extractor
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      const createMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"'\w]+)/i)
      if (createMatch) {
        const tbl = createMatch[1].toLowerCase().replace(/[`"']/g, '')
        if (!this.tables[tbl]) this.tables[tbl] = []
      }
    }
    this.save()
  }

  public transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      const res = fn(...args)
      this.save()
      return res
    }) as T
  }

  public prepare(sql: string) {
    const trimmed = sql.trim()
    const self = this

    return {
      run(...params: any[]) {
        let args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
        const changes = self.executeMutation(trimmed, args)
        self.save()
        return { changes, lastInsertRowid: Date.now() }
      },
      get(...params: any[]) {
        let args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
        const rows = self.executeQuery(trimmed, args)
        return rows.length > 0 ? rows[0] : undefined
      },
      all(...params: any[]) {
        let args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
        return self.executeQuery(trimmed, args)
      }
    }
  }

  private executeMutation(sql: string, params: any[]): number {
    // INSERT INTO table (cols) VALUES (?, ?)
    const insertMatch = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+INTO|INTO)\s+([`"'\w]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
    if (insertMatch) {
      const tblName = insertMatch[1].toLowerCase().replace(/[`"']/g, '')
      const cols = insertMatch[2].split(',').map(c => c.trim().toLowerCase().replace(/[`"']/g, ''))
      const rawValues = insertMatch[3].split(',').map(v => v.trim())
      const tbl = this.getTable(tblName)

      let paramIdx = 0
      const row: any = {}
      cols.forEach((col, idx) => {
        const valToken = rawValues[idx] || '?'
        if (valToken === '?') {
          row[col] = params[paramIdx] !== undefined ? params[paramIdx] : null
          paramIdx++
        } else if (/^['"].*['"]$/.test(valToken)) {
          row[col] = valToken.slice(1, -1)
        } else if (!isNaN(Number(valToken))) {
          row[col] = Number(valToken)
        } else if (/^datetime\(/i.test(valToken)) {
          row[col] = new Date().toISOString()
        } else {
          row[col] = valToken
        }
      })

      // If ID exists, replace existing or push new
      const existingIdx = tbl.findIndex(r => r.id && row.id && String(r.id) === String(row.id))
      if (existingIdx >= 0) {
        tbl[existingIdx] = { ...tbl[existingIdx], ...row }
      } else {
        tbl.push(row)
      }
      return 1
    }

    // UPDATE table SET col1 = ?, col2 = ? WHERE ...
    const updateMatch = sql.match(/UPDATE\s+([`"'\w]+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i)
    if (updateMatch) {
      const tblName = updateMatch[1].toLowerCase().replace(/[`"']/g, '')
      const setClause = updateMatch[2]
      const whereClause = updateMatch[3] || ''
      const tbl = this.getTable(tblName)

      const setCols = setClause.split(',').map(s => {
        const parts = s.split('=')
        return parts[0].trim().toLowerCase().replace(/[`"']/g, '')
      })

      let paramIdx = 0
      const updates: any = {}
      for (const col of setCols) {
        updates[col] = params[paramIdx++]
      }

      const whereParams = params.slice(paramIdx)
      let count = 0
      for (let i = 0; i < tbl.length; i++) {
        let matches = true
        if (whereClause) {
          const idMatch = whereClause.match(/\bid\s*=\s*\?/i)
          if (idMatch && whereParams[0] !== undefined) {
            matches = String(tbl[i].id) === String(whereParams[0])
          }
          const emailMatch = whereClause.match(/\bemail\s*=\s*\?/i)
          if (emailMatch && whereParams[0] !== undefined) {
            matches = String(tbl[i].email).toLowerCase() === String(whereParams[0]).toLowerCase()
          }
          const keyMatch = whereClause.match(/\bkey\s*=\s*\?/i)
          if (keyMatch && whereParams[0] !== undefined) {
            matches = String(tbl[i].key) === String(whereParams[0])
          }
        }
        if (matches) {
          tbl[i] = { ...tbl[i], ...updates }
          count++
        }
      }
      return count
    }

    // DELETE FROM table WHERE ...
    const deleteMatch = sql.match(/DELETE\s+FROM\s+([`"'\w]+)(?:\s+WHERE\s+([\s\S]+))?$/i)
    if (deleteMatch) {
      const tblName = deleteMatch[1].toLowerCase().replace(/[`"']/g, '')
      const tbl = this.getTable(tblName)
      const initialLen = tbl.length

      if (params.length > 0) {
        const idVal = String(params[0])
        this.tables[tblName] = tbl.filter(r => String(r.id) !== idVal && String(r.profile_id) !== idVal)
        return initialLen - this.tables[tblName].length
      } else {
        this.tables[tblName] = []
        return initialLen
      }
    }

    return 0
  }

  private executeQuery(sql: string, params: any[]): any[] {
    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+([`"'\w]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?$/i)
    if (!selectMatch) {
      return []
    }

    const tblName = selectMatch[2].toLowerCase().replace(/[`"']/g, '')
    const whereClause = selectMatch[3] || ''
    const orderByClause = selectMatch[4] || ''
    const limitClause = selectMatch[5]
    let results = [...this.getTable(tblName)]

    if (whereClause && params.length > 0) {
      let paramIdx = 0

      // Exact single ID lookup
      if (/^\s*id\s*=\s*\?\s*$/i.test(whereClause.trim())) {
        const targetId = String(params[0])
        results = results.filter(r => String(r.id) === targetId)
        return results
      }

      // Email lookup
      if (/email/i.test(whereClause) && !/name\s+LIKE/i.test(whereClause)) {
        const targetEmail = String(params[0] || '').toLowerCase()
        results = results.filter(r => String(r.email || '').toLowerCase() === targetEmail)
        return results
      }

      // Key lookup (settings)
      if (/^\s*key\s*=\s*\?\s*$/i.test(whereClause.trim())) {
        const targetKey = String(params[0])
        results = results.filter(r => String(r.key) === targetKey)
        return results
      }

      // Handle multi-condition queries (e.g. Profiles list query)
      if (whereClause.includes('user_id = ?')) {
        const uid = params[paramIdx++]
        if (uid) {
          results = results.filter(r => String(r.user_id || 'admin-default') === String(uid))
        }
      }

      if (whereClause.includes('LIKE ?')) {
        const searchParam = params[paramIdx++]
        // Consume subsequent search params if 3 LIKEs were used
        if (whereClause.includes('notes LIKE ?')) paramIdx++
        if (whereClause.includes('tags LIKE ?')) paramIdx++

        if (searchParam) {
          const query = String(searchParam).replace(/%/g, '').toLowerCase()
          if (query) {
            results = results.filter(r =>
              String(r.name || '').toLowerCase().includes(query) ||
              String(r.notes || '').toLowerCase().includes(query) ||
              String(r.tags || '').toLowerCase().includes(query)
            )
          }
        }
      }

      if (whereClause.includes('group_id = ?')) {
        const gid = params[paramIdx++]
        if (gid) {
          results = results.filter(r => String(r.group_id) === String(gid))
        }
      }

      if (whereClause.includes('status = ?')) {
        const stat = params[paramIdx++]
        if (stat) {
          results = results.filter(r => String(r.status) === String(stat))
        }
      }

      if (whereClause.includes('profile_id = ?')) {
        const pid = params[paramIdx++]
        if (pid) {
          results = results.filter(r => String(r.profile_id) === String(pid))
        }
      }
    }

    // Handle Ordering
    if (orderByClause) {
      if (/updated_at\s+DESC/i.test(orderByClause)) {
        results.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      } else if (/created_at\s+DESC/i.test(orderByClause)) {
        results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      } else if (/created_at\s+ASC/i.test(orderByClause)) {
        results.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
      }
    }

    // Handle Limit
    if (limitClause) {
      const limit = parseInt(limitClause, 10)
      if (!isNaN(limit)) {
        results = results.slice(0, limit)
      }
    }

    return results
  }

  public close(): void {
    this.save()
  }
}
