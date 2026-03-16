import { describe, it, expect, beforeEach } from 'vitest'
import { newCardEffectFunctions } from '@/core/newCardEffects'
import {
  resolveEffectByFunctionName,
  type EffectContext,
  type UnitState,
} from '@/core/effects'
import type { GameState, CardDefinition, Unit, PlayerState, Hero } from '@/core/types'

const testHero: Hero = {
  id: 'test_hero',
  name: 'テストヒーロー',
  attribute: 'red',
}

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
    deck: [],
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
    gameId: 'test_game_new_cards',
    phase: 'playing',
    currentTick: 0,
    lastUpdateTime: Date.now(),
    gameStartTime: Date.now(),
    randomSeed: 123,
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

function createUnitState(unit: Unit): UnitState {
  return {
    unit,
    statusEffects: new Set(),
    temporaryBuffs: { attack: 0, hp: 0 },
    counters: {},
    flags: {},
  }
}

describe('新カードCore効果マッピング - 赤カード', () => {
  let gameState: GameState
  let cardMap: Map<string, CardDefinition>

  beforeEach(() => {
    gameState = createTestGameState()
    cardMap = new Map()
  })

  it('COR_023 コマンダーのマッピングが存在し、全味方+1攻撃力バフが正しく動作する', () => {
    const effectFunctions = newCardEffectFunctions['cor_023']
    expect(effectFunctions).toBeDefined()
    expect(effectFunctions).toContain('buff_all_friendly_attack:1')
    expect(effectFunctions).not.toContain('buff_random_friendly_attack_if_mp5:1')

    const unit1 = createTestUnit('u1', 1, 5, 2)
    const unit2 = createTestUnit('u2', 2, 5, 4)
    gameState.players[0].units.push(unit1, unit2)

    const context: EffectContext = {
      gameState,
      cardMap,
      sourcePlayer: gameState.players[0],
      events: [],
    }

    const result = resolveEffectByFunctionName('buff_all_friendly_attack', 1, context)

    const updatedUnits = result.state.players[0].units
    const u1 = updatedUnits.find((u) => u.id === 'u1')
    const u2 = updatedUnits.find((u) => u.id === 'u2')

    expect(u1?.attack).toBe(3)
    expect(u2?.attack).toBe(5)
  })

  it('COR_024 アーマーのマッピングが存在し、ランダム味方+2攻撃力バフが正しく動作する', () => {
    const effectFunctions = newCardEffectFunctions['cor_024']
    expect(effectFunctions).toBeDefined()
    expect(effectFunctions).toContain('buff_target_attack:2')

    const unit1 = createTestUnit('u1', 1, 5, 2)
    const unit2 = createTestUnit('u2', 2, 5, 4)
    gameState.players[0].units.push(unit1, unit2)

    const context: EffectContext = {
      gameState,
      cardMap,
      sourcePlayer: gameState.players[0],
      targetUnit: createUnitState(unit2),
      events: [],
    }

    const result = resolveEffectByFunctionName('buff_target_attack', 2, context)

    const updatedUnits = result.state.players[0].units
    const u1 = updatedUnits.find((u) => u.id === 'u1')
    const u2 = updatedUnits.find((u) => u.id === 'u2')

    expect(u1?.attack).toBe(2)
    expect(u2?.attack).toBe(6)
  })

  it('COR_026 黎明の守護者レイシアのマッピングが存在し、正面の敵攻撃力ぶん味方が強化される', () => {
    const effectFunctions = newCardEffectFunctions['cor_026']
    expect(effectFunctions).toBeDefined()
    expect(effectFunctions).toContain('buff_friendly_by_enemy_front_attack')

    const friendlyFront = createTestUnit('friendly_front', 1, 5, 2)
    const friendlyNoEnemy = createTestUnit('friendly_back', 2, 5, 3)
    const enemyFront = createTestUnit('enemy_front', 1, 5, 4)
    gameState.players[0].units.push(friendlyFront, friendlyNoEnemy)
    gameState.players[1].units.push(enemyFront)

    const context: EffectContext = {
      gameState,
      cardMap,
      sourcePlayer: gameState.players[0],
      events: [],
    }

    const result = resolveEffectByFunctionName('buff_friendly_by_enemy_front_attack', 0, context)

    const updatedFriendFront = result.state.players[0].units.find((u) => u.id === 'friendly_front')
    const updatedFriendNoEnemy = result.state.players[0].units.find((u) => u.id === 'friendly_back')

    expect(updatedFriendFront?.attack).toBe(6)
    expect(updatedFriendNoEnemy?.attack).toBe(3)
  })
})

