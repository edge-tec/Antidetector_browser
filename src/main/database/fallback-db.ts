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
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      const createMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"'\w]+)/i)
      if (createMatch) {
        const tbl = createMatch[1].toLowerCase().replace(/[`"']/g, '')
        if (!this.tables[tbl]) this.tables[tbl] = []
      }

      // Handle INSERT in exec (e.g. migrations)
      if (/^INSERT\s+/i.test(stmt)) {
        try {
          this.executeMutation(stmt, [])
        } catch {}
      }

      // Handle ALTER TABLE ADD COLUMN
      const alterMatch = stmt.match(/ALTER\s+TABLE\s+([`"'\w]+)\s+ADD\s+(?:COLUMN\s+)?([`"'\w]+)(?:\s+\w+)?(?:\s+DEFAULT\s+([^;]+))?/i)
      if (alterMatch) {
        const tblName = alterMatch[1].toLowerCase().replace(/[`"']/g, '')
        const colName = alterMatch[2].toLowerCase().replace(/[`"']/g, '')
        let defVal: any = alterMatch[3] ? alterMatch[3].trim().replace(/^['"]|['"]$/g, '') : null
        if (defVal === "''" || defVal === '""') defVal = ''
        const tbl = this.getTable(tblName)
        for (const row of tbl) {
          if (row[colName] === undefined) {
            row[colName] = defVal
          }
        }
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
    // 1. INSERT INTO table (cols) VALUES (?, ?)
    const parsedInsert = this.parseInsertStatement(sql)
    if (parsedInsert) {
      const { modifier, tblName, colsStr, valuesStr } = parsedInsert
      const cols = this.splitTopLevelCommas(colsStr).map(c => c.toLowerCase().replace(/[`"']/g, ''))
      const rawValues = this.splitTopLevelCommas(valuesStr)
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
          row[col] = this.parseDatetimeExpr(valToken)
        } else if (/^null$/i.test(valToken)) {
          row[col] = null
        } else {
          row[col] = valToken
        }
      })

      // Check existing by id or key or other unique column
      let existingIdx = -1
      if (row.id !== undefined && row.id !== null) {
        existingIdx = tbl.findIndex(r => String(r.id) === String(row.id))
      } else if (row.key !== undefined && row.key !== null) {
        existingIdx = tbl.findIndex(r => String(r.key) === String(row.key))
      } else if (row.email !== undefined && row.email !== null) {
        existingIdx = tbl.findIndex(r => String(r.email).toLowerCase() === String(row.email).toLowerCase())
      }

      if (existingIdx >= 0) {
        if (modifier === 'IGNORE') {
          return 0
        }
        tbl[existingIdx] = { ...tbl[existingIdx], ...row }
      } else {
        tbl.push(row)
      }
      return 1
    }

    // 2. UPDATE table SET col1 = ?, col2 = ? WHERE ...
    const updateTblMatch = sql.match(/^UPDATE\s+([`"'\w]+)/i)
    if (updateTblMatch) {
      const tblName = updateTblMatch[1].toLowerCase().replace(/[`"']/g, '')
      const setMatch = sql.match(/\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i)
      if (setMatch) {
        const setClause = setMatch[1]
        const whereClause = setMatch[2] || ''
        const tbl = this.getTable(tblName)

        const setStatements = this.splitTopLevelCommas(setClause)
        let paramIdx = 0
        const updatePlan: Array<{ col: string; type: 'param' | 'literal' | 'datetime' | 'coalesce'; val: any; fallbackCol?: string }> = []

        for (const setStmt of setStatements) {
          const parts = setStmt.split('=')
          const col = parts[0].trim().toLowerCase().replace(/[`"']/g, '')
          const valExpr = parts.slice(1).join('=').trim()

          const coalesceMatch = valExpr.match(/^COALESCE\s*\(\s*\?\s*,\s*([`"'\w]+)\s*\)$/i)
          if (coalesceMatch) {
            updatePlan.push({
              col,
              type: 'coalesce',
              val: params[paramIdx++],
              fallbackCol: coalesceMatch[1].toLowerCase().replace(/[`"']/g, '')
            })
          } else if (valExpr === '?') {
            updatePlan.push({ col, type: 'param', val: params[paramIdx++] })
          } else if (/^['"].*['"]$/.test(valExpr)) {
            updatePlan.push({ col, type: 'literal', val: valExpr.slice(1, -1) })
          } else if (/^datetime\(/i.test(valExpr)) {
            updatePlan.push({ col, type: 'datetime', val: this.parseDatetimeExpr(valExpr) })
          } else if (/^null$/i.test(valExpr)) {
            updatePlan.push({ col, type: 'literal', val: null })
          } else if (!isNaN(Number(valExpr))) {
            updatePlan.push({ col, type: 'literal', val: Number(valExpr) })
          } else {
            updatePlan.push({ col, type: 'literal', val: valExpr })
          }
        }

        const whereParams = params.slice(paramIdx)
        let count = 0
        for (let i = 0; i < tbl.length; i++) {
          if (!whereClause || this.matchesWhere(tbl[i], whereClause, whereParams)) {
            const updates: any = {}
            for (const item of updatePlan) {
              if (item.type === 'coalesce') {
                updates[item.col] = item.val !== null && item.val !== undefined ? item.val : tbl[i][item.fallbackCol!]
              } else {
                updates[item.col] = item.val
              }
            }
            tbl[i] = { ...tbl[i], ...updates }
            count++
          }
        }
        return count
      }
    }

    // 3. DELETE FROM table WHERE ...
    const deleteTblMatch = sql.match(/^DELETE\s+FROM\s+([`"'\w]+)/i)
    if (deleteTblMatch) {
      const tblName = deleteTblMatch[1].toLowerCase().replace(/[`"']/g, '')
      const whereMatch = sql.match(/\s+WHERE\s+([\s\S]+)$/i)
      const whereClause = whereMatch ? whereMatch[1] : ''
      const tbl = this.getTable(tblName)
      const initialLen = tbl.length

      if (!whereClause) {
        this.tables[tblName] = []
        return initialLen
      }

      this.tables[tblName] = tbl.filter(row => !this.matchesWhere(row, whereClause, params))
      return initialLen - this.tables[tblName].length
    }

    return 0
  }

  private executeQuery(sql: string, params: any[]): any[] {
    const { selectClause, tableName, whereClause, orderByClause, limitToken, offsetToken } = this.extractTopLevelClauses(sql)
    if (!tableName) {
      return []
    }

    let results = [...this.getTable(tableName)]

    // Filter by WHERE
    if (whereClause) {
      results = results.filter(row => this.matchesWhere(row, whereClause, params))
    }

    // Handle COUNT(*) aggregate
    if (/^COUNT\s*\(/i.test(selectClause)) {
      const aliasMatch = selectClause.match(/\s+as\s+([`"'\w]+)/i)
      const colName = aliasMatch ? aliasMatch[1] : 'count'
      return [{ [colName]: results.length }]
    }

    // Handle Ordering
    if (orderByClause) {
      const orderParts = orderByClause.split(',').map(o => o.trim())
      for (const orderPart of orderParts) {
        const descMatch = orderPart.match(/^([`"'\w.]+)\s+(DESC|ASC)$/i)
        const col = descMatch ? descMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()! : orderPart.toLowerCase().replace(/[`"']/g, '').split('.').pop()!
        const isDesc = descMatch ? descMatch[2].toUpperCase() === 'DESC' : false

        results.sort((a, b) => {
          const valA = a[col] ?? ''
          const valB = b[col] ?? ''
          if (typeof valA === 'number' && typeof valB === 'number') {
            return isDesc ? valB - valA : valA - valB
          }
          const cmp = String(valA).localeCompare(String(valB))
          return isDesc ? -cmp : cmp
        })
      }
    }

    // Handle Offset and Limit parameters
    let limitVal = limitToken ? (limitToken === '?' ? undefined : parseInt(limitToken, 10)) : undefined
    let offsetVal = offsetToken ? (offsetToken === '?' ? undefined : parseInt(offsetToken, 10)) : 0

    if (limitToken === '?') {
      const lastParam = offsetToken === '?' ? params[params.length - 2] : params[params.length - 1]
      if (typeof lastParam === 'number') limitVal = lastParam
    }
    if (offsetToken === '?') {
      const lastParam = params[params.length - 1]
      if (typeof lastParam === 'number') offsetVal = lastParam
    }

    if (offsetVal !== undefined && offsetVal > 0) {
      results = results.slice(offsetVal)
    }
    if (limitVal !== undefined && !isNaN(limitVal)) {
      results = results.slice(0, limitVal)
    }

    return results
  }

  private extractTopLevelClauses(sql: string) {
    let depth = 0
    let inString = false
    let stringChar = ''
    let fromIdx = -1
    let whereIdx = -1
    let orderByIdx = -1
    let limitIdx = -1
    let groupByIdx = -1

    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i]
      if (inString) {
        if (ch === stringChar && sql[i - 1] !== '\\') inString = false
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = true
        stringChar = ch
        continue
      }
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (depth === 0) {
        const rest = sql.slice(i)
        if (fromIdx === -1 && /^\s+FROM\b/i.test(rest)) {
          fromIdx = i
        } else if (whereIdx === -1 && /^\s+WHERE\b/i.test(rest)) {
          whereIdx = i
        } else if (orderByIdx === -1 && /^\s+ORDER\s+BY\b/i.test(rest)) {
          orderByIdx = i
        } else if (groupByIdx === -1 && /^\s+GROUP\s+BY\b/i.test(rest)) {
          groupByIdx = i
        } else if (limitIdx === -1 && /^\s+LIMIT\b/i.test(rest)) {
          limitIdx = i
        }
      }
    }

    const selectClause = fromIdx > 0 ? sql.slice(0, fromIdx).replace(/^SELECT\s+/i, '').trim() : '*'
    const fromEnd = whereIdx !== -1 ? whereIdx : orderByIdx !== -1 ? orderByIdx : limitIdx !== -1 ? limitIdx : sql.length
    const fromSection = fromIdx !== -1 ? sql.slice(fromIdx, fromEnd).trim() : ''
    const fromTableMatch = fromSection.match(/^FROM\s+([`"'\w]+)/i)
    const tableName = fromTableMatch ? fromTableMatch[1].toLowerCase().replace(/[`"']/g, '') : ''

    let whereClause = ''
    if (whereIdx !== -1) {
      const whereEnd = orderByIdx !== -1 ? orderByIdx : groupByIdx !== -1 ? groupByIdx : limitIdx !== -1 ? limitIdx : sql.length
      whereClause = sql.slice(whereIdx, whereEnd).replace(/^\s*WHERE\s+/i, '').trim()
    }

    let orderByClause = ''
    if (orderByIdx !== -1) {
      const orderEnd = limitIdx !== -1 ? limitIdx : sql.length
      orderByClause = sql.slice(orderByIdx, orderEnd).replace(/^\s*ORDER\s+BY\s+/i, '').trim()
    }

    let limitToken: string | undefined
    let offsetToken: string | undefined
    if (limitIdx !== -1) {
      const limitSection = sql.slice(limitIdx).trim()
      const limitMatch = limitSection.match(/^LIMIT\s+(\d+|\?)(?:\s+OFFSET\s+(\d+|\?))?/i)
      if (limitMatch) {
        limitToken = limitMatch[1]
        offsetToken = limitMatch[2]
      }
    }

    return { selectClause, tableName, whereClause, orderByClause, limitToken, offsetToken }
  }

  /**
   * Universal evaluator for WHERE clause against a single row with parameter substitution
   */
  private matchesWhere(row: any, whereClause: string, params: any[]): boolean {
    if (!whereClause || whereClause.trim() === '1=1') return true

    // Split top-level AND conditions (while respecting parentheses)
    const andClauses = this.splitTopLevel(whereClause, 'AND')
    let paramIdx = 0

    for (const clause of andClauses) {
      const trimmed = clause.trim()
      if (!trimmed || trimmed === '1=1') continue

      // Count parameters in this clause
      const paramCount = (trimmed.match(/\?/g) || []).length
      const clauseParams = params.slice(paramIdx, paramIdx + paramCount)
      paramIdx += paramCount

      if (!this.evaluateOrClause(row, trimmed, clauseParams)) {
        return false
      }
    }

    return true
  }

  private splitTopLevel(str: string, delimiter: 'AND' | 'OR'): string[] {
    const results: string[] = []
    let depth = 0
    let lastIdx = 0
    const regex = new RegExp(`\\b${delimiter}\\b`, 'gi')
    let match: RegExpExecArray | null

    while ((match = regex.exec(str)) !== null) {
      const substr = str.slice(lastIdx, match.index)
      depth += (substr.match(/\(/g) || []).length - (substr.match(/\)/g) || []).length
      if (depth === 0) {
        results.push(str.slice(lastIdx, match.index).trim())
        lastIdx = match.index + match[0].length
      }
    }
    results.push(str.slice(lastIdx).trim())
    return results.filter(Boolean)
  }

  private evaluateOrClause(row: any, clause: string, params: any[]): boolean {
    // Strip wrapping parentheses if entire clause is parenthesized
    let clean = clause.trim()
    while (clean.startsWith('(') && clean.endsWith(')')) {
      let depth = 0
      let fullyWrapped = true
      for (let i = 0; i < clean.length - 1; i++) {
        if (clean[i] === '(') depth++
        else if (clean[i] === ')') depth--
        if (depth === 0) { fullyWrapped = false; break }
      }
      if (fullyWrapped) {
        clean = clean.slice(1, -1).trim()
      } else {
        break
      }
    }

    const orClauses = this.splitTopLevel(clean, 'OR')
    if (orClauses.length > 1) {
      let paramIdx = 0
      for (const branch of orClauses) {
        const count = (branch.match(/\?/g) || []).length
        const branchParams = params.slice(paramIdx, paramIdx + count)
        paramIdx += count
        if (this.evaluateSimpleCondition(row, branch, branchParams)) {
          return true
        }
      }
      return false
    }

    return this.evaluateSimpleCondition(row, clean, params)
  }

  private evaluateSimpleCondition(row: any, cond: string, params: any[]): boolean {
    const trimmed = cond.trim()
    if (!trimmed || trimmed === '1=1') return true

    // 1. IS NULL / IS NOT NULL
    const isNullMatch = trimmed.match(/^([`"'\w.]+)\s+IS\s+(NOT\s+)?NULL$/i)
    if (isNullMatch) {
      const col = isNullMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const isNot = Boolean(isNullMatch[2])
      const val = row[col]
      const isNull = val === null || val === undefined || val === ''
      return isNot ? !isNull : isNull
    }

    // 2. IN (...)
    const inMatch = trimmed.match(/^([`"'\w.]+)\s+(NOT\s+)?IN\s*\(([^)]+)\)$/i)
    if (inMatch) {
      const col = inMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const isNot = Boolean(inMatch[2])
      const items = inMatch[3].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
      const rowVal = String(row[col] ?? '').toLowerCase()
      const inList = items.includes(rowVal)
      return isNot ? !inList : inList
    }

    // 3. LOWER(col) = LOWER(?) or LOWER(col) LIKE ?
    const lowerMatch = trimmed.match(/^LOWER\s*\(\s*([`"'\w.]+)\s*\)\s*(=|LIKE)\s*(LOWER\s*\(\s*\?\s*\)|\?)$/i)
    if (lowerMatch) {
      const col = lowerMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const op = lowerMatch[2].toUpperCase()
      const rowVal = String(row[col] ?? '').toLowerCase()
      const paramVal = String(params[0] ?? '').toLowerCase()

      if (op === '=') {
        return rowVal === paramVal
      } else {
        const pattern = paramVal.replace(/%/g, '')
        return rowVal.includes(pattern)
      }
    }

    // 4. col LIKE ? or col LIKE 'literal'
    const likeMatch = trimmed.match(/^([`"'\w.]+)\s+(NOT\s+)?LIKE\s+(.+)$/i)
    if (likeMatch) {
      const col = likeMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const isNot = Boolean(likeMatch[2])
      const right = likeMatch[3].trim()
      let pattern = right === '?' ? String(params[0] ?? '') : right.replace(/^['"]|['"]$/g, '')
      pattern = pattern.replace(/%/g, '').toLowerCase()
      const rowVal = String(row[col] ?? '').toLowerCase()
      const matches = rowVal.includes(pattern)
      return isNot ? !matches : matches
    }

    // 5. col != ? or col <> ? or col != 'literal'
    const neqMatch = trimmed.match(/^([`"'\w.]+)\s*(?:!=|<>)\s*(.+)$/i)
    if (neqMatch) {
      const col = neqMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const right = neqMatch[2].trim()
      let expected: any = right === '?' ? params[0] : right.replace(/^['"]|['"]$/g, '')
      const actual = row[col]
      return String(actual ?? '').toLowerCase() !== String(expected ?? '').toLowerCase()
    }

    // 6. col = ? or col = 'literal' or col = 123
    const eqMatch = trimmed.match(/^([`"'\w.]+)\s*=\s*(.+)$/i)
    if (eqMatch) {
      const col = eqMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const right = eqMatch[2].trim()
      let expected: any = right === '?' ? params[0] : right.replace(/^['"]|['"]$/g, '')
      if (expected === 'true') expected = true
      if (expected === 'false') expected = false
      const actual = row[col]

      if (typeof actual === 'boolean' || typeof expected === 'boolean') {
        return Boolean(actual) === Boolean(expected)
      }
      if (typeof actual === 'number' && !isNaN(Number(expected))) {
        return actual === Number(expected)
      }
      return String(actual ?? '').toLowerCase() === String(expected ?? '').toLowerCase()
    }

    // 7. col >= ? or col <= ? or col > ? or col < ?
    const relMatch = trimmed.match(/^([`"'\w.]+)\s*(>=|<=|>|<)\s*(.+)$/i)
    if (relMatch) {
      const col = relMatch[1].toLowerCase().replace(/[`"']/g, '').split('.').pop()!
      const op = relMatch[2]
      const right = relMatch[3].trim()
      const expected = right === '?' ? params[0] : Number(right)
      const actual = row[col]

      if (op === '>=') return actual >= expected
      if (op === '<=') return actual <= expected
      if (op === '>') return actual > expected
      if (op === '<') return actual < expected
    }

    return true
  }

  private parseDatetimeExpr(expr: string): string {
    const dtMatch = expr.match(/datetime\(\s*['"]now['"](?:\s*,\s*['"]([+-]?\d+)\s*(year|month|day|hour|minute|second)s?['"])?\s*\)/i)
    const date = new Date()
    if (dtMatch && dtMatch[1] && dtMatch[2]) {
      const amount = parseInt(dtMatch[1], 10)
      const unit = dtMatch[2].toLowerCase()
      if (unit.startsWith('year')) date.setFullYear(date.getFullYear() + amount)
      else if (unit.startsWith('month')) date.setMonth(date.getMonth() + amount)
      else if (unit.startsWith('day')) date.setDate(date.getDate() + amount)
      else if (unit.startsWith('hour')) date.setHours(date.getHours() + amount)
      else if (unit.startsWith('minute')) date.setMinutes(date.getMinutes() + amount)
      else if (unit.startsWith('second')) date.setSeconds(date.getSeconds() + amount)
    }
    return date.toISOString()
  }

  private splitTopLevelCommas(str: string): string[] {
    const results: string[] = []
    let depth = 0
    let inString = false
    let stringChar = ''
    let lastIdx = 0

    for (let i = 0; i < str.length; i++) {
      const ch = str[i]
      if (inString) {
        if (ch === stringChar && str[i - 1] !== '\\') inString = false
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = true
        stringChar = ch
        continue
      }
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (depth === 0 && ch === ',') {
        results.push(str.slice(lastIdx, i).trim())
        lastIdx = i + 1
      }
    }
    results.push(str.slice(lastIdx).trim())
    return results.filter(Boolean)
  }

  private parseInsertStatement(sql: string) {
    const headerMatch = sql.match(/^INSERT\s+(?:OR\s+(REPLACE|IGNORE)\s+INTO|INTO)\s+([`"'\w]+)/i)
    if (!headerMatch) return null

    const modifier = (headerMatch[1] || '').toUpperCase()
    const tblName = headerMatch[2].toLowerCase().replace(/[`"']/g, '')

    // Extract (...) for columns
    const firstParenOpen = sql.indexOf('(', headerMatch[0].length)
    if (firstParenOpen === -1) return null

    const firstParenClose = this.findMatchingParen(sql, firstParenOpen)
    if (firstParenClose === -1) return null

    const colsStr = sql.slice(firstParenOpen + 1, firstParenClose)

    // Find VALUES
    const valuesIdx = sql.toUpperCase().indexOf('VALUES', firstParenClose)
    if (valuesIdx === -1) return null

    const secondParenOpen = sql.indexOf('(', valuesIdx)
    if (secondParenOpen === -1) return null

    const secondParenClose = this.findMatchingParen(sql, secondParenOpen)
    if (secondParenClose === -1) return null

    const valuesStr = sql.slice(secondParenOpen + 1, secondParenClose)

    return { modifier, tblName, colsStr, valuesStr }
  }

  private findMatchingParen(str: string, openIdx: number): number {
    let depth = 0
    let inString = false
    let stringChar = ''

    for (let i = openIdx; i < str.length; i++) {
      const ch = str[i]
      if (inString) {
        if (ch === stringChar && str[i - 1] !== '\\') inString = false
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = true
        stringChar = ch
        continue
      }
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) return i
      }
    }
    return -1
  }

  public close(): void {
    this.save()
  }
}
