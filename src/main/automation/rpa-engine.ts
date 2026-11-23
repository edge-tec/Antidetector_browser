// ──────────────────────────────────────────────────────────────────
// AntiProfiles — No-Code RPA Automation Engine & Scheduler
// Supports 13+ structured actions, variables, conditionals, loops,
// pause/resume/stop controls, and execution history
// ──────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/connection'
import { processTracker } from '../browser/process-tracker'
import { logger } from '../logging/logger'

export type RpaActionType =
  | 'open_url'
  | 'back'
  | 'forward'
  | 'wait'
  | 'click'
  | 'type'
  | 'select'
  | 'scroll'
  | 'screenshot'
  | 'extract'
  | 'set_variable'
  | 'condition'
  | 'loop'

export interface RpaStep {
  id: string
  type: RpaActionType
  label?: string
  url?: string
  selector?: string
  value?: string
  ms?: number
  deltaY?: number
  variableName?: string
  conditionVar?: string
  conditionEquals?: string
  loopCount?: number
  children?: RpaStep[]
}

export interface RpaWorkflow {
  id: string
  name: string
  description: string
  steps: RpaStep[]
  variables: Record<string, string>
  scheduleCron: string
  scheduleTz: string
  scheduleActive: boolean
  maxRetries: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface RpaExecutionRecord {
  id: string
  workflowId: string
  profileId: string
  status: 'queued' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed'
  logs: Array<{ timestamp: string; message: string }>
  error: string
  startedAt: string
  finishedAt: string | null
}

interface ActiveRunControl {
  paused: boolean
  stopped: boolean
}

/**
 * Lightweight 5-field Cron Expression Matcher (`min hour dom month dow`).
 */
export function matchesCronExpression(cronExpr: string, date: Date = new Date()): boolean {
  const trimmed = String(cronExpr || '').trim()
  if (!trimmed) return false
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 5) return false

  const values = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay()
  ]

  const matchField = (field: string, val: number): boolean => {
    if (field === '*') return true
    for (const segment of field.split(',')) {
      if (segment.startsWith('*/')) {
        const step = parseInt(segment.slice(2), 10)
        if (step > 0 && val % step === 0) return true
      } else if (segment.includes('-')) {
        const [minS, maxS] = segment.split('-')
        const min = parseInt(minS, 10)
        const max = parseInt(maxS, 10)
        if (val >= min && val <= max) return true
      } else if (parseInt(segment, 10) === val) {
        return true
      }
    }
    return false
  }

  return parts.every((field, idx) => matchField(field, values[idx]))
}

class RpaEngine {
  private activeRuns = new Map<string, ActiveRunControl>()
  private schedulerTimer: NodeJS.Timeout | null = null
  private lastTriggeredMinute = ''