// ─────────────────────────────────────────────
// 全新カード(effectFunctions)のスモークテスト
// ─────────────────────────────────────────────

// engine.ts 内部のDSLに合わせた簡易パーサ
const TRIGGER_KEYS = new Set([
  'play',
  'attack',
  'death',
  'resonate',
  'decimate',
  'awakening',
  'explore',
  'damage',
  'effect_damage_destroy',
  'enter_field',
  'ex_resonate',
  'enemy_action',
  'resonate_fire_seed',
  'while_on_field',
])

const NON_EXECUTABLE_TOKENS = new Set([
  'target',
  'agility',
  'rush',
  'flight',
  'heavy_pierce',
  'combo',
  'spillover',
  'revenge',
  'mp_boost',
  'action_damage_boost',
])

type FunctionTokenLike = {
  name: string
  value: number
  valueStr?: string
}

const expectedRedCardMappings: Record<string, string> = {
  cor_001: 'play:add_fire_seed_to_ex;resonate:buff_self_attack:1;ex_resonate:buff_self_attack:1',
  cor_002: 'play:discard_lowest_mp_hand;play:add_flame_baptism_to_ex;ex_resonate:damage_random_enemy:2',
  cor_003: 'ex_resonate:immediate_attack_self',
  cor_004: 'attack:split_damage_random_enemy:4',
  cor_005: 'play:damage_front_unit_fire_seed_conditional:4:7:2',
  cor_006: 'play:damage_split_by_action_count:1;ex_resonate:damage_enemy_hero:2',
  cor_007: 'play:damage_front_unit:1;effect_damage_destroy:buff_self_attack_hp:1',
  cor_008: 'attack:damage_front_unit:3',
  cor_009: 'while_on_field:action_damage_boost:1',
  cor_010: 'play:damage_non_front_enemy:5',
  cor_011: 'play:damage_random_enemy:3;effect_damage_destroy:buff_random_friendly_attack_hp:2',
  cor_012: 'play:grant_enemy_damage_boost_all:1;play:damage_random_enemy:7',
  cor_013: 'play:grant_agility_target',
  cor_014: 'play:search_fire_seed_to_ex',
  cor_015: 'play:add_fire_seed_to_ex;resonate_fire_seed:buff_self_attack:1',
  cor_016: 'play:add_fire_seed_to_ex',
  cor_017: 'agility;attack:damage_front_fire_seed_conditional:5',
  cor_018: 'play:damage_front_unit_conditional_low_hp:1',
  cor_019: 'play:grant_effect_damage_boost_front:3',
  cor_020: 'play:grant_attack_effect:damage_front_unit_by_attack',
  cor_021: 'play:grant_action_damage_immunity_self',
  cor_022: 'enemy_action:immediate_attack_self',
  cor_023: 'play:buff_all_friendly_attack:1',
  cor_024: 'play:buff_target_attack:2',
  cor_025: 'agility;attack:buff_self_attack:1',
  cor_026: 'play:buff_friendly_by_enemy_front_attack',
  cor_027: 'target:enemy_unit;damage_target:2',
  cor_028: 'target:friendly_unit;buff_target_attack:3;grant_decimate_fire_seed_target',
  cor_029: 'target:enemy_unit;damage_target_ar_boost:4',
  cor_030: 'copy_graveyard_action_to_ex',
  cor_031: 'target:friendly_unit;buff_target_attack:2;grant_unblockable_target',
  cor_032: 'add_fire_seed_to_ex;add_fire_seed_to_ex;damage_all_enemy_units_each:5;damage_enemy_hero:3',
  cor_033: 'target:enemy_unit;damage_target:5',
  cor_034: 'target:enemy_unit;damage_target_on_destroy_buff_front:6',
  cor_035: 'target:enemy_unit;damage_non_front_on_destroy_buff_nearest:6',
  cor_036: 'split_damage_all_enemy_units:9',
  cor_037: 'target:enemy_unit;damage_target_on_destroy_grant_hero_attack:7',
  cor_038: 'target:enemy_unit;fire_seed_triple_activation:6',
  cor_039: 'split_damage_by_fire_seed_count:2',
  cor_040: 'damage_all_by_fire_seed_count:1',
  cor_041: 'split_damage_on_destroy_hero_damage:4',
  cor_042: 'split_damage_all_enemy_units:5',
  cor_043: 'target:enemy_unit;damage_target:2;grant_effect_damage_boost_target:2',
  cor_044: 'damage_all_enemy_units_each:2;grant_no_counterattack_all_enemy',
  cor_045: 'target:friendly_unit;buff_target_conditional_front:5',
}

