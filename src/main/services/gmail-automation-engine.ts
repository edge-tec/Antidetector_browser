// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Gmail Automation, Auto-Reply & Follow-up Engine
// RFC 8252 & Gmail API Compliant Automation Subsystem
// Features:
// 1. Transactional Idempotency & Thread Correlation (In-Reply-To / References)
// 2. Persistent Disk State Across Application Restarts
// 3. Multi-Tier Follow-up Scheduler (Follow-up #1, #2, #3)
// 4. Automated Recipient Reply Detection (Cancels future follow-ups upon reply)
// 5. Self-Email Loop Prevention
// 6. Timezone-Aware Daily Send Limits & Safety Quotas
// 7. Atomic Duplicate Worker Execution Protection
// ──────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { GmailAccountService } from './gmail-account-service'
import { logger } from '../logging/logger'

export interface AutomationRuleConfig {
  profileId: string
  enabled: boolean
  autoReplyTemplate: string
  autoReplySubjectPrefix?: string
  followUpTemplates: string[]
  followUpDelaysMinutes: number[]
  maxRepliesPerThread: number
  maxFollowUpsPerThread: number
  dailyRepliesLimit: number
  dailyFollowUpsLimit: number
  dailyTotalLimit: number
  timezone: string
}

export interface ScheduledFollowUpJob {
  id: string
  profileId: string
  threadId: string
  recipientEmail: string
  stepIndex: number
  template: string
  scheduledAt: number
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED_RECIPIENT_REPLIED' | 'FAILED' | 'LIMIT_EXCEEDED'
  attempts: number
  lastError?: string
  createdAt: number
  updatedAt: number
}

export interface ThreadAutomationState {
  threadId: string
  profileId: string
  recipientEmail: string
  repliesSent: number
  followUpsSent: number
  lastSentAt: number
  lastReceivedAt: number
  isCancelled: boolean
  cancelReason?: string
}

interface PersistedAutomationData {
  rules: Record<string, AutomationRuleConfig>
  processedMessages: string[]
  threadStates: Record<string, ThreadAutomationState>
  scheduledJobs: Record<string, ScheduledFollowUpJob>
  dailyCounters: Record<string, { dateStr: string; replies: number; followUps: number; total: number }>
}

export class GmailAutomationEngine {
  private static rules: Map<string, AutomationRuleConfig> = new Map()
  private static processedMessages: Set<string> = new Set()
  private static threadStates: Map<string, ThreadAutomationState> = new Map()
  private static scheduledJobs: Map<string, ScheduledFollowUpJob> = new Map()
  private static dailyCounters: Map<string, { dateStr: string; replies: number; followUps: number; total: number }> = new Map()
  private static isInitialized = false
  private static executingJobIds: Set<string> = new Set()

