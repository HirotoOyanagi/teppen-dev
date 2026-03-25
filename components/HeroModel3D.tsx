import React, { Suspense, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei'
import type { Group } from 'three'
import { LoopRepeat } from 'three'

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
      <primitive object={scene} />
    </group>
  )
}

function BattleCamera() {
  useFrame(({ camera }) => {
    camera.lookAt(0, -0.35, 0)
  })
  return null
}

function HeroModel3DInner({ modelUrl, variant = 'home', side = 'left', className }: HeroModel3DProps) {
  const showOrbit = variant === 'home'

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
          position: [0, variant === 'battle' ? 0.45 : 0, variant === 'battle' ? 2.2 : 2],
          fov: variant === 'battle' ? 46 : 42,
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
        {showOrbit && (
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={2}
            maxDistance={5}
          />
        )}
      </Canvas>
    </div>
  )
}

export default HeroModel3DInner
