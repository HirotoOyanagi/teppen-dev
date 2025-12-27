/**
 * Game Core - 型定義
 * State / Input / Event のスキーマ定義
 */

// カード種別
export type CardType = 'unit' | 'action' | 'hero_art'

// カード定義
export interface CardDefinition {
  id: string
  name: string
  cost: number
  type: CardType
  // ユニットカードの属性
  unitStats?: {
    hp: number
    attack: number
    attackInterval: number // 攻撃間隔（ミリ秒）
    lane?: number // 配置レーン（後で確定）
  }
  // アクションカードの効果（JSONでDSL化、後で拡張）
  actionEffect?: Record<string, unknown>
}

// ユニットの状態
export interface Unit {
  id: string
  cardId: string
  hp: number
  maxHp: number
  attack: number
  attackGauge: number // 0.0 ~ 1.0
  attackInterval: number
  lane: number
  statusEffects?: string[] // 状態異常（後で拡張）
}

// プレイヤーの状態
export interface PlayerState {
  playerId: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  hand: string[] // カードIDの配列
  deck: string[] // カードIDの配列
  units: Unit[] // 盤面上のユニット
  heroArtGauge?: number // ヒーローアーツ用（後で拡張）
}

// Active Responseスタック
export interface ActiveResponseStack {
  playerId: string
  cardId: string
  timestamp: number // ARに入った時刻
}

// ゲーム状態
export interface GameState {
  gameId: string
  currentTick: number
  isActiveResponse: boolean
  activeResponseStack: ActiveResponseStack[]
  activeResponseTimer: number // ARタイマー（ミリ秒）
  players: [PlayerState, PlayerState]
  randomSeed: number // リプレイ用の乱数シード
  gameStartTime: number
  lastUpdateTime: number
}

// 入力イベント
export type GameInput =
  | {
      type: 'play_card'
      playerId: string
      cardId: string
      target?: string // 対象（ユニットIDなど）
      lane?: number // ユニット配置レーン
      timestamp: number
    }
  | {
      type: 'end_active_response'
      playerId: string
      timestamp: number
    }
  | {
      type: 'hero_art'
      playerId: string
      timestamp: number
    }

// ゲームイベント（解決結果）
export type GameEvent =
  | {
      type: 'unit_attack'
      unitId: string
      targetId: string
      damage: number
      timestamp: number
    }
  | {
      type: 'unit_damage'
      unitId: string
      damage: number
      timestamp: number
    }
  | {
      type: 'unit_destroyed'
      unitId: string
      timestamp: number
    }
  | {
      type: 'player_damage'
      playerId: string
      damage: number
      timestamp: number
    }
  | {
      type: 'mp_recovered'
      playerId: string
      amount: number
      timestamp: number
    }
  | {
      type: 'card_played'
      playerId: string
      cardId: string
      timestamp: number
    }
  | {
      type: 'active_response_started'
      playerId: string
      cardId: string
      timestamp: number
    }
  | {
      type: 'active_response_resolved'
      stack: ActiveResponseStack[]
      timestamp: number
    }
  | {
      type: 'game_ended'
      winner: string
      reason: 'hp_zero' | 'time_limit'
      timestamp: number
    }

