// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Google Redirect Interceptor (CDP Fetch Domain)
// Intercepts Google /sorry/, /url, and redirect interstitial pages
// at the network level and redirects directly to the destination URL.
// ──────────────────────────────────────────────────────────────────

import { Page } from 'puppeteer-core'
import { logger } from '../../logging/logger'

/**
 * Known Google redirect/interstitial URL patterns.
 * These are the hostnames and paths that Google uses to gate traffic
 * through reCAPTCHA verification before allowing access to the target.
 */
const GOOGLE_REDIRECT_PATTERNS = [
  { hostname: /^(www\.)?google\.[a-z.]+$/i, path: '/sorry/' },
  { hostname: /^(www\.)?google\.[a-z.]+$/i, path: '/url' },
  { hostname: /^consent\.google\.[a-z.]+$/i, path: '/' },
  { hostname: /^ipv4\.google\.[a-z.]+$/i, path: '/sorry/' }
]

/**
 * Query parameter names that Google uses to carry the original destination URL.
 */
const DESTINATION_PARAMS = ['continue', 'url', 'q', 'dest', 'redirect', 'target']

/**
 * Check if a URL is a Google redirect/interstitial page.
 */
function isGoogleRedirectUrl(url: string): boolean {
  try {
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
        return value
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Setup CDP Fetch-based request interception to catch Google redirect pages
 * before they render. This is the most reliable layer — it prevents the
 * reCAPTCHA page from ever loading.
 *
 * Works by:
 * 1. Enabling Fetch.enable with request patterns matching Google redirect URLs
 * 2. On Fetch.requestPaused, checking if the URL is a redirect/interstitial
 * 3. Extracting the destination URL and navigating directly to it
 * 4. Failing the original request to prevent the interstitial from loading
 */
export async function setupGoogleRedirectInterceptor(page: Page): Promise<void> {
  try {
    const client = await page.target().createCDPSession()

    // Enable Fetch domain to intercept requests matching Google redirect patterns
    await client.send('Fetch.enable', {
      patterns: [
        { urlPattern: '*://www.google.*/sorry/*', requestStage: 'Request' },
        { urlPattern: '*://google.*/sorry/*', requestStage: 'Request' },
        { urlPattern: '*://www.google.*/url?*', requestStage: 'Request' },
        { urlPattern: '*://google.*/url?*', requestStage: 'Request' },
        { urlPattern: '*://consent.google.*/*', requestStage: 'Request' },
        { urlPattern: '*://ipv4.google.*/sorry/*', requestStage: 'Request' },
        // Also intercept response stage to catch server-side 302 redirects to /sorry/
        { urlPattern: '*://www.google.*/sorry/*', requestStage: 'Response' },
        { urlPattern: '*://google.*/sorry/*', requestStage: 'Response' }
      ]
    })

    client.on('Fetch.requestPaused', async (event: any) => {
      const { requestId, request, responseStatusCode, responseHeaders } = event
      const url = request?.url || ''

      try {
        // Check if this is a server-side redirect (302/303) pointing to a Google interstitial
        if (responseStatusCode && (responseStatusCode === 301 || responseStatusCode === 302 || responseStatusCode === 303 || responseStatusCode === 307)) {
          const locationHeader = responseHeaders?.find(
            (h: any) => h.name.toLowerCase() === 'location'
          )
          if (locationHeader && isGoogleRedirectUrl(locationHeader.value)) {
            const destUrl = extractDestinationUrl(locationHeader.value)
            if (destUrl) {
              logger.info('browser', `[GoogleRedirectInterceptor] Intercepted 302 redirect to Google interstitial. Redirecting to: ${destUrl.slice(0, 120)}`)
              // Fail the original request and navigate to destination
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
            // Fail the redirect request and navigate directly to the destination
            await client.send('Fetch.failRequest', { requestId, errorReason: 'Aborted' })
            try {
              await page.goto(destUrl, { waitUntil: 'domcontentloaded' })
            } catch { /* Page may have been navigated by user */ }
            return
          } else {
            logger.warn('browser', `[GoogleRedirectInterceptor] Could not extract destination from: ${url.slice(0, 120)}. Allowing request.`)
          }
        }

        // Not a Google redirect — continue the request normally
        await client.send('Fetch.continueRequest', { requestId })
      } catch (err: any) {
        // If we fail to handle it, try to continue the request to avoid hanging
        try {
          await client.send('Fetch.continueRequest', { requestId })
        } catch { /* Already handled or page navigated */ }
      }
    })

    logger.info('browser', '[GoogleRedirectInterceptor] CDP Fetch interception active')
  } catch (err: any) {
    logger.warn('browser', `[GoogleRedirectInterceptor] Failed to setup: ${err.message}`)
  }
}
