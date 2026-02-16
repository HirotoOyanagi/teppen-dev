/**
 * カード効果システムの単体テスト
 * docs/カード効果実装.md の実装済み効果をテスト
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveEffect, type EffectContext, type Effect, type UnitState } from '@/core/effects'
import type { GameState, CardDefinition, Unit, PlayerState, Hero } from '@/core/types'

// テスト用のヒーロー
const testHero: Hero = {
  id: 'test_hero',
  name: 'テストヒーロー',
  attribute: 'red',
}

// テスト用のゲーム状態を作成
function createTestGameState(): GameState {
  const player1: PlayerState = {
    playerId: 'player1',
    hp: 30,
    maxHp: 30,
    mp: 5,
    maxMp: 10,
    blueMp: 0,
    ap: 0,
    hero: testHero,
    hand: [],
    deck: ['card_1', 'card_2', 'card_3'],
    graveyard: [],
    units: [],
    exPocket: [],
  }

  const player2: PlayerState = {
    playerId: 'player2',
    hp: 30,
    maxHp: 30,
    mp: 5,
    maxMp: 10,
    blueMp: 0,
    ap: 0,
    hero: testHero,
    hand: [],
    deck: [],
    graveyard: [],
    units: [],
    exPocket: [],
  }

  return {
    gameId: 'test_game',
    phase: 'playing',
    currentTick: 0,
    lastUpdateTime: Date.now(),
    gameStartTime: Date.now(),
    randomSeed: 12345,
    mulliganDone: [true, true],
    players: [player1, player2],
    activeResponse: {
      isActive: false,
      currentPlayerId: 'player1',
      stack: [],
      timer: 0,
      passedPlayers: [],
    },
  }
}

// テスト用のユニットを作成
function createTestUnit(id: string, lane: number, hp: number = 5, attack: number = 3): Unit {
  return {
    id,
    cardId: 'test_card',
    hp,
    maxHp: hp,
    attack,
    attackGauge: 0,
    attackInterval: 10000,
    lane,
  }
}

// テスト用のUnitStateを作成
function createUnitState(unit: Unit): UnitState {
  return {
    unit,
    statusEffects: new Set(),
    temporaryBuffs: { attack: 0, hp: 0 },
    counters: {},
    flags: {},
  }
}

describe('カード効果システム - 実装済み効果テスト', () => {
  let gameState: GameState
  let cardMap: Map<string, CardDefinition>

  beforeEach(() => {
    gameState = createTestGameState()
    cardMap = new Map()
  })

  // ========================================
  // ✅ ダメージ効果 (damage)
  // ========================================
  describe('ダメージ効果 (damage)', () => {
    it('敵ヒーローにダメージを与える', () => {
      const effect: Effect = {
        type: 'damage',
        trigger: 'when_played',
        target: 'enemy_hero',
        value: 5,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetPlayer: gameState.players[1],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 敵ヒーローのHPが30から25に減少
      expect(result.state.players[1].hp).toBe(25)
      // イベントが発行される
      expect(result.events.some(e => e.type === 'player_damage')).toBe(true)
    })

    it('敵ユニットにダメージを与える', () => {
      // 敵ユニットを配置
      const enemyUnit = createTestUnit('enemy_unit', 1, 10, 2)
      gameState.players[1].units.push(enemyUnit)

      const effect: Effect = {
        type: 'damage',
        trigger: 'when_played',
        target: 'random_enemy_unit',
        value: 3,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(enemyUnit),
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 敵ユニットのHPが10から7に減少
      const updatedUnit = result.state.players[1].units.find(u => u.id === 'enemy_unit')
      expect(updatedUnit?.hp).toBe(7)
    })

    it('ダメージでユニットが破壊される（HP0以下）', () => {
      // HP3の敵ユニットを配置
      const enemyUnit = createTestUnit('enemy_unit', 1, 3, 2)
      gameState.players[1].units.push(enemyUnit)

      const effect: Effect = {
        type: 'damage',
        trigger: 'when_played',
        target: 'random_enemy_unit',
        value: 5, // 3HPを超えるダメージ
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(enemyUnit),
        events: [],
      }

      const result = resolveEffect(effect, context)

      // ユニットが破壊されている
      expect(result.state.players[1].units.length).toBe(0)
      // 破壊イベントが発行される
      expect(result.events.some(e => e.type === 'unit_destroyed')).toBe(true)
    })
  })

  // ========================================
  // ✅ 回復効果 (heal)
  // ========================================
  describe('回復効果 (heal)', () => {
    it('味方ヒーローを回復する', () => {
      // HPを減らしておく
      gameState.players[0].hp = 20

      const effect: Effect = {
        type: 'heal',
        trigger: 'when_played',
        target: 'friendly_hero',
        value: 5,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetPlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // HPが20から25に回復
      expect(result.state.players[0].hp).toBe(25)
    })

    it('回復は最大HPを超えない', () => {
      // HPをほぼ最大に設定
      gameState.players[0].hp = 28

      const effect: Effect = {
        type: 'heal',
        trigger: 'when_played',
        target: 'friendly_hero',
        value: 10,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetPlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // HPは最大の30を超えない
      expect(result.state.players[0].hp).toBe(30)
    })

    it('味方ユニットを回復する', () => {
      // ダメージを受けた味方ユニット
      const myUnit = createTestUnit('my_unit', 1, 10, 3)
      myUnit.hp = 5 // HPが減っている
      gameState.players[0].units.push(myUnit)

      const effect: Effect = {
        type: 'heal',
        trigger: 'when_played',
        target: 'random_friendly_unit',
        value: 3,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(myUnit),
        events: [],
      }

      const result = resolveEffect(effect, context)

      // HPが5から8に回復
      const updatedUnit = result.state.players[0].units.find(u => u.id === 'my_unit')
      expect(updatedUnit?.hp).toBe(8)
    })
  })

  // ========================================
  // ✅ バフ効果 (buff)
  // ========================================
  describe('バフ効果 (buff)', () => {
    it('味方ユニットの攻撃力を上げる', () => {
      const myUnit = createTestUnit('my_unit', 1, 5, 3)
      gameState.players[0].units.push(myUnit)

      const effect: Effect = {
        type: 'buff',
        trigger: 'when_played',
        target: 'random_friendly_unit',
        value: 2,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(myUnit),
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 攻撃力が3から5に増加
      const updatedUnit = result.state.players[0].units.find(u => u.id === 'my_unit')
      expect(updatedUnit?.attack).toBe(5)
    })
  })

  // ========================================
  // ✅ デバフ効果 (debuff)
  // ========================================
  describe('デバフ効果 (debuff)', () => {
    it('敵ユニットの攻撃力を下げる', () => {
      const enemyUnit = createTestUnit('enemy_unit', 1, 5, 4)
      gameState.players[1].units.push(enemyUnit)

      const effect: Effect = {
        type: 'debuff',
        trigger: 'when_played',
        target: 'random_enemy_unit',
        value: 2,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(enemyUnit),
        targetPlayer: gameState.players[1],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 攻撃力が4から2に減少
      const updatedUnit = result.state.players[1].units.find(u => u.id === 'enemy_unit')
      expect(updatedUnit?.attack).toBe(2)
    })

    it('攻撃力は0以下にならない', () => {
      const enemyUnit = createTestUnit('enemy_unit', 1, 5, 2)
      gameState.players[1].units.push(enemyUnit)

      const effect: Effect = {
        type: 'debuff',
        trigger: 'when_played',
        target: 'random_enemy_unit',
        value: 5, // 攻撃力2を超えるデバフ
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(enemyUnit),
        targetPlayer: gameState.players[1],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 攻撃力は0（マイナスにならない）
      const updatedUnit = result.state.players[1].units.find(u => u.id === 'enemy_unit')
      expect(updatedUnit?.attack).toBe(0)
    })
  })

  // ========================================
  // ✅ ドロー効果 (draw)
  // ========================================
  describe('ドロー効果 (draw)', () => {
    it('カードを1枚引く', () => {
      const effect: Effect = {
        type: 'draw',
        trigger: 'when_played',
        value: 1,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 手札に1枚追加
      expect(result.state.players[0].hand.length).toBe(1)
      // デッキから1枚減少
      expect(result.state.players[0].deck.length).toBe(2)
      // ドローイベントが発行される
      expect(result.events.some(e => e.type === 'card_drawn')).toBe(true)
    })

    it('複数枚カードを引く', () => {
      const effect: Effect = {
        type: 'draw',
        trigger: 'when_played',
        value: 2,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 手札に2枚追加
      expect(result.state.players[0].hand.length).toBe(2)
      // デッキから2枚減少
      expect(result.state.players[0].deck.length).toBe(1)
    })

    it('デッキが空の場合は引けない', () => {
      // デッキを空にする
      gameState.players[0].deck = []

      const effect: Effect = {
        type: 'draw',
        trigger: 'when_played',
        value: 1,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // 手札は増えない
      expect(result.state.players[0].hand.length).toBe(0)
    })
  })

  // ========================================
  // ✅ 破壊効果 (destroy)
  // ========================================
  describe('破壊効果 (destroy)', () => {
    it('敵ユニットを破壊する', () => {
      const enemyUnit = createTestUnit('enemy_unit', 1, 10, 5)
      gameState.players[1].units.push(enemyUnit)

      const effect: Effect = {
        type: 'destroy',
        trigger: 'when_played',
        target: 'random_enemy_unit',
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(enemyUnit),
        events: [],
      }

      const result = resolveEffect(effect, context)

      // ユニットが破壊されている
      expect(result.state.players[1].units.length).toBe(0)
      // 墓地に送られている
      expect(result.state.players[1].graveyard).toContain('test_card')
      // 破壊イベントが発行される
      expect(result.events.some(e => e.type === 'unit_destroyed')).toBe(true)
    })
  })

  // ========================================
  // ✅ MP獲得効果 (mp_gain)
  // ========================================
  describe('MP獲得効果 (mp_gain)', () => {
    it('MPを獲得する', () => {
      gameState.players[0].mp = 3

      const effect: Effect = {
        type: 'mp_gain',
        trigger: 'when_played',
        value: 2,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // MPが3から5に増加
      expect(result.state.players[0].mp).toBe(5)
      // イベントが発行される
      expect(result.events.some(e => e.type === 'mp_recovered')).toBe(true)
    })

    it('MPは最大値を超えない', () => {
      gameState.players[0].mp = 9

      const effect: Effect = {
        type: 'mp_gain',
        trigger: 'when_played',
        value: 5,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // MPは最大の10を超えない
      expect(result.state.players[0].mp).toBe(10)
    })
  })

  // ========================================
  // ✅ AP獲得効果 (ap_gain)
  // ========================================
  describe('AP獲得効果 (ap_gain)', () => {
    it('APを獲得する', () => {
      gameState.players[0].ap = 3

      const effect: Effect = {
        type: 'ap_gain',
        trigger: 'when_played',
        value: 2,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // APが3から5に増加
      expect(result.state.players[0].ap).toBe(5)
    })

    it('APは無限に蓄積可能', () => {
      gameState.players[0].ap = 100

      const effect: Effect = {
        type: 'ap_gain',
        trigger: 'when_played',
        value: 5,
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        events: [],
      }

      const result = resolveEffect(effect, context)

      // APは上限なしで蓄積可能
      expect(result.state.players[0].ap).toBe(105)
    })
  })

  // ========================================
  // ✅ ステータス効果 (status)
  // ========================================
  describe('ステータス効果 (status)', () => {
    it('ステータス効果を付与できる（実装確認）', () => {
      const myUnit = createTestUnit('my_unit', 1, 5, 3)
      gameState.players[0].units.push(myUnit)

      const effect: Effect = {
        type: 'status',
        trigger: 'when_played',
        status: 'rush',
      }

      const context: EffectContext = {
        gameState,
        cardMap,
        sourcePlayer: gameState.players[0],
        targetUnit: createUnitState(myUnit),
        events: [],
      }

      // エラーなく実行できる
      const result = resolveEffect(effect, context)
      expect(result.state).toBeDefined()
    })
  })
})

describe('効果パーサーテスト', () => {
  it('パーサーが正しくインポートできる', async () => {
    const { parseEffectText } = await import('@/core/effectParser')
    expect(parseEffectText).toBeDefined()
  })

  it('ダメージ効果をパースできる', async () => {
    const { parseEffectText } = await import('@/core/effectParser')
    
    const effects = parseEffectText('When played: Deal 5 damage to enemy unit.')
    
    expect(effects.length).toBeGreaterThan(0)
    expect(effects.some(e => e.type === 'damage')).toBe(true)
  })

  it('Rushステータスをパースできる', async () => {
    const { parseEffectText } = await import('@/core/effectParser')
    
    const effects = parseEffectText('&lt;Rush&gt;')
    
    expect(effects.length).toBeGreaterThan(0)
    expect(effects.some(e => e.type === 'status' && e.status === 'rush')).toBe(true)
  })
})
