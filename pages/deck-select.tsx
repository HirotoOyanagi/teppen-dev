import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import PageHeader from '@/components/ui/PageHeader'
import HeroCard from '@/components/ui/HeroCard'
import DeckListItem from '@/components/ui/DeckListItem'
import EmptyState from '@/components/ui/EmptyState'
import { getDecks, type SavedDeck } from '@/utils/deckStorage'
import { HEROES } from '@/core/heroes'
import styles from './deck-select.module.css'

export default function DeckSelectPage() {
  const router = useRouter()
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null)

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

  const handleStartBattle = () => {
    if (!selectedDeck) {
      alert('デッキを選択してください')
      return
    }
    localStorage.setItem('teppen_selectedDeckId', selectedDeck.id)
    router.push('/matchmaking')
  }

  const deckCardCount = selectedDeck ? selectedDeck.cardIds.length : 0
  const canStartBattle = selectedDeck && deckCardCount === 30

  return (
    <PageLayout title="デッキ選択">
      <div className={styles.container}>
        <PageHeader title="デッキ選択" onBack={() => router.push('/home')} backLabel="← ホームに戻る" />

        <div className={styles.content}>
          <div className={styles.deckList}>
            {decks.length === 0 ? (
              <EmptyState
                message="デッキがありません"
                actionLabel="デッキを作成する"
                onAction={() => router.push('/deck-edit')}
              />
            ) : (
              decks.map((deck) => (
                <DeckListItem
                  key={deck.id}
                  deck={deck}
                  isSelected={selectedDeck?.id === deck.id}
                  onClick={() => setSelectedDeck(deck)}
                  warning={deck.cardIds.length !== 30 ? '※30枚のデッキが必要です' : undefined}
                />
              ))
            )}
          </div>

          <div className={styles.deckDetail}>
            {selectedDeck ? (
              <>
                <HeroCard hero={selectedHero}>
                  <p>デッキ: {deckCardCount}/30枚</p>
                </HeroCard>
                <div className={styles.buttons}>
                  <button
                    className={styles.viewButton}
                    onClick={() => router.push(`/deck-view?id=${selectedDeck.id}`)}
                  >
                    デッキ確認
                  </button>
                  <button
                    className={`${styles.startButton} ${!canStartBattle ? styles.disabled : ''}`}
                    onClick={handleStartBattle}
                    disabled={!canStartBattle}
                  >
                    {canStartBattle ? 'バトル開始' : 'デッキを30枚にする必要があります'}
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                message="デッキがありません"
                actionLabel="デッキを作成する"
                onAction={() => router.push('/deck-edit')}
              />
            )}
          </div>
        </div>

      </div>
    </PageLayout>
  )
}
