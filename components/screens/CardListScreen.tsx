import { useState, useMemo, useCallback, memo } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { useCards } from '@/utils/useCards'
import type { CardDefinition, CardAttribute, CardTribe } from '@/core/types'
import styles from './CardListScreen.module.css'

const ATTR_COLORS: Record<string, string> = {
  red: '#e74c3c',
  green: '#27ae60',
  purple: '#9b59b6',
  black: '#2c3e50',
}

const ATTR_LABELS: Record<string, string> = {
  red: '赤',
  green: '緑',
  purple: '紫',
  black: '黒',
}

const TRIBE_LABELS: Record<string, string> = {
  street_fighter: 'ストリートファイター',
  monster_hunter: 'モンスターハンター',
  rockman: 'ロックマン',
  okami: '大神',
  devil_may_cry: 'デビルメイクライ',
  resident_evil: 'バイオハザード',
  other: 'その他',
}

const RARITY_LABELS: Record<string, string> = {
  normal: 'ノーマル',
  legend: 'レジェンド',
}

// Memoized card tile for card list
const CardListTile = memo(function CardListTile({
  card,
  onSelect,
}: {
  card: CardDefinition
  onSelect: (card: CardDefinition) => void
}) {
  const attrColor = ATTR_COLORS[card.attribute] || '#666'

  return (
    <div
      className={styles.cardItem}
      onClick={() => onSelect(card)}
    >
      {/* Card image */}
      <div className={styles.cardImageWrap}>
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className={styles.cardImage}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className={styles.cardImagePlaceholder} />
        )}
        <div className={styles.cardImageOverlay} />
        {/* Cost badge */}
        <div className={styles.cardCost}>{card.cost}</div>
        {/* Attribute bar */}
        <div className={styles.cardAttrBar} style={{ background: attrColor }} />
        {/* Rarity indicator */}
        {card.rarity === 'legend' && (
          <div className={styles.legendBadge}>L</div>
        )}
      </div>

      {/* Card info */}
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{card.name}</div>
        <div className={styles.cardMeta}>
          <span className={styles.cardType}>
            {card.type === 'unit' ? 'ユニット' : 'アクション'}
          </span>
          <span className={styles.cardAttrLabel} style={{ color: attrColor }}>
            {ATTR_LABELS[card.attribute]}
          </span>
        </div>
        {card.type === 'unit' && card.unitStats && (
          <div className={styles.cardStats}>
            <span className={styles.statAttack}>ATK {card.unitStats.attack}</span>
            <span className={styles.statHp}>HP {card.unitStats.hp}</span>
          </div>
        )}
        {card.description && (
          <div className={styles.cardEffect}>
            {card.description.length > 60
              ? card.description.substring(0, 60) + '...'
              : card.description}
          </div>
        )}
      </div>
    </div>
  )
})

export default function CardListScreen() {
  const { goBack } = useNavigation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedTribe, setSelectedTribe] = useState<CardTribe | 'all'>('all')
  const [selectedCost, setSelectedCost] = useState<number | 'all'>('all')
  const [selectedType, setSelectedType] = useState<'all' | 'unit' | 'action'>('all')
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
      if (selectedTribe !== 'all' && card.tribe !== selectedTribe) {
        return false
      }
      if (selectedCost !== 'all' && card.cost !== selectedCost) {
        return false
      }
      if (selectedType !== 'all' && card.type !== selectedType) {
        return false
      }
      return true
    })
  }, [allCards, searchTerm, selectedAttribute, selectedTribe, selectedCost, selectedType])

  const handleSelectCard = useCallback((card: CardDefinition) => {
    setSelectedCard(card)
  }, [])

  const attributes: CardAttribute[] = ['red', 'green', 'purple', 'black']
  const tribes: CardTribe[] = [
    'street_fighter',
    'monster_hunter',
    'rockman',
    'okami',
    'devil_may_cry',
    'resident_evil',
    'other',
  ]
  const costs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>カードデータを読み込み中...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => goBack()}>
          ← 戻る
        </button>
        <h1>カード一覧</h1>
        <span className={styles.cardCount}>{filteredCards.length}枚</span>
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="カード名で検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />

        <div className={styles.filterRow}>
          {/* Attribute filter chips */}
          <div className={styles.attrChips}>
            <div
              className={`${styles.attrChip} ${selectedAttribute === 'all' ? styles.attrChipActive : ''}`}
              style={{ background: '#555' }}
              onClick={() => setSelectedAttribute('all')}
            >
              全
            </div>
            {attributes.map((attr) => (
              <div
                key={attr}
                className={`${styles.attrChip} ${selectedAttribute === attr ? styles.attrChipActive : ''}`}
                style={{ background: ATTR_COLORS[attr] }}
                onClick={() => setSelectedAttribute(attr)}
              >
                {ATTR_LABELS[attr]}
              </div>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as 'all' | 'unit' | 'action')}
            className={styles.filterSelect}
          >
            <option value="all">全種別</option>
            <option value="unit">ユニット</option>
            <option value="action">アクション</option>
          </select>

          {/* Cost filter */}
          <select
            value={selectedCost}
            onChange={(e) => setSelectedCost(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className={styles.filterSelect}
          >
            <option value="all">全コスト</option>
            {costs.map((cost) => (
              <option key={cost} value={cost}>
                {cost}MP
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {filteredCards.map((card) => (
          <CardListTile
            key={card.id}
            card={card}
            onSelect={handleSelectCard}
          />
        ))}
        {filteredCards.length === 0 && (
          <div className={styles.emptyState}>
            条件に一致するカードがありません
          </div>
        )}
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}

      <BottomNavigation />
    </div>
  )
}
