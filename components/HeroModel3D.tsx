import React, { Suspense, useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import type { Group } from 'three'
import { LoopRepeat } from 'three'
import { SkeletonUtils } from 'three-stdlib'

export type HeroModelVariant = 'home' | 'battle'

interface HeroModel3DProps {
  modelUrl: string
  variant?: HeroModelVariant
  side?: 'left' | 'right'
  className?: string
}

const TILT_LEFT = (5 * Math.PI) / 180
const FACE_ROTATION: Record<string, number> = {
  left: 0 + TILT_LEFT,
  right: Math.PI - TILT_LEFT,
}

// #region agent log
function __agentLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '306588' },
    body: JSON.stringify({
      sessionId: '306588',
      runId: 'pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}
// #endregion

function AnimatedModel({
  url,
  variant,
  side,
}: {
  url: string
  variant: HeroModelVariant
  side?: 'left' | 'right'
}) {
  const groupRef = useRef<Group>(null)
  const { scene, animations } = useGLTF(url)
  const { actions, mixer } = useAnimations(animations, groupRef)

  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(scene)
  }, [scene])

  // #region agent log
  useEffect(() => {
    __agentLog('H5', 'components/HeroModel3D.tsx:sceneClone', 'gltf scene clone uuids', {
      url: typeof url === 'string' ? url.slice(0, 90) : null,
      variant,
      side,
      originalSceneUuid: (scene as unknown as { uuid?: string }).uuid ?? null,
      clonedSceneUuid: (clonedScene as unknown as { uuid?: string }).uuid ?? null,
    })
  }, [clonedScene, scene, side, url, variant])
  // #endregion

  useEffect(() => {
    if (animations.length === 0) return
    const idleNames = ['Idle', 'idle', 'IDLE', 'Standing', 'standing', 'idle_01', 'Idle_01']
    const foundIdle = idleNames.find((n) => actions[n])
    const clipToPlay = foundIdle ? actions[foundIdle] : actions[animations[0].name]
    if (clipToPlay) {
      clipToPlay.reset().fadeIn(0.3).setLoop(LoopRepeat, Infinity).play()
    }
    return () => {
      mixer.stopAllAction()
    }
  }, [animations, actions, mixer])

  const hasAnimations = animations.length > 0
  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const t = (performance.now() / 1000) * 1.2
    if (!hasAnimations) {
      g.position.y = Math.sin(t) * 0.06
      g.rotation.z = Math.sin(t * 0.7) * 0.03
    } else {
      g.position.y = Math.sin(t * 0.5) * 0.03
    }
  })

  const faceRotation = side !== undefined ? FACE_ROTATION[side] : 0
  const scale = variant === 'battle' ? 1.1 : 1
  const offsetX = variant === 'battle' ? (side === 'left' ? 0.15 : -0.15) : 0
  const offsetY = variant === 'battle' ? -0.5 : 0

  return (
    <group ref={groupRef} position={[offsetX, offsetY, 0]} rotation={[0, faceRotation, 0]} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  )
}

function BattleCamera() {
  useFrame(({ camera }) => {
    camera.lookAt(0, -0.35, 0)
  })
  return null
}

function AgentCanvasProbe({ variant, side }: { variant: HeroModelVariant; side?: 'left' | 'right' }) {
  const { gl, size } = useThree()
  useEffect(() => {
    const c = gl.getContext()
    const ctxAttrs = typeof c.getContextAttributes === 'function' ? c.getContextAttributes() : null
    __agentLog('H4', 'components/HeroModel3D.tsx:AgentCanvasProbe', 'canvas/gl snapshot', {
      variant,
      side,
      size,
      isWebGL2: typeof (window as unknown as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext !== 'undefined' && c instanceof WebGL2RenderingContext,
      contextAttributes: ctxAttrs,
    })
  }, [gl, side, size, variant])
  return null
}

function HeroModel3DInner({ modelUrl, variant = 'home', side = 'left', className }: HeroModel3DProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  // #region agent log
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    __agentLog('H3', 'components/HeroModel3D.tsx:rootRect', 'HeroModel3D root rect snapshot', {
      variant,
      side,
      className: className ?? null,
      modelUrl: typeof modelUrl === 'string' ? modelUrl.slice(0, 90) : null,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    })
    requestAnimationFrame(() => {
      const el2 = rootRef.current
      if (!el2) return
      const rect2 = el2.getBoundingClientRect()
      __agentLog('H3', 'components/HeroModel3D.tsx:rootRectRaf', 'HeroModel3D root rect snapshot (raf)', {
        variant,
        side,
        rect: { x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height },
      })
    })
  }, [className, modelUrl, side, variant])
  // #endregion

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{
          position: [0, variant === 'battle' ? 0.45 : 0, variant === 'battle' ? 2.2 : 2],
          fov: variant === 'battle' ? 46 : 42,
        }}
        gl={{ alpha: true, antialias: true }}
      >
        {variant === 'battle' && <BattleCamera />}
        <AgentCanvasProbe variant={variant} side={side} />
        <ambientLight intensity={1} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <directionalLight position={[-2, 3, 2]} intensity={0.6} />
        <Suspense fallback={null}>
          <AnimatedModel url={modelUrl} variant={variant} side={side} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default HeroModel3DInner
