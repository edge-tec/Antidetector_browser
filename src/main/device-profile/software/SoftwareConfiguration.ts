import { CapabilityStatus } from '../core/types'

/**
 * Samsung proprietary system component stub/mock for application compatibility testing.
 */
export interface SamsungSystemComponentStub {
  packageName: string
  componentName: string
  versionName: string
  versionCode: number
  status: CapabilityStatus
}

/**
 * Samsung software compatibility layer specification.
 */
export interface SoftwareConfigSpec {
  androidVersion: string
  apiLevel: number
  oneUiVersion: string
  locale: string
  localesSupported: string[]
  timezone: string
  fontScale: number
  keyboardLayout: string
  browserCompatibility: {
    samsungInternetVersion: string
    chromeVersion: string
    userAgentSamsungInternet: string
    userAgentChrome: string
  }
  systemApps: SamsungSystemComponentStub[]
}

/**
 * Software configuration module for One UI and Android application testing.
 */
export class SoftwareConfiguration {
  private config: SoftwareConfigSpec

  constructor(config: SoftwareConfigSpec) {
    this.config = { ...config }
  }

  public getConfig(): SoftwareConfigSpec {
    return { ...this.config }
  }

  public getOneUiVersion(): string {
    return this.config.oneUiVersion
  }

  public getLocale(): string {
    return this.config.locale
  }

  public setLocale(locale: string): void {
    this.config.locale = locale
  }

  public getTimezone(): string {
    return this.config.timezone
  }

  public setTimezone(timezone: string): void {
    this.config.timezone = timezone
  }

  public getSystemApp(packageName: string): SamsungSystemComponentStub | undefined {
    return this.config.systemApps.find((app) => app.packageName === packageName)
  }

  /**
   * Builds default Samsung One UI standard system component stubs.
   */
  public static createDefaultSamsungApps(oneUiVersion: string = '7.0'): SamsungSystemComponentStub[] {
    return [
      {
        packageName: 'com.sec.android.app.sbrowser',
        componentName: 'Samsung Internet',
        versionName: '28.0.0.45',
        versionCode: 2800045,
        status: CapabilityStatus.SUPPORTED
      },
      {
        packageName: 'com.sec.android.app.samsungapps',
        componentName: 'Galaxy Store',
        versionName: '4.5.80.6',
        versionCode: 4580006,
        status: CapabilityStatus.SIMULATED_FOR_TESTING
      },
      {
        packageName: 'com.samsung.android.app.notes',
        componentName: 'Samsung Notes',
        versionName: '4.4.22.4',
        versionCode: 4422004,
        status: CapabilityStatus.SIMULATED_FOR_TESTING
      },
      {
        packageName: 'com.sec.android.inputmethod',
        componentName: 'Samsung Keyboard',
        versionName: '5.8.00.12',
        versionCode: 5800012,
        status: CapabilityStatus.SUPPORTED
      },
      {
        packageName: 'com.sec.android.app.myfiles',
        componentName: 'My Files',
        versionName: '16.0.01.2',
        versionCode: 1600102,
        status: CapabilityStatus.SUPPORTED
      },
      {
        packageName: 'com.samsung.android.knox.containeragent',
        componentName: 'Knox Container Agent (Mock)',
        versionName: '3.10.0',
        versionCode: 31000,
        // Knox cryptographic vault requires physical hardware
        status: CapabilityStatus.REQUIRES_REAL_HARDWARE
      }
    ]
  }
}
