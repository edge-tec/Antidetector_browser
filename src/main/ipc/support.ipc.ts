// ──────────────────────────────────────────────
// ProfileVault — Support IPC Channel Handlers
// ──────────────────────────────────────────────

import { ipcMain, BrowserWindow } from 'electron'
import { supportService } from '../services/support.service'
import { sessionManager } from '../security/session'
import { userRepo } from '../database/repositories/user.repo'
import { getDatabase } from '../database/connection'

function getAuthUserFromToken(token: string, guestInfo?: { name?: string; email?: string }): { id: string; role: string; name: string; email: string } | null {
  if (!token) return null
  const sessionUser = sessionManager.getSessionUser(token)
  if (sessionUser) return sessionUser

  const db = getDatabase()
  let user = db.prepare('SELECT id, role, name, email FROM users WHERE id = ? OR id = ?').get(token, 'admin-default') as any
  if (user) return user

  if (token.startsWith('guest_') || (guestInfo && guestInfo.email)) {
    const guestEmail = guestInfo?.email?.trim().toLowerCase() || `${token}@guest.profilevault.local`
    const guestName = guestInfo?.name?.trim() || 'Landing Page Guest'
    const existingGuest = db.prepare('SELECT id, role, name, email FROM users WHERE email = ?').get(guestEmail) as any
    if (existingGuest) return existingGuest

    try {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, email_verified, account_status)
        VALUES (?, ?, ?, 'user', 1, 'active')
      `).run(token, guestName, guestEmail)
    } catch {}

    return { id: token, role: 'user', name: guestName, email: guestEmail }
  }

  return null
}

export function setupSupportIPC(): void {
  // 1. Get Conversations for User
  ipcMain.handle('support:get-user-conversations', async (_, token: string) => {
    const user = getAuthUserFromToken(token)
    if (!user) return { success: false, error: 'Authentication required.' }
    try {
      const conversations = supportService.getUserConversations(user.id)
      return { success: true, data: conversations }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 2. Get Single Conversation Details
  ipcMain.handle('support:get-conversation', async (_, token: string, conversationId: string) => {
    const user = getAuthUserFromToken(token)
    if (!user) return { success: false, error: 'Authentication required.' }
    try {
      const isAdmin = user.role === 'admin'
      const conv = supportService.getConversation(conversationId, user.id, isAdmin)
      return { success: true, data: conv }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 3. Create Support Conversation
  ipcMain.handle('support:create-conversation', async (_, token: string, input: { subject: string; initialMessage: string; priority?: string; attachment?: any; guestName?: string; guestEmail?: string }) => {
    const user = getAuthUserFromToken(token, { name: input.guestName, email: input.guestEmail })
    if (!user) return { success: false, error: 'Authentication required.' }
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
      return { success: false, error: err.message }
    }
  })

  // 4. Send Support Message
  ipcMain.handle('support:send-message', async (_, token: string, conversationId: string, message: string, attachment?: any) => {
    const user = getAuthUserFromToken(token)
    if (!user) return { success: false, error: 'Authentication required.' }
    try {
      const senderType = user.role === 'admin' ? 'agent' : 'user'
      const msg = supportService.sendMessage(conversationId, user.id, senderType, message, attachment)
      return { success: true, data: msg }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 5. Mark Messages as Read
  ipcMain.handle('support:mark-read', async (_, token: string, conversationId: string) => {
    const user = getAuthUserFromToken(token)
    if (!user) return { success: false, error: 'Authentication required.' }
    try {
      const readerType = user.role === 'admin' ? 'agent' : 'user'
      const ok = supportService.markRead(conversationId, readerType)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 6. Broadcast Typing Event (Ephemeral, non-DB)
  ipcMain.handle('support:typing', async (_, token: string, conversationId: string, isTyping: boolean) => {
    const user = getAuthUserFromToken(token)
    if (!user) return { success: false }

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
  ipcMain.handle('support:admin-get-conversations', async (_, token: string, options: any) => {
    const user = getAuthUserFromToken(token)
    if (!user || user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const result = supportService.adminGetConversations(options || {})
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 8. Admin: Update Conversation Status
  ipcMain.handle('support:admin-update-status', async (_, token: string, conversationId: string, status: string) => {
    const user = getAuthUserFromToken(token)
    if (!user || user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const ok = supportService.updateStatus(conversationId, status)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 9. Admin: Assign Agent
  ipcMain.handle('support:admin-assign-agent', async (_, token: string, conversationId: string, agentId: string | null) => {
    const user = getAuthUserFromToken(token)
    if (!user || user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const ok = supportService.assignAgent(conversationId, agentId)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 10. Admin: Add Internal Staff Note
  ipcMain.handle('support:admin-add-internal-note', async (_, token: string, conversationId: string, note: string) => {
    const user = getAuthUserFromToken(token)
    if (!user || user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const noteObj = supportService.addInternalNote(conversationId, user.id, user.name, note)
      return { success: true, data: noteObj }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 11. Admin: Get Support Settings
  ipcMain.handle('support:admin-get-settings', async (_, token: string) => {
    const user = getAuthUserFromToken(token)
    if (!user || user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const settings = supportService.getSettings()
      return { success: true, data: settings }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 12. Admin: Save Support Settings
  ipcMain.handle('support:admin-save-settings', async (_, token: string, settings: Record<string, string>) => {
    const user = getAuthUserFromToken(token)
    if (!user || user.role !== 'admin') return { success: false, error: 'Admin access required.' }
    try {
      const ok = supportService.saveSettings(settings)
      return { success: ok }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
