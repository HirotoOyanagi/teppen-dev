import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent } from '@/core/types'

type ParticleShape = 'spark' | 'debris' | 'smoke'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  drag: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: ParticleShape
  rotation: number
  rotationSpeed: number
}

interface Ring {
  x: number
  y: number
  radius: number
  maxRadius: number
  life: number
  maxLife: number
  color: string
  lineWidth: number
}

interface Flash {
  x: number
  y: number
  radius: number
  life: number
  maxLife: number
  color: string
}

export interface FloatingNumber {
  id: string
  x: number
  y: number
  damage: number
  timestamp: number
  kind: 'unit' | 'hero'
}

// 同時に飛び散るパーティクル数の上限。大量破壊が同時に起きても発散しないための保険。
const MAX_PARTICLES = 220
const SPARK_COLORS = ['#fff3c4', '#ffb347', '#ff6b3d']
const HERO_SPARK_COLORS = ['#ff8855', '#ff3355', '#ffd3a8']

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

interface UseBattleFxOptions {
  /** 画面全体を揺らす対象（盤面ルート要素）。transformを他の用途で使っていない要素を渡すこと */
  containerRef: React.RefObject<HTMLElement | null>
  getUnitRect: (unitId: string) => DOMRect | null
  getLaneRect: (isLocal: boolean, lane: number) => DOMRect | null
  getHeroRect: (playerId: string) => DOMRect | null
  localPlayerId: string
}

export interface BattleFx {
  processEvents: (events: GameEvent[]) => void
  FxCanvas: () => React.ReactElement
}

