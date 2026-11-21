// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Enterprise Multi-Window Synchronizer
// Mirrors authorized QA/testing navigation, scroll, click, and typing
// actions from a master profile to follower profiles via CDP, plus
// automatic 2x2 / 3x3 / 4x4 grid window tiling with error isolation
// ──────────────────────────────────────────────────────────────────

import { processTracker } from './process-tracker'
import { logger } from '../logging/logger'

export type TileGridLayout = '2x2' | '3x3' | '4x4' | 'custom'

export interface SyncHumanizeConfig {
  delayMinMs: number
  delayMaxMs: number
  jitterPx: number
  captureMasterDomEvents: boolean
}

export interface SyncSessionState {
  active: boolean
  masterProfileId: string | null
  followerProfileIds: string[]
  excludedProfileIds: string[]
  connectedFollowers: string[]
  humanize: SyncHumanizeConfig
  logs: Array<{ timestamp: string; message: string; level: 'info' | 'warn' | 'error' }>
}

export interface SyncActionPayload {
  type: 'navigate' | 'reload' | 'back' | 'forward' | 'scroll' | 'click' | 'type'
  url?: string
  x?: number
  y?: number
  deltaX?: number
  deltaY?: number
  text?: string
}

class WindowSynchronizer {
  private active = false
  private masterProfileId: string | null = null
  private followerProfileIds: string[] = []
  private excludedProfileIds = new Set<string>()
  private logs: SyncSessionState['logs'] = []
  private masterDetachFn: (() => void) | null = null
  private humanize: SyncHumanizeConfig = {
    delayMinMs: 40,
    delayMaxMs: 140,
    jitterPx: 3,
    captureMasterDomEvents: true
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string): void {
    this.logs.unshift({ timestamp: new Date().toISOString(), level, message })
    if (this.logs.length > 100) this.logs.pop()
  }

  setHumanizeConfig(cfg: Partial<SyncHumanizeConfig>): SyncHumanizeConfig {
    if (typeof cfg.delayMinMs === 'number') this.humanize.delayMinMs = Math.max(0, Math.min(2000, cfg.delayMinMs))
    if (typeof cfg.delayMaxMs === 'number') this.humanize.delayMaxMs = Math.max(this.humanize.delayMinMs, Math.min(3000, cfg.delayMaxMs))
    if (typeof cfg.jitterPx === 'number') this.humanize.jitterPx = Math.max(0, Math.min(15, cfg.jitterPx))
    if (typeof cfg.captureMasterDomEvents === 'boolean') this.humanize.captureMasterDomEvents = cfg.captureMasterDomEvents
    return { ...this.humanize }
  }

  getStatus(): SyncSessionState {
    const connectedFollowers = this.followerProfileIds.filter((id) => {
      if (this.excludedProfileIds.has(id)) return false
      const t = processTracker.get(id)
      return !!(t?.browser && t.browser.connected)
    })

    return {
      active: this.active,
      masterProfileId: this.masterProfileId,
      followerProfileIds: [...this.followerProfileIds],
      excludedProfileIds: Array.from(this.excludedProfileIds),
      connectedFollowers,
      humanize: { ...this.humanize },
      logs: [...this.logs]
    }
  }

