// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google Redirect Interceptor (CDP Fetch Domain)
// Intercepts Google /sorry/, /url, and redirect interstitial pages
// at the network level and redirects directly to the destination URL.
// ──────────────────────────────────────────────────────────────────

import { Page } from 'puppeteer-core'
import { logger } from '../../logging/logger'

/**
 * Known Google redirect/interstitial URL patterns.
 * Strictly limited to search /sorry/ bot block pages.
 * Never match accounts.google.com or authentication services.
 */
const GOOGLE_REDIRECT_PATTERNS = [
  { hostname: /^(www\.)?google\.[a-z.]+$/i, path: '/sorry/' },
  { hostname: /^ipv4\.google\.[a-z.]+$/i, path: '/sorry/' }
]

/**
 * Check if a URL is an authentication or login flow that must never be intercepted.
 */
function isAuthOrAccountUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()

    if (
      host.includes('accounts.google.') ||
      host.includes('myaccount.google.') ||
      host.includes('oauth2.googleapis.') ||
      host.includes('apis.google.com') ||
      host.includes('identitytoolkit.googleapis.')
    ) {
      return true
    }

    if (
      path.includes('/signin') ||
      path.includes('/signup') ||
      path.includes('/servicelogin') ||
      path.includes('/checkcookie') ||
      path.includes('/oauth') ||
      path.includes('/identifier') ||
      path.includes('/challenge') ||
      path.includes('/v3/signin')
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Query parameter names that Google uses to carry the original destination URL.
 */
const DESTINATION_PARAMS = ['continue', 'url', 'q', 'dest', 'redirect', 'target']

/**
 * Check if a URL is a Google redirect/interstitial page.
 */
function isGoogleRedirectUrl(url: string): boolean {
  try {
    if (isAuthOrAccountUrl(url)) return false
    const parsed = new URL(url)
    return GOOGLE_REDIRECT_PATTERNS.some(
      (pattern) => pattern.hostname.test(parsed.hostname) && parsed.pathname.startsWith(pattern.path)
    )
  } catch {
    return false
  }
}

/**
 * Extract the original destination URL from a Google redirect URL.
 * Tries multiple known query parameter names and validates the result.
 */
function extractDestinationUrl(redirectUrl: string): string | null {
  try {
    if (isAuthOrAccountUrl(redirectUrl)) return null
    const parsed = new URL(redirectUrl)
    for (const param of DESTINATION_PARAMS) {
      const value = parsed.searchParams.get(param)
      if (value) {
        // The value might be URL-encoded, try to decode it
        let decoded = value
        try {
          decoded = decodeURIComponent(value)
        } catch {
          decoded = value
        }

        // Never redirect into auth pages or abort auth flows
        if (isAuthOrAccountUrl(decoded)) {
          return null
        }

        // Validate it looks like a proper URL
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded
        }

        // Try prepending https:// if it looks like a domain
        if (decoded.includes('.') && !decoded.includes(' ') && !decoded.startsWith('/')) {
          return `https://${decoded}`
        }
      }
    }

    // Fallback: check for Google /url format where destination is in 'q' after hash
    const hashParams = new URLSearchParams(parsed.hash.slice(1))
    for (const param of DESTINATION_PARAMS) {
      const value = hashParams.get(param)
      if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
        if (isAuthOrAccountUrl(value)) return null
        return value
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Setup CDP Fetch-based request interception to catch Google /sorry/ bot block pages
 * before they render. Never intercepts or disrupts accounts or sign-in flows.
 */
export async function setupGoogleRedirectInterceptor(page: Page): Promise<void> {
  try {
    const client = await page.target().createCDPSession()

    // Enable Fetch domain strictly for /sorry/ bot gate pages
    await client.send('Fetch.enable', {
      patterns: [
        { urlPattern: '*://www.google.*/sorry/*', requestStage: 'Request' },
        { urlPattern: '*://google.*/sorry/*', requestStage: 'Request' },
        { urlPattern: '*://ipv4.google.*/sorry/*', requestStage: 'Request' },
        { urlPattern: '*://www.google.*/sorry/*', requestStage: 'Response' },
        { urlPattern: '*://google.*/sorry/*', requestStage: 'Response' }
      ]
    })

    client.on('Fetch.requestPaused', async (event: any) => {
      const { requestId, request, responseStatusCode, responseHeaders } = event
      const url = request?.url || ''

      try {
        if (isAuthOrAccountUrl(url)) {
          await client.send('Fetch.continueRequest', { requestId })
          return
        }

        // Check if this is a server-side redirect (302/303) pointing to a Google interstitial
        if (responseStatusCode && (responseStatusCode === 301 || responseStatusCode === 302 || responseStatusCode === 303 || responseStatusCode === 307)) {
          const locationHeader = responseHeaders?.find(
            (h: any) => h.name.toLowerCase() === 'location'
          )
          if (locationHeader && isGoogleRedirectUrl(locationHeader.value)) {
            const destUrl = extractDestinationUrl(locationHeader.value)
            if (destUrl) {
              logger.info('browser', `[GoogleRedirectInterceptor] Intercepted 302 redirect to Google interstitial. Redirecting to: ${destUrl.slice(0, 120)}`)
              await client.send('Fetch.failRequest', { requestId, errorReason: 'Aborted' })
              try {
                await page.goto(destUrl, { waitUntil: 'domcontentloaded' })
              } catch { /* Page may have been navigated by user */ }
              return
            }
          }
        }

        // Check if this request itself is a Google redirect URL
        if (isGoogleRedirectUrl(url)) {
          const destUrl = extractDestinationUrl(url)
          if (destUrl) {
            logger.info('browser', `[GoogleRedirectInterceptor] Intercepted Google redirect: ${url.slice(0, 80)} → ${destUrl.slice(0, 120)}`)
            await client.send('Fetch.failRequest', { requestId, errorReason: 'Aborted' })
            try {
              await page.goto(destUrl, { waitUntil: 'domcontentloaded' })
            } catch { /* Page may have been navigated by user */ }
            return
          }
        }

        // Not a blocked redirect — continue the request normally
        await client.send('Fetch.continueRequest', { requestId })
      } catch (err: any) {
        try {
          await client.send('Fetch.continueRequest', { requestId })
        } catch { /* Already handled or page navigated */ }
      }
    })

    logger.info('browser', '[GoogleRedirectInterceptor] CDP Fetch interception active (auth-safe)')
  } catch (err: any) {
    logger.warn('browser', `[GoogleRedirectInterceptor] Failed to setup: ${err.message}`)
  }
}
