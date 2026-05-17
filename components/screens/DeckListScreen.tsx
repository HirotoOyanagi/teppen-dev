import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useNavigation } from '@/components/NavigationContext'
import { getDecks, deleteDeck, type SavedDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { HEROES } from '@/core/heroes'
import GameIcon, { type GameIconName } from '@/components/GameIcon'
import HeroLive2D from '@/components/HeroLive2D'
import styles from './DeckListScreen.module.css'

export default function DeckListScreen() {
  const router = useRouter()
  const { navigate, goBack } = useNavigation()
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null)
  const { cardMap } = useCards()

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '818948' },
      body: JSON.stringify({
        sessionId: '818948',
        runId: 'background-debug-1',
        hypothesisId: 'H1_unmount_prev_screen',
        location: 'DeckListScreen.tsx:mount',
        message: 'DeckListScreen mount',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '818948' },
        body: JSON.stringify({
          sessionId: '818948',
          runId: 'background-debug-1',
          hypothesisId: 'H1_unmount_prev_screen',
          location: 'DeckListScreen.tsx:unmount',
          message: 'DeckListScreen unmount',
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
    }
  }, [])

  useEffect(() => {
    const loadedDecks = getDecks()
    loadedDecks.sort((a, b) => b.updatedAt - a.updatedAt)
    setDecks(loadedDecks)
    if (loadedDecks.length > 0) {
      setSelectedDeck(loadedDecks[0])
    }
  }, [])

  let selectedHero = HEROES[0]
  if (selectedDeck) {
    selectedHero = HEROES.find((h) => h.id === selectedDeck.heroId) || HEROES[0]
  }

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

  const attributeIcons: Record<string, GameIconName> = {
    red: 'attr-red',
    green: 'attr-green',
    purple: 'attr-purple',
    black: 'attr-black',
  }

  const handleBottomNav = (path: string) => {
    router.push(path)
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
                    <HeroLive2D hero={hero} variant="avatar" side="left" />
                  </div>
                  <div className={styles.deckItemInfo}>
                    <div className={styles.deckItemName}>{deck.name}</div>
                    <div className={styles.deckItemAttr}>
                      <GameIcon name={attributeIcons[hero.attribute]} className={styles.attributeIcon} />
                      {hero.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.mainArea}>
          {/* Live2D Character Background - Positioned on the right */}
          <div className={styles.heroModelContainer}>
            <HeroLive2D
              hero={selectedHero}
              variant="home"
              side="left"
            />
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
                  <div className={styles.detailValue}>{selectedHero.heroArt?.name ?? ''}</div>
                </div>
                <div className={styles.deckStatus}>
                  <div className={styles.statusItem}>
                    <GameIcon name="deck" className={styles.statusIcon} />
                    <span>{selectedDeck.cardIds.length} / 30</span>
                  </div>
                  <div className={styles.statusItem}>
                    <GameIcon name={attributeIcons[selectedHero.attribute]} className={styles.statusIcon} />
                    <span>{selectedHero.attribute.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className={styles.bottomRightButtons}>
                <div className={styles.auxButtons}>
                  <div className={styles.iconButton} onClick={(e) => handleDeleteDeck(e, selectedDeck.id)}>
                    <GameIcon name="trash" className={styles.actionIcon} />
                    TRASH
                  </div>
                  <div className={styles.iconButton} onClick={handleViewDeck}>
                    <GameIcon name="inspect" className={styles.actionIcon} />
                    DECK
                  </div>
                  <div className={styles.iconButton}>
                    <GameIcon name="skin" className={styles.actionIcon} />
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

      {/* Bottom Bar (Shared) */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomNavItem}>
          <GameIcon name="colosseum" className={styles.bottomNavIcon} />
          <span>コロシアム</span>
        </div>
        <div className={styles.bottomNavItem} onClick={() => handleBottomNav('/home')}>
          <GameIcon name="battle" className={styles.bottomNavIcon} />
          <span>バトル</span>
        </div>

        <div className={`${styles.bottomNavItem} active`} onClick={() => handleBottomNav('/cards')}>
          <GameIcon name="cards" className={styles.bottomNavIcon} />
          <span>カード</span>
        </div>
        <div className={styles.bottomNavItem}>
          <GameIcon name="channel" className={styles.bottomNavIcon} />
          <span>TEPPEN Ch.</span>
        </div>
      </div>
    </div>
  )
}
