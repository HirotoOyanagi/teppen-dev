import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { loadCardsFromCsv } from '@/core/csvLoader'
import { updateGameState } from '@/core/engine'
import { HEROES } from '@/core/heroes'
import { cardRequiresTargetSelection, getCardTargetType } from '@/core/cardTargeting'
import type { CardDefinition, GameEvent, GameInput, GameState, Hero, PlayerState, Unit } from '@/core/types'

type HarnessPlayerId = 'player1' | 'player2'

type AuditEntry = {
  cardId: string
  name: string
  success: boolean
  message: string
  events: GameEvent[]
  state: GameState
}

const STATE_DIR = path.join(process.cwd(), 'tmp')
const STATE_FILE = path.join(STATE_DIR, 'battle-harness-state.json')
const CSV_PATH = path.join(process.cwd(), 'public', '新カードCore - カードデータのスプレッドシート化.csv')

const TEST_HERO_1: Hero = HEROES[0] ?? {
  id: 'harness_hero_1',
  name: 'Harness Hero 1',
  attribute: 'red',
}

const TEST_HERO_2: Hero = HEROES[1] ?? HEROES[0] ?? {
  id: 'harness_hero_2',
  name: 'Harness Hero 2',
  attribute: 'green',
}

const csvText = readFileSync(CSV_PATH, 'utf8')
const loadedCards = loadCardsFromCsv(csvText)
const cardMap = new Map<string, CardDefinition>(loadedCards.map((card) => [card.id, card]))

function normalizeCardId(cardId: string): string {
  return cardId.trim().toLowerCase()
}

function parseArgs(argv: string[]): { command: string; positionals: string[]; flags: Record<string, string | boolean> } {
  const [command = '', ...rest] = argv
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const key = token.slice(2)
    const next = rest[i + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      i += 1
      continue
    }
    flags[key] = true
  }

  return { command, positionals, flags }
}

function createPlayer(playerId: HarnessPlayerId, hero: Hero): PlayerState {
  return {
    playerId,
    hp: 30,
    maxHp: 30,
    mp: 20,
    maxMp: 20,
    blueMp: 0,
    ap: 0,
    hero,
    hand: [],
    deck: [],
    graveyard: [],
    units: [],
    exPocket: [],
  }
}

function createBaseState(): GameState {
  return {
    gameId: 'battle_harness',
    phase: 'playing',
    currentTick: 0,
    lastUpdateTime: Date.now(),
    gameStartTime: Date.now(),
    randomSeed: 12345,
    mulliganDone: [true, true],
    players: [createPlayer('player1', TEST_HERO_1), createPlayer('player2', TEST_HERO_2)],
    activeResponse: {
      isActive: false,
      status: 'building',
      currentPlayerId: 'player1',
      stack: [],
      resolvingStack: [],
      currentResolvingItem: null,
      timer: 0,
      passedPlayers: [],
    },
    timeRemainingMs: 5 * 60 * 1000,
  }
}

function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true })
  }
}

