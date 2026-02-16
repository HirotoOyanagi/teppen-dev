import { useEffect } from 'react'
import type { CardDefinition } from '@/core/types'
import styles from './CardModal.module.css'

interface CardModalProps {
  card: CardDefinition | null
  onClose: () => void
}

const attributeColors: Record<string, string> = {
  red: '#e74c3c',
  green: '#27ae60',
  purple: '#9b59b6',
  black: '#2c3e50',
}

const tribeIcons: Record<string, string> = {
  street_fighter: '👊',
  monster_hunter: '⚔️',
  rockman: '🤖',
  okami: '🐺',
  devil_may_cry: '👿',
  resident_evil: '🧟',
  other: '⭐',
}

export default function CardModal({ card, onClose }: CardModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!card) return null

  const attributeColor = attributeColors[card.attribute] || '#666'
  const tribeIcon = tribeIcons[card.tribe] || '⭐'

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        <div
          className={styles.card}
          style={{ borderColor: attributeColor, borderWidth: '4px' }}
        >
          <div className={styles.cardHeader}>
            <div
              className={styles.cost}
              style={{ backgroundColor: attributeColor }}
            >
              {card.cost}
            </div>
            <div className={styles.tribe}>{tribeIcon}</div>
          </div>
          <div className={styles.cardCenter}>
            <div className={styles.cardImage}>
              {/* カードの絵のプレースホルダー */}
              <div className={styles.imagePlaceholder}>
                {card.name}
              </div>
            </div>
          </div>
          <div className={styles.cardFooter}>
            <h3 className={styles.cardName}>{card.name}</h3>
            <p className={styles.cardDescription}>{card.description || ''}</p>
            {card.unitStats && (
              <div className={styles.unitStats}>
                <span className={styles.attack} style={{ color: '#e74c3c' }}>
                  攻撃: {card.unitStats.attack}
                </span>
                <span className={styles.hp} style={{ color: '#3498db' }}>
                  HP: {card.unitStats.hp}
                </span>
              </div>
            )}
            {card.actionEffect && (
              <div className={styles.actionEffect}>
                <p>効果: {JSON.stringify(card.actionEffect)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}





