import { useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import type { CardAttribute } from '@/core/types'

import { resolveBundledHeroLive2DModule } from '../assets'
import { resolveRemoteAssetUrl } from '../config'
import { colors } from '../theme'

export type HeroLive2DVariant = 'home' | 'battle' | 'avatar'

interface HeroLive2DProps {
  imageUrl?: string
  variant?: HeroLive2DVariant
  side?: 'left' | 'right'
  style?: StyleProp<ViewStyle>
  fallbackLabel?: string
  attribute?: CardAttribute
}

const ACCENT_COLORS: Record<CardAttribute, string> = {
  red: 'rgba(248,113,113,0.42)',
  green: 'rgba(52,211,153,0.38)',
  purple: 'rgba(168,85,247,0.4)',
  black: 'rgba(148,163,184,0.38)',
}

function resolveImageSource(imageUrl?: string): ImageSourcePropType | null {
  const moduleId = resolveBundledHeroLive2DModule(imageUrl)
  if (moduleId) {
    return moduleId
  }

  const remoteUrl = resolveRemoteAssetUrl(imageUrl)
  if (remoteUrl) {
    return { uri: remoteUrl }
  }

  return null
}

export function HeroLive2D({
  imageUrl,
  variant = 'home',
  side = 'right',
  style,
  fallbackLabel = 'Hero',
  attribute = 'red',
}: HeroLive2DProps) {
  const breath = useRef(new Animated.Value(0)).current
  const sway = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(0)).current
  const source = useMemo(() => resolveImageSource(imageUrl), [imageUrl])
  const accent = ACCENT_COLORS[attribute]

  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )

    breathLoop.start()
    swayLoop.start()
    glowLoop.start()

    return () => {
      breathLoop.stop()
      swayLoop.stop()
      glowLoop.stop()
    }
  }, [breath, glow, sway])

  if (!source) {
    return (
      <View style={[styles.container, style, styles.fallback]}>
        <Text style={styles.fallbackEyebrow}>LIVE2D</Text>
        <Text style={styles.fallbackLabel}>{fallbackLabel}</Text>
      </View>
    )
  }

  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.022],
  })
  const translateY = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0, variant === 'battle' ? -2 : -5],
  })
  const rotate = sway.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-1.2deg', '0deg', '1.2deg'],
  })
  const translateX = sway.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [side === 'left' ? -2 : 2, 0, side === 'left' ? 2 : -2],
  })
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.78],
  })

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.aura, { backgroundColor: accent, opacity: glowOpacity }]} />
      <Animated.View
        style={[
          styles.rig,
          variant === 'battle' ? styles.rigBattle : null,
          variant === 'avatar' ? styles.rigAvatar : null,
          {
            transform: [
              { translateX },
              { translateY },
              { rotate },
              { scaleX: side === 'left' ? scale : Animated.multiply(scale, -1) },
              { scaleY: scale },
            ],
          },
        ]}
      >
        <Animated.Image source={source} style={[styles.shadow, styles.image]} resizeMode="contain" />
        <Image source={source} style={styles.image} resizeMode="contain" />
        <Animated.Image
          source={source}
          style={[
            styles.image,
            styles.highlight,
            {
              opacity: glowOpacity,
              transform: [{ translateX }, { translateY }],
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  aura: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    top: '12%',
    bottom: '4%',
    borderRadius: 999,
    transform: [{ scale: 1.05 }],
  },
  rig: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '-2%',
    bottom: '-4%',
  },
  rigBattle: {
    left: '-14%',
    right: '-14%',
    top: '-2%',
    bottom: '-10%',
  },
  rigAvatar: {
    left: '-30%',
    right: '-30%',
    top: '-12%',
    bottom: '-52%',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  shadow: {
    opacity: 0.26,
    tintColor: '#000',
    transform: [{ translateY: 10 }, { scale: 1.02 }],
  },
  highlight: {
    opacity: 0.34,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  fallbackEyebrow: {
    color: colors.accentStrong,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  fallbackLabel: {
    marginTop: 6,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
})
