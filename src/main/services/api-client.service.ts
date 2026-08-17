// ──────────────────────────────────────────────
// AntiProfiles — Central Backend HTTPS API Client
// Connects Electron Desktop Application to Central Server (https://app.edgecash.net)
// ──────────────────────────────────────────────

import { logger } from '../logging/logger'
import { app } from 'electron'

export interface CentralUser {
  id: string
  name: string
  email: string
  role: string
  emailVerified: boolean
  accountStatus: 'active' | 'suspended' | 'pending' | 'expired'
  createdAt?: string
  lastLoginAt?: string
}

export interface CentralLicense {
  valid: boolean
  account_status: string
  subscription_status: string
  expires_at?: string
  grace_period_active?: boolean
  error?: string
  plan?: {
    id?: string
    name?: string
    monthly_price?: number
    yearly_price?: number
  }
  features?: {
    browser_profiles: boolean
    advanced_fingerprint: boolean
    proxy_manager: boolean
    profile_templates: boolean
    team_management: boolean
    api_access: boolean
  }
  limits?: {
    profiles: number
    team_members: number
    api_access: boolean
  }
  device?: {
    installation_id: string
    device_count: number
    max_devices: number
  }
}

export interface AuthResponse {
  success: boolean
  sessionToken?: string
  user?: CentralUser
  license?: CentralLicense
  error?: string
  message?: string
}

export class CentralApiClient {
  private baseUrl: string = 'https://antiprofiles.com'
  private token: string | null = null
  private currentUser: CentralUser | null = null
  private currentLicense: CentralLicense | null = null
  private installationId: string = ''

  constructor() {
    this.installationId = `inst_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '')
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public setSessionToken(token: string | null): void {
    this.token = token
  }

  public getSessionToken(): string | null {
    return this.token
  }

  public setCurrentUser(user: CentralUser | null): void {
    this.currentUser = user
  }

  public getCurrentUser(): CentralUser | null {
    return this.currentUser
  }

  public setCurrentLicense(license: CentralLicense | null): void {
    this.currentLicense = license
  }

  public getCurrentLicense(): CentralLicense | null {
    return this.currentLicense
  }

  public setInstallationId(id: string): void {
    if (id) this.installationId = id
  }

  public getInstallationId(): string {
    return this.installationId
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Installation-ID': this.installationId,
      'X-Platform': process.platform || 'darwin',
      'X-App-Version': app ? app.getVersion() : '1.0.0',
      ...extraHeaders
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>)
      })

      const text = await response.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        data = { success: response.ok, raw: text, status: response.status }
      }

      if (!response.ok && data && !data.error) {
        data.error = `HTTP Error ${response.status}: ${response.statusText}`
      }

      return data as T
    } catch (err: any) {
      logger.warn('central-api', `Network request to ${url} failed: ${err.message}`)
      return {
        success: false,
        error: err.message || 'Unable to connect to central server. Please check your internet connection.'
      } as unknown as T
    }
  }

  // ── Authentication APIs ──
  public async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, installationId: this.installationId, platform: process.platform })
    })

    if (res.success && res.sessionToken && res.user) {
      this.setSessionToken(res.sessionToken)
      this.setCurrentUser(res.user)
      if (res.license) this.setCurrentLicense(res.license)
    }
    return res
  }

  public async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    })

    if (res.success && res.sessionToken && res.user) {
      this.setSessionToken(res.sessionToken)
      this.setCurrentUser(res.user)
      if (res.license) this.setCurrentLicense(res.license)
    }
    return res
  }

  public async getProfile(): Promise<{ success: boolean; user?: CentralUser; license?: CentralLicense; error?: string }> {
    const res = await this.request<{ success: boolean; user?: CentralUser; license?: CentralLicense; error?: string }>('/api/auth/me', {
      method: 'GET'
    })

    if (res.success && res.user) {
      this.setCurrentUser(res.user)
      if (res.license) this.setCurrentLicense(res.license)
    }
    return res
  }

  public async logout(): Promise<{ success: boolean }> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' })
    } catch {}
    this.token = null
    this.currentUser = null
    this.currentLicense = null
    return { success: true }
  }

  // ── Licensing & Expiry APIs ──
  public async validateLicense(): Promise<{ success: boolean; data?: CentralLicense; error?: string }> {
    const res = await this.request<{ success: boolean; data?: CentralLicense; error?: string }>('/api/license/validate', {
      method: 'POST',
      body: JSON.stringify({
        installationId: this.installationId,
        platform: process.platform,
        appVersion: app ? app.getVersion() : '1.0.0'
      })
    })

    if (res.success && res.data) {
      this.setCurrentLicense(res.data)
    }
    return res
  }

  public async heartbeat(): Promise<{ success: boolean; data?: CentralLicense; error?: string }> {
    return await this.validateLicense()
  }

  // ── Live Support APIs ──
  public async getUserConversations(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return await this.request('/api/support/user-conversations', { method: 'GET' })
  }

  public async getConversation(conversationId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return await this.request(`/api/support/conversation?id=${encodeURIComponent(conversationId)}`, { method: 'GET' })
  }

  public async createTicket(subject: string, message: string, priority: string = 'normal'): Promise<{ success: boolean; data?: any; conversation_id?: string; error?: string }> {
    return await this.request('/api/support/create-conversation', {
      method: 'POST',
      body: JSON.stringify({ subject, message, priority })
    })
  }

  // ── Central Profiles Management APIs ──
  public async getProfiles(search?: string, groupId?: string, status?: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    let url = '/api/profiles?action=list'
    if (search) url += `&search=${encodeURIComponent(search)}`
    if (groupId) url += `&groupId=${encodeURIComponent(groupId)}`
    if (status) url += `&status=${encodeURIComponent(status)}`
    return await this.request(url, { method: 'GET' })
  }

  public async createProfile(profileData: any): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    return await this.request('/api/profiles?action=create', {
      method: 'POST',
      body: JSON.stringify(profileData)
    })
  }

  public async updateProfile(id: string, profileData: any): Promise<{ success: boolean; message?: string; error?: string }> {
    return await this.request(`/api/profiles?action=update&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(profileData)
    })
  }

  public async deleteProfile(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return await this.request(`/api/profiles?action=delete&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ id })
    })
  }

  public async setProfileStatus(id: string, status: 'running' | 'stopped'): Promise<{ success: boolean; status?: string; error?: string }> {
    return await this.request('/api/profiles?action=status', {
      method: 'POST',
      body: JSON.stringify({ id, status })
    })
  }
}

export const centralApi = new CentralApiClient()
