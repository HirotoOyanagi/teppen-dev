import type { CardDefinition } from './types'
import {
  cardHasAvailableTargets,
  cardRequiresTargetSelection,
  getCardTargetType,
} from './cardTargeting'

type CardPlayFlowState = {
  players: Array<{
    playerId: string
    units: unknown[]
  }>
}

export function shouldEnterCardTargetMode(
  state: CardPlayFlowState,
  playerId: string,
  cardDef: CardDefinition,
  target?: string
): boolean {
  if (target) {
    return false
  }

  const targetType = getCardTargetType(cardDef)
  if (!targetType) {
    return false
  }

  if (cardDef.type === 'unit') {
    return cardHasAvailableTargets(state, playerId, targetType)
  }

  return cardRequiresTargetSelection(cardDef)
}
