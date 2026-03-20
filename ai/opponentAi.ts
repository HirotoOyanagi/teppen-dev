/**
 * AI対戦用 - 相手プレイヤー（player2）の行動決定
 * オンライン対戦と同様のルールに従い、GameInput を生成する
 */

import type { GameInput, GameState, CardDefinition, PlayerState } from '@/core/types'
import { resolveCardDefinition } from '@/core/cardId'
import { mpAvailableForCardPlay } from '@/utils/activeResponseMp'
import {
  cardRequiresTargetSelection,
  getCardTargetType,
  cardHasAvailableTargets,
} from '@/core/cardTargeting'

const AI_PLAYER_ID = 'player2'

/** 通常プレイ時のAI行動間隔（ミリ秒） */
export const AI_NORMAL_ACTION_INTERVAL_MS = 1200

/** AR中のAI応答間隔（ミリ秒）※積極的にアクションを返すため短め */
export const AI_AR_ACTION_INTERVAL_MS = 400

/**
 * ゲーム状態からAIの次の行動を決定する（pure function）
 * @returns GameInput または null（何もしない）
 */
export function decideOpponentAi(
  state: GameState,
  cardMap: Map<string, CardDefinition>
): GameInput | null {
  if (state.phase !== 'playing') return null

  const player = state.players.find((p) => p.playerId === AI_PLAYER_ID)
  const opponent = state.players.find((p) => p.playerId !== AI_PLAYER_ID)
  if (!player || !opponent) return null

  const ar = state.activeResponse
  const isArBuilding = ar.isActive && ar.status === 'building'
  const isAiTurnInAr = isArBuilding && ar.currentPlayerId === AI_PLAYER_ID

  // AR中で自分のターン → アクションを出すかパス
  if (isAiTurnInAr) {
    const actionInput = tryPlayActionInAr(state, player, opponent, cardMap)
    if (actionInput) return actionInput
    return {
      type: 'active_response_pass',
      playerId: AI_PLAYER_ID,
      timestamp: Date.now(),
    }
  }

  // 通常プレイ → アクションを優先して積極的に返す、次にユニット / 必殺技 / おとも
  const heroArtInput = tryHeroArt(state, player, opponent, cardMap)
  if (heroArtInput) return heroArtInput

  const companionInput = tryCompanion(state, player, opponent, cardMap)
  if (companionInput) return companionInput

  const actionInput = tryPlayAction(state, player, opponent, cardMap)
  if (actionInput) return actionInput

  const unitInput = tryPlayUnit(state, player, opponent, cardMap)
  if (unitInput) return unitInput

  return null
}

function tryPlayActionInAr(
  state: GameState,
  player: PlayerState,
  opponent: { units: { id: string }[] },
  cardMap: Map<string, CardDefinition>
): GameInput | null {
  const sources: { cardId: string; fromExPocket: boolean; cost: number }[] = []
  for (const cardId of player.hand) {
    const def = resolveCardDefinition(cardMap, cardId)
    if (def?.type === 'action') sources.push({ cardId, fromExPocket: false, cost: def.cost })
  }
  for (const cardId of player.exPocket) {
    const def = resolveCardDefinition(cardMap, cardId)
    if (def?.type === 'action') sources.push({ cardId, fromExPocket: true, cost: def.cost })
  }
  sources.sort((a, b) => a.cost - b.cost)

  for (const { cardId, fromExPocket } of sources) {
    const cardDef = resolveCardDefinition(cardMap, cardId)
    if (!cardDef || cardDef.type !== 'action') continue

    const availableMp = player.mp + player.blueMp
    if (availableMp < cardDef.cost) continue

    const targetType = getCardTargetType(cardDef)
    const needsTarget = cardRequiresTargetSelection(cardDef)

    if (!needsTarget) {
      return {
        type: 'active_response_action',
        playerId: AI_PLAYER_ID,
        cardId,
        fromExPocket: fromExPocket || undefined,
        timestamp: Date.now(),
      }
    }

    if (!targetType) continue
    const hasTargets = cardHasAvailableTargets(state, AI_PLAYER_ID, targetType)
    if (!hasTargets) continue

    const target = pickTarget(state, AI_PLAYER_ID, targetType)
    if (!target) continue

    return {
      type: 'active_response_action',
      playerId: AI_PLAYER_ID,
      cardId,
      target,
      fromExPocket: fromExPocket || undefined,
      timestamp: Date.now(),
    }
  }

  return null
}

function tryHeroArt(
  state: GameState,
  player: PlayerState,
  opponent: { units: { id: string }[] },
  cardMap: Map<string, CardDefinition>
): GameInput | null {
  const heroArt = player.hero?.heroArt
  if (!heroArt || player.ap < heroArt.cost) return null
  if (state.activeResponse.isActive) return null

  if (!heroArt.requiresTarget) {
    return {
      type: 'hero_art',
      playerId: AI_PLAYER_ID,
      timestamp: Date.now(),
    }
  }

  const target = opponent.units.length > 0 ? opponent.units[0].id : undefined
  if (!target) return null

  return {
    type: 'hero_art',
    playerId: AI_PLAYER_ID,
    target,
    timestamp: Date.now(),
  }
}

