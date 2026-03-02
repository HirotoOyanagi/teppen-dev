import type { Hero } from '@/core/types'
import { ATTRIBUTE_COLORS } from '@/utils/constants'
import styles from './HeroCard.module.css'

interface HeroCardProps {
  hero: Hero
  children?: React.ReactNode
  className?: string
}

export default function HeroCard({ hero, children, className }: HeroCardProps) {
  return (
    <div
      className={`${styles.heroCard} ${className || ''}`}
      style={{ borderColor: ATTRIBUTE_COLORS[hero.attribute] }}
    >
      <h2>{hero.name}</h2>
      <p>属性: {hero.attribute}</p>
      {children}
    </div>
  )
}
