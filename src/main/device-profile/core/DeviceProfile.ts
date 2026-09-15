import {
  AndroidBuildSpec,
  DisplayMetricsSpec,
  HardwareSpec,
  CameraSpec,
  SensorSpec,
  ConnectivitySpec,
  SyntheticIdentifiers,
  CapabilityStatus,
  SamsungDeviceProfileJson
} from './types'
import { SecurityCapabilityReport } from './StatusReport'

/**
 * Abstract base class for all device profiles.
 * Provides standard Android SDK compatibility accessors.
 */
export abstract class DeviceProfile {
  public readonly profileId: string
  public readonly manufacturer: string
  public readonly brand: string
  public readonly model: string
  public readonly deviceCodename: string
  public readonly productName: string

  public enabled: boolean = true
  public createdAt: string = new Date().toISOString()
  public updatedAt: string = new Date().toISOString()

  protected readonly capabilityReport: SecurityCapabilityReport

  constructor(
    profileId: string,
    manufacturer: string,
    brand: string,
    model: string,
    deviceCodename: string,
    productName: string,
    initialCapabilities?: Record<string, CapabilityStatus>
  ) {
    this.profileId = profileId
    this.manufacturer = manufacturer
    this.brand = brand
    this.model = model
    this.deviceCodename = deviceCodename
    this.productName = productName
    this.capabilityReport = new SecurityCapabilityReport(initialCapabilities)
  }

  // ──────────────── Standard Android SDK Compatibility Accessors ────────────────

  public abstract getAndroidBuild(): AndroidBuildSpec
  public abstract getDisplayMetrics(): DisplayMetricsSpec
  public abstract getHardware(): HardwareSpec
  public abstract getCameras(): CameraSpec[]
  public abstract getSensors(): SensorSpec[]
  public abstract getConnectivity(): ConnectivitySpec
  public abstract getIdentifiers(): SyntheticIdentifiers

  public getCapabilityReport(): SecurityCapabilityReport {
    return this.capabilityReport
  }

  /**
   * Helper producing the standard Android system property dictionary (getprop / build.prop)
   */
  public getBuildProperties(): Record<string, string> {
    const build = this.getAndroidBuild()
    const hw = this.getHardware()
    return {
      'ro.product.brand': build.brand,
      'ro.product.manufacturer': build.manufacturer,
      'ro.product.model': build.model,
      'ro.product.device': build.device,
      'ro.product.name': build.product,
      'ro.product.board': build.board,
      'ro.hardware': build.hardware,
      'ro.bootloader': build.bootloader,
      'ro.build.version.release': build.androidVersion,
      'ro.build.version.sdk': build.apiLevel.toString(),
      'ro.build.id': build.buildId,
      'ro.build.tags': build.buildTags,
      'ro.build.fingerprint': build.fingerprint,
      'ro.build.version.security_patch': build.securityPatchDate,
      'ro.product.cpu.abi': hw.cpuArchitecture,
      'ro.product.cpu.abilist': hw.supportedAbis.join(','),
      'ro.sf.lcd_density': this.getDisplayMetrics().densityDpi.toString()
    }
  }

  /**
   * Export the profile to the standard JSON structure
   */
  public toJSON(): SamsungDeviceProfileJson {
    return {
      profileId: this.profileId,
      manufacturer: this.manufacturer,
      brand: this.brand,
      model: this.model,
      deviceCodename: this.deviceCodename,
      productName: this.productName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      enabled: this.enabled,
      android: this.getAndroidBuild(),
      display: this.getDisplayMetrics(),
      hardware: this.getHardware(),
      cameras: this.getCameras(),
      sensors: this.getSensors(),
      connectivity: this.getConnectivity(),
      identifiers: this.getIdentifiers(),
      capabilities: this.capabilityReport.toRecord()
    }
  }
}
