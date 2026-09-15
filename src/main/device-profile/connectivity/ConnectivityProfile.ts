import { ConnectivitySpec, CapabilityStatus } from '../core/types'

/**
 * Synthetic Carrier information for QA/testing only.
 * Strictly uses simulated test networks (e.g. MCC 001 / MNC 01 Test PLMN).
 */
export interface SyntheticCarrierConfig {
  carrierName: string
  mcc: string
  mnc: string
  isoCountryCode: string
  networkType: 'LTE' | 'NR_NSA' | 'NR_SA'
  isRoaming: boolean
  apn: string
}

/**
 * Android ConnectivityManager & TelephonyManager abstraction layer.
 */
export class ConnectivityProfile {
  private spec: ConnectivitySpec
  private carrier: SyntheticCarrierConfig

  constructor(spec: ConnectivitySpec, carrier?: Partial<SyntheticCarrierConfig>) {
    this.spec = { ...spec }
    this.carrier = {
      carrierName: carrier?.carrierName ?? 'Test Mobile QA',
      mcc: carrier?.mcc ?? '001', // ITU Test MCC
      mnc: carrier?.mnc ?? '01',
      isoCountryCode: carrier?.isoCountryCode ?? 'us',
      networkType: carrier?.networkType ?? (spec.cellular.generation.includes('5G') ? 'NR_SA' : 'LTE'),
      isRoaming: carrier?.isRoaming ?? false,
      apn: carrier?.apn ?? 'test.internet.qa'
    }
  }

  public getSpec(): ConnectivitySpec {
    return { ...this.spec }
  }

  public getCarrier(): SyntheticCarrierConfig {
    return { ...this.carrier }
  }

  public has5G(): boolean {
    return this.spec.cellular.generation.includes('5G')
  }

  public hasNfc(): boolean {
    return this.spec.nfc.supported
  }

  public hasDualSim(): boolean {
    return this.spec.cellular.dualSim
  }

  public getNfcStatus(): CapabilityStatus {
    return this.spec.nfc.status
  }

  public toAndroidNetworkCapabilities(): {
    hasTransportWifi: boolean
    hasTransportCellular: boolean
    hasTransportBluetooth: boolean
    networkCapabilities: string[]
  } {
    const caps: string[] = ['NET_CAPABILITY_INTERNET', 'NET_CAPABILITY_NOT_RESTRICTED', 'NET_CAPABILITY_TRUSTED']
    if (this.spec.cellular.volteSupported) caps.push('NET_CAPABILITY_IMS')

    return {
      hasTransportWifi: true,
      hasTransportCellular: true,
      hasTransportBluetooth: this.spec.bluetooth.lowEnergySupported,
      networkCapabilities: caps
    }
  }
}
