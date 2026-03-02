import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import PageHeader from '@/components/ui/PageHeader'
import HeroCard from '@/components/ui/HeroCard'
import DeckListItem from '@/components/ui/DeckListItem'
import EmptyState from '@/components/ui/EmptyState'
import { getDecks, deleteDeck, type SavedDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { HEROES } from '@/core/heroes'
import styles from './deck-list.module.css'

export default function DeckListPage() {
  const router = useRouter()
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null)
  const { cardMap } = useCards()

  useEffect(() => {
    const loadedDecks = getDecks()
    loadedDecks.sort((a, b) => b.updatedAt - a.updatedAt)
    setDecks(loadedDecks)
    if (loadedDecks.length > 0) {
      setSelectedDeck(loadedDecks[0])
    }
  }, [])

  const selectedHero = selectedDeck
    ? HEROES.find((h) => h.id === selectedDeck.heroId) || HEROES[0]
    : HEROES[0]

  const handleDeleteDeck = (deckId: string) => {
    if (confirm('このデッキを削除しますか？')) {
      deleteDeck(deckId)
      const newDecks = getDecks().sort((a, b) => b.updatedAt - a.updatedAt)
      setDecks(newDecks)
      if (newDecks.length > 0) {
        setSelectedDeck(newDecks[0])
      } else {
        setSelectedDeck(null)
      }
    }
  }

  const handleViewDeck = () => {
    if (selectedDeck) {
      router.push(`/deck-view?id=${selectedDeck.id}`)
    }
  }

  const handleEditDeck = () => {
    if (selectedDeck) {
      router.push(`/deck-edit?id=${selectedDeck.id}`)
    } else {
      router.push('/deck-edit')
    }
  }

  return (
    <PageLayout title="デッキ編成">
      <div className={styles.container}>
        <PageHeader title="デッキ編成" />

        <div className={styles.content}>
          <div className={styles.deckList}>
            <button
              className={styles.newDeckButton}
              onClick={() => router.push('/deck-edit')}
            >
              + 新しいデッキを作成
            </button>
            {decks.map((deck) => (
              <DeckListItem
                key={deck.id}
                deck={deck}
                isSelected={selectedDeck?.id === deck.id}
                onClick={() => setSelectedDeck(deck)}
              />
            ))}
          </div>

          <div className={styles.deckDetail}>
            {selectedDeck ? (
              <>
                <HeroCard hero={selectedHero} />
                <div className={styles.buttons}>
                  <button className={styles.actionButton} onClick={handleViewDeck}>
                    デッキ確認
                  </button>
                  <button className={styles.actionButton} onClick={handleEditDeck}>
                    デッキ編成
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteDeck(selectedDeck.id)}
                  >
                    デッキ削除
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                message="デッキがありません"
                actionLabel="新しいデッキを作成"
                onAction={() => router.push('/deck-edit')}
              />
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
