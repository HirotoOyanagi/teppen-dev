import { useState, useEffect, useRef } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import CardModal from '@/components/CardModal'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { HEROES } from '@/core/heroes'
import type { CardDefinition } from '@/core/types'
import styles from './DeckViewScreen.module.css'

interface DeckViewScreenProps {
  deckId: string
}

export default function DeckViewScreen({ deckId }: DeckViewScreenProps) {
  const { goBack } = useNavigation()
  const [deck, setDeck] = useState<{ cardIds: string[]; name: string; heroId: string } | null>(null)
  const { cardMap } = useCards()
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (deckId) {
      const savedDeck = getDeck(deckId)
      if (savedDeck) {
        setDeck(savedDeck)
      }
    }
  }, [deckId])

  useEffect(() => {
    if (!deck) return
    if (!containerRef.current) return

    const el = containerRef.current
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    const bgEl = el.querySelector(`.${styles.background}`) as HTMLElement | null
    const bgStyle = bgEl ? window.getComputedStyle(bgEl) : null

    const coversViewport =
      rect.top <= 0 &&
      rect.left <= 0 &&
      rect.bottom >= window.innerHeight - 1 &&
      rect.right >= window.innerWidth - 1

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '818948' },
      body: JSON.stringify({
        sessionId: '818948',
        runId: 'background-debug-1',
        hypothesisId: 'H2_overlay_cover_bg',
        location: 'DeckViewScreen.tsx:background-log',
        message: 'deck-view container computed',
        data: {
          deckId,
          coversViewport,
          rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
          containerBgColor: style.backgroundColor,
          containerBgImage: style.backgroundImage,
          bgOpacity: bgStyle?.opacity,
          bgBgImage: bgStyle?.backgroundImage,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [deck, deckId])

  if (!deck) {
    return (
      <div ref={containerRef} className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  const cards = deck.cardIds
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is CardDefinition => card !== undefined)
    .sort((a, b) => a.cost - b.cost)

  const hero = HEROES.find(h => h.id === deck.heroId) || HEROES[0]

  const attributeIcons: Record<string, string> = {
    red: '🔥',
    green: '🌿',
    purple: '🔮',
    black: '💀',
  }

  let heroArtText = ''
  if (hero.heroArt) {
    heroArtText = ` / ${hero.heroArt.name}`
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.overlay}>
        <button className={styles.closeButton} onClick={() => goBack()}>×</button>
        
        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.heroIcon}>
            {attributeIcons[hero.attribute]}
          </div>
          <div className={styles.deckName}>{deck.name}</div>
          <div className={styles.spacer}></div>
          <div className={styles.heroArtName}>
            {hero.name}
            {heroArtText}
          </div>
          <div className={styles.cardCount}>
            📄 {cards.length}/30
          </div>
          <div style={{ color: '#ffd700', fontSize: '20px', marginLeft: '10px' }}>⚔️</div>
        </div>

        {/* Main Grid */}
        <div className={styles.mainGrid}>
          {cards.map((card, index) => {
            const hasImage = Boolean(card.imageUrl)
            const backgroundImage = ({
              true: () => `url(${card.imageUrl!})`,
              false: () => 'none',
            } as const)[String(hasImage) as 'true' | 'false']()

            return (
              <div
                key={`${card.id}-${index}`}
                className={styles.cardItem}
                onClick={() => setSelectedCard(card)}
              >
                <div className={styles.cardLabel}>{card.name}</div>
                <div className={styles.cardImage} style={{ backgroundImage }} />
                <div className={styles.cardOverlay}>
                  <div className={styles.cardMP}>{card.cost}</div>
                  {card.unitStats && (
                    <div className={styles.cardStats}>
                      <span className={styles.atk}>{card.unitStats.attack}</span>
                      <span className={styles.hp}>{card.unitStats.hp}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {/* Fill empty slots up to 30 */}
          {Array.from({ length: Math.max(0, 30 - cards.length) }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.cardItem} style={{ opacity: 0.3 }} />
          ))}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.footerButton}>
            デッキコードをコピー
          </button>
          <div className={styles.spacer}></div>
          <button className={`${styles.footerButton} ${styles.qrButton}`}>
            デッキQRを表示
          </button>
        </div>
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  )
}