function tryCompanion(
  state: GameState,
  player: PlayerState,
  self: { units: { id: string }[] },
  cardMap: Map<string, CardDefinition>
): GameInput | null {
  const companion = player.hero?.companion
  if (!companion || player.ap < companion.cost) return null
  if (state.activeResponse.isActive) return null

  if (!companion.requiresTarget) {
    return {
      type: 'companion',
      playerId: AI_PLAYER_ID,
      timestamp: Date.now(),
    }
  }

  const target = self.units.length > 0 ? self.units[0].id : undefined
  if (!target) return null

  return {
    type: 'companion',
    playerId: AI_PLAYER_ID,
    target,
    timestamp: Date.now(),
  }
}

function tryPlayUnit(
  state: GameState,
  player: PlayerState,
  opponent: { units: { id: string }[] },
  cardMap: Map<string, CardDefinition>
): GameInput | null {
  if (state.activeResponse.isActive) return null

  const usedLanes = new Set(player.units.map((u) => u.lane))
  const emptyLanes = [0, 1, 2].filter((l) => !usedLanes.has(l))
  if (emptyLanes.length === 0) return null

  const playableUnits = player.hand
    .map((cardId) => {
      const def = resolveCardDefinition(cardMap, cardId)
      if (!def || def.type !== 'unit' || !def.unitStats) return null
      const availableMp = mpAvailableForCardPlay(player, state, def)
      if (availableMp < def.cost) return null
      return { cardId, def }
    })
    .filter((c): c is { cardId: string; def: CardDefinition } => c !== null)

  if (playableUnits.length === 0) return null

  // コストが低い順、次に攻撃力が高い順でソート
  playableUnits.sort((a, b) => {
    const costDiff = a.def.cost - b.def.cost
    if (costDiff !== 0) return costDiff
    const atkA = a.def.unitStats?.attack ?? 0
    const atkB = b.def.unitStats?.attack ?? 0
    return atkB - atkA
  })

  const pick = playableUnits[0]
  const lane = emptyLanes[Math.floor(Math.random() * emptyLanes.length)]

  return {
    type: 'play_card',
    playerId: AI_PLAYER_ID,
    cardId: pick.cardId,
    lane,
    timestamp: Date.now(),
  }
}

function tryPlayAction(
  state: GameState,
  player: PlayerState,
  opponent: { units: { id: string }[] },
  cardMap: Map<string, CardDefinition>
): GameInput | null {
  if (state.activeResponse.isActive) return null

  const sources: { cardId: string; fromExPocket: boolean; cost: number }[] = []
  for (const cardId of player.hand) {
    const def = resolveCardDefinition(cardMap, cardId)
    if (def?.type === 'action') sources.push({ cardId, fromExPocket: false, cost: def.cost })
  }
  for (const cardId of player.exPocket) {
    const def = resolveCardDefinition(cardMap, cardId)
    if (def?.type === 'action') sources.push({ cardId, fromExPocket: true, cost: def.cost })
  }
  sources.sort((a, b) => a.cost - b.cost)

  for (const { cardId, fromExPocket } of sources) {
    const cardDef = resolveCardDefinition(cardMap, cardId)
    if (!cardDef || cardDef.type !== 'action') continue

    const availableMp = mpAvailableForCardPlay(player, state, cardDef)
    if (availableMp < cardDef.cost) continue

    const targetType = getCardTargetType(cardDef)
    const needsTarget = cardRequiresTargetSelection(cardDef)

    if (!needsTarget) {
      return {
        type: 'play_card',
        playerId: AI_PLAYER_ID,
        cardId,
        fromExPocket,
        timestamp: Date.now(),
      }
    }

    if (!targetType) continue
    const hasTargets = cardHasAvailableTargets(state, AI_PLAYER_ID, targetType)
    if (!hasTargets) continue

    const target = pickTarget(state, AI_PLAYER_ID, targetType)
    if (!target) continue

    return {
      type: 'play_card',
      playerId: AI_PLAYER_ID,
      cardId,
      target,
      fromExPocket,
      timestamp: Date.now(),
    }
  }

  return null
}

function pickTarget(
  state: GameState,
  playerId: string,
  targetType: 'friendly_unit' | 'friendly_hero' | 'enemy_unit'
): string | undefined {
  const playerIndex = state.players.findIndex((p) => p.playerId === playerId)
  if (playerIndex === -1) return undefined

  const self = state.players[playerIndex]
  const opponent = state.players[1 - playerIndex]

  const targetByType: Record<string, string | undefined> = {
    friendly_hero: self.playerId,
    friendly_unit: self.units.length > 0 ? self.units[0].id : undefined,
    enemy_unit: opponent.units.length > 0 ? opponent.units[0].id : undefined,
  }
  return targetByType[targetType]
}
