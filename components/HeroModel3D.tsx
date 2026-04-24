import React, { Suspense, useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
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
  right: -TILT_LEFT,
}
const MODEL_BASE_Y_BY_VARIANT: Record<HeroModelVariant, number> = {
  home: -1.24,
  battle: -0.98,
}
const MODEL_BOB_AMPLITUDE_BY_VARIANT: Record<HeroModelVariant, number> = {
  home: 0.03,
  battle: 0.025,
}
const CAMERA_LOOK_Y_BY_VARIANT: Record<HeroModelVariant, number> = {
  home: -0.16,
  battle: -0.2,
}
const CAMERA_POS_Y_BY_VARIANT: Record<HeroModelVariant, number> = {
  home: -0.08,
  battle: 0.08,
}
const CAMERA_POS_Z_BY_VARIANT: Record<HeroModelVariant, number> = {
  home: 2,
  battle: 2.7,
}
const CAMERA_FOV_BY_VARIANT: Record<HeroModelVariant, number> = {
  home: 42,
  battle: 48,
}

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
    const baseY = MODEL_BASE_Y_BY_VARIANT[variant]
    const bobAmp = MODEL_BOB_AMPLITUDE_BY_VARIANT[variant]
    if (!hasAnimations) {
      g.position.y = baseY + Math.sin(t) * (bobAmp + 0.015)
      g.rotation.z = Math.sin(t * 0.7) * 0.03
    } else {
      g.position.y = baseY + Math.sin(t * 0.5) * bobAmp
    }
  })

  const faceRotation = side !== undefined ? FACE_ROTATION[side] : 0
  const scale = variant === 'battle' ? 1.22 : 1.5
  const offsetX = variant === 'battle' ? (side === 'left' ? 0.08 : -0.08) : 0
  const offsetY = MODEL_BASE_Y_BY_VARIANT[variant]

  return (
    <group ref={groupRef} position={[offsetX, offsetY, 0]} rotation={[0, faceRotation, 0]} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  )
}

function BattleCamera() {
  useFrame(({ camera }) => {
    camera.lookAt(0, CAMERA_LOOK_Y_BY_VARIANT.battle, 0)
  })
  return null
}

function HeroModel3DInner({ modelUrl, variant = 'home', side = 'left', className }: HeroModel3DProps) {
  return (
    <div
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
          position: [0, CAMERA_POS_Y_BY_VARIANT[variant], CAMERA_POS_Z_BY_VARIANT[variant]],
          fov: CAMERA_FOV_BY_VARIANT[variant],
        }}
        gl={{ alpha: true, antialias: true }}
      >
        {variant === 'battle' && <BattleCamera />}
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
