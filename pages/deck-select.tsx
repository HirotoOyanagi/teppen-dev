import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import { getDecks, type SavedDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import type { Hero } from '@/core/types'
import styles from './deck-select.module.css'

const SAMPLE_HEROES: Hero[] = [
  { id: 'hero_red_1', name: 'リュウ', attribute: 'red', description: '格闘家' },
  { id: 'hero_green_1', name: '春麗', attribute: 'green', description: '格闘家' },
  { id: 'hero_purple_1', name: 'ダルシム', attribute: 'purple', description: 'ヨガマスター' },
  { id: 'hero_black_1', name: '豪鬼', attribute: 'black', description: '最強の格闘家' },
]

export default function DeckSelectPage() {
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
    ? SAMPLE_HEROES.find((h) => h.id === selectedDeck.heroId) || SAMPLE_HEROES[0]
    : SAMPLE_HEROES[0]

  const handleDeckSelect = (deck: SavedDeck) => {
    setSelectedDeck(deck)
  }

  const handleViewDeck = () => {
    if (selectedDeck) {
      router.push(`/deck-view?id=${selectedDeck.id}`)
    }
  }

  const handleStartBattle = () => {
    if (!selectedDeck) {
      alert('デッキを選択してください')
      return
    }

    // 選択したデッキをローカルストレージに保存
    localStorage.setItem('teppen_selectedDeckId', selectedDeck.id)
    
    // メインゲーム画面に遷移
    router.push('/battle')
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
    <>
      <Head>
        <title>TEPPEN - デッキ選択</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push('/home')}>
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
                  onClick={() => router.push('/deck-edit')}
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
                  onClick={() => router.push('/deck-edit')}
                >
                  デッキを作成する
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

