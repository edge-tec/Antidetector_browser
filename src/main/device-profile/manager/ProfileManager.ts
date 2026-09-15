import { SamsungDeviceProfile } from '../samsung/SamsungDeviceProfile'
import { SamsungDeviceProfileFactory, SamsungModelKey } from '../samsung/SamsungDeviceProfileFactory'
import { SamsungDeviceProfileJson } from '../core/types'
import { SamsungDeviceProfileValidator, ValidationResult } from '../validation/SamsungDeviceProfileValidator'
import { SyntheticIdentifierGenerator } from '../identity/SyntheticIdentifierGenerator'
import { DeviceProfileLogger } from '../logging/DeviceProfileLogger'

/**
 * ProfileManager coordinates lifecycle of Samsung device profiles:
 * Create, Edit, Duplicate, Reset, Import, Export, Enable/Disable, and Validate.
 */
export class ProfileManager {
  private profiles: Map<string, SamsungDeviceProfile> = new Map()

  /**
   * Creates a new Samsung device profile from a registered model key.
   */
  public createProfile(modelKey: SamsungModelKey, options?: any): SamsungDeviceProfile {
    const profile = SamsungDeviceProfileFactory.create(modelKey, options)
    this.profiles.set(profile.profileId, profile)

    DeviceProfileLogger.info('Profile created', {
      profileId: profile.profileId,
      model: profile.model,
      data: { modelKey }
    })

    return profile
  }

  /**
   * Retrieves an existing profile by ID.
   */
  public getProfile(profileId: string): SamsungDeviceProfile | undefined {
    return this.profiles.get(profileId)
  }

  /**
   * Returns all active/registered profiles.
   */
  public getAllProfiles(): SamsungDeviceProfile[] {
    return Array.from(this.profiles.values())
  }

  /**
   * Duplicates an existing profile, generating completely fresh synthetic identifiers for isolation.
   */
  public duplicateProfile(profileId: string, customNewId?: string): SamsungDeviceProfile {
    const original = this.profiles.get(profileId)
    if (!original) {
      throw new Error(`Cannot duplicate: profile "${profileId}" not found`)
    }

    const modelKey = original.deviceCodename === 'a16x' ? 'galaxy-a16' : 'galaxy-a33'
    const newSynthIds = SyntheticIdentifierGenerator.generate(original.deviceCodename)
    const newProfileId = customNewId ?? newSynthIds.profileId

    const cloned = SamsungDeviceProfileFactory.create(modelKey, {
      profileId: newProfileId,
      identifiers: newSynthIds,
      androidVersion: original.getAndroidBuild().androidVersion as '14' | '15',
      apiLevel: original.getAndroidBuild().apiLevel as 34 | 35,
      ramGb: original.getHardware().ramGb as 4 | 6 | 8,
      storageGb: original.getHardware().storageGb as 128 | 256
    })

    this.profiles.set(cloned.profileId, cloned)

    DeviceProfileLogger.info('Profile duplicated', {
      profileId: cloned.profileId,
      model: cloned.model,
      data: { sourceProfileId: profileId }
    })

    return cloned
  }

  /**
   * Resets an existing profile's identifiers and resets timestamp.
   */
  public resetProfile(profileId: string): SamsungDeviceProfile {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      throw new Error(`Cannot reset: profile "${profileId}" not found`)
    }

    const freshIds = SyntheticIdentifierGenerator.generate(profile.deviceCodename)
    profile.setIdentifiers(freshIds)

    DeviceProfileLogger.info('Profile identifiers reset', {
      profileId: profile.profileId,
      model: profile.model
    })

    return profile
  }

  /**
   * Enables or disables a profile.
   */
  public setProfileEnabled(profileId: string, enabled: boolean): boolean {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      throw new Error(`Profile "${profileId}" not found`)
    }
    profile.enabled = enabled
    profile.updatedAt = new Date().toISOString()

    DeviceProfileLogger.info(enabled ? 'Profile enabled' : 'Profile disabled', {
      profileId,
      model: profile.model
    })

    return profile.enabled
  }

  /**
   * Exports profile configuration to JSON string.
   */
  public exportConfiguration(profileId: string): string {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      throw new Error(`Cannot export: profile "${profileId}" not found`)
    }
    return JSON.stringify(profile.toJSON(), null, 2)
  }

  /**
   * Imports profile from JSON string, performing validation prior to registration.
   */
  public importConfiguration(jsonString: string): SamsungDeviceProfile {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonString)
    } catch (e: any) {
      DeviceProfileLogger.error('Configuration parse error during import', {
        data: { error: e.message }
      })
      throw new Error(`Invalid JSON syntax: ${e.message}`)
    }

    const validation = SamsungDeviceProfileValidator.validate(parsed)
    if (!validation.isValid) {
      DeviceProfileLogger.error('Configuration validation failed during import', {
        data: { errors: validation.errors }
      })
      throw new Error(
        `Profile validation failed:\n${validation.errors.map((err) => ` - [${err.code}] ${err.field}: ${err.message}`).join('\n')}`
      )
    }

    const data = parsed as SamsungDeviceProfileJson
    const modelKey = data.model.toLowerCase().includes('a33') ? 'galaxy-a33' : 'galaxy-a16'

    const imported = SamsungDeviceProfileFactory.create(modelKey, {
      profileId: data.profileId,
      androidVersion: data.android.androidVersion as '14' | '15',
      apiLevel: data.android.apiLevel as 34 | 35,
      ramGb: data.hardware.ramGb as 4 | 6 | 8,
      storageGb: data.hardware.storageGb as 128 | 256,
      identifiers: data.identifiers
    })

    imported.enabled = data.enabled
    this.profiles.set(imported.profileId, imported)

    DeviceProfileLogger.info('Profile imported successfully', {
      profileId: imported.profileId,
      model: imported.model
    })

    return imported
  }

  /**
   * Validates a profile's current state.
   */
  public validateProfile(profileId: string): ValidationResult {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      return {
        isValid: false,
        errors: [{ field: 'profileId', message: `Profile "${profileId}" not found`, code: 'MISSING_FIELD' }],
        warnings: []
      }
    }
    return SamsungDeviceProfileValidator.validate(profile.toJSON())
  }
}
