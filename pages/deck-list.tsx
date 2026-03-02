import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import DeckListItem from '@/components/ui/DeckListItem'
import EmptyState from '@/components/ui/EmptyState'
import { getDecks, deleteDeck, type SavedDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { HEROES } from '@/core/heroes'
import { ATTRIBUTE_COLORS, ATTRIBUTE_LABELS } from '@/utils/constants'
import styles from './deck-list.module.css'

export default function DeckListPage() {
  const router = useRouter()
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
    : null

  const deckStats = useMemo(() => {
    if (!selectedDeck) return { unitCount: 0, actionCount: 0 }
    let unitCount = 0
    let actionCount = 0
    selectedDeck.cardIds.forEach((id) => {
      const card = cardMap.get(id)
      if (card?.type === 'unit') unitCount++
      else if (card?.type === 'action') actionCount++
    })
    return { unitCount, actionCount }
  }, [selectedDeck, cardMap])

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

  const getHeroForDeck = (deck: SavedDeck) =>
    HEROES.find((h) => h.id === deck.heroId) || HEROES[0]

  return (
    <PageLayout title="デッキ編成">
      <div className={styles.container}>
        <div className={styles.content}>
          {/* 左: デッキ一覧 */}
          <div className={styles.leftPanel}>
            <div className={styles.panelHeader}>
              <h2>デッキ一覧</h2>
              <span className={styles.deckCount}>{decks.length}/20</span>
            </div>
            <div className={styles.deckList}>
              {decks.map((deck) => (
                <DeckListItem
                  key={deck.id}
                  deck={deck}
                  hero={getHeroForDeck(deck)}
                  isSelected={selectedDeck?.id === deck.id}
                  onClick={() => setSelectedDeck(deck)}
                />
              ))}
            </div>
            <button
              className={styles.newDeckButton}
              onClick={() => router.push('/deck-edit')}
            >
              + 新しいデッキを作成
            </button>
          </div>

          {/* 右: デッキ詳細 */}
          <div className={styles.rightPanel}>
            {selectedDeck && selectedHero ? (
              <>
                {/* ヒーロー表示エリア */}
                <div
                  className={styles.heroArea}
                  style={{
                    borderColor: ATTRIBUTE_COLORS[selectedHero.attribute],
                    background: `linear-gradient(135deg, ${ATTRIBUTE_COLORS[selectedHero.attribute]}15 0%, transparent 60%)`,
                  }}
                >
                  <div className={styles.heroPortrait} style={{ background: ATTRIBUTE_COLORS[selectedHero.attribute] }}>
                    <span className={styles.heroInitial}>{selectedHero.name.charAt(0)}</span>
                  </div>
                  <div className={styles.heroInfo}>
                    <div className={styles.heroAttrBadge} style={{ background: ATTRIBUTE_COLORS[selectedHero.attribute] }}>
                      {ATTRIBUTE_LABELS[selectedHero.attribute]}
                    </div>
                    <h2 className={styles.heroName}>{selectedHero.name}</h2>
                    <p className={styles.deckTitle}>{selectedDeck.name}</p>
                  </div>
                </div>

                {/* ヒーローアート＆コンパニオン */}
                <div className={styles.abilitiesRow}>
                  {selectedHero.heroArt && (
                    <div className={styles.abilityCard}>
                      <div className={styles.abilityHeader}>
                        <span className={styles.abilityType}>HERO ART</span>
                        <span className={styles.abilityCost}>AP {selectedHero.heroArt.cost}</span>
                      </div>
                      <div className={styles.abilityName}>{selectedHero.heroArt.name}</div>
                      <div className={styles.abilityDesc}>{selectedHero.heroArt.description}</div>
                    </div>
                  )}
                  {selectedHero.companion && (
                    <div className={styles.abilityCard}>
                      <div className={styles.abilityHeader}>
                        <span className={styles.abilityType}>COMPANION</span>
                        <span className={styles.abilityCost}>AP {selectedHero.companion.cost}</span>
                      </div>
                      <div className={styles.abilityName}>{selectedHero.companion.name}</div>
                      <div className={styles.abilityDesc}>{selectedHero.companion.description}</div>
                    </div>
                  )}
                </div>

                {/* デッキ統計 */}
                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>カード</span>
                    <span className={`${styles.statValue} ${selectedDeck.cardIds.length === 30 ? styles.statFull : styles.statWarn}`}>
                      {selectedDeck.cardIds.length}/30
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>ユニット</span>
                    <span className={styles.statValue}>{deckStats.unitCount}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>アクション</span>
                    <span className={styles.statValue}>{deckStats.actionCount}</span>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className={styles.actionRow}>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteDeck(selectedDeck.id)}
                    title="デッキ削除"
                  >
                    🗑
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => router.push(`/deck-view?id=${selectedDeck.id}`)}
                  >
                    デッキ確認
                  </button>
                  <button
                    className={styles.actionBtnPrimary}
                    onClick={() => router.push(`/deck-edit?id=${selectedDeck.id}`)}
                  >
                    デッキ編成
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.emptyDetail}>
                <EmptyState
                  message="デッキがありません"
                  actionLabel="新しいデッキを作成"
                  onAction={() => router.push('/deck-edit')}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
