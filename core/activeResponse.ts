import type {
  ActiveResponseStack,
  ActiveResponseState,
  CardDefinition,
  GameEvent,
  GameState,
  PlayerState,
} from './types'
import { resolveCardDefinition } from './cardId'

export const ACTIVE_RESPONSE_CONFIG = {
  TIMER_MS: 10000,
  /** AR開始時のみ、お互いに付与 */
  AMP_GAIN_ON_START: 2,
  /** AR中はAMPが最大2まで */
  MAX_AMP_DURING_AR: 2,
  RESOLVE_STEP_DELAY_MS: 1000,
} as const

export type PaymentResult = {
  player: PlayerState
  paidBlueMp: number
  paidNormalMp: number
}

/** AMP 支払い結果（設計ドキュメント用） */
export interface AmpPaymentResult {
  success: boolean
  mp: number
  blueMp: number
}

/** アクション効果解決関数の型（engine から渡される） */
export type ResolveActionEffectFn = (
  state: GameState,
  playerId: string,
  cardDef: CardDefinition,
  cardDefinitions: Map<string, CardDefinition>,
  stackItem: ActiveResponseStack
) => { state: GameState; events: GameEvent[] }

/**
 * AMP を先に消費し、残りを通常 MP から消費する
 * @returns 支払い可能なら success: true、不可能なら success: false（元の値を返す）
 */
export function payMpWithAmp(mp: number, blueMp: number, cost: number): AmpPaymentResult {
  const available = mp + blueMp
  if (available < cost) {
    return { success: false, mp, blueMp }
  }

  let remainingCost = cost
  let newBlueMp = blueMp
  let newMp = mp

  if (newBlueMp >= remainingCost) {
    newBlueMp -= remainingCost
    remainingCost = 0
  } else {
    remainingCost -= newBlueMp
    newBlueMp = 0
  }
  newMp -= remainingCost

  return { success: true, mp: newMp, blueMp: newBlueMp }
}

/**
 * AR を終了してよいか判定
 * 両方パスした、または timer が 0 以下なら true
 */
export function canArEnd(ar: ActiveResponseState, playerIds: string[]): boolean {
  const bothPassed = playerIds.every((id) => ar.passedPlayers.includes(id))
  const timerExpired = ar.timer <= 0
  const onePassedAndStackEmpty =
    ar.passedPlayers.length === 1 && ar.stack.length === 0

  return bothPassed || timerExpired || onePassedAndStackEmpty
}

/**
 * 次の AR アクション権限者を取得
 * 2人対戦想定
 */
export function getNextArPlayer(
  current: string | null,
  playerIds: string[]
): string | null {
  if (playerIds.length < 2) return null
  if (!current) return playerIds[0]

  const idx = playerIds.indexOf(current)
  if (idx === -1) return playerIds[0]
  const nextIdx = (idx + 1) % playerIds.length
  return playerIds[nextIdx]
}

/**
 * 対象 ID がユニットまたはヒーロー（playerId）として存在するか検証
 */
export function isTargetValid(state: GameState, targetId: string): boolean {
  for (const player of state.players) {
    const unitExists = player.units.some((u) => u.id === targetId)
    if (unitExists) return true
    const heroExists = player.playerId === targetId
    if (heroExists) return true
  }
  return false
}

/**
 * AR スタックを LIFO 順で解決
 * 対象検証を実施し、無効な対象のスタックアイテムはスキップ
 * 終了時に全プレイヤーの blueMp = 0
 */
export function resolveArStack(
  state: GameState,
  cardDefinitions: Map<string, CardDefinition>,
  resolveActionEffect: ResolveActionEffectFn
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  const resolvedStack = [...newState.activeResponse.stack].reverse()

  events.push({
    type: 'active_response_resolved',
    stack: resolvedStack,
    timestamp: Date.now(),
  })

  for (const stackItem of resolvedStack) {
    const cardDef = resolveCardDefinition(cardDefinitions, stackItem.cardId)
    if (!cardDef || cardDef.type !== 'action') continue

    if (stackItem.target && !isTargetValid(newState, stackItem.target)) {
      continue
    }

    const effectResult = resolveActionEffect(
      newState,
      stackItem.playerId,
      cardDef,
      cardDefinitions,
      stackItem
    )
    newState = effectResult.state
    events.push(...effectResult.events)
  }

  newState.players = newState.players.map((player) => ({
    ...player,
    blueMp: 0,
  })) as GameState['players']

  newState.activeResponse = {
    isActive: false,
    status: 'building',
    currentPlayerId: null,
    stack: [],
    resolvingStack: [],
    currentResolvingItem: null,
    timer: 0,
    passedPlayers: [],
  }

  return { state: newState, events }
}