  async startSync(
    masterProfileId: string,
    followerProfileIds: string[],
    humanize?: Partial<SyncHumanizeConfig>
  ): Promise<SyncSessionState> {
    this.stopSync()
    if (humanize) this.setHumanizeConfig(humanize)

    const master = processTracker.get(masterProfileId)
    if (!master?.browser || !master.browser.connected) {
      throw new Error(`Master profile ${masterProfileId} is not running with an active CDP session.`)
    }

    this.masterProfileId = masterProfileId
    this.followerProfileIds = followerProfileIds.filter((id) => id !== masterProfileId)
    this.excludedProfileIds.clear()
    this.active = true
    this.addLog('info', `Started sync: Master=${masterProfileId}, Followers=${this.followerProfileIds.length} (delay ${this.humanize.delayMinMs}-${this.humanize.delayMaxMs}ms, jitter ±${this.humanize.jitterPx}px)`)

    // Mirror master frame navigations & real-time mouse/scroll/keyboard events to followers
    try {
      const pages = await master.browser.pages()
      const masterPage = pages[0]
      if (masterPage) {
        const navHandler = (frame: any) => {
          if (!this.active || frame !== masterPage.mainFrame()) return
          const url = frame.url()
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            this.broadcastAction({ type: 'navigate', url }).catch(() => {})
          }
        }
        masterPage.on('framenavigated', navHandler)

        if (this.humanize.captureMasterDomEvents) {
          try {
            await masterPage.exposeFunction('__apSyncEmit', (evt: SyncActionPayload) => {
              if (!this.active) return
              this.broadcastAction(evt).catch(() => {})
            })
          } catch {
            // Already exposed on this page
          }
          const injectCapture = () => {
            if ((window as any).__apSyncAttached) return
            ;(window as any).__apSyncAttached = true
            let wheelTimer: any = null
            let accDx = 0
            let accDy = 0
            window.addEventListener('click', (e: MouseEvent) => {
              if (typeof (window as any).__apSyncEmit === 'function') {
                ;(window as any).__apSyncEmit({ type: 'click', x: Math.round(e.clientX), y: Math.round(e.clientY) })
              }
            }, true)
            window.addEventListener('wheel', (e: WheelEvent) => {
              accDx += e.deltaX
              accDy += e.deltaY
              if (!wheelTimer) {
                wheelTimer = setTimeout(() => {
                  if (typeof (window as any).__apSyncEmit === 'function') {
                    ;(window as any).__apSyncEmit({ type: 'scroll', deltaX: Math.round(accDx), deltaY: Math.round(accDy) })
                  }
                  accDx = 0
                  accDy = 0
                  wheelTimer = null
                }, 120)
              }
            }, { passive: true, capture: true })
            window.addEventListener('keydown', (e: KeyboardEvent) => {
              if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (typeof (window as any).__apSyncEmit === 'function') {
                  ;(window as any).__apSyncEmit({ type: 'type', text: e.key })
                }
              }
            }, true)
          }
          await masterPage.evaluate(injectCapture).catch(() => {})
          await masterPage.evaluateOnNewDocument(injectCapture).catch(() => {})
        }

        this.masterDetachFn = () => {
          try { masterPage.off('framenavigated', navHandler) } catch {}
        }
      }
    } catch (err: any) {
      this.addLog('warn', `Could not attach master listener: ${err.message}`)
    }

    logger.info('browser', `[WindowSync] Started multi-window synchronization (master: ${masterProfileId})`)
    return this.getStatus()
  }

  stopSync(): SyncSessionState {
    if (this.masterDetachFn) {
      this.masterDetachFn()
      this.masterDetachFn = null
    }
    if (this.active) {
      this.addLog('info', 'Stopped multi-window synchronization.')
    }
    this.active = false
    this.masterProfileId = null
    this.followerProfileIds = []
    this.excludedProfileIds.clear()
    return this.getStatus()
  }

  setWindowExcluded(profileId: string, excluded: boolean): SyncSessionState {
    if (excluded) this.excludedProfileIds.add(profileId)
    else this.excludedProfileIds.delete(profileId)
    this.addLog('info', `${excluded ? 'Excluded' : 'Re-included'} profile ${profileId}`)
    return this.getStatus()
  }

  /**
   * Broadcast a synchronized QA action to all active, non-excluded follower windows.
   * Each follower runs in an isolated try/catch so one failed window never disrupts others.
   */
  async broadcastAction(action: SyncActionPayload): Promise<{ succeeded: string[]; failed: Array<{ profileId: string; error: string }> }> {
    if (!this.active) {
      throw new Error('Synchronizer is not active.')
    }

    const targets = this.followerProfileIds.filter((id) => !this.excludedProfileIds.has(id))
    const succeeded: string[] = []
    const failed: Array<{ profileId: string; error: string }> = []

    await Promise.all(
      targets.map(async (profileId) => {
        try {
          const tracked = processTracker.get(profileId)
          if (!tracked?.browser || !tracked.browser.connected) {
            throw new Error('Browser not connected')
          }
          const pages = await tracked.browser.pages()
          const page = pages[0]
          if (!page) throw new Error('No active page')

          // Humanized per-follower stagger delay & click coordinate jitter
          const delaySpan = Math.max(0, this.humanize.delayMaxMs - this.humanize.delayMinMs)
          const humanDelay = this.humanize.delayMinMs + (delaySpan > 0 ? Math.floor(Math.random() * (delaySpan + 1)) : 0)
          if (humanDelay > 0) {
            await new Promise((r) => setTimeout(r, humanDelay))
          }

          const jitter = () => {
            if (this.humanize.jitterPx <= 0) return 0
            return Math.floor(Math.random() * (this.humanize.jitterPx * 2 + 1)) - this.humanize.jitterPx
          }

          switch (action.type) {
            case 'navigate':
              if (action.url) await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
              break
            case 'reload':
              await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
              break
            case 'back':
              await page.goBack({ timeout: 10000 }).catch(() => {})
              break
            case 'forward':
              await page.goForward({ timeout: 10000 }).catch(() => {})
              break
            case 'scroll':
              await page.evaluate((dx, dy) => window.scrollBy(dx, dy), action.deltaX || 0, action.deltaY || 300)
              break
            case 'click':
              if (typeof action.x === 'number' && typeof action.y === 'number') {
                await page.mouse.click(Math.max(0, action.x + jitter()), Math.max(0, action.y + jitter()))
              }
              break
            case 'type':
              if (action.text) {
                const keyDelay = 15 + Math.floor(Math.random() * 35)
                await page.keyboard.type(action.text, { delay: keyDelay })
              }
              break
          }
          succeeded.push(profileId)
        } catch (err: any) {
          failed.push({ profileId, error: err.message })
          this.addLog('error', `Follower ${profileId} action "${action.type}" failed: ${err.message}`)
        }
      })
    )

    return { succeeded, failed }
  }

  /**
   * Automatically arrange open browser windows in a 2x2, 3x3, 4x4, or custom grid via CDP Browser.setWindowBounds.
   */
  async tileWindows(
    profileIds: string[],
    layout: TileGridLayout = '2x2',
    screenBounds: { width: number; height: number } = { width: 1920, height: 1080 },
    customCols?: number
  ): Promise<{ arranged: number; failed: number }> {
    const cols = layout === '2x2' ? 2 : layout === '3x3' ? 3 : layout === '4x4' ? 4 : Math.max(1, customCols || 2)
    const rows = Math.max(1, Math.ceil(profileIds.length / cols))
    const cellW = Math.floor(screenBounds.width / cols)
    const cellH = Math.floor(screenBounds.height / rows)

    let arranged = 0
    let failed = 0

    for (let i = 0; i < profileIds.length; i++) {
      const profileId = profileIds[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      try {
        const tracked = processTracker.get(profileId)
        if (!tracked?.browser || !tracked.browser.connected) {
          failed++
          continue
        }
        const pages = await tracked.browser.pages()
        if (!pages[0]) {
          failed++
          continue
        }
        const client = await pages[0].target().createCDPSession()
        const { windowId }: any = await client.send('Browser.getWindowForTarget')
        await client.send('Browser.setWindowBounds', {
          windowId,
          bounds: {
            left: col * cellW,
            top: row * cellH,
            width: cellW,
            height: cellH,
            windowState: 'normal'
          }
        })
        await client.detach().catch(() => {})
        arranged++
      } catch {
        failed++
      }
    }

    this.addLog('info', `Tiled ${arranged} windows in ${layout} layout (${failed} failed)`)
    return { arranged, failed }
  }
}

export const windowSynchronizer = new WindowSynchronizer()
