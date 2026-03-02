import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import PageHeader from '@/components/ui/PageHeader'
import CardModal from '@/components/CardModal'
import CardListItem from '@/components/ui/CardListItem'
import { useCards } from '@/utils/useCards'
import { useBgm } from '@/utils/useBgm'
import type { CardDefinition, CardAttribute, CardTribe } from '@/core/types'
import { ATTRIBUTE_LABELS, TRIBE_LABELS } from '@/utils/constants'
import styles from './card-list.module.css'

export default function CardListPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedTribe, setSelectedTribe] = useState<CardTribe | 'all'>('all')
  const [selectedCost, setSelectedCost] = useState<number | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  useBgm('/sounds/home.mp3')

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
  const tribes = Object.keys(TRIBE_LABELS) as CardTribe[]
  const costs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '20px', textAlign: 'center' }}>カードデータを読み込み中...</div>
      </div>
    )
  }

  return (
    <PageLayout title="カード一覧">
      <div className={styles.container}>
        <PageHeader title="カード一覧" />

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
                  {ATTRIBUTE_LABELS[attr]}
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
                  {TRIBE_LABELS[tribe]}
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
            <CardListItem
              key={card.id}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>

        {selectedCard && (
          <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}

      </div>
    </PageLayout>
  )
}

