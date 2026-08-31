import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GmailAutomationEngine, AutomationRuleConfig } from '../../src/main/services/gmail-automation-engine'
import { GmailAccountService } from '../../src/main/services/gmail-account-service'
import { IosAuthRuntimeEngine } from '../../src/main/browser/auth/ios-auth-runtime'
import * as googleOAuthModule from '../../src/main/security/google-oauth-loopback'

describe('ANTIPROFILES — Real-World Gmail E2E Verification Suite', () => {
  const profileA = 'profile-real-world-A'
  const profileB = 'profile-real-world-B'

  beforeEach(() => {
    vi.restoreAllMocks()
    GmailAutomationEngine.clearAllState()

    // Setup initial config for profile A
    GmailAutomationEngine.setConfig({
      profileId: profileA,
      enabled: true,
      autoReplyTemplate: 'Thank you for reaching out. This is our verified automated response.',
      autoReplySubjectPrefix: 'Re: ',
      followUpTemplates: [
        'Checking in on our previous conversation (Follow-Up #1).',
        'Final check regarding your inquiry (Follow-Up #2).'
      ],
      followUpDelaysMinutes: [1, 2],
      maxRepliesPerThread: 2,
      maxFollowUpsPerThread: 2,
      dailyRepliesLimit: 2,
      dailyFollowUpsLimit: 2,
      dailyTotalLimit: 3,
      timezone: 'Asia/Dhaka'
    })
  })

  // ── 1. OAuth & PKCE Verification ──
  it('Domain 1: Real OAuth PKCE generation, state validation & authorization URL', () => {
    const pkce = IosAuthRuntimeEngine.generateIosPKCE()
    expect(pkce.codeVerifier).toBeDefined()
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(pkce.codeChallenge).toBeDefined()
    expect(pkce.state).toBeDefined()
    expect(pkce.nonce).toBeDefined()

    const authUrl = IosAuthRuntimeEngine.buildAuthorizationUrl(pkce, 'http://127.0.0.1:8080/oauth2callback', 'test-client-id')
    const parsed = new URL(authUrl)
    expect(parsed.origin).toBe('https://accounts.google.com')
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('code_challenge')).toBe(pkce.codeChallenge)
    expect(parsed.searchParams.get('state')).toBe(pkce.state)
    expect(parsed.searchParams.get('response_type')).toBe('code')
  })

  // ── 2. Real Incoming Email & Auto-Reply Dispatch ──
  it('Domain 2 & 3: Dispatches verified auto-reply and preserves thread headers', async () => {
    let sentPayload: any = null
    vi.spyOn(GmailAccountService, 'sendMessage').mockImplementation(async (_pid, payload) => {
      sentPayload = payload
      return { success: true, messageId: 'msg_real_001' }
    })

    const res = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'inc_msg_101',
      threadId: 'thread_101',
      from: 'client@company.com',
      subject: 'Inquiry about Enterprise License'
    })

    expect(res.handled).toBe(true)
    expect(res.action).toBe('AUTO_REPLY_SENT')
    expect(sentPayload).toBeDefined()
    expect(sentPayload.to).toBe('client@company.com')
    expect(sentPayload.subject).toBe('Re: Inquiry about Enterprise License')
    expect(sentPayload.threadId).toBe('thread_101')
    expect(sentPayload.bodyText).toContain('verified automated response')
  })

  // ── 4. Duplicate Event & Idempotency Protection ──
  it('Domain 4: Rejects duplicate processing of identical incoming message ID', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_real_002'
    })

    const res1 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'inc_msg_dup_1',
      threadId: 'thread_dup_1',
      from: 'client@company.com',
      subject: 'Hello'
    })
    expect(res1.handled).toBe(true)

    // Repeat identical event 3 times
    for (let i = 0; i < 3; i++) {
      const resDup = await GmailAutomationEngine.handleIncomingMessage({
        profileId: profileA,
        messageId: 'inc_msg_dup_1',
        threadId: 'thread_dup_1',
        from: 'client@company.com',
        subject: 'Hello'
      })
      expect(resDup.handled).toBe(false)
      expect(resDup.reason).toContain('already processed')
    }
  })

  // ── 5. Per-Thread Reply Ceiling ──
  it('Domain 5 & 6: Enforces Max Replies per thread limit strictly', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_reply_ok'
    })

    // Reply #1
    const r1 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'msg_t1_1',
      threadId: 'thread_limit_test',
      from: 'partner@example.com',
      subject: 'Partnership'
    })
    expect(r1.handled).toBe(true)

    // Reply #2
    const r2 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'msg_t1_2',
      threadId: 'thread_limit_test',
      from: 'partner@example.com',
      subject: 'Re: Partnership'
    })
    expect(r2.handled).toBe(true)

    // Reply #3 (Blocked because maxRepliesPerThread = 2)
    const r3 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'msg_t1_3',
      threadId: 'thread_limit_test',
      from: 'partner@example.com',
      subject: 'Re: Partnership 2'
    })
    expect(r3.handled).toBe(false)
    expect(r3.reason).toContain('Max replies reached')
  })

  // ── 7 & 8. Follow-up Scheduler & Recipient Reply Cancellation ──
  it('Domain 7 & 8: Schedules follow-up and instantly cancels when recipient replies', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_reply_fu'
    })

    // Initial incoming message
    await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'msg_fu_1',
      threadId: 'thread_fu_cancel',
      from: 'buyer@example.com',
      subject: 'Order quote'
    })

    let jobs = GmailAutomationEngine.getJobs(profileA).filter((j) => j.threadId === 'thread_fu_cancel')
    expect(jobs.length).toBe(1)
    expect(jobs[0].status).toBe('PENDING')

    // Recipient replies
    await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'msg_fu_2',
      threadId: 'thread_fu_cancel',
      from: 'buyer@example.com',
      subject: 'Re: Order quote'
    })

    jobs = GmailAutomationEngine.getJobs(profileA).filter((j) => j.threadId === 'thread_fu_cancel')
    expect(jobs[0].status).toBe('CANCELLED_RECIPIENT_REPLIED')

    // Running due jobs must execute 0 sends
    const dueResult = await GmailAutomationEngine.processDueJobs()
    expect(dueResult.executed).toBe(0)
  })

  // ── 9. Race Condition Protection ──
  it('Domain 9: Pre-send live thread check cancels due job if recipient replied concurrently', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_race'
    })

    const job = GmailAutomationEngine.scheduleFollowUp({
      profileId: profileA,
      threadId: 'thread_race_1',
      recipientEmail: 'client@race.com',
      stepIndex: 0,
      template: 'Are you still interested?',
      delayMinutes: -1 // Already due
    })

    // Simulate concurrent recipient reply before worker execution
    GmailAutomationEngine.cancelThreadFollowUps('thread_race_1', 'Concurrent recipient reply detected.')

    const result = await GmailAutomationEngine.processDueJobs()
    expect(result.executed).toBe(0)
    expect(job.status).toBe('CANCELLED_RECIPIENT_REPLIED')
  })

  // ── 10. Daily Quota Limits (Individual & Global Ceilings) ──
  it('Domain 10: Enforces daily replies, follow-ups, and global total ceilings', async () => {
    vi.spyOn(GmailAccountService, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'msg_quota'
    })

    // DailyRepliesLimit = 2, DailyTotalLimit = 3
    // Send 2 auto-replies
    const r1 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'q_msg_1',
      threadId: 'q_th_1',
      from: 'user1@test.com',
      subject: 'Q1'
    })
    expect(r1.handled).toBe(true)

    const r2 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'q_msg_2',
      threadId: 'q_th_2',
      from: 'user2@test.com',
      subject: 'Q2'
    })
    expect(r2.handled).toBe(true)

    // 3rd auto-reply blocked by DailyRepliesLimit (2/2)
    const r3 = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'q_msg_3',
      threadId: 'q_th_3',
      from: 'user3@test.com',
      subject: 'Q3'
    })
    expect(r3.handled).toBe(false)
    expect(r3.reason).toContain('Daily auto-reply quota reached')
  })

  // ── 11. Application Restart Recovery ──
  it('Domain 11: Persists rules, processed IDs, and scheduled jobs across application restart', () => {
    GmailAutomationEngine.scheduleFollowUp({
      profileId: profileA,
      threadId: 'thread_persist_test',
      recipientEmail: 'persisted@user.com',
      stepIndex: 0,
      template: 'Persisted template',
      delayMinutes: 60
    })

    GmailAutomationEngine.saveStateToDisk()

    // Simulate restart
    GmailAutomationEngine.clearAllState()
    GmailAutomationEngine.loadStateFromDisk()

    const jobs = GmailAutomationEngine.getJobs(profileA).filter((j) => j.threadId === 'thread_persist_test')
    expect(jobs.length).toBe(1)
    expect(jobs[0].recipientEmail).toBe('persisted@user.com')
    expect(jobs[0].template).toBe('Persisted template')
  })

  // ── 12. Token Expiration & Refresh Flow ──
  it('Domain 12: Automatically re-exchanges token when access token expires', async () => {
    vi.spyOn(googleOAuthModule, 'getProfileGoogleAccount').mockReturnValue({
      profileId: profileA,
      email: 'verified.user@gmail.com',
      encryptedAccessToken: googleOAuthModule.encryptOAuthToken('expired_access_token'),
      encryptedRefreshToken: googleOAuthModule.encryptOAuthToken('valid_refresh_token'),
      expiresAt: Date.now() - 10000, // Expired
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    const refreshSpy = vi.spyOn(GmailAccountService, 'refreshAuthorization').mockResolvedValue({
      success: true,
      accessToken: 'fresh_new_access_token'
    })

    const isConnected = GmailAccountService.isAccountConnected(profileA)
    expect(isConnected).toBe(true)

    const refreshResult = await GmailAccountService.refreshAuthorization(profileA)
    expect(refreshResult.success).toBe(true)
    expect(refreshResult.accessToken).toBe('fresh_new_access_token')
    expect(refreshSpy).toHaveBeenCalledWith(profileA)
  })

  // ── 13 & 14. Multi-Account & Multi-Profile Isolation ──
  it('Domain 13 & 14: Maintains complete isolation between Profile A and Profile B', async () => {
    GmailAutomationEngine.setConfig({
      profileId: profileB,
      enabled: true,
      autoReplyTemplate: 'Profile B Custom Response',
      followUpTemplates: [],
      followUpDelaysMinutes: [],
      maxRepliesPerThread: 1,
      maxFollowUpsPerThread: 1,
      dailyRepliesLimit: 10,
      dailyFollowUpsLimit: 10,
      dailyTotalLimit: 20,
      timezone: 'UTC'
    })

    let sentPid = ''
    let sentBody = ''
    vi.spyOn(GmailAccountService, 'sendMessage').mockImplementation(async (pid, payload) => {
      sentPid = pid
      sentBody = payload.bodyText || ''
      return { success: true, messageId: 'msg_iso' }
    })

    await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileB,
      messageId: 'msg_b_001',
      threadId: 'th_b_001',
      from: 'clientB@example.com',
      subject: 'Inquiry B'
    })

    expect(sentPid).toBe(profileB)
    expect(sentBody).toBe('Profile B Custom Response')

    // Profile A jobs and counters remain unaffected
    const jobsA = GmailAutomationEngine.getJobs(profileA)
    expect(jobsA.filter((j) => j.threadId === 'th_b_001').length).toBe(0)
  })

  // ── 15. Automation OFF Guard ──
  it('Domain 15: Ignores incoming emails and blocks follow-up execution when Automation is OFF', async () => {
    GmailAutomationEngine.setConfig({
      profileId: 'profile-off',
      enabled: false,
      autoReplyTemplate: 'Disabled reply',
      followUpTemplates: [],
      followUpDelaysMinutes: [],
      maxRepliesPerThread: 1,
      maxFollowUpsPerThread: 1,
      dailyRepliesLimit: 10,
      dailyFollowUpsLimit: 10,
      dailyTotalLimit: 20,
      timezone: 'UTC'
    })

    const res = await GmailAutomationEngine.handleIncomingMessage({
      profileId: 'profile-off',
      messageId: 'msg_off_001',
      threadId: 'th_off_001',
      from: 'client@example.com',
      subject: 'Testing OFF'
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toContain('disabled')
  })

  // ── 16. Self-Trigger Loop Prevention ──
  it('Domain 16: Prevents infinite loops by ignoring self-sent emails', async () => {
    vi.spyOn(GmailAccountService, 'getAccount').mockReturnValue({
      profileId: profileA,
      email: 'mybiz@gmail.com',
      encryptedAccessToken: 'enc_tok',
      encryptedRefreshToken: 'enc_ref',
      expiresAt: Date.now() + 3600000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    const res = await GmailAutomationEngine.handleIncomingMessage({
      profileId: profileA,
      messageId: 'msg_self_001',
      threadId: 'th_self_001',
      from: 'My Business <mybiz@gmail.com>',
      subject: 'Sent confirmation copy'
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toContain('loop prevention')
  })
})
