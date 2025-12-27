/**
 * サンプルカード定義
 */

import type { CardDefinition } from './types'

export const SAMPLE_CARDS: CardDefinition[] = [
  // ユニットカード
  {
    id: 'unit_001',
    name: '戦士',
    cost: 2,
    type: 'unit',
    unitStats: {
      hp: 3,
      attack: 2,
      attackInterval: 10000, // 10秒
      lane: 0,
    },
  },
  {
    id: 'unit_002',
    name: '騎士',
    cost: 3,
    type: 'unit',
    unitStats: {
      hp: 5,
      attack: 3,
      attackInterval: 10000, // 10秒
      lane: 0,
    },
  },
  {
    id: 'unit_003',
    name: 'アーチャー',
    cost: 2,
    type: 'unit',
    unitStats: {
      hp: 2,
      attack: 3,
      attackInterval: 10000, // 10秒
      lane: 0,
    },
  },
  {
    id: 'unit_004',
    name: '重装兵',
    cost: 4,
    type: 'unit',
    unitStats: {
      hp: 8,
      attack: 2,
      attackInterval: 10000, // 10秒
      lane: 0,
    },
  },
  // アクションカード
  {
    id: 'action_001',
    name: 'ダメージ',
    cost: 1,
    type: 'action',
    actionEffect: {
      type: 'damage',
      amount: 2,
      target: 'unit',
    },
  },
  {
    id: 'action_002',
    name: '回復',
    cost: 2,
    type: 'action',
    actionEffect: {
      type: 'heal',
      amount: 3,
      target: 'unit',
    },
  },
  {
    id: 'action_003',
    name: '強化',
    cost: 2,
    type: 'action',
    actionEffect: {
      type: 'buff',
      attack: 2,
      target: 'unit',
    },
  },
]

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
  return [
    'unit_001',
    'unit_001',
    'unit_002',
    'unit_002',
    'unit_003',
    'unit_003',
    'unit_004',
    'action_001',
    'action_001',
    'action_002',
    'action_003',
  ]
}

