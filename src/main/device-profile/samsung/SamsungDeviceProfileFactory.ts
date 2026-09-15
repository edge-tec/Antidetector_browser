import { SamsungDeviceProfile } from './SamsungDeviceProfile'
import { GalaxyA16Profile, GalaxyA16ProfileOptions } from '../profiles/GalaxyA16Profile'
import { GalaxyA33Profile, GalaxyA33ProfileOptions } from '../profiles/GalaxyA33Profile'

export type SamsungModelKey = 'galaxy-a16' | 'galaxy-a33' | string

export interface ModelMetadata {
  key: SamsungModelKey
  displayName: string
  modelCode: string
  soc: string
  defaultAndroidVersion: string
  screenSizeInches: number
  has5G: boolean
}

/**
 * Factory class for creating and registering Samsung Device Profiles.
 * Enables easy addition of future Galaxy A-series, S-series, and Z-series profiles.
 */
export class SamsungDeviceProfileFactory {
  private static registry: Map<
    string,
    (options?: any) => SamsungDeviceProfile
  > = new Map()

  private static metadataRegistry: Map<string, ModelMetadata> = new Map()

  static {
    // Register built-in Galaxy A16
    SamsungDeviceProfileFactory.registerModel(
      'galaxy-a16',
      {
        key: 'galaxy-a16',
        displayName: 'Samsung Galaxy A16',
        modelCode: 'SM-A165F',
        soc: 'Exynos 1330',
        defaultAndroidVersion: '15',
        screenSizeInches: 6.7,
        has5G: false
      },
      (options?: GalaxyA16ProfileOptions) => new GalaxyA16Profile(options)
    )

    // Register built-in Galaxy A33 5G
    SamsungDeviceProfileFactory.registerModel(
      'galaxy-a33',
      {
        key: 'galaxy-a33',
        displayName: 'Samsung Galaxy A33 5G',
        modelCode: 'SM-A336E',
        soc: 'Exynos 1280',
        defaultAndroidVersion: '15',
        screenSizeInches: 6.4,
        has5G: true
      },
      (options?: GalaxyA33ProfileOptions) => new GalaxyA33Profile(options)
    )
  }

  /**
   * Register a new Samsung device model into the factory.
   */
  public static registerModel(
    key: string,
    metadata: ModelMetadata,
    factoryFn: (options?: any) => SamsungDeviceProfile
  ): void {
    const normalizedKey = key.toLowerCase()
    this.registry.set(normalizedKey, factoryFn)
    this.metadataRegistry.set(normalizedKey, metadata)
  }

  /**
   * Instantiate a Samsung device profile by model key.
   */
  public static create(modelKey: SamsungModelKey, options?: any): SamsungDeviceProfile {
    const normalizedKey = modelKey.toLowerCase()
    const factoryFn = this.registry.get(normalizedKey)
    if (!factoryFn) {
      throw new Error(
        `Unknown Samsung model key: "${modelKey}". Available models: ${Array.from(this.registry.keys()).join(', ')}`
      )
    }
    return factoryFn(options)
  }

  /**
   * Returns a list of all registered Samsung models and their metadata.
   */
  public static getSupportedModels(): ModelMetadata[] {
    return Array.from(this.metadataRegistry.values())
  }

  /**
   * Checks if a model key is supported.
   */
  public static isModelSupported(modelKey: string): boolean {
    return this.registry.has(modelKey.toLowerCase())
  }
}
