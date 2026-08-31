import { describe, it, expect, beforeEach } from 'vitest'
import { GmailAccountService } from '../../src/main/services/gmail-account-service'
import { IosAuthRuntimeEngine, setupIosGoogleAuthInterception } from '../../src/main/browser/auth/ios-auth-runtime'

describe('GmailAccountService & iOS Google Auth Interceptor', () => {
  const mockProfileId = 'test-ios-profile-123'

  it('correctly handles unconnected account checks', () => {
    const isConnected = GmailAccountService.isAccountConnected(mockProfileId)
    expect(isConnected).toBe(false)
  })

  it('rejects unauthorized message listing when not connected', async () => {
    const res = await GmailAccountService.listMessages('unauthorized-profile-id')
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unauthorized')
  })

  it('rejects unauthorized message sending when not connected', async () => {
    const res = await GmailAccountService.sendMessage('unauthorized-profile-id', {
      to: 'test@example.com',
      subject: 'Test Email',
      bodyText: 'Hello World'
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unauthorized')
  })

  it('identifies Google authentication URLs correctly for intercepting', () => {
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://accounts.google.com/signin/v2/identifier')).toBe(true)
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://accounts.google.com/v3/signin')).toBe(true)
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://oauth.google.com/auth')).toBe(true)
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://www.google.com/servicelogin')).toBe(true)
    
    // Normal browsing must NOT be intercepted
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://www.google.com/search?q=antiprofiles')).toBe(false)
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://mail.google.com/mail/u/0/#inbox')).toBe(false)
    expect(IosAuthRuntimeEngine.shouldInterceptForSecureAuth('https://example.com/?q=accounts.google.com')).toBe(false)
  })

  it('attaches CDP Fetch interception without errors', async () => {
    let fetchEnabled = false
    let pausedHandler: any = null

    const mockCdpSession = {
      send: async (method: string, params: any) => {
        if (method === 'Fetch.enable') {
          fetchEnabled = true
        }
        return {}
      },
      on: (event: string, handler: any) => {
        if (event === 'Fetch.requestPaused') {
          pausedHandler = handler
        }
      }
    }

    const mockPage = {
      target: () => ({
        createCDPSession: async () => mockCdpSession
      })
    }

    await setupIosGoogleAuthInterception(mockPage, mockProfileId)
    expect(fetchEnabled).toBe(true)
    expect(typeof pausedHandler).toBe('function')
  })
})
