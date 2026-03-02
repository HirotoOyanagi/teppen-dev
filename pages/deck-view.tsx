import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import PageHeader from '@/components/ui/PageHeader'
import CardModal from '@/components/CardModal'
import CardListItem from '@/components/ui/CardListItem'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { useBgm } from '@/utils/useBgm'
import type { CardDefinition } from '@/core/types'
import styles from './deck-view.module.css'

export default function DeckViewPage() {
  const router = useRouter()
  const { id } = router.query
  const [deck, setDeck] = useState<{ cardIds: string[]; name: string } | null>(null)
  const { cardMap } = useCards()
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  useBgm('/sounds/home.mp3')

  useEffect(() => {
    if (id && typeof id === 'string') {
      const savedDeck = getDeck(id)
      if (savedDeck) {
        setDeck(savedDeck)
      }
    }
  }, [id])

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
    <PageLayout title="デッキ確認">
      <div className={styles.container}>
        <PageHeader title={deck.name} rightContent={<p>{cards.length}枚</p>} />

        <div className={styles.cardGrid}>
          {cards.map((card, index) => (
            <CardListItem
              key={`${card.id}-${index}`}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>

        {selectedCard && (
          <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}

      </div>
    </PageLayout>
  )
}

