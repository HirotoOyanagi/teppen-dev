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
const DAMAGE_GROWTH_CORE_CARD_IDS = new Set([
  'COR_007', // スパーク
  'COR_009', // スポッター
  'COR_015', // ガイド
  'COR_025', // ハンター
  'COR_027', // 火種
  'COR_029', // 灼熱一閃
  'COR_035', // 死角狙撃
  'COR_039', // 焔の収束点
  'COR_040', // 終末の開炉
  'COR_041', // 側面強襲
])

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
  const opponentHasUnits = opponent.units.length > 0
  const sources: { cardId: string; fromExPocket: boolean; cost: number }[] = []
  for (const cardId of player.hand) {
    const def = resolveCardDefinition(cardMap, cardId)
    if (def?.type === 'action') sources.push({ cardId, fromExPocket: false, cost: def.cost })
  }
  for (const cardId of player.exPocket) {
    const def = resolveCardDefinition(cardMap, cardId)
    if (def?.type === 'action') sources.push({ cardId, fromExPocket: true, cost: def.cost })
  }
  sources.sort((a, b) => {
    const cardA = resolveCardDefinition(cardMap, a.cardId)
    const cardB = resolveCardDefinition(cardMap, b.cardId)
    const scoreA = getDamageGrowthActionScore(cardA, opponentHasUnits)
    const scoreB = getDamageGrowthActionScore(cardB, opponentHasUnits)
    const scoreDiff = scoreB - scoreA
    if (scoreDiff !== 0) return scoreDiff
    return a.cost - b.cost
  })

  for (const { cardId, fromExPocket } of sources) {
    const cardDef = resolveCardDefinition(cardMap, cardId)
    if (!cardDef || cardDef.type !== 'action') continue

    const availableMp = player.mp + player.blueMp
    if (availableMp < cardDef.cost) continue

    const targetType = getCardTargetType(cardDef)
    const needsTarget = cardRequiresTargetSelection(cardDef)

    if (!needsTarget) {
      // ターゲット不要のダメージ系（敵ユニットがいないと無駄）を避ける
      if (
        !opponentHasUnits &&
        isEnemyUnitDamageCardWithoutEnemyHero(cardDef)
      ) {
        continue
      }
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

  // ダメージ育成シナジー重視でソート
  playableUnits.sort((a, b) => {
    const scoreDiff = getDamageGrowthUnitScore(b.def) - getDamageGrowthUnitScore(a.def)
    if (scoreDiff !== 0) return scoreDiff
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
  const opponentHasUnits = opponent.units.length > 0
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
  sources.sort((a, b) => {
    const cardA = resolveCardDefinition(cardMap, a.cardId)
    const cardB = resolveCardDefinition(cardMap, b.cardId)
    const scoreA = getDamageGrowthActionScore(cardA, opponentHasUnits)
    const scoreB = getDamageGrowthActionScore(cardB, opponentHasUnits)
    const scoreDiff = scoreB - scoreA
    if (scoreDiff !== 0) return scoreDiff
    return a.cost - b.cost
  })

  for (const { cardId, fromExPocket } of sources) {
    const cardDef = resolveCardDefinition(cardMap, cardId)
    if (!cardDef || cardDef.type !== 'action') continue

    const availableMp = mpAvailableForCardPlay(player, state, cardDef)
    if (availableMp < cardDef.cost) continue

    const targetType = getCardTargetType(cardDef)
    const needsTarget = cardRequiresTargetSelection(cardDef)

    if (!needsTarget) {
      // ターゲット不要のダメージ系（敵ユニットがいないと無駄）を避ける
      if (
        !opponentHasUnits &&
        isEnemyUnitDamageCardWithoutEnemyHero(cardDef)
      ) {
        continue
      }
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

  const enemyUnitsByHp = [...opponent.units].sort((a, b) => a.hp - b.hp)
  const targetByType: Record<string, string | undefined> = {
    friendly_hero: self.playerId,
    friendly_unit: self.units.length > 0 ? self.units[0].id : undefined,
    enemy_unit: enemyUnitsByHp.length > 0 ? enemyUnitsByHp[0].id : undefined,
  }
  return targetByType[targetType]
}

function getDamageGrowthActionScore(
  cardDef: CardDefinition | null | undefined,
  opponentHasUnits: boolean
): number {
  if (!cardDef) return -999
  let score = 0
  if (DAMAGE_GROWTH_CORE_CARD_IDS.has(cardDef.id)) score += 20
  if (cardDef.description && cardDef.description.includes('ダメージ')) score += 9
  if (cardDef.description && cardDef.description.includes('破壊')) score += 6
  if (cardDef.description && cardDef.description.includes('+1/+1')) score += 8
  if (cardDef.description && cardDef.description.includes('攻撃力を+1')) score += 5
  const lowCostBonusMap: Record<number, number> = {
    1: 5,
    2: 4,
    3: 3,
    4: 2,
    5: 1,
  }
  const lowCostBonus = lowCostBonusMap[cardDef.cost]
  if (typeof lowCostBonus === 'number') score += lowCostBonus

  // 盤面適応:
  // 敵ユニットがいないのに「敵ユニットへのダメージ」が主効果のカードは、育成の種まき以外では無駄になりやすい。
  // 文言ベースで大きくペナルティを入れて、代替行動（盤面/火種/バフ）を選びやすくする。
  const description = cardDef.description || ''
  if (!opponentHasUnits) {
    if (isEnemyUnitDamageCardWithoutEnemyHero(cardDef)) score -= 120
    else if (description.includes('敵ユニット')) score -= 25
  }

  return score
}

function isEnemyUnitDamageCardWithoutEnemyHero(cardDef: CardDefinition): boolean {
  const description = cardDef.description || ''
  const affectsEnemyUnits = description.includes('敵ユニット')
  const affectsEnemyHero = description.includes('敵ヒーロー') || description.includes('敵リーダー')
  // 敵ユニットへのダメージはあるが、敵ヒーロー/リーダーへの明示がないカードを「無駄撃ち候補」とみなす
  return affectsEnemyUnits && !affectsEnemyHero
}

function getDamageGrowthUnitScore(cardDef: CardDefinition): number {
  let score = 0
  if (DAMAGE_GROWTH_CORE_CARD_IDS.has(cardDef.id)) score += 18
  if (cardDef.description && cardDef.description.includes('ダメージ')) score += 8
  if (cardDef.description && cardDef.description.includes('破壊')) score += 6
  if (cardDef.description && cardDef.description.includes('+1/+1')) score += 10
  if (cardDef.description && cardDef.description.includes('攻撃時')) score += 4
  const attack = cardDef.unitStats?.attack ?? 0
  if (attack >= 3) score += 2
  return score
}