export function useBattleFx(opts: UseBattleFxOptions): BattleFx {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const ringsRef = useRef<Ring[]>([])
  const flashesRef = useRef<Flash[]>([])
  const shakeTraumaRef = useRef(0)
  const hitStopUntilRef = useRef(0)
  const lastFrameRef = useRef(Date.now())
  const rafRef = useRef<number | null>(null)
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([])

  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const step = () => {
      const now = Date.now()
      const dt = Math.min(64, now - lastFrameRef.current)
      lastFrameRef.current = now
      const dtSec = dt / 1000
      const inHitStop = now < hitStopUntilRef.current

      if (!inHitStop) {
        particlesRef.current = particlesRef.current.filter((p) => {
          p.life -= dt
          if (p.life <= 0) return false
          p.vy += p.gravity * dtSec
          const dragFactor = Math.pow(p.drag, dtSec * 60)
          p.vx *= dragFactor
          p.vy *= dragFactor
          p.x += p.vx * dtSec
          p.y += p.vy * dtSec
          p.rotation += p.rotationSpeed * dtSec
          return true
        })
        ringsRef.current = ringsRef.current.filter((r) => {
          r.life -= dt
          if (r.life <= 0) return false
          r.radius = r.maxRadius * (1 - r.life / r.maxLife)
          return true
        })
        flashesRef.current = flashesRef.current.filter((f) => {
          f.life -= dt
          return f.life > 0
        })
        shakeTraumaRef.current *= Math.pow(0.9, dt / 16.67)
        if (shakeTraumaRef.current < 0.01) shakeTraumaRef.current = 0
      }

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        for (const f of flashesRef.current) {
          const alpha = Math.max(0, f.life / f.maxLife) * 0.9
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius)
          grad.addColorStop(0, `rgba(${f.color},${alpha})`)
          grad.addColorStop(1, `rgba(${f.color},0)`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2)
          ctx.fill()
        }

        for (const p of particlesRef.current) {
          const alpha = Math.max(0, p.life / p.maxLife)
          ctx.globalAlpha = alpha
          ctx.fillStyle = p.color
          if (p.shape === 'debris') {
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rotation)
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
            ctx.restore()
          } else if (p.shape === 'smoke') {
            const growth = 1 + (1 - alpha) * 1.6
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * growth, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1

        for (const r of ringsRef.current) {
          const alpha = Math.max(0, r.life / r.maxLife)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = r.color
          ctx.lineWidth = r.lineWidth
          ctx.beginPath()
          ctx.arc(r.x, r.y, Math.max(0, r.radius), 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      const container = optsRef.current.containerRef.current
      if (container) {
        const trauma = shakeTraumaRef.current
        if (trauma > 0) {
          const amp = trauma * trauma * 14
          const dx = randRange(-amp, amp)
          const dy = randRange(-amp, amp)
          container.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`
        } else if (container.style.transform) {
          container.style.transform = ''
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      const container = optsRef.current.containerRef.current
      if (container) container.style.transform = ''
    }
  }, [])

  useEffect(() => {
    if (floatingNumbers.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setFloatingNumbers((prev) => prev.filter((n) => now - n.timestamp < 900))
    }, 100)
    return () => clearInterval(timer)
  }, [floatingNumbers.length])

  const capParticles = () => {
    const excess = particlesRef.current.length - MAX_PARTICLES
    if (excess > 0) particlesRef.current.splice(0, excess)
  }

  const spawnSparks = useCallback(
    (
      cx: number,
      cy: number,
      count: number,
      params: {
        speedMin: number
        speedMax: number
        colors: string[]
        sizeMin: number
        sizeMax: number
        gravity: number
        lifeMin: number
        lifeMax: number
        upwardBias?: number
      }
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = randRange(params.speedMin, params.speedMax)
        const life = randRange(params.lifeMin, params.lifeMax)
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (params.upwardBias || 0),
          gravity: params.gravity,
          drag: 0.94,
          life,
          maxLife: life,
          size: randRange(params.sizeMin, params.sizeMax),
          color: params.colors[Math.floor(Math.random() * params.colors.length)],
          shape: 'spark',
          rotation: 0,
          rotationSpeed: 0,
        })
      }
      capParticles()
    },
    []
  )

  const spawnDebris = useCallback((cx: number, cy: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = randRange(100, 260)
      const life = randRange(450, 700)
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        gravity: 900,
        drag: 0.96,
        life,
        maxLife: life,
        size: randRange(3, 6),
        color: Math.random() > 0.5 ? '#4b4b4b' : '#8a5a3a',
        shape: 'debris',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: randRange(-8, 8),
      })
    }
    capParticles()
  }, [])

  const spawnSmoke = useCallback((cx: number, cy: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const life = randRange(500, 700)
      particlesRef.current.push({
        x: cx + randRange(-10, 10),
        y: cy,
        vx: randRange(-8, 8),
        vy: randRange(-40, -15),
        gravity: -20,
        drag: 0.92,
        life,
        maxLife: life,
        size: randRange(8, 14),
        color: 'rgba(90,90,90,0.5)',
        shape: 'smoke',
        rotation: 0,
        rotationSpeed: 0,
      })
    }
    capParticles()
  }, [])

  const spawnRing = useCallback(
    (cx: number, cy: number, maxRadius: number, color: string, life: number, lineWidth = 3) => {
      ringsRef.current.push({ x: cx, y: cy, radius: 4, maxRadius, life, maxLife: life, color, lineWidth })
    },
    []
  )

  const spawnFlash = useCallback((cx: number, cy: number, radius: number, color: string, life: number) => {
    flashesRef.current.push({ x: cx, y: cy, radius, life, maxLife: life, color })
  }, [])

  const pushFloatingNumber = useCallback((rect: DOMRect, damage: number, kind: 'unit' | 'hero') => {
    setFloatingNumbers((prev) => [
      ...prev,
      {
        id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height * 0.25,
        damage,
        timestamp: Date.now(),
        kind,
      },
    ])
  }, [])

  const triggerHitStop = useCallback((ms: number) => {
    hitStopUntilRef.current = Math.max(hitStopUntilRef.current, Date.now() + ms)
  }, [])

  const bumpShake = useCallback((amount: number) => {
    shakeTraumaRef.current = Math.min(1, shakeTraumaRef.current + amount)
  }, [])

  const spawnHitBurst = useCallback(
    (rect: DOMRect, damage: number) => {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      spawnSparks(cx, cy, Math.min(12, 6 + Math.floor(damage / 2)), {
        speedMin: 80,
        speedMax: 180,
        colors: SPARK_COLORS,
        sizeMin: 2,
        sizeMax: 4,
        gravity: 400,
        lifeMin: 250,
        lifeMax: 400,
        upwardBias: 40,
      })
      spawnRing(cx, cy, 26, 'rgba(255,255,255,0.75)', 200, 2)
      pushFloatingNumber(rect, damage, 'unit')
      if (damage >= 6) bumpShake(0.12)
    },
    [spawnSparks, spawnRing, pushFloatingNumber, bumpShake]
  )

  const spawnDestroyBurst = useCallback(
    (rect: DOMRect) => {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      triggerHitStop(90)
      spawnFlash(cx, cy, 74, '255,190,110', 180)
      spawnSparks(cx, cy, 25, {
        speedMin: 150,
        speedMax: 300,
        colors: SPARK_COLORS,
        sizeMin: 2,
        sizeMax: 4,
        gravity: 500,
        lifeMin: 350,
        lifeMax: 550,
      })
      spawnDebris(cx, cy, 15)
      spawnSmoke(cx, cy, 8)
      spawnRing(cx, cy, 70, 'rgba(255,180,90,0.7)', 320, 3)
      bumpShake(0.22)
    },
    [triggerHitStop, spawnFlash, spawnSparks, spawnDebris, spawnSmoke, spawnRing, bumpShake]
  )

  const spawnHeroBurst = useCallback(
    (rect: DOMRect, damage: number) => {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      spawnSparks(cx, cy, Math.min(30, 14 + Math.floor(damage)), {
        speedMin: 100,
        speedMax: 220,
        colors: HERO_SPARK_COLORS,
        sizeMin: 3,
        sizeMax: 5,
        gravity: 420,
        lifeMin: 300,
        lifeMax: 500,
        upwardBias: 30,
      })
      spawnRing(cx, cy, 40, 'rgba(255,90,90,0.7)', 260, 3)
      pushFloatingNumber(rect, damage, 'hero')
      bumpShake(damage >= 8 ? 0.35 : 0.22)
      if (damage >= 8) triggerHitStop(90)
    },
    [spawnSparks, spawnRing, pushFloatingNumber, bumpShake, triggerHitStop]
  )

  const processEvents = useCallback(
    (events: GameEvent[]) => {
      const { getUnitRect, getLaneRect, getHeroRect, localPlayerId } = optsRef.current

      const resolveUnitRect = (unitId: string, playerId: string | undefined, lane: number | undefined) => {
        const direct = getUnitRect(unitId)
        if (direct) return direct
        if (lane === undefined || lane === null) return null
        const isLocal = playerId !== undefined && playerId === localPlayerId
        return getLaneRect(isLocal, lane)
      }

      for (const ev of events) {
        if (ev.type === 'unit_damage' && ev.damage > 0) {
          const rect = resolveUnitRect(ev.unitId, ev.playerId, ev.lane)
          if (rect) spawnHitBurst(rect, ev.damage)
        } else if (ev.type === 'unit_destroyed') {
          const rect = resolveUnitRect(ev.unitId, ev.playerId, ev.lane)
          if (rect) spawnDestroyBurst(rect)
        } else if (ev.type === 'player_damage' && ev.damage > 0) {
          const rect = getHeroRect(ev.playerId)
          if (rect) spawnHeroBurst(rect, ev.damage)
        }
      }
    },
    [spawnHitBurst, spawnDestroyBurst, spawnHeroBurst]
  )

  const FxCanvas = useCallback(() => {
    return (
      <>
        <canvas
          ref={canvasRef}
          className="fixed inset-0 z-[350] pointer-events-none"
          style={{ width: '100vw', height: '100vh' }}
        />
        <FloatingNumbersLayer numbers={floatingNumbers} />
      </>
    )
  }, [floatingNumbers])

  return { processEvents, FxCanvas }
}

function FloatingNumbersLayer({ numbers }: { numbers: FloatingNumber[] }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (numbers.length === 0) return
    let raf: number
    const loop = () => {
      setTick((t) => (t + 1) % 1000000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [numbers.length])

  return (
    <>
      {numbers.map((n) => {
        const elapsed = Date.now() - n.timestamp
        const progress = Math.min(1, elapsed / 900)
        const scaleIn = progress < 0.18 ? 0.4 + (progress / 0.18) * 1.5 : Math.min(1.3, 1.9 - progress * 0.9)
        const bounceY = progress < 0.15 ? -22 * Math.sin((progress / 0.15) * Math.PI) : 0
        const isHero = n.kind === 'hero'
        const isBig = n.damage >= 6
        const fontSize = isHero ? 46 : isBig ? 42 : 32
        const color = isBig || isHero ? '#ff3b3b' : '#ff8a5c'
        return (
          <div
            key={n.id}
            className="fixed z-[360] pointer-events-none font-orbitron font-black"
            style={{
              left: n.x,
              top: n.y - progress * 55 + bounceY,
              transform: `translateX(-50%) scale(${scaleIn})`,
              opacity: 1 - Math.max(0, progress - 0.55) * 2.2,
              fontSize,
              color,
              textShadow: `0 0 12px ${color}cc, 0 0 26px ${color}88, 0 2px 4px rgba(0,0,0,1)`,
              filter: 'drop-shadow(0 0 8px rgba(255,120,80,0.85))',
            }}
          >
            -{n.damage}
          </div>
        )
      })}
    </>
  )
}
