import { v4 as uuidv4 } from 'uuid'
import { SyntheticIdentifiers } from '../core/types'

/**
 * Generates purely synthetic identifiers for automated testing and QA environments.
 * Strictly guarantees that no real IMEIs, MAC addresses, IMSI, or personal device IDs are used.
 */
export class SyntheticIdentifierGenerator {
  /**
   * Generates a new unique set of synthetic test identifiers.
   * Every identifier is prefixed or structured to make its synthetic test nature unmistakable.
   */
  public static generate(modelCodename: string = 'galaxy'): SyntheticIdentifiers {
    const cleanCodename = modelCodename.toLowerCase().replace(/[^a-z0-9]/g, '')
    const randomHex = uuidv4().replace(/-/g, '').slice(0, 16)
    const sessionHex = uuidv4().replace(/-/g, '').slice(0, 12)

    return {
      isSynthetic: true,
      type: 'synthetic-test-profile',
      profileId: `synth-profile-${cleanCodename}-${uuidv4()}`,
      testDeviceId: `SYNTH-DEV-${cleanCodename.toUpperCase()}-${randomHex}`,
      syntheticSessionId: `SYNTH-SESS-${sessionHex}`,
      installationId: `synth-app-install-${uuidv4()}`,
      syntheticSimId: `SYNTH-SIM-TEST-${randomHex.slice(0, 8)}`,
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Verifies whether a given identifier structure is strictly synthetic and compliant.
   */
  public static isCompliantSynthetic(identifiers: SyntheticIdentifiers): boolean {
    if (!identifiers.isSynthetic) return false
    if (identifiers.type !== 'synthetic-test-profile') return false
    if (!identifiers.profileId.startsWith('synth-profile-')) return false
    if (!identifiers.testDeviceId.startsWith('SYNTH-DEV-')) return false
    if (!identifiers.syntheticSessionId.startsWith('SYNTH-SESS-')) return false
    return true
  }
}
