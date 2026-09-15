import { CapabilityStatus } from './types'

/**
 * Report detailing which features are supported, simulated, or require real hardware.
 * Essential for QA and automated test verification without making unsupported security claims.
 */
export class SecurityCapabilityReport {
  private readonly capabilities: Map<string, CapabilityStatus> = new Map()

  constructor(initialCapabilities?: Record<string, CapabilityStatus>) {
    // Default baseline capabilities for Samsung Device Profiles
    this.capabilities.set('BUILD_PROPERTIES', CapabilityStatus.SUPPORTED)
    this.capabilities.set('DISPLAY_METRICS', CapabilityStatus.SUPPORTED)
    this.capabilities.set('CAMERA_METADATA_CAMERA2', CapabilityStatus.SUPPORTED)
    this.capabilities.set('SENSOR_SIMULATION', CapabilityStatus.SIMULATED_FOR_TESTING)
    this.capabilities.set('NETWORK_CAPABILITIES_INFO', CapabilityStatus.SUPPORTED)
    this.capabilities.set('SYNTHETIC_IDENTIFIERS', CapabilityStatus.SUPPORTED)

    // Hardware-backed features explicitly reported as requiring real hardware
    this.capabilities.set('KNOX_HARDWARE_VAULT', CapabilityStatus.REQUIRES_REAL_HARDWARE)
    this.capabilities.set('STRONGBOX_KEYSTORE', CapabilityStatus.REQUIRES_REAL_HARDWARE)
    this.capabilities.set('HARDWARE_BACKED_ATTESTATION', CapabilityStatus.REQUIRES_REAL_HARDWARE)
    this.capabilities.set('PLAY_INTEGRITY_HARDWARE_VERIFICATION', CapabilityStatus.REQUIRES_REAL_HARDWARE)
    this.capabilities.set('WIDEVINE_L1_OEM_CRYPTO', CapabilityStatus.REQUIRES_REAL_HARDWARE)

    if (initialCapabilities) {
      for (const [key, val] of Object.entries(initialCapabilities)) {
        this.capabilities.set(key, val)
      }
    }
  }

  public getStatus(feature: string): CapabilityStatus {
    return this.capabilities.get(feature) ?? CapabilityStatus.NOT_AVAILABLE
  }

  public setStatus(feature: string, status: CapabilityStatus): void {
    this.capabilities.set(feature, status)
  }

  public toRecord(): Record<string, CapabilityStatus> {
    const res: Record<string, CapabilityStatus> = {}
    for (const [k, v] of this.capabilities.entries()) {
      res[k] = v
    }
    return res
  }

  /**
   * Returns true if the profile asserts any unsupported security claim.
   * A valid test profile must NEVER claim to forge hardware attestation or bypass security.
   */
  public hasUnsupportedClaims(): boolean {
    const restrictedFeatures = [
      'KNOX_HARDWARE_VAULT',
      'STRONGBOX_KEYSTORE',
      'HARDWARE_BACKED_ATTESTATION',
      'PLAY_INTEGRITY_HARDWARE_VERIFICATION',
      'WIDEVINE_L1_OEM_CRYPTO'
    ]

    for (const feature of restrictedFeatures) {
      const status = this.getStatus(feature)
      if (status === CapabilityStatus.SUPPORTED) {
        return true
      }
    }
    return false
  }
}
