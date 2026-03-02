import { useState, useMemo } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import CardModal from '@/components/CardModal'
import { useCards } from '@/utils/useCards'
import type { CardDefinition, CardAttribute, CardTribe } from '@/core/types'
import styles from './CardListScreen.module.css'

export default function CardListScreen() {
  const { goBack } = useNavigation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedTribe, setSelectedTribe] = useState<CardTribe | 'all'>('all')
  const [selectedCost, setSelectedCost] = useState<number | 'all'>('all')
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
      return true
    })
  }, [allCards, searchTerm, selectedAttribute, selectedTribe, selectedCost])

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
        <div style={{ padding: '20px', textAlign: 'center' }}>カードデータを読み込み中...</div>
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
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="カード名で検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />

        <div className={styles.filterGroup}>
          <label>属性:</label>
          <select
            value={selectedAttribute}
            onChange={(e) => setSelectedAttribute(e.target.value as CardAttribute | 'all')}
            className={styles.filterSelect}
          >
            <option value="all">すべて</option>
            {attributes.map((attr) => (
              <option key={attr} value={attr}>
                {attr === 'red' ? '赤' : attr === 'green' ? '緑' : attr === 'purple' ? '紫' : '黒'}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>種族:</label>
          <select
            value={selectedTribe}
            onChange={(e) => setSelectedTribe(e.target.value as CardTribe | 'all')}
            className={styles.filterSelect}
          >
            <option value="all">すべて</option>
            {tribes.map((tribe) => (
              <option key={tribe} value={tribe}>
                {tribe === 'street_fighter' ? 'ストリートファイター' :
                 tribe === 'monster_hunter' ? 'モンスターハンター' :
                 tribe === 'rockman' ? 'ロックマン' :
                 tribe === 'okami' ? '大神' :
                 tribe === 'devil_may_cry' ? 'デビルメイクライ' :
                 tribe === 'resident_evil' ? 'バイオハザード' : 'その他'}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>コスト:</label>
          <select
            value={selectedCost}
            onChange={(e) => setSelectedCost(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className={styles.filterSelect}
          >
            <option value="all">すべて</option>
            {costs.map((cost) => (
              <option key={cost} value={cost}>
                {cost}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {filteredCards.map((card) => (
          <div
            key={card.id}
            className={styles.cardItem}
            onClick={() => setSelectedCard(card)}
          >
            <div className={styles.cardCost}>{card.cost}</div>
            <div className={styles.cardName}>{card.name}</div>
            {card.unitStats && (
              <div className={styles.cardStats}>
                <span className={styles.attack}>{card.unitStats.attack}</span>
                <span className={styles.hp}>{card.unitStats.hp}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}

      <BottomNavigation />
    </div>
  )
}
