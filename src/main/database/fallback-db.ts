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
    const lower = sql.toLowerCase()

    // INSERT INTO table (cols) VALUES (?, ?)
    const insertMatch = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+INTO|INTO)\s+([`"'\w]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
    if (insertMatch) {
      const tblName = insertMatch[1].toLowerCase().replace(/[`"']/g, '')
      const cols = insertMatch[2].split(',').map(c => c.trim().toLowerCase().replace(/[`"']/g, ''))
      const tbl = this.getTable(tblName)

      const row: any = {}
      cols.forEach((col, idx) => {
        row[col] = params[idx] !== undefined ? params[idx] : null
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

    // UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
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

      let count = 0
      for (let i = 0; i < tbl.length; i++) {
        let matches = true
        if (whereClause) {
          const idMatch = whereClause.match(/id\s*=\s*\?/i)
          if (idMatch && params[paramIdx] !== undefined) {
            matches = String(tbl[i].id) === String(params[paramIdx])
          }
          const emailMatch = whereClause.match(/email\s*=\s*\?/i)
          if (emailMatch && params[paramIdx] !== undefined) {
            matches = String(tbl[i].email).toLowerCase() === String(params[paramIdx]).toLowerCase()
          }
        }
        if (matches) {
          tbl[i] = { ...tbl[i], ...updates }
          count++
        }
      }
      return count
    }

    // DELETE FROM table WHERE id = ?
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
    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+([`"'\w]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+[\s\S]+?)?(?:\s+LIMIT\s+\d+)?$/i)
    if (!selectMatch) {
      // Return empty array for unparsed complex queries
      return []
    }

    const tblName = selectMatch[2].toLowerCase().replace(/[`"']/g, '')
    const whereClause = selectMatch[3] || ''
    const tbl = this.getTable(tblName)

    if (!whereClause || params.length === 0) {
      return [...tbl]
    }

    // Basic condition evaluation
    return tbl.filter(row => {
      if (whereClause.includes('id = ?') && params[0] !== undefined) {
        return String(row.id) === String(params[0])
      }
      if (whereClause.includes('email = ?') && params[0] !== undefined) {
        return String(row.email || '').toLowerCase() === String(params[0]).toLowerCase()
      }
      if (whereClause.includes('google_id = ?') && params[0] !== undefined) {
        return String(row.google_id || '') === String(params[0])
      }
      if (whereClause.includes('status = ?') && params[0] !== undefined) {
        return String(row.status || '') === String(params[0])
      }
      if (whereClause.includes('group_id = ?') && params[0] !== undefined) {
        return String(row.group_id || '') === String(params[0])
      }
      return true
    })
  }

  public close(): void {
    this.save()
  }
}
