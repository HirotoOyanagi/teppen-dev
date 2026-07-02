import React, { useMemo } from 'react'
import type { Hero } from '@/core/types'
import styles from './HeroLive2D.module.css'

export type HeroLive2DVariant = 'home' | 'battle' | 'avatar'

interface HeroLive2DProps {
  hero: Hero
  variant?: HeroLive2DVariant
  side?: 'left' | 'right'
  className?: string
}

type HeroLive2DStyle = React.CSSProperties & Record<string, string>

const ATTRIBUTE_ACCENTS: Record<string, { primary: string; secondary: string; glow: string }> = {
  red: { primary: '#ef4444', secondary: '#f59e0b', glow: 'rgba(248,113,113,0.38)' },
  green: { primary: '#10b981', secondary: '#86efac', glow: 'rgba(52,211,153,0.34)' },
  purple: { primary: '#a855f7', secondary: '#22d3ee', glow: 'rgba(168,85,247,0.34)' },
  black: { primary: '#94a3b8', secondary: '#facc15', glow: 'rgba(148,163,184,0.32)' },
}

const FALLBACK_IMAGE = '/images/live2d/reisia-live2d.png'

// Battle scale factors are tuned against Reisia's visible alpha bounds.
const BATTLE_MODEL_FIT: Record<string, { scale: number; y: string }> = {
  hero_red_reisia: { scale: 1, y: '0%' },
  hero_red_kaiser: { scale: 1.15, y: '1.5%' },
  hero_green_mira: { scale: 1.15, y: '1%' },
  hero_green_finn: { scale: 1.13, y: '1%' },
  hero_purple_vald: { scale: 0.97, y: '0%' },
  hero_purple_orca: { scale: 1.25, y: '2%' },
  hero_black_seraph: { scale: 0.96, y: '0%' },
  hero_black_nox: { scale: 0.99, y: '0%' },
}

function resolveAccent(hero: Hero) {
  return ATTRIBUTE_ACCENTS[hero.attribute] || ATTRIBUTE_ACCENTS.black
}

export default function HeroLive2D({
  hero,
  variant = 'home',
  side = 'left',
  className,
}: HeroLive2DProps) {
  const imageUrl = hero.live2dImageUrl || FALLBACK_IMAGE
  const accent = useMemo(() => resolveAccent(hero), [hero])
  const battleFit = BATTLE_MODEL_FIT[hero.id] || BATTLE_MODEL_FIT.hero_red_reisia

  const style: HeroLive2DStyle = {
    '--live2d-primary': accent.primary,
    '--live2d-secondary': accent.secondary,
    '--live2d-glow': accent.glow,
    '--live2d-battle-scale': `${battleFit.scale}`,
    '--live2d-battle-y': battleFit.y,
  }

  return (
    <div
      className={`${styles.stage} ${className || ''}`}
      data-variant={variant}
      data-side={side}
      style={style}
      aria-label={hero.name}
    >
      <div className={styles.aura} />

      <div className={styles.rig}>
        <img className={`${styles.layer} ${styles.shadow}`} src={imageUrl} alt="" aria-hidden />
        <img className={`${styles.layer} ${styles.base}`} src={imageUrl} alt={hero.name} draggable={false} />
        <img className={`${styles.layer} ${styles.lower}`} src={imageUrl} alt="" aria-hidden draggable={false} />
        <img className={`${styles.layer} ${styles.torso}`} src={imageUrl} alt="" aria-hidden draggable={false} />
        <img className={`${styles.layer} ${styles.capeLeft}`} src={imageUrl} alt="" aria-hidden draggable={false} />
        <img className={`${styles.layer} ${styles.capeRight}`} src={imageUrl} alt="" aria-hidden draggable={false} />
        <img className={`${styles.layer} ${styles.hair}`} src={imageUrl} alt="" aria-hidden draggable={false} />
        <img className={`${styles.layer} ${styles.head}`} src={imageUrl} alt="" aria-hidden draggable={false} />
        <div className={styles.blink} />
        <div className={styles.eyeLight} />
      </div>
    </div>
  )
}
