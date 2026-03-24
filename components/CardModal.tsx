import { useEffect } from 'react'
import type { CardDefinition } from '@/core/types'
import styles from './CardModal.module.css'

interface CardModalProps {
  card: CardDefinition | null
  onClose: () => void
  onPrevCard?: () => void
  onNextCard?: () => void
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
  other: '-',
}

const typeLabels: Record<string, string> = {
  unit: 'ユニット',
  action: 'アクション',
  hero_art: 'ヒーローアーツ',
}

// キーワード効果のハイライト用
const KEYWORD_PATTERNS: Record<string, string> = {
  rush: 'ラッシュ',
  flight: 'フライト',
  shield: 'シールド',
  agility: '俊敏',
  veil: 'ヴェール',
  combo: 'コンボ',
  heavy_pierce: 'ヘビーピアス',
  anti_air: '対空',
  mp_boost: 'MPブースト',
  revenge: 'リベンジ',
}

const KEYWORD_ENGLISH: Record<string, string> = {
  '<Rush>': 'ラッシュ',
  '<Flight>': 'フライト',
  '<Shield>': 'シールド',
  '<Agility>': '俊敏',
  '<Veil>': 'ヴェール',
  '<Combo>': 'コンボ',
  '<Heavy Pierce>': 'ヘビーピアス',
  '<Anti-Air>': '対空',
}

// 効果テキストからキーワードを検出してハイライトする
function highlightKeywords(text: string): { segments: { text: string; isKeyword: boolean }[] } {
  const segments: { text: string; isKeyword: boolean }[] = []

  // キーワードパターン（日本語）
  const jpKeywords = ['ファンファーレ', 'ラストワード', 'ラッシュ', 'フライト', 'シールド',
    '俊敏', 'ヴェール', 'コンボ', 'ヘビーピアス', '対空', 'MPブースト', 'リベンジ',
    '探索', '呼応', '撃破', '目覚め', '解放', '成長', 'メモリー', 'エナジー', 'クエスト']

  // Build regex pattern
  const pattern = jpKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'g')

  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isKeyword: false })
    }
    segments.push({ text: match[0], isKeyword: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isKeyword: false })
  }

  if (segments.length === 0) {
    segments.push({ text, isKeyword: false })
  }

  return { segments }
}

export default function CardModal({ card, onClose, onPrevCard, onNextCard }: CardModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      const keyActionMap: Record<string, () => void> = {
        Escape: onClose,
      }

      if (onPrevCard) {
        keyActionMap.ArrowLeft = onPrevCard
      }
      if (onNextCard) {
        keyActionMap.ArrowRight = onNextCard
      }

      const action = keyActionMap[e.key]
      if (action) {
        action()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, onPrevCard, onNextCard])

  if (!card) return null

  const attributeColor = attributeColors[card.attribute] || '#666'
  const attributeLabel = attributeLabels[card.attribute] || card.attribute
  const tribeLabel = tribeLabels[card.tribe] || '-'
  const typeLabel = typeLabels[card.type] || card.type

  const descriptionSegments = card.description
    ? highlightKeywords(card.description).segments
    : []

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        {/* ヘッダー */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>カード詳細</span>
          <div className={styles.navButtons}>
            <button className={styles.navButton} onClick={onPrevCard} disabled={!onPrevCard} aria-label="前のカード">
              ←
            </button>
            <button className={styles.navButton} onClick={onNextCard} disabled={!onNextCard} aria-label="次のカード">
              →
            </button>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* メインコンテンツ */}
        <div className={styles.content}>
          {/* 左: カード表示 */}
          <div className={styles.cardSide}>
            <div className={styles.cardFrame} style={{ borderColor: attributeColor }}>
              {/* コストバッジ */}
              <div className={styles.costBadge}>
                <svg viewBox="0 0 36 36" className={styles.costSvg}>
                  <circle cx="18" cy="18" r="16" fill="rgba(30,130,50,0.9)" stroke="rgba(60,200,80,0.95)" strokeWidth="2" />
                </svg>
                <span className={styles.costText}>{card.cost}</span>
              </div>

              {/* カード画像 */}
              <div className={styles.cardImageArea}>
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.name} className={styles.cardImage} />
                ) : (
                  <div className={styles.cardImagePlaceholder}>
                    <span>{card.name}</span>
                  </div>
                )}
                <div className={styles.cardImageOverlay} />
              </div>

              {/* カード名 */}
              <div className={styles.cardNameBar}>
                <span>{card.name}</span>
              </div>

              {/* ユニットスタッツ */}
              {card.type === 'unit' && card.unitStats && (
                <>
                  {/* 攻撃力 - 左下 */}
                  <div className={styles.attackBadge}>
                    <svg viewBox="0 0 40 40" className={styles.statSvg}>
                      <path d="M20 2L38 20L20 38L2 20Z" fill="rgba(160,30,30,0.9)" stroke="rgba(220,60,60,0.95)" strokeWidth="2" />
                    </svg>
                    <span className={styles.statText}>{card.unitStats.attack}</span>
                  </div>
                  {/* HP - 右下 */}
                  <div className={styles.hpBadge}>
                    <svg viewBox="0 0 36 42" className={styles.hpSvg}>
                      <path d="M18 2L3 10V22C3 31 18 39 18 39C18 39 33 31 33 22V10L18 2Z" fill="rgba(25,70,170,0.9)" stroke="rgba(80,160,255,0.95)" strokeWidth="2" />
                    </svg>
                    <span className={styles.statText}>{card.unitStats.hp}</span>
                  </div>
                </>
              )}

              {/* アクションカードラベル */}
              {card.type === 'action' && (
                <div className={styles.actionLabel}>ACTION</div>
              )}
            </div>
          </div>

          {/* 右: カード情報 */}
          <div className={styles.infoSide}>
            {/* 基本情報 */}
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>名前</span>
              <span className={styles.infoValue}>{card.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>クラス</span>
              <span className={styles.infoValue} style={{ color: attributeColor }}>{attributeLabel}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>タイプ</span>
              <span className={styles.infoValue}>{typeLabel}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>種族</span>
              <span className={styles.infoValue}>{tribeLabel}</span>
            </div>
            {card.rarity === 'legend' && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>レアリティ</span>
                <span className={styles.legendBadge}>LEGEND</span>
              </div>
            )}

            {/* スタッツ */}
            {card.type === 'unit' && card.unitStats && (
              <div className={styles.statsSection}>
                <div className={styles.statsRow}>
                  <span className={styles.statsIcon} style={{ color: '#e74c3c' }}>&#9876;</span>
                  <span className={styles.statsLabel}>攻撃力</span>
                  <span className={styles.statsValue}>{card.unitStats.attack}</span>
                </div>
                <div className={styles.statsRow}>
                  <span className={styles.statsIcon} style={{ color: '#3498db' }}>&#9829;</span>
                  <span className={styles.statsLabel}>HP</span>
                  <span className={styles.statsValue}>{card.unitStats.hp}</span>
                </div>
              </div>
            )}

            {/* 効果テキスト */}
            <div className={styles.descriptionSection}>
              {descriptionSegments.length > 0 ? (
                <p className={styles.descriptionText}>
                  {descriptionSegments.map((seg, i) => (
                    seg.isKeyword ? (
                      <span key={i} className={styles.keyword}>{seg.text}</span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  ))}
                </p>
              ) : (
                <p className={styles.descriptionEmpty}>効果テキストなし</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