export function beginArResolution(
  state: GameState,
  cardDefinitions: Map<string, CardDefinition>,
  resolveActionEffect: ResolveActionEffectFn
): { state: GameState; events: GameEvent[] } {
  const resolvingStack = [...state.activeResponse.stack].reverse()
  if (resolvingStack.length === 0) {
    return {
      state: clearActiveResponse(state),
      events: [
        {
          type: 'active_response_resolved',
          stack: [],
          timestamp: Date.now(),
        },
      ],
    }
  }

  const startedState: GameState = {
    ...state,
    activeResponse: {
      ...state.activeResponse,
      status: 'resolving',
      currentPlayerId: null,
      resolvingStack: resolvingStack.slice(1),
      currentResolvingItem: resolvingStack[0] ?? null,
      timer: ACTIVE_RESPONSE_CONFIG.RESOLVE_STEP_DELAY_MS,
      passedPlayers: [],
    },
  }

  const startEvents: GameEvent[] = [
    {
      type: 'active_response_resolution_started',
      stack: resolvingStack,
      currentItem: resolvingStack[0] ?? null,
      timestamp: Date.now(),
    },
  ]

  return { state: startedState, events: startEvents }
}

export function progressArResolution(
  state: GameState,
  deltaTime: number,
  cardDefinitions: Map<string, CardDefinition>,
  resolveActionEffect: ResolveActionEffectFn
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = state

  if (!newState.activeResponse.isActive || newState.activeResponse.status !== 'resolving') {
    return { state: newState, events }
  }

  let remainingDelta = deltaTime
  let timer = newState.activeResponse.timer

  while (remainingDelta > 0 && newState.activeResponse.isActive && newState.activeResponse.status === 'resolving') {
    if (timer > remainingDelta) {
      timer -= remainingDelta
      remainingDelta = 0
      break
    }

    remainingDelta -= timer
    const result = resolveCurrentArStackItem(newState, cardDefinitions, resolveActionEffect)
    newState = result.state
    events.push(...result.events)

    if (!newState.activeResponse.isActive || newState.activeResponse.status !== 'resolving') {
      timer = 0
      break
    }

    timer = newState.activeResponse.timer
    if (timer === 0 && remainingDelta === 0) {
      break
    }
  }

  if (newState.activeResponse.isActive && newState.activeResponse.status === 'resolving') {
    newState = {
      ...newState,
      activeResponse: {
        ...newState.activeResponse,
        timer,
      },
    }
  }

  return { state: newState, events }
}

export function payCardCost(player: PlayerState, cost: number): PaymentResult | null {
  const availableMp = player.mp + player.blueMp
  if (availableMp < cost) {
    return null
  }

  const paidBlueMp = Math.min(player.blueMp, cost)
  const paidNormalMp = cost - paidBlueMp

  return {
    player: {
      ...player,
      blueMp: player.blueMp - paidBlueMp,
      mp: player.mp - paidNormalMp,
    },
    paidBlueMp,
    paidNormalMp,
  }
}

export function createActiveResponseStackItem(
  playerId: string,
  cardId: string,
  timestamp: number,
  target: string | undefined,
  cost: number
): ActiveResponseStack {
  return {
    playerId,
    cardId,
    timestamp,
    target,
    cost,
  }
}

export function startActiveResponse(
  state: GameState,
  initiatingPlayerId: string,
  firstStackItem: ActiveResponseStack,
  timestamp: number
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [
    {
      type: 'active_response_started',
      playerId: initiatingPlayerId,
      cardId: firstStackItem.cardId,
      timestamp,
    },
  ]

  const initiatorIndex = state.players.findIndex((player) => player.playerId === initiatingPlayerId)
  if (initiatorIndex === -1) {
    return { state, events: [] }
  }
  const opponentIndex = 1 - initiatorIndex

  // AR開始時のみ、お互いにAMP付与
  const players = [...state.players] as [PlayerState, PlayerState]
  players[initiatorIndex] = grantAmp(players[initiatorIndex], ACTIVE_RESPONSE_CONFIG.AMP_GAIN_ON_START)
  players[opponentIndex] = grantAmp(players[opponentIndex], ACTIVE_RESPONSE_CONFIG.AMP_GAIN_ON_START)

  const activeResponse: ActiveResponseState = {
    isActive: true,
    status: 'building',
    currentPlayerId: players[opponentIndex].playerId,
    stack: [firstStackItem],
    resolvingStack: [],
    currentResolvingItem: null,
    timer: ACTIVE_RESPONSE_CONFIG.TIMER_MS,
    passedPlayers: [],
  }

  return {
    state: {
      ...state,
      players,
      activeResponse,
    },
    events,
  }
}

