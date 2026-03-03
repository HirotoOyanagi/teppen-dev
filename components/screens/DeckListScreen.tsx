import { useState, useEffect } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import { getDecks, deleteDeck, type SavedDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { HEROES } from '@/core/heroes'
import styles from './DeckListScreen.module.css'

export default function DeckListScreen() {
  const { navigate, goBack } = useNavigation()
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
      navigate({ name: 'deck-view', deckId: selectedDeck.id })
    }
  }

  const handleEditDeck = () => {
    if (selectedDeck) {
      navigate({ name: 'deck-edit', deckId: selectedDeck.id })
    } else {
      navigate({ name: 'deck-edit' })
    }
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => goBack()}>
          ← 戻る
        </button>
        <h1>デッキ編成</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.deckList}>
          <button
            className={styles.newDeckButton}
            onClick={() => navigate({ name: 'deck-edit' })}
          >
            + 新しいデッキを作成
          </button>
          {decks.map((deck) => (
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
              </div>
            </div>
          ))}
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
              </div>
              <div className={styles.buttons}>
                <button
                  className={styles.actionButton}
                  onClick={handleViewDeck}
                >
                  デッキ確認
                </button>
                <button
                  className={styles.actionButton}
                  onClick={handleEditDeck}
                >
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
            <div className={styles.noDeck}>
              <p>デッキがありません</p>
              <button
                className={styles.newDeckButton}
                onClick={() => navigate({ name: 'deck-edit' })}
              >
                新しいデッキを作成
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
