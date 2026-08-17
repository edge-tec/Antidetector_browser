// ──────────────────────────────────────────────
// AntiProfiles — IPC Group Handlers
// ──────────────────────────────────────────────

import { ipcMain } from 'electron'
import { groupRepo } from '../database/repositories/group.repo'
import { validateId } from '../security/validators'

export function registerGroupHandlers(): void {
  ipcMain.handle('groups:getAll', async () => {
    try {
      return { success: true, data: groupRepo.getAll() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('groups:create', async (_event, input: any) => {
    try {
      if (!input.name) throw new Error('Group name is required')
      const group = groupRepo.create(input)
      return { success: true, data: group }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('groups:update', async (_event, id: string, input: any) => {
    try {
      validateId(id)
      const group = groupRepo.update(id, input)
      if (!group) return { success: false, error: 'Group not found' }
      return { success: true, data: group }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('groups:delete', async (_event, id: string) => {
    try {
      validateId(id)
      groupRepo.delete(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
