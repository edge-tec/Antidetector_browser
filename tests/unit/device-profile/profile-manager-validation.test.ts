import { describe, it, expect, vi } from 'vitest'
import {
  ProfileManager,
  SamsungDeviceProfileValidator,
  SyntheticIdentifierGenerator,
  DeviceProfileLogger,
  GalaxyA16Profile,
  CapabilityStatus
} from '../../../src/main/device-profile'

describe('Profile Manager, Validation Engine, Synthetic Identity & Logging', () => {
  describe('SyntheticIdentifierGenerator', () => {
    it('should generate properly marked synthetic identifiers', () => {
      const ids = SyntheticIdentifierGenerator.generate('a16')

      expect(ids.isSynthetic).toBe(true)
      expect(ids.type).toBe('synthetic-test-profile')
      expect(ids.profileId).toMatch(/^synth-profile-a16-/)
      expect(ids.testDeviceId).toMatch(/^SYNTH-DEV-A16-/)
      expect(ids.syntheticSessionId).toMatch(/^SYNTH-SESS-/)
      expect(SyntheticIdentifierGenerator.isCompliantSynthetic(ids)).toBe(true)
    })

    it('should reject non-synthetic or non-compliant identifiers', () => {
      const nonCompliant = {
        isSynthetic: false as any,
        type: 'real' as any,
        profileId: '12345',
        testDeviceId: 'IMEI358912345678901',
        syntheticSessionId: 'sess-1',
        installationId: 'inst-1',
        syntheticSimId: 'sim-1',
        generatedAt: new Date().toISOString()
      }
      expect(SyntheticIdentifierGenerator.isCompliantSynthetic(nonCompliant)).toBe(false)
    })
  })

  describe('SamsungDeviceProfileValidator', () => {
    it('should validate a valid Galaxy A16 profile JSON successfully', () => {
      const a16 = new GalaxyA16Profile()
      const json = a16.toJSON()
      const result = SamsungDeviceProfileValidator.validate(json)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation on missing required root fields', () => {
      const invalidJson = { model: 'Galaxy A16' }
      const result = SamsungDeviceProfileValidator.validate(invalidJson)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.field === 'profileId')).toBe(true)
      expect(result.errors.some((e) => e.field === 'android')).toBe(true)
    })

    it('should reject unsupported security bypass / attestation forgery claims', () => {
      const a16 = new GalaxyA16Profile()
      const json = a16.toJSON()

      // Illegitimate claim: claiming Knox hardware vault is fully supported in pure software
      json.capabilities['KNOX_HARDWARE_VAULT'] = CapabilityStatus.SUPPORTED

      const result = SamsungDeviceProfileValidator.validate(json)
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'UNSUPPORTED_CLAIM')).toBe(true)
    })

    it('should reject non-synthetic identifiers', () => {
      const a16 = new GalaxyA16Profile()
      const json = a16.toJSON()
      json.identifiers.isSynthetic = false as any

      const result = SamsungDeviceProfileValidator.validate(json)
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'SECURITY_VIOLATION')).toBe(true)
    })
  })

  describe('ProfileManager Lifecycle', () => {
    it('should create, retrieve, enable and disable profiles', () => {
      const manager = new ProfileManager()
      const profile = manager.createProfile('galaxy-a16')

      expect(profile).toBeDefined()
      expect(manager.getProfile(profile.profileId)).toBe(profile)
      expect(profile.enabled).toBe(true)

      manager.setProfileEnabled(profile.profileId, false)
      expect(profile.enabled).toBe(false)

      manager.setProfileEnabled(profile.profileId, true)
      expect(profile.enabled).toBe(true)
    })

    it('should duplicate a profile with fresh synthetic identifiers', () => {
      const manager = new ProfileManager()
      const original = manager.createProfile('galaxy-a33')
      const cloned = manager.duplicateProfile(original.profileId)

      expect(cloned.profileId).not.toBe(original.profileId)
      expect(cloned.getIdentifiers().testDeviceId).not.toBe(original.getIdentifiers().testDeviceId)
      expect(cloned.model).toBe(original.model)
      expect(cloned.getAndroidBuild().fingerprint).toBe(original.getAndroidBuild().fingerprint)
    })

    it('should export and import configuration successfully with validation', () => {
      const manager = new ProfileManager()
      const original = manager.createProfile('galaxy-a16')

      const exportedJson = manager.exportConfiguration(original.profileId)
      expect(typeof exportedJson).toBe('string')

      const imported = manager.importConfiguration(exportedJson)
      expect(imported.profileId).toBe(original.profileId)
      expect(imported.model).toBe('Galaxy A16')
      expect(imported.getDisplayMetrics().densityDpi).toBe(420)
    })

    it('should reset identifiers for an existing profile', () => {
      const manager = new ProfileManager()
      const profile = manager.createProfile('galaxy-a16')
      const oldDeviceId = profile.getIdentifiers().testDeviceId

      manager.resetProfile(profile.profileId)
      const newDeviceId = profile.getIdentifiers().testDeviceId

      expect(newDeviceId).not.toBe(oldDeviceId)
      expect(newDeviceId).toMatch(/^SYNTH-DEV-A16/)
    })
  })

  describe('DeviceProfileLogger', () => {
    it('should log structured events and scrub sensitive credentials', () => {
      const logEntries: any[] = []
      const unsubscribe = DeviceProfileLogger.subscribe((entry) => {
        logEntries.push(entry)
      })

      DeviceProfileLogger.info('Test simulation event', {
        profileId: 'test-1',
        model: 'Galaxy A16',
        data: {
          testParam: 'safe-value',
          userPassword: 'secretPassword123',
          deviceImei: '359876543210987'
        }
      })

      unsubscribe()

      expect(logEntries.length).toBeGreaterThan(0)
      const last = logEntries[logEntries.length - 1]
      expect(last.event).toBe('Test simulation event')
      expect(last.data.testParam).toBe('safe-value')
      expect(last.data.userPassword).toBe('[REDACTED_BY_SECURITY_POLICY]')
      expect(last.data.deviceImei).toBe('[REDACTED_BY_SECURITY_POLICY]')
    })
  })
})
