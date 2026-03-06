import { useState, useMemo } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { useCards } from '@/utils/useCards'
import type { CardDefinition, CardAttribute } from '@/core/types'
import styles from './CardListScreen.module.css'

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

export default function CardListScreen() {
  const { goBack } = useNavigation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)

  const { cards: allCards, isLoading } = useCards()

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

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>カードデータを読み込み中...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* カードグリッド */}
      <div className={styles.cardGrid}>
        {filteredCards.map((card) => (
          <div
            key={card.id}
            className={styles.cardItem}
            onClick={() => setSelectedCard(card)}
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
              style={{ background: ATTR_COLORS[card.attribute] }}
            />
            {card.rarity === 'legend' && (
              <div className={styles.legendMark}>&#9733;</div>
            )}
          </div>
        ))}
      </div>

      {/* フィルターバー */}
      <div className={styles.filterBar}>
        <button className={styles.backButton} onClick={() => goBack()}>
          ←
        </button>
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
  )
}
