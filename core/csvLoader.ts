/**
 * CSVからカードデータを読み込む
 */

import type { CardDefinition, CardAttribute, CardRarity, CardType } from './types'

interface CsvRow {
  ID: string
  カードパック: string
  カード名: string
  属性: string
  カード種別: string
  レアリティ: string
  コスト: string
  攻撃力: string
  HP: string
  効果: string
}

/**
 * CSV文字列をパース（引用符で囲まれたフィールドに対応）
 */
function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // ヘッダー行を取得
  const headers = parseCsvLine(lines[0])
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // CSVの値をパース
    const values = parseCsvLine(line)

    // 行データを作成
    const row: Partial<CsvRow> = {}
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        row[header as keyof CsvRow] = values[index]
      }
    })

    // 必須フィールドをチェック
    if (row.ID && row.カード名 && row.属性 && row.カード種別) {
      rows.push(row as CsvRow)
    }
  }

  return rows
}

/**
 * CSV行をパース（引用符で囲まれたフィールドに対応）
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされた引用符
        current += '"'
        i++ // 次の文字をスキップ
      } else {
        // 引用符の開始/終了
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // フィールドの区切り
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // 最後のフィールド
  values.push(current.trim())

  return values
}

/**
 * 属性をマッピング
 */
function mapAttribute(attr: string): CardAttribute {
  const attributeMap: Record<string, CardAttribute> = {
    Red: 'red',
    Green: 'green',
    Purple: 'purple',
    Black: 'black',
  }
  return attributeMap[attr] || 'red'
}

/**
 * カード種別をマッピング
 */
function mapCardType(type: string): CardType {
  const typeMap: Record<string, CardType> = {
    'Unit Card': 'unit',
    'Action Card': 'action',
  }
  return typeMap[type] || 'unit'
}

/**
 * レアリティをマッピング
 */
function mapRarity(rarity: string): CardRarity {
  const rarityMap: Record<string, CardRarity> = {
    Common: 'normal',
    Rare: 'normal',
    Epic: 'normal', // Epicも現在はnormalとして扱う（後で拡張可能）
    Legendary: 'legend',
  }
  return rarityMap[rarity] || 'normal'
}

/**
 * 数値をパース（空文字や無効値は0）
 */
function parseNumber(value: string): number {
  const num = parseInt(value, 10)
  return isNaN(num) ? 0 : num
}

/**
 * HTMLエンティティをデコード
 */
function decodeHtmlEntities(text: string): string {
  const entityMap: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
  }

  return text.replace(/&[#\w]+;/g, (entity) => {
    return entityMap[entity] || entity
  })
}

/**
 * 攻撃間隔を計算（HPとコストに基づく）
 */
function calculateAttackInterval(hp: number, cost: number): number {
  // 基本値: 10000ms
  // HPが高いほど遅く、コストが高いほど早く
  const baseInterval = 10000
  const hpModifier = hp * 200 // HPが高いほど遅くなる
  const costModifier = cost * -300 // コストが高いほど早くなる
  return Math.max(5000, Math.min(15000, baseInterval + hpModifier + costModifier))
}

/**
 * CSVからカード定義を生成
 */
export function loadCardsFromCsv(csvText: string): CardDefinition[] {
  const rows = parseCsv(csvText)
  const cards: CardDefinition[] = []

  for (const row of rows) {
    const id = `cor_${row.ID}`
    const name = decodeHtmlEntities(row.カード名)
    const cost = parseNumber(row.コスト)
    const attribute = mapAttribute(row.属性)
    const type = mapCardType(row.カード種別)
    const rarity = mapRarity(row.レアリティ)
    const description = decodeHtmlEntities(row.効果 || '')

    const card: CardDefinition = {
      id,
      name,
      cost,
      type,
      attribute,
      rarity,
      tribe: 'other', // CSVには種族情報がないのでデフォルト
      description,
    }

    // ユニットカードの場合
    if (type === 'unit') {
      const attack = parseNumber(row.攻撃力)
      const hp = parseNumber(row.HP)
      const attackInterval = calculateAttackInterval(hp, cost)

      card.unitStats = {
        hp,
        attack,
        attackInterval,
      }
    } else if (type === 'action') {
      // アクションカードの効果は後でパースする
      card.actionEffect = {
        description,
      }
    }

    cards.push(card)
  }

  return cards
}

/**
 * CSVファイルを読み込む（ブラウザ環境用）
 */
export async function loadCardsFromCsvFile(filePath: string): Promise<CardDefinition[]> {
  try {
    const response = await fetch(filePath)
    const csvText = await response.text()
    return loadCardsFromCsv(csvText)
  } catch (error) {
    console.error('CSVファイルの読み込みに失敗しました:', error)
    return []
  }
}

