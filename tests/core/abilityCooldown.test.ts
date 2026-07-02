import { describe, expect, it } from 'vitest'

import { updateGameState } from '@/core/engine'
import type { CardDefinition, GameState, Hero, PlayerState } from '@/core/types'

const hero: Hero = {
  id: 'test_hero',
  name: 'Test Hero',
  attribute: 'red',
  heroArt: { name: 'Test Art', cost: 1, description: 'test' },
  companion: { name: 'Test Companion', cost: 1, description: 'test' },
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

const cardMap = new Map<string, CardDefinition>([[actionCard.id, actionCard]])

function createPlayer(playerId: string, hand: string[] = []): PlayerState {
  return {
    playerId,
    hp: 30,
    maxHp: 30,
    mp: 5,
    maxMp: 10,
    blueMp: 0,
    ap: 5,
    hero,
    hand,
    deck: [],
    units: [],
    graveyard: [],
    exPocket: [],
  }
}

function createState(player1: PlayerState, player2: PlayerState): GameState {
  return {
    gameId: 'ability_cooldown_test',
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

describe('必殺技・おともの15秒クールタイム', () => {
  it('必殺技を使うとAP消費とともに15秒のクールタイムが始まる', () => {
    const used = updateGameState(
      createState(createPlayer('p1'), createPlayer('p2')),
      { type: 'hero_art', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(used.players[0].ap).toBe(4)
    expect(used.players[0].heroArtCooldownMs).toBe(15000)
  })

  it('クールタイム中の必殺技は無視される', () => {
    const used = updateGameState(
      createState(createPlayer('p1'), createPlayer('p2')),
      { type: 'hero_art', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state

    const usedAgain = updateGameState(
      used,
      { type: 'hero_art', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(usedAgain.players[0].ap).toBe(4)
    expect(usedAgain.players[0].heroArtCooldownMs).toBe(15000)
  })

  it('クールタイムは時間経過で減り、15秒後に再使用できる', () => {
    const used = updateGameState(
      createState(createPlayer('p1'), createPlayer('p2')),
      { type: 'hero_art', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state

    const half = updateGameState(used, null, 5000, cardMap).state
    expect(half.players[0].heroArtCooldownMs).toBe(10000)

    const done = updateGameState(half, null, 10000, cardMap).state
    expect(done.players[0].heroArtCooldownMs).toBe(0)

    const reused = updateGameState(
      done,
      { type: 'hero_art', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state
    expect(reused.players[0].ap).toBe(3)
    expect(reused.players[0].heroArtCooldownMs).toBe(15000)
  })

  it('AR中（静止中）はクールタイムが進まない', () => {
    const used = updateGameState(
      createState(createPlayer('p1', ['action_card']), createPlayer('p2')),
      { type: 'hero_art', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state

    const inAr = updateGameState(
      used,
      { type: 'play_card', playerId: 'p1', cardId: 'action_card', timestamp: Date.now() },
      0,
      cardMap
    ).state
    expect(inAr.activeResponse.isActive).toBe(true)

    const ticked = updateGameState(inAr, null, 5000, cardMap).state
    expect(ticked.players[0].heroArtCooldownMs).toBe(15000)
  })

  it('おともにも独立した15秒クールタイムがかかる', () => {
    const used = updateGameState(
      createState(createPlayer('p1'), createPlayer('p2')),
      { type: 'companion', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state

    expect(used.players[0].ap).toBe(4)
    expect(used.players[0].companionCooldownMs).toBe(15000)
    // 必殺技側のクールタイムには影響しない
    expect(used.players[0].heroArtCooldownMs ?? 0).toBe(0)

    const usedAgain = updateGameState(
      used,
      { type: 'companion', playerId: 'p1', timestamp: Date.now() },
      0,
      cardMap
    ).state
    expect(usedAgain.players[0].ap).toBe(4)
  })
})
