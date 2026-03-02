import { useState, useEffect, useMemo, useCallback, useRef, useTransition, useDeferredValue, memo } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import CardModal from '@/components/CardModal'
import AttributeFilter from '@/components/ui/AttributeFilter'
import { getDeck, saveDeck, updateDeck } from '@/utils/deckStorage'
import { validateDeck, calculateMaxMp } from '@/core/cards'
import { useCards } from '@/utils/useCards'
import type { CardDefinition, CardAttribute } from '@/core/types'
import { HEROES } from '@/core/heroes'
import { ATTRIBUTE_COLORS } from '@/utils/constants'
import styles from './deck-edit.module.css'

// --- メモ化カードプールアイテム ---
const CardPoolItem = memo(function CardPoolItem({
  card,
  count,
  canAdd,
  onAdd,
  onDragStart,
}: {
  card: CardDefinition
  count: number
  canAdd: boolean
  onAdd: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div
      className={`${styles.cardItem} ${!canAdd ? styles.disabled : ''}`}
      onClick={canAdd ? onAdd : undefined}
      draggable={canAdd}
      onDragStart={canAdd ? onDragStart : undefined}
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.name}
          className={styles.cardImage}
          loading="lazy"
          draggable={false}
        />
      )}
      <div className={styles.cardOverlay} />
      <div className={styles.cardCost}>{card.cost}</div>
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{card.name}</div>
        {card.type === 'unit' && card.unitStats && (
          <div className={styles.cardStats}>
            <span>{card.unitStats.attack}</span>
            <span>/</span>
            <span>{card.unitStats.hp}</span>
          </div>
        )}
      </div>
      <div
        className={styles.cardAttrBar}
        style={{ background: ATTRIBUTE_COLORS[card.attribute] }}
      />
      {count > 0 && (
        <div className={styles.cardCountBadge}>x{count}</div>
      )}
    </div>
  )
})

