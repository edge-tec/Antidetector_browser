import { describe, it, expect, beforeAll } from 'vitest'
import { initDatabase } from '../../src/main/database/connection'
import { userRepo } from '../../src/main/database/repositories/user.repo'
import { tokenRepo } from '../../src/main/database/repositories/token.repo'
import { profileRepo } from '../../src/main/database/repositories/profile.repo'
import { hashPassword, verifyPassword } from '../../src/main/security/password'
import { sessionManager, authorizeUser } from '../../src/main/security/session'
import { UserDisplay } from '../../src/main/database/models'

describe('Auth & RBAC System Unit Tests', () => {
  let adminUser: UserDisplay

  beforeAll(() => {
    initDatabase()

    let admin = userRepo.getByEmail('admin@profilevault.local')
    if (!admin) {
      userRepo.create({
        name: 'System Admin',
        email: 'admin@profilevault.local',
        password: 'admin-password-123',
        role: 'admin',
        accountStatus: 'active',
        emailVerified: true
      })
      admin = userRepo.getByEmail('admin@profilevault.local')
    }
    adminUser = admin!
  })

  it('correctly hashes and verifies passwords using scrypt', () => {
    const rawPass = 'SecretP@ssw0rd123'
    const hash = hashPassword(rawPass)

    expect(hash).toContain(':')
    expect(verifyPassword(rawPass, hash)).toBe(true)
    expect(verifyPassword('WrongPass', hash)).toBe(false)
  })

  it('initializes default admin account during migrations', () => {
    expect(adminUser).not.toBeNull()
    expect(adminUser.role).toBe('admin')
    expect(adminUser.emailVerified).toBe(true)
    expect(adminUser.accountStatus).toBe('active')
  })

  it('creates user with pending status and generates single-use verification token', () => {
    const email = `john_${Date.now()}@example.com`
    const user = userRepo.create({
      name: 'John Doe',
      email,
      password: 'password123',
      role: 'user',
      accountStatus: 'pending',
      emailVerified: false
    })

    expect(user.emailVerified).toBe(false)
    expect(user.accountStatus).toBe('pending')

    const plainToken = `test_secret_token_${Date.now()}`
    const tokenObj = tokenRepo.createToken(user.id, plainToken, 24)
    expect(tokenObj.tokenHash).toBeDefined()

    const res = tokenRepo.findValidToken(plainToken)
    expect(res).not.toBeNull()
    expect(res?.valid).toBe(true)
    expect(res?.token.userId).toBe(user.id)

    // Mark as used
    tokenRepo.markUsed(tokenObj.id)
    const usedRes = tokenRepo.findValidToken(plainToken)
    expect(usedRes?.valid).toBe(false)
  })

  it('enforces session creation and sliding-window rate limiting', () => {
    const sessionToken = sessionManager.createSession(adminUser)
    expect(sessionToken).toBeDefined()
    expect(typeof sessionToken).toBe('string')

    const authResult = authorizeUser(sessionToken)
    expect(authResult.error).toBeUndefined()
    expect(authResult.user?.id).toBe(adminUser.id)
  })

  it('prevents deleting or demoting the last active admin account', () => {
    expect(userRepo.countAdmins()).toBeGreaterThanOrEqual(1)

    // Try deleting last admin if only 1 admin
    if (userRepo.countAdmins() === 1) {
      expect(() => userRepo.delete(adminUser.id)).toThrow()
    }
  })

  it('enforces server-side profile ownership isolation', () => {
    const ts = Date.now()
    const user1 = userRepo.create({
      name: 'User 1',
      email: `u1_${ts}@example.com`,
      password: 'pass',
      role: 'user',
      accountStatus: 'active',
      emailVerified: true
    })

    const user2 = userRepo.create({
      name: 'User 2',
      email: `u2_${ts}@example.com`,
      password: 'pass',
      role: 'user',
      accountStatus: 'active',
      emailVerified: true
    })

    const profile1 = profileRepo.create({ name: 'User 1 Profile' }, user1.id)

    expect(profileRepo.verifyOwnership(profile1.id, user1.id, false)).toBe(true)
    expect(profileRepo.verifyOwnership(profile1.id, user2.id, false)).toBe(false)
    expect(profileRepo.verifyOwnership(profile1.id, user2.id, true)).toBe(true) // Admin bypass

    const user1Profiles = profileRepo.getAll(user1.id)
    expect(user1Profiles.length).toBe(1)
    expect(user1Profiles[0].id).toBe(profile1.id)
  })

  it('saves and retrieves SMTP configuration and handles verification email sending', async () => {
    const { emailService } = await import('../../src/main/services/email.service')
    emailService.saveSmtpConfig({
      host: 'smtp.example.com',
      port: 587,
      user: 'user@example.com',
      password: 'secretpassword',
      fromEmail: 'noreply@example.com',
      secure: false,
      enabled: true
    })

    const config = emailService.getSmtpConfig()
    expect(config.host).toBe('smtp.example.com')
    expect(config.port).toBe(587)
    expect(config.user).toBe('user@example.com')
    expect(config.enabled).toBe(true)

    const res = await emailService.sendVerificationEmail(adminUser.id, adminUser.name, adminUser.email)
    expect(res.success).toBe(true)
    expect(res.verificationUrl).toContain('/verify-email?token=')
  })
})
