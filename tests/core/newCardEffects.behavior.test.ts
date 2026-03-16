import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadCardsFromCsv } from '@/core/csvLoader'
import { updateGameState } from '@/core/engine'
import {
  applyTestModeSetup,
  TEST_MODE_OPPONENT_CARD_ID,
} from '@/core/testMode'
import type { CardDefinition, GameState, Hero, PlayerState, Unit } from '@/core/types'

const testHero: Hero = {
  id: 'test_hero',
  name: 'テストヒーロー',
  attribute: 'red',
}

const csvPath = path.join(process.cwd(), 'public', '新カードCore - カードデータのスプレッドシート化.csv')
const csvText = readFileSync(csvPath, 'utf8')
const loadedCards = loadCardsFromCsv(csvText)
const cardMap = new Map<string, CardDefinition>()

for (const card of loadedCards) {
  cardMap.set(card.id, card)
}

function createTestGameState(): GameState {
  const player1: PlayerState = {
    playerId: 'player1',
    hp: 30,
    maxHp: 30,
    mp: 20,
    maxMp: 20,
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
    mp: 20,
    maxMp: 20,
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
    gameId: 'test_game_new_card_behavior',
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

function createUnit(id: string, lane: number, hp: number, attack: number, cardId: string = 'test_card'): Unit {
  return {
    id,
    cardId,
    hp,
    maxHp: hp,
    attack,
    attackGauge: 0,
    attackInterval: 10000,
    lane,
  }
}

function createTestModeStateWithFriendlyTarget(): GameState {
  const state = applyTestModeSetup(createTestGameState(), cardMap)
  state.players[0].units.push(createUnit('test_friendly_target', 2, 5, 2))
  return state
}

function getPlayerIndex(playerId: string): number {
  if (playerId === 'player2') {
    return 1
  }

  return 0
}

function getPlayer(state: GameState, playerId: string): PlayerState {
  return state.players[getPlayerIndex(playerId)]
}

function getUnitInLane(state: GameState, playerId: string, lane: number): Unit | undefined {
  return getPlayer(state, playerId).units.find((unit) => unit.lane === lane)
}

function playUnit(
  state: GameState,
  cardId: string,
  lane: number,
  target: string | undefined = undefined,
  playerId: string = 'player1'
): { state: GameState } {
  return updateGameState(
    state,
    {
      type: 'play_card',
      playerId,
      cardId,
      lane,
      target,
      freePlay: true,
      timestamp: Date.now(),
    },
    0,
    cardMap
  )
}

function playActionAndResolve(
  state: GameState,
  cardId: string,
  target: string | undefined = undefined,
  playerId: string = 'player1',
  fromExPocket: boolean = false
): { state: GameState } {
  const playResult = updateGameState(
    state,
    {
      type: 'play_card',
      playerId,
      cardId,
      target,
      fromExPocket,
      freePlay: true,
      timestamp: Date.now(),
    },
    0,
    cardMap
  )

  let nextState = playResult.state

  if (nextState.activeResponse.isActive) {
    let resolverId = playerId
    if (nextState.activeResponse.currentPlayerId) {
      resolverId = nextState.activeResponse.currentPlayerId
    }

    const resolveResult = updateGameState(
      nextState,
      {
        type: 'end_active_response',
        playerId: resolverId,
        timestamp: Date.now(),
      },
      0,
      cardMap
    )

    nextState = resolveResult.state
  }

  return { state: nextState }
}

function advanceTime(state: GameState, deltaTime: number): { state: GameState } {
  return updateGameState(state, null, deltaTime, cardMap)
}

describe('新カードCore 赤カードの挙動テスト', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = createTestGameState()
  })

  describe('赤ユニット COR_001-COR_016', () => {
    it('COR_001 は登場時に火種をEXへ加える', () => {
      const result = playUnit(gameState, 'cor_001', 0)
      expect(result.state.players[0].exPocket).toContain('cor_027')
    })

    it('COR_001 はアクションカード使用時に自身の攻撃力を+1する', () => {
      const played = playUnit(gameState, 'cor_001', 0)
      const unitBeforeAction = getUnitInLane(played.state, 'player1', 0)

      const result = playActionAndResolve(played.state, 'cor_027')
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(unit?.attack).toBe((unitBeforeAction?.attack ?? 0) + 1)
    })

    it('COR_001 はEXからアクションカードを使っても自身の攻撃力を+1する', () => {
      const played = playUnit(gameState, 'cor_001', 0)
      const unitBeforeAction = getUnitInLane(played.state, 'player1', 0)

      const result = playActionAndResolve(played.state, 'cor_027', undefined, 'player1', true)
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(unit?.attack).toBe((unitBeforeAction?.attack ?? 0) + 1)
    })

    it('COR_002 は最低コスト手札を捨てて焔の洗式をEXへ加える', () => {
      gameState.players[0].hand = ['cor_032', 'cor_027']

      const result = playUnit(gameState, 'cor_002', 0)

      expect(result.state.players[0].graveyard).toContain('cor_027')
      expect(result.state.players[0].exPocket).toContain('cor_028')
      const played = getUnitInLane(result.state, 'player1', 0)
      expect(played?.exResonateEffects).toContain('damage_random_enemy:2')
    })

    it('COR_003 はEXからアクション使用時に即時攻撃する', () => {
      const played = playUnit(gameState, 'cor_003', 0)
      played.state.players[0].exPocket.push('cor_027')

      const result = playActionAndResolve(played.state, 'cor_027', undefined, 'player1', true)
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(unit?.attackGauge).toBe(1)
    })

    it('COR_004 は攻撃時効果を保持する', () => {
      const result = playUnit(gameState, 'cor_004', 0)
      const unit = getUnitInLane(result.state, 'player1', 0)
      expect(unit?.attackEffects).toContain('split_damage_random_enemy:4')
    })

    it('COR_005 は火種3枚未満なら正面に4ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_front', 0, 10, 2))

      const result = playUnit(gameState, 'cor_005', 0)
      const enemy = getUnitInLane(result.state, 'player2', 0)

      expect(enemy?.hp).toBe(6)
      expect(result.state.players[1].hp).toBe(30)
    })

    it('COR_005 は火種3枚以上なら正面に7ダメージし敵ヒーローに2ダメージ', () => {
      gameState.players[0].chainFireCount = { cor_027: 3 }
      gameState.players[1].units.push(createUnit('enemy_front', 0, 10, 2))

      const result = playUnit(gameState, 'cor_005', 0)
      const enemy = getUnitInLane(result.state, 'player2', 0)

      expect(enemy?.hp).toBe(3)
      expect(result.state.players[1].hp).toBe(28)
    })

    it('COR_006 は使用済みアクション枚数ぶんダメージを配る', () => {
      gameState.players[0].actionCardUsedCount = 3
      gameState.players[1].units.push(createUnit('enemy_front', 1, 10, 2))

      const result = playUnit(gameState, 'cor_006', 0)
      const enemy = getUnitInLane(result.state, 'player2', 1)
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(enemy?.hp).toBe(7)
      expect(unit?.exResonateEffects).toContain('damage_enemy_hero:2')
    })

    it('COR_007 は登場時ダメージと効果ダメージ撃破時効果を持つ', () => {
      gameState.players[1].units.push(createUnit('enemy_front', 0, 3, 2))

      const result = playUnit(gameState, 'cor_007', 0)
      const enemy = getUnitInLane(result.state, 'player2', 0)
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(enemy?.hp).toBe(2)
      expect(unit?.effectDamageDestroyEffects).toContain('buff_self_attack_hp:1')
    })

    it('COR_008 は攻撃時に正面3ダメージの効果を持つ', () => {
      const result = playUnit(gameState, 'cor_008', 0)
      const unit = getUnitInLane(result.state, 'player1', 0)
      expect(unit?.attackEffects).toContain('damage_front_unit:3')
    })

    it('COR_009 が場にいるとアクションダメージが+1される', () => {
      const withSpotter = playUnit(gameState, 'cor_009', 2)
      withSpotter.state.players[1].units.push(createUnit('enemy_front', 1, 5, 2))

      const result = playActionAndResolve(withSpotter.state, 'cor_027', 'enemy_front')
      const enemy = result.state.players[1].units.find((unit) => unit.id === 'enemy_front')

      expect(enemy?.hp).toBe(2)
    })

    it('COR_010 は正面以外の敵全体に5ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_left', 0, 6, 2))
      gameState.players[1].units.push(createUnit('enemy_center', 1, 6, 2))
      gameState.players[1].units.push(createUnit('enemy_right', 2, 6, 2))

      const result = playUnit(gameState, 'cor_010', 1)

      expect(getUnitInLane(result.state, 'player2', 0)?.hp).toBe(1)
      expect(getUnitInLane(result.state, 'player2', 1)?.hp).toBe(6)
      expect(getUnitInLane(result.state, 'player2', 2)?.hp).toBe(1)
    })

    it('COR_011 はランダムな敵1体に3ダメージと効果ダメージ撃破時の+2/+2効果を持つ', () => {
      gameState.players[0].units.push(createUnit('ally', 2, 4, 2))
      gameState.players[1].units.push(createUnit('enemy_target', 1, 7, 2))

      const result = playUnit(gameState, 'cor_011', 0)

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(4)
      expect(getUnitInLane(result.state, 'player1', 0)?.effectDamageDestroyEffects).toContain(
        'buff_random_friendly_attack_hp:2'
      )
    })

    it('COR_011 はテスト環境と同じ相手盤面でも対象選択なしで場に出てランダムな敵1体へ3ダメージを与える', () => {
      const state = applyTestModeSetup(createTestGameState(), cardMap)
      const opponentBefore = state.players[1].units.map((unit) => ({ id: unit.id, hp: unit.hp }))

      const result = playUnit(state, 'cor_011', 0)
      const playedUnit = getUnitInLane(result.state, 'player1', 0)
      const damagedUnits = result.state.players[1].units.filter((unit) => {
        const before = opponentBefore.find((prev) => prev.id === unit.id)
        return before && unit.hp === before.hp - 3
      })

      expect(playedUnit?.cardId).toBe('cor_011')
      expect(damagedUnits).toHaveLength(1)
    })

    it('COR_012 は敵リーダーに被ダメージ増加を付与しランダム敵に7ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 8, 2))

      const result = playUnit(gameState, 'cor_012', 0)

      expect(result.state.players[1].damageBoostAll).toBe(1)
      expect(getUnitInLane(result.state, 'player2', 1)).toBeUndefined()
    })

    it('COR_013 はランダムな味方1体に俊敏を付与する', () => {
      gameState.players[0].units.push(createUnit('ally_target', 2, 5, 2))

      const result = playUnit(gameState, 'cor_013', 0)
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.statusEffects).toContain('agility')
    })

    it('COR_013 はテスト環境と同じ盤面でも対象選択なしで場に出せる', () => {
      const state = createTestModeStateWithFriendlyTarget()

      const result = playUnit(state, 'cor_013', 0)
      const playedUnit = getUnitInLane(result.state, 'player1', 0)
      const ally = result.state.players[0].units.find((unit) => unit.id === 'test_friendly_target')

      expect(playedUnit?.cardId).toBe('cor_013')
      expect(ally?.statusEffects).toContain('agility')
    })

    it('COR_013 は対象の味方がいなくてもユニットとしては場に出る', () => {
      const result = playUnit(gameState, 'cor_013', 0)

      expect(getUnitInLane(result.state, 'player1', 0)?.cardId).toBe('cor_013')
      expect(result.state.players[0].units).toHaveLength(1)
    })

    it('COR_014 はデッキから火種をEXへ探す', () => {
      gameState.players[0].deck = ['cor_032', 'cor_027']

      const result = playUnit(gameState, 'cor_014', 0)

      expect(result.state.players[0].exPocket).toContain('cor_027')
      expect(result.state.players[0].deck).not.toContain('cor_027')
    })

    it('COR_015 は火種使用時に自身の攻撃力を+1する', () => {
      const played = playUnit(gameState, 'cor_015', 0)

      const result = playActionAndResolve(played.state, 'cor_027')
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(result.state.players[0].exPocket).toContain('cor_027')
      expect(unit?.attack).toBe(3)
    })

    it('COR_016 は登場時に火種をEXへ加える', () => {
      const result = playUnit(gameState, 'cor_016', 0)
      expect(result.state.players[0].exPocket).toContain('cor_027')
    })
  })

  describe('赤ユニット COR_017-COR_026', () => {
    it('COR_017 は俊敏と火種条件付き攻撃効果を持つ', () => {
      const result = playUnit(gameState, 'cor_017', 0)
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(unit?.statusEffects).toContain('agility')
      expect(unit?.attackEffects).toContain('damage_front_fire_seed_conditional:5')
    })

    it('COR_018 は正面敵のHPが4なら1ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 0, 4, 2))

      const result = playUnit(gameState, 'cor_018', 0)

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(3)
    })

    it('COR_018 はテスト環境と同じ盤面でも対象選択なしで場に出せる', () => {
      const state = applyTestModeSetup(createTestGameState(), cardMap)
      state.players[1].units = [createUnit('enemy_target', 0, 4, 2, TEST_MODE_OPPONENT_CARD_ID)]

      const result = playUnit(state, 'cor_018', 0)
      const playedUnit = getUnitInLane(result.state, 'player1', 0)
      const enemy = result.state.players[1].units.find((unit) => unit.id === 'enemy_target')

      expect(playedUnit?.cardId).toBe('cor_018')
      expect(enemy?.hp).toBe(3)
    })

    it('COR_018 は対象の敵がいなくてもユニットとしては場に出る', () => {
      const result = playUnit(gameState, 'cor_018', 0)

      expect(getUnitInLane(result.state, 'player1', 0)?.cardId).toBe('cor_018')
      expect(result.state.players[1].units).toHaveLength(0)
    })

    it('COR_018 は正面敵のHPが3以下なら3ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 0, 3, 2))

      const result = playUnit(gameState, 'cor_018', 0)

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')).toBeUndefined()
    })

    it('COR_019 は正面の敵に効果ダメージ+3を付与する', () => {
      gameState.players[1].units.push(createUnit('enemy_front', 0, 5, 2))

      const result = playUnit(gameState, 'cor_019', 0)
      const enemy = getUnitInLane(result.state, 'player2', 0)

      expect(enemy?.damageReduction).toBe(-3)
    })

    it('COR_019 の後に効果ダメージを与えると +3 される', () => {
      gameState.players[1].units.push(createUnit('enemy_front', 0, 5, 2))

      const afterDuster = playUnit(gameState, 'cor_019', 0)
      const result = playActionAndResolve(afterDuster.state, 'cor_027', 'enemy_front')
      const enemy = result.state.players[1].units.find((unit) => unit.id === 'enemy_front')

      expect(enemy).toBeUndefined()
    })

    it('COR_020 はランダムな味方1体に攻撃時の自身攻撃力ダメージ効果を付与する', () => {
      gameState.players[0].units.push(createUnit('ally_target', 2, 5, 2))

      const result = playUnit(gameState, 'cor_020', 0)
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.attackEffects).toContain('damage_front_unit_by_attack')
    })

    it('COR_020 はテスト環境と同じ盤面でも対象選択なしで場に出せる', () => {
      const state = createTestModeStateWithFriendlyTarget()

      const result = playUnit(state, 'cor_020', 0)
      const playedUnit = getUnitInLane(result.state, 'player1', 0)
      const ally = result.state.players[0].units.find((unit) => unit.id === 'test_friendly_target')

      expect(playedUnit?.cardId).toBe('cor_020')
      expect(ally?.attackEffects).toContain('damage_front_unit_by_attack')
    })

    it('COR_021 は自身にベールを付与する', () => {
      const result = playUnit(gameState, 'cor_021', 0)
      const unit = getUnitInLane(result.state, 'player1', 0)
      expect(unit?.statusEffects).toContain('veil')
    })

    it('COR_022 は相手がアクションを使うと即時攻撃する', () => {
      const played = playUnit(gameState, 'cor_022', 0)
      played.state.players[0].units.push(createUnit('ally_target', 1, 5, 2))

      const result = playActionAndResolve(played.state, 'cor_027', 'ally_target', 'player2')
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(unit?.attackGauge).toBe(1)
    })

    it('COR_023 は全味方ユニットの攻撃力を+1する', () => {
      gameState.players[0].units.push(createUnit('ally', 2, 5, 2))

      const result = playUnit(gameState, 'cor_023', 0)

      expect(getUnitInLane(result.state, 'player1', 0)?.attack).toBe(3)
      expect(result.state.players[0].units.find((unit) => unit.id === 'ally')?.attack).toBe(3)
    })

    it('COR_024 はランダムな味方1体に+2攻撃力を付与する', () => {
      gameState.players[0].units.push(createUnit('ally_target', 2, 5, 2))

      const result = playUnit(gameState, 'cor_024', 0)
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.attack).toBe(4)
    })

    it('COR_024 はテスト環境と同じ盤面でも対象選択なしで場に出せる', () => {
      const state = createTestModeStateWithFriendlyTarget()

      const result = playUnit(state, 'cor_024', 0)
      const playedUnit = getUnitInLane(result.state, 'player1', 0)
      const ally = result.state.players[0].units.find((unit) => unit.id === 'test_friendly_target')

      expect(playedUnit?.cardId).toBe('cor_024')
      expect(ally?.attack).toBe(4)
    })

    it('COR_025 は俊敏と自己攻撃力上昇の攻撃時効果を持つ', () => {
      const result = playUnit(gameState, 'cor_025', 0)
      const unit = getUnitInLane(result.state, 'player1', 0)

      expect(unit?.statusEffects).toContain('agility')
      expect(unit?.attackEffects).toContain('buff_self_attack:1')
    })

    it('COR_026 は各味方に正面敵の攻撃力ぶんの攻撃力を与える', () => {
      gameState.players[0].units.push(createUnit('ally', 1, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_left', 0, 5, 4))
      gameState.players[1].units.push(createUnit('enemy_center', 1, 5, 2))

      const result = playUnit(gameState, 'cor_026', 0)

      expect(getUnitInLane(result.state, 'player1', 0)?.attack).toBe(8)
      expect(result.state.players[0].units.find((unit) => unit.id === 'ally')?.attack).toBe(4)
    })
  })

  describe('赤アクション COR_027-COR_045', () => {
    it('COR_027 は敵ユニット1体に2ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_027', 'enemy_target')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(3)
    })

    it('COR_028 は対象に+3攻撃力と撃破時火種追加効果を付与する', () => {
      gameState.players[0].units.push(createUnit('ally_target', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_028', 'ally_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.attack).toBe(5)
      expect(ally?.decimateEffects).toContain('add_fire_seed_to_ex')
    })

    it('COR_029 はAR中6ダメージで撃破時に敵ヒーローへ1ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 6, 2))

      const result = playActionAndResolve(gameState, 'cor_029', 'enemy_target')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')).toBeUndefined()
      expect(result.state.players[1].hp).toBe(29)
    })

    it('COR_030 は墓地のアクションカードをEXへコピーする', () => {
      const result = playActionAndResolve(gameState, 'cor_030')
      expect(result.state.players[0].exPocket).toContain('cor_030')
    })

    it('COR_031 は対象に+2攻撃力とブロック不可を付与する', () => {
      gameState.players[0].units.push(createUnit('ally_target', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_031', 'ally_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.attack).toBe(4)
      expect(ally?.ignoreBlocker).toBe(true)
    })

    it('COR_032 は火種2枚追加・全体5ダメージ・敵ヒーロー3ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_a', 0, 8, 2))
      gameState.players[1].units.push(createUnit('enemy_b', 1, 8, 2))

      const result = playActionAndResolve(gameState, 'cor_032')

      expect(result.state.players[0].exPocket).toEqual(['cor_027', 'cor_027'])
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_a')?.hp).toBe(3)
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_b')?.hp).toBe(3)
      expect(result.state.players[1].hp).toBe(27)
    })

    it('COR_033 は敵ユニット1体に5ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 7, 2))
      const result = playActionAndResolve(gameState, 'cor_033', 'enemy_target')
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(2)
    })

    it('COR_034 は撃破時に正面味方へ+3/+3を与える', () => {
      gameState.players[0].units.push(createUnit('ally_front', 1, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_target', 1, 6, 2))

      const result = playActionAndResolve(gameState, 'cor_034', 'enemy_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_front')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')).toBeUndefined()
      expect(ally?.attack).toBe(5)
      expect(ally?.hp).toBe(8)
    })

    it('COR_035 は撃破時に最も近い味方へ+2/+2を与える', () => {
      gameState.players[0].units.push(createUnit('ally_near', 2, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_target', 2, 6, 2))

      const result = playActionAndResolve(gameState, 'cor_035', 'enemy_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_near')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')).toBeUndefined()
      expect(ally?.attack).toBe(4)
      expect(ally?.hp).toBe(7)
    })

    it('COR_036 は合計9ダメージを振り分ける', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 12, 2))
      const result = playActionAndResolve(gameState, 'cor_036')
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(3)
    })

    it('COR_037 は撃破時に正面味方へヒーロー攻撃権を与える', () => {
      gameState.players[0].units.push(createUnit('ally_front', 1, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_target', 1, 7, 2))

      const result = playActionAndResolve(gameState, 'cor_037', 'enemy_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_front')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')).toBeUndefined()
      expect(ally?.ignoreBlocker).toBe(true)
    })

    it('COR_038 は火種3枚以上なら対象6ダメージとEX火種消費ぶん敵ヒーローダメージ', () => {
      gameState.players[0].chainFireCount = { cor_027: 3 }
      gameState.players[0].exPocket = ['cor_027', 'cor_027']
      gameState.players[1].units.push(createUnit('enemy_target', 1, 10, 2))

      const result = playActionAndResolve(gameState, 'cor_038', 'enemy_target')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(4)
      expect(result.state.players[0].exPocket).toHaveLength(0)
      expect(result.state.players[1].hp).toBe(28)
    })

    it('COR_039 は火種使用回数×2ダメージを振り分ける', () => {
      gameState.players[0].chainFireCount = { cor_027: 2 }
      gameState.players[1].units.push(createUnit('enemy_target', 1, 7, 2))

      const result = playActionAndResolve(gameState, 'cor_039')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(3)
    })

    it('COR_040 は火種使用回数ぶん全敵と敵ヒーローに1ダメージする', () => {
      gameState.players[0].chainFireCount = { cor_027: 2 }
      gameState.players[1].units.push(createUnit('enemy_a', 0, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_b', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_040')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_a')?.hp).toBe(3)
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_b')?.hp).toBe(3)
      expect(result.state.players[1].hp).toBe(28)
    })

    it('COR_041 は破壊したら敵ヒーローに1ダメージ', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 4, 2))

      const result = playActionAndResolve(gameState, 'cor_041')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')).toBeUndefined()
      expect(result.state.players[1].hp).toBe(29)
    })

    it('COR_042 は合計5ダメージを振り分ける', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 7, 2))

      const result = playActionAndResolve(gameState, 'cor_042')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_target')?.hp).toBe(2)
    })

    it('COR_043 は2ダメージ後に対象へ効果ダメージ+2を付与する', () => {
      gameState.players[1].units.push(createUnit('enemy_target', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_043', 'enemy_target')
      const enemy = result.state.players[1].units.find((unit) => unit.id === 'enemy_target')

      expect(enemy?.hp).toBe(3)
      expect(enemy?.damageReduction).toBe(-2)
    })

    it('COR_044 は全敵2ダメージと反撃不能を付与する', () => {
      gameState.players[1].units.push(createUnit('enemy_a', 0, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_b', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_044')

      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_a')?.hp).toBe(3)
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_b')?.hp).toBe(3)
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_a')?.noCounterattack).toBe(
        true
      )
      expect(result.state.players[1].units.find((unit) => unit.id === 'enemy_b')?.noCounterattack).toBe(
        true
      )
    })

    it('COR_045 は正面に敵がいれば+5攻撃力', () => {
      gameState.players[0].units.push(createUnit('ally_target', 1, 5, 2))
      gameState.players[1].units.push(createUnit('enemy_front', 1, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_045', 'ally_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.attack).toBe(7)
    })

    it('COR_045 は正面に敵がいなければ+1攻撃力と連撃', () => {
      gameState.players[0].units.push(createUnit('ally_target', 2, 5, 2))

      const result = playActionAndResolve(gameState, 'cor_045', 'ally_target')
      const ally = result.state.players[0].units.find((unit) => unit.id === 'ally_target')

      expect(ally?.attack).toBe(3)
      expect(ally?.statusEffects).toContain('combo')
    })
  })

  describe('補助確認', () => {
    it('赤カード45枚のマッピングが定義されている', () => {
      const allIds = Array.from(cardMap.keys())
      const redIds = allIds.filter((cardId) => cardId.startsWith('cor_0'))

      expect(allIds.length).toBeGreaterThan(0)
      expect(allIds.length).toBeGreaterThan(45)
      expect(redIds.length).toBeGreaterThan(0)
    })

    it('赤の新カード45枚分のeffectFunctionsが存在する', () => {
      const redMappings = Array.from(cardMap.keys()).filter((cardId) => {
        if (!cardId.startsWith('cor_0')) {
          return false
        }

        const card = cardMap.get(cardId)
        if (!card) {
          return false
        }

        if (card.attribute !== 'red') {
          return false
        }

        const number = Number.parseInt(cardId.split('_')[1] || '0', 10)
        if (number < 1 || number > 45) {
          return false
        }

        return true
      })

      expect(redMappings).toHaveLength(45)
    })

    it('攻撃トリガーのカードは時間経過で攻撃処理に進める', () => {
      gameState.players[1].units.push(createUnit('enemy_front', 0, 8, 1))
      const played = playUnit(gameState, 'cor_008', 0)
      const result = advanceTime(played.state, 10000)

      expect(getUnitInLane(result.state, 'player2', 0)).toBeUndefined()
      expect(getUnitInLane(result.state, 'player1', 0)?.hp).toBe(2)
    })
  })
})
