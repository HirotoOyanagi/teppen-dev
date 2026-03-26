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

  const handleDeleteDeck = (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation()
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

  const handleEditDeck = () => {
    if (selectedDeck) {
      navigate({ name: 'deck-edit', deckId: selectedDeck.id })
    } else {
      navigate({ name: 'deck-edit' })
    }
  }

  const handleViewDeck = () => {
    if (selectedDeck) {
      navigate({ name: 'deck-view', deckId: selectedDeck.id })
    }
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  const attributeIcons: Record<string, string> = {
    red: '🔥',
    green: '🌿',
    purple: '🔮',
    black: '💀',
  }

  return (
    <div className={styles.container}>
      {/* Background with overlay */}
      <div className={styles.background} />

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => goBack()}>
            BACK
          </button>
          <h1>デッキ一覧</h1>
          <span className={styles.deckCount}>{decks.length} / 100</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <button
            className={styles.newDeckButton}
            onClick={() => navigate({ name: 'deck-edit' })}
          >
            + NEW DECK
          </button>
          <div className={styles.deckList}>
            {decks.map((deck) => {
              const hero = HEROES.find((h) => h.id === deck.heroId) || HEROES[0]
              return (
                <div
                  key={deck.id}
                  className={`${styles.deckItem} ${
                    selectedDeck?.id === deck.id ? styles.selected : ''
                  }`}
                  onClick={() => handleDeckSelect(deck)}
                >
                  <div 
                    className={styles.deckItemHeroPortrait} 
                    style={{ backgroundColor: attributeColors[hero.attribute] }}
                  >
                    {/* Portrait Placeholder */}
                    <div style={{ fontSize: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      👤
                    </div>
                  </div>
                  <div className={styles.deckItemInfo}>
                    <div className={styles.deckItemName}>{deck.name}</div>
                    <div className={styles.deckItemAttr}>
                      {attributeIcons[hero.attribute]} {hero.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.mainArea}>
          {/* Hero Artwork Placeholder */}
          <div className={styles.heroArtwork}>
             <div style={{ fontSize: '200px', opacity: 0.2, textAlign: 'center', marginTop: '100px' }}>
                {attributeIcons[selectedHero.attribute]}
             </div>
          </div>

          {selectedDeck && (
            <>
              <div className={styles.deckDetailsBox}>
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>デッキ名</div>
                  <div className={styles.detailValue}>{selectedDeck.name}</div>
                </div>
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>ヒーロー</div>
                  <div className={styles.detailValue}>{selectedHero.name}</div>
                </div>
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>ヒーローアーツ</div>
                  <div className={styles.detailValue}>{selectedHero.heroArt.name}</div>
                </div>
                <div className={styles.deckStatus}>
                  <div className={styles.statusItem}>
                    <span style={{ color: '#d4af37' }}>📄</span>
                    <span>{selectedDeck.cardIds.length} / 30</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span style={{ color: attributeColors[selectedHero.attribute] }}>
                      {attributeIcons[selectedHero.attribute]}
                    </span>
                    <span>{selectedHero.attribute.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className={styles.bottomRightButtons}>
                <div className={styles.auxButtons}>
                  <div className={styles.iconButton} onClick={(e) => handleDeleteDeck(e, selectedDeck.id)}>
                    <span>🗑️</span>
                    TRASH
                  </div>
                  <div className={styles.iconButton} onClick={handleViewDeck}>
                    <span>👁️</span>
                    DECK
                  </div>
                  <div className={styles.iconButton}>
                    <span>👕</span>
                    SKIN
                  </div>
                </div>
                <button
                  className={styles.editButton}
                  onClick={handleEditDeck}
                >
                  デッキ編成
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
