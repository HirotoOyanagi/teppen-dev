import type { SavedDeck } from '@/utils/deckStorage'
import type { Hero } from '@/core/types'
import { ATTRIBUTE_COLORS } from '@/utils/constants'
import styles from './DeckListItem.module.css'

interface DeckListItemProps {
  deck: SavedDeck
  hero: Hero
  isSelected?: boolean
  onClick: () => void
  warning?: string
}

export default function DeckListItem({ deck, hero, isSelected, onClick, warning }: DeckListItemProps) {
  const attrColor = ATTRIBUTE_COLORS[hero.attribute]

  return (
    <div
      className={`${styles.deckItem} ${isSelected ? styles.selected : ''}`}
      style={{ borderLeftColor: attrColor }}
      onClick={onClick}
    >
      <div className={styles.heroIcon} style={{ background: attrColor }}>
        {hero.name.charAt(0)}
      </div>
      <div className={styles.deckInfo}>
        <div className={styles.heroName}>{hero.name}</div>
        <div className={styles.deckName}>{deck.name}</div>
        <div className={styles.cardCount}>
          <span className={deck.cardIds.length === 30 ? styles.countFull : styles.countWarn}>
            {deck.cardIds.length}/30
          </span>
          {warning && <span className={styles.warning}>{warning}</span>}
        </div>
      </div>
    </div>
  )
}
