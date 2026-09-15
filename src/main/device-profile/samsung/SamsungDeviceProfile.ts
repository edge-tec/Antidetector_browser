import { DeviceProfile } from '../core/DeviceProfile'
import {
  AndroidBuildSpec,
  DisplayMetricsSpec,
  HardwareSpec,
  CameraSpec,
  SensorSpec,
  ConnectivitySpec,
  SyntheticIdentifiers,
  CapabilityStatus
} from '../core/types'
import { DisplayConfiguration } from '../display/DisplayConfiguration'
import { CameraConfiguration } from '../camera/CameraConfiguration'
import { SensorConfiguration } from '../sensors/SensorConfiguration'
import { ConnectivityProfile } from '../connectivity/ConnectivityProfile'
import { SoftwareConfiguration, SoftwareConfigSpec } from '../software/SoftwareConfiguration'

/**
 * Base class for all Samsung device profiles (Galaxy A-series, S-series, etc.).
 * Coordinates the subsystem managers and Samsung-specific configuration interfaces.
 */
export abstract class SamsungDeviceProfile extends DeviceProfile {
  protected displayConfig: DisplayConfiguration
  protected cameraConfig: CameraConfiguration
  protected sensorConfig: SensorConfiguration
  protected connectivityProfile: ConnectivityProfile
  protected softwareConfig: SoftwareConfiguration
  protected hardwareSpec: HardwareSpec
  protected androidBuild: AndroidBuildSpec
  protected syntheticIds: SyntheticIdentifiers

  constructor(
    profileId: string,
    model: string,
    deviceCodename: string,
    productName: string,
    androidBuild: AndroidBuildSpec,
    displayMetrics: DisplayMetricsSpec,
    hardwareSpec: HardwareSpec,
    cameras: CameraSpec[],
    sensors: SensorSpec[],
    connectivity: ConnectivitySpec,
    softwareSpec: SoftwareConfigSpec,
    identifiers: SyntheticIdentifiers,
    initialCapabilities?: Record<string, CapabilityStatus>
  ) {
    super(
      profileId,
      'Samsung',
      'samsung',
      model,
      deviceCodename,
      productName,
      initialCapabilities
    )

    this.androidBuild = { ...androidBuild }
    this.hardwareSpec = { ...hardwareSpec }
    this.syntheticIds = { ...identifiers }

    this.displayConfig = new DisplayConfiguration(displayMetrics)
    this.cameraConfig = new CameraConfiguration(cameras)
    this.sensorConfig = new SensorConfiguration(sensors)
    this.connectivityProfile = new ConnectivityProfile(connectivity)
    this.softwareConfig = new SoftwareConfiguration(softwareSpec)
  }

  public getAndroidBuild(): AndroidBuildSpec {
    return { ...this.androidBuild }
  }

  public getDisplayMetrics(): DisplayMetricsSpec {
    return this.displayConfig.getMetrics()
  }

  public getDisplayConfiguration(): DisplayConfiguration {
    return this.displayConfig
  }

  public getHardware(): HardwareSpec {
    return { ...this.hardwareSpec }
  }

  public getCameras(): CameraSpec[] {
    return this.cameraConfig.getCameras()
  }

  public getCameraConfiguration(): CameraConfiguration {
    return this.cameraConfig
  }

  public getSensors(): SensorSpec[] {
    return this.sensorConfig.getSensors()
  }

  public getSensorConfiguration(): SensorConfiguration {
    return this.sensorConfig
  }

  public getConnectivity(): ConnectivitySpec {
    return this.connectivityProfile.getSpec()
  }

  public getConnectivityProfile(): ConnectivityProfile {
    return this.connectivityProfile
  }

  public getSoftwareConfiguration(): SoftwareConfiguration {
    return this.softwareConfig
  }

  public getIdentifiers(): SyntheticIdentifiers {
    return { ...this.syntheticIds }
  }

  public setIdentifiers(identifiers: SyntheticIdentifiers): void {
    this.syntheticIds = { ...identifiers }
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Samsung One UI specific build properties
   */
  public override getBuildProperties(): Record<string, string> {
    const baseProps = super.getBuildProperties()
    const oneUiVer = this.softwareConfig.getOneUiVersion()

    return {
      ...baseProps,
      'ro.build.version.oneui': oneUiVer,
      'ro.build.version.sem': '3501',
      'ro.build.characteristics': 'phone',
      'ro.product.model': this.androidBuild.model,
      'ro.product.device': this.deviceCodename,
      'ro.product.name': this.productName,
      'ro.csc.countryiso_code': 'US',
      'ro.csc.sales_code': 'XAA'
    }
  }
}
