import type { SavedDeck } from '@/utils/deckStorage'
import styles from './DeckListItem.module.css'

interface DeckListItemProps {
  deck: SavedDeck
  isSelected?: boolean
  onClick: () => void
  warning?: string
}

export default function DeckListItem({ deck, isSelected, onClick, warning }: DeckListItemProps) {
  return (
    <div
      className={`${styles.deckItem} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.deckInfo}>
        <h3>{deck.name}</h3>
        <p>{deck.cardIds.length}枚</p>
        {warning && <p className={styles.warning}>{warning}</p>}
      </div>
    </div>
  )
}
