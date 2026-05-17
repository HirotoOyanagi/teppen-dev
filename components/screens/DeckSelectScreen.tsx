import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useNavigation } from '@/components/NavigationContext'
import { getDecks, type SavedDeck } from '@/utils/deckStorage'
import { HEROES } from '@/core/heroes'
import GameIcon, { type GameIconName } from '@/components/GameIcon'
import HeroLive2D from '@/components/HeroLive2D'
import styles from './DeckSelectScreen.module.css'
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

  let selectedHero = HEROES[0]
  if (selectedDeck) {
    selectedHero = HEROES.find((h) => h.id === selectedDeck.heroId) || HEROES[0]
  }

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

  const attributeIcons: Record<string, GameIconName> = {
    red: 'attr-red',
    green: 'attr-green',
    purple: 'attr-purple',
    black: 'attr-black',
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

  let deckCardCount = 0
  if (selectedDeck) {
    deckCardCount = selectedDeck.cardIds.length
  }

  const canStartBattle = Boolean(selectedDeck) && deckCardCount === 30

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
                      <HeroLive2D hero={hero} variant="avatar" side="left" />
                    </div>
                    <div className={styles.deckItemInfo}>
                      <div className={styles.deckItemName}>{deck.name}</div>
                      <div className={styles.deckItemAttr}>
                        <GameIcon name={attributeIcons[hero.attribute]} className={styles.attributeIcon} />
                        {hero.name}
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
          {/* Live2D Character Background */}
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
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>バトルモード</div>
                  <div className={styles.detailValue}>{selectedBattleModeName}</div>
                </div>
                <div className={styles.deckStatus}>
                  <div className={styles.statusItem}>
                    <GameIcon name="deck" className={styles.statusIcon} />
                    <span style={{ color: deckCardCount === 30 ? '#fff' : '#e74c3c' }}>
                      {deckCardCount} / 30
                    </span>
                  </div>
                  <div className={styles.statusItem}>
                    <GameIcon name={attributeIcons[selectedHero.attribute]} className={styles.statusIcon} />
                    <span>{selectedHero.attribute.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className={styles.bottomRightButtons}>
                <div className={styles.auxButtons}>
                  <div className={styles.iconButton} onClick={handleViewDeck}>
                    <GameIcon name="inspect" className={styles.actionIcon} />
                    DECK
                  </div>
                </div>
                {(() => {
                  const isDisabled = !canStartBattle
                  const disabledClass = ({
                    true: () => styles.disabled,
                    false: () => '',
                  } as const)[String(isDisabled) as 'true' | 'false']()

                  return (
                <button
                  className={`${styles.startButton} ${disabledClass}`}
                  onClick={handleStartBattle}
                  disabled={!canStartBattle}
                >
                  バトル開始
                </button>
                  )
                })()}
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
        <div className={`${styles.bottomNavItem} active`} onClick={() => handleBottomNav('/home')}>
          <GameIcon name="battle" className={styles.bottomNavIcon} />
          <span>バトル</span>
        </div>

        <div className={styles.bottomNavItem} onClick={() => handleBottomNav('/cards')}>
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