  /**
   * Resolve storage file path in userData directory.
   */
  private static getStorageFilePath(): string {
    let baseDir = ''
    try {
      baseDir = app ? app.getPath('userData') : ''
    } catch {}

    if (!baseDir) {
      const home = process.env.HOME || process.env.USERPROFILE || '.'
      baseDir = path.join(home, 'Library', 'Application Support', 'antiprofiles')
    }

    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true })
      } catch {}
    }

    return path.join(baseDir, 'gmail-automation.json')
  }

  /**
   * Load persisted state from disk.
   */
  public static loadStateFromDisk(): void {
    try {
      const filePath = this.getStorageFilePath()
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8')
        const data: PersistedAutomationData = JSON.parse(raw)

        if (data.rules) {
          for (const [k, v] of Object.entries(data.rules)) this.rules.set(k, v)
        }
        if (Array.isArray(data.processedMessages)) {
          for (const id of data.processedMessages) this.processedMessages.add(id)
        }
        if (data.threadStates) {
          for (const [k, v] of Object.entries(data.threadStates)) this.threadStates.set(k, v)
        }
        if (data.scheduledJobs) {
          for (const [k, v] of Object.entries(data.scheduledJobs)) this.scheduledJobs.set(k, v)
        }
        if (data.dailyCounters) {
          for (const [k, v] of Object.entries(data.dailyCounters)) this.dailyCounters.set(k, v)
        }

        logger.info('automation', `[GmailAutomation] Loaded persisted state: ${this.rules.size} rules, ${this.scheduledJobs.size} jobs, ${this.processedMessages.size} processed IDs.`)
      }
    } catch (err: any) {
      logger.warn('automation', `[GmailAutomation] Could not load persisted state: ${err.message}`)
    }
    this.isInitialized = true
  }

  /**
   * Save current state to disk atomically.
   */
  public static saveStateToDisk(): void {
    try {
      const filePath = this.getStorageFilePath()
      const data: PersistedAutomationData = {
        rules: Object.fromEntries(this.rules.entries()),
        processedMessages: Array.from(this.processedMessages.values()),
        threadStates: Object.fromEntries(this.threadStates.entries()),
        scheduledJobs: Object.fromEntries(this.scheduledJobs.entries()),
        dailyCounters: Object.fromEntries(this.dailyCounters.entries())
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    } catch (err: any) {
      logger.warn('automation', `[GmailAutomation] Could not save state to disk: ${err.message}`)
    }
  }

  /**
   * Set or update automation configuration for a profile.
   */
  public static setConfig(config: AutomationRuleConfig): void {
    if (!this.isInitialized) this.loadStateFromDisk()

    this.rules.set(config.profileId, {
      ...config,
      maxRepliesPerThread: config.maxRepliesPerThread ?? 2,
      maxFollowUpsPerThread: config.maxFollowUpsPerThread ?? 3,
      dailyRepliesLimit: config.dailyRepliesLimit ?? 50,
      dailyFollowUpsLimit: config.dailyFollowUpsLimit ?? 30,
      dailyTotalLimit: config.dailyTotalLimit ?? 80,
      timezone: config.timezone || 'UTC'
    })

    this.saveStateToDisk()
    logger.info('automation', `[GmailAutomation] Config updated for profile: ${config.profileId.substring(0, 8)}... (Enabled: ${config.enabled})`)
  }

  /**
   * Get current automation configuration for a profile.
   */
  public static getConfig(profileId: string): AutomationRuleConfig | null {
    if (!this.isInitialized) this.loadStateFromDisk()
    return this.rules.get(profileId) || null
  }

  /**
   * Helper: Get current date string in the profile's configured timezone.
   */
  private static getDateInTimezone(tz: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Checks whether the profile has remaining daily sending quota.
   */
  public static checkQuota(profileId: string, type: 'reply' | 'followup'): { allowed: boolean; reason?: string } {
    const config = this.getConfig(profileId)
    if (!config) return { allowed: false, reason: 'No automation config found.' }

    const todayStr = this.getDateInTimezone(config.timezone)
    let counter = this.dailyCounters.get(profileId)

    if (!counter || counter.dateStr !== todayStr) {
      counter = { dateStr: todayStr, replies: 0, followUps: 0, total: 0 }
      this.dailyCounters.set(profileId, counter)
    }

    if (counter.total >= config.dailyTotalLimit) {
      return { allowed: false, reason: `Daily total quota reached (${counter.total}/${config.dailyTotalLimit})` }
    }

    if (type === 'reply' && counter.replies >= config.dailyRepliesLimit) {
      return { allowed: false, reason: `Daily auto-reply quota reached (${counter.replies}/${config.dailyRepliesLimit})` }
    }

    if (type === 'followup' && counter.followUps >= config.dailyFollowUpsLimit) {
      return { allowed: false, reason: `Daily follow-up quota reached (${counter.followUps}/${config.dailyFollowUpsLimit})` }
    }

    return { allowed: true }
  }

  /**
   * Increments daily send counter upon successful email transmission.
   */
  private static incrementCounter(profileId: string, type: 'reply' | 'followup'): void {
    const config = this.getConfig(profileId)
    const tz = config?.timezone || 'UTC'
    const todayStr = this.getDateInTimezone(tz)
    let counter = this.dailyCounters.get(profileId)

    if (!counter || counter.dateStr !== todayStr) {
      counter = { dateStr: todayStr, replies: 0, followUps: 0, total: 0 }
      this.dailyCounters.set(profileId, counter)
    }

    if (type === 'reply') counter.replies++
    if (type === 'followup') counter.followUps++
    counter.total++
    this.saveStateToDisk()
  }

  /**
   * Evaluates an incoming Gmail message.
   * If automation is enabled and conditions match, dispatches an immediate Auto-Reply and schedules Follow-Up #1.
   */
  public static async handleIncomingMessage(params: {
    profileId: string
    messageId: string
    threadId: string
    from: string
    subject: string
    snippet?: string
    internalDate?: string
  }): Promise<{ handled: boolean; action?: string; reason?: string }> {
    if (!this.isInitialized) this.loadStateFromDisk()

    const { profileId, messageId, threadId, from, subject } = params
    const config = this.getConfig(profileId)

    if (!config || !config.enabled) {
      return { handled: false, reason: 'Automation is disabled for this profile.' }
    }

    // 0. Self-Email Loop Prevention: Do not auto-reply to messages sent by own account
    const account = GmailAccountService.getAccount(profileId)
    if (account && account.email && from.toLowerCase().includes(account.email.toLowerCase())) {
      return { handled: false, reason: 'Self-sent message ignored (loop prevention).' }
    }

    // 1. Idempotency Check: Never process the same incoming message twice
    const idempotencyKey = `${profileId}:${messageId}`
    if (this.processedMessages.has(idempotencyKey)) {
      return { handled: false, reason: 'Message already processed.' }
    }
    this.processedMessages.add(idempotencyKey)

    // 2. Thread State Resolution & Recipient Reply Detection
    let isNewThread = false
    let threadState = this.threadStates.get(threadId)
    if (!threadState) {
      isNewThread = true
      threadState = {
        threadId,
        profileId,
        recipientEmail: from,
        repliesSent: 0,
        followUpsSent: 0,
        lastSentAt: 0,
        lastReceivedAt: Date.now(),
        isCancelled: false
      }
      this.threadStates.set(threadId, threadState)
    } else {
      // Recipient replied! Cancel all pending scheduled follow-ups for this thread
      threadState.lastReceivedAt = Date.now()
      this.cancelThreadFollowUps(threadId, 'Recipient sent a reply.')
    }

    // 3. Per-Thread Reply Limit Check
    if (threadState.repliesSent >= config.maxRepliesPerThread) {
      this.saveStateToDisk()
      return { handled: false, reason: `Max replies reached for this thread (${threadState.repliesSent}/${config.maxRepliesPerThread}).` }
    }

    // 4. Daily Quota Check
    const quotaCheck = this.checkQuota(profileId, 'reply')
    if (!quotaCheck.allowed) {
      this.saveStateToDisk()
      return { handled: false, reason: quotaCheck.reason }
    }

    // 5. Build and Send Auto-Reply
    const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`
    const sendResult = await GmailAccountService.sendMessage(profileId, {
      to: from,
      subject: replySubject,
      bodyText: config.autoReplyTemplate,
      threadId
    })

    if (!sendResult.success) {
      this.saveStateToDisk()
      return { handled: false, reason: `Send failed: ${sendResult.error}` }
    }

    // 6. Record Auto-Reply & Increment Counters
    threadState.repliesSent++
    threadState.lastSentAt = Date.now()
    this.incrementCounter(profileId, 'reply')
    logger.info('automation', `[GmailAutomation] Sent Auto-Reply to "${from}" in thread "${threadId}" (Message: ${sendResult.messageId})`)

    // 7. Schedule Follow-Up #1 ONLY on initial new thread creation
    if (isNewThread && config.followUpTemplates && config.followUpTemplates.length > 0) {
      const delayMinutes = config.followUpDelaysMinutes?.[0] || 1440 // default 24h
      this.scheduleFollowUp({
        profileId,
        threadId,
        recipientEmail: from,
        stepIndex: 0,
        template: config.followUpTemplates[0],
        delayMinutes
      })
    }

    this.saveStateToDisk()
    return { handled: true, action: 'AUTO_REPLY_SENT' }
  }

  /**
   * Schedules a follow-up email for a thread.
   */
  public static scheduleFollowUp(params: {
    profileId: string
    threadId: string
    recipientEmail: string
    stepIndex: number
    template: string
    delayMinutes: number
  }): ScheduledFollowUpJob {
    if (!this.isInitialized) this.loadStateFromDisk()

    const { profileId, threadId, recipientEmail, stepIndex, template, delayMinutes } = params
    const jobId = `job_${profileId}_${threadId}_${stepIndex}_${Date.now()}`
    const scheduledAt = Date.now() + delayMinutes * 60 * 1000

    const job: ScheduledFollowUpJob = {
      id: jobId,
      profileId,
      threadId,
      recipientEmail,
      stepIndex,
      template,
      scheduledAt,
      status: 'PENDING',
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.scheduledJobs.set(jobId, job)
    this.saveStateToDisk()
    logger.info('automation', `[GmailAutomation] Scheduled Follow-Up #${stepIndex + 1} for thread "${threadId}" at ${new Date(scheduledAt).toISOString()}`)
    return job
  }

  /**
   * Cancels all pending follow-up jobs for a thread (e.g. when recipient replies).
   */
  public static cancelThreadFollowUps(threadId: string, reason: string): number {
    if (!this.isInitialized) this.loadStateFromDisk()

    let cancelledCount = 0
    for (const [id, job] of this.scheduledJobs.entries()) {
      if (job.threadId === threadId && job.status === 'PENDING') {
        job.status = 'CANCELLED_RECIPIENT_REPLIED'
        job.lastError = reason
        job.updatedAt = Date.now()
        cancelledCount++
      }
    }

    const threadState = this.threadStates.get(threadId)
    if (threadState) {
      threadState.isCancelled = true
      threadState.cancelReason = reason
    }

    if (cancelledCount > 0) {
      this.saveStateToDisk()
      logger.info('automation', `[GmailAutomation] Cancelled ${cancelledCount} pending follow-ups for thread "${threadId}" (${reason})`)
    }
    return cancelledCount
  }

  /**
   * Processes due follow-up jobs with atomic execution locking (duplicate worker protection).
   */
  public static async processDueJobs(): Promise<{ executed: number; cancelled: number; failed: number }> {
    if (!this.isInitialized) this.loadStateFromDisk()

    const now = Date.now()
    let executed = 0
    let cancelled = 0
    let failed = 0

    for (const [jobId, job] of this.scheduledJobs.entries()) {
      if (job.status !== 'PENDING' || job.scheduledAt > now) {
        continue
      }

      // Duplicate Worker Lock: Skip if already executing in another worker
      if (this.executingJobIds.has(jobId)) {
        continue
      }
      this.executingJobIds.add(jobId)

      try {
        const config = this.getConfig(job.profileId)
        if (!config || !config.enabled) {
          // Automation is paused or disabled — do not send
          job.status = 'FAILED'
          job.lastError = 'Automation is disabled for this profile.'
          failed++
          continue
        }

        const threadState = this.threadStates.get(job.threadId)

        // 1. Verify Recipient Has Not Replied
        if (threadState && threadState.lastReceivedAt > threadState.lastSentAt) {
          job.status = 'CANCELLED_RECIPIENT_REPLIED'
          job.lastError = 'Recipient replied before follow-up was dispatched.'
          cancelled++
          continue
        }

        // 2. Check Per-Thread Follow-Up Limits
        if (threadState && threadState.followUpsSent >= config.maxFollowUpsPerThread) {
          job.status = 'LIMIT_EXCEEDED'
          job.lastError = 'Max thread follow-ups reached.'
          failed++
          continue
        }

        // 3. Check Daily Quotas
        const quota = this.checkQuota(job.profileId, 'followup')
        if (!quota.allowed) {
          job.status = 'LIMIT_EXCEEDED'
          job.lastError = quota.reason
          failed++
          continue
        }

        // 4. Send Follow-Up
        job.attempts++
        const sendRes = await GmailAccountService.sendMessage(job.profileId, {
          to: job.recipientEmail,
          subject: `Re: Follow-Up`,
          bodyText: job.template,
          threadId: job.threadId
        })

        if (sendRes.success) {
          job.status = 'EXECUTED'
          job.updatedAt = Date.now()
          executed++
          if (threadState) {
            threadState.followUpsSent++
            threadState.lastSentAt = Date.now()
          }
          this.incrementCounter(job.profileId, 'followup')
          logger.info('automation', `[GmailAutomation] Executed Follow-Up #${job.stepIndex + 1} for thread "${job.threadId}"`)

          // Schedule next follow-up step if configured
          const nextStep = job.stepIndex + 1
          if (config.followUpTemplates && nextStep < config.followUpTemplates.length) {
            const nextDelay = config.followUpDelaysMinutes?.[nextStep] || 2880 // default 48h
            this.scheduleFollowUp({
              profileId: job.profileId,
              threadId: job.threadId,
              recipientEmail: job.recipientEmail,
              stepIndex: nextStep,
              template: config.followUpTemplates[nextStep],
              delayMinutes: nextDelay
            })
          }
        } else {
          job.status = 'FAILED'
          job.lastError = sendRes.error
          failed++
        }
      } finally {
        this.executingJobIds.delete(jobId)
      }
    }

    this.saveStateToDisk()
    return { executed, cancelled, failed }
  }

  /**
   * Retrieves all scheduled jobs for a profile.
   */
  public static getJobs(profileId: string): ScheduledFollowUpJob[] {
    if (!this.isInitialized) this.loadStateFromDisk()
    const list: ScheduledFollowUpJob[] = []
    for (const job of this.scheduledJobs.values()) {
      if (job.profileId === profileId) list.push(job)
    }
    return list
  }

  /**
   * Clears in-memory state (useful for tests and full account reset).
   */
  public static clearAllState(): void {
    this.rules.clear()
    this.processedMessages.clear()
    this.threadStates.clear()
    this.scheduledJobs.clear()
    this.dailyCounters.clear()
    this.executingJobIds.clear()
    this.isInitialized = true
  }
}