export function appendActiveResponseAction(
  state: GameState,
  actingPlayerId: string,
  stackItem: ActiveResponseStack
): GameState {
  const actingPlayerIndex = state.players.findIndex((player) => player.playerId === actingPlayerId)
  if (actingPlayerIndex === -1) {
    return state
  }
  const opponentIndex = 1 - actingPlayerIndex
  const players = [...state.players] as [PlayerState, PlayerState]

  // AMP付与はAR開始時のみ。追加アクションでは付与しない

  return {
    ...state,
    players,
    activeResponse: {
      ...state.activeResponse,
      status: 'building',
      stack: [...state.activeResponse.stack, stackItem],
      currentPlayerId: players[opponentIndex].playerId,
      resolvingStack: [],
      currentResolvingItem: null,
      passedPlayers: [],
      timer: ACTIVE_RESPONSE_CONFIG.TIMER_MS,
    },
  }
}

export function passActiveResponsePriority(state: GameState, playerId: string): GameState {
  if (!state.activeResponse.isActive) {
    return state
  }

  if (state.activeResponse.passedPlayers.includes(playerId)) {
    return state
  }

  const currentPlayerIndex = state.players.findIndex(
    (player) => player.playerId === state.activeResponse.currentPlayerId
  )
  if (currentPlayerIndex === -1) {
    return state
  }
  const opponentIndex = 1 - currentPlayerIndex

  return {
    ...state,
    activeResponse: {
      ...state.activeResponse,
      currentPlayerId: state.players[opponentIndex].playerId,
      passedPlayers: [...state.activeResponse.passedPlayers, playerId],
      timer: ACTIVE_RESPONSE_CONFIG.TIMER_MS,
    },
  }
}

export function shouldResolveActiveResponse(state: GameState): boolean {
  if (!state.activeResponse.isActive) {
    return false
  }

  return (
    state.activeResponse.passedPlayers.length >= 2 ||
    (state.activeResponse.passedPlayers.length === 1 && state.activeResponse.stack.length === 0)
  )
}

export function clearActiveResponse(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      blueMp: 0,
    })) as [PlayerState, PlayerState],
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
  }
}

function grantAmp(player: PlayerState, amount: number): PlayerState {
  const capped = Math.min(
    ACTIVE_RESPONSE_CONFIG.MAX_AMP_DURING_AR,
    player.blueMp + amount
  )
  return {
    ...player,
    blueMp: capped,
  }
}

function resolveCurrentArStackItem(
  state: GameState,
  cardDefinitions: Map<string, CardDefinition>,
  resolveActionEffect: ResolveActionEffectFn
): { state: GameState; events: GameEvent[] } {
  const stackItem = state.activeResponse.currentResolvingItem
  const remainingStack = state.activeResponse.resolvingStack
  if (!stackItem) {
    return {
      state: clearActiveResponse(state),
      events: [
        {
          type: 'active_response_resolved',
          stack: [...state.activeResponse.stack].reverse(),
          timestamp: Date.now(),
        },
      ],
    }
  }

  let newState: GameState = {
    ...state,
    activeResponse: {
      ...state.activeResponse,
      currentResolvingItem: stackItem,
    },
  }

  const events: GameEvent[] = []
  const cardDef = resolveCardDefinition(cardDefinitions, stackItem.cardId)
  if (cardDef && cardDef.type === 'action' && (!stackItem.target || isTargetValid(newState, stackItem.target))) {
    const effectResult = resolveActionEffect(
      newState,
      stackItem.playerId,
      cardDef,
      cardDefinitions,
      stackItem
    )
    newState = effectResult.state
    events.push(...effectResult.events)
  }

  events.push({
    type: 'active_response_step_resolved',
    stackItem,
    remainingStackLength: remainingStack.length,
    timestamp: Date.now(),
  })

  if (remainingStack.length === 0) {
    return {
      state: clearActiveResponse({
        ...newState,
        activeResponse: {
          ...newState.activeResponse,
          currentResolvingItem: stackItem,
          resolvingStack: [],
          timer: 0,
        },
      }),
      events: [
        ...events,
        {
          type: 'active_response_resolved',
          stack: [...state.activeResponse.stack].reverse(),
          timestamp: Date.now(),
        },
      ],
    }
  }

  return {
    state: {
      ...newState,
      activeResponse: {
        ...newState.activeResponse,
        status: 'resolving',
        currentPlayerId: null,
        currentResolvingItem: remainingStack[0] ?? null,
        resolvingStack: remainingStack.slice(1),
        timer: ACTIVE_RESPONSE_CONFIG.RESOLVE_STEP_DELAY_MS,
        passedPlayers: [],
      },
    },
    events,
  }
}
