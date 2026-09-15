import { SamsungDeviceProfileJson, CapabilityStatus } from '../core/types'
import { SyntheticIdentifierGenerator } from '../identity/SyntheticIdentifierGenerator'

export interface ValidationError {
  field: string
  message: string
  code: 'MISSING_FIELD' | 'INVALID_RANGE' | 'INVALID_FORMAT' | 'SECURITY_VIOLATION' | 'UNSUPPORTED_CLAIM'
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
}

/**
 * Validation engine for Samsung Device Profiles.
 * Validates specifications, consistency, synthetic identity rules, and absence of unsupported security claims.
 */
export class SamsungDeviceProfileValidator {
  public static validate(profileJson: unknown): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    if (!profileJson || typeof profileJson !== 'object') {
      return {
        isValid: false,
        errors: [{ field: 'root', message: 'Profile JSON must be a non-null object', code: 'INVALID_FORMAT' }],
        warnings: []
      }
    }

    const data = profileJson as Partial<SamsungDeviceProfileJson>

    // 1. Check Root Required Fields
    const rootRequired = ['profileId', 'manufacturer', 'brand', 'model', 'android', 'display', 'hardware', 'identifiers']
    for (const field of rootRequired) {
      if (!(field in data) || data[field as keyof SamsungDeviceProfileJson] === undefined) {
        errors.push({
          field,
          message: `Missing required field "${field}" in profile definition`,
          code: 'MISSING_FIELD'
        })
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings }
    }

    // 2. Validate Manufacturer & Brand
    if (data.manufacturer?.toLowerCase() !== 'samsung') {
      errors.push({
        field: 'manufacturer',
        message: `Expected manufacturer to be "Samsung", got "${data.manufacturer}"`,
        code: 'INVALID_FORMAT'
      })
    }

    // 3. Validate Android Specification
    if (data.android) {
      if (!data.android.androidVersion || !['14', '15', '16'].includes(data.android.androidVersion)) {
        errors.push({
          field: 'android.androidVersion',
          message: `Unsupported Android version "${data.android.androidVersion}". Supported versions: 14, 15, 16`,
          code: 'INVALID_RANGE'
        })
      }

      if (!data.android.apiLevel || data.android.apiLevel < 34 || data.android.apiLevel > 36) {
        errors.push({
          field: 'android.apiLevel',
          message: `Invalid Android API level "${data.android.apiLevel}". Expected 34, 35, or 36`,
          code: 'INVALID_RANGE'
        })
      }

      if (!data.android.fingerprint || !data.android.fingerprint.startsWith('samsung/')) {
        errors.push({
          field: 'android.fingerprint',
          message: `Android fingerprint must start with "samsung/", got "${data.android.fingerprint}"`,
          code: 'INVALID_FORMAT'
        })
      }
    }

    // 4. Validate Display Configuration
    if (data.display) {
      if (data.display.widthPixels <= 0 || data.display.heightPixels <= 0) {
        errors.push({
          field: 'display.resolution',
          message: 'Display width and height must be positive integers',
          code: 'INVALID_RANGE'
        })
      }

      if (data.display.densityDpi < 120 || data.display.densityDpi > 640) {
        errors.push({
          field: 'display.densityDpi',
          message: `Invalid screen density DPI: ${data.display.densityDpi}. Expected range: 120-640`,
          code: 'INVALID_RANGE'
        })
      }

      if (![60, 90, 120].includes(data.display.refreshRate)) {
        warnings.push(`Non-standard Samsung refresh rate: ${data.display.refreshRate}Hz`)
      }
    }

    // 5. Validate Camera Configuration
    if (Array.isArray(data.cameras)) {
      for (let i = 0; i < data.cameras.length; i++) {
        const cam = data.cameras[i]
        if (!cam.cameraId || cam.sensorResolutionMp <= 0) {
          errors.push({
            field: `cameras[${i}]`,
            message: `Camera at index ${i} has invalid ID or resolution`,
            code: 'INVALID_FORMAT'
          })
        }
      }
    } else {
      errors.push({
        field: 'cameras',
        message: 'Cameras field must be an array',
        code: 'INVALID_FORMAT'
      })
    }

    // 6. Validate Sensors Configuration
    if (Array.isArray(data.sensors)) {
      if (data.sensors.length === 0) {
        warnings.push('Profile defines 0 sensors; modern Samsung devices have multiple sensors')
      }
    } else {
      errors.push({
        field: 'sensors',
        message: 'Sensors field must be an array',
        code: 'INVALID_FORMAT'
      })
    }

    // 7. Validate Identifiers (Strictly Synthetic)
    if (data.identifiers) {
      if (!SyntheticIdentifierGenerator.isCompliantSynthetic(data.identifiers)) {
        errors.push({
          field: 'identifiers',
          message: 'Identifiers must be synthetic and properly tagged with SYNTH- prefixes. Real device identifiers are prohibited.',
          code: 'SECURITY_VIOLATION'
        })
      }
    }

    // 8. Validate Absence of Unsupported Security Claims
    if (data.capabilities) {
      const restrictedFeatures = [
        'KNOX_HARDWARE_VAULT',
        'STRONGBOX_KEYSTORE',
        'HARDWARE_BACKED_ATTESTATION',
        'PLAY_INTEGRITY_HARDWARE_VERIFICATION',
        'WIDEVINE_L1_OEM_CRYPTO'
      ]

      for (const feature of restrictedFeatures) {
        if (data.capabilities[feature] === CapabilityStatus.SUPPORTED) {
          errors.push({
            field: `capabilities.${feature}`,
            message: `Feature "${feature}" cannot be claimed as SUPPORTED without physical Samsung hardware and Knox crypto-fuses. Expected REQUIRES_REAL_HARDWARE.`,
            code: 'UNSUPPORTED_CLAIM'
          })
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}
