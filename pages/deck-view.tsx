import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import PageHeader from '@/components/ui/PageHeader'
import CardModal from '@/components/CardModal'
import GameCard from '@/components/GameCard'
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

  const cards = useMemo(() => {
    if (!deck) return []
    return deck.cardIds
      .map((cardId) => cardMap.get(cardId))
      .filter((card): card is CardDefinition => card !== undefined)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
  }, [deck, cardMap])

  if (!deck) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  return (
    <PageLayout title="デッキ確認">
      <div className={styles.container}>
        <PageHeader title={deck.name} rightContent={<p>{cards.length}枚</p>} />

        <div className={styles.cardGrid}>
          {cards.map((card, index) => (
            <GameCard
              key={`${card.id}-${index}`}
              cardDef={card}
              size="sm"
              onClick={() => setSelectedCard(card)}
              cardMap={cardMap}
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

