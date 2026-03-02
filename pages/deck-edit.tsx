import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { getDeck, saveDeck, updateDeck } from '@/utils/deckStorage'
import { validateDeck, calculateMaxMp } from '@/core/cards'
import { useCards } from '@/utils/useCards'
import type { CardDefinition, CardAttribute } from '@/core/types'
import { HEROES } from '@/core/heroes'
import styles from './deck-edit.module.css'

const ATTR_COLORS: Record<string, string> = {
  red: '#e74c3c',
  green: '#27ae60',
  purple: '#9b59b6',
  black: '#2c3e50',
}

const ATTR_LABELS: { key: CardAttribute | 'all'; color: string; label: string }[] = [
  { key: 'all', color: '#888', label: '全' },
  { key: 'red', color: '#e74c3c', label: '赤' },
  { key: 'green', color: '#27ae60', label: '緑' },
  { key: 'purple', color: '#9b59b6', label: '紫' },
  { key: 'black', color: '#2c3e50', label: '黒' },
]

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

  // デッキ内カードを集計（コスト順ソート）
  const deckCardSummary = useMemo(() => {
    const counts = new Map<string, number>()
    deckCardIds.forEach((cid) => counts.set(cid, (counts.get(cid) || 0) + 1))
    const entries: { card: CardDefinition; count: number }[] = []
    counts.forEach((count, cid) => {
      const card = cardMap.get(cid)
      if (card) entries.push({ card, count })
    })
    entries.sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name))
    return entries
  }, [deckCardIds, cardMap])

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>()
    deckCardIds.forEach((cid) => counts.set(cid, (counts.get(cid) || 0) + 1))
    return counts
  }, [deckCardIds])

  const deckUnitCount = useMemo(() => {
    return deckCardIds.filter((cid) => cardMap.get(cid)?.type === 'unit').length
  }, [deckCardIds, cardMap])

  const deckActionCount = useMemo(() => {
    return deckCardIds.filter((cid) => cardMap.get(cid)?.type === 'action').length
  }, [deckCardIds, cardMap])

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
  const handleDragStart = (e: React.DragEvent, card: CardDefinition) => {
    e.dataTransfer.setData('text/plain', card.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const cardId = e.dataTransfer.getData('text/plain')
    const card = cardMap.get(cardId)
    if (card) handleAddCard(card)
  }

  if (cardsLoading) {
    return <div className={styles.loading}>カードデータを読み込み中...</div>
  }

  return (
    <>
      <Head>
        <title>TEPPEN - デッキ編成</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div className={styles.container}>
        {/* メインエリア */}
        <div className={styles.main}>
          {/* 左: カードプール */}
          <div className={styles.cardPoolArea}>
            <div className={styles.cardGrid}>
              {filteredCards.map((card) => {
                const count = cardCounts.get(card.id) || 0
                const maxCount = card.rarity === 'legend' ? 1 : 3
                const canAdd = count < maxCount && deckCardIds.length < 30

                return (
                  <div
                    key={card.id}
                    className={`${styles.cardItem} ${!canAdd ? styles.disabled : ''}`}
                    onClick={() => canAdd && handleAddCard(card)}
                    draggable={canAdd}
                    onDragStart={(e) => canAdd && handleDragStart(e, card)}
                  >
                    <div className={styles.cardItemInner}>
                      <div
                        className={styles.cardColorBar}
                        style={{ background: ATTR_COLORS[card.attribute] }}
                      />
                      <div className={styles.cardBody}>
                        <div className={styles.cardTopRow}>
                          <div className={styles.cardCost}>{card.cost}</div>
                          <div className={styles.cardName}>{card.name}</div>
                        </div>
                        {card.type === 'unit' && card.unitStats && (
                          <div className={styles.cardStats}>
                            <span>ATK {card.unitStats.attack}</span>
                            <span>HP {card.unitStats.hp}</span>
                          </div>
                        )}
                        <div className={styles.cardType}>
                          {card.type === 'unit' ? 'ユニット' : 'アクション'}
                        </div>
                      </div>
                    </div>
                    {count > 0 && (
                      <div className={styles.cardCountBadge}>x{count}</div>
                    )}
                  </div>
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
              {deckCardSummary.map(({ card, count }) => (
                <div
                  key={card.id}
                  className={styles.deckCardRow}
                  onClick={() => handleRemoveCard(card.id)}
                >
                  <div
                    className={styles.deckCardAttr}
                    style={{ background: ATTR_COLORS[card.attribute] }}
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
              <span>U:{deckUnitCount}</span>
              <span>A:{deckActionCount}</span>
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
        <div className={styles.filterBar}>
          {ATTR_LABELS.map(({ key, color, label }) => (
            <div
              key={key}
              className={`${styles.attrChip} ${selectedAttribute === key ? styles.active : ''}`}
              style={{ background: color }}
              onClick={() => setSelectedAttribute(key)}
            >
              {label}
            </div>
          ))}
          <input
            type="text"
            placeholder="カード名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {selectedCard && (
          <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}

        <BottomNavigation />
      </div>
    </>
  )
}
