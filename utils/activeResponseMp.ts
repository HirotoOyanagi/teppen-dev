import type { CardDefinition, GameState, PlayerState } from '@/core/types'

/**
 * カードプレイ時に使えるMPの上限。
 * 応酬の起点となるアクション（AR開始前の1枚目）はAMP未付与のため通常MPのみ。
 */
export function mpAvailableForCardPlay(
  player: PlayerState,
  gameState: GameState,
  cardDef: CardDefinition
): number {
  const isActionStartingActiveResponse =
    cardDef.type === 'action' && !gameState.activeResponse.isActive
  const poolByStarter: Record<string, number> = {
    true: player.mp,
    false: player.mp + player.blueMp,
  }
  return poolByStarter[String(isActionStartingActiveResponse)]
}
