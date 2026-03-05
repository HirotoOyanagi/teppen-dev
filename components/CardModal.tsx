import { useEffect, useCallback } from 'react'
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

const attributeLabels: Record<string, string> = {
  red: '赤',
  green: '緑',
  purple: '紫',
  black: '黒',
}

const tribeLabels: Record<string, string> = {
  street_fighter: 'ストリートファイター',
  monster_hunter: 'モンスターハンター',
  rockman: 'ロックマン',
  okami: '大神',
  devil_may_cry: 'デビルメイクライ',
  resident_evil: 'バイオハザード',
  other: 'その他',
}

const rarityLabels: Record<string, string> = {
  normal: 'ノーマル',
  legend: 'レジェンド',
}

export default function CardModal({ card, onClose }: CardModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    // モーダル表示中は背景スクロールを防止
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  if (!card) return null

  const attrColor = attributeColors[card.attribute] || '#666'

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <div className={styles.cardFrame} style={{ borderColor: attrColor }}>
          {/* カード画像エリア */}
          <div className={styles.imageSection}>
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                className={styles.cardImage}
                draggable={false}
              />
            ) : (
              <div className={styles.imagePlaceholder}>
                <span>{card.name}</span>
              </div>
            )}
            {/* コストバッジ */}
            <div className={styles.costBadge} style={{ borderColor: attrColor }}>
              {card.cost}
            </div>
            {/* レアリティ */}
            {card.rarity === 'legend' && (
              <div className={styles.rarityBadge}>L</div>
            )}
          </div>

          {/* カード情報セクション */}
          <div className={styles.infoSection}>
            {/* カード名 */}
            <h2 className={styles.cardName}>{card.name}</h2>

            {/* ステータスバー */}
            <div className={styles.statBar}>
              <div className={styles.statTag} style={{ background: attrColor }}>
                {attributeLabels[card.attribute]}
              </div>
              <div className={styles.statTag} style={{ background: '#555' }}>
                {card.type === 'unit' ? 'ユニット' : 'アクション'}
              </div>
              <div className={styles.statTag} style={{ background: '#555' }}>
                {rarityLabels[card.rarity] || card.rarity}
              </div>
              <div className={styles.statTag} style={{ background: '#555' }}>
                {tribeLabels[card.tribe] || card.tribe}
              </div>
            </div>

            {/* ユニットステータス */}
            {card.type === 'unit' && card.unitStats && (
              <div className={styles.unitStatsRow}>
                <div className={styles.unitStat}>
                  <span className={styles.unitStatLabel}>ATK</span>
                  <span className={styles.unitStatValueAttack}>{card.unitStats.attack}</span>
                </div>
                <div className={styles.unitStat}>
                  <span className={styles.unitStatLabel}>HP</span>
                  <span className={styles.unitStatValueHp}>{card.unitStats.hp}</span>
                </div>
                <div className={styles.unitStat}>
                  <span className={styles.unitStatLabel}>攻撃間隔</span>
                  <span className={styles.unitStatValueNeutral}>
                    {(card.unitStats.attackInterval / 1000).toFixed(0)}秒
                  </span>
                </div>
                <div className={styles.unitStat}>
                  <span className={styles.unitStatLabel}>コスト</span>
                  <span className={styles.unitStatValueNeutral}>{card.cost}MP</span>
                </div>
              </div>
            )}

            {/* アクションカードのコスト表示 */}
            {card.type === 'action' && (
              <div className={styles.unitStatsRow}>
                <div className={styles.unitStat}>
                  <span className={styles.unitStatLabel}>コスト</span>
                  <span className={styles.unitStatValueNeutral}>{card.cost}MP</span>
                </div>
              </div>
            )}

            {/* 効果テキスト */}
            {card.description && (
              <div className={styles.effectSection}>
                <div className={styles.effectLabel}>効果</div>
                <div className={styles.effectText}>{card.description}</div>
              </div>
            )}

            {/* パースされた効果の詳細 */}
            {card.effects && card.effects.length > 0 && (
              <div className={styles.parsedEffects}>
                <div className={styles.effectLabel}>効果詳細</div>
                {card.effects.map((effect, i) => (
                  <div key={i} className={styles.effectItem}>
                    <span className={styles.effectTrigger}>
                      {formatTrigger(effect.trigger)}
                    </span>
                    <span className={styles.effectType}>
                      {formatEffectType(effect.type)}
                    </span>
                    {effect.value !== undefined && (
                      <span className={styles.effectValue}>{effect.value}</span>
                    )}
                    {'target' in effect && effect.target && (
                      <span className={styles.effectTarget}>
                        → {formatTarget(effect.target as string)}
                      </span>
                    )}
                    {'status' in effect && effect.status && (
                      <span className={styles.effectStatus}>
                        {formatStatus(effect.status as string)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* カードID */}
            <div className={styles.cardIdRow}>
              ID: {card.id}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function formatTrigger(trigger: string): string {
  const map: Record<string, string> = {
    when_played: 'プレイ時',
    attacking: '攻撃時',
    after_attack: '攻撃後',
    death: '破壊時',
    while_on_field: '場にいる間',
    resonate: '共鳴時',
    revenge: '復讐時',
    enter_field: '場に出た時',
    growth: '成長時',
    memory: 'メモリー時',
    quest: 'クエスト時',
    awakening: '目覚め時',
    energy: 'エナジー時',
  }
  return map[trigger] || trigger
}

function formatEffectType(type: string): string {
  const map: Record<string, string> = {
    damage: 'ダメージ',
    heal: '回復',
    buff: 'バフ',
    status: 'ステータス',
    draw: 'ドロー',
    destroy: '破壊',
    mp_gain: 'MP獲得',
    ap_gain: 'AP獲得',
  }
  return map[type] || type
}

function formatTarget(target: string): string {
  const map: Record<string, string> = {
    self: '自身',
    enemy_hero: '敵ヒーロー',
    friendly_hero: '味方ヒーロー',
    random_enemy_unit: '敵ユニット',
    random_friendly_unit: '味方ユニット',
    all_enemy_units: '全敵ユニット',
    all_friendly_units: '全味方ユニット',
    all_units: '全ユニット',
    unit_in_front: '前方ユニット',
  }
  return map[target] || target
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    rush: '俊足',
    flight: '飛行',
    shield: 'シールド',
    agility: '機敏',
    combo: 'コンボ',
    veil: 'ベール',
    crush: 'クラッシュ',
    heavy_pierce: 'ヘビーピアス',
    spillover: 'スピルオーバー',
    halt: '停止',
    seal: '封印',
    anti_air: '対空',
  }
  return map[status] || status
}
