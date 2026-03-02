import type { CardDefinition } from '@/core/types'
import styles from './CardListItem.module.css'

interface CardListItemProps {
  card: CardDefinition
  onClick?: () => void
}

export default function CardListItem({ card, onClick }: CardListItemProps) {
  return (
    <div className={styles.cardItem} onClick={onClick}>
      <div className={styles.cardCost}>{card.cost}</div>
      <div className={styles.cardName}>{card.name}</div>
      {card.unitStats && (
        <div className={styles.cardStats}>
          <span className={styles.attack}>{card.unitStats.attack}</span>
          <span className={styles.hp}>{card.unitStats.hp}</span>
        </div>
      )}
    </div>
  )
}
