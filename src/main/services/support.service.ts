// ──────────────────────────────────────────────
// AntiProfiles — Support Messaging Service
// ──────────────────────────────────────────────

import { getDatabase } from '../database/connection'
import { logger } from '../logging/logger'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AttachmentPayload {
  name: string
  mime: string
  size: number
  dataBase64: string
}

export class SupportService {

  private getUploadsDir(): string {
    let baseDir = app ? app.getPath('userData') : process.cwd()
    const uploadDir = path.join(baseDir, 'uploads', 'support')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    return uploadDir
  }

  // 1. Get Support Settings
  public getSettings(): Record<string, string> {
    const db = getDatabase()
    try {
      const rows = db.prepare('SELECT key, value FROM support_settings').all() as { key: string; value: string }[]
      const settings: Record<string, string> = {}
      rows.forEach((r) => { settings[r.key] = r.value })
      return settings
    } catch (err: any) {
      logger.error('support', `Failed to get support settings: ${err.message}`)
      return {}
    }
  }

  // 2. Save Support Settings
  public saveSettings(settings: Record<string, string>): boolean {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO support_settings (key, value) VALUES (?, ?)')
    const transaction = db.transaction((entries: [string, string][]) => {
      for (const [k, v] of entries) {
        stmt.run(k, String(v))
      }
    })
    try {
      transaction(Object.entries(settings))
      this.broadcastEvent('support:settings-updated', settings)
      return true
    } catch (err: any) {
      logger.error('support', `Failed to save support settings: ${err.message}`)
      return false
    }
  }

  // 3. Save File Attachment securely
  public saveAttachment(payload: AttachmentPayload): { path: string; name: string; size: number; mime: string } {
    const settings = this.getSettings()
    const maxMb = parseInt(settings.max_attachment_size_mb || '10', 10)
    const allowed = (settings.allowed_file_types || 'jpg,jpeg,png,gif,webp,pdf,txt,zip').split(',').map((s) => s.trim().toLowerCase())

    if (payload.size > maxMb * 1024 * 1024) {
      throw new Error(`File size exceeds maximum allowed limit of ${maxMb} MB.`)
    }

    const ext = path.extname(payload.name).replace('.', '').toLowerCase()
    if (!ext || !allowed.includes(ext)) {
      throw new Error(`File type '.${ext}' is not allowed. Allowed types: ${allowed.join(', ')}`)
    }

    // Sanitize filename and prevent directory traversal
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
    const uploadsDir = this.getUploadsDir()
    const targetPath = path.join(uploadsDir, safeName)

    const buffer = Buffer.from(payload.dataBase64, 'base64')
    fs.writeFileSync(targetPath, buffer)

    return {
      path: targetPath,
      name: payload.name,
      size: payload.size,
      mime: payload.mime
    }
  }

  // 4. Get User Conversations
  public getUserConversations(userId: string): any[] {
    const db = getDatabase()
    const sql = `
      SELECT 
        c.*,
        (SELECT message FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
        (SELECT COUNT(*) FROM support_messages WHERE conversation_id = c.id AND sender_type != 'user' AND is_read = 0) as unread_count
      FROM support_conversations c
      WHERE c.user_id = ?
      ORDER BY c.last_message_at DESC
    `
    try {
      return db.prepare(sql).all(userId)
    } catch (err: any) {
      logger.error('support', `Failed to get user conversations: ${err.message}`)
      return []
    }
  }

  // 5. Get Full Conversation Details
  public getConversation(conversationId: string, requesterUserId: string, isAdmin: boolean): any {
    const db = getDatabase()
    const convSql = `
      SELECT 
        c.*,
        COALESCE(u.name, c.user_id, 'Visitor Guest') as user_name,
        COALESCE(u.email, 'guest@antiprofiles.com') as user_email,
        COALESCE(u.account_status, 'active') as user_status,
        COALESCE(u.created_at, c.created_at) as user_created_at,
        (SELECT name FROM users WHERE id = c.assigned_agent_id) as assigned_agent_name,
        (SELECT p.name FROM subscriptions s JOIN pricing_plans p ON s.plan_id = p.id WHERE s.user_id = c.user_id) as user_plan
      FROM support_conversations c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `
    const conv = db.prepare(convSql).get(conversationId) as any
    if (!conv) throw new Error('Conversation not found.')

    // Access authorization check
    if (!isAdmin && conv.user_id !== requesterUserId) {
      throw new Error('Access denied. You can only access your own support conversations.')
    }

    // Fetch messages
    const messages = db.prepare(`
      SELECT m.*, COALESCE(u.name, 'Support User') as sender_name 
      FROM support_messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `).all(conversationId)

    conv.messages = messages

    // Fetch internal notes if admin
    if (isAdmin) {
      conv.internal_notes = db.prepare(`
        SELECT * FROM support_internal_notes 
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `).all(conversationId)
    } else {
      conv.internal_notes = []
    }

    return conv
  }