function parseFunctionTokensFromMapping(effectFunctions: string | undefined): FunctionTokenLike[] {
  if (!effectFunctions) return []

  const parts = effectFunctions
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const tokens: FunctionTokenLike[] = []

  for (const part of parts) {
    const segments = part.split(':')
    const first = segments[0]

    if (TRIGGER_KEYS.has(first) && segments.length >= 2) {
      const name = segments[1]
      const valueRaw = segments[2] ?? '0'
      const value = Number.parseInt(valueRaw.split('|')[0].split(':')[0] || '0', 10) || 0
      const valueStr =
        segments.length > 2 ? segments.slice(2).join(':') || undefined : undefined
      if (!NON_EXECUTABLE_TOKENS.has(name)) {
        tokens.push({ name, value, valueStr })
      }
    } else {
      const name = first
      const valueRaw = segments[1] ?? '0'
      const value = Number.parseInt(valueRaw.split('|')[0].split(':')[0] || '0', 10) || 0
      const valueStr =
        segments.length > 1 ? segments.slice(1).join(':') || undefined : undefined
      if (!NON_EXECUTABLE_TOKENS.has(name)) {
        tokens.push({ name, value, valueStr })
      }
    }
  }

  return tokens
}

describe('新カードCore効果マッピング - 全カードスモークテスト', () => {
  let gameState: GameState
  let cardMap: Map<string, CardDefinition>

  beforeEach(() => {
    gameState = createTestGameState()
    cardMap = new Map()

    // 全カードでそこそこ安全に効果を流せるよう、最低限の盤面を用意
    const friendlyUnit = createTestUnit('friendly', 1, 5, 3)
    const enemyUnit = createTestUnit('enemy', 1, 5, 3)
    gameState.players[0].units.push(friendlyUnit)
    gameState.players[1].units.push(enemyUnit)
  })

  it('全てのnewCardEffectFunctionsがDSL的にパースでき、resolveEffectByFunctionNameで例外にならない', () => {
    const errors: string[] = []

    for (const [cardId, effectFunctions] of Object.entries(newCardEffectFunctions)) {
      const localGameState = createTestGameState()
      const friendlyUnit = createTestUnit('friendly', 1, 5, 3)
      const enemyUnit = createTestUnit('enemy', 1, 5, 3)
      localGameState.players[0].units.push(friendlyUnit)
      localGameState.players[1].units.push(enemyUnit)
      const tokens = parseFunctionTokensFromMapping(effectFunctions)

      // マッピング自体が空でないことだけは保証
      expect(effectFunctions, `${cardId} has empty mapping`).toBeTruthy()

      for (const token of tokens) {
        const context: EffectContext = {
          gameState: localGameState,
          cardMap,
          sourcePlayer: localGameState.players[0],
          targetPlayer: localGameState.players[1],
          sourceUnit: createUnitState(localGameState.players[0].units[0]),
          targetUnit: createUnitState(localGameState.players[1].units[0]),
          events: [],
        }

        try {
          resolveEffectByFunctionName(token.name, token.value, context, token.valueStr)
        } catch (e) {
          errors.push(`${cardId}: function "${token.name}" failed with ${(e as Error).message}`)
        }
      }
    }

    expect(errors, `errors:\n${errors.join('\n')}`).toHaveLength(0)
  })
})

describe('新カードCore効果マッピング - 赤45枚の個別期待値テスト', () => {
  it('赤カード45枚ぶんのマッピングが揃っている', () => {
    expect(Object.keys(expectedRedCardMappings)).toHaveLength(45)
  })

  for (const [cardId, expectedMapping] of Object.entries(expectedRedCardMappings)) {
    it(`${cardId} の effectFunctions が期待値どおり`, () => {
      expect(newCardEffectFunctions[cardId]).toBe(expectedMapping)
    })
  }
})
