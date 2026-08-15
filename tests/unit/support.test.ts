// ──────────────────────────────────────────────
// ProfileVault — Unit Tests: Live Support Messaging System
// ──────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest'
import { initDatabase, getDatabase } from '../../src/main/database/connection'
import { supportService } from '../../src/main/services/support.service'

describe('Live Support System Unit Tests', () => {
  let testUserId: string
  let testAgentId: string

  beforeAll(() => {
    initDatabase()
    const db = getDatabase()

    testUserId = `usr_test_${Date.now()}`
    testAgentId = `agent_test_${Date.now()}`

    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, email_verified, account_status)
      VALUES (?, 'Test User', ?, 'hash', 'user', 1, 'active')
    `).run(testUserId, `${testUserId}@example.com`)

    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, email_verified, account_status)
      VALUES (?, 'Test Agent', ?, 'hash', 'admin', 1, 'active')
    `).run(testAgentId, `${testAgentId}@example.com`)
  })

  it('retrieves and updates support settings', () => {
    const settings = supportService.getSettings()
    expect(settings).toBeDefined()
    expect(settings.support_enabled).toBe('true')

    const updated = supportService.saveSettings({
      support_enabled: 'true',
      welcome_message: 'Custom Test Welcome Message'
    })
    expect(updated).toBe(true)

    const reFetched = supportService.getSettings()
    expect(reFetched.welcome_message).toBe('Custom Test Welcome Message')
  })

  it('creates support conversation with auto-reply message', () => {
    const conv = supportService.createConversation(
      testUserId,
      'Proxy Network Issue',
      'Hello, I am having trouble connecting my HTTP proxy.',
      'high'
    )

    expect(conv).toBeDefined()
    expect(conv.user_id).toBe(testUserId)
    expect(conv.subject).toBe('Proxy Network Issue')
    expect(conv.priority).toBe('high')
    expect(conv.messages.length).toBeGreaterThanOrEqual(1)

    const initialMsg = conv.messages[0]
    expect(initialMsg.message).toBe('Hello, I am having trouble connecting my HTTP proxy.')
    expect(initialMsg.sender_type).toBe('user')
  })

  it('sends support messages and updates conversation status', () => {
    const userConvs = supportService.getUserConversations(testUserId)
    expect(userConvs.length).toBeGreaterThan(0)
    const convId = userConvs[0].id

    // User sends a follow-up message
    const msg = supportService.sendMessage(convId, testUserId, 'user', 'Can you please check port 8080?')
    expect(msg).toBeDefined()
    expect(msg.message).toBe('Can you please check port 8080?')
    expect(msg.sender_type).toBe('user')

    // Verify conversation status updated to 'waiting_support'
    const updatedConv = supportService.getConversation(convId, testUserId, false)
    expect(updatedConv.status).toBe('waiting_support')
  })

  it('allows support agents to reply and mark user messages as read', () => {
    const userConvs = supportService.getUserConversations(testUserId)
    const convId = userConvs[0].id

    // Agent sends a reply
    const replyMsg = supportService.sendMessage(convId, testAgentId, 'agent', 'We have checked port 8080 and it is active.')
    expect(replyMsg.sender_type).toBe('agent')

    // Mark messages read by user
    const marked = supportService.markRead(convId, 'user')
    expect(marked).toBe(true)

    const conv = supportService.getConversation(convId, testUserId, false)
    expect(conv.status).toBe('waiting_user')
  })

  it('allows agents to add internal staff notes and hides them from non-admin users', () => {
    const userConvs = supportService.getUserConversations(testUserId)
    const convId = userConvs[0].id

    // Add internal note
    const note = supportService.addInternalNote(convId, testAgentId, 'Test Agent', 'User is running on Windows 11 with proxy auth enabled.')
    expect(note).toBeDefined()
    expect(note.note).toBe('User is running on Windows 11 with proxy auth enabled.')

    // Fetch conversation as regular user (non-admin)
    const userView = supportService.getConversation(convId, testUserId, false)
    expect(userView.internal_notes).toEqual([])

    // Fetch conversation as admin
    const adminView = supportService.getConversation(convId, testUserId, true)
    expect(adminView.internal_notes.length).toBeGreaterThan(0)
    expect(adminView.internal_notes[0].note).toBe('User is running on Windows 11 with proxy auth enabled.')
  })

  it('allows admin to filter conversations and update ticket status', () => {
    const userConvs = supportService.getUserConversations(testUserId)
    const convId = userConvs[0].id

    // Close conversation
    const closed = supportService.updateStatus(convId, 'closed')
    expect(closed).toBe(true)

    const conv = supportService.getConversation(convId, testUserId, true)
    expect(conv.status).toBe('closed')
    expect(conv.closed_at).not.toBeNull()

    // Query admin conversations
    const adminRes = supportService.adminGetConversations({ status: 'closed' })
    expect(adminRes.conversations.some((c) => c.id === convId)).toBe(true)
  })

  it('validates file attachment extension and size limits', () => {
    // Valid text file attachment
    const validFile = supportService.saveAttachment({
      name: 'log_output.txt',
      mime: 'text/plain',
      size: 500,
      dataBase64: Buffer.from('Sample Log Content').toString('base64')
    })

    expect(validFile.path).toBeDefined()
    expect(validFile.name).toBe('log_output.txt')

    // Disallowed executable extension
    expect(() => {
      supportService.saveAttachment({
        name: 'malicious_script.exe',
        mime: 'application/octet-stream',
        size: 500,
        dataBase64: Buffer.from('echo hello').toString('base64')
      })
    }).toThrow()
  })
})