  // 6. Create New Support Conversation
  public createConversation(
    userId: string,
    subject: string,
    initialMessage: string,
    priority: string = 'normal',
    attachment?: AttachmentPayload
  ): any {
    const db = getDatabase()
    const settings = this.getSettings()

    // Ensure user exists in users table
    try {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, email_verified, account_status)
        VALUES (?, 'Visitor Guest', ?, 'user', 1, 'active')
      `).run(userId, `${userId}@guest.antiprofiles.com`)
    } catch {}

    // Check open conversation limit for user
    const maxOpen = parseInt(settings.max_open_conversations_per_user || '5', 10)
    const openCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM support_conversations 
      WHERE user_id = ? AND status IN ('open', 'pending', 'waiting_support')
    `).get(userId) as { count: number }

    if (openCountRow && openCountRow.count >= maxOpen) {
      if (userId.startsWith('guest_') || userId.includes('@guest.')) {
        db.prepare(`
          UPDATE support_conversations SET status = 'closed', updated_at = datetime('now')
          WHERE id = (
            SELECT id FROM support_conversations 
            WHERE user_id = ? AND status IN ('open', 'pending', 'waiting_support')
            ORDER BY created_at ASC LIMIT 1
          )
        `).run(userId)
      } else {
        throw new Error(`You have reached the limit of ${maxOpen} active open support conversations. Please wait for an agent to resolve your active tickets.`)
      }
    }

    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    db.prepare(`
      INSERT INTO support_conversations (id, user_id, status, priority, subject, last_message_at, created_at, updated_at)
      VALUES (?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(conversationId, userId, priority || 'normal', subject || 'Support Request', now, now, now)

    // Handle Attachment if present
    let attPath = null
    let attName = null
    let attSize = null
    let attMime = null
    if (attachment && attachment.dataBase64) {
      const saved = this.saveAttachment(attachment)
      attPath = saved.path
      attName = saved.name
      attSize = saved.size
      attMime = saved.mime
    }

    // Insert Initial User Message
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    db.prepare(`
      INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, message, message_type, attachment_path, attachment_name, attachment_size, attachment_mime, created_at)
      VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, ?, ?)
    `).run(msgId, conversationId, userId, initialMessage, attPath ? 'attachment' : 'text', attPath, attName, attSize, attMime, now)

    // Auto-Reply System Response
    if (settings.auto_reply_enabled === 'true' && settings.auto_reply_message) {
      const autoMsgId = `msg_auto_${Date.now()}`
      db.prepare(`
        INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, message, message_type, created_at)
        VALUES (?, ?, 'system', 'agent', ?, 'text', datetime('now', '+1 second'))
      `).run(autoMsgId, conversationId, settings.auto_reply_message)
    }

    this.broadcastEvent('support:conversation-created', { conversationId, userId })
    return this.getConversation(conversationId, userId, true)
  }

  // 7. Send Message in Conversation
  public sendMessage(
    conversationId: string,
    senderId: string,
    senderType: 'user' | 'agent',
    messageText: string,
    attachment?: AttachmentPayload
  ): any {
    const db = getDatabase()
    const conv = db.prepare('SELECT * FROM support_conversations WHERE id = ?').get(conversationId) as any
    if (!conv) throw new Error('Conversation not found.')

    if (conv.status === 'closed') {
      // Automatically reopen if a new message is sent
      db.prepare("UPDATE support_conversations SET status = 'open', closed_at = NULL WHERE id = ?").run(conversationId)
    }

    let attPath = null
    let attName = null
    let attSize = null
    let attMime = null
    if (attachment && attachment.dataBase64) {
      const saved = this.saveAttachment(attachment)
      attPath = saved.path
      attName = saved.name
      attSize = saved.size
      attMime = saved.mime
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    db.prepare(`
      INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, message, message_type, attachment_path, attachment_name, attachment_size, attachment_mime, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(msgId, conversationId, senderId, senderType, messageText, attPath ? 'attachment' : 'text', attPath, attName, attSize, attMime, now)

    // Update conversation status & timestamp
    const newStatus = senderType === 'user' ? 'waiting_support' : 'waiting_user'
    db.prepare(`
      UPDATE support_conversations 
      SET status = ?, last_message_at = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, now, now, conversationId)

    const newMsg = db.prepare('SELECT * FROM support_messages WHERE id = ?').get(msgId)
    this.broadcastEvent('support:new-message', { conversationId, message: newMsg })

    return newMsg
  }

  // 8. Mark Messages as Read
  public markRead(conversationId: string, readerType: 'user' | 'agent'): boolean {
    const db = getDatabase()
    const oppositeType = readerType === 'user' ? 'agent' : 'user'
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    try {
      db.prepare(`
        UPDATE support_messages 
        SET is_read = 1, read_at = ? 
        WHERE conversation_id = ? AND sender_type = ? AND is_read = 0
      `).run(now, conversationId, oppositeType)

      this.broadcastEvent('support:messages-read', { conversationId, readerType })
      return true
    } catch (err: any) {
      logger.error('support', `Failed to mark read: ${err.message}`)
      return false
    }
  }

  // 9. Admin List Conversations (With Search & Filters)
  public adminGetConversations(options: {
    status?: string
    priority?: string
    assignedAgentId?: string
    search?: string
    limit?: number
    offset?: number
  } = {}): { conversations: any[]; total: number; unreadTotal: number } {
    const db = getDatabase()
    let whereClauses: string[] = []
    let params: any[] = []

    if (options.status && options.status !== 'all') {
      whereClauses.push('c.status = ?')
      params.push(options.status)
    }

    if (options.priority && options.priority !== 'all') {
      whereClauses.push('c.priority = ?')
      params.push(options.priority)
    }

    if (options.assignedAgentId) {
      whereClauses.push('c.assigned_agent_id = ?')
      params.push(options.assignedAgentId)
    }

    if (options.search) {
      const q = `%${options.search}%`
      whereClauses.push('(u.name LIKE ? OR u.email LIKE ? OR c.id LIKE ? OR c.subject LIKE ?)')
      params.push(q, q, q, q)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const countSql = `SELECT COUNT(*) as count FROM support_conversations c JOIN users u ON c.user_id = u.id ${whereSql}`
    const totalRow = db.prepare(countSql).get(...params) as { count: number }

    const limit = options.limit || 50
    const offset = options.offset || 0

    const listSql = `
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        (SELECT name FROM users WHERE id = c.assigned_agent_id) as assigned_agent_name,
        (SELECT message FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
        (SELECT COUNT(*) FROM support_messages WHERE conversation_id = c.id AND sender_type = 'user' AND is_read = 0) as unread_count
      FROM support_conversations c
      JOIN users u ON c.user_id = u.id
      ${whereSql}
      ORDER BY c.last_message_at DESC
      LIMIT ? OFFSET ?
    `

    const conversations = db.prepare(listSql).all(...params, limit, offset)

    const unreadRow = db.prepare("SELECT COUNT(*) as count FROM support_messages WHERE sender_type = 'user' AND is_read = 0").get() as { count: number }

    return {
      conversations,
      total: totalRow ? totalRow.count : 0,
      unreadTotal: unreadRow ? unreadRow.count : 0
    }
  }

  // 10. Update Conversation Status
  public updateStatus(conversationId: string, status: string): boolean {
    const db = getDatabase()
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const closedAt = status === 'closed' ? now : null

    try {
      db.prepare(`
        UPDATE support_conversations 
        SET status = ?, closed_at = ?, updated_at = ? 
        WHERE id = ?
      `).run(status, closedAt, now, conversationId)

      this.broadcastEvent('support:status-updated', { conversationId, status })
      return true
    } catch (err: any) {
      logger.error('support', `Failed to update status: ${err.message}`)
      return false
    }
  }

  // 11. Assign Agent
  public assignAgent(conversationId: string, agentId: string | null): boolean {
    const db = getDatabase()
    try {
      db.prepare(`
        UPDATE support_conversations 
        SET assigned_agent_id = ?, updated_at = datetime('now') 
        WHERE id = ?
      `).run(agentId, conversationId)

      this.broadcastEvent('support:agent-assigned', { conversationId, agentId })
      return true
    } catch (err: any) {
      logger.error('support', `Failed to assign agent: ${err.message}`)
      return false
    }
  }

  // 12. Add Internal Staff Note
  public addInternalNote(conversationId: string, agentId: string, agentName: string, noteText: string): any {
    const db = getDatabase()
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    try {
      db.prepare(`
        INSERT INTO support_internal_notes (id, conversation_id, agent_id, agent_name, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(noteId, conversationId, agentId, agentName, noteText, now)

      const noteObj = db.prepare('SELECT * FROM support_internal_notes WHERE id = ?').get(noteId)
      this.broadcastEvent('support:internal-note-added', { conversationId, note: noteObj })
      return noteObj
    } catch (err: any) {
      logger.error('support', `Failed to add internal note: ${err.message}`)
      throw err
    }
  }

  // Broadcast Real-Time Events across Electron Renderer Windows
  private broadcastEvent(eventChannel: string, data: any) {
    try {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(eventChannel, data)
        }
      })
    } catch {}
  }
}

export const supportService = new SupportService()
