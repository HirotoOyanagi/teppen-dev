import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useNavigation } from '@/components/NavigationContext'
import { getDecks, type SavedDeck } from '@/utils/deckStorage'
import { HEROES } from '@/core/heroes'
import styles from './DeckSelectScreen.module.css'

const HeroModel3D = dynamic(() => import('@/components/HeroModel3D'), { ssr: false })
type BattleEntryMode = 'rank' | 'practice' | 'free' | 'room'

export default function DeckSelectScreen() {
  const router = useRouter()
  const { navigate, goBack } = useNavigation()
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null)
  const battleModeMap: Record<string, BattleEntryMode> = {
    rank: 'rank',
    practice: 'practice',
    free: 'free',
    room: 'room',
  }
  const battleModeNameMap: Record<BattleEntryMode, string> = {
    rank: 'ランクマッチ',
    practice: 'プラクティス（AI対戦）',
    free: 'フリーマッチ',
    room: 'ルームマッチ',
  }
  const battleModeRouteMap: Record<BattleEntryMode, (deckId: string) => string> = {
    rank: (deckId) => `/battle?mode=online&deckId=${deckId}&battleMode=rank`,
    practice: (deckId) => `/battle?mode=offline&deckId=${deckId}&battleMode=practice`,
    free: (deckId) => `/battle?mode=online&deckId=${deckId}&battleMode=free`,
    room: (deckId) => `/battle?mode=online&deckId=${deckId}&battleMode=room`,
  }
  let rawBattleMode = ''
  if (typeof router.query.battleMode === 'string') {
    rawBattleMode = router.query.battleMode
  }
  const selectedBattleMode = battleModeMap[rawBattleMode] ?? 'rank'
  const selectedBattleModeName = battleModeNameMap[selectedBattleMode]

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '818948' },
      body: JSON.stringify({
        sessionId: '818948',
        runId: 'background-debug-1',
        hypothesisId: 'H1_unmount_prev_screen',
        location: 'DeckSelectScreen.tsx:mount',
        message: 'DeckSelectScreen mount',
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
          location: 'DeckSelectScreen.tsx:unmount',
          message: 'DeckSelectScreen unmount',
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
    if (!selectedDeck) return
    if (selectedDeck.cardIds.length !== 30) return

    localStorage.setItem('teppen_selectedDeckId', selectedDeck.id)
    const targetPathBuilder = battleModeRouteMap[selectedBattleMode]
    const targetPath = targetPathBuilder(selectedDeck.id)
    router.push(targetPath)
  }

  const attributeIcons: Record<string, string> = {
    red: '🔥',
    green: '🌿',
    purple: '🔮',
    black: '💀',
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  const handleBottomNav = (path: string) => {
    router.push(path)
  }

  const deckCardCount = selectedDeck ? selectedDeck.cardIds.length : 0
  const canStartBattle = selectedDeck && deckCardCount === 30

  return (
    <div className={styles.container}>
      {/* Background with overlay */}
      <div className={styles.background} />

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => goBack()}>
            BACK
          </button>
          <h1>デッキ選択</h1>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div className={styles.deckList}>
            {decks.length === 0 ? (
              <div className={styles.noDeck}>
                <p>デッキがありません</p>
              </div>
            ) : (
              decks.map((deck) => {
                const hero = HEROES.find((h) => h.id === deck.heroId) || HEROES[0]
                const isSelected = selectedDeck?.id === deck.id
                return (
                  <div
                    key={deck.id}
                    className={`${styles.deckItem} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleDeckSelect(deck)}
                  >
                    <div 
                      className={styles.deckItemHeroPortrait} 
                      style={{ backgroundColor: attributeColors[hero.attribute] }}
                    >
                      <div style={{ fontSize: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        👤
                      </div>
                    </div>
                    <div className={styles.deckItemInfo}>
                      <div className={styles.deckItemName}>{deck.name}</div>
                      <div className={styles.deckItemAttr}>
                        {attributeIcons[hero.attribute]} {hero.name}
                      </div>
                      {deck.cardIds.length !== 30 && (
                        <div className={styles.warning}>※30枚必要です</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className={styles.mainArea}>
          {/* 3D Model Background */}
          <div className={styles.heroModelContainer}>
            {selectedHero.modelUrl && (
              <HeroModel3D 
                modelUrl={selectedHero.modelUrl} 
                variant="home" 
                side="right"
              />
            )}
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
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>バトルモード</div>
                  <div className={styles.detailValue}>{selectedBattleModeName}</div>
                </div>
                <div className={styles.deckStatus}>
                  <div className={styles.statusItem}>
                    <span style={{ color: '#d4af37' }}>📄</span>
                    <span style={{ color: deckCardCount === 30 ? '#fff' : '#e74c3c' }}>
                      {deckCardCount} / 30
                    </span>
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
                  <div className={styles.iconButton} onClick={handleViewDeck}>
                    <span>👁️</span>
                    DECK
                  </div>
                </div>
                <button
                  className={`${styles.startButton} ${!canStartBattle ? styles.disabled : ''}`}
                  onClick={handleStartBattle}
                  disabled={!canStartBattle}
                >
                  バトル開始
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Bar (Shared) */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>🏟️</span>
          <span>コロシアム</span>
        </div>
        <div className={`${styles.bottomNavItem} active`} onClick={() => handleBottomNav('/home')}>
          <span className={styles.bottomNavIcon}>⚔️</span>
          <span>バトル</span>
        </div>
        
        <div className={styles.tournamentButton}>
          <span className={styles.tournamentIcon}>👑</span>
          <span>大会</span>
        </div>

        <div className={styles.bottomNavItem} onClick={() => handleBottomNav('/cards')}>
          <span className={styles.bottomNavIcon}>🃏</span>
          <span>カード</span>
        </div>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>📺</span>
          <span>TEPPEN Ch.</span>
        </div>
      </div>
    </div>
  )
}
