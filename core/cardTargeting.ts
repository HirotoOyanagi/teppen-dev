import type { CardDefinition } from './types'

export type CardTargetType = 'friendly_unit' | 'friendly_hero' | 'enemy_unit' | null
type TargetingState = {
  players: Array<{
    playerId: string
    units: unknown[]
  }>
}

function getEffectTokens(effectFunctions: string | undefined): string[] {
  if (!effectFunctions) return []
  return effectFunctions.split(';').map((t) => t.trim()).filter(Boolean)
}

export function cardRequiresTargetSelection(cardDef: CardDefinition): boolean {
  if (cardDef.type !== 'action') return false
  return getEffectTokens(cardDef.effectFunctions).some((t) => t.startsWith('target:'))
}

export function getCardTargetType(cardDef: CardDefinition): CardTargetType {
  const targetToken = getEffectTokens(cardDef.effectFunctions).find((t) => t.startsWith('target:'))
  if (!targetToken) return null

  const targetType = targetToken.split(':')[1]?.trim()
  if (targetType === 'friendly_unit') return 'friendly_unit'
  if (targetType === 'friendly_hero') return 'friendly_hero'
  if (targetType === 'enemy_unit') return 'enemy_unit'
  return null
}

export function cardHasAvailableTargets(
  state: TargetingState,
  playerId: string,
  targetType: CardTargetType
): boolean {
  if (!targetType) return false

  const playerIndex = state.players.findIndex((player) => player.playerId === playerId)
  if (playerIndex === -1) return false

  if (targetType === 'friendly_hero') return true
  if (targetType === 'friendly_unit') return state.players[playerIndex].units.length > 0

  const opponentIndex = 1 - playerIndex
  return state.players[opponentIndex].units.length > 0
}
