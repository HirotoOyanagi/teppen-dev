import { useState, useEffect } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import { getDecks, type SavedDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { HEROES } from '@/core/heroes'
import styles from './DeckSelectScreen.module.css'

export default function DeckSelectScreen() {
  const { navigate } = useNavigation()
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

  const handleDeckSelect = (deck: SavedDeck) => {
    setSelectedDeck(deck)
  }

  const handleViewDeck = () => {
    if (selectedDeck) {
      navigate({ name: 'deck-view', deckId: selectedDeck.id })
    }
  }

  const handleStartBattle = () => {
    if (!selectedDeck) {
      alert('デッキを選択してください')
      return
    }

    localStorage.setItem('teppen_selectedDeckId', selectedDeck.id)
    navigate({ name: 'matchmaking' })
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  const deckCardCount = selectedDeck ? selectedDeck.cardIds.length : 0
  const canStartBattle = selectedDeck && deckCardCount === 30

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate({ name: 'home' })}>
          ← ホームに戻る
        </button>
        <h1>デッキ選択</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.deckList}>
          {decks.length === 0 ? (
            <div className={styles.noDeck}>
              <p>デッキがありません</p>
              <button
                className={styles.createDeckButton}
                onClick={() => navigate({ name: 'deck-edit' })}
              >
                デッキを作成する
              </button>
            </div>
          ) : (
            decks.map((deck) => (
              <div
                key={deck.id}
                className={`${styles.deckItem} ${
                  selectedDeck?.id === deck.id ? styles.selected : ''
                }`}
                onClick={() => handleDeckSelect(deck)}
              >
                <div className={styles.deckInfo}>
                  <h3>{deck.name}</h3>
                  <p>{deck.cardIds.length}枚</p>
                  {deck.cardIds.length !== 30 && (
                    <p className={styles.warning}>※30枚のデッキが必要です</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.deckDetail}>
          {selectedDeck ? (
            <>
              <div
                className={styles.heroCard}
                style={{ borderColor: attributeColors[selectedHero.attribute] }}
              >
                <h2>{selectedHero.name}</h2>
                <p>属性: {selectedHero.attribute}</p>
                <p>デッキ: {deckCardCount}/30枚</p>
              </div>
              <div className={styles.buttons}>
                <button
                  className={styles.viewButton}
                  onClick={handleViewDeck}
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
            <div className={styles.noDeck}>
              <p>デッキがありません</p>
              <button
                className={styles.createDeckButton}
                onClick={() => navigate({ name: 'deck-edit' })}
              >
                デッキを作成する
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
