/**
 * CAPCOMキャラクターカード定義
 * 120枚のカードデータ
 */

import type { CardDefinition, CardAttribute, CardTribe, CardRarity } from './types'

// カード属性の配列
const ATTRIBUTES: CardAttribute[] = ['red', 'green', 'purple', 'black']

// 種族の配列
const TRIBES: CardTribe[] = [
  'street_fighter',
  'monster_hunter',
  'rockman',
  'okami',
  'devil_may_cry',
  'resident_evil',
  'other',
]

/**
 * CAPCOMキャラクターカード120枚を作成
 */
export function createAllCards(): CardDefinition[] {
  const cards: CardDefinition[] = []

  // ストリートファイターシリーズ（30枚）
  const streetFighterCards: CardDefinition[] = [
    {
      id: 'sf_ryu_1',
      name: 'リュウ',
      cost: 2,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: '格闘家',
      unitStats: { hp: 3, attack: 2, attackInterval: 10000 },
    },
    {
      id: 'sf_ken_1',
      name: 'ケン',
      cost: 2,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: '格闘家',
      unitStats: { hp: 3, attack: 2, attackInterval: 10000 },
    },
    {
      id: 'sf_chunli_1',
      name: '春麗',
      cost: 3,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: '格闘家',
      unitStats: { hp: 4, attack: 3, attackInterval: 10000 },
    },
    {
      id: 'sf_guile_1',
      name: 'ガイル',
      cost: 3,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: '軍人',
      unitStats: { hp: 5, attack: 2, attackInterval: 10000 },
    },
    {
      id: 'sf_dhalsim_1',
      name: 'ダルシム',
      cost: 4,
      type: 'unit',
      attribute: 'purple',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: 'ヨガマスター',
      unitStats: { hp: 3, attack: 4, attackInterval: 8000 },
    },
    {
      id: 'sf_akuma_legend',
      name: '豪鬼',
      cost: 6,
      type: 'unit',
      attribute: 'black',
      rarity: 'legend',
      tribe: 'street_fighter',
      description: '最強の格闘家',
      unitStats: { hp: 8, attack: 7, attackInterval: 8000 },
    },
    {
      id: 'sf_bison_legend',
      name: 'ベガ',
      cost: 5,
      type: 'unit',
      attribute: 'purple',
      rarity: 'legend',
      tribe: 'street_fighter',
      description: 'シャドルー首領',
      unitStats: { hp: 7, attack: 6, attackInterval: 9000 },
    },
    {
      id: 'sf_zangief_1',
      name: 'ザンギエフ',
      cost: 4,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: 'プロレスラー',
      unitStats: { hp: 8, attack: 3, attackInterval: 10000 },
    },
    {
      id: 'sf_cammy_1',
      name: 'キャミィ',
      cost: 3,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: '特殊工作員',
      unitStats: { hp: 4, attack: 4, attackInterval: 9000 },
    },
    {
      id: 'sf_sagat_1',
      name: 'サガット',
      cost: 4,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: 'タイガーキング',
      unitStats: { hp: 5, attack: 5, attackInterval: 10000 },
    },
    {
      id: 'sf_action_shoryuken',
      name: '昇龍拳',
      cost: 2,
      type: 'action',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: 'ユニットに3ダメージ',
      actionEffect: { type: 'damage', amount: 3, target: 'unit' },
    },
    {
      id: 'sf_action_hadouken',
      name: '波動拳',
      cost: 1,
      type: 'action',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: 'ユニットに2ダメージ',
      actionEffect: { type: 'damage', amount: 2, target: 'unit' },
    },
    {
      id: 'sf_action_spinning',
      name: 'スピニングバードキック',
      cost: 2,
      type: 'action',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'street_fighter',
      description: 'ユニットに2ダメージ、3回復',
      actionEffect: { type: 'damage_heal', damage: 2, heal: 3 },
    },
  ]

  // モンスターハンターシリーズ（25枚）
  const monsterHunterCards: CardDefinition[] = [
    {
      id: 'mh_hunter_1',
      name: 'ハンター',
      cost: 2,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'monster_hunter',
      description: '狩人',
      unitStats: { hp: 4, attack: 2, attackInterval: 10000 },
    },
    {
      id: 'mh_rathalos_1',
      name: 'リオレウス',
      cost: 5,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'monster_hunter',
      description: '火竜',
      unitStats: { hp: 7, attack: 5, attackInterval: 10000 },
    },
    {
      id: 'mh_rathian_1',
      name: 'リオレイア',
      cost: 4,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'monster_hunter',
      description: '雌火竜',
      unitStats: { hp: 6, attack: 4, attackInterval: 10000 },
    },
    {
      id: 'mh_zinogre_legend',
      name: 'ジンオウガ',
      cost: 6,
      type: 'unit',
      attribute: 'purple',
      rarity: 'legend',
      tribe: 'monster_hunter',
      description: '雷狼竜',
      unitStats: { hp: 8, attack: 6, attackInterval: 9000 },
    },
    {
      id: 'mh_brachydios_1',
      name: 'ブラキディオス',
      cost: 5,
      type: 'unit',
      attribute: 'black',
      rarity: 'normal',
      tribe: 'monster_hunter',
      description: '爆破竜',
      unitStats: { hp: 6, attack: 6, attackInterval: 10000 },
    },
    {
      id: 'mh_action_heal',
      name: '回復薬',
      cost: 1,
      type: 'action',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'monster_hunter',
      description: 'ユニットを5回復',
      actionEffect: { type: 'heal', amount: 5, target: 'unit' },
    },
    {
      id: 'mh_action_mega_heal',
      name: '回復薬グレート',
      cost: 2,
      type: 'action',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'monster_hunter',
      description: 'ユニットを全回復',
      actionEffect: { type: 'full_heal', target: 'unit' },
    },
  ]

  // ロックマンシリーズ（20枚）
  const rockmanCards: CardDefinition[] = [
    {
      id: 'rm_rockman_1',
      name: 'ロックマン',
      cost: 2,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'rockman',
      description: 'ロボットヒーロー',
      unitStats: { hp: 3, attack: 3, attackInterval: 9000 },
    },
    {
      id: 'rm_zero_legend',
      name: 'ゼロ',
      cost: 5,
      type: 'unit',
      attribute: 'red',
      rarity: 'legend',
      tribe: 'rockman',
      description: 'レプリロイド',
      unitStats: { hp: 6, attack: 6, attackInterval: 8000 },
    },
    {
      id: 'rm_x_1',
      name: 'エックス',
      cost: 3,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'rockman',
      description: 'ロボット',
      unitStats: { hp: 4, attack: 4, attackInterval: 9000 },
    },
    {
      id: 'rm_action_buster',
      name: 'バスターショット',
      cost: 1,
      type: 'action',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'rockman',
      description: '2ダメージ',
      actionEffect: { type: 'damage', amount: 2, target: 'unit' },
    },
  ]

  // 大神シリーズ（15枚）
  const okamiCards: CardDefinition[] = [
    {
      id: 'ok_amaterasu_legend',
      name: 'アマテラス',
      cost: 7,
      type: 'unit',
      attribute: 'purple',
      rarity: 'legend',
      tribe: 'okami',
      description: '太陽の神',
      unitStats: { hp: 10, attack: 7, attackInterval: 8000 },
    },
    {
      id: 'ok_issun_1',
      name: 'イッスン',
      cost: 1,
      type: 'unit',
      attribute: 'purple',
      rarity: 'normal',
      tribe: 'okami',
      description: '一寸法師',
      unitStats: { hp: 1, attack: 1, attackInterval: 8000 },
    },
    {
      id: 'ok_action_brush',
      name: '筆神',
      cost: 3,
      type: 'action',
      attribute: 'purple',
      rarity: 'normal',
      tribe: 'okami',
      description: '特殊効果',
      actionEffect: { type: 'brush', effect: 'special' },
    },
  ]

  // デビルメイクライシリーズ（20枚）
  const devilMayCryCards: CardDefinition[] = [
    {
      id: 'dmc_dante_legend',
      name: 'ダンテ',
      cost: 6,
      type: 'unit',
      attribute: 'red',
      rarity: 'legend',
      tribe: 'devil_may_cry',
      description: 'デビルハンター',
      unitStats: { hp: 7, attack: 7, attackInterval: 8000 },
    },
    {
      id: 'dmc_vergil_legend',
      name: 'ヴェルギル',
      cost: 6,
      type: 'unit',
      attribute: 'black',
      rarity: 'legend',
      tribe: 'devil_may_cry',
      description: 'ダークナイト',
      unitStats: { hp: 7, attack: 7, attackInterval: 8000 },
    },
    {
      id: 'dmc_nero_1',
      name: 'ネロ',
      cost: 4,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'devil_may_cry',
      description: 'デビルハンター',
      unitStats: { hp: 5, attack: 5, attackInterval: 9000 },
    },
    {
      id: 'dmc_action_rebellion',
      name: 'レベリオン',
      cost: 3,
      type: 'action',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'devil_may_cry',
      description: '4ダメージ',
      actionEffect: { type: 'damage', amount: 4, target: 'unit' },
    },
  ]

  // バイオハザードシリーズ（10枚）
  const residentEvilCards: CardDefinition[] = [
    {
      id: 're_chris_1',
      name: 'クリス',
      cost: 3,
      type: 'unit',
      attribute: 'red',
      rarity: 'normal',
      tribe: 'resident_evil',
      description: 'BSAAエージェント',
      unitStats: { hp: 5, attack: 3, attackInterval: 10000 },
    },
    {
      id: 're_jill_1',
      name: 'ジル',
      cost: 3,
      type: 'unit',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'resident_evil',
      description: 'BSAAエージェント',
      unitStats: { hp: 4, attack: 4, attackInterval: 9000 },
    },
    {
      id: 're_leon_legend',
      name: 'レオン',
      cost: 5,
      type: 'unit',
      attribute: 'black',
      rarity: 'legend',
      tribe: 'resident_evil',
      description: 'エージェント',
      unitStats: { hp: 6, attack: 6, attackInterval: 9000 },
    },
    {
      id: 're_action_herb',
      name: 'ハーブ',
      cost: 2,
      type: 'action',
      attribute: 'green',
      rarity: 'normal',
      tribe: 'resident_evil',
      description: 'HPを5回復',
      actionEffect: { type: 'heal', amount: 5, target: 'hero' },
    },
  ]

  // 120枚を作成するために、各カードを適切な数で複製・追加
  cards.push(...streetFighterCards)
  cards.push(...monsterHunterCards)
  cards.push(...rockmanCards)
  cards.push(...okamiCards)
  cards.push(...devilMayCryCards)
  cards.push(...residentEvilCards)

  // 残りのカードを属性と種族をバランスよく追加
  let cardId = 100
  const attributeWeights: Record<CardAttribute, number> = {
    red: 0.3,
    green: 0.3,
    purple: 0.2,
    black: 0.2,
  }

  while (cards.length < 120) {
    const attribute = getRandomAttribute(attributeWeights)
    const tribe = TRIBES[Math.floor(Math.random() * TRIBES.length)]
    const isLegend = Math.random() < 0.1 // 10%がレジェンド
    const cost = isLegend
      ? Math.floor(Math.random() * 3) + 5 // 5-7
      : Math.floor(Math.random() * 5) + 1 // 1-5
    const isUnit = Math.random() < 0.7 // 70%がユニット

    if (isUnit) {
      const hp = Math.floor(Math.random() * 7) + 2
      const attack = Math.floor(Math.random() * 6) + 1
      cards.push({
        id: `card_${cardId++}`,
        name: `${getCharacterName(tribe)} ${cardId}`,
        cost,
        type: 'unit',
        attribute,
        rarity: isLegend ? 'legend' : 'normal',
        tribe,
        description: getTribeDescription(tribe),
        unitStats: {
          hp,
          attack,
          attackInterval: 10000,
        },
      })
    } else {
      cards.push({
        id: `card_${cardId++}`,
        name: `${getActionName(attribute)}`,
        cost,
        type: 'action',
        attribute,
        rarity: isLegend ? 'legend' : 'normal',
        tribe,
        description: 'アクションカード',
        actionEffect: {
          type: 'damage',
          amount: cost + 1,
          target: 'unit',
        },
      })
    }
  }

  return cards.slice(0, 120)
}