  /**
   * Start background cron scheduler loop that evaluates active scheduled workflows every 30s.
   */
  startScheduler(defaultProfileResolver?: () => string | null): void {
    if (this.schedulerTimer) return
    this.schedulerTimer = setInterval(async () => {
      try {
        const now = new Date()
        const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}:${now.getUTCMinutes()}`
        if (minuteKey === this.lastTriggeredMinute) return

        const workflows = this.listWorkflows().filter((w) => w.scheduleActive && w.scheduleCron)
        for (const wf of workflows) {
          if (matchesCronExpression(wf.scheduleCron, now)) {
            this.lastTriggeredMinute = minuteKey
            const targetProfileId = wf.variables?.profileId || defaultProfileResolver?.() || ''
            if (targetProfileId && processTracker.isRunning(targetProfileId)) {
              logger.info('automation', `[RPAScheduler] Auto-triggering scheduled workflow "${wf.name}" on profile ${targetProfileId}`)
              this.executeWorkflow(wf.id, targetProfileId).catch((err) => {
                logger.warn('automation', `[RPAScheduler] Scheduled run failed: ${err.message}`)
              })
            }
          }
        }
      } catch {}
    }, 30000)
  }

  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
  }

  createWorkflow(input: {
    name: string
    description?: string
    steps: RpaStep[]
    variables?: Record<string, string>
    scheduleCron?: string
    scheduleTz?: string
    scheduleActive?: boolean
    maxRetries?: number
    createdBy?: string
  }): RpaWorkflow {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO automation_workflows (id, name, description, steps_json, variables_json, schedule_cron, schedule_tz, schedule_active, max_retries, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.description || '',
      JSON.stringify(input.steps || []),
      JSON.stringify(input.variables || {}),
      input.scheduleCron || '',
      input.scheduleTz || 'UTC',
      input.scheduleActive ? 1 : 0,
      input.maxRetries ?? 1,
      input.createdBy || 'admin',
      now,
      now
    )

    return this.getWorkflow(id)!
  }

  getWorkflow(id: string): RpaWorkflow | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM automation_workflows WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      steps: JSON.parse(row.steps_json || '[]'),
      variables: JSON.parse(row.variables_json || '{}'),
      scheduleCron: row.schedule_cron || '',
      scheduleTz: row.schedule_tz || 'UTC',
      scheduleActive: !!row.schedule_active,
      maxRetries: row.max_retries ?? 1,
      createdBy: row.created_by || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  listWorkflows(): RpaWorkflow[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT id FROM automation_workflows ORDER BY updated_at DESC').all() as Array<{ id: string }>
    return rows.map((r) => this.getWorkflow(r.id)!).filter(Boolean)
  }

  deleteWorkflow(id: string): boolean {
    const db = getDatabase()
    const res = db.prepare('DELETE FROM automation_workflows WHERE id = ?').run(id)
    return res.changes > 0
  }

  pauseExecution(executionId: string): boolean {
    const ctrl = this.activeRuns.get(executionId)
    if (!ctrl) return false
    ctrl.paused = true
    this.updateExecutionStatus(executionId, 'paused')
    return true
  }

  resumeExecution(executionId: string): boolean {
    const ctrl = this.activeRuns.get(executionId)
    if (!ctrl) return false
    ctrl.paused = false
    this.updateExecutionStatus(executionId, 'running')
    return true
  }

  stopExecution(executionId: string): boolean {
    const ctrl = this.activeRuns.get(executionId)
    if (!ctrl) return false
    ctrl.stopped = true
    ctrl.paused = false
    this.updateExecutionStatus(executionId, 'stopped')
    return true
  }

  getExecution(executionId: string): RpaExecutionRecord | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM automation_executions WHERE id = ?').get(executionId) as any
    if (!row) return null
    return {
      id: row.id,
      workflowId: row.workflow_id,
      profileId: row.profile_id,
      status: row.status,
      logs: JSON.parse(row.logs_json || '[]'),
      error: row.error || '',
      startedAt: row.started_at,
      finishedAt: row.finished_at || null
    }
  }

  /**
   * Execute a workflow against a running browser profile via CDP/Puppeteer.
   */
  async executeWorkflow(workflowId: string, profileId: string): Promise<RpaExecutionRecord> {
    const workflow = this.getWorkflow(workflowId)
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)

    const tracked = processTracker.get(profileId)
    if (!tracked?.browser || !tracked.browser.connected) {
      throw new Error(`Profile ${profileId} must be running with an active browser session before running RPA.`)
    }

    const db = getDatabase()
    const executionId = uuidv4()
    const startedAt = new Date().toISOString()
    const logs: Array<{ timestamp: string; message: string }> = []
    const vars: Record<string, string> = { ...workflow.variables }
    const ctrl: ActiveRunControl = { paused: false, stopped: false }
    this.activeRuns.set(executionId, ctrl)

    const log = (msg: string) => {
      logs.push({ timestamp: new Date().toISOString(), message: msg })
      db.prepare('UPDATE automation_executions SET logs_json = ? WHERE id = ?').run(JSON.stringify(logs), executionId)
    }

    db.prepare(`
      INSERT INTO automation_executions (id, workflow_id, profile_id, status, logs_json, error, started_at)
      VALUES (?, ?, ?, 'running', '[]', '', ?)
    `).run(executionId, workflowId, profileId, startedAt)

    const interpolate = (input?: string): string => {
      if (!input) return ''
      return input.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
    }

    const pages = await tracked.browser.pages()
    const page = pages[0] || await tracked.browser.newPage()

    const runSteps = async (steps: RpaStep[]) => {
      for (const step of steps) {
        while (ctrl.paused && !ctrl.stopped) {
          await new Promise((r) => setTimeout(r, 250))
        }
        if (ctrl.stopped) break

        log(`Executing [${step.type}] ${step.label || step.selector || step.url || ''}`.trim())

        switch (step.type) {
          case 'open_url':
            await page.goto(interpolate(step.url), { waitUntil: 'domcontentloaded', timeout: 30000 })
            break
          case 'back':
            await page.goBack({ timeout: 10000 }).catch(() => {})
            break
          case 'forward':
            await page.goForward({ timeout: 10000 }).catch(() => {})
            break
          case 'wait':
            await new Promise((r) => setTimeout(r, Math.min(step.ms || 1000, 60000)))
            break
          case 'click':
            if (step.selector) {
              const el = await page.waitForSelector(step.selector, { timeout: 15000 })
              if (el) {
                const box = await el.boundingBox()
                if (box) {
                  // Human-like quadratic curve mouse movement + micro-jitter
                  const targetX = box.x + box.width / 2 + (Math.random() * 6 - 3)
                  const targetY = box.y + box.height / 2 + (Math.random() * 6 - 3)
                  await page.mouse.move(targetX * 0.5, targetY * 0.6, { steps: 6 })
                  await page.mouse.move(targetX, targetY, { steps: 8 })
                  await new Promise((r) => setTimeout(r, 35 + Math.floor(Math.random() * 55)))
                  await page.mouse.click(targetX, targetY)
                } else {
                  await page.click(step.selector)
                }
              }
            }
            break
          case 'type':
            if (step.selector) {
              await page.waitForSelector(step.selector, { timeout: 15000 })
              const textToType = interpolate(step.value)
              const humanDelay = 25 + Math.floor(Math.random() * 45)
              await page.type(step.selector, textToType, { delay: humanDelay })
            }
            break
          case 'select':
            if (step.selector && step.value) {
              await page.select(step.selector, interpolate(step.value))
            }
            break
          case 'scroll':
            await page.evaluate((dy) => window.scrollBy(0, dy), step.deltaY ?? 400)
            break
          case 'screenshot': {
            const b64 = await page.screenshot({ encoding: 'base64' })
            if (step.variableName) vars[step.variableName] = `data:image/png;base64,${b64.slice(0, 64)}...`
            log('Captured page screenshot')
            break
          }
          case 'extract':
            if (step.selector && step.variableName) {
              const txt = await page.$eval(step.selector, (el: any) => (el.textContent || '').trim()).catch(() => '')
              vars[step.variableName] = txt
              log(`Extracted ${step.variableName}="${txt.slice(0, 80)}"`)
            }
            break
          case 'set_variable':
            if (step.variableName) vars[step.variableName] = interpolate(step.value)
            break
          case 'condition':
            if (step.conditionVar && vars[step.conditionVar] === interpolate(step.conditionEquals) && step.children) {
              await runSteps(step.children)
            }
            break
          case 'loop': {
            const count = Math.min(Math.max(1, step.loopCount || 1), 100)
            for (let i = 0; i < count && !ctrl.stopped; i++) {
              vars._loopIndex = String(i)
              if (step.children) await runSteps(step.children)
            }
            break
          }
        }
      }
    }

    try {
      await runSteps(workflow.steps)
      const finalStatus = ctrl.stopped ? 'stopped' : 'completed'
      const finishedAt = new Date().toISOString()
      db.prepare('UPDATE automation_executions SET status = ?, logs_json = ?, finished_at = ? WHERE id = ?').run(
        finalStatus, JSON.stringify(logs), finishedAt, executionId
      )
      logger.info('automation', `[RPA] Workflow "${workflow.name}" ${finalStatus} on profile ${profileId}`)
    } catch (err: any) {
      const finishedAt = new Date().toISOString()
      log(`Error: ${err.message}`)
      db.prepare('UPDATE automation_executions SET status = ?, error = ?, logs_json = ?, finished_at = ? WHERE id = ?').run(
        'failed', err.message, JSON.stringify(logs), finishedAt, executionId
      )
      logger.error('automation', `[RPA] Workflow "${workflow.name}" failed: ${err.message}`)
    } finally {
      this.activeRuns.delete(executionId)
    }

    return this.getExecution(executionId)!
  }

  private updateExecutionStatus(executionId: string, status: string): void {
    try {
      const db = getDatabase()
      db.prepare('UPDATE automation_executions SET status = ? WHERE id = ?').run(status, executionId)
    } catch {}
  }
}

export const rpaEngine = new RpaEngine()
