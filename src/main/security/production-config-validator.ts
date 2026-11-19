// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Production Environment Configuration Validator
// Validates required/optional production env vars without ever
// printing or returning raw secret values
// ──────────────────────────────────────────────────────────────────

export interface EnvCheckItem {
  name: string
  category: 'cloud' | 'macos_signing' | 'windows_signing' | 'updater'
  requiredForCommercialRelease: boolean
  configured: boolean
  purpose: string
}

export interface ProductionConfigReport {
  timestamp: string
  cloudReady: boolean
  macosSigningReady: boolean
  windowsSigningReady: boolean
  updaterReady: boolean
  allCommercialGatesReady: boolean
  missingRequired: string[]
  items: EnvCheckItem[]
}

const ENV_SPEC: Array<{
  name: string
  category: EnvCheckItem['category']
  requiredForCommercialRelease: boolean
  purpose: string
}> = [
  { name: 'ANTIPROFILES_S3_ENDPOINT', category: 'cloud', requiredForCommercialRelease: true, purpose: 'S3 / Cloudflare R2 HTTPS endpoint URL' },
  { name: 'ANTIPROFILES_S3_BUCKET', category: 'cloud', requiredForCommercialRelease: true, purpose: 'Dedicated encrypted profile backup bucket' },
  { name: 'ANTIPROFILES_S3_ACCESS_KEY', category: 'cloud', requiredForCommercialRelease: true, purpose: 'Least-privilege S3/R2 access key ID' },
  { name: 'ANTIPROFILES_S3_SECRET_KEY', category: 'cloud', requiredForCommercialRelease: true, purpose: 'Least-privilege S3/R2 secret access key' },
  { name: 'CSC_LINK', category: 'macos_signing', requiredForCommercialRelease: true, purpose: 'Apple Developer ID Application .p12 certificate' },
  { name: 'CSC_KEY_PASSWORD', category: 'macos_signing', requiredForCommercialRelease: true, purpose: 'Password for Apple Developer ID .p12 certificate' },
  { name: 'APPLE_ID', category: 'macos_signing', requiredForCommercialRelease: true, purpose: 'Apple Developer account email for notarization' },
  { name: 'APPLE_APP_SPECIFIC_PASSWORD', category: 'macos_signing', requiredForCommercialRelease: true, purpose: 'App-specific password for notarytool' },
  { name: 'APPLE_TEAM_ID', category: 'macos_signing', requiredForCommercialRelease: true, purpose: '10-character Apple Developer Team ID' },
  { name: 'WIN_CSC_LINK', category: 'windows_signing', requiredForCommercialRelease: true, purpose: 'Windows Authenticode code-signing certificate' },
  { name: 'WIN_CSC_KEY_PASSWORD', category: 'windows_signing', requiredForCommercialRelease: true, purpose: 'Password for Windows Authenticode certificate' },
  { name: 'ANTIPROFILES_UPDATE_URL', category: 'updater', requiredForCommercialRelease: false, purpose: 'HTTPS update feed base URL (defaults to https://releases.antiprofiles.com/updates)' },
  { name: 'ANTIPROFILES_UPDATE_CHANNEL', category: 'updater', requiredForCommercialRelease: false, purpose: 'Release channel (stable or beta)' }
]

/**
 * Inspect environment variables and return a secret-safe readiness report.
 * Never returns or logs actual secret values.
 */
export function validateProductionEnvironment(env: Record<string, string | undefined> = process.env): ProductionConfigReport {
  const items: EnvCheckItem[] = ENV_SPEC.map((spec) => ({
    ...spec,
    configured: Boolean(env[spec.name] && String(env[spec.name]).trim().length > 0)
  }))

  const isCatReady = (cat: EnvCheckItem['category']) =>
    items.filter((i) => i.category === cat && i.requiredForCommercialRelease).every((i) => i.configured)

  const cloudReady = isCatReady('cloud')
  const macosSigningReady = isCatReady('macos_signing')
  const windowsSigningReady = isCatReady('windows_signing')
  const updaterUrl = env.ANTIPROFILES_UPDATE_URL || 'https://releases.antiprofiles.com/updates'
  const updaterReady = updaterUrl.startsWith('https://') && !updaterUrl.includes('.local')

  const missingRequired = items
    .filter((i) => i.requiredForCommercialRelease && !i.configured)
    .map((i) => i.name)

  return {
    timestamp: new Date().toISOString(),
    cloudReady,
    macosSigningReady,
    windowsSigningReady,
    updaterReady,
    allCommercialGatesReady: missingRequired.length === 0 && updaterReady,
    missingRequired,
    items
  }
}