function saveState(state: GameState): void {
  ensureStateDir()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function loadState(): GameState {
  if (!existsSync(STATE_FILE)) {
    const state = createBaseState()
    saveState(state)
    return state
  }

  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as GameState
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createUnit(id: string, lane: number, hp: number, attack: number, cardId: string = 'cor_001'): Unit {
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

function getPlayerIndex(playerId: HarnessPlayerId): 0 | 1 {
  return playerId === 'player1' ? 0 : 1
}

function getOpponentIndex(playerId: HarnessPlayerId): 0 | 1 {
  return playerId === 'player1' ? 1 : 0
}

function createPreparedState(playerId: HarnessPlayerId, card: CardDefinition): GameState {
  const state = createBaseState()
  const playerIndex = getPlayerIndex(playerId)
  const opponentIndex = getOpponentIndex(playerId)
  const player = state.players[playerIndex]
  const opponent = state.players[opponentIndex]

  player.units.push(createUnit(`${playerId}_ally_target`, 2, 5, 2))
  opponent.units.push(createUnit(`${playerId}_enemy_target`, 1, 6, 2))

  if (card.type === 'unit' && card.effectFunctions?.includes('awakening:')) {
    player.units.push(createUnit(`${playerId}_awakening_target`, 0, 5, 2))
  }

  return state
}

function getDefaultTarget(state: GameState, playerId: HarnessPlayerId, card: CardDefinition): string | undefined {
  if (card.type === 'unit' && card.effectFunctions?.includes('awakening:')) {
    return `${playerId}_awakening_target`
  }

  const targetType = getCardTargetType(card)
  if (!targetType) return undefined
  if (targetType === 'friendly_hero') {
    return state.players[getPlayerIndex(playerId)].playerId
  }
  if (targetType === 'friendly_unit') {
    return `${playerId}_ally_target`
  }
  return `${playerId}_enemy_target`
}

function getDefaultLane(card: CardDefinition): number | undefined {
  if (card.type !== 'unit') return undefined
  return 0
}

function stringifyState(state: GameState): string {
  return JSON.stringify(state)
}

function resolvePendingActiveResponse(state: GameState, playerId: HarnessPlayerId): { state: GameState; events: GameEvent[] } {
  let current = state
  const events: GameEvent[] = []
  let guard = 0

  while (current.activeResponse.isActive && guard < 20) {
    if (current.activeResponse.status === 'building') {
      const resolverId = (current.activeResponse.currentPlayerId ?? playerId) as HarnessPlayerId
      const endInput: GameInput = {
        type: 'end_active_response',
        playerId: resolverId,
        timestamp: Date.now(),
      }
      const result = updateGameState(current, endInput, 0, cardMap)
      current = result.state
      events.push(...result.events)
      guard += 1
      continue
    }

    const waitMs = Math.max(1, current.activeResponse.timer || 3000)
    const result = updateGameState(current, null, waitMs, cardMap)
    current = result.state
    events.push(...result.events)
    guard += 1
  }

  return { state: current, events }
}

function playOnState(
  inputState: GameState,
  playerId: HarnessPlayerId,
  cardId: string,
  lane?: number,
  target?: string
): { success: boolean; message: string; events: GameEvent[]; state: GameState } {
  const normalizedCardId = normalizeCardId(cardId)
  const card = cardMap.get(normalizedCardId)

  if (!card) {
    return {
      success: false,
      message: `unknown_card:${cardId}`,
      events: [],
      state: inputState,
    }
  }

  const before = stringifyState(inputState)
  const input: GameInput = {
    type: 'play_card',
    playerId,
    cardId: normalizedCardId,
    lane,
    target,
    freePlay: true,
    timestamp: Date.now(),
  }

  const result = updateGameState(inputState, input, 0, cardMap)
  const resolved = resolvePendingActiveResponse(result.state, playerId)
  const after = stringifyState(resolved.state)
  const events = [...result.events, ...resolved.events]
  const stateChanged = before !== after

  if (!stateChanged) {
    return {
      success: false,
      message: 'no_state_change',
      events,
      state: resolved.state,
    }
  }

  return {
    success: true,
    message: 'ok',
    events,
    state: resolved.state,
  }
}

function summarizeState(state: GameState) {
  return {
    phase: state.phase,
    activeResponse: state.activeResponse,
    players: state.players.map((player) => ({
      playerId: player.playerId,
      hp: player.hp,
      mp: player.mp,
      ap: player.ap,
      hand: player.hand,
      deckCount: player.deck.length,
      graveyard: player.graveyard,
      exPocket: player.exPocket,
      units: player.units.map((unit) => ({
        id: unit.id,
        cardId: unit.cardId,
        lane: unit.lane,
        hp: unit.hp,
        attack: unit.attack,
        statusEffects: unit.statusEffects ?? [],
      })),
    })),
  }
}

function runAuditForCard(playerId: HarnessPlayerId, rawCardId: string): AuditEntry {
  const cardId = normalizeCardId(rawCardId)
  const card = cardMap.get(cardId)

  if (!card) {
    const state = createBaseState()
    return {
      cardId,
      name: rawCardId,
      success: false,
      message: `unknown_card:${rawCardId}`,
      events: [],
      state,
    }
  }

  const state = createPreparedState(playerId, card)
  const lane = getDefaultLane(card)
  const target = getDefaultTarget(state, playerId, card)
  const result = playOnState(state, playerId, cardId, lane, target)

  return {
    cardId,
    name: card.name,
    success: result.success,
    message: result.message,
    events: result.events,
    state: result.state,
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

function handleReset(): void {
  const state = createBaseState()
  saveState(state)
  printJson({
    ok: true,
    command: 'reset',
    state: summarizeState(state),
  })
}

function handleState(): void {
  const state = loadState()
  printJson({
    ok: true,
    command: 'state',
    state: summarizeState(state),
  })
}

function handlePlay(positionals: string[], flags: Record<string, string | boolean>): void {
  const [rawPlayerId, rawCardId] = positionals
  if ((rawPlayerId !== 'player1' && rawPlayerId !== 'player2') || !rawCardId) {
    throw new Error('usage: play <player1|player2> <CARD_ID> [--lane N] [--target unitId]')
  }

  const playerId = rawPlayerId as HarnessPlayerId
  const cardId = normalizeCardId(rawCardId)
  const card = cardMap.get(cardId)
  if (!card) {
    throw new Error(`unknown card: ${rawCardId}`)
  }

  const lane = typeof flags.lane === 'string' ? Number(flags.lane) : getDefaultLane(card)
  const state = loadState()
  const target = typeof flags.target === 'string' ? flags.target : getDefaultTarget(state, playerId, card)
  const result = playOnState(state, playerId, cardId, lane, target)
  saveState(result.state)

  printJson({
    ok: result.success,
    command: 'play',
    player: playerId,
    cardId: rawCardId,
    lane: lane ?? null,
    target: target ?? null,
    message: result.message,
    events: result.events,
    state: summarizeState(result.state),
  })
}

function handleAudit(flags: Record<string, string | boolean>): void {
  const rawPlayerId = flags.player
  if (rawPlayerId !== 'player1' && rawPlayerId !== 'player2') {
    throw new Error('usage: audit --player <player1|player2> [--card CARD_ID]')
  }

  const playerId = rawPlayerId as HarnessPlayerId
  const singleCard = typeof flags.card === 'string' ? normalizeCardId(flags.card) : null
  const cards = singleCard ? loadedCards.filter((card) => card.id === singleCard) : loadedCards

  const results = cards.map((card) => runAuditForCard(playerId, card.id))
  const succeeded = results.filter((entry) => entry.success)
  const failed = results.filter((entry) => !entry.success)

  if (singleCard) {
    const entry = results[0]
    printJson({
      ok: entry?.success ?? false,
      command: 'audit',
      player: playerId,
      cardId: singleCard,
      message: entry?.message ?? 'card_not_loaded',
      events: entry?.events ?? [],
      state: entry ? summarizeState(entry.state) : null,
    })
    return
  }

  printJson({
    ok: failed.length === 0,
    command: 'audit',
    player: playerId,
    total: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    failures: failed.map((entry) => ({
      cardId: entry.cardId,
      name: entry.name,
      message: entry.message,
    })),
  })
}

function main(): void {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2))

  switch (command) {
    case 'reset':
      handleReset()
      return
    case 'state':
      handleState()
      return
    case 'play':
      handlePlay(positionals, flags)
      return
    case 'audit':
      handleAudit(flags)
      return
    default:
      throw new Error('usage: reset | state | play <player> <CARD_ID> | audit --player <player> [--card CARD_ID]')
  }
}

main()