export default function DeckEditPage() {
  const router = useRouter()
  const { id } = router.query
  const [deckName, setDeckName] = useState('新しいデッキ')
  const [selectedHeroId, setSelectedHeroId] = useState(HEROES[0].id)
  const [deckCardIds, setDeckCardIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [, startTransition] = useTransition()

  const { cards: allCards, cardMap, isLoading: cardsLoading } = useCards()
  const deckListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id && typeof id === 'string') {
      const savedDeck = getDeck(id)
      if (savedDeck) {
        setDeckName(savedDeck.name)
        setSelectedHeroId(savedDeck.heroId)
        setDeckCardIds([...savedDeck.cardIds])
      }
    }
  }, [id])

  const selectedHero = HEROES.find((h) => h.id === selectedHeroId) || HEROES[0]

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (searchTerm && !card.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
      if (selectedAttribute !== 'all' && card.attribute !== selectedAttribute) return false
      return true
    })
  }, [allCards, searchTerm, selectedAttribute])

  // 統合: cardCounts + deckCardSummary + ユニット/アクション数を1回のパスで算出
  const deckData = useMemo(() => {
    const counts = new Map<string, number>()
    let unitCount = 0
    let actionCount = 0

    for (const cid of deckCardIds) {
      counts.set(cid, (counts.get(cid) || 0) + 1)
      const card = cardMap.get(cid)
      if (card?.type === 'unit') unitCount++
      else if (card?.type === 'action') actionCount++
    }

    const entries: { card: CardDefinition; count: number }[] = []
    counts.forEach((count, cid) => {
      const card = cardMap.get(cid)
      if (card) entries.push({ card, count })
    })
    entries.sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name))

    return { counts, summary: entries, unitCount, actionCount }
  }, [deckCardIds, cardMap])

  // カードグリッド用: deferred値で更新を遅延させINPを改善
  const deferredCounts = useDeferredValue(deckData.counts)
  const deferredDeckSize = useDeferredValue(deckCardIds.length)

  const maxMp = useMemo(() => {
    return calculateMaxMp(selectedHero.attribute, deckCardIds, cardMap)
  }, [selectedHero.attribute, deckCardIds, cardMap])

  const validation = useMemo(() => {
    return validateDeck(deckCardIds, cardMap)
  }, [deckCardIds, cardMap])

  const handleAddCard = useCallback((card: CardDefinition) => {
    setDeckCardIds((prev) => {
      const counts = new Map<string, number>()
      prev.forEach((cid) => counts.set(cid, (counts.get(cid) || 0) + 1))
      const count = counts.get(card.id) || 0
      const maxCount = card.rarity === 'legend' ? 1 : 3
      if (count < maxCount && prev.length < 30) return [...prev, card.id]
      return prev
    })
  }, [])

  const handleRemoveCard = useCallback((cardId: string) => {
    setDeckCardIds((prev) => {
      const idx = prev.lastIndexOf(cardId)
      if (idx === -1) return prev
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
  }, [])

  const handleSaveDeck = () => {
    if (id && typeof id === 'string') {
      const updated = updateDeck(id, {
        name: deckName,
        heroId: selectedHeroId,
        cardIds: deckCardIds,
      })
      if (updated) {
        alert('デッキを更新しました')
        router.push('/deck-list')
      }
    } else {
      saveDeck({
        name: deckName,
        heroId: selectedHeroId,
        cardIds: deckCardIds,
      })
      alert('デッキを保存しました')
      router.push('/deck-list')
    }
  }

  // --- ドラッグ&ドロップ ---
  const handleDragStart = useCallback((e: React.DragEvent, card: CardDefinition) => {
    e.dataTransfer.setData('text/plain', card.id)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const cardId = e.dataTransfer.getData('text/plain')
    const card = cardMap.get(cardId)
    if (card) handleAddCard(card)
  }, [cardMap, handleAddCard])

  if (cardsLoading) {
    return <div className={styles.loading}>カードデータを読み込み中...</div>
  }

  return (
    <PageLayout title="デッキ編成">
      <div className={styles.container}>
        {/* メインエリア */}
        <div className={styles.main}>
          {/* 左: カードプール */}
          <div className={styles.cardPoolArea}>
            <div className={styles.cardGrid}>
              {filteredCards.map((card) => {
                const count = deferredCounts.get(card.id) || 0
                const maxCount = card.rarity === 'legend' ? 1 : 3
                const canAdd = count < maxCount && deferredDeckSize < 30

                return (
                  <CardPoolItem
                    key={card.id}
                    card={card}
                    count={count}
                    canAdd={canAdd}
                    onAdd={() => handleAddCard(card)}
                    onDragStart={(e) => handleDragStart(e, card)}
                  />
                )
              })}
            </div>
          </div>

          {/* 右: デッキサイドバー */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <select
                value={selectedHeroId}
                onChange={(e) => setSelectedHeroId(e.target.value)}
                className={styles.heroSelect}
              >
                {HEROES.map((hero) => (
                  <option key={hero.id} value={hero.id}>
                    {hero.name} ({hero.attribute})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.sidebarHeader}>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className={styles.deckNameInput}
                placeholder="デッキ名"
              />
            </div>

            {/* デッキカードリスト（ドロップゾーン） */}
            <div
              ref={deckListRef}
              className={`${styles.deckCardList} ${isDragOver ? styles.dropTarget : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {deckData.summary.map(({ card, count }) => (
                <div
                  key={card.id}
                  className={styles.deckCardRow}
                  onClick={() => handleRemoveCard(card.id)}
                >
                  <div
                    className={styles.deckCardAttr}
                    style={{ background: ATTRIBUTE_COLORS[card.attribute] }}
                  />
                  <div className={styles.deckCardCost}>{card.cost}</div>
                  <div className={styles.deckCardName}>{card.name}</div>
                  {count > 1 && (
                    <div className={styles.deckCardQty}>x{count}</div>
                  )}
                </div>
              ))}
            </div>

            {/* バリデーションエラー */}
            {!validation.valid && (
              <div className={styles.validationErrors}>
                {validation.errors.map((err, i) => (
                  <p key={i} className={styles.error}>{err}</p>
                ))}
              </div>
            )}

            {/* デッキ統計 */}
            <div className={styles.deckStats}>
              <span
                className={`${styles.deckCount} ${
                  deckCardIds.length === 30
                    ? styles.full
                    : deckCardIds.length > 30
                      ? styles.over
                      : ''
                }`}
              >
                {deckCardIds.length}/30
              </span>
              <span>U:{deckData.unitCount}</span>
              <span>A:{deckData.actionCount}</span>
              <span>MP:{maxMp}</span>
            </div>

            {/* 保存・戻るボタン */}
            <div className={styles.sidebarButtons}>
              <button
                className={styles.saveButton}
                onClick={handleSaveDeck}
                disabled={deckCardIds.length === 0}
              >
                保存
              </button>
              <button className={styles.quitButton} onClick={() => router.back()}>
                戻る
              </button>
            </div>
          </div>
        </div>

        {/* 下: フィルターバー */}
        <AttributeFilter
          selected={selectedAttribute}
          onChange={setSelectedAttribute}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {selectedCard && (
          <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}

      </div>
    </PageLayout>
  )
}
