import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GmailAutomationEngine, AutomationRuleConfig } from '../../src/main/services/gmail-automation-engine'
import { GmailAccountService } from '../../src/main/services/gmail-account-service'

describe('GmailAutomationEngine — Auto-Reply, Follow-up & Quota System', () => {
  const profileId = 'profile-test-automation-1'

  beforeEach(() => {
    vi.restoreAllMocks()
    GmailAutomationEngine.setConfig({
      profileId,
      enabled: true,
      autoReplyTemplate: 'Thank you for reaching out. We received your message.',
      followUpTemplates: [
        'Following up on our previous email (Follow-Up #1).',
        'Just checking in to see if you have any questions (Follow-Up #2).'
      ],
      followUpDelaysMinutes: [1440, 2880],
      maxRepliesPerThread: 2,
      maxFollowUpsPerThread: 2,
      dailyRepliesLimit: 5,
      dailyFollowUpsLimit: 5,
      dailyTotalLimit: 10,
      timezone: 'Asia/Dhaka'
    })
  })

  it('dispatches auto-reply and schedules Follow-Up #1 for new incoming email', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_reply_123'
    })

    const res = await GmailAutomationEngine.handleIncomingMessage({
      profileId,
      messageId: 'incoming_msg_001',
      threadId: 'thread_001',
      from: 'client@example.com',
      subject: 'Inquiry about pricing'
    })

    expect(res.handled).toBe(true)
    expect(res.action).toBe('AUTO_REPLY_SENT')

    // Check scheduled follow-up
    const jobs = GmailAutomationEngine.getJobs(profileId)
    expect(jobs.length).toBe(1)
    expect(jobs[0].status).toBe('PENDING')
    expect(jobs[0].threadId).toBe('thread_001')
  })

  it('enforces idempotency and rejects duplicate processing of the same message ID', async () => {
    const res = await GmailAutomationEngine.handleIncomingMessage({
      profileId,
      messageId: 'incoming_msg_001',
      threadId: 'thread_001',
      from: 'client@example.com',
      subject: 'Inquiry about pricing'
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toContain('already processed')
  })

  it('cancels all future follow-ups when recipient replies to a thread', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_reply_456'
    })

    // Process first incoming message
    await GmailAutomationEngine.handleIncomingMessage({
      profileId,
      messageId: 'incoming_msg_002',
      threadId: 'thread_002',
      from: 'client2@example.com',
      subject: 'Contract review'
    })

    // Confirm job is pending
    let jobs = GmailAutomationEngine.getJobs(profileId).filter((j) => j.threadId === 'thread_002')
    expect(jobs[0].status).toBe('PENDING')

    // Recipient replies with second message in same thread
    await GmailAutomationEngine.handleIncomingMessage({
      profileId,
      messageId: 'incoming_msg_003',
      threadId: 'thread_002',
      from: 'client2@example.com',
      subject: 'Re: Contract review'
    })

    // Verify job was automatically cancelled
    jobs = GmailAutomationEngine.getJobs(profileId).filter((j) => j.threadId === 'thread_002')
    expect(jobs[0].status).toBe('CANCELLED_RECIPIENT_REPLIED')
  })

  it('enforces daily quota limits and rejects sending when quota is exhausted', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_reply_quota'
    })

    // Configure small quota
    GmailAutomationEngine.setConfig({
      profileId: 'profile-quota-test',
      enabled: true,
      autoReplyTemplate: 'Quota test',
      followUpTemplates: [],
      followUpDelaysMinutes: [],
      maxRepliesPerThread: 5,
      maxFollowUpsPerThread: 5,
      dailyRepliesLimit: 1,
      dailyFollowUpsLimit: 1,
      dailyTotalLimit: 1,
      timezone: 'UTC'
    })

    // 1st email succeeds
    const res1 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: 'profile-quota-test',
      messageId: 'quota_msg_1',
      threadId: 'quota_thread_1',
      from: 'user1@example.com',
      subject: 'Hello'
    })
    expect(res1.handled).toBe(true)

    // 2nd email fails due to daily quota
    const res2 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: 'profile-quota-test',
      messageId: 'quota_msg_2',
      threadId: 'quota_thread_2',
      from: 'user2@example.com',
      subject: 'Hello 2'
    })
    expect(res2.handled).toBe(false)
    expect(res2.reason).toContain('quota reached')
  })
})
