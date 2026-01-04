/**
 * Game Core - 型定義
 * State / Input / Event のスキーマ定義
 */

// カード属性
export type CardAttribute = 'red' | 'green' | 'purple' | 'black'

// カード種別
export type CardType = 'unit' | 'action' | 'hero_art'

// カードレアリティ
export type CardRarity = 'normal' | 'legend'

// 種族（CAPCOMキャラクターの種族）
export type CardTribe =
  | 'street_fighter'
  | 'monster_hunter'
  | 'rockman'
  | 'okami'
  | 'devil_may_cry'
  | 'resident_evil'
  | 'other'

// カード定義
export interface CardDefinition {
  id: string
  name: string
  cost: number
  type: CardType
  attribute: CardAttribute
  rarity: CardRarity
  tribe: CardTribe
  description?: string
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

// ヒーロー定義
export interface Hero {
  id: string
  name: string
  attribute: CardAttribute
  description?: string
}

// プレイヤーの状態
export interface PlayerState {
  playerId: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  ap: number // 必殺技ゲージ（MP消費で増加）
  hero: Hero // 使用中のヒーロー
  hand: string[] // カードIDの配列
  deck: string[] // カードIDの配列
  units: Unit[] // 盤面上のユニット
  heroArtGauge?: number // ヒーローアーツ用（後で拡張）
  graveyard: string[] // 墓地のカードID
}

// Active Responseスタック
export interface ActiveResponseStack {
  playerId: string
  cardId: string
  timestamp: number // ARに入った時刻
}

// アクティブレスポンスの状態
export interface ActiveResponseState {
  isActive: boolean
  currentPlayerId: string | null // 現在アクション権限を持っているプレイヤー
  stack: ActiveResponseStack[]
  timer: number // ARタイマー（ミリ秒）
  passedPlayers: string[] // パスしたプレイヤーID
}

// ゲーム状態
export interface GameState {
  gameId: string
  currentTick: number
  phase: 'mulligan' | 'playing' | 'ended' // ゲームフェーズ
  activeResponse: ActiveResponseState
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
  | {
      type: 'mulligan'
      playerId: string
      keepCards: string[] // キープするカードID
      timestamp: number
    }
  | {
      type: 'active_response_action'
      playerId: string
      cardId: string
      timestamp: number
    }
  | {
      type: 'active_response_pass'
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

