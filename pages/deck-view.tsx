import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import type { CardDefinition } from '@/core/types'
import styles from './deck-view.module.css'

export default function DeckViewPage() {
  const router = useRouter()
  const { id } = router.query
  const [deck, setDeck] = useState<{ cardIds: string[]; name: string } | null>(null)
  const { cardMap } = useCards()
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  const [bgm, setBgm] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (id && typeof id === 'string') {
      const savedDeck = getDeck(id)
      if (savedDeck) {
        setDeck(savedDeck)
      }
    }

    // home.mp3の再生（存在しない場合はスキップ）
    const audio = new Audio('/sounds/home.mp3')
    audio.loop = true
    audio.volume = 0.3
    setBgm(audio)
    // 実際の実装では、音声ファイルが存在する場合のみ再生
    // audio.play().catch(() => {})

    return () => {
      audio.pause()
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
    <>
      <Head>
        <title>TEPPEN - デッキ確認</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.back()}>
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
    </>
  )
}

