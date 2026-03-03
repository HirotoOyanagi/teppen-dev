import { useState, useEffect } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import type { CardDefinition } from '@/core/types'
import styles from './DeckViewScreen.module.css'

interface DeckViewScreenProps {
  deckId: string
}

export default function DeckViewScreen({ deckId }: DeckViewScreenProps) {
  const { goBack } = useNavigation()
  const [deck, setDeck] = useState<{ cardIds: string[]; name: string } | null>(null)
  const { cardMap } = useCards()
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)

  useEffect(() => {
    if (deckId) {
      const savedDeck = getDeck(deckId)
      if (savedDeck) {
        setDeck(savedDeck)
      }
    }
  }, [deckId])

  if (!deck) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  const cards = deck.cardIds
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is CardDefinition => card !== undefined)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => goBack()}>
          ← 戻る
        </button>
        <h1>{deck.name}</h1>
        <p>{cards.length}枚</p>
      </div>

      <div className={styles.cardGrid}>
        {cards.map((card, index) => (
          <div
            key={`${card.id}-${index}`}
            className={styles.cardItem}
            onClick={() => setSelectedCard(card)}
          >
            <div className={styles.cardCost}>{card.cost}</div>
            <div className={styles.cardName}>{card.name}</div>
            {card.unitStats && (
              <div className={styles.cardStats}>
                <span className={styles.attack}>{card.unitStats.attack}</span>
                <span className={styles.hp}>{card.unitStats.hp}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}

      <BottomNavigation />
    </div>
  )
}
