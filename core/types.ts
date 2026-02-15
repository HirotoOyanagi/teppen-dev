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
  imageUrl?: string // カード画像のパス（IDから自動生成）
  // 効果関数（CSVから直接読み込む）
  // 形式:
  // - "関数名"
  // - "関数名:数値"
  // - "関数名1;関数名2:数値;関数名3:数値"
  // 例: "rush;split_damage_all_enemy_units:4;art_charge:2"
  effectFunctions?: string
  // ユニットカードの属性
  unitStats?: {
    hp: number
    attack: number
    attackInterval: number // 攻撃間隔（ミリ秒）
    lane?: number // 配置レーン（後で確定）
  }
  // アクションカードの効果（JSONでDSL化、後で拡張）
  actionEffect?: Record<string, unknown>
  // カード効果（ユニット・アクション共通）
  effects?: import('./effects').Effect[]
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
  shieldCount?: number // シールドの枚数（1回のダメージを0にする）
  // 複雑メカニクス用
  growthPoints?: number // グローポイント（MPベース）
  growthLevel?: number // 成長レベル（0から開始、1がLv2、2がLv3）
  growthThreshold?: number // 成長閾値（MP、growth:NのN）
  memoryCount?: number // メモリーカウンター
  memoryThreshold?: number // メモリー発動閾値
  energyPoints?: number // エナジーポイント
  questLevel?: number // クエストレベル
  unleashPoints?: number // 解放ポイント
  unleashThreshold?: number // 解放閾値
  isAwakened?: boolean // 目覚め状態
  isSealed?: boolean // 封印状態
  haltTimer?: number // 停止残り時間（ms）
  tempBuffs?: { // 一時バフ（1回攻撃するまで）
    attack?: number
    statusEffects?: string[]
  }
  deathEffects?: string[] // 死亡時の効果関数
  attackEffects?: string[] // 攻撃時の効果関数
  decimateEffects?: string[] // 撃破時の効果関数
  resonateEffects?: string[] // 呼応時の効果関数
  dotEffects?: { damage: number; intervalMs: number; timer: number }[] // 継続ダメージ
  // カード固有効果用
  heroHitEffects?: string[] // 敵ヒーローにダメージを与えた時の効果
  haltedEnemyDeathEffects?: string[] // 停止敵死亡時の効果
  friendlyUnitEnterEffects?: string[] // 味方ユニット登場時の効果
  whileOnFieldEffects?: WhileOnFieldEffect[] // 場にいる間の効果
  attackThreshold?: { threshold: number; effects: string[]; triggered: boolean } // 攻撃力閾値
  hpThreshold?: { threshold: number; effects: string[]; triggered: boolean } // HP閾値
  questCondition?: string // クエスト条件
  questEffects?: Record<number, string[]> // レベル毎の効果
  energyEffects?: string[] // エナジー発動時の効果
  energyGainRules?: Record<string, number> // エナジーポイント獲得条件
  originalAttack?: number // 元の攻撃力
  originalHp?: number // 元のHP
  revengeBuffAttack?: number // リベンジ時の攻撃力バフ
  revengeBuffHp?: number // リベンジ時のHPバフ
  revengeGrantAgility?: boolean // リベンジ時に俊敏付与
  laneLockTimer?: number // 枠封鎖タイマー
  ignoreBlocker?: boolean // 停止中の敵を無視してヒーロー攻撃
  selfDestructOnAttack?: boolean // 1回攻撃すると自壊
  awakeningEffects?: string[] // 目覚め時の効果
  memoryEffects?: string[] // メモリー発動時の効果
  unleashEffects?: string[] // 解放発動時の効果
  growthEffects?: Record<number, string[]> // 成長レベル毎の効果
  hpConditionEffects?: { condition: string; effects: string[] }[] // HP条件付き効果
  killerId?: string // このユニットを破壊したユニットのID（死亡時にセット）
}

// 場にいる間の効果定義
export interface WhileOnFieldEffect {
  target: 'friendly_units' | 'enemy_units' | 'self' | 'friendly_hero'
  effect: string // 効果の説明（エンジンで解釈）
  filter?: string // 対象フィルタ（例: 'red', 'machine'）
  excludeSelf?: boolean
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
  blueMp: number // 青MP（アクティブレスポンス中のみ有効、終了時に消失）
  ap: number // 必殺技ゲージ（MP消費で増加）
  hero: Hero // 使用中のヒーロー
  hand: string[] // カードIDの配列
  deck: string[] // カードIDの配列
  units: Unit[] // 盤面上のユニット
  heroArtGauge?: number // ヒーローアーツ用（後で拡張）
  graveyard: string[] // 墓地のカードID
  shieldCount?: number // シールドの枚数（1回のダメージを0にする）
  exPocket: string[] // EXポケット
  actionCardUsedCount?: number // バトル中アクションカード使用回数
  levelUpCount?: number // 味方ユニットレベルアップ回数
  awakeningCount?: number // 目覚め回数
  chainFireCount?: Record<string, number> // カードID毎の使用回数（連鎖する烈火等）
  laneLocks?: Record<number, number> // レーン毎の封鎖タイマー（ms）
}

// Active Responseスタック
export interface ActiveResponseStack {
  playerId: string
  cardId: string
  timestamp: number // ARに入った時刻
  target?: string // 対象（ユニットIDなど）
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
      target?: string
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
      type: 'card_drawn'
      playerId: string
      cardId: string
      timestamp: number
    }
  | {
      type: 'card_sent_to_graveyard'
      playerId: string
      cardId: string
      reason: 'card_played' | 'unit_destroyed' | 'awakening_overlay'
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

