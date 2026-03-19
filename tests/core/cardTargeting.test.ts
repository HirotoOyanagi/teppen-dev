import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  cardRequiresTargetSelection,
  getCardTargetType,
} from '@/core/cardTargeting'
import { shouldEnterCardTargetMode } from '@/core/cardPlayFlow'
import { loadCardsFromCsv } from '@/core/csvLoader'
import { applyTestModeSetup } from '@/core/testMode'
import type { CardDefinition, GameState, Hero, PlayerState, Unit } from '@/core/types'

function makeCard(overrides: Partial<CardDefinition>): CardDefinition {
  return {
    id: 'test_card',
    name: 'Test Card',
    cost: 1,
    type: 'unit',
    attribute: 'red',
    rarity: 'normal',
    tribe: 'other',
    ...overrides,
  }
}

const csvPath = path.join(process.cwd(), 'public', '新カードCore - カードデータのスプレッドシート化.csv')
const csvText = readFileSync(csvPath, 'utf8')
const loadedCards = loadCardsFromCsv(csvText)

const testHero: Hero = {
  id: 'test_hero',
  name: 'Test Hero',
  attribute: 'red',
}

function createUnit(id: string, lane: number): Unit {
  return {
    id,
    cardId: 'test_card',
    hp: 5,
    maxHp: 5,
    attack: 2,
    attackGauge: 0,
    attackInterval: 10000,
    lane,
  }
}

function createState(): GameState {
  const player1: PlayerState = {
    playerId: 'player1',
    hp: 30,
    maxHp: 30,
    mp: 10,
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
    mp: 10,
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
    gameId: 'test',
    phase: 'playing',
    currentTick: 0,
    lastUpdateTime: Date.now(),
    gameStartTime: Date.now(),
    randomSeed: 1,
    mulliganDone: [true, true],
    players: [player1, player2],
    activeResponse: {
      isActive: false,
      currentPlayerId: 'player1',
      stack: [],
      timer: 0,
      passedPlayers: [],
    },
    timeRemainingMs: 5 * 60 * 1000,
  }
}

function createTestModeStateWithFriendlyTarget(): GameState {
  const cardMap = new Map(loadedCards.map((card) => [card.id, card]))
  const state = applyTestModeSetup(createState(), cardMap)
  state.players[0].units.push(createUnit('test_friendly_target', 2))
  return state
}

describe('cardTargeting', () => {
  it('CSV上で target 指定を持つ全ユニットは存在しない', () => {
    const unitCardsWithTarget = loadedCards.filter(
      (card) => card.type === 'unit' && card.effectFunctions?.includes('target:')
    )

    expect(unitCardsWithTarget).toHaveLength(0)
  })

  it('target指定を持つアクションは対象選択必須にする', () => {
    const actionCard = makeCard({
      id: 'cor_027',
      type: 'action',
      effectFunctions: 'target:enemy_unit;damage_target:2',
    })

    expect(cardRequiresTargetSelection(actionCard)).toBe(true)
    expect(getCardTargetType(actionCard)).toBe('enemy_unit')
  })

  it('CSV上で target 指定を持つ全アクションはクライアントで対象選択必須にする', () => {
    const actionCardsWithTarget = loadedCards.filter(
      (card) => card.type === 'action' && card.effectFunctions?.includes('target:')
    )

    expect(actionCardsWithTarget.length).toBeGreaterThan(0)
    for (const card of actionCardsWithTarget) {
      expect(cardRequiresTargetSelection(card), card.id).toBe(true)
      expect(getCardTargetType(card), card.id).not.toBeNull()
    }
  })

  it.each(['cor_011', 'cor_013', 'cor_018', 'cor_019', 'cor_020', 'cor_024'])(
    '%s はテスト環境でも対象選択なしでそのまま出せる',
    (cardId) => {
      const state = createTestModeStateWithFriendlyTarget()
      const card = loadedCards.find((loadedCard) => loadedCard.id === cardId)

      expect(card).toBeDefined()
      expect(shouldEnterCardTargetMode(state, 'player1', card!)).toBe(false)
    }
  )

  it('対象指定アクションは対象が渡されるまでは常に対象選択モードに入る', () => {
    const state = createState()
    const actionCard = makeCard({
      id: 'cor_027',
      type: 'action',
      effectFunctions: 'target:enemy_unit;damage_target:2',
    })

    expect(shouldEnterCardTargetMode(state, 'player1', actionCard)).toBe(true)
    expect(shouldEnterCardTargetMode(state, 'player1', actionCard, 'enemy')).toBe(false)
  })
})
