// ──────────────────────────────────────────────────────────────────────────
// AntiProfiles — 3D Animated Anti-Detect Shield & Biometric Fingerprint Hero
// Zero-dependency 3D perspective Canvas engine with IntersectionObserver,
// Page Visibility pausing, prefers-reduced-motion support, & WCAG 2.2.2 control
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react'

interface Hero3DFingerprintBgProps {
  className?: string
}

interface Vec3 {
  x: number
  y: number
  z: number
}

interface ProjectedPoint {
  x: number
  y: number
  z: number
  scale: number
}

export const Hero3DFingerprintBg: React.FC<Hero3DFingerprintBgProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  })
  const pausedRef = useRef<boolean>(isPaused)

  useEffect(() => {
    pausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let rafId: number | null = null
    let inViewport = true
    let pointerX = 0
    let pointerY = 0
    let smoothPointerX = 0
    let smoothPointerY = 0
    let simTime = 0
    let lastTimestamp = performance.now()

    // Procedural 3D biometric fingerprint ridges (concentric distorted loops on a 3D dome)
    const ridgeCount = 17
    const ridges: Array<{ points: Vec3[]; gaps: number[]; phase: number }> = []
    for (let r = 0; r < ridgeCount; r++) {
      const t = (r + 1) / ridgeCount
      const rx = 24 + t * 142
      const ry = 32 + t * 184
      const segments = Math.max(44, Math.floor(54 + t * 44))
      const points: Vec3[] = []
      const gaps: number[] = []

      // Natural fingerprint ridge breaks (minutiae)
      const gapCount = r % 3 === 0 ? 2 : 1
      for (let g = 0; g < gapCount; g++) {
        gaps.push(((r * 19 + g * 37) % segments))
      }

      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        // Organic arch/whorl fingerprint distortion
        const whorl = Math.sin(angle * 2 + r * 0.34) * (4 + t * 9)
        const archLift = Math.cos(angle) < 0 ? Math.abs(Math.cos(angle)) * (10 + t * 16) : 0
        const px = Math.cos(angle) * (rx + whorl * 0.55)
        const py = Math.sin(angle) * (ry + whorl * 0.45) - archLift * 0.35
        const normDist = Math.min(1, Math.hypot(px / 185, py / 230))
        // Convex 3D holographic dome depth
        const pz = Math.sqrt(Math.max(0, 1 - normDist * normDist)) * 78 - 22
        points.push({ x: px, y: py, z: pz })
      }
      ridges.push({ points, gaps, phase: r * 0.41 })
    }

    // Orbiting isolated browser profile nodes on tilted 3D rings
    const orbitNodes = [
      { ring: 0, angle: 0.4, speed: 0.38, label: 'CANVAS: MASKED', color: '#2DD4BF' },
      { ring: 0, angle: 2.5, speed: 0.38, label: 'WEBGL: SPOOFED', color: '#38BDF8' },
      { ring: 0, angle: 4.6, speed: 0.38, label: 'WEBRTC: LOCKED', color: '#818CF8' },
      { ring: 1, angle: 1.2, speed: -0.32, label: 'JA4/TLS: CLEAN', color: '#2DD4BF' },
      { ring: 1, angle: 4.3, speed: -0.32, label: 'IP: ISOLATED', color: '#C084FC' }
    ]

    // Floating 3D depth particles
    const particles: Array<{ x: number; y: number; z: number; vz: number; size: number; hue: string }> = []
    for (let i = 0; i < 48; i++) {
      const spreadX = (Math.sin(i * 12.9898) * 43758.5453) % 1
      const spreadY = (Math.sin(i * 78.233) * 43758.5453) % 1
      const spreadZ = (Math.sin(i * 39.425) * 43758.5453) % 1
      particles.push({
        x: (spreadX - 0.5) * 900,
        y: (spreadY - 0.5) * 560,
        z: (spreadZ - 0.5) * 420,
        vz: 12 + (i % 5) * 5,
        size: 1.1 + (i % 3) * 0.75,
        hue: i % 3 === 0 ? '#2DD4BF' : i % 3 === 1 ? '#6366F1' : '#38BDF8'
      })
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(320, rect.width)
      height = Math.max(420, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderFrame(simTime)
    }

    const project = (
      x: number,
      y: number,
      z: number,
      rotX: number,
      rotY: number,
      cx: number,
      cy: number,
      fov: number
    ): ProjectedPoint => {
      // Rotate Y
      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const x1 = x * cosY - z * sinY
      const z1 = x * sinY + z * cosY

      // Rotate X
      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)
      const y2 = y * cosX - z1 * sinX
      const z2 = y * sinX + z1 * cosX

      const denom = Math.max(120, fov + z2)
      const scale = fov / denom
      return {
        x: cx + x1 * scale,
        y: cy + y2 * scale,
        z: z2,
        scale
      }
    }

    const renderFrame = (timeSec: number) => {
      ctx.clearRect(0, 0, width, height)

      const isCompact = width < 900
      const cx = isCompact ? width * 0.5 : width * 0.58
      const cy = isCompact ? height * 0.44 : height * 0.5
      const fov = isCompact ? 560 : 680
      const rigScale = isCompact ? 0.72 : Math.min(1.12, width / 1280)

      smoothPointerX += (pointerX - smoothPointerX) * 0.06
      smoothPointerY += (pointerY - smoothPointerY) * 0.06

      const rotY = Math.sin(timeSec * 0.35) * 0.36 + smoothPointerX * 0.34
      const rotX = -0.18 + Math.cos(timeSec * 0.28) * 0.14 + smoothPointerY * 0.22

      // 1. Subtle 3D Cyber Perspective Grid Floor
      ctx.save()
      ctx.lineWidth = 1
      const gridCols = 12
      const gridRows = 7
      for (let r = 0; r < gridRows; r++) {
        const gz = -220 + r * 75
        const alpha = Math.max(0.02, 0.08 - r * 0.008)
        ctx.strokeStyle = `rgba(99, 102, 241, ${alpha.toFixed(3)})`
        ctx.beginPath()
        for (let c = -gridCols; c <= gridCols; c++) {
          const gx = c * 85
          const p = project(gx * rigScale, 250 * rigScale, gz * rigScale, 0.22 + smoothPointerY * 0.06, smoothPointerX * 0.12, cx, cy, fov)
          if (c === -gridCols) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }
      ctx.restore()

      // 2. Ambient Volumetric Core Halo
      const coreGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 290 * rigScale)
      coreGlow.addColorStop(0, 'rgba(45, 212, 191, 0.14)')
      coreGlow.addColorStop(0.45, 'rgba(99, 102, 241, 0.09)')
      coreGlow.addColorStop(1, 'rgba(6, 8, 15, 0)')
      ctx.fillStyle = coreGlow
      ctx.fillRect(0, 0, width, height)

      // 3. 3D Floating Depth Particles
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i]
        const zMod = ((pt.z + timeSec * pt.vz + 240) % 480) - 240
        const p = project(pt.x * rigScale, pt.y * rigScale, zMod * rigScale, rotX * 0.3, rotY * 0.3, cx, cy, fov)
        const alpha = Math.max(0.08, Math.min(0.65, (p.scale - 0.55) * 0.85))
        ctx.fillStyle = pt.hue
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.7, pt.size * p.scale), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // 4. 3D Gyroscopic Anti-Detect Shield Rings
      const ringSpecs = [
        { radius: 228 * rigScale, tiltX: 0.82, tiltZ: 0.35, spin: timeSec * 0.22, color: 'rgba(99, 102, 241, 0.28)', dashed: true },
        { radius: 196 * rigScale, tiltX: -0.68, tiltZ: -0.48, spin: -timeSec * 0.28, color: 'rgba(45, 212, 191, 0.34)', dashed: false },
        { radius: 262 * rigScale, tiltX: 1.15, tiltZ: -0.22, spin: timeSec * 0.14, color: 'rgba(56, 189, 248, 0.16)', dashed: true }
      ]

      ringSpecs.forEach((ring) => {
        ctx.save()
        ctx.strokeStyle = ring.color
        ctx.lineWidth = ring.dashed ? 1 : 1.35
        if (ring.dashed) ctx.setLineDash([5, 9])
        ctx.beginPath()
        const steps = 84
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2 + ring.spin
          let x = Math.cos(a) * ring.radius
          let y = Math.sin(a) * ring.radius
          let z = 0
          // Apply ring tilt
          const y1 = y * Math.cos(ring.tiltX) - z * Math.sin(ring.tiltX)
          const z1 = y * Math.sin(ring.tiltX) + z * Math.cos(ring.tiltX)
          const x2 = x * Math.cos(ring.tiltZ) - y1 * Math.sin(ring.tiltZ)
          const y2 = x * Math.sin(ring.tiltZ) + y1 * Math.cos(ring.tiltZ)
          const p = project(x2, y2, z1, rotX, rotY, cx, cy, fov)
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
        ctx.restore()
      })

      // 5. 3D Biometric Fingerprint Holographic Ridge Mesh + Active Laser Scan Plane
      const scanY = Math.sin(timeSec * 1.15) * 195 * rigScale
      ctx.save()
      ctx.lineCap = 'round'

      for (let r = 0; r < ridges.length; r++) {
        const ridge = ridges[r]
        const pts = ridge.points
        const len = pts.length

        for (let i = 0; i < len - 1; i++) {
          // Create realistic fingerprint ridge minutiae gaps
          let isGap = false
          for (let g = 0; g < ridge.gaps.length; g++) {
            const distGap = Math.abs(i - ridge.gaps[g])
            if (distGap <= 2) {
              isGap = true
              break
            }
          }
          if (isGap) continue

          const a3 = pts[i]
          const b3 = pts[i + 1]
          const p1 = project(a3.x * rigScale, a3.y * rigScale, a3.z * rigScale, rotX, rotY, cx, cy, fov)
          const p2 = project(b3.x * rigScale, b3.y * rigScale, b3.z * rigScale, rotX, rotY, cx, cy, fov)

          // Distance to active biometric anti-detect scan plane
          const segY = ((a3.y + b3.y) * 0.5) * rigScale
          const scanProximity = Math.max(0, 1 - Math.abs(segY - scanY) / (46 * rigScale))
          const depthAlpha = Math.max(0.14, Math.min(0.85, (p1.scale - 0.65) * 1.35))

          if (scanProximity > 0.15) {
            const boost = scanProximity * scanProximity
            ctx.strokeStyle = `rgba(45, 212, 191, ${(0.32 + boost * 0.65).toFixed(3)})`
            ctx.lineWidth = (1.1 + boost * 1.9) * p1.scale
          } else {
            const isOuter = r > ridgeCount * 0.62
            ctx.strokeStyle = isOuter
              ? `rgba(129, 140, 248, ${(depthAlpha * 0.36).toFixed(3)})`
              : `rgba(45, 212, 191, ${(depthAlpha * 0.42).toFixed(3)})`
            ctx.lineWidth = 1.15 * p1.scale
          }

          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()

          // Highlight minutiae node sparkle right at the scan beam
          if (scanProximity > 0.72 && (i + r) % 13 === 0) {
            ctx.fillStyle = `rgba(153, 246, 228, ${(scanProximity * 0.9).toFixed(3)})`
            ctx.beginPath()
            ctx.arc(p1.x, p1.y, 2.2 * p1.scale, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // 6. Volumetric Biometric Anti-Detect Scanner Sweep Line
      const scanLeft = project(-175 * rigScale, scanY, 26 * rigScale, rotX, rotY, cx, cy, fov)
      const scanRight = project(175 * rigScale, scanY, 26 * rigScale, rotX, rotY, cx, cy, fov)
      const scanGrad = ctx.createLinearGradient(scanLeft.x, scanLeft.y, scanRight.x, scanRight.y)
      scanGrad.addColorStop(0, 'rgba(45, 212, 191, 0)')
      scanGrad.addColorStop(0.25, 'rgba(45, 212, 191, 0.55)')
      scanGrad.addColorStop(0.5, 'rgba(153, 246, 228, 0.95)')
      scanGrad.addColorStop(0.75, 'rgba(56, 189, 248, 0.55)')
      scanGrad.addColorStop(1, 'rgba(99, 102, 241, 0)')
      ctx.strokeStyle = scanGrad
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(scanLeft.x, scanLeft.y)
      ctx.lineTo(scanRight.x, scanRight.y)
      ctx.stroke()
      ctx.restore()

      // 7. Orbiting Isolated Profile Shield Nodes + Subtle Telemetry Labels
      const projectedNodes: Array<{ p: ProjectedPoint; label: string; color: string }> = []
      orbitNodes.forEach((node) => {
        const ring = ringSpecs[node.ring]
        const a = node.angle + timeSec * node.speed
        const x = Math.cos(a) * ring.radius
        const y = Math.sin(a) * ring.radius
        const y1 = y * Math.cos(ring.tiltX)
        const z1 = y * Math.sin(ring.tiltX)
        const x2 = x * Math.cos(ring.tiltZ) - y1 * Math.sin(ring.tiltZ)
        const y2 = x * Math.sin(ring.tiltZ) + y1 * Math.cos(ring.tiltZ)
        const p = project(x2, y2, z1, rotX, rotY, cx, cy, fov)
        projectedNodes.push({ p, label: node.label, color: node.color })
      })

      // Subtle encrypted relay chords between orbiting nodes
      ctx.save()
      for (let i = 0; i < projectedNodes.length; i++) {
        const n1 = projectedNodes[i]
        const n2 = projectedNodes[(i + 1) % projectedNodes.length]
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(n1.p.x, n1.p.y)
        ctx.lineTo(n2.p.x, n2.p.y)
        ctx.stroke()
      }
      ctx.restore()

      // Render glowing profile shield nodes
      projectedNodes.forEach(({ p, label, color }) => {
        const rNode = Math.max(2.4, 4.2 * p.scale)
        const nodeGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rNode * 4.2)
        nodeGlow.addColorStop(0, color)
        nodeGlow.addColorStop(1, 'rgba(6, 8, 15, 0)')
        ctx.fillStyle = nodeGlow
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.arc(p.x, p.y, rNode * 4.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.globalAlpha = 0.95
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, rNode, 0, Math.PI * 2)
        ctx.fill()

        if (!isCompact && p.scale > 0.85) {
          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
          ctx.fillStyle = 'rgba(226, 232, 240, 0.56)'
          ctx.fillText(label, p.x + rNode + 7, p.y + 3)
        }
        ctx.globalAlpha = 1
      })
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000)
      lastTimestamp = now

      if (!pausedRef.current && inViewport && !document.hidden) {
        simTime += dt
        renderFrame(simTime)
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = null
      }
    }

    const ensureLoop = () => {
      if (rafId === null && !pausedRef.current && inViewport && !document.hidden) {
        lastTimestamp = performance.now()
        rafId = requestAnimationFrame(tick)
      }
    }

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }

    const onVisibilityChange = () => {
      if (document.hidden) stopLoop()
      else ensureLoop()
    }

    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          inViewport = Boolean(entries[0]?.isIntersecting)
          if (inViewport) ensureLoop()
          else stopLoop()
        },
        { rootMargin: '140px' }
      )
      io.observe(container)
    }

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resize)
      ro.observe(container)
    } else {
      window.addEventListener('resize', resize)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)

    resize()
    if (!pausedRef.current) {
      ensureLoop()
    }

    return () => {
      stopLoop()
      io?.disconnect()
      ro?.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isPaused])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 24% 48%, rgba(6,8,15,0.72) 0%, rgba(6,8,15,0.34) 48%, rgba(6,8,15,0.14) 76%), linear-gradient(180deg, rgba(6,8,15,0.5) 0%, transparent 18%, transparent 80%, #06080F 100%)'
        }}
      />
      <button
        type="button"
        onClick={() => setIsPaused((prev) => !prev)}
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '16px',
          zIndex: 5,
          pointerEvents: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 13px',
          borderRadius: '999px',
          backgroundColor: 'rgba(10, 14, 26, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.28)',
          color: '#CBD5E1',
          fontSize: '11.5px',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(10px)'
        }}
      >
        {isPaused ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        )}
        <span>{isPaused ? 'Play 3D' : 'Pause 3D'}</span>
      </button>
    </div>
  )
}

