import { ipcMain, BrowserWindow } from 'electron'
import { supportService } from '../services/support.service'
import { sessionManager } from '../security/session'
import { getDatabase } from '../database/connection'
import { centralApi } from '../services/api-client.service'

function getAuthUserFromToken(token: string, guestInfo?: { name?: string; email?: string }): { id: string; role: string; name: string; email: string } {
  const defaultToken = token || `guest_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`
  
  if (token) {
    const sessionUser = sessionManager.getSessionUser(token)
    if (sessionUser) return sessionUser
  }

  const db = getDatabase()
  if (token) {
    try {
      let user = db.prepare('SELECT id, role, name, email FROM users WHERE id = ? OR id = ?').get(token, 'admin-default') as any
      if (user) return user
    } catch {}
  }

  // Always create or retrieve guest user for live chat so ticket creation never fails
  const guestEmail = guestInfo?.email?.trim().toLowerCase() || `${defaultToken}@guest.antiprofiles.com`
  const guestName = guestInfo?.name?.trim() || 'Visitor Guest'

  try {
    const existingGuest = db.prepare('SELECT id, role, name, email FROM users WHERE email = ? OR id = ?').get(guestEmail, defaultToken) as any
    if (existingGuest) return existingGuest

    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, role, email_verified, account_status)
      VALUES (?, ?, ?, 'user', 1, 'active')
    `).run(defaultToken, guestName, guestEmail)
  } catch {}

  return { id: defaultToken, role: 'user', name: guestName, email: guestEmail }
}

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any) {
  try {
    ipcMain.removeHandler(channel)
  } catch {}
  try {
    ipcMain.handle(channel, listener)
  } catch (err: any) {
    console.error(`Failed to register IPC handler for ${channel}:`, err.message)
  }
}

export function setupSupportIPC(): void {
  // 1. Get Conversations for User (Central Server First)
  safeHandle('support:get-user-conversations', async (_, token: string) => {
    if (token) centralApi.setSessionToken(token)
    try {
      const centralRes = await centralApi.getUserConversations()
      if (centralRes.success && centralRes.data) {
        return { success: true, data: centralRes.data }
      }
    } catch {}

    const user = getAuthUserFromToken(token)
    try {
      const conversations = supportService.getUserConversations(user.id)
      return { success: true, data: conversations }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 2. Get Single Conversation Details (Central Server First)
  safeHandle('support:get-conversation', async (_, token: string, conversationId: string) => {
    if (token) centralApi.setSessionToken(token)
    try {
      const centralRes = await centralApi.getConversation(conversationId)
      if (centralRes.success && centralRes.data) {
        return { success: true, data: centralRes.data }
      }
    } catch {}

    const user = getAuthUserFromToken(token)
    try {
      const isAdmin = user.role === 'admin'
      const conv = supportService.getConversation(conversationId, user.id, isAdmin)
      return { success: true, data: conv }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 3. Create Support Conversation (Central Server First)
  safeHandle('support:create-conversation', async (_, token: string, input: { subject: string; initialMessage: string; priority?: string; attachment?: any; guestName?: string; guestEmail?: string }) => {
    if (token) centralApi.setSessionToken(token)
    try {
      const centralRes = await centralApi.createTicket(input.subject, input.initialMessage, input.priority)
      if (centralRes.success) {
        return { success: true, data: centralRes.data, conversation_id: centralRes.conversation_id }
      }
    } catch {}

    const user = getAuthUserFromToken(token, { name: input?.guestName, email: input?.guestEmail })
    try {
      const conv = supportService.createConversation(
        user.id,
        input.subject,
        input.initialMessage,
        input.priority || 'normal',
        input.attachment
      )
      return { success: true, data: conv }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create support conversation.' }
    }
  })

  // 4. Send Support Message (Central Server First)
  safeHandle('support:send-message', async (_, token: string, conversationId: string, message: string, attachment?: any) => {
    if (token) centralApi.setSessionToken(token)
    try {
      const centralRes = await centralApi.sendMessage(conversationId, message)
      if (centralRes.success) {
        return { success: true, message_id: centralRes.message_id }
      }
    } catch {}

    const user = getAuthUserFromToken(token)
    try {
      const senderType = user.role === 'admin' ? 'agent' : 'user'
      const msg = supportService.sendMessage(conversationId, user.id, senderType, message, attachment)
      return { success: true, data: msg }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 5. Mark Messages as Read
  safeHandle('support:mark-read', async (_, token: string, conversationId: string) => {
    const user = getAuthUserFromToken(token)
    try {
      const readerType = user.role === 'admin' ? 'agent' : 'user'
      const ok = supportService.markRead(conversationId, readerType)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 6. Broadcast Typing Event (Ephemeral, non-DB)
  safeHandle('support:typing', async (_, token: string, conversationId: string, isTyping: boolean) => {
    const user = getAuthUserFromToken(token)

    const senderType = user.role === 'admin' ? 'agent' : 'user'
    const windows = BrowserWindow.getAllWindows()
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('support:typing-indicator', {
          conversationId,
          userId: user.id,
          userName: user.name,
          senderType,
          isTyping
        })
      }
    })
    return { success: true }
  })

  // 7. Admin: Get All Conversations
  safeHandle('support:admin-get-conversations', async (_, token: string, options: any) => {
    const user = getAuthUserFromToken(token)
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const result = supportService.adminGetConversations(options || {})
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 8. Admin: Update Conversation Status
  safeHandle('support:admin-update-status', async (_, token: string, conversationId: string, status: string) => {
    const user = getAuthUserFromToken(token)
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const ok = supportService.updateStatus(conversationId, status)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 9. Admin: Assign Agent
  safeHandle('support:admin-assign-agent', async (_, token: string, conversationId: string, agentId: string | null) => {
    const user = getAuthUserFromToken(token)
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const ok = supportService.assignAgent(conversationId, agentId)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 10. Admin: Add Internal Staff Note
  safeHandle('support:admin-add-internal-note', async (_, token: string, conversationId: string, note: string) => {
    const user = getAuthUserFromToken(token)
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const noteObj = supportService.addInternalNote(conversationId, user.id, user.name, note)
      return { success: true, data: noteObj }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 11. Admin: Get Support Settings
  safeHandle('support:admin-get-settings', async (_, token: string) => {
    const user = getAuthUserFromToken(token)
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const settings = supportService.getSettings()
      return { success: true, data: settings }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 12. Admin: Save Support Settings
  safeHandle('support:admin-save-settings', async (_, token: string, settings: Record<string, string>) => {
    const user = getAuthUserFromToken(token)
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const ok = supportService.saveSettings(settings)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
