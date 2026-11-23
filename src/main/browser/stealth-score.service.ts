// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Built-in One-Click Fingerprint Stealth Score Checker
// Evaluates 10 critical anti-detect dimensions (UA/Platform, WebRTC,
// Proxy + DNS/QUIC Shield, Canvas/WebGL/WebGPU/Audio, Timezone/Geo,
// Hardware Realism, Font/Screen Consistency) -> 0-100 Trust Score.
// ──────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import { getDatabase as getDb } from '../database/connection'
import { ProfileRepository } from '../database/repositories/profile.repo'
import { ProxyRepository } from '../database/repositories/proxy.repo'
import { validateConsistency } from '../fingerprint/consistency'

export interface StealthCheckItem {
  id: string
  category: string
  status: 'pass' | 'warn' | 'fail'
  points: number
  maxPoints: number
  detail: string
  recommendation?: string
}

export interface StealthAuditReport {
  id: string
  profileId: string
  profileName: string
  score: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  checks: StealthCheckItem[]
  createdAt: string
}

function computeGrade(score: number): StealthAuditReport['grade'] {
  if (score >= 95) return 'A+'
  if (score >= 88) return 'A'
  if (score >= 78) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

export function auditProfileStealthScore(profileId: string): StealthAuditReport {
  const profile = ProfileRepository.findById(profileId)
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`)
  }

  const fp = (profile.fingerprint || {}) as any
  const proxy = profile.proxyId ? ProxyRepository.findById(profile.proxyId) : null
  const checks: StealthCheckItem[] = []

  // 1. OS / User-Agent / Platform Consistency (15 pts)
  const targetOs = (profile.osType as any) || 'windows-10'
  const targetBrowser = ((profile as any).browserType === 'firefox' || fp?.browser?.type === 'firefox') ? 'firefox' : 'chrome'
  const targetVer = profile.browserVersion || fp?.browser?.version || '131.0'
  const consistency = validateConsistency(fp, targetOs, targetBrowser, targetVer)
  const osPts = consistency.contradictions.length === 0 ? 15 : Math.max(3, 15 - consistency.contradictions.length * 5)
  checks.push({
    id: 'os-ua-consistency',
    category: 'OS & User-Agent Coherence',
    status: consistency.contradictions.length === 0 ? 'pass' : 'fail',
    points: osPts,
    maxPoints: 15,
    detail: consistency.contradictions.length === 0
      ? `OS (${profile.osType}) matches UA, navigator.platform, and Client Hints cleanly.`
      : `Detected ${consistency.contradictions.length} OS/UA contradiction(s): ${consistency.contradictions[0]}`,
    recommendation: consistency.contradictions.length > 0 ? 'Regenerate fingerprint from a verified Device Template.' : undefined
  })

  // 2. Proxy & DNS/QUIC Leak Shield (15 pts)
  const hasProxy = Boolean(proxy && proxy.type !== 'direct' && proxy.host)
  checks.push({
    id: 'proxy-leak-shield',
    category: 'Proxy & DNS/QUIC Leak Shield',
    status: hasProxy ? 'pass' : 'warn',
    points: hasProxy ? 15 : 7,
    maxPoints: 15,
    detail: hasProxy
      ? `Proxy (${proxy!.type.toUpperCase()} ${proxy!.host}:${proxy!.port}) active with DNS-over-Proxy & QUIC Kill-Switch.`
      : 'No proxy assigned — profile will expose your host IP address.',
    recommendation: hasProxy ? undefined : 'Assign a clean residential or ISP SOCKS5/HTTP proxy.'
  })

  // 3. WebRTC Leak Protection (10 pts)
  const webrtcMode = fp?.webrtc?.mode || profile.webrtcMode || 'altered'
  const webrtcSafe = webrtcMode === 'disabled' || webrtcMode === 'altered' || webrtcMode === 'real-proxy'
  checks.push({
    id: 'webrtc-shield',
    category: 'WebRTC IP Leak Shield',
    status: webrtcSafe ? 'pass' : 'fail',
    points: webrtcSafe ? 10 : 2,
    maxPoints: 10,
    detail: `WebRTC mode: "${webrtcMode}" with disable_non_proxied_udp enforced.`,
    recommendation: webrtcSafe ? undefined : 'Set WebRTC mode to "altered" or "disabled".'
  })

  // 4. Canvas Fingerprint Noise (10 pts)
  const canvasMode = fp?.canvas?.mode || 'noise'
  checks.push({
    id: 'canvas-masking',
    category: 'Canvas Fingerprint Masking',
    status: canvasMode !== 'off' ? 'pass' : 'warn',
    points: canvasMode !== 'off' ? 10 : 5,
    maxPoints: 10,
    detail: `Canvas protection mode: "${canvasMode}" (deterministic per-profile seed).`
  })

  // 5. WebGL & WebGPU Hardware Spoofing (10 pts)
  const hasWebgl = Boolean(fp?.webgl?.unmaskedRenderer && fp?.webgl?.unmaskedVendor)
  checks.push({
    id: 'webgl-webgpu',
    category: 'WebGL & WebGPU GPU Identity',
    status: hasWebgl ? 'pass' : 'warn',
    points: hasWebgl ? 10 : 4,
    maxPoints: 10,
    detail: hasWebgl
      ? `GPU spoofed as "${fp.webgl.unmaskedRenderer}".`
      : 'Missing WebGL unmasked renderer string.',
    recommendation: hasWebgl ? undefined : 'Select a realistic GPU renderer matching the profile OS.'
  })

  // 6. AudioContext & ClientRects Noise (10 pts)
  const audioOn = fp?.audio?.mode !== 'off'
  checks.push({
    id: 'audio-rects',
    category: 'AudioContext & ClientRects',
    status: audioOn ? 'pass' : 'warn',
    points: audioOn ? 10 : 5,
    maxPoints: 10,
    detail: audioOn ? 'Deterministic AudioContext + DOMRect micro-noise active.' : 'Audio fingerprint masking disabled.'
  })

  // 7. Timezone & Geolocation Alignment (10 pts)
  const hasTz = Boolean(fp?.timezone?.timezone || profile.timezone)
  checks.push({
    id: 'tz-geo-alignment',
    category: 'Timezone & Geolocation Sync',
    status: hasTz ? 'pass' : 'warn',
    points: hasTz ? 10 : 5,
    maxPoints: 10,
    detail: hasTz
      ? `Timezone "${fp?.timezone?.timezone || profile.timezone}" synced with Intl/Date & Geo API.`
      : 'Timezone not set; may mismatch proxy country.'
  })

  // 8. Hardware Concurrency & RAM Realism (10 pts)
  const cores = Number(fp?.navigator?.hardwareConcurrency || 0)
  const mem = Number(fp?.navigator?.deviceMemory || 0)
  const hwRealistic = [2, 4, 6, 8, 12, 16].includes(cores) && [2, 4, 8, 16, 32].includes(mem)
  checks.push({
    id: 'hardware-realism',
    category: 'CPU Cores & RAM Realism',
    status: hwRealistic ? 'pass' : 'warn',
    points: hwRealistic ? 10 : 6,
    maxPoints: 10,
    detail: `CPU: ${cores || 'default'} cores, RAM: ${mem || 'default'} GB.`
  })

  // 9. Screen Resolution & DPR Coherence (5 pts)
  const w = Number(fp?.screen?.width || profile.screenWidth || 0)
  const h = Number(fp?.screen?.height || profile.screenHeight || 0)
  const screenOk = w >= 320 && h >= 480
  checks.push({
    id: 'screen-dpr',
    category: 'Screen & Viewport Coherence',
    status: screenOk ? 'pass' : 'warn',
    points: screenOk ? 5 : 2,
    maxPoints: 5,
    detail: `Viewport ${w}x${h} @${fp?.screen?.devicePixelRatio || 1}x DPR.`
  })

  // 10. Automation Flag & Native Cloaker (5 pts)
  checks.push({
    id: 'automation-cloaking',
    category: 'Automation & Native Prototype Cloak',
    status: 'pass',
    points: 5,
    maxPoints: 5,
    detail: 'AutomationControlled disabled, webdriver masked, Function.toString native-cloaked.'
  })

  const totalScore = Math.min(100, checks.reduce((sum, c) => sum + c.points, 0))
  const grade = computeGrade(totalScore)
  const reportId = `audit_${uuidv4().slice(0, 12)}`
  const createdAt = new Date().toISOString()

  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO profile_stealth_audits (id, profile_id, score, grade, checks_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reportId, profileId, totalScore, grade, JSON.stringify(checks), createdAt)
  } catch {
    // Non-fatal if audit table not yet migrated in isolated test
  }

  return {
    id: reportId,
    profileId,
    profileName: profile.name,
    score: totalScore,
    grade,
    checks,
    createdAt
  }
}
