/**
 * ヒーロー定義 - 全12体の一元管理
 */

import type { Hero } from './types'

export const HEROES: Hero[] = [
  // ── 赤 ──
  {
    id: 'hero_red_reisia',
    name: 'レイシア',
    attribute: 'red',
    description: '不撓の正義を掲げる戦士',
    heroArt: {
      name: '不撓の正義',
      cost: 18,
      description: '敵ユニット1体に10ダメージ + 味方全員攻撃+2',
      requiresTarget: true,
    },
    companion: {
      name: '守護の光',
      cost: 6,
      description: '味方1体にシールド1枚+HP+2',
      requiresTarget: true,
    },
  },
  {
    id: 'hero_red_kaiser',
    name: 'カイゼル',
    attribute: 'red',
    description: '終焉の業火を操る者',
    heroArt: {
      name: '終焉の業火',
      cost: 25,
      description: '敵ヒーロー3ダメ + 全敵ユニット6ダメ + 味方ヒーロー3ダメ',
    },
    companion: {
      name: '力の化身',
      cost: 9,
      description: '味方全員の攻撃力+1',
    },
  },

  // ── 緑 ──
  {
    id: 'hero_green_mira',
    name: 'ミラ',
    attribute: 'green',
    description: '記憶の再生を司る者',
    heroArt: {
      name: '記憶の再生',
      cost: 16,
      description: '味方全員HP+5 + 初期状態リセット',
    },
    companion: {
      name: '追憶の守護者',
      cost: 7,
      description: '味方1体にダメージ軽減1付与',
      requiresTarget: true,
    },
  },
  {
    id: 'hero_green_finn',
    name: 'フィン',
    attribute: 'green',
    description: '柔軟な戦術の使い手',
    heroArt: {
      name: '柔軟な戦術',
      cost: 14,
      description: '味方全員の攻撃ゲージリセット + 全味方+2/+2',
    },
    companion: {
      name: '軽快な風',
      cost: 5,
      description: '味方1体に俊敏付与',
      requiresTarget: true,
    },
  },

  // ── 紫 ──
  {
    id: 'hero_purple_vald',
    name: 'ヴァルド',
    attribute: 'purple',
    description: '支配の戦略を駆使する知将',
    heroArt: {
      name: '支配の戦略',
      cost: 25,
      description: '敵ユニット1体のコントロールを奪う',
      requiresTarget: true,
    },
    companion: {
      name: '洗練の影',
      cost: 8,
      description: 'ランダム敵1体を13秒停止',
    },
  },
  {
    id: 'hero_purple_orca',
    name: 'オルカ',
    attribute: 'purple',
    description: '構造の解明を追求する研究者',
    heroArt: {
      name: '構造の解明',
      cost: 24,
      description: 'デッキ全カードコスト-1 + 1枚EXへ',
    },
    companion: {
      name: '探究の知性',
      cost: 7,
      description: 'デッキ内アクションカード1枚をMP-2でEXへ',
    },
  },

  // ── 黒 ──
  {
    id: 'hero_black_seraph',
    name: 'セラフ',
    attribute: 'black',
    description: '秩序の裁きを下す審判者',
    heroArt: {
      name: '秩序の裁き',
      cost: 19,
      description: '墓地からMP6以下ユニット召喚 + 敵MP3以下破壊',
    },
    companion: {
      name: '規律の守護者',
      cost: 6,
      description: '墓地からユニット1体を+1/+1でEXへ',
    },
  },
  {
    id: 'hero_black_nox',
    name: 'ノクス',
    attribute: 'black',
    description: '代償の取引を行う闇商人',
    heroArt: {
      name: '代償の取引',
      cost: 15,
      description: '味方ヒーロー-5HP + 敵に20ダメージ振り分け',
    },
    companion: {
      name: '代償の化身',
      cost: 8,
      description: '味方ヒーロー-3HP + 味方全員攻撃+2',
    },
  },
]
