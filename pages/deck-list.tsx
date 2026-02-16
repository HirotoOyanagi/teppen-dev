import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
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
    // 新しい順にソート
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

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  return (
    <>
      <Head>
        <title>TEPPEN - デッキ編成</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.back()}>
            ← 戻る
          </button>
          <h1>デッキ編成</h1>
        </div>

        <div className={styles.content}>
          <div className={styles.deckList}>
            <button
              className={styles.newDeckButton}
              onClick={() => router.push('/deck-edit')}
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
                  onClick={() => router.push('/deck-edit')}
                >
                  新しいデッキを作成
                </button>
              </div>
            )}
          </div>
        </div>

        <BottomNavigation />
      </div>
    </>
  )
}

