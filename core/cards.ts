/**
 * CAPCOMキャラクターカード定義
 * CSVファイルから読み込み
 */

import type { CardDefinition, CardAttribute, CardTribe } from './types'
import { loadCardsFromCsv } from './csvLoader'

// CSVファイルのパス（publicディレクトリからの相対パス）
const CSV_FILE_PATH = '/TeppenSort - COR.csv'

// キャッシュされたカードリスト
let cachedCards: CardDefinition[] | null = null
let loadingPromise: Promise<CardDefinition[]> | null = null

/**
 * CSVからカード定義を読み込む（非同期）
 */
export async function createAllCards(): Promise<CardDefinition[]> {
  // キャッシュがあればそれを返す
  if (cachedCards) {
    return cachedCards
  }

  // 既に読み込み中の場合はそのPromiseを返す
  if (loadingPromise) {
    return loadingPromise
  }

  // CSVファイルを読み込む
  loadingPromise = (async () => {
    try {
      const response = await fetch(CSV_FILE_PATH)
      if (!response.ok) {
        console.error('CSVファイルの読み込みに失敗しました')
        cachedCards = getFallbackCards()
        return cachedCards
      }

      const csvText = await response.text()
      const cards = loadCardsFromCsv(csvText)
      cachedCards = cards
      loadingPromise = null
      return cards
    } catch (error) {
      console.error('CSVファイルの読み込み中にエラーが発生しました:', error)
      cachedCards = getFallbackCards()
      loadingPromise = null
      return cachedCards
    }
  })()

  return loadingPromise
}

/**
 * 同期的にカードリストを取得（キャッシュがある場合のみ）
 * 注意: キャッシュがない場合は空配列を返します
 */
export function getCachedCards(): CardDefinition[] {
  return cachedCards || []
}

/**
 * フォールバック用のカード（CSVが読み込めない場合）
 */
function getFallbackCards(): CardDefinition[] {
  // 最小限のフォールバックカード
  return [
    {
      id: 'fallback_1',
      name: 'サンプルカード',
      cost: 2,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'other',
      description: 'フォールバックカード',
      unitStats: { hp: 3, attack: 2, attackInterval: 10000 },
    },
  ]
}

/**
 * カード定義をMapに変換
 */
export function createCardMap(cards: CardDefinition[]): Map<string, CardDefinition> {
  return new Map(cards.map((card) => [card.id, card]))
}

/**
 * サンプルデッキを生成
 */
export function createSampleDeck(): string[] {
  // 簡単なサンプルデッキ（後で拡張）
  return []
}

/**
 * レジェンドカードを1枚まで、通常カードを3枚まで含むデッキを検証
 */
export function validateDeck(
  deck: string[],
  cardMap: Map<string, CardDefinition>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const cardCounts = new Map<string, number>()

  // カードの枚数をカウント
  for (const cardId of deck) {
    const count = cardCounts.get(cardId) || 0
    cardCounts.set(cardId, count + 1)
  }

  // 各カードの制限をチェック
  for (const [cardId, count] of cardCounts.entries()) {
    const card = cardMap.get(cardId)
    if (!card) {
      errors.push(`不明なカード: ${cardId}`)
      continue
    }

    if (card.rarity === 'legend' && count > 1) {
      errors.push(`レジェンドカード「${card.name}」は1枚までです（現在: ${count}枚）`)
    } else if (card.rarity === 'normal' && count > 3) {
      errors.push(`通常カード「${card.name}」は3枚までです（現在: ${count}枚）`)
    }
  }

  // デッキサイズチェック
  if (deck.length !== 30) {
    errors.push(`デッキは30枚である必要があります（現在: ${deck.length}枚）`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * ヒーローとデッキに基づいて最大MPを計算
 */
export function calculateMaxMp(
  heroAttribute: CardAttribute,
  deck: string[],
  cardMap: Map<string, CardDefinition>
): number {
  // デッキ内のユニークな属性を取得
  const deckAttributes = new Set<CardAttribute>()
  for (const cardId of deck) {
    const card = cardMap.get(cardId)
    if (card) {
      deckAttributes.add(card.attribute)
    }
  }

  // ヒーローの属性を含めた合計属性種類
  deckAttributes.add(heroAttribute)
  const attributeCount = deckAttributes.size

  // 最大MPの計算
  if (attributeCount === 1) {
    return 10 // ヒーローとカードの属性が一致
  } else if (attributeCount === 2) {
    return 7 // 2種類
  } else if (attributeCount === 3) {
    return 4 // 3種類
  } else {
    return 4 // 4種類以上
  }
}
