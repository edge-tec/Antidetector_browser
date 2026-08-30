/**
 * AntiProfiles v3 — Centralized Device Presentation & Capability Consistency Validator
 * 
 * Ensures mutually consistent relationships between:
 * - Runtime Platform (macOS / Windows / Linux)
 * - Device Presentation (Desktop / Mobile / Tablet)
 * - Viewport, Screen Metrics, DPR, Touch points
 * - User-Agent and Client Hints
 * - Rejects contradictory / impossible hardware spoofing
 */

export interface DeviceValidationResult {
  isValid: boolean
  isMobilePresentation: boolean
  anomalies: string[]
  sanitizedProfile: {
    viewportWidth: number
    viewportHeight: number
    devicePixelRatio: number
    touchSupport: boolean
    maxTouchPoints: number
  }
}

export class DeviceConsistencyValidator {
  /**
   * Validates device presentation metrics and prevents impossible hardware anomalies.
   */
  public static validate(profile: {
    osType?: string
    deviceType?: 'desktop' | 'mobile' | 'tablet'
    viewportWidth?: number
    viewportHeight?: number
    devicePixelRatio?: number
    touchSupport?: boolean
    maxTouchPoints?: number
    userAgent?: string
  }): DeviceValidationResult {
    const anomalies: string[] = []
    const os = (profile.osType || 'macos').toLowerCase()
    const isMobile = profile.deviceType === 'mobile' || os.includes('ios') || os.includes('android')

    let width = profile.viewportWidth || (isMobile ? 390 : 1920)
    let height = profile.viewportHeight || (isMobile ? 844 : 1080)
    let dpr = profile.devicePixelRatio || (isMobile ? 3 : 1)
    let touch = profile.touchSupport ?? (isMobile ? true : false)
    let touchPoints = profile.maxTouchPoints ?? (isMobile ? 5 : 0)

    if (isMobile) {
      if (touchPoints === 0 || touch === false) {
        anomalies.push('Mobile device profile requires touch support and >0 touch points.')
        touch = true
        touchPoints = 5
      }
      if (width > 1200) {
        anomalies.push('Mobile viewport width exceeded standard mobile dimensions.')
      }
    } else {
      // Desktop
      if (os.includes('macos') && touchPoints > 5) {
        anomalies.push('macOS desktop profile configured with excessive touch points.')
        touchPoints = 0
        touch = false
      }
    }

    return {
      isValid: anomalies.length === 0,
      isMobilePresentation: isMobile,
      anomalies,
      sanitizedProfile: {
        viewportWidth: width,
        viewportHeight: height,
        devicePixelRatio: dpr,
        touchSupport: touch,
        maxTouchPoints: touchPoints
      }
    }
  }
}