// ランダムに属性を取得（重み付け）
function getRandomAttribute(weights: Record<CardAttribute, number>): CardAttribute {
  const rand = Math.random()
  let sum = 0
  for (const [attr, weight] of Object.entries(weights)) {
    sum += weight
    if (rand < sum) {
      return attr as CardAttribute
    }
  }
  return 'red'
}

function getCharacterName(tribe: CardTribe): string {
  const names: Record<CardTribe, string[]> = {
    street_fighter: ['格闘家', '戦士', 'チャンピオン'],
    monster_hunter: ['ハンター', 'モンスター', '竜'],
    rockman: ['ロボット', 'レプリロイド', 'ヒーロー'],
    okami: ['神', '精霊', '使者'],
    devil_may_cry: ['ハンター', 'デビル', '戦士'],
    resident_evil: ['エージェント', '生存者', '戦士'],
    other: ['戦士', 'ヒーロー', 'キャラクター'],
  }
  const nameList = names[tribe] || names.other
  return nameList[Math.floor(Math.random() * nameList.length)]
}

function getTribeDescription(tribe: CardTribe): string {
  const descriptions: Record<CardTribe, string> = {
    street_fighter: '格闘家',
    monster_hunter: 'ハンター',
    rockman: 'ロボット',
    okami: '神',
    devil_may_cry: 'デビルハンター',
    resident_evil: 'エージェント',
    other: 'キャラクター',
  }
  return descriptions[tribe] || descriptions.other
}

function getActionName(attribute: CardAttribute): string {
  const names: Record<CardAttribute, string[]> = {
    red: ['攻撃', 'パンチ', 'ストライク'],
    green: ['回復', 'ヒール', 'バリア'],
    purple: ['魔法', '呪文', 'エナジー'],
    black: ['ダーク', '暗黒', '破壊'],
  }
  const nameList = names[attribute] || names.red
  return nameList[Math.floor(Math.random() * nameList.length)]
}

/**
 * カード定義をMapに変換
 */
export function createCardMap(
  cards: CardDefinition[]
): Map<string, CardDefinition> {
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
