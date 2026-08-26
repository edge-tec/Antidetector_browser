// ──────────────────────────────────────────────
// AntiProfiles — Process Tracker
// ──────────────────────────────────────────────

import { execSync } from 'child_process'
import type { Browser } from 'puppeteer-core'
import { profileRepo } from '../database/repositories/profile.repo'
import { stopProxyBridge } from '../network/proxy-bridge'
import { logger } from '../logging/logger'

/**
 * Kill a process and all of its spawned child processes (process tree).
 * On Windows, taskkill /pid <PID> /T /F terminates all renderers, GPU, and network processes.
 * On POSIX, attempts process group termination or direct SIGKILL.
 */
export function killProcessTree(pid: number): void {
  if (!pid || pid <= 0) return
  try {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: ['ignore', 'ignore', 'ignore'], timeout: 5000, windowsHide: true })
      } catch {
        // Fallback to process.kill if taskkill fails or process already exited
        try { process.kill(pid, 'SIGKILL') } catch {}
      }
    } else {
      try {
        // Try killing process group first
        process.kill(-pid, 'SIGKILL')
      } catch {
        try { process.kill(pid, 'SIGKILL') } catch {}
      }
    }
  } catch {
    // Process already terminated
  }
}

interface TrackedProcess {
  profileId: string
  profileName: string
  browser: Browser
  pid: number
  wsEndpoint: string
  startedAt: Date
}

class ProcessTracker {
  private processes: Map<string, TrackedProcess> = new Map()

  /**
   * Track a running browser process.
   */
  track(profileId: string, profileName: string, browser: Browser, pid: number, wsEndpoint: string): void {
    this.processes.set(profileId, {
      profileId,
      profileName,
      browser,
      pid,
      wsEndpoint,
      startedAt: new Date()
    })

    // Listen for unexpected disconnection
    browser.on('disconnected', () => {
      this.handleDisconnect(profileId)
    })

    logger.info('browser', `Tracking process for "${profileName}" (PID: ${pid})`)
  }

  /**
   * Stop tracking and close a browser process.
   */
  async stop(profileId: string): Promise<void> {
    const tracked = this.processes.get(profileId)
    if (!tracked) {
      logger.warn('browser', `No tracked process for profile ${profileId}`)
      return
    }

    try {
      if (tracked.browser.connected) {
        await tracked.browser.close()
      }
    } catch (err) {
      logger.warn('browser', `Error closing browser for "${tracked.profileName}": ${err}`)
      // Fallback: kill the process tree directly to prevent orphaned child processes
      killProcessTree(tracked.pid)
    }

    this.processes.delete(profileId)
    stopProxyBridge(profileId)
    profileRepo.setStatus(profileId, 'stopped', null)
    logger.info('browser', `Stopped browser for "${tracked.profileName}"`)
  }

  /**
   * Handle unexpected browser disconnection.
   */
  private handleDisconnect(profileId: string): void {
    const tracked = this.processes.get(profileId)
    if (tracked) {
      logger.warn('browser', `Browser for "${tracked.profileName}" disconnected unexpectedly`)
      this.processes.delete(profileId)
      stopProxyBridge(profileId)
      try {
        profileRepo.setStatus(profileId, 'stopped', null)
      } catch {
        // DB may already be closing
      }
    }
  }

  /**
   * Check if a profile has a running browser.
   */
  isRunning(profileId: string): boolean {
    const tracked = this.processes.get(profileId)
    return tracked !== undefined && tracked.browser.connected
  }

  /**
   * Get info about a tracked process.
   */
  getInfo(profileId: string): {
    pid: number
    wsEndpoint: string
    startedAt: Date
    memoryUsage?: number
  } | null {
    const tracked = this.processes.get(profileId)
    if (!tracked) return null

    return {
      pid: tracked.pid,
      wsEndpoint: tracked.wsEndpoint,
      startedAt: tracked.startedAt
    }
  }

  /**
   * Get all running profile IDs.
   */
  getRunningIds(): string[] {
    return Array.from(this.processes.keys())
  }

  /**
   * Get count of running processes.
   */
  getRunningCount(): number {
    return this.processes.size
  }

  /**
   * Stop all running browsers (for app shutdown).
   */
  async stopAll(): Promise<void> {
    const ids = Array.from(this.processes.keys())
    logger.info('browser', `Stopping all ${ids.length} running browsers`)

    await Promise.allSettled(ids.map((id) => this.stop(id)))
  }

  /**
   * Clean up orphaned processes from a previous crash.
   */
  cleanupOrphans(): void {
    try {
      profileRepo.resetAllStatuses()
      logger.info('browser', 'Reset all profile statuses after startup')
    } catch (err) {
      logger.error('browser', `Failed to reset profile statuses: ${err}`)
    }
  }
}

export const processTracker = new ProcessTracker()
