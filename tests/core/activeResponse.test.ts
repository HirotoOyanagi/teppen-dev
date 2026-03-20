import { describe, expect, it } from 'vitest'

import { updateGameState } from '@/core/engine'
import type { CardDefinition, GameState, Hero, PlayerState, Unit } from '@/core/types'

const hero: Hero = {
  id: 'test_hero',
  name: 'Test Hero',
  attribute: 'red',
}

const actionCard: CardDefinition = {
  id: 'action_card',
  name: 'Action Card',
  cost: 1,
  type: 'action',
  attribute: 'red',
  rarity: 'normal',
  tribe: 'other',
  effectFunctions: 'damage_enemy_hero:1',
}

const heavyActionCard: CardDefinition = {
  id: 'heavy_action',
  name: 'Heavy Action',
  cost: 4,
  type: 'action',
  attribute: 'red',
  rarity: 'normal',
  tribe: 'other',
  effectFunctions: 'damage_enemy_hero:1',
}

const shieldActionCard: CardDefinition = {
  id: 'shield_action',
  name: 'Shield Action',
  cost: 1,
  type: 'action',
  attribute: 'green',
  rarity: 'normal',
  tribe: 'other',
  effectFunctions: 'shield:1',
}

const cardMap = new Map<string, CardDefinition>([
  [actionCard.id, actionCard],
  [heavyActionCard.id, heavyActionCard],
  [shieldActionCard.id, shieldActionCard],
])

function createPlayer(playerId: string, hand: string[] = [], mp: number = 5): PlayerState {
  return {
    playerId,
    hp: 30,
    maxHp: 30,
    mp,
    maxMp: 10,
    blueMp: 0,
    ap: 0,
    hero,
    hand,
    deck: [],
    units: [],
    graveyard: [],
    exPocket: [],
  }
}

function createUnit(unitId: string): Unit {
  return {
    id: unitId,
    cardId: 'unit_card',
    hp: 5,
    maxHp: 5,
    attack: 2,
    attackGauge: 0.25,
    attackInterval: 1000,
    lane: 0,
  }
}

function createState(player1: PlayerState, player2: PlayerState): GameState {
  return {
    gameId: 'active_response_test',
    currentTick: 0,
    phase: 'playing',
    activeResponse: {
      isActive: false,
      status: 'building',
      currentPlayerId: null,
      stack: [],
      resolvingStack: [],
      currentResolvingItem: null,
      timer: 0,
      passedPlayers: [],
    },
    players: [player1, player2],
    mulliganDone: [true, true],
    randomSeed: 1,
    gameStartTime: Date.now() - 1000,
    lastUpdateTime: Date.now() - 1000,
    timeRemainingMs: 60_000,
  }
}

describe('active response system', () => {
  it('AR中は通常時間進行と攻撃ゲージと通常MP自然回復が止まる', () => {
    const player1 = createPlayer('p1', ['action_card'], 5)
    const player2 = createPlayer('p2', [], 5)
    player1.units.push(createUnit('u1'))

    const entered = updateGameState(
      createState(player1, player2),
      {
        type: 'play_card',
        playerId: 'p1',
        cardId: 'action_card',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    const beforeTick = entered.players[0]
    const beforeGauge = beforeTick.units[0].attackGauge
    const beforeTime = entered.timeRemainingMs

    const afterTick = updateGameState(entered, null, 1000, cardMap).state

    expect(afterTick.activeResponse.isActive).toBe(true)
    expect(afterTick.players[0].mp).toBe(beforeTick.mp)
    expect(afterTick.players[0].units[0].attackGauge).toBe(beforeGauge)
    expect(afterTick.timeRemainingMs).toBe(beforeTime)
    expect(afterTick.activeResponse.timer).toBe(9000)
  })

  it('AR中のコスト支払いはAMPを優先し、不足分だけ通常MPを使う', () => {
    const entered = updateGameState(
      createState(
        createPlayer('p1', ['action_card'], 5),
        createPlayer('p2', ['heavy_action'], 5)
      ),
      {
        type: 'play_card',
        playerId: 'p1',
        cardId: 'action_card',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    const responded = updateGameState(
      entered,
      {
        type: 'active_response_action',
        playerId: 'p2',
        cardId: 'heavy_action',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    expect(responded.players[1].mp).toBe(3)
    expect(responded.players[1].blueMp).toBe(2)
  })

  it('積まれたアクションは逆順で解決され、終了時にAMPが消える', () => {
    const started = updateGameState(
      createState(
        createPlayer('p1', ['action_card'], 5),
        createPlayer('p2', ['shield_action'], 5)
      ),
      {
        type: 'play_card',
        playerId: 'p1',
        cardId: 'action_card',
        target: 'p2',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    const stacked = updateGameState(
      started,
      {
        type: 'active_response_action',
        playerId: 'p2',
        cardId: 'shield_action',
        target: 'p2',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    const resolvingStarted = updateGameState(
      stacked,
      {
        type: 'end_active_response',
        playerId: 'p1',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    expect(resolvingStarted.activeResponse.isActive).toBe(true)
    expect(resolvingStarted.activeResponse.status).toBe('resolving')
    expect(resolvingStarted.activeResponse.currentResolvingItem?.cardId).toBe('shield_action')
    expect(resolvingStarted.players[1].hp).toBe(30)
    expect(resolvingStarted.players[1].shieldCount ?? 0).toBe(0)

    const beforeSecondResolve = updateGameState(resolvingStarted, null, 2999, cardMap).state
    expect(beforeSecondResolve.activeResponse.isActive).toBe(true)
    expect(beforeSecondResolve.players[1].hp).toBe(30)
    expect(beforeSecondResolve.players[1].shieldCount ?? 0).toBe(0)

    const afterFirstResolve = updateGameState(beforeSecondResolve, null, 1, cardMap).state
    expect(afterFirstResolve.activeResponse.isActive).toBe(true)
    expect(afterFirstResolve.activeResponse.currentResolvingItem?.cardId).toBe('action_card')
    expect(afterFirstResolve.players[1].shieldCount ?? 0).toBe(1)
    expect(afterFirstResolve.players[1].hp).toBe(30)

    const resolved = updateGameState(afterFirstResolve, null, 3000, cardMap).state
    expect(resolved.activeResponse.isActive).toBe(false)
    expect(resolved.players[0].blueMp).toBe(0)
    expect(resolved.players[1].blueMp).toBe(0)
    expect(resolved.players[1].hp).toBe(30)
    expect(resolved.players[1].shieldCount ?? 0).toBe(0)
  })

  it('AR終了は現在の優先権を持つプレイヤーだけが実行できる', () => {
    const started = updateGameState(
      createState(
        createPlayer('p1', ['action_card'], 5),
        createPlayer('p2', [], 5)
      ),
      {
        type: 'play_card',
        playerId: 'p1',
        cardId: 'action_card',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    expect(started.activeResponse.currentPlayerId).toBe('p2')

    const invalidEnd = updateGameState(
      started,
      {
        type: 'end_active_response',
        playerId: 'p1',
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    expect(invalidEnd.activeResponse.status).toBe('building')
    expect(invalidEnd.activeResponse.isActive).toBe(true)
    expect(invalidEnd.activeResponse.currentPlayerId).toBe('p2')
  })
})
