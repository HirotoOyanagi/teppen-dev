import type { CardAttribute, CardTribe } from '@/core/types'

// 属性カラー（hex）- style={{ borderColor: ... }} で使用
export const ATTRIBUTE_COLORS: Record<CardAttribute, string> = {
  red: '#e74c3c',
  green: '#27ae60',
  purple: '#9b59b6',
  black: '#2c3e50',
}

// 属性ラベル（日本語）
export const ATTRIBUTE_LABELS: Record<CardAttribute, string> = {
  red: '赤',
  green: '緑',
  purple: '紫',
  black: '黒',
}

// 属性フィルター用ラベル配列
export const ATTRIBUTE_FILTER_OPTIONS: { key: CardAttribute | 'all'; color: string; label: string }[] = [
  { key: 'all', color: '#888', label: '全' },
  { key: 'red', color: '#e74c3c', label: '赤' },
  { key: 'green', color: '#27ae60', label: '緑' },
  { key: 'purple', color: '#9b59b6', label: '紫' },
  { key: 'black', color: '#2c3e50', label: '黒' },
]

// 種族アイコン
export const TRIBE_ICONS: Record<CardTribe, string> = {
  street_fighter: '👊',
  monster_hunter: '⚔️',
  rockman: '🤖',
  okami: '🐺',
  devil_may_cry: '👿',
  resident_evil: '🧟',
  other: '⭐',
}

// 種族ラベル（日本語）
export const TRIBE_LABELS: Record<CardTribe, string> = {
  street_fighter: 'ストリートファイター',
  monster_hunter: 'モンスターハンター',
  rockman: 'ロックマン',
  okami: '大神',
  devil_may_cry: 'デビルメイクライ',
  resident_evil: 'バイオハザード',
  other: 'その他',
}
