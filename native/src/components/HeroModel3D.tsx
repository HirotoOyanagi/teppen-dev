import React, { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { useFrame } from '@react-three/fiber/native'
import { Canvas } from '@react-three/fiber/native'
import { useAnimations, useGLTF } from '@react-three/drei/native'
import type { Group } from 'three'
import { LoopRepeat } from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { loadBundledHeroModelUri } from '../assets'
import { colors } from '../theme'

export type HeroModelVariant = 'home' | 'battle'

interface HeroModel3DProps {
  modelUrl?: string
  variant?: HeroModelVariant
  side?: 'left' | 'right'
  style?: StyleProp<ViewStyle>
  fallbackLabel?: string
}

type ErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

const TILT_LEFT = (5 * Math.PI) / 180
const FACE_ROTATION: Record<'left' | 'right', number> = {
  left: TILT_LEFT,
  right: Math.PI - TILT_LEFT,
}

class ModelErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

function AnimatedModel({
  uri,
  variant,
  side,
}: {
  uri: string
  variant: HeroModelVariant
  side: 'left' | 'right'
}) {
  const groupRef = useRef<Group>(null)
  const { scene, animations } = useGLTF(uri)
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions, mixer } = useAnimations(animations, groupRef)

  useEffect(() => {
    if (animations.length === 0) {
      return undefined
    }

    const idleNames = ['Idle', 'idle', 'IDLE', 'Standing', 'standing', 'idle_01', 'Idle_01']
    const actionName = idleNames.find((name) => actions[name]) ?? animations[0]?.name
    const action = actionName ? actions[actionName] : undefined

    if (action) {
      action.reset().fadeIn(0.25).setLoop(LoopRepeat, Infinity).play()
    }

    return () => {
      mixer.stopAllAction()
    }
  }, [actions, animations, mixer])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) {
      return
    }

    const t = state.clock.getElapsedTime()
    group.position.y = variant === 'battle' ? -0.46 + Math.sin(t * 0.5) * 0.03 : Math.sin(t * 0.5) * 0.04
    group.rotation.z = animations.length === 0 ? Math.sin(t * 0.7) * 0.03 : 0
  })

  return (
    <group
      ref={groupRef}
      position={[variant === 'battle' ? (side === 'left' ? 0.15 : -0.15) : 0, variant === 'battle' ? -0.46 : 0, 0]}
      rotation={[0, FACE_ROTATION[side], 0]}
      scale={variant === 'battle' ? 1.1 : 1}
    >
      <primitive object={clonedScene} />
    </group>
  )
}

function CameraRig({ variant }: { variant: HeroModelVariant }) {
  useFrame(({ camera }) => {
    camera.lookAt(0, variant === 'battle' ? -0.26 : 0.05, 0)
  })

  return null
}

function ModelFallback({ label }: { label: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackEyebrow}>3D MODEL</Text>
      <Text style={styles.fallbackLabel}>{label}</Text>
    </View>
  )
}

export function HeroModel3D({
  modelUrl,
  variant = 'home',
  side = 'right',
  style,
  fallbackLabel = 'Hero',
}: HeroModel3DProps) {
  const [modelUri, setModelUri] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(modelUrl))
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!modelUrl) {
        if (mounted) {
          setModelUri(null)
          setHasError(false)
          setIsLoading(false)
        }
        return
      }

      try {
        setIsLoading(true)
        const nextUri = await loadBundledHeroModelUri(modelUrl)
        if (!mounted) {
          return
        }
        setModelUri(nextUri)
        setHasError(!nextUri)
      } catch {
        if (!mounted) {
          return
        }
        setModelUri(null)
        setHasError(true)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [modelUrl])

  if (!modelUrl) {
    return <View style={[styles.container, style]}><ModelFallback label={fallbackLabel} /></View>
  }

  if (isLoading) {
    return (
      <View style={[styles.container, style, styles.loadingContainer]}>
        <ActivityIndicator color={colors.accentStrong} />
      </View>
    )
  }

  if (hasError || !modelUri) {
    return <View style={[styles.container, style]}><ModelFallback label={fallbackLabel} /></View>
  }

  return (
    <View style={[styles.container, style]}>
      <ModelErrorBoundary key={modelUri} fallback={<ModelFallback label={fallbackLabel} />}>
        <Canvas
          style={styles.canvas}
          camera={{
            position: [0, variant === 'battle' ? 0.42 : 0.04, variant === 'battle' ? 2.2 : 2],
            fov: variant === 'battle' ? 46 : 42,
          }}
        >
          <CameraRig variant={variant} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[3, 4, 5]} intensity={1.25} />
          <directionalLight position={[-2, 3, 2]} intensity={0.55} />
          <Suspense fallback={null}>
            <AnimatedModel uri={modelUri} variant={variant} side={side} />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fallbackEyebrow: {
    color: colors.accentStrong,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  fallbackLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
})
