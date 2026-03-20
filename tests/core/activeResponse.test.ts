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

const freeActionCard: CardDefinition = {
  id: 'free_action',
  name: 'Free Action',
  cost: 0,
  type: 'action',
  attribute: 'red',
  rarity: 'normal',
  tribe: 'other',
  effectFunctions: 'damage_enemy_hero:1',
}

const cardMap = new Map<string, CardDefinition>([
  [actionCard.id, actionCard],
  [heavyActionCard.id, heavyActionCard],
  [shieldActionCard.id, shieldActionCard],
  [freeActionCard.id, freeActionCard],
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

  it('AR開始時、お互いにAMP+2が付与される', () => {
    const entered = updateGameState(
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

    expect(entered.players[0].blueMp).toBe(2)
    expect(entered.players[1].blueMp).toBe(2)
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
    // p2はAMPをコストに使用したので0。p1はAR開始時にもらったAMP2を保持
    expect(responded.players[1].blueMp).toBe(0)
    expect(responded.players[0].blueMp).toBe(2)
  })

  it('3ラリー（自分→相手→自分）時、AMPはAR開始時のみ付与される', () => {
    // P1がアクション → P2がアクション → P1がアクション
    // AMPはAR開始時のみお互いに+2。追加アクションでは付与されない
    const r1 = updateGameState(
      createState(
        createPlayer('p1', ['action_card', 'action_card'], 5),
        createPlayer('p2', ['action_card'], 5)
      ),
      { type: 'play_card', playerId: 'p1', cardId: 'action_card', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(r1.players[1].blueMp).toBe(2)

    const r2 = updateGameState(
      r1,
      { type: 'active_response_action', playerId: 'p2', cardId: 'action_card', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(r2.players[0].blueMp).toBe(2)
    expect(r2.players[1].blueMp).toBe(1)

    const r3 = updateGameState(
      r2,
      { type: 'active_response_action', playerId: 'p1', cardId: 'action_card', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(r3.players[1].blueMp).toBeLessThanOrEqual(3)
    expect(r3.players[1].blueMp).not.toBe(4)
  })

  it('3ラリーで相手がコスト0アクションを使う場合も、相手の青MPが4溜まらないこと', () => {
    // P1→P2(free_action)→P1。P2はコスト0なのでAMPを消費しない。誤りならP2が4になる
    const r1 = updateGameState(
      createState(
        createPlayer('p1', ['action_card', 'action_card'], 5),
        createPlayer('p2', ['free_action'], 5)
      ),
      { type: 'play_card', playerId: 'p1', cardId: 'action_card', timestamp: Date.now() },
      0,
      cardMap
    ).state

    const r2 = updateGameState(
      r1,
      { type: 'active_response_action', playerId: 'p2', cardId: 'free_action', timestamp: Date.now() },
      0,
      cardMap
    ).state

    const r3 = updateGameState(
      r2,
      { type: 'active_response_action', playerId: 'p1', cardId: 'action_card', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(r3.players[1].blueMp).not.toBe(4)
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

    // 1000msで1枚目(shield_action)解決
    const afterFirstResolve = updateGameState(resolvingStarted, null, 1000, cardMap).state
    expect(afterFirstResolve.activeResponse.isActive).toBe(true)
    expect(afterFirstResolve.activeResponse.currentResolvingItem?.cardId).toBe('action_card')
    expect(afterFirstResolve.players[1].shieldCount ?? 0).toBe(1)
    expect(afterFirstResolve.players[1].hp).toBe(30)

    // 2枚目解決直前（1msだけ進める）
    const beforeSecondResolve = updateGameState(afterFirstResolve, null, 1, cardMap).state
    expect(beforeSecondResolve.activeResponse.isActive).toBe(true)
    expect(beforeSecondResolve.players[1].shieldCount ?? 0).toBe(1)

    const resolved = updateGameState(beforeSecondResolve, null, 1000, cardMap).state
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
