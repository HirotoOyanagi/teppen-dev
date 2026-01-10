import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { getDeck, saveDeck, updateDeck, type SavedDeck } from '@/utils/deckStorage'
import { validateDeck, calculateMaxMp } from '@/core/cards'
import { useCards } from '@/utils/useCards'
import type { CardDefinition, Hero, CardAttribute } from '@/core/types'
import styles from './deck-edit.module.css'

const SAMPLE_HEROES: Hero[] = [
  { id: 'hero_red_1', name: 'リュウ', attribute: 'red', description: '格闘家' },
  { id: 'hero_green_1', name: '春麗', attribute: 'green', description: '格闘家' },
  { id: 'hero_purple_1', name: 'ダルシム', attribute: 'purple', description: 'ヨガマスター' },
  { id: 'hero_black_1', name: '豪鬼', attribute: 'black', description: '最強の格闘家' },
]

export default function DeckEditPage() {
  const router = useRouter()
  const { id } = router.query
  const [deckName, setDeckName] = useState('新しいデッキ')
  const [selectedHeroId, setSelectedHeroId] = useState(SAMPLE_HEROES[0].id)
  const [deckCardIds, setDeckCardIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  const [bgm, setBgm] = useState<HTMLAudioElement | null>(null)

  const { cards: allCards, cardMap, isLoading: cardsLoading } = useCards()

  useEffect(() => {
    if (id && typeof id === 'string') {
      const savedDeck = getDeck(id)
      if (savedDeck) {
        setDeckName(savedDeck.name)
        setSelectedHeroId(savedDeck.heroId)
        setDeckCardIds([...savedDeck.cardIds])
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

  const selectedHero = SAMPLE_HEROES.find((h) => h.id === selectedHeroId) || SAMPLE_HEROES[0]

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (searchTerm && !card.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      if (selectedAttribute !== 'all' && card.attribute !== selectedAttribute) {
        return false
      }
      return true
    })
  }, [allCards, searchTerm, selectedAttribute])

  const deckCards = useMemo(() => {
    interface DeckCard extends CardDefinition {
      originalIndex: number
    }
    const cards: DeckCard[] = []
    deckCardIds.forEach((cardId, index) => {
      const card = cardMap.get(cardId)
      if (card) {
        cards.push({ ...card, originalIndex: index })
      }
    })
    return cards
  }, [deckCardIds, cardMap])

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>()
    deckCardIds.forEach((cardId) => {
      counts.set(cardId, (counts.get(cardId) || 0) + 1)
    })
    return counts
  }, [deckCardIds])

  const maxMp = useMemo(() => {
    return calculateMaxMp(selectedHero.attribute, deckCardIds, cardMap)
  }, [selectedHero.attribute, deckCardIds, cardMap])

  const validation = useMemo(() => {
    return validateDeck(deckCardIds, cardMap)
  }, [deckCardIds, cardMap])

  const handleAddCard = (card: CardDefinition) => {
    const count = cardCounts.get(card.id) || 0
    const maxCount = card.rarity === 'legend' ? 1 : 3

    if (count < maxCount && deckCardIds.length < 30) {
      setDeckCardIds([...deckCardIds, card.id])
    }
  }

  const handleRemoveCard = (index: number) => {
    const newDeck = [...deckCardIds]
    newDeck.splice(index, 1)
    setDeckCardIds(newDeck)
  }

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
      const newDeck = saveDeck({
        name: deckName,
        heroId: selectedHeroId,
        cardIds: deckCardIds,
      })
      alert('デッキを保存しました')
      router.push('/deck-list')
    }
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  if (cardsLoading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '20px', textAlign: 'center' }}>カードデータを読み込み中...</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>TEPPEN - デッキ編成</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.back()}>
            ← 戻る
          </button>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className={styles.deckNameInput}
          />
        </div>

        <div className={styles.heroSection}>
          <div
            className={styles.heroCard}
            style={{ borderColor: attributeColors[selectedHero.attribute] }}
          >
            <h3>{selectedHero.name}</h3>
            <select
              value={selectedHeroId}
              onChange={(e) => setSelectedHeroId(e.target.value)}
              className={styles.heroSelect}
            >
              {SAMPLE_HEROES.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  {hero.name} ({hero.attribute})
                </option>
              ))}
            </select>
            <p>最大MP: {maxMp}</p>
          </div>
          <div className={styles.deckInfo}>
            <p>デッキ: {deckCardIds.length}/30枚</p>
            {!validation.valid && (
              <div className={styles.validationErrors}>
                {validation.errors.map((error, i) => (
                  <p key={i} className={styles.error}>{error}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.deckArea}>
          <h3>デッキ ({deckCardIds.length}/30)</h3>
          <div className={styles.deckCards}>
            {deckCards.map((card) => (
              <div
                key={`${card.id}-${card.originalIndex}`}
                className={styles.deckCardItem}
                onClick={() => handleRemoveCard(card.originalIndex)}
              >
                <div className={styles.cardCost}>{card.cost}</div>
                <div className={styles.cardName}>{card.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.filters}>
          <input
            type="text"
            placeholder="カード名で検索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={selectedAttribute}
            onChange={(e) => setSelectedAttribute(e.target.value as CardAttribute | 'all')}
            className={styles.filterSelect}
          >
            <option value="all">すべての属性</option>
            <option value="red">赤</option>
            <option value="green">緑</option>
            <option value="purple">紫</option>
            <option value="black">黒</option>
          </select>
        </div>

        <div className={styles.cardPool}>
          <h3>カードプール</h3>
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
                >
                  <div className={styles.cardCost}>{card.cost}</div>
                  <div className={styles.cardName}>{card.name}</div>
                  {count > 0 && (
                    <div className={styles.cardCount}>
                      {count}/{maxCount}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <button
          className={styles.saveButton}
          onClick={handleSaveDeck}
          disabled={deckCardIds.length === 0}
        >
          デッキを保存
        </button>

        {selectedCard && (
          <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}

        <BottomNavigation />
      </div>
    </>
  )
}

